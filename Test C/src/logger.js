function log(level, event, details = {}) {
  const line = {
    details,
    event,
    level,
    timestamp: new Date().toISOString()
  };

  const printer = level === "error" ? console.error : console.log;
  printer(JSON.stringify(line));
}

module.exports = {
  error(event, details) {
    log("error", event, details);
  },
  info(event, details) {
    log("info", event, details);
  },
  warn(event, details) {
    log("warn", event, details);
  }
};
