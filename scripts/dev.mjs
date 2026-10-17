import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies');
const pythonCandidates = [
    process.env.EASYWORK_PYTHON_PATH,
    join(runtimeRoot, 'python/bin/python3'),
    'python3',
].filter(Boolean);
const sofficeCandidates = [
    process.env.EASYWORK_SOFFICE_PATH,
    join(runtimeRoot, 'bin/override/soffice'),
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    'soffice',
    'libreoffice',
].filter(Boolean);

function resolveExecutable(candidate) {
    if (!candidate.includes('/')) {
        const found = spawnSync('which', [candidate], { encoding: 'utf8' });
        return found.status === 0 ? found.stdout.trim() : undefined;
    }
    try {
        accessSync(candidate, constants.X_OK);
        return candidate;
    } catch {
        return undefined;
    }
}

const python = pythonCandidates.map(resolveExecutable).find(Boolean);
const soffice = sofficeCandidates.map(resolveExecutable).find(Boolean);

if (!python) {
    console.error('Python 3 tidak ditemukan. Atur EASYWORK_PYTHON_PATH ke executable Python.');
    process.exit(1);
}
if (!soffice) {
    console.error('LibreOffice tidak ditemukan. Pasang LibreOffice atau atur EASYWORK_SOFFICE_PATH.');
    process.exit(1);
}

const environment = {
    ...process.env,
    EASYWORK_SOFFICE_PATH: soffice,
};
const children = [
    spawn(python, [join(projectRoot, 'scripts/certificate_print_api.py')], {
        cwd: projectRoot,
        env: environment,
        stdio: 'inherit',
    }),
    spawn(process.execPath, [join(projectRoot, 'node_modules/vite/bin/vite.js')], {
        cwd: projectRoot,
        env: environment,
        stdio: 'inherit',
    }),
];

let stopping = false;
function stop(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        if (child.exitCode === null) child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(exitCode), 250).unref();
}

for (const child of children) {
    child.on('error', (error) => {
        console.error(`Gagal menjalankan layanan cetak sertifikat: ${error.message}`);
        stop(1);
    });
    child.on('exit', (code) => {
        if (!stopping) stop(code ?? 1);
    });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
