// Categories for tracked apps and websites - the same set the Monitoring page offers.
// Focus score, Deep Work, distraction nudges and the AI messages all depend on these, so
// common apps/sites get a built-in default: with nothing categorized every minute counted
// as focused work. A category the user picks in Monitoring always wins over the default.
export type ActivityCategory = 'WORK' | 'LEARNING' | 'DISTRACTION' | 'NEUTRAL';

// Older versions stored finer-grained distraction categories - still honor them.
const DISTRACTION_CATEGORIES = new Set([
  'DISTRACTION',
  'Social',
  'Entertainment',
  'Shopping',
  'Game',
]);

export const isDistractionCategory = (category?: string | null): boolean =>
  !!category && DISTRACTION_CATEGORIES.has(category);

// Matched against the domain and its parent domains ("pl.pinterest.com" -> "pinterest.com")
const DEFAULT_DOMAIN_CATEGORIES: Record<string, ActivityCategory> = {
  // Work
  'github.com': 'WORK',
  'gitlab.com': 'WORK',
  'bitbucket.org': 'WORK',
  'atlassian.net': 'WORK',
  'notion.so': 'WORK',
  'figma.com': 'WORK',
  'docs.google.com': 'WORK',
  'drive.google.com': 'WORK',
  'gemini.google.com': 'WORK',
  'chatgpt.com': 'WORK',
  'claude.ai': 'WORK',
  'vercel.com': 'WORK',
  localhost: 'WORK',
  // Learning
  'stackoverflow.com': 'LEARNING',
  'developer.mozilla.org': 'LEARNING',
  'notebooklm.google.com': 'LEARNING',
  'medium.com': 'LEARNING',
  'dev.to': 'LEARNING',
  'udemy.com': 'LEARNING',
  'coursera.org': 'LEARNING',
  'wikipedia.org': 'LEARNING',
  // Neutral
  'google.com': 'NEUTRAL',
  'mail.google.com': 'NEUTRAL',
  'outlook.com': 'NEUTRAL',
  'linkedin.com': 'NEUTRAL',
  // Distraction
  'youtube.com': 'DISTRACTION',
  'facebook.com': 'DISTRACTION',
  'instagram.com': 'DISTRACTION',
  'twitter.com': 'DISTRACTION',
  'x.com': 'DISTRACTION',
  'reddit.com': 'DISTRACTION',
  'tiktok.com': 'DISTRACTION',
  'netflix.com': 'DISTRACTION',
  'twitch.tv': 'DISTRACTION',
  'pinterest.com': 'DISTRACTION',
  '9gag.com': 'DISTRACTION',
  'wykop.pl': 'DISTRACTION',
  'pudelek.pl': 'DISTRACTION',
  'olx.pl': 'DISTRACTION',
  'allegro.pl': 'DISTRACTION',
  'amazon.com': 'DISTRACTION',
};

// Matched case-insensitively against the tracked app name
const DEFAULT_APP_CATEGORIES: Record<string, ActivityCategory> = {
  // Work
  webstorm: 'WORK',
  'webstorm (gui launcher)': 'WORK',
  'visual studio code': 'WORK',
  code: 'WORK',
  'intellij idea': 'WORK',
  pycharm: 'WORK',
  'android studio': 'WORK',
  'docker desktop': 'WORK',
  'windows terminal': 'WORK',
  powershell: 'WORK',
  notion: 'WORK',
  figma: 'WORK',
  'microsoft word': 'WORK',
  'microsoft excel': 'WORK',
  'microsoft powerpoint': 'WORK',
  libreoffice: 'WORK',
  'remote desktop': 'WORK',
  // Learning
  'calibre.exe': 'LEARNING',
  // Neutral - browsers are judged by the sites visited, not the app itself
  'google chrome': 'NEUTRAL',
  'microsoft edge': 'NEUTRAL',
  firefox: 'NEUTRAL',
  'opera air internet browser': 'NEUTRAL',
  opera: 'NEUTRAL',
  electron: 'NEUTRAL', // Thingy itself during development
  thingy: 'NEUTRAL',
  'eksplorator windows': 'NEUTRAL',
  'file explorer': 'NEUTRAL',
  slack: 'NEUTRAL',
  'microsoft teams': 'NEUTRAL',
  spotify: 'NEUTRAL',
  // Distraction
  steam: 'DISTRACTION',
  discord: 'DISTRACTION',
  'epic games launcher': 'DISTRACTION',
  netflix: 'DISTRACTION',
};

export const defaultDomainCategory = (
  domain: string,
): ActivityCategory | null => {
  const parts = domain
    .toLowerCase()
    .replace(/^www\./, '')
    .split('.');
  // Try the full host first, then each parent domain down to "name.tld"
  for (let i = 0; i < parts.length - 1; i += 1) {
    const candidate = parts.slice(i).join('.');
    if (DEFAULT_DOMAIN_CATEGORIES[candidate]) {
      return DEFAULT_DOMAIN_CATEGORIES[candidate];
    }
  }
  return DEFAULT_DOMAIN_CATEGORIES[domain.toLowerCase()] ?? null;
};

export const defaultAppCategory = (appName: string): ActivityCategory | null =>
  DEFAULT_APP_CATEGORIES[appName.trim().toLowerCase()] ?? null;

// The category that applies: the user's choice if any, else the built-in default
export const resolveDomainCategory = (
  domain: string,
  stored?: string | null,
): string | null => stored || defaultDomainCategory(domain);

export const resolveAppCategory = (
  appName: string,
  stored?: string | null,
): string | null => stored || defaultAppCategory(appName);
