import { Box, Typography, Grid } from "@mui/material";
import FilePresentIcon from "@mui/icons-material/FilePresent";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PsychologyIcon from "@mui/icons-material/Psychology";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SchoolIcon from "@mui/icons-material/School";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useEffect, useState, useRef } from "react";
import "./CommunitySection.scss";

const architectureSteps = [
  {
    icon: <FilePresentIcon />,
    title: "Ingest Documents",
    text: "Upload JD, CV, and question bank documents to extract skills and context.",
  },
  {
    icon: <AutoAwesomeIcon />,
    title: "RAG Indexing",
    text: "Build FAISS vectors for grounded retrieval during question generation.",
  },
  {
    icon: <PsychologyIcon />,
    title: "AI Question Generation",
    text: "Blend RAG and LLM to generate role-specific, difficulty-aware questions.",
  },
  {
    icon: <AssessmentIcon />,
    title: "Assessment Delivery",
    text: "Tokenized assessment links, timed tests, and secure session tracking.",
  },
  {
    icon: <SchoolIcon />,
    title: "Learning Path",
    text: "Score analytics and personalized course recommendations for upskilling.",
  },
];

const CommunitySection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Box className="community-section" ref={sectionRef}>
      <Typography variant="h4" className="community-title">
        End-to-End Architecture
      </Typography>

      <Typography className="community-subtitle">
        A complete workflow from document ingestion to learning path outcomes.
      </Typography>

      <Box className="architecture-flow">
        {architectureSteps.map((step, idx) => (
          <Box key={step.title} className="flow-item-wrapper">
            <Box className={`testimonial-card ${isVisible ? 'fade-in-up' : ''}`}
                 style={{ animationDelay: `${idx * 0.15}s` }}>
              <Box className="step-number">{idx + 1}</Box>
              <Box className="testimonial-header">
                <Box className="testimonial-icon pulse-animation">{step.icon}</Box>
                <Typography className="testimonial-name">{step.title}</Typography>
              </Box>
              <Typography className="testimonial-text">{step.text}</Typography>
            </Box>
            {idx < architectureSteps.length - 1 && (
              <Box className="flow-connector">
                <ArrowForwardIcon className="arrow-icon" />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default CommunitySection;
