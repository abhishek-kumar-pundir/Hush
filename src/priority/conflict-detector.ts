import { rankSources } from './priority-engine';
import type { AudioConflict, AudioScene, AudioSource, AutomationSettings } from './types';

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflict: AudioConflict | null;
  competingSources: AudioSource[];
  primarySource: AudioSource | null;
  explanation: string;
}

/**
 * Detects whether active audio sources constitute an actionable conflict under the current scene and rules.
 * A conflict is actionable only when:
 * 1. Global automation is enabled.
 * 2. At least two eligible sources are currently producing audio or playing.
 * 3. The highest-priority source and lower-priority source have an actionable priority disparity.
 * 4. Lower-priority sources are not excluded or manually overridden to Primary.
 */
export function detectAudioConflict(
  activeSources: AudioSource[],
  settings: AutomationSettings,
  scene?: AudioScene
): ConflictDetectionResult {
  const activeScene = scene || settings.scenes[settings.activeSceneId] || settings.scenes['study'];

  if (!settings.enabled) {
    return {
      hasConflict: false,
      conflict: null,
      competingSources: [],
      primarySource: null,
      explanation: 'Automation is disabled.',
    };
  }

  // Filter sources producing audio or active media
  const eligibleSources = activeSources.filter(s => s.audible || s.mediaPlaying);

  if (eligibleSources.length < 2) {
    return {
      hasConflict: false,
      conflict: null,
      competingSources: [],
      primarySource: eligibleSources[0] || null,
      explanation: eligibleSources.length === 1 ? 'Single active audio source.' : 'No active audio sources.',
    };
  }

  // Rank sources deterministically
  const ranked = rankSources(eligibleSources, settings, activeScene);
  const primary = ranked[0];
  const primarySource = primary.source;
  const primaryScore = primary.resolution.score;

  // Competing sources are those strictly lower in priority than primary
  // A conflict is actionable when there is a meaningful priority difference (>= 15 points)
  // or when the primary has Primary level (>= 70) and competitors are <= 60.
  // Excluded sources cannot be modified (ducked/paused) by Hush automation.
  const actionableCompetitors = ranked.slice(1).filter(item => {
    if (item.resolution.isExcluded) {
      return false;
    }
    const scoreDiff = primaryScore - item.resolution.score;
    const isPrimaryDisparity = primary.resolution.level === 'primary' && item.resolution.score < 70;
    const isBackgroundLevel = item.resolution.level === 'background';
    return isBackgroundLevel || scoreDiff >= 15 || isPrimaryDisparity;
  });

  if (actionableCompetitors.length === 0) {
    return {
      hasConflict: false,
      conflict: null,
      competingSources: [],
      primarySource: primarySource,
      explanation: 'All active sources have compatible priority levels or are excluded from automated conflict response.',
    };
  }

  const competingSources = actionableCompetitors.map(c => c.source);
  const competingTabIds = competingSources.map(s => s.tabId);
  const competingDomains = competingSources.map(s => s.domain);

  const competitorNames = competingDomains.length === 1
    ? competingDomains[0]
    : `${competingDomains.slice(0, 2).join(', ')}${competingDomains.length > 2 ? ` (+${competingDomains.length - 2} more)` : ''}`;

  const explanation = `${primarySource.domain} takes priority in ${activeScene.name}. Hush is managing background audio on ${competitorNames}.`;

  const conflict: AudioConflict = {
    id: `conflict_${primarySource.tabId}_${Date.now()}`,
    primaryTabId: primarySource.tabId,
    primaryDomain: primarySource.domain,
    competingTabIds,
    competingDomains,
    sceneId: activeScene.id,
    detectedAt: Date.now(),
    status: 'active',
    explanation,
  };

  return {
    hasConflict: true,
    conflict,
    competingSources,
    primarySource,
    explanation,
  };
}
