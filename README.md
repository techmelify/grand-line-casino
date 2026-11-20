# Grand Line Casino

A One Piece–inspired, **play-money** casino built with plain HTML, CSS and JavaScript. No frameworks, no build step, no real money.

Open `index.html` in a browser and set sail.

## Games

| Game | House edge | Notes |
| --- | --- | --- |
| 🎰 Devil Fruit Slots | ≈ 4% | Weighted 3-reel slots. Any pair pays 0.5×; triple tiers up to 900×. |
| 🃏 Blackjack | ≈ 2% with basic strategy | 3:2 blackjack, dealer stands on 17, double down allowed. |
| 🎡 Grand Line Roulette | 2.7% | Single-zero European wheel. Even money, dozens, and 35:1 straight numbers. |
| 💎 Bounty Mines | ≈ 3% | 5×5 field, 3 mines, 18 chests for the full ~64× prize. |

## Features

- **Luffy & Ace** — the Straw Hat captain and the Fire Fist appear in the hero wanted posters and in a two-card crew tribute, using the supplied Pinterest character images (saved locally in `assets/`). They are included as a non-commercial fan tribute; One Piece and its characters belong to Eiichiro Oda, Shueisha and Toei Animation.
- **Wallet & persistence** — starts at 5,000 ฿ and saves to `localStorage`.
- **Daily bounty** — 1,000 ฿ every 24 hours; emergency 500 ฿ if you drop below 100 ฿.
- **Lifetime stats** — biggest win, rounds played, total wagered.
- **Sound effects** — generated with the Web Audio API (mute button in the header).
- **Responsive layout** — desktop, tablet, phone; roulette table scrolls horizontally on small screens.
- **Accessibility touches** — keyboard-navigable tabs, live regions for results, reduced-motion support, and shortcuts (Space to play the active game; H/S/D at blackjack).
- **Share-ready & installable** — social preview image, PWA manifest, app icons, a small offline shell, a sound-volume slider, and a rolling "last 10 results" strip for each game.
- **Bet ladder** — every game follows the chip values `10 → 25 → 50 → 100 → 250 → 500 → 1,000` and caps at 1,000 ฿. Pick a chip to set your starting stake, then choose **Rise on loss** (default; resets after a win), **Rise on win**, **Every round**, or **Off** in the ladder bar above the tabs. The active game's next stake is highlighted in the ladder.

## Project layout

```
index.html          Markup for the hero, Luffy & Ace crew cards, four game panels, modal, footer
styles.css          All styling, animations, and responsive rules
vercel.json         Vercel static config and asset cache headers
manifest.webmanifest PWA manifest and app icons
sw.js               Minimal network-first service worker for offline play
assets/             Character images, original share artwork (og-image) and app icons
js/core.js          Wallet, storage, sound, toasts, particles, chip controls
js/slots.js         Devil Fruit Slots
js/blackjack.js     Blackjack
js/roulette.js      Roulette wheel, betting board, payouts
js/mines.js         Bounty Mines
js/main.js          Tabs, modal, ambient bubbles, bootstrapping
```

## Notes

- The page is designed to work from the filesystem, so no server is required. Google Fonts are loaded from the network; offline it falls back to serif/system fonts.
- Pushes to `main` on GitHub are deployed automatically to Vercel.
- Berries are fictional and progress lives only in your browser. Use **Reset voyage** in the footer to start over.
- This is an unofficial fan project. Not affiliated with Eiichiro Oda, Shueisha, Toei Animation, or any official One Piece product. No purchases, no cash prizes, no real gambling.
