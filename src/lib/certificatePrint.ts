import * as XLSX from 'xlsx';

export type CertificateField =
    | 'certificateNumber'
    | 'orderNumber'
    | 'label'
    | 'equipment'
    | 'brand'
    | 'model'
    | 'serialNumber'
    | 'capacity'
    | 'resolution'
    | 'owner'
    | 'address1'
    | 'address2'
    | 'receivedDate'
    | 'testedDate'
    | 'technician'
    | 'method'
    | 'result'
    | 'issueDate';

export interface CertificateRecord {
    id: string;
    number: string;
    fields: Record<CertificateField, string>;
}

export interface CertificateWorkbookData {
    records: CertificateRecord[];
    defaultPageTotal: number;
}

const fieldDefinitions: Array<{
    field: CertificateField;
    aliases: string[];
    fallbackIndex: number;
}> = [
    { field: 'certificateNumber', aliases: ['no sertifikat', 'nomor sertifikat', 'certificate number'], fallbackIndex: 1 },
    { field: 'orderNumber', aliases: ['no order', 'nomor order', 'no pesanan'], fallbackIndex: 2 },
    { field: 'label', aliases: ['no label', 'nomor label', 'label'], fallbackIndex: 3 },
    { field: 'equipment', aliases: ['nama alat', 'alat', 'name of equipment'], fallbackIndex: 4 },
    { field: 'brand', aliases: ['merk', 'merek', 'manufacture'], fallbackIndex: 5 },
    { field: 'model', aliases: ['tipe', 'tipe model', 'tipe/model', 'model', 'type model'], fallbackIndex: 6 },
    { field: 'serialNumber', aliases: ['no seri', 'nomor seri', 'serial number'], fallbackIndex: 7 },
    { field: 'capacity', aliases: ['kapasitas', 'capacity'], fallbackIndex: 8 },
    { field: 'resolution', aliases: ['tingkat ketelitian', 'ketelitian', 'resolution'], fallbackIndex: 9 },
    { field: 'owner', aliases: ['nama pemilik', 'milik', 'pemilik', 'owner'], fallbackIndex: 10 },
    { field: 'address1', aliases: ['alamat 1', 'alamat', 'address 1', 'address'], fallbackIndex: 11 },
    { field: 'address2', aliases: ['alamat 2', 'address 2'], fallbackIndex: 12 },
    { field: 'receivedDate', aliases: ['tanggal penerimaan', 'receipt date'], fallbackIndex: 13 },
    { field: 'testedDate', aliases: ['tanggal pelaksanaan', 'tanggal pengujian', 'testing date'], fallbackIndex: 14 },
    { field: 'technician', aliases: ['teknisi pelaksana', 'teknisi', 'executive technician'], fallbackIndex: 15 },
    { field: 'method', aliases: ['mk', 'metode kalibrasi', 'metode kerja', 'calibration method'], fallbackIndex: 16 },
    { field: 'result', aliases: ['hasil', 'hasil pengujian', 'result of testing'], fallbackIndex: 17 },
    { field: 'issueDate', aliases: ['tanggal terbit', 'date of issue'], fallbackIndex: 18 },
];

function normalizeHeader(value: unknown): string {
    return String(value ?? '')
        .toLocaleLowerCase('id-ID')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function readCell(sheet: XLSX.WorkSheet, address: string): string {
    const cell = sheet[address];
    return cell ? String(cell.w ?? cell.v ?? '').trim() : '';
}

function getPageTotal(sheet: XLSX.WorkSheet): number {
    for (const candidate of [readCell(sheet, 'M48'), readCell(sheet, 'M49')]) {
        const parsed = Number(candidate.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= 1) return Math.floor(parsed);
    }
    return 1;
}

export function parseCertificateWorkbook(workbook: XLSX.WorkBook): CertificateWorkbookData {
    const rekapName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'rekap');
    const certificateName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'sertifikat');
    if (!rekapName || !certificateName) {
        throw new Error('File harus memiliki sheet REKAP dan Sertifikat.');
    }

    const rekap = workbook.Sheets[rekapName];
    const certificate = workbook.Sheets[certificateName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(rekap, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
    });
    const headerRowIndex = rows.findIndex((row) => {
        const headers = row.map(normalizeHeader);
        return headers.some((header) => ['no label', 'nomor label', 'label'].includes(header))
            && headers.some((header) => ['nama alat', 'name of equipment', 'alat'].includes(header));
    });
    if (headerRowIndex < 0) {
        throw new Error('Kolom No. Label dan Nama Alat tidak ditemukan di sheet REKAP.');
    }

    const headers = rows[headerRowIndex].map(normalizeHeader);
    const getIndex = (aliases: string[], fallbackIndex: number) => {
        const normalizedAliases = aliases.map(normalizeHeader);
        const index = headers.findIndex((header) => normalizedAliases.includes(header));
        return index >= 0 ? index : fallbackIndex;
    };
    const labelIndex = getIndex(['no label', 'nomor label', 'label'], 3);
    const equipmentIndex = getIndex(['nama alat', 'alat', 'name of equipment'], 4);
    const numberIndex = headers.findIndex((header) => header === 'no' || header === 'nomor');

    const records = rows.slice(headerRowIndex + 1)
        .map((row, rowOffset) => {
            const label = String(row[labelIndex] ?? '').trim();
            const equipment = String(row[equipmentIndex] ?? '').trim();
            if (!label && !equipment) return null;

            const fields = Object.fromEntries(fieldDefinitions.map(({ field, aliases, fallbackIndex }) => {
                const index = getIndex(aliases, fallbackIndex);
                return [field, String(row[index] ?? '').trim()];
            })) as Record<CertificateField, string>;
            const number = numberIndex >= 0 ? String(row[numberIndex] ?? '').trim() : String(rowOffset + 1);
            const id = `${rowOffset}-${number || fields.label || equipment}`;
            return { id, number: number || String(rowOffset + 1), fields };
        })
        .filter((record): record is CertificateRecord => record !== null);

    if (records.length === 0) {
        throw new Error('Tidak ada data alat yang bisa dicetak di sheet REKAP.');
    }

    return { records, defaultPageTotal: getPageTotal(certificate) };
}
