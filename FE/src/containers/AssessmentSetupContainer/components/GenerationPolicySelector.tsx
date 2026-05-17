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
  questionCount?: number;
}

const clampPct = (val: number) => Math.max(0, Math.min(100, val));

const resolveMode = (rag: number, llm: number): GenerationPolicy["mode"] => {
  if (rag === 100) return "rag";
  if (llm === 100) return "llm";
  return "mix";
};

const GenerationPolicySelector: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  questionCount = 0,
}) => {
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

  const ragQuestions = questionCount > 0 ? Math.round(questionCount * (value.rag_pct / 100)) : 0;
  const llmQuestions = Math.max(0, questionCount - ragQuestions);

  return (
    <section className="card generation-policy-card">
      <div className="card-header">
        <h2>Document Context</h2>
        <p className="hint">
          Select how much of this assessment should be grounded in the uploaded document. The document applies only to this creation.
        </p>
      </div>

      <div className="generation-slider">
        <label htmlFor="rag-percent">Document-grounded percentage</label>
        <input
          id="rag-percent"
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.rag_pct}
          disabled={disabled}
          onChange={(e) => updateRag(Number(e.target.value))}
        />
      </div>

      <div className="generation-grid">
        <div className="generation-field">
          <label>Document (%)</label>
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
          <label>General AI (%)</label>
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
        {questionCount > 0 && (
          <span>
            {" "}- About {ragQuestions} document-based and {llmQuestions} general questions
          </span>
        )}
        {disabled && (
          <span className="disabled-note"> - Select a document to enable this mix</span>
        )}
      </div>
    </section>
  );
};

export default GenerationPolicySelector;
