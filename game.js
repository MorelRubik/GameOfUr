/**
 * GIOCO REALE DI UR - LOGICA E MOTORE DI GIOCO
 * Regole di Irving Finkel (14 caselle + uscita esatta 15)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER (Web Audio API - Zero dipendenze esterne) ---
  class SoundEffects {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playDice() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const count = 5;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220 + Math.random() * 300, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.08);
        }, i * 60);
      }
    }

    playMove() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    }

    playCapture() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }

    playRosette() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.25);
        }, i * 90);
      });
    }

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.45);
        }, i * 140);
      });
    }
  }

  const sfx = new SoundEffects();

  // --- CONFIGURAZIONE PERCORSO E TABELLONE ---
  // Coordinate griglia 3 righe x 8 colonne:
  // riga 0: Bot
  // riga 1: Ponte centrale condiviso
  // riga 2: Giocatore umano

  const BOARD_ROWS = 3;
  const BOARD_COLS = 8;
  const TOTAL_PIECES = 7;

  // Caselle inesistenti (il "ponte stretto")
  const GAPS = new Set(['0,4', '0,5', '2,4', '2,5']);

  // Posizioni Rosette sulla griglia (riga, colonna)
  const ROSETTE_COORDS = new Set(['0,0', '2,0', '1,3', '0,6', '2,6']);

  // Percorsi dei giocatori: indici 1..14 (0 = riserva, 15 = uscita dal tabellone)
  const HUMAN_PATH = [
    null, // 0 = riserva
    { r: 2, c: 3 }, // 1
    { r: 2, c: 2 }, // 2
    { r: 2, c: 1 }, // 3
    { r: 2, c: 0 }, // 4 (Rosetta)
    { r: 1, c: 0 }, // 5 (Entra in corsia comune)
    { r: 1, c: 1 }, // 6
    { r: 1, c: 2 }, // 7
    { r: 1, c: 3 }, // 8 (Rosetta sicura centro)
    { r: 1, c: 4 }, // 9
    { r: 1, c: 5 }, // 10
    { r: 1, c: 6 }, // 11
    { r: 1, c: 7 }, // 12
    { r: 2, c: 7 }, // 13 (Rientra in corsia personale)
    { r: 2, c: 6 }  // 14 (Rosetta finale)
  ];

  const BOT_PATH = [
    null, // 0 = riserva
    { r: 0, c: 3 }, // 1
    { r: 0, c: 2 }, // 2
    { r: 0, c: 1 }, // 3
    { r: 0, c: 0 }, // 4 (Rosetta)
    { r: 1, c: 0 }, // 5 (Entra in corsia comune)
    { r: 1, c: 1 }, // 6
    { r: 1, c: 2 }, // 7
    { r: 1, c: 3 }, // 8 (Rosetta sicura centro)
    { r: 1, c: 4 }, // 9
    { r: 1, c: 5 }, // 10
    { r: 1, c: 6 }, // 11
    { r: 1, c: 7 }, // 12
    { r: 0, c: 7 }, // 13 (Rientra in corsia personale)
    { r: 0, c: 6 }  // 14 (Rosetta finale)
  ];

  const ROSETTE_STEPS = new Set([4, 8, 14]);

  // --- STATO DELLA PARTITA ---
  const state = {
    turn: 'human', // 'human' | 'bot'
    stage: 'roll', // 'roll' | 'move' | 'gameover'
    rollValue: null,
    diceResults: [0, 0, 0, 0],
    humanPieces: Array(TOTAL_PIECES).fill(0), // posizioni 0..15
    botPieces: Array(TOTAL_PIECES).fill(0),
    legalMoves: [], // array di pieceIndex
    difficulty: 'hard', // 'easy' | 'hard'
    isProcessing: false
  };

  // --- PATTERN SVG GRAFICA PER TESSERE ---
  function getTileSVG(type) {
    if (type === 'rosette') {
      return `
        <svg viewBox="0 0 100 100" class="tile-icon">
          <circle cx="50" cy="50" r="44" fill="#1b3457" stroke="#d4af37" stroke-width="3"/>
          <g transform="translate(50,50)">
            ${[0, 45, 90, 135, 180, 225, 270, 315].map(deg => `
              <g transform="rotate(${deg})">
                <path d="M 0 0 C 8 -18, 16 -24, 0 -38 C -16 -24, -8 -18, 0 0" fill="#f4ecdc" stroke="#997825" stroke-width="1.5"/>
                <circle cx="0" cy="-22" r="3" fill="#b22222"/>
              </g>
            `).join('')}
            <circle cx="0" cy="0" r="10" fill="#d4af37" stroke="#523420" stroke-width="2"/>
            <circle cx="0" cy="0" r="4" fill="#b22222"/>
          </g>
        </svg>
      `;
    }
    if (type === 'eyes') {
      return `
        <svg viewBox="0 0 100 100" class="tile-icon">
          <rect x="5" y="5" width="90" height="90" fill="#18273b" stroke="#684724" stroke-width="2"/>
          ${[
            [25, 25], [75, 25], [50, 50], [25, 75], [75, 75]
          ].map(([cx, cy]) => `
            <circle cx="${cx}" cy="${cy}" r="12" fill="#f4ecdc" stroke="#684724" stroke-width="2"/>
            <circle cx="${cx}" cy="${cy}" r="6" fill="#18273b"/>
            <circle cx="${cx}" cy="${cy}" r="2" fill="#d4af37"/>
          `).join('')}
        </svg>
      `;
    }
    if (type === 'dots5') {
      return `
        <svg viewBox="0 0 100 100" class="tile-icon">
          <rect x="5" y="5" width="90" height="90" fill="#1a2d45" stroke="#75502a" stroke-width="2"/>
          ${[
            [28, 28], [72, 28], [50, 50], [28, 72], [72, 72]
          ].map(([cx, cy]) => `
            <circle cx="${cx}" cy="${cy}" r="8" fill="#d4af37" stroke="#3b2311" stroke-width="2"/>
            <circle cx="${cx}" cy="${cy}" r="3" fill="#120c07"/>
          `).join('')}
          <line x1="20" y1="50" x2="80" y2="50" stroke="rgba(212,175,55,0.4)" stroke-width="1.5" stroke-dasharray="3,3"/>
          <line x1="50" y1="20" x2="50" y2="80" stroke="rgba(212,175,55,0.4)" stroke-width="1.5" stroke-dasharray="3,3"/>
        </svg>
      `;
    }
    // Pattern geometrico intarsio
    return `
      <svg viewBox="0 0 100 100" class="tile-icon">
        <rect x="5" y="5" width="90" height="90" fill="#152438" stroke="#5a3818" stroke-width="2"/>
        <line x1="5" y1="5" x2="95" y2="95" stroke="#8a6332" stroke-width="1.5"/>
        <line x1="95" y1="5" x2="5" y2="95" stroke="#8a6332" stroke-width="1.5"/>
        <polygon points="50,15 85,50 50,85 15,50" fill="none" stroke="#d4af37" stroke-width="2"/>
        <circle cx="50" cy="50" r="8" fill="#f4ecdc" stroke="#684724" stroke-width="1.5"/>
      </svg>
    `;
  }

  // --- ELEMENTI DOM ---
  const boardEl = document.getElementById('board');
  const rollBtn = document.getElementById('roll-btn');
  const turnText = document.getElementById('turn-text');
  const turnDot = document.getElementById('turn-dot');
  const diceScoreVal = document.getElementById('dice-score-val');
  const diceContainer = document.getElementById('dice-container');
  const humanPanel = document.getElementById('human-panel');
  const botPanel = document.getElementById('bot-panel');
  const humanStatus = document.getElementById('human-status');
  const botStatus = document.getElementById('bot-status');
  const humanReserveEl = document.getElementById('human-reserve');
  const humanExitedEl = document.getElementById('human-exited');
  const botReserveEl = document.getElementById('bot-reserve');
  const botExitedEl = document.getElementById('bot-exited');
  const difficultySelect = document.getElementById('difficulty-select');
  const soundBtn = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');
  const rulesBtn = document.getElementById('rules-btn');
  const rulesModal = document.getElementById('rules-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const restartBtn = document.getElementById('restart-btn');
  const victoryModal = document.getElementById('victory-modal');
  const victoryTitle = document.getElementById('victory-title');
  const victoryMsg = document.getElementById('victory-msg');
  const victoryRestartBtn = document.getElementById('victory-restart-btn');

  // --- CREAZIONE TABELLONE ---
  function buildBoardDOM() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const coordKey = `${r},${c}`;
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.id = `cell-${r}-${c}`;

        if (GAPS.has(coordKey)) {
          cell.classList.add('gap');
        } else {
          const isRosette = ROSETTE_COORDS.has(coordKey);
          if (isRosette) cell.classList.add('rosette');

          let patternType = 'geometric';
          if (isRosette) patternType = 'rosette';
          else if ((r + c) % 3 === 0) patternType = 'eyes';
          else if ((r + c) % 2 === 0) patternType = 'dots5';

          const artWrapper = document.createElement('div');
          artWrapper.className = 'cell-artwork';
          artWrapper.innerHTML = getTileSVG(patternType);
          cell.appendChild(artWrapper);

          // Clic su casella bersaglio (permette mossa cliccando la destinazione)
          cell.addEventListener('click', () => onCellClicked(r, c));
        }

        boardEl.appendChild(cell);
      }
    }
  }

  // --- GESTIONE DADI TETRAEDRICI ---
  function rollFourTetrahedralDice() {
    // 4 dadi piramidali, ciascuno con 2 punte segnate (1) e 2 bianche (0)
    const dice = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0));
    const score = dice.reduce((acc, v) => acc + v, 0);
    return { dice, score };
  }

  function animateDice(dice, score, callback) {
    sfx.playDice();
    const dieElements = diceContainer.querySelectorAll('.die');
    dieElements.forEach(el => el.classList.add('rolling'));
    rollBtn.disabled = true;

    setTimeout(() => {
      dieElements.forEach((el, idx) => {
        el.classList.remove('rolling');
        if (dice[idx] === 1) {
          el.classList.add('marked');
        } else {
          el.classList.remove('marked');
        }
      });
      diceScoreVal.textContent = score;
      callback();
    }, 450);
  }

  // --- CALCOLO MOSSE LEGALI ---
  function getLegalMoves(player, roll) {
    if (roll === 0) return [];

    const myPieces = player === 'human' ? state.humanPieces : state.botPieces;
    const enemyPieces = player === 'human' ? state.botPieces : state.humanPieces;
    const myPath = player === 'human' ? HUMAN_PATH : BOT_PATH;
    const enemyPath = player === 'human' ? BOT_PATH : HUMAN_PATH;

    const moves = [];

    // Controlla ogni pedina (0..6)
    for (let i = 0; i < TOTAL_PIECES; i++) {
      const currentPos = myPieces[i];

      // Se già uscita dal tabellone, non si muove
      if (currentPos >= 15) continue;

      const targetPos = currentPos + roll;

      // Oltre l'uscita esatta: illegale
      if (targetPos > 15) continue;

      // Uscita esatta dal tabellone: valida
      if (targetPos === 15) {
        moves.push(i);
        continue;
      }

      // Casella sul tabellone (1..14)
      const targetCoord = myPath[targetPos];

      // Non si può atterrare su una propria pedina
      const blockedByFriendly = myPieces.some((pos, idx) => idx !== i && pos === targetPos);
      if (blockedByFriendly) continue;

      // Controllo caselle condivise (5..12) con pedine nemiche
      if (targetPos >= 5 && targetPos <= 12) {
        // Rosetta centrale (pos 8): protetta, non catturabile se occupata da nemico
        if (targetPos === 8) {
          const enemyOnRosette = enemyPieces.some(pos => pos === 8);
          if (enemyOnRosette) continue; // Bloccata!
        }
      }

      moves.push(i);
    }

    return moves;
  }

  // --- ESECUZIONE DELLA MOSSA ---
  function applyMove(player, pieceIndex, roll) {
    const isHuman = player === 'human';
    const myPieces = isHuman ? state.humanPieces : state.botPieces;
    const enemyPieces = isHuman ? state.botPieces : state.humanPieces;

    const startPos = myPieces[pieceIndex];
    const targetPos = startPos + roll;
    myPieces[pieceIndex] = targetPos;

    let captured = false;
    let landedOnRosette = false;

    if (targetPos === 15) {
      // Pedina uscita
      sfx.playMove();
      setStatusMessage(isHuman ? 'Pedina portata fuori dal tabellone!' : 'Il Bot ha fatto uscire una pedina!');
    } else {
      // Controlla cattura nel ponte condiviso (5..12) tranne rosetta (8)
      if (targetPos >= 5 && targetPos <= 12 && targetPos !== 8) {
        const enemyIdx = enemyPieces.findIndex(pos => pos === targetPos);
        if (enemyIdx !== -1) {
          enemyPieces[enemyIdx] = 0; // Rimanda alla riserva
          captured = true;
          sfx.playCapture();
          setStatusMessage(isHuman ? 'CATTURA! Pedina nemica rispedita alla riserva!' : 'ATTENZIONE! Il Bot ha catturato una tua pedina!');
        }
      }

      if (!captured) sfx.playMove();

      // Controlla rosetta
      if (ROSETTE_STEPS.has(targetPos)) {
        landedOnRosette = true;
        sfx.playRosette();
        setStatusMessage(isHuman ? 'ROSETTA! Sei al sicuro e ottieni un altro lancio!' : 'Il Bot è atterrato su una Rosetta! Lancia ancora.');
      }
    }

    renderGame();

    // Verifica vittoria
    if (checkVictory()) return;

    // Risoluzione prossimo turno
    if (landedOnRosette) {
      // Stesso giocatore lancia di nuovo
      state.stage = 'roll';
      state.legalMoves = [];
      if (state.turn === 'human') {
        rollBtn.disabled = false;
        humanStatus.textContent = 'Hai diritto a un altro lancio!';
      } else {
        setTimeout(botTurn, 900);
      }
    } else {
      // Cambio turno
      switchTurn();
    }
  }

  function switchTurn() {
    state.turn = state.turn === 'human' ? 'bot' : 'human';
    state.stage = 'roll';
    state.legalMoves = [];
    state.rollValue = null;
    diceScoreVal.textContent = '-';

    renderGame();

    if (state.turn === 'human') {
      rollBtn.disabled = false;
      turnText.textContent = 'Tocca a te: lancia i dadi';
      humanStatus.textContent = 'Tuo turno';
      botStatus.textContent = 'In attesa...';
    } else {
      rollBtn.disabled = true;
      turnText.textContent = 'Turno del Bot...';
      botStatus.textContent = 'Sta pensando...';
      humanStatus.textContent = 'Attendi il bot...';
      setTimeout(botTurn, 750);
    }
  }

  function checkVictory() {
    const humanWon = state.humanPieces.every(pos => pos === 15);
    const botWon = state.botPieces.every(pos => pos === 15);

    if (humanWon || botWon) {
      state.stage = 'gameover';
      rollBtn.disabled = true;

      if (humanWon) {
        sfx.playVictory();
        victoryTitle.textContent = 'VITTORIA!';
        victoryMsg.textContent = 'Complimenti! Hai battuto il Bot salvando tutte e 7 le pedine.';
      } else {
        victoryTitle.textContent = 'SCONFITTA!';
        victoryMsg.textContent = 'Il Bot è riuscito a far uscire tutte le sue pedine prima di te.';
      }
      victoryModal.classList.add('open');
      return true;
    }
    return false;
  }

  function setStatusMessage(msg) {
    turnText.textContent = msg;
  }

  // --- INTELLIGENZA ARTIFICIALE BOT ---
  function botTurn() {
    if (state.stage === 'gameover' || state.turn !== 'bot') return;

    // 1. Lancio dei dadi
    const { dice, score } = rollFourTetrahedralDice();
    state.diceResults = dice;
    state.rollValue = score;

    animateDice(dice, score, () => {
      if (score === 0) {
        setStatusMessage('Il Bot ha ottenuto 0: nessun movimento.');
        setTimeout(switchTurn, 1000);
        return;
      }

      // 2. Calcola mosse possibili
      const legal = getLegalMoves('bot', score);
      if (legal.length === 0) {
        setStatusMessage('Il Bot non ha mosse legali possibili: turno passato.');
        setTimeout(switchTurn, 1000);
        return;
      }

      // 3. Selezione mossa in base alla difficoltà
      let chosenPiece;
      if (state.difficulty === 'easy') {
        // Facile: scelta puramente casuale tra quelle valide
        const randIdx = Math.floor(Math.random() * legal.length);
        chosenPiece = legal[randIdx];
      } else {
        // Difficile: Euristica strategica
        chosenPiece = evaluateBestBotMove(legal, score);
      }

      setTimeout(() => {
        applyMove('bot', chosenPiece, score);
      }, 700);
    });
  }

  function evaluateBestBotMove(legalMoves, roll) {
    let bestScore = -Infinity;
    let bestPiece = legalMoves[0];

    const humanPieces = state.humanPieces;
    const botPieces = state.botPieces;

    for (const pieceIdx of legalMoves) {
      const curPos = botPieces[pieceIdx];
      const targetPos = curPos + roll;
      let score = 0;

      // 1. Cattura pedina umana (+130)
      if (targetPos >= 5 && targetPos <= 12 && targetPos !== 8) {
        const hitsHuman = humanPieces.some(pos => pos === targetPos);
        if (hitsHuman) score += 130;
      }

      // 2. Conquista Rosetta (+100 per turno extra e sicurezza)
      if (ROSETTE_STEPS.has(targetPos)) {
        score += 100;
      }

      // 3. Portare fuori pedina dal tabellone (+90)
      if (targetPos === 15) {
        score += 90;
      }

      // 4. Salvare una propria pedina vulnerabile (+60)
      if (curPos >= 5 && curPos <= 12 && curPos !== 8) {
        const isThreatened = humanPieces.some(hPos => hPos < curPos && curPos - hPos <= 4 && hPos >= 1);
        if (isThreatened) score += 60;
      }

      // 5. Far entrare nuova pedina in gioco (+35)
      if (curPos === 0) {
        score += 35;
      }

      // 6. Avanzamento verso il traguardo
      score += targetPos * 2;

      // 7. Penalità se atterra in casella condivisa scoperta e minacciata da umano
      if (targetPos >= 5 && targetPos <= 12 && targetPos !== 8) {
        const wouldBeThreatened = humanPieces.some(hPos => hPos < targetPos && targetPos - hPos <= 4 && hPos >= 1);
        if (wouldBeThreatened) {
          score -= 45;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPiece = pieceIdx;
      }
    }

    return bestPiece;
  }

  // --- GESTIONE TURNO UMANO ---
  function onHumanRollClicked() {
    if (state.turn !== 'human' || state.stage !== 'roll') return;

    rollBtn.disabled = true;
    const { dice, score } = rollFourTetrahedralDice();
    state.diceResults = dice;
    state.rollValue = score;

    animateDice(dice, score, () => {
      if (score === 0) {
        setStatusMessage('Hai ottenuto 0: nessun movimento possibile.');
        setTimeout(switchTurn, 1000);
        return;
      }

      const legal = getLegalMoves('human', score);
      state.legalMoves = legal;

      if (legal.length === 0) {
        setStatusMessage('Nessuna mossa valida con questo lancio. Turno passato.');
        setTimeout(switchTurn, 1100);
        return;
      }

      state.stage = 'move';
      setStatusMessage(`Hai fatto ${score}. Clicca una pedina evidenziata per muoverla.`);
      renderGame();
    });
  }

  function onPieceClicked(player, pieceIndex) {
    if (state.turn !== 'human' || state.stage !== 'move') return;
    if (player !== 'human') return;

    if (state.legalMoves.includes(pieceIndex)) {
      state.stage = 'processing';
      applyMove('human', pieceIndex, state.rollValue);
    }
  }

  function onCellClicked(r, c) {
    if (state.turn !== 'human' || state.stage !== 'move') return;

    // Trova se una mossa legale porta a questa casella
    const matchingPiece = state.legalMoves.find(pieceIdx => {
      const targetPos = state.humanPieces[pieceIdx] + state.rollValue;
      if (targetPos === 15) return false;
      const coord = HUMAN_PATH[targetPos];
      return coord && coord.r === r && coord.c === c;
    });

    if (matchingPiece !== undefined) {
      state.stage = 'processing';
      applyMove('human', matchingPiece, state.rollValue);
    }
  }

  // --- RENDERING DELLA VISTA ---
  function renderGame() {
    // 1. Aggiorna stato indicatori turno
    turnDot.className = `turn-dot ${state.turn}`;
    if (state.turn === 'human') {
      humanPanel.classList.add('active-turn');
      botPanel.classList.remove('active-turn');
    } else {
      botPanel.classList.add('active-turn');
      humanPanel.classList.remove('active-turn');
    }

    // 2. Pulizia pedine dal tabellone
    document.querySelectorAll('.cell .piece').forEach(p => p.remove());
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('target-move'));

    // 3. Render pedine sul tabellone
    // Pedine Bot
    state.botPieces.forEach((pos, idx) => {
      if (pos >= 1 && pos <= 14) {
        const coord = BOT_PATH[pos];
        const cell = document.getElementById(`cell-${coord.r}-${coord.c}`);
        if (cell) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece bot-piece';
          pieceEl.dataset.idx = idx;
          cell.appendChild(pieceEl);
        }
      }
    });

    // Pedine Umano
    state.humanPieces.forEach((pos, idx) => {
      if (pos >= 1 && pos <= 14) {
        const coord = HUMAN_PATH[pos];
        const cell = document.getElementById(`cell-${coord.r}-${coord.c}`);
        if (cell) {
          const pieceEl = document.createElement('div');
          pieceEl.className = 'piece human-piece';
          pieceEl.dataset.idx = idx;

          // Se è selezionabile in questo turno
          if (state.turn === 'human' && state.stage === 'move' && state.legalMoves.includes(idx)) {
            pieceEl.classList.add('selectable');
            pieceEl.addEventListener('click', (e) => {
              e.stopPropagation();
              onPieceClicked('human', idx);
            });
          }

          cell.appendChild(pieceEl);
        }
      }
    });

    // 4. Evidenzia caselle destinazione valide per umano
    if (state.turn === 'human' && state.stage === 'move') {
      state.legalMoves.forEach(idx => {
        const targetPos = state.humanPieces[idx] + state.rollValue;
        if (targetPos < 15) {
          const coord = HUMAN_PATH[targetPos];
          const cell = document.getElementById(`cell-${coord.r}-${coord.c}`);
          if (cell) cell.classList.add('target-move');
        }
      });
    }

    // 5. Render riserve ed uscite
    renderPools();
  }

  function renderPools() {
    // Riserva Umano (pos === 0)
    humanReserveEl.innerHTML = '';
    const humanReserveIndices = [];
    state.humanPieces.forEach((pos, idx) => {
      if (pos === 0) humanReserveIndices.push(idx);
    });

    humanReserveIndices.forEach(idx => {
      const p = document.createElement('div');
      p.className = 'piece mini human-piece';
      if (state.turn === 'human' && state.stage === 'move' && state.legalMoves.includes(idx)) {
        p.classList.add('selectable');
        p.addEventListener('click', () => onPieceClicked('human', idx));
      }
      humanReserveEl.appendChild(p);
    });

    // Salvate Umano (pos === 15)
    humanExitedEl.innerHTML = '';
    state.humanPieces.filter(pos => pos === 15).forEach(() => {
      const p = document.createElement('div');
      p.className = 'piece mini human-piece';
      humanExitedEl.appendChild(p);
    });

    // Riserva Bot
    botReserveEl.innerHTML = '';
    state.botPieces.filter(pos => pos === 0).forEach(() => {
      const p = document.createElement('div');
      p.className = 'piece mini bot-piece';
      botReserveEl.appendChild(p);
    });

    // Salvate Bot
    botExitedEl.innerHTML = '';
    state.botPieces.filter(pos => pos === 15).forEach(() => {
      const p = document.createElement('div');
      p.className = 'piece mini bot-piece';
      botExitedEl.appendChild(p);
    });
  }

  // --- INIZIALIZZAZIONE E EVENT LISTENERS ---
  function resetGame() {
    state.turn = 'human';
    state.stage = 'roll';
    state.rollValue = null;
    state.diceResults = [0, 0, 0, 0];
    state.humanPieces = Array(TOTAL_PIECES).fill(0);
    state.botPieces = Array(TOTAL_PIECES).fill(0);
    state.legalMoves = [];
    state.difficulty = difficultySelect.value;

    rollBtn.disabled = false;
    diceScoreVal.textContent = '-';
    diceContainer.querySelectorAll('.die').forEach(d => {
      d.classList.remove('marked', 'rolling');
    });

    turnText.textContent = 'Tocca a te: lancia i dadi';
    humanStatus.textContent = 'Pronto a iniziare';
    botStatus.textContent = 'In attesa...';

    victoryModal.classList.remove('open');
    renderGame();
  }

  function setupEvents() {
    rollBtn.addEventListener('click', onHumanRollClicked);

    difficultySelect.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
    });

    soundBtn.addEventListener('click', () => {
      const enabled = sfx.toggle();
      soundIcon.textContent = enabled ? '🔊' : '🔇';
    });

    rulesBtn.addEventListener('click', () => rulesModal.classList.add('open'));
    modalCloseBtn.addEventListener('click', () => rulesModal.classList.remove('open'));
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) rulesModal.classList.remove('open');
    });

    restartBtn.addEventListener('click', resetGame);
    victoryRestartBtn.addEventListener('click', resetGame);
  }

  // Start!
  buildBoardDOM();
  setupEvents();
  resetGame();

})();
