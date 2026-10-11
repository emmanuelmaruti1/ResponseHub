const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

// ===============================
// ROUTES
// ===============================

const reportsRouter = require("./routes/reports");
const organizationsRouter = require("./routes/organizations");
const organizationReportsRouter = require("./routes/organizationReports");
const organizationCasesRouter = require("./routes/organizationCases");
const caseActivityRouter = require("./routes/caseActivity");
const staffRouter = require("./routes/staff");
const staffAuthRouter = require("./routes/staffAuth");
const staffCasesRouter = require("./routes/staffCases");
const departmentRouter = require("./departmentRouter");

// ===============================
// APP CONFIGURATION
// ===============================

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// ===============================
// CORS CONFIGURATION
// ===============================

// Add deployed frontend URLs to FRONTEND_URL or CORS_ORIGINS.
// Multiple URLs in CORS_ORIGINS must be comma-separated.

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  ...(process.env.CORS_ORIGINS || "").split(","),
]
  .filter((origin) => typeof origin === "string")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const developmentOrigins = isProduction
  ? []
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ];

const allowedOrigins = new Set([
  ...configuredOrigins,
  ...developmentOrigins,
]);

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header include server-to-server
      // requests and tools such as local command-line clients.
      if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// ===============================
// REQUEST BODY LIMIT
// ===============================

app.use(
  express.json({
    limit: "10mb",
  })
);

// ===============================
// ROOT HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.json({
    message: "ResponseHub backend is running successfully 🚀",
  });
});

// ===============================
// DATABASE HEALTH CHECK
// Disabled in production unless explicitly enabled.
// Set ENABLE_DB_TEST=true only if you need this endpoint.
// ===============================

if (!isProduction || process.env.ENABLE_DB_TEST === "true") {
  app.get("/api/db-test", async (req, res) => {
    try {
      const result = await pool.query("SELECT NOW()");

      return res.json({
        message: "ResponseHub database connected successfully 🚀",
        databaseTime: result.rows[0].now,
      });
    } catch (error) {
      console.error("Database connection error:", error.message);

      return res.status(500).json({
        message: "Database connection failed.",
      });
    }
  });
}

// ===============================
// REPORT ROUTES
// ===============================

app.use("/api/reports", reportsRouter);
app.use("/api/reports", caseActivityRouter);

// ===============================
// ORGANIZATION ROUTES
// ===============================

app.use("/api/organizations", organizationsRouter);
app.use("/api/organizations", organizationReportsRouter);
app.use("/api/organizations", organizationCasesRouter);

// ===============================
// ORGANIZATION STAFF ROUTES
// ===============================

app.use("/api/organizations/staff", staffRouter);

// ===============================
// STAFF CASE ROUTES
// ===============================

app.use("/api/staff/cases", staffCasesRouter);

// ===============================
// STAFF AUTH ROUTES
// ===============================

app.use("/api/staff", staffAuthRouter);

// ===============================
// DEPARTMENT ROUTES
// ===============================

app.use("/api/organizations/departments", departmentRouter);

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  return res.status(404).json({
    message: "API endpoint not found.",
    path: req.originalUrl,
  });
});

// ===============================
// CENTRAL ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  // Malformed JSON submitted to express.json()
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    Object.prototype.hasOwnProperty.call(error, "body")
  ) {
    return res.status(400).json({
      message: "Invalid JSON request body.",
    });
  }

  // Request body exceeds the configured JSON limit
  if (error.type === "entity.too.large" || error.status === 413) {
    return res.status(413).json({
      message: "Request body is too large.",
    });
  }

  // Rejected browser origin
  if (error.message === "Origin not allowed by CORS.") {
    return res.status(403).json({
      message: "This origin is not allowed to access the API.",
    });
  }

  console.error("Server error:", error.message || error);

  return res.status(500).json({
    message: "Internal server error.",
  });
});

// ===============================
// EXPORT APP FOR TESTS
// ===============================

module.exports = app;

// ===============================
// START SERVER ONLY WHEN RUN DIRECTLY
// ===============================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ResponseHub server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}