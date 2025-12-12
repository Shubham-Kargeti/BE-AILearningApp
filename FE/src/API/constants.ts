const baseURL = import.meta.env.VITE_API_BASE_URL;
const API_V1 = `${baseURL}api/v1`;

export const LOGIN = `${API_V1}/auth/login`;
export const GENERATE_MCQS = `${API_V1}/generate-mcqs`;
export const START_QUIZ = `${API_V1}/questionset-tests/start`;
export const SUBMIT_MCQS = `${API_V1}/questionset-tests/submit`;
export const RECOMMENDED_COURSES = `${API_V1}/recommended-courses?topic=AgenticAI`;
export const GET_SUB_TOPICS = `${API_V1}/subskills?topic=`;

// HTTP methods
export const HTTP_GET = "get";
export const HTTP_POST = "post";
export const HTTP_DELETE = "delete";

export const allowedUsers = [
  "admin@nagarro.com",
  "monesh.sanvaliya@nagarro.com",
  "shubham.kargeti@nagarro.com",
  "arjun.singha@nagarro.com",
  "pintoo.kumar@nagarro.com",
  "puneet.banga@nagarro.com",
  "shailja.tyagi@nagarro.com",
  "devinder.kumar@nagarro.com",
];
