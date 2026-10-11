import "./OrganizationRegister.css";
import { useState } from "react";

const API_URL = "http://localhost:5000/api";

function OrganizationRegister() {
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !organizationName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !organizationType ||
      !password
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const cleanName = organizationName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/organizations/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            password,
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Organization registration failed."
        );
      }

      const registeredOrganization = data.organization || data;

      // Preserve the organization type locally.
      // The current database does not yet have this column.
      const organization = {
        ...registeredOrganization,
        organizationName: registeredOrganization.name || cleanName,
        organizationType,
        phone: registeredOrganization.phone || cleanPhone,
        createdAt:
          registeredOrganization.created_at ||
          new Date().toISOString(),
      };

      // Keep the existing Report dropdown compatible.
      let organizations = [];

      try {
        const savedOrganizations = localStorage.getItem(
          "responsehub_organizations"
        );

        if (savedOrganizations) {
          const parsed = JSON.parse(savedOrganizations);

          if (Array.isArray(parsed)) {
            organizations = parsed;
          }
        }
      } catch (storageError) {
        console.warn(
          "Could not read existing organizations:",
          storageError
        );
      }

      // Remove an old local entry with the same email.
      organizations = organizations.filter(
        (item) =>
          item.email?.trim().toLowerCase() !== cleanEmail
      );

      organizations.push(organization);

      localStorage.setItem(
        "responsehub_organizations",
        JSON.stringify(organizations)
      );

      localStorage.setItem(
        "responsehub_organization",
        JSON.stringify(organization)
      );

      alert("Organization registered successfully.");
      window.location.href = "/organization-login";
    } catch (error) {
      console.error("Organization registration error:", error);

      setError(
        error.message ||
          "Unable to connect to the ResponseHub server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="organization-login-page">
      <div className="organization-register-card">
        <div className="login-logo">
          <span>R</span>
          ResponseHub
        </div>

        <div className="login-heading">
          <span>ORGANIZATION REGISTRATION</span>

          <h1>Create your organization account.</h1>

          <p>
            Register your organization to receive, manage and respond
            to reports through ResponseHub.
          </p>
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="login-field">
            <label htmlFor="organizationName">
              Organization name
            </label>

            <input
              id="organizationName"
              type="text"
              placeholder="e.g. Example Water Company"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={loading}
              autoComplete="organization"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="organizationType">
              Organization type
            </label>

            <select
              id="organizationType"
              value={organizationType}
              onChange={(e) => setOrganizationType(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select organization type</option>
              <option value="Government">Government</option>
              <option value="Company">Company</option>
              <option value="Business">Business</option>
              <option value="School">School</option>
              <option value="Hospital">Hospital</option>
              <option value="NGO">NGO</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="login-field">
            <label htmlFor="organizationEmail">Official email</label>

            <input
              id="organizationEmail"
              type="email"
              placeholder="organization@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="organizationPhone">Phone number</label>

            <input
              id="organizationPhone"
              type="tel"
              placeholder="+254..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={loading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="organizationPassword">
              Create password
            </label>

            <div className="password-input-wrapper">
              <input
                id="organizationPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <small>Password must contain at least 8 characters.</small>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Register Organization →"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already registered?{" "}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/organization-login";
              }}
              disabled={loading}
            >
              Sign in
            </button>
          </p>

          <a href="/">← Back to ResponseHub</a>
        </div>
      </div>
    </div>
  );
}

export default OrganizationRegister;