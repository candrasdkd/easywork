import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/id";
import copy from "copy-to-clipboard";
import type { CalibrationItem } from "../pages/DashboardPage";
import { Card, CardContent, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";

interface DashboardProps {
    items: CalibrationItem[];
    loading: boolean;
    selectedMonth: Dayjs;
    onMonthChange: (m: Dayjs) => void;
    error?: Error | null;
    onRefresh?: () => void;
}

const uniqueSorted = (arr: string[]) =>
    Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "id")
    );

export default function Dashboard({
    loading,
    items,
    selectedMonth,
    onMonthChange,
    error,
    onRefresh,
}: DashboardProps) {
    // === Filter Ruangan (client-side) ===
    const allRooms = React.useMemo(
        () => uniqueSorted(items.map((i) => i.room_name || "")),
        [items]
    );
    const [room, setRoom] = React.useState<string>("");

    const filtered = React.useMemo(() => {
        if (!room) return items;
        return items.filter((it) => (it.room_name || "") === room);
    }, [items, room]);

    const totalItems = filtered.length;
    const totalRooms = React.useMemo(
        () => uniqueSorted(filtered.map((i) => i.room_name || "")).length,
        [filtered]
    );

    const generateSummaryText = () => {
        const bulanStr = selectedMonth.format("MMMM YYYY");
        let txt = `🧪 *LAPORAN KALIBRASI PERALATAN*\n\n`;
        txt += `🗓 Periode: *${bulanStr}*\n`;
        if (room) txt += `🏢 Ruangan: *${room}*\n`;
        txt += `\n📌 *DATA UTAMA*\n`;
        txt += `▫️ Total Inputan: *${totalItems}*\n`;
        txt += `▫️ Total Ruangan: *${totalRooms}*\n`;
        return txt;
    };

    const handleCopy = () => {
        copy(generateSummaryText());
        alert("Ringkasan berhasil disalin ke clipboard!");
    };

    const handleShareWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(generateSummaryText())}`;
        window.open(url, "_blank");
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard Kalibrasi
            </h1>

            {/* Filter Section */}
            <Card className="p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Filter Bulan
                        </label>
                        <input
                            type="month"
                            value={selectedMonth.format("YYYY-MM")}
                            onChange={(e) => onMonthChange(dayjs(e.target.value))}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white outline-none transition-all"
                        />
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Ruangan
                        </label>
                        <select
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white outline-none transition-all"
                        >
                            <option value="">Semua Ruangan</option>
                            {allRooms.map((r) => (
                                <option key={r} value={r}>
                                    {r || "Tidak Diketahui"}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        className="p-2.5"
                        title="Refresh Data"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </Button>
                </div>
            </Card>

            {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error.message || "Terjadi kesalahan saat memuat data."}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Total Inputan */}
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-none">
                        <CardHeader className="border-white/10 flex flex-row items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-lg">Total Inputan</h3>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center pt-2 pb-8">
                            <span className="text-6xl font-black drop-shadow-lg">{totalItems}</span>
                            <span className="text-blue-100 text-sm mt-2">Peralatan Terdaftar</span>
                        </CardContent>
                    </Card>

                    {/* Total Ruangan */}
                    <Card className="bg-gradient-to-br from-purple-500 to-purple-700 text-white border-none">
                        <CardHeader className="border-white/10 flex flex-row items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-lg">Total Ruangan</h3>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center pt-2 pb-8">
                            <span className="text-6xl font-black drop-shadow-lg">{totalRooms}</span>
                            <span className="text-purple-100 text-sm mt-2">Area Pemantauan</span>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Floating Action Buttons */}
            <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-30">
                <button
                    onClick={handleCopy}
                    className="p-4 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all border border-gray-100 dark:border-slate-700"
                    title="Salin Ringkasan"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                </button>
                <button
                    onClick={handleShareWhatsApp}
                    className="p-4 bg-emerald-500 text-white rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all"
                    title="Bagikan ke WhatsApp"
                >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-4.821 4.754a9.624 9.624 0 0 1-4.947-1.357l-.355-.213-3.675.964.981-3.585-.233-.371a9.601 9.601 0 0 1-1.474-5.121c0-5.308 4.316-9.624 9.626-9.624 2.571 0 4.988 1 6.805 2.818a9.553 9.553 0 0 1 2.817 6.808c0 5.309-4.316 9.625-9.627 9.625M20.52 3.449C18.295 1.222 15.342 0 12.227 0H12.23C5.553 0 .115 5.438.112 12.116c0 2.134.545 4.218 1.583 6.095L0 24l5.968-1.566a12.127 12.127 0 0 0 6.255 1.74h.005c6.675 0 12.115-5.438 12.118-12.114a12.103 12.103 0 0 0-3.82-8.611" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
