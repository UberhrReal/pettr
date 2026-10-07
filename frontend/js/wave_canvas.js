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

  init() {
    this.canvas = document.getElementById("bgWaveCanvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.resize();
    window.removeEventListener("resize", this._boundResize);
    this._boundResize = () => this.resize();
    window.addEventListener("resize", this._boundResize);
    this.animate();
  },

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  },

  animate() {
    this.step += 0.008; // Smooth fluid propagation
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  },

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const mode = this.getThemeMode();
    const isDark = (mode === "dark" || mode === "evening");

    // Clear leaves if not in evening mode
    if (mode !== "evening" && (this.leaves.length > 0 || this.gustActive)) {
      this.leaves = [];
      this.gustActive = false;
      this.nextGustTime = 0;
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
      const auroraCurtains = [
        { r: 16, g: 185, b: 129, baseH: 260, speed: 0.8, amp: 55, alpha: 0.22 },
        { r: 6, g: 182, b: 212, baseH: 310, speed: 0.6, amp: 45, alpha: 0.18 },
        { r: 139, g: 92, b: 246, baseH: 360, speed: 0.5, amp: 65, alpha: 0.20 },
        { r: 236, g: 72, b: 153, baseH: 220, speed: 0.9, amp: 35, alpha: 0.14 }
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
  }
};

window.WaveCanvas = WaveCanvas;
window.addEventListener("DOMContentLoaded", () => {
  WaveCanvas.init();
});
