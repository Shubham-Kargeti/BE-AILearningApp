import React, { useState } from "react";
import { candidateService } from "../../API/services";
import "./AdminAddCandidate.scss";

const AdminAddCandidate = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    experience: "",
    skills: "",
    team: "", 
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
      // Convert skills string to Record<string, string>
      const skillsArray = formData.skills.split(",").map(s => s.trim()).filter(s => s);
      const skillsRecord: Record<string, string> = {};
      skillsArray.forEach(skill => {
        skillsRecord[skill] = "intermediate";
      });
      
      // include team in payload. cast to any to avoid strict TS typing issues if your types don't include `team` yet
      await candidateService.createCandidate({
        full_name: formData.name,
        email: formData.email,
        phone: "",
        experience_level: formData.experience || "junior",
        skills: skillsRecord,
        team: formData.team || undefined,
      } as any);
      
      setSuccess(true);
      setFormData({ name: "", email: "", role: "", experience: "", skills: "", team: "" });
    } catch (err: any) {
      console.error("Failed to add candidate:", err);
      setError(err?.response?.data?.detail || "Failed to add candidate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-add-candidate">
      <div className="candidate-container">
        <h1>Add Candidate</h1>
        <p className="subtitle">Add a new candidate to the system</p>

        <form onSubmit={handleSubmit} className="candidate-form">
          <div className="form-group">
            <label htmlFor="name">Candidate Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Current Role *</label>
            <input
              type="text"
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              placeholder="e.g., Software Engineer, Data Analyst"
              required
            />
          </div>

          {/* NEW: Candidate Team Name */}
          <div className="form-group">
            <label htmlFor="team">Candidate Team Name</label>
            <input
              type="text"
              id="team"
              name="team"
              value={formData.team}
              onChange={handleChange}
              placeholder="e.g., Platform Team, Data Science"
            />
          </div>

          <div className="form-group">
            <label htmlFor="experience">Experience Level *</label>
            <select
              id="experience"
              name="experience"
              value={formData.experience}
              onChange={handleChange}
              required
            >
              <option value="">Select experience level</option>
              <option value="junior">Junior (0-2 years)</option>
              <option value="mid">Mid-Level (2-5 years)</option>
              <option value="senior">Senior (5-8 years)</option>
              <option value="lead">Lead/Principal (8+ years)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="skills">Skills (comma separated) *</label>
            <textarea
              id="skills"
              name="skills"
              value={formData.skills}
              onChange={handleChange}
              placeholder="JavaScript, React, Python, SQL"
              rows={3}
              required
            ></textarea>
          </div>

          {error && (
            <div className="error-message" style={{ color: '#d32f2f', marginBottom: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="success-message" style={{ color: '#2e7d32', marginBottom: '16px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
              Candidate added successfully!
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Candidate"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAddCandidate;
