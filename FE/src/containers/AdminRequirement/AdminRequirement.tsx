import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assessmentService } from "../../API/services";
import "./AdminRequirement.scss";

const AdminRequirement = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    skills: "",
    level: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const skillsArray = formData.skills.split(",").map(s => s.trim()).filter(s => s);
      const requiredSkills: Record<string, string> = {};
      skillsArray.forEach(skill => {
        requiredSkills[skill] = formData.level || "intermediate";
      });
      
      // Create as an assessment/requirement
      await assessmentService.createAssessment({
        title: formData.title,
        description: formData.description,
        job_title: formData.title,
        required_skills: requiredSkills,
        duration_minutes: 30,
      });
      
      setSuccess(true);
      setFormData({ title: "", description: "", skills: "", level: "" });
      
      // Redirect to assessment list after 2 seconds
      setTimeout(() => {
        navigate("/admin/assessment");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to create requirement:", err);
      setError(err?.response?.data?.detail || "Failed to create requirement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-requirement">
      <div className="requirement-container">
        <h1>Requirement Creation</h1>
        <p className="subtitle">Create a new job requirement</p>

        <form onSubmit={handleSubmit} className="requirement-form">
          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Senior Developer"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Job Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the job role and responsibilities..."
              rows={5}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="skills">Required Skills (comma separated) *</label>
            <textarea
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="JavaScript, React, TypeScript, Node.js"
              rows={3}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="level">Experience Level *</label>
            <select
              id="level"
              name="level"
              value={formData.level}
              onChange={handleChange}
              required
            >
              <option value="">Select experience level</option>
              <option value="junior">Junior (0-2 years)</option>
              <option value="mid">Mid-level (2-5 years)</option>
              <option value="senior">Senior (5+ years)</option>
              <option value="lead">Lead (8+ years)</option>
            </select>
          </div>

          {error && (
            <div className="error-message" style={{ color: '#d32f2f', marginBottom: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="success-message" style={{ color: '#2e7d32', marginBottom: '16px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
              Requirement created successfully! Redirecting to assessments...
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Requirement"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminRequirement;
