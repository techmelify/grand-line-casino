/* ============================================================
   Grand Line Casino — app bootstrap
   ============================================================ */

(function () {
  "use strict";

  const GAMES = ["slots", "blackjack", "roulette", "mines"];

  function initTabs() {
    const C = window.Casino;
    const tabs = C.$$(".tab");
    const panels = C.$$(".panel");
    if (!tabs.length) return;

    function activate(game, scroll) {
      if (GAMES.indexOf(game) === -1) return;

      tabs.forEach(function (tab) {
        const on = tab.dataset.game === game;
        tab.classList.toggle("active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
      });

      panels.forEach(function (panel) {
        const on = panel.id === "panel-" + game;
        panel.classList.toggle("active", on);
        if (on) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "");
        }
      });

      if (scroll) {
        const section = document.getElementById("games");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (game === "roulette" && window.Roulette && window.Roulette.refresh) {
        window.Roulette.refresh();
      }

      if (C.progression) C.progression.render();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        window.Casino.sfx.click();
        activate(tab.dataset.game, false);
      });

      tab.addEventListener("keydown", function (event) {
        const index = tabs.indexOf(tab);
        let next = -1;

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          next = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          next = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          next = 0;
        } else if (event.key === "End") {
          next = tabs.length - 1;
        }

        if (next !== -1) {
          event.preventDefault();
          activate(tabs[next].dataset.game, false);
          tabs[next].focus();
        }
      });
    });

    window.Casino.$$("[data-jump]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        activate(link.dataset.jump, true);
      });
    });

    const hash = window.location.hash.replace("#", "");
    if (GAMES.indexOf(hash) !== -1) activate(hash, false);
  }

  function initModal() {
    const C = window.Casino;
    const modal = C.$("#how-modal");
    const openBtn = C.$("#how-btn");
    if (!modal || !openBtn) return;

    openBtn.addEventListener("click", function () {
      C.sfx.click();
      if (typeof modal.showModal === "function") {
        modal.showModal();
      } else {
        modal.setAttribute("open", "");
      }
    });

    C.$$("[data-close]", modal).forEach(function (btn) {
      btn.addEventListener("click", function () {
        modal.close();
      });
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) modal.close();
    });
  }

  function initShortcuts() {
    const C = window.Casino;
    document.addEventListener("keydown", function (event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      const tag = (target.tagName || "").toLowerCase();
      if (
        tag === "input" || tag === "textarea" || tag === "select" ||
        tag === "button" || tag === "a" || target.isContentEditable
      ) return;

      const modal = document.getElementById("how-modal");
      if (modal && modal.open) return;

      const activeTab = C.$(".tab.active");
      const game = activeTab ? activeTab.dataset.game : "";
      const key = event.key;

      if (key === " " || event.code === "Space") {
        if (game === "slots" && window.Slots) {
          event.preventDefault();
          window.Slots.spin();
        } else if (game === "blackjack" && window.Blackjack) {
          event.preventDefault();
          window.Blackjack.dealOrHit();
        } else if (game === "roulette" && window.Roulette) {
          event.preventDefault();
          window.Roulette.spin();
        } else if (game === "mines" && window.Mines) {
          event.preventDefault();
          window.Mines.primary();
        }
      } else if (game === "blackjack" && window.Blackjack) {
        if (key === "h" || key === "H") {
          event.preventDefault();
          window.Blackjack.hit();
        } else if (key === "s" || key === "S") {
          event.preventDefault();
          window.Blackjack.stand();
        } else if (key === "d" || key === "D") {
          event.preventDefault();
          window.Blackjack.double();
        }
      }
    });
  }

  function initBubbles() {
    const bg = document.querySelector(".sea-bg");
    if (!bg) return;

    for (let i = 0; i < 26; i++) {
      const bubble = document.createElement("span");
      bubble.className = "bubble";
      const size = 2 + Math.random() * 6;
      bubble.style.left = Math.random() * 100 + "%";
      bubble.style.width = size + "px";
      bubble.style.height = size + "px";
      bubble.style.opacity = String(0.12 + Math.random() * 0.32);
      bubble.style.animationDuration = 11 + Math.random() * 18 + "s";
      bubble.style.animationDelay = "-" + Math.random() * 24 + "s";
      bg.appendChild(bubble);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    window.Casino.init();
    window.Slots.init();
    window.Blackjack.init();
    window.Roulette.init();
    window.Mines.init();
    initTabs();
    initModal();
    initShortcuts();
    initBubbles();

    const panels = window.Casino.$$(".panel");
    panels.forEach(function (panel) {
      if (!panel.classList.contains("active")) panel.setAttribute("hidden", "");
    });

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      });
    }
  });
})();
