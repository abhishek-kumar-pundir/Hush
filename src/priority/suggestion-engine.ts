import type { AutomationSettings, ContextualSuggestion } from './types';

export interface UserPatternEvent {
  domain: string;
  sceneId: string;
  action: 'lowered_volume' | 'restored_volume' | 'manually_excluded';
  timestamp: number;
}

export class SuggestionEngine {
  private events: UserPatternEvent[] = [];
  private suggestions: Map<string, ContextualSuggestion> = new Map();
  private dismissedIds: Set<string> = new Set();
  private threshold = 3;

  constructor(
    initialSuggestions?: ContextualSuggestion[],
    dismissedIds?: string[],
    events?: UserPatternEvent[]
  ) {
    if (initialSuggestions) {
      initialSuggestions.forEach(s => this.suggestions.set(s.id, s));
    }
    if (dismissedIds) {
      dismissedIds.forEach(id => this.dismissedIds.add(id));
    }
    if (events) {
      this.events = events;
    }
  }

  /**
   * Records a user correction and checks if a contextual rule should be suggested.
   */
  recordUserAction(
    domain: string,
    sceneId: string,
    action: 'lowered_volume' | 'restored_volume' | 'manually_excluded',
    settings: AutomationSettings
  ): ContextualSuggestion | null {
    if (!settings.learningEnabled || !domain) return null;

    // Do not suggest if rule or exclusion already exists
    if (
      settings.domainExclusions.includes(domain) ||
      (settings.domainPriorities && settings.domainPriorities[domain] !== undefined)
    ) {
      return null;
    }

    const suggestionId = `sugg_${sceneId}_${domain}_${action}`;
    if (this.dismissedIds.has(suggestionId)) {
      return null;
    }

    // Keep events capped at 50 to avoid unbounded growth
    this.events.push({ domain, sceneId, action, timestamp: Date.now() });
    if (this.events.length > 50) {
      this.events = this.events.slice(-50);
    }

    const matches = this.events.filter(e => e.domain === domain && e.sceneId === sceneId && e.action === action);
    if (matches.length >= this.threshold) {
      let message = '';
      let suggestionType: ContextualSuggestion['suggestionType'] = 'set_domain_priority';
      let proposedPriority: number | undefined;

      const sceneName = settings.scenes[sceneId]?.name || sceneId;

      if (action === 'lowered_volume') {
        suggestionType = 'duck_default';
        proposedPriority = 20;
        message = `You've lowered ${domain} during ${sceneName} several times. Keep it background by default?`;
      } else if (action === 'restored_volume') {
        suggestionType = 'set_domain_priority';
        proposedPriority = 80;
        message = `You frequently keep ${domain} active during ${sceneName}. Prioritize it by default?`;
      } else {
        suggestionType = 'exclude_domain';
        message = `You've excluded ${domain} multiple times. Add it to your permanent exclusions?`;
      }

      const suggestion: ContextualSuggestion = {
        id: suggestionId,
        domain,
        sceneId,
        suggestionType,
        proposedPriority,
        message,
        triggerCount: matches.length,
        createdAt: Date.now(),
        status: 'pending',
      };

      this.suggestions.set(suggestionId, suggestion);
      return suggestion;
    }

    return null;
  }

  dismiss(suggestionId: string): void {
    this.dismissedIds.add(suggestionId);
    const existing = this.suggestions.get(suggestionId);
    if (existing) {
      existing.status = 'dismissed';
    }
  }

  accept(suggestionId: string, settings: AutomationSettings): boolean {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') return false;

    suggestion.status = 'accepted';

    if (suggestion.suggestionType === 'exclude_domain') {
      if (!settings.domainExclusions.includes(suggestion.domain)) {
        settings.domainExclusions.push(suggestion.domain);
      }
    } else if (suggestion.proposedPriority !== undefined) {
      settings.domainPriorities[suggestion.domain] = suggestion.proposedPriority;
    }

    return true;
  }

  getPendingSuggestions(): ContextualSuggestion[] {
    return Array.from(this.suggestions.values()).filter(s => s.status === 'pending');
  }

  getAllSuggestions(): ContextualSuggestion[] {
    return Array.from(this.suggestions.values());
  }

  getEvents(): UserPatternEvent[] {
    return this.events;
  }

  getDismissedIds(): string[] {
    return Array.from(this.dismissedIds);
  }

  clearLearnedData(): void {
    this.events = [];
    this.suggestions.clear();
    this.dismissedIds.clear();
  }
}
