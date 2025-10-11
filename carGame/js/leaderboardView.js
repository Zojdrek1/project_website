import { el } from './ui.js';
import { LEADERBOARD_CATEGORIES } from './leaderboard.js';

export function renderLeaderboardView({ state, fmt, leaderboards = {}, profileId = null, alias = 'Crew Chief' }) {
  const view = document.getElementById('view');
  if (!view) return;
  view.innerHTML = '';
  view.setAttribute('data-current-view', 'leaderboard');

  const header = el('div', { class: 'panel leaderboard-panel-header' }, [
    el('div', { class: 'row' }, [
      el('h2', { text: 'Leaderboards' }),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tag info', text: 'Local best scores' }),
    ]),
    el('div', { class: 'subtle', text: `Alias: ${alias}` }),
  ]);
  view.appendChild(header);

  const groups = [];
  for (const [key, def] of Object.entries(LEADERBOARD_CATEGORIES)) {
    const categoryKey = def.key;
    const entries = Array.isArray(leaderboards[categoryKey]) ? leaderboards[categoryKey] : [];
    if (!entries.length) {
      groups.push(el('div', { class: 'leaderboard-group empty' }, [
        el('h4', { text: def.label }),
        el('div', { class: 'subtle', text: 'No entries yet.' }),
      ]));
      continue;
    }
    const rows = entries.map((entry, idx) => {
      const isMe = profileId && entry.profileId === profileId;
      return el('div', { class: 'leaderboard-entry' + (isMe ? ' me' : '') }, [
        el('span', { class: 'pos', text: `#${idx + 1}` }),
        (() => {
          const wrap = el('div', { class: 'alias-block' });
          wrap.appendChild(el('span', { class: 'alias', text: entry.alias || 'Crew' }));
          if (entry.meta && (entry.meta.rankName || entry.meta.season)) {
            const rankText = entry.meta.champion ? 'Champion' : (entry.meta.rankName || 'Entry');
            const seasonText = entry.meta.season ? `Season ${entry.meta.season}` : null;
            const metaLabel = seasonText ? `${rankText} • ${seasonText}` : rankText;
            wrap.appendChild(el('span', { class: 'meta', text: metaLabel }));
          }
          return wrap;
        })(),
        (() => {
          let display = String(entry.value || '—');
          if (key === 'netWorth') display = fmt.format(entry.value || 0);
          else if (key === 'level') display = `Lv ${entry.value || 1}`;
          else if (key === 'league') display = entry.meta && entry.meta.champion ? 'Champion' : (entry.meta && entry.meta.rankName) ? entry.meta.rankName : `Score ${entry.value}`;
          return el('span', { class: 'value', text: display });
        })(),
      ]);
    });
    groups.push(el('div', { class: 'leaderboard-group' }, [
      el('h4', { text: def.label }),
      ...rows,
    ]));
  }

  const grid = el('div', { class: 'leaderboard-groups' }, groups);
  view.appendChild(el('div', { class: 'leaderboard-panel' }, [grid]));
}
