import { useState, useEffect } from 'react';

// Antarmuka untuk event 'beforeinstallprompt'
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export const usePWAInstall = () => {
    // State untuk menyimpan event
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    // State untuk menampilkan tombol Anda
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            // Mencegah prompt mini-infobar bawaan
            e.preventDefault();

            // Simpan event agar bisa dipicu nanti
            setPromptEvent(e as BeforeInstallPromptEvent);

            // Tampilkan tombol kustom Anda
            setIsInstallable(true);
            console.log('PWA install prompt event captured.');
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Cleanup listener
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const triggerInstall = async () => {
        if (!promptEvent) {
            console.log('Install prompt event not available.');
            return;
        }

        // Tampilkan dialog "Add to Home Screen"
        promptEvent.prompt();

        // Tunggu hasil pilihan pengguna
        const { outcome } = await promptEvent.userChoice;
        console.log(`User ${outcome} the install prompt.`);

        // Kita tidak perlu event ini lagi, dan sembunyikan tombolnya
        setPromptEvent(null);
        setIsInstallable(false);
    };

    return { isInstallable, triggerInstall };
};