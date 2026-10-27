import { LayoutGrid, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Logo from './Logo'

const link = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-200'}`

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:px-4">
          <Logo to="/admin" />
          <nav className="no-scrollbar order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:mx-0 sm:ml-2 sm:w-auto sm:flex-1 sm:px-0" aria-label="Admin">
            <NavLink to="/admin" end className={link}><LayoutGrid className="h-4 w-4" /> Cars</NavLink>
            <NavLink to="/admin/new" className={link}><Plus className="h-4 w-4" /> New car</NavLink>
            <NavLink to="/admin/admins" className={link}><ShieldCheck className="h-4 w-4" /> Admins</NavLink>
          </nav>
          <span className="hidden max-w-[200px] truncate text-xs text-zinc-500 md:block">{user?.email}</span>
          <button className="btn-icon ml-auto shrink-0 sm:ml-0" aria-label="Sign out" title="Sign out" onClick={async () => { await signOut(); navigate('/admin/login') }}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
