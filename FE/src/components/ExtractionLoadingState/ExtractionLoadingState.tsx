import { useEffect, useState } from "react";
import "./ExtractionLoadingState.scss";

interface ExtractionLoadingStateProps {
  messages?: string[];
  compact?: boolean;
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Extracting roles and skills...",
  "Analyzing document...",
  "Mapping skill requirements...",
];

const ExtractionLoadingState = ({
  messages = DEFAULT_MESSAGES,
  compact = false,
  className = "",
}: ExtractionLoadingStateProps) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeMessages = messages.length > 0 ? messages : DEFAULT_MESSAGES;

  useEffect(() => {
    setMessageIndex(0);

    if (activeMessages.length === 1) return undefined;

    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % activeMessages.length);
    }, 1800);

    return () => window.clearInterval(intervalId);
  }, [activeMessages]);

  return (
    <span
      className={[
        "extraction-loading-state",
        compact ? "extraction-loading-state--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="extraction-loading-state__spinner" aria-hidden="true" />
      <span className="extraction-loading-state__message">
        {activeMessages[messageIndex]}
      </span>
    </span>
  );
};

export default ExtractionLoadingState;
