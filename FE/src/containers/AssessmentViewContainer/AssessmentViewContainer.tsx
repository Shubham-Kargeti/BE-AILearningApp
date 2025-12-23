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
import { assessmentService, quizService } from "../../API/services";
import type { Assessment } from "../../API/services";
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
    status: string;
    score_percentage: number | null;
    completed_at: string | null;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedResult, setSelectedResult] = useState<{
    session_id: string;
    score_percentage: number;
    correct_answers: number;
    total_questions: number;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
    }>;
  } | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'results'>('details');

  const fetchTestSessions = async () => {
    try {
      setLoadingSessions(true);
      const sessions = await quizService.listTestSessions();
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
      const result = await quizService.getTestResults(sessionId);
      setSelectedResult(result);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err?.response?.data?.detail?.message || "Results not yet available"
      });
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
      } catch (err: any) {
        console.error("Error fetching assessment:", err);
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
                      padding: '1rem 1.5rem',
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        Session: {session.session_id.slice(0, 12)}...
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>
                        Status: <span style={{
                          color: session.status === 'completed' ? '#4caf50' : '#ff9800',
                          fontWeight: '500'
                        }}>{session.status}</span>
                        {session.completed_at && ` • Completed: ${new Date(session.completed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {session.score_percentage !== null && (
                        <div style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '20px',
                          backgroundColor: session.score_percentage >= 70 ? '#e8f5e9' : session.score_percentage >= 50 ? '#fff3e0' : '#ffebee',
                          color: session.score_percentage >= 70 ? '#2e7d32' : session.score_percentage >= 50 ? '#f57c00' : '#c62828',
                          fontWeight: '600',
                        }}>
                          {session.score_percentage.toFixed(0)}%
                        </div>
                      )}
                      <button
                        className="btn btn-secondary"
                        onClick={() => viewDetailedResult(session.session_id)}
                        disabled={loadingResult}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        View Details
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => initiateLearningPath(session.session_id)}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        <FiBookOpen size={14} style={{ marginRight: '0.5rem' }} />
                        Initiate Learning Path
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

                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: selectedResult.score_percentage >= 70 ? '#4caf50' : '#f44336' }}>
                        {selectedResult.score_percentage.toFixed(0)}%
                      </p>
                      <p style={{ color: '#666' }}>Score</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>
                        {selectedResult.correct_answers}
                      </p>
                      <p style={{ color: '#666' }}>Correct</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                        {selectedResult.total_questions}
                      </p>
                      <p style={{ color: '#666' }}>Total</p>
                    </div>
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
                        <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                          Q{idx + 1}: {q.question_text}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#666' }}>
                          Answer: <span style={{ fontWeight: '500' }}>{q.your_answer || 'Not answered'}</span>
                          {!q.is_correct && (
                            <span style={{ marginLeft: '1rem', color: '#4caf50' }}>
                              Correct: {q.correct_answer}
                            </span>
                          )}
                        </p>
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
