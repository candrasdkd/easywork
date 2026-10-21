import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { filterSourceReportFiles } from '../lib/certificateMasterFiles';
import {
    CERTIFICATE_MATCHING_VERSION,
    certificateDateKey,
    fillMasterWorkbook,
    findMasterLayout,
    isEmptyCertificateValue,
    previewFieldValuesMatch,
    readSourceReportWorkbook,
    suggestMasterSheet,
    type CertificateField,
    type CertificateFillResult,
    type CertificatePreviewRow,
    type PreviewField,
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
    { field: 'brand', label: 'Merk' },
    { field: 'type', label: 'Tipe / Model' },
    { field: 'serialNumber', label: 'No. Seri' },
    { field: 'capacity', label: 'Kapasitas' },
    { field: 'accuracy', label: 'Tingkat Ketelitian' },
    { field: 'method', label: 'MK' },
    { field: 'owner', label: 'Milik / Pemilik' },
    { field: 'room', label: 'Ruangan' },
    { field: 'receivedDate', label: 'Tanggal Penerimaan' },
    { field: 'performedDate', label: 'Tanggal Pelaksanaan' },
];

const previewFieldLabels: Record<PreviewField, string> = {
    label: 'No. Label',
    equipmentName: 'Nama Alat',
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

type PreviewColumnKey = 'rowNumber' | 'label' | 'equipmentName' | CertificateField | 'status' | 'source';
type DownloadDateOption = { key: string; label: string; count: number };

const NO_PERFORMED_DATE_KEY = '__tanggal_kosong__';

const previewColumnKeys: PreviewColumnKey[] = [
    'rowNumber', 'label', 'equipmentName', ...previewFieldColumns.map(({ field }) => field), 'status', 'source',
];

const defaultPreviewColumnWidths: Record<PreviewColumnKey, number> = {
    rowNumber: 48,
    label: 110,
    equipmentName: 140,
    ...previewFieldWidths,
    status: 190,
    source: 180,
};

const previewColumnWidthsStorageKey = 'easywork:certificate-preview-column-widths';

function clampPreviewColumnWidth(key: PreviewColumnKey, width: number): number {
    const minimum = key === 'rowNumber' ? 42 : key === 'status' ? 110 : key === 'source' ? 90 : 55;
    return Math.max(minimum, Math.min(600, Math.round(width)));
}

function loadPreviewColumnWidths(): Record<PreviewColumnKey, number> {
    if (typeof localStorage === 'undefined') return defaultPreviewColumnWidths;
    try {
        const saved = JSON.parse(localStorage.getItem(previewColumnWidthsStorageKey) ?? '{}') as Partial<Record<PreviewColumnKey, unknown>>;
        return previewColumnKeys.reduce((widths, key) => {
            const value = saved[key];
            if (typeof value === 'number' && Number.isFinite(value)) widths[key] = clampPreviewColumnWidth(key, value);
            return widths;
        }, { ...defaultPreviewColumnWidths });
    } catch {
        return defaultPreviewColumnWidths;
    }
}

function formatDateKey(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function getMissingSourceMeasurementLabels(row: CertificatePreviewRow): string[] {
    if (row.matchedOn.length === 0 || row.ambiguousLabelMatch || row.ambiguousSourceMatch || row.sourceAlreadyUsed) return [];
    return (['capacity', 'accuracy'] as const)
        .filter((field) => !row.sourceValues?.[field] && !row.conflicts.includes(field))
        .map((field) => previewFieldLabels[field]);
}

interface ResizableHeaderCellProps {
    columnKey: PreviewColumnKey;
    label: string;
    width: number;
    onResizeStart: (event: React.PointerEvent<HTMLButtonElement>, column: PreviewColumnKey) => void;
    onAdjust: (column: PreviewColumnKey, delta: number) => void;
}

function ResizableHeaderCell({ columnKey, label, width, onResizeStart, onAdjust }: ResizableHeaderCellProps) {
    return (
        <th className="relative px-3 py-3 pr-4 font-semibold" style={{ width }}>
            <span className="block">{label}</span>
            <button
                type="button"
                aria-label={`Ubah lebar kolom ${label}; gunakan panah kiri atau kanan`}
                title="Tarik untuk mengubah lebar kolom"
                onPointerDown={(event) => onResizeStart(event, columnKey)}
                onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                    event.preventDefault();
                    onAdjust(columnKey, event.key === 'ArrowLeft' ? -12 : 12);
                }}
                className="group absolute inset-y-0 right-0 z-10 flex w-2 touch-none cursor-col-resize items-center justify-center border-l border-gray-300 bg-transparent transition-colors hover:border-teal-600 hover:bg-teal-500/20 focus:border-teal-600 focus:bg-teal-500/20 focus:outline-none dark:border-slate-600"
            >
                <span className="h-4 w-0.5 rounded-full bg-gray-400 transition-colors group-hover:bg-teal-700 dark:bg-slate-400 dark:group-hover:bg-teal-200" />
            </button>
        </th>
    );
}

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

async function getSourceFileFingerprint(contents: ArrayBuffer): Promise<string | null> {
    if (!globalThis.crypto?.subtle) return null;
    try {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', contents);
        return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
        return null;
    }
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
    const [progressFile, setProgressFile] = React.useState('');
    const [progressCount, setProgressCount] = React.useState(0);
    const [progressPercent, setProgressPercent] = React.useState(0);
    const [progressStage, setProgressStage] = React.useState<'read' | 'match' | 'prepare'>('read');
    const [editingCell, setEditingCell] = React.useState<{ rowNumber: number; field: PreviewField } | null>(null);
    const [editDraft, setEditDraft] = React.useState('');
    const [storageReady, setStorageReady] = React.useState(false);
    const [storageStatus, setStorageStatus] = React.useState<'checking' | 'saving' | 'saved' | 'empty' | 'error'>('checking');
    const [storageError, setStorageError] = React.useState('');
    const [restoredFromStorage, setRestoredFromStorage] = React.useState(false);
    const [downloadDialogOpen, setDownloadDialogOpen] = React.useState(false);
    const [selectedDownloadDates, setSelectedDownloadDates] = React.useState<string[] | null>(null);
    const [downloadError, setDownloadError] = React.useState('');
    const persistenceQueue = React.useRef<Promise<void>>(Promise.resolve());
    const persistenceRevision = React.useRef(0);
    const [columnWidths, setColumnWidths] = React.useState(loadPreviewColumnWidths);
    const previewTableRef = React.useRef<HTMLTableElement | null>(null);
    const previewScrollRef = React.useRef<HTMLDivElement | null>(null);
    const resizeCleanup = React.useRef<(() => void) | null>(null);
    const totalColumnWidth = previewColumnKeys.reduce((sum, key) => sum + columnWidths[key], 0);
    const downloadDateOptions = React.useMemo<DownloadDateOption[]>(() => {
        if (!outputWorkbook || !result || !targetSheet) return [];
        const layout = findMasterLayout(outputWorkbook, targetSheet);
        const sheet = outputWorkbook.Sheets[targetSheet];
        if (!layout || !sheet) return [];

        const counts = new Map<string, number>();
        result.previewRows.forEach((row) => {
            const cell = layout.columns.performedDate === undefined
                ? undefined
                : sheet[XLSX.utils.encode_cell({ r: row.rowNumber - 1, c: layout.columns.performedDate })] as XLSX.CellObject | undefined;
            const dateKey = certificateDateKey(cell?.v)
                ?? certificateDateKey(cell?.w)
                ?? certificateDateKey(row.performedDate)
                ?? NO_PERFORMED_DATE_KEY;
            counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
        });

        return [...counts.entries()]
            .sort(([left], [right]) => {
                if (left === NO_PERFORMED_DATE_KEY) return 1;
                if (right === NO_PERFORMED_DATE_KEY) return -1;
                return left.localeCompare(right);
            })
            .map(([key, count]) => ({
                key,
                label: key === NO_PERFORMED_DATE_KEY ? 'Tanggal pelaksanaan kosong' : formatDateKey(key),
                count,
            }));
    }, [outputWorkbook, result, targetSheet]);

    const scrollPreviewHorizontally = React.useCallback((direction: 'left' | 'right') => {
        const container = previewScrollRef.current;
        if (!container) return;
        const distance = Math.max(240, container.clientWidth * 0.75);
        container.scrollBy({ left: direction === 'left' ? -distance : distance, behavior: 'smooth' });
    }, []);

    const updateColumnWidth = React.useCallback((column: PreviewColumnKey, width: number) => {
        const nextWidths = { ...columnWidths, [column]: clampPreviewColumnWidth(column, width) };
        setColumnWidths(nextWidths);
        try {
            localStorage.setItem(previewColumnWidthsStorageKey, JSON.stringify(nextWidths));
        } catch {
            // Resizing still works for this page session when browser storage is unavailable.
        }
    }, [columnWidths]);

    const startColumnResize = React.useCallback((event: React.PointerEvent<HTMLButtonElement>, column: PreviewColumnKey) => {
        event.preventDefault();
        event.stopPropagation();
        resizeCleanup.current?.();

        const table = previewTableRef.current;
        const columnIndex = previewColumnKeys.indexOf(column);
        const columnElement = table?.querySelectorAll('col').item(columnIndex);
        if (!table || !(columnElement instanceof HTMLTableColElement)) return;

        const startX = event.clientX;
        const startWidth = columnWidths[column];
        const startingTotalWidth = totalColumnWidth;
        const pointerId = event.pointerId;
        let latestWidth = startWidth;

        const onPointerMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) return;
            latestWidth = clampPreviewColumnWidth(column, startWidth + moveEvent.clientX - startX);
            columnElement.style.width = `${latestWidth}px`;
            table.style.minWidth = `${startingTotalWidth + latestWidth - startWidth}px`;
        };
        const cleanup = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerEnd);
            window.removeEventListener('pointercancel', onPointerEnd);
            resizeCleanup.current = null;
        };
        const onPointerEnd = (endEvent: PointerEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            cleanup();
            updateColumnWidth(column, latestWidth);
        };

        resizeCleanup.current = cleanup;
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerEnd);
        window.addEventListener('pointercancel', onPointerEnd);
    }, [columnWidths, totalColumnWidth, updateColumnWidth]);

    React.useEffect(() => () => resizeCleanup.current?.(), []);

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
                    const restoredSourceFingerprints = new Set<string>();
                    let restoredDuplicateSourceFileCount = 0;
                    for (const fileId of session.sourceFileIds) {
                        const storedFile = await loadCertificateFile(fileId);
                        if (!storedFile) continue;
                        const file = new File([storedFile.data], storedFile.name, {
                            type: storedFile.type,
                            lastModified: storedFile.lastModified,
                        });
                        const fingerprint = await getSourceFileFingerprint(await file.arrayBuffer());
                        if (fingerprint && restoredSourceFingerprints.has(fingerprint)) {
                            restoredDuplicateSourceFileCount += 1;
                            continue;
                        }
                        if (fingerprint) restoredSourceFingerprints.add(fingerprint);
                        rememberRestoredFileKey(file, storedFile.key);
                        restoredSourceFiles.push(file);
                    }

                    let restoredOutputWorkbook = session.outputWorkbook as XLSX.WorkBook | null;
                    let restoredResult = session.result ? {
                        ...session.result,
                        identityOnlyRows: session.result.identityOnlyRows ?? 0,
                        previewRows: session.result.previewRows.map((row) => ({
                            ...row,
                            sourceLabel: row.sourceLabel ?? '',
                            sourceEquipmentName: row.sourceEquipmentName ?? '',
                            matchedOn: row.matchedOn ?? [],
                            matchedFields: row.matchedFields ?? [],
                            mismatches: row.mismatches ?? [],
                            editedFields: row.editedFields ?? [],
                            masterConfirmedFields: row.masterConfirmedFields ?? [],
                        })),
                    } : null;
                    const savedTargetSheet = session.targetSheet || (restoredMasterWorkbook ? suggestMasterSheet(restoredMasterWorkbook) : '');
                    const hasLegacyMatchResult = Boolean(session.result && (
                        session.result.matchingVersion !== CERTIFICATE_MATCHING_VERSION
                        || restoredDuplicateSourceFileCount > 0
                        || session.result.previewRows.some((row) => !Array.isArray((row as { matchedOn?: unknown }).matchedOn))
                    ));

                    // Refresh saved previews when matching rules change while keeping
                    // the user's edited workbook values and review decisions intact.
                    if (hasLegacyMatchResult && restoredOutputWorkbook && savedTargetSheet && restoredSourceFiles.length > 0) {
                        try {
                            const records = [];
                            for (let index = 0; index < restoredSourceFiles.length; index += 1) {
                                const file = restoredSourceFiles[index];
                                const sourceWorkbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
                                records.push(...readSourceReportWorkbook(
                                    sourceWorkbook,
                                    file.name,
                                    `${index}\u0000${sourceFileKey(file)}`,
                                ));
                            }
                            if (records.length > 0) {
                                const previousRows = new Map((session.result?.previewRows ?? []).map((row) => [row.rowNumber, row]));
                                const refreshed = fillMasterWorkbook(restoredOutputWorkbook, savedTargetSheet, records);
                                const previewRows = refreshed.previewRows.map((row) => {
                                    const previous = previousRows.get(row.rowNumber);
                                    const masterConfirmedFields = (previous?.masterConfirmedFields ?? [])
                                        .filter((field) => row.mismatches.includes(field));
                                    return {
                                        ...row,
                                        editedFields: previous?.editedFields ?? [],
                                        masterConfirmedFields,
                                    };
                                });
                                restoredResult = {
                                    ...refreshed,
                                    previewRows,
                                    unresolvedMismatchCells: previewRows.reduce((count, row) => count
                                        + row.mismatches.filter((field) => !row.masterConfirmedFields.includes(field)).length, 0),
                                };
                            }
                        } catch {
                            // Keep the last saved preview if one of its files cannot be refreshed.
                        }
                    }

                    if (!cancelled) {
                        setMasterFile(restoredMasterFile);
                        setMasterWorkbook(restoredMasterWorkbook);
                        setTargetSheet(savedTargetSheet);
                        setSourceFiles(restoredSourceFiles);
                        setResult(restoredResult);
                        setOutputWorkbook(restoredOutputWorkbook);
                        setWarnings([
                            ...(session.warnings ?? []),
                            ...(restoredDuplicateSourceFileCount > 0
                                ? [`${restoredDuplicateSourceFileCount} file duplikat identik dihapus; setiap laporan diproses satu kali.`]
                                : []),
                        ]);
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
        setProgressFile(masterFile.name);
        setProgressCount(0);
        setProgressPercent(3);
        setProgressStage('read');
        try {
            // Re-read the original file so repeated runs never reuse a previous preview's edits.
            const output = XLSX.read(await masterFile.arrayBuffer(), {
                type: 'array',
                cellDates: true,
                cellStyles: true,
            });
            setProgressPercent(8);
            setProgressFile('');
            const records = [];
            const nextWarnings: string[] = [];
            const processedSourceFiles: File[] = [];
            const seenSourceFingerprints = new Set<string>();
            let duplicateSourceFileCount = 0;

            for (let index = 0; index < sourceFiles.length; index += 1) {
                const file = sourceFiles[index];
                setProgress(`Membaca laporan ${index + 1} dari ${sourceFiles.length}`);
                setProgressFile(file.name);
                setProgressCount(index);
                setProgressPercent(Math.round(8 + (index / sourceFiles.length) * 82));
                try {
                    const contents = await file.arrayBuffer();
                    const fingerprint = await getSourceFileFingerprint(contents);
                    if (fingerprint && seenSourceFingerprints.has(fingerprint)) {
                        duplicateSourceFileCount += 1;
                        setProgressCount(index + 1);
                        setProgressPercent(Math.round(8 + ((index + 1) / sourceFiles.length) * 82));
                        continue;
                    }
                    if (fingerprint) seenSourceFingerprints.add(fingerprint);
                    processedSourceFiles.push(file);

                    const sourceWorkbook = XLSX.read(contents, {
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
                setProgressCount(index + 1);
                setProgressPercent(Math.round(8 + ((index + 1) / sourceFiles.length) * 82));
            }

            if (processedSourceFiles.length < sourceFiles.length) setSourceFiles(processedSourceFiles);
            if (duplicateSourceFileCount > 0) {
                nextWarnings.push(`${duplicateSourceFileCount} file duplikat identik dilewati; setiap laporan diproses satu kali.`);
            }

            setProgressStage('match');
            setProgress('Mencocokkan identitas alat dengan file LK...');
            setProgressFile('');
            setProgressPercent(93);
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            const fillResult = fillMasterWorkbook(output, targetSheet, records);
            setProgressStage('prepare');
            setProgressPercent(98);
            setOutputWorkbook(output);
            setResult(fillResult);
            setWarnings(nextWarnings);
            if (records.length === 0) {
                setError('Belum ada data laporan yang berhasil dibaca. Cek nama sheet dan isi file sumber.');
            }
            setProgressPercent(100);
        } catch (cause) {
            setError((cause as Error).message || 'Proses gagal dijalankan.');
        } finally {
            setBusy(false);
            setProgress('');
            setProgressFile('');
        }
    }, [masterFile, masterWorkbook, targetSheet, sourceFiles]);

    const handleFieldEdit = React.useCallback((rowNumber: number, field: PreviewField, value: string) => {
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

            const sourceValue = field === 'label'
                ? row.sourceLabel ?? ''
                : field === 'equipmentName'
                    ? row.sourceEquipmentName ?? ''
                    : row.sourceValues[field];
            const hasSourceValue = !isEmptyCertificateValue(sourceValue);
            const hasConflict = field !== 'label' && field !== 'equipmentName' && row.conflicts.includes(field);
            const canCompare = hasSourceValue && !hasConflict;
            const isEmpty = isEmptyCertificateValue(value);
            const matchesSource = canCompare && !isEmpty && previewFieldValuesMatch(field, value, sourceValue);
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

    const confirmMasterValue = React.useCallback((rowNumber: number, field: PreviewField) => {
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

    const startFieldEdit = React.useCallback((rowNumber: number, field: PreviewField, value: string) => {
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
        if (!outputWorkbook || !masterFile || !targetSheet || !result) return;
        const downloadAllDates = selectedDownloadDates === null;
        if (selectedDownloadDates?.length === 0) {
            setDownloadError('Pilih setidaknya satu tanggal.');
            return;
        }

        const layout = findMasterLayout(outputWorkbook, targetSheet);
        const sourceSheet = outputWorkbook.Sheets[targetSheet];
        if (!layout || !sourceSheet) {
            setDownloadError('Sheet MASTER yang akan diunduh tidak ditemukan.');
            return;
        }

        let rowsForDownload = result.previewRows;
        if (!downloadAllDates) {
            const selectedDateKeys = new Set(selectedDownloadDates ?? []);
            rowsForDownload = result.previewRows.filter((row) => {
                const cell = layout.columns.performedDate === undefined
                    ? undefined
                    : sourceSheet[XLSX.utils.encode_cell({ r: row.rowNumber - 1, c: layout.columns.performedDate })] as XLSX.CellObject | undefined;
                const date = certificateDateKey(cell?.v)
                    ?? certificateDateKey(cell?.w)
                    ?? certificateDateKey(row.performedDate)
                    ?? NO_PERFORMED_DATE_KEY;
                return selectedDateKeys.has(date);
            });
            if (rowsForDownload.length === 0) {
                setDownloadError('Tidak ada baris untuk tanggal yang dipilih.');
                return;
            }
        }

        const exportSheet: XLSX.WorkSheet = { ...sourceSheet };
        const exportWorkbook: XLSX.WorkBook = {
            ...outputWorkbook,
            Sheets: { ...outputWorkbook.Sheets, [targetSheet]: exportSheet },
        };

        if (!downloadAllDates && result.previewRows.length > 0 && sourceSheet['!ref']) {
            const range = XLSX.utils.decode_range(sourceSheet['!ref']);
            const rowSlots = result.previewRows
                .map((row) => row.rowNumber - 1)
                .sort((left, right) => left - right);
            const selected = rowsForDownload
                .map((row) => ({ row, sourceRow: row.rowNumber - 1 }))
                .sort((left, right) => left.sourceRow - right.sourceRow);
            const rowMetadata = sourceSheet['!rows'] ? [...sourceSheet['!rows']] : undefined;

            rowSlots.forEach((destinationRow, slotIndex) => {
                const selectedRow = selected[slotIndex];
                for (let column = range.s.c; column <= range.e.c; column += 1) {
                    const destinationAddress = XLSX.utils.encode_cell({ r: destinationRow, c: column });
                    const destinationCell = exportSheet[destinationAddress] as XLSX.CellObject | undefined;
                    if (selectedRow) {
                        const sourceAddress = XLSX.utils.encode_cell({ r: selectedRow.sourceRow, c: column });
                        const sourceCell = sourceSheet[sourceAddress] as XLSX.CellObject | undefined;
                        if (sourceCell) exportSheet[destinationAddress] = { ...sourceCell };
                        else if (destinationCell) {
                            const blankCell = { ...destinationCell };
                            delete blankCell.v;
                            delete blankCell.f;
                            delete blankCell.w;
                            blankCell.t = 'z';
                            exportSheet[destinationAddress] = blankCell;
                        }
                    } else if (destinationCell) {
                        const blankCell = { ...destinationCell };
                        delete blankCell.v;
                        delete blankCell.f;
                        delete blankCell.w;
                        blankCell.t = 'z';
                        exportSheet[destinationAddress] = blankCell;
                    }
                }

                if (rowMetadata) {
                    const selectedRow = selected[slotIndex];
                    if (selectedRow && rowMetadata[selectedRow.sourceRow]) {
                        rowMetadata[destinationRow] = { ...rowMetadata[selectedRow.sourceRow] };
                    } else if (rowMetadata[destinationRow]) {
                        rowMetadata[destinationRow] = { ...rowMetadata[destinationRow], hidden: false };
                    }
                }
            });
            if (rowMetadata) exportSheet['!rows'] = [...rowMetadata];
        }

        const outputRows = downloadAllDates ? result.previewRows : rowsForDownload;
        outputRows.forEach((row, index) => {
            const rowIndex = downloadAllDates ? row.rowNumber - 1 : result.previewRows[index].rowNumber - 1;
            (['capacity', 'accuracy'] as const).forEach((field) => {
                if (!isEmptyCertificateValue(row[field])) return;
                const column = layout.columns[field];
                if (column === undefined) return;
                const address = XLSX.utils.encode_cell({ r: rowIndex, c: column });
                const existingCell = exportSheet[address] as XLSX.CellObject | undefined;
                const placeholderCell: XLSX.CellObject = { ...(existingCell ?? {}), t: 's', v: '-' };
                delete placeholderCell.f;
                delete placeholderCell.w;
                exportSheet[address] = placeholderCell;
            });
        });

        const baseName = masterFile.name.replace(/\.xlsx?$/i, '');
        XLSX.writeFile(exportWorkbook, `${baseName}_terisi.xlsx`, { compression: true });
        setDownloadDialogOpen(false);
        setDownloadError('');
    }, [masterFile, outputWorkbook, result, selectedDownloadDates, targetSheet]);

    const selectedLayout = masterWorkbook && targetSheet
        ? findMasterLayout(masterWorkbook, targetSheet)
        : null;

    const renderPreviewCellContent = (row: CertificateFillResult['previewRows'][number], field: PreviewField, label: string) => {
        const value = row[field] ?? '';
        const sourceValue = field === 'label'
            ? row.sourceLabel ?? ''
            : field === 'equipmentName'
                ? row.sourceEquipmentName ?? ''
                : row.sourceValues[field];
        const hasMismatch = row.mismatches.includes(field);
        const isConfirmed = row.masterConfirmedFields.includes(field);
        const isEditedAndMatched = row.editedFields.includes(field) && row.matchedFields.includes(field);
        const isEditing = editingCell?.rowNumber === row.rowNumber && editingCell.field === field;
        const hasColumn = selectedLayout?.columns[field] !== undefined;
        const baseCellClass = hasMismatch && !isConfirmed
            ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
            : isConfirmed || isEditedAndMatched
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800'
                : 'text-gray-700 dark:text-gray-300';
        const hasConflict = field !== 'label' && field !== 'equipmentName' && row.conflicts.includes(field);

        return (
            <>
                {hasMismatch && <span className="mb-1 block text-[9px] font-bold tracking-wide text-gray-500 dark:text-gray-400">MASTER</span>}
                {!hasColumn ? (
                    <span className="px-1.5 py-1 text-gray-400">{value || '—'}</span>
                ) : isEditing ? (
                    <textarea
                        aria-label={`Edit ${label}, baris ${row.rowNumber}`}
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
                        className={`block w-full min-w-0 resize-y rounded-md border px-2 py-1.5 text-xs leading-5 outline-none ring-2 focus:ring-teal-500/20 ${isConfirmed || isEditedAndMatched ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-teal-500 bg-white text-gray-900 ring-teal-500/20 dark:bg-slate-900 dark:text-gray-100'}`}
                    />
                ) : (
                    <button
                        type="button"
                        title={value || `Ubah ${label}`}
                        aria-label={`Ubah ${label} baris ${row.rowNumber}`}
                        disabled={busy}
                        onClick={() => startFieldEdit(row.rowNumber, field, value)}
                        className={`group block w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed dark:hover:bg-slate-800 ${baseCellClass}`}
                    >
                        <span className="break-words" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{value || '—'}</span>
                    </button>
                )}
                {hasMismatch && (
                    <div className="mt-1 space-y-1 rounded-md border border-gray-200 bg-gray-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex items-start gap-1.5">
                            <span className="shrink-0 text-[9px] font-bold tracking-wide text-gray-500 dark:text-gray-400">LK</span>
                            <span className="break-words text-[11px] text-gray-700 dark:text-gray-200">{sourceValue}</span>
                        </div>
                        {isConfirmed ? (
                            <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Perbedaan ditinjau · MASTER dipertahankan</span>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => confirmMasterValue(row.rowNumber, field)}
                                    className="whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                    ✓ Pertahankan MASTER
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleFieldEdit(row.rowNumber, field, sourceValue)}
                                    className="whitespace-nowrap rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-200"
                                >
                                    Pakai LK
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {hasConflict && <span className="ml-1 block text-[11px] text-amber-700 dark:text-amber-300">Sumber bentrok</span>}
                {!hasMismatch && isEmptyCertificateValue(value) && !isEmptyCertificateValue(sourceValue) && !hasConflict && (
                    <span className="ml-1 block break-words text-[11px] text-gray-500 dark:text-gray-400">LK {sourceValue}</span>
                )}
            </>
        );
    };

    return (
        <PageContainer
            title="Isi Master Sertifikat"
            breadcrumbs={[
                { title: 'Dashboard', path: '/' },
                { title: 'Isi Master Sertifikat' },
            ]}
        >
            <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
                Sistem memakai <strong>No. Label, Nama Alat, Merk, Tipe, dan No. Seri</strong> untuk mencari LK yang paling sesuai. Kalau beberapa file punya No. Label sama, data identitas lain membantu membedakannya. Jika masih ada beberapa kandidat yang sama kuat, sistem menandainya ambigu dan tidak mengisi otomatis. Semua perbedaan di lima kolom identitas ditampilkan untuk ditinjau bersama kolom lainnya.
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
                                        {selectedLayout.roomColumnInferred && <p className="text-xs text-amber-700 dark:text-amber-400">Header Ruangan tidak dikenali; sistem memakai kolom tepat di kanan Tanggal Terbit. Kolom kiri seperti Hasil tidak dipakai.</p>}
                                        {selectedLayout.columns.room === undefined && <p className="text-xs text-amber-700 dark:text-amber-400">Header Ruangan belum dikenali dan tidak ada kolom yang bisa dipakai di kanan Tanggal Terbit.</p>}
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
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pilih banyak file atau satu folder tanggal. Ulangi untuk menambahkan folder lain; file yang sudah dipilih tetap tersimpan. File dengan isi yang sama otomatis diproses satu kali. File selain .xlsx/.xls dan file sementara akan dilewati.</p>
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
                    <Button variant="success" onClick={() => {
                        setSelectedDownloadDates(null);
                        setDownloadError('');
                        setDownloadDialogOpen(true);
                    }}>
                        Unduh MASTER terisi
                    </Button>
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

            {downloadDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="certificate-download-title"
                        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
                    >
                        <h2 id="certificate-download-title" className="text-lg font-bold text-gray-900 dark:text-white">Unduh MASTER terisi</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Pilih tanggal pelaksanaan yang tersedia di Excel.</p>
                        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-800 dark:border-slate-700 dark:text-gray-100">
                            <input
                                type="checkbox"
                                checked={selectedDownloadDates === null}
                                disabled={downloadDateOptions.length === 0}
                                onChange={(event) => {
                                    setSelectedDownloadDates(event.target.checked ? null : []);
                                    setDownloadError('');
                                }}
                                className="h-4 w-4 accent-teal-600"
                            />
                            Semua tanggal (default)
                        </label>
                        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-slate-700">
                            {downloadDateOptions.map((option) => {
                                const checked = selectedDownloadDates === null || selectedDownloadDates.includes(option.key);
                                return (
                                    <label key={option.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-slate-800">
                                        <span className="flex min-w-0 items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(event) => {
                                                    const current = selectedDownloadDates ?? downloadDateOptions.map(({ key }) => key);
                                                    const next = event.target.checked
                                                        ? [...new Set([...current, option.key])]
                                                        : current.filter((key) => key !== option.key);
                                                    setSelectedDownloadDates(next.length === downloadDateOptions.length ? null : next);
                                                    setDownloadError('');
                                                }}
                                                className="h-4 w-4 shrink-0 accent-teal-600"
                                            />
                                            <span className="truncate">{option.label}</span>
                                        </span>
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{option.count} baris</span>
                                    </label>
                                );
                            })}
                            {downloadDateOptions.length === 0 && (
                                <p className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">Tidak ada tanggal pelaksanaan pada baris MASTER.</p>
                            )}
                        </div>
                        {selectedDownloadDates !== null && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Baris tanpa tanggal hanya ikut jika opsi tanggal kosong dipilih.</p>
                        )}
                        {downloadError && <p className="mt-3 text-sm font-medium text-rose-700 dark:text-rose-300" role="alert">{downloadError}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>Batal</Button>
                            <Button variant="success" onClick={handleDownload}>Unduh</Button>
                        </div>
                    </div>
                </div>
            )}

            {busy && (
                <Card className="relative mt-4 overflow-hidden border-teal-200 bg-gradient-to-r from-white via-teal-50/80 to-sky-50 dark:border-teal-900/70 dark:from-slate-900 dark:via-teal-950/30 dark:to-slate-900">
                    <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />
                    <CardContent className="relative">
                        <div className="flex items-center gap-4">
                            <div className="relative grid h-14 w-14 shrink-0 place-items-center">
                                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-teal-200/70 border-t-teal-600 dark:border-teal-900 dark:border-t-teal-300" />
                                <svg className="h-5 w-5 text-teal-700 dark:text-teal-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M4 7.5h6l2 2H20v8.75A1.75 1.75 0 0 1 18.25 20h-12.5A1.75 1.75 0 0 1 4 18.25V7.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                                    <path d="M8 14h8M8 16.75h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                                </svg>
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Lagi mencocokkan data</h2>
                                            <span className="relative flex h-2 w-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-300" />
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{progress}</p>
                                    </div>
                                    <span className="text-xl font-extrabold tabular-nums text-teal-700 dark:text-teal-300">{progressPercent}%</span>
                                </div>

                                {progressFile && (
                                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" title={progressFile}>
                                        File: <span className="font-medium text-gray-700 dark:text-gray-200">{progressFile}</span>
                                    </p>
                                )}

                                <div
                                    className="mt-3 h-2 overflow-hidden rounded-full bg-teal-100 dark:bg-slate-700"
                                    role="progressbar"
                                    aria-label="Kemajuan proses pencocokan"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={progressPercent}
                                >
                                    <div
                                        className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 transition-[width] duration-500 ease-out"
                                        style={{ width: `${progressPercent}%` }}
                                    >
                                        <span className="absolute inset-0 animate-pulse bg-white/25" />
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-medium">
                                    <span className={`inline-flex items-center gap-1.5 ${progressStage === 'read' ? 'text-teal-800 dark:text-teal-200' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${progressStage === 'read' ? 'animate-pulse bg-teal-600' : 'bg-emerald-500'}`} />
                                        Baca file LK{progressStage === 'read' ? ` · ${progressCount}/${sourceFiles.length}` : ' · selesai'}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 ${progressStage === 'read' ? 'text-gray-400 dark:text-gray-500' : 'text-teal-800 dark:text-teal-200'}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${progressStage === 'match' ? 'animate-pulse bg-teal-600' : progressStage === 'prepare' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                        Cocokkan No. Label + Nama Alat
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-amber-600">{result.labelOnlyRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">No. Label cocok, Nama Alat berbeda</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-blue-600">{result.identityOnlyRows ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400">Cocok via identitas lain</p></CardContent></Card>
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
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pencocokan sumber memakai No. Label, Nama Alat, Merk, Tipe, dan No. Seri. Kolom Nama Pemilik di MASTER juga dibandingkan dengan kolom Milik di LK. Kalau nilai berbeda, pilih <strong>Pertahankan MASTER</strong> atau <strong>Pakai LK</strong>. Baris yang sudah dikoreksi akan berwarna hijau dan tersimpan otomatis di browser. Tarik batas kanan judul kolom untuk mengubah lebarnya; ukuran tersimpan di browser.</p>
                            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400"><strong>MASTER</strong> adalah nilai pada tabel; <strong>LK</strong> adalah nilai dari laporan hasil di kotak abu-abu.</p>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 dark:border-slate-800">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Geser tabel ke samping:</span>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" aria-label="Geser tabel ke kiri" onClick={() => scrollPreviewHorizontally('left')}>
                                    ← Kiri
                                </Button>
                                <Button type="button" variant="outline" size="sm" aria-label="Geser tabel ke kanan" onClick={() => scrollPreviewHorizontally('right')}>
                                    Kanan →
                                </Button>
                            </div>
                        </div>
                        <div ref={previewScrollRef} className="max-h-[95vh] overflow-auto">
                            <table ref={previewTableRef} className="table-fixed w-full text-left text-xs" style={{ minWidth: `${totalColumnWidth}px` }}>
                                <colgroup>
                                    {previewColumnKeys.map((column) => (
                                        <col key={column} style={{ width: `${columnWidths[column]}px` }} />
                                    ))}
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                                    <tr>
                                        <ResizableHeaderCell columnKey="rowNumber" label="Baris" width={columnWidths.rowNumber} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                        <ResizableHeaderCell columnKey="label" label="No. Label" width={columnWidths.label} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                        <ResizableHeaderCell columnKey="equipmentName" label="Nama Alat" width={columnWidths.equipmentName} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                        {previewFieldColumns.map((column) => (
                                            <ResizableHeaderCell key={column.field} columnKey={column.field} label={column.label} width={columnWidths[column.field]} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                        ))}
                                        <ResizableHeaderCell columnKey="status" label="Status / dasar cocok" width={columnWidths.status} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                        <ResizableHeaderCell columnKey="source" label="Sumber" width={columnWidths.source} onResizeStart={startColumnResize} onAdjust={updateColumnWidth} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.previewRows.map((row) => {
                                        const missingSourceMeasurements = getMissingSourceMeasurementLabels(row);
                                        return (
                                        <React.Fragment key={`${row.rowNumber}-${row.label}`}>
                                            <tr
                                                className={`border-t border-gray-100 align-top dark:border-slate-800 ${row.editedFields.length > 0 || row.masterConfirmedFields.length > 0 ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}
                                            >
                                            <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                                            <td className="overflow-hidden px-2 py-2 font-medium text-gray-800 dark:text-gray-200">{renderPreviewCellContent(row, 'label', 'No. Label')}</td>
                                            <td className="overflow-hidden px-2 py-2 text-gray-800 dark:text-gray-200">{renderPreviewCellContent(row, 'equipmentName', 'Nama Alat')}</td>
                                            {previewFieldColumns.map((column) => (
                                                <td key={column.field} className="overflow-hidden px-2 py-2 text-gray-700 dark:text-gray-300">
                                                    {renderPreviewCellContent(row, column.field, column.label)}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <span className={`inline-flex rounded-full px-2 py-1 font-semibold ${row.status === 'Tidak ditemukan' || row.ambiguousLabelMatch || row.ambiguousSourceMatch || row.sourceAlreadyUsed || row.conflicts.length > 0 || row.matchedByLabelOnly ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : row.filledCount > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'}`}>
                                                        {row.status}
                                                    </span>
                                                    {(row.matchedOn ?? []).length > 0 && (
                                                        <p className="basis-full text-gray-500 dark:text-gray-400">
                                                            Dasar pencocokan awal: {(row.matchedOn ?? []).map((field) => previewFieldLabels[field]).join(' + ')}
                                                        </p>
                                                    )}
                                                    {missingSourceMeasurements.length > 0 && (
                                                        <p className="basis-full text-amber-700 dark:text-amber-300">
                                                            Tidak tercantum di LK: {missingSourceMeasurements.join(', ')}
                                                        </p>
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
                                                                Perlu ditinjau: {row.mismatches.filter((field) => !row.masterConfirmedFields.includes(field)).map((field) => previewFieldLabels[field]).join(', ')}
                                                            </p>
                                                        </>
                                                    )}
                                                    {row.masterConfirmedFields.length > 0 && (
                                                        <span className="basis-full text-emerald-700 dark:text-emerald-300">
                                                            Perbedaan ditinjau · MASTER dipertahankan: {row.masterConfirmedFields.map((field) => previewFieldLabels[field]).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="max-w-56 px-3 py-2 text-gray-500 dark:text-gray-400" title={row.sourceNames.join(', ')}>{row.sourceNames.join(', ') || '—'}</td>
                                            </tr>
                                        </React.Fragment>
                                        );
                                    })}
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
