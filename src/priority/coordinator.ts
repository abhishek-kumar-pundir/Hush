import { classifyUrl } from '../classifier';
import { ActionJournal } from './action-journal';
import { planAudioActions } from './action-planner';
import { defaultAudioAdapter, type AudioControlAdapter } from './adapters';
import { detectAudioConflict } from './conflict-detector';
import { DEFAULT_AUTOMATION_SETTINGS, DEFAULT_SCENES } from './scenes';
import { SuggestionEngine } from './suggestion-engine';
import type {
  AudioConflict,
  AudioSource,
  AutomationSettings,
  ControlCapabilities,
  IntelligentAudioState,
  PriorityLevel,
} from './types';

export class PriorityCoordinator {
  private sources: Map<number, AudioSource> = new Map();
  private journal: ActionJournal = new ActionJournal();
  private suggestionEngine: SuggestionEngine = new SuggestionEngine();
  private settings: AutomationSettings = DEFAULT_AUTOMATION_SETTINGS;
  private currentConflict: AudioConflict | null = null;
  private adapter: AudioControlAdapter = defaultAudioAdapter;
  private evaluateTimer: any = null;
  private lastExplanation: string | null = null;
  private isEvaluating = false;

  constructor(adapter?: AudioControlAdapter) {
    if (adapter) this.adapter = adapter;
  }

  async initialize(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }

    try {
      const data = await chrome.storage.local.get([
        'automationSettings',
        'actionJournal',
        'learnedSuggestions',
        'dismissedSuggestionIds',
        'suggestionEvents',
      ]);

      if (data.automationSettings) {
        const storedSettings = data.automationSettings as Partial<AutomationSettings>;
        this.settings = {
          ...DEFAULT_AUTOMATION_SETTINGS,
          ...storedSettings,
          scenes: {
            ...DEFAULT_SCENES,
            ...(storedSettings.scenes || {}),
          },
        };
      }

      if (data.actionJournal && Array.isArray(data.actionJournal)) {
        this.journal = new ActionJournal(data.actionJournal);
      }

      this.suggestionEngine = new SuggestionEngine(
        data.learnedSuggestions as any,
        data.dismissedSuggestionIds as any,
        data.suggestionEvents as any
      );

      // Reconcile with currently open browser tabs
      if (chrome.tabs?.query) {
        const liveTabs = await chrome.tabs.query({});
        const liveTabIds = new Set(liveTabs.map(t => t.id!).filter(Boolean));
        this.journal.reconcileWithActiveTabs(liveTabIds);

        for (const tab of liveTabs) {
          if (tab.id) {
            this.syncTab(tab);
          }
        }
      }

      await this.saveState();
    } catch (e) {
      console.error('[Hush Priority] Initialization error:', e);
    }
  }

  async saveState(): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    try {
      await chrome.storage.local.set({
        automationSettings: this.settings,
        actionJournal: this.journal.getAllEntries(),
        learnedSuggestions: this.suggestionEngine.getAllSuggestions(),
        dismissedSuggestionIds: this.suggestionEngine.getDismissedIds(),
        suggestionEvents: this.suggestionEngine.getEvents(),
      });
    } catch (e) {
      console.error('[Hush Priority] Error saving state:', e);
    }
  }

  syncTab(tab: chrome.tabs.Tab, capabilities?: Partial<ControlCapabilities>): AudioSource {
    const tabId = (tab.id !== undefined ? tab.id : (tab as any).tabId) as number;
    let domain = 'local';
    try {
      if (tab.url) {
        domain = new URL(tab.url).hostname.replace('www.', '');
      }
    } catch {}

    const existing = this.sources.get(tabId);
    const category = (tab as any).category || classifyUrl(tab.url);

    const source: AudioSource = {
      tabId,
      windowId: (tab.windowId !== undefined ? tab.windowId : (tab as any).windowId) || 1,
      url: tab.url || '',
      domain: (tab as any).domain || domain,
      title: tab.title || 'Untitled Tab',
      favIconUrl: tab.favIconUrl,
      audible: Boolean(tab.audible),
      mediaPlaying: existing?.mediaPlaying ?? (tab as any).mediaPlaying ?? Boolean(tab.audible),
      volume: existing?.volume ?? (tab as any).volume ?? 1.0,
      isMuted: Boolean(tab.mutedInfo?.muted ?? (tab as any).isMuted),
      isUserMuted: existing?.isUserMuted ?? (tab as any).isUserMuted ?? Boolean(tab.mutedInfo?.muted),
      category,
      capabilities: {
        supportsVolume: capabilities?.supportsVolume ?? (tab as any).capabilities?.supportsVolume ?? existing?.capabilities?.supportsVolume ?? true,
        supportsPause: capabilities?.supportsPause ?? (tab as any).capabilities?.supportsPause ?? existing?.capabilities?.supportsPause ?? true,
        isWebAudio: capabilities?.isWebAudio ?? (tab as any).capabilities?.isWebAudio ?? existing?.capabilities?.isWebAudio ?? false,
        isHtml5Media: capabilities?.isHtml5Media ?? (tab as any).capabilities?.isHtml5Media ?? existing?.capabilities?.isHtml5Media ?? true,
      },
      lastAudibleTime: tab.audible ? Date.now() : (existing?.lastAudibleTime ?? (tab as any).lastAudibleTime ?? 0),
      navigationId: (tab as any).navigationId ?? `${tab.url || ''}_${tabId}`,
      manualPriority: this.settings.manualOverrides[tabId] || (tab as any).manualPriority || existing?.manualPriority || null,
      isManuallyAdjusted: existing?.isManuallyAdjusted ?? (tab as any).isManuallyAdjusted ?? false,
      isActiveTab: Boolean(tab.active ?? (tab as any).isActiveTab),
    };

    this.sources.set(tabId, source);
    return source;
  }

  handleTabRemoved(tabId: number): void {
    this.sources.delete(tabId);
    this.journal.handleTabRemoved(tabId);
    delete this.settings.manualOverrides[tabId];
    this.triggerEvaluation(true);
  }

  handleTabActivated(tabId: number): void {
    for (const [id, src] of this.sources.entries()) {
      src.isActiveTab = (id === tabId);
    }
    this.triggerEvaluation(false);
  }

  handleManualVolumeChange(tabId: number, newVolume: number): void {
    const source = this.sources.get(tabId);
    if (source) {
      source.volume = newVolume;
      source.isManuallyAdjusted = true;

      // Relinquish Hush ownership if user manually moves slider
      const wasOverridden = this.journal.recordUserOverride(tabId, newVolume);

      // Record contextual pattern if user lowered volume or restored it
      if (wasOverridden) {
        const actionType = newVolume < 0.4 ? 'lowered_volume' : 'restored_volume';
        this.suggestionEngine.recordUserAction(
          source.domain,
          this.settings.activeSceneId,
          actionType,
          this.settings
        );
      }
    }
    this.triggerEvaluation(false);
  }

  handleManualMuteChange(tabId: number, isMuted: boolean): void {
    const source = this.sources.get(tabId);
    if (source) {
      source.isMuted = isMuted;
      source.isUserMuted = isMuted;
      this.journal.recordUserOverride(tabId);
    }
    this.triggerEvaluation(false);
  }

  setManualPriority(tabId: number, priority: PriorityLevel | null): void {
    const source = this.sources.get(tabId);
    if (source) {
      source.manualPriority = priority;
    }
    if (priority) {
      this.settings.manualOverrides[tabId] = priority;
      if (priority === 'excluded' && source) {
        this.suggestionEngine.recordUserAction(
          source.domain,
          this.settings.activeSceneId,
          'manually_excluded',
          this.settings
        );
      }
    } else {
      delete this.settings.manualOverrides[tabId];
    }
    this.triggerEvaluation(true);
  }

  setScene(sceneId: string): void {
    if (this.settings.scenes[sceneId]) {
      this.settings.activeSceneId = sceneId;
      this.triggerEvaluation(true);
    }
  }

  updateSettings(updates: Partial<AutomationSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.triggerEvaluation(true);
  }

  triggerEvaluation(immediate = false): void {
    if (this.evaluateTimer) {
      clearTimeout(this.evaluateTimer);
      this.evaluateTimer = null;
    }

    if (immediate) {
      this.evaluateAndReconcile();
    } else {
      // 250ms debouncing to prevent audio oscillation when media players buffer or pause briefly
      this.evaluateTimer = setTimeout(() => {
        this.evaluateAndReconcile();
        this.evaluateTimer = null;
      }, 250);
    }
  }

  async evaluateAndReconcile(): Promise<void> {
    if (this.isEvaluating) return;
    this.isEvaluating = true;

    try {
      const activeList = Array.from(this.sources.values());
      const activeScene = this.settings.scenes[this.settings.activeSceneId];

      // 1. Detect conflicts
      const result = detectAudioConflict(activeList, this.settings, activeScene);
      this.currentConflict = result.conflict;
      this.lastExplanation = result.explanation;

      // 2. Plan actions
      const plan = planAudioActions(
        result.conflict,
        activeList,
        this.journal.getAllEntries(),
        this.settings,
        activeScene
      );

      // 3. Execute restorations first
      for (const restore of plan.restorations) {
        if (this.journal.canSafelyRestore(restore.tabId, restore.navigationId)) {
          const res = await this.adapter.setVolume(restore.tabId, restore.targetVolume);
          if (res.success) {
            const src = this.sources.get(restore.tabId);
            if (src) src.volume = restore.targetVolume;
            if (restore.targetMuted === false) {
              await this.adapter.setMuted(restore.tabId, false);
              if (src) src.isMuted = false;
            }
            this.journal.markRestored(restore.tabId);
          }
        }
      }

      // 4. Execute ducking / pause actions
      for (const action of plan.actions) {
        if (action.actionType === 'DUCK') {
          const res = await this.adapter.setVolume(action.tabId, action.targetVolume);
          if (res.success) {
            this.journal.recordAction(action, res.fallbackUsed);
            const src = this.sources.get(action.tabId);
            if (src) src.volume = action.targetVolume;
          }
        } else if (action.actionType === 'PAUSE') {
          const res = await this.adapter.pauseMedia(action.tabId);
          if (res.success) {
            this.journal.recordAction(action, false);
          }
        } else if (action.actionType === 'NOTIFY') {
          this.journal.recordAction(action, false);
        }
      }

      await this.saveState();
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * User recovery command to restore all managed audio immediately.
   */
  async restoreAllManagedAudio(): Promise<number> {
    const activeEntries = this.journal.getActiveEntries();
    let restoredCount = 0;

    for (const entry of activeEntries) {
      if (!entry.userOverrode) {
        const res = await this.adapter.setVolume(entry.tabId, entry.originalVolume);
        if (res.success) {
          if (!entry.originalMuted) {
            await this.adapter.setMuted(entry.tabId, false);
          }
          this.journal.markRestored(entry.tabId);
          const src = this.sources.get(entry.tabId);
          if (src) {
            src.volume = entry.originalVolume;
            src.isMuted = entry.originalMuted;
          }
          restoredCount++;
        }
      }
    }

    this.currentConflict = null;
    this.lastExplanation = 'All managed audio restored to original levels.';
    await this.saveState();
    return restoredCount;
  }

  acceptSuggestion(suggestionId: string): boolean {
    const success = this.suggestionEngine.accept(suggestionId, this.settings);
    if (success) {
      this.triggerEvaluation(true);
    }
    return success;
  }

  dismissSuggestion(suggestionId: string): void {
    this.suggestionEngine.dismiss(suggestionId);
    this.saveState();
  }

  clearLearnedPreferences(): void {
    this.suggestionEngine.clearLearnedData();
    this.saveState();
  }

  getState(): IntelligentAudioState {
    return {
      settings: this.settings,
      activeConflicts: this.currentConflict ? [this.currentConflict] : [],
      journal: this.journal.getAllEntries(),
      suggestions: this.suggestionEngine.getPendingSuggestions(),
      lastExplanation: this.lastExplanation,
      activeSources: Array.from(this.sources.values()).filter(s => s.audible || s.mediaPlaying),
    };
  }

  getSources(): AudioSource[] {
    return Array.from(this.sources.values());
  }

  getJournal(): ActionJournal {
    return this.journal;
  }

  getSettings(): AutomationSettings {
    return this.settings;
  }
}

export const priorityCoordinator = new PriorityCoordinator();
