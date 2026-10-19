import { useState, useEffect, useCallback, useRef } from 'react'
import Scene3D from './components/Scene3D'
import './App.css'

/* ==========================================================================
   Hush Website — Main Application
   
   Six cinematic scroll-driven sections:
   01. Hero — Dramatic intro with the Hush audio core & feature badges
   02. Enter — The audio universe & Sound Intelligence
   03. Control — Interactive Sound Intelligence & per-tab volume demo
   04. Architecture — Manifest V3 Audio Pipeline & Priority Engine
   05. Acoustic Scenes — 4 Scenes (Deep Work, Study, Entertainment, Custom) & Tab Groups
   06. Finale — The closing statement, CTAs, and documentation links
   ========================================================================== */

const CURRENT_YEAR = 2026
const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/hush/dbbkabhnlodiikoebjiijgcfoeiakiop'

type DemoPreset = 'deep_work' | 'study' | 'entertainment'

// --- Demo tab data for the interactive control panel ---
interface DemoTab {
  id: string
  name: string
  category: string
  icon: string
  iconClass: string
  volume: number
  baseVolume: number
  muted: boolean
  isPrimary?: boolean
  manualOverride?: boolean
  duckedText?: string
}

const INITIAL_TABS: DemoTab[] = [
  {
    id: 'gm',
    name: 'Google Meet',
    category: 'Calls',
    icon: '📹',
    iconClass: 'meet',
    baseVolume: 100,
    volume: 100,
    muted: false,
    isPrimary: true,
    duckedText: 'Primary Focus',
  },
  {
    id: 'yt',
    name: 'YouTube Lo-Fi',
    category: 'Media',
    icon: '▶',
    iconClass: 'youtube',
    baseVolume: 72,
    volume: 10,
    muted: false,
    duckedText: 'Ducked 10%',
  },
  {
    id: 'sp',
    name: 'Spotify Focus',
    category: 'Music',
    icon: '♫',
    iconClass: 'spotify',
    baseVolume: 85,
    volume: 10,
    muted: false,
    duckedText: 'Ducked 10%',
  },
  {
    id: 'dc',
    name: 'Discord Voice',
    category: 'Calls',
    icon: '💬',
    iconClass: 'discord',
    baseVolume: 40,
    volume: 0,
    muted: true,
    duckedText: 'Muted',
  },
]

// --- Acoustic Scenes data ---
interface AcousticScene {
  id: string
  name: string
  icon: string
  preset: string
  desc: string
  channels: { name: string; on: boolean }[]
}

const ACOUSTIC_SCENES: AcousticScene[] = [
  {
    id: 'deep_work',
    name: 'Deep Work',
    icon: '🎯',
    preset: 'Whisper 10%',
    desc: 'Aggressively prioritizes your active focus tab. Background audio ducks to 10% (Whisper) or pauses during calls.',
    channels: [
      { name: 'Active Tab 100%', on: true },
      { name: 'Voice Calls Protected', on: true },
      { name: 'Background 10%', on: false },
      { name: 'Smooth Ramp Fade', on: true },
    ],
  },
  {
    id: 'study',
    name: 'Study',
    icon: '📚',
    preset: 'Balanced 25%',
    desc: 'Balanced clarity for tutorials, lectures, and docs. Background lo-fi or ambient audio settles gently to 25%.',
    channels: [
      { name: 'Tutorial Stream 100%', on: true },
      { name: 'Ambient Lo-Fi 25%', on: true },
      { name: 'No Sudden Cuts', on: true },
      { name: 'Auto-Restoration', on: true },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    preset: 'Subtle 40%',
    desc: 'Streaming and gaming immersion. Media playback takes priority, secondary audio tabs duck subtly to 40%.',
    channels: [
      { name: 'Media Playback 100%', on: true },
      { name: 'Secondary Tabs 40%', on: true },
      { name: 'Instant Restoration', on: true },
      { name: 'Manual Override Lock', on: true },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Profile',
    icon: '⚙️',
    preset: 'Configurable',
    desc: 'Tailor your acoustic profile. Set custom ducking ratios, priority domain rules, and sensitivity thresholds.',
    channels: [
      { name: 'Custom Ducking %', on: true },
      { name: 'Domain Whitelist', on: true },
      { name: 'Action Journal Logs', on: true },
      { name: 'Zero Telemetry', on: true },
    ],
  },
]

// --- Architecture pipeline nodes ---
const ARCH_NODES = [
  { label: 'Capture', value: 'HTML5 & Web Audio' },
  { label: 'Intercept', value: 'Main-World Gain Hook' },
  { label: 'Bridge', value: 'Isolated Content Script' },
  { label: 'Intelligence', value: 'Priority Engine' },
  { label: 'Output', value: 'Pristine System Audio' },
]

export default function App() {
  const scrollRef = useRef(0)
  const [activeScene, setActiveScene] = useState(0)
  const [scrolled, setScrolled] = useState(false)

  // --- Demo state ---
  const [tabs, setTabs] = useState<DemoTab[]>(INITIAL_TABS)
  const [activePreset, setActivePreset] = useState<DemoPreset>('deep_work')
  const [activeAcousticScene, setActiveAcousticScene] = useState<string | null>('deep_work')
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

  // --- Preset change handler ---
  const handlePresetSelect = useCallback((preset: DemoPreset) => {
    setActivePreset(preset)
    const duckRatio = preset === 'deep_work' ? 10 : preset === 'study' ? 25 : 40
    const ratioLabel = preset === 'deep_work' ? 'Ducked 10% (Whisper)' : preset === 'study' ? 'Ducked 25% (Balanced)' : 'Ducked 40% (Subtle)'

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.isPrimary) {
          return { ...tab, volume: 100, duckedText: 'Primary Focus', muted: false }
        }
        if (tab.muted && tab.volume === 0 && !tab.manualOverride) {
          return tab
        }
        return {
          ...tab,
          volume: duckRatio,
          muted: false,
          manualOverride: false,
          duckedText: ratioLabel,
        }
      })
    )
  }, [])

  // --- Demo volume change handler ---
  const handleVolumeChange = useCallback((id: string, volume: number) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              volume,
              muted: volume === 0,
              manualOverride: true,
              duckedText: `Manual (${volume}%)`,
            }
          : tab
      )
    )
  }, [])

  // --- Demo mute toggle handler ---
  const handleMuteToggle = useCallback((id: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              muted: !tab.muted,
              manualOverride: true,
              duckedText: !tab.muted ? 'Muted' : `Manual (${tab.volume || 50}%)`,
            }
          : tab
      )
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
          <a href="#features" className="nav-link">Sound Intelligence</a>
          <a href="#control" className="nav-link">Control Panel</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#scenes" className="nav-link">Acoustic Scenes</a>
          <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer" className="nav-link">GitHub</a>
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="nav-cta">
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
              Intelligent Audio Priority, per-tab volume control, and native tab grouping for a quieter browser.
              Eliminate competing audio chaos with local-first sound intelligence.
            </p>
            <div className="hero-badges">
              <span className="hero-pill">⚡ Sound Intelligence</span>
              <span className="hero-pill">🎚️ Per-Tab Audio Ramps</span>
              <span className="hero-pill">🗂️ Chrome Tab Groups</span>
              <span className="hero-pill">🔒 100% Local & Zero Telemetry</span>
            </div>
            <div className="hero-cta-group">
              <a
                href={CHROME_STORE_URL}
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
            <p className="scene-label">Sound Intelligence</p>
            <h2 className="scene-heading">
              Every tab is an audio stream —<br />Hush coordinates them
            </h2>
            <p className="scene-body">
              Your browser is a symphony of competing sounds — conference calls, tutorial streams,
              background lo-fi beats, and autoplay video ads. Hush continuously monitors audio activity.
              When audio streams collide, Intelligent Audio Priority automatically resolves the conflict,
              prioritizing what matters and smoothly ducking secondary tabs with natural gain ramps.
            </p>
          </div>
        </section>

        {/* ═══════════ Scene 03: Precision Control & Priority Demo ═══════════ */}
        <section className="scroll-section scene-control" id="control">
          <div className="control-panel reveal">
            <div className="control-panel-header">
              <p className="control-panel-title">Tab Audio Control</p>
              <div className="sound-intel-badge">
                <span className="live-dot" />
                <span>Priority Engine</span>
              </div>
            </div>

            {/* Mini scene preset selector for demo */}
            <div className="scene-mini-selector">
              <button
                className={`scene-mini-btn ${activePreset === 'deep_work' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('deep_work')}
              >
                Deep Work (10%)
              </button>
              <button
                className={`scene-mini-btn ${activePreset === 'study' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('study')}
              >
                Study (25%)
              </button>
              <button
                className={`scene-mini-btn ${activePreset === 'entertainment' ? 'active' : ''}`}
                onClick={() => handlePresetSelect('entertainment')}
              >
                Entertainment (40%)
              </button>
            </div>

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
                    <div className="tab-meta">
                      <span className="tab-category">{tab.category}</span>
                      {tab.isPrimary ? (
                        <span className="tab-badge primary">Primary Focus</span>
                      ) : tab.manualOverride ? (
                        <span className="tab-badge manual">Manual Override</span>
                      ) : (
                        <span className="tab-badge ducked">{tab.duckedText}</span>
                      )}
                    </div>
                  </div>
                  <div className="tab-volume-control">
                    <input
                      type="range"
                      className="volume-slider"
                      min="0"
                      max="100"
                      value={tab.muted ? 0 : tab.volume}
                      onChange={(e) => handleVolumeChange(tab.id, parseInt(e.target.value, 10))}
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
                      title={tab.muted ? 'Unmute' : 'Mute'}
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
              fontStyle: 'italic',
            }}>
              Interactive simulation — Sound Intelligence automatically ducks background audio and preserves manual overrides.
            </p>
          </div>
        </section>

        {/* ═══════════ Scene 04: Architecture ═══════════ */}
        <section className="scroll-section scene-arch" id="architecture">
          <div className="reveal">
            <p className="scene-label" style={{ textAlign: 'center' }}>Under The Hood</p>
            <h2 className="scene-heading" style={{ textAlign: 'center', marginBottom: '40px' }}>
              Manifest V3 Audio Pipeline
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
          <p className="scene-body reveal" style={{ textAlign: 'center', maxWidth: '640px' }}>
            Hush operates entirely in-browser under Manifest V3. Audio contexts and media elements are intercepted in the page’s main world via an injected GainNode. Playback metadata communicates across an isolated content script to the background service worker, where the Priority Engine coordinates ducking ramps and logs to the Action Ownership Journal — with zero network requests or tracking.
          </p>
        </section>

        {/* ═══════════ Scene 05: Acoustic Scenes & Tab Groups ═══════════ */}
        <section className="scroll-section scene-focus" id="scenes">
          <div className="reveal">
            <p className="scene-label" style={{ textAlign: 'center' }}>Acoustic Scenes</p>
            <h2 className="scene-heading" style={{ textAlign: 'center' }}>
              One click. Perfect acoustic balance.
            </h2>
          </div>
          <div className="focus-modes-grid reveal">
            {ACOUSTIC_SCENES.map((mode) => (
              <div
                key={mode.id}
                className={`focus-mode-card ${activeAcousticScene === mode.id ? 'active' : ''}`}
                onClick={() => setActiveAcousticScene(activeAcousticScene === mode.id ? null : mode.id)}
              >
                <div className="focus-card-header">
                  <span className="focus-icon">{mode.icon}</span>
                  <span className="focus-preset-pill">{mode.preset}</span>
                </div>
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

          {/* Native Chrome Tab Groups Feature Callout */}
          <div className="tab-groups-banner reveal">
            <div className="tab-groups-header">
              <span className="tab-groups-icon">🗂️</span>
              <div>
                <div className="tab-groups-title">Native Chrome Tab Groups Integration</div>
                <div className="tab-groups-subtitle">
                  Visual workspace hygiene built right in. Declutter dozens of tabs into color-coded native Chromium tab groups with one click.
                </div>
              </div>
            </div>
            <div className="tab-groups-chips">
              <span className="tab-group-chip chip-red"><span className="chip-bullet" />Media</span>
              <span className="tab-group-chip chip-blue"><span className="chip-bullet" />Work</span>
              <span className="tab-group-chip chip-green"><span className="chip-bullet" />Communication</span>
              <span className="tab-group-chip chip-purple"><span className="chip-bullet" />Research</span>
              <span className="tab-group-chip chip-grey"><span className="chip-bullet" />Reference</span>
            </div>
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
              href={CHROME_STORE_URL}
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
            <a href="https://github.com/abhishek-kumar-pundir/Hush#readme" target="_blank" rel="noopener noreferrer" className="finale-link">
              📄 Documentation
            </a>
            <a href="https://github.com/abhishek-kumar-pundir/Hush/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer" className="finale-link">
              📋 Changelog
            </a>
            <a href="/privacy.html" className="finale-link">
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
              Intelligent Audio Priority, per-tab volume control, and native Chrome tab grouping
              for a quieter browser.
            </p>
          </div>
          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#features">Sound Intelligence</a>
              <a href="#control">Control Panel</a>
              <a href="#architecture">Architecture</a>
              <a href="#scenes">Acoustic Scenes</a>
              <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Chrome Web Store</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="https://github.com/abhishek-kumar-pundir/Hush" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://github.com/abhishek-kumar-pundir/Hush#readme" target="_blank" rel="noopener noreferrer">Documentation</a>
              <a href="https://github.com/abhishek-kumar-pundir/Hush/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">Changelog</a>
              <a href="/privacy.html">Privacy Policy</a>
              <a href="https://github.com/abhishek-kumar-pundir/Hush/issues" target="_blank" rel="noopener noreferrer">Issues</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          © {CURRENT_YEAR} Hush — Built by Abhishek Kumar Pundir. Open source under MIT License.
        </div>
      </footer>
    </>
  )
}
