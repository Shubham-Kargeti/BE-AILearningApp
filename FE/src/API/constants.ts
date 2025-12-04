const baseURL = import.meta.env.VITE_API_BASE_URL;
export const LOGIN = `${baseURL}auth/login`;
export const GENERATE_MCQS = `${baseURL}generate-mcqs`;
export const START_QUIZ = `${baseURL}questionset-tests/start`;
export const SUBMIT_MCQS = `${baseURL}questionset-tests/submit`;
export const RECOMMENDED_COURSES = `${baseURL}recommended-courses?topic=AgenticAI`;
export const GET_SUB_TOPICS = `${baseURL}subskills?topic=`;

// HTTP methods
export const HTTP_GET = "get";
export const HTTP_POST = "post";
export const HTTP_DELETE = "delete";

export const allowedUsers = [
  "monesh.sanvaliya@nagarro.com",
  "shubham.kargeti@nagarro.com",
  "arjun.singha@nagarro.com",
  "pintoo.kumar@nagarro.com",
  "puneet.banga@nagarro.com",
  "shailja.tyagi@nagarro.com",
  "devinder.kumar@nagarro.com",
];
