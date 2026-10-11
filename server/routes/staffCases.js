const express = require("express");
const pool = require("../db");
const authenticateStaff = require("../middleware/staffAuth");

const router = express.Router();

router.use(authenticateStaff);

const ALLOWED_STATUSES = [
  "Received",
  "In Progress",
  "Resolved",
  "Closed",
];

function validCaseId(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 100
  );
}

// GET /api/staff/cases
// List only cases assigned to the signed-in staff member.
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        r.id,
        r.case_id,
        r.category,
        r.location,
        r.description,
        r.full_name,
        r.phone,
        r.email,
        r.anonymous,
        r.priority,
        r.status,
        r.organization_response,
        r.response_at,
        r.submitted_at,
        r.updated_at,
        r.assigned_staff_id,
        s.full_name AS assigned_staff_name,
        o.name AS organization_name
      FROM reports r
      INNER JOIN organizations o
        ON r.organization_id = o.id
      LEFT JOIN staff s
        ON r.assigned_staff_id = s.id
      WHERE r.organization_id = $1
        AND r.assigned_staff_id = $2
      ORDER BY
        CASE
          WHEN r.priority = 'Critical' THEN 1
          WHEN r.priority = 'High' THEN 2
          WHEN r.priority = 'Medium' THEN 3
          ELSE 4
        END,
        r.submitted_at DESC
      `,
      [
        req.staff.organizationId,
        req.staff.id,
      ]
    );

    return res.json({
      cases: result.rows,
    });
  } catch (error) {
    console.error("Failed to load staff cases:", error.message);

    return res.status(500).json({
      message: "Failed to load staff cases.",
    });
  }
});

// GET /api/staff/cases/:caseId
// Load case details, evidence and activity only for its assigned staff member.
router.get("/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!validCaseId(caseId)) {
      return res.status(400).json({
        message: "A valid Case ID is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        r.id,
        r.case_id,
        r.category,
        r.location,
        r.description,
        r.full_name,
        r.phone,
        r.email,
        r.anonymous,
        r.priority,
        r.status,
        r.organization_response,
        r.response_at,
        r.submitted_at,
        r.updated_at,
        r.assigned_staff_id,
        s.full_name AS assigned_staff_name,
        o.name AS organization_name
      FROM reports r
      INNER JOIN organizations o
        ON r.organization_id = o.id
      LEFT JOIN staff s
        ON r.assigned_staff_id = s.id
      WHERE r.case_id = $1
        AND r.organization_id = $2
        AND r.assigned_staff_id = $3
      LIMIT 1
      `,
      [
        caseId.trim(),
        req.staff.organizationId,
        req.staff.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Case not found or not assigned to you.",
      });
    }

    const report = result.rows[0];

    const evidenceResult = await pool.query(
      `
      SELECT
        id,
        evidence_id,
        file_name,
        file_type,
        file_size,
        data_url,
        uploaded_at
      FROM report_evidence
      WHERE report_id = $1
      ORDER BY uploaded_at ASC, id ASC
      `,
      [report.id]
    );

    const activityResult = await pool.query(
      `
      SELECT
        ca.id,
        ca.report_id,
        ca.activity_type,
        ca.message,
        ca.old_value,
        ca.new_value,
        ca.created_at
      FROM case_activity ca
      WHERE ca.report_id = $1
      ORDER BY ca.created_at ASC, ca.id ASC
      `,
      [report.id]
    );

    return res.json({
      case: {
        ...report,
        evidence: evidenceResult.rows,
        activity: activityResult.rows,
      },
    });
  } catch (error) {
    console.error("Failed to load staff case:", error.message);

    return res.status(500).json({
      message: "Failed to load case.",
    });
  }
});

// PUT /api/staff/cases/:caseId/status
// Update the status only when the case is assigned to this staff member.
router.put("/:caseId/status", async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const { caseId } = req.params;
    const { status } = req.body || {};

    if (!validCaseId(caseId)) {
      return res.status(400).json({
        message: "A valid Case ID is required.",
      });
    }

    if (
      typeof status !== "string" ||
      !ALLOWED_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid case status.",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const caseResult = await client.query(
      `
      SELECT id, case_id, status
      FROM reports
      WHERE case_id = $1
        AND organization_id = $2
        AND assigned_staff_id = $3
      FOR UPDATE
      `,
      [
        caseId.trim(),
        req.staff.organizationId,
        req.staff.id,
      ]
    );

    if (caseResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Case not found or not assigned to you.",
      });
    }

    const report = caseResult.rows[0];
    const oldStatus = report.status;

    if (oldStatus === status) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.json({
        message: "Case status is already set to this value.",
        case: {
          id: report.id,
          case_id: report.case_id,
          status: report.status,
        },
        status: report.status,
      });
    }

    const updated = await client.query(
      `
      UPDATE reports
      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, case_id, status, updated_at
      `,
      [status, report.id]
    );

    await client.query(
      `
      INSERT INTO case_activity (
        report_id,
        activity_type,
        message,
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        report.id,
        "status",
        `Status changed from ${oldStatus} to ${status}`,
        oldStatus,
        status,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      message: "Case status updated successfully.",
      case: updated.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Staff status rollback failed:",
          rollbackError.message
        );
      }
    }

    console.error("Staff status update error:", error.message);

    return res.status(500).json({
      message: "Failed to update case status.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/staff/cases/:caseId/respond
// Save a response to a case assigned to the signed-in staff member.
router.post("/:caseId/respond", async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const { caseId } = req.params;

    const responseText =
      typeof req.body?.response === "string"
        ? req.body.response.trim()
        : "";

    if (!validCaseId(caseId)) {
      return res.status(400).json({
        message: "A valid Case ID is required.",
      });
    }

    if (!responseText || responseText.length > 5000) {
      return res.status(400).json({
        message:
          "A response is required and must not exceed 5000 characters.",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const caseResult = await client.query(
      `
      SELECT id, case_id, organization_response
      FROM reports
      WHERE case_id = $1
        AND organization_id = $2
        AND assigned_staff_id = $3
      FOR UPDATE
      `,
      [
        caseId.trim(),
        req.staff.organizationId,
        req.staff.id,
      ]
    );

    if (caseResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Case not found or not assigned to you.",
      });
    }

    const report = caseResult.rows[0];

    const updated = await client.query(
      `
      UPDATE reports
      SET
        organization_response = $1,
        response_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        case_id,
        organization_response,
        response_at,
        updated_at
      `,
      [responseText, report.id]
    );

    await client.query(
      `
      INSERT INTO case_activity (
        report_id,
        activity_type,
        message,
        old_value,
        new_value
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        report.id,
        "response",
        `${req.staff.fullName || "Staff"} responded to the case`,
        report.organization_response || "",
        responseText,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      message: "Response sent successfully.",
      case: updated.rows[0],
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Staff response rollback failed:",
          rollbackError.message
        );
      }
    }

    console.error("Staff response error:", error.message);

    return res.status(500).json({
      message: "Failed to send response.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/staff/cases/:caseId/activity
router.get("/:caseId/activity", async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!validCaseId(caseId)) {
      return res.status(400).json({
        message: "A valid Case ID is required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        ca.id,
        ca.report_id,
        ca.activity_type,
        ca.message,
        ca.old_value,
        ca.new_value,
        ca.created_at
      FROM case_activity ca
      INNER JOIN reports r
        ON ca.report_id = r.id
      WHERE r.case_id = $1
        AND r.organization_id = $2
        AND r.assigned_staff_id = $3
      ORDER BY ca.created_at ASC, ca.id ASC
      `,
      [
        caseId.trim(),
        req.staff.organizationId,
        req.staff.id,
      ]
    );

    return res.json({
      activity: result.rows,
    });
  } catch (error) {
    console.error(
      "Failed to load staff case activity:",
      error.message
    );

    return res.status(500).json({
      message: "Failed to load case activity.",
    });
  }
});

module.exports = router;