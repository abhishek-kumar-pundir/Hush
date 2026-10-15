import type { Category } from '../classifier';

export type PriorityLevel = 'primary' | 'normal' | 'background' | 'excluded';

export type PriorityRuleSource =
  | 'global_disabled'
  | 'safety_restriction'
  | 'manual_override'
  | 'exclusion'
  | 'domain_priority'
  | 'scene_domain_priority'
  | 'scene_category_priority'
  | 'contextual_active'
  | 'category_default'
  | 'fallback';

export interface PriorityResolution {
  score: number;
  level: PriorityLevel;
  ruleSource: PriorityRuleSource;
  reason: string;
  isExcluded: boolean;
}

export type ConflictResponse = 'duck' | 'pause' | 'notify';

export interface AudioScene {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  defaultResponse: ConflictResponse;
  duckingLevel: number; // 0.0 - 1.0, e.g. 0.25
  domainPriorities: Record<string, number>; // domain -> priority score 0-100
  categoryPriorities: Record<Category, number>; // category -> priority score 0-100
  exclusions: string[]; // domains excluded from automated ducking
}

export interface ControlCapabilities {
  supportsVolume: boolean;
  supportsPause: boolean;
  isWebAudio: boolean;
  isHtml5Media: boolean;
}

export interface AudioSource {
  tabId: number;
  windowId: number;
  url: string;
  domain: string;
  title: string;
  favIconUrl?: string;
  audible: boolean;
  mediaPlaying: boolean;
  volume: number; // current volume 0.0 - 1.0
  isMuted: boolean;
  isUserMuted: boolean;
  category: Category;
  capabilities: ControlCapabilities;
  lastAudibleTime: number;
  navigationId: string;
  manualPriority?: PriorityLevel | null;
  isManuallyAdjusted?: boolean;
  isActiveTab?: boolean;
}

export interface AudioConflict {
  id: string;
  primaryTabId: number;
  primaryDomain: string;
  competingTabIds: number[];
  competingDomains: string[];
  sceneId: string;
  detectedAt: number;
  status: 'active' | 'resolved';
  explanation: string;
}

export type PlannedActionType = 'DUCK' | 'PAUSE' | 'NOTIFY' | 'RESTORE';

export interface PlannedAction {
  id: string;
  tabId: number;
  actionType: PlannedActionType;
  originalVolume: number;
  targetVolume: number;
  originalMuted: boolean;
  targetMuted: boolean;
  reason: string;
  conflictId: string;
  navigationId: string;
  createdAt: number;
  fallbackToMute?: boolean;
}

export type JournalStatus = 'applied' | 'restored' | 'overridden_by_user' | 'abandoned';

export interface JournalEntry {
  id: string;
  tabId: number;
  navigationId: string;
  actionType: PlannedActionType;
  originalVolume: number;
  appliedVolume: number;
  originalMuted: boolean;
  appliedMuted: boolean;
  status: JournalStatus;
  reason: string;
  conflictId: string;
  createdAt: number;
  restoredAt?: number;
  userOverrode: boolean;
  fallbackUsed: boolean;
}

export type SuggestionType = 'set_domain_priority' | 'exclude_domain' | 'duck_default';

export interface ContextualSuggestion {
  id: string;
  domain: string;
  sceneId: string;
  suggestionType: SuggestionType;
  proposedPriority?: number;
  message: string;
  triggerCount: number;
  createdAt: number;
  status: 'pending' | 'accepted' | 'dismissed';
}

export interface AutomationSettings {
  enabled: boolean;
  defaultResponse: ConflictResponse;
  defaultDuckingLevel: number; // e.g. 0.25 (25%)
  autoRestore: boolean;
  activeSceneId: string;
  scenes: Record<string, AudioScene>;
  domainPriorities: Record<string, number>;
  domainExclusions: string[];
  manualOverrides: Record<number, PriorityLevel>; // tabId -> PriorityLevel
  learningEnabled: boolean;
}

export interface IntelligentAudioState {
  settings: AutomationSettings;
  activeConflicts: AudioConflict[];
  journal: JournalEntry[];
  suggestions: ContextualSuggestion[];
  lastExplanation: string | null;
  activeSources: AudioSource[];
}
