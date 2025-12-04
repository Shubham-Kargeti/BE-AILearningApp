import React, { useRef, useState } from "react";
import { FiX, FiUpload, FiCloud } from "react-icons/fi";
import "./FileUpload.scss";

interface Props {
  label: string;
  onFileSelect: (file: File | null) => void;
}

const allowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

const FileUpload: React.FC<Props> = ({ label, onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateFile = (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      window.alert("Only PDF, DOCX, and TXT files are allowed.");
      return false;
    }
    return true;
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!validateFile(f)) return;
    setFileName(f.name);
    setUploaded(true);
    onFileSelect(f);
    setShowPicker(false);
  };

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validateFile(f)) return;
    setFileName(f.name);
    setUploaded(true);
    onFileSelect(f);
    setShowPicker(false);
  };

  const openPicker = () => setShowPicker(true);

  const handleLocalUpload = () => {
    // close modal first then trigger input
    setShowPicker(false);
    setTimeout(() => inputRef.current?.click(), 120);
  };

  const handleSharepoint = () => {
    setShowPicker(false);
    window.alert("SharePoint upload will be available soon.");
  };

  const removeFile = () => {
    setFileName("");
    setUploaded(false);
    onFileSelect(null);
  };

  return (
    <>
      <div className={`file-upload ${uploaded ? "uploaded" : ""}`}>
        <label className="file-upload-label">{label}</label>

        <div
          className={`upload-box ${dragActive ? "drag-active" : ""}`}
          onClick={openPicker}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <div className="upload-inner">
            <FiUpload size={20} />
            <p>{fileName || "Drag & drop or click to browse"}</p>
          </div>

          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={onBrowse}
          />
        </div>

        {/* filename row + remove */}
        {uploaded && (
          <div className="uploaded-row">
            <span className="uploaded-name">{fileName}</span>
            <button className="remove-btn" onClick={removeFile} aria-label="Remove file">
              <FiX />
            </button>
          </div>
        )}
      </div>

      {/* Picker modal */}
      {showPicker && (
        <div className="upload-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPicker(false)} aria-label="Close">✕</button>

            <h3 className="modal-title">Upload Document</h3>

            <button className="modal-btn primary" onClick={handleLocalUpload}>
              <FiUpload /> Upload from device
            </button>

            <button className="modal-btn secondary" onClick={handleSharepoint}>
              <FiCloud /> Upload from SharePoint
            </button>

            <button className="modal-cancel" onClick={() => setShowPicker(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUpload;
