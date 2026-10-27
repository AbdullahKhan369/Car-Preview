import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8 text-center sm:px-6">
      <Helmet>
        <title>Car Preview</title>
        <meta name="description" content="Share car photos with a single link." />
      </Helmet>
      <Logo size="lg" />
      <p className="max-w-sm text-zinc-400">Share car photos and details with one link. No app, no login for viewers.</p>
      <Link to="/admin/login" className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">Admin login</Link>
    </div>
  )
}
