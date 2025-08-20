// src/lib/firebase.ts
import { initializeApp, getApp, getApps } from 'firebase/app'
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut as fbSignOut,
    updateProfile,
    sendEmailVerification as fbSendEmailVerification,
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword as fbUpdatePassword,
    type User,
} from 'firebase/auth'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
auth.languageCode = 'id'

// Persistence fallback
async function setupPersistence() {
    try { await setPersistence(auth, browserLocalPersistence) }
    catch {
        try { await setPersistence(auth, browserSessionPersistence) }
        catch { await setPersistence(auth, inMemoryPersistence) }
    }
}
void setupPersistence()

// ===== Error map (singkat) =====
function mapAuthError(code?: string): string {
    switch (code) {
        case 'auth/invalid-email': return 'Email tidak valid.'
        case 'auth/missing-password': return 'Password wajib diisi.'
        case 'auth/weak-password': return 'Password terlalu lemah (≥6 karakter).'
        case 'auth/email-already-in-use': return 'Email sudah terdaftar.'
        case 'auth/user-not-found':
        case 'auth/invalid-credential': return 'Email atau password salah.'
        case 'auth/wrong-password': return 'Password salah.'
        case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Coba lagi nanti.'
        default: return 'Terjadi kesalahan. Coba lagi.'
    }
}

// ===== Profile sync helpers =====
/** Upsert dokumen users/{uid} setelah login/daftar */
export async function upsertUserProfile(u: User) {
    const ref = doc(db, 'users', u.uid)
    const providerId = u.providerData?.[0]?.providerId ?? 'password'
    const payload = {
        uuid_account: u.uid,
        email: u.email ?? null,
        display_name: u.displayName ?? null,
        photo_url: u.photoURL ?? null,
        email_verified: u.emailVerified ?? false,
        provider_id: providerId,
        last_login_at: serverTimestamp(),
        // created_at: hanya set pertama kali, tapi setDoc merge tidak akan merusak jika sudah ada
        created_at: serverTimestamp(),
    }
    await setDoc(ref, payload, { merge: true })
}

/** Update displayName ke Auth & Firestore */
export async function updateDisplayName(u: User, displayName: string) {
    await updateProfile(u, { displayName })
    const ref = doc(db, 'users', u.uid)
    await setDoc(ref, { display_name: displayName }, { merge: true })
}

/** Kirim email verifikasi */
export async function sendEmailVerification() {
    if (!auth.currentUser) throw new Error('Tidak ada user yang login.')
    await fbSendEmailVerification(auth.currentUser)
}

/** Ganti password (minta password lama untuk reauth) */
export async function updatePasswordWithReauth(email: string, oldPwd: string, newPwd: string) {
    if (!auth.currentUser) throw new Error('Tidak ada user yang login.')
    const cred = EmailAuthProvider.credential(email, oldPwd)
    await reauthenticateWithCredential(auth.currentUser, cred)
    await fbUpdatePassword(auth.currentUser, newPwd)
}

// ===== Email/Password auth APIs =====
export async function signUpWithEmail(params: { email: string; password: string; displayName?: string }) {
    const { email, password, displayName } = params
    try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        if (displayName) await updateProfile(cred.user, { displayName })
        await upsertUserProfile(cred.user)
        return cred.user
    } catch (e: any) {
        throw new Error(mapAuthError(e?.code))
    }
}

export async function signInWithEmail(params: { email: string; password: string }) {
    const { email, password } = params
    try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        await upsertUserProfile(cred.user)
        return cred.user
    } catch (e: any) {
        throw new Error(mapAuthError(e?.code))
    }
}

export async function sendResetPassword(email: string) {
    try {
        await sendPasswordResetEmail(auth, email.trim())
    } catch (e: any) {
        throw new Error(mapAuthError(e?.code))
    }
}

export async function signOut() {
    await fbSignOut(auth)
}
