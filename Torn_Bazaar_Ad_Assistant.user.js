// ==UserScript==
// @name         Torn Bazaar Ad Assistant
// @namespace    https://www.torn.com/
// @version      1.0.0
// @description  Player-controlled bazaar ad helper: saves text, fills chat input, and provides a manual reminder. Never sends messages automatically.
// @author       Community helper
// @match        https://www.torn.com/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = 'tornBazaarAdAssistant_v1';
  const DEFAULT_INTERVAL = 60;
  let timerId = null;
  let secondsLeft = DEFAULT_INTERVAL;

  const defaults = {
    ad: 'Check out my bazaar! [add your bazaar link here]',
    status: 'closed',
    interval: DEFAULT_INTERVAL,
    enabled: true
  };

  let settings;
  try {
    settings = { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    settings = { ...defaults };
  }

  const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(settings));
  const el = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'style') node.style.cssText = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    if (text) node.textContent = text;
    return node;
  };

  const panel = el('section', { id: 'torn-bazaar-ad-assistant' });
  panel.style.cssText = [
    'position:fixed', 'right:18px', 'bottom:18px', 'z-index:99999',
    'width:300px', 'background:#17191d', 'color:#f4f4f4',
    'border:1px solid #60656d', 'border-radius:8px', 'padding:12px',
    'font:13px/1.4 Arial,sans-serif', 'box-shadow:0 4px 18px #0008'
  ].join(';');

  const style = el('style');
  style.textContent = `
    #torn-bazaar-ad-assistant * { box-sizing:border-box; }
    #torn-bazaar-ad-assistant button, #torn-bazaar-ad-assistant select {
      cursor:pointer; border:1px solid #656b75; border-radius:4px;
      padding:6px 8px; background:#292d34; color:#fff; margin:3px 2px 3px 0;
    }
    #torn-bazaar-ad-assistant button:hover { background:#3a414b; }
    #torn-bazaar-ad-assistant textarea {
      width:100%; min-height:78px; resize:vertical; color:#fff;
      background:#22262c; border:1px solid #656b75; border-radius:4px;
      padding:7px; margin:5px 0;
    }
    #torn-bazaar-ad-assistant .baa-row { margin:6px 0; }
    #torn-bazaar-ad-assistant .baa-muted { color:#bbc1ca; font-size:11px; }
    #torn-bazaar-ad-assistant .baa-status { font-weight:bold; }
  `;
  document.documentElement.appendChild(style);

  const heading = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:14px;margin-bottom:7px' });
  heading.append(el('span', {}, 'Bazaar Ad Assistant'));
  const minimize = el('button', { type: 'button', title: 'Minimize panel' }, '—');
  minimize.style.cssText = 'margin:0;padding:1px 7px';
  heading.append(minimize);
  panel.append(heading);

  const body = el('div');
  panel.append(body);
  const statusLine = el('div', { class: 'baa-row' });
  const statusText = el('span', { class: 'baa-status' });
  const toggleStatus = el('button', { type: 'button' });
  statusLine.append(statusText, document.createTextNode(' '), toggleStatus);
  body.append(statusLine);

  body.append(el('label', {}, 'Advertisement text'));
  const textarea = el('textarea', { 'aria-label': 'Advertisement text', maxlength: '500' });
  textarea.value = settings.ad;
  body.append(textarea);
  const charCount = el('div', { class: 'baa-muted' });
  body.append(charCount);

  const fillButton = el('button', { type: 'button' }, 'Fill Trade Chat');
  const copyButton = el('button', { type: 'button' }, 'Copy ad');
  const resetButton = el('button', { type: 'button' }, 'I posted it — reset timer');
  const controls = el('div', { class: 'baa-row' });
  controls.append(fillButton, copyButton);
  body.append(controls);

  const intervalRow = el('div', { class: 'baa-row' });
  intervalRow.append(el('label', {}, 'Reminder interval: '));
  const intervalSelect = el('select', { 'aria-label': 'Reminder interval' });
  [[60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes'], [180, '3 minutes'], [300, '5 minutes']].forEach(([value, label]) => {
    const option = el('option', { value: String(value) }, label);
    if (Number(settings.interval) === value) option.selected = true;
    intervalSelect.append(option);
  });
  intervalRow.append(intervalSelect);
  body.append(intervalRow);
  body.append(resetButton);

  const timerText = el('div', { class: 'baa-row', style: 'font-size:15px;font-weight:bold' }, '');
  const message = el('div', { class: 'baa-muted', role: 'status', 'aria-live': 'polite' }, 'Ready. The script will never send a message for you.');
  body.append(timerText, message);
  body.append(el('div', { class: 'baa-muted' }, 'Manual helper only. Check current Torn chat rules before posting.'));

  document.body.append(panel);

  function render() {
    statusText.textContent = `Bazaar status: ${settings.status.toUpperCase()}`;
    statusText.style.color = settings.status === 'open' ? '#7ee787' : '#ff8b8b';
    toggleStatus.textContent = settings.status === 'open' ? 'Mark closed' : 'Mark open';
    charCount.textContent = `${textarea.value.length} characters`;
    timerText.textContent = settings.enabled ? `Reminder in ${formatTime(secondsLeft)}` : 'Reminder paused';
  }

  function formatTime(total) {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function announce(text) {
    message.textContent = text;
  }

  function startTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      if (!settings.enabled || settings.status !== 'open') { render(); return; }
      secondsLeft = Math.max(0, secondsLeft - 1);
      if (secondsLeft === 0) {
        announce('Reminder: if your bazaar is still open, you can choose to post your ad. Nothing has been sent.');
        secondsLeft = Number(settings.interval) || DEFAULT_INTERVAL;
      }
      render();
    }, 1000);
  }

  function findChatInput() {
    const selectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="chat" i]',
      'input[placeholder*="message" i]',
      '[contenteditable="true"][data-placeholder]',
      '[contenteditable="true"][role="textbox"]',
      'textarea'
    ];
    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll(selector)];
      const found = candidates.find(node =>
        node !== textarea &&
        !panel.contains(node) &&
        node.getClientRects().length &&
        !node.disabled &&
        !node.readOnly
      );
      if (found) return found;
    }
    return null;
  }

  toggleStatus.addEventListener('click', () => {
    settings.status = settings.status === 'open' ? 'closed' : 'open';
    save();
    render();
    announce(`Bazaar status manually set to ${settings.status.toUpperCase()}.`);
  });

  textarea.addEventListener('input', () => {
    settings.ad = textarea.value;
    save();
    render();
  });

  intervalSelect.addEventListener('change', () => {
    settings.interval = Number(intervalSelect.value);
    secondsLeft = settings.interval;
    save();
    render();
  });

  fillButton.addEventListener('click', () => {
    if (settings.status !== 'open') {
      announce('Your status is CLOSED. Mark it open first if your bazaar is available.');
      return;
    }
    const target = findChatInput();
    if (!target) {
      announce('Could not identify a visible chat input. Use Copy ad, then paste it into Trade Chat manually.');
      return;
    }
    target.focus();
    if (target.isContentEditable) {
      target.textContent = textarea.value;
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: textarea.value }));
    } else {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set;
      if (setter) setter.call(target, textarea.value);
      else target.value = textarea.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    announce('Ad filled into the selected input. Review it and click Send yourself.');
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      announce('Ad copied. Paste it into Trade Chat and send it yourself.');
    } catch {
      textarea.focus();
      textarea.select();
      announce('Clipboard access was blocked. The ad is selected; press Ctrl+C to copy it.');
    }
  });

  resetButton.addEventListener('click', () => {
    secondsLeft = Number(settings.interval) || DEFAULT_INTERVAL;
    announce('Reminder reset manually. No message was sent.');
    render();
  });

  minimize.addEventListener('click', () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    minimize.textContent = hidden ? '—' : '+';
  });

  render();
  startTimer();
})();
