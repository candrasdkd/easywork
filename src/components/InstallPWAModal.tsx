import { useState, useEffect } from 'react';
import {
    Modal,
    Box,
    Typography,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
} from '@mui/material';
import {
    Close,
    InstallDesktop,
    Smartphone,
    OfflineBolt,
    Notifications,
    Share
} from '@mui/icons-material';
import { usePWAInstall } from '../hooks/pwa/usePWAInstall';
import { isIOS } from '../lib/deviceDetect';

const STORAGE_KEY = 'pwa_prompt_seen';
const PROMPT_DELAY = 3000;

// Function to check if app is running in standalone mode
const isStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
    );
};

export const InstallPWAModal = () => {
    const { isInstallable, triggerInstall } = usePWAInstall();
    const [showModal, setShowModal] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);
    const isIOSDevice = isIOS();

    useEffect(() => {
        setIsAppInstalled(isStandalone());
    }, []);

    useEffect(() => {
        if (isAppInstalled) return;

        const hasSeenPrompt = localStorage.getItem(STORAGE_KEY);
        if (hasSeenPrompt === 'true') return;

        const canShowPrompt = isInstallable || isIOSDevice;

        if (canShowPrompt) {
            const timer = setTimeout(() => {
                setShowModal(true);
            }, PROMPT_DELAY);

            return () => clearTimeout(timer);
        }
    }, [isInstallable, isIOSDevice, isAppInstalled]);

    const handleClose = () => {
        setShowModal(false);
        localStorage.setItem(STORAGE_KEY, 'true');
    };

    const handleInstallClick = async () => {
        try {
            await triggerInstall();
            handleClose();
        } catch (error) {
            console.error('Installasi gagal:', error);
            handleClose();
        }
    };

    if (!showModal || isAppInstalled) {
        return null;
    }

    return (
        <Modal
            open={showModal}
            onClose={handleClose}
            aria-labelledby="pwa-install-title"
            aria-describedby="pwa-install-description"
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2
            }}
        >
            <Paper
                sx={{
                    position: 'relative',
                    maxWidth: 500,
                    width: '100%',
                    p: 3,
                    m: 2,
                    outline: 'none',
                    maxHeight: '90vh',
                    overflow: 'auto'
                }}
                elevation={24}
            >
                {/* Close Button */}
                <IconButton
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: 'text.secondary'
                    }}
                >
                    <Close />
                </IconButton>

                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Box
                        component="img"
                        src="/logo.svg"
                        alt="Easywork Logo"
                        sx={{
                            width: 40,
                            height: 40,
                            mr: 2
                        }}
                    />
                    <Box>
                        <Typography variant="h6" component="h2" fontWeight="bold">
                            Install Easywork
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Akses lebih cepat dan offline
                        </Typography>
                    </Box>
                </Box>

                {/* Content */}
                <Box sx={{ mb: 3 }}>
                    {isInstallable ? (
                        <Box>
                            <Typography variant="body1" color="text.primary" gutterBottom>
                                Install aplikasi untuk pengalaman yang lebih baik:
                            </Typography>

                            <List dense sx={{ mb: 2 }}>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Smartphone fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText primary="Akses cepat dari layar utama" />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <OfflineBolt fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText primary="Bekerja secara offline" />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Notifications fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText primary="Notifikasi real-time" />
                                </ListItem>
                            </List>
                        </Box>
                    ) : isIOSDevice ? (
                        <Box>
                            <Typography variant="body1" color="text.primary" gutterBottom>
                                Untuk install di perangkat iOS:
                            </Typography>

                            <List dense>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Share fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography variant="body2">
                                                Tap ikon <strong>"Share"</strong> di browser Safari
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <InstallDesktop fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography variant="body2">
                                                Pilih <strong>"Add to Home Screen"</strong>
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <Smartphone fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography variant="body2">
                                                Konfirmasi dengan tap <strong>"Add"</strong>
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            </List>
                        </Box>
                    ) : null}
                </Box>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {isInstallable && (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<InstallDesktop />}
                            onClick={handleInstallClick}
                            sx={{
                                py: 1.5,
                                borderRadius: 2,
                                fontWeight: 'bold'
                            }}
                        >
                            Install Aplikasi
                        </Button>
                    )}

                    <Button
                        variant={isInstallable ? "outlined" : "contained"}
                        size="large"
                        onClick={handleClose}
                        sx={{
                            py: 1.5,
                            borderRadius: 2,
                            fontWeight: 'medium'
                        }}
                    >
                        {isInstallable ? 'Nanti Saja' : 'Mengerti'}
                    </Button>
                </Box>

                {/* Footer Note */}
                <Typography
                    variant="caption"
                    color="text.secondary"
                    align="center"
                    sx={{ mt: 2, display: 'block' }}
                >
                    Dapat diuninstall kapan saja
                </Typography>
            </Paper>
        </Modal>
    );
};