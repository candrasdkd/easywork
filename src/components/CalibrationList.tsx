import * as React from 'react';
import { Button } from './ui/Button';
import { Table } from './ui/Table';
import { Input } from './ui/Input';
import PageContainer from './PageContainer';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((row: T) => React.ReactNode);
    align?: 'left' | 'center' | 'right';
    width?: string;
}

export interface PaginationModel {
    page: number;
    pageSize: number;
}

export type CalibrationListProps<Row> = {
    rows: Row[];
    rowCount: number;
    columns: Column<Row>[];
    loading: boolean;
    error?: Error | null;

    paginationModel: PaginationModel;
    onPaginationModelChange: (m: PaginationModel) => void;

    searchText: string;
    onSearchTextChange: (v: string) => void;

    onRefresh: () => void;
    onCreate: () => void;
    onExport: () => void;
};

export default function CalibrationList<Row extends { id: string | number }>(
    props: CalibrationListProps<Row>
) {
    const {
        rows, rowCount, columns, loading, error,
        paginationModel, onPaginationModelChange,
        searchText, onSearchTextChange,
        onRefresh, onCreate, onExport,
    } = props;

    const totalPages = Math.ceil(rowCount / paginationModel.pageSize);

    return (
        <PageContainer
            title="Data Kolibrasi"
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onRefresh} title="Reload data">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => { e.preventDefault(); onCreate(); }}
                        startIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                        }
                    >
                        Tambah
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="max-w-md">
                    <Input
                        placeholder="Cari Apapun..."
                        value={searchText}
                        onChange={(e) => onSearchTextChange(e.target.value)}
                        className="w-full"
                    />
                </div>

                {error ? (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        {error.message}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Table
                            columns={columns}
                            data={rows}
                            loading={loading}
                            getRowId={(r) => r.id}
                        />

                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-t border-gray-100 dark:border-slate-800">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Menampilkan <span className="font-semibold text-gray-900 dark:text-white">{rows.length}</span> dari <span className="font-semibold text-gray-900 dark:text-white">{rowCount}</span> data
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 mr-4">
                                    <span className="text-sm text-gray-500">Tampilkan:</span>
                                    <select
                                        value={paginationModel.pageSize}
                                        onChange={(e) => onPaginationModelChange({ ...paginationModel, pageSize: Number(e.target.value), page: 0 })}
                                        className="text-sm border-none bg-transparent focus:ring-0 font-semibold cursor-pointer dark:text-gray-300"
                                    >
                                        {[15, 30, 50, 100].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={paginationModel.page === 0}
                                        onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page - 1 })}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </Button>
                                    <span className="text-sm font-medium px-4">
                                        Halaman {paginationModel.page + 1} dari {totalPages || 1}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={paginationModel.page >= totalPages - 1}
                                        onClick={() => onPaginationModelChange({ ...paginationModel, page: paginationModel.page + 1 })}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Actions */}
            <div className="fixed bottom-8 left-8 z-30">
                <button
                    onClick={onExport}
                    className="p-4 bg-emerald-600 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
                    title="Export Excel"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
            </div>
        </PageContainer>
    );
}
