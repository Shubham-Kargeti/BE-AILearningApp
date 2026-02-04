import { Box, Typography, Button } from "@mui/material";
import "./HeroSection.scss";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");

  return (
    <Box className="hero">
      <Box className="hero-content">
        <Typography variant="h3" className="hero-title">
          Your Next Learning Universe Awaits
        </Typography>

        <Typography variant="body1" className="hero-subtitle">
          Experience seamless cross-play, exclusive content, and a thriving
          community.
        </Typography>

        {!token && (
          <Button
            variant="contained"
            className="hero-btn"
            onClick={() => navigate("/signup")}
          >
            Sign Up Now
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default HeroSection;
