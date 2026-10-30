/** Zero-dependency, local-only educational banner demo. All interactive components use Shadow DOM. */
import { ADS } from './ads.js';

const media = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionChoice = null; // No persistence or user tracking; null means follow OS preference.
const motionEnabled = () => !media.matches && motionChoice !== false;
const announceMotion = () => document.dispatchEvent(new Event('retro-motion-change'));
media.addEventListener('change', announceMotion);
document.addEventListener('retro-motion-toggle', () => {
  if (media.matches) return;
  motionChoice = !motionEnabled();
  announceMotion();
});

function requestExplanation(button) {
  button.dispatchEvent(new CustomEvent('explain-request', { bubbles: true, composed: true }));
}

class ShadowComponent extends HTMLElement {
  constructor() {
    super();
    const template = document.getElementById(`${this.localName}-template`);
    if (!template) throw new Error(`Missing template for ${this.localName}`);
    const root = this.attachShadow({ mode: 'open' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'styles.css';
    root.append(stylesheet, template.content.cloneNode(true));
  }
}

class SiteHeader extends ShadowComponent {
  constructor() {
    super();
    this.shadowRoot.querySelector('[data-explain]').addEventListener('click', event => {
      requestExplanation(event.currentTarget);
    });
  }
}

// Existing simulation component retained: elapsed time is based on deadline, not interval count.
class CountdownTimer extends ShadowComponent {
  connectedCallback() {
    this.deadline ??= Date.now() + 5 * 60 * 1000;
    this.updateCountdown();
    if (Date.now() < this.deadline && !this.timer) {
      this.timer = setInterval(() => this.updateCountdown(), 1000);
    }
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    this.timer = null;
  }
  updateCountdown() {
    const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    const countdown = this.shadowRoot.querySelector('#countdown');
    if (remaining === 0) {
      clearInterval(this.timer);
      this.timer = null;
      countdown.textContent = '시연 시간 종료';
      return;
    }
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    countdown.textContent = `${minutes}:${seconds}`;
  }
}

class PrizeHero extends ShadowComponent {
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('#claim-button');
    button.addEventListener('click', () => requestExplanation(button));
  }
}

class PrizeTicket extends ShadowComponent {
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('[data-explain]');
    button.addEventListener('click', () => requestExplanation(button));
  }
}

class RedFlagCard extends ShadowComponent {
  connectedCallback() {
    this.shadowRoot.querySelector('.flag-number').textContent = this.getAttribute('label') ?? '';
    this.shadowRoot.querySelector('h3').textContent = this.getAttribute('heading') ?? '';
    this.shadowRoot.querySelector('p').textContent = this.getAttribute('description') ?? '';
  }
}

// Existing modal and focus-return behavior reused for every banner and CTA.
class ExplanationDialog extends ShadowComponent {
  constructor() {
    super();
    this.dialog = this.shadowRoot.querySelector('#explanation');
    this.shadowRoot.querySelector('#close-dialog').addEventListener('click', () => this.dialog.close());
    this.shadowRoot.querySelector('#confirm-dialog').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      this.removeAttribute('open');
      this.trigger?.focus();
    });
  }
  show(trigger) {
    if (this.dialog.open) return;
    this.trigger = trigger;
    this.setAttribute('open', '');
    this.dialog.showModal();
  }
  disconnectedCallback() {
    if (this.dialog.open) this.dialog.close();
  }
}

/** Subscribe only while connected; reconnecting a custom element does not leak listeners. */
class MotionComponent extends ShadowComponent {
  connectedCallback() {
    this.refreshMotion();
    document.addEventListener('retro-motion-change', this.handleMotion);
  }
  disconnectedCallback() {
    document.removeEventListener('retro-motion-change', this.handleMotion);
  }
  handleMotion = () => this.refreshMotion();
  refreshMotion() { this.setAttribute('motion', motionEnabled() ? 'on' : 'off'); }
}

class RetroMotionToggle extends MotionComponent {
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('button');
    button.addEventListener('click', () => {
      button.dispatchEvent(new CustomEvent('retro-motion-toggle', { bubbles: true, composed: true }));
    });
  }
  refreshMotion() {
    super.refreshMotion();
    const button = this.shadowRoot.querySelector('button');
    button.disabled = media.matches;
    button.setAttribute('aria-pressed', String(!motionEnabled()));
    button.textContent = media.matches ? '◼ 시스템 설정: 정지 화면' : motionEnabled() ? '◼ 움직임 끄기' : '▶ 움직임 켜기';
  }
}

class RetroAdBanner extends MotionComponent {
  static get observedAttributes() { return ['kind']; }
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('button');
    button.addEventListener('click', () => requestExplanation(button));
  }
  attributeChangedCallback() { this.refreshAsset(); }
  refreshMotion() { super.refreshMotion(); this.refreshAsset(); }
  refreshAsset() {
    if (!this.shadowRoot) return;
    const kind = this.getAttribute('kind') === 'card' ? 'hackathon-card' : 'hackathon-hero';
    const animated = motionEnabled();
    const asset = `assets/${kind}${animated ? '' : '-still'}.${animated ? 'gif' : 'png'}`;
    const image = this.shadowRoot.querySelector('img');
    if (image.getAttribute('src') !== asset) image.setAttribute('src', asset);
    image.setAttribute('data-animated', String(animated));
    this.shadowRoot.querySelector('.gif-stamp').textContent = animated ? 'GIF · 광고 시연' : '정지 이미지 · 광고 시연';
  }
}

class RetroAdTile extends MotionComponent {
  static get observedAttributes() { return ['asset', 'eyebrow', 'headline', 'detail']; }
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('button');
    button.addEventListener('click', () => requestExplanation(button));
  }
  connectedCallback() { super.connectedCallback(); this.refreshAsset(); }
  attributeChangedCallback() { this.refreshAsset(); }
  refreshAsset() {
    if (!this.shadowRoot) return;
    const id = this.getAttribute('asset');
    if (!/^ad-(?:0[1-9]|[1-3][0-9])$/.test(id ?? '')) return;
    const image = this.shadowRoot.querySelector('img');
    image.setAttribute('src', `assets/tiles/${id}.png`);
    const label = ['eyebrow', 'headline', 'detail'].map(key => this.getAttribute(key)).filter(Boolean).join(' · ');
    image.alt = label;
    this.shadowRoot.querySelector('button').setAttribute('aria-label', `${label}. 모의 피싱 광고 시연 설명 열기`);
  }
}

class RetroAdBoard extends ShadowComponent {
  connectedCallback() {
    if (this.loaded) return;
    this.loaded = true;
    const grid = this.shadowRoot.querySelector('#tiles');
    ADS.forEach((ad, index) => {
      if (index === 7) {
        const banner = document.createElement('retro-ad-banner');
        banner.setAttribute('kind', 'card');
        grid.append(banner);
      }
      if (index === 11) grid.append(document.createElement('prize-ticket'));
      const tile = document.createElement('retro-ad-tile');
      for (const [key, value] of Object.entries(ad)) tile.setAttribute(key, value);
      grid.append(tile);
    });
  }
}

for (const name of ['demo-banner', 'safety-ticker', 'red-flags', 'site-footer']) {
  customElements.define(name, class extends ShadowComponent {});
}
customElements.define('site-header', SiteHeader);
customElements.define('countdown-timer', CountdownTimer);
customElements.define('prize-hero', PrizeHero);
customElements.define('prize-ticket', PrizeTicket);
customElements.define('red-flag-card', RedFlagCard);
customElements.define('explanation-dialog', ExplanationDialog);
customElements.define('retro-ad-banner', RetroAdBanner);
customElements.define('retro-ad-tile', RetroAdTile);
customElements.define('retro-ad-board', RetroAdBoard);
customElements.define('retro-motion-toggle', RetroMotionToggle);

document.addEventListener('explain-request', event => {
  document.querySelector('explanation-dialog').show(event.composedPath()[0]);
});
