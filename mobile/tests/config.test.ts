import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { patchPodfile, patchGradle } = require('../plugins/withReadium.cjs');
test('native setup is idempotent and fails on unknown templates', () => {
  const pod = "target 'YSH' do\n post_install do |installer|\n end\nend";
  const patched = patchPodfile(pod);
  assert.equal(patchPodfile(patched), patched);
  assert.match(patched, /readium_pods\n/);
  assert.match(patched, /readium_post_install\(installer\)/);
  const gradle = patchGradle('android {\n}\ndependencies {\n}');
  assert.equal(patchGradle(gradle), gradle);
  assert.match(gradle, /coreLibraryDesugaringEnabled true/);
  assert.throws(() => patchGradle('unsupported'));
  assert.throws(() => patchPodfile('unsupported'));
});
test('NativeWind v5 semantic variables survive actual Tailwind and native CSS compilation', async () => {
  const postcss = require('postcss'),
    plugin = require('@tailwindcss/postcss');
  const { compile } = require('react-native-css/compiler');
  const result = await postcss([plugin()]).process(readFileSync('global.css', 'utf8'), {
    from: 'global.css',
  });
  const compiled = JSON.stringify(
    compile(result.css, { filename: 'global.css', projectRoot: process.cwd() }).stylesheet()
  );
  assert.ok(compiled.includes('app-background'));
  assert.ok(compiled.includes('bg-background'));
  assert.ok(compiled.includes('app-on-surface-variant'));
});
