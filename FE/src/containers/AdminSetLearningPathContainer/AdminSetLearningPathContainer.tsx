import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  FiBookOpen,
  FiBriefcase,
  FiClock,
  FiEdit2,
  FiFileText,
  FiLink,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { coursesService, uploadService } from "../../API/services";
import type {
  AdminLearningPathTemplate,
  ExtractedSkill,
  RecommendedCourse,
} from "../../API/services";
import Toast from "../../components/Toast/Toast";
import FileUpload from "../AssessmentSetupContainer/components/FileUpload";
import RoleSkillPlaceholder from "../AssessmentSetupContainer/components/RoleSkillPlaceholder";
import type { SkillConfiguration } from "../AssessmentSetupContainer/components/RoleSkillPlaceholder";
import "./AdminSetLearningPathContainer.scss";

type ToastMessage = { type: "success" | "error" | "info"; message: string };
type SkillPriority = "must-have" | "good-to-have" | "resume-based" | "soft";

const sourceDocumentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];

const emptyManualCourse = (): RecommendedCourse => ({
  name: "",
  topic: "",
  url: "",
  score: 0,
  collection: "",
  category: "",
  description: "",
  course_level: "Beginner",
});

const normalizeLevel = (value?: string) => {
  const level = String(value || "").trim().toLowerCase();
  if (level === "beginner" || level === "intermediate" || level === "advanced") return level;
  if (["junior", "basic", "easy"].includes(level)) return "beginner";
  if (["senior", "expert", "lead", "principal", "hard"].includes(level)) return "advanced";
  return "intermediate";
};

const courseKey = (course: RecommendedCourse) =>
  (course.url || `${course.name}|${course.topic}`).trim().toLowerCase();

const splitEmails = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    response?: { data?: { detail?: string; error?: string } };
  };
  return requestError.response?.data?.detail || requestError.response?.data?.error || fallback;
};

const uniqueSkillNames = (items: ExtractedSkill[]) =>
  Array.from(new Set(items.map((item) => item.skill_name).filter(Boolean)));

const toSkillConfig = (items: ExtractedSkill[]) =>
  items.reduce<Record<string, SkillConfiguration>>((config, skill) => {
    const level = normalizeLevel(skill.proficiency_level);
    config[skill.skill_name.toLowerCase()] = {
      skill_name: skill.skill_name,
      extracted_level: level,
      effective_level: level,
      level_source: "llm",
      confidence: skill.confidence,
      matched_with_jd: Boolean(skill.matched_with_jd),
      priority: skill.priority,
      category: skill.category,
      source: skill.source,
      inferred: Boolean(skill.inferred),
      evidence: skill.evidence,
    };
    return config;
  }, {});

const getSkillPriority = (skill: ExtractedSkill): SkillPriority => {
  if (skill.category === "soft") return "soft";
  if (skill.source === "resume") return "resume-based";
  if (skill.priority === "critical" || skill.priority === "high") return "must-have";
  return "good-to-have";
};

const getCourseSkills = (course: RecommendedCourse) =>
  Array.from(
    new Set(
      (course.topic || "")
        .split(/[,/|]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 4);

const AdminSetLearningPathContainer = () => {
  const [templates, setTemplates] = useState<AdminLearningPathTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [role, setRole] = useState("");
  const [roleError, setRoleError] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [jdSkills, setJdSkills] = useState<string[]>([]);
  const [extractedSkills, setExtractedSkills] = useState<ExtractedSkill[]>([]);
  const [skillConfig, setSkillConfig] = useState<Record<string, SkillConfiguration>>({});
  const [skillPriorities, setSkillPriorities] = useState<Record<string, SkillPriority>>({});

  const [pathName, setPathName] = useState("");
  const [focusTopic, setFocusTopic] = useState("");
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [employeeEmails, setEmployeeEmails] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [courseQuery, setCourseQuery] = useState("");
  const [courseLevel, setCourseLevel] = useState("");
  const [courseSearchResults, setCourseSearchResults] = useState<RecommendedCourse[]>([]);
  const [courseSearching, setCourseSearching] = useState(false);
  const [manualCourse, setManualCourse] = useState<RecommendedCourse>(emptyManualCourse());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.template_id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const savedSkillPayload = useMemo(
    () =>
      skills.map((skillName) => {
        const key = skillName.toLowerCase();
        const original = extractedSkills.find((skill) => skill.skill_name.toLowerCase() === key);
        const config = skillConfig[key];
        return {
          skill_name: skillName,
          canonical_name: original?.canonical_name,
          proficiency_level: normalizeLevel(
            config?.effective_level || config?.extracted_level || original?.proficiency_level
          ),
          category: config?.category || original?.category || "manual",
          frequency: original?.frequency || 1,
          confidence: original?.confidence || 1,
          inferred: Boolean(config?.inferred ?? original?.inferred),
          source: config?.source || original?.source || "manual",
          evidence: config?.evidence || original?.evidence,
          priority: config?.priority || original?.priority,
          matched_with_jd: Boolean(config?.matched_with_jd ?? original?.matched_with_jd),
        } satisfies ExtractedSkill;
      }),
    [extractedSkills, skillConfig, skills]
  );

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true);
        const data = await coursesService.listAdminLearningPathTemplates();
        setTemplates(data.learning_paths || []);
      } catch (error) {
        setToast({
          type: "error",
          message: getErrorMessage(error, "Unable to load saved learning paths."),
        });
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const upsertTemplate = (template: AdminLearningPathTemplate) => {
    setTemplates((current) => [
      template,
      ...current.filter((item) => item.template_id !== template.template_id),
    ]);
  };

  const updateSkillConfig = (skill: string, patch: Partial<SkillConfiguration>) => {
    const key = skill.toLowerCase();
    setSkillConfig((current) => {
      const existing = current[key];
      return {
        ...current,
        [key]: {
          ...existing,
          ...patch,
          skill_name: patch.skill_name || existing?.skill_name || skill,
          extracted_level: normalizeLevel(patch.extracted_level || existing?.extracted_level),
          effective_level: normalizeLevel(patch.effective_level || existing?.effective_level),
          level_source: patch.level_source || existing?.level_source || "manual",
        },
      };
    });
  };

  const hydrateExtractedSkills = (items: ExtractedSkill[], sourceJdSkills: ExtractedSkill[] = []) => {
    setExtractedSkills(items);
    setSkills(uniqueSkillNames(items));
    setSkillConfig(toSkillConfig(items));
    setSkillPriorities(
      items.reduce<Record<string, SkillPriority>>((priorities, skill) => {
        priorities[skill.skill_name] = getSkillPriority(skill);
        return priorities;
      }, {})
    );
    setJdSkills(uniqueSkillNames(sourceJdSkills));
    setSkillsError("");
  };

  const resetEditor = () => {
    setSelectedTemplateId(null);
    setResumeFile(null);
    setJdFile(null);
    setRole("");
    setRoleError("");
    setExperience("");
    setSkills([]);
    setSkillsError("");
    setJdSkills([]);
    setExtractedSkills([]);
    setSkillConfig({});
    setSkillPriorities({});
    setPathName("");
    setFocusTopic("");
    setCourses([]);
    setCourseSearchResults([]);
    setCourseQuery("");
    setManualCourse(emptyManualCourse());
    setEmployeeEmails("");
  };

  const loadTemplate = (template: AdminLearningPathTemplate) => {
    setSelectedTemplateId(template.template_id);
    setResumeFile(null);
    setJdFile(null);
    setPathName(template.name);
    setFocusTopic(template.topic);
    setRole(template.topic);
    setExperience("");
    hydrateExtractedSkills(template.extracted_skills || []);
    setCourses(template.recommended_courses || []);
    setCourseSearchResults([]);
    setEmployeeEmails("");
  };

  const generateRecommendations = async (
    recommendationSkills: ExtractedSkill[] = savedSkillPayload,
    requestedTopic = focusTopic || role
  ) => {
    if (recommendationSkills.length === 0 && !requestedTopic.trim()) {
      setToast({ type: "error", message: "Add a role, focus, or skill before recommending courses." });
      return;
    }

    try {
      setRecommending(true);
      const data = await coursesService.recommendAdminLearningPathCourses({
        skills: recommendationSkills,
        topic: requestedTopic.trim() || undefined,
        max_results: 20,
      });
      setFocusTopic(data.topic || requestedTopic);
      setCourses((data.recommended_courses || []).slice(0, 20));
      setToast({
        type: "success",
        message: `Generated ${Math.min(data.recommended_courses.length, 20)} course recommendations.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error, "Unable to generate course recommendations."),
      });
    } finally {
      setRecommending(false);
    }
  };

  const handleExtract = async () => {
    if (!resumeFile && !jdFile) {
      setToast({ type: "error", message: "Upload a resume or job description first." });
      return;
    }

    try {
      setExtracting(true);
      const extraction =
        resumeFile && jdFile
          ? await uploadService.extractCandidateSkills(jdFile, resumeFile)
          : resumeFile
            ? await uploadService.extractSkills(resumeFile)
            : await uploadService.extractSkillsFromJD(jdFile as File);

      const items = extraction.extracted_skills || [];
      const extractedRole = extraction.extraction_summary?.role?.trim() || "";
      const jdDocument = extraction.documents?.find((document) => document.document_category === "jd");
      hydrateExtractedSkills(items, jdDocument?.extracted_skills || []);
      setRole(extractedRole);
      setExperience(extraction.extraction_summary?.role_seniority?.trim() || "");
      setRoleError("");

      if (!pathName.trim()) {
        const fileName = (jdFile || resumeFile)?.name.replace(/\.[^.]+$/, "") || "Learning";
        setPathName(`${extractedRole || fileName} Learning Path`);
      }

      if (items.length === 0 && !extractedRole) {
        setToast({ type: "info", message: "No role or skills were extracted from the source document." });
        return;
      }

      await generateRecommendations(items, extractedRole || focusTopic);
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error, "Unable to extract role and skills."),
      });
    } finally {
      setExtracting(false);
    }
  };

  const removeCourse = (target: RecommendedCourse) => {
    const targetKey = courseKey(target);
    setCourses((current) => current.filter((course) => courseKey(course) !== targetKey));
  };

  const addCourse = (course: RecommendedCourse) => {
    const key = courseKey(course);
    if (!key) {
      setToast({ type: "error", message: "A course needs a title or URL." });
      return;
    }
    if (courses.some((selectedCourse) => courseKey(selectedCourse) === key)) {
      setToast({ type: "info", message: "That course is already in the learning path." });
      return;
    }
    setCourses((current) => [...current, course]);
  };

  const handleCourseSearch = async (event: FormEvent) => {
    event.preventDefault();
    const query = courseQuery.trim();
    if (query.length < 2) {
      setToast({ type: "error", message: "Enter at least two characters to search courses." });
      return;
    }

    try {
      setCourseSearching(true);
      const data = await coursesService.searchAdminLearningPathCourses(
        query,
        courseLevel || undefined,
        12
      );
      setCourseSearchResults(data.recommended_courses || []);
    } catch (error) {
      setToast({ type: "error", message: getErrorMessage(error, "Unable to search courses.") });
    } finally {
      setCourseSearching(false);
    }
  };

  const handleManualCourseAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!manualCourse.name.trim()) {
      setToast({ type: "error", message: "Enter a course title." });
      return;
    }

    addCourse({
      ...manualCourse,
      name: manualCourse.name.trim(),
      topic: manualCourse.topic.trim() || focusTopic || role || "Manual",
      url: manualCourse.url.trim(),
      collection: manualCourse.collection.trim(),
      category: manualCourse.category.trim(),
      description: manualCourse.description.trim(),
    });
    setManualCourse(emptyManualCourse());
  };

  const saveTemplate = async () => {
    if (!pathName.trim()) {
      setToast({ type: "error", message: "Name the learning path before saving." });
      return;
    }

    const payload = {
      name: pathName.trim(),
      topic: focusTopic.trim() || role.trim() || undefined,
      source_type: resumeFile && jdFile ? "cv,jd" : resumeFile ? "cv" : jdFile ? "jd" : undefined,
      source_filename: [resumeFile?.name, jdFile?.name].filter(Boolean).join(", ") || undefined,
      extracted_skills: savedSkillPayload,
      recommended_courses: courses,
    };

    try {
      setSaving(true);
      const result = selectedTemplateId
        ? await coursesService.updateAdminLearningPathTemplate(selectedTemplateId, payload)
        : await coursesService.createAdminLearningPathTemplate(payload);
      upsertTemplate(result.learning_path);
      setSelectedTemplateId(result.learning_path.template_id);
      setToast({
        type: "success",
        message:
          "updated_assignments" in result && result.updated_assignments
            ? `Learning path saved and refreshed for ${result.updated_assignments} assigned employee${result.updated_assignments === 1 ? "" : "s"}.`
            : "Learning path saved.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error, "Unable to save the learning path."),
      });
    } finally {
      setSaving(false);
    }
  };

  const assignTemplate = async () => {
    if (!selectedTemplateId) {
      setToast({ type: "error", message: "Save the learning path before assigning it." });
      return;
    }

    const emails = splitEmails(employeeEmails);
    if (emails.length === 0) {
      setToast({ type: "error", message: "Enter at least one employee email." });
      return;
    }

    try {
      setAssigning(true);
      const result = await coursesService.assignAdminLearningPathTemplate(selectedTemplateId, emails);
      setEmployeeEmails("");
      setToast({
        type: "success",
        message: `Assigned to ${result.assigned_count} employee${result.assigned_count === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: getErrorMessage(error, "Unable to assign the learning path."),
      });
    } finally {
      setAssigning(false);
    }
  };

  const renderCourseCard = (
    course: RecommendedCourse,
    action: "remove" | "add",
    keyPrefix: string
  ) => {
    const courseSkills = getCourseSkills(course);

    return (
      <article className="set-lp-course-card" key={`${keyPrefix}-${courseKey(course)}`}>
        <div className="course-card-top">
          <div className="course-thumb">
            {course.image ? <img src={course.image} alt="" /> : <FiBookOpen />}
          </div>
          <div className="course-title-block">
            <span className="course-level">{course.course_level || "General"}</span>
            <h3>{course.name}</h3>
          </div>
          <button
            className={`course-action ${action}`}
            title={action === "remove" ? "Remove course" : "Add course"}
            aria-label={`${action === "remove" ? "Remove" : "Add"} ${course.name}`}
            onClick={() => (action === "remove" ? removeCourse(course) : addCourse(course))}
          >
            {action === "remove" ? <FiTrash2 /> : <FiPlus />}
          </button>
        </div>

        <div className="course-facts">
          <span>
            <FiClock />
            Self-paced
          </span>
          {course.collection && <span>{course.collection}</span>}
          {course.url && (
            <a href={course.url} target="_blank" rel="noopener noreferrer">
              <FiLink />
              Open
            </a>
          )}
        </div>

        <p>{course.description || "Course description not provided."}</p>

        <div className="course-skills">
          {(courseSkills.length > 0 ? courseSkills : [course.category || focusTopic || "Learning"]).map(
            (tag) => (
              <span key={`${courseKey(course)}-${tag}`}>{tag}</span>
            )
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="admin-set-learning-path assessment-page">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <header className="page-header set-lp-page-header">
        <div>
          <h1>Set Learning Path</h1>
          <p className="subtitle">Create and assign AI-recommended course paths.</p>
        </div>
        <button className="btn set-lp-secondary-btn" onClick={resetEditor}>
          <FiPlus />
          New Path
        </button>
      </header>

      <section className="card set-lp-source-card">
        <div className="card-header source-documents-header">
          <h2>Source Documents</h2>
          <p className="hint">Resume and job description uploads are independent.</p>
        </div>

        <div className="source-documents-grid">
          <div className="source-document-card">
            <div className="source-document-icon">
              <FiFileText size={26} />
            </div>
            <div className="source-document-copy">
              <h3>Upload Resume</h3>
              <p>PDF, DOCX, TXT up to 10MB</p>
            </div>
            <FileUpload
              label="Upload Resume"
              onFileSelect={setResumeFile}
              accept=".pdf,.docx,.txt"
              allowedMimeTypes={sourceDocumentTypes}
              allowedTypeMessage="Only PDF, DOCX, and TXT files are allowed."
            />
          </div>

          <div className="source-document-card">
            <div className="source-document-icon">
              <FiBriefcase size={26} />
            </div>
            <div className="source-document-copy">
              <h3>Upload Job Description</h3>
              <p>PDF, DOCX, TXT up to 10MB</p>
            </div>
            <FileUpload
              label="Upload Job Description"
              onFileSelect={setJdFile}
              accept=".pdf,.docx,.txt"
              allowedMimeTypes={sourceDocumentTypes}
              allowedTypeMessage="Only PDF, DOCX, and TXT files are allowed."
            />
          </div>
        </div>

        <div className="card-actions">
          <button className="btn primary" onClick={handleExtract} disabled={extracting || recommending}>
            {extracting || recommending ? <FiRefreshCw className="spinning" /> : <FiSearch />}
            {extracting ? "Extracting..." : "Extract Role & Skills"}
          </button>
        </div>
      </section>

      <section className="card set-lp-extraction-card">
        <div className="card-header set-lp-section-header">
          <div>
            <h2>Extracted Role & Skills</h2>
            <p className="hint">Review levels before course recommendations are finalized.</p>
          </div>
          <button
            className="btn set-lp-secondary-btn"
            onClick={() => generateRecommendations()}
            disabled={recommending}
          >
            <FiRefreshCw className={recommending ? "spinning" : ""} />
            Refresh Recommendations
          </button>
        </div>

        <div className="set-lp-experience-field">
          <label htmlFor="set-learning-path-experience">Experience</label>
          <input
            id="set-learning-path-experience"
            value={experience}
            onChange={(event) => setExperience(event.target.value)}
            placeholder="Enter or edit experience band"
          />
        </div>

        <RoleSkillPlaceholder
          role={role}
          setRole={setRole}
          roleError={roleError}
          setRoleError={setRoleError}
          skills={skills}
          setSkills={setSkills}
          skillsError={skillsError}
          setSkillsError={setSkillsError}
          jdSkills={jdSkills}
          skillLevels={Object.fromEntries(
            Object.entries(skillConfig).map(([key, config]) => [key, config.extracted_level])
          )}
          skillConfig={skillConfig}
          skillPriorities={skillPriorities}
          onSkillConfigChange={updateSkillConfig}
          onSkillPriorityChange={(skill, priority) => {
            setSkillPriorities((current) => ({ ...current, [skill]: priority }));
            updateSkillConfig(skill, {
              priority,
              category: priority === "soft" ? "soft" : skillConfig[skill.toLowerCase()]?.category,
            });
          }}
        />
      </section>

      <section className="card set-lp-courses-card">
        <div className="card-header set-lp-section-header">
          <div>
            <h2>Recommended Courses</h2>
            <p className="hint">{courses.length} courses selected for this learning path.</p>
          </div>
        </div>

        {courses.length === 0 ? (
          <div className="set-lp-empty-state">No recommended courses yet.</div>
        ) : (
          <div className="set-lp-course-grid">
            {courses.map((course) => renderCourseCard(course, "remove", "selected"))}
          </div>
        )}
      </section>

      <section className="card set-lp-search-card">
        <div className="card-header">
          <h2>Search Additional Courses</h2>
        </div>

        <form className="set-lp-course-search" onSubmit={handleCourseSearch}>
          <label>
            <FiSearch />
            <input
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="Search by course, skill, or topic"
            />
          </label>
          <select
            value={courseLevel}
            onChange={(event) => setCourseLevel(event.target.value)}
            aria-label="Course level"
          >
            <option value="">Any level</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <button className="btn primary" disabled={courseSearching}>
            {courseSearching ? <FiRefreshCw className="spinning" /> : <FiSearch />}
            Search
          </button>
        </form>

        {courseSearchResults.length > 0 && (
          <div className="set-lp-course-grid search-results">
            {courseSearchResults.map((course) => renderCourseCard(course, "add", "search"))}
          </div>
        )}

        <form className="set-lp-manual-course" onSubmit={handleManualCourseAdd}>
          <div className="manual-course-grid">
            <input
              value={manualCourse.name}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Manual course title"
            />
            <input
              value={manualCourse.url}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, url: event.target.value }))
              }
              placeholder="Course URL"
            />
            <select
              value={manualCourse.course_level || ""}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, course_level: event.target.value }))
              }
              aria-label="Manual course level"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="">General</option>
            </select>
            <input
              value={manualCourse.topic}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, topic: event.target.value }))
              }
              placeholder="Skills covered"
            />
            <input
              value={manualCourse.category}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Category"
            />
            <input
              value={manualCourse.collection}
              onChange={(event) =>
                setManualCourse((current) => ({ ...current, collection: event.target.value }))
              }
              placeholder="Collection"
            />
          </div>
          <textarea
            value={manualCourse.description}
            onChange={(event) =>
              setManualCourse((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Short course description"
            rows={2}
          />
          <button className="btn set-lp-secondary-btn">
            <FiPlus />
            Add Manual Course
          </button>
        </form>
      </section>

      <div className="set-lp-final-grid">
        <section className="card set-lp-details-card">
          <div className="card-header">
            <h2>Learning Path Details</h2>
          </div>

          <div className="set-lp-details-fields">
            <label>
              <span>Name</span>
              <input
                value={pathName}
                onChange={(event) => setPathName(event.target.value)}
                placeholder="Learning path name"
              />
            </label>
            <label>
              <span>Focus</span>
              <input
                value={focusTopic}
                onChange={(event) => setFocusTopic(event.target.value)}
                placeholder="Role, skill group, or topic"
              />
            </label>
          </div>

          <button className="btn primary set-lp-save-btn" onClick={saveTemplate} disabled={saving}>
            {saving ? <FiRefreshCw className="spinning" /> : <FiSave />}
            {selectedTemplate ? "Save Changes" : "Save Learning Path"}
          </button>

          <div className="set-lp-saved-panel">
            <div className="set-lp-saved-head">
              <h3>Saved Paths</h3>
              <span>{templates.length}</span>
            </div>
            {templatesLoading ? (
              <div className="set-lp-empty-state compact">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="set-lp-empty-state compact">No saved paths.</div>
            ) : (
              <div className="set-lp-template-list">
                {templates.map((template) => (
                  <button
                    className={template.template_id === selectedTemplateId ? "active" : ""}
                    key={template.template_id}
                    onClick={() => loadTemplate(template)}
                  >
                    <div>
                      <strong>{template.name}</strong>
                      <span>
                        {template.course_count} courses
                        {formatDate(template.updated_at) && ` | ${formatDate(template.updated_at)}`}
                      </span>
                    </div>
                    <FiEdit2 />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card set-lp-assign-card">
          <div className="card-header">
            <h2>Assign Employees</h2>
          </div>
          <label className="set-lp-email-field">
            <span>Email IDs</span>
            <textarea
              value={employeeEmails}
              onChange={(event) => setEmployeeEmails(event.target.value)}
              placeholder="name@company.com, second@company.com"
              rows={7}
            />
          </label>
          <button className="btn primary set-lp-assign-btn" onClick={assignTemplate} disabled={assigning}>
            {assigning ? <FiRefreshCw className="spinning" /> : <FiMail />}
            Assign Learning Path
          </button>
        </section>
      </div>
    </div>
  );
};

export default AdminSetLearningPathContainer;
