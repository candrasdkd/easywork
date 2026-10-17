export interface NamedSourceFile {
    name: string;
}

export function filterSourceReportFiles<T extends NamedSourceFile>(files: readonly T[]): T[] {
    return files.filter((file) => {
        const name = file.name.trimStart();
        const isHiddenOrTemporary = name.startsWith('.') || name.startsWith('~');
        return /\.xlsx?$/i.test(name) && !isHiddenOrTemporary;
    });
}
