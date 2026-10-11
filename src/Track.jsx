import React, {
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import "./Pages.css";
import "./Track.css";

const API_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

function Track() {
  const [searchParams] =
    useSearchParams();

  const [caseNumber, setCaseNumber] =
    useState(
      searchParams.get("case") || ""
    );

  const [report, setReport] =
    useState(null);

  const [activities, setActivities] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "";
    }

    const date = new Date(
      dateValue
    );

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  };

  // =====================================================
  // FORMAT FILE SIZE
  // =====================================================

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) {
      return "Unknown size";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  };

  // =====================================================
  // FETCH CASE
  // =====================================================

  const fetchCase = async (caseId) => {
    const cleanCaseId =
      caseId.trim().toUpperCase();

    if (!cleanCaseId) {
      setError(
        "Please enter a Case ID."
      );
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);
    setActivities([]);

    try {
      // =================================================
      // GET REPORT
      // =================================================

      const response =
        await fetch(
          `${API_URL}/reports/${encodeURIComponent(
            cleanCaseId
          )}`
        );

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Case not found."
        );
      }

      const foundReport =
        data.report || data;

      setReport(foundReport);

      // =================================================
      // GET PUBLIC ACTIVITY
      // =================================================

      try {
        const activityResponse =
          await fetch(
            `${API_URL}/reports/${encodeURIComponent(
              cleanCaseId
            )}/activity`
          );

        if (activityResponse.ok) {
          const activityData =
            await activityResponse.json();

          const rawActivities =
            Array.isArray(
              activityData
            )
              ? activityData
              : activityData.activities ||
                activityData.activity ||
                activityData.caseActivity ||
                activityData.data ||
                [];

          const normalizedActivities =
            rawActivities.map(
              (activity) => {
                const activityType =
                  activity.activity_type ||
                  activity.activityType ||
                  activity.type ||
                  "";

                const message =
                  activity.message ||
                  activity.description ||
                  "";

                const createdAt =
                  activity.created_at ||
                  activity.createdAt ||
                  activity.timestamp ||
                  activity.time ||
                  null;

                let finalMessage =
                  message;

                if (
                  !finalMessage &&
                  activity.new_value
                ) {
                  if (
                    activityType ===
                      "status" ||
                    activityType ===
                      "status_change"
                  ) {
                    finalMessage =
                      `Status changed to ${activity.new_value}`;
                  } else if (
                    activityType ===
                      "priority" ||
                    activityType ===
                      "priority_change"
                  ) {
                    finalMessage =
                      `Priority changed to ${activity.new_value}`;
                  } else {
                    finalMessage =
                      activity.new_value;
                  }
                }

                return {
                  ...activity,

                  id:
                    activity.id ||
                    `${activityType}-${createdAt}-${Math.random()}`,

                  activityType,

                  message:
                    finalMessage ||
                    "Case updated.",

                  createdAt,
                };
              }
            );

          normalizedActivities.sort(
            (a, b) => {
              const aTime =
                new Date(
                  a.createdAt || 0
                ).getTime();

              const bTime =
                new Date(
                  b.createdAt || 0
                ).getTime();

              return (
                aTime - bTime
              );
            }
          );

          setActivities(
            normalizedActivities
          );
        }
      } catch (activityError) {
        console.error(
          "Failed to load case activity:",
          activityError
        );

        setActivities([]);
      }
    } catch (error) {
      console.error(
        "Track case error:",
        error
      );

      setError(
        error.message ||
          "Unable to retrieve this case."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // AUTO LOAD FROM URL
  // =====================================================

  useEffect(() => {
    const caseFromUrl =
      searchParams.get("case");

    if (caseFromUrl) {
      setCaseNumber(
        caseFromUrl
      );

      fetchCase(caseFromUrl);
    }
  }, [searchParams]);

  // =====================================================
  // SEARCH
  // =====================================================

  const handleSearch = (e) => {
    e.preventDefault();

    fetchCase(caseNumber);
  };

  // =====================================================
  // ACTIVITY TITLE
  // =====================================================

  const getActivityTitle = (
    activity
  ) => {
    const type =
      activity.activityType ||
      activity.activity_type ||
      activity.type ||
      "";

    switch (
      type.toLowerCase()
    ) {
      case "status":
      case "status_change":
        return "Status Updated";

      case "priority":
      case "priority_change":
        return "Priority Updated";

      case "response":
      case "organization_response":
        return "Organization Response";

      case "assignment":
      case "staff_assignment":
        return "Staff Assignment";

      case "department":
      case "department_assignment":
        return "Department Updated";

      case "submission":
      case "report":
      case "created":
      case "received":
        return "Report Received";

      default:
        return "Case Update";
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="track-page">
      <div className="track-container">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="track-header">
          <h1>
            Public Case Tracking
          </h1>

          <p>
            Track your report.
            Stay informed.
          </p>
        </div>

        {/* =================================================
            SEARCH
        ================================================= */}

        <form
          className="track-search-form"
          onSubmit={handleSearch}
        >
          <input
            type="text"
            value={caseNumber}
            onChange={(e) =>
              setCaseNumber(
                e.target.value
              )
            }
            placeholder="Enter your Case ID e.g. RH-2026-463711"
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Searching..."
              : "Track Case"}
          </button>
        </form>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="track-error">
            {error}
          </div>
        )}

        {/* =================================================
            REPORT
        ================================================= */}

        {report && (
          <div className="track-result">

            {/* =================================================
                CASE SUMMARY
            ================================================= */}

            <div className="case-summary">

              <div className="case-summary-heading">
                <div>
                  <span>
                    CASE ID
                  </span>

                  <h2>
                    #{report.case_id ||
                      report.caseId}
                  </h2>
                </div>

                {/* ORGANIZATION */}

                <div className="track-organization">
                  <span>
                    ORGANIZATION
                  </span>

                  <strong>
                    {report.organization_name ||
                      report.organizationName ||
                      "Organization assigned"}
                  </strong>
                </div>
              </div>

              <div className="case-summary-grid">

                <div>
                  <span>
                    STATUS
                  </span>

                  <strong>
                    {report.status ||
                      "Received"}
                  </strong>
                </div>

                <div>
                  <span>
                    PRIORITY
                  </span>

                  <strong>
                    {report.priority ||
                      "Medium"}
                  </strong>
                </div>

                <div>
                  <span>
                    CATEGORY
                  </span>

                  <strong>
                    {report.category ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    LOCATION
                  </span>

                  <strong>
                    {report.location ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    SUBMITTED
                  </span>

                  <strong>
                    {formatDate(
                      report.submitted_at ||
                        report.submittedAt
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    LAST UPDATED
                  </span>

                  <strong>
                    {formatDate(
                      report.updated_at ||
                        report.updatedAt
                    )}
                  </strong>
                </div>

              </div>
            </div>

            {/* =================================================
                REPORT DESCRIPTION
            ================================================= */}

            {report.description && (
              <div className="case-description">
                <h3>
                  Report Description
                </h3>

                <p>
                  {report.description}
                </p>
              </div>
            )}

            {/* =================================================
                ORGANIZATION RESPONSE
            ================================================= */}

            {report.organization_response && (
              <div className="organization-response">
                <h3>
                  Organization Response
                </h3>

                <p>
                  {
                    report.organization_response
                  }
                </p>

                {report.response_at && (
                  <span>
                    {formatDate(
                      report.response_at
                    )}
                  </span>
                )}
              </div>
            )}

            {/* =================================================
                PUBLIC INFORMATION NOTICE
            ================================================= */}

            <div className="track-public-notice">
              <strong>
                Public Case Information
              </strong>

              <p>
                This page shows public
                information about your
                report. Private contact,
                staff assignment and
                internal organization
                information are protected.
              </p>
            </div>

            {/* =================================================
                EVIDENCE
            ================================================= */}

            {Array.isArray(
              report.evidence
            ) &&
              report.evidence.length >
                0 && (
                <div className="case-evidence">
                  <h3>
                    Evidence
                  </h3>

                  <p>
                    Evidence attached
                    to this report.
                  </p>

                  <div className="case-evidence-list">
                    {report.evidence.map(
                      (file) => {
                        const isImage =
                          file.type?.startsWith(
                            "image/"
                          );

                        return (
                          <div
                            className="case-evidence-item"
                            key={
                              file.id
                            }
                          >
                            {isImage ? (
                              <a
                                href={
                                  file.dataUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={
                                    file.dataUrl
                                  }
                                  alt={
                                    file.name
                                  }
                                />
                              </a>
                            ) : (
                              <div className="case-evidence-file-icon">
                                PDF
                              </div>
                            )}

                            <div className="case-evidence-info">
                              <strong>
                                {file.name}
                              </strong>

                              <span>
                                {formatFileSize(
                                  file.size
                                )}
                              </span>

                              <a
                                href={
                                  file.dataUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Evidence
                              </a>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

            {/* =================================================
                CASE HISTORY
            ================================================= */}

            <div className="case-timeline">
              <h3>
                Case History
              </h3>

              {activities.length ===
              0 ? (
                <p>
                  No additional activity
                  recorded yet.
                </p>
              ) : (
                <div>
                  {activities.map(
                    (activity) => (
                      <div
                        key={
                          activity.id
                        }
                        className="timeline-item"
                      >
                        <strong>
                          {getActivityTitle(
                            activity
                          )}
                        </strong>

                        <p>
                          {
                            activity.message
                          }
                        </p>

                        <span>
                          {formatDate(
                            activity.createdAt
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default Track;