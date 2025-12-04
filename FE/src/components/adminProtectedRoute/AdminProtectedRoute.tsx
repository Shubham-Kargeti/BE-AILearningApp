import { Navigate } from "react-router-dom";
import { isAdmin } from "../../utils/adminUsers";
import React from "react";


const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const userEmail = localStorage.getItem("loggedInUser");

  // If not logged in → redirect to login
  if (!userEmail) {
    return <Navigate to="/login" replace />;
  }

  // If not admin → redirect to normal dashboard
  if (!isAdmin(userEmail)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  // Otherwise allowed
  return children;
};

export default AdminProtectedRoute;
