import { useState, useEffect, useCallback, useRef } from 'react'
import Scene3D from './components/Scene3D'
import './App.css'

/* ==========================================================================
   Hush Website — Main Application
   
   Six cinematic scroll-driven sections:
   01. Hero — Dramatic intro with the Hush audio core
   02. Enter — The audio universe of interconnected streams
   03. Control — Interactive per-tab volume demo
   04. Architecture — Visual flow of the audio pipeline
   05. Focus Modes — Interactive preset demonstrations
   06. Finale — The closing statement and CTAs
   ========================================================================== */

// --- Demo tab data for the interactive control panel ---
interface DemoTab {
  id: string
  name: string
  category: string
  icon: string
  iconClass: string
  volume: number
  muted: boolean
}

const INITIAL_TABS: DemoTab[] = [
  { id: 'yt', name: 'YouTube — Lo-fi beats', category: 'Entertainment', icon: '▶', iconClass: 'youtube', volume: 72, muted: false },
  { id: 'sp', name: 'Spotify — Deep Focus', category: 'Music', icon: '♫', iconClass: 'spotify', volume: 85, muted: false },
  { id: 'gm', name: 'Google Meet — Standup', category: 'Communication', icon: '📹', iconClass: 'meet', volume: 100, muted: false },
  { id: 'dc', name: 'Discord — Dev Chat', category: 'Communication', icon: '💬', iconClass: 'discord', volume: 40, muted: true },
]

// --- Focus mode presets ---
interface FocusMode {
  id: string
  name: string
  icon: string
  desc: string
  channels: { name: string; on: boolean }[]
}

const FOCUS_MODES: FocusMode[] = [
  {
    id: 'study',
    name: 'Deep Study',
    icon: '📚',
    desc: 'Silence distractions, keep study material audible.',
    channels: [
      { name: 'Study', on: true },
      { name: 'Music', on: true },
      { name: 'Social', on: false },
      { name: 'Entertainment', on: false },
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    icon: '🎮',
    desc: 'Max game audio, voice chat on, everything else off.',
    channels: [
      { name: 'Gaming', on: true },
      { name: 'Communication', on: true },
      { name: 'Music', on: false },
      { name: 'Social', on: false },
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting',
    icon: '🎙️',
    desc: 'Only communication tabs. Total silence elsewhere.',
    channels: [
      { name: 'Communication', on: true },
      { name: 'Music', on: false },
      { name: 'Entertainment', on: false },
      { name: 'Gaming', on: false },
    ],
  },
]

// --- Architecture pipeline nodes ---
const ARCH_NODES = [
  { label: 'Source', value: 'HTML5 <audio> / <video>' },
  { label: 'Intercept', value: 'Web Audio API Hook' },
  { label: 'Process', value: 'GainNode Pipeline' },
  { label: 'Control', value: 'Per-Tab Volume' },
  { label: 'Output', value: 'System Audio' },
]

export default function App() {
  const scrollRef = useRef(0)
  const [activeScene, setActiveScene] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  // --- Demo state ---
  const [tabs, setTabs] = useState<DemoTab[]>(INITIAL_TABS)
  const [activeFocus, setActiveFocus] = useState<string | null>(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  // --- Scroll tracking (zero-lag ref + RAF throttle) ---
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0
      scrollRef.current = progress

      if (!ticking) {
        requestAnimationFrame(() => {
          const sceneProgress = progress * 6
          const newScene = Math.min(Math.floor(sceneProgress), 5)
          setActiveScene((prev) => (prev !== newScene ? newScene : prev))

          const isScrolled = scrollTop > 60
          setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev))
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // --- Intersection observer for reveal animations ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    )

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // --- Demo handlers ---
  const handleVolumeChange = useCallback((id: string, volume: number) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, volume, muted: volume === 0 } : tab))
    )
  }, [])

  const handleMuteToggle = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, muted: !tab.muted } : tab))
    )
  }, [])

  return (
    <>
      {/* Fixed 3D background scene */}
      <Scene3D scrollRef={scrollRef} activeScene={activeScene} />

      {/* Navigation */}
      <nav className={`site-nav ${scrolled ? 'scrolled' : ''}`}>
        <a href="#" className="nav-logo">
          <span className="nav-logo-text">HUSH</span>
        </a>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#architecture" className="nav-link">How It Works</a>
          <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer" className="nav-link">GitHub</a>
          <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer" className="nav-cta">
            Add to Chrome
          </a>
        </div>
      </nav>

      {/* Scroll content */}
      <div className="hush-page">
        {/* ═══════════ Scene 01: Hero ═══════════ */}
        <section className="scroll-section hero-section" id="hero">
          <div className="hero-content">
            <h1 className="hero-title">HUSH</h1>
            <p className="hero-subtitle">
              Per-tab volume control, intelligent audio grouping, and focus modes
              for a quieter browser. Control every sound. Distract nothing.
            </p>
            <div className="hero-cta-group">
              <a
                href="https://github.com/abhishek-kumar-pundir/Hush"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary"
              >
                <span>Add to Chrome — Free</span>
              </a>
              <a href="#features" className="cta-secondary">
                <span>Explore Features</span>
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════ Scene 02: Enter the Audio Universe ═══════════ */}
        <section className="scroll-section scene-enter" id="features">
          <div className="scene-enter-content reveal">
            <p className="scene-label">The Audio Universe</p>
            <h2 className="scene-heading">
              Every tab is an<br />audio stream
            </h2>
            <p className="scene-body">
              Your browser is a symphony of competing sounds — notifications, music,
              video calls, background videos. Hush intercepts every audio stream at
              the Web Audio API level and gives you individual control over each one.
              No more "all or nothing" muting.
            </p>
          </div>
        </section>

        {/* ═══════════ Scene 03: Precision Control ═══════════ */}
        <section className="scroll-section scene-control" id="control">
          <div className="control-panel reveal">
            <p className="control-panel-title">Tab Volume Control</p>
            <div className="tab-demo">
              {tabs.map((tab, i) => (
                <div
                  key={tab.id}
                  className={`tab-demo-item ${i === activeTabIndex ? 'active' : ''}`}
                  onClick={() => setActiveTabIndex(i)}
                >
                  <div className={`tab-icon ${tab.iconClass}`}>{tab.icon}</div>
                  <div className="tab-info">
                    <div className="tab-name">{tab.name}</div>
                    <div className="tab-category">{tab.category}</div>
                  </div>
                  <div className="tab-volume-control">
                    <input
                      type="range"
                      className="volume-slider"
                      min="0"
                      max="100"
                      value={tab.muted ? 0 : tab.volume}
                      onChange={(e) => handleVolumeChange(tab.id, parseInt(e.target.value))}
                      style={{
                        background: `linear-gradient(to right, var(--hush-accent) ${tab.muted ? 0 : tab.volume}%, rgba(182,184,208,0.15) ${tab.muted ? 0 : tab.volume}%)`,
                      }}
                    />
                    <span className="volume-value">
                      {tab.muted ? '—' : `${tab.volume}%`}
                    </span>
                    <button
                      className={`mute-btn ${tab.muted ? 'muted' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMuteToggle(tab.id)
                      }}
                    >
                      {tab.muted ? '🔇' : '🔊'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{
              marginTop: '16px',
              fontSize: '0.7rem',
              color: 'var(--hush-text-muted)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}>
              Interactive demo — install Hush for real per-tab control
            </p>
          </div>
        </section>

        {/* ═══════════ Scene 04: Architecture ═══════════ */}
        <section className="scroll-section scene-arch" id="architecture">
          <div className="reveal">
            <p className="scene-label" style={{ textAlign: 'center' }}>How It Works</p>
            <h2 className="scene-heading" style={{ textAlign: 'center', marginBottom: '40px' }}>
              Audio Architecture
            </h2>
          </div>
          <div className="arch-flow reveal">
            {ARCH_NODES.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="arch-node">
                  <div className="arch-node-label">{node.label}</div>
                  <div className="arch-node-value">{node.value}</div>
                </div>
                {i < ARCH_NODES.length - 1 && <span className="arch-arrow">→</span>}
              </div>
            ))}
          </div>
          <p className="scene-body reveal" style={{ textAlign: 'center', maxWidth: '600px' }}>
            Hush hooks into the browser's AudioContext.prototype.connect at the MAIN world level.
            A GainNode is injected into every audio pipeline, giving real-time control without
            modifying source media. Standard HTML5 &lt;audio&gt; and &lt;video&gt; elements
            are controlled via their native volume property.
          </p>
        </section>

        {/* ═══════════ Scene 05: Focus Modes ═══════════ */}
        <section className="scroll-section scene-focus" id="focus">
          <div className="reveal">
            <p className="scene-label" style={{ textAlign: 'center' }}>Focus Modes</p>
            <h2 className="scene-heading" style={{ textAlign: 'center' }}>
              One click. Total focus.
            </h2>
          </div>
          <div className="focus-modes-grid reveal">
            {FOCUS_MODES.map((mode) => (
              <div
                key={mode.id}
                className={`focus-mode-card ${activeFocus === mode.id ? 'active' : ''}`}
                onClick={() => setActiveFocus(activeFocus === mode.id ? null : mode.id)}
              >
                <span className="focus-icon">{mode.icon}</span>
                <div className="focus-name">{mode.name}</div>
                <div className="focus-desc">{mode.desc}</div>
                <div className="focus-channels">
                  {mode.channels.map((ch) => (
                    <span key={ch.name} className={`focus-channel ${ch.on ? 'on' : 'off'}`}>
                      {ch.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ Scene 06: Finale ═══════════ */}
        <section className="scroll-section scene-finale" id="finale">
          <div className="reveal">
            <h2 className="finale-tagline">
              Your browser.<br />Your sound.
            </h2>
          </div>
          <div className="hero-cta-group reveal">
            <a
              href="https://github.com/abhishek-kumar-pundir/Hush"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-primary"
            >
              <span>Add to Chrome — Free</span>
            </a>
            <a
              href="https://github.com/abhishek-kumar-pundir/Hush"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-secondary"
            >
              <span>View on GitHub</span>
            </a>
          </div>
          <div className="finale-links reveal">
            <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer" className="finale-link">
              📄 Documentation
            </a>
            <a href="/privacy" className="finale-link">
              🔒 Privacy Policy
            </a>
            <a href="https://github.com/abhishek-kumar-pundir/Hush/issues" target="_blank" rel="noopener noreferrer" className="finale-link">
              🐛 Report Issue
            </a>
          </div>
        </section>
      </div>

      {/* Scroll indicator */}
      <div className={`scroll-indicator ${scrolled ? 'hidden' : ''}`}>
        <span className="scroll-indicator-text">Scroll to explore</span>
        <div className="scroll-indicator-line" />
      </div>

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-brand-name">HUSH</div>
            <p className="footer-brand-desc">
              Per-tab audio control, intelligent tab organization, and focus modes
              for a quieter browser.
            </p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#architecture">How It Works</a>
              <a href="#focus">Focus Modes</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://github.com/abhishek-kumar-pundir/Hush/issues" target="_blank" rel="noopener noreferrer">Issues</a>
              <a href="/privacy">Privacy</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Hush — Built by Abhishek Kumar Pundir. Open source under MIT License.
        </div>
      </footer>
    </>
  )
}
