import React from "react";
import "./AdditionalScreeningQuestions.scss";

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

const AdditionalScreeningQuestions: React.FC<Props> = ({
  value,
  onChange,
}) => {
  const updateQuestion = (index: number, text: string) => {
    const updated = [...value];
    updated[index] = text;
    onChange(updated);
  };

  const addQuestion = () => {
    onChange([...value, ""]);
  };

  const removeQuestion = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated.length ? updated : [""]);
  };

  return (
    <div className="additional-screening">
      <label className="screening-label">
        Mandatory Screening Questions
      </label>

      {value.map((question, idx) => (
        <div key={idx} className="screening-item">
          <textarea
            className="screening-textarea"
            placeholder={`Screening question ${idx + 1}`}
            value={question}
            onChange={(e) =>
              updateQuestion(idx, e.target.value)
            }
            rows={3}
          />

          {value.length > 1 && (
            <button
              type="button"
              className="remove-btn"
              onClick={() => removeQuestion(idx)}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="add-btn"
        onClick={addQuestion}
      >
        + Add another screening question
      </button>

      <p className="screening-hint">
        These questions will appear at the end of the assessment and
        must be answered by the candidate.
      </p>
    </div>
  );
};

export default AdditionalScreeningQuestions;
