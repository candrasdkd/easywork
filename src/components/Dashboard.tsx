import {
    Card,
    CardContent,
    Typography,
    Box,
    Grid,
    CardHeader,
    Avatar,
    useTheme,
    Skeleton,
    Tooltip,
    Fab,
    Paper,
    Alert,
    TextField,
    MenuItem,
} from "@mui/material";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

import Inventory2Icon from "@mui/icons-material/Inventory2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlaceIcon from "@mui/icons-material/Place";
import ShareIcon from "@mui/icons-material/Share";
import RefreshIcon from "@mui/icons-material/Refresh";

import copy from "copy-to-clipboard";
import { Dayjs } from "dayjs";
import "dayjs/locale/id";
import { useMemo, useState } from "react";
import type { CalibrationItem } from "../pages/DashboardPage";

interface DashboardProps {
    items: CalibrationItem[];
    loading: boolean;
    selectedMonth: Dayjs;
    onMonthChange: (m: Dayjs) => void;
    error?: Error | null;
    onRefresh?: () => void;
}

const uniqueSorted = (arr: string[]) =>
    Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "id")
    );

export default function Dashboard({
    loading,
    items,
    selectedMonth,
    onMonthChange,
    error,
    onRefresh,
}: DashboardProps) {
    const theme = useTheme();

    // === Filter Ruangan (client-side) ===
    const allRooms = useMemo(
        () => uniqueSorted(items.map((i) => i.room_name || "")),
        [items]
    );
    const [room, setRoom] = useState<string>("");

    const filtered = useMemo(() => {
        if (!room) return items;
        return items.filter((it) => (it.room_name || "") === room);
    }, [items, room]);

    const totalItems = filtered.length;
    const totalRooms = useMemo(
        () => uniqueSorted(filtered.map((i) => i.room_name || "")).length,
        [filtered]
    );

    const generateSummaryText = () => {
        const bulanStr = selectedMonth.format("MMMM YYYY");
        let txt = `🧪 *LAPORAN KALIBRASI PERALATAN*\n\n`;
        txt += `🗓 Periode: *${bulanStr}*\n`;
        if (room) txt += `🏢 Ruangan: *${room}*\n`;
        txt += `\n📌 *DATA UTAMA*\n`;
        txt += `▫️ Total Inputan: *${totalItems}*\n`;
        txt += `▫️ Total Ruangan: *${totalRooms}*\n`;
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

            {/* Filter Bulan + Ruangan */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
                <Grid container spacing={1.5} alignItems="center">
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="id">
                            <DatePicker
                                label="Filter Bulan"
                                views={["year", "month"]}
                                openTo="month"
                                value={selectedMonth}
                                format="MMMM YYYY"
                                onChange={(v) => v && onMonthChange(v)}
                                slotProps={{ textField: { size: "small", fullWidth: true } }}
                            />
                        </LocalizationProvider>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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

                    <Grid size={{ xs: 'auto' }}>
                        <Tooltip title="Refresh data">
                            <Fab size="small" color="default" onClick={onRefresh}>
                                <RefreshIcon />
                            </Fab>
                        </Tooltip>
                    </Grid>
                </Grid>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error.message || "Terjadi kesalahan saat memuat data."}
                </Alert>
            )}

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
                        {/* Total Inputan */}
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
                                    sx={{
                                        flexGrow: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Typography variant="h2" fontWeight="bold">
                                        {totalRooms}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* FABs */}
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
