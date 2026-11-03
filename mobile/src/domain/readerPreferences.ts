import type { Preferences } from 'react-native-readium';
import type { Colors } from '../theme/colors';
import type { Format, Settings } from './models';
/** UI percentage and Readium scale are different units. PDF never receives EPUB-only controls. */
export function readerPreferences(
  settings: Settings,
  colors: Colors,
  dark: boolean,
  format: Format,
  expanded: boolean
): Preferences {
  const shared: Preferences = {
    backgroundColor: colors.background,
    spread: expanded && settings.spread ? 'auto' : 'never',
  };
  if (format === 'pdf') return { ...shared, scroll: true, fit: 'width', scrollAxis: 'vertical' };
  return {
    ...shared,
    theme: dark ? 'dark' : 'light',
    textColor: colors.onBackground,
    fontSize: settings.fontSize / 100,
    fontFamily: settings.fontFamily,
    lineHeight: settings.lineHeight,
    pageMargins: settings.margins,
    scroll: settings.scroll,
    columnCount: expanded && settings.spread && !settings.scroll ? 'auto' : 'one',
    publisherStyles: false,
  };
}
