import React, { useMemo, useState } from "react";
import { FiAlertCircle, FiCheck, FiChevronDown, FiChevronUp, FiStar, FiX } from "react-icons/fi";
import "./RoleSkillPlaceholder.scss";

export type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";
export type SkillLevel = "beginner" | "intermediate" | "advanced";

interface Props {
  role: string;
  setRole: (val: string) => void;
  roleError?: string;
  setRoleError?: (err: string) => void;
  skills: string[];
  setSkills: (val: string[]) => void;
  skillsError?: string;
  setSkillsError?: (err: string) => void;
  extractedRole?: string;
  extractedSkills?: string[];
  jdSkills?: string[];
  skillPriorities?: Record<string, SkillPriority>;
  onSkillPriorityChange?: (skill: string, priority: SkillPriority) => void;
  skillLevels?: Record<string, SkillLevel>;
  onSkillLevelChange?: (skill: string, level: SkillLevel) => void;
  onClearExtraction?: () => void;
}

const SKILL_SUGGESTIONS = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "FastAPI",
  "SQLAlchemy",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "REST API",
  "Machine Learning",
  "Data Science",
  "AI",
  "Agentic AI",
  "LangChain",
  "GPT",
  "Groq",
];

const LEVEL_OPTIONS: SkillLevel[] = ["beginner", "intermediate", "advanced"];

const RoleSkillPlaceholder: React.FC<Props> = ({
  role,
  setRole,
  roleError,
  setRoleError,
  skills,
  setSkills,
  skillsError,
  setSkillsError,
  extractedRole,
  extractedSkills,
  jdSkills = [],
  skillPriorities = {},
  onSkillPriorityChange,
  skillLevels = {},
  onSkillLevelChange,
  onClearExtraction: _onClearExtraction,
}) => {
  const [tempSkill, setTempSkill] = useState("");
  const [tempSkillPriority, setTempSkillPriority] = useState<SkillPriority>("must-have");
  const [tempSkillLevel, setTempSkillLevel] = useState<SkillLevel>("intermediate");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showAllSkills, setShowAllSkills] = useState(false);

  const TOP_SKILLS_COUNT = 5;

  const sortedSkills = useMemo(() => {
    return skills
      .map((skill) => ({
        name: skill,
        isMatched: jdSkills.some(
          (jd) =>
            jd.toLowerCase() === skill.toLowerCase() ||
            skill.toLowerCase().includes(jd.toLowerCase()) ||
            jd.toLowerCase().includes(skill.toLowerCase())
        ),
      }))
      .sort((a, b) => {
        if (a.isMatched && !b.isMatched) return -1;
        if (!a.isMatched && b.isMatched) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [skills, jdSkills]);

  const topSkills = sortedSkills.slice(0, TOP_SKILLS_COUNT);
  const remainingSkills = sortedSkills.slice(TOP_SKILLS_COUNT);
  const hasMoreSkills = remainingSkills.length > 0;
  const matchedCount = sortedSkills.filter((s) => s.isMatched).length;

  const handleRoleChange = (value: string) => {
    setRole(value);
    if (value.trim()) {
      setRoleError?.("");
    }
  };

  const handleSkillInput = (value: string) => {
    setTempSkill(value);
    if (value.trim().length > 0) {
      const filtered = SKILL_SUGGESTIONS.filter(
        (skill) => skill.toLowerCase().includes(value.toLowerCase()) && !skills.includes(skill)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const addSkill = (skillName: string, priority?: SkillPriority, level?: SkillLevel) => {
    const trimmed = skillName.trim();
    if (!trimmed || skills.includes(trimmed)) return;

    setSkills([...skills, trimmed]);
    onSkillPriorityChange?.(trimmed, priority || tempSkillPriority);
    onSkillLevelChange?.(trimmed, level || tempSkillLevel);

    setTempSkill("");
    setShowSuggestions(false);
    setSkillsError?.("");
    setTempSkillPriority("must-have");
    setTempSkillLevel("intermediate");
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill(tempSkill);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const removeSkill = (index: number) => {
    const updated = [...skills];
    updated.splice(index, 1);
    setSkills(updated);
  };

  const useExtractedRole = () => {
    if (extractedRole) {
      setRole(extractedRole);
      setRoleError?.("");
    }
  };

  const useExtractedSkills = () => {
    if (!extractedSkills || extractedSkills.length === 0) {
      return;
    }

    const newSkills = [...skills, ...extractedSkills.filter((s) => !skills.includes(s))];
    setSkills(newSkills);
    setSkillsError?.("");

    extractedSkills.forEach((skill) => {
      if (!skills.includes(skill)) {
        onSkillPriorityChange?.(skill, "good-to-have");
        onSkillLevelChange?.(skill, skillLevels[skill] || "intermediate");
      }
    });
  };

  const getPriorityPresentation = (priority: SkillPriority) => {
    if (priority === "must-have") {
      return { label: "M", title: "Must have", background: "#e3f2fd", color: "#1976d2" };
    }
    if (priority === "resume-based") {
      return { label: "R", title: "Resume-based", background: "#e8f5e9", color: "#2e7d32" };
    }
    if (priority === "soft") {
      return { label: "S", title: "Soft skill", background: "#f3e5f5", color: "#7b1fa2" };
    }
    return { label: "G", title: "Good to have", background: "#fff3e0", color: "#f57c00" };
  };

  const getSkillLevelValue = (skill: string): SkillLevel => {
    const value = skillLevels[skill]?.toLowerCase();
    if (value === "beginner" || value === "advanced") {
      return value;
    }
    return "intermediate";
  };

  const renderSkillRow = (skillData: { name: string; isMatched: boolean }, index: number) => {
    const isExtracted = extractedSkills?.includes(skillData.name);
    const originalIndex = skills.indexOf(skillData.name);
    const priority = skillPriorities[skillData.name] || "must-have";
    const level = getSkillLevelValue(skillData.name);

    return (
      <div
        key={`${skillData.name}-${index}`}
        className={`skill-chip ${isExtracted ? "extracted" : "manual"} ${skillData.isMatched ? "matched" : ""}`}
      >
        <div className="skill-chip__main">
          <div className="skill-chip__title">
            {skillData.isMatched && <FiStar className="match-star" size={12} />}
            <span className="skill-name">{skillData.name}</span>
            {isExtracted && !skillData.isMatched && <span className="source-label">auto</span>}
          </div>

          <div className="skill-chip__controls">
            {onSkillLevelChange && (
              <select
                className="skill-level-select"
                value={level}
                onChange={(e) => onSkillLevelChange(skillData.name, e.target.value as SkillLevel)}
                aria-label={`Skill level for ${skillData.name}`}
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {onSkillPriorityChange && (
              <button
                type="button"
                className="priority-badge"
                onClick={() => {
                  const current = skillPriorities[skillData.name] || "must-have";
                  const newPriority: SkillPriority =
                    current === "good-to-have"
                      ? "must-have"
                      : current === "must-have"
                        ? "resume-based"
                        : current === "resume-based"
                          ? "soft"
                          : "good-to-have";
                  onSkillPriorityChange(skillData.name, newPriority);
                }}
                style={{
                  background: getPriorityPresentation(priority).background,
                  color: getPriorityPresentation(priority).color,
                }}
                title={getPriorityPresentation(priority).title}
              >
                {getPriorityPresentation(priority).label}
              </button>
            )}

            <button
              type="button"
              className="remove-skill"
              onClick={() => removeSkill(originalIndex)}
              aria-label={`Remove ${skillData.name}`}
              title={`Remove ${skillData.name}`}
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="role-skill-wrapper">
      <div className={`form-group ${roleError ? "error" : ""}`}>
        <div className="group-header">
          <label className="form-label">
            Role *
            {extractedRole && extractedRole !== role && <span className="extraction-badge">auto-extracted</span>}
          </label>
          {extractedRole && extractedRole !== role && (
            <button type="button" className="use-extraction-btn" onClick={useExtractedRole} title="Use extracted role">
              Use suggestion
            </button>
          )}
        </div>

        <div className="role-input-container">
          <input
            type="text"
            className="form-input"
            value={role}
            placeholder="Enter or edit candidate role"
            onChange={(e) => handleRoleChange(e.target.value)}
          />
          {role && <FiCheck size={18} className="check-icon" />}
        </div>

        {roleError && (
          <div className="error-message">
            <FiAlertCircle size={14} />
            <span>{roleError}</span>
          </div>
        )}
      </div>

      <div className={`form-group ${skillsError ? "error" : ""}`}>
        <div className="group-header">
          <label className="form-label">
            Skills * ({skills.length})
            {extractedSkills && extractedSkills.length > 0 && (
              <span className="extraction-badge">{extractedSkills.length} extracted</span>
            )}
          </label>
          {extractedSkills && extractedSkills.length > 0 && (
            <button type="button" className="use-extraction-btn" onClick={useExtractedSkills} title="Add extracted skills">
              Add all
            </button>
          )}
        </div>

        <div className="skill-input-container" style={{ position: "relative" }}>
          <div className="skill-input-row">
            <input
              type="text"
              className="form-input"
              placeholder="Type skill name or press Ctrl+Space for suggestions"
              value={tempSkill}
              onChange={(e) => handleSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              onFocus={() => tempSkill && setShowSuggestions(true)}
            />

            <select
              value={tempSkillLevel}
              onChange={(e) => setTempSkillLevel(e.target.value as SkillLevel)}
              className="skill-level-select"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>

            <select
              value={tempSkillPriority}
              onChange={(e) => setTempSkillPriority(e.target.value as SkillPriority)}
              className="skill-priority-select"
            >
              <option value="must-have">Must Have</option>
              <option value="good-to-have">Good to Have</option>
              <option value="resume-based">Resume-based</option>
              <option value="soft">Soft</option>
            </select>

            {tempSkill.trim() && (
              <button type="button" className="add-skill-btn" onClick={() => addSkill(tempSkill)}>
                Add
              </button>
            )}
          </div>

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {filteredSuggestions.map((skill) => (
                <div key={skill} className="suggestion-item" onClick={() => addSkill(skill)}>
                  {skill}
                </div>
              ))}
            </div>
          )}
        </div>

        {jdSkills.length > 0 && matchedCount > 0 && (
          <div className="jd-match-summary">
            <FiStar className="match-icon" />
            <span>{matchedCount} of {skills.length} skills match JD requirements</span>
          </div>
        )}

        {skills.length > 0 && (
          <div className="skill-editor-header">
            <span>Review each extracted skill and adjust the level if needed.</span>
          </div>
        )}

        <div className="skills-list">
          {topSkills.map(renderSkillRow)}
        </div>

        {hasMoreSkills && (
          <div className="skills-collapse-section">
            <button type="button" className="collapse-toggle" onClick={() => setShowAllSkills(!showAllSkills)}>
              {showAllSkills ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
              {showAllSkills ? "Show less (Other Skills)" : `Show ${remainingSkills.length} more (Other Skills)`}
            </button>

            {showAllSkills && <div className="skills-list collapsed-skills">{remainingSkills.map(renderSkillRow)}</div>}
          </div>
        )}

        {extractedSkills && extractedSkills.length > 0 && skills.length === 0 && (
          <div className="extracted-preview">
            <p className="preview-label">Suggestions from your documents:</p>
            <div className="preview-skills">
              {extractedSkills.slice(0, 5).map((skill) => (
                <span key={skill} className="preview-chip">
                  {skill}
                </span>
              ))}
              {extractedSkills.length > 5 && <span className="preview-chip more">+{extractedSkills.length - 5}</span>}
            </div>
          </div>
        )}

        {skillsError && (
          <div className="error-message">
            <FiAlertCircle size={14} />
            <span>{skillsError}</span>
          </div>
        )}
      </div>

      {(extractedRole || extractedSkills?.length) && (
        <div className="extraction-info">
          <p><strong>Tip:</strong> The suggested skill levels come from the system extraction. You can keep them as-is or override any skill before generating the assessment.</p>
        </div>
      )}
    </div>
  );
};

export default RoleSkillPlaceholder;
