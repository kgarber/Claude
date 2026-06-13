// CHAINLINK — Game Engine & UI

(function () {
  "use strict";

  // ===== TRANSFORMATION VALIDATORS =====

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
        );
      }
    }
    return dp[m][n];
  }

  function isLetterLink(a, b) {
    return levenshtein(a, b) <= 2 && levenshtein(a, b) >= 1;
  }

  function isSoundLink(a, b) {
    if (a === b) return false;
    if (a.length < 2 || b.length < 2) return false;
    const endLen = Math.min(3, Math.min(a.length, b.length) - 1);
    for (let i = endLen; i >= 2; i--) {
      if (a.slice(-i) === b.slice(-i)) return true;
    }
    const startLen = Math.min(3, Math.min(a.length, b.length));
    if (startLen >= 3 && a.slice(0, startLen) === b.slice(0, startLen)) return true;
    return false;
  }

  function isMeaningLink(a, b) {
    const sim = wordSimilarity(a, b);
    return sim >= 0.55;
  }

  function getLinkType(prev, next) {
    const a = prev.toLowerCase();
    const b = next.toLowerCase();
    if (a === b) return null;
    if (isLetterLink(a, b)) return "letter";
    if (isSoundLink(a, b)) return "sound";
    if (isMeaningLink(a, b)) return "meaning";
    return null;
  }

  // ===== DISTANCE HELPERS =====

  function getDistanceClass(similarity) {
    if (similarity >= 0.85) return "hot";
    if (similarity >= 0.6) return "warm";
    if (similarity >= 0.4) return "tepid";
    if (similarity >= 0.2) return "cool";
    return "cold";
  }

  function getDistanceEmoji(cls) {
    switch (cls) {
      case "hot": return "🟥";
      case "warm": return "🟧";
      case "tepid": return "🟨";
      case "cool": return "🟦";
      case "cold": return "⬜";
      case "solved": return "🟩";
      default: return "⬜";
    }
  }

  function getDistanceLabel(cls) {
    switch (cls) {
      case "hot": return "HOT";
      case "warm": return "WARM";
      case "tepid": return "TEPID";
      case "cool": return "COOL";
      case "cold": return "COLD";
      case "solved": return "DONE";
      default: return "";
    }
  }

  // ===== GAME STATE =====

  const STORAGE_KEY = "chainlink_state";
  const STATS_KEY = "chainlink_stats";

  let state = {
    puzzleNumber: 0,
    startWord: "",
    endWord: "",
    par: 5,
    chain: [],
    gameOver: false,
    won: false,
    dateStr: ""
  };

  let stats = {
    played: 0,
    won: 0,
    streak: 0,
    maxStreak: 0,
    distribution: {},
    lastDate: ""
  };

  function getTodayStr() {
    const now = new Date();
    return now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) { /* ignore */ }
  }

  function loadStats() {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return null;
  }

  // ===== INITIALIZATION =====

  function initGame() {
    const todayStr = getTodayStr();
    const savedState = loadState();
    const savedStats = loadStats();
    if (savedStats) stats = savedStats;

    if (savedState && savedState.dateStr === todayStr) {
      state = savedState;
    } else {
      const puzzle = getPuzzleForDate(todayStr);
      state = {
        puzzleNumber: puzzle.number,
        startWord: puzzle.start,
        endWord: puzzle.end,
        par: puzzle.par,
        chain: [],
        gameOver: false,
        won: false,
        dateStr: todayStr
      };
      saveState();
    }

    renderAll();

    if (state.gameOver) {
      disableInput();
    } else {
      enableInput();
    }
  }

  // ===== UI RENDERING =====

  function renderAll() {
    document.getElementById("puzzle-number").textContent = "Puzzle #" + state.puzzleNumber;
    document.getElementById("par-display").textContent = "Par " + state.par;
    document.getElementById("start-word").textContent = state.startWord.toUpperCase();
    document.getElementById("end-word").textContent = state.endWord.toUpperCase();

    renderChain();
    updateStats();
  }

  function renderChain() {
    const container = document.getElementById("chain-links");
    container.innerHTML = "";

    state.chain.forEach(function (entry, idx) {
      const linkEl = document.createElement("div");
      linkEl.className = "chain-link";

      const similarity = entry.similarity;
      const distClass = entry.solved ? "solved" : getDistanceClass(similarity);
      linkEl.classList.add("dist-" + distClass);

      // Connector
      const connector = document.createElement("div");
      connector.className = "link-connector";
      const lineUp = document.createElement("div");
      lineUp.className = "connector-line";
      connector.appendChild(lineUp);

      const typeBadge = document.createElement("span");
      typeBadge.className = "link-type " + entry.linkType;
      typeBadge.textContent = entry.linkType === "letter" ? "ABC" :
        entry.linkType === "sound" ? "~" : "≈";
      connector.appendChild(typeBadge);

      const lineDown = document.createElement("div");
      lineDown.className = "connector-line";
      connector.appendChild(lineDown);
      linkEl.appendChild(connector);

      // Word row
      const row = document.createElement("div");
      row.className = "chain-word-row";

      const wordSpan = document.createElement("span");
      wordSpan.className = "chain-word";
      wordSpan.textContent = entry.word.toUpperCase();
      row.appendChild(wordSpan);

      const distIndicator = document.createElement("div");
      distIndicator.className = "distance-indicator";

      const barTrack = document.createElement("div");
      barTrack.className = "distance-bar-track";
      const barFill = document.createElement("div");
      barFill.className = "distance-bar-fill";
      barFill.style.width = Math.round(similarity * 100) + "%";
      barTrack.appendChild(barFill);
      distIndicator.appendChild(barTrack);

      const label = document.createElement("span");
      label.textContent = entry.solved ? "DONE" : Math.round(similarity * 100) + "%";
      distIndicator.appendChild(label);

      row.appendChild(distIndicator);
      linkEl.appendChild(row);

      container.appendChild(linkEl);
    });

    // Scroll to bottom of chain
    const gameArea = document.getElementById("game-area");
    requestAnimationFrame(function () {
      gameArea.scrollTop = gameArea.scrollHeight;
    });
  }

  function showMessage(text, type) {
    const msg = document.getElementById("message");
    msg.textContent = text;
    msg.className = type || "info";

    if (type === "error") {
      const input = document.getElementById("word-input");
      input.classList.add("shake");
      setTimeout(function () { input.classList.remove("shake"); }, 400);
    }
  }

  function clearMessage() {
    const msg = document.getElementById("message");
    msg.textContent = "";
    msg.className = "";
  }

  function disableInput() {
    document.getElementById("word-input").disabled = true;
    document.getElementById("submit-btn").disabled = true;
  }

  function enableInput() {
    const input = document.getElementById("word-input");
    input.disabled = false;
    document.getElementById("submit-btn").disabled = false;
    input.focus();
  }

  // ===== GAME LOGIC =====

  function submitWord(word) {
    word = word.toLowerCase().trim();

    if (!word) return;

    if (state.gameOver) {
      showMessage("Puzzle complete! Come back tomorrow.", "info");
      return;
    }

    if (!isValidWord(word)) {
      showMessage("Not in word list", "error");
      return;
    }

    const prevWord = state.chain.length > 0
      ? state.chain[state.chain.length - 1].word
      : state.startWord;

    if (word === prevWord) {
      showMessage("Same word — try something different", "error");
      return;
    }

    // Check for duplicates in chain
    if (word === state.startWord || state.chain.some(function (e) { return e.word === word; })) {
      showMessage("Already used that word", "error");
      return;
    }

    const linkType = getLinkType(prevWord, word);
    if (!linkType) {
      showMessage("No valid link from " + prevWord.toUpperCase(), "error");
      return;
    }

    const similarity = wordSimilarity(word, state.endWord);
    const solved = (word === state.endWord);

    state.chain.push({
      word: word,
      linkType: linkType,
      similarity: similarity,
      solved: solved
    });

    clearMessage();

    if (solved) {
      state.gameOver = true;
      state.won = true;
      saveState();
      recordWin();
      renderChain();
      disableInput();
      setTimeout(showWinModal, 600);
    } else {
      saveState();
      renderChain();
      const distClass = getDistanceClass(similarity);
      const pct = Math.round(similarity * 100);
      showMessage(
        getDistanceLabel(distClass) + " — " + pct + "% match to " + state.endWord.toUpperCase(),
        distClass === "hot" || distClass === "warm" ? "success" : "info"
      );
    }

    document.getElementById("word-input").value = "";
    document.getElementById("word-input").focus();
  }

  // ===== WIN HANDLING =====

  function recordWin() {
    stats.played++;
    stats.won++;

    const today = getTodayStr();
    if (stats.lastDate === getYesterday()) {
      stats.streak++;
    } else if (stats.lastDate !== today) {
      stats.streak = 1;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.lastDate = today;

    const score = state.chain.length;
    const key = String(score);
    stats.distribution[key] = (stats.distribution[key] || 0) + 1;

    saveStats();
  }

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function showWinModal() {
    const moves = state.chain.length;
    const diff = moves - state.par;

    const titleEl = document.getElementById("win-title");
    if (diff <= -2) titleEl.textContent = "Brilliant!";
    else if (diff <= 0) titleEl.textContent = "Great job!";
    else if (diff <= 2) titleEl.textContent = "Solved!";
    else titleEl.textContent = "Got there!";

    const msgEl = document.getElementById("win-message");
    if (diff < 0) {
      msgEl.textContent = moves + " moves — " + Math.abs(diff) + " under par!";
    } else if (diff === 0) {
      msgEl.textContent = moves + " moves — right on par!";
    } else {
      msgEl.textContent = moves + " moves (par " + state.par + ")";
    }

    // Build chain preview with emojis
    const previewEl = document.getElementById("win-chain-preview");
    previewEl.innerHTML = "";
    const emojiLine = state.chain.map(function (e) {
      return e.solved ? "🟩" : getDistanceEmoji(getDistanceClass(e.similarity));
    }).join("");
    previewEl.textContent = emojiLine;

    document.getElementById("win-modal").classList.remove("hidden");
    startCountdown();
  }

  function buildShareText() {
    const moves = state.chain.length;
    const diff = moves - state.par;
    let score;
    if (diff < 0) score = moves + " (" + Math.abs(diff) + " under par)";
    else if (diff === 0) score = moves + " (par)";
    else score = moves + " (" + diff + " over par)";

    const emojis = state.chain.map(function (e) {
      return e.solved ? "🟩" : getDistanceEmoji(getDistanceClass(e.similarity));
    }).join("");

    const path = state.startWord.toUpperCase() + " → " +
      state.chain.map(function (e) { return e.word.toUpperCase(); }).join(" → ");

    return "Chainlink #" + state.puzzleNumber + " 🔗 " + score + "\n" +
      emojis + "\n" +
      path;
  }

  // ===== COUNTDOWN =====

  let countdownInterval = null;

  function startCountdown() {
    updateCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const diff = tomorrow - now;

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const el = document.getElementById("countdown");
    if (el) {
      el.textContent =
        String(hours).padStart(2, "0") + ":" +
        String(mins).padStart(2, "0") + ":" +
        String(secs).padStart(2, "0");
    }
  }

  // ===== STATS UI =====

  function updateStats() {
    document.getElementById("stat-played").textContent = stats.played;
    document.getElementById("stat-won").textContent = stats.won;
    document.getElementById("stat-streak").textContent = stats.streak;
    document.getElementById("stat-max-streak").textContent = stats.maxStreak;
    renderDistribution();
  }

  function renderDistribution() {
    const chart = document.getElementById("distribution-chart");
    chart.innerHTML = "";

    const keys = Object.keys(stats.distribution).map(Number).sort(function (a, b) { return a - b; });
    if (keys.length === 0) {
      chart.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;">No games played yet</p>';
      return;
    }

    const maxVal = Math.max.apply(null, keys.map(function (k) { return stats.distribution[k]; }));

    keys.forEach(function (k) {
      const count = stats.distribution[k];
      const pct = maxVal > 0 ? (count / maxVal) * 100 : 0;

      const row = document.createElement("div");
      row.className = "dist-row";

      const label = document.createElement("span");
      label.className = "dist-row-label";
      label.textContent = k;
      row.appendChild(label);

      const bar = document.createElement("div");
      bar.className = "dist-row-bar";
      bar.style.width = Math.max(pct, 10) + "%";
      bar.textContent = count;

      if (state.won && state.chain.length === k) {
        bar.classList.add("highlight");
      }

      row.appendChild(bar);
      chart.appendChild(row);
    });
  }

  // ===== TOAST =====

  function showToast(text) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 1600);
  }

  // ===== MODAL HELPERS =====

  function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
  }

  function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-overlay").forEach(function (el) {
      el.classList.add("hidden");
    });
  }

  // ===== EVENT LISTENERS =====

  function bindEvents() {
    // Form submit
    document.getElementById("input-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const input = document.getElementById("word-input");
      submitWord(input.value);
    });

    // Help button
    document.getElementById("help-btn").addEventListener("click", function () {
      openModal("help-modal");
    });

    // Stats button
    document.getElementById("stats-btn").addEventListener("click", function () {
      updateStats();
      openModal("stats-modal");
    });

    // Share button
    document.getElementById("share-btn").addEventListener("click", function () {
      const text = buildShareText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast("Copied to clipboard!");
        }).catch(function () {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    });

    // Close modal buttons
    document.querySelectorAll(".modal-close").forEach(function (btn) {
      btn.addEventListener("click", function () {
        closeAllModals();
      });
    });

    // Click outside modal to close
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          closeAllModals();
        }
      });
    });

    // Keyboard: Escape closes modals
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeAllModals();
      }
    });
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied to clipboard!");
    } catch (e) {
      showToast("Couldn't copy — try manually");
    }
    document.body.removeChild(ta);
  }

  // ===== FIRST VISIT =====

  function checkFirstVisit() {
    if (!localStorage.getItem("chainlink_visited")) {
      localStorage.setItem("chainlink_visited", "1");
      setTimeout(function () {
        openModal("help-modal");
      }, 400);
    }
  }

  // ===== BOOT =====

  document.addEventListener("DOMContentLoaded", function () {
    initGame();
    bindEvents();
    checkFirstVisit();
  });

})();
