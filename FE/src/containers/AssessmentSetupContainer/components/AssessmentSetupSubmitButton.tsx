import React, { useState, useEffect } from "react";
import { FiLoader, FiAlertCircle } from "react-icons/fi";
import "./AssessmentSetupSubmitButton.scss";

interface Props {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  validationCount?: number;
  label?: string;
  loadingLabel?: string;
}

const AssessmentSetupSubmitButton: React.FC<Props> = ({
  disabled,
  loading,
  onClick,
  validationCount = 0,
  label = "Set Assessment",
  loadingLabel = "Creating Assessment...",
}) => {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!disabled && submitted) {
      setSubmitted(false);
    }
  }, [disabled, submitted]);

  const handleClick = () => {
    if (loading || submitted) {
      return;
    }

    if (disabled) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      return;
    }

    onClick();
  };

  const getDisabledReason = (): string => {
    if (validationCount > 0) {
      return `${validationCount} validation error${validationCount !== 1 ? "s" : ""}`;
    }
    return "Please complete all required fields";
  };

  return (
    <div className="submit-button-wrapper">
      <div className="button-container">
        <button
          className={`submit-btn ${disabled ? "disabled" : "enabled"} ${
            loading ? "loading" : ""
          } ${submitted && disabled ? "error-shake" : ""}`}
          onClick={handleClick}
          disabled={disabled || loading}
          aria-label={`Submit assessment setup${
            disabled ? ` - ${getDisabledReason()}` : ""
          }`}
          aria-busy={loading}
        >
          {/* Button Content */}
          <span className="button-content">
            {loading ? (
              <>
                <FiLoader className="loader-icon" />
                <span className="button-text">{loadingLabel}</span>
              </>
            ) : (
              <span className="button-text">{label}</span>
            )}
          </span>

          {/* Validation Badge */}
          {disabled && validationCount > 0 && !loading && (
            <span className="validation-badge" aria-label={getDisabledReason()}>
              {validationCount}
            </span>
          )}
        </button>

        {/* Tooltip / Help Text */}
        {disabled && (
          <div className="button-tooltip" role="tooltip">
            <FiAlertCircle size={14} />
            <span>{getDisabledReason()}</span>
          </div>
        )}
      </div>

      {/* Loading Progress Indicator */}
      {loading && (
        <div className="loading-indicator">
          <div className="progress-bar"></div>
        </div>
      )}
    </div>
  );
};

export default AssessmentSetupSubmitButton;
