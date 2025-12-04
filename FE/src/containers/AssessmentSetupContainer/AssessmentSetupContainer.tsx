import React, { useState, useEffect } from "react";
import "./AssessmentSetupContainer.scss";
import axios from "axios";

// Components
import FileUpload from "./components/FileUpload";
import EmailField from "./components/EmialField";
import PortfolioField from "./components/PortfolioField";
import AvailabilitySelector from "./components/AvailabilitySelector";
import RoleSkillPlaceholder from "./components/RoleSkillPlaceholder";
import AssessmentMethodSelector from "./components/AssessmentMethodSelector";
import AssessmentSetupSubmitButton from "./components/AssessmentSetupSubmitButton";
import AssessmentLinkModal from "./components/AssessmentLinkModal";

const AssessmentSetupContainer: React.FC = () => {
  // -----------------------------
  // File Uploads
  // -----------------------------
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [reqDoc, setReqDoc] = useState<File | null>(null);
  const [clientDoc, setClientDoc] = useState<File | null>(null);

  // -----------------------------
  // Candidate Info
  // -----------------------------
  const [email, setEmail] = useState("");
  const [emailValid, setEmailValid] = useState(false);
  const [portfolio, setPortfolio] = useState("");
  const [availability, setAvailability] = useState(50);

  // -----------------------------
  // Role & Skills (defaults)
  // -----------------------------
  const [role, setRole] = useState("Developer");
  const [skills, setSkills] = useState<string[]>(["Agentic AI"]);

  // -----------------------------
  // UI & Validation
  // -----------------------------
  const [processLoading, setProcessLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);

  // -----------------------------
  // Modal
  // -----------------------------
  const [showAssessmentLinkModal, setShowAssessmentLinkModal] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState("");

  // Validate form
  useEffect(() => {
    const valid =
      Boolean(cvFile) &&
      emailValid &&
      role.trim() !== "" &&
      skills.length > 0;

    setFormValid(valid);
  }, [cvFile, emailValid, role, skills]);

  // -----------------------------
  // Process Resume
  // -----------------------------
  const handleProcessFile = async () => {
    if (!cvFile) return;

    setProcessLoading(true);
    const formData = new FormData();
    formData.append("resume", cvFile);

    if (jdFile) formData.append("jd", jdFile);
    if (reqDoc) formData.append("requirement", reqDoc);
    if (clientDoc) formData.append("client_doc", clientDoc);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/extract-skills`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const extractedRole = res?.data?.role ?? "";
      const extractedSkills = Array.isArray(res?.data?.skills) ? res.data.skills : [];

      if (extractedRole) setRole(extractedRole);
      if (extractedSkills.length > 0) setSkills(extractedSkills);

      window.alert("Resume processed successfully.");
    } catch (err) {
      console.error("Error processing resume:", err);
      window.alert("Failed to process resume.");
    } finally {
      setProcessLoading(false);
    }
  };

  // -----------------------------
  // Submit Assessment → Show link modal
  // -----------------------------
  const handleSubmit = () => {
    setSubmitLoading(true);

    setTimeout(() => {
      setSubmitLoading(false);

      const sanitized = email.trim()
        ? email.replace(/[@.]/g, "")
        : "candidate";

      const generatedLink = `${window.location.origin}/candidate-assessment/${sanitized}`;

      setAssessmentLink(generatedLink);
      setShowAssessmentLinkModal(true);
    }, 700);
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="assessment-page">

      {/* HEADER */}
      <header className="page-header">
        <h1>Assessment Setup</h1>
        <p className="subtitle">
          Upload documents, review role & skills, and generate assessment link.
        </p>
      </header>

      {/* UPLOAD DOCS CARD */}
      <section className="card upload-card">
        <div className="card-header">
          <h2>Upload Documents</h2>
          <p className="hint">Candidate CV is required. Other documents are optional.</p>
        </div>

        <div className="upload-grid">
          <FileUpload label="Job Description (Optional)" onFileSelect={setJdFile} />
          <FileUpload label="Candidate CV *" onFileSelect={setCvFile} />
          <FileUpload label="Requirement Doc (Optional)" onFileSelect={setReqDoc} />
          <FileUpload label="Client-Specific (Optional)" onFileSelect={setClientDoc} />
        </div>

        <div className="card-actions">
          <button
            className="btn primary"
            onClick={handleProcessFile}
            disabled={!cvFile || processLoading}
          >
            {processLoading ? "Processing..." : "Process File"}
          </button>
        </div>
      </section>

      {/* ASSESSMENT DETAILS */}
      <section className="card details-card">
        <div className="card-header">
          <h2>Assessment Details</h2>
        </div>

        {/* Role + Skills */}
        <RoleSkillPlaceholder
          role={role}
          setRole={setRole}
          skills={skills}
          setSkills={setSkills}
        />
      </section>

      {/* CANDIDATE INFORMATION */}
      <section className="card candidate-card">
        <div className="card-header">
          <h2>Candidate Information</h2>
        </div>

        <div className="field">
          <EmailField value={email} setValue={setEmail} setValid={setEmailValid} />
        </div>

        <div className="field">
          <PortfolioField value={portfolio} setValue={setPortfolio} />
        </div>


        {/* AvailabilitySelector already contains its own label */}
        <div className="field">
          <AvailabilitySelector value={availability} setValue={setAvailability} />
        </div>

      </section>

      {/* METHOD CARD */}
      <section className="card method-card">
        <div className="card-header">
          <h2>Assessment Method</h2>
        </div>

        <AssessmentMethodSelector />
      </section>

      {/* SUBMIT */}
      <div className="footer-actions">
        <AssessmentSetupSubmitButton
          disabled={!formValid}
          loading={submitLoading}
          onClick={handleSubmit}
        />
      </div>

      {/* MODAL */}
      <AssessmentLinkModal
        open={showAssessmentLinkModal}
        link={assessmentLink}
        email={email}
        onClose={() => setShowAssessmentLinkModal(false)}
      />
    </div>
  );
};

export default AssessmentSetupContainer;