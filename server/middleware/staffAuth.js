
const jwt = require("jsonwebtoken");
const pool = require("../db");

async function authenticateStaff(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message: "Authorization token required.",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authorization token required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Authentication configuration error.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded.accountType !== "staff") {
      return res.status(403).json({
        message: "Staff access required.",
      });
    }

    const staffId = Number(decoded.staffId);
    const organizationId = Number(
      decoded.organizationId
    );

    if (
      !Number.isSafeInteger(staffId) ||
      staffId <= 0 ||
      !Number.isSafeInteger(organizationId) ||
      organizationId <= 0
    ) {
      return res.status(401).json({
        message: "Invalid staff authentication token.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        staff_id,
        organization_id,
        full_name,
        email,
        role,
        duty,
        status,
        is_active
      FROM staff
      WHERE id = $1
        AND organization_id = $2
      LIMIT 1
      `,
      [staffId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message:
          "Staff account not found or session is no longer valid.",
      });
    }

    const staff = result.rows[0];

    if (
      staff.status !== "active" ||
      staff.is_active !== true
    ) {
      return res.status(403).json({
        message:
          "Your staff account is inactive. Contact your organization administrator.",
      });
    }

    req.staff = {
      id: staff.id,
      staffId: staff.staff_id,
      organizationId: staff.organization_id,
      organizationPublicId:
        decoded.organizationPublicId,
      email: staff.email,
      fullName: staff.full_name,
      role: staff.role,
      duty: staff.duty,
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Staff session has expired.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid staff authentication token.",
      });
    }

    console.error(
      "Staff authentication error:",
      error
    );

    return res.status(500).json({
      message: "Unable to verify staff authentication.",
    });
  }
}

module.exports = authenticateStaff;