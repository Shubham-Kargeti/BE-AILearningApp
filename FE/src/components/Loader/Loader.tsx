import { CircularProgress, Box, Typography } from "@mui/material";
import "./Loader.scss";

interface LoaderProps {
  message?: string;
  fullscreen?: boolean;
}

const Loader = ({ message = "Loading...", fullscreen = true }: LoaderProps) => {
  return (
    <Box className={`loader-container ${fullscreen ? "fullscreen" : ""}`}>
      <CircularProgress className="loader-spinner" />
      <Typography className="loader-text">{message}</Typography>
    </Box>
  );
};

export default Loader;
