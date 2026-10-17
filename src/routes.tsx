// ganti semua dari 'react-router' -> 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router'
import DashboardPage from './pages/DashboardPage'
import CalibrationListPage from './pages/CalibrationListPage'
import Login from './pages/LoginPage'
import RequireAuth from './components/RequireAuth'
import AppShell from './layouts/AppShell'
import ProfilePage from './pages/ProfilePage'
import MassImportPage from './pages/MassImportPage'
import PurchaseOrderPdfPage from './pages/PurchaseOrderPdfPage'
import EquipmentCheckPage from './pages/EquipmentCheckPage'
import ReferenceToolsPage from './pages/ReferenceToolsPage'
import CertificateMasterPage from './pages/CertificateMasterPage'

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
                    <Route path="/data-inventaris" element={<Navigate to="/" replace />} />
                    <Route path="/mass-import" element={<MassImportPage />} />
                    <Route path="/ekstrak-pesanan-pdf" element={<PurchaseOrderPdfPage />} />
                    <Route path="/cek-alat" element={<EquipmentCheckPage />} />
                    <Route path="/referensi-alat" element={<ReferenceToolsPage />} />
                    <Route path="/isi-master-sertifikat" element={<CertificateMasterPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    {/* <Route path="/category-orders" element={<CategoryOrder />} /> */}
                </Route>
            </Route>

            {/* fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    )
}
