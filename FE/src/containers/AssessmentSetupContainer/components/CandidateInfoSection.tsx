import React from "react";
import { FiUser, FiMail, FiBriefcase, FiClock } from "react-icons/fi";
import "./CandidateInfoSection.scss";

export interface CandidateInfoData {
  name: string;
  email: string;
  phone: string;
  experience: string;
  currentRole: string;
  location: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  education: string;
}

interface CandidateInfoSectionProps {
  candidateInfo: CandidateInfoData;
  setCandidateInfo: (info: CandidateInfoData) => void;
  emailValid: boolean;
  setEmailValid: (valid: boolean) => void;
  emailError: string;
  setEmailError: (error: string) => void;
  isAutoFilled?: boolean;
}

const CandidateInfoSection: React.FC<CandidateInfoSectionProps> = ({
  candidateInfo,
  setCandidateInfo,
  emailValid,
  setEmailValid,
  emailError,
  setEmailError,
  isAutoFilled = false,
}) => {
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setCandidateInfo({ ...candidateInfo, email: value });
    if (!value.trim()) {
      setEmailValid(false);
      setEmailError("Email is required");
    } else if (!validateEmail(value)) {
      setEmailValid(false);
      setEmailError("Please enter a valid email");
    } else {
      setEmailValid(true);
      setEmailError("");
    }
  };

  const handleChange = (field: keyof CandidateInfoData, value: string) => {
    if (field === "email") {
      handleEmailChange(value);
    } else {
      setCandidateInfo({ ...candidateInfo, [field]: value });
    }
  };

  return (
    <div className="candidate-info-section">
      {isAutoFilled && (
        <div className="auto-fill-badge">
          <span className="badge-icon">✨</span>
          <span>Auto-filled from resume. Please verify and correct if needed.</span>
        </div>
      )}

      <div className="info-grid">
        <div className="info-field">
          <label>
            <FiUser className="field-icon" />
            Candidate Name
          </label>
          <input
            type="text"
            value={candidateInfo.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Enter candidate name"
            className={candidateInfo.name ? "has-value" : ""}
          />
        </div>

        <div className="info-field">
          <label>
            <FiMail className="field-icon" />
            Email Address *
          </label>
          <input
            type="email"
            value={candidateInfo.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="candidate@email.com"
            className={`${emailError ? "error" : ""} ${emailValid ? "valid" : ""}`}
          />
          {emailError && <span className="error-text">{emailError}</span>}
        </div>

        <div className="info-field">
          <label>
            <FiBriefcase className="field-icon" />
            Current Role
          </label>
          <input
            type="text"
            value={candidateInfo.currentRole}
            onChange={(e) => handleChange("currentRole", e.target.value)}
            placeholder="e.g., Senior Software Engineer"
          />
        </div>

        <div className="info-field">
          <label>
            <FiClock className="field-icon" />
            Experience
          </label>
          <input
            type="text"
            value={candidateInfo.experience}
            onChange={(e) => handleChange("experience", e.target.value)}
            placeholder="e.g., 5 years"
          />
        </div>
      </div>
    </div>
  );
};

export default CandidateInfoSection;
