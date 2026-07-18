import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { isAdmin } from "../../utils/adminUsers";
import React from "react";

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];
  const userEmail = account?.username ?? "";

  if (!account) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin(userEmail)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
