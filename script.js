/* ---------- simple global to avoid TDZ error ---------- */
var collectionRendered = false;
var bindersRendered = false;
var OldCollection = { data: [], loaded: false };

/* ---------- typewriter prompt ---------- */
const typed = document.getElementById('typed');
const msg = ' welcome to zdrojewski.dev — type: home | projects | cv | collection | binders';
let i = 0;
function typeNext(){ if (i <= msg.length){ typed.textContent = msg.slice(0, i++); setTimeout(typeNext, 18); } }
window.addEventListener('DOMContentLoaded', typeNext);

/* ---------- router ---------- */
const links = [...document.querySelectorAll('nav.commands a')];
const panels = {
  home: document.getElementById('home'),
  projects: document.getElementById('projects'),
  cv: document.getElementById('cv'),
  collection: document.getElementById('collection'),
  binders: document.getElementById('binders')
};
function parseHash(){
  const raw = String(location.hash || '#home');
  const [base, qs] = raw.split('?');
  const route = (base || '#home').replace('#','') || 'home';
  const params = new URLSearchParams(qs || '');
  return { route, params };
}
function writeHash(route, params){
  const qs = params && [...params.entries()].length ? (`?${params.toString()}`) : '';
  const next = `#${route}${qs}`;
  if (location.hash !== next) location.hash = next;
}
function setRoute(r){
  const parsed = parseHash();
  const route = (r || parsed.route || 'home');
  Object.values(panels).forEach(p => p && p.classList.remove('active'));
  (panels[route] || panels.home).classList.add('active');
  links.forEach(a => a.classList.toggle('active', a.dataset.route === route));
  links.forEach(a => a.setAttribute('aria-current', a.dataset.route === route ? 'page' : 'false'));
  // Highlight dropdown trigger when a child route is active
  const drop = document.querySelector('.drop-trigger');
  if (drop) drop.classList.toggle('active', route === 'collection' || route === 'binders');
  if (drop) drop.setAttribute('aria-expanded', 'false');
  // Close mobile menu on navigation
  const hb = document.getElementById('hamburger');
  if (hb) hb.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  if (route === 'collection') initCollection(); // lazy
  if (route === 'binders') initBinders(parsed.params); // lazy, pass params
  try { localStorage.setItem('route', route); } catch(_) {}
}
window.addEventListener('hashchange', () => setRoute());
setRoute(localStorage.getItem('route') || parseHash().route);

/* Mobile-friendly dropdown: tap to open/close */
function setupDropdownBehavior(){
  const wrap = document.querySelector('nav.commands .dropdown');
  const trig = document.querySelector('nav.commands .drop-trigger');
  if (!wrap || !trig || trig._bound) return;
  const stopOnly = (e)=>{ e.stopPropagation(); };
  const menu = wrap.querySelector('.drop-menu');
  if (menu){ ['click'].forEach(t=> menu.addEventListener(t, (e)=> e.stopPropagation(), { passive:false })); }
  let lastToggle = 0;
  trig.addEventListener('click', (e)=>{
    stopOnly(e);
    const isOpen = wrap.classList.toggle('open'); lastToggle = Date.now();
    trig.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    // ignore immediate ghost/outside clicks just after opening
    if (Date.now() - lastToggle < 250) return;
    if (!wrap.contains(e.target)){
      wrap.classList.remove('open');
      trig.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){
      wrap.classList.remove('open');
      trig.setAttribute('aria-expanded', 'false');
      trig.blur();
    }
  });
  trig._bound = true;
}
window.addEventListener('DOMContentLoaded', setupDropdownBehavior);

/* Hamburger menu (mobile) */
function setupHamburger(){
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav || btn._bound) return;
  const toggle = () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); if (document.body.classList.contains('menu-open')) { const first = document.querySelector('#main-nav a, #main-nav .drop-trigger'); if (first) first.focus(); } });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && e.target !== btn){
      document.body.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 600){
      document.body.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
  btn._bound = true;
}
window.addEventListener('DOMContentLoaded', setupHamburger);

/* ---- CV: Generate downloadable PDF from page content ---- */
function loadScript(src){
  return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
}
async function ensureHtml2PdfLoaded(){
  if (typeof window.html2pdf !== 'undefined') return true;
  try { await loadScript('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js'); } catch(_) {}
  if (typeof window.html2pdf !== 'undefined') return true;
  try { await loadScript('vendor/html2pdf.bundle.min.js'); } catch(_) {}
  return typeof window.html2pdf !== 'undefined';
}
async function downloadCvPdf(){
  try{
    const el = document.getElementById('cv');
    if (!el) { alert('CV section not found'); return; }
    const ok = await ensureHtml2PdfLoaded();
    if (!ok){ alert('PDF generator not available. Add vendor/html2pdf.bundle.min.js or retry online.'); return; }
    // Scale the on-screen CV to fit one A4 page and render it with a big virtual viewport
    const MM_TO_PX = 3.7795275591; // 96dpi
    const a4 = { wmm:210, hmm:297 };
    const margin = { top:10, right:10, bottom:10, left:10 };
    const pageHpx = Math.floor((a4.hmm - margin.top - margin.bottom) * MM_TO_PX); // ~1046px

    // Save and adjust styles
    const prev = { transform: el.style.transform, origin: el.style.transformOrigin, width: el.style.width };
    el.classList.add('cv-export');
    const contentH = el.scrollHeight;
    let scale = 1; if (contentH > pageHpx) scale = pageHpx / contentH;
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${scale})`;
    el.style.width = `${100/scale}%`;

    const windowWidth = Math.max(document.documentElement.clientWidth, el.scrollWidth);
    const windowHeight = Math.max(document.documentElement.clientHeight, el.scrollHeight);
    const opt = {
      margin:[margin.top, margin.left, margin.bottom, margin.right],
      filename:'Hubert_Zdrojewski_CV.pdf',
      image:{type:'jpeg',quality:0.98},
      html2canvas:{scale:2,useCORS:true,backgroundColor:'#FFFFFF',windowWidth,windowHeight,scrollX:0,scrollY:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };
    await html2pdf().from(el).set(opt).save();
    // Restore styles
    el.style.transform = prev.transform; el.style.transformOrigin = prev.origin; el.style.width = prev.width;
    el.classList.remove('cv-export');
  }catch(e){ console.error(e); alert('Failed to generate PDF.'); }
}

/* ---------- fake terminal input (don’t steal focus) ---------- */
const screen = document.getElementById('screen');
let buffer = '';
const isTouchDevice = (('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0 || (navigator.msMaxTouchPoints||0) > 0);
function isFormField(el){
  if (!el) return false;
  // Direct interactive elements
  if (el.matches && el.matches('input,select,textarea,button,label,a,.btn')) return true;
  // Within interactive/control regions
  const hit = el.closest && el.closest('input,select,textarea,button,label,a,.btn,.collect-open,.collect-controls,.binders-controls,.binders-pages,.binders-lang,.dropdown,.drop-menu');
  if (hit) return true;
  // Content editable
  return !!el.isContentEditable;
}
// On touch devices (iOS Safari), do NOT force focus to avoid closing native pickers
screen.addEventListener('click', (e) => {
  if (isTouchDevice) return;
  if (isFormField(e.target)) return;
  screen.focus();
});
// Additional guard: while a select is focused, suppress screen focusing
// no-op guards removed; focus is not forced on touch devices
screen.addEventListener('keydown', (e) => {
  if (isFormField(e.target)) return;
  if (e.key === 'Enter') {
    const cmd = buffer.trim().toLowerCase();
    if (['home','projects','cv','collection','binders'].includes(cmd)) location.hash = cmd;
    else if (cmd) alert('command not found: ' + cmd);
    buffer = ''; typed.textContent = ''; i = 0; typeNext(); e.preventDefault(); return;
  }
  if (e.key === 'Backspace') { buffer = buffer.slice(0, -1); typed.textContent = buffer; e.preventDefault(); return; }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { buffer += e.key; typed.textContent = buffer; }
});
links.forEach(a => a.addEventListener('click', () => setTimeout(() => screen.focus(), 0)));
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

/* ----- Mobile custom dropdown (sheet) for selects ----- */
function isMobileView(){
  return (('ontouchstart' in window) || (navigator.maxTouchPoints||0) > 0) && window.matchMedia('(max-width: 600px)').matches;
}
function setupMobileDropdowns(){
  if (!isMobileView()) return;
  // Binders set dropdown
  enhanceSelectAsSheet(document.getElementById('binders-select'), 'Choose set');
  // Collection set dropdown
  enhanceSelectAsSheet(document.querySelector('.collect-set'), 'Filter by set');
  // Collection language + sort dropdowns
  enhanceSelectAsSheet(document.querySelector('.collect-lang'), 'Language');
  enhanceSelectAsSheet(document.querySelector('.collect-sort'), 'Sort');
  // Collection search input
  enhanceInputAsSheet(document.querySelector('.collect-search'), 'Search');
}
function enhanceSelectAsSheet(sel, title){
  if (!sel || sel._mobileEnhanced) return;
  sel.classList.add('select-mobile-hidden');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mobile-dd-btn';
  const syncLabel = ()=>{ const opt = sel.options[sel.selectedIndex]; btn.textContent = opt ? opt.text : (title||'Select'); };
  syncLabel();
  sel.parentNode.insertBefore(btn, sel.nextSibling);
  btn.addEventListener('click', ()=> openSheetForSelect(sel, title, syncLabel));
  sel._mobileEnhanced = true;
}
function openSheetForSelect(sel, title, syncLabel){
  const ov = document.createElement('div'); ov.className = 'sheet-overlay';
  const panel = document.createElement('div'); panel.className = 'sheet-panel'; ov.appendChild(panel);
  const hdr = document.createElement('div'); hdr.className = 'sheet-header'; hdr.textContent = title || 'Choose'; panel.appendChild(hdr);
  const ul = document.createElement('ul'); ul.className = 'sheet-list'; panel.appendChild(ul);
  for (let i=0;i<sel.options.length;i++){
    const o = sel.options[i];
    const li = document.createElement('li'); li.className = 'sheet-item' + (i===sel.selectedIndex?' active':'');
    li.textContent = o.text || o.value || '';
    li.addEventListener('click', ()=>{
      sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); syncLabel && syncLabel(); document.body.removeChild(ov);
    });
    ul.appendChild(li);
  }
  ov.addEventListener('click', (e)=>{ if (e.target === ov) document.body.removeChild(ov); });
  document.body.appendChild(ov);
}
function enhanceInputAsSheet(input, title){
  if (!input || input._mobileEnhanced) return;
  input.classList.add('input-mobile-hidden');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mobile-dd-btn';
  const syncLabel = ()=>{
    const v = String(input.value||'').trim();
    btn.textContent = v ? `Search: ${v}` : (title || 'Search…');
  };
  syncLabel();
  input.parentNode.insertBefore(btn, input.nextSibling);
  btn.addEventListener('click', ()=> openSheetForInput(input, title, syncLabel));
  input._mobileEnhanced = true;
}
function openSheetForInput(input, title, syncLabel){
  const ov = document.createElement('div'); ov.className = 'sheet-overlay';
  const panel = document.createElement('div'); panel.className = 'sheet-panel'; ov.appendChild(panel);
  const hdr = document.createElement('div'); hdr.className = 'sheet-header'; hdr.textContent = title || 'Search'; panel.appendChild(hdr);
  const body = document.createElement('div'); body.className = 'sheet-body'; panel.appendChild(body);
  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'sheet-input';
  field.value = String(input.value||'');
  field.placeholder = 'Type to search…';
  field.autocapitalize = 'none';
  field.autocorrect = 'off';
  field.spellcheck = false;
  body.appendChild(field);
  const actions = document.createElement('div'); actions.className = 'sheet-actions'; body.appendChild(actions);
  const applyBtn = document.createElement('button'); applyBtn.className = 'btn'; applyBtn.type = 'button'; applyBtn.textContent = 'Apply'; actions.appendChild(applyBtn);
  const clearBtn = document.createElement('button'); clearBtn.className = 'btn'; clearBtn.type = 'button'; clearBtn.textContent = 'Clear'; actions.appendChild(clearBtn);
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel'; actions.appendChild(cancelBtn);
  applyBtn.addEventListener('click', ()=>{ input.value = field.value; input.dispatchEvent(new Event('input')); syncLabel && syncLabel(); document.body.removeChild(ov); });
  clearBtn.addEventListener('click', ()=>{ input.value = ''; input.dispatchEvent(new Event('input')); syncLabel && syncLabel(); document.body.removeChild(ov); });
  cancelBtn.addEventListener('click', ()=> document.body.removeChild(ov));
  ov.addEventListener('click', (e)=>{ if (e.target === ov) document.body.removeChild(ov); });
  document.body.appendChild(ov);
  const focusField = () => { try{ field.focus({ preventScroll: true }); const L = field.value.length; field.setSelectionRange(L, L); }catch(_){} };
  // Try a few times to appease iOS focus quirks
  focusField();
  setTimeout(focusField, 0);
  setTimeout(focusField, 150);
  try{ field.click(); }catch(_){ }
}
document.addEventListener('DOMContentLoaded', setupMobileDropdowns);
// removed extra select guards; rely on touch focus bypass instead

/* =========================
   Collection data + filters
   ========================= */

/* Resolve cards.json absolutely (handles spaces / [brackets] in path)
   Also support fallback to archived file (several case/spelling variants for safety on case‑sensitive hosts) */
const CARDS_URLS = [ new URL('cache/cards.json', location.href).toString() ];
const BASELINE_URLS = [
  'cache/Old_cards/cards.json',
  'cache/old_cards/cards.json',
  'cache/Old_Cards/cards.json',
  'cache/old-cards/cards.json'
].map(p => new URL(p, location.href).toString());
var collectionSource = 'current'; // 'current' | 'old'

function showStatus(msg, withRetry=false){
  const grid = document.getElementById('collect-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="kv" style="opacity:.85">${msg}</div>`;
  if (withRetry){
    const btn = document.createElement('button');
    btn.className = 'btn'; btn.textContent = 'Retry';
    btn.style.marginTop = '8px'; btn.addEventListener('click', () => initCollection(true));
    grid.firstElementChild.appendChild(document.createElement('br'));
    grid.firstElementChild.appendChild(btn);
  }
}

async function loadCollectionData(timeoutMs = 20000) {
  let lastErr = null;
  for (let i = 0; i < CARDS_URLS.length; i++){
    const url = CARDS_URLS[i];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    console.time(`[collection] fetch ${i===0?'current':'old'} cards.json`);
    console.log('[collection] fetching:', url);
    try{
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      console.log('[collection] response:', res.status, res.statusText);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let json;
      try { json = await res.json(); }
      catch(e){
        const txt = await res.text();
        console.error('[collection] JSON parse error. First 200 chars:', txt.slice(0,200));
        throw new Error('cards.json not valid JSON');
      }
      // normalize: array or {data:[]}/{cards:[]}/object-map
      let data = [];
      if (Array.isArray(json)) data = json;
      else if (json && Array.isArray(json.data)) data = json.data;
      else if (json && Array.isArray(json.cards)) data = json.cards;
      else if (json && typeof json === 'object')
        data = Object.values(json).filter(v => v && typeof v === 'object' && (('Name' in v) || ('lookupID' in v)));
      console.log('[collection] loaded rows:', data.length);
      collectionSource = 'current';
      return Array.isArray(data) ? data : [];
    }catch(err){
      console.warn('[collection] failed to load from', url, err);
      lastErr = err;
    }finally{
      clearTimeout(t);
      console.timeEnd(`[collection] fetch ${i===0?'current':'old'} cards.json`);
    }
  }
  throw lastErr || new Error('Failed to load cards.json from all sources');
}

async function loadOldCollectionData(timeoutMs = 20000){
  for (const url of BASELINE_URLS){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      console.log('[collection] fetching baseline old cards:', url);
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let json = await res.json();
      let data = [];
      if (Array.isArray(json)) data = json;
      else if (json && Array.isArray(json.data)) data = json.data;
      else if (json && Array.isArray(json.cards)) data = json.cards;
      else if (json && typeof json === 'object')
        data = Object.values(json).filter(v => v && typeof v === 'object' && (('Name' in v) || ('lookupID' in v)));
      OldCollection.data = Array.isArray(data) ? data : [];
      OldCollection.loaded = true;
      console.log('[collection] baseline rows:', OldCollection.data.length, 'from', url);
      return;
    }catch(e){ console.warn('[collection] baseline not available at', url, e.message || e); }
  }
}

/* =========================
   Binders (gallery from CSV)
   ========================= */

const Binders = {
  config: [],
  cache: new Map(), // fileName -> { name, link, cards }
  currentFile: null,
  pageSize: 9,
  ownedQty: new Map(), // canonical lookup -> quantity
  currentPage: 0,
  totalPages: 1,
  lang: 'english',
  els: {
    status: () => document.getElementById('binders-status'),
    content: () => document.getElementById('binders-content'),
    select: () => document.getElementById('binders-select'),
    pageRadios: () => document.querySelectorAll('input[name="binders-pages"]'),
    prevBtn: () => document.getElementById('binders-prev'),
    nextBtn: () => document.getElementById('binders-next'),
    pageIndicator: () => document.getElementById('binders-page-indicator')
  }
};

function setBindersStatus(msg){
  const s = document.getElementById('binders-status');
  if (s) s.innerHTML = String(msg || '');
}

function computeSetStats(cards){
  const total = Array.isArray(cards) ? cards.length : 0;
  let owned = 0;
  if (total){
    for (const c of cards){
      const qty = Binders.ownedQty.get(canonicalLookup(c.lookup)) || 0;
      if (qty > 0) owned++;
    }
  }
  const pct = total ? Math.round((owned / total) * 100) : 0;
  return { total, owned, pct };
}

function computeCollectionTotals(cards){
  let unique = 0, qtySum = 0;
  if (Array.isArray(cards)){
    for (const c of cards){
      const q = Number(Binders.ownedQty.get(canonicalLookup(c.lookup)) || 0);
      if (q > 0){ unique++; qtySum += q; }
    }
  }
  return { unique, qtySum };
}

function parseCSV(text, delim=','){
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = lines[0].split(delim).map(h => h.trim());
  const rows = [];
  for (let i=1; i<lines.length; i++){
    const cols = lines[i].split(delim);
    const obj = {};
    for (let j=0; j<header.length; j++){
      const key = header[j];
      let val = (cols[j] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      obj[key] = val;
    }
    rows.push(obj);
  }
  return rows;
}

async function fetchText(url){
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function loadBindersConfig(){
  const url = new URL('collections/config.csv', location.href).toString();
  const txt = await fetchText(url);
  // config uses ';' delimiter
  const rows = parseCSV(txt, ';');
  // normalize keys
  return rows.map(r => ({
    id: r.id || r.ID || r.Id || '',
    name: r.Name || r.name || '',
    link: r.link || r.Link || '',
    file: r.fileName || r.filename || r.File || r.file || ''
  })).filter(r => r.name && r.file);
}

async function loadSetCSV(file){
  const url = new URL('collections/' + file, location.href).toString();
  const txt = await fetchText(url);
  const rows = parseCSV(txt, ',');
  // expect headers: id,lookupid,set number,Availability
  return rows.map(r => ({
    id: r.id || r.ID || '',
    lookup: r.lookupid || r.lookupID || r.lookup || '',
    num: r['set number'] || r.number || r.num || '',
    availability: r.Availability || r.availability || ''
  })).filter(r => r.lookup);
}

function binderImageSrc(lookup){
  // images are stored under collections/cache/<lookup>.jpg
  return new URL('collections/cache/' + String(lookup) + '.jpg', location.href).toString();
}

function canonicalLookup(v){ return String(v || '').trim().toLowerCase(); }

function getLookupFromCollectionRow(row){
  return row && (row.lookupID || row.lookupId || row.lookupid || row.lookup || '');
}

async function ensureOwnedFromCards(){
  if (Binders.ownedQty.size) return; // already loaded
  try{
    const data = await loadCollectionData(20000);
    data.forEach(row => {
      const lk = canonicalLookup(getLookupFromCollectionRow(row));
      if (!lk) return;
      const q = Number(row.Quantity || row.quantity || 0);
      if (Number.isFinite(q)) Binders.ownedQty.set(lk, q);
    });
  }catch(e){ console.warn('[binders] Failed to load cards.json for ownership map', e); }
}

function humanizeCardName(lookup){
  let seg = String(lookup || '').split('/').pop() || '';
  // strip trailing set number
  seg = seg.replace(/-(\d+)(?:-[a-z0-9-]+)?$/i, '');
  // remove known variant suffixes if present at end
  seg = seg
    .replace(/-(reverse-holo|holo|ex|poke-ball|master-ball)$/i, '')
    .replace(/-ex$/i, '');
  // tidy dashes -> spaces, capitalize words
  const titled = seg.split('-').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
  // fix common lowercase words/apostrophes already present
  return titled.replace(/\bOf\b/g,'of').replace(/\bAnd\b/g,'and');
}

// Determine variant ordering for tie-breaks within the same set number
// Two families supported:
//  - "ball" variants: normal (0) -> poke ball (1) -> master ball (2)
//  - "holo" variants: normal (0) -> reverse holo (1) -> holo (2) -> ex (3)
function detectVariantMode(cards){
  const hasBall = cards.some(c => /-(poke|master)-ball(?:-|$)/.test(String(c.lookup).toLowerCase()));
  return hasBall ? 'ball' : 'holo';
}

function variantRankFromLookup(lookup, mode){
  const s = String(lookup || '').toLowerCase();
  if (mode === 'ball'){
    if (/-poke-ball(?:-|$)/.test(s)) return 1;
    if (/-master-ball(?:-|$)/.test(s)) return 2;
    return 0; // normal
  }
  // holo family fallback
  if (/-reverse-holo(?:-|$)/.test(s)) return 1;
  if (/(?:^|-)holo(?:-|$)/.test(s)) return 2; // ensure not to match reverse-holo above
  if (/(?:^|-)ex(?:-|$)/.test(s)) return 3;   // match "-ex-" or end with "-ex"
  return 0;
}

function sortSetCards(cards){
  const mode = detectVariantMode(cards);
  return cards.slice().sort((a, b) => {
    const na = Number(a.num) || 0;
    const nb = Number(b.num) || 0;
    if (na !== nb) return na - nb;
    const ra = variantRankFromLookup(a.lookup, mode);
    const rb = variantRankFromLookup(b.lookup, mode);
    return ra - rb;
  });
}

function chunk(arr, size){
  const out = [];
  for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i, i+size));
  return out;
}

function updatePagerUI(){
  const ind = Binders.els.pageIndicator();
  if (ind) ind.textContent = `Page ${Math.min(Binders.currentPage+1, Binders.totalPages)}/${Binders.totalPages}`;
  const prev = Binders.els.prevBtn();
  const next = Binders.els.nextBtn();
  if (prev) prev.disabled = (Binders.currentPage <= 0);
  if (next) next.disabled = (Binders.currentPage >= Binders.totalPages - 1);
}

function renderBinders(sets){
  const root = document.getElementById('binders-content');
  if (!root) return;
  root.innerHTML = '';

  sets.forEach(set => {
    const wrap = document.createElement('div');
    wrap.className = 'binder-set';
    const header = document.createElement('h3');
    const open = document.createElement('a');
    open.href = set.link || '#'; open.target = '_blank'; open.rel = 'noopener';
    open.className = 'btn'; open.textContent = 'Open set';
    header.textContent = set.name || 'Untitled set';
    header.appendChild(open);
    wrap.appendChild(header);

    const pagesWrap = document.createElement('div');
    pagesWrap.className = 'binder-pages';
    const size = Number(Binders.pageSize) === 12 ? 12 : 9;
    const cols = size === 12 ? 4 : 3;
    const pages = chunk(set.cards, size);
    Binders.totalPages = Math.max(1, pages.length);
    if (Binders.currentPage >= Binders.totalPages) Binders.currentPage = Binders.totalPages - 1;
    const pg = pages[Binders.currentPage] || [];
    const pageEl = document.createElement('div');
    pageEl.className = 'binder-page ' + (cols === 4 ? 'cols-4' : 'cols-3');
    pg.forEach((card) => {
      const a = document.createElement('a');
      a.href = pcUrlFromLookup(card.lookup); a.target = '_blank'; a.rel = 'noopener';
      a.className = 'binder-card'; a.title = card.lookup;
      const img = document.createElement('img');
      img.loading = 'lazy'; img.className = 'binder-img'; img.alt = humanizeCardName(card.lookup);
      img.src = binderImageSrc(card.lookup);
      img.addEventListener('error', () => {
        const ph = document.createElement('div');
        ph.className = 'binder-img fallback'; ph.textContent = 'No image';
        a.replaceChildren(ph);
      });
        const meta = document.createElement('div');
        meta.className = 'binder-meta';
        const nameEl = document.createElement('div');
        nameEl.className = 'binder-name';
        nameEl.textContent = humanizeCardName(card.lookup);
        const sub = document.createElement('div');
        sub.className = 'binder-sub';
        // prefer ownership from cards.json using lookupID
        let qty = 0;
        const owned = Binders.ownedQty.get(canonicalLookup(card.lookup));
        if (Number.isFinite(owned)) qty = owned;
        sub.textContent = `No. ${card.num || '—'} • Qty: ${qty}`;
        meta.appendChild(nameEl);
        meta.appendChild(sub);
        const badge = document.createElement('span');
        badge.className = 'binder-badge ' + (qty > 0 ? 'owned' : 'missing');
        badge.textContent = qty > 0 ? 'Owned' : 'Missing';
        a.appendChild(img);
        a.appendChild(badge);
        a.appendChild(meta);
        if (qty <= 0) a.classList.add('binder-missing');
        pageEl.appendChild(a);
      });
      // pad page to fixed size with empty slots
      for (let k = pg.length; k < size; k++){
        const empty = document.createElement('div');
        empty.className = 'binder-img binder-empty';
        pageEl.appendChild(empty);
      }
      pagesWrap.appendChild(pageEl);
    updatePagerUI();
    wrap.appendChild(pagesWrap);
    root.appendChild(wrap);
  });
}

function detectSetLanguage(row){
  const link = String(row.link || row.file || '').toLowerCase();
  if (link.includes('japanese')) return 'japanese';
  return 'english';
}

function buildBindersSelect(){
  const sel = Binders.els.select(); if (!sel) return;
  const inLang = (r) => detectSetLanguage(r) === (Binders.lang || 'english');
  const items = Binders.config.filter(inLang);
  sel.innerHTML = items.map((r) => {
    const raw = (r.name || 'Untitled');
    const cleaned = (typeof cleanSetLabel === 'function')
      ? cleanSetLabel(raw)
      : String(raw).replace(/^\s*\[(?:english|japanese|japansese)\]\s*/i, '').trim();
    const name = cleaned.replace(/\"/g,'&quot;').replace(/"/g,'&quot;');
    const file = (r.file || '').replace(/\"/g,'&quot;').replace(/"/g,'&quot;');
    return `<option value="${file}">${name}</option>`;
  }).join('');
  autosizeBindersSelect();
  try{ if (typeof setupMobileDropdowns === 'function') setupMobileDropdowns(); }catch(_){ }
}

function autosizeBindersSelect(){
  const sel = Binders.els.select(); if (!sel) return;
  // On small screens, keep natural or 100% width
  if (window.matchMedia && window.matchMedia('(max-width: 600px)').matches){ sel.style.width = ''; return; }
  const cs = getComputedStyle(sel);
  const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const canvas = autosizeBindersSelect._canvas || (autosizeBindersSelect._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  let max = 0;
  for (const opt of sel.options){
    const text = opt.text || '';
    const w = ctx.measureText(text).width;
    if (w > max) max = w;
  }
  const pad = parseFloat(cs.paddingLeft)||0 + parseFloat(cs.paddingRight)||0;
  const border = parseFloat(cs.borderLeftWidth)||0 + parseFloat(cs.borderRightWidth)||0;
  const chevron = 28; // room for native arrow
  const total = Math.ceil(max + pad + border + chevron);
  sel.style.width = `${total}px`;
}

async function showSelectedBinder(file){
  const row = Binders.config.find(r => r.file === file) || Binders.config[0];
  if (!row) return;
  // Ensure selection matches current language filter
  let chosen = row;
  if (detectSetLanguage(row) !== (Binders.lang || 'english')){
    const firstInLang = Binders.config.find(r => detectSetLanguage(r) === (Binders.lang || 'english'));
    if (firstInLang) chosen = firstInLang;
  }
  setBindersStatus(`Loading set: ${chosen.name}…`);
  // sync the dropdown to the effective selection
  const selElSync = Binders.els.select(); if (selElSync) selElSync.value = chosen.file;
  try{
    await ensureOwnedFromCards();
    let data = Binders.cache.get(chosen.file);
    if (!data){
      const cards = await loadSetCSV(chosen.file);
      data = { name: chosen.name, link: chosen.link, cards: sortSetCards(cards) };
      Binders.cache.set(chosen.file, data);
    }
    Binders.currentFile = chosen.file;
    renderBinders([data]);
    const stats = computeSetStats(data.cards);
    const ct = computeCollectionTotals(data.cards);
    setBindersStatus(`<b>${data.name}</b><br/>Owned: ${stats.owned} / ${stats.total} • ${stats.pct}%<br/>In set: ${ct.qtySum} cards`);
  }catch(err){
    console.error('[binders] failed to load set', chosen, err);
    setBindersStatus(`Failed to load set: ${chosen.name}. Ensure collections/${chosen.file} exists and is accessible.`);
    return;
  }
  // persist + deep link
  try{
    localStorage.setItem('binders.file', chosen.file);
    localStorage.setItem('binders.pageSize', String(Binders.pageSize));
    localStorage.setItem('binders.page', String(Binders.currentPage));
    localStorage.setItem('binders.lang', String(Binders.lang || 'english'));
  }catch(_){ }
  const params = new URLSearchParams();
  params.set('file', chosen.file);
  params.set('ps', String(Binders.pageSize));
  params.set('pg', String(Binders.currentPage+1));
  params.set('lang', String(Binders.lang || 'english'));
  writeHash('binders', params);
  // no animations
}

async function initBinders(params){
  if (bindersRendered) return; // already initialized; user can change dropdown
  try{
    setBindersStatus('Loading binder config from collections/config.csv…');
    Binders.config = await loadBindersConfig();
    if (!Binders.config.length){ setBindersStatus('No rows in collections/config.csv'); return; }
    // Restore language early so dropdown is filtered correctly
    try{
      const storedLang = (params?.get('lang') || localStorage.getItem('binders.lang') || 'english');
      Binders.lang = (storedLang === 'japanese') ? 'japanese' : 'english';
      const rLang = document.getElementById(Binders.lang === 'japanese' ? 'lang-ja' : 'lang-en');
      if (rLang) rLang.checked = true;
    }catch(_){ Binders.lang = 'english'; }
    buildBindersSelect();
    const sel = Binders.els.select();
    if (sel && !sel._bound){
      sel.addEventListener('change', () => { Binders.currentPage = 0; showSelectedBinder(sel.value); });
      sel._bound = true;
    }
    // Page size toggle
    const radios = Binders.els.pageRadios();
    radios.forEach(r => {
      if (!r._bound){
        r.addEventListener('change', () => {
          Binders.pageSize = Number(document.querySelector('input[name="binders-pages"]:checked')?.value || 9);
          // re-render current set using cached data
          Binders.currentPage = 0;
          if (Binders.currentFile) showSelectedBinder(Binders.currentFile);
        });
        r._bound = true;
      }
    });
    Binders.pageSize = Number(document.querySelector('input[name="binders-pages"]:checked')?.value || 9);
    // Prev/Next buttons
    const prev = Binders.els.prevBtn();
    const next = Binders.els.nextBtn();
    if (prev && !prev._bound){
      prev.addEventListener('click', () => {
        if (Binders.currentPage > 0){ Binders.currentPage--; if (Binders.currentFile) showSelectedBinder(Binders.currentFile); }
      });
      prev._bound = true;
    }
    // Language toggle handlers
    const langRadios = document.querySelectorAll('input[name="binders-lang"]');
    langRadios.forEach(r => {
      if (!r._bound){
        r.addEventListener('change', () => {
          const val = document.querySelector('input[name="binders-lang"]:checked')?.value || 'english';
          Binders.lang = (val === 'japanese') ? 'japanese' : 'english';
          buildBindersSelect(); autosizeBindersSelect();
          const selEl = Binders.els.select();
          if (selEl){ Binders.currentPage = 0; showSelectedBinder(selEl.value); }
        });
        r._bound = true;
      }
    });
    if (next && !next._bound){
      next.addEventListener('click', () => {
        if (Binders.currentPage < Binders.totalPages - 1){ Binders.currentPage++; if (Binders.currentFile) showSelectedBinder(Binders.currentFile); }
      });
      next._bound = true;
    }
    // Restore from params/localStorage
    try{
      const storedFile = params?.get('file') || localStorage.getItem('binders.file');
      const storedPS = Number(params?.get('ps') || localStorage.getItem('binders.pageSize') || 9);
      const storedPG = Number(params?.get('pg') || localStorage.getItem('binders.page') || 1);
      if (storedPS === 12){ const r = document.getElementById('pages-12'); if (r) r.checked = true; Binders.pageSize = 12; }
      if (storedFile && sel) sel.value = storedFile;
      autosizeBindersSelect();
      await showSelectedBinder(storedFile || (Binders.config[0] && Binders.config[0].file));
      if (storedPG && !isNaN(storedPG)){ Binders.currentPage = Math.max(0, storedPG-1); if (Binders.currentFile) await showSelectedBinder(Binders.currentFile); }
    }catch(_){ await showSelectedBinder(Binders.config[0].file); if (sel) sel.value = Binders.config[0].file; }
    bindersRendered = true;
  }catch(err){
    console.error(err);
    setBindersStatus('Failed to load binders. Ensure collections/ is served over http and files exist.');
  }
}

const Collection = {
  data: [],
  filtered: [],
  els: {
    grid: () => document.getElementById("collect-grid"),
    statTotal: () => document.getElementById("stat-total"),
    statUnique: () => document.getElementById("stat-unique"),
    statRaw: () => document.getElementById("stat-raw"),
    statPSA: () => document.getElementById("stat-psa10"),
    search: () => document.querySelector(".collect-search"),
    setSel: () => document.querySelector(".collect-set"),
    langSel: () => document.querySelector(".collect-lang"),
    sortSel: () => document.querySelector(".collect-sort"),
    controls: () => document.querySelector(".collect-controls"),
  },
  filters: { q: "", set: "", lang: "both" }, // both|english|japanese
  sort: { key: 'none', dir: 'desc' },        // keys: psa|raw|qty|none ; dir: asc|desc
  render: { index: 0, batchSize: 100, observer: null, sentinel: null },
  state: { loading:false, renderedOnce:false }
};

function n(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function price(v){ return n(v).toFixed(2); }
function filenameFromLookup(lookupID){
  return String(lookupID || "").replace(/\//g, "-").replace(/[^a-z0-9\-_.]/gi, "-") + ".webp";
}

/* --- language + set helpers --- */
// Language for FILTERS ONLY. Reads prefix in Set: "[English] ..." or "[Japanese]/[Japansese] ..."
function languageFromCard(card){
  const setStr = String(card.Set || '').toLowerCase();
  if (/^\s*\[english\]/.test(setStr)) return 'english';
  if (/^\s*\[(?:japanese|japansese)\]/.test(setStr)) return 'japanese';
  // fallbacks if you ever add explicit fields:
  const lr = (card.Language || card.language || '').toString().toLowerCase();
  if (lr.includes('english')) return 'english';
  if (lr.includes('japanese') || lr.includes('japansese')) return 'japanese';
  return 'unknown';
}
// For DISPLAY ONLY — remove the language prefix from Set
function cleanSetLabel(s){
  return String(s || '').replace(/^\s*\[(?:english|japanese|japansese)\]\s*/i, '').trim();
}

/* --- PriceCharting URL from lookupID (slugify path segments) --- */
function pcUrlFromLookup(id){
  let s = String(id || '').trim();
  s = s.split('/').map(seg =>
    seg
      .toLowerCase()
      .replace(/\s+/g, '-')        // spaces → hyphens
      .replace(/[^a-z0-9\-]/g, '') // strip punctuation except hyphen
  ).join('/');
  return `https://www.pricecharting.com/game/${s}`;
}

/* --- build Set dropdown limited by current language --- */
function buildSetDropdown(){
  const sel = Collection.els.setSel(); if (!sel) return;

  const lang = Collection.filters.lang; // both|english|japanese
  const inLang = (c) => {
    if (lang === 'both') return true;
    return languageFromCard(c) === lang;
  };

  const sets = [...new Set(Collection.data.filter(inLang).map(d => d.Set).filter(Boolean))]
    .sort((a,b)=> String(a).localeCompare(String(b)));

  const current = sel.value;
  sel.innerHTML = `<option value="">All sets</option>` + sets.map(s => {
    const label = cleanSetLabel(s);
    return `<option value="${String(s).replace(/"/g,'&quot;')}">${label}</option>`;
  }).join('');

  // keep selection if still valid, else reset to all
  if (!sets.includes(current)) sel.value = '';
  try{ if (typeof setupMobileDropdowns === 'function') setupMobileDropdowns(); }catch(_){ }
}

/* --- Sort control injection (if missing) --- */
function ensureSortControl(){
  if (Collection.els.sortSel()) return; // already there in HTML
  const controls = Collection.els.controls();
  if (!controls) return;

  const sel = document.createElement('select');
  sel.className = 'collect-sort';
  sel.innerHTML = `
    <option value="none-desc">Sort: None</option>
    <option value="psa-desc">PSA10: Highest → Lowest</option>
    <option value="psa-asc">PSA10: Lowest → Highest</option>
    <option value="raw-desc">Raw: Highest → Lowest</option>
    <option value="raw-asc">Raw: Lowest → Highest</option>
    <option value="qty-desc">Qty: Highest → Lowest</option>
    <option value="qty-asc">Qty: Lowest → Highest</option>
  `;
  const langSel = Collection.els.langSel();
  if (langSel && langSel.parentElement === controls){
    controls.insertBefore(sel, langSel.nextSibling);
  } else {
    controls.appendChild(sel);
  }
  try{ setupMobileDropdowns(); }catch(_){ }
}

/* --- filters + stats + sort --- */
function applyFilters(){
  const q = Collection.filters.q.trim().toLowerCase();
  const set = Collection.filters.set;
  const lang = Collection.filters.lang;

  Collection.filtered = Collection.data.filter(c => {
    const hay = `${c.Name||''} ${c.Set||''} ${c.lookupID||''} ${c.ID||''}`.toLowerCase();
    const matchesQ = !q || hay.includes(q);
    const matchesSet = !set || (c.Set === set);
    const cardLang = languageFromCard(c);
    const matchesLang = (lang === 'both') || (cardLang === lang);
    return matchesQ && matchesSet && matchesLang;
  });

  applySort(); // sort after filtering
}

function applySort(){
  const { key, dir } = Collection.sort;
  if (key === 'none') return;

  const cmpNum = (a, b) => (dir === 'asc' ? a - b : b - a);

  Collection.filtered.sort((a, b) => {
    if (key === 'psa') return cmpNum(n(a["PSA 10 Price"]), n(b["PSA 10 Price"]));
    if (key === 'raw') return cmpNum(n(a["Raw Price"]), n(b["Raw Price"]));
    if (key === 'qty') return cmpNum(n(a["Quantity"]), n(b["Quantity"]));
    return 0;
  });
}

function updateStats(){
  const fmtInt = (v)=> Number(v||0).toLocaleString('en-GB');
  const fmtMoney = (v)=> '£' + Number(v||0).toLocaleString('en-GB', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const sign = (v)=> (v>0?'+':'') + (Math.abs(Number(v||0))).toLocaleString('en-GB');
  const signMoney = (v)=> (v>0?'+':'') + '£' + Math.abs(Number(v||0)).toLocaleString('en-GB', { minimumFractionDigits:2, maximumFractionDigits:2 });

  const totalCards = Collection.filtered.reduce((a,c)=> a + n(c.Quantity), 0);
  const uniqueCards = Collection.filtered.length;
  const totalRaw = Collection.filtered.reduce((a,c)=> a + n(c["Raw Total"] || (n(c["Raw Price"]) * n(c.Quantity))), 0);
  const totalPSA10 = Collection.filtered.reduce((a,c)=> a + (n(c["PSA 10 Price"]) * n(c.Quantity)), 0);

  let delta = null;
  if (OldCollection.loaded && OldCollection.data && OldCollection.data.length){
    // apply same filters to old dataset
    const q = Collection.filters.q.trim().toLowerCase();
    const set = Collection.filters.set;
    const lang = Collection.filters.lang;
    const oldFiltered = OldCollection.data.filter(c => {
      const hay = `${c.Name||''} ${c.Set||''} ${c.lookupID||''} ${c.ID||''}`.toLowerCase();
      const matchesQ = !q || hay.includes(q);
      const matchesSet = !set || (c.Set === set);
      const cardLang = languageFromCard(c);
      const matchesLang = (lang === 'both') || (cardLang === lang);
      return matchesQ && matchesSet && matchesLang;
    });
    const oldTotalCards = oldFiltered.reduce((a,c)=> a + n(c.Quantity), 0);
    const oldUnique = oldFiltered.length;
    const oldRaw = oldFiltered.reduce((a,c)=> a + n(c["Raw Total"] || (n(c["Raw Price"]) * n(c.Quantity))), 0);
    const oldPSA = oldFiltered.reduce((a,c)=> a + (n(c["PSA 10 Price"]) * n(c.Quantity)), 0);
    delta = {
      totalCards: totalCards - oldTotalCards,
      uniqueCards: uniqueCards - oldUnique,
      totalRaw: totalRaw - oldRaw,
      totalPSA10: totalPSA10 - oldPSA
    };
  }

  const elT = Collection.els.statTotal();
  const elU = Collection.els.statUnique();
  const elR = Collection.els.statRaw();
  const elP = Collection.els.statPSA();
  if (elT) elT.innerHTML = fmtInt(totalCards) + (delta ? ` <span class="tile-delta">${sign(delta.totalCards)}</span>` : '');
  if (elU) elU.innerHTML = fmtInt(uniqueCards) + (delta ? ` <span class="tile-delta">${sign(delta.uniqueCards)}</span>` : '');
  if (elR) elR.innerHTML = fmtMoney(totalRaw) + (delta ? ` <span class="tile-delta">${signMoney(delta.totalRaw)}</span>` : '');
  if (elP) elP.innerHTML = fmtMoney(totalPSA10) + (delta ? ` <span class="tile-delta">${signMoney(delta.totalPSA10)}</span>` : '');
  const note = document.getElementById('stat-note');
  if (note) note.textContent = (delta ? 'vs previous snapshot' : '');
}

/* --- infinite scroll render --- */
function resetInfiniteScroll(grid){
  if (Collection.render.observer) { Collection.render.observer.disconnect(); Collection.render.observer = null; }
  if (Collection.render.sentinel && Collection.render.sentinel.parentNode) {
    Collection.render.sentinel.parentNode.removeChild(Collection.render.sentinel);
  }
  Collection.render.sentinel = document.createElement('div');
  Collection.render.sentinel.id = 'scroll-sentinel';
  Collection.render.sentinel.style.height = '1px';
  Collection.render.index = 0;
  grid.innerHTML = '';
  grid.appendChild(Collection.render.sentinel);
}

function renderNextBatch(grid){
  const { batchSize } = Collection.render;
  const total = Collection.filtered.length;
  let { index } = Collection.render;
  const end = Math.min(index + batchSize, total);
  if (index >= end) return;

  for (; index < end; index++) {
    const c = Collection.filtered[index];
    const imgSrc = `cache/pc_images/${filenameFromLookup(c.lookupID)}`;
    const pcUrl = c.lookupID ? pcUrlFromLookup(c.lookupID) : null;

    const el = document.createElement('article');
    el.className = 'collect-card kv';
    el.innerHTML = `
      <div class="collect-media">
        <img class="collect-img" loading="lazy" src="${imgSrc}" alt="${c.Name}">
      </div>
      <div class="collect-body">
        <h4 class="collect-name">${c.Name}</h4>
        <div class="collect-meta">Set: ${cleanSetLabel(c.Set)}</div>
        <div class="collect-prices">
          Qty: ${Number(c.Quantity) || 0} • 
          Raw: £${price(c["Raw Price"])} • 
          PSA10: £${price(c["PSA 10 Price"])}
        </div>
        ${pcUrl 
          ? `<a class="btn collect-open" href="${pcUrl}" target="_blank" rel="noopener">open</a>` 
          : `<button class="btn collect-open" disabled title="No lookupID">open</button>`}
      </div>`;

    const img = el.querySelector('img');
    img.addEventListener('error', () => {
      img.replaceWith(Object.assign(document.createElement('div'), {
        className: 'collect-img',
        textContent: 'No image',
        style: 'display:flex;align-items:center;justify-content:center;color:#777;font-size:11px;'
      }));
    });
    grid.insertBefore(el, Collection.render.sentinel);
  }

  Collection.render.index = index;
  if (index >= total && Collection.render.observer) Collection.render.observer.disconnect();
}

function renderGridInfinite(){
  const grid = Collection.els.grid(); if (!grid) return;
  if (!Collection.filtered.length){ showStatus('No results.'); return; }

  resetInfiniteScroll(grid);

  // ensure we start at the top
  const wrap = grid.parentElement;
  if (wrap) wrap.scrollTop = 0;

  // observer for subsequent batches
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      requestAnimationFrame(() => renderNextBatch(grid));
    }
  }, { root: wrap || null, rootMargin: '0px 0px 200px 0px' });
  Collection.render.observer = obs;
  obs.observe(Collection.render.sentinel);

  // paint immediately (don’t wait for IO) + once more next frame
  renderNextBatch(grid);
  requestAnimationFrame(() => renderNextBatch(grid));
}

function reflow(){ applyFilters(); updateStats(); renderGridInfinite(); }

/* --- init --- */
async function initCollection(force=false){
  if (Collection.state.loading) return;
  if (collectionRendered && !force) return; // simple global guard

  Collection.state.loading = true;
  showStatus('Loading collection…');

  // 5s fallback if still "Loading…"
  const loadingGuard = setTimeout(() => {
    const grid = document.getElementById('collect-grid');
    if (grid && /Loading collection/.test(grid.textContent)) {
      showStatus('Still loading… If this persists, check that cache/cards.json is reachable via http:// and not file://', true);
    }
  }, 5000);

  try{
    Collection.data = await loadCollectionData(20000);
    if (!Collection.data.length) {
      clearTimeout(loadingGuard);
      showStatus('cards.json loaded but had 0 rows. Check the format/path.', true);
      collectionRendered = false;
      return;
    }

    // ensure sort control exists (if HTML didn't include it)
    ensureSortControl();

    // Build set dropdown, limited by current language
    buildSetDropdown();

    const search = Collection.els.search();
    const setSel = Collection.els.setSel();
    const langSel = Collection.els.langSel();
    const sortSel = Collection.els.sortSel();

    if (!Collection.state.renderedOnce){
      if (search) search.addEventListener('input', () => { Collection.filters.q = search.value || ''; reflow(); });

      if (setSel) setSel.addEventListener('change', () => {
        Collection.filters.set = setSel.value || '';
        reflow();
      });

      if (langSel){
        const mapLang = (v)=>{ v = String(v||'both').toLowerCase(); if (v.includes('english')) return 'english'; if (v.includes('japanese')||v.includes('japansese')) return 'japanese'; return 'both'; };
        Collection.filters.lang = mapLang(langSel.value);
        langSel.addEventListener('change', ()=>{ 
          Collection.filters.lang = mapLang(langSel.value);
          // Rebuild set dropdown to only show sets from selected language
          buildSetDropdown();
          // Reset chosen set if it no longer exists
          Collection.filters.set = '';
          if (setSel) setSel.value = '';
          reflow();
        });
      }

      if (sortSel){
        sortSel.addEventListener('change', () => {
          const v = String(sortSel.value || 'none-desc');
          const [key, dir] = v.split('-'); // e.g., 'psa-desc'
          Collection.sort.key = (key === 'psa' || key === 'raw' || key === 'qty') ? key : 'none';
          Collection.sort.dir = (dir === 'asc' || dir === 'desc') ? dir : 'desc';
          reflow();
        });
      }

      Collection.state.renderedOnce = true;
    }

    clearTimeout(loadingGuard);
    reflow();
    // load baseline and refresh stats once available
    loadOldCollectionData(20000).then(()=>{ try{ updateStats(); }catch(e){} });
    // ensure first batch shows after layout settles
    requestAnimationFrame(() => reflow());

    collectionRendered = true;

  }catch(err){
    clearTimeout(loadingGuard);
    console.error(err);
    showStatus('Failed to fetch cache/cards.json (use a local server; open the JSON URL directly to verify).', true);
    collectionRendered = false;
  }finally{
    Collection.state.loading = false;
  }
}
