import {
    Card,
    CardContent,
    Typography,
    Grid,
    Box,
    CardHeader,
    Avatar,
    useTheme,
    Skeleton,
    Tooltip,
    Fab,
    TextField,
    MenuItem,
    Paper,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlaceIcon from "@mui/icons-material/Place";
import ShareIcon from "@mui/icons-material/Share";
import copy from "copy-to-clipboard";
import { useMemo, useState } from "react";
import type { CalibrationItem } from "../pages/DashboardPage";

interface DashboardProps {
    items: CalibrationItem[];
    loading: boolean;
}

const uniqueSorted = (arr: string[]) =>
    Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "id")
    );

const todayLocalStr = () => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`; // yyyy-mm-dd (lokal)
};
const firstDayOfThisMonthStr = () => {
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}-01`;
};

export default function Dashboard({ loading, items }: DashboardProps) {
    const theme = useTheme();
    // ================= Filters =================
    const [room, setRoom] = useState<string>("");
    const [dateFrom, setDateFrom] = useState<string>(firstDayOfThisMonthStr());
    const [dateTo, setDateTo] = useState<string>(todayLocalStr());

    const allRooms = useMemo(
        () => uniqueSorted(items.map((i) => i.room_name || "")),
        [items]
    );
    const filtered = useMemo(() => {
        const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
        const to = dateTo ? new Date(dateTo + "T23:59:59.999") : null;

        return items.filter((it) => {
            if (room && (it.room_name || "") !== room) return false;

            if (from || to) {
                const d = it.implementation_date;
                if (!d) return false;
                if (from && d < from) return false;
                if (to && d > to) return false;
            }

            return true;
        });
    }, [items, room, dateFrom, dateTo]);


    const totalItems = filtered.length;
    const totalRooms = uniqueSorted(filtered.map((i) => i.room_name || "")).length;

    // ================ Share/Copy/CSV ================
    const generateSummaryText = () => {
        let txt = `🧪 *LAPORAN KALIBRASI PERALATAN (Filtered)*\n\n`;
        txt += `🎛 Filter: `;
        const parts = [];
        if (room) parts.push(`ruangan="${room}"`);
        if (dateFrom) parts.push(`dari=${dateFrom}`);
        if (dateTo) parts.push(`sampai=${dateTo}`);
        txt += parts.length ? parts.join(", ") : "—";
        txt += `\n\n📌 *DATA UTAMA*\n`;
        txt += `▫️ Total Inputan: *${totalItems}*\n`;
        return txt;
    };

    const handleCopy = () => {
        copy(generateSummaryText());
        alert("Ringkasan berhasil disalin ke clipboard!");
    };

    const handleShareWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(generateSummaryText())}`;
        window.open(url, "_blank");
    };

    return (
        <Box sx={{ minHeight: "100vh" }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom color="text.primary">
                Dashboard Kalibrasi
            </Typography>

            {/* ======== Filter Bar (RESPONSIVE) ======== */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
                <Grid container spacing={1.5} alignItems="center">
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            size="small"
                            fullWidth
                            label="Ruangan"
                            select
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                        >
                            <MenuItem value="">Semua</MenuItem>
                            {allRooms.map((r) => (
                                <MenuItem key={r} value={r}>
                                    {r || "Unknown"}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            size="small"
                            fullWidth
                            label="Dari Tanggal"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <TextField
                            size="small"
                            fullWidth
                            label="Sampai Tanggal"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </Grid>
                </Grid>
            </Paper>


            {loading ? (
                <Grid container spacing={3}>
                    {[...Array(6)].map((_, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Skeleton variant="rounded" height={180} />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <>
                    <Grid container spacing={3}>
                        {/* Total Alat */}
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    bgcolor: theme.palette.primary.light,
                                    color: "primary.contrastText",
                                    borderRadius: 3,
                                }}
                                elevation={6}
                            >
                                <CardHeader
                                    avatar={
                                        <Avatar sx={{ bgcolor: "primary.main" }}>
                                            <Inventory2Icon />
                                        </Avatar>
                                    }
                                    title="Total Inputan"
                                    titleTypographyProps={{ fontWeight: "bold", fontSize: "1.1rem" }}
                                />
                                <CardContent
                                    sx={{
                                        flexGrow: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Typography variant="h2" fontWeight="bold">
                                        {totalItems}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        {/* Total Ruangan */}
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Card
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    bgcolor: theme.palette.secondary.light,
                                    color: "info.contrastText",
                                    borderRadius: 3,
                                }}
                                elevation={6}
                            >
                                <CardHeader
                                    avatar={
                                        <Avatar sx={{ bgcolor: "secondary.main" }}>
                                            <PlaceIcon />
                                        </Avatar>
                                    }
                                    title="Total Ruangan"
                                    titleTypographyProps={{ fontWeight: "bold", fontSize: "1.1rem" }}
                                />
                                <CardContent
                                    sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                    <Typography variant="h2" fontWeight="bold">
                                        {totalRooms}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Floating Action Buttons */}
                    <Box
                        sx={{
                            position: "fixed",
                            bottom: 24,
                            right: 24,
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            zIndex: 999,
                        }}
                    >
                        <Tooltip title="Salin ke Clipboard" arrow>
                            <Fab color="primary" onClick={handleCopy}>
                                <ContentCopyIcon />
                            </Fab>
                        </Tooltip>

                        <Tooltip title="Bagikan ke WhatsApp" arrow>
                            <Fab color="success" onClick={handleShareWhatsApp}>
                                <ShareIcon />
                            </Fab>
                        </Tooltip>
                    </Box>
                </>
            )}
        </Box>
    );
}
