const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const authenticateToken = require("../authMiddleware");

const router = express.Router();

router.use(authenticateToken);

/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

const getOrganizationId = (req) => {
  if (req.organization?.id) {
    return Number(req.organization.id);
  }

  if (req.organization?.organizationId) {
    return Number(req.organization.organizationId);
  }

  return null;
};

/*
|--------------------------------------------------------------------------
| GET ALL STAFF
|--------------------------------------------------------------------------
| GET /api/organizations/staff
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        message: "Organization authentication required.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.staff_id,
        s.full_name,
        s.email,
        s.phone,
        s.role,
        s.duty,
        s.status,
        s.is_active,
        s.department_id,
        d.name AS department_name,
        s.created_at,
        s.updated_at

      FROM staff s

      LEFT JOIN departments d
        ON s.department_id = d.id

      WHERE s.organization_id = $1

      ORDER BY s.created_at DESC
      `,
      [organizationId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Get organization staff error:",
      error
    );

    res.status(500).json({
      message: "Failed to load staff.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE STAFF
|--------------------------------------------------------------------------
| POST /api/organizations/staff
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(401).json({
        message: "Organization authentication required.",
      });
    }

    const {
      staff_id,
      full_name,
      email,
      phone,
      password,
      role,
      duty,
      department_id,
      status,
    } = req.body;

    if (
      !staff_id ||
      !full_name ||
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        message:
          "Staff ID, full name, email, password and role are required.",
      });
    }

    const existingStaff =
      await pool.query(
        `
        SELECT id
        FROM staff
        WHERE organization_id = $1
          AND (
            LOWER(email) = LOWER($2)
            OR staff_id = $3
          )
        `,
        [
          organizationId,
          email.trim(),
          staff_id.trim(),
        ]
      );

    if (existingStaff.rows.length > 0) {
      return res.status(409).json({
        message:
          "A staff member with this email or Staff ID already exists.",
      });
    }

    let departmentId = null;

    if (
      department_id !== undefined &&
      department_id !== null &&
      department_id !== ""
    ) {
      departmentId = Number(department_id);

      if (isNaN(departmentId)) {
        return res.status(400).json({
          message: "Invalid department.",
        });
      }

      const department =
        await pool.query(
          `
          SELECT id
          FROM departments
          WHERE id = $1
            AND organization_id = $2
          `,
          [
            departmentId,
            organizationId,
          ]
        );

      if (department.rows.length === 0) {
        return res.status(400).json({
          message:
            "Selected department does not belong to this organization.",
        });
      }
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const normalizedStatus =
      status === "inactive"
        ? "inactive"
        : "active";

    const isActive =
      normalizedStatus === "active";

    const result =
      await pool.query(
        `
        INSERT INTO staff (
          staff_id,
          organization_id,
          full_name,
          email,
          phone,
          password_hash,
          role,
          duty,
          status,
          is_active,
          department_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        RETURNING
          id,
          staff_id,
          full_name,
          email,
          phone,
          role,
          duty,
          status,
          is_active,
          department_id,
          created_at
        `,
        [
          staff_id.trim(),
          organizationId,
          full_name.trim(),
          email.trim(),
          phone || null,
          passwordHash,
          role.trim(),
          duty?.trim() || null,
          normalizedStatus,
          isActive,
          departmentId,
        ]
      );

    res.status(201).json({
      message: "Staff created successfully.",
      staff: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Create staff error:",
      error
    );

    res.status(500).json({
      message: "Failed to create staff.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE STAFF
|--------------------------------------------------------------------------
| PUT /api/organizations/staff/:id
|--------------------------------------------------------------------------
*/

router.put("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    const staffId =
      Number(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        message: "Organization authentication required.",
      });
    }

    if (isNaN(staffId)) {
      return res.status(400).json({
        message: "Invalid staff ID.",
      });
    }

    const {
      staff_id,
      full_name,
      email,
      phone,
      password,
      role,
      duty,
      department_id,
      status,
    } = req.body;

    if (
      !staff_id ||
      !full_name ||
      !email ||
      !role
    ) {
      return res.status(400).json({
        message:
          "Staff ID, full name, email and role are required.",
      });
    }

    let departmentId = null;

    if (
      department_id !== undefined &&
      department_id !== null &&
      department_id !== ""
    ) {
      departmentId =
        Number(department_id);

      if (isNaN(departmentId)) {
        return res.status(400).json({
          message: "Invalid department.",
        });
      }

      const department =
        await pool.query(
          `
          SELECT id
          FROM departments
          WHERE id = $1
            AND organization_id = $2
          `,
          [
            departmentId,
            organizationId,
          ]
        );

      if (department.rows.length === 0) {
        return res.status(400).json({
          message:
            "Selected department does not belong to this organization.",
        });
      }
    }

    const duplicate =
      await pool.query(
        `
        SELECT id
        FROM staff
        WHERE organization_id = $1
          AND id <> $2
          AND (
            LOWER(email) = LOWER($3)
            OR staff_id = $4
          )
        `,
        [
          organizationId,
          staffId,
          email.trim(),
          staff_id.trim(),
        ]
      );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        message:
          "Another staff member already uses this email or Staff ID.",
      });
    }

    const normalizedStatus =
      status === "inactive"
        ? "inactive"
        : "active";

    const isActive =
      normalizedStatus === "active";

    let result;

    if (password && password.trim()) {
      const passwordHash =
        await bcrypt.hash(
          password.trim(),
          10
        );

      result =
        await pool.query(
          `
          UPDATE staff
          SET
            staff_id = $1,
            full_name = $2,
            email = $3,
            phone = $4,
            password_hash = $5,
            role = $6,
            duty = $7,
            status = $8,
            is_active = $9,
            department_id = $10,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $11
            AND organization_id = $12
          RETURNING
            id,
            staff_id,
            full_name,
            email,
            phone,
            role,
            duty,
            status,
            is_active,
            department_id,
            updated_at
          `,
          [
            staff_id.trim(),
            full_name.trim(),
            email.trim(),
            phone || null,
            passwordHash,
            role.trim(),
            duty?.trim() || null,
            normalizedStatus,
            isActive,
            departmentId,
            staffId,
            organizationId,
          ]
        );
    } else {
      result =
        await pool.query(
          `
          UPDATE staff
          SET
            staff_id = $1,
            full_name = $2,
            email = $3,
            phone = $4,
            role = $5,
            duty = $6,
            status = $7,
            is_active = $8,
            department_id = $9,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $10
            AND organization_id = $11
          RETURNING
            id,
            staff_id,
            full_name,
            email,
            phone,
            role,
            duty,
            status,
            is_active,
            department_id,
            updated_at
          `,
          [
            staff_id.trim(),
            full_name.trim(),
            email.trim(),
            phone || null,
            role.trim(),
            duty?.trim() || null,
            normalizedStatus,
            isActive,
            departmentId,
            staffId,
            organizationId,
          ]
        );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Staff member not found.",
      });
    }

    res.json({
      message: "Staff updated successfully.",
      staff: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Update staff error:",
      error
    );

    res.status(500).json({
      message: "Failed to update staff.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ACTIVATE / DEACTIVATE STAFF
|--------------------------------------------------------------------------
| PUT /api/organizations/staff/:id/status
|--------------------------------------------------------------------------
*/

router.put(
  "/:id/status",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const staffId =
        Number(req.params.id);

      const { status } =
        req.body;

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Organization authentication required.",
        });
      }

      if (isNaN(staffId)) {
        return res.status(400).json({
          message: "Invalid staff ID.",
        });
      }

      if (
        status !== "active" &&
        status !== "inactive"
      ) {
        return res.status(400).json({
          message:
            "Status must be active or inactive.",
        });
      }

      const isActive =
        status === "active";

      const result =
        await pool.query(
          `
          UPDATE staff
          SET
            status = $1,
            is_active = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
            AND organization_id = $4
          RETURNING
            id,
            staff_id,
            full_name,
            email,
            role,
            duty,
            status,
            is_active,
            department_id
          `,
          [
            status,
            isActive,
            staffId,
            organizationId,
          ]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message:
            "Staff member not found.",
        });
      }

      res.json({
        message:
          `Staff member ${status === "active" ? "activated" : "deactivated"} successfully.`,
        staff: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Update staff status error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update staff status.",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| DELETE STAFF
|--------------------------------------------------------------------------
| DELETE /api/organizations/staff/:id
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  const client =
    await pool.connect();

  try {
    const organizationId =
      getOrganizationId(req);

    const staffId =
      Number(req.params.id);

    if (!organizationId) {
      return res.status(401).json({
        message:
          "Organization authentication required.",
      });
    }

    if (isNaN(staffId)) {
      return res.status(400).json({
        message: "Invalid staff ID.",
      });
    }

    await client.query("BEGIN");

    const existing =
      await client.query(
        `
        SELECT id
        FROM staff
        WHERE id = $1
          AND organization_id = $2
        `,
        [
          staffId,
          organizationId,
        ]
      );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message:
          "Staff member not found.",
      });
    }

    await client.query(
      `
      UPDATE reports
      SET
        assigned_staff_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE assigned_staff_id = $1
        AND organization_id = $2
      `,
      [
        staffId,
        organizationId,
      ]
    );

    await client.query(
      `
      DELETE FROM staff
      WHERE id = $1
        AND organization_id = $2
      `,
      [
        staffId,
        organizationId,
      ]
    );

    await client.query("COMMIT");

    res.json({
      message:
        "Staff member deleted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Delete staff error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to delete staff.",
    });
  } finally {
    client.release();
  }
});

/*
|--------------------------------------------------------------------------
| ASSIGN CASE TO STAFF
|--------------------------------------------------------------------------
| POST /api/organizations/staff/assign-case
|--------------------------------------------------------------------------
*/

router.post(
  "/assign-case",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const organizationId =
        getOrganizationId(req);

      const {
        caseId,
        staffId,
      } = req.body;

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Organization authentication required.",
        });
      }

      if (!caseId) {
        return res.status(400).json({
          message:
            "Case ID is required.",
        });
      }

      if (
        staffId === undefined ||
        staffId === null ||
        staffId === ""
      ) {
        return res.status(400).json({
          message:
            "Staff ID is required.",
        });
      }

      const requestedStaffId =
        Number(staffId);

      if (isNaN(requestedStaffId)) {
        return res.status(400).json({
          message:
            "Invalid staff ID.",
        });
      }

      await client.query("BEGIN");

      /*
      |--------------------------------------------------------------------------
      | Find case
      |--------------------------------------------------------------------------
      */

      const caseResult =
        await client.query(
          `
          SELECT
            id,
            case_id,
            department_id,
            assigned_staff_id
          FROM reports
          WHERE case_id = $1
            AND organization_id = $2
          FOR UPDATE
          `,
          [
            caseId,
            organizationId,
          ]
        );

      if (caseResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            "Case not found for this organization.",
        });
      }

      const report =
        caseResult.rows[0];

      /*
      |--------------------------------------------------------------------------
      | Find staff
      |--------------------------------------------------------------------------
      */

      const staffResult =
        await client.query(
          `
          SELECT
            id,
            staff_id,
            full_name,
            email,
            department_id,
            status,
            is_active
          FROM staff
          WHERE id = $1
            AND organization_id = $2
          `,
          [
            requestedStaffId,
            organizationId,
          ]
        );

      if (staffResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          message:
            "Staff member not found for this organization.",
        });
      }

      const staff =
        staffResult.rows[0];

      /*
      |--------------------------------------------------------------------------
      | Staff must be active
      |--------------------------------------------------------------------------
      */

      if (
        staff.status !== "active" ||
        staff.is_active !== true
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This staff member is inactive and cannot be assigned a case.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Department consistency
      |--------------------------------------------------------------------------
      */

      if (
        report.department_id !== null &&
        report.department_id !== undefined &&
        staff.department_id !== null &&
        staff.department_id !== undefined &&
        Number(report.department_id) !==
          Number(staff.department_id)
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "This staff member belongs to a different department than the case.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Update assignment
      |--------------------------------------------------------------------------
      */

      const updateResult =
        await client.query(
          `
          UPDATE reports
          SET
            assigned_staff_id = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND organization_id = $3
          RETURNING
            id,
            case_id,
            organization_id,
            department_id,
            assigned_staff_id,
            status,
            priority,
            updated_at
          `,
          [
            requestedStaffId,
            report.id,
            organizationId,
          ]
        );

      /*
      |--------------------------------------------------------------------------
      | Activity log
      |--------------------------------------------------------------------------
      */

      if (
        Number(report.assigned_staff_id || 0) !==
        requestedStaffId
      ) {
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
            "Staff Assigned",
            `Case assigned to staff member: ${staff.full_name}`,
            report.assigned_staff_id
              ? String(
                  report.assigned_staff_id
                )
              : null,
            String(
              requestedStaffId
            ),
          ]
        );
      }

      await client.query("COMMIT");

      res.json({
        message:
          "Case assigned to staff successfully.",

        staff: {
          id: staff.id,
          staffId: staff.staff_id,
          fullName: staff.full_name,
          departmentId:
            staff.department_id,
        },

        case: updateResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Assign case to staff error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to assign case to staff.",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;