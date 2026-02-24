import * as React from 'react';

interface Column<T> {
    header: string;
    accessor: keyof T | ((row: T) => React.ReactNode);
    align?: 'left' | 'center' | 'right';
    width?: string;
}

interface TableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (row: T) => void;
    loading?: boolean;
    getRowId: (row: T) => string | number;
}

export function Table<T>({ columns, data, onRowClick, loading, getRowId }: TableProps<T>) {
    return (
        <div className="w-full overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={`px-6 py-4 border-b border-gray-100 dark:border-slate-800 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                                <div className="flex justify-center items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Memuat data...
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                Tidak ada data ditemukan.
                            </td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr
                                key={getRowId(row)}
                                onClick={() => onRowClick?.(row)}
                                className={`
                                    bg-white dark:bg-transparent hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors
                                    ${onRowClick ? 'cursor-pointer' : ''}
                                `}
                            >
                                {columns.map((col, idx) => (
                                    <td
                                        key={idx}
                                        className={`px-6 py-4 dark:text-gray-300 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    >
                                        {typeof col.accessor === 'function'
                                            ? col.accessor(row)
                                            : (row[col.accessor] as React.ReactNode)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
