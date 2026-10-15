import type {
  AudioConflict,
  AudioScene,
  AudioSource,
  AutomationSettings,
  JournalEntry,
  PlannedAction,
} from './types';

export interface ActionPlanResult {
  actions: PlannedAction[];
  restorations: PlannedAction[];
  notifications: string[];
}

/**
 * Pure action planner producing proposed actions without manipulating browser or DOM.
 * Generates ducking, pause, or notification actions for competing tabs,
 * and restoration actions for tabs whose conflicts have resolved.
 */
export function planAudioActions(
  conflict: AudioConflict | null,
  activeSources: AudioSource[],
  journal: JournalEntry[],
  settings: AutomationSettings,
  scene?: AudioScene
): ActionPlanResult {
  const activeScene = scene || settings.scenes[settings.activeSceneId] || settings.scenes['study'];
  const actions: PlannedAction[] = [];
  const restorations: PlannedAction[] = [];
  const notifications: string[] = [];

  const sourceMap = new Map<number, AudioSource>();
  activeSources.forEach(s => sourceMap.set(s.tabId, s));

  const journalMap = new Map<number, JournalEntry>();
  journal
    .filter(entry => entry.status === 'applied')
    .forEach(entry => journalMap.set(entry.tabId, entry));

  // 1. If an active conflict exists, plan actions for competing tabs
  if (conflict && conflict.status === 'active' && settings.enabled) {
    const responseType = activeScene.defaultResponse || settings.defaultResponse || 'duck';
    const duckingRatio = activeScene.duckingLevel ?? settings.defaultDuckingLevel ?? 0.25;

    for (const competingTabId of conflict.competingTabIds) {
      const source = sourceMap.get(competingTabId);
      if (!source) continue;

      // Excluded sources are never changed
      if (
        settings.domainExclusions.includes(source.domain) ||
        activeScene.exclusions.includes(source.domain) ||
        source.manualPriority === 'excluded'
      ) {
        continue;
      }

      // Check existing journal entry to avoid compounding volume reduction
      const existingEntry = journalMap.get(competingTabId);
      const originalVolume = existingEntry ? existingEntry.originalVolume : source.volume;
      const targetVolume = Math.round(Math.max(0.02, originalVolume * duckingRatio) * 100) / 100;

      // Determine capabilities
      const canAdjustVolume = source.capabilities?.supportsVolume ?? true;
      const fallbackToMute = !canAdjustVolume && responseType === 'duck';

      if (responseType === 'notify') {
        notifications.push(
          `Conflict detected: ${conflict.primaryDomain} has priority over background audio on ${source.domain}.`
        );
        actions.push({
          id: `act_${competingTabId}_${Date.now()}`,
          tabId: competingTabId,
          actionType: 'NOTIFY',
          originalVolume: source.volume,
          targetVolume: source.volume,
          originalMuted: source.isMuted,
          targetMuted: source.isMuted,
          reason: `Notification only: ${conflict.primaryDomain} has priority over ${source.domain}`,
          conflictId: conflict.id,
          navigationId: source.navigationId,
          createdAt: Date.now(),
        });
      } else if (responseType === 'pause' && source.capabilities?.supportsPause) {
        actions.push({
          id: `act_${competingTabId}_${Date.now()}`,
          tabId: competingTabId,
          actionType: 'PAUSE',
          originalVolume,
          targetVolume: 0,
          originalMuted: source.isMuted,
          targetMuted: source.isMuted,
          reason: `Paused background audio on ${source.domain} during ${conflict.primaryDomain} playback in ${activeScene.name}`,
          conflictId: conflict.id,
          navigationId: source.navigationId,
          createdAt: Date.now(),
        });
      } else {
        // Default: Duck volume (or fallback to mute if volume control unsupported)
        actions.push({
          id: `act_${competingTabId}_${Date.now()}`,
          tabId: competingTabId,
          actionType: 'DUCK',
          originalVolume,
          targetVolume: fallbackToMute ? 0 : targetVolume,
          originalMuted: source.isMuted,
          targetMuted: fallbackToMute ? true : source.isMuted,
          reason: fallbackToMute
            ? `Volume control unsupported on ${source.domain}; muted as safe fallback for ${conflict.primaryDomain}`
            : `Ducked ${source.domain} to ${Math.round(targetVolume * 100)}% while ${conflict.primaryDomain} is active in ${activeScene.name}`,
          conflictId: conflict.id,
          navigationId: source.navigationId,
          createdAt: Date.now(),
          fallbackToMute,
        });
      }
    }
  }

  // 2. Identify tabs whose conflict has resolved and can safely be restored
  const activeCompetingIds = new Set(conflict?.competingTabIds || []);

  for (const [tabId, entry] of journalMap.entries()) {
    // If the tab is no longer part of an active conflict or automation is disabled
    if (!activeCompetingIds.has(tabId) || !settings.enabled || !settings.autoRestore) {
      const source = sourceMap.get(tabId);

      // Verify safety conditions before restoring:
      // A. Tab still exists
      if (!source) continue;

      // B. Navigation hasn't changed to a completely different page
      if (source.navigationId && entry.navigationId && source.navigationId !== entry.navigationId) {
        continue;
      }

      // C. User hasn't overridden the state manually
      if (entry.userOverrode) {
        continue;
      }

      // D. Do not unmute a tab that the user had muted prior to Hush intervention
      const shouldRestoreMuted = entry.originalMuted;

      restorations.push({
        id: `restore_${tabId}_${Date.now()}`,
        tabId,
        actionType: 'RESTORE',
        originalVolume: entry.appliedVolume,
        targetVolume: entry.originalVolume,
        originalMuted: source.isMuted,
        targetMuted: shouldRestoreMuted,
        reason: `Restored ${source.domain} to original level (${Math.round(entry.originalVolume * 100)}%) after conflict ended`,
        conflictId: entry.conflictId,
        navigationId: entry.navigationId,
        createdAt: Date.now(),
      });
    }
  }

  return {
    actions,
    restorations,
    notifications,
  };
}
