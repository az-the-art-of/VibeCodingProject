const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { hashPassword, verifyPassword } = require("./src/auth");
const { all, get, initializeDatabase, run } = require("./src/database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const CLUB_FIELD_OPTIONS = {
  categories: [
    "Community",
    "Creative",
    "Games",
    "Learning",
    "Literature",
    "Music",
    "Outdoors",
    "Sports",
    "Technology",
    "Wellness"
  ],
  ageGroups: ["All Ages", "Young Adults", "Adults", "Families", "Seniors", "Teens"],
  costTypes: ["Free", "Paid"],
  settingTypes: ["Indoor", "Outdoor", "Hybrid"],
  meetingFrequencies: ["Weekly", "Biweekly", "Monthly"]
};

initializeDatabase();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "local-social-clubs-finder-secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use((req, res, next) => {
  const flash = req.session.flash || null;
  delete req.session.flash;

  req.currentUser = null;
  res.locals.currentUser = null;
  res.locals.isAdmin = false;
  res.locals.flash = flash;
  res.locals.currentPath = req.path;
  res.locals.formatDate = (value) => {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleString("en-IE", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  if (req.session.userId) {
    const user = get(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [req.session.userId]
    );

    if (user) {
      req.currentUser = user;
      res.locals.currentUser = user;
      res.locals.isAdmin = user.role === "admin";
    } else {
      delete req.session.userId;
    }
  }

  next();
});

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function sanitize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPostLoginRedirect(req) {
  const redirectTo =
    req.session.returnTo && req.session.returnTo !== "/auth"
      ? req.session.returnTo
      : "/";

  delete req.session.returnTo;
  return redirectTo;
}

function requireUser(req, res, next) {
  if (!req.currentUser) {
    req.session.returnTo = req.get("Referer") || req.originalUrl || "/";
    setFlash(req, "error", "Please log in to continue.");
    return res.redirect("/auth");
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    req.session.returnTo = req.originalUrl || "/admin";
    setFlash(req, "error", "Please log in with an admin account.");
    return res.redirect("/auth");
  }

  if (req.currentUser.role !== "admin") {
    setFlash(req, "error", "Admin access is required for that page.");
    return res.redirect("/");
  }

  next();
}

function renderError(res, status, title, message) {
  return res.status(status).render("error", {
    title,
    message
  });
}

function getFilterOptions() {
  return {
    categories: all("SELECT DISTINCT category FROM clubs ORDER BY category").map(
      (row) => row.category
    ),
    ageGroups: all("SELECT DISTINCT age_group FROM clubs ORDER BY age_group").map(
      (row) => row.age_group
    ),
    costTypes: all("SELECT DISTINCT cost_type FROM clubs ORDER BY cost_type").map(
      (row) => row.cost_type
    ),
    settingTypes: all("SELECT DISTINCT setting_type FROM clubs ORDER BY setting_type").map(
      (row) => row.setting_type
    ),
    meetingFrequencies: all(
      "SELECT DISTINCT meeting_frequency FROM clubs ORDER BY meeting_frequency"
    ).map((row) => row.meeting_frequency)
  };
}

function collectSearchFilters(query) {
  return {
    q: sanitize(query.q),
    activity: sanitize(query.activity),
    location: sanitize(query.location),
    category: sanitize(query.category),
    ageGroup: sanitize(query.ageGroup),
    cost: sanitize(query.cost),
    setting: sanitize(query.setting),
    frequency: sanitize(query.frequency)
  };
}

function buildClubSearch(filters) {
  const clauses = [];
  const params = [];

  if (filters.q) {
    clauses.push("clubs.name LIKE ?");
    params.push(`%${filters.q}%`);
  }

  if (filters.activity) {
    clauses.push("clubs.activity_type LIKE ?");
    params.push(`%${filters.activity}%`);
  }

  if (filters.location) {
    clauses.push("(clubs.location LIKE ? OR clubs.address LIKE ?)");
    params.push(`%${filters.location}%`, `%${filters.location}%`);
  }

  if (filters.category) {
    clauses.push("clubs.category = ?");
    params.push(filters.category);
  }

  if (filters.ageGroup) {
    clauses.push("clubs.age_group = ?");
    params.push(filters.ageGroup);
  }

  if (filters.cost) {
    clauses.push("clubs.cost_type = ?");
    params.push(filters.cost);
  }

  if (filters.setting) {
    clauses.push("clubs.setting_type = ?");
    params.push(filters.setting);
  }

  if (filters.frequency) {
    clauses.push("clubs.meeting_frequency = ?");
    params.push(filters.frequency);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return all(
    `
      SELECT
        clubs.*,
        COALESCE(review_stats.average_rating, 0) AS average_rating,
        COALESCE(review_stats.review_count, 0) AS review_count
      FROM clubs
      LEFT JOIN (
        SELECT
          club_id,
          ROUND(AVG(rating), 1) AS average_rating,
          COUNT(*) AS review_count
        FROM reviews
        GROUP BY club_id
      ) AS review_stats
      ON review_stats.club_id = clubs.id
      ${whereClause}
      ORDER BY clubs.name
    `,
    params
  );
}

function getFeaturedClubs(limit = 6) {
  return all(
    `
      SELECT
        clubs.*,
        COALESCE(review_stats.average_rating, 0) AS average_rating,
        COALESCE(review_stats.review_count, 0) AS review_count
      FROM clubs
      LEFT JOIN (
        SELECT
          club_id,
          ROUND(AVG(rating), 1) AS average_rating,
          COUNT(*) AS review_count
        FROM reviews
        GROUP BY club_id
      ) AS review_stats
      ON review_stats.club_id = clubs.id
      ORDER BY clubs.created_at DESC, clubs.name
      LIMIT ?
    `,
    [limit]
  );
}

function getFavouriteIds(userId) {
  return all("SELECT club_id FROM favourites WHERE user_id = ?", [userId]).map(
    (row) => row.club_id
  );
}

function getClubSummaryStats() {
  const clubCount = get("SELECT COUNT(*) AS count FROM clubs");
  const locationCount = get("SELECT COUNT(DISTINCT location) AS count FROM clubs");
  const categoryCount = get("SELECT COUNT(DISTINCT category) AS count FROM clubs");

  return {
    clubCount: clubCount ? clubCount.count : 0,
    locationCount: locationCount ? locationCount.count : 0,
    categoryCount: categoryCount ? categoryCount.count : 0
  };
}

function getClubById(clubId) {
  return get(
    `
      SELECT
        clubs.*,
        COALESCE(review_stats.average_rating, 0) AS average_rating,
        COALESCE(review_stats.review_count, 0) AS review_count
      FROM clubs
      LEFT JOIN (
        SELECT
          club_id,
          ROUND(AVG(rating), 1) AS average_rating,
          COUNT(*) AS review_count
        FROM reviews
        GROUP BY club_id
      ) AS review_stats
      ON review_stats.club_id = clubs.id
      WHERE clubs.id = ?
    `,
    [clubId]
  );
}

function getReviewsForClub(clubId) {
  return all(
    `
      SELECT
        reviews.*,
        users.name AS reviewer_name
      FROM reviews
      INNER JOIN users ON users.id = reviews.user_id
      WHERE reviews.club_id = ?
      ORDER BY reviews.updated_at DESC
    `,
    [clubId]
  );
}

function getAdminDashboardData() {
  return {
    clubs: all("SELECT * FROM clubs ORDER BY name"),
    contactRequests: all(
      `
        SELECT
          contact_requests.*,
          users.name AS requester_name,
          users.email AS requester_email,
          clubs.name AS club_name
        FROM contact_requests
        INNER JOIN users ON users.id = contact_requests.user_id
        INNER JOIN clubs ON clubs.id = contact_requests.club_id
        ORDER BY contact_requests.created_at DESC
      `
    ),
    totals: {
      clubCount: get("SELECT COUNT(*) AS count FROM clubs").count,
      contactCount: get("SELECT COUNT(*) AS count FROM contact_requests").count,
      userCount: get("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").count
    }
  };
}

function emptyClubForm() {
  return {
    name: "",
    activity_type: "",
    category: "",
    location: "",
    age_group: "",
    cost_type: "",
    setting_type: "",
    meeting_frequency: "",
    description: "",
    address: "",
    meeting_time: "",
    contact_email: "",
    image_url: "/images/community.svg"
  };
}

function normalizeClubForm(input) {
  return {
    name: sanitize(input.name),
    activity_type: sanitize(input.activity_type),
    category: sanitize(input.category),
    location: sanitize(input.location),
    age_group: sanitize(input.age_group),
    cost_type: sanitize(input.cost_type),
    setting_type: sanitize(input.setting_type),
    meeting_frequency: sanitize(input.meeting_frequency),
    description: sanitize(input.description),
    address: sanitize(input.address),
    meeting_time: sanitize(input.meeting_time),
    contact_email: sanitize(input.contact_email),
    image_url: sanitize(input.image_url) || "/images/community.svg"
  };
}

function validateClubForm(values) {
  const errors = [];

  if (!values.name) errors.push("Club name is required.");
  if (!values.activity_type) errors.push("Activity type is required.");
  if (!values.category) errors.push("Category is required.");
  if (!values.location) errors.push("Location is required.");
  if (!values.age_group) errors.push("Age group is required.");
  if (!values.cost_type) errors.push("Choose whether the club is free or paid.");
  if (!values.setting_type) errors.push("Choose whether the club is indoor, outdoor, or hybrid.");
  if (!values.meeting_frequency) errors.push("Meeting frequency is required.");
  if (!values.description) errors.push("Description is required.");
  if (!values.address) errors.push("Address is required.");
  if (!values.meeting_time) errors.push("Meeting time is required.");
  if (!values.contact_email) errors.push("Contact email is required.");

  return errors;
}

function renderAdminDashboard(res, options = {}) {
  const dashboardData = getAdminDashboardData();

  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    clubs: dashboardData.clubs,
    contactRequests: dashboardData.contactRequests,
    totals: dashboardData.totals,
    clubFieldOptions: CLUB_FIELD_OPTIONS,
    formValues: options.formValues || emptyClubForm(),
    formErrors: options.formErrors || []
  });
}

app.get("/", (req, res) => {
  const filters = collectSearchFilters({});
  const featuredClubs = getFeaturedClubs(6);
  const filterOptions = getFilterOptions();
  const stats = getClubSummaryStats();
  const favouriteClubs = req.currentUser
    ? all(
        `
          SELECT clubs.*
          FROM favourites
          INNER JOIN clubs ON clubs.id = favourites.club_id
          WHERE favourites.user_id = ?
          ORDER BY favourites.created_at DESC
        `,
        [req.currentUser.id]
      )
    : [];

  res.render("home", {
    title: "Home",
    filters,
    filterOptions,
    featuredClubs,
    favouriteClubs,
    stats
  });
});

app.get("/clubs", (req, res) => {
  const filters = collectSearchFilters(req.query);
  const clubs = buildClubSearch(filters);
  const favouriteIds = req.currentUser ? getFavouriteIds(req.currentUser.id) : [];

  res.render("clubs/index", {
    title: "Browse Clubs",
    clubs,
    filters,
    filterOptions: getFilterOptions(),
    favouriteIds
  });
});

app.get("/clubs/:id", (req, res) => {
  const clubId = parseId(req.params.id);

  if (!clubId) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  const club = getClubById(clubId);

  if (!club) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  const reviews = getReviewsForClub(clubId);
  const isFavourite = req.currentUser
    ? Boolean(
        get("SELECT id FROM favourites WHERE user_id = ? AND club_id = ?", [
          req.currentUser.id,
          clubId
        ])
      )
    : false;
  const existingReview = req.currentUser
    ? get("SELECT * FROM reviews WHERE user_id = ? AND club_id = ?", [
        req.currentUser.id,
        clubId
      ])
    : null;

  res.render("clubs/show", {
    title: club.name,
    club,
    reviews,
    isFavourite,
    existingReview,
    backLink: req.get("Referer") || "/clubs"
  });
});

app.get("/auth", (req, res) => {
  if (req.currentUser) {
    return res.redirect("/");
  }

  res.render("auth", {
    title: "Login / Register"
  });
});

app.post("/register", (req, res) => {
  const name = sanitize(req.body.name);
  const email = sanitize(req.body.email).toLowerCase();
  const password = sanitize(req.body.password);

  if (!name || !email || !password) {
    setFlash(req, "error", "Name, email, and password are required.");
    return res.redirect("/auth");
  }

  if (password.length < 6) {
    setFlash(req, "error", "Use a password with at least 6 characters.");
    return res.redirect("/auth");
  }

  const existingUser = get("SELECT id FROM users WHERE email = ?", [email]);

  if (existingUser) {
    setFlash(req, "error", "That email address is already registered.");
    return res.redirect("/auth");
  }

  const result = run(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'user')
    `,
    [name, email, hashPassword(password)]
  );

  req.session.userId = Number(result.lastInsertRowid);
  setFlash(req, "success", "Your account has been created.");
  return res.redirect(getPostLoginRedirect(req));
});

app.post("/login", (req, res) => {
  const email = sanitize(req.body.email).toLowerCase();
  const password = sanitize(req.body.password);

  const user = get("SELECT * FROM users WHERE email = ?", [email]);

  if (!user || !verifyPassword(password, user.password_hash)) {
    setFlash(req, "error", "Invalid email or password.");
    return res.redirect("/auth");
  }

  req.session.userId = user.id;
  setFlash(req, "success", `Welcome back, ${user.name}.`);
  return res.redirect(getPostLoginRedirect(req));
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/clubs/:id/favourite", requireUser, (req, res) => {
  const clubId = parseId(req.params.id);

  if (!clubId || !get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  run(
    `
      INSERT INTO favourites (user_id, club_id)
      VALUES (?, ?)
      ON CONFLICT(user_id, club_id) DO NOTHING
    `,
    [req.currentUser.id, clubId]
  );

  setFlash(req, "success", "Club saved to your favourites.");
  res.redirect(req.get("Referer") || `/clubs/${clubId}`);
});

app.post("/clubs/:id/unfavourite", requireUser, (req, res) => {
  const clubId = parseId(req.params.id);

  if (!clubId || !get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  run("DELETE FROM favourites WHERE user_id = ? AND club_id = ?", [
    req.currentUser.id,
    clubId
  ]);

  setFlash(req, "success", "Club removed from your favourites.");
  res.redirect(req.get("Referer") || `/clubs/${clubId}`);
});

app.post("/clubs/:id/contact", requireUser, (req, res) => {
  const clubId = parseId(req.params.id);
  const message = sanitize(req.body.message);

  if (!clubId || !get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  if (!message) {
    setFlash(req, "error", "Please enter a message before sending your interest request.");
    return res.redirect(`/clubs/${clubId}`);
  }

  run(
    `
      INSERT INTO contact_requests (user_id, club_id, message)
      VALUES (?, ?, ?)
    `,
    [req.currentUser.id, clubId, message]
  );

  setFlash(req, "success", "Your interest request has been sent to the club.");
  res.redirect(`/clubs/${clubId}`);
});

app.post("/clubs/:id/reviews", requireUser, (req, res) => {
  const clubId = parseId(req.params.id);
  const rating = Number(req.body.rating);
  const comment = sanitize(req.body.comment);

  if (!clubId || !get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
    setFlash(req, "error", "Please provide a rating from 1 to 5 and a comment.");
    return res.redirect(`/clubs/${clubId}`);
  }

  run(
    `
      INSERT INTO reviews (user_id, club_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, club_id)
      DO UPDATE SET
        rating = excluded.rating,
        comment = excluded.comment,
        updated_at = CURRENT_TIMESTAMP
    `,
    [req.currentUser.id, clubId, rating, comment]
  );

  setFlash(req, "success", "Your review has been saved.");
  res.redirect(`/clubs/${clubId}`);
});

app.get("/admin", requireAdmin, (req, res) => {
  renderAdminDashboard(res);
});

app.post("/admin/clubs", requireAdmin, (req, res) => {
  const formValues = normalizeClubForm(req.body);
  const formErrors = validateClubForm(formValues);

  if (formErrors.length) {
    return renderAdminDashboard(res, { formValues, formErrors });
  }

  run(
    `
      INSERT INTO clubs (
        name,
        activity_type,
        category,
        location,
        age_group,
        cost_type,
        setting_type,
        meeting_frequency,
        description,
        address,
        meeting_time,
        contact_email,
        image_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      formValues.name,
      formValues.activity_type,
      formValues.category,
      formValues.location,
      formValues.age_group,
      formValues.cost_type,
      formValues.setting_type,
      formValues.meeting_frequency,
      formValues.description,
      formValues.address,
      formValues.meeting_time,
      formValues.contact_email,
      formValues.image_url
    ]
  );

  setFlash(req, "success", "Club created successfully.");
  res.redirect("/admin");
});

app.get("/admin/clubs/:id/edit", requireAdmin, (req, res) => {
  const clubId = parseId(req.params.id);

  if (!clubId) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  const club = get("SELECT * FROM clubs WHERE id = ?", [clubId]);

  if (!club) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  res.render("admin/edit", {
    title: `Edit ${club.name}`,
    club,
    clubFieldOptions: CLUB_FIELD_OPTIONS,
    formErrors: []
  });
});

app.post("/admin/clubs/:id", requireAdmin, (req, res) => {
  const clubId = parseId(req.params.id);
  const formValues = normalizeClubForm(req.body);
  const formErrors = validateClubForm(formValues);

  if (!clubId) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  if (!get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  if (formErrors.length) {
    return res.status(400).render("admin/edit", {
      title: `Edit ${formValues.name || "Club"}`,
      club: { id: clubId, ...formValues },
      clubFieldOptions: CLUB_FIELD_OPTIONS,
      formErrors
    });
  }

  run(
    `
      UPDATE clubs
      SET
        name = ?,
        activity_type = ?,
        category = ?,
        location = ?,
        age_group = ?,
        cost_type = ?,
        setting_type = ?,
        meeting_frequency = ?,
        description = ?,
        address = ?,
        meeting_time = ?,
        contact_email = ?,
        image_url = ?
      WHERE id = ?
    `,
    [
      formValues.name,
      formValues.activity_type,
      formValues.category,
      formValues.location,
      formValues.age_group,
      formValues.cost_type,
      formValues.setting_type,
      formValues.meeting_frequency,
      formValues.description,
      formValues.address,
      formValues.meeting_time,
      formValues.contact_email,
      formValues.image_url,
      clubId
    ]
  );

  setFlash(req, "success", "Club updated successfully.");
  res.redirect("/admin");
});

app.post("/admin/clubs/:id/delete", requireAdmin, (req, res) => {
  const clubId = parseId(req.params.id);

  if (!clubId || !get("SELECT id FROM clubs WHERE id = ?", [clubId])) {
    return renderError(res, 404, "Club Not Found", "That club could not be found.");
  }

  run("DELETE FROM clubs WHERE id = ?", [clubId]);
  setFlash(req, "success", "Club deleted successfully.");
  res.redirect("/admin");
});

app.use((req, res) => {
  renderError(res, 404, "Page Not Found", "The page you requested does not exist.");
});

app.use((error, req, res, next) => {
  console.error(error);
  renderError(res, 500, "Server Error", "Something went wrong while processing your request.");
});

app.listen(PORT, () => {
  console.log(`Local Social Clubs Finder running at http://localhost:${PORT}`);
});
