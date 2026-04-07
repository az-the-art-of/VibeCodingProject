function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = {
      type: "error",
      message: "Please log in to continue."
    };
    return res.redirect("/auth");
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    req.session.flash = {
      type: "error",
      message: "Please log in to continue."
    };
    return res.redirect("/auth");
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      title: "Access denied",
      message: "You do not have permission to view this page."
    });
  }

  return next();
}

module.exports = { requireAuth, requireAdmin };
