import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import useNotifications from '../hooks/useNotifications/useNotifications';
import { parseCertificateWorkbook, type CertificateRecord } from '../lib/certificatePrint';

export default function CertificatePrintPage() {
    const notifications = useNotifications();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [records, setRecords] = React.useState<CertificateRecord[]>([]);
    const [fileName, setFileName] = React.useState('');
    const [customPageTotals, setCustomPageTotals] = React.useState<Record<string, string>>({});
    const [search, setSearch] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
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
    const hasPageSettings = validCustomPageOverrides.length > 0;

    const handleFile = async (file?: File) => {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) {
            setError('Pilih workbook Excel berformat .xlsx.');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
            const parsed = parseCertificateWorkbook(workbook);
            setRecords(parsed.records);
            setFileName(file.name);
            setCustomPageTotals({});
            setSearch('');
            notifications.show(`Berhasil membaca ${parsed.records.length} data alat.`, {
                severity: 'success',
                autoHideDuration: 3500,
            });
        } catch (cause: unknown) {
            const message = cause instanceof Error ? cause.message : 'File Excel tidak dapat dibaca.';
            setRecords([]);
            setFileName('');
            setCustomPageTotals({});
            setError(message);
        } finally {
            setIsLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleCopyPageSettings = async () => {
        if (invalidCustomPageOverrideCount > 0) {
            notifications.show('Periksa halaman khusus: isi angka bulat dari 1 sampai 999.', {
                severity: 'warning',
                autoHideDuration: 4500,
            });
            return;
        }
        if (!hasPageSettings) {
            notifications.show('Isi halaman khusus pada minimal satu alat terlebih dahulu.', {
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
            overrides: validCustomPageOverrides.map(({ record, pages }) => ({
                rekapRow: record.rekapRow,
                label: record.fields.label,
                equipment: record.fields.equipment,
                pages,
            })),
        };
        const serialized = JSON.stringify(settings);
        const announceCopied = () => notifications.show(
            `Pengaturan ${validCustomPageOverrides.length} alat disalin. Jalankan printer lokal dan pilih workbook yang sama.`,
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
            else notifications.show('Pengaturan tidak bisa disalin. Izinkan akses clipboard browser lalu coba lagi.', {
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
        <PageContainer title="Atur Halaman Cetak Sertifikat" icon={pageIcon}>
            <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Centang alat yang perlu halaman khusus: jumlahnya otomatis 4 dan bisa diubah per alat. Alat yang tidak dicentang mengikuti total halaman dari Excel.
            </p>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">1. Unggah file Excel</h2>
                        <p className="mt-1 text-sm text-slate-500">Pilih workbook .xlsx yang memiliki sheet REKAP dan Sertifikat.</p>
                    </div>
                    <div>
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
                        <span className="ml-auto rounded-full bg-teal-100 px-3 py-1 font-semibold text-teal-800">{records.length} alat</span>
                    </div>
                )}
                {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            </section>

            {records.length > 0 && (
                <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">2. Atur halaman khusus</h2>
                            <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">Centang alat yang perlu halaman khusus; otomatis terisi 4 dan angkanya bisa diubah. Alat yang tidak dicentang tetap mengikuti Excel. No. Label yang sama dibedakan berdasarkan Nama Alat dan baris REKAP.</p>
                        </div>
                        <span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900">
                            {`${validCustomPageOverrides.length} alat custom`}
                        </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari No. Label / nama alat / no. seri"
                            className="min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 sm:w-96"
                        />
                        <span className="text-sm text-slate-500">Menampilkan {visibleRecords.length} dari {records.length} alat</span>
                    </div>

                    <div className="mt-3 max-h-[min(68vh,760px)] overflow-auto rounded-2xl border border-slate-100">
                        {visibleRecords.map((record) => (
                            <div key={record.id} className="grid grid-cols-1 items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_7rem] sm:gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">{record.fields.label || 'Tanpa No. Label'} · {record.fields.equipment || 'Nama alat kosong'}</p>
                                    <p className="truncate text-xs text-slate-500">{record.fields.brand || '-'} {record.fields.model ? `· ${record.fields.model}` : ''} {record.fields.serialNumber ? `· SN ${record.fields.serialNumber}` : ''}</p>
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium text-slate-600">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(customPageTotals[record.id]?.trim())}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setCustomPageTotals((current) => {
                                                const next = { ...current };
                                                if (checked) next[record.id] = '4';
                                                else delete next[record.id];
                                                return next;
                                            });
                                        }}
                                        className="h-4 w-4 accent-teal-700"
                                        aria-label={`Atur halaman khusus untuk ${record.fields.label} ${record.fields.equipment}`}
                                    />
                                    <span>Halaman custom (4)</span>
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
                                    disabled={!customPageTotals[record.id]?.trim()}
                                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                />
                            </div>
                        ))}
                        {visibleRecords.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Alat tidak ditemukan.</p>}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button type="button" disabled={!hasPageSettings || invalidCustomPageOverrideCount > 0} onClick={() => void handleCopyPageSettings()}>
                            Salin pengaturan ke clipboard
                        </Button>
                        <span className="text-sm text-slate-500">
                            {invalidCustomPageOverrideCount > 0
                                ? `Perbaiki ${invalidCustomPageOverrideCount} isian (angka 1–999).`
                                : 'Jalankan printer lokal di komputer yang sama setelah menyalin.'}
                        </span>
                    </div>
                </section>
            )}
        </PageContainer>
    );
}
