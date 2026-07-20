import React, { useEffect, useState } from "react";
import { Box, TextField, Button, Typography, Alert, Divider } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./LoginContainer.scss";
import Loader from "../../components/Loader";
import { authService } from "../../API/services";
import { isAdmin } from "../../utils/adminUsers";
import { logger } from "../../utils/logger";
import AzureSignInButton from "../../components/AzureSignInButton";

const LoginContainer = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const userEmail = localStorage.getItem("loggedInUser") || "";
    const profileCompleted = localStorage.getItem("profileCompleted") === "true";

    logger.info("LoginContainer", "Mount effect - checking auth state", {
      hasToken: !!token,
      userEmail,
      profileCompleted,
    });

    if (token) {
      logger.info("LoginContainer", "Token found, redirecting away from login", {
        destination: isAdmin(userEmail) ? "/admin/dashboard" : profileCompleted ? "/app/dashboard" : "/app/profile-setup",
      });
      navigate(isAdmin(userEmail) ? "/admin/dashboard" : profileCompleted ? "/app/dashboard" : "/app/profile-setup");
    }
  }, [navigate]);

  const generateAuthToken = async () => {
    try {
      setLoading(true);
      setError("");
      logger.info("LoginContainer", "Calling login API", { email: values.email.trim() });
      const response = await authService.login(values.email.trim(), values.password);
      const { access_token, refresh_token, role, candidate_id } = response;

      logger.info("LoginContainer", "Login API response received", {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        role,
        candidate_id,
      });

      if (access_token) {
        localStorage.setItem("authToken", access_token);
      }

      if (refresh_token) {
        localStorage.setItem("refreshToken", refresh_token);
      }

      if (role) {
        localStorage.setItem("userRole", role);
      }

      if (candidate_id) {
        localStorage.setItem("candidateId", candidate_id);
      }

      setLoading(false);
      return response;
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Invalid email or password.";
      logger.error("LoginContainer", "Login API failed", { message, error: err });
      setError(message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!values.email || !values.password) {
      setError("Please enter both email and password.");
      return;
    }

    const response = await generateAuthToken();
    if (!response?.access_token) {
      logger.warn("LoginContainer", "No access token in login response");
      return;
    }

    const email = values.email.trim().toLowerCase();
    localStorage.setItem("loggedInUser", email);

    if (response.role === "admin" || isAdmin(email)) {
      logger.info("LoginContainer", "Navigating to admin dashboard");
      navigate("/admin/dashboard");
    } else {
      logger.info("LoginContainer", "Navigating to profile setup");
      navigate("/app/profile-setup");
    }
  };

  if (loading) return <Loader fullscreen message="Loading App..." />;

  return (
    <Box className="login-page">
      <Box className="login-card">
        <Typography className="title">Welcome Back</Typography>
        <Typography className="subtitle">
          Sign in to continue your journey
        </Typography>

        <TextField
          label="Email"
          name="email"
          variant="outlined"
          fullWidth
          value={values.email}
          onChange={handleChange}
          className="input"
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          variant="outlined"
          fullWidth
          value={values.password}
          onChange={handleChange}
          className="input"
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          className="primary-btn"
          onClick={handleSubmit}
        >
          Sign In
        </Button>

        <Divider sx={{ my: 3, "&::before, &::after": { borderColor: "rgba(0, 0, 0, 0.12)" } }}>
          <Typography variant="body2" color="textSecondary">
            or
          </Typography>
        </Divider>

        <AzureSignInButton />

        <Typography className="switch">
          Don't have an account?{" "}
          <span onClick={() => navigate("/signup")}>Sign Up</span>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginContainer;
