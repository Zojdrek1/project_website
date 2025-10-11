const STEP_PADDING = 18;

const TUTORIAL_STEPS = [
  {
    id: 'dashboard-overview',
    view: 'dashboard',
    selector: '[data-tour-id="dashboard-overview"]',
    placement: 'right',
    title: 'Command Center',
    body: 'Track cash, garage value, heat, and league progress from the Summary tab before making moves.',
  },
  {
    id: 'heat-meter',
    view: 'dashboard',
    selector: '#heat',
    placement: 'bottom',
    offset: 24,
    radius: 22,
    title: 'Heat Meter',
    body: 'Heat measures police attention. High heat risks fines or impounds—cool it off before it caps out.',
  },
  {
    id: 'market-buy',
    view: 'market',
    selector: '[data-tour-id="market-buy"]',
    placement: 'right',
    title: 'Source Inventory',
    body: 'Browse the Illegal Market for flips. Listings update constantly, so grab bargains before prices swing.',
  },
  {
    id: 'garage-repair',
    view: 'garage',
    selector: '[data-tour-id="garage-repair"]',
    placement: 'right',
    title: 'Restore & Tune',
    body: 'Repair worn parts and apply tuning upgrades here so your car is ready for races.',
  },
  {
    id: 'races-enter',
    view: 'street_races',
    selector: '[data-tour-id="races-enter"]',
    placement: 'left',
    title: 'Race For Profit',
    body: 'Street races provide fast cash and XP. Pick a car with enough performance to beat the opposing crew.',
  },
  {
    id: 'league-racing',
    view: 'league',
    selector: '[data-tour-id="league-overview"]',
    placement: 'left',
    title: 'League Racing',
    body: 'Structured heats, bigger stakes. Win matches to climb ranks, lose too much and you will fall.',
  },
  {
    id: 'casino-games',
    view: 'casino',
    selector: '[data-tour-id="casino-overview"]',
    placement: 'left',
    title: 'Casino Lounge',
    body: 'Slots and blackjack are optional gambles—fun when you are flush, but do not bank the business on them.',
  },
];

let ctx = null;
let active = false;
let stepIndex = -1;
let stepToken = null;
let currentTarget = null;

let overlay = null;
let hole = null;
let tooltip = null;
let counterEl = null;
let titleEl = null;
let bodyEl = null;
let prevBtn = null;
let nextBtn = null;
let skipBtn = null;

function ensureTutorialState(state) {
  if (!state) return {};
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  if (!state.ui.tutorial || typeof state.ui.tutorial !== 'object') state.ui.tutorial = {};
  const tutorial = state.ui.tutorial;
  if (typeof tutorial.completed !== 'boolean') tutorial.completed = false;
  if (typeof tutorial.dismissedAt !== 'number') tutorial.dismissedAt = 0;
  return tutorial;
}

function ensureDom() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'tutorialOverlay';
  overlay.className = 'tutorial-overlay';

  hole = document.createElement('div');
  hole.className = 'tutorial-hole';
  overlay.appendChild(hole);
  document.body.appendChild(overlay);

  tooltip = document.createElement('div');
  tooltip.className = 'tutorial-tooltip';

  counterEl = document.createElement('div');
  counterEl.className = 'tutorial-counter';
  titleEl = document.createElement('h4');
  bodyEl = document.createElement('p');

  const controls = document.createElement('div');
  controls.className = 'tutorial-controls';

  skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'btn ghost tutorial-skip';
  skipBtn.textContent = 'Skip';

  const spacer = document.createElement('div');
  spacer.className = 'spacer';

  prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn tutorial-prev';
  prevBtn.textContent = 'Back';

  nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn primary tutorial-next';
  nextBtn.textContent = 'Next';

  controls.append(skipBtn, spacer, prevBtn, nextBtn);
  tooltip.append(counterEl, titleEl, bodyEl, controls);
  document.body.appendChild(tooltip);

  skipBtn.addEventListener('click', () => finishTutorial(false));
  prevBtn.addEventListener('click', () => previousStep());
  nextBtn.addEventListener('click', () => nextStep());

  window.addEventListener('resize', handleReposition, { passive: true });
  window.addEventListener('scroll', handleReposition, { passive: true });
}

function setVisible(visible) {
  if (!overlay || !tooltip) return;
  overlay.classList.toggle('active', visible);
  tooltip.classList.toggle('active', visible);
  tooltip.style.pointerEvents = visible ? 'auto' : 'none';
  if (visible) {
    document.documentElement.classList.add('tutorial-active');
    document.body.classList.add('tutorial-active');
  } else {
    document.documentElement.classList.remove('tutorial-active');
    document.body.classList.remove('tutorial-active');
    currentTarget = null;
    hole.style.width = '0px';
    hole.style.height = '0px';
  }
}

function handleReposition() {
  if (!active || !currentTarget) return;
  positionCurrentStep();
}

function positionCurrentStep(step = TUTORIAL_STEPS[stepIndex], target = currentTarget) {
  if (!step || !target) return;
  const rect = target.getBoundingClientRect();
  positionHole(rect, step);
  positionTooltip(rect, step);
}

function positionHole(rect, step) {
  const padding = typeof step.padding === 'number' ? step.padding : STEP_PADDING;
  const radius = typeof step.radius === 'number' ? step.radius : 20;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const left = Math.max(8, rect.left - padding);
  const top = Math.max(8, rect.top - padding);
  const right = Math.min(vw - 8, rect.right + padding);
  const bottom = Math.min(vh - 8, rect.bottom + padding);

  hole.style.left = `${left}px`;
  hole.style.top = `${top}px`;
  hole.style.width = `${Math.max(0, right - left)}px`;
  hole.style.height = `${Math.max(0, bottom - top)}px`;
  hole.style.borderRadius = `${radius}px`;
}

function positionTooltip(rect, step) {
  const offset = typeof step.offset === 'number' ? step.offset : 20;
  const placement = step.placement || 'right';

  // Prime layout
  tooltip.style.left = '-9999px';
  tooltip.style.top = '-9999px';
  const tipWidth = tooltip.offsetWidth;
  const tipHeight = tooltip.offsetHeight;

  let left = rect.right + offset;
  let top = rect.top;

  switch (placement) {
    case 'left':
      left = rect.left - tipWidth - offset;
      top = rect.top;
      break;
    case 'top':
      left = rect.left;
      top = rect.top - tipHeight - offset;
      break;
    case 'bottom':
      left = rect.left;
      top = rect.bottom + offset;
      break;
    case 'right':
    default:
      left = rect.right + offset;
      top = rect.top;
      break;
  }

  const margin = 16;
  const maxLeft = window.innerWidth - tipWidth - margin;
  const maxTop = window.innerHeight - tipHeight - margin;

  left = Math.max(margin, Math.min(left, maxLeft));
  top = Math.max(margin, Math.min(top, maxTop));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function updateControls() {
  if (!tooltip) return;
  const total = TUTORIAL_STEPS.length;
  const atStart = stepIndex <= 0;
  const atEnd = stepIndex >= total - 1;
  if (prevBtn) prevBtn.disabled = atStart;
  if (nextBtn) nextBtn.textContent = atEnd ? 'Finish' : 'Next';
  if (counterEl) counterEl.textContent = `Step ${Math.max(1, stepIndex + 1)} of ${total}`;
}

async function runStep() {
  if (!active || !ctx) return;
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) {
    finishTutorial(true);
    return;
  }

  updateControls();
  const token = Symbol('tutorial-step');
  stepToken = token;

  if (typeof ctx.setView === 'function') ctx.setView(step.view);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!active || stepToken !== token) return;

  const target = await waitForElement(step.selector, step.waitRetries ?? 60);
  if (!active || stepToken !== token) return;

  if (!target) {
    nextStep();
    return;
  }

  currentTarget = target;
  if (step.scroll !== false) {
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } catch {
      target.scrollIntoView();
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!active || stepToken !== token) return;
  }

  if (titleEl) titleEl.textContent = step.title || '';
  if (bodyEl) bodyEl.textContent = step.body || '';

  positionCurrentStep(step, target);
}

function nextStep() {
  if (!active) return;
  if (stepIndex >= TUTORIAL_STEPS.length - 1) {
    finishTutorial(true);
    return;
  }
  stepIndex += 1;
  runStep();
}

function previousStep() {
  if (!active) return;
  if (stepIndex <= 0) return;
  stepIndex -= 1;
  runStep();
}

function finishTutorial(completed) {
  if (!active) {
    setVisible(false);
    return;
  }
  active = false;
  stepIndex = -1;
  currentTarget = null;
  stepToken = null;
  setVisible(false);
  if (ctx) {
    const tutorial = ensureTutorialState(ctx.state);
    if (completed) tutorial.completed = true;
    tutorial.dismissedAt = Date.now();
    if (typeof ctx.saveState === 'function') ctx.saveState();
  }
}

async function waitForElement(selector, retries = 60) {
  for (let i = 0; i <= retries; i += 1) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  return null;
}

export function initTutorial({ state, setView, saveState }) {
  ctx = { state, setView, saveState };
  ensureTutorialState(state);
  ensureDom();
}

export function startTutorial({ force = false } = {}) {
  if (!ctx) return false;
  ensureDom();
  const tutorial = ensureTutorialState(ctx.state);
  if (tutorial.completed && !force) return false;
  active = true;
  stepIndex = 0;
  currentTarget = null;
  setVisible(true);
  runStep();
  return true;
}

export function stopTutorial() {
  finishTutorial(false);
}

export function isTutorialActive() {
  return active;
}

export function resetTutorialProgress() {
  if (!ctx) return;
  const tutorial = ensureTutorialState(ctx.state);
  tutorial.completed = false;
  tutorial.dismissedAt = 0;
  if (typeof ctx.saveState === 'function') ctx.saveState();
}
