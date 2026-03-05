import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import GlobalSearch from '../common/GlobalSearch'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface border-b border-edge">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-fg-muted hover:text-fg"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-fg">Le Mie Lezioni</h1>
        </header>

        {/* Global search */}
        <div className="sticky top-0 z-10 bg-canvas px-4 pt-4 pb-2 md:px-6 md:pt-6 lg:px-8 lg:pt-8">
          <GlobalSearch />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
