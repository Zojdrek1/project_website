// Main menu overlay with save slots and new-game options

import { listSlotSummaries, getSlotSummary } from './state.js';
import { el } from './ui.js';

const CURRENCIES = [
  ['USD', 'US Dollar'],
  ['GBP', 'British Pound'],
  ['EUR', 'Euro'],
  ['JPY', 'Japanese Yen'],
  ['PLN', 'Polish Złoty'],
];

let root = null;
let slotsContainer = null;
let newGamePanel = null;
let newGameForm = null;
let newGameTitle = null;
let newGameMoney = null;
let newGameCurrency = null;
let newGameError = null;
let newGameStartBtn = null;
let optionsRef = null;
let pendingSlot = null;
let quickResumeBtn = null;
let quickResumeNote = null;

const ensureRoot = () => {
  if (root) return;
  root = el('div', { id: 'mainMenu', class: 'main-menu' });
  const backdrop = el('div', { class: 'menu-backdrop' });

  const content = el('div', { class: 'menu-content' });

  const logo = el('img', { class: 'menu-logo', src: 'Assets/logo.png', alt: 'Illegal Car Sales logo' });
  const subtitle = el('p', { class: 'menu-subtitle', text: 'Underground trading, razor-thin margins, and plenty of heat.' });
  const featureList = el('ul', { class: 'menu-features' }, [
    el('li', { text: '⚙️ Tune your rides with legal or illegal parts.' }),
    el('li', { text: '💸 Flip cars across dynamic black-market prices.' }),
    el('li', { text: '🏁 Risk races for cash, glory, and growing heat.' }),
  ]);

  quickResumeBtn = el('button', { class: 'btn primary menu-quick', text: 'Continue Last Save', disabled: true });
  quickResumeNote = el('div', { class: 'menu-hero-note', text: 'No save selected yet — choose a slot to begin.' });
  const heroActions = el('div', { class: 'menu-hero-actions' }, [quickResumeBtn, quickResumeNote]);

  const hero = el('div', { class: 'menu-hero' }, [logo, subtitle, featureList, heroActions]);

  slotsContainer = el('div', { class: 'menu-slots' });
  const slotsHeader = el('div', { class: 'slots-header' }, [
    el('h2', { class: 'slots-title', text: 'Select a Profile' }),
    el('p', { class: 'slots-subtitle', text: 'Three save spots to build unique empires.' }),
  ]);
  const slotsFootnote = el('div', { class: 'slots-footnote', text: 'Tip: Each slot keeps its own currency, upgrades, and reputation.' });
  const slotsWrap = el('div', { class: 'menu-slots-wrap' }, [slotsHeader, slotsContainer, slotsFootnote]);

  const mainPanel = el('div', { class: 'menu-main' }, [hero, slotsWrap]);

  newGameTitle = el('h2', { class: 'menu-newgame-title', text: 'New Game' });
  newGameMoney = el('input', {
    type: 'number',
    min: '5000',
    step: '500',
    class: 'menu-input',
    id: 'newGameMoney',
    value: '20000',
  });
  const moneyLabel = el('label', { for: 'newGameMoney', class: 'menu-label', text: 'Starting Money' });

  newGameCurrency = el('select', { class: 'menu-input', id: 'newGameCurrency' });
  for (const [code, name] of CURRENCIES) {
    const opt = el('option', { value: code, text: `${code} — ${name}` });
    newGameCurrency.appendChild(opt);
  }
  const currencyLabel = el('label', { for: 'newGameCurrency', class: 'menu-label', text: 'Currency' });

  newGameError = el('div', { class: 'menu-error', text: '' });

  const cancelBtn = el('button', { type: 'button', class: 'btn', text: 'Cancel' });
  cancelBtn.onclick = () => closeNewGamePanel();
  newGameStartBtn = el('button', { type: 'submit', class: 'btn primary', text: 'Start Game' });

  const actions = el('div', { class: 'menu-actions' }, [cancelBtn, newGameStartBtn]);

  newGameForm = el('form', { class: 'menu-newgame-form' }, [
    newGameTitle,
    el('p', { class: 'menu-newgame-note', text: 'Choose your starting conditions. This will overwrite the selected slot.' }),
    moneyLabel,
    newGameMoney,
    currencyLabel,
    newGameCurrency,
    newGameError,
    actions,
  ]);
  newGameForm.onsubmit = (e) => {
    e.preventDefault();
    handleNewGameSubmit();
  };

  newGamePanel = el('div', { class: 'menu-newgame' }, [newGameForm]);

  content.appendChild(mainPanel);
  content.appendChild(newGamePanel);

  root.appendChild(backdrop);
  root.appendChild(content);
  document.body.appendChild(root);

  document.addEventListener('keydown', handleKeyDown, { passive: true });
};

const handleKeyDown = (evt) => {
  if (evt.key === 'Escape') {
    if (pendingSlot !== null) {
      closeNewGamePanel();
    }
  }
};

const renderSlots = () => {
  if (!slotsContainer) return;
  slotsContainer.innerHTML = '';
  const summaries = listSlotSummaries();
  summaries.forEach((summary, idx) => {
    const card = renderSlotCard(summary, idx);
    slotsContainer.appendChild(card);
  });
  updateQuickResume(summaries);
};

const formatMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${Math.round(amount)}`; }
};

const updateQuickResume = (summaries) => {
  if (!quickResumeBtn || !quickResumeNote) return;
  const playable = Array.isArray(summaries) ? summaries.filter(Boolean) : [];
  if (!playable.length || !optionsRef || typeof optionsRef.onLoadGame !== 'function') {
    quickResumeBtn.disabled = true;
    quickResumeBtn.textContent = 'Continue Last Save';
    quickResumeNote.textContent = 'No save selected yet — choose a slot to begin.';
    quickResumeBtn.onclick = () => {};
    return;
  }
  const latest = playable.slice().sort((a, b) => {
    const aa = (a.lastPlayed ?? a.createdAt ?? 0);
    const bb = (b.lastPlayed ?? b.createdAt ?? 0);
    return bb - aa;
  })[0];
  quickResumeBtn.disabled = false;
  quickResumeBtn.textContent = `Continue Slot ${latest.slot + 1}`;
  quickResumeNote.textContent = `${formatMoney(latest.money, latest.currency)} — Level ${latest.level}`;
  quickResumeBtn.onclick = () => {
    if (!optionsRef || typeof optionsRef.onLoadGame !== 'function') return;
    const result = optionsRef.onLoadGame(latest.slot);
    if (result && typeof result.then === 'function') {
      quickResumeBtn.disabled = true;
      result.finally(() => { quickResumeBtn.disabled = false; });
    } else if (result === false) {
      quickResumeBtn.disabled = false;
    }
  };
};

const renderSlotCard = (summary, index) => {
  const chip = summary
    ? el('span', { class: 'slot-chip', text: summary.currency })
    : el('span', { class: 'slot-chip empty', text: 'Empty' });
  const header = el('div', { class: 'slot-header' }, [
    el('span', { class: 'slot-name', text: `Slot ${index + 1}` }),
    chip,
    el('span', { class: 'slot-status' + (summary ? '' : ' empty'), text: summary ? 'Saved Game' : 'Available' }),
  ]);

  const body = summary
    ? el('div', { class: 'slot-body' }, [
        el('div', { text: `Level ${summary.level}` }),
        el('div', { text: formatMoney(summary.money, summary.currency) }),
        summary.lastPlayed
          ? el('div', { class: 'slot-meta', text: `Last played: ${new Date(summary.lastPlayed).toLocaleString()}` })
          : el('div', { class: 'slot-meta', text: 'Never played' }),
        typeof summary.startingMoney === 'number'
          ? el('div', { class: 'slot-meta', text: `Started with ${formatMoney(summary.startingMoney, summary.currency)}` })
          : null,
      ])
    : el('div', { class: 'slot-body empty', text: 'No save data yet.' });

  const loadBtn = el('button', {
    class: 'btn primary',
    text: summary ? 'Resume' : 'Resume',
    disabled: summary ? false : true,
  });
  loadBtn.onclick = () => {
    if (!summary || !optionsRef || typeof optionsRef.onLoadGame !== 'function') return;
    if (loadBtn.disabled) return;
    try {
      const result = optionsRef.onLoadGame(index);
      if (result && typeof result.then === 'function') {
        loadBtn.disabled = true;
        result.finally(() => { loadBtn.disabled = false; });
      }
    } catch {
      loadBtn.disabled = false;
    }
  };

  const newBtn = el('button', { class: 'btn', text: summary ? 'Overwrite' : 'Create Profile' });
  newBtn.onclick = () => openNewGamePanel(index, summary);

  const btnRow = summary
    ? el('div', { class: 'slot-actions' }, [loadBtn, newBtn])
    : el('div', { class: 'slot-actions' }, [el('button', { class: 'btn primary', text: 'Create Profile', onclick: () => openNewGamePanel(index, summary) })]);

  const card = el('div', { class: 'menu-slot-card' }, [header, body, btnRow]);
  return card;
};

const openNewGamePanel = (slotIndex, summary) => {
  ensureRoot();
  pendingSlot = slotIndex;
  newGameError.textContent = '';
  newGameTitle.textContent = `New Game — Slot ${slotIndex + 1}`;
  if (summary && summary.currency) {
    newGameCurrency.value = summary.currency;
  } else {
    newGameCurrency.value = 'USD';
  }
  if (summary && summary.startingMoney) newGameMoney.value = summary.startingMoney;
  else newGameMoney.value = '20000';
  root.classList.add('newgame-open');
  newGamePanel.classList.add('open');
  newGameMoney.focus();
};

const closeNewGamePanel = () => {
  pendingSlot = null;
  if (newGamePanel) newGamePanel.classList.remove('open');
  if (root) root.classList.remove('newgame-open');
  if (newGameError) newGameError.textContent = '';
  if (newGameStartBtn) newGameStartBtn.disabled = false;
};

const handleNewGameSubmit = () => {
  if (pendingSlot === null) return;
  const moneyVal = sanitizeMoneyInput(newGameMoney && newGameMoney.value);
  if (moneyVal < 1000) {
    newGameError.textContent = 'Starting money must be at least 1,000.';
    return;
  }
  const currency = (newGameCurrency && newGameCurrency.value) || 'USD';
  const payload = { money: moneyVal, currency };
  const handler = optionsRef && typeof optionsRef.onNewGame === 'function' ? optionsRef.onNewGame : null;
  const finish = () => {
    closeNewGamePanel();
    renderSlots();
    hideMainMenu();
  };
  if (!handler) {
    finish();
    return;
  }
  try {
    const result = handler(pendingSlot, payload);
    if (result && typeof result.then === 'function') {
      if (newGameStartBtn) newGameStartBtn.disabled = true;
      result.then((outcome) => {
        if (outcome === false) {
          if (newGameStartBtn) newGameStartBtn.disabled = false;
          newGameError.textContent = 'Unable to start new game. Please try again.';
          return;
        }
        finish();
      }).catch(() => {
        if (newGameStartBtn) newGameStartBtn.disabled = false;
        newGameError.textContent = 'Unable to start new game. Please try again.';
      });
      return;
    }
    if (result === false) {
      newGameError.textContent = 'Unable to start new game. Please try again.';
      return;
    }
    finish();
  } catch {
    if (newGameStartBtn) newGameStartBtn.disabled = false;
    newGameError.textContent = 'Unable to start new game. Please try again.';
  }
};

const sanitizeMoneyInput = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 20000;
  return Math.max(0, Math.round(num));
};

export function showMainMenu(options = {}) {
  optionsRef = options;
  ensureRoot();
  renderSlots();
  document.body.classList.add('menu-active');
  root.classList.add('open');
}

export function hideMainMenu() {
  if (!root) return;
  root.classList.remove('open');
  document.body.classList.remove('menu-active');
  closeNewGamePanel();
}

export function refreshMainMenuSlots() {
  if (!root) return;
  renderSlots();
}

export function teardownMainMenu() {
  if (!root) return;
  document.removeEventListener('keydown', handleKeyDown);
  root.remove();
  root = null;
  slotsContainer = null;
  newGamePanel = null;
  newGameForm = null;
  newGameTitle = null;
  newGameMoney = null;
  newGameCurrency = null;
  newGameError = null;
  pendingSlot = null;
  optionsRef = null;
}

export function peekSlot(slotIndex) {
  return getSlotSummary(slotIndex);
}

export function openNewGameForSlot(slotIndex) {
  if (!root) ensureRoot();
  if (!optionsRef) return;
  if (!root.classList.contains('open')) {
    document.body.classList.add('menu-active');
    root.classList.add('open');
  }
  renderSlots();
  const summary = getSlotSummary(slotIndex);
  openNewGamePanel(slotIndex, summary);
}
