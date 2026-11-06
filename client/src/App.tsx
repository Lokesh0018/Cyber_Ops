import { Arsenal } from './components/Arsenal'
import { Ctf } from './components/Ctf'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Outcomes } from './components/Outcomes'
import { Register } from './components/Register'
import { Schedule } from './components/Schedule'
import { Spotlight } from './components/Spotlight'
import { WelcomeBanner } from './components/WelcomeBanner'
import { useAuth } from './hooks/useAuth'
import { navigate, usePathname } from './hooks/useRoute'
import { lazy, Suspense, useEffect } from 'react'

// Code-split: a visitor to the landing page doesn't download the admin console, the student dashboard or the auth screens (and vice versa).
const AdminPage = lazy(() => import('./components/admin/AdminPage').then((m) => ({ default: m.AdminPage })))
const AuthPage = lazy(() => import('./components/AuthPage').then((m) => ({ default: m.AuthPage })))
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })))
const Profile = lazy(() => import('./components/Profile').then((m) => ({ default: m.Profile })))
const RouteWait = () => <div className="route-wait" role="status" aria-live="polite">loading…</div>

const CONSOLE = ['/dashboard', '/profile']
const ADMIN = '/admin'

export default function App() {
  const path = usePathname()
  const { session } = useAuth()
  // Signed-in students live in the console: any other URL (site, /login, /register) goes to the dashboard.
  const redirect = !!session && !CONSOLE.includes(path) && path !== ADMIN
  useEffect(() => {
    if (redirect) navigate('/dashboard', true)
  }, [redirect, path])
  if (redirect) return null

  if (path === ADMIN) {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <Suspense fallback={<RouteWait />}><AdminPage /></Suspense>
      </>
    )
  }

  if (CONSOLE.includes(path)) {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <Suspense fallback={<RouteWait />}>{path === '/profile' ? <Profile /> : <Dashboard />}</Suspense>
      </>
    )
  }
  if (path === '/login' || path === '/register') {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <Suspense fallback={<RouteWait />}><AuthPage mode={path === '/login' ? 'login' : 'register'} /></Suspense>
      </>
    )
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Navbar />
      <WelcomeBanner />
      <main id="main">
        <Hero />
        <Arsenal />
        {/* Schedule + Spotlight share one fixed Kali watermark that stays put while scrolling through both */}
        <div className="kali-zone">
          <div className="kali-zone-bg" aria-hidden="true">
            <div className="kali-watermark" />
          </div>
          <Schedule />
          <Spotlight />
        </div>
        <Ctf />
        <Outcomes />
        <Register />
      </main>
      <Footer />
    </>
  )
}
