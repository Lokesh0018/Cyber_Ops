import { Arsenal } from './components/Arsenal'
import { Hero } from './components/Hero'
import { Schedule } from './components/Schedule'
import { Ctf, Footer, Outcomes, Spotlight } from './components/Sections'

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="wrap">
        <Hero />
        <main id="main">
          <Arsenal />
          <Schedule />
          <Spotlight />
          <Ctf />
          <Outcomes />
        </main>
        <Footer />
      </div>
    </>
  )
}
