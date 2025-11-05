// ganti semua dari 'react-router' -> 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router'
import DashboardPage from './pages/DashboardPage'
import CalibrationListPage from './pages/CalibrationListPage'
import InventoryListPage from './pages/InventoryListPage'
import Login from './pages/LoginPage'
import RequireAuth from './components/RequireAuth'
import AppShell from './layouts/AppShell'
import ProfilePage from './pages/ProfilePage'

export default function AppRoutes() {
    return (
        <Routes>
            {/* public */}
            <Route path="/login" element={<Login />} />

            {/* protected */}
            <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/data-inputan" element={<CalibrationListPage />} />
                    <Route path="/data-inventaris" element={<InventoryListPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    {/* <Route path="/category-orders" element={<CategoryOrder />} /> */}
                </Route>
            </Route>

            {/* fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    )
}
