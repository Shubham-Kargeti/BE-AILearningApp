import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiCheckCircle,
  FiUsers,
  FiFileText,
  FiLink,
  FiCopy,
  FiMail,
  FiCalendar,
  FiActivity,
  FiAlertCircle,
  FiSend,
  FiEyeOff,
  FiAward,
  FiBookOpen,
} from "react-icons/fi";
import { assessmentService, quizService, uploadService } from "../../API/services";
import type { Assessment } from "../../API/services";
import { isAdmin } from "../../utils/adminUsers";
import Toast from "../../components/Toast/Toast";
import "./AssessmentViewContainer.scss";

interface ToastMessage {
  type: "success" | "error" | "info";
  message: string;
}

const AssessmentViewContainer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [testSessions, setTestSessions] = useState<Array<{
    session_id: string;
    candidate_name: string | null;
    candidate_email: string | null;
    total_questions: number;
    correct_answers: number | null;
    score_percentage: number | null;
    is_completed: boolean;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastUploadInfo, setLastUploadInfo] = useState<{ doc_id: string; s3_key: string; task_id?: string } | null>(null);
  const [ingestionStatus, setIngestionStatus] = useState<string | null>(null);
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const pollingRef = React.useRef<number | null>(null);
  const [generationTaskId, setGenerationTaskId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const generationPollingRef = React.useRef<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<{
    session_id: string;
    question_set_id: string;
    skill: string;
    level: string;
    score_percentage: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
    time_taken_seconds: number;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Array<{ option_id: string; text: string }>;
    }>;
  } | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'results'>('details');

  const fetchTestSessions = async () => {
    if (!id) return;
    try {
      setLoadingSessions(true);
      const sessions = await quizService.listAssessmentTestSessions(id);
      setTestSessions(sessions);
    } catch (err) {
      console.error("Error fetching test sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const viewDetailedResult = async (sessionId: string) => {
    try {
      setLoadingResult(true);
      const result = await quizService.getQuestionSetTestResults(sessionId);
      setSelectedResult(result);
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;

      if (status === 401 || status === 403) {
        setToast({ type: "error", message: "Authentication required. Please log in as an admin." });
        // Redirect to login so admin can re-authenticate
        setTimeout(() => window.location.href = '/login', 800);
      } else if (status === 404) {
        setToast({ type: "error", message: serverMsg || "Results not yet available" });
      } else {
        setToast({ type: "error", message: serverMsg || "Unable to fetch detailed results" });
      }
    } finally {
      setLoadingResult(false);
    }
  };

  const initiateLearningPath = async (_sessionId: string) => {
    // TODO: Implement learning path initiation
    setToast({
      type: "info",
      message: "Learning path initiation is coming soon!"
    });
  };

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!id) {
        setError("Assessment ID not provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await assessmentService.getAssessment(id);
        setAssessment(data);
        // reset last upload info when refetching
        setLastUploadInfo(null);
      } catch (err: any) {

        setError(err.response?.data?.detail || "Failed to load assessment");
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'results') {
      fetchTestSessions();
    }
  }, [activeTab]);

  // cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const handleCopyLink = () => {
    if (assessment) {
      const link = `${window.location.origin}/candidate-assessment/${assessment.assessment_id}`;
      navigator.clipboard.writeText(link);
      setToast({ type: "success", message: "Assessment link copied to clipboard!" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }

    try {
      await assessmentService.deleteAssessment(id!);
      setToast({ type: "success", message: "Assessment deleted successfully" });
      setTimeout(() => navigate("/admin/dashboard"), 1500);
    } catch (err: any) {
      setToast({ type: "error", message: err.response?.data?.detail || "Failed to delete assessment" });
      setDeleteConfirm(false);
    }
  };

  const handlePublish = async () => {
    if (!assessment) return;

    try {
      setPublishLoading(true);
      const updatedAssessment = await assessmentService.publishAssessment(assessment.assessment_id);
      setAssessment(updatedAssessment);
      setToast({
        type: "success",
        message: updatedAssessment.is_published
          ? "Assessment published successfully! Candidates can now access it."
          : "Assessment unpublished. Candidates can no longer access it."
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.response?.data?.detail || "Failed to update publish status"
      });
    } finally {
      setPublishLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const getStatusInfo = () => {
    if (!assessment) return { label: "Unknown", color: "default", icon: <FiActivity /> };
    if (assessment.is_expired) {
      return { label: "Expired", color: "danger", icon: <FiAlertCircle /> };
    }
    if (assessment.is_published) {
      return { label: "Published", color: "success", icon: <FiCheckCircle /> };
    }
    return { label: "Draft", color: "warning", icon: <FiClock /> };
  };

  if (loading) {
    return (
      <div className="assessment-view-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading assessment...</p>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="assessment-view-container">
        <div className="error-state">
          <FiAlertCircle size={48} />
          <h2>Error Loading Assessment</h2>
          <p>{error || "Assessment not found"}</p>
          <button className="btn btn-primary" onClick={() => navigate("/admin/dashboard")}>
            <FiArrowLeft size={18} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo();
  const skills = Object.entries(assessment.required_skills || {});
  const assessmentLink = `${window.location.origin}/candidate-assessment/${assessment.assessment_id}`;

  return (
    <div className="assessment-view-container">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="view-header">
        <button className="btn-back" onClick={() => navigate("/admin/dashboard")}>
          <FiArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>

        <div className="header-actions">
          <button
            className={`btn ${assessment.is_published ? 'btn-warning' : 'btn-success'}`}
            onClick={handlePublish}
            disabled={publishLoading}
          >
            {publishLoading ? (
              <span className="btn-spinner" />
            ) : assessment.is_published ? (
              <FiEyeOff size={16} />
            ) : (
              <FiSend size={16} />
            )}
            {assessment.is_published ? "Unpublish" : "Publish"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/admin/assessment/${id}/edit`)}
          >
            <FiEdit2 size={16} />
            Edit
          </button>
          <button
            className={`btn btn-danger ${deleteConfirm ? "confirm" : ""}`}
            onClick={handleDelete}
          >
            <FiTrash2 size={16} />
            {deleteConfirm ? "Click to Confirm" : "Delete"}
          </button>
        </div>
      </div>

      <div className="view-content">
        {/* Tab Navigation */}
        <div className="tab-navigation" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #e0e0e0' }}>
          <button
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'details' ? '600' : '400',
              color: activeTab === 'details' ? '#1976d2' : '#666',
              borderBottom: activeTab === 'details' ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            <FiFileText style={{ marginRight: '0.5rem' }} />
            Assessment Details
          </button>
          <button
            className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'results' ? '600' : '400',
              color: activeTab === 'results' ? '#1976d2' : '#666',
              borderBottom: activeTab === 'results' ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            <FiAward style={{ marginRight: '0.5rem' }} />
            Candidate Results
          </button>
        </div>

        {activeTab === 'details' && (
          <>
            <div className="title-section">
              <div className="title-info">
                <h1>{assessment.title}</h1>
                {assessment.job_title && (
                  <span className="job-title">{assessment.job_title}</span>
                )}
              </div>
              <div className={`status-badge ${statusInfo.color}`}>
                {statusInfo.icon}
                <span>{statusInfo.label}</span>
              </div>
            </div>

            
            {assessment.description && (() => {
              try {
                const parsed =
                  typeof assessment.description === "string"
                    ? JSON.parse(assessment.description)
                    : assessment.description;

                // ✅ show only human-readable text
                if (parsed?.text) {
                  return (
                    <div className="description-section">
                      <p>{parsed.text}</p>
                    </div>
                  );
                }

                return null;
              } catch {
                // fallback: plain string (non-JSON legacy)
                return (
                  <div className="description-section">
                    <p>{assessment.description}</p>
                  </div>
                );
              }
            })()}


            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <FiClock size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{assessment.duration_minutes}</span>
                  <span className="stat-label">Minutes</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <FiFileText size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{assessment.assessment_method}</span>
                  <span className="stat-label">Method</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">
                  <FiUsers size={24} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{skills.length}</span>
                  <span className="stat-label">Skills Required</span>
                </div>
              </div>
            </div>

            <div className="link-section">
              <h3>
                <FiLink size={18} />
                Assessment Link
              </h3>
              <div className="link-box">
                <input type="text" readOnly value={assessmentLink} />
                <button className="btn-copy" onClick={handleCopyLink}>
                  <FiCopy size={16} />
                  Copy
                </button>
              </div>
              <p className="link-hint">Share this link with candidates to start the assessment</p>
              {assessment.expires_at ? (
                <p className={`link-expiry ${assessment.is_expired ? 'expired' : 'active'}`}>
                  <FiClock size={14} />
                  <span>
                    {assessment.is_expired
                      ? `Expired on ${new Date(assessment.expires_at).toLocaleString()}`
                      : `Expires on ${new Date(assessment.expires_at).toLocaleString()}`
                    }
                  </span>
                </p>
              ) : (
                <p className="link-note">
                  <FiClock size={14} />
                  <span>No expiry date set - link remains active indefinitely</span>
                </p>
              )}
            </div>

            {skills.length > 0 && (
              <div className="skills-section">
                <h3>Required Skills</h3>
                <div className="skills-grid">
                  {skills.map(([skill, level]) => (
                    <div key={skill} className="skill-item">
                      <span className="skill-name">{skill}</span>
                      <span className={`skill-level level-${level.toLowerCase()}`}>
                        {level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="settings-section">
              <h3>Assessment Settings</h3>
              <div className="settings-grid">
                <div className={`setting-item ${assessment.is_questionnaire_enabled ? "enabled" : "disabled"}`}>
                  <FiFileText size={20} />
                  <span>Questionnaire</span>
                  <span className="setting-status">
                    {assessment.is_questionnaire_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className={`setting-item ${assessment.is_interview_enabled ? "enabled" : "disabled"}`}>
                  <FiUsers size={20} />
                  <span>Interview</span>
                  <span className="setting-status">
                    {assessment.is_interview_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className={`setting-item ${assessment.is_active ? "enabled" : "disabled"}`}>
                  <FiActivity size={20} />
                  <span>Active Status</span>
                  <span className="setting-status">
                    {assessment.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin: Upload question docs for RAG ingestion */}
            {(() => {
              try {
                const logged = localStorage.getItem("loggedInUser");
                let email: string | null = null;
                try {
                  const parsed = logged ? JSON.parse(logged) : null;
                  if (parsed && typeof parsed === 'object' && parsed.email) {
                    email = parsed.email;
                  }
                } catch {
                  // logged may be a plain email string
                  if (logged && typeof logged === 'string') email = logged;
                }
                if (email && isAdmin(email)) {
                  return (
                    <div className="admin-upload-section" style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed #e0e0e0', borderRadius: '8px' }}>
                      <h3>Upload Question Documents (Admin)</h3>
                      <p style={{ color: '#666', marginTop: 0 }}>Upload a document to extract questions via RAG. The ingestion runs asynchronously.</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input type="file" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                        <button className="btn btn-primary" disabled={!selectedFile || uploading} onClick={async () => {
                          if (!selectedFile) return;
                          try {
                            setUploading(true);
                            setUploadProgress(0);
                            const resp = await uploadService.uploadQuestionDoc(selectedFile, assessment.assessment_id, (p) => setUploadProgress(p));
                            setLastUploadInfo({ doc_id: resp.doc_id, s3_key: resp.s3_key, task_id: resp.task_id });
                            setIngestionStatus(resp.task_id ? 'PENDING' : null);
                            setIngestionError(null);
                            // start polling status if we have a task id
                            if (resp.task_id) {
                              // clear any existing poller
                              if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null; }
                              pollingRef.current = window.setInterval(async () => {
                                try {
                                  const statusResp = await uploadService.getIngestionStatus(resp.task_id!);
                                  setIngestionStatus(statusResp.status);
                                  if (statusResp.status === 'SUCCESS') {
                                    window.clearInterval(pollingRef.current!);
                                    pollingRef.current = null;
                                    setToast({ type: 'success', message: 'Ingestion completed' });
                                    // refresh assessment details
                                    const refreshed = await assessmentService.getAssessment(id!);
                                    setAssessment(refreshed);
                                  } else if (statusResp.status === 'FAILURE') {
                                    window.clearInterval(pollingRef.current!);
                                    pollingRef.current = null;
                                    setIngestionError(statusResp.error || 'Ingestion failed');
                                    setToast({ type: 'error', message: 'Ingestion failed' });
                                  }
                            
                                  // Optionally we can offer a 'Generate Now' button; handled below
                                } catch (err: any) {
                                  // non-fatal: stop polling on 404
                                  if (err?.response?.status === 404) {
                                    window.clearInterval(pollingRef.current!);
                                    pollingRef.current = null;
                                    setIngestionError('Task not found');
                                  }
                                }
                              }, 2000);
                            }
                            setToast({ type: 'success', message: 'Uploaded and scheduled for ingestion' });
                            // refresh assessment details (generated questions may appear later)
                            const refreshed = await assessmentService.getAssessment(id!);
                            setAssessment(refreshed);
                          } catch (err: any) {
                            setToast({ type: 'error', message: err?.response?.data?.detail || 'Upload failed' });
                          } finally {
                            setUploading(false);
                            setUploadProgress(null);
                            setSelectedFile(null);
                          }
                        }}>Upload</button>
                      </div>
                      {uploadProgress !== null && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#1976d2' }} />
                          </div>
                          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>{uploadProgress}%</p>
                        </div>
                      )}

                      {lastUploadInfo && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#444' }}>
                          <strong>Doc ID:</strong> {lastUploadInfo.doc_id} • <strong>S3:</strong> {lastUploadInfo.s3_key}
                          {lastUploadInfo.task_id && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <strong>Ingestion:</strong> {ingestionStatus || 'PENDING'} {ingestionError && `• ${ingestionError}`}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin-only: Trigger generation from indexed docs for this assessment */}
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn btn-secondary" disabled={!assessment || !!generationTaskId} onClick={async () => {
                          try {
                            setGenerationStatus('QUEUED');
                            const res = await (window as any).questionGenService?.startGenerationForAssessment
                              ? await (window as any).questionGenService.startGenerationForAssessment(assessment.assessment_id, 10, 'rag')
                              : await (await import('../../API/services')).questionGenService.startGenerationForAssessment(assessment.assessment_id, 10, 'rag');
                            setGenerationTaskId(res.task_id);
                            setGenerationStatus('QUEUED');

                            // start polling generation status
                            if (generationPollingRef.current) { window.clearInterval(generationPollingRef.current); generationPollingRef.current = null; }
                            generationPollingRef.current = window.setInterval(async () => {
                              try {
                                const st = await (await import('../../API/services')).questionGenService.getGenerationStatus(res.task_id);
                                setGenerationStatus(st.status);
                                if (st.status === 'SUCCESS') {
                                  window.clearInterval(generationPollingRef.current!);
                                  generationPollingRef.current = null;
                                  setToast({ type: 'success', message: 'Question generation completed' });
                                  // refresh assessment
                                  const refreshed = await assessmentService.getAssessment(id!);
                                  setAssessment(refreshed);
                                  setGenerationTaskId(null);
                                } else if (st.status === 'FAILURE') {
                                  window.clearInterval(generationPollingRef.current!);
                                  generationPollingRef.current = null;
                                  setToast({ type: 'error', message: 'Question generation failed' });
                                  setGenerationTaskId(null);
                                }
                              } catch (err) {
                                // ignore
                              }
                            }, 2000);
                          } catch (err: any) {
                            setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to start generation' });
                            setGenerationStatus(null);
                            setGenerationTaskId(null);
                          }
                        }}>Generate Questions (RAG)</button>

                        {generationTaskId && <div style={{ fontSize: '0.9rem', color: '#444' }}>Generation: {generationStatus || 'QUEUED'}</div>}
                      </div>
                    </div>
                  );
                }
              } catch {
                // ignore parse errors
              }
              return null;
            })()}

            {/* Admin: Show generated questions if present */}
            {assessment.generated_questions && assessment.generated_questions.length > 0 && (() => {
              try {
                const logged = localStorage.getItem("loggedInUser");
                let email: string | null = null;
                try {
                  const parsed = logged ? JSON.parse(logged) : null;
                  if (parsed && typeof parsed === 'object' && parsed.email) {
                    email = parsed.email;
                  }
                } catch {
                  if (logged && typeof logged === 'string') email = logged;
                }
                if (email && isAdmin(email)) {
                  return (
                    <div className="generated-questions-section" style={{ marginTop: '1.5rem' }}>
                      <h3>Generated Questions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {assessment.generated_questions.map((q: any, idx: number) => (
                          <div key={q.id || idx} style={{ padding: '0.75rem', border: '1px solid #e0e0e0', borderRadius: '6px', background: '#fff' }}>
                            <p style={{ margin: 0, fontWeight: 600 }}>{q.question_text}</p>
                            {q.options && Array.isArray(q.options) && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                {q.options.map((opt: any) => (
                                  <div key={opt.option_id} style={{ marginBottom: '0.25rem' }}>
                                    <strong>{opt.option_id}.</strong> {opt.text}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch {
                // ignore
              }
              return null;
            })()}

            <div className="metadata-section">
              <div className="metadata-item">
                <FiCalendar size={16} />
                <span>Created: {formatDate(assessment.created_at)}</span>
              </div>
              <div className="metadata-item">
                <FiCalendar size={16} />
                <span>Updated: {formatDate(assessment.updated_at)}</span>
              </div>
              <div className="metadata-item">
                <FiMail size={16} />
                <span>ID: {assessment.assessment_id}</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'results' && (
          <div className="results-section">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiAward />
              Candidate Test Results
            </h2>

            {loadingSessions ? (
              <div className="loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="spinner" />
                <p>Loading test sessions...</p>
              </div>
            ) : testSessions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <FiUsers size={48} style={{ color: '#999', marginBottom: '1rem' }} />
                <p style={{ color: '#666' }}>No candidates have taken this assessment yet.</p>
              </div>
            ) : (
              <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {testSessions.map((session) => (
                  <div
                    key={session.session_id}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <p style={{ fontWeight: '600', fontSize: '1rem', margin: 0 }}>
                          {session.candidate_name || 'Anonymous Candidate'}
                        </p>
                        {session.is_completed && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            backgroundColor: '#e8f5e9',
                            color: '#2e7d32',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <FiCheckCircle size={12} /> Completed
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0' }}>
                        <FiMail size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                        {session.candidate_email || 'No email provided'}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#666', margin: '0.25rem 0' }}>
                        {session.completed_at && (
                          <>
                            <FiCalendar size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Completed: {new Date(session.completed_at).toLocaleString()}
                          </>
                        )}
                        {session.duration_seconds && (
                          <span style={{ marginLeft: '1rem' }}>
                            <FiClock size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Duration: {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
                          </span>
                        )}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {session.score_percentage !== null && (
                        <div style={{
                          textAlign: 'center',
                          minWidth: '80px'
                        }}>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: session.score_percentage >= 70 ? '#2e7d32' : session.score_percentage >= 50 ? '#f57c00' : '#c62828',
                          }}>
                            {session.score_percentage.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            {session.correct_answers || 0}/{session.total_questions}
                          </div>
                        </div>
                      )}
                      <button
                        className="btn btn-secondary"
                        onClick={() => viewDetailedResult(session.session_id)}
                        disabled={loadingResult}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', cursor: loadingResult ? 'not-allowed' : 'pointer' }}
                      >
                        <FiAward size={14} style={{ marginRight: '0.5rem' }} />
                        View Details
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => initiateLearningPath(session.session_id)}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                      >
                        <FiBookOpen size={14} style={{ marginRight: '0.5rem' }} />
                        Learning Path
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detailed Result Modal */}
            {selectedResult && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  width: '90%',
                  overflow: 'auto',
                  padding: '2rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3>Detailed Results</h3>
                    <button
                      onClick={() => setSelectedResult(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: selectedResult.score_percentage >= 70 ? '#4caf50' : selectedResult.score_percentage >= 50 ? '#ff9800' : '#f44336' }}>
                        {selectedResult.score_percentage.toFixed(1)}%
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Score</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>
                        {selectedResult.correct_answers}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Correct</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44336' }}>
                        {selectedResult.total_questions - selectedResult.correct_answers}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Incorrect</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>
                        {selectedResult.total_questions}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Total</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#666' }}>
                        {Math.floor(selectedResult.time_taken_seconds / 60)}m {selectedResult.time_taken_seconds % 60}s
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Time Taken</p>
                    </div>
                  </div>

                  <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                      <strong>Skill:</strong> {selectedResult.skill} • <strong>Level:</strong> {selectedResult.level}
                    </p>
                  </div>

                  <h4 style={{ marginBottom: '1rem' }}>Question Breakdown</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedResult.detailed_results.map((q, idx) => (
                      <div
                        key={q.question_id}
                        style={{
                          padding: '1rem',
                          backgroundColor: q.is_correct ? '#e8f5e9' : '#ffebee',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${q.is_correct ? '#4caf50' : '#f44336'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          {q.is_correct ? (
                            <FiCheckCircle size={20} style={{ color: '#4caf50', marginTop: '2px' }} />
                          ) : (
                            <FiAlertCircle size={20} style={{ color: '#f44336', marginTop: '2px' }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: '600', margin: '0 0 0.5rem 0' }}>
                              Q{idx + 1}. {q.question_text}
                            </p>
                            {q.options && q.options.length > 0 && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                {q.options.map((opt) => (
                                  <div 
                                    key={opt.option_id}
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      marginBottom: '0.25rem',
                                      borderRadius: '4px',
                                      backgroundColor: opt.option_id === q.correct_answer ? 'rgba(76, 175, 80, 0.2)' : 
                                                     opt.option_id === q.your_answer && !q.is_correct ? 'rgba(244, 67, 54, 0.2)' : 'transparent',
                                    }}
                                  >
                                    <strong>{opt.option_id}:</strong> {opt.text}
                                    {opt.option_id === q.correct_answer && <span style={{ color: '#4caf50', marginLeft: '0.5rem' }}>✓ Correct</span>}
                                    {opt.option_id === q.your_answer && !q.is_correct && <span style={{ color: '#f44336', marginLeft: '0.5rem' }}>✗ Your Answer</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {(!q.options || q.options.length === 0) && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                <p style={{ margin: '0.25rem 0', color: '#666' }}>
                                  <strong>Your Answer:</strong> {q.your_answer || 'No answer provided'}
                                </p>
                                {!q.is_correct && (
                                  <p style={{ margin: '0.25rem 0', color: '#4caf50' }}>
                                    <strong>Expected Answer:</strong> {q.correct_answer}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => setSelectedResult(null)}
                    style={{ marginTop: '1.5rem', width: '100%' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentViewContainer;
