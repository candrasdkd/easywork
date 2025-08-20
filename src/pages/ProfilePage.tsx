// src/pages/ProfilePage.tsx
import * as React from 'react';
import {
    Avatar, Box, Card, CardContent, Chip, Grid, Stack, Typography,
    Button, TextField, CircularProgress, Alert, Dialog, DialogTitle,
    DialogContent, DialogActions, Snackbar, Paper,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import LogoutIcon from '@mui/icons-material/Logout';
import VerifiedIcon from '@mui/icons-material/Verified';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

// ⬇️ pakai helper dari firebase.ts
import { auth, db, updateDisplayName as fbUpdateDisplayName, signOut as fbSignOut } from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ProfilePage() {
    const [user, setUser] = React.useState<User | null>(auth.currentUser ?? null);

    // === PIC (Penanggung jawab) ===
    const [picName, setPicName] = React.useState('');
    const [loadingPic, setLoadingPic] = React.useState(false);
    const [savingPic, setSavingPic] = React.useState(false);
    const [errorPic, setErrorPic] = React.useState<string | null>(null);
    const [savedOk, setSavedOk] = React.useState(false);

    // === Edit display name ===
    const [displayName, setDisplayName] = React.useState('');
    const [savingName, setSavingName] = React.useState(false);
    const [errorName, setErrorName] = React.useState<string | null>(null);

    // === Logout confirm ===
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [logoutLoading, setLogoutLoading] = React.useState(false);

    // === Snackbar ===
    const [snack, setSnack] = React.useState<{ open: boolean; msg: string; type: 'success' | 'error' }>({
        open: false, msg: '', type: 'success'
    });

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setSavedOk(false);
            setErrorPic(null);
            setPicName('');
            setErrorName(null);
            setDisplayName(u?.displayName ?? '');

            if (u) {
                setLoadingPic(true);
                try {
                    const ref = doc(db, 'users', u.uid);
                    const snap = await getDoc(ref);
                    const data = snap.data() as any | undefined;
                    setPicName(data?.pic_name ?? '');
                    // Optional: kalau mau pastikan displayName dari Firestore tampil (jika ada override)
                    if (!u.displayName && data?.display_name) setDisplayName(data.display_name);
                } catch (err: any) {
                    setErrorPic(err?.message ?? 'Gagal memuat data penanggung jawab.');
                } finally {
                    setLoadingPic(false);
                }
            }
        });
        return () => unsub();
    }, []);

    const handleSavePicName = async () => {
        if (!user) return;
        setSavingPic(true);
        setErrorPic(null);
        try {
            const ref = doc(db, 'users', user.uid);
            await setDoc(ref, { uuid_account: user.uid, pic_name: picName?.trim() ?? '' }, { merge: true });
            setSavedOk(true);
            setSnack({ open: true, msg: 'Nama penanggung jawab disimpan ✅', type: 'success' });
        } catch (err: any) {
            const msg = err?.message ?? 'Gagal menyimpan penanggung jawab.';
            setErrorPic(msg);
            setSnack({ open: true, msg, type: 'error' });
        } finally {
            setSavingPic(false);
        }
    };

    // ⬇️ Simpan nama lengkap (Auth + Firestore)
    const handleSaveDisplayName = async () => {
        if (!user) return;
        const name = displayName.trim();
        if (!name) { setErrorName('Nama tidak boleh kosong.'); return; }

        setSavingName(true);
        setErrorName(null);
        try {
            await fbUpdateDisplayName(user, name);
            setSnack({ open: true, msg: 'Nama profil diperbarui ✅', type: 'success' });
        } catch (e: any) {
            setErrorName(e?.message ?? 'Gagal memperbarui nama.');
            setSnack({ open: true, msg: e?.message ?? 'Gagal memperbarui nama.', type: 'error' });
        } finally {
            setSavingName(false);
        }
    };

    const openConfirmLogout = () => setConfirmOpen(true);
    const closeConfirmLogout = () => setConfirmOpen(false);

    const handleLogout = async () => {
        setLogoutLoading(true);
        try {
            await fbSignOut();
            // optional: navigate('/login', { replace: true });
        } catch (e: any) {
            setSnack({ open: true, msg: e?.message ?? 'Logout gagal', type: 'error' });
        } finally {
            setLogoutLoading(false);
            setConfirmOpen(false);
        }
    };

    if (!user) {
        return (
            <Box sx={{ mt: { xs: 8, sm: 10 }, display: 'flex', justifyContent: 'center', px: 2 }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: 4, borderRadius: 3, textAlign: 'center', bgcolor: 'background.paper',
                        border: (t) => `1px solid ${t.palette.divider}`, width: '100%', maxWidth: 560,
                    }}
                >
                    <Typography variant="h6" gutterBottom>Belum ada user yang login</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Silakan login terlebih dahulu untuk melihat profil.
                    </Typography>
                </Paper>
            </Box>
        );
    }

    const meta = user.metadata;

    return (
        <Box sx={{ pb: 8 }}>
            {/* Header */}
            <Box sx={{
                pt: { xs: 8, sm: 10 }, pb: { xs: 4, sm: 6 }, px: 2,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.10) 100%)'
            }}>
                <Box sx={{
                    maxWidth: 1000, mx: 'auto',
                    display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between',
                    gap: 2, flexDirection: { xs: 'column', sm: 'row' },
                }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                            src={user.photoURL ?? undefined}
                            alt={user.displayName ?? 'User'}
                            sx={{ width: { xs: 64, sm: 72 }, height: { xs: 64, sm: 72 }, boxShadow: 3, flexShrink: 0 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h5" sx={{
                                fontWeight: 700, letterSpacing: 0.2,
                                fontSize: { xs: '1.25rem', sm: '1.5rem' }, wordBreak: 'break-word'
                            }}>
                                {user.displayName || 'Pengguna'}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                    {user.email ?? '—'}
                                </Typography>
                                {user.emailVerified ? (
                                    <Chip icon={<VerifiedIcon />} size="small" color="success" label="Terverifikasi" sx={{ ml: 0.5 }} />
                                ) : (
                                    <Chip icon={<ShieldOutlinedIcon />} size="small" label="Belum Verifikasi" sx={{ ml: 0.5 }} />
                                )}
                            </Stack>
                        </Box>
                    </Stack>

                    <Button
                        color="error" variant="contained"
                        startIcon={logoutLoading ? <CircularProgress size={18} /> : <LogoutIcon />}
                        onClick={openConfirmLogout} disabled={logoutLoading}
                        sx={{ borderRadius: 2, alignSelf: { xs: 'stretch', sm: 'center' } }}
                    >
                        Logout
                    </Button>
                </Box>
            </Box>

            {/* Content */}
            <Box sx={{ px: 2, mt: { xs: -3, sm: -4 } }}>
                <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
                    <Grid container spacing={2}>
                        {/* Info Akun */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, backdropFilter: 'blur(4px)' }}>
                                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                                        Informasi Akun
                                    </Typography>

                                    <Stack spacing={1.5}>
                                        <TextField
                                            label="Nama Lengkap"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            fullWidth
                                        />
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                startIcon={savingName ? <CircularProgress size={18} /> : <SaveIcon />}
                                                onClick={handleSaveDisplayName}
                                                disabled={savingName}
                                                sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                                            >
                                                Simpan Nama
                                            </Button>
                                            {errorName && <Alert severity="error" sx={{ flex: 1 }}>{errorName}</Alert>}
                                        </Stack>

                                        <InfoRow label="Dibuat" value={meta.creationTime ? new Date(meta.creationTime).toLocaleString() : '—'} />
                                        <InfoRow label="Terakhir Login" value={meta.lastSignInTime ? new Date(meta.lastSignInTime).toLocaleString() : '—'} />
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Penanggung Jawab */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
                                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                                        Penanggung Jawab
                                    </Typography>

                                    <Stack spacing={1.5}>
                                        <TextField
                                            label="Nama Penanggung Jawab"
                                            placeholder="Masukkan nama penanggung jawab"
                                            value={picName}
                                            onChange={(e) => setPicName(e.target.value)}
                                            fullWidth
                                            disabled={loadingPic || savingPic}
                                            inputProps={{ maxLength: 120 }}
                                        />

                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                            <Button
                                                variant="contained"
                                                startIcon={savingPic ? <CircularProgress size={18} /> : <SaveIcon />}
                                                onClick={handleSavePicName}
                                                disabled={loadingPic || savingPic}
                                                sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                                            >
                                                Simpan
                                            </Button>
                                            {loadingPic && (
                                                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                                    Memuat data…
                                                </Typography>
                                            )}
                                        </Stack>

                                        {errorPic && <Alert severity="error">{errorPic}</Alert>}
                                        {savedOk && <Alert severity="success">Berhasil disimpan.</Alert>}
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {/* Dialog Logout */}
            <Dialog open={confirmOpen} onClose={closeConfirmLogout} fullWidth maxWidth="xs">
                <DialogTitle>Keluar dari akun?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Kamu akan keluar dari aplikasi. Lanjutkan?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeConfirmLogout}>Batal</Button>
                    <Button
                        color="error" variant="contained" onClick={handleLogout}
                        startIcon={logoutLoading ? <CircularProgress size={18} /> : <LogoutIcon />}
                        disabled={logoutLoading}
                    >
                        Logout
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                autoHideDuration={2200}
                message={snack.msg}
            />
        </Box>
    );
}

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
    const [copied, setCopied] = React.useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(value).then(() => {
            setCopied(true); setTimeout(() => setCopied(false), 1200);
        });
    };
    return (
        <Box sx={{
            display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '160px 1fr auto' },
            gap: 1, alignItems: { xs: 'start', sm: 'center' },
        }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="subtitle2" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {value}
            </Typography>
            {copyable && (
                <Button size="small" variant="outlined" onClick={copy}
                    sx={{ justifySelf: { xs: 'start', sm: 'end' }, width: { xs: '100%', sm: 'auto' } }}>
                    {copied ? 'Tersalin' : 'Salin'}
                </Button>
            )}
        </Box>
    );
}
