import React, { useState, useMemo } from "react";
import { FiX, FiCheck, FiAlertCircle, FiChevronDown, FiChevronUp, FiStar } from "react-icons/fi";
import "./RoleSkillPlaceholder.scss";

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
  skillDurations?: Record<string, number>;
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
  skillDurations = {},
  onClearExtraction: _onClearExtraction,
}) => {
  const [tempSkill, setTempSkill] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showAllSkills, setShowAllSkills] = useState(false);

  const TOP_SKILLS_COUNT = 5;

  const sortedSkills = useMemo(() => {
    return skills
      .map(skill => ({
        name: skill,
        duration: skillDurations[skill.toLowerCase()] || 0,
        isMatched: jdSkills.some(jd => 
          jd.toLowerCase() === skill.toLowerCase() || 
          skill.toLowerCase().includes(jd.toLowerCase()) ||
          jd.toLowerCase().includes(skill.toLowerCase())
        )
      }))
      .sort((a, b) => {
        if (a.isMatched && !b.isMatched) return -1;
        if (!a.isMatched && b.isMatched) return 1;
        return b.duration - a.duration;
      });
  }, [skills, jdSkills, skillDurations]);

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

  const addSkill = (skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed || skills.includes(trimmed)) return;

    setSkills([...skills, trimmed]);
    setTempSkill("");
    setShowSuggestions(false);
    setSkillsError?.("");
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
    }
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
        <div className="skill-input-container">
          <input
            type="text"
            className="form-input"
            placeholder="Type skill name or press Ctrl+Space for suggestions"
            value={tempSkill}
            onChange={(e) => handleSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            onFocus={() => tempSkill && setShowSuggestions(true)}
          />

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
                {skillData.duration > 0 && (
                  <span className="skill-duration">{skillData.duration}+ yrs</span>
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
              {showAllSkills ? "Show less" : `Show ${remainingSkills.length} more skills`}
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
                      {skillData.duration > 0 && (
                        <span className="skill-duration">{skillData.duration}+ yrs</span>
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