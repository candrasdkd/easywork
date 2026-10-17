import * as React from 'react';
import * as XLSX from 'xlsx';
import PageContainer from '../components/PageContainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { filterSourceReportFiles } from '../lib/certificateMasterFiles';
import {
    fillMasterWorkbook,
    findMasterLayout,
    readSourceReportWorkbook,
    suggestMasterSheet,
    type CertificateFillResult,
} from '../lib/certificateMaster';

const manualFileIds = new WeakMap<File, number>();
let nextManualFileId = 0;

function sourceFileKey(file: File) {
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

    const clearResult = React.useCallback(() => {
        setResult(null);
        setOutputWorkbook(null);
        setWarnings([]);
        setError('');
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
                Pilih file MASTER dan file laporan. Sistem mencocokkan pasangan <strong>No. Label + Nama Alat</strong> terlebih dahulu. Jika tidak ditemukan dan No. Label hanya merujuk ke satu Nama Alat, sistem mencoba mencocokkan berdasarkan <strong>No. Label saja</strong>. Jika No. Label mengarah ke beberapa Nama Alat, baris ditandai ambigu. Setiap file laporan hanya dipakai untuk satu baris MASTER.
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
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Header tabel terdeteksi pada baris {selectedLayout.headerRow + 1}.</p>
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
                <Button onClick={() => void handleProcess()} loading={busy} disabled={!masterFile || !sourceFiles.length || !targetSheet}>
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
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-amber-600">{result.unmatchedRows}</p><p className="text-xs text-gray-500 dark:text-gray-400">Tidak ditemukan</p></CardContent></Card>
                        <Card><CardContent className="py-4"><p className="text-2xl font-bold text-rose-600">{result.conflictCount}</p><p className="text-xs text-gray-500 dark:text-gray-400">Kolom dengan konflik</p></CardContent></Card>
                    </div>

                    <Card>
                        <div className="border-b border-gray-100 px-5 py-4 dark:border-slate-800">
                            <h2 className="font-bold text-gray-900 dark:text-white">Pratinjau pengisian</h2>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Nilai yang sudah ada tetap dipertahankan. Nilai sumber yang berbeda ditandai sebagai bentrok dan tidak diisikan otomatis.</p>
                        </div>
                        <div className="max-h-[560px] overflow-auto">
                            <table className="min-w-[1050px] w-full text-left text-xs">
                                <thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                                    <tr>
                                        <th className="px-3 py-3 font-semibold">Baris</th>
                                        <th className="px-3 py-3 font-semibold">No. Label</th>
                                        <th className="px-3 py-3 font-semibold">Nama Alat</th>
                                        <th className="px-3 py-3 font-semibold">Kapasitas</th>
                                        <th className="px-3 py-3 font-semibold">Tingkat Ketelitian</th>
                                        <th className="px-3 py-3 font-semibold">MK</th>
                                        <th className="px-3 py-3 font-semibold">Status / dasar cocok</th>
                                        <th className="px-3 py-3 font-semibold">Sumber</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.previewRows.map((row) => (
                                        <tr key={`${row.rowNumber}-${row.label}`} className="border-t border-gray-100 align-top dark:border-slate-800">
                                            <td className="px-3 py-3 text-gray-500">{row.rowNumber}</td>
                                            <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">{row.label}</td>
                                            <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{row.equipmentName}</td>
                                            <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.conflicts.includes('capacity') ? 'Bentrok' : row.capacity || '—'}</td>
                                            <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.conflicts.includes('accuracy') ? 'Bentrok' : row.accuracy || '—'}</td>
                                            <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{row.conflicts.includes('method') ? 'Bentrok' : row.method || '—'}</td>
                                            <td className="px-3 py-3">
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
                                                </div>
                                            </td>
                                            <td className="max-w-56 px-3 py-3 text-gray-500 dark:text-gray-400" title={row.sourceNames.join(', ')}>{row.sourceNames.join(', ') || '—'}</td>
                                        </tr>
                                    ))}
                                    {result.previewRows.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Tidak menemukan baris alat pada sheet yang dipilih.</td></tr>
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
