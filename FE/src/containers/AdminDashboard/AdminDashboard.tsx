import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiPlus, FiSearch, FiFilter, FiEye, FiEdit2, FiTrash2, 
  FiAlertCircle, FiX, FiCheckCircle, FiClock, FiActivity, FiRefreshCw,
  FiUsers, FiTrendingUp, FiCalendar
} from "react-icons/fi";
import Toast from "../../components/Toast/Toast";
import { assessmentService } from "../../API/services";
import type { Assessment } from "../../API/services";
import "./AdminDashboard.scss";

interface DashboardStats {
  total_assessments: number;
  pending: number;
  active: number;
  in_progress: number;
  completed: number;
  expired: number;
}

interface DisplayAssessment {
  id: string;
  assessment_id: string;
  candidate_name: string;
  candidate_email: string;
  role: string;
  skills: { name: string; level: string; isCore: boolean }[];
  status: "pending" | "active" | "in_progress" | "completed" | "expired";
  created_at: string;
  updated_at: string;
  expires_at?: string;
  assessment_method?: string;
  total_questions?: number;
  auto_adjust_by_experience?: boolean;
  passing_score_threshold?: number;
}

interface ToastMessage {
  type: "success" | "error" | "info";
  message: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  const [assessments, setAssessments] = useState<DisplayAssessment[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_assessments: 0,
    pending: 0,
    active: 0,
    in_progress: 0,
    completed: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "active" | "in_progress" | "completed" | "expired">("all");
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        setLoading(true);
        setError("");
        
        const token = localStorage.getItem("authToken");
        
        if (!token) {
          setError("Authentication token not found. Please log in again.");
          setLoading(false);
          return;
        }

        const data = await assessmentService.listAssessments(undefined, 0, 50, true);
        
        const extractCandidateName = (description?: string, title?: string): string => {
          if (description) {
            const match = description.match(/candidate\s+(.+?)(?:\s*$|,)/i);
            if (match) return match[1].trim();
          }
          if (title && !title.toLowerCase().includes("assessment")) {
            return title;
          }
          return "N/A";
        };

        const getAssessmentStatus = (a: Assessment): "pending" | "active" | "in_progress" | "completed" | "expired" => {
          if (a.is_expired) {
            return "expired";
          }
          if (!a.is_published) {
            return "pending";
          }
          // Check if assessment has candidate activity
          if ((a.completed_sessions || 0) > 0) {
            return "completed";  // At least one candidate completed
          }
          if ((a.in_progress_sessions || 0) > 0) {
            return "in_progress";  // Candidates are taking it
          }
          return "active";  // Published but no candidates yet
        };

        const getDisplaySkills = (skills: Record<string, string>): { name: string; level: string; isCore: boolean }[] => {
          const skillEntries = Object.entries(skills || {});
          if (skillEntries.length === 0) return [];

          const highConfidenceLevels = ["expert", "advanced", "senior", "lead", "principal", "core", "5", "4", "3"];
          
          const allSkills = skillEntries.map(([name, level]) => ({
            name,
            level: String(level).toLowerCase(),
            isCore: highConfidenceLevels.some(hcl => String(level).toLowerCase().includes(hcl)) ||
                    parseInt(String(level)) >= 3
          }));
          
          allSkills.sort((a, b) => {
            if (a.isCore && !b.isCore) return -1;
            if (!a.isCore && b.isCore) return 1;
            return a.name.localeCompare(b.name);
          });
          
          return allSkills.slice(0, 5);
        };
        
        const displayData: DisplayAssessment[] = data.map((a: Assessment) => ({
          id: a.id.toString(),
          assessment_id: a.assessment_id,
          candidate_name: extractCandidateName(a.description, a.title),
          candidate_email: "",
          role: a.job_title || a.title,
          skills: getDisplaySkills(a.required_skills),
          status: getAssessmentStatus(a),
          created_at: a.created_at,
          updated_at: a.updated_at,
          expires_at: a.expires_at,
          assessment_method: a.assessment_method,
        }));
        
        setAssessments(displayData);
        console.log("[AdminDashboard] fetched assessments:", data.length, "mapped:", displayData.length);
        
        const calculatedStats = {
          total_assessments: displayData.length,
          pending: displayData.filter((a) => a.status === "pending").length,
          active: displayData.filter((a) => a.status === "active").length,
          in_progress: displayData.filter((a) => a.status === "in_progress").length,
          completed: displayData.filter((a) => a.status === "completed").length,
          expired: displayData.filter((a) => a.status === "expired").length,
        };
        
        setStats(calculatedStats);
        if (displayData.length > 0) {
          setToast({ type: "success", message: `Loaded ${displayData.length} assessments` });
        }
      } catch (err: any) {

        let errorMessage = "Failed to load assessments.";
        
        if (err.response?.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
        } else if (err.response?.status === 403) {
          errorMessage = "You don't have permission to view assessments.";
        } else if (err.response?.status === 404) {
          setAssessments([]);
          setStats({ total_assessments: 0, pending: 0, active: 0, in_progress: 0, completed: 0, expired: 0 });
          setLoading(false);
          return;
        } else if (!err.response) {
          errorMessage = "Unable to connect to the server.";
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, [retryCount]);

  const filteredAssessments = assessments.filter((assessment) => {
    const matchesSearch = 
      assessment.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assessment.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || assessment.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pending: { color: "warning", icon: <FiClock size={14} />, label: "Draft" },
      active: { color: "success", icon: <FiCheckCircle size={14} />, label: "Active" },
      in_progress: { color: "info", icon: <FiActivity size={14} />, label: "In Progress" },
      completed: { color: "primary", icon: <FiCheckCircle size={14} />, label: "Completed" },
      expired: { color: "danger", icon: <FiAlertCircle size={14} />, label: "Expired" },
    };
    return statusMap[status] || { color: "default", icon: "•", label: status };
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-IN", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    } catch {
      return "N/A";
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleViewAssessment = (assessment: DisplayAssessment) => {
    navigate(`/admin/assessment/${assessment.assessment_id}/view`);
  };

  const handleEditAssessment = (assessment: DisplayAssessment) => {
    navigate(`/admin/assessment/${assessment.assessment_id}/edit`);
  };

  const handleDeleteAssessment = async (assessment: DisplayAssessment) => {
    if (deleteConfirm !== assessment.id) {
      setDeleteConfirm(assessment.id);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      setActionLoading(assessment.id);
      await assessmentService.deleteAssessment(assessment.assessment_id);
      
      setAssessments(prev => prev.filter(a => a.id !== assessment.id));
      
      setStats(prev => ({
        ...prev,
        total_assessments: prev.total_assessments - 1,
        pending: prev.pending - (assessment.status === 'pending' ? 1 : 0),
        active: prev.active - (assessment.status === 'active' ? 1 : 0),
        in_progress: prev.in_progress - (assessment.status === 'in_progress' ? 1 : 0),
        completed: prev.completed - (assessment.status === 'completed' ? 1 : 0),
        expired: prev.expired - (assessment.status === 'expired' ? 1 : 0),
      }));
      
      setToast({ type: "success", message: "Assessment deleted successfully" });
    } catch (err: any) {

      setToast({ 
        type: "error", 
        message: err.response?.data?.detail || "Failed to delete assessment" 
      });
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="admin-dashboard">
      {/* TOAST NOTIFICATIONS */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* HEADER */}
      <div className="dashboard-header">
        <div className="header-decoration">
          <div className="decoration-circle circle-1" />
          <div className="decoration-circle circle-2" />
          <div className="decoration-circle circle-3" />
        </div>
        <div className="header-content">
          <div className="header-info">
            <span className="header-welcome">Welcome back 👋</span>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">
              <FiActivity size={14} />
              <span>Manage assessments, candidates, and track progress</span>
            </p>
          </div>
          <div className="header-actions">
            <div className="header-date">
              <FiCalendar size={16} />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <button 
              className="btn btn-primary btn-new-assessment"
              onClick={() => navigate("/admin/assessment")}
            >
              <FiPlus size={18} />
              <span>New Assessment</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR STATE WITH RETRY */}
      {error && (
        <div className="error-alert">
          <div className="error-content">
            <FiAlertCircle size={20} className="error-icon" />
            <div className="error-text">
              <p className="error-message">{error}</p>
            </div>
            <button 
              className="btn-retry"
              onClick={handleRetry}
              title="Retry fetching assessments"
            >
              <FiRefreshCw size={18} />
            </button>
            <button 
              className="btn-close"
              onClick={() => setError("")}
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon-wrapper">
            <FiUsers size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total_assessments}</div>
            <h3 className="stat-label">Total Assessments</h3>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              <FiTrendingUp size={14} />
              Active
            </span>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon-wrapper">
            <FiClock size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <h3 className="stat-label">Draft</h3>
          </div>
          <div className="stat-footer">
            <div className="stat-progress">
              <div 
                className="stat-progress-bar" 
                style={{ width: `${stats.total_assessments ? (stats.pending / stats.total_assessments) * 100 : 0}%` }}
              />
            </div>
            <span className="stat-percentage">
              {stats.total_assessments ? Math.round((stats.pending / stats.total_assessments) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon-wrapper">
            <FiCheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.active}</div>
            <h3 className="stat-label">Active</h3>
          </div>
          <div className="stat-footer">
            <div className="stat-progress">
              <div 
                className="stat-progress-bar" 
                style={{ width: `${stats.total_assessments ? (stats.active / stats.total_assessments) * 100 : 0}%` }}
              />
            </div>
            <span className="stat-percentage">
              {stats.total_assessments ? Math.round((stats.active / stats.total_assessments) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="stat-card in-progress">
          <div className="stat-icon-wrapper">
            <FiActivity size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.in_progress}</div>
            <h3 className="stat-label">In Progress</h3>
          </div>
          <div className="stat-footer">
            <div className="stat-progress">
              <div 
                className="stat-progress-bar" 
                style={{ width: `${stats.total_assessments ? (stats.in_progress / stats.total_assessments) * 100 : 0}%` }}
              />
            </div>
            <span className="stat-percentage">
              {stats.total_assessments ? Math.round((stats.in_progress / stats.total_assessments) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="stat-card completed">
          <div className="stat-icon-wrapper">
            <FiCheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <h3 className="stat-label">Completed</h3>
          </div>
          <div className="stat-footer">
            <div className="stat-progress">
              <div 
                className="stat-progress-bar" 
                style={{ width: `${stats.total_assessments ? (stats.completed / stats.total_assessments) * 100 : 0}%` }}
              />
            </div>
            <span className="stat-percentage">
              {stats.total_assessments ? Math.round((stats.completed / stats.total_assessments) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="stat-card expired">
          <div className="stat-icon-wrapper">
            <FiAlertCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.expired}</div>
            <h3 className="stat-label">Expired</h3>
          </div>
          <div className="stat-footer">
            <div className="stat-progress">
              <div 
                className="stat-progress-bar" 
                style={{ width: `${stats.total_assessments ? (stats.expired / stats.total_assessments) * 100 : 0}%` }}
              />
            </div>
            <span className="stat-percentage">
              {stats.total_assessments ? Math.round((stats.expired / stats.total_assessments) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="filters-section">
        <div className="search-box">
          <FiSearch size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by email or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            <FiFilter size={16} />
            <span>All</span>
          </button>
          <button
            className={`filter-btn ${filterStatus === "pending" ? "active" : ""}`}
            onClick={() => setFilterStatus("pending")}
          >
            <span>Draft</span>
          </button>
          <button
            className={`filter-btn ${filterStatus === "active" ? "active" : ""}`}
            onClick={() => setFilterStatus("active")}
          >
            <span>Active</span>
          </button>
          <button
            className={`filter-btn ${filterStatus === "in_progress" ? "active" : ""}`}
            onClick={() => setFilterStatus("in_progress")}
          >
            <span>In Progress</span>
          </button>
          <button
            className={`filter-btn ${filterStatus === "completed" ? "active" : ""}`}
            onClick={() => setFilterStatus("completed")}
          >
            <span>Completed</span>
          </button>
          <button
            className={`filter-btn ${filterStatus === "expired" ? "active" : ""}`}
            onClick={() => setFilterStatus("expired")}
          >
            <span>Expired</span>
          </button>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading assessments...</p>
        </div>
      )}

      {/* ASSESSMENTS TABLE */}
      {!loading && filteredAssessments.length > 0 && (
        <div className="assessments-section">
          <div className="assessments-table-wrapper">
            <table className="assessments-table">
              <thead>
                <tr>
                  <th className="col-candidate">Candidate</th>
                  <th className="col-role">Role</th>
                  <th className="col-skills">Top Skills</th>
                  <th className="col-config">Configuration</th>
                  <th className="col-status">Status</th>
                  <th className="col-dates">Dates</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((assessment) => {
                  const statusInfo = getStatusInfo(assessment.status);
                  return (
                    <tr key={assessment.id} className={`assessment-row status-${assessment.status}`}>
                      <td className="col-candidate">
                        <div className="candidate-cell">
                          <div className="candidate-avatar">
                            {assessment.candidate_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="candidate-name">{assessment.candidate_name}</span>
                        </div>
                      </td>
                      <td className="col-role">
                        <span className="role-badge">{assessment.role}</span>
                      </td>
                      <td className="col-skills">
                        <div className="skills-container">
                          {assessment.skills.length > 0 ? (
                            <>
                              {assessment.skills.slice(0, 3).map((skill, idx) => (
                                <span 
                                  key={idx} 
                                  className={`skill-tag ${skill.isCore ? 'core' : 'primary'}`} 
                                  title={`${skill.name} (${skill.level})${skill.isCore ? ' - Core Skill' : ''}`}
                                >
                                  {skill.name}
                                </span>
                              ))}
                              {assessment.skills.length > 3 && (
                                <span className="skill-more" title={assessment.skills.slice(3).map(s => s.name).join(", ")}>
                                  +{assessment.skills.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="no-skills">No skills defined</span>
                          )}
                        </div>
                      </td>
                      <td className="col-config">
                        <div className="config-cell">
                          <div className="config-item">
                            <span className="config-label">Questions:</span>
                            <span className="config-value">{assessment.total_questions || 'N/A'}</span>
                          </div>
                          <div className="config-item">
                            <span className="config-label">Auto-adjust:</span>
                            <span className="config-value">{assessment.auto_adjust_by_experience ? 'Yes' : 'No'}</span>
                          </div>
                          <div className="config-item">
                            <span className="config-label">Pass threshold:</span>
                            <span className="config-value">{assessment.passing_score_threshold ? `${assessment.passing_score_threshold}%` : 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="col-status">
                        <div className={`status-badge ${statusInfo.color}`}>
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </div>
                      </td>
                      <td className="col-dates">
                        <div className="dates-cell">
                          <div className="date-row">
                            <span className="date-label">Created:</span>
                            <span className="date-value">{formatDate(assessment.created_at)}</span>
                          </div>
                          <div className={`date-row expiry ${assessment.status === 'expired' ? 'expired' : assessment.expires_at ? 'has-expiry' : 'no-expiry'}`}>
                            <span className="date-label">Expires:</span>
                            <span className="date-value">
                              {assessment.expires_at ? formatDate(assessment.expires_at) : 'No expiry'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="col-actions">
                        <div className="action-buttons">
                          <button 
                            className="action-btn view" 
                            title="View assessment"
                            aria-label="View"
                            onClick={() => handleViewAssessment(assessment)}
                          >
                            <FiEye size={16} />
                          </button>
                          <button 
                            className="action-btn edit" 
                            title="Edit assessment"
                            aria-label="Edit"
                            onClick={() => handleEditAssessment(assessment)}
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button 
                            className={`action-btn delete ${deleteConfirm === assessment.id ? 'confirm' : ''}`}
                            title={deleteConfirm === assessment.id ? "Click again to confirm" : "Delete assessment"}
                            aria-label="Delete"
                            onClick={() => handleDeleteAssessment(assessment)}
                            disabled={actionLoading === assessment.id}
                          >
                            {actionLoading === assessment.id ? (
                              <FiRefreshCw size={16} className="spinning" />
                            ) : (
                              <FiTrash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Results Summary */}
          <div className="results-summary">
            Showing <strong>{filteredAssessments.length}</strong> of <strong>{assessments.length}</strong> assessments
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && assessments.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-illustration">
            <svg viewBox="0 0 100 100" width="80" height="80">
              <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="2" rx="4"/>
              <line x1="20" y1="35" x2="80" y2="35" stroke="currentColor" strokeWidth="2"/>
              <line x1="25" y1="45" x2="35" y2="45" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="25" y1="55" x2="75" y2="55" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="25" y1="65" x2="75" y2="65" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
          <h3 className="empty-title">No Assessments Yet</h3>
          <p className="empty-description">Start creating assessments to manage candidates</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate("/admin/assessment")}
          >
            <FiPlus size={18} />
            <span>Create First Assessment</span>
          </button>
        </div>
      )}

      {/* NO RESULTS STATE */}
      {!loading && assessments.length > 0 && filteredAssessments.length === 0 && (
        <div className="empty-state">
          <div className="empty-illustration">
            <FiSearch size={60} />
          </div>
          <h3 className="empty-title">No Matching Assessments</h3>
          <p className="empty-description">Try adjusting your search or filter criteria</p>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm("");
              setFilterStatus("all");
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
