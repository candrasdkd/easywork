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

// HMR-safe
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Core SDKs
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Persist login di browser (local) — abaikan promise
void setPersistence(auth, browserLocalPersistence)
auth.languageCode = 'id' // optional, untuk UI OTP/Email link, dsb.

// === Google Auth ===
export const googleProvider = new GoogleAuthProvider()
// Opsional: paksa pilih akun setiap login
googleProvider.setCustomParameters({ prompt: 'select_account' })

/**
 * Login Google: otomatis fallback ke redirect kalau popup diblokir
 */
export async function signInWithGoogle() {
    try {
        // Mobile Safari / PWA kadang butuh redirect
        const isLikelyMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent)
        if (isLikelyMobileSafari) {
            await signInWithRedirect(auth, googleProvider)
            return null
        }
        const cred = await signInWithPopup(auth, googleProvider)
        return cred.user
    } catch (e: any) {
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, googleProvider)
            return null
        }
        throw e
    }
}

/**
 * Panggil ini sekali di halaman yang menerima redirect result (mis. /login)
 * untuk menyelesaikan alur redirect sign-in.
 */
export function finishGoogleRedirect() {
    return getRedirectResult(auth) // -> Promise<UserCredential|null>
}
