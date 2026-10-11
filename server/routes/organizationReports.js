const express = require("express");
const pool = require("../db");
const authenticateToken = require("../authMiddleware");

const router = express.Router();


/*
|--------------------------------------------------------------------------
| GET ORGANIZATION REPORTS
|--------------------------------------------------------------------------
| GET /api/organizations/:organizationId/reports
|--------------------------------------------------------------------------
*/

router.get(
  "/:organizationId/reports",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        organizationId,
      } = req.params;

      if (
        !organizationId ||
        isNaN(Number(organizationId))
      ) {
        return res.status(400).json({
          message:
            "A valid organization ID is required.",
        });
      }

      const requestedOrganizationId =
        Number(organizationId);

      /*
      |--------------------------------------------------------------------------
      | SECURITY CHECK
      |--------------------------------------------------------------------------
      */

      if (
        Number(req.organization.id) !==
        requestedOrganizationId
      ) {
        return res.status(403).json({
          message:
            "You are not authorized to view these reports.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | GET REPORTS
      |--------------------------------------------------------------------------
      */

      const result = await pool.query(
        `
        SELECT
          r.id,
          r.case_id,
          r.organization_id,

          o.organization_id AS organization_code,
          o.name AS organization_name,

          r.category,
          r.location,
          r.description,

          r.full_name,
          r.phone,
          r.email,
          r.anonymous,

          r.priority,
          r.status,

          r.department_id,
          d.name AS department_name,

          r.assigned_staff_id,
          s.full_name AS assigned_staff_name,

          r.organization_response,
          r.response_at,
          r.submitted_at,
          r.updated_at

        FROM reports r

        LEFT JOIN organizations o
          ON r.organization_id = o.id

        LEFT JOIN departments d
          ON r.department_id = d.id

        LEFT JOIN staff s
          ON r.assigned_staff_id = s.id

        WHERE r.organization_id = $1

        ORDER BY r.submitted_at DESC
        `,
        [
          requestedOrganizationId,
        ]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(
        "Get organization reports error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load organization reports.",
      });
    }
  }
);


module.exports = router;