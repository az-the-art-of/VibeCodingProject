const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { getConfig } = require("./src/config");
const { FILTER_OPTIONS } = require("./src/constants");
const { AppDatabase } = require("./src/database");
const logger = require("./src/logger");
const { generateCsrfToken, hashPassword, tokensMatch, verifyPassword } = require("./src/security");
const { SQLiteSessionStore } = require("./src/session-store");
const {
  parsePositiveInteger,
  validateClub,
  validateContactRequest,
  validateLogin,
  validateRegistration,
  validateReview,
  validateSearch
} = require("./src/validation");

function createEmptySearch() {
  return {
    activityType: "",
    ageGroup: "",
    category: "",
    location: "",
    meetingFrequency: "",
    name: "",
    priceType: "",
    venueType: ""
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

function createApp(overrides = {}) {
  const config = getConfig(overrides);
  const ownsDatabase = !overrides.database;
  const db = overrides.database || new AppDatabase(config.databasePath);
  const sessionStore = overrides.sessionStore || new SQLiteSessionStore({ dbPath: config.sessionDbPath });
  const app = express();

  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(config.rootDir, "views"));
  app.locals.appName = config.appName;
  app.locals.filterOptions = FILTER_OPTIONS;
  app.locals.formatDate = formatDate;

  app.use(express.urlencoded({ extended: false, limit: "25kb" }));
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    if (config.isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  });
  app.use(express.static(path.join(config.rootDir, "public")));
  app.use(
    session({
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8,
        sameSite: "lax",
        secure: config.isProduction
      },
      name: config.sessionCookieName,
      resave: false,
      saveUninitialized: false,
      secret: config.sessionSecret,
      store: sessionStore
    })
  );
  app.use((req, res, next) => {
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;
    req.flash = (type, message) => {
      req.session.flash = { message, type };
    };
    next();
  });
  app.use((req, res, next) => {
    const userId = parsePositiveInteger(req.session.userId);

    if (!userId) {
      req.currentUser = null;
      return next();
    }

    const user = db.getUserById(userId);

    if (!user) {
      req.session.userId = null;
      req.currentUser = null;
      return next();
    }

    req.currentUser = user;
    next();
  });
  app.use((req, res, next) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }

    res.locals.csrfToken = req.session.csrfToken;
    res.locals.currentUser = req.currentUser;
    res.locals.requestPath = req.path;

    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const suppliedToken = req.body ? req.body._csrf : "";

    if (!tokensMatch(suppliedToken, req.session.csrfToken)) {
      logger.warn("security.csrf_failed", {
        ip: req.ip,
        method: req.method,
        path: req.path
      });
      return res.status(403).render("error", {
        message: "The request could not be verified.",
        statusCode: 403,
        title: "Request blocked"
      });
    }

    next();
  });

  function renderNotFound(res) {
    return res.status(404).render("404", {
      title: "Not found"
    });
  }

  function requireAuth(req, res, next) {
    if (!req.currentUser) {
      logger.warn("auth.unauthenticated_access", {
        method: req.method,
        path: req.path
      });
      req.flash("error", "Please log in to continue.");
      return res.redirect("/auth");
    }

    next();
  }

  function requireAdmin(req, res, next) {
    if (!req.currentUser) {
      logger.warn("auth.unauthenticated_admin_access", {
        method: req.method,
        path: req.path
      });
      req.flash("error", "Please log in to continue.");
      return res.redirect("/auth");
    }

    if (req.currentUser.role !== "admin") {
      logger.warn("auth.admin_denied", {
        path: req.path,
        userId: req.currentUser.id
      });
      return res.status(403).render("error", {
        message: "You do not have access to that page.",
        statusCode: 403,
        title: "Access denied"
      });
    }

    next();
  }

  function renderAuthPage(res, data = {}, statusCode = 200) {
    return res.status(statusCode).render("auth", {
      loginErrors: data.loginErrors || {},
      loginValues: data.loginValues || { email: "" },
      registerErrors: data.registerErrors || {},
      registerValues: data.registerValues || { displayName: "", email: "" },
      title: "Login or register"
    });
  }

  function renderClubForm(res, data = {}, statusCode = 200) {
    return res.status(statusCode).render("admin/club-form", {
      errors: data.errors || {},
      formAction: data.formAction,
      formData: data.formData,
      heading: data.heading,
      submitLabel: data.submitLabel,
      title: data.title
    });
  }

  app.get("/", (req, res) => {
    const featuredClubs = db.listFeaturedClubs(6);
    res.render("home", {
      featuredClubs,
      search: createEmptySearch(),
      title: "Find a local social club"
    });
  });

  app.get("/clubs", (req, res) => {
    const { errors, values } = validateSearch(req.query);
    const clubs = errors.length === 0 ? db.searchClubs(values, req.currentUser ? req.currentUser.id : null) : [];

    res.status(errors.length > 0 ? 400 : 200).render("clubs/index", {
      clubs,
      errorMessage: errors[0] || null,
      resultCount: clubs.length,
      search: values,
      title: "Club search results"
    });
  });

  app.get("/clubs/:id", (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);

    if (!clubId) {
      return renderNotFound(res);
    }

    const club = db.getClubById(clubId, req.currentUser ? req.currentUser.id : null);

    if (!club) {
      return renderNotFound(res);
    }

    const reviews = db.listReviewsForClub(clubId);

    res.render("clubs/show", {
      club,
      reviews,
      title: club.name
    });
  });

  app.get("/auth", (req, res) => {
    if (req.currentUser) {
      return res.redirect(req.currentUser.role === "admin" ? "/admin" : "/dashboard");
    }

    return renderAuthPage(res);
  });

  app.post("/register", (req, res, next) => {
    const { errors, values } = validateRegistration(req.body);

    if (hasErrors(errors)) {
      return renderAuthPage(
        res,
        {
          registerErrors: errors,
          registerValues: { displayName: values.displayName, email: values.email }
        },
        400
      );
    }

    try {
      const userId = db.createUser({
        displayName: values.displayName,
        email: values.email,
        passwordHash: hashPassword(values.password),
        role: "user"
      });

      req.session.regenerate((error) => {
        if (error) {
          return next(error);
        }

        req.session.userId = userId;
        req.session.csrfToken = generateCsrfToken();
        req.session.flash = { message: "Your account has been created.", type: "success" };
        res.redirect("/dashboard");
      });
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        return renderAuthPage(
          res,
          {
            registerErrors: { email: "That email address is already registered." },
            registerValues: { displayName: values.displayName, email: values.email }
          },
          400
        );
      }

      next(error);
    }
  });

  app.post("/login", (req, res, next) => {
    const { errors, values } = validateLogin(req.body);

    if (hasErrors(errors)) {
      return renderAuthPage(
        res,
        {
          loginErrors: errors,
          loginValues: { email: values.email }
        },
        400
      );
    }

    const user = db.findUserByEmail(values.email);

    if (!user || !verifyPassword(values.password, user.password_hash)) {
      logger.warn("auth.login_failed", { email: values.email });
      return renderAuthPage(
        res,
        {
          loginErrors: { password: "Invalid email or password." },
          loginValues: { email: values.email }
        },
        401
      );
    }

    req.session.regenerate((error) => {
      if (error) {
        return next(error);
      }

      req.session.userId = user.id;
      req.session.csrfToken = generateCsrfToken();
      req.session.flash = { message: "Welcome back.", type: "success" };
      res.redirect(user.role === "admin" ? "/admin" : "/dashboard");
    });
  });

  app.post("/logout", requireAuth, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) {
        return next(error);
      }

      res.clearCookie(config.sessionCookieName);
      res.redirect("/");
    });
  });

  app.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard", {
      contactRequests: db.listDashboardContactRequests(req.currentUser.id),
      favouriteClubs: db.listDashboardFavourites(req.currentUser.id),
      reviews: db.listDashboardReviews(req.currentUser.id),
      title: "Your dashboard"
    });
  });

  app.post("/clubs/:id/favourite", requireAuth, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId, req.currentUser.id) : null;

    if (!club) {
      return renderNotFound(res);
    }

    db.addFavourite(req.currentUser.id, clubId);
    req.flash("success", `${club.name} has been saved to your favourites.`);
    res.redirect(`/clubs/${clubId}`);
  });

  app.post("/clubs/:id/unfavourite", requireAuth, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId, req.currentUser.id) : null;

    if (!club) {
      return renderNotFound(res);
    }

    db.removeFavourite(req.currentUser.id, clubId);
    req.flash("success", `${club.name} has been removed from your favourites.`);
    res.redirect(`/clubs/${clubId}`);
  });

  app.post("/clubs/:id/reviews", requireAuth, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId, req.currentUser.id) : null;

    if (!club) {
      return renderNotFound(res);
    }

    const { errors, values } = validateReview(req.body);

    if (hasErrors(errors)) {
      logger.warn("validation.review_rejected", {
        clubId,
        userId: req.currentUser.id
      });
      req.flash("error", Object.values(errors)[0]);
      return res.redirect(`/clubs/${clubId}`);
    }

    db.createReview({
      clubId,
      comment: values.comment,
      rating: values.rating,
      userId: req.currentUser.id
    });
    req.flash("success", "Your review has been posted.");
    res.redirect(`/clubs/${clubId}`);
  });

  app.post("/clubs/:id/contact", requireAuth, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId, req.currentUser.id) : null;

    if (!club) {
      return renderNotFound(res);
    }

    const { errors, values } = validateContactRequest(req.body);

    if (hasErrors(errors)) {
      logger.warn("validation.contact_request_rejected", {
        clubId,
        userId: req.currentUser.id
      });
      req.flash("error", Object.values(errors)[0]);
      return res.redirect(`/clubs/${clubId}`);
    }

    db.createContactRequest({
      clubId,
      message: values.message,
      userId: req.currentUser.id
    });
    req.flash("success", "Your message has been sent to the club inbox.");
    res.redirect(`/clubs/${clubId}`);
  });

  app.get("/admin", requireAdmin, (req, res) => {
    res.render("admin/index", {
      clubs: db.listAdminClubs(),
      contactRequests: db.listAdminContactRequests(),
      title: "Admin dashboard"
    });
  });

  app.get("/admin/clubs/new", requireAdmin, (req, res) => {
    renderClubForm(res, {
      formAction: "/admin/clubs",
      formData: {
        activityType: "",
        address: "",
        ageGroup: "",
        category: "",
        contactEmail: "",
        description: "",
        imageUrl: "/images/community-club.svg",
        location: "",
        meetingFrequency: "",
        meetingTime: "",
        name: "",
        priceType: "",
        venueType: ""
      },
      heading: "Create a new club",
      submitLabel: "Create club",
      title: "Create club"
    });
  });

  app.post("/admin/clubs", requireAdmin, (req, res) => {
    const { errors, values } = validateClub(req.body);

    if (hasErrors(errors)) {
      return renderClubForm(
        res,
        {
          errors,
          formAction: "/admin/clubs",
          formData: values,
          heading: "Create a new club",
          submitLabel: "Create club",
          title: "Create club"
        },
        400
      );
    }

    db.createClub(values);
    req.flash("success", "Club created successfully.");
    res.redirect("/admin");
  });

  app.get("/admin/clubs/:id/edit", requireAdmin, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId) : null;

    if (!club) {
      return renderNotFound(res);
    }

    renderClubForm(res, {
      formAction: `/admin/clubs/${clubId}`,
      formData: {
        activityType: club.activity_type,
        address: club.address,
        ageGroup: club.age_group,
        category: club.category,
        contactEmail: club.contact_email,
        description: club.description,
        imageUrl: club.image_url,
        location: club.location,
        meetingFrequency: club.meeting_frequency,
        meetingTime: club.meeting_time,
        name: club.name,
        priceType: club.price_type,
        venueType: club.venue_type
      },
      heading: `Edit ${club.name}`,
      submitLabel: "Save changes",
      title: `Edit ${club.name}`
    });
  });

  app.post("/admin/clubs/:id", requireAdmin, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const existingClub = clubId ? db.getClubById(clubId) : null;

    if (!existingClub) {
      return renderNotFound(res);
    }

    const { errors, values } = validateClub(req.body);

    if (hasErrors(errors)) {
      return renderClubForm(
        res,
        {
          errors,
          formAction: `/admin/clubs/${clubId}`,
          formData: values,
          heading: `Edit ${existingClub.name}`,
          submitLabel: "Save changes",
          title: `Edit ${existingClub.name}`
        },
        400
      );
    }

    db.updateClub(clubId, values);
    req.flash("success", "Club updated successfully.");
    res.redirect("/admin");
  });

  app.post("/admin/clubs/:id/delete", requireAdmin, (req, res) => {
    const clubId = parsePositiveInteger(req.params.id);
    const club = clubId ? db.getClubById(clubId) : null;

    if (!club) {
      return renderNotFound(res);
    }

    db.deleteClub(clubId);
    req.flash("success", `${club.name} was deleted.`);
    res.redirect("/admin");
  });

  app.use((req, res) => renderNotFound(res));

  app.use((error, req, res, next) => {
    logger.error("server.unexpected_error", {
      message: error.message,
      method: req.method,
      path: req.path,
      stack: error.stack
    });

    if (res.headersSent) {
      return next(error);
    }

    res.status(500).render("error", {
      message: "An unexpected error occurred. Please try again later.",
      statusCode: 500,
      title: "Something went wrong"
    });
  });

  return {
    app,
    close() {
      sessionStore.close();

      if (ownsDatabase) {
        db.close();
      }
    },
    config,
    db
  };
}

module.exports = {
  createApp
};
