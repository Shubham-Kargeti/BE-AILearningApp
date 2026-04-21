import React, { useState, useEffect } from "react";
import "./QuestionnaireConfig.scss";

export interface QuestionDistribution {
  mcq: number;
  coding?: number;
  architecture?: number;
  scenario?: number;
  design?: number;
}

type RoleCategory = "tech" | "non-tech";

interface Props {
  value: QuestionDistribution;
  role_type: RoleCategory;
  totalQuestions: number;
  onChange: (value: QuestionDistribution) => void;
}

const QuestionnaireConfig: React.FC<Props> = ({
  value,
  role_type,
  totalQuestions,
  onChange,
}) => {
  const update = (key: keyof QuestionDistribution, val: number) => {
    onChange({
      ...value,
      [key]: Math.max(0, val),
    });
  };

  // ✅ Dynamic fields based on role
  const fields =
    role_type === "tech"
      ? [
          { key: "mcq", label: "MCQ" },
          { key: "coding", label: "Coding" },
          { key: "architecture", label: "Architecture" },
        ]
      : [
          { key: "mcq", label: "MCQ" },
          { key: "scenario", label: "Scenario" },
        ];

  // ✅ Dynamic total calculation
  const total = fields.reduce(
    (sum, field) => sum + (value[field.key as keyof QuestionDistribution] || 0),
    0
  );

  const mismatch = total !== totalQuestions;
  const isInValid = mismatch || total === 0;

  useEffect(() => {
  if (role_type === "tech") {
    onChange({ mcq: 6, coding: 2, architecture: 2 });
  } else {
    onChange({ mcq: 6, scenario: 4 });
  }
}, [role_type]);

  return (
    <section className="card questionnaire-card">
      <div className="card-header">
        <h2>Questionnaire Configuration</h2>
        <p className="hint">
          Configure how many questions of each type will appear in this
          assessment.
        </p>
      </div>

      <div className="questionnaire-grid">
        {fields.map((field) => (
          <div className="questionnaire-field" key={field.key}>
            <label>{field.label}</label>
            <input
              type="number"
              min={0}
              value={value[field.key as keyof QuestionDistribution] || 0}
              onChange={(e) =>
                update(field.key as keyof QuestionDistribution, Number(e.target.value))
              }
            />
          </div>
        ))}
      </div>
{/* 
      <div className="questionnaire-summary">
        Total Questions: <strong>{total}</strong>
        {mismatch && (
          <span
            style={{
              color: "#f44336",
              marginLeft: "1rem",
              fontSize: "0.9rem",
            }}
          >
            ⚠️ Should match {totalQuestions}
          </span>
        )}
      </div> */}

      {isInValid && (
        <p className="warning">
          ⚠️ Total must equal {totalQuestions} and be greater than 0.
        </p>
      )}
    </section>
  );
};

export default QuestionnaireConfig;
