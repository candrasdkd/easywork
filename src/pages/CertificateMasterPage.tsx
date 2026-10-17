import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { filterSourceReportFiles } from '../lib/certificateMasterFiles';
import {
    certificateFieldValuesMatch,
    fillMasterWorkbook,
    findMasterLayout,
    isEmptyCertificateValue,
    readSourceReportWorkbook,
    suggestMasterSheet,
    type CertificateField,
    type CertificateFillResult,
} from '../lib/certificateMaster';
import {
    loadCertificateFile,
    loadCertificateSession,
    saveCertificateWorkspace,
    type CertificateSessionSnapshot,
} from '../lib/certificateMasterStorage';

const manualFileIds = new WeakMap<File, number>();
const restoredFileKeys = new WeakMap<File, string>();
let nextManualFileId = 0;

const previewFieldColumns: Array<{ field: CertificateField; label: string }> = [
    { field: 'capacity', label: 'Kapasitas' },
    { field: 'accuracy', label: 'Tingkat Ketelitian' },
    { field: 'method', label: 'MK' },
    { field: 'owner', label: 'Milik / Pemilik' },
    { field: 'brand', label: 'Merk' },
    { field: 'type', label: 'Tipe / Model' },
    { field: 'serialNumber', label: 'No. Seri' },
    { field: 'room', label: 'Ruangan' },
    { field: 'receivedDate', label: 'Tanggal Penerimaan' },
    { field: 'performedDate', label: 'Tanggal Pelaksanaan' },
];

const previewFieldLabels: Record<CertificateField, string> = {
    capacity: 'Kapasitas',
    accuracy: 'Tingkat Ketelitian',
    method: 'MK',
    owner: 'Milik / Pemilik',
    brand: 'Merk',
    type: 'Tipe / Model',
    serialNumber: 'No. Seri',
    room: 'Ruangan',
    receivedDate: 'Tanggal Penerimaan',
    performedDate: 'Tanggal Pelaksanaan',
};

const previewFieldWidths: Record<CertificateField, number> = {
    capacity: 90,
    accuracy: 95,
    method: 130,
    owner: 145,
    brand: 95,
    type: 100,
    serialNumber: 115,
    room: 145,
    receivedDate: 120,
    performedDate: 120,
};

function sourceFileKey(file: File) {
    const restoredKey = restoredFileKeys.get(file);
    if (restoredKey) return restoredKey;
    if (file.webkitRelativePath) {
        return `folder\u0000${file.webkitRelativePath}\u0000${file.size}\u0000${file.lastModified}`;
    }

    // A regular file picker does not expose the parent path. Do not collapse
    // distinct files that happen to share a name, size, and modification time.
    let id = manualFileIds.get(file);
    if (id === undefined) {
        id = nextManualFileId;
        nextManualFileId += 1;
        manualFileIds.set(file, id);
    }
    return `manual\u0000${id}`;
}

function rememberRestoredFileKey(file: File, key: string) {
    restoredFileKeys.set(file, key);
    const manualId = key.match(/^manual\u0000(\d+)$/)?.[1];
    if (manualId) nextManualFileId = Math.max(nextManualFileId, Number(manualId) + 1);
}

export default function CertificateMasterPage() {
    const [masterFile, setMasterFile] = React.useState<File | null>(null);
    const [masterWorkbook, setMasterWorkbook] = React.useState<XLSX.WorkBook | null>(null);
    const [targetSheet, setTargetSheet] = React.useState('');
    const [sourceFiles, setSourceFiles] = React.useState<File[]>([]);
    const [result, setResult] = React.useState<CertificateFillResult | null>(null);
    const [outputWorkbook, setOutputWorkbook] = React.useState<XLSX.WorkBook | null>(null);
    const [warnings, setWarnings] = React.useState<string[]>([]);
    const [error, setError] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [progress, setProgress] = React.useState('');
    const [editingCell, setEditingCell] = React.useState<{ rowNumber: number; field: CertificateField } | null>(null);
    const [editDraft, setEditDraft] = React.useState('');
    const [storageReady, setStorageReady] = React.useState(false);
    const [storageStatus, setStorageStatus] = React.useState<'checking' | 'saving' | 'saved' | 'empty' | 'error'>('checking');
    const [storageError, setStorageError] = React.useState('');
    const [restoredFromStorage, setRestoredFromStorage] = React.useState(false);
    const persistenceQueue = React.useRef<Promise<void>>(Promise.resolve());
    const persistenceRevision = React.useRef(0);

    React.useEffect(() => {
        let cancelled = false;

        const restoreSavedWorkspace = async () => {
            try {
                const session = await loadCertificateSession();
                if (session) {
                    let restoredMasterFile: File | null = null;
                    let restoredMasterWorkbook: XLSX.WorkBook | null = null;
                    if (session.masterFileId) {
                        const storedMasterFile = await loadCertificateFile(session.masterFileId);
                        if (storedMasterFile) {
                            restoredMasterFile = new File([storedMasterFile.data], storedMasterFile.name, {
                                type: storedMasterFile.type,
                                lastModified: storedMasterFile.lastModified,
                            });
                            rememberRestoredFileKey(restoredMasterFile, storedMasterFile.key);
                            restoredMasterWorkbook = XLSX.read(await restoredMasterFile.arrayBuffer(), {
                                type: 'array',
                                cellDates: true,
                                cellStyles: true,
                            });
                        }
                    }

                    const restoredSourceFiles: File[] = [];
                    for (const fileId of session.sourceFileIds) {
                        const storedFile = await loadCertificateFile(fileId);
                        if (!storedFile) continue;
                        const file = new File([storedFile.data], storedFile.name, {
                            type: storedFile.type,
                            lastModified: storedFile.lastModified,
                        });
                        rememberRestoredFileKey(file, storedFile.key);
                        restoredSourceFiles.push(file);
                    }

                    if (!cancelled) {
                        setMasterFile(restoredMasterFile);
                        setMasterWorkbook(restoredMasterWorkbook);
                        setTargetSheet(session.targetSheet || (restoredMasterWorkbook ? suggestMasterSheet(restoredMasterWorkbook) : ''));
                        setSourceFiles(restoredSourceFiles);
                        setResult(session.result);
                        setOutputWorkbook(session.outputWorkbook as XLSX.WorkBook | null);
                        setWarnings(session.warnings ?? []);
                        setRestoredFromStorage(Boolean(session.masterFileId || session.sourceFileIds.length || session.result));
                        setStorageStatus('saved');
                    }
                } else if (!cancelled) {
                    setStorageStatus('empty');
                }
            } catch (cause) {
                if (!cancelled) {
                    setStorageError((cause as Error).message || 'Tidak bisa membaca simpanan lokal.');
                    setStorageStatus('error');
                }
            } finally {
                if (!cancelled) setStorageReady(true);
            }
        };

        void restoreSavedWorkspace();
        return () => { cancelled = true; };
    }, []);

    React.useEffect(() => {
        if (!storageReady) return undefined;
        const revision = persistenceRevision.current + 1;
        persistenceRevision.current = revision;

        const files: Array<{ id: string; key: string; file: File }> = [];
        if (masterFile) {
            const key = sourceFileKey(masterFile);
            files.push({ id: `master:${key}`, key, file: masterFile });
        }
        sourceFiles.forEach((file) => {
            const key = sourceFileKey(file);
            files.push({ id: `source:${key}`, key, file });
        });
        const keepFileIds = files.map(({ id }) => id);
        const hasWorkspace = Boolean(masterFile || sourceFiles.length || result || outputWorkbook);
        const snapshot: CertificateSessionSnapshot | null = hasWorkspace ? {
            masterFileId: masterFile ? `master:${sourceFileKey(masterFile)}` : null,
            sourceFileIds: sourceFiles.map((file) => `source:${sourceFileKey(file)}`),
            targetSheet,
            result,
            outputWorkbook,
            warnings,
            savedAt: Date.now(),
        } : null;

        const timer = window.setTimeout(() => {
            setStorageStatus('saving');
            setStorageError('');
            persistenceQueue.current = persistenceQueue.current
                .catch(() => undefined)
                .then(() => saveCertificateWorkspace(files, keepFileIds, snapshot))
                .then(() => {
                    if (persistenceRevision.current === revision) setStorageStatus(hasWorkspace ? 'saved' : 'empty');
                })
                .catch((cause: unknown) => {
                    if (persistenceRevision.current !== revision) return;
                    setStorageError((cause as Error).message || 'Simpanan lokal gagal.');
                    setStorageStatus('error');
                });
        }, 350);

        return () => window.clearTimeout(timer);
    }, [storageReady, masterFile, sourceFiles, targetSheet, result, outputWorkbook, warnings]);

    const clearResult = React.useCallback(() => {
        setResult(null);
        setOutputWorkbook(null);
        setWarnings([]);
        setError('');
        setEditingCell(null);
    }, []);

    const handleSourceFileSelection = React.useCallback((selectedFiles: File[]) => {
        if (selectedFiles.length === 0) return;
        const excelFiles = filterSourceReportFiles(selectedFiles);
        if (excelFiles.length === 0) {
            setError('Tidak ada file Excel .xlsx atau .xls pada pilihan ini.');
            return;
        }

        setSourceFiles((current) => {
            const seen = new Set(current.map(sourceFileKey));
            const additions = excelFiles.filter((file) => {
                const key = sourceFileKey(file);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            return [...current, ...additions];
        });
        clearResult();
        if (excelFiles.length < selectedFiles.length) {
            setWarnings([`${selectedFiles.length - excelFiles.length} file non-Excel atau file sementara dilewati.`]);
        }
    }, [clearResult]);

    const handleMasterUpload = React.useCallback(async (file: File | undefined) => {
        if (!file) return;
        clearResult();
        setError('');
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), {
                type: 'array',
                cellDates: true,
                cellStyles: true,
            });
            const sheetName = suggestMasterSheet(workbook);
            setMasterFile(file);
            setMasterWorkbook(workbook);
            setTargetSheet(sheetName);
            if (!sheetName) setError('Workbook ini tidak memiliki sheet yang bisa dibaca.');
            else if (!findMasterLayout(workbook, sheetName)) {
                setError('Sheet yang dipilih belum menampilkan header No. Label dan Nama Alat. Pilih sheet MASTER SERTIFIKAT atau REKAP yang berisi tabel alat.');
            }
        } catch (cause) {
            setMasterFile(null);
            setMasterWorkbook(null);
            setTargetSheet('');
            setError(`File MASTER gagal dibaca: ${(cause as Error).message}`);
        }
    }, [clearResult]);

    const handleProcess = React.useCallback(async () => {
        if (!masterFile || !masterWorkbook || !targetSheet || sourceFiles.length === 0) return;
        setEditingCell(null);
        setBusy(true);
        setError('');
        setWarnings([]);
        setProgress('Membaca MASTER...');
        try {
            // Re-read the original file so repeated runs never reuse a previous preview's edits.
            const output = XLSX.read(await masterFile.arrayBuffer(), {
                type: 'array',
                cellDates: true,
                cellStyles: true,
            });
            const records = [];
            const nextWarnings: string[] = [];

            for (let index = 0; index < sourceFiles.length; index += 1) {
                const file = sourceFiles[index];
                setProgress(`Membaca laporan ${index + 1} dari ${sourceFiles.length}: ${file.name}`);
                try {
                    const sourceWorkbook = XLSX.read(await file.arrayBuffer(), {
                        type: 'array',
                        cellDates: true,
                    });
                    const sourceId = `${index}\u0000${sourceFileKey(file)}`;
                    const fileRecords = readSourceReportWorkbook(sourceWorkbook, file.name, sourceId);
                    if (fileRecords.length === 0) {
                        nextWarnings.push(`${file.name}: tidak menemukan data No. Label/Nama Alat pada sheet Laporan Hasil.`);
                    } else {
                        records.push(...fileRecords);
                    }
                } catch (cause) {
                    nextWarnings.push(`${file.name}: gagal dibaca (${(cause as Error).message}).`);
                }
            }

            setProgress('Mencocokkan No. Label dan Nama Alat...');
            const fillResult = fillMasterWorkbook(output, targetSheet, records);
            setOutputWorkbook(output);
            setResult(fillResult);
            setWarnings(nextWarnings);
            if (records.length === 0) {
                setError('Belum ada data laporan yang berhasil dibaca. Cek nama sheet dan isi file sumber.');
            }
        } catch (cause) {
            setError((cause as Error).message || 'Proses gagal dijalankan.');
        } finally {
            setBusy(false);
            setProgress('');
        }
    }, [masterFile, masterWorkbook, targetSheet, sourceFiles]);

    const handleFieldEdit = React.useCallback((rowNumber: number, field: CertificateField, value: string) => {
        if (!outputWorkbook || !targetSheet) return;
        const layout = findMasterLayout(outputWorkbook, targetSheet);
        const column = layout?.columns[field];
        const sheet = outputWorkbook.Sheets[targetSheet];
        if (column === undefined || !sheet) return;

        const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: column });
        const existingCell = sheet[address] as XLSX.CellObject | undefined;
        const updatedCell: XLSX.CellObject = { ...(existingCell ?? {}), t: 's', v: value };
        // Manual correction replaces formulas and stale formatted display text.
        delete updatedCell.f;
        delete updatedCell.w;
        const nextSheet = { ...sheet, [address]: updatedCell };
        const nextWorkbook = {
            ...outputWorkbook,
            Sheets: { ...outputWorkbook.Sheets, [targetSheet]: nextSheet },
        };
        setOutputWorkbook(nextWorkbook);

        setResult((current) => {
            if (!current) return current;
            const row = current.previewRows.find((candidate) => candidate.rowNumber === rowNumber);
            if (!row) return current;

            const sourceValue = row.sourceValues[field];
            const hasSourceValue = !isEmptyCertificateValue(sourceValue);
            const canCompare = hasSourceValue && !row.conflicts.includes(field);
            const isEmpty = isEmptyCertificateValue(value);
            const matchesSource = canCompare && !isEmpty && certificateFieldValuesMatch(field, value, sourceValue);
            const differsFromSource = canCompare && !isEmpty && !matchesSource;
            const wasMatched = row.matchedFields.includes(field);
            const wasMismatched = row.mismatches.includes(field);
            const wasConfirmed = row.masterConfirmedFields.includes(field);
            const wasUnresolved = wasMismatched && !wasConfirmed;
            const matchedFields = row.matchedFields.filter((item) => item !== field);
            const mismatches = row.mismatches.filter((item) => item !== field);
            const editedFields = row.editedFields.includes(field) ? row.editedFields : [...row.editedFields, field];
            const masterConfirmedFields = wasConfirmed && row[field] === value
                ? row.masterConfirmedFields
                : row.masterConfirmedFields.filter((item) => item !== field);
            const isUnresolved = Boolean(differsFromSource) && !masterConfirmedFields.includes(field);
            if (matchesSource) matchedFields.push(field);
            if (differsFromSource) mismatches.push(field);

            const previewRows = current.previewRows.map((candidate) => candidate.rowNumber === rowNumber
                ? { ...candidate, [field]: value, matchedFields, mismatches, editedFields, masterConfirmedFields }
                : candidate);

            return {
                ...current,
                previewRows,
                matchingCells: current.matchingCells - Number(wasMatched) + Number(matchesSource),
                mismatchedCells: current.mismatchedCells - Number(wasMismatched) + Number(differsFromSource),
                unresolvedMismatchCells: current.unresolvedMismatchCells - Number(wasUnresolved) + Number(isUnresolved),
            };
        });
    }, [outputWorkbook, targetSheet]);

    const confirmMasterValue = React.useCallback((rowNumber: number, field: CertificateField) => {
        setResult((current) => {
            if (!current) return current;
            const row = current.previewRows.find((candidate) => candidate.rowNumber === rowNumber);
            if (!row || !row.mismatches.includes(field) || row.masterConfirmedFields.includes(field)) return current;

            const masterConfirmedFields = [...row.masterConfirmedFields, field];
            return {
                ...current,
                unresolvedMismatchCells: Math.max(0, current.unresolvedMismatchCells - 1),
                previewRows: current.previewRows.map((candidate) => candidate.rowNumber === rowNumber
                    ? { ...candidate, masterConfirmedFields }
                    : candidate),
            };
        });
    }, []);

    const startFieldEdit = React.useCallback((rowNumber: number, field: CertificateField, value: string) => {
        setEditingCell({ rowNumber, field });
        setEditDraft(value);
    }, []);

    const saveFieldEdit = React.useCallback(() => {
        if (!editingCell) return;
        handleFieldEdit(editingCell.rowNumber, editingCell.field, editDraft);
        setEditingCell(null);
    }, [editingCell, editDraft, handleFieldEdit]);

    const cancelFieldEdit = React.useCallback(() => {
        setEditingCell(null);
    }, []);

    const handleDownload = React.useCallback(() => {
        if (!outputWorkbook || !masterFile) return;
        const baseName = masterFile.name.replace(/\.xlsx?$/i, '');
        XLSX.writeFile(outputWorkbook, `${baseName}_terisi.xlsx`, { compression: true });
    }, [masterFile, outputWorkbook]);

    const selectedLayout = masterWorkbook && targetSheet
        ? findMasterLayout(masterWorkbook, targetSheet)
        : null;

    return (
        <PageContainer
            title="Isi Master Sertifikat"
            breadcrumbs={[
                { title: 'Dashboard', path: '/' },
                { title: 'Isi Master Sertifikat' },
            ]}
        >
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                Pilih file MASTER dan file laporan. Sistem mencocokkan pasangan <strong>No. Label + Nama Alat</strong> terlebih dahulu. Jika tidak ditemukan dan No. Label hanya merujuk ke satu Nama Alat, sistem mencoba mencocokkan berdasarkan <strong>No. Label saja</strong>. Setelah cocok, sistem mengisi kolom yang masih kosong dan membandingkan kolom MASTER yang sudah berisi dengan LK. Perbedaan ditandai untuk dicek; nilai MASTER tetap dipertahankan.
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">1. Pilih file MASTER</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Format Excel .xlsx atau .xls; sheet MASTER SERTIFIKAT dan REKAP akan dicari otomatis.</p>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            disabled={!storageReady}
                            className="block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
                            onChange={(event) => {
                                void handleMasterUpload(event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                        {masterFile && (
                            <div className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800/70">
                                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100" title={masterFile.name}>{masterFile.name}</p>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300" htmlFor="certificate-master-sheet">Sheet yang akan diisi</label>
                                <select
                                    id="certificate-master-sheet"
                                    value={targetSheet}
                                    disabled={!storageReady}
                                    onChange={(event) => {
                                        setTargetSheet(event.target.value);
                                        clearResult();
                                    }}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
                                >
                                    {masterWorkbook?.SheetNames.map((sheetName) => (
                                        <option key={sheetName} value={sheetName}>{sheetName}</option>
                                    ))}
                                </select>
                                {selectedLayout && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400">Header tabel terdeteksi pada baris {selectedLayout.headerRow + 1}.</p>
                                        {selectedLayout.roomColumnInferred && <p className="text-xs text-amber-700 dark:text-amber-400">Kolom ruangan dikenali dari posisinya di samping Tanggal Terbit.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">2. Pilih file laporan hasil</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pilih banyak file atau satu folder tanggal. Ulangi untuk menambahkan folder lain; file yang sudah dipilih tetap tersimpan. Pilihan file biasa tidak dideduplikasi otomatis karena browser tidak memberikan path. File selain .xlsx/.xls dan file sementara akan dilewati.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block space-y-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Tambah beberapa file
                                <input
                                    type="file"
                                    multiple
                                    disabled={!storageReady}
                                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    className="block w-full text-sm font-normal text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-teal-700 dark:text-gray-300"
                                    onChange={(event) => {
                                        handleSourceFileSelection(Array.from(event.target.files ?? []));
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                            <label className="block space-y-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                                Tambah lewat folder
                                <input
                                    ref={(input) => input?.setAttribute('webkitdirectory', '')}
                                    type="file"
                                    multiple
                                    disabled={!storageReady}
                                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    className="block w-full text-sm font-normal text-gray-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-teal-700 dark:text-gray-300"
                                    onChange={(event) => {
                                        handleSourceFileSelection(Array.from(event.target.files ?? []));
                                        event.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                        {sourceFiles.length > 0 && (
                            <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800/70">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{sourceFiles.length} file dipilih</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSourceFiles([]);
                                            clearResult();
                                        }}
                                        className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                                    >
                                        Hapus pilihan
                                    </button>
                                </div>
                                <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-gray-600 dark:text-gray-400">
                                    {sourceFiles.slice(0, 8).map((file) => <li key={sourceFileKey(file)} className="truncate" title={file.webkitRelativePath || file.name}>{file.webkitRelativePath || file.name}</li>)}
                                    {sourceFiles.length > 8 && <li className="font-medium">dan {sourceFiles.length - 8} file lainnya</li>}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleProcess()} loading={busy} disabled={!storageReady || !masterFile || !sourceFiles.length || !targetSheet}>
                    Proses dan cocokkan
                </Button>
                {outputWorkbook && result && (
                    <Button variant="success" onClick={handleDownload}>
                        Unduh MASTER terisi
                    </Button>
                )}
                {busy && (
                    <p className="text-sm text-gray-500 dark:text-gray-400" role="status">{progress}</p>
                )}
                <p className={`text-xs ${storageStatus === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-500 dark:text-gray-400'}`} role="status" aria-live="polite">
                    {!storageReady || storageStatus === 'checking'
                        ? 'Memeriksa simpanan lokal…'
                        : storageStatus === 'saving'
                            ? 'Menyimpan otomatis…'
                            : storageStatus === 'error'
                                ? `Autosave gagal: ${storageError}`
                                : storageStatus === 'saved'
                                    ? `${restoredFromStorage ? 'Sesi terakhir dipulihkan. ' : ''}Tersimpan otomatis di browser ini.`
                                    : 'Autosave aktif di browser ini.'}
                </p>
            </div>

            {error && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
                    {error}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-semibold">Beberapa file dilewati</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                        {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                </div>
            )}

            {result && (
                <div className="mt-6 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-gray-900 dark:text-white">{result.previewRows.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Baris alat di MASTER</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-emerald-600">{result.matchedRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">Cocok No. Label + Nama Alat</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-amber-600">{result.labelOnlyRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">Cocok No. Label saja</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-rose-600">{result.ambiguousLabelRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">No. Label ambigu</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-rose-600">{result.ambiguousSourceRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">Beberapa file cocok</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-amber-600">{result.reusedSourceRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">File sumber sudah dipakai</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-blue-600">{result.updatedCells}</p><p className="text-xs text-gray-500 dark:text-gray-400">Sel akan diisi</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-emerald-600">{result.matchingCells}</p><p className="text-xs text-gray-500 dark:text-gray-400">Kolom sama dengan LK</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-rose-600">{result.unresolvedMismatchCells}</p><p className="text-xs text-gray-500 dark:text-gray-400">Perbedaan perlu keputusan</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-amber-600">{result.unmatchedRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">Tidak ditemukan</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-rose-600">{result.conflictCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Kolom dengan konflik</p></CardContent></Card>
                    </div>

                    <Card>
                        <div className="border-b border-gray-100 px-5 py-4 dark:border-slate-800">
                            <h2 className="font-bold text-gray-900 dark:text-white">Pratinjau pengisian</h2>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Kalau nilai beda, pilih <strong>MASTER benar</strong> untuk mempertahankan MASTER atau <strong>Pakai LK</strong> untuk menggantinya. Edit nilai langsung dengan klik sel; hasil yang sudah dicek akan berwarna hijau.</p>
                        </div>
                        <div className="max-h-[95vh] overflow-auto">
                            <table className="table-fixed min-w-[1823px] w-full text-left text-xs">
                                <colgroup>
                                    <col style={{ width: '48px' }} />
                                    <col style={{ width: '110px' }} />
                                    <col style={{ width: '140px' }} />
                                    {previewFieldColumns.map((column) => (
                                        <col key={column.field} style={{ width: `${previewFieldWidths[column.field]}px` }} />
                                    ))}
                                    <col style={{ width: '190px' }} />
                                    <col style={{ width: '180px' }} />
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                                    <tr>
                                        <th className="px-3 py-3 font-semibold">Baris</th>
                                        <th className="px-3 py-3 font-semibold">No. Label</th>
                                        <th className="px-3 py-3 font-semibold">Nama Alat</th>
                                        {previewFieldColumns.map((column) => (
                                            <th key={column.field} className="px-3 py-3 font-semibold">{column.label}</th>
                                        ))}
                                        <th className="px-3 py-3 font-semibold">Status / dasar cocok</th>
                                        <th className="px-3 py-3 font-semibold">Sumber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.previewRows.map((row) => (
                                        <tr key={`${row.rowNumber}-${row.label}`} className="border-t border-gray-100 align-top dark:border-slate-800">
                                            <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{row.label}</td>
                                            <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{row.equipmentName}</td>
                                            {previewFieldColumns.map((column) => (
                                                <td key={column.field} className="overflow-hidden px-2 py-2 text-gray-700 dark:text-gray-300">
                                                    {selectedLayout?.columns[column.field] !== undefined ? (
                                                        editingCell?.rowNumber === row.rowNumber && editingCell.field === column.field ? (
                                                            <textarea
                                                                aria-label={`Edit ${column.label}, baris ${row.rowNumber}`}
                                                                autoFocus
                                                                rows={Math.min(10, Math.max(2, Math.ceil(editDraft.length / 14)))}
                                                                value={editDraft}
                                                                onChange={(event) => setEditDraft(event.target.value)}
                                                                onBlur={saveFieldEdit}
                                                                onFocus={(event) => event.currentTarget.select()}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter') {
                                                                        event.preventDefault();
                                                                        saveFieldEdit();
                                                                    } else if (event.key === 'Escape') {
                                                                        cancelFieldEdit();
                                                                    }
                                                                }}
                                                                className={`block w-full min-w-0 resize-y rounded-md border px-2 py-1.5 text-xs leading-5 outline-none ring-2 focus:ring-teal-500/20 ${row.masterConfirmedFields.includes(column.field) || row.editedFields.includes(column.field) && row.matchedFields.includes(column.field) ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-teal-500 bg-white text-gray-900 ring-teal-500/20 dark:bg-slate-900 dark:text-gray-100'}`}
                                                            />
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                title={row[column.field] || `Ubah ${column.label}`}
                                                                aria-label={`Ubah ${column.label} baris ${row.rowNumber}`}
                                                                disabled={busy}
                                                                onClick={() => startFieldEdit(row.rowNumber, column.field, row[column.field])}
                                                                className={`group block w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed dark:hover:bg-slate-800 ${row.mismatches.includes(column.field) && !row.masterConfirmedFields.includes(column.field) ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300' : row.masterConfirmedFields.includes(column.field) || row.editedFields.includes(column.field) && row.matchedFields.includes(column.field) ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800' : 'text-gray-700 dark:text-gray-300'}`}
                                                            >
                                                                <span
                                                                    className="break-words"
                                                                    style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                                                                >{row[column.field] || '—'}</span>
                                                            </button>
                                                        )
                                                    ) : (
                                                        <span className="px-1.5 py-1 text-gray-400">—</span>
                                                    )}
                                                    {row.mismatches.includes(column.field) && (
                                                        <div className="mt-1 space-y-1 px-1">
                                                            <span className={`block break-words text-[11px] ${row.masterConfirmedFields.includes(column.field) ? 'text-gray-500 dark:text-gray-400' : 'text-rose-700 dark:text-rose-300'}`}>
                                                                LK: {row.sourceValues[column.field]}
                                                            </span>
                                                            {row.masterConfirmedFields.includes(column.field) ? (
                                                                <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">MASTER dikonfirmasi benar</span>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => confirmMasterValue(row.rowNumber, column.field)}
                                                                        className="whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                    >
                                                                        ✓ MASTER benar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleFieldEdit(row.rowNumber, column.field, row.sourceValues[column.field])}
                                                                        className="whitespace-nowrap rounded border border-rose-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300"
                                                                    >
                                                                        Pakai LK
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {row.conflicts.includes(column.field) && (
                                                        <span className="ml-1 block text-[11px] text-amber-700 dark:text-amber-300">Sumber bentrok</span>
                                                    )}
                                                    {isEmptyCertificateValue(row[column.field])
                                                        && !isEmptyCertificateValue(row.sourceValues[column.field])
                                                        && !row.conflicts.includes(column.field)
                                                        && !row.mismatches.includes(column.field)
                                                        && <span className="ml-1 block break-words text-[11px] text-gray-500 dark:text-gray-400">LK {row.sourceValues[column.field]}</span>}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${row.status === 'Tidak ditemukan' || row.ambiguousLabelMatch || row.ambiguousSourceMatch || row.sourceAlreadyUsed || row.conflicts.length > 0 || row.matchedByLabelOnly ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : row.filledCount > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'}`}>
                                                        {row.status}
                                                    </span>
                                                    {row.matchedByLabelOnly && (
                                                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                                            Cocok No. Label saja
                                                        </span>
                                                    )}
                                                    {row.ambiguousLabelMatch && (
                                                        <p className="max-w-64 text-amber-800 dark:text-amber-300">
                                                            Ditemukan untuk: {row.candidateEquipmentNames.join(', ')}. Tidak diisi otomatis.
                                                        </p>
                                                    )}
                                                    {row.conflicts.length > 0 && (
                                                        <p className="basis-full text-rose-700 dark:text-rose-300">
                                                            Sumber bentrok: {row.conflicts.map((field) => previewFieldLabels[field]).join(', ')}
                                                        </p>
                                                    )}
                                                    {row.mismatches.some((field) => !row.masterConfirmedFields.includes(field)) && (
                                                        <>
                                                            <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">Berbeda dari LK</span>
                                                            <p className="basis-full text-rose-700 dark:text-rose-300">
                                                                Perlu keputusan: {row.mismatches.filter((field) => !row.masterConfirmedFields.includes(field)).map((field) => previewFieldLabels[field]).join(', ')}
                                                            </p>
                                                        </>
                                                    )}
                                                    {row.masterConfirmedFields.length > 0 && (
                                                        <span className="basis-full text-emerald-700 dark:text-emerald-300">
                                                            MASTER dikonfirmasi benar: {row.masterConfirmedFields.map((field) => previewFieldLabels[field]).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="max-w-56 px-3 py-2 text-gray-500 dark:text-gray-400" title={row.sourceNames.join(', ')}>{row.sourceNames.join(', ') || '—'}</td>
                                        </tr>
                                    ))}
                                    {result.previewRows.length === 0 && (
                                        <tr><td colSpan={previewFieldColumns.length + 5} className="px-4 py-12 text-center text-gray-500">Tidak menemukan baris alat pada sheet yang dipilih.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </PageContainer>
    );
}
