import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAzureAuth } from "../auth";

const Logout = () => {
  const navigate = useNavigate();
  const { logout } = useAzureAuth();

  useEffect(() => {
    const clearAuth = async () => {
      localStorage.clear();
      try {
        await logout();
      } catch (error) {
        console.error("Logout error:", error);
      }
      navigate("/", { replace: true });
    };

    clearAuth();
  }, [navigate, logout]);

  return null;
};

export default Logout;
