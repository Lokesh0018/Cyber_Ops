import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** A coloured run of text inside an output line (classes: o muted, ok green, v violet, c accent, p prompt). */
type Seg = { c?: string; t: string }
type Step =
  | { k: 'cmd'; name: string; args: string } // typed character by character after a "$"
  | { k: 'out'; segs: Seg[] } // streamed quickly, like command output
  | { k: 'bar'; label: string } // a progress bar that fills to 100%

// Short lines on purpose (<= ~44 chars) so nothing wraps on phones and the fixed-height screen always shows whole lines.
const SCENES: Step[][] = [
  [
    { k: 'cmd', name: './bootcamp', args: '--days 2 --mode hands-on' },
    { k: 'out', segs: [{ c: 'o', t: '[+] Kali toolset ............ ' }, { c: 'ok', t: '100+ ready' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] Recon · Web · Network · Exploit ' }, { c: 'ok', t: 'online' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] Lab targets ............. ' }, { c: 'ok', t: 'isolated' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] Wordlists · payloads · exploits ' }, { c: 'ok', t: 'synced' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] Instructor-led labs ...... ' }, { c: 'ok', t: 'day 1-2' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] Day 2 module ..... ' }, { c: 'v', t: 'SHM AutoVAPT' }] },
    { k: 'bar', label: 'lab provisioning' },
    { k: 'out', segs: [{ c: 'o', t: '[*] CTF scoreboard live: capture the flag.' }] },
  ],
  [
    { k: 'cmd', name: 'nmap', args: '-sV -p- 10.10.14.7' },
    { k: 'out', segs: [{ c: 'o', t: 'Host is up (0.8ms latency).' }] },
    { k: 'out', segs: [{ c: 'ok', t: '22/tcp  ' }, { c: 'o', t: 'open  ssh    OpenSSH 8.9' }] },
    { k: 'out', segs: [{ c: 'ok', t: '80/tcp  ' }, { c: 'o', t: 'open  http   Apache 2.4.52' }] },
    { k: 'out', segs: [{ c: 'ok', t: '3306/tcp' }, { c: 'o', t: ' open  mysql  MySQL 8.0' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] 3 services found. Next: enumerate.' }] },
  ],
  [
    { k: 'cmd', name: 'sqlmap', args: '-u lab.local/item?id=1 --dbs' },
    { k: 'out', segs: [{ c: 'o', t: "[*] testing 'UNION query' injection ..." }] },
    { k: 'out', segs: [{ c: 'o', t: "[+] parameter 'id' is " }, { c: 'ok', t: 'injectable' }] },
    { k: 'out', segs: [{ c: 'o', t: '[+] databases [2]: ' }, { c: 'c', t: 'shop, users' }] },
    { k: 'out', segs: [{ c: 'ok', t: '[+] flag{sql_1njection_w1n} captured!' }] },
  ],
  [
    { k: 'cmd', name: './scoreboard', args: '--live' },
    { k: 'out', segs: [{ c: 'ok', t: ' 1 ' }, { c: 'o', t: 'ghost_in_shell ...... ' }, { c: 'c', t: '3750 pts' }] },
    { k: 'out', segs: [{ c: 'ok', t: ' 2 ' }, { c: 'o', t: 'r00t_kitty .......... ' }, { c: 'c', t: '2800 pts' }] },
    { k: 'out', segs: [{ c: 'ok', t: ' 3 ' }, { c: 'o', t: 'n0_sh3ll ............ ' }, { c: 'c', t: '2450 pts' }] },
    { k: 'out', segs: [{ c: 'o', t: '[*] 7 flags · 2 hrs · game on.' }] },
  ],
]

/** Title-bar tab for each scene, in scene order. */
export const SCENE_TABS = ['bootcamp.sh', 'recon', 'exploit', 'ctf']

type View =
  | { id: number; k: 'cmd'; name: string; args: string; n: number } // n = characters typed so far
  | { id: number; k: 'out'; segs: Seg[]; n: number }
  | { id: number; k: 'bar'; label: string; pct: number }

const MAX_LINES = 16 // older lines scroll off the top and are dropped, so state never grows
const total = (segs: Seg[]) => segs.reduce((a, s) => a + s.t.length, 0)
const cmdText = (s: { name: string; args: string }) => s.name + (s.args ? ' ' + s.args : '')

/** First `n` characters of a segmented line, keeping each run's colour. */
function Segs({ segs, n }: { segs: Seg[]; n: number }) {
  let left = n
  return (
    <>
      {segs.map((s, i) => {
        if (left <= 0) return null
        const t = s.t.slice(0, left)
        left -= t.length
        const m = i === 0 ? /^\[([+*!])\]/.exec(t) : null // a complete leading marker gets its own colour: [+] green, [*] blue
        if (m) return <span key={i}><span className={m[1] === '+' ? 'ok' : m[1] === '*' ? 'c' : 'v'}>{m[0]}</span><span className={s.c}>{t.slice(m[0].length)}</span></span>
        return <span key={i} className={s.c}>{t}</span>
      })}
    </>
  )
}

function Line({ v, cursor }: { v: View; cursor: boolean }) {
  const caret = cursor ? <span className="cursor" /> : null
  if (v.k === 'bar') {
    return (
      <div className="tl-line tl-progress">
        <span className="o">{v.label}</span>
        <span className="bar"><span style={{ transform: `scaleX(${v.pct / 100})` }} /></span>
        <span className="ok">{v.pct}%</span>
        {caret}
      </div>
    )
  }
  if (v.k === 'cmd') {
    const typed = cmdText(v).slice(0, v.n)
    return (
      <div className="tl-line">
        <span className="p">$</span> <span className="c">{typed.slice(0, v.name.length)}</span>
        {typed.slice(v.name.length).split(/( +)/).map((tok, i) => (tok.startsWith('-') ? <span key={i} className="v">{tok}</span> : tok))}{caret}
      </div>
    )
  }
  return <div className="tl-line"><Segs segs={v.segs} n={v.n} />{caret}</div>
}

/** What the screen shows when motion is reduced: scene one, fully "typed". */
const staticScreen = (): View[] =>
  SCENES[0].map((s, i): View =>
    s.k === 'cmd' ? { id: i, k: 'cmd', name: s.name, args: s.args, n: cmdText(s).length }
    : s.k === 'out' ? { id: i, k: 'out', segs: s.segs, n: total(s.segs) }
    : { id: i, k: 'bar', label: s.label, pct: 100 })

/**
 * Hero terminal that types forever: each scene types a command character by character (with human-like timing), streams its output,
 * fills a progress bar, rests at a blinking prompt, then moves on to the next scene. It pauses (and resumes mid-word) while the terminal is
 * off screen or the tab is hidden, and shows a still frame when the visitor prefers reduced motion.
 */
export function TypingTerminal({ active, onScene }: { active: boolean; onScene?: (scene: number) => void }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [lines, setLines] = useState<View[]>(() => (reduce ? staticScreen() : []))
  const [busy, setBusy] = useState(false) // true while a scene is typing/streaming; false = resting at the prompt
  const [sceneIdx, setSceneIdx] = useState(0)
  const activeRef = useRef(active)
  activeRef.current = active
  const onSceneRef = useRef(onScene)
  onSceneRef.current = onScene

  useEffect(() => {
    if (reduce) return
    let dead = false
    let seq = 0
    let scene = 0
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
    // pause here (without losing our place) while off screen or in a background tab
    const gate = async () => { while (!dead && (!activeRef.current || document.hidden)) await wait(150) }
    const pause = async (ms: number) => { await wait(ms); await gate() }
    const push = (v: View) => setLines((l) => [...l.slice(-(MAX_LINES - 1)), v])
    const patch = (id: number, p: Record<string, number>) => setLines((l) => l.map((x) => (x.id === id ? ({ ...x, ...p } as View) : x)))

    ;(async () => {
      await gate()
      while (!dead) {
        setBusy(true)
        setSceneIdx(scene % SCENES.length)
        onSceneRef.current?.(scene % SCENES.length)
        for (const step of SCENES[scene % SCENES.length]) {
          if (dead) return
          const id = ++seq
          if (step.k === 'cmd') {
            push({ id, k: 'cmd', name: step.name, args: step.args, n: 0 })
            const full = cmdText(step)
            for (let i = 1; i <= full.length; i++) {
              patch(id, { n: i })
              await pause(38 + Math.random() * 62 + (full[i - 1] === ' ' ? 60 : 0)) // a little slower after spaces, like a person
              if (dead) return
            }
            await pause(380) // "press Enter"
          } else if (step.k === 'out') {
            const len = total(step.segs)
            push({ id, k: 'out', segs: step.segs, n: 0 })
            for (let i = 1; i <= len; i++) { patch(id, { n: i }); await pause(9); if (dead) return } // output streams in fast
            await pause(160)
          } else {
            push({ id, k: 'bar', label: step.label, pct: 0 })
            for (let p = 4; p <= 100; p += 4) { patch(id, { pct: p }); await pause(34); if (dead) return }
            await pause(200)
          }
        }
        scene++
        setBusy(false)
        await pause(2400) // rest at the prompt (blinking cursor) before the next command
      }
    })()
    return () => { dead = true }
  }, [reduce])

  // like a real terminal: fill from the top, then keep the newest line in view (older ones scroll out of the top)
  const screen = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = screen.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    el.classList.toggle('tt-scrolled', el.scrollTop > 0)
  }, [lines, busy])

  const last = lines.length - 1
  return (
    <>
    <div className="term-body">
      <div className="tt-screen" ref={screen}>
        {lines.map((v, i) => <Line key={v.id} v={v} cursor={busy && i === last} />)}
        {(!busy || lines.length === 0) && (
          <div className="tl-line">
            <span className="p">participant@cyberops</span><span className="o">:~$</span> <span className={reduce ? 'cursor' : 'cursor blink'} />
          </div>
        )}
      </div>
    </div>
    <div className="term-status">
      <span className="ts-mode">{busy ? 'RUN' : 'IDLE'}</span>
      <span className="ts-name">{SCENE_TABS[sceneIdx]}</span>
      <span className="ts-dots" aria-hidden="true">{SCENE_TABS.map((t, i) => <i key={t} className={i === sceneIdx ? 'on' : ''} />)}</span>
      <span className="ts-enc">bash · UTF-8</span>
    </div>
    </>
  )
}
