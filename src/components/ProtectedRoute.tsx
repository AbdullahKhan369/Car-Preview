import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FullPageSpinner } from './Spinner'
import Logo from './Logo'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, signOut } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/admin/login" state={{ from: loc.pathname }} replace />
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center sm:p-6">
        <Logo />
        <h1 className="text-xl font-bold text-zinc-100">This account is not an admin</h1>
        <p className="max-w-sm text-sm text-zinc-400">You are signed in, but your email has not been added as an admin. Ask an existing admin to add you.</p>
        <button className="btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    )
  }
  return <>{children}</>
}
