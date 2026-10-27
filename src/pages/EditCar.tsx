import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import CarForm from '../components/CarForm'
import { Skeleton } from '../components/Spinner'
import { supabase } from '../lib/supabase'
import type { Car, CarFile } from '../lib/types'

export default function EditCar() {
  const { id } = useParams()
  const q = useQuery({
    queryKey: ['car', id],
    enabled: !!id,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: car, error } = await supabase.from('cars').select('*').eq('id', id!).maybeSingle()
      if (error) throw error
      if (!car) return null
      const { data: files, error: fErr } = await supabase.from('car_files').select('*').eq('car_id', id!).order('sort_order')
      if (fErr) throw fErr
      return { car: car as Car, files: (files ?? []) as CarFile[] }
    },
  })
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-9 w-48" /><Skeleton className="h-64" /></div>
  if (q.isError) return <p className="text-red-400">Could not load this car: {(q.error as Error).message}</p>
  if (!q.data) return <div className="px-4 py-12 text-center sm:py-16"><p className="mb-4 text-zinc-300">This car no longer exists.</p><Link to="/admin" className="btn-ghost">Back to dashboard</Link></div>
  return (
    <>
      <Helmet><title>Edit {q.data.car.title} | Car Preview</title></Helmet>
      <CarForm key={q.data.car.id} mode="edit" car={q.data.car} initialFiles={q.data.files} />
    </>
  )
}
