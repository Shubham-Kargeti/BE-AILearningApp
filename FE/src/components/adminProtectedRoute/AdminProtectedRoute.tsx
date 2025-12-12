import { Navigate } from "react-router-dom";
import { isAdmin } from "../../utils/adminUsers";
import React from "react";

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const userEmail = localStorage.getItem("loggedInUser");
  const authToken = localStorage.getItem("authToken");

  if (!userEmail || !authToken) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin(userEmail)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
