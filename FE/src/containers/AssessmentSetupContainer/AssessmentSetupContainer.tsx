import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./AssessmentSetupContainer.scss";
import FileUpload from "./components/FileUpload";
import CandidateInfoSection from "./components/CandidateInfoSection";
import type { CandidateInfoData } from "./components/CandidateInfoSection";
import AvailabilitySelector from "./components/AvailabilitySelector";
import RoleSkillPlaceholder from "./components/RoleSkillPlaceholder";
import AssessmentMethodSelector from "./components/AssessmentMethodSelector";
import AssessmentSetupSubmitButton from "./components/AssessmentSetupSubmitButton";
import AssessmentLinkModal from "./components/AssessmentLinkModal";
import Toast from "../../components/Toast/Toast";
import { isAdmin } from "../../utils/adminUsers";
import { uploadService, assessmentService } from "../../API/services";
import { parseResume, getExtractionConfidence } from "../../utils/resumeParser";
import type { QuestionDistribution } from "./components/QuestionnaireConfig";
import AssessmentConfigurationBlock from "./components/AssessmentConfigurationBlock";




interface ValidationError {
  field: string;
  message: string;
}

const AssessmentSetupContainer: React.FC = () => {
  const navigate = useNavigate();
  const { id: assessmentId } = useParams<{ id: string }>();
  const isEditMode = Boolean(assessmentId);

  const [, setUserRole] = useState<string>("admin");
  const [rbacError, setRbacError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [reqDoc, setReqDoc] = useState<File | null>(null);
  const [clientDoc, setClientDoc] = useState<File | null>(null);

  const [candidateInfo, setCandidateInfo] = useState<CandidateInfoData>({
    name: "",
    email: "",
    phone: "",
    experience: "",
    currentRole: "",
    location: "",
    linkedIn: "",
    github: "",
    portfolio: "",
    education: "",
  });
  const [emailValid, setEmailValid] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [availability, setAvailability] = useState(50);

  const [role, setRole] = useState("");
  const [roleError, setRoleError] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [jdSkills, setJdSkills] = useState<string[]>([]);
  const [skillDurations, setSkillDurations] = useState<Record<string, number>>({});

  const [assessmentMethod, setAssessmentMethod] = useState("questionnaire");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const [questionDistribution, setQuestionDistribution] =
    useState<QuestionDistribution>({
      mcq: 6,
      coding: 2,
      architecture: 2,
    });

  const [screeningQuestions, setScreeningQuestions] =
    useState<string[]>([""]);


  const [cutoffMarks, setCutoffMarks] = useState<number>(70);

  const [processLoading, setProcessLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [showAssessmentLinkModal, setShowAssessmentLinkModal] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState("");


  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    const checkRBAC = () => {
      try {
        const loggedInUser = localStorage.getItem("loggedInUser");
        const authToken = localStorage.getItem("authToken");

        if (!authToken) {
          setRbacError("Authentication failed. Please log in again.");
          return;
        }

        if (!loggedInUser || !isAdmin(loggedInUser)) {
          setRbacError("Unauthorized: Only admins can create assessments");
          return;
        }

        setUserRole("admin");
        setRbacError("");
      } catch (err) {
        console.error("RBAC check failed:", err);
        setRbacError("Authentication failed. Please log in again.");
      }
    };

    checkRBAC();
  }, []);

  useEffect(() => {
    const fetchAssessmentData = async () => {
      if (!isEditMode || !assessmentId) return;

      setEditLoading(true);
      try {
        const assessment = await assessmentService.getAssessment(assessmentId);

        if (assessment.job_title) {
          setRole(assessment.job_title);
        }

        if (assessment.required_skills) {
          setSkills(Object.keys(assessment.required_skills));
        }

        if (assessment.assessment_method) {
          setAssessmentMethod(assessment.assessment_method);
        } else {
          if (assessment.is_interview_enabled) {
            setAssessmentMethod("interview");
          } else if (assessment.is_questionnaire_enabled) {
            setAssessmentMethod("questionnaire");
          }
        }

        if (assessment.description) {
          const nameMatch = assessment.description.match(/candidate\s+(.+?)(?:\s*$|,)/i);
          if (nameMatch) {
            setCandidateInfo(prev => ({ ...prev, name: nameMatch[1].trim() }));
          }
        }

        setToast({ type: "info", message: "Loaded assessment data for editing" });
      } catch (err: any) {
        console.error("Error fetching assessment:", err);
        setToast({ type: "error", message: "Failed to load assessment data" });
      } finally {
        setEditLoading(false);
      }
    };

    fetchAssessmentData();
  }, [isEditMode, assessmentId]);

  useEffect(() => {
    const errors: ValidationError[] = [];

    if (!isEditMode && !cvFile) errors.push({ field: "cv", message: "CV is required" });
    if (!isEditMode && !emailValid) errors.push({ field: "email", message: "Valid email is required" });
    if (!role.trim()) errors.push({ field: "role", message: "Role is required" });
    if (skills.length === 0) errors.push({ field: "skills", message: "At least one skill is required" });

    setValidationErrors(errors);
    setFormValid(errors.length === 0);
  }, [cvFile, emailValid, role, skills, isEditMode]);

  const handleResumeTextExtracted = (text: string) => {
    if (!text) {
      console.log("[Resume Parser] No text extracted");
      return;
    }

    console.log("[Resume Parser] Extracted text length:", text.length);
    console.log("[Resume Parser] First 500 chars:", text.substring(0, 500));

    const parsedInfo = parseResume(text);
    const confidence = getExtractionConfidence(parsedInfo);

    console.log("[Resume Parser] Parsed info:", parsedInfo);
    console.log("[Resume Parser] Confidence:", confidence);

    setCandidateInfo((prev) => ({
      ...prev,
      name: parsedInfo.name || prev.name,
      email: parsedInfo.email || prev.email,
      experience: parsedInfo.experience || prev.experience,
      currentRole: parsedInfo.currentRole || prev.currentRole,
    }));

    if (parsedInfo.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(parsedInfo.email)) {
        setEmailValid(true);
        setEmailError("");
      }
    }

    if (parsedInfo.currentRole && !role) {
      setRole(parsedInfo.currentRole);
    }

    setIsAutoFilled(true);

    if (confidence >= 50) {
      setToast({
        type: "success",
        message: `Auto-filled candidate information from resume (${confidence}% confidence)`,
      });
    } else if (confidence > 0) {
      setToast({
        type: "info",
        message: `Partially extracted candidate info. Please verify and complete manually.`,
      });
    }
  };

  const handleProcessFile = async () => {
    if (!cvFile) {
      setToast({ type: "error", message: "Please select a CV first" });
      return;
    }

    setProcessLoading(true);

    try {
      const res = await uploadService.extractSkills(cvFile, jdFile || undefined, reqDoc || undefined, clientDoc || undefined);

      const extractedSkillsList = res.skills || (res as any).extracted_skills || [];
      const skillNames = extractedSkillsList.map((s: any) => typeof s === 'string' ? s : (s.skill_name || s));

      const extractedRole = res.role || (res as any).extracted_role || "";

      if (extractedRole) {
        setRole(extractedRole);
        setRoleError("");
      }
      if (skillNames.length > 0) {
        setSkills(skillNames);
        setSkillsError("");
      }

      const jdSkillsList = (res as any).jd_skills || [];
      if (jdSkillsList.length > 0) {
        setJdSkills(jdSkillsList.map((s: any) => typeof s === 'string' ? s : (s.skill_name || s)));
      }

      const durations = (res as any).skill_durations || {};
      if (Object.keys(durations).length > 0) {
        setSkillDurations(durations);
      }

      setToast({ type: "success", message: `Extracted ${skillNames.length} skills from documents!` });
    } catch (err: any) {
      console.error("Error processing resume:", err);
      const errorMessage = err.response?.data?.detail || "Failed to process resume. Please try again.";
      setToast({ type: "error", message: errorMessage });
    } finally {
      setProcessLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formValid) {
      setToast({ type: "error", message: "Please complete all required fields" });
      return;
    }

    setSubmitLoading(true);

    try {
      const assessmentPayload: any = {
        title: `Assessment for ${role}`,
        description: `Assessment created for candidate ${candidateInfo.name || candidateInfo.email}`,
        job_title: role.trim(),
        //required_skills: skills.reduce((acc, skill) => ({ ...acc, [skill]: "intermediate" }), {}),
        required_skills: skills.reduce((acc, skill) => {
          const level = skillDurations?.[skill.toLowerCase()]
            ? skillDurations[skill.toLowerCase()] >= 3 ? "advanced" : "intermediate"
            : "intermediate";

          return { ...acc, [skill]: level };
        }, {}),
        required_roles: [role.trim()],
        duration_minutes: 30,
        is_questionnaire_enabled: assessmentMethod === "questionnaire",
        is_interview_enabled: assessmentMethod === "interview",
        candidate_info: {
          name: candidateInfo.name,
          email: candidateInfo.email,
          experience: candidateInfo.experience,
          current_role: candidateInfo.currentRole,
        },
      };

      if (assessmentMethod === "questionnaire") {
        assessmentPayload.questionnaire_config = {
          mcq: questionDistribution.mcq,
          coding: questionDistribution.coding,
          architecture: questionDistribution.architecture,
        };
      }


      if (expiresAt) {
        assessmentPayload.expires_at = new Date(expiresAt).toISOString();
      }

      const response = isEditMode
        ? await assessmentService.updateAssessment(assessmentId!, assessmentPayload)
        : await assessmentService.createAssessment(assessmentPayload);

      const resultAssessmentId = response?.assessment_id;
      const generatedLink = `${window.location.origin}/candidate-assessment/${resultAssessmentId}`;

      setAssessmentLink(generatedLink);
      setShowAssessmentLinkModal(true);

      setToast({ type: "success", message: isEditMode ? "Assessment updated successfully!" : "Assessment created successfully!" });
    } catch (err: any) {
      console.error("Error submitting assessment:", err);
      const errorMessage = err.response?.data?.detail || "Failed to create assessment. Please try again.";
      setToast({ type: "error", message: errorMessage });
    } finally {
      setSubmitLoading(false);
    }
  };

  if (rbacError) {
    return (
      <div className="assessment-page error-page">
        <div className="rbac-error">
          <h2>Access Denied</h2>
          <p>{rbacError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assessment-page">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <header className="page-header">
        <h1>{isEditMode ? "Edit Assessment" : "Assessment Setup"}</h1>
        <p className="subtitle">
          {isEditMode
            ? "Update assessment details, role, skills, and settings."
            : "Upload documents, review role & skills, and generate assessment link."
          }
        </p>
      </header>

      {editLoading && (
        <div className="edit-loading">
          <div className="spinner" />
          <p>Loading assessment data...</p>
        </div>
      )}

      <section className="card upload-card">
        <div className="card-header">
          <h2>Upload Documents</h2>
          <p className="hint">Candidate CV is required. Other documents are optional. Candidate info will be auto-filled from CV.</p>
        </div>

        <div className="upload-grid">
          <FileUpload label="Job Description (Optional)" onFileSelect={setJdFile} />
          <FileUpload
            label="Candidate CV *"
            onFileSelect={setCvFile}
            onTextExtracted={handleResumeTextExtracted}
            isRequired
          />
          <FileUpload label="Requirement Doc (Optional)" onFileSelect={setReqDoc} />
          <FileUpload label="Client Portfolio (Optional)" onFileSelect={setClientDoc} />
        </div>

        <div className="card-actions">
          <button
            className="btn primary"
            onClick={handleProcessFile}
            disabled={!cvFile || processLoading}
          >
            {processLoading ? "Processing..." : "Extract Role & Skills"}
          </button>
        </div>
      </section>

      <section className="card details-card">
        <div className="card-header">
          <h2>Assessment Details</h2>
        </div>

        <RoleSkillPlaceholder
          role={role}
          setRole={setRole}
          roleError={roleError}
          setRoleError={setRoleError}
          skills={skills}
          setSkills={setSkills}
          skillsError={skillsError}
          setSkillsError={setSkillsError}
          jdSkills={jdSkills}
          skillDurations={skillDurations}
        />
      </section>

      <section className="card candidate-card">
        <div className="card-header">
          <h2>Candidate Information</h2>
          <p className="hint">Auto-filled from resume. Edit if needed.</p>
        </div>

        <CandidateInfoSection
          candidateInfo={candidateInfo}
          setCandidateInfo={setCandidateInfo}
          emailValid={emailValid}
          setEmailValid={setEmailValid}
          emailError={emailError}
          setEmailError={setEmailError}
          isAutoFilled={isAutoFilled}
        />

        <div className="field" style={{ marginTop: "16px" }}>
          <AvailabilitySelector value={availability} setValue={setAvailability} />
        </div>
      </section>




      <AssessmentConfigurationBlock
        questionDistribution={questionDistribution}
        onQuestionDistributionChange={setQuestionDistribution}
        screeningQuestions={screeningQuestions}
        onScreeningQuestionsChange={setScreeningQuestions}
        cutoffMarks={cutoffMarks}
        onCutoffMarksChange={setCutoffMarks}
      />


      <section className="card method-card">
        <div className="card-header">
          <h2>Assessment Method</h2>
          <p className="hint">Select how candidates will be assessed</p>
        </div>

        <AssessmentMethodSelector
          method={assessmentMethod}
          setMethod={setAssessmentMethod}
        />
      </section>




      <section className="card expiry-card">
        <div className="card-header">
          <h2>Assessment Expiry</h2>
          <p className="hint">Set when this assessment link should expire (optional)</p>
        </div>

        <div className="expiry-field">
          <label htmlFor="expiresAt">Expiry Date & Time</label>
          <input
            type="datetime-local"
            id="expiresAt"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="expiry-input"
          />
          {expiresAt && (
            <p className="expiry-preview">
              Link will expire on: {new Date(expiresAt).toLocaleString()}
            </p>
          )}
          {!expiresAt && (
            <p className="expiry-note">Leave empty for no expiration</p>
          )}
        </div>
      </section>

      {validationErrors.length > 0 && (
        <div className="validation-summary">
          <div className="validation-header">
            <h3>⚠️ Please complete the following:</h3>
          </div>
          <ul className="validation-list">
            {validationErrors.map((error, idx) => (
              <li key={idx}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="footer-actions">
        <AssessmentSetupSubmitButton
          disabled={!formValid || submitLoading}
          loading={submitLoading}
          onClick={handleSubmit}
          validationCount={validationErrors.length}
          label={isEditMode ? "Update Assessment" : "Set Assessment"}
          loadingLabel={isEditMode ? "Updating Assessment..." : "Creating Assessment..."}
        />
      </div>

      <AssessmentLinkModal
        open={showAssessmentLinkModal}
        link={assessmentLink}
        email={candidateInfo.email}
        onClose={() => {
          setShowAssessmentLinkModal(false);
          navigate("/admin/dashboard");
        }}
      />
    </div>
  );
};

export default AssessmentSetupContainer;