// src/pages/Login.tsx
import * as React from 'react'
import {
    Alert,
    Box,
    Paper,
    Typography,
    Divider,
    Stack,
    TextField,
    Button,
    IconButton,
    InputAdornment,
    Link,
    Tooltip,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext' // asumsi sudah ada (provider yang expose "user")
import { signInWithEmail, signUpWithEmail, sendResetPassword } from '../lib/firebase'

type Mode = 'login' | 'register'

export default function Login() {
    const { user } = useAuth()
    const loc = useLocation()
    const navigate = useNavigate()

    const [mode, setMode] = React.useState<Mode>('login')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [displayName, setDisplayName] = React.useState('')
    const [showPassword, setShowPassword] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [success, setSuccess] = React.useState<string | null>(null)

    // Redirect kalau sudah login
    React.useEffect(() => {
        if (user) {
            const to = (loc.state as any)?.from?.pathname || '/'
            navigate(to, { replace: true })
        }
    }, [user, loc.state, navigate])

    // Simple validation
    const emailErr = email && !/^\S+@\S+\.\S+$/.test(email) ? 'Format email tidak valid' : ''
    const pwdErr =
        password && password.length < 6 ? 'Minimal 6 karakter' : ''

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!email) return setError('Email wajib diisi.')
        if (emailErr) return setError(emailErr)
        if (!password) return setError('Password wajib diisi.')
        if (pwdErr) return setError(pwdErr)

        setLoading(true)
        try {
            if (mode === 'login') {
                await signInWithEmail({ email, password })
                const to = (loc.state as any)?.from?.pathname || '/'
                navigate(to, { replace: true })
            } else {
                await signUpWithEmail({ email, password, displayName: displayName || undefined })
                setSuccess('Pendaftaran berhasil. Kamu sudah masuk.')
                const to = (loc.state as any)?.from?.pathname || '/'
                navigate(to, { replace: true })
            }
        } catch (e: any) {
            setError(e?.message ?? 'Terjadi kesalahan.')
        } finally {
            setLoading(false)
        }
    }

    async function handleReset() {
        setError(null)
        setSuccess(null)
        if (!email) return setError('Masukkan email untuk reset password.')
        if (emailErr) return setError(emailErr)

        setLoading(true)
        try {
            await sendResetPassword(email)
            setSuccess('Link reset password telah dikirim ke email kamu.')
        } catch (e: any) {
            setError(e?.message ?? 'Gagal mengirim link reset password.')
        } finally {
            setLoading(false)
        }
    }

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
                        width: 280, height: 280, top: 80, left: 80,
                        background: 'linear-gradient(45deg, #6366F1, #22D3EE)',
                    },
                    '&::after': {
                        width: 320, height: 320, bottom: 60, right: 80,
                        background: 'linear-gradient(45deg, #F472B6, #F59E0B)',
                    },
                }}
            />

            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    maxWidth: 560,
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
                }}
            >
                <Box sx={{ p: { xs: 3, md: 5 } }}>
                    {/* Header */}
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box
                                sx={{
                                    width: 40, height: 40, borderRadius: 2,
                                    background: (t) =>
                                        t.palette.mode === 'dark'
                                            ? 'linear-gradient(45deg, #6366F1, #22D3EE)'
                                            : 'linear-gradient(45deg, #4F46E5, #06B6D4)',
                                    display: 'grid', placeItems: 'center',
                                    color: '#fff', fontWeight: 800, fontSize: 18,
                                }}
                            >
                                E
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
                                EasyWork
                            </Typography>
                        </Stack>

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
                        {mode === 'login' ? 'Masuk' : 'Daftar akun baru'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {mode === 'login'
                            ? 'Gunakan email & password untuk masuk.'
                            : 'Isi data di bawah untuk membuat akun baru.'}
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                    <Box component="form" onSubmit={handleSubmit} noValidate>
                        <Stack spacing={2.2}>
                            {mode === 'register' && (
                                <TextField
                                    label="Nama"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    autoComplete="name"
                                    fullWidth
                                />
                            )}

                            <TextField
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                fullWidth
                                error={!!email && !!emailErr}
                                helperText={email && emailErr ? emailErr : ' '}
                            />

                            <TextField
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                fullWidth
                                error={!!password && !!pwdErr}
                                helperText={password && pwdErr ? pwdErr : ' '}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword((v) => !v)}
                                                edge="end"
                                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disableElevation
                                disabled={loading}
                            >
                                {loading ? (mode === 'login' ? 'Memproses...' : 'Mendaftarkan...') : (mode === 'login' ? 'Masuk' : 'Daftar')}
                            </Button>

                            {mode === 'login' && (
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={handleReset}
                                        disabled={loading}
                                        underline="hover"
                                    >
                                        Lupa sandi?
                                    </Link>
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={() => {
                                            setMode('register')
                                            setError(null); setSuccess(null)
                                        }}
                                        underline="hover"
                                    >
                                        Buat akun baru
                                    </Link>
                                </Stack>
                            )}

                            {mode === 'register' && (
                                <Stack direction="row" justifyContent="flex-end">
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={() => {
                                            setMode('login')
                                            setError(null); setSuccess(null)
                                        }}
                                        underline="hover"
                                    >
                                        Sudah punya akun? Masuk
                                    </Link>
                                </Stack>
                            )}

                            <Divider />

                            <Typography variant="caption" color="text.secondary" textAlign="center">
                                Dengan masuk/daftar, Anda menyetujui <b>Ketentuan Layanan</b> & <b>Kebijakan Privasi</b>.
                            </Typography>
                        </Stack>
                    </Box>
                </Box>
            </Paper>
        </Box>
    )
}
