import { Navigate } from "react-router-dom";
import React from "react";

interface ProtectedAuthRouteProps {
  children: React.ReactNode;
}

const ProtectedAuthRoute = ({ children }: ProtectedAuthRouteProps) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    return <Navigate to="/app/profile-setup" replace />;
  }

  return children;
};

export default ProtectedAuthRoute;
