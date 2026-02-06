import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./Navbar.scss";
import { isAdmin } from "../../../utils/adminUsers";

const Navbar = () => {
  const navigate = useNavigate();

  const token = localStorage.getItem("authToken");
  const loggedUser = localStorage.getItem("loggedInUser");

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box className="navbar">
      <Box className="navbar-left">
        <Box className="navbar-logo" />
        <Typography variant="h6" className="navbar-title">
          AI Learning App
        </Typography>
      </Box>

      <Box className="navbar-links">
        <span onClick={() => scrollToSection("hero")}>Home</span>
        <span onClick={() => scrollToSection("architecture")}>Architecture</span>
        <span onClick={() => scrollToSection("features")}>Features</span>
      </Box>

      <Box className="navbar-actions">

        {/* ⭐ ADMIN DASHBOARD BUTTON (only for logged-in admins) */}
        {loggedUser && isAdmin(loggedUser) && (
          <Button
            variant="contained"
            className="admin-btn"
            onClick={() => navigate("/admin/dashboard")}
            style={{ marginRight: "12px" }}
          >
            Admin Dashboard
          </Button>
        )}

        {/* ⭐ LOGIN / EXPLORE BUTTON */}
        <Button
          variant="contained"
          className="navbar-btn"
          onClick={() => navigate(token ? "/app/profile-setup" : "/login")}
        >
          {token ? "Explore App" : "Login"}
        </Button>
      </Box>
    </Box>
  );
};

export default Navbar;
