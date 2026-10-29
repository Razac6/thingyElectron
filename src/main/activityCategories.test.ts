import {
  defaultAppCategory,
  defaultDomainCategory,
  isDistractionCategory,
  resolveAppCategory,
  resolveDomainCategory,
} from './activityCategories';

describe('activityCategories', () => {
  it('matches domains with www/subdomain prefixes to their default', () => {
    expect(defaultDomainCategory('www.youtube.com')).toBe('DISTRACTION');
    expect(defaultDomainCategory('pl.pinterest.com')).toBe('DISTRACTION');
    expect(defaultDomainCategory('github.com')).toBe('WORK');
    expect(defaultDomainCategory('localhost')).toBe('WORK');
  });

  it('prefers the most specific default (subdomain over parent domain)', () => {
    expect(defaultDomainCategory('mail.google.com')).toBe('NEUTRAL');
    expect(defaultDomainCategory('gemini.google.com')).toBe('WORK');
  });

  it('returns null for unknown domains and apps', () => {
    expect(defaultDomainCategory('192.168.0.133')).toBeNull();
    expect(defaultAppCategory('SomeRandomTool')).toBeNull();
  });

  it('matches app names case-insensitively', () => {
    expect(defaultAppCategory('WebStorm')).toBe('WORK');
    expect(defaultAppCategory('webstorm (GUI launcher)')).toBe('WORK');
    expect(defaultAppCategory('Discord')).toBe('DISTRACTION');
  });

  it("lets the user's stored category override the default", () => {
    expect(resolveDomainCategory('www.youtube.com', 'LEARNING')).toBe(
      'LEARNING',
    );
    expect(resolveAppCategory('Discord', 'WORK')).toBe('WORK');
    expect(resolveDomainCategory('www.youtube.com', null)).toBe('DISTRACTION');
  });

  it('treats the new and legacy distraction categories as distractions', () => {
    ['DISTRACTION', 'Social', 'Entertainment', 'Shopping', 'Game'].forEach(
      (c) => expect(isDistractionCategory(c)).toBe(true),
    );
    ['WORK', 'LEARNING', 'NEUTRAL', 'UNCATEGORIZED', null].forEach((c) =>
      expect(isDistractionCategory(c)).toBe(false),
    );
  });
});
