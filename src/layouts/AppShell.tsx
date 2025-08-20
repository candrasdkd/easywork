import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'
import { Box, Toolbar } from '@mui/material'

export default function AppShell() {
    return (
        <>
            <Navbar />
            <Box sx={{ p: 3 }}>
                <Toolbar />
                <Outlet />
            </Box>
        </>
    )
}
