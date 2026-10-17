import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { parseCertificateWorkbook, type CertificateRecord } from '../lib/certificatePrint';
import { auth } from '../lib/firebase';
import './CertificatePrintPage.css';

type ApiStatus = 'checking' | 'ready' | 'offline';
const certificateApiBaseUrl = (import.meta.env.VITE_CERTIFICATE_API_URL || '').replace(/\/+$/, '');
const certificateApiUrl = (path: string) => `${certificateApiBaseUrl}${path}`;

export default function CertificatePrintPage() {
    const notifications = useNotifications();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [records, setRecords] = React.useState<CertificateRecord[]>([]);
    const [sourceFile, setSourceFile] = React.useState<File | null>(null);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [fileName, setFileName] = React.useState('');
    const [pageTotalInput, setPageTotalInput] = React.useState('1');
    const [search, setSearch] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [apiStatus, setApiStatus] = React.useState<ApiStatus>('checking');
    const [error, setError] = React.useState('');
    const [generatedPdfUrl, setGeneratedPdfUrl] = React.useState('');

    React.useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const checkAvailability = async () => {
            for (let attempt = 0; attempt < 60 && active; attempt += 1) {
                try {
                    const response = await fetch(certificateApiUrl('/api/health'), { signal: controller.signal });
                    if (response.ok) {
                        setApiStatus('ready');
                        return;
                    }
                } catch {
                    if (controller.signal.aborted) return;
                }
                await new Promise((resolve) => window.setTimeout(resolve, 2000));
            }
            if (active) setApiStatus('offline');
        };
        void checkAvailability();
        return () => controller.abort();
    }, []);

    React.useEffect(() => {
        if (!generatedPdfUrl) return undefined;
        return () => URL.revokeObjectURL(generatedPdfUrl);
    }, [generatedPdfUrl]);

    const selectedRecords = React.useMemo(
        () => records.filter((record) => selectedIds.has(record.id)),
        [records, selectedIds]
    );
    const parsedPageTotal = Number(pageTotalInput);
    const pageTotal = Number.isFinite(parsedPageTotal)
        ? Math.max(1, Math.min(999, Math.floor(parsedPageTotal)))
        : 1;
    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
    const visibleRecords = React.useMemo(() => {
        if (!normalizedSearch) return records;
        return records.filter((record) =>
            [record.number, record.fields.label, record.fields.equipment, record.fields.serialNumber]
                .some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedSearch))
        );
    }, [normalizedSearch, records]);
    const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedIds.has(record.id));

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) {
            setError('Pilih workbook Excel berformat .xlsx.');
            return;
        }

        setIsLoading(true);
        setError('');
        setGeneratedPdfUrl('');
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
            const parsed = parseCertificateWorkbook(workbook);
            setRecords(parsed.records);
            setSourceFile(file);
            setSelectedIds(new Set(parsed.records.map((record) => record.id)));
            setPageTotalInput(String(parsed.defaultPageTotal));
            setFileName(file.name);
            setSearch('');
            notifications.show(`Berhasil membaca ${parsed.records.length} data alat.`, {
                severity: 'success',
                autoHideDuration: 3500,
            });
        } catch (cause: unknown) {
            const message = cause instanceof Error ? cause.message : 'File Excel tidak dapat dibaca.';
            setRecords([]);
            setSourceFile(null);
            setSelectedIds(new Set());
            setFileName('');
            setPageTotalInput('1');
            setError(message);
        } finally {
            setIsLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const toggleVisibleRecords = () => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (allVisibleSelected) visibleRecords.forEach((record) => next.delete(record.id));
            else visibleRecords.forEach((record) => next.add(record.id));
            return next;
        });
    };

    const handleCreatePdf = async () => {
        if (!sourceFile || selectedRecords.length === 0) {
            notifications.show('Pilih minimal satu sertifikat untuk dibuat PDF.', {
                severity: 'warning',
                autoHideDuration: 3500,
            });
            return;
        }

        setIsGenerating(true);
        setError('');
        try {
            const form = new FormData();
            form.append('file', sourceFile);
            form.append('selectedNumbers', JSON.stringify(selectedRecords.map((record) => record.number)));
            form.append('totalPages', String(pageTotal));

            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');

            const response = await fetch(certificateApiUrl('/api/certificate-print'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}` },
                body: form,
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error || 'PDF gagal dibuat. Coba lagi beberapa saat.');
            }

            const pdfBlob = await response.blob();
            if (pdfBlob.size === 0 || (pdfBlob.type && !pdfBlob.type.includes('pdf'))) {
                throw new Error('Hasil dari renderer bukan file PDF yang valid.');
            }

            const nextUrl = URL.createObjectURL(pdfBlob);
            setGeneratedPdfUrl(nextUrl);
            const cleanName = fileName
                .replace(/\.xlsx?$/i, '')
                .replace(/[^\p{L}\p{N}_-]+/gu, '_')
                .replace(/^_+|_+$/g, '');
            const link = document.createElement('a');
            link.href = nextUrl;
            link.download = `Sertifikat_${cleanName || 'kalibrasi'}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setApiStatus('ready');
            notifications.show(`PDF ${selectedRecords.length} sertifikat berhasil dibuat dengan layout Excel.`, {
                severity: 'success',
                autoHideDuration: 4500,
            });
        } catch (cause: unknown) {
            const message = cause instanceof Error ? cause.message : 'PDF gagal dibuat.';
            setError(message);
            if (message.toLocaleLowerCase('id-ID').includes('fetch')) setApiStatus('offline');
            notifications.show(message, { severity: 'error', autoHideDuration: 6000 });
        } finally {
            setIsGenerating(false);
        }
    };

    const pageIcon = (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8V4h10v4M7 17H5a2 2 0 01-2-2v-5a2 2 0 012-2h14a2 2 0 012 2v5a2 2 0 01-2 2h-2M7 14h10v6H7z" />
            </svg>
        </div>
    );

    return (
        <PageContainer title="Cetak Sertifikat PDF" icon={pageIcon}>
            <div className="mb-6 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Unggah workbook yang memiliki sheet <strong>REKAP</strong> dan <strong>Sertifikat</strong>. PDF dirender oleh LibreOffice dari workbook asli agar layout cetaknya tetap sama dengan Excel.
            </div>

            {apiStatus === 'offline' && (
                <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    Layanan PDF Easywork belum tersambung. Coba muat ulang halaman beberapa saat lagi atau hubungi admin Easywork.
                </div>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">1. Unggah file Excel</h2>
                        <p className="mt-1 text-sm text-slate-500">Gunakan file .xlsx. File diproses sementara oleh layanan cetak Easywork dan dihapus setelah PDF selesai dibuat.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="sr-only"
                            aria-label="Pilih workbook sertifikat"
                            onChange={(event) => void handleFile(event.target.files?.[0])}
                        />
                        <Button type="button" loading={isLoading} onClick={() => inputRef.current?.click()}>
                            {fileName ? 'Ganti file Excel' : 'Pilih file Excel'}
                        </Button>
                    </div>
                </div>
                {fileName && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <span className="font-semibold">File:</span>
                        <span className="break-all">{fileName}</span>
                        <span className="ml-auto rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{records.length} data</span>
                    </div>
                )}
                {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            </section>

            {records.length > 0 && (
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
                    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">2. Pilih sertifikat</h2>
                                <p className="mt-1 text-sm text-slate-500">Centang alat yang ingin masuk ke PDF.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                                {selectedRecords.length} / {records.length} dipilih
                            </span>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                                <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleRecords} className="h-4 w-4 accent-teal-700" />
                                Pilih semua yang tampil
                            </label>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Cari No. Label / nama alat"
                                className="min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 sm:w-64"
                            />
                        </div>
                        <div className="mt-3 max-h-[380px] overflow-auto rounded-2xl border border-slate-100">
                            {visibleRecords.map((record) => (
                                <label key={record.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(record.id)}
                                        onChange={() => setSelectedIds((current) => {
                                            const next = new Set(current);
                                            if (next.has(record.id)) next.delete(record.id);
                                            else next.add(record.id);
                                            return next;
                                        })}
                                        className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-slate-800">{record.fields.label || 'Tanpa No. Label'} · {record.fields.equipment || 'Nama alat kosong'}</span>
                                        <span className="mt-0.5 block truncate text-xs text-slate-500">{record.fields.brand || '-'} {record.fields.model ? `· ${record.fields.model}` : ''} {record.fields.serialNumber ? `· SN ${record.fields.serialNumber}` : ''}</span>
                                    </span>
                                </label>
                            ))}
                            {visibleRecords.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Data yang cocok tidak ditemukan.</p>}
                        </div>
                    </section>

                    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">3. Atur total halaman</h2>
                        <p className="mt-1 text-sm leading-5 text-slate-500">Angka ini mengisi bagian “dari … halaman” pada sertifikat. Jumlah lembar PDF tetap mengikuti data yang dipilih.</p>
                        <label className="mt-4 block max-w-xs text-sm font-semibold text-slate-700" htmlFor="certificate-page-total">Total halaman sertifikat</label>
                        <div className="mt-1.5 flex max-w-xs items-center gap-3">
                            <input
                                id="certificate-page-total"
                                type="number"
                                min={1}
                                max={999}
                                step={1}
                                value={pageTotalInput}
                                onChange={(event) => setPageTotalInput(event.target.value)}
                                onBlur={() => setPageTotalInput(String(pageTotal))}
                                className="w-28 rounded-xl border border-slate-200 px-3.5 py-2.5 text-lg font-bold text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                            />
                            <span className="text-sm text-slate-500">halaman</span>
                        </div>
                        <div className="mt-5 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                            PDF akan berisi <strong>{selectedRecords.length}</strong> sertifikat, satu lembar untuk setiap data yang dipilih.
                        </div>
                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Button type="button" loading={isGenerating} disabled={selectedRecords.length === 0 || apiStatus === 'offline'} onClick={() => void handleCreatePdf()}>
                                Buat dan unduh PDF
                            </Button>
                        </div>
                        {isGenerating && (
                            <div className="certificate-render-status mt-5" role="status" aria-live="polite">
                                <div className="certificate-render-spinner" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-800">Merender sheet Sertifikat dari Excel</p>
                                    <p className="mt-0.5 text-xs text-slate-500">LibreOffice sedang menyiapkan {selectedRecords.length} halaman PDF.</p>
                                    <div className="certificate-progress-track mt-3"><span /></div>
                                </div>
                            </div>
                        )}
                        {!isGenerating && apiStatus === 'checking' && <p className="mt-3 text-xs text-slate-500">Menghubungkan layanan PDF Easywork…</p>}
                    </section>
                </div>
            )}

            {generatedPdfUrl && (
                <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Pratinjau PDF hasil Excel</h2>
                            <p className="mt-1 text-sm text-slate-500">PDF sudah dibuat dan diunduh. Di sini lu bisa cek layout hasil render.</p>
                        </div>
                        <a
                            href={generatedPdfUrl}
                            download={`Sertifikat_${fileName.replace(/\.xlsx?$/i, '').replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'kalibrasi'}.pdf`}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Unduh lagi
                        </a>
                    </div>
                    <iframe className="certificate-pdf-preview" src={generatedPdfUrl} title="Pratinjau PDF sertifikat" />
                </section>
            )}
        </PageContainer>
    );
}
