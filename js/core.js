/* ============================================================
   Grand Line Casino — core
   Wallet, persistence, sound, toasts, particles, chip controls.
   ============================================================ */

window.Casino = (function () {
  "use strict";

  const STORAGE_KEY = "grand-line-casino-v1";
  const DAILY_AMOUNT = 1000;
  const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
  const EMERGENCY_AMOUNT = 500;
  const EMERGENCY_THRESHOLD = 100;

  const DEFAULTS = {
    berries: 5000,
    muted: false,
    volume: 0.7,
    lastDaily: 0,
    stats: { rounds: 0, biggestWin: 0, wagered: 0, won: 0 }
  };

  const state = JSON.parse(JSON.stringify(DEFAULTS));
  const dom = {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------------- persistence ---------------- */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object") return;

      if (Number.isFinite(saved.berries)) {
        state.berries = Math.max(0, Math.floor(saved.berries));
      }
      state.muted = !!saved.muted;
      if (Number.isFinite(saved.volume)) {
        state.volume = Math.min(1, Math.max(0, saved.volume));
      }
      state.lastDaily = Number(saved.lastDaily) || 0;

      if (saved.stats && typeof saved.stats === "object") {
        Object.keys(state.stats).forEach((key) => {
          if (Number.isFinite(saved.stats[key])) state.stats[key] = saved.stats[key];
        });
      }
    } catch (err) {
      /* Corrupted save — start a fresh voyage. */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* Storage may be unavailable (private mode); the game still works. */
    }
  }

  function fmt(value) {
    return Math.round(Number(value) || 0).toLocaleString("en-US");
  }

  /* ---------------- wallet ---------------- */

  function renderWallet(pulse) {
    if (dom.berries) dom.berries.textContent = fmt(state.berries);
    if (dom.wanted) dom.wanted.textContent = fmt(state.berries);

    if (pulse && dom.wallet) {
      dom.wallet.classList.remove("pulse");
      void dom.wallet.offsetWidth;
      dom.wallet.classList.add("pulse");
    }
  }

  function renderStats() {
    if (dom.statBiggest) dom.statBiggest.textContent = fmt(state.stats.biggestWin) + " ฿";
    if (dom.statRounds) dom.statRounds.textContent = fmt(state.stats.rounds);
    if (dom.statWagered) dom.statWagered.textContent = fmt(state.stats.wagered) + " ฿";
  }

  function canAfford(amount) {
    return Number.isFinite(amount) && amount > 0 && state.berries >= amount;
  }

  function wager(amount) {
    const value = Math.round(amount);
    if (!canAfford(value)) return false;
    state.berries -= value;
    state.stats.wagered += value;
    save();
    renderWallet();
    renderStats();
    return true;
  }

  function reward(amount) {
    const value = Math.max(0, Math.round(amount));
    if (!value) return;
    state.berries += value;
    save();
    renderWallet(true);
  }

  function countRound() {
    state.stats.rounds += 1;
    save();
    renderStats();
  }

  function recordWin(net) {
    if (!Number.isFinite(net) || net <= 0) return;
    state.stats.won += Math.round(net);
    if (net > state.stats.biggestWin) state.stats.biggestWin = Math.round(net);
    save();
    renderStats();
  }

  /* ---------------- daily bounty ---------------- */

  function dailyRemaining() {
    return Math.max(0, state.lastDaily + DAILY_COOLDOWN - Date.now());
  }

  function shortDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return hours + "h " + minutes + "m";
    return Math.max(1, minutes) + "m";
  }

  function renderDaily() {
    if (!dom.daily) return;
    const left = dailyRemaining();
    const broke = state.berries < EMERGENCY_THRESHOLD;

    if (left > 0 && !broke) {
      dom.daily.classList.remove("ready");
      dom.daily.textContent = "Next bounty in " + shortDuration(left);
      dom.daily.setAttribute("aria-disabled", "true");
      return;
    }

    dom.daily.classList.add("ready");
    dom.daily.removeAttribute("aria-disabled");
    dom.daily.textContent = broke && left > 0
      ? "Emergency +" + fmt(EMERGENCY_AMOUNT) + " ฿"
      : "Claim +" + fmt(DAILY_AMOUNT) + " ฿";
  }

  function claimDaily() {
    const left = dailyRemaining();
    if (left > 0 && state.berries >= EMERGENCY_THRESHOLD) {
      toast("The Log Pose is still resetting. Come back in " + shortDuration(left) + ".", "warn");
      return;
    }

    if (left > 0) {
      reward(EMERGENCY_AMOUNT);
      updateMuteButton();
      sfx.cash();
      toast("Shipwreck relief: +" + fmt(EMERGENCY_AMOUNT) + " ฿. Spend it wisely.", "win");
      burstFrom(dom.daily, 14);
    } else {
      state.lastDaily = Date.now();
      reward(DAILY_AMOUNT);
      save();
      sfx.cash();
      toast("Daily bounty collected: +" + fmt(DAILY_AMOUNT) + " ฿", "win");
      burstFrom(dom.daily, 22);
    }

    renderDaily();
    renderWallet(true);
  }

  /* ---------------- sound ---------------- */

  let audioCtx = null;

  function ctx() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        audioCtx = new AudioCtx();
      } catch (err) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function tone(freq, duration, opts) {
    if (state.muted) return;
    const ac = ctx();
    if (!ac) return;
    const options = opts || {};
    const start = ac.currentTime + (options.delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    if (options.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(options.slideTo, start + duration);
    }
    const volume = (options.gain == null ? 0.05 : options.gain) * state.volume;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(duration, opts) {
    if (state.muted) return;
    const ac = ctx();
    if (!ac) return;
    const options = opts || {};
    const length = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.filter || 1200;

    const gain = ac.createGain();
    gain.gain.value = (options.gain == null ? 0.06 : options.gain) * state.volume;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    source.start();
  }

  const sfx = {
    click: function () { tone(620, 0.05, { type: "triangle", gain: 0.028 }); },
    chip: function () {
      tone(900, 0.055, { type: "square", gain: 0.018 });
      tone(1320, 0.045, { type: "square", gain: 0.012, delay: 0.04 });
    },
    spin: function () { tone(160, 0.22, { type: "sawtooth", gain: 0.028, slideTo: 520 }); },
    reelStop: function () { tone(300, 0.07, { type: "square", gain: 0.022 }); },
    card: function () { noise(0.09, { gain: 0.022, filter: 2400 }); },
    tick: function () { tone(1250, 0.03, { type: "square", gain: 0.012 }); },
    win: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
        tone(freq, 0.18, { type: "triangle", gain: 0.042, delay: i * 0.09 });
      });
    },
    bigWin: function () {
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (freq, i) {
        tone(freq, 0.28, { type: "triangle", gain: 0.045, delay: i * 0.1 });
      });
      [261.63, 392, 523.25].forEach(function (freq) {
        tone(freq, 0.7, { type: "sine", gain: 0.035, delay: 0.6 });
      });
    },
    lose: function () {
      [392, 311.13, 233.08].forEach(function (freq, i) {
        tone(freq, 0.2, { type: "sawtooth", gain: 0.026, delay: i * 0.11 });
      });
    },
    bomb: function () {
      noise(0.5, { gain: 0.11, filter: 900 });
      tone(90, 0.55, { type: "sawtooth", gain: 0.06, slideTo: 40 });
    },
    cash: function () {
      [784, 988, 1175].forEach(function (freq, i) {
        tone(freq, 0.14, { type: "square", gain: 0.028, delay: i * 0.07 });
      });
    }
  };

  function updateMuteButton() {
    if (!dom.mute) return;
    dom.mute.textContent = state.muted ? "🔇" : "🔊";
    dom.mute.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
    dom.mute.title = state.muted ? "Unmute sound" : "Mute sound";
    dom.mute.classList.toggle("muted", state.muted);
  }

  function toggleMute() {
    state.muted = !state.muted;
    if (!state.muted && state.volume === 0) state.volume = 0.7;
    save();
    updateMuteButton();
    if (dom.volume) dom.volume.value = String(Math.round(state.volume * 100));
    if (!state.muted) sfx.click();
  }

  /* ---------------- toasts & effects ---------------- */

  function toast(message, type, ms) {
    if (!dom.toasts) return;
    const kind = type || "info";
    const node = document.createElement("div");
    node.className = "toast toast-" + kind;
    node.setAttribute("role", "status");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = kind === "win" ? "💰" : kind === "lose" ? "💀" : kind === "warn" ? "⚠️" : "🧭";

    const text = document.createElement("span");
    text.textContent = message;

    node.appendChild(icon);
    node.appendChild(text);
    dom.toasts.appendChild(node);

    while (dom.toasts.children.length > 4) {
      dom.toasts.removeChild(dom.toasts.firstElementChild);
    }

    setTimeout(function () {
      node.classList.add("out");
      setTimeout(function () { node.remove(); }, 320);
    }, ms || 3600);
  }

  function coinBurst(x, y, count) {
    if (!dom.fx) return;
    const total = count || 18;
    for (let i = 0; i < total; i++) {
      const coin = document.createElement("span");
      coin.className = "fx-coin";
      coin.textContent = Math.random() < 0.28 ? "✨" : "🪙";
      coin.style.left = x + "px";
      coin.style.top = y + "px";

      if (typeof coin.animate !== "function") {
        coin.remove();
        continue;
      }

      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 170;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 70;
      const duration = 700 + Math.random() * 600;
      const rotation = Math.round(Math.random() * 360);

      coin.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.6) rotate(0deg)", opacity: 1 },
          {
            transform:
              "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) " +
              "scale(1.1) rotate(" + rotation + "deg)",
            opacity: 0
          }
        ],
        { duration: duration, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
      );

      dom.fx.appendChild(coin);
      setTimeout(function () { coin.remove(); }, duration + 60);
    }
  }

  function burstFrom(el, count) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    coinBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  /* ---------------- recent results ---------------- */

  const HISTORY_LIMIT = 10;
  const history = {};

  function renderHistory(game) {
    const strip = document.getElementById(game + "-history");
    if (!strip) return;
    strip.innerHTML = "";
    (history[game] || []).forEach(function (item) {
      const pill = document.createElement("span");
      pill.className = "history-pill" + (item.kind ? " history-" + item.kind : "");
      pill.textContent = item.label;
      strip.appendChild(pill);
    });
  }

  function pushHistory(game, label, kind) {
    if (!game) return;
    if (!history[game]) history[game] = [];
    history[game].unshift({ label: String(label), kind: kind || "" });
    if (history[game].length > HISTORY_LIMIT) history[game].pop();
    renderHistory(game);
  }

  /* ---------------- chip selector ---------------- */

  function bindChips(container, initial, onChange) {
    if (!container) {
      return {
        get: function () { return initial; },
        set: function () {},
        setDisabled: function () {}
      };
    }

    const buttons = $$("[data-chip]", container);
    let value = initial;

    function paint() {
      buttons.forEach(function (btn) {
        const active = Number(btn.dataset.chip) === value;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (onChange) onChange(value);
    }

    buttons.forEach(function (btn) {
      btn.type = "button";
      btn.addEventListener("click", function () {
        value = Number(btn.dataset.chip);
        sfx.chip();
        paint();
      });
    });

    paint();

    return {
      get: function () { return value; },
      set: function (next) {
        value = Number(next);
        paint();
      },
      setDisabled: function (disabled) {
        buttons.forEach(function (btn) { btn.disabled = !!disabled; });
      }
    };
  }

  /* ---------------- init ---------------- */

  function init() {
    load();

    dom.wallet = $("#wallet");
    dom.berries = $("#wallet-berries");
    dom.wanted = $("#wanted-reward");
    dom.statBiggest = $("#stat-biggest");
    dom.statRounds = $("#stat-rounds");
    dom.statWagered = $("#stat-wagered");
    dom.mute = $("#mute-btn");
    dom.volume = $("#volume-slider");
    dom.daily = $("#daily-btn");
    dom.toasts = $("#toasts");
    dom.fx = $("#fx-layer");

    renderWallet();
    renderStats();
    updateMuteButton();
    renderDaily();

    if (dom.mute) dom.mute.addEventListener("click", toggleMute);
    if (dom.daily) dom.daily.addEventListener("click", claimDaily);

    if (dom.volume) {
      dom.volume.value = String(Math.round(state.volume * 100));
      dom.volume.addEventListener("input", function () {
        const value = Number(dom.volume.value) / 100;
        state.volume = value;
        state.muted = value === 0;
        save();
        updateMuteButton();
      });
    }

    const resetBtn = $("#reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        const sure = window.confirm(
          "Reset your voyage? All Berries, stats and progress will be wiped."
        );
        if (!sure) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
        window.location.reload();
      });
    }

    setInterval(renderDaily, 30000);

    const prime = function () {
      if (!state.muted) ctx();
      document.removeEventListener("pointerdown", prime);
    };
    document.addEventListener("pointerdown", prime);
  }

  return {
    init: init,
    state: state,
    fmt: fmt,
    $: $,
    $$: $$,
    canAfford: canAfford,
    wager: wager,
    reward: reward,
    countRound: countRound,
    recordWin: recordWin,
    toast: toast,
    coinBurst: coinBurst,
    burstFrom: burstFrom,
    shake: shake,
    pushHistory: pushHistory,
    bindChips: bindChips,
    sfx: sfx
  };
})();
