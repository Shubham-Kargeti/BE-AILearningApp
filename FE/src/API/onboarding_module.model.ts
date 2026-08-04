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

export interface ResourceLinkItem {
  module_id: number;
  module_title: string;
  title: string;
  url: string;
}

export interface EmployeeOnboardingProgressSummaryResponse {
  total_modules: number;
  completed_modules: number;
  remaining_modules: number;
  overall_progress_percentage: number;
  certificate_email_sent: boolean;
  resources: ResourceLinkItem[];
  modules: Array<EmployeeModuleProgressSummaryItem>;
}

export interface ModuleDetailResponse {
  module: OnboardingModule;
  video_url: string;
  video_completed: boolean;
  key_concepts: Array<{
    id: number;
    title: string;
    description: string;
    link_url: string | null;
    display_order: number;
  }>;
  quiz_questions: Array<{
    id: number;
    question_text: string;
    question_type: string;
    choices: string[] | null;
    correct_answer: string | null;
    display_order: number;
    points: number;
  }>;
  quiz_attempts: Array<{
    id: number;
    employee_progress_id: number;
    quiz_id: number | null;
    score: number | null;
    passing_status: string | "fail" | "pass";
    attempt_number: number;
    time_spent_seconds: number | null;
    attempted_date: string;
    responses: Array<{
      id: number;
      question_id: number;
      question_text: string | null;
      employee_answer: string | null;
      correct_answer: string | null;
      is_correct: boolean | null;
      time_spent_seconds: number | null;
    }>;
  }>;
}

export interface QuizSubmitResponse {
  attempt_id: number;
  module_id: number;
  attempt_number: number;
  total_questions: number;
  correct_answers: number;
  score: number;
  passing_status: string;
  passing_criteria: number;
  responses: Array<{
    question_id: number;
    question_text: string | null;
    employee_answer: string | null;
    correct_answer: string | null;
    is_correct: boolean | null;
  }>;
}

export interface VideoProgressResponse {
  id: number;
  employee_progress_id: number;
  video_url: string | null;
  current_duration_seconds: number;
  total_duration_seconds: number | null;
  completion_percentage: number;
  is_completed: boolean;
  completed_date: string | null;
}

export interface ActionChecklistItemResponse {
  id: number;
  module_id: number;
  item_text: string;
  display_order: number;
  is_active: boolean;
}

export interface CandidateChecklistResponse {
  id: number;
  candidate_id: number;
  module_id: number;
  completed_item_ids: string | null;
  all_completed: boolean;
  certificate_generated: boolean;
  certificate_generated_date: string | null;
  completed_date: string | null;
  items: ActionChecklistItemResponse[];
}

export interface CertificateResponse {
  certificate_id: number;
  candidate_id: number;
  module_id: number;
  generated_at: string;
  completion_date: string | null;
  candidate_name: string | null;
}

export interface CertificateModuleItem {
  module_id: number;
  title: string;
  rank: number;
  score: number | null;
  passing_status: string | null;
  status: string;
}

export interface CertificateDataResponse {
  candidate_name: string | null;
  completed_date: string | null;
  generated_at: string | null;
  modules: CertificateModuleItem[];
}
