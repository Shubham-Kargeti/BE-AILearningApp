import type { TokenResponse } from "../API/services";

/**
 * Store only the backend application's session values. Microsoft account and token
 * cache data remain fully owned by MSAL under its own localStorage keys.
 */
export const saveApplicationSession = (session: TokenResponse): void => {
  localStorage.setItem("authToken", session.access_token);
  localStorage.setItem("refreshToken", session.refresh_token);

  if (session.role) {
    localStorage.setItem("userRole", session.role);
  } else {
    localStorage.removeItem("userRole");
  }

  if (session.candidate_id) {
    localStorage.setItem("candidateId", session.candidate_id);
  } else {
    localStorage.removeItem("candidateId");
  }
};

/** Return whether the frontend already has an application access token. */
export const hasApplicationSession = (): boolean =>
  Boolean(localStorage.getItem("authToken"));

/**
 * Clear application/user state without calling localStorage.clear(), which would also
 * delete MSAL's cache before logoutRedirect can finish the Microsoft sign-out flow.
 */
export const clearApplicationSession = (): void => {
  const sessionKeys = [
    "authToken",
    "refreshToken",
    "userRole",
    "candidateId",
    "loggedInUser",
    "userEmail",
    "userName",
    "profileCompleted",
    "userProfile",
    "currentAssessment",
    "candidateSessionId",
  ];

  sessionKeys.forEach((key) => localStorage.removeItem(key));
};

