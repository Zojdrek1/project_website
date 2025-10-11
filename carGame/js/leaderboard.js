const STORAGE_KEY = 'ics_leaderboard_v1';

export const LEADERBOARD_CATEGORIES = {
  netWorth: { key: 'netWorth', label: 'Top Net Worth', higherBetter: true },
  level: { key: 'level', label: 'Highest Level', higherBetter: true },
  league: { key: 'league', label: 'League Prestige', higherBetter: true },
};

function defaultData() {
  const data = {};
  for (const key of Object.keys(LEADERBOARD_CATEGORIES)) {
    data[key] = [];
  }
  return data;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    const data = defaultData();
    for (const key of Object.keys(LEADERBOARD_CATEGORIES)) {
      if (Array.isArray(parsed[key])) data[key] = parsed[key];
    }
    return data;
  } catch {
    return defaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function normalizeAlias(alias) {
  if (typeof alias !== 'string') return 'Crew Chief';
  const trimmed = alias.trim().slice(0, 24);
  return trimmed || 'Crew Chief';
}

function isBetter(def, nextValue, prevValue) {
  if (typeof prevValue !== 'number') return true;
  if (def.higherBetter) return nextValue > prevValue;
  return nextValue < prevValue;
}

export function recordLeaderboardEntry({ category, alias, profileId, value, meta = {} }) {
  if (!category || typeof value !== 'number') return null;
  if (!profileId) return null;
  const def = LEADERBOARD_CATEGORIES[category];
  if (!def) return null;

  const data = loadData();
  const board = Array.isArray(data[category]) ? data[category] : (data[category] = []);
  const normalizedAlias = normalizeAlias(alias);
  const entry = {
    profileId,
    alias: normalizedAlias,
    value: Math.round(value),
    meta,
    ts: Date.now(),
  };

  const existingIndex = board.findIndex(item => item && item.profileId === profileId);
  if (existingIndex !== -1) {
    const current = board[existingIndex];
    if (isBetter(def, entry.value, current.value)) {
      board[existingIndex] = entry;
    } else {
      return current;
    }
  } else {
    board.push(entry);
  }

  board.sort((a, b) => {
    if (def.higherBetter) {
      if (b.value !== a.value) return b.value - a.value;
    } else if (a.value !== b.value) {
      return a.value - b.value;
    }
    return (a.ts || 0) - (b.ts || 0);
  });
  if (board.length > 50) board.length = 50;

  saveData(data);
  return entry;
}

export function getTopEntries(category, limit = 10) {
  const def = LEADERBOARD_CATEGORIES[category];
  if (!def) return [];
  const data = loadData();
  const board = Array.isArray(data[category]) ? data[category] : [];
  return board.slice(0, limit);
}

export function getLeaderboardSnapshot(limit = 10) {
  const data = loadData();
  const snapshot = {};
  for (const [key, def] of Object.entries(LEADERBOARD_CATEGORIES)) {
    const entries = Array.isArray(data[key]) ? data[key].slice(0, limit) : [];
    snapshot[key] = { label: def.label, entries };
  }
  return snapshot;
}

export function clearLeaderboard() {
  saveData(defaultData());
}
