import express from "express";
import { logger } from "./utils/logger";
import { schedulerAuth } from "./middleware/schedulerAuth";

import authRouter from "./routes/auth";
import lineRouter from "./routes/line";
import filtersRouter from "./routes/filters";
import pollRouter from "./jobs/poll";

const app = express();

// Body parser — raw body needed for LINE signature verification in production
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "subscrip-notify" });
});

// Routes
app.use("/auth", authRouter);
app.use("/line", lineRouter);
app.use("/filters", filtersRouter);
app.use("/jobs", schedulerAuth, pollRouter);

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error("Unhandled error", {
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Internal server error" });
  }
);

const PORT = parseInt(process.env.PORT ?? "8080", 10);
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});

export default app;
