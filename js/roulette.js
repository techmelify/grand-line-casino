/* ============================================================
   Grand Line Casino — Roulette (European, single zero)
   ============================================================ */

window.Roulette = (function () {
  "use strict";

  const C = window.Casino;

  /* Physical order around a European wheel. */
  const WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const STEP = 360 / WHEEL.length;

  const OUTSIDE = [
    { zone: "low", label: "1–18" },
    { zone: "even", label: "Even" },
    { zone: "red", label: "Red" },
    { zone: "black", label: "Black" },
    { zone: "odd", label: "Odd" },
    { zone: "high", label: "19–36" }
  ];

  let els = {};
  let chips = null;
  let bets = {};
  let rotation = 0;
  let spinning = false;

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function colorOf(n) {
    if (n === 0) return "green";
    return RED.has(n) ? "red" : "black";
  }

  function betTotal() {
    return Object.keys(bets).reduce(function (sum, key) { return sum + bets[key]; }, 0);
  }

  function zoneMultiplier(zone) {
    if (zone.charAt(0) === "n") return 36;
    if (zone.charAt(0) === "d") return 3;
    return 2;
  }

  function zoneWins(zone, number, color) {
    if (zone === "n" + number) return true;
    switch (zone) {
      case "red": return color === "red";
      case "black": return color === "black";
      case "odd": return number > 0 && number % 2 === 1;
      case "even": return number > 0 && number % 2 === 0;
      case "low": return number >= 1 && number <= 18;
      case "high": return number >= 19 && number <= 36;
      case "d1": return number >= 1 && number <= 12;
      case "d2": return number >= 13 && number <= 24;
      case "d3": return number >= 25 && number <= 36;
      default: return false;
    }
  }

  function makeCell(zone, label, extraClass, aria) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "bet-cell " + (extraClass || "");
    cell.dataset.zone = zone;
    cell.setAttribute("aria-label", aria || label);
    cell.textContent = label;

    const badge = document.createElement("span");
    badge.className = "bet-badge";
    cell.appendChild(badge);

    return cell;
  }

  function buildWheel() {
    const stops = WHEEL.map(function (n, i) {
      const color = colorOf(n);
      const paint = color === "green" ? "#1f8a5b" : color === "red" ? "#b3262f" : "#0d1b24";
      return paint + " " + (i * STEP) + "deg " + ((i + 1) * STEP) + "deg";
    });
    els.wheel.style.background = "conic-gradient(from 0deg, " + stops.join(", ") + ")";

    els.labels.innerHTML = "";
    WHEEL.forEach(function (n) {
      const span = document.createElement("span");
      span.className = "wheel-label";
      span.textContent = n;
      els.labels.appendChild(span);
    });

    positionLabels();
  }

  function positionLabels() {
    if (!els.wheel || !els.labels) return;
    const width = els.wheel.clientWidth;
    const radius = Math.max(72, width / 2 - 17);

    Array.prototype.forEach.call(els.labels.children, function (span, i) {
      const angle = i * STEP + STEP / 2;
      span.style.transform =
        "translate(-50%, -50%) rotate(" + angle + "deg) translateY(-" + radius + "px)";
    });
  }

  /* The wheel is display:none until its tab opens, so it needs a re-measure. */
  function refresh() {
    positionLabels();
  }

  function buildBoard() {
    els.board.innerHTML = "";

    const zero = makeCell("n0", "0", "cell-green zero", "Bet on zero");
    zero.style.gridColumn = "1";
    zero.style.gridRow = "1 / span 3";
    els.board.appendChild(zero);

    for (let n = 1; n <= 36; n++) {
      const color = colorOf(n);
      const cell = makeCell("n" + n, String(n), "cell-" + color, "Bet on " + n + ", " + color);
      cell.style.gridColumn = String(2 + Math.floor((n - 1) / 3));
      cell.style.gridRow = String(((n - 1) % 3) + 1);
      els.board.appendChild(cell);
    }

    ["1st 12", "2nd 12", "3rd 12"].forEach(function (label, i) {
      const cell = makeCell("d" + (i + 1), label, "outside", "Bet on " + label);
      cell.style.gridColumn = String(2 + i * 4) + " / span 4";
      cell.style.gridRow = "4";
      els.board.appendChild(cell);
    });

    OUTSIDE.forEach(function (bet, i) {
      const cell = makeCell(bet.zone, bet.label, "outside", "Bet on " + bet.label);
      cell.style.gridColumn = String(2 + i * 2) + " / span 2";
      cell.style.gridRow = "5";
      els.board.appendChild(cell);
    });

    renderBets();
  }

  function renderBets() {
    if (!els.board) return;
    let total = 0;

    els.board.querySelectorAll(".bet-cell").forEach(function (cell) {
      const amount = bets[cell.dataset.zone] || 0;
      total += amount;
      const badge = cell.querySelector(".bet-badge");
      if (badge) {
        badge.textContent = C.fmt(amount);
        badge.classList.toggle("show", amount > 0);
      }
    });

    if (els.total) els.total.textContent = C.fmt(total);
  }

  function addBet(zone) {
    if (spinning) return;
    const chip = chips.get();
    const total = betTotal();

    if (total + chip > C.state.berries) {
      C.toast("Not enough Berries for that bet. Lower your chips or claim a bounty.", "warn");
      return;
    }

    bets[zone] = (bets[zone] || 0) + chip;
    C.sfx.chip();
    renderBets();
  }

  function clearBets() {
    if (spinning) return;
    bets = {};
    C.sfx.click();
    renderBets();
  }

  function setLocked(locked) {
    if (els.spinBtn) els.spinBtn.disabled = locked;
    if (els.clearBtn) els.clearBtn.disabled = locked;
    if (els.board) els.board.classList.toggle("locked", locked);
    if (chips) chips.setDisabled(locked);
  }

  async function spin() {
    if (spinning) return;

    const total = betTotal();
    if (!total) {
      C.toast("Place at least one bet on the table first, captain.", "warn");
      C.shake(els.board);
      return;
    }
    if (!C.canAfford(total)) {
      C.toast("Not enough Berries for those bets. Clear the table or claim a bounty.", "warn");
      return;
    }

    spinning = true;
    setLocked(true);
    C.wager(total);
    C.countRound();
    C.sfx.spin();

    if (els.result) {
      els.result.className = "roulette-result";
      els.result.textContent = "The wheel is turning…";
    }

    const index = Math.floor(Math.random() * WHEEL.length);
    const number = WHEEL[index];
    const segmentAngle = index * STEP + STEP / 2;
    const jitter = (Math.random() - 0.5) * STEP * 0.55;
    const target = (((360 - segmentAngle + jitter) % 360) + 360) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const delta = (target - current + 360) % 360;
    rotation += 360 * 6 + delta;
    if (els.wheel) els.wheel.style.transform = "rotate(" + rotation + "deg)";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    await sleep(reduced ? 900 : 5350);

    const color = colorOf(number);
    let payout = 0;
    const winningZones = [];

    Object.keys(bets).forEach(function (zone) {
      if (zoneWins(zone, number, color)) {
        payout += bets[zone] * zoneMultiplier(zone);
        winningZones.push(zone);
      }
    });

    const net = payout - total;

    C.pushHistory(
      "roulette",
      number + (color === "red" ? "R" : color === "black" ? "B" : "0") + (payout > 0 ? " +" + C.fmt(payout) : ""),
      (payout > 0 ? "win " : "loss ") + color
    );

    if (payout > 0) {
      C.reward(payout);
      C.recordWin(net);
      C.sfx.win();
      C.burstFrom(els.wheel, payout - total >= total * 4 ? 34 : 18);
      C.toast("Roulette pays " + C.fmt(payout) + " ฿ (" + color + " " + number + ")", "win");
    } else {
      C.sfx.lose();
      C.shake(els.board);
    }

    winningZones.forEach(function (zone) {
      const cell = els.board.querySelector('[data-zone="' + zone + '"]');
      if (!cell) return;
      cell.classList.add("hit");
      setTimeout(function () { cell.classList.remove("hit"); }, 1400);
    });

    if (els.result) {
      els.result.textContent = number + " · " + color.toUpperCase() + (payout > 0 ? " · +" + C.fmt(payout) + " ฿" : "");
      els.result.className = "roulette-result show result-" + color;
    }

    const ladderBet = C.progression.complete("roulette", net > 0 ? "win" : "loss");
    if (C.state.progression.mode !== "off") {
      const carryZones = Object.keys(bets);
      bets = {};
      carryZones.forEach(function (zone) { bets[zone] = ladderBet; });
      if (betTotal() > C.state.berries) {
        bets = {};
        C.toast("The next ladder stake is more than your chest. Place a smaller bet.", "warn");
      }
      renderBets();
    }

    spinning = false;
    setLocked(false);
  }

  function init() {
    els.wheel = C.$("#roulette-wheel");
    els.labels = C.$("#wheel-labels");
    els.board = C.$("#roulette-board");
    els.result = C.$("#roulette-result");
    els.total = C.$("#roulette-total");
    els.spinBtn = C.$("#roulette-spin");
    els.clearBtn = C.$("#roulette-clear");

    if (!els.board) return;

    chips = C.bindChips(C.$("#roulette-chips"), 25, function () {});
    buildWheel();
    buildBoard();

    els.board.addEventListener("click", function (event) {
      const cell = event.target.closest(".bet-cell");
      if (!cell) return;
      addBet(cell.dataset.zone);
    });

    els.spinBtn.addEventListener("click", spin);
    els.clearBtn.addEventListener("click", clearBets);
    window.addEventListener("resize", positionLabels);
  }

  return {
    init: init,
    refresh: refresh,
    spin: spin,
    clearBets: clearBets
  };
})();
