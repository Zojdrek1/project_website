import { PARTS } from './data.js';
// Race animation modal

import { MODELS } from './data.js';
import { el } from './ui.js';

const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function showRaceAnimation(car, event, outcome, done) {
  // Helper: get part name from key
  function getPartName(key) {
    const p = PARTS.find(p => p.key === key);
    return p ? p.name : key;
  }
  // Helper: show fail smoke/emoji
  function showFailEffect() {
    // Red flash overlay
    const failOverlay = document.createElement('div');
    failOverlay.className = 'race-fail-overlay';
    panel.appendChild(failOverlay);
    setTimeout(() => failOverlay.classList.add('active'), 10);
    setTimeout(() => failOverlay.classList.remove('active'), 900);
    setTimeout(() => failOverlay.remove(), 1300);
    // Smoke and sad emoji
    const smoke = document.createElement('div');
    smoke.className = 'race-fail-smoke';
    smoke.innerHTML = '💨💨<span class="fail-emoji">😢</span>';
    carEl.appendChild(smoke);
    setTimeout(() => smoke.remove(), 1800);
  }
  // Confetti rain for win (from top of screen)
  function showConfettiRain() {
    const rain = document.createElement('div');
    rain.className = 'global-confetti-rain';
    for (let i = 0; i < 64; ++i) {
      const piece = document.createElement('div');
      piece.className = 'global-confetti-rain-piece';
      piece.style.left = (Math.random() * 100) + 'vw';
      piece.style.background = `hsl(${Math.floor(Math.random()*360)},90%,70%)`;
      piece.style.animationDelay = (Math.random() * 0.8) + 's';
      rain.appendChild(piece);
    }
    document.body.appendChild(rain);
    setTimeout(() => rain.remove(), 2200);
  }
  // Global confetti for win (explosion around modal)
  function showGlobalConfetti() {
    const confetti = document.createElement('div');
    confetti.className = 'global-confetti-explosion';
    for (let i = 0; i < 48; ++i) {
      const piece = document.createElement('div');
      piece.className = 'global-confetti-piece';
      const angle = (i / 48) * 2 * Math.PI;
      const dist = 120 + Math.random() * 60;
      piece.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      piece.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      piece.style.background = `hsl(${Math.floor(Math.random()*360)},90%,70%)`;
      confetti.appendChild(piece);
    }
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1200);
  }
  const modal = document.createElement('div');
  modal.className = 'race-modal open';
  modal.id = 'raceModal';
  const backdrop = document.createElement('div'); backdrop.className = 'race-backdrop'; backdrop.onclick = () => {};
  const panel = document.createElement('div'); panel.className = 'race-panel';
  // Confetti for win
  const confetti = document.createElement('div');
  confetti.className = 'race-confetti';
  for (let i = 0; i < 24; ++i) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = `hsl(${Math.floor(Math.random()*360)},90%,70%)`;
    confetti.appendChild(piece);
  }
  panel.appendChild(confetti);
  // Camera zoom overlay
  const zoomer = document.createElement('div');
  zoomer.className = 'race-zoomer';
  panel.appendChild(zoomer);
  // Background flash
  const flash = document.createElement('div');
  flash.className = 'race-flash';
  panel.appendChild(flash);
  // pick a simple opponent for the animation label
  const oppModel = sample(MODELS);
  const title = document.createElement('div'); title.className = 'race-title'; title.textContent = event.name;
  const track = document.createElement('div'); track.className = 'race-track';
  if (event.trackType) track.classList.add(`track-${event.trackType}`);
  // Speed lines effect
  const speedLines = document.createElement('div'); speedLines.className = 'race-speed-lines';
  for (let i = 0; i < 12; ++i) {
    const line = document.createElement('div');
    line.className = 'race-speed-line';
    line.style.left = `${8 + i * 7}%`;
    speedLines.appendChild(line);
  }
  track.appendChild(speedLines);
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
  const closeBtn = document.createElement('button'); closeBtn.className = 'btn'; closeBtn.textContent = 'Close';
  closeBtn.style.display = 'none';
  closeBtn.onclick = () => {
    modal.remove();
    done && done();
  };
  actions.appendChild(startBtn); actions.appendChild(cancelBtn); actions.appendChild(closeBtn);
  panel.appendChild(title); panel.appendChild(legend); panel.appendChild(track); panel.appendChild(actions); panel.appendChild(result);
  modal.appendChild(backdrop); modal.appendChild(panel);
  document.body.appendChild(modal);
  // --- Smooth race with overtakes as visual cues ---
  // Both cars move smoothly to the finish, but z-index/glow/offset simulates overtakes
  const raceDuration = 4800; // ms
  const overtakeStages = 5;
  let leadArr = [];
  for (let i = 0; i < overtakeStages - 1; ++i) leadArr.push(Math.random() < 0.5 ? 'car' : 'opp');
  if (outcome.failedPart) leadArr.push('opp');
  else if (outcome.win) leadArr.push('car');
  else leadArr.push('opp');

  // Set initial positions
  carEl.style.left = '0%';
  oppEl.style.left = '0%';
  carEl.style.transition = `left ${raceDuration}ms linear`;
  oppEl.style.transition = `left ${raceDuration}ms linear`;
  // Track width in percent (0% to 88% previously, now use 94% for longer track)

  // Overtake visual: z-index and glow
  function setLeadVisual(leader) {
    carEl.classList.remove('leader');
    oppEl.classList.remove('leader');
    if (leader === 'car') {
      carEl.style.zIndex = 4;
      oppEl.style.zIndex = 3;
      carEl.style.filter = 'drop-shadow(0 0 8px #fff7)';
      oppEl.style.filter = '';
      carEl.classList.add('leader');
    } else {
      carEl.style.zIndex = 3;
      oppEl.style.zIndex = 4;
      oppEl.style.filter = 'drop-shadow(0 0 8px #fff7)';
      carEl.style.filter = '';
      oppEl.classList.add('leader');
    }
  }

  // Start handler to launch animation
  startBtn.onclick = () => {
    startBtn.disabled = true;
    cancelBtn.disabled = true;
    speedLines.classList.add('active');
    carEl.classList.add('shaking');
    oppEl.classList.add('shaking');
    // Animate overtakes as visual cues
    let stage = 0;
    setLeadVisual(leadArr[0]);
    const overtakeInterval = raceDuration / overtakeStages;
    const overtakeTimer = setInterval(() => {
      stage++;
      setLeadVisual(leadArr[stage] || leadArr[leadArr.length-1]);
      if (stage >= overtakeStages-1) clearInterval(overtakeTimer);
    }, overtakeInterval);
    // Remove shake after 1s
    setTimeout(() => {
      carEl.classList.remove('shaking');
      oppEl.classList.remove('shaking');
    }, 1000);
    // Camera zoom at penultimate stage
    setTimeout(() => { zoomer.classList.add('active'); }, raceDuration - overtakeInterval);
    // Move both cars to finish
    setTimeout(() => {
      // End positions: car at 94% or 88%, opp at 88% or 94%
      // Winner is slightly ahead
      let carEnd = 88, oppEnd = 88;
      if (outcome.failedPart) { carEnd = 80; oppEnd = 94; }
      else if (outcome.win) { carEnd = 94; oppEnd = 88; }
      else { carEnd = 88; oppEnd = 94; }
      carEl.style.left = carEnd + '%';
      oppEl.style.left = oppEnd + '%';
    }, 10); // allow transition to apply
    // After raceDuration, show result
    setTimeout(() => {
      speedLines.classList.remove('active');
      if (outcome.win) {
        carEl.classList.add('finish-pop');
        confetti.classList.add('active');
        flash.classList.add('active');
        showGlobalConfetti();
        showConfettiRain();
        // Extra: more confetti rain and green glow
        setTimeout(() => showConfettiRain(), 400);
        setTimeout(() => showConfettiRain(), 900);
        panel.classList.add('race-win-glow');
      } else if (outcome.failedPart) {
        carEl.classList.add('fail-shake');
        flash.classList.add('fail');
        showFailEffect();
      } else {
        oppEl.classList.add('finish-pop');
        flash.classList.add('active');
        // Dramatic red overlay for loss
        const loseOverlay = document.createElement('div');
        loseOverlay.className = 'race-lose-overlay';
        panel.appendChild(loseOverlay);
        setTimeout(() => loseOverlay.classList.add('active'), 10);
        setTimeout(() => loseOverlay.classList.remove('active'), 900);
        setTimeout(() => loseOverlay.remove(), 1300);
        // Sad emoji on your car
        const sad = document.createElement('div');
        sad.className = 'race-lose-emoji';
        sad.textContent = '😞';
        carEl.appendChild(sad);
        setTimeout(() => sad.remove(), 1800);
      }
      let noteHtml = '';
      if (event.resultNotes) {
        if (outcome.win && event.resultNotes.win) noteHtml = `<div class="race-result-note">${event.resultNotes.win}</div>`;
        else if (!outcome.win && event.resultNotes.loss) noteHtml = `<div class="race-result-note">${event.resultNotes.loss}</div>`;
      }
      if (outcome.failedPart) {
        const partName = getPartName(outcome.failedPart);
        result.innerHTML = `DNF — <span class=\"fail-part\">${partName}</span> failed! <span class=\"fail-emoji\">💥</span>${noteHtml}`;
        result.style.color = '#ff4e4e';
      }
      else if (outcome.win) {
        result.innerHTML = `<span class="race-win-text">Victory! 🎉</span>${noteHtml}`;
        result.style.color = '#5ed68a';
      }
      else {
        result.innerHTML = `<span class="race-lose-text">Defeat <span class="fail-emoji">😞</span></span>${noteHtml}`;
        result.style.color = '#ff9e9e';
      }
    }, raceDuration + 200);
    setTimeout(() => {
      confetti.classList.remove('active');
      zoomer.classList.remove('active');
      flash.classList.remove('active', 'fail');
      closeBtn.style.display = '';
    }, raceDuration + 1400);
  };
}
