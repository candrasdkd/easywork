import * as React from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { parseCertificateWorkbook, type CertificateRecord } from '../lib/certificatePrint';
import { createCombinedCertificatePdf } from '../lib/certificatePdf';

export default function CertificatePrintPage() {
    const notifications = useNotifications();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [workbook, setWorkbook] = React.useState<XLSX.WorkBook | null>(null);
    const [records, setRecords] = React.useState<CertificateRecord[]>([]);
    const [fileName, setFileName] = React.useState('');
    const [customPageTotals, setCustomPageTotals] = React.useState<Record<string, string>>({});
    const [typeKan, setTypeKan] = React.useState<Record<string, boolean>>({});
    const [search, setSearch] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
    const [pdfProgress, setPdfProgress] = React.useState({ completed: 0, total: 0 });
    const [error, setError] = React.useState('');

    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
    const visibleRecords = React.useMemo(() => {
        if (!normalizedSearch) return records;
        return records.filter((record) =>
            [record.number, record.fields.label, record.fields.equipment, record.fields.brand, record.fields.model, record.fields.serialNumber]
                .some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedSearch))
        );
    }, [normalizedSearch, records]);
    const customPageOverrides = React.useMemo(() => records.flatMap((record) => {
        const value = customPageTotals[record.id]?.trim() ?? '';
        if (!value) return [];
        if (!/^\d+$/.test(value)) return [{ record, value, pages: null as number | null }];
        const pages = Number(value);
        return [{ record, value, pages: pages >= 1 && pages <= 999 ? pages : null }];
    }), [customPageTotals, records]);
    const validCustomPageOverrides = customPageOverrides.filter((item) => item.pages !== null);
    const invalidCustomPageOverrideCount = customPageOverrides.length - validCustomPageOverrides.length;
    const typeKanRecords = records.filter((record) => typeKan[record.id]);
    const hasCopySettings = validCustomPageOverrides.length + typeKanRecords.length > 0;
    const pdfProgressPercent = pdfProgress.total > 0
        ? Math.round((pdfProgress.completed / pdfProgress.total) * 100)
        : 0;
    const pdfProgressMessage = pdfProgress.completed === 0
        ? 'Menyiapkan template dan data alat...'
        : pdfProgressPercent < 35
            ? 'Mengisi dan merender sertifikat satu per satu...'
            : pdfProgressPercent < 85
                ? 'Menyusun halaman sertifikat ke dalam PDF...'
                : pdfProgressPercent < 100
                    ? 'Merapikan halaman terakhir...'
                    : 'Mengemas PDF dan menyiapkan unduhan...';

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) {
            setError('Pilih workbook Excel berformat .xlsx.');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const uploadedWorkbook = XLSX.read(await file.arrayBuffer(), {
                type: 'array',
                cellDates: true,
                cellStyles: true,
                bookFiles: true,
            });
            const parsed = parseCertificateWorkbook(uploadedWorkbook);
            setWorkbook(uploadedWorkbook);
            setRecords(parsed.records);
            setFileName(file.name);
            setCustomPageTotals({});
            setTypeKan({});
            setSearch('');
            notifications.show(`Berhasil membaca ${parsed.records.length} data alat.`, {
                severity: 'success',
                autoHideDuration: 3500,
            });
        } catch (cause: unknown) {
            const message = cause instanceof Error ? cause.message : 'File Excel tidak dapat dibaca.';
            setWorkbook(null);
            setRecords([]);
            setFileName('');
            setCustomPageTotals({});
            setTypeKan({});
            setError(message);
        } finally {
            setIsLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleCreatePdf = async () => {
        if (invalidCustomPageOverrideCount > 0) {
            notifications.show('Periksa halaman khusus: isi angka bulat dari 1 sampai 999.', {
                severity: 'warning',
                autoHideDuration: 4500,
            });
            return;
        }
        if (!workbook) return;
        setIsGeneratingPdf(true);
        setPdfProgress({ completed: 0, total: records.length });
        setError('');
        try {
            const customTotals = Object.fromEntries(validCustomPageOverrides.map(({ record, pages }) => [record.id, pages as number]));
            const pdf = await createCombinedCertificatePdf(workbook, records, customTotals, (completed, total) => {
                setPdfProgress({ completed, total });
            });
            const baseName = fileName.replace(/\.xlsx$/i, '').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Sertifikat';
            saveAs(pdf, `${baseName} - Sertifikat Gabungan.pdf`);
            notifications.show(`PDF gabungan ${records.length} sertifikat berhasil dibuat.`, {
                severity: 'success',
                autoHideDuration: 5000,
            });
        } catch (cause: unknown) {
            const message = cause instanceof Error ? cause.message : 'PDF gabungan tidak dapat dibuat.';
            setError(message);
            notifications.show(message, { severity: 'error', autoHideDuration: 6500 });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleCopySettings = async () => {
        if (!hasCopySettings) {
            notifications.show('Pilih halaman custom atau tipe KAN pada minimal satu alat terlebih dahulu.', {
                severity: 'warning',
                autoHideDuration: 3500,
            });
            return;
        }

        const settings = {
            format: 'easywork-certificate-page-settings',
            version: 1,
            sourceFile: fileName,
            defaultPages: null,
            overrides: [
                ...validCustomPageOverrides.map(({ record, pages }) => ({
                    rekapRow: record.rekapRow,
                    label: record.fields.label,
                    equipment: record.fields.equipment,
                    pages,
                    isCustomePage: true,
                })),
                ...typeKanRecords.map((record) => ({
                    rekapRow: record.rekapRow,
                    label: record.fields.label,
                    equipment: record.fields.equipment,
                    isTypeKan: true,
                })),
            ],
        };
        const serialized = JSON.stringify(settings);
        const announceCopied = () => notifications.show(
            `Backup ${validCustomPageOverrides.length + typeKanRecords.length} alat disalin ke clipboard.`,
            { severity: 'success', autoHideDuration: 5000 }
        );

        try {
            await navigator.clipboard.writeText(serialized);
            announceCopied();
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = serialized;
            textArea.setAttribute('readonly', '');
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            const copied = document.execCommand('copy');
            textArea.remove();
            if (copied) announceCopied();
            else notifications.show('Backup tidak bisa disalin. Izinkan akses clipboard browser lalu coba lagi.', {
                severity: 'error',
                autoHideDuration: 5000,
            });
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
        <PageContainer title="PDF Sertifikat Gabungan" icon={pageIcon}>
            <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Unggah workbook Excel, lalu Easywork membuat satu PDF berisi sertifikat semua alat dengan tata letak dari sheet Sertifikat. Proses berjalan di browser; file tidak dikirim ke server.
            </p>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">1. Unggah file Excel</h2>
                        <p className="mt-1 text-sm text-slate-500">Pilih workbook .xlsx yang memiliki sheet REKAP dan Sertifikat. Bisa ganti file kapan saja.</p>
                    </div>
                    <div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="sr-only"
                            aria-label="Pilih workbook sertifikat"
                            onChange={(event) => void handleFile(event.target.files?.[0])}
                            disabled={isGeneratingPdf}
                        />
                        <Button type="button" loading={isLoading} disabled={isGeneratingPdf} onClick={() => inputRef.current?.click()}>
                            {fileName ? 'Ganti file Excel' : 'Pilih file Excel'}
                        </Button>
                    </div>
                </div>
                {fileName && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <span className="font-semibold">File:</span>
                        <span className="break-all">{fileName}</span>
                        <span className="ml-auto rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{records.length} alat</span>
                    </div>
                )}
                {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            </section>

            {records.length > 0 && (
                <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">2. Pengaturan sertifikat (opsional)</h2>
                            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">Atur total halaman khusus atau tandai tipe KAN untuk setiap alat. Satu alat hanya bisa memakai salah satu pilihan; alat lain mengikuti angka pada Excel. No. Label yang sama dibedakan berdasarkan Nama Alat dan baris REKAP.</p>
                        </div>
                        <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900">
                            {`${validCustomPageOverrides.length} halaman custom · ${typeKanRecords.length} tipe KAN`}
                        </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari No. Label / nama alat / no. seri"
                            disabled={isGeneratingPdf}
                            className="min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 sm:w-96"
                        />
                        <span className="text-sm text-slate-500">Menampilkan {visibleRecords.length} dari {records.length} alat</span>
                    </div>

                    <div className="mt-3 max-h-[min(68vh,760px)] overflow-auto rounded-2xl border border-slate-100">
                        {visibleRecords.map((record) => (
                            <div key={record.id} className="grid grid-cols-1 items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto_7rem] sm:gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{record.fields.label || 'Tanpa No. Label'} · {record.fields.equipment || 'Nama alat kosong'}</p>
                                    <p className="truncate text-xs text-slate-500">{record.fields.brand || '-'} {record.fields.model ? `· ${record.fields.model}` : ''} {record.fields.serialNumber ? `· SN ${record.fields.serialNumber}` : ''}</p>
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(customPageTotals[record.id]?.trim())}
                                        disabled={isGeneratingPdf}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setCustomPageTotals((current) => {
                                                const next = { ...current };
                                                if (checked) next[record.id] = '4';
                                                else delete next[record.id];
                                                return next;
                                            });
                                            if (checked) setTypeKan((current) => ({ ...current, [record.id]: false }));
                                        }}
                                        className="h-4 w-4 accent-teal-700"
                                        aria-label={`Atur halaman khusus untuk ${record.fields.label} ${record.fields.equipment}`}
                                    />
                                    <span>Halaman custom (4)</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(typeKan[record.id])}
                                        disabled={isGeneratingPdf}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setTypeKan((current) => ({ ...current, [record.id]: checked }));
                                            if (checked) setCustomPageTotals((current) => {
                                                const next = { ...current };
                                                delete next[record.id];
                                                return next;
                                            });
                                        }}
                                        className="h-4 w-4 accent-teal-700"
                                        aria-label={`Tandai tipe KAN untuk ${record.fields.label} ${record.fields.equipment}`}
                                    />
                                    <span>Tipe KAN</span>
                                </label>
                                <label className="sr-only" htmlFor={`custom-pages-${record.id}`}>Total halaman khusus untuk {record.fields.label} {record.fields.equipment}</label>
                                <input
                                    id={`custom-pages-${record.id}`}
                                    type="number"
                                    min={1}
                                    max={999}
                                    step={1}
                                    value={customPageTotals[record.id] ?? ''}
                                    onChange={(event) => setCustomPageTotals((current) => {
                                        const next = { ...current };
                                        const value = event.target.value;
                                        next[record.id] = value;
                                        return next;
                                    })}
                                    placeholder="Excel"
                                    disabled={!customPageTotals[record.id]?.trim() || isGeneratingPdf}
                                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                />
                            </div>
                        ))}
                        {visibleRecords.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Alat tidak ditemukan.</p>}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button type="button" loading={isGeneratingPdf} disabled={!workbook || isLoading || invalidCustomPageOverrideCount > 0} onClick={() => void handleCreatePdf()}>
                            {isGeneratingPdf ? `Membuat PDF ${pdfProgress.completed}/${pdfProgress.total}` : 'Buat PDF Gabungan'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!workbook || isLoading || !hasCopySettings || invalidCustomPageOverrideCount > 0}
                            onClick={() => void handleCopySettings()}
                            startIcon={(
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 8V5a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-3M6 8h7a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-9a2 2 0 012-2z" />
                                </svg>
                            )}
                        >
                            Salin backup pengaturan
                        </Button>
                        <span className="text-sm text-slate-500">
                            {invalidCustomPageOverrideCount > 0
                                ? `Perbaiki ${invalidCustomPageOverrideCount} isian (angka 1–999).`
                                : hasCopySettings
                                    ? `Backup menyalin pengaturan halaman custom dan tipe KAN untuk ${validCustomPageOverrides.length + typeKanRecords.length} alat.`
                                    : `Semua ${records.length} sertifikat masuk ke PDF. Pilih halaman custom atau tipe KAN untuk mengaktifkan backup.`}
                        </span>
                    </div>

                    {isGeneratingPdf && (
                        <div className="relative mt-5 overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6" role="region" aria-label="Progres pembuatan PDF">
                            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />
                            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-800/20">
                                    <svg className="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 3.75h7l5 5v11.5a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 016 20.25V5.25a1.5 1.5 0 011.5-1.5zM14 4v5h5M9 13h6m-6 4h6" />
                                    </svg>
                                    <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-ping rounded-full bg-amber-400" />
                                    <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900">Lagi merapikan tumpukan sertifikat</h3>
                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Sebentar lagi</span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600" aria-live="polite">{pdfProgressMessage}</p>
                                </div>
                                <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
                                    <span className="text-2xl font-black tabular-nums text-teal-800">{pdfProgressPercent}%</span>
                                    <span className="text-xs font-medium text-slate-500">selesai</span>
                                </div>
                            </div>

                            <div
                                className="relative mt-5 h-3 overflow-hidden rounded-full bg-teal-100"
                                role="progressbar"
                                aria-label="Progres pembuatan PDF"
                                aria-valuemin={0}
                                aria-valuemax={pdfProgress.total}
                                aria-valuenow={pdfProgress.completed}
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-500 transition-[width] duration-500 ease-out"
                                    style={{ width: `${pdfProgressPercent}%` }}
                                >
                                    <div className="h-full w-full animate-pulse rounded-full bg-white/20" />
                                </div>
                            </div>
                            <div className="relative mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
                                <span>{pdfProgress.completed} dari {pdfProgress.total} sertifikat dirapikan</span>
                                <span>{pdfProgress.completed === pdfProgress.total ? 'Sebentar lagi, unduhan siap.' : 'Workbook tetap di perangkat ini'}</span>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </PageContainer>
    );
}
