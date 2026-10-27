import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import Logo from '../components/Logo'
import { FullPageSpinner, Spinner } from '../components/Spinner'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})
type V = z.infer<typeof schema>

export default function Login() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from || '/admin'
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) })

  if (loading) return <FullPageSpinner />
  if (session && isAdmin) return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async (v) => {
    setError('')
    const { error: e } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (e) return setError(e.message === 'Invalid login credentials' ? 'Wrong email or password.' : e.message)
    navigate(from, { replace: true })
  })

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Helmet><title>Admin login | Car Preview</title><meta name="robots" content="noindex" /></Helmet>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <form onSubmit={onSubmit} noValidate className="card space-y-4 p-4 sm:p-5">
          <h1 className="text-xl font-bold text-zinc-100">Admin login</h1>
          {session && !isAdmin && (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
              That account is not an admin. <button type="button" className="font-semibold underline" onClick={signOut}>Sign out</button>
            </p>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" aria-invalid={!!errors.email} {...register('email')} />
            {errors.email && <p className="err">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" className="input" aria-invalid={!!errors.password} {...register('password')} />
            {errors.password && <p className="err">{errors.password.message}</p>}
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting && <Spinner className="h-4 w-4" />} Log in</button>
        </form>
      </div>
    </div>
  )
}
