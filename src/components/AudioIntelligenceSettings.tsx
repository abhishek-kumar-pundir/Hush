import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Settings,
  Shield,
  RotateCcw,
  Book,
  Film,
  Briefcase,
  Layers,
  Trash2,
  Plus,
  X,
  Volume2,
  Sliders,
  Check,
} from 'lucide-react';
import type {
  IntelligentAudioState,
  ConflictResponse,
} from '../priority/types';
import { DEFAULT_AUTOMATION_SETTINGS } from '../priority/scenes';

const SCENE_ICONS: Record<string, React.ElementType> = {
  'deep-work': Briefcase,
  'study': Book,
  'entertainment': Film,
  'custom': Layers,
};

const SCENE_DESCRIPTIONS: Record<string, string> = {
  'deep-work': 'Meeting & call priority',
  'study': 'Lecture priority, lower background',
  'entertainment': 'Video & stream priority',
  'custom': 'Custom priority rules',
};

interface AudioIntelligenceSettingsProps {
  onBack: () => void;
  onToast: (msg: string) => void;
}

export function AudioIntelligenceSettings({ onBack, onToast }: AudioIntelligenceSettingsProps) {
  const [priorityState, setPriorityState] = useState<IntelligentAudioState>({
    settings: DEFAULT_AUTOMATION_SETTINGS,
    activeConflicts: [],
    journal: [],
    suggestions: [],
    lastExplanation: null,
    activeSources: [],
  });
  const [newExclusionDomain, setNewExclusionDomain] = useState('');
  const [newPriorityDomain, setNewPriorityDomain] = useState('');
  const [newPriorityScore, setNewPriorityScore] = useState(80);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_PRIORITY_STATE' }, (res) => {
        if (chrome.runtime?.lastError) return;
        if (res && res.settings) {
          setPriorityState(res);
        }
      });
    }
  }, []);

  const { settings, journal } = priorityState;
  const activeManagedEntries = journal.filter(j => j.status === 'applied');

  const handleToggleAutomation = () => {
    const nextEnabled = !settings.enabled;
    const updated = { ...settings, enabled: nextEnabled };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(nextEnabled ? 'Automation enabled' : 'Automation paused');
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleSetScene = (sceneId: string) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'SET_SCENE', sceneId }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(`Switched to ${settings.scenes[sceneId]?.name || sceneId}`);
      });
    } else {
      setPriorityState(prev => ({
        ...prev,
        settings: { ...prev.settings, activeSceneId: sceneId }
      }));
    }
  };

  const handleUpdateResponse = (response: ConflictResponse) => {
    const updated = { ...settings, defaultResponse: response };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(`Default: ${response === 'duck' ? 'Duck audio' : response === 'pause' ? 'Pause media' : 'Notify only'}`);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleUpdateDuckingLevel = (level: number) => {
    const updated = { ...settings, defaultDuckingLevel: level };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleAddExclusion = () => {
    const clean = newExclusionDomain.trim().toLowerCase().replace('www.', '');
    if (!clean || settings.domainExclusions.includes(clean)) return;
    const updated = {
      ...settings,
      domainExclusions: [...settings.domainExclusions, clean],
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(`Protected ${clean}`);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
    setNewExclusionDomain('');
  };

  const handleRemoveExclusion = (domain: string) => {
    const updated = {
      ...settings,
      domainExclusions: settings.domainExclusions.filter(d => d !== domain),
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleAddDomainPriority = () => {
    const clean = newPriorityDomain.trim().toLowerCase().replace('www.', '');
    if (!clean) return;
    const updated = {
      ...settings,
      domainPriorities: {
        ...settings.domainPriorities,
        [clean]: newPriorityScore,
      },
    };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
        onToast(`Saved priority for ${clean}`);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
    setNewPriorityDomain('');
  };

  const handleRemoveDomainPriority = (domain: string) => {
    const nextPriorities = { ...settings.domainPriorities };
    delete nextPriorities[domain];
    const updated = { ...settings, domainPriorities: nextPriorities };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const handleRestoreAll = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'RESTORE_ALL_MANAGED' }, (res) => {
        if (res?.state) setPriorityState(res.state);
        onToast(`Restored ${res?.count ?? 0} tabs`);
      });
    }
  };

  const handleClearLearned = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'CLEAR_LEARNED_DATA' }, (res) => {
        if (res?.state) setPriorityState(res.state);
        onToast('Cleared learned preferences');
      });
    }
  };

  const handleToggleLearning = () => {
    const updated = { ...settings, learningEnabled: !settings.learningEnabled };
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'UPDATE_AUTOMATION_SETTINGS', settings: updated }, (res) => {
        if (res?.settings) setPriorityState(res);
      });
    } else {
      setPriorityState(prev => ({ ...prev, settings: updated }));
    }
  };

  const isSubtle = Math.abs(settings.defaultDuckingLevel - 0.4) < 0.02;
  const isBalanced = Math.abs(settings.defaultDuckingLevel - 0.25) < 0.02;
  const isWhisper = Math.abs(settings.defaultDuckingLevel - 0.1) < 0.02;

  return (
    <div className="view-settings-page">
      {/* Sticky Top Header */}
      <div className="vsp-header">
        <button
          type="button"
          className="btn-ghost vsp-back-btn"
          onClick={onBack}
          title="Back to dashboard"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="vsp-header-text">
          <h2 className="vsp-title">Audio Intelligence</h2>
        </div>
        <button
          type="button"
          className="btn-primary vsp-done-btn"
          onClick={onBack}
          title="Done and return to dashboard"
        >
          Done
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="vsp-scroll-body">
        {/* 1. AUTOMATION */}
        <div className="vsp-section">
          <div className="vsp-section-title-row">
            <Shield size={13} className="text-accent" />
            <h3 className="vsp-section-title">Automation</h3>
          </div>
          <div className="vsp-card">
            <div className="vsp-row-between">
              <div>
                <strong className="vsp-label">Auto-manage audio</strong>
                <p className="vsp-desc">Coordinate audio when multiple sources play.</p>
              </div>
              <label className="si-switch">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={handleToggleAutomation}
                  aria-label="Toggle auto-manage audio"
                />
                <span className="si-switch-slider" />
              </label>
            </div>
            <div className="vsp-status-indicator">
              <span className={`vsp-status-dot ${settings.enabled ? 'is-active' : ''}`} />
              <span className="vsp-status-text">
                {settings.enabled
                  ? 'Active — priority rules applied'
                  : 'Paused — all tabs play'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. ACOUSTIC SCENES */}
        <div className="vsp-section">
          <div className="vsp-section-title-row">
            <Layers size={13} className="text-accent" />
            <h3 className="vsp-section-title">Acoustic Scenes</h3>
          </div>
          <div className="vsp-scenes-grid">
            {Object.values(settings.scenes).map(scene => {
              const Icon = SCENE_ICONS[scene.id] || Layers;
              const isSelected = scene.id === settings.activeSceneId;
              const desc = SCENE_DESCRIPTIONS[scene.id] || scene.description;

              return (
                <div
                  key={scene.id}
                  className={`vsp-scene-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSetScene(scene.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSetScene(scene.id)}
                >
                  <div className="vsp-sc-header">
                    <div className="vsp-sc-title-group">
                      <Icon size={13} className="vsp-sc-icon" />
                      <span className="vsp-sc-name">{scene.name}</span>
                    </div>
                    {isSelected && (
                      <span className="vsp-active-pill">
                        <Check size={9} />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                  <p className="vsp-sc-desc">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. CONFLICT RESPONSE */}
        <div className="vsp-section">
          <div className="vsp-section-title-row">
            <Sliders size={13} className="text-accent" />
            <h3 className="vsp-section-title">Conflict Response</h3>
          </div>
          <div className="vsp-card">
            <label className="vsp-label">Default action</label>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-item ${settings.defaultResponse === 'duck' ? 'is-selected' : ''}`}
                onClick={() => handleUpdateResponse('duck')}
              >
                Duck audio
              </button>
              <button
                type="button"
                className={`segmented-item ${settings.defaultResponse === 'pause' ? 'is-selected' : ''}`}
                onClick={() => handleUpdateResponse('pause')}
              >
                Pause media
              </button>
              <button
                type="button"
                className={`segmented-item ${settings.defaultResponse === 'notify' ? 'is-selected' : ''}`}
                onClick={() => handleUpdateResponse('notify')}
              >
                Notify only
              </button>
            </div>

            {settings.defaultResponse === 'duck' && (
              <div className="vsp-ducking-block">
                <div className="vsp-slider-header">
                  <span className="vsp-label">Background volume</span>
                  <span className="vsp-slider-val">{Math.round(settings.defaultDuckingLevel * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={settings.defaultDuckingLevel}
                  onChange={(e) => handleUpdateDuckingLevel(parseFloat(e.target.value))}
                  className="slider"
                  aria-label="Background volume level"
                />
                <div className="ducking-presets">
                  <button
                    type="button"
                    className={`ducking-preset-btn ${isSubtle ? 'is-active' : ''}`}
                    onClick={() => handleUpdateDuckingLevel(0.4)}
                  >
                    Subtle (40%)
                  </button>
                  <button
                    type="button"
                    className={`ducking-preset-btn ${isBalanced ? 'is-active' : ''}`}
                    onClick={() => handleUpdateDuckingLevel(0.25)}
                  >
                    Balanced (25%)
                  </button>
                  <button
                    type="button"
                    className={`ducking-preset-btn ${isWhisper ? 'is-active' : ''}`}
                    onClick={() => handleUpdateDuckingLevel(0.1)}
                  >
                    Whisper (10%)
                  </button>
                </div>
              </div>
            )}
            <p className="vsp-note">
              Falls back to muting if volume control is unsupported.
            </p>
          </div>
        </div>

        {/* 4. PRIORITY RULES & EXCLUSIONS */}
        <div className="vsp-section">
          <div className="vsp-section-title-row">
            <Volume2 size={13} className="text-accent" />
            <h3 className="vsp-section-title">Priority Rules & Exclusions</h3>
          </div>

          {/* Protected sites */}
          <div className="vsp-card">
            <div className="vsp-field-header">
              <strong className="vsp-label">Protected sites</strong>
              <p className="vsp-desc">Never change audio on these sites.</p>
            </div>
            <div className="vsp-form-row">
              <input
                type="text"
                placeholder="Domain (e.g. zoom.us)"
                value={newExclusionDomain}
                onChange={(e) => setNewExclusionDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddExclusion()}
                className="text-input vsp-input-flex"
                aria-label="Domain to protect"
              />
              <button
                type="button"
                className="btn-secondary vsp-btn-inline"
                onClick={handleAddExclusion}
                title="Add protected site"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
            {settings.domainExclusions.length > 0 ? (
              <div className="vsp-chips-list">
                {settings.domainExclusions.map(domain => (
                  <span key={domain} className="vsp-chip">
                    <span>{domain}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExclusion(domain)}
                      className="vsp-chip-remove"
                      title={`Remove ${domain}`}
                      aria-label={`Remove ${domain}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="vsp-empty-note">No protected sites added</span>
            )}
          </div>

          {/* Site priorities */}
          <div className="vsp-card">
            <div className="vsp-field-header">
              <strong className="vsp-label">Site priorities</strong>
              <p className="vsp-desc">Set which sites take priority.</p>
            </div>
            <div className="vsp-form-row">
              <input
                type="text"
                placeholder="Domain (e.g. spotify.com)"
                value={newPriorityDomain}
                onChange={(e) => setNewPriorityDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomainPriority()}
                className="text-input vsp-input-flex"
                aria-label="Domain for priority rule"
              />
              <select
                value={newPriorityScore}
                onChange={(e) => setNewPriorityScore(parseInt(e.target.value, 10))}
                className="select-input vsp-select-score"
                aria-label="Priority score"
              >
                <option value={90}>Primary (90)</option>
                <option value={80}>High (80)</option>
                <option value={50}>Normal (50)</option>
                <option value={20}>Background (20)</option>
              </select>
              <button
                type="button"
                className="btn-secondary vsp-btn-inline"
                onClick={handleAddDomainPriority}
                title="Add site priority"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
            {Object.keys(settings.domainPriorities).length > 0 ? (
              <div className="vsp-rules-list">
                {Object.entries(settings.domainPriorities).map(([dom, score]) => (
                  <div key={dom} className="vsp-rule-item">
                    <span className="vsp-rule-domain">{dom}</span>
                    <span className="vsp-rule-level">
                      {score >= 70 ? 'Primary' : score <= 30 ? 'Background' : 'Normal'} ({score})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomainPriority(dom)}
                      className="btn-ghost vsp-btn-remove"
                      title={`Delete rule for ${dom}`}
                      aria-label={`Delete rule for ${dom}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className="vsp-empty-note">No site priorities configured</span>
            )}
          </div>
        </div>

        {/* 5. ADVANCED & RECOVERY */}
        <div className="vsp-section">
          <div className="vsp-section-title-row">
            <Settings size={13} className="text-accent" />
            <h3 className="vsp-section-title">Advanced & Recovery</h3>
          </div>
          <div className="vsp-card">
            <div className="vsp-row-between">
              <div>
                <strong className="vsp-label">Suggest rules</strong>
                <p className="vsp-desc">Suggest rules based on your adjustments.</p>
              </div>
              <label className="si-switch">
                <input
                  type="checkbox"
                  checked={settings.learningEnabled}
                  onChange={handleToggleLearning}
                  aria-label="Suggest rules based on adjustments"
                />
                <span className="si-switch-slider" />
              </label>
            </div>

            <div className="vsp-actions-row">
              <button
                type="button"
                className="btn-secondary vsp-action-btn"
                onClick={handleRestoreAll}
                title="Restore all ducked audio to original levels"
              >
                <RotateCcw size={12} />
                <span>Restore Managed Audio{activeManagedEntries.length > 0 ? ` (${activeManagedEntries.length})` : ''}</span>
              </button>
              <button
                type="button"
                className="btn-danger vsp-action-btn"
                onClick={handleClearLearned}
                title="Clear heuristic learning history"
              >
                <Trash2 size={12} />
                <span>Clear Learned Rules</span>
              </button>
            </div>

            <p className="vsp-disclaimer">
              Your audio preferences stay on this device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
