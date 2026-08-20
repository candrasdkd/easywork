import { getDocument, GlobalWorkerOptions, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorker;

export class PasswordProtectedError extends Error {
    constructor(message = 'Dokumen PDF ini terkunci kata sandi.') {
        super(message);
        this.name = 'PasswordProtectedError';
    }
}

export type PurchaseOrderItem = {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    total: number;
    category?: 'product' | 'service';
    originalHeader?: string;
    originalDesc?: string;
    unit?: string;
    page: number;
};

export type PurchaseOrderExtraction = {
    items: PurchaseOrderItem[];
    services: PurchaseOrderItem[];
    summary: {
        totalProductQty: number;
        totalProductValue: number;
        totalServiceQty: number;
        totalServiceValue: number;
        totalTransactionValue: number;
        pdfTotalTransaction?: number;
        pdfTotalPpn?: number;
        pdfTotalPayment?: number;
    };
    pageCount: number;
    orderNumber?: string;
    orderDate?: string;
};

type PdfLine = {
    page: number;
    text: string;
    y: number;
};

type PositionedText = {
    text: string;
    x: number;
    y: number;
};

const PRICE_ROW_PATTERN = /^(.*?)\s*Rp\.?\s*([\d.]+)\s*,\s*(\d{2})\s+([\d.]+)\s*,\s*(\d{2})(?:\s+(?:pekerjaan|pcs|unit|buah|set|paket))?(?:\s+(?:Rp\.?\s*[\d.]+\s*,\s*\d{2}))?$/i;
const METADATA_PATTERN = /^(?:Golongan PPN|https?:\/\/|Halaman\s+\d+\/\d+|\d+(?:[.,]\d+)?\s+(?:pekerjaan|pcs|unit|buah|set)\b|Termasuk\s*:|Ringkasan\s+Pembayaran|Keterangan\s+Harga)/i;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

export const parseIndonesianNumber = (whole: string, decimal = '00') => {
    const integer = Number(whole.replace(/\./g, ''));
    const fraction = Number(decimal.padEnd(2, '0').slice(0, 2)) / 100;
    return integer + fraction;
};

export const cleanServiceName = (rawText: string): string => {
    let clean = normalizeText(rawText);

    // If it is solely "JASA PENGUJIAN KELISTRIKAN" -> "Pengujian Kelistrikan"
    if (/^jasa\s+pengujian\s+kelistrikan$/i.test(clean)) {
        return 'Pengujian Kelistrikan';
    }

    clean = clean
        .replace(/\bJasa\s+Pengujian\s+(?:dan|Dan|&)\s+Kalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bJasa\s+Pengujian\s+(?:dan|Dan|&)\s+Kalibrasi\b/gi, '')
        .replace(/\bJasa\s+Kalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bJasa\s+Pengujian\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bPengujian\s+(?:dan|Dan|&)\s+Kalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/\bPengujian\s+(?:dan|Dan|&)\s+Kalibrasi\b/gi, '')
        .replace(/\bJasa\s+Pengujian\b/gi, '')
        .replace(/\bJasa\s+Kalibrasi\b/gi, '')
        .replace(/\bKalibrasi\s+Alat\s+Kesehatan\b/gi, '')
        .replace(/^[\s:;,-]+|[\s:;,-]+$/g, '');

    clean = normalizeText(clean);
    return clean || rawText.trim();
};

export const isTransportOrService = (header: string, desc: string): boolean => {
    const combined = `${header} ${desc}`.toLowerCase();
    return (
        combined.includes('layanan :') ||
        combined.includes('transport') ||
        combined.includes('akomodasi') ||
        combined.includes('ongkos kirim') ||
        combined.includes('biaya pengiriman')
    );
};

const getPageLines = async (page: PDFPageProxy, pageNumber: number): Promise<PdfLine[]> => {
    const textContent = await page.getTextContent();
    const textItems = textContent.items.filter((item): item is TextItem => 'str' in item && 'transform' in item);

    // Group items that are vertically aligned within 3.5 points tolerance
    const lineBuckets: { y: number; items: PositionedText[] }[] = [];

    const sortedItems = [...textItems].sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 3.5) {
            return yDiff;
        }
        return a.transform[4] - b.transform[4];
    });

    for (const item of sortedItems) {
        const text = item.str.trim();
        if (!text) continue;
        const x = item.transform[4];
        const y = item.transform[5];

        const existingBucket = lineBuckets.find((b) => Math.abs(b.y - y) <= 3.5);
        if (existingBucket) {
            existingBucket.items.push({ text, x, y });
        } else {
            lineBuckets.push({ y, items: [{ text, x, y }] });
        }
    }

    return lineBuckets.map((bucket) => ({
        page: pageNumber,
        y: bucket.y,
        text: normalizeText(bucket.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')),
    }));
};

export const parsePurchaseOrderFromLines = (lines: PdfLine[]) => {
    const products: PurchaseOrderItem[] = [];
    const services: PurchaseOrderItem[] = [];

    let orderNumber: string | undefined;
    let orderDate: string | undefined;
    let pdfTotalTransaction: number | undefined;
    let pdfTotalPpn: number | undefined;
    let pdfTotalPayment: number | undefined;

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const text = line.text;

        // Extract metadata
        if (!orderNumber) {
            const numMatch = text.match(/No\.?\s*Surat\s*Pesanan\s*:\s*#?([A-Za-z0-9\-_/]+)/i);
            if (numMatch) orderNumber = numMatch[1].trim();
        }
        if (!orderDate) {
            const dateMatch = text.match(/Tanggal\s*Surat\s*Pesanan\s*:\s*(.+)$/i);
            if (dateMatch) orderDate = dateMatch[1].trim();
        }

        // Summary on summary page
        const transMatch = text.match(/Total\s+Transaksi\s+Rp\.?\s*([\d.]+)\s*,\s*(\d{2})/i);
        if (transMatch) {
            pdfTotalTransaction = parseIndonesianNumber(transMatch[1], transMatch[2]);
        }

        const ppnMatch = text.match(/Estimasi\s+Total\s+PPN\s+Rp\.?\s*([\d.]+)\s*,\s*(\d{2})/i);
        if (ppnMatch) {
            pdfTotalPpn = parseIndonesianNumber(ppnMatch[1], ppnMatch[2]);
        }

        const payMatch = text.match(/Estimasi\s+Total\s+Pembayaran\s+Rp\.?\s*([\d.]+)\s*,\s*(\d{2})/i);
        if (payMatch) {
            pdfTotalPayment = parseIndonesianNumber(payMatch[1], payMatch[2]);
        }

        // Check if price row
        const match = text.match(PRICE_ROW_PATTERN);
        if (!match) continue;

        const [, inlineLabel, priceWhole, priceDecimal, quantityWhole, quantityDecimal] = match;
        const unitPrice = parseIndonesianNumber(priceWhole, priceDecimal);
        const quantity = parseIndonesianNumber(quantityWhole, quantityDecimal);

        if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) continue;

        // Look back for header (e.g. Jasa PDN, Layanan : transport)
        let header = inlineLabel.trim();
        if (!header && i > 0) {
            const prevText = lines[i - 1].text;
            if (!METADATA_PATTERN.test(prevText) && !PRICE_ROW_PATTERN.test(prevText)) {
                header = prevText;
            }
        }

        // Look forward for description
        let desc = '';
        for (let j = i + 1; j < lines.length; j += 1) {
            const nextText = lines[j].text;
            if (PRICE_ROW_PATTERN.test(nextText) || METADATA_PATTERN.test(nextText)) break;
            if (/^\d+(?:[.,]\d+)?\s+(?:pekerjaan|pcs|unit|buah|set)\b/i.test(nextText)) continue;
            if (/^https?:\/\//i.test(nextText)) continue;
            desc += (desc ? ' ' : '') + nextText;
        }

        const isService = isTransportOrService(header, desc);
        const name = isService
            ? normalizeText(desc || header.replace(/^Layanan\s*:\s*/i, '') || 'Layanan Tambahan / Transport')
            : cleanServiceName(desc || header);

        const item: PurchaseOrderItem = {
            id: `${line.page}-${i}-${products.length + services.length}`,
            name,
            unitPrice,
            quantity,
            total: unitPrice * quantity,
            category: isService ? 'service' : 'product',
            originalHeader: header,
            originalDesc: desc,
            page: line.page,
        };

        if (isService) {
            services.push(item);
        } else {
            products.push(item);
        }
    }

    const totalProductQty = products.reduce((sum, item) => sum + item.quantity, 0);
    const totalProductValue = products.reduce((sum, item) => sum + item.total, 0);
    const totalServiceQty = services.reduce((sum, item) => sum + item.quantity, 0);
    const totalServiceValue = services.reduce((sum, item) => sum + item.total, 0);
    const totalTransactionValue = totalProductValue + totalServiceValue;

    return {
        items: products,
        services,
        summary: {
            totalProductQty,
            totalProductValue,
            totalServiceQty,
            totalServiceValue,
            totalTransactionValue,
            pdfTotalTransaction,
            pdfTotalPpn,
            pdfTotalPayment,
        },
        orderNumber,
        orderDate,
    };
};

export const extractPurchaseOrderItems = async (
    file: File,
    onProgress?: (currentPage: number, pageCount: number) => void,
    password?: string,
): Promise<PurchaseOrderExtraction> => {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    const loadingTask = getDocument({
        data,
        password: password ?? '',
        cMapUrl: 'https://unpkg.com/pdfjs-dist@6.2.108/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@6.2.108/standard_fonts/',
    });

    try {
        const pdf = await loadingTask.promise;
        const allLines: PdfLine[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            try {
                const page = await pdf.getPage(pageNumber);
                const lines = await getPageLines(page, pageNumber);
                allLines.push(...lines);
            } catch (pageErr) {
                console.warn(`Gagal membaca halaman ${pageNumber}:`, pageErr);
            }
            onProgress?.(pageNumber, pdf.numPages);
        }

        const parsed = parsePurchaseOrderFromLines(allLines);

        return {
            ...parsed,
            pageCount: pdf.numPages,
        };
    } catch (err: unknown) {
        const errorObj = err as { name?: string; code?: number; message?: string };
        if (
            errorObj?.name === 'PasswordException' ||
            errorObj?.code === 1 ||
            errorObj?.code === 2 ||
            (typeof errorObj?.message === 'string' && errorObj.message.toLowerCase().includes('password'))
        ) {
            throw new PasswordProtectedError();
        }
        throw err;
    } finally {
        try {
            await loadingTask.destroy();
        } catch {
            // Ignore destruction errors
        }
    }
};

