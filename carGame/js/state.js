// State and persistence extracted from script.js
// Centralized state with migration and localStorage helpers

import { PARTS } from './data.js';

/**
 * @typedef {Object} Car
 * @property {string} id
 * @property {string} model
 * @property {number} basePrice
 * @property {number} perf
 * @property {number} price
 * @property {number[]} priceHistory
 * @property {Record<string, number>} parts // 0–100 condition per part key
 * @property {number|null} boughtPrice
 * @property {number|undefined} valuation
 * @property {number[]|undefined} valuationHistory
 * @property {boolean|undefined} failed
 */

/**
 * @typedef {Object} State
 * @property {number} day
 * @property {number} money
 * @property {number} level
 * @property {number} xp
 * @property {string} currency
 * @property {number} heat
 * @property {Car[]} illegalMarket
 * @property {Car[]} garage
 * @property {number} garagesPurchased
 * @property {{legal: Record<string, number>, illegal: Record<string, number>}} partsPrices
 * @property {Record<string, number[]>} modelTrends
 * @property {{openCars: Record<string, boolean>, showDev: boolean, showOptions?: boolean}} ui
 * @property {{ modelImages: Record<string, string> }} assets
 * @property {string[]} log
 */

/**
 * @returns {State}
 */
export const defaultState = () => ({
  day: 1,
  money: 20000,
  level: 1,
  xp: 0,
  currency: 'USD',
  heat: 0,
  illegalMarket: [],
  garage: [],
  garagesPurchased: 0,
  partsPrices: { legal: {}, illegal: {} },
  modelTrends: {},
  ui: { openCars: {}, showDev: false },
  assets: { modelImages: {} },
  log: [
    'Welcome to ICS. Buy, fix, flip, and race.',
    'Prices change daily. Illegal parts are cheaper, but sketchy...',
  ],
});

export function saveState() {
  try { localStorage.setItem('ics_state', JSON.stringify(state)); } catch {}
}

export function loadState() {
  try {
    const s = localStorage.getItem('ics_state');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function migrateState() {
  try {
    if (!state || typeof state !== 'object') return;
    if (typeof state.level !== 'number' || !isFinite(state.level)) state.level = 1;
    if (typeof state.xp !== 'number' || !isFinite(state.xp)) state.xp = 0;
    if (typeof state.garagesPurchased !== 'number' || !isFinite(state.garagesPurchased)) state.garagesPurchased = 0;
    if (typeof state.currency !== 'string') state.currency = 'USD';
    if (typeof state.heat !== 'number' || !isFinite(state.heat)) state.heat = 0;
    if (!state.modelTrends) state.modelTrends = {};
    if (!state.ui || typeof state.ui !== 'object') state.ui = { openCars: {}, showDev: false };
    if (!state.ui.openCars) state.ui.openCars = {};
    if (typeof state.ui.showDev !== 'boolean') state.ui.showDev = false;
    if (!state.assets || typeof state.assets !== 'object') state.assets = { modelImages: {} };
    if (!state.assets.modelImages) state.assets.modelImages = {};
    if (!state.partsPrices || typeof state.partsPrices !== 'object') state.partsPrices = { legal: {}, illegal: {} };
    if (!state.partsPrices.legal) state.partsPrices.legal = {};
    if (!state.partsPrices.illegal) state.partsPrices.illegal = {};
    const normalizeCar = (car) => {
      if (!car || !car.parts) return;
      if (typeof car.failed !== 'boolean') car.failed = false;
      for (const p of PARTS) {
        const v = car.parts[p.key];
        if (typeof v === 'boolean') car.parts[p.key] = v ? 100 : 0;
        else if (typeof v !== 'number' || !isFinite(v)) car.parts[p.key] = 100;
        else car.parts[p.key] = Math.max(0, Math.min(100, Math.round(v)));
      }
    };
    if (Array.isArray(state.garage)) state.garage.forEach(normalizeCar);
    if (Array.isArray(state.illegalMarket)) state.illegalMarket.forEach(normalizeCar);
  } catch {}
}

// Central state singleton
export let state = loadState() || defaultState();
migrateState();

// Allow controlled reassignment from other modules
export function setState(next) { state = next; }
