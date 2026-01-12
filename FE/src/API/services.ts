import axios from "axios";
import type { AxiosError, AxiosResponse } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/";
const API_V1 = `${API_BASE_URL}api/v1`;

const apiClient = axios.create({
  baseURL: API_V1,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  email: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
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
  created_at: string;
  updated_at: string;
  // NEW: Experience-based question configuration fields
  total_questions: number;
  question_type_mix: Record<string, number>;
  passing_score_threshold: number;
  auto_adjust_by_experience: boolean;
  difficulty_distribution: Record<string, number>;
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
  // NEW: Experience-based question configuration fields
  total_questions?: number;
  question_type_mix?: Record<string, number>;
  passing_score_threshold?: number;
  auto_adjust_by_experience?: boolean;
  difficulty_distribution?: Record<string, number>;
}

export interface Candidate {
  id: number;
  candidate_id: string;
  full_name: string;
  email: string;
  phone?: string;
  experience_level: string;
  skills: Record<string, string>;
  availability_percentage: number;
  created_at: string;
}

export interface CandidateCreateRequest {
  full_name: string;
  email: string;
  phone?: string;
  experience_level: string;
  skills: Record<string, string>;
  availability_percentage?: number;
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

export interface SkillExtractionResponse {
  role: string;
  skills: string[];
  experience_level?: string;
  extracted_text?: string;
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
}

export const authService = {
  login: async (email: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/login", { email });
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
      ...(subtopics.length > 0 && { subtopics: subtopics.join(",") }),
    });
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
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Record<string, string>;
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
    question_set_id: string;
    skill: string;
    level: string;
    score_percentage: number;
    correct_answers: number;
    total_questions: number;
    completed_at: string;
    time_taken_seconds: number;
    detailed_results: Array<{
      question_id: number;
      question_text: string;
      your_answer: string;
      correct_answer: string;
      is_correct: boolean;
      options: Array<{ option_id: string; text: string }>;
    }>;
  }> => {
    const response = await apiClient.get(`/questionset-tests/${sessionId}/results`);
    return response.data;
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

  getCandidate: async (candidateId: string): Promise<Candidate> => {
    const response = await apiClient.get<Candidate>(`/candidates/${candidateId}`);
    return response.data;
  },

  updateCandidate: async (
    candidateId: string,
    data: Partial<CandidateCreateRequest>
  ): Promise<Candidate> => {
    const response = await apiClient.patch<Candidate>(`/candidates/${candidateId}`, data);
    return response.data;
  },

  listCandidates: async (skip = 0, limit = 50): Promise<Candidate[]> => {
    const response = await apiClient.get<Candidate[]>(
      `/candidates?skip=${skip}&limit=${limit}`
    );
    return response.data;
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
      `/assessments/${assessmentId}`,
      data
    );
    return response.data;
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
  ): Promise<{ jd_id: string; title: string; extracted_text: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/upload-jd", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
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

export default apiClient;
