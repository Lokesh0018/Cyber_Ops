import { Arsenal } from './components/Arsenal'
import { AuthPage } from './components/AuthPage'
import { Ctf } from './components/Ctf'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Outcomes } from './components/Outcomes'
import { Register } from './components/Register'
import { Schedule } from './components/Schedule'
import { Spotlight } from './components/Spotlight'
import { WelcomeBanner } from './components/WelcomeBanner'
import { usePathname } from './hooks/useRoute'

export default function App() {
  const path = usePathname()
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
