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
        <Schedule />
        <Spotlight />
        <Ctf />
        <Outcomes />
        <Register />
      </main>
      <Footer />
    </>
  )
}
