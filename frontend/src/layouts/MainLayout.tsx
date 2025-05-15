import React from 'react';
import { AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText, Toolbar, Typography } from '@mui/material';
import { Menu as MenuIcon, Timer, Assignment, FolderOpen, People, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { text: 'Time Entries', icon: <Timer />, path: '/time-entries' },
        { text: 'Tasks', icon: <Assignment />, path: '/tasks' },
        { text: 'Projects', icon: <FolderOpen />, path: '/projects' },
    ];

    if (isAdmin()) {
        menuItems.push({ text: 'Users', icon: <People />, path: '/users' });
    }

    const drawer = (
        <div>
            <Toolbar />
            <List>
                {menuItems.map((item) => (
                    <ListItem button key={item.text} onClick={() => navigate(item.path)}>
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.text} />
                    </ListItem>
                ))}
                <ListItem button onClick={logout}>
                    <ListItemIcon><Logout /></ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItem>
            </List>
        </div>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        Time Tracker
                    </Typography>
                    {user && (
                        <Typography variant="body1">
                            {user.full_name}
                        </Typography>
                    )}
                </Toolbar>
            </AppBar>
            <Box
                component="nav"
                sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    marginTop: '64px',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}; 