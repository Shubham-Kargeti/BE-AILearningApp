import { useEffect, useState } from "react";
import { InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { Box, Button, Typography, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./LoginContainer.scss";
import Loader from "../../components/Loader";
import { loginRequest } from "../../auth/authConfig";
import MicrosoftLogo from "../../auth/MicrosoftLogo";

const LoginContainer = () => {
  const navigate = useNavigate();
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // MsalProvider restores cached accounts and redirect results automatically.
    if (isAuthenticated && inProgress === InteractionStatus.None) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [inProgress, isAuthenticated, navigate]);

  const handleMicrosoftLogin = async () => {
    if (inProgress !== InteractionStatus.None) return;

    try {
      setLoading(true);
      setError("");
      await instance.loginRedirect({
        ...loginRequest,
        redirectStartPage: `${window.location.origin}/app/dashboard`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      setError(`Microsoft sign-in failed: ${message}`);
      setLoading(false);
    }
  };

  if (loading || inProgress !== InteractionStatus.None) {
    return <Loader fullscreen message="Redirecting to Microsoft sign-in..." />;
  }

  return (
    <Box className="login-page">
      <Box className="login-card">
        <Typography className="title">Welcome Back</Typography>
        <Typography className="subtitle">
          Sign in with your Nagarro Microsoft account to continue your journey
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          className="primary-btn"
          onClick={handleMicrosoftLogin}
          startIcon={<MicrosoftLogo />}
        >
          Login with Nagarro
        </Button>
      </Box>
    </Box>
  );
};

export default LoginContainer;
