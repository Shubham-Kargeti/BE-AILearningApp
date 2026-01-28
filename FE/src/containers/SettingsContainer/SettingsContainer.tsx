import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Switch,
  Button,
  TextField,
  Avatar,
  Divider,
 
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SecurityIcon from "@mui/icons-material/Security";
import PaletteIcon from "@mui/icons-material/Palette";
import SaveIcon from "@mui/icons-material/Save";

const SettingsContainer = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    streakReminders: true,
    darkMode: false,
    soundEffects: true,
    autoSave: true,
  });

  const [profile, setProfile] = useState({
    name: "John Doe",
    email: "john.doe@example.com",
    role: "Software Developer",
  });

  const handleToggle = (setting: string) => {
    setSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting as keyof typeof settings],
    }));
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    console.log("Settings saved:", settings, profile);
    // Add your save logic here
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        paddingBottom: "4rem",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)",
          padding: "3rem 2rem",
          marginBottom: "2rem",
        }}
      >
        <Box sx={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "0.5rem",
            }}
          >
            <SettingsIcon sx={{ fontSize: 48, color: "white" }} />
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: "white",
                textShadow: "0 2px 10px rgba(0,0,0,0.1)",
              }}
            >
              Settings ⚙️
            </Typography>
          </Box>
          <Typography
            variant="h6"
            sx={{
              color: "rgba(255,255,255,0.9)",
              fontWeight: 400,
            }}
          >
            Customize your experience and manage your account
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: "2rem",
          }}
        >
          {/* Profile Settings */}
          <Paper
            sx={{
              padding: "2.5rem",
              borderRadius: "24px",
              backgroundColor: "white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "2rem",
              }}
            >
              <Box
                sx={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PersonIcon sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a" }}>
                Profile Settings
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  fontSize: "2rem",
                  fontWeight: 700,
                }}
              >
                {profile.name.charAt(0)}
              </Avatar>
              <Button
                variant="outlined"
                sx={{
                  borderColor: "#667eea",
                  color: "#667eea",
                  borderRadius: "10px",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#764ba2",
                    background: "rgba(102, 126, 234, 0.05)",
                  },
                }}
              >
                Change Photo
              </Button>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <TextField
                label="Full Name"
                value={profile.name}
                onChange={(e) => handleProfileChange("name", e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#f8fafc",
                    "&:hover fieldset": {
                      borderColor: "#667eea",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#667eea",
                    },
                  },
                }}
              />
              <TextField
                label="Email"
                value={profile.email}
                onChange={(e) => handleProfileChange("email", e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#f8fafc",
                    "&:hover fieldset": {
                      borderColor: "#667eea",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#667eea",
                    },
                  },
                }}
              />
              <TextField
                label="Role"
                value={profile.role}
                onChange={(e) => handleProfileChange("role", e.target.value)}
                fullWidth
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "12px",
                    backgroundColor: "#f8fafc",
                    "&:hover fieldset": {
                      borderColor: "#667eea",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#667eea",
                    },
                  },
                }}
              />
            </Box>
          </Paper>

          {/* Notification Settings */}
          <Paper
            sx={{
              padding: "2.5rem",
              borderRadius: "24px",
              backgroundColor: "white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "2rem",
              }}
            >
              <Box
                sx={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NotificationsIcon sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a" }}>
                Notifications
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Email Notifications
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Receive updates via email
                  </Typography>
                </Box>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle("emailNotifications")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Push Notifications
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Get alerts on your device
                  </Typography>
                </Box>
                <Switch
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle("pushNotifications")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Streak Reminders
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Daily reminders for your streak
                  </Typography>
                </Box>
                <Switch
                  checked={settings.streakReminders}
                  onChange={() => handleToggle("streakReminders")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Preferences */}
          <Paper
            sx={{
              padding: "2.5rem",
              borderRadius: "24px",
              backgroundColor: "white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "2rem",
              }}
            >
              <Box
                sx={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PaletteIcon sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a" }}>
                Preferences
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Dark Mode
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Switch to dark theme
                  </Typography>
                </Box>
                <Switch
                  checked={settings.darkMode}
                  onChange={() => handleToggle("darkMode")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Sound Effects
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Play sounds during quizzes
                  </Typography>
                </Box>
                <Switch
                  checked={settings.soundEffects}
                  onChange={() => handleToggle("soundEffects")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 600, color: "#0f172a" }}>
                    Auto-Save Progress
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                    Automatically save your progress
                  </Typography>
                </Box>
                <Switch
                  checked={settings.autoSave}
                  onChange={() => handleToggle("autoSave")}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": {
                      color: "#667eea",
                    },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                      backgroundColor: "#667eea",
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Security */}
          <Paper
            sx={{
              padding: "2.5rem",
              borderRadius: "24px",
              backgroundColor: "white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "2rem",
              }}
            >
              <Box
                sx={{
                  width: "48px",
                  height: "48px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SecurityIcon sx={{ color: "white", fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#0f172a" }}>
                Security
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <Button
                variant="outlined"
                fullWidth
                sx={{
                  borderColor: "#667eea",
                  color: "#667eea",
                  borderRadius: "12px",
                  padding: "0.875rem",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#764ba2",
                    background: "rgba(102, 126, 234, 0.05)",
                  },
                }}
              >
                Change Password
              </Button>

              <Button
                variant="outlined"
                fullWidth
                sx={{
                  borderColor: "#667eea",
                  color: "#667eea",
                  borderRadius: "12px",
                  padding: "0.875rem",
                  textTransform: "none",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: "#764ba2",
                    background: "rgba(102, 126, 234, 0.05)",
                  },
                }}
              >
                Enable Two-Factor Authentication
              </Button>

              <Divider sx={{ margin: "1rem 0" }} />

              <Button
                variant="outlined"
                fullWidth
                color="error"
                sx={{
                  borderRadius: "12px",
                  padding: "0.875rem",
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                Delete Account
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Save Button */}
        <Box sx={{ marginTop: "2rem", textAlign: "center" }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              padding: "1rem 3rem",
              fontSize: "1rem",
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
                boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5)",
              },
            }}
          >
            Save All Changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SettingsContainer;
