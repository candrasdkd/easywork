import type { CertificateFillResult } from './certificateMaster';

const DATABASE_NAME = 'easywork-certificate-master';
const DATABASE_VERSION = 1;
const FILE_STORE = 'input-files';
const SESSION_STORE = 'sessions';
const SESSION_KEY = 'latest';

export interface StoredCertificateFile {
    id: string;
    key: string;
    name: string;
    type: string;
    lastModified: number;
    data: Blob;
}

export interface CertificateSessionSnapshot {
    masterFileId: string | null;
    sourceFileIds: string[];
    targetSheet: string;
    result: CertificateFillResult | null;
    outputWorkbook: unknown | null;
    warnings: string[];
    savedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('Penyimpanan lokal browser tidak tersedia.'));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(FILE_STORE)) database.createObjectStore(FILE_STORE, { keyPath: 'id' });
            if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Gagal membuka penyimpanan lokal.'));
        request.onblocked = () => reject(new Error('Penyimpanan lokal sedang dipakai tab lain.'));
    });
}

function transactionFinished(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Gagal menyimpan data lokal.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Penyimpanan lokal dibatalkan.'));
    });
}

export async function loadCertificateSession(): Promise<CertificateSessionSnapshot | null> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(SESSION_STORE, 'readonly');
        const request = transaction.objectStore(SESSION_STORE).get(SESSION_KEY);
        const value = await new Promise<CertificateSessionSnapshot | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as CertificateSessionSnapshot | undefined);
            request.onerror = () => reject(request.error ?? new Error('Gagal membaca sesi tersimpan.'));
        });
        await transactionFinished(transaction);
        return value ?? null;
    } finally {
        database.close();
    }
}

export async function loadCertificateFile(id: string): Promise<StoredCertificateFile | null> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction(FILE_STORE, 'readonly');
        const request = transaction.objectStore(FILE_STORE).get(id);
        const value = await new Promise<StoredCertificateFile | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as StoredCertificateFile | undefined);
            request.onerror = () => reject(request.error ?? new Error('Gagal membaca file tersimpan.'));
        });
        await transactionFinished(transaction);
        return value ?? null;
    } finally {
        database.close();
    }
}

export async function saveCertificateWorkspace(
    files: Array<{ id: string; key: string; file: File }>,
    keepFileIds: string[],
    snapshot: CertificateSessionSnapshot | null,
): Promise<void> {
    const database = await openDatabase();
    try {
        const transaction = database.transaction([FILE_STORE, SESSION_STORE], 'readwrite');
        const fileStore = transaction.objectStore(FILE_STORE);
        const sessionStore = transaction.objectStore(SESSION_STORE);
        const request = fileStore.getAllKeys();
        request.onsuccess = () => {
            const keep = new Set(keepFileIds);
            const existing = new Set(request.result.map(String));
            existing.forEach((id) => {
                if (!keep.has(id)) fileStore.delete(id);
            });
            files.forEach(({ id, key, file }) => {
                if (existing.has(id)) return;
                fileStore.put({
                    id,
                    key,
                    name: file.name,
                    type: file.type,
                    lastModified: file.lastModified,
                    data: file.slice(0, file.size, file.type),
                } satisfies StoredCertificateFile);
            });
            if (snapshot) sessionStore.put(snapshot, SESSION_KEY);
            else sessionStore.delete(SESSION_KEY);
        };
        request.onerror = () => transaction.abort();
        await transactionFinished(transaction);
    } finally {
        database.close();
    }
}
