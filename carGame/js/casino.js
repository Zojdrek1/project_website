import { el, showToast, drawSparkline } from './ui.js';

export function initCasino({ state, saveState, addMoney, addXP, currencySymbol, formatMoney, render }) {
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randi = (min, max) => Math.floor(rand(min, max));
  function setCasinoSession(active) {
    try {
      ensureCasinoUI();
      state.ui.casino.inSession = !!active;
    } catch {}
  }
  // --- Casino: Slots (Vegas 3x3, multi-line) ---
  const SLOTS_SYMBOLS = [
    { s: '🍒', w: 8, p3: 5, p2: 1.5 },
    { s: '🍋', w: 8, p3: 4, p2: 1.4 },
    { s: '🔔', w: 5, p3: 8, p2: 2.0 },
    { s: '⭐️', w: 4, p3: 12, p2: 3.0 },
    { s: '💎', w: 3, p3: 20, p2: 4.0 },
    { s: '7️⃣', w: 1, p3: 40, p2: 6.0 },
    // Wild substitutes on paylines; 3+ wilds anywhere award free spins
    { s: '🃏', w: 2, p3: 25, p2: 5.0, wild: true },
  ];
  const SLOTS_WEIGHTS = (() => { const arr=[]; SLOTS_SYMBOLS.forEach(sym => { for(let i=0;i<sym.w;i++) arr.push(sym); }); return arr; })();
  const PAYLINES = [
    [0,0,0], // top
    [1,1,1], // middle
    [2,2,2], // bottom
    [0,1,2], // diag down
    [2,1,0], // diag up
    [0,1,0], // V top
    [2,1,2], // V bottom
  ];
  function slotsPick() { return SLOTS_WEIGHTS[randi(0, SLOTS_WEIGHTS.length)].s; }
  function slotsGrid() { const g = []; for(let r=0;r<3;r++){ g[r]=[]; for(let c=0;c<3;c++){ g[r][c]=slotsPick(); } } return g; }
  const isWild = (s) => s === '🃏';
  function linePayout(grid, line, betPerLine) {
    const a = grid[line[0]][0], b = grid[line[1]][1], c = grid[line[2]][2];
    // Determine triple with wild substitution
    // Target symbol is the first non-wild encountered; if none, wild itself
    const firstNonWild = !isWild(a) ? a : (!isWild(b) ? b : (!isWild(c) ? c : '🃏'));
    const aMatch = isWild(a) || a === firstNonWild;
    const bMatch = isWild(b) || b === firstNonWild;
    const cMatch = isWild(c) || c === firstNonWild;
    if (aMatch && bMatch && cMatch) {
      const sym = SLOTS_SYMBOLS.find(x=>x.s===firstNonWild);
      return Math.round(betPerLine * (sym ? sym.p3 : 5));
    }
    // Pair pays on first two columns only (left-to-right), with wild substitution
    const firstTwoNonWild = !isWild(a) ? a : (!isWild(b) ? b : '🃏');
    const a2 = isWild(a) || a === firstTwoNonWild;
    const b2 = isWild(b) || b === firstTwoNonWild;
    if (a2 && b2) {
      const sym = SLOTS_SYMBOLS.find(x=>x.s===firstTwoNonWild);
      return Math.round(betPerLine * (sym ? sym.p2 : 1.5));
    }
    return 0;
  }
  function ensureCasinoUI() {
    if (!state.ui || typeof state.ui !== 'object') state.ui = {};
    if (!state.ui.casino || typeof state.ui.casino !== 'object') {
      state.ui.casino = { betPerLine: 100, lines: 5, grid: slotsGrid(), spinning: false, lastWin: 0, freeSpins: 0, sound: true, volume: 0.06, auto: { running: false, remaining: 0, stopOnWin: true }, forceScatterNext: false, pendingSpin: null, game: 'slots', bj: null, bjBet: 100, inSession: false };
      state.ui.casino.totalWinnings = 0;
    }
    const ui = state.ui.casino;
    if (!Array.isArray(ui.grid)) ui.grid = slotsGrid();
    for (let r=0;r<3;r++) {
      if (!Array.isArray(ui.grid[r])) ui.grid[r] = [];
      for (let c=0;c<3;c++) if (typeof ui.grid[r][c] !== 'string') ui.grid[r][c] = slotsPick();
    }
    if (typeof ui.betPerLine !== 'number' || !isFinite(ui.betPerLine)) ui.betPerLine = 100;
    if (typeof ui.lines !== 'number' || !isFinite(ui.lines)) ui.lines = 5;
    ui.lines = Math.max(1, Math.min(7, ui.lines));
    if (typeof ui.freeSpins !== 'number' || !isFinite(ui.freeSpins)) ui.freeSpins = 0;
    if (!('pendingSpin' in ui)) ui.pendingSpin = null;
    if (!('game' in ui)) ui.game = 'slots';
    if (!('bjBet' in ui)) ui.bjBet = 100;
    if (typeof ui.totalWinnings !== 'number') ui.totalWinnings = 0;
    // If page re-rendered mid-spin previously, ensure it is reset
    if (ui.spinning !== false) ui.spinning = false;
  }

  function renderCasino() {
    const view = document.getElementById('view');
    view.innerHTML = '';
    try {
      ensureCasinoUI();
      const ui = state.ui.casino;
    const tabs = document.createElement('div'); tabs.style.display='flex'; tabs.style.gap='8px'; tabs.style.justifyContent='center'; tabs.style.marginBottom='8px';
    const tabSlots = el('button', { class: 'btn' + (ui.game==='slots'?' good':''), text: '🎰 Slots' }); tabSlots.onclick = ()=>{ ui.game='slots'; saveState(); render(); };
    const tabBJ = el('button', { class: 'btn' + (ui.game==='blackjack'?' good':''), text: '🃑 Blackjack' }); tabBJ.onclick = ()=>{ ui.game='blackjack'; saveState(); render(); };
    tabs.appendChild(tabSlots); tabs.appendChild(tabBJ); view.appendChild(tabs);
    if (ui.game === 'blackjack') { renderBlackjack(); return; }
    const panel = el('div', { class: 'panel' }, [ el('div', { class: 'row' }, [ el('h3', { text: 'Casino — Slots' }), el('div', { class: 'spacer' }), el('span', { class: 'tag info', text: `${ui.lines} lines` }) ]) ]);
    const cont = document.createElement('div'); cont.className = 'slots'; panel.appendChild(cont);
    const layout = document.createElement('div'); layout.className = 'slots-layout'; cont.appendChild(layout);

    // Left column: timeline of past spins
    const leftCol = document.createElement('div'); leftCol.className = 'side'; layout.appendChild(leftCol);
    const timeline = document.createElement('div'); timeline.className = 'panelish timeline'; leftCol.appendChild(timeline);
    timeline.appendChild(el('div', { class: 'subtle', text: 'Timeline' }));
    const tlItems = document.createElement('div'); tlItems.className = 'items'; timeline.appendChild(tlItems);

    // Center: machine
    const machine = document.createElement('div'); layout.appendChild(machine);
    const marquee = document.createElement('div'); marquee.className = 'marquee'; marquee.textContent = 'Vegas 3×3'; machine.appendChild(marquee);
    const cab = document.createElement('div'); cab.className = 'cabinet'; machine.appendChild(cab);
    // Win counter (mechanical-style) above the reels
    const counter = document.createElement('div'); counter.className = 'win-counter';
    // Currency symbol element (fixed, non-flipping)
    const cur = document.createElement('div'); cur.className = 'counter-currency'; cur.textContent = currencySymbol(); counter.appendChild(cur);
    cab.appendChild(counter);
    const stage = document.createElement('div'); stage.className = 'stage'; cab.appendChild(stage);
    const reelsWrap = document.createElement('div'); reelsWrap.className = 'reels'; stage.appendChild(reelsWrap);
      const cellEls = [];
      for (let r=0;r<3;r++) {
        for (let c=0;c<3;c++) {
          const d = document.createElement('div'); d.className = 'cell'; d.textContent = (ui.grid[r]&&ui.grid[r][c]) || slotsPick();
          reelsWrap.appendChild(d); cellEls.push({el:d,r,c});
        }
      }
      // Controls (options under machine)
    const optionsBox = document.createElement('div'); optionsBox.className = 'panelish optionsbox'; machine.appendChild(optionsBox);
    const controls = document.createElement('div'); controls.className = 'controls'; optionsBox.appendChild(controls);
      const selBet = document.createElement('select'); [50,100,250,500,1000].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=formatMoney(v); if(ui.betPerLine===v)o.selected=true; selBet.appendChild(o); });
      selBet.onchange = ()=>{ ui.betPerLine = parseInt(selBet.value,10)||100; updateTotal(); saveState(); };
      const selLines = document.createElement('select'); [1,3,5,7].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=`${v} lines`; if(ui.lines===v)o.selected=true; selLines.appendChild(o); });
      selLines.onchange = ()=>{ ui.lines = parseInt(selLines.value,10)||3; updateTotal(); saveState(); };
      const total = document.createElement('span'); total.className='total';
      function updateTotal(){ total.textContent = `Total Bet: ${formatMoney(ui.betPerLine*ui.lines)}`; }
      updateTotal();
      const spinBtn = el('button', { class: 'btn good', text: 'Spin 🎰' });
    spinBtn.onclick = ()=> spinSlotsMulti(cellEls, spinBtn, stage);
      // Controls row: bet, lines, auto count, total
      const autoSel = document.createElement('select'); [10,25,50].forEach(v=>{ const o=document.createElement('option'); o.value=String(v); o.textContent=`Auto ${v}`; autoSel.appendChild(o); });
      autoSel.value = String((ui.auto && ui.auto.remaining) || 10);
      controls.appendChild(selBet); controls.appendChild(selLines); controls.appendChild(autoSel); controls.appendChild(total);
      const spinBox = document.createElement('div'); spinBox.className = 'panelish spinbox'; machine.appendChild(spinBox);
      const spinRow = document.createElement('div'); spinRow.className = 'row'; spinBox.appendChild(spinRow);
      spinRow.appendChild(spinBtn);
      // Auto toggle icon next to Spin
      const autoToggle = el('button', { class: 'btn auto-toggle' + ((ui.auto&&ui.auto.running)?' active':''), title: 'Auto Spin', text: '🔁' });
      const stopOnWin = document.createElement('label'); stopOnWin.style.display='inline-flex'; stopOnWin.style.alignItems='center'; stopOnWin.style.gap='6px'; stopOnWin.style.marginLeft='6px';
      const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = !!(ui.auto && ui.auto.stopOnWin !== false); chk.onchange = ()=>{ ui.auto.stopOnWin = chk.checked; saveState(); };
      stopOnWin.appendChild(chk); stopOnWin.appendChild(document.createTextNode('Stop on Win'));
      const toggleAuto = ()=>{
        ensureCasinoUI();
        if (!ui.auto) ui.auto = { running:false, remaining:0, stopOnWin:true };
        if (ui.auto.running) { ui.auto.running=false; autoToggle.classList.remove('active'); saveState(); return; }
        ui.auto.running=true; ui.auto.remaining = parseInt(autoSel.value||'10',10)||10; autoToggle.classList.add('active'); saveState();
        if (!ui.spinning) spinSlotsMulti(cellEls, spinBtn, stage);
      };
      autoToggle.onclick = toggleAuto;
      spinRow.appendChild(autoToggle);
      spinRow.appendChild(stopOnWin);
      // Free spins badge directly under the Spin button (centered by spinBox grid)
    const fsBadge = document.createElement('div'); fsBadge.className = 'fs-badge'; fsBadge.setAttribute('data-role','fs'); spinBox.appendChild(fsBadge);

    // Right column: Total winnings first, then rules, then paytable
    const colRight = document.createElement('div'); colRight.className = 'side'; layout.appendChild(colRight);
    const profitBox = document.createElement('div'); profitBox.className = 'panelish profit'; colRight.appendChild(profitBox);
    const profitLabel = document.createElement('div'); profitLabel.className='subtle'; profitLabel.textContent='Total Winnings'; profitBox.appendChild(profitLabel);
    const profitValue = document.createElement('div'); profitValue.className='result'; profitBox.appendChild(profitValue);
    const rulesBox = document.createElement('div'); rulesBox.className = 'panelish rules'; colRight.appendChild(rulesBox);
    const rulesInner = document.createElement('div'); rulesInner.className = 'inner'; rulesBox.appendChild(rulesInner);
    rulesInner.appendChild(el('div', { class: 'subtle', text: 'Rules' }));
    const rulesList = document.createElement('ul'); rulesInner.appendChild(rulesList);
    ;['Pays left-to-right on active lines','Three in a row pays most','Pairs pay on first two symbols only','🃏 is Wild and substitutes on lines','3+ 🃏 anywhere award 5 Free Spins','💰 Scatter: 3+ anywhere triggers Bonus Pick (x1–x10 of total bet)','Choose lines (1/3/5/7) and bet per line','Gambling carries risk — play responsibly'].forEach(t=>{ const li=document.createElement('li'); li.textContent=t; rulesList.appendChild(li); });
    // Left timeline was not created earlier, create now if missing
    const colLeft = layout.firstChild; // slots .side timeline container
    if (colLeft && colLeft.classList && colLeft.classList.contains('side')) {
      const tl = colLeft.querySelector('.timeline .items');
      if (tl) { tl.innerHTML = ''; }
    }
    // Paytable under rules
    const pay = document.createElement('div'); pay.className='panelish paytable'; colRight.appendChild(pay);
    SLOTS_SYMBOLS.slice().reverse().forEach(sym=>{
      pay.appendChild(el('div',{text:sym.s}));
      pay.appendChild(el('div',{text:`3× ${sym.p3}x`}));
      pay.appendChild(el('div',{text:`2× ${sym.p2}x`}));
    });
    view.appendChild(panel);
    // draw initial payline guides
    requestAnimationFrame(()=> {
      drawSlotsLines(stage, cellEls, ui.lines, []);
      setWinCounter((ui.lastWin||0), false);
      updateCounterCurrency();
      renderFreeSpins();
      // Keyboard shortcuts (attach once)
      if (!ui.__kb) {
        ui.__kb = true;
        window.addEventListener('keydown', (e)=>{
          try {
            if (e.target && (e.target.tagName==='INPUT' || e.target.tagName==='SELECT' || e.target.isContentEditable)) return;
            if (currentView !== 'casino') return;
            if (e.code==='Space') { e.preventDefault(); if (!ui.spinning) spinBtn.click(); return; }
            if (e.key==='1'||e.key==='3'||e.key==='5'||e.key==='7') { selLines.value=e.key; selLines.onchange(); return; }
            if (e.key==='+'||e.key==='=') { const idx=Math.min(selBet.options.length-1, selBet.selectedIndex+1); selBet.selectedIndex=idx; selBet.onchange(); return; }
            if (e.key==='-'||e.key==='_') { const idx=Math.max(0, selBet.selectedIndex-1); selBet.selectedIndex=idx; selBet.onchange(); return; }
            if (e.key.toLowerCase()==='a') { e.preventDefault(); toggleAuto(); return; }
            if (e.key==='Escape') { if (ui.auto && ui.auto.running){ toggleAuto(); } }
          } catch {}
        });
      }
      renderTimeline();
      renderProfit();
      syncTimelineHeight();
    });
    } catch (e) {
      const err = document.createElement('div'); err.className='panel'; err.textContent = 'Casino failed to render: ' + (e && e.message ? e.message : String(e));
      view.appendChild(err);
    }
  }

  // --- Casino: Blackjack ---
  function bjNewShoe(){ const cards=[]; const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const suits=['♠','♥','♦','♣']; for(const r of ranks){ for(const s of suits){ cards.push(r+s); } } for(let i=cards.length-1;i>0;i--){ const j=randi(0,i+1); const t=cards[i]; cards[i]=cards[j]; cards[j]=t; } return cards; }
  function bjHandValue(cards){ let sum=0, aces=0; for(const c of cards){ const r=c.startsWith('10')?'10':c[0]; if (r==='A'){ aces++; sum+=11; } else if (r==='K'||r==='Q'||r==='J'||r==='1'){ sum+=10; } else sum+=parseInt(r,10)||0; } while(sum>21 && aces>0){ sum-=10; aces--; } return sum; }
  function bjBlackjack(cards){ return cards.length===2 && bjHandValue(cards)===21; }
  function ensureBJ(){
    ensureCasinoUI(); // Ensures state.ui.casino exists
    const ui = state.ui.casino;
    if (!ui.bj || typeof ui.bj !== 'object') {
      // If bj object doesn't exist at all, create it fresh for a new game.
      ui.bj = { shoe: bjNewShoe(), player: [], dealer: [], phase:'idle', hideHole:true, stake: 100, lastStake: 0, recent: [], totalWinnings: 0, winningsHistory: [0] };
    }
    // Ensure all fields are valid on the existing object, which handles migration from older save states without resetting winnings.
    if (typeof ui.bj.stake !== 'number') ui.bj.stake = 100;
    if (typeof ui.bj.lastStake !== 'number') ui.bj.lastStake = 0;
    if (!Array.isArray(ui.bj.recent)) ui.bj.recent = [];
    if (typeof ui.bj.totalWinnings !== 'number') ui.bj.totalWinnings = 0;
    if (!Array.isArray(ui.bj.winningsHistory)) ui.bj.winningsHistory = [ui.bj.totalWinnings || 0];
    if (ui.bj.winningsHistory.length === 0) ui.bj.winningsHistory.push(ui.bj.totalWinnings || 0);
  }
  function bjStakeTotal(){ try { return state.ui.casino.bj.stake||0; } catch { return 0; } }
  function bjUpdateBetInfo(){ try { const inf=document.getElementById('bjBetInfo'); if (inf) inf.textContent = `Bet ${formatMoney(bjStakeTotal())}`; } catch {} }
  function bjDeal(){ ensureBJ(); const u=state.ui.casino; const b=u.bj; if (b.phase!=='idle'&&b.phase!=='done') return; const stake=b.stake; if (stake<=0){ showToast('Place your bet.', 'info'); return; } if (state.money < stake){ showToast('Not enough cash for this bet.', 'warn'); return; } addMoney(-stake, 'Blackjack bet'); b.lastStake=stake; b.player=[]; b.dealer=[]; b.shoe = (b.shoe && b.shoe.length>15)? b.shoe : bjNewShoe(); b.player.push(b.shoe.pop(), b.shoe.pop()); b.dealer.push(b.shoe.pop(), b.shoe.pop()); b.hideHole=true; b.phase='player';
    // The stack is cleared when the user next clicks a chip denomination,
    // not when the hand is dealt. This keeps the bet visible on the table.
    bjUpdateBetInfo();
    try { const t=document.getElementById('bjTable'); if (t){ t.classList.add('deal'); setTimeout(()=> t.classList.remove('deal'), 360); } } catch {} bjUpdateUI(); bjAnimDeal(); }
  function bjHit(){ const b=state.ui.casino.bj; if (!b||b.phase!=='player') return; b.player.push(b.shoe.pop()); if (bjHandValue(b.player)>21){ b.phase='done'; bjSettle(); } bjUpdateUI(); }
  function bjStand(){ const b=state.ui.casino.bj; if (!b||b.phase!=='player') return; b.phase='dealer'; bjRevealDealerSequence(); }

  function bjRevealDealerSequence(){
    try {
      const b=state.ui.casino.bj; if (!b) return;
      // Step 1: flip hole card
      b.hideHole = false;
      bjUpdateUI();
      try { casinoPlayCounterFlip(); } catch {}
      // Step 2: draw to 17, one by one
      const drawNext = () => {
        const dv = bjHandValue(b.dealer);
        if (dv >= 17) { b.phase='done'; bjSettle(); bjUpdateUI(); return; }
        // draw a card
        const c = b.shoe.pop();
        b.dealer.push(c);
        bjUpdateUI();
        try { casinoPlayCounterFlip(); } catch {}
        setTimeout(drawNext, 500);
      };
      setTimeout(drawNext, 500);
    } catch { bjUpdateUI(); }
  }
  function bjSettle(){ const u=state.ui.casino; const b=u.bj; const stake=b.lastStake||0; const pv=bjHandValue(b.player), dv=bjHandValue(b.dealer); let payout=0; let desc='Blackjack: ';
    if (pv>21){ desc+='Player bust'; payout=0; }
    else if (dv>21){ desc+='Dealer bust'; payout=stake*2; }
    else if (bjBlackjack(b.player) && !bjBlackjack(b.dealer)){ desc+='Player blackjack'; payout=Math.round(stake*2.5); }
    else if (bjBlackjack(b.dealer) && !bjBlackjack(b.player)){ desc+='Dealer blackjack'; payout=0; }
    else if (pv>dv){ desc+=pv+' vs '+dv; payout=stake*2; }
    else if (pv<dv){ desc+=pv+' vs '+dv; payout=0; }
    else { desc+='Push'; payout=stake; }
    if (payout>0) addMoney(payout, payout>stake? 'Blackjack win' : 'Blackjack push');
    try {
      const net = payout - stake;
      b.totalWinnings = (b.totalWinnings || 0) + net;
      if (!Array.isArray(b.recent)) b.recent = [];
      b.recent.push({ net, total: stake, win: payout, desc });
      if (!Array.isArray(b.winningsHistory)) b.winningsHistory = [0];
      b.winningsHistory.push(b.totalWinnings);
      if (b.winningsHistory.length > 100) b.winningsHistory.shift();
      if (b.recent.length > 100) b.recent.shift();
      renderBlackjackProfit();
      saveState();
    } catch {}
  }
  function renderBlackjack(){
    const view=document.getElementById('view');
    ensureCasinoUI();
    const ui=state.ui.casino;
    if (ui.game === 'blackjack' && ui.inSession !== true) {
      // Only reset session-specific data when entering a new blackjack session
      if (ui.bj && Array.isArray(ui.bj.recent)) {
        ui.bj.recent = [];
      }
    }
    ensureBJ(); const b=ui.bj; const panel = el('div', { class:'panel', id:'bjPanel' }); panel.appendChild(el('div', { class:'row' }, [ el('h3', { text:'Casino — Blackjack' }), el('div', { class:'spacer' }) ]));
    const table = document.createElement('div'); table.className='bj-table felt-anim'; table.id='bjTable'; panel.appendChild(table);
    // Left side (gameplay)
    const left = document.createElement('div'); left.className='bj-left'; left.id='bjLeft'; table.appendChild(left);
    // Winnings display (session and total)
    const profitBox = el('div', { class: 'bj-profit-container' }, [
      el('div', { class: 'bj-profit' }, [
        el('div', { class: 'subtle', text: 'Session' }),
        el('div', { class: 'result', id: 'bjProfitDisplay', text: '+/- $0' })
      ])
    ]);
    table.appendChild(profitBox);
    const overlay = document.createElement('div'); overlay.className='bj-overlay'; overlay.id='bjOverlay'; table.appendChild(overlay);
    const shoe = document.createElement('div'); shoe.className='bj-shoe'; shoe.id='bjShoe'; table.appendChild(shoe);
    // dealer
    const dRow=document.createElement('div'); dRow.className='bj-row bj-dealer-row'; left.appendChild(dRow);
    dRow.appendChild(el('div',{ class:'subtle', text:'Dealer' }));
    const dHandWrap=document.createElement('div'); dHandWrap.className='bj-cards'; dHandWrap.id='bjDealer'; dRow.appendChild(dHandWrap);
    const showDealerCards = b.dealer.map((c,i)=> (i===1 && b.hideHole)? '🂠' : c);
    showDealerCards.forEach(c=>{ const card=document.createElement('div'); card.className='bj-card'+((/♥|♦/.test(c))?' red':''); card.textContent = c; dHandWrap.appendChild(card); });
    const dVal = document.createElement('div'); dVal.className='bj-hand'; dVal.id='bjDealerVal'; if (b.phase!=='player' && b.dealer.length) dVal.textContent = `(${bjHandValue(b.dealer)})`; dRow.appendChild(dVal);
    // player
    const pRow=document.createElement('div'); pRow.className='bj-row bj-player-row'; left.appendChild(pRow);
    pRow.appendChild(el('div',{ class:'subtle', text:'Player' }));
    const pHandWrap=document.createElement('div'); pHandWrap.className='bj-cards'; pHandWrap.id='bjPlayer'; pRow.appendChild(pHandWrap);
    b.player.forEach(c=>{ const card=document.createElement('div'); card.className='bj-card'+((/♥|♦/.test(c))?' red':''); card.textContent=c; pHandWrap.appendChild(card); });
    const pVal = document.createElement('div'); pVal.className='bj-hand'; pVal.id='bjPlayerVal'; if (b.player.length) pVal.textContent = `(${bjHandValue(b.player)})`; pRow.appendChild(pVal);
    // Right side (controls with slider)
    const right = document.createElement('div'); right.className='bj-right'; right.id='bjRight'; table.appendChild(right);
    const betBox = document.createElement('div'); betBox.className = 'bj-bet-box'; right.appendChild(betBox);
    
    const betLabel = el('div', { class: 'bj-bet-label' }, [
      el('strong', { text: 'Your Bet' }),
      el('span', { id: 'bjBetDisplay', text: formatMoney(b.stake) })
    ]);
    betBox.appendChild(betLabel);
    
    const maxBet = Math.min(state.money, 50000);
    const betSlider = el('input', { type: 'range', min: '50', max: String(maxBet), step: '50', value: String(b.stake) });
    betSlider.id = 'bjBetSlider';
    betSlider.disabled = b.phase !== 'idle' && b.phase !== 'done';
    betSlider.oninput = () => {
      const v = parseInt(betSlider.value, 10);
      b.stake = v;
      const display = document.getElementById('bjBetDisplay');
      if (display) display.textContent = formatMoney(v);
      // No saveState() oninput for performance; will be saved on deal.
    };
    betBox.appendChild(betSlider);

    const dealBtn=el('button',{ class:'btn good', id:'bjDeal', text:(b.phase==='idle'||b.phase==='done')?'Deal':'In Round' }); dealBtn.disabled=!(b.phase==='idle'||b.phase==='done'); dealBtn.onclick=()=> bjDeal();
    const hitBtn=el('button',{ class:'btn', id:'bjHit', text:'Hit', onclick:()=> bjHit(), disabled: b.phase!=='player' });
    const standBtn=el('button',{ class:'btn', id:'bjStand', text:'Stand', onclick:()=> bjStand(), disabled: b.phase!=='player' });
    const ctr=document.createElement('div'); ctr.className='bj-controls'; betBox.appendChild(ctr);
    ctr.appendChild(dealBtn); ctr.appendChild(hitBtn); ctr.appendChild(standBtn);

    // status text
    const stat = document.createElement('div'); stat.className='bj-status'; stat.id='bjStatus'; left.appendChild(stat);
    // initial status text
    bjUpdateStatus();
    renderBlackjackProfit();

    // Winnings History Graph
    const historyPanel = el('div', { class: 'panel' }, [
      el('div', { class: 'row' }, [ el('h3', { text: 'Lifetime Winnings' }) ]),
      (() => {
        const c = el('canvas', { id: 'bjWinningsChart', width: 320, height: 80, style: 'width:100%; height:80px;' });
        const opts = {
          zeroLine: true,
          currentValue: b.totalWinnings,
          formatter: (v) => (v >= 0 ? '+' : '') + formatMoney(v)
        };
        setTimeout(() => drawSparkline(c, b.winningsHistory || [0], '#7ee787', opts), 0);
        return c;
      })()
    ]);

    view.appendChild(panel);
    view.appendChild(historyPanel);
  }

  function bjUpdateUI(){ try { const ui=state.ui.casino; if (!ui || !ui.bj) return; const b=ui.bj; const panel=document.getElementById('bjPanel'); if (!panel) { if (ui.game === 'blackjack') render(); return; }
    const dealerC=document.getElementById('bjDealer'); const dealerV=document.getElementById('bjDealerVal'); const playerC=document.getElementById('bjPlayer'); const playerV=document.getElementById('bjPlayerVal');
    if (dealerC){ dealerC.innerHTML=''; const show=b.dealer.map((c,i)=> (i===1 && b.hideHole)? '🂠' : c); show.forEach(c=>{ const d=document.createElement('div'); d.className='bj-card new'+((/♥|♦/.test(c))?' red':''); d.textContent=c; dealerC.appendChild(d); requestAnimationFrame(()=> d.classList.add('show')); }); }
    if (dealerV){ dealerV.textContent = (b.phase!=='player' && b.dealer.length)? `(${bjHandValue(b.dealer)})` : ''; }
    if (playerC){ playerC.innerHTML=''; b.player.forEach(c=>{ const d=document.createElement('div'); d.className='bj-card new'+((/♥|♦/.test(c))?' red':''); d.textContent=c; playerC.appendChild(d); requestAnimationFrame(()=> d.classList.add('show')); }); }
    if (playerV){ playerV.textContent = b.player.length? `(${bjHandValue(b.player)})` : ''; }
    const dealBtn=document.getElementById('bjDeal'), hitBtn=document.getElementById('bjHit'), standBtn=document.getElementById('bjStand'), slider=document.getElementById('bjBetSlider');
    if (dealBtn) dealBtn.disabled = !(b.phase==='idle'||b.phase==='done'), dealBtn.textContent=(b.phase==='idle'||b.phase==='done')?'Deal':'In Round';
    if (hitBtn) hitBtn.disabled = b.phase!=='player';
    if (standBtn) standBtn.disabled = b.phase!=='player';
    // Update chart
    const chart = document.getElementById('bjWinningsChart');
    if (chart) {
      const opts = {
        zeroLine: true,
        currentValue: b.totalWinnings,
        formatter: (v) => (v >= 0 ? '+' : '') + formatMoney(v)
      };
      drawSparkline(chart, b.winningsHistory || [0], '#7ee787', opts);
    }

    bjUpdateStatus();
  } catch {} }

  function bjUpdateStatus(){ try { const ui=state.ui.casino; const b=ui.bj; const el=document.getElementById('bjStatus'); if (!el) return; let txt=''; el.classList.remove('good','bad');
    const pv=bjHandValue(b.player||[]); const dv=bjHandValue(b.dealer||[]);
    if (b.phase==='idle') txt='Place your bet and Deal';
    else if (b.phase==='player') txt = `Your turn — ${pv}`;
    else if (b.phase==='dealer') txt = `Dealer plays…`;
    else if (b.phase==='done') {
      if (pv>21) { txt='Bust'; el.classList.add('bad'); }
      else if (dv>21) { txt='Dealer bust — You win!'; el.classList.add('good'); }
      else if (pv>dv) { txt='You win'; el.classList.add('good'); }
      else if (pv<dv) { txt='You lose'; el.classList.add('bad'); }
      else { txt='Push'; }
      txt += ` — ${pv} vs ${dv}`;
    }
    el.textContent = txt;
  } catch {} }

  function renderBlackjackProfit() {
    try {
      ensureBJ();
      const b = state.ui.casino.bj;
      const sessionEl = document.getElementById('bjProfitDisplay');
      if (sessionEl) {
        const sum = (b.recent || []).reduce((acc, r) => acc + (r.net || 0), 0);
        sessionEl.textContent = (sum >= 0 ? '+' : '') + formatMoney(sum);
        sessionEl.classList.toggle('gain', sum > 0);
        sessionEl.classList.toggle('loss', sum < 0);
      }
    } catch {}
  }
  function bjAnimDeal(){ try {
    const overlay=document.getElementById('bjOverlay'); const shoe=document.getElementById('bjShoe'); const dealer=document.getElementById('bjDealer'); const player=document.getElementById('bjPlayer'); if (!overlay||!shoe||!dealer||!player) return;
    const rO=overlay.getBoundingClientRect(); const rS=shoe.getBoundingClientRect();
    const startX = rS.left - rO.left + rS.width/2 - 17; const startY = rS.top - rO.top + rS.height/2 - 24;
    const targets=[player, dealer, player, dealer];
    targets.forEach((t,i)=>{
      setTimeout(()=>{
        const card=document.createElement('div'); card.className='bj-card fly'; card.textContent='🂠'; card.style.left=startX+'px'; card.style.top=startY+'px'; overlay.appendChild(card);
        const rT=t.getBoundingClientRect(); const dx=(rT.left - rO.left) + 6 + (t.children.length*10) - startX; const dy=(rT.top - rO.top) + 6 - startY;
        requestAnimationFrame(()=>{ card.style.transform=`translate(${dx}px, ${dy}px)`; card.style.opacity='0.96'; });
        setTimeout(()=>{ card.remove(); if (i===targets.length-1) bjUpdateUI(); try{ casinoPlayCounterFlip(); }catch{} }, 380);
      }, i*160);
    });
  } catch {} }
  function spinSlotsMulti(cellEls, spinBtn, stage){
    ensureCasinoUI();
    const ui = state.ui.casino;
    if (ui.spinning) return;
    const bet = Math.max(10, ui.betPerLine) * Math.max(1, Math.min(7, ui.lines));
    const isFree = (ui.freeSpins||0) > 0;
    const actualStake = isFree ? 0 : bet;
    if (!isFree && state.money < bet) { showToast('Not enough cash for this bet.', 'warn'); return; }
    ui.spinning = true; spinBtn.disabled=true;
    // initialize audio on user gesture and play start cue
    casinoEnsureAudio();
    if (ui.sound !== false) casinoPlayStart();
    // per-reel ticking handled per column (see below)
    // reset counter gold state on new spin
    try { const ctr = document.querySelector('.slots .cabinet .win-counter'); if (ctr) ctr.classList.remove('gold'); } catch {}
    // Reset counter to 0 immediately on spin start
    setWinCounter(0, false);
    if (isFree) { ui.freeSpins = Math.max(0, (ui.freeSpins||0) - 1); saveState(); }
    renderFreeSpins();
    if (actualStake > 0) addMoney(-actualStake, 'Slots spin');
    // clear win highlights
    document.querySelectorAll('.slots .cell.win').forEach(e=>e.classList.remove('win'));
    // spin animation (randomize then settle)
    // Preview active lines briefly, then spin
    drawSlotsLines(stage, cellEls, ui.lines, 'preview');
    const previewMs = 350;
    // Precompute final grid so each column can settle to its real symbols when it stops
    let finalGrid = slotsGrid();
    // Dev: force scatter bonus for next spin if requested
    if (ui.forceScatterNext) {
      try {
        const positions = Array.from({length:9}, (_,i)=>i).sort(()=>Math.random()-0.5).slice(0,3);
        positions.forEach(idx => { const r = Math.floor(idx/3), c = idx%3; finalGrid[r][c] = '💰'; });
      } catch {}
      ui.forceScatterNext = false; saveState();
    }
    setTimeout(()=>{
      clearSlotsLines(stage);
      // Fallback with column intervals to ensure visible updates across browsers
      const durations = [900, 1050, 1200];
      const delays = [0, 140, 280];
      let running = 0;
      const timers = [];
      // mark spinning and start intervals per column
      [0,1,2].forEach(col => {
        const colCells = cellEls.filter(c => c.c === col);
        colCells.forEach(c => c.el.classList.add('spin'));
        casinoTickStart(col);
        running++;
        const startCol = Date.now() + delays[col];
        const endAt = startCol + durations[col];
        const t = setInterval(()=>{
          const now = Date.now();
          if (now < startCol) return; // wait column delay
          // update visible symbols for this column
          colCells.forEach(c => { c.el.textContent = slotsPick(); });
          if (now >= endAt) {
            clearInterval(t);
            timers[col] = null;
            running--;
            // stop thunk and fix values immediately for this column
            colCells.forEach(c => { c.el.classList.remove('spin'); c.el.classList.add('stop'); c.el.textContent = finalGrid[c.r][c.c]; });
            casinoPlayStop(col);
            casinoTickStop(col);
            setTimeout(()=> colCells.forEach(c => c.el.classList.remove('stop')), 240);
            if (running === 0) finish();
          }
        }, 80);
        timers[col] = t;
      });
      // Safety fallback: ensure finish is called even if a timer was throttled
      setTimeout(()=>{ if (running > 0) { timers.forEach(x=> x && clearInterval(x)); finish(); } }, Math.max(...durations) + Math.max(...delays) + 200);
    }, previewMs);
    function finish(){
      const grid = finalGrid; ui.grid = grid;
      cellEls.forEach(c=>{ c.el.classList.remove('spin'); c.el.textContent = grid[c.r][c.c]; });
      // ensure all tickers are stopped
      casinoTickStop(0); casinoTickStop(1); casinoTickStop(2);
      // evaluate lines
      const linesToEval = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, ui.lines)));
      let totalWin = 0; const winners=[];
      linesToEval.forEach((ln, li)=>{
        const w = linePayout(grid, ln, ui.betPerLine);
        if (w>0) { totalWin += w; winners.push({ln}); }
      });
      // coin cascade ticks per winning lines
      try { if (winners.length) { const n = Math.min(10, winners.length*3); for(let i=0;i<n;i++){ setTimeout(()=> casinoPlayTick(), 40*i); } } } catch {}
      // highlight winners
      winners.forEach(w=>{ const ln = w.ln; for(let c=0;c<3;c++){ const r=ln[c]; const cell = cellEls.find(x=>x.r===r && x.c===c); if(cell) cell.el.classList.add('win'); } });
      // draw lines, highlighting winners, with flash after all columns stopped
      const winnerIdx = winners.map(w=> PAYLINES.findIndex(pl=> pl.length===w.ln.length && pl.every((v,i)=>v===w.ln[i]))).filter(i=>i>=0);
      drawSlotsLines(stage, cellEls, ui.lines, winnerIdx);
      ui.lastWin = totalWin;
      if (totalWin>0) { addMoney(totalWin, 'Slots win'); addXP(Math.min(25, Math.round(totalWin/400)), 'Slots'); }
      else addXP(2, 'Slots');
      if (totalWin>0) casinoPlayWin(totalWin);
      // Award free spins; capture scatter bonus state
      let triggeredBonus = false;
      try {
        const flat = grid.flat();
        const wilds = flat.filter(s => s === '🃏').length;
        if (wilds >= 3) {
          ui.freeSpins = (ui.freeSpins||0) + 5;
          showToast('Free Spins +5 (🃏)', 'good');
          renderFreeSpins();
        }
        // Bonus scatter: 3+ 💰 triggers pick bonus
        const scat = flat.filter(s => s === '💰').length;
        if (scat >= 3) {
          triggeredBonus = true;
          // store pending spin summary to combine with bonus payout
          try { ui.pendingSpin = { netBefore: totalWin - actualStake, stake: actualStake, baseWin: totalWin, desc: buildWinnersDescription(winners) }; saveState(); } catch {}
          bonusIntro(()=> showBonusPick(ui.betPerLine * ui.lines, () => { saveState(); }));
        }
      } catch {}
      // Update recent list with descriptive entry
      if (!triggeredBonus) {
        if (!Array.isArray(ui.recent)) ui.recent = [];
        const net = totalWin - actualStake;
        const desc = buildWinnersDescription(winners);
        ui.recent.push({ net, total: actualStake, win: totalWin, desc, free: isFree });
        if (ui.recent.length > 100) ui.recent.shift();
        ui.totalWinnings = (ui.totalWinnings || 0) + net;
      }
      saveState(); ui.spinning=false; spinBtn.disabled=false;
      // Result text removed (counter and timeline cover feedback)
      setWinCounter(totalWin, true);
      renderTimeline();
      renderProfit();
      syncTimelineHeight();
      // Auto-spin loop
      try {
        if (ui.auto && ui.auto.running) {
          if (ui.auto.stopOnWin && totalWin>0) { ui.auto.running=false; }
          else if (ui.auto.remaining>0) {
            ui.auto.remaining -= 1; saveState();
            setTimeout(()=>{ if (!ui.spinning) spinSlotsMulti(cellEls, spinBtn, stage); }, 500);
            return;
          } else { ui.auto.running=false; }
          saveState();
        }
      } catch {}
    }

    function renderRecent(){ renderTimeline(); syncTimelineHeight(); }
  }

  function buildWinnersDescription(winners){
    if (!winners || !winners.length) return 'No winning lines';
    const names = ['Top','Middle','Bottom','Diag ↓','Diag ↑','V-Top','V-Bot'];
    return winners.map(w => {
      const idx = PAYLINES.findIndex(pl=> pl.length===w.ln.length && pl.every((v,i)=>v===w.ln[i]));
      const name = idx>=0 ? names[idx] : 'Line';
      const ln = w.ln;
      const a = state.ui.casino.grid[ln[0]][0], b = state.ui.casino.grid[ln[1]][1], c = state.ui.casino.grid[ln[2]][2];
      const firstNonWild = !isWild(a) ? a : (!isWild(b) ? b : (!isWild(c) ? c : '🃏'));
      const triple = (isWild(a)||a===firstNonWild) && (isWild(b)||b===firstNonWild) && (isWild(c)||c===firstNonWild);
      const pair = (isWild(a)||a===(!isWild(a)?a:(!isWild(b)?b:'🃏'))) && (isWild(b)||b===(!isWild(a)?a:(!isWild(b)?b:'🃏')));
      const count = triple ? 3 : 2;
      const sym = firstNonWild;
      return `${name}: ${count}× ${sym}`;
    }).join(', ');
  }

  // Render the left-side timeline of recent slot results
  function renderTimeline() {
    try {
      ensureCasinoUI();
      const ui = state.ui.casino;
      const list = document.querySelector('.slots .timeline .items');
      if (!list) return;
      list.innerHTML = '';
      const items = (ui.recent || []).slice().reverse();
      items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'item';
        const net = document.createElement('div');
        net.className = 'net ' + (it.net >= 0 ? 'gain' : 'loss');
        net.textContent = (it.net >= 0 ? '+' : '') + formatMoney(it.net);
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = it.desc || (it.net > 0 ? 'Win' : 'No win');
        row.appendChild(net);
        row.appendChild(desc);
        list.appendChild(row);
      });
    } catch {}
  }

  // Render the aggregate profit/loss on the right side
  function renderProfit() {
    try {
      ensureCasinoUI();
      const ui = state.ui.casino;
      const pv = document.querySelector('.slots .profit .result');
      if (!pv) return;
      const sum = ui.totalWinnings || 0;
      pv.textContent = (sum >= 0 ? '+' : '') + formatMoney(sum);
      pv.classList.remove('gain','loss');
      if (sum > 0) pv.classList.add('gain');
      else if (sum < 0) pv.classList.add('loss');
    } catch {}
  }

  function renderFreeSpins() {
    try {
      ensureCasinoUI();
      const ui = state.ui.casino;
      const fs = (ui.freeSpins || 0);
      const el = document.querySelector('.slots .fs-badge[data-role="fs"]');
      if (!el) return;
      el.textContent = `Free Spins: ${fs}`;
      el.classList.toggle('active', fs > 0);
    } catch {}
  }

  // Simple bonus pick mini-game (scatter 3+)
  function showBonusPick(baseBet, done){
    try {
      const modal = document.createElement('div'); modal.className='race-modal open'; // reuse modal styles
      const backdrop = document.createElement('div'); backdrop.className='race-backdrop'; modal.appendChild(backdrop);
      const panel = document.createElement('div'); panel.className='race-panel bonus-panel'; modal.appendChild(panel);
      const title = document.createElement('div'); title.className='race-title'; title.textContent = 'Bonus Pick — Choose a Coin'; panel.appendChild(title);
      const hint = document.createElement('div'); hint.className='subtle'; hint.style.textAlign='center'; hint.textContent='Pick one to reveal a multiplier (x1–x10)'; panel.appendChild(hint);
      const rain = document.createElement('div'); rain.className='coin-rain'; panel.appendChild(rain);
      // continuous coin rain
      try {
        const spawn = ()=>{
          const batch = 6 + Math.floor(Math.random()*6);
          for (let i=0;i<batch;i++){
            const sp=document.createElement('span');
            sp.textContent = Math.random()<0.4? '🪙' : (Math.random()<0.5?'💰':'✨');
            sp.style.left = Math.round(Math.random()*100)+'%';
            sp.style.animationDuration = (2.2 + Math.random()*2.2)+'s';
            sp.style.animationDelay = (Math.random()*0.6)+'s';
            rain.appendChild(sp);
            // cleanup after animation
            setTimeout(()=> sp.remove(), 4500);
          }
        };
        spawn();
        panel.__coinRainTimer = setInterval(spawn, 700);
      } catch {}
      const area = document.createElement('div'); area.style.position='relative'; area.style.zIndex='1'; area.style.display='grid'; area.style.gridTemplateColumns='repeat(5, 1fr)'; area.style.gap='12px'; area.style.justifyItems='center'; area.style.margin='12px 0 8px'; panel.appendChild(area);
      const multipliers = [1,2,5,10,3];
      const shuffled = multipliers.sort(()=>Math.random()-0.5);
      shuffled.forEach(m=>{
        const b = document.createElement('button'); b.className='btn coin-btn'; b.style.minWidth='64px'; b.style.minHeight='64px';
        const inner = document.createElement('div'); inner.className='coin-inner';
        const front = document.createElement('div'); front.className='coin-face front'; front.textContent='💰';
        const back = document.createElement('div'); back.className='coin-face back'; back.textContent='x'+m;
        inner.appendChild(front); inner.appendChild(back); b.appendChild(inner);
        b.onclick = ()=>{
          const prize = Math.round((baseBet||0) * m);
          // flip reveal then award
          b.classList.add('reveal');
          try { casinoPlayCounterFlip(); } catch {}
          // disable other buttons
          Array.from(area.querySelectorAll('button')).forEach(btn=> btn.disabled=true);
          setTimeout(()=>{
            // Payout + feedback
            addMoney(prize, `Bonus x${m}`);
            showToast(`Bonus: x${m} → ${formatMoney(prize)}`, 'good');
            casinoPlayWin(prize);
            try { setWinCounter(prize, true); } catch {}
            try { bonusMoneyBurst(); } catch {}
            // Log into timeline (combine with pending spin if present)
            try {
              ensureCasinoUI();
              if (!Array.isArray(state.ui.casino.recent)) state.ui.casino.recent = [];
              const pend = state.ui.casino.pendingSpin;
              if (pend) {
                const beforeAmt = formatMoney(pend.baseWin || 0);
                const net = (pend.netBefore||0) + prize;
                const combinedDesc = `Bonus x${m} (${beforeAmt} won before bonus)`;
                const entry = { net, total: pend.stake||0, win: (pend.baseWin||0) + prize, desc: combinedDesc };
                state.ui.casino.pendingSpin = null;
                state.ui.casino.recent.push(entry);
                state.ui.casino.totalWinnings = (state.ui.casino.totalWinnings || 0) + net;
              } else {
                state.ui.casino.recent.push({ net: prize, total: 0, win: prize, desc: `Bonus x${m}` });
                state.ui.casino.totalWinnings = (state.ui.casino.totalWinnings || 0) + prize;
              }
              if (state.ui.casino.recent.length > 100) state.ui.casino.recent.shift();
              saveState();
              renderTimeline();
              renderProfit();
            } catch {}
            if (panel.__coinRainTimer) { clearInterval(panel.__coinRainTimer); }
            modal.remove();
            try { const ctr = document.querySelector('.slots .cabinet .win-counter'); if (ctr) ctr.classList.add('gold'); } catch {}
            try { setTimeout(()=> counterMoneyExplode(), 60); } catch {}
            done && done(prize);
          }, 480);
        }; area.appendChild(b);
      });
      // Remove close button — bonus must be picked
      document.body.appendChild(modal);
    } catch {}
  }

  // --- Casino Audio (simple WebAudio SFX) ---
  let casinoAudio = { ctx: null, master: null, spin: null, tickers: {} };
  function casinoEnsureAudio(force = false) {
    try {
      ensureCasinoUI();
      if (!force && state.ui.casino.sound === false) return;
      if (!casinoAudio.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
        const ctx = new Ctx();
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        casinoAudio.ctx = ctx; casinoAudio.master = masterGain;
        // Apply volume from state immediately
        casinoApplyVolume();
      }
      if (casinoAudio.ctx && casinoAudio.ctx.state === 'suspended') { casinoAudio.ctx.resume(); }
    } catch {}
  }
  function casinoPlayTest(){ try { casinoEnsureAudio(true); tone(660,0.12,'square',0.12); setTimeout(()=> tone(990,0.12,'square',0.12), 140); } catch {} }
  function casinoApplyVolume(){ try { ensureCasinoUI(); if (!casinoAudio.master) return; const v = Math.max(0, Math.min(1, (state.ui.casino.volume ?? 0.5))); casinoAudio.master.gain.value = (0.05 + 0.85 * v); } catch {} }
  function casinoPlayStart() { if (!casinoReady()) return; tone(740, 0.09, 'triangle', 0.08); setTimeout(()=> tone(880, 0.08, 'triangle', 0.08), 90); }
  function casinoPlayStop(col){ if (!casinoReady()) return; const base=180; const f= base + col*40; thunk(f); }
  function casinoPlayWin(amount){
    if (!casinoReady()) return;
    // Play 1–6 bright slot-style dings depending on win size
    const n = Math.max(1, Math.min(6, Math.ceil(amount / 3000))); // scale lightly
    for (let i=0;i<n;i++) setTimeout(()=> chime(1400 + i*60), i*130);
  }
  function chime(f=1400){
    try {
      if (!casinoAudio.ctx) return; const ctx = casinoAudio.ctx;
      // Fundamental + overtone for a metallic bell-like ping
      const o1 = ctx.createOscillator(); o1.type='sine'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type='triangle'; o2.frequency.value = f*2.01; // slight detune for shimmer
      const g = ctx.createGain(); const gain = sfxGain(0.12);
      g.gain.setValueAtTime(gain, ctx.currentTime);
      // Rapid decay with a short tail
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      // Subtle pitch drop for realism
      o1.frequency.exponentialRampToValueAtTime(f*0.96, ctx.currentTime + 0.18);
      o2.frequency.exponentialRampToValueAtTime(f*1.92, ctx.currentTime + 0.18);
      // Gentle highpass to reduce boom
      const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = 900; hp.Q.value = 0.7;
      o1.connect(g); o2.connect(g); g.connect(hp); hp.connect(casinoAudio.master);
      o1.start(); o2.start();
      const stopAt = ctx.currentTime + 0.24; o1.stop(stopAt); o2.stop(stopAt);
    } catch {}
  }
  function casinoPlayAward(){ if (!casinoReady()) return; const seq=[660,990,1320]; seq.forEach((f,i)=> setTimeout(()=> tone(f,0.12,'square',0.04), i*120)); }
  function casinoReady(){ try { ensureCasinoUI(); return state.ui.casino.sound !== false && casinoAudio.ctx && casinoAudio.master; } catch { return false; } }
  function casinoSpinStart(){ try { casinoSpinStop(); if (!casinoReady()) return; const ctx=casinoAudio.ctx; const src=ctx.createBufferSource(); const len = Math.floor(ctx.sampleRate * 0.4); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0); for(let i=0;i<len;i++){ data[i]=(Math.random()*2-1)*0.6; } src.buffer=buf; src.loop=true; const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=260; filter.Q.value=0.9; const g=ctx.createGain(); g.gain.value = sfxGain(0.10); src.connect(filter); filter.connect(g); g.connect(casinoAudio.master); src.start(); casinoAudio.spin = { src, g, filter }; } catch {} }
  function casinoSpinStop(){ try { if (casinoAudio.spin && casinoAudio.spin.src){ casinoAudio.spin.src.stop(); } casinoAudio.spin=null; } catch {} }
  function casinoPlayTick(){ if (!casinoReady()) return; tone(1800, 0.02, 'square', 0.09); }
  function casinoTickStart(col){ try { casinoTickStop(col); if (!casinoReady()) return; const base=[120,100,90][col]||110; const id = setInterval(()=> casinoPlayTick(), base); casinoAudio.tickers[col]=id; } catch {} }
  function casinoTickStop(col){ try { const id = casinoAudio.tickers && casinoAudio.tickers[col]; if (id) { clearInterval(id); casinoAudio.tickers[col]=null; } } catch {} }
  function sfxGain(x){ try { const ua = navigator.userAgent; const isSafari = /Safari\//.test(ua) && !/Chrome\//.test(ua); return isSafari ? x*2.2 : x; } catch { return x; } }
  function casinoPlayCounterFlip(){ if (!casinoReady()) return; tone(1200, 0.03, 'square', 0.06); }
  function tone(freq, dur, type='sine', gain=0.03){ try { if (!casinoAudio.ctx) return; const ctx=casinoAudio.ctx; const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.type=type; osc.frequency.value=freq; const gg=sfxGain(gain); g.gain.setValueAtTime(gg, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur); osc.connect(g); g.connect(casinoAudio.master); osc.start(); osc.stop(ctx.currentTime + dur); } catch {} }
  function thunk(freq=160){ try { if (!casinoAudio.ctx) return; const ctx=casinoAudio.ctx; const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.type='sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(freq*0.6, ctx.currentTime+0.08); const gg=sfxGain(0.05); g.gain.setValueAtTime(gg, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12); osc.connect(g); g.connect(casinoAudio.master); osc.start(); osc.stop(ctx.currentTime+0.13); // tiny noise click
    const buffer=ctx.createBuffer(1, ctx.sampleRate*0.06, ctx.sampleRate); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++){ data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2); } const src=ctx.createBufferSource(); src.buffer=buffer; const gn=ctx.createGain(); gn.gain.value=0.03; src.connect(gn); gn.connect(casinoAudio.master); src.start(); } catch {} }
  // Mechanical counter helpers for win display
  function ensureCounterDigits(container, count) {
    const digitsNow = Array.from(container.querySelectorAll('.counter-digit'));
    const need = 6; // fixed six digits
    const anchor = container.querySelector('.counter-currency');
    while (digitsNow.length < need) {
      const d = document.createElement('div'); d.className = 'counter-digit';
      const wheel = document.createElement('div'); wheel.className = 'counter-wheel';
      for (let i=0;i<10;i++) { const v=document.createElement('div'); v.className='counter-val'; v.textContent=String(i); wheel.appendChild(v); }
      d.appendChild(wheel);
      container.insertBefore(d, anchor ? anchor.nextSibling : null); // insert after currency if present
      digitsNow.push(d);
    }
    while (container.querySelectorAll('.counter-digit').length > need) {
      const el = container.querySelector('.counter-digit');
      if (!el) break;
      el.remove();
    }
  }

  function setWinCounter(value, animate=true) {
    try {
      const container = document.querySelector('.slots .cabinet .win-counter');
      if (!container) return;
      const v = Math.max(0, Math.floor(value || 0));
      const s = String(v).padStart(6,'0');
      ensureCounterDigits(container, s.length);
      const digits = Array.from(container.querySelectorAll('.counter-digit'));
      // Map digits right-aligned
      const pad = Math.max(digits.length - s.length, 0);
      // Measure a digit height for precise pixel translations
      const digitHeight = digits[0] ? Math.round(digits[0].getBoundingClientRect().height) : 44;
      // Ensure wheel total height is 10 * digitHeight
      digits.forEach((d)=>{ const wheel=d.firstChild; if (!wheel) return; wheel.style.height = (digitHeight * 10) + 'px'; });
      // Move wheels
      digits.forEach((d)=>{ const wheel=d.firstChild; if (!wheel) return; if (!animate) { wheel.style.transition='none'; } });
      // If not animating, set instantly and restore transition next tick
      const apply = () => {
        digits.forEach((d, idx)=>{
          const wheel=d.firstChild; if (!wheel) return;
          const ch = s[idx-pad] ? Number(s[idx-pad]) : 0;
          wheel.style.transform = `translateY(-${ch * digitHeight}px)`;
        });
      };
      if (!animate) {
        apply();
        requestAnimationFrame(()=>{ digits.forEach(d=>{ const wheel=d.firstChild; if (wheel) wheel.style.transition=''; }); });
        return;
      }
      // Animate from current to target
      requestAnimationFrame(apply);
      // Play a subtle flip cascade once per digit when animating
      try {
        for (let i=0;i<digits.length;i++) setTimeout(()=> casinoPlayCounterFlip && casinoPlayCounterFlip(), 60*i);
      } catch {}
    } catch {}
  }

  function updateCounterCurrency() {
    try {
      const el = document.querySelector('.slots .cabinet .win-counter .counter-currency');
      if (el) el.textContent = currencySymbol();
    } catch {}
  }

  // Simple money burst animation inside the cabinet
  function bonusMoneyBurst(){
    try {
      const cab = document.querySelector('.slots .cabinet');
      if (!cab) return;
      const n = 12;
      for (let i=0;i<n;i++){
        const s = document.createElement('div');
        s.textContent = Math.random()<0.5 ? '💸' : '🪙';
        s.style.position='absolute';
        s.style.pointerEvents='none';
        s.style.left = (35 + Math.random()*30) + '%';
        s.style.top = '40%';
        s.style.fontSize = (18 + Math.random()*10) + 'px';
        s.style.opacity = '0.95';
        cab.appendChild(s);
        const dx = (Math.random()*2-1) * 60;
        const dy = - (60 + Math.random()*50);
        const rot = (Math.random()*2-1) * 80;
        const dur = 600 + Math.random()*400;
        const start = performance.now();
        const step = (t)=>{
          const p = Math.min(1, (t-start)/dur);
          const ease = p*p*(3-2*p);
          s.style.transform = `translate(${dx*ease}px, ${dy*ease}px) rotate(${rot*ease}deg)`;
          s.style.opacity = String(0.95*(1-p));
          if (p<1) requestAnimationFrame(step); else s.remove();
        };
        requestAnimationFrame(step);
      }
      // coin tick flourish
      for (let j=0;j<8;j++) setTimeout(()=> casinoPlayTick && casinoPlayTick(), 30*j);
    } catch {}
  }

  // Burst from the win counter position after closing the bonus
  function counterMoneyExplode(){
    try {
      const cab = document.querySelector('.slots .cabinet');
      const ctr = document.querySelector('.slots .cabinet .win-counter');
      if (!cab || !ctr) return;
      const rcCab = cab.getBoundingClientRect();
      const rc = ctr.getBoundingClientRect();
      const startX = rc.left - rcCab.left + rc.width/2;
      const startY = rc.top - rcCab.top + rc.height/2;
      const n = 18;
      for (let i=0;i<n;i++){
        const el = document.createElement('div');
        el.textContent = Math.random()<0.5 ? '🪙' : '💸';
        el.style.position='absolute'; el.style.pointerEvents='none';
        el.style.left = startX + 'px'; el.style.top = startY + 'px';
        el.style.fontSize = (18 + Math.random()*10) + 'px';
        el.style.opacity = '0.98';
        cab.appendChild(el);
        const ang = Math.random()*Math.PI*2;
        const dist = 90 + Math.random()*120;
        const dx = Math.cos(ang)*dist;
        const dy = Math.sin(ang)*dist;
        const rot = (Math.random()*2-1)*180;
        const dur = 700 + Math.random()*500;
        const start = performance.now();
        const step = (t)=>{
          const p = Math.min(1, (t-start)/dur);
          const e = 1 - Math.pow(1-p, 2); // ease-out
          el.style.transform = `translate(${dx*e}px, ${dy*e}px) rotate(${rot*e}deg)`;
          el.style.opacity = String(0.98*(1-p));
          if (p<1) requestAnimationFrame(step); else el.remove();
        };
        requestAnimationFrame(step);
        // light coin ticks
        setTimeout(()=> { try { casinoPlayTick(); } catch {} }, i*25);
      }
    } catch {}
  }

  // Brief pre-bonus announcement: glow + sparkles + sound
  function bonusIntro(next){
    try {
      const cab = document.querySelector('.slots .cabinet'); if (!cab) { next && next(); return; }
      // overlay glow
      const glow = document.createElement('div'); glow.className='bonus-flash'; cab.appendChild(glow);
      // BIG BONUS banner
      const banner = document.createElement('div'); banner.className='bonus-banner'; banner.textContent='BONUS!'; cab.appendChild(banner);
      // sparkles
      for (let i=0;i<10;i++){
        const s = document.createElement('div'); s.textContent = Math.random()<0.5 ? '✨' : '💰';
        s.style.position='absolute'; s.style.pointerEvents='none'; s.style.left=(20+Math.random()*60)+'%'; s.style.top='55%'; s.style.fontSize=(18+Math.random()*10)+'px'; s.style.opacity='0.95';
        cab.appendChild(s);
        const dx=(Math.random()*2-1)*50, dy=-(40+Math.random()*40), rot=(Math.random()*2-1)*60, dur=520+Math.random()*180, start=performance.now();
        const step=(t)=>{ const p=Math.min(1,(t-start)/dur); const e=p*p*(3-2*p); s.style.transform=`translate(${dx*e}px, ${dy*e}px) rotate(${rot*e}deg)`; s.style.opacity=String(0.95*(1-p)); if(p<1) requestAnimationFrame(step); else s.remove(); };
        requestAnimationFrame(step);
      }
      // sound — bigger anticipation
      try { casinoPlayAward(); for(let j=0;j<10;j++) setTimeout(()=> casinoPlayTick(), 28*j); } catch {}
      setTimeout(()=>{ glow.remove(); banner.remove(); next && next(); }, 1200);
    } catch { next && next(); }
  }

  // Keep the left timeline max-height aligned to the height of the right panels
  function syncTimelineHeight() {
    try {
      const items = document.querySelector('.slots .timeline .items');
      if (!items) return;
      items.style.maxHeight = '25rem';
    } catch {}
  }

  function drawSlotsLines(stage, cellEls, linesCount, winnerIdx){
    try {
      // Remove any existing overlay
      const old = stage.querySelector('.lines'); if (old) old.remove();
      // If preview requested, draw all enabled lines in base style
      if (winnerIdx === 'preview') {
        const overlay = document.createElement('div'); overlay.className = 'lines';
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.appendChild(svg);
        stage.appendChild(overlay);
        const rectStage = stage.getBoundingClientRect();
        const enabled = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, linesCount)));
        enabled.forEach((ln)=>{
          const pts = [];
          for(let c=0;c<3;c++){
            const r = ln[c];
            const cell = cellEls.find(x=> x.r===r && x.c===c);
            if (!cell) return;
            const rc = cell.el.getBoundingClientRect();
            const x = rc.left - rectStage.left + rc.width/2;
            const y = rc.top - rectStage.top + rc.height/2;
            pts.push(`${x},${y}`);
          }
          if (pts.length===3){
            const pl = document.createElementNS('http://www.w3.org/2000/svg','polyline');
            pl.setAttribute('points', pts.join(' '));
            svg.appendChild(pl);
          }
        });
        return;
      }
      // Only draw when we actually have winners
      if (!Array.isArray(winnerIdx) || winnerIdx.length === 0) return;
      const overlay = document.createElement('div'); overlay.className = 'lines show';
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); overlay.appendChild(svg);
      stage.appendChild(overlay);
      const rectStage = stage.getBoundingClientRect();
      const enabled = PAYLINES.slice(0, Math.max(1, Math.min(PAYLINES.length, linesCount)));
      winnerIdx.forEach((idx)=>{
        const ln = enabled[idx];
        if (!ln) return;
        const pts = [];
        for(let c=0;c<3;c++){
          const r = ln[c];
          const cell = cellEls.find(x=> x.r===r && x.c===c);
          if (!cell) return;
          const rc = cell.el.getBoundingClientRect();
          const x = rc.left - rectStage.left + rc.width/2;
          const y = rc.top - rectStage.top + rc.height/2;
          pts.push(`${x},${y}`);
        }
        if (pts.length===3){
          const pl = document.createElementNS('http://www.w3.org/2000/svg','polyline');
          pl.setAttribute('points', pts.join(' '));
          pl.setAttribute('class','win');
          svg.appendChild(pl);
        }
      });
    } catch {}
  }

  function clearSlotsLines(stage){ const old = stage && stage.querySelector && stage.querySelector('.lines'); if (old) old.remove(); }

  return {
    setCasinoSession,
    ensureCasinoUI,
    renderCasino,
    casinoEnsureAudio,
    casinoApplyVolume,
    casinoPlayTest,
    renderFreeSpins,
    showBonusPick,
  };
}
