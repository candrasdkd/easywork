import * as React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// MUI/XDG
import {
    GridActionsCellItem,
    type GridColDef,
    type GridPaginationModel,
} from '@mui/x-data-grid';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Stack, TextField, Autocomplete, Alert, IconButton, ButtonGroup,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

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

// UI
import CalibrationList from '../components/CalibrationList';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

dayjs.locale('id');

// + tambahkan di InventoryItem
export type InventoryItem = {
    id: string;
    user_id?: string;
    brand_name: string;
    implementation_date: Timestamp | Date | string | null;
    person_responsible: string;
    room_name: string;
    serial_number: string;
    tool_name: string;
    type_name: string;
    catatan?: string;
    satuan?: string; // New field for unit
    jumlah?: number | string; // Default quantity (1)
    kondisi_baik?: boolean; // Checkbox for 'Baik'
    kondisi_rr?: boolean; // Checkbox for 'RR'
    kondisi_rb?: boolean; // Checkbox for 'RB'
};



type NamedDoc = { id: string; name: string };

// ===== Helpers (pure) =====
const implementationDateToDisplay = (value: InventoryItem['implementation_date']) => {
    if (!value) return '';
    let date: Date;
    if (value instanceof Timestamp) date = value.toDate();
    else if (typeof value === 'string') date = new Date(value);
    else date = value;
    return dayjs(date).format('DD MMMM YYYY');
};

const toDate = (value: InventoryItem['implementation_date']) => {
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
export default function InventoryListPage() {
    const dialogs = useDialogs();
    const notifications = useNotifications();

    const [searchText, setSearchText] = React.useState('');
    const [allItems, setAllItems] = React.useState<InventoryItem[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);
    const [selectedMonth, setSelectedMonth] = React.useState(dayjs()); // default: bulan ini

    // Pagination (server-mode UX, but data paginated locally)
    const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
        page: 0,
        pageSize: 30,
    });
    const [rows, setRows] = React.useState<InventoryItem[]>([]);
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
    const [unitOptions, setUnitOptions] = React.useState<NamedDoc[]>([]);
    const loadOptions = React.useCallback(async () => {
        try {
            // ⬇️ GANTI NAMA VARIABEL SNAPSHOT
            const [toolSnap, brandSnap, roomSnap, unitSnap] = await Promise.all([
                getDocs(query(collection(db, 'tools'), orderBy('name'))),
                getDocs(query(collection(db, 'brands'), orderBy('name'))),
                getDocs(query(collection(db, 'rooms'), orderBy('name'))),
                getDocs(query(collection(db, 'units'), orderBy('name'))),
            ]);
            setToolOptions(toolSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
            setBrandOptions(brandSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
            // ⬇️ PERBAIKI BUG DI SINI (gunakan roomSnap dan unitSnap)
            setRoomOptions(roomSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
            setUnitOptions(unitSnap.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })));
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
                    collection(db, 'inventory_data'),
                    where('implementation_date', '>=', Timestamp.fromDate(startOfMonth)),
                    where('implementation_date', '<=', Timestamp.fromDate(endOfMonth)),
                    // TAMBAHKAN INI: Urutkan berdasarkan tanggal, dari terbaru (descending)
                    orderBy('implementation_date', 'desc')
                );
            } else {
                qRef = query(
                    collection(db, 'inventory_data'),
                    where('user_id', '==', uid),
                    where('implementation_date', '>=', Timestamp.fromDate(startOfMonth)),
                    where('implementation_date', '<=', Timestamp.fromDate(endOfMonth)),
                    // TAMBAHKAN INI: Urutkan berdasarkan tanggal, dari terbaru (descending)
                    orderBy('implementation_date', 'desc')
                );
            }

            const snap = await getDocs(qRef);
            const items: InventoryItem[] = snap.docs.map((d) => {
                const data = d.data() as any;
                return {
                    id: d.id,
                    user_id: data.user_id ?? '',
                    brand_name: String(data.brand_name ?? ''),
                    implementation_date: data.implementation_date ?? null,
                    person_responsible: String(data.person_responsible ?? ''),
                    room_name: String(data.room_name ?? ''),
                    serial_number: String(data.serial_number ?? ''),
                    tool_name: String(data.tool_name ?? ''),
                    type_name: String(data.type_name ?? ''),
                    satuan: String(data.satuan ?? ''),
                    jumlah: Number(data.jumlah ?? 0),
                    kondisi_baik: Boolean(data.kondisi_baik ?? false),
                    kondisi_rr: Boolean(data.kondisi_rr ?? false),
                    kondisi_rb: Boolean(data.kondisi_rb ?? false),
                    catatan: String(data.catatan ?? ''),
                };
            });

            setAllItems(items);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [uid, selectedMonth, auth.currentUser]); // <-- auth ditambahkan ke dependency array

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
    const emptyForm: Omit<InventoryItem, 'id'> = {
        user_id: '',
        brand_name: '',
        implementation_date: new Date(),
        person_responsible: '',
        room_name: '',
        serial_number: '',
        tool_name: '',
        type_name: '',
        satuan: '', // ⬅️ NEW
        jumlah: 1, // ⬅️ NEW
        kondisi_baik: false, // ⬅️ NEW
        kondisi_rr: false, // ⬅️ NEW
        kondisi_rb: false, // ⬅️ NEW
        catatan: '', // ⬅️ NEW
    };


    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<InventoryItem | null>(null);
    const [form, setForm] = React.useState<Omit<InventoryItem, 'id'>>(emptyForm);
    const [saving, setSaving] = React.useState(false);
    const theme = useTheme();
    const isXs = useMediaQuery(theme.breakpoints.down('sm')); // < 600px

    const openCreate = React.useCallback(() => {
        setEditingItem(null);
        setDialogOpen(true);
    }, [picName, uid]);

    const openEdit = React.useCallback((item: InventoryItem) => {
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
    const [addDialogOpen, setAddDialogOpen] = React.useState<null | 'tool' | 'brand' | 'satuan' | 'ruangan'>(null);
    const [newName, setNewName] = React.useState('');
    const [savingMaster, setSavingMaster] = React.useState(false);
    const collectionNameMap: Record<string, string> = {
        tool: 'tools',
        brand: 'brands',
        satuan: 'units',
        ruangan: 'rooms',
    };
    const displayNameMap: Record<string, string> = {
        tool: 'Nama Alat',
        brand: 'Merek',
        satuan: 'Satuan',
        ruangan: 'Ruangan',
    };
    const formFieldMap: Record<string, string> = {
        tool: 'tool_name',
        brand: 'brand_name',
        satuan: 'satuan',
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
    const handleEdit = React.useCallback((item: InventoryItem) => () => openEdit(item), [openEdit]);

    const handleDelete = React.useCallback(
        (item: InventoryItem) => async () => {
            const confirmed = await dialogs.confirm(`Kamu yakin ingin menghapus data ini?`, {
                title: `Hapus ${item.tool_name}?`,
                severity: 'error',
                okText: 'Delete',
                cancelText: 'Cancel',
            });
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, 'inventory_data', item.id));
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
    const columns = React.useMemo<GridColDef<InventoryItem>[]>(
        () => [
            // {
            //     field: 'label_number', headerName: 'NO. LABEL', width: 160, align: 'center', headerAlign: 'center',
            //     renderCell: (p) => highlightMatch(p.row.label_number, searchText)
            // },
            {
                field: 'tool_name', headerName: 'NAMA ALAT', width: 220, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.tool_name, searchText)
            },
            {
                field: 'brand_name', headerName: 'MEREK', width: 160, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.brand_name, searchText)
            },
            {
                field: 'type_name', headerName: 'TIPE', width: 160, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.type_name, searchText)
            },
            {
                field: 'serial_number', headerName: 'NO. SERI', width: 160, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.serial_number, searchText)
            },
            {
                field: 'room_name', headerName: 'RUANGAN', width: 160, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.room_name, searchText)
            },
            {
                field: 'satuan', headerName: 'SATUAN', width: 160, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.satuan, searchText)
            },
            {
                field: 'jumlah', headerName: 'JUMLAH', width: 140, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.jumlah, searchText)
            },

            {
                field: 'implementation_date',
                headerName: 'TANGGAL PELAKSANAAN',
                type: 'date',
                valueGetter: (value) => {
                    if (!value) return null;
                    if (value && typeof value === 'object' && (value as any) instanceof Timestamp) return (value as Timestamp).toDate();
                    if (typeof value === 'string') return new Date(value);
                    return value as Date;
                },
                valueFormatter: (value) => (value ? dayjs(value as Date).format('DD MMMM YYYY') : ''),
                width: 180, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(implementationDateToDisplay(p.row.implementation_date), searchText),
            },
            {
                field: 'person_responsible', headerName: 'PENANGGUNG JAWAB', width: 220, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.person_responsible, searchText)
            },
            {
                field: 'catatan', headerName: 'CATATAN', width: 220, align: 'center', headerAlign: 'center',
                renderCell: (p) => highlightMatch(p.row.catatan, searchText)
            },
            {
                field: 'actions', headerName: 'ACTIONS', type: 'actions', width: 100, align: 'center', headerAlign: 'center',
                getActions: ({ row }) => [
                    <GridActionsCellItem key="edit" icon={<EditIcon />} label="Edit"
                        onClick={(e) => { e.stopPropagation(); handleEdit(row)(); }} />,
                    <GridActionsCellItem key="delete" icon={<DeleteIcon />} label="Delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(row)(); }} />,
                ],
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
            'Nama Alat': row.tool_name,
            'Merek': row.brand_name,
            'Tipe': row.type_name,
            'No. Seri': row.serial_number,
            'Ruangan': row.room_name,
            'Satuan': row.satuan || 'Set', // Default to 'Set' if no unit is provided
            'Jumlah': row.jumlah || 1, // Default quantity is 1
            'Baik': row.kondisi_baik ? '✔' : '',
            'RR': row.kondisi_rr ? '✔' : '',
            'RB': row.kondisi_rb ? '✔' : '',
            'Catatan': row.catatan ?? '',
            'Tanggal Pelaksanaan': implementationDateToDisplay(row.implementation_date),
            'Penanggung Jawab': row.person_responsible,
        }));

        const header = Object.keys(data[0] || {});
        const dataWithHeader = [header, ...data.map((r) => Object.values(r))];
        const ws = XLSX.utils.aoa_to_sheet(dataWithHeader);

        ws['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
            { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 20 },
            { wch: 26 }, { wch: 16 }, { wch: 30 }, // Adjusted for new fields
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory Data');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileSuffix = dayjs(selectedMonth).format('YYYY_MM');
        saveAs(blob, `Inventory_Data_${fileSuffix}.xlsx`);
    }, [allItems, searchText, selectedMonth]);


    // ===== Normalizers & validators (keras) =====
    const norm = (v: unknown): string =>
        v == null ? '' : typeof v === 'string' ? v.trim() : String(v).trim();

    const getMissingRequired = (f: Omit<InventoryItem, 'id'>) => {
        const missing: string[] = [];

        // Wajib semuanya:
        if (!norm(f.tool_name)) missing.push('Nama Alat');
        if (!norm(f.brand_name)) missing.push('Merek');
        if (!norm(f.type_name)) missing.push('Tipe');
        if (!norm(f.serial_number)) missing.push('No. Seri');
        // if (!norm(f.capacity)) missing.push('Kapasitas');
        // if (!norm(f.level_of_accuracy)) missing.push('Tingkat Ketelitian');
        // if (!norm(f.label_number)) missing.push('No. Label');
        if (!norm(f.room_name)) missing.push('Ruangan');
        if (!f.implementation_date) missing.push('Tanggal Pelaksanaan'); // khusus tanggal

        return missing;
    };


    // === Save (create/update) ===
    const handleSave = React.useCallback(async () => {
        const missing = getMissingRequired(form);
        if (missing.length) {
            notifications.show(
                `Harus diisi: ${missing.join(', ')}`,
                { severity: 'warning', autoHideDuration: 4000 }
            );
            return;
        }

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
                room_name: norm(form.room_name),
                person_responsible: norm(picName),
                catatan: norm(form.catatan),
                implementation_date: form.implementation_date
                    ? Timestamp.fromDate(new Date(form.implementation_date as any))
                    : null,
                satuan: norm(form.satuan), // Save unit
                jumlah: form.jumlah ?? 1, // Default quantity is 1
                kondisi_baik: form.kondisi_baik || false, // Save condition checkboxes
                kondisi_rr: form.kondisi_rr || false,
                kondisi_rb: form.kondisi_rb || false,
            };

            if (editingItem) {
                await updateDoc(doc(db, 'inventory_data', editingItem.id), payload as any);
                notifications.show('Data berhasil diperbarui', { severity: 'success', autoHideDuration: 3000 });
            } else {
                await addDoc(collection(db, 'inventory_data'), payload as any);
                notifications.show('Data berhasil ditambahkan', { severity: 'success', autoHideDuration: 3000 });
            }

            setForm({
                tool_name: '',
                brand_name: '',
                type_name: '',
                serial_number: '',
                room_name: payload.room_name,
                catatan: '',
                satuan: payload.satuan, // Save unit
                jumlah: 1, // Default quantity is 1
                kondisi_baik: false, // Save condition checkboxes
                kondisi_rr: false,
                kondisi_rb: false,
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



    const missingRequired = React.useMemo(() => getMissingRequired(form), [form]);
    const disableSave = saving || loadingPic || missingRequired.length > 0;

    return (
        <>
            <Stack
                direction={{ xs: 'row', sm: 'row' }}
                spacing={{ xs: 1, sm: 1 }}
                padding={{ xs: 2, sm: 3 }}
                alignItems={{ xs: 'stretch', sm: 'stretch' }}
                justifyContent="space-between"
            >
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="id">
                    <DatePicker
                        label={isXs ? undefined : "Filter Bulan"}
                        views={['year', 'month']}
                        openTo="month"
                        value={selectedMonth}
                        format="MMMM YYYY"
                        onChange={(v) => {
                            if (v) {
                                setSelectedMonth(v);
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }
                        }}
                        slotProps={{
                            textField: {
                                size: 'small',
                                fullWidth: isXs,
                                sx: { minWidth: { xs: 'auto', sm: 220 } },
                            },
                        }}
                    />
                </LocalizationProvider>

                {/* Navigasi bulan: icon di mobile, teks di desktop */}
                {isXs ? (
                    <ButtonGroup variant="outlined" size="small" sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}>
                        <IconButton
                            onClick={() => {
                                setSelectedMonth((m) => m.subtract(1, 'month'));
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }}
                            size="small"
                        >
                            <ArrowBackIosNewIcon fontSize="inherit" />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                setSelectedMonth((m) => m.add(1, 'month'));
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }}
                            size="small"
                        >
                            <ArrowForwardIosIcon fontSize="inherit" />
                        </IconButton>
                    </ButtonGroup>
                ) : (
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setSelectedMonth((m) => m.subtract(1, 'month'));
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }}
                        >
                            Bulan Sebelumnya
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setSelectedMonth((m) => m.add(1, 'month'));
                                setPaginationModel((p) => ({ ...p, page: 0 }));
                            }}
                        >
                            Bulan Berikutnya
                        </Button>
                    </Stack>
                )}
            </Stack >

            <CalibrationList<InventoryItem>
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

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="md" keepMounted>
                <DialogTitle>{editingItem ? 'Edit Kalibrasi' : 'Tambah Kalibrasi'}</DialogTitle>
                <DialogContent dividers>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error.message}</Alert>}

                    {/* Info PIC otomatis */}
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Penanggung Jawab diambil otomatis dari profil pengguna
                    </Alert>

                    <Stack spacing={2} mt={1}>
                        {/* Penanggung Jawab: tampilkan, tapi disable */}
                        <TextField
                            label="Penanggung Jawab (otomatis)"
                            value={picName}
                            fullWidth
                            disabled
                            helperText={loadingPic ? 'Memuat dari users…' : (picName ? 'Diambil dari profil' : 'Belum ada pic_name di users')}
                        />
                        {/* Nama Alat */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Autocomplete
                                options={toolOptions.map(o => o.name)}
                                value={form.tool_name || ''}
                                onChange={(_, v) => setForm(f => ({ ...f, tool_name: v || '' }))}
                                onInputChange={(_, v) => setForm(f => ({ ...f, tool_name: v || '' }))} // penting: hindari undefined
                                renderInput={(params) => <TextField {...params} label="Nama Alat" required />}
                                freeSolo
                                fullWidth
                            />
                            <Button variant="outlined" onClick={() => setAddDialogOpen('tool')}>+</Button>
                        </Stack>

                        {/* Merek */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Autocomplete
                                options={brandOptions.map(o => o.name)}
                                value={form.brand_name || ''}
                                onChange={(_, v) => setForm(f => ({ ...f, brand_name: v || '' }))}
                                onInputChange={(_, v) => setForm(f => ({ ...f, brand_name: v || '' }))} // penting
                                renderInput={(params) => <TextField {...params} label="Merek" required />}
                                freeSolo
                                fullWidth
                            />
                            <Button variant="outlined" onClick={() => setAddDialogOpen('brand')}>+</Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Tipe"
                                value={form.type_name}
                                onChange={(e) => setForm(f => ({ ...f, type_name: e.target.value }))}
                                fullWidth
                            />
                            <TextField
                                label="No. Seri"
                                value={form.serial_number}
                                onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))}
                                fullWidth
                            />
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Autocomplete
                                options={roomOptions.map(o => o.name)}
                                value={form.room_name || ''}
                                onChange={(_, v) => setForm(f => ({ ...f, room_name: v || '' }))}
                                onInputChange={(_, v) => setForm(f => ({ ...f, room_name: v || '' }))}
                                renderInput={(params) => <TextField {...params} label="Ruangan" required />}
                                freeSolo
                                fullWidth
                            />
                            <Button variant="outlined" onClick={() => setAddDialogOpen('ruangan')}>+</Button>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Autocomplete
                                options={unitOptions.map(o => o.name)}
                                value={form.satuan || ''}
                                onChange={(_, v) => setForm(f => ({ ...f, satuan: v || '' }))}
                                onInputChange={(_, v) => setForm(f => ({ ...f, satuan: v || '' }))}
                                renderInput={(params) => <TextField {...params} label="Satuan" required />}
                                freeSolo
                                fullWidth
                            />
                            <Button variant="outlined" onClick={() => setAddDialogOpen('satuan')}>+</Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Jumlah"
                                type="number"
                                value={form.jumlah ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Allow empty string to set state to null
                                    if (val === '') {
                                        setForm(f => ({ ...f, jumlah: '' }));
                                    } else {
                                        // Parse the number
                                        const num = parseInt(val, 10);
                                        // Only set state if it's a valid, non-negative integer
                                        if (!isNaN(num) && num >= 0) {
                                            setForm(f => ({ ...f, jumlah: num }));
                                        }
                                        // If "abc" or "-5", state doesn't change, field doesn't update
                                    }
                                }}
                                inputProps={{ // For numeric keyboard and validation
                                    min: 0,
                                    inputMode: 'numeric',
                                    pattern: '[0-9]*'
                                }}
                                fullWidth
                            />
                        </Stack>

                        <Stack direction="row" spacing={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.kondisi_baik || false}
                                        onChange={(e) => setForm(f => ({ ...f, kondisi_baik: e.target.checked }))}
                                    />
                                }
                                label="Baik"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.kondisi_rr || false}
                                        onChange={(e) => setForm(f => ({ ...f, kondisi_rr: e.target.checked }))}
                                    />
                                }
                                label="RR"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.kondisi_rb || false}
                                        onChange={(e) => setForm(f => ({ ...f, kondisi_rb: e.target.checked }))}
                                    />
                                }
                                label="RB"
                            />
                        </Stack>


                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="id">
                                <DatePicker
                                    label="Tanggal Pelaksanaan"
                                    disabled={saving}
                                    value={form.implementation_date ? dayjs(toDate(form.implementation_date)) : null}
                                    format="DD MMMM YYYY"
                                    onChange={(value) => {
                                        setForm(f => ({
                                            ...f,
                                            implementation_date: value ? value.toDate() : null
                                        }))
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                        },
                                    }}
                                />
                            </LocalizationProvider>
                        </Stack>

                        <TextField
                            label="Catatan"
                            value={form.catatan}
                            onChange={(e) => setForm(f => ({ ...f, catatan: e.target.value }))}
                            fullWidth
                            multiline
                            minRows={5}
                        />

                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelDialog} disabled={saving}>Batal</Button>
                    <Button onClick={handleSave} variant="contained" disabled={disableSave}>
                        {editingItem ? 'Simpan Perubahan' : 'Tambah'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Mini-Dialog: Tambah Master Tool/Brand */}
            <Dialog open={!!addDialogOpen} onClose={() => setAddDialogOpen(null)}>
                {/* ⬇️ GANTI DialogTitle INI */}
                <DialogTitle>
                    Tambah {addDialogOpen ? (displayNameMap[addDialogOpen] || 'Item Baru') : 'Item Baru'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label="Nama"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                        fullWidth
                        sx={{ mt: 1, minWidth: 320 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddDialogOpen(null)} disabled={savingMaster}>Batal</Button>
                    <Button onClick={handleAddMaster} disabled={savingMaster || !newName.trim()} variant="contained">
                        Simpan
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
