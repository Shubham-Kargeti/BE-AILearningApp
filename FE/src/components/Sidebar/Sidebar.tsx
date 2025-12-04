import { useState } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Person,
  Settings,
  Dashboard,
  Logout as LogoutIcon,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.scss";

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/app/dashboard" },
    { text: "Profile", icon: <Person />, path: "/app/profile-setup" },
    { text: "Settings", icon: <Settings />, path: "/app/settings" },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <>
      <Drawer
        variant="permanent"
        open={open}
        className={`sidebar-drawer ${open ? "open" : "collapsed"}`}
      >
        {/* Sidebar Toggle */}
        <IconButton
          onClick={() => setOpen(!open)}
          className="sidebar-toggle-btn"
        >
          <MenuIcon />
        </IconButton>

        {/* MAIN MENU */}
        <List className="sidebar-list">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItemButton
                key={item.text}
                onClick={() => navigate(item.path)}
                className={`sidebar-item ${isActive ? "active" : ""}`}
              >
                <ListItemIcon
                  className={`sidebar-icon ${isActive ? "active" : ""}`}
                >
                  {item.icon}
                </ListItemIcon>

                {open && (
                  <ListItemText
                    primary={item.text}
                    className={`sidebar-text ${isActive ? "active" : ""}`}
                  />
                )}
              </ListItemButton>
            );
          })}

          {/* ---- LOGOUT BUTTON (inside same List) ---- */}
          <Divider style={{ margin: "12px 0" }} />

          <ListItemButton
            className="sidebar-item logout-item"
            onClick={() => setShowLogoutModal(true)}
          >
            <ListItemIcon className="sidebar-icon">
              <LogoutIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Logout" className="sidebar-text" />}
          </ListItemButton>
        </List>
      </Drawer>

      {/* LOGOUT MODAL */}
      <Dialog open={showLogoutModal} onClose={() => setShowLogoutModal(false)}>
        <DialogTitle>Are you sure you want to logout?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setShowLogoutModal(false)}>Cancel</Button>
          <Button onClick={handleLogout} color="error" variant="contained">
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Sidebar;
