import { Box, Typography, Button } from "@mui/material";
import "./HeroSection.scss";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import InsightsIcon from "@mui/icons-material/Insights";

const HeroSection = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("authToken");
  const [isVisible, setIsVisible] = useState(false);
  const [counters, setCounters] = useState({ rag: 0, adaptive: 0, analytics: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
    
    // Animated counters
    const duration = 2000;
    const steps = 60;
    const increment = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      setCounters({
        rag: Math.floor(progress * 95),
        adaptive: Math.floor(progress * 88),
        analytics: Math.floor(progress * 92),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setCounters({ rag: 95, adaptive: 88, analytics: 92 });
      }
    }, increment);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box className="hero" ref={heroRef}>
      <Box className={`hero-content ${isVisible ? 'fade-in' : ''}`}>
        <Box className="hero-badge">
          <Box className="badge-dot" />
          <Typography className="badge-text">Powered by RAG + LLM</Typography>
        </Box>
        
        <Typography variant="h3" className="hero-title">
          AI-Powered Assessments,
          <br />
          <span className="gradient-text">Designed for Real Hiring</span>
        </Typography>

        <Typography variant="body1" className="hero-subtitle">
          Generate role-specific assessments using RAG + LLMs, verify skills with
          adaptive difficulty, and deliver personalized learning paths with
          actionable analytics.
        </Typography>

        <Box className="hero-actions">
          {!token && (
            <Button
              variant="contained"
              className="hero-btn primary"
              onClick={() => navigate("/signup")}
            >
              Get Started Free
              <Box component="span" className="btn-arrow">→</Box>
            </Button>
          )}
          <Button
            variant="outlined"
            className="hero-btn secondary"
            onClick={() => {
              const el = document.getElementById("architecture");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            View Architecture
          </Button>
        </Box>

        <Box className="hero-stats">
          <Box className="stat-item">
            <Typography className="stat-number">10K+</Typography>
            <Typography className="stat-label">Questions Generated</Typography>
          </Box>
          <Box className="stat-divider" />
          <Box className="stat-item">
            <Typography className="stat-number">500+</Typography>
            <Typography className="stat-label">Assessments Created</Typography>
          </Box>
          <Box className="stat-divider" />
          <Box className="stat-item">
            <Typography className="stat-number">98%</Typography>
            <Typography className="stat-label">Accuracy Rate</Typography>
          </Box>
        </Box>
      </Box>

      <Box className={`hero-metrics ${isVisible ? 'slide-in' : ''}`}>
        <Box className="metric-card glass-card">
          <Box className="metric-icon-wrapper">
            <TrendingUpIcon className="metric-icon" />
          </Box>
          <Typography className="metric-value">{counters.rag}%</Typography>
          <Typography className="metric-label">RAG Grounding Accuracy</Typography>
          <Box className="metric-progress">
            <Box className="metric-progress-bar" style={{ width: `${counters.rag}%` }} />
          </Box>
        </Box>
        <Box className="metric-card glass-card">
          <Box className="metric-icon-wrapper">
            <AutoGraphIcon className="metric-icon" />
          </Box>
          <Typography className="metric-value">{counters.adaptive}%</Typography>
          <Typography className="metric-label">Adaptive Difficulty Match</Typography>
          <Box className="metric-progress">
            <Box className="metric-progress-bar" style={{ width: `${counters.adaptive}%` }} />
          </Box>
        </Box>
        <Box className="metric-card glass-card">
          <Box className="metric-icon-wrapper">
            <InsightsIcon className="metric-icon" />
          </Box>
          <Typography className="metric-value">{counters.analytics}%</Typography>
          <Typography className="metric-label">Analytics Coverage</Typography>
          <Box className="metric-progress">
            <Box className="metric-progress-bar" style={{ width: `${counters.analytics}%` }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default HeroSection;
