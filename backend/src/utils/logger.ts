/** Structured JSON logger for Cloud Run / Cloud Logging */
export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({ severity: "INFO", message, ...data }));
  },
  warn(message: string, data?: Record<string, unknown>) {
    console.log(JSON.stringify({ severity: "WARNING", message, ...data }));
  },
  error(message: string, data?: Record<string, unknown>) {
    console.error(JSON.stringify({ severity: "ERROR", message, ...data }));
  },
};
