import React, { useEffect, useState } from "react";
import { Box, TextField, Button, Typography, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./LoginContainer.scss";
import Loader from "../../components/Loader";
import { authService } from "../../API/services";
import { isAdmin, isOnboardingCandidate } from "../../utils/adminUsers";

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

    if (token) {
      if (isAdmin(userEmail)) {
        navigate("/admin/dashboard");
      } else if (isOnboardingCandidate()) {
        navigate("/app/onboarding-candidate");
      } else {
        const profileCompleted = localStorage.getItem("profileCompleted") === "true";
        navigate(profileCompleted ? "/app/dashboard" : "/app/profile-setup");
      }
    }
  }, [navigate]);

  const generateAuthToken = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await authService.login(values.email.trim(), values.password);
      const { access_token, refresh_token, role, candidate_id } = response;

      if (access_token) {
        localStorage.setItem("authToken", access_token);
      }

      if (refresh_token) {
        localStorage.setItem("refreshToken", refresh_token);
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
    if (!response?.access_token) return;

    const email = values.email.trim().toLowerCase();
    localStorage.setItem("loggedInUser", email);

    if (response.role === "admin") {
      navigate("/admin/dashboard");
    } else {
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

        <Typography className="switch">
          Don't have an account?{" "}
          <span onClick={() => navigate("/signup")}>Sign Up</span>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginContainer;
