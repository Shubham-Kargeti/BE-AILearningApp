import React from "react";
import "./CutoffMarks.scss";

interface Props {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const CutoffMarks: React.FC<Props> = ({ value, onChange, disabled = false }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val >= 0 && val <= 100) {
      onChange(val);
    }
  };

  return (
    <div className="cutoff-container">
      <label className="cutoff-label">
        Cut-off Marks <span className="muted">(out of 100)</span>
        {disabled && <span className="muted" style={{ marginLeft: '8px', fontSize: '0.85em' }}>(Auto-adjusted by experience)</span>}
      </label>

      <input
        type="number"
        className="cutoff-input"
        min={0}
        max={100}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'text' }}
      />

      <p className="cutoff-hint">
        Candidates scoring below this value will not qualify.
      </p>
    </div>
  );
};

export default CutoffMarks;
