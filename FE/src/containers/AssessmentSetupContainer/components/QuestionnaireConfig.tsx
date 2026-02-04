import React from "react";
import "./QuestionnaireConfig.scss";

export interface QuestionDistribution {
  mcq: number;
  coding: number;
  architecture: number;
}

interface Props {
  value: QuestionDistribution;
  totalQuestions: number;
  onChange: (value: QuestionDistribution) => void;
  totalQuestions?: number;
}

const QuestionnaireConfig: React.FC<Props> = ({ value, totalQuestions, onChange }) => {
  const update = (
    key: keyof QuestionDistribution,
    val: number
  ) => {
    onChange({
      ...value,
      [key]: Math.max(0, val),
    });
  };

  const total =
    value.mcq + value.coding + value.architecture;
  
  const isInValid = total !== totalQuestions || total === 0;

  return (
    <section className="card questionnaire-card">
      <div className="card-header">
        <h2>Questionnaire Configuration</h2>
        <p className="hint">
          Configure how many questions of each type will
          appear in this assessment.
        </p>
      </div>

      <div className="questionnaire-grid">
        <div className="questionnaire-field">
          <label>MCQ</label>
          <input
            type="number"
            min={0}
            value={value.mcq}
            onChange={(e) =>
              update("mcq", Number(e.target.value))
            }
          />
        </div>

        <div className="questionnaire-field">
          <label>Coding</label>
          <input
            type="number"
            min={0}
            value={value.coding}
            onChange={(e) =>
              update("coding", Number(e.target.value))
            }
          />
        </div>

        <div className="questionnaire-field">
          <label>Architecture</label>
          <input
            type="number"
            min={0}
            value={value.architecture}
            onChange={(e) =>
              update(
                "architecture",
                Number(e.target.value)
              )
            }
          />
        </div>
      </div>

      <div className="questionnaire-summary">
        Total Questions: <strong>{total}</strong>
        {mismatch && (
          <span style={{ 
            color: '#f44336', 
            marginLeft: '1rem', 
            fontSize: '0.9rem' 
          }}>
            ⚠️ Should match {totalQuestions} (adjust question types above)
          </span>
        )}
      </div>

      {isInValid && (
        <p className="warning">
          ⚠️ MCQ + Coding + Architecture must equal{" "}
          {totalQuestions} and be greater than 0.
        </p>
      )}
    </section>
  );
};

export default QuestionnaireConfig;
