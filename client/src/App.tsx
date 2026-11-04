import { Arsenal } from './components/Arsenal'
import { AuthPage } from './components/AuthPage'
import { Ctf } from './components/Ctf'
import { Dashboard } from './components/Dashboard'
import { Profile } from './components/Profile'
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
import { useEffect } from 'react'

const CONSOLE = ['/dashboard', '/profile']

export default function App() {
  const path = usePathname()
  const { session } = useAuth()
  // Signed-in students live in the console: any other URL (site, /login, /register) goes to the dashboard.
  const redirect = !!session && !CONSOLE.includes(path)
  useEffect(() => {
    if (redirect) navigate('/dashboard', true)
  }, [redirect, path])
  if (redirect) return null

  if (CONSOLE.includes(path)) {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        {path === '/profile' ? <Profile /> : <Dashboard />}
      </>
    )
  }
  if (path === '/login' || path === '/register') {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <AuthPage mode={path === '/login' ? 'login' : 'register'} />
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
