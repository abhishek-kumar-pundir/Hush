import { useState, useEffect } from 'react';
import {
  Shield,
  Settings,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Check,
  X,
  Book,
  Briefcase,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { IntelligentAudioState, PriorityLevel } from '../priority/types';
import { DEFAULT_AUTOMATION_SETTINGS } from '../priority/scenes';

interface SoundIntelligenceCardProps {
  onOpenSettings: () => void;
  onToast: (msg: string) => void;
}

export function SoundIntelligenceCard({ onOpenSettings, onToast }: SoundIntelligenceCardProps) {
  const [priorityState, setPriorityState] = useState<IntelligentAudioState>({
    settings: DEFAULT_AUTOMATION_SETTINGS,
    activeConflicts: [],
    journal: [],
    suggestions: [],
    lastExplanation: null,
    activeSources: [],
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTabMenu, setActiveTabMenu] = useState<number | null>(null);

  useEffect(() => {
    const fetchState = () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'GET_PRIORITY_STATE' }, (res) => {
          if (chrome.runtime?.lastError) return;
          if (res && res.settings) {
            setPriorityState(res);
          }
        });
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, []);

  const { settings, activeConflicts, suggestions, lastExplanation, activeSources, journal } = priorityState;
  const activeScene = settings.scenes[settings.activeSceneId] || settings.scenes['study'];
  const hasActiveConflict = activeConflicts.length > 0;
  const activeConflict = activeConflicts[0] || null;
  const activeManagedEntries = journal.filter(j => j.status === 'applied');

const SCENE_ICONS: Record<string, React.ElementType> = {
  'deep-work': Briefcase,
  'study': Book,
  'entertainment': Film,
  'custom': Layers,
};

  const getBehaviorDescription = () => {
    if (!settings.enabled) {
      return 'Automatic audio management is currently paused.';
    }
    if (hasActiveConflict && activeConflict) {
      return activeConflict.explanation;
    }
    if (lastExplanation) {
      return lastExplanation;
    }
    switch (settings.activeSceneId) {
      case 'deep-work':
        return 'Meetings & communications prioritized; background media suppressed.';
      case 'study':
        return 'Lectures prioritized; ambient music lowered to 25%.';
      case 'entertainment':
        return 'Active video and stream audio takes priority.';
      default:
        return 'Audio priorities actively coordinated by custom rules.';
    }
  };

  const handleToggleAutomation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextEnabled = !settings.enabled;
    const updated = { ...settings, enabled: nextEnabled };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(nextEnabled ? 'Audio Intelligence active' : 'Audio Intelligence paused');
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleRestoreAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'RESTORE_ALL_MANAGED' }, (res) => {
        if (res?.state) setPriorityState(res.state);
        onToast(`Restored ${res?.count ?? 0} managed tabs`);
      });
    }
  };

  const handleAcceptSuggestion = (id: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'ACCEPT_SUGGESTION', suggestionId: id }, (res) => {
        if (res?.state) setPriorityState(res.state);
        onToast('Rule saved to defaults');
      });
    }
  };

  const handleDismissSuggestion = (id: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DISMISS_SUGGESTION', suggestionId: id }, (res) => {
        if (res?.state) setPriorityState(res.state);
      });
    }
  };

  const handleManualPriority = (tabId: number, priority: PriorityLevel | null) => {
    setActiveTabMenu(null);
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SET_MANUAL_PRIORITY', tabId, priority }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(priority ? `Priority set to ${priority}` : 'Priority set to automatic');
      });
    }
  };

  const SceneIcon = SCENE_ICONS[activeScene?.id || 'study'] || Layers;

  return (
    <div className="si-compact-card">
      {/* Top Header Row */}
      <div className="si-compact-header">
        <div className="si-compact-left">
          <Shield size={13} className="si-compact-icon" />
          <span className="si-compact-title">Sound Intelligence</span>
          <button
            className={`si-compact-pill ${settings.enabled ? 'is-active' : 'is-paused'}`}
            onClick={handleToggleAutomation}
            title={settings.enabled ? 'Click to pause automatic ducking' : 'Click to enable automatic ducking'}
            aria-label={settings.enabled ? 'Automation active' : 'Automation paused'}
          >
            <span className="si-compact-dot" />
            <span>{settings.enabled ? 'Active' : 'Paused'}</span>
          </button>
        </div>

        <div className="si-compact-actions">
          <button
            className="si-compact-btn-manage"
            onClick={onOpenSettings}
            title="Open Audio Intelligence Settings"
            aria-label="Settings"
          >
            <Settings size={12} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Scene & Behavior Status Row */}
      <div className="si-compact-body">
        <div className="si-scene-badge" title={`Active Scene: ${activeScene?.name || 'Default'}`}>
          <SceneIcon size={12} />
          <span>{activeScene?.name || 'Study'}</span>
        </div>
        <p className="si-compact-desc">{getBehaviorDescription()}</p>
      </div>

      {/* Active Conflict Banner if playing audio is being ducked */}
      {hasActiveConflict && (
        <div className="si-compact-conflict" role="alert">
          <div className="si-conflict-text">
            <AlertCircle size={12} className="text-playing" />
            <span>Ducking background audio</span>
          </div>
          <button className="si-conflict-restore-btn" onClick={handleRestoreAll} title="Restore original volume levels">
            <RotateCcw size={10} />
            <span>Restore</span>
          </button>
        </div>
      )}

      {/* Contextual Suggestion Banner if one is detected */}
      {suggestions.length > 0 && (
        <div className="si-compact-suggestion">
          <div className="si-sugg-top">
            <Sparkles size={11} className="si-sugg-sparkle" />
            <span>{suggestions[0].message}</span>
          </div>
          <div className="si-sugg-btns">
            <button className="si-sugg-btn-accept" onClick={() => handleAcceptSuggestion(suggestions[0].id)}>
              <Check size={10} />
              <span>Make Default</span>
            </button>
            <button className="si-sugg-btn-dismiss" onClick={() => handleDismissSuggestion(suggestions[0].id)}>
              <X size={10} />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {/* Expand/Collapse toggle for active sources details (default compact) */}
      {activeSources.length > 0 && (
        <div className="si-expand-wrapper">
          <button
            className="si-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            <span>
              {activeSources.length} active {activeSources.length === 1 ? 'source' : 'sources'}
              {activeManagedEntries.length > 0 ? ` (${activeManagedEntries.length} managed)` : ''}
            </span>
            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>

          {isExpanded && (
            <div className="si-expanded-list">
              {activeSources.map(source => {
                const journalEntry = journal.find(j => j.tabId === source.tabId && j.status === 'applied');
                const manualOverride = settings.manualOverrides[source.tabId] || source.manualPriority;
                const isPrimary = activeConflict?.primaryTabId === source.tabId || manualOverride === 'primary';
                const isExcluded = settings.domainExclusions.includes(source.domain) || activeScene?.exclusions?.includes(source.domain) || manualOverride === 'excluded';
                const isDucked = journalEntry && journalEntry.actionType === 'DUCK';

                return (
                  <div key={source.tabId} className="si-source-compact-row">
                    <span className="si-source-compact-name" title={source.title}>{source.title}</span>
                    <div className="si-source-compact-right">
                      {isPrimary ? (
                        <span className="si-badge-primary">Primary</span>
                      ) : isExcluded ? (
                        <span className="si-badge-excluded">Excluded</span>
                      ) : isDucked ? (
                        <span className="si-badge-ducked">Ducked</span>
                      ) : (
                        <span className="si-badge-normal">{manualOverride || 'Auto'}</span>
                      )}

                      <button
                        className="si-override-compact-btn"
                        onClick={() => setActiveTabMenu(activeTabMenu === source.tabId ? null : source.tabId)}
                        title="Override priority"
                      >
                        <ChevronDown size={11} />
                      </button>

                      {activeTabMenu === source.tabId && (
                        <div className="si-menu-popover">
                          <button onClick={() => handleManualPriority(source.tabId, null)}>Auto</button>
                          <button onClick={() => handleManualPriority(source.tabId, 'primary')}>Primary</button>
                          <button onClick={() => handleManualPriority(source.tabId, 'background')}>Background</button>
                          <button onClick={() => handleManualPriority(source.tabId, 'excluded')}>Exclude</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
