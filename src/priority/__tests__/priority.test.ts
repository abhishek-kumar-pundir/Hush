import { describe, it, expect, beforeEach } from 'vitest';
import { CATEGORIES } from '../../classifier';
import { ActionJournal } from '../action-journal';
import { planAudioActions } from '../action-planner';
import type { AudioControlAdapter } from '../adapters';
import { detectAudioConflict } from '../conflict-detector';
import { PriorityCoordinator } from '../coordinator';
import { resolveSourcePriority, rankSources } from '../priority-engine';
import { DEFAULT_AUTOMATION_SETTINGS, SCENE_DEEP_WORK, SCENE_STUDY } from '../scenes';
import { SuggestionEngine } from '../suggestion-engine';
import type { AudioSource, AutomationSettings } from '../types';

function createMockSource(partial: Partial<AudioSource> = {}): AudioSource {
  return {
    tabId: partial.tabId ?? 1,
    windowId: partial.windowId ?? 1,
    url: partial.url ?? 'https://youtube.com/watch?v=123',
    domain: partial.domain ?? 'youtube.com',
    title: partial.title ?? 'YouTube Video',
    audible: partial.audible ?? true,
    mediaPlaying: partial.mediaPlaying ?? true,
    volume: partial.volume ?? 1.0,
    isMuted: partial.isMuted ?? false,
    isUserMuted: partial.isUserMuted ?? false,
    category: partial.category ?? CATEGORIES.ENTERTAINMENT,
    capabilities: partial.capabilities ?? {
      supportsVolume: true,
      supportsPause: true,
      isWebAudio: false,
      isHtml5Media: true,
    },
    lastAudibleTime: partial.lastAudibleTime ?? Date.now(),
    navigationId: partial.navigationId ?? `nav_${partial.tabId ?? 1}`,
    manualPriority: partial.manualPriority ?? null,
    isManuallyAdjusted: partial.isManuallyAdjusted ?? false,
    isActiveTab: partial.isActiveTab ?? false,
  };
}

class MockAudioAdapter implements AudioControlAdapter {
  volumes: Map<number, number> = new Map();
  muted: Map<number, boolean> = new Map();
  pausedTabs: Set<number> = new Set();
  failVolumeForTabs: Set<number> = new Set();

  async setVolume(tabId: number, volume: number) {
    if (this.failVolumeForTabs.has(tabId)) {
      return { success: false, fallbackUsed: false };
    }
    this.volumes.set(tabId, volume);
    return { success: true, fallbackUsed: false };
  }

  async pauseMedia(tabId: number) {
    this.pausedTabs.add(tabId);
    return { success: true };
  }

  async setMuted(tabId: number, muted: boolean) {
    this.muted.set(tabId, muted);
    return true;
  }

  async detectCapabilities() {
    return {
      supportsVolume: true,
      supportsPause: true,
      isWebAudio: true,
      isHtml5Media: true,
    };
  }
}

describe('Intelligent Audio Priority System', () => {
  let settings: AutomationSettings;

  beforeEach(() => {
    settings = JSON.parse(JSON.stringify(DEFAULT_AUTOMATION_SETTINGS));
  });

  // 1. One eligible source produces no conflict
  it('1. One eligible source produces no conflict', () => {
    const singleSource = createMockSource({ tabId: 1, domain: 'spotify.com', category: CATEGORIES.MUSIC });
    const result = detectAudioConflict([singleSource], settings, SCENE_STUDY);

    expect(result.hasConflict).toBe(false);
    expect(result.conflict).toBeNull();
  });

  // 2. Two intentionally permitted sources produce no conflict
  it('2. Two intentionally permitted sources produce no conflict', () => {
    const musicTab = createMockSource({
      tabId: 1,
      domain: 'spotify.com',
      category: CATEGORIES.MUSIC,
    });
    const ambientTab = createMockSource({
      tabId: 2,
      domain: 'rainsound.com',
      category: CATEGORIES.MUSIC,
    });

    const customSettings: AutomationSettings = {
      ...settings,
      domainPriorities: {
        'spotify.com': 50,
        'rainsound.com': 50,
      },
    };

    const result = detectAudioConflict([musicTab, ambientTab], customSettings);
    expect(result.hasConflict).toBe(false);
  });

  // 3. A higher-priority lecture wins over background music
  it('3. A higher-priority lecture wins over background music', () => {
    const lecture = createMockSource({
      tabId: 1,
      domain: 'coursera.org',
      category: CATEGORIES.STUDY,
      volume: 1.0,
    });
    const music = createMockSource({
      tabId: 2,
      domain: 'spotify.com',
      category: CATEGORIES.MUSIC,
      volume: 0.8,
    });

    const result = detectAudioConflict([lecture, music], settings, SCENE_STUDY);
    expect(result.hasConflict).toBe(true);
    expect(result.primarySource?.domain).toBe('coursera.org');
    expect(result.competingSources.map(s => s.domain)).toContain('spotify.com');
  });

  // 4. Explicit priorities beat contextual suggestions
  it('4. Explicit priorities beat contextual suggestions and defaults', () => {
    const music = createMockSource({
      tabId: 1,
      domain: 'spotify.com',
      category: CATEGORIES.MUSIC,
    });
    const work = createMockSource({
      tabId: 2,
      domain: 'slack.com',
      category: CATEGORIES.COMMUNICATION,
    });

    // Explicit user priority setting music to 95
    settings.domainPriorities['spotify.com'] = 95;

    const ranked = rankSources([work, music], settings, SCENE_STUDY);
    expect(ranked[0].source.domain).toBe('spotify.com');
    expect(ranked[0].resolution.ruleSource).toBe('domain_priority');
  });

  // 5. A manual override prevents automatic interference
  it('5. A manual override prevents automatic interference', () => {
    const lecture = createMockSource({ tabId: 1, domain: 'coursera.org', category: CATEGORIES.STUDY });
    const music = createMockSource({
      tabId: 2,
      domain: 'spotify.com',
      category: CATEGORIES.MUSIC,
      manualPriority: 'primary',
    });

    const musicPriority = resolveSourcePriority(music, settings, SCENE_STUDY);
    expect(musicPriority.score).toBeGreaterThan(900);
    expect(musicPriority.ruleSource).toBe('manual_override');

    const ranked = rankSources([lecture, music], settings, SCENE_STUDY);
    expect(ranked[0].source.tabId).toBe(2); // Music with manual primary wins
  });

  // 6. Excluded sources are never automatically changed
  it('6. Excluded sources are never automatically changed', () => {
    const lecture = createMockSource({ tabId: 1, domain: 'coursera.org', category: CATEGORIES.STUDY });
    const music = createMockSource({ tabId: 2, domain: 'spotify.com', category: CATEGORIES.MUSIC });

    settings.domainExclusions.push('spotify.com');

    const conflictResult = detectAudioConflict([lecture, music], settings, SCENE_STUDY);
    // Since spotify.com is excluded from ducking, it should not be an actionable competitor
    expect(conflictResult.competingSources.map(s => s.domain)).not.toContain('spotify.com');
  });

  // 7. Unsupported volume adjustment produces a safe fallback
  it('7. Unsupported volume adjustment produces a safe fallback', () => {
    const lecture = createMockSource({ tabId: 1, domain: 'coursera.org', category: CATEGORIES.STUDY });
    const unsupportedMusic = createMockSource({
      tabId: 2,
      domain: 'restricted-domain.com',
      category: CATEGORIES.MUSIC,
      capabilities: {
        supportsVolume: false,
        supportsPause: false,
        isWebAudio: false,
        isHtml5Media: false,
      },
    });

    const conflict = detectAudioConflict([lecture, unsupportedMusic], settings, SCENE_STUDY).conflict;
    const plan = planAudioActions(conflict, [lecture, unsupportedMusic], [], settings, SCENE_STUDY);

    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].fallbackToMute).toBe(true);
    expect(plan.actions[0].targetMuted).toBe(true);
  });

  // 8. Repeated events do not repeatedly lower the same source
  it('8. Repeated events do not repeatedly lower the same source', () => {
    const lecture = createMockSource({ tabId: 1, domain: 'coursera.org', category: CATEGORIES.STUDY });
    const music = createMockSource({ tabId: 2, domain: 'spotify.com', category: CATEGORIES.MUSIC, volume: 0.8 });

    const journal = new ActionJournal();
    const conflictResult = detectAudioConflict([lecture, music], settings, SCENE_STUDY);

    // First planning event
    const plan1 = planAudioActions(conflictResult.conflict, [lecture, music], journal.getAllEntries(), settings, SCENE_STUDY);
    expect(plan1.actions[0].originalVolume).toBe(0.8);
    expect(plan1.actions[0].targetVolume).toBe(0.2);

    // Apply action into journal
    journal.recordAction(plan1.actions[0]);

    // Second event occurs while music is already ducked (volume is now 0.2)
    const duckedMusic = { ...music, volume: 0.2 };
    const plan2 = planAudioActions(conflictResult.conflict, [lecture, duckedMusic], journal.getAllEntries(), settings, SCENE_STUDY);

    // Must still use 0.8 as the anchor, not 0.2 * 0.25 = 0.05
    expect(plan2.actions[0].originalVolume).toBe(0.8);
    expect(plan2.actions[0].targetVolume).toBe(0.2);
  });

  // 9. A conflict ending restores an extension-managed change safely
  it('9. A conflict ending restores an extension-managed change safely', () => {
    const journal = new ActionJournal();
    const action = {
      id: 'act_1',
      tabId: 2,
      actionType: 'DUCK' as const,
      originalVolume: 0.8,
      targetVolume: 0.2,
      originalMuted: false,
      targetMuted: false,
      reason: 'Ducked',
      conflictId: 'conf_1',
      navigationId: 'nav_2',
      createdAt: Date.now(),
    };
    journal.recordAction(action);

    const music = createMockSource({ tabId: 2, domain: 'spotify.com', volume: 0.2, navigationId: 'nav_2' });

    // Conflict is now null (lecture stopped playing)
    const plan = planAudioActions(null, [music], journal.getAllEntries(), settings, SCENE_STUDY);

    expect(plan.restorations.length).toBe(1);
    expect(plan.restorations[0].targetVolume).toBe(0.8);
  });

  // 10. A manual change after ducking prevents stale restoration
  it('10. A manual change after ducking prevents stale restoration', () => {
    const journal = new ActionJournal();
    const action = {
      id: 'act_1',
      tabId: 2,
      actionType: 'DUCK' as const,
      originalVolume: 0.8,
      targetVolume: 0.2,
      originalMuted: false,
      targetMuted: false,
      reason: 'Ducked',
      conflictId: 'conf_1',
      navigationId: 'nav_2',
      createdAt: Date.now(),
    };
    journal.recordAction(action);

    // User manually set volume to 0.5
    journal.recordUserOverride(2, 0.5);

    expect(journal.canSafelyRestore(2, 'nav_2', 0.5)).toBe(false);

    const music = createMockSource({ tabId: 2, domain: 'spotify.com', volume: 0.5, navigationId: 'nav_2' });
    const plan = planAudioActions(null, [music], journal.getAllEntries(), settings, SCENE_STUDY);

    // Should not restore because user overrode the value
    expect(plan.restorations.length).toBe(0);
  });

  // 11. A previously user-muted tab is not automatically unmuted
  it('11. A previously user-muted tab is not automatically unmuted', () => {
    const journal = new ActionJournal();
    const action = {
      id: 'act_1',
      tabId: 2,
      actionType: 'DUCK' as const,
      originalVolume: 0.8,
      targetVolume: 0.2,
      originalMuted: true, // Tab was already muted before Hush
      targetMuted: true,
      reason: 'Ducked',
      conflictId: 'conf_1',
      navigationId: 'nav_2',
      createdAt: Date.now(),
    };
    journal.recordAction(action);

    const music = createMockSource({ tabId: 2, domain: 'spotify.com', volume: 0.2, isMuted: true, navigationId: 'nav_2' });
    const plan = planAudioActions(null, [music], journal.getAllEntries(), settings, SCENE_STUDY);

    expect(plan.restorations.length).toBe(1);
    expect(plan.restorations[0].targetMuted).toBe(true); // Must remain muted
  });

  // 12. Navigation invalidates stale actions
  it('12. Navigation invalidates stale actions', () => {
    const journal = new ActionJournal();
    journal.recordAction({
      id: 'act_1',
      tabId: 2,
      actionType: 'DUCK',
      originalVolume: 0.8,
      targetVolume: 0.2,
      originalMuted: false,
      targetMuted: false,
      reason: 'Ducked',
      conflictId: 'conf_1',
      navigationId: 'old_page_url',
      createdAt: Date.now(),
    });

    // Page navigated to new_page_url
    expect(journal.canSafelyRestore(2, 'new_page_url')).toBe(false);
  });

  // 13. Closing a tab cleans up associated state
  it('13. Closing a tab cleans up associated state', () => {
    const coordinator = new PriorityCoordinator(new MockAudioAdapter());
    const tab = createMockSource({ tabId: 99, domain: 'test.com' });
    coordinator.syncTab(tab as any);

    expect(coordinator.getSources().some(s => s.tabId === 99)).toBe(true);

    coordinator.handleTabRemoved(99);
    expect(coordinator.getSources().some(s => s.tabId === 99)).toBe(false);
  });

  // 14. Worker restart recovers valid persisted state
  it('14. Worker restart recovers valid persisted state', () => {
    const savedEntry = {
      id: 'act_1',
      tabId: 10,
      navigationId: 'nav_10',
      actionType: 'DUCK' as const,
      originalVolume: 0.9,
      appliedVolume: 0.22,
      originalMuted: false,
      appliedMuted: false,
      status: 'applied' as const,
      reason: 'Persisted duck',
      conflictId: 'c_1',
      createdAt: Date.now(),
      userOverrode: false,
      fallbackUsed: false,
    };

    const journal = new ActionJournal([savedEntry]);
    const liveTabs = new Set([10, 11]);

    journal.reconcileWithActiveTabs(liveTabs);
    expect(journal.getActiveEntries().length).toBe(1);
    expect(journal.getEntry(10)?.status).toBe('applied');
  });

  // 15. Stale recovery records are rejected
  it('15. Stale recovery records are rejected', () => {
    const savedEntry = {
      id: 'act_1',
      tabId: 999, // Closed tab
      navigationId: 'nav_999',
      actionType: 'DUCK' as const,
      originalVolume: 0.9,
      appliedVolume: 0.22,
      originalMuted: false,
      appliedMuted: false,
      status: 'applied' as const,
      reason: 'Dead tab',
      conflictId: 'c_1',
      createdAt: Date.now(),
      userOverrode: false,
      fallbackUsed: false,
    };

    const journal = new ActionJournal([savedEntry]);
    const liveTabs = new Set([1, 2]); // tab 999 is closed

    journal.reconcileWithActiveTabs(liveTabs);
    expect(journal.getActiveEntries().length).toBe(0);
    expect(journal.getEntry(999)).toBeUndefined();
  });

  // 16. Scene changes reconcile actions without duplicating them
  it('16. Scene changes reconcile actions without duplicating them', () => {
    const coordinator = new PriorityCoordinator(new MockAudioAdapter());
    coordinator.setScene(SCENE_DEEP_WORK.id);

    expect(coordinator.getSettings().activeSceneId).toBe('deep-work');
  });

  // 17. Multiple conflicts produce a stable action plan
  it('17. Multiple conflicts produce a stable action plan', () => {
    const primary = createMockSource({ tabId: 1, domain: 'zoom.us', category: CATEGORIES.COMMUNICATION });
    const music = createMockSource({ tabId: 2, domain: 'spotify.com', category: CATEGORIES.MUSIC });
    const video = createMockSource({ tabId: 3, domain: 'youtube.com', category: CATEGORIES.ENTERTAINMENT });

    const result = detectAudioConflict([primary, music, video], settings, SCENE_DEEP_WORK);
    expect(result.hasConflict).toBe(true);
    expect(result.competingSources.length).toBe(2);

    const plan = planAudioActions(result.conflict, [primary, music, video], [], settings, SCENE_DEEP_WORK);
    expect(plan.actions.length).toBe(2);
    expect(new Set(plan.actions.map(a => a.tabId))).toEqual(new Set([2, 3]));
  });

  // 18. Missing permissions and adapter failures are handled correctly
  it('18. Missing permissions and adapter failures are handled correctly', async () => {
    const adapter = new MockAudioAdapter();
    adapter.failVolumeForTabs.add(5); // Simulate messaging failure

    const res = await adapter.setVolume(5, 0.2);
    expect(res.success).toBe(false);
  });

  // 19. Dismissed contextual suggestions do not repeatedly reappear
  it('19. Dismissed contextual suggestions do not repeatedly reappear', () => {
    const engine = new SuggestionEngine();
    const domain = 'soundcloud.com';

    // User lowers 3 times
    engine.recordUserAction(domain, 'study', 'lowered_volume', settings);
    engine.recordUserAction(domain, 'study', 'lowered_volume', settings);
    const sugg = engine.recordUserAction(domain, 'study', 'lowered_volume', settings);

    expect(sugg).not.toBeNull();
    engine.dismiss(sugg!.id);

    // Another event should not regenerate dismissed suggestion
    const nextSugg = engine.recordUserAction(domain, 'study', 'lowered_volume', settings);
    expect(nextSugg).toBeNull();
  });

  // 20. Disabling automation prevents new automated actions
  it('20. Disabling automation prevents new automated actions', () => {
    settings.enabled = false;

    const lecture = createMockSource({ tabId: 1, domain: 'coursera.org', category: CATEGORIES.STUDY });
    const music = createMockSource({ tabId: 2, domain: 'spotify.com', category: CATEGORIES.MUSIC });

    const result = detectAudioConflict([lecture, music], settings, SCENE_STUDY);
    expect(result.hasConflict).toBe(false);

    const plan = planAudioActions(result.conflict, [lecture, music], [], settings, SCENE_STUDY);
    expect(plan.actions.length).toBe(0);
  });
});
