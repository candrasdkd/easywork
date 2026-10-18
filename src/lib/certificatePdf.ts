import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { CertificateRecord } from './certificatePrint';

interface WorkbookFile {
    content: Uint8Array;
}

type WorkbookWithFiles = XLSX.WorkBook & {
    files?: Record<string, WorkbookFile | undefined>;
};

interface CellBorder {
    style: string;
    color: string;
}

interface CellStyle {
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    fill: string;
    alignment: {
        horizontal: string;
        vertical: string;
        wrap: boolean;
        indent: number;
        textRotation: number;
    };
    borders: Record<'left' | 'right' | 'top' | 'bottom', CellBorder | null>;
}

interface PrintSettings {
    widthMm: number;
    heightMm: number;
    margins: { left: number; right: number; top: number; bottom: number };
    scale: number;
}

interface CertificateSheetView {
    page: HTMLDivElement;
    cells: Map<string, HTMLTableCellElement>;
    printSettings: PrintSettings;
}

const relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function directChildren(element: Element | null, name: string): Element[] {
    if (!element) return [];
    return Array.from(element.children).filter((child) => child.localName === name);
}

function firstChild(element: Element | null, name: string): Element | null {
    return directChildren(element, name)[0] ?? null;
}

function descendants(element: Document | Element, name: string): Element[] {
    return Array.from(element.getElementsByTagNameNS('*', name));
}

function parseXml(source: string, label: string): Document {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (document.getElementsByTagName('parsererror').length > 0) {
        throw new Error(`Struktur ${label} di file Excel tidak dapat dibaca.`);
    }
    return document;
}

function getWorkbookFile(workbook: XLSX.WorkBook, path: string): Uint8Array {
    const file = (workbook as WorkbookWithFiles).files?.[path];
    if (!file?.content) throw new Error(`Komponen ${path} tidak ditemukan di file Excel.`);
    return file.content;
}

function readWorkbookXml(workbook: XLSX.WorkBook, path: string, label: string): Document {
    return parseXml(new TextDecoder().decode(getWorkbookFile(workbook, path)), label);
}

function normalizeArchivePath(path: string): string {
    const parts: string[] = [];
    for (const part of path.replace(/^\//, '').split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
    }
    return parts.join('/');
}

function findWorksheetXmlPath(workbook: XLSX.WorkBook, sheetName: string): string {
    const workbookXml = readWorkbookXml(workbook, 'xl/workbook.xml', 'daftar sheet');
    const sheet = descendants(workbookXml, 'sheet').find((item) => item.getAttribute('name') === sheetName);
    const relationId = sheet?.getAttributeNS(relationshipNamespace, 'id') ?? sheet?.getAttribute('r:id');
    if (!relationId) throw new Error(`Sheet ${sheetName} tidak ditemukan di file Excel.`);

    const relationships = readWorkbookXml(workbook, 'xl/_rels/workbook.xml.rels', 'relasi sheet');
    const relationship = descendants(relationships, 'Relationship').find((item) => item.getAttribute('Id') === relationId);
    const target = relationship?.getAttribute('Target');
    if (!target) throw new Error(`Lokasi sheet ${sheetName} tidak ditemukan di file Excel.`);
    return target.startsWith('/') ? normalizeArchivePath(target) : normalizeArchivePath(`xl/${target}`);
}

function getSheetRange(workbook: XLSX.WorkBook, sheetName: string, sheet: XLSX.WorkSheet): XLSX.Range {
    const names = workbook.Workbook?.Names ?? [];
    const sheetIndex = workbook.SheetNames.indexOf(sheetName);
    const printArea = names.find((item) => item.Name.toLocaleLowerCase('en-US') === '_xlnm.print_area'
        && (item.Sheet === undefined || item.Sheet === sheetIndex));
    const reference = printArea?.Ref?.split(',')[0]?.replace(/^.*!/, '').replace(/\$/g, '');
    if (reference) {
        try {
            return XLSX.utils.decode_range(reference);
        } catch {
            // Fall through to the used range when a workbook contains an invalid print area.
        }
    }
    return sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : XLSX.utils.decode_range('A1');
}

function resolveColor(color: Element | null, themeColors: Map<string, string>): string | null {
    if (!color) return null;
    const rgb = color.getAttribute('rgb');
    const theme = color.getAttribute('theme');
    const indexed = color.getAttribute('indexed');
    let resolved = rgb ? `#${rgb.slice(-6)}` : theme !== null ? themeColors.get(theme) ?? null : null;
    if (!resolved && indexed !== null) {
        const indexedColors: Record<string, string> = {
            '0': '#000000', '1': '#FFFFFF', '2': '#FF0000', '3': '#00FF00',
            '4': '#0000FF', '5': '#FFFF00', '6': '#FF00FF', '7': '#00FFFF',
            '8': '#000000', '9': '#FFFFFF', '10': '#FF0000', '11': '#00FF00',
            '12': '#0000FF', '13': '#FFFF00', '14': '#FF00FF', '15': '#00FFFF',
        };
        resolved = indexedColors[indexed] ?? null;
    }
    if (!resolved || !/^#[\da-f]{6}$/i.test(resolved)) return resolved;

    const tint = Number(color.getAttribute('tint') ?? 0);
    if (!Number.isFinite(tint) || tint === 0) return resolved;
    const channels = resolved.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16)) ?? [];
    const adjusted = channels.map((channel) => {
        const value = tint < 0 ? channel * (1 + tint) : channel * (1 - tint) + 255 * tint;
        return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
    });
    return `#${adjusted.join('')}`;
}

function readThemeColors(workbook: XLSX.WorkBook): Map<string, string> {
    const themePath = 'xl/theme/theme1.xml';
    const workbookFiles = (workbook as WorkbookWithFiles).files;
    if (!workbookFiles?.[themePath]) return new Map();
    const themeXml = readWorkbookXml(workbook, themePath, 'warna tema');
    const colorScheme = descendants(themeXml, 'clrScheme')[0];
    const colors = new Map<string, string>();
    const colorOrder = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
    for (const colorName of colorOrder) {
        const slot = firstChild(colorScheme ?? null, colorName);
        const color = slot ? firstChild(slot, 'srgbClr') ?? firstChild(slot, 'sysClr') : null;
        const value = color?.getAttribute('val') ?? color?.getAttribute('lastClr');
        if (value) colors.set(String(colorOrder.indexOf(colorName)), `#${value.slice(-6)}`);
    }
    return colors;
}

function cssColorAttribute(element: Element | null, themeColors: Map<string, string>): string | null {
    return resolveColor(element, themeColors);
}

function readStyles(workbook: XLSX.WorkBook): CellStyle[] {
    const stylesXml = readWorkbookXml(workbook, 'xl/styles.xml', 'format cell');
    const themeColors = readThemeColors(workbook);
    const root = stylesXml.documentElement;
    const fonts = directChildren(firstChild(root, 'fonts'), 'font');
    const fills = directChildren(firstChild(root, 'fills'), 'fill');
    const borders = directChildren(firstChild(root, 'borders'), 'border');
    const cellFormats = directChildren(firstChild(root, 'cellXfs'), 'xf');

    const parsedFonts = fonts.map((font) => {
        const name = firstChild(font, 'name')?.getAttribute('val') ?? 'Calibri';
        return {
            family: name.replace(/^['"]|['"]$/g, '').replace(/[^\w ,.-]/g, '') || 'Calibri',
            size: Number(firstChild(font, 'sz')?.getAttribute('val') ?? 11),
            color: cssColorAttribute(firstChild(font, 'color'), themeColors) ?? '#000000',
            bold: Boolean(firstChild(font, 'b')),
            italic: Boolean(firstChild(font, 'i')),
            underline: Boolean(firstChild(font, 'u')),
            strike: Boolean(firstChild(font, 'strike')),
        };
    });

    const parsedFills = fills.map((fill) => {
        const patternFill = firstChild(fill, 'patternFill');
        if (patternFill?.getAttribute('patternType') !== 'solid') return 'transparent';
        return cssColorAttribute(firstChild(patternFill, 'fgColor'), themeColors) ?? 'transparent';
    });

    const parsedBorders = borders.map((border) => {
        const sides = {} as Record<'left' | 'right' | 'top' | 'bottom', CellBorder | null>;
        for (const side of ['left', 'right', 'top', 'bottom'] as const) {
            const sideNode = firstChild(border, side);
            const style = sideNode?.getAttribute('style') ?? '';
            sides[side] = style ? {
                style,
                color: cssColorAttribute(firstChild(sideNode, 'color'), themeColors) ?? '#000000',
            } : null;
        }
        return sides;
    });

    return cellFormats.map((format) => {
        const font = parsedFonts[Number(format.getAttribute('fontId') ?? 0)] ?? parsedFonts[0];
        const fill = parsedFills[Number(format.getAttribute('fillId') ?? 0)] ?? 'transparent';
        const border = parsedBorders[Number(format.getAttribute('borderId') ?? 0)] ?? parsedBorders[0];
        const alignment = firstChild(format, 'alignment');
        return {
            fontFamily: font?.family ?? 'Calibri',
            fontSize: font?.size ?? 11,
            fontColor: font?.color ?? '#000000',
            bold: font?.bold ?? false,
            italic: font?.italic ?? false,
            underline: font?.underline ?? false,
            strike: font?.strike ?? false,
            fill,
            alignment: {
                horizontal: alignment?.getAttribute('horizontal') ?? 'general',
                vertical: alignment?.getAttribute('vertical') ?? 'bottom',
                wrap: alignment?.getAttribute('wrapText') === '1',
                indent: Number(alignment?.getAttribute('indent') ?? 0),
                textRotation: Number(alignment?.getAttribute('textRotation') ?? 0),
            },
            borders: border ?? { left: null, right: null, top: null, bottom: null },
        };
    });
}

function cssForBorder(border: CellBorder | null): string {
    if (!border) return 'none';
    const width = border.style.includes('thick') ? '2px'
        : border.style.includes('medium') ? '1.5px'
            : border.style === 'double' ? '2px'
                : border.style === 'hair' ? '0.5px' : '1px';
    const style = border.style === 'double' ? 'double'
        : border.style.includes('dash') ? 'dashed'
            : border.style === 'dotted' ? 'dotted' : 'solid';
    return `${width} ${style} ${border.color}`;
}

function cellStyleCss(style: CellStyle): string {
    const alignment = style.alignment;
    const horizontal = alignment.horizontal === 'center' || alignment.horizontal === 'centerContinuous' ? 'center'
        : alignment.horizontal === 'right' ? 'right'
            : alignment.horizontal === 'justify' ? 'justify' : 'left';
    const vertical = alignment.vertical === 'top' ? 'top'
        : alignment.vertical === 'center' ? 'middle' : 'bottom';
    const decorations = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none';
    const fontFamily = style.fontFamily.replace(/[^\w ,.-]/g, '') || 'Calibri';
    const wrap = alignment.wrap ? 'normal' : 'nowrap';
    const overflow = alignment.wrap ? 'hidden' : 'visible';
    const indent = alignment.indent > 0 ? `${alignment.indent * 6}px` : '2px';

    return [
        `font-family:${fontFamily},Arial,sans-serif`,
        `font-size:${style.fontSize}pt`,
        `font-weight:${style.bold ? '700' : '400'}`,
        `font-style:${style.italic ? 'italic' : 'normal'}`,
        'line-height:normal',
        `color:${style.fontColor}`,
        `text-decoration:${decorations}`,
        `background-color:${style.fill}`,
        `text-align:${horizontal}`,
        `vertical-align:${vertical}`,
        `white-space:${wrap}`,
        `overflow:${overflow}`,
        `padding:0 2px 0 ${indent}`,
        `border-left:${cssForBorder(style.borders.left)}`,
        `border-right:${cssForBorder(style.borders.right)}`,
        `border-top:${cssForBorder(style.borders.top)}`,
        `border-bottom:${cssForBorder(style.borders.bottom)}`,
    ].join(';');
}

function getSheetStyleMap(document: Document): {
    cells: Map<string, number>;
    rows: Map<number, number>;
    rowHeights: Map<number, number>;
    columns: Map<number, number>;
    defaultRowHeight: number;
    defaultColumnWidth: number;
    printSettings: Partial<PrintSettings>;
} {
    const cells = new Map<string, number>();
    const rows = new Map<number, number>();
    const rowHeights = new Map<number, number>();
    const columns = new Map<number, number>();
    const root = document.documentElement;
    const sheetFormat = firstChild(root, 'sheetFormatPr');
    const defaultRowHeight = Number(sheetFormat?.getAttribute('defaultRowHeight') ?? 15);
    const defaultColumnWidth = Number(sheetFormat?.getAttribute('defaultColWidth') ?? 8.43);

    for (const row of descendants(root, 'row')) {
        const rowIndex = Number(row.getAttribute('r')) - 1;
        const style = row.getAttribute('s');
        const height = Number(row.getAttribute('ht'));
        if (style) rows.set(rowIndex, Number(style));
        if (Number.isFinite(height) && height > 0) rowHeights.set(rowIndex, height);
        for (const cell of directChildren(row, 'c')) {
            const address = cell.getAttribute('r');
            if (!address) continue;
            const cellStyle = cell.getAttribute('s');
            if (cellStyle) cells.set(address, Number(cellStyle));
        }
    }

    for (const column of descendants(root, 'col')) {
        const min = Number(column.getAttribute('min')) - 1;
        const max = Number(column.getAttribute('max')) - 1;
        const style = column.getAttribute('style');
        if (!style || min < 0 || max < min) continue;
        for (let index = min; index <= Math.min(max, 16383); index += 1) columns.set(index, Number(style));
    }

    const margins = firstChild(root, 'pageMargins');
    const pageSetup = firstChild(root, 'pageSetup');
    const paperSize = pageSetup?.getAttribute('paperSize') ?? '9';
    const orientation = pageSetup?.getAttribute('orientation') ?? 'portrait';
    const paperSizes: Record<string, [number, number]> = {
        '1': [215.9, 279.4], '5': [215.9, 355.6], '8': [297, 420], '9': [210, 297],
        '11': [148, 210], '12': [210, 297], '13': [215.9, 330.2], '14': [190.5, 254],
    };
    let [widthMm, heightMm] = paperSizes[paperSize] ?? [210, 297];
    if (orientation === 'landscape') [widthMm, heightMm] = [heightMm, widthMm];
    const printSettings: Partial<PrintSettings> = {
        widthMm,
        heightMm,
        scale: Math.max(1, Number(pageSetup?.getAttribute('scale') ?? 100)) / 100,
        margins: {
            left: Number(margins?.getAttribute('left') ?? 0.7),
            right: Number(margins?.getAttribute('right') ?? 0.7),
            top: Number(margins?.getAttribute('top') ?? 0.75),
            bottom: Number(margins?.getAttribute('bottom') ?? 0.75),
        },
    };
    return { cells, rows, rowHeights, columns, defaultRowHeight, defaultColumnWidth, printSettings };
}

function excelColumnWidthToPrintPixels(
    column: XLSX.ColInfo | undefined,
    defaultWidth: number,
    maximumDigitWidth: number,
): number {
    const characterWidth = column?.width ?? defaultWidth;
    // Excel stores column widths in units of the Normal font's maximum digit width.
    return Math.max(1, Math.floor(characterWidth * maximumDigitWidth + 5));
}

function measureMaximumDigitWidth(style: Pick<CellStyle, 'fontFamily' | 'fontSize'>): number {
    const fallback = style.fontSize * 96 / 72 * 0.56;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return fallback;

    context.font = `${style.fontSize}pt "${style.fontFamily}", Arial, sans-serif`;
    const widths = Array.from('0123456789', (digit) => context.measureText(digit).width);
    return Math.max(fallback, ...widths);
}

function borderMergeMap(sheet: XLSX.WorkSheet, range: XLSX.Range): {
    roots: Map<string, { rows: number; columns: number; startRow: number; startColumn: number; endRow: number; endColumn: number }>;
    children: Set<string>;
} {
    const roots = new Map<string, { rows: number; columns: number; startRow: number; startColumn: number; endRow: number; endColumn: number }>();
    const children = new Set<string>();
    for (const merge of sheet['!merges'] ?? []) {
        const s = merge.s;
        const e = merge.e;
        if (s.r < range.s.r || s.c < range.s.c || e.r > range.e.r || e.c > range.e.c) continue;
        const root = XLSX.utils.encode_cell(s);
        roots.set(root, {
            rows: e.r - s.r + 1,
            columns: e.c - s.c + 1,
            startRow: s.r,
            startColumn: s.c,
            endRow: e.r,
            endColumn: e.c,
        });
        for (let row = s.r; row <= e.r; row += 1) {
            for (let column = s.c; column <= e.c; column += 1) {
                if (row !== s.r || column !== s.c) children.add(XLSX.utils.encode_cell({ r: row, c: column }));
            }
        }
    }
    return { roots, children };
}

function findCertificateData(workbook: XLSX.WorkBook): {
    certificateName: string;
    certificateSheet: XLSX.WorkSheet;
    rekapSheet: XLSX.WorkSheet;
} {
    const normalize = (value: string) => value.toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const rekapName = workbook.SheetNames.find((name) => normalize(name) === 'rekap');
    const certificateName = workbook.SheetNames.find((name) => normalize(name) === 'sertifikat');
    if (!rekapName || !certificateName) throw new Error('File harus memiliki sheet REKAP dan Sertifikat.');
    return {
        certificateName,
        certificateSheet: workbook.Sheets[certificateName],
        rekapSheet: workbook.Sheets[rekapName],
    };
}

function buildCertificateSheetView(workbook: XLSX.WorkBook): CertificateSheetView {
    const { certificateName, certificateSheet } = findCertificateData(workbook);
    const certificatePath = findWorksheetXmlPath(workbook, certificateName);
    const sheetXml = readWorkbookXml(workbook, certificatePath, 'sheet Sertifikat');
    const sheetStyles = getSheetStyleMap(sheetXml);
    const styles = readStyles(workbook);
    const range = getSheetRange(workbook, certificateName, certificateSheet);
    const merged = borderMergeMap(certificateSheet, range);
    const cells = new Map<string, HTMLTableCellElement>();
    const maximumDigitWidth = measureMaximumDigitWidth(styles[0] ?? { fontFamily: 'Calibri', fontSize: 11 });
    const getStyleId = (row: number, column: number) => {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        return sheetStyles.cells.get(address)
            ?? sheetStyles.rows.get(row)
            ?? sheetStyles.columns.get(column)
            ?? 0;
    };
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;border-spacing:0;table-layout:fixed;background:#fff;color:#000;';
    const colgroup = document.createElement('colgroup');
    let gridWidth = 0;
    for (let column = range.s.c; column <= range.e.c; column += 1) {
        const safeWidth = excelColumnWidthToPrintPixels(
            certificateSheet['!cols']?.[column],
            sheetStyles.defaultColumnWidth,
            maximumDigitWidth,
        );
        gridWidth += safeWidth;
        const col = document.createElement('col');
        col.style.width = `${safeWidth}px`;
        colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    const rowHeights: number[] = [];
    let gridHeight = 0;
    for (let row = range.s.r; row <= range.e.r; row += 1) {
        const sourceHeight = certificateSheet['!rows']?.[row]?.hpx
            ?? ((sheetStyles.rowHeights.get(row) ?? sheetStyles.defaultRowHeight) * 4 / 3);
        const safeHeight = Math.max(1, Number(sourceHeight) || 18);
        rowHeights.push(safeHeight);
        gridHeight += safeHeight;
    }
    table.style.width = `${gridWidth}px`;
    table.style.height = `${gridHeight}px`;

    for (let row = range.s.r; row <= range.e.r; row += 1) {
        const tr = document.createElement('tr');
        tr.style.height = `${rowHeights[row - range.s.r]}px`;
        for (let column = range.s.c; column <= range.e.c; column += 1) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            if (merged.children.has(address)) continue;
            const td = document.createElement('td');
            const span = merged.roots.get(address);
            if (span) {
                td.rowSpan = span.rows;
                td.colSpan = span.columns;
            }
            const styleId = getStyleId(row, column);
            let style = styles[styleId] ?? styles[0];
            if (span && style) {
                // Excel stores the outside borders of merged cells on different
                // cells in the merge. Preserve those edges before omitting children.
                const borders = { ...style.borders };
                const perimeter: Record<'left' | 'right' | 'top' | 'bottom', Array<[number, number]>> = {
                    left: [],
                    right: [],
                    top: [],
                    bottom: [],
                };
                for (let edgeRow = span.startRow; edgeRow <= span.endRow; edgeRow += 1) {
                    perimeter.left.push([edgeRow, span.startColumn]);
                    perimeter.right.push([edgeRow, span.endColumn]);
                }
                for (let edgeColumn = span.startColumn; edgeColumn <= span.endColumn; edgeColumn += 1) {
                    perimeter.top.push([span.startRow, edgeColumn]);
                    perimeter.bottom.push([span.endRow, edgeColumn]);
                }
                for (const side of ['left', 'right', 'top', 'bottom'] as const) {
                    for (const [edgeRow, edgeColumn] of perimeter[side]) {
                        const edgeStyle = styles[getStyleId(edgeRow, edgeColumn)];
                        if (edgeStyle?.borders[side]) {
                            borders[side] = edgeStyle.borders[side];
                            break;
                        }
                    }
                }
                style = { ...style, borders };
            }
            if (style) {
                td.style.cssText = cellStyleCss(style);
                const contentOffset = address === 'A9' ? -8
                    : address === 'I13' ? -4
                    : address === 'I14' ? -10
                    : address === 'J13' ? -6
                        : address === 'J14' ? -10
                            : style.alignment.vertical === 'center' && style.borders.bottom ? -4 : undefined;
                if (contentOffset !== undefined) {
                    const content = document.createElement('span');
                    content.dataset.cellContent = 'true';
                    content.style.cssText = `position:relative;top:${contentOffset}px;`;
                    td.appendChild(content);
                }
            }
            td.dataset.cellAddress = address;
            cells.set(address, td);
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    const settings = sheetStyles.printSettings;
    const printSettings: PrintSettings = {
        widthMm: settings.widthMm ?? 210,
        heightMm: settings.heightMm ?? 297,
        margins: settings.margins ?? { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 },
        scale: settings.scale ?? 1,
    };
    const page = document.createElement('div');
    page.style.cssText = [
        `position:relative;width:${printSettings.widthMm / 25.4 * 96}px`,
        `height:${printSettings.heightMm / 25.4 * 96}px`,
        'box-sizing:border-box;background:#fff;overflow:hidden;color:#000',
    ].join(';');
    const marginBox = document.createElement('div');
    const gridWidthPx = printSettings.widthMm / 25.4 * 96;
    const gridHeightPx = printSettings.heightMm / 25.4 * 96;
    const left = printSettings.margins.left * 96;
    const right = printSettings.margins.right * 96;
    const top = printSettings.margins.top * 96;
    const bottom = printSettings.margins.bottom * 96;
    const fittingScale = Math.min(
        printSettings.scale,
        Math.max(0.1, (gridWidthPx - left - right) / gridWidth),
        Math.max(0.1, (gridHeightPx - top - bottom) / gridHeight),
    );
    marginBox.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${gridWidth * fittingScale}px;height:${gridHeight * fittingScale}px;overflow:visible;`;
    const sheetCanvas = document.createElement('div');
    sheetCanvas.style.cssText = `width:${gridWidth}px;height:${gridHeight}px;transform:scale(${fittingScale});transform-origin:top left;font-family:Calibri,Arial,sans-serif;`;
    sheetCanvas.appendChild(table);
    marginBox.appendChild(sheetCanvas);
    page.appendChild(marginBox);

    return { page, cells, printSettings };
}

function normalizeLookupKey(value: unknown): string {
    return String(value ?? '').trim().replace(/([.,]0+)$/, '').toLocaleLowerCase('id-ID');
}

function cellDisplayValue(cell: XLSX.CellObject | undefined): string {
    if (!cell) return '';
    if (cell.t === 'e') return '';
    return String(cell.w ?? cell.v ?? '').replace(/\u00a0/g, ' ');
}

function formatLookupResult(sourceCell: XLSX.CellObject | undefined, certificateCell: XLSX.CellObject): string {
    if (!sourceCell) return '';
    if ((sourceCell.t === 'n' && typeof sourceCell.v === 'number') || (sourceCell.t === 'd' && sourceCell.v instanceof Date)) {
        try {
            return XLSX.utils.format_cell({
                t: sourceCell.t,
                v: sourceCell.v,
                z: certificateCell.z ?? sourceCell.z ?? 'General',
            });
        } catch {
            return String(sourceCell.w ?? sourceCell.v);
        }
    }
    return cellDisplayValue(sourceCell);
}

function evaluateCertificateValues(
    certificateSheet: XLSX.WorkSheet,
    rekapSheet: XLSX.WorkSheet,
    record: CertificateRecord,
    customPageTotal: number | undefined,
): Map<string, string> {
    const rekapRange = rekapSheet['!ref'] ? XLSX.utils.decode_range(rekapSheet['!ref']) : XLSX.utils.decode_range('A1');
    const recordRow = record.rekapRow - 1;
    const recordKeyCell = rekapSheet[XLSX.utils.encode_cell({ r: recordRow, c: rekapRange.s.c })];
    if (!recordKeyCell) throw new Error(`Nomor alat pada baris ${record.rekapRow} tidak ditemukan di REKAP.`);
    const lookupKey = recordKeyCell.v;
    const lookupRowByKey = new Map<string, number>();
    for (let row = rekapRange.s.r; row <= rekapRange.e.r; row += 1) {
        const keyCell = rekapSheet[XLSX.utils.encode_cell({ r: row, c: rekapRange.s.c })];
        if (keyCell && !lookupRowByKey.has(normalizeLookupKey(keyCell.v))) {
            lookupRowByKey.set(normalizeLookupKey(keyCell.v), row);
        }
    }
    const values = new Map<string, string>();
    const visiting = new Set<string>();
    const normalizeAddress = (address: string) => address.replace(/\$/g, '').toUpperCase();

    const resolveCell = (address: string): string => {
        const cellAddress = normalizeAddress(address);
        if (values.has(cellAddress)) return values.get(cellAddress) ?? '';
        if (customPageTotal !== undefined && (cellAddress === 'M48' || cellAddress === 'M49')) {
            return String(customPageTotal);
        }
        if (visiting.has(cellAddress)) throw new Error(`Rumus melingkar ditemukan pada ${cellAddress}.`);
        const cell = certificateSheet[cellAddress];
        if (!cell) return '';
        if (!cell.f) {
            const text = cellDisplayValue(cell);
            values.set(cellAddress, text);
            return text;
        }

        visiting.add(cellAddress);
        const formula = cell.f.replace(/^=/, '').trim();
        const lookup = formula.match(/^VLOOKUP\(\s*([$A-Z]+\$?\d+)\s*[,;]\s*([^,;]+)\s*[,;]\s*(\d+)\s*[,;]\s*(?:FALSE|0)\s*\)$/i);
        if (lookup) {
            const tableName = lookup[2].replace(/['"$]/g, '').trim().toLocaleLowerCase('id-ID');
            if (tableName !== 'rekap' && !tableName.startsWith('rekap!')) {
                throw new Error(`Rumus di ${cellAddress} mencari data di sheet lain; Easywork hanya mengisi REKAP.`);
            }
            const keyAddress = normalizeAddress(lookup[1]);
            const foundRow = lookupRowByKey.get(normalizeLookupKey(lookupKey));
            if (foundRow === undefined) throw new Error(`Data nomor ${String(lookupKey)} tidak ditemukan untuk rumus ${cellAddress}.`);
            const columnIndex = rekapRange.s.c + Number(lookup[3]) - 1;
            const sourceCell = rekapSheet[XLSX.utils.encode_cell({ r: foundRow, c: columnIndex })];
            // The workbook's selection control (usually P7) is replaced with the record's REKAP number.
            values.set(keyAddress, String(lookupKey ?? ''));
            const result = formatLookupResult(sourceCell, cell);
            visiting.delete(cellAddress);
            values.set(cellAddress, result);
            return result;
        }

        const directReference = formula.match(/^\s*\$?([A-Z]{1,3})\$?(\d+)\s*$/i);
        if (directReference) {
            const result = resolveCell(`${directReference[1]}${directReference[2]}`);
            visiting.delete(cellAddress);
            values.set(cellAddress, result);
            return result;
        }

        visiting.delete(cellAddress);
        throw new Error(`Rumus ${cellAddress} belum bisa diproses. Pastikan sheet Sertifikat memakai lookup langsung ke REKAP.`);
    };

    const certificateRange = certificateSheet['!ref'] ? XLSX.utils.decode_range(certificateSheet['!ref']) : XLSX.utils.decode_range('A1');
    for (let row = certificateRange.s.r; row <= certificateRange.e.r; row += 1) {
        for (let column = certificateRange.s.c; column <= certificateRange.e.c; column += 1) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            if (certificateSheet[address]?.f) resolveCell(address);
        }
    }
    return values;
}

export async function createCombinedCertificatePdf(
    workbook: XLSX.WorkBook,
    records: CertificateRecord[],
    customPageTotals: Record<string, number>,
    onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
    if (records.length === 0) throw new Error('Tidak ada sertifikat untuk dibuat.');
    const { certificateSheet, rekapSheet } = findCertificateData(workbook);
    const view = buildCertificateSheetView(workbook);
    const pageWidthMm = view.printSettings.widthMm;
    const pageHeightMm = view.printSettings.heightMm;
    const pdf = new jsPDF({
        orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        compress: true,
    });
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageWidthMm / 25.4 * 96}px;height:${pageHeightMm / 25.4 * 96}px;z-index:2147483647;overflow:hidden;pointer-events:none;`;
    host.appendChild(view.page);
    document.body.appendChild(host);

    try {
        for (const [index, record] of records.entries()) {
            const customValue = customPageTotals[record.id];
            const customPageTotal = customValue ? Number(customValue) : undefined;
            const values = evaluateCertificateValues(certificateSheet, rekapSheet, record, customPageTotal);
            for (const [address, element] of view.cells.entries()) {
                const customPageCell = customPageTotal !== undefined && (address === 'M48' || address === 'M49');
                const text = values.get(address)
                    ?? (customPageCell ? String(customPageTotal) : cellDisplayValue(certificateSheet[address]));
                const content = element.querySelector<HTMLElement>(':scope > [data-cell-content="true"]');
                if (content) content.textContent = text;
                else element.textContent = text;
            }

            const canvas = await html2canvas(view.page, {
                scale: 3.125,
                backgroundColor: '#ffffff',
                logging: false,
                width: Math.round(pageWidthMm / 25.4 * 96),
                height: Math.round(pageHeightMm / 25.4 * 96),
                scrollX: 0,
                scrollY: 0,
                windowWidth: Math.max(window.innerWidth, Math.ceil(pageWidthMm / 25.4 * 96)),
                windowHeight: Math.max(window.innerHeight, Math.ceil(pageHeightMm / 25.4 * 96)),
            });
            const image = canvas.toDataURL('image/jpeg', 0.97);
            if (index > 0) pdf.addPage([pageWidthMm, pageHeightMm], pageWidthMm > pageHeightMm ? 'landscape' : 'portrait');
            pdf.addImage(image, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
            canvas.width = 1;
            canvas.height = 1;
            onProgress?.(index + 1, records.length);
        }
        return pdf.output('blob');
    } finally {
        host.remove();
    }
}
