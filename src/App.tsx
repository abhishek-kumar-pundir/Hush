import React, { useState, useEffect } from 'react'
import { classifyUrl, type Category, CATEGORIES } from './classifier'
import {
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Book,
  Gamepad2,
  Users,
  Film,
  Briefcase,
  MessageCircle,
  Globe,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { SmartImage } from 'react-fastload'
import { SoundIntelligenceCard } from './components/SoundIntelligenceCard'
import { AudioIntelligenceSettings } from './components/AudioIntelligenceSettings'
import { OrganizeTabsWorkspace } from './components/OrganizeTabsWorkspace'
import './App.css'

function HushIcon({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon-48.png"
      width={size}
      height={size}
      className={className}
      alt="Hush"
      style={{
        borderRadius: '50%',
        flexShrink: 0,
        display: 'block',
        filter: 'drop-shadow(0 2px 8px rgba(182, 184, 208, 0.28))'
      }}
    />
  );
}

interface AppState {
  tabVolumes: Record<number, number>;
  groupVolumes: Record<Category, number>;
  categoryOverrides: Record<string, Category>;
}

const CATEGORY_ICONS: Record<Category, React.ElementType> = {
  [CATEGORIES.ENTERTAINMENT]: Film,
  [CATEGORIES.STUDY]: Book,
  [CATEGORIES.WORK]: Briefcase,
  [CATEGORIES.COMMUNICATION]: MessageCircle,
  [CATEGORIES.MUSIC]: Sliders,
  [CATEGORIES.SOCIAL]: Globe,
  [CATEGORIES.GAMING]: Gamepad2,
  [CATEGORIES.OTHER]: HelpCircle,
}

const ORDERED_CATEGORIES: Category[] = [
  CATEGORIES.ENTERTAINMENT,
  CATEGORIES.STUDY,
  CATEGORIES.WORK,
  CATEGORIES.COMMUNICATION,
  CATEGORIES.MUSIC,
  CATEGORIES.SOCIAL,
  CATEGORIES.GAMING,
  CATEGORIES.OTHER,
];

const FOCUS_MODES = [
  {
    id: 'study',
    label: 'Study',
    icon: Book,
    volumes: {
      [CATEGORIES.STUDY]: 1.0,
      [CATEGORIES.WORK]: 0.5,
      [CATEGORIES.MUSIC]: 0.2,
      [CATEGORIES.SOCIAL]: 0.0,
      [CATEGORIES.ENTERTAINMENT]: 0.0,
      [CATEGORIES.GAMING]: 0.0,
      [CATEGORIES.COMMUNICATION]: 0.5,
      [CATEGORIES.OTHER]: 0.2
    },
    mutedCategories: [CATEGORIES.SOCIAL, CATEGORIES.ENTERTAINMENT, CATEGORIES.GAMING]
  },
  {
    id: 'gaming',
    label: 'Gaming',
    icon: Gamepad2,
    volumes: {
      [CATEGORIES.GAMING]: 1.0,
      [CATEGORIES.COMMUNICATION]: 0.8,
      [CATEGORIES.MUSIC]: 0.3,
      [CATEGORIES.ENTERTAINMENT]: 0.0,
      [CATEGORIES.SOCIAL]: 0.0,
      [CATEGORIES.STUDY]: 0.0,
      [CATEGORIES.WORK]: 0.0,
      [CATEGORIES.OTHER]: 0.0
    },
    mutedCategories: [CATEGORIES.ENTERTAINMENT, CATEGORIES.SOCIAL, CATEGORIES.STUDY, CATEGORIES.WORK]
  },
  {
    id: 'meeting',
    label: 'Meeting',
    icon: Users,
    volumes: {
      [CATEGORIES.COMMUNICATION]: 1.0,
      [CATEGORIES.GAMING]: 0.0,
      [CATEGORIES.MUSIC]: 0.0,
      [CATEGORIES.ENTERTAINMENT]: 0.0,
      [CATEGORIES.SOCIAL]: 0.0,
      [CATEGORIES.STUDY]: 0.0,
      [CATEGORIES.WORK]: 0.0,
      [CATEGORIES.OTHER]: 0.0
    },
    mutedCategories: [
      CATEGORIES.GAMING,
      CATEGORIES.MUSIC,
      CATEGORIES.ENTERTAINMENT,
      CATEGORIES.SOCIAL,
      CATEGORIES.STUDY,
      CATEGORIES.WORK,
      CATEGORIES.OTHER
    ]
  }
];

function App() {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([])
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)
  const [audibleTabs, setAudibleTabs] = useState<chrome.tabs.Tab[]>([])
  const [chromeGroups, setChromeGroups] = useState<chrome.tabGroups.TabGroup[]>([])
  const [state, setState] = useState<AppState>({ tabVolumes: {}, groupVolumes: {} as any, categoryOverrides: {} })
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  
  const [activeView, setActiveView] = useState<'dashboard' | 'settings' | 'organize'>('dashboard')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroupCollapse = (cat: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }))
  }

  const [activeFocus, setActiveFocus] = useState<string | null>(null)
  const [hoveredFocusMode, setHoveredFocusMode] = useState<string | null>(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [draggedTab, setDraggedTab] = useState<chrome.tabs.Tab | null>(null)

  const [followCurrentTab, setFollowCurrentTab] = useState(true)

  const [controlsHoveredTab, setControlsHoveredTab] = useState<number | 'current' | null>(null);
  const lastPointerDownTarget = React.useRef<HTMLElement | null>(null);

  // Capture the exact origin element of any pointerdown to reliably distinguish slider clicks from row drags
  useEffect(() => {
    const handleCapturePointerDown = (e: PointerEvent) => {
      lastPointerDownTarget.current = e.target as HTMLElement;
    };
    window.addEventListener('pointerdown', handleCapturePointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', handleCapturePointerDown, { capture: true });
  }, []);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const topZoneRef = React.useRef<HTMLDivElement>(null);
  const bottomZoneRef = React.useRef<HTMLDivElement>(null);
  const dragPos = React.useRef<{x: number, y: number} | null>(null);
  const rAF = React.useRef<number | null>(null);

  // Auto-scrolling loop during drag with speed 24 and smooth edge easing
  useEffect(() => {
    const scrollLoop = () => {
      if (!isDragging || !scrollContainerRef.current) {
        if (rAF.current) cancelAnimationFrame(rAF.current);
        rAF.current = null;
        if (topZoneRef.current) topZoneRef.current.classList.remove('active');
        if (bottomZoneRef.current) bottomZoneRef.current.classList.remove('active');
        return;
      }
      
      let isScrollingUp = false;
      let isScrollingDown = false;
      
      if (dragPos.current !== null && topZoneRef.current && bottomZoneRef.current) {
        const { x, y } = dragPos.current;
        
        const draggedRect = {
          left: x - 150,
          right: x + 150,
          top: y - 24,
          bottom: y + 24
        };
        
        const topRect = topZoneRef.current.getBoundingClientRect();
        const bottomRect = bottomZoneRef.current.getBoundingClientRect();
        
        const overlaps = (a: any, b: any) => {
          return (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
        };
        
        const container = scrollContainerRef.current;
        const maxScrollSpeed = 24;
        
        if (overlaps(draggedRect, topRect)) {
          isScrollingUp = true;
          const penetration = Math.max(0, topRect.bottom - y);
          const factor = Math.min(1, Math.max(0.18, penetration / topRect.height));
          const step = Math.round(maxScrollSpeed * factor);
          container.scrollTop -= step;
        } else if (overlaps(draggedRect, bottomRect)) {
          isScrollingDown = true;
          const penetration = Math.max(0, y - bottomRect.top);
          const factor = Math.min(1, Math.max(0.18, penetration / bottomRect.height));
          const step = Math.round(maxScrollSpeed * factor);
          container.scrollTop += step;
        }
      }
      
      if (topZoneRef.current) {
        if (isScrollingUp) topZoneRef.current.classList.add('active');
        else topZoneRef.current.classList.remove('active');
      }
      if (bottomZoneRef.current) {
        if (isScrollingDown) bottomZoneRef.current.classList.add('active');
        else bottomZoneRef.current.classList.remove('active');
      }
      
      rAF.current = requestAnimationFrame(scrollLoop);
    };
    
    if (isDragging) {
      if (!rAF.current) rAF.current = requestAnimationFrame(scrollLoop);
    } else {
      if (rAF.current) cancelAnimationFrame(rAF.current);
      rAF.current = null;
      dragPos.current = null;
      if (topZoneRef.current) topZoneRef.current.classList.remove('active');
      if (bottomZoneRef.current) bottomZoneRef.current.classList.remove('active');
    }
    return () => { if (rAF.current) cancelAnimationFrame(rAF.current); }
  }, [isDragging]);

  useEffect(() => {
    const fetchData = () => {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        const mockTabGroups = [
          { id: 101, title: 'Entertainment', color: 'red', collapsed: false, windowId: 1 },
          { id: 102, title: 'Study', color: 'green', collapsed: false, windowId: 1 }
        ] as unknown as chrome.tabGroups.TabGroup[];
        setChromeGroups(mockTabGroups);

        const mockTabs = [
          { id: 1, title: 'Spotify – Web Player', url: 'https://open.spotify.com/track/123', favIconUrl: 'https://open.spotify.com/favicon.ico', active: true, audible: true, windowId: 1, index: 0, pinned: false, highlighted: true, incognito: false, selected: true, discarded: false, autoDiscardable: true, groupId: -1 },
          { id: 2, title: '(92) YouTube – Lo-Fi Beats', url: 'https://www.youtube.com/watch?v=mock', favIconUrl: 'https://www.youtube.com/s/desktop/favicon.ico', active: false, audible: true, windowId: 1, index: 1, pinned: false, highlighted: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: 101 },
          { id: 3, title: 'WhatsApp Web', url: 'https://web.whatsapp.com', favIconUrl: 'https://static.whatsapp.net/rsrc.php/v3/yP/r/rNTs2nH9YgB.png', active: false, audible: false, windowId: 1, index: 2, pinned: false, highlighted: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: 101 },
          { id: 4, title: 'frontend – GitHub', url: 'https://github.com/abhishek-kumar-pundir/Hush', favIconUrl: 'https://github.githubassets.com/favicons/favicon.png', active: false, audible: false, windowId: 1, index: 3, pinned: false, highlighted: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: 101 },
          { id: 5, title: 'Coursera – Machine Learning', url: 'https://www.coursera.org/learn/machine-learning', favIconUrl: 'https://d3njjcbhbojbot.cloudfront.net/web/images/favicons/favicon-v2-32x32.png', active: false, audible: false, windowId: 1, index: 4, pinned: false, highlighted: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: 102 },
          { id: 6, title: 'Figma – Design System', url: 'https://www.figma.com/file/123', favIconUrl: 'https://static.figma.com/app/icon/1/favicon.png', active: false, audible: false, windowId: 1, index: 5, pinned: false, highlighted: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
        ] as unknown as chrome.tabs.Tab[];
        setTabs(mockTabs);
        setCurrentTab(mockTabs[0]);
        setAudibleTabs([mockTabs[0], mockTabs[1]]);
        setState({
          tabVolumes: { 1: 0.85, 2: 0.70, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0 },
          groupVolumes: {
            [CATEGORIES.MUSIC]: 0.9,
            [CATEGORIES.ENTERTAINMENT]: 0.8,
            [CATEGORIES.WORK]: 1.0,
            [CATEGORIES.COMMUNICATION]: 1.0,
            [CATEGORIES.STUDY]: 1.0,
            [CATEGORIES.SOCIAL]: 1.0,
            [CATEGORIES.GAMING]: 1.0,
            [CATEGORIES.OTHER]: 1.0,
          },
          categoryOverrides: {}
        });
        return;
      }

      chrome.tabs.query({ currentWindow: true }, setTabs)
      if (followCurrentTab) {
        chrome.tabs.query({ active: true, currentWindow: true }, (res) => {
          if (res.length > 0) setCurrentTab(res[0]);
        })
      }
      chrome.tabs.query({ audible: true }, setAudibleTabs)

      if (chrome.tabGroups?.query) {
        chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (res) => {
          if (res) setChromeGroups(res);
        });
      }
      
      chrome.runtime?.sendMessage?.({ type: 'GET_STATE' }, (res) => {
        if (res && res.groupVolumes) setState(res)
      })
    }
    
    fetchData()
    
    if (typeof chrome === 'undefined') return;

    const listener = () => fetchData()
    chrome.tabs?.onUpdated?.addListener(listener)
    chrome.tabs?.onRemoved?.addListener(listener)
    chrome.tabs?.onActivated?.addListener(listener)
    chrome.tabs?.onCreated?.addListener(listener)
    chrome.tabs?.onMoved?.addListener(listener)
    chrome.tabs?.onAttached?.addListener(listener)
    chrome.tabs?.onDetached?.addListener(listener)

    chrome.tabGroups?.onUpdated?.addListener(listener)
    chrome.tabGroups?.onCreated?.addListener(listener)
    chrome.tabGroups?.onRemoved?.addListener(listener)
    chrome.tabGroups?.onMoved?.addListener(listener)
    
    return () => {
      chrome.tabs?.onUpdated?.removeListener(listener)
      chrome.tabs?.onRemoved?.removeListener(listener)
      chrome.tabs?.onActivated?.removeListener(listener)
      chrome.tabs?.onCreated?.removeListener(listener)
      chrome.tabs?.onMoved?.removeListener(listener)
      chrome.tabs?.onAttached?.removeListener(listener)
      chrome.tabs?.onDetached?.removeListener(listener)

      chrome.tabGroups?.onUpdated?.removeListener(listener)
      chrome.tabGroups?.onCreated?.removeListener(listener)
      chrome.tabGroups?.onRemoved?.removeListener(listener)
      chrome.tabGroups?.onMoved?.removeListener(listener)
    }
  }, [followCurrentTab])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // Map Chrome's native tab group titles to categories
  const groupTitleMap = React.useMemo(() => {
    const map = new Map<number, string>();
    chromeGroups.forEach(g => {
      if (g.title) map.set(g.id, g.title.trim().toLowerCase());
    });
    return map;
  }, [chromeGroups]);

  // Resolves tab category respecting native Chrome tab groups first, then classifier/overrides
  const resolveTabCategory = React.useCallback((tab: chrome.tabs.Tab): Category => {
    if (tab.groupId && tab.groupId !== -1) {
      const nativeTitle = groupTitleMap.get(tab.groupId);
      if (nativeTitle) {
        const matched = Object.values(CATEGORIES).find(
          c => c.toLowerCase() === nativeTitle
        );
        if (matched) return matched;
      }
    }
    return classifyUrl(tab.url, state.categoryOverrides);
  }, [groupTitleMap, state.categoryOverrides]);

  const handleTabVolume = (tabId: number, volume: number) => {
    setActiveFocus(null)
    setErrorMsg(null)
    
    const tabObj = tabs.find(t => t.id === tabId) || currentTab;
    const cat = tabObj ? resolveTabCategory(tabObj) : null;

    setState(s => {
      const newTabVolumes = { ...s.tabVolumes, [tabId]: volume };
      let newGroupVolumes = s.groupVolumes;
      
      if (cat && s.groupVolumes[cat] === 0 && volume > 0) {
        newGroupVolumes = { ...s.groupVolumes, [cat]: 1.0 };
        chrome.runtime?.sendMessage?.({ type: 'SET_GROUP_VOLUME', category: cat, volume: 1.0 });
      }
      
      return { ...s, tabVolumes: newTabVolumes, groupVolumes: newGroupVolumes };
    })
    
    chrome.runtime?.sendMessage?.({ type: 'SET_TAB_VOLUME', tabId, volume }, (res) => {
      if (chrome.runtime?.lastError || !res?.success) {
        setErrorMsg("Unable to connect to tab. Try reloading the target page.")
      }
    })
  }

  const handleSliderKeyDown = (e: React.KeyboardEvent, tabId: number, currentVol: number) => {
    let delta = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = e.shiftKey ? 0.10 : 0.01;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = e.shiftKey ? -0.10 : -0.01;
    
    if (delta !== 0) {
      e.preventDefault();
      handleTabVolume(tabId, Math.max(0, Math.min(1, currentVol + delta)));
    }
  }

  const handleSliderWheel = (e: React.WheelEvent, tabId: number, currentVol: number) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    handleTabVolume(tabId, Math.max(0, Math.min(1, currentVol + delta)));
  }

  const handleGroupVolume = (category: Category, volume: number) => {
    setActiveFocus(null)
    setState(s => ({ ...s, groupVolumes: { ...s.groupVolumes, [category]: volume } }))
    chrome.runtime?.sendMessage?.({ type: 'SET_GROUP_VOLUME', category, volume })
  }

  const handleMute = (tabId: number, muted: boolean) => {
    chrome.tabs?.update?.(tabId, { muted: !muted })
    if (typeof chrome === 'undefined' || !chrome.tabs?.update) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, mutedInfo: { muted: !muted } } : t))
      if (currentTab?.id === tabId) {
        setCurrentTab(prev => prev ? { ...prev, mutedInfo: { muted: !muted } } : null)
      }
    }
  }

  const handleApplyOrganization = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ORGANIZE_TABS' }, () => {
        setActiveView('dashboard');
        showToast('Tabs organized into groups');
      });
    } else {
      setActiveView('dashboard');
      showToast('Tabs organized into groups');
    }
  };

  const handleApplyFocusMode = (mode: typeof FOCUS_MODES[0]) => {
    setActiveFocus(mode.id)
    setState(s => ({ ...s, groupVolumes: { ...s.groupVolumes, ...mode.volumes } }))
    chrome.runtime?.sendMessage?.({ type: 'APPLY_FOCUS_MODE', volumes: mode.volumes, mutedCategories: mode.mutedCategories })
  }

  const handleActivateTab = (tabId: number, windowId: number) => {
    if (typeof chrome !== 'undefined') {
      chrome.tabs?.update?.(tabId, { active: true });
      chrome.windows?.update?.(windowId, { focused: true });
    }
    const target = tabs.find(t => t.id === tabId)
    if (target) setCurrentTab(target)
  }

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dragPos.current = { x: e.clientX, y: e.clientY };
  }

  const handleDragStart = (e: React.DragEvent, tab: chrome.tabs.Tab) => {
    const target = e.target as HTMLElement;
    const originTarget = lastPointerDownTarget.current;

    // Prevent drag initiation when interaction began on a slider, control, button, or input
    if (
      target.tagName === 'INPUT' || 
      target.closest('input, .slider, .slider-wrapper, .cc-vol-controls, .ct-controls, button, .btn-mute, .follow-toggle') ||
      originTarget?.tagName === 'INPUT' ||
      originTarget?.closest('input, .slider, .slider-wrapper, .cc-vol-controls, .ct-controls, button, .btn-mute, .follow-toggle')
    ) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.setData('text/plain', tab.id?.toString() || '');
    setDraggedTab(tab);
    
    setTimeout(() => {
      setIsDragging(true);
    }, 10);
  }
  
  const handleDragEnd = () => {
    setDraggedTab(null);
    setIsDragging(false);
  }

  const handleDropToCategory = (e: React.DragEvent, category: Category) => {
    e.preventDefault();
    setIsDragging(false);
    
    const tabIdStr = e.dataTransfer.getData('text/plain');
    if (!tabIdStr) return;
    
    const droppedTab = tabs.find(t => t.id?.toString() === tabIdStr) || draggedTab;
    if (!droppedTab || !droppedTab.url) {
      setDraggedTab(null);
      return;
    }
    
    const targetLabel = category === CATEGORIES.OTHER ? 'OTHER' : category.toUpperCase();
    showToast(`Moved to ${targetLabel}`);

    try {
      const hostname = new URL(droppedTab.url).hostname.replace('www.', '');
      setState(s => ({ ...s, categoryOverrides: { ...s.categoryOverrides, [hostname]: category } }))
      chrome.runtime?.sendMessage?.({
        type: 'OVERRIDE_TAB_CATEGORY',
        url: droppedTab.url,
        category,
        tabId: droppedTab.id
      })
    } catch {}
    
    setDraggedTab(null);
  }

  const handleResetToOther = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'RESET_ALL_TABS' }, (res) => {
        if (res?.success) {
          showToast('All tabs moved to Other');
          const newOverrides: Record<string, Category> = {};
          tabs.forEach(tab => {
            if (tab.url) {
              try {
                const hostname = new URL(tab.url).hostname.replace('www.', '');
                if (hostname) newOverrides[hostname] = CATEGORIES.OTHER;
              } catch {}
            }
          });
          setState(s => ({
            ...s,
            categoryOverrides: newOverrides,
            groupVolumes: {
              ...s.groupVolumes,
              [CATEGORIES.ENTERTAINMENT]: 1.0,
              [CATEGORIES.STUDY]: 1.0,
              [CATEGORIES.WORK]: 1.0,
              [CATEGORIES.COMMUNICATION]: 1.0,
              [CATEGORIES.OTHER]: 1.0,
              [CATEGORIES.MUSIC]: 1.0,
              [CATEGORIES.SOCIAL]: 1.0,
              [CATEGORIES.GAMING]: 1.0,
            }
          }));
          chrome.tabs?.query?.({ currentWindow: true }, setTabs);
          if (chrome.tabGroups?.query) {
            chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
              if (groups) setChromeGroups(groups);
            });
          }
        }
      });
    } else {
      showToast('All tabs moved to Other');
      const newOverrides: Record<string, Category> = {};
      tabs.forEach(tab => {
        if (tab.url) {
          try {
            const hostname = new URL(tab.url).hostname.replace('www.', '');
            if (hostname) newOverrides[hostname] = CATEGORIES.OTHER;
          } catch {}
        }
      });
      setChromeGroups([]);
      setTabs(prev => prev.map(t => ({ ...t, groupId: -1 })));
      setState(s => ({ ...s, categoryOverrides: newOverrides }));
    }
  };

  const groups: Partial<Record<Category, chrome.tabs.Tab[]>> = {}
  tabs.forEach(tab => {
    if (tab.pinned) return;
    const cat = resolveTabCategory(tab);
    if (!groups[cat]) groups[cat] = []
    groups[cat]!.push(tab)
  })
  
  const orderedCategories = ORDERED_CATEGORIES;
  const unpinnedTabsCount = tabs.filter(t => !t.pinned).length;

  if (activeView === 'organize') {
    return (
      <div className="app-wrapper">
        <OrganizeTabsWorkspace
          tabs={tabs}
          resolveCategory={resolveTabCategory}
          onApply={handleApplyOrganization}
          onClose={() => setActiveView('dashboard')}
          onDropToCategory={handleDropToCategory}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          draggedTab={draggedTab}
        />
      </div>
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="app-wrapper">
        <AudioIntelligenceSettings
          onBack={() => setActiveView('dashboard')}
          onToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="app-wrapper" onDragOver={handleContainerDragOver}>
      {isDragging && (
        <>
          <div className="scroll-zone top-scroll-zone" ref={topZoneRef}>
            <ArrowUp size={12} />
            <span>Scroll up</span>
          </div>
          <div className="scroll-zone bottom-scroll-zone" ref={bottomZoneRef}>
            <span>Scroll down</span>
            <ArrowDown size={12} />
          </div>
        </>
      )}

      <div className={`container ${isDragging ? 'is-dragging' : ''}`} ref={scrollContainerRef}>
        <header className="app-header">
          <div className="logo-group">
            <HushIcon size={28} className="brand-icon" />
            <div className="brand-identity">
              <div className="brand-title-row">
                <span className="app-wordmark">Hush</span>
                <span className="brand-badge">AUDIO</span>
              </div>
              <span className="brand-tagline">TAB ACOUSTICS</span>
            </div>
          </div>
          <button
            className="btn-organize"
            onClick={() => setActiveView('organize')}
            title="Organize tabs into Chrome tab groups"
            aria-label="Organize tabs into groups"
          >
            <Sparkles size={12} />
            <span>Organize tabs</span>
          </button>
        </header>

        {errorMsg && (
          <div className="error-banner" role="alert">
            <AlertCircle size={14} className="text-danger" />
            <span>{errorMsg}</span>
          </div>
        )}
        
        {toastMsg && (
          <div className="toast-notification" role="status">
            <CheckCircle2 size={14} className="text-playing" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* 1. CURRENT TAB */}
        {currentTab && (() => {
          const isPlaying = audibleTabs.some(t => t.id === currentTab.id);
          const tVol = state.tabVolumes?.[currentTab.id!] ?? 1.0;
          const isMuted = currentTab.mutedInfo?.muted || false;

          return (
            <div className="section">
              <div className="section-label">Current Tab</div>
              <div 
                className={`current-tab-card ${draggedTab?.id === currentTab.id ? 'is-ghosted' : ''}`}
                draggable={controlsHoveredTab !== 'current'}
                onDragStart={(e) => handleDragStart(e, currentTab)}
                onDragEnd={handleDragEnd}
                title="Drag to reassign category"
              >
                <div className="ct-info">
                  {currentTab.favIconUrl ? (
                    <SmartImage
                      src={currentTab.favIconUrl}
                      alt=""
                      className="favicon-large"
                      priority="CRITICAL"
                      strategy="eager"
                      style={{ width: 24, height: 24, borderRadius: 4, flexShrink: 0 }}
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none' }}
                    />
                  ) : (
                    <div className="favicon-fallback">
                      <Globe size={14} />
                    </div>
                  )}
                  <div className="ct-text">
                    <div className="ct-title" title={currentTab.title}>{currentTab.title || 'Untitled tab'}</div>
                    <div className="ct-domain">{currentTab.url ? new URL(currentTab.url).hostname.replace('www.', '') : 'Local'}</div>
                  </div>
                  <div className={`ct-status ${isPlaying ? 'playing' : ''}`}>
                    <span className="status-dot" />
                    <span>{isPlaying ? 'Playing' : 'Silent'}</span>
                  </div>
                </div>

                <div 
                  className="ct-controls"
                  onMouseEnter={() => setControlsHoveredTab('current')}
                  onMouseLeave={() => setControlsHoveredTab(null)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setControlsHoveredTab('current');
                  }}
                >
                  <div className="ct-vol-row">
                    <span className="ct-vol-label">Volume</span>
                    <div 
                      className="slider-wrapper"
                      draggable={false}
                      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <input 
                        type="range" 
                        min="0" max="1" step="0.01" 
                        value={tVol}
                        onChange={(e) => handleTabVolume(currentTab.id!, parseFloat(e.target.value))}
                        onKeyDown={(e) => handleSliderKeyDown(e, currentTab.id!, tVol)}
                        onWheel={(e) => handleSliderWheel(e, currentTab.id!, tVol)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        draggable={false}
                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="slider"
                        aria-label={`Volume for ${currentTab.title || 'current tab'}`}
                      />
                    </div>
                    <span className="ct-eff-vol">{Math.round(tVol * 100)}%</span>
                  </div>

                  <div className="ct-actions">
                    <button
                      onClick={() => handleMute(currentTab.id!, isMuted)}
                      className={`btn-mute ${isMuted ? 'is-muted' : ''}`}
                      aria-label={isMuted ? "Unmute active tab" : "Mute active tab"}
                    >
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} 
                      <span>{isMuted ? 'Muted' : 'Mute'}</span>
                    </button>

                    <label className="follow-toggle" title="Keep popup synchronized with active browser tab">
                      <input
                        type="checkbox"
                        checked={followCurrentTab}
                        onChange={(e) => setFollowCurrentTab(e.target.checked)}
                      />
                      <span>Follow active tab</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 2. NOW PLAYING */}
        <div className="section">
          <div className="section-label">
            <span>Now Playing</span>
            <span className="badge">{audibleTabs.length}</span>
          </div>
          {audibleTabs.length > 0 ? (
            <div className="np-list">
              {audibleTabs.map(tab => {
                const tVol = state.tabVolumes?.[tab.id!] ?? 1.0;
                const cat = resolveTabCategory(tab);
                const gVol = state.groupVolumes?.[cat] ?? 1.0;
                const effVol = Math.round(tVol * gVol * 100);
                
                return (
                  <div 
                    key={tab.id} 
                    className={`np-row ${draggedTab?.id === tab.id ? 'is-ghosted' : ''}`} 
                    onClick={() => handleActivateTab(tab.id!, tab.windowId)}
                    title={`Click to switch to ${tab.title} (Draggable)`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tab)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="np-indicator" />
                    {tab.favIconUrl && (
                      <SmartImage
                        src={tab.favIconUrl}
                        alt=""
                        className="favicon"
                        priority="HIGH"
                        strategy="eager"
                        style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none' }}
                      />
                    )}
                    <div className="np-title" title={tab.title}>{tab.title}</div>
                    <div className="np-vol">
                      <span>{effVol}%</span>
                      <Volume2 size={12} className="text-muted" />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-compact">
              <VolumeX size={13} className="text-muted" />
              <span>No tabs playing audio</span>
            </div>
          )}
        </div>

        {/* 3. SOUND INTELLIGENCE (COMPACT HUD) */}
        <SoundIntelligenceCard
          onOpenSettings={() => setActiveView('settings')}
          onToast={showToast}
        />

        {/* 4. CATEGORIES & TAB GROUPS */}
        <div className="section categories-section">
          <div className="section-header-row">
            <div className="section-label">
              <span>Tab Groups</span>
              <span className="badge">{unpinnedTabsCount}</span>
            </div>
            <button
              className="btn-reset-groups"
              onClick={handleResetToOther}
              title="Reset all tabs to Other and ungroup from Chrome tab groups"
              aria-label="Reset all tabs to Other"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>
          {orderedCategories.map(category => {
            const categoryTabs = groups[category] || [];
            const gVol = state.groupVolumes?.[category] ?? 1.0;
            
            if (categoryTabs.length === 0 && !isDragging) {
              return null;
            }

            const CatIcon = CATEGORY_ICONS[category] || HelpCircle;
            const isOther = category === CATEGORIES.OTHER;
            const displayName = isOther ? 'OTHER' : category;
            const isCollapsed = Boolean(collapsedGroups[category]);

            return (
              <div 
                key={category} 
                className={`compact-category-card ${isOther ? 'category-unknown category-other' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                onDragLeave={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                    e.currentTarget.classList.remove('drag-over');
                  }
                }}
                onDrop={(e) => { e.currentTarget.classList.remove('drag-over'); handleDropToCategory(e, category) }}
              >
                <div 
                  className="cc-header"
                  title={`${categoryTabs.length} tabs in ${displayName}. Click to collapse/expand.`}
                  onClick={() => toggleGroupCollapse(category)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleGroupCollapse(category)}
                >
                  <div className="cc-title-group">
                    {isCollapsed ? (
                      <ChevronRight size={12} className="cc-collapse-icon" />
                    ) : (
                      <ChevronDown size={12} className="cc-collapse-icon" />
                    )}
                    <CatIcon size={13} className="cc-icon" />
                    <strong className="cc-name">{displayName}</strong>
                    <span className="cc-count">({categoryTabs.length})</span>
                  </div>
                  <div 
                    className="cc-master-vol"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="range" 
                      min="0" max="1" step="0.01" 
                      value={gVol}
                      onChange={(e) => handleGroupVolume(category, parseFloat(e.target.value))}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="slider group-slider"
                      aria-label={`Master volume for ${displayName} group`}
                    />
                    <span className="vol-readout">{Math.round(gVol * 100)}%</span>
                  </div>
                </div>
                
                {!isCollapsed && (
                  <div className="cc-body">
                  {categoryTabs.length > 0 ? (
                    <div className="cc-list">
                      {categoryTabs.map((tab) => {
                        const tVol = state.tabVolumes?.[tab.id!] ?? 1.0;
                        const isAudible = audibleTabs.some(t => t.id === tab.id);
                        const isMuted = tab.mutedInfo?.muted || false;
                        const effVol = Math.round(tVol * gVol * 100);
                        const isGhosted = draggedTab?.id === tab.id;

                        return (
                          <div 
                            key={tab.id} 
                            className={`cc-row ${isGhosted ? 'is-ghosted' : ''}`}
                            draggable={controlsHoveredTab !== tab.id}
                            onDragStart={(e) => handleDragStart(e, tab)}
                            onDragEnd={handleDragEnd}
                            title="Drag to reassign category"
                          >
                            <div className="drag-handle" title="Drag to reassign category">
                              <GripVertical size={13} />
                            </div>
                            {tab.favIconUrl && (
                              <SmartImage
                                src={tab.favIconUrl}
                                alt=""
                                className="favicon"
                                priority="NORMAL"
                                strategy="auto"
                                style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none' }}
                              />
                            )}
                            <div className="cc-title" title={tab.title}>{tab.title}</div>
                            <div 
                              className="cc-vol-controls"
                              draggable={false}
                              onMouseEnter={() => setControlsHoveredTab(tab.id!)}
                              onMouseLeave={() => setControlsHoveredTab(null)}
                              onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setControlsHoveredTab(tab.id!);
                              }}
                            >
                              <div className="cc-eff-vol">
                                {isAudible ? (
                                  <span title="Audio playing"><Volume2 size={12} className="text-playing" /></span>
                                ) : isMuted ? (
                                  <span title="Tab muted"><VolumeX size={12} className="text-danger" /></span>
                                ) : null}
                                <span>{effVol}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="1" step="0.01" 
                                value={tVol}
                                onChange={(e) => handleTabVolume(tab.id!, parseFloat(e.target.value))}
                                onKeyDown={(e) => handleSliderKeyDown(e, tab.id!, tVol)}
                                onWheel={(e) => handleSliderWheel(e, tab.id!, tVol)}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setControlsHoveredTab(tab.id!);
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setControlsHoveredTab(tab.id!);
                                }}
                                draggable={false}
                                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                className="slider tab-slider"
                                aria-label={`Volume for ${tab.title || 'tab'}`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}

                  {isDragging && (
                    <div className="drop-indicator">
                      Drop to move into {displayName}
                    </div>
                  )}
                </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 4. FOCUS MODES */}
        <div className="section fm-section">
          <div className="section-label">Focus Modes</div>
          <div className="fm-grid">
            {FOCUS_MODES.map(mode => {
              const Icon = mode.icon;
              const isActive = activeFocus === mode.id;
              const isHovered = hoveredFocusMode === mode.id;

              // Tabs opened in this focus grouping:
              const activeModeTabs = tabs.filter(t => !t.pinned && ((mode.volumes as any)[resolveTabCategory(t)] ?? 0) > 0);
              const mutedModeTabs = tabs.filter(t => !t.pinned && (mode.mutedCategories as readonly Category[]).includes(resolveTabCategory(t)));

              return (
                <div 
                  key={mode.id} 
                  className="fm-btn-wrapper"
                  onMouseEnter={() => setHoveredFocusMode(mode.id)}
                  onMouseLeave={() => setHoveredFocusMode(null)}
                >
                  <button 
                    className={`fm-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleApplyFocusMode(mode)}
                    aria-pressed={isActive}
                    title={`Activate ${mode.label} Focus Mode`}
                  >
                    <Icon size={13} />
                    <span>{mode.label}</span>
                  </button>

                  {isHovered && (
                    <div className="focus-popover" role="tooltip">
                      <div className="focus-popover-title">
                        <span>{mode.label} Tabs</span>
                        <span className="badge">{activeModeTabs.length} active</span>
                      </div>
                      <div className="focus-popover-tabs">
                        {activeModeTabs.length === 0 && mutedModeTabs.length === 0 ? (
                          <div className="focus-popover-empty">No matching tabs open</div>
                        ) : (
                          <>
                            {activeModeTabs.map(t => {
                              const cat = resolveTabCategory(t);
                              const targetVol = Math.round(((mode.volumes as any)[cat] ?? 1.0) * 100);
                              return (
                                <div key={t.id} className="focus-popover-row">
                                  {t.favIconUrl ? (
                                    <img src={t.favIconUrl} alt="" className="favicon" style={{ width: 13, height: 13 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                  ) : null}
                                  <span className="focus-popover-tab-title" title={t.title}>{t.title}</span>
                                  <span className="focus-popover-vol">{targetVol}%</span>
                                </div>
                              );
                            })}
                            {mutedModeTabs.length > 0 && (
                              <div className="focus-popover-muted-label">
                                Muted ({mutedModeTabs.length}):
                              </div>
                            )}
                            {mutedModeTabs.map(t => (
                              <div key={t.id} className="focus-popover-row is-muted-row">
                                {t.favIconUrl ? (
                                  <img src={t.favIconUrl} alt="" className="favicon" style={{ width: 13, height: 13 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                ) : null}
                                <span className="focus-popover-tab-title" title={t.title}>{t.title}</span>
                                <span className="focus-popover-vol text-danger">Muted</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
