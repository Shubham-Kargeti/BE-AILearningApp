import { Navigate } from "react-router-dom";

const ProtectedAuthRoute = ({ children }) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    return <Navigate to="/app/profile-setup" replace />;
  }

  return children;
};

export default ProtectedAuthRoute;
