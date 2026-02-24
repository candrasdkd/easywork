import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'

export default function AppShell() {
    return (
        <div className="min-h-screen bg-slate-50 transition-colors duration-300">
            <Navbar />
            <main className="pt-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="py-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
