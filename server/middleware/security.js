
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Standard security headers.
// CSP is disabled for now to avoid unexpectedly blocking frontend assets.
const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const reportSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many report submissions from this connection. Please try again later.",
  },
});

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many authentication attempts. Please wait before trying again.",
  },
});

module.exports = {
  securityHeaders,
  generalApiLimiter,
  reportSubmissionLimiter,
  authenticationLimiter,
};
