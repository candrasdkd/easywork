// src/lib/deviceDetect.ts

export const isIOS = () => {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
        // Plus, cek jika BUKAN aplikasi standalone (sudah di-install)
        && !(window.navigator as any).standalone;
};

export const isStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
    );
};