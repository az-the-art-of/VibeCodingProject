const { createApp } = require("./app");
const logger = require("./src/logger");

const { app, close, config } = createApp();

const server = app.listen(config.port, () => {
  logger.info("server.started", {
    nodeEnv: config.nodeEnv,
    port: config.port
  });
});

function shutdown(signal) {
  logger.info("server.stopping", { signal });
  server.close(() => {
    close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
