import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export type FirestoreReferenceTool = {
    id: string;
    name: string;
    calibrated_external: boolean;
};

export async function loadReferenceTools(): Promise<FirestoreReferenceTool[]> {
    const snap = await getDocs(collection(db, 'reference_tools'));
    return snap.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name || ''),
        calibrated_external: Boolean(d.data().calibrated_external),
    }));
}
