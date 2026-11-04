import { Arsenal } from './components/Arsenal'
import { Ctf } from './components/Ctf'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Outcomes } from './components/Outcomes'
import { Register } from './components/Register'
import { Schedule } from './components/Schedule'
import { Spotlight } from './components/Spotlight'

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Navbar />
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
