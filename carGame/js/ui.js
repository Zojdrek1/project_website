// Minimal UI helpers shared across views

export function getIconSVG(name) {
  const wrap = (txt) => `<span class="icon" style="margin-right: 6px;">${txt}</span>`;
  switch (name) {
    case 'casino':
    case 'slots':
    case 'slot':
      return wrap('🎰');
    case 'home': return wrap('🏠');
    case 'cart': return wrap('🛒');
    case 'flag': return wrap('🏁');
    case 'car': return wrap('🚗');
    case 'wrench': return wrap('🛠️');
    case 'market': return wrap('🛒');
    case 'garage': return wrap('🏠');
    case 'parts': return wrap('🧩');
    case 'race': return wrap('🏁');
    case 'trophy': return wrap('🏆');
    case 'chart': return wrap('📈');
    case 'dashboard': return wrap('📊');
    case 'help': return wrap('❓');
    case 'calendar': return wrap('📅');
    case 'refresh': return wrap('🔄');
    case 'cog': return wrap('⚙️');
    default: return wrap('•');
  }
}

export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') {
      e.className = v;
    } else if (k === 'text') {
      e.textContent = v;
    } else if (k.startsWith('on')) {
      e[k] = v;
    } else if (typeof v === 'boolean') {
      if (v) e.setAttribute(k, '');
    } else {
      e.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

export function ensureToasts() {
  if (!document.getElementById('toasts')) {
    const t = document.createElement('div');
    t.id = 'toasts';
    t.className = 'toasts';
    document.body.appendChild(t);
  }
}

export function showToast(message, type = 'info', actions = null, timeoutMs = 4200) {
  ensureToasts();
  const cont = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  // X button for instant close
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-x';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 240);
  };
  toast.appendChild(closeBtn);
  const text = document.createElement('div');
  text.textContent = message;
  toast.appendChild(text);
  if (actions && actions.length) {
    const act = document.createElement('div');
    act.className = 'actions';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = a.label;
      b.onclick = () => {
        try { a.action && a.action(); } finally {
          toast.classList.add('hide');
          setTimeout(() => toast.remove(), 240);
        }
      };
      act.appendChild(b);
    });
    toast.appendChild(act);
  }
  cont.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  if (!actions || !actions.length) {
    setTimeout(() => {
      if (!toast.classList.contains('hide')) {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 240);
      }
    }, timeoutMs);
  }
}

// Render top navigation and options popover
export function renderNavUI({ state, currentView, navItems, onSetView, onToggleOptions, onHideOptions, onToggleDev, onNewGame, onStartTutorial = null, tutorialActive = false, currencyCode = 'USD', currencies = [['USD','US Dollar'], ['GBP','British Pound'], ['EUR','Euro'], ['JPY','Japanese Yen'], ['PLN','Polish Złoty']], onSetCurrency = null, onGoHome = null, onSetSound, onSetVolume, onTestSound, onExportSave = null, onImportSave = null, profileAlias = 'Crew Chief', shareLeaderboard = false, onSetAlias = null, onToggleShare = null, onGenerateAlias = null }) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = '';

  // Left-side home button
  const left = document.createElement('div');
  left.className = 'left';
  const homeBtn = document.createElement('button');
  homeBtn.className = 'home-btn';
  homeBtn.setAttribute('aria-label', 'Home');
  homeBtn.innerHTML = getIconSVG('home') + '<span class="label">Home</span>';
  homeBtn.onclick = () => { if (onGoHome) onGoHome(); else window.location.href = '../index.html'; };
  left.appendChild(homeBtn);
  nav.appendChild(left);

  // Center nav will be rendered in #navHub by renderCenterNavUI

  // Options on the right
  const right = document.createElement('div');
  right.className = 'options';

  if (typeof onStartTutorial === 'function') {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'ghost' + (tutorialActive ? ' active' : '');
    helpBtn.setAttribute('aria-label', 'Guide');
    const label = tutorialActive ? 'Guide Active' : 'Guide';
    helpBtn.innerHTML = getIconSVG('help') + `<span class="label">${label}</span>`;
    helpBtn.disabled = !!tutorialActive;
    if (!tutorialActive) helpBtn.onclick = () => onStartTutorial();
    right.appendChild(helpBtn);
  }

  const leaderboardBtn = document.createElement('button');
  leaderboardBtn.setAttribute('aria-label', 'Leaderboards');
  leaderboardBtn.innerHTML = getIconSVG('chart') + '<span class="label">Boards</span>';
  if (currentView === 'leaderboard') leaderboardBtn.classList.add('active');
  leaderboardBtn.onclick = () => onSetView && onSetView('leaderboard');
  right.appendChild(leaderboardBtn);

  const cogBtn = document.createElement('button');
  cogBtn.setAttribute('aria-label', 'Options');
  cogBtn.innerHTML = getIconSVG('cog') + '<span class="label">Options</span>';
  cogBtn.onclick = onToggleOptions;
  right.appendChild(cogBtn);

  const pop = document.createElement('div');
  pop.id = 'optionsPop';
  pop.className = 'options-pop' + (state.ui && state.ui.showOptions ? ' open' : '');
  const scroller = document.createElement('div');
  scroller.className = 'options-scroller';
  pop.appendChild(scroller);
  // Currency selector
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Options';
  scroller.appendChild(title);
  const row = document.createElement('div');
  row.className = 'row';
  const sel = document.createElement('select');
  currencies.forEach(([code, name]) => {
    const o = document.createElement('option');
    o.value = code; o.textContent = `${code} — ${name}`; if (currencyCode === code) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => { onSetCurrency && onSetCurrency(sel.value); };
  row.appendChild(sel);
  scroller.appendChild(row);
  // Global sound controls
  const snd = document.createElement('div'); snd.className = 'row';
  const label = document.createElement('label'); label.textContent = 'Sound'; label.style.marginRight = '8px'; snd.appendChild(label);
  const toggle = document.createElement('button'); toggle.className = 'btn';
  let enabled = !!(state.ui && state.ui.casino && state.ui.casino.sound !== false);
  toggle.textContent = enabled ? '🔊' : '🔇';
  toggle.onclick = () => { enabled = !enabled; toggle.textContent = enabled ? '🔊' : '🔇'; onSetSound && onSetSound(enabled); };
  snd.appendChild(toggle);
  const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '100';
  const v = (state.ui && state.ui.casino && typeof state.ui.casino.volume === 'number') ? state.ui.casino.volume : 0.06;
  range.value = String(Math.round(Math.max(0, Math.min(1, v))*100)); range.style.marginLeft='8px'; range.oninput = () => { const val = Math.round(parseInt(range.value||'0',10))/100; onSetVolume && onSetVolume(val); };
  snd.appendChild(range);
  const test = document.createElement('button'); test.className='btn'; test.textContent='Test'; test.style.marginLeft = '6px'; test.onclick = () => { onTestSound && onTestSound(); };
  snd.appendChild(test);
  scroller.appendChild(snd);
  const aliasField = document.createElement('div'); aliasField.className = 'options-field';
  const aliasLabel = document.createElement('label'); aliasLabel.textContent = 'Alias'; aliasField.appendChild(aliasLabel);
  const aliasInput = document.createElement('input'); aliasInput.type = 'text'; aliasInput.maxLength = 24; aliasInput.value = profileAlias || ''; aliasInput.placeholder = 'Crew Alias';
  aliasInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); aliasInput.blur(); } };
  aliasInput.onblur = () => { if (onSetAlias) onSetAlias(aliasInput.value); };
  aliasField.appendChild(aliasInput);
  if (typeof onGenerateAlias === 'function') {
    const genBtn = el('button', { class: 'btn sm', title: 'Generate a unique alias' });
    genBtn.innerHTML = getIconSVG('refresh');
    genBtn.onclick = () => onGenerateAlias();
    aliasField.appendChild(genBtn);
  }
  scroller.appendChild(aliasField);

  const shareField = document.createElement('div'); shareField.className = 'options-field';
  const shareLabel = document.createElement('label'); shareLabel.textContent = 'Share Scores'; shareField.appendChild(shareLabel);
  const shareToggle = document.createElement('input'); shareToggle.type = 'checkbox'; shareToggle.checked = !!shareLeaderboard;
  shareToggle.onchange = () => { onToggleShare && onToggleShare(!!shareToggle.checked); };
  shareField.appendChild(shareToggle);
  const shareHint = document.createElement('span'); shareHint.className = 'helper'; shareHint.textContent = 'Store anonymised leaderboard entries locally.';
  shareField.appendChild(shareHint);
  scroller.appendChild(shareField);
  // Divider
  const div1 = document.createElement('div');
  div1.className = 'divider';
  scroller.appendChild(div1);
  // Save management
  const saveRow = document.createElement('div');
  saveRow.className = 'row';
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn';
  exportBtn.textContent = 'Export Save';
  exportBtn.onclick = () => { onExportSave && onExportSave(); onHideOptions(); };
  const importBtn = document.createElement('button');
  importBtn.className = 'btn';
  importBtn.textContent = 'Import Save';
  importBtn.onclick = () => { onImportSave && onImportSave(); onHideOptions(); };
  saveRow.appendChild(exportBtn);
  saveRow.appendChild(importBtn);
  scroller.appendChild(saveRow);
  const saveNote = document.createElement('div');
  saveNote.className = 'options-note';
  saveNote.textContent = 'Export your save for backups or to sync between devices.';
  scroller.appendChild(saveNote);
  const div1b = document.createElement('div');
  div1b.className = 'divider';
  scroller.appendChild(div1b);
  // Back to main menu
  const newBtn = document.createElement('button');
  newBtn.className = 'btn warn';
  newBtn.textContent = 'Back to Main Menu';
  newBtn.onclick = () => { onNewGame(); onHideOptions(); };
  scroller.appendChild(newBtn);
  // Divider
  const div2 = document.createElement('div');
  div2.className = 'divider';
  scroller.appendChild(div2);
  // Dev Tools toggle
  const devBtn2 = document.createElement('button');
  devBtn2.className = 'btn';
  devBtn2.textContent = (state.ui && state.ui.showDev) ? 'Hide Dev Tools' : 'Show Dev Tools';
  devBtn2.onclick = () => { onToggleDev(); onHideOptions(); };
  scroller.appendChild(devBtn2);

  // --- Dev Tools Panel ---
  if (state.ui && state.ui.showDev) {
    const devPanel = document.createElement('div');
    devPanel.className = 'dev-panel';
    devPanel.style.margin = '16px 0 0 0';
    // Force part failure in next race
    const failBtn = document.createElement('button');
    failBtn.className = 'btn bad';
    failBtn.textContent = 'Force Part Failure (Next Race)';
    failBtn.onclick = () => {
      window.__icsForcePartFailure = true;
      showToast('Next race will force a part failure!', 'warn');
    };
    devPanel.appendChild(failBtn);
    // Instant fix all cars
    const fixBtn = document.createElement('button');
    fixBtn.className = 'btn good';
    fixBtn.textContent = 'Fix All Cars Instantly';
    fixBtn.onclick = () => {
      if (!window.state || !Array.isArray(window.state.garage)) return;
      for (const car of window.state.garage) {
        for (const k of Object.keys(car.parts||{})) car.parts[k] = 100;
        car.failed = false;
      }
      showToast('All cars fully repaired!', 'good');
      if (typeof window.render === 'function') window.render();
    };
    devPanel.appendChild(fixBtn);
    scroller.appendChild(devPanel);
  }

  right.appendChild(pop);
  nav.appendChild(right);

  // Outside click to close
  const handler = (e) => {
    if (!pop.classList.contains('open')) return;
    const t = e.target;
    if (pop.contains(t) || cogBtn.contains(t)) return;
    onHideOptions && onHideOptions();
  };
  // Remove previous handler if present
  if (window.__icsNavOutside) document.removeEventListener('click', window.__icsNavOutside, true);
  window.__icsNavOutside = handler;
  document.addEventListener('click', handler, true);
}

// Center navigation rendered below the topbar
export function renderCenterNavUI({ state, currentView, navItems, onSetView }) {
  const hub = document.getElementById('navTopbar') || document.getElementById('navHub');
  if (!hub) return;
  hub.innerHTML = '';
  // Outer wrapper retains legacy styles
  const wrap = document.createElement('div');
  wrap.className = 'nav-hub';
  const center = document.createElement('div');
  center.className = 'nav-center';
  center.style.position = 'relative';
  const btns = [];
  for (const item of navItems) {
    const btn = document.createElement('button');
    btn.className = item.key === currentView ? 'active' : '';
    btn.setAttribute('aria-label', item.label);
    btn.onclick = () => onSetView(item.key);
    btn.innerHTML = getIconSVG(item.icon) + `<span class="label">${item.label}</span>`;
    center.appendChild(btn);
    btns.push(btn);
  }
  const indicator = document.createElement('div');
  indicator.className = 'nav-indicator';
  indicator.classList.add('no-anim');
  center.appendChild(indicator);
  const idx = navItems.findIndex(it => it.key === currentView);
  const activeBtn = btns[idx] || btns[0];
  const commit = () => {
    const cRect = center.getBoundingClientRect();
    const bRect = activeBtn.getBoundingClientRect();
    const left = bRect.left - cRect.left;
    const width = bRect.width;
    indicator.style.transform = `translate3d(${Math.max(0, left)}px,0,0)`;
    indicator.style.width = `${width}px`;
  };
  requestAnimationFrame(() => {
    try {
      const prev = state && state.ui && state.ui._navInd;
      if (prev && typeof prev.left === 'number' && typeof prev.width === 'number') {
        indicator.style.transform = `translate3d(${prev.left}px,0,0)`;
        indicator.style.width = `${prev.width}px`;
      }
    } catch {}
    requestAnimationFrame(() => {
      commit();
      indicator.classList.remove('no-anim');
      try {
        const cRect = center.getBoundingClientRect();
        const bRect = activeBtn.getBoundingClientRect();
        const left = bRect.left - cRect.left;
        const width = bRect.width;
        if (state) {
          if (!state.ui) state.ui = { openCars: {}, showDev: false };
          state.ui._navInd = { left, width };
        }
      } catch {}
    });
  });
  wrap.appendChild(center);
  hub.appendChild(wrap);
}

// Lightweight sparkline renderer for small charts
export function drawSparkline(canvas, points, color = '#57b6ff', options = {}) {
  const {
    zeroLine = false,
    currentValue,
    formatter = (v) => v.toString()
  } = options;
  if (!canvas || !points || points.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 80;
  canvas.width = Math.max(1, Math.floor(cssW * dpr));
  canvas.height = Math.max(1, Math.floor(cssH * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  const w = cssW, h = cssH;
  ctx.clearRect(0, 0, w, h);
  const min = Math.min(...points, zeroLine ? 0 : Infinity);
  const max = Math.max(...points, zeroLine ? 0 : -Infinity);
  const pad = 6;
  const n = points.length;
  const xFor = (i) => pad + (w - 2 * pad) * (i / Math.max(1, (n - 1)));
  const yFor = (v) => {
    if (max === min) return h / 2;
    const t = (v - min) / (max - min);
    return h - pad - (h - 2 * pad) * t;
  };
  // background grid line at y=0 if requested
  if (zeroLine) {
    const y0 = yFor(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
  }
  // line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xFor(0), yFor(points[0]));
  for (let i = 1; i < n; i++) ctx.lineTo(xFor(i), yFor(points[i]));
  ctx.stroke();
  // gradient fill — derive rgba from color when possible, else use a safe fallback
  const toRgba = (c, a) => {
    if (!c) return `rgba(87,182,255,${a})`;
    if (c.startsWith('#')) {
      const hex = c.slice(1);
      const full = hex.length === 3
        ? hex.split('').map(ch => ch + ch).join('')
        : hex.padStart(6, '0').slice(0, 6);
      const r = parseInt(full.slice(0, 2), 16) || 0;
      const g = parseInt(full.slice(2, 4), 16) || 0;
      const b = parseInt(full.slice(4, 6), 16) || 0;
      return `rgba(${r},${g},${b},${a})`;
    }
    if (c.startsWith('rgba(')) return c.replace(/rgba\(([^)]+)\)/, (m, inner) => {
      const parts = inner.split(',').slice(0, 3).map(s => s.trim());
      return `rgba(${parts.join(',')},${a})`;
    });
    if (c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `,${a})`);
    return `rgba(87,182,255,${a})`;
  };
  const grad = ctx.createLinearGradient(0, pad, 0, h - pad);
  grad.addColorStop(0, toRgba(color, 0.25));
  grad.addColorStop(1, toRgba(color, 0.02));
  ctx.fillStyle = grad;
  ctx.lineTo(xFor(n - 1), h - pad);
  ctx.lineTo(xFor(0), h - pad);
  ctx.closePath();
  ctx.fill();
  // Current value text
  if (typeof currentValue === 'number') {
    ctx.font = '700 14px ui-sans-serif, system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const formatted = formatter(currentValue);
    const yPos = yFor(currentValue);
    const isHigh = yPos < h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(formatted, w - pad - 1, isHigh ? yPos + 5 : yPos - 21);
    ctx.fillStyle = '#e7edf3';
    ctx.fillText(formatted, w - pad, isHigh ? yPos + 4 : yPos - 22);
  }
}

// --- Market helpers ---
export function renderMarketCondition(avg, level) {
  const L = Math.max(1, level || 1);
  const showExactAt = 7;
  if (L >= showExactAt) {
    const cls = avg >= 70 ? 'ok' : avg >= 50 ? 'info' : 'bad';
    return el('span', { class: `tag ${cls}` , text: `Avg ${avg}%` });
  }
  const baseWidth = 40;
  const step = 5;
  const width = Math.max(8, baseWidth - (L - 1) * step);
  const low = Math.max(0, Math.min(100, Math.round(avg - width / 2)));
  const high = Math.max(0, Math.min(100, Math.round(avg + width / 2)));
  const mid = Math.round((low + high) / 2);
  const cls = mid >= 70 ? 'ok' : mid >= 50 ? 'info' : 'bad';
  return el('span', { class: `tag ${cls}`, text: `Est ${low}–${high}%` });
}

export function renderMarketListingsSection({ container, state, PARTS, fmt, level, onBuyCar }) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.illegalMarket.forEach((car) => {
    const avg = Math.round(PARTS.reduce((acc, part) => acc + (car.parts[part.key] ?? 100), 0) / PARTS.length);
    const condNode = renderMarketCondition(avg, level);
    const row = el('tr', { ['data-market-row']: car.id }, [
      el('td', { text: car.model }),
      el('td', { text: String(car.perf) }),
      el('td', {}, [condNode]),
      el('td', {}, [ el('span', { ['data-car-price']: car.id, text: fmt.format(car.price) }) ]),
      el('td', {}, [ el('button', {
        class: 'btn good',
        text: 'Buy',
        onclick: () => {
          if (typeof onBuyCar === 'function') onBuyCar(car.id);
        },
      }) ]),
    ]);
    frag.appendChild(row);
  });
  container.appendChild(frag);
}

export function renderMarketTrendsSection({ container, state, fmt }) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.illegalMarket.forEach((car) => {
    const card = el('div', { class: 'panel', ['data-market-card']: car.id }, [
      el('div', { class: 'row' }, [
        el('strong', { text: car.model }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'tag info', ['data-car-tprice']: car.id, text: fmt.format(car.price) }),
      ]),
      (() => {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 80;
        c.style.width = '100%';
        c.style.height = '80px';
        c.setAttribute('data-car-spark', car.id);
        setTimeout(() => drawSparkline(c, car.priceHistory || [car.price], '#57b6ff'), 0);
        return c;
      })(),
    ]);
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

export function renderMarketOwnedTrendsSection({ container, state, fmt, isSellConfirm, onSellClickById }) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  (state.garage || []).forEach((car) => {
    const card = el('div', { class: 'panel', ['data-owned-card']: car.id }, [
      el('div', { class: 'row' }, [
        el('strong', { text: car.model }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'tag ok', ['data-own-tprice']: car.id, text: fmt.format(car.valuation ?? 0) }),
        (() => {
          const profit = (car.valuation ?? 0) - (car.boughtPrice ?? 0);
          const cls = profit >= 0 ? 'tag ok' : 'tag bad';
          return el('span', { class: cls, ['data-own-pl']: car.id, text: `${profit >= 0 ? '+' : ''}${fmt.format(profit)}` });
        })(),
        (() => {
          const sellBtn = el('button', { class: 'btn danger', text: isSellConfirm && isSellConfirm(car.id) ? 'Are you sure?' : 'Sell' });
          if (typeof onSellClickById === 'function') sellBtn.onclick = () => onSellClickById(car.id, sellBtn);
          return sellBtn;
        })(),
      ]),
      (() => {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 80;
        c.style.width = '100%';
        c.style.height = '80px';
        c.setAttribute('data-own-spark', car.id);
        const pts = (car.valuationHistory && car.valuationHistory.length) ? car.valuationHistory : [(car.valuation ?? 0)];
        setTimeout(() => drawSparkline(c, pts, '#7ee787'), 0);
        return c;
      })(),
    ]);
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

export function renderMarketAllTrendsSection({ container, state, MODELS, fmt, modelId, ensureModelTrends }) {
  if (!container) return;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  const pinnedOrder = [];
  for (const car of state.illegalMarket) if (!pinnedOrder.includes(car.model)) pinnedOrder.push(car.model);
  const allModels = MODELS.map(m => m.model).filter(m => !pinnedOrder.includes(m));
  const ordered = pinnedOrder.concat(allModels);
  ensureModelTrends();
  ordered.forEach((name) => {
    const mid = modelId(name);
    const m = MODELS.find(mm => mm.model === name);
    const points = state.modelTrends[name] || [m ? m.basePrice : 0];
    const curVal = points[points.length - 1] || (m ? m.basePrice : 0);
    const pinned = pinnedOrder.includes(name);
    const card = el('div', { class: 'panel', ['data-model-card']: mid }, [
      el('div', { class: 'row' }, [
        el('strong', { text: name }),
        el('div', { class: 'spacer' }),
        pinned ? el('span', { class: 'tag ok', text: 'In Shop' }) : el('span', { class: 'tag', text: 'Index' }),
        el('span', { class: 'tag info', ['data-model-price']: mid, text: fmt.format(curVal) }),
      ]),
      (() => {
        const c = document.createElement('canvas');
        c.width = 320; c.height = 80;
        c.style.width = '100%';
        c.style.height = '80px';
        c.setAttribute('data-model-spark', mid);
        setTimeout(() => drawSparkline(c, points, '#9aa4ff'), 0);
        return c;
      })(),
    ]);
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

// Body style helpers for silhouettes
export function getBodyStyle(model) {
  const m = model.toLowerCase();
  if (m.includes('hatch')) return 'hatch';
  if (m.includes('4x4') || m.includes('suv') || m.includes('highland')) return 'suv';
  if (m.includes('chaser') || m.includes('aristo') || m.includes('sedan') || m.includes('falcon')) return 'sedan';
  if (m.includes('nsx') || m.includes('supra') || m.includes('rx-7') || m.includes('skyline') || m.includes('s2000') || m.includes('300zx') || m.includes('silvia') || m.includes('comet') || m.includes('sting') || m.includes('cobra') || m.includes('zephyr') || m.includes('veloce') || m.includes('sakura') || m.includes('arrow')) return 'coupe';
  return 'coupe';
}
export function getSilhouettePath(style) {
  switch (style) {
    case 'hatch':
      return 'M70 165 L70 135 L140 110 L260 110 L280 135 L450 135 Q470 135 485 150 L525 150 L525 185 L110 185 Z M180 185 A24 24 0 1 0 180 137 A24 24 0 1 0 180 185 Z M420 185 A24 24 0 1 0 420 137 A24 24 0 1 0 420 185 Z';
    case 'sedan':
      return 'M60 165 L60 130 Q80 120 140 120 L190 95 L330 95 L360 120 L460 120 Q490 120 510 140 L540 140 L540 180 L110 180 Z M180 180 A24 24 0 1 0 180 132 A24 24 0 1 0 180 180 Z M430 180 A24 24 0 1 0 430 132 A24 24 0 1 0 430 180 Z';
    case 'suv':
      return 'M60 160 L60 120 L120 100 L260 100 L300 110 L440 110 L480 120 L520 130 L520 175 L110 175 Z M170 175 A26 26 0 1 0 170 125 A26 26 0 1 0 170 175 Z M420 175 A26 26 0 1 0 420 125 A26 26 0 1 0 420 175 Z';
    case 'coupe':
    default:
      return 'M60 160 L60 120 Q70 110 110 110 L140 90 L240 90 L260 120 L430 120 Q460 120 480 140 L520 140 L520 180 L110 180 Z M170 180 A24 24 0 1 0 170 132 A24 24 0 1 0 170 180 Z M430 180 A24 24 0 1 0 430 132 A24 24 0 1 0 430 180 Z';
  }
}

// Internal image error cache
const failedImgCache = new Set();

export function renderCarBreakdown({ car, idx, state, PARTS, modelId }) {
  const box = el('div', { class: 'car-breakdown' });
  let imgSrc = state.assets && state.assets.modelImages && state.assets.modelImages[car.model];
  const slug = modelId(car.model);
  const styleSlug = '_' + getBodyStyle(car.model);
  const candidates = [
    imgSrc,
    'Assets/Cars/default_Car.png',
    'assets/cars/default_Car.png',
    `Assets/Cars/${styleSlug}.svg`,
    `assets/cars/${styleSlug}.svg`,
    `Assets/Cars/${slug}.svg`,
    `assets/cars/${slug}.svg`,
  ].filter(Boolean);
  if (candidates.length) {
    const img = document.createElement('img');
    let i = 0;
    while (i < candidates.length && failedImgCache.has(candidates[i])) i += 1;
    img.src = candidates[i] || candidates[0];
    img.alt = car.model;
    img.className = 'car-photo';
    img.onerror = () => {
      failedImgCache.add(img.src);
      do { i += 1; } while (i < candidates.length && failedImgCache.has(candidates[i]));
      if (i < candidates.length) img.src = candidates[i];
      else if (img && img.parentNode) img.parentNode.removeChild(img);
    };
    box.appendChild(img);
  }
  return box;
}

// UI state helpers for part-action toggles
function ensureUIMaps(state) {
  if (!state.ui) state.ui = { openCars: {}, showDev: false };
  if (!state.ui.openPartActions) state.ui.openPartActions = {};
}
function isPartActionsOpenUI(state, carId, key) {
  ensureUIMaps(state);
  const m = state.ui.openPartActions[carId];
  return m ? !!m[key] : false;
}
function togglePartActionsUI({ state, carId, key, toggleEl, saveState }) {
  ensureUIMaps(state);
  const m = state.ui.openPartActions[carId] || (state.ui.openPartActions[carId] = {});
  m[key] = !m[key];
  if (toggleEl) toggleEl.classList.toggle('active', m[key]);
  const actions = document.querySelector(`.part-actions[data-actions-for="${carId}:${key}"]`);
  if (actions) {
    actions.style.display = m[key] ? '' : 'none';
    const container = actions.closest('.car-breakdown');
    if (container) {
      requestAnimationFrame(() => layoutCarBreakdown(container));
    }
  }
  saveState && saveState();
}

export function renderGarageCarsSection({
  container,
  state,
  PARTS,
  fmt,
  modelId,
  avgCondition,
  conditionStatus,
  isCarOpen,
  onToggleCarOpen,
  isSellConfirm,
  onSellClickById,
  onRaceCar,
  onOpenImagePicker,
  onRepairCar,
  tuningOptions = [],
  onTuneUp,
  onResetTuning,
  saveState,
  achievements = [],
  cosmeticPackages = [],
  onBuyCosmetic = null,
}) {
  if (!container) return;
  container.innerHTML = '';

  const tuningEnabled = Array.isArray(tuningOptions) && tuningOptions.length;
  const money = typeof state.money === 'number' ? state.money : 0;
  const unlockedAchievements = Array.isArray(achievements) ? achievements.filter(a => a.unlocked) : [];

  const badgeCls = (v) => v >= 70 ? 'ok' : v >= 50 ? 'info' : 'bad';

  const buildTuningPanel = (car, idx) => {
    if (!tuningEnabled) return null;
    const panel = el('div', { class: 'tuning-panel' });
    const totalBonus = Math.round(car.tuningBonus || 0);
    panel.appendChild(el('div', { class: 'tuning-header' }, [
      el('strong', { text: 'Performance Tuning' }),
      el('span', { class: 'tag info', text: `${totalBonus >= 0 ? '+' : ''}${totalBonus} Perf` }),
    ]));
    tuningOptions.forEach((option) => {
      const level = car.tuning && typeof car.tuning[option.key] === 'number' ? car.tuning[option.key] : 0;
      const stage = option.stages[Math.min(option.stages.length - 1, Math.max(0, level))];
      const next = level >= option.stages.length - 1 ? null : option.stages[level + 1];
      const row = el('div', { class: 'tuning-row' });
      row.appendChild(el('div', { class: 'tuning-info' }, [
        el('div', { class: 'tuning-name', text: `${option.icon ? option.icon + ' ' : ''}${option.name}` }),
        el('div', { class: 'tuning-meta', text: `${stage.label} • +${stage.bonus} Perf` }),
        option.description ? el('div', { class: 'tuning-desc subtle', text: option.description }) : null,
      ].filter(Boolean)));
      const controls = el('div', { class: 'tuning-controls' });
      if (next) {
        controls.appendChild(el('button', {
          class: 'btn sm primary',
          text: `Tune (${fmt.format(next.cost)})`,
          disabled: money < next.cost || !onTuneUp,
          onclick: () => onTuneUp && onTuneUp(idx, option.key),
        }));
      } else {
        controls.appendChild(el('span', { class: 'tag ok', text: 'Maxed' }));
      }
      controls.appendChild(el('button', {
        class: 'btn sm',
        text: 'Reset',
        disabled: level === 0 || !onResetTuning,
        onclick: () => onResetTuning && onResetTuning(idx, option.key),
      }));
      row.appendChild(controls);
      panel.appendChild(row);
    });
    return panel;
  };

  const addPartRow = (wrap, label, key, carId, idx) => {
    const car = state.garage[idx];
    const cond = Math.round(car.parts[key] ?? 100);
    const open = isPartActionsOpenUI(state, carId, key);
    const row = el('div', { class: 'row part' }, [
      el('span', { text: label }),
      el('div', { class: 'spacer' }),
      (() => {
        const t = el('span', { class: 'part-toggle' + (open ? ' active' : ''), title: 'Repair', text: '🔧' });
        t.onclick = () => togglePartActionsUI({ state, carId, key, toggleEl: t, saveState });
        return t;
      })(),
      el('span', { class: `pct-badge ${badgeCls(cond)}`, text: `${cond}%` }),
    ]);
    wrap.appendChild(row);
    const actions = el('div', { class: 'part-actions', style: open && cond < 100 ? '' : 'display:none', ['data-actions-for']: `${carId}:${key}` }, [
      el('button', { class: 'btn sm', ['data-gprice']: 'legal', ['data-part']: key, text: `Legal ${fmt.format(state.partsPrices.legal[key])}`, onclick: () => onRepairCar(idx, key, 'legal') }),
      el('button', { class: 'btn warn sm', ['data-gprice']: 'illegal', ['data-part']: key, text: `Illegal ${fmt.format(state.partsPrices.illegal[key])}`, onclick: () => onRepairCar(idx, key, 'illegal') }),
    ]);
    wrap.appendChild(actions);
  };

  for (const [idx, car] of state.garage.entries()) {
    const avg = Math.round(avgCondition(car));
    const st = conditionStatus(avg);
    const val = Math.max(0, Math.round(car.valuation ?? car.basePrice ?? 0));
    const profit = val - (car.boughtPrice ?? 0);

    const headerLeft = el('div', { class: 'header-left' }, [
      el('h3', { text: car.model }),
      el('span', { class: `tag ${st.cls}`, text: `${st.label} (${avg}%)` }),
    ]);

    const perfTag = el('span', { class: 'tag metric metric-perf', text: `Perf ${car.perf}` });
    const valueTag = el('span', { class: 'tag metric metric-value', text: `Val ${fmt.format(val)}` });
    const profitClass = profit >= 0 ? 'metric-profit-up' : 'metric-profit-down';
    const profitTag = el('span', { class: `tag metric ${profitClass}`, text: `${profit >= 0 ? '+' : ''}${fmt.format(profit)}` });
    const metricsGroup = el('div', { class: 'header-metrics' }, [perfTag, valueTag, profitTag]);

    const confirming = isSellConfirm && isSellConfirm(car.id);
    const sellBtn = el('button', { class: 'btn danger btn-sell' + (confirming ? ' warn' : ''), text: confirming ? 'Are you sure?' : 'Sell' });
    sellBtn.onclick = () => onSellClickById && onSellClickById(car.id, sellBtn);
    const toggleBtn = el('button', { class: 'btn ghost btn-toggle', text: isCarOpen(car.id) ? 'Hide Details ▴' : 'Show Details ▾', onclick: () => onToggleCarOpen && onToggleCarOpen(car.id) });
    const headerRight = el('div', { class: 'header-right' }, [metricsGroup, sellBtn, toggleBtn]);

    const header = el('div', { class: 'garage-header' }, [headerLeft, headerRight]);
    const badgeRow = unlockedAchievements.length ? (() => {
      const maxBadge = 5;
      const badges = unlockedAchievements.slice(0, maxBadge).map(ach => el('span', {
        class: 'ach-badge',
        title: `${ach.label} — ${ach.description}`,
        text: ach.icon || '🏅',
      }));
      if (unlockedAchievements.length > maxBadge) {
        badges.push(el('span', { class: 'ach-badge more', text: `+${unlockedAchievements.length - maxBadge}` }));
      }
      return el('div', { class: 'achievement-badge-row' }, badges);
    })() : null;

    const breakdown = renderCarBreakdown({ car, idx, state, PARTS, modelId });

    // Build callout groups around the car silhouette
    const engine = el('div', { class: 'callout callout-engine' }, [ el('div', { class: 'title' }, [ el('span', { text: 'Engine' }) ]) ]);
    addPartRow(engine, 'Engine Block', 'engine_block', car.id, idx);
    addPartRow(engine, 'Induction (Turbo/Intake)', 'induction', car.id, idx);
    addPartRow(engine, 'Fuel System', 'fuel_system', car.id, idx);
    addPartRow(engine, 'Cooling (Radiator/Pump)', 'cooling', car.id, idx);
    addPartRow(engine, 'Ignition (Coils/Plugs)', 'ignition', car.id, idx);
    addPartRow(engine, 'Timing (Belt/Chain)', 'timing', car.id, idx);
    addPartRow(engine, 'Alternator', 'alternator', car.id, idx);
    addPartRow(engine, 'ECU/Sensors', 'ecu', car.id, idx);
    breakdown.appendChild(engine);

    const drive = el('div', { class: 'callout callout-drive' }, [ el('div', { class: 'title' }, [ el('span', { text: 'Drivetrain' }) ]) ]);
    addPartRow(drive, 'Transmission', 'transmission', car.id, idx);
    addPartRow(drive, 'Clutch', 'clutch', car.id, idx);
    addPartRow(drive, 'Differential', 'differential', car.id, idx);
    breakdown.appendChild(drive);

    const running = el('div', { class: 'callout callout-running' }, [ el('div', { class: 'title' }, [ el('span', { text: 'Running Gear' }) ]) ]);
    addPartRow(running, 'Suspension', 'suspension', car.id, idx);
    addPartRow(running, 'Tires', 'tires', car.id, idx);
    addPartRow(running, 'Brakes', 'brakes', car.id, idx);
    addPartRow(running, 'Exhaust', 'exhaust', car.id, idx);
    addPartRow(running, 'Battery', 'battery', car.id, idx);
    addPartRow(running, 'Interior Electronics', 'electronics', car.id, idx);
    breakdown.appendChild(running);

    const tuningPanel = buildTuningPanel(car, idx);
    const cosmeticsPanel = (() => {
      if (!Array.isArray(cosmeticPackages) || !cosmeticPackages.length) return null;
      const rows = cosmeticPackages.map(pkg => {
        const owned = Array.isArray(car.cosmetics) && car.cosmetics.includes(pkg.id);
        const label = `${pkg.icon || '🖌️'} ${pkg.label}`;
        return el('div', { class: 'cosmetic-row' }, [
          el('div', { class: 'cosmetic-info' }, [
            el('span', { class: 'cosmetic-label', text: label }),
            el('span', { class: 'subtle', text: pkg.description }),
          ]),
          owned
            ? el('span', { class: 'tag ok', text: 'Installed' })
            : el('button', {
                class: 'btn sm',
                text: pkg.cost ? `Buy — ${fmt.format(pkg.cost)}` : 'Install',
                onclick: () => onBuyCosmetic && onBuyCosmetic(idx, pkg.id),
                disabled: money < (pkg.cost || 0),
              }),
        ]);
      });
      return el('div', { class: 'cosmetics-panel' }, [
        el('strong', { text: 'Cosmetic Upgrades' }),
        ...rows,
      ]);
    })();
    const contentChildren = [breakdown];
    if (tuningPanel) contentChildren.push(tuningPanel);
    if (cosmeticsPanel) contentChildren.push(cosmeticsPanel);
    const collapsible = el('div', { class: 'collapsible ' + (isCarOpen(car.id) ? 'open' : ''), ['data-car-id']: car.id }, [
      el('div', { class: 'content scrollable-content' }, contentChildren),
    ]);

    const bodyChildren = badgeRow ? [badgeRow, collapsible] : [collapsible];
    const card = el('div', { class: 'panel garage-card', ['data-garage-card']: car.id }, [ header, el('div', { class: 'card-body' }, bodyChildren) ]);
    container.appendChild(card);
  }

  requestAnimationFrame(() => {
    container.querySelectorAll('.car-breakdown').forEach(layoutCarBreakdown);
  });
}

export function layoutCarBreakdown(container) {
  try {
    const rect = container.getBoundingClientRect();
    let maxBottom = rect.top + 320;
    container.querySelectorAll('.callout').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom > maxBottom) maxBottom = r.bottom;
    });
    const needed = Math.ceil(maxBottom - rect.top) + 12;
    container.style.height = needed + 'px';
  } catch {}
}

export function renderGarageFullView({ state, PARTS, fmt, modelId, avgCondition, conditionStatus, isCarOpen, onToggleCarOpen, isSellConfirm, onSellClickById, onRaceCar, onOpenImagePicker, onRepairCar, tuningOptions = [], onTuneUp, onResetTuning, garageCapacity, nextGarageCost, onBuyGarageSlot, saveState, achievements = [], garageTierInfo = null, onUpgradeTier = null, onBuyCosmetic = null, cosmeticPackages = [], crewInvestments = [], onInvestCrew = null }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  view.setAttribute('data-current-view', 'garage');
  const capUsed = state.garage.length;
  const capMax = garageCapacity();
  const tierInfo = garageTierInfo || {};
  const slotCost = typeof tierInfo.nextSlotCost === 'number' ? tierInfo.nextSlotCost : nextGarageCost();
  const tierLabel = tierInfo.label || 'Back-Alley Lockup';
  const tierDesc = tierInfo.description || 'Starter lockup with minimal amenities.';
  const baseSlots = tierInfo.baseSlots ?? (capMax - (tierInfo.extraSlots ?? 0));
  const extraSlots = tierInfo.extraSlots ?? (state.garagesPurchased || 0);
  const maxExtras = tierInfo.maxExtraSlots ?? null;
  const canBuySlot = tierInfo.canBuySlot !== false && slotCost !== null;
  const nextTier = tierInfo.nextTier || null;
  const upgradeCost = nextTier && typeof nextTier.cost === 'number' ? nextTier.cost : null;
  const canUpgrade = !!nextTier && tierInfo.canUpgrade !== false;
  const affordUpgrade = canUpgrade && (upgradeCost === null || (state.money || 0) >= upgradeCost);
  const capPanel = el('div', { class: 'panel storage-panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: tierLabel }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', ['data-storage-tag']: 'garage', text: `${capUsed}/${capMax} slots used` }),
    ]),
    el('div', { class: 'storage-desc', text: tierDesc }),
    el('div', { class: 'row storage-metrics' }, [
      el('span', { class: 'tag subtle', text: `Base Slots: ${baseSlots}` }),
      maxExtras !== null ? el('span', { class: 'tag subtle', text: `Extra Slots: ${extraSlots}/${maxExtras}` }) : null,
    ].filter(Boolean)),
    el('div', { class: 'row storage-actions' }, [
      el('button', {
        class: 'btn primary',
        ['data-storage-buy']: 'garage',
        text: canBuySlot ? (slotCost ? `Buy Slot (${fmt.format(slotCost)})` : 'Buy Slot') : 'Slots Maxed',
        onclick: () => onBuyGarageSlot(),
        disabled: !canBuySlot,
      }),
      canUpgrade ? el('button', {
        class: 'btn good',
        text: upgradeCost ? `Upgrade — ${fmt.format(upgradeCost)}` : 'Upgrade Tier',
        onclick: () => onUpgradeTier && onUpgradeTier(),
        disabled: !affordUpgrade,
      }) : null,
    ].filter(Boolean)),
  ]);
  view.appendChild(capPanel);

  const crewHasItems = Array.isArray(crewInvestments) && crewInvestments.length;
  const hasCrew = state.crew && Object.values(state.crew).some(Boolean);
  if (crewHasItems || hasCrew) {
    const crewRows = (crewHasItems ? crewInvestments : []).map(inv => {
      const owned = !!inv.owned;
      const costLabel = fmt.format(inv.cost || 0);
      return el('div', { class: 'crew-row' }, [
        el('div', { class: 'crew-info' }, [
          el('span', { class: 'crew-icon', text: inv.icon || '🛠️' }),
          el('div', { class: 'crew-text' }, [
            el('strong', { text: inv.label }),
            el('span', { class: 'subtle', text: inv.description }),
          ]),
        ]),
        el('div', { class: 'crew-actions' }, [
          owned
            ? el('span', { class: 'tag ok', text: 'Active' })
            : el('button', {
                class: 'btn primary',
                text: `Hire — ${costLabel}`,
                onclick: () => onInvestCrew && onInvestCrew(inv.key),
                disabled: !inv.afford,
              }),
        ]),
      ]);
    });
    const body = crewRows.length ? crewRows : [el('div', { class: 'subtle', text: 'Crew fully staffed.' })];
    const crewPanel = el('div', { class: 'panel crew-panel' }, [
      el('div', { class: 'row' }, [
        el('h3', { text: 'Crew Investments' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'tag info', text: 'Passive boosts' }),
      ]),
      el('div', { class: 'crew-grid' }, body),
    ]);
    view.appendChild(crewPanel);
  }
  const cardsContainer = el('div', { class: 'garage-cards', ['data-section']: 'garage-cars', ['data-tour-id']: 'garage-repair' });
  if (!state.garage.length) {
    cardsContainer.classList.add('is-empty');
    cardsContainer.appendChild(el('div', { class: 'panel notice', text: 'No cars yet. Buy from the Illegal Market.' }));
    view.appendChild(cardsContainer);
    return;
  }
  view.appendChild(cardsContainer);

  renderGarageCarsSection({
    container: cardsContainer,
    state,
    PARTS,
    fmt,
    modelId,
    avgCondition,
    conditionStatus,
    isCarOpen,
    onToggleCarOpen,
    isSellConfirm,
    onSellClickById,
    onRaceCar,
    onOpenImagePicker,
    onRepairCar,
    tuningOptions,
    onTuneUp,
    onResetTuning,
    saveState,
    achievements,
    cosmeticPackages,
    onBuyCosmetic,
  });
}
export function renderPartsView({ state, PARTS, fmt }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Parts Market' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Live' }),
    ]),
    el('table', {}, [
      el('thead', {}, [ el('tr', {}, [
        el('th', { text: 'Part' }),
        el('th', { text: 'Legal Price' }),
        el('th', { text: 'Illegal Price' }),
      ])]),
      el('tbody', {}, PARTS.map(p => el('tr', {}, [
        el('td', { text: p.name }),
        el('td', {}, [ el('span', { ['data-part-legal']: p.key, text: fmt.format(state.partsPrices.legal[p.key]) }) ]),
        el('td', {}, [ el('span', { ['data-part-illegal']: p.key, text: fmt.format(state.partsPrices.illegal[p.key]) }) ]),
      ])))
    ]),
    el('div', { class: 'notice', text: 'Prices update automatically. Illegal parts are cheaper but can fail on install.' })
  ]);
  view.appendChild(panel);
}

export function updatePartsPricesUI({ state, PARTS, fmt }) {
  for (const p of PARTS) {
    const l = document.querySelector(`[data-part-legal="${p.key}"]`);
    if (l) l.textContent = fmt.format(state.partsPrices.legal[p.key]);
    const i = document.querySelector(`[data-part-illegal="${p.key}"]`);
    if (i) i.textContent = fmt.format(state.partsPrices.illegal[p.key]);
  }
  document.querySelectorAll('[data-gprice][data-part]').forEach(btn => {
    const kind = btn.getAttribute('data-gprice');
    const partKey = btn.getAttribute('data-part');
    const price = state.partsPrices[kind]?.[partKey];
    if (typeof price === 'number') {
      const label = kind === 'legal' ? 'Legal ' : 'Illegal ';
      btn.textContent = label + fmt.format(price);
    }
  });
}

export function renderRacesView({ state, RACE_EVENTS, canRace, onRaceCar, fmt, mode = 'street', leagueData = [], leagueState = null, onLeagueRace = null, onLeagueReset = null, onDismissLeagueFlash = null }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const layout = el('div', { class: 'races-layout' });

  if (mode === 'street' || mode === 'both') {
    const streetSection = el('div', { class: 'races-section' });
    const header = el('div', { class: 'panel' }, [
      el('div', { class: 'row' }, [
        el('h3', { text: 'Street Race Events' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'tag info', text: 'Choose an event' })
      ])
    ]);
    streetSection.appendChild(header);

    const grid = el('div', { class: 'race-events-grid', ['data-tour-id']: 'races-enter' });
    RACE_EVENTS.forEach(event => {
      const suitableCar = state.garage.find(c => canRace(c) && c.perf >= event.opponentPerf - 15);
      const carOptions = state.garage.filter(c => canRace(c));

      const carSwitcher = el('div', { class: 'car-switcher' });
      if (carOptions.length > 0) {
        const carDisplay = el('span', { class: 'car-display', text: `${carOptions[0].model} (P:${carOptions[0].perf})` });
        carSwitcher.setAttribute('data-selected-car-idx', '0');

        const prevBtn = el('button', { class: 'arrow', text: '‹' });
        const nextBtn = el('button', { class: 'arrow', text: '›' });

        const switchCar = (dir) => {
          let currentIdx = parseInt(carSwitcher.getAttribute('data-selected-car-idx'), 10);
          currentIdx = (currentIdx + dir + carOptions.length) % carOptions.length;
          const selectedCar = carOptions[currentIdx];
          carDisplay.textContent = `${selectedCar.model} (P:${selectedCar.perf})`;
          carSwitcher.setAttribute('data-selected-car-idx', String(currentIdx));
        };

        prevBtn.onclick = () => switchCar(-1);
        nextBtn.onclick = () => switchCar(1);

        carSwitcher.appendChild(prevBtn);
        carSwitcher.appendChild(carDisplay);
        carSwitcher.appendChild(nextBtn);
      } else {
        carSwitcher.appendChild(el('span', { class: 'car-display subtle', text: 'No cars available' }));
      }

      const isDisabled = !suitableCar;
      const card = el('div', { class: 'panel event-card' + (isDisabled ? ' disabled' : '') }, [
        el('div', { class: `event-card-track track-${event.trackType}` }, [
          el('h4', { text: event.name })
        ]),
        el('div', { class: 'event-card-body' }, [
          el('div', { class: 'event-details-grid' }, [
            el('div', { class: 'detail-item' }, [el('span', { class: 'subtle' }, ['Opponent Perf']), el('strong', { text: String(event.opponentPerf) })]),
            el('div', { class: 'detail-item' }, [el('span', { class: 'subtle' }, ['Entry Fee']), el('strong', { text: fmt.format(event.entryFee) })]),
            el('div', { class: 'detail-item prize' }, [el('span', { class: 'subtle' }, ['Prize']), el('strong', { class: 'good', text: fmt.format(event.prize) })]),
          ]),
          el('div', { class: 'event-actions' }, [
            carSwitcher,
            el('button', { class: 'btn good', text: 'Enter Race', onclick: (e) => {
                const switcher = e.target.closest('.event-card').querySelector('.car-switcher');
                const selectedCarOptionIndex = parseInt(switcher.getAttribute('data-selected-car-idx'), 10);
                const selectedCar = carOptions[selectedCarOptionIndex];
                if (!selectedCar) return;
                const originalGarageIndex = state.garage.findIndex(c => c.id === selectedCar.id);
                if (originalGarageIndex !== -1) onRaceCar(originalGarageIndex, event.id);
            }, disabled: isDisabled })
          ]),
          isDisabled ? el('div', { class: 'event-locked-msg' }, [
            '🔒 No eligible cars available for this event.'
          ]) : null
        ])
      ]);
      grid.appendChild(card);
    });
    streetSection.appendChild(grid);
    layout.appendChild(streetSection);
  }

  if ((mode === 'league' || mode === 'both') && Array.isArray(leagueData) && leagueData.length) {
    layout.appendChild(renderLeaguePanel({ state, fmt, canRace, onLeagueRace, onLeagueReset, leagueData, leagueState, onDismissFlash: onDismissLeagueFlash }));
  }

  view.appendChild(layout);
}

function renderLeaguePanel({ state, fmt, canRace, onLeagueRace, onLeagueReset, leagueData, leagueState, onDismissFlash = null }) {
  const section = el('div', { class: 'races-section league-section', ['data-tour-id']: 'league-overview' });
  const league = leagueState || {};
  const rankCount = leagueData.length;
  const rankIndex = Math.min(rankCount - 1, Math.max(0, league.rank || 0));
  const currentRank = leagueData[rankIndex];
  const opponents = currentRank?.opponents || [];
  const rankComplete = league.match >= opponents.length;
  const champion = !!league.champion && rankIndex === rankCount - 1 && rankComplete;

  const headerRow = el('div', { class: 'row' }, [
    el('div', { class: 'league-heading' }, [
      el('h3', { text: `Rank ${rankIndex + 1}/${rankCount} — ${currentRank?.name || 'Unknown Rank'}` }),
      currentRank?.description ? el('div', { class: 'league-subtitle', text: currentRank.description }) : null,
    ].filter(Boolean)),
    el('div', { class: 'spacer' }),
    el('span', { class: 'tag', text: `Season ${league.season || 1}` }),
    el('span', { class: 'tag info', text: `${Math.min(league.match || 0, opponents.length)}/${opponents.length} wins` }),
    league.lossStreak ? el('span', { class: 'tag warn', text: `Loss streak ${league.lossStreak}/2` }) : null,
    champion ? el('span', { class: 'tag ok', text: 'Champion' }) : null,
  ]);

  const progress = el('div', { class: 'league-progress' }, opponents.map((opponent, idx) => {
    const status = idx < (league.match || 0) ? 'completed' : (idx === (league.match || 0) ? 'current' : 'upcoming');
    return el('div', { class: `league-progress-item ${status}` }, [
      el('div', { class: 'name', text: opponent.name }),
      el('div', { class: 'perf', text: `Perf ${opponent.perf}` }),
    ]);
  }));

  const upcoming = rankComplete ? null : opponents[league.match || 0];
  const upcomingEntry = upcoming?.entryFee || currentRank?.entryFee || 0;
  const infoGrid = upcoming ? el('div', { class: 'league-details' }, [
    el('div', { class: 'detail' }, [el('span', { class: 'label', text: 'Next Opponent' }), el('strong', { text: upcoming.name }) ]),
    el('div', { class: 'detail' }, [el('span', { class: 'label', text: 'Performance' }), el('strong', { text: String(upcoming.perf) }) ]),
    el('div', { class: 'detail' }, [el('span', { class: 'label', text: 'Entry Fee' }), el('strong', { class: upcomingEntry > (state.money || 0) ? 'bad' : '', text: fmt.format(upcomingEntry) }) ]),
    el('div', { class: 'detail' }, [el('span', { class: 'label', text: 'Payout' }), el('strong', { class: 'good', text: fmt.format(upcoming.reward) }) ]),
    el('div', { class: 'detail' }, [el('span', { class: 'label', text: 'Heat' }), el('strong', { text: `${upcoming.heat ?? currentRank?.heat ?? 4}` }) ]),
  ]) : null;

  const carOptions = state.garage.filter(c => canRace(c));
  const carSwitcher = el('div', { class: 'car-switcher' });
  if (carOptions.length) {
    const carDisplay = el('span', { class: 'car-display', text: `${carOptions[0].model} (P:${carOptions[0].perf})` });
    carSwitcher.setAttribute('data-selected-car-idx', '0');
    const prevBtn = el('button', { class: 'arrow', text: '‹' });
    const nextBtn = el('button', { class: 'arrow', text: '›' });
    const switchCar = (dir) => {
      let currentIdx = parseInt(carSwitcher.getAttribute('data-selected-car-idx'), 10);
      currentIdx = (currentIdx + dir + carOptions.length) % carOptions.length;
      const selectedCar = carOptions[currentIdx];
      carDisplay.textContent = `${selectedCar.model} (P:${selectedCar.perf})`;
      carSwitcher.setAttribute('data-selected-car-idx', String(currentIdx));
    };
    prevBtn.onclick = () => switchCar(-1);
    nextBtn.onclick = () => switchCar(1);
    carSwitcher.appendChild(prevBtn);
    carSwitcher.appendChild(carDisplay);
    carSwitcher.appendChild(nextBtn);
  } else {
    carSwitcher.appendChild(el('span', { class: 'car-display subtle', text: 'No cars available' }));
  }

  const needsCash = upcomingEntry > (state.money || 0);
  const actionRow = el('div', { class: 'league-actions' }, [
    carSwitcher,
    champion
      ? el('button', {
          class: 'btn primary',
          text: 'Start New Season',
          disabled: !onLeagueReset,
          onclick: () => onLeagueReset && onLeagueReset(),
        })
      : el('button', {
          class: 'btn good',
          text: upcomingEntry ? `Challenge — ${fmt.format(upcomingEntry)} entry` : 'Challenge',
          disabled: (!upcoming) || !carOptions.length || !onLeagueRace || needsCash,
          onclick: (e) => {
            if (!carOptions.length || !onLeagueRace || !upcoming) return;
            const switcher = e.target.closest('.league-actions').querySelector('.car-switcher');
            const idx = parseInt(switcher.getAttribute('data-selected-car-idx'), 10);
            const selectedCar = carOptions[idx];
            if (!selectedCar) return;
            const original = state.garage.findIndex(c => c.id === selectedCar.id);
            if (original !== -1) onLeagueRace(original);
          }
        })
  ]);

  const trophyRow = el('div', { class: 'league-trophy' }, [
    el('span', { class: 'label', text: 'Rank Trophy' }),
    el('strong', { text: fmt.format(currentRank?.trophyReward || 0) }),
    el('span', { class: 'label', text: 'XP' }),
    el('strong', { text: `+${currentRank?.trophyXp || 0}` }),
  ]);

  const championMsg = champion ? el('div', { class: 'league-champion-msg', text: 'Midnight League complete — enjoy the rewards!' }) : null;

  const treeTrack = el('div', { class: 'league-tree-track' });
  const treeList = el('div', { class: 'league-tree-list' });
  treeTrack.appendChild(treeList);

  treeList.addEventListener('pointerdown', (event) => {
    treeList.classList.add('dragging');
    const startX = event.clientX;
    const startScroll = treeTrack.scrollLeft;
    const onMove = (e) => {
      const dx = e.clientX - startX;
      treeTrack.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      treeList.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  });


  leagueData.forEach((rankDef, idx) => {
    const status = idx < rankIndex ? 'done' : idx === rankIndex ? 'current' : 'upcoming';
    const completed = Array.isArray(league.completedRanks) && league.completedRanks.includes(rankDef.id);
    const minPerf = Math.min(...(rankDef.opponents || []).map(o => o.perf));
    const maxPerf = Math.max(...(rankDef.opponents || []).map(o => o.perf));
    const node = el('div', { class: `league-tree-item ${status} ${completed ? 'done' : ''}` }, [
      el('div', { class: 'tree-label', text: rankDef.name }),
      el('div', { class: 'tree-sub', text: isFinite(minPerf) && isFinite(maxPerf) ? `Perf ${minPerf}–${maxPerf}` : 'Perf ?' }),
      el('div', { class: 'tree-reward', text: `${fmt.format(rankDef.trophyReward || 0)} • +${rankDef.trophyXp || 0} XP` }),
    ]);
    const connector = idx < leagueData.length - 1 ? el('div', { class: 'tree-connector' }) : null;
    treeList.appendChild(node);
    if (connector) treeList.appendChild(connector);
  });

  const treePanel = el('div', { class: 'panel league-tree' }, [
    el('div', { class: 'tree-header-row' }, [
      el('h4', { text: 'Rank Progression' }),
      el('span', { class: 'tree-hint', text: 'Drag to scroll' }),
    ]),
    treeTrack,
  ]);

  const entryWarning = needsCash && upcoming ? el('div', { class: 'league-entry-warning', text: `You need ${fmt.format(upcomingEntry)} to enter this heat.` }) : null;

  const flash = league.flash;
  const flashClasses = flash ? `league-flash panelish ${flash.tone || 'info'}` : null;
  const flashBanner = flash ? el('div', { class: flashClasses }, [
    el('span', { class: 'message', text: flash.text }),
    el('button', {
      class: 'btn sm',
      text: 'Dismiss',
      onclick: () => { if (onDismissFlash) onDismissFlash(); },
    })
  ]) : null;

  const panel = el('div', { class: 'panel league-panel' }, [
    headerRow,
    flashBanner,
    progress,
    infoGrid,
    trophyRow,
    actionRow,
    entryWarning,
    championMsg,
  ].filter(Boolean));

  section.appendChild(panel);
  section.appendChild(treePanel);
  return section;
}

export function renderDashboardView({ state, metrics, fmt, drawSparkline, xpInfo = {}, achievements = [], achievementSummary = {}, leaderboards = null, profileId = null }) {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '';
  view.setAttribute('data-current-view', 'dashboard');

  const level = Math.max(1, Math.round((xpInfo && xpInfo.level) ?? (state && state.level) ?? 1));
  const xp = Math.max(0, Math.round((xpInfo && xpInfo.xp) ?? (state && state.xp) ?? 0));
  const needed = Math.max(1, Math.round((xpInfo && xpInfo.needed) ?? Math.max(1, xp) ));
  const xpSummary = `Lv ${level} • ${xp}/${needed} XP`;
  const heatNow = Math.max(0, Math.min(100, Math.round((state && state.heat) || 0)));
  const carsCount = Math.max(0, metrics.carsCount || 0);

  const cardsData = [
    { key: 'net-worth', title: 'Net Worth', value: fmt.format(metrics.netWorth || 0), note: 'Cash + garage value' },
    { key: 'cash', title: 'Cash on Hand', value: fmt.format(metrics.money || 0), note: 'Liquid funds available' },
    { key: 'garage', title: 'Garage Value', value: fmt.format(metrics.garageValue || 0), note: `${carsCount} ${carsCount === 1 ? 'car' : 'cars'} owned` },
    { key: 'condition', title: 'Avg Condition', value: `${Math.max(0, Math.round(metrics.avgCondition || 0))}%`, note: 'Across owned cars' },
    { key: 'avg-heat', title: 'Avg Heat', value: `${Math.max(0, Math.round(metrics.avgHeat || 0))}%`, note: 'Last 20 samples' },
    { key: 'current-heat', title: 'Current Heat', value: `${heatNow}%`, note: 'Immediate risk' },
  ];

  const makeCard = ({ key, title, value, note }) => el('div', { class: 'dashboard-card', ['data-card']: key }, [
    el('span', { class: 'label', text: title }),
    el('span', { class: 'value', text: value }),
    note ? el('span', { class: 'note', text: note }) : null,
  ].filter(Boolean));

  const summaryPanel = el('div', { class: 'panel dashboard-summary', ['data-tour-id']: 'dashboard-overview' }, [
    el('div', { class: 'dashboard-summary-header' }, [
      el('div', { class: 'title-block' }, [
        el('h2', { text: 'Operations Summary' }),
        el('div', { class: 'subtle', text: xpSummary }),
      ]),
      el('div', { class: 'chip-row' }, [
        el('span', { class: 'tag info', text: `Heat ${heatNow}%` }),
        el('span', { class: 'tag info', text: carsCount === 1 ? '1 car in garage' : `${carsCount} cars in garage` }),
        el('span', { class: 'tag info', text: `Season ${metrics.league?.season || 1}` }),
      ]),
    ]),
    el('div', { class: 'dashboard-grid', ['data-tour-target']: 'dashboard-metrics' }, cardsData.map(makeCard)),
  ]);

  view.appendChild(summaryPanel);

  const netHistory = Array.isArray(metrics.netWorthHistory) ? metrics.netWorthHistory.map(item => Math.max(0, Math.round(item?.value || 0))) : [];
  const netPrev = netHistory.length > 1 ? netHistory[netHistory.length - 2] : null;
  const netDelta = netPrev !== null ? (metrics.netWorth || 0) - netPrev : null;
  const netDeltaText = netDelta === null ? '—' : `${netDelta >= 0 ? '+' : '-'}${fmt.format(Math.abs(netDelta))}`;
  const netDeltaClass = netDelta === null ? 'neutral' : netDelta > 0 ? 'up' : netDelta < 0 ? 'down' : 'neutral';

  const heatHistory = Array.isArray(metrics.heatSamples) ? metrics.heatSamples.map(item => Math.max(0, Math.round(item?.value || 0))) : [];
  const heatCurrent = heatHistory.length ? heatHistory[heatHistory.length - 1] : heatNow;
  const heatPrev = heatHistory.length > 1 ? heatHistory[heatHistory.length - 2] : null;
  const heatDelta = heatPrev !== null ? heatCurrent - heatPrev : null;
  const heatDeltaText = heatDelta === null ? '—' : `${heatDelta >= 0 ? '+' : ''}${Math.round(heatDelta)}%`;
  const heatDeltaClass = heatDelta === null ? 'neutral' : heatDelta > 0 ? 'up' : heatDelta < 0 ? 'down' : 'neutral';

  const netCanvas = el('canvas', { class: 'dashboard-spark', width: 320, height: 100 });
  const heatCanvas = el('canvas', { class: 'dashboard-spark', width: 320, height: 100 });

  const trendsPanel = el('div', { class: 'panel dashboard-trends', ['data-tour-id']: 'dashboard-trends' }, [
    el('div', { class: 'dashboard-trends-header' }, [
      el('h3', { text: 'Key Trends' }),
      el('span', { class: 'subtle', text: 'Auto-updating analytics from recent play' }),
    ]),
    el('div', { class: 'dashboard-chart-grid' }, [
      el('div', { class: 'dashboard-chart' }, [
        el('div', { class: 'chart-header' }, [
          el('span', { class: 'chart-title', text: 'Net Worth' }),
          el('span', { class: `chart-delta ${netDeltaClass}`, text: netDeltaText }),
        ]),
        el('div', { class: 'chart-value', text: fmt.format(metrics.netWorth || 0) }),
        netCanvas,
      ]),
      el('div', { class: 'dashboard-chart' }, [
        el('div', { class: 'chart-header' }, [
          el('span', { class: 'chart-title', text: 'Heat' }),
          el('span', { class: `chart-delta ${heatDeltaClass}`, text: heatDeltaText }),
        ]),
        el('div', { class: 'chart-value', text: `${heatCurrent}%` }),
        heatCanvas,
      ]),
    ]),
  ]);

  view.appendChild(trendsPanel);

  const summaryUnlocked = Number.isFinite(achievementSummary.unlocked) ? achievementSummary.unlocked : achievements.filter(a => a.unlocked).length;
  const summaryTotal = Number.isFinite(achievementSummary.total) ? achievementSummary.total : achievements.length;
  const badgeGrid = el('div', { class: 'achievement-grid' }, achievements.map(ach => {
    const tooltip = el('div', { class: 'achievement-pop' }, [
      el('strong', { text: ach.label }),
      el('p', { text: ach.description || 'Hidden objective.' }),
    ]);
    const card = el('div', {
      class: 'achievement-card' + (ach.unlocked ? ' unlocked' : ' locked'),
      ['data-achievement-id']: ach.id,
      'aria-label': ach.description || ach.label,
    }, [
      el('div', { class: 'achievement-icon', text: ach.icon || '🏅' }),
      el('div', { class: 'achievement-label', text: ach.label }),
      ach.unlocked && ach.unlockedAt
        ? el('div', { class: 'achievement-time', text: new Date(ach.unlockedAt).toLocaleDateString() })
        : null,
      tooltip,
    ].filter(Boolean));
    card.addEventListener('mouseenter', () => {
      tooltip.classList.add('active');
      const fallbackHeight = tooltip.offsetHeight || 70;
      const fallbackTop = Math.max(8, card.clientHeight - fallbackHeight - 8);
      tooltip.style.left = '16px';
      tooltip.style.top = `${fallbackTop}px`;
    });
    card.addEventListener('mouseleave', () => {
      tooltip.classList.remove('active');
      tooltip.style.left = '';
      tooltip.style.top = '';
    });
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const rawX = event.clientX - rect.left + 16;
      const rawY = event.clientY - rect.top + 18;
      const width = tooltip.offsetWidth || 220;
      const height = tooltip.offsetHeight || 60;
      const maxX = rect.width - width - 8;
      const maxY = rect.height - height - 8;
      const clampedX = Math.max(8, Math.min(rawX, maxX));
      const clampedY = Math.max(8, Math.min(rawY, maxY));
      tooltip.style.left = `${clampedX}px`;
      tooltip.style.top = `${clampedY}px`;
    });
    return card;
  }));
  const achievementPanel = el('div', { class: 'panel dashboard-achievements', ['data-tour-id']: 'dashboard-achievements' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Achievements' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `${summaryUnlocked}/${summaryTotal} unlocked` }),
    ]),
    badgeGrid,
  ]);

  const bestCar = metrics.bestCar || null;
  const bestPanel = el('div', { class: 'panel dashboard-best', ['data-tour-id']: 'dashboard-best-car' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Top Performer' }),
      bestCar ? el('span', {
        class: `tag ${bestCar.profit >= 0 ? 'ok' : 'bad'}`,
        text: `${bestCar.profit >= 0 ? '+' : '-'}${fmt.format(Math.abs(bestCar.profit || 0))} profit`,
      }) : null,
    ].filter(Boolean)),
    bestCar ? el('div', { class: 'best-grid' }, [
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Model' }), el('span', { class: 'value', text: bestCar.model }) ]),
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Valuation' }), el('span', { class: 'value', text: fmt.format(bestCar.valuation || 0) }) ]),
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Condition' }), el('span', { class: 'value', text: `${Math.round(bestCar.condition || 0)}%` }) ]),
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Performance' }), el('span', { class: 'value', text: `${bestCar.perf || 0}` }) ]),
    ]) : el('div', { class: 'empty', text: 'Acquire a car to start building your portfolio.' }),
  ]);

  const league = metrics.league || {};
  const matchesTotal = Math.max(0, league.matchesTotal || 0);
  const matchDisplay = matchesTotal ? `${Math.min(matchesTotal, (league.match || 0) + 1)}/${matchesTotal} matches` : 'No active bracket';
  const leaguePanel = el('div', { class: 'panel dashboard-league', ['data-tour-id']: 'dashboard-league' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'League Position' }),
      league.champion ? el('span', { class: 'tag ok', text: 'Champion' }) : null,
    ].filter(Boolean)),
    el('div', { class: 'league-grid' }, [
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Rank' }), el('span', { class: 'value', text: league.rankName ? `${league.rankName}` : `Rank ${Math.max(1, (league.rank || 0) + 1)}` }) ]),
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Season' }), el('span', { class: 'value', text: `${league.season || 1}` }) ]),
      el('div', { class: 'meta' }, [ el('span', { class: 'label', text: 'Progress' }), el('span', { class: 'value', text: matchDisplay }) ]),
    ]),
    league.rankName ? el('div', { class: 'subtle', text: `Competing in ${league.rankName}.` }) : null,
  ]);

  const activityFeed = el('div', { class: 'dashboard-log-feed', ['data-activity-log']: '' });
  const activityPanel = el('div', { class: 'panel dashboard-log', ['data-tour-id']: 'dashboard-log' }, [
    el('h3', { text: 'Recent Activity' }),
    activityFeed,
  ]);

  const rowItems = [bestPanel, leaguePanel].filter(Boolean);
  const rowPanels = rowItems.length ? el('div', { class: 'row-panels' }, rowItems) : null;
  const bottom = el('div', { class: 'dashboard-bottom' }, [rowPanels, activityPanel, achievementPanel].filter(Boolean));
  view.appendChild(bottom);

  requestAnimationFrame(() => {
    try {
      if (netCanvas && netHistory.length >= 2) {
        drawSparkline(netCanvas, netHistory, '#57b6ff', { formatter: (v) => fmt.format(Math.max(0, Math.round(v))) });
      }
      if (heatCanvas && heatHistory.length >= 2) {
        drawSparkline(heatCanvas, heatHistory, '#ffb347', { zeroLine: true, formatter: (v) => `${Math.round(v)}%` });
      }
      const feed = view.querySelector('[data-activity-log]');
      if (feed) {
        feed.innerHTML = '';
        const logs = Array.isArray(state.log) ? state.log.slice(0, 8) : [];
        logs.forEach(entry => {
          feed.appendChild(el('div', { class: 'activity-line', text: `• ${entry}` }));
        });
      }
    } catch {}
  });
}

export function renderMarketView({ state, PARTS, MODELS, fmt, modelId, ensureModelTrends, onBuyCar, isSellConfirm, onSellClickById }) {
  const view = document.getElementById('view');
  view.innerHTML = '';

  const listingsBody = el('tbody', { ['data-section']: 'market-listings' });
  const listingsTable = el('table', { class: 'market-table' }, [
    el('thead', {}, [ el('tr', {}, [
      el('th', { text: 'Model' }),
      el('th', { text: 'Perf' }),
      el('th', { text: 'Condition' }),
      el('th', { text: 'Price' }),
      el('th', { text: '' }),
    ]) ]),
    listingsBody,
  ]);

  const listingsPanel = el('div', { class: 'panel', ['data-panel']: 'market-listings', ['data-tour-id']: 'market-buy' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Illegal Market — Cars' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Live' }),
    ]),
    el('div', {}, [ listingsTable ]),
  ]);
  view.appendChild(listingsPanel);

  const trendsGrid = el('div', { class: 'grid', ['data-section']: 'market-trends' });
  const trendsPanel = el('div', { class: 'panel', ['data-panel']: 'market-trends' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Price Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Auto-updating' }),
    ]),
    trendsGrid,
  ]);
  view.appendChild(trendsPanel);

  const ownedGrid = el('div', { class: 'grid', ['data-section']: 'market-owned' });
  const ownedPanel = el('div', { class: 'panel', ['data-panel']: 'market-owned' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Your Cars — Price Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Auto-updating' }),
    ]),
    ownedGrid,
  ]);
  view.appendChild(ownedPanel);

  const allGrid = el('div', { class: 'grid', ['data-section']: 'market-all' });
  const allPanel = el('div', { class: 'panel', ['data-panel']: 'market-all' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'All Cars — Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Pinned: In Shop' }),
    ]),
    allGrid,
  ]);
  view.appendChild(allPanel);

  renderMarketListingsSection({
    container: listingsBody,
    state,
    PARTS,
    fmt,
    level: state.level,
    onBuyCar,
  });

  renderMarketTrendsSection({ container: trendsGrid, state, fmt });

  if (state.garage && state.garage.length) {
    ownedPanel.classList.remove('is-empty');
    renderMarketOwnedTrendsSection({ container: ownedGrid, state, fmt, isSellConfirm, onSellClickById });
  } else {
    ownedPanel.classList.add('is-empty');
    ownedGrid.innerHTML = '';
    ownedGrid.appendChild(el('div', { class: 'subtle', text: 'No cars owned yet.' }));
  }

  renderMarketAllTrendsSection({ container: allGrid, state, MODELS, fmt, modelId, ensureModelTrends });
}

export function updateMarketPricesAndTrendsUI({ state, MODELS, fmt, modelId, drawSparkline }) {
  for (const car of state.illegalMarket) {
    const priceEl = document.querySelector(`[data-car-price="${car.id}"]`);
    if (priceEl) priceEl.textContent = fmt.format(car.price);
    const tpriceEl = document.querySelector(`[data-car-tprice="${car.id}"]`);
    if (tpriceEl) tpriceEl.textContent = fmt.format(car.price);
    const canvas = document.querySelector(`canvas[data-car-spark="${car.id}"]`);
    if (canvas) drawSparkline(canvas, car.priceHistory || [car.price], '#57b6ff');
  }
  for (const car of (state.garage || [])) {
    const tpriceEl = document.querySelector(`[data-own-tprice="${car.id}"]`);
    if (tpriceEl) tpriceEl.textContent = fmt.format(car.valuation ?? 0);
    const canvas = document.querySelector(`canvas[data-own-spark="${car.id}"]`);
    if (canvas) {
      const pts = (car.valuationHistory && car.valuationHistory.length) ? car.valuationHistory : [(car.valuation ?? 0)];
      drawSparkline(canvas, pts, '#7ee787');
    }
    const plEl = document.querySelector(`[data-own-pl="${car.id}"]`);
    if (plEl) {
      const profit = (car.valuation ?? 0) - (car.boughtPrice ?? 0);
      plEl.textContent = `${profit >= 0 ? '+' : ''}${fmt.format(profit)}`;
      plEl.className = 'tag ' + (profit >= 0 ? 'ok' : 'bad');
    }
  }
  for (const m of MODELS) {
    const mid = modelId(m.model);
    const points = state.modelTrends[m.model] || [m.basePrice];
    const curVal = points[points.length - 1] || m.basePrice;
    const pEl = document.querySelector(`[data-model-price="${mid}"]`);
    if (pEl) pEl.textContent = fmt.format(curVal);
    const c = document.querySelector(`canvas[data-model-spark="${mid}"]`);
    if (c) drawSparkline(c, points, '#9aa4ff');
  }
}

export function renderGarageView({ state, PARTS, fmt, modelId, isSellConfirm, onSellClickById, onRaceCar, onOpenImagePicker, isCarOpen, onToggleCarOpen, avgCondition, conditionStatus }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const capUsed = state.garage.length;
  const capMax = 1 + (state.garagesPurchased || 0);
  const header = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Storage' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `${capUsed}/${capMax} slots used` }),
      el('span', { class: 'hidden', text: '' })
    ])
  ]);
  view.appendChild(header);
  if (!state.garage.length) {
    view.appendChild(el('div', { class: 'panel notice', text: 'No cars yet. Buy from the Illegal Market.' }));
    return;
  }
  for (const [idx, car] of state.garage.entries()) {
    const avg = Math.round(avgCondition(car));
    const st = conditionStatus(avg);
    const header = el('div', { class: 'row' }, [
      el('h3', { text: `${car.model} ` }),
      el('span', { class: `tag ${stCls}`, text: `${avg}%` }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `Perf ${car.perf}` }),
      (() => { const b = el('button', { class: 'toggle', text: isCarOpen(car.id) ? 'Hide Details ▴' : 'Show Details ▾' }); b.onclick = () => onToggleCarOpen(car.id); return b; })(),
    ]);
    const breakdown = renderCarBreakdown({ car, idx, state, PARTS, modelId });
    const collapsible = el('div', { class: 'collapsible ' + (isCarOpen(car.id) ? 'open' : '') }, [ el('div', { class: 'content' }, [breakdown]) ]);
    const sellBtn = el('button', { class: 'btn danger', text: isSellConfirm(car.id) ? 'Are you sure?' : 'Sell' });
    sellBtn.onclick = () => onSellClickById(car.id, sellBtn);
    const raceBtn = el('button', { class: 'btn good', text: 'Race', onclick: () => onRaceCar(idx) });
    const upBtn = el('button', { class: 'btn', text: 'Upload Photo', onclick: () => onOpenImagePicker(car.model) });
    const actions = el('div', { class: 'row' }, [ sellBtn, raceBtn, upBtn ]);
    const card = el('div', { class: 'panel' }, [ header, collapsible, actions ]);
    view.appendChild(card);
  }
}
