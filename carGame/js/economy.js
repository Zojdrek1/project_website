// Economy: pricing, markets, trends, and tick cores
// Pure state updates; no DOM/UI side effects here

import { state } from './state.js';
import { PARTS, MODELS } from './data.js';
import { TUNING_OPTIONS } from './tuning.js';

// Re-exported timing/config so other modules can share them
export const PARTS_TICK_MS = 8000; // parts update interval
export const ILLEGAL_TICK_MS = 7000; // illegal market price drift
export const ILLEGAL_LISTING_REFRESH_MS = 180000; // refresh shop listings every 3 minutes
export const PRICE_HISTORY_MAX = 60; // points per chart

// Local helpers (duplicated minimal utilities to avoid circular deps)
const rand = (min, max) => Math.random() * (max - min) + min;
const randi = (min, max) => Math.floor(rand(min, max));
const sample = (arr) => arr[randi(0, arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CURRENCY_RATES = { USD: 1, GBP: 0.79, EUR: 0.93, JPY: 155, PLN: 4.0 };
const getRate = () => CURRENCY_RATES[(state && state.currency) || 'USD'] || 1;

export function ensureModelTrends() {
  if (!state.modelTrends) state.modelTrends = {};
  for (const m of MODELS) {
    const key = m.model;
    if (!Array.isArray(state.modelTrends[key]) || !state.modelTrends[key].length) {
      const base = Math.round(m.basePrice * getRate());
      const series = [];
      let cur = Math.round(base * rand(0.9, 1.1));
      for (let i = 0; i < PRICE_HISTORY_MAX; i++) {
        const mul = rand(0.98, 1.02);
        cur = Math.round(cur * mul);
        const min = Math.round(base * 0.6);
        const max = Math.round(base * 1.4);
        if (cur < min) cur = min;
        if (cur > max) cur = max;
        series.push(cur);
      }
      state.modelTrends[key] = series;
    }
  }
}

export function refreshIllegalMarket() {
  const n = Math.min(7, 3 + Math.floor(((state.level || 1) - 1) / 2));
  ensureModelTrends();
  state.illegalMarket = Array.from({ length: n }, () => {
    const baseModel = sample(MODELS);
    const parts = {};
    // Parts now have condition percentage (0-100)
    const wornBias = Math.random() < 0.6;
    for (const p of PARTS) {
      const cond = wornBias && Math.random() < 0.3 ? Math.round(rand(35, 75)) : Math.round(rand(70, 100));
      parts[p.key] = cond;
    }
    const avgCond = PARTS.reduce((a, p) => a + (parts[p.key] ?? 100), 0) / PARTS.length;
    const condFactor = 0.5 + (avgCond / 100) * 0.5;
    const priceVar = rand(0.75, 1.25);
    const base = Math.round(baseModel.basePrice * getRate());
    const price0 = Math.round(base * priceVar * condFactor);
    const basePerf = baseModel.perf;
    const car = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      model: baseModel.model,
      basePrice: base,
      perf: basePerf,
      basePerf,
      price: price0,
      priceHistory: [price0],
      parts,
      boughtPrice: null,
      tuning: Object.fromEntries(TUNING_OPTIONS.map(opt => [opt.key, 0])),
      tuningBonus: 0,
    };
    const perfCondFactor = 0.6 + 0.4 * Math.max(0, Math.min(1, avgCond / 100));
    car.perf = Math.round(basePerf * perfCondFactor);
    // Seed listing price history from model index adjusted by condition
    const series = state.modelTrends[baseModel.model] || [Math.round(baseModel.basePrice * getRate())];
    const seedLen = Math.min(30, series.length);
    const start = series.slice(series.length - seedLen);
    const hist = start.map(v => {
      const noisy = Math.round(v * condFactor * rand(0.97, 1.03));
      const baseNow = Math.round(baseModel.basePrice * getRate());
      return clamp(noisy, Math.round(baseNow * 0.5), Math.round(baseNow * 1.5));
    });
    car.priceHistory = hist;
    car.price = hist[hist.length - 1];
    return car;
  });
}

export function refreshPartsPrices() {
  state.partsPrices.legal = {};
  state.partsPrices.illegal = {};
  const r = getRate();
  for (const p of PARTS) {
    state.partsPrices.legal[p.key] = Math.round(p.basePrice * r * rand(0.9, 1.2));
    state.partsPrices.illegal[p.key] = Math.round(p.basePrice * r * rand(0.6, 1.0));
  }
}

export function tickPartsPricesCore() {
  const r = getRate();
  for (const p of PARTS) {
    const base = p.basePrice * r;
    const curL = state.partsPrices.legal[p.key] ?? Math.round(base * 1.0);
    const mulL = rand(0.97, 1.03);
    const nextL = Math.round(curL * mulL);
    state.partsPrices.legal[p.key] = clamp(nextL, Math.round(base * 0.8), Math.round(base * 1.3));

    const curI = state.partsPrices.illegal[p.key] ?? Math.round(base * 0.8);
    const mulI = rand(0.95, 1.05);
    const nextI = Math.round(curI * mulI);
    state.partsPrices.illegal[p.key] = clamp(nextI, Math.round(base * 0.5), Math.round(base * 1.1));
  }
}

export function tickIllegalMarketCore() {
  // Drift listed car prices and record history
  for (const car of state.illegalMarket) {
    const base = car.basePrice;
    const cur = car.price;
    const mul = rand(0.96, 1.05);
    let next = Math.round(cur * mul);
    const min = Math.round(base * 0.55);
    const max = Math.round(base * 1.5);
    if (next < min) next = min;
    if (next > max) next = max;
    car.price = next;
    if (!Array.isArray(car.priceHistory)) car.priceHistory = [];
    car.priceHistory.push(next);
    if (car.priceHistory.length > PRICE_HISTORY_MAX) car.priceHistory.shift();
  }
  // Drift owned car valuations similarly, bounded by condition
  const avgCondition = (car) => PARTS.reduce((a, p) => a + (car.parts[p.key] ?? 100), 0) / PARTS.length;
  for (const car of state.garage) {
    const avg = avgCondition(car);
    const condFactor = 0.5 + (avg / 100) * 0.5;
    const base = car.basePrice * condFactor;
    if (typeof car.valuation !== 'number') car.valuation = Math.round(base);
    const mul = rand(0.97, 1.03);
    let next = Math.round(car.valuation * mul);
    const min = Math.round(base * 0.7);
    const max = Math.round(base * 1.3);
    if (next < min) next = min;
    if (next > max) next = max;
    car.valuation = next;
    if (!Array.isArray(car.valuationHistory)) car.valuationHistory = [];
    car.valuationHistory.push(next);
    if (car.valuationHistory.length > PRICE_HISTORY_MAX) car.valuationHistory.shift();
  }
  // Drift global model indices
  ensureModelTrends();
  for (const m of MODELS) {
    const base = m.basePrice;
    const series = state.modelTrends[m.model] || [base];
    const cur = series[series.length - 1] || Math.round(base);
    const mul = rand(0.97, 1.03);
    let next = Math.round(cur * mul);
    const min = Math.round(base * 0.6);
    const max = Math.round(base * 1.4);
    if (next < min) next = min;
    if (next > max) next = max;
    series.push(next);
    if (series.length > PRICE_HISTORY_MAX) series.shift();
    state.modelTrends[m.model] = series;
  }
  // Heat decay only (events/UI outside core)
  if ((state.heat || 0) > 0) state.heat = Math.max(0, state.heat - 1);
}
