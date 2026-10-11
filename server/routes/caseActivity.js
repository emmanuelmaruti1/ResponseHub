
const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();
const pool = require("../db");

function getAuthenticatedOrganization(req) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7).trim();

    if (!token || !process.env.JWT_SECRET) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return null;
    }

    return {
      id: Number(decoded.id),
      organizationId: decoded.organizationId || null,
      email: decoded.email || null,
    };
  } catch {
    return null;
  }
}

// GET /api/reports/:caseId/activity
// Public callers receive only citizen-safe status and response events.
// The owning organization receives the full activity history.
router.get("/:caseId/activity", async (req, res) => {
  try {
    const caseId = String(req.params.caseId || "").trim();

    if (!caseId) {
      return res.status(400).json({
        message: "Case ID is required.",
      });
    }

    const reportResult = await pool.query(
      `SELECT id, case_id, organization_id
       FROM reports
       WHERE case_id = $1
       LIMIT 1`,
      [caseId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    const report = reportResult.rows[0];
    const organization = getAuthenticatedOrganization(req);

    if (
      organization &&
      organization.id === Number(report.organization_id)
    ) {
      const result = await pool.query(
        `SELECT
           ca.id,
           ca.report_id,
           ca.activity_type,
           ca.message,
           ca.old_value,
           ca.new_value,
           ca.created_at
         FROM case_activity ca
         WHERE ca.report_id = $1
         ORDER BY ca.created_at ASC, ca.id ASC`,
        [report.id]
      );

      return res.json({
        message: "Case activity retrieved successfully.",
        access: "organization",
        caseId: report.case_id,
        activity: result.rows,
        total: result.rows.length,
      });
    }

    // Public timeline: include common status/response event names,
    // including names containing underscores or suffixes.
    // Do not return old_value, new_value, or internal assignments.
    const publicResult = await pool.query(
      `SELECT
         ca.id,
         ca.report_id,
         ca.activity_type,
         ca.message,
         ca.created_at
       FROM case_activity ca
       WHERE ca.report_id = $1
         AND (
           LOWER(REPLACE(COALESCE(ca.activity_type, ''), '_', ' '))
             LIKE 'status%'
           OR LOWER(REPLACE(COALESCE(ca.activity_type, ''), '_', ' '))
             IN (
               'response',
               'response sent',
               'response added',
               'response updated',
               'organization response',
               'organization response sent',
               'organization response updated'
             )
         )
       ORDER BY ca.created_at ASC, ca.id ASC`,
      [report.id]
    );

    return res.json({
      message: "Case activity retrieved successfully.",
      access: "public",
      caseId: report.case_id,
      activity: publicResult.rows,
      total: publicResult.rows.length,
    });
  } catch (error) {
    console.error("Get case activity error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve case activity.",
    });
  }
});

// POST /api/reports/:caseId/activity
// Only the organization that owns the case can add activity.
router.post("/:caseId/activity", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const caseId = String(req.params.caseId || "").trim();
    const {
      activityType,
      message,
      oldValue,
      newValue,
    } = req.body || {};

    const organization = getAuthenticatedOrganization(req);

    if (!organization) {
      return res.status(401).json({
        message: "Organization authentication required.",
      });
    }

    if (
      !caseId ||
      typeof activityType !== "string" ||
      !activityType.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        message: "Case ID, activity type, and message are required.",
      });
    }

    const reportResult = await client.query(
      `SELECT id, case_id, organization_id
       FROM reports
       WHERE case_id = $1
         AND organization_id = $2
       LIMIT 1`,
      [caseId, organization.id]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        message: "Report not found for this organization.",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `INSERT INTO case_activity (
         report_id,
         activity_type,
         message,
         old_value,
         new_value
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         report_id,
         activity_type,
         message,
         old_value,
         new_value,
         created_at`,
      [
        reportResult.rows[0].id,
        activityType.trim(),
        message.trim(),
        oldValue !== undefined &&
        oldValue !== null &&
        String(oldValue).trim() !== ""
          ? String(oldValue).trim()
          : null,
        newValue !== undefined &&
        newValue !== null &&
        String(newValue).trim() !== ""
          ? String(newValue).trim()
          : null,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "Case activity added successfully.",
      activity: result.rows[0],
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Activity rollback error:",
          rollbackError.message
        );
      }
    }

    console.error("Add case activity error:", error.message);

    return res.status(500).json({
      message: "Failed to add case activity.",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
