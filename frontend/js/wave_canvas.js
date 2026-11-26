/**
 * PETTR High-Precision Diurnal Solar Wave Canvas
 * Top-down elevated topographic contour landscape with dynamic wave swells
 * and 4 distinct solar atmospheres:
 * - Dawn/Morning: Radiant sunrise glow, golden amber & rose mist rays
 * - Midday/Light: Serene airy celestial sky wash, drifting 3D cumulus clouds
 * - Dusk/Evening: Fiery sunset horizon, magenta/orange twilight cloud ribbons
 * - Night/Dark: Deep obsidian space with undulating Aurora Borealis curtains
 */
const WaveCanvas = {
  canvas: null,
  ctx: null,
  animationId: null,
  width: 0,
  height: 0,
  step: 0,
  _boundResize: null,
  leaves: [],
  nextGustTime: 0,
  gustActive: false,
  gustEndTime: 0,
  gustSpawnCount: 0,
  maxGustLeaves: 16,
  // Morning: Dandelion seeds / warm pollen thermals
  dandelions: [],
  nextMorningGustTime: 0,
  morningGustActive: false,
  morningGustEndTime: 0,
  morningSpawnCount: 0,
  maxMorningSeeds: 14,
  // Light/Afternoon: Soaring sky swallows / birds
  birds: [],
  nextFlockTime: 0,
  // Dark/Night: Zenith twinkling stars & shooting stars
  stars: [],
  meteors: [],
  nextMeteorTime: 0,
  // v11.2 Activity-Reactive Atmospheric Ripples & Glow Boost
  ripples: [],
  auroraBoost: 0,
  // v13.8 Streamlined Diurnal Nature Reactive Flocks (6 Bird Species, Detailed 2-Segment Wings)
  NATURE_BIRD_SPECIES: ["swallow", "crane", "falcon", "heron", "albatross", "starling"],
  NATURE_PHENOMENA: ["thermal_flock"],
  naturePhenomena: [],
  _lastNaturePhenomenon: "",
  _lastBirdSpecies: "",

  _modeForHour(hour) {
    const h = ((Number(hour) % 24) + 24) % 24;
    if (h >= 6 && h < 12) return "morning";
    if (h >= 12 && h < 17) return "light";
    if (h >= 17 && h < 21) return "evening";
    return "dark";
  },

  getDiurnalHour(mode = null) {
    const activeMode = mode || this.getThemeMode();
    const defaults = { morning: 7.5, light: 13.0, evening: 18.5, dark: 23.0 };
    try {
      const storedMode = localStorage.getItem("pettr_theme_mode") || "auto";
      if (storedMode === "slider") {
        const raw = localStorage.getItem("pettr_theme_slider_hour");
        const h = parseFloat(raw);
        if (Number.isFinite(h) && this._modeForHour(h) === activeMode) {
          return ((h % 24) + 24) % 24;
        }
      } else if (storedMode === "auto") {
        const now = new Date();
        const h = now.getHours() + now.getMinutes() / 60;
        if (this._modeForHour(h) === activeMode) {
          return h;
        }
      }
    } catch (_) {}
    return defaults[activeMode] !== undefined ? defaults[activeMode] : 13.0;
  },

  getThemeMode() {
    const docTheme = document.documentElement.getAttribute("data-theme");
    const bodyTheme = document.body ? document.body.getAttribute("data-theme") : null;
    const current = docTheme || bodyTheme;
    if (current === "morning" || current === "evening" || current === "dark" || current === "light" || current === "afternoon") {
      return current === "afternoon" ? "light" : current;
    }
    const stored = localStorage.getItem("pettr_theme_mode");
    if (stored === "morning" || stored === "evening" || stored === "dark" || stored === "light") {
      return stored;
    }
    if (stored === "slider") {
      const savedHour = parseFloat(localStorage.getItem("pettr_theme_slider_hour") || new Date().getHours());
      return this._modeForHour(Number.isFinite(savedHour) ? savedHour : new Date().getHours());
    }
    return this._modeForHour(new Date().getHours());
  },

  isDarkTheme() {
    const mode = this.getThemeMode();
    return mode === "dark" || mode === "evening";
  },

  getWorldMode() {
    const docWorld = document.documentElement.getAttribute("data-world");
    const bodyWorld = document.body ? document.body.getAttribute("data-world") : null;
    const current = docWorld || bodyWorld;
    if (current === "nature" || current === "gateway" || current === "deep-blue") {
      return current;
    }
    try {
      const stored = localStorage.getItem("pettr_theme_world");
      if (stored === "nature" || stored === "gateway" || stored === "deep-blue") {
        return stored;
      }
    } catch (_) {}
    return "nature";
  },

  _boundVisibility: null,
  _lastFrameTs: 0,
  _dpr: 1,

  init() {
    this.canvas = document.getElementById("bgWaveCanvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.resize();
    if (this._boundResize) window.removeEventListener("resize", this._boundResize);
    this._boundResize = () => this.resize();
    window.addEventListener("resize", this._boundResize);

    // Battery optimisation: pause animation completely when browser tab is hidden
    if (this._boundVisibility) document.removeEventListener("visibilitychange", this._boundVisibility);
    this._boundVisibility = () => {
      if (document.hidden) {
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
      } else if (!this.animationId) {
        this._lastFrameTs = performance.now();
        this.animate(this._lastFrameTs);
      }
    };
    document.addEventListener("visibilitychange", this._boundVisibility);

    this._lastFrameTs = performance.now();
    this.animate(this._lastFrameTs);
  },

  resize() {
    if (!this.canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Smart DPR cap: 1.0 on mobile (saves ~60-75% GPU fill-rate behind glass), 1.5 max on desktop
    const dpr = Math.min(window.devicePixelRatio || 1, w < 768 ? 1.0 : 1.5);
    this._dpr = dpr;
    this.width = w;
    this.height = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.stars = [];
    if (typeof WorldGateway !== "undefined") WorldGateway.cacheKey = "";
    if (typeof WorldDeepBlue !== "undefined") WorldDeepBlue.cacheKey = "";
  },

  animate(ts) {
    if (document.hidden) {
      this.animationId = null;
      return;
    }
    const now = typeof ts === "number" ? ts : performance.now();
    const minInterval = this.width < 768 ? 33 : 22; // ~30fps mobile / ~45fps desktop for battery life
    const elapsedMs = now - (this._lastFrameTs || now);

    if (elapsedMs >= minInterval || !this._lastFrameTs) {
      const dt = Math.min(0.05, Math.max(0.012, (elapsedMs || 22) / 1000));
      this._lastFrameTs = now;
      this.step += 0.008 * (dt * 60); // Consistent fluid propagation regardless of refresh rate
      this.draw(dt);
    }

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reducedMotion) {
      this.animationId = null;
      return;
    }
    this.animationId = requestAnimationFrame((nextTs) => this.animate(nextTs));
  },

  draw(dt = 0.016) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    if (this._dpr && ctx.setTransform) {
      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    }

    const mode = this.getThemeMode();
    const diurnalHour = this.getDiurnalHour(mode);
    const world = this.getWorldMode();
    if (this._lastWorldMode && this._lastWorldMode !== world) {
      this.ripples = [];
    }
    this._lastWorldMode = world;

    // Delegate cleanly to alternate World renderers when selected
    if (world === "gateway" && typeof WorldGateway !== "undefined") {
      WorldGateway.draw(ctx, w, h, mode, dt, this.step, diurnalHour);
      this._renderSharedPostDraw(ctx, w, h, mode, dt);
      return;
    }
    if (world === "deep-blue" && typeof WorldDeepBlue !== "undefined") {
      WorldDeepBlue.draw(ctx, w, h, mode, dt, this.step, diurnalHour);
      this._renderSharedPostDraw(ctx, w, h, mode, dt);
      return;
    }

    const isDark = (mode === "dark" || mode === "evening");

    // Clear off-theme ambient particle engines so nothing lingers across theme transitions
    if (mode !== "evening" && (this.leaves.length > 0 || this.gustActive)) {
      this.leaves = [];
      this.gustActive = false;
      this.nextGustTime = 0;
    }
    if (mode !== "morning" && (this.dandelions.length > 0 || this.morningGustActive)) {
      this.dandelions = [];
      this.morningGustActive = false;
      this.nextMorningGustTime = 0;
    }
    if (mode !== "light" && (this.birds.length > 0 || this.nextFlockTime)) {
      this.birds = [];
      this.nextFlockTime = 0;
    }
    if (mode !== "dark" && (this.meteors.length > 0 || this.stars.length > 0 || this.nextMeteorTime)) {
      this.meteors = [];
      this.stars = [];
      this.nextMeteorTime = 0;
    }

    // 1. Theme-adaptive canvas background
    if (mode === "morning") {
      ctx.fillStyle = "#FCF8F5";
    } else if (mode === "evening") {
      ctx.fillStyle = "#1A130E";
    } else if (mode === "dark") {
      ctx.fillStyle = "#08080A";
    } else {
      ctx.fillStyle = "#FBFBFD";
    }
    ctx.fillRect(0, 0, w, h);

    // 2. Periodic Wave Gradient Sweep Position
    const totalSpan = w + h + 800;
    const sweepSpeed = 48;
    const sweepProgress = (this.step * sweepSpeed) % totalSpan;
    const sweepCenter = sweepProgress - 400;

    const sweepWidth = 320;
    const gradAngle = Math.PI / 4;
    const cx = Math.cos(gradAngle) * sweepCenter;
    const cy = Math.sin(gradAngle) * sweepCenter;

    const waveGrad = ctx.createLinearGradient(
      cx - Math.cos(gradAngle) * sweepWidth,
      cy - Math.sin(gradAngle) * sweepWidth,
      cx + Math.cos(gradAngle) * sweepWidth,
      cy + Math.sin(gradAngle) * sweepWidth
    );

    if (mode === "morning") {
      // Sunrise Dawn Golden-Rose Wave Crest
      waveGrad.addColorStop(0, "rgba(252, 248, 245, 0)");
      waveGrad.addColorStop(0.25, "rgba(244, 63, 94, 0.08)");
      waveGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.18)");
      waveGrad.addColorStop(0.75, "rgba(251, 146, 60, 0.10)");
      waveGrad.addColorStop(1, "rgba(252, 248, 245, 0)");
    } else if (mode === "evening") {
      // Golden Hour Sunset Solar Wave Crest (warm amber, honey gold, soft blush)
      waveGrad.addColorStop(0, "rgba(26, 19, 14, 0)");
      waveGrad.addColorStop(0.2, "rgba(251, 113, 133, 0.14)"); // Soft blush
      waveGrad.addColorStop(0.45, "rgba(245, 158, 11, 0.28)"); // Radiant golden amber
      waveGrad.addColorStop(0.7, "rgba(251, 191, 36, 0.24)");  // Honey yellow
      waveGrad.addColorStop(0.88, "rgba(254, 240, 138, 0.15)"); // Saffron gold highlight
      waveGrad.addColorStop(1, "rgba(26, 19, 14, 0)");
    } else if (mode === "dark") {
      // Complementing Dark Aurora Wave Sweep
      waveGrad.addColorStop(0, "rgba(8, 8, 10, 0)");
      waveGrad.addColorStop(0.25, "rgba(79, 70, 229, 0.06)");
      waveGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.15)");
      waveGrad.addColorStop(0.75, "rgba(14, 165, 233, 0.08)");
      waveGrad.addColorStop(1, "rgba(8, 8, 10, 0)");
    } else {
      // Light Mode Subtle Shadow Swell
      waveGrad.addColorStop(0, "rgba(251, 251, 253, 0)");
      waveGrad.addColorStop(0.3, "rgba(15, 23, 42, 0.025)");
      waveGrad.addColorStop(0.5, "rgba(15, 23, 42, 0.07)");
      waveGrad.addColorStop(0.7, "rgba(15, 23, 42, 0.03)");
      waveGrad.addColorStop(1, "rgba(251, 251, 253, 0)");
    }

    ctx.fillStyle = waveGrad;
    ctx.fillRect(0, 0, w, h);

    // 3. Topographical contour ribs seen from an elevated perspective (decluttered on mobile)
    const numRows = w < 720 ? 15 : Math.min(34, Math.max(20, Math.floor(h / 36)));
    const rowSpacing = (h * 1.18) / numRows;
    const startY = -h * 0.08;

    ctx.lineWidth = 1;

    for (let r = 0; r < numRows; r++) {
      const baseY = startY + r * rowSpacing;
      const depthRatio = r / numRows;
      const baseAlpha = isDark ? (0.07 + depthRatio * 0.10) : (0.04 + depthRatio * 0.06);

      ctx.beginPath();
      let first = true;

      for (let x = -60; x <= w + 60; x += 20) {
        const d1 = x * 0.707 + baseY * 0.707;
        const d2 = x * 0.866 - baseY * 0.5;

        const wave1 = Math.sin(d1 * 0.003 - this.step * 1.4) * 22;
        const wave2 = Math.cos(d2 * 0.0022 - this.step * 0.85) * 16;
        const wave3 = Math.sin((x * 0.0038) + this.step * 0.6) * 8;

        let elevation = (wave1 + wave2 + wave3) * (0.65 + depthRatio * 0.75);

        const diagDist = (x + baseY) * 0.707;
        const distFromSweep = Math.abs(diagDist - sweepCenter);

        if (distFromSweep < sweepWidth) {
          const proximity = 1 - (distFromSweep / sweepWidth);
          elevation += Math.sin(proximity * Math.PI) * 38;
        }

        // Subtle topographic contour lift along active activity-ripple wavefronts
        if (this.ripples.length > 0) {
          for (let rp = 0; rp < this.ripples.length; rp++) {
            const rip = this.ripples[rp];
            const distToCenter = Math.hypot(x - rip.x, baseY - rip.y);
            const band = Math.abs(distToCenter - rip.radius);
            if (band < 72) {
              const crest = Math.cos((band / 72) * (Math.PI * 0.5));
              const fade = 1 - (rip.life / rip.maxLife);
              elevation += crest * crest * 18 * rip.strength * fade;
            }
          }
        }

        const y = baseY - elevation;

        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      const rowDiag = baseY * 0.707;
      const rowDistFromSweep = Math.abs(rowDiag - sweepCenter);
      let rowAlpha = baseAlpha;
      if (rowDistFromSweep < sweepWidth) {
        rowAlpha += (1 - rowDistFromSweep / sweepWidth) * (isDark ? 0.35 : 0.16);
      }

      if (mode === "morning") {
        ctx.strokeStyle = `rgba(217, 119, 6, ${Math.min(0.45, rowAlpha).toFixed(3)})`;
      } else if (mode === "evening") {
        ctx.strokeStyle = `rgba(251, 191, 36, ${Math.min(0.52, rowAlpha).toFixed(3)})`;
      } else if (mode === "dark") {
        ctx.strokeStyle = `rgba(224, 231, 255, ${Math.min(0.65, rowAlpha).toFixed(3)})`;
      } else {
        ctx.strokeStyle = `rgba(9, 9, 15, ${Math.min(0.4, rowAlpha).toFixed(3)})`;
      }
      ctx.stroke();
    }

    // 4. Distinct Atmospheric Animation by Solar Theme
    if (mode === "dark") {
      // Night: Aurora Borealis undulating curtains
      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const auroraTime = this.step * 0.7;
      const boostFactor = 1 + this.auroraBoost * 0.65;
      this.auroraBoost = Math.max(0, this.auroraBoost * 0.965 - 0.002);
      const auroraCurtains = [
        { r: 16, g: 185, b: 129, baseH: 260, speed: 0.8, amp: 55, alpha: 0.22 * boostFactor },
        { r: 6, g: 182, b: 212, baseH: 310, speed: 0.6, amp: 45, alpha: 0.18 * boostFactor },
        { r: 139, g: 92, b: 246, baseH: 360, speed: 0.5, amp: 65, alpha: 0.20 * boostFactor },
        { r: 236, g: 72, b: 153, baseH: 220, speed: 0.9, amp: 35, alpha: 0.14 * boostFactor }
      ];

      auroraCurtains.forEach((c, idx) => {
        ctx.beginPath();
        let firstA = true;
        for (let x = -40; x <= w + 40; x += 16) {
          const wave1 = Math.sin(x * 0.0035 + auroraTime * c.speed + idx * 1.4) * c.amp;
          const wave2 = Math.cos(x * 0.0018 - auroraTime * (c.speed * 0.7) + idx * 0.8) * (c.amp * 0.55);
          const wave3 = Math.sin(x * 0.006 + auroraTime * 0.4) * 18;
          const y = c.baseH + wave1 + wave2 + wave3;
          if (firstA) {
            ctx.moveTo(x, y);
            firstA = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineTo(w + 40, 0);
        ctx.lineTo(-40, 0);
        ctx.closePath();

        const aGrad = ctx.createLinearGradient(0, 0, 0, c.baseH + c.amp);
        aGrad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.alpha * 0.65})`);
        aGrad.addColorStop(0.35, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.alpha})`);
        aGrad.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.alpha * 0.4})`);
        aGrad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

        ctx.fillStyle = aGrad;
        ctx.fill();
      });

      ctx.restore();

      // 5. Night Zenith Star Glints & Shooting Stars
      this.updateAndDrawNightMeteors(ctx, w, h);

    } else if (mode === "morning") {
      // Dawn/Sunrise: Radiant rising morning sun rays and warm peach/gold horizon wash
      ctx.save();
      const dawnTime = this.step * 0.35;

      // Atmospheric sunrise glow wash
      const dawnWash = ctx.createLinearGradient(0, 0, 0, 420);
      dawnWash.addColorStop(0, "rgba(254, 215, 170, 0.40)");
      dawnWash.addColorStop(0.35, "rgba(253, 186, 116, 0.22)");
      dawnWash.addColorStop(0.7, "rgba(254, 205, 211, 0.12)");
      dawnWash.addColorStop(1, "rgba(252, 248, 245, 0)");
      ctx.fillStyle = dawnWash;
      ctx.fillRect(0, 0, w, 420);

      // Rising Sun Core Radiance
      const sunX = w * 0.68;
      const sunY = 130 + Math.sin(dawnTime * 0.8) * 8;
      const sunRadius = 260;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, sunRadius);
      sunGrad.addColorStop(0, "rgba(251, 191, 36, 0.42)");
      sunGrad.addColorStop(0.3, "rgba(245, 158, 11, 0.25)");
      sunGrad.addColorStop(0.65, "rgba(244, 63, 94, 0.10)");
      sunGrad.addColorStop(1, "rgba(252, 248, 245, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Soft Morning Dawn Rays Sweeping Diagonally
      ctx.globalCompositeOperation = "screen";
      for (let ray = 0; ray < 5; ray++) {
        const rayAngle = (ray * 0.22) + Math.sin(dawnTime * 0.6 + ray) * 0.05;
        const rx = sunX + Math.cos(rayAngle) * 600;
        const ry = sunY + Math.sin(rayAngle) * 450;
        const rayGrad = ctx.createLinearGradient(sunX, sunY, rx, ry);
        rayGrad.addColorStop(0, "rgba(253, 230, 138, 0.24)");
        rayGrad.addColorStop(0.6, "rgba(251, 146, 60, 0.08)");
        rayGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(rx - 80, ry);
        ctx.lineTo(rx + 80, ry);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // 5. Morning Thermal Updraft: Backlit Dandelion Seeds & Sun Motes
      this.updateAndDrawMorningSeeds(ctx, w, h);

    } else if (mode === "evening") {
      // Golden Hour: Radiant low-sun solar wash, honey ribbons, velvety blue undertones, and blowing leaves
      ctx.save();
      const duskTime = this.step * 0.42;

      // 1. Golden Hour Atmospheric Solar Wash (Warm Amber, Honey Gold, Radiant Yellow, Soft Blush)
      const duskWash = ctx.createLinearGradient(0, 0, 0, 480);
      duskWash.addColorStop(0, "rgba(254, 240, 138, 0.26)");    // Warm honey yellow sky
      duskWash.addColorStop(0.3, "rgba(251, 191, 36, 0.32)");   // Radiant honey gold
      duskWash.addColorStop(0.6, "rgba(245, 158, 11, 0.26)");   // Warm amber
      duskWash.addColorStop(0.85, "rgba(251, 113, 133, 0.18)"); // Soft sunset blush
      duskWash.addColorStop(1, "rgba(26, 19, 14, 0)");          // Deep earth foundation blend
      ctx.fillStyle = duskWash;
      ctx.fillRect(0, 0, w, 480);

      // 2. Velvety blue undertone wash rising from twilight horizon
      const velvetWash = ctx.createLinearGradient(0, h * 0.58, 0, h);
      velvetWash.addColorStop(0, "rgba(15, 23, 42, 0)");
      velvetWash.addColorStop(0.55, "rgba(15, 23, 42, 0.22)");
      velvetWash.addColorStop(1, "rgba(15, 23, 42, 0.48)");     // Deep velvety twilight blue undertone
      ctx.fillStyle = velvetWash;
      ctx.fillRect(0, h * 0.58, w, h * 0.42);

      // 3. Low Golden Sun Radiance
      const sunX = w * 0.32;
      const sunY = 160 + Math.sin(duskTime * 0.6) * 10;
      const sunRadius = 290;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 18, sunX, sunY, sunRadius);
      sunGrad.addColorStop(0, "rgba(254, 240, 138, 0.42)");    // Radiant soft yellow core
      sunGrad.addColorStop(0.3, "rgba(251, 191, 36, 0.28)");   // Honey gold halo
      sunGrad.addColorStop(0.65, "rgba(245, 158, 11, 0.16)");  // Warm amber aura
      sunGrad.addColorStop(0.88, "rgba(251, 113, 133, 0.08)"); // Soft blush rim
      sunGrad.addColorStop(1, "rgba(26, 19, 14, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Undulating Golden Hour Horizon Ribbons (Honey gold, amber, soft blush)
      const ribbonLayers = [
        { y: 120, amp: 26, r: 254, g: 240, b: 138, alpha: 0.28, speed: 0.35 }, // Pale honey yellow
        { y: 175, amp: 32, r: 251, g: 191, b: 36, alpha: 0.26, speed: 0.50 },  // Honey gold
        { y: 240, amp: 38, r: 245, g: 158, b: 11, alpha: 0.22, speed: 0.32 },  // Warm amber
        { y: 310, amp: 30, r: 251, g: 113, b: 133, alpha: 0.18, speed: 0.42 }  // Soft blush ribbon
      ];

      ribbonLayers.forEach((rl, rIdx) => {
        const offset = duskTime * rl.speed * 160;
        ctx.beginPath();
        let firstR = true;
        for (let x = -40; x <= w + 40; x += 18) {
          const sx = x - offset;
          const ry = rl.y + Math.sin(sx * 0.0035 + rIdx * 1.8) * rl.amp + Math.cos(sx * 0.007) * 14;
          if (firstR) {
            ctx.moveTo(x, ry);
            firstR = false;
          } else {
            ctx.lineTo(x, ry);
          }
        }
        ctx.lineTo(w + 40, 0);
        ctx.lineTo(-40, 0);
        ctx.closePath();

        const rGrad = ctx.createLinearGradient(0, 0, 0, rl.y + rl.amp + 45);
        rGrad.addColorStop(0, `rgba(${rl.r}, ${rl.g}, ${rl.b}, ${rl.alpha * 0.85})`);
        rGrad.addColorStop(0.65, `rgba(${rl.r}, ${rl.g}, ${rl.b}, ${rl.alpha * 0.35})`);
        rGrad.addColorStop(1, `rgba(${rl.r}, ${rl.g}, ${rl.b}, 0)`);
        ctx.fillStyle = rGrad;
        ctx.fill();
      });

      // 5. Blowing Leaves Wind-Gust Particle Engine (Golden Hour breeze "every once in a while")
      this.updateAndDrawLeaves(ctx, w, h);

      ctx.restore();

    } else {
      // Daytime: Soft Airy Celestial Sky Wash & Cirrus Clouds
      ctx.save();

      const skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
      skyGrad.addColorStop(0, "rgba(212, 228, 248, 0.55)");
      skyGrad.addColorStop(0.4, "rgba(226, 237, 252, 0.32)");
      skyGrad.addColorStop(0.75, "rgba(242, 247, 253, 0.15)");
      skyGrad.addColorStop(1, "rgba(251, 251, 253, 0)");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, 380);

      const cirrusTime = this.step * 0.22;
      const cirrusLayers = [
        { y: 80, amp: 20, freq: 0.003, alpha: 0.26, speed: 0.25 },
        { y: 135, amp: 26, freq: 0.0022, alpha: 0.20, speed: 0.40 },
        { y: 190, amp: 32, freq: 0.0016, alpha: 0.15, speed: 0.55 }
      ];

      cirrusLayers.forEach((cl, cIdx) => {
        const cOffset = cirrusTime * cl.speed * 180;
        ctx.beginPath();
        let firstCirrus = true;
        for (let x = -40; x <= w + 40; x += 16) {
          const sx = x - cOffset;
          const cy = cl.y + Math.sin(sx * cl.freq + cIdx * 1.5) * cl.amp + Math.cos(sx * cl.freq * 2.1) * (cl.amp * 0.35);
          if (firstCirrus) {
            ctx.moveTo(x, cy);
            firstCirrus = false;
          } else {
            ctx.lineTo(x, cy);
          }
        }
        ctx.lineTo(w + 40, 0);
        ctx.lineTo(-40, 0);
        ctx.closePath();

        const cirrusGrad = ctx.createLinearGradient(0, 0, 0, cl.y + cl.amp + 35);
        cirrusGrad.addColorStop(0, `rgba(255, 255, 255, ${cl.alpha * 1.25})`);
        cirrusGrad.addColorStop(0.55, `rgba(240, 246, 255, ${cl.alpha * 0.7})`);
        cirrusGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = cirrusGrad;
        ctx.fill();
      });

      const cloudTime = this.step * 0.38;
      const cloudLayers = [
        { baseH: 150, speed: 0.32, interval: 320, radius: 100, shadow: "185, 204, 228", body: "255, 255, 255", alpha: 0.44 },
        { baseH: 220, speed: 0.55, interval: 370, radius: 120, shadow: "176, 198, 224", body: "255, 255, 255", alpha: 0.52 },
        { baseH: 290, speed: 0.80, interval: 430, radius: 135, shadow: "168, 192, 218", body: "255, 255, 255", alpha: 0.40 }
      ];

      cloudLayers.forEach((layer, lIdx) => {
        const drift = (cloudTime * layer.speed * 180);
        const span = layer.interval;
        const totalPuffs = Math.ceil(w / span) + 3;

        ctx.beginPath();
        let firstDeck = true;
        for (let x = -60; x <= w + 60; x += 18) {
          const sampleX = x - drift;
          const dy = layer.baseH + Math.sin(sampleX * 0.0032 + lIdx * 1.4) * 24 + Math.cos(sampleX * 0.007) * 12;
          if (firstDeck) {
            ctx.moveTo(x, dy);
            firstDeck = false;
          } else {
            ctx.lineTo(x, dy);
          }
        }
        ctx.lineTo(w + 60, 0);
        ctx.lineTo(-60, 0);
        ctx.closePath();

        const deckGrad = ctx.createLinearGradient(0, 0, 0, layer.baseH + 35);
        deckGrad.addColorStop(0, `rgba(${layer.body}, ${layer.alpha * 0.75})`);
        deckGrad.addColorStop(0.5, `rgba(${layer.shadow}, ${layer.alpha * 0.45})`);
        deckGrad.addColorStop(1, `rgba(${layer.shadow}, 0)`);
        ctx.fillStyle = deckGrad;
        ctx.fill();

        for (let i = -1; i < totalPuffs; i++) {
          const cx = (((i * span + drift) % (w + span * 2)) - span);
          const cy = layer.baseH + Math.sin(cx * 0.0028 + lIdx * 2.1) * 28;
          const r = layer.radius + Math.sin(i * 3.1 + lIdx) * 20;

          const clusterPuffs = [
            { ox: 0, oy: 0, scale: 1.0 },
            { ox: -r * 0.52, oy: r * 0.12, scale: 0.76 },
            { ox: r * 0.52, oy: r * 0.10, scale: 0.80 },
            { ox: -r * 0.24, oy: -r * 0.32, scale: 0.70 },
            { ox: r * 0.26, oy: -r * 0.28, scale: 0.68 }
          ];

          clusterPuffs.forEach((cp) => {
            const px = cx + cp.ox;
            const py = cy + cp.oy;
            const pr = r * cp.scale;

            const shadowGrad = ctx.createRadialGradient(
              px, py + pr * 0.45, pr * 0.05,
              px, py + pr * 0.15, pr
            );
            shadowGrad.addColorStop(0, `rgba(${layer.shadow}, ${layer.alpha * 0.65})`);
            shadowGrad.addColorStop(0.55, `rgba(${layer.shadow}, ${layer.alpha * 0.32})`);
            shadowGrad.addColorStop(1, `rgba(${layer.shadow}, 0)`);

            ctx.beginPath();
            ctx.arc(px, py + pr * 0.2, pr, 0, Math.PI * 2);
            ctx.fillStyle = shadowGrad;
            ctx.fill();

            const sunGrad = ctx.createRadialGradient(
              px - pr * 0.15, py - pr * 0.28, pr * 0.05,
              px, py, pr
            );
            sunGrad.addColorStop(0, `rgba(${layer.body}, ${layer.alpha * 0.95})`);
            sunGrad.addColorStop(0.45, `rgba(${layer.body}, ${layer.alpha * 0.72})`);
            sunGrad.addColorStop(0.8, `rgba(${layer.body}, ${layer.alpha * 0.28})`);
            sunGrad.addColorStop(1, `rgba(${layer.body}, 0)`);

            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fillStyle = sunGrad;
            ctx.fill();
          });
        }
      });

      ctx.restore();

      // 5. Daytime Celestial Wildlife: Soaring Distant Swallow Silhouettes
      this.updateAndDrawDayBirds(ctx, w, h);
    }

    // 5b. Diurnal Nature Task-Complete Atmospheric Phenomena
    this._updateAndDrawNaturePhenomena(ctx, w, h, mode, dt);

    // 6. Activity-Reactive Atmospheric Light Ripples + Dashboard-Scoped Holiday Layer
    this._renderSharedPostDraw(ctx, w, h, mode, dt);
  },

  _renderSharedPostDraw(ctx, w, h, mode, dt) {
    this.updateAndDrawActivityRipples(ctx, w, h, mode);
    if (typeof HolidayThemes !== "undefined" && HolidayThemes.renderDashboardLayer) {
      HolidayThemes.renderDashboardLayer(dt, mode, this.step);
    }
  },

  triggerLeafGust(now, w, h) {
    this.gustActive = true;
    this.gustEndTime = now + 5000 + Math.random() * 2500; // Gust lasts 5 to 7.5 seconds
    this.gustSpawnCount = 0;
    this.maxGustLeaves = 14 + Math.floor(Math.random() * 8); // 14 to 21 leaves
    // Spawn initial burst of 3-5 leaves immediately across different entry points
    const burstCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burstCount; i++) {
      this.spawnLeaf(w, h, true);
    }
  },

  spawnLeaf(w, h, isBurst) {
    // Leaf colors in Golden Hour harmony: honey gold, warm amber, radiant yellow, soft blush, russet
    const leafPalettes = [
      { r: 251, g: 191, b: 36, alpha: 0.85 },  // Honey gold
      { r: 245, g: 158, b: 11, alpha: 0.80 },  // Warm amber
      { r: 254, g: 240, b: 138, alpha: 0.88 }, // Radiant honey yellow
      { r: 251, g: 113, b: 133, alpha: 0.75 }, // Soft sunset blush
      { r: 217, g: 119, b: 6, alpha: 0.78 }    // Deep golden russet
    ];
    const color = leafPalettes[Math.floor(Math.random() * leafPalettes.length)];

    // Start offscreen to the left or top-left
    const startX = isBurst ? (-10 - Math.random() * 60) : (-30 - Math.random() * 120);
    const startY = Math.random() * (h * 0.80) - 20;

    this.leaves.push({
      x: startX,
      y: startY,
      vx: 3.0 + Math.random() * 2.8, // Drifting across screen with gust speed
      vy: 0.4 + Math.random() * 1.4, // Gentle descent
      size: 11 + Math.random() * 10, // 11px - 21px
      aspect: 0.42 + Math.random() * 0.16,
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.42) * 0.05,
      flutter: Math.random() * Math.PI * 2,
      flutterSpeed: 0.045 + Math.random() * 0.055,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.025 + Math.random() * 0.035,
      wobbleAmp: 1.2 + Math.random() * 1.6,
      color: color
    });
    this.gustSpawnCount++;
  },

  updateAndDrawLeaves(ctx, w, h) {
    const now = performance.now();

    // Initialize or schedule gust timing
    if (!this.nextGustTime) {
      // First gust starts quickly (within 1.2s) so the user experiences it without delay
      this.nextGustTime = now + 1200;
    }

    if (!this.gustActive && now >= this.nextGustTime) {
      this.triggerLeafGust(now, w, h);
    } else if (this.gustActive) {
      // Spawn subsequent leaves gradually across the gust
      if (this.gustSpawnCount < this.maxGustLeaves && Math.random() < 0.22) {
        this.spawnLeaf(w, h, false);
      }
      if (now >= this.gustEndTime) {
        this.gustActive = false;
        // Schedule next breeze every 10 to 16 seconds ("every once in a while")
        this.nextGustTime = now + 10000 + Math.random() * 6000;
      }
    }

    if (this.leaves.length === 0) return;

    // Draw and update leaves
    const alive = [];
    for (let i = 0; i < this.leaves.length; i++) {
      const leaf = this.leaves[i];

      // Physics update
      leaf.wobble += leaf.wobbleSpeed;
      leaf.flutter += leaf.flutterSpeed;
      leaf.angle += leaf.rotSpeed;

      leaf.x += leaf.vx + Math.sin(leaf.wobble) * 0.7;
      leaf.y += leaf.vy + Math.cos(leaf.wobble) * leaf.wobbleAmp;

      // Check bounds
      if (leaf.x > w + 60 || leaf.y > h + 60) {
        continue; // Leaf blown offscreen
      }
      alive.push(leaf);

      // Render stylized fluttering leaf with 3D flip effect
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.angle);

      // 3D flip tumble factor
      const flip = Math.cos(leaf.flutter);
      ctx.scale(flip, 1);

      const hl = leaf.size;
      const hw = leaf.size * leaf.aspect;

      // Leaf body
      ctx.beginPath();
      ctx.moveTo(0, -hl);
      ctx.bezierCurveTo(hw * 1.35, -hl * 0.35, hw * 1.25, hl * 0.45, 0, hl);
      ctx.bezierCurveTo(-hw * 1.25, hl * 0.45, -hw * 1.35, -hl * 0.35, 0, -hl);
      ctx.closePath();

      const alpha = leaf.color.alpha * (0.35 + 0.65 * Math.abs(flip));
      ctx.fillStyle = `rgba(${leaf.color.r}, ${leaf.color.g}, ${leaf.color.b}, ${alpha.toFixed(3)})`;
      ctx.fill();

      // Subtle leaf spine/vein
      ctx.beginPath();
      ctx.moveTo(0, -hl * 0.85);
      ctx.lineTo(0, hl * 0.80);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.28 * Math.abs(flip)).toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }
    this.leaves = alive;
  },

  // --- MORNING THEME: Backlit Dandelion Seeds & Warm Sun Motes ---
  triggerMorningThermal(now, w, h) {
    this.morningGustActive = true;
    this.morningGustEndTime = now + 5200 + Math.random() * 2400;
    this.morningSpawnCount = 0;
    this.maxMorningSeeds = 12 + Math.floor(Math.random() * 6);
    const burst = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < burst; i++) {
      this.spawnMorningSeed(w, h, true);
    }
  },

  spawnMorningSeed(w, h, isBurst) {
    const isMote = Math.random() < 0.35;
    this.dandelions.push({
      isMote,
      x: isBurst ? (-10 + Math.random() * (w * 0.35)) : (-25 - Math.random() * 80),
      y: h * (0.28 + Math.random() * 0.56),
      vx: isMote ? (0.8 + Math.random() * 1.1) : (1.25 + Math.random() * 1.45),
      vy: -(0.22 + Math.random() * 0.52), // Rising on warm sunrise thermal updrafts
      size: isMote ? (1.8 + Math.random() * 2.2) : (6.5 + Math.random() * 4.5),
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.025,
      tilt: (Math.random() - 0.5) * 0.45,
      alpha: isMote ? (0.42 + Math.random() * 0.30) : (0.58 + Math.random() * 0.25)
    });
    this.morningSpawnCount++;
  },

  updateAndDrawMorningSeeds(ctx, w, h) {
    const now = performance.now();
    if (!this.nextMorningGustTime) {
      this.nextMorningGustTime = now + 1300;
    }
    if (!this.morningGustActive && now >= this.nextMorningGustTime) {
      this.triggerMorningThermal(now, w, h);
    } else if (this.morningGustActive) {
      if (this.morningSpawnCount < this.maxMorningSeeds && Math.random() < 0.18) {
        this.spawnMorningSeed(w, h, false);
      }
      if (now >= this.morningGustEndTime) {
        this.morningGustActive = false;
        this.nextMorningGustTime = now + 10000 + Math.random() * 6000;
      }
    }

    if (this.dandelions.length === 0) return;

    const alive = [];
    for (let i = 0; i < this.dandelions.length; i++) {
      const p = this.dandelions[i];
      p.sway += p.swaySpeed;
      p.x += p.vx + Math.sin(p.sway * 0.8) * 0.35;
      p.y += p.vy + Math.cos(p.sway) * 0.35;

      if (p.x > w + 50 || p.y < -50) continue;
      alive.push(p);

      ctx.save();
      ctx.translate(p.x, p.y);
      const pulse = 0.78 + 0.22 * Math.sin(p.sway * 1.4);

      if (p.isMote) {
        // Warm luminous pollen / dew mote
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2.4);
        g.addColorStop(0, `rgba(251, 191, 36, ${(p.alpha * pulse).toFixed(3)})`);
        g.addColorStop(0.5, `rgba(244, 63, 94, ${(p.alpha * 0.35 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Feathered dandelion seed parachute catching sunrise light
        ctx.rotate(p.tilt + Math.sin(p.sway) * 0.16);
        const s = p.size;
        const a = p.alpha * pulse;

        // Soft sunlit glow halo around pappus head
        const halo = ctx.createRadialGradient(0, -s * 0.75, 1, 0, -s * 0.75, s * 1.15);
        halo.addColorStop(0, `rgba(254, 243, 199, ${(a * 0.55).toFixed(3)})`);
        halo.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, -s * 0.75, s * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // Stalk & amber seed achene
        ctx.strokeStyle = `rgba(180, 83, 9, ${(a * 0.65).toFixed(3)})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.55);
        ctx.lineTo(0, -s * 0.55);
        ctx.stroke();

        ctx.fillStyle = `rgba(217, 119, 6, ${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(0, s * 0.65, 1.3, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gossamer pappus silk filaments fanned at crown
        ctx.strokeStyle = `rgba(245, 158, 11, ${(a * 0.72).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        const rays = [-0.85, -0.45, 0, 0.45, 0.85];
        rays.forEach((ang) => {
          const rx = Math.sin(ang) * (s * 0.85);
          const ry = -s * 0.55 - Math.cos(ang) * (s * 0.45);
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.55);
          ctx.lineTo(rx, ry);
          ctx.stroke();
        });
      }
      ctx.restore();
    }
    this.dandelions = alive;
  },

  // --- LIGHT / AFTERNOON THEME: Soaring Swallow Flock Across Cloud Sky ---
  spawnDayFlock(w, h) {
    const fromLeft = Math.random() < 0.7;
    const count = 4 + Math.floor(Math.random() * 4);
    const baseY = 55 + Math.random() * Math.min(210, h * 0.28);
    const baseSpeed = 1.6 + Math.random() * 0.9;

    for (let i = 0; i < count; i++) {
      const depth = 0.65 + Math.random() * 0.55; // Depth scaling (size & speed)
      const lag = i * (26 + Math.random() * 20);
      this.birds.push({
        dir: fromLeft ? 1 : -1,
        x: fromLeft ? (-35 - lag) : (w + 35 + lag),
        y: baseY + (i - count / 2) * (14 + Math.random() * 10) + (Math.random() - 0.5) * 18,
        vx: (fromLeft ? 1 : -1) * baseSpeed * (0.85 + depth * 0.35),
        vy: (Math.random() - 0.52) * 0.25,
        span: (9 + Math.random() * 5) * depth,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 0.14 + Math.random() * 0.06,
        glideClock: Math.random() * 180,
        alpha: 0.22 + depth * 0.18
      });
    }
  },

  updateAndDrawDayBirds(ctx, w, h) {
    const now = performance.now();
    if (!this.nextFlockTime) {
      this.nextFlockTime = now + 1500;
    }
    if (now >= this.nextFlockTime) {
      this.spawnDayFlock(w, h);
      this.nextFlockTime = now + 11500 + Math.random() * 7000;
    }

    if (this.birds.length === 0) return;

    const alive = [];
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.glideClock += 1;
      // Alternating 4-beat wing flaps and smooth motionless soar glides
      const isGliding = (b.glideClock % 150) > 65;
      if (!isGliding) {
        b.flapPhase += b.flapSpeed;
      } else {
        b.flapPhase += (0.35 - Math.sin(b.flapPhase)) * 0.08;
      }

      b.x += b.vx;
      b.y += b.vy + Math.sin(b.glideClock * 0.03) * 0.18;

      if ((b.dir > 0 && b.x > w + 60) || (b.dir < 0 && b.x < -60)) continue;
      alive.push(b);

      const wingLift = Math.sin(b.flapPhase) * b.span * 0.52;
      const halfSpan = b.span;

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.strokeStyle = `rgba(51, 65, 85, ${b.alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.1, b.span * 0.12);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Graceful dual-arc swallow silhouette
      ctx.beginPath();
      ctx.moveTo(-halfSpan, -wingLift * 0.85);
      ctx.quadraticCurveTo(-halfSpan * 0.45, -wingLift * 1.15 - 2, 0, 0);
      ctx.quadraticCurveTo(halfSpan * 0.45, -wingLift * 1.15 - 2, halfSpan, -wingLift * 0.85);
      ctx.stroke();
      ctx.restore();
    }
    this.birds = alive;
  },

  // --- DARK / NIGHT THEME: Zenith Star Glints & Aurora Shooting Stars ---
  initNightStars(w, h) {
    this.stars = [];
    const starCount = 32;
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * Math.min(380, h * 0.55),
        r: 0.7 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.035,
        tint: Math.random() < 0.35 ? "165, 243, 252" : (Math.random() < 0.5 ? "167, 243, 208" : "226, 232, 240")
      });
    }
  },

  spawnMeteor(w, h, customColor = null) {
    const startX = w * (0.15 + Math.random() * 0.70);
    const startY = 15 + Math.random() * Math.min(180, h * 0.24);
    const dir = startX > w * 0.5 ? -1 : 1;
    const angle = dir > 0 ? (0.34 + Math.random() * 0.24) : (Math.PI - 0.34 - Math.random() * 0.24);
    const speed = 9.5 + Math.random() * 5.0;
    const isEmerald = Math.random() < 0.45;
    this.meteors.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      len: 75 + Math.random() * 65,
      life: 0,
      maxLife: 38 + Math.floor(Math.random() * 20),
      color: customColor || (isEmerald ? "110, 231, 183" : "125, 211, 252")
    });
  },

  updateAndDrawNightMeteors(ctx, w, h) {
    if (this.stars.length === 0) {
      this.initNightStars(w, h);
    }

    // Subtle twinkling high-altitude stars
    ctx.save();
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.phase += s.speed;
      const alpha = 0.14 + 0.38 * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.fillStyle = `rgba(${s.tint}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Periodic shooting stars (every 6 to 11.5 seconds)
    const now = performance.now();
    if (!this.nextMeteorTime) {
      this.nextMeteorTime = now + 1200;
    }
    if (now >= this.nextMeteorTime) {
      this.spawnMeteor(w, h);
      if (Math.random() < 0.35) {
        // Occasional paired meteor streak shortly offset
        setTimeout(() => {
          if (this.getThemeMode() === "dark") this.spawnMeteor(this.width, this.height);
        }, 320);
      }
      this.nextMeteorTime = now + 6000 + Math.random() * 5500;
    }

    if (this.meteors.length > 0) {
      const alive = [];
      for (let i = 0; i < this.meteors.length; i++) {
        const m = this.meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        if (m.life >= m.maxLife) continue;
        alive.push(m);

        const progress = m.life / m.maxLife;
        const fade = progress < 0.18 ? (progress / 0.18) : (1 - (progress - 0.18) / 0.82);
        const speedMag = Math.hypot(m.vx, m.vy) || 1;
        const tailX = m.x - (m.vx / speedMag) * m.len * Math.min(1, progress * 3.5);
        const tailY = m.y - (m.vy / speedMag) * m.len * Math.min(1, progress * 3.5);

        const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        grad.addColorStop(0, `rgba(${m.color}, 0)`);
        grad.addColorStop(0.65, `rgba(${m.color}, ${(fade * 0.45).toFixed(3)})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${(fade * 0.95).toFixed(3)})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // Luminous meteor head glint
        const headGlow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 6);
        headGlow.addColorStop(0, `rgba(255, 255, 255, ${(fade * 0.95).toFixed(3)})`);
        headGlow.addColorStop(0.5, `rgba(${m.color}, ${(fade * 0.45).toFixed(3)})`);
        headGlow.addColorStop(1, `rgba(${m.color}, 0)`);
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      this.meteors = alive;
    }
    ctx.restore();
  },

  // --- v11.2 Activity-Reactive Background Canvas ---
  _parseActivityColor(colorStr, mode) {
    const defaults = {
      dark: "125, 211, 252",
      evening: "251, 191, 36",
      morning: "245, 158, 11",
      light: "59, 130, 246"
    };
    if (!colorStr || typeof colorStr !== "string") return defaults[mode] || defaults.light;
    const s = colorStr.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
      let hex = s.slice(1);
      if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
      let r = parseInt(hex.slice(0, 2), 16);
      let g = parseInt(hex.slice(2, 4), 16);
      let b = parseInt(hex.slice(4, 6), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if ((mode === "dark" || mode === "evening") && lum < 0.28) {
        return defaults[mode] || "165, 243, 252";
      }
      if ((mode === "light" || mode === "morning") && lum > 0.88) {
        return defaults[mode] || "59, 130, 246";
      }
      return `${r}, ${g}, ${b}`;
    }
    return defaults[mode] || defaults.light;
  },

  pulseActivity({ kind = "complete", x = null, y = null, color = null } = {}) {
    const w = this.width || window.innerWidth;
    const h = this.height || window.innerHeight;
    const mode = this.getThemeMode();
    const rx = (typeof x === "number" && isFinite(x)) ? x : w * 0.5;
    const ry = (typeof y === "number" && isFinite(y)) ? y : h * 0.34;
    const rgb = this._parseActivityColor(color, mode);
    const isMajor = (kind === "queue_clear" || kind === "finalise");

    // 1. Expanding atmospheric light & topographic contour ripple
    this.ripples.push({
      x: rx,
      y: ry,
      radius: 18,
      maxRadius: isMajor ? Math.max(w, h) * 0.65 : Math.min(w, h) * 0.48,
      life: 0,
      maxLife: isMajor ? 78 : 54,
      color: rgb,
      strength: isMajor ? 1.35 : 0.9
    });
    if (this.ripples.length > 6) {
      this.ripples.shift();
    }

    const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reducedMotion) return;

    const world = this.getWorldMode();
    if (world === "gateway" && typeof WorldGateway !== "undefined") {
      WorldGateway.pulseActivity({ kind, x: rx, y: ry, color });
      return;
    }
    if (world === "deep-blue" && typeof WorldDeepBlue !== "undefined") {
      WorldDeepBlue.pulseActivity({ kind, x: rx, y: ry, color });
      return;
    }

    // 1b. Streamlined Diurnal Thermal Bird Flock (6 Randomised Bird Species)
    if (kind === "complete" || isMajor) {
      this.spawnNaturePhenomenon(w, h, { mode });
    }

    // 2. Theme-authentic reactive atmospheric phenomenon (Nature)
    if (mode === "dark") {
      this.auroraBoost = Math.min(1.4, this.auroraBoost + (isMajor ? 0.95 : 0.55));
      const meteorCount = kind === "queue_clear" ? 3 : (kind === "finalise" ? 2 : 1);
      for (let i = 0; i < meteorCount; i++) {
        setTimeout(() => {
          if (this.getThemeMode() === "dark") {
            this.spawnMeteor(this.width || w, this.height || h, rgb);
          }
        }, i * 190);
      }
    } else if (mode === "morning") {
      const seedCount = isMajor ? 10 : 5;
      for (let i = 0; i < seedCount; i++) {
        this.dandelions.push({
          isMote: i % 2 === 0,
          x: Math.max(10, Math.min(w - 10, rx + (Math.random() - 0.5) * 140)),
          y: Math.max(30, Math.min(h - 20, ry + (Math.random() - 0.5) * 90)),
          vx: 0.9 + Math.random() * 1.5,
          vy: -(0.45 + Math.random() * 0.75),
          size: (i % 2 === 0) ? (2.2 + Math.random() * 2.4) : (6.5 + Math.random() * 4.5),
          sway: Math.random() * Math.PI * 2,
          swaySpeed: 0.025 + Math.random() * 0.025,
          tilt: (Math.random() - 0.5) * 0.45,
          alpha: 0.62 + Math.random() * 0.25
        });
      }
    } else if (mode === "evening") {
      const leafCount = isMajor ? 10 : 5;
      for (let i = 0; i < leafCount; i++) {
        this.spawnLeaf(w, h, true);
      }
    } else {
      // Light / Afternoon: dispatch soaring swallows gliding across the cloud deck
      const birdCount = isMajor ? 6 : 3;
      const fromLeft = rx < w * 0.6;
      const baseY = Math.max(55, Math.min(h * 0.34, ry * 0.65));
      const baseSpeed = 2.0 + Math.random() * 0.9;
      for (let i = 0; i < birdCount; i++) {
        const depth = 0.72 + Math.random() * 0.45;
        const lag = i * (22 + Math.random() * 16);
        this.birds.push({
          dir: fromLeft ? 1 : -1,
          x: fromLeft ? (-25 - lag) : (w + 25 + lag),
          y: baseY + (i - birdCount / 2) * 14 + (Math.random() - 0.5) * 14,
          vx: (fromLeft ? 1 : -1) * baseSpeed * (0.9 + depth * 0.35),
          vy: (Math.random() - 0.55) * 0.28,
          span: (9.5 + Math.random() * 4.5) * depth,
          flapPhase: Math.random() * Math.PI * 2,
          flapSpeed: 0.16 + Math.random() * 0.05,
          glideClock: Math.random() * 140,
          alpha: 0.28 + depth * 0.18
        });
      }
    }
  },

  updateAndDrawActivityRipples(ctx, w, h, mode) {
    if (!this.ripples || this.ripples.length === 0) return;
    const isDark = (mode === "dark" || mode === "evening");
    const alive = [];

    ctx.save();
    if (isDark) ctx.globalCompositeOperation = "screen";

    for (let i = 0; i < this.ripples.length; i++) {
      const rp = this.ripples[i];
      rp.life++;
      if (rp.life >= rp.maxLife) continue;
      alive.push(rp);

      const t = rp.life / rp.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);
      rp.radius = 18 + (rp.maxRadius - 18) * eased;
      const fade = Math.sin(Math.min(1, t * 4.5) * (Math.PI * 0.5)) * Math.pow(1 - t, 1.35);

      const outerR = rp.radius;
      const innerR = Math.max(0, outerR - 68);
      const grad = ctx.createRadialGradient(rp.x, rp.y, innerR, rp.x, rp.y, outerR + 18);
      const peakAlpha = (isDark ? 0.24 : 0.16) * fade * rp.strength;
      grad.addColorStop(0, `rgba(${rp.color}, 0)`);
      grad.addColorStop(0.68, `rgba(${rp.color}, ${(peakAlpha * 0.65).toFixed(3)})`);
      grad.addColorStop(0.86, `rgba(${rp.color}, ${peakAlpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${rp.color}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, outerR + 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    this.ripples = alive;
  },

  _smooth5(t) {
    const c = t < 0 ? 0 : (t > 1 ? 1 : t);
    return c * c * c * (c * (c * 6 - 15) + 10);
  },

  spawnThermalFlock(w, h, opts = {}) {
    return this.spawnNaturePhenomenon(w, h, opts);
  },

  spawnNaturePhenomenon(w, h, opts = {}) {
    if (!w || !h) return;
    if (this.naturePhenomena.length >= 2) {
      this.naturePhenomena.shift();
    }
    const isNarrow = w < 720;
    const pool = this.NATURE_BIRD_SPECIES.filter(s => s !== this._lastBirdSpecies);
    const species = (opts.species && this.NATURE_BIRD_SPECIES.includes(opts.species))
      ? opts.species
      : (pool[Math.floor(Math.random() * pool.length)] || "crane");
    this._lastBirdSpecies = species;
    this._lastNaturePhenomenon = "thermal_flock";

    const mode = opts.mode || this.getThemeMode();
    const dir = Math.random() < 0.62 ? 1 : -1;
    const baseY = h * (0.28 + Math.random() * 0.14);
    const scaleBias = isNarrow ? 0.76 : 1.0;

    const specs = {
      swallow: {
        count: isNarrow ? 9 : 13, baseSize: 15.5, duration: 7.4, flapSpeed: 7.8,
        glideBias: 0.42, vSpreadX: 30, vSpreadY: 16, formation: "echelon"
      },
      crane: {
        count: isNarrow ? 7 : 11, baseSize: 22.0, duration: 8.8, flapSpeed: 4.1,
        glideBias: 0.25, vSpreadX: 44, vSpreadY: 22, formation: "v_form"
      },
      falcon: {
        count: isNarrow ? 6 : 9, baseSize: 18.0, duration: 6.8, flapSpeed: 6.6,
        glideBias: 0.68, vSpreadX: 36, vSpreadY: 18, formation: "echelon"
      },
      heron: {
        count: isNarrow ? 5 : 8, baseSize: 24.0, duration: 9.2, flapSpeed: 3.3,
        glideBias: 0.18, vSpreadX: 46, vSpreadY: 20, formation: "stagger"
      },
      albatross: {
        count: isNarrow ? 4 : 7, baseSize: 23.0, duration: 9.4, flapSpeed: 2.6,
        glideBias: 0.90, vSpreadX: 52, vSpreadY: 26, formation: "soar"
      },
      starling: {
        count: isNarrow ? 12 : 22, baseSize: 11.2, duration: 7.8, flapSpeed: 9.4,
        glideBias: 0.20, vSpreadX: 18, vSpreadY: 16, formation: "murmuration"
      }
    };
    const cfg = specs[species] || specs.crane;

    const birds = Array.from({ length: cfg.count }, (_, idx) => {
      const layer = idx % 3;
      const depth = 0.58 + layer * 0.23;
      const arm = idx % 2 === 0 ? -1 : 1;
      const rank = Math.ceil(idx / 2);
      let offX = 0;
      let offY = 0;
      if (cfg.formation === "v_form") {
        offX = -dir * rank * cfg.vSpreadX * (isNarrow ? 0.68 : 1);
        offY = arm * rank * cfg.vSpreadY * (isNarrow ? 0.72 : 1);
      } else if (cfg.formation === "echelon") {
        offX = -dir * idx * (cfg.vSpreadX * 0.76) * (isNarrow ? 0.68 : 1);
        offY = (idx * 13 - cfg.count * 5.5) * (isNarrow ? 0.75 : 1);
      } else if (cfg.formation === "stagger") {
        offX = -dir * idx * (cfg.vSpreadX * 0.85) * (isNarrow ? 0.65 : 1);
        offY = arm * (10 + rank * 14) * (isNarrow ? 0.70 : 1);
      } else if (cfg.formation === "soar") {
        offX = -dir * rank * cfg.vSpreadX * (isNarrow ? 0.72 : 1) + (Math.random() - 0.5) * 26;
        offY = arm * (18 + rank * 24) * (isNarrow ? 0.72 : 1);
      } else {
        // Murmuration cluster
        const col = idx % 6;
        const row = Math.floor(idx / 6);
        offX = -dir * (col - 2.5) * (cfg.vSpreadX * 1.45) + (Math.random() - 0.5) * 18;
        offY = (row - 1.5) * (cfg.vSpreadY * 1.65) + (Math.random() - 0.5) * 20;
      }

      return {
        idx,
        depth,
        size: cfg.baseSize * scaleBias * depth,
        offX,
        offY,
        flapPhase: idx * (species === "starling" ? 0.48 : 0.72) + Math.random() * 0.6,
        flapSpeed: cfg.flapSpeed * (0.92 + Math.random() * 0.16),
        gliderBias: cfg.glideBias,
        indivPhase: Math.random() * Math.PI * 2,
        murmFreq: 2.2 + (idx % 5) * 0.45
      };
    });

    this.naturePhenomena.push({
      type: "thermal_flock",
      species,
      dir,
      elapsed: 0,
      duration: cfg.duration,
      centerY: baseY,
      wavePhase: Math.random() * Math.PI * 2,
      w,
      h,
      mode,
      birds
    });
  },

  _getFlockSpeciesPalette(species, mode) {
    // Rich diurnal-aware tones while preserving iconic biological plumage accents
    const base = {
      dorsal: "#1E293B",
      ventral: "#E2E8F0",
      accent: "#38BDF8",
      tip: "#0F172A",
      rim: "rgba(255, 255, 255, 0.72)",
      ribbon: "148, 163, 184",
      crest: "#EF4444"
    };
    if (species === "swallow") {
      base.dorsal = "#1E3A5F";
      base.ventral = "#F8FAFC";
      base.accent = "#C2410C";
      base.tip = "#0F172A";
    } else if (species === "crane") {
      base.dorsal = "#DCE4EC";
      base.ventral = "#FFFFFF";
      base.accent = "#475569";
      base.tip = "#1E293B";
      base.crest = "#DC2626";
    } else if (species === "falcon") {
      base.dorsal = "#334155";
      base.ventral = "#F1E6D6";
      base.accent = "#94A3B8";
      base.tip = "#0F172A";
    } else if (species === "heron") {
      base.dorsal = "#64748B";
      base.ventral = "#CBD5E1";
      base.accent = "#334155";
      base.tip = "#1E293B";
    } else if (species === "albatross") {
      base.dorsal = "#2B3A4D";
      base.ventral = "#FFFFFF";
      base.accent = "#F8FAFC";
      base.tip = "#0F172A";
    } else {
      base.dorsal = "#1F2430";
      base.ventral = "#475569";
      base.accent = "#6366F1";
      base.tip = "#090D16";
    }

    if (mode === "morning") {
      base.rim = "rgba(254, 215, 170, 0.88)";
      base.ribbon = "251, 191, 36";
      if (species !== "crane" && species !== "albatross") {
        base.dorsal = "#4E2A38";
      }
    } else if (mode === "evening") {
      base.rim = "rgba(253, 224, 102, 0.92)";
      base.ribbon = "245, 158, 11";
      if (species === "crane" || species === "albatross") {
        base.ventral = "#FDE6C4";
      } else {
        base.dorsal = "#2E1C1A";
      }
    } else if (mode === "dark") {
      base.rim = "rgba(186, 230, 253, 0.92)";
      base.ribbon = "125, 211, 252";
      if (species !== "crane" && species !== "albatross") {
        base.dorsal = "#334155";
        base.ventral = "#94A3B8";
      } else {
        base.dorsal = "#94A3B8";
        base.ventral = "#E2E8F0";
      }
    }
    return base;
  },

  _drawThermalFlock(ctx, w, h, p, ph, mode) {
    const dir = ph.dir;
    const species = ph.species || "crane";
    const pal = this._getFlockSpeciesPalette(species, mode);
    const isNarrow = w < 720;

    // C2 smooth enter & exit fading + thermal glide arc
    const fadeIn = this._smooth5(Math.min(1, p / 0.12));
    const fadeOut = this._smooth5(Math.min(1, (1 - p) / 0.14));
    const env = fadeIn * fadeOut;
    if (env <= 0.01) return;

    const evalFlockCenter = (u) => {
      const x = dir > 0 ? (-150 + u * (w + 300)) : (w + 150 - u * (w + 300));
      const arcLift = Math.sin(u * Math.PI) * (-h * (isNarrow ? 0.085 : 0.115));
      const waveAmp = species === "albatross" ? h * 0.052 : (species === "falcon" ? h * 0.042 : h * 0.026);
      const y = ph.centerY + arcLift + Math.sin(u * Math.PI * 2.2 + ph.wavePhase) * waveAmp;
      return { x, y };
    };

    const cNow = evalFlockCenter(p);
    const cNext = evalFlockCenter(Math.min(1, p + 0.004));
    const cPrev = evalFlockCenter(Math.max(0, p - 0.004));
    const tanX = cNext.x - cPrev.x;
    const tanY = cNext.y - cPrev.y;
    const baseFlightAngle = Math.atan2(tanY, tanX);

    // Mid-crossing dynamic banking/swoop curve via C2 smooth5
    const pivotT = (p > 0.30 && p < 0.72)
      ? Math.sin(this._smooth5((p - 0.30) / 0.42) * Math.PI)
      : 0;
    const falconStoop = (species === "falcon" && p > 0.36 && p < 0.66)
      ? Math.sin(this._smooth5((p - 0.36) / 0.30) * Math.PI)
      : 0;

    // Subtle rising thermal updraft silk streamlines beneath flock
    for (let s = 0; s < 3; s++) {
      const sx0 = cNow.x - dir * (175 - s * 50);
      const sy0 = cNow.y + 42 + s * 18;
      ctx.save();
      ctx.strokeStyle = `rgba(${pal.ribbon}, ${(env * (0.14 - s * 0.032)).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.9, (2.1 - s * 0.38) * (isNarrow ? 0.8 : 1));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.bezierCurveTo(
        sx0 + dir * 75, sy0 - 18,
        sx0 + dir * 155, sy0 - 44 - pivotT * 24,
        sx0 + dir * 245, sy0 - 52 - pivotT * 18
      );
      ctx.stroke();
      ctx.restore();
    }

    // Depth-sorted rendering (far -> near) with 2-segment articulated wings & detailed anatomical markings
    const sorted = ph.birds.slice().sort((a, b) => a.depth - b.depth);
    sorted.forEach((b) => {
      let mx = 0;
      let my = Math.sin(ph.elapsed * 0.9 + b.indivPhase) * 4.5 * b.depth;
      if (species === "starling") {
        mx = Math.sin(p * Math.PI * b.murmFreq + b.indivPhase) * (isNarrow ? 26 : 46);
        my = Math.cos(p * Math.PI * (b.murmFreq * 0.85) + b.indivPhase) * (isNarrow ? 22 : 38);
      }

      const bx = cNow.x + b.offX * (1 - pivotT * 0.22) + mx;
      const by = cNow.y + b.offY + my - pivotT * 24 * b.depth + falconStoop * 36 * b.depth;
      const glideFactor = 1 - Math.max(pivotT * b.gliderBias, falconStoop * 0.92);
      const wingPhase = b.flapPhase + ph.elapsed * b.flapSpeed;
      const flapInner = Math.sin(wingPhase) * glideFactor;
      const flapOuter = Math.sin(wingPhase - 0.56) * glideFactor; // Realistic wrist-to-primary feather phase lag!

      const sz = b.size;
      const pitchShift = falconStoop * 0.24 - pivotT * 0.14;
      const facingAngle = (dir > 0 ? baseFlightAngle : (Math.PI - baseFlightAngle)) + pitchShift;

      ctx.save();
      ctx.globalAlpha = env * (0.56 + b.depth * 0.42);
      ctx.translate(bx, by);
      if (dir < 0) ctx.scale(-1, 1);
      ctx.rotate(dir > 0 ? facingAngle : (baseFlightAngle - Math.PI) * -1 - pitchShift);

      // Subtle trailing wingtip thermal vortex whisper (desktop near-layer birds)
      if (!isNarrow && b.depth > 0.78 && (species === "albatross" || species === "crane" || species === "falcon")) {
        ctx.strokeStyle = `rgba(${pal.ribbon}, ${(env * 0.16).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.9, -sz * (0.45 * flapOuter + 0.1));
        ctx.quadraticCurveTo(-sz * 1.6, -sz * 0.12, -sz * 2.1, -sz * 0.04);
        ctx.stroke();
      }

      const spanMult = species === "albatross" ? 1.48 : (species === "crane" || species === "heron" ? 1.24 : (species === "falcon" ? 1.12 : 1.0));
      const tucked = species === "falcon" ? (1 - falconStoop * 0.55) : 1;
      const farElbX = -sz * 0.16 * tucked;
      const farElbY = -sz * (0.28 * flapInner + 0.22);
      const farTipX = -sz * (0.78 * spanMult) * tucked;
      const farTipY = farElbY - sz * (0.20 * flapOuter + 0.06);

      const nearElbX = -sz * 0.12 * tucked;
      const nearElbY = -sz * (0.42 * flapInner + 0.16);
      const nearTipX = -sz * (0.94 * spanMult) * tucked;
      const nearTipY = nearElbY - sz * (0.34 * flapOuter + 0.08);

      // 1. Far Articulated Wing (shaded interior depth)
      ctx.fillStyle = pal.tip;
      ctx.beginPath();
      ctx.moveTo(sz * 0.14, -sz * 0.04);
      ctx.quadraticCurveTo(sz * 0.02, farElbY * 0.72, farElbX, farElbY);
      ctx.lineTo(farTipX, farTipY);
      ctx.quadraticCurveTo(farElbX * 0.9, farElbY * 0.42, -sz * 0.12, sz * 0.02);
      ctx.closePath();
      ctx.fill();

      // 2. Anatomical Body, Neck/Head & Tail per Bird Species
      ctx.fillStyle = pal.dorsal;
      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = Math.max(0.65, 0.95 * b.depth);

      if (species === "crane") {
        // Long extended crane neck, delicate pointed bill & long trailing legs!
        ctx.beginPath();
        ctx.moveTo(sz * 0.98, -sz * 0.03); // Sharp bill tip
        ctx.lineTo(sz * 0.76, -sz * 0.08);
        ctx.quadraticCurveTo(sz * 0.42, -sz * 0.11, sz * 0.24, -sz * 0.13);
        ctx.quadraticCurveTo(0, -sz * 0.15, -sz * 0.34, -sz * 0.06);
        ctx.lineTo(-sz * 0.48, -sz * 0.09);
        ctx.lineTo(-sz * 0.42, sz * 0.08);
        ctx.quadraticCurveTo(0, sz * 0.14, sz * 0.26, sz * 0.06);
        ctx.quadraticCurveTo(sz * 0.56, -sz * 0.02, sz * 0.76, -sz * 0.03);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Trailing crane legs
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = Math.max(0.7, 0.9 * b.depth);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.28, sz * 0.05);
        ctx.lineTo(-sz * 0.84, sz * 0.12);
        ctx.moveTo(-sz * 0.28, sz * 0.08);
        ctx.lineTo(-sz * 0.80, sz * 0.18);
        ctx.stroke();

        // Characteristic ruby crane crown spot
        ctx.fillStyle = pal.crest;
        ctx.beginPath();
        ctx.arc(sz * 0.76, -sz * 0.065, Math.max(0.8, sz * 0.034), 0, Math.PI * 2);
        ctx.fill();
      } else if (species === "heron") {
        // S-curved retracted heron neck + long dagger bill + trailing stilts!
        ctx.beginPath();
        ctx.moveTo(sz * 0.64, -sz * 0.08); // Bill tip
        ctx.lineTo(sz * 0.36, -sz * 0.14);
        ctx.bezierCurveTo(sz * 0.14, -sz * 0.02, sz * 0.30, -sz * 0.20, sz * 0.04, -sz * 0.16);
        ctx.quadraticCurveTo(-sz * 0.20, -sz * 0.14, -sz * 0.42, -sz * 0.04);
        ctx.lineTo(-sz * 0.46, sz * 0.08);
        ctx.quadraticCurveTo(0, sz * 0.16, sz * 0.26, sz * 0.04);
        ctx.quadraticCurveTo(sz * 0.34, -sz * 0.04, sz * 0.64, -sz * 0.08);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = Math.max(0.75, 0.95 * b.depth);
        ctx.beginPath();
        ctx.moveTo(-sz * 0.30, sz * 0.04);
        ctx.lineTo(-sz * 0.88, sz * 0.10);
        ctx.stroke();
      } else if (species === "swallow") {
        // Glossy dorsal torso + deeply forked swallow streamers + warm chestnut throat!
        ctx.beginPath();
        ctx.moveTo(sz * 0.48, -sz * 0.01);
        ctx.quadraticCurveTo(sz * 0.18, -sz * 0.15, -sz * 0.26, -sz * 0.05);
        ctx.lineTo(-sz * 0.78, -sz * 0.21); // Long upper fork streamer
        ctx.lineTo(-sz * 0.46, 0);
        ctx.lineTo(-sz * 0.78, sz * 0.20);  // Long lower fork streamer
        ctx.lineTo(-sz * 0.26, sz * 0.06);
        ctx.quadraticCurveTo(sz * 0.18, sz * 0.13, sz * 0.48, -sz * 0.01);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Warm chestnut-rust gorget & pale chest wash
        ctx.fillStyle = pal.ventral;
        ctx.beginPath();
        ctx.ellipse(sz * 0.04, sz * 0.05, sz * 0.22, sz * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.arc(sz * 0.30, sz * 0.03, sz * 0.075, 0, Math.PI * 2);
        ctx.fill();
      } else if (species === "falcon") {
        // Sleek raptor torso, notched hooked beak silhouette & fanned barred tail
        ctx.beginPath();
        ctx.moveTo(sz * 0.50, -sz * 0.02);
        ctx.quadraticCurveTo(sz * 0.38, -sz * 0.14, sz * 0.12, -sz * 0.15);
        ctx.quadraticCurveTo(-sz * 0.16, -sz * 0.11, -sz * 0.38, -sz * 0.05);
        ctx.lineTo(-sz * 0.68, -sz * 0.11);
        ctx.lineTo(-sz * 0.68, sz * 0.11);
        ctx.lineTo(-sz * 0.38, sz * 0.06);
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.15, sz * 0.50, -sz * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pal.ventral;
        ctx.beginPath();
        ctx.ellipse(sz * 0.04, sz * 0.06, sz * 0.24, sz * 0.065, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Streamlined Albatross / Starling body with distinct pale underbelly
        ctx.beginPath();
        ctx.moveTo(sz * 0.54, 0);
        ctx.quadraticCurveTo(sz * 0.16, -sz * 0.14, -sz * 0.34, -sz * 0.05);
        ctx.lineTo(-sz * 0.56, -sz * 0.09);
        ctx.lineTo(-sz * 0.54, sz * 0.09);
        ctx.lineTo(-sz * 0.34, sz * 0.06);
        ctx.quadraticCurveTo(sz * 0.16, sz * 0.13, sz * 0.54, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (species === "albatross") {
          ctx.fillStyle = pal.ventral;
          ctx.beginPath();
          ctx.ellipse(sz * 0.28, -sz * 0.01, sz * 0.16, sz * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Near Articulated Two-Segment Wing (inner shoulder wing + flexed primary feather tip!)
      ctx.fillStyle = species === "albatross" ? pal.ventral : pal.dorsal;
      ctx.beginPath();
      ctx.moveTo(sz * 0.18, 0);
      ctx.quadraticCurveTo(sz * 0.05, nearElbY * 0.72, nearElbX, nearElbY);
      ctx.quadraticCurveTo((nearElbX + nearTipX) * 0.5, (nearElbY + nearTipY) * 0.55 - sz * 0.04, nearTipX, nearTipY);
      // Slotted primary feather tips for Cranes & Falcons
      if (species === "crane" || species === "falcon") {
        ctx.lineTo(nearTipX + sz * 0.09, nearTipY + sz * 0.10);
        ctx.lineTo(nearTipX + sz * 0.02, nearTipY + sz * 0.13);
        ctx.lineTo(nearTipX + sz * 0.12, nearTipY + sz * 0.18);
      }
      ctx.quadraticCurveTo(nearElbX * 0.92, nearElbY * 0.36 + sz * 0.08, -sz * 0.16, sz * 0.07);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = Math.max(0.65, 0.95 * b.depth);
      ctx.stroke();

      // Dark outer primary wingtip trim on Crane / Albatross
      if (species === "crane" || species === "albatross") {
        ctx.fillStyle = pal.tip;
        ctx.beginPath();
        ctx.moveTo(nearElbX * 0.6 + nearTipX * 0.4, nearElbY * 0.6 + nearTipY * 0.4);
        ctx.lineTo(nearTipX, nearTipY);
        ctx.lineTo(nearTipX + sz * 0.11, nearTipY + sz * 0.16);
        ctx.lineTo(nearElbX * 0.55 + nearTipX * 0.45, nearElbY * 0.4 + nearTipY * 0.45 + sz * 0.10);
        ctx.closePath();
        ctx.fill();
      }

      if (mode === "dark") {
        ctx.fillStyle = `rgba(186, 230, 253, ${(env * 0.38).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(nearTipX, nearTipY, 1.3 * b.depth, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  },

  _updateAndDrawNaturePhenomena(ctx, w, h, mode, dt) {
    if (!this.naturePhenomena || this.naturePhenomena.length === 0) return;
    const alive = [];
    for (let i = 0; i < this.naturePhenomena.length; i++) {
      const ph = this.naturePhenomena[i];
      ph.elapsed += dt;
      const p = ph.elapsed / Math.max(0.5, ph.duration);
      if (p >= 1) continue;
      this._drawThermalFlock(ctx, w, h, p, ph, mode);
      alive.push(ph);
    }
    this.naturePhenomena = alive;
  },
};

window.WaveCanvas = WaveCanvas;
window.addEventListener("DOMContentLoaded", () => {
  WaveCanvas.init();
});
