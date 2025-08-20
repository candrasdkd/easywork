// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app'
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// HMR-safe init
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Core SDKs
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Bahasa (untuk UI OTP/Email link, dsb.)
auth.languageCode = 'id'

// ===== Persistence fallback: local → session → memory =====
async function setupPersistence() {
    try {
        await setPersistence(auth, browserLocalPersistence)
    } catch {
        try {
            await setPersistence(auth, browserSessionPersistence)
        } catch {
            await setPersistence(auth, inMemoryPersistence)
        }
    }
}
void setupPersistence()

// ===== Google Auth Provider =====
export const googleProvider = new GoogleAuthProvider()
// Opsional: paksa pilih akun setiap login
googleProvider.setCustomParameters({ prompt: 'select_account' })

// ===== Detector environment (mobile / in-app browser) =====
function getEnvFlags() {
    const ua = navigator.userAgent || ''
    const isIOS = /iPhone|iPad|iPod/i.test(ua)
    const isAndroid = /Android/i.test(ua)
    const isMobile = isIOS || isAndroid
    const isInAppBrowser =
        /\bFBAN|FBAV|Instagram|Line\/|FB_IAB|Twitter|TikTok|VkShare|Pinterest|WeChat|Messenger\b/i.test(
            ua
        )
    return { isIOS, isAndroid, isMobile, isInAppBrowser }
}

/**
 * Login Google: otomatis pakai redirect di mobile/in-app browser
 * dan fallback ke redirect untuk error popup umum.
 */
export async function signInWithGoogle() {
    const { isMobile, isInAppBrowser } = getEnvFlags()

    try {
        if (isMobile || isInAppBrowser) {
            await signInWithRedirect(auth, googleProvider)
            return null
        }
        const cred = await signInWithPopup(auth, googleProvider)
        return cred.user
    } catch (e: any) {
        const code = e?.code || ''
        const mustRedirect = [
            'auth/popup-blocked',
            'auth/popup-closed-by-user',
            'auth/operation-not-supported-in-this-environment',
            'auth/internal-error',
        ].includes(code)

        if (mustRedirect) {
            await signInWithRedirect(auth, googleProvider)
            return null
        }
        throw e
    }
}

/**
 * Panggil sekali di halaman login untuk menyelesaikan alur redirect sign-in.
 * Mengembalikan Promise<UserCredential|null>
 */
export function finishGoogleRedirect() {
    return getRedirectResult(auth)
}
