import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import {
    extractPurchaseOrderItems,
    PasswordProtectedError,
    type PurchaseOrderItem,
    type PurchaseOrderExtraction,
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

export default function PurchaseOrderPdfPage() {
    const notifications = useNotifications();
    const [products, setProducts] = React.useState<PurchaseOrderItem[]>([]);
    const [services, setServices] = React.useState<PurchaseOrderItem[]>([]);
    const [pdfMeta, setPdfMeta] = React.useState<{
        orderNumber?: string;
        orderDate?: string;
        pdfTotalTransaction?: number;
        pdfTotalPpn?: number;
        pdfTotalPayment?: number;
    }>({});
    const [fileName, setFileName] = React.useState('');
    const [isExtracting, setIsExtracting] = React.useState(false);
    const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(null);
    const [activeTab, setActiveTab] = React.useState<'products' | 'services' | 'all'>('products');

    // Password modal state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
    const [passwordInput, setPasswordInput] = React.useState('');
    const [pendingFile, setPendingFile] = React.useState<File | null>(null);

    // Drag-and-drop state
    const [isDragging, setIsDragging] = React.useState(false);

    // Calculated summary based on current table state
    const summary = React.useMemo(() => {
        const prodQty = products.reduce((sum, item) => sum + item.quantity, 0);
        const prodVal = products.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const servQty = services.reduce((sum, item) => sum + item.quantity, 0);
        const servVal = services.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const totalTrans = prodVal + servVal;

        return {
            productCount: products.length,
            productQty: prodQty,
            productValue: prodVal,
            serviceCount: services.length,
            serviceQty: servQty,
            serviceValue: servVal,
            totalTransaction: totalTrans,
        };
    }, [products, services]);

    const updateProduct = (id: string, changes: Partial<Pick<PurchaseOrderItem, 'name' | 'unitPrice' | 'quantity'>>) => {
        setProducts((current) =>
            current.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          ...changes,
                          total: (changes.unitPrice ?? item.unitPrice) * (changes.quantity ?? item.quantity),
                      }
                    : item
            )
        );
    };

    const updateService = (id: string, changes: Partial<Pick<PurchaseOrderItem, 'name' | 'unitPrice' | 'quantity'>>) => {
        setServices((current) =>
            current.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          ...changes,
                          total: (changes.unitPrice ?? item.unitPrice) * (changes.quantity ?? item.quantity),
                      }
                    : item
            )
        );
    };

    const deleteProduct = (id: string) => {
        setProducts((current) => current.filter((item) => item.id !== id));
    };

    const deleteService = (id: string) => {
        setServices((current) => current.filter((item) => item.id !== id));
    };

    const processPdfFile = async (file: File, password?: string) => {
        setIsExtracting(true);
        setProgress(null);
        try {
            const result: PurchaseOrderExtraction = await extractPurchaseOrderItems(
                file,
                (current, total) => setProgress({ current, total }),
                password
            );

            setProducts(result.items);
            setServices(result.services);
            setPdfMeta({
                orderNumber: result.orderNumber,
                orderDate: result.orderDate,
                pdfTotalTransaction: result.summary.pdfTotalTransaction,
                pdfTotalPpn: result.summary.pdfTotalPpn,
                pdfTotalPayment: result.summary.pdfTotalPayment,
            });
            setFileName(file.name);
            setIsPasswordModalOpen(false);
            setPendingFile(null);
            setPasswordInput('');

            if (result.items.length === 0 && result.services.length === 0) {
                notifications.show(
                    'Item pesanan tidak ditemukan. Pastikan PDF adalah surat pesanan dengan teks digital yang dapat diseleksi (bukan hasil scan/foto).',
                    { severity: 'warning', autoHideDuration: 6000 }
                );
            } else {
                notifications.show(
                    `Berhasil mengekstrak ${result.items.length} alat (${result.summary.totalProductQty} unit) dan ${result.services.length} layanan tambahan dari ${result.pageCount} halaman.`,
                    { severity: 'success', autoHideDuration: 5000 }
                );
            }
        } catch (error: unknown) {
            console.error('PDF extraction failed:', error);
            if (error instanceof PasswordProtectedError) {
                setPendingFile(file);
                setIsPasswordModalOpen(true);
                notifications.show('PDF ini dilindungi kata sandi. Silakan masukkan kata sandi untuk membukanya.', {
                    severity: 'info',
                    autoHideDuration: 4000,
                });
            } else {
                notifications.show(
                    'PDF tidak dapat diproses. Pastikan berkas tidak rusak dan merupakan format PDF yang valid.',
                    { severity: 'error', autoHideDuration: 5000 }
                );
            }
        } finally {
            setIsExtracting(false);
            setProgress(null);
        }
    };

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            notifications.show('Pilih berkas dengan format PDF.', { severity: 'warning', autoHideDuration: 3500 });
            return;
        }
        await processPdfFile(file);
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pendingFile) return;
        await processPdfFile(pendingFile, passwordInput);
    };

    const handleExport = () => {
        if (products.length === 0 && services.length === 0) {
            notifications.show('Belum ada data untuk diekspor.', { severity: 'warning', autoHideDuration: 3000 });
            return;
        }

        const workbook = XLSX.utils.book_new();

        // 1. Sheet Daftar Alat
        if (products.length > 0) {
            const productRows = products.map((item, index) => ({
                No: index + 1,
                'Nama Alat': cleanForExcel(item.name),
                'Harga Satuan': item.unitPrice,
                Jumlah: item.quantity,
                'Total Harga': item.unitPrice * item.quantity,
                'Halaman PDF': item.page,
            }));
            const productSheet = XLSX.utils.json_to_sheet(productRows);
            productSheet['!cols'] = [
                { wch: 6 },
                { wch: 45 },
                { wch: 18 },
                { wch: 12 },
                { wch: 20 },
                { wch: 14 },
            ];
            XLSX.utils.book_append_sheet(workbook, productSheet, 'Daftar Alat');
        }

        // 2. Sheet Layanan Tambahan (Transport/Akomodasi)
        if (services.length > 0) {
            const serviceRows = services.map((item, index) => ({
                No: index + 1,
                'Rincian Layanan': cleanForExcel(item.name),
                'Harga Satuan': item.unitPrice,
                Jumlah: item.quantity,
                'Total Harga': item.unitPrice * item.quantity,
                'Halaman PDF': item.page,
            }));
            const serviceSheet = XLSX.utils.json_to_sheet(serviceRows);
            serviceSheet['!cols'] = [
                { wch: 6 },
                { wch: 45 },
                { wch: 18 },
                { wch: 12 },
                { wch: 20 },
                { wch: 14 },
            ];
            XLSX.utils.book_append_sheet(workbook, serviceSheet, 'Layanan Tambahan');
        }

        // 3. Sheet Ringkasan
        const summaryRows = [
            { 'Kategori Ringkasan': 'Nomor Surat Pesanan', Nilai: pdfMeta.orderNumber || '-' },
            { 'Kategori Ringkasan': 'Tanggal Surat Pesanan', Nilai: pdfMeta.orderDate || '-' },
            { 'Kategori Ringkasan': 'Jumlah Jenis Alat', Nilai: summary.productCount },
            { 'Kategori Ringkasan': 'Total Kuantitas Alat', Nilai: summary.productQty },
            { 'Kategori Ringkasan': 'Total Nilai Produk (Alat Saja)', Nilai: summary.productValue },
            { 'Kategori Ringkasan': 'Jumlah Layanan Tambahan', Nilai: summary.serviceCount },
            { 'Kategori Ringkasan': 'Total Nilai Layanan Tambahan', Nilai: summary.serviceValue },
            { 'Kategori Ringkasan': 'Total Transaksi (Produk + Layanan)', Nilai: summary.totalTransaction },
            ...(pdfMeta.pdfTotalPpn
                ? [{ 'Kategori Ringkasan': 'Estimasi Total PPN (PDF)', Nilai: pdfMeta.pdfTotalPpn }]
                : []),
            ...(pdfMeta.pdfTotalPayment
                ? [{ 'Kategori Ringkasan': 'Estimasi Total Pembayaran (PDF)', Nilai: pdfMeta.pdfTotalPayment }]
                : []),
        ];
        const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
        summarySheet['!cols'] = [{ wch: 38 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan Pesanan');

        const cleanOrderName = pdfMeta.orderNumber ? `_${pdfMeta.orderNumber.replace(/[^A-Za-z0-9_-]/g, '')}` : '';
        XLSX.writeFile(workbook, `Hasil_Pesanan${cleanOrderName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        notifications.show('Hasil ekstraksi berhasil diekspor ke Excel.', { severity: 'success', autoHideDuration: 3500 });
    };

    const displayedItems = React.useMemo(() => {
        if (activeTab === 'products') return products.map((item) => ({ ...item, type: 'product' as const }));
        if (activeTab === 'services') return services.map((item) => ({ ...item, type: 'service' as const }));
        return [
            ...products.map((item) => ({ ...item, type: 'product' as const })),
            ...services.map((item) => ({ ...item, type: 'service' as const })),
        ];
    }, [activeTab, products, services]);

    const pageIcon = (
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5"
                />
            </svg>
        </div>
    );

    return (
        <PageContainer title="Ekstrak Pesanan PDF" icon={pageIcon}>
            <div className="mb-8 max-w-3xl">
                <p className="text-gray-500 text-sm md:text-base leading-relaxed">
                    Unggah surat pesanan (e-Katalog LKPP / SIPLah / SPK) untuk mengekstrak nama alat, harga satuan,
                    jumlah, serta rincian layanan tambahan (transport/akomodasi) secara otomatis dan terpisah dengan
                    akurat.
                </p>
            </div>

            {/* Upload Box */}
            <section
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) void handleFile(droppedFile);
                }}
                className={`rounded-3xl border-2 transition-all duration-200 bg-white p-6 sm:p-8 shadow-sm ${
                    isDragging ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10' : 'border-indigo-100'
                }`}
            >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-base font-bold text-gray-900">1. Pilih atau Tarik Berkas Surat Pesanan</p>
                        <p className="mt-1 text-sm text-gray-500">
                            PDF diproses langsung di browser Anda secara aman tanpa dikirim ke server luar.
                        </p>
                        {pdfMeta.orderNumber && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-md bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                                    No. SP: #{pdfMeta.orderNumber}
                                </span>
                                {pdfMeta.orderDate && (
                                    <span className="rounded-md bg-gray-100 px-2.5 py-1 font-medium text-gray-600">
                                        Tanggal: {pdfMeta.orderDate}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 active:scale-[0.98]">
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
                            Membaca dan membedah isi PDF
                            {progress ? ` - Halaman ${progress.current} dari ${progress.total}` : '...'}
                        </div>
                    </div>
                )}

                {fileName && !isExtracting && (
                    <div className="mt-6 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 border border-gray-100">
                        <div className="flex items-center gap-3 truncate">
                            <svg className="h-5 w-5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 18a4.6 4.6 0 01.88-9.12A5.5 5.5 0 0118.5 11.5h.5a3.5 3.5 0 010 7H7z"
                                />
                            </svg>
                            <span className="font-medium truncate">{fileName}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setProducts([]);
                                setServices([]);
                                setPdfMeta({});
                                setFileName('');
                            }}
                            className="text-xs font-semibold text-gray-400 hover:text-red-600 transition ml-4"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </section>

            {/* Password Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-amber-600 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">PDF Dilindungi Password</h3>
                                <p className="text-xs text-gray-500">Masukkan kata sandi untuk membuka dokumen</p>
                            </div>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                                    Kata Sandi PDF
                                </label>
                                <input
                                    type="password"
                                    autoFocus
                                    placeholder="Ketik password PDF di sini..."
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPasswordModalOpen(false);
                                        setPendingFile(null);
                                        setPasswordInput('');
                                    }}
                                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                                >
                                    Buka Kunci & Ekstrak
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Results Section */}
            {(products.length > 0 || services.length > 0) && (
                <>
                    {/* Summary Cards */}
                    <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Jumlah Jenis Alat</p>
                            <p className="mt-2 text-3xl font-bold text-gray-900">{summary.productCount}</p>
                            <p className="mt-1 text-xs text-gray-500">Total Kuantitas: <span className="font-semibold text-gray-800">{quantityFormatter.format(summary.productQty)}</span> unit</p>
                        </div>

                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Total Harga Produk</p>
                            <p className="mt-2 text-2xl font-bold text-emerald-950">{currencyFormatter.format(summary.productValue)}</p>
                            <p className="mt-1 text-xs text-emerald-700">Khusus alat kesehatan (tanpa transport)</p>
                        </div>

                        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Layanan Tambahan</p>
                            <p className="mt-2 text-2xl font-bold text-amber-950">{currencyFormatter.format(summary.serviceValue)}</p>
                            <p className="mt-1 text-xs text-amber-700">{summary.serviceCount} rincian transport / akomodasi</p>
                        </div>

                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 shadow-sm">
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Total Transaksi (Katalog)</p>
                            <p className="mt-2 text-2xl font-bold text-indigo-950">{currencyFormatter.format(summary.totalTransaction)}</p>
                            <p className="mt-1 text-xs text-indigo-700">
                                {pdfMeta.pdfTotalPayment ? `Estimasi + PPN: ${currencyFormatter.format(pdfMeta.pdfTotalPayment)}` : 'Produk + Layanan Tambahan'}
                            </p>
                        </div>
                    </section>

                    {/* Table View with Tabs */}
                    <section className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-bold text-gray-900">2. Periksa & Koreksi Hasil Ekstraksi</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    Nama, harga satuan, dan jumlah dapat diedit langsung. Total harga diperbarui otomatis secara instan.
                                </p>
                            </div>
                            <Button variant="primary" onClick={handleExport} className="shrink-0 bg-gray-900 hover:bg-black shadow-md">
                                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Export Excel (Lengkap)
                            </Button>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-6 py-3">
                            <button
                                type="button"
                                onClick={() => setActiveTab('products')}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                    activeTab === 'products'
                                        ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-gray-200'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Daftar Alat ({products.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('services')}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                    activeTab === 'services'
                                        ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-gray-200'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Layanan Tambahan / Transport ({services.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('all')}
                                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                                    activeTab === 'all'
                                        ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-gray-200'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                Semua Item ({products.length + services.length})
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] text-left text-sm">
                                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="w-16 px-5 py-4 text-center">No</th>
                                        <th className="min-w-[280px] px-5 py-4">Nama Alat / Layanan</th>
                                        <th className="w-32 px-5 py-4 text-center">Kategori</th>
                                        <th className="w-44 px-5 py-4 text-right">Harga Satuan</th>
                                        <th className="w-28 px-5 py-4 text-right">Jumlah</th>
                                        <th className="w-48 px-5 py-4 text-right">Total Harga</th>
                                        <th className="w-16 px-5 py-4">
                                            <span className="sr-only">Hapus</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayedItems.map((item, index) => (
                                        <tr key={item.id} className="bg-white hover:bg-gray-50/70 transition-colors">
                                            <td className="px-5 py-3 text-center font-mono text-xs text-gray-400">{index + 1}</td>
                                            <td className="px-5 py-3">
                                                <input
                                                    value={item.name}
                                                    aria-label={`Nama item baris ${index + 1}`}
                                                    onChange={(event) => {
                                                        if (item.type === 'product') {
                                                            updateProduct(item.id, { name: event.target.value });
                                                        } else {
                                                            updateService(item.id, { name: event.target.value });
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                {item.type === 'product' ? (
                                                    <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                                        Produk / Alat
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                                        Layanan / Transport
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.unitPrice}
                                                    aria-label={`Harga satuan ${item.name}`}
                                                    onChange={(event) => {
                                                        const val = Number(event.target.value) || 0;
                                                        if (item.type === 'product') {
                                                            updateProduct(item.id, { unitPrice: val });
                                                        } else {
                                                            updateService(item.id, { unitPrice: val });
                                                        }
                                                    }}
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
                                                    onChange={(event) => {
                                                        const val = Number(event.target.value) || 0;
                                                        if (item.type === 'product') {
                                                            updateProduct(item.id, { quantity: val });
                                                        } else {
                                                            updateService(item.id, { quantity: val });
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right font-medium text-gray-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-right font-bold text-emerald-700">
                                                {currencyFormatter.format(item.unitPrice * item.quantity)}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    type="button"
                                                    aria-label={`Hapus ${item.name}`}
                                                    onClick={() => {
                                                        if (item.type === 'product') {
                                                            deleteProduct(item.id);
                                                        } else {
                                                            deleteService(item.id);
                                                        }
                                                    }}
                                                    className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M6 7h12m-9 4v6m6-6v6m-7-10V4h8v3m-9 0 1 13h8l1-13"
                                                        />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200 bg-gray-50/90 font-bold">
                                    {activeTab === 'products' && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-4 text-right text-sm text-gray-700">
                                                Total Produk (Alat Saja):
                                            </td>
                                            <td className="px-5 py-4 text-right text-gray-900">
                                                {quantityFormatter.format(summary.productQty)}
                                            </td>
                                            <td className="px-5 py-4 text-right text-base text-emerald-700">
                                                {currencyFormatter.format(summary.productValue)}
                                            </td>
                                            <td />
                                        </tr>
                                    )}
                                    {activeTab === 'services' && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-4 text-right text-sm text-gray-700">
                                                Total Layanan Tambahan (Transport/Akomodasi):
                                            </td>
                                            <td className="px-5 py-4 text-right text-gray-900">
                                                {quantityFormatter.format(summary.serviceQty)}
                                            </td>
                                            <td className="px-5 py-4 text-right text-base text-amber-700">
                                                {currencyFormatter.format(summary.serviceValue)}
                                            </td>
                                            <td />
                                        </tr>
                                    )}
                                    {activeTab === 'all' && (
                                        <>
                                            <tr className="border-b border-gray-200">
                                                <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-gray-600">
                                                    Subtotal Produk:
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-xs text-gray-700">
                                                    {quantityFormatter.format(summary.productQty)}
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-sm text-emerald-700">
                                                    {currencyFormatter.format(summary.productValue)}
                                                </td>
                                                <td />
                                            </tr>
                                            <tr className="border-b border-gray-200">
                                                <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-gray-600">
                                                    Subtotal Layanan Tambahan (Transport):
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-xs text-gray-700">
                                                    {quantityFormatter.format(summary.serviceQty)}
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-sm text-amber-700">
                                                    {currencyFormatter.format(summary.serviceValue)}
                                                </td>
                                                <td />
                                            </tr>
                                            <tr>
                                                <td colSpan={4} className="px-5 py-4 text-right text-sm text-gray-900">
                                                    Total Transaksi Keseluruhan:
                                                </td>
                                                <td className="px-5 py-4 text-right text-gray-900">
                                                    {quantityFormatter.format(summary.productQty + summary.serviceQty)}
                                                </td>
                                                <td className="px-5 py-4 text-right text-lg text-indigo-900">
                                                    {currencyFormatter.format(summary.totalTransaction)}
                                                </td>
                                                <td />
                                            </tr>
                                        </>
                                    )}
                                </tfoot>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </PageContainer>
    );
}
