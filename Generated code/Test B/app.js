const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { db } = require("./lib/db");
const {
  validateRegistration,
  validateLogin,
  validateSearchFilters,
  validateReview,
  validateContactRequest,
  validateClubForm
} = require("./lib/validators");
const { requireAuth, requireAdmin } = require("./middleware/auth");

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "https://images.unsplash.com", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null
      }
    }
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "clubs.sid",
    secret: process.env.SESSION_SECRET || "development-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

// Attach shared template state, a simple flash message, and one CSRF token per session.
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  res.locals.csrfToken = req.session.csrfToken;

  delete req.session.flash;
  next();
});

// All form submissions are protected by a server-side CSRF token check.
app.use((req, res, next) => {
  if (req.method === "POST") {
    const csrfToken = req.body ? req.body._csrf : "";
    if (!csrfToken || csrfToken !== req.session.csrfToken) {
      return res.status(403).render("error", {
        title: "Request blocked",
        message: "The form could not be verified. Refresh the page and try again."
      });
    }
  }

  return next();
});

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function safeRedirectTarget(value, fallback) {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return fallback;
}

function getFilterOptions() {
  return {
    categories: db.prepare("SELECT DISTINCT category FROM clubs ORDER BY category").all().map((row) => row.category),
    ageGroups: db.prepare("SELECT DISTINCT age_group FROM clubs ORDER BY age_group").all().map((row) => row.age_group),
    costTypes: db.prepare("SELECT DISTINCT cost_type FROM clubs ORDER BY cost_type").all().map((row) => row.cost_type),
    venueTypes: db.prepare("SELECT DISTINCT venue_type FROM clubs ORDER BY venue_type").all().map((row) => row.venue_type),
    meetingFrequencies: db
      .prepare("SELECT DISTINCT meeting_frequency FROM clubs ORDER BY meeting_frequency")
      .all()
      .map((row) => row.meeting_frequency)
  };
}

function getFavouriteClubIds(userId) {
  if (!userId) {
    return [];
  }

  return db
    .prepare("SELECT club_id FROM favourites WHERE user_id = ?")
    .all(userId)
    .map((row) => row.club_id);
}

function getFeaturedClubs(limit) {
  return db.prepare(
    `SELECT clubs.*,
            ROUND(AVG(reviews.rating), 1) AS average_rating,
            COUNT(reviews.id) AS review_count
     FROM clubs
     LEFT JOIN reviews ON reviews.club_id = clubs.id
     GROUP BY clubs.id
     ORDER BY clubs.created_at DESC, clubs.name ASC
     LIMIT ?`
  ).all(limit);
}

function searchClubs(filters) {
  const whereClauses = [];
  const params = {};

  if (filters.q) {
    whereClauses.push("(clubs.name LIKE @q OR clubs.description LIKE @q)");
    params.q = `%${filters.q}%`;
  }
  if (filters.activity_type) {
    whereClauses.push("clubs.activity_type LIKE @activity_type");
    params.activity_type = `%${filters.activity_type}%`;
  }
  if (filters.location) {
    whereClauses.push("(clubs.location LIKE @location OR clubs.address LIKE @location)");
    params.location = `%${filters.location}%`;
  }
  if (filters.category) {
    whereClauses.push("clubs.category = @category");
    params.category = filters.category;
  }
  if (filters.age_group) {
    whereClauses.push("clubs.age_group = @age_group");
    params.age_group = filters.age_group;
  }
  if (filters.cost_type) {
    whereClauses.push("clubs.cost_type = @cost_type");
    params.cost_type = filters.cost_type;
  }
  if (filters.venue_type) {
    whereClauses.push("clubs.venue_type = @venue_type");
    params.venue_type = filters.venue_type;
  }
  if (filters.meeting_frequency) {
    whereClauses.push("clubs.meeting_frequency = @meeting_frequency");
    params.meeting_frequency = filters.meeting_frequency;
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  return db.prepare(
    `SELECT clubs.*,
            ROUND(AVG(reviews.rating), 1) AS average_rating,
            COUNT(reviews.id) AS review_count
     FROM clubs
     LEFT JOIN reviews ON reviews.club_id = clubs.id
     ${whereSql}
     GROUP BY clubs.id
     ORDER BY clubs.name ASC`
  ).all(params);
}

function getClubWithMeta(clubId) {
  return db.prepare(
    `SELECT clubs.*,
            ROUND(AVG(reviews.rating), 1) AS average_rating,
            COUNT(reviews.id) AS review_count
     FROM clubs
     LEFT JOIN reviews ON reviews.club_id = clubs.id
     WHERE clubs.id = ?
     GROUP BY clubs.id`
  ).get(clubId);
}

function getClubReviews(clubId) {
  return db.prepare(
    `SELECT reviews.id,
            reviews.rating,
            reviews.comment,
            reviews.created_at,
            users.name AS reviewer_name
     FROM reviews
     INNER JOIN users ON users.id = reviews.user_id
     WHERE reviews.club_id = ?
     ORDER BY reviews.created_at DESC`
  ).all(clubId);
}

function getHomeFavourites(userId) {
  if (!userId) {
    return [];
  }

  return db.prepare(
    `SELECT clubs.id, clubs.name, clubs.location, clubs.category
     FROM favourites
     INNER JOIN clubs ON clubs.id = favourites.club_id
     WHERE favourites.user_id = ?
     ORDER BY favourites.created_at DESC`
  ).all(userId);
}

function renderClubDetails(req, res, clubId, options = {}) {
  const club = getClubWithMeta(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  const reviews = getClubReviews(clubId);
  const isFavourite = req.session.user
    ? Boolean(
        db
          .prepare("SELECT 1 FROM favourites WHERE user_id = ? AND club_id = ?")
          .get(req.session.user.id, clubId)
      )
    : false;

  return res.render("club-details", {
    club,
    reviews,
    isFavourite,
    returnTo: req.originalUrl,
    reviewErrors: options.reviewErrors || [],
    reviewValues: options.reviewValues || { rating: "", comment: "" },
    contactErrors: options.contactErrors || [],
    contactValues: options.contactValues || { message: "", preferred_contact: "" }
  });
}

// Public pages: home, search, and club detail pages.
app.get("/", (req, res) => {
  const featuredClubs = getFeaturedClubs(6);
  const favouriteClubs = getHomeFavourites(req.session.user ? req.session.user.id : null);

  res.render("index", {
    featuredClubs,
    favouriteClubs,
    filters: {
      q: "",
      activity_type: "",
      location: ""
    }
  });
});

app.get("/clubs", (req, res) => {
  const filters = validateSearchFilters(req.query);
  const clubs = searchClubs(filters);
  const favouriteClubIds = getFavouriteClubIds(req.session.user ? req.session.user.id : null);

  res.render("clubs", {
    clubs,
    filters,
    filterOptions: getFilterOptions(),
    favouriteClubIds,
    currentPath: req.originalUrl
  });
});

app.get("/clubs/:id", (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(clubId)) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  return renderClubDetails(req, res, clubId);
});

// Logged-in member actions: favourites, contact requests, and reviews.
app.post("/clubs/:id/favourite", requireAuth, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = getClubWithMeta(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  db.prepare("INSERT OR IGNORE INTO favourites (user_id, club_id) VALUES (?, ?)").run(req.session.user.id, clubId);
  setFlash(req, "success", `${club.name} was added to your favourites.`);
  return res.redirect(safeRedirectTarget(req.body.returnTo, `/clubs/${clubId}`));
});

app.post("/clubs/:id/unfavourite", requireAuth, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = getClubWithMeta(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  db.prepare("DELETE FROM favourites WHERE user_id = ? AND club_id = ?").run(req.session.user.id, clubId);
  setFlash(req, "success", `${club.name} was removed from your favourites.`);
  return res.redirect(safeRedirectTarget(req.body.returnTo, `/clubs/${clubId}`));
});

app.post("/clubs/:id/contact", requireAuth, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = getClubWithMeta(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  const { values, errors } = validateContactRequest(req.body);
  if (errors.length) {
    return renderClubDetails(req, res, clubId, {
      contactErrors: errors,
      contactValues: values
    });
  }

  db.prepare(
    `INSERT INTO contact_requests (user_id, club_id, message, preferred_contact)
     VALUES (?, ?, ?, ?)`
  ).run(req.session.user.id, clubId, values.message, values.preferred_contact);

  setFlash(req, "success", "Your interest request was sent to the club.");
  return res.redirect(`/clubs/${clubId}`);
});

app.post("/clubs/:id/reviews", requireAuth, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = getClubWithMeta(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  const { values, errors } = validateReview(req.body);
  if (errors.length) {
    return renderClubDetails(req, res, clubId, {
      reviewErrors: errors,
      reviewValues: values
    });
  }

  db.prepare(
    `INSERT INTO reviews (user_id, club_id, rating, comment)
     VALUES (?, ?, ?, ?)`
  ).run(req.session.user.id, clubId, values.rating, values.comment);

  setFlash(req, "success", "Your review was posted.");
  return res.redirect(`/clubs/${clubId}`);
});

// Authentication routes use session regeneration after login and registration.
app.get("/auth", (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === "admin" ? "/dashboard" : "/");
  }

  return res.render("auth", {
    registerErrors: [],
    registerValues: { name: "", email: "" },
    loginErrors: [],
    loginValues: { email: "" }
  });
});

app.post("/register", async (req, res, next) => {
  try {
    const { values, errors } = validateRegistration(req.body);

    if (errors.length) {
      return res.status(400).render("auth", {
        registerErrors: errors,
        registerValues: { name: values.name, email: values.email },
        loginErrors: [],
        loginValues: { email: "" }
      });
    }

    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(values.email);
    if (existingUser) {
      return res.status(400).render("auth", {
        registerErrors: ["That email address is already registered."],
        registerValues: { name: values.name, email: values.email },
        loginErrors: [],
        loginValues: { email: "" }
      });
    }

    const passwordHash = await bcrypt.hash(values.password, 12);
    const result = db.prepare(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'user')`
    ).run(values.name, values.email, passwordHash);

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.user = {
        id: result.lastInsertRowid,
        name: values.name,
        email: values.email,
        role: "user"
      };
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      req.session.flash = {
        type: "success",
        message: "Your account has been created."
      };

      return res.redirect("/");
    });
  } catch (error) {
    next(error);
  }
});

app.post("/login", async (req, res, next) => {
  try {
    const { values, errors } = validateLogin(req.body);

    if (errors.length) {
      return res.status(400).render("auth", {
        registerErrors: [],
        registerValues: { name: "", email: "" },
        loginErrors: errors,
        loginValues: { email: values.email }
      });
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(values.email);
    if (!user) {
      return res.status(400).render("auth", {
        registerErrors: [],
        registerValues: { name: "", email: "" },
        loginErrors: ["Incorrect email or password."],
        loginValues: { email: values.email }
      });
    }

    const passwordMatches = await bcrypt.compare(values.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(400).render("auth", {
        registerErrors: [],
        registerValues: { name: "", email: "" },
        loginErrors: ["Incorrect email or password."],
        loginValues: { email: values.email }
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      req.session.csrfToken = crypto.randomBytes(32).toString("hex");
      req.session.flash = {
        type: "success",
        message: `Welcome back, ${user.name}.`
      };

      return res.redirect(user.role === "admin" ? "/dashboard" : "/");
    });
  } catch (error) {
    next(error);
  }
});

app.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie("clubs.sid");
    return res.redirect("/auth");
  });
});

// Admin-only CRUD and moderation views live behind a separate authorization check.
app.get("/dashboard", requireAdmin, (req, res) => {
  const clubs = db.prepare(
    `SELECT clubs.*,
            ROUND(AVG(reviews.rating), 1) AS average_rating,
            COUNT(reviews.id) AS review_count
     FROM clubs
     LEFT JOIN reviews ON reviews.club_id = clubs.id
     GROUP BY clubs.id
     ORDER BY clubs.name ASC`
  ).all();

  const contactRequests = db.prepare(
    `SELECT contact_requests.id,
            contact_requests.message,
            contact_requests.preferred_contact,
            contact_requests.created_at,
            clubs.id AS club_id,
            clubs.name AS club_name,
            users.name AS user_name,
            users.email AS user_email
     FROM contact_requests
     INNER JOIN clubs ON clubs.id = contact_requests.club_id
     INNER JOIN users ON users.id = contact_requests.user_id
     ORDER BY contact_requests.created_at DESC`
  ).all();

  return res.render("admin/dashboard", {
    clubs,
    contactRequests
  });
});

app.get("/admin/clubs/new", requireAdmin, (req, res) => {
  res.render("admin/club-form", {
    pageTitle: "Add Club",
    formAction: "/admin/clubs",
    submitLabel: "Create club",
    club: {
      name: "",
      category: "",
      activity_type: "",
      location: "",
      age_group: "Adults",
      cost_type: "Free",
      venue_type: "Indoor",
      meeting_frequency: "Weekly",
      address: "",
      meeting_time: "",
      contact_email: "",
      image_url: "",
      description: ""
    },
    errors: []
  });
});

app.post("/admin/clubs", requireAdmin, (req, res) => {
  const { values, errors } = validateClubForm(req.body);

  if (errors.length) {
    return res.status(400).render("admin/club-form", {
      pageTitle: "Add Club",
      formAction: "/admin/clubs",
      submitLabel: "Create club",
      club: values,
      errors
    });
  }

  db.prepare(
    `INSERT INTO clubs (
      name,
      category,
      activity_type,
      location,
      age_group,
      cost_type,
      venue_type,
      meeting_frequency,
      address,
      meeting_time,
      contact_email,
      image_url,
      description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    values.name,
    values.category,
    values.activity_type,
    values.location,
    values.age_group,
    values.cost_type,
    values.venue_type,
    values.meeting_frequency,
    values.address,
    values.meeting_time,
    values.contact_email,
    values.image_url,
    values.description
  );

  setFlash(req, "success", "Club created successfully.");
  return res.redirect("/dashboard");
});

app.get("/admin/clubs/:id/edit", requireAdmin, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = db.prepare("SELECT * FROM clubs WHERE id = ?").get(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  return res.render("admin/club-form", {
    pageTitle: "Edit Club",
    formAction: `/admin/clubs/${clubId}`,
    submitLabel: "Save changes",
    club,
    errors: []
  });
});

app.post("/admin/clubs/:id", requireAdmin, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const existingClub = db.prepare("SELECT * FROM clubs WHERE id = ?").get(clubId);

  if (!existingClub) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  const { values, errors } = validateClubForm(req.body);
  if (errors.length) {
    return res.status(400).render("admin/club-form", {
      pageTitle: "Edit Club",
      formAction: `/admin/clubs/${clubId}`,
      submitLabel: "Save changes",
      club: values,
      errors
    });
  }

  db.prepare(
    `UPDATE clubs
     SET name = ?,
         category = ?,
         activity_type = ?,
         location = ?,
         age_group = ?,
         cost_type = ?,
         venue_type = ?,
         meeting_frequency = ?,
         address = ?,
         meeting_time = ?,
         contact_email = ?,
         image_url = ?,
         description = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    values.name,
    values.category,
    values.activity_type,
    values.location,
    values.age_group,
    values.cost_type,
    values.venue_type,
    values.meeting_frequency,
    values.address,
    values.meeting_time,
    values.contact_email,
    values.image_url,
    values.description,
    clubId
  );

  setFlash(req, "success", "Club updated successfully.");
  return res.redirect("/dashboard");
});

app.post("/admin/clubs/:id/delete", requireAdmin, (req, res) => {
  const clubId = Number.parseInt(req.params.id, 10);
  const club = db.prepare("SELECT name FROM clubs WHERE id = ?").get(clubId);

  if (!club) {
    return res.status(404).render("error", {
      title: "Club not found",
      message: "The club you requested could not be found."
    });
  }

  db.prepare("DELETE FROM clubs WHERE id = ?").run(clubId);
  setFlash(req, "success", `${club.name} was deleted.`);
  return res.redirect("/dashboard");
});

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page not found",
    message: "The page you requested does not exist."
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).render("error", {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again."
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Local Social Clubs Finder running at http://localhost:${port}`);
  });
}

module.exports = app;
