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
        <div className="min-h-screen flex bg-white font-sans text-slate-900">
            {/* Left Decorative / Brand Panel (Hidden on Mobile) */}
            <div className="relative hidden w-1/2 lg:flex flex-col justify-between p-12 overflow-hidden bg-slate-900">
                {/* Background Details */}
                <div className="absolute inset-0 z-0">
                    {/* Glowing Orbs */}
                    <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/30 blur-[100px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-400/20 blur-[120px]" />

                    {/* Dark overlay with pattern */}
                    <div
                        className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.2) 1px, transparent 0)",
                            backgroundSize: "32px 32px"
                        }}
                    />
                </div>

                {/* Brand Content */}
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/30">
                        <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                            <span className="text-xl font-black bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent">E</span>
                        </div>
                    </div>
                    <span className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">EasyWork</span>
                </div>

                <div className="relative z-10 max-w-lg mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <h1 className="text-5xl font-black text-white leading-[1.15] mb-6">
                        Solusi Pintar <br />
                        <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                            Manajemen Anda
                        </span>
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed font-medium">
                        Platform andalan untuk memonitor, mengelola inventaris, dan kalibrasi dengan cepat, presisi, dan aman.
                    </p>

                    {/* UI Illustration representation (Decorative Mockup elements) */}
                    <div className="mt-12 flex gap-4 opacity-80 mix-blend-plus-lighter">
                        <div className="h-2 w-12 bg-indigo-500/50 rounded-full" />
                        <div className="h-2 w-24 bg-cyan-400/50 rounded-full" />
                        <div className="h-2 w-16 bg-slate-600/50 rounded-full" />
                    </div>
                </div>

                {/* Footer on left side */}
                <div className="relative z-10 text-sm font-medium text-slate-500">
                    &copy; {new Date().getFullYear()} EasyWork. All rights reserved.
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center items-center p-6 sm:p-12 xl:p-24 relative bg-white">

                {/* Mobile Header */}
                <div className="absolute top-8 left-8 flex items-center gap-3 lg:hidden">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20">
                        <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                            <span className="text-lg font-black text-white">E</span>
                        </div>
                    </div>
                    <span className="font-bold tracking-tight text-slate-800 text-xl">EasyWork</span>
                </div>

                <div className="w-full max-w-sm mt-12 lg:mt-0 animate-in fade-in zoom-in-95 duration-500">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
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
                                    className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
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
                                    : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
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
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
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
                                    className={`block w-full px-4 py-3.5 pr-12 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 outline-none transition-all ${!!password && !!pwdErr
                                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                                        : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
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
                            className="w-full relative group mt-8 overflow-hidden rounded-xl bg-slate-900 py-4 px-4 font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-[1px] hover:shadow-xl hover:shadow-slate-900/30 active:translate-y-0 active:shadow-md disabled:pointer-events-none disabled:opacity-70"
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
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
                                    className="text-indigo-600 hover:text-indigo-500 font-semibold"
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
                                    className="text-indigo-600 hover:text-indigo-500 font-semibold"
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
