import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedProfileQuizRouteProps {
  children: React.ReactNode;
}

const ProtectedProfileQuizRoute = ({
  children,
}: ProtectedProfileQuizRouteProps) => {
  const profileCompleted = localStorage.getItem("profileCompleted") === "true";

  if (!profileCompleted) {
    return <Navigate to="/app/profile-setup" replace />;
  }

  return <>{children}</>;
};

export default ProtectedProfileQuizRoute;
