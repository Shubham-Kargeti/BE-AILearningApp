import React, { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiCode,
  FiKey,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX,
  FiUsers,
} from "react-icons/fi";
import Toast from "../../components/Toast/Toast";
import { candidateService } from "../../API/services";
import type { Candidate, CandidateUpdateRequest } from "../../API/services";
import "./AdminCandidateList.scss";

type ToastMessage = {
  type: "success" | "error" | "info";
  message: string;
};

type SkillDraft = {
  id: string;
  name: string;
  level: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

const toDateInputValue = (date?: string) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const formatSkills = (skills: Record<string, string>) => {
  const entries = Object.entries(skills || {});
  if (entries.length === 0) return "No skills added";

  return entries.map(([skill, level]) => `${skill} (${level})`).join(", ");
};

const skillsToDraft = (skills: Record<string, string>): SkillDraft[] =>
  Object.entries(skills || {}).map(([name, level], index) => ({
    id: `${name}-${index}`,
    name,
    level,
  }));

const draftToSkills = (draft: SkillDraft[]) =>
  draft.reduce<Record<string, string>>((acc, item) => {
    const name = item.name.trim();
    const level = item.level.trim();
    if (name) {
      acc[name] = level || "Not specified";
    }
    return acc;
  }, {});

const getApiErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.detail ||
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  fallback;

interface EditableDetailCardProps<TDraft> {
  label: string;
  icon: ReactNode;
  value: TDraft;
  displayValue: ReactNode;
  className?: string;
  editLabel?: string;
  createLabel?: string;
  isEmpty?: boolean;
  credential?: boolean;
  savingText?: string;
  successMessage: string;
  onSave: (value: TDraft) => Promise<void>;
  validate?: (value: TDraft) => string | null;
  renderEditor: (value: TDraft, onChange: (value: TDraft) => void) => ReactNode;
}

function EditableDetailCard<TDraft>({
  label,
  icon,
  value,
  displayValue,
  className,
  editLabel,
  createLabel,
  isEmpty,
  credential,
  savingText = "Saving",
  successMessage,
  onSave,
  validate,
  renderEditor,
}: EditableDetailCardProps<TDraft>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<TDraft>(value);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    setIsEditing(false);
    setDraft(value);
    setMessage("");
  }, [value]);

  const beginEdit = () => {
    setDraft(value);
    setMessage("");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(value);
    setMessage("");
    setIsEditing(false);
  };

  const saveEdit = async () => {
    const validationMessage = validate?.(draft);
    if (validationMessage) {
      setMessageType("error");
      setMessage(validationMessage);
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      await onSave(draft);
      setIsEditing(false);
      setMessageType("success");
      setMessage(successMessage);
    } catch (err: any) {
      setMessageType("error");
      setMessage(getApiErrorMessage(err, `Failed to update ${label.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`detail-item ${credential ? "credential" : ""} ${className || ""}`}>
      {icon}
      <div>
        <span>{label}</span>
        {!isEditing && (
          <>
            <strong>{displayValue}</strong>
            <button className="editable-edit-btn" type="button" onClick={beginEdit}>
              {isEmpty ? createLabel || `Create ${label.toLowerCase()}` : editLabel || `Edit ${label.toLowerCase()}`}
            </button>
          </>
        )}
        {isEditing && (
          <div className="editable-editor">
            {renderEditor(draft, setDraft)}
            <div className="editable-actions">
              <button
                type="button"
                className="save-editable-btn"
                onClick={saveEdit}
                disabled={saving}
              >
                <FiSave size={14} />
                <span>{saving ? savingText : "Save"}</span>
              </button>
              <button
                type="button"
                className="cancel-editable-btn"
                onClick={cancelEdit}
                disabled={saving}
              >
                <FiX size={14} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
        {message && <small className={messageType}>{message}</small>}
      </div>
    </div>
  );
}

interface EditableSkillsCardProps {
  value: Record<string, string>;
  onSave: (value: Record<string, string>) => Promise<void>;
}

const EditableSkillsCard: React.FC<EditableSkillsCardProps> = ({ value, onSave }) => {
  const skillDraft = useMemo(() => skillsToDraft(value), [value]);

  return (
    <EditableDetailCard<SkillDraft[]>
      label="Skills"
      icon={<FiCode size={18} />}
      value={skillDraft}
      displayValue={formatSkills(value)}
      className="skills-full-width"
      editLabel="Edit skills"
      createLabel="Add skills"
      isEmpty={Object.keys(value || {}).length === 0}
      successMessage="Skills updated."
      validate={(draft) => {
        const hasNamedSkill = draft.some((item) => item.name.trim());
        return hasNamedSkill ? null : "Add at least one skill.";
      }}
      onSave={async (draft) => onSave(draftToSkills(draft))}
      renderEditor={(draft, setDraft) => {
        const rows = draft.length ? draft : [{ id: "new-skill", name: "", level: "" }];

        return (
          <div className="skills-editor">
            {rows.map((item, index) => (
              <div className="skill-editor-row" key={item.id}>
                <input
                  type="text"
                  value={item.name}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...item, name: event.target.value };
                    setDraft(next);
                  }}
                  placeholder="Skill"
                  autoFocus={index === 0}
                />
                <input
                  type="text"
                  value={item.level}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = { ...item, level: event.target.value };
                    setDraft(next);
                  }}
                  placeholder="Proficiency"
                />
                <button
                  type="button"
                  className="remove-skill-btn"
                  onClick={() => setDraft(rows.filter((row) => row.id !== item.id))}
                  aria-label={`Remove ${item.name || "skill"}`}
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="add-skill-btn"
              onClick={() =>
                setDraft([
                  ...rows,
                  { id: `skill-${Date.now()}`, name: "", level: "" },
                ])
              }
            >
              <FiPlus size={14} />
              <span>Add skill</span>
            </button>
          </div>
        );
      }}
    />
  );
};

const AdminCandidateList: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.candidate_id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  const roleOptions = useMemo(
    () =>
      Array.from(
        new Set(candidates.map((candidate) => candidate.current_role).filter(Boolean) as string[])
      ),
    [candidates]
  );

  const experienceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...candidates.map((candidate) => candidate.experience_level).filter(Boolean),
            "junior",
            "mid",
            "senior",
            "lead",
            "executive",
          ] as string[]
        )
      ),
    [candidates]
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
      setError(getApiErrorMessage(err, "Failed to load candidates."));
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

  const updateSelectedCandidate = async (
    payload: CandidateUpdateRequest,
    successMessage: string
  ) => {
    if (!selectedCandidate) return;

    try {
      const updated = await candidateService.updateCandidate(selectedCandidate.candidate_id, payload);
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.candidate_id === updated.candidate_id ? updated : candidate
        )
      );
      setToast({ type: "success", message: successMessage });
    } catch (err) {
      setToast({
        type: "error",
        message: getApiErrorMessage(err, "Failed to update candidate."),
      });
      throw err;
    }
  };

  return (
    <div className="admin-candidate-list">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

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
                <EditableDetailCard<string>
                  label="Full Name"
                  icon={<FiUser size={18} />}
                  value={selectedCandidate.full_name || ""}
                  displayValue={selectedCandidate.full_name || "N/A"}
                  editLabel="Edit Name"
                  successMessage="Full name updated."
                  validate={(value) => (value.trim() ? null : "Full name cannot be empty.")}
                  onSave={(value) =>
                    updateSelectedCandidate({ full_name: value.trim() }, "Full name updated.")
                  }
                  renderEditor={(value, setValue) => (
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter candidate full name"
                      autoFocus
                    />
                  )}
                />

                <EditableDetailCard<string>
                  label="Email"
                  icon={<FiMail size={18} />}
                  value={selectedCandidate.email || ""}
                  displayValue={selectedCandidate.email || "N/A"}
                  editLabel="Edit email"
                  successMessage="Email updated."
                  validate={(value) => {
                    const nextEmail = value.trim();
                    if (!nextEmail) return "Email cannot be empty.";
                    return emailPattern.test(nextEmail) ? null : "Enter a valid email address.";
                  }}
                  onSave={(value) =>
                    updateSelectedCandidate(
                      { email: value.trim().toLowerCase() },
                      "Email updated."
                    )
                  }
                  renderEditor={(value, setValue) => (
                    <input
                      type="email"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter candidate email"
                      autoFocus
                    />
                  )}
                />

                <EditableDetailCard<string>
                  label="Password"
                  icon={<FiKey size={18} />}
                  value={selectedCandidate.password || ""}
                  displayValue={selectedCandidate.password || "Not set"}
                  editLabel="Edit password"
                  createLabel="Create password"
                  isEmpty={!selectedCandidate.password}
                  credential
                  successMessage="Password updated."
                  validate={(value) => (value.trim() ? null : "Password cannot be empty.")}
                  onSave={(value) =>
                    updateSelectedCandidate({ password: value.trim() }, "Password updated.")
                  }
                  renderEditor={(value, setValue) => (
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter candidate password"
                      autoFocus
                    />
                  )}
                />

                <EditableDetailCard<string>
                  label="Role"
                  icon={<FiBriefcase size={18} />}
                  value={selectedCandidate.current_role || ""}
                  displayValue={selectedCandidate.current_role || "N/A"}
                  editLabel="Edit role"
                  createLabel="Add role"
                  isEmpty={!selectedCandidate.current_role}
                  successMessage="Role updated."
                  validate={(value) => (value.trim() ? null : "Role cannot be empty.")}
                  onSave={(value) =>
                    updateSelectedCandidate({ current_role: value.trim() }, "Role updated.")
                  }
                  renderEditor={(value, setValue) => (
                    <>
                      <select
                        value={roleOptions.includes(value) ? value : ""}
                        onChange={(event) => setValue(event.target.value)}
                        autoFocus
                      >
                        <option value="">Custom role</option>
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="Enter candidate role"
                      />
                    </>
                  )}
                />

                <EditableDetailCard<string>
                  label="Team"
                  icon={<FiUsers size={18} />}
                  value={selectedCandidate.team || ""}
                  displayValue={selectedCandidate.team || "N/A"}
                  editLabel="Edit team"
                  createLabel="Add team"
                  isEmpty={!selectedCandidate.team}
                  successMessage="Team updated."
                  validate={(value) => (value.trim() ? null : "Team cannot be empty.")}
                  onSave={(value) =>
                    updateSelectedCandidate({ team: value.trim() }, "Team updated.")
                  }
                  renderEditor={(value, setValue) => (
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="Enter candidate team"
                      autoFocus
                    />
                  )}
                />

                <EditableDetailCard<string>
                  label="Experience"
                  icon={<FiCode size={18} />}
                  value={selectedCandidate.experience_level || ""}
                  displayValue={selectedCandidate.experience_level || "N/A"}
                  editLabel="Edit experience"
                  createLabel="Add experience"
                  isEmpty={!selectedCandidate.experience_level}
                  successMessage="Experience updated."
                  validate={(value) => (value.trim() ? null : "Experience cannot be empty.")}
                  onSave={(value) =>
                    updateSelectedCandidate({ experience_level: value.trim() }, "Experience updated.")
                  }
                  renderEditor={(value, setValue) => (
                    <select
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      autoFocus
                    >
                      <option value="">Select experience</option>
                      {experienceOptions.map((experience) => (
                        <option key={experience} value={experience}>
                          {experience}
                        </option>
                      ))}
                    </select>
                  )}
                />

                <EditableDetailCard<string>
                  label="Added On"
                  icon={<FiCalendar size={18} />}
                  value={toDateInputValue(selectedCandidate.created_at)}
                  displayValue={formatDate(selectedCandidate.created_at)}
                  editLabel="Edit date"
                  successMessage="Added date updated."
                  validate={(value) => (value ? null : "Select a date.")}
                  onSave={(value) =>
                    updateSelectedCandidate(
                      { created_at: new Date(`${value}T00:00:00`).toISOString() },
                      "Added date updated."
                    )
                  }
                  renderEditor={(value, setValue) => (
                    <input
                      type="date"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      autoFocus
                    />
                  )}
                />

                <EditableSkillsCard
                  value={selectedCandidate.skills || {}}
                  onSave={(value) => updateSelectedCandidate({ skills: value }, "Skills updated.")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminCandidateList;
