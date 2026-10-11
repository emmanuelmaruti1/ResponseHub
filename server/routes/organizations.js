const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const pool = require("../db");

// =====================================================
// REGISTER ORGANIZATION
// POST /api/organizations/register
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const {
      organizationId,
      name,
      email,
      phone,
      password,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Organization name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long.",
      });
    }

    // -------------------------------------------------
    // CHECK EMAIL
    // -------------------------------------------------

    const existingEmail = await pool.query(
      `
      SELECT id
      FROM organizations
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        message:
          "An organization with this email already exists.",
      });
    }

    // -------------------------------------------------
    // GENERATE ORGANIZATION ID
    // -------------------------------------------------

    const finalOrganizationId =
      organizationId ||
      `ORG-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    // -------------------------------------------------
    // CHECK ORGANIZATION ID
    // -------------------------------------------------

    const existingOrganizationId =
      await pool.query(
        `
        SELECT id
        FROM organizations
        WHERE organization_id = $1
        `,
        [finalOrganizationId]
      );

    if (existingOrganizationId.rows.length > 0) {
      return res.status(409).json({
        message:
          "This organization ID already exists.",
      });
    }

    // -------------------------------------------------
    // HASH PASSWORD
    // -------------------------------------------------

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // -------------------------------------------------
    // CREATE ORGANIZATION
    // -------------------------------------------------

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
        name,
        email,
        phone || null,
        passwordHash,
      ]
    );

    res.status(201).json({
      message:
        "Organization registered successfully.",
      organization: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Organization registration error:",
      error.message
    );

    res.status(500).json({
      message:
        "Failed to register organization.",
    });
  }
});

// =====================================================
// LOGIN ORGANIZATION
// POST /api/organizations/login
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required.",
      });
    }

    // -------------------------------------------------
    // FIND ORGANIZATION
    // -------------------------------------------------

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
      WHERE LOWER(email) = LOWER($1)
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message:
          "Invalid email or password.",
      });
    }

    const organization = result.rows[0];

    // -------------------------------------------------
    // CHECK PASSWORD
    // -------------------------------------------------

    const passwordMatches =
      await bcrypt.compare(
        password,
        organization.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email or password.",
      });
    }

    // -------------------------------------------------
    // CHECK JWT SECRET
    // -------------------------------------------------

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured."
      );

      return res.status(500).json({
        message:
          "Authentication configuration error.",
      });
    }

    // -------------------------------------------------
    // CREATE JWT
    // -------------------------------------------------

    const token = jwt.sign(
      {
        id: organization.id,
        organizationId:
          organization.organization_id,
        email: organization.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    // -------------------------------------------------
    // REMOVE PASSWORD HASH
    // -------------------------------------------------

    delete organization.password_hash;

    // -------------------------------------------------
    // SEND RESPONSE
    // -------------------------------------------------

    res.json({
      message: "Login successful.",
      token,
      expiresIn: "8h",
      organization,
    });
  } catch (error) {
    console.error(
      "Organization login error:",
      error.message
    );

    res.status(500).json({
      message: "Login failed.",
    });
  }
});

module.exports = router;