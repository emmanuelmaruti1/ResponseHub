const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

const MAX_EVIDENCE_FILES = 3;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024;

const ALLOWED_EVIDENCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function getOrganizationAuthentication(req) {
  const header = String(req.headers.authorization || "").trim();

  if (!header) {
    return { provided: false, organization: null };
  }

  if (!header.startsWith("Bearer ")) {
    return {
      provided: true,
      error: "Invalid authorization header.",
    };
  }

  const token = header.slice(7).trim();

  if (!token || !process.env.JWT_SECRET) {
    return {
      provided: true,
      error: "Invalid authentication token.",
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      !decoded ||
      decoded.accountType === "staff" ||
      !Number.isSafeInteger(Number(decoded.id)) ||
      Number(decoded.id) <= 0
    ) {
      return {
        provided: true,
        error: "Invalid organization authentication token.",
      };
    }

    return {
      provided: true,
      organization: {
        id: Number(decoded.id),
        organizationId: decoded.organizationId || null,
        email: decoded.email || null,
      },
    };
  } catch {
    return {
      provided: true,
      error: "Invalid or expired authentication token.",
    };
  }
}

// Check that decoded file content matches its declared MIME type.
function matchesFileSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return false;
  }

  switch (mimeType) {
    case "image/jpeg":
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
      );

    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );

    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";

    default:
      return false;
  }
}

function validateEvidence(files) {
  if (!Array.isArray(files)) {
    return "Evidence must be a list of files.";
  }

  if (files.length > MAX_EVIDENCE_FILES) {
    return "A maximum of 3 evidence files is allowed.";
  }

  const evidenceIds = new Set();

  for (const file of files) {
    if (
      !file ||
      typeof file !== "object" ||
      typeof file.id !== "string" ||
      !file.id.trim() ||
      file.id.trim().length > 200 ||
      typeof file.name !== "string" ||
      !file.name.trim() ||
      file.name.trim().length > 255 ||
      /[\u0000-\u001f\u007f]/.test(file.name) ||
      typeof file.type !== "string" ||
      !ALLOWED_EVIDENCE_TYPES.has(file.type.toLowerCase()) ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_FILE_SIZE ||
      typeof file.dataUrl !== "string"
    ) {
      return "An evidence file is invalid. Use JPG, PNG, WEBP or PDF files up to 1.5 MB each.";
    }

    const evidenceId = file.id.trim();

    if (evidenceIds.has(evidenceId)) {
      return "Evidence file IDs must be unique within a report.";
    }

    evidenceIds.add(evidenceId);

    const mimeType = file.type.toLowerCase();
    const prefix = `data:${mimeType};base64,`;

    if (!file.dataUrl.startsWith(prefix)) {
      return "An evidence file has an invalid data format.";
    }

    const base64 = file.dataUrl.slice(prefix.length);

    if (
      !base64 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) ||
      base64.length % 4 !== 0
    ) {
      return "An evidence file contains invalid encoded data.";
    }

    const buffer = Buffer.from(base64, "base64");

    // Reject malformed or non-canonical base64.
    if (buffer.toString("base64") !== base64) {
      return "An evidence file contains invalid encoded data.";
    }

    // Do not trust the size supplied by the browser.
    if (buffer.length !== file.size) {
      return "An evidence file's actual size does not match its declared size.";
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return "Each evidence file must be 1.5 MB or smaller.";
    }

    // Verify that the file signature agrees with its MIME type.
    if (!matchesFileSignature(buffer, mimeType)) {
      return "An evidence file's content does not match its declared file type.";
    }
  }

  return null;
}

// ===============================
// POST /api/reports
// Create a report and save its evidence atomically.
// ===============================

router.post("/", async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const body = req.body || {};

    const caseId =
      typeof body.caseId === "string" ? body.caseId.trim() : "";

    const category =
      typeof body.category === "string" ? body.category.trim() : "";

    const location =
      typeof body.location === "string" ? body.location.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const organizationId = body.organizationId;
    const evidenceFiles =
      body.evidence === undefined ? [] : body.evidence;

    if (
      !caseId ||
      caseId.length > 100 ||
      !category ||
      category.length > 150 ||
      !location ||
      location.length > 500 ||
      !description ||
      description.length > 10000
    ) {
      return res.status(400).json({
        message:
          "A valid Case ID, category, location and description are required.",
      });
    }

    const optionalTextFields = [
      { key: "fullName", max: 200, label: "Full name" },
      { key: "phone", max: 50, label: "Phone number" },
      { key: "email", max: 254, label: "Email" },
    ];

    for (const field of optionalTextFields) {
      const value = body[field.key];

      if (
        value !== undefined &&
        value !== null &&
        typeof value !== "string"
      ) {
        return res.status(400).json({
          message: `${field.label} must be text.`,
        });
      }

      if (
        typeof value === "string" &&
        value.length > field.max
      ) {
        return res.status(400).json({
          message: `${field.label} is too long.`,
        });
      }
    }

    if (
      body.anonymous !== undefined &&
      typeof body.anonymous !== "boolean"
    ) {
      return res.status(400).json({
        message: "Anonymous must be true or false.",
      });
    }

    const allowedPriorities = [
      "Low",
      "Medium",
      "High",
      "Critical",
    ];

    const priority =
      body.priority === undefined ? "Medium" : body.priority;

    if (
      typeof priority !== "string" ||
      !allowedPriorities.includes(priority)
    ) {
      return res.status(400).json({
        message: "Invalid report priority.",
      });
    }

    const evidenceError = validateEvidence(evidenceFiles);

    if (evidenceError) {
      return res.status(400).json({
        message: evidenceError,
      });
    }

    client = await pool.connect();

    let organization = null;

    if (
      organizationId !== undefined &&
      organizationId !== null &&
      String(organizationId).trim() !== ""
    ) {
      const organizationResult = await client.query(
        `
        SELECT id, organization_id, name, email
        FROM organizations
        WHERE id::text = $1
           OR organization_id = $1
        LIMIT 1
        `,
        [String(organizationId).trim()]
      );

      if (organizationResult.rows.length === 0) {
        return res.status(400).json({
          message: "The selected organization was not found.",
        });
      }

      organization = organizationResult.rows[0];
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const isAnonymous = body.anonymous === true;

    const reportResult = await client.query(
      `
      INSERT INTO reports (
        case_id,
        organization_id,
        category,
        location,
        description,
        full_name,
        phone,
        email,
        anonymous,
        priority
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        caseId,
        organization ? organization.id : null,
        category,
        location,
        description,
        isAnonymous ? null : (body.fullName || null),
        isAnonymous ? null : (body.phone || null),
        isAnonymous ? null : (body.email || null),
        isAnonymous,
        priority,
      ]
    );

    const createdReport = reportResult.rows[0];

    for (const file of evidenceFiles) {
      await client.query(
        `
        INSERT INTO report_evidence (
          report_id,
          evidence_id,
          file_name,
          file_type,
          file_size,
          data_url,
          uploaded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          createdReport.id,
          file.id.trim(),
          file.name.trim(),
          file.type.toLowerCase(),
          file.size,
          file.dataUrl,
          file.uploadedAt &&
          !Number.isNaN(Date.parse(file.uploadedAt))
            ? new Date(file.uploadedAt)
            : new Date(),
        ]
      );
    }

    const evidenceResult = await client.query(
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
      [createdReport.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: "Report created successfully.",
      evidenceReceived: evidenceFiles.length,
      evidenceSaved: evidenceResult.rows.length,
      report: {
        ...createdReport,
        evidence: evidenceResult.rows,
      },
      organization: organization
        ? {
            id: organization.id,
            organizationId: organization.organization_id,
            name: organization.name,
            email: organization.email,
          }
        : null,
    });
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Report rollback failed:",
          rollbackError.message
        );
      }
    }

    if (error.code === "23505") {
      return res.status(409).json({
        message: "A report with this Case ID already exists.",
      });
    }

    console.error("Create report error:", error.message);

    return res.status(500).json({
      message: "Failed to create report.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ===============================
// GET /api/reports/:caseId
// Public access returns tracking-safe fields only.
// An authenticated organization can see private details
// and evidence only for its own reports.
// ===============================

router.get("/:caseId", async (req, res) => {
  try {
    const caseId =
      typeof req.params.caseId === "string"
        ? req.params.caseId.trim()
        : "";

    if (!caseId || caseId.length > 100) {
      return res.status(400).json({
        message: "A valid Case ID is required.",
      });
    }

    const authentication = getOrganizationAuthentication(req);

    // A supplied but invalid token must never fall back to public access.
    if (authentication.provided && authentication.error) {
      return res.status(401).json({
        message: authentication.error,
      });
    }

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
        r.organization_response,
        r.response_at,
        r.submitted_at,
        r.updated_at
      FROM reports r
      LEFT JOIN organizations o
        ON r.organization_id = o.id
      WHERE r.case_id = $1
      LIMIT 1
      `,
      [caseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    const report = result.rows[0];

    if (authentication.organization) {
      if (
        Number(report.organization_id) !==
        authentication.organization.id
      ) {
        return res.status(403).json({
          message: "You are not authorized to access this report.",
        });
      }

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

      return res.json({
        message: "Report found successfully.",
        access: "organization",
        report: {
          ...report,
          evidence: evidenceResult.rows,
        },
      });
    }

    return res.json({
      message: "Report found successfully.",
      access: "public",
      report: {
        case_id: report.case_id,
        category: report.category,
        location: report.location,
        priority: report.priority,
        status: report.status,
        organization_name: report.organization_name,
        organization_response: report.organization_response,
        response_at: report.response_at,
        submitted_at: report.submitted_at,
        updated_at: report.updated_at,
      },
    });
  } catch (error) {
    console.error("Get report error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve report.",
    });
  }
});

module.exports = router;