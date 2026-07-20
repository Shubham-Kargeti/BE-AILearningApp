import React from "react";
import { Navigate } from "react-router-dom";
import { logger } from "../../utils/logger";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const token = localStorage.getItem("authToken");

  logger.info("ProtectedRoute", "Evaluating app route access", {
    hasToken: !!token,
    path: window.location.pathname,
  });

  if (!token) {
    logger.warn("ProtectedRoute", "No token found, redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  logger.info("ProtectedRoute", "Token found, allowing access");
  return <>{children}</>;
};

export default ProtectedRoute;
