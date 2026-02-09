import React, { useEffect, useState } from "react";
import { FiCopy, FiMail, FiX } from "react-icons/fi";
import "./AssessmentLinkModal.scss";

interface Props {
  open: boolean;
  link: string;
  email: string;
  onClose: () => void;
}

const AssessmentLinkModal: React.FC<Props> = ({ open, link, email, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {

      window.alert("Copy failed.");
    }
  };

  const handleEmail = () => {
    window.alert("Email feature will be available soon.");
  };

  return (
    <div className="assessment-modal-overlay" onClick={onClose}>
      <div className="assessment-modal" onClick={(e) => e.stopPropagation()}>
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <FiX size={24} />
        </button>
        <h3 className="modal-title">Assessment Link</h3>
        <p className="modal-description">Share this link with the candidate to start their assessment.</p>

        <div className="link-box">
          <code>{link}</code>
        </div>

        <button className={`modal-btn primary`} onClick={handleCopy}>
          <FiCopy /> {copied ? "Link Copied!" : "Copy Link"}
        </button>

        <button className={`modal-btn secondary disabled`} onClick={handleEmail}>
          <FiMail /> Email Candidate ({email || "no email"})
        </button>

        <p className="soon-note">(Email feature coming soon)</p>
      </div>
    </div>
  );
};

export default AssessmentLinkModal;
