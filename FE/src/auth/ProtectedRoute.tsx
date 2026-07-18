import type { ReactNode } from "react";
import { InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Navigate, useLocation } from "react-router-dom";
import Loader from "../components/Loader";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Protects private pages using only MSAL's account state.
 * The attempted location is passed to the login page for a future return-flow option,
 * while the current requirement still sends successful logins to the dashboard.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const isAuthenticated = useIsAuthenticated();
  const { inProgress } = useMsal();
  const location = useLocation();

  if (inProgress !== InteractionStatus.None) {
    return <Loader fullscreen message="Checking Microsoft sign-in..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;

