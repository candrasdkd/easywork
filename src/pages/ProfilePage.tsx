// src/pages/ProfilePage.tsx
import * as React from 'react';
import dayjs from 'dayjs';

// UI Kit
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';

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

    // === Toast (replacement for Snackbar) ===
    const [toast, setToast] = React.useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false, msg: '', type: 'success'
    });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

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
            showToast('Nama penanggung jawab disimpan ✅');
        } catch (err: any) {
            const msg = err?.message ?? 'Gagal menyimpan penanggung jawab.';
            setErrorPic(msg);
            showToast(msg, 'error');
        } finally {
            setSavingPic(false);
        }
    };

    const handleSaveDisplayName = async () => {
        if (!user) return;
        const name = displayName.trim();
        if (!name) { setErrorName('Nama tidak boleh kosong.'); return; }

        setSavingName(true);
        setErrorName(null);
        try {
            await fbUpdateDisplayName(user, name);
            showToast('Nama profil diperbarui ✅');
        } catch (e: any) {
            setErrorName(e?.message ?? 'Gagal memperbarui nama.');
            showToast(e?.message ?? 'Gagal memperbarui nama.', 'error');
        } finally {
            setSavingName(false);
        }
    };

    const handleLogout = async () => {
        setLogoutLoading(true);
        try {
            await fbSignOut();
        } catch (e: any) {
            showToast(e?.message ?? 'Logout gagal', 'error');
        } finally {
            setLogoutLoading(false);
            setConfirmOpen(false);
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-md w-full">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Belum Login</h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">
                        Silakan login terlebih dahulu untuk mengakses dan mengatur profil Anda.
                    </p>
                    <Button variant="primary" className="w-full py-4 text-lg shadow-lg shadow-blue-500/20">
                        Ke Halaman Login
                    </Button>
                </div>
            </div>
        );
    }

    const meta = user.metadata;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
            {/* Profile Header Card */}
            <div className="relative mt-8 sm:mt-12 group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 blur-3xl opacity-30 transition-opacity group-hover:opacity-50"></div>
                <div className="relative bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className="relative">
                                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white dark:ring-slate-800 transition-transform hover:scale-105 duration-300">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName ?? ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold">
                                            {(user.displayName || 'u').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-center sm:text-left">
                                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {user.displayName || 'Nama Belum Diatur'}
                                </h1>
                                <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                                    <span className="text-lg text-gray-500 dark:text-gray-400 truncate max-w-[250px]">
                                        {user.email}
                                    </span>
                                    {user.emailVerified ? (
                                        <Badge variant="success">
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812 3.066 3.066 0 00.723 1.745 3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Terverifikasi
                                        </Badge>
                                    ) : (
                                        <Badge variant="warning">Belum Verifikasi</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setConfirmOpen(true)}
                            className="bg-white/50 dark:bg-slate-800/50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all sm:w-auto w-full py-4 sm:py-2.5 rounded-2xl border-gray-200 dark:border-slate-700"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </Button>
                    </div>
                </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
                {/* Account Settings */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Informasi Akun</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Nama Lengkap</label>
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Masukkan nama lengkap"
                                    className="w-full text-base py-3"
                                />
                                {errorName && <p className="text-sm text-red-500 mt-1 ml-1 font-medium">{errorName}</p>}
                            </div>

                            <Button
                                variant="primary"
                                onClick={handleSaveDisplayName}
                                disabled={savingName}
                                className="w-full py-4 text-base shadow-lg shadow-blue-500/20"
                            >
                                {savingName ? 'Menyimpan...' : 'Perbarui Nama Profil'}
                            </Button>

                            <hr className="border-gray-100 dark:border-slate-800 my-8" />

                            <div className="space-y-4">
                                <InfoItem label="Tanggal Pendaftaran" value={meta.creationTime ? dayjs(meta.creationTime).format('DD MMMM YYYY, HH:mm') : '—'} />
                                <InfoItem label="Terakhir Login" value={meta.lastSignInTime ? dayjs(meta.lastSignInTime).format('DD MMMM YYYY, HH:mm') : '—'} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Responsible Person settings */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">Penanggung Jawab</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                <span className="font-bold flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Informasi
                                </span>
                                Nama ini akan muncul sebagai <span className="underline decoration-emerald-500/30 decoration-2 underline-offset-2">Person Responsible</span> secara otomatis di setiap formulir inventaris yang Anda tambahkan.
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">Nama Penanggung Jawab Terdaftar</label>
                                <Input
                                    value={picName}
                                    onChange={(e) => setPicName(e.target.value)}
                                    placeholder="Masukkan nama penanggung jawab"
                                    className="w-full text-base py-3"
                                    disabled={loadingPic || savingPic}
                                />
                                {errorPic && <p className="text-sm text-red-500 mt-1 ml-1 font-medium">{errorPic}</p>}
                                {savedOk && <p className="text-sm text-emerald-500 mt-1 ml-1 font-medium">Berhasil disimpan. ✨</p>}
                            </div>

                            <Button
                                variant="secondary"
                                onClick={handleSavePicName}
                                disabled={loadingPic || savingPic}
                                className="w-full py-4 text-base"
                            >
                                {savingPic ? 'Menyimpan...' : 'Simpan Nama Penanggung Jawab'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            <Modal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="Konfirmasi Logout"
                maxWidth="sm"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={logoutLoading}>
                            Batal
                        </Button>
                        <Button variant="primary" onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white border-none shadow-lg shadow-red-500/20" disabled={logoutLoading}>
                            {logoutLoading ? 'Proses...' : 'Keluar Sekarang'}
                        </Button>
                    </div>
                }
            >
                <div className="flex items-center gap-4 py-2">
                    <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                            Anda akan keluar dari akun saat ini. Pastikan semua perubahan telah disimpan.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 font-semibold ${toast.type === 'success'
                        ? 'bg-emerald-500/95 text-white border-emerald-400'
                        : 'bg-red-500/95 text-white border-red-400'
                        }`}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        {toast.msg}
                    </div>
                </div>
            )}
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 px-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{value}</span>
        </div>
    );
}
