// Race animation modal

import { MODELS } from './data.js';
import { el } from './ui.js';

const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function showRaceAnimation(car, event, outcome, done) {
  const modal = document.createElement('div');
  modal.className = 'race-modal open';
  modal.id = 'raceModal';
  const backdrop = document.createElement('div'); backdrop.className = 'race-backdrop'; backdrop.onclick = () => {};
  const panel = document.createElement('div'); panel.className = 'race-panel';
  // pick a simple opponent for the animation label
  const oppModel = sample(MODELS);
  const title = document.createElement('div'); title.className = 'race-title'; title.textContent = event.name;
  const track = document.createElement('div'); track.className = 'race-track';
  if (event.trackType) track.classList.add(`track-${event.trackType}`);
  const inner = document.createElement('div'); inner.className = 'race-track-inner'; track.appendChild(inner);
  const carEl = document.createElement('div'); carEl.className = 'race-car'; carEl.textContent = '🚗'; track.appendChild(carEl);
  const oppEl = document.createElement('div'); oppEl.className = 'race-car opponent'; oppEl.textContent = '🚙'; track.appendChild(oppEl);
  const flag = document.createElement('div'); flag.className = 'race-flag'; flag.textContent = '🏁'; track.appendChild(flag);
  const result = document.createElement('div'); result.className = 'race-result'; result.textContent = '';
  // legend + actions
  const legend = document.createElement('div'); legend.className = 'race-legend';
  legend.innerHTML = `<span class="tag">You (red 🚗): ${car.model}</span> <span class="tag">Rival (blue 🚙): ${oppModel.model}</span>`;
  const actions = document.createElement('div'); actions.className = 'race-actions';

  const startBtn = document.createElement('button'); startBtn.className = 'btn good'; startBtn.textContent = 'Start Race';
  const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.textContent = 'Skip';
  cancelBtn.onclick = () => {
    modal.remove();
    done && done();
  };
  actions.appendChild(startBtn); actions.appendChild(cancelBtn);
  panel.appendChild(title); panel.appendChild(legend); panel.appendChild(track); panel.appendChild(actions); panel.appendChild(result);
  modal.appendChild(backdrop); modal.appendChild(panel);
  document.body.appendChild(modal);
  // Configure endpoints based on outcome (player leads slightly on win)
  if (outcome.failedPart) {
    carEl.style.setProperty('--end', 'calc(100% - 80px)');
    oppEl.style.setProperty('--end', 'calc(100% - 44px)');
  } else if (outcome.win) {
    carEl.style.setProperty('--end', 'calc(100% - 44px)');
    oppEl.style.setProperty('--end', 'calc(100% - 64px)');
  } else {
    carEl.style.setProperty('--end', 'calc(100% - 64px)');
    oppEl.style.setProperty('--end', 'calc(100% - 44px)');
  }
  carEl.style.setProperty('--dur', '2.2s');
  oppEl.style.setProperty('--dur', '2.2s');
  // Start handler to launch animation
  startBtn.onclick = () => {
    startBtn.disabled = true;
    cancelBtn.disabled = true;
    carEl.classList.add('run');
    oppEl.classList.add('run');
    setTimeout(() => {
      if (outcome.failedPart) { result.textContent = 'DNF — part failed!'; result.style.color = '#ff9e9e'; }
      else if (outcome.win) { result.textContent = 'Victory!'; result.style.color = '#c9f7cf'; }
      else { result.textContent = 'Defeat'; result.style.color = '#cfe8ff'; }
    }, 1400);
    setTimeout(() => {
      modal.classList.remove('open');
      modal.remove();
      done && done();
    }, 2200);
  };
}