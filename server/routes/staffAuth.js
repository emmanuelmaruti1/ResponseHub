
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

/*
 * =========================================================
 * STAFF LOGIN
 *
 * Security checks:
 * 1. Validate email and password.
 * 2. Find the staff account in PostgreSQL.
 * 3. Verify the password hash.
 * 4. Reject inactive staff.
 * 5. Issue a signed JWT with an eight-hour expiry.
 *
 * Existing endpoint: POST /api/staff-auth/login
 * =========================================================
 */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const cleanEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (
      !cleanEmail ||
      typeof password !== "string" ||
      password.length === 0
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error(
        "Staff login failed: JWT_SECRET is missing."
      );

      return res.status(500).json({
        message:
          "Server authentication configuration is missing.",
      });
    }

    /*
     * Find staff and their organization.
     * organization_id is the internal organizations.id
     * foreign key used by the database.
     */
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.staff_id,
        s.organization_id,
        s.full_name,
        s.email,
        s.phone,
        s.password_hash,
        s.role,
        s.duty,
        s.status,

        o.organization_id AS public_organization_id,
        o.name AS organization_name

      FROM staff s

      INNER JOIN organizations o
        ON s.organization_id = o.id

      WHERE LOWER(TRIM(s.email)) = $1

      LIMIT 1
      `,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Incorrect email or password.",
      });
    }

    const staff = result.rows[0];

    /*
     * Verify the password before returning account-status
     * information. Passwords must be stored as bcrypt hashes.
     */
    if (!staff.password_hash) {
      return res.status(401).json({
        message: "Incorrect email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      staff.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Incorrect email or password.",
      });
    }

    /*
     * Reject inactive accounts.
     * Accepts "Active", "active", and other case variations.
     */
    const normalizedStatus = String(
      staff.status || ""
    )
      .trim()
      .toLowerCase();

    if (normalizedStatus !== "active") {
      return res.status(403).json({
        message: "This staff account is not active.",
      });
    }

    /*
     * Preserve the existing token claim names because
     * the staff dashboard and authorization middleware
     * may depend on them.
     */
    const token = jwt.sign(
      {
        staffId: staff.id,
        staffPublicId: staff.staff_id,

        organizationId: staff.organization_id,
        organizationPublicId:
          staff.public_organization_id,

        fullName: staff.full_name,
        email: staff.email,

        role: staff.role,
        duty: staff.duty,

        accountType: "staff",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return res.status(200).json({
      message: "Staff login successful.",

      token,

      staff: {
        id: staff.id,
        staffId: staff.staff_id,
        fullName: staff.full_name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        duty: staff.duty,
        status: staff.status,

        organizationId:
          staff.public_organization_id,

        organizationName:
          staff.organization_name,
      },
    });
  } catch (error) {
    console.error("Staff login error:", error);

    return res.status(500).json({
      message: "Staff login failed.",
    });
  }
});

module.exports = router;
