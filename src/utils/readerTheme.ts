/** Resolve Vuetify's RGB triplets to standalone colors usable inside EPUB iframes. */
export function readReaderTheme(styles: Pick<CSSStyleDeclaration, 'getPropertyValue'> | null) {
  const color = (name: string, fallback: string) => {
    const value = styles?.getPropertyValue(`--v-theme-${name}`).trim();
    return value ? `rgb(${value})` : fallback;
  };
  return {
    bg: color('background', '#fff4ef'),
    fg: color('on-background', '#341f19'),
    primary: color('primary', '#b85e4b'),
    isDarkMode: styles?.getPropertyValue('color-scheme').trim().split(/\s+/)[0] === 'dark',
  };
}
