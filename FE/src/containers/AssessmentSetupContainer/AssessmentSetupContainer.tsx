
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./AssessmentSetupContainer.scss";
import FileUpload from "./components/FileUpload";
import CandidateInfoSection from "./components/CandidateInfoSection";
import type { CandidateInfoData } from "./components/CandidateInfoSection";
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
import type { GenerationPolicy } from "./components/GenerationPolicySelector";
import GenerationPolicySelector from "./components/GenerationPolicySelector";
import AssessmentQuestionEditor, { type Question } from "./components/AssessmentQuestionEditor";
import { FiFileText, FiBriefcase, FiCpu } from "react-icons/fi";

// Role category and question distribution types
type RoleCategory = "tech" | "non-tech";

interface RequirementQuestionDistribution {
  mcq: number;
  coding: number;
  architecture: number;
  scenario: number;
}

interface ValidationError {
  field: string;
  message: string;
}

type ExtractedSkillMeta = {
  category: string;
  frequency: number;
  inResume: boolean;
  inJd: boolean;
};

type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";

// Role category constants
const TECH_DEFAULT_DISTRIBUTION: RequirementQuestionDistribution = {
  mcq: 6,
  coding: 2,
  architecture: 2,
  scenario: 0,
};

const NON_TECH_DEFAULT_DISTRIBUTION: RequirementQuestionDistribution = {
  mcq: 6,
  coding: 0,
  architecture: 0,
  scenario: 4,
};

// Utility functions for role category
const normalizeRoleCategory = (value: unknown): RoleCategory | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized.includes("non-tech") ||
    normalized.includes("non tech") ||
    normalized.includes("business") ||
    normalized.includes("functional") ||
    normalized.includes("ba")
  ) {
    return "non-tech";
  }

  if (
    normalized.includes("tech") ||
    normalized.includes("technical") ||
    normalized.includes("engineering")
  ) {
    return "tech";
  }

  return null;
};

const getDefaultDistribution = (
  category: RoleCategory
): RequirementQuestionDistribution =>
  category === "tech"
    ? { ...TECH_DEFAULT_DISTRIBUTION }
    : { ...NON_TECH_DEFAULT_DISTRIBUTION };

const buildDistributionFromMix = (
  category: RoleCategory
): RequirementQuestionDistribution => {
  return getDefaultDistribution(category);
};

const getQuestionTypeMix = (
  category: RoleCategory,
  distribution: RequirementQuestionDistribution
): Record<string, number> =>
  category === "tech"
    ? {
        mcq: distribution.mcq,
        coding: distribution.coding,
        architecture: distribution.architecture,
      }
    : {
        mcq: distribution.mcq,
        scenario: distribution.scenario,
      };

const AssessmentSetupContainer: React.FC = () => {
  const navigate = useNavigate();
  const { id: assessmentId } = useParams<{ id: string }>();
  const isEditMode = Boolean(assessmentId);

  const [, setUserRole] = useState<string>("admin");
  const [rbacError, setRbacError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdId, setJdId] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragUploadProgress, setRagUploadProgress] = useState<number | null>(null);
  const [ragUploadedDocId, setRagUploadedDocId] = useState<string | null>(null);
  const [createdAssessmentId, setCreatedAssessmentId] = useState<string | null>(null);

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

  const [role, setRole] = useState("");
  const [roleError, setRoleError] = useState("");
  const [roleCategory, setRoleCategory] = useState<RoleCategory>("tech");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [jdSkills, setJdSkills] = useState<string[]>([]);
  const [skillPriorities, setSkillPriorities] = useState<Record<string, SkillPriority>>({});
  const [extractedSkillMeta, setExtractedSkillMeta] = useState<Record<string, ExtractedSkillMeta>>({});
  const [isDraft, setIsDraft] = useState(false);

  const [assessmentMethod, setAssessmentMethod] = useState("questionnaire");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const [questionDistribution, setQuestionDistribution] =
    useState<QuestionDistribution>({
      mcq: 6,
      coding: 2,
      architecture: 2,
    });

  const [screeningQuestions] =
    useState<string[]>([""]);

  const [manualQuestions, setManualQuestions] = useState<Question[]>([]);

  const [cutoffMarks, setCutoffMarks] = useState<number>(70);

  // NEW: Experience-based configuration state
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [autoAdjustByExperience, setAutoAdjustByExperience] = useState<boolean>(true);
  const [difficultyDistribution, setDifficultyDistribution] = useState<Record<string, number>>({
    easy: 0.4,
    medium: 0.4,
    hard: 0.2,
  });

  const [generationPolicy, setGenerationPolicy] = useState<GenerationPolicy>({
    mode: "llm",
    rag_pct: 0,
    llm_pct: 100,
  });

  useEffect(() => {
    if (!ragUploadedDocId) {
      setGenerationPolicy({ mode: "llm", rag_pct: 0, llm_pct: 100 });
    }
  }, [ragUploadedDocId]);

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

        if (assessment.jd_id) {
          setJdId(assessment.jd_id);
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

        if (assessment.generation_policy) {
          const ragPct = typeof assessment.generation_policy.rag_pct === "number"
            ? assessment.generation_policy.rag_pct
            : 100;
          const llmPct = typeof assessment.generation_policy.llm_pct === "number"
            ? assessment.generation_policy.llm_pct
            : Math.max(0, 100 - ragPct);
          const mode = assessment.generation_policy.mode || (ragPct === 100 ? "rag" : llmPct === 100 ? "llm" : "mix");
          setGenerationPolicy({ rag_pct: ragPct, llm_pct: llmPct, mode });
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
    if (!isEditMode && !jdFile) errors.push({ field: "jd", message: "Job description is required" });
    if (!isEditMode && !emailValid) errors.push({ field: "email", message: "Valid email is required" });
    if (!role.trim()) errors.push({ field: "role", message: "Role is required" });
    if (skills.length === 0) errors.push({ field: "skills", message: "At least one skill is required" });

    setValidationErrors(errors);
    setFormValid(errors.length === 0);
  }, [cvFile, jdFile, emailValid, role, skills, isEditMode]);

  const handleResumeTextExtracted = (text: string) => {
    if (!text) {
      return;
    }


    const parsedInfo = parseResume(text);
    const confidence = getExtractionConfidence(parsedInfo);


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

  const applyRoleCategoryPreset = (category: RoleCategory) => {
    const nextDistribution = buildDistributionFromMix(category);
    const nextTotal = Object.values(
      getQuestionTypeMix(category, nextDistribution)
    ).reduce((sum, count) => sum + count, 0);

    setRoleCategory(category);
    setQuestionDistribution(nextDistribution);
    setTotalQuestions(nextTotal);
  };

  const handleProcessFile = async () => {
    if (!cvFile) {
      setToast({ type: "error", message: "Please select a CV first" });
      return;
    }

    if (!jdFile) {
      setToast({ type: "error", message: "Please select a job description first" });
      return;
    }

    setProcessLoading(true);

    try {
      let currentJdId = jdId;
      if (!currentJdId) {
        const jdUploadResponse = await uploadService.uploadJD(jdFile);
        currentJdId = jdUploadResponse.jd_id;
        setJdId(currentJdId);
      }

      const filesToProcess = [cvFile, jdFile].filter((file): file is File => Boolean(file));
      const res = await uploadService.extractSkillsBulk(
        filesToProcess,
        "jd"
      );
      const roleResponse = await uploadService.extractRoleFromJD(jdFile);

      const extractedSkillsList = res.extracted_skills || [];
      const skillNames = extractedSkillsList.map((skill) => skill.skill_name);

      const extractedRole = candidateInfo.currentRole?.trim() || role.trim();

      if (extractedRole && !role.trim()) {
        setRole(extractedRole);
        setRoleError("");
      }
      if (skillNames.length > 0) {
        setSkills(skillNames);
        setSkillsError("");
      }

      const documents = res.documents || [];
      const resumeDocument = documents[0];
      const jdDocument = documents[1];

      const jdSkillsList = jdDocument?.extracted_skills || [];
      if (jdSkillsList.length > 0) {
        setJdSkills(Array.from(new Set(jdSkillsList.map((skill) => skill.skill_name))));
      } else {
        setJdSkills([]);
      }

      const resumeSkillSet = new Set(
        (resumeDocument?.extracted_skills || [])
          .map((skill) => skill.skill_name.toLowerCase())
      );

      const jdSkillSet = new Set(
        (jdDocument?.extracted_skills || [])
          .map((skill) => skill.skill_name.toLowerCase())
      );

      const nextSkillMeta = extractedSkillsList.reduce<Record<string, ExtractedSkillMeta>>((acc, skill) => {
        const key = skill.skill_name.toLowerCase();
        acc[key] = {
          category: skill.category,
          frequency: skill.frequency,
          inResume: resumeSkillSet.has(key),
          inJd: jdSkillSet.has(key),
        };
        return acc;
      }, {});
      setExtractedSkillMeta(nextSkillMeta);

        const nextSkillPriorities = extractedSkillsList.reduce<Record<string, SkillPriority>>((acc, skill) => {
        const meta = nextSkillMeta[skill.skill_name.toLowerCase()];
        if (meta?.category === "soft") {
          acc[skill.skill_name] = "soft";
        } else if (meta?.inResume && meta?.inJd) {
          acc[skill.skill_name] = "good-to-have";
        } else if (meta?.inJd && !meta?.inResume) {
          acc[skill.skill_name] = "must-have";
        } else if (meta?.inResume && !meta?.inJd) {
          acc[skill.skill_name] = "resume-based";
        } else {
          acc[skill.skill_name] = "good-to-have";
        }
        return acc;
      }, {});
      setSkillPriorities(nextSkillPriorities);

      // Apply role category preset based on extracted role and skills
      const resolvedCategory =normalizeRoleCategory(roleResponse?.role_type) ??
                              normalizeRoleCategory(roleResponse?.role_category) ??
                              normalizeRoleCategory(roleResponse?.category) ?? "tech";
      
      applyRoleCategoryPreset(resolvedCategory);

      setToast({
        type: "success",
        message: res.message || `Processed ${filesToProcess.length} document(s) and extracted ${skillNames.length} skills successfully!`,
      });
    } catch (err: any) {
      console.error("Error processing resume:", err);
      const errorMessage = err.response?.data?.detail || "Failed to process resume. Please try again.";
      setToast({ type: "error", message: errorMessage });
    } finally {
      setProcessLoading(false);
    }
  };

  const handleSubmit = async (skipValidation = false) => {
    // Skip validation when called from Question Bank buttons with minimal info
    if (!skipValidation && !formValid) {
      setToast({ type: "error", message: "Please complete all required fields" });
      return;
    }

    setSubmitLoading(true);

    try {
  const requiredSkills = skills.reduce((acc, skill) => {
    const key = skill.toLowerCase();
    const meta = extractedSkillMeta[key];
    const inResume = Boolean(meta?.inResume);
    const inJd = Boolean(meta?.inJd);
    const isSoft = meta?.category === "soft";

    let level = "beginner";
    if (inResume && inJd) {
      level = "advanced";
    } else if (inResume) {
      level = "intermediate";
    } else if (inJd) {
      level = "beginner";
    }

    if (isSoft) {
      level = "soft";
    }

    acc[skill] = level;
    return acc;
  }, {} as Record<string, string>);

  const assessmentPayload: any = {
    title: `Assessment for ${role}`,
    description: `Assessment created for candidate ${candidateInfo.name || candidateInfo.email || 'admin'}`,
    job_title: role.trim(),
    jd_id: jdId || undefined,

    required_skills: requiredSkills,

    skill_priorities: skillPriorities,  // ✅ NEW: Add skill priorities (must-have / good-to-have)
    is_draft: isDraft,  // ✅ NEW: Mark as draft
    is_published: !isDraft,  // Don't publish drafts

    required_roles: [role.trim()],
    duration_minutes: 30,

    is_questionnaire_enabled: assessmentMethod === "questionnaire",
    is_interview_enabled: assessmentMethod === "interview",

    // ✅ ADD THIS — Screening questions sent to BE
    screening_questions: screeningQuestions
      .map(q => q.trim())
      .filter(Boolean),

    // ✅ NEW: Include manual questions in the payload
    manual_questions: manualQuestions.map(q => ({
      question_text: q.question_text,
      type: q.type,
      difficulty: q.difficulty,
      skill: q.skill || '',
      options: q.options || [],
      correct_answer: q.correct_answer || '',
      code_template: q.code_template,
      constraints: q.constraints,
      test_cases: q.test_cases,
      time_limit: q.time_limit,
    })),

    // NEW: Experience-based question configuration
    total_questions: totalQuestions,
    question_type_mix: questionDistribution, // This maps to the backend's question_type_mix
    passing_score_threshold: cutoffMarks,
    auto_adjust_by_experience: autoAdjustByExperience,
    difficulty_distribution: difficultyDistribution,
    generation_policy: generationPolicy,
  };

  // Only add candidate_info if we have email (required by backend)
  if (candidateInfo.email || candidateInfo.name) {
    assessmentPayload.candidate_info = {
      name: candidateInfo.name || 'Candidate',
      email: candidateInfo.email || 'admin@example.com',
      experience: candidateInfo.experience,
      current_role: candidateInfo.currentRole,
    };
  }

  if (assessmentMethod === "questionnaire") {
    assessmentPayload.questionnaire_config = {
      mcq: questionDistribution.mcq,
      coding: questionDistribution.coding,
      architecture: questionDistribution.architecture,
      role_type: roleCategory,
      doc_id: ragUploadedDocId,
    };
  }

  if (expiresAt) {
    assessmentPayload.expires_at = new Date(expiresAt).toISOString();
  }

  const response = isEditMode
    ? await assessmentService.updateAssessment(assessmentId!, assessmentPayload)
    : await assessmentService.createAssessment(assessmentPayload);

  const resultAssessmentId = response?.assessment_id;
  // store created id for subsequent actions (upload/generation)
  if (resultAssessmentId) setCreatedAssessmentId(resultAssessmentId);
  const generatedLink = `${window.location.origin}/candidate-assessment/${resultAssessmentId}`;

  setAssessmentLink(generatedLink);
  setShowAssessmentLinkModal(true);

  setToast({
    type: "success",
    message: isEditMode
      ? "Assessment updated successfully!"
      : "Assessment created successfully!",
  });

  // If a Question Bank file was selected during create, upload it automatically (but do NOT auto-generate)
  if (ragFile && resultAssessmentId) {
    try {
      setToast({ type: "info", message: "Uploading Question Bank document..." });
      setRagUploadProgress(0);
      const res = await uploadService.uploadQuestionDoc(ragFile, resultAssessmentId, (p) => setRagUploadProgress(p));
      setRagUploadedDocId(res.doc_id);
      setToast({ type: "success", message: `Question Bank document uploaded (doc id: ${res.doc_id})` });
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || "Failed to upload Question Bank document";
      setToast({ type: "error", message: errorMessage });
    } finally {
      setRagUploadProgress(null);
    }
  }
} catch (err: any) {
  console.error("Error submitting assessment:", err);
  const errorMessage =
    err.response?.data?.detail ||
    "Failed to create assessment. Please try again.";
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
            ? "Update assessment details, role, and settings."
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

    {!isEditMode && (
      <section className="card upload-card">
        <div className="card-header source-documents-header">
          <h2>Source Documents</h2>
        </div>

        <div className="source-documents-grid">
          <div className="source-document-card">
            <div className="source-document-icon">
              <FiFileText size={26} />
            </div>
            <div className="source-document-copy">
              <h3>Upload Resume</h3>
              <p>PDF, DOCX up to 10MB</p>
            </div>

            <FileUpload
              label="Upload Resume"
              onFileSelect={setCvFile}
              onTextExtracted={handleResumeTextExtracted}
              isRequired
            />
          </div>

          <div className="source-document-card">
            <div className="source-document-icon">
              <FiBriefcase size={26} />
            </div>
            <div className="source-document-copy">
              <h3>Job Description</h3>
              <p>Extract skills & context</p>
            </div>

            <FileUpload
              label="Job Description"
              onFileSelect={(file) => {
                setJdFile(file);
                setJdId(null);
              }}
              isRequired
            />
          </div>
        </div>

        <div className="card-actions">
          <button
            className="btn primary"
            onClick={handleProcessFile}
            disabled={!cvFile || !jdFile || processLoading}
          >
            {processLoading ? "Processing..." : "Extract Role & Skills"}
          </button>
        </div>
      </section>
     )}

      {!isEditMode && (<section className="card question-source-card">
        <div className="card-header">
          <h2>Question Source Document (Optional)</h2>
          <p className="hint">Upload a document to generate assessment questions based on its content</p>
        </div>

        <div className="rag-upload-shell">
          <div className="source-document-card source-document-card--single source-document-card--ai">
            <div className="source-document-icon source-document-icon--ai">
              <FiCpu size={26} />
            </div>
            <div className="source-document-copy">
              <h3>Question Source Document</h3>
              <p>Use AI + document context to generate targeted questions</p>
            </div>

            <FileUpload label="Question Source Document" onFileSelect={setRagFile} />
          </div>
        </div>

        <div className="rag-upload-actions">
          <button
            className="btn primary"
            onClick={async () => {
              if (!ragFile) {
                setToast({ type: 'error', message: 'Select a Question Bank document first' });
                return;
              }
              const targetAssessmentId = isEditMode ? assessmentId : createdAssessmentId;

              try {
                setToast({ type: "info", message: "Uploading Question Bank document..." });
                setRagUploadProgress(0);
                const res = await uploadService.uploadQuestionDoc(ragFile, targetAssessmentId ?? undefined, (p) => setRagUploadProgress(p));
                setRagUploadedDocId(res.doc_id);
                setToast({ type: 'success', message: `Question Bank uploaded (doc: ${res.doc_id})` });
              } catch (err: any) {
                const msg = err.response?.data?.detail || 'Failed to upload Question Bank document';
                setToast({ type: 'error', message: msg });
              } finally {
                setRagUploadProgress(null);
              }
            }}
          >
            Upload
          </button>

          {/*<button
            className="btn btn-primary"
            onClick={async () => {
              // If assessment doesn't exist, create it first
              let targetAssessmentId = isEditMode ? assessmentId : createdAssessmentId;
              if (!targetAssessmentId) {
                // Check minimum required fields
                if (!role.trim()) {
                  setToast({ type: 'error', message: 'Please enter Role before generating questions' });
                  return;
                }
                if (skills.length === 0) {
                  setToast({ type: 'error', message: 'Please add at least one Skill before generating questions' });
                  return;
                }
                if (!cvFile && !candidateInfo.email) {
                  setToast({ type: 'error', message: 'Please upload CV or enter candidate email before generating questions' });
                  return;
                }
                
                setToast({ type: 'info', message: 'Creating assessment first...' });
                await handleSubmit(true); // Skip strict validation for Question Bank auto-create
                // After handleSubmit, createdAssessmentId should be set
                targetAssessmentId = createdAssessmentId;
                if (!targetAssessmentId) {
                  setToast({ type: 'error', message: 'Failed to create assessment. Please try again.' });
                  return;
                }
              }
              
              try {
                const res = await questionGenService.startGenerationForAssessment(targetAssessmentId, totalQuestions, 'question_bank');
                setToast({ type: 'success', message: `Generation queued (task: ${res.task_id})` });
              } catch (err: any) {
                const msg = err.response?.data?.detail || 'Failed to start generation';
                setToast({ type: 'error', message: msg });
              }
            }}
            disabled={!ragUploadedDocId && !ragFile}
          >
            Generate Questions (From Question Bank)
          </button>*/}

          {ragUploadProgress !== null && (
            <div className="rag-upload-progress">{ragUploadProgress}%</div>
          )}
        </div>
      </section>
      )}

      {ragUploadedDocId && (
        <GenerationPolicySelector
          value={generationPolicy}
          onChange={setGenerationPolicy}
        />
      )}

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
          skillPriorities={skillPriorities}
          onSkillPriorityChange={(skill, priority) => {
            setSkillPriorities({ ...skillPriorities, [skill]: priority });
          }}
        />

        {!isEditMode && (
          <div className="role-category-display">
            <label>Role Category</label>
            <div className={`role-category-badge role-category-${roleCategory}`}>
              {roleCategory === "tech" ? "Technical Role" : "Non-Technical Role"}
            </div>
          </div>
        )}
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
      </section>



      {!isEditMode && (
      <AssessmentConfigurationBlock
        role_type={roleCategory}
        questionDistribution={questionDistribution}
        onQuestionDistributionChange={setQuestionDistribution}
        cutoffMarks={cutoffMarks}
        onCutoffMarksChange={setCutoffMarks}
        totalQuestions={totalQuestions}
        onTotalQuestionsChange={setTotalQuestions}
        autoAdjustByExperience={autoAdjustByExperience}
        onAutoAdjustByExperienceChange={setAutoAdjustByExperience}
        difficultyDistribution={difficultyDistribution}
        onDifficultyDistributionChange={setDifficultyDistribution}
      />
     )}

      <section className="card questions-card">
        <div className="card-header">
          <h2>{isEditMode ? "Add Questions" : "Manual Question Management"}</h2>
          <p className="hint">Add, edit, or reorder questions manually for this assessment</p>
        </div>

        <AssessmentQuestionEditor
          questions={manualQuestions}
          onQuestionsChange={setManualQuestions}
        />
      </section>

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
        <button
          className="btn btn-secondary"
          onClick={() => {
            setIsDraft(true);
            handleSubmit(true);
          }}
          disabled={submitLoading}
          style={{ marginRight: '1rem' }}
        >
          {submitLoading && isDraft ? 'Saving Draft...' : 'Save as Draft'}
        </button>
        
        <AssessmentSetupSubmitButton
          disabled={!formValid || submitLoading}
          loading={submitLoading && !isDraft}
          onClick={() => {
            setIsDraft(false);
            handleSubmit();
          }}
          validationCount={validationErrors.length}
          label={isEditMode ? "Update Assessment" : "Create Assessment"}
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