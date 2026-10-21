import * as XLSX from 'xlsx';

export type CertificateField =
    | 'capacity'
    | 'accuracy'
    | 'method'
    | 'owner'
    | 'brand'
    | 'type'
    | 'serialNumber'
    | 'room'
    | 'receivedDate'
    | 'performedDate';
export type IdentityField = 'label' | 'equipmentName';
export type PreviewField = IdentityField | CertificateField;
export type CertificatePreviewStatus =
    | 'No. Label ambigu'
    | 'Beberapa file cocok'
    | 'File sumber sudah dipakai'
    | 'Tidak ditemukan'
    | 'Data sumber bentrok'
    | 'Sudah terisi'
    | 'Cocok, data sumber kosong'
    | 'Perlu cek'
    | `${number} kolom terisi`;

export const CERTIFICATE_MATCHING_VERSION = 4;

export interface CertificateSourceRecord {
    label: string;
    equipmentName: string;
    capacity: string;
    accuracy: string;
    method: string;
    owner: string;
    brand: string;
    type: string;
    serialNumber: string;
    room: string;
    receivedDate: string;
    performedDate: string;
    sourceName: string;
    sourceId: string;
    sourceSheet: string;
}

export interface MasterColumnMap {
    label: number;
    equipmentName: number;
    capacity: number;
    accuracy: number;
    method: number;
    owner?: number;
    brand?: number;
    type?: number;
    serialNumber?: number;
    room?: number;
    issueDate?: number;
    receivedDate?: number;
    performedDate?: number;
}

export interface MasterSheetLayout {
    sheetName: string;
    headerRow: number;
    columns: MasterColumnMap;
    roomColumnInferred?: boolean;
}

export interface CertificatePreviewRow {
    rowNumber: number;
    label: string;
    equipmentName: string;
    sourceLabel: string;
    sourceEquipmentName: string;
    capacity: string;
    accuracy: string;
    method: string;
    owner: string;
    brand: string;
    type: string;
    serialNumber: string;
    room: string;
    receivedDate: string;
    performedDate: string;
    status: CertificatePreviewStatus;
    sourceNames: string[];
    candidateEquipmentNames: string[];
    matchedOn: PreviewField[];
    filledCount: number;
    conflicts: CertificateField[];
    matchedFields: PreviewField[];
    mismatches: PreviewField[];
    editedFields: PreviewField[];
    masterConfirmedFields: PreviewField[];
    sourceValues: CurrentFieldValues;
    matchedByLabelOnly: boolean;
    ambiguousLabelMatch: boolean;
    sourceAlreadyUsed: boolean;
    ambiguousSourceMatch: boolean;
}

export interface CertificateFillResult {
    matchingVersion?: number;
    previewRows: CertificatePreviewRow[];
    matchedRows: number;
    labelOnlyRows: number;
    identityOnlyRows: number;
    ambiguousLabelRows: number;
    ambiguousSourceRows: number;
    reusedSourceRows: number;
    unmatchedRows: number;
    updatedCells: number;
    conflictCount: number;
    matchingCells: number;
    mismatchedCells: number;
    unresolvedMismatchCells: number;
}

interface SourceFileCandidate {
    sourceId: string;
    sourceName: string;
    records: CertificateSourceRecord[];
}

type CommonHeaderField = 'label' | 'equipmentName' | 'capacity' | 'accuracy';

const COMMON_FIELD_HEADERS: Record<CommonHeaderField, string[]> = {
    label: ['nolabel', 'labelno', 'nomorlabel', 'nomorlabelalat'],
    equipmentName: ['namaalat', 'alatnama', 'namaperalatan'],
    capacity: ['kapasitas', 'capacity'],
    accuracy: ['tingkatketelitian', 'ketelitian', 'resolution'],
};

const ROOM_HEADER_ALIASES = [
    'ruangan', 'ruang', 'namaruang', 'namaruangan', 'lokasi', 'lokasiruang',
    'lokasiunit', 'namaunit', 'unitkerja', 'unitpelayanan', 'ruangunit', 'unitruang',
    'ruanganlokasi', 'lokasiruangan', 'ruanginstansi', 'instansi', 'tempatpelaksanaan',
];

const CERTIFICATE_FIELDS: CertificateField[] = [
    'capacity', 'accuracy', 'method', 'owner', 'brand', 'type', 'serialNumber',
    'room', 'receivedDate', 'performedDate',
];

type RequiredMasterField = 'label' | 'equipmentName' | 'capacity' | 'accuracy' | 'method';

const REQUIRED_MASTER_FIELDS: RequiredMasterField[] = [
    'label', 'equipmentName', 'capacity', 'accuracy', 'method',
];

const FIELD_HEADERS: Record<keyof MasterColumnMap, string[]> = {
    ...COMMON_FIELD_HEADERS,
    method: ['mk', 'metodekerja', 'metodekalibrasi', 'method'],
    owner: ['milik', 'pemilik', 'milikpemilik', 'pemilikmilik', 'namamilik', 'namapemilik', 'owner'],
    brand: ['merk', 'merek', 'brand'],
    type: ['tipemodel', 'tipe', 'model', 'type'],
    serialNumber: ['noseri', 'nomorseri', 'nomerseri', 'serialnumber', 'serialno', 'sn'],
    room: ROOM_HEADER_ALIASES,
    issueDate: ['tanggalterbit', 'tglterbit', 'tanggalsertifikat', 'tglsertifikat'],
    receivedDate: ['tanggalpenerimaan', 'tglpenerimaan', 'tanggalditerima', 'tglterima'],
    performedDate: ['tanggalpelaksanaan', 'tglpelaksanaan', 'tanggalpengujian', 'tglpengujian'],
};

type ReportHeaderField = CertificateField | 'label' | 'equipmentName' | 'issueDate';

const REPORT_FIELD_HEADERS: Record<ReportHeaderField, string[]> = {
    ...COMMON_FIELD_HEADERS,
    method: ['metodekerja', 'metodekalibrasi', 'method'],
    owner: ['namapemilik', 'milik', 'pemilik', 'milikpemilik', 'pemilikmilik', 'namamilik', 'owner'],
    brand: ['merk', 'merek', 'brand'],
    type: ['tipe', 'tipemodel', 'model', 'type'],
    serialNumber: ['noseri', 'nomorseri', 'nomerseri', 'serialnumber', 'serialno', 'sn'],
    room: ROOM_HEADER_ALIASES,
    issueDate: ['tanggalterbit', 'tglterbit', 'tanggalsertifikat', 'tglsertifikat'],
    receivedDate: ['tanggalpenerimaan', 'tglpenerimaan', 'tanggalditerima', 'tglterima'],
    performedDate: ['tanggalpelaksanaan', 'tglpelaksanaan', 'tanggalpengujian', 'tglpengujian'],
};

const FIELD_KEYS: ReportHeaderField[] = ['label', 'equipmentName', ...CERTIFICATE_FIELDS, 'issueDate'];

function toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\u00a0/g, ' ').trim();
}

function normalizeText(value: unknown): string {
    return toText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('id-ID')
        .replace(/[^a-z0-9]/g, '');
}

function normalizeIdentifier(value: unknown): string {
    const identifier = toText(value).replace(/([.,]0+)$/, '');
    return normalizeText(identifier);
}

function isPlaceholder(value: unknown): boolean {
    const text = toText(value);
    if (!text) return true;
    const normalized = text.toLocaleLowerCase('id-ID').replace(/\s/g, '');
    return ['-', '—', '–', '―', '#ref!', '#n/a', 'n/a', 'null'].includes(normalized);
}

function isMissingReportValue(value: unknown): boolean {
    if (isPlaceholder(value)) return true;
    // These report templates display 0 when a source field is empty.
    return /^0+(?:[.,]0+)?$/.test(toText(value));
}

function isEmptyMasterValue(value: unknown): boolean {
    return isPlaceholder(value);
}

export function isEmptyCertificateValue(value: unknown): boolean {
    return isEmptyMasterValue(value);
}

function valueKey(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

const MONTH_NUMBERS: Record<string, number> = {
    januari: 1, january: 1, jan: 1,
    februari: 2, pebruari: 2, february: 2, feb: 2,
    maret: 3, march: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, june: 6, jun: 6,
    juli: 7, july: 7, jul: 7,
    agustus: 8, august: 8, agu: 8, aug: 8,
    september: 9, sep: 9,
    oktober: 10, october: 10, okt: 10, oct: 10,
    november: 11, nov: 11,
    desember: 12, december: 12, des: 12, dec: 12,
};

function dateKey(value: string): string | null {
    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('id-ID')
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const yearFirst = normalized.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:$|t|\s)/);
    if (yearFirst) return `${yearFirst[1]}-${yearFirst[2].padStart(2, '0')}-${yearFirst[3].padStart(2, '0')}`;

    const numeric = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;

    const parts = normalized.replace(/[./-]/g, ' ').split(' ').filter(Boolean);
    if (parts.length !== 3) return null;
    const monthIndex = parts.findIndex((part) => MONTH_NUMBERS[part] !== undefined);
    if (monthIndex < 0) return null;
    const day = parts.find((part, index) => index !== monthIndex && /^\d{1,2}$/.test(part));
    const year = parts.find((part) => /^\d{4}$/.test(part));
    if (!day || !year) return null;
    const month = String(MONTH_NUMBERS[parts[monthIndex]]);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function certificateDateKey(value: unknown): string | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = XLSX.SSF.parse_date_code(value) as { y: number; m: number; d: number } | null;
        if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return dateKey(toText(value));
}

export function certificateFieldValuesMatch(field: CertificateField, masterValue: string, sourceValue: string): boolean {
    if (field === 'receivedDate' || field === 'performedDate') {
        const masterDate = dateKey(masterValue);
        const sourceDate = dateKey(sourceValue);
        if (masterDate && sourceDate) return masterDate === sourceDate;
    }
    return valueKey(masterValue) === valueKey(sourceValue);
}

export function previewFieldValuesMatch(field: PreviewField, masterValue: string, sourceValue: string): boolean {
    if (field === 'label' || field === 'equipmentName') {
        return identityValueMatches(field, masterValue, sourceValue);
    }
    return certificateFieldValuesMatch(field, masterValue, sourceValue);
}

function matchesHeader(value: unknown, field: keyof MasterColumnMap): boolean {
    const normalized = normalizeText(value);
    return FIELD_HEADERS[field].includes(normalized);
}

function getRows(sheet: XLSX.WorkSheet): string[][] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
    });
    return rows.map((row) => row.map(toText));
}

function findLayoutInSheet(sheetName: string, sheet: XLSX.WorkSheet): MasterSheetLayout | null {
    const rows = getRows(sheet);
    let best: MasterSheetLayout | null = null;
    let bestScore = -1;

    rows.forEach((row, headerRow) => {
        const columns: Partial<MasterColumnMap> = {};
        let roomColumnInferred = false;
        row.forEach((cell, column) => {
            (Object.keys(FIELD_HEADERS) as Array<keyof MasterColumnMap>).forEach((field) => {
                if (columns[field] === undefined && matchesHeader(cell, field)) columns[field] = column;
            });
        });

        if (columns.label === undefined || columns.equipmentName === undefined) return;
        if (columns.room === undefined) {
            const issueDateColumn = row.findIndex((cell) => matchesHeader(cell, 'issueDate'));
            const rightColumn = issueDateColumn + 1;
            const occupiedColumns = new Set(Object.values(columns));
            if (
                issueDateColumn >= 0
                && rightColumn < row.length
                && !occupiedColumns.has(rightColumn)
                && Boolean(row[rightColumn]?.trim())
            ) {
                // Some MASTER templates use a changing or merged header for
                // Ruangan. In those layouts it sits immediately to the right
                // of Tanggal Terbit. Never infer from the left: that can be Hasil.
                columns.room = rightColumn;
                roomColumnInferred = true;
            }
        }
        const score = Object.keys(columns).length;
        if (score > bestScore) {
            best = {
                sheetName,
                headerRow,
                columns: columns as MasterColumnMap,
                roomColumnInferred,
            };
            bestScore = score;
        }
    });

    return best;
}

export function findMasterLayout(workbook: XLSX.WorkBook, sheetName: string): MasterSheetLayout | null {
    const sheet = workbook.Sheets[sheetName];
    return sheet ? findLayoutInSheet(sheetName, sheet) : null;
}

export function suggestMasterSheet(workbook: XLSX.WorkBook): string {
    const exactMaster = workbook.SheetNames.find((name) => normalizeText(name) === 'mastersertifikat');
    if (exactMaster) return exactMaster;

    const bestMatch = workbook.SheetNames
        .map((sheetName) => ({ sheetName, layout: findMasterLayout(workbook, sheetName) }))
        .filter((item) => item.layout !== null)
        .sort((a, b) => {
            const aPreference = normalizeText(a.sheetName) === 'rekap' ? 1 : 0;
            const bPreference = normalizeText(b.sheetName) === 'rekap' ? 1 : 0;
            return bPreference - aPreference;
        })[0];

    return bestMatch?.sheetName ?? workbook.SheetNames[0] ?? '';
}

function matchesReportField(value: unknown, field: keyof typeof REPORT_FIELD_HEADERS): boolean {
    const normalized = normalizeText(value);
    return REPORT_FIELD_HEADERS[field].includes(normalized);
}

function isFieldLabel(value: unknown): boolean {
    const text = toText(value);
    const separator = text.search(/[:：]/);
    if (separator >= 0) {
        const prefix = normalizeText(text.slice(0, separator));
        if (FIELD_KEYS.some((field) => REPORT_FIELD_HEADERS[field].includes(prefix))) return true;
    }
    return FIELD_KEYS.some((field) => matchesReportField(text, field));
}

const MEASUREMENT_UNITS = new Set([
    '%', 'kg', 'g', 'mg', 'ug', 'µg', 'ton', 'lb', 'lbs', 'oz',
    'm', 'cm', 'mm', 'um', 'µm', 'km', 'inch', 'in',
    'l', 'ml', 'ul', 'µl', '°c', '°f', 'c', 'f',
    'pa', 'kpa', 'mpa', 'bar', 'mbar', 'psi', 'mmhg', 'cmh2o',
    'n', 'kn', 'v', 'mv', 'kv', 'a', 'ma', 'ka', 'w', 'mw', 'kw', 'hz', 'khz',
    'ppm', 'ppb', 'lux', 'lx', 'ohm', 'ω', 'bpm', 'ph', 'rpm', 'digit', 'count',
    'kg/cm2', 'kgf/cm2', 'kgf', 'mm/s', 'm/s', 'm3', 'cm3', 'm2', 'cm2', 'mm2',
]);

function isMeasurementUnit(value: unknown): boolean {
    const unit = toText(value).normalize('NFKC').toLocaleLowerCase('id-ID').replace(/\s+/g, '');
    return MEASUREMENT_UNITS.has(unit);
}

function appendAdjacentMeasurementUnit(row: string[], valueColumn: number, value: string): string {
    if (!value) return value;
    const lastValueToken = value.match(/\S+$/)?.[0];
    if (lastValueToken && isMeasurementUnit(lastValueToken)) return value;
    for (let column = valueColumn + 1; column < Math.min(row.length, valueColumn + 4); column += 1) {
        const candidate = toText(row[column]);
        if (!candidate || /^[:：]+$/.test(candidate)) continue;
        if (isFieldLabel(candidate)) break;
        return isMeasurementUnit(candidate) ? `${value} ${candidate}` : value;
    }
    return value;
}

function getValueBesideLabel(rows: string[][], aliases: string[], includeMeasurementUnit = false): string {
    for (const row of rows) {
        for (let column = 0; column < row.length; column += 1) {
            const labelCell = row[column];
            const normalizedLabel = normalizeText(labelCell);
            const separator = labelCell.search(/[:：]/);
            if (separator >= 0 && aliases.includes(normalizeText(labelCell.slice(0, separator)))) {
                const inlineValue = labelCell.slice(separator + 1).trim();
                if (!isMissingReportValue(inlineValue)) {
                    return includeMeasurementUnit
                        ? appendAdjacentMeasurementUnit(row, column, inlineValue)
                        : inlineValue;
                }
            }
            if (!aliases.includes(normalizedLabel)) continue;

            for (let offset = 1; offset <= 10 && column + offset < row.length; offset += 1) {
                const candidate = row[column + offset];
                if (!candidate || /^[:：]+$/.test(candidate)) continue;
                if (isFieldLabel(candidate)) break;
                if (isMissingReportValue(candidate)) continue;
                return includeMeasurementUnit
                    ? appendAdjacentMeasurementUnit(row, column + offset, candidate)
                    : candidate;
            }
        }
    }
    return '';
}

function extractEquipmentNameFromTitle(rows: string[][]): string {
    for (const row of rows.slice(0, 14)) {
        for (const cell of row) {
            const title = toText(cell).replace(/\s+/g, ' ');
            if (!/laporan\s+hasil/i.test(title) || !/kalibrasi/i.test(title)) continue;
            const match = title.match(/\bkalibrasi\b\s*[:/-]?\s*(.+)$/i);
            if (match?.[1]) return match[1].trim().replace(/[.,;]+$/, '');
        }
    }
    return '';
}

function extractMethodFromRows(rows: string[][]): string {
    const codePattern = /\bMKC-MK-[A-Z0-9]+(?:[-./][A-Z0-9]+)*/i;

    // The method code may appear anywhere in a report sheet, so find its
    // distinctive prefix directly instead of depending on a nearby label.
    for (const row of rows) {
        for (const cell of row) {
            const code = cell.match(codePattern)?.[0];
            if (code) return code.replace(/[.,;:]+$/, '');
        }
    }

    return '';
}

function readTabularField(
    row: string[],
    columns: Partial<MasterColumnMap>,
    field: CertificateField,
): string {
    const column = columns[field];
    if (column === undefined) return '';
    const value = toText(row[column]);
    return field === 'capacity' || field === 'accuracy'
        ? appendAdjacentMeasurementUnit(row, column, value)
        : value;
}

function readMethodCode(value: string): string {
    return value.match(/^\s*(MKC-MK-[A-Z0-9]+(?:[-./][A-Z0-9]+)*)\b/i)?.[1] ?? '';
}

function findTabularRecords(
    rows: string[][],
    sourceName: string,
    sourceId: string,
    sourceSheet: string,
    method: string,
): CertificateSourceRecord[] {
    const records: CertificateSourceRecord[] = [];

    rows.forEach((row, headerRow) => {
        const columns: Partial<MasterColumnMap> = {};
        row.forEach((cell, column) => {
            (Object.keys(FIELD_HEADERS) as Array<keyof MasterColumnMap>).forEach((field) => {
                if (columns[field] === undefined && matchesHeader(cell, field)) columns[field] = column;
            });
        });
        if (columns.label === undefined || columns.equipmentName === undefined) return;

        for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
            const data = rows[rowIndex];
            const label = toText(data[columns.label]);
            const equipmentName = toText(data[columns.equipmentName]);
            if (!label || !equipmentName || isMissingReportValue(label) || isMissingReportValue(equipmentName)) continue;
            records.push({
                label,
                equipmentName,
                capacity: readTabularField(data, columns, 'capacity'),
                accuracy: readTabularField(data, columns, 'accuracy'),
                method: readMethodCode(readTabularField(data, columns, 'method')) || method,
                owner: readTabularField(data, columns, 'owner'),
                brand: readTabularField(data, columns, 'brand'),
                type: readTabularField(data, columns, 'type'),
                serialNumber: readTabularField(data, columns, 'serialNumber'),
                room: readTabularField(data, columns, 'room'),
                receivedDate: readTabularField(data, columns, 'receivedDate'),
                performedDate: readTabularField(data, columns, 'performedDate'),
                sourceName,
                sourceId,
                sourceSheet,
            });
        }
    });

    return records;
}

function isReportSheet(sheetName: string): boolean {
    const normalized = normalizeText(sheetName);
    return normalized.startsWith('laporanhasil') || normalized.startsWith('laphasil');
}

export function readSourceReportWorkbook(workbook: XLSX.WorkBook, sourceName: string, sourceId = sourceName): CertificateSourceRecord[] {
    const records: CertificateSourceRecord[] = [];
    const reportSheets = workbook.SheetNames.filter(isReportSheet);

    reportSheets.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const rows = getRows(sheet);
        const method = extractMethodFromRows(rows);
        const tableRecords = findTabularRecords(rows, sourceName, sourceId, sheetName, method);
        records.push(...tableRecords);

        const label = getValueBesideLabel(rows, REPORT_FIELD_HEADERS.label);
        // The main equipment name is in the report title. A later measurement
        // table can also contain a "Nama Alat" header for calibration standards
        // (where the adjacent value may be "Merk"), so use that field only as
        // a fallback when the title does not identify the equipment.
        const equipmentName = extractEquipmentNameFromTitle(rows)
            || getValueBesideLabel(rows, REPORT_FIELD_HEADERS.equipmentName);

        if (!label || !equipmentName) return;
        records.push({
            label,
            equipmentName,
            capacity: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.capacity, true),
            accuracy: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.accuracy, true),
            method,
            owner: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.owner),
            brand: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.brand),
            type: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.type),
            serialNumber: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.serialNumber),
            room: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.room),
            receivedDate: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.receivedDate),
            performedDate: getValueBesideLabel(rows, REPORT_FIELD_HEADERS.performedDate),
            sourceName,
            sourceId,
            sourceSheet: sheetName,
        });
    });

    return records.filter((record) => record.label && record.equipmentName && !isMissingReportValue(record.label));
}

function getCellDisplay(sheet: XLSX.WorkSheet, row: number, column: number, fallback: unknown): string {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    const cell = sheet[address] as XLSX.CellObject | undefined;
    if (cell?.w !== undefined && cell.w !== '') return toText(cell.w);
    return toText(fallback);
}

function valuesForField(records: CertificateSourceRecord[], field: CertificateField): string[] {
    return records
        .map((record) => record[field])
        .filter((value) => !isMissingReportValue(value));
}

function resolveField(records: CertificateSourceRecord[], field: CertificateField): { value: string; conflict: boolean } {
    const values = valuesForField(records, field);
    const unique = new Map<string, string>();
    values.forEach((value) => {
        const key = valueKey(value);
        if (!unique.has(key)) unique.set(key, value.trim());
    });

    if (unique.size > 1) return { value: '', conflict: true };
    return { value: unique.values().next().value ?? '', conflict: false };
}

type MatchKind = 'exact' | 'label-only' | 'identity-only' | 'ambiguous-label' | 'ambiguous-source' | 'reused-source' | 'unmatched';

interface SourceIndexes {
    files: SourceFileCandidate[];
}

interface SourceMatchResolution {
    kind: MatchKind;
    exactCandidates: SourceFileCandidate[];
    labelCandidates: SourceFileCandidate[];
    ambiguousCandidates: SourceFileCandidate[];
    chosenCandidate: SourceFileCandidate | null;
    matchedRecords: CertificateSourceRecord[];
    sourceLabel: string;
    sourceEquipmentName: string;
    matchedOn: PreviewField[];
    candidateEquipmentNames: string[];
}

type CurrentFieldValues = Record<CertificateField, string>;

interface FieldWriteResult {
    nextValues: CurrentFieldValues;
    filledCount: number;
    conflicts: CertificateField[];
    matchedFields: PreviewField[];
    mismatches: PreviewField[];
    sourceValues: CurrentFieldValues;
}

function buildSourceIndexes(sourceRecords: CertificateSourceRecord[]): SourceIndexes {
    const recordsBySourceId = new Map<string, CertificateSourceRecord[]>();
    sourceRecords.forEach((record) => {
        const sourceId = record.sourceId || record.sourceName;
        const records = recordsBySourceId.get(sourceId);
        if (records) records.push(record);
        else recordsBySourceId.set(sourceId, [record]);
    });

    const files = [...recordsBySourceId.entries()].map(([sourceId, records]) => ({
        sourceId,
        sourceName: records[0]?.sourceName ?? sourceId,
        records,
    }));
    return { files };
}

interface RankedSourceCandidate {
    candidate: SourceFileCandidate;
    record: CertificateSourceRecord;
    score: number;
    matchedFields: PreviewField[];
}

const IDENTITY_MATCH_WEIGHTS: Partial<Record<PreviewField, number>> = {
    label: 8,
    equipmentName: 4,
    brand: 1,
    type: 2,
    serialNumber: 6,
};

function identityValueMatches(field: PreviewField, masterValue: string, sourceValue: string): boolean {
    if (!masterValue || !sourceValue || isMissingReportValue(masterValue) || isMissingReportValue(sourceValue)) return false;
    if (field === 'label' || field === 'serialNumber') {
        return normalizeIdentifier(masterValue) === normalizeIdentifier(sourceValue);
    }
    return normalizeText(masterValue) === normalizeText(sourceValue);
}

function rankSourceCandidate(
    candidate: SourceFileCandidate,
    master: Pick<CertificateSourceRecord, 'label' | 'equipmentName' | 'brand' | 'type' | 'serialNumber'>,
): RankedSourceCandidate | null {
    let best: RankedSourceCandidate | null = null;
    candidate.records.forEach((record) => {
        const matchedFields = (['label', 'equipmentName', 'brand', 'type', 'serialNumber'] as const)
            .filter((field) => identityValueMatches(field, master[field], record[field]));
        const score = matchedFields.reduce((sum, field) => sum + (IDENTITY_MATCH_WEIGHTS[field] ?? 0), 0);
        if (score > (best?.score ?? 0)) best = { candidate, record, score, matchedFields };
    });
    return best;
}

function hasEnoughIdentityEvidence(match: RankedSourceCandidate, labelCandidateCount: number): boolean {
    const matched = new Set(match.matchedFields);
    if (matched.has('label')) {
        return labelCandidateCount === 1
            || matched.has('equipmentName')
            || matched.has('serialNumber')
            || (matched.has('brand') && matched.has('type'));
    }
    return matched.has('serialNumber')
        || (matched.has('equipmentName') && (matched.has('brand') || matched.has('type')))
        || (matched.has('brand') && matched.has('type'));
}

function resolveSourceMatch(
    label: string,
    equipmentName: string,
    masterIdentity: Pick<CertificateSourceRecord, 'brand' | 'type' | 'serialNumber'>,
    indexes: SourceIndexes,
    usedSourceIds: Set<string>,
): SourceMatchResolution {
    const master = { label, equipmentName, ...masterIdentity };
    const ranked = indexes.files
        .map((candidate) => rankSourceCandidate(candidate, master))
        .filter((match): match is RankedSourceCandidate => Boolean(match));
    const rankedByScore = [...ranked].sort((left, right) => right.score - left.score);
    const exactCandidates = ranked
        .filter((match) => match.matchedFields.includes('label') && match.matchedFields.includes('equipmentName'))
        .map((match) => match.candidate);
    const labelCandidates = ranked
        .filter((match) => match.matchedFields.includes('label'))
        .map((match) => match.candidate);
    const candidateEquipmentNames = [...new Set(labelCandidates.flatMap((candidate) =>
        candidate.records
            .filter((record) => identityValueMatches('label', label, record.label))
            .map((record) => record.equipmentName.trim())
            .filter(Boolean),
    ))];
    const available = rankedByScore.filter((match) => !usedSourceIds.has(match.candidate.sourceId));
    const topScore = available[0]?.score ?? 0;
    const topMatches = available.filter((match) => match.score === topScore);
    const displayedTopMatches = available.length > 0
        ? topMatches
        : rankedByScore.filter((match) => match.score === rankedByScore[0]?.score);
    const best = topMatches.length === 1 ? topMatches[0] : null;
    const sourceAlreadyUsed = ranked.length > 0 && available.length === 0;
    const tiedCandidates = topMatches.length > 1;
    const enoughEvidence = Boolean(best && hasEnoughIdentityEvidence(best, labelCandidates.length));
    const ambiguousLabel = labelCandidates.length > 1 && (tiedCandidates || !enoughEvidence);
    const ambiguousSource = tiedCandidates && !ambiguousLabel;
    const chosenCandidate = !tiedCandidates && enoughEvidence && !sourceAlreadyUsed ? best?.candidate ?? null : null;
    const matchedRecords = chosenCandidate && best
        ? chosenCandidate.records.filter((record) => {
            const sameLabelAndName = identityValueMatches('label', best.record.label, record.label)
                && identityValueMatches('equipmentName', best.record.equipmentName, record.equipmentName);
            const sameSerial = identityValueMatches('serialNumber', best.record.serialNumber, record.serialNumber);
            const sameNameAndType = identityValueMatches('equipmentName', best.record.equipmentName, record.equipmentName)
                && identityValueMatches('type', best.record.type, record.type)
                && (!best.record.brand || !record.brand || identityValueMatches('brand', best.record.brand, record.brand));
            return sameLabelAndName || sameSerial || sameNameAndType;
        })
        : [];

    let kind: MatchKind = 'unmatched';
    if (ambiguousLabel) kind = 'ambiguous-label';
    else if (ambiguousSource) kind = 'ambiguous-source';
    else if (sourceAlreadyUsed) kind = 'reused-source';
    else if (chosenCandidate && best?.matchedFields.includes('label') && best.matchedFields.includes('equipmentName')) kind = 'exact';
    else if (chosenCandidate && best?.matchedFields.includes('label')) kind = 'label-only';
    else if (chosenCandidate) kind = 'identity-only';

    return {
        kind,
        exactCandidates,
        labelCandidates,
        ambiguousCandidates: (ambiguousLabel
            ? ranked.filter((match) => match.matchedFields.includes('label'))
            : displayedTopMatches).map((match) => match.candidate),
        chosenCandidate: chosenCandidate && matchedRecords.length > 0
            ? { ...chosenCandidate, records: matchedRecords }
            : chosenCandidate,
        matchedRecords,
        sourceLabel: chosenCandidate ? best?.record.label ?? '' : '',
        sourceEquipmentName: chosenCandidate ? best?.record.equipmentName ?? '' : '',
        matchedOn: chosenCandidate ? best?.matchedFields ?? [] : [],
        candidateEquipmentNames,
    };
}

function readCurrentFieldValues(
    sheet: XLSX.WorkSheet,
    rowIndex: number,
    columns: MasterColumnMap,
    row: string[],
): CurrentFieldValues {
    const values = {} as CurrentFieldValues;
    CERTIFICATE_FIELDS.forEach((field) => {
        const column = columns[field];
        values[field] = column === undefined ? '' : getCellDisplay(sheet, rowIndex, column, row[column]);
    });
    return values;
}

function writeMissingFieldValues(
    sheet: XLSX.WorkSheet,
    rowIndex: number,
    columns: MasterColumnMap,
    currentValues: CurrentFieldValues,
    records: CertificateSourceRecord[],
): FieldWriteResult {
    const resolved = Object.fromEntries(
        CERTIFICATE_FIELDS.map((field) => [field, resolveField(records, field)]),
    ) as Record<CertificateField, { value: string; conflict: boolean }>;
    const conflicts = CERTIFICATE_FIELDS
        .filter((field) => columns[field] !== undefined && resolved[field].conflict);
    const nextValues = { ...currentValues };
    const sourceValues = {} as CurrentFieldValues;
    const matchedFields: CertificateField[] = [];
    const mismatches: CertificateField[] = [];
    let filledCount = 0;

    CERTIFICATE_FIELDS.forEach((field) => {
        const value = resolved[field].value;
        const column = columns[field];
        sourceValues[field] = column !== undefined && !resolved[field].conflict ? value : '';
        if (column === undefined || !records.length || !value) return;
        if (!isEmptyMasterValue(currentValues[field])) {
            if (certificateFieldValuesMatch(field, currentValues[field], value)) matchedFields.push(field);
            else mismatches.push(field);
            return;
        }
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: column });
        const existingCell = sheet[address] as XLSX.CellObject | undefined;
        if (existingCell?.f) return;
        sheet[address] = { ...(existingCell ?? {}), t: 's', v: value };
        nextValues[field] = value;
        filledCount += 1;
        matchedFields.push(field);
    });

    return { nextValues, filledCount, conflicts, matchedFields, mismatches, sourceValues };
}

function compareIdentityValues(
    label: string,
    equipmentName: string,
    sourceLabel: string,
    sourceEquipmentName: string,
): Pick<FieldWriteResult, 'matchedFields' | 'mismatches'> {
    const matchedFields: PreviewField[] = [];
    const mismatches: PreviewField[] = [];
    (['label', 'equipmentName'] as IdentityField[]).forEach((field) => {
        const masterValue = field === 'label' ? label : equipmentName;
        const sourceValue = field === 'label' ? sourceLabel : sourceEquipmentName;
        if (!masterValue || isMissingReportValue(masterValue) || !sourceValue || isMissingReportValue(sourceValue)) return;
        if (identityValueMatches(field, masterValue, sourceValue)) matchedFields.push(field);
        else mismatches.push(field);
    });
    return { matchedFields, mismatches };
}

function getPreviewStatus(
    matchKind: MatchKind,
    records: CertificateSourceRecord[],
    filledCount: number,
    conflicts: CertificateField[],
    currentValues: CurrentFieldValues,
    mappedFields: CertificateField[],
): CertificatePreviewStatus {
    if (matchKind === 'ambiguous-label') return 'No. Label ambigu';
    if (matchKind === 'ambiguous-source') return 'Beberapa file cocok';
    if (matchKind === 'reused-source') return 'File sumber sudah dipakai';
    if (!records.length) return 'Tidak ditemukan';
    if (filledCount > 0) return `${filledCount} kolom terisi` as CertificatePreviewStatus;
    if (conflicts.length > 0) return 'Data sumber bentrok';
    if (mappedFields.every((field) => !isEmptyMasterValue(currentValues[field]))) return 'Sudah terisi';
    return 'Cocok, data sumber kosong';
}

function candidatesForPreview(match: SourceMatchResolution): SourceFileCandidate[] {
    if (match.kind === 'ambiguous-label' || match.kind === 'ambiguous-source') return match.ambiguousCandidates;
    if (match.kind === 'reused-source') {
        if (match.ambiguousCandidates.length > 0) return match.ambiguousCandidates;
        return match.exactCandidates.length > 0 ? match.exactCandidates : match.labelCandidates;
    }
    return match.chosenCandidate ? [match.chosenCandidate] : [];
}

export function fillMasterWorkbook(
    workbook: XLSX.WorkBook,
    sheetName: string,
    sourceRecords: CertificateSourceRecord[],
): CertificateFillResult {
    const layout = findMasterLayout(workbook, sheetName);
    if (!layout) {
        throw new Error(`Sheet "${sheetName}" harus memiliki header No. Label, Nama Alat, Kapasitas, Tingkat Ketelitian, dan MK.`);
    }

    const missingHeaders = REQUIRED_MASTER_FIELDS
        .filter((field) => layout.columns[field] === undefined)
        .map((field) => ({
            label: 'No. Label',
            equipmentName: 'Nama Alat',
            capacity: 'Kapasitas',
            accuracy: 'Tingkat Ketelitian',
            method: 'MK',
        })[field]);
    if (missingHeaders.length > 0) {
        throw new Error(`Kolom ini tidak ditemukan di sheet "${sheetName}": ${missingHeaders.join(', ')}.`);
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = getRows(sheet);
    const sourceIndexes = buildSourceIndexes(sourceRecords);
    const previewRows: CertificatePreviewRow[] = [];
    const usedSourceIds = new Set<string>();
    const counters = {
        matchedRows: 0,
        labelOnlyRows: 0,
        identityOnlyRows: 0,
        ambiguousLabelRows: 0,
        ambiguousSourceRows: 0,
        reusedSourceRows: 0,
        unmatchedRows: 0,
        updatedCells: 0,
        conflictCount: 0,
        matchingCells: 0,
        mismatchedCells: 0,
        unresolvedMismatchCells: 0,
    };

    rows.slice(layout.headerRow + 1).forEach((row, offset) => {
        const rowIndex = layout.headerRow + 1 + offset;
        const label = toText(row[layout.columns.label]);
        const equipmentName = toText(row[layout.columns.equipmentName]);
        const masterIdentity = {
            brand: layout.columns.brand === undefined ? '' : toText(row[layout.columns.brand]),
            type: layout.columns.type === undefined ? '' : toText(row[layout.columns.type]),
            serialNumber: layout.columns.serialNumber === undefined ? '' : toText(row[layout.columns.serialNumber]),
        };
        if ([label, equipmentName, masterIdentity.brand, masterIdentity.type, masterIdentity.serialNumber]
            .every((value) => !value || isMissingReportValue(value))) return;

        const match = resolveSourceMatch(
            label,
            equipmentName,
            masterIdentity,
            sourceIndexes,
            usedSourceIds,
        );
        if (match.chosenCandidate) usedSourceIds.add(match.chosenCandidate.sourceId);

        if (match.kind === 'exact') counters.matchedRows += 1;
        else if (match.kind === 'label-only') counters.labelOnlyRows += 1;
        else if (match.kind === 'identity-only') counters.identityOnlyRows += 1;
        else if (match.kind === 'ambiguous-label') counters.ambiguousLabelRows += 1;
        else if (match.kind === 'ambiguous-source') counters.ambiguousSourceRows += 1;
        else if (match.kind === 'reused-source') counters.reusedSourceRows += 1;
        else counters.unmatchedRows += 1;

        const matchedRecords = match.matchedRecords;
        const currentValues = readCurrentFieldValues(sheet, rowIndex, layout.columns, row);
        const mappedFields = CERTIFICATE_FIELDS.filter((field) => layout.columns[field] !== undefined);
        const fieldWriteResult = writeMissingFieldValues(
            sheet,
            rowIndex,
            layout.columns,
            currentValues,
            matchedRecords,
        );
        const identityComparison = compareIdentityValues(
            label,
            equipmentName,
            match.sourceLabel,
            match.sourceEquipmentName,
        );
        const writeResult = {
            ...fieldWriteResult,
            matchedFields: [...identityComparison.matchedFields, ...fieldWriteResult.matchedFields],
            mismatches: [...identityComparison.mismatches, ...fieldWriteResult.mismatches],
        };
        counters.updatedCells += writeResult.filledCount;
        counters.conflictCount += writeResult.conflicts.length;
        counters.matchingCells += writeResult.matchedFields.length;
        counters.mismatchedCells += writeResult.mismatches.length;
        counters.unresolvedMismatchCells += writeResult.mismatches.length;

        const displayedCandidates = candidatesForPreview(match);
        previewRows.push({
            rowNumber: rowIndex + 1,
            label,
            equipmentName,
            sourceLabel: match.sourceLabel,
            sourceEquipmentName: match.sourceEquipmentName,
            capacity: writeResult.nextValues.capacity,
            accuracy: writeResult.nextValues.accuracy,
            method: writeResult.nextValues.method,
            owner: writeResult.nextValues.owner,
            brand: writeResult.nextValues.brand,
            type: writeResult.nextValues.type,
            serialNumber: writeResult.nextValues.serialNumber,
            room: writeResult.nextValues.room,
            receivedDate: writeResult.nextValues.receivedDate,
            performedDate: writeResult.nextValues.performedDate,
            status: getPreviewStatus(
                match.kind,
                matchedRecords,
                writeResult.filledCount,
                writeResult.conflicts,
                currentValues,
                mappedFields,
            ),
            sourceNames: [...new Set(displayedCandidates.map((candidate) => candidate.sourceName))],
            candidateEquipmentNames: match.kind === 'ambiguous-label' ? match.candidateEquipmentNames : [],
            matchedOn: match.matchedOn,
            filledCount: writeResult.filledCount,
            conflicts: writeResult.conflicts,
            matchedFields: writeResult.matchedFields,
            mismatches: writeResult.mismatches,
            editedFields: [],
            masterConfirmedFields: [],
            sourceValues: writeResult.sourceValues,
            matchedByLabelOnly: match.kind === 'label-only' && match.matchedOn.length === 1,
            ambiguousLabelMatch: match.kind === 'ambiguous-label',
            sourceAlreadyUsed: match.kind === 'reused-source',
            ambiguousSourceMatch: match.kind === 'ambiguous-source',
        });
    });

    return { matchingVersion: CERTIFICATE_MATCHING_VERSION, previewRows, ...counters };
}
