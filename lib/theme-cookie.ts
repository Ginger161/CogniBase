export const THEME_COOKIE = 'cb-theme';
export const THEMES = ['charcoal', 'dark', 'ivory'] as const;
export type AppTheme = (typeof THEMES)[number];

export function isAppTheme(value: string | undefined): value is AppTheme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

// Mirrors the saved theme into a cookie so the server can render the right
// theme on the first paint, before the profile has loaded.
export function writeThemeCookie(theme: string) {
  if (typeof document === 'undefined' || !isAppTheme(theme)) return;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
