/* ============================================================
   Grand Line Casino — Bounty Mines
   5x5 grid, 3 mines, cash out any time, full board at 18 picks.
   ============================================================ */

window.Mines = (function () {
  "use strict";

  const C = window.Casino;
  const TOTAL = 25;
  const BOMBS = 3;
  const MAX_PICKS = 18;
  const HOUSE_EDGE = 0.97; /* 3% */
  const TREASURE = ["💎", "💰", "🗝️", "⚜️", "🪙"];

  let chips = null;
  let els = {};
  let active = false;
  let picks = 0;
  let bet = 0;
  let mines = new Set();
  let revealed = new Set();

  function multiplierFor(safePicks) {
    if (safePicks <= 0) return 1;
    let survive = 1;
    for (let i = 0; i < safePicks; i++) {
      survive *= (TOTAL - BOMBS - i) / (TOTAL - i);
    }
    return (HOUSE_EDGE / survive);
  }

  function payoutFor(safePicks) {
    return Math.floor(bet * multiplierFor(safePicks));
  }

  function randomMines() {
    const set = new Set();
    while (set.size < BOMBS) {
      set.add(Math.floor(Math.random() * TOTAL));
    }
    return set;
  }

  function tileAt(index) {
    return els.grid ? els.grid.querySelector('[data-index="' + index + '"]') : null;
  }

  function buildGrid() {
    els.grid.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "mine-tile";
      tile.dataset.index = String(i);
      tile.setAttribute("aria-label", "Tile " + (i + 1) + ", hidden");

      const face = document.createElement("span");
      face.className = "tile-face";
      face.textContent = "?";
      tile.appendChild(face);

      tile.disabled = true;
      els.grid.appendChild(tile);
    }
  }

  function setTilesEnabled(enabled) {
    if (!els.grid) return;
    els.grid.querySelectorAll(".mine-tile").forEach(function (tile) {
      tile.disabled = !enabled;
    });
  }

  function disableAllTiles() {
    setTilesEnabled(false);
  }

  function updateHud() {
    if (!els.grid) return;

    const mult = multiplierFor(picks);
    if (els.mult) els.mult.textContent = mult.toFixed(2) + "×";
    if (els.picks) els.picks.textContent = picks + " / " + MAX_PICKS;
    if (els.next) {
      els.next.textContent = active && picks < MAX_PICKS
        ? multiplierFor(picks + 1).toFixed(2) + "×"
        : "—";
    }

    if (els.cashout) {
      const available = active && picks > 0;
      els.cashout.disabled = !available;
      els.cashout.textContent = available
        ? "Cash out · " + C.fmt(payoutFor(picks)) + " ฿"
        : "Cash out";
    }

    if (els.start) {
      els.start.disabled = active;
      els.start.textContent = active ? "Round in progress" : "New round";
    }

    if (chips) chips.setDisabled(active);
  }

  function setMessage(text) {
    if (els.msg) els.msg.textContent = text;
  }

  function startRound() {
    if (active) return;

    const stake = chips.get();
    if (!C.canAfford(stake)) {
      C.toast("Not enough Berries for that stake. Lower it or claim a bounty.", "warn");
      C.shake(els.grid);
      return;
    }

    C.wager(stake);
    C.countRound();
    C.sfx.spin();

    bet = stake;
    picks = 0;
    mines = randomMines();
    revealed = new Set();
    active = true;

    buildGrid();
    setTilesEnabled(true);

    els.start.textContent = "Round in progress";
    els.start.disabled = true;
    if (els.cashout) {
      els.cashout.disabled = true;
      els.cashout.textContent = "Cash out";
    }

    updateHud();
    setMessage("Pick a tile, captain. Three Marine mines are out there.");
  }

  function revealMines(skipIndex) {
    mines.forEach(function (index) {
      if (index === skipIndex) return;
      const tile = tileAt(index);
      if (!tile) return;
      tile.classList.add("mined", "revealed");
      tile.querySelector(".tile-face").textContent = "💣";
    });
  }

  function bust(tile, index) {
    active = false;
    tile.classList.add("bomb", "revealed");
    tile.querySelector(".tile-face").textContent = "💥";
    tile.setAttribute("aria-label", "Mine hit");

    revealMines(index);
    disableAllTiles();

    C.sfx.bomb();
    C.shake(els.grid);
    C.shake(els.msg);
    C.toast("BOOM! The Marines got you. " + C.fmt(bet) + " ฿ lost.", "lose");
    C.pushHistory("mines", "💥 -" + C.fmt(bet), "loss");
    setMessage("Boom. The Marines take the chest. You found " + picks + " treasure tile" + (picks === 1 ? "" : "s") + ".");
    C.progression.complete("mines", "loss");
    updateHud();
    if (els.start) els.start.textContent = "New round";
  }

  function safeTile(tile, index) {
    revealed.add(index);
    picks += 1;

    tile.classList.add("safe", "revealed");
    tile.querySelector(".tile-face").textContent =
      TREASURE[(index * 3 + picks) % TREASURE.length];
    tile.setAttribute("aria-label", "Treasure, safe");

    C.sfx.chip();

    if (picks % 3 === 0) {
      C.burstFrom(tile, 6);
    }

    if (picks >= MAX_PICKS) {
      updateHud();
      cashOut(true);
      return;
    }

    updateHud();

    if (picks >= 14) {
      setMessage("Nerves of steel. " + (MAX_PICKS - picks) + " more for the full bounty.");
    } else if (picks >= 8) {
      setMessage("The multiplier is climbing. Cash out or keep digging?");
    } else {
      setMessage("Safe! " + C.fmt(payoutFor(picks)) + " ฿ waiting if you cash out now.");
    }
  }

  function cashOut(auto) {
    if (!active || picks === 0) return;

    const mult = multiplierFor(picks);
    const payout = payoutFor(picks);
    active = false;

    C.pushHistory("mines", "💎 +" + C.fmt(payout) + " · " + mult.toFixed(2) + "×", "win");
    C.reward(payout);
    C.recordWin(payout - bet);
    C.progression.complete("mines", "win");
    revealMines(-1);
    disableAllTiles();

    if (auto) {
      C.sfx.bigWin();
      C.burstFrom(els.grid, 36);
      C.toast("Full board cleared! +" + C.fmt(payout) + " ฿ at " + mult.toFixed(2) + "×", "win", 5000);
      setMessage("Bounty board cleared! You plundered " + C.fmt(payout) + " ฿ at " + mult.toFixed(2) + "×.");
    } else {
      C.sfx.cash();
      C.burstFrom(els.cashout, 22);
      C.toast("Cashed out " + C.fmt(payout) + " ฿ (" + mult.toFixed(2) + "×)", "win");
      setMessage("Cashed out " + C.fmt(payout) + " ฿ at " + mult.toFixed(2) + "×. Three Marines slipped away.");
    }

    updateHud();
    els.start.textContent = "New round";
  }

  function onGridClick(event) {
    if (!active) return;
    const tile = event.target.closest(".mine-tile");
    if (!tile) return;
    const index = Number(tile.dataset.index);
    if (revealed.has(index)) return;

    if (mines.has(index)) {
      bust(tile, index);
    } else {
      safeTile(tile, index);
    }
  }

  function primary() {
    if (active) cashOut(false);
    else startRound();
  }

  function init() {
    els.grid = C.$("#mines-grid");
    els.msg = C.$("#mines-msg");
    els.mult = C.$("#mines-mult");
    els.picks = C.$("#mines-picks");
    els.next = C.$("#mines-next");
    els.start = C.$("#mines-start");
    els.cashout = C.$("#mines-cashout");
    els.betLabel = C.$("#mines-bet");

    if (!els.grid || !els.start) return;

    chips = C.bindChips(C.$("#mines-chips"), 100, function (value) {
      if (!active && els.betLabel) els.betLabel.textContent = C.fmt(value);
    });

    buildGrid();
    els.start.addEventListener("click", startRound);
    els.cashout.addEventListener("click", function () { cashOut(false); });
    els.grid.addEventListener("click", onGridClick);

    updateHud();
    if (els.start) els.start.textContent = "Start digging";
  }

  return {
    init: init,
    start: startRound,
    cashOut: function () { cashOut(false); },
    primary: primary
  };
})();
