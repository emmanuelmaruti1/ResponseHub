
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const {
  authenticationLimiter,
} = require("../middleware/security");

const router = express.Router();

// =====================================================
// REGISTER ORGANIZATION
// POST /api/organizations/register
// =====================================================

router.post(
  "/register",
  authenticationLimiter,
  async (req, res) => {
    try {
      const {
        organizationId,
        name,
        email,
        phone,
        password,
      } = req.body || {};

      // Validate input types and required fields.
      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Organization name, email and password are required.",
        });
      }

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (cleanName.length > 150) {
        return res.status(400).json({
          message:
            "Organization name must not exceed 150 characters.",
        });
      }

      if (cleanEmail.length > 254) {
        return res.status(400).json({
          message: "Email address is too long.",
        });
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
      ) {
        return res.status(400).json({
          message: "Please provide a valid email address.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters long.",
        });
      }

      if (password.length > 128) {
        return res.status(400).json({
          message:
            "Password must not exceed 128 characters.",
        });
      }

      // Check for an existing email.
      const existingEmail = await pool.query(
        `
        SELECT id
        FROM organizations
        WHERE LOWER(TRIM(email)) = $1
        LIMIT 1
        `,
        [cleanEmail]
      );

      if (existingEmail.rows.length > 0) {
        return res.status(409).json({
          message:
            "An organization with this email already exists.",
        });
      }

      // Generate an organization ID if one was not supplied.
      const finalOrganizationId =
        typeof organizationId === "string" &&
        organizationId.trim()
          ? organizationId.trim()
          : `ORG-${Date.now()}-${Math.floor(
              1000 + Math.random() * 9000
            )}`;

      if (finalOrganizationId.length > 100) {
        return res.status(400).json({
          message: "Organization ID is too long.",
        });
      }

      // Check for an existing organization ID.
      const existingOrganizationId = await pool.query(
        `
        SELECT id
        FROM organizations
        WHERE organization_id = $1
        LIMIT 1
        `,
        [finalOrganizationId]
      );

      if (existingOrganizationId.rows.length > 0) {
        return res.status(409).json({
          message:
            "This organization ID already exists.",
        });
      }

      // Validate optional phone input.
      if (
        phone !== undefined &&
        phone !== null &&
        typeof phone !== "string"
      ) {
        return res.status(400).json({
          message: "Phone number must be text.",
        });
      }

      const cleanPhone =
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null;

      // Hash password before storage.
      const passwordHash = await bcrypt.hash(
        password,
        12
      );

      const result = await pool.query(
        `
        INSERT INTO organizations (
          organization_id,
          name,
          email,
          phone,
          password_hash
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          organization_id,
          name,
          email,
          phone,
          created_at
        `,
        [
          finalOrganizationId,
          cleanName,
          cleanEmail,
          cleanPhone,
          passwordHash,
        ]
      );

      return res.status(201).json({
        message:
          "Organization registered successfully.",
        organization: result.rows[0],
      });
    } 
    
    catch (error) {
  console.error("Failed to fetch organizations:", error);
  return res.status(500).json({
    message: "Failed to load organizations.",
    error: error.message,
  });
}
      // Handle concurrent duplicate registrations when the
      // database has a unique constraint on the relevant field.
      if (error.code === "23505") {
        return res.status(409).json({
          message:
            "An organization with these details already exists.",
        });
      }

      return res.status(500).json({
        message: "Failed to register organization.",
      });
    }
  }
);

// =====================================================
// LOGIN ORGANIZATION
// POST /api/organizations/login
// =====================================================

router.post(
  "/login",
  authenticationLimiter,
  async (req, res) => {
    try {
      const { email, password } = req.body || {};

      if (
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          message: "Email and password are required.",
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      if (cleanEmail.length > 254 || password.length > 128) {
        return res.status(400).json({
          message: "Invalid email or password.",
        });
      }

      // Find organization.
      const result = await pool.query(
        `
        SELECT
          id,
          organization_id,
          name,
          email,
          phone,
          password_hash,
          created_at
        FROM organizations
        WHERE LOWER(TRIM(email)) = $1
        LIMIT 1
        `,
        [cleanEmail]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      const organization = result.rows[0];

      if (!organization.password_hash) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      // Verify password.
      const passwordMatches = await bcrypt.compare(
        password,
        organization.password_hash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          message: "Invalid email or password.",
        });
      }

      // Check JWT configuration.
      if (!process.env.JWT_SECRET) {
        console.error(
          "JWT_SECRET is not configured."
        );

        return res.status(500).json({
          message:
            "Authentication configuration error.",
        });
      }

      // Preserve the existing JWT claim names.
      const token = jwt.sign(
        {
          id: organization.id,
          organizationId: organization.organization_id,
          email: organization.email,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "8h",
        }
      );

      // Never return the stored password hash.
      delete organization.password_hash;

      return res.status(200).json({
        message: "Login successful.",
        token,
        expiresIn: "8h",
        organization,
      });
    } catch (error) {
      console.error(
        "Organization login error:",
        error.message || error
      );

      return res.status(500).json({
        message: "Login failed.",
      });
    }
  }
);

// GET /api/organizations
// Public list of organizations available to citizens
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        organization_id AS "organizationId",
        name,
        email,
        phone
      FROM organizations
      ORDER BY name ASC
    `);

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Failed to fetch organizations:", error.message);

    return res.status(500).json({
      message: "Failed to load organizations.",
    });
  }
});

module.exports = router;
