const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "responsehub-automated-test-secret";

const app = require("../server");
const pool = require("../db");

const organization1Token = jwt.sign(
  {
    id: 1,
    organizationId: "ORG-TEST-001",
    email: "organization1-test@example.com",
  },
  process.env.JWT_SECRET,
  { expiresIn: "10m" }
);

const organization1Auth = {
  Authorization: `Bearer ${organization1Token}`,
};

function createStaffToken(overrides = {}) {
  return jwt.sign(
    {
      staffId: 1,
      staffPublicId: "STAFF-TEST-001",
      organizationId: 2,
      organizationPublicId: "ORG-1790795706095-1400",
      email: "staff-test@example.com",
      role: "Staff",
      duty: "Case handling",
      accountType: "staff",
      ...overrides,
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

const activeStaffRecord = {
  id: 1,
  staff_id: "STAFF-TEST-001",
  organization_id: 2,
  full_name: "Automated Test Staff",
  email: "staff-test@example.com",
  role: "Staff",
  duty: "Case handling",
  status: "active",
  is_active: true,
};

describe("ResponseHub API security tests", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Basic API behavior", () => {
    test("GET / returns the backend success message", async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.body.message).toContain(
        "ResponseHub backend is running successfully"
      );
    });

    test("Unknown API endpoints return 404", async () => {
      const response = await request(app).get(
        "/api/this-endpoint-does-not-exist"
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toBe(
        "API endpoint not found."
      );
    });
  });

  describe("Organization authentication", () => {
    test("Rejects requests without an authentication token", async () => {
      const response = await request(app).get(
        "/api/organizations/2/cases/RH-2026-000001"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Authentication required."
      );
    });

    test("Rejects invalid organization tokens", async () => {
      const response = await request(app)
        .get("/api/organizations/2/cases/RH-2026-000001")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Invalid authentication token."
      );
    });

    test("Rejects malformed authorization headers", async () => {
      const response = await request(app)
        .get("/api/organizations/2/cases/RH-2026-000001")
        .set("Authorization", "invalid-format");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Invalid authorization format."
      );
    });
  });

  describe("Organization isolation: departments", () => {
    test("Cannot read another organization's departments", async () => {
      const response = await request(app)
        .get("/api/organizations/2/departments")
        .set(organization1Auth);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to access these departments."
      );
    });

    test("Cannot create another organization's department", async () => {
      const response = await request(app)
        .post("/api/organizations/2/departments")
        .set(organization1Auth)
        .send({
          name: "Automated Security Test Department",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to create departments."
      );
    });

    test("Cannot modify another organization's department", async () => {
      const response = await request(app)
        .put("/api/organizations/2/departments/1")
        .set(organization1Auth)
        .send({
          name: "Unauthorized Department Change",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to update this department."
      );
    });

    test("Cannot delete another organization's department", async () => {
      const response = await request(app)
        .delete("/api/organizations/2/departments/1")
        .set(organization1Auth);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to delete this department."
      );
    });
  });

  describe("Organization isolation: case access", () => {
    test("Cannot read another organization's case details", async () => {
      const response = await request(app)
        .get("/api/organizations/2/cases/RH-2026-000001")
        .set(organization1Auth);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to access this case."
      );
    });

    test("Cannot change another organization's case status", async () => {
      const response = await request(app)
        .put(
          "/api/organizations/2/cases/RH-2026-000001/status"
        )
        .set(organization1Auth)
        .send({ status: "Resolved" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to update this case."
      );
    });

    test("Cannot change another organization's case priority", async () => {
      const response = await request(app)
        .put(
          "/api/organizations/2/cases/RH-2026-000001/priority"
        )
        .set(organization1Auth)
        .send({ priority: "Critical" });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to update this case."
      );
    });

    test("Cannot respond to another organization's case", async () => {
      const response = await request(app)
        .put(
          "/api/organizations/2/cases/RH-2026-000001/response"
        )
        .set(organization1Auth)
        .send({
          response: "Unauthorized test response",
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to respond to this case."
      );
    });

    test("Cannot assign another organization's case to a department", async () => {
      const response = await request(app)
        .put(
          "/api/organizations/2/cases/RH-2026-000001/department"
        )
        .set(organization1Auth)
        .send({ departmentId: 1 });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Not authorized to assign this case."
      );
    });
  });

  describe("Organization staff isolation", () => {
    test("Organization 1 cannot use an organization-ID URL to list Organization 2 staff", async () => {
      const response = await request(app)
        .get("/api/organizations/2/staff")
        .set(organization1Auth);

      expect(response.status).toBe(404);
    });

    test("Rejects staff listing without authentication", async () => {
      const response = await request(app).get(
        "/api/organizations/staff"
      );

      expect(response.status).toBe(401);
    });

    test("Rejects staff creation without authentication", async () => {
      const response = await request(app)
        .post("/api/organizations/staff")
        .send({
          staff_id: "SECURITY-TEST-001",
          full_name: "Security Test Staff",
          email: "security-test@example.com",
          password: "NotARealPassword123!",
          role: "Staff",
        });

      expect(response.status).toBe(401);
    });

    test("Rejects staff assignment without authentication", async () => {
      const response = await request(app)
        .post("/api/organizations/staff/assign-case")
        .send({
          caseId: "RH-2026-000001",
          staffId: 1,
        });

      expect(response.status).toBe(401);
    });
  });

  describe("Staff-only route authentication", () => {
    test("Rejects staff case listing without a token", async () => {
      const response = await request(app).get(
        "/api/staff/cases"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Authorization token required."
      );
    });

    test("Rejects invalid staff tokens", async () => {
      const response = await request(app)
        .get("/api/staff/cases")
        .set("Authorization", "Bearer invalid-staff-token");

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Invalid staff authentication token."
      );
    });

    test("Rejects organization tokens on staff-only routes", async () => {
      const response = await request(app)
        .get("/api/staff/cases")
        .set(organization1Auth);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        "Staff access required."
      );
    });
  });

  describe("Staff database-backed authentication", () => {
    test("Allows an active staff member through authentication", async () => {
      jest.spyOn(pool, "query")
        .mockResolvedValueOnce({
          rows: [activeStaffRecord],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const token = createStaffToken();

      const response = await request(app)
        .get("/api/staff/cases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.cases).toEqual([]);
    });

    test("Rejects inactive staff with a valid JWT", async () => {
      jest.spyOn(pool, "query").mockResolvedValueOnce({
        rows: [
          {
            ...activeStaffRecord,
            status: "inactive",
            is_active: false,
          },
        ],
      });

      const token = createStaffToken();

      const response = await request(app)
        .get("/api/staff/cases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain(
        "staff account is inactive"
      );
    });

    test("Rejects a deleted or missing staff account", async () => {
      jest.spyOn(pool, "query").mockResolvedValueOnce({
        rows: [],
      });

      const token = createStaffToken();

      const response = await request(app)
        .get("/api/staff/cases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain(
        "Staff account not found"
      );
    });

    test("Rejects staff tokens with invalid numeric IDs", async () => {
      const databaseMock = jest.spyOn(pool, "query");

      const token = createStaffToken({
        staffId: "not-a-number",
      });

      const response = await request(app)
        .get("/api/staff/cases")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe(
        "Invalid staff authentication token."
      );

      expect(databaseMock).not.toHaveBeenCalled();
    });
  });
});