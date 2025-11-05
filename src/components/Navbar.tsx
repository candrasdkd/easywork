import * as React from 'react';
import {
    AppBar, Box, CssBaseline, Divider, Drawer, IconButton,
    List, ListItem, ListItemButton, ListItemText,
    Toolbar, Button, Avatar, Menu, MenuItem, Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { NavLink, useNavigate } from 'react-router'; // atau 'react-router-dom'
import { useThemeMode } from '../hooks/themes/ThemeContext';

// Firebase
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const drawerWidth = 240;
const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Data Kalibrasi', path: '/data-inputan' },
    { label: 'Data Inventaris', path: '/data-inventaris' },
];

function getInitials(name?: string | null) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
}

export default function DrawerAppBar(props: { window?: () => Window }) {
    const { window } = props;
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const { mode, toggleColorMode } = useThemeMode();
    const [openConfirm, setOpenConfirm] = React.useState(false);
    // === Auth state ===
    const [user, setUser] = React.useState<User | null>(auth.currentUser ?? null);
    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
    }, []);

    // Menu akun
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const accountMenuOpen = Boolean(anchorEl);
    const navigate = useNavigate();

    const handleDrawerToggle = () => setMobileOpen((prev) => !prev);
    const handleOpenAccountMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleCloseAccountMenu = () => setAnchorEl(null);

    const handleGoProfile = () => {
        handleCloseAccountMenu();
        navigate('/profile');
    };

    const handleOpenConfirm = () => setOpenConfirm(true);
    const handleCloseConfirm = () => setOpenConfirm(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            handleCloseAccountMenu();
            navigate('/login', { replace: true });
        } catch (e) {
            console.error('Logout failed:', e);
        }
    };

    const drawer = (
        <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
            <Divider />
            <List>
                {navItems.map((item) => (
                    <ListItem key={item.label} disablePadding>
                        <ListItemButton
                            component={NavLink}
                            to={item.path}
                            sx={{
                                textAlign: 'center',
                                '&.active': {
                                    backgroundColor: 'primary.main',
                                    color: 'white',
                                },
                            }}
                        >
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    const container = window !== undefined ? () => window().document.body : undefined;

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar component="nav">
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    {/* Kiri: Menu icon dan logo */}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2, display: { sm: 'none' } }}
                        >
                            <MenuIcon />
                        </IconButton>
                        {/* (opsional) taruh logo/brand di sini */}
                    </Box>

                    {/* Kanan: Navigation + Theme Toggle + Account */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            {navItems.map((item) => (
                                <Button
                                    key={item.label}
                                    component={NavLink}
                                    to={item.path}
                                    sx={{
                                        color: '#fff',
                                        '&.active': {
                                            borderBottom: '2px solid #fff',
                                            fontWeight: 'bold',
                                        },
                                    }}
                                >
                                    {item.label}
                                </Button>
                            ))}
                        </Box>

                        {/* Toggle tema */}
                        <IconButton
                            onClick={toggleColorMode}
                            sx={{
                                ml: 1,
                                transition: 'transform 0.3s ease',
                                '&:hover': { transform: 'rotate(20deg)' },
                            }}
                        >
                            {mode === 'dark' ? (
                                <LightModeIcon sx={{ color: '#FFD700', textShadow: '0 0 5px #FFD700' }} />
                            ) : (
                                <DarkModeIcon sx={{ color: '#9C27B0', textShadow: '0 0 4px #9C27B0' }} />
                            )}
                        </IconButton>

                        {/* Account: tampilkan avatar user */}
                        <IconButton onClick={handleOpenAccountMenu} sx={{ ml: 0.5 }}>
                            {user?.photoURL ? (
                                <Avatar src={user.photoURL} alt={user.displayName ?? 'User'} sx={{ width: 28, height: 28 }} />
                            ) : (
                                <Avatar sx={{ width: 28, height: 28 }}>
                                    {user?.displayName ? getInitials(user.displayName) : <AccountCircleIcon />}
                                </Avatar>
                            )}
                        </IconButton>

                        <Menu
                            anchorEl={anchorEl}
                            open={accountMenuOpen}
                            onClose={handleCloseAccountMenu}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        >
                            {user && (
                                <Box sx={{ px: 2, pt: 1, pb: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {user.displayName || 'Pengguna'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {user.email}
                                    </Typography>
                                </Box>
                            )}
                            <Divider />
                            <MenuItem onClick={handleGoProfile}>Profil</MenuItem>
                            <MenuItem onClick={handleOpenConfirm}>Logout</MenuItem>
                        </Menu>

                        {/* === Konfirmasi Logout === */}
                        <Dialog
                            open={openConfirm}
                            onClose={handleCloseConfirm}
                            aria-labelledby="logout-dialog-title"
                            aria-describedby="logout-dialog-description"
                        >
                            <DialogTitle id="logout-dialog-title">Konfirmasi Logout</DialogTitle>
                            <DialogContent>
                                <DialogContentText id="logout-dialog-description">
                                    Apakah Anda yakin ingin keluar dari aplikasi?
                                </DialogContentText>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={handleCloseConfirm}>Batal</Button>
                                <Button onClick={handleLogout} color="error" variant="contained" autoFocus>
                                    Ya, Logout
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                </Toolbar>
            </AppBar>

            <nav>
                <Drawer
                    container={container}
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
            </nav>
        </Box>
    );
}
