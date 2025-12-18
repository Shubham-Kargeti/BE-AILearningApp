export type QuestionType = "mcq" | "coding" | "architecture";

export interface MCQOption {
  option_id: string;
  text: string;
}

export interface AssessmentQuestion {
  question_id: number;
  question_text: string;
  question_type: QuestionType;

  // MCQ
  options?: MCQOption[];
  correct_answer?: string;

  // Coding / Architecture
  meta?: {
    language?: string;
    constraints?: string[];
    focus_areas?: string[];
  };
}

export interface QuestionSet {
  question_set_id: string;
  skill: string;
  level: string;
  total_questions: number;
  created_at: string;
  questions: AssessmentQuestion[];
}
