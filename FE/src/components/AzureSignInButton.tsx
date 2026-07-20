import React from "react";
import { Button, CircularProgress, Box } from "@mui/material";
import { useAzureAuth } from "../auth";

const AzureSignInButton = () => {
  const { loginWithAzure, loading } = useAzureAuth();

  return (
    <Box sx={{ mt: 2 }}>
      <Button
        fullWidth
        variant="outlined"
        onClick={loginWithAzure}
        disabled={loading}
        sx={{
          borderColor: "#0078d4",
          color: "#0078d4",
          textTransform: "none",
          py: 1.2,
          fontWeight: 500,
          "&:hover": {
            borderColor: "#005a9e",
            backgroundColor: "rgba(0, 120, 212, 0.04)",
          },
        }}
        startIcon={
          loading ? (
            <CircularProgress size={20} sx={{ color: "#0078d4" }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5h8.5v8.5H1V1.5z" fill="#f25022"/>
              <path d="M1 10.5h8.5v8.5H1v-8.5z" fill="#00a4ef"/>
              <path d="M10.5 1.5h8.5v8.5h-8.5v-8.5z" fill="#7fba00"/>
              <path d="M10.5 10.5h8.5v8.5h-8.5v-8.5z" fill="#ffb900"/>
            </svg>
          )
        }
      >
        {loading ? "Signing in..." : "Sign in with Azure AD"}
      </Button>
    </Box>
  );
};

export default AzureSignInButton;
