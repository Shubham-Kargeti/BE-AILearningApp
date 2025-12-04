import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Clear entire local storage
    localStorage.clear();

    // Redirect to home
    navigate("/", { replace: true });
  }, [navigate]);

  return null; // No UI to show
};

export default Logout;
