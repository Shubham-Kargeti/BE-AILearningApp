import React from "react";
import "./DifficultyDistribution.scss";

interface Props {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}

const DifficultyDistribution: React.FC<Props> = ({ value, onChange }) => {
  const update = (key: string, val: number) => {
    onChange({
      ...value,
      [key]: Math.max(0, Math.min(1, val)),
    });
  };

  const total = Object.values(value).reduce((sum, v) => sum + v, 0);
  const isValid = Math.abs(total - 1.0) < 0.01; // Allow small floating point errors

  return (
    <section className="card difficulty-distribution-card">
      <div className="card-header">
        <h2>Question Difficulty Distribution</h2>
        <p className="hint">
          Configure the proportion of easy, medium, and hard questions.
          Values should sum to 1.0 (100%).
        </p>
        {!isValid && (
          <p className="warning">
            ⚠️ Distribution must sum to 1.0 (currently {total.toFixed(2)})
          </p>
        )}
      </div>

      <div className="difficulty-grid">
        <div className="difficulty-field">
          <label>Easy Questions</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={value.easy || 0}
            onChange={(e) => update("easy", Number(e.target.value))}
          />
          <span className="percentage">
            {((value.easy || 0) * 100).toFixed(0)}%
          </span>
        </div>

        <div className="difficulty-field">
          <label>Medium Questions</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={value.medium || 0}
            onChange={(e) => update("medium", Number(e.target.value))}
          />
          <span className="percentage">
            {((value.medium || 0) * 100).toFixed(0)}%
          </span>
        </div>

        <div className="difficulty-field">
          <label>Hard Questions</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={value.hard || 0}
            onChange={(e) => update("hard", Number(e.target.value))}
          />
          <span className="percentage">
            {((value.hard || 0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </section>
  );
};

export default DifficultyDistribution;