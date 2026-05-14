import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiCode,
  FiKey,
  FiMail,
  FiRefreshCw,
  FiUsers,
} from "react-icons/fi";
import { candidateService } from "../../API/services";
import type { Candidate } from "../../API/services";
import "./AdminCandidateList.scss";

const formatDate = (date?: string) => {
  if (!date) return "N/A";

  try {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
};

const formatSkills = (skills: Record<string, string>) => {
  const entries = Object.entries(skills || {});
  if (entries.length === 0) return "No skills added";

  return entries.map(([skill, level]) => `${skill} (${level})`).join(", ");
};

const AdminCandidateList: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.candidate_id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await candidateService.listCandidates(0, 100);
      setCandidates(data);
      setSelectedCandidateId((current) =>
        current && data.some((candidate) => candidate.candidate_id === current) ? current : null
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to load candidates."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return (
    <div className="admin-candidate-list">
      <div className="candidate-list-header">
        <div>
          <h1>Candidate List</h1>
          <p>View candidate credentials and profile details added by admin</p>
        </div>
        <button className="refresh-btn" type="button" onClick={fetchCandidates} disabled={loading}>
          <FiRefreshCw className={loading ? "spinning" : ""} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="candidate-alert">
          <FiAlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="candidate-loading">
          <div className="spinner" />
          <p>Loading candidates...</p>
        </div>
      )}

      {!loading && candidates.length === 0 && !error && (
        <div className="candidate-empty">
          <FiUsers size={42} />
          <h2>No candidates yet</h2>
          <p>Candidates added from the Add Candidate section will appear here.</p>
        </div>
      )}

      {!loading && candidates.length > 0 && (
        <div className="candidate-list-layout">
          <div className="candidate-name-panel">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidateId === candidate.candidate_id;

              return (
                <button
                  key={candidate.candidate_id}
                  type="button"
                  className={`candidate-name-row ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                >
                  {isSelected ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                  <span>{candidate.full_name}</span>
                </button>
              );
            })}
          </div>

          {selectedCandidate && (
            <div className="candidate-details-panel">
              <div className="details-title">
                <div className="candidate-avatar">
                  {selectedCandidate.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedCandidate.full_name}</h2>
                  <p>{selectedCandidate.current_role || "Candidate"}</p>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <FiMail size={18} />
                  <div>
                    <span>Email</span>
                    <strong>{selectedCandidate.email}</strong>
                  </div>
                </div>

                <div className="detail-item credential">
                  <FiKey size={18} />
                  <div>
                    <span>Password</span>
                    <strong>{selectedCandidate.password || "Not set"}</strong>
                  </div>
                </div>

                <div className="detail-item">
                  <FiBriefcase size={18} />
                  <div>
                    <span>Role</span>
                    <strong>{selectedCandidate.current_role || "N/A"}</strong>
                  </div>
                </div>

                <div className="detail-item">
                  <FiUsers size={18} />
                  <div>
                    <span>Team</span>
                    <strong>{selectedCandidate.team || "N/A"}</strong>
                  </div>
                </div>

                <div className="detail-item">
                  <FiCode size={18} />
                  <div>
                    <span>Experience</span>
                    <strong>{selectedCandidate.experience_level || "N/A"}</strong>
                  </div>
                </div>

                <div className="detail-item">
                  <FiCalendar size={18} />
                  <div>
                    <span>Added On</span>
                    <strong>{formatDate(selectedCandidate.created_at)}</strong>
                  </div>
                </div>
              </div>

              <div className="skills-block">
                <span>Skills</span>
                <p>{formatSkills(selectedCandidate.skills)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCandidateList;
