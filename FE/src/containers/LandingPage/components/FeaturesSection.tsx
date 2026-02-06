import { Box, Typography } from "@mui/material";
import ShieldIcon from "@mui/icons-material/Shield";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import TuneIcon from "@mui/icons-material/Tune";
import BoltIcon from "@mui/icons-material/Bolt";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import { useEffect, useState, useRef } from "react";
import "./FeaturesSection.scss";

const features = [
  {
    icon: <BoltIcon />,
    title: "RAG + LLM Generation",
    description:
      "Grounded question generation from your documents with controllable RAG/LLM mix.",
  },
  {
    icon: <TrackChangesIcon />,
    title: "Experience-Based Difficulty",
    description:
      "Adaptive question selection for junior, mid, and senior candidates.",
  },
  {
    icon: <TuneIcon />,
    title: "Admin Control Panel",
    description:
      "Create assessments, manage question banks, and publish role-specific tests.",
  },
  {
    icon: <QueryStatsIcon />,
    title: "Analytics & Reports",
    description:
      "Session-level insights, completion stats, and score analysis.",
  },
  {
    icon: <LocalLibraryIcon />,
    title: "Learning Paths",
    description:
      "Personalized course recommendations based on assessment outcomes.",
  },
  {
    icon: <ShieldIcon />,
    title: "Secure Access",
    description:
      "JWT auth, tokenized assessments, and audit-friendly workflows.",
  },
];

const FeaturesSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Box className="features-section" ref={sectionRef}>
      <Typography variant="h4" className={`features-title ${isVisible ? 'fade-in' : ''}`}>
        Built for Hiring at Scale
      </Typography>

      <Box className="features-wrapper">
        {features.map((f, idx) => (
          <Box 
            className={`feature-card ${isVisible ? 'fade-in-up' : ''}`} 
            key={idx}
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <Box className="feature-icon-wrapper">
              <Box className="feature-icon">{f.icon}</Box>
            </Box>
            <Typography className="feature-title">{f.title}</Typography>
            <Typography className="feature-description">
              {f.description}
            </Typography>
            <Box className="feature-hover-overlay" />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default FeaturesSection;
