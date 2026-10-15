import { CATEGORIES } from '../classifier';
import type { AudioScene, AudioSource, AutomationSettings, PriorityResolution } from './types';

export const CATEGORY_BASE_SCORES: Record<string, number> = {
  [CATEGORIES.COMMUNICATION]: 75,
  [CATEGORIES.STUDY]: 70,
  [CATEGORIES.WORK]: 65,
  [CATEGORIES.OTHER]: 50,
  [CATEGORIES.MUSIC]: 35,
  [CATEGORIES.ENTERTAINMENT]: 30,
  [CATEGORIES.GAMING]: 25,
  [CATEGORIES.SOCIAL]: 20,
};

/**
 * Resolves priority for an individual audio source according to the strict rule precedence:
 * 1. Global automation disabled or safety restrictions.
 * 2. Explicit manual overrides and user exclusions.
 * 3. Explicit source or domain priorities.
 * 4. Rules belonging to the currently selected scene.
 * 5. Contextual signals and approved suggestions.
 * 6. Deterministic default behavior.
 */
export function resolveSourcePriority(
  source: AudioSource,
  settings: AutomationSettings,
  scene?: AudioScene
): PriorityResolution {
  const activeScene = scene || settings.scenes[settings.activeSceneId] || settings.scenes['study'];

  const isExcluded =
    settings.domainExclusions.includes(source.domain) ||
    Boolean(activeScene?.exclusions?.includes(source.domain)) ||
    settings.manualOverrides[source.tabId] === 'excluded' ||
    source.manualPriority === 'excluded';

  // 1. Global automation disabled
  if (!settings.enabled) {
    return {
      score: 50,
      level: 'normal',
      ruleSource: 'global_disabled',
      reason: 'Automation is globally paused by user.',
      isExcluded,
    };
  }

  // 2b. Explicit manual tab overrides
  const manual = settings.manualOverrides[source.tabId] || source.manualPriority;
  if (manual) {
    if (manual === 'excluded') {
      return {
        score: 50,
        level: 'excluded',
        ruleSource: 'manual_override',
        reason: 'Manually excluded by user for this tab.',
        isExcluded: true,
      };
    }
    if (manual === 'primary') {
      return {
        score: 950,
        level: 'primary',
        ruleSource: 'manual_override',
        reason: 'Manually set to Primary by user.',
        isExcluded,
      };
    }
    if (manual === 'background') {
      return {
        score: 15,
        level: 'background',
        ruleSource: 'manual_override',
        reason: 'Manually set to Background by user.',
        isExcluded,
      };
    }
    return {
      score: 50,
      level: 'normal',
      ruleSource: 'manual_override',
      reason: 'Manually reset to Normal by user.',
      isExcluded,
    };
  }

  // 3. Explicit domain priorities (User configured)
  if (settings.domainPriorities && settings.domainPriorities[source.domain] !== undefined) {
    const score = settings.domainPriorities[source.domain];
    return {
      score,
      level: score >= 70 ? 'primary' : score <= 30 ? 'background' : 'normal',
      ruleSource: 'domain_priority',
      reason: `User priority rule for ${source.domain} (${score}/100)`,
      isExcluded,
    };
  }

  // 4. Scene-specific domain rules
  if (activeScene && activeScene.domainPriorities && activeScene.domainPriorities[source.domain] !== undefined) {
    const score = activeScene.domainPriorities[source.domain];
    return {
      score,
      level: score >= 70 ? 'primary' : score <= 30 ? 'background' : 'normal',
      ruleSource: 'scene_domain_priority',
      reason: `Prioritized by ${activeScene.name} for ${source.domain} (${score}/100)`,
      isExcluded,
    };
  }

  // 4b. Scene-specific category rules
  if (activeScene && activeScene.categoryPriorities && activeScene.categoryPriorities[source.category] !== undefined) {
    let score = activeScene.categoryPriorities[source.category];
    // Modest contextual boost if active tab, but within scene bounds
    if (source.isActiveTab && score < 95) {
      score += 4;
    }
    return {
      score,
      level: score >= 70 ? 'primary' : score <= 30 ? 'background' : 'normal',
      ruleSource: 'scene_category_priority',
      reason: `${source.category} activity prioritized by ${activeScene.name} (${score}/100)`,
      isExcluded,
    };
  }

  // 5. Contextual signals & Category default
  let baseScore = CATEGORY_BASE_SCORES[source.category] || 50;
  if (source.isActiveTab) {
    baseScore = Math.min(95, baseScore + 5);
  }

  return {
    score: baseScore,
    level: baseScore >= 70 ? 'primary' : baseScore <= 30 ? 'background' : 'normal',
    ruleSource: source.isActiveTab ? 'contextual_active' : 'category_default',
    reason: source.isActiveTab
      ? `Active browser tab (${source.category})`
      : `Default activity priority for ${source.category} (${baseScore}/100)`,
    isExcluded,
  };
}

/**
 * Deterministically ranks active sources from highest priority to lowest priority.
 */
export function rankSources(
  sources: AudioSource[],
  settings: AutomationSettings,
  scene?: AudioScene
): { source: AudioSource; resolution: PriorityResolution }[] {
  return sources
    .map(source => ({
      source,
      resolution: resolveSourcePriority(source, settings, scene),
    }))
    .sort((a, b) => {
      // Higher score comes first
      if (b.resolution.score !== a.resolution.score) {
        return b.resolution.score - a.resolution.score;
      }

      // Tie-break: active tab wins tie
      if (a.source.isActiveTab && !b.source.isActiveTab) return -1;
      if (b.source.isActiveTab && !a.source.isActiveTab) return 1;

      // Tie-break: earlier audible time wins tie
      if (a.source.lastAudibleTime !== b.source.lastAudibleTime) {
        return a.source.lastAudibleTime - b.source.lastAudibleTime;
      }

      // Deterministic fallback: lower tabId
      return a.source.tabId - b.source.tabId;
    });
}
