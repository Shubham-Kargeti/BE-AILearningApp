import React from "react";
import "./ExperienceAdjustment.scss";

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

const ExperienceAdjustment: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div className="experience-adjustment-container">
      <div className="toggle-container">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="toggle-input"
          />
          <span className="toggle-slider"></span>
        </label>
        <span className="toggle-text">
          Auto-adjust difficulty and passing scores by candidate experience
        </span>
      </div>

      <p className="experience-adjustment-hint">
        When enabled, question difficulty and passing thresholds will automatically
        adjust based on the candidate's years of experience:
        <br />• 0-3 years: Easy focus (60% pass threshold)
        <br />• 4-6 years: Mixed difficulty (70% pass threshold)
        <br />• 7-11 years: Balanced (75% pass threshold)
        <br />• 12+ years: Hard focus (80% pass threshold)
      </p>
    </div>
  );
};

export default ExperienceAdjustment;