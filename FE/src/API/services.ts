import axios from "axios";
import type { AxiosError, AxiosResponse, AxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/";
const API_V1 = `${API_BASE_URL}api/v1`;

const apiClient = axios.create({
  baseURL: API_V1,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

type CacheEntry = {
  expiresAt: number;
  response: AxiosResponse;
};

const GET_CACHE_TTL_MS = 60_000;
const getCache = new Map<string, CacheEntry>();

const serializeParams = (params: AxiosRequestConfig["params"]) => {
  if (!params) return "";
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
      return;
    }
    search.append(key, String(value));
  });
  return search.toString();
};

const getCacheKey = (config: AxiosRequestConfig) => {
  const token = localStorage.getItem("authToken") || "";
  const base = config.baseURL || "";
  const url = config.url || "";
  const params = serializeParams(config.params);
  return `${base}${url}?${params}::${token}`;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = (config.method || "get").toLowerCase();
    if (method === "get" && !config.headers?.["x-cache-skip"]) {
      const key = getCacheKey(config);
      const cached = getCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        config.adapter = async () => ({
          ...cached.response,
          config,
        });
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const method = (response.config.method || "get").toLowerCase();
    if (method === "get" && !response.config.headers?.["x-cache-skip"]) {
      const key = getCacheKey(response.config);
      getCache.set(key, {
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
        response,
      });
    } else if (["post", "put", "patch", "delete"].includes(method)) {
      getCache.clear();
    }

    return response;
  },
  (error: AxiosError) => {
    const requestUrl = error.config?.url || "";
    if (error.response?.status === 401 && !requestUrl.includes("/auth/login")) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role?: "admin" | "candidate";
  candidate_id?: string;
  login_streak?: {
    current_streak: number;
    longest_streak: number;
  };
}

export interface UserProfile {
  topic: string;
  subtopics: string[];
  level: string;
}

export interface Assessment {
  id: number;
  assessment_id: string;
  title: string;
  description?: string;
  job_title?: string;
  jd_id?: string;
  required_skills: Record<string, string>;
  required_roles: string[];
  question_set_id?: string;
  assessment_method: string;
  duration_minutes: number;
  is_questionnaire_enabled: boolean;
  is_interview_enabled: boolean;
  is_active: boolean;
  is_published: boolean;
  is_expired: boolean;
  expires_at?: string;
  candidate_info?: {
    name?: string;
    email?: string;
    current_role?: string;
    experience?: string;
  };
  skill_priorities?: Record<string, "must-have" | "good-to-have" | "resume-based" | "soft">;
  skill_configuration?: Record<string, any>;
  screening_questions?: string[];
  manual_questions?: AssessmentManualQuestion[];
  questionnaire_config?: AssessmentQuestionnaireConfig;
  parent_assessment_id?: number | null;
  created_at: string;
  updated_at: string;
  // NEW: Experience-based question configuration fields
  total_questions: number;
  question_type_mix: Record<string, number>;
  passing_score_threshold: number;
  auto_adjust_by_experience: boolean;
  difficulty_distribution: Record<string, number>;
  generation_policy?: {
    mode: "rag" | "llm" | "mix";
    rag_pct: number;
    llm_pct: number;
  };
  // Session statistics (for admin dashboard)
  total_sessions?: number;
  completed_sessions?: number;
  in_progress_sessions?: number;
  // Admin-only: generated questions from RAG ingestion
  generated_questions?: Array<{
    id?: number | string;
    question_type?: string;
    question_text: string;
    options?: Array<{ option_id: string; text: string }>;
  }>;
}

export interface AssessmentQuestionnaireConfig {
  mcq?: number;
  coding?: number;
  architecture?: number;
  reasoning?: number;
  scenario?: number;
  ba?: number;
  doc_id?: string;
  role_type?: string;
}

export interface AssessmentManualQuestion {
  question_text: string;
  type: string;
  difficulty: string;
  skill?: string;
  options?: string[];
  correct_answer?: string;
  code_template?: string;
  constraints?: string;
  test_cases?: string;
  time_limit?: number;
}

export interface AssessmentCreateRequest {
  title: string;
  description?: string;
  job_title?: string;
  jd_id?: string;
  required_skills?: Record<string, string>;
  required_roles?: string[];
  question_set_id?: string;
  duration_minutes?: number;
  is_questionnaire_enabled?: boolean;
  is_interview_enabled?: boolean;
  expires_at?: string;
  skill_priorities?: Record<string, "must-have" | "good-to-have" | "resume-based" | "soft">;
  skill_configuration?: Record<string, any>;
  is_draft?: boolean;
  is_published?: boolean;
  screening_questions?: string[];
  manual_questions?: AssessmentManualQuestion[];
  candidate_info?: {
    name?: string;
    email?: string;
    current_role?: string;
    experience?: string;
  };
  questionnaire_config?: AssessmentQuestionnaireConfig;
  // NEW: Experience-based question configuration fields
  total_questions?: number;
  question_type_mix?: Record<string, number>;
  passing_score_threshold?: number;
  auto_adjust_by_experience?: boolean;
  difficulty_distribution?: Record<string, number>;
  parent_assessment_id?: number;
  generation_policy?: {
    mode: "rag" | "llm" | "mix";
    rag_pct: number;
    llm_pct: number;
  };
}

export interface Candidate {
  id: number;
  candidate_id: string;
  full_name: string;
  email: string;
  password?: string;
  phone?: string;
  current_role?: string;
  team?: string;
  location?: string;
  education?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  experience_years?: string;
  experience_level: string;
  skills: Record<string, string>;
  availability_percentage: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
  source?: string;
}

export interface CandidatePendingAssessment {
  application_id: string;
  assessment_id: string;
  title: string;
  description?: string;
  job_title?: string;
  duration_minutes: number;
  total_questions: number;
  required_skills: Record<string, string>;
  question_set_id?: string | null;
  assessment_method?: string | null;
  is_questionnaire_enabled: boolean;
  is_interview_enabled: boolean;
  expires_at?: string | null;
  is_expired: boolean;
  status: string;
  applied_at?: string | null;
  started_at?: string | null;
  session_id?: string | null;
  role_applied_for?: string | null;
}

export interface CandidateCreateRequest {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  current_role?: string;
  team?: string;
  location?: string;
  education?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  experience_years?: string;
  experience_level: string;
  skills: Record<string, string>;
  availability_percentage?: number;
}

export type CandidateUpdateRequest = Partial<CandidateCreateRequest> & {
  created_at?: string;
};

export interface BulkCandidateCreateItem {
  email: string;
  created: boolean;
  candidate_id?: string | null;
  password?: string | null;
  message?: string | null;
}

export interface BulkCandidateCreateResponse {
  created: BulkCandidateCreateItem[];
  skipped: string[];
  errors: BulkCandidateCreateItem[];
}

export interface OnboardingCandidateStatusResponse {
  candidate_id: string;
  email: string;
  full_name: string;
  created_at: string;
  experience_level: string;
  onboarding_email_sent: boolean;
  overall_status: "completed" | "in_progress" | "not_started";
}

export interface EmailValidationResponse {
  email: string;
  is_available: boolean;
  existing_candidate_id?: string;
  message: string;
}

export interface MCQOption {
  option_id: string;
  text: string;
}

export interface MCQQuestion {
  question_id: number;
  question_text: string;
  options: MCQOption[];
  correct_answer?: string;
}

export interface QuestionSet {
  question_set_id: string;
  skill: string;
  level: string;
  total_questions: number;
  created_at: string;
  questions: MCQQuestion[];
}

export interface QuizStartResponse {
  session_id: string;
  question_set_id: string;
  skill: string;
  level: string;
  total_questions: number;
  started_at: string;
  questions: MCQQuestion[];
}

export interface QuizSubmitRequest {
  session_id: string;
  answers: { question_id: number; selected_answer: string }[];
}

export interface QuizResultResponse {
  session_id: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  score_percentage: number;
  passed: boolean;
  completed_at: string;
}

export interface QuestionFeedbackItem {
  feedback_id: number;
  question_id: number;
  text: string;
  created_at: string;
}

export type QuestionFeedbackMap = Record<string, QuestionFeedbackItem[]>;

export interface SessionFeedbackResponse {
  feedback_id: number;
  session_id: string;
  llm_feedback_text: string;
  feedback_text: string;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillExtractionResponse {
  role?: string;
  skills?: Array<string | { skill_name?: string }>;
  experience_level?: string;
  extracted_text?: string;
  extracted_skills?: Array<string | { skill_name?: string }>;
  skill_durations?: Record<string, number>;
}

export interface RoleExtractionResponse {
  role?: string;
  // extracted_role?: string;
  role_type?: string;
  category?: string;
  role_category?: string;
  // question_type_mix?: Record<string, number>;
  // questionnaire_config?: AssessmentQuestionnaireConfig;
}

export interface ExtractedSkill {
  skill_name: string;
  canonical_name?: string;
  proficiency_level: string;
  category: string;
  frequency: number;
  confidence: number;
  inferred?: boolean;
  source?: string;
  evidence?: string;
  priority?: string;
  matched_with_jd?: boolean;
}

export interface DocumentSkillExtractionResponse {
  file_id: string;
  original_filename: string;
  document_category: string;
  extracted_skills: ExtractedSkill[];
  total_skills_found: number;
  extraction_preview: string;
}

export interface AdminBulkSkillExtractionResponse {
  success: boolean;
  message: string;
  documents_processed: number;
  total_unique_skills: number;
  extracted_skills: ExtractedSkill[];
  documents: DocumentSkillExtractionResponse[];
  extraction_summary: {
    skills_by_category?: Record<string, number>;
    proficiency_distribution?: Record<string, number>;
    total_skills_found?: number;
    role?: string;
    role_type?: string;
    role_seniority?: string;
    role_expectations?: string[];
    inferred_competencies?: string[];
    extraction_strategy?: string;
    extraction_confidence?: number;
    overlapping_skills?: string[];
    jd_skill_count?: number;
    resume_skill_count?: number;
  };
  timestamp?: string;
}

export interface RecommendedCourse {
  name: string;
  topic: string;
  url: string;
  score: number;
  image?: string;
  collection: string;
  category: string;
  description: string;
  course_level?: string;
}

export interface AssignedLearningPath {
  id: number;
  learning_path_id: string;
  session_id: string;
  assessment_id?: string | null;
  assessment_title?: string | null;
  employee_email: string;
  employee_name?: string | null;
  topic: string;
  recommended_courses: RecommendedCourse[];
  course_count: number;
  created_at: string;
  updated_at: string;
}

export interface LearningPathEmployeeSummary {
  employee_email: string;
  employee_name?: string | null;
  learning_path_count: number;
  last_assigned_at: string;
}

export const authService = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("profileCompleted");
    localStorage.removeItem("userProfile");
  },
};

export const quizService = {
  generateMCQs: async (
    topic: string,
    level: string,
    subtopics: string[] = []
  ): Promise<QuestionSet> => {
    const params = new URLSearchParams({
      topic,
      level,
    });
    subtopics.forEach((subtopic) => params.append("subtopics", subtopic));
    const response = await apiClient.get<QuestionSet>(`/generate-mcqs/?${params}`);
    return response.data;
  },

  startQuiz: async (questionSetId: string, candidateInfo?: { candidate_name?: string; candidate_email?: string }): Promise<QuizStartResponse> => {
    const token = localStorage.getItem("authToken");
    if (token) {
      const response = await apiClient.post<QuizStartResponse>("/questionset-tests/start", {
        question_set_id: questionSetId,
      });
      return response.data;
    } else {
      const payload: any = { question_set_id: questionSetId };
      if (candidateInfo?.candidate_name) payload.candidate_name = candidateInfo.candidate_name;
      if (candidateInfo?.candidate_email) payload.candidate_email = candidateInfo.candidate_email;
      const response = await apiClient.post<QuizStartResponse>("/questionset-tests/start/anonymous", payload);
      return response.data;
    }
  },

  submitQuiz: async (
    sessionId: string,
    answers: { question_id: number; selected_answer: string }[],
    forceAnonymous: boolean = false
  ): Promise<QuizResultResponse> => {
    const token = localStorage.getItem("authToken");
    const payload = { session_id: sessionId, answers };
    const response = (!token || forceAnonymous)
      ? await apiClient.post<QuizResultResponse>("/questionset-tests/submit/anonymous", payload)
      : await apiClient.post<QuizResultResponse>("/questionset-tests/submit", payload);
    return response.data;
  },

  getSubSkills: async (topic: string): Promise<string[]> => {
    const response = await apiClient.get<string[]>(`/subskills/?topic=${topic}`);
    return response.data;
  },

  getTestResults: async (sessionId: string): Promise<{
    session_id: string;
    score_percentage: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
    score_released_at: string;
    overall_feedback?: string | null;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Record<string, string>;
      points?: number;
      suggestion?: string;
      explanation?: string;
    }>;
  }> => {
    const response = await apiClient.get(`/test-sessions/${sessionId}/results`);
    return response.data;
  },

  listTestSessions: async (skip = 0, limit = 50): Promise<Array<{
    session_id: string;
    question_set_id: string;
    user_id: number | null;
    status: string;
    score_percentage: number | null;
    correct_answers: number | null;
    total_questions: number;
    started_at: string;
    completed_at: string | null;
  }>> => {
    const response = await apiClient.get(`/test-sessions?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  listMyTestSessions: async (skip = 0, limit = 50): Promise<Array<{
    session_id: string;
    question_set_id: string | null;
    skill: string | null;
    level: string | null;
    total_questions: number;
    correct_answers: number | null;
    score_percentage: number | null;
    is_completed: boolean;
    is_scored: boolean;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
  }>> => {
    const response = await apiClient.get(`/questionset-tests/my-sessions?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  listAssessmentTestSessions: async (assessmentId: string, skip = 0, limit = 50): Promise<Array<{
    session_id: string;
    candidate_name: string | null;
    candidate_email: string | null;
    total_questions: number;
    correct_answers: number | null;
    score_percentage: number | null;
    is_completed: boolean;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
  }>> => {
    const response = await apiClient.get(`/questionset-tests/assessment/${assessmentId}/sessions?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  getQuestionSetTestResults: async (sessionId: string): Promise<{
    session_id: string;
    assessment_title?: string;
    assessment_description?: string;
    job_title?: string;
    question_set_id: string;
    skill: string;
    level: string;
    score_percentage: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
    time_taken_seconds: number;
    overall_feedback?: string | null;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Array<{ option_id: string; text: string }>;
      points: number;
      suggestion?: string;
      explanation?: string;
    }>;
  }> => {
    const response = await apiClient.get(`/questionset-tests/${sessionId}/results`);
    return response.data;
  },

  getQuestionFeedback: async (sessionId: string): Promise<QuestionFeedbackMap> => {
    const response = await apiClient.get<{ feedback: QuestionFeedbackMap }>(
      `/questionset-tests/feedback/${sessionId}`,
      { headers: { "x-cache-skip": "true" } }
    );
    return response.data.feedback || {};
  },

};

export const candidateService = {
  checkEmail: async (email: string): Promise<EmailValidationResponse> => {
    const response = await apiClient.get<EmailValidationResponse>(
      `/candidates/check-email?email=${encodeURIComponent(email)}`
    );
    return response.data;
  },

  createCandidate: async (data: CandidateCreateRequest): Promise<Candidate> => {
    const response = await apiClient.post<Candidate>("/candidates", data);
    return response.data;
  },

  createBulkCandidates: async (
    emails: string[]
  ): Promise<BulkCandidateCreateResponse> => {
    const response = await apiClient.post<BulkCandidateCreateResponse>(
      "/candidates/bulk",
      { emails }
    );
    return response.data;
  },

  getOnboardingCandidatesStatus: async (skipCache = false): Promise<OnboardingCandidateStatusResponse[]> => {
    const response = await apiClient.get<OnboardingCandidateStatusResponse[]>(
      "/candidates/onboarding-status",
      skipCache ? { headers: { "x-cache-skip": "true" } } : undefined
    );
    return response.data;
  },

  sendCandidateCredentialsEmail: async (candidateId: string): Promise<{ mailto_url: string }> => {
    const response = await apiClient.post<{ mailto_url: string }>(
      `/candidates/${candidateId}/send-credentials-email`
    );
    return response.data;
  },

  getCandidate: async (candidateId: string): Promise<Candidate> => {
    const response = await apiClient.get<Candidate>(`/candidates/${candidateId}`);
    return response.data;
  },

  updateCandidate: async (
    candidateId: string,
    data: CandidateUpdateRequest
  ): Promise<Candidate> => {
    const response = await apiClient.patch<Candidate>(`/candidates/${candidateId}`, data);
    return response.data;
  },

  listCandidates: async (skip = 0, limit = 50, search = "", source?: string, skipCache = false): Promise<Candidate[]> => {
    const params = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (source) {
      params.set("source", source);
    }
    const response = await apiClient.get<Candidate[]>(
      `/candidates?${params.toString()}`,
      skipCache ? { headers: { "x-cache-skip": "true" } } : undefined
    );
    return response.data;
  },

  getMyAssessments: async (): Promise<Array<{
    assessment_id: string;
    title: string;
    description?: string;
    job_title?: string;
    duration_minutes: number;
    total_questions: number;
    is_published: boolean;
    is_expired: boolean;
    expires_at?: string;
    created_at: string;
    session_id?: string;
    is_completed: boolean;
    score_percentage?: number;
    completed_at?: string;
    attempts_count: number;
  }>> => {
    const response = await apiClient.get("/candidates/my-assessments");
    return response.data;
  },
  getMyPendingAssessments: async (): Promise<CandidatePendingAssessment[]> => {
    const response = await apiClient.get<CandidatePendingAssessment[]>(
      "/candidates/my-pending-assessments",
      { headers: { "x-cache-skip": "true" } }
    );
    return response.data;
  },
  getEmployeeLearningPath: async () => {
    const response = await apiClient.get("/learning-path/employee");
    return response.data as { learning_paths: AssignedLearningPath[] };
  },
  getEmployeeLearningPathDetail: async (learningPathId: string): Promise<AssignedLearningPath> => {
    const response = await apiClient.get(
      `/learning-path/employee/${encodeURIComponent(learningPathId)}`
    );
    return response.data as AssignedLearningPath;
  },
};

export const assessmentService = {
  listAssessments: async (
    isPublished?: boolean,
    skip = 0,
    limit = 50,
    showAll = false
  ): Promise<Assessment[]> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
      ...(isPublished !== undefined && { is_published: isPublished.toString() }),
      ...(showAll && { show_all: "true" }),
    });
    const response = await apiClient.get<Assessment[]>(`/assessments?${params}`);
    return response.data;
  },

  getAssessment: async (assessmentId: string): Promise<Assessment> => {
    const response = await apiClient.get<Assessment>(`/assessments/${assessmentId}`);
    return response.data;
  },

  getVariants: async (assessmentId: number | string): Promise<Assessment[]> => {
    const response = await apiClient.get<Assessment[]>(`/assessments/variants/${assessmentId}`);
    return response.data;
  },

  getById: async (assessmentId: string): Promise<Assessment> => {
    const response = await apiClient.get<Assessment>(`/assessments/${assessmentId}`);
    return response.data;
  },

  createAssessment: async (data: AssessmentCreateRequest): Promise<Assessment> => {
    const response = await apiClient.post<Assessment>("/assessments", data);
    return response.data;
  },

  updateAssessment: async (
    assessmentId: string,
    data: Partial<AssessmentCreateRequest>
  ): Promise<Assessment> => {
    const response = await apiClient.put<Assessment>(
      `/assessments/${assessmentId}/metadata`,
      data
    );
    return response.data;
  },

  deleteQuestion: async (questionId: number): Promise<void> => {
    await apiClient.delete(`/assessments/questions/${questionId}`);
  },

  deleteAssessment: async (assessmentId: string): Promise<void> => {
    await apiClient.delete(`/assessments/${assessmentId}`);
  },

  publishAssessment: async (assessmentId: string): Promise<Assessment> => {
    const response = await apiClient.post<Assessment>(
      `/assessments/${assessmentId}/publish`
    );
    return response.data;
  },
  submitScreeningResponses: async (
    assessmentId: string,
    payload: { answers: string[]; candidate_session_id?: string }
  ): Promise<any> => {
    const response = await apiClient.post(`/assessments/${assessmentId}/screening-responses`, payload);
    return response.data;
  },
};

export const uploadService = {
  uploadJD: async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ message: string; jd_id: string; title?: string; extracted_text?: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/upload-jd/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return response.data;
  },
  submitQuestionFeedback: async (
    sessionId: string,
    questionId: number,
    feedback: string
  ): Promise<{
    message: string;
    feedback_id: number;
  }> => {
    const response = await apiClient.post("/admin/feedback", {
      session_id: sessionId,
      question_id: questionId,
      feedback,
    });
    return response.data;
  },

  extractSkills: async (
    resumeFile: File,
    _jdFile?: File,
    _requirementFile?: File,
    _clientDocFile?: File
  ): Promise<SkillExtractionResponse> => {
    const formData = new FormData();
    formData.append("file", resumeFile);

    const response = await apiClient.post<SkillExtractionResponse>(
      "/admin/extract-skills?doc_type=cv",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  extractSkillsBulk: async (
    files: File[],
    docType: string = "jd"
  ): Promise<AdminBulkSkillExtractionResponse> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await apiClient.post<AdminBulkSkillExtractionResponse>(
      `/admin/extract-skills-bulk?doc_type=${encodeURIComponent(docType)}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  extractCandidateSkills: async (
    jdFile: File,
    resumeFile: File
  ): Promise<AdminBulkSkillExtractionResponse> => {
    const formData = new FormData();
    formData.append("jd_file", jdFile);
    formData.append("resume_file", resumeFile);

    const response = await apiClient.post<AdminBulkSkillExtractionResponse>(
      "/admin/extract-skills-candidate",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  extractSkillsFromJD: async (
    jdFile: File
  ): Promise<AdminBulkSkillExtractionResponse> => {
    const formData = new FormData();
    formData.append("file", jdFile);

    const response = await apiClient.post<AdminBulkSkillExtractionResponse>(
      "/admin/extract-skills?doc_type=jd",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  extractRoleFromJD: async (
    jdFile: File
  ): Promise<RoleExtractionResponse> => {
    const formData = new FormData();
    formData.append("file", jdFile);

    const response = await apiClient.post<RoleExtractionResponse>(
      "/admin/extract-role?doc_type=jd",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  uploadQuestionDoc: async (
    file: File,
    assessmentId?: string,
    onProgress?: (percent: number) => void
  ): Promise<{
    message: string;
    doc_id: string;
    s3_key: string;
    task_id?: string;
    indexed?: boolean;
    chunks?: number;
    warning?: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);

    const qs = assessmentId ? `?assessment_id=${encodeURIComponent(assessmentId)}` : "";

    const response = await apiClient.post(`/admin/question-docs/upload${qs}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });

    return response.data;
  },

  getIngestionStatus: async (taskIdOrDocId: string) => {
    const response = await apiClient.get(`/admin/question-docs/status/${encodeURIComponent(taskIdOrDocId)}`);
    return response.data as {
      task_id: string;
      task_name: string;
      status: string;
      result?: any;
      error?: string;
      related_id?: string;
      created_at?: string;
      updated_at?: string;
    };
  },
};

export const questionGenService = {
  listDrafts: async (reviewState: string = "draft") => {
    const response = await apiClient.get<any[]>(`/question-bank?review_state=${encodeURIComponent(reviewState)}`);
    return response.data;
  },

  publishDraft: async (id: number) => {
    const response = await apiClient.post<any>(`/question-bank/${id}/publish`);
    return response.data;
  },

  indexJD: async (jdId: string) => {
    const response = await apiClient.post(`/rag/index/jd/${encodeURIComponent(jdId)}`);
    return response.data;
  },

  indexAllJDs: async () => {
    const response = await apiClient.post(`/rag/index/jd/all`);
    return response.data;
  },

  startGeneration: async (topic: string, count: number = 5, min_hits: number = 1) => {
    const response = await apiClient.post(`/question-generation/start`, { topic, count, min_hits });
    return response.data;
  },

  startGenerationForAssessment: async (assessmentId: string, count: number = 5, mode: string = 'rag', rag_pct: number = 100, min_hits: number = 1) => {
    const response = await apiClient.post(`/question-generation/start`, { assessment_id: assessmentId, count, mode, rag_pct, min_hits });
    return response.data as { task_id: string; status: string };
  },

  getGenerationStatus: async (taskId: string) => {
    const response = await apiClient.get(`/question-generation/status/${encodeURIComponent(taskId)}`);
    return response.data;
  },
};

export const skillsService = {
  getSkillSuggestions: async (query: string): Promise<string[]> => {
    const response = await apiClient.get<string[]>(
      `/skills/suggestions?query=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  getRoleSuggestions: async (query: string): Promise<string[]> => {
    const response = await apiClient.get<string[]>(
      `/skills/roles?query=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  getAllSkills: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>("/skills");
    return response.data;
  },
};

export const coursesService = {
  getRecommendedCourses: async (
    topic: string,
    marks?: number
  ): Promise<{ recommended_courses: RecommendedCourse[] }> => {
    const params = new URLSearchParams({ topic });
    if (marks !== undefined) {
      params.append("marks", marks.toString());
    }
    const response = await apiClient.get(`/recommended-courses?${params}`);
    return response.data;
  },

  getLearningPath: async (
    sessionId: string
  ): Promise<{
    topic: string;
    recommended_courses: RecommendedCourse[]
  }> => {
    const response = await apiClient.get(`/learning-path/${sessionId}`);
    return response.data;
  },
  pushLearningPath: async (data: {
    session_id: string;
    topic: string;
    recommended_courses: RecommendedCourse[];
  }) => {
    const response = await apiClient.post(
      "/learning-path/push-to-employee",
      data
    );
    return response.data as {
      message: string;
      email: string;
      learning_path: AssignedLearningPath;
      assigned_count: number;
    };
  },
  saveSelfAssessedLearningPath: async (sessionId: string) => {
    const response = await apiClient.post("/learning-path/self", {
      session_id: sessionId,
    });
    return response.data as {
      message: string;
      learning_path: AssignedLearningPath;
    };
  },
  listLearningPathEmployees: async () => {
    const response = await apiClient.get("/learning-path/admin/employees");
    return response.data as { employees: LearningPathEmployeeSummary[] };
  },
  listEmployeeLearningPathsForAdmin: async (employeeEmail: string) => {
    const response = await apiClient.get(
      `/learning-path/admin/employee/${encodeURIComponent(employeeEmail)}`
    );
    return response.data as {
      employee_email: string;
      learning_path_count: number;
      learning_paths: AssignedLearningPath[];
    };
  },
};

export const dashboardService = {
  getUserDashboard: async (): Promise<{
    test_history: any[];
    stats: { total_tests: number; average_score: number };
  }> => {
    const response = await apiClient.get("/dashboard");
    return response.data;
  },

  getAdminStats: async (): Promise<{
    total_assessments: number;
    total_candidates: number;
    pending_assessments: number;
    completed_assessments: number;
  }> => {
    const response = await apiClient.get("/admin/dashboard");
    return response.data;
  },
};

export const assessmentProgressService = {
  saveProgress: async (progress: {
    candidate_email: string;
    candidate_name?: string;
    session_id?: string;
    question_set_id?: string;
    assessment_title?: string;
    skill?: string;
    level?: string;
    current_question_index: number;
    answers: Record<string, any>;
    question_status: Record<string, any>;
    expired_questions: number[];
    remaining_time_seconds?: number;
    initial_duration_seconds?: number;
    total_questions: number;
    is_completed?: boolean;
  }): Promise<any> => {
    const response = await apiClient.post("/assessment-progress/save", progress);
    return response.data;
  },

  loadProgress: async (email: string): Promise<{
    candidate_email: string;
    candidate_name?: string;
    session_id?: string;
    question_set_id?: string;
    assessment_title?: string;
    skill?: string;
    level?: string;
    current_question_index: number;
    answers: Record<string, any>;
    question_status: Record<string, any>;
    expired_questions: number[];
    remaining_time_seconds?: number;
    initial_duration_seconds?: number;
    total_questions: number;
    is_completed: boolean;
    last_saved_at: string;
  } | null> => {
    const response = await apiClient.get(`/assessment-progress/load/${encodeURIComponent(email)}`);
    return response.data;
  },

  deleteProgress: async (email: string): Promise<void> => {
    await apiClient.delete(`/assessment-progress/delete/${encodeURIComponent(email)}`);
  },

  markComplete: async (email: string): Promise<void> => {
    await apiClient.post(`/assessment-progress/complete/${encodeURIComponent(email)}`);
  },
};

// Assessment Results Service (Admin)
export const assessmentResultsService = {
  getAssessmentDetailedResults: async (
    assessmentId: string,
    includeIncomplete: boolean = false
  ): Promise<Array<{
    session_id: string;
    candidate_name: string | null;
    candidate_email: string | null;
    assessment_id: string;
    assessment_title: string;
    job_title: string | null;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    total_questions: number;
    answered_questions: number;
    correct_answers: number;
    score_percentage: number | null;
    is_completed: boolean;
    is_scored: boolean;
    questions: Array<{
      question_id: number;
      question_text: string;
      question_type?: string | null;
      topic: string | null;
      difficulty: string | null;
      candidate_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Record<string, string> | null;
      time_taken_seconds: number | null;
    }>;
    application_status: string | null;
  }>> => {
    const response = await apiClient.get(
      `/admin/assessment-results/${assessmentId}/results`,
      { params: { include_incomplete: includeIncomplete } }
    );
    return response.data;
  },

  getSessionDetailedResult: async (sessionId: string): Promise<{
    session_id: string;
    candidate_name: string | null;
    candidate_email: string | null;
    assessment_id: string;
    assessment_title: string;
    job_title: string | null;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    total_questions: number;
    answered_questions: number;
    correct_answers: number;
    score_percentage: number | null;
    is_completed: boolean;
    is_scored: boolean;
    session_feedback: string | null;
    session_feedback_status: string | null;
    questions: Array<{
      question_id: number;
      question_text: string;
      question_type?: string | null;
      topic: string | null;
      difficulty: string | null;
      candidate_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Record<string, string> | null;
      time_taken_seconds: number | null;
    }>;
    application_status: string | null;
  }> => {
    const response = await apiClient.get(`/admin/assessment-results/session/${sessionId}`);
    return response.data;
  },

  getSessionFeedback: async (sessionId: string): Promise<SessionFeedbackResponse> => {
    const response = await apiClient.get<SessionFeedbackResponse>(
      `/admin/assessment-results/session/${sessionId}/feedback`,
      { headers: { "x-cache-skip": "true" } }
    );
    return response.data;
  },

  generateSessionFeedback: async (sessionId: string): Promise<SessionFeedbackResponse> => {
    const response = await apiClient.post<SessionFeedbackResponse>(
      `/admin/assessment-results/session/${sessionId}/feedback/generate`
    );
    return response.data;
  },

  submitSessionFeedback: async (
    sessionId: string,
    feedbackText: string
  ): Promise<SessionFeedbackResponse> => {
    const response = await apiClient.put<SessionFeedbackResponse>(
      `/admin/assessment-results/session/${sessionId}/feedback`,
      { feedback_text: feedbackText }
    );
    return response.data;
  },

  shareSessionResult: async (
    sessionId: string,
    data: {
      recipient_emails: string[];
      include_answers?: boolean;
      message?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    share_link: string | null;
  }> => {
    const response = await apiClient.post(
      `/admin/assessment-results/session/${sessionId}/share`,
      data
    );
    return response.data;
  },

  updateCandidateStatus: async (
    sessionId: string,
    newStatus: string
  ): Promise<{
    success: boolean;
    message: string;
    application_id: string;
    new_status: string;
  }> => {
    const response = await apiClient.patch(
      `/admin/assessment-results/session/${sessionId}/status`,
      null,
      { params: { new_status: newStatus } }
    );
    return response.data;
  },

  updateAnswerCorrectness: async (
    sessionId: string,
    questionId: number,
    isCorrect: boolean
  ): Promise<{
    success: boolean;
    session_id: string;
    question_id: number;
    is_correct: boolean;
    correct_answers: number;
    score_percentage: number | null;
  }> => {
    const response = await apiClient.patch(
      `/admin/assessment-results/session/${sessionId}/answer/${questionId}`,
      { is_correct: isCorrect }
    );
    return response.data;
  },

  
};

export default apiClient;
