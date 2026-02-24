import * as React from 'react';
import { NavLink, useNavigate } from 'react-router';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Data Kalibrasi', path: '/data-inputan' },
    { label: 'Data Inventaris', path: '/data-inventaris' },
    { label: 'SPH', path: '/mass-import' },
];

function getInitials(name?: string | null) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
}

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [openConfirm, setOpenConfirm] = React.useState(false);
    const [user, setUser] = React.useState<User | null>(auth.currentUser ?? null);
    const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
    const navigate = useNavigate();
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsub();
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
        navigate('/profile');
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setAccountMenuOpen(false);
            setOpenConfirm(false);
            navigate('/login', { replace: true });
        } catch (e) {
            console.error('Logout failed:', e);
        }
    };

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-40 bg-blue-600 shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Mobile menu button */}
                        <div className="flex items-center sm:hidden">
                            <button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-700 focus:outline-none"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden sm:flex sm:items-center sm:space-x-4">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.label}
                                    to={item.path}
                                    className={({ isActive }) => `
                                        px-3 py-2 rounded-md text-sm font-medium transition-all
                                        ${isActive
                                            ? 'bg-blue-700 text-white shadow-inner scale-105'
                                            : 'text-blue-100 hover:bg-blue-500 hover:text-white'}
                                    `}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>

                        {/* Account Dropdown */}
                        <div className="flex items-center gap-2">
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                                    className="flex text-sm bg-blue-800 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-600 focus:ring-white overflow-hidden"
                                >
                                    {user?.photoURL ? (
                                        <img className="h-8 w-8 object-cover" src={user.photoURL} alt="" />
                                    ) : (
                                        <div className="h-8 w-8 flex items-center justify-center bg-blue-700 text-white font-bold text-xs">
                                            {user?.displayName ? getInitials(user.displayName) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                </button>

                                {accountMenuOpen && (
                                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in duration-100">
                                        {user && (
                                            <div className="px-4 py-2 border-b border-gray-100">
                                                <p className="text-sm font-semibold truncate text-gray-900">{user.displayName || 'Pengguna'}</p>
                                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                            </div>
                                        )}
                                        <button
                                            onClick={handleGoProfile}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            Profil
                                        </button>
                                        <button
                                            onClick={() => setOpenConfirm(true)}
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Drawer */}
                {mobileOpen && (
                    <div className="sm:hidden bg-blue-700 border-t border-blue-500 animate-in slide-in-from-top duration-200">
                        <div className="px-2 pt-2 pb-3 space-y-1">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.label}
                                    to={item.path}
                                    onClick={() => setMobileOpen(false)}
                                    className={({ isActive }) => `
                                        block px-3 py-2 rounded-md text-base font-medium
                                        ${isActive
                                            ? 'bg-blue-800 text-white'
                                            : 'text-blue-100 hover:bg-blue-600 hover:text-white'}
                                    `}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                )}
            </nav>

            <Modal
                open={openConfirm}
                onClose={() => setOpenConfirm(false)}
                title="Konfirmasi Logout"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpenConfirm(false)}>Batal</Button>
                        <Button variant="danger" onClick={handleLogout}>Ya, Logout</Button>
                    </>
                }
            >
                <p>Apakah Anda yakin ingin keluar dari aplikasi?</p>
            </Modal>
        </>
    );
}
