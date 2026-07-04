import * as React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import * as XLSX from 'xlsx';

// Firebase
import { db } from '../lib/firebase';
import {
    collection, getDocs, query, where, limit, getDoc, doc
} from 'firebase/firestore';

// UI
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { useAuth } from '../contexts/AuthContext';

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

// Helper functions for name similarity search (Sørensen–Dice coefficient / Bigram overlap)
const getBigrams = (str: string) => {
    const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bigrams: string[] = [];
    for (let i = 0; i < clean.length - 1; i++) {
        bigrams.push(clean.slice(i, i + 2));
    }
    return bigrams;
};

const getSimilarity = (str1: string, str2: string): number => {
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    if (bigrams1.length === 0 && bigrams2.length === 0) return 1;
    if (bigrams1.length === 0 || bigrams2.length === 0) return 0;

    const intersection = bigrams1.filter(b => bigrams2.includes(b)).length;
    return (2 * intersection) / (bigrams1.length + bigrams2.length);
};

export default function SphPage() {
    const notifications = useNotifications();
    const [activeTab, setActiveTab] = React.useState<'single' | 'quantity'>('single');
    const [rawTextSingle, setRawTextSingle] = React.useState('');
    const [rawTextQuantity, setRawTextQuantity] = React.useState('');
    const [aliases, setAliases] = React.useState<Record<string, string>>({});
    const [dragOverName, setDragOverName] = React.useState<string | null>(null);
    const [showDuplicatesOnly, setShowDuplicatesOnly] = React.useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = React.useState(false);
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    const { user } = useAuth();
    const uid = user?.uid ?? null;

    // Master data
    const [picName, setPicName] = React.useState<string>('');
    const [loadingMaster, setLoadingMaster] = React.useState(true);

    // Item statuses
    const [itemStatuses, setItemStatuses] = React.useState<Record<string, ItemStatus>>({});

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

    const handleDragStart = (e: React.DragEvent, name: string) => {
        e.dataTransfer.setData('text/plain', name);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, targetName: string) => {
        e.preventDefault();
        if (dragOverName !== targetName) {
            setDragOverName(targetName);
        }
    };

    const handleDragLeave = () => {
        setDragOverName(null);
    };

    const handleDrop = (e: React.DragEvent, targetName: string) => {
        e.preventDefault();
        setDragOverName(null);
        const sourceName = e.dataTransfer.getData('text/plain');
        if (sourceName && sourceName !== targetName) {
            setAliases(prev => {
                const next = { ...prev };
                // Any existing alias pointing to sourceName should now point to targetName
                Object.keys(next).forEach(key => {
                    if (next[key] === sourceName) {
                        next[key] = targetName;
                    }
                });
                next[sourceName] = targetName;
                return next;
            });
            notifications.show(`Menggabungkan "${sourceName}" ke "${targetName}"`, { severity: 'success', autoHideDuration: 3000 });
        }
    };

    const groupedData = React.useMemo(() => {
        const text = activeTab === 'single' ? rawTextSingle : rawTextQuantity;
        if (!text.trim()) return [];

        const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
        const counts: Record<string, number> = {};

        if (activeTab === 'single') {
            lines.forEach(line => {
                const resolvedName = aliases[line] ?? line;
                counts[resolvedName] = (counts[resolvedName] || 0) + 1;
            });
        } else {
            lines.forEach(line => {
                const match = line.match(/^(.*?)\s+(\d+)$/);
                if (match) {
                    const parsedName = match[1].trim();
                    const count = parseInt(match[2], 10);
                    
                    // Skip if name is empty, or is just digits (like page numbers "2   3")
                    if (!parsedName || /^\d+$/.test(parsedName)) {
                        return;
                    }
                    
                    const resolvedName = aliases[parsedName] ?? parsedName;
                    counts[resolvedName] = (counts[resolvedName] || 0) + count;
                }
                // Skip lines that do not match the regex (no quantity at the end, e.g., section headers "CSSD")
            });
        }

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeTab, rawTextSingle, rawTextQuantity, aliases]);

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

    const currentText = activeTab === 'single' ? rawTextSingle : rawTextQuantity;
    const stats = React.useMemo(() => {
        return {
            original: currentText.split('\n').filter(l => l.trim() !== '').length,
            grouped: groupedData.length,
            bisa: sphItems.filter(i => i.status === 'bisa').length,
            kelistrikan: sphItems.filter(i => i.status === 'kelistrikan').length,
            tidak_bisa: sphItems.filter(i => i.status === 'tidak_bisa').length,
        };
    }, [currentText, groupedData, sphItems]);

    const displayedItems = React.useMemo(() => {
        if (!showDuplicatesOnly) return sphItems;

        // Find duplicate names
        const names = sphItems.map(item => item.name);
        const dupes = new Set<string>();
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const sim = getSimilarity(names[i], names[j]);
                if (sim >= 0.45) {
                    dupes.add(names[i]);
                    dupes.add(names[j]);
                }
            }
        }
        return sphItems.filter(item => dupes.has(item.name));
    }, [sphItems, showDuplicatesOnly]);

    const handleExportExcel = () => {
        if (sphItems.length === 0) {
            notifications.show('Harap isi daftar peralatan terlebih dahulu.', { severity: 'warning', autoHideDuration: 3000 });
            return;
        }

        const sanitizeForExcel = (val: string) => {
            if (/^[=+\-@]/.test(val)) {
                return "'" + val;
            }
            return val;
        };

        const tanggal = dayjs().format('DD MMMM YYYY');
        const rows = sphItems.map((item, idx) => ({
            'No': idx + 1,
            'Nama Alat': sanitizeForExcel(item.name),
            'Jumlah': item.count,
            'Satuan': 'Pcs',
            'Kondisi': STATUS_CONFIG[item.status].label,
            'Tanggal SPH': tanggal,
            'Penanggungjawab': sanitizeForExcel(picName),
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

        notifications.show(`Berhasil mengekspor ${sphItems.length} item ke Excel.`, { severity: 'success', autoHideDuration: 3000 });
    };

    const pageIcon = (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
        </div>
    );

    if (loadingMaster) {
        return (
            <PageContainer title="SPH — Survei Peralatan" icon={pageIcon}>
                <div className="flex items-center justify-center p-20">
                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            </PageContainer>
        );
    }

    return (
        <PageContainer title="SPH — Survei Peralatan" icon={pageIcon}>
            {/* Header/Description Area */}
            <div className="mb-8">
                <p className="text-gray-500 text-sm md:text-base">
                    Kelola dan rekapitulasi data survei peralatan dengan cepat. Paste daftar alat, tentukan status, dan ekspor ke Excel dalam hitungan detik.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Column: Input */}
                <div className={`xl:col-span-4 flex flex-col gap-6 ${isFullscreen ? 'hidden xl:hidden' : ''}`}>
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
                                    Pilih mode input dan paste daftar alat.
                                </p>
                            </div>

                            {currentText.trim() && (
                                <button
                                    onClick={() => {
                                        if (activeTab === 'single') setRawTextSingle('');
                                        else setRawTextQuantity('');
                                        setAliases({});
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Hapus Semua"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-gray-100 p-1 rounded-2xl mb-4 relative z-10 border border-gray-200/40">
                            <button
                                type="button"
                                onClick={() => setActiveTab('single')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                    activeTab === 'single'
                                        ? 'bg-white text-gray-900 shadow-sm font-bold'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Satu per Baris
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('quantity')}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                    activeTab === 'quantity'
                                        ? 'bg-white text-gray-900 shadow-sm font-bold'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Dengan Jumlah
                            </button>
                        </div>

                        <textarea
                            className="w-full flex-1 min-h-[400px] xl:min-h-[600px] p-5 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-mono leading-relaxed resize-none text-gray-700 placeholder-gray-400"
                            placeholder={
                                activeTab === 'single'
                                    ? "Contoh:\n\nSWD\nInfrared 3 Lampu\nUSG\nSWD\nInfusion pump"
                                    : "Contoh (Format: Nama [Tab/Spasi] Jumlah):\n\nAnasthesi Ventilator Machine\t4\nBed Side Monitor\t7\nTensimeter\t5"
                            }
                            value={activeTab === 'single' ? rawTextSingle : rawTextQuantity}
                            onChange={(e) => {
                                if (activeTab === 'single') setRawTextSingle(e.target.value);
                                else setRawTextQuantity(e.target.value);
                            }}
                        />
                    </div>
                </div>

                {/* Right Column: Preview & Action */}
                <div className={`${isFullscreen ? 'xl:col-span-12' : 'xl:col-span-8'} flex flex-col gap-6`}>
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
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <p className="text-sm text-gray-500">
                                                Klik status untuk mengubah kondisi. Geser (drag & drop) nama alat untuk menggabungkannya.
                                            </p>
                                            
                                            {/* Toggle filter duplicates */}
                                            <button
                                                type="button"
                                                onClick={() => setShowDuplicatesOnly(prev => !prev)}
                                                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-sm border ${
                                                    showDuplicatesOnly
                                                        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                                title="Tampilkan hanya alat-alat yang memiliki nama serupa (kemungkinan duplikat/typo)"
                                            >
                                                🔍 {showDuplicatesOnly ? 'Tampilkan Semua' : 'Cari Duplikat'}
                                            </button>

                                            {/* Toggle fullscreen */}
                                            <button
                                                type="button"
                                                onClick={() => setIsFullscreen(prev => !prev)}
                                                className={`text-xs font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-sm border ${
                                                    isFullscreen
                                                        ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-900'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                                title={isFullscreen ? 'Kembali ke tampilan normal' : 'Perbesar area preview menjadi layar penuh'}
                                            >
                                                🖥️ {isFullscreen ? 'Normal View' : 'Fullscreen'}
                                            </button>

                                            {Object.keys(aliases).length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsHistoryModalOpen(true)}
                                                        className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl transition-all shadow-sm border border-gray-200/50"
                                                    >
                                                        📋 Riwayat Penggabungan ({Object.keys(aliases).length})
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAliases({});
                                                            notifications.show('Penggabungan alat berhasil di-reset.', { severity: 'info', autoHideDuration: 3000 });
                                                        }}
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/85 px-2.5 py-1.5 rounded-xl transition-all shadow-sm border border-blue-100/50"
                                                    >
                                                        Reset
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
                                <div className={`overflow-y-auto ${isFullscreen ? 'max-h-[75vh] xl:max-h-[80vh] min-h-[500px]' : 'max-h-[500px] xl:max-h-[600px] xl:min-h-[400px]'}`}>
                                    {displayedItems.length === 0 ? (
                                        <div className="p-16 flex flex-col items-center justify-center text-center text-gray-500">
                                            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <p className="text-sm font-semibold text-gray-700">Tidak ada duplikat terdeteksi</p>
                                            <p className="text-xs text-gray-400 mt-1">Semua alat memiliki nama yang cukup unik.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-10">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-24">No</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Alat</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-28">Jumlah</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center w-40">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50/80">
                                                {displayedItems.map((item, idx) => {
                                                    const cfg = STATUS_CONFIG[item.status];
                                                    const isDragOver = dragOverName === item.name;
                                                    return (
                                                        <tr
                                                            key={item.name}
                                                            draggable={true}
                                                            onDragStart={(e) => handleDragStart(e, item.name)}
                                                            onDragOver={(e) => handleDragOver(e, item.name)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={(e) => handleDrop(e, item.name)}
                                                            onClick={() => cycleStatus(item.name)}
                                                            className={`cursor-grab active:cursor-grabbing hover:bg-gray-50/80 transition-all duration-200 group relative ${
                                                                isDragOver ? 'bg-blue-50/80 border-2 border-dashed border-blue-400' : ''
                                                            }`}
                                                            title="Tahan dan geser untuk menggabungkan dengan alat lain"
                                                        >
                                                            <td className="px-6 py-4 text-sm text-gray-400 font-mono transition-colors group-hover:text-gray-500">
                                                                <div className="flex items-center gap-3">
                                                                    <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 cursor-grab shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                                                        <path d="M8 9h2V7H8v2zm0 4h2v-2H8v2zm0 4h2v-2H8v2zm6-10v2h2V7h-2zm0 6h2v-2h-2v2zm0 4h2v-2h-2v2z"/>
                                                                    </svg>
                                                                    <span>{idx + 1}</span>
                                                                </div>
                                                            </td>
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
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Modal Riwayat Penggabungan */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div 
                        className="bg-white rounded-3xl shadow-2xl border border-gray-200/60 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    📋 Riwayat Penggabungan
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Daftar nama alat yang telah digabungkan.
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[150px] bg-gray-50/30">
                            {Object.keys(aliases).length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-sm">
                                    Tidak ada riwayat penggabungan.
                                </div>
                            ) : (
                                Object.entries(aliases).map(([source, target]) => (
                                    <div key={source} className="flex items-center justify-between bg-white border border-gray-150 rounded-2xl p-4 text-xs text-gray-700 shadow-sm hover:border-blue-200/60 hover:shadow-md transition-all duration-200">
                                        <div className="flex items-center gap-2 flex-wrap flex-1">
                                            <span className="font-semibold text-red-600 bg-red-50/80 px-2 py-1 rounded-lg line-through border border-red-100/50">{source}</span>
                                            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                            <span className="font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100/50">{target}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setAliases(prev => {
                                                    const next = { ...prev };
                                                    delete next[source];
                                                    if (Object.keys(next).length === 0) {
                                                        setIsHistoryModalOpen(false);
                                                    }
                                                    return next;
                                                });
                                                notifications.show(`Penggabungan "${source}" dibatalkan.`, { severity: 'info', autoHideDuration: 3000 });
                                            }}
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-xl transition-all ml-2"
                                            title="Batalkan penggabungan"
                                        >
                                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setAliases({});
                                    setIsHistoryModalOpen(false);
                                    notifications.show('Semua penggabungan berhasil di-reset.', { severity: 'info', autoHideDuration: 3000 });
                                }}
                                className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl transition-all"
                            >
                                Reset Semua
                            </button>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-gray-900/10"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
}
