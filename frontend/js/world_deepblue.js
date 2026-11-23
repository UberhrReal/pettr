/**
 * PETTR World Renderer: Underwater — "Deep Blue"
 * Underwater ocean research station with:
 * - Layered depth visibility falloff (far abyssal silhouettes muted into water haze)
 * - Modular geodesic & cylindrical research habitat on seabed pylons + illuminated docking bay
 * - Animated surface sunlight god-rays (morning/afternoon) transitioning to twilight & abyssal bioluminescence (evening/night)
 * - Multi-depth aquatic life: distant gliding manta rays, schooling fish, and pulsing jellyfish
 * - Research submersibles docking and departing from the station airlock with bubble trails
 * - Maintenance ROVs inspecting the station & reef while shining volumetric light beams into the dark
 * - Offscreen static layer caching for battery efficiency
 */
const WorldDeepBlue = {
  cacheCanvas: null,
  cacheKey: "",
  farLife: [],
  nearLife: [],
  jellies: [],
  snow: [],
  bubbles: [],
  sub: null,
  rovs: [],
  sonarRings: [],
  _lastW: 0,
  _lastH: 0,

  reset() {
    this.cacheKey = "";
    this.farLife = [];
    this.nearLife = [];
    this.jellies = [];
    this.snow = [];
    this.bubbles = [];
    this.sub = null;
    this.rovs = [];
    this.sonarRings = [];
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isDark: false,
        waterTop: "#C6EEF2",
        waterMid: "#89D4E2",
        waterBottom: "#4BA3BE",
        rayColor: "254, 249, 215",
        rayAlpha: 0.28,
        reefFar: "#5DAFC4",
        reefMid: "#39829D",
        reefNear: "#235C75",
        stationHull: "#4A6E82",
        stationAccent: "#CBD5E1",
        portholeGlow: "rgba(254, 243, 199, 0.72)",
        farCreatureRgb: "48, 118, 142",
        nearCreatureRgb: "24, 78, 102",
        jellyRgb: "125, 211, 252",
        beamAlpha: 0.22,
        beamRgb: "254, 249, 195",
        snowRgb: "240, 253, 250",
        biolumAlpha: 0.16
      };
    }
    if (mode === "evening") {
      return {
        isDark: true,
        waterTop: "#0F2B44",
        waterMid: "#091D33",
        waterBottom: "#051120",
        rayColor: "56, 189, 248",
        rayAlpha: 0.10,
        reefFar: "#0B243A",
        reefMid: "#071A2B",
        reefNear: "#04111E",
        stationHull: "#1B3347",
        stationAccent: "#38BDF8",
        portholeGlow: "rgba(253, 224, 138, 0.92)",
        farCreatureRgb: "16, 48, 74",
        nearCreatureRgb: "30, 82, 114",
        jellyRgb: "45, 212, 191",
        beamAlpha: 0.44,
        beamRgb: "254, 243, 199",
        snowRgb: "186, 230, 253",
        biolumAlpha: 0.65
      };
    }
    if (mode === "dark") {
      return {
        isDark: true,
        waterTop: "#040D1A",
        waterMid: "#030914",
        waterBottom: "#01040B",
        rayColor: "34, 211, 238",
        rayAlpha: 0.04,
        reefFar: "#061526",
        reefMid: "#040E1C",
        reefNear: "#020812",
        stationHull: "#112233",
        stationAccent: "#22D3EE",
        portholeGlow: "rgba(254, 240, 138, 0.95)",
        farCreatureRgb: "12, 34, 56",
        nearCreatureRgb: "22, 62, 88",
        jellyRgb: "34, 211, 238",
        beamAlpha: 0.56,
        beamRgb: "224, 247, 250",
        snowRgb: "165, 243, 252",
        biolumAlpha: 0.92
      };
    }
    // Light / Afternoon — sunlit cerulean crystal ocean
    return {
      isDark: false,
      waterTop: "#D9F2FB",
      waterMid: "#A5DDF2",
      waterBottom: "#67B6D6",
      rayColor: "255, 255, 255",
      rayAlpha: 0.30,
      reefFar: "#78BDD6",
      reefMid: "#4F95B4",
      reefNear: "#2D6C8A",
      stationHull: "#5B7D92",
      stationAccent: "#E2E8F0",
      portholeGlow: "rgba(224, 242, 254, 0.78)",
      farCreatureRgb: "64, 132, 158",
      nearCreatureRgb: "32, 88, 114",
      jellyRgb: "14, 165, 233",
      beamAlpha: 0.18,
      beamRgb: "240, 253, 250",
      snowRgb: "255, 255, 255",
      biolumAlpha: 0.10
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const seabedY = h * (isNarrow ? 0.86 : 0.83);
    const stationX = w * (isNarrow ? 0.72 : 0.76);
    const stationY = seabedY - (isNarrow ? 34 : 44);
    const stationScale = isNarrow ? 0.76 : Math.min(1.12, Math.max(0.82, w / 1280));
    // Submersible docking collar port on the left side of the research habitat
    const dockX = stationX - 78 * stationScale;
    const dockY = stationY - 2 * stationScale;

    return { isNarrow, seabedY, stationX, stationY, stationScale, dockX, dockY };
  },

  ensureStaticCache(w, h, mode) {
    const key = `${Math.round(w)}x${Math.round(h)}:${mode}`;
    if (this.cacheCanvas && this.cacheKey === key) return;

    if (!this.cacheCanvas) {
      this.cacheCanvas = document.createElement("canvas");
    }
    this.cacheCanvas.width = Math.max(1, Math.round(w));
    this.cacheCanvas.height = Math.max(1, Math.round(h));
    this.cacheKey = key;

    const ctx = this.cacheCanvas.getContext("2d");
    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Vertical depth-graded ocean water column
    const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
    waterGrad.addColorStop(0, pal.waterTop);
    waterGrad.addColorStop(0.52, pal.waterMid);
    waterGrad.addColorStop(1, pal.waterBottom);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Far background hazy seamount / trench silhouette (strong visibility falloff)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 40) {
      const y = L.seabedY - 65 - Math.sin(x * 0.0038 + 0.5) * 38 - Math.cos(x * 0.009) * 16;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = pal.reefFar;
    ctx.globalAlpha = 0.52;
    ctx.fill();
    ctx.restore();

    // 3. Midground reef ridges flanking left and right margins
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 30; x += 30) {
      const edgeLift = Math.pow(Math.abs((x / w) - 0.52) * 1.9, 1.8) * 48;
      const crag = Math.sin(x * 0.011 + 1.2) * 18 + Math.cos(x * 0.023) * 9;
      ctx.lineTo(x, L.seabedY - edgeLift - Math.max(0, crag));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = pal.reefMid;
    ctx.globalAlpha = 0.78;
    ctx.fill();
    ctx.restore();

    // 4. Underwater Research Station ("Deep Blue Station")
    this._drawResearchStation(ctx, L, pal);

    // 5. Foreground dark reef silhouettes & coral outcrops anchoring bottom corners
    ctx.save();
    ctx.fillStyle = pal.reefNear;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, L.seabedY - 24);
    ctx.quadraticCurveTo(w * 0.08, L.seabedY - 46, w * 0.19, L.seabedY + 8);
    ctx.quadraticCurveTo(w * 0.34, L.seabedY + 26, w * 0.52, L.seabedY + 34);
    ctx.quadraticCurveTo(w * 0.78, L.seabedY + 18, w * 0.90, L.seabedY - 12);
    ctx.quadraticCurveTo(w * 0.96, L.seabedY - 34, w, L.seabedY - 16);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle branching coral silhouettes on left foreground reef
    this._drawCoralCluster(ctx, w * 0.08, L.seabedY - 22, 22, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.14, L.seabedY - 6, 16, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.92, L.seabedY - 16, 19, pal.reefNear);
    ctx.restore();
  },

  _drawCoralCluster(ctx, x, y, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 2.6;
    const branches = [-0.55, -0.18, 0.22, 0.58];
    branches.forEach((ang, idx) => {
      const len = size * (0.72 + (idx % 2) * 0.32);
      const bx = x + Math.sin(ang) * len;
      const by = y - Math.cos(ang) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(ang) * len * 0.4, y - len * 0.55, bx, by);
      ctx.stroke();
    });
    ctx.restore();
  },

  _drawResearchStation(ctx, L, pal) {
    const s = L.stationScale;
    ctx.save();
    ctx.translate(L.stationX, L.stationY);
    ctx.scale(s, s);

    // Seabed support pylons anchored into the reef
    ctx.strokeStyle = pal.stationHull;
    ctx.lineWidth = 4.5;
    [-58, -18, 22, 62].forEach(px => {
      ctx.beginPath();
      ctx.moveTo(px, 14);
      ctx.lineTo(px + (px < 0 ? -7 : 7), 56);
      ctx.stroke();
    });
    // Cross truss under station
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-62, 34);
    ctx.lineTo(66, 34);
    ctx.stroke();

    // Upper hydrophone / sonar mast on right module
    ctx.strokeStyle = pal.stationHull;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(46, -16);
    ctx.lineTo(46, -54);
    ctx.moveTo(37, -42);
    ctx.lineTo(55, -42);
    ctx.stroke();

    // Geodesic glass observation dome in centre
    ctx.fillStyle = pal.portholeGlow;
    ctx.globalAlpha = pal.isDark ? 0.42 : 0.55;
    ctx.beginPath();
    ctx.arc(0, -14, 26, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Geodesic dome structural ribs
    ctx.strokeStyle = pal.stationHull;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -14, 26, Math.PI, 0);
    ctx.moveTo(-26, -14);
    ctx.lineTo(26, -14);
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -14);
    ctx.moveTo(-14, -36);
    ctx.lineTo(-10, -14);
    ctx.moveTo(14, -36);
    ctx.lineTo(10, -14);
    ctx.stroke();

    // Main pressurized horizontal cylindrical habitat modules (left bay + centre + right lab)
    ctx.fillStyle = pal.stationHull;
    ctx.beginPath();
    ctx.roundRect(-70, -16, 142, 32, 14);
    ctx.fill();

    // Upper hull metallic highlight rim
    ctx.strokeStyle = pal.stationAccent;
    ctx.globalAlpha = pal.isDark ? 0.35 : 0.6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-58, -14.5);
    ctx.lineTo(58, -14.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Left Submersible Docking Collar Sleeve
    ctx.fillStyle = pal.stationHull;
    ctx.fillRect(-84, -10, 16, 20);
    ctx.strokeStyle = pal.stationAccent;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-84, -10, 4, 20);

    // Glowing habitat porthole windows along the module
    const portholes = [-46, -24, 0, 24, 46];
    portholes.forEach(wx => {
      if (pal.isDark) {
        const halo = ctx.createRadialGradient(wx, 0, 1, wx, 0, 14);
        halo.addColorStop(0, "rgba(253, 224, 138, 0.55)");
        halo.addColorStop(1, "rgba(253, 224, 138, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(wx, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = pal.portholeGlow;
      ctx.beginPath();
      ctx.arc(wx, 0, 4.6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  },

  ensureEntities(w, h) {
    const isNarrow = w < 720;
    const L = this.getLayout(w, h);

    if (this.farLife.length === 0) {
      // Distant manta rays & background fish schools (depth 0.22..0.46 => strong haze falloff)
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.farLife.push({
          kind: "manta",
          depth: 0.24 + i * 0.10,
          x: Math.random() * w,
          y: h * (0.18 + i * 0.14),
          vx: (i % 2 === 0 ? 1 : -1) * (0.35 + Math.random() * 0.25),
          span: 24 + i * 7,
          phase: Math.random() * Math.PI * 2
        });
      }
      // Distant schooling fish cluster
      const schoolBaseY = h * 0.34;
      for (let i = 0; i < (isNarrow ? 8 : 14); i++) {
        this.farLife.push({
          kind: "fish",
          depth: 0.30 + (i % 3) * 0.08,
          x: (w * 0.15) + i * 16 + (Math.random() - 0.5) * 18,
          y: schoolBaseY + (Math.random() - 0.5) * 55,
          vx: 0.55 + Math.random() * 0.25,
          size: 4.5 + Math.random() * 2.5,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.nearLife.length === 0) {
      // Mid/Foreground crisp reef fish school
      for (let i = 0; i < (isNarrow ? 6 : 11); i++) {
        const dir = i < 6 ? 1 : -1;
        this.nearLife.push({
          depth: 0.72 + Math.random() * 0.28,
          x: Math.random() * w,
          y: h * (0.50 + Math.random() * 0.30),
          vx: dir * (0.85 + Math.random() * 0.55),
          size: 6.5 + Math.random() * 3.5,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.jellies.length === 0) {
      for (let i = 0; i < (isNarrow ? 2 : 4); i++) {
        this.jellies.push({
          x: w * (0.14 + i * 0.22) + (Math.random() - 0.5) * 60,
          y: h * (0.24 + Math.random() * 0.44),
          vy: -(0.14 + Math.random() * 0.12),
          size: 8 + Math.random() * 5,
          phase: Math.random() * Math.PI * 2,
          depth: 0.55 + Math.random() * 0.4
        });
      }
    }

    if (this.snow.length === 0) {
      const count = isNarrow ? 26 : 48;
      for (let i = 0; i < count; i++) {
        this.snow.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.8 + Math.random() * 1.5,
          vy: -(0.08 + Math.random() * 0.16),
          drift: Math.random() * Math.PI * 2,
          alpha: 0.15 + Math.random() * 0.35
        });
      }
    }

    if (!this.sub) {
      // Submersible cycling: approaching -> docking -> docked -> departing -> patrolling
      this.sub = {
        phase: "approaching",
        t: 0,
        phaseDuration: 9.0,
        x: w * 0.12,
        y: h * 0.36,
        dir: 1
      };
    }

    if (this.rovs.length === 0) {
      // 2 Maintenance ROVs inspecting the reef and research station hull
      this.rovs = [
        {
          // Reef inspector ROV (left-lower reef)
          waypoints: [
            { x: 0.14, y: 0.74, beamAngle: 0.45 },
            { x: 0.24, y: 0.79, beamAngle: 0.25 },
            { x: 0.32, y: 0.75, beamAngle: 0.65 },
            { x: 0.18, y: 0.69, beamAngle: 0.35 }
          ],
          wpIdx: 0,
          x: w * 0.16,
          y: h * 0.74,
          beamAngle: 0.45,
          pauseTimer: 2.5,
          phase: 0
        },
        {
          // Station hull maintenance ROV (hovering near Deep Blue station pylons & dome)
          waypoints: [
            { x: 0.67, y: 0.72, beamAngle: 0.22 },
            { x: 0.74, y: 0.68, beamAngle: 0.65 },
            { x: 0.86, y: 0.75, beamAngle: 2.65 },
            { x: 0.79, y: 0.82, beamAngle: 2.95 }
          ],
          wpIdx: 0,
          x: L.stationX - 55,
          y: L.stationY - 12,
          beamAngle: 0.25,
          pauseTimer: 1.8,
          phase: 2.1
        }
      ];
    }
  },

  pulseActivity({ kind = "complete", x = null, y = null, color = null } = {}) {
    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const rx = (typeof x === "number" && isFinite(x)) ? x : w * 0.5;
    const ry = (typeof y === "number" && isFinite(y)) ? y : h * 0.45;
    const isMajor = kind === "queue_clear" || kind === "finalise";

    // Expanding underwater sonar / bioluminescent caustic ring
    this.sonarRings.push({
      x: rx,
      y: ry,
      r: 12,
      maxR: isMajor ? Math.max(w, h) * 0.52 : Math.min(w, h) * 0.35,
      life: 0,
      maxLife: isMajor ? 72 : 52
    });
    if (this.sonarRings.length > 5) this.sonarRings.shift();

    // Release a delicate rising cluster of glistening bubbles near the action
    const count = isMajor ? 14 : 7;
    for (let i = 0; i < count; i++) {
      this.bubbles.push({
        x: rx + (Math.random() - 0.5) * 44,
        y: ry + (Math.random() - 0.5) * 20,
        r: 1.4 + Math.random() * 2.6,
        vy: -(0.8 + Math.random() * 1.1),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.45 + Math.random() * 0.35
      });
    }

    // If submersible is resting docked, nudge it to depart!
    if (this.sub && this.sub.phase === "docked" && this.sub.t > 1.2) {
      this.sub.phase = "departing";
      this.sub.t = 0;
      this.sub.phaseDuration = 9.0;
    }
  },

  draw(ctx, w, h, mode, dt, step) {
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit cached water column, reefs & research station
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Animated Surface Sunlight God-Rays (morning & afternoon; faint twilight shimmer at evening)
    if (pal.rayAlpha > 0.05) {
      this._drawGodRays(ctx, w, h, pal, step, mode);
    }

    // 3. Background Depth-Fogged Aquatic Life (visibility falls off strongly with depth)
    this._updateAndDrawFarLife(ctx, w, h, pal, dt, step);

    // 4. Station Live Beacons (comms spire strobe + docking bay guide lights)
    this._drawStationBeacons(ctx, L, pal, step);

    // 5. Research Submersible Docking & Departure Cycle
    this._updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step);

    // 6. Maintenance ROVs with Volumetric Inspection Light Cones
    this._updateAndDrawROVs(ctx, w, h, pal, dt, step);

    // 7. Mid/Foreground Aquatic Life (fish schools + bioluminescent jellyfish)
    this._updateAndDrawNearLife(ctx, w, h, pal, dt, step);

    // 8. Rising Bubbles, Marine Snow & Reactive Sonar Rings
    this._updateAndDrawAmbientParticles(ctx, w, h, pal, dt, step);
  },

  _drawGodRays(ctx, w, h, pal, step, mode) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const slant = mode === "morning" ? 0.28 : 0.14;
    const rayCount = w < 720 ? 4 : 6;
    for (let i = 0; i < rayCount; i++) {
      const baseX = (w * (0.1 + i * (0.82 / rayCount))) + Math.sin(step * 0.55 + i * 1.4) * 32;
      const topW = 28 + (i % 3) * 18;
      const botW = topW * 3.1;
      const rayH = h * (0.62 + (i % 2) * 0.18);
      const pulse = 0.65 + 0.35 * Math.sin(step * 0.9 + i * 2.1);

      const g = ctx.createLinearGradient(baseX, 0, baseX + rayH * slant, rayH);
      g.addColorStop(0, `rgba(${pal.rayColor}, ${(pal.rayAlpha * pulse).toFixed(3)})`);
      g.addColorStop(0.65, `rgba(${pal.rayColor}, ${(pal.rayAlpha * 0.35 * pulse).toFixed(3)})`);
      g.addColorStop(1, `rgba(${pal.rayColor}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseX - topW * 0.5, 0);
      ctx.lineTo(baseX + topW * 0.5, 0);
      ctx.lineTo(baseX + rayH * slant + botW * 0.5, rayH);
      ctx.lineTo(baseX + rayH * slant - botW * 0.5, rayH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  _drawStationBeacons(ctx, L, pal, step) {
    const s = L.stationScale;
    const pulse = 0.5 + 0.5 * Math.sin(step * 3.8);
    ctx.save();

    // Comms mast pulsing aqua/amber beacon
    const mastX = L.stationX + 46 * s;
    const mastY = L.stationY - 56 * s;
    const mg = ctx.createRadialGradient(mastX, mastY, 0, mastX, mastY, 13 * s);
    mg.addColorStop(0, `rgba(34, 211, 238, ${(0.35 + 0.55 * pulse).toFixed(3)})`);
    mg.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mastX, mastY, 13 * s, 0, Math.PI * 2);
    ctx.fill();

    // Docking bay guide beacons (glow brighter & emerald-cyan when submersible is docking!)
    const isDocking = this.sub && (this.sub.phase === "approaching" || this.sub.phase === "docking" || this.sub.phase === "docked");
    const dockRgb = isDocking ? "52, 211, 153" : "56, 189, 248";
    const dockAlpha = isDocking ? (0.55 + 0.40 * pulse) : (0.28 + 0.20 * pulse);
    [-9 * s, 9 * s].forEach(oy => {
      const bx = L.dockX - 4 * s;
      const by = L.dockY + oy;
      const dg = ctx.createRadialGradient(bx, by, 0, bx, by, 10 * s);
      dg.addColorStop(0, `rgba(${dockRgb}, ${dockAlpha.toFixed(3)})`);
      dg.addColorStop(1, `rgba(${dockRgb}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(bx, by, 10 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  _updateAndDrawFarLife(ctx, w, h, pal, dt, step) {
    const scaleDt = dt * 60;
    ctx.save();
    for (let i = 0; i < this.farLife.length; i++) {
      const f = this.farLife[i];
      f.phase += 0.04 * scaleDt;
      f.x += f.vx * scaleDt;
      f.y += Math.sin(f.phase * 0.7) * 0.18 * scaleDt;

      if (f.vx > 0 && f.x > w + 70) f.x = -70;
      if (f.vx < 0 && f.x < -70) f.x = w + 70;

      // Visibility falls off smoothly with depth (smaller depth = deeper/farther = fainter!)
      const visAlpha = (0.12 + f.depth * 0.45) * (pal.isDark ? 0.72 : 0.85);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${visAlpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1);

      if (f.kind === "manta") {
        const wingFlap = Math.sin(f.phase) * f.span * 0.24;
        const sp = f.span;
        ctx.beginPath();
        ctx.moveTo(sp * 0.55, 0);
        ctx.quadraticCurveTo(0, -sp * 0.55 + wingFlap, -sp * 0.25, -sp * 0.14);
        ctx.lineTo(-sp * 1.15, 0); // graceful tail whip
        ctx.lineTo(-sp * 0.25, sp * 0.14);
        ctx.quadraticCurveTo(0, sp * 0.55 - wingFlap, sp * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        const sz = f.size;
        const wag = Math.sin(f.phase * 2.2) * 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, sz, sz * 0.42, 0, 0, Math.PI * 2);
        ctx.moveTo(-sz * 0.8, 0);
        ctx.lineTo(-sz * 1.5, -sz * 0.45 + wag);
        ctx.lineTo(-sz * 1.5, sz * 0.45 + wag);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step) {
    const sub = this.sub;
    sub.t += dt;

    const entryX = -60;
    const entryY = h * 0.34;
    const holdX = L.dockX - 52;
    const holdY = L.dockY;
    const dockedX = L.dockX - 18 * L.stationScale;
    const dockedY = L.dockY;
    const exitX = w + 75;
    const exitY = h * 0.26;

    let visible = true;
    let heading = 0;
    let propActive = true;

    if (sub.phase === "approaching") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      sub.x = entryX + (holdX - entryX) * ease;
      sub.y = entryY + (holdY - entryY) * ease + Math.sin(p * Math.PI) * 16;
      sub.dir = 1;
      heading = Math.atan2(holdY - entryY, holdX - entryX) * (1 - p * 0.75);
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docking";
        sub.t = 0;
        sub.phaseDuration = 3.2;
      }
    } else if (sub.phase === "docking") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      sub.x = holdX + (dockedX - holdX) * ease;
      sub.y = holdY + (dockedY - holdY) * ease;
      sub.dir = 1;
      heading = 0;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docked";
        sub.t = 0;
        sub.phaseDuration = 7.5;
      }
    } else if (sub.phase === "docked") {
      sub.x = dockedX;
      sub.y = dockedY + Math.sin(step * 2.2) * 0.8;
      sub.dir = 1;
      heading = 0;
      propActive = false;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "departing";
        sub.t = 0;
        sub.phaseDuration = 10.5;
      }
    } else if (sub.phase === "departing") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      if (p < 0.22) {
        // Back gently out of the docking bay
        const bp = p / 0.22;
        sub.x = dockedX + (holdX - dockedX) * bp;
        sub.y = dockedY;
        sub.dir = 1;
        heading = 0;
      } else {
        // Ascend & cruise smoothly out to the left/upper deep
        const cp = (p - 0.22) / 0.78;
        const ease = cp * cp * (3 - 2 * cp);
        sub.x = holdX + (entryX - holdX) * ease;
        sub.y = holdY + (exitY - holdY) * ease;
        sub.dir = -1;
        heading = Math.atan2(exitY - holdY, holdX - entryX) * 0.35;
      }
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "patrol_wait";
        sub.t = 0;
        sub.phaseDuration = 6.0;
      }
    } else {
      visible = false;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "approaching";
        sub.t = 0;
        sub.phaseDuration = 9.5;
      }
    }

    if (!visible) return;

    // Trail micro-bubbles from propeller
    if (propActive && Math.random() < 0.34) {
      this.bubbles.push({
        x: sub.x - sub.dir * 20,
        y: sub.y + (Math.random() - 0.5) * 4,
        r: 1.1 + Math.random() * 1.6,
        vy: -(0.35 + Math.random() * 0.45),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.25
      });
    }

    ctx.save();
    ctx.translate(sub.x, sub.y);
    ctx.scale(sub.dir, 1);
    ctx.rotate(heading);

    // Forward volumetric headlight cone
    if (sub.phase !== "docked") {
      ctx.save();
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const coneLen = pal.isDark ? 120 : 75;
      const beamG = ctx.createLinearGradient(16, 0, 16 + coneLen, 0);
      beamG.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.85).toFixed(3)})`);
      beamG.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = beamG;
      ctx.beginPath();
      ctx.moveTo(16, -2);
      ctx.lineTo(16 + coneLen, -24);
      ctx.lineTo(16 + coneLen, 24);
      ctx.lineTo(16, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Submersible pressure hull (sleek aerospace-marine pill silhouette)
    ctx.fillStyle = pal.isDark ? "#E2E8F0" : "#F8FAFC";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lower hull ballast keel & conning tower
    ctx.fillStyle = "#F59E0B";
    ctx.beginPath();
    ctx.roundRect(-10, -11, 10, 5, 2);
    ctx.fill();
    ctx.fillStyle = pal.stationHull;
    ctx.fillRect(-19, -2.5, 4, 5);

    // Forward acrylic observation dome
    ctx.fillStyle = "#38BDF8";
    ctx.beginPath();
    ctx.arc(13, 0, 4.4, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();

    ctx.restore();
  },

  _updateAndDrawROVs(ctx, w, h, pal, dt, step) {
    for (let i = 0; i < this.rovs.length; i++) {
      const rov = this.rovs[i];
      rov.phase += dt * 2.1;
      const wp = rov.waypoints[rov.wpIdx];
      const tx = wp.x * w;
      const ty = wp.y * h;
      const dx = tx - rov.x;
      const dy = ty - rov.y;
      const dist = Math.hypot(dx, dy);

      let inspecting = false;
      if (dist > 6) {
        const speed = 26 * dt;
        rov.x += (dx / dist) * Math.min(dist, speed);
        rov.y += (dy / dist) * Math.min(dist, speed);
        const moveAng = Math.atan2(dy, dx);
        rov.beamAngle += (moveAng - rov.beamAngle) * Math.min(1, dt * 2.5);
      } else {
        inspecting = true;
        // Gently sweep inspection spotlight back & forth across reef / station hull
        const sweepTarget = wp.beamAngle + Math.sin(rov.phase * 0.9) * 0.34;
        rov.beamAngle += (sweepTarget - rov.beamAngle) * Math.min(1, dt * 3.0);
        rov.pauseTimer -= dt;
        if (rov.pauseTimer <= 0) {
          rov.wpIdx = (rov.wpIdx + 1) % rov.waypoints.length;
          rov.pauseTimer = 3.2 + Math.random() * 2.8;
        }
      }

      const hoverY = rov.y + Math.sin(rov.phase * 1.4) * 2.6;

      ctx.save();
      ctx.translate(rov.x, hoverY);

      // Volumetric ROV spotlight cone shining into the dark water!
      ctx.save();
      ctx.rotate(rov.beamAngle);
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const beamLen = pal.isDark ? 155 : 95;
      const beamSpread = pal.isDark ? 42 : 28;
      const bg = ctx.createLinearGradient(6, 0, beamLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 1.05).toFixed(3)})`);
      bg.addColorStop(0.55, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.36).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(5, -2.5);
      ctx.lineTo(beamLen, -beamSpread);
      ctx.lineTo(beamLen, beamSpread);
      ctx.lineTo(5, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Compact industrial yellow-orange ROV chassis
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.roundRect(-7, -4.5, 14, 7.5, 2.5);
      ctx.fill();
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(-5, 2.5, 10, 2.5);

      // Subtle cyan inspection laser/LED blink while hovering to inspect
      if (inspecting && Math.sin(step * 9 + i) > 0.3) {
        ctx.fillStyle = "#22D3EE";
        ctx.beginPath();
        ctx.arc(Math.cos(rov.beamAngle) * 6, Math.sin(rov.beamAngle) * 4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  },

  _updateAndDrawNearLife(ctx, w, h, pal, dt, step) {
    const scaleDt = dt * 60;

    // 1. Mid/Foreground Fish
    ctx.save();
    for (let i = 0; i < this.nearLife.length; i++) {
      const f = this.nearLife[i];
      f.phase += 0.08 * scaleDt;
      f.x += f.vx * scaleDt;
      f.y += Math.sin(f.phase * 0.5) * 0.25 * scaleDt;
      if (f.vx > 0 && f.x > w + 30) f.x = -30;
      if (f.vx < 0 && f.x < -30) f.x = w + 30;

      const alpha = (0.35 + f.depth * 0.45) * (pal.isDark ? 0.65 : 0.85);
      ctx.fillStyle = `rgba(${pal.nearCreatureRgb}, ${alpha.toFixed(3)})`;
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1);
      const sz = f.size;
      const wag = Math.sin(f.phase * 2.6) * 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, sz, sz * 0.44, 0, 0, Math.PI * 2);
      ctx.moveTo(-sz * 0.8, 0);
      ctx.lineTo(-sz * 1.55, -sz * 0.5 + wag);
      ctx.lineTo(-sz * 1.55, sz * 0.5 + wag);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 2. Drifting Translucent Jellyfish (bioluminescent pulse in evening & night!)
    ctx.save();
    for (let i = 0; i < this.jellies.length; i++) {
      const j = this.jellies[i];
      j.phase += 0.045 * scaleDt;
      const thrust = Math.max(0, Math.sin(j.phase));
      j.y += (j.vy - thrust * 0.16) * scaleDt;
      j.x += Math.sin(j.phase * 0.35 + i) * 0.22 * scaleDt;
      if (j.y < -45) {
        j.y = h + 30;
        j.x = w * (0.1 + Math.random() * 0.8);
      }

      const bellW = j.size * (0.85 + 0.22 * Math.cos(j.phase));
      const bellH = j.size * (0.68 - 0.12 * Math.cos(j.phase));
      const jAlpha = (0.22 + j.depth * 0.34) * (pal.isDark ? (0.75 + 0.25 * thrust) : 0.72);

      ctx.save();
      ctx.translate(j.x, j.y);

      if (pal.biolumAlpha > 0.3) {
        const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, j.size * 2.4);
        glow.addColorStop(0, `rgba(${pal.jellyRgb}, ${(jAlpha * pal.biolumAlpha * 0.6).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${pal.jellyRgb}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, j.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bell umbrella
      ctx.fillStyle = `rgba(${pal.jellyRgb}, ${jAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bellW, bellH, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Delicate trailing tentacles
      ctx.strokeStyle = `rgba(${pal.jellyRgb}, ${(jAlpha * 0.65).toFixed(3)})`;
      ctx.lineWidth = 0.85;
      for (let t = -1; t <= 1; t++) {
        const tx = t * bellW * 0.42;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.quadraticCurveTo(tx + Math.sin(j.phase + t) * 4, j.size * 0.9, tx - Math.sin(j.phase + t) * 3, j.size * 1.75);
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawAmbientParticles(ctx, w, h, pal, dt, step) {
    const scaleDt = dt * 60;

    // 1. Marine snow / faint bioluminescent plankton
    ctx.save();
    for (let i = 0; i < this.snow.length; i++) {
      const p = this.snow[i];
      p.drift += 0.02 * scaleDt;
      p.y += p.vy * scaleDt;
      p.x += Math.sin(p.drift) * 0.18 * scaleDt;
      if (p.y < -8) {
        p.y = h + 8;
        p.x = Math.random() * w;
      }
      const shimmer = pal.isDark ? (0.55 + 0.45 * Math.sin(p.drift * 2.2)) : 0.7;
      ctx.fillStyle = `rgba(${pal.snowRgb}, ${(p.alpha * shimmer).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Rising Bubbles
    if (this.bubbles.length > 0) {
      const aliveB = [];
      ctx.save();
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i];
        b.wobble += 0.09 * scaleDt;
        b.y += b.vy * scaleDt;
        b.x += Math.sin(b.wobble) * 0.35 * scaleDt;
        if (b.y < -10) continue;
        aliveB.push(b);

        ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha.toFixed(3)})`;
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      this.bubbles = aliveB;
    }

    // 3. Reactive Underwater Sonar / Caustic Rings
    if (this.sonarRings.length > 0) {
      const aliveR = [];
      ctx.save();
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < this.sonarRings.length; i++) {
        const sr = this.sonarRings[i];
        sr.life += scaleDt;
        if (sr.life >= sr.maxLife) continue;
        aliveR.push(sr);
        const t = sr.life / sr.maxLife;
        const r = 12 + (sr.maxR - 12) * (1 - Math.pow(1 - t, 3));
        const a = Math.sin(Math.min(1, t * 4) * Math.PI * 0.5) * Math.pow(1 - t, 1.4) * (pal.isDark ? 0.42 : 0.28);
        ctx.strokeStyle = `rgba(${pal.jellyRgb}, ${a.toFixed(3)})`;
        ctx.lineWidth = 1.8 * (1 - t * 0.6);
        ctx.beginPath();
        ctx.arc(sr.x, sr.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      this.sonarRings = aliveR;
    }
  }
};

window.WorldDeepBlue = WorldDeepBlue;
