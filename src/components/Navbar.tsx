import * as React from 'react';
import { NavLink, useNavigate } from 'react-router';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const navItems = [
    {
        label: 'Dashboard',
        path: '/',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
        label: 'Data Kalibrasi',
        path: '/data-inputan',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
        label: 'SPH',
        path: '/mass-import',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
    },
    {
        label: 'Pesanan PDF',
        path: '/ekstrak-pesanan-pdf',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg>,
    },
    {
        label: 'Cek Alat',
        path: '/cek-alat',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        label: 'Master Sertifikat',
        path: '/isi-master-sertifikat',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 4v15a2 2 0 01-2 2z" /></svg>,
    },
    {
        label: 'Cetak Sertifikat PDF',
        path: '/cetak-sertifikat',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8V4h10v4M7 17H5a2 2 0 01-2-2v-5a2 2 0 012-2h14a2 2 0 012 2v5a2 2 0 01-2 2h-2M7 14h10v6H7z" /></svg>,
    },
    {
        label: 'Referensi',
        path: '/referensi-alat',
        icon: <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    },
];

function getInitials(name?: string | null) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
}

interface NavbarProps {
    desktopHidden: boolean;
    onToggleDesktop: () => void;
}

export default function Navbar({ desktopHidden, onToggleDesktop }: NavbarProps) {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [openConfirm, setOpenConfirm] = React.useState(false);
    const [user, setUser] = React.useState<User | null>(auth.currentUser ?? null);
    const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
    const navigate = useNavigate();
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return unsubscribe;
    }, []);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setAccountMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGoProfile = () => {
        setAccountMenuOpen(false);
        setMobileOpen(false);
        navigate('/profile');
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setAccountMenuOpen(false);
            setOpenConfirm(false);
            setMobileOpen(false);
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#173a3c] px-4 text-white shadow-sm lg:hidden">
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Buka menu navigasi"
                    aria-expanded={mobileOpen}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-400 text-lg font-black text-[#173a3c]">E</span>
                    <span className="text-lg font-bold tracking-tight">EasyWork</span>
                </div>
                <div className="h-10 w-10" aria-hidden="true" />
            </header>

            {desktopHidden && (
                <header className="fixed inset-x-0 top-0 z-40 hidden h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-5 text-slate-900 shadow-sm backdrop-blur lg:flex">
                    <button
                        type="button"
                        onClick={onToggleDesktop}
                        aria-label="Tampilkan sidebar"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-lg font-black text-white">E</span>
                    <span className="text-lg font-bold tracking-tight">EasyWork</span>
                </header>
            )}

            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Tutup menu navigasi"
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#173a3c] text-white shadow-xl transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopHidden ? 'lg:-translate-x-full' : 'lg:translate-x-0'}`}>
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-xl font-black text-[#173a3c]">E</span>
                    <div>
                        <p className="text-lg font-bold tracking-tight">EasyWork</p>
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Workspace</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onToggleDesktop}
                            aria-label="Sembunyikan sidebar"
                            className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-300 lg:inline-flex"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16M18 10l2 2-2 2" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Tutup menu navigasi"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-300 lg:hidden"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
                    <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Menu</p>
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/'}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                ? 'bg-teal-300/15 text-teal-100 ring-1 ring-inset ring-teal-200/20'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </nav>

                <div className="shrink-0 border-t border-white/10 p-3">
                    <div className="relative" ref={menuRef}>
                        {accountMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
                                {user && (
                                    <div className="border-b border-slate-800 px-4 py-3">
                                        <p className="truncate text-sm font-semibold text-white">{user.displayName || 'Pengguna'}</p>
                                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleGoProfile}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                                >
                                    Profil
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAccountMenuOpen(false);
                                        setOpenConfirm(true);
                                    }}
                                    className="block w-full px-4 py-2.5 text-left text-sm text-rose-300 transition hover:bg-slate-800"
                                >
                                    Logout
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setAccountMenuOpen((open) => !open)}
                            aria-expanded={accountMenuOpen}
                            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
                        >
                            {user?.photoURL ? (
                                <img className="h-9 w-9 shrink-0 rounded-full object-cover" src={user.photoURL} alt="" />
                            ) : (
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-100">
                                    {getInitials(user?.displayName)}
                                </span>
                            )}
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-100">{user?.displayName || 'Akun'}</span>
                                <span className="block truncate text-xs text-slate-400">{user?.email || 'Pengaturan akun'}</span>
                            </span>
                            <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            <Modal
                open={openConfirm}
                onClose={() => setOpenConfirm(false)}
                title="Konfirmasi Logout"
                footer={(
                    <>
                        <Button variant="outline" onClick={() => setOpenConfirm(false)}>Batal</Button>
                        <Button variant="danger" onClick={handleLogout}>Ya, Logout</Button>
                    </>
                )}
            >
                <p>Apakah Anda yakin ingin keluar dari aplikasi?</p>
            </Modal>
        </>
    );
}
