import assert from 'node:assert/strict';
import test from 'node:test';
import { filterSourceReportFiles } from '../src/lib/certificateMasterFiles.ts';

test('folder selection excludes Excel temporary and hidden files', () => {
    const files = [
        { name: '1. dental unit nusaherang.xlsx' },
        { name: '~$1. dental unit nusaherang.xlsx' },
        { name: '~1. dental unit nusaherang.xlsx' },
        { name: '.~lock.1. dental unit nusaherang.xlsx#' },
        { name: 'catatan.txt' },
        { name: '2. photometer.xls' },
    ];

    assert.deepEqual(
        filterSourceReportFiles(files).map((file) => file.name),
        ['1. dental unit nusaherang.xlsx', '2. photometer.xls'],
    );
});
