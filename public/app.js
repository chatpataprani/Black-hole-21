/**
 * Black Hole 21 — client application.
 *
 * The client never decides the winner, score, or Black Hole neighbors.
 * It renders exactly what the server sends and asks the server before
 * every move.
 */

"use strict";

// ============================================================
// Utilities
// ============================================================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const rand = (a, b) => a + Math.random() * (b - a);

// Deterministic-ish pseudo random from a seed, so particle fields feel
// designed rather than purely chaotic while still varying per hole.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

function showScreen(id) {
  $$(".screen").forEach((s) => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

// ============================================================
// Sound engine — procedural Web Audio, no external assets
// ============================================================

class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setEnabled(v) {
    this.enabled = v;
  }

  // Soft click for UI interactions
  click() {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 520;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.09);
  }

  // Rising rumble as the Black Hole forms
  formationRumble(durationSec = 1.4) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + durationSec);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + durationSec * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec + 0.1);
  }

  // Whoosh + suction when a number gets absorbed
  suction() {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35);
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start();

    // impact bass pulse
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  }

  // Deep pulse + short burst for final collapse
  collapse() {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(30, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(18, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.65);

    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    noise.connect(gain).connect(ctx.destination);
    noise.start();
  }

  chime(win) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.2, 293.7];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = ctx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.09, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.55);
    });
  }
}

const sound = new SoundEngine();

// ============================================================
// Ambient starfield background (always running, subtle)
// ============================================================

class Starfield {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.stars = [];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.intensity = 1; // can be boosted during Black Hole sequence
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    const count = Math.floor((this.w * this.h) / 9000);
    this.stars = new Array(count).fill(0).map(() => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: Math.random() * 1.4 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: rand(0.2, 0.6),
      drift: rand(-0.02, 0.02),
    }));
  }

  loop(t) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * s.speed + s.phase);
      s.y += s.drift * this.intensity;
      if (s.y > this.h) s.y = 0;
      if (s.y < 0) s.y = this.h;
      ctx.beginPath();
      ctx.globalAlpha = (0.25 + tw * 0.6) * clamp(this.intensity, 0.4, 1.6);
      ctx.fillStyle = "#cfd6ff";
      ctx.arc(s.x, s.y, s.r * (this.intensity > 1 ? 1.15 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(this.loop);
  }
}

const starfield = new Starfield($("#bg-canvas"));

// ============================================================
// Board rendering
// ============================================================

const ROWS_LAYOUT = [1, 2, 3, 4, 5, 6]; // circles per row, top to bottom
const ROW_OFFSETS = (() => {
  const offsets = [];
  let cursor = 0;
  for (const len of ROWS_LAYOUT) {
    offsets.push(cursor);
    cursor += len;
  }
  return offsets;
})();

function positionToRowCol(position) {
  for (let r = ROWS_LAYOUT.length - 1; r >= 0; r--) {
    if (position >= ROW_OFFSETS[r]) return { row: r, col: position - ROW_OFFSETS[r] };
  }
  return { row: 0, col: 0 };
}

class BoardView {
  constructor(rootEl) {
    this.root = rootEl;
    this.circles = new Map(); // position -> element
    this.onCircleClick = null;
    this.build();
  }

  build() {
    this.root.innerHTML = "";
    this.circles.clear();
    let pos = 0;
    ROWS_LAYOUT.forEach((len, rowIdx) => {
      const rowEl = document.createElement("div");
      rowEl.className = "board-row";
      for (let c = 0; c < len; c++) {
        const circle = document.createElement("button");
        circle.type = "button";
        circle.className = "circle empty";
        circle.dataset.position = String(pos);
        circle.setAttribute("aria-label", `Empty circle, row ${rowIdx + 1}`);
        circle.addEventListener("click", () => {
          if (this.onCircleClick) this.onCircleClick(Number(circle.dataset.position));
        });
        rowEl.appendChild(circle);
        this.circles.set(pos, circle);
        pos++;
      }
      this.root.appendChild(rowEl);
    });
  }

  getCircle(position) {
    return this.circles.get(position);
  }

  /** Renders board state from the server's authoritative board array. */
  render(board, { currentTurn, you, status } = {}) {
    board.forEach((cell, position) => {
      const el = this.circles.get(position);
      if (!el) return;
      const wasEmpty = el.classList.contains("empty") && !el.classList.contains("filled");
      if (cell === null) {
        el.className = "circle empty selectable";
        el.textContent = "";
        el.disabled = false;
        el.setAttribute("aria-label", "Empty circle");
      } else {
        const mine = cell.player === you;
        el.className = `circle filled ${cell.player === "player1" ? "p1" : "p2"}`;
        el.textContent = String(cell.number);
        el.disabled = true;
        el.setAttribute(
          "aria-label",
          `${cell.number}, placed by ${mine ? "you" : "opponent"}`
        );
        if (!el.querySelector(".owner-dot")) {
          const dot = document.createElement("span");
          dot.className = "owner-dot";
          el.appendChild(dot);
        }
        if (wasEmpty) {
          el.classList.add("number-pulse");
          setTimeout(() => el.classList.remove("number-pulse"), 520);
        }
      }
    });

    const canPlay = status === "playing" && currentTurn === you;
    this.circles.forEach((el) => {
      if (el.classList.contains("empty")) {
        el.classList.toggle("selectable", canPlay);
        el.disabled = !canPlay;
      }
    });
  }

  clearSelection() {
    this.circles.forEach((el) => el.classList.remove("selected"));
  }

  select(position) {
    this.clearSelection();
    const el = this.circles.get(position);
    if (el) el.classList.add("selected");
  }

  /** Returns the DOM rect of a circle relative to a given ancestor element. */
  relativeRect(position, ancestorEl) {
    const el = this.circles.get(position);
    if (!el) return null;
    const a = ancestorEl.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return {
      x: b.left - a.left + b.width / 2,
      y: b.top - a.top + b.height / 2,
      width: b.width,
      height: b.height,
    };
  }
}

const boardView = new BoardView($("#board"));

// ============================================================
// Black Hole cinematic
//
// Layers (drawn back-to-front, matching the design spec):
//   1. background gravitational glow
//   2. outer particle field
//   3. rotating accretion disk
//   4. bright inner disk
//   5. gravitational distortion (screen-space canvas warping cues)
//   6. dark event horizon
//   7. particle vortex (fast inner particles + absorption sparks)
// ============================================================

class BlackHoleCinematic {
  constructor(canvas, stageEl, boardView) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.boardView = boardView;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.running = false;
    this.t0 = 0;
    this.diskGrowth = 0; // 0..1 how "formed" the hole is
    this.diskSpin = 0; // radians accumulated
    this.diskSpeed = 0.9; // radians/sec base
    this.collapseT = 0; // 0..1 during final collapse
    this.collapsing = false;
    this.flashAlpha = 0;
    this.shockwaves = []; // {r, alpha}
    this.pulses = []; // small energy pulses on absorption
    this.lines = []; // gravitational connection lines {from:{x,y}, alpha}
    this.center = { x: 0, y: 0 };
    this.particles = [];
    this._raf = null;
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.stageEl.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
  }

  initParticles(seed) {
    const rng = mulberry32(seed);
    const count = 90;
    this.particles = new Array(count).fill(0).map(() => {
      const angle = rng() * Math.PI * 2;
      const radius = rand(40, Math.min(this.w, this.h) * 0.62);
      return {
        angle,
        radius,
        baseRadius: radius,
        speed: rand(0.4, 1.3),
        size: rand(0.8, 2.6),
        bright: rng() > 0.75,
        trail: rng() > 0.6,
        hueShift: rng(),
      };
    });
  }

  start(holePosition, neighbors, scores) {
    this.resize();
    const rect = this.boardView.relativeRect(holePosition, this.stageEl);
    this.center = { x: rect.x, y: rect.y };
    this.holeRadius = rect.width / 2;
    this.initParticles(holePosition * 7919 + 13);
    this.running = true;
    this.diskGrowth = 0;
    this.collapsing = false;
    this.collapseT = 0;
    this.flashAlpha = 0;
    this._loop(performance.now());
    return this._sequence(holePosition, neighbors, scores);
  }

  _loop(t) {
    if (!this.running) return;
    this._raf = requestAnimationFrame((tt) => this._loop(tt));
    this._draw(t);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  async _sequence(holePosition, neighbors, scores) {
    await this._formationPause();
    await this._gravitationalDistortion();
    await this._growDisk();
    await this._highlightNeighbors(neighbors);
    await this._absorbAll(neighbors);
    await this._collapse();
    this.stop();
  }

  // ---------- Stage 1: silence / pause ----------
  _formationPause() {
    return new Promise((resolve) => {
      const holeEl = this.boardView.getCircle(this.currentHolePosition);
      const distortionEl = $("#board-distortion");
      distortionEl.style.filter = "brightness(0.75) saturate(0.85)";
      starfield.intensity = 1.4;
      const caption = $("#formation-caption");
      caption.textContent = "THE BLACK HOLE IS FORMING…";
      caption.classList.remove("hidden");
      sound.formationRumble(1.1);
      setTimeout(resolve, 850);
    });
  }

  // ---------- Stage 2: gravitational distortion ----------
  _gravitationalDistortion() {
    return new Promise((resolve) => {
      const distortionEl = $("#board-distortion");
      const start = performance.now();
      const duration = 650;
      const shake = (t) => {
        const elapsed = t - start;
        const progress = clamp(elapsed / duration, 0, 1);
        const power = (1 - progress) * 3.5;
        const dx = (Math.random() - 0.5) * power;
        const dy = (Math.random() - 0.5) * power;
        distortionEl.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + power * 0.002})`;
        if (progress < 1 && this.running) {
          requestAnimationFrame(shake);
        } else {
          distortionEl.style.transform = "";
          resolve();
        }
      };
      requestAnimationFrame(shake);
    });
  }

  // ---------- Stage 3: accretion disk forms ----------
  _growDisk() {
    return new Promise((resolve) => {
      const start = performance.now();
      const duration = 900;
      const grow = (t) => {
        const progress = clamp((t - start) / duration, 0, 1);
        this.diskGrowth = easeOutCubic(progress);
        this.diskSpeed = 0.9 + progress * 1.1;
        if (progress < 1 && this.running) requestAnimationFrame(grow);
        else resolve();
      };
      requestAnimationFrame(grow);
    });
  }

  // ---------- Stage 4: highlight neighbors, dim the rest ----------
  _highlightNeighbors(neighbors) {
    return new Promise((resolve) => {
      const allFilled = $$(".circle.filled", this.boardView.root);
      const neighborPositions = new Set(neighbors.map((n) => n.position));
      allFilled.forEach((el) => {
        const pos = Number(el.dataset.position);
        if (neighborPositions.has(pos)) {
          el.classList.add("hole-neighbor", "glow");
        } else {
          el.classList.add("dim");
        }
      });
      this.lines = neighbors.map((n) => ({
        from: this.boardView.relativeRect(n.position, this.stageEl),
        alpha: 0,
      }));
      const start = performance.now();
      const fade = (t) => {
        const progress = clamp((t - start) / 300, 0, 1);
        this.lines.forEach((l) => (l.alpha = progress));
        if (progress < 1 && this.running) requestAnimationFrame(fade);
        else resolve();
      };
      requestAnimationFrame(fade);
    });
  }

  // ---------- Stage 5: absorb each neighbor in sequence ----------
  async _absorbAll(neighbors) {
    const scoreState = { player1: { sum: 0, parts: [] }, player2: { sum: 0, parts: [] } };
    $("#score-readout").classList.remove("hidden");
    $("#score-name-player1").textContent = appState.names.player1;
    $("#score-name-player2").textContent = appState.names.player2;

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      await this._absorbOne(n);
      scoreState[n.player].parts.push(n.number);
      const prevSum = scoreState[n.player].sum;
      scoreState[n.player].sum += n.number;
      $(`#score-sum-player${n.player === "player1" ? 1 : 2}`).textContent =
        scoreState[n.player].parts.join(" + ");
      await animateCountUp(
        $(`#score-total-player${n.player === "player1" ? 1 : 2}`),
        prevSum,
        scoreState[n.player].sum,
        "= "
      );
      await wait(120);
    }
  }

  _absorbOne(neighbor) {
    return new Promise((resolve) => {
      const el = this.boardView.getCircle(neighbor.position);
      if (!el) return resolve();
      el.classList.add("shake");
      sound.click();

      setTimeout(() => {
        const startRect = this.boardView.relativeRect(neighbor.position, this.stageEl);
        el.classList.add("consumed");

        const flying = document.createElement("div");
        flying.className = `flying-number ${neighbor.player === "player1" ? "p1" : "p2"}`;
        flying.textContent = String(neighbor.number);
        Object.assign(flying.style, {
          position: "absolute",
          left: "0px",
          top: "0px",
          width: startRect.width + "px",
          height: startRect.height + "px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontWeight: "700",
          fontSize: "1.1rem",
          color: "#fff",
          background:
            neighbor.player === "player1"
              ? "radial-gradient(circle at 35% 30%, rgba(90,209,255,0.9), rgba(20,40,70,0.9))"
              : "radial-gradient(circle at 35% 30%, rgba(255,138,92,0.9), rgba(60,30,20,0.9))",
          boxShadow:
            neighbor.player === "player1"
              ? "0 0 18px rgba(90,209,255,0.75)"
              : "0 0 18px rgba(255,138,92,0.75)",
          zIndex: 6,
          pointerEvents: "none",
          willChange: "transform, opacity",
        });
        this.stageEl.appendChild(flying);

        // Curved control point: offset perpendicular to the straight path,
        // biased in the disk's rotation direction for a swirling pull.
        const x1 = startRect.x, y1 = startRect.y;
        const x2 = this.center.x, y2 = this.center.y;
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist, ny = dx / dist; // perpendicular (rotation direction)
        const bow = dist * rand(0.28, 0.42);
        const cx = (x1 + x2) / 2 + nx * bow;
        const cy = (y1 + y2) / 2 + ny * bow;

        const duration = clamp(dist * 2.1, 420, 780);
        const start = performance.now();
        const spinTotal = rand(260, 420);

        const step = (t) => {
          const raw = clamp((t - start) / duration, 0, 1);
          const posT = easeInCubic(raw); // accelerating pull
          const bx = (1 - posT) * (1 - posT) * x1 + 2 * (1 - posT) * posT * cx + posT * posT * x2;
          const by = (1 - posT) * (1 - posT) * y1 + 2 * (1 - posT) * posT * cy + posT * posT * y2;

          const stretch = 1 + 0.35 * Math.sin(Math.min(raw, 0.7) * Math.PI);
          const shrink = raw < 0.55 ? 1 : lerp(1, 0.08, easeInCubic((raw - 0.55) / 0.45));
          const rotate = raw * spinTotal;
          const opacity = raw < 0.8 ? 1 : lerp(1, 0, (raw - 0.8) / 0.2);

          flying.style.transform =
            `translate(${bx - startRect.width / 2}px, ${by - startRect.height / 2}px) ` +
            `rotate(${rotate}deg) scale(${shrink * stretch}, ${shrink / Math.sqrt(stretch)})`;
          flying.style.opacity = String(opacity);

          if (raw < 1 && this.running) {
            requestAnimationFrame(step);
          } else {
            flying.remove();
            this.pulses.push({ r: 4, alpha: 1 });
            sound.suction();
            resolve();
          }
        };
        requestAnimationFrame(step);
      }, 260);
    });
  }

  // ---------- Stage 6: final collapse ----------
  _collapse() {
    return new Promise((resolve) => {
      const caption = $("#formation-caption");
      caption.classList.add("hidden");
      this.collapsing = true;
      sound.collapse();
      const start = performance.now();
      const duration = 1100;
      const step = (t) => {
        const progress = clamp((t - start) / duration, 0, 1);
        this.collapseT = progress;
        this.diskSpeed = 2 + progress * 9;
        if (progress > 0.55 && progress < 0.62) this.flashAlpha = 1;
        this.flashAlpha *= 0.92;
        if (progress > 0.6 && this.shockwaves.length === 0) {
          this.shockwaves.push({ r: this.holeRadius, alpha: 0.9 });
        }
        if (progress < 1 && this.running) requestAnimationFrame(step);
        else {
          starfield.intensity = 1;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  _draw(now) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const { x: cx, y: cy } = this.center;
    if (!cx && !cy) return;

    const growth = this.diskGrowth;
    this.diskSpin += (this.diskSpeed / 60) * (this.running ? 1 : 0);
    const collapseScale = this.collapsing ? lerp(1, 0.15, easeInCubic(this.collapseT)) : 1;

    // ---- Layer 1: background gravitational glow ----
    const glowR = (this.holeRadius * 6 + 40) * (0.6 + growth * 0.6) * collapseScale;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    glow.addColorStop(0, `rgba(111,92,255,${0.16 * growth})`);
    glow.addColorStop(0.5, `rgba(62,168,255,${0.08 * growth})`);
    glow.addColorStop(1, "rgba(10,10,20,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.w, this.h);

    // ---- gravitational connection lines to neighbors ----
    this.lines.forEach((l) => {
      if (l.alpha <= 0) return;
      ctx.save();
      ctx.strokeStyle = `rgba(255,157,61,${0.45 * l.alpha})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -now * 0.03;
      ctx.beginPath();
      ctx.moveTo(l.from.x, l.from.y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    });

    // ---- Layer 2: outer particle field ----
    for (const p of this.particles) {
      const pull = 0.15 + growth * 0.85 + (this.collapsing ? this.collapseT * 2 : 0);
      p.radius -= p.speed * pull * 0.6;
      p.angle += (p.speed * 0.01) * (1 + growth * 1.5);
      if (p.radius < this.holeRadius * 0.7 * collapseScale) {
        p.radius = p.baseRadius * rand(0.8, 1.05);
        p.angle = Math.random() * Math.PI * 2;
      }
      const px = cx + Math.cos(p.angle) * p.radius * collapseScale;
      const py = cy + Math.sin(p.angle) * p.radius * collapseScale * 0.94;
      const alpha = clamp(growth * (p.bright ? 0.9 : 0.5), 0, 1);
      ctx.beginPath();
      ctx.fillStyle = p.bright
        ? `rgba(255,226,138,${alpha})`
        : `rgba(180,190,255,${alpha * 0.8})`;
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
      if (p.trail) {
        const tx = cx + Math.cos(p.angle - 0.12) * p.radius * collapseScale;
        const ty = cy + Math.sin(p.angle - 0.12) * p.radius * collapseScale * 0.94;
        ctx.strokeStyle = `rgba(255,157,61,${alpha * 0.4})`;
        ctx.lineWidth = p.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    if (growth > 0.02) {
      // ---- Layer 3: rotating accretion disk (multi-layer ellipse rings) ----
      const baseR = this.holeRadius * (1.6 + growth * 1.9) * collapseScale;
      for (let layer = 0; layer < 4; layer++) {
        const layerR = baseR * (1 - layer * 0.17);
        const squish = 0.38 + layer * 0.04;
        const speed = this.diskSpin * (1 + layer * 0.35) * (layer % 2 === 0 ? 1 : -1);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(speed);
        const grad = ctx.createLinearGradient(-layerR, 0, layerR, 0);
        grad.addColorStop(0, `rgba(111,92,255,${0.05 * growth})`);
        grad.addColorStop(0.45, `rgba(255,157,61,${0.55 * growth})`);
        grad.addColorStop(0.5, `rgba(255,226,138,${0.85 * growth})`);
        grad.addColorStop(0.55, `rgba(255,157,61,${0.55 * growth})`);
        grad.addColorStop(1, `rgba(62,168,255,${0.05 * growth})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = layerR * (0.06 + layer * 0.01);
        ctx.beginPath();
        ctx.ellipse(0, 0, layerR, layerR * squish, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ---- Layer 4: bright inner disk ----
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.diskSpin * 1.6);
      const innerR = this.holeRadius * (1.15 + growth * 0.4) * collapseScale;
      const innerGrad = ctx.createRadialGradient(0, 0, innerR * 0.2, 0, 0, innerR);
      innerGrad.addColorStop(0, `rgba(255,255,255,${0.9 * growth})`);
      innerGrad.addColorStop(0.4, `rgba(255,226,138,${0.7 * growth})`);
      innerGrad.addColorStop(1, "rgba(255,157,61,0)");
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, innerR, innerR * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- Layer 6: dark event horizon (singularity) ----
    const horizonR = this.holeRadius * (0.55 + growth * 0.55) * collapseScale;
    const horizonGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, horizonR);
    horizonGrad.addColorStop(0, "rgba(0,0,0,1)");
    horizonGrad.addColorStop(0.85, "rgba(4,4,10,0.98)");
    horizonGrad.addColorStop(1, "rgba(4,4,10,0)");
    ctx.fillStyle = horizonGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, horizonR, 0, Math.PI * 2);
    ctx.fill();

    // ---- Layer 7: absorption pulses ----
    this.pulses.forEach((p) => {
      p.r += 3.5;
      p.alpha *= 0.88;
    });
    this.pulses = this.pulses.filter((p) => p.alpha > 0.02);
    this.pulses.forEach((p) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,226,138,${p.alpha})`;
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, horizonR + p.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // ---- Collapse flash + shockwave ----
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, horizonR * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    this.shockwaves.forEach((s) => {
      s.r += 14;
      s.alpha *= 0.93;
    });
    this.shockwaves = this.shockwaves.filter((s) => s.alpha > 0.02);
    this.shockwaves.forEach((s) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(200,210,255,${s.alpha})`;
      ctx.lineWidth = 3;
      ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function animateCountUp(el, from, to, prefix = "") {
  return new Promise((resolve) => {
    const duration = 320;
    const start = performance.now();
    const step = (t) => {
      const progress = clamp((t - start) / duration, 0, 1);
      const val = Math.round(lerp(from, to, easeOutCubic(progress)));
      el.textContent = prefix + val;
      if (progress < 1) requestAnimationFrame(step);
      else {
        el.textContent = prefix + to;
        el.classList.add("number-pulse");
        setTimeout(() => el.classList.remove("number-pulse"), 300);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

// ============================================================
// Winner screen cosmic particles (not confetti — drifting embers/stardust)
// ============================================================

class WinnerParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particles = [];
    this.running = false;
  }

  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
  }

  burst() {
    this.resize();
    this.running = true;
    const cx = this.w / 2;
    const cy = this.h * 0.32;
    this.particles = new Array(70).fill(0).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(1, 5);
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: rand(0.006, 0.014),
        size: rand(1, 3.2),
        color: Math.random() > 0.5 ? "255,226,138" : "111,146,255",
      };
    });
    this._loop();
    setTimeout(() => {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }, 3200);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.vx *= 0.99;
      p.life -= p.decay;
      if (p.life <= 0) return;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.color},${p.life})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}

const winnerParticles = new WinnerParticles($("#winner-canvas"));

// ============================================================
// Main application state + socket wiring
// ============================================================

const appState = {
  socket: null,
  roomCode: null,
  you: null, // "player1" | "player2"
  game: null, // last serialized game from server
  selectedPosition: null,
  names: { player1: "Player 1", player2: "Player 2" },
  cinematicPlayed: false,
};

const blackHoleCinematic = new BlackHoleCinematic(
  $("#blackhole-canvas"),
  $("#board-stage"),
  boardView
);

function connectSocket() {
  const socket = io();
  appState.socket = socket;

  socket.on("connect", () => {
    // Attempt silent reconnection if we have a saved session.
    const saved = loadSession();
    if (saved && saved.roomCode && saved.playerKey) {
      socket.emit(
        "reconnect_room",
        { roomCode: saved.roomCode, playerKey: saved.playerKey },
        (res) => {
          if (res && res.ok) {
            enterGame(res.game, saved.roomCode, res.you);
          } else {
            clearSession();
          }
        }
      );
    }
  });

  socket.on("error_message", (payload) => {
    showToast(payload?.message || "Something went wrong.");
  });

  socket.on("player_joined", ({ game }) => {
    updateGameState(game);
    if (game.status === "playing" && appState.roomCode) {
      // Host transitions from waiting room into the game.
      if ($("#screen-create").classList.contains("active") || $("#screen-join").classList.contains("active")) {
        enterGame(game, appState.roomCode, appState.you);
      }
    }
  });

  socket.on("game_started", ({ game }) => {
    updateGameState(game);
  });

  socket.on("move_made", ({ game }) => {
    updateGameState(game);
  });

  socket.on("black_hole_started", ({ game }) => {
    // Render normally first so the 20th move's number appears on the
    // board (status is already "blackhole", so render() automatically
    // makes every circle non-interactive) before the cinematic begins.
    updateGameState(game);
    runBlackHoleSequence(game);
  });

  socket.on("game_finished", ({ game }) => {
    updateGameState(game);
  });

  socket.on("player_disconnected", ({ game, player }) => {
    updateGameState(game);
    const name = appState.names[player] || "Opponent";
    const status = $("#opponent-status");
    status.textContent = `${name} disconnected — waiting for reconnection…`;
    status.classList.remove("hidden");
  });

  socket.on("player_reconnected", ({ game }) => {
    updateGameState(game);
    $("#opponent-status").classList.add("hidden");
  });

  socket.on("rematch", ({ game }) => {
    updateGameState(game);
    appState.cinematicPlayed = false;
    resetBoardVisuals();
    showScreen("screen-game");
  });
}

// ---------- session persistence (survive page refresh) ----------

function saveSession(roomCode, playerKey) {
  try {
    localStorage.setItem("bh21_session", JSON.stringify({ roomCode, playerKey }));
  } catch (e) {
    /* storage unavailable — reconnection just won't survive a refresh */
  }
}
function loadSession() {
  try {
    const raw = localStorage.getItem("bh21_session");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function clearSession() {
  try {
    localStorage.removeItem("bh21_session");
  } catch (e) {}
}

// ---------- game state -> UI ----------

function updateGameState(game, opts = {}) {
  appState.game = game;
  appState.names.player1 = game.players.player1?.name || "Player 1";
  appState.names.player2 = game.players.player2?.name || "Player 2";

  $("#name-player1").textContent = appState.names.player1;
  $("#name-player2").textContent = appState.names.player2;
  $("#chip-player1").classList.toggle("active-turn", game.currentTurn === "player1");
  $("#chip-player2").classList.toggle("active-turn", game.currentTurn === "player2");

  if (game.players.player1?.connected === false) {
    /* left to opponent-status banner */
  }
  if (game.players.player2 && game.players.player2.connected !== false) {
    $("#opponent-status").classList.add("hidden");
  }

  $("#move-counter").textContent = `Move ${game.moveCount} / 20`;

  if (game.status === "playing") {
    const myTurn = game.currentTurn === appState.you;
    $("#turn-text").textContent = myTurn ? "Your turn" : `${appState.names[game.currentTurn]}'s turn`;
    $("#selector-hint").textContent = myTurn
      ? appState.selectedPosition !== null
        ? "Pick a number 1–10"
        : "Choose a circle, then a number"
      : "Waiting for opponent…";
  } else if (game.status === "waiting") {
    $("#turn-text").textContent = "Waiting for opponent…";
  }

  boardView.render(game.board, { currentTurn: game.currentTurn, you: appState.you, status: game.status });

  renderNumberSelector();
}

function renderNumberSelector() {
  const wrap = $("#number-selector");
  if (wrap.childElementCount === 0) {
    for (let n = 1; n <= 10; n++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num-btn";
      btn.textContent = String(n);
      btn.dataset.number = String(n);
      btn.addEventListener("click", () => onNumberChosen(n));
      wrap.appendChild(btn);
    }
  }
  const game = appState.game;
  const canPlay =
    game && game.status === "playing" && game.currentTurn === appState.you && appState.selectedPosition !== null;
  $$(".num-btn", wrap).forEach((btn) => (btn.disabled = !canPlay));
}

function onCircleChosen(position) {
  const game = appState.game;
  if (!game || game.status !== "playing" || game.currentTurn !== appState.you) return;
  if (game.board[position] !== null) return;
  appState.selectedPosition = position;
  boardView.select(position);
  sound.click();
  $("#selector-hint").textContent = "Pick a number 1–10";
  renderNumberSelector();
}

function onNumberChosen(number) {
  const game = appState.game;
  if (!game || appState.selectedPosition === null) return;
  if (game.currentTurn !== appState.you) return;
  sound.click();

  const position = appState.selectedPosition;
  $$(".num-btn").forEach((b) => b.disabled = true);

  appState.socket.emit("make_move", { roomCode: appState.roomCode, position, number }, (res) => {
    if (!res.ok) {
      showToast(res.message || "Move rejected.");
      renderNumberSelector();
    } else {
      appState.selectedPosition = null;
      boardView.clearSelection();
    }
  });
}

function resetBoardVisuals() {
  boardView.build();
  boardView.onCircleClick = onCircleChosen;
  appState.selectedPosition = null;
  $("#formation-caption").classList.add("hidden");
  $("#score-readout").classList.add("hidden");
  $("#score-sum-player1").textContent = "";
  $("#score-sum-player2").textContent = "";
  $("#score-total-player1").textContent = "= 0";
  $("#score-total-player2").textContent = "= 0";
  $$(".circle", boardView.root).forEach((c) =>
    c.classList.remove("dim", "hole-neighbor", "glow", "consumed", "shake")
  );
  $("#board-distortion").style.filter = "";
  $("#board-distortion").style.transform = "";
  if (appState.game) {
    boardView.render(appState.game.board, {
      currentTurn: appState.game.currentTurn,
      you: appState.you,
      status: appState.game.status,
    });
  }
}

function enterGame(game, roomCode, you) {
  appState.roomCode = roomCode;
  appState.you = you;
  saveSession(roomCode, you);
  resetBoardVisuals();
  updateGameState(game);
  showScreen("screen-game");
}

async function runBlackHoleSequence(game) {
  if (appState.cinematicPlayed) return;
  appState.cinematicPlayed = true;
  boardView.onCircleClick = null;
  $("#selector-wrap").classList.add("hidden");
  blackHoleCinematic.currentHolePosition = game.blackHolePosition;

  const { neighbors, scores } = game.blackHoleResult;
  await blackHoleCinematic.start(game.blackHolePosition, neighbors, scores);

  starfield.intensity = 1;
  $("#selector-wrap").classList.remove("hidden");
  appState.socket.emit("black_hole_finished", { roomCode: appState.roomCode });
  await wait(300);
  revealWinner(game);
}

function revealWinner(game) {
  const { scores, winner } = game;
  $("#wname-player1").textContent = appState.names.player1;
  $("#wname-player2").textContent = appState.names.player2;
  $("#wscore-player1").textContent = "0";
  $("#wscore-player2").textContent = "0";

  const p1Block = $("#winner-score-player1");
  const p2Block = $("#winner-score-player2");
  p1Block.classList.remove("is-winner");
  p2Block.classList.remove("is-winner");

  const subtitle = $("#winner-subtitle");
  const title = $("#winner-title");
  const trophy = $("#winner-trophy");

  if (winner === "draw") {
    title.textContent = "DRAW";
    subtitle.textContent = "THE BLACK HOLE COULDN'T DECIDE.";
    subtitle.classList.remove("hidden");
    trophy.textContent = "🌌";
  } else {
    const winnerName = appState.names[winner];
    title.textContent = `${winnerName.toUpperCase()} WINS`;
    subtitle.classList.add("hidden");
    trophy.textContent = "🏆";
    (winner === "player1" ? p1Block : p2Block).classList.add("is-winner");
  }

  showScreen("screen-winner");
  animateCountUp($("#wscore-player1"), 0, scores.player1, "");
  animateCountUp($("#wscore-player2"), 0, scores.player2, "");
  sound.chime(winner !== "draw");
  winnerParticles.burst();
}

// ============================================================
// Screen navigation + form handlers
// ============================================================

$$("[data-back-to]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.backTo));
});

$("#btn-goto-create").addEventListener("click", () => {
  $("#create-form").classList.remove("hidden");
  $("#create-waiting").classList.add("hidden");
  showScreen("screen-create");
});
$("#btn-goto-join").addEventListener("click", () => showScreen("screen-join"));
$("#btn-how-to-play").addEventListener("click", () => showScreen("screen-how"));

$("#btn-create-submit").addEventListener("click", () => {
  const name = $("#create-name").value.trim() || "Player 1";
  $("#btn-create-submit").disabled = true;
  appState.socket.emit("create_room", { name }, (res) => {
    $("#btn-create-submit").disabled = false;
    if (!res.ok) return showToast(res.message || "Could not create room.");
    appState.roomCode = res.roomCode;
    appState.you = res.you;
    appState.game = res.game;
    appState.names.player1 = name;
    saveSession(res.roomCode, res.you);
    $("#room-code-text").textContent = res.roomCode;
    $("#create-form").classList.add("hidden");
    $("#create-waiting").classList.remove("hidden");
  });
});

$("#btn-copy-code").addEventListener("click", async () => {
  const code = $("#room-code-text").textContent;
  try {
    await navigator.clipboard.writeText(code);
    showToast("Room code copied");
  } catch (e) {
    showToast(code);
  }
});

$("#btn-join-submit").addEventListener("click", () => {
  const name = $("#join-name").value.trim() || "Player 2";
  const code = $("#join-code").value.trim().toUpperCase();
  if (!code) return showToast("Enter a room code.");
  $("#btn-join-submit").disabled = true;
  appState.socket.emit("join_room", { name, roomCode: code }, (res) => {
    $("#btn-join-submit").disabled = false;
    if (!res.ok) return showToast(res.message || "Could not join room.");
    appState.names[res.you] = name;
    enterGame(res.game, res.roomCode, res.you);
  });
});

$("#btn-play-again").addEventListener("click", () => {
  $("#btn-play-again").disabled = true;
  appState.socket.emit("rematch", { roomCode: appState.roomCode }, (res) => {
    $("#btn-play-again").disabled = false;
    if (res && !res.ok) showToast(res.message || "Could not start rematch.");
  });
});

$("#btn-new-game").addEventListener("click", () => {
  clearSession();
  appState.roomCode = null;
  appState.you = null;
  appState.game = null;
  appState.cinematicPlayed = false;
  $("#create-form").classList.remove("hidden");
  $("#create-waiting").classList.add("hidden");
  showScreen("screen-create");
});

$("#btn-home").addEventListener("click", () => {
  clearSession();
  appState.roomCode = null;
  appState.you = null;
  appState.game = null;
  appState.cinematicPlayed = false;
  showScreen("screen-home");
});

function bindSoundToggle(btn) {
  btn.addEventListener("click", () => {
    const enabled = btn.getAttribute("aria-pressed") !== "false";
    const next = !enabled;
    btn.setAttribute("aria-pressed", String(next));
    $$(".sound-toggle").forEach((b) => b.setAttribute("aria-pressed", String(next)));
    sound.setEnabled(next);
    if (next) sound.ensureCtx();
  });
}
bindSoundToggle($("#btn-sound-toggle"));
bindSoundToggle($("#btn-sound-toggle-game"));

// Room code input: auto-uppercase as the player types
$("#join-code").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});

boardView.onCircleClick = onCircleChosen;

connectSocket();
