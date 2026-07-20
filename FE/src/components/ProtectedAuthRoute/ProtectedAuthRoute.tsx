import { Navigate } from "react-router-dom";
import React from "react";
import { isAdmin } from "../../utils/adminUsers";
import { logger } from "../../utils/logger";

interface ProtectedAuthRouteProps {
  children: React.ReactNode;
}

const ProtectedAuthRoute = ({ children }: ProtectedAuthRouteProps) => {
  const token = localStorage.getItem("authToken");
  const userEmail = localStorage.getItem("loggedInUser") || "";
  const profileCompleted = localStorage.getItem("profileCompleted") === "true";

  logger.info("ProtectedAuthRoute", "Evaluating route access", {
    hasToken: !!token,
    userEmail,
    profileCompleted,
    path: window.location.pathname,
  });

  if (token) {
    if (isAdmin(userEmail)) {
      logger.info("ProtectedAuthRoute", "Redirecting admin to /admin/dashboard");
      return <Navigate to="/admin/dashboard" replace />;
    }

    const destination = profileCompleted ? "/app/dashboard" : "/app/profile-setup";
    logger.info("ProtectedAuthRoute", "Redirecting authenticated user", { destination });
    return <Navigate to={destination} replace />;
  }

  logger.info("ProtectedAuthRoute", "Allowing access - no token found");
  return children;
};

export default ProtectedAuthRoute;
