import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/id";

import { auth, db } from "../lib/firebase";
import {
    collection,
    getDocs,
    orderBy,
    query,
    Timestamp,
    where,
} from "firebase/firestore";

import Dashboard from "../components/Dashboard";

export interface CalibrationItem {
    id: string;
    user_id?: string;
    brand_name: string;
    capacity: string;
    implementation_date: Date | null; // konversi ke JS Date
    label_number: string;
    level_of_accuracy: string;
    person_id?: string;
    person_responsible: string;
    room_name: string;
    serial_number: string;
    tool_name: string;
    type_id?: string;
    type_name: string;
}

export default function DashboardPage() {
    const [items, setItems] = React.useState<CalibrationItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // default: bulan ini
    const [selectedMonth, setSelectedMonth] = React.useState<Dayjs>(dayjs());

    const uid = auth.currentUser?.uid ?? null;

    const fetchItems = React.useCallback(async () => {
        if (!uid && auth.currentUser?.email !== "candrametal@gmail.com") {
            setItems([]);
            return;
        }
        setIsLoading(true);
        setError(null);

        try {
            const startOfMonth = dayjs(selectedMonth).startOf("month").toDate();
            const endOfMonth = dayjs(selectedMonth).endOf("month").toDate();

            let qRef;

            // Admin: lihat semua data bulan tsb
            if (auth.currentUser?.email === "candrametal@gmail.com") {
                qRef = query(
                    collection(db, "calibration_data"),
                    where("implementation_date", ">=", Timestamp.fromDate(startOfMonth)),
                    where("implementation_date", "<=", Timestamp.fromDate(endOfMonth)),
                    orderBy("implementation_date", "asc")
                );
            } else {
                // User biasa: hanya datanya sendiri
                qRef = query(
                    collection(db, "calibration_data"),
                    where("user_id", "==", uid),
                    where("implementation_date", ">=", Timestamp.fromDate(startOfMonth)),
                    where("implementation_date", "<=", Timestamp.fromDate(endOfMonth)),
                    orderBy("implementation_date", "asc")
                );
            }

            const snap = await getDocs(qRef);

            const rows: CalibrationItem[] = snap.docs.map((doc) => {
                const d = doc.data() as any;
                const impl = d.implementation_date;
                const implementation_date =
                    impl instanceof Timestamp ? impl.toDate() : impl ?? null;

                return {
                    id: doc.id,
                    user_id: d.user_id ?? "",
                    brand_name: String(d.brand_name ?? ""),
                    capacity: String(d.capacity ?? ""),
                    implementation_date,
                    label_number: String(d.label_number ?? ""),
                    level_of_accuracy: String(d.level_of_accuracy ?? ""),
                    person_responsible: String(d.person_responsible ?? ""),
                    room_name: String(d.room_name ?? ""),
                    serial_number: String(d.serial_number ?? ""),
                    tool_name: String(d.tool_name ?? ""),
                    type_name: String(d.type_name ?? ""),
                };
            });

            setItems(rows);
        } catch (e) {
            setError(e as Error);
        } finally {
            setIsLoading(false);
        }
    }, [uid, selectedMonth]);

    React.useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    return (
        <Dashboard
            loading={isLoading}
            items={items}
            selectedMonth={selectedMonth}
            onMonthChange={(m) => setSelectedMonth(m)}
            error={error}
            onRefresh={fetchItems}
        />
    );
}
