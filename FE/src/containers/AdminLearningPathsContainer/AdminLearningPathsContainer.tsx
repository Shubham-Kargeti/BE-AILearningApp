import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiExternalLink,
  FiFilter,
  FiSearch,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { coursesService } from "../../API/services";
import type {
  AdminLearningPathAssignment,
  AssignedLearningPath,
} from "../../API/services";
import Loader from "../../components/Loader/Loader";
import "./AdminLearningPathsContainer.scss";

type ViewMode = "assignments" | "employeePaths" | "pathDetail";
type CompletionStatus = "all" | "not_started" | "in_progress" | "completed";

const pageSize = 8;

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
  path.assessment_title || "Assigned Learning Path";

const getPathTags = (path: AssignedLearningPath) =>
  (path.topic || "")
    .split(/[,/|]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);

const getCompletionStatus = (path: Partial<AdminLearningPathAssignment>) => {
  if (path.completion_status) return path.completion_status;
  if ((path.progress_percent || 0) >= 100) return "completed";
  if ((path.progress_percent || 0) > 0) return "in_progress";
  return "not_started";
};

const statusLabel = (status: CompletionStatus) => {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In Progress";
  if (status === "not_started") return "Not Started";
  return "All Statuses";
};

const useDebouncedValue = (value: string, delay = 250) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

const AdminLearningPathsContainer = () => {
  const { employeeEmail, learningPathId } = useParams<{
    employeeEmail?: string;
    learningPathId?: string;
  }>();
  const navigate = useNavigate();

  const mode: ViewMode = learningPathId
    ? "pathDetail"
    : employeeEmail
      ? "employeePaths"
      : "assignments";

  const decodedEmployeeEmail = employeeEmail ? decodeURIComponent(employeeEmail) : "";
  const [assignments, setAssignments] = useState<AdminLearningPathAssignment[]>([]);
  const [paths, setPaths] = useState<AssignedLearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<CompletionStatus>("all");
  const [pathFilter, setPathFilter] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(searchTerm);

  const selectedPath = useMemo(
    () => paths.find((path) => path.learning_path_id === learningPathId) || null,
    [paths, learningPathId]
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        if (mode === "assignments") {
          const response = await coursesService.listAdminLearningPathAssignments();
          setAssignments(response.assignments || []);
          setPaths([]);
          return;
        }

        const response = await coursesService.listEmployeeLearningPathsForAdmin(decodedEmployeeEmail);
        setPaths(response.learning_paths || []);
      } catch (err: unknown) {
        const requestError = err as { response?: { data?: { detail?: string } } };
        setError(requestError.response?.data?.detail || "Unable to load assigned learning paths.");
        setAssignments([]);
        setPaths([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [decodedEmployeeEmail, mode]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pathFilter, statusFilter]);

  const pathOptions = useMemo(
    () =>
      Array.from(
        new Set(
          assignments
            .map((assignment) => getPathTitle(assignment))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [assignments]
  );

  const filteredAssignments = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesEmail = !query || assignment.employee_email.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || getCompletionStatus(assignment) === statusFilter;
      const matchesPath =
        pathFilter === "all" || getPathTitle(assignment) === pathFilter;
      return matchesEmail && matchesStatus && matchesPath;
    });
  }, [assignments, debouncedSearch, pathFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / pageSize));
  const pagedAssignments = filteredAssignments.slice((page - 1) * pageSize, page * pageSize);
  const assignmentStats = useMemo(() => {
    const statuses = assignments.map((assignment) => getCompletionStatus(assignment));
    return {
      total: assignments.length,
      employees: new Set(assignments.map((assignment) => assignment.employee_email)).size,
      inProgress: statuses.filter((status) => status === "in_progress").length,
      completed: statuses.filter((status) => status === "completed").length,
    };
  }, [assignments]);

  const navigateToEmployee = (email: string) => {
    navigate(`/admin/learning-paths/assigned/${encodeURIComponent(email)}`);
  };

  const navigateToPath = (email: string, pathId: string) => {
    navigate(`/admin/learning-paths/assigned/${encodeURIComponent(email)}/${pathId}`);
  };

  const renderBreadcrumb = () => (
    <div className="admin-lp-breadcrumb">
      <button onClick={() => navigate("/admin/dashboard")}>Dashboard</button>
      <FiChevronRight />
      <button onClick={() => navigate("/admin/learning-paths/assigned")}>
        Assigned Learning Paths
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

  const renderProgress = (assignment: AdminLearningPathAssignment) => {
    const progress = Math.max(0, Math.min(100, assignment.progress_percent || 0));
    return (
      <div className="admin-lp-progress">
        <div>
          <span style={{ width: `${progress}%` }} />
        </div>
        <strong>{progress}%</strong>
      </div>
    );
  };

  const renderStatus = (assignment: AdminLearningPathAssignment) => {
    const status = getCompletionStatus(assignment);
    return <span className={`admin-lp-status ${status}`}>{statusLabel(status)}</span>;
  };

  const renderAssignmentList = () => (
    <>
      <div className="admin-lp-stat-grid">
        <div className="admin-lp-stat">
          <span>Assignments</span>
          <strong>{assignmentStats.total}</strong>
        </div>
        <div className="admin-lp-stat">
          <span>Employees</span>
          <strong>{assignmentStats.employees}</strong>
        </div>
        <div className="admin-lp-stat">
          <span>In Progress</span>
          <strong>{assignmentStats.inProgress}</strong>
        </div>
        <div className="admin-lp-stat">
          <span>Completed</span>
          <strong>{assignmentStats.completed}</strong>
        </div>
      </div>

      <section className="admin-lp-panel assignment-panel">
        <div className="admin-lp-panel-header">
          <div>
            <h2>Assignments</h2>
            <p>Monitor learning paths assigned by employee email.</p>
          </div>
          <span className="admin-lp-count">{filteredAssignments.length}</span>
        </div>

        <div className="admin-lp-filters">
          <label className="admin-lp-search">
            <FiSearch />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employee email"
            />
          </label>
          <label>
            <FiFilter />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CompletionStatus)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            <FiBookOpen />
            <select
              value={pathFilter}
              onChange={(event) => setPathFilter(event.target.value)}
              aria-label="Filter by learning path"
            >
              <option value="all">All learning paths</option>
              {pathOptions.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="admin-lp-empty">
            <h3>No assignments found</h3>
            <p>Adjust the filters or assign a learning path from Set Learning Path.</p>
          </div>
        ) : (
          <>
            <div className="admin-lp-table-wrap">
              <table className="admin-lp-table">
                <thead>
                  <tr>
                    <th>Employee Email</th>
                    <th>Learning Path</th>
                    <th>Assigned</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Courses Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAssignments.map((assignment) => (
                    <tr
                      key={assignment.learning_path_id}
                      onClick={() => navigateToPath(assignment.employee_email, assignment.learning_path_id)}
                    >
                      <td>{assignment.employee_email}</td>
                      <td>
                        <strong>{getPathTitle(assignment)}</strong>
                        <span>{assignment.topic}</span>
                      </td>
                      <td>{formatDate(assignment.updated_at)}</td>
                      <td>{renderProgress(assignment)}</td>
                      <td>{renderStatus(assignment)}</td>
                      <td>
                        {assignment.courses_completed || 0}/{assignment.course_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-lp-mobile-cards">
              {pagedAssignments.map((assignment) => (
                <button
                  key={`mobile-${assignment.learning_path_id}`}
                  onClick={() => navigateToPath(assignment.employee_email, assignment.learning_path_id)}
                >
                  <div>
                    <strong>{getPathTitle(assignment)}</strong>
                    <span>{assignment.employee_email}</span>
                  </div>
                  <div className="mobile-assignment-meta">
                    {renderStatus(assignment)}
                    <span>{formatDate(assignment.updated_at)}</span>
                  </div>
                  {renderProgress(assignment)}
                  <small>
                    {assignment.courses_completed || 0}/{assignment.course_count} courses completed
                  </small>
                </button>
              ))}
            </div>

            <div className="admin-lp-pagination">
              <span>
                Page {page} of {totalPages}
              </span>
              <div>
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <FiChevronLeft />
                </button>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  aria-label="Next page"
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
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
                onClick={() => navigateToPath(decodedEmployeeEmail, path.learning_path_id)}
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
        {mode !== "assignments" && (
          <button className="admin-lp-back" onClick={() => navigate(-1)}>
            <FiArrowLeft />
            Back
          </button>
        )}

        {renderBreadcrumb()}

        <header className="admin-lp-header">
          <div className="admin-lp-icon">
            {mode === "assignments" ? <FiUsers /> : <FiBookOpen />}
          </div>
          <div>
            <h1>Assigned Learning Paths</h1>
            <p>Track employee assignments, progress, and completion state.</p>
          </div>
          {mode === "assignments" && (
            <div className="admin-lp-header-state">
              <FiCheckCircle />
              {assignmentStats.total} active
            </div>
          )}
        </header>

        {loading ? (
          <div className="admin-lp-loading">
            <Loader fullscreen={false} />
          </div>
        ) : error ? (
          <div className="admin-lp-empty">{error}</div>
        ) : mode === "assignments" ? (
          renderAssignmentList()
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
