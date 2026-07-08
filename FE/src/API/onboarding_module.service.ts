import apiClient from "./services";
import type {
  OnboardingModule,
  EmployeeOnboardingProgressSummaryResponse,
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
};
