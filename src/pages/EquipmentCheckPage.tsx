import * as React from 'react';
import {
    collection, getDocs, addDoc, updateDoc, doc, writeBatch,
    query, where, Timestamp, limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { isInReference, type EquipmentCheckItem } from '../lib/toolMatcher';
import { loadReferenceTools, type FirestoreReferenceTool } from '../lib/seedReferenceTools';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import useNotifications from '../hooks/useNotifications/useNotifications';

type Tab = 'input' | 'review';

export default function EquipmentCheckPage() {
    const { user } = useAuth();
    const notifications = useNotifications();

    const [activeTab, setActiveTab] = React.useState<Tab>('input');
    const [rawText, setRawText] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [, setChecking] = React.useState(false);
    const [loadingQueue, setLoadingQueue] = React.useState(false);

    const [referenceCount, setReferenceCount] = React.useState<number | null>(null);
    const [uncheckedCount, setUncheckedCount] = React.useState(0);
    const [queue, setQueue] = React.useState<EquipmentCheckItem[]>([]);
    const [queueIndex, setQueueIndex] = React.useState(0);
    const [processingItem, setProcessingItem] = React.useState(false);
    const [lastReviewedName, setLastReviewedName] = React.useState<string | null>(null);
    const [addedToRef, setAddedToRef] = React.useState(false);

    const currentTool = queue[queueIndex] ?? null;
    const total = queue.length;
    const remaining = total - queueIndex;

    const checkReferenceCount = React.useCallback(async () => {
        try {
            const snap = await getDocs(query(collection(db, 'reference_tools'), limit(1)));
            if (snap.empty) {
                setReferenceCount(0);
            } else {
                const allSnap = await getDocs(collection(db, 'reference_tools'));
                setReferenceCount(allSnap.size);
            }
        } catch {
            setReferenceCount(0);
        }
    }, []);

    React.useEffect(() => {
        if (user) checkReferenceCount();
    }, [user, checkReferenceCount]);

    const handleRunCheck = React.useCallback(async () => {
        setChecking(true);
        try {
            const refs: FirestoreReferenceTool[] = await loadReferenceTools();
            if (refs.length === 0) {
                notifications.show('Belum ada data referensi. Buka halaman Referensi Alat terlebih dahulu.', { severity: 'warning', autoHideDuration: 4000 });
                setChecking(false);
                return;
            }

            const snap = await getDocs(
                query(collection(db, 'equipment_checks'), where('matched', '==', null))
            );

            if (snap.empty) {
                setChecking(false);
                return;
            }

            const batch = writeBatch(db);
            let matchCount = 0;
            let unmatchCount = 0;

            for (const d of snap.docs) {
                const name = String(d.data().name || '');
                const result = isInReference(name, refs);
                batch.update(doc(db, 'equipment_checks', d.id), {
                    matched: result.matched,
                    matched_reference_id: result.matchedWith ?? null,
                });
                if (result.matched) matchCount++;
                else unmatchCount++;
            }

            await batch.commit();
            notifications.show(
                `Pengecekan selesai: ${matchCount} cocok, ${unmatchCount} tidak cocok`,
                { severity: 'success', autoHideDuration: 4000 }
            );
        } catch (e) {
            notifications.show(`Gagal pengecekan: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 4000 });
        } finally {
            setChecking(false);
        }
    }, [notifications]);

    const handleSubmitBatch = React.useCallback(async () => {
        if (!user) return;
        const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) {
            notifications.show('Tidak ada nama alat untuk disubmit', { severity: 'warning', autoHideDuration: 3000 });
            return;
        }

        const unique = [...new Set(lines)];
        setSubmitting(true);
        try {
            const batch = writeBatch(db);
            for (const name of unique) {
                const ref = doc(collection(db, 'equipment_checks'));
                batch.set(ref, {
                    name,
                    user_id: user.uid,
                    matched: null,
                    matched_reference_id: null,
                    reviewed: false,
                    reviewed_at: null,
                    created_at: Timestamp.now(),
                });
            }
            await batch.commit();
            notifications.show(`${unique.length} alat berhasil disubmit`, { severity: 'success', autoHideDuration: 3000 });
            setRawText('');
            await handleRunCheck();
        } catch (e) {
            notifications.show(`Gagal submit: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 4000 });
        } finally {
            setSubmitting(false);
        }
    }, [rawText, user, notifications, handleRunCheck]);

    const loadReviewQueue = React.useCallback(async () => {
        setLoadingQueue(true);
        try {
            const snap = await getDocs(
                query(
                    collection(db, 'equipment_checks'),
                    where('matched', '==', false),
                    where('reviewed', '==', false),
                )
            );
            const items: EquipmentCheckItem[] = snap.docs
                .map((d) => ({
                    id: d.id,
                    name: String(d.data().name || ''),
                    matched: d.data().matched as boolean | null,
                    matched_reference_id: d.data().matched_reference_id ?? null,
                    reviewed: Boolean(d.data().reviewed),
                    reviewed_at: d.data().reviewed_at ?? null,
                    created_at: d.data().created_at ?? null,
                }))
                .sort((a, b) => {
                    const ta = a.created_at?.seconds ?? 0;
                    const tb = b.created_at?.seconds ?? 0;
                    return ta - tb;
                });
            setQueue(items);
            setQueueIndex(0);
            setLastReviewedName(null);
            setAddedToRef(false);

            const uncheckedSnap = await getDocs(
                query(collection(db, 'equipment_checks'), where('matched', '==', null))
            );
            setUncheckedCount(uncheckedSnap.size);
        } catch (e) {
            notifications.show(`Gagal memuat antrian: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 4000 });
        } finally {
            setLoadingQueue(false);
        }
    }, [notifications]);

    React.useEffect(() => {
        if (activeTab === 'review' && user) loadReviewQueue();
    }, [activeTab, user, loadReviewQueue]);

    const handleVerify = React.useCallback(async () => {
        if (!currentTool) return;
        setProcessingItem(true);
        try {
            await updateDoc(doc(db, 'equipment_checks', currentTool.id), {
                reviewed: true,
                reviewed_at: Timestamp.now(),
            });
            setLastReviewedName(currentTool.name);
            setAddedToRef(false);
            notifications.show('Alat ditandai sudah dicek', { severity: 'success', autoHideDuration: 2000 });
            setQueueIndex((i) => i + 1);
        } catch (e) {
            notifications.show(`Gagal update: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        } finally {
            setProcessingItem(false);
        }
    }, [currentTool, notifications]);

    const handleSkip = React.useCallback(() => {
        setLastReviewedName(null);
        setAddedToRef(false);
        setQueueIndex((i) => i + 1);
    }, []);

    const handleAddToReference = React.useCallback(async (name: string) => {
        try {
            await addDoc(collection(db, 'reference_tools'), {
                name,
                calibrated_external: false,
            });
            setAddedToRef(true);
            notifications.show(`"${name}" ditambahkan ke referensi`, { severity: 'success', autoHideDuration: 3000 });
        } catch (e) {
            notifications.show(`Gagal menambahkan: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        }
    }, [notifications]);

    const handleGoogleSearch = React.useCallback((term: string) => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(term)}+alat+medis`, '_blank');
        window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}+alat+medis`, '_blank');
    }, []);

    const allDone = activeTab === 'review' && queue.length > 0 && queueIndex >= total;
    const noQueue = activeTab === 'review' && !loadingQueue && queue.length === 0;

    return (
        <PageContainer
            title="Cek Alat vs Referensi"
            breadcrumbs={[
                { title: 'Dashboard', path: '/' },
                { title: 'Cek Alat' },
            ]}
        >
            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('input')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'input'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Input & Pengecekan
                </button>
                <button
                    onClick={() => setActiveTab('review')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'review'
                            ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    Review Pengecekan Alat
                    {uncheckedCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full">
                            {uncheckedCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab: Input & Pengecekan */}
            {activeTab === 'input' && (
                <div className="space-y-6">
                    {/* Reference info */}
                    <Card>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">Referensi</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {referenceCount === null
                                            ? 'Memeriksa...'
                                            : referenceCount === 0
                                                ? 'Belum ada data referensi'
                                                : `${referenceCount} alat referensi`}
                                    </p>
                                </div>
                                {referenceCount === 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open('/referensi-alat', '_blank')}
                                    >
                                        Kelola Referensi
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Batch input */}
                    <Card>
                        <CardContent>
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Input Batch Alat</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                Paste nama alat, satu per baris. Baris kosong dan duplikat akan di-skip otomatis.
                            </p>
                            <textarea
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all text-sm font-mono min-h-[200px] resize-y"
                                placeholder={"Contoh:\nUSG Portable\nOxymeter Finger\nECG 12 Lead\nNebulizer Portable"}
                                disabled={submitting}
                            />
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {rawText.split('\n').filter((l) => l.trim().length > 0).length} baris terdeteksi
                                </span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setRawText('')}
                                        disabled={submitting || !rawText.trim()}
                                    >
                                        Bersihkan
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleSubmitBatch}
                                        loading={submitting}
                                        disabled={!rawText.trim() || referenceCount === 0}
                                    >
                                        Submit Batch
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tab: Review Queue */}
            {activeTab === 'review' && (
                <div className="space-y-4">
                    {loadingQueue ? (
                        <CardContent>
                            <div className="flex items-center justify-center py-20">
                                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="ml-3 text-gray-500">Memuat antrian...</span>
                            </div>
                        </CardContent>
                    ) : noQueue ? (
                        <CardContent>
                            <div className="text-center py-20">
                                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tidak Ada di Antrian</h2>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {uncheckedCount > 0
                                        ? `Masih ${uncheckedCount} alat belum dicek. Jalankan pengecekan terlebih dahulu.`
                                        : 'Semua alat sudah direview atau belum ada data input.'}
                                </p>
                            </div>
                        </CardContent>
                    ) : allDone ? (
                        <CardContent>
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Antrian Selesai</h2>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">Semua {total} alat sudah direview.</p>

                                {lastReviewedName && (
                                    <div className="max-w-md mx-auto mb-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Alat terakhir direview:</p>
                                        <p className="font-semibold text-gray-900 dark:text-white mb-3">{lastReviewedName}</p>
                                        {!addedToRef ? (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => handleAddToReference(lastReviewedName)}
                                            >
                                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                </svg>
                                                Tambah ke Referensi
                                            </Button>
                                        ) : (
                                            <span className="inline-flex items-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Sudah ditambahkan
                                            </span>
                                        )}
                                    </div>
                                )}

                                <Button variant="primary" onClick={loadReviewQueue}>Muat Ulang</Button>
                            </div>
                        </CardContent>
                    ) : currentTool ? (
                        <>
                            {/* Progress */}
                            <div className="px-1">
                                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    <span>Progres: {queueIndex + 1} / {total}</span>
                                    <span>{remaining} tersisa</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${((queueIndex + 1) / total) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <Card>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nama Alat</label>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentTool.name}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                variant="primary"
                                                onClick={() => handleGoogleSearch(currentTool.name)}
                                                startIcon={
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                }
                                            >
                                                Cari di Google
                                            </Button>
                                            <Button
                                                variant="success"
                                                onClick={handleVerify}
                                                disabled={processingItem}
                                                loading={processingItem}
                                                startIcon={
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                }
                                            >
                                                Tandai Sudah Dicek
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                onClick={handleSkip}
                                                disabled={processingItem}
                                            >
                                                Lewati
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : null}
                </div>
            )}
        </PageContainer>
    );
}
