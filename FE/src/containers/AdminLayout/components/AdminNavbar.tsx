import { useState } from "react";
import { FaBell, FaUserCircle } from "react-icons/fa";
import "./AdminNavbar.scss";
import { Menu, MenuItem, Dialog, DialogTitle, DialogActions, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const AdminNavbar = () => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
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
        

        <MenuItem onClick={openLogoutDialog} sx={{ color: "red" }}>
          Logout
        </MenuItem>
      </Menu>

      {/* CONFIRM LOGOUT POPUP */}
      <Dialog open={showLogoutDialog} onClose={() => setShowLogoutDialog(false)}>
        <DialogTitle>Are you sure you want to logout?</DialogTitle>
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
