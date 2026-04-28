import "../../AssessmentSetupContainer/components/AssessmentLinkModal.scss";
import React, { useEffect, useMemo, useState } from "react";
import type { Assessment } from "../../../API/services";
import QuestionnaireConfig from "../../AssessmentSetupContainer/components/QuestionnaireConfig";
import TotalQuestions from "../../AssessmentSetupContainer/components/TotalQuestions";
import { type SkillLevel } from "../../AssessmentSetupContainer/components/RoleSkillPlaceholder";

type RoleCategory = "tech" | "non-tech";

type QuestionDistribution = {
  mcq: number;
  coding: number;
  architecture: number;
  scenario: number;
};

type GenerateMoreOverrides = {
  requiredSkills: Record<string, string>;
  totalQuestions: number;
  questionTypeMix: Record<string, number>;
  roleCategory: RoleCategory;
};

interface Props {
  open: boolean;
  assessment: Assessment | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (overrides: GenerateMoreOverrides) => Promise<void>;
}

const normalizeSkillLevel = (value?: string): SkillLevel => {
  if (value === "beginner" || value === "advanced") {
    return value;
  }
  return "intermediate";
};

const deriveRoleCategory = (assessment: Assessment): RoleCategory => {
  if (assessment.generation_policy?.role_type === "non-tech") {
    return "non-tech";
  }
  return (assessment.question_type_mix?.scenario || 0) > 0 ? "non-tech" : "tech";
};

const buildInitialDistribution = (assessment: Assessment): QuestionDistribution => ({
  mcq: assessment.question_type_mix?.mcq || 0,
  coding: assessment.question_type_mix?.coding || 0,
  architecture: assessment.question_type_mix?.architecture || 0,
  scenario: assessment.question_type_mix?.scenario || 0,
});

const buildQuestionTypeMix = (
  roleCategory: RoleCategory,
  distribution: QuestionDistribution
): Record<string, number> =>
  roleCategory === "tech"
    ? {
        mcq: distribution.mcq,
        coding: distribution.coding,
        architecture: distribution.architecture,
      }
    : {
        mcq: distribution.mcq,
        scenario: distribution.scenario,
      };

const GenerateMoreModal: React.FC<Props> = ({
  open,
  assessment,
  loading,
  onClose,
  onConfirm,
}) => {
  const [roleCategory, setRoleCategory] = useState<RoleCategory>("tech");
  const [skillLevels, setSkillLevels] = useState<Record<string, SkillLevel>>({});
  const [questionDistribution, setQuestionDistribution] = useState<QuestionDistribution>({
    mcq: 0,
    coding: 0,
    architecture: 0,
    scenario: 0,
  });
  const [totalQuestions, setTotalQuestions] = useState(10);

  useEffect(() => {
    if (!assessment || !open) {
      return;
    }

    const nextRoleCategory = deriveRoleCategory(assessment);
    setRoleCategory(nextRoleCategory);
    setQuestionDistribution(buildInitialDistribution(assessment));
    setTotalQuestions(assessment.total_questions || 10);
    setSkillLevels(
      Object.entries(assessment.required_skills || {}).reduce<Record<string, SkillLevel>>((acc, [skill, level]) => {
        acc[skill] = normalizeSkillLevel(level);
        return acc;
      }, {})
    );
  }, [assessment, open]);

  const effectiveQuestionTypeMix = useMemo(
    () => buildQuestionTypeMix(roleCategory, questionDistribution),
    [roleCategory, questionDistribution]
  );

  const distributionTotal = useMemo(
    () => Object.values(effectiveQuestionTypeMix).reduce((sum, value) => sum + value, 0),
    [effectiveQuestionTypeMix]
  );

  if (!open || !assessment) {
    return null;
  }

  const isValid = distributionTotal === totalQuestions && totalQuestions > 0;

  return (
    <div className="assessment-modal-overlay" onClick={onClose}>
      <div className="assessment-modal generate-more-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} type="button">
          ×
        </button>

        <h3 className="modal-title">Generate More</h3>
        <p className="modal-description">
          Review the extracted skill levels and update the assessment configuration before creating a new test link.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`modal-btn ${roleCategory === "tech" ? "primary" : "secondary"}`}
              onClick={() => setRoleCategory("tech")}
            >
              Tech
            </button>
            <button
              type="button"
              className={`modal-btn ${roleCategory === "non-tech" ? "primary" : "secondary"}`}
              onClick={() => setRoleCategory("non-tech")}
            >
              Non-Tech
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Object.keys(skillLevels).map((skill) => (
              <div
                key={skill}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.85rem 1rem",
                  border: "1px solid #dbe4ff",
                  borderRadius: "12px",
                  background: "#f8fbff",
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ color: "#1e293b" }}>{skill}</strong>
                <select
                  value={skillLevels[skill]}
                  onChange={(e) =>
                    setSkillLevels((prev) => ({
                      ...prev,
                      [skill]: e.target.value as SkillLevel,
                    }))
                  }
                  style={{
                    minWidth: "180px",
                    padding: "0.65rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600,
                  }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            ))}
          </div>

          <TotalQuestions value={totalQuestions} onChange={setTotalQuestions} />
          <QuestionnaireConfig
            value={questionDistribution}
            totalQuestions={totalQuestions}
            onChange={setQuestionDistribution}
            roleCategory={roleCategory}
          />

          {!isValid && (
            <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>
              Question type totals must match the total question count.
            </p>
          )}
        </div>

        <div className="assessment-modal-actions">
          <button className="modal-btn secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="modal-btn primary"
            type="button"
            disabled={!isValid || loading}
            onClick={() =>
              onConfirm({
                requiredSkills: Object.entries(skillLevels).reduce<Record<string, string>>((acc, [skill, level]) => {
                  acc[skill] = level;
                  return acc;
                }, {}),
                totalQuestions,
                questionTypeMix: effectiveQuestionTypeMix,
                roleCategory,
              })
            }
          >
            {loading ? "Generating..." : "Create New Link"}
          </button>
        </div>
      </div>
    </div>
  );
};

export type { GenerateMoreOverrides };
export default GenerateMoreModal;

