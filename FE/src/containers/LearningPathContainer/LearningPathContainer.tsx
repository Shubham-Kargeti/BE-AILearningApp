import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiExternalLink, FiBookOpen, FiTarget, FiTrendingUp } from "react-icons/fi";
import { coursesService } from "../../API/services";
import type { RecommendedCourse } from "../../API/services";
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
  const [toast, setToast] = useState<ToastMessage | null>(null);

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
  }, [sessionId]);

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
      </div>
    </div>
  );
};

export default LearningPathContainer;
