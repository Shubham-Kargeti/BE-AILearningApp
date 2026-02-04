import React from "react";
import "./TotalQuestions.scss";

interface Props {
  value: number;
  onChange: (value: number) => void;
}

const TotalQuestions: React.FC<Props> = ({ value, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val >= 1 && val <= 100) {
      onChange(val);
    }
  };

  return (
    <div className="total-questions-container">
      <label className="total-questions-label">
        Total Questions
      </label>

      <input
        type="number"
        className="total-questions-input"
        min={1}
        max={100}
        value={value}
        onChange={handleChange}
      />

      <p className="total-questions-hint">
        Total number of questions in this assessment (1-100).
      </p>
    </div>
  );
};

export default TotalQuestions;