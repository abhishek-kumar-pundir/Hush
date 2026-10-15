import { useState, useMemo } from 'react';
import {
  Sparkles,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Globe,
  Film,
  Book,
  Briefcase,
  MessageCircle,
  Sliders,
  Gamepad2,
  HelpCircle,
} from 'lucide-react';
import { SmartImage } from 'react-fastload';
import { CATEGORIES, type Category } from '../classifier';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  [CATEGORIES.ENTERTAINMENT]: Film,
  [CATEGORIES.STUDY]: Book,
  [CATEGORIES.WORK]: Briefcase,
  [CATEGORIES.COMMUNICATION]: MessageCircle,
  [CATEGORIES.MUSIC]: Sliders,
  [CATEGORIES.SOCIAL]: Globe,
  [CATEGORIES.GAMING]: Gamepad2,
  [CATEGORIES.OTHER]: HelpCircle,
};

const CATEGORY_ACCENT_COLORS: Record<string, string> = {
  [CATEGORIES.ENTERTAINMENT]: '#E28D98',
  [CATEGORIES.STUDY]: '#7BE0CA',
  [CATEGORIES.WORK]: '#8EA8FF',
  [CATEGORIES.COMMUNICATION]: '#B6B8D0',
  [CATEGORIES.MUSIC]: '#F4A7C3',
  [CATEGORIES.SOCIAL]: '#6ED4E8',
  [CATEGORIES.GAMING]: '#FAD06C',
  [CATEGORIES.OTHER]: '#8A90A6',
};

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

interface OrganizeTabsWorkspaceProps {
  tabs: chrome.tabs.Tab[];
  resolveCategory: (tab: chrome.tabs.Tab) => Category;
  onApply: () => void;
  onClose: () => void;
  onDropToCategory: (e: React.DragEvent, category: Category) => void;
  onDragStart: (e: React.DragEvent, tab: chrome.tabs.Tab) => void;
  onDragEnd: () => void;
  draggedTab: chrome.tabs.Tab | null;
}

export function OrganizeTabsWorkspace({
  tabs,
  resolveCategory,
  onApply,
  onClose,
  onDropToCategory,
  onDragStart,
  onDragEnd,
  draggedTab,
}: OrganizeTabsWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const unpinnedTabs = useMemo(() => tabs.filter(t => !t.pinned), [tabs]);

  // Group tabs by category
  const categorizedTabs = useMemo(() => {
    const map: Partial<Record<Category, chrome.tabs.Tab[]>> = {};
    for (const tab of unpinnedTabs) {
      const cat = resolveCategory(tab);
      if (!map[cat]) map[cat] = [];
      map[cat]!.push(tab);
    }
    return map;
  }, [unpinnedTabs, resolveCategory]);

  // Filtered by search query
  const filteredCategorizedTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categorizedTabs;

    const filteredMap: Partial<Record<Category, chrome.tabs.Tab[]>> = {};
    for (const [catStr, catTabs] of Object.entries(categorizedTabs)) {
      const matches = (catTabs || []).filter(tab => {
        const titleMatch = (tab.title || '').toLowerCase().includes(query);
        const urlMatch = (tab.url || '').toLowerCase().includes(query);
        return titleMatch || urlMatch;
      });
      if (matches.length > 0) {
        filteredMap[catStr as Category] = matches;
      }
    }
    return filteredMap;
  }, [categorizedTabs, searchQuery]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const totalFilteredTabs = useMemo(() => {
    return Object.values(filteredCategorizedTabs).reduce((acc, curr) => acc + (curr?.length || 0), 0);
  }, [filteredCategorizedTabs]);

  const totalGroupsCount = useMemo(() => {
    return Object.keys(filteredCategorizedTabs).length;
  }, [filteredCategorizedTabs]);

  return (
    <div className="view-organize-workspace">
      {/* 1. HEADER */}
      <div className="vow-header">
        <div className="vow-header-left">
          <div className="vow-icon-wrap">
            <Sparkles size={14} className="text-accent" />
          </div>
          <div className="vow-header-titles">
            <h2 className="vow-title">Organize Tabs</h2>
            <span className="vow-subtitle">
              Bundle {unpinnedTabs.length} open {unpinnedTabs.length === 1 ? 'tab' : 'tabs'} into Chrome Tab Groups
            </span>
          </div>
        </div>
        <button className="btn-ghost vow-close-btn" onClick={onClose} title="Cancel and close" aria-label="Close">
          <X size={15} />
        </button>
      </div>

      {/* 2. SEARCH & FILTERING BAR */}
      <div className="vow-search-bar">
        <Search size={13} className="vow-search-icon" />
        <input
          type="text"
          placeholder="Filter tabs by title or domain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="vow-search-input"
        />
        {searchQuery && (
          <button className="vow-search-clear" onClick={() => setSearchQuery('')} title="Clear filter">
            <X size={12} />
          </button>
        )}
      </div>

      {/* 3. SCROLLABLE GROUPS & TAB LIST */}
      <div className="vow-scroll-body">
        {totalFilteredTabs === 0 ? (
          <div className="vow-empty-state">
            <Search size={20} className="text-muted" />
            <span className="vow-empty-title">No matching tabs</span>
            <span className="vow-empty-desc">No open tabs match &quot;{searchQuery}&quot;</span>
            <button className="btn-secondary vow-empty-btn" onClick={() => setSearchQuery('')}>
              Clear search filter
            </button>
          </div>
        ) : (
          <div className="vow-groups-list">
            {ORDERED_CATEGORIES.map(category => {
              const catTabs = filteredCategorizedTabs[category] || [];
              if (catTabs.length === 0) return null;

              const isCollapsed = Boolean(collapsedCategories[category]);
              const Icon = CATEGORY_ICONS[category] || HelpCircle;
              const accentColor = CATEGORY_ACCENT_COLORS[category] || '#8A90A6';
              const displayName = category === CATEGORIES.OTHER ? 'OTHER' : category;

              return (
                <div
                  key={category}
                  className="vow-group-card"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('vow-drag-hover'); }}
                  onDragLeave={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
                      e.currentTarget.classList.remove('vow-drag-hover');
                    }
                  }}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove('vow-drag-hover');
                    onDropToCategory(e, category);
                  }}
                >
                  {/* Group Header */}
                  <div
                    className="vow-group-header"
                    onClick={() => toggleCategory(category)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggleCategory(category)}
                  >
                    <div className="vow-gh-left">
                      <span className="vow-group-indicator" style={{ backgroundColor: accentColor }} />
                      <Icon size={13} className="vow-gh-icon" style={{ color: accentColor }} />
                      <span className="vow-gh-name">{displayName}</span>
                      <span className="vow-gh-count">({catTabs.length})</span>
                    </div>

                    <div className="vow-gh-right">
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    </div>
                  </div>

                  {/* Group Body (Tabs List) */}
                  {!isCollapsed && (
                    <div className="vow-tabs-list">
                      {catTabs.map(tab => {
                        let domain = 'local';
                        try {
                          if (tab.url) domain = new URL(tab.url).hostname.replace('www.', '');
                        } catch {}

                        const isGhosted = draggedTab?.id === tab.id;

                        return (
                          <div
                            key={tab.id}
                            className={`vow-tab-row ${isGhosted ? 'is-ghosted' : ''}`}
                            draggable
                            onDragStart={(e) => onDragStart(e, tab)}
                            onDragEnd={onDragEnd}
                            title="Drag to reassign group"
                          >
                            <div className="vow-drag-handle">
                              <GripVertical size={12} />
                            </div>

                            {tab.favIconUrl ? (
                              <SmartImage
                                src={tab.favIconUrl}
                                alt=""
                                className="vow-tab-favicon"
                                priority="LOW"
                                strategy="auto"
                                style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0 }}
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="vow-tab-favicon-fallback">
                                <Globe size={11} />
                              </div>
                            )}

                            <span className="vow-tab-title" title={tab.title}>{tab.title || 'Untitled tab'}</span>
                            <span className="vow-tab-domain">{domain}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. STICKY BOTTOM ACTION BAR */}
      <div className="vow-footer">
        <div className="vow-footer-info">
          <span>{totalGroupsCount} {totalGroupsCount === 1 ? 'group' : 'groups'} proposed</span>
        </div>
        <div className="vow-footer-actions">
          <button className="btn-secondary vow-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary vow-btn-apply"
            onClick={onApply}
            disabled={unpinnedTabs.length === 0}
          >
            Apply Groups
          </button>
        </div>
      </div>
    </div>
  );
}
