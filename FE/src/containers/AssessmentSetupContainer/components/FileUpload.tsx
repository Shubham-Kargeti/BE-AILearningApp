// import React, { useState } from "react";

// interface Props {
//   label: string;
//   onFileSelect: (file: File | null) => void;
// }

// const FileUpload: React.FC<Props> = ({ label, onFileSelect }) => {
//   const [dragActive, setDragActive] = useState(false);
//   const [fileName, setFileName] = useState("");

//   const handleDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     setDragActive(false);

//     const file = e.dataTransfer.files[0];
//     if (!file) return;

//     setFileName(file.name);
//     onFileSelect(file);
//   };

//   const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     setFileName(file.name);
//     onFileSelect(file);
//   };

//   return (
//     <div
//       className={`file-upload ${dragActive ? "drag-active" : ""}`}
//       onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
//       onDragLeave={() => setDragActive(false)}
//       onDrop={handleDrop}
//     >
//       <label>{label}</label>

//       <div className="upload-box">
//         <p>{fileName || "Drag & drop or click to browse"}</p>
//         <input type="file" onChange={handleBrowse} />
//       </div>
//     </div>
//   );
// };

// export default FileUpload;


import React, { useRef, useState } from "react";
import { FiUpload, FiMonitor, FiCloud, FiX } from "react-icons/fi";
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
  const [fileName, setFileName] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const closeModal = () => setShowPicker(false);

  // --------------------------------------------------
  // VALIDATE FILE TYPE
  // --------------------------------------------------
  const validateFile = (file: File) => {
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF, DOCX, and TXT files are allowed.");
      return false;
    }
    return true;
  };

  // --------------------------------------------------
  // HANDLE DRAG & DROP
  // --------------------------------------------------
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setFileName(file.name);
    onFileSelect(file);

    // IMPORTANT: Auto-close modal if open
    setShowPicker(false);
  };

  // --------------------------------------------------
  // HANDLE BROWSE (FILE PICKER)
  // --------------------------------------------------
  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;

    setFileName(file.name);
    onFileSelect(file);

    // Auto-close popup AFTER file selection
    setShowPicker(false);
  };

  // --------------------------------------------------
  // OPEN UPLOAD MODAL
  // --------------------------------------------------
  const openPicker = () => {
    setShowPicker(true);
  };

  // --------------------------------------------------
  // LOCAL UPLOAD BUTTON
  // --------------------------------------------------
  const handleLocalUpload = () => {
    // Close modal first
    setShowPicker(false);

    // Then open input AFTER a small guaranteed delay
    setTimeout(() => {
      inputRef.current?.click();
    }, 120);
  };

  // --------------------------------------------------
  // SHAREPOINT UPLOAD (COMING SOON)
  // --------------------------------------------------
  const handleSharePointUpload = () => {
    setShowPicker(false);
    alert("SharePoint upload will be available soon.");
  };

  return (
    <>
      <div className="file-upload">
        <label className="file-upload-label">{label}</label>

        <div
          className={`upload-box ${dragActive ? "drag-active" : ""}`}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <p>{fileName || "Drag & drop or click to browse"}</p>

          <input
            type="file"
            ref={inputRef}
            onChange={handleBrowse}
            accept=".pdf,.docx,.txt"
            className="hidden-input"
          />
        </div>
      </div>

      {/* MODAL */}
      {showPicker && (
        <div className="upload-modal-overlay" onClick={closeModal}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <FiX className="modal-close-icon" onClick={closeModal} />

            <h3 className="modal-title">Upload Document</h3>

            <button className="modal-btn primary" onClick={handleLocalUpload}>
              <FiMonitor size={18} /> Upload from Device
            </button>

            <button className="modal-btn secondary" onClick={handleSharePointUpload}>
              <FiCloud size={18} /> Upload from SharePoint
            </button>

            <button className="modal-cancel" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUpload;
