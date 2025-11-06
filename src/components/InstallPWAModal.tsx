import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/pwa/usePWAInstall'; // Asumsi hook dari jawaban sblmnya
import { isIOS } from '../lib/deviceDetect'; // Helper yang baru kita buat

const STORAGE_KEY = 'pwa_prompt_seen';

export const InstallPWAModal = () => {
    // 1. Dapatkan logika PWA dari hook
    const { isInstallable, triggerInstall } = usePWAInstall();

    // 2. State untuk modal
    const [showModal, setShowModal] = useState(false);

    // 3. Cek apakah ini iOS
    const isIOSEnabled = isIOS();

    // 4. Cek kapan harus menampilkan modal
    useEffect(() => {
        const hasSeenPrompt = localStorage.getItem(STORAGE_KEY);

        if (hasSeenPrompt === 'true') {
            return; // Sudah pernah lihat, jangan ganggu
        }

        // Tampilkan modal jika bisa di-install (Android) ATAU jika ini iOS
        const canShowPrompt = isInstallable || isIOSEnabled;

        if (canShowPrompt) {
            // Tampilkan setelah 3 detik agar tidak terlalu mengganggu
            const timer = setTimeout(() => {
                setShowModal(true);
            }, 3000); // 3 detik

            return () => clearTimeout(timer);
        }
    }, [isInstallable, isIOSEnabled]);


    // 5. Fungsi untuk menutup modal
    const handleClose = () => {
        setShowModal(false);
        // Tandai sudah pernah lihat
        localStorage.setItem(STORAGE_KEY, 'true');
    };

    // 6. Fungsi untuk handle install di Android
    const handleInstallClick = async () => {
        await triggerInstall();
        handleClose(); // Otomatis tutup setelah di-trigger
    };

    // --- Render ---
    if (!showModal) {
        return null; // Jangan render apapun jika tidak perlu
    }

    return (
        // Overlay
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-center items-center p-4">

            {/* Konten Modal */}
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full relative">

                {/* Tombol Close */}
                <button
                    onClick={handleClose}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
                >
                    &times;
                </button>

                {/* Header */}
                <div className="flex items-center mb-4">
                    <img src="/logo.svg" alt="Easywork Logo" className="w-10 h-10 mr-3" />
                    <h3 className="text-lg font-bold">Install Aplikasi Easywork</h3>
                </div>

                {/* Konten (Ini bagian "pintar"-nya) */}
                {isInstallable && (
                    // KONTEN ANDROID/CHROME
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            Dapatkan pengalaman aplikasi penuh. Install Easywork ke layar utama Anda untuk akses cepat dan fitur offline.
                        </p>
                        <button
                            onClick={handleInstallClick}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700"
                        >
                            Install Sekarang
                        </button>
                    </div>
                )}

                {isIOSEnabled && !isInstallable && (
                    // KONTEN IOS/SAFARI
                    <div>
                        <p className="text-sm text-gray-700 mb-4">
                            Untuk meng-install aplikasi ini di iPhone/iPad Anda:
                        </p>
                        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-2">
                            <li>Tap ikon <strong>"Share"</strong> di browser.</li>
                            <li>Scroll ke bawah dan pilih <strong>"Add to Home Screen"</strong>.</li>
                        </ol>
                    </div>
                )}
            </div>
        </div>
    );
};