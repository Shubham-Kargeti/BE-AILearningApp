import { Button, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./HomePageContainer.scss";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <Box className="landing-page">
      <div className="overlay" />
      <Box className="content">
        <Typography variant="h3" className="title">
          AI Gamification
        </Typography>
        <Typography variant="h6" className="subtitle">
          Learn, Code, and Grow with AI-Powered Insights
        </Typography>

        <Button
          variant="contained"
          color="primary"
          className="login-btn"
          onClick={() => navigate("/login")}
        >
          Get Started
        </Button>
      </Box>
    </Box>
  );
};

export default LandingPage;
