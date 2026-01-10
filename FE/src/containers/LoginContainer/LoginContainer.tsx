import React, { useEffect, useState } from "react";
import { Box, TextField, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./LoginContainer.scss";
import { apiCall } from "../../API";
import { allowedUsers, HTTP_POST, LOGIN } from "../../API/constants";
import Loader from "../../components/Loader";
import {isAdmin} from "../../utils/adminUsers"

const LoginContainer = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      navigate("/app/dashboard");
    }
  }, []);

  useEffect(() => {
    localStorage.clear();
  }, []);

  const generateAuthToken = async () => {
    try {
      setLoading(true);
      const response = await apiCall(LOGIN, HTTP_POST, {
        email: values.email,
      });

      const { access_token } = response;

      if (access_token) {
        localStorage.setItem("authToken", access_token);
      }

      setLoading(false);
      return access_token;
    } catch (error) {

      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!values.email) return;

    if (!allowedUsers.includes(values.email)) {
      alert("Unauthorized user. Please use a valid email.");
      return;
    }

    await generateAuthToken();
    localStorage.setItem("loggedInUser", values.email);

    if (isAdmin(values.email)) {
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