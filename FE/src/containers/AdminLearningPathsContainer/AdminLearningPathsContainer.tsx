import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiChevronRight,
  FiExternalLink,
  FiSearch,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { coursesService } from "../../API/services";
import type {
  AssignedLearningPath,
  LearningPathEmployeeSummary,
} from "../../API/services";
import Loader from "../../components/Loader/Loader";
import "./AdminLearningPathsContainer.scss";

type ViewMode = "employees" | "employeePaths" | "pathDetail";

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

const getPathTitle = (path: AssignedLearningPath) =>
  path.assessment_title || "Assessment Learning Path";

const getPathTags = (path: AssignedLearningPath) =>
  (path.topic || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);

const useDebouncedValue = (value: string, delay = 250) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

const AdminLearningPathsContainer: React.FC = () => {
  const { employeeEmail, learningPathId } = useParams<{
    employeeEmail?: string;
    learningPathId?: string;
  }>();
  const navigate = useNavigate();

  const mode: ViewMode = learningPathId
    ? "pathDetail"
    : employeeEmail
      ? "employeePaths"
      : "employees";

  const decodedEmployeeEmail = employeeEmail ? decodeURIComponent(employeeEmail) : "";

  const [employees, setEmployees] = useState<LearningPathEmployeeSummary[]>([]);
  const [paths, setPaths] = useState<AssignedLearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm);

  const selectedPath = useMemo(
    () => paths.find((path) => path.learning_path_id === learningPathId) || null,
    [paths, learningPathId]
  );

  const filteredEmployees = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter((employee) => {
      const name = employee.employee_name || "";
      return (
        name.toLowerCase().includes(query) ||
        employee.employee_email.toLowerCase().includes(query)
      );
    });
  }, [debouncedSearch, employees]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (mode === "employees") {
          const response = await coursesService.listLearningPathEmployees();
          setEmployees(response.employees || []);
          setPaths([]);
          return;
        }

        const response = await coursesService.listEmployeeLearningPathsForAdmin(decodedEmployeeEmail);
        setPaths(response.learning_paths || []);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Unable to load assigned learning paths.");
        setEmployees([]);
        setPaths([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [decodedEmployeeEmail, mode]);

  const navigateToEmployee = (email: string) => {
    navigate(`/admin/learning-paths/assigned/${encodeURIComponent(email)}`);
  };

  const navigateToPath = (pathId: string) => {
    navigate(
      `/admin/learning-paths/assigned/${encodeURIComponent(decodedEmployeeEmail)}/${pathId}`
    );
  };

  const renderBreadcrumb = () => (
    <div className="admin-lp-breadcrumb">
      <button onClick={() => navigate("/admin/dashboard")}>Dashboard</button>
      <FiChevronRight />
      <button onClick={() => navigate("/admin/learning-paths/assigned")}>
        Employee List
      </button>
      {decodedEmployeeEmail && (
        <>
          <FiChevronRight />
          <button onClick={() => navigateToEmployee(decodedEmployeeEmail)}>
            {decodedEmployeeEmail}
          </button>
        </>
      )}
      {learningPathId && selectedPath && (
        <>
          <FiChevronRight />
          <span>{getPathTitle(selectedPath)}</span>
        </>
      )}
    </div>
  );

  const renderEmployees = () => (
    <section className="admin-lp-panel">
      <div className="admin-lp-panel-header">
        <div>
          <h2>Employees With Learning Paths</h2>
          <p>Review employees who have at least one assigned learning path.</p>
        </div>
        <span className="admin-lp-count">{filteredEmployees.length}</span>
      </div>

      <div className="admin-lp-search">
        <FiSearch />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or email"
        />
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="admin-lp-empty">No employees found.</div>
      ) : (
        <div className="admin-lp-employee-list">
          {filteredEmployees.map((employee) => (
            <button
              key={employee.employee_email}
              className="admin-lp-employee-row"
              onClick={() => navigateToEmployee(employee.employee_email)}
            >
              <div className="admin-lp-avatar">
                {(employee.employee_name || employee.employee_email).charAt(0).toUpperCase()}
              </div>
              <div className="admin-lp-employee-main">
                <strong>{employee.employee_name || "Unnamed employee"}</strong>
                <span>{employee.employee_email}</span>
              </div>
              <div className="admin-lp-row-meta">
                <span>{employee.learning_path_count} path{employee.learning_path_count === 1 ? "" : "s"}</span>
                <FiChevronRight />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const renderEmployeePaths = () => (
    <section className="admin-lp-panel">
      <div className="admin-lp-panel-header">
        <div>
          <h2>{decodedEmployeeEmail}</h2>
          <p>All learning paths assigned to this employee.</p>
        </div>
        <span className="admin-lp-count">{paths.length}</span>
      </div>

      {paths.length === 0 ? (
        <div className="admin-lp-empty">No learning paths assigned.</div>
      ) : (
        <div className="admin-lp-path-list">
          {paths.map((path) => {
            const tags = getPathTags(path);

            return (
              <button
                key={path.learning_path_id}
                className="admin-lp-path-row"
                onClick={() => navigateToPath(path.learning_path_id)}
              >
                <div className="admin-lp-path-main">
                  <strong>{getPathTitle(path)}</strong>
                  <span className="admin-lp-topic">{path.topic}</span>
                  {tags.length > 0 && (
                    <div className="admin-lp-tags">
                      {tags.map((tag) => (
                        <span key={`${path.learning_path_id}-${tag}`}>
                          <FiTag />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="admin-lp-row-meta">
                  <span>
                    <FiCalendar />
                    {formatDate(path.updated_at)}
                  </span>
                  <span>{path.course_count} courses</span>
                  <FiChevronRight />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderPathDetail = () => {
    if (!selectedPath) {
      return <div className="admin-lp-empty">Learning path not found.</div>;
    }

    return (
      <section className="admin-lp-panel">
        <div className="admin-lp-detail-header">
          <div>
            <h2>{getPathTitle(selectedPath)}</h2>
            <p>{selectedPath.employee_name || decodedEmployeeEmail}</p>
          </div>
          <div className="admin-lp-detail-meta">
            <span>{formatDate(selectedPath.updated_at)}</span>
            <span>{selectedPath.course_count} courses</span>
          </div>
        </div>

        <div className="admin-lp-tags detail-tags">
          {getPathTags(selectedPath).map((tag) => (
            <span key={tag}>
              <FiTag />
              {tag}
            </span>
          ))}
        </div>

        <div className="admin-lp-course-grid">
          {selectedPath.recommended_courses.map((course, index) => (
            <div className="admin-lp-course" key={`${selectedPath.learning_path_id}-${index}`}>
              <div className="admin-lp-course-head">
                <span>{course.course_level || "General"}</span>
                {course.score !== null && course.score !== undefined && (
                  <span>Score {course.score.toFixed(2)}</span>
                )}
              </div>
              <h3>{course.name}</h3>
              {course.description && <p>{course.description}</p>}
              <div className="admin-lp-course-meta">
                {course.topic && <span>{course.topic}</span>}
                {course.category && <span>{course.category}</span>}
                {course.collection && <span>{course.collection}</span>}
              </div>
              {course.url && (
                <a href={course.url} target="_blank" rel="noopener noreferrer">
                  View Course <FiExternalLink />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="admin-learning-paths-page">
      <div className="admin-lp-shell">
        <button className="admin-lp-back" onClick={() => navigate(-1)}>
          <FiArrowLeft />
          Back
        </button>

        {renderBreadcrumb()}

        <header className="admin-lp-header">
          <div className="admin-lp-icon">
            {mode === "employees" ? <FiUsers /> : <FiBookOpen />}
          </div>
          <div>
            <h1>Assigned Learning Paths</h1>
            <p>Browse employee assignments from dashboard to path details.</p>
          </div>
        </header>

        {loading ? (
          <div className="admin-lp-loading">
            <Loader fullscreen={false} />
          </div>
        ) : error ? (
          <div className="admin-lp-empty">{error}</div>
        ) : mode === "employees" ? (
          renderEmployees()
        ) : mode === "employeePaths" ? (
          renderEmployeePaths()
        ) : (
          renderPathDetail()
        )}
      </div>
    </div>
  );
};

export default AdminLearningPathsContainer;
