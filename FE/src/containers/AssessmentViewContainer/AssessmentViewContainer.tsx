import React, { useState, useEffect, useRef } from "react";
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
  FiDownload,
  FiBarChart2,
  FiPieChart,
  FiTrendingUp,
} from "react-icons/fi";
import { assessmentService, quizService, assessmentResultsService } from "../../API/services";
import type { Assessment } from "../../API/services";
import Toast from "../../components/Toast/Toast";
import "./AssessmentViewContainer.scss";

// Simple QR Code generator component
const QRCodeCanvas: React.FC<{ value: string; size?: number; level?: 'L' | 'M' | 'Q' | 'H' }> = ({ 
  value, 
  size = 128,
  level = 'M' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple QR code generation using a library-free approach
    // For production, consider using 'qrcode' npm package
    const generateQR = async () => {
      try {
        // Dynamic import of qrcode library
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: level,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (err) {
        // Fallback: Draw a simple placeholder
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', size / 2, size / 2);
      }
    };

    generateQR();
  }, [value, size, level]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: '8px' }} />;
};

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
    answered_questions?: number;
    correct_answers: number | null;
    score_percentage: number | null;
    is_completed: boolean;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedResult, setSelectedResult] = useState<{
    session_id: string;
    question_set_id: string;
    skill: string;
    level: string;
    score_percentage: number | null;
    correct_answers: number;
    total_questions: number;
    completed_at: string | null;
    time_taken_seconds: number | null;
    is_partial?: boolean;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Array<{ option_id: string; text: string }>;
      points?: number;
      suggestion?: string;
      explanation?: string;
    }>;
  } | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const pollingRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'results' | 'questions' | 'analytics'>('details');
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionFilter, setQuestionFilter] = useState<'all' | 'mcq' | 'coding' | 'architecture' | 'screening'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resultsFilter, setResultsFilter] = useState<'all' | 'completed' | 'incomplete' | 'passed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  const fetchTestSessions = async () => {
    if (!id) return;
    try {
      setLoadingSessions(true);
      // Use the assessment results endpoint which includes test session data with scores
      const results = await assessmentResultsService.getAssessmentDetailedResults(id, false);
      // Transform to match the expected format
      const sessions = results.map(r => ({
        session_id: r.session_id,
        candidate_name: r.candidate_name,
        candidate_email: r.candidate_email,
        total_questions: r.total_questions,
        answered_questions: r.answered_questions,
        correct_answers: r.correct_answers,
        score_percentage: r.score_percentage,
        is_completed: r.is_completed,
        started_at: r.started_at,
        completed_at: r.completed_at,
        duration_seconds: r.duration_seconds,
      }));
      setTestSessions(sessions);
    } catch (err) {
      console.error("Error fetching test sessions:", err);
      // Fallback to empty array if admin endpoint fails (e.g., permissions issue)
      setTestSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const viewDetailedResult = async (sessionId: string) => {
    try {
      setLoadingResult(true);
      // Primary attempt: QuestionSet results endpoint
      const result = await quizService.getQuestionSetTestResults(sessionId);
      setSelectedResult(result);
      return;
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;

      if (status === 401 || status === 403) {
        setToast({ type: "error", message: "Authentication required. Please log in as an admin." });
        setTimeout(() => window.location.href = '/login', 800);
        return;
      }

      // If primary endpoint returned 404, try fallback to test-sessions endpoint
      if (status === 404) {
        try {
          const alt = await quizService.getTestResults(sessionId);
          // Map alt shape to selectedResult expected shape
          const mapped = {
            session_id: alt.session_id,
            question_set_id: (alt as any).question_set_id || "",
            skill: (alt as any).skill || "",
            level: (alt as any).level || "",
            score_percentage: alt.score_percentage,
            correct_answers: alt.correct_answers,
            total_questions: alt.total_questions,
            completed_at: alt.completed_at,
            time_taken_seconds: (alt as any).time_taken_seconds || 0,
            detailed_results: (alt.detailed_results || []).map((q: any) => ({
              question_id: q.question_id,
              question_text: q.question_text,
              your_answer: q.your_answer,
              correct_answer: q.correct_answer,
              is_correct: q.is_correct,
              options: q.options ? Object.entries(q.options).map(([k, v]) => ({ option_id: k, text: v })) : [],
              points: q.points,
              suggestion: q.suggestion,
            }))
          };

          setSelectedResult(mapped as any);
          return;
        } catch (altErr: any) {
          const altStatus = altErr?.response?.status;
          if (altStatus === 404) {
            setToast({ type: "error", message: "Results not found for this session (fallback tried)." });
          } else {
            setToast({ type: "error", message: altErr?.response?.data?.error || "Unable to fetch detailed results from fallback endpoint" });
          }
          return;
        }
      }

      if (status === 400) {
        setToast({ type: "info", message: serverMsg || "Test not yet completed. Detailed results will appear after submission." });
      } else {
        setToast({ type: "error", message: serverMsg || "Unable to fetch detailed results" });
      }
    } finally {
      setLoadingResult(false);
    }
  };

  const initiateLearningPath = async (sessionId: string) => {
    console.log("Navigating to learning path for session:", sessionId);
    navigate(`/admin/learning-path/${sessionId}`);
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
        
        // Extract questions if available (admin view)
        if (data.generated_questions) {
          setQuestions(data.generated_questions);
        } else if ((data as any).questions) {
          setQuestions((data as any).questions);
        }
        
        // reset last upload info when refetching
        // clear any transient upload info (moved to create/edit flow)
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
          <button
            className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'questions' ? '600' : '400',
              color: activeTab === 'questions' ? '#1976d2' : '#666',
              borderBottom: activeTab === 'questions' ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            <FiBookOpen style={{ marginRight: '0.5rem' }} />
            Questions ({questions.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: activeTab === 'analytics' ? '600' : '400',
              color: activeTab === 'analytics' ? '#1976d2' : '#666',
              borderBottom: activeTab === 'analytics' ? '2px solid #1976d2' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            <FiBarChart2 style={{ marginRight: '0.5rem' }} />
            Analytics & Reports
          </button>
        </div>

        {activeTab === 'details' && (
          <>
            {/* Header Section with Title and Status */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '2.5rem',
              marginBottom: '2rem',
              color: 'white',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700' }}>{assessment.title}</h1>
                    <div style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      background: statusInfo.color === 'active' ? 'rgba(46, 213, 115, 0.2)' 
                        : statusInfo.color === 'expired' ? 'rgba(255, 71, 87, 0.2)'
                        : 'rgba(255, 193, 7, 0.2)',
                      border: `2px solid ${statusInfo.color === 'active' ? '#2ed573' 
                        : statusInfo.color === 'expired' ? '#ff4757'
                        : '#ffc107'}`,
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </div>
                  </div>
                  {assessment.job_title && (
                    <div style={{ 
                      fontSize: '1.125rem', 
                      opacity: 0.9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                    }}>
                      <FiBookOpen size={18} />
                      {assessment.job_title}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats Overview */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginTop: '1.5rem',
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Total Attempts</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>{testSessions.length}</div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Completion Rate</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {testSessions.length > 0 
                      ? Math.round((testSessions.filter(s => s.score_percentage !== null && s.score_percentage !== undefined).length / testSessions.length) * 100)
                      : 0}%
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Avg. Score</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {testSessions.filter(s => s.score_percentage !== null && s.score_percentage !== undefined).length > 0
                      ? Math.round(testSessions
                          .filter(s => s.score_percentage !== null && s.score_percentage !== undefined)
                          .reduce((sum, s) => sum + (s.score_percentage || 0), 0) / 
                          testSessions.filter(s => s.score_percentage !== null && s.score_percentage !== undefined).length)
                      : 0}%
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Pass Rate</div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
                    {testSessions.filter(s => s.score_percentage !== null && s.score_percentage !== undefined).length > 0
                      ? Math.round((testSessions.filter(s => (s.score_percentage || 0) >= (assessment.passing_score_threshold || 70)).length / 
                          testSessions.filter(s => s.score_percentage !== null && s.score_percentage !== undefined).length) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {assessment.description && (() => {
              try {
                const parsed =
                  typeof assessment.description === "string"
                    ? JSON.parse(assessment.description)
                    : assessment.description;

                if (parsed?.text) {
                  return (
                    <div style={{ 
                      padding: '1.5rem', 
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                      borderRadius: '12px',
                      marginBottom: '2rem',
                      border: '1px solid #dee2e6',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <FiFileText size={18} style={{ color: '#667eea' }} />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#495057' }}>Description</h3>
                      </div>
                      <p style={{ margin: 0, lineHeight: '1.6', color: '#495057' }}>{parsed.text}</p>
                    </div>
                  );
                }
                return null;
              } catch {
                return (
                  <div style={{ 
                    padding: '1.5rem', 
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                    borderRadius: '12px',
                    marginBottom: '2rem',
                    border: '1px solid #dee2e6',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <FiFileText size={18} style={{ color: '#667eea' }} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#495057' }}>Description</h3>
                    </div>
                    <p style={{ margin: 0, lineHeight: '1.6', color: '#495057' }}>{assessment.description}</p>
                  </div>
                );
              }
            })()}

            {/* Assessment Insights - At a Glance */}
            <div style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '2px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <FiActivity size={20} style={{ color: '#667eea' }} />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Assessment Insights</h3>
                <span style={{
                  marginLeft: 'auto',
                  padding: '0.25rem 0.75rem',
                  background: '#f0f0f0',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#666',
                }}>
                  At a Glance
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}>
                {/* Time per question */}
                <div style={{
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
                  borderRadius: '8px',
                  border: '2px solid #00bcd4',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#00838f', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Avg. Time/Question
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#00838f' }}>
                    {(() => {
                      const completedSessions = testSessions.filter(s => s.is_completed && s.duration_seconds && s.total_questions > 0);
                      if (completedSessions.length === 0) return '0';
                      const avgSeconds = completedSessions.reduce((sum, s) => sum + (s.duration_seconds! / s.total_questions), 0) / completedSessions.length;
                      return Math.round(avgSeconds / 60 * 10) / 10;
                    })()} min
                  </div>
                </div>

                {/* Difficulty estimate */}
                <div style={{
                  padding: '1.25rem',
                  background: (() => {
                    const completedSessions = testSessions.filter(s => s.is_completed && s.score_percentage !== null);
                    if (completedSessions.length === 0) {
                      return 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)';
                    }
                    const avgScore = completedSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completedSessions.length;
                    return avgScore >= 80 
                      ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
                      : avgScore >= 60
                      ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                      : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
                  })(),
                  borderRadius: '8px',
                  border: `2px solid ${(() => {
                    const completedSessions = testSessions.filter(s => s.is_completed && s.score_percentage !== null);
                    if (completedSessions.length === 0) return '#bdbdbd';
                    const avgScore = completedSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completedSessions.length;
                    return avgScore >= 80 ? '#4caf50' : avgScore >= 60 ? '#ff9800' : '#f44336';
                  })()}`,
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: (() => {
                      const completedSessions = testSessions.filter(s => s.is_completed && s.score_percentage !== null);
                      if (completedSessions.length === 0) return '#757575';
                      const avgScore = completedSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completedSessions.length;
                      return avgScore >= 80 ? '#2e7d32' : avgScore >= 60 ? '#e65100' : '#c62828';
                    })(),
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                  }}>
                    Difficulty Level
                  </div>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700',
                    color: (() => {
                      const completedSessions = testSessions.filter(s => s.is_completed && s.score_percentage !== null);
                      if (completedSessions.length === 0) return '#757575';
                      const avgScore = completedSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completedSessions.length;
                      return avgScore >= 80 ? '#2e7d32' : avgScore >= 60 ? '#e65100' : '#c62828';
                    })(),
                  }}>
                    {(() => {
                      const completedSessions = testSessions.filter(s => s.is_completed && s.score_percentage !== null);
                      if (completedSessions.length === 0) return 'N/A';
                      const avgScore = completedSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / completedSessions.length;
                      return avgScore >= 80 ? 'Easy' : avgScore >= 60 ? 'Medium' : 'Hard';
                    })()}
                  </div>
                </div>

                {/* Question variety */}
                {assessment.question_type_mix && (
                  <div style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                    borderRadius: '8px',
                    border: '2px solid #9c27b0',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#6a1b9a', marginBottom: '0.5rem', fontWeight: '600' }}>
                      Question Types
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#6a1b9a' }}>
                      {Object.keys(assessment.question_type_mix).length}
                    </div>
                  </div>
                )}

                {/* Candidate engagement */}
                <div style={{
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)',
                  borderRadius: '8px',
                  border: '2px solid #fbc02d',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#f57f17', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Candidates Assessed
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f57f17' }}>
                    {testSessions.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '1.5rem', 
              marginBottom: '2rem' 
            }}>
              {/* Duration Card */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiClock size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Duration</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>{assessment.duration_minutes}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Minutes allocated</div>
              </div>

              {/* Total Questions Card */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(245, 87, 108, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiFileText size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Questions</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>{assessment.total_questions || 0}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total in assessment</div>
              </div>

              {/* Pass Threshold Card */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiAward size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Pass Score</div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>{assessment.passing_score_threshold || 70}%</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Minimum to pass</div>
              </div>

              {/* Assessment Method Card */}
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                borderRadius: '12px',
                color: 'white',
                boxShadow: '0 4px 12px rgba(250, 112, 154, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiBookOpen size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem' }}>Method</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', lineHeight: 1, textTransform: 'capitalize' }}>
                      {assessment.assessment_method}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Assessment type</div>
              </div>
            </div>

            {/* Assessment Link Section */}
            <div style={{ 
              padding: '2rem', 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '2px solid #e0e0e0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <FiLink size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Share Assessment Link</h3>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                padding: '1.25rem',
                background: 'white',
                borderRadius: '10px',
                marginBottom: '1.25rem',
                border: '2px solid #e0e0e0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}>
                <input 
                  type="text" 
                  readOnly 
                  value={assessmentLink}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: '2px solid #dee2e6',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    background: '#f8f9fa',
                    fontWeight: '500',
                  }}
                  onClick={(e) => e.currentTarget.select()}
                />
                <button 
                  onClick={handleCopyLink}
                  style={{
                    padding: '0.875rem 1.75rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }}
                >
                  <FiCopy size={16} />
                  Copy Link
                </button>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr auto', 
                gap: '1.5rem',
                alignItems: 'start',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ 
                    padding: '1rem',
                    background: '#e3f2fd',
                    borderRadius: '8px',
                    border: '1px solid #90caf9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <FiSend size={18} style={{ color: '#1976d2', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.875rem', color: '#1565c0', fontWeight: '500' }}>
                      Share this link with candidates to start the assessment
                    </span>
                  </div>
                  
                  {assessment.expires_at ? (
                    <div style={{ 
                      padding: '1rem',
                      background: assessment.is_expired ? '#ffebee' : '#e8f5e9',
                      borderRadius: '8px',
                      border: `1px solid ${assessment.is_expired ? '#ef5350' : '#66bb6a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}>
                      <FiClock size={18} style={{ 
                        color: assessment.is_expired ? '#c62828' : '#2e7d32',
                        flexShrink: 0,
                      }} />
                      <span style={{ 
                        fontSize: '0.875rem', 
                        color: assessment.is_expired ? '#c62828' : '#2e7d32',
                        fontWeight: '500',
                      }}>
                        {assessment.is_expired
                          ? `❌ Expired on ${new Date(assessment.expires_at).toLocaleString()}`
                          : `⏰ Expires on ${new Date(assessment.expires_at).toLocaleString()}`
                        }
                      </span>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '1rem',
                      background: '#f3e5f5',
                      borderRadius: '8px',
                      border: '1px solid #ba68c8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}>
                      <FiClock size={18} style={{ color: '#7b1fa2', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', color: '#6a1b9a', fontWeight: '500' }}>
                        ♾️ No expiry date - link remains active indefinitely
                      </span>
                    </div>
                  )}
                </div>

                {/* QR Code */}
                <div style={{
                  padding: '1.5rem',
                  background: 'white',
                  borderRadius: '10px',
                  border: '2px solid #e0e0e0',
                  textAlign: 'center',
                  minWidth: '140px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  <QRCodeCanvas
                    value={`${window.location.origin}/candidate/assessment/${assessment.assessment_id}`}
                    size={100}
                    level="M"
                  />
                  <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: '600' }}>
                    Scan to Access
                  </div>
                </div>
              </div>
            </div>

            {/* Required Skills Section */}
            {skills.length > 0 && (
              <div style={{ 
                padding: '2rem', 
                background: 'white',
                borderRadius: '12px',
                marginBottom: '2rem',
                border: '2px solid #e0e0e0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <FiAward size={20} style={{ color: '#667eea' }} />
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Required Skills & Proficiency</h3>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: '1rem' 
                }}>
                  {skills.map(([skill, level]) => {
                    const levelColors: Record<string, { bg: string; color: string; border: string }> = {
                      beginner: { bg: '#e8f5e9', color: '#2e7d32', border: '#66bb6a' },
                      intermediate: { bg: '#fff3e0', color: '#e65100', border: '#ffa726' },
                      advanced: { bg: '#e3f2fd', color: '#0d47a1', border: '#42a5f5' },
                      expert: { bg: '#f3e5f5', color: '#6a1b9a', border: '#ab47bc' },
                    };
                    const colors = levelColors[level.toLowerCase()] || levelColors.intermediate;

                    return (
                      <div 
                        key={skill}
                        style={{
                          padding: '1rem',
                          background: colors.bg,
                          borderRadius: '8px',
                          border: `2px solid ${colors.border}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9375rem' }}>{skill}</span>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          backgroundColor: colors.color,
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {level}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Type Mix */}
            {assessment.question_type_mix && Object.keys(assessment.question_type_mix).length > 0 && (
              <div style={{ 
                padding: '2rem', 
                background: 'white',
                borderRadius: '12px',
                marginBottom: '2rem',
                border: '2px solid #e0e0e0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <FiPieChart size={20} style={{ color: '#667eea' }} />
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Question Type Distribution</h3>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '1rem' 
                }}>
                  {Object.entries(assessment.question_type_mix).map(([type, count]) => {
                    const typeInfo: Record<string, { icon: string; color: string; bg: string }> = {
                      mcq: { icon: '📝', color: '#1976d2', bg: '#e3f2fd' },
                      coding: { icon: '💻', color: '#7b1fa2', bg: '#f3e5f5' },
                      architecture: { icon: '🏗️', color: '#f57c00', bg: '#fff3e0' },
                      screening: { icon: '📋', color: '#388e3c', bg: '#e8f5e9' },
                    };
                    const info = typeInfo[type.toLowerCase()] || { icon: '❓', color: '#666', bg: '#f5f5f5' };

                    return (
                      <div 
                        key={type}
                        style={{
                          padding: '1.25rem',
                          background: info.bg,
                          borderRadius: '8px',
                          border: `2px solid ${info.color}`,
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{info.icon}</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: info.color, marginBottom: '0.25rem' }}>
                          {count}
                        </div>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '600', 
                          color: info.color,
                          textTransform: 'capitalize',
                        }}>
                          {type} Questions
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assessment Settings */}
            <div style={{ 
              padding: '2rem', 
              background: 'white',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '2px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <FiActivity size={20} style={{ color: '#667eea' }} />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Assessment Configuration</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Questionnaire', enabled: assessment.is_questionnaire_enabled, icon: <FiFileText size={20} /> },
                  { label: 'Interview Mode', enabled: assessment.is_interview_enabled, icon: <FiUsers size={20} /> },
                  { label: 'Active Status', enabled: assessment.is_active, icon: <FiActivity size={20} /> },
                  { label: 'Published', enabled: assessment.is_published, icon: <FiSend size={20} /> },
                  { label: 'Auto Adjust by Experience', enabled: assessment.auto_adjust_by_experience, icon: <FiTrendingUp size={20} /> },
                ].map((setting) => (
                  <div 
                    key={setting.label}
                    style={{
                      padding: '1rem',
                      background: setting.enabled ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                      borderRadius: '8px',
                      border: `2px solid ${setting.enabled ? '#4caf50' : '#f44336'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ color: setting.enabled ? '#2e7d32' : '#c62828' }}>
                      {setting.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                        {setting.label}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: setting.enabled ? '#2e7d32' : '#c62828',
                        textTransform: 'uppercase',
                      }}>
                        {setting.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Assessment Timeline & Metadata */}
            <div style={{ 
              padding: '2rem', 
              background: 'white',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '2px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <FiCalendar size={20} style={{ color: '#667eea' }} />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Assessment Timeline</h3>
              </div>
              
              {/* Timeline visualization */}
              <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                {/* Timeline line */}
                <div style={{
                  position: 'absolute',
                  left: '0.5rem',
                  top: '1rem',
                  bottom: '1rem',
                  width: '2px',
                  background: 'linear-gradient(to bottom, #667eea, #764ba2)',
                }} />
                
                {/* Created event */}
                <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-1.5rem',
                    top: '0.25rem',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#667eea',
                    border: '3px solid white',
                    boxShadow: '0 0 0 2px #667eea',
                  }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                      Assessment Created
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                      {formatDate(assessment.created_at)}
                    </div>
                  </div>
                </div>

                {/* Last updated event */}
                <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-1.5rem',
                    top: '0.25rem',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#764ba2',
                    border: '3px solid white',
                    boxShadow: '0 0 0 2px #764ba2',
                  }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                      Last Updated
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
                      {formatDate(assessment.updated_at)}
                    </div>
                  </div>
                </div>

                {/* Expiry event (if exists) */}
                {assessment.expires_at && (
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-1.5rem',
                      top: '0.25rem',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: assessment.is_expired ? '#dc3545' : '#28a745',
                      border: '3px solid white',
                      boxShadow: `0 0 0 2px ${assessment.is_expired ? '#dc3545' : '#28a745'}`,
                    }} />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                        {assessment.is_expired ? 'Expired' : 'Expires'}
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        color: assessment.is_expired ? '#dc3545' : '#28a745',
                        fontWeight: '500',
                      }}>
                        {new Date(assessment.expires_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Metadata */}
              <div style={{
                marginTop: '1.5rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e0e0e0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}>
                <div style={{
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.5rem' }}>Assessment ID</div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}>
                    {assessment.assessment_id}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.5rem' }}>Assessment Method</div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    textTransform: 'capitalize',
                  }}>
                    {assessment.assessment_method || 'Standard'}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '0.5rem' }}>Total Questions</div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    color: '#1e293b',
                  }}>
                    {assessment.total_questions || questions.length || 0} Questions
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{ 
              padding: '2rem', 
              background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '2px solid #e0e0e0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <FiActivity size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Quick Actions</h3>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}>
                <button
                  onClick={() => setActiveTab('results')}
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiUsers size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>View Results</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      {testSessions.length} candidates
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('questions')}
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(245, 87, 108, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 87, 108, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 87, 108, 0.3)';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiFileText size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>View Questions</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      {questions.length} questions
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 172, 254, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.3)';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiBarChart2 size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>View Analytics</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      Reports & insights
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(250, 112, 154, 0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(250, 112, 154, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 112, 154, 0.3)';
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FiCopy size={20} />
                  </div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>Copy Link</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      Share with candidates
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'results' && (
          <div className="results-section">
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FiAward />
                Candidate Test Results
              </h2>

              {loadingSessions ? (
                <div className="loading-state" style={{ padding: '2rem', textAlign: 'center' }}>
                  <div className="spinner" />
                  <p>Loading test sessions...</p>
                </div>
              ) : (
                <>
                  {/* Statistics Dashboard */}
                  {testSessions.length > 0 && (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                      gap: '1rem', 
                      marginBottom: '2rem' 
                    }}>
                      {/* Total Attempts */}
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      }}>
                        <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Total Attempts</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>{testSessions.length}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                          {testSessions.filter(s => s.is_completed).length} completed
                        </div>
                      </div>

                      {/* Average Score */}
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(245, 87, 108, 0.3)',
                      }}>
                        <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Average Score</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                          {testSessions.filter(s => s.score_percentage !== null).length > 0
                            ? (testSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / 
                               testSessions.filter(s => s.score_percentage !== null).length).toFixed(1)
                            : '0'}%
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                          across all completed tests
                        </div>
                      </div>

                      {/* Pass Rate */}
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(79, 172, 254, 0.3)',
                      }}>
                        <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Pass Rate</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                          {testSessions.filter(s => s.score_percentage !== null).length > 0
                            ? ((testSessions.filter(s => (s.score_percentage || 0) >= 70).length / 
                                testSessions.filter(s => s.score_percentage !== null).length) * 100).toFixed(0)
                            : '0'}%
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                          {testSessions.filter(s => (s.score_percentage || 0) >= 70).length} passed out of {testSessions.filter(s => s.score_percentage !== null).length}
                        </div>
                      </div>

                      {/* Highest Score */}
                      <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        borderRadius: '12px',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(250, 112, 154, 0.3)',
                      }}>
                        <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>Highest Score</div>
                        <div style={{ fontSize: '2rem', fontWeight: '700' }}>
                          {testSessions.filter(s => s.score_percentage !== null).length > 0
                            ? Math.max(...testSessions.map(s => s.score_percentage || 0)).toFixed(1)
                            : '0'}%
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>
                          top performer
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filters and Sort */}
                  {testSessions.length > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      gap: '1rem', 
                      marginBottom: '1.5rem', 
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', alignSelf: 'center' }}>Filter:</span>
                        {[
                          { value: 'all', label: 'All', count: testSessions.length },
                          { value: 'completed', label: 'Completed', count: testSessions.filter(s => s.is_completed).length },
                          { value: 'incomplete', label: 'Incomplete', count: testSessions.filter(s => !s.is_completed).length },
                          { value: 'passed', label: 'Passed', count: testSessions.filter(s => (s.score_percentage || 0) >= 70).length },
                          { value: 'failed', label: 'Failed', count: testSessions.filter(s => s.score_percentage !== null && (s.score_percentage || 0) < 70).length },
                        ].map(filter => (
                          <button
                            key={filter.value}
                            onClick={() => setResultsFilter(filter.value as any)}
                            style={{
                              padding: '0.5rem 1rem',
                              border: 'none',
                              borderRadius: '20px',
                              backgroundColor: resultsFilter === filter.value ? '#1976d2' : 'white',
                              color: resultsFilter === filter.value ? 'white' : '#666',
                              cursor: 'pointer',
                              fontWeight: resultsFilter === filter.value ? '600' : '400',
                              fontSize: '0.875rem',
                              transition: 'all 0.2s',
                              boxShadow: resultsFilter === filter.value ? '0 2px 8px rgba(25, 118, 210, 0.3)' : 'none',
                            }}
                          >
                            {filter.label} ({filter.count})
                          </button>
                        ))}
                      </div>
                      
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Sort by:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            fontSize: '0.875rem',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="date">Date (Newest First)</option>
                          <option value="score">Score (Highest First)</option>
                          <option value="name">Name (A-Z)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {testSessions.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '12px' }}>
                      <FiUsers size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                      <h3 style={{ color: '#666', marginBottom: '0.5rem' }}>No Test Results Yet</h3>
                      <p style={{ color: '#999', fontSize: '0.875rem' }}>
                        Candidates who complete this assessment will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {testSessions
                        .filter(session => {
                          if (resultsFilter === 'completed') return session.is_completed;
                          if (resultsFilter === 'incomplete') return !session.is_completed;
                          if (resultsFilter === 'passed') return (session.score_percentage || 0) >= 70;
                          if (resultsFilter === 'failed') return session.score_percentage !== null && (session.score_percentage || 0) < 70;
                          return true;
                        })
                        .sort((a, b) => {
                          if (sortBy === 'date') {
                            return new Date(b.completed_at || b.started_at || '').getTime() - 
                                   new Date(a.completed_at || a.started_at || '').getTime();
                          }
                          if (sortBy === 'score') {
                            return (b.score_percentage || 0) - (a.score_percentage || 0);
                          }
                          if (sortBy === 'name') {
                            return (a.candidate_name || '').localeCompare(b.candidate_name || '');
                          }
                          return 0;
                        })
                        .map((session, index) => {
                          const scorePercentage = session.score_percentage || 0;
                          const scoreColor = scorePercentage >= 70 ? '#2e7d32' : scorePercentage >= 50 ? '#f57c00' : '#c62828';
                          const scoreGradient = scorePercentage >= 70 
                            ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'
                            : scorePercentage >= 50
                            ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)'
                            : 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';

                          return (
                            <div
                              key={session.session_id}
                              style={{
                                padding: '1.5rem',
                                background: 'white',
                                border: '2px solid #e0e0e0',
                                borderRadius: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                transition: 'all 0.3s',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Rank Badge for top 3 */}
                              {sortBy === 'score' && index < 3 && session.score_percentage !== null && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '20px',
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  background: index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' :
                                             index === 1 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' :
                                             'linear-gradient(135deg, #cd7f32 0%, #e59866 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.25rem',
                                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                                }}>
                                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>
                                {/* Candidate Info */}
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                    <div style={{
                                      width: '48px',
                                      height: '48px',
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '1.25rem',
                                      fontWeight: '700',
                                    }}>
                                      {(session.candidate_name || 'A')[0].toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
                                        {session.candidate_name || 'Anonymous Candidate'}
                                      </h3>
                                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FiMail size={14} />
                                        {session.candidate_email || 'No email provided'}
                                      </p>
                                    </div>
                                    {session.is_completed ? (
                                      <span style={{
                                        padding: '0.4rem 0.875rem',
                                        borderRadius: '20px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                      }}>
                                        <FiCheckCircle size={14} /> Completed
                                      </span>
                                    ) : (
                                      <span style={{
                                        padding: '0.4rem 0.875rem',
                                        borderRadius: '20px',
                                        backgroundColor: '#fbbf24',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                      }}>
                                        <FiClock size={14} /> In Progress
                                      </span>
                                    )}
                                  </div>

                                  {/* Progress Bar for Incomplete Sessions */}
                                  {!session.is_completed && (
                                    <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.75rem',
                                        color: '#64748b'
                                      }}>
                                        <span>Test Progress</span>
                                        <span style={{ fontWeight: '600', color: '#f59e0b' }}>
                                          {Math.round(((session.answered_questions || 0) / session.total_questions) * 100)}% Complete
                                        </span>
                                      </div>
                                      <div style={{
                                        width: '100%',
                                        height: '8px',
                                        backgroundColor: '#e2e8f0',
                                        borderRadius: '4px',
                                        overflow: 'hidden'
                                      }}>
                                        <div style={{
                                          width: `${((session.answered_questions || 0) / session.total_questions) * 100}%`,
                                          height: '100%',
                                          background: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)',
                                          transition: 'width 0.3s ease',
                                          borderRadius: '4px'
                                        }} />
                                      </div>
                                    </div>
                                  )}

                                  {/* Test Details */}
                                  <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                                    gap: '1rem', 
                                    marginTop: '1rem',
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '8px',
                                  }}>
                                    {session.completed_at && (
                                      <div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <FiCalendar size={12} /> Completed
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                                          {new Date(session.completed_at).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    )}
                                    {session.duration_seconds !== null && (
                                      <div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          <FiClock size={12} /> Duration
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                                          {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <FiActivity size={12} /> {session.is_completed ? 'Questions' : 'Progress'}
                                      </div>
                                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                                        {session.is_completed ? (
                                          `${session.correct_answers || 0} / ${session.total_questions} correct`
                                        ) : (
                                          <>
                                            {session.answered_questions || 0} / {session.total_questions} answered
                                            <span style={{ 
                                              display: 'inline-block',
                                              marginLeft: '0.5rem',
                                              fontSize: '0.75rem',
                                              padding: '0.125rem 0.5rem',
                                              backgroundColor: '#fef3c7',
                                              color: '#f59e0b',
                                              borderRadius: '4px',
                                              fontWeight: '500'
                                            }}>
                                              {Math.round(((session.answered_questions || 0) / session.total_questions) * 100)}%
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Score Card */}
                                {session.score_percentage !== null && (
                                  <div style={{
                                    minWidth: '160px',
                                    padding: '1.5rem',
                                    background: scoreGradient,
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    border: `2px solid ${scoreColor}`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: scoreColor, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      Final Score
                                    </div>
                                    <div style={{
                                      fontSize: '3rem',
                                      fontWeight: '700',
                                      color: scoreColor,
                                      lineHeight: 1,
                                      marginBottom: '0.5rem',
                                    }}>
                                      {session.score_percentage.toFixed(0)}%
                                    </div>
                                    <div style={{
                                      padding: '0.25rem 0.75rem',
                                      borderRadius: '12px',
                                      backgroundColor: scoreColor,
                                      color: 'white',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      display: 'inline-block',
                                    }}>
                                      {scorePercentage >= 70 ? '✓ PASSED' : '✗ FAILED'}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => navigate(`/admin/assessment-results/${session.session_id}`)}
                                  style={{ 
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '0.75rem 1.5rem',
                                  }}
                                >
                                  <FiAward size={16} />
                                  {session.is_completed ? 'View Detailed Results' : 'View Partial Results'}
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => viewDetailedResult(session.session_id)}
                                  disabled={loadingResult}
                                  style={{ 
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '0.75rem 1rem',
                                    cursor: loadingResult ? 'not-allowed' : 'pointer',
                                    opacity: loadingResult ? 0.6 : 1,
                                  }}
                                >
                                  <FiActivity size={16} />
                                  Quick View
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => initiateLearningPath(session.session_id)}
                                  style={{ 
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '0.75rem 1rem',
                                  }}
                                >
                                  <FiBookOpen size={16} />
                                  Learning Path
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              )}
            </div>

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
                    <h3>{selectedResult.is_partial ? 'Partial Results (Incomplete)' : 'Detailed Results'}</h3>
                    <button
                      onClick={() => setSelectedResult(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Warning banner for partial results */}
                  {selectedResult.is_partial && (
                    <div style={{
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}>
                      <FiAlertCircle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '0.25rem' }}>
                          Incomplete Assessment
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#856404' }}>
                          This candidate has not submitted their assessment yet. 
                          Showing answers for {selectedResult.detailed_results.length} of {selectedResult.total_questions} questions answered so far.
                          Results may not reflect final performance.
                        </p>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {selectedResult.score_percentage !== null && (
                      <div style={{ textAlign: 'center', minWidth: '100px' }}>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: selectedResult.score_percentage >= 70 ? '#4caf50' : selectedResult.score_percentage >= 50 ? '#ff9800' : '#f44336' }}>
                          {selectedResult.score_percentage.toFixed(1)}%
                        </p>
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>Score</p>
                      </div>
                    )}
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50' }}>
                        {selectedResult.correct_answers}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Correct</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f44336' }}>
                        {selectedResult.detailed_results.length - selectedResult.correct_answers}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Incorrect</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3' }}>
                        {selectedResult.detailed_results.length} / {selectedResult.total_questions}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Answered</p>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>
                        {selectedResult.total_questions}
                      </p>
                      <p style={{ color: '#666', fontSize: '0.875rem' }}>Total</p>
                    </div>
                    {selectedResult.time_taken_seconds !== null && selectedResult.time_taken_seconds !== undefined && (
                      <div style={{ textAlign: 'center', minWidth: '100px' }}>
                        <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#666' }}>
                          {Math.floor(selectedResult.time_taken_seconds / 60)}m {selectedResult.time_taken_seconds % 60}s
                        </p>
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>Time Taken</p>
                      </div>
                    )}
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

                                <div style={{ marginTop: '0.5rem', color: '#333' }}>
                                  <strong>Points:</strong> {typeof q.points === 'number' ? q.points : (q.is_correct ? 1 : 0)} / 1
                                </div>

                                {q.suggestion && (
                                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff8e1', borderRadius: '6px', color: '#6b4f00' }}>
                                    <strong>Suggestion:</strong> {q.suggestion}
                                  </div>
                                )}
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
                                <p style={{ margin: '0.25rem 0', color: '#333' }}>
                                  <strong>Points:</strong> {typeof q.points === 'number' ? q.points : (q.is_correct ? 1 : 0)} / 1
                                </p>
                                {q.suggestion && (
                                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff8e1', borderRadius: '6px', color: '#6b4f00' }}>
                                    <strong>Suggestion:</strong> {q.suggestion}
                                  </div>
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

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="questions-tab">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['all', 'mcq', 'coding', 'architecture', 'screening'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setQuestionFilter(filter as any)}
                      style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        borderRadius: '20px',
                        backgroundColor: questionFilter === filter ? '#1976d2' : '#f5f5f5',
                        color: questionFilter === filter ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: questionFilter === filter ? '600' : '400',
                        fontSize: '0.875rem',
                        textTransform: 'capitalize',
                        transition: 'all 0.2s',
                      }}
                    >
                      {filter} ({questions.filter(q => filter === 'all' || q.question_type === filter).length})
                    </button>
                  ))}
                </div>
              </div>

              {questions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  <FiAlertCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No questions available for this assessment yet.</p>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    Questions will appear here after the assessment is generated.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions
                    .filter(q => questionFilter === 'all' || q.question_type === questionFilter)
                    .filter(q => {
                      if (!searchQuery) return true;
                      const search = searchQuery.toLowerCase();
                      return q.question_text?.toLowerCase().includes(search) ||
                             q.question_type?.toLowerCase().includes(search);
                    })
                    .map((q, idx) => {
                      const typeColors: Record<string, { bg: string; border: string; icon: string }> = {
                        mcq: { bg: '#e3f2fd', border: '#1976d2', icon: '📝' },
                        coding: { bg: '#f3e5f5', border: '#7b1fa2', icon: '💻' },
                        architecture: { bg: '#fff3e0', border: '#f57c00', icon: '🏗️' },
                        screening: { bg: '#e8f5e9', border: '#388e3c', icon: '📋' },
                      };
                      const colors = typeColors[q.question_type] || typeColors.mcq;

                      return (
                        <div
                          key={q.id || idx}
                          style={{
                            padding: '1.5rem',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            border: `2px solid ${colors.border}`,
                            borderLeft: `6px solid ${colors.border}`,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '2rem' }}>{colors.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    padding: '0.25rem 0.75rem',
                                    backgroundColor: colors.bg,
                                    color: colors.border,
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {q.question_type}
                                </span>
                                {q.difficulty && (
                                  <span
                                    style={{
                                      padding: '0.25rem 0.75rem',
                                      backgroundColor: q.difficulty === 'easy' ? '#e8f5e9' : 
                                                      q.difficulty === 'medium' ? '#fff3e0' : '#ffebee',
                                      color: q.difficulty === 'easy' ? '#2e7d32' : 
                                             q.difficulty === 'medium' ? '#f57c00' : '#c62828',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {q.difficulty}
                                  </span>
                                )}
                                <span style={{ color: '#999', fontSize: '0.875rem' }}>
                                  Question #{idx + 1}
                                </span>
                              </div>
                              <p style={{ margin: '0.75rem 0', fontSize: '1rem', fontWeight: '500', lineHeight: '1.5' }}>
                                {q.question_text}
                              </p>

                              {/* MCQ Options */}
                              {q.question_type === 'mcq' && q.options && Array.isArray(q.options) && (
                                <div style={{ marginTop: '1rem' }}>
                                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem' }}>
                                    Options:
                                  </p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {q.options.map((opt: any) => (
                                      <div
                                        key={opt.option_id}
                                        style={{
                                          padding: '0.75rem',
                                          backgroundColor: opt.option_id === q.correct_answer ? '#e8f5e9' : '#f8f9fa',
                                          borderRadius: '8px',
                                          border: opt.option_id === q.correct_answer ? '2px solid #4caf50' : '1px solid #e0e0e0',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                        }}
                                      >
                                        <strong>{opt.option_id}.</strong>
                                        <span>{opt.text}</span>
                                        {opt.option_id === q.correct_answer && (
                                          <span style={{ marginLeft: 'auto', color: '#4caf50', fontWeight: '600', fontSize: '0.875rem' }}>
                                            ✓ Correct Answer
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Coding/Architecture Details */}
                              {(q.question_type === 'coding' || q.question_type === 'architecture') && q.options && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                                  <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
                                    <strong>Type:</strong> {q.options.type || 'Open-ended response'}
                                  </p>
                                  {q.options.description && (
                                    <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                                      <strong>Details:</strong> {q.options.description}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Correct Answer for non-MCQ */}
                              {q.question_type !== 'mcq' && q.correct_answer && (
                                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e8f5e9', borderRadius: '8px', borderLeft: '4px solid #4caf50' }}>
                                  <p style={{ fontSize: '0.875rem', margin: 0 }}>
                                    <strong>Expected Answer/Solution:</strong> {q.correct_answer}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="analytics-tab">
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiBarChart2 />
                  Analytics & Reports
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const csvData = testSessions.map(s => ({
                        Name: s.candidate_name || 'Anonymous',
                        Email: s.candidate_email || 'N/A',
                        Score: s.score_percentage?.toFixed(1) + '%' || 'N/A',
                        Correct: s.correct_answers || 0,
                        Total: s.total_questions,
                        Duration: s.duration_seconds ? `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s` : 'N/A',
                        Status: s.is_completed ? 'Completed' : 'In Progress',
                        CompletedAt: s.completed_at ? new Date(s.completed_at).toLocaleString() : 'N/A',
                      }));
                      const csv = [
                        Object.keys(csvData[0] || {}).join(','),
                        ...csvData.map(row => Object.values(row).join(','))
                      ].join('\\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `assessment-${assessment?.assessment_id}-results.csv`;
                      a.click();
                      setToast({ type: 'success', message: 'Results exported successfully!' });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FiDownload size={16} />
                    Export CSV
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.print()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FiDownload size={16} />
                    Print Report
                  </button>
                </div>
              </div>

              {testSessions.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '12px' }}>
                  <FiBarChart2 size={64} style={{ color: '#ccc', marginBottom: '1rem' }} />
                  <h3 style={{ color: '#666', marginBottom: '0.5rem' }}>No Analytics Data Available</h3>
                  <p style={{ color: '#999', fontSize: '0.875rem' }}>
                    Analytics will be generated once candidates complete the assessment.
                  </p>
                </div>
              ) : (
                <>
                  {/* Overview Statistics */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '1.5rem', 
                    marginBottom: '2rem' 
                  }}>
                    {/* Participation Rate */}
                    <div style={{
                      padding: '1.5rem',
                      background: 'white',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Participation
                        </h3>
                        <FiUsers size={24} style={{ color: '#667eea' }} />
                      </div>
                      <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
                        {testSessions.length}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {testSessions.filter(s => s.is_completed).length} completed • {' '}
                        {testSessions.filter(s => !s.is_completed).length} in progress
                      </div>
                      <div style={{ marginTop: '1rem', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${(testSessions.filter(s => s.is_completed).length / testSessions.length) * 100}%`,
                          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        }} />
                      </div>
                    </div>

                    {/* Average Performance */}
                    <div style={{
                      padding: '1.5rem',
                      background: 'white',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Avg Performance
                        </h3>
                        <FiTrendingUp size={24} style={{ color: '#10b981' }} />
                      </div>
                      <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
                        {testSessions.filter(s => s.score_percentage !== null).length > 0
                          ? (testSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / 
                             testSessions.filter(s => s.score_percentage !== null).length).toFixed(1)
                          : '0'}%
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Across {testSessions.filter(s => s.score_percentage !== null).length} completed tests
                      </div>
                    </div>

                    {/* Average Duration */}
                    <div style={{
                      padding: '1.5rem',
                      background: 'white',
                      borderRadius: '12px',
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Avg Duration
                        </h3>
                        <FiClock size={24} style={{ color: '#f59e0b' }} />
                      </div>
                      <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
                        {testSessions.filter(s => s.duration_seconds !== null).length > 0
                          ? Math.floor(testSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 
                              testSessions.filter(s => s.duration_seconds !== null).length / 60)
                          : '0'}m
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Average time to complete
                      </div>
                    </div>
                  </div>

                  {/* Score Distribution Chart */}
                  <div style={{ 
                    background: 'white', 
                    padding: '2rem', 
                    borderRadius: '12px', 
                    border: '2px solid #e0e0e0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    marginBottom: '2rem' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <FiPieChart size={20} style={{ color: '#667eea' }} />
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Score Distribution</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'center' }}>
                      {/* Bar Chart */}
                      <div>
                        {[
                          { range: '90-100%', label: 'Excellent', color: '#10b981', count: testSessions.filter(s => (s.score_percentage || 0) >= 90 && (s.score_percentage || 0) <= 100).length },
                          { range: '70-89%', label: 'Good', color: '#3b82f6', count: testSessions.filter(s => (s.score_percentage || 0) >= 70 && (s.score_percentage || 0) < 90).length },
                          { range: '50-69%', label: 'Average', color: '#f59e0b', count: testSessions.filter(s => (s.score_percentage || 0) >= 50 && (s.score_percentage || 0) < 70).length },
                          { range: '0-49%', label: 'Below Average', color: '#ef4444', count: testSessions.filter(s => (s.score_percentage || 0) >= 0 && (s.score_percentage || 0) < 50).length },
                        ].map(range => (
                          <div key={range.range} style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>
                                {range.label} ({range.range})
                              </span>
                              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: range.color }}>
                                {range.count} candidates
                              </span>
                            </div>
                            <div style={{ height: '32px', backgroundColor: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                              <div style={{
                                height: '100%',
                                width: `${testSessions.filter(s => s.score_percentage !== null).length > 0 ? (range.count / testSessions.filter(s => s.score_percentage !== null).length) * 100 : 0}%`,
                                backgroundColor: range.color,
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: '0.75rem',
                                transition: 'width 0.5s ease',
                              }}>
                                {range.count > 0 && (
                                  <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: '700' }}>
                                    {((range.count / testSessions.filter(s => s.score_percentage !== null).length) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary Stats */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ 
                          padding: '1.25rem', 
                          background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', 
                          borderRadius: '12px',
                          border: '2px solid #10b981',
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#065f46', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>
                            Passed
                          </div>
                          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#047857' }}>
                            {testSessions.filter(s => (s.score_percentage || 0) >= 70).length}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#065f46', marginTop: '0.25rem' }}>
                            {testSessions.filter(s => s.score_percentage !== null).length > 0
                              ? ((testSessions.filter(s => (s.score_percentage || 0) >= 70).length / testSessions.filter(s => s.score_percentage !== null).length) * 100).toFixed(0)
                              : '0'}% pass rate
                          </div>
                        </div>
                        <div style={{ 
                          padding: '1.25rem', 
                          background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', 
                          borderRadius: '12px',
                          border: '2px solid #ef4444',
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#991b1b', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>
                            Failed
                          </div>
                          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#dc2626' }}>
                            {testSessions.filter(s => s.score_percentage !== null && (s.score_percentage || 0) < 70).length}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.25rem' }}>
                            {testSessions.filter(s => s.score_percentage !== null).length > 0
                              ? ((testSessions.filter(s => s.score_percentage !== null && (s.score_percentage || 0) < 70).length / testSessions.filter(s => s.score_percentage !== null).length) * 100).toFixed(0)
                              : '0'}% fail rate
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question-Level Analytics */}
                  {questions.length > 0 && (
                    <div style={{ 
                      background: 'white', 
                      padding: '2rem', 
                      borderRadius: '12px', 
                      border: '2px solid #e0e0e0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      marginBottom: '2rem' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <FiActivity size={20} style={{ color: '#667eea' }} />
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Question Type Breakdown</h3>
                      </div>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '1rem' 
                      }}>
                        {['mcq', 'coding', 'architecture', 'screening'].map(type => {
                          const typeQuestions = questions.filter(q => q.question_type === type);
                          if (typeQuestions.length === 0) return null;
                          
                          const typeColors: Record<string, { bg: string; color: string; icon: string }> = {
                            mcq: { bg: '#dbeafe', color: '#1e40af', icon: '📝' },
                            coding: { bg: '#f3e8ff', color: '#6b21a8', icon: '💻' },
                            architecture: { bg: '#fed7aa', color: '#92400e', icon: '🏗️' },
                            screening: { bg: '#d1fae5', color: '#065f46', icon: '📋' },
                          };
                          const colors = typeColors[type];

                          return (
                            <div key={type} style={{ 
                              padding: '1.5rem', 
                              backgroundColor: colors.bg,
                              borderRadius: '12px',
                              border: `2px solid ${colors.color}`,
                            }}>
                              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{colors.icon}</div>
                              <div style={{ fontSize: '0.75rem', color: colors.color, marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: '600' }}>
                                {type}
                              </div>
                              <div style={{ fontSize: '2rem', fontWeight: '700', color: colors.color }}>
                                {typeQuestions.length}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: colors.color, marginTop: '0.25rem' }}>
                                {((typeQuestions.length / questions.length) * 100).toFixed(0)}% of total
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Performers */}
                  <div style={{ 
                    background: 'white', 
                    padding: '2rem', 
                    borderRadius: '12px', 
                    border: '2px solid #e0e0e0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <FiAward size={20} style={{ color: '#fbbf24' }} />
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Top Performers</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {testSessions
                        .filter(s => s.score_percentage !== null)
                        .sort((a, b) => (b.score_percentage || 0) - (a.score_percentage || 0))
                        .slice(0, 5)
                        .map((session, index) => (
                          <div key={session.session_id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem',
                            backgroundColor: index === 0 ? '#fef3c7' : '#f8fafc',
                            borderRadius: '8px',
                            border: index === 0 ? '2px solid #fbbf24' : '1px solid #e2e8f0',
                          }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' :
                                         index === 1 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' :
                                         index === 2 ? 'linear-gradient(135deg, #cd7f32 0%, #e59866 100%)' :
                                         'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                              fontWeight: '700',
                              color: 'white',
                            }}>
                              {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>
                                {session.candidate_name || 'Anonymous'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {session.candidate_email || 'No email'}
                              </div>
                            </div>
                            <div style={{ 
                              fontSize: '1.25rem', 
                              fontWeight: '700', 
                              color: '#10b981',
                              minWidth: '60px',
                              textAlign: 'right',
                            }}>
                              {session.score_percentage?.toFixed(1)}%
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentViewContainer;
