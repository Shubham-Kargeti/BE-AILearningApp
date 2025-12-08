import React, { useState } from "react";
import { FiInfo, FiCheckCircle, FiLock } from "react-icons/fi";
import "./AssessmentMethodSelector.scss";

interface Props {
  method: string;
  setMethod: (method: string) => void;
  methodError?: string;
  setMethodError?: (error: string) => void;
}

const ASSESSMENT_METHODS = [
  {
    id: "questionnaire",
    name: "Questionnaire",
    description: "AI-generated MCQ-based assessment",
    icon: "📝",
    enabled: true,
    features: ["Auto-generated questions", "Instant scoring", "Real-time feedback"],
  },
  {
    id: "interview",
    name: "Interview",
    description: "AI-powered conversational interview",
    icon: "🎤",
    enabled: false,
    disabledReason: "Interview feature is disabled for MVP. Coming soon in v2.0",
    features: ["Live conversation", "Follow-up questions", "Behavioral analysis"],
  },
];

const AssessmentMethodSelector: React.FC<Props> = ({
  method,
  setMethod,
  methodError,
  setMethodError,
}) => {
  const [tooltipOpen, setTooltipOpen] = useState<string | null>(null);

  const handleMethodChange = (methodId: string) => {
    const selectedMethod = ASSESSMENT_METHODS.find((m) => m.id === methodId);

    if (!selectedMethod?.enabled) {
      setTooltipOpen(methodId);
      if (setMethodError) {
        setMethodError("This method is not available in MVP");
      }
      return;
    }

    setMethod(methodId);
    setTooltipOpen(null);
    if (setMethodError) {
      setMethodError("");
    }
  };

  return (
    <div className="form-field assessment-method-selector">
      <div className="form-label-wrapper">
        <label className="form-label">Assessment Method *</label>
        <span className="info-icon" title="Select how candidates will be assessed">
          <FiInfo size={16} />
        </span>
      </div>

      <div className="radio-group">
        {ASSESSMENT_METHODS.map((item) => (
          <div
            key={item.id}
            className={`method-option ${!item.enabled ? "disabled" : ""} ${
              method === item.id ? "selected" : ""
            }`}
          >
            {/* Radio Input */}
            <div className="radio-wrapper">
              <input
                type="radio"
                id={`method-${item.id}`}
                name="assessment-method"
                value={item.id}
                checked={method === item.id}
                onChange={() => handleMethodChange(item.id)}
                disabled={!item.enabled}
                aria-label={`${item.name} - ${item.description}`}
                aria-describedby={
                  !item.enabled ? `method-${item.id}-disabled` : undefined
                }
              />
              <label htmlFor={`method-${item.id}`} className="radio-label">
                <div className="radio-custom"></div>
                <div className="method-content">
                  <div className="method-header">
                    <span className="method-icon">{item.icon}</span>
                    <div className="method-title-wrapper">
                      <span className="method-name">{item.name}</span>
                      {method === item.id && (
                        <span className="selected-badge">
                          <FiCheckCircle size={14} /> Selected
                        </span>
                      )}
                      {!item.enabled && (
                        <span className="disabled-badge">
                          <FiLock size={14} /> MVP Limited
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="method-description">{item.description}</p>
                </div>
              </label>
            </div>

            {/* Features List */}
            {(method === item.id || tooltipOpen === item.id) && (
              <div className="method-features">
                <ul>
                  {item.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="feature-dot">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Disabled Reason Tooltip */}
            {!item.enabled && tooltipOpen === item.id && (
              <div
                className="disabled-tooltip"
                id={`method-${item.id}-disabled`}
                role="tooltip"
              >
                <div className="tooltip-content">
                  <FiLock size={16} />
                  <div>
                    <p className="tooltip-title">Not Available in MVP</p>
                    <p className="tooltip-message">{item.disabledReason}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {methodError && (
        <div className="error-message" role="alert">
          <span className="error-icon">⚠</span>
          {methodError}
        </div>
      )}

      {/* Info Box */}
      <div className="method-info-box">
        <FiInfo size={16} />
        <p>
          <strong>Note:</strong> Only Questionnaire is available in this MVP
          version. Interview feature will be enabled in v2.0 after platform
          stability improvements.
        </p>
      </div>
    </div>
  );
};

export default AssessmentMethodSelector;
