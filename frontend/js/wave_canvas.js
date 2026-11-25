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
  // v13.0 Playful Nature Wildlife Crossings (on task completion)
  NATURE_ANIMALS: ["rabbit", "deer", "pangolin", "panda", "crocodile", "okapi"],
  wildlifeCrossings: [],
  _lastNatureAnimal: "",

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
      const savedHour = parseInt(localStorage.getItem("pettr_theme_slider_hour") || new Date().getHours(), 10);
      if (savedHour >= 6 && savedHour < 12) return "morning";
      if (savedHour >= 12 && savedHour < 18) return "light";
      if (savedHour >= 18 && savedHour < 22) return "evening";
      return "dark";
    }
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "light";
    if (hour >= 18 && hour < 22) return "evening";
    return "dark";
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
    const world = this.getWorldMode();

    // Delegate cleanly to alternate World renderers when selected
    if (world === "gateway" && typeof WorldGateway !== "undefined") {
      WorldGateway.draw(ctx, w, h, mode, dt, this.step);
      this.updateAndDrawActivityRipples(ctx, w, h, mode);
      return;
    }
    if (world === "deep-blue" && typeof WorldDeepBlue !== "undefined") {
      WorldDeepBlue.draw(ctx, w, h, mode, dt, this.step);
      this.updateAndDrawActivityRipples(ctx, w, h, mode);
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

    // 3. Topographical contour ribs seen from an elevated perspective
    const numRows = Math.min(34, Math.max(20, Math.floor(h / 36)));
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

    // 5b. Playful Nature Task-Complete Wildlife Crossings & Festive Holiday Additions
    this._updateAndDrawWildlife(ctx, w, h, mode, dt);
    if (typeof HolidayThemes !== "undefined" && HolidayThemes.drawNatureOverlay) {
      HolidayThemes.drawNatureOverlay(ctx, w, h, mode, dt, this.step);
    }

    // 6. Activity-Reactive Atmospheric Light Ripples (all themes)
    this.updateAndDrawActivityRipples(ctx, w, h, mode);
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

    // 1b. Playful Nature Wildlife Crossing
    if (kind === "complete" || isMajor) {
      this.spawnNatureAnimal(w, h);
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

  spawnNatureAnimal(w, h, opts = {}) {
    if (!w || !h) return;
    if (this.wildlifeCrossings.length >= 2) {
      this.wildlifeCrossings.shift();
    }
    const isNarrow = w < 720;
    const pool = this.NATURE_ANIMALS.filter(a => a !== this._lastNatureAnimal);
    const species = (opts.animal && this.NATURE_ANIMALS.includes(opts.animal))
      ? opts.animal
      : (pool[Math.floor(Math.random() * pool.length)] || "rabbit");
    this._lastNatureAnimal = species;

    const dir = Math.random() < 0.65 ? 1 : -1;
    const baseSpeed = isNarrow ? 92 : 148;
    const speed = species === "rabbit" ? baseSpeed * 1.15 : (species === "deer" ? baseSpeed * 1.25 : (species === "crocodile" ? baseSpeed * 0.85 : baseSpeed));
    const baseY = h * (0.74 + Math.random() * 0.06);
    const pauseX = w * (0.44 + Math.random() * 0.12);

    this.wildlifeCrossings.push({
      species,
      dir,
      x: dir > 0 ? -75 : (w + 75),
      y: baseY,
      baseY,
      pauseX,
      pauseDuration: 2.35,
      pauseTimer: 0,
      phase: "enter",
      gaitPhase: 0,
      scale: isNarrow ? 0.84 : 1.08,
      stepDust: []
    });
  },

  _drawNatureAnimal(ctx, cr, pal, mode) {
    const s = cr.species;
    const isPause = cr.phase === "pause_action";
    const pauseFrac = isPause ? (cr.pauseTimer / Math.max(0.1, cr.pauseDuration)) : 0;
    const stride = cr.phase === "pause_action" ? 0 : Math.sin(cr.gaitPhase * 5.2);
    const strideOpp = cr.phase === "pause_action" ? 0 : Math.cos(cr.gaitPhase * 5.2);
    const isNightRim = mode === "dark";

    ctx.save();
    ctx.translate(cr.x, cr.y);
    // Subtle ground contact shadow matching elevated contour plane
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(0, 12 * cr.scale, 18 * cr.scale, 4.5 * cr.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (cr.dir < 0) ctx.scale(-1, 1);
    ctx.scale(cr.scale, cr.scale);
    if (isNightRim) {
      ctx.strokeStyle = "rgba(186, 230, 253, 0.35)";
      ctx.lineWidth = 1.0;
    }

    if (s === "rabbit") {
      const hopArc = isPause
        ? (pauseFrac > 0.62 && pauseFrac < 0.84 ? Math.sin(((pauseFrac - 0.62) / 0.22) * Math.PI) * 18 : 0)
        : Math.abs(Math.sin(cr.gaitPhase * 4.5)) * 16;
      ctx.translate(0, -hopArc);
      const sitRot = isPause ? -0.35 * Math.sin(Math.min(1, pauseFrac * 3) * Math.PI * 0.5) : Math.cos(cr.gaitPhase * 4.5) * 0.14;
      ctx.rotate(sitRot);
      // Cotton puff tail
      ctx.fillStyle = pal.cream;
      ctx.beginPath();
      ctx.arc(-11, 2, 4.0, 0, Math.PI * 2);
      ctx.fill();
      // Plump body & hind leg kick
      ctx.fillStyle = pal.rabbitBody;
      ctx.beginPath();
      ctx.ellipse(-1, 2, 11.5, 7.8, -0.1, 0, Math.PI * 2);
      ctx.fill();
      if (isNightRim) ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-6, 7 + Math.max(0, stride) * 2.5, 5.2, 3.2, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Rounded head & twin articulated long ears
      ctx.beginPath();
      ctx.arc(9.5, -2.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      const earWiggle = isPause ? Math.sin(pauseFrac * 18) * 0.24 : 0.08;
      [-0.35 + earWiggle, -0.12 - earWiggle * 0.7].forEach((ang, ei) => {
        ctx.save();
        ctx.translate(8 - ei * 1.5, -6.8);
        ctx.rotate(ang);
        ctx.fillStyle = pal.rabbitBody;
        ctx.beginPath();
        ctx.ellipse(0, -6.5, 2.1, 7.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.pink;
        ctx.beginPath();
        ctx.ellipse(0, -6.2, 1.0, 4.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      // Nose & eye
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(11.6, -3.4, 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.pink;
      ctx.beginPath();
      ctx.arc(15.0 + (isPause ? Math.sin(pauseFrac * 24) * 0.5 : 0), -1.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (s === "deer") {
      const boundY = isPause ? 0 : Math.abs(Math.sin(cr.gaitPhase * 4.2)) * 9;
      ctx.translate(0, -boundY);
      // Slender animated legs
      ctx.strokeStyle = pal.deerBody;
      ctx.lineWidth = 2.2;
      [
        [-9, 3, -9 - stride * 5, 13],
        [-6, 3, -6 + strideOpp * 5, 13],
        [7, 3, 7 + stride * 6, 13],
        [10, 3, 10 - strideOpp * 5, 13]
      ].forEach(([x0, y0, x1, y1]) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
      // Upturned white tail
      ctx.fillStyle = pal.cream;
      ctx.beginPath();
      ctx.ellipse(-13.5, -1, 3.0, 2.0, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // Graceful fawn torso & pale belly
      ctx.fillStyle = pal.deerBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.8, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (isNightRim) ctx.stroke();
      ctx.fillStyle = pal.cream;
      ctx.beginPath();
      ctx.ellipse(1, 3.2, 9.5, 2.8, 0, 0, Math.PI);
      ctx.fill();
      // Neck & head bowing playfully to nibble flower/shoot during pause
      const grazeBend = isPause ? Math.sin(Math.min(1, pauseFrac * 2.2) * Math.PI) * 0.72 : 0;
      ctx.save();
      ctx.translate(9, -2);
      ctx.rotate(grazeBend);
      ctx.fillStyle = pal.deerBody;
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.lineTo(3.5, -11);
      ctx.lineTo(7.5, -10);
      ctx.lineTo(3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(7.5, -11, 5.2, 3.0, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Branching antlers
      ctx.strokeStyle = pal.antler;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(5, -13);
      ctx.lineTo(2, -23);
      ctx.lineTo(-1, -26);
      ctx.moveTo(3, -18);
      ctx.lineTo(7, -23);
      ctx.stroke();
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(9.5, -11.6, 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isPause) {
        ctx.fillStyle = pal.flower;
        ctx.beginPath();
        ctx.arc(22, 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s === "pangolin") {
      const curlBlend = isPause ? Math.sin(Math.min(1, pauseFrac * 1.15) * Math.PI) : 0;
      if (curlBlend > 0.35) {
        // Curled scaly armored ball playfully rolling forward-and-back!
        const r = 10.5 * (0.85 + 0.15 * curlBlend);
        ctx.save();
        ctx.translate(Math.sin(pauseFrac * Math.PI * 3) * 8, 3);
        ctx.rotate(Math.sin(pauseFrac * Math.PI * 3) * 1.4);
        ctx.fillStyle = pal.pangolinBody;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.pangolinScale;
        ctx.lineWidth = 1.15;
        for (let a = 0; a < 6; a++) {
          ctx.beginPath();
          ctx.arc(0, 0, r * (0.42 + (a % 2) * 0.28), a * 1.04, a * 1.04 + 0.85);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Walking armored anteater silhouette with tapered scaled tail & conical snout
        ctx.strokeStyle = pal.pangolinScale;
        ctx.lineWidth = 2.6;
        [[ -4, 4, -4 + stride * 3.5, 11], [6, 4, 6 - stride * 3.5, 11]].forEach(([x0, y0, x1, y1]) => {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        });
        ctx.fillStyle = pal.pangolinBody;
        ctx.beginPath();
        ctx.moveTo(-22, 6);
        ctx.quadraticCurveTo(-8, -7, 4, -6);
        ctx.quadraticCurveTo(13, -4, 18, 2);
        ctx.lineTo(13, 5.5);
        ctx.quadraticCurveTo(2, 7.5, -14, 7.5);
        ctx.closePath();
        ctx.fill();
        if (isNightRim) ctx.stroke();
        // Scalloped diamond armor scales
        ctx.strokeStyle = pal.pangolinScale;
        ctx.lineWidth = 0.9;
        for (let bx = -10; bx <= 6; bx += 4.2) {
          ctx.beginPath();
          ctx.arc(bx, 0, 2.6, Math.PI * 1.15, Math.PI * 1.9);
          ctx.stroke();
        }
        ctx.fillStyle = pal.eye;
        ctx.beginPath();
        ctx.arc(13.5, 0.2, 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s === "panda") {
      if (isPause) {
        // Plump panda sitting happily & munching fresh green bamboo stalk!
        const chew = Math.sin(pauseFrac * 22);
        ctx.fillStyle = pal.cream;
        ctx.beginPath();
        ctx.ellipse(-1, 4, 11, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.darkFur;
        ctx.beginPath();
        ctx.ellipse(-8, 10, 4.5, 3.2, -0.3, 0, Math.PI * 2);
        ctx.ellipse(8, 10, 4.5, 3.2, 0.3, 0, Math.PI * 2);
        ctx.ellipse(6, 2, 5.5, 2.8, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Bamboo stalk in paws
        ctx.strokeStyle = pal.bamboo;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(11, 10);
        ctx.lineTo(13, -11);
        ctx.stroke();
        ctx.fillStyle = pal.bamboo;
        ctx.beginPath();
        ctx.ellipse(15.5, -9, 3.4, 1.3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Round panda head + black ears & eye patches nodding smoothly
        ctx.save();
        ctx.translate(1, -6.5 + chew * 0.6);
        ctx.fillStyle = pal.cream;
        ctx.beginPath();
        ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.darkFur;
        ctx.beginPath();
        ctx.arc(-5, -5.5, 2.5, 0, Math.PI * 2);
        ctx.arc(4.8, -5.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(2.6, -1.2, 1.9, 1.4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(3.0, -1.3, 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        const waddle = Math.sin(cr.gaitPhase * 4.5) * 1.4;
        ctx.translate(0, Math.abs(waddle) * 0.8);
        ctx.fillStyle = pal.darkFur;
        [[-8, 9 - stride * 2.5], [7, 9 + stride * 2.5]].forEach(([lx, ly]) => {
          ctx.beginPath();
          ctx.roundRect(lx - 2.6, 2, 5.2, Math.max(4, ly - 1), 2);
          ctx.fill();
        });
        ctx.fillStyle = pal.cream;
        ctx.beginPath();
        ctx.ellipse(-1, 2, 12.5, 7.8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (isNightRim) ctx.stroke();
        ctx.fillStyle = pal.darkFur;
        ctx.fillRect(3, -5, 5.2, 10.5);
        // Head
        ctx.fillStyle = pal.cream;
        ctx.beginPath();
        ctx.arc(10.5, -1.5, 6.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.darkFur;
        ctx.beginPath();
        ctx.arc(7.5, -6.5, 2.2, 0, Math.PI * 2);
        ctx.arc(13.0, -6.0, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12.8, -2.0, 1.7, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s === "crocodile") {
      const sway = isPause ? 0 : Math.sin(cr.gaitPhase * 4.5) * 3.0;
      // Sturdy short crawling legs
      ctx.strokeStyle = pal.crocDark;
      ctx.lineWidth = 2.6;
      [[-8, 6, -10 - stride * 3, 12], [7, 6, 9 + stride * 3, 12]].forEach(([x0, y0, x1, y1]) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
      // Serrated long sweeping tail + armored scaly torso
      ctx.fillStyle = pal.crocBody;
      ctx.beginPath();
      ctx.moveTo(-29, 7 + sway);
      ctx.quadraticCurveTo(-18, 1 + sway * 0.5, -10, 1.5);
      ctx.quadraticCurveTo(0, 0.5, 9, 2.5);
      ctx.lineTo(9, 8.2);
      ctx.quadraticCurveTo(-8, 9.2, -29, 7 + sway);
      ctx.closePath();
      ctx.fill();
      if (isNightRim) ctx.stroke();
      // Dorsal scute osteoderms
      ctx.fillStyle = pal.crocDark;
      for (let rx = -18; rx <= 5; rx += 4.5) {
        ctx.beginPath();
        ctx.moveTo(rx - 1.5, 2);
        ctx.lineTo(rx, -0.5);
        ctx.lineTo(rx + 1.5, 2);
        ctx.fill();
      }
      // Snout jaws opening wide into playful yawn/snap during mid-screen pause!
      const yaw = isPause ? Math.max(0, Math.sin(pauseFrac * Math.PI * 2.2)) * 0.52 : 0.04;
      ctx.save();
      ctx.translate(9, 5.5);
      // Lower mandible
      ctx.fillStyle = pal.crocBody;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(13, 0.5);
      ctx.lineTo(12, 3.0);
      ctx.lineTo(0, 2.8);
      ctx.closePath();
      ctx.fill();
      // Upper snout rotating open
      ctx.rotate(-yaw);
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(3, -3.5);
      ctx.lineTo(13.5, -1.6);
      ctx.lineTo(14, 0.4);
      ctx.closePath();
      ctx.fill();
      if (yaw > 0.14) {
        ctx.fillStyle = "#F8FAFC";
        for (let tx = 4; tx <= 12; tx += 3) {
          ctx.beginPath();
          ctx.moveTo(tx - 0.8, 0.2);
          ctx.lineTo(tx, 2.1);
          ctx.lineTo(tx + 0.8, 0.2);
          ctx.fill();
        }
      }
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(3.5, -2.1, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (s === "okapi") {
      const boundY = isPause ? 0 : Math.abs(Math.sin(cr.gaitPhase * 4.0)) * 5;
      ctx.translate(0, -boundY);
      // Zebra-striped white/dark slender lower legs
      ctx.strokeStyle = pal.cream;
      ctx.lineWidth = 2.3;
      [
        [-9, 3, -9 - stride * 5, 13],
        [-6, 3, -6 + strideOpp * 5, 13],
        [7, 3, 7 + stride * 5, 13],
        [10, 3, 10 - strideOpp * 5, 13]
      ].forEach(([x0, y0, x1, y1]) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      });
      // Rich dark mahogany coat + crisp horizontal zebra thigh stripes
      ctx.fillStyle = pal.okapiBody;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12.8, 6.2, -0.08, 0, Math.PI * 2);
      ctx.fill();
      if (isNightRim) ctx.stroke();
      ctx.strokeStyle = pal.cream;
      ctx.lineWidth = 1.3;
      [-2.0, 0.5, 3.0].forEach(sy => {
        ctx.beginPath();
        ctx.moveTo(-12.5, sy);
        ctx.lineTo(-5.5, sy + 1.0);
        ctx.stroke();
      });
      // Upright graceful sloped neck + pale face + ossicones + playful blue tongue stretching to leaf during pause!
      const reachAngle = isPause ? Math.sin(pauseFrac * Math.PI) * 0.26 : 0;
      ctx.save();
      ctx.translate(9, -2);
      ctx.rotate(reachAngle);
      ctx.fillStyle = pal.okapiBody;
      ctx.beginPath();
      ctx.moveTo(-2, 2);
      ctx.lineTo(4.2, -13);
      ctx.lineTo(8.5, -12);
      ctx.lineTo(3.5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.cream;
      ctx.beginPath();
      ctx.ellipse(8.5, -13, 5.2, 2.7, 0.22, 0, Math.PI * 2);
      ctx.fill();
      // Ears & short furred ossicones
      ctx.fillStyle = pal.okapiBody;
      ctx.beginPath();
      ctx.moveTo(6, -15);
      ctx.lineTo(5, -19.5);
      ctx.lineTo(7, -19.0);
      ctx.closePath();
      ctx.fill();
      if (isPause && pauseFrac > 0.22 && pauseFrac < 0.80) {
        const tLen = Math.sin(((pauseFrac - 0.22) / 0.58) * Math.PI) * 7.5;
        ctx.strokeStyle = "#1E3A8A";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(13.2, -12.0);
        ctx.quadraticCurveTo(13.2 + tLen * 0.6, -13.5, 13.2 + tLen, -10.5);
        ctx.stroke();
        ctx.fillStyle = pal.bamboo;
        ctx.beginPath();
        ctx.ellipse(15.5 + tLen * 0.5, -11.5, 2.6, 1.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(9.8, -13.5, 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawWildlife(ctx, w, h, mode, dt) {
    if (!this.wildlifeCrossings || this.wildlifeCrossings.length === 0) return;
    const isDark = mode === "dark" || mode === "evening";
    const pal = {
      shadow: isDark ? "rgba(0, 0, 0, 0.34)" : "rgba(15, 23, 42, 0.14)",
      rabbitBody: isDark ? "#CBD5E1" : "#94A3B8",
      deerBody: isDark ? "#D97706" : "#B45309",
      pangolinBody: isDark ? "#92400E" : "#78350F",
      pangolinScale: isDark ? "#F59E0B" : "#B45309",
      darkFur: "#0F172A",
      crocBody: isDark ? "#15803D" : "#166534",
      crocDark: isDark ? "#14532D" : "#052E16",
      okapiBody: isDark ? "#7C2D12" : "#581C1C",
      cream: "#F8FAFC",
      pink: "#F472B6",
      bamboo: "#22C55E",
      flower: "#FBBF24",
      antler: isDark ? "#FDE68A" : "#78350F",
      eye: "#020617"
    };

    const alive = [];
    for (let i = 0; i < this.wildlifeCrossings.length; i++) {
      const cr = this.wildlifeCrossings[i];
      const baseSpeed = w < 720 ? 92 : 148;
      const spd = cr.species === "rabbit" ? baseSpeed * 1.15 : (cr.species === "deer" ? baseSpeed * 1.25 : (cr.species === "crocodile" ? baseSpeed * 0.85 : baseSpeed));

      if (cr.phase === "enter") {
        cr.x += cr.dir * spd * dt;
        cr.gaitPhase += dt * 3.0;
        if ((cr.dir > 0 && cr.x >= cr.pauseX) || (cr.dir < 0 && cr.x <= cr.pauseX)) {
          cr.x = cr.pauseX;
          cr.phase = "pause_action";
          cr.pauseTimer = 0;
        }
      } else if (cr.phase === "pause_action") {
        cr.pauseTimer += dt;
        if (cr.pauseTimer >= cr.pauseDuration) {
          cr.phase = "exit";
        }
      } else {
        cr.x += cr.dir * spd * dt;
        cr.gaitPhase += dt * 3.1;
      }

      if ((cr.dir > 0 && cr.x > w + 95) || (cr.dir < 0 && cr.x < -95)) {
        continue;
      }
      this._drawNatureAnimal(ctx, cr, pal, mode);
      alive.push(cr);
    }
    this.wildlifeCrossings = alive;
  }
};

window.WaveCanvas = WaveCanvas;
window.addEventListener("DOMContentLoaded", () => {
  WaveCanvas.init();
});
