const express = require("express");
const pool = require("../db");
const authenticateToken = require("../authMiddleware");

const router = express.Router();

router.use(authenticateToken);

/* =========================================================
   ORGANIZATION AUTHORIZATION
========================================================= */

function getOrganizationId(req) {
  const id =
    req.organization?.id ??
    req.organization?.organizationId;

  const numericId = Number(id);

  return Number.isInteger(numericId) && numericId > 0
    ? numericId
    : null;
}

function authorized(req, organizationId) {
  const authenticatedId = getOrganizationId(req);

  return (
    authenticatedId !== null &&
    authenticatedId === Number(organizationId)
  );
}

function validId(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

/* =========================================================
   GET DEPARTMENTS
========================================================= */

router.get("/:organizationId/departments", async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!authorized(req, organizationId)) {
      return res.status(403).json({
        message: "Not authorized to access these departments.",
      });
    }

    const result = await pool.query(
      `SELECT id, organization_id, name, created_at, updated_at
       FROM departments
       WHERE organization_id = $1
       ORDER BY name ASC`,
      [organizationId]
    );

    return res.json({ departments: result.rows });
  } catch (error) {
    console.error("GET departments:", error);

    return res.status(500).json({
      message: "Failed to load departments.",
    });
  }
});

/* =========================================================
   CREATE DEPARTMENT
========================================================= */

router.post("/:organizationId/departments", async (req, res) => {
  try {
    const { organizationId } = req.params;
    const name = String(req.body.name || "").trim();

    if (!authorized(req, organizationId)) {
      return res.status(403).json({
        message: "Not authorized to create departments.",
      });
    }

    if (!name || name.length > 150) {
      return res.status(400).json({
        message: "Enter a department name of 1–150 characters.",
      });
    }

    const result = await pool.query(
      `INSERT INTO departments (organization_id, name)
       VALUES ($1, $2)
       RETURNING id, organization_id, name, created_at, updated_at`,
      [organizationId, name]
    );

    return res.status(201).json({
      message: "Department created successfully.",
      department: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This department already exists.",
      });
    }

    console.error("CREATE department:", error);

    return res.status(500).json({
      message: "Failed to create department.",
    });
  }
});

/* =========================================================
   UPDATE DEPARTMENT
========================================================= */

router.put(
  "/:organizationId/departments/:departmentId",
  async (req, res) => {
    try {
      const { organizationId, departmentId } = req.params;
      const name = String(req.body.name || "").trim();

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to update this department.",
        });
      }

      if (!validId(departmentId) || !name || name.length > 150) {
        return res.status(400).json({
          message: "Provide a valid department ID and name.",
        });
      }

      const result = await pool.query(
        `UPDATE departments
         SET name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND organization_id = $3
         RETURNING id, organization_id, name, created_at, updated_at`,
        [name, departmentId, organizationId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Department not found.",
        });
      }

      return res.json({
        message: "Department updated successfully.",
        department: result.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          message: "A department with this name already exists.",
        });
      }

      console.error("UPDATE department:", error);

      return res.status(500).json({
        message: "Failed to update department.",
      });
    }
  }
);

/* =========================================================
   DELETE DEPARTMENT
========================================================= */

router.delete(
  "/:organizationId/departments/:departmentId",
  async (req, res) => {
    try {
      const { organizationId, departmentId } = req.params;

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to delete this department.",
        });
      }

      if (!validId(departmentId)) {
        return res.status(400).json({
          message: "Invalid department ID.",
        });
      }

      const usage = await pool.query(
        `SELECT
           EXISTS (
             SELECT 1 FROM reports
             WHERE organization_id = $1 AND department_id = $2
           ) AS has_cases,
           EXISTS (
             SELECT 1 FROM staff
             WHERE organization_id = $1 AND department_id = $2
           ) AS has_staff`,
        [organizationId, departmentId]
      );

      if (usage.rows[0].has_cases || usage.rows[0].has_staff) {
        return res.status(409).json({
          message:
            "This department still has cases or staff assigned. Reassign them first.",
        });
      }

      const result = await pool.query(
        `DELETE FROM departments
         WHERE id = $1 AND organization_id = $2
         RETURNING id, name`,
        [departmentId, organizationId]
      );

      if (!result.rowCount) {
        return res.status(404).json({
          message: "Department not found.",
        });
      }

      return res.json({
        message: "Department deleted successfully.",
        department: result.rows[0],
      });
    } catch (error) {
      console.error("DELETE department:", error);

      return res.status(500).json({
        message: "Failed to delete department.",
      });
    }
  }
);

/* =========================================================
   GET CASE DETAILS INCLUDING EVIDENCE
========================================================= */

router.get("/:organizationId/cases/:caseId", async (req, res) => {
  try {
    const { organizationId, caseId } = req.params;

    if (!authorized(req, organizationId)) {
      return res.status(403).json({
        message: "Not authorized to access this case.",
      });
    }

    const result = await pool.query(
      `SELECT
         r.id,
         r.case_id,
         r.organization_id,
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
         r.department_id,
         r.assigned_staff_id,
         o.name AS organization_name,
         d.name AS department_name,
         s.full_name AS assigned_staff_name
       FROM reports r
       LEFT JOIN organizations o
         ON o.id = r.organization_id
       LEFT JOIN departments d
         ON d.id = r.department_id
         AND d.organization_id = r.organization_id
       LEFT JOIN staff s
         ON s.id = r.assigned_staff_id
         AND s.organization_id = r.organization_id
       WHERE r.case_id = $1
         AND r.organization_id = $2
       LIMIT 1`,
      [caseId, organizationId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Case not found for this organization.",
      });
    }

    const report = result.rows[0];

    // Evidence is only returned to the organization that owns this case.
    const evidenceResult = await pool.query(
      `SELECT
         id,
         evidence_id,
         file_name,
         file_type,
         file_size,
         data_url,
         uploaded_at
       FROM report_evidence
       WHERE report_id = $1
       ORDER BY uploaded_at ASC`,
      [report.id]
    );

    return res.json({
      case: {
        ...report,
        evidence: evidenceResult.rows,
      },
    });
  } catch (error) {
    console.error("GET case details:", error);

    return res.status(500).json({
      message: "Failed to load case details.",
    });
  }
});

/* =========================================================
   UPDATE CASE STATUS
   PUT /:organizationId/cases/:caseId/status
========================================================= */

router.put(
  "/:organizationId/cases/:caseId/status",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { organizationId, caseId } = req.params;
      const status = String(req.body.status || "").trim();

      const allowedStatuses = [
        "Received",
        "In Progress",
        "Resolved",
        "Closed",
      ];

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to update this case.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid case status.",
          allowedStatuses,
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const current = await client.query(
        `SELECT id, case_id, status
         FROM reports
         WHERE case_id = $1 AND organization_id = $2
         FOR UPDATE`,
        [caseId, organizationId]
      );

      if (!current.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message: "Case not found for this organization.",
        });
      }

      const report = current.rows[0];

      const updated = await client.query(
        `UPDATE reports
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND organization_id = $3
         RETURNING id, case_id, status, priority, updated_at`,
        [status, report.id, organizationId]
      );

      if (report.status !== status) {
        await client.query(
          `INSERT INTO case_activity
             (report_id, activity_type, message, old_value, new_value, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            report.id,
            "Status Update",
            `Case status changed from ${report.status} to ${status}.`,
            report.status || "",
            status,
          ]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        message: "Case status updated successfully.",
        case: updated.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Status rollback error:", rollbackError);
        }
      }

      console.error("UPDATE case status:", error);

      return res.status(500).json({
        message: "Failed to update case status.",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   UPDATE CASE PRIORITY
   PUT /:organizationId/cases/:caseId/priority
========================================================= */

router.put(
  "/:organizationId/cases/:caseId/priority",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { organizationId, caseId } = req.params;
      const priority = String(req.body.priority || "").trim();

      const allowedPriorities = [
        "Low",
        "Medium",
        "High",
        "Critical",
      ];

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to update this case.",
        });
      }

      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          message: "Invalid case priority.",
          allowedPriorities,
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const current = await client.query(
        `SELECT id, case_id, priority
         FROM reports
         WHERE case_id = $1 AND organization_id = $2
         FOR UPDATE`,
        [caseId, organizationId]
      );

      if (!current.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message: "Case not found for this organization.",
        });
      }

      const report = current.rows[0];

      const updated = await client.query(
        `UPDATE reports
         SET priority = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND organization_id = $3
         RETURNING id, case_id, status, priority, updated_at`,
        [priority, report.id, organizationId]
      );

      if (report.priority !== priority) {
        await client.query(
          `INSERT INTO case_activity
             (report_id, activity_type, message, old_value, new_value, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            report.id,
            "Priority Update",
            `Case priority changed from ${report.priority} to ${priority}.`,
            report.priority || "",
            priority,
          ]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        message: "Case priority updated successfully.",
        case: updated.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Priority rollback error:", rollbackError);
        }
      }

      console.error("UPDATE case priority:", error);

      return res.status(500).json({
        message: "Failed to update case priority.",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   SEND ORGANIZATION RESPONSE
   PUT /:organizationId/cases/:caseId/response
========================================================= */

router.put(
  "/:organizationId/cases/:caseId/response",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { organizationId, caseId } = req.params;
      const responseText = String(req.body.response || "").trim();

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to respond to this case.",
        });
      }

      if (!responseText) {
        return res.status(400).json({
          message: "Please enter a response.",
        });
      }

      if (responseText.length > 10000) {
        return res.status(400).json({
          message: "Response cannot exceed 10,000 characters.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const current = await client.query(
        `SELECT id, case_id, organization_response
         FROM reports
         WHERE case_id = $1 AND organization_id = $2
         FOR UPDATE`,
        [caseId, organizationId]
      );

      if (!current.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message: "Case not found for this organization.",
        });
      }

      const report = current.rows[0];

      const updated = await client.query(
        `UPDATE reports
         SET
           organization_response = $1,
           response_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND organization_id = $3
         RETURNING id, case_id, organization_response, response_at, updated_at`,
        [responseText, report.id, organizationId]
      );

      await client.query(
        `INSERT INTO case_activity
           (report_id, activity_type, message, old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          report.id,
          "Organization Response",
          `The organization responded to case ${caseId}.`,
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
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Response rollback error:", rollbackError);
        }
      }

      console.error("SEND organization response:", error);

      return res.status(500).json({
        message: "Failed to send organization response.",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   ASSIGN CASE TO DEPARTMENT
   PUT /:organizationId/cases/:caseId/department
========================================================= */

router.put(
  "/:organizationId/cases/:caseId/department",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { organizationId, caseId } = req.params;
      const rawDepartmentId = req.body.departmentId;

      const departmentId =
        rawDepartmentId === null ||
        rawDepartmentId === "" ||
        rawDepartmentId === undefined
          ? null
          : Number(rawDepartmentId);

      if (!authorized(req, organizationId)) {
        return res.status(403).json({
          message: "Not authorized to assign this case.",
        });
      }

      if (
        departmentId !== null &&
        (!Number.isInteger(departmentId) || departmentId <= 0)
      ) {
        return res.status(400).json({
          message: "Invalid department ID.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const current = await client.query(
        `SELECT id, department_id
         FROM reports
         WHERE case_id = $1 AND organization_id = $2
         FOR UPDATE`,
        [caseId, organizationId]
      );

      if (!current.rowCount) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          message: "Case not found for this organization.",
        });
      }

      const report = current.rows[0];
      let departmentName = null;

      if (departmentId !== null) {
        const department = await client.query(
          `SELECT id, name
           FROM departments
           WHERE id = $1 AND organization_id = $2`,
          [departmentId, organizationId]
        );

        if (!department.rowCount) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(400).json({
            message: "The selected department does not belong to your organization.",
          });
        }

        departmentName = department.rows[0].name;
      }

      const changed =
        String(report.department_id ?? "") !==
        String(departmentId ?? "");

      const updated = await client.query(
        `UPDATE reports
         SET
           department_id = $1,
           assigned_staff_id = CASE WHEN $2 THEN NULL ELSE assigned_staff_id END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND organization_id = $4
         RETURNING id, case_id, department_id, assigned_staff_id, updated_at`,
        [departmentId, changed, report.id, organizationId]
      );

      if (changed) {
        await client.query(
          `INSERT INTO case_activity
             (report_id, activity_type, message, old_value, new_value, created_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            report.id,
            "Department Assignment",
            departmentName
              ? `Case assigned to the ${departmentName} department.`
              : "Case department assignment removed.",
            report.department_id == null ? "" : String(report.department_id),
            departmentId == null ? "" : String(departmentId),
          ]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        message: "Case department updated successfully.",
        case: updated.rows[0],
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Department rollback error:", rollbackError);
        }
      }

      console.error("ASSIGN case department:", error);

      return res.status(500).json({
        message: "Failed to assign the case to a department.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;