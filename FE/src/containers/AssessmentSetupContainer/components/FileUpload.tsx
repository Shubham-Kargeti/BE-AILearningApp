import React, { useRef, useState } from "react";
import { 
  FiX, FiUpload, FiCloud, FiAlertCircle, FiFileText, 
  FiCheckCircle, FiEye, FiTrash2, FiDownload, FiZoomIn, FiZoomOut 
} from "react-icons/fi";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import "./FileUpload.scss";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
  label: string;
  onFileSelect: (file: File | null) => void;
  onTextExtracted?: (text: string) => void;
  isRequired?: boolean;
}

interface FilePreview {
  name: string;
  size: string;
  type: string;
  url: string | null;
  textContent: string | null;
  htmlContent: string | null;
}

const allowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const FileUpload: React.FC<Props> = ({ label, onFileSelect, onTextExtracted, isRequired = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  
  const [filePreview, setFilePreview] = useState<FilePreview>({
    name: "",
    size: "",
    type: "",
    url: null,
    textContent: null,
    htmlContent: null,
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const currentFileRef = useRef<File | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toUpperCase() || "FILE";
  };

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") return "📄";
    if (type.includes("word")) return "📝";
    if (type === "text/plain") return "📃";
    return "📁";
  };

  const validateFile = (file: File): boolean => {
    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, DOCX, TXT, PPT, and PPTX files are allowed.");
      return false;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size must be less than 10MB.");
      return false;
    }

    setError("");
    return true;
  };

  const simulateUploadProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 30;
      });
    }, 100);
  };

  const generatePreview = async (file: File) => {
    setIsProcessing(true);
    simulateUploadProgress();

    const preview: FilePreview = {
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      url: null,
      textContent: null,
      htmlContent: null,
    };

    let extractedText = "";

    if (file.type === "application/pdf") {
      preview.url = URL.createObjectURL(file);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textParts: string[] = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          textParts.push(pageText);
        }
        
        extractedText = textParts.join("\n");
        preview.textContent = extractedText;
      } catch (err) {
        console.error("Error extracting PDF text:", err);
      }
    } else if (file.type === "text/plain") {
      const text = await file.text();
      preview.textContent = text;
      extractedText = text;
    } else if (file.type.includes("word") || file.name.endsWith(".docx")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        preview.htmlContent = result.value;
        // Also extract plain text for parsing
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        extractedText = textResult.value;
        preview.textContent = extractedText;
      } catch (err) {
        console.error("Error converting DOCX:", err);
        preview.textContent = "Unable to preview this Word document.";
      }
    }

    if (onTextExtracted && extractedText) {
      onTextExtracted(extractedText);
    }

    setTimeout(() => {
      setFilePreview(preview);
      setIsProcessing(false);
      setUploadProgress(100);
    }, 500);
  };

  const handleFileSelect = async (file: File) => {
    if (!validateFile(file)) return;

    currentFileRef.current = file;
    await generatePreview(file);
    setUploaded(true);
    setShowPicker(false);
    setShowPreview(true);
  };

  const confirmUpload = () => {
    if (currentFileRef.current) {
      onFileSelect(currentFileRef.current);
      setShowPreview(false);
    }
  };

  const cancelUpload = () => {
    currentFileRef.current = null;
    setFilePreview({ name: "", size: "", type: "", url: null, textContent: null, htmlContent: null });
    setUploaded(false);
    setShowPreview(false);
    setUploadProgress(0);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    handleFileSelect(f);
  };

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    handleFileSelect(f);
  };

  const openPicker = () => setShowPicker(true);

  const handleLocalUpload = () => {
    setShowPicker(false);
    setTimeout(() => inputRef.current?.click(), 120);
  };

  const handleSharepoint = () => {
    setShowPicker(false);
    setError("SharePoint integration coming soon. Please upload from device.");
  };

  const removeFile = () => {
    if (filePreview.url) {
      URL.revokeObjectURL(filePreview.url);
    }
    currentFileRef.current = null;
    setFilePreview({ name: "", size: "", type: "", url: null, textContent: null, htmlContent: null });
    setUploaded(false);
    setError("");
    setUploadProgress(0);
    onFileSelect(null);
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));

  const downloadFile = () => {
    if (currentFileRef.current) {
      const url = URL.createObjectURL(currentFileRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFileRef.current.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      <div className={`file-upload ${uploaded ? "uploaded" : ""} ${error ? "error" : ""}`}>
        <label className="file-upload-label">
          {label}
          {isRequired && <span className="required-star">*</span>}
        </label>

        {error && (
          <div className="file-error">
            <FiAlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Show upload box when no file uploaded */}
        {!uploaded && (
          <div
            className={`upload-box ${dragActive ? "drag-active" : ""} ${error ? "has-error" : ""}`}
            onClick={openPicker}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <div className="upload-inner">
              <FiUpload size={20} className="upload-icon" />
              <p className="upload-text">Drag & drop or click to browse</p>
              <p className="upload-hint">PDF, DOCX, TXT up to 10MB</p>
            </div>
          </div>
        )}

        {/* File info row - shown when file is uploaded */}
        {uploaded && filePreview.name && (
          <div className="uploaded-row">
            <div className="file-info">
              <span className="file-icon">{getFileIcon(filePreview.type)}</span>
              <div className="file-details">
                <span className="file-name" title={filePreview.name}>{filePreview.name}</span>
                <span className="file-meta">
                  {getFileExtension(filePreview.name)} • {filePreview.size}
                </span>
              </div>
            </div>
            <div className="file-actions">
              <button
                className="action-btn preview-btn"
                onClick={() => setShowPreview(true)}
                title="Preview"
              >
                <FiEye size={14} />
              </button>
              <button
                className="action-btn download-btn"
                onClick={downloadFile}
                title="Download"
              >
                <FiDownload size={14} />
              </button>
              <button
                className="action-btn remove-btn"
                onClick={removeFile}
                title="Remove"
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept=".pdf,.docx,.txt,.ppt,.pptx"
          onChange={onBrowse}
        />
      </div>

      {/* Upload Source Picker Modal */}
      {showPicker && (
        <div className="upload-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="upload-modal source-picker" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowPicker(false)}
              aria-label="Close"
            >
              <FiX size={20} />
            </button>

            <div className="modal-header">
              <div className="modal-icon">
                <FiUpload size={28} />
              </div>
              <h3 className="modal-title">Upload Document</h3>
              <p className="modal-subtitle">Choose how you'd like to upload your file</p>
            </div>

            <div className="upload-options">
              <button className="upload-option primary" onClick={handleLocalUpload}>
                <div className="option-icon">
                  <FiUpload size={24} />
                </div>
                <div className="option-content">
                  <span className="option-title">Upload from Device</span>
                  <span className="option-desc">Select a file from your computer</span>
                </div>
              </button>

              <button className="upload-option secondary" onClick={handleSharepoint}>
                <div className="option-icon">
                  <FiCloud size={24} />
                </div>
                <div className="option-content">
                  <span className="option-title">Upload from SharePoint</span>
                  <span className="option-desc">Connect to your SharePoint drive</span>
                </div>
                <span className="coming-soon-badge">Coming Soon</span>
              </button>
            </div>

            <div className="modal-footer">
              <p className="file-types">Supported: PDF, DOCX, TXT (Max 10MB)</p>
              <button className="cancel-link" onClick={() => setShowPicker(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {showPreview && (
        <div className="upload-modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="upload-modal preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div className="preview-file-info">
                <span className="preview-icon">{getFileIcon(filePreview.type)}</span>
                <div className="preview-file-details">
                  <h3 className="preview-filename">{filePreview.name}</h3>
                  <span className="preview-meta">
                    {getFileExtension(filePreview.name)} • {filePreview.size}
                  </span>
                </div>
              </div>
              <div className="preview-controls">
                <button className="control-btn" onClick={handleZoomOut} title="Zoom Out">
                  <FiZoomOut size={18} />
                </button>
                <span className="zoom-level">{zoomLevel}%</span>
                <button className="control-btn" onClick={handleZoomIn} title="Zoom In">
                  <FiZoomIn size={18} />
                </button>
                <button className="control-btn" onClick={downloadFile} title="Download">
                  <FiDownload size={18} />
                </button>
                <button
                  className="control-btn close-btn"
                  onClick={() => setShowPreview(false)}
                  title="Close"
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {isProcessing ? (
              <div className="preview-loading">
                <div className="loading-spinner"></div>
                <p>Processing document...</p>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="preview-content" style={{ transform: `scale(${zoomLevel / 100})` }}>
                {filePreview.type === "application/pdf" && filePreview.url && (
                  <iframe
                    src={filePreview.url}
                    className="pdf-preview"
                    title="PDF Preview"
                  />
                )}

                {filePreview.type === "text/plain" && filePreview.textContent && (
                  <div className="text-preview">
                    <pre>{filePreview.textContent}</pre>
                  </div>
                )}

                {(filePreview.type.includes("word") || filePreview.name.endsWith(".docx")) && filePreview.htmlContent && (
                  <div className="docx-preview-content">
                    <div 
                      className="docx-html-content"
                      dangerouslySetInnerHTML={{ __html: filePreview.htmlContent }}
                    />
                  </div>
                )}

                {(filePreview.type.includes("word") || filePreview.name.endsWith(".docx")) && !filePreview.htmlContent && filePreview.textContent && (
                  <div className="docx-preview">
                    <div className="docx-icon">
                      <FiFileText size={64} />
                    </div>
                    <h4>Word Document</h4>
                    <p>{filePreview.name}</p>
                    <p className="docx-hint">{filePreview.textContent}</p>
                    <button className="download-btn-large" onClick={downloadFile}>
                      <FiDownload size={18} />
                      Download to View
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="preview-footer">
              <button className="btn-cancel" onClick={cancelUpload}>
                <FiX size={16} />
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmUpload} disabled={isProcessing}>
                <FiCheckCircle size={16} />
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileUpload;
