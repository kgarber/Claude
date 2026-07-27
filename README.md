# 🃏 Elfer Raus! Online

The classic German card game **Elfer raus!** ("Eleven out!") — playable online with
friends, right in the browser. No accounts, no server, no downloads. Just cards,
confetti, and an irresponsible quantity of dad jokes.

**▶️ Play it here: https://kgarber.github.io/Claude/elfer-raus/**

## ✨ Features

- 🌐 **Online multiplayer for 2–6 players** — one player hosts a table, everyone else
  joins with a 5-letter room code (or a one-click invite link). Connections are
  peer-to-peer via WebRTC ([PeerJS](https://peerjs.com)), so it runs 100% free on
  GitHub Pages with no backend.
- 🎆 **Color blasts** — confetti pops on every card, bursts when a row opens, and a
  full-screen mega blast when somebody wins.
- 😄 **Certified dad humor** — a rotating joke ticker plus contextual zingers.
  ("Hi Drawing Three, I'm Dad.")
- 🔊 **Sounds & animations** — wiggling playable cards, pulsing turn indicators,
  little fanfares. Mutable, for the dads in open-plan offices.
- 📱 **Works on phones** — responsive layout, big tap targets.

## 🎮 How to play

Elfer raus! uses 80 cards: numbers **1–20** in four colors (red, yellow, green, blue).

1. Whoever holds the **red 11** starts by playing it.
2. On your turn, play as many cards as you like. Each card must either:
   - be an **11**, which opens its color's row, or
   - extend an open row by exactly one number (12, 13, … upward / 10, 9, … downward).
3. Can't play — or don't want to? **Draw 3 cards** from the pile instead (that ends
   your turn). If the pile is empty, you pass.
4. First player to empty their hand shouts **"Elfer raus!"** and wins. 🏆

## 🚀 Hosting your own copy

It's a fully static site — any static host works:

1. **GitHub Pages:** this repo publishes from the `gh-pages` branch, where the game
   lives in the `elfer-raus/` folder alongside the other games on the hub.
2. **Anything else:** serve the folder with any static file server
   (`python3 -m http.server`) — done.

To play together, all players just open the same URL. The host clicks
**Host a table** and shares the room code.

## 🛠️ Tech

- Vanilla HTML/CSS/JS — no build step, no framework, no dependencies to install.
- [PeerJS](https://peerjs.com) (from CDN) for WebRTC data channels; the host's
  browser is the authoritative game engine and relays personalized game state to
  each guest (nobody can peek at your hand).
- Hand-rolled canvas confetti engine, WebAudio sound effects.

## 📁 Layout

```
index.html          the whole UI (home / lobby / game screens)
css/style.css       lively colors, smooth animations
js/app.js           game engine + networking + rendering
js/confetti.js      the colors-blast department
js/jokes.js         the dad-humor department (groan responsibly)
```

---

*Why did the 11 go first? It just couldn't wait to be odd.* 🥁
