import assert from 'node:assert/strict';
import test from 'node:test';

import { readReaderTheme } from '../src/utils/readerTheme.ts';

const styles = (values: Record<string, string>) => ({
  getPropertyValue: (name: string) => values[name] ?? '',
});

test('reader theme resolves the active Vuetify colors for an EPUB iframe', () => {
  assert.deepEqual(
    readReaderTheme(
      styles({
        '--v-theme-background': ' 250, 240, 245 ',
        '--v-theme-on-background': '42, 25, 31',
        '--v-theme-primary': '170, 80, 110',
        'color-scheme': 'light',
      })
    ),
    {
      bg: 'rgb(250, 240, 245)',
      fg: 'rgb(42, 25, 31)',
      primary: 'rgb(170, 80, 110)',
      isDarkMode: false,
    }
  );
});

test('reader uses the active dark theme and provides safe fallbacks before initialization', () => {
  assert.equal(readReaderTheme(styles({ 'color-scheme': 'dark' })).isDarkMode, true);
  assert.deepEqual(readReaderTheme(null), {
    bg: '#fff4ef',
    fg: '#341f19',
    primary: '#b85e4b',
    isDarkMode: false,
  });
});
