import "./Pages.css";
import "./App.css";

import { Routes, Route } from "react-router-dom";

import Report from "./Report.jsx";
import Track from "./Track.jsx";
import Organization from "./Organization";
import OrganizationLogin from "./OrganizationLogin";
import OrganizationRegister from "./OrganizationRegister";
import StaffDashboard from "./StaffDashboard";
import StaffLogin from "./StaffLogin";

function App() {
  const goTo = (path) => {
    window.location.href = path;
  };

  return (
    <div className="app">

      {/* ================= NAVIGATION ================= */}

      <nav className="navbar">

        <div
          className="logo"
          onClick={() => goTo("/")}
        >
          <span>R</span>
          ResponseHub
        </div>

        <div className="nav-links">

          <a href="#how-it-works">
            How It Works
          </a>

          <a href="#organizations">
            Organizations
          </a>

          <a href="#about">
            About
          </a>

          <button
            className="login-btn"
            onClick={() =>
              goTo("/organization-login")
            }
          >
            Login
          </button>

          <button
            className="report-btn"
            onClick={() => goTo("/report")}
          >
            Report an Issue
          </button>

        </div>

      </nav>


      {/* ================= HERO ================= */}

      <section className="hero">

        <div className="hero-content">

          <div className="badge">
            <span>●</span>{" "}
            CONNECTING PEOPLE TO SOLUTIONS
          </div>

          <h1>
            Report it.
            <br />
            <span>Track it.</span>
            <br />
            Resolve it.
          </h1>

          <p>
            ResponseHub gives citizens a simple way
            to report problems, connect with the right
            organization, track progress and receive
            meaningful feedback.
          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={() => goTo("/report")}
            >
              Report an Issue →
            </button>

            <button
              className="secondary-btn"
              onClick={() => goTo("/track")}
            >
              Track My Case
            </button>

          </div>

          <div className="trust-text">
            <span>✓ Verified reports</span>
            <span>✓ Case tracking</span>
            <span>✓ Transparent communication</span>
          </div>

        </div>


        {/* ================= LIVE CASE PREVIEW ================= */}

        <div className="case-preview">

          <div className="case-preview-label">
            LIVE CASE PREVIEW
          </div>

          <div className="case-top">

            <div>
              <small>CASE NUMBER</small>
              <h3>RH-2026-004821</h3>
            </div>

            <div className="status">
              IN PROGRESS
            </div>

          </div>

          <div className="case-line"></div>

          <div className="case-info">

            <div>
              <small>REPORT</small>
              <strong>
                Water supply interruption
              </strong>
            </div>

            <div>
              <small>DEPARTMENT</small>
              <strong>
                Technical Services
              </strong>
            </div>

            <div>
              <small>LOCATION</small>
              <strong>
                Nakuru, Kenya
              </strong>
            </div>

          </div>


          <div className="timeline">

            <div className="timeline-item active">

              <div className="dot"></div>

              <div>
                <strong>Report received</strong>
                <small>Today, 10:42 AM</small>
              </div>

            </div>


            <div className="timeline-item active">

              <div className="dot"></div>

              <div>
                <strong>
                  Assigned to department
                </strong>
                <small>Today, 10:45 AM</small>
              </div>

            </div>


            <div className="timeline-item">

              <div className="dot"></div>

              <div>
                <strong>
                  Investigation in progress
                </strong>
                <small>Awaiting update</small>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ================= STATS ================= */}

      <section className="stats">

        <div className="stat-item">
          <h2>1 Platform</h2>
          <p>For reporting and resolution</p>
        </div>

        <div className="stat-item">
          <h2>Multiple</h2>
          <p>Organizations & departments</p>
        </div>

        <div className="stat-item">
          <h2>Real-time</h2>
          <p>Communication & updates</p>
        </div>

        <div className="stat-item">
          <h2>1 Case ID</h2>
          <p>For every report</p>
        </div>

      </section>


      {/* ================= HOW IT WORKS ================= */}

      <section
        className="how-section"
        id="how-it-works"
      >

        <div className="section-heading">

          <span>HOW IT WORKS</span>

          <h2>
            From problem to solution.
          </h2>

          <p>
            A simple reporting process designed to
            connect you with the people responsible
            for solving the problem.
          </p>

        </div>


        <div className="steps">

          <div className="step">

            <div className="step-number">
              01
            </div>

            <h3>
              Submit a Report
            </h3>

            <p>
              Tell us what happened and provide the
              information needed to understand the issue.
            </p>

          </div>


          <div className="step">

            <div className="step-number">
              02
            </div>

            <h3>
              Route the Case
            </h3>

            <p>
              Your report can be directed to the
              appropriate organization and responsible
              department.
            </p>

          </div>


          <div className="step">

            <div className="step-number">
              03
            </div>

            <h3>
              Track Progress
            </h3>

            <p>
              Use your unique case number to follow
              the progress of your report.
            </p>

          </div>


          <div className="step">

            <div className="step-number">
              04
            </div>

            <h3>
              Get Feedback
            </h3>

            <p>
              Receive responses and updates from the
              responsible organization.
            </p>

          </div>

        </div>

      </section>


      {/* ================= CITIZENS SECTION ================= */}

      <section className="citizen-section">

        <div className="citizen-card">

          <div className="citizen-content">

            <span>FOR CITIZENS</span>

            <h2>
              Your report should
              <br />
              <strong>
                never disappear.
              </strong>
            </h2>

            <p>
              Every report receives a unique case
              number that allows you to follow its
              progress from submission to response.
            </p>


            <div className="citizen-features">

              <div>
                <span>01</span>
                <strong>Unique Case ID</strong>
                <p>
                  Keep your case number and use it
                  to track progress.
                </p>
              </div>

              <div>
                <span>02</span>
                <strong>Progress Updates</strong>
                <p>
                  See important changes made to
                  your report.
                </p>
              </div>

              <div>
                <span>03</span>
                <strong>Organization Response</strong>
                <p>
                  Receive feedback directly through
                  your case.
                </p>
              </div>

            </div>


            <button
              className="primary-btn"
              onClick={() => goTo("/report")}
            >
              Submit a Report →
            </button>

          </div>

        </div>

      </section>


      {/* ================= ORGANIZATIONS ================= */}

      <section
        className="organization-section"
        id="organizations"
      >

        <div className="organization-content">

          <span>FOR ORGANIZATIONS</span>

          <h2>
            Turn complaints into
            <br />
            <strong>
              actionable cases.
            </strong>
          </h2>

          <p>
            Give your organization a central place
            to receive, manage, assign and resolve
            issues from customers, employees and
            the public.
          </p>


          <div className="organization-benefits">

            <div>
              <strong>✓</strong>
              <span>
                Centralized case management
              </span>
            </div>

            <div>
              <strong>✓</strong>
              <span>
                Department & staff assignment
              </span>
            </div>

            <div>
              <strong>✓</strong>
              <span>
                Priority & status management
              </span>
            </div>

            <div>
              <strong>✓</strong>
              <span>
                Direct citizen responses
              </span>
            </div>

          </div>


          <button
            className="primary-btn"
            onClick={() =>
              goTo("/organization-login")
            }
          >
            Organization Portal →
          </button>

        </div>


        {/* ================= DASHBOARD PREVIEW ================= */}

        <div className="dashboard-card">

          <div className="dashboard-header">

            <div>
              <small>RESPONSEHUB</small>
              <strong>
                Organization Dashboard
              </strong>
            </div>

            <span>● Online</span>

          </div>


          <div className="dashboard-stats">

            <div>
              <small>NEW CASES</small>
              <strong>24</strong>
            </div>

            <div>
              <small>IN PROGRESS</small>
              <strong>18</strong>
            </div>

            <div>
              <small>RESOLVED</small>
              <strong>126</strong>
            </div>

          </div>


          <div className="mini-case">

            <div>

              <span className="priority">
                HIGH
              </span>

              <strong>
                Power outage report
              </strong>

              <small>
                RH-2026-004823
              </small>

            </div>

            <span className="mini-status">
              In Progress
            </span>

          </div>


          <div className="mini-case">

            <div>

              <span className="normal">
                NORMAL
              </span>

              <strong>
                Service complaint
              </strong>

              <small>
                RH-2026-004822
              </small>

            </div>

            <span className="mini-status resolved">
              Resolved
            </span>

          </div>


          <div className="dashboard-footer">
            <span>Case management</span>
            <span>View all cases →</span>
          </div>

        </div>

      </section>


      {/* ================= STAFF PORTAL ================= */}

      <section className="staff-section">

        <div className="staff-card">

          <div>

            <span>FOR STAFF</span>

            <h2>
              Put every assigned case
              <br />
              <strong>
                in the right hands.
              </strong>
            </h2>

            <p>
              Staff members can access assigned
              cases, update progress, communicate
              responses and keep private internal notes.
            </p>

          </div>

          <button
            className="secondary-btn"
            onClick={() => goTo("/staff-login")}
          >
            Staff Login →
          </button>

        </div>

      </section>


      {/* ================= FINAL CTA ================= */}

      <section className="final-cta">

        <div>

          <span>
            READY TO MAKE A REPORT?
          </span>

          <h2>
            Don't just report a problem.
            <br />
            <strong>
              Follow it to resolution.
            </strong>
          </h2>

          <p>
            Submit your issue today and receive a
            unique case number you can use to track
            its progress.
          </p>


          <div className="cta-buttons">

            <button
              className="primary-btn"
              onClick={() => goTo("/report")}
            >
              Report an Issue →
            </button>

            <button
              className="secondary-btn"
              onClick={() => goTo("/track")}
            >
              Track Existing Case
            </button>

          </div>

        </div>

      </section>


      {/* ================= FOOTER ================= */}

      <footer id="about">

        <div className="footer-top">

          <div>

            <div className="footer-logo">
              <span>R</span>
              ResponseHub
            </div>

            <p>
              Report problems. Track progress.
              Get solutions.
            </p>

          </div>


          <div className="footer-links">

            <div>

              <strong>Platform</strong>

              <a href="#how-it-works">
                How It Works
              </a>

              <a href="/report">
                Report an Issue
              </a>

              <a href="/track">
                Track a Case
              </a>

            </div>


            <div>

              <strong>Organizations</strong>

              <a href="/organization-login">
                Organization Login
              </a>

              <a href="/organization-register">
                Register Organization
              </a>

            </div>


            <div>

              <strong>Staff</strong>

              <a href="/staff-login">
                Staff Login
              </a>

            </div>

          </div>

        </div>


        <div className="footer-bottom">

          <small>
            © 2026 ResponseHub. All rights reserved.
          </small>

          <small>
            A platform for reporting, tracking and
            resolving issues.
          </small>

        </div>

      </footer>

    </div>
  );
}


function AppRouter() {
  return (
    <Routes>

      <Route
        path="/"
        element={<App />}
      />

      <Route
        path="/report"
        element={<Report />}
      />

      <Route
        path="/track"
        element={<Track />}
      />

      <Route
        path="/organization-login"
        element={<OrganizationLogin />}
      />

      <Route
        path="/organization"
        element={<Organization />}
      />

      <Route
        path="/staff"
        element={<StaffDashboard />}
      />

      <Route
        path="/organization-register"
        element={<OrganizationRegister />}
      />

      <Route
        path="/staff-login"
        element={<StaffLogin />}
      />

    </Routes>
  );
}

export default AppRouter;