export const CATEGORIES = {
  ENTERTAINMENT: 'Entertainment',
  STUDY: 'Study',
  WORK: 'Work',
  COMMUNICATION: 'Communication',
  MUSIC: 'Music',
  SOCIAL: 'Social',
  GAMING: 'Gaming',
  OTHER: 'Other',
  UNKNOWN: 'Other'
} as const;

export type Category = typeof CATEGORIES[keyof typeof CATEGORIES];

const DOMAIN_RULES: Record<string, Category> = {
  'youtube.com': CATEGORIES.ENTERTAINMENT,
  'netflix.com': CATEGORIES.ENTERTAINMENT,
  'hulu.com': CATEGORIES.ENTERTAINMENT,
  
  'spotify.com': CATEGORIES.MUSIC,
  'soundcloud.com': CATEGORIES.MUSIC,
  'music.apple.com': CATEGORIES.MUSIC,
  
  'twitch.tv': CATEGORIES.GAMING,
  
  'twitter.com': CATEGORIES.SOCIAL,
  'x.com': CATEGORIES.SOCIAL,
  'facebook.com': CATEGORIES.SOCIAL,
  'reddit.com': CATEGORIES.SOCIAL,
  'instagram.com': CATEGORIES.SOCIAL,
  
  'github.com': CATEGORIES.WORK,
  'stackoverflow.com': CATEGORIES.WORK,
  'figma.com': CATEGORIES.WORK,
  'notion.so': CATEGORIES.WORK,
  
  'meet.google.com': CATEGORIES.COMMUNICATION,
  'zoom.us': CATEGORIES.COMMUNICATION,
  'discord.com': CATEGORIES.COMMUNICATION,
  'web.whatsapp.com': CATEGORIES.COMMUNICATION,
  'slack.com': CATEGORIES.COMMUNICATION,
  
  'coursera.org': CATEGORIES.STUDY,
  'udemy.com': CATEGORIES.STUDY,
  'canvas.net': CATEGORIES.STUDY,
};

export function classifyUrl(urlStr: string | undefined, overrides?: Record<string, Category>): Category {
  if (!urlStr) return CATEGORIES.OTHER;
  try {
    const url = new URL(urlStr);
    const domain = url.hostname.replace('www.', '');
    
    if (overrides && overrides[domain]) {
      const ov = overrides[domain];
      return ((ov as string) === 'Unknown' || (ov as string) === 'OTHER') ? CATEGORIES.OTHER : ov;
    }
    
    if (DOMAIN_RULES[domain]) return DOMAIN_RULES[domain];
    
    for (const [rule, category] of Object.entries(DOMAIN_RULES)) {
      if (domain.endsWith(rule)) {
        return category;
      }
    }
    
    return CATEGORIES.OTHER;
  } catch {
    return CATEGORIES.OTHER;
  }
}
