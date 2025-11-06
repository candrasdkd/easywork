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