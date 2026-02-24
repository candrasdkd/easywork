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

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; bg: string; border: string; dot: string; shadow: string }> = {
    bisa: {
        label: 'Bisa',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200/60',
        dot: 'bg-emerald-500',
        shadow: 'shadow-emerald-500/20',
    },
    kelistrikan: {
        label: 'Kelistrikan',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200/60',
        dot: 'bg-blue-500',
        shadow: 'shadow-blue-500/20',
    },
    tidak_bisa: {
        label: 'Tidak Bisa',
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200/60',
        dot: 'bg-red-500',
        shadow: 'shadow-red-500/20',
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
            {/* Header/Description Area */}
            <div className="mb-8">
                <p className="text-gray-500 text-sm md:text-base">
                    Kelola dan rekapitulasi data survei peralatan dengan cepat. Paste daftar alat, tentukan status, dan ekspor ke Excel dalam hitungan detik.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Column: Input */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200/60 p-6 flex flex-col h-full relative overflow-hidden transition-all duration-300 hover:shadow-md">
                        {/* decorative gradient blob */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-50/50 blur-2xl pointer-events-none"></div>

                        <div className="flex items-start justify-between mb-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20">
                                        1
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">Input Alat</h2>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Paste daftar alat di bawah ini.
                                </p>
                            </div>

                            {rawText.trim() && (
                                <button
                                    onClick={() => { setRawText(''); setItemStatuses({}); }}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Hapus Semua"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        <textarea
                            className="w-full flex-1 min-h-[400px] xl:min-h-[600px] p-5 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-mono leading-relaxed resize-none text-gray-700 placeholder-gray-400"
                            placeholder={"Contoh:\n\nSWD\nInfrared 3 Lampu\nUSG\nSWD\nInfusion pump"}
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                    </div>
                </div>

                {/* Right Column: Preview & Action */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    {sphItems.length === 0 ? (
                        <div className="bg-white/40 border-2 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px] xl:min-h-[600px]">
                            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Belum Ada Data</h3>
                            <p className="text-gray-500 max-w-sm leading-relaxed">
                                Paste daftar peralatan di kolom sebelah kiri, dan hasilnya akan otomatis terekapitulasi di sini.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-200/60 flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-500 overflow-hidden relative">
                            {/* Header Section */}
                            <div className="p-6 sm:p-8 border-b border-gray-100 bg-white relative z-10">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-500/20">
                                                2
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Preview & Status</h2>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            Klik status pada tabel untuk mengubah kondisinya.
                                        </p>
                                    </div>

                                    {/* Action Button */}
                                    <Button
                                        variant="primary"
                                        className="shrink-0 bg-gray-900 hover:bg-black text-white border-0 shadow-xl shadow-gray-900/20 rounded-xl px-6 py-2.5 font-medium transition-all active:scale-95 flex items-center gap-2"
                                        onClick={handleExportExcel}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Export Excel
                                    </Button>
                                </div>

                                {/* Stats & Legend */}
                                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-center">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Jenis</span>
                                        <span className="text-2xl font-bold text-gray-900">{stats.grouped}</span>
                                    </div>
                                    <div className="bg-emerald-50/50 rounded-2xl p-4 flex flex-col justify-center border border-emerald-100/50">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Bisa
                                        </span>
                                        <span className="text-2xl font-bold text-emerald-700">{stats.bisa}</span>
                                    </div>
                                    <div className="bg-blue-50/50 rounded-2xl p-4 flex flex-col justify-center border border-blue-100/50">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Kelistrikan
                                        </span>
                                        <span className="text-2xl font-bold text-blue-700">{stats.kelistrikan}</span>
                                    </div>
                                    <div className="bg-red-50/50 rounded-2xl p-4 flex flex-col justify-center border border-red-100/50">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span> Tidak Bisa
                                        </span>
                                        <span className="text-2xl font-bold text-red-700">{stats.tidak_bisa}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-hidden bg-white flex flex-col">
                                <div className="overflow-y-auto max-h-[500px] xl:max-h-[600px] xl:min-h-[400px]">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-10">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-16">No</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Alat</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-28">Jumlah</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-40">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50/80">
                                            {sphItems.map((item, idx) => {
                                                const cfg = STATUS_CONFIG[item.status];
                                                return (
                                                    <tr
                                                        key={item.name}
                                                        onClick={() => cycleStatus(item.name)}
                                                        className="cursor-pointer hover:bg-gray-50/80 transition-colors group"
                                                    >
                                                        <td className="px-6 py-4 text-sm text-gray-400 font-mono transition-colors group-hover:text-gray-500">{idx + 1}</td>
                                                        <td className="px-6 py-4 text-sm font-semibold text-gray-800">{item.name}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-lg bg-gray-100/80 text-gray-700 text-xs font-bold border border-gray-200/60">
                                                                {item.count}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm ${cfg.shadow}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                                                {cfg.label}
                                                            </div>
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
                </div>
            </div>
        </PageContainer>
    );
}
