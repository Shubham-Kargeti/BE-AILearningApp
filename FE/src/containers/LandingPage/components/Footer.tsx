import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import TwitterIcon from "@mui/icons-material/Twitter";
import InstagramIcon from "@mui/icons-material/Instagram";
import GitHubIcon from "@mui/icons-material/GitHub";
import "./Footer.scss";

const Footer = () => {
  return (
    <Box className="footer">
      <Box className="footer-content">
        <Box className="footer-brand">
          <Box className="footer-logo" />
          <Typography variant="h6" className="footer-title">
            Learning Platform
          </Typography>
        </Box>

        <Typography className="footer-description">
          Your universe for gaming, community, and limitless play.
        </Typography>

        <Box className="footer-socials">
          <IconButton className="social-btn">
            <TwitterIcon />
          </IconButton>
          <IconButton className="social-btn">
            <InstagramIcon />
          </IconButton>
          <IconButton className="social-btn">
            <GitHubIcon />
          </IconButton>
        </Box>
      </Box>

      <Box className="footer-divider" />

      <Typography className="footer-copy">
        © {new Date().getFullYear()} Learning Platform. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Footer;
