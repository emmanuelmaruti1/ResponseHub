import "./Pages.css";
import React, { useEffect, useState } from "react";

function AssignStaff({ report, onAssignmentSaved }) {
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [saving, setSaving] = useState(false);

  // =========================================================
  // LOAD STAFF ACCOUNTS
  // =========================================================

  useEffect(() => {
    loadStaffMembers();
  }, []);

  const loadStaffMembers = () => {
    const foundStaff = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!key || !key.toLowerCase().includes("staff")) {
        continue;
      }

      try {
        const stored = JSON.parse(localStorage.getItem(key));

        if (Array.isArray(stored)) {
          stored.forEach((member) => {
            if (member && typeof member === "object") {
              foundStaff.push(member);
            }
          });
        } else if (stored && typeof stored === "object") {
          const possibleLists = [
            stored.staff,
            stored.staffMembers,
            stored.members,
            stored.users,
            stored.accounts,
          ];

          let foundNested = false;

          possibleLists.forEach((list) => {
            if (Array.isArray(list)) {
              list.forEach((member) => {
                if (member && typeof member === "object") {
                  foundStaff.push(member);
                  foundNested = true;
                }
              });
            }
          });

          if (!foundNested) {
            foundStaff.push(stored);
          }
        }
      } catch (error) {
        // Ignore invalid localStorage values
      }
    }

    // Remove duplicates
    const uniqueStaff = [];

    foundStaff.forEach((member) => {
      const id =
        member.id ||
        member.staffId ||
        member.employeeId ||
        member.email ||
        member.username;

      if (!id) return;

      const alreadyExists = uniqueStaff.some(
        (existing) =>
          String(
            existing.id ||
              existing.staffId ||
              existing.employeeId ||
              existing.email ||
              existing.username
          ) === String(id)
      );

      if (!alreadyExists) {
        uniqueStaff.push(member);
      }
    });

    setStaffMembers(uniqueStaff);

    if (report?.staffId) {
      setSelectedStaffId(String(report.staffId));
    }
  };

  // =========================================================
  // SAVE ASSIGNMENT
  // =========================================================

  const assignStaff = () => {
    if (!report || !selectedStaffId) {
      alert("Please select a staff member.");
      return;
    }

    const selectedStaff = staffMembers.find((member) => {
      const id =
        member.id ||
        member.staffId ||
        member.employeeId ||
        member.email ||
        member.username;

      return String(id) === String(selectedStaffId);
    });

    if (!selectedStaff) {
      alert("Staff member could not be found.");
      return;
    }

    setSaving(true);

    const staffId =
      selectedStaff.id ||
      selectedStaff.staffId ||
      selectedStaff.employeeId ||
      selectedStaff.email ||
      selectedStaff.username;

    const staffName =
      selectedStaff.name ||
      selectedStaff.fullName ||
      selectedStaff.staffName ||
      selectedStaff.username ||
      selectedStaff.email ||
      "Assigned Staff";

    const staffEmail =
      selectedStaff.email ||
      selectedStaff.staffEmail ||
      "";

    const staffRole =
      selectedStaff.role ||
      selectedStaff.position ||
      "Staff Member";

    const timestamp = new Date().toISOString();

    const oldStaffName =
      report.staffName ||
      report.assignedStaffName ||
      "Unassigned";

    const updatedReport = {
      ...report,

      staffId: String(staffId),
      staffName,
      assignedStaffName: staffName,
      staffEmail,
      staffRole,

      assignedAt: timestamp,
      lastUpdated: timestamp,
      lastUpdatedBy: staffName,

      activity: [
        ...(Array.isArray(report.activity) ? report.activity : []),
        {
          id:
            "ACT-" +
            Date.now().toString(36).toUpperCase(),
          type: "assignment",
          title:
            oldStaffName === staffName
              ? "Staff assignment updated"
              : `Case assigned to ${staffName}`,
          description:
            oldStaffName === staffName
              ? `The case assignment remains with ${staffName}.`
              : `This case was assigned to ${staffName}.`,
          timestamp,
          performedBy: "Organization Admin",
        },
      ],
    };

    try {
      localStorage.setItem(
        `responsehub_${updatedReport.caseNumber}`,
        JSON.stringify(updatedReport)
      );

      if (onAssignmentSaved) {
        onAssignmentSaved(updatedReport);
      }

      alert(`Case assigned to ${staffName} successfully.`);

      setSaving(false);
    } catch (error) {
      console.error("Assignment error:", error);
      alert("Unable to save the staff assignment.");
      setSaving(false);
    }
  };

  // =========================================================
  // NO REPORT
  // =========================================================

  if (!report) {
    return null;
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      style={{
        marginTop: "28px",
        padding: "24px",
        borderRadius: "18px",
        border: "1px solid #dbe3ef",
        background: "#f8fafc",
        boxShadow:
          "0 8px 25px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: "800",
          letterSpacing: "1px",
          color: "#64748b",
          marginBottom: "7px",
        }}
      >
        CASE ASSIGNMENT
      </div>

      <h3
        style={{
          margin: "0 0 7px",
          fontSize: "20px",
          color: "#0f172a",
        }}
      >
        Assign Staff Member
      </h3>

      <p
        style={{
          margin: "0 0 18px",
          color: "#64748b",
          lineHeight: "1.6",
          fontSize: "14px",
        }}
      >
        Assign this case to a staff member. The assigned staff
        member will see the case in their Staff Portal.
      </p>

      {/* CURRENT ASSIGNMENT */}

      <div
        style={{
          padding: "13px 15px",
          marginBottom: "16px",
          borderRadius: "12px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            color: "#64748b",
            fontWeight: "700",
          }}
        >
          CURRENTLY ASSIGNED
        </span>

        <div
          style={{
            marginTop: "5px",
            fontWeight: "700",
            color: "#0f172a",
          }}
        >
          {report.staffName ||
            report.assignedStaffName ||
            "No staff member assigned"}
        </div>
      </div>

      {/* STAFF SELECT */}

      <label
        style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: "700",
          color: "#334155",
          fontSize: "14px",
        }}
      >
        Select Staff Member
      </label>

      <select
        value={selectedStaffId}
        onChange={(event) =>
          setSelectedStaffId(event.target.value)
        }
        style={{
          width: "100%",
          padding: "13px 14px",
          borderRadius: "12px",
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          fontSize: "14px",
          color: "#0f172a",
          outline: "none",
          marginBottom: "14px",
        }}
      >
        <option value="">
          -- Select a staff member --
        </option>

        {staffMembers.map((member, index) => {
          const id =
            member.id ||
            member.staffId ||
            member.employeeId ||
            member.email ||
            member.username;

          const name =
            member.name ||
            member.fullName ||
            member.staffName ||
            member.username ||
            member.email ||
            `Staff Member ${index + 1}`;

          const role =
            member.role ||
            member.position ||
            "Staff Member";

          return (
            <option key={String(id)} value={String(id)}>
              {name} — {role}
            </option>
          );
        })}
      </select>

      {staffMembers.length === 0 && (
        <div
          style={{
            padding: "13px",
            marginBottom: "14px",
            borderRadius: "10px",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: "13px",
          }}
        >
          No staff members were found. Make sure staff accounts
          have been created in the Organization Staff Management
          section.
        </div>
      )}

      {/* BUTTON */}

      <button
        type="button"
        onClick={assignStaff}
        disabled={saving || staffMembers.length === 0}
        style={{
          width: "100%",
          padding: "13px 18px",
          border: "none",
          borderRadius: "12px",
          background:
            saving || staffMembers.length === 0
              ? "#94a3b8"
              : "#0f172a",
          color: "#ffffff",
          fontWeight: "800",
          cursor:
            saving || staffMembers.length === 0
              ? "not-allowed"
              : "pointer",
          fontSize: "14px",
        }}
      >
        {saving
          ? "Saving Assignment..."
          : "Assign Case to Staff"}
      </button>
    </div>
  );
}

export default AssignStaff;