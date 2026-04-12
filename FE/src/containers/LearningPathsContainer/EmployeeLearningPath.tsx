import { useEffect, useState } from "react";
import { CircularProgress } from "@mui/material";
import { candidateService } from "../../API/services";
import "./EmployeeLearningPath.scss";

const EmployeeLearningPath = () => {
    const [learningPath, setLearningPath] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLearningPath = async () => {
            try {
                const data = await candidateService.getEmployeeLearningPath();
                setLearningPath(data);
            } catch (error) {
                console.error("No learning path found");
                setLearningPath(null);
            } finally {
                setLoading(false);
            }
        };

        fetchLearningPath();
    }, []);

    return (
        <div className="employee-learning-path-container">

            {/* HEADER */}
            <div className="learning-path-header">
                <div className="header-content">
                    <h1>My Learning Path</h1>
                    <p className="header-subtitle">
                        Personalized courses recommended for you
                    </p>
                </div>
            </div>

            {/* BODY */}
            <div className="learning-path-body">

                {/* LOADING */}
                {loading && (
                    <div className="no-courses">
                        <CircularProgress />
                    </div>
                )}

                {/* NO DATA */}
                {!loading && !learningPath && (
                    <div className="no-courses">
                        <h2>No Learning Path Found</h2>
                        <p>Please contact your admin or complete an assessment.</p>
                    </div>
                )}

                {/* COURSES */}
                {!loading && learningPath && (
                    <>
                        <div className="courses-intro">
                            <h2>
                                Recommended Courses ({learningPath.recommended_courses.length})
                            </h2>
                            <p>
                                These courses are tailored to help you improve your skills
                            </p>
                        </div>

                        <div className="courses-grid">
                            {learningPath.recommended_courses.map(
                                (course: any, index: number) => (
                                    <div className="course-card" key={index}>

                                        <div className="course-header">
                                            <span
                                                className="course-level-badge"
                                                data-level={course.course_level.toLowerCase()}
                                            >
                                                {course.course_level}
                                            </span>

                                            <span className="course-score">
                                                Score: {course.score?.toFixed(2)}
                                            </span>
                                        </div>

                                        <div className="course-name">{course.name}</div>

                                        <div className="course-description">
                                            {course.description}
                                        </div>

                                        <div className="course-meta">
                                            <div className="meta-item">
                                                <strong>Topic:</strong> {course.topic}
                                            </div>
                                            <div className="meta-item">
                                                <strong>Category:</strong> {course.category}
                                            </div>
                                            <div className="meta-item">
                                                <strong>Collection:</strong> {course.collection}
                                            </div>
                                        </div>

                                        <a
                                            href={course.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="course-link"
                                        >
                                            View Course
                                        </a>
                                    </div>
                                )
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default EmployeeLearningPath;