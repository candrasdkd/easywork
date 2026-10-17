import * as React from 'react'
import { Outlet } from 'react-router'
import Navbar from '../components/Navbar'

export default function AppShell() {
    const [sidebarHidden, setSidebarHidden] = React.useState(false)

    return (
        <div className="min-h-screen bg-slate-50 transition-colors duration-300">
            <Navbar desktopHidden={sidebarHidden} onToggleDesktop={() => setSidebarHidden((hidden) => !hidden)} />
            <main className={`min-h-screen px-4 pt-16 transition-[margin] duration-200 sm:px-6 lg:px-8 ${sidebarHidden ? 'lg:ml-0 lg:pt-16' : 'lg:ml-72 lg:pt-0'}`}>
                <div className="mx-auto max-w-7xl py-6">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
