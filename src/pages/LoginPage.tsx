// src/pages/Login.tsx
import * as React from 'react'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../contexts/AuthContext'
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
    const pwdErr = password && password.length < 6 ? 'Minimal 6 karakter' : ''

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
        <div className="flex min-h-screen bg-[#f4f7f8] text-slate-900">
            {/* Left Decorative / Brand Panel (Hidden on Mobile) */}
            <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#173a3c] p-12 lg:flex xl:p-16">
                <div className="pointer-events-none absolute -right-36 -top-32 h-[34rem] w-[34rem] rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -right-20 -top-16 h-[26rem] w-[26rem] rounded-full border border-white/10" />

                {/* Brand Content */}
                <div className="relative z-10 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-400 text-xl font-black text-[#173a3c]">E</div>
                    <span className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">EasyWork</span>
                </div>

                <div className="relative z-10 max-w-lg mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="mb-6 text-4xl font-bold leading-[1.15] text-white xl:text-5xl">
                        Solusi Pintar <br />
                        <span className="text-teal-300">
                            Manajemen Anda
                        </span>
                    </h1>
                    <p className="max-w-md text-base leading-relaxed text-teal-50/70 xl:text-lg">
                        Platform andalan untuk memantau dan mengelola data kalibrasi dengan cepat, presisi, dan aman.
                    </p>

                    <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xs text-teal-50/60">Kelola</p><p className="mt-1 text-sm font-semibold text-white">Kalibrasi</p></div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xs text-teal-50/60">Lengkapi</p><p className="mt-1 text-sm font-semibold text-white">Sertifikat</p></div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-xs text-teal-50/60">Rekap</p><p className="mt-1 text-sm font-semibold text-white">Peralatan</p></div>
                    </div>
                </div>

                {/* Footer on left side */}
                <div className="relative z-10 text-sm text-teal-50/50">
                    &copy; {new Date().getFullYear()} EasyWork
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="relative flex w-full flex-col items-center justify-center bg-[#f4f7f8] p-5 sm:p-10 lg:w-1/2 xl:p-16">

                {/* Mobile Header */}
                <div className="absolute left-6 top-6 flex items-center gap-3 lg:hidden">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg font-black text-white">E</div>
                    <span className="font-bold tracking-tight text-slate-800 text-xl">EasyWork</span>
                </div>

                <div className="mt-16 w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_60px_rgba(29,64,67,0.08)] animate-in fade-in zoom-in-95 duration-500 sm:mt-0 sm:p-9">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            {mode === 'login' ? 'Selamat Datang' : 'Mulai Sekarang'}
                        </h2>
                        <p className="text-slate-500">
                            {mode === 'login'
                                ? 'Masuk untuk mengakses dashboard Anda.'
                                : 'Lengkapi detail berikut untuk membuat akun.'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50/50 border border-red-200 text-red-700 text-sm rounded-xl font-medium" role="alert">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                {error}
                            </span>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 p-4 bg-emerald-50/50 border border-emerald-200 text-emerald-700 text-sm rounded-xl font-medium" role="alert">
                            <span className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                {success}
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        {mode === 'register' && (
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700" htmlFor="displayName">
                                    Nama Lengkap
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    autoComplete="name"
                                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
                                    placeholder="John Doe"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
                                Alamat Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                className={`block w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 outline-none transition-all ${!!email && !!emailErr
                                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                                    : 'border-slate-200 focus:ring-teal-600/15 focus:border-teal-600'
                                    }`}
                                placeholder="nama@perusahaan.com"
                            />
                            {email && emailErr && (
                                <p className="text-xs text-red-500 font-medium">{emailErr}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
                                    Kata Sandi
                                </label>
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        disabled={loading}
                                        className="text-sm font-medium text-teal-600 hover:text-teal-500 disabled:opacity-50"
                                    >
                                        Lupa Sandi?
                                    </button>
                                )}
                            </div>

                            <div className="relative group">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                        className={`block w-full rounded-xl border bg-slate-50 px-4 py-3.5 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 ${!!password && !!pwdErr
                                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                                        : 'border-slate-200 focus:ring-teal-600/15 focus:border-teal-600'
                                        }`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-full px-3 text-slate-400 hover:text-slate-600 focus:outline-none flex items-center justify-center transition-colors"
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                >
                                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                </button>
                            </div>
                            {password && pwdErr && (
                                <p className="text-xs text-red-500 font-medium">{pwdErr}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative mt-8 w-full overflow-hidden rounded-xl bg-teal-800 px-4 py-4 font-semibold text-white shadow-sm transition-all hover:bg-teal-900 disabled:pointer-events-none disabled:opacity-70"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {loading && (
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                )}
                                {loading ? 'Memproses...' : (mode === 'login' ? 'Masuk ke Dashboard' : 'Buat Akun')}
                            </span>
                        </button>
                    </form>

                    {/* Mode Toggle */}
                    <div className="mt-8 text-center text-sm text-slate-600 font-medium">
                        {mode === 'login' ? (
                            <p>
                                Belum punya akun?{' '}
                                <button
                                    onClick={() => {
                                        setMode('register')
                                        setError(null)
                                        setSuccess(null)
                                    }}
                                    className="text-teal-600 hover:text-teal-500 font-semibold"
                                >
                                    Daftar Sekarang
                                </button>
                            </p>
                        ) : (
                            <p>
                                Sudah punya akun?{' '}
                                <button
                                    onClick={() => {
                                        setMode('login')
                                        setError(null)
                                        setSuccess(null)
                                    }}
                                    className="text-teal-600 hover:text-teal-500 font-semibold"
                                >
                                    Masuk Disini
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
