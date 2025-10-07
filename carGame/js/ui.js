// Minimal UI helpers shared across views

export function getIconSVG(name) {
  const wrap = (txt) => `<span class="icon">${txt}</span>`;
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
    case 'chart': return wrap('📈');
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
  for (const c of children) e.appendChild(c);
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
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 240);
    }, timeoutMs);
  }
}

// Render top navigation and options popover
export function renderNavUI({ state, currentView, navItems, onSetView, onToggleOptions, onHideOptions, onToggleDev, onNewGame, currencyCode = 'USD', currencies = [['USD','US Dollar'], ['GBP','British Pound'], ['EUR','Euro'], ['JPY','Japanese Yen'], ['PLN','Polish Złoty']], onSetCurrency = null, onGoHome = null, onSetSound, onSetVolume, onTestSound }) {
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
  const cogBtn = document.createElement('button');
  cogBtn.setAttribute('aria-label', 'Options');
  cogBtn.innerHTML = getIconSVG('cog') + '<span class="label">Options</span>';
  cogBtn.onclick = onToggleOptions;
  right.appendChild(cogBtn);

  const pop = document.createElement('div');
  pop.id = 'optionsPop';
  pop.className = 'options-pop' + (state.ui && state.ui.showOptions ? ' open' : '');
  // Currency selector
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Options';
  pop.appendChild(title);
  const row = document.createElement('div');
  row.className = 'row';
  const sel = document.createElement('select');
  currencies.forEach(([code, name]) => {
    const o = document.createElement('option');
    o.value = code; o.textContent = `${code} — ${name}`; if (currencyCode === code) o.selected = true; sel.appendChild(o);
  });
  sel.onchange = () => { onSetCurrency && onSetCurrency(sel.value); };
  row.appendChild(sel);
  pop.appendChild(row);
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
  pop.appendChild(snd);
  // Divider
  const div1 = document.createElement('div');
  div1.className = 'divider';
  pop.appendChild(div1);
  // New Game
  const newBtn = document.createElement('button');
  newBtn.className = 'btn warn';
  newBtn.textContent = 'New Game';
  newBtn.onclick = () => { onNewGame(); onHideOptions(); };
  pop.appendChild(newBtn);
  // Divider
  const div2 = document.createElement('div');
  div2.className = 'divider';
  pop.appendChild(div2);
  // Dev Tools toggle
  const devBtn2 = document.createElement('button');
  devBtn2.className = 'btn';
  devBtn2.textContent = (state.ui && state.ui.showDev) ? 'Hide Dev Tools' : 'Show Dev Tools';
  devBtn2.onclick = () => { onToggleDev(); onHideOptions(); };
  pop.appendChild(devBtn2);

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
export function drawSparkline(canvas, points, color = '#57b6ff') {
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
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 6;
  const n = points.length;
  const xFor = (i) => pad + (w - 2 * pad) * (i / Math.max(1, (n - 1)));
  const yFor = (v) => {
    if (max === min) return h / 2;
    const t = (v - min) / (max - min);
    return h - pad - (h - 2 * pad) * t;
  };
  // background grid line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yFor(points[0]));
  ctx.lineTo(w, yFor(points[0]));
  ctx.stroke();
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
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 260');
  svg.setAttribute('class', 'car-silhouette');
  const group = document.createElementNS(svgNS, 'g');
  group.setAttribute('class', 'car-group');
  group.setAttribute('transform', 'translate(60,18) scale(0.78)');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('class', 'silhouette-path');
  const body = getBodyStyle(car.model);
  path.setAttribute('d', getSilhouettePath(body));
  let imgSrc = state.assets && state.assets.modelImages && state.assets.modelImages[car.model];
  const slug = modelId(car.model);
  const styleSlug = '_' + getBodyStyle(car.model);
  const candidates = [
    imgSrc,
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
  group.appendChild(path);
  svg.appendChild(group);
  box.appendChild(svg);
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
    if (container) layoutCarBreakdown(container);
  }
  saveState && saveState();
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

export function renderGarageFullView({ state, PARTS, fmt, modelId, avgCondition, conditionStatus, isCarOpen, onToggleCarOpen, isSellConfirm, onSellClickById, onRaceCar, onOpenImagePicker, onRepairCar, garageCapacity, nextGarageCost, onBuyGarageSlot, saveState }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const capUsed = state.garage.length;
  const capMax = garageCapacity();
  const costNext = nextGarageCost();
  const capPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Storage' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `${capUsed}/${capMax} slots used` }),
      el('span', { class: 'hidden', text: '' })
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn primary', text: `Buy Slot (${fmt.format(costNext)})`, onclick: () => onBuyGarageSlot(), disabled: false }),
    ]),
  ]);
  view.appendChild(capPanel);
  if (!state.garage.length) {
    view.appendChild(el('div', { class: 'panel notice', text: 'No cars yet. Buy from the Illegal Market.' }));
    return;
  }

  // Helper for callout rows
  const badgeCls = (v) => v >= 70 ? 'ok' : v >= 50 ? 'info' : 'bad';
  const addRow = (container, label, key, carId, idx) => {
    const car = state.garage[idx];
    const cond = Math.round(car.parts[key] ?? 100);
    const open = isPartActionsOpenUI(state, carId, key);
    const row = el('div', { class: 'row part' }, [
      el('span', { text: label }),
      el('div', { class: 'spacer' }),
      (() => { const t = el('span', { class: 'part-toggle' + (open ? ' active' : ''), title: 'Repair', text: '🔧' }); t.onclick = () => togglePartActionsUI({ state, carId, key, toggleEl: t, saveState }); return t; })(),
      el('span', { class: `pct-badge ${badgeCls(cond)}`, text: `${cond}%` }),
    ]);
    container.appendChild(row);
    const actions = el('div', { class: 'part-actions', style: open && cond < 100 ? '' : 'display:none' }, [
      el('button', { class: 'btn sm', ['data-gprice']: 'legal', ['data-part']: key, text: `Legal ${fmt.format(state.partsPrices.legal[key])}`, onclick: () => onRepairCar(idx, key, 'legal') }),
      el('button', { class: 'btn warn sm', ['data-gprice']: 'illegal', ['data-part']: key, text: `Illegal ${fmt.format(state.partsPrices.illegal[key])}`, onclick: () => onRepairCar(idx, key, 'illegal') }),
    ]);
    actions.setAttribute('data-actions-for', `${carId}:${key}`);
    container.appendChild(actions);
  };

  for (const [idx, car] of state.garage.entries()) {
    const avg = Math.round(avgCondition(car));
    const st = conditionStatus(avg);
    const val = Math.max(0, Math.round(car.valuation ?? car.basePrice ?? 0));
    const profit = val - (car.boughtPrice ?? 0);
    const header = el('div', { class: 'row garage-header' }, [
      el('h3', { text: `${car.model} ` }),
      el('span', { class: `tag ${st.cls}`, text: st.label + ` (${avg}%)` }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: `Perf ${car.perf}` }),
      el('span', { class: 'tag info', text: `Val ${fmt.format(val)}` }),
      el('span', { class: `tag ${profit >= 0 ? 'ok' : 'bad'}`, text: `${profit >= 0 ? '+' : ''}${fmt.format(profit)}` }),
      (() => { const b = el('button', { class: 'toggle', text: isCarOpen(car.id) ? 'Hide Details ▴' : 'Show Details ▾' }); b.onclick = () => onToggleCarOpen(car.id); return b; })(),
    ]);

    // Build breakdown with silhouette and action callouts
    const box = renderCarBreakdown({ car, idx, state, PARTS, modelId });
    // Engine callouts
    const engine = el('div', { class: 'callout', style: 'left:2%; top:12%;'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Engine' }) ]) ]);
    addRow(engine, 'Engine Block', 'engine_block', car.id, idx);
    addRow(engine, 'Induction', 'induction', car.id, idx);
    addRow(engine, 'Fuel System', 'fuel_system', car.id, idx);
    addRow(engine, 'Cooling', 'cooling', car.id, idx);
    addRow(engine, 'Ignition', 'ignition', car.id, idx);
    addRow(engine, 'Timing', 'timing', car.id, idx);
    addRow(engine, 'Alternator', 'alternator', car.id, idx);
    addRow(engine, 'ECU', 'ecu', car.id, idx);
    box.appendChild(engine);

    // Drivetrain
    const drive = el('div', { class: 'callout', style: 'left:42%; top:4%;'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Drivetrain' }) ]) ]);
    addRow(drive, 'Transmission', 'transmission', car.id, idx);
    addRow(drive, 'Clutch', 'clutch', car.id, idx);
    addRow(drive, 'Differential', 'differential', car.id, idx);
    box.appendChild(drive);

    // Running gear
    const running = el('div', { class: 'callout', style: 'right:2%; top:10%;'}, [ el('div', { class: 'title' }, [ el('span', { text: 'Running Gear' }) ]) ]);
    addRow(running, 'Suspension', 'suspension', car.id, idx);
    addRow(running, 'Tires', 'tires', car.id, idx);
    addRow(running, 'Brakes', 'brakes', car.id, idx);
    addRow(running, 'Exhaust', 'exhaust', car.id, idx);
    addRow(running, 'Battery', 'battery', car.id, idx);
    addRow(running, 'Interior Elec.', 'electronics', car.id, idx);
    box.appendChild(running);

    const collapsible = el('div', { class: 'collapsible ' + (isCarOpen(car.id) ? 'open' : '') }, [ el('div', { class: 'content' }, [box]) ]);

    const sellBtn = el('button', { class: 'btn danger', text: isSellConfirm(car.id) ? 'Are you sure?' : 'Sell' });
    sellBtn.onclick = () => onSellClickById(car.id, sellBtn);
    const raceBtn = el('button', { class: 'btn good', text: 'Race', onclick: () => onRaceCar(idx) });
    const upBtn = el('button', { class: 'btn', text: 'Upload Photo', onclick: () => onOpenImagePicker(car.model) });
    const actions = el('div', { class: 'row garage-actions' }, [ sellBtn, raceBtn, upBtn ]);

    const card = el('div', { class: 'panel garage-card' }, [ header, collapsible, actions ]);
    view.appendChild(card);
  }

  // Ensure breakdown heights
  requestAnimationFrame(() => {
    document.querySelectorAll('.car-breakdown').forEach(layoutCarBreakdown);
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

export function renderRacesView({ state, PARTS, avgCondition, conditionStatus, canRace, onRaceCar }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  if (!state.garage.length) {
    view.appendChild(el('div', { class: 'panel notice', text: 'No cars to race. Buy one first.' }));
    return;
  }
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [ el('h3', { text: 'Organize Street Race' }), el('div', { class: 'spacer' }) ]),
    el('table', {}, [
      el('thead', {}, [ el('tr', {}, [
        el('th', { text: 'Car' }),
        el('th', { text: 'Perf' }),
        el('th', { text: 'Condition' }),
        el('th', { text: '' }),
      ])]),
      el('tbody', {}, state.garage.map((car, idx) => {
        const avg = Math.round(avgCondition(car));
        const st = conditionStatus(avg);
        const condTag = car.failed ? el('span', { class: 'tag bad', text: 'Failed' }) : el('span', { class: `tag ${st.cls}`, text: `${st.label} (${avg}%)` });
        const broken = PARTS.find(p => (car.parts[p.key] ?? 100) < 60);
        const condCell = broken
          ? [ condTag, el('div', { class: 'subtle', text: `Needs replacing: ${broken.name}` }) ]
          : [ condTag ];
        return el('tr', {}, [
          el('td', { text: car.model }),
          el('td', { text: String(car.perf) }),
          el('td', {}, condCell),
          el('td', {}, [ el('button', { class: 'btn good', text: 'Race', onclick: () => onRaceCar(idx), disabled: !canRace(car) }) ]),
        ]);
      }))
    ])
  ]);
  view.appendChild(panel);
}

export function renderMarketView({ state, PARTS, MODELS, fmt, modelId, ensureModelTrends, onBuyCar }) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const panel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Illegal Market — Cars' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Live' }),
    ]),
    el('div', {}, [
      el('table', {}, [
        el('thead', {}, [ el('tr', {}, [
          el('th', { text: 'Model' }),
          el('th', { text: 'Perf' }),
          el('th', { text: 'Condition' }),
          el('th', { text: 'Price' }),
          el('th', { text: '' }),
        ]) ]),
        el('tbody', {}, state.illegalMarket.map((car, idx) => {
          const avg = Math.round(PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length);
          const condNode = renderMarketCondition(avg, state.level);
          return el('tr', {}, [
            el('td', { text: car.model }),
            el('td', { text: String(car.perf) }),
            el('td', {}, [condNode]),
            el('td', {}, [ el('span', { ['data-car-price']: car.id, text: fmt.format(car.price) }) ]),
            el('td', {}, [ el('button', { class: 'btn good', onclick: () => onBuyCar(idx), text: 'Buy' }) ]),
          ]);
        }))
      ])
    ])
  ]);
  view.appendChild(panel);

  // Price trends area
  const trends = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'Price Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Auto-updating' }),
    ]),
    el('div', { class: 'grid' }, state.illegalMarket.map((car) => {
      const card = el('div', { class: 'panel' }, [
        el('div', { class: 'row' }, [
          el('strong', { text: car.model }),
          el('div', { class: 'spacer' }),
          el('span', { class: 'tag info', ['data-car-tprice']: car.id, text: fmt.format(car.price) }),
        ]),
        (() => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 80; c.style.width = '100%'; c.style.height = '80px';
          c.setAttribute('data-car-spark', car.id);
          setTimeout(() => drawSparkline(c, car.priceHistory || [car.price], '#57b6ff'), 0);
          return c;
        })(),
      ]);
      return card;
    }))
  ]);
  view.appendChild(trends);

  // Owned cars price trends (if any)
  if (state.garage && state.garage.length) {
    const owned = el('div', { class: 'panel' }, [
      el('div', { class: 'row' }, [
        el('h3', { text: 'Your Cars — Price Trends' }),
        el('div', { class: 'spacer' }),
        el('span', { class: 'subtle', text: 'Auto-updating' }),
      ]),
      el('div', { class: 'grid' }, state.garage.map((car) => {
        const card = el('div', { class: 'panel' }, [
          el('div', { class: 'row' }, [
            el('strong', { text: car.model }),
            el('div', { class: 'spacer' }),
            el('span', { class: 'tag ok', ['data-own-tprice']: car.id, text: fmt.format(car.valuation ?? 0) }),
            (() => {
              const profit = (car.valuation ?? 0) - (car.boughtPrice ?? 0);
              const cls = profit >= 0 ? 'tag ok' : 'tag bad';
              return el('span', { class: cls, ['data-own-pl']: car.id, text: `${profit >= 0 ? '+' : ''}${fmt.format(profit)}` });
            })(),
          ]),
          (() => {
            const c = document.createElement('canvas');
            c.width = 320; c.height = 80; c.style.width = '100%'; c.style.height = '80px';
            c.setAttribute('data-own-spark', car.id);
            const pts = (car.valuationHistory && car.valuationHistory.length) ? car.valuationHistory : [(car.valuation ?? 0)];
            setTimeout(() => drawSparkline(c, pts, '#7ee787'), 0);
            return c;
          })(),
        ]);
        return card;
      }))
    ]);
    view.appendChild(owned);
  }

  // All models trends
  const pinnedOrder = [];
  for (const car of state.illegalMarket) if (!pinnedOrder.includes(car.model)) pinnedOrder.push(car.model);
  const allModels = MODELS.map(m => m.model).filter(m => !pinnedOrder.includes(m));
  const ordered = pinnedOrder.concat(allModels);
  ensureModelTrends();
  const allPanel = el('div', { class: 'panel' }, [
    el('div', { class: 'row' }, [
      el('h3', { text: 'All Cars — Trends' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'subtle', text: 'Pinned: In Shop' }),
    ]),
    el('div', { class: 'grid' }, ordered.map((name) => {
      const mid = modelId(name);
      const m = MODELS.find(mm => mm.model === name);
      const points = state.modelTrends[name] || [m ? m.basePrice : 0];
      const curVal = points[points.length - 1] || (m ? m.basePrice : 0);
      const pinned = pinnedOrder.includes(name);
      const card = el('div', { class: 'panel' }, [
        el('div', { class: 'row' }, [
          el('strong', { text: name }),
          el('div', { class: 'spacer' }),
          pinned ? el('span', { class: 'tag ok', text: 'In Shop' }) : el('span', { class: 'tag', text: 'Index' }),
          el('span', { class: 'tag info', ['data-model-price']: mid, text: fmt.format(curVal) }),
        ]),
        (() => {
          const c = document.createElement('canvas');
          c.width = 320; c.height = 80; c.style.width = '100%'; c.style.height = '80px';
          c.setAttribute('data-model-spark', mid);
          setTimeout(() => drawSparkline(c, points, '#9aa4ff'), 0);
          return c;
        })(),
      ]);
      return card;
    }))
  ]);
  view.appendChild(allPanel);
}

export function updateMarketPricesAndTrendsUI({ state, MODELS, fmt, modelId }) {
  for (const car of state.illegalMarket) {
    const priceEl = document.querySelector(`[data-car-price="${car.id}"]`);
    if (priceEl) priceEl.textContent = fmt.format(car.price);
    const tpriceEl = document.querySelector(`[data-car-tprice="${car.id}"]`);
    if (tpriceEl) tpriceEl.textContent = fmt.format(car.price);
    const canvas = document.querySelector(`canvas[data-car-spark="${car.id}"]`);
    if (canvas) drawSparkline(canvas, car.priceHistory || [car.price], '#57b6ff');
  }
  for (const car of state.garage) {
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

export function renderGarageView({ state, PARTS, fmt, modelId, isSellConfirm, onSellClickById, onRaceCar, onOpenImagePicker, isCarOpen, onToggleCarOpen }) {
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
    const avg = Math.round(PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length);
    const stCls = avg >= 80 ? 'ok' : avg >= 60 ? 'info' : 'bad';
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
