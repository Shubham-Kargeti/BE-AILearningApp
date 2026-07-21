import { useState } from "react";
import { FaBell, FaUserCircle } from "react-icons/fa";
import "./AdminNavbar.scss";
import { Alert, Box, Menu, MenuItem, Dialog, DialogTitle, DialogActions, Button } from "@mui/material";
import { useMsal } from "@azure/msal-react";
import UserProfile from "../../../auth/UserProfile";
import { clearApplicationSession } from "../../../auth/appSession";

const AdminNavbar = () => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { instance } = useMsal();

  const handleMenuOpen = (event: React.MouseEvent<HTMLDivElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const openLogoutDialog = () => {
    setShowLogoutDialog(true);
    handleMenuClose();
  };

  const handleLogout = async () => {
    try {
      setLogoutError("");
      clearApplicationSession();
      await instance.logoutRedirect({
        account: instance.getActiveAccount() ?? undefined,
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      setLogoutError(`Microsoft sign-out failed: ${message}`);
    }
  };

  return (
    <>
      <div className="admin-navbar">
        <h2 className="admin-title">Admin Dashboard</h2>

        <div className="admin-icons">
          <FaBell className="nav-icon" size={20} />

          {/* USER ICON */}
          <div className="user-icon-wrapper" onClick={handleMenuOpen}>
            <FaUserCircle className="nav-icon" size={26} />
          </div>
        </div>
      </div>

      {/* USER MENU DROPDOWN */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1, maxWidth: 320 }}>
          <UserProfile />
        </Box>

        <MenuItem onClick={openLogoutDialog} sx={{ color: "red" }}>
          Logout
        </MenuItem>
      </Menu>

      {/* CONFIRM LOGOUT POPUP */}
      <Dialog open={showLogoutDialog} onClose={() => setShowLogoutDialog(false)}>
        <DialogTitle>Are you sure you want to logout?</DialogTitle>
        {logoutError && <Alert severity="error" sx={{ mx: 3 }}>{logoutError}</Alert>}
        <DialogActions>
          <Button onClick={() => setShowLogoutDialog(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleLogout}>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminNavbar;
