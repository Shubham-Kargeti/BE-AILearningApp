import { Navigate } from "react-router-dom";
import React from "react";
import { isAdmin } from "../../utils/adminUsers";

interface ProtectedAuthRouteProps {
  children: React.ReactNode;
}

const ProtectedAuthRoute = ({ children }: ProtectedAuthRouteProps) => {
  const token = localStorage.getItem("authToken");
  const userEmail = localStorage.getItem("loggedInUser") || "";
  const profileCompleted = localStorage.getItem("profileCompleted") === "true";

  if (token) {
    if (isAdmin(userEmail)) {
      return <Navigate to="/admin/dashboard" replace />;
    }

    return <Navigate to={profileCompleted ? "/app/dashboard" : "/app/profile-setup"} replace />;
  }

  return children;
};

export default ProtectedAuthRoute;
