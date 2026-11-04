export type Accent = 'accent' | 'brand-2' | 'magenta' | 'amber' | 'violet'

export interface ToolCategory {
  title: string
  count: string
  accent: Accent
  tools: string[]
  /** In-house entries get a violet-tinted border on each tag. */
  inHouse?: boolean
}

export const arsenal: ToolCategory[] = [
  {
    title: 'OSINT & Recon',
    count: '13',
    accent: 'accent',
    tools: ['OSINT Framework', 'Maltego', 'SpiderFoot', 'Recon-ng', 'theHarvester', 'Amass', 'Sublist3r', 'Shodan', 'httpx', 'Katana', 'Gobuster', 'WhatWeb', 'ffuf'],
  },
  {
    title: 'Web Exploitation',
    count: '10',
    accent: 'magenta',
    tools: ['Burp Suite Pro', 'OWASP ZAP', 'SQLmap', 'Nuclei', 'XSStrike', 'Commix', 'WPScan', 'Nikto', 'dirsearch', 'wfuzz'],
  },
  {
    title: 'Network & Scanning',
    count: '09',
    accent: 'brand-2',
    tools: ['Nmap', 'Masscan', 'Wireshark', 'tcpdump', 'Netcat', 'Responder', 'Bettercap', 'NetExec', 'Tshark'],
  },
  {
    title: 'Exploitation & C2',
    count: '08',
    accent: 'magenta',
    tools: ['Metasploit', 'Sliver C2', 'Empire', 'Havoc', 'Impacket', 'searchsploit', 'Weevely', 'msfvenom'],
  },
  {
    title: 'Password Cracking',
    count: '07',
    accent: 'amber',
    tools: ['Hashcat', 'John the Ripper', 'Hydra', 'Medusa', 'hashid', 'CeWL', 'Crunch'],
  },
  {
    title: 'Wireless Attacks',
    count: '06',
    accent: 'accent',
    tools: ['Aircrack-ng', 'Wifite', 'Kismet', 'Reaver', 'Bettercap', 'hcxdumptool'],
  },
  {
    title: 'Privilege Escalation',
    count: '06',
    accent: 'amber',
    tools: ['LinPEAS', 'WinPEAS', 'GTFOBins', 'pspy', 'linux-exploit-suggester', 'PowerUp'],
  },
  {
    title: 'Forensics & Stego',
    count: '08',
    accent: 'amber',
    tools: ['Autopsy', 'Volatility', 'Steghide', 'ExifTool', 'CyberChef', 'zsteg', 'Binwalk', 'foremost'],
  },
  {
    title: 'SHM AutoVAPT',
    count: '★',
    accent: 'violet',
    tools: ['Our in-house', 'automated engine', 'OWASP-mapped report'],
    inHouse: true,
  },
]

export const kaliStats = [
  { num: '100+', label: 'Security Tools' },
  { num: '8', label: 'Attack Domains' },
  { num: '1', label: 'In-house Tool', violet: true },
]

export type BreakKind = 'tea' | 'lunch'
export type BadgeKind = 'off' | 'flag' | 'tool'

export interface Session {
  time: string
  title: string
  desc?: string
  tools?: string[]
  /** Renders the row in the day-2 violet accent. */
  violet?: boolean
  breakKind?: BreakKind
  badge?: { kind: BadgeKind; label: string } | { kind: 'flag'; trophy: true }
}

export interface Phase {
  label: string
  sessions: Session[]
}

export interface Day {
  num: string
  title: string
  meta: string
  violet?: boolean
  phases: Phase[]
}

export const schedule: Day[] = [
  {
    num: '01',
    title: 'Fundamentals & Hands-on Practical',
    meta: '09:00 – 17:00 · foundations, recon, exploitation, first CTF',
    phases: [
      {
        label: 'Morning · Theory & Tools Introduction',
        sessions: [
          { time: '09:00–09:30', title: 'Inauguration & Kickoff', desc: 'Welcome, objectives, and the cybersecurity landscape overview.' },
          { time: '09:30–10:15', title: 'Cybersecurity Fundamentals', desc: 'CIA triad, threats & vulnerabilities, attack surfaces, risk management.' },
          { time: '10:15–10:30', title: 'Tea Break', breakKind: 'tea' },
          { time: '10:30–11:15', title: 'Web Application Security', desc: 'HTTP/HTTPS, OWASP Top 10, authentication & sessions, SQL injection, XSS.' },
          { time: '11:15–12:00', title: 'Network Security Fundamentals', desc: 'OSI model, IP addressing, TCP/UDP, ports, and DNS.' },
          { time: '12:00–12:30', title: 'OSINT & Information Gathering', desc: 'Passive reconnaissance and public-source intelligence.', tools: ['OSINT Framework'] },
          {
            time: '12:30–13:00',
            title: 'Web Recon, Enumeration & Vuln Assessment',
            desc: 'Subdomain mapping, endpoint discovery, and automated vulnerability identification.',
            tools: ['Amass', 'httpx', 'Katana', 'Gobuster', 'WhatWeb', 'Nuclei'],
          },
          { time: '13:00–14:00', title: 'Lunch Break', breakKind: 'lunch' },
        ],
      },
      {
        label: 'Afternoon · Hands-on Practical & Beginner CTF',
        sessions: [
          { time: '14:00–14:45', title: 'Web Application Security Practical', desc: 'Intercept, tamper, and exploit a live target in the lab.', tools: ['Burp Suite', 'OWASP ZAP', 'SQLmap'] },
          { time: '14:45–15:30', title: 'Network Security Practical', desc: 'Scanning, packet capture, and traffic analysis.', tools: ['Nmap', 'Wireshark', 'Netcat', 'tcpdump'] },
          { time: '15:30–15:45', title: 'Tea Break', breakKind: 'tea' },
          {
            time: '15:45–16:15',
            title: 'Exploitation & Password Security',
            desc: 'Framework-driven exploitation, brute-forcing, and web shells.',
            tools: ['Metasploit', 'Hydra', 'Weevely'],
            badge: { kind: 'off', label: 'Offensive' },
          },
          {
            time: '16:15–16:35',
            title: 'Steganography & Digital Forensics',
            desc: 'Hidden-data extraction and artifact analysis.',
            tools: ['Steghide', 'ExifTool', 'CyberChef', 'zsteg', 'Binwalk'],
          },
          {
            time: '16:35–17:00',
            title: 'Beginner CTF Challenge',
            desc: "Warm-up web, network & steganography flags to lock in the day's skills.",
            badge: { kind: 'flag', label: 'Flags' },
          },
        ],
      },
    ],
  },
  {
    num: '02',
    title: 'Our Automated Tool, Advanced Practical & CTF',
    meta: '09:00 – 18:00 · SHM AutoVAPT, live competition, awards',
    violet: true,
    phases: [
      {
        label: "Morning · SHM's Automated Security Tool",
        sessions: [
          { time: '09:00–09:30', title: 'Day 1 Recap', desc: 'Quick review of concepts, tools, and the practical workflow.', violet: true },
          {
            time: '09:30–10:15',
            title: 'Introducing SHM AutoVAPT',
            desc: 'Purpose, features, architecture, and where it fits in a real assessment.',
            violet: true,
            badge: { kind: 'tool', label: 'Our Tool' },
          },
          { time: '10:15–10:30', title: 'Tea Break', breakKind: 'tea' },
          { time: '10:30–11:30', title: 'Live Tool Demonstration', desc: 'End-to-end scan walkthrough: recon → vuln checks → OWASP-mapped HTML report.', violet: true },
          { time: '11:30–12:30', title: 'Hands-on Tool Practice', desc: 'Participants run the tool against a controlled lab target.', violet: true },
          { time: '12:30–13:00', title: 'Q&A Session', desc: 'Discussion, troubleshooting, and participant queries.', violet: true },
          { time: '13:00–14:00', title: 'Lunch Break', breakKind: 'lunch' },
        ],
      },
      {
        label: 'Afternoon · Tool Practical, CTF & Awards',
        sessions: [
          { time: '14:00–15:00', title: 'Tool-Based Practical', desc: 'Apply SHM AutoVAPT to a sample web/network environment and read the findings.', violet: true },
          {
            time: '15:00–17:00',
            title: 'CTF Competition',
            desc: 'Web, network, OSINT & steganography challenges — individual scoreboard, live ranking.',
            badge: { kind: 'flag', label: '2 hrs' },
          },
          { time: '17:00–17:30', title: 'Evaluation', desc: 'CTF scoring, performance review, and participant feedback.', violet: true },
          {
            time: '17:30–18:00',
            title: 'Closing Ceremony & Awards',
            desc: 'Winner announcement, awards, certificates, and vote of thanks.',
            violet: true,
            badge: { kind: 'flag', trophy: true },
          },
        ],
      },
    ],
  },
]

export const autovaptFeatures = [
  { title: 'One-click recon', desc: 'DNS, WHOIS, subdomains, TLS, headers & tech fingerprinting.' },
  { title: 'Automated web checks', desc: 'OWASP Top 10 surface tests with source & API discovery.' },
  { title: 'Port & service scan', desc: 'Network exposure mapping alongside the web assessment.' },
  { title: 'Shareable HTML report', desc: 'Findings, severity, and evidence in one portable document.' },
]

export const ctfCategories = [
  { code: 'WEB', title: 'Web Security', desc: 'Injection, auth bypass, logic flaws' },
  { code: 'NET', title: 'Network', desc: 'Scanning, pcap, service hunting' },
  { code: 'OSINT', title: 'OSINT', desc: 'Open-source intel tracking' },
  { code: 'STEG', title: 'Steganography', desc: 'Hidden data & forensics' },
]

export const outcomes = [
  { title: 'A working security foundation', desc: 'Confidence across fundamentals, OSINT, web, and network security.' },
  { title: 'Real tool fluency', desc: 'Hands-on reps with 100+ professional offensive & defensive tools on Kali Linux.' },
  { title: 'Automated VAPT experience', desc: 'Run SHM AutoVAPT end-to-end and interpret a live assessment report.' },
  { title: 'CTF & a certificate', desc: 'Competition scoring, performance feedback, and a completion certificate.' },
]

export const contactEmail = 'shmtechnologies77@gmail.com'

export const navLinks = [
  { id: 'arsenal', label: 'Arsenal' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'autovapt', label: 'AutoVAPT' },
  { id: 'ctf', label: 'CTF' },
  { id: 'outcomes', label: 'Outcomes' },
]

export const heroStats = [
  { num: '2', label: 'Immersive days' },
  { num: '16+', label: 'Hours hands-on' },
  { num: '100+', label: 'Kali Linux tools' },
  { num: '4', label: 'CTF categories' },
]

export const included = [
  '2 days of hands-on labs',
  'Kali Linux lab environment',
  'Live SHM AutoVAPT session',
  'CTF competition & awards',
  'Certificate of completion',
]
