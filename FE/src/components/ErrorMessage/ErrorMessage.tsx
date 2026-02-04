import { Box, Button, Typography } from "@mui/material";

const ErrorMessage = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => {
  return (
    <Box
      sx={{
        height: "70vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        color: "#fff",
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
        ⚠️ Error Loading Quiz
      </Typography>

      <Typography sx={{ mb: 3, color: "#bbb", maxWidth: 400 }}>
        {message}
      </Typography>

      <Button
        variant="contained"
        onClick={onRetry}
        sx={{
          background: "#3b2bee",
          textTransform: "none",
          borderRadius: "10px",
        }}
      >
        Retry
      </Button>
    </Box>
  );
};

export default ErrorMessage;
