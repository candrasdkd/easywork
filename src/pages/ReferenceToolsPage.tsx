import * as React from 'react';
import {
    collection, getDocs, updateDoc, deleteDoc, doc, writeBatch, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FirestoreReferenceTool } from '../lib/seedReferenceTools';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { useDialogs } from '../hooks/useDialogs/useDialogs';

export default function ReferenceToolsPage() {
    const notifications = useNotifications();
    const dialogs = useDialogs();

    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<FirestoreReferenceTool[]>([]);
    const [search, setSearch] = React.useState('');

    // Edit state
    const [editItem, setEditItem] = React.useState<FirestoreReferenceTool | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editExternal, setEditExternal] = React.useState(false);
    const [saving, setSaving] = React.useState(false);

    // Bulk add state
    const [bulkOpen, setBulkOpen] = React.useState(false);
    const [bulkText, setBulkText] = React.useState('');
    const [bulkExternal, setBulkExternal] = React.useState(false);
    const [savingBulk, setSavingBulk] = React.useState(false);

    const loadItems = React.useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'reference_tools'), orderBy('name')));
            setItems(snap.docs.map((d) => ({
                id: d.id,
                name: String(d.data().name || ''),
                calibrated_external: Boolean(d.data().calibrated_external),
            })));
        } catch (e) {
            notifications.show(`Gagal memuat: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 4000 });
        } finally {
            setLoading(false);
        }
    }, [notifications]);

    React.useEffect(() => { loadItems(); }, [loadItems]);

    const filtered = React.useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter((t) => t.name.toLowerCase().includes(q));
    }, [items, search]);

    const handleEdit = React.useCallback((item: FirestoreReferenceTool) => {
        setEditItem(item);
        setEditName(item.name);
        setEditExternal(item.calibrated_external);
    }, []);

    const handleSaveEdit = React.useCallback(async () => {
        if (!editItem || !editName.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'reference_tools', editItem.id), {
                name: editName.trim(),
                calibrated_external: editExternal,
            });
            notifications.show('Berhasil diperbarui', { severity: 'success', autoHideDuration: 2000 });
            setEditItem(null);
            await loadItems();
        } catch (e) {
            notifications.show(`Gagal update: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        } finally {
            setSaving(false);
        }
    }, [editItem, editName, editExternal, notifications, loadItems]);

    const handleDelete = React.useCallback(async (item: FirestoreReferenceTool) => {
        const confirmed = await dialogs.confirm(`Hapus "${item.name}" dari referensi?`, {
            title: 'Hapus Referensi',
            severity: 'error',
            okText: 'Hapus',
            cancelText: 'Batal',
        });
        if (!confirmed) return;
        try {
            await deleteDoc(doc(db, 'reference_tools', item.id));
            notifications.show('Berhasil dihapus', { severity: 'success', autoHideDuration: 2000 });
            await loadItems();
        } catch (e) {
            notifications.show(`Gagal hapus: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        }
    }, [dialogs, notifications, loadItems]);

    const handleBulkAdd = React.useCallback(async () => {
        const lines = bulkText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) {
            notifications.show('Tidak ada nama alat', { severity: 'warning', autoHideDuration: 3000 });
            return;
        }

        const unique = [...new Set(lines)];
        const existingNames = new Set(items.map((t) => t.name.toLowerCase()));
        const toAdd = unique.filter((n) => !existingNames.has(n.toLowerCase()));

        if (toAdd.length === 0) {
            notifications.show('Semua nama sudah ada di referensi', { severity: 'info', autoHideDuration: 3000 });
            return;
        }

        setSavingBulk(true);
        try {
            const batch = writeBatch(db);
            for (const name of toAdd) {
                const ref = doc(collection(db, 'reference_tools'));
                batch.set(ref, {
                    name,
                    calibrated_external: bulkExternal,
                });
            }
            await batch.commit();
            const skipped = unique.length - toAdd.length;
            notifications.show(
                `${toAdd.length} ditambahkan${skipped > 0 ? `, ${skipped} duplikat di-skip` : ''}`,
                { severity: 'success', autoHideDuration: 3000 }
            );
            setBulkText('');
            setBulkOpen(false);
            await loadItems();
        } catch (e) {
            notifications.show(`Gagal add: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 4000 });
        } finally {
            setSavingBulk(false);
        }
    }, [bulkText, bulkExternal, items, notifications, loadItems]);

    const extCount = items.filter((t) => t.calibrated_external).length;

    return (
        <PageContainer
            title="Referensi Alat"
            breadcrumbs={[
                { title: 'Dashboard', path: '/' },
                { title: 'Referensi Alat' },
            ]}
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadItems} disabled={loading}>
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Muat Ulang
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => setBulkOpen(true)}>
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Banyak
                    </Button>
                </div>
            }
        >
            {/* Stats */}
            <div className="flex gap-4 mb-4">
                <Card>
                    <CardContent className="py-3 px-5">
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{items.length}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Referensi</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="py-3 px-5">
                        <p className="text-2xl font-bold text-amber-600">{extCount}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Kalibrasi Eksternal (*)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="mb-4">
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama alat..."
                    className="max-w-sm"
                />
            </div>

            {/* Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-slate-700">
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-8">#</th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nama Alat</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-40">Kalibrasi Eksternal</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-28">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">Memuat...</td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12 text-gray-400">
                                        {search ? 'Tidak ditemukan' : 'Belum ada data referensi'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item, idx) => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{idx + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                        <td className="px-4 py-3 text-center">
                                            {item.calibrated_external ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                                    (*)
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        window.open(`https://www.google.com/search?q=${encodeURIComponent(item.name)}+alat+medis`, '_blank');
                                                    }}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                                    title="Cari di Google"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                                    title="Hapus"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Edit Modal */}
            <Modal
                open={!!editItem}
                onClose={() => setEditItem(null)}
                title="Edit Referensi"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Batal</Button>
                        <Button variant="primary" onClick={handleSaveEdit} loading={saving} disabled={!editName.trim()}>Simpan</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Nama Alat"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                    />
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={editExternal}
                            onChange={(e) => setEditExternal(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Kalibrasi Eksternal (*)</span>
                    </label>
                </div>
            </Modal>

            {/* Bulk Add Modal */}
            <Modal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                title="Tambah Banyak Referensi"
                maxWidth="lg"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={savingBulk}>Batal</Button>
                        <Button
                            variant="primary"
                            onClick={handleBulkAdd}
                            loading={savingBulk}
                            disabled={!bulkText.trim()}
                        >
                            Tambahkan
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Paste nama alat, satu per baris. Duplikat otomatis di-skip.
                    </p>
                    <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all text-sm font-mono min-h-[200px] resize-y"
                        placeholder={"Contoh:\nMRI Scanner\nCTG Non-Stress Test\nDoppler Vascular"}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {bulkText.split('\n').filter((l) => l.trim().length > 0).length} baris terdeteksi
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={bulkExternal}
                                onChange={(e) => setBulkExternal(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Semua Kalibrasi Eksternal (*)</span>
                        </label>
                    </div>
                </div>
            </Modal>
        </PageContainer>
    );
}
