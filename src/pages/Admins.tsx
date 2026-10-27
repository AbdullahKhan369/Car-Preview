import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Skeleton, Spinner } from '../components/Spinner'
import { useAuth } from '../hooks/useAuth'
import { createAdmin, deleteAdmin, updateAdminPassword } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { AdminRow } from '../lib/types'
import { errorMessage, fmtDate } from '../lib/utils'

const pw = z.string().min(8, 'Use at least 8 characters').max(72, 'Max 72 characters')
const addSchema = z.object({ email: z.string().trim().min(1, 'Enter an email').email('Enter a valid email'), password: pw })
const pwSchema = z.object({ password: pw, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export default function Admins() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [resetFor, setResetFor] = useState<AdminRow | null>(null)
  const [removeFor, setRemoveFor] = useState<AdminRow | null>(null)

  const list = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admins').select('*').order('created_at')
      if (error) throw error
      return (data ?? []) as AdminRow[]
    },
  })
  const admins = list.data ?? []

  // ----- add admin -----
  const add = useForm<z.infer<typeof addSchema>>({ resolver: zodResolver(addSchema) })
  const addM = useMutation({
    mutationFn: (v: z.infer<typeof addSchema>) => createAdmin(v.email, v.password),
    onSuccess: (r) => { toast.success(`Added ${r.email}`); add.reset(); qc.invalidateQueries({ queryKey: ['admins'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  // ----- my password -----
  const mine = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) })
  const mineM = useMutation({
    mutationFn: async (v: z.infer<typeof pwSchema>) => { const { error } = await supabase.auth.updateUser({ password: v.password }); if (error) throw error },
    onSuccess: () => { toast.success('Your password was changed'); mine.reset() },
    onError: (e) => toast.error(errorMessage(e)),
  })

  // ----- reset someone else -----
  const reset = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) })
  const resetM = useMutation({
    mutationFn: (v: z.infer<typeof pwSchema>) => updateAdminPassword(resetFor!.user_id, v.password),
    onSuccess: () => { toast.success('Password updated'); setResetFor(null); reset.reset() },
    onError: (e) => toast.error(errorMessage(e)),
  })

  // ----- delete -----
  const delM = useMutation({
    mutationFn: (id: string) => deleteAdmin(id),
    onSuccess: () => { toast.success('Admin removed'); setRemoveFor(null); qc.invalidateQueries({ queryKey: ['admins'] }) },
    onError: (e) => { toast.error(errorMessage(e)); setRemoveFor(null) },
  })

  return (
    <div className="space-y-6 sm:space-y-8">
      <Helmet><title>Admins | Car Preview</title></Helmet>
      <h1 className="text-xl font-extrabold text-zinc-100 sm:text-2xl">Admins</h1>

      <section className="card overflow-hidden" aria-label="All admins">
        {list.isLoading ? <div className="p-4"><Skeleton className="h-16" /></div> : list.isError ? <p className="p-4 text-red-400">{errorMessage(list.error)}</p> : (
          <ul className="divide-y divide-ink-700">
            {admins.map((a) => (
              <li key={a.user_id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 break-all font-semibold text-zinc-100">{a.email}{a.user_id === user?.id && <span className="badge bg-accent/15 text-accent">you</span>}</p>
                  <p className="text-xs text-zinc-500">Added {fmtDate(a.created_at)}</p>
                </div>
                {a.user_id !== user?.id && (
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button className="btn-ghost" onClick={() => setResetFor(a)}><KeyRound className="h-4 w-4" /> Reset password</button>
                    <button className="btn-ghost !text-red-400" disabled={admins.length <= 1} onClick={() => setRemoveFor(a)}><Trash2 className="h-4 w-4" /> Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form className="card space-y-4 p-4" noValidate onSubmit={add.handleSubmit((v) => addM.mutate(v))}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-100"><UserPlus className="h-5 w-5 text-accent" /> Add an admin</h2>
          <div>
            <label className="label" htmlFor="new-email">Email</label>
            <input id="new-email" type="email" autoComplete="off" className="input" {...add.register('email')} />
            {add.formState.errors.email && <p className="err">{add.formState.errors.email.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="new-pass">Password</label>
            <input id="new-pass" type="password" autoComplete="new-password" className="input" {...add.register('password')} />
            {add.formState.errors.password && <p className="err">{add.formState.errors.password.message}</p>}
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={addM.isPending}>{addM.isPending && <Spinner className="h-4 w-4" />} Add admin</button>
        </form>

        <form className="card space-y-4 p-4" noValidate onSubmit={mine.handleSubmit((v) => mineM.mutate(v))}>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-100"><KeyRound className="h-5 w-5 text-accent" /> Change my password</h2>
          <div>
            <label className="label" htmlFor="my-pass">New password</label>
            <input id="my-pass" type="password" autoComplete="new-password" className="input" {...mine.register('password')} />
            {mine.formState.errors.password && <p className="err">{mine.formState.errors.password.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="my-pass2">Repeat password</label>
            <input id="my-pass2" type="password" autoComplete="new-password" className="input" {...mine.register('confirm')} />
            {mine.formState.errors.confirm && <p className="err">{mine.formState.errors.confirm.message}</p>}
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={mineM.isPending}>{mineM.isPending && <Spinner className="h-4 w-4" />} Update password</button>
        </form>
      </div>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password for ${resetFor?.email ?? ''}`}>
        <form className="space-y-4" noValidate onSubmit={reset.handleSubmit((v) => resetM.mutate(v))}>
          <div>
            <label className="label" htmlFor="r-pass">New password</label>
            <input id="r-pass" type="password" autoComplete="new-password" className="input" {...reset.register('password')} />
            {reset.formState.errors.password && <p className="err">{reset.formState.errors.password.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="r-pass2">Repeat password</label>
            <input id="r-pass2" type="password" autoComplete="new-password" className="input" {...reset.register('confirm')} />
            {reset.formState.errors.confirm && <p className="err">{reset.formState.errors.confirm.message}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setResetFor(null)}>Cancel</button>
            <button className="btn-primary w-full sm:w-auto" disabled={resetM.isPending}>{resetM.isPending && <Spinner className="h-4 w-4" />} Save password</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!removeFor} danger busy={delM.isPending} title="Remove this admin?" confirmLabel="Remove admin" onCancel={() => setRemoveFor(null)} onConfirm={() => removeFor && delM.mutate(removeFor.user_id)}
        message={<><strong className="text-zinc-200">{removeFor?.email}</strong> will no longer be able to log in. The last remaining admin can never be removed.</>} />
    </div>
  )
}
