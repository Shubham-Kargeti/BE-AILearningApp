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
  // File Upload State
  // -----------------------------
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [reqDoc, setReqDoc] = useState<File | null>(null);
  const [clientDoc, setClientDoc] = useState<File | null>(null);

  // -----------------------------
  // Candidate Info State
  // -----------------------------
  const [email, setEmail] = useState("");
  const [emailValid, setEmailValid] = useState(false);

  const [portfolio, setPortfolio] = useState("");
  const [availability, setAvailability] = useState(50);

  // -----------------------------
  // Role + Skills State (DEFAULTS)
  // -----------------------------
  const [role, setRole] = useState("Developer");
  const [skills, setSkills] = useState<string[]>(["Agentic AI"]);

  // -----------------------------
  // UI & Submit Validation
  // -----------------------------
  const [loading, setLoading] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);

  // -----------------------------
  // After Assessment Modal
  // -----------------------------
  const [showAssessmentLinkModal, setShowAssessmentLinkModal] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState("");

  // Validation → CV mandatory, role+skills must exist, email must be valid
  useEffect(() => {
    const valid =
      cvFile &&
      emailValid &&
      role.trim() !== "" &&
      skills.length > 0;

    setFormValid(Boolean(valid));
  }, [cvFile, emailValid, role, skills]);

  // --------------------------------------------
  // PROCESS FILE → Extract Skills from Resume
  // --------------------------------------------
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
        `${import.meta.env.VITE_API_URL}/extract-skills`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const extractedSkills = res.data.skills || [];
      const extractedRole = res.data.role || "";

      if (extractedRole) setRole(extractedRole);

      if (extractedSkills.length > 0) setSkills(extractedSkills);

      alert("Resume processed successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to process resume");
    } finally {
      setProcessLoading(false);
    }
  };

  // --------------------------------------------
  // FINAL SUBMIT → Show Modal with Link
  // --------------------------------------------
  const handleSubmit = () => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);

      // Generate candidate link from email
      const sanitized = email.replace(/[@.]/g, "");
      const generatedLink = `${window.location.origin}/candidate-assessment/${sanitized}`;

      setAssessmentLink(generatedLink);
      setShowAssessmentLinkModal(true);
    }, 900);
  };

  // --------------------------------------------
  // RENDER UI
  // --------------------------------------------
  return (
    <div className="assessment-container">

      {/* HEADER */}
      <div className="admin-page-header">
        <h1>Assessment Creation</h1>
        <p className="page-subtitle">
          Upload required documents and configure the assessment for the candidate.
        </p>
      </div>

      <div className="assessment-form-card">

        {/* =============== SECTION 1: FILE UPLOADS =============== */}
        <div className="section">
          <h3 className="section-title">Required Documents</h3>

          <FileUpload label="Upload JD Document (Optional)" onFileSelect={setJdFile} />
          <FileUpload label="Upload Candidate CV *" onFileSelect={setCvFile} />
          <FileUpload label="Upload Requirement Document (Optional)" onFileSelect={setReqDoc} />
          <FileUpload label="Upload Client-Specific Document (Optional)" onFileSelect={setClientDoc} />

          <button
            className="process-file-btn"
            disabled={!cvFile || processLoading}
            onClick={handleProcessFile}
          >
            {processLoading ? "Processing..." : "Process File"}
          </button>
        </div>

        {/* =============== SECTION 2: CANDIDATE INFO =============== */}
        <div className="section">
          <h3 className="section-title">Candidate Information</h3>

          <EmailField value={email} setValue={setEmail} setValid={setEmailValid} />
          <PortfolioField value={portfolio} setValue={setPortfolio} />
          <AvailabilitySelector value={availability} setValue={setAvailability} />
        </div>

        {/* =============== SECTION 3: ROLE & SKILLS =============== */}
        <div className="section">
          <h3 className="section-title">Role & Skills</h3>

          <RoleSkillPlaceholder
            role={role}
            setRole={setRole}
            skills={skills}
            setSkills={setSkills}
          />
        </div>

        {/* =============== SECTION 4: METHOD =============== */}
        <div className="section">
          <h3 className="section-title">Assessment Method</h3>
          <AssessmentMethodSelector />
        </div>

        {/* =============== FINAL SET ASSESSMENT BUTTON =============== */}
        <AssessmentSetupSubmitButton
          disabled={!formValid}
          loading={loading}
          onClick={handleSubmit}
        />
      </div>

      {/* ===================== RESULT MODAL ===================== */}
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
