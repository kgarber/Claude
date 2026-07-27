/* ============================================================
   app.js — Elfer Raus! Online
   One file, three jobs:
     1. Game engine  (runs on the host, the single source of truth)
     2. Networking   (PeerJS / WebRTC — host relays state to guests)
     3. UI           (renders whatever view the host sends us)
   ============================================================ */

'use strict';

/* ---------------------------------------------------------- *
 *  Constants & tiny helpers
 * ---------------------------------------------------------- */

const COLORS = ['red', 'yellow', 'green', 'blue'];
const COLOR_EMOJI = { red: '🔴', yellow: '🟡', green: '🟢', blue: '🔵' };
const HAND_SIZES = { 2: 20, 3: 18, 4: 15, 5: 12, 6: 10 };
const MAX_PLAYERS = 6;
const ROOM_PREFIX = 'elfer-raus-v1-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

function cardKey(card) { return card.c + '-' + card.n; }

/** Is `card` legal to play on `board`? (board = {red:{low,high,open}, ...}) */
function isLegalPlay(card, board, boardEmpty) {
  if (boardEmpty) return card.c === 'red' && card.n === 11; // red 11 opens the game
  const row = board[card.c];
  if (!row.open) return card.n === 11;                       // 11s open their row
  return card.n === row.low - 1 || card.n === row.high + 1;  // extend by exactly one
}

function isBoardEmpty(board) { return COLORS.every(c => !board[c].open); }

/* ---------------------------------------------------------- *
 *  Sound — tiny WebAudio bleeps, no assets needed
 * ---------------------------------------------------------- */

const Sound = (() => {
  let ac = null;
  let muted = false;

  function ensure() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, start, dur, type = 'triangle', vol = 0.12) {
    const ctx = ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }

  return {
    toggle() { muted = !muted; return muted; },
    get muted() { return muted; },
    pop()  { if (!muted) tone(520 + Math.random() * 120, 0, 0.12); },
    open() { if (!muted) { tone(440, 0, 0.12); tone(660, 0.09, 0.16); } },
    draw() { if (!muted) { tone(330, 0, 0.12, 'sawtooth', 0.06); tone(262, 0.1, 0.16, 'sawtooth', 0.06); } },
    turn() { if (!muted) { tone(523, 0, 0.1); tone(784, 0.09, 0.14); } },
    win()  {
      if (muted) return;
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.22, 'triangle', 0.14));
    },
  };
})();

/* ---------------------------------------------------------- *
 *  Game engine (HOST ONLY) — the single source of truth
 * ---------------------------------------------------------- */

const Engine = {
  state: null,

  newLobby() {
    this.state = {
      phase: 'lobby',            // 'lobby' | 'playing' | 'over'
      players: [],               // {pid, name, hand:[], connected}
      board: null,
      stock: [],
      turnIdx: 0,
      turnPlayed: 0,
      eventSeq: 0,
      lastEvent: null,
      rankings: null,
    };
  },

  addPlayer(pid, name) {
    const s = this.state;
    if (s.phase !== 'lobby') return { ok: false, reason: 'Game already in progress — catch the next round!' };
    if (s.players.filter(p => p.connected).length >= MAX_PLAYERS) {
      return { ok: false, reason: 'Table is full (6 max). Even dad minivans have limits.' };
    }
    s.players.push({ pid, name, hand: [], connected: true });
    return { ok: true };
  },

  removePlayer(pid) {
    const s = this.state;
    const idx = s.players.findIndex(p => p.pid === pid);
    if (idx === -1) return;
    if (s.phase === 'lobby') {
      s.players.splice(idx, 1);
    } else {
      s.players[idx].connected = false;
      if (s.phase === 'playing' && idx === s.turnIdx) this.advanceTurn();
    }
  },

  deal() {
    const s = this.state;
    const n = s.players.length;
    const deck = [];
    for (const c of COLORS) for (let num = 1; num <= 20; num++) deck.push({ c, n: num });
    shuffle(deck);

    const handSize = HAND_SIZES[n];
    for (const p of s.players) p.hand = deck.splice(0, handSize);
    s.stock = deck;

    // The red 11 must be in somebody's hand — it opens the game.
    if (!s.players.some(p => p.hand.some(k => k.c === 'red' && k.n === 11))) {
      const stockIdx = s.stock.findIndex(k => k.c === 'red' && k.n === 11);
      const lucky = s.players[Math.floor(Math.random() * n)];
      const swapIdx = Math.floor(Math.random() * lucky.hand.length);
      const swapped = lucky.hand[swapIdx];
      lucky.hand[swapIdx] = s.stock[stockIdx];
      s.stock[stockIdx] = swapped;
    }

    for (const p of s.players) this.sortHand(p.hand);

    s.board = {};
    for (const c of COLORS) s.board[c] = { low: 0, high: 0, open: false };
    s.turnIdx = s.players.findIndex(p => p.hand.some(k => k.c === 'red' && k.n === 11));
    s.turnPlayed = 0;
    s.phase = 'playing';
    s.rankings = null;
    this.pushEvent({ kind: 'deal', starter: s.players[s.turnIdx].name });
  },

  sortHand(hand) {
    hand.sort((a, b) => COLORS.indexOf(a.c) - COLORS.indexOf(b.c) || a.n - b.n);
  },

  pushEvent(ev) {
    this.state.eventSeq++;
    this.state.lastEvent = { seq: this.state.eventSeq, ...ev };
  },

  /** Handle an action from player `pid`. Returns {ok, reason?}. */
  applyAction(pid, action) {
    const s = this.state;
    if (s.phase !== 'playing') return { ok: false, reason: 'The game is not running.' };
    const idx = s.players.findIndex(p => p.pid === pid);
    if (idx !== s.turnIdx) return { ok: false, reason: "Whoa there — it's not your turn!" };
    const player = s.players[idx];

    if (action.kind === 'play') {
      const card = action.card;
      const handIdx = player.hand.findIndex(k => k.c === card.c && k.n === card.n);
      if (handIdx === -1) return { ok: false, reason: "That card isn't in your hand. Nice try, magician." };
      if (!isLegalPlay(card, s.board, isBoardEmpty(s.board))) {
        return { ok: false, reason: "That card doesn't fit anywhere." };
      }

      player.hand.splice(handIdx, 1);
      const row = s.board[card.c];
      let opened = false;
      if (!row.open) { row.open = true; row.low = 11; row.high = 11; opened = true; }
      else if (card.n === row.low - 1) row.low = card.n;
      else row.high = card.n;
      s.turnPlayed++;

      if (player.hand.length === 0) {
        s.phase = 'over';
        s.rankings = [...s.players]
          .sort((a, b) => a.hand.length - b.hand.length)
          .map(p => ({ name: p.name, left: p.hand.length }));
        this.pushEvent({ kind: 'win', player: player.name, card });
      } else {
        this.pushEvent({ kind: 'play', player: player.name, card, opened, left: player.hand.length });
      }
      return { ok: true };
    }

    if (action.kind === 'end') {
      if (s.turnPlayed < 1) return { ok: false, reason: 'You must play at least one card — or draw.' };
      this.advanceTurn();
      return { ok: true };
    }

    if (action.kind === 'draw') {
      if (s.turnPlayed > 0) return { ok: false, reason: "You already played this turn — end it instead." };
      const drawn = s.stock.splice(0, Math.min(3, s.stock.length));
      player.hand.push(...drawn);
      this.sortHand(player.hand);
      this.pushEvent(drawn.length
        ? { kind: 'draw', player: player.name, count: drawn.length }
        : { kind: 'pass', player: player.name });
      this.advanceTurn();
      return { ok: true };
    }

    return { ok: false, reason: 'Unknown action.' };
  },

  advanceTurn() {
    const s = this.state;
    const n = s.players.length;
    for (let step = 1; step <= n; step++) {
      const idx = (s.turnIdx + step) % n;
      if (s.players[idx].connected) { s.turnIdx = idx; break; }
    }
    s.turnPlayed = 0;
  },

  /** Build the personalized view for one player (hide other hands!). */
  viewFor(pid) {
    const s = this.state;
    const idx = s.players.findIndex(p => p.pid === pid);
    return {
      phase: s.phase,
      players: s.players.map((p, i) => ({
        name: p.name, count: p.hand.length, connected: p.connected, current: i === s.turnIdx,
      })),
      board: s.board,
      stockCount: s.stock.length,
      turnIdx: s.turnIdx,
      turnPlayed: s.turnPlayed,
      you: idx === -1 ? null : { idx, hand: s.players[idx].hand },
      event: s.lastEvent,
      rankings: s.rankings,
    };
  },
};

/* ---------------------------------------------------------- *
 *  Networking — PeerJS. Host owns the game; guests send actions.
 * ---------------------------------------------------------- */

const Net = {
  peer: null,
  isHost: false,
  roomCode: null,
  conns: new Map(),   // host: pid -> DataConnection
  hostConn: null,     // guest: connection to host
  myName: 'Player',

  host(name, onReady, onFail) {
    this.myName = name;
    this.isHost = true;
    this.roomCode = makeCode();
    this.peer = new Peer(ROOM_PREFIX + this.roomCode, { debug: 1 });

    this.peer.on('open', () => {
      Engine.newLobby();
      Engine.addPlayer('host', name);
      onReady(this.roomCode);
    });

    this.peer.on('connection', (conn) => {
      conn.on('open', () => {
        const guestName = String(conn.metadata?.name || 'Mystery Guest').slice(0, 14);
        const res = Engine.addPlayer(conn.peer, guestName);
        if (!res.ok) {
          conn.send({ type: 'rejected', reason: res.reason });
          setTimeout(() => conn.close(), 400);
          return;
        }
        this.conns.set(conn.peer, conn);
        UI.toast(`${guestName} ${randomJoke('join')}`);
        Sound.pop();
        this.broadcast();
        UI.renderLobby();
      });
      conn.on('data', (msg) => this.onGuestMessage(conn.peer, msg));
      const drop = () => {
        if (!this.conns.has(conn.peer)) return;
        this.conns.delete(conn.peer);
        const p = Engine.state.players.find(q => q.pid === conn.peer);
        Engine.removePlayer(conn.peer);
        if (p) UI.toast(`👋 ${p.name} left the table.`);
        this.broadcast();
        UI.renderLobby();
      };
      conn.on('close', drop);
      conn.on('error', drop);
    });

    this.peer.on('error', (err) => onFail(this.describeError(err)));
  },

  join(name, code, onFail) {
    this.myName = name;
    this.isHost = false;
    this.roomCode = code;
    this.peer = new Peer({ debug: 1 });

    this.peer.on('open', () => {
      const conn = this.peer.connect(ROOM_PREFIX + code, {
        reliable: true,
        metadata: { name },
      });
      this.hostConn = conn;
      conn.on('data', (msg) => this.onHostMessage(msg));
      conn.on('close', () => {
        UI.toast('🔌 Lost connection to the host. They probably tripped over the router.');
        setTimeout(() => location.reload(), 2600);
      });
    });

    this.peer.on('error', (err) => onFail(this.describeError(err)));
  },

  describeError(err) {
    if (err.type === 'peer-unavailable') return "Couldn't find that table. Double-check the code!";
    if (err.type === 'unavailable-id') return 'Room code collision — cosmic odds! Try hosting again.';
    if (err.type === 'network' || err.type === 'server-error') {
      return 'Connection trouble — check your internet and try again.';
    }
    return 'Something went wrong: ' + (err.type || err);
  },

  /* ----- host side ----- */

  onGuestMessage(pid, msg) {
    if (msg.type === 'action') {
      const res = Engine.applyAction(pid, msg.action);
      if (!res.ok) {
        this.conns.get(pid)?.send({ type: 'nope', reason: res.reason });
      }
      this.broadcast();
    }
  },

  /** Send every guest their personal view, then render the host's own. */
  broadcast() {
    for (const [pid, conn] of this.conns) {
      try { conn.send({ type: 'view', view: Engine.viewFor(pid) }); } catch { /* conn died */ }
    }
    UI.render(Engine.viewFor('host'));
  },

  /* ----- guest side ----- */

  onHostMessage(msg) {
    if (msg.type === 'view') UI.render(msg.view);
    else if (msg.type === 'nope') UI.toast('🙅 ' + msg.reason);
    else if (msg.type === 'rejected') {
      UI.showScreen('home');
      $('home-status').textContent = msg.reason;
    }
  },

  /* ----- either side: dispatch my own action ----- */

  dispatch(action) {
    if (this.isHost) {
      const res = Engine.applyAction('host', action);
      if (!res.ok) UI.toast('🙅 ' + res.reason);
      this.broadcast();
    } else {
      this.hostConn?.send({ type: 'action', action });
    }
  },
};

/* ---------------------------------------------------------- *
 *  UI
 * ---------------------------------------------------------- */

const UI = {
  lastEventSeq: 0,
  lastView: null,
  wasMyTurn: false,
  jokeTimer: null,

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
  },

  toast(text, ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('fade'), ms);
    setTimeout(() => el.remove(), ms + 600);
  },

  startJokeTicker() {
    const tell = () => { $('joke-text').textContent = randomJoke('ticker'); };
    tell();
    clearInterval(this.jokeTimer);
    this.jokeTimer = setInterval(tell, 16000);
  },

  /* ----- lobby (host renders from Engine, guests from view) ----- */

  renderLobby() {
    if (!Net.isHost || Engine.state.phase !== 'lobby') return;
    const list = $('lobby-players');
    list.innerHTML = '';
    Engine.state.players.forEach((p, i) => {
      const li = document.createElement('li');
      li.textContent = `${['🃏','🎩','🦆','🧢','🍕','🛋️'][i % 6]} ${p.name}`;
      if (i === 0) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'HOST';
        li.appendChild(badge);
      }
      list.appendChild(li);
    });
    const n = Engine.state.players.length;
    $('btn-start').disabled = n < 2;
    $('lobby-status').textContent = n < 2
      ? 'Waiting for players… (2–6 needed)'
      : `${n} players ready. ${6 - n} more could still squeeze in.`;
  },

  /* ----- main game render ----- */

  render(view) {
    this.lastView = view;

    if (view.phase === 'lobby') {
      // Guests see a live lobby via broadcast views.
      if (!Net.isHost) {
        this.showScreen('lobby');
        $('room-code').textContent = Net.roomCode;
        $('btn-start').classList.add('hidden');
        const list = $('lobby-players');
        list.innerHTML = '';
        view.players.forEach((p, i) => {
          const li = document.createElement('li');
          li.textContent = `${['🃏','🎩','🦆','🧢','🍕','🛋️'][i % 6]} ${p.name}`;
          list.appendChild(li);
        });
        $('lobby-status').textContent = 'Waiting for the host to deal…';
      }
      return;
    }

    this.showScreen('game');
    $('game-room').textContent = 'Room ' + Net.roomCode;

    this.renderPlayers(view);
    this.renderBoard(view);
    this.renderHand(view);
    this.renderControls(view);
    this.renderOverlay(view);
    this.handleEvent(view);

    // A gentle fanfare when it becomes MY turn.
    const myTurn = view.you && view.turnIdx === view.you.idx && view.phase === 'playing';
    if (myTurn && !this.wasMyTurn) Sound.turn();
    this.wasMyTurn = myTurn;
  },

  renderPlayers(view) {
    const strip = $('players-strip');
    strip.innerHTML = '';
    view.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip'
        + (p.current && view.phase === 'playing' ? ' current' : '')
        + (p.connected ? '' : ' gone');
      const you = view.you && i === view.you.idx ? ' (you)' : '';
      chip.innerHTML = `<span>${p.current && view.phase === 'playing' ? '👉 ' : ''}${escapeHtml(p.name)}${you}</span><span class="count">${p.count}</span>`;
      strip.appendChild(chip);
    });
  },

  renderBoard(view) {
    const board = $('board');
    board.innerHTML = '';
    const empty = isBoardEmpty(view.board);
    for (const color of COLORS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'board-row';
      const badge = document.createElement('div');
      badge.className = 'row-badge ' + color;
      rowEl.appendChild(badge);
      const row = view.board[color];
      for (let n = 1; n <= 20; n++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.color = color;
        cell.dataset.n = n;
        const filled = row.open && n >= row.low && n <= row.high;
        if (filled) {
          cell.classList.add('filled', color);
          cell.textContent = n;
        } else {
          const isNext = isLegalPlay({ c: color, n }, view.board, empty);
          if (isNext) cell.classList.add('next');
          cell.textContent = n;
        }
        rowEl.appendChild(cell);
      }
      board.appendChild(rowEl);
    }
  },

  renderHand(view) {
    const handEl = $('hand');
    handEl.innerHTML = '';
    if (!view.you) return;
    const empty = isBoardEmpty(view.board);
    const myTurn = view.turnIdx === view.you.idx && view.phase === 'playing';

    for (const card of view.you.hand) {
      const el = document.createElement('div');
      const playable = myTurn && isLegalPlay(card, view.board, empty);
      el.className = 'card ' + card.c + (playable ? ' playable' : myTurn ? ' dull' : '');
      el.textContent = card.n;
      el.title = `${card.c} ${card.n}`;
      if (playable) {
        el.addEventListener('click', () => Net.dispatch({ kind: 'play', card }));
      }
      handEl.appendChild(el);
    }
  },

  renderControls(view) {
    const myTurn = view.you && view.turnIdx === view.you.idx && view.phase === 'playing';
    const drawBtn = $('btn-draw');
    const endBtn = $('btn-end');
    drawBtn.classList.toggle('hidden', !myTurn || view.turnPlayed > 0);
    endBtn.classList.toggle('hidden', !myTurn || view.turnPlayed === 0);
    drawBtn.textContent = view.stockCount > 0 ? '🃏 Draw 3 & end turn' : '😶 Pass (pile is empty)';
    $('stock-count').textContent = view.stockCount + ' left';

    const banner = $('turn-banner');
    if (view.phase !== 'playing') {
      banner.textContent = '';
      banner.classList.remove('mine');
    } else if (myTurn) {
      banner.textContent = '🫵 Your turn! Make dad proud.';
      banner.classList.add('mine');
    } else {
      const cur = view.players[view.turnIdx];
      banner.textContent = `⏳ ${cur ? cur.name : '…'} is plotting…`;
      banner.classList.remove('mine');
    }
  },

  renderOverlay(view) {
    const overlay = $('overlay');
    if (view.phase !== 'over' || !view.rankings) {
      overlay.classList.add('hidden');
      return;
    }
    overlay.classList.remove('hidden');
    const winner = view.rankings[0];
    const iWon = view.you && view.players[view.you.idx] && winner.name === view.players[view.you.idx].name;
    $('overlay-title').textContent = iWon ? '🏆 YOU WIN! 🏆' : `🏆 ${winner.name} wins!`;
    const list = $('overlay-rankings');
    list.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅'];
    view.rankings.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${medals[i]} ${escapeHtml(r.name)}</span><span>${r.left === 0 ? 'Elfer raus!' : r.left + ' cards left'}</span>`;
      list.appendChild(li);
    });
    $('btn-again').classList.toggle('hidden', !Net.isHost);
    $('overlay-wait').classList.toggle('hidden', Net.isHost);
  },

  /* ----- event reactions: confetti, toasts, jokes, sounds ----- */

  handleEvent(view) {
    const ev = view.event;
    if (!ev || ev.seq <= this.lastEventSeq) return;
    this.lastEventSeq = ev.seq;

    if (ev.kind === 'deal') {
      $('overlay').classList.add('hidden');
      this.toast(`🎲 Cards are out! ${ev.starter} holds the red 11 and goes first.`);
      Confetti.burst();
      this.startJokeTicker();
    } else if (ev.kind === 'play') {
      const cell = document.querySelector(`.board-cell[data-color="${ev.card.c}"][data-n="${ev.card.n}"]`);
      const rect = cell?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : undefined;
      const y = rect ? rect.top + rect.height / 2 : undefined;
      if (ev.opened) {
        Confetti.burst(x, y);
        Sound.open();
        this.toast(`${COLOR_EMOJI[ev.card.c]} ${randomJoke('eleven')}`);
      } else {
        Confetti.pop(x, y);
        Sound.pop();
        if (ev.left === 1) this.toast(`😱 ${ev.player} has only ONE card left!`);
        else if (Math.random() < 0.14) this.toast(`${ev.player}: ${randomJoke('play')}`);
      }
    } else if (ev.kind === 'draw') {
      Sound.draw();
      this.toast(`🃏 ${ev.player} draws ${ev.count}. ${randomJoke('draw')}`);
    } else if (ev.kind === 'pass') {
      this.toast(`😶 ${ev.player} passes. The pile is empty, and so is the tension.`);
    } else if (ev.kind === 'win') {
      Sound.win();
      Confetti.megaBlast();
      $('overlay-joke').textContent = randomJoke('win');
    }
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

/* ---------------------------------------------------------- *
 *  Wiring
 * ---------------------------------------------------------- */

function myName() {
  const raw = $('name-input').value.trim();
  return (raw || 'Player ' + Math.floor(Math.random() * 99 + 1)).slice(0, 14);
}

$('btn-host').addEventListener('click', () => {
  $('home-status').textContent = 'Setting up the table…';
  $('btn-host').disabled = true;
  Net.host(myName(), (code) => {
    $('room-code').textContent = code;
    UI.showScreen('lobby');
    UI.renderLobby();
    UI.startJokeTicker();
  }, (reason) => {
    $('home-status').textContent = reason;
    $('btn-host').disabled = false;
  });
});

$('btn-join').addEventListener('click', () => {
  const code = $('room-input').value.trim().toUpperCase();
  if (code.length !== 5) {
    $('home-status').textContent = 'Room codes are 5 characters. Count again — I believe in you.';
    return;
  }
  $('home-status').textContent = 'Knocking on the door…';
  $('btn-join').disabled = true;
  Net.join(myName(), code, (reason) => {
    $('home-status').textContent = reason;
    $('btn-join').disabled = false;
  });
  // The host answers with a lobby view once we're in;
  // until then, keep the user informed.
  setTimeout(() => {
    if (document.querySelector('#screen-home.active') && $('btn-join').disabled) {
      $('home-status').textContent = 'Still knocking… (peer connections can take a few seconds)';
    }
  }, 4000);
});

$('btn-start').addEventListener('click', () => {
  if (!Net.isHost) return;
  Engine.deal();
  Net.broadcast();
});

$('btn-again').addEventListener('click', () => {
  if (!Net.isHost) return;
  // Drop players who disconnected mid-game, then re-deal.
  Engine.state.players = Engine.state.players.filter(p => p.connected);
  if (Engine.state.players.length < 2) {
    UI.toast('Not enough players left — share the code again!');
    Engine.state.phase = 'lobby';
    UI.showScreen('lobby');
    UI.renderLobby();
    Net.broadcast();
    return;
  }
  Engine.deal();
  Net.broadcast();
});

$('btn-draw').addEventListener('click', () => Net.dispatch({ kind: 'draw' }));
$('btn-end').addEventListener('click', () => Net.dispatch({ kind: 'end' }));

$('btn-copy').addEventListener('click', async () => {
  const link = `${location.origin}${location.pathname}?room=${Net.roomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    UI.toast('📋 Invite link copied! Now go pester your friends.');
  } catch {
    UI.toast('Copy failed — the code is ' + Net.roomCode);
  }
});

$('btn-sound').addEventListener('click', () => {
  const muted = Sound.toggle();
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
});

// Enter key conveniences
$('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-host').click(); });
$('room-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });

// Deep link: index.html?room=ABCDE pre-fills the join box.
const params = new URLSearchParams(location.search);
if (params.get('room')) {
  $('room-input').value = params.get('room').toUpperCase().slice(0, 5);
  $('name-input').focus();
  $('home-status').textContent = "You've been invited! Enter your name and hit Join.";
}
