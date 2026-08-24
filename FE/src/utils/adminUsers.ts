import { jwtDecode } from "jwt-decode";

export type JwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
  type?: string;
  source?: string;
};

export const isAdmin = (_email?: string) => {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return false;
    const payload = jwtDecode<JwtPayload>(token);
    return payload.role === "admin";
  } catch {
    return false;
  }
};

export const isOnboardingCandidate = () => {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return false;
    const payload = jwtDecode<JwtPayload>(token);
    return payload.role === "candidate" && payload.source === "onboarding";
  } catch {
    return false;
  }
};
