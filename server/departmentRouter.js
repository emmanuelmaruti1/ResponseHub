const express = require("express");

const router = express.Router();
const pool = require("./db");
const authenticateToken = require("./authMiddleware");

// =====================================================
// GET DEPARTMENTS
// GET /api/organizations/departments
// =====================================================

router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const organizationId = req.organization?.id;

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Authenticated organization could not be identified.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          organization_id,
          name,
          created_at,
          updated_at
        FROM departments
        WHERE organization_id = $1
        ORDER BY name ASC
        `,
        [organizationId]
      );

      res.json({
        message:
          "Departments retrieved successfully.",
        departments: result.rows,
      });
    } catch (error) {
      console.error(
        "Get departments error:",
        error.message
      );

      res.status(500).json({
        message:
          "Failed to retrieve departments.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// CREATE DEPARTMENT
// POST /api/organizations/departments
// =====================================================

router.post(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const organizationId = req.organization?.id;
      const { name } = req.body;

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Authenticated organization could not be identified.",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          message:
            "Department name is required.",
        });
      }

      const departmentName =
        name.trim();

      // -------------------------------------------------
      // CHECK FOR DUPLICATE DEPARTMENT
      // -------------------------------------------------

      const existingDepartment =
        await pool.query(
          `
          SELECT id
          FROM departments
          WHERE organization_id = $1
          AND LOWER(name) = LOWER($2)
          `,
          [
            organizationId,
            departmentName,
          ]
        );

      if (
        existingDepartment.rows.length >
        0
      ) {
        return res.status(409).json({
          message:
            "A department with this name already exists.",
        });
      }

      // -------------------------------------------------
      // CREATE DEPARTMENT
      // -------------------------------------------------

      const result =
        await pool.query(
          `
          INSERT INTO departments (
            organization_id,
            name
          )
          VALUES ($1, $2)
          RETURNING
            id,
            organization_id,
            name,
            created_at,
            updated_at
          `,
          [
            organizationId,
            departmentName,
          ]
        );

      res.status(201).json({
        message:
          "Department created successfully.",
        department:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create department error:",
        error.message
      );

      res.status(500).json({
        message:
          "Failed to create department.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// UPDATE DEPARTMENT
// PUT /api/organizations/departments/:id
// =====================================================

router.put(
  "/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const organizationId =
        req.organization?.id;

      const departmentId =
        Number(req.params.id);

      const { name } = req.body;

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Authenticated organization could not be identified.",
        });
      }

      if (
        !Number.isInteger(
          departmentId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid department ID.",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          message:
            "Department name is required.",
        });
      }

      const departmentName =
        name.trim();

      // -------------------------------------------------
      // CHECK DUPLICATE NAME
      // -------------------------------------------------

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM departments
          WHERE organization_id = $1
          AND LOWER(name) = LOWER($2)
          AND id <> $3
          `,
          [
            organizationId,
            departmentName,
            departmentId,
          ]
        );

      if (
        duplicate.rows.length > 0
      ) {
        return res.status(409).json({
          message:
            "Another department with this name already exists.",
        });
      }

      // -------------------------------------------------
      // UPDATE DEPARTMENT
      // -------------------------------------------------

      const result =
        await pool.query(
          `
          UPDATE departments
          SET
            name = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          AND organization_id = $3
          RETURNING
            id,
            organization_id,
            name,
            created_at,
            updated_at
          `,
          [
            departmentName,
            departmentId,
            organizationId,
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Department not found.",
        });
      }

      res.json({
        message:
          "Department updated successfully.",
        department:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Update department error:",
        error.message
      );

      res.status(500).json({
        message:
          "Failed to update department.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// DELETE DEPARTMENT
// DELETE /api/organizations/departments/:id
// =====================================================

router.delete(
  "/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const organizationId =
        req.organization?.id;

      const departmentId =
        Number(req.params.id);

      if (!organizationId) {
        return res.status(401).json({
          message:
            "Authenticated organization could not be identified.",
        });
      }

      if (
        !Number.isInteger(
          departmentId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid department ID.",
        });
      }

      const result =
        await pool.query(
          `
          DELETE FROM departments
          WHERE id = $1
          AND organization_id = $2
          RETURNING
            id,
            organization_id,
            name
          `,
          [
            departmentId,
            organizationId,
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Department not found.",
        });
      }

      res.json({
        message:
          "Department deleted successfully.",
        department:
          result.rows[0],
      });
    } catch (error) {
      console.error(
        "Delete department error:",
        error.message
      );

      res.status(500).json({
        message:
          "Failed to delete department.",
        error: error.message,
      });
    }
  }
);

module.exports = router;