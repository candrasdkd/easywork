import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import {
    extractPurchaseOrderItems,
    type PurchaseOrderItem,
} from '../lib/purchaseOrderPdf';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
});

const quantityFormatter = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
});

const cleanForExcel = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value);

const getItemTotal = (item: PurchaseOrderItem) => item.unitPrice * item.quantity;

export default function PurchaseOrderPdfPage() {
    const notifications = useNotifications();
    const [items, setItems] = React.useState<PurchaseOrderItem[]>([]);
    const [fileName, setFileName] = React.useState('');
    const [isExtracting, setIsExtracting] = React.useState(false);
    const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null);

    const summary = React.useMemo(() => ({
        quantity: items.reduce((total, item) => total + item.quantity, 0),
        value: items.reduce((total, item) => total + getItemTotal(item), 0),
    }), [items]);

    const updateItem = (id: string, changes: Partial<Pick<PurchaseOrderItem, 'name' | 'unitPrice' | 'quantity'>>) => {
        setItems((currentItems) => currentItems.map((item) => (
            item.id === id
                ? { ...item, ...changes, total: (changes.unitPrice ?? item.unitPrice) * (changes.quantity ?? item.quantity) }
                : item
        )));
    };

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            notifications.show('Pilih berkas dengan format PDF.', { severity: 'warning', autoHideDuration: 3500 });
            return;
        }

        setIsExtracting(true);
        setProgress(null);
        try {
            const result = await extractPurchaseOrderItems(file, (current, total) => setProgress({ current, total }));
            setItems(result.items);
            setFileName(file.name);

            if (result.items.length === 0) {
                notifications.show('Produk tidak ditemukan. Pastikan PDF adalah surat pesanan dengan teks yang dapat diseleksi.', { severity: 'warning', autoHideDuration: 5000 });
            } else {
                notifications.show(`${result.items.length} alat dari ${result.pageCount} halaman berhasil diekstrak.`, { severity: 'success', autoHideDuration: 4000 });
            }
        } catch (error) {
            console.error('PDF extraction failed:', error);
            notifications.show('PDF tidak dapat diproses. Coba gunakan PDF surat pesanan yang tidak terkunci.', { severity: 'error', autoHideDuration: 5000 });
        } finally {
            setIsExtracting(false);
            setProgress(null);
        }
    };

    const handleExport = () => {
        if (items.length === 0) {
            notifications.show('Belum ada hasil untuk diekspor.', { severity: 'warning', autoHideDuration: 3000 });
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(items.map((item, index) => ({
            No: index + 1,
            'Nama Alat': cleanForExcel(item.name),
            'Harga Produk': item.unitPrice,
            Jumlah: item.quantity,
            'Total Harga': getItemTotal(item),
        })));
        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 42 },
            { wch: 18 },
            { wch: 12 },
            { wch: 20 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pesanan PDF');
        XLSX.writeFile(workbook, `Hasil_Pesanan_${new Date().toISOString().slice(0, 10)}.xlsx`);
        notifications.show('Hasil ekstraksi berhasil diekspor ke Excel.', { severity: 'success', autoHideDuration: 3500 });
    };

    const pageIcon = (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5" />
            </svg>
        </div>
    );

    return (
        <PageContainer title="Ekstrak Pesanan PDF" icon={pageIcon}>
            <div className="mb-8 max-w-3xl">
                <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                    Unggah surat pesanan untuk mengambil nama alat, harga produk, dan jumlah secara otomatis. Frasa layanan seperti pengujian, kalibrasi, serta transport tidak dimasukkan ke nama alat maupun total produk.
                </p>
            </div>

            <section className="rounded-3xl border border-indigo-100 bg-white p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-base font-bold text-gray-900">1. Pilih surat pesanan</p>
                        <p className="mt-1 text-sm text-gray-500">PDF diproses langsung di perangkat Anda dan tidak disimpan oleh aplikasi.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
                        <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Pilih PDF Pesanan
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            onChange={(event) => {
                                void handleFile(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </label>
                </div>

                {isExtracting && (
                    <div className="mt-6 rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-800">
                        <div className="flex items-center gap-3 font-semibold">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                            Membaca isi PDF{progress ? ` - halaman ${progress.current}/${progress.total}` : ''}
                        </div>
                    </div>
                )}

                {fileName && !isExtracting && (
                    <div className="mt-6 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        <svg className="h-5 w-5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 18a4.6 4.6 0 01.88-9.12A5.5 5.5 0 0118.5 11.5h.5a3.5 3.5 0 010 7H7z" />
                        </svg>
                        <span className="truncate">{fileName}</span>
                    </div>
                )}
            </section>

            {items.length > 0 && (
                <>
                    <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Jumlah jenis alat</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{items.length}</p>
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Total jumlah alat</p>
                            <p className="mt-2 text-3xl font-bold text-blue-900">{quantityFormatter.format(summary.quantity)}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Total harga produk</p>
                            <p className="mt-2 text-2xl font-bold text-emerald-900">{currencyFormatter.format(summary.value)}</p>
                        </div>
                    </section>

                    <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">2. Periksa hasil ekstraksi</p>
                                <p className="mt-1 text-sm text-gray-500">Anda dapat mengoreksi nama, harga, atau jumlah sebelum mengekspor hasilnya.</p>
                            </div>
                            <Button variant="primary" onClick={handleExport} className="shrink-0 bg-gray-900 hover:bg-black">
                                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export Excel
                            </Button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[840px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="w-16 px-5 py-4 text-center">No</th>
                                        <th className="min-w-[280px] px-5 py-4">Nama Alat</th>
                                        <th className="w-44 px-5 py-4 text-right">Harga Produk</th>
                                        <th className="w-32 px-5 py-4 text-right">Jumlah</th>
                                        <th className="w-48 px-5 py-4 text-right">Total Harga</th>
                                        <th className="w-16 px-5 py-4"><span className="sr-only">Hapus</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((item, index) => (
                                        <tr key={item.id} className="bg-white hover:bg-gray-50/70">
                                            <td className="px-5 py-3 text-center font-mono text-gray-400">{index + 1}</td>
                                            <td className="px-5 py-3">
                                                <input
                                                    value={item.name}
                                                    aria-label={`Nama alat baris ${index + 1}`}
                                                    onChange={(event) => updateItem(item.id, { name: event.target.value })}
                                                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.unitPrice}
                                                    aria-label={`Harga produk ${item.name}`}
                                                    onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) || 0 })}
                                                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right font-medium text-gray-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.quantity}
                                                    aria-label={`Jumlah ${item.name}`}
                                                    onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 0 })}
                                                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right font-medium text-gray-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right font-bold text-emerald-700">{currencyFormatter.format(getItemTotal(item))}</td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    type="button"
                                                    aria-label={`Hapus ${item.name}`}
                                                    onClick={() => setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== item.id))}
                                                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12m-9 4v6m6-6v6m-7-10V4h8v3m-9 0 1 13h8l1-13" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                                    <tr>
                                        <td colSpan={3} className="px-5 py-4 text-right text-sm font-bold text-gray-700">Total</td>
                                        <td className="px-5 py-4 text-right font-bold text-gray-900">{quantityFormatter.format(summary.quantity)}</td>
                                        <td className="px-5 py-4 text-right text-base font-bold text-emerald-700">{currencyFormatter.format(summary.value)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </PageContainer>
    );
}
