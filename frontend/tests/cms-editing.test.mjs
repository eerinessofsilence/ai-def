import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { armsCoverage, armsMissing, blankTranslation, contentCoverage, contentMissing, coverage, hasTranslation, missingValues, prepareTranslationFields, reviewLabel } from '../src/cms/translations.ts';
import { fileKind, uploadError } from '../src/cms/media.ts';
import { duplicateContentBlock, fieldLabel, nodeTitle, relationNeighbor } from '../src/cms/content-types.ts';
import { api, APIError, revisionTitle } from '../src/cms/api.ts';
import { changeLanguage, contentChanges, isCurrentPreview, textDifference } from '../src/cms/changes.ts';
import { safeLink } from '../src/cms/rich-text.ts';
import { materialNeighbors } from '../src/cms/material-navigation.ts';

test('CMS controls and text keep their required contrast on all base working surfaces', () => {
  const css = readFileSync(new URL('../src/cms/cms.css', import.meta.url), 'utf8');
  const token = (name) => {
    const hex = css.match(new RegExp(`--cms-${name}:\\s*(#[0-9a-f]+);`, 'i'))?.[1];
    assert.ok(hex, `Missing CMS colour: ${name}`);
    const value = hex.length === 4 ? hex.slice(1).split('').map(v => v + v).join('') : hex.slice(1);
    return value.match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  for (const background of ['canvas', 'surface', 'surface-muted']) {
    assert.ok(contrast(token('control-border'), token(background)) >= 3, `Control boundary on ${background}`);
    assert.ok(contrast(token('text'), token(background)) >= 4.5, `Text on ${background}`);
    assert.ok(contrast(token('muted'), token(background)) >= 4.5, `Secondary text on ${background}`);
    assert.ok(contrast(token('accent'), token(background)) >= 3, `Focus indicator on ${background}`);
  }
});

test('portal placement headings use the actual shared module name without changing other titles', () => {
  const node = { id: 1, fields: { module: 7 }, sections: {} };
  const schema = { fields: [{ key: 'module', choices: [{ id: 7, label: 'Communications module' }] }] };
  assert.equal(nodeTitle(node, 'de', schema), 'Communications module');
  assert.equal(nodeTitle({ ...node, fields: { module: 8 } }, 'en', schema), '');
  assert.equal(nodeTitle({ ...node, fields: { module: 7, title: { en: 'English', de: 'Deutsch' } } }, 'de', schema), 'Deutsch');
  assert.equal(nodeTitle(node), '');
});

test('material navigation keeps the filtered page and resolves both pagination boundaries', async () => {
  const row = (target_id) => ({ target_id, document_id: null, name: String(target_id) });
  const pages = { 1: { items: [row(1)], page: 1, pages: 3, total: 3 }, 2: { items: [row(2)], page: 2, pages: 3, total: 3 }, 3: { items: [row(3)], page: 3, pages: 3, total: 3 } };
  const calls = [];
  const load = async (page) => { calls.push(page); return pages[page]; };
  const middle = await materialNeighbors({ id: 'doc', target_id: 2 }, 2, load);
  assert.equal(middle.previous.row.target_id, 1);
  assert.equal(middle.previous.page, 1);
  assert.equal(middle.next.row.target_id, 3);
  assert.deepEqual(calls, [2, 1, 3]);
  const first = await materialNeighbors({ id: 'doc', target_id: 1 }, 1, load);
  assert.equal(first.previous, null);
  const missing = await materialNeighbors({ id: 'gone', target_id: null }, 2, load);
  assert.deepEqual(missing, { found: false, previous: null, next: null });
  const draft = await materialNeighbors({ id: 'draft', target_id: null }, 1, async () => ({ ...pages[1], items: [{ ...row(null), document_id: 'draft' }], pages: 1 }));
  assert.equal(draft.found, true);
  assert.equal(draft.next, null);
  await assert.rejects(() => materialNeighbors({ id: 'doc', target_id: 1 }, 1, async () => { throw new Error('offline'); }), /offline/);
});

test('editor links reject script schemes, protocol-relative URLs and browser backslash normalisation', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,test', '//outside.invalid', '/\\outside.invalid', 'https://example.invalid/\npath', 'https://exa mple.invalid']) assert.equal(safeLink(href), null, href);
  for (const href of ['https://example.invalid/page', 'HTTPS://example.invalid', 'mailto:team@example.invalid', 'tel:+421123456', '/products/item', '#section']) assert.equal(safeLink(href), href);
});

test('duplicating a leaf content block keeps translations and media while regenerating its anchor', () => {
  const block = { id: 1, fields: { anchor_id: 'original', html: { en: '<p>Text</p>', de: '<p>Text DE</p>' }, image: { asset_id: 'real-image' } }, sections: {} };
  const copy = duplicateContentBlock(block);
  assert.notEqual(copy.id, block.id);
  assert.equal(copy.fields.anchor_id, '');
  assert.equal(copy.fields.image.asset_id, 'real-image');
  copy.fields.html.de = 'Changed';
  assert.equal(block.fields.html.de, '<p>Text DE</p>');
  assert.equal(block.fields.anchor_id, 'original');
});

test('inspection rejects old snapshots and unsaved structural changes before resolving field positions', () => {
  assert.equal(isCurrentPreview(3, 3, false), true);
  assert.equal(isCurrentPreview(2, 3, false), false);
  assert.equal(isCurrentPreview(3, 3, true), false);
  assert.equal(isCurrentPreview('3', 3, false), false);
  assert.equal(isCurrentPreview(undefined, 3, false), false);
});

test('review matches stable row IDs so reordering does not invent field edits', () => {
  const a = { id: 1, fields: { title: { en: 'One' } }, sections: {} };
  const b = { id: 2, fields: { title: { en: 'Two' } }, sections: {} };
  const changes = contentChanges({ sections: { blocks: [a, b] } }, { sections: { blocks: [b, a] } });
  assert.deepEqual(changes, [{ path: 'sections.blocks', before: [1, 2], after: [2, 1], type: 'order' }]);
  const edited = structuredClone(a);
  edited.fields.title.en = 'Changed';
  const next = contentChanges({ sections: { blocks: [a, b] } }, { sections: { blocks: [b, edited] } });
  assert.equal(next.length, 2);
  assert.deepEqual(next[1], { path: 'sections.blocks.1.fields.title.en', before: 'One', after: 'Changed', type: 'value' });
});

test('review keeps media replacements atomic and distinguishes language and shared changes', () => {
  const changes = contentChanges({ cover: { path: 'old.jpg', storage: true }, content: { en: { description: 'Old' } } }, { cover: { asset_id: 'new' }, content: { en: { description: 'New' } } });
  assert.equal(changes.length, 2);
  assert.equal(changes[0].path, 'cover');
  assert.equal(changeLanguage(changes[0].path), null);
  assert.equal(changeLanguage(changes[1].path), 'en');
  assert.deepEqual(contentChanges(null, { id: 'new', title: '', unused: null, rows: [] }), []);
});

test('review identifies added and removed rows without changing either draft', () => {
  const before = [{ id: 1, title: 'Old' }];
  const after = [{ id: 'new', title: 'New' }];
  const copy = structuredClone([before, after]);
  const changes = contentChanges(before, after, 'blocks');
  assert.deepEqual(changes.map(({ type }) => type), ['removed', 'added']);
  assert.deepEqual([before, after], copy);
});

test('text differences retain shared context and never split emoji or invent unchanged spans', () => {
  assert.deepEqual(textDifference('Range 100 km', 'Range 200 km'), { before: { prefix: 'Range ', changed: '1', suffix: '00 km' }, after: { prefix: 'Range ', changed: '2', suffix: '00 km' } });
  assert.deepEqual(textDifference('🚁 ready', '🚀 ready'), { before: { prefix: '', changed: '🚁', suffix: ' ready' }, after: { prefix: '', changed: '🚀', suffix: ' ready' } });
  assert.equal(textDifference('', 'Added').after.changed, 'Added');
  assert.equal(textDifference('Removed', '').before.changed, 'Removed');
  assert.equal(textDifference('Same', 'Same').after.changed, '');
});

test('coverage uses actual translations, including nested images, without changing a draft', () => {
  const schema = { fields: [{ key: 'title', translated: true, label: 'Заголовок' }, { key: 'slug', translated: false }], relations: { images: { label: 'Фотографии', fields: [{ key: 'alt', translated: true, label: 'Описание изображения' }], relations: {} } } };
  const data = { id: 1, fields: { title: { en: 'Original', de: '' }, slug: 'unchanged' }, sections: { images: [{ id: 9, fields: { alt: { en: 'Cover', de: 'Bild' } }, sections: {} }] } };
  const before = structuredClone(data);
  assert.deepEqual(contentCoverage(data, schema, 'de'), { total: 2, filled: 1 });
  assert.deepEqual(contentCoverage(data, schema, 'fr'), { total: 2, filled: 0 });
  assert.deepEqual(data, before);
  assert.equal(fieldLabel('sections.images.1.fields.alt.de', schema), 'Фотографии 2 · Описание изображения · DE');
});

test('coverage excludes empty HTML and shared fields, and counts nested structured values', () => {
  assert.equal(hasTranslation('<p><br>&nbsp;</p>'), false);
  assert.deepEqual(coverage({ title: 'Title', empty: '', rows: [{ label: 'Length', value: '100' }] }, { title: 'Titel', rows: [{ label: 'Länge', value: '' }] }), { total: 3, filled: 2 });
  const data = { name: 'Shared', slug: 'shared', content: { en: { description: 'Description', specifications: [] }, de: { description: '' } }, variants: [{ id: 'stable', code: 'standard', model_name: 'Shared model', content: { en: { label: 'Standard', specifications: [{ label: 'Length', value: '100 mm' }] }, de: { label: 'Standard', specifications: [] } }, images: [{ id: 7, media: { asset_id: 'shared-file' }, alt: { en: 'Side', de: 'Seite' } }] }] };
  assert.deepEqual(armsCoverage(data, 'de'), { total: 5, filled: 2 });
  assert.deepEqual(armsCoverage(data, 'en'), { total: 5, filled: 5 });
});

test('missing translation links skip inactive legacy sections and fields unrelated to the block type', () => {
  const blockSchema = { fields: [{ key: 'html', translated: true, label: 'Text' }, { key: 'paragraphs', translated: true, label: 'Paragraphs' }, { key: 'image_alt', translated: true, label: 'Image description' }], relations: {} };
  const schema = { fields: [], relations: { blocks: { ...blockSchema, label: 'Article content', group: 'blocks' }, sections: { ...blockSchema, label: 'Legacy sections', group: 'legacy' } } };
  const block = { id: 2, fields: { kind: 'text', html: { en: '<p>Original</p>', de: '' }, paragraphs: { en: ['Old'], de: [] }, image_alt: { en: 'Unused alt', de: '' } }, sections: {} };
  const data = { id: 1, fields: {}, sections: { blocks: [block], sections: [structuredClone(block)] } };
  const before = structuredClone(data);
  assert.deepEqual(contentCoverage(data, schema, 'de'), { total: 1, filled: 0 });
  assert.deepEqual(contentMissing(data, schema, 'de'), [{ path: 'sections.blocks.0.fields.html.de', label: 'Article content 1 · Text · DE', missing: 1 }]);
  assert.deepEqual(contentMissing(data, schema, 'en'), []);
  assert.deepEqual(data, before);
  data.sections.blocks[0].fields.kind = 'image';
  assert.equal(contentMissing(data, schema, 'de')[0].path, 'sections.blocks.0.fields.image_alt.de');
});

test('missing translation paths retain structured row and variant photo positions', () => {
  assert.deepEqual(missingValues([{ label: 'Length', value: '100' }], [{ label: 'Länge', value: '' }], 'content.de.specifications'), ['content.de.specifications.0.value']);
  const data = { content: { en: { description: 'Original' }, de: { description: 'Übersetzung' } }, variants: [{ content: { en: { label: 'Standard' }, de: {} }, images: [{ alt: { en: 'Front', de: '' } }] }] };
  assert.deepEqual(armsMissing(data, 'de'), ['variants.0.content.de.label', 'variants.0.images.0.alt.de']);
  assert.deepEqual(armsMissing(data, 'en'), []);
});

test('preparing missing translation fields preserves existing text, extra rows and independent structures', () => {
  const original = { rows: [{ label: 'Length', value: '100' }, { label: 'Weight', value: '20' }], details: { title: 'Title', description: 'English' }, optional: 'Optional' };
  const translated = { rows: [{ label: 'Länge', value: '' }], details: { title: 'Titel' }, custom: 'Keep me' };
  const before = structuredClone([original, translated]);
  const prepared = prepareTranslationFields(original, translated);
  assert.deepEqual(prepared, { rows: [{ label: 'Länge', value: '' }, { label: '', value: '' }], details: { title: 'Titel', description: '' }, optional: '', custom: 'Keep me' });
  assert.deepEqual([original, translated], before);
  prepared.rows[0].label = 'Changed';
  assert.equal(translated.rows[0].label, 'Länge');
  assert.deepEqual(prepareTranslationFields(['One'], ['Eins', 'Extra']), ['Eins', 'Extra']);
  assert.equal(prepareTranslationFields({ title: 'Text' }, 'Existing custom value'), 'Existing custom value');
});

test('review labels separate missing, changed, unreviewed and manually reviewed values', () => {
  const status = { total: 2, missing: 0, source_changed: 0, translation_changed: 0, unreviewed: 0, reviewed: 2, issues: [], checked_at: '2026-10-24T00:00:00Z' };
  assert.equal(reviewLabel(status), 'Reviewed against current English');
  assert.equal(reviewLabel({ ...status, unreviewed: 1, reviewed: 1 }), 'Not reviewed');
  assert.equal(reviewLabel({ ...status, translation_changed: 1, reviewed: 1 }), 'Translation changed since review');
  assert.equal(reviewLabel({ ...status, source_changed: 1, reviewed: 1 }), 'English source changed');
  assert.equal(reviewLabel({ ...status, missing: 1, source_changed: 1 }), 'Translation incomplete');
  assert.equal(reviewLabel(status, true), 'Save changes to update review status');
  assert.equal(reviewLabel({ ...status, total: 0, reviewed: 0 }), 'No translation values to review');
  assert.equal(revisionTitle('review_de'), 'German reviewed');
  assert.equal(revisionTitle('saved_copy'), 'Separate copy saved');
});

test('upload validation respects field type and real size boundaries', () => {
  assert.equal(fileKind('IMAGE.JPG'), 'image');
  assert.equal(fileKind('clip.WebM'), 'video');
  assert.equal(uploadError({ name: 'a.webp', size: 20 * 1024 * 1024 }), '');
  assert.match(uploadError({ name: 'a.webp', size: 20 * 1024 * 1024 + 1 }), /20/);
  assert.equal(uploadError({ name: 'a.mp4', size: 45 * 1024 * 1024 }, 'video'), '');
  assert.notEqual(uploadError({ name: 'a.pdf', size: 100 }, 'image'), '');
  assert.notEqual(uploadError({ name: 'a.svg', size: 100 }), '');
});

test('empty page translation preserves the layout without copying English content', () => {
  const original = { main: { hero: { title: 'Original' }, cards: [{ title: 'Card', text: 'Body' }] } };
  const before = structuredClone(original);
  const empty = blankTranslation(original);
  assert.deepEqual(empty, { main: { hero: { title: '' }, cards: [{ title: '', text: '' }] } });
  empty.main.hero.title = 'Übersetzung';
  assert.deepEqual(original, before);
  assert.deepEqual(coverage(original, empty), { total: 3, filled: 1 });
});

test('portal reordering stays inside a group even when rows are interleaved', () => {
  const rows = [{ id: 11, fields: { block: 1 } }, { id: 12, fields: { block: null } }, { id: 13, fields: { block: 1 } }, { id: 14, fields: { block: 2 } }];
  assert.equal(relationNeighbor(rows, 2, -1), 0);
  assert.equal(relationNeighbor(rows, 0, 1), 2);
  assert.equal(relationNeighbor(rows, 0, -1), undefined);
  assert.equal(relationNeighbor(rows, 1, 1), undefined);
  assert.equal(relationNeighbor(rows, 3, 0), undefined);
  assert.deepEqual(rows.map((row) => row.id), [11, 12, 13, 14]);
});
import { pageSections, replacePageSection } from '../src/cms/page-sections.ts';

test('page copy grouping preserves backend paths and untouched sections', () => {
  const content = { title: 'Title', download: 'Download', documents: [{ title: 'Certificate' }] };
  const before = structuredClone(content);
  assert.deepEqual(pageSections(content), [['__main', { title: 'Title', download: 'Download' }], ['documents', content.documents]]);
  const result = replacePageSection(content, '__main', { title: 'New title', download: 'Download' });
  assert.equal(result.title, 'New title');
  assert.equal(result.documents, content.documents);
  assert.equal('__main' in result, false);
  assert.deepEqual(content, before);
  assert.deepEqual(replacePageSection(content, 'documents', []), { ...content, documents: [] });
});

test('a stale CSRF token refreshes after another-tab login and retries the same write once', async (t) => {
  const writes = [];
  let sessions = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/session/')) return Response.json({ authenticated: true, csrf: ++sessions === 1 ? 'before-login' : 'after-login' });
    writes.push({ token: options.headers.get('X-CSRFToken'), body: options.body });
    return writes.length === 1 ? new Response('CSRF rejected', { status: 403 }) : Response.json({ version: 2 });
  });
  await api('session/');
  const body = JSON.stringify({ version: 1, data: { title: 'Preserved input' } });
  assert.deepEqual(await api('arms/documents/example/', { method: 'PUT', body }), { version: 2 });
  assert.deepEqual(writes, [{ token: 'before-login', body }, { token: 'after-login', body }]);
  assert.equal(sessions, 2);
});

test('a JSON permission denial is never retried as a CSRF failure', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ error: 'Недостаточно прав.' }, { status: 403 });
  });
  await assert.rejects(api('arms/documents/example/publish/', { method: 'POST', body: '{}' }), (error) => error instanceof APIError && error.status === 403);
  assert.equal(calls, 1);
});

test('CSRF recovery stops when signed out and never loops on another HTML 403', async (t) => {
  for (const authenticated of [false, true]) {
    let writes = 0;
    let sessions = 0;
    const mocked = t.mock.method(globalThis, 'fetch', async (url) => {
      if (url.endsWith('/session/')) return Response.json({ authenticated, csrf: `token-${++sessions}` });
      writes++;
      return new Response('Forbidden', { status: 403 });
    });
    await api('session/');
    await assert.rejects(api('arms/documents/example/', { method: 'PUT', body: '{}' }), (error) => error instanceof APIError && error.status === 403);
    assert.equal(writes, authenticated ? 2 : 1);
    assert.equal(sessions, 2);
    mocked.mock.restore();
  }
});

test('network failures are readable while deliberate cancellation retains AbortError', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api('arms/products/'), /Unable to connect to CMS/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(api('arms/products/', { signal: abort.signal }), (error) => error.name === 'AbortError');
});

test('sign-in can refresh an expired anonymous CSRF token without repeating a successful login', async (t) => {
  let reads = 0;
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) return Response.json({ authenticated: false, csrf: `anonymous-${++reads}` });
    return ++writes === 1 ? new Response('CSRF rejected', { status: 403 }) : Response.json({ authenticated: true, csrf: 'signed-in' });
  });
  await api('session/');
  assert.equal((await api('session/', { method: 'POST', body: '{}' })).authenticated, true);
  assert.equal(reads, 2);
  assert.equal(writes, 2);
});
