import React, { useEffect, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

const EMPTY_FORM = {
  staff_id: "",
  full_name: "",
  email: "",
  phone: "",
  password: "",
  role: "Staff",
  duty: "",
  department_id: "",
  status: "active",
};

function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // AUTH HEADERS
  const getHeaders = () => {
    const token = localStorage.getItem("responsehub_token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // LOAD STAFF
  const loadStaff = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/organizations/staff`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load staff.");
      }

      setStaff(
        Array.isArray(data) ? data : data.staff || []
      );
    } catch (err) {
      console.error("Load staff error:", err);
      setError(err.message || "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  // LOAD DEPARTMENTS
  const loadDepartments = async () => {
    try {
      const response = await fetch(
        `${API_URL}/organizations/departments`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (response.ok) {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.departments)
          ? data.departments
          : [];

        setDepartments(list);
        return;
      }
    } catch (err) {
      console.log("Department API unavailable.", err);
    }

    // Fallback to localStorage if the department API fails.
    try {
      const organization = JSON.parse(
        localStorage.getItem("responsehub_organization")
      );

      if (organization?.id) {
        const saved = localStorage.getItem(
          `responsehub_departments_${organization.id}`
        );

        if (saved) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setDepartments(parsed);
          }
        }
      }
    } catch (err) {
      console.error("Department fallback error:", err);
    }
  };

  // INITIAL LOAD
  useEffect(() => {
    loadStaff();
    loadDepartments();
  }, []);

  // FORM CHANGE
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  // OPEN CREATE FORM
  const openCreateForm = () => {
    setEditingStaff(null);
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // OPEN EDIT FORM
  const openEditForm = (member) => {
    setEditingStaff(member);

    setForm({
      staff_id: member.staff_id || "",
      full_name: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
      password: "",
      role: member.role || "Staff",
      duty: member.duty || "",
      department_id:
        member.department_id !== null &&
        member.department_id !== undefined
          ? String(member.department_id)
          : "",
      status: member.status || "active",
    });

    setShowPassword(false);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  // CLOSE FORM
  const closeForm = () => {
    setShowForm(false);
    setEditingStaff(null);
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setError("");
  };

  // CREATE / UPDATE STAFF
  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const staffId = form.staff_id.trim();
    const fullName = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const duty = form.duty.trim();
    const password = form.password;

    if (!staffId) {
      setError("Staff ID is required.");
      return;
    }

    if (!fullName) {
      setError("Full name is required.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!editingStaff && !password) {
      setError("Password is required.");
      return;
    }

    if (password && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);

    try {
      // These are the field names expected by the existing backend.
      const body = {
        staff_id: staffId,
        full_name: fullName,
        email,
        phone,
        role: form.role || "Staff",
        duty,
        department_id:
          form.department_id === ""
            ? null
            : Number(form.department_id),
        status: form.status || "active",
      };

      // Only send a password when one has been entered.
      if (password) {
        body.password = password;
      }

      console.log("Sending staff data:", {
        ...body,
        password: body.password ? "[HIDDEN]" : undefined,
      });

      const url = editingStaff
        ? `${API_URL}/organizations/staff/${editingStaff.id}`
        : `${API_URL}/organizations/staff`;

      const method = editingStaff ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to save staff."
        );
      }

      setSuccess(
        editingStaff
          ? "Staff member updated successfully."
          : "Staff member created successfully."
      );

      await loadStaff();

      // Close the form after a successful save.
      window.setTimeout(() => {
        closeForm();
      }, 1000);
    } catch (err) {
      console.error("Save staff error:", err);

      setError(
        err.message || "Failed to save staff member."
      );
    } finally {
      setSaving(false);
    }
  };

  // TOGGLE STATUS
  const toggleStatus = async (member) => {
    const newStatus =
      member.status === "active" ? "inactive" : "active";

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/organizations/staff/${member.id}/status`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update staff status."
        );
      }

      setSuccess(`${member.full_name} is now ${newStatus}.`);

      await loadStaff();
    } catch (err) {
      console.error("Toggle status error:", err);

      setError(
        err.message || "Failed to update staff status."
      );
    }
  };

  // DELETE STAFF
  const deleteStaff = async (member) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${member.full_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/organizations/staff/${member.id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete staff."
        );
      }

      setSuccess("Staff member deleted successfully.");

      await loadStaff();
    } catch (err) {
      console.error("Delete staff error:", err);

      setError(
        err.message || "Failed to delete staff."
      );
    }
  };

  // UI
  return (
    <div className="staff-management">
      <div className="staff-management-header">
        <div>
          <h2>Staff Management</h2>

          <p>
            Create, manage and assign staff members to your
            organization.
          </p>
        </div>

        <button
          type="button"
          className="add-staff-button"
          onClick={openCreateForm}
        >
          + Add Staff
        </button>
      </div>

      {error && (
        <div className="staff-alert staff-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="staff-alert staff-success" role="status">
          {success}
        </div>
      )}

      {showForm && (
        <div className="staff-form-card">
          <div className="staff-form-header">
            <h3>
              {editingStaff
                ? "Edit Staff Member"
                : "Add New Staff Member"}
            </h3>

            <button
              type="button"
              className="close-form-button"
              onClick={closeForm}
              aria-label="Close staff form"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="staff-form-grid">
              <div className="form-group">
                <label htmlFor="staff_id">
                  Staff ID <span>*</span>
                </label>

                <input
                  id="staff_id"
                  type="text"
                  name="staff_id"
                  value={form.staff_id}
                  onChange={handleChange}
                  placeholder="e.g. RH-STAFF-001"
                  disabled={!!editingStaff || saving}
                  required
                />

                {editingStaff && (
                  <small>Staff ID cannot be changed.</small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="full_name">
                  Full Name <span>*</span>
                </label>

                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  autoComplete="name"
                  disabled={saving}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff_email">
                  Email <span>*</span>
                </label>

                <input
                  id="staff_email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="staff@example.com"
                  autoComplete="email"
                  disabled={saving}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff_phone">Phone</label>

                <input
                  id="staff_phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0712345678"
                  autoComplete="tel"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="staff_role">
                  Role <span>*</span>
                </label>

                <select
                  id="staff_role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  disabled={saving}
                  required
                >
                  <option value="Staff">Staff</option>
                  <option value="Officer">Officer</option>
                  <option value="Case Officer">Case Officer</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="staff_duty">Duty</label>

                <input
                  id="staff_duty"
                  type="text"
                  name="duty"
                  value={form.duty}
                  onChange={handleChange}
                  placeholder="e.g. Water Complaints"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label htmlFor="department_id">Department</label>

                <select
                  id="department_id"
                  name="department_id"
                  value={form.department_id}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="">No Department</option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="staff_status">
                  Account Status
                </label>

                <select
                  id="staff_status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="staff_password">
                  Password {!editingStaff && <span>*</span>}
                </label>

                <div className="password-input-wrapper">
                  <input
                    id="staff_password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder={
                      editingStaff
                        ? "Leave blank to keep current password"
                        : "Enter password"
                    }
                    autoComplete="new-password"
                    minLength={6}
                    required={!editingStaff}
                    disabled={saving}
                  />

                  <button
                    type="button"
                    className="password-toggle-button"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    disabled={saving}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {editingStaff && (
                  <small>
                    Leave blank to keep the current password.
                  </small>
                )}
              </div>
            </div>

            <div className="staff-form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-staff-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingStaff
                  ? "Update Staff"
                  : "Create Staff"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="staff-table-card">
        <div className="staff-table-header">
          <h3>Organization Staff</h3>

          <span>
            {staff.length}{" "}
            {staff.length === 1 ? "staff member" : "staff members"}
          </span>
        </div>

        {loading && staff.length === 0 ? (
          <div className="staff-empty">Loading staff...</div>
        ) : staff.length === 0 ? (
          <div className="staff-empty">
            <h4>No staff members yet</h4>

            <p>
              Click "Add Staff" to create your first staff account.
            </p>
          </div>
        ) : (
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Duty</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <strong>{member.staff_id || "—"}</strong>
                    </td>

                    <td>{member.full_name || "—"}</td>
                    <td>{member.email || "—"}</td>
                    <td>{member.role || "Staff"}</td>
                    <td>{member.duty || "—"}</td>
                    <td>{member.department_name || "No Department"}</td>

                    <td>
                      <span
                        className={`staff-status ${
                          member.status === "active"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {member.status === "active"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="staff-actions">
                        <button
                          type="button"
                          onClick={() => openEditForm(member)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleStatus(member)}
                        >
                          {member.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          className="delete-staff-button"
                          onClick={() => deleteStaff(member)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default StaffManagement;