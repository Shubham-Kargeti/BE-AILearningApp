import apiClient from "./services";
import type {
  OnboardingModule,
  EmployeeOnboardingProgressSummaryResponse,
  ModuleDetailResponse,
  QuizSubmitResponse,
  VideoProgressResponse,
} from "./onboarding_module.model";

export const onboardingModuleService = {
  listOnboardingModules: async (): Promise<OnboardingModule[]> => {
    const response = await apiClient.get<OnboardingModule[]>(
      "/onboarding-modules/onboarding-modules"
    );
    return response.data;
  },

  getEmployeeProgressSummary: async (
    candidateId: number
  ): Promise<EmployeeOnboardingProgressSummaryResponse> => {
    const response = await apiClient.get<EmployeeOnboardingProgressSummaryResponse>(
      "/onboarding-modules/employee-progress-summary",
      { params: { candidate_id: candidateId } }
    );
    return response.data;
  },

  getModuleDetail: async (
    candidateId: number,
    moduleId: number
  ): Promise<ModuleDetailResponse> => {
    const response = await apiClient.get<ModuleDetailResponse>(
      "/onboarding-modules/module-detail/" + moduleId,
      { params: { candidate_id: candidateId } }
    );
    return response.data;
  },

  submitModuleQuiz: async (
    candidateId: number,
    moduleId: number,
    answers: Array<{ question_id: number; answer: string }>
  ): Promise<QuizSubmitResponse> => {
    const response = await apiClient.post<QuizSubmitResponse>(
      `/onboarding-modules/module-detail/${moduleId}/submit-quiz?candidate_id=${candidateId}`,
      answers
    );
    return response.data;
  },

  updateVideoProgress: async (
    candidateId: number,
    moduleId: number,
    payload: {
      current_duration_seconds: number;
      total_duration_seconds: number;
      completion_percentage: number;
      is_completed: boolean;
    }
  ): Promise<VideoProgressResponse> => {
    const response = await apiClient.patch<VideoProgressResponse>(
      `/onboarding-modules/module-detail/${moduleId}/video-progress?candidate_id=${candidateId}`,
      payload
    );
    return response.data;
  },
};
