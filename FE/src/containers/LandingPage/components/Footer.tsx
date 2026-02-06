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
            AI Learning App
          </Typography>
        </Box>

        <Typography className="footer-description">
          End-to-end assessment platform for skill validation and learning paths.
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
        © {new Date().getFullYear()} AI Learning App. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Footer;
