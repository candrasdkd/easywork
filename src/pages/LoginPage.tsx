// src/pages/Login.tsx
import * as React from 'react'
import {
    Alert,
    Box,
    Paper,
    Typography,
    Divider,
    Stack,
    IconButton,
    Tooltip,
} from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useLocation, useNavigate } from 'react-router'
import GoogleLoginButton from '../components/GoogleLoginButton' // asumsi sudah ada
import { finishGoogleRedirect } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

function useInAppBrowserHint() {
    const [inAppHint, setInAppHint] = React.useState(false)
    React.useEffect(() => {
        const ua = navigator.userAgent || ''
        const isInApp =
            /\bFBAN|FBAV|Instagram|Line\/|FB_IAB|Twitter|TikTok|VkShare|Pinterest|WeChat|Messenger\b/i.test(
                ua
            )
        setInAppHint(isInApp)
    }, [])
    return inAppHint
}

export default function Login() {
    const { user } = useAuth()
    const loc = useLocation()
    const navigate = useNavigate()
    const [error, setError] = React.useState<string | null>(null)
    const inAppHint = useInAppBrowserHint()

    // Redirect kalau sudah login
    React.useEffect(() => {
        if (user) {
            const to = (loc.state as any)?.from?.pathname || '/'
            navigate(to, { replace: true })
        }
    }, [user, loc.state, navigate])

    // Selesaikan redirect dari Google
    React.useEffect(() => {
        finishGoogleRedirect()
            .then((cred) => {
                if (cred?.user) {
                    const to = (loc.state as any)?.from?.pathname || '/'
                    navigate(to, { replace: true })
                }
            })
            .catch((e: any) =>
                setError(e?.message ?? 'Gagal menyelesaikan login.')
            )
        // hanya dipanggil sekali saat mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Box
            sx={{
                minHeight: '100dvh',
                display: 'grid',
                placeItems: 'center',
                background: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'radial-gradient(60rem 60rem at 10% 10%, rgba(99,102,241,0.25), transparent), radial-gradient(50rem 50rem at 90% 90%, rgba(236,72,153,0.22), transparent), linear-gradient(160deg, #0b1020 0%, #111827 100%)'
                        : 'radial-gradient(60rem 60rem at 10% 10%, rgba(99,102,241,0.25), transparent), radial-gradient(50rem 50rem at 90% 90%, rgba(236,72,153,0.18), transparent), linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)',
                px: 2,
            }}
        >
            {/* Dekorasi blur blob */}
            <Box
                aria-hidden
                sx={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    '&::before, &::after': {
                        content: '""',
                        position: 'absolute',
                        filter: 'blur(64px)',
                        opacity: 0.35,
                        borderRadius: '9999px',
                    },
                    '&::before': {
                        width: 280,
                        height: 280,
                        top: 80,
                        left: 80,
                        background: 'linear-gradient(45deg, #6366F1, #22D3EE)',
                    },
                    '&::after': {
                        width: 320,
                        height: 320,
                        bottom: 60,
                        right: 80,
                        background: 'linear-gradient(45deg, #F472B6, #F59E0B)',
                    },
                }}
            />

            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 880,
                    borderRadius: 4,
                    overflow: 'hidden',
                    backdropFilter: 'blur(10px)',
                    border: (t) =>
                        t.palette.mode === 'dark'
                            ? '1px solid rgba(255,255,255,0.08)'
                            : '1px solid rgba(0,0,0,0.06)',
                    boxShadow: (t) =>
                        t.palette.mode === 'dark'
                            ? '0 10px 40px rgba(0,0,0,0.55)'
                            : '0 10px 40px rgba(31,41,55,0.16)',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
                }}
            >
                {/* Left / Form */}
                <Box sx={{ p: { xs: 3, md: 5 } }}>
                    {/* Brand / Header */}
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ mb: 2 }}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                                sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 2,
                                    background: (t) =>
                                        t.palette.mode === 'dark'
                                            ? 'linear-gradient(45deg, #6366F1, #22D3EE)'
                                            : 'linear-gradient(45deg, #4F46E5, #06B6D4)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: 18,
                                }}
                            >
                                E
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
                                EasyWork
                            </Typography>
                        </Stack>

                        {/* Theme hint (opsional) */}
                        <Tooltip title="Ikuti toggle tema di navbar utama">
                            <span>
                                <IconButton disabled size="small">
                                    <LightModeIcon fontSize="small" />
                                    <DarkModeIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>

                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 1 }}>
                        Selamat datang kembali
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Masuk untuk melanjutkan aktivitasmu. Hanya butuh satu klik dengan akun Google.
                    </Typography>

                    {inAppHint && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Sepertinya Anda membuka dari browser dalam aplikasi (mis. Instagram/FB).
                            Login Google sering tidak didukung di sini. Tap menu ⋯ lalu pilih
                            <b> Open in Chrome/Safari</b>, kemudian coba lagi.
                        </Alert>
                    )}

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Stack spacing={2}>
                        <GoogleLoginButton
                            onError={setError}
                            onSuccess={() => {
                                const to = (loc.state as any)?.from?.pathname || '/'
                                navigate(to, { replace: true })
                            }}
                        />
                        <Divider flexItem>atau</Divider>

                        <Box
                            sx={{
                                fontSize: 12,
                                color: 'text.secondary',
                                textAlign: 'center',
                            }}
                        >
                            Dengan masuk, Anda menyetujui{' '}
                            <Box component="span" sx={{ fontWeight: 600 }}>
                                Ketentuan Layanan
                            </Box>{' '}
                            &{' '}
                            <Box component="span" sx={{ fontWeight: 600 }}>
                                Kebijakan Privasi
                            </Box>.
                        </Box>
                    </Stack>
                </Box>

                {/* Right / Visual */}
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        background: (t) =>
                            t.palette.mode === 'dark'
                                ? 'linear-gradient(180deg, rgba(99,102,241,0.15), rgba(236,72,153,0.1))'
                                : 'linear-gradient(180deg, rgba(99,102,241,0.12), rgba(236,72,153,0.08))',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            background:
                                'radial-gradient(40rem 24rem at 80% 20%, rgba(99,102,241,0.25), transparent), radial-gradient(32rem 24rem at 20% 80%, rgba(236,72,153,0.22), transparent)',
                            opacity: 0.8,
                        }}
                    />
                    <Stack sx={{ px: 6, py: 8, position: 'relative' }} spacing={2} alignItems="center">
                        <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center' }}>
                            Satu klik untuk produktif
                        </Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                            Login cepat dengan Google, aman dan tanpa ribet. Data Anda tersimpan dengan baik.
                        </Typography>

                        <Box
                            sx={{
                                mt: 2,
                                width: '100%',
                                maxWidth: 360,
                                aspectRatio: '4/3',
                                borderRadius: 4,
                                border: (t) =>
                                    t.palette.mode === 'dark'
                                        ? '1px solid rgba(255,255,255,0.08)'
                                        : '1px solid rgba(0,0,0,0.06)',
                                backdropFilter: 'blur(6px)',
                                boxShadow: (t) =>
                                    t.palette.mode === 'dark'
                                        ? '0 12px 40px rgba(0,0,0,0.55)'
                                        : '0 12px 40px rgba(31,41,55,0.14)',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 28,
                                fontWeight: 800,
                                letterSpacing: 0.5,
                                color: 'text.secondary',
                            }}
                        >
                            LOGIN • UI
                        </Box>
                    </Stack>
                </Box>
            </Paper>
        </Box>
    )
}
