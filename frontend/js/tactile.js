/**
 * PETTR Visual Tactile Feedback, Glass-Mote Completion Bursts & Mobile Swipe Gestures
 * - Project-coloured translucent glass-mote particle bursts on completion
 * - Finalise lock-in diagonal glass refraction shimmer
 * - Bottom-centre symmetrical completion celebration wave
 * - Native-feeling horizontal swipe-to-complete on touch devices
 * (Audio remains exclusively within Focus Cockpit.)
 */
const TactileFX = {
  moteCanvas: null,
  moteCtx: null,
  motes: [],
  moteAnimId: null,
  _boundResize: null,
  _swipeBound: false,
  _shimmerTimer: null,

  prefersReducedMotion() {
    try {
      return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  },

  init() {
    this.ensureMoteCanvas();
    this.initSwipeGestures();
  },

  // --- Glass-Mote Completion Bursts ---

  ensureMoteCanvas() {
    if (this.moteCanvas && document.body && document.body.contains(this.moteCanvas)) return;
    if (!document.body) return;

    let canvas = document.getElementById("tactileMotesCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "tactileMotesCanvas";
      canvas.className = "tactile-motes-canvas";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
    }
    this.moteCanvas = canvas;
    this.moteCtx = canvas.getContext("2d");
    this.resizeMoteCanvas();

    if (this._boundResize) window.removeEventListener("resize", this._boundResize);
    this._boundResize = () => this.resizeMoteCanvas();
    window.addEventListener("resize", this._boundResize);
  },

  resizeMoteCanvas() {
    if (!this.moteCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.moteCanvas.width = Math.round(w * dpr);
    this.moteCanvas.height = Math.round(h * dpr);
    this.moteCanvas.style.width = `${w}px`;
    this.moteCanvas.style.height = `${h}px`;
    if (this.moteCtx) {
      this.moteCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  },

  parseRgb(colorStr) {
    const mode = (typeof WaveCanvas !== "undefined" && WaveCanvas.getThemeMode)
      ? WaveCanvas.getThemeMode()
      : (document.documentElement.getAttribute("data-theme") || "light");

    const themeFallback = {
      dark: [129, 140, 248],
      evening: [251, 191, 36],
      morning: [245, 158, 11],
      light: [59, 130, 246]
    }[mode] || [99, 102, 241];

    if (!colorStr || typeof colorStr !== "string") return themeFallback;
    const s = colorStr.trim();

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split("").map(ch => ch + ch).join("");
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if ((mode === "dark" || mode === "evening") && lum < 0.24) {
        r = Math.round(r * 0.25 + 218 * 0.75);
        g = Math.round(g * 0.25 + 226 * 0.75);
        b = Math.round(b * 0.25 + 240 * 0.75);
      } else if ((mode === "light" || mode === "morning") && lum > 0.88) {
        r = Math.round(r * 0.45 + 71 * 0.55);
        g = Math.round(g * 0.45 + 85 * 0.55);
        b = Math.round(b * 0.45 + 105 * 0.55);
      }
      return [r, g, b];
    }

    const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    }

    return themeFallback;
  },

  burstMotes({ x, y, color = null, count = 15, spread = 1.0 } = {}) {
    if (this.prefersReducedMotion()) return;
    this.ensureMoteCanvas();
    if (!this.moteCtx) return;

    const originX = (typeof x === "number" && isFinite(x)) ? x : window.innerWidth * 0.5;
    const originY = (typeof y === "number" && isFinite(y)) ? y : window.innerHeight * 0.4;
    const [r, g, b] = this.parseRgb(color);
    const isDark = (typeof WaveCanvas !== "undefined" && WaveCanvas.isDarkTheme)
      ? WaveCanvas.isDarkTheme()
      : (document.documentElement.getAttribute("data-theme") === "dark" || document.documentElement.getAttribute("data-theme") === "evening");

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.55;
      const speed = (1.3 + Math.random() * 3.1) * spread;
      const isShard = Math.random() < 0.38;
      const mixWhite = Math.random() < 0.35 ? 0.52 : 0.16;
      const mr = Math.round(r + (255 - r) * mixWhite);
      const mg = Math.round(g + (255 - g) * mixWhite);
      const mb = Math.round(b + (255 - b) * mixWhite);

      this.motes.push({
        x: originX + (Math.random() - 0.5) * 10,
        y: originY + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (0.55 + Math.random() * 0.9),
        size: isShard ? (3.2 + Math.random() * 3.6) : (2.4 + Math.random() * 3.2),
        isShard,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.11,
        life: 0,
        maxLife: 38 + Math.floor(Math.random() * 24),
        color: `${mr}, ${mg}, ${mb}`,
        alpha: isDark ? (0.72 + Math.random() * 0.24) : (0.62 + Math.random() * 0.26),
        shimmerPhase: Math.random() * Math.PI * 2
      });
    }

    if (!this.moteAnimId) {
      this._tickMotes();
    }
  },

  _tickMotes() {
    if (!this.moteCtx || !this.moteCanvas) {
      this.moteAnimId = null;
      return;
    }
    const ctx = this.moteCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    if (this.motes.length === 0) {
      this.moteAnimId = null;
      return;
    }

    const alive = [];
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.life++;
      if (m.life >= m.maxLife) continue;

      m.vx *= 0.945;
      m.vy = m.vy * 0.945 - 0.025;
      m.x += m.vx;
      m.y += m.vy;
      m.angle += m.rotSpeed;
      m.shimmerPhase += 0.22;

      const t = m.life / m.maxLife;
      const env = t < 0.14 ? (t / 0.14) : Math.pow(1 - (t - 0.14) / 0.86, 1.5);
      const twinkle = 0.78 + 0.22 * Math.sin(m.shimmerPhase);
      const alpha = m.alpha * env * twinkle;

      if (alpha <= 0.01) continue;
      alive.push(m);

      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);

      if (m.isShard) {
        const s = m.size * (0.65 + 0.35 * (1 - t));
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.62, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.62, 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(${m.color}, ${(alpha * 0.82).toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      } else {
        const r = m.size * (0.75 + 0.35 * (1 - t));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.1);
        g.addColorStop(0, `rgba(255, 255, 255, ${(alpha * 0.92).toFixed(3)})`);
        g.addColorStop(0.38, `rgba(${m.color}, ${(alpha * 0.75).toFixed(3)})`);
        g.addColorStop(1, `rgba(${m.color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.motes = alive;
    if (this.motes.length > 0) {
      this.moteAnimId = requestAnimationFrame(() => this._tickMotes());
    } else {
      ctx.clearRect(0, 0, w, h);
      this.moteAnimId = null;
    }
  },

  // --- High-Level Visual Tactile Event Triggers ---

  onItemToggle({ completed, x, y, color = null } = {}) {
    if (!completed) return;
    this.burstMotes({ x, y, color, count: 16, spread: 1.05 });
    if (typeof App !== "undefined" && App.haptic) App.haptic("light");
    if (typeof WaveCanvas !== "undefined" && WaveCanvas.pulseActivity) {
      WaveCanvas.pulseActivity({ kind: "complete", x, y, color });
    }
  },

  triggerLockShimmer(showcaseEl = null) {
    const el = showcaseEl || document.getElementById("briefingShowcaseWindow");
    if (el) {
      el.classList.remove("is-lock-shimmering");
      void el.offsetWidth;
      el.classList.add("is-lock-shimmering");
      clearTimeout(this._shimmerTimer);
      this._shimmerTimer = setTimeout(() => {
        el.classList.remove("is-lock-shimmering");
      }, 950);
    }
    if (typeof WaveCanvas !== "undefined" && WaveCanvas.pulseActivity) {
      const rect = el ? el.getBoundingClientRect() : null;
      WaveCanvas.pulseActivity({
        kind: "finalise",
        x: rect ? rect.left + rect.width * 0.5 : window.innerWidth * 0.5,
        y: rect ? rect.top + 80 : window.innerHeight * 0.3
      });
    }
  },

  celebrateQueueClear(showcaseEl = null) {
    const el = showcaseEl || document.getElementById("briefingShowcaseWindow");
    if (typeof App !== "undefined" && App.haptic) App.haptic("medium");

    const mode = (typeof WaveCanvas !== "undefined" && WaveCanvas.getThemeMode)
      ? WaveCanvas.getThemeMode()
      : (document.documentElement.getAttribute("data-theme") || "light");
    const themePalettes = {
      dark: ["#6366F1", "#818CF8", "#67E8F9", "#A5B4FC"],
      evening: ["#D97706", "#F59E0B", "#FBBF24", "#FDE68A"],
      morning: ["#D97706", "#F97316", "#FBBF24", "#FB7185"],
      light: ["#2563EB", "#0284C7", "#38BDF8", "#60A5FA"]
    };
    const palette = themePalettes[mode] || themePalettes.light;

    const rect = el ? el.getBoundingClientRect() : null;
    const bottomY = rect ? Math.min(window.innerHeight - 10, Math.max(24, rect.bottom - 4)) : window.innerHeight * 0.72;
    if (rect && !this.prefersReducedMotion()) {
      // Symmetrical outward wave of theme-cohesive motes radiating from the bottom-centre edge
      const centerX = rect.left + rect.width * 0.5;
      const waves = [
        { offsets: [0], delay: 0, count: 12 },
        { offsets: [-0.22, 0.22], delay: 90, count: 9 },
        { offsets: [-0.42, 0.42], delay: 180, count: 8 }
      ];
      waves.forEach((wave, wIdx) => {
        setTimeout(() => {
          wave.offsets.forEach((off, oIdx) => {
            const px = centerX + rect.width * off;
            this.burstMotes({
              x: px,
              y: bottomY,
              color: palette[(wIdx + oIdx) % palette.length],
              count: wave.count,
              spread: 0.95
            });
          });
        }, wave.delay);
      });
    }

    if (typeof WaveCanvas !== "undefined" && WaveCanvas.pulseActivity) {
      WaveCanvas.pulseActivity({
        kind: "queue_clear",
        x: rect ? rect.left + rect.width * 0.5 : window.innerWidth * 0.5,
        y: bottomY,
        color: palette[1]
      });
    }
  },

  // --- Mobile Swipe-to-Complete Gestures ---

  initSwipeGestures() {
    if (this._swipeBound) return;
    this._swipeBound = true;

    let activeRow = null;
    let startX = 0;
    let startY = 0;
    let currentDx = 0;
    let lockedHorizontal = false;
    let cancelled = false;
    const THRESHOLD = 72;

    const findSwipeableRow = (target) => {
      if (!target || !target.closest) return null;
      if (target.closest("input, button, a, select, textarea, .unified-timeline-container")) return null;
      const row = target.closest(".snapshot-unified-row[data-snap-id], .task-item[data-task-id], .task-item[data-event-id]");
      if (!row || row.classList.contains("is-locked")) return null;
      const cb = row.querySelector('input[type="checkbox"]');
      if (!cb || cb.disabled) return null;
      return row;
    };

    const resetRow = (row) => {
      if (!row) return;
      row.classList.remove("is-swiping", "is-swipe-ready");
      row.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      row.style.transform = "";
      row.style.removeProperty("--swipe-progress");
      setTimeout(() => {
        if (row) row.style.transition = "";
      }, 300);
    };

    document.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length !== 1) return;
      const row = findSwipeableRow(e.target);
      if (!row) return;
      activeRow = row;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentDx = 0;
      lockedHorizontal = false;
      cancelled = false;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!activeRow || cancelled || !e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!lockedHorizontal) {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          cancelled = true;
          activeRow = null;
          return;
        }
        if (dx > 14 && dx > Math.abs(dy) * 1.35) {
          lockedHorizontal = true;
          activeRow.classList.add("is-swiping");
          activeRow.style.transition = "none";
        } else {
          return;
        }
      }

      const clamped = dx <= 0 ? 0 : (dx <= THRESHOLD ? dx : THRESHOLD + (dx - THRESHOLD) * 0.28);
      currentDx = Math.min(118, clamped);
      const progress = Math.min(1, currentDx / THRESHOLD);
      activeRow.style.transform = `translate3d(${currentDx.toFixed(1)}px, 0, 0)`;
      activeRow.style.setProperty("--swipe-progress", progress.toFixed(2));
      activeRow.classList.toggle("is-swipe-ready", currentDx >= THRESHOLD);
    }, { passive: true });

    const finishSwipe = () => {
      if (!activeRow) return;
      const row = activeRow;
      const triggered = lockedHorizontal && currentDx >= THRESHOLD;
      activeRow = null;
      lockedHorizontal = false;
      currentDx = 0;

      resetRow(row);

      if (triggered) {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb && !cb.disabled) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    };

    document.addEventListener("touchend", finishSwipe, { passive: true });
    document.addEventListener("touchcancel", () => {
      if (activeRow) resetRow(activeRow);
      activeRow = null;
      lockedHorizontal = false;
      currentDx = 0;
    }, { passive: true });
  }
};

window.TactileFX = TactileFX;
window.addEventListener("DOMContentLoaded", () => {
  TactileFX.init();
});
