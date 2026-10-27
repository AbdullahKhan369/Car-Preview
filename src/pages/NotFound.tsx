import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export function NotFoundView({ title = 'Page not found', message = 'This link may be mistyped, or the car was removed.' }: { title?: string; message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6">
      <Logo />
      <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-zinc-100">{title}</h1>
      <p className="max-w-sm text-zinc-400">{message}</p>
      <Link to="/" className="btn-ghost mt-2">Go to home</Link>
    </div>
  )
}

export default function NotFound() {
  return (
    <>
      <Helmet><title>Not found | Car Preview</title><meta name="robots" content="noindex" /></Helmet>
      <NotFoundView />
    </>
  )
}
