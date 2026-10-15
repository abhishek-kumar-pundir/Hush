import { CATEGORIES } from '../classifier';
import type { AudioScene, AutomationSettings } from './types';

export const SCENE_DEEP_WORK: AudioScene = {
  id: 'deep-work',
  name: 'Deep Work',
  description: 'Prioritizes work communication and meetings, ducking distracting media and social audio.',
  icon: 'Briefcase',
  enabled: true,
  defaultResponse: 'duck',
  duckingLevel: 0.20,
  domainPriorities: {
    'meet.google.com': 95,
    'zoom.us': 95,
    'slack.com': 90,
    'web.whatsapp.com': 80,
    'github.com': 85,
    'notion.so': 80,
  },
  categoryPriorities: {
    [CATEGORIES.COMMUNICATION]: 90,
    [CATEGORIES.WORK]: 80,
    [CATEGORIES.STUDY]: 70,
    [CATEGORIES.OTHER]: 50,
    [CATEGORIES.MUSIC]: 30,
    [CATEGORIES.SOCIAL]: 20,
    [CATEGORIES.ENTERTAINMENT]: 15,
    [CATEGORIES.GAMING]: 10,
  },
  exclusions: ['meet.google.com', 'zoom.us'],
};

export const SCENE_STUDY: AudioScene = {
  id: 'study',
  name: 'Study',
  description: 'Prioritizes educational lectures and tutorials, lowering background music and entertainment.',
  icon: 'Book',
  enabled: true,
  defaultResponse: 'duck',
  duckingLevel: 0.25,
  domainPriorities: {
    'coursera.org': 95,
    'udemy.com': 95,
    'canvas.net': 95,
    'edx.org': 95,
    'khanacademy.org': 95,
    'youtube.com': 60, // Can be lecture or music, category/context decides
  },
  categoryPriorities: {
    [CATEGORIES.STUDY]: 95,
    [CATEGORIES.COMMUNICATION]: 80,
    [CATEGORIES.WORK]: 70,
    [CATEGORIES.OTHER]: 50,
    [CATEGORIES.MUSIC]: 30,
    [CATEGORIES.SOCIAL]: 15,
    [CATEGORIES.ENTERTAINMENT]: 15,
    [CATEGORIES.GAMING]: 10,
  },
  exclusions: ['coursera.org', 'udemy.com', 'canvas.net'],
};

export const SCENE_ENTERTAINMENT: AudioScene = {
  id: 'entertainment',
  name: 'Entertainment',
  description: 'Gives focus to your chosen entertainment or music stream, while balancing other media.',
  icon: 'Film',
  enabled: true,
  defaultResponse: 'duck',
  duckingLevel: 0.30,
  domainPriorities: {
    'netflix.com': 90,
    'youtube.com': 90,
    'spotify.com': 85,
    'twitch.tv': 85,
  },
  categoryPriorities: {
    [CATEGORIES.ENTERTAINMENT]: 90,
    [CATEGORIES.MUSIC]: 85,
    [CATEGORIES.GAMING]: 80,
    [CATEGORIES.COMMUNICATION]: 75,
    [CATEGORIES.SOCIAL]: 60,
    [CATEGORIES.WORK]: 40,
    [CATEGORIES.STUDY]: 40,
    [CATEGORIES.OTHER]: 40,
  },
  exclusions: [],
};

export const SCENE_CUSTOM: AudioScene = {
  id: 'custom',
  name: 'Custom',
  description: 'Custom acoustic profile with user-defined priority rules and exclusions.',
  icon: 'Sliders',
  enabled: true,
  defaultResponse: 'duck',
  duckingLevel: 0.25,
  domainPriorities: {},
  categoryPriorities: {
    [CATEGORIES.COMMUNICATION]: 85,
    [CATEGORIES.STUDY]: 80,
    [CATEGORIES.WORK]: 75,
    [CATEGORIES.ENTERTAINMENT]: 50,
    [CATEGORIES.MUSIC]: 50,
    [CATEGORIES.GAMING]: 50,
    [CATEGORIES.SOCIAL]: 40,
    [CATEGORIES.OTHER]: 40,
  },
  exclusions: [],
};

export const DEFAULT_SCENES: Record<string, AudioScene> = {
  [SCENE_DEEP_WORK.id]: SCENE_DEEP_WORK,
  [SCENE_STUDY.id]: SCENE_STUDY,
  [SCENE_ENTERTAINMENT.id]: SCENE_ENTERTAINMENT,
  [SCENE_CUSTOM.id]: SCENE_CUSTOM,
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  enabled: true,
  defaultResponse: 'duck',
  defaultDuckingLevel: 0.25,
  autoRestore: true,
  activeSceneId: 'study',
  scenes: DEFAULT_SCENES,
  domainPriorities: {},
  domainExclusions: [],
  manualOverrides: {},
  learningEnabled: true,
};
