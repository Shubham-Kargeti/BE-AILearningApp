import React from "react";
import { FiCopy, FiMail } from "react-icons/fi";
import "./AssessmentLinkModal.scss";

interface Props {
  link: string;
  email: string;
  open: boolean;
  onClose: () => void;
}

const AssessmentLinkModal: React.FC<Props> = ({ link, email, open, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!open) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleEmail = () => {
    alert("Email feature will be available soon.");
  };

  return (
    <div className="assessment-modal-overlay">
      <div className="assessment-modal">

        <h3 className="modal-title">Assessment Link</h3>
        <p className="modal-description">
          Share this link with the candidate to start their assessment.
        </p>

        <div className="link-box">
          <code>{link}</code>
        </div>

        <button
          className="modal-btn primary"
          onClick={handleCopy}
        >
          <FiCopy size={18} /> {copied ? "Link Copied!" : "Copy Link"}
        </button>

        <button
          className="modal-btn secondary disabled"
          onClick={handleEmail}
        >
          <FiMail size={18} /> Email Candidate ({email})
        </button>

        <p className="soon-note">(Email feature coming soon)</p>
      </div>
    </div>
  );
};

export default AssessmentLinkModal;
