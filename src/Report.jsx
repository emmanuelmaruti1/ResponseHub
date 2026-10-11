import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
import "./Report.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");
const MAX_FILE_SIZE = 1.5 * 1024 * 1024;
const MAX_FILES = 3;

const countryNames = new Intl.DisplayNames(["en"], {
  type: "region",
});

const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) || code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function validateEmailAddress(value) {
  const email = value.trim();

  if (!email) {
    return { valid: true, email: "" };
  }

  if (
    email.length > 254 ||
    /\s/.test(email) ||
    (email.match(/@/g) || []).length !== 1
  ) {
    return {
      valid: false,
      message: "Enter a valid email address.",
    };
  }

  const [local, domain] = email.split("@");

  if (
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
  ) {
    return {
      valid: false,
      message: "Enter a valid email address.",
    };
  }

  if (
    !domain ||
    domain.length > 253 ||
    !domain.includes(".") ||
    domain.startsWith(".") ||
    domain.endsWith(".")
  ) {
    return {
      valid: false,
      message: "Enter a valid email, such as name@example.com.",
    };
  }

  const labels = domain.split(".");

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[a-zA-Z0-9-]+$/.test(label)
    )
  ) {
    return {
      valid: false,
      message: "Enter a valid email, such as name@example.com.",
    };
  }

  const topLevelDomain = labels[labels.length - 1];

  if (!/^[a-zA-Z]{2,}$/.test(topLevelDomain)) {
    return {
      valid: false,
      message: "Enter a valid email, such as name@example.com.",
    };
  }

  return { valid: true, email };
}

function generateCaseNumber() {
  return `RH-${new Date().getFullYear()}-${Math.floor(
    100000 + Math.random() * 900000
  )}`;
}

function Report() {
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);

  const [formData, setFormData] = useState({
    category: "",
    customCategory: "",
    location: "",
    organizationId: "",
    organization: "",
    description: "",
    fullName: "",
    phone: "",
    email: "",
    anonymous: false,
  });

  const [phoneCountry, setPhoneCountry] = useState("KE");
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Holds the successful submission so the reporter can see the Case ID.
  const [submittedReport, setSubmittedReport] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("responsehub_organizations");
      const parsed = saved ? JSON.parse(saved) : [];

      setOrganizations(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.error("Failed to load organizations:", err);
      setOrganizations([]);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");

    if (name === "phone") {
      setPhoneError("");
    }

    if (name === "email") {
      setEmailError("");
    }
  };

  const handleOrganizationChange = (e) => {
    const organizationId = e.target.value;

    const selected = organizations.find(
      (organization) =>
        String(organization.id) === String(organizationId)
    );

    setFormData((previous) => ({
      ...previous,
      organizationId: selected ? selected.id : "",
      organization: selected
        ? selected.organizationName || selected.name || ""
        : "",
    }));

    setError("");
  };

  const validatePhoneNumber = () => {
    const rawPhone = formData.phone.trim();

    if (!rawPhone) {
      return {
        valid: false,
        message: "Enter your phone number.",
      };
    }

    const selectedCountry = COUNTRIES.find(
      (country) => country.code === phoneCountry
    );

    if (!selectedCountry) {
      return {
        valid: false,
        message: "Select a valid country.",
      };
    }

    if (!/^[+\d\s().-]+$/.test(rawPhone)) {
      return {
        valid: false,
        message: "Enter a valid phone number using digits.",
      };
    }

    const parsedPhone = parsePhoneNumberFromString(rawPhone, {
      defaultCountry: phoneCountry,
      extract: false,
    });

    if (!parsedPhone || !parsedPhone.isValid()) {
      return {
        valid: false,
        message: "That phone number is too short or invalid.",
      };
    }

    if (parsedPhone.countryCallingCode !== selectedCountry.callingCode) {
      return {
        valid: false,
        message: "The number does not match the selected country.",
      };
    }

    if (parsedPhone.country && parsedPhone.country !== phoneCountry) {
      return {
        valid: false,
        message: "Choose the country that matches your number.",
      };
    }

    return {
      valid: true,
      number: parsedPhone.number,
    };
  };

  const readEvidenceFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve({
          id:
            "EVIDENCE-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            Math.random().toString(36).slice(2, 8).toUpperCase(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
          uploadedAt: new Date().toISOString(),
        });
      };

      reader.onerror = () => {
        reject(new Error(`Unable to read ${file.name}.`));
      };

      reader.readAsDataURL(file);
    });

  const handleEvidenceChange = async (e) => {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    setError("");

    if (evidence.length + files.length > MAX_FILES) {
      setError("You can upload a maximum of 3 evidence files.");
      e.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    const invalidFile = files.find(
      (file) => !allowedTypes.includes(file.type)
    );

    if (invalidFile) {
      setError("Only JPG, PNG, WEBP and PDF files are allowed.");
      e.target.value = "";
      return;
    }

    const tooLarge = files.find(
      (file) => file.size > MAX_FILE_SIZE
    );

    if (tooLarge) {
      setError(
        `${tooLarge.name} is too large. Each file must be 1.5MB or smaller.`
      );
      e.target.value = "";
      return;
    }

    try {
      const loadedFiles = await Promise.all(
        files.map(readEvidenceFile)
      );

      setEvidence((previous) => [...previous, ...loadedFiles]);
    } catch (err) {
      console.error("Evidence reading error:", err);
      setError(err.message || "Unable to read the selected evidence.");
    } finally {
      e.target.value = "";
    }
  };

  const removeEvidence = (evidenceId) => {
    setEvidence((previous) =>
      previous.filter((file) => file.id !== evidenceId)
    );

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    setError("");
    setPhoneError("");
    setEmailError("");

    const selectedOrganization = organizations.find(
      (organization) =>
        String(organization.id) === String(formData.organizationId)
    );

    if (!selectedOrganization) {
      setError("Please select an organization.");
      return;
    }

    if (!formData.category) {
      setError("Please select a category.");
      return;
    }

    if (
      formData.category === "Other" &&
      !formData.customCategory.trim()
    ) {
      setError("Please specify the issue.");
      return;
    }

    if (!formData.location.trim()) {
      setError("Please enter the location.");
      return;
    }

    if (!formData.description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    let normalizedPhone = "";
    let normalizedEmail = "";

    if (!formData.anonymous) {
      if (!formData.fullName.trim()) {
        setError(
          "Please enter your full name or choose anonymous reporting."
        );
        return;
      }

      const phoneResult = validatePhoneNumber();

      if (!phoneResult.valid) {
        setPhoneError(phoneResult.message);
        return;
      }

      normalizedPhone = phoneResult.number;

      const emailResult = validateEmailAddress(formData.email);

      if (!emailResult.valid) {
        setEmailError(emailResult.message);
        return;
      }

      normalizedEmail = emailResult.email;
    }

    const finalCategory =
      formData.category === "Other"
        ? formData.customCategory.trim()
        : formData.category;

    setSubmitting(true);

    try {
      let successfulCaseNumber = "";

      for (let attempt = 0; attempt < 5; attempt++) {
        const generatedCaseNumber = generateCaseNumber();

        const payload = {
          caseId: generatedCaseNumber,
          category: finalCategory,
          location: formData.location.trim(),
          description: formData.description.trim(),
          organizationId: selectedOrganization.id,
          organization:
            selectedOrganization.organizationName ||
            selectedOrganization.name ||
            "",
          fullName: formData.anonymous
            ? "Anonymous"
            : formData.fullName.trim(),
          phone: formData.anonymous ? "" : normalizedPhone,
          email: formData.anonymous ? "" : normalizedEmail,
          anonymous: formData.anonymous,
          priority: "Medium",
          evidence: evidence.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: file.dataUrl,
            uploadedAt: file.uploadedAt,
          })),
        };

        const response = await fetch(`${API_URL}/reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 409) {
          continue;
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              data.error ||
              "Failed to submit your report."
          );
        }

        successfulCaseNumber =
          data.report?.case_id ||
          data.report?.caseId ||
          data.case_id ||
          data.caseId ||
          generatedCaseNumber;

        break;
      }

      if (!successfulCaseNumber) {
        throw new Error(
          "Unable to generate a unique Case ID. Please try again."
        );
      }

      // Show the Case ID on screen instead of immediately navigating away.
      setSubmittedReport({
        caseNumber: successfulCaseNumber,
        organization:
          selectedOrganization.organizationName ||
          selectedOrganization.name ||
          "Selected organization",
        category: finalCategory,
        location: formData.location.trim(),
        submittedAt: new Date().toLocaleString(),
      });
    } catch (err) {
      console.error("Report submission error:", err);

      setError(
        err.message === "Failed to fetch"
          ? "Unable to connect to ResponseHub. Check that the backend is running."
          : err.message || "Unable to submit your report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation screen: the reporter's Case ID is prominently displayed.
  if (submittedReport) {
    return (
      <div className="report-page">
        <div className="report-container">
          <div className="report-success-screen">
            <div
              style={{
                width: "72px",
                height: "72px",
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "#e6f7ec",
                color: "#16803c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "38px",
                fontWeight: "bold",
              }}
              aria-hidden="true"
            >
              ✓
            </div>

            <h1>Report Submitted Successfully!</h1>

            <p>
              Your report has been received. Save your Case ID below so
              you can track its progress.
            </p>

            <div
              style={{
                margin: "28px 0",
                padding: "24px",
                border: "2px solid #16803c",
                borderRadius: "12px",
                background: "#f4fbf6",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontWeight: "600",
                }}
              >
                YOUR CASE ID
              </p>

              <div
                style={{
                  fontSize: "clamp(22px, 5vw, 32px)",
                  fontWeight: "800",
                  letterSpacing: "1px",
                  overflowWrap: "anywhere",
                  color: "#146c35",
                  marginBottom: "16px",
                }}
              >
                {submittedReport.caseNumber}
              </div>

              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(submittedReport.caseNumber)
                    .catch(() => {
                      setError(
                        "Copy failed. Please select and copy the Case ID manually."
                      );
                    })
                }
                style={{
                  padding: "10px 18px",
                  border: "1px solid #16803c",
                  borderRadius: "6px",
                  background: "#ffffff",
                  color: "#146c35",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Copy Case ID
              </button>
            </div>

            <div
              style={{
                textAlign: "left",
                margin: "20px 0",
                lineHeight: "1.8",
              }}
            >
              <p>
                <strong>Organization:</strong>{" "}
                {submittedReport.organization}
              </p>

              <p>
                <strong>Category:</strong> {submittedReport.category}
              </p>

              <p>
                <strong>Location:</strong> {submittedReport.location}
              </p>

              <p>
                <strong>Submitted:</strong>{" "}
                {submittedReport.submittedAt}
              </p>
            </div>

            <p>
              Keep your Case ID safe. You will need it to check the
              status of your report.
            </p>

            {error && (
              <div className="report-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="report-submit-button"
              onClick={() =>
                navigate(
                  `/track?case=${encodeURIComponent(
                    submittedReport.caseNumber
                  )}`,
                  {
                    state: {
                      submitted: true,
                      caseNumber: submittedReport.caseNumber,
                      organization: submittedReport.organization,
                    },
                  }
                )
              }
            >
              Track Your Report
            </button>

            <button
              type="button"
              onClick={() => navigate("/")}
              style={{
                display: "block",
                margin: "16px auto 0",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <div className="report-container">
        <div className="report-header">
          <h1>Report an Issue</h1>
          <p>
            Tell us what happened and we'll route your report to the
            responsible organization.
          </p>
        </div>

        {organizations.length === 0 ? (
          <div className="report-no-organizations">
            <h2>No organizations are registered yet</h2>
            <p>
              An organization must register before citizens can route
              reports to it.
            </p>
            <button
              type="button"
              onClick={() => navigate("/organization-register")}
            >
              Register an Organization
            </button>
          </div>
        ) : (
          <form
            className="report-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {error && (
              <div className="report-error" role="alert">
                {error}
              </div>
            )}

            <div className="report-form-section">
              <h2>Issue Information</h2>

              <div className="report-form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  disabled={submitting}
                >
                  <option value="">Select a category</option>
                  <option value="Water & Sanitation">
                    Water &amp; Sanitation
                  </option>
                  <option value="Electricity">Electricity</option>
                  <option value="Roads & Transport">
                    Roads &amp; Transport
                  </option>
                  <option value="Security">Security</option>
                  <option value="Public Services">Public Services</option>
                  <option value="Business / Customer Service">
                    Business / Customer Service
                  </option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {formData.category === "Other" && (
                <div className="report-form-group">
                  <label htmlFor="customCategory">
                    Specify the issue
                  </label>
                  <input
                    id="customCategory"
                    name="customCategory"
                    value={formData.customCategory}
                    onChange={handleChange}
                    placeholder="Describe the specific issue"
                    required
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="report-form-group">
                <label htmlFor="location">Location</label>
                <input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Nakuru, Kenya"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="report-form-group">
                <label htmlFor="organizationId">
                  Responsible Organization
                </label>
                <select
                  id="organizationId"
                  name="organizationId"
                  value={formData.organizationId}
                  onChange={handleOrganizationChange}
                  required
                  disabled={submitting}
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option
                      key={organization.id}
                      value={organization.id}
                    >
                      {organization.organizationName ||
                        organization.name ||
                        "Organization"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-form-group">
                <label htmlFor="description">
                  Describe the issue
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Explain what happened and any important details..."
                  rows="6"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="report-form-section">
              <h2>Evidence</h2>
              <p>You can attach up to 3 photos or PDF documents.</p>

              <div className="report-form-group">
                <label htmlFor="evidence">Upload Evidence</label>
                <input
                  id="evidence"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  multiple
                  onChange={handleEvidenceChange}
                  disabled={submitting}
                />
                <small>
                  Maximum 3 files. Each file must be 1.5MB or smaller.
                </small>
              </div>

              {evidence.length > 0 ? (
                <div className="report-evidence-list">
                  {evidence.map((file) => (
                    <div
                      className="report-evidence-item"
                      key={file.id}
                    >
                      <span>{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeEvidence(file.id)}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <small>No evidence attached yet.</small>
              )}
            </div>

            <div className="report-form-section">
              <h2>Your Details</h2>

              <div className="report-form-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  autoComplete="name"
                  disabled={formData.anonymous || submitting}
                />
              </div>

              <div className="report-form-group">
                <label htmlFor="phoneCountry">Country</label>
                <select
                  id="phoneCountry"
                  value={phoneCountry}
                  onChange={(e) => {
                    setPhoneCountry(e.target.value);
                    setPhoneError("");
                  }}
                  disabled={formData.anonymous || submitting}
                >
                  {COUNTRIES.map((country) => (
                    <option
                      key={country.code}
                      value={country.code}
                    >
                      {country.name} (+{country.callingCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="report-form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={
                    phoneCountry === "KE"
                      ? "0712345678 or +254712345678"
                      : "Enter your phone number"
                  }
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={30}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={
                    phoneError ? "phone-error" : undefined
                  }
                  disabled={formData.anonymous || submitting}
                />

                {phoneError && (
                  <small
                    id="phone-error"
                    role="alert"
                    style={{ color: "#c62828" }}
                  >
                    {phoneError}
                  </small>
                )}
              </div>

              <div className="report-form-group">
                <label htmlFor="email">
                  Email Address (optional)
                </label>
                <input
                  id="email"
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError ? "email-error" : undefined
                  }
                  disabled={formData.anonymous || submitting}
                />

                {emailError && (
                  <small
                    id="email-error"
                    role="alert"
                    style={{ color: "#c62828" }}
                  >
                    {emailError}
                  </small>
                )}
              </div>

              <label className="report-anonymous-option">
                <input
                  type="checkbox"
                  name="anonymous"
                  checked={formData.anonymous}
                  onChange={(e) => {
                    handleChange(e);
                    setPhoneError("");
                    setEmailError("");
                  }}
                  disabled={submitting}
                />
                <span>Submit this report anonymously</span>
              </label>
            </div>

            <button
              className="report-submit-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Submitting Report..." : "Submit Report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Report;