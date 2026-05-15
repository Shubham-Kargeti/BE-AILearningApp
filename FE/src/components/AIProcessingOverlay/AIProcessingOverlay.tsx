import { useEffect, useMemo, useRef, useState } from "react";
import { FiCpu, FiZap } from "react-icons/fi";
import "./AIProcessingOverlay.scss";

interface AIProcessingOverlayProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  messages?: string[];
}

const DEFAULT_MESSAGES = [
  "Reading uploaded document...",
  "Analyzing content...",
  "Identifying roles...",
  "Extracting skills & keywords...",
];

const AIProcessingOverlay = ({
  open,
  title = "AI extraction in progress",
  subtitle = "Please wait while we turn the uploaded document into structured assessment intelligence.",
  messages = DEFAULT_MESSAGES,
}: AIProcessingOverlayProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const activeMessages = useMemo(
    () => (messages.length > 0 ? messages : DEFAULT_MESSAGES),
    [messages]
  );
  const [messageIndex, setMessageIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      setIsClosing(false);
      return undefined;
    }

    if (!isMounted) {
      return undefined;
    }

    setIsClosing(true);
    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      setMessageIndex(0);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isMounted, open]);

  useEffect(() => {
    if (!isMounted) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || isClosing) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % activeMessages.length);
    }, 1650);

    return () => window.clearInterval(intervalId);
  }, [activeMessages.length, isClosing, isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`ai-processing-overlay${isClosing ? " is-closing" : ""}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-processing-title"
      aria-describedby="ai-processing-message"
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
        }
      }}
    >
      <div className="ai-processing-card">
        <div className="ai-processing-card__icon" aria-hidden="true">
          <FiCpu size={30} />
        </div>

        <div className="ai-processing-ring" aria-hidden="true">
          <div className="ai-processing-ring__track" />
          <div className="ai-processing-ring__core">
            <FiZap size={22} />
          </div>
        </div>

        <div className="ai-processing-card__copy">
          <p className="ai-processing-card__eyebrow">AI processing</p>
          <h2 id="ai-processing-title">{title}</h2>
          <p className="ai-processing-card__subtitle">{subtitle}</p>
        </div>

        <div
          id="ai-processing-message"
          className="ai-processing-message"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="ai-processing-message__dot" aria-hidden="true" />
          <span key={messageIndex}>{activeMessages[messageIndex]}</span>
        </div>

        <div className="ai-processing-steps" aria-hidden="true">
          {activeMessages.map((message, index) => (
            <span
              key={message}
              className={index <= messageIndex ? "is-active" : ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIProcessingOverlay;
