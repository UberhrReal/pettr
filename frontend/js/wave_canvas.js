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

  _smooth5(t) {
    const c = t < 0 ? 0 : (t > 1 ? 1 : t);
    return c * c * c * (c * (c * 6 - 15) + 10);
  },

  _getNatureWildlifePalette(mode) {
    if (mode === "morning") {
      return {
        lightVec: { x: 0.65, y: -0.75 },
        rimHi: "rgba(255, 224, 178, 0.72)",
        rim: "rgba(42, 24, 34, 0.34)",
        shadowTint: "rgba(92, 48, 66, 0.24)",
        nightEyeGlow: false,
        rabbitHi: "#D6C9C4",
        rabbitBody: "#AF9CA0",
        rabbitDark: "#7D6A73",
        deerHi: "#E59852",
        deerBody: "#C27238",
        deerDark: "#874322",
        pangolinHi: "#C78B46",
        pangolinBody: "#915B2E",
        pangolinDark: "#5A331C",
        pangolinScale: "#E3AB5C",
        pandaDarkHi: "#2B2836",
        pandaDarkLo: "#12101B",
        darkFur: "#1A1724",
        crocHi: "#3F8E4C",
        crocBody: "#276639",
        crocDark: "#143D23",
        okapiHi: "#A6492D",
        okapiBody: "#752A1D",
        okapiDark: "#451513",
        creamHi: "#FFF4E8",
        creamMid: "#F3DEC9",
        creamLow: "#CFAF9E",
        pink: "#FB8DA0",
        bamboo: "#34A853",
        bambooDark: "#1E6F36",
        flower: "#FDBA74",
        flowerCenter: "#B45309",
        antler: "#E8C39E",
        antlerTip: "#FFF2DF",
        eye: "#160F19"
      };
    }
    if (mode === "evening") {
      return {
        lightVec: { x: -0.75, y: -0.65 },
        rimHi: "rgba(253, 186, 116, 0.86)",
        rim: "rgba(22, 12, 34, 0.44)",
        shadowTint: "rgba(49, 20, 62, 0.36)",
        nightEyeGlow: false,
        rabbitHi: "#C4B1BD",
        rabbitBody: "#8F7C92",
        rabbitDark: "#5B4B66",
        deerHi: "#D97F3E",
        deerBody: "#A34F2B",
        deerDark: "#632724",
        pangolinHi: "#C0793B",
        pangolinBody: "#7F4423",
        pangolinDark: "#462019",
        pangolinScale: "#DA8E48",
        pandaDarkHi: "#241E35",
        pandaDarkLo: "#0E0A19",
        darkFur: "#151022",
        crocHi: "#2D784B",
        crocBody: "#1B5237",
        crocDark: "#0D2D24",
        okapiHi: "#8F392A",
        okapiBody: "#5D1E1E",
        okapiDark: "#320D16",
        creamHi: "#FDE7CE",
        creamMid: "#DEC0B6",
        creamLow: "#A68696",
        pink: "#F472B6",
        bamboo: "#229A52",
        bambooDark: "#125C32",
        flower: "#FB923C",
        flowerCenter: "#7C2D12",
        antler: "#D6AE88",
        antlerTip: "#FCE3C2",
        eye: "#0C0714"
      };
    }
    if (mode === "dark") {
      return {
        lightVec: { x: -0.45, y: -0.88 },
        rimHi: "rgba(186, 230, 253, 0.64)",
        rim: "rgba(148, 197, 248, 0.36)",
        shadowTint: "rgba(4, 10, 28, 0.48)",
        nightEyeGlow: true,
        rabbitHi: "#94ABC4",
        rabbitBody: "#647C99",
        rabbitDark: "#3D4F69",
        deerHi: "#9F6E56",
        deerBody: "#6E453B",
        deerDark: "#3E2326",
        pangolinHi: "#8E6B52",
        pangolinBody: "#593E30",
        pangolinDark: "#2E1F1B",
        pangolinScale: "#AD825E",
        pandaDarkHi: "#182338",
        pandaDarkLo: "#070C18",
        darkFur: "#0D1526",
        crocHi: "#246652",
        crocBody: "#16463D",
        crocDark: "#0A2424",
        okapiHi: "#6A3B40",
        okapiBody: "#452129",
        okapiDark: "#220F18",
        creamHi: "#C7DAF0",
        creamMid: "#94AFCF",
        creamLow: "#5E7799",
        pink: "#C084FC",
        bamboo: "#1E825E",
        bambooDark: "#0F4D3A",
        flower: "#BAE6FD",
        flowerCenter: "#38BDF8",
        antler: "#B4C6D8",
        antlerTip: "#E0F2FE",
        eye: "#030712"
      };
    }
    // Afternoon / Light — crisp daylight sunlit fur & warm natural shadows
    return {
      lightVec: { x: 0.42, y: -0.90 },
      rimHi: "rgba(255, 255, 255, 0.78)",
      rim: "rgba(15, 23, 42, 0.32)",
      shadowTint: "rgba(30, 41, 59, 0.22)",
      nightEyeGlow: false,
      rabbitHi: "#C4CBD6",
      rabbitBody: "#95A2B4",
      rabbitDark: "#637286",
      deerHi: "#DE893E",
      deerBody: "#B65B23",
      deerDark: "#7C3714",
      pangolinHi: "#BD8042",
      pangolinBody: "#854B22",
      pangolinDark: "#4E2712",
      pangolinScale: "#D99B4E",
      pandaDarkHi: "#273145",
      pandaDarkLo: "#0C1220",
      darkFur: "#111827",
      crocHi: "#358A49",
      crocBody: "#1E6636",
      crocDark: "#0D3A1F",
      okapiHi: "#943E29",
      okapiBody: "#61211B",
      okapiDark: "#360E10",
      creamHi: "#FCF9F2",
      creamMid: "#EDE7DB",
      creamLow: "#C9BFB2",
      pink: "#F472B6",
      bamboo: "#22C55E",
      bambooDark: "#15803D",
      flower: "#FBBF24",
      flowerCenter: "#B45309",
      antler: "#A16236",
      antlerTip: "#F6E3C6",
      eye: "#020617"
    };
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
    // Far larger pure-2D hero scaling consuming ~65-75% of the viewport horizontally & vertically
    const scale = isNarrow
      ? Math.min(w / 295, h / 430)
      : Math.min(w / 460, h / 290);
    const baseSpeed = isNarrow ? 132 : 245;
    const speed = species === "rabbit" ? baseSpeed * 1.15 : (species === "deer" ? baseSpeed * 1.22 : (species === "crocodile" ? baseSpeed * 0.85 : baseSpeed));
    const baseY = h * (isNarrow ? 0.54 : 0.56);
    const pauseX = w * (0.47 + Math.random() * 0.06);
    const margin = Math.round(240 * scale);

    this.wildlifeCrossings.push({
      species,
      dir,
      x: dir > 0 ? -margin : (w + margin),
      y: baseY,
      baseY,
      pauseX,
      pauseDuration: 3.3,
      pauseTimer: 0,
      pauseBlend: 0,
      moveSpeedNorm: 1,
      decelDist: Math.round(145 * scale),
      exitAccelTimer: 0,
      breathePhase: Math.random() * Math.PI * 2,
      phase: "enter",
      gaitPhase: 0,
      scale,
      speed
    });
  },

  _drawNatureAnimal(ctx, cr, pal, mode) {
    const s = cr.species;
    const isPause = cr.phase === "pause_action";
    const pauseFrac = isPause ? (cr.pauseTimer / Math.max(0.1, cr.pauseDuration)) : 0;
    const pauseBlend = cr.pauseBlend != null ? cr.pauseBlend : (isPause ? 1 : 0);
    const moveBlend = 1 - pauseBlend * 0.88;
    const breathe = Math.sin(cr.breathePhase || 0) * 1.4;
    const isNight = mode === "dark";
    const rim = pal.rim;
    const lv = pal.lightVec || { x: 0.4, y: -0.9 };

    const makeVolGrad = (x0, y0, x1, y1, cHi, cMid, cLow) => {
      const dx = lv.x * 16;
      const dy = lv.y * 16;
      const g = ctx.createLinearGradient(x0 + dx, y0 + dy, x1 - dx * 0.5, y1 - dy * 0.5);
      g.addColorStop(0, cHi);
      g.addColorStop(0.54, cMid);
      g.addColorStop(1, cLow);
      return g;
    };

    const strokeRim = (lw = 1.4) => {
      ctx.strokeStyle = rim;
      ctx.lineWidth = lw;
      ctx.stroke();
    };

    const strokeSunRim = (x0, y0, cx, cy, x1, y1, lw = 2.0) => {
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = pal.rimHi;
      ctx.lineWidth = Math.min(1.35, lw * 0.72);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.restore();
    };

    const drawEye = (ex, ey, r = 4.6, pupilCol = pal.eye) => {
      if (pal.nightEyeGlow) {
        ctx.save();
        const eg = ctx.createRadialGradient(ex, ey, r * 0.3, ex, ey, r * 2.4);
        eg.addColorStop(0, "rgba(253, 224, 71, 0.38)");
        eg.addColorStop(1, "rgba(253, 224, 71, 0)");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = pal.creamHi;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 1.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = pupilCol;
      ctx.beginPath();
      ctx.arc(ex + r * 0.14, ey, r * 0.86, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(ex + r * 0.36, ey - r * 0.32, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw2JointLeg = (hipX, hipY, kneeX, kneeY, footX, footY, upperW, lowerW, upperCol, lowerCol, hoofCol = null, isLightLower = false) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // Dark outline behind light fur / stockings so white limbs separate crisply in all diurnal modes
      if (isLightLower || lowerCol === pal.creamMid || lowerCol === pal.creamHi) {
        ctx.strokeStyle = rim;
        ctx.lineWidth = lowerW + 2.4;
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
      }
      // Upper thigh / shoulder muscular segment with volumetric gradient or color string
      ctx.strokeStyle = upperCol;
      ctx.lineWidth = upperW;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.stroke();

      // Subtle directional highlight along front edge of upper limb
      ctx.strokeStyle = pal.rimHi;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = Math.max(1.2, upperW * 0.16);
      ctx.beginPath();
      ctx.moveTo(hipX + lv.x * 2, hipY + lv.y * 2);
      ctx.lineTo(kneeX + lv.x * 2, kneeY + lv.y * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Lower cannon / shin
      ctx.strokeStyle = lowerCol;
      ctx.lineWidth = lowerW;
      ctx.beginPath();
      ctx.moveTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      if (hoofCol) {
        ctx.fillStyle = hoofCol;
        ctx.beginPath();
        ctx.roundRect(footX - lowerW * 0.58, footY - 4, lowerW * 1.42, 9, 2.5);
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
    };

    ctx.save();
    // Pure flat 2D horizontal side-profile coordinate system anchored at baseline y = +85
    ctx.translate(cr.x, cr.y);
    if (cr.dir < 0) ctx.scale(-1, 1);
    ctx.scale(cr.scale, cr.scale);

    if (s === "rabbit") {
      // Saltatorial Asymmetric Hop Cycle: crouch-gather -> nose-up parabolic bound -> forepaw landing
      const hp = cr.gaitPhase * 3.2;
      const cyc = ((hp % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
      const airSin = cyc > 0.24 && cyc < 0.92 ? Math.sin(((cyc - 0.24) / 0.68) * Math.PI) : 0;
      const walkHop = Math.pow(Math.max(0, airSin), 0.78) * 54;
      const walkPitch = cyc > 0.24 && cyc < 0.92 ? Math.cos(((cyc - 0.24) / 0.68) * Math.PI) * -0.26 : 0.14;
      const legStretch = cyc > 0.24 && cyc < 0.92 ? Math.sin(((cyc - 0.24) / 0.68) * Math.PI) : -0.45;

      const sit = pauseBlend;
      const springHop = (isPause && pauseFrac > 0.72 && pauseFrac < 0.90)
        ? Math.sin(((pauseFrac - 0.72) / 0.18) * Math.PI) * 44
        : 0;
      const hopArc = walkHop * (1 - sit) + springHop;
      const bodyPitch = walkPitch * (1 - sit) + (-0.42) * sit;
      const legReach = legStretch * (1 - sit);

      ctx.save();
      ctx.translate(0, 12 - hopArc + breathe * 0.35 * sit);
      ctx.rotate(bodyPitch);

      // Fluffy scalloped cottontail with volumetric radial cream gradient
      const tailG = makeVolGrad(-90, 14, -74, 30, pal.creamHi, pal.creamMid, pal.creamLow);
      ctx.fillStyle = tailG;
      [[-82, 26, 19], [-90, 18, 15.5], [-77, 14, 14.5]].forEach(([tx, ty, tr]) => {
        ctx.beginPath();
        ctx.arc(tx, ty, tr, 0, Math.PI * 2);
        ctx.fill();
        strokeRim(1.1);
      });

      // Far hind & fore legs (deep shaded)
      draw2JointLeg(-48, 38, -26 - legReach * 16, 58, -56 - legReach * 24, 71, 20, 11, pal.rabbitDark, pal.rabbitDark);
      draw2JointLeg(28, 36, 36 + legReach * 18, 56, 50 + legReach * 24, 71, 13, 9, pal.rabbitDark, pal.rabbitDark);

      // Sculpted volumetric hare-cottontail torso
      const rabG = makeVolGrad(-36, -18, 32, 62, pal.rabbitHi, pal.rabbitBody, pal.rabbitDark);
      ctx.fillStyle = rabG;
      ctx.beginPath();
      ctx.moveTo(-72, 26);
      ctx.bezierCurveTo(-76, -10, -24, -22, 16, -12);
      ctx.bezierCurveTo(46, -4, 52, 24, 38, 46);
      ctx.bezierCurveTo(10, 66, -48, 62, -72, 26);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.5);
      strokeSunRim(-58, -2, -16, -20, 32, -8, 1.8);

      // Soft diurnal cream chest & underside belly
      const rabBellyG = makeVolGrad(0, 26, 0, 56, pal.creamHi, pal.creamMid, pal.creamLow);
      ctx.fillStyle = rabBellyG;
      ctx.beginPath();
      ctx.ellipse(8, 39, 42, 19, -0.08, 0, Math.PI);
      ctx.fill();

      // Articulated shaded near muscular haunch & long spring-loaded hind foot
      const haunchG = makeVolGrad(-56, 22, -26, 62, pal.rabbitHi, pal.rabbitBody, pal.rabbitDark);
      ctx.fillStyle = haunchG;
      ctx.beginPath();
      ctx.ellipse(-42, 40, 26, 20, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.creamMid;
      ctx.beginPath();
      ctx.ellipse(-28 - legReach * 18, 67, 26, 8.2, legReach * 0.22, 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.2);

      // Sculpted head + fluffy cream cheek & nose
      const rabHeadG = makeVolGrad(24, -36, 70, 12, pal.rabbitHi, pal.rabbitBody, pal.rabbitDark);
      ctx.fillStyle = rabHeadG;
      ctx.beginPath();
      ctx.ellipse(46, -12, 32, 25.5, 0.14, 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.5);
      ctx.fillStyle = pal.creamHi;
      ctx.beginPath();
      ctx.ellipse(54, 1, 20, 13, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Long detailed shaded veined ears (streaming smoothly back mid-bound & perking/twitching on sit)
      const leapEarSweep = Math.max(0, legReach) * 0.28;
      const earWig = sit * Math.sin(pauseFrac * 22) * 0.22;
      [
        { bx: 28, by: -31, ang: -0.36 - leapEarSweep + earWig, col: pal.rabbitDark },
        { bx: 38, by: -29, ang: -0.14 - leapEarSweep * 0.7 - earWig * 0.6, col: rabHeadG }
      ].forEach((e, idx) => {
        ctx.save();
        ctx.translate(e.bx, e.by);
        ctx.rotate(e.ang);
        ctx.fillStyle = e.col;
        ctx.beginPath();
        ctx.ellipse(0, -34, 10.2, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        strokeRim(1.2);
        if (idx === 1) {
          ctx.fillStyle = pal.pink;
          ctx.globalAlpha = isNight ? 0.55 : 0.85;
          ctx.beginPath();
          ctx.ellipse(1, -33, 5.0, 25.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      });

      // Foreleg smoothly morphs from ground reach -> grooming whiskers during seated pauseBlend!
      const groomMix = sit * (pauseFrac < 0.72 ? 1 : Math.max(0, 1 - (pauseFrac - 0.72) / 0.14));
      const groomRub = Math.sin(pauseFrac * 24) * 5.5;
      const fKneeX = (42 + legReach * 16) * (1 - groomMix) + 56 * groomMix;
      const fKneeY = 55 * (1 - groomMix) + 12 * groomMix;
      const fFootX = (58 + legReach * 22) * (1 - groomMix) + 70 * groomMix;
      const fFootY = 71 * (1 - groomMix) + (-4 + groomRub) * groomMix;
      draw2JointLeg(32, 34 - 7 * groomMix, fKneeX, fKneeY, fFootX, fFootY, 13.5, 9.2, pal.rabbitBody, pal.creamMid, null, true);

      drawEye(55, -18, 5.2);
      ctx.fillStyle = pal.pink;
      ctx.beginPath();
      ctx.ellipse(76, -8 + sit * Math.sin(pauseFrac * 28) * 1.4, 5.5, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isNight ? "rgba(186, 230, 253, 0.55)" : rim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      [[-4, 4], [0, 7], [4, 10]].forEach(([wy, wy2]) => {
        ctx.moveTo(68, -6 + wy * 0.5);
        ctx.quadraticCurveTo(82, -5 + wy, 94, -3 + wy2);
      });
      ctx.stroke();
      ctx.restore();
    } else if (s === "deer") {
      // High-Stepping Cervid 4-Beat Trot with distinct forward knee lift + smooth grazing bend
      const trotP = cr.gaitPhase * 3.1;
      const strideA = Math.sin(trotP) * moveBlend;
      const strideB = -strideA;
      const liftA = Math.max(0, Math.cos(trotP)) * 16 * moveBlend;
      const liftB = Math.max(0, -Math.cos(trotP)) * 16 * moveBlend;
      const boundY = Math.abs(Math.sin(trotP)) * 14 * moveBlend;
      const grazeWave = 0.25 + 0.75 * Math.sin(Math.min(1, pauseFrac * 1.15) * Math.PI);
      const grazeBend = pauseBlend * grazeWave * 0.80;

      // Smoothly appearing diurnal-tinted wildflower cluster on ground baseline
      if (pauseBlend > 0.02) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, pauseBlend * 1.35);
        ctx.translate(114, 85);
        ctx.strokeStyle = pal.bamboo;
        ctx.lineWidth = 4.0;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-4, -26, 2, -52);
        ctx.stroke();
        ctx.fillStyle = pal.bambooDark;
        ctx.beginPath();
        ctx.ellipse(-10, -24, 11, 4.5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.bamboo;
        ctx.beginPath();
        ctx.ellipse(12, -32, 10, 4.2, 0.45, 0, Math.PI * 2);
        ctx.fill();
        for (let pt = 0; pt < 6; pt++) {
          const a = (pt * Math.PI) / 3 + pauseFrac * 0.4;
          ctx.fillStyle = pal.flower;
          ctx.beginPath();
          ctx.ellipse(2 + Math.cos(a) * 9, -54 + Math.sin(a) * 9, 6.5, 4.2, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = pal.flowerCenter;
        ctx.beginPath();
        ctx.arc(2, -54, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(0, -boundY + breathe * 0.25);

      // Far articulated legs with real knee lift! (Diagonal pair A)
      draw2JointLeg(-48, 8, -54 + strideB * 16, 44 - liftB * 0.8, -62 + strideB * 24, 84 - liftB, 14, 7.5, pal.deerDark, pal.deerDark, pal.eye);
      draw2JointLeg(36, 8, 42 + strideA * 18, 44 - liftA * 0.9, 50 + strideA * 25, 84 - liftA, 12.5, 7.5, pal.deerDark, pal.deerDark, pal.eye);

      // Upturned fluffy white-underside stag tail
      ctx.fillStyle = pal.deerBody;
      ctx.beginPath();
      ctx.ellipse(-70, -14, 15, 7.5, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.creamHi;
      ctx.beginPath();
      ctx.ellipse(-67, -10, 11, 5.5, -0.55, 0, Math.PI * 2);
      ctx.fill();

      // Seamless sculpted shaded neck drawn BEFORE shoulder torso
      ctx.save();
      ctx.translate(44, -14);
      ctx.rotate(grazeBend + Math.sin(trotP) * 0.05 * moveBlend);

      const dNeckG = makeVolGrad(2, -54, 24, 16, pal.deerHi, pal.deerBody, pal.deerDark);
      ctx.fillStyle = dNeckG;
      ctx.beginPath();
      ctx.moveTo(-18, 14);
      ctx.quadraticCurveTo(-2, -26, 8, -56);
      ctx.lineTo(28, -50);
      ctx.quadraticCurveTo(22, -12, 12, 14);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.1);

      // Velvety shaded throat ruff
      const ruffG = makeVolGrad(10, -34, 22, 0, pal.creamHi, pal.creamMid, pal.creamLow);
      ctx.fillStyle = ruffG;
      ctx.beginPath();
      ctx.ellipse(15, -18, 7.8, 22, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Alert sculpted ears
      [[-2, -0.55, pal.deerDark], [4, -0.25, pal.deerBody]].forEach(([ex, eang, ecol]) => {
        ctx.save();
        ctx.translate(6 + ex, -54);
        ctx.rotate(eang);
        ctx.fillStyle = ecol;
        ctx.beginPath();
        ctx.ellipse(0, -14, 6.2, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        strokeRim(1.0);
        ctx.fillStyle = pal.pink;
        ctx.globalAlpha = isNight ? 0.55 : 0.85;
        ctx.beginPath();
        ctx.ellipse(0, -13, 3.0, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      });

      // Sculpted deer head + shaded tapered muzzle + nose
      const dHeadG = makeVolGrad(8, -64, 42, -40, pal.deerHi, pal.deerBody, pal.deerDark);
      ctx.fillStyle = dHeadG;
      ctx.beginPath();
      ctx.ellipse(24, -52, 23, 12.2, 0.18, 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.2);
      ctx.fillStyle = pal.creamHi;
      ctx.beginPath();
      ctx.ellipse(38, -46, 9, 5.2, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Majestic 5-point branching shaded antlers with ivory tines
      const antG = ctx.createLinearGradient(0, -60, 0, -112);
      antG.addColorStop(0, pal.antler);
      antG.addColorStop(1, pal.antlerTip);
      ctx.strokeStyle = antG;
      ctx.lineCap = "round";
      ctx.lineWidth = 4.8;
      ctx.beginPath();
      ctx.moveTo(12, -62);
      ctx.quadraticCurveTo(4, -84, -8, -104);
      ctx.moveTo(8, -76);
      ctx.quadraticCurveTo(22, -88, 28, -102);
      ctx.moveTo(2, -88);
      ctx.quadraticCurveTo(14, -98, 12, -112);
      ctx.moveTo(-2, -96);
      ctx.lineTo(-14, -110);
      ctx.stroke();

      drawEye(26, -55, 4.2);
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(46, -50, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Muscular volumetric stag torso layered seamlessly over neck root
      const deerG = makeVolGrad(-20, -28, 12, 28, pal.deerHi, pal.deerBody, pal.deerDark);
      ctx.fillStyle = deerG;
      ctx.beginPath();
      ctx.moveTo(-64, 4);
      ctx.quadraticCurveTo(-56, -24, -18, -21);
      ctx.quadraticCurveTo(22, -19, 46, -24);
      ctx.quadraticCurveTo(64, -8, 52, 16);
      ctx.quadraticCurveTo(10, 26, -42, 22);
      ctx.quadraticCurveTo(-64, 18, -64, 4);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.3);
      strokeSunRim(-52, -16, -6, -24, 42, -21, 1.8);

      // Soft shaded cream underside & dappled sunlit flank spots
      ctx.fillStyle = pal.creamMid;
      ctx.beginPath();
      ctx.ellipse(2, 18, 40, 9.5, 0, 0, Math.PI);
      ctx.fill();

      ctx.fillStyle = pal.creamHi;
      ctx.globalAlpha = 0.78;
      [[-32, -8, 3.6], [-20, -12, 3.0], [-14, -3, 3.4], [-38, 1, 2.8], [-2, -10, 3.2], [12, -5, 2.8]].forEach(([sx, sy, sr]) => {
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Near articulated 2-joint legs (Diagonal pair matching opposite lift!)
      const legRGrad = makeVolGrad(-46, 13, -54, 80, pal.deerHi, pal.deerBody, pal.deerDark);
      const legFGrad = makeVolGrad(40, 13, 48, 80, pal.deerHi, pal.deerBody, pal.deerDark);
      draw2JointLeg(-42, 13, -48 + strideA * 18, 45 - liftA * 0.85, -56 + strideA * 26, 84 - liftA, 15.0, 8.0, legRGrad, pal.deerBody, pal.eye);
      draw2JointLeg(40, 13, 46 + strideB * 18, 45 - liftB * 0.90, 54 + strideB * 26, 84 - liftB, 13.2, 8.0, legFGrad, pal.deerBody, pal.eye);
      ctx.restore();
    } else if (s === "pangolin") {
      // Semi-bipedal tripod shuffle + continuous curling morph into defensive armored sphere!
      const walkP = cr.gaitPhase * 2.8;
      const walkStride = Math.sin(walkP) * moveBlend;
      const tailSway = Math.sin(walkP * 1.1) * 8 * moveBlend;
      const curl = pauseBlend;
      const curlEase = this._smooth5(curl);
      const rock = curlEase > 0.35 ? Math.sin(pauseFrac * Math.PI * 3.0) * (curlEase - 0.35) * 1.54 : 0;

      // Ground-anchored pivot lifting ball radius cleanly onto y=85 baseline as pangolin coils up
      ctx.save();
      ctx.translate(rock * 24, curlEase * -24);
      ctx.rotate(rock * 0.36);

      // Belly glow under scales + sturdy Hind Legs tapering behind scales (hind legs tuck seamlessly inside coiled sphere!)
      const legVis = Math.max(0, 1 - curlEase * 1.25);
      if (legVis > 0.02) {
        ctx.save();
        ctx.globalAlpha = legVis;
        draw2JointLeg(-28, 36 + curlEase * 12, -32 - walkStride * 11, 59, -34 - walkStride * 16, 82, 17, 12.5, pal.pangolinDark, pal.pangolinBody);
        draw2JointLeg(10, 34 + curlEase * 10, 12 + walkStride * 11, 59, 14 + walkStride * 16, 82, 17, 12.5, pal.pangolinBody, pal.pangolinBody);
        [-34 - walkStride * 16, 14 + walkStride * 16].forEach(fx => {
          ctx.strokeStyle = pal.creamMid;
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(fx, 81); ctx.lineTo(fx + 10, 84);
          ctx.moveTo(fx - 3, 82); ctx.lineTo(fx + 7, 85);
          ctx.stroke();
        });
        // Curled digging forelimb with long curved cream fossorial claws held clear off ground during bipedal shuffle!
        const armY = 26 + Math.sin(walkP * 2) * 3.5;
        draw2JointLeg(48, 12, 62, armY + 12, 54, armY + 22, 13, 9.5, pal.pangolinBody, pal.pangolinBody);
        ctx.strokeStyle = pal.creamHi;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(54, armY + 22); ctx.quadraticCurveTo(64, armY + 26, 61, armY + 34);
        ctx.moveTo(51, armY + 23); ctx.quadraticCurveTo(59, armY + 27, 56, armY + 35);
        ctx.stroke();
        ctx.restore();
      }

      // Parametric Morphing Armored Spine & Tail Coiling Continuously (curlEase: 0 = walking arc -> 1 = spiral armored sphere)
      const tailX = (-142 * (1 - curlEase)) + (-26 * curlEase);
      const tailY = ((42 + tailSway) * (1 - curlEase)) + (44 * curlEase);
      const midRumpX = (-68 * (1 - curlEase)) + (-56 * curlEase);
      const midRumpY = ((14 + tailSway * 0.4) * (1 - curlEase)) + (-24 * curlEase);
      const apexX = (4 * (1 - curlEase)) + (2 * curlEase);
      const apexY = (-24 * (1 - curlEase)) + (-56 * curlEase);
      const snoutX = (114 * (1 - curlEase)) + (-12 * curlEase);
      const snoutY = (36 * (1 - curlEase)) + (16 * curlEase);
      const ballR = 59 * curlEase;

      if (curlEase > 0.08) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, curlEase * 1.15);
        const sphereG = makeVolGrad(-22, -40, 26, 48, pal.pangolinHi, pal.pangolinBody, pal.pangolinDark);
        ctx.fillStyle = sphereG;
        ctx.beginPath();
        ctx.arc(0, 6, 58 * Math.min(1, 0.72 + curlEase * 0.28), 0, Math.PI * 2);
        ctx.fill();
        strokeRim(1.6);
        ctx.restore();
      }

      if (curlEase < 0.96) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, curlEase - 0.55) / 0.41);
        const pangoG = makeVolGrad(-16, -24, 18, 56, pal.pangolinHi, pal.pangolinBody, pal.pangolinDark);
        ctx.fillStyle = pangoG;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.quadraticCurveTo(midRumpX, midRumpY, apexX, apexY);
        ctx.quadraticCurveTo(54 * (1 - curlEase), -10 * (1 - curlEase) + curlEase * -34, snoutX, snoutY);
        ctx.quadraticCurveTo(54 * (1 - curlEase) + curlEase * 24, 52, -26, 48);
        ctx.quadraticCurveTo(-84 * (1 - curlEase), 54 + tailSway * 0.4, tailX, tailY);
        ctx.closePath();
        ctx.fill();
        strokeRim(1.5);
        strokeSunRim(tailX + 20, tailY - 8, apexX, apexY - 3, snoutX - 18, snoutY - 8, 1.8);
        ctx.restore();
      }

      // Continuous Beveled Overlapping Diamond Keratin Scales across body (blends cleanly into spiral coil!)
      if (curlEase < 0.65) {
        ctx.save();
        ctx.globalAlpha = 1 - curlEase / 0.65;
        for (let row = 0; row < 3; row++) {
          const yOff = row * 14;
          for (let sx = -108 + row * 18; sx <= 50; sx += 18) {
            const archY = Math.pow(sx / 68, 2) * 18 - 10 + yOff;
            if (archY > 42) continue;
            const scG = ctx.createLinearGradient(sx, archY - 8, sx, archY + 9);
            const cTop = (Math.round(sx / 18) + row) % 2 === 0 ? pal.pangolinScale : pal.pangolinHi;
            const cBot = (Math.round(sx / 18) + row) % 2 === 0 ? pal.pangolinBody : pal.pangolinDark;
            scG.addColorStop(0, cTop);
            scG.addColorStop(1, cBot);
            ctx.fillStyle = scG;
            ctx.beginPath();
            ctx.moveTo(sx + 13, archY);
            ctx.lineTo(sx, archY - 8);
            ctx.lineTo(sx - 13, archY);
            ctx.lineTo(sx, archY + 9);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = rim;
            ctx.lineWidth = 1.0;
            ctx.stroke();
            ctx.strokeStyle = pal.rimHi;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(sx - 9, archY - 1);
            ctx.lineTo(sx, archY - 7);
            ctx.lineTo(sx + 9, archY - 1);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      if (curlEase > 0.25) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (curlEase - 0.25) / 0.45);
        const r = 60;
        const numScales = 28;
        for (let k = numScales - 1; k >= 0; k--) {
          const t = k / numScales;
          const ang = t * Math.PI * 5.2;
          const dist = t * (r * 0.70);
          const sx = Math.cos(ang) * dist;
          const sy = 6 + Math.sin(ang) * dist;
          const sR = 11 + t * 8.5;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ang + 1.3);
          ctx.fillStyle = k % 2 === 0 ? pal.pangolinScale : pal.pangolinBody;
          ctx.beginPath();
          ctx.moveTo(sR, 0);
          ctx.quadraticCurveTo(0, -sR * 0.72, -sR * 0.85, 0);
          ctx.quadraticCurveTo(0, sR * 0.72, sR, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = rim;
          ctx.lineWidth = 1.1;
          ctx.stroke();
          ctx.restore();
        }
        // Tucked little conical snout & peaceful blinking eye inside spiral wrap
        ctx.fillStyle = pal.creamMid;
        ctx.beginPath();
        ctx.ellipse(-8, 16, 14, 8, -0.4, 0, Math.PI * 2);
        ctx.fill();
        strokeRim(1.1);
        ctx.strokeStyle = pal.eye;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(-4, 14, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.restore();
      }

      if (curlEase < 0.55) {
        ctx.save();
        ctx.globalAlpha = 1 - curlEase / 0.55;
        drawEye(84, 24, 3.6);
        // Playful tongue flick when uncurling near exit!
        if (isPause && pauseFrac > 0.76) {
          ctx.strokeStyle = pal.pink;
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(112, 37);
          ctx.quadraticCurveTo(126, 40, 136, 32);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    } else if (s === "panda") {
      // Heavy Pigeon-Toed Bear Amble + Seamless Continuous Morph into Seated Bamboo Munch!
      const ambleP = cr.gaitPhase * 2.5;
      const sit = this._smooth5(pauseBlend);
      const strideA = Math.sin(ambleP) * (1 - sit);
      const strideO = Math.cos(ambleP) * (1 - sit);
      const ambleBob = Math.abs(Math.sin(ambleP)) * 7 * (1 - sit);
      const chew = sit * Math.sin(pauseFrac * 22);
      const armLift = sit * Math.sin(pauseFrac * 10) * 5;

      const creamFurG = makeVolGrad(-26, -34, 36, 62, pal.creamHi, pal.creamMid, pal.creamLow);
      const darkFurG = makeVolGrad(-24, -40, 32, 64, pal.pandaDarkHi, pal.darkFur, pal.pandaDarkLo);

      ctx.save();
      ctx.translate(0, -ambleBob + breathe * 0.25 * sit);

      // Smoothly appearing upright leafy bamboo stalk when transitioning to sit
      if (sit > 0.08) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, sit * 1.25);
        ctx.translate(46, 6 + (1 - sit) * 18);
        ctx.strokeStyle = pal.bamboo;
        ctx.lineCap = "round";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(-4, 72);
        ctx.lineTo(14, -78);
        ctx.stroke();
        ctx.strokeStyle = pal.bambooDark;
        ctx.lineWidth = 2.4;
        [-46, -16, 14, 44].forEach(ny => {
          ctx.beginPath();
          ctx.moveTo(4 - ny * 0.11 - 5, ny);
          ctx.lineTo(4 - ny * 0.11 + 6, ny);
          ctx.stroke();
        });
        ctx.fillStyle = pal.bamboo;
        [[-10, -56, -0.5], [26, -68, 0.45], [22, -32, 0.35]].forEach(([lx, ly, la]) => {
          ctx.beginPath();
          ctx.ellipse(lx, ly, 16, 6, la, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = rim;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
        ctx.restore();
      }

      // Far hind & fore limbs blending continuously into settled sitting pose
      ctx.fillStyle = pal.darkFur;
      ctx.beginPath();
      const farHindX = (-54 - strideA * 12) * (1 - sit) + (-52) * sit;
      const farForeX = (18 + strideO * 12) * (1 - sit) + (-34) * sit;
      ctx.roundRect(farHindX, 24 + sit * 18, 24, 58 - sit * 18, 12);
      ctx.roundRect(farForeX, 24 * (1 - sit) + 4 * sit, 24, 58 - sit * 34, 12);
      ctx.fill();

      // Continuous Volumetric Cream Belly & Torso Morphing Upright onto Haunches!
      const bodyX = -8 * (1 - sit) + (-2) * sit;
      const bodyY = 14 * (1 - sit) + 28 * sit;
      const bodyRx = 62 * (1 - sit) + 56 * sit;
      const bodyRy = 42 * (1 - sit) + 52 * sit;
      ctx.fillStyle = creamFurG;
      ctx.beginPath();
      ctx.ellipse(bodyX, bodyY, bodyRx, bodyRy, 0.04 * (1 - sit), 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.7);
      strokeSunRim(bodyX - bodyRx * 0.65, bodyY - bodyRy * 0.55, bodyX, bodyY - bodyRy, bodyX + bodyRx * 0.55, bodyY - bodyRy * 0.62, 1.8);

      // Characteristic black shoulder saddle blending smoothly from upright walking band -> seated collar!
      ctx.fillStyle = darkFurG;
      ctx.beginPath();
      ctx.ellipse(-68 * (1 - sit) + 0 * sit, 4 * (1 - sit) + (-10) * sit, 10 * (1 - sit) + 48 * sit, 9 * (1 - sit) + 19 * sit, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sit < 0.85) {
        ctx.save();
        ctx.globalAlpha = 1 - sit / 0.85;
        ctx.beginPath();
        ctx.roundRect(10, -28, 30, 68, 12);
        ctx.fill();
        ctx.restore();
      }

      // Near Chunky Hind Legs sliding smoothly forward onto grounded dark paws with centered rosy pads!
      const walkHindAlpha = Math.max(0, 1 - sit * 1.35);
      if (walkHindAlpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = walkHindAlpha;
        ctx.fillStyle = darkFurG;
        ctx.beginPath();
        ctx.roundRect(-48 + strideA * 16, 26, 26, 58, 13);
        ctx.roundRect(22 - strideO * 16, 24, 25, 60, 12);
        ctx.fill();
        ctx.restore();
      }
      if (sit > 0.08) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, sit * 1.25);
        [[-46, 66, -0.22], [46, 66, 0.22]].forEach(([px, py, pang]) => {
          ctx.fillStyle = darkFurG;
          ctx.beginPath();
          ctx.ellipse(px, py, 25, 17, pang, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = pal.pink;
          ctx.globalAlpha = Math.min(1, sit * 1.25) * 0.78;
          ctx.beginPath();
          ctx.ellipse(px + (px < 0 ? -6 : 6), py, 10, 6.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = Math.min(1, sit * 1.25);
        });
        ctx.restore();
      }
      if (sit > 0.12) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (sit - 0.12) / 0.55);
        ctx.fillStyle = darkFurG;
        ctx.beginPath();
        ctx.ellipse(26, 14 + armLift, 28, 13, 0.38, 0, Math.PI * 2);
        ctx.ellipse(-28, 16, 22, 13, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Continuous Head Position, Orientation & Shaded Cheek/Ear/Patch Interpolation
      const headX = 62 * (1 - sit) + 2 * sit;
      const headY = -2 * (1 - sit) + (-36 + chew * 3) * sit;
      const headRx = 34 * (1 - sit) + 42 * sit;
      const headRy = 30 * (1 - sit) + 36 * sit;

      // Dark Panda Ears
      ctx.fillStyle = darkFurG;
      ctx.beginPath();
      ctx.arc(headX - 18 * (1 - sit) - 28 * sit, headY - 30, 14 + sit * 3.5, 0, Math.PI * 2);
      ctx.arc(headX + 14 * (1 - sit) + 28 * sit, headY - 28, 13.5 + sit * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Volumetric Cream Head
      const pHeadG = makeVolGrad(headX - 18, headY - 26, headX + 20, headY + 28, pal.creamHi, pal.creamMid, pal.creamLow);
      ctx.fillStyle = pHeadG;
      ctx.beginPath();
      ctx.ellipse(headX, headY, headRx, headRy, 0.1 * (1 - sit), 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.8);

      // Teardrop dark eye patches + eyes seamlessly blending single profile -> front-3/4 munching view!
      ctx.fillStyle = darkFurG;
      if (sit > 0.25) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (sit - 0.25) / 0.45);
        ctx.beginPath();
        ctx.ellipse(headX - 13, headY - 4, 11.5, 9, 0.3, 0, Math.PI * 2);
        ctx.ellipse(headX + 17, headY - 4, 11.5, 9, -0.3, 0, Math.PI * 2);
        ctx.fill();
        drawEye(headX - 11, headY - 5, 4.0);
        drawEye(headX + 17, headY - 5, 4.0);
        ctx.restore();
      }
      if (sit < 0.70) {
        ctx.save();
        ctx.globalAlpha = 1 - sit / 0.70;
        ctx.beginPath();
        ctx.ellipse(headX + 11, headY - 4, 10, 7.5, -0.25, 0, Math.PI * 2);
        ctx.fill();
        drawEye(headX + 12, headY - 5, 3.8);
        ctx.restore();
      }

      // Nose & friendly smile
      ctx.fillStyle = pal.darkFur;
      ctx.beginPath();
      ctx.ellipse(headX + 31 * (1 - sit) + 2 * sit, headY + 6 * (1 - sit) + 11 * sit, 6.2 + sit * 1.3, 4.6 + sit * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sit > 0.2) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (sit - 0.2) / 0.5);
        ctx.strokeStyle = pal.darkFur;
        ctx.lineWidth = 2.3;
        ctx.beginPath();
        ctx.arc(headX + 2, headY + 17, 7, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (s === "crocodile") {
      // Traveling S-wave lateral spine undulation + sprawling reptilian high-walk + smooth basking yawn!
      const sw = cr.gaitPhase * 2.7;
      const bask = this._smooth5(pauseBlend);
      const sway = Math.sin(sw) * 14 * (1 - bask);
      const tailWave = Math.sin(sw - 1.3) * 18 * (1 - bask);
      const settleY = bask * 7;
      const cStride = Math.sin(sw) * (1 - bask);
      const cOpp = -cStride;
      const cLiftN = Math.max(0, Math.cos(sw)) * 7 * (1 - bask);
      const cLiftF = Math.max(0, -Math.cos(sw)) * 7 * (1 - bask);
      const yawn = 0.04 + Math.max(0, Math.sin(pauseFrac * Math.PI * 1.45)) * 0.56 * bask;

      ctx.save();
      ctx.translate(0, settleY);

      // Far sprawling bent legs
      ctx.strokeStyle = pal.crocDark;
      ctx.lineCap = "round";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(-42, 46); ctx.lineTo(-48 + cOpp * 14, 65 - cLiftF * 0.7); ctx.lineTo(-42 + cOpp * 16, 80 - settleY - cLiftF);
      ctx.moveTo(28, 46); ctx.lineTo(34 + cStride * 14, 65 - cLiftN * 0.7); ctx.lineTo(42 + cStride * 16, 80 - settleY - cLiftN);
      ctx.stroke();

      // Long traveling S-wave tapering tail + heavy volumetric scaly torso
      const crocG = makeVolGrad(-40, 14, 18, 66, pal.crocHi, pal.crocBody, pal.crocDark);
      ctx.fillStyle = crocG;
      ctx.beginPath();
      ctx.moveTo(-154, 52 + tailWave);
      ctx.quadraticCurveTo(-98, 28 + sway * 0.6, -52, 22 + sway * 0.25);
      ctx.quadraticCurveTo(0, 14, 50, 26);
      ctx.lineTo(54, 60);
      ctx.quadraticCurveTo(-18, 68, -82, 62 + sway * 0.45);
      ctx.quadraticCurveTo(-120, 62 + tailWave * 0.65, -154, 52 + tailWave);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.5);
      strokeSunRim(-128, 44 + tailWave * 0.6, -24, 16, 44, 24, 1.7);

      // Barred pale ochre ventral belly plates
      ctx.fillStyle = pal.creamLow;
      ctx.globalAlpha = isNight ? 0.28 : 0.46;
      ctx.beginPath();
      ctx.ellipse(-6, 56, 52, 9, 0, 0, Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Staggered beveled dorsal osteoderm scutes tracking spine wave
      for (let scX = -132; scX <= 38; scX += 14) {
        const tailFrac = scX < -52 ? (-scX - 52) / 100 : 0;
        const localSway = tailFrac * (sway * 0.55 + tailWave * 0.45);
        const yTop = (scX < -52 ? (38 - (scX + 132) * 0.22) : 20) + localSway;
        const hSc = scX < -60 ? 15 : 11;
        ctx.fillStyle = pal.crocDark;
        ctx.beginPath();
        ctx.moveTo(scX - 6, yTop + 4);
        ctx.lineTo(scX, yTop - hSc);
        ctx.lineTo(scX + 6, yTop + 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pal.rimHi;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(scX - 4, yTop + 1);
        ctx.lineTo(scX, yTop - hSc);
        ctx.stroke();
      }

      // Near muscular bent legs with claw toes & subtle thigh gradient
      const cLegG = makeVolGrad(-36, 48, 44, 80, pal.crocHi, pal.crocBody, pal.crocDark);
      ctx.strokeStyle = cLegG;
      ctx.lineWidth = 15.5;
      ctx.beginPath();
      ctx.moveTo(-36, 50); ctx.lineTo(-42 + cStride * 16, 67 - cLiftN * 0.7); ctx.lineTo(-32 + cStride * 18, 82 - settleY - cLiftN);
      ctx.moveTo(34, 50); ctx.lineTo(42 + cOpp * 16, 67 - cLiftF * 0.7); ctx.lineTo(52 + cOpp * 18, 82 - settleY - cLiftF);
      ctx.stroke();

      // Massive articulated crocodile head & jaws (smooth basking yawn!)
      ctx.save();
      ctx.translate(48, 45);
      if (yawn > 0.10) {
        ctx.fillStyle = pal.pink;
        ctx.globalAlpha = Math.min(0.76, yawn * 1.4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(66, -Math.sin(yawn) * 44);
        ctx.lineTo(74, 8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Lower jaw
      ctx.fillStyle = crocG;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(76, 4);
      ctx.quadraticCurveTo(80, 15, 62, 16);
      ctx.lineTo(0, 14);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.3);

      // Upper toothed snout hinged smoothly open
      ctx.save();
      ctx.rotate(-yawn);
      ctx.fillStyle = crocG;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(10, -24, 28, -14);
      ctx.lineTo(80, -8);
      ctx.quadraticCurveTo(88, 2, 74, 4);
      ctx.lineTo(-2, 4);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.4);

      // Interlocking gleaming conical teeth along snout edge
      ctx.fillStyle = pal.creamHi;
      for (let tx = 24; tx <= 74; tx += 10) {
        ctx.beginPath();
        ctx.moveTo(tx - 3.2, 3);
        ctx.lineTo(tx, 12);
        ctx.lineTo(tx + 3.2, 3);
        ctx.closePath();
        ctx.fill();
        strokeRim(0.9);
      }

      // Golden vertical-slit reptile eye in bony orbit ridge
      drawEye(18, -12, 4.6, "#FACC15");
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.ellipse(18.5, -12, 1.1, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.restore();
    } else if (s === "okapi") {
      // Authentic Giraffid Ipsilateral Pacing Gait (same-side fore+hind swing together!) + Smooth Prehensile Leaf Nibble
      const paceP = cr.gaitPhase * 2.9;
      const reach = this._smooth5(pauseBlend);
      const walkMask = 1 - reach;
      const paceNear = Math.sin(paceP) * walkMask;
      const paceFar = -paceNear;
      const liftNear = Math.max(0, Math.cos(paceP)) * 9 * walkMask;
      const liftFar = Math.max(0, -Math.cos(paceP)) * 9 * walkMask;
      const boundY = Math.abs(Math.sin(paceP)) * 9 * walkMask;
      const reachAng = reach * Math.sin(Math.min(1, pauseFrac * 1.1) * Math.PI) * 0.25;

      // Smoothly appearing overhanging rainforest twig & tender leaf
      if (reach > 0.04) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, reach * 1.35);
        ctx.strokeStyle = pal.antler;
        ctx.lineWidth = 4.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(156, -78);
        ctx.quadraticCurveTo(126, -66, 98, -56);
        ctx.stroke();
        ctx.fillStyle = pal.bamboo;
        [[112, -56, -0.4], [126, -72, 0.3], [96, -54, -0.2]].forEach(([lx, ly, la]) => {
          ctx.beginPath();
          ctx.ellipse(lx, ly, 16, 6.5, la, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = rim;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
        ctx.restore();
      }

      ctx.save();
      ctx.translate(0, -boundY + breathe * 0.25);

      // Far ipsilateral pair (both swing together in paceFar with shaded cream stockings!)
      draw2JointLeg(-48, 8, -54 + paceFar * 16, 46 - liftFar * 0.6, -62 + paceFar * 24, 84 - liftFar, 15, 8.5, pal.okapiDark, pal.creamLow, pal.eye, true);
      draw2JointLeg(36, 8, 42 + paceFar * 16, 46 - liftFar * 0.6, 50 + paceFar * 24, 84 - liftFar, 14, 8.5, pal.okapiDark, pal.creamLow, pal.eye, true);

      // Slender dark tail with terminal brush
      ctx.strokeStyle = pal.okapiDark;
      ctx.lineWidth = 4.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-66, -10);
      ctx.quadraticCurveTo(-82, 8, -76, 30);
      ctx.stroke();

      // Giraffe-like sloped shaded mahogany neck drawn BEFORE torso with tucked chest root!
      ctx.save();
      ctx.translate(42, -14);
      ctx.rotate(-reachAng + Math.sin(paceP) * 0.04 * walkMask);

      const okNeckG = makeVolGrad(-4, -56, 28, 12, pal.okapiHi, pal.okapiBody, pal.okapiDark);
      ctx.fillStyle = okNeckG;
      ctx.beginPath();
      ctx.moveTo(-18, 16);
      ctx.lineTo(12, -58);
      ctx.lineTo(32, -52);
      ctx.lineTo(11, 14);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.1);

      // Large alert shaded mahogany ears
      ctx.save();
      ctx.translate(10, -56);
      ctx.rotate(-0.42);
      ctx.fillStyle = okNeckG;
      ctx.beginPath();
      ctx.ellipse(0, -14, 7.5, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.0);
      ctx.fillStyle = pal.creamMid;
      ctx.beginPath();
      ctx.ellipse(0, -13, 3.6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Furred crown ossicones
      ctx.strokeStyle = pal.okapiBody;
      ctx.lineWidth = 4.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(18, -58);
      ctx.lineTo(14, -74);
      ctx.stroke();

      // Refined pale diurnal cheek & elongated tapered muzzle
      ctx.fillStyle = okNeckG;
      ctx.beginPath();
      ctx.ellipse(26, -50, 24, 12.5, 0.20, 0, Math.PI * 2);
      ctx.fill();
      const cheekG = makeVolGrad(18, -54, 46, -38, pal.creamHi, pal.creamMid, pal.creamLow);
      ctx.fillStyle = cheekG;
      ctx.beginPath();
      ctx.ellipse(32, -46, 19, 8.8, 0.18, 0, Math.PI * 2);
      ctx.fill();
      strokeRim(1.1);

      // Prehensile long cobalt-indigo tongue wrapping onto tender leaf
      if (isPause && pauseFrac > 0.16 && pauseFrac < 0.86 && reach > 0.25) {
        const tLen = Math.sin(((pauseFrac - 0.16) / 0.70) * Math.PI) * 32 * reach;
        ctx.strokeStyle = isNight ? "#38BDF8" : "#1D4ED8";
        ctx.lineCap = "round";
        ctx.lineWidth = 4.8;
        ctx.beginPath();
        ctx.moveTo(48, -42);
        ctx.quadraticCurveTo(48 + tLen * 0.65, -48, 48 + tLen, -36);
        ctx.stroke();
      }

      drawEye(26, -53, 4.4);
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(50, -45, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Velvety dark mahogany-burgundy torso with volumetric shading & dorsal rim gleam!
      const okTorsoG = makeVolGrad(-20, -28, 12, 24, pal.okapiHi, pal.okapiBody, pal.okapiDark);
      ctx.fillStyle = okTorsoG;
      ctx.beginPath();
      ctx.moveTo(-64, -4);
      ctx.quadraticCurveTo(-48, -28, -10, -24);
      ctx.quadraticCurveTo(28, -22, 48, -28);
      ctx.quadraticCurveTo(64, -8, 52, 18);
      ctx.quadraticCurveTo(12, 26, -46, 20);
      ctx.quadraticCurveTo(-66, 14, -64, -4);
      ctx.closePath();
      ctx.fill();
      strokeRim(1.4);
      strokeSunRim(-52, -20, 6, -24, 44, -24, 1.8);

      // Bold diurnal-tinted cream zebra stripes curving cleanly across rump
      ctx.save();
      ctx.strokeStyle = pal.creamHi;
      ctx.lineCap = "round";
      ctx.lineWidth = 5.0;
      [-14, -3, 8, 19].forEach((sy, idx) => {
        ctx.beginPath();
        ctx.moveTo(-60 + idx * 2, sy);
        ctx.quadraticCurveTo(-40, sy - 4, -22, sy + 4);
        ctx.stroke();
      });
      ctx.restore();

      // Near ipsilateral pair (both swing together in paceNear!) + thigh stripes + perpendicular ankle bands
      const okKneeRx = -50 + paceNear * 16;
      const okKneeRy = 46 - liftNear * 0.6;
      const okFootRx = -58 + paceNear * 24;
      const okFootRy = 84 - liftNear;
      const okKneeFx = 46 + paceNear * 16;
      const okKneeFy = 46 - liftNear * 0.6;
      const okFootFx = 54 + paceNear * 24;
      const okFootFy = 84 - liftNear;

      draw2JointLeg(-42, 13, okKneeRx, okKneeRy, okFootRx, okFootRy, 16.0, 9.0, pal.okapiBody, pal.creamMid, pal.eye, true);
      draw2JointLeg(40, 13, okKneeFx, okKneeFy, okFootFx, okFootFy, 14.5, 9.0, pal.okapiBody, pal.creamMid, pal.eye, true);

      ctx.save();
      ctx.strokeStyle = pal.creamHi;
      ctx.lineCap = "round";
      ctx.lineWidth = 3.8;
      [0.44, 0.72].forEach(t => {
        const tx = -42 + (okKneeRx + 42) * t;
        const ty = 13 + (okKneeRy - 13) * t;
        ctx.beginPath();
        ctx.moveTo(tx - 6.5, ty);
        ctx.lineTo(tx + 6.5, ty);
        ctx.stroke();
      });
      ctx.restore();

      ctx.fillStyle = pal.darkFur;
      [
        [okKneeRx, okKneeRy, okFootRx, okFootRy],
        [okKneeFx, okKneeFy, okFootFx, okFootFy],
      ].forEach(([x1, y1, x2, y2]) => {
        const cx = x1 + (x2 - x1) * 0.45;
        const cy = y1 + (y2 - y1) * 0.45;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2);
        ctx.fillRect(-4.6, -2.1, 9.2, 4.2);
        ctx.restore();
      });
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawWildlife(ctx, w, h, mode, dt) {
    if (!this.wildlifeCrossings || this.wildlifeCrossings.length === 0) return;
    const pal = this._getNatureWildlifePalette(mode);
    const gaitRates = {
      rabbit: 3.3,
      deer: 3.1,
      pangolin: 2.8,
      panda: 2.6,
      crocodile: 2.8,
      okapi: 2.9
    };

    const alive = [];
    for (let i = 0; i < this.wildlifeCrossings.length; i++) {
      const cr = this.wildlifeCrossings[i];
      const baseSpeed = w < 720 ? 132 : 245;
      const spd = cr.speed || (cr.species === "rabbit" ? baseSpeed * 1.15 : (cr.species === "deer" ? baseSpeed * 1.22 : (cr.species === "crocodile" ? baseSpeed * 0.85 : baseSpeed)));
      const gaitRate = gaitRates[cr.species] || 3.0;
      const decelDist = cr.decelDist || Math.round(145 * (cr.scale || 1));
      cr.breathePhase = (cr.breathePhase || 0) + dt * 2.1;

      if (cr.phase === "enter") {
        const distToPause = Math.max(0, cr.dir > 0 ? (cr.pauseX - cr.x) : (cr.x - cr.pauseX));
        const f = Math.min(1, distToPause / Math.max(20, decelDist));
        cr.moveSpeedNorm = f < 1 ? (0.14 + 0.86 * this._smooth5(f)) : 1.0;
        if (f < 0.25) {
          cr.pauseBlend = this._smooth5((0.25 - f) / 0.25) * 0.16;
        }
        cr.x += cr.dir * spd * cr.moveSpeedNorm * dt;
        cr.gaitPhase += gaitRate * cr.moveSpeedNorm * dt;
        if ((cr.dir > 0 && cr.x >= cr.pauseX) || (cr.dir < 0 && cr.x <= cr.pauseX)) {
          cr.x = cr.pauseX;
          cr.phase = "pause_action";
          cr.pauseTimer = 0;
        }
      } else if (cr.phase === "pause_action") {
        cr.pauseTimer += dt;
        cr.moveSpeedNorm = 0;
        const rampT = 0.60;
        if (cr.pauseTimer < rampT) {
          cr.pauseBlend = Math.max(cr.pauseBlend || 0, 0.16 + 0.84 * this._smooth5(cr.pauseTimer / rampT));
        } else if (cr.pauseTimer > cr.pauseDuration - rampT) {
          cr.pauseBlend = this._smooth5((cr.pauseDuration - cr.pauseTimer) / rampT);
        } else {
          cr.pauseBlend = 1.0;
        }
        if (cr.pauseTimer >= cr.pauseDuration) {
          cr.phase = "exit";
          cr.exitAccelTimer = 0;
        }
      } else {
        cr.exitAccelTimer = (cr.exitAccelTimer || 0) + dt;
        cr.moveSpeedNorm = 0.14 + 0.86 * this._smooth5(Math.min(1, cr.exitAccelTimer / 0.68));
        cr.pauseBlend = Math.max(0, (cr.pauseBlend || 0) * (1 - Math.min(1, dt * 8)));
        cr.x += cr.dir * spd * cr.moveSpeedNorm * dt;
        cr.gaitPhase += gaitRate * cr.moveSpeedNorm * dt;
      }

      const exitMargin = 270 * (cr.scale || 1);
      if ((cr.dir > 0 && cr.x > w + exitMargin) || (cr.dir < 0 && cr.x < -exitMargin)) {
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
