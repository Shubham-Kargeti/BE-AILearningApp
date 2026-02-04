import { useState } from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Avatar,
  Chip,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Person,
  Settings,
  Dashboard,
  Logout as LogoutIcon,
  LocalFireDepartment,
  Assessment,
} from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.scss";

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const userName = localStorage.getItem("userName") || "User";
  const userEmail = localStorage.getItem("userEmail") || "";

  const menuItems = [
    { text: "Dashboard", icon: <Dashboard />, path: "/app/dashboard", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { text: "Assessments", icon: <Assessment />, path: "/app/assessments", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
    { text: "Self Assessment", icon: <Person />, path: "/app/profile-setup", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
    { text: "Settings", icon: <Settings />, path: "/app/settings", gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
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
        sx={{
          '& .MuiDrawer-paper': {
            background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
            borderRight: 'none',
            boxShadow: '4px 0 24px rgba(0,0,0,0.1)',
          }
        }}
      >
        {/* Header Section */}
        <Box>
          {/* Toggle Button */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: open ? 'space-between' : 'center',
            alignItems: 'center',
            padding: '1.5rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {open && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Box sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  color: '#667eea',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  AI
                </Box>
                <Typography sx={{ 
                  fontWeight: 700, 
                  fontSize: '1.125rem', 
                  color: 'white',
                  letterSpacing: '-0.5px'
                }}>
                  Learning
                </Typography>
              </Box>
            )}
            <IconButton
              onClick={() => setOpen(!open)}
              sx={{
                color: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  transform: 'rotate(90deg)',
                },
                transition: 'all 0.3s ease',
                width: 40,
                height: 40,
              }}
            >
              <MenuIcon />
            </IconButton>
          </Box>

          {/* User Profile Section */}
          {open && (
            <Box sx={{ 
              padding: '1.5rem 1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '0.75rem'
              }}>
                <Avatar sx={{ 
                  width: 48, 
                  height: 48,
                  background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)',
                  color: '#667eea',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ 
                    fontWeight: 700, 
                    color: 'white',
                    fontSize: '0.9375rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {userName}
                  </Typography>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    color: 'rgba(255,255,255,0.7)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {userEmail}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Chip 
                  icon={<LocalFireDepartment sx={{ fontSize: 14 }} />}
                  label="5 Day Streak"
                  size="small"
                  sx={{ 
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(10px)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    height: '24px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    '& .MuiChip-icon': { color: '#fbbf24' }
                  }}
                />
              </Box>
            </Box>
          )}

          {/* Navigation Menu */}
          <List sx={{ padding: '1rem 0.5rem', flex: 1 }}>
            {menuItems.map((item, _index) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.text}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: '12px',
                    margin: '0.375rem 0',
                    padding: open ? '0.875rem 1rem' : '0.875rem',
                    position: 'relative',
                    overflow: 'hidden',
                    background: isActive 
                      ? 'rgba(255,255,255,0.2)' 
                      : 'transparent',
                    backdropFilter: isActive ? 'blur(10px)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: isActive 
                      ? '1px solid rgba(255,255,255,0.3)' 
                      : '1px solid transparent',
                    justifyContent: open ? 'flex-start' : 'center',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(10px)',
                      transform: 'translateX(4px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                    },
                    '&::before': isActive ? {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '60%',
                      background: 'white',
                      borderRadius: '0 4px 4px 0',
                    } : {}
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: open ? 40 : 0,
                      color: 'white',
                      justifyContent: 'center',
                      '& svg': {
                        fontSize: '1.375rem',
                        filter: isActive ? 'drop-shadow(0 2px 4px rgba(255,255,255,0.3))' : 'none',
                      }
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>

                  {open && (
                    <ListItemText
                      primary={item.text}
                      sx={{
                        '& .MuiListItemText-primary': {
                          color: 'white',
                          fontWeight: isActive ? 700 : 600,
                          fontSize: '0.9375rem',
                          letterSpacing: '-0.2px'
                        }
                      }}
                    />
                  )}
                  
                  {isActive && open && (
                    <Box sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                    }} />
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* Footer Section */}
        <Box sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '1rem 0.5rem'
        }}>
          <ListItemButton
            onClick={() => setShowLogoutModal(true)}
            sx={{
              borderRadius: '12px',
              padding: open ? '0.875rem 1rem' : '0.875rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              justifyContent: open ? 'flex-start' : 'center',
              transition: 'all 0.3s ease',
              '&:hover': {
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: open ? 40 : 0,
                color: '#fca5a5',
                justifyContent: 'center',
                '& svg': { fontSize: '1.375rem' }
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {open && (
              <ListItemText
                primary="Logout"
                sx={{
                  '& .MuiListItemText-primary': {
                    color: '#fca5a5',
                    fontWeight: 600,
                    fontSize: '0.9375rem'
                  }
                }}
              />
            )}
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Enhanced Logout Modal */}
      <Dialog 
        open={showLogoutModal} 
        onClose={() => setShowLogoutModal(false)}
        PaperProps={{
          sx: {
            borderRadius: '20px',
            padding: '1rem',
            minWidth: '400px',
            background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)',
          }
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center',
          paddingTop: '1.5rem'
        }}>
          <Box sx={{ 
            width: 64,
            height: 64,
            margin: '0 auto 1rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <LogoutIcon sx={{ fontSize: 32, color: '#ef4444' }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Confirm Logout
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ textAlign: 'center', color: '#64748b', fontSize: '0.9375rem' }}>
            Are you sure you want to logout? You'll need to sign in again to access your dashboard.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: '0.75rem', padding: '0 1.5rem 1.5rem' }}>
          <Button 
            onClick={() => setShowLogoutModal(false)}
            sx={{
              borderRadius: '12px',
              padding: '0.75rem 2rem',
              textTransform: 'none',
              fontWeight: 600,
              border: '2px solid #e2e8f0',
              color: '#64748b',
              '&:hover': {
                border: '2px solid #cbd5e1',
                background: '#f8fafc'
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleLogout}
            variant="contained"
            sx={{
              borderRadius: '12px',
              padding: '0.75rem 2rem',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
              }
            }}
          >
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Sidebar;
