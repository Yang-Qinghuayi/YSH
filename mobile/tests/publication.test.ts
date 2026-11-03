import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { inspectPublication, safeZipPath } from '../src/domain/publication';
function fixture(extra: Record<string, string | Uint8Array> = {}) {
  const files: Record<string, string | Uint8Array> = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml':
      '<container><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'OPS/package.opf':
      '<package><metadata><dc:title xmlns:dc="urn:dc">试读书</dc:title><dc:creator xmlns:dc="urn:dc">作者</dc:creator></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/></manifest><spine><itemref idref="c1"/></spine></package>',
    'OPS/one.xhtml': '<html><body>第一章 Hello world</body></html>',
    'OPS/cover.png': new Uint8Array([137, 80, 78, 71]),
    ...extra,
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])
    ),
    { level: 0 }
  );
}
test('EPUB extracts title, author, cover and detects content rather than extension', () => {
  const b = inspectPublication(fixture(), 'misnamed.zip');
  assert.equal(b.title, '试读书');
  assert.equal(b.author, '作者');
  assert.equal(b.format, 'epub');
  assert.equal(b.coverExtension, 'png');
});
test('PDF magic accepted and active/encrypted PDF rejected', () => {
  assert.equal(inspectPublication(strToU8('%PDF-1.7\nexample'), 'example.pdf').format, 'pdf');
  for (const key of ['/Encrypt', '/JS', '/JavaScript', '/Launch', '/URI'])
    assert.throws(() => inspectPublication(strToU8('%PDF-1.7\n' + key), 'x.pdf'));
});
test('empty, unsupported, corrupt ZIP and non-EPUB ZIP rejected', () => {
  for (const b of [
    new Uint8Array(),
    strToU8('a.txt'),
    fixture().subarray(0, 20),
    zipSync({ x: strToU8('y') }),
  ])
    assert.throws(() => inspectPublication(b, 'x.epub'));
});
test('unsafe paths, duplicate canonical paths and compression bombs rejected', () => {
  assert.throws(() => safeZipPath('../outside'));
  assert.throws(() => safeZipPath('/outside'));
  assert.throws(() => safeZipPath('C:\\outside'));
  assert.equal(safeZipPath('OPS/../cover.png'), 'cover.png');
  assert.throws(() => inspectPublication(fixture({ '../outside': 'bad' }), 'x.epub'));
  assert.throws(() => inspectPublication(fixture({ 'a/../mimetype': 'bad' }), 'x.epub'));
  const bytes = fixture();
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < bytes.length - 46; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      view.setUint32(i + 24, 0xffffffff, true);
      break;
    }
  assert.throws(() => inspectPublication(bytes, 'x.epub'), /限额|不一致/);
});
test('LCP, unsupported encryption, executable EPUB and remote resources rejected', () => {
  for (const extra of [
    { 'META-INF/license.lcpl': '{}' },
    { 'META-INF/encryption.xml': '<encryption Algorithm="http://readium.org/lcp"/>' },
    { 'OPS/one.xhtml': '<html><script>alert(1)</script></html>' },
    { 'OPS/one.xhtml': '<html><img src="https://evil.invalid/x"/></html>' },
    { 'OPS/one.xhtml': '<html><body onclick="attack()">text</body></html>' },
  ])
    assert.throws(() => inspectPublication(fixture(extra), 'x.epub'));
});
test('standard font obfuscation allowed; XML entity expansion rejected', () => {
  assert.equal(
    inspectPublication(
      fixture({
        'META-INF/encryption.xml':
          '<encryption><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/></encryption>',
      }),
      'x.epub'
    ).format,
    'epub'
  );
  assert.throws(
    () =>
      inspectPublication(
        fixture({
          'META-INF/container.xml': '<!DOCTYPE container [<!ENTITY x "evil">]><container/>',
        }),
        'x.epub'
      ),
    /XML/
  );
});

test('central/local mismatch and corrupted resource checksums fail before admission', () => {
  const bytes = fixture();
  const view = new DataView(bytes.buffer);
  view.setUint16(bytes.length - 22 + 8, 0, true);
  assert.throws(() => inspectPublication(bytes, 'bad.epub'), /不一致/);
  const corrupted = fixture();
  corrupted[40] = (corrupted[40]! + 1) & 255;
  assert.throws(() => inspectPublication(corrupted, 'bad.epub'));
});
test('encoded resource schemes are rejected as well as literal URLs', () => {
  assert.throws(() =>
    inspectPublication(
      fixture({ 'OPS/one.xhtml': '<html><img src="h&#116;tps://evil.invalid/x"/></html>' }),
      'x.epub'
    )
  );
});
