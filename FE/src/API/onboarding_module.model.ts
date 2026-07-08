export interface OnboardingModule {
  id: number;
  title: string;
  description: string | null;
  rank: number;
  passing_criteria: number;
  icon: string | null;
  date: string | null;
}

export interface EmployeeModuleProgressSummaryItem {
  module_id: number;
  title: string;
  description: string | null;
  rank: number;
  passing_criteria: number;
  status: string;
  is_unlocked: boolean;
  started_date: string | null;
  video_completed_date: string | null;
  completed_date: string | null;
}

export interface EmployeeOnboardingProgressSummaryResponse {
  total_modules: number;
  completed_modules: number;
  remaining_modules: number;
  overall_progress_percentage: number;
  modules: Array<EmployeeModuleProgressSummaryItem>;
}
