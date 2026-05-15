import React, { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiSliders,
  FiStar,
  FiX,
} from "react-icons/fi";
import "./RoleSkillPlaceholder.scss";

type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";
type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface SkillConfiguration {
  skill_name: string;
  extracted_level: string;
  effective_level: string;
  level_source: "llm" | "manual";
  override_experience_years?: number;
  override_level?: string;
  confidence?: number;
  matched_with_jd?: boolean;
  priority?: string;
  category?: string;
  source?: string;
  inferred?: boolean;
  evidence?: string;
}

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
  skillLevels?: Record<string, string>;
  skillConfig?: Record<string, SkillConfiguration>;
  onSkillConfigChange?: (skill: string, patch: Partial<SkillConfiguration>) => void;
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

const normalizeLevel = (value?: string): SkillLevel => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "beginner" || normalized === "intermediate" || normalized === "advanced") {
    return normalized;
  }
  if (["basic", "easy", "junior"].includes(normalized)) return "beginner";
  if (["hard", "senior", "expert", "lead", "principal"].includes(normalized)) return "advanced";
  return "intermediate";
};

const levelFromYears = (years: number): SkillLevel => {
  if (years <= 3) return "beginner";
  if (years <= 7) return "intermediate";
  return "advanced";
};

const defaultYearsForLevel = (level: SkillLevel) => {
  if (level === "beginner") return 2;
  if (level === "intermediate") return 5;
  return 8;
};

const levelClass = (level: string) => `level-${level}`;

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
  skillLevels = {},
  skillConfig = {},
  onSkillConfigChange,
  onSkillPriorityChange,
  onClearExtraction: _onClearExtraction,
}) => {
  const [tempSkill, setTempSkill] = useState("");
  const [tempSkillPriority, setTempSkillPriority] = useState<SkillPriority>("must-have");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  const getConfig = (skillName: string): SkillConfiguration => {
    const key = skillName.toLowerCase();
    const existing = skillConfig[key];
    const extractedLevel = normalizeLevel(existing?.extracted_level || skillLevels[key]);
    return {
      skill_name: skillName,
      extracted_level: extractedLevel,
      effective_level: normalizeLevel(existing?.effective_level || extractedLevel),
      level_source: existing?.level_source || "llm",
      override_experience_years: existing?.override_experience_years,
      override_level: existing?.override_level,
      confidence: existing?.confidence,
      matched_with_jd: existing?.matched_with_jd,
      priority: existing?.priority,
      category: existing?.category,
      source: existing?.source,
      inferred: existing?.inferred,
      evidence: existing?.evidence,
    };
  };

  const skillRows = useMemo(() => {
    return skills.map((skill) => {
      const cfg = getConfig(skill);
      const isMatched =
        Boolean(cfg.matched_with_jd) ||
        jdSkills.some(
          (jd) =>
            jd.toLowerCase() === skill.toLowerCase() ||
            skill.toLowerCase().includes(jd.toLowerCase()) ||
            jd.toLowerCase().includes(skill.toLowerCase())
        );

      return {
        name: skill,
        config: cfg,
        isMatched,
      };
    });
  }, [skills, jdSkills, skillConfig, skillLevels, skillPriorities]);

  const matchedCount = skillRows.filter((skill) => skill.isMatched).length;

  const handleRoleChange = (value: string) => {
    setRole(value);
    if (value.trim()) setRoleError?.("");
  };

  const handleSkillInput = (value: string) => {
    setTempSkill(value);
    if (!value.trim()) {
      setShowSuggestions(false);
      return;
    }

    const filtered = SKILL_SUGGESTIONS.filter(
      (skill) => skill.toLowerCase().includes(value.toLowerCase()) && !skills.includes(skill)
    );
    setFilteredSuggestions(filtered);
    setShowSuggestions(true);
  };

  const addSkill = (skillName: string, priority?: SkillPriority) => {
    const trimmed = skillName.trim();
    if (!trimmed || skills.includes(trimmed)) return;

    const nextPriority = priority || tempSkillPriority;
    const level = nextPriority === "must-have" ? "advanced" : "intermediate";

    setSkills([...skills, trimmed]);
    onSkillPriorityChange?.(trimmed, nextPriority);
    onSkillConfigChange?.(trimmed, {
      skill_name: trimmed,
      extracted_level: level,
      effective_level: level,
      level_source: "manual",
      category: nextPriority === "soft" ? "soft" : "manual",
      priority: nextPriority,
      confidence: 1,
    });

    setTempSkill("");
    setShowSuggestions(false);
    setSkillsError?.("");
    setTempSkillPriority("must-have");
  };

  const removeSkill = (skillName: string) => {
    setSkills(skills.filter((skill) => skill !== skillName));
  };

  const useExtractedRole = () => {
    if (extractedRole) {
      setRole(extractedRole);
      setRoleError?.("");
    }
  };

  const useExtractedSkills = () => {
    if (!extractedSkills?.length) return;

    const newSkills = [...skills, ...extractedSkills.filter((skill) => !skills.includes(skill))];
    setSkills(newSkills);
    setSkillsError?.("");
    extractedSkills.forEach((skill) => {
      if (!skills.includes(skill)) onSkillPriorityChange?.(skill, "good-to-have");
    });
  };

  const getPriorityPresentation = (priority: SkillPriority) => {
    if (priority === "must-have") return { label: "Must have", title: "Must have", background: "#e3f2fd", color: "#1976d2" };
    if (priority === "resume-based") return { label: "Resume", title: "Resume-based", background: "#e8f5e9", color: "#2e7d32" };
    if (priority === "soft") return { label: "Soft", title: "Soft skill", background: "#f3e5f5", color: "#7b1fa2" };
    return { label: "Optional", title: "Good to have", background: "#fff3e0", color: "#f57c00" };
  };

  const priorityForSkill = (skillName: string, cfg: SkillConfiguration): SkillPriority => {
    const configured = skillPriorities[skillName];
    if (configured) return configured;
    if (cfg.category === "soft") return "soft";
    if (cfg.priority === "critical" || cfg.priority === "high") return "must-have";
    if (cfg.source === "resume") return "resume-based";
    return "good-to-have";
  };

  const applyExperienceOverride = (skillName: string, years: number) => {
    const boundedYears = Math.max(0, Math.min(20, years));
    const overrideLevel = levelFromYears(boundedYears);
    onSkillConfigChange?.(skillName, {
      override_experience_years: boundedYears,
      override_level: overrideLevel,
      effective_level: overrideLevel,
      level_source: "manual",
    });
  };

  const resetExperienceOverride = (skillName: string) => {
    const cfg = getConfig(skillName);
    onSkillConfigChange?.(skillName, {
      override_experience_years: undefined,
      override_level: undefined,
      effective_level: cfg.extracted_level,
      level_source: "llm",
    });
  };

  const renderSkillRow = (skillData: (typeof skillRows)[number]) => {
    const cfg = skillData.config;
    const priority = priorityForSkill(skillData.name, cfg);
    const priorityPresentation = getPriorityPresentation(priority);
    const sliderValue = cfg.override_experience_years ?? defaultYearsForLevel(normalizeLevel(cfg.extracted_level));
    const isOverridden = cfg.level_source === "manual";

    return (
      <div
        key={skillData.name}
        className={`skill-config-row ${skillData.isMatched ? "matched" : ""} ${cfg.category === "soft" ? "soft" : ""}`}
      >
        <div className="skill-config-main">
          <div className="skill-title-line">
            {skillData.isMatched && <FiStar className="match-star" size={14} />}
            <span className="skill-config-name">{skillData.name}</span>
            {cfg.inferred && <span className="mini-badge inferred">inferred</span>}
            {cfg.matched_with_jd && <span className="mini-badge match">JD match</span>}
          </div>

          <div className="skill-meta-line">
            <span className="meta-item">{cfg.category || "skill"}</span>
            <span className="meta-item">{cfg.source || "llm"}</span>
            {/* {typeof cfg.confidence === "number" && (
              <span className="meta-item">{Math.round(cfg.confidence * 100)}% confidence</span>
            )} */}
          </div>

          {cfg.evidence && <p className="skill-evidence">{cfg.evidence}</p>}
        </div>

        <div className="level-stack">
          <div className="level-pair">
            <span>Suggested Level</span>
            <strong className={levelClass(cfg.extracted_level)}>{cfg.extracted_level}</strong>
          </div>
          <div className="level-pair">
            <span>Final Level</span>
            <strong className={levelClass(cfg.effective_level)}>{cfg.effective_level}</strong>
          </div>
          {/* <span className={`source-pill ${isOverridden ? "manual" : "llm"}`}>
            {isOverridden ? "manual override" : "LLM level"}
          </span> */}
        </div>

        <div className="experience-control">
          <div className="experience-header">
            <FiSliders size={14} />
            <span>Experience Override</span>
            {isOverridden && (
              <button type="button" onClick={() => resetExperienceOverride(skillData.name)}>
                Reset
              </button>
            )}
          </div>
          <div className="experience-inputs">
            <input
              type="range"
              min={0}
              max={20}
              value={sliderValue}
              onChange={(event) => applyExperienceOverride(skillData.name, Number(event.target.value))}
            />
            <input
              type="number"
              min={0}
              max={20}
              value={isOverridden ? cfg.override_experience_years ?? "" : ""}
              placeholder={`${sliderValue}`}
              onChange={(event) => applyExperienceOverride(skillData.name, Number(event.target.value || 0))}
            />
            <span>{isOverridden ? `${cfg.override_experience_years} yrs` : "LLM"}</span>
          </div>
        </div>

        <div className="row-actions">
          {onSkillPriorityChange && (
            <button
              type="button"
              className="priority-badge"
              onClick={() => {
                const current = skillPriorities[skillData.name] || priority;
                const nextPriority: SkillPriority =
                  current === "good-to-have"
                    ? "must-have"
                    : current === "must-have"
                      ? "resume-based"
                      : current === "resume-based"
                        ? "soft"
                        : "good-to-have";
                onSkillPriorityChange(skillData.name, nextPriority);
                onSkillConfigChange?.(skillData.name, {
                  priority: nextPriority,
                  category: nextPriority === "soft" ? "soft" : cfg.category,
                });
              }}
              style={{ background: priorityPresentation.background, color: priorityPresentation.color }}
              title={priorityPresentation.title}
            >
              {priorityPresentation.label}
            </button>
          )}
          <button
            type="button"
            className="remove-skill"
            onClick={() => removeSkill(skillData.name)}
            aria-label={`Remove ${skillData.name}`}
            title={`Remove ${skillData.name}`}
          >
            <FiX size={16} />
          </button>
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
            <button type="button" className="use-extraction-btn" onClick={useExtractedRole}>
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
            onChange={(event) => handleRoleChange(event.target.value)}
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
            Skill Configuration * ({skills.length})
            {extractedSkills && extractedSkills.length > 0 && (
              <span className="extraction-badge">{extractedSkills.length} extracted</span>
            )}
          </label>
          {extractedSkills && extractedSkills.length > 0 && (
            <button type="button" className="use-extraction-btn" onClick={useExtractedSkills}>
              Add all
            </button>
          )}
        </div>

        <div className="skill-input-container">
          <div className="skill-add-row">
            <input
              type="text"
              className="form-input"
              placeholder="Add a skill manually"
              value={tempSkill}
              onChange={(event) => handleSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill(tempSkill);
                }
                if (event.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => tempSkill && setShowSuggestions(true)}
            />

            <select value={tempSkillPriority} onChange={(event) => setTempSkillPriority(event.target.value as SkillPriority)}>
              <option value="must-have">Must Have</option>
              <option value="good-to-have">Optional</option>
              <option value="resume-based">Resume-based</option>
              <option value="soft">Soft</option>
            </select>

            <button type="button" className="add-skill-btn" disabled={!tempSkill.trim()} onClick={() => addSkill(tempSkill)}>
              Add
            </button>
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

        {skillRows.length > 0 && (
          <div className="skill-config-section">
            <div className="skill-section-header">
              <h3>Skills</h3>
              <span>{skillRows.length} total</span>
            </div>
            <div className="skill-config-list">{skillRows.map(renderSkillRow)}</div>
          </div>
        )}

        {extractedSkills && extractedSkills.length > 0 && skills.length === 0 && (
          <div className="extracted-preview">
            <p className="preview-label">Suggestions from your documents:</p>
            <div className="preview-skills">
              {extractedSkills.slice(0, 5).map((skill) => (
                <span key={skill} className="preview-chip">{skill}</span>
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
    </div>
  );
};

export default RoleSkillPlaceholder;
