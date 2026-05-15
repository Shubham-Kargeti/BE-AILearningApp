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
  FiSave,
  FiSearch,
  FiX,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [editingPassword, setEditingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.candidate_id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  const fetchCandidates = async (search = searchQuery) => {
    try {
      setLoading(true);
      setError("");
      const data = await candidateService.listCandidates(0, 200, search);
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
    const timer = window.setTimeout(() => {
      fetchCandidates(searchQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setEditingPassword(false);
    setPasswordDraft("");
    setPasswordMessage("");
  }, [selectedCandidateId]);

  const handlePasswordSave = async () => {
    if (!selectedCandidate) return;

    const nextPassword = passwordDraft.trim();
    if (!nextPassword) {
      setPasswordMessage("Password cannot be empty.");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordMessage("");
      const updated = await candidateService.updateCandidate(selectedCandidate.candidate_id, {
        password: nextPassword,
      });
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.candidate_id === updated.candidate_id ? updated : candidate
        )
      );
      setEditingPassword(false);
      setPasswordDraft("");
      setPasswordMessage("Password updated.");
    } catch (err: any) {
      setPasswordMessage(
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to update password."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const beginPasswordEdit = () => {
    if (!selectedCandidate) return;
    setPasswordDraft(selectedCandidate.password || "");
    setPasswordMessage("");
    setEditingPassword(true);
  };

  const cancelPasswordEdit = () => {
    setEditingPassword(false);
    setPasswordDraft("");
    setPasswordMessage("");
  };

  return (
    <div className="admin-candidate-list">
      <div className="candidate-list-header">
        <div>
          <h1>Candidate List</h1>
          <p>View candidate credentials and profile details added by admin</p>
        </div>
        <button className="refresh-btn" type="button" onClick={() => fetchCandidates()} disabled={loading}>
          <FiRefreshCw className={loading ? "spinning" : ""} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="candidate-search">
        <FiSearch size={18} />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search candidates by name or email"
          aria-label="Search candidates by name or email"
        />
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
          <h2>{searchQuery.trim() ? "No matching candidates" : "No candidates yet"}</h2>
          <p>
            {searchQuery.trim()
              ? "Try a different name or email."
              : "Candidates added from the Add Candidate section will appear here."}
          </p>
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
                    {!editingPassword && (
                      <>
                        <strong>{selectedCandidate.password || "Not set"}</strong>
                        <button
                          className="password-edit-btn"
                          type="button"
                          onClick={beginPasswordEdit}
                        >
                          {selectedCandidate.password ? "Edit password" : "Create password"}
                        </button>
                      </>
                    )}
                    {editingPassword && (
                      <div className="password-editor">
                        <input
                          type="text"
                          value={passwordDraft}
                          onChange={(event) => setPasswordDraft(event.target.value)}
                          placeholder="Enter candidate password"
                          autoFocus
                        />
                        <div className="password-actions">
                          <button
                            type="button"
                            className="save-password-btn"
                            onClick={handlePasswordSave}
                            disabled={savingPassword}
                          >
                            <FiSave size={14} />
                            <span>{savingPassword ? "Saving" : "Save"}</span>
                          </button>
                          <button
                            type="button"
                            className="cancel-password-btn"
                            onClick={cancelPasswordEdit}
                            disabled={savingPassword}
                          >
                            <FiX size={14} />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {passwordMessage && (
                      <small className={passwordMessage === "Password updated." ? "success" : "error"}>
                        {passwordMessage}
                      </small>
                    )}
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
