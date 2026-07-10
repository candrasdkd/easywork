import type { FirestoreReferenceTool } from './seedReferenceTools';

export function normalize(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\(\s*\*?\s*\)/g, '')
        .replace(/[*]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

function similarity(a: string, b: string): number {
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshteinDistance(a, b) / maxLen;
}

export function isInReference(
    toolName: string,
    referenceTools: FirestoreReferenceTool[]
): { matched: boolean; matchedWith?: string; matchedId?: string } {
    const norm = normalize(toolName);

    for (const ref of referenceTools) {
        if (norm === normalize(ref.name)) {
            return { matched: true, matchedWith: ref.name };
        }
    }

    for (const ref of referenceTools) {
        const refNorm = normalize(ref.name);
        if (norm.includes(refNorm) || refNorm.includes(norm)) {
            return { matched: true, matchedWith: ref.name };
        }
    }

    let bestName: string | null = null;
    let bestSim = 0;
    for (const ref of referenceTools) {
        const sim = similarity(norm, normalize(ref.name));
        if (sim > bestSim) {
            bestSim = sim;
            bestName = ref.name;
        }
    }

    if (bestSim >= 0.82) {
        return { matched: true, matchedWith: bestName! };
    }

    return { matched: false };
}

export type EquipmentCheckItem = {
    id: string;
    name: string;
    matched: boolean | null;
    matched_reference_id: string | null;
    reviewed: boolean;
    reviewed_at: unknown | null;
    created_at: unknown | null;
};

export function findUnmatchedFromChecks(
    checks: EquipmentCheckItem[]
): EquipmentCheckItem[] {
    return checks.filter((c) => c.matched === false && !c.reviewed);
}
