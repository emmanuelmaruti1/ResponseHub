
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export default function OrganizationLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/organizations/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.message ||
            data.error ||
            "Login failed. Check your email and password."
        );
        return;
      }

      const token = data.token || data.accessToken;
      const organization =
        data.organization || data.org || data.user;

      if (!token || !organization) {
        setError(
          "The server response is incomplete. Please try again."
        );
        return;
      }

      localStorage.setItem("responsehub_token", token);
      localStorage.setItem(
        "responsehub_organization",
        JSON.stringify(organization)
      );
      localStorage.setItem("responsehub_logged_in", "true");

      navigate("/organization");
    } catch (err) {
      setError(
        "Unable to connect to ResponseHub. Check that the server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>ResponseHub</h1>
          <h2>Organization Login</h2>
          <p>Sign in to manage your organization's cases.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="organization-email">Email address</label>
            <input
              id="organization-email"
              type="email"
              autoComplete="username"
              placeholder="Enter your organization email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="organization-password">Password</label>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%",
              }}
            >
              <input
                id="organization-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  paddingRight: "48px",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "10px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "5px",
                  color: "inherit",
                }}
              >
                {showPassword ? (
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.1-2.3 3.2" />
                    <path d="M6.2 6.2C3.9 7.7 2.8 9.6 2.5 12c.5 1.2 1.5 2.7 3.4 4.1A10.5 10.5 0 0012 19c1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              style={{
                color: "#c62828",
                fontSize: "14px",
                margin: "10px 0",
              }}
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: "18px", textAlign: "center" }}>
          Don't have an organization account?{" "}
          <Link to="/organization-register">Register here</Link>
        </p>
      </div>
    </div>
  );
}
