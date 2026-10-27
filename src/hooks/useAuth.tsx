import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [checkedFor, setCheckedFor] = useState<string | null>(null)
  const [adminFlag, setAdminFlag] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  // Admin membership is checked against the `admins` table (RLS lets you read your own row).
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setAdminFlag(!!data)
        setCheckedFor(uid)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setAdminFlag(false)
    setCheckedFor(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      isAdmin: !!uid && checkedFor === uid && adminFlag,
      loading: sessionLoading || (!!uid && checkedFor !== uid),
      signOut,
    }),
    [session, uid, checkedFor, adminFlag, sessionLoading, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
