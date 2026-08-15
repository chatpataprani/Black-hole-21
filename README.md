<div align="center">

# 🕳️ Black Hole 21

**A real-time multiplayer number game with a cinematic gravitational finale.**

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Socket.IO](https://img.shields.io/badge/socket.io-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg)](#license)

</div>

---

## Overview

Two players alternately place numbers **1–10** onto a 21-circle pyramid. When only
one circle remains empty, it collapses into a **Black Hole** — pulling in every
number touching it. Totals are compared, and the **lowest score wins**.

The board, turn order, adjacency, scoring, and winner are all computed
server-side. The client only renders state and sends intent — nothing about
the outcome can be spoofed from the browser.

## Features

- ⚡️ **Real-time multiplayer** — Socket.IO rooms, shareable codes, no accounts
- 🔒 **Server-authoritative** — every move, score, and winner is validated and computed on the server
- 🌌 **Cinematic Black Hole sequence** — layered canvas accretion disk, particle field, gravitational lensing, curved-path number absorption, live score tally, collapse & winner reveal
- 🔊 **Procedural audio** — Web Audio sound design, no external assets, fully toggleable
- 🔁 **Reconnection handling** — survive a dropped connection or page refresh mid-game
- 📱 **Mobile-first UI** — dark cosmic design tuned for touch, down to small Android screens
- 🪶 **Zero external services** — in-memory state, no database, deploys anywhere Node runs

## Tech stack

| Layer      | Tech                                  |
|------------|----------------------------------------|
| Server     | Node.js, Express, Socket.IO            |
| Client     | Vanilla JS, Canvas 2D, Web Audio API   |
| State      | In-memory (no DB required)             |

## Project structure

```
black-hole-21/
├── server.js              # Express + Socket.IO entry point
├── game/
│   ├── gameRules.js         # Adjacency, validation, scoring, winner logic
│   ├── gameManager.js        # Per-room state transitions
│   └── roomManager.js        # Room codes + in-memory room store
└── public/
    ├── index.html            # App shell / screens
    ├── style.css               # Dark cosmic visual design
    └── app.js                   # Client logic + Black Hole cinematic renderer
```

## Quick start

```bash
npm install
npm start
```

## Game logic

Board positions are explicit, not inferred from pixel geometry:

```
                    0
                  1   2
                3   4   5
              6   7   8   9
           10  11  12  13  14
        15  16  17  18  19  20
```

`getBlackHoleNeighbors(position)` in `game/gameRules.js` returns the exact set
of circles adjacent to any position, keeping the rule isolated and easy to
change independently of rendering.

## License

MIT
