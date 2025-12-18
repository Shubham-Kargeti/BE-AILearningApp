import React from "react";
import "./AdditionalScreeningQuestions.scss"

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const AdditionalScreeningQuestion: React.FC<Props> = ({
  value,
  onChange,
}) => {
  return (
    <div className="additional-screening">
      <label className="screening-label">
        Mandatory Screening Question
      </label>

      <textarea
        className="screening-textarea"
        placeholder="Enter a compulsory screening question for the candidate..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />

      <p className="screening-hint">
        This question will be compulsory for the candidate to answer.
      </p>
    </div>
  );
};

export default AdditionalScreeningQuestion;
