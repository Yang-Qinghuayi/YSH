/** Guard the Vuetify/Tailwind integration against missing internal component styles. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('Vuetify loads its core and utility styles and internal form components retain their CSS imports', () => {
  const plugin = read('src/plugins/vuetify.ts');
  assert.match(plugin, /import ['"]vuetify\/styles['"]/);
  assert.doesNotMatch(plugin, /vuetify-utilities\.css/);
  const styles = read('node_modules/vuetify/lib/styles/main.css');
  assert.ok(styles.includes('@layer vuetify-utilities'));
  for (const component of ['VField', 'VInput', 'VSelectionControl', 'VSwitch']) {
    const module = read(`node_modules/vuetify/lib/components/${component}/${component}.js`);
    assert.ok(module.includes(`${component}.css`), `missing ${component} CSS import`);
  }
});

test('Vuetify runtime color classes used by form controls are preserved by Tailwind', () => {
  const entry = read('src/styles/tailwind.css');
  const source = entry.match(/@source inline\("([^"]+)"\)/);
  assert.ok(source, 'missing the inline source for Vuetify runtime color classes');
  const classNames = source[1].split(/\s+/);
  for (const className of ['bg-primary', 'bg-outline', 'text-outline']) {
    assert.ok(classNames.includes(className), `missing runtime color class: ${className}`);
  }

  const plugin = read('src/plugins/vuetify.ts');
  assert.match(plugin, /VSwitch:\s*\{\s*color:\s*'primary',\s*baseColor:\s*'outline'/);
  assert.match(plugin, /VSlider:\s*\{\s*color:\s*'primary'/);
});

test('Tailwind utilities follow Vuetify without applying Preflight to its components', () => {
  const entry = read('src/styles/tailwind.css');
  assert.match(
    entry,
    /@layer vuetify-core, vuetify-components, vuetify-overrides, vuetify-utilities, vuetify-final, theme, base, components, utilities;/
  );
  assert.match(entry, /@import ['"]tailwindcss\/theme\.css['"] layer\(theme\)/);
  assert.match(entry, /@import ['"]tailwindcss\/utilities\.css['"] layer\(utilities\)/);
  assert.doesNotMatch(entry, /@import ['"]tailwindcss(?:\/preflight\.css)?['"]/);
  const main = read('src/main.ts');
  assert.ok(main.indexOf('./styles/tailwind.css') < main.indexOf('./styles/global.scss'));
});
