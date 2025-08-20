// ganti ke 'react-router-dom' dan betulkan logika
import { Navigate, Outlet, useLocation } from 'react-router'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAuth() {
    const { user, loading } = useAuth()
    const loc = useLocation()

    if (loading) {
        return (
            <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
            </Box>
        )
    }

    // jika belum login -> lempar ke /login sambil bawa state "from"
    if (!user) {
        return <Navigate to="/login" state={{ from: loc }} replace />
    }

    // sudah login -> render halaman yang dilindungi
    return <Outlet />
}
