import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { candidateService } from "../../API/services";
import type { AssignedLearningPath } from "../../API/services";
import "./EmployeeLearningPath.scss";

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

const EmployeeLearningPath = () => {
  const { learningPathId } = useParams<{ learningPathId: string }>();
  const navigate = useNavigate();
  const [learningPaths, setLearningPaths] = useState<AssignedLearningPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<AssignedLearningPath | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearningPathData = async () => {
      try {
        setLoading(true);

        if (learningPathId) {
          const path = await candidateService.getEmployeeLearningPathDetail(learningPathId);
          setSelectedPath(path);
          setLearningPaths([]);
          return;
        }

        const data = await candidateService.getEmployeeLearningPath();
        setLearningPaths(data.learning_paths || []);
        setSelectedPath(null);
      } catch (error) {
        console.error("Learning path data not found", error);
        setLearningPaths([]);
        setSelectedPath(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningPathData();
  }, [learningPathId]);

  const renderEmptyState = () => (
    <div className="no-courses">
      <h2>No Learning Paths Found</h2>
      <p>Please contact your admin or complete an assessment.</p>
    </div>
  );

  const renderCourseGrid = (path: AssignedLearningPath) => (
    <>
      <div className="courses-intro">
        <div>
          <h2>{path.assessment_title || "Assessment Learning Path"}</h2>
          <p>
            Topic: <strong>{path.topic}</strong>
          </p>
        </div>
        <span className="path-date">Assigned {formatDate(path.updated_at)}</span>
      </div>

      <div className="courses-grid">
        {path.recommended_courses.map((course, index) => (
          <div className="course-card" key={`${path.learning_path_id}-${index}`}>
            <div className="course-header">
              <span
                className="course-level-badge"
                data-level={(course.course_level || "general").toLowerCase()}
              >
                {course.course_level || "General"}
              </span>

              {course.score !== null && course.score !== undefined && (
                <span className="course-score">Score: {course.score.toFixed(2)}</span>
              )}
            </div>

            <div className="course-name">{course.name}</div>

            {course.description && (
              <div className="course-description">{course.description}</div>
            )}

            <div className="course-meta">
              {course.topic && (
                <div className="meta-item">
                  <strong>Topic:</strong> {course.topic}
                </div>
              )}
              {course.category && (
                <div className="meta-item">
                  <strong>Category:</strong> {course.category}
                </div>
              )}
              {course.collection && (
                <div className="meta-item">
                  <strong>Collection:</strong> {course.collection}
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
                View Course
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="employee-learning-path-container">
      <div className="learning-path-header">
        {learningPathId && (
          <button className="back-button" onClick={() => navigate("/app/learning-paths")}>
            Back to Learning Paths
          </button>
        )}
        <div className="header-content">
          <h1>{learningPathId ? "Learning Path Details" : "My Learning Paths"}</h1>
          <p className="header-subtitle">
            Personalized courses assigned from your assessment attempts
          </p>
        </div>
      </div>

      <div className="learning-path-body">
        {loading && (
          <div className="no-courses">
            <CircularProgress />
          </div>
        )}

        {!loading && !learningPathId && learningPaths.length === 0 && renderEmptyState()}

        {!loading && !learningPathId && learningPaths.length > 0 && (
          <div className="learning-path-list-screen">
            <div className="list-heading">
              <div>
                <h2>Assigned Learning Paths</h2>
                <p>Select a learning path to open its course content.</p>
              </div>
              <span>{learningPaths.length}</span>
            </div>

            <div className="learning-path-card-list">
              {learningPaths.map((path) => (
                <button
                  key={path.learning_path_id}
                  className="learning-path-summary-card"
                  onClick={() => navigate(`/app/learning-paths/${path.learning_path_id}`)}
                >
                  <div>
                    <strong>{path.assessment_title || "Assessment"}</strong>
                    <p>{path.topic}</p>
                  </div>
                  <div className="summary-meta">
                    <span>{path.course_count} courses</span>
                    <span>{formatDate(path.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && learningPathId && !selectedPath && renderEmptyState()}

        {!loading && learningPathId && selectedPath && (
          <section className="learning-path-detail-screen">
            {renderCourseGrid(selectedPath)}
          </section>
        )}
      </div>
    </div>
  );
};

export default EmployeeLearningPath;
