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
  // const handleProcessFile = async () => {
  //   if (!cvFile) return;

  //   setProcessLoading(true);
  //   const formData = new FormData();
  //   formData.append("resume", cvFile);

  //   if (jdFile) formData.append("jd", jdFile);
  //   if (reqDoc) formData.append("requirement", reqDoc);
  //   if (clientDoc) formData.append("client_doc", clientDoc);

  //   try {
  //     const res = await axios.post(
  //       `${import.meta.env.VITE_API_BASE_URL}/extract-skills`,
  //       formData,
  //       { headers: { "Content-Type": "multipart/form-data" } }
  //     );

  //     const extractedRole = res?.data?.role ?? "";
  //     const extractedSkills = Array.isArray(res?.data?.skills) ? res.data.skills : [];

  //     if (extractedRole) setRole(extractedRole);
  //     if (extractedSkills.length > 0) setSkills(extractedSkills);

  //     window.alert("Resume processed successfully.");
  //   } catch (err) {
  //     console.error("Error processing resume:", err);
  //     window.alert("Failed to process resume.");
  //   } finally {
  //     setProcessLoading(false);
  //   }
  // };
  const handleProcessFile = async () => {
    if (!cvFile) {
      window.alert("Please upload a CV before processing.");
      return;
    }

    const token = localStorage.getItem("authToken"); // ✅ correct key

    if (!token) {
      window.alert("No auth token found. Please login again.");
      return;
    }

    setProcessLoading(true);

    const formData = new FormData();
    formData.append("file", cvFile);

    try {
      console.log("DEBUG: Sending token:", token);

      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}admin/extract-skills?doc_type=cv`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,   // ✅ correct token sent
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("API Response:", res.data);

      const extractedSkills =
        res.data?.extracted_skills?.map((s: any) => s.skill_name) || [];

      if (extractedSkills.length > 0) {
        setSkills(extractedSkills);
      } else {
        window.alert("No skills detected in CV.");
      }

      setRole("Developer");

      window.alert("CV processed successfully!");
    } catch (err) {
      console.error("Error extracting skills:", err);
      window.alert("Failed to process resume.");
    } finally {
      setProcessLoading(false);
    }
  };

  // -----------------------------
  // Submit Assessment → Show link modal
  // -----------------------------
  const handleSubmit = async () => {
    if (!formValid) {
      window.alert("Please complete all required fields.");
      return;
    }

    setSubmitLoading(true);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        window.alert("Authentication missing. Please login again.");
        return;
      }

      // Convert skills array → object for BE
      const requiredSkillsObj: Record<string, string> = {};
      skills.forEach((skill) => {
        requiredSkillsObj[skill] = "";
      });

      // Build FE → BE request payload
      const payload = {
        title: `Assessment for ${email}`,         // must be unique
        description: "Auto-generated assessment", // string required
        job_title: role,                          // your role: default Developer
        jd_id: "",                                // empty (BE will fetch automatically if JD uploaded)
        required_skills: requiredSkillsObj,       // mapped object
        required_roles: [role],                   // ["Developer"]
        question_set_id: "",                      // BE auto-handles
        duration_minutes: 30,                     // fixed default
        is_questionnaire_enabled: true,
        is_interview_enabled: false,

        candidate_info: {
          name: "string",
          email: email,
          phone: "string",
          experience: "string",
          current_role: role,
          location: "string",
          linkedin: "string",
          github: "string",
          portfolio: portfolio || "",
          education: "string",
        }
      };

      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}assessments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Assessment created:", res.data);

      // Generate the assessment link
      const sanitized = email.replace(/[@.]/g, "");
      const generatedLink = `${window.location.origin}/candidate-assessment/${sanitized}`;

      setAssessmentLink(generatedLink);
      setShowAssessmentLinkModal(true);

    } catch (err) {
      console.error("Error creating assessment:", err);
      window.alert("Failed to create assessment. Check logs.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // const handleSubmit = () => {
  //   setSubmitLoading(true);

  //   setTimeout(() => {
  //     setSubmitLoading(false);

  //     const sanitized = email.trim()
  //       ? email.replace(/[@.]/g, "")
  //       : "candidate";

  //     const generatedLink = `${window.location.origin}/candidate-assessment/${sanitized}`;

  //     setAssessmentLink(generatedLink);
  //     setShowAssessmentLinkModal(true);
  //   }, 700);
  // };

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