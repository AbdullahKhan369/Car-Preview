import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { isConfigured } from './lib/env'
import Admins from './pages/Admins'
import Dashboard from './pages/Dashboard'
import EditCar from './pages/EditCar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import NewCar from './pages/NewCar'
import NotFound from './pages/NotFound'
import PublicCar from './pages/PublicCar'

export default function App() {
  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="card w-full max-w-lg space-y-3 p-4 sm:p-6">
          <h1 className="text-xl font-bold text-zinc-100">Setup needed</h1>
          <p className="break-words text-sm text-zinc-400">
            Add <code className="rounded bg-ink-700 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-ink-700 px-1">VITE_SUPABASE_ANON_KEY</code> to your
            environment (copy <code className="rounded bg-ink-700 px-1">.env.example</code> to <code className="rounded bg-ink-700 px-1">.env</code>), then restart.
          </p>
        </div>
      </div>
    )
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewCar />} />
        <Route path="cars/:id" element={<EditCar />} />
        <Route path="admins" element={<Admins />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
      {/* Public car pages. Keep after /admin so a slug can never swallow it. */}
      <Route path="/:slug" element={<PublicCar />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
