import { jwtDecode } from "jwt-decode";

export type JwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
  type?: string;
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
