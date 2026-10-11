import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./StaffDashboard.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

const STATUSES = ["Received", "In Progress", "Resolved", "Closed"];

function getStoredStaff() {
  try {
    const value = localStorage.getItem("responsehub_staff");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function getCaseId(item) {
  return (
    item?.case_id ||
    item?.caseId ||
    item?.case_number ||
    item?.caseNumber ||
    item?.report?.case_id ||
    item?.report?.caseId ||
    ""
  );
}

function getStatus(item) {
  const status = item?.status || item?.case_status || "Received";
  return String(status);
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function normalizeEvidence(item) {
  const evidence = Array.isArray(item)
    ? item
    : Array.isArray(item?.evidence)
      ? item.evidence
      : Array.isArray(item?.report?.evidence)
        ? item.report.evidence
        : Array.isArray(item?.case?.evidence)
          ? item.case.evidence
          : [];

  return evidence
    .map((file, index) => ({
      ...file,
      id: file.id || file.evidence_id || index,
      fileName:
        file.fileName ||
        file.file_name ||
        file.filename ||
        file.name ||
        `Evidence-${index + 1}`,
      fileType:
        file.fileType ||
        file.file_type ||
        file.mime_type ||
        file.mimetype ||
        "",
      fileSize: file.fileSize ?? file.file_size ?? null,
      dataUrl:
        file.dataUrl ||
        file.data_url ||
        file.file_url ||
        file.url ||
        file.file_path ||
        "",
    }))
    .filter((file) => Boolean(file.dataUrl));
}

function normalizeActivity(data) {
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.activities)
      ? data.activities
      : Array.isArray(data?.activity)
        ? data.activity
        : Array.isArray(data?.caseActivity)
          ? data.caseActivity
          : Array.isArray(data?.data)
            ? data.data
            : [];

  return [...items]
    .map((item, index) => ({
      ...item,
      id: item.id || item.activity_id || index,
      activityType:
        item.activity_type ||
        item.activityType ||
        item.type ||
        "update",
      message:
        item.message ||
        item.description ||
        item.activity_message ||
        "Case updated",
      createdAt:
        item.created_at ||
        item.createdAt ||
        item.timestamp ||
        item.date ||
        null,
    }))
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
}

function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === "") {
    return "Size unavailable";
  }

  const size = Number(bytes);

  if (!Number.isFinite(size) || size < 0) {
    return "Size unavailable";
  }

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function isImageFile(file) {
  const type = String(file.fileType || "").toLowerCase();
  const name = String(file.fileName || "").toLowerCase();

  return (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name) ||
    /^data:image\//i.test(file.dataUrl)
  );
}

function isPdfFile(file) {
  const type = String(file.fileType || "").toLowerCase();
  const name = String(file.fileName || "").toLowerCase();

  return type.includes("pdf") || name.endsWith(".pdf");
}

function getSafeFilename(name) {
  return String(name || "evidence")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim() || "evidence";
}

/*
 * Convert data URLs into Blob URLs so that images and PDFs can be
 * displayed reliably without trying to navigate to a huge data URL.
 * Normal HTTP(S) URLs are returned unchanged.
 */
async function makePreviewUrl(file) {
  const url = file.dataUrl;

  if (!url) {
    throw new Error("This evidence has no accessible file URL.");
  }

  if (/^blob:/i.test(url) || /^https?:\/\//i.test(url)) {
    return { url, revoke: false };
  }

  if (/^data:/i.test(url)) {
    const response = await fetch(url);
    const blob = await response.blob();
    return {
      url: URL.createObjectURL(blob),
      revoke: true,
    };
  }

  if (/^\/\//.test(url)) {
    return { url: `${window.location.protocol}${url}`, revoke: false };
  }

  if (url.startsWith("/")) {
    return { url: `${(import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "")}${url}`, revoke: false };
  }

  return { url, revoke: false };
}

function getEvidenceTypeLabel(file) {
  if (isImageFile(file)) return "Image";
  if (isPdfFile(file)) return "PDF";
  return file.fileType || "Attachment";
}

function getStaffName(staff) {
  return (
    staff?.fullName ||
    staff?.full_name ||
    staff?.name ||
    staff?.email ||
    "Staff member"
  );
}

function StaffDashboard() {
  const navigate = useNavigate();

  const [staff, setStaff] = useState(() => getStoredStaff());
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [activity, setActivity] = useState([]);
  const [responseText, setResponseText] = useState("");
  const [statusValue, setStatusValue] = useState("Received");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem("responsehub_staff_token");

  function authHeaders(extraHeaders = {}) {
    return {
      ...extraHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function readResponse(response) {
    const text = await response.text();

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function handleUnauthorized() {
    localStorage.removeItem("responsehub_staff_token");
    localStorage.removeItem("responsehub_staff");
    setStaff(null);
    navigate("/staff-login", { replace: true });
  }

  async function loadCases(showLoader = true) {
    if (!localStorage.getItem("responsehub_staff_token")) {
      handleUnauthorized();
      return;
    }

    if (showLoader) setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/staff/cases`, {
        headers: authHeaders(),
      });

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to load assigned cases.")
        );
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.cases)
          ? data.cases
          : Array.isArray(data?.reports)
            ? data.reports
            : Array.isArray(data?.data)
              ? data.data
              : [];

      setCases(list);

      if (selectedCase) {
        const selectedId = getCaseId(selectedCase);
        const refreshed = list.find(
          (item) => String(getCaseId(item)) === String(selectedId)
        );

        if (refreshed) {
          setSelectedCase((current) => ({
            ...current,
            ...refreshed,
          }));
        }
      }
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function loadActivity(caseId) {
    if (!caseId) {
      setActivity([]);
      return;
    }

    setActivityLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/staff/cases/${encodeURIComponent(caseId)}/activity`,
        {
          headers: authHeaders(),
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load case history.")
        );
      }

      setActivity(normalizeActivity(data));
    } catch (err) {
      console.error("Staff case history error:", err);
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }

  async function openCase(item) {
    const caseId = getCaseId(item);

    if (!caseId) {
      setError("This case is missing its case ID.");
      return;
    }

    setSelectedCase({
      ...item,
      evidence: normalizeEvidence(item),
    });
    setStatusValue(getStatus(item));
    setResponseText("");
    setActivity([]);
    setNotice("");
    setError("");
    setPreviewFile(null);
    setPreviewUrl("");
    setDetailsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/staff/cases/${encodeURIComponent(caseId)}`,
        {
          headers: authHeaders(),
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to load case details.")
        );
      }

      const caseData =
        data?.case ||
        data?.report ||
        data?.data?.case ||
        data?.data?.report ||
        data?.data ||
        data;

      const evidence = normalizeEvidence(caseData).length
        ? normalizeEvidence(caseData)
        : normalizeEvidence(item);

      const mergedCase = {
        ...item,
        ...caseData,
        case_id: getCaseId(caseData) || caseId,
        evidence,
      };

      setSelectedCase(mergedCase);
      setStatusValue(getStatus(mergedCase));
      setResponseText(
        mergedCase.organization_response ||
          mergedCase.response ||
          mergedCase.staff_response ||
          ""
      );

      await loadActivity(caseId);
    } catch (err) {
      setError(err.message || "Could not load the selected case.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function updateStatus() {
    if (!selectedCase) return;

    const caseId = getCaseId(selectedCase);

    if (!caseId) {
      setError("Cannot update this case because its case ID is missing.");
      return;
    }

    setUpdatingStatus(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/staff/cases/${encodeURIComponent(caseId)}/status`,
        {
          method: "PUT",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status: statusValue }),
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to update the case status.")
        );
      }

      setSelectedCase((current) =>
        current
          ? {
              ...current,
              status: data?.case?.status || data?.status || statusValue,
            }
          : current
      );

      setNotice("Case status updated successfully.");
      await loadCases(false);
      await loadActivity(caseId);
    } catch (err) {
      setError(err.message || "Could not update the case status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function sendResponse() {
    if (!selectedCase) return;

    const caseId = getCaseId(selectedCase);
    const message = responseText.trim();

    if (!caseId) {
      setError("Cannot respond because this case ID is missing.");
      return;
    }

    if (!message) {
      setError("Please enter a response before submitting.");
      return;
    }

    setSendingResponse(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/staff/cases/${encodeURIComponent(caseId)}/respond`,
        {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ response: message }),
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Failed to submit the response.")
        );
      }

      setSelectedCase((current) =>
        current
          ? {
              ...current,
              organization_response:
                data?.case?.organization_response ||
                data?.organization_response ||
                data?.response ||
                message,
            }
          : current
      );

      setNotice("Your response was submitted successfully.");
      await loadCases(false);
      await loadActivity(caseId);
    } catch (err) {
      setError(err.message || "Could not submit the response.");
    } finally {
      setSendingResponse(false);
    }
  }

  async function openEvidence(file) {
    setPreviewFile(file);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);

    try {
      const result = await makePreviewUrl(file);
      setPreviewUrl(result.url);

      if (result.revoke) {
        setPreviewUrl((current) => current);
        setTemporaryPreviewUrl(result.url);
      } else {
        setTemporaryPreviewUrl("");
      }
    } catch (err) {
      setPreviewError(
        err.message || "Unable to display this evidence file."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  const [temporaryPreviewUrl, setTemporaryPreviewUrl] = useState("");

  useEffect(() => {
    return () => {
      if (temporaryPreviewUrl) {
        URL.revokeObjectURL(temporaryPreviewUrl);
      }
    };
  }, [temporaryPreviewUrl]);

  function closeEvidencePreview() {
    if (temporaryPreviewUrl) {
      URL.revokeObjectURL(temporaryPreviewUrl);
    }

    setTemporaryPreviewUrl("");
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  async function downloadEvidence(file) {
    setDownloadingId(file.id);
    setError("");

    let objectUrl = "";

    try {
      const result = await makePreviewUrl(file);
      let url = result.url;

      if (result.revoke) {
        objectUrl = url;
      }

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getSafeFilename(file.fileName);
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      if (objectUrl) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      }
    } catch (err) {
      setError(err.message || "Unable to download the evidence file.");
    } finally {
      setDownloadingId(null);
    }
  }

  function logout() {
    localStorage.removeItem("responsehub_staff_token");
    localStorage.removeItem("responsehub_staff");
    navigate("/staff-login", { replace: true });
  }

  useEffect(() => {
    const currentToken = localStorage.getItem("responsehub_staff_token");

    if (!currentToken) {
      navigate("/staff-login", { replace: true });
      return;
    }

    setStaff(getStoredStaff());
    loadCases();
    // Initial load only; loadCases uses the current token from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return cases.filter((item) => {
      const caseId = String(getCaseId(item)).toLowerCase();
      const category = String(item.category || "").toLowerCase();
      const location = String(item.location || "").toLowerCase();
      const description = String(item.description || "").toLowerCase();
      const status = getStatus(item).toLowerCase();
      const priority = String(item.priority || "Medium").toLowerCase();

      const matchesSearch =
        !query ||
        caseId.includes(query) ||
        category.includes(query) ||
        location.includes(query) ||
        description.includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        status === statusFilter.toLowerCase();

      const matchesPriority =
        priorityFilter === "All" ||
        priority === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [cases, searchTerm, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    return {
      total: cases.length,
      received: cases.filter(
        (item) => getStatus(item).toLowerCase() === "received"
      ).length,
      inProgress: cases.filter(
        (item) => getStatus(item).toLowerCase() === "in progress"
      ).length,
      resolved: cases.filter(
        (item) => getStatus(item).toLowerCase() === "resolved"
      ).length,
    };
  }, [cases]);

  if (!token) {
    return (
      <div className="staff-dashboard">
        <div className="staff-detail-card">
          <h2>Staff login required</h2>
          <p>Your staff session is missing or has expired.</p>
          <button onClick={() => navigate("/staff-login")}>
            Go to staff login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-dashboard">
      <header className="staff-topbar">
        <div className="staff-brand">
          <div className="staff-brand-mark">R</div>
          <div>
            <h1>ResponseHub</h1>
            <p>Staff Dashboard</p>
          </div>
        </div>

        <div className="staff-topbar-user">
          <div className="staff-user-info">
            <strong>{getStaffName(staff)}</strong>
            <span>{staff?.duty || staff?.role || "Staff member"}</span>
          </div>

          <button
            type="button"
            className="staff-logout-button"
            onClick={logout}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="staff-workspace">
        <section className="staff-page-heading">
          <div>
            <h2>My Assigned Cases</h2>
            <p>Review reports, update progress, and respond to cases.</p>
          </div>

          <button
            type="button"
            onClick={() => loadCases()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh cases"}
          </button>
        </section>

        {notice && (
          <div className="staff-notice staff-notice-success" role="status">
            {notice}
          </div>
        )}

        {error && (
          <div className="staff-notice staff-notice-error" role="alert">
            {error}
            <button type="button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}

        <section className="staff-stats-grid">
          <div className="staff-stat-card">
            <span>Total assigned</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="staff-stat-card">
            <span>Received</span>
            <strong>{stats.received}</strong>
          </div>
          <div className="staff-stat-card">
            <span>In progress</span>
            <strong>{stats.inProgress}</strong>
          </div>
          <div className="staff-stat-card">
            <span>Resolved</span>
            <strong>{stats.resolved}</strong>
          </div>
        </section>

        <section className="staff-case-layout">
          <aside className="staff-case-list">
            <div className="staff-list-heading">
              <h3>Assigned reports</h3>
              <span>{filteredCases.length}</span>
            </div>

            <div className="staff-filters">
              <input
                type="search"
                placeholder="Search case, category, location..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search assigned cases"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="All">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                aria-label="Filter by priority"
              >
                <option value="All">All priorities</option>
                <option value="Low">Low priority</option>
                <option value="Medium">Medium priority</option>
                <option value="High">High priority</option>
                <option value="Urgent">Urgent priority</option>
              </select>
            </div>

            {loading ? (
              <div className="staff-empty-state">Loading assigned cases...</div>
            ) : filteredCases.length === 0 ? (
              <div className="staff-empty-state">
                <h4>No cases found</h4>
                <p>
                  Assigned cases will appear here. Try changing your filters
                  or refreshing the list.
                </p>
              </div>
            ) : (
              <div className="staff-case-items">
                {filteredCases.map((item, index) => {
                  const caseId = getCaseId(item);
                  const selectedId = getCaseId(selectedCase);
                  const isSelected =
                    selectedCase &&
                    String(caseId) === String(selectedId);

                  return (
                    <button
                      type="button"
                      key={caseId || item.id || index}
                      className={`staff-case-item ${
                        isSelected ? "active" : ""
                      }`}
                      onClick={() => openCase(item)}
                    >
                      <div className="staff-case-item-top">
                        <strong>{caseId || "Case ID unavailable"}</strong>
                        <span
                          className={`staff-status-badge ${getStatus(item)
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {getStatus(item)}
                        </span>
                      </div>

                      <h4>{item.category || "General report"}</h4>

                      <p>{item.location || "Location not provided"}</p>

                      <div className="staff-case-item-bottom">
                        <span>
                          Priority: {item.priority || "Medium"}
                        </span>
                        <span>
                          {formatDate(
                            item.submitted_at ||
                              item.submittedAt ||
                              item.created_at
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="staff-case-details">
            {!selectedCase ? (
              <div className="staff-detail-card staff-select-prompt">
                <div className="staff-select-icon">📋</div>
                <h3>Select a case</h3>
                <p>
                  Choose a case from the list to view its details, evidence,
                  activity history, and response controls.
                </p>
              </div>
            ) : (
              <>
                <div className="staff-detail-card">
                  <div className="staff-detail-header">
                    <div>
                      <span className="staff-detail-eyebrow">Case details</span>
                      <h2>{getCaseId(selectedCase)}</h2>
                    </div>

                    <span
                      className={`staff-status-badge ${getStatus(selectedCase)
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {getStatus(selectedCase)}
                    </span>
                  </div>

                  {detailsLoading && (
                    <p className="staff-inline-loading">
                      Refreshing case details...
                    </p>
                  )}

                  <div className="staff-detail-grid">
                    <div>
                      <span>Category</span>
                      <strong>
                        {selectedCase.category || "Not provided"}
                      </strong>
                    </div>

                    <div>
                      <span>Location</span>
                      <strong>
                        {selectedCase.location || "Not provided"}
                      </strong>
                    </div>

                    <div>
                      <span>Priority</span>
                      <strong>
                        {selectedCase.priority || "Medium"}
                      </strong>
                    </div>

                    <div>
                      <span>Submitted</span>
                      <strong>
                        {formatDate(
                          selectedCase.submitted_at ||
                            selectedCase.submittedAt ||
                            selectedCase.created_at
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="staff-case-description">
                    <h3>Report description</h3>
                    <p>
                      {selectedCase.description ||
                        "No description was provided."}
                    </p>
                  </div>

                  {selectedCase.organization_response && (
                    <div className="staff-existing-response">
                      <h3>Latest organization response</h3>
                      <p>{selectedCase.organization_response}</p>

                      {selectedCase.response_at && (
                        <small>
                          {formatDate(selectedCase.response_at)}
                        </small>
                      )}
                    </div>
                  )}
                </div>

                <div className="staff-detail-card">
                  <div className="staff-section-heading">
                    <div>
                      <h3>Evidence and attachments</h3>
                      <p>View supported files or download them.</p>
                    </div>
                    <span>
                      {normalizeEvidence(selectedCase).length} file(s)
                    </span>
                  </div>

                  {normalizeEvidence(selectedCase).length === 0 ? (
                    <div className="staff-empty-state staff-empty-compact">
                      No evidence attached to this case.
                    </div>
                  ) : (
                    <div className="staff-evidence-list">
                      {normalizeEvidence(selectedCase).map((file) => (
                        <div
                          className="staff-evidence-item"
                          key={file.id}
                        >
                          <div className="staff-evidence-preview">
                            {isImageFile(file) ? (
                              <img
                                src={file.dataUrl}
                                alt={file.fileName}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="staff-evidence-file-icon">
                                {isPdfFile(file) ? "PDF" : "FILE"}
                              </span>
                            )}
                          </div>

                          <div className="staff-evidence-info">
                            <strong>{file.fileName}</strong>
                            <span>
                              {getEvidenceTypeLabel(file)} ·{" "}
                              {formatFileSize(file.fileSize)}
                            </span>
                          </div>

                          <div className="staff-evidence-actions">
                            <button
                              type="button"
                              onClick={() => openEvidence(file)}
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadEvidence(file)}
                              disabled={downloadingId === file.id}
                            >
                              {downloadingId === file.id
                                ? "Preparing..."
                                : "Download"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="staff-detail-card">
                  <div className="staff-section-heading">
                    <div>
                      <h3>Update case status</h3>
                      <p>Keep the case progress up to date.</p>
                    </div>
                  </div>

                  <div className="staff-status-controls">
                    <select
                      value={statusValue}
                      onChange={(event) => setStatusValue(event.target.value)}
                      aria-label="Select new case status"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={updateStatus}
                      disabled={
                        updatingStatus ||
                        statusValue === getStatus(selectedCase)
                      }
                    >
                      {updatingStatus ? "Updating..." : "Save status"}
                    </button>
                  </div>
                </div>

                <div className="staff-detail-card">
                  <div className="staff-section-heading">
                    <div>
                      <h3>Respond to case</h3>
                      <p>
                        Submit a progress update or response for the case.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={responseText}
                    onChange={(event) => setResponseText(event.target.value)}
                    placeholder="Write your response or progress update..."
                    rows={5}
                  />

                  <div className="staff-response-actions">
                    <button
                      type="button"
                      onClick={sendResponse}
                      disabled={sendingResponse || !responseText.trim()}
                    >
                      {sendingResponse ? "Sending..." : "Submit response"}
                    </button>
                  </div>
                </div>

                <div className="staff-detail-card">
                  <div className="staff-section-heading">
                    <div>
                      <h3>Case activity history</h3>
                      <p>Recorded updates for this case.</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadActivity(getCaseId(selectedCase))}
                      disabled={activityLoading}
                    >
                      {activityLoading ? "Loading..." : "Refresh history"}
                    </button>
                  </div>

                  {activityLoading ? (
                    <div className="staff-empty-state staff-empty-compact">
                      Loading case history...
                    </div>
                  ) : activity.length === 0 ? (
                    <div className="staff-empty-state staff-empty-compact">
                      No additional activity recorded yet.
                    </div>
                  ) : (
                    <div className="staff-case-activity">
                      {activity.map((item, index) => (
                        <div
                          className="staff-activity-item"
                          key={item.id ?? index}
                        >
                          <div className="staff-activity-marker" />

                          <div className="staff-activity-content">
                            <div className="staff-activity-heading">
                              <strong>
                                {String(item.activityType)
                                  .replace(/[_-]+/g, " ")
                                  .replace(/\b\w/g, (letter) =>
                                    letter.toUpperCase()
                                  )}
                              </strong>

                              <time>{formatDate(item.createdAt)}</time>
                            </div>

                            <p>{item.message}</p>

                            {item.old_value &&
                              item.new_value &&
                              item.old_value !== item.new_value && (
                                <small>
                                  Changed from {item.old_value} to{" "}
                                  {item.new_value}
                                </small>
                              )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </section>
      </main>

      {previewFile && (
        <div
          className="staff-evidence-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeEvidencePreview();
            }
          }}
        >
          <div
            className="staff-evidence-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Evidence preview: ${previewFile.fileName}`}
          >
            <div className="staff-evidence-modal-header">
              <div>
                <h3>{previewFile.fileName}</h3>
                <p>
                  {getEvidenceTypeLabel(previewFile)} ·{" "}
                  {formatFileSize(previewFile.fileSize)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEvidencePreview}
                aria-label="Close evidence preview"
              >
                ✕
              </button>
            </div>

            <div className="staff-evidence-modal-body">
              {previewLoading ? (
                <p>Loading evidence preview...</p>
              ) : previewError ? (
                <div className="staff-empty-state">
                  <p>{previewError}</p>
                  <p>
                    Try downloading the file and opening it on your device.
                  </p>
                </div>
              ) : previewUrl && isImageFile(previewFile) ? (
                <img
                  className="staff-evidence-full-image"
                  src={previewUrl}
                  alt={previewFile.fileName}
                  onError={() =>
                    setPreviewError("This image could not be displayed.")
                  }
                />
              ) : previewUrl && isPdfFile(previewFile) ? (
                <iframe
                  className="staff-evidence-pdf-frame"
                  src={previewUrl}
                  title={previewFile.fileName}
                />
              ) : previewUrl ? (
                <div className="staff-evidence-unsupported">
                  <p>
                    Preview is not available for this file type. Download it
                    to view it on your device.
                  </p>

                  <button
                    type="button"
                    onClick={() => downloadEvidence(previewFile)}
                  >
                    Download file
                  </button>
                </div>
              ) : null}
            </div>

            <div className="staff-evidence-modal-footer">
              <button
                type="button"
                onClick={() => downloadEvidence(previewFile)}
                disabled={downloadingId === previewFile.id}
              >
                {downloadingId === previewFile.id
                  ? "Preparing download..."
                  : "Download evidence"}
              </button>

              <button type="button" onClick={closeEvidencePreview}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffDashboard;