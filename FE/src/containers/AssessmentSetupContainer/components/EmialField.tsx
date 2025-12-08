import React, { useEffect, useRef } from "react";
import { FiCheckCircle, FiXCircle, FiLoader } from "react-icons/fi";
import { candidateService } from "../../../API/services";
import "./EmailField.scss";

interface Props {
  value: string;
  setValue: (val: string) => void;
  setValid: (val: boolean) => void;
  error?: string;
  setError?: (err: string) => void;
}

const EmailField: React.FC<Props> = ({ value, setValue, setValid, error, setError }) => {
  const [validating, setValidating] = React.useState(false);
  const [isValid, setIsValid] = React.useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!value.trim()) {
      setIsValid(false);
      setValid(false);
      setError?.("");
      return;
    }

    if (!emailRegex.test(value)) {
      setIsValid(false);
      setValid(false);
      setError?.("Invalid email format");
      return;
    }

    // Debounce backend validation (500ms)
    debounceTimer.current = setTimeout(async () => {
      try {
        setValidating(true);
        setError?.("");

        const response = await candidateService.checkEmail(value.trim());

        if (response.is_available) {
          setIsValid(true);
          setValid(true);
          setError?.("");
        } else {
          setIsValid(false);
          setValid(false);
          setError?.(response.message || "Email already registered");
        }
      } catch (err) {
        // On error, allow valid format emails (fallback)
        if (emailRegex.test(value)) {
          setIsValid(true);
          setValid(true);
          setError?.("");
        } else {
          setIsValid(false);
          setValid(false);
          setError?.("Failed to validate email");
        }
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value, setValid, setError]);

  return (
    <div className={`email-field form-field ${error ? "error" : ""} ${isValid ? "valid" : ""}`}>
      <label>
        Candidate Email *
        {validating && <span className="validating-label">(checking...)</span>}
      </label>

      <div className="email-input-wrapper">
        <input
          type="email"
          value={value}
          placeholder="Enter candidate email"
          onChange={(e) => setValue(e.target.value)}
          className="email-input"
          aria-describedby={error ? "email-error" : ""}
        />

        {/* Validation Status Icon */}
        {value && (
          <div className="email-status-icon">
            {validating ? (
              <FiLoader size={18} className="loading" />
            ) : isValid ? (
              <FiCheckCircle size={18} className="valid" title="Email is valid and available" />
            ) : (
              <FiXCircle size={18} className="invalid" title="Email is invalid or taken" />
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div id="email-error" className="email-error-message">
          {error}
        </div>
      )}

      {/* Success Message */}
      {isValid && !error && (
        <div className="email-success-message">
          ✓ Email is valid and available
        </div>
      )}
    </div>
  );
};

export default EmailField;