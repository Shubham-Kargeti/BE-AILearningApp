import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBriefcase,
  FiClipboard,
  FiLayers,
  FiTarget,
} from "react-icons/fi";
import {
  assessmentService,
  uploadService,
  type RoleExtractionResponse,
  type ExtractedSkill,
} from "../../API/services";
import Toast from "../../components/Toast/Toast";
import AIProcessingOverlay from "../../components/AIProcessingOverlay";
import FileUpload from "../AssessmentSetupContainer/components/FileUpload";
import RoleSkillPlaceholder from "../AssessmentSetupContainer/components/RoleSkillPlaceholder";
import type { SkillConfiguration } from "../AssessmentSetupContainer/components/RoleSkillPlaceholder";
import AssessmentSetupSubmitButton from "../AssessmentSetupContainer/components/AssessmentSetupSubmitButton";
import AssessmentLinkModal from "../AssessmentSetupContainer/components/AssessmentLinkModal";
import "./AdminRequirement.scss";

type RoleCategory = "tech" | "non-tech";
type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";

interface ValidationError {
  field: string;
  message: string;
}

interface RequirementQuestionDistribution {
  mcq: number;
  coding: number;
  architecture: number;
  scenario: number;
}

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

const TECH_ROLE_KEYWORDS = [
  "developer",
  "engineer",
  "architect",
  "qa",
  "sdet",
  "data",
  "machine learning",
  "ai",
  "devops",
  "cloud",
  "frontend",
  "backend",
  "full stack",
  "software",
  "security",
  "platform",
  "android",
  "ios",
  "technical",
];

const NON_TECH_ROLE_KEYWORDS = [
  "business analyst",
  "ba",
  "product",
  "project",
  "operations",
  "hr",
  "recruiter",
  "sales",
  "marketing",
  "finance",
  "customer success",
  "support",
  "non tech",
  "non-technical",
  "functional",
  "delivery",
];

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

const inferRoleCategory = (role: string, skills: string[]): RoleCategory => {
  const haystack = `${role} ${skills.join(" ")}`.toLowerCase();

  if (NON_TECH_ROLE_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "non-tech";
  }

  if (TECH_ROLE_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return "tech";
  }

  return "tech";
};

// const getNumericValue = (
//   source: Record<string, unknown> | undefined,
//   key: string
// ): number | undefined => {
//   const value = source?.[key];
//   return typeof value === "number" ? value : undefined;
// };

const getDefaultDistribution = (
  category: RoleCategory
): RequirementQuestionDistribution =>
  category === "tech"
    ? { ...TECH_DEFAULT_DISTRIBUTION }
    : { ...NON_TECH_DEFAULT_DISTRIBUTION };

const buildDistributionFromMix = (
  category: RoleCategory,
  // mix?: Record<string, unknown>
): RequirementQuestionDistribution => {
  const defaults = getDefaultDistribution(category);

  // if (!mix) {
  //   return defaults;
  // }
  return defaults;

  // if (category === "tech") {
  //   return {
  //     mcq: getNumericValue(mix, "mcq") ?? defaults.mcq,
  //     coding: getNumericValue(mix, "coding") ?? defaults.coding,
  //     architecture:
  //       getNumericValue(mix, "architecture") ?? defaults.architecture,
  //     scenario: 0,
  //   };
  // }

  // return {
  //   mcq: getNumericValue(mix, "mcq") ?? defaults.mcq,
  //   coding: 0,
  //   architecture: 0,
  //   scenario:
  //     getNumericValue(mix, "scenario") ??
  //     getNumericValue(mix, "ba") ??
  //     defaults.scenario,
  // };
};

const mapSkillNames = (
  values?: Array<string | { skill_name?: string }>
): string[] => {
  if (!values) {
    return [];
  }

  const names = values
    .map((value) =>
      typeof value === "string" ? value.trim() : value.skill_name?.trim() ?? ""
    )
    .filter(Boolean);

  return Array.from(new Set(names));
};

const normalizeProficiencyLevel = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["beginner", "intermediate", "advanced"].includes(normalized)) {
    return normalized;
  }
  if (["basic", "easy", "junior"].includes(normalized)) return "beginner";
  if (["medium", "mid", "proficient"].includes(normalized)) return "intermediate";
  if (["hard", "senior", "high", "expert", "lead", "principal"].includes(normalized)) return "advanced";
  return "intermediate";
};

const fallbackLevelFromPriority = (priority?: SkillPriority) => {
  if (priority === "must-have" || priority === "good-to-have") return "advanced";
  return "intermediate";
};

const priorityFromExtractedSkill = (skill: ExtractedSkill): SkillPriority => {
  if (skill.category === "soft") return "soft";
  if (skill.source === "resume") return "resume-based";
  if (skill.priority === "critical" || skill.priority === "high" || skill.source === "jd" || skill.source === "both") {
    return "must-have";
  }
  return "good-to-have";
};

const extractRoleName = (
  ...responses: Array<
    Partial<RoleExtractionResponse> | undefined
  >
): string => {
  for (const response of responses) {
    if (typeof response?.role === "string" && response.role.trim()) {
      return response.role.trim();
    }
  }

  return "";
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

const AdminRequirement: React.FC = () => {
  const navigate = useNavigate();

  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdId, setJdId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [roleError, setRoleError] = useState("");
  const [roleCategory, setRoleCategory] = useState<RoleCategory>("tech");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsError, setSkillsError] = useState("");
  // const [skillDurations, setSkillDurations] = useState<Record<string, number>>(
  //   {}
  // );
  const [skillPriorities, setSkillPriorities] = useState<Record<string, SkillPriority>>({});
  const [skillConfig, setSkillConfig] = useState<Record<string, SkillConfiguration>>({});
  const [questionDistribution, setQuestionDistribution] =
    useState<RequirementQuestionDistribution>(TECH_DEFAULT_DISTRIBUTION);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [cutoffMarks, setCutoffMarks] = useState(70);
  const [expiresAt, setExpiresAt] = useState("");
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>({});
  const [processLoading, setProcessLoading] = useState(false);
  const processLoadingRef = useRef(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [showAssessmentLinkModal, setShowAssessmentLinkModal] = useState(false);
  const [assessmentLink, setAssessmentLink] = useState("");

  const updateSkillConfig = (skill: string, patch: Partial<SkillConfiguration>) => {
    const key = skill.toLowerCase();
    setSkillConfig((prev) => {
      const existing = prev[key] || {
        skill_name: skill,
        extracted_level: normalizeProficiencyLevel(skillLevels[key]),
        effective_level: normalizeProficiencyLevel(skillLevels[key]),
        level_source: "llm" as const,
      };
      const next = {
        ...existing,
        ...patch,
        skill_name: patch.skill_name || existing.skill_name || skill,
      };
      return {
        ...prev,
        [key]: {
          ...next,
          extracted_level: normalizeProficiencyLevel(next.extracted_level),
          effective_level: normalizeProficiencyLevel(next.effective_level),
          override_level: next.override_level ? normalizeProficiencyLevel(next.override_level) : undefined,
        },
      };
    });
  };

  const effectiveQuestionTypeMix = useMemo(
    () => getQuestionTypeMix(roleCategory, questionDistribution),
    [roleCategory, questionDistribution]
  );

  const distributionTotal = useMemo(
    () =>
      Object.values(effectiveQuestionTypeMix).reduce(
        (sum, count) => sum + count,
        0
      ),
    [effectiveQuestionTypeMix]
  );

  useEffect(() => {
    const errors: ValidationError[] = [];

    if (!jdFile) {
      errors.push({ field: "jd", message: "Job description is required" });
    }

    if (!role.trim()) {
      errors.push({ field: "role", message: "Role is required" });
    }

    if (skills.length === 0) {
      errors.push({
        field: "skills",
        message: "At least one required skill is required",
      });
    }

    if (totalQuestions <= 0) {
      errors.push({
        field: "total_questions",
        message: "Total questions must be greater than 0",
      });
    }

    if (distributionTotal !== totalQuestions) {
      errors.push({
        field: "question_mix",
        message: `Question type totals must equal ${totalQuestions}`,
      });
    }

    setValidationErrors(errors);
    setFormValid(errors.length === 0);
  }, [distributionTotal, jdFile, role, skills, totalQuestions]);

  const applyRoleCategoryPreset = (
    category: RoleCategory,
    // mix?: Record<string, unknown>
  ) => {
    // const nextDistribution = buildDistributionFromMix(category, mix);
    const nextDistribution = buildDistributionFromMix(category);
    const nextTotal = Object.values(
      getQuestionTypeMix(category, nextDistribution)
    ).reduce((sum, count) => sum + count, 0);

    setRoleCategory(category);
    setQuestionDistribution(nextDistribution);
    setTotalQuestions(nextTotal);
  };

  const handleQuestionCountChange = (
    key: keyof RequirementQuestionDistribution,
    value: number
  ) => {
    setQuestionDistribution((prev) => ({
      ...prev,
      [key]: Math.max(0, value),
    }));
  };

  const handleExtractRoleAndSkills = async () => {
    if (processLoadingRef.current) {
      return;
    }

    if (!jdFile) {
      setToast({ type: "error", message: "Please upload a JD first" });
      return;
    }

    processLoadingRef.current = true;
    setProcessLoading(true);
    setRoleError("");
    setSkillsError("");

    try {
      let currentJdId = jdId;

      if (!currentJdId) {
        const jdUploadResponse = await uploadService.uploadJD(jdFile);
        currentJdId = jdUploadResponse.jd_id;
        setJdId(currentJdId);
      }

      const [skillsResult, roleResult] = await Promise.allSettled([
        uploadService.extractSkillsFromJD(jdFile),
        uploadService.extractRoleFromJD(jdFile),
      ]);

      if (
        skillsResult.status === "rejected" &&
        roleResult.status === "rejected"
      ) {
        throw skillsResult.reason ?? roleResult.reason;
      }

      const skillsResponse =
        skillsResult.status === "fulfilled" ? skillsResult.value : undefined;
      const roleResponse =
        roleResult.status === "fulfilled" ? roleResult.value : undefined;

      const extractedSkillDetails = skillsResponse?.extracted_skills ?? [];
      const extractedSkills = mapSkillNames(extractedSkillDetails);
      const extractedRole = extractRoleName(roleResponse) || skillsResponse?.extraction_summary?.role || "";
      const resolvedCategory =
        normalizeRoleCategory(roleResponse?.role_type) ??
        normalizeRoleCategory(skillsResponse?.extraction_summary?.role_type) ??
        normalizeRoleCategory(roleResponse?.role_category) ??
        normalizeRoleCategory(roleResponse?.category) ??
        inferRoleCategory(extractedRole, extractedSkills);

      // const returnedQuestionConfig =
      //   roleResponse?.question_type_mix ??
      //   (roleResponse?.questionnaire_config as Record<string, unknown> | undefined);

      if (extractedRole) {
        setRole(extractedRole);
      }

     if (extractedSkills.length > 0) {
        setSkills(extractedSkills);
        setSkillPriorities(
          extractedSkillDetails.reduce<Record<string, SkillPriority>>(
            (acc, skill) => {
              acc[skill.skill_name] = priorityFromExtractedSkill(skill);
              return acc;
            },
            {}
          )
        );
        setSkillLevels(
          extractedSkillDetails.reduce<Record<string, string>>((acc, skill) => {
            acc[skill.skill_name.toLowerCase()] = normalizeProficiencyLevel(skill.proficiency_level);
            return acc;
          }, {})
        );
        setSkillConfig(
          extractedSkillDetails.reduce<Record<string, SkillConfiguration>>((acc, skill) => {
            const level = normalizeProficiencyLevel(skill.proficiency_level);
            acc[skill.skill_name.toLowerCase()] = {
              skill_name: skill.skill_name,
              extracted_level: level,
              effective_level: level,
              level_source: "llm",
              confidence: skill.confidence,
              matched_with_jd: Boolean(skill.matched_with_jd),
              priority: skill.priority || "high",
              category: skill.category,
              source: skill.source,
              inferred: Boolean(skill.inferred),
              evidence: skill.evidence,
            };
            return acc;
          }, {})
        );
}

      // if (skillsResponse?.skill_durations) {
      //   setSkillDurations(skillsResponse.skill_durations);
      // }

      // applyRoleCategoryPreset(resolvedCategory, returnedQuestionConfig);
      applyRoleCategoryPreset(resolvedCategory);

      const extractedCount = extractedSkills.length;
      const fallbackUsed = roleResult.status === "rejected";
      const roleMessage = extractedRole
        ? `Role: ${extractedRole}`
        : `Role type set to ${resolvedCategory}`;

      setToast({
        type: "success",
        message: fallbackUsed
          ? `JD processed. Extracted ${extractedCount} skills. ${roleMessage}.`
          : `JD processed. Extracted ${extractedCount} skills and role classification.`,
      });
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ||
        "Failed to extract role and skills from the JD.";
      setToast({ type: "error", message: errorMessage });
    } finally {
      processLoadingRef.current = false;
      setProcessLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formValid) {
      setToast({
        type: "error",
        message: "Please complete the required fields before creating the assessment.",
      });
      return;
    }

    if (!jdFile) {
      setToast({ type: "error", message: "Job description is required" });
      return;
    }

    setSubmitLoading(true);

    try {
      let currentJdId = jdId;

      if (!currentJdId) {
        const jdUploadResponse = await uploadService.uploadJD(jdFile);
        currentJdId = jdUploadResponse.jd_id;
        setJdId(currentJdId);
      }

      const assessmentPayload = {
        title: `Assessment for ${role.trim()}`,
        description: `Assessment created from JD for ${role.trim()}`,
        job_title: role.trim(),
        jd_id: currentJdId ?? undefined,
        required_skills: skills.reduce<Record<string, string>>((acc, skill) => {
            acc[skill] = normalizeProficiencyLevel(
              skillConfig[skill.toLowerCase()]?.effective_level ||
              skillLevels[skill.toLowerCase()] ||
              fallbackLevelFromPriority(skillPriorities[skill])
            );
            return acc;
          }, {}),
        skill_configuration: skills.reduce<Record<string, SkillConfiguration>>((acc, skill) => {
          const key = skill.toLowerCase();
          const effectiveLevel = normalizeProficiencyLevel(
            skillConfig[key]?.effective_level || skillLevels[key] || fallbackLevelFromPriority(skillPriorities[skill])
          );
          acc[skill] = {
            skill_name: skill,
            extracted_level: normalizeProficiencyLevel(skillConfig[key]?.extracted_level || skillLevels[key] || effectiveLevel),
            effective_level: effectiveLevel,
            level_source: skillConfig[key]?.level_source || "llm",
            override_experience_years: skillConfig[key]?.override_experience_years,
            override_level: skillConfig[key]?.override_level,
            confidence: skillConfig[key]?.confidence,
            matched_with_jd: skillConfig[key]?.matched_with_jd,
            priority: skillConfig[key]?.priority || skillPriorities[skill],
            category: skillConfig[key]?.category,
            source: skillConfig[key]?.source,
            inferred: skillConfig[key]?.inferred,
            evidence: skillConfig[key]?.evidence,
          };
          return acc;
        }, {}),
        skill_priorities: skillPriorities,
        is_draft: false,
        is_published: true,
        required_roles: [role.trim()],
        duration_minutes: 30,
        is_questionnaire_enabled: true,
        is_interview_enabled: false,
        screening_questions: [],
        manual_questions: [],
        total_questions: totalQuestions,
        question_type_mix: effectiveQuestionTypeMix,
        questionnaire_config: {
          ...effectiveQuestionTypeMix,
          role_type: roleCategory,
          skill_intelligence: skills.reduce<Record<string, SkillConfiguration>>((acc, skill) => {
            const key = skill.toLowerCase();
            const effectiveLevel = normalizeProficiencyLevel(
              skillConfig[key]?.effective_level || skillLevels[key] || fallbackLevelFromPriority(skillPriorities[skill])
            );
            acc[skill] = {
              skill_name: skill,
              extracted_level: normalizeProficiencyLevel(skillConfig[key]?.extracted_level || skillLevels[key] || effectiveLevel),
              effective_level: effectiveLevel,
              level_source: skillConfig[key]?.level_source || "llm",
              override_experience_years: skillConfig[key]?.override_experience_years,
              override_level: skillConfig[key]?.override_level,
              confidence: skillConfig[key]?.confidence,
              matched_with_jd: skillConfig[key]?.matched_with_jd,
              priority: skillConfig[key]?.priority || skillPriorities[skill],
              category: skillConfig[key]?.category,
              source: skillConfig[key]?.source,
              inferred: skillConfig[key]?.inferred,
              evidence: skillConfig[key]?.evidence,
            };
            return acc;
          }, {}),
        },
        passing_score_threshold: cutoffMarks,
        auto_adjust_by_experience: false,
        expires_at: expiresAt
          ? new Date(expiresAt).toISOString()
          : undefined,
      };

      const response = await assessmentService.createAssessment(assessmentPayload);
      const resultAssessmentId = response.assessment_id;

      if (resultAssessmentId) {
        setAssessmentLink(
          `${window.location.origin}/candidate-assessment/${resultAssessmentId}`
        );
        setShowAssessmentLinkModal(true);
      }

      setToast({
        type: "success",
        message: "Assessment created successfully.",
      });
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ||
        "Failed to create assessment. Please try again.";
      setToast({ type: "error", message: errorMessage });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="admin-requirement-page">
      <AIProcessingOverlay
        open={processLoading}
        title="Extracting role and skills"
        subtitle="We are scanning the job description, classifying the role, and extracting the most relevant skills."
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <header className="admin-requirement-hero">
        <div>
          <h1>Admin Requirement Setup</h1>
          <p>
            Upload a job description to generate a tailored, 
            role-based assessment powered by AI skill extraction.
          </p>
        </div>
      </header>

      <section className="card upload-card">
        <div className="card-header">
          <h2>Job Description</h2>
          <p className="hint">
            JD upload is the only source document here. No CV is needed for this
            flow.
          </p>
        </div>

        <div className="source-card">
          <div className="source-icon">
            <FiBriefcase size={24} />
          </div>

          <div className="source-copy">
            <h3>Upload JD</h3>
            <p>Supported: PDF, DOCX, TXT up to 10MB</p>
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

        <div className="card-actions">
          <button
            type="button"
            className="btn primary"
            onClick={handleExtractRoleAndSkills}
            disabled={!jdFile || processLoading}
          >
            {processLoading ? "Extracting..." : "Extract Role & Skills"}
          </button>
        </div>
      </section>

      <section className="card details-card">
        <div className="card-header">
          <h2>Requirement Details</h2>
          <p className="hint">
            Review or edit the extracted role and skills before creating the
            assessment.
          </p>
        </div>

        <div className="role-type-toggle">
          <span className="toggle-label">Role Type</span>
          <div className="toggle-actions">
            <button
              type="button"
              className={roleCategory === "tech" ? "active" : ""}
              onClick={() => applyRoleCategoryPreset("tech")}
            >
              Tech
            </button>
            <button
              type="button"
              className={roleCategory === "non-tech" ? "active" : ""}
              onClick={() => applyRoleCategoryPreset("non-tech")}
            >
              Non-Tech
            </button>
          </div>
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
          skillPriorities={skillPriorities}
          skillLevels={skillLevels}
          skillConfig={skillConfig}
          onSkillConfigChange={updateSkillConfig}
          onSkillPriorityChange={(skill, priority) => {
            setSkillPriorities((prev) => ({
              ...prev,
              [skill]: priority,
            }));
            updateSkillConfig(skill, {
              priority,
              category: priority === "soft" ? "soft" : skillConfig[skill.toLowerCase()]?.category,
            });
          }}
        />
      </section>

      <section className="card configuration-card">
        <div className="card-header">
          <h2>Question Configuration</h2>
          <p className="hint">
            Question types switch automatically with the role type. Tech uses
            MCQ, Coding, Architecture. Non-tech uses MCQ and Scenario type.
          </p>
        </div>

        <div className="config-grid">
          <div className="config-field">
            <label>
              <FiLayers size={16} />
              Total Questions
            </label>
            <input
              type="number"
              min={1}
              value={totalQuestions}
              onChange={(e) =>
                setTotalQuestions(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>

          <div className="config-field">
            <label>
              <FiTarget size={16} />
              Cutoff Marks
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={cutoffMarks}
              onChange={(e) =>
                setCutoffMarks(
                  Math.min(100, Math.max(0, Number(e.target.value) || 0))
                )
              }
            />
          </div>

        </div>

        <div className="question-type-section">
          <div className="section-label">
            <FiClipboard size={16} />
            <span>
              {roleCategory === "tech"
                ? "Question Type Mix"
                : "Question Type Mix (Non-Tech flow)"}
            </span>
          </div>

          <div className="question-type-grid">
            <div className="config-field">
              <label>MCQ</label>
              <input
                type="number"
                min={0}
                value={questionDistribution.mcq}
                onChange={(e) =>
                  handleQuestionCountChange("mcq", Number(e.target.value) || 0)
                }
              />
            </div>

            {roleCategory === "tech" ? (
              <>
                <div className="config-field">
                  <label>Coding</label>
                  <input
                    type="number"
                    min={0}
                    value={questionDistribution.coding}
                    onChange={(e) =>
                      handleQuestionCountChange(
                        "coding",
                        Number(e.target.value) || 0
                      )
                    }
                  />
                </div>

                <div className="config-field">
                  <label>Architecture</label>
                  <input
                    type="number"
                    min={0}
                    value={questionDistribution.architecture}
                    onChange={(e) =>
                      handleQuestionCountChange(
                        "architecture",
                        Number(e.target.value) || 0
                      )
                    }
                  />
                </div>
              </>
            ) : (
              <div className="config-field">
                <label>Scenario Type</label>
                <input
                  type="number"
                  min={0}
                  value={questionDistribution.scenario}
                  onChange={(e) =>
                    handleQuestionCountChange(
                      "scenario",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </div>
            )}
          </div>

          <p
            className={`config-summary ${
              distributionTotal !== totalQuestions ? "invalid" : ""
            }`}
          >
            Current total: <strong>{distributionTotal}</strong> / {totalQuestions}
          </p>
        </div>
      </section>

      <section className="card expiry-card">
        <div className="card-header">
          <h2>Assessment Expiry</h2>
          <p className="hint">
            Optional. Leave empty if this requirement-generated assessment
            should not expire.
          </p>
        </div>

        <div className="expiry-field">
          <label htmlFor="expiresAt">Expiry Date & Time</label>
          <input
            id="expiresAt"
            type="datetime-local"
            value={expiresAt}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </section>

      {validationErrors.length > 0 && (
        <section className="validation-summary">
          <h3>Please complete the following</h3>
          <ul>
            {validationErrors.map((error) => (
              <li key={error.field}>{error.message}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="footer-actions">
        <AssessmentSetupSubmitButton
          disabled={!formValid || submitLoading}
          loading={submitLoading}
          onClick={handleSubmit}
          validationCount={validationErrors.length}
          label="Create Assessment"
          loadingLabel="Creating Assessment..."
        />
      </div>

      <AssessmentLinkModal
        open={showAssessmentLinkModal}
        link={assessmentLink}
        email=""
        onClose={() => {
          setShowAssessmentLinkModal(false);
          navigate("/admin/dashboard");
        }}
      />
    </div>
  );
};

export default AdminRequirement;
