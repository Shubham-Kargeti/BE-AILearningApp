import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiExternalLink, FiBookOpen, FiTarget, FiTrendingUp } from "react-icons/fi";
import { coursesService } from "../../API/services";
import type { AssignedLearningPath, LearningPathEmployeeSummary, RecommendedCourse } from "../../API/services";
import Toast from "../../components/Toast/Toast";
import Loader from "../../components/Loader/Loader";
import "./LearningPathContainer.scss";

interface ToastMessage {
  type: "success" | "error" | "info";
  message: string;
}

const LearningPathContainer: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<string>("");
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<LearningPathEmployeeSummary[]>([]);
  const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState("");
  const [selectedEmployeePaths, setSelectedEmployeePaths] = useState<AssignedLearningPath[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const loadAdminLearningPathSummary = async (preferredEmail?: string) => {
    try {
      setLoadingAssignments(true);
      const summary = await coursesService.listLearningPathEmployees();
      const employees = summary.employees || [];
      setEmployeeSummaries(employees);

      const nextEmail = preferredEmail || selectedEmployeeEmail || employees[0]?.employee_email || "";
      setSelectedEmployeeEmail(nextEmail);

      if (nextEmail) {
        const detail = await coursesService.listEmployeeLearningPathsForAdmin(nextEmail);
        setSelectedEmployeePaths(detail.learning_paths || []);
      } else {
        setSelectedEmployeePaths([]);
      }
    } catch (err) {
      console.error("Error loading assigned learning paths:", err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    const fetchLearningPath = async () => {
      if (!sessionId) {
        setToast({ type: "error", message: "Session ID not provided" });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await coursesService.getLearningPath(sessionId);
        setTopic(data.topic);
        setCourses(data.recommended_courses || []);
      } catch (err: any) {
        console.error("Error fetching learning path:", err);
        setToast({
          type: "error",
          message: err.response?.data?.detail || "Failed to generate learning path",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLearningPath();
    loadAdminLearningPathSummary();
  }, [sessionId]);

  const handleSelectEmployee = async (employeeEmail: string) => {
    setSelectedEmployeeEmail(employeeEmail);
    try {
      setLoadingAssignments(true);
      const detail = await coursesService.listEmployeeLearningPathsForAdmin(employeeEmail);
      setSelectedEmployeePaths(detail.learning_paths || []);
    } catch (err: any) {
      console.error("Error loading employee learning paths:", err);
      setToast({
        type: "error",
        message: err.response?.data?.detail || "Failed to load assigned learning paths",
      });
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handlePushToEmployee = async () => {
    if (!sessionId) {
      setToast({ type: "error", message: "Session ID missing" });
      return;
    }

    try {
      const response = await coursesService.pushLearningPath({
        session_id: sessionId,
        topic,
        recommended_courses: courses
      });
      await loadAdminLearningPathSummary(response.email);

      setToast({
        type: "success",
        message: `Learning path pushed. ${response.email} now has ${response.assigned_count} assigned path${response.assigned_count === 1 ? "" : "s"}.`
      });
    } catch (err: any) {
      console.error(err);
      setToast({
        type: "error",
        message: err.response?.data?.detail || "Failed to push learning path",
      });
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="learning-path-container">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <div className="learning-path-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <FiArrowLeft size={20} />
          Back
        </button>
        <div className="header-content">
          <FiBookOpen size={32} className="header-icon" />
          <h1>Your Personalized Learning Path</h1>
          <p className="header-subtitle">
            Based on your performance in: <strong>{topic}</strong>
          </p>
        </div>
      </div>

      <div className="learning-path-body">
        {courses.length === 0 ? (
          <div className="no-courses">
            <FiTarget size={48} />
            <h2>No Courses Found</h2>
            <p>We couldn't find specific courses for this topic. Try checking back later!</p>
          </div>
        ) : (
          <>
            <div className="courses-intro">
              <FiTrendingUp size={24} />
              <h2>Recommended Courses ({courses.length})</h2>
              <p>These courses are tailored to help you improve in areas where you need the most support.</p>
            </div>

            <div className="courses-grid">
              {courses.map((course, index) => (
                <div key={index} className="course-card">
                  <div className="course-header">
                    <div className="course-level-badge" data-level={course.course_level?.toLowerCase()}>
                      {course.course_level || "General"}
                    </div>
                    {course.score !== null && course.score !== undefined && (
                      <div className="course-score">
                        Match: {(100 - course.score * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <h3 className="course-name">{course.name}</h3>

                  {course.description && (
                    <p className="course-description">{course.description}</p>
                  )}

                  <div className="course-meta">
                    {course.topic && (
                      <div className="meta-item">
                        <strong>Topic:</strong> {course.topic}
                      </div>
                    )}
                    {course.collection && (
                      <div className="meta-item">
                        <strong>Collection:</strong> {course.collection}
                      </div>
                    )}
                    {course.category && (
                      <div className="meta-item">
                        <strong>Category:</strong> {course.category}
                      </div>
                    )}
                  </div>

                  {course.url && (
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="course-link"
                    >
                      View Course <FiExternalLink size={16} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 🔽 PUSH BUTTON ADDED HERE */}
        <div className="admin-assignments-panel">
          <div className="assignments-header">
            <div>
              <h2>Assigned Learning Paths</h2>
              <p>Review employees with pushed learning paths and inspect every assessment-specific path.</p>
            </div>
            <button className="refresh-assignments-button" onClick={() => loadAdminLearningPathSummary()}>
              Refresh
            </button>
          </div>

          {loadingAssignments ? (
            <div className="assignments-empty">Loading assignments...</div>
          ) : employeeSummaries.length === 0 ? (
            <div className="assignments-empty">No learning paths have been assigned yet.</div>
          ) : (
            <div className="assignments-layout">
              <div className="employee-assignment-list">
                {employeeSummaries.map((employee) => (
                  <button
                    key={employee.employee_email}
                    className={`employee-assignment-item ${
                      employee.employee_email === selectedEmployeeEmail ? "active" : ""
                    }`}
                    onClick={() => handleSelectEmployee(employee.employee_email)}
                  >
                    <span className="employee-name">
                      {employee.employee_name || employee.employee_email}
                    </span>
                    <span className="employee-email">{employee.employee_email}</span>
                    <span className="employee-count">
                      {employee.learning_path_count} path{employee.learning_path_count === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="employee-path-detail">
                <h3>{selectedEmployeeEmail || "Select an employee"}</h3>
                {selectedEmployeePaths.length === 0 ? (
                  <p className="assignments-empty">No paths found for this employee.</p>
                ) : (
                  <div className="employee-path-list">
                    {selectedEmployeePaths.map((path) => (
                      <div className="employee-path-card" key={path.learning_path_id}>
                        <div>
                          <h4>{path.assessment_title || "Assessment"}</h4>
                          <p>{path.topic}</p>
                        </div>
                        <div className="path-card-meta">
                          <span>{path.course_count} courses</span>
                          <span>{formatDate(path.updated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="push-button-container">
          <button
            className="push-button"
            onClick={handlePushToEmployee}
            disabled={courses.length === 0}
          >
            Push Learning Path to Employee
          </button>
        </div>

      </div>
    </div>
  );
};

export default LearningPathContainer;
