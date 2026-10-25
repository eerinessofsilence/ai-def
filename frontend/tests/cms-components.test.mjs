import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/cms/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLFormElement', 'Element', 'Node', 'NodeFilter', 'MutationObserver', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'DocumentFragment']) globalThis[key] = key === 'window' ? dom.window : dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()]; };
HTMLElement.prototype.getBoundingClientRect = () => ({ left: 24, right: 264, top: 64, bottom: 108, width: 240, height: 44 });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter, Routes, Route, createMemoryRouter, RouterProvider } = await import('react-router-dom');
const { Pagination, RemoveButton, SaveState, Modal, MoreActions } = await import('../src/cms/ui.tsx');
const { default: CMSGuide } = await import('../src/cms/CMSGuide.tsx');
const { default: Login } = await import('../src/cms/Login.tsx');
const { SessionProvider } = await import('../src/cms/session.tsx');
const { useDocument } = await import('../src/cms/use-document.ts');
const { sanitisePaste } = await import('../src/cms/rich-text.ts');
const originalFetch = globalThis.fetch;
let root;
async function render(element) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(element); });
  return container;
}
async function click(element) {
  assert.ok(element, 'Expected a clickable control');
  await act(async () => { element.click(); });
}
const button = (label) => [...document.querySelectorAll('button')].find(el => el.textContent === label || el.getAttribute('aria-label') === label);
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  root = undefined;
  document.body.innerHTML = '';
  globalThis.fetch = originalFetch;
});

test('rich text paste drops executable content and unsafe links while preserving supported formatting', () => {
  const source = '<h1>Heading</h1><p onclick="alert(1)"><b>Bold</b> <a href="javascript:alert(1)">unsafe</a><a href="https://ai-def.com" target="_blank">safe</a></p><script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://example.invalid"></iframe>';
  const result = sanitisePaste(source);
  assert.equal(result.omitted, true);
  assert.equal(result.html, '<h2>Heading</h2><p><strong>Bold</strong> unsafe<a href="https://ai-def.com" rel="noopener noreferrer">safe</a></p>');
  assert.equal(document.querySelector('script,iframe,img'), null);
});

test('rich text paste preserves plain text and translates supported word-processor formatting', () => {
  const result = sanitisePaste('<div><span style="font-weight:700;font-style:italic;text-decoration:underline;color:red">Text &amp; more</span></div>');
  assert.equal(result.html, '<p><strong><em><u>Text &amp; more</u></em></strong></p>');
  assert.equal(result.omitted, false);
});

test('pagination hides a redundant single page and never navigates beyond first or last', async () => {
  let selected;
  const props = { total: 51, onPage: value => { selected = value; } };
  const container = await render(h(Pagination, { ...props, page: 1, pages: 1 }));
  assert.equal(container.textContent, '');
  await act(async () => { root.render(h(Pagination, { ...props, page: 1, pages: 3 })); });
  assert.equal(button('Previous page').disabled, true);
  await click(button('Next page'));
  assert.equal(selected, 2);
  await act(async () => { root.render(h(Pagination, { ...props, page: 3, pages: 3 })); });
  assert.equal(button('Next page').disabled, true);
  assert.match(container.textContent, /51–51 of 51/);
});

test('remove requires explicit confirmation and cancel preserves the content', async () => {
  let removed = 0;
  await render(h(RemoveButton, { label: 'image', onRemove: () => { removed++; } }));
  await click(button('Remove image'));
  assert.ok(document.querySelector('[role="dialog"]'));
  await click(button('Cancel'));
  assert.equal(removed, 0);
  await click(button('Remove image'));
  await click([...document.querySelectorAll('[role="dialog"] button')].find(el => el.textContent === 'Remove from draft'));
  assert.equal(removed, 1);
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('a busy modal cannot be dismissed and explains itself accessibly', async () => {
  let closed = 0;
  await render(h(Modal, { open: true, preventDismiss: true, title: 'Publishing', description: 'Please wait.', onClose: () => { closed++; } }, h('p', null, 'Saving')));
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, 'Publishing');
  assert.equal(document.getElementById(dialog.getAttribute('aria-describedby')).textContent, 'Please wait.');
  assert.equal(button('Close').disabled, true);
  await act(async () => { dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  assert.equal(closed, 0);
});

test('save feedback distinguishes uploads, unsaved drafts and saved unpublished content', async () => {
  const container = await render(h(SaveState, { state: 'saved' }));
  assert.match(container.textContent, /Saved to CMS/);
  assert.match(container.firstChild.title, /does not publish/);
  await act(async () => { root.render(h(SaveState, { state: 'saved', uploading: 1 })); });
  assert.equal(container.firstChild.dataset.state, 'uploading');
  assert.equal(container.querySelector('svg'), null);
  await act(async () => { root.render(h(SaveState, { state: 'dirty' })); });
  assert.match(container.textContent, /Unsaved changes/);
});

test('more actions closes on action and returns focus to its trigger', async () => {
  let called = 0;
  const container = await render(h(MoreActions, null, h('button', { onClick: () => { called++; } }, 'History')));
  container.querySelector('details').open = true;
  await click(button('History'));
  assert.equal(called, 1);
  assert.equal(container.querySelector('details').open, false);
  assert.equal(document.activeElement, container.querySelector('summary'));
});

function guideTargets(names, editor = false) {
  const fixture = document.createElement('aside');
  fixture.className = 'cms-sidebar';
  fixture.innerHTML = names.map(name => `<button data-cms-guide="${name}">${name}</button>`).join('') + (editor ? '<main class="cms-editor"><nav class="cms-section-nav"></nav><div class="cms-language"></div><div class="cms-editor-actions"></div></main>' : '');
  document.body.append(fixture);
}

test('guide includes only available sections, supports back/next/done and performs no requests', async () => {
  guideTargets(['site', 'products', 'pages', 'media', 'inquiries', 'settings']);
  let closed = 0;
  globalThis.fetch = () => { throw new Error('A guide must not call the API'); };
  await render(h(CMSGuide, { site: 'arms', kind: 'products', manager: false, canPublish: false, local: true, onSidebar() {}, onClose() { closed++; } }));
  assert.match(document.querySelector('[role="dialog"]').textContent, /1 of 6/);
  assert.equal(button('Back').disabled, true);
  await click(button('Next'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Each variant has its own photos/);
  await click(button('Back'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Choose a website/);
  for (let i = 0; i < 5; i++) await click(button('Next'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Ask a site manager/);
  assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /Client portal/);
  await click(button('Done'));
  assert.equal(closed, 1);
});

test('editor guide explains local draft publication and translation separately', async () => {
  guideTargets(['site'], true);
  await render(h(CMSGuide, { site: 'ai-def', kind: 'modules', manager: true, canPublish: true, local: true, onSidebar() {}, onClose() {} }));
  await click(button('Next'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /shared by every portal product/);
  await click(button('Next'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Empty translations use English/);
  await click(button('Next'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /local copy: public websites are unchanged/);
  assert.match(document.querySelector('[role="dialog"]').textContent, /products affected by this shared module/);
});

test('guide closes when another modal opens and cleans up its listener on unmount', async () => {
  guideTargets(['site']);
  let closed = 0;
  await render(h(CMSGuide, { site: 'arms', kind: 'products', manager: false, canPublish: false, local: true, onSidebar() {}, onClose() { closed++; } }));
  await act(async () => { window.dispatchEvent(new Event('cms-modal-open')); });
  assert.equal(closed, 1);
  await act(async () => { root.unmount(); });
  root = undefined;
  window.dispatchEvent(new Event('cms-modal-open'));
  assert.equal(closed, 1);
});

const anonymous = { authenticated: false, csrf: 'test-csrf', sites: [], user: null };
const login = () => h(MemoryRouter, { initialEntries: ['/login'] }, h(SessionProvider, null, h(Routes, null, h(Route, { path: '/login', element: h(Login) }), h(Route, { path: '/arms/products', element: h('p', null, 'Product list') }))));

test('login recovers from a server outage through Try again', async () => {
  let requests = 0;
  globalThis.fetch = async () => ++requests === 1 ? new Response('unavailable', { status: 503 }) : Response.json(anonymous);
  await render(login());
  assert.match(document.body.textContent, /Unable to open CMS/);
  await click(button('Try again'));
  assert.match(document.body.textContent, /Sign in with your work email/);
  assert.equal(document.querySelector('input[type="password"]').autocomplete, 'current-password');
});

test('login displays credential errors and permits a subsequent successful submission', async () => {
  let submissions = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method !== 'POST') return Response.json(anonymous);
    submissions++;
    assert.deepEqual(JSON.parse(options.body), { email: 'review@example.invalid', password: 'Test-login-password-123!' });
    return submissions === 1 ? Response.json({ error: 'Incorrect email or password.' }, { status: 401 }) : Response.json({ authenticated: true, csrf: 'new-csrf', sites: [{ id: 'arms', role: 'editor' }], user: { name: 'Reviewer' } });
  };
  await render(login());
  for (const [selector, value] of [['input[type="email"]', 'review@example.invalid'], ['input[type="password"]', 'Test-login-password-123!']]) {
    await act(async () => {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await act(async () => { document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  assert.match(document.querySelector('[role="alert"]').textContent, /Incorrect email or password/);
  assert.equal(button('Sign in').disabled, false);
  await act(async () => { document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  assert.match(document.body.textContent, /Product list/);
  assert.equal(submissions, 2);
});

const snapshot = { id: 'document', site: 'arms', kind: 'products', version: 1, data: { name: 'Original' }, media: {} };
let editor;
async function renderEditor(write) {
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/session/')) return Response.json(anonymous);
    if (options.method === 'PUT') return write(JSON.parse(options.body));
    return Response.json(snapshot);
  };
  function Probe() {
    editor = useDocument('arms', 'document');
    return h('p', null, editor.state);
  }
  const router = createMemoryRouter([{ path: '/', element: h(SessionProvider, null, h(Probe)) }, { path: '/next', element: h('p', null, 'Next page') }]);
  await render(h(RouterProvider, { router }));
  assert.equal(editor.state, 'saved');
  return router;
}

test('navigation waits for a successful save and preserves the editor after a save failure', async () => {
  let writes = 0;
  const router = await renderEditor(async payload => ++writes === 1
    ? Response.json({ error: 'Temporarily unavailable.' }, { status: 503 })
    : Response.json({ ...snapshot, version: 2, data: payload.data }));
  await act(async () => { editor.change(() => ({ name: 'Keep before leaving' })); });
  await act(async () => { await router.navigate('/next'); });
  assert.equal(router.state.location.pathname, '/');
  assert.equal(editor.blocker.state, 'blocked');
  assert.equal(editor.data.name, 'Keep before leaving');
  assert.equal(editor.unsaved, true);
  await act(async () => { await editor.flush(); editor.blocker.proceed(); });
  assert.equal(router.state.location.pathname, '/next');
  assert.match(document.body.textContent, /Next page/);
  assert.equal(writes, 2);
});

test('saving serializes in-flight edits with the latest version instead of dropping later typing', async () => {
  const writes = [];
  let release;
  await renderEditor(async payload => {
    writes.push(payload);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    return Response.json({ ...snapshot, version: payload.version + 1, data: payload.data });
  });
  await act(async () => { editor.change(() => ({ name: 'First edit' })); });
  let saving;
  await act(async () => { saving = editor.flush(); });
  assert.equal(editor.state, 'saving');
  await act(async () => { editor.change(() => ({ name: 'Later typing' })); });
  assert.equal(editor.flush(), saving);
  await act(async () => { release(); await saving; });
  assert.deepEqual(writes, [{ version: 1, data: { name: 'First edit' } }, { version: 2, data: { name: 'Later typing' } }]);
  assert.equal(editor.data.name, 'Later typing');
  assert.equal(editor.document.version, 3);
  assert.equal(editor.unsaved, false);
});

test('conflicts preserve local text and block automatic or keyboard overwrite', async () => {
  let writes = 0;
  await renderEditor(async () => { writes++; return Response.json({ error: 'Changed by another editor.' }, { status: 409 }); });
  await act(async () => { editor.change(() => ({ name: 'Keep my typing' })); });
  await act(async () => { await assert.rejects(editor.flush(), /Changed by another editor/); });
  assert.equal(editor.conflict, true);
  assert.equal(editor.unsaved, true);
  assert.equal(editor.data.name, 'Keep my typing');
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true);
  const shortcut = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
  await act(async () => { window.dispatchEvent(shortcut); });
  assert.equal(shortcut.defaultPrevented, true);
  assert.equal(writes, 1);
});

test('saving waits for uploads and includes their final media reference', async () => {
  let completeUpload;
  const writes = [];
  await renderEditor(async payload => { writes.push(payload); return Response.json({ ...snapshot, version: 2, data: payload.data }); });
  await act(async () => {
    editor.change(() => ({ name: 'Edited' }));
    editor.trackUpload(new Promise(resolve => { completeUpload = resolve; }));
  });
  assert.equal(editor.uploading, 1);
  let saving;
  await act(async () => { saving = editor.flush(); });
  assert.equal(writes.length, 0);
  await act(async () => {
    editor.change(previous => ({ ...previous, cover: { asset_id: 'uploaded-image' } }));
    completeUpload();
    await saving;
  });
  assert.equal(writes[0].data.cover.asset_id, 'uploaded-image');
  assert.equal(editor.uploading, 0);
  assert.equal(editor.unsaved, false);
});

test('field validation errors clear only for edited fields and retry keeps the draft', async () => {
  let writes = 0;
  await renderEditor(async payload => ++writes === 1
    ? Response.json({ error: 'Check fields.', fields: { name: 'Required', slug: 'Already used' } }, { status: 422 })
    : Response.json({ ...snapshot, version: 2, data: payload.data }));
  await act(async () => { editor.change(() => ({ name: '', slug: 'used' })); });
  await act(async () => { await assert.rejects(editor.flush(), /Check fields/); });
  assert.equal(editor.state, 'error');
  await act(async () => { editor.change(previous => ({ ...previous, name: 'Fixed name' })); });
  assert.deepEqual(editor.fields, { slug: 'Already used' });
  await act(async () => { editor.change(previous => ({ ...previous, slug: 'new-address' })); await editor.flush(); });
  assert.deepEqual(editor.fields, {});
  assert.equal(editor.state, 'saved');
});
