import { Avatar, Box, Typography } from "@mui/material";
import { useMsal } from "@azure/msal-react";

interface UserProfileProps {
  /** Dark is used on the purple sidebar; light is used in the admin menu. */
  tone?: "dark" | "light";
}

/**
 * Displays a compact profile card using identity data directly from MSAL.
 * The avatar is generated from the first character of the user's name, so no profile
 * image or duplicated account data needs to be stored by the application.
 */
const UserProfile = ({ tone = "light" }: UserProfileProps) => {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];

  if (!account) return null;

  const displayName = account.name?.trim() || "Nagarro user";
  const email = account.username;
  const avatarLabel = (displayName || email).charAt(0).toUpperCase();
  const isDark = tone === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        minWidth: 0,
        p: 1.25,
        borderRadius: "14px",
        background: isDark
          ? "rgba(255, 255, 255, 0.1)"
          : "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.16)"
          : "1px solid #e2e8f0",
        boxShadow: isDark ? "none" : "0 4px 12px rgba(15, 23, 42, 0.08)",
      }}
    >
      <Avatar
        aria-label={`${displayName} profile`}
        sx={{
          width: 42,
          height: 42,
          flex: "0 0 42px",
          background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
          color: "#fff",
          fontSize: "1.05rem",
          fontWeight: 800,
          boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)",
        }}
      >
        {avatarLabel}
      </Avatar>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          title={displayName}
          sx={{
            color: isDark ? "#fff" : "#0f172a",
            fontSize: "0.9rem",
            fontWeight: 750,
            lineHeight: 1.35,
          }}
        >
          {displayName}
        </Typography>
        <Typography
          noWrap
          title={email}
          sx={{
            mt: 0.25,
            color: isDark ? "rgba(255, 255, 255, 0.72)" : "#64748b",
            fontSize: "0.72rem",
            lineHeight: 1.35,
          }}
        >
          {email}
        </Typography>
      </Box>
    </Box>
  );
};

export default UserProfile;

