import { useNavigate } from "react-router-dom";
import "./AdminAssessmentLandingContainer.scss";

const AdminAssessmentLandingContainer = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-assessment-home">
      <div className="content-wrapper">

        <h1 className="headline">Assessment Setup</h1>

        <p className="tagline">
          Choose how you want to create and manage assessments.
        </p>

        <div className="features-wrapper">
          {/* Card 1 */}
          <div className="feature-box">
            <h2 className="box-title">Candidate-Specific Assessment</h2>
            <p className="box-desc">
              Create AI-powered assessments tailored to an individual candidate by analyzing their CV and the job description.
            </p>
            <button
              className="action-btn"
              onClick={() => navigate("/admin/assessment/setup")}
            >
              Generate Assessment
            </button>
          </div>

          {/* Card 2 */}
          <div className="feature-box">
            <h2 className="box-title">Role-Based Assessment</h2>
            <p className="box-desc">
              Generate assessments based on job roles by defining requirements and providing a job description.
            </p>
            <button
              className="action-btn"
              onClick={() => navigate("/admin/requirement")}
            >
              Generate Assessment
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminAssessmentLandingContainer;