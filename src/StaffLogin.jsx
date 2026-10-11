import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./StaffLogin.css";

const API_URL = "http://localhost:5000/api";

function StaffLogin() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      // Remove stale staff credentials before attempting login.
      localStorage.removeItem("responsehub_staff_token");
      localStorage.removeItem("responsehub_staff");
      localStorage.removeItem("responsehub_staff_logged_in");

      const response = await fetch(`${API_URL}/staff/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Staff login failed.");
      }

      if (
        typeof data.token !== "string" ||
        !data.token.trim() ||
        !data.staff ||
        !data.staff.id
      ) {
        throw new Error(
          "Login succeeded without valid staff session details. Please try again."
        );
      }

      // Save the newly issued session.
      localStorage.setItem("responsehub_staff_token", data.token);
      localStorage.setItem(
        "responsehub_staff",
        JSON.stringify(data.staff)
      );
      localStorage.setItem("responsehub_staff_logged_in", "true");

      // Verify that the token was actually saved.
      const savedToken = localStorage.getItem(
        "responsehub_staff_token"
      );

      if (savedToken !== data.token) {
        localStorage.removeItem("responsehub_staff_token");
        localStorage.removeItem("responsehub_staff");
        localStorage.removeItem("responsehub_staff_logged_in");

        throw new Error(
          "Could not save your staff session. Please try again."
        );
      }

      navigate("/staff", { replace: true });
    } catch (error) {
      console.error("Staff login error:", error);

      setError(
        error.message ||
          "Unable to connect to the ResponseHub server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="staff-login-page">
      <div className="staff-login-container">
        <div className="staff-login-brand">
          <div className="staff-login-logo">R</div>

          <div>
            <h2>ResponseHub</h2>
            <p>Staff Portal</p>
          </div>
        </div>

        <div className="staff-login-card">
          <div className="staff-login-header">
            <h1>Staff Sign In</h1>

            <p>
              Sign in to access your organization's assigned cases.
            </p>
          </div>

          {error && (
            <div className="staff-login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="staff-form-group">
              <label htmlFor="staffEmail">Email Address</label>

              <input
                id="staffEmail"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="staff@example.com"
                autoComplete="username"
                required
                disabled={loading}
              />
            </div>

            <div className="staff-form-group">
              <label htmlFor="staffPassword">Password</label>

              <div className="password-input-wrapper">
                <input
                  id="staffPassword"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
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
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="staff-login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="staff-login-footer">
            <button
              type="button"
              onClick={() => navigate("/organization-login")}
              className="staff-back-button"
              disabled={loading}
            >
              ← Organization Login
            </button>
          </div>
        </div>

        <p className="staff-login-security">
          Secure ResponseHub staff access
        </p>
      </div>
    </div>
  );
}

export default StaffLogin;