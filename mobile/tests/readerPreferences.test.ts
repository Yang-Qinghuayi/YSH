import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/domain/models';
import { createColors } from '../src/theme/colors';
import { readerPreferences } from '../src/domain/readerPreferences';
test('EPUB font percentage converted to Readium factor, responsive columns do not affect scrolling', () => {
  const colors = createColors('#b86545', false);
  const prefs = readerPreferences(
    { ...DEFAULT_SETTINGS, fontSize: 150 },
    colors,
    false,
    'epub',
    false
  );
  assert.equal(prefs.fontSize, 1.5);
  assert.equal(prefs.columnCount, 'one');
  assert.equal(prefs.backgroundColor, colors.background);
  assert.equal(
    readerPreferences(DEFAULT_SETTINGS, colors, false, 'epub', true).columnCount,
    'auto'
  );
  assert.equal(
    readerPreferences({ ...DEFAULT_SETTINGS, scroll: true }, colors, false, 'epub', true)
      .columnCount,
    'one'
  );
});
test('PDF preferences do not imply reflow or text recoloring; stable width fit', () => {
  const prefs = readerPreferences(
    DEFAULT_SETTINGS,
    createColors('#b86545', true),
    true,
    'pdf',
    true
  );
  assert.equal(prefs.fontSize, undefined);
  assert.equal(prefs.textColor, undefined);
  assert.equal(prefs.fit, 'width');
  assert.equal(prefs.scroll, true);
});
