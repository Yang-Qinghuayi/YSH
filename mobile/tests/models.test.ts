import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  layoutForWidth,
  normalizeSeed,
  parseSettings,
  progressionOf,
} from '../src/domain/models';
import { createColors, nativeVariables } from '../src/theme/colors';
test('seed input is canonical and invalid input cannot enter settings', () => {
  assert.equal(normalizeSeed(' #AbC '), '#aabbcc');
  assert.equal(normalizeSeed('#abcxyz'), null);
  assert.equal(parseSettings({ seed: 'bad' }).seed, DEFAULT_SETTINGS.seed);
});
test('persisted settings recover missing, malformed, out-of-range values', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.equal(
    parseSettings({ fontSize: 900, lineHeight: NaN, mode: 'broken', spread: 'no' }).fontSize,
    240
  );
  assert.equal(parseSettings({ lineHeight: NaN }).lineHeight, 1.6);
  assert.equal(parseSettings({ fontFamily: 'sans-serif', mode: 'dark' }).mode, 'dark');
});
test('responsive layout follows available width, including split view', () => {
  assert.equal(layoutForWidth(390).expanded, false);
  assert.equal(layoutForWidth(768).medium, true);
  assert.equal(layoutForWidth(1024).expanded, true);
  assert.ok(layoutForWidth(1400).columns > layoutForWidth(390).columns);
});
test('progress clamps bad values and prefers publication progression', () => {
  assert.equal(progressionOf({ href: 'a', type: 'x', locations: { totalProgression: 1.2 } }), 1);
  assert.equal(progressionOf({ href: 'a', type: 'x', locations: { totalProgression: NaN } }), 0);
  assert.equal(
    progressionOf({ href: 'a', type: 'x', locations: { totalProgression: 0.2, progression: 0.9 } }),
    0.2
  );
});
function contrast(a: string, b: string) {
  const luminance = (c: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test('official MCU runs without DOM; themes deterministic and semantic text readable', () => {
  for (const seed of ['#b86545', '#b05279', '#5f7f63', '#4f5fa8'])
    for (const dark of [false, true]) {
      const c = createColors(seed, dark);
      assert.deepEqual(c, createColors(seed, dark));
      assert.ok(Object.values(c).every((x) => /^#[a-f0-9]{6}$/.test(x)));
      assert.ok(contrast(c.primary, c.onPrimary) >= 4.5);
      assert.ok(contrast(c.background, c.onBackground) >= 4.5);
      assert.equal(nativeVariables(c)['--app-on-surface'], c.onSurface);
    }
  assert.notEqual(
    createColors('#b86545', false).background,
    createColors('#b86545', true).background
  );
});
