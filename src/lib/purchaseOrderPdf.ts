import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export type PurchaseOrderItem = {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
};

export type PurchaseOrderExtraction = {
    items: PurchaseOrderItem[];
    pageCount: number;
};

type PdfLine = {
    page: number;
    text: string;
};

type PositionedText = {
    text: string;
    x: number;
    y: number;
};

const PRICE_ROW_PATTERN = /^(.*?)\s*Rp\s*([\d.]+)\s*,\s*(\d{2})\s+([\d.]+)\s*,\s*(\d{2})\s*$/i;
const METADATA_PATTERN = /^(?:Golongan PPN|https?:\/\/|Halaman\s+\d+\/\d+|\d+(?:[.,]\d+)?\s+(?:pekerjaan|pcs|unit|buah|set)\b)/i;
const SERVICE_ONLY_NAMES = new Set(['kelistrikan', 'pengujian', 'kalibrasi', 'alat kesehatan']);
const PRODUCT_LABEL_PATTERN = /^Jasa(?:\s+Pre\s+Order\s+\d+\s+Hari)?\s+PDN$/i;
const TRANSPORT_LABEL_PATTERN = /^Layanan\s*:/i;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const parseIndonesianNumber = (whole: string, decimal: string) => {
    const integer = Number(whole.replace(/\./g, ''));
    const fraction = Number(decimal) / 100;
    return integer + fraction;
};

const removeServiceDescription = (value: string) => normalizeText(
    value
        .replace(/\bJasa\s+Pengujian\s+(?:dan|Dan)\s+Kalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bJasa\s+Pengujian\s+(?:dan|Dan)\s+Kalibrasi\b/gi, '')
        .replace(/\bJasa\s+Kalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bJasa\s+Pengujian\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bJasa\s+Pengujian\b/gi, '')
        .replace(/\bJasa\s+Kalibrasi\b/gi, '')
        .replace(/^[\s:;,-]+|[\s:;,-]+$/g, '')
);

const isProductLabel = (label: string) => PRODUCT_LABEL_PATTERN.test(normalizeText(label));

const isTransportLabel = (label: string) => TRANSPORT_LABEL_PATTERN.test(normalizeText(label));

const getDescription = (lines: PdfLine[], startIndex: number, endIndex: number) => {
    const descriptionLines: string[] = [];

    for (let index = startIndex + 1; index < endIndex; index += 1) {
        const line = normalizeText(lines[index].text);
        if (!line) continue;
        if (PRICE_ROW_PATTERN.test(line) || METADATA_PATTERN.test(line)) break;
        descriptionLines.push(line);
    }

    return descriptionLines.join(' ');
};

const getHeaderBeforePrice = (lines: PdfLine[], priceIndex: number) => {
    let blockStart = priceIndex - 1;
    while (blockStart >= 0 && !PRICE_ROW_PATTERN.test(normalizeText(lines[blockStart].text))) {
        blockStart -= 1;
    }

    for (let index = priceIndex - 1; index > blockStart; index -= 1) {
        const label = normalizeText(lines[index].text);
        if (isProductLabel(label) || isTransportLabel(label)) return index;
    }

    return -1;
};

export const parsePurchaseOrderLines = (lines: PdfLine[]): PurchaseOrderItem[] => {
    const rows: PurchaseOrderItem[] = [];

    lines.forEach((line, index) => {
        const match = normalizeText(line.text).match(PRICE_ROW_PATTERN);
        if (!match) return;

        const [, inlineLabel, priceWhole, priceDecimal, quantityWhole, quantityDecimal] = match;
        const headerIndex = inlineLabel.trim() ? index : getHeaderBeforePrice(lines, index);
        const headerLabel = inlineLabel.trim() || (headerIndex >= 0 ? lines[headerIndex].text : '');
        if (!isProductLabel(headerLabel) || isTransportLabel(headerLabel)) return;

        const name = removeServiceDescription(getDescription(lines, index, lines.length));
        if (!name || SERVICE_ONLY_NAMES.has(name.toLowerCase())) return;

        const unitPrice = parseIndonesianNumber(priceWhole, priceDecimal);
        const quantity = parseIndonesianNumber(quantityWhole, quantityDecimal);
        if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) return;

        rows.push({
            id: `${line.page}-${index}-${rows.length}`,
            name,
            unitPrice,
            quantity,
            total: unitPrice * quantity,
        });
    });

    return rows;
};

const getPageLines = async (page: PDFPageProxy, pageNumber: number): Promise<PdfLine[]> => {
    const textContent = await page.getTextContent();
    const textItems = textContent.items.filter((item): item is TextItem => 'str' in item && 'transform' in item);
    const groupedLines = new Map<number, PositionedText[]>();

    textItems.forEach((item) => {
        const text = item.str.trim();
        if (!text) return;

        const x = item.transform[4];
        const y = Math.round(item.transform[5]);
        const currentLine = groupedLines.get(y) ?? [];
        currentLine.push({ text, x, y });
        groupedLines.set(y, currentLine);
    });

    return [...groupedLines.values()]
        .sort((first, second) => second[0].y - first[0].y)
        .map((items) => ({
            page: pageNumber,
            text: normalizeText(items.sort((first, second) => first.x - second.x).map((item) => item.text).join(' ')),
        }));
};

export const extractPurchaseOrderItems = async (
    file: File,
    onProgress?: (currentPage: number, pageCount: number) => void,
): Promise<PurchaseOrderExtraction> => {
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = getDocument({ data });

    try {
        const pdf = await loadingTask.promise;
        const pages = await Promise.all(
            Array.from({ length: pdf.numPages }, async (_, index) => {
                const pageNumber = index + 1;
                const page = await pdf.getPage(pageNumber);
                const lines = await getPageLines(page, pageNumber);
                onProgress?.(pageNumber, pdf.numPages);
                return lines;
            }),
        );

        return {
            items: parsePurchaseOrderLines(pages.flat()),
            pageCount: pdf.numPages,
        };
    } finally {
        await loadingTask.destroy();
    }
};
