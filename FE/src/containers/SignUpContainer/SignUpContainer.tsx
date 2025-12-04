import React, { useState } from "react";
import { Box, TextField, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./SignUpContainer.scss";

const SignUpContainer = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = () => {
    if (!values.email || !values.password) return;
    navigate("/profile-setup");
  };

  return (
    <Box className="signup-page">
      <Box className="signup-card">
        <Typography className="title">Create Account</Typography>
        <Typography className="subtitle">Join the universe</Typography>

        <TextField
          label="Name"
          name="name"
          variant="outlined"
          fullWidth
          value={values.name}
          onChange={handleChange}
          className="input"
        />

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

        <Button
          variant="contained"
          className="primary-btn"
          onClick={handleSubmit}
        >
          Sign Up
        </Button>

        <Typography className="switch">
          Already have an account?{" "}
          <span onClick={() => navigate("/login")}>Sign In</span>
        </Typography>
      </Box>
    </Box>
  );
};

export default SignUpContainer;
