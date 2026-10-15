import type { JournalEntry, PlannedAction } from './types';

export class ActionJournal {
  private entries: Map<number, JournalEntry> = new Map();

  constructor(initialEntries?: JournalEntry[]) {
    if (initialEntries) {
      initialEntries.forEach(entry => {
        this.entries.set(entry.tabId, entry);
      });
    }
  }

  /**
   * Records a new action applied by Hush to a tab.
   */
  recordAction(action: PlannedAction, fallbackUsed = false): JournalEntry {
    const existing = this.entries.get(action.tabId);

    // If already managed, keep the original baseline volume rather than overriding it
    const originalVolume = existing && existing.status === 'applied'
      ? existing.originalVolume
      : action.originalVolume;

    const originalMuted = existing && existing.status === 'applied'
      ? existing.originalMuted
      : action.originalMuted;

    const entry: JournalEntry = {
      id: action.id,
      tabId: action.tabId,
      navigationId: action.navigationId,
      actionType: action.actionType,
      originalVolume,
      appliedVolume: action.targetVolume,
      originalMuted,
      appliedMuted: action.targetMuted,
      status: 'applied',
      reason: action.reason,
      conflictId: action.conflictId,
      createdAt: action.createdAt,
      userOverrode: false,
      fallbackUsed,
    };

    this.entries.set(action.tabId, entry);
    return entry;
  }

  /**
   * Called when a manual user adjustment is detected on a tab.
   * Relinquishes ownership so Hush will never blindly undo what the user explicitly set.
   */
  recordUserOverride(tabId: number, newVolume?: number): boolean {
    const entry = this.entries.get(tabId);
    if (!entry || entry.status !== 'applied') return false;

    // Check if new volume differs from what Hush managed
    if (newVolume !== undefined && Math.abs(newVolume - entry.appliedVolume) < 0.02) {
      return false; // Still matches extension-managed level
    }

    entry.userOverrode = true;
    entry.status = 'overridden_by_user';
    return true;
  }

  /**
   * Marks a journal entry as restored when restoration has executed successfully.
   */
  markRestored(tabId: number): JournalEntry | null {
    const entry = this.entries.get(tabId);
    if (!entry) return null;

    entry.status = 'restored';
    entry.restoredAt = Date.now();
    return entry;
  }

  /**
   * Verifies whether Hush still owns the change and if it is safe to restore.
   */
  canSafelyRestore(tabId: number, currentNavId?: string, currentVolume?: number): boolean {
    const entry = this.entries.get(tabId);
    if (!entry || entry.status !== 'applied' || entry.userOverrode) {
      return false;
    }

    // Check navigation validity
    if (currentNavId && entry.navigationId && currentNavId !== entry.navigationId) {
      return false;
    }

    // Check if the user altered the volume behind our back
    if (currentVolume !== undefined && Math.abs(currentVolume - entry.appliedVolume) > 0.05) {
      entry.userOverrode = true;
      entry.status = 'overridden_by_user';
      return false;
    }

    return true;
  }

  /**
   * Cleans up dead tabs on tab removal or navigation.
   */
  handleTabRemoved(tabId: number): void {
    const entry = this.entries.get(tabId);
    if (entry && entry.status === 'applied') {
      entry.status = 'abandoned';
    }
    this.entries.delete(tabId);
  }

  /**
   * Reconciles journal against live browser tabs during service-worker hydration.
   * Discards stale records and abandons tabs that no longer exist.
   */
  reconcileWithActiveTabs(liveTabIds: Set<number>): void {
    for (const [tabId, entry] of this.entries.entries()) {
      if (!liveTabIds.has(tabId)) {
        entry.status = 'abandoned';
        this.entries.delete(tabId);
      }
    }
  }

  getEntry(tabId: number): JournalEntry | undefined {
    return this.entries.get(tabId);
  }

  getActiveEntries(): JournalEntry[] {
    return Array.from(this.entries.values()).filter(e => e.status === 'applied');
  }

  getAllEntries(): JournalEntry[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
  }
}
