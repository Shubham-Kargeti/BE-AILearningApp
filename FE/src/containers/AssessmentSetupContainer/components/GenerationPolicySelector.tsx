import React from "react";
import "./GenerationPolicySelector.scss";

export interface GenerationPolicy {
  mode: "rag" | "llm" | "mix";
  rag_pct: number;
  llm_pct: number;
}

interface Props {
  value: GenerationPolicy;
  onChange: (value: GenerationPolicy) => void;
  disabled?: boolean;
}

const clampPct = (val: number) => Math.max(0, Math.min(100, val));

const resolveMode = (rag: number, llm: number): GenerationPolicy["mode"] => {
  if (rag === 100) return "rag";
  if (llm === 100) return "llm";
  return "mix";
};

const GenerationPolicySelector: React.FC<Props> = ({ value, onChange, disabled = false }) => {
  const updateRag = (val: number) => {
    const rag = clampPct(val);
    const llm = 100 - rag;
    onChange({ rag_pct: rag, llm_pct: llm, mode: resolveMode(rag, llm) });
  };

  const updateLlm = (val: number) => {
    const llm = clampPct(val);
    const rag = 100 - llm;
    onChange({ rag_pct: rag, llm_pct: llm, mode: resolveMode(rag, llm) });
  };

  return (
    <section className="card generation-policy-card">
      <div className="card-header">
        <h2>Question Generation Mix</h2>
        <p className="hint">
          Choose how much of the question set should be generated from RAG vs. LLM.
          Percentages always sum to 100%.
        </p>
      </div>

      <div className="generation-grid">
        <div className="generation-field">
          <label>RAG Questions (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={value.rag_pct}
            disabled={disabled}
            onChange={(e) => updateRag(Number(e.target.value))}
          />
          <span className="percentage">{value.rag_pct}%</span>
        </div>

        <div className="generation-field">
          <label>LLM Questions (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={value.llm_pct}
            disabled={disabled}
            onChange={(e) => updateLlm(Number(e.target.value))}
          />
          <span className="percentage">{value.llm_pct}%</span>
        </div>
      </div>

      <div className="generation-note">
        Mode: <strong>{value.mode.toUpperCase()}</strong>
        {disabled && (
          <span className="disabled-note"> · Upload Question Bank to enable RAG mix</span>
        )}
      </div>
    </section>
  );
};

export default GenerationPolicySelector;
