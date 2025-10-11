export const ACHIEVEMENT_DEFS = [
  {
    id: 'cash_50k',
    label: 'Seed Capital',
    description: 'Hold $50,000 cash at once.',
    icon: '💵',
    triggers: ['money'],
    check: ({ state }) => (state.money || 0) >= 50_000,
  },
  {
    id: 'cash_250k',
    label: 'Quarter Million Club',
    description: 'Reach $250,000 cash on hand.',
    icon: '💰',
    triggers: ['money'],
    check: ({ state }) => (state.money || 0) >= 250_000,
  },
  {
    id: 'cash_1m',
    label: 'Seven Figures',
    description: 'Amass $1,000,000 in operating cash.',
    icon: '🏦',
    triggers: ['money'],
    check: ({ state }) => (state.money || 0) >= 1_000_000,
  },
  {
    id: 'garage_mogul',
    label: 'Garage Mogul',
    description: 'Unlock the Underground Compound garage tier.',
    icon: '🏗️',
    triggers: ['garageTier'],
    check: ({ state }) => (state.garageTier || 0) >= 2,
  },
  {
    id: 'garage_tycoon',
    label: 'Sky Vault Tycoon',
    description: 'Unlock the Skyline Vault garage tier.',
    icon: '🏢',
    triggers: ['garageTier'],
    check: ({ state }) => (state.garageTier || 0) >= 3,
  },
  {
    id: 'league_victor',
    label: 'League Victor',
    description: 'Win a league rank final.',
    icon: '🏆',
    triggers: ['leagueWin'],
    check: ({ context }) => context?.rankCompleted === true,
  },
  {
    id: 'league_champion',
    label: 'Midnight Champion',
    description: 'Capture the Midnight League championship.',
    icon: '👑',
    triggers: ['leagueChampion'],
    check: ({ context }) => context?.champion === true,
  },
  {
    id: 'collector',
    label: 'Collector',
    description: 'Own 8 cars across your garages.',
    icon: '🚗',
    triggers: ['garageSize'],
    check: ({ state }) => (Array.isArray(state.garage) ? state.garage.length : 0) >= 8,
  },
];

export function getAchievementDefinition(id) {
  return ACHIEVEMENT_DEFS.find(def => def.id === id) || null;
}

function ensureAchievementState(state) {
  if (!state.achievements || typeof state.achievements !== 'object') state.achievements = { unlocked: {}, progress: {} };
  if (!state.achievements.unlocked || typeof state.achievements.unlocked !== 'object') state.achievements.unlocked = {};
  if (!state.achievements.progress || typeof state.achievements.progress !== 'object') state.achievements.progress = {};
  return state.achievements;
}

export function evaluateAchievements({ state, trigger, context = {}, onUnlock = null }) {
  const achievements = ensureAchievementState(state);
  const unlockedNow = [];
  const progress = achievements.progress;
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.triggers && !def.triggers.includes(trigger)) continue;
    if (achievements.unlocked[def.id]) continue;
    try {
      if (def.check({ state, progress, context })) {
        const record = { ts: Date.now(), id: def.id };
        achievements.unlocked[def.id] = record;
        unlockedNow.push(def);
        if (typeof onUnlock === 'function') onUnlock(def, record);
      }
    } catch (err) {
      console.error('Achievement check failed', def.id, err);
    }
  }
  return unlockedNow;
}

export function unlockedAchievements(state) {
  const achievements = ensureAchievementState(state);
  return Object.keys(achievements.unlocked);
}

export function isAchievementUnlocked(state, id) {
  const achievements = ensureAchievementState(state);
  return !!achievements.unlocked[id];
}

export function achievementProgressSummary(state) {
  const achievements = ensureAchievementState(state);
  const total = ACHIEVEMENT_DEFS.length;
  const unlocked = Object.keys(achievements.unlocked).length;
  return { unlocked, total };
}
