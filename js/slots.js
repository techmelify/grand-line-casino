/* ============================================================
   Grand Line Casino — Devil Fruit Slots
   ============================================================ */

window.Slots = (function () {
  "use strict";

  const C = window.Casino;

  /* Symbols are weighted. Triple pay is a multiple of the bet. */
  const SYMBOLS = [
    { id: "cherry", icon: "🍒", weight: 22, triple: 10 },
    { id: "anchor", icon: "⚓", weight: 20, triple: 15 },
    { id: "sword", icon: "🗡️", weight: 17, triple: 25 },
    { id: "hat", icon: "👒", weight: 14, triple: 50 },
    { id: "fruit", icon: "🍎", weight: 11, triple: 90 },
    { id: "skull", icon: "💀", weight: 8, triple: 180 },
    { id: "chest", icon: "💰", weight: 5, triple: 350 },
    { id: "pirate", icon: "🏴‍☠️", weight: 3, triple: 900 }
  ];

  const TOTAL_WEIGHT = SYMBOLS.reduce(function (sum, sym) { return sum + sym.weight; }, 0);

  let spinning = false;
  let els = {};
  let chips = null;

  function randomSymbol() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (let i = 0; i < SYMBOLS.length; i++) {
      roll -= SYMBOLS[i].weight;
      if (roll < 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function buildPaytable() {
    if (!els.paytable) return;
    els.paytable.innerHTML = "";

    const pairRow = document.createElement("div");
    pairRow.className = "paytable-row pair";
    const pairLabel = document.createElement("span");
    pairLabel.textContent = "Any pair";
    const pairPay = document.createElement("span");
    pairPay.className = "pays";
    pairPay.textContent = "0.5×";
    pairRow.appendChild(pairLabel);
    pairRow.appendChild(pairPay);
    els.paytable.appendChild(pairRow);

    SYMBOLS.slice().reverse().forEach(function (sym) {
      const row = document.createElement("div");
      row.className = "paytable-row";

      const icons = document.createElement("span");
      icons.className = "icons";
      icons.textContent = sym.icon + sym.icon + sym.icon;

      const pays = document.createElement("span");
      pays.className = "pays";
      pays.textContent = sym.triple + "×";

      row.appendChild(icons);
      row.appendChild(pays);
      els.paytable.appendChild(row);
    });
  }

  function animateReel(reel, finalSymbol, duration) {
    const symEl = reel.querySelector(".reel-sym");
    reel.classList.add("spinning");
    reel.classList.remove("landed");

    const interval = setInterval(function () {
      symEl.textContent = randomSymbol().icon;
    }, 62 + Math.random() * 26);

    return new Promise(function (resolve) {
      setTimeout(function () {
        clearInterval(interval);
        symEl.textContent = finalSymbol.icon;
        reel.classList.remove("spinning");
        reel.classList.remove("landed");
        void reel.offsetWidth;
        reel.classList.add("landed");
        C.sfx.reelStop();
        resolve();
      }, duration);
    });
  }

  function setMessage(text) {
    if (els.msg) els.msg.textContent = text;
  }

  async function spin() {
    if (spinning) return;

    const bet = chips.get();
    if (!C.canAfford(bet)) {
      C.toast("Your chest is too light for that bet. Lower the stake or claim a bounty.", "warn");
      C.shake(els.machine);
      return;
    }

    spinning = true;
    els.spinBtn.disabled = true;
    chips.setDisabled(true);
    els.payline.classList.remove("win");

    C.sfx.spin();
    C.wager(bet);
    C.countRound();
    setMessage("The sea decides…");

    const result = [randomSymbol(), randomSymbol(), randomSymbol()];

    await Promise.all([
      animateReel(els.reels[0], result[0], 720),
      animateReel(els.reels[1], result[1], 1040),
      animateReel(els.reels[2], result[2], 1360)
    ]);

    const [a, b, c] = result;
    const isTriple = a.id === b.id && b.id === c.id;
    const isPair = !isTriple && (a.id === b.id || b.id === c.id || a.id === c.id);

    let multiplier = 0;
    if (isTriple) multiplier = a.triple;
    else if (isPair) multiplier = 0.5;

    const payout = Math.floor(bet * multiplier);
    const net = payout - bet;

    C.pushHistory(
      "slots",
      result.map(function (s) { return s.icon; }).join(" ") + (payout > 0 ? " +" + C.fmt(payout) : ""),
      payout > 0 ? (isTriple ? "win" : "push") : "loss"
    );

    if (payout > 0) {
      C.reward(payout);
      C.recordWin(net);

      if (isTriple) {
        els.payline.classList.add("win");
        if (multiplier >= 150) {
          C.sfx.bigWin();
          C.burstFrom(els.reels[1], 34);
          C.burstFrom(els.reels[0], 16);
          C.burstFrom(els.reels[2], 16);
          setMessage("JACKPOT! " + a.icon + " " + multiplier + "× — " + C.fmt(payout) + " ฿!");
          C.toast("Triple " + a.icon + "! " + multiplier + "× pays " + C.fmt(payout) + " ฿", "win", 4800);
        } else {
          C.sfx.win();
          C.burstFrom(els.reels[1], 20);
          setMessage("Three " + a.icon + "! " + multiplier + "× pays " + C.fmt(payout) + " ฿.");
          C.toast("Nice haul: +" + C.fmt(payout) + " ฿ (" + multiplier + "×)", "win");
        }
      } else {
        C.sfx.chip();
        setMessage("A pair pays " + C.fmt(payout) + " ฿ — half your stake back.");
      }
    } else {
      C.sfx.lose();
      C.shake(els.machine);
      setMessage("No match. The sea keeps its treasure this time.");
    }

    if (isTriple) {
      setTimeout(function () { els.payline.classList.remove("win"); }, 2200);
    }

    chips.setDisabled(false);
    els.spinBtn.disabled = false;
    spinning = false;
  }

  function init() {
    els.machine = C.$(".machine");
    els.reels = [C.$("#reel-0"), C.$("#reel-1"), C.$("#reel-2")];
    els.msg = C.$("#slots-msg");
    els.paytable = C.$("#slots-paytable");
    els.payline = C.$("#slots-payline");
    els.spinBtn = C.$("#slots-spin");
    els.betLabel = C.$("#slots-bet");

    if (!els.spinBtn) return;

    chips = C.bindChips(C.$("#slots-chips"), 50, function (value) {
      if (els.betLabel) els.betLabel.textContent = C.fmt(value);
    });

    els.spinBtn.addEventListener("click", spin);
    buildPaytable();

    els.reels[0].querySelector(".reel-sym").textContent = SYMBOLS[0].icon;
    els.reels[1].querySelector(".reel-sym").textContent = SYMBOLS[1].icon;
    els.reels[2].querySelector(".reel-sym").textContent = SYMBOLS[3].icon;
  }

  return { init: init, spin: spin };
})();
