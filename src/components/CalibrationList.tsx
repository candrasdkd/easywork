import {
    Box, Button, IconButton, Stack, TextField, Tooltip, Alert,
    TablePagination, Fab, useTheme, useMediaQuery
} from '@mui/material';
import {
    DataGrid, GridToolbar, gridClasses,
    type GridColDef, type GridPaginationModel,
    type GridValidRowModel
} from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import PageContainer from './PageContainer';

export type CalibrationListProps<Row extends GridValidRowModel> = {
    rows: Row[];
    rowCount: number;
    columns: GridColDef<Row>[];
    loading: boolean;
    error?: Error | null;

    paginationModel: GridPaginationModel;
    onPaginationModelChange: (m: GridPaginationModel) => void;

    searchText: string;
    onSearchTextChange: (v: string) => void;

    onRefresh: () => void;
    onCreate: () => void;
    onExport: () => void;
};

export default function CalibrationList<Row extends GridValidRowModel>(
    props: CalibrationListProps<Row>
) {
    const {
        rows, rowCount, columns, loading, error,
        paginationModel, onPaginationModelChange,
        searchText, onSearchTextChange,
        onRefresh, onCreate, onExport,
    } = props;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <PageContainer
            title="Data"
            actions={
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Reload data" placement="right" enterDelay={1000}>
                        <div>
                            <IconButton size="small" aria-label="refresh" onClick={onRefresh}>
                                <RefreshIcon />
                            </IconButton>
                        </div>
                    </Tooltip>
                    <Button
                        variant="contained"
                        onClick={(e) => { e.preventDefault(); onCreate(); }} // penting: pastikan buka modal
                        startIcon={<AddIcon />}
                    >
                        Tambah
                    </Button>
                </Stack>
            }
        >
            <Box sx={{ flex: 1, width: '100%', position: 'relative' }}>
                <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
                    <TextField
                        label="Cari Apapun"
                        value={searchText}
                        onChange={(e) => onSearchTextChange(e.target.value)}
                        size="small"
                        fullWidth
                    />
                </Stack>

                {error ? (
                    <Alert severity="error">{error.message}</Alert>
                ) : (
                    <DataGrid
                        rows={rows}
                        rowCount={rowCount}
                        columns={columns}
                        getRowId={(r) => (r as any).id}
                        paginationMode="server"
                        paginationModel={paginationModel}
                        onPaginationModelChange={onPaginationModelChange}
                        disableRowSelectionOnClick
                        loading={loading}
                        slots={{
                            toolbar: GridToolbar,
                            pagination: () => (
                                <TablePagination
                                    component="div"
                                    count={rowCount}
                                    page={paginationModel.page}
                                    onPageChange={(_, newPage) =>
                                        onPaginationModelChange({ ...paginationModel, page: newPage })
                                    }
                                    rowsPerPage={paginationModel.pageSize}
                                    onRowsPerPageChange={(e) =>
                                        onPaginationModelChange({
                                            page: 0,
                                            pageSize: parseInt(e.target.value, 10),
                                        })
                                    }
                                    rowsPerPageOptions={[15, 30, 50, 100]}
                                    labelRowsPerPage="Show Data"
                                />
                            ),
                        }}
                        sx={{
                            [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
                            [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: { outline: 'none' },
                            [`& .${gridClasses.row}:hover`]: { cursor: 'pointer' },
                        }}
                    />
                )}
            </Box>

            {/* Floating Actions */}
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 16,
                    left: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    zIndex: 1200, // turun supaya dialog (1300) tetap di atas
                }}
            >
                <Tooltip title="Export Excel" arrow>
                    <Fab
                        color="primary"
                        onClick={onExport}
                        size={isMobile ? 'small' : 'medium'}
                        sx={{ width: isMobile ? 40 : 56, height: isMobile ? 40 : 56 }}
                    >
                        <DownloadIcon fontSize={isMobile ? 'small' : 'medium'} />
                    </Fab>
                </Tooltip>
            </Box>
        </PageContainer>
    );
}
