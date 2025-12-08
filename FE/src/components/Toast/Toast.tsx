import React, { useEffect } from "react";
import { FiCheckCircle, FiXCircle, FiInfo, FiX } from "react-icons/fi";
import "./Toast.scss";

interface ToastProps {
  type: "success" | "error" | "info";
  message: string;
  onClose: () => void;
  autoClose?: number;
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose, autoClose = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, autoClose);
    return () => clearTimeout(timer);
  }, [autoClose, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FiCheckCircle size={20} />;
      case "error":
        return <FiXCircle size={20} />;
      case "info":
        return <FiInfo size={20} />;
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <div className="toast-icon">{getIcon()}</div>
        <p className="toast-message">{message}</p>
      </div>
      <button className="toast-close" onClick={onClose}>
        <FiX size={16} />
      </button>
    </div>
  );
};

export default Toast;
