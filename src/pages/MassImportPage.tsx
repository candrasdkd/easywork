import * as React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import * as XLSX from 'xlsx';

// Firebase
import { db, auth } from '../lib/firebase';
import {
    collection, getDocs, query, where, limit, getDoc, doc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// UI
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';

dayjs.locale('id');

type ItemStatus = 'bisa' | 'kelistrikan' | 'tidak_bisa';

interface SphItem {
    name: string;
    count: number;
    status: ItemStatus;
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
    bisa: {
        label: 'Bisa',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
    },
    kelistrikan: {
        label: 'Kelistrikan',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
    },
    tidak_bisa: {
        label: 'Tidak Bisa',
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        dot: 'bg-red-500',
    },
};

const STATUS_CYCLE: ItemStatus[] = ['bisa', 'kelistrikan', 'tidak_bisa'];

export default function SphPage() {
    const notifications = useNotifications();
    const [rawText, setRawText] = React.useState('');

    // Master data
    const [picName, setPicName] = React.useState<string>('');
    const [uid, setUid] = React.useState<string | null>(auth.currentUser?.uid ?? null);
    const [loadingMaster, setLoadingMaster] = React.useState(true);

    // Item statuses
    const [itemStatuses, setItemStatuses] = React.useState<Record<string, ItemStatus>>({});

    React.useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setUid(user?.uid ?? null);
        });
        return unsub;
    }, []);

    const loadMaster = React.useCallback(async (userId: string) => {
        setLoadingMaster(true);
        try {
            const qRef = query(collection(db, 'users'), where('uuid_account', '==', userId), limit(1));
            const qSnap = await getDocs(qRef);
            if (!qSnap.empty) {
                setPicName(String(qSnap.docs[0].data()?.pic_name ?? ''));
            } else {
                const docRef = doc(db, 'users', userId);
                const dSnap = await getDoc(docRef);
                if (dSnap.exists()) {
                    setPicName(String(dSnap.data()?.pic_name ?? ''));
                }
            }
        } catch (e) {
            console.error('Load master data failed:', e);
        } finally {
            setLoadingMaster(false);
        }
    }, []);

    React.useEffect(() => {
        if (uid) loadMaster(uid);
    }, [uid, loadMaster]);

    const groupedData = React.useMemo(() => {
        if (!rawText.trim()) return [];

        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
        const counts: Record<string, number> = {};

        lines.forEach(line => {
            counts[line] = (counts[line] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rawText]);

    // Sync statuses when groupedData changes
    const sphItems: SphItem[] = React.useMemo(() => {
        return groupedData.map(item => ({
            name: item.name,
            count: item.count,
            status: itemStatuses[item.name] ?? 'bisa',
        }));
    }, [groupedData, itemStatuses]);

    const cycleStatus = (name: string) => {
        setItemStatuses(prev => {
            const current = prev[name] ?? 'bisa';
            const idx = STATUS_CYCLE.indexOf(current);
            const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
            return { ...prev, [name]: next };
        });
    };

    const stats = {
        original: rawText.split('\n').filter(l => l.trim() !== '').length,
        grouped: groupedData.length,
        bisa: sphItems.filter(i => i.status === 'bisa').length,
        kelistrikan: sphItems.filter(i => i.status === 'kelistrikan').length,
        tidak_bisa: sphItems.filter(i => i.status === 'tidak_bisa').length,
    };

    const handleExportExcel = () => {
        if (sphItems.length === 0) {
            notifications.show('Harap isi daftar peralatan terlebih dahulu.', { severity: 'warning' });
            return;
        }

        const tanggal = dayjs().format('DD MMMM YYYY');
        const rows = sphItems.map((item, idx) => ({
            'No': idx + 1,
            'Nama Alat': item.name,
            'Jumlah': item.count,
            'Satuan': 'Pcs',
            'Kondisi': STATUS_CONFIG[item.status].label,
            'Tanggal SPH': tanggal,
            'Penanggungjawab': picName,
        }));

        const ws = XLSX.utils.json_to_sheet(rows);

        // Column widths
        ws['!cols'] = [
            { wch: 5 },
            { wch: 40 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 20 },
            { wch: 30 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'SPH');

        const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const a = document.createElement('a');
        a.href = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
        a.download = `SPH_Data_${dayjs().format('YYYY_MM_DD')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        notifications.show(`Berhasil mengekspor ${sphItems.length} item ke Excel.`, { severity: 'success' });
    };

    if (loadingMaster) {
        return (
            <PageContainer title="SPH — Survei Peralatan">
                <div className="flex items-center justify-center p-20">
                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer title="SPH — Survei Peralatan">
            <div className="space-y-6">

                {/* Step 1 — Input */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                                <h2 className="text-lg font-bold text-gray-900">Input Daftar Peralatan</h2>
                            </div>
                            <p className="text-sm text-gray-500 ml-9">
                                Tempelkan daftar nama alat. Satu baris = satu alat. Nama yang sama otomatis dijumlahkan.
                            </p>
                        </div>
                        {rawText.trim() && (
                            <button
                                onClick={() => { setRawText(''); setItemStatuses({}); }}
                                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium px-3 py-2 border border-red-200 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Hapus Semua
                            </button>
                        )}
                    </div>
                    <textarea
                        rows={8}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono resize-none"
                        placeholder={"Contoh:\nSWD\nInfrared 3 Lampu\nUSG\nSWD\nInfusion pump"}
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                    />
                </div>

                {/* Step 2 — Preview */}
                {sphItems.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 text-xs font-bold">2</span>
                                    <h2 className="text-lg font-bold text-gray-900">Preview & Tentukan Status</h2>
                                </div>
                                <p className="text-sm text-gray-500 ml-9">Klik tiap baris untuk mengganti status kondisi alat.</p>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-3 ml-9 sm:ml-0">
                                {(Object.entries(STATUS_CONFIG) as [ItemStatus, typeof STATUS_CONFIG[ItemStatus]][]).map(([key, cfg]) => (
                                    <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                                        {cfg.label}
                                    </span>
                                ))}
                                <span className="text-xs text-gray-400 italic">← klik baris untuk ganti</span>
                            </div>
                        </div>

                        {/* Stats badges */}
                        <div className="flex flex-wrap gap-2 mb-5 ml-9 sm:ml-0">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                Total baris: {stats.original}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Bisa: {stats.bisa}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>Kelistrikan: {stats.kelistrikan}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>Tidak Bisa: {stats.tidak_bisa}
                            </span>
                        </div>

                        {/* Table */}
                        <div className="border border-gray-100 rounded-xl overflow-hidden">
                            <div className="max-h-[480px] overflow-y-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-10">#</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Alat</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-24">Jml</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-36">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {sphItems.map((item, idx) => {
                                            const cfg = STATUS_CONFIG[item.status];
                                            return (
                                                <tr
                                                    key={item.name}
                                                    onClick={() => cycleStatus(item.name)}
                                                    className="cursor-pointer hover:bg-gray-50 transition-colors group select-none"
                                                >
                                                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                                                            {item.count}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                {sphItems.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="text-sm text-gray-500">
                            <span className="font-semibold text-gray-800">{stats.grouped} jenis alat</span> siap diekspor ·{' '}
                            <span className="text-gray-400">{dayjs().format('DD MMMM YYYY')}</span>
                        </div>
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleExportExcel}
                            className="w-full sm:w-auto min-w-[220px] shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export ke Excel
                        </Button>
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
