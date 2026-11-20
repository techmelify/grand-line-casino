/* ============================================================
   Grand Line Casino — Blackjack
   ============================================================ */

window.Blackjack = (function () {
  "use strict";

  const C = window.Casino;
  const SUITS = [
    { mark: "♠", red: false },
    { mark: "♥", red: true },
    { mark: "♦", red: true },
    { mark: "♣", red: false }
  ];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  let deck = [];
  let player = [];
  let dealer = [];
  let bet = 0;
  let inRound = false;
  let busy = false;
  let hiddenHole = true;
  let chips = null;
  const session = { wins: 0, losses: 0, pushes: 0 };
  const els = {};

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function newDeck() {
    const cards = [];
    SUITS.forEach(function (suit) {
      RANKS.forEach(function (rank) {
        cards.push({ rank: rank, suit: suit.mark, red: suit.red });
      });
    });

    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = cards[i];
      cards[i] = cards[j];
      cards[j] = temp;
    }
    return cards;
  }

  function cardValue(rank) {
    if (rank === "A") return 11;
    if (rank === "J" || rank === "Q" || rank === "K") return 10;
    return Number(rank);
  }

  function handTotal(cards) {
    let total = 0;
    let aces = 0;
    cards.forEach(function (card) {
      if (card.rank === "A") {
        aces += 1;
        total += 11;
      } else {
        total += cardValue(card.rank);
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function makeCard(card, index, faceDown) {
    const el = document.createElement("div");
    el.className = "playing-card";
    el.style.setProperty("--i", index);
    if (faceDown) {
      el.classList.add("face-down");
      el.innerHTML = '<span class="card-back-mark">☠</span>';
      return el;
    }
    if (card.red) el.classList.add("red");
    el.innerHTML =
      '<span class="card-corner">' + card.rank + "<b>" + card.suit + "</b></span>" +
      '<span class="card-pip">' + card.suit + "</span>" +
      '<span class="card-corner bottom">' + card.rank + "<b>" + card.suit + "</b></span>";
    return el;
  }

  function render() {
    if (els.dealerCards) {
      els.dealerCards.innerHTML = "";
      dealer.forEach(function (card, i) {
        const faceDown = i === 1 && hiddenHole;
        els.dealerCards.appendChild(makeCard(card, i, faceDown));
      });
    }

    if (els.playerCards) {
      els.playerCards.innerHTML = "";
      player.forEach(function (card, i) {
        els.playerCards.appendChild(makeCard(card, i, false));
      });
    }

    if (els.dealerValue) {
      if (!dealer.length) {
        els.dealerValue.textContent = "—";
      } else if (hiddenHole) {
        els.dealerValue.textContent = handTotal([dealer[0]]) + " + ?";
      } else {
        els.dealerValue.textContent = handTotal(dealer);
      }
    }

    if (els.playerValue) {
      els.playerValue.textContent = player.length ? String(handTotal(player)) : "—";
    }
  }

  function setMessage(text) {
    if (els.msg) els.msg.textContent = text;
  }

  function updateSessionStats() {
    if (els.wins) els.wins.textContent = session.wins;
    if (els.losses) els.losses.textContent = session.losses;
    if (els.pushes) els.pushes.textContent = session.pushes;
  }

  function updateControls() {
    if (!els.deal) return;
    const canDouble = inRound && !busy && player.length === 2 && C.canAfford(bet);

    els.deal.disabled = inRound || busy;
    els.hit.disabled = !inRound || busy;
    els.stand.disabled = !inRound || busy;
    els.double.disabled = !canDouble;

    if (chips) chips.setDisabled(inRound || busy);
    if (els.betLabel) els.betLabel.textContent = C.fmt(inRound ? bet : chips.get());
  }

  async function deal() {
    if (inRound || busy) return;

    bet = chips.get();
    if (!C.canAfford(bet)) {
      C.toast("Not enough Berries for that bet. Claim a bounty or lower your stake.", "warn");
      C.shake(els.table);
      return;
    }

    C.wager(bet);
    C.countRound();

    deck = newDeck();
    player = [];
    dealer = [];
    inRound = true;
    busy = true;
    hiddenHole = true;
    render();
    updateControls();
    setMessage("Dealing…");

    await sleep(200);
    player.push(deck.pop());
    render();
    C.sfx.card();

    await sleep(230);
    dealer.push(deck.pop());
    render();
    C.sfx.card();

    await sleep(230);
    player.push(deck.pop());
    render();
    C.sfx.card();

    await sleep(230);
    dealer.push(deck.pop());
    render();
    C.sfx.card();

    busy = false;
    updateControls();

    if (handTotal(player) === 21 || handTotal(dealer) === 21) {
      await finishRound(true);
    } else {
      setMessage("Hit, stand, or double down, captain.");
    }
  }

  async function hit() {
    if (!inRound || busy) return;
    busy = true;
    updateControls();

    player.push(deck.pop());
    render();
    C.sfx.card();
    await sleep(280);

    busy = false;
    const total = handTotal(player);

    if (total > 21) {
      await finishRound(true);
      return;
    }

    updateControls();

    if (total === 21) {
      setMessage("Twenty-one! Standing pat.");
      await stand();
    }
  }

  async function stand() {
    if (!inRound || busy) return;
    busy = true;
    updateControls();

    hiddenHole = false;
    render();
    setMessage("The dealer reveals…");
    C.sfx.card();
    await sleep(400);

    while (handTotal(dealer) < 17) {
      dealer.push(deck.pop());
      render();
      C.sfx.card();
      await sleep(420);
    }

    await finishRound(false);
  }

  async function double() {
    if (!inRound || busy || player.length !== 2) return;
    if (!C.canAfford(bet)) {
      C.toast("Not enough Berries to double down.", "warn");
      return;
    }

    busy = true;
    updateControls();
    C.wager(bet);
    bet *= 2;
    updateControls();

    player.push(deck.pop());
    render();
    C.sfx.card();
    await sleep(360);

    busy = false;

    if (handTotal(player) > 21) {
      await finishRound(true);
      return;
    }

    await stand();
  }

  async function finishRound(reveal) {
    busy = true;
    updateControls();

    if (reveal) {
      hiddenHole = false;
      render();
      C.sfx.card();
      await sleep(380);
    }

    const playerTotal = handTotal(player);
    const dealerTotal = handTotal(dealer);
    const playerBJ = player.length === 2 && playerTotal === 21;
    const dealerBJ = dealer.length === 2 && dealerTotal === 21;

    let payout = 0;
    let outcome = "loss";
    let message = "";

    if (playerTotal > 21) {
      message = "Bust at " + playerTotal + "! The house takes your " + C.fmt(bet) + " ฿.";
    } else if (playerBJ && !dealerBJ) {
      payout = Math.floor(bet * 2.5);
      outcome = "win";
      message = "Blackjack! " + C.fmt(payout - bet) + " ฿ profit, paid 3:2.";
    } else if (dealerBJ && !playerBJ) {
      message = "The dealer has blackjack. The house takes it.";
    } else if (playerBJ && dealerBJ) {
      payout = bet;
      outcome = "push";
      message = "Both blackjack — push. Your stake returns.";
    } else if (dealerTotal > 21) {
      payout = bet * 2;
      outcome = "win";
      message = "Dealer busts at " + dealerTotal + "! You win " + C.fmt(bet) + " ฿.";
    } else if (playerTotal > dealerTotal) {
      payout = bet * 2;
      outcome = "win";
      message = "You win! " + playerTotal + " beats " + dealerTotal + " — " + C.fmt(bet) + " ฿ profit.";
    } else if (playerTotal === dealerTotal) {
      payout = bet;
      outcome = "push";
      message = "Push at " + playerTotal + ". Your stake returns.";
    } else {
      message = "Dealer wins " + dealerTotal + " to " + playerTotal + ". You lose " + C.fmt(bet) + " ฿.";
    }

    C.pushHistory(
      "bj",
      outcome === "win" ? "W +" + C.fmt(payout - bet) : outcome === "push" ? "PUSH" : "L -" + C.fmt(bet),
      outcome
    );

    if (payout > 0) {
      C.reward(payout);
      C.recordWin(payout - bet);
    }

    if (outcome === "win") {
      session.wins += 1;
      if (payout - bet >= 150) {
        C.sfx.bigWin();
        C.burstFrom(els.table, 28);
      } else {
        C.sfx.win();
        C.burstFrom(els.playerCards, 16);
      }
    } else if (outcome === "push") {
      session.pushes += 1;
      C.sfx.chip();
    } else {
      session.losses += 1;
      C.sfx.lose();
      C.shake(els.table);
    }

    updateSessionStats();
    setMessage(message);

    inRound = false;
    busy = false;
    updateControls();
  }

  function dealOrHit() {
    if (inRound) hit();
    else deal();
  }

  function init() {
    els.table = C.$("#bj-table");
    els.dealerCards = C.$("#bj-dealer-cards");
    els.playerCards = C.$("#bj-player-cards");
    els.dealerValue = C.$("#bj-dealer-value");
    els.playerValue = C.$("#bj-player-value");
    els.msg = C.$("#bj-msg");
    els.deal = C.$("#bj-deal");
    els.hit = C.$("#bj-hit");
    els.stand = C.$("#bj-stand");
    els.double = C.$("#bj-double");
    els.betLabel = C.$("#bj-bet");
    els.wins = C.$("#bj-wins");
    els.losses = C.$("#bj-losses");
    els.pushes = C.$("#bj-pushes");

    if (!els.deal) return;

    chips = C.bindChips(C.$("#bj-chips"), 100, function (value) {
      if (!inRound && els.betLabel) els.betLabel.textContent = C.fmt(value);
    });

    els.deal.addEventListener("click", deal);
    els.hit.addEventListener("click", hit);
    els.stand.addEventListener("click", stand);
    els.double.addEventListener("click", double);

    render();
    updateControls();
    updateSessionStats();
  }

  return {
    init: init,
    deal: deal,
    hit: hit,
    stand: stand,
    double: double,
    dealOrHit: dealOrHit
  };
})();
