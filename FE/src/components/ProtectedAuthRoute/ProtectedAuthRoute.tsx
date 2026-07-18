import { Navigate } from "react-router-dom";
import React from "react";
import { InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import Loader from "../Loader";

interface ProtectedAuthRouteProps {
  children: React.ReactNode;
}

const ProtectedAuthRoute = ({ children }: ProtectedAuthRouteProps) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();

  // Wait for redirect processing before deciding whether the login page is needed.
  if (inProgress !== InteractionStatus.None) {
    return <Loader fullscreen message="Completing Microsoft sign-in..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
};

export default ProtectedAuthRoute;
