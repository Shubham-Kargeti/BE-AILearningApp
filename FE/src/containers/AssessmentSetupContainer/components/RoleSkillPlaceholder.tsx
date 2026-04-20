import React, { useState, useMemo } from "react";
import { FiX, FiCheck, FiAlertCircle, FiChevronDown, FiChevronUp, FiStar } from "react-icons/fi";
import "./RoleSkillPlaceholder.scss";

type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";

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
  onClearExtraction: _onClearExtraction,
}) => {
  const [tempSkill, setTempSkill] = useState("");
  const [tempSkillPriority, setTempSkillPriority] = useState<SkillPriority>("must-have");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showAllSkills, setShowAllSkills] = useState(false);

  const TOP_SKILLS_COUNT = 5;

  const sortedSkills = useMemo(() => {
    return skills
      .map(skill => ({
        name: skill,
        isMatched: jdSkills.some(jd =>
          jd.toLowerCase() === skill.toLowerCase() ||
          skill.toLowerCase().includes(jd.toLowerCase()) ||
          jd.toLowerCase().includes(skill.toLowerCase())
        )
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
  const matchedCount = sortedSkills.filter(s => s.isMatched).length;

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
        (skill) =>
          skill.toLowerCase().includes(value.toLowerCase()) &&
          !skills.includes(skill)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const addSkill = (skillName: string, priority?: SkillPriority) => {
    const trimmed = skillName.trim();
    if (!trimmed || skills.includes(trimmed)) return;

    setSkills([...skills, trimmed]);
    
    // Set priority for the newly added skill
    if (onSkillPriorityChange) {
      const priorityToUse = priority || tempSkillPriority;
      onSkillPriorityChange(trimmed, priorityToUse);
    }
    
    setTempSkill("");
    setShowSuggestions(false);
    setSkillsError?.("");
    // Reset to default priority
    setTempSkillPriority("must-have");
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
    if (extractedSkills && extractedSkills.length > 0) {
      const newSkills = [
        ...skills,
        ...extractedSkills.filter((s) => !skills.includes(s)),
      ];
      setSkills(newSkills);
      setSkillsError?.("");
      
      // Set all extracted skills as "must-have" by default
      if (onSkillPriorityChange) {
        extractedSkills.forEach(skill => {
          if (!skills.includes(skill)) {
            onSkillPriorityChange(skill, "good-to-have");
          }
        });
      }
    }
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

  return (
    <div className="role-skill-wrapper">
      {/* ROLE SECTION */}
      <div className={`form-group ${roleError ? "error" : ""}`}>
        <div className="group-header">
          <label className="form-label">
            Role *
            {extractedRole && extractedRole !== role && (
              <span className="extraction-badge">auto-extracted</span>
            )}
          </label>
          {extractedRole && extractedRole !== role && (
            <button
              type="button"
              className="use-extraction-btn"
              onClick={useExtractedRole}
              title="Use extracted role"
            >
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

      {/* SKILLS SECTION */}
      <div className={`form-group ${skillsError ? "error" : ""}`}>
        <div className="group-header">
          <label className="form-label">
            Skills * ({skills.length})
            {extractedSkills && extractedSkills.length > 0 && (
              <span className="extraction-badge">
                {extractedSkills.length} extracted
              </span>
            )}
          </label>
          {extractedSkills && extractedSkills.length > 0 && (
            <button
              type="button"
              className="use-extraction-btn"
              onClick={useExtractedSkills}
              title="Add extracted skills"
            >
              Add all
            </button>
          )}
        </div>

        {/* Skill Input with Suggestions */}
        <div className="skill-input-container" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Type skill name or press Ctrl+Space for suggestions"
              value={tempSkill}
              onChange={(e) => handleSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
              onFocus={() => tempSkill && setShowSuggestions(true)}
              style={{ flex: 1 }}
            />
            
            {/* Priority Selector */}
            <select
              value={tempSkillPriority}
              onChange={(e) => setTempSkillPriority(e.target.value as SkillPriority)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                background:
                  tempSkillPriority === "must-have" ? "#e3f2fd" :
                  tempSkillPriority === "good-to-have" ? "#fff3e0" :
                  tempSkillPriority === "resume-based" ? "#e8f5e9" :
                  "#f3e5f5",
                color:
                  tempSkillPriority === "must-have" ? "#1976d2" :
                  tempSkillPriority === "good-to-have" ? "#f57c00" :
                  tempSkillPriority === "resume-based" ? "#2e7d32" :
                  "#7b1fa2",
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '130px',
              }}
            >
              <option value="must-have" style={{ background: '#fff' }}>Must Have</option>
              <option value="good-to-have" style={{ background: '#fff' }}>Good to Have</option>
              <option value="resume-based" style={{ background: '#fff' }}>Resume-based</option>
              <option value="soft" style={{ background: '#fff' }}>Soft</option>
            </select>
            
            {/* Add Button */}
            {tempSkill.trim() && (
              <button
                type="button"
                onClick={() => addSkill(tempSkill)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {filteredSuggestions.map((skill) => (
                <div
                  key={skill}
                  className="suggestion-item"
                  onClick={() => addSkill(skill)}
                >
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

        {/* Strong Skills label — show only when we actually have top skills to display */}
        {topSkills.length > 0 && (
          <div
            className="collapse-toggle strong-skills-label"
            style={{ cursor: "default", display: "flex", alignItems: "center", gap: 8 }}
          >
            <FiStar size={16} />
            <span style={{ fontWeight: 600 }}>Strong Skills</span>
          </div>
        )}



        <div className="skills-list">
          {topSkills.map((skillData, index) => {
            const isExtracted = extractedSkills?.includes(skillData.name);
            const originalIndex = skills.indexOf(skillData.name);
            return (
              <div
                key={index}
                className={`skill-chip ${isExtracted ? "extracted" : "manual"} ${skillData.isMatched ? "matched" : ""}`}
              >
                {skillData.isMatched && <FiStar className="match-star" size={12} />}
                <span className="skill-name">{skillData.name}</span>
                {onSkillPriorityChange && (
                  <button
                    className="priority-badge"
                    onClick={() => {
                      const current = skillPriorities[skillData.name] || "must-have";
                      const newPriority: SkillPriority =
                        current === "good-to-have" ? "must-have" :
                        current === "must-have" ? "resume-based" :
                        current === "resume-based" ? "soft" :
                        "good-to-have";
                      onSkillPriorityChange(skillData.name, newPriority);
                    }}
                    style={{
                      padding: '2px 6px',
                      fontSize: '0.7em',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: getPriorityPresentation(skillPriorities[skillData.name] || "must-have").background,
                      color: getPriorityPresentation(skillPriorities[skillData.name] || "must-have").color,
                      marginLeft: '4px',
                    }}
                    title={getPriorityPresentation(skillPriorities[skillData.name] || "must-have").title}
                  >
                    {getPriorityPresentation(skillPriorities[skillData.name] || "must-have").label}
                  </button>
                )}
                {isExtracted && !skillData.isMatched && <span className="source-label">auto</span>}
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
            );
          })}
        </div>

        {hasMoreSkills && (
          <div className="skills-collapse-section">
            <button
              type="button"
              className="collapse-toggle"
              onClick={() => setShowAllSkills(!showAllSkills)}
            >
              {showAllSkills ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
              {showAllSkills ? "Show less (Other Skills)" : `Show ${remainingSkills.length} more (Other Skills)`}
            </button>

            {showAllSkills && (
              <div className="skills-list collapsed-skills">
                {remainingSkills.map((skillData, index) => {
                  const isExtracted = extractedSkills?.includes(skillData.name);
                  const originalIndex = skills.indexOf(skillData.name);
                  return (
                    <div
                      key={index}
                      className={`skill-chip ${isExtracted ? "extracted" : "manual"} ${skillData.isMatched ? "matched" : ""}`}
                    >
                      {skillData.isMatched && <FiStar className="match-star" size={12} />}
                      <span className="skill-name">{skillData.name}</span>
                      {isExtracted && !skillData.isMatched && <span className="source-label">auto</span>}
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Extracted Skills Preview (if not used yet) */}
        {extractedSkills && extractedSkills.length > 0 && skills.length === 0 && (
          <div className="extracted-preview">
            <p className="preview-label">📋 Suggestions from your documents:</p>
            <div className="preview-skills">
              {extractedSkills.slice(0, 5).map((skill) => (
                <span key={skill} className="preview-chip">
                  {skill}
                </span>
              ))}
              {extractedSkills.length > 5 && (
                <span className="preview-chip more">+{extractedSkills.length - 5}</span>
              )}
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

      {/* Info Box */}
      {(extractedRole || extractedSkills?.length) && (
        <div className="extraction-info">
          <p>💡 <strong>Tip:</strong> You can customize the auto-extracted suggestions or keep them as-is. Click "Use suggestion" or "Add all" to accept.</p>
        </div>
      )}
    </div>
  );
};

export default RoleSkillPlaceholder;