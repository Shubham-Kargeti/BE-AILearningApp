import apiClient from "./services";
import type {
  OnboardingModule,
  OnboardingModuleResponse,
  OnboardingModuleKeyConceptResponse,
  EmployeeOnboardingProgressSummaryResponse,
  ModuleDetailResponse,
  QuizSubmitResponse,
  VideoProgressResponse,
  CandidateChecklistResponse,
  CertificateResponse,
  CertificateDataResponse,
} from "./onboarding_module.model";

export const onboardingModuleService = {
  listOnboardingModules: async (): Promise<OnboardingModule[]> => {
    const response = await apiClient.get<OnboardingModule[]>(
      "/onboarding-modules/onboarding-modules"
    );
    return response.data;
  },

  getEmployeeProgressSummary: async (
    candidateId: string
  ): Promise<EmployeeOnboardingProgressSummaryResponse> => {
    const response = await apiClient.get<EmployeeOnboardingProgressSummaryResponse>(
      "/onboarding-modules/employee-progress-summary",
      { params: { candidate_id: candidateId } }
    );
    return response.data;
  },

  getModuleDetail: async (
    candidateId: string,
    moduleId: number
  ): Promise<ModuleDetailResponse> => {
    const response = await apiClient.get<ModuleDetailResponse>(
      "/onboarding-modules/module-detail/" + moduleId,
      { params: { candidate_id: candidateId } }
    );
    return response.data;
  },

  submitModuleQuiz: async (
    candidateId: string,
    moduleId: number,
    answers: Array<{ question_id: number; answer: string }>
  ): Promise<QuizSubmitResponse> => {
    const response = await apiClient.post<QuizSubmitResponse>(
      `/onboarding-modules/module-detail/${moduleId}/submit-quiz?candidate_id=${candidateId}`,
      answers
    );
    return response.data;
  },

  getRetryQuiz: async (
    candidateId: string,
    moduleId: number,
    excludeIds: number[] = []
  ): Promise<ModuleDetailResponse["quiz_questions"]> => {
    const params: Record<string, string> = { candidate_id: candidateId };
    if (excludeIds.length) {
      params.exclude_ids = excludeIds.join(",");
    }
    const response = await apiClient.get<ModuleDetailResponse["quiz_questions"]>(
      `/onboarding-modules/module-detail/${moduleId}/retry-quiz`,
      { params }
    );
    return response.data;
  },

  updateVideoProgress: async (
    candidateId: string,
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

  getActionChecklist: async (
    candidateId: string,
    moduleId: number
  ): Promise<CandidateChecklistResponse> => {
    const response = await apiClient.get<CandidateChecklistResponse>(
      `/onboarding-modules/module-detail/${moduleId}/action-checklist?candidate_id=${candidateId}`
    );
    return response.data;
  },

  saveActionChecklist: async (
    candidateId: string,
    moduleId: number,
    completedItemIds: number[]
  ): Promise<CandidateChecklistResponse> => {
    const response = await apiClient.post<CandidateChecklistResponse>(
      `/onboarding-modules/module-detail/${moduleId}/action-checklist?candidate_id=${candidateId}`,
      completedItemIds
    );
    return response.data;
  },

  generateCertificate: async (
    candidateId: string,
    moduleId: number
  ): Promise<CertificateResponse> => {
    const response = await apiClient.post<CertificateResponse>(
      `/onboarding-modules/module-detail/${moduleId}/generate-certificate?candidate_id=${candidateId}`
    );
    return response.data;
  },

  getCertificate: async (
    candidateId: string,
    moduleId: number
  ): Promise<CertificateDataResponse> => {
    const response = await apiClient.get<CertificateDataResponse>(
      `/onboarding-modules/certificate/${candidateId}?module_id=${moduleId}`
    );
    return response.data;
  },

   shareCertificateEmail: async (
     candidateId: string,
     moduleId: number
   ): Promise<{ mailto_url: string }> => {
     const response = await apiClient.post<{ mailto_url: string }>(
       `/onboarding-modules/certificate/${candidateId}/share?module_id=${moduleId}`
     );
     return response.data;
   },

   sendCertificateEmail: async (
      candidateId: string,
      moduleId: number
    ): Promise<{ sent: boolean; message: string }> => {
      const response = await apiClient.post<{ sent: boolean; message: string }>(
        `/onboarding-modules/certificate/${candidateId}/send-email?module_id=${moduleId}`
      );
      return response.data;
    },

    updateAdminModule: async (moduleId: number, data: {
      title?: string;
      description?: string;
      passing_criteria?: number;
      icon?: string;
      rank?: number;
    }): Promise<OnboardingModuleResponse> => {
      const response = await apiClient.patch<OnboardingModuleResponse>(
        `/onboarding-modules/admin/onboarding-modules/${moduleId}`,
        data
      );
      return response.data;
    },

    createAdminModule: async (data: {
      title: string;
      description?: string;
      passing_criteria?: number;
      icon?: string;
      rank: number;
    }): Promise<OnboardingModuleResponse> => {
      const response = await apiClient.post<OnboardingModuleResponse>(
        `/onboarding-modules/admin/onboarding-modules`,
        data
      );
      return response.data;
    },

    canDeleteAdminModule: async (moduleId: number): Promise<{ can_delete: boolean }> => {
      const response = await apiClient.get<{ can_delete: boolean }>(
        `/onboarding-modules/admin/onboarding-modules/${moduleId}/can-delete`
      );
      return response.data;
    },

    deleteAdminModule: async (moduleId: number): Promise<{ deleted: boolean }> => {
      const response = await apiClient.delete<{ deleted: boolean }>(
        `/onboarding-modules/admin/onboarding-modules/${moduleId}`
      );
      return response.data;
    },

    updateAdminKeyConcept: async (conceptId: number, data: {
      title?: string;
      description?: string;
      link_url?: string;
      display_order?: number;
    }): Promise<OnboardingModuleKeyConceptResponse> => {
      const response = await apiClient.patch<OnboardingModuleKeyConceptResponse>(
        `/onboarding-modules/admin/onboarding-module-keyconcepts/${conceptId}`,
        data
      );
      return response.data;
    },

    createAdminKeyConcept: async (data: {
      module_id: number;
      title: string;
      description?: string;
      link_url?: string;
      display_order?: number;
    }): Promise<OnboardingModuleKeyConceptResponse> => {
      const response = await apiClient.post<OnboardingModuleKeyConceptResponse>(
        `/onboarding-modules/admin/onboarding-module-keyconcepts`,
        data
      );
      return response.data;
    },

    deleteAdminKeyConcept: async (conceptId: number): Promise<{ deleted: boolean }> => {
      const response = await apiClient.delete<{ deleted: boolean }>(
        `/onboarding-modules/admin/onboarding-module-keyconcepts/${conceptId}`
      );
      return response.data;
    },

    getModuleKeyConcepts: async (moduleId: number): Promise<OnboardingModuleKeyConceptResponse[]> => {
      const response = await apiClient.get<OnboardingModuleKeyConceptResponse[]>(
        `/onboarding-modules/onboarding-module-keyconcepts/${moduleId}`
      );
      return response.data;
    },

    getCurrentAdminQuiz: async (): Promise<{ modules: Array<{
      module_no: number;
      module_id: number;
      title: string;
      variants: Array<{
        variant: string;
        questions: Array<{
          id?: number;
          question_text: string;
          question_type: string;
          choices: string[];
          correct_answer: string;
          variant: string;
          priority: number;
        }>;
      }>;
    }> }> => {
      const response = await apiClient.get<{ modules: any[] }>(
        "/onboarding-modules/admin/onboarding-module-quiz-current"
      );
      return response.data;
    },

    saveAdminQuiz: async (questions: any[], deleteMissing: boolean = true): Promise<{ saved: number; modules: number[] }> => {
      const response = await apiClient.post<{ saved: number; modules: number[] }>(
        "/onboarding-modules/admin/onboarding-module-quiz-save",
        { questions, delete_missing: deleteMissing }
      );
      return response.data;
    },

    deleteAdminQuizQuestion: async (questionId: number): Promise<{ deleted: boolean }> => {
      const response = await apiClient.delete<{ deleted: boolean }>(
        `/onboarding-modules/admin/onboarding-module-quiz/${questionId}`
      );
      return response.data;
    },

    updateAdminQuizQuestion: async (questionId: number, data: {
      question_text?: string;
      question_type?: string;
      choices?: string[];
      correct_answer?: string;
      variant?: string;
    }): Promise<any> => {
      const response = await apiClient.patch<any>(
        `/onboarding-modules/admin/onboarding-module-quiz/${questionId}`,
        data
      );
      return response.data;
    },

    createAdminQuizQuestion: async (data: {
      module_id: number;
      question_text: string;
      question_type: string;
      choices: string[];
      correct_answer: string;
      variant: string;
    }): Promise<any> => {
      const response = await apiClient.post<any>(
        "/onboarding-modules/admin/onboarding-module-quiz",
        data
      );
      return response.data;
    },
  };
