import React from "react";
import { Box, Typography } from "@mui/material";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import WifiIcon from "@mui/icons-material/Wifi";
import GroupIcon from "@mui/icons-material/Group";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import "./FeaturesSection.scss";

const features = [
  {
    icon: <MilitaryTechIcon />,
    title: "Unique Badge System",
    description:
      "Show off your skills and achievements. Earn exclusive badges for in-game accomplishments and community participation.",
  },
  {
    icon: <WhatshotIcon />,
    title: "Exclusive Releases",
    description:
      "Gain early access to platform-first titles and expansions you won’t find anywhere else.",
  },
  {
    icon: <WifiIcon />,
    title: "Seamless Cross-Play",
    description:
      "Play with friends across platforms without performance drops or server issues.",
  },
  {
    icon: <GroupIcon />,
    title: "Thriving Community",
    description:
      "Join guilds, teams, and voice channels with learners from around the world.",
  },
];

const FeaturesSection = () => {
  return (
    <Box className="features-section">
      <Typography variant="h4" className="features-title">
        Why Learners Choose Us
      </Typography>

      <Box className="features-wrapper">
        {features.map((f, idx) => (
          <Box className="feature-card" key={idx}>
            <Box className="feature-icon">{f.icon}</Box>
            <Typography className="feature-title">{f.title}</Typography>
            <Typography className="feature-description">
              {f.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default FeaturesSection;
