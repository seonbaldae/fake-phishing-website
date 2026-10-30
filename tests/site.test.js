const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

function mount() {
  const registry = new Map();
  const components = new Map();
  const documentListeners = {};
  const intervals = new Map();
  let now = 0;
  let creationName;
  let nextTimer = 0;
  let focused;

  class Element {
    constructor() {
      this.localName = creationName;
      this.listeners = {};
      this.attributes = new Map();
      this.textContent = '';
      this.open = false;
    }
    addEventListener(event, handler) { this.listeners[event] = handler; }
    dispatchEvent(event) {
      if (event.bubbles && event.composed) documentListeners[event.type]({ composedPath: () => [this] });
    }
    focus() { focused = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close(); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    removeAttribute(key) { this.attributes.delete(key); }
    getAttribute(key) { return this.attributes.get(key); }
    attachShadow(options) {
      assert.equal(options.mode, 'open');
      const nodes = new Map();
      this.shadowRoot = {
        children: [],
        append(...children) { this.children.push(...children); },
        querySelector(selector) {
          const source = this.children[1].source;
          if (selector.startsWith('#')) assert.ok(source.includes(`id="${selector.slice(1)}"`), selector);
          else if (selector.startsWith('.')) assert.ok(source.includes(`class="${selector.slice(1)}"`), selector);
          else if (selector === '[data-explain]') assert.ok(source.includes('data-explain'));
          else assert.ok(source.includes(`<${selector}>`), selector);
          if (!nodes.has(selector)) nodes.set(selector, new Element());
          return nodes.get(selector);
        }
      };
      return this.shadowRoot;
    }
  }

  vm.runInNewContext(script, {
    HTMLElement: Element,
    CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    customElements: { define(name, component) { assert.equal(registry.has(name), false); registry.set(name, component); } },
    document: {
      createElement: () => new Element(),
      getElementById(id) {
        const source = html.match(new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`))[1];
        return { content: { cloneNode: () => ({ source }) } };
      },
      querySelector: selector => components.get(selector),
      addEventListener(event, handler) { documentListeners[event] = handler; }
    },
    Date: { now: () => now },
    setInterval(callback, delay) { assert.equal(delay, 1000); intervals.set(++nextTimer, callback); return nextTimer; },
    clearInterval: id => intervals.delete(id)
  });
  for (const [name, Component] of registry) {
    creationName = name;
    components.set(name, new Component());
  }
  const timer = components.get('countdown-timer');
  timer.connectedCallback();
  const elements = new Map([
    ['#explanation', components.get('explanation-dialog').dialog],
    ['#claim-button', components.get('prize-hero').shadowRoot.querySelector('#claim-button')],
    ['[data-explain]', components.get('site-header').shadowRoot.querySelector('[data-explain]')],
    ['#countdown', timer.shadowRoot.querySelector('#countdown')],
    ['#close-dialog', components.get('explanation-dialog').shadowRoot.querySelector('#close-dialog')],
    ['#confirm-dialog', components.get('explanation-dialog').shadowRoot.querySelector('#confirm-dialog')]
  ]);
  return {
    elements, components,
    advance(milliseconds) { now = milliseconds; for (const tick of intervals.values()) tick(); },
    isStopped: () => intervals.size === 0,
    activeTimers: () => intervals.size,
    focused: () => focused
  };
}

test('both entry points open the explanation and both close controls dismiss it', () => {
  const { elements } = mount();
  const dialog = elements.get('#explanation');
  elements.get('#claim-button').listeners.click();
  assert.equal(dialog.open, true);
  elements.get('#close-dialog').listeners.click();
  assert.equal(dialog.open, false);
  elements.get('[data-explain]').listeners.click();
  assert.equal(dialog.open, true);
  elements.get('#confirm-dialog').listeners.click();
  assert.equal(dialog.open, false);
});

test('countdown follows elapsed time, including background-tab delays', () => {
  const site = mount();
  site.advance(1000);
  assert.equal(site.elements.get('#countdown').textContent, '04:59');
  site.advance(241000);
  assert.equal(site.elements.get('#countdown').textContent, '00:59');
  assert.equal(site.isStopped(), false);
});

test('expiration stops the timer without blocking the demonstration button', () => {
  const site = mount();
  site.advance(400000);
  assert.equal(site.elements.get('#countdown').textContent, '시연 시간 종료');
  assert.equal(site.isStopped(), true);
  site.elements.get('#claim-button').listeners.click();
  assert.equal(site.elements.get('#explanation').open, true);
});

test('countdown rounds up partial seconds and expires exactly at five minutes', () => {
  const site = mount();
  site.advance(299999);
  assert.equal(site.elements.get('#countdown').textContent, '00:01');
  site.advance(300000);
  assert.equal(site.elements.get('#countdown').textContent, '시연 시간 종료');
  assert.equal(site.isStopped(), true);
});

test('explanation can be opened again after either close control', () => {
  const { elements } = mount();
  for (const close of ['#close-dialog', '#confirm-dialog']) {
    elements.get('#claim-button').listeners.click();
    elements.get(close).listeners.click();
    elements.get('[data-explain]').listeners.click();
    assert.equal(elements.get('#explanation').open, true);
    elements.get(close).listeners.click();
    assert.equal(elements.get('#explanation').open, false);
  }
});

test('demo image, prize copy, warning cards and no-script warning stay present', () => {
  assert.match(html, /src="assets\/character.png"[^>]+alt="발그레한 볼로 웃고 있는 흰색 캐릭터"/);
  assert.match(html, /1,000만 원/);
  assert.match(html, /100%<br><strong>가짜 당첨<\/strong>/);
  for (const warning of ['너무 좋은 제안', '조급함 유발', '친근함으로 위장']) assert.ok(html.includes(warning));
  assert.match(html, /<noscript>[\s\S]+모의 피싱 시연용입니다\./);
});

test('page is explicitly a demo and has no sensitive-data inputs or external assets', () => {
  assert.match(html, /모의 피싱 시연용 사이트/);
  assert.match(html, /실제 이벤트 아님 · 개인정보 수집 없음/);
  assert.doesNotMatch(html, /<(?:form|input|textarea|iframe)\b/i);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|cookie)\b/);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const asset of assets.filter(asset => asset !== './' && !asset.startsWith('#'))) {
    assert.doesNotMatch(asset, /^(?:https?:|\/\/)/);
    assert.equal(fs.existsSync(path.join(root, 'public', asset)), true, asset);
  }
});

test('local element ids and selectors are consistent, accessible dialog is labeled', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of script.matchAll(/querySelector\('#([^']+)'\)/g)) assert.ok(ids.includes(id), id);
  assert.match(html, /<dialog[^>]+aria-labelledby="dialog-title"[^>]+aria-describedby="dialog-description"/);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /name="viewport"/);
});

test('deployment serves only public files and blocks data submission', () => {
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.framework, null);
  const headers = config.headers[0].headers;
  const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
  for (const rule of ["connect-src 'none'", "form-action 'none'", "frame-ancestors 'none'"]) assert.ok(csp.includes(rule));
  assert.ok(headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow'));
});


test('all ten component types have separate open shadow roots and shared scoped styles', () => {
  const { components } = mount();
  assert.equal(components.size, 10);
  const roots = [...components.values()].map(component => component.shadowRoot);
  assert.equal(new Set(roots).size, 10);
  for (const root of roots) {
    assert.equal(root.children[0].rel, 'stylesheet');
    assert.equal(root.children[0].href, 'styles.css');
  }
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML/);
});

test('closing restores the actual trigger and removes the modal scroll-lock attribute', () => {
  const site = mount();
  const host = site.components.get('explanation-dialog');
  for (const trigger of ['#claim-button', '[data-explain]']) {
    site.elements.get(trigger).listeners.click();
    assert.equal(host.attributes.has('open'), true);
    site.elements.get('#confirm-dialog').listeners.click();
    assert.equal(host.attributes.has('open'), false);
    assert.equal(site.focused(), site.elements.get(trigger));
  }
});

test('disconnect clears the timer and reconnect keeps the original deadline', () => {
  const site = mount();
  const timer = site.components.get('countdown-timer');
  timer.disconnectedCallback();
  assert.equal(site.activeTimers(), 0);
  site.advance(241000);
  timer.connectedCallback();
  assert.equal(site.activeTimers(), 1);
  assert.equal(site.elements.get('#countdown').textContent, '00:59');
  site.advance(300000);
  timer.disconnectedCallback();
  timer.connectedCallback();
  assert.equal(site.activeTimers(), 0);
  assert.equal(site.elements.get('#countdown').textContent, '시연 시간 종료');
});

test('red flag cards render attributes as text rather than HTML', () => {
  const card = mount().components.get('red-flag-card');
  card.setAttribute('label', '01 / 테스트');
  card.setAttribute('heading', '<script>not markup</script>');
  card.setAttribute('description', '첫째 줄\n둘째 줄');
  card.connectedCallback();
  assert.equal(card.shadowRoot.querySelector('h3').textContent, '<script>not markup</script>');
  assert.equal(card.shadowRoot.querySelector('p').textContent, '첫째 줄\n둘째 줄');
});
