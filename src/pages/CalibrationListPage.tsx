import * as React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// UI Kit
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import CalibrationList, { type Column, type PaginationModel } from '../components/CalibrationList';

// Hooks
import { useDialogs } from '../hooks/useDialogs/useDialogs';
import useNotifications from '../hooks/useNotifications/useNotifications';

// Firebase
import { db, auth } from '../lib/firebase';
import {
    collection, getDocs, deleteDoc, doc, Timestamp, query, orderBy,
    addDoc, updateDoc, where, limit, getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

dayjs.locale('id');

// + tambahkan di CalibrationItem
export type CalibrationItem = {
    id: string;
    user_id?: string;
    brand_name: string;
    capacity: string;
    implementation_date: Timestamp | Date | string | null;
    label_number: string;
    level_of_accuracy: string;
    person_responsible: string;
    room_name: string;
    serial_number: string;
    tool_name: string;
    type_name: string;
    catatan?: string;
};


type NamedDoc = { id: string; name: string };

// ===== Helpers (pure) =====
const implementationDateToDisplay = (value: CalibrationItem['implementation_date']) => {
    if (!value) return '';
    let date: Date;
    if (value instanceof Timestamp) date = value.toDate();
    else if (typeof value === 'string') date = new Date(value);
    else date = value;
    return dayjs(date).format('DD MMMM YYYY');
};

const toDate = (value: CalibrationItem['implementation_date']) => {
    if (!value) return null;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'string') return new Date(value);
    return value as Date;
};

// highlight pencarian
const highlightMatch = (text: string | number | undefined | null, search: string) => {
    const source = String(text ?? '');
    if (!search) return source;
    const regex = new RegExp(`(${search})`, 'gi');
    const parts = source.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === search.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
            )}
        </>
    );
};

// ===== Page (stateful, owns logic) =====
export default function CalibrationListPage() {
    const dialogs = useDialogs();
    const notifications = useNotifications();

    const [searchText, setSearchText] = React.useState('');
    const [allItems, setAllItems] = React.useState<CalibrationItem[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);
    const [selectedMonth, setSelectedMonth] = React.useState(dayjs()); // default: bulan ini

    // Pagination (server-mode UX, but data paginated locally)
    const [paginationModel, setPaginationModel] = React.useState<PaginationModel>({
        page: 0,
        pageSize: 30,
    });
    const [rows, setRows] = React.useState<CalibrationItem[]>([]);
    const [rowCount, setRowCount] = React.useState(0);

    // === Current user & PIC (from users collection) ===
    const [uid, setUid] = React.useState<string | null>(auth.currentUser?.uid ?? null);
    const [picName, setPicName] = React.useState<string>('');          // from users.pic_name
    const [loadingPic, setLoadingPic] = React.useState<boolean>(false);

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUid(u?.uid ?? null);
        });
        return () => unsub();
    }, []);

    const loadPicName = React.useCallback(async (userId: string) => {
        setLoadingPic(true);
        try {
            // 1) Query users by uuid_account
            const qRef = query(
                collection(db, 'users'),
                where('uuid_account', '==', userId),
                limit(1)
            );
            const qSnap = await getDocs(qRef);
            if (!qSnap.empty) {
                const data = qSnap.docs[0].data() as any;
                setPicName(String(data?.pic_name ?? ''));
                return;
            }
            // 2) Fallback: doc users/{uid}
            const docRef = doc(db, 'users', userId);
            const dSnap = await getDoc(docRef);
            if (dSnap.exists()) {
                const data = dSnap.data() as any;
                setPicName(String(data?.pic_name ?? ''));
                return;
            }
            // 3) No record found
            setPicName('');
        } catch (e) {
            console.error('Load pic_name failed:', e);
            setPicName('');
        } finally {
            setLoadingPic(false);
        }
    }, []);

    React.useEffect(() => {
        if (uid) loadPicName(uid);
    }, [uid, loadPicName]);

    // === Options for tools & brands ===
    const [toolOptions, setToolOptions] = React.useState<NamedDoc[]>([]);
    const [brandOptions, setBrandOptions] = React.useState<NamedDoc[]>([]);
    const [roomOptions, setRoomOptions] = React.useState<NamedDoc[]>([]);
    const loadOptions = React.useCallback(async () => {
        try {
            const [toolSnap, brandSnap, roomSnap] = await Promise.all([
                getDocs(query(collection(db, 'tools'), orderBy('name'))),
                getDocs(query(collection(db, 'brands'), orderBy('name'))),
                getDocs(query(collection(db, 'rooms'), orderBy('name'))),
            ]);
            setToolOptions(toolSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
            setBrandOptions(brandSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
            setRoomOptions(roomSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
        } catch (e) {
            console.error(e);
        }
    }, []);

    // === Data load ===
    const fetchItems = React.useCallback(async () => {
        if (!uid) {
            setAllItems([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const startOfMonth = dayjs(selectedMonth).startOf('month').toDate();
            const endOfMonth = dayjs(selectedMonth).endOf('month').toDate();

            let qRef;
            if (auth.currentUser?.email === 'candrametal@gmail.com') {
                qRef = query(
                    collection(db, 'calibration_data'),
                    where('implementation_date', '>=', Timestamp.fromDate(startOfMonth)),
                    where('implementation_date', '<=', Timestamp.fromDate(endOfMonth)),
                    orderBy('implementation_date', 'desc')
                );
            } else {
                qRef = query(
                    collection(db, 'calibration_data'),
                    where('user_id', '==', uid),
                    where('implementation_date', '>=', Timestamp.fromDate(startOfMonth)),
                    where('implementation_date', '<=', Timestamp.fromDate(endOfMonth)),
                    orderBy('implementation_date', 'desc')
                );
            }

            const snap = await getDocs(qRef);
            const items: CalibrationItem[] = snap.docs.map((d) => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    user_id: data.user_id ?? '',
                    brand_name: String(data.brand_name ?? ''),
                    capacity: String(data.capacity ?? ''),
                    implementation_date: data.implementation_date ?? null,
                    label_number: String(data.label_number ?? ''),
                    level_of_accuracy: String(data.level_of_accuracy ?? ''),
                    person_responsible: String(data.person_responsible ?? ''),
                    room_name: String(data.room_name ?? ''),
                    serial_number: String(data.serial_number ?? ''),
                    tool_name: String(data.tool_name ?? ''),
                    type_name: String(data.type_name ?? ''),
                    catatan: String(data.catatan ?? ''), // ⬅️ NEW
                };
            });

            setAllItems(items);
            setDialogOpen(false);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [uid, selectedMonth]);

    React.useEffect(() => { fetchItems(); }, [fetchItems]);
    React.useEffect(() => { loadOptions(); }, [loadOptions]);

    // === Derived paging/filter ===
    const applyPaging = React.useCallback(() => {
        try {
            let filtered = allItems;
            if (searchText.trim()) {
                const q = searchText.toLowerCase();
                filtered = filtered.filter((m) =>
                    Object.entries(m).some(([key, value]) => {
                        if (value == null) return false;
                        if (key === 'implementation_date') {
                            const disp = implementationDateToDisplay(value as any);
                            return disp.toLowerCase().includes(q);
                        }
                        return String(value).toLowerCase().includes(q);
                    })
                );
            }
            const start = paginationModel.page * paginationModel.pageSize;
            const end = start + paginationModel.pageSize;
            setRows(filtered.slice(start, end));
            setRowCount(filtered.length);
        } catch (e) {
            setError(e as Error);
        }
    }, [allItems, paginationModel.page, paginationModel.pageSize, searchText]);

    React.useEffect(() => { applyPaging(); }, [applyPaging]);

    // === Create/Edit dialog state ===
    const emptyForm: Omit<CalibrationItem, 'id'> = {
        user_id: '',
        brand_name: '',
        capacity: '',
        implementation_date: new Date(),
        label_number: '',
        level_of_accuracy: '',
        person_responsible: '',
        room_name: '',
        serial_number: '',
        tool_name: '',
        type_name: '',
        catatan: '', // ⬅️ NEW
    };


    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<CalibrationItem | null>(null);
    const [form, setForm] = React.useState<Omit<CalibrationItem, 'id'>>(emptyForm);
    const [saving, setSaving] = React.useState(false);

    const openCreate = React.useCallback(() => {
        setEditingItem(null);
        setDialogOpen(true);
    }, [picName, uid]);

    const openEdit = React.useCallback((item: CalibrationItem) => {
        setEditingItem(item);
        setForm({
            ...item,
            user_id: item.user_id ?? uid ?? '',
            implementation_date: toDate(item.implementation_date),
            person_responsible: picName || item.person_responsible || '',
            catatan: item.catatan ?? '', // ⬅️ NEW (fallback)
        });
        setDialogOpen(true);
    }, [picName, uid]);


    const closeDialog = React.useCallback(() => {
        setDialogOpen(false);
    }, []);

    const cancelDialog = React.useCallback(() => {
        setForm({
            ...emptyForm,
            user_id: uid ?? '',
            person_responsible: picName || '',
            implementation_date: new Date(), // tetap null
        });
        setDialogOpen(false);
    }, []);
    // === Add new master (tools / brands) ===
    const [addDialogOpen, setAddDialogOpen] = React.useState<null | 'tool' | 'brand' | 'ruangan'>(null);
    const [newName, setNewName] = React.useState('');
    const [savingMaster, setSavingMaster] = React.useState(false);
    const collectionNameMap: Record<string, string> = {
        tool: 'tools',
        brand: 'brands',
        ruangan: 'rooms',
    };
    const displayNameMap: Record<string, string> = {
        tool: 'Nama Alat',
        brand: 'Merek',
        ruangan: 'Ruangan',
    };
    const formFieldMap: Record<string, string> = {
        tool: 'tool_name',
        brand: 'brand_name',
        ruangan: 'room_name',
    };
    const handleAddMaster = async () => {
        if (!newName.trim() || !addDialogOpen) return;

        const collectionName = collectionNameMap[addDialogOpen];
        const displayName = displayNameMap[addDialogOpen];
        const formField = formFieldMap[addDialogOpen];

        if (!collectionName || !displayName || !formField) {
            notifications.show(`Tipe master tidak valid: ${addDialogOpen}`, { severity: 'error', autoHideDuration: 3000 });
            return;
        }

        setSavingMaster(true);
        try {
            await addDoc(collection(db, collectionName), { name: newName.trim() });
            notifications.show(`${displayName} ditambahkan`, { severity: 'success', autoHideDuration: 3000 });

            await loadOptions(); // Reload semua options

            // Set nilai form ke nama yang baru ditambahkan
            setForm(f => ({ ...f, [formField]: newName.trim() }));

            setNewName('');
            setAddDialogOpen(null);
        } catch (e) {
            notifications.show(`Gagal menambah: ${(e as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        } finally {
            setSavingMaster(false);
        }
    };

    const handleEdit = React.useCallback((item: CalibrationItem) => () => openEdit(item), [openEdit]);

    const handleDelete = React.useCallback(
        (item: CalibrationItem) => async () => {
            const confirmed = await dialogs.confirm(`Kamu yakin ingin menghapus data ini?`, {
                title: `Hapus ${item.tool_name}?`,
                severity: 'error',
                okText: 'Delete',
                cancelText: 'Cancel',
            });
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, 'calibration_data', item.id));
                notifications.show('Berhasil menghapus data', { severity: 'success', autoHideDuration: 3000 });
                fetchItems();
            } catch (err) {
                notifications.show(`Gagal menghapus data. Reason: ${(err as Error).message}`, {
                    severity: 'error',
                    autoHideDuration: 3000,
                });
            }
        },
        [dialogs, notifications, fetchItems]
    );

    // === Columns ===
    const columns = React.useMemo<Column<CalibrationItem>[]>(
        () => [
            {
                header: 'NO. LABEL',
                accessor: (row) => highlightMatch(row.label_number, searchText),
                align: 'center',
            },
            {
                header: 'NAMA ALAT',
                accessor: (row) => highlightMatch(row.tool_name, searchText),
                align: 'center',
            },
            {
                header: 'MEREK',
                accessor: (row) => highlightMatch(row.brand_name, searchText),
                align: 'center',
            },
            {
                header: 'RUANGAN',
                accessor: (row) => highlightMatch(row.room_name, searchText),
                align: 'center',
            },
            {
                header: 'TANGGAL PELAKSANAAN',
                accessor: (row) => highlightMatch(implementationDateToDisplay(row.implementation_date), searchText),
                align: 'center',
            },
            {
                header: 'PENANGGUNG JAWAB',
                accessor: (row) => highlightMatch(row.person_responsible, searchText),
                align: 'center',
            },
            {
                header: 'AKSI',
                align: 'center',
                accessor: (row) => (
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(row)(); }}
                            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(row)(); }}
                            className="p-1 text-red-600 hover:text-red-800 transition-colors"
                            title="Delete"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                ),
            },
        ],
        [searchText, handleEdit, handleDelete]
    );

    // === Export ===
    const handleExport = React.useCallback(() => {
        const filtered = allItems.filter((m) => {
            if (!searchText.trim()) return true;
            const q = searchText.toLowerCase();
            return Object.entries(m).some(([key, v]) => {
                if (v == null) return false;
                if (key === 'implementation_date') {
                    const disp = implementationDateToDisplay(v as any);
                    return disp.toLowerCase().includes(q);
                }
                return String(v).toLowerCase().includes(q);
            });
        });

        const data = filtered.map((row) => ({
            'No. Label': row.label_number,
            'Nama Alat': row.tool_name,
            'Merek': row.brand_name,
            'Tipe': row.type_name,
            'No. Seri': row.serial_number,
            'Ruangan': row.room_name,
            'Kapasitas': row.capacity,
            'Tingkat Ketelitian': row.level_of_accuracy,
            'Tanggal Pelaksanaan': implementationDateToDisplay(row.implementation_date),
            'Penanggung Jawab': row.person_responsible,
            'Catatan': row.catatan ?? '', // ⬅️ NEW
        }));

        const header = Object.keys(data[0] || {});
        const dataWithHeader = [header, ...data.map((r) => Object.values(r))];
        const ws = XLSX.utils.aoa_to_sheet(dataWithHeader);

        ws['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
            { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 20 },
            { wch: 26 }, { wch: 16 }, { wch: 30 }, // ⬅️ NEW width Catatan
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Calibration Data');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileSuffix = dayjs(selectedMonth).format('YYYY_MM');
        saveAs(blob, `Calibration_Data_${fileSuffix}.xlsx`);
    }, [allItems, searchText, selectedMonth]);

    // ===== Normalizers & validators (keras) =====
    const norm = (v: unknown): string =>
        v == null ? '' : typeof v === 'string' ? v.trim() : String(v).trim();

    // const getMissingRequired = (f: Omit<CalibrationItem, 'id'>) => {
    //     const missing: string[] = [];

    //     // Wajib semuanya:
    //     if (!norm(f.tool_name)) missing.push('Nama Alat');
    //     if (!norm(f.brand_name)) missing.push('Merek');
    //     if (!norm(f.type_name)) missing.push('Tipe');
    //     if (!norm(f.serial_number)) missing.push('No. Seri');
    //     if (!norm(f.capacity)) missing.push('Kapasitas');
    //     if (!norm(f.level_of_accuracy)) missing.push('Tingkat Ketelitian');
    //     if (!norm(f.label_number)) missing.push('No. Label');
    //     if (!norm(f.room_name)) missing.push('Ruangan');
    //     if (!f.implementation_date) missing.push('Tanggal Pelaksanaan'); // khusus tanggal

    //     return missing;
    // };


    // === Save (create/update) ===
    const handleSave = React.useCallback(async () => {
        // Required per field
        // const missing = getMissingRequired(form);
        // if (missing.length) {
        //     notifications.show(
        //         `Harus diisi: ${missing.join(', ')}`,
        //         { severity: 'warning', autoHideDuration: 4000 }
        //     );
        //     return;
        // }

        if (!uid) {
            notifications.show('User belum terautentikasi.', { severity: 'error', autoHideDuration: 3000 });
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...form,
                user_id: uid,
                tool_name: norm(form.tool_name),
                brand_name: norm(form.brand_name),
                type_name: norm(form.type_name),
                serial_number: norm(form.serial_number),
                level_of_accuracy: norm(form.level_of_accuracy),
                capacity: norm(form.capacity),
                label_number: norm(form.label_number),
                room_name: norm(form.room_name),
                person_responsible: norm(picName),
                catatan: norm(form.catatan), // ⬅️ NEW
                implementation_date: form.implementation_date
                    ? Timestamp.fromDate(new Date(form.implementation_date as any))
                    : null,
            };

            if (editingItem) {
                await updateDoc(doc(db, 'calibration_data', editingItem.id), payload as any);
                notifications.show('Data berhasil diperbarui', { severity: 'success', autoHideDuration: 3000 });
            } else {
                await addDoc(collection(db, 'calibration_data'), payload as any);
                notifications.show('Data berhasil ditambahkan', { severity: 'success', autoHideDuration: 3000 });
            }

            setForm({
                tool_name: '',
                brand_name: '',
                type_name: '',
                serial_number: '',
                room_name: payload.room_name,
                catatan: '',
                level_of_accuracy: '',
                capacity: '',
                label_number: '',
                user_id: uid ?? '',
                person_responsible: picName || '',
                implementation_date: new Date(), // tetap null
            })
            await fetchItems();
        } catch (err) {
            notifications.show(`Gagal menyimpan: ${(err as Error).message}`, { severity: 'error', autoHideDuration: 3000 });
        } finally {
            setSaving(false);
        }
    }, [editingItem, form, uid, picName, notifications, fetchItems]);


    // const missingRequired = React.useMemo(() => getMissingRequired(form), [form]);
    const disableSave = saving || loadingPic

    return (
        <>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 lg:p-6 pb-0">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex-1 sm:w-64">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-1">
                            Filter Bulan
                        </label>
                        <input
                            type="month"
                            value={selectedMonth.format('YYYY-MM')}
                            onChange={(e) => {
                                const v = dayjs(e.target.value);
                                setSelectedMonth(v);
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedMonth((m) => m.subtract(1, 'month'));
                            setPaginationModel((p) => ({ ...p, page: 0 }));
                        }}
                        className="flex-1 sm:flex-none py-2"
                    >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedMonth((m) => m.add(1, 'month'));
                            setPaginationModel((p) => ({ ...p, page: 0 }));
                        }}
                        className="flex-1 sm:flex-none py-2"
                    >
                        <span className="hidden sm:inline">Berikutnya</span>
                        <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </Button>
                </div>
            </div>

            <CalibrationList<CalibrationItem>
                rows={rows}
                rowCount={rowCount}
                columns={columns}
                loading={loading}
                error={error}
                paginationModel={paginationModel}
                onPaginationModelChange={(m) => setPaginationModel(m)}
                searchText={searchText}
                onSearchTextChange={(v) => { setSearchText(v); setPaginationModel((p) => ({ ...p, page: 0 })); }}
                onRefresh={fetchItems}
                onCreate={openCreate}
                onExport={handleExport}
            />

            {/* Create/Edit Modal */}
            <Modal
                open={dialogOpen}
                onClose={closeDialog}
                title={editingItem ? 'Edit Data Kalibrasi' : 'Tambah Data Kalibrasi'}
                maxWidth="2xl"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={cancelDialog} disabled={saving}>
                            Batal
                        </Button>
                        <Button variant="primary" onClick={handleSave} disabled={disableSave}>
                            {saving ? 'Menyimpan...' : (editingItem ? 'Simpan Perubahan' : 'Tambah Data')}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-5">
                    {/* PIC Info */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300 flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Penanggung Jawab: <span className="font-bold">{picName || 'Muat profil...'}</span></span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nama Alat */}
                        <div className="relative group">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Nama Alat</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        list="tool-options"
                                        value={form.tool_name}
                                        onChange={(e) => setForm(f => ({ ...f, tool_name: e.target.value }))}
                                        placeholder="Ketik atau pilih alat"
                                        className="w-full"
                                    />
                                    <datalist id="tool-options">
                                        {toolOptions.map(o => <option key={o.id} value={o.name} />)}
                                    </datalist>
                                </div>
                                <button
                                    onClick={() => setAddDialogOpen('tool')}
                                    className="p-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                                    title="Tambah Alat Baru"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Merek */}
                        <div className="relative group">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Merek</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        list="brand-options"
                                        value={form.brand_name}
                                        onChange={(e) => setForm(f => ({ ...f, brand_name: e.target.value }))}
                                        placeholder="Ketik atau pilih merek"
                                        className="w-full"
                                    />
                                    <datalist id="brand-options">
                                        {brandOptions.map(o => <option key={o.id} value={o.name} />)}
                                    </datalist>
                                </div>
                                <button
                                    onClick={() => setAddDialogOpen('brand')}
                                    className="p-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                                    title="Tambah Merek Baru"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <Input
                            label="Tipe"
                            value={form.type_name}
                            onChange={(e) => setForm(f => ({ ...f, type_name: e.target.value }))}
                            placeholder="Contoh: ACS-30"
                        />
                        <Input
                            label="No. Seri"
                            value={form.serial_number}
                            onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))}
                            placeholder="Contoh: SN123456"
                        />
                        <Input
                            label="Tingkat Ketelitian"
                            value={form.level_of_accuracy}
                            onChange={(e) => setForm(f => ({ ...f, level_of_accuracy: e.target.value }))}
                            placeholder="Contoh: 1g"
                        />
                        <Input
                            label="Kapasitas"
                            value={form.capacity}
                            onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value }))}
                            placeholder="Contoh: 30kg"
                        />
                        <Input
                            label="No. Label"
                            value={form.label_number}
                            onChange={(e) => setForm(f => ({ ...f, label_number: e.target.value }))}
                            placeholder="Contoh: LAB-001"
                        />

                        {/* Ruangan */}
                        <div className="relative group">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Ruangan</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        list="room-options"
                                        value={form.room_name}
                                        onChange={(e) => setForm(f => ({ ...f, room_name: e.target.value }))}
                                        placeholder="Pilih ruangan"
                                        className="w-full"
                                    />
                                    <datalist id="room-options">
                                        {roomOptions.map(o => <option key={o.id} value={o.name} />)}
                                    </datalist>
                                </div>
                                <button
                                    onClick={() => setAddDialogOpen('ruangan')}
                                    className="p-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                                    title="Tambah Ruangan Baru"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Tanggal Pelaksanaan</label>
                            <Input
                                type="date"
                                disabled={saving}
                                value={form.implementation_date ? dayjs(toDate(form.implementation_date)).format('YYYY-MM-DD') : ''}
                                onChange={(e) => {
                                    setForm(f => ({
                                        ...f,
                                        implementation_date: e.target.value ? new Date(e.target.value) : null
                                    }))
                                }}
                                className="w-full"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">Catatan</label>
                            <textarea
                                value={form.catatan}
                                onChange={(e) => setForm(f => ({ ...f, catatan: e.target.value }))}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none transition-all text-sm min-h-[120px]"
                                placeholder="Tambahkan catatan jika ada..."
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Mini-Modal: Tambah Master Tool/Brand */}
            <Modal
                open={!!addDialogOpen}
                onClose={() => setAddDialogOpen(null)}
                title={`Tambah ${displayNameMap[addDialogOpen || ''] || ''}`}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="outline" onClick={() => setAddDialogOpen(null)} disabled={savingMaster}>
                            Batal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleAddMaster}
                            disabled={savingMaster || !newName.trim()}
                        >
                            Simpan
                        </Button>
                    </div>
                }
            >
                <div className="p-1">
                    <Input
                        label={`Nama ${displayNameMap[addDialogOpen || ''] || ''}`}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                        placeholder="Ketik nama baru..."
                        className="w-full"
                    />
                </div>
            </Modal>
        </>
    );
}
