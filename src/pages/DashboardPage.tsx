import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
    collection,
    getDocs,
    orderBy,
    query,
    Timestamp,
} from "firebase/firestore";
import Dashboard from "../components/Dashboard";

export interface CalibrationItem {
    id: string;
    brand_name: string;
    capacity: string;
    implementation_date: Date | null; // kita konversi ke JS Date agar mudah dipakai
    label_number: string;
    level_of_accuracy: string;
    person_id: string;
    person_responsible: string;
    room_name: string;
    serial_number: string;
    tool_name: string;
    type_id: string;
    type_name: string;
}

export default function DashboardPage() {
    const [items, setItems] = useState<CalibrationItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCalibration = async () => {
        try {
            const q = query(
                collection(db, "calibration_data"),
                orderBy("tool_name", "asc")
            );
            const snap = await getDocs(q);

            const rows: CalibrationItem[] = snap.docs.map((doc) => {
                const d = doc.data() as any;
                // safety convert Timestamp -> Date
                const impl = d.implementation_date;
                const implementation_date =
                    impl instanceof Timestamp ? impl.toDate() : (impl ?? null);

                return {
                    id: doc.id,
                    brand_name: d.brand_name ?? "",
                    capacity: d.capacity ?? "",
                    implementation_date,
                    label_number: d.label_number ?? "",
                    level_of_accuracy: d.level_of_accuracy ?? "",
                    person_id: d.person_id ?? "",
                    person_responsible: d.person_responsible ?? "",
                    room_name: d.room_name ?? "",
                    serial_number: d.serial_number ?? "",
                    tool_name: d.tool_name ?? "",
                    type_id: d.type_id ?? "",
                    type_name: d.type_name ?? "",
                };
            });

            setItems(rows);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalibration();
    }, []);

    return <Dashboard loading={isLoading} items={items} />;
}
