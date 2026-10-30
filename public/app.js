class ShadowComponent extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'styles.css';
    root.append(stylesheet, document.getElementById(`${this.localName}-template`).content.cloneNode(true));
  }
}

class SiteHeader extends ShadowComponent {
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('[data-explain]');
    button.addEventListener('click', () => {
      button.dispatchEvent(new CustomEvent('explain-request', { bubbles: true, composed: true }));
    });
  }
}

class PrizeHero extends ShadowComponent {
  constructor() {
    super();
    const button = this.shadowRoot.querySelector('#claim-button');
    button.addEventListener('click', () => {
      button.dispatchEvent(new CustomEvent('explain-request', { bubbles: true, composed: true }));
    });
  }
}

class CountdownTimer extends ShadowComponent {
  connectedCallback() {
    this.deadline ??= Date.now() + 5 * 60 * 1000;
    this.updateCountdown();
    if (Date.now() < this.deadline) {
      this.timer = setInterval(() => this.updateCountdown(), 1000);
    }
  }

  disconnectedCallback() {
    clearInterval(this.timer);
  }

  updateCountdown() {
    // Use elapsed time so background throttling and reconnection cannot extend the deadline.
    const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    const countdown = this.shadowRoot.querySelector('#countdown');
    if (remaining === 0) {
      clearInterval(this.timer);
      countdown.textContent = '시연 시간 종료';
      return;
    }
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    countdown.textContent = `${minutes}:${seconds}`;
  }
}

class RedFlagCard extends ShadowComponent {
  connectedCallback() {
    this.shadowRoot.querySelector('.flag-number').textContent = this.getAttribute('label');
    this.shadowRoot.querySelector('h3').textContent = this.getAttribute('heading');
    this.shadowRoot.querySelector('p').textContent = this.getAttribute('description');
  }
}

class ExplanationDialog extends ShadowComponent {
  constructor() {
    super();
    this.dialog = this.shadowRoot.querySelector('#explanation');
    this.shadowRoot.querySelector('#close-dialog').addEventListener('click', () => this.dialog.close());
    this.shadowRoot.querySelector('#confirm-dialog').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      this.removeAttribute('open');
      // Restore the actual button inside its shadow root, not just its retargeted host.
      this.trigger.focus();
    });
  }

  show(trigger) {
    this.trigger = trigger;
    this.setAttribute('open', '');
    this.dialog.showModal();
  }

  disconnectedCallback() {
    if (this.dialog.open) this.dialog.close();
  }
}

for (const name of ['demo-banner', 'prize-ticket', 'safety-ticker', 'red-flags', 'site-footer']) {
  customElements.define(name, class extends ShadowComponent {});
}
customElements.define('site-header', SiteHeader);
customElements.define('countdown-timer', CountdownTimer);
customElements.define('prize-hero', PrizeHero);
customElements.define('red-flag-card', RedFlagCard);
customElements.define('explanation-dialog', ExplanationDialog);

document.addEventListener('explain-request', event => {
  document.querySelector('explanation-dialog').show(event.composedPath()[0]);
});
