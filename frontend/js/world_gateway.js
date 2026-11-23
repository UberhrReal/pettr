/**
 * PETTR World Renderer: Space — "Gateway" (v12.3 Cohesive Realism, True Scale, Arc-Length Kinematics, Ships & Helicopters)
 * Elevated coastal island spaceport inspired by atmospheric wide-angle aerospace vistas:
 * - Refined painterly lighting & cohesive muted architecture (muted sunlit ivory/slate silhouettes, subtle glazing,
 *   atmospheric bay mist, monumental Star-Shaped Spire Terminal, twin launch towers, VAB, cryo tank farm,
 *   arched assembly hangar, geodesic radome, ATC tower, and waterfront support buildings).
 * - True arc-length-parameterised kinematics with C1 speed & heading continuity across every flight and taxi phase:
 *   genuinely slow realistic tarmac taxiing (~8.5 px/s) strictly along open apron corridors clear of all buildings,
 *   smooth progressive runway takeoff acceleration/liftoff, gentle flared approaches, and drogue-chute deceleration.
 * - Realistic slow rocket transport on a multi-axle flatbed hauled by a tow tug along the far northern crawlerway
 *   (with foreground spire parallax occlusion).
 * - Ocean vessels (Orbital Booster Recovery Ship, coastal ferry, distant bay freighters) & helicopters taking off,
 *   landing on painted helipads, and patrolling gracefully around the island and bay.
 */
const WorldGateway = {
  cacheCanvas: null,
  cacheKey: "",
  stars: [],
  clouds: [],
  cirrus: [],
  waterGlints: [],
  plumeParticles: [],
  ventParticles: [],
  rocket: null,
  spaceplane: null,
  spaceplanes: [],
  ships: [],
  boats: [],
  helicopters: [],
  spVariantIdx: 0,
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  _lastW: 0,
  _lastH: 0,
  _lastMode: "",

  SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper", "starliner"],

  _rand(min, max) {
    return min + Math.random() * (max - min);
  },

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  _lerpAngle(cur, target, t) {
    let diff = ((target - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return cur + diff * Math.max(0, Math.min(1, t));
  },

  _cubicBez(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    const x = uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x;
    const y = uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y;
    const dx = 3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x);
    const dy = 3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y);
    return { x, y, dx, dy, angle: Math.atan2(dy, dx) };
  },

  // True arc-length-parameterised polyline path from one or more cubic Bezier segments
  _buildArcPath(segments, samplesPerSeg = 44) {
    const pts = [];
    let totalLen = 0;
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const startK = si === 0 ? 0 : 1;
      for (let k = startK; k <= samplesPerSeg; k++) {
        const t = k / samplesPerSeg;
        const p = this._cubicBez(seg[0], seg[1], seg[2], seg[3], t);
        if (pts.length > 0) {
          const prev = pts[pts.length - 1];
          totalLen += Math.hypot(p.x - prev.x, p.y - prev.y);
        }
        pts.push({ x: p.x, y: p.y, s: totalLen, angle: p.angle });
      }
    }
    return { pts, totalLen: Math.max(1, totalLen) };
  },

  _sampleArcPath(path, dist) {
    const pts = path.pts;
    if (!pts || pts.length === 0) return { x: 0, y: 0, angle: 0 };
    const d = Math.max(0, Math.min(path.totalLen, dist));
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].s <= d) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const span = Math.max(1e-5, b.s - a.s);
    const f = Math.max(0, Math.min(1, (d - a.s) / span));
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      angle: this._lerpAngle(a.angle, b.angle, f)
    };
  },

  reset() {
    this.cacheKey = "";
    this.plumeParticles = [];
    this.ventParticles = [];
    this.rocket = null;
    this.spaceplane = null;
    this.spaceplanes = [];
    this.ships = [];
    this.boats = [];
    this.helicopters = [];
    this.stars = [];
    this.clouds = [];
    this.cirrus = [];
    this.waterGlints = [];
    this.orbiters = [];
    this.fogState = { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 };
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isNightLights: false,
        lightIntensity: 0.36,
        skyTop: "#7B97C2",
        skyMid: "#E4A8A4",
        skyHorizon: "#FDD5A8",
        sunCore: "rgba(255, 250, 232, 0.94)",
        sunGlow: "253, 186, 116",
        hazeRgb: "245, 212, 198",
        waterFar: "#C2B3C6",
        waterMid: "#8995B2",
        waterNear: "#4A5B7D",
        waterShimmerRgb: "255, 234, 206",
        islandFar: "#9D95AB",
        landBase: "#AE9FA2",
        landShade: "#887C86",
        apronFill: "#9B8F95",
        foliage: "#3A4656",
        runwayFill: "#545463",
        runwayLight: "rgba(255, 245, 228, 0.56)",
        archLight: "#F2E9E4",
        archMid: "#BCB0B8",
        archDark: "#6A6576",
        roofHighlight: "rgba(255, 250, 245, 0.56)",
        shadowColor: "rgba(34, 28, 48, 0.20)",
        towerSteel: "#585465",
        windowGlow: "rgba(254, 226, 178, 0.52)",
        windowGlassDark: "rgba(44, 44, 64, 0.54)",
        hangarInterior: "rgba(251, 196, 128, 0.42)",
        plumeCore: "255, 250, 232",
        plumeMid: "251, 165, 92",
        smokeRgb: "248, 226, 214",
        smokeAlpha: 0.42,
        chuteColor: "#D95D48",
        chuteStripe: "#FFF5E6",
        bodyLight: "#FCF7F3",
        bodyMid: "#D8D0D5",
        bodyShade: "#8E8794",
        liveryAccent: "#C9755A",
        shipHull: "#434C63",
        shipSuper: "#E8E0DD"
      };
    }
    if (mode === "evening") {
      return {
        isNightLights: true,
        lightIntensity: 0.86,
        skyTop: "#2E3C69",
        skyMid: "#996982",
        skyHorizon: "#F5A56A",
        sunCore: "rgba(255, 246, 218, 0.96)",
        sunGlow: "249, 144, 78",
        hazeRgb: "228, 164, 140",
        waterFar: "#8B6F85",
        waterMid: "#474E71",
        waterNear: "#222B44",
        waterShimmerRgb: "255, 208, 156",
        islandFar: "#584C68",
        landBase: "#575066",
        landShade: "#3B374B",
        apronFill: "#4B455B",
        foliage: "#1D2434",
        runwayFill: "#2C2B3A",
        runwayLight: "rgba(253, 218, 142, 0.62)",
        archLight: "#CFC5CC",
        archMid: "#847C90",
        archDark: "#3F3B4F",
        roofHighlight: "rgba(255, 234, 210, 0.36)",
        shadowColor: "rgba(12, 10, 26, 0.32)",
        towerSteel: "#474158",
        windowGlow: "rgba(254, 214, 134, 0.72)",
        windowGlassDark: "rgba(24, 22, 40, 0.72)",
        hangarInterior: "rgba(251, 191, 96, 0.56)",
        plumeCore: "255, 248, 224",
        plumeMid: "249, 115, 22",
        smokeRgb: "238, 172, 132",
        smokeAlpha: 0.38,
        chuteColor: "#E86D2A",
        chuteStripe: "#FEF3C7",
        bodyLight: "#ECE6E3",
        bodyMid: "#B2AAB8",
        bodyShade: "#5E5A6E",
        liveryAccent: "#D98A3A",
        shipHull: "#252B3F",
        shipSuper: "#C2B8C2"
      };
    }
    if (mode === "dark") {
      return {
        isNightLights: true,
        lightIntensity: 1.0,
        skyTop: "#050914",
        skyMid: "#0B152A",
        skyHorizon: "#192946",
        sunCore: "rgba(186, 230, 253, 0.36)",
        sunGlow: "56, 189, 248",
        hazeRgb: "30, 48, 82",
        waterFar: "#111E35",
        waterMid: "#0B1426",
        waterNear: "#060B17",
        waterShimmerRgb: "125, 211, 252",
        islandFar: "#141F36",
        landBase: "#162033",
        landShade: "#0E1524",
        apronFill: "#131C2E",
        foliage: "#080E18",
        runwayFill: "#101726",
        runwayLight: "rgba(125, 211, 252, 0.72)",
        archLight: "#6E8098",
        archMid: "#394860",
        archDark: "#151F33",
        roofHighlight: "rgba(186, 230, 253, 0.22)",
        shadowColor: "rgba(2, 6, 16, 0.44)",
        towerSteel: "#384766",
        windowGlow: "rgba(254, 222, 148, 0.76)",
        windowGlassDark: "rgba(8, 14, 28, 0.80)",
        hangarInterior: "rgba(186, 230, 253, 0.42)",
        plumeCore: "255, 252, 242",
        plumeMid: "251, 146, 60",
        smokeRgb: "148, 163, 184",
        smokeAlpha: 0.30,
        chuteColor: "#E87A35",
        chuteStripe: "#F8FAFC",
        bodyLight: "#CCD7E4",
        bodyMid: "#8090A6",
        bodyShade: "#334155",
        liveryAccent: "#38BDF8",
        shipHull: "#0D1526",
        shipSuper: "#5E718A"
      };
    }
    // Afternoon / Light — crisp coastal daylight aerospace port
    return {
      isNightLights: false,
      lightIntensity: 0.14,
      skyTop: "#9CC2EA",
      skyMid: "#CEE3F8",
      skyHorizon: "#EEF5FC",
      sunCore: "rgba(255, 255, 255, 0.90)",
      sunGlow: "186, 230, 253",
      hazeRgb: "226, 238, 249",
      waterFar: "#B8D4EE",
      waterMid: "#8DB6DC",
      waterNear: "#6491BD",
      waterShimmerRgb: "255, 255, 255",
      islandFar: "#9CB2CA",
      landBase: "#C4CEDB",
      landShade: "#9EADC0",
      apronFill: "#B4C1D0",
      foliage: "#556E78",
      runwayFill: "#5E6E84",
      runwayLight: "rgba(255, 255, 255, 0.70)",
      archLight: "#F8FAFC",
      archMid: "#C6D1DE",
      archDark: "#64748B",
      roofHighlight: "rgba(255, 255, 255, 0.78)",
      shadowColor: "rgba(30, 41, 59, 0.19)",
      towerSteel: "#475569",
      windowGlow: "rgba(219, 238, 252, 0.56)",
      windowGlassDark: "rgba(51, 65, 85, 0.52)",
      hangarInterior: "rgba(203, 213, 225, 0.42)",
      plumeCore: "255, 255, 255",
      plumeMid: "251, 191, 36",
      smokeRgb: "241, 245, 249",
      smokeAlpha: 0.46,
      chuteColor: "#DC4A4A",
      chuteStripe: "#FFFFFF",
      bodyLight: "#FFFFFF",
      bodyMid: "#D4DFEC",
      bodyShade: "#8596AB",
      liveryAccent: "#2A7EB0",
      shipHull: "#3E526B",
      shipSuper: "#F1F5F9"
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.34 : 0.28);
    const islandTopY = h * (isNarrow ? 0.45 : 0.40);
    const islandBotY = h * (isNarrow ? 0.78 : 0.77);
    const spanY = islandBotY - islandTopY;

    // Twin Launch & Catch Towers (Left-North Peninsula)
    const padX = w * (isNarrow ? 0.18 : 0.195);
    const padY = islandTopY + spanY * 0.12;
    const towerH = Math.min(198, Math.max(110, h * 0.22));
    const towerW = Math.max(12, towerH * 0.085);
    const towerLeftX = padX - towerW * 1.9;
    const towerRightX = padX + towerW * 1.9;

    // Monumental Star-Shaped Spire Terminal (scaled generously so spaceplanes feel realistically proportional!)
    const termX = w * 0.49;
    const termY = islandTopY + spanY * 0.35;
    const termScale = isNarrow ? 0.68 : Math.min(1.22, Math.max(0.84, w / 1200));

    // Wide Arched Assembly Hangar (East-North)
    const hangarX = w * (isNarrow ? 0.78 : 0.77);
    const hangarY = islandTopY + spanY * 0.17;
    const hangarW = Math.min(196, w * (isNarrow ? 0.26 : 0.145));
    const hangarH = hangarW * 0.30;
    const hangarDoorX = hangarX - hangarW * 0.21;
    const hangarDoorY = hangarY + hangarH * 0.44;

    // Radome & ATC Control Tower (Far East)
    const radomeX = w * 0.872;
    const radomeY = hangarY + 6;
    const atcX = w * 0.918;
    const atcY = hangarY + 14;

    // Dedicated Helipads on open tarmac aprons (East Ops Pad + West Waterfront Pad)
    const heliPad1 = { x: w * 0.88, y: hangarY + hangarH * 0.95 + 16 };
    const heliPad2 = { x: w * 0.255, y: islandBotY - 58 };

    // Sweeping Diagonal Main Runway across lower-middle of island
    const rwLeftX = w * 0.03;
    const rwLeftY = islandTopY + spanY * 0.32;
    const rwRightX = w * 0.97;
    const rwRightY = islandBotY + h * 0.05;

    const rwPt = (t) => ({
      x: rwLeftX + (rwRightX - rwLeftX) * t,
      y: rwLeftY + (rwRightY - rwLeftY) * t
    });

    const rwExitT = 0.66;
    const rwEntryT = 0.22;

    // Open South Apron Taxiway waypoints strictly CLEAR of Star Terminal arms!
    const apronEast = { x: termX + 206 * termScale, y: termY + 38 * termScale };
    const apronSE = { x: termX + 145 * termScale, y: termY + 62 * termScale };
    const apronSouth = { x: termX - 10 * termScale, y: termY + 60 * termScale };
    const apronSW = { x: termX - 135 * termScale, y: termY + 42 * termScale };

    return {
      isNarrow, horizonY, islandTopY, islandBotY, spanY,
      padX, padY, towerH, towerW, towerLeftX, towerRightX,
      termX, termY, termScale,
      hangarX, hangarY, hangarW, hangarH, hangarDoorX, hangarDoorY,
      radomeX, radomeY, atcX, atcY,
      heliPad1, heliPad2,
      rwLeftX, rwLeftY, rwRightX, rwRightY, rwPt, rwExitT, rwEntryT,
      apronEast, apronSE, apronSouth, apronSW
    };
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

    // 1. Wide Atmospheric Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, L.horizonY + 8);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(0.55, pal.skyMid);
    skyGrad.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, L.horizonY + 8);

    // 2. Low Sun / Moon Disk & Horizon Glow
    const sunX = w * 0.11;
    const sunY = L.horizonY - 8;
    const sunHalo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, Math.min(w * 0.48, 460));
    sunHalo.addColorStop(0, pal.sunCore);
    sunHalo.addColorStop(0.18, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.22 : 0.45})`);
    sunHalo.addColorStop(0.55, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.08 : 0.14})`);
    sunHalo.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
    ctx.fillStyle = sunHalo;
    ctx.fillRect(0, 0, w, L.horizonY + 120);

    if (mode !== "dark") {
      ctx.fillStyle = pal.sunCore;
      ctx.beginPath();
      ctx.arc(sunX, sunY, mode === "light" ? 9 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant horizon cloud bank silhouettes
    ctx.save();
    ctx.fillStyle = mode === "dark" ? "rgba(30, 41, 68, 0.34)" : "rgba(255, 234, 218, 0.26)";
    ctx.beginPath();
    ctx.moveTo(0, L.horizonY);
    for (let x = 0; x <= w + 40; x += 32) {
      const puff = Math.max(0, Math.sin(x * 0.008 + 1.2) * 15 + Math.cos(x * 0.019) * 9);
      ctx.lineTo(x, L.horizonY - puff);
    }
    ctx.lineTo(w, L.horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Coastal Bay Water & Distant Archipelago
    const bayGrad = ctx.createLinearGradient(0, L.horizonY, 0, h);
    bayGrad.addColorStop(0, pal.waterFar);
    bayGrad.addColorStop(0.42, pal.waterMid);
    bayGrad.addColorStop(1, pal.waterNear);
    ctx.fillStyle = bayGrad;
    ctx.fillRect(0, L.horizonY, w, h - L.horizonY);

    ctx.save();
    const refG = ctx.createLinearGradient(sunX, L.horizonY, sunX, L.islandTopY + 30);
    refG.addColorStop(0, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.18 : 0.50})`);
    refG.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
    ctx.fillStyle = refG;
    ctx.beginPath();
    ctx.moveTo(sunX - 16, L.horizonY);
    ctx.lineTo(sunX + 16, L.horizonY);
    ctx.lineTo(sunX + 72, L.islandTopY + 30);
    ctx.lineTo(sunX - 72, L.islandTopY + 30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const islands = [
      { x: 0.05, y: 0.05, rx: 0.09, h: 6 },
      { x: 0.38, y: 0.07, rx: 0.08, h: 8 },
      { x: 0.62, y: 0.03, rx: 0.14, h: 9 },
      { x: 0.88, y: 0.06, rx: 0.13, h: 11 }
    ];
    ctx.fillStyle = pal.islandFar;
    islands.forEach(isl => {
      const ix = w * isl.x;
      const iy = L.horizonY + h * isl.y;
      const rw = w * isl.rx;
      ctx.beginPath();
      ctx.moveTo(ix - rw, iy);
      ctx.quadraticCurveTo(ix, iy - isl.h, ix + rw, iy);
      ctx.closePath();
      ctx.fill();
    });

    // Soft atmospheric horizon mist blending distant bay into sky
    const mistG = ctx.createLinearGradient(0, L.horizonY - 12, 0, L.horizonY + 34);
    mistG.addColorStop(0, `rgba(${pal.hazeRgb}, 0)`);
    mistG.addColorStop(0.45, `rgba(${pal.hazeRgb}, ${mode === "dark" ? 0.22 : 0.36})`);
    mistG.addColorStop(1, `rgba(${pal.hazeRgb}, 0)`);
    ctx.fillStyle = mistG;
    ctx.fillRect(0, L.horizonY - 12, w, 46);

    // 4. Sweeping Spaceport Peninsula Island Landmass
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 12);
    ctx.lineTo(w * 0.24, L.islandTopY - 8);
    ctx.lineTo(w * 0.72, L.islandTopY + 2);
    ctx.lineTo(w + 20, L.islandTopY + 42);
    ctx.lineTo(w + 20, h + 10);
    ctx.lineTo(w * 0.62, L.islandBotY + 32);
    ctx.lineTo(w * 0.12, L.islandBotY - 38);
    ctx.lineTo(-20, L.islandTopY + 75);
    ctx.closePath();
    const landG = ctx.createLinearGradient(0, L.islandTopY, 0, L.islandBotY + 30);
    landG.addColorStop(0, pal.landBase);
    landG.addColorStop(1, pal.landShade);
    ctx.fillStyle = landG;
    ctx.fill();

    // Subtle paved tarmac apron zone
    ctx.beginPath();
    ctx.moveTo(w * 0.25, L.islandTopY + 14);
    ctx.lineTo(w * 0.86, L.islandTopY + 18);
    ctx.lineTo(w * 0.90, L.termY + 86);
    ctx.lineTo(w * 0.22, L.termY + 66);
    ctx.closePath();
    ctx.fillStyle = pal.apronFill;
    ctx.globalAlpha = 0.56;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Crisp coastal seawall edge & lush dark coastal embankment
    ctx.strokeStyle = pal.isNightLights ? "rgba(148, 163, 184, 0.20)" : "rgba(255, 255, 255, 0.38)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 75);
    ctx.lineTo(w * 0.12, L.islandBotY - 38);
    ctx.lineTo(w * 0.62, L.islandBotY + 32);
    ctx.stroke();

    ctx.fillStyle = pal.foliage;
    ctx.beginPath();
    ctx.moveTo(w * 0.10, L.islandBotY - 40);
    ctx.lineTo(w * 0.63, L.islandBotY + 30);
    ctx.lineTo(w * 0.61, L.islandBotY + 42);
    ctx.lineTo(w * 0.08, L.islandBotY - 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Runway, Strict Non-Overlapping South Apron Taxiway, Helipads & Gate Stands
    this._drawRunwayNetwork(ctx, w, L, pal);

    // 6. Far-Northern Crawlerway Road (strictly behind Star Terminal!)
    ctx.save();
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(L.hangarDoorX, L.hangarDoorY);
    ctx.quadraticCurveTo(w * 0.48, L.islandTopY + L.spanY * 0.08, L.padX, L.padY + 4);
    ctx.stroke();
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 7. Cohesive, Restrained Aerospace Campus Buildings (proportional to terminal & planes!)
    this._drawCryoTankFarm(ctx, L.padX + (L.isNarrow ? 44 : 62), L.padY + 2, pal);
    this._draw25DBuilding(ctx, w * 0.30, L.islandTopY + L.spanY * 0.10, L.isNarrow ? 34 : 46, L.isNarrow ? 22 : 30, pal, { style: "vab", floors: 2 });
    this._draw25DBuilding(ctx, w * 0.36, L.islandTopY + L.spanY * 0.12, L.isNarrow ? 28 : 40, 14, pal, { style: "ops", floors: 2 });
    this._draw25DBuilding(ctx, w * 0.60, L.islandTopY + L.spanY * 0.09, L.isNarrow ? 40 : 58, 17, pal, { style: "hangar_small", floors: 1 });

    // Cohesive low-slung waterfront logistics & terminal pavilions along embankment (matching inspiration image!)
    const waterfrontBldgs = [
      { t: 0.15, w: 46, h: 12, dy: -46, style: "warehouse", floors: 1 },
      { t: 0.21, w: 56, h: 16, dy: -36, style: "ops", floors: 2 },
      { t: 0.30, w: 48, h: 13, dy: -24, style: "warehouse", floors: 1 },
      { t: 0.38, w: 54, h: 14, dy: -13, style: "terminal_annex", floors: 2 },
      { t: 0.47, w: 58, h: 15, dy: -1, style: "warehouse", floors: 1 },
      { t: 0.74, w: 72, h: 18, dy: 28, style: "hangar_small", floors: 1 },
      { t: 0.85, w: 54, h: 15, dy: 34, style: "ops", floors: 2 }
    ];
    waterfrontBldgs.forEach(b => {
      const bw = (L.isNarrow && b.w > 46) ? b.w * 0.78 : b.w;
      const bx = w * b.t;
      const by = L.islandBotY + b.dy;
      this._draw25DBuilding(ctx, bx, by, bw, b.h, pal, { style: b.style, floors: b.floors });
    });

    // 8. Twin Launch & Catch Towers + Concrete Launch Mount
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.padX - 46, L.padY + 12);
    ctx.lineTo(L.padX - 32, L.padY - 4);
    ctx.lineTo(L.padX + 34, L.padY - 4);
    ctx.lineTo(L.padX + 48, L.padY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(L.padX - 28, L.padY - 4, 56, 2.5);
    ctx.fillStyle = pal.shadowColor;
    ctx.fillRect(L.padX - 18, L.padY + 2, 36, 6);

    this._drawLatticeTower(ctx, L.towerLeftX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);
    this._drawLatticeTower(ctx, L.towerRightX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);

    // 9. Iconic Monumental Multi-Arm Star-Shaped Spire Terminal
    this._drawStarTerminal(ctx, L, pal);

    // Properly scaled static spaceplanes parked spaciously inside wide west & east terminal gate alcoves (zero crowding!)
    const sc = L.termScale;
    const parked = [
      { x: L.termX - 102 * sc, y: L.termY + 32 * sc, ang: -0.22, sc: 0.56 * sc, v: "starliner" },
      { x: L.termX + 126 * sc, y: L.termY + 32 * sc, ang: 2.88, sc: 0.54 * sc, v: "airliner" }
    ];
    parked.forEach(pk => {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(pk.ang);
      ctx.scale(pk.sc, pk.sc);
      this._drawSpaceplaneModel(ctx, pk.v, pal, 0, 0, 1.5);
      ctx.restore();
    });

    // 10. Curved Arched Assembly Hangar Base + Side Annex
    this._drawArchedHangarBase(ctx, L, pal);
    this._draw25DBuilding(ctx, L.hangarX + L.hangarW * 0.52, L.hangarY + L.hangarH * 0.54, 28, 13, pal, { style: "ops", floors: 2 });

    // 11. Geodesic Radome, Telemetry Dish & Tall ATC Tower
    this._drawRadomeAndATC(ctx, L, pal);

    // 12. Foreground Lower-Right Curving Highway Causeway Bridge & Lower-Left Coastal Hillside
    this._drawForegroundBridgeAndCoast(ctx, w, h, L, pal);
  },

  _drawCryoTankFarm(ctx, startX, baseY, pal) {
    ctx.save();
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(startX - 28, baseY - 3.5);
    ctx.lineTo(startX + 40, baseY - 3.5);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const tx = startX + i * 15;
      const ty = baseY - (i % 2) * 2.5;
      const r = 5.5;
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(tx + 4.5, ty + 2.5, r * 1.15, r * 0.38, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.archDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx - 3.5, ty - 2);
      ctx.lineTo(tx - 4.5, ty + 2.5);
      ctx.moveTo(tx + 3.5, ty - 2);
      ctx.lineTo(tx + 4.5, ty + 2.5);
      ctx.stroke();
      const tg = ctx.createRadialGradient(tx - 2, ty - 7, 1, tx, ty - 5.5, r);
      tg.addColorStop(0, pal.archLight);
      tg.addColorStop(0.55, pal.archMid);
      tg.addColorStop(1, pal.archDark);
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(tx, ty - 5.5, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _draw25DBuilding(ctx, x, y, bw, bh, pal, opts = {}) {
    const style = opts.style || "warehouse";
    const floors = opts.floors || 1;
    const frontW = bw * 0.68;
    const depthX = bw * 0.32;
    const depthY = Math.max(2.5, Math.min(6, bh * 0.24));

    ctx.save();
    // 1. Soft cast ground shadow down-right
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + frontW + bh * 0.45 + depthX * 0.55, y + 3.5);
    ctx.lineTo(x + bw + bh * 0.45, y + depthY + 2.5);
    ctx.lineTo(x + frontW, y + depthY * 0.5);
    ctx.closePath();
    ctx.fill();

    // 2. Front architectural facade with soft daylight gradient
    const frontG = ctx.createLinearGradient(x, y - bh, x, y);
    frontG.addColorStop(0, pal.archLight);
    frontG.addColorStop(1, pal.archMid);
    ctx.fillStyle = frontG;
    ctx.fillRect(x, y - bh, frontW, bh);

    // 3. Shaded isometric right side wall
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y - bh);
    ctx.lineTo(x + bw, y - bh + depthY);
    ctx.lineTo(x + bw, y + depthY * 0.85);
    ctx.lineTo(x + frontW, y);
    ctx.closePath();
    ctx.fill();

    // 4. Beveled rooftop deck + subtle sunlit cornice rim
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + depthX * 0.72, y - bh - depthY * 0.6);
    ctx.lineTo(x + bw, y - bh + depthY * 0.35);
    ctx.lineTo(x + frontW, y - bh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y - bh);
    ctx.stroke();

    // 5. Restrained architectural superstructures
    if (style === "vab") {
      ctx.fillStyle = pal.windowGlassDark;
      ctx.fillRect(x + frontW * 0.30, y - bh * 0.82, frontW * 0.40, bh * 0.82);
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(x + frontW * 0.20, y - bh - 3.5, frontW * 0.48, 3.5);
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x + frontW * 0.68, y - bh - 2.8, depthX * 0.42, 3.2);
    } else if (style === "hangar_small") {
      ctx.fillStyle = pal.archLight;
      ctx.beginPath();
      ctx.moveTo(x, y - bh);
      ctx.quadraticCurveTo(x + frontW * 0.5, y - bh - 6, x + frontW, y - bh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.windowGlassDark;
      ctx.fillRect(x + frontW * 0.14, y - bh * 0.64, frontW * 0.72, bh * 0.64);
      ctx.fillStyle = pal.hangarInterior;
      ctx.fillRect(x + frontW * 0.22, y - bh * 0.40, frontW * 0.56, bh * 0.30);
    } else {
      if (style === "ops" || style === "terminal_annex") {
        const wx = x - frontW * 0.24;
        const wh = bh * 0.56;
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(wx, y - wh, frontW * 0.24, wh);
        ctx.fillStyle = pal.roofHighlight;
        ctx.fillRect(wx, y - wh, frontW * 0.24, 1);
      }
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x + frontW * 0.36, y - bh - 2.8, Math.max(4, frontW * 0.24), 2.2);
    }

    // 6. Subtle, slender architectural glazing ribbons (harmonious & understated)
    if (style !== "hangar_small") {
      for (let fl = 0; fl < floors; fl++) {
        const winY = y - bh * (0.34 + fl * 0.30);
        const winH = Math.max(1.3, bh * 0.08);
        const winX = x + 3;
        const winW = frontW - 6;
        if (winW > 4) {
          ctx.fillStyle = pal.windowGlassDark;
          ctx.fillRect(winX, winY - 0.5, winW, winH + 1.0);
          ctx.fillStyle = pal.windowGlow;
          ctx.fillRect(winX + 0.5, winY, winW - 1.0, winH);
          ctx.fillStyle = pal.archDark;
          for (let m = 1; m <= 3; m++) {
            ctx.fillRect(winX + (winW * m) / 4, winY - 0.3, 0.8, winH + 0.6);
          }
        }
      }
    }
    ctx.restore();
  },

  _drawHelipad(ctx, pad, pal) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.fillStyle = pal.runwayFill;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Crisp foreshortened 'H' marking
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -2.8);
    ctx.lineTo(-4, 2.8);
    ctx.moveTo(4, -2.8);
    ctx.lineTo(4, 2.8);
    ctx.moveTo(-4, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.restore();
  },

  _drawRunwayNetwork(ctx, w, L, pal) {
    ctx.save();
    const lHalf = 11;
    const rHalf = 32;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - lHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY - rHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY + rHalf);
    ctx.lineTo(L.rwLeftX, L.rwLeftY + lHalf);
    ctx.closePath();
    ctx.fillStyle = pal.runwayFill;
    ctx.fill();

    // Subtle runway edge lines
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - lHalf + 2);
    ctx.lineTo(L.rwRightX, L.rwRightY - rHalf + 4);
    ctx.moveTo(L.rwLeftX, L.rwLeftY + lHalf - 2);
    ctx.lineTo(L.rwRightX, L.rwRightY + rHalf - 4);
    ctx.stroke();

    // Piano-key runway threshold stripes & aiming blocks
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    [0.04, 0.91].forEach((tPos) => {
      const p = L.rwPt(tPos);
      const hw = 9 + tPos * 17;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rwAng);
      ctx.fillStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.36)" : "rgba(255, 255, 255, 0.66)";
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        ctx.fillRect(-5, k * (hw * 0.28) - 0.9, 9, 1.5);
      }
      ctx.restore();
    });

    const td = L.rwPt(0.14);
    ctx.save();
    ctx.translate(td.x, td.y);
    ctx.rotate(rwAng);
    ctx.fillStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.32)" : "rgba(255, 255, 255, 0.58)";
    ctx.fillRect(-6, -6.5, 12, 2.0);
    ctx.fillRect(-6, 4.5, 12, 2.0);
    ctx.restore();

    // Foreshortened runway centreline dashes
    ctx.strokeStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.42)" : "rgba(255, 255, 255, 0.74)";
    for (let i = 1; i < 15; i++) {
      const t0 = i / 16;
      const t1 = (i + 0.50) / 16;
      const p0 = L.rwPt(t0);
      const p1 = L.rwPt(t1);
      ctx.lineWidth = 0.9 + t0 * 1.6;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Open South Apron Taxiway Routing STRICTLY AROUND & BELOW Star Terminal (never under/over building roofs!)
    const exitPt = L.rwPt(L.rwExitT);
    const entryPt = L.rwPt(L.rwEntryT);
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    // 1. Arrival Exit Taxiway: Runway Exit -> East Apron -> Arched Hangar
    ctx.moveTo(exitPt.x, exitPt.y - 12);
    ctx.bezierCurveTo(
      exitPt.x + 36, exitPt.y - 26,
      L.apronEast.x + 28, L.apronEast.y + 18,
      L.apronEast.x, L.apronEast.y
    );
    ctx.quadraticCurveTo(L.hangarDoorX + 12, L.hangarDoorY + 18, L.hangarDoorX, L.hangarDoorY);

    // 2. Departure South Apron Taxiway: East Apron -> South of Star Terminal -> Runway Entry
    ctx.moveTo(L.apronEast.x, L.apronEast.y);
    ctx.bezierCurveTo(
      L.apronSE.x, L.apronSE.y,
      L.apronSouth.x, L.apronSouth.y,
      L.apronSW.x, L.apronSW.y
    );
    ctx.quadraticCurveTo(entryPt.x + 26, entryPt.y - 14, entryPt.x, entryPt.y - 6);
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.44)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Painted Helipads on Open East & West Aprons
    this._drawHelipad(ctx, L.heliPad1, pal);
    this._drawHelipad(ctx, L.heliPad2, pal);
  },

  _drawStarTerminal(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);

    // Soft cast ground shadow beneath terminal footprint
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(10, 12, 174, 34, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Subtle restrained warm architectural wash beneath concourse glazing (painterly, never garish)
    const underGlow = ctx.createRadialGradient(0, 5, 6, 0, 5, 138);
    underGlow.addColorStop(0, pal.isNightLights ? "rgba(253, 224, 152, 0.24)" : "rgba(255, 250, 236, 0.16)");
    underGlow.addColorStop(0.55, pal.isNightLights ? "rgba(251, 191, 36, 0.08)" : "rgba(255, 255, 255, 0.05)");
    underGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.ellipse(0, 7, 146, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    const arms = [
      { ax: -178, ay: 6, w: 13 },
      { ax: -116, ay: -20, w: 10 },
      { ax: 136, ay: -16, w: 10 },
      { ax: 182, ay: 16, w: 13 },
      { ax: 44, ay: 27, w: 11 }
    ];

    arms.forEach(a => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 11, a.ax, a.ay + 7);
      ctx.lineTo(a.ax, a.ay + 1.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 3, 0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.windowGlow;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.15, a.ay * 0.15 + 6.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.48 + 6.5, a.ax * 0.92, a.ay * 0.92 + 4.5);
      ctx.stroke();

      ctx.strokeStyle = pal.archMid;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.62, a.ay * 0.62 + 5);
      ctx.lineTo(a.ax * 0.62 + (a.ax > 0 ? 10 : -10), a.ay * 0.62 + 12);
      ctx.stroke();
    });

    // Stepped 2-tier sculpted central rotunda canopy
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.ellipse(2, 2, 62, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(0, -2, 56, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    arms.forEach(a => {
      const wg = ctx.createLinearGradient(0, -a.w, 0, a.w);
      wg.addColorStop(0, pal.archLight);
      wg.addColorStop(1, pal.archMid);
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(0, -a.w * 0.68);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.42 - a.w * 0.44, a.ax, a.ay);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.48 + a.w * 0.36, 0, a.w * 0.68);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.roofHighlight;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.43 - 1, a.ax * 0.95, a.ay * 0.95);
      ctx.stroke();
    });

    this._drawStarTerminalSpireGeometry(ctx, pal);
    ctx.restore();
  },

  _drawStarTerminalSpireGeometry(ctx, pal) {
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(0, -98);
    ctx.quadraticCurveTo(7, -34, 24, -1);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(0, -98);
    ctx.quadraticCurveTo(-5, -34, -22, -1);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.windowGlow;
    ctx.beginPath();
    ctx.ellipse(0, -14, 5.2, 11.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Redrawn cleanly after northern crawlerway vehicles so spire tip naturally stands IN FRONT of far crawlerway!
  _drawStarTerminalSpireOcclusion(ctx, L, pal) {
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(L.termScale, L.termScale);
    this._drawStarTerminalSpireGeometry(ctx, pal);
    ctx.restore();
  },

  _drawArchedHangarBase(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.hangarX + 12, y + hh * 0.56, hw * 0.54, hh * 0.24, 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.5);
    ctx.quadraticCurveTo(x + hw * 0.5, y - hh * 0.95, x + hw, y + hh * 0.5);
    ctx.lineTo(x + hw, y + hh * 0.55);
    ctx.lineTo(x, y + hh * 0.55);
    ctx.closePath();
    ctx.fill();

    const bayG = ctx.createRadialGradient(L.hangarDoorX, L.hangarDoorY, 4, L.hangarDoorX, L.hangarDoorY, hw * 0.46);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.beginPath();
    ctx.ellipse(L.hangarDoorX, L.hangarDoorY + 4, hw * 0.44, hh * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawArchedHangarOcclusionRoof(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    const roofG = ctx.createLinearGradient(x, y - hh * 0.65, x + hw, y + hh * 0.5);
    roofG.addColorStop(0, pal.archLight);
    roofG.addColorStop(0.55, pal.archMid);
    roofG.addColorStop(1, pal.archDark);

    ctx.fillStyle = roofG;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.52);
    ctx.lineTo(x, y + hh * 0.14);
    ctx.quadraticCurveTo(x + hw * 0.48, y - hh * 1.05, x + hw, y + hh * 0.08);
    ctx.lineTo(x + hw, y + hh * 0.54);
    ctx.lineTo(x + hw * 0.54, y + hh * 0.54);
    ctx.lineTo(x + hw * 0.52, y + hh * 0.04);
    ctx.quadraticCurveTo(x + hw * 0.30, y - hh * 0.16, x + hw * 0.08, y + hh * 0.08);
    ctx.lineTo(x + hw * 0.06, y + hh * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.14);
    ctx.quadraticCurveTo(x + hw * 0.48, y - hh * 1.05, x + hw * 0.72, y - hh * 0.18);
    ctx.stroke();

    ctx.strokeStyle = pal.isNightLights ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.42)";
    ctx.lineWidth = 0.9;
    for (let r = 1; r <= 4; r++) {
      const rx = x + hw * (0.52 + r * 0.10);
      ctx.beginPath();
      ctx.moveTo(rx, y - hh * 0.18 + r * 3.5);
      ctx.lineTo(rx + 6, y + hh * 0.52);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawRadomeAndATC(ctx, L, pal) {
    ctx.save();
    // Telemetry tracking dish beside radome
    const dx = L.radomeX - 24;
    const dy = L.radomeY + 4;
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(dx + 4, dy + 2, 7, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx, dy - 10);
    ctx.stroke();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.arc(dx - 1, dy - 12, 5.5, 0.4, Math.PI + 0.4);
    ctx.closePath();
    ctx.fill();

    // Geodesic Radome
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.radomeX + 6, L.radomeY + 4, 11, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(L.radomeX - 4.5, L.radomeY - 12, 9, 16);
    const radG = ctx.createRadialGradient(L.radomeX - 3, L.radomeY - 22, 1, L.radomeX, L.radomeY - 20, 12);
    radG.addColorStop(0, pal.archLight);
    radG.addColorStop(1, pal.archDark);
    ctx.fillStyle = radG;
    ctx.beginPath();
    ctx.arc(L.radomeX, L.radomeY - 20, 10, 0, Math.PI * 2);
    ctx.fill();

    // Tall Sculpted Double-Deck ATC Control Tower
    const ax = L.atcX;
    const ay = L.atcY + 8;
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(ax + 6, ay);
    ctx.lineTo(ax + 32, ay + 6);
    ctx.lineTo(ax + 34, ay + 11);
    ctx.lineTo(ax - 4, ay + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 6.5, ay);
    ctx.lineTo(ax - 3.8, ay - 56);
    ctx.lineTo(ax + 0.5, ay - 56);
    ctx.lineTo(ax + 1, ay);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(ax + 1, ay);
    ctx.lineTo(ax + 0.5, ay - 56);
    ctx.lineTo(ax + 4.8, ay - 56);
    ctx.lineTo(ax + 6.5, ay);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 9, ay - 51, 18, 3.5);
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 11.5, ay - 63);
    ctx.lineTo(ax + 11.5, ay - 63);
    ctx.lineTo(ax + 8.5, ay - 51);
    ctx.lineTo(ax - 8.5, ay - 51);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(ax - 9, ay - 61, 18, 5.5);
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(ax - 8, ay - 60, 16, 4.0);

    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 12, ay - 65, 24, 2.2);
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 65);
    ctx.lineTo(ax, ay - 78);
    ctx.stroke();
    ctx.restore();
  },

  _drawForegroundBridgeAndCoast(ctx, w, h, L, pal) {
    ctx.save();
    const p0x = w * 0.65;
    const p0y = L.islandBotY + 12;
    const cpx = w * 0.60;
    const cpy = h * 0.90;
    const p2x = w * 0.92;
    const p2y = h + 8;

    for (let i = 1; i <= 7; i++) {
      const t = i / 8;
      const inv = 1 - t;
      const px = inv * inv * p0x + 2 * inv * t * cpx + t * t * p2x;
      const py = inv * inv * p0y + 2 * inv * t * cpy + t * t * p2y;
      const pierH = 26 + t * 28;
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(px - 2.5, py + 4, 5, pierH);
      ctx.fillStyle = pal.isNightLights ? "rgba(254, 215, 130, 0.14)" : "rgba(255,255,255,0.16)";
      ctx.fillRect(px - 1.5, py + pierH, 3, 24);
    }

    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(p0x, p0y + 4);
    ctx.quadraticCurveTo(cpx, cpy + 5, p2x, p2y + 5);
    ctx.stroke();

    ctx.strokeStyle = pal.archMid;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(p0x, p0y);
    ctx.quadraticCurveTo(cpx, cpy, p2x, p2y);
    ctx.stroke();

    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p0x - 4, p0y - 2);
    ctx.quadraticCurveTo(cpx - 5, cpy - 2, p2x - 5, p2y - 2);
    ctx.stroke();

    if (pal.lightIntensity > 0.25) {
      for (let i = 1; i <= 7; i++) {
        const t = i / 8;
        const inv = 1 - t;
        const lx = inv * inv * p0x + 2 * inv * t * cpx + t * t * p2x;
        const ly = inv * inv * p0y + 2 * inv * t * cpy + t * t * p2y - 3;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 9);
        lg.addColorStop(0, `rgba(254, 224, 150, ${(0.82 * pal.lightIntensity).toFixed(3)})`);
        lg.addColorStop(1, "rgba(254, 224, 150, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Lush foreground coastal hillside framing bottom-left
    ctx.fillStyle = pal.foliage;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.08, h * 0.78, w * 0.16, h * 0.86);
    ctx.quadraticCurveTo(w * 0.28, h * 0.91, w * 0.42, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  _drawLatticeTower(ctx, cx, baseY, width, height, strokeColor, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    const left = cx - width * 0.5;
    const right = cx + width * 0.5;
    const top = baseY - height;

    ctx.beginPath();
    ctx.moveTo(left, baseY);
    ctx.lineTo(left + 1.2, top);
    ctx.moveTo(right, baseY);
    ctx.lineTo(right - 1.2, top);
    ctx.stroke();

    const bays = Math.max(8, Math.floor(height / 15));
    ctx.lineWidth = 0.9;
    for (let b = 0; b < bays; b++) {
      const y0 = baseY - (b / bays) * height;
      const y1 = baseY - ((b + 1) / bays) * height;
      ctx.beginPath();
      ctx.moveTo(left, y0);
      ctx.lineTo(right, y1);
      ctx.moveTo(right, y0);
      ctx.lineTo(left, y1);
      ctx.moveTo(left, y1);
      ctx.lineTo(right, y1);
      ctx.stroke();
    }

    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - 14);
    ctx.stroke();
    ctx.restore();
  },

  // Pre-built non-overlapping arc-length paths for Spaceplane fleet!
  _getTaxiToRunwayPath(L) {
    const entryPt = L.rwPt(L.rwEntryT);
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const pStart = { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
    const pEast = L.apronEast;
    const pSW = L.apronSW;
    const pHold = { x: entryPt.x - Math.cos(rwAng) * 14, y: entryPt.y - Math.sin(rwAng) * 14 };
    return this._buildArcPath([
      [
        pStart,
        { x: L.hangarDoorX - 8, y: L.hangarDoorY + 26 },
        { x: pEast.x + 12, y: pEast.y - 16 },
        pEast
      ],
      [
        pEast,
        L.apronSE,
        L.apronSouth,
        pSW
      ],
      [
        pSW,
        { x: (pSW.x + pHold.x) * 0.5, y: pSW.y + 8 },
        { x: pHold.x + 18, y: pHold.y - 16 },
        pHold
      ]
    ], 36);
  },

  _getTaxiToHangarPath(L) {
    const exitPt = L.rwPt(L.rwExitT);
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const dirX = Math.cos(rwAng);
    const dirY = Math.sin(rwAng);
    const pEast = L.apronEast;
    const pInside = { x: L.hangarX + 26, y: L.hangarDoorY - 5 };
    return this._buildArcPath([
      [
        exitPt,
        { x: exitPt.x + dirX * 48, y: exitPt.y + dirY * 48 },
        { x: pEast.x + 42, y: pEast.y + 26 },
        pEast
      ],
      [
        pEast,
        { x: pEast.x + 10, y: pEast.y - 22 },
        { x: L.hangarDoorX - 12, y: L.hangarDoorY + 14 },
        pInside
      ]
    ], 38);
  },

  _getApronShuttleOutPath(L) {
    const pStart = { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
    const pEast = L.apronEast;
    const pStand = { x: L.termX - 72 * L.termScale, y: L.termY + 56 * L.termScale };
    return this._buildArcPath([
      [
        pStart,
        { x: L.hangarDoorX - 8, y: L.hangarDoorY + 26 },
        { x: pEast.x + 12, y: pEast.y - 16 },
        pEast
      ],
      [
        pEast,
        L.apronSE,
        L.apronSouth,
        pStand
      ]
    ], 36);
  },

  _getApronShuttleReturnPath(L) {
    const pStand = { x: L.termX - 72 * L.termScale, y: L.termY + 56 * L.termScale };
    const pEast = L.apronEast;
    const pInside = { x: L.hangarX + 26, y: L.hangarDoorY - 5 };
    return this._buildArcPath([
      [
        pStand,
        { x: L.termX, y: L.termY + 66 * L.termScale },
        { x: L.apronSE.x + 10, y: L.apronSE.y + 4 },
        pEast
      ],
      [
        pEast,
        { x: pEast.x + 10, y: pEast.y - 22 },
        { x: L.hangarDoorX - 12, y: L.hangarDoorY + 14 },
        pInside
      ]
    ], 36);
  },

  _getTakeoffClimbPath(L, w, h, sp) {
    const liftPt = L.rwPt(0.70);
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const dirX = Math.cos(rwAng);
    const dirY = Math.sin(rwAng);
    const endY = h * (0.06 + (sp.id === "sp_flight_2" ? 0.04 : 0));
    return this._buildArcPath([
      [
        liftPt,
        { x: liftPt.x + dirX * 140, y: liftPt.y + dirY * 140 - 18 },
        { x: w * 0.85, y: liftPt.y * 0.56 },
        { x: w + 110, y: endY }
      ]
    ], 56);
  },

  _getApproachPath(L) {
    const tdPt = L.rwPt(0.14);
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const dirX = Math.cos(rwAng);
    const dirY = Math.sin(rwAng);
    const startPt = { x: -100, y: L.horizonY - 46 };
    return this._buildArcPath([
      [
        startPt,
        { x: tdPt.x * 0.25, y: startPt.y + (tdPt.y - startPt.y) * 0.42 },
        { x: tdPt.x - dirX * 115, y: tdPt.y - dirY * 115 - 14 },
        tdPt
      ]
    ], 56);
  },

  _getHeliPatrolPath(L, w, h, pad, variant) {
    const hover = { x: pad.x, y: pad.y - 28 };
    if (variant === 0) {
      // Sweeping island & bay perimeter patrol: East Pad -> Over Launch Towers -> South Bay Channel -> Return
      const p1 = { x: w * 0.52, y: L.islandTopY - 22 };
      const p2 = { x: L.padX - 45, y: L.padY - 56 };
      const p3 = { x: w * 0.28, y: L.islandBotY + 42 };
      const p4 = { x: w * 0.62, y: L.islandBotY + 18 };
      return this._buildArcPath([
        [hover, { x: w * 0.78, y: L.islandTopY - 38 }, { x: w * 0.64, y: L.islandTopY - 26 }, p1],
        [p1, { x: w * 0.36, y: L.islandTopY - 18 }, { x: L.padX + 20, y: L.padY - 72 }, p2],
        [p2, { x: L.padX - 85, y: L.padY + 25 }, { x: w * 0.14, y: L.islandBotY + 12 }, p3],
        [p3, { x: w * 0.40, y: L.islandBotY + 62 }, { x: w * 0.52, y: L.islandBotY + 42 }, p4],
        [p4, { x: w * 0.78, y: L.islandBotY - 20 }, { x: hover.x + 18, y: hover.y + 42 }, hover]
      ], 28);
    }
    // Southern coastal channel & terminal escort circuit
    const p1 = { x: w * 0.48, y: L.islandBotY + 38 };
    const p2 = { x: w * 0.78, y: L.termY + 46 };
    const p3 = { x: w * 0.52, y: L.islandTopY + 10 };
    return this._buildArcPath([
      [hover, { x: w * 0.34, y: L.islandBotY + 18 }, { x: w * 0.40, y: L.islandBotY + 44 }, p1],
      [p1, { x: w * 0.62, y: L.islandBotY + 28 }, { x: w * 0.78, y: L.islandBotY - 30 }, p2],
      [p2, { x: w * 0.78, y: L.islandTopY + 6 }, { x: w * 0.64, y: L.islandTopY - 4 }, p3],
      [p3, { x: w * 0.36, y: L.islandTopY + 26 }, { x: hover.x - 16, y: hover.y - 38 }, hover]
    ], 28);
  },

  ensureEntities(w, h, now) {
    const L = this.getLayout(w, h);
    const rwAngle = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);

    if (this.stars.length === 0) {
      const count = w < 720 ? 36 : 66;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.34),
          r: 0.6 + Math.random() * 1.15,
          phase: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.03
        });
      }
    }

    if (this.clouds.length === 0) {
      for (let i = 0; i < 6; i++) {
        this.clouds.push({
          x: Math.random() * w,
          y: 22 + Math.random() * (h * 0.19),
          rx: 78 + Math.random() * 120,
          ry: 13 + Math.random() * 14,
          vx: 0.06 + Math.random() * 0.10
        });
      }
    }

    if (this.cirrus.length === 0) {
      for (let i = 0; i < 7; i++) {
        this.cirrus.push({
          x: Math.random() * w,
          y: 16 + Math.random() * (L.horizonY * 0.72),
          len: 95 + Math.random() * 165,
          curve: (Math.random() - 0.5) * 24,
          vx: 0.04 + Math.random() * 0.06,
          alpha: 0.13 + Math.random() * 0.15
        });
      }
    }

    if (this.waterGlints.length === 0) {
      const count = w < 720 ? 28 : 44;
      for (let i = 0; i < count; i++) {
        const isUpper = i < count * 0.62;
        this.waterGlints.push({
          zone: isUpper ? "upper" : "lower",
          xFrac: Math.random(),
          yFrac: Math.random(),
          len: 10 + Math.random() * 24,
          vx: (isUpper ? 0.006 : 0.010) * (0.6 + Math.random() * 0.8),
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    // Realistic maritime fleet in BOTH upper bay and foreground sea channel!
    if (this.ships.length === 0) {
      this.ships = [
        { kind: "recovery_ship", zone: "lower", x: w * 0.28, y: h * 0.82, vx: 4.2, minX: w * 0.10, maxX: w * 0.56, scale: 1.0 },
        { kind: "ferry", zone: "lower", x: w * 0.50, y: h * 0.90, vx: -5.4, minX: w * 0.18, maxX: w * 0.60, scale: 0.85 },
        { kind: "cargo_far", zone: "upper", x: w * 0.42, y: L.horizonY + (L.islandTopY - L.horizonY) * 0.48, vx: 2.2, minX: w * 0.05, maxX: w * 0.92, scale: 0.56 },
        { kind: "cargo_far", zone: "upper", x: w * 0.74, y: L.horizonY + (L.islandTopY - L.horizonY) * 0.32, vx: -1.8, minX: w * 0.08, maxX: w * 0.94, scale: 0.44 }
      ];
      this.boats = this.ships;
    }

    // Patrol & Transport Helicopters taking off, landing & patrolling around the spaceport!
    if (this.helicopters.length === 0) {
      const p1Path = this._getHeliPatrolPath(L, w, h, L.heliPad1, 0);
      const startPt = this._sampleArcPath(p1Path, p1Path.totalLen * 0.18);
      this.helicopters = [
        {
          id: "heli_patrol_1",
          padIdx: 0,
          phase: "patrol",
          t: 0,
          phaseDuration: this._rand(8, 14),
          dist: p1Path.totalLen * 0.18,
          speed: 25,
          x: startPt.x,
          y: startPt.y,
          altitude: 28,
          heading: startPt.angle,
          rotorSpeed: 1.0,
          rotorPhase: 0
        },
        {
          id: "heli_transport_2",
          padIdx: 1,
          phase: "pad_idle",
          t: 2.0,
          phaseDuration: this._rand(7, 15),
          dist: 0,
          speed: 0,
          x: L.heliPad2.x,
          y: L.heliPad2.y,
          altitude: 0,
          heading: 0.15,
          rotorSpeed: 0.25,
          rotorPhase: 1.4
        }
      ];
    }

    if (!this.rocket) {
      this.rocket = {
        phase: "tow_out",
        t: 7.5,
        phaseDuration: this._rand(24.0, 30.0),
        armClose: 0.0,
        variant: this._pick(["heavy_starship", "orbital_cargo"]),
        x: 0,
        y: 0,
        angle: -Math.PI * 0.5
      };
    }

    if (this.spaceplanes.length === 0) {
      const depPath = this._getTaxiToRunwayPath(L);
      const aprPath = this._getApronShuttleOutPath(L);
      const sp0Start = this._sampleArcPath(depPath, depPath.totalLen * 0.42);
      const sp2Start = this._sampleArcPath(aprPath, aprPath.totalLen * 0.30);

      this.spaceplanes = [
        {
          id: "sp_flight_1",
          role: "runway",
          variant: "starliner",
          phase: "taxi_to_runway",
          t: 0,
          phaseDuration: 55.0,
          dist: depPath.totalLen * 0.42,
          speed: 8.5,
          x: sp0Start.x,
          y: sp0Start.y,
          heading: sp0Start.angle,
          altitude: 0,
          chuteDetached: false,
          detachedChuteX: 0,
          detachedChuteY: 0,
          detachedChuteAlpha: 0
        },
        {
          id: "sp_flight_2",
          role: "runway",
          variant: "airliner",
          phase: "approach",
          t: 0,
          phaseDuration: 8.0,
          dist: 60,
          speed: 68,
          x: -50,
          y: L.horizonY - 20,
          heading: rwAngle,
          altitude: 22,
          chuteDetached: false,
          detachedChuteX: 0,
          detachedChuteY: 0,
          detachedChuteAlpha: 0
        },
        {
          id: "sp_apron_3",
          role: "apron",
          variant: "clipper",
          phase: "apron_taxi_out",
          t: 0,
          phaseDuration: 45.0,
          dist: aprPath.totalLen * 0.30,
          speed: 8.0,
          x: sp2Start.x,
          y: sp2Start.y,
          heading: sp2Start.angle,
          altitude: 0,
          chuteDetached: false,
          detachedChuteX: 0,
          detachedChuteY: 0,
          detachedChuteAlpha: 0
        }
      ];
      this.spaceplane = this.spaceplanes[0];
    }

    if (!this.fogState.nextCheck) {
      const roll = Math.random() < 0.58;
      this.fogState.active = roll;
      this.fogState.targetAlpha = roll ? (0.38 + Math.random() * 0.24) : 0;
      this.fogState.nextCheck = now + 18000;
    }
  },

  pulseActivity({ kind = "complete" } = {}) {
    if (this.rocket && (this.rocket.phase === "arm_swing" || this.rocket.phase === "erect") && this.rocket.t > 1.2) {
      this.rocket.phase = "launch";
      this.rocket.t = 0;
      this.rocket.phaseDuration = this._rand(12.0, 14.5);
    } else if (this.spaceplanes.length > 0) {
      const idle = this.spaceplanes.find(sp => sp.role === "runway" && (sp.phase === "hangar_rest" || sp.phase === "sky_wait") && sp.t > 0.8);
      if (idle) {
        idle.phase = idle.phase === "hangar_rest" ? "hangar_emerge" : "approach";
        idle.t = 0;
        idle.dist = 0;
        idle.speed = idle.phase === "approach" ? 72 : 0;
        idle.phaseDuration = idle.phase === "hangar_emerge" ? this._rand(9.0, 12.0) : 9.0;
      }
    }

    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const count = (kind === "queue_clear" || kind === "finalise") ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.orbiters.push({
        x: w * (0.12 + Math.random() * 0.35),
        y: 18 + Math.random() * (h * 0.18),
        vx: 4.0 + Math.random() * 2.8,
        vy: 0.4 + Math.random() * 0.6,
        life: 0,
        maxLife: 54
      });
    }
  },

  draw(ctx, w, h, mode, dt, step) {
    this._lastW = w;
    this._lastH = h;
    this._lastMode = mode;

    const now = performance.now();
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h, now);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached 2.5D coastal spaceport complex
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Subtle Animated Sky & Clipped Water Shimmer
    this._drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step);

    // 3. Ships Gliding Across Upper Archipelago Bay & Lower Sea Channel
    this._updateAndDrawShips(ctx, w, h, L, pal, dt, step);

    // 4. Orbital Streaks
    if (this.orbiters.length > 0) {
      const aliveOrb = [];
      ctx.save();
      for (let i = 0; i < this.orbiters.length; i++) {
        const o = this.orbiters[i];
        o.x += o.vx * (dt * 60);
        o.y += o.vy * (dt * 60);
        o.life += dt * 60;
        if (o.life >= o.maxLife) continue;
        aliveOrb.push(o);
        const a = Math.sin((o.life / o.maxLife) * Math.PI) * (pal.isNightLights ? 0.85 : 0.40);
        const grad = ctx.createLinearGradient(o.x - o.vx * 12, o.y - o.vy * 12, o.x, o.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(o.x - o.vx * 12, o.y - o.vy * 12);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
      ctx.restore();
      this.orbiters = aliveOrb;
    }

    // 5. Dynamic Complex Lights
    this._drawComplexLights(ctx, L, pal, step);

    // 6. Rocket Full Lifecycle along far northern crawlerway (behind Star Terminal Spire!)
    this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);

    // 7. Foreground Star Terminal Spire Occlusion (stands proudly in front of northern crawlerway!)
    this._drawStarTerminalSpireOcclusion(ctx, L, pal);

    // 8. Concurrent Arc-Length Kinematic Spaceplane Fleet
    this._updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h);

    // 9. Foreground Hangar Arch Occlusion Layer
    this._drawArchedHangarOcclusionRoof(ctx, L, pal);

    // 10. Patrol & Transport Helicopters Taking Off, Landing & Patrolling Around Base
    this._updateAndDrawHelicopters(ctx, w, h, L, pal, dt, step);

    // 11. Exhaust Smoke & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 12. Probabilistic Rolling Dawn Fog (morning mode)
    this._updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now);
  },

  _drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step) {
    const scaleDt = dt * 60;

    if (mode === "dark" || mode === "evening") {
      const maxA = mode === "dark" ? 0.65 : 0.24;
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.phase += s.speed * scaleDt;
        const a = maxA * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase)));
        ctx.fillStyle = `rgba(226, 232, 240, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    const cirrusRgb = mode === "morning" ? "255, 224, 200" : (mode === "evening" ? "253, 186, 140" : (mode === "dark" ? "148, 178, 214" : "255, 255, 255"));
    const cirrusScale = mode === "dark" ? 0.36 : (mode === "evening" ? 0.50 : 0.85);
    for (let i = 0; i < this.cirrus.length; i++) {
      const c = this.cirrus[i];
      c.x += c.vx * scaleDt;
      if (c.x - 40 > w) c.x = -c.len - 40;
      ctx.strokeStyle = `rgba(${cirrusRgb}, ${(c.alpha * cirrusScale).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.quadraticCurveTo(c.x + c.len * 0.5, c.y + c.curve, c.x + c.len, c.y + Math.sin(step * 0.2 + i) * 3);
      ctx.stroke();
    }

    if (mode !== "dark") {
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.x += c.vx * scaleDt;
        if (c.x - c.rx > w + 40) c.x = -c.rx - 40;
        const g = ctx.createRadialGradient(c.x, c.y, c.ry * 0.2, c.x, c.y, c.rx);
        const rgb = mode === "morning" ? "255, 235, 218" : (mode === "evening" ? "253, 200, 175" : "255, 255, 255");
        const maxC = mode === "evening" ? 0.14 : 0.26;
        g.addColorStop(0, `rgba(${rgb}, ${maxC})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    const sunX = w * 0.11;
    // Upper Bay Shimmer
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.horizonY + 2, w, Math.max(8, (L.islandTopY - 12) - L.horizonY));
    ctx.clip();
    ctx.lineCap = "round";
    for (let i = 0; i < this.waterGlints.length; i++) {
      const g = this.waterGlints[i];
      if (g.zone !== "upper") continue;
      g.xFrac = (g.xFrac + g.vx * dt) % 1;
      g.phase += dt * 1.4;
      const gx = g.xFrac * w;
      const gy = L.horizonY + 4 + g.yFrac * Math.max(10, (L.islandTopY - L.horizonY - 18));
      const inSunCol = Math.max(0, 1 - Math.abs(gx - sunX) / (w * 0.18));
      const pulse = 0.45 + 0.55 * Math.sin(g.phase);
      const a = (0.05 + inSunCol * 0.22) * pulse * (mode === "dark" ? 0.62 : 1.0);
      ctx.strokeStyle = `rgba(${pal.waterShimmerRgb}, ${a.toFixed(3)})`;
      ctx.lineWidth = 0.9 + g.yFrac * 0.8;
      ctx.beginPath();
      ctx.moveTo(gx - g.len * 0.5, gy);
      ctx.lineTo(gx + g.len * 0.5, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Lower Channel Shimmer (clipped strictly below seawall)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 78);
    ctx.lineTo(w * 0.12, L.islandBotY - 34);
    ctx.lineTo(w * 0.61, L.islandBotY + 34);
    ctx.lineTo(w * 0.68, h + 10);
    ctx.lineTo(-20, h + 10);
    ctx.closePath();
    ctx.clip();
    ctx.lineCap = "round";
    for (let i = 0; i < this.waterGlints.length; i++) {
      const g = this.waterGlints[i];
      if (g.zone !== "lower") continue;
      g.xFrac = (g.xFrac + g.vx * dt) % 1;
      g.phase += dt * 1.25;
      const gx = g.xFrac * (w * 0.68);
      const gy = (L.islandTopY + 84) + g.yFrac * (h - (L.islandTopY + 84));
      const pulse = 0.4 + 0.6 * Math.sin(g.phase);
      const a = 0.12 * pulse * (mode === "dark" ? 0.55 : 0.88);
      ctx.strokeStyle = `rgba(${pal.waterShimmerRgb}, ${a.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx - g.len * 0.6, gy);
      ctx.lineTo(gx + g.len * 0.6, gy);
      ctx.stroke();
    }
    ctx.restore();
  },

  _updateAndDrawShips(ctx, w, h, L, pal, dt, step) {
    ctx.save();
    for (let i = 0; i < this.ships.length; i++) {
      const s = this.ships[i];
      s.x += s.vx * dt;
      if (s.x > s.maxX) s.vx = -Math.abs(s.vx);
      if (s.x < s.minX) s.vx = Math.abs(s.vx);

      const dir = s.vx >= 0 ? 1 : -1;
      const sc = s.scale;
      const hazeAlpha = s.zone === "upper" ? 0.62 : 0.96;

      ctx.save();
      ctx.globalAlpha = hazeAlpha;
      ctx.translate(s.x, s.y);

      // Soft V-shaped foaming sea wake behind ship
      const wakeLen = s.kind === "recovery_ship" ? 44 * sc : (s.kind === "ferry" ? 30 * sc : 22 * sc);
      const wakeGrad = ctx.createLinearGradient(0, 0, -dir * wakeLen, 0);
      wakeGrad.addColorStop(0, pal.isNightLights ? "rgba(186, 230, 253, 0.28)" : "rgba(255, 255, 255, 0.42)");
      wakeGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = wakeGrad;
      ctx.lineWidth = 1.1 * sc;
      ctx.beginPath();
      ctx.moveTo(-dir * 12 * sc, 1);
      ctx.lineTo(-dir * (12 * sc + wakeLen), -4.5 * sc);
      ctx.moveTo(-dir * 12 * sc, 1);
      ctx.lineTo(-dir * (12 * sc + wakeLen), 4.5 * sc);
      ctx.stroke();

      if (dir < 0) ctx.scale(-1, 1);
      ctx.scale(sc, sc);

      // Soft reflection under waterline
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(0, 4.5, s.kind === "recovery_ship" ? 19 : 13, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (s.kind === "recovery_ship") {
        // Orbital Booster Recovery / Support Vessel (flat aft deck + forward bridge superstructure)
        ctx.fillStyle = pal.shipHull;
        ctx.beginPath();
        ctx.moveTo(-18, -1);
        ctx.lineTo(15, -1.5);
        ctx.lineTo(20, -3.5);
        ctx.lineTo(17, 3);
        ctx.lineTo(-17, 3);
        ctx.closePath();
        ctx.fill();
        // Flat grey recovery deck & subtle helideck circle aft
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(-16, -2.5, 20, 1.8);
        // Forward white/slate deckhouse bridge & radar mast
        ctx.fillStyle = pal.shipSuper;
        ctx.fillRect(5, -7.5, 8, 6);
        ctx.fillStyle = pal.windowGlassDark;
        ctx.fillRect(9.5, -6.5, 3, 2.2);
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(8, -7.5);
        ctx.lineTo(8, -12.5);
        ctx.stroke();
      } else if (s.kind === "ferry") {
        // Sleek Coastal Crew Ferry / Patrol Cutter
        ctx.fillStyle = pal.shipHull;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(10, -0.5);
        ctx.lineTo(14, -2);
        ctx.lineTo(11, 2.5);
        ctx.lineTo(-11, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.shipSuper;
        ctx.beginPath();
        ctx.moveTo(-6, -1);
        ctx.lineTo(-3, -5);
        ctx.lineTo(6, -5);
        ctx.lineTo(9, -1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.windowGlow;
        ctx.fillRect(-2, -3.8, 7.5, 1.4);
      } else {
        // Distant Archipelago Cargo Freighter silhouette
        ctx.fillStyle = pal.shipHull;
        ctx.fillRect(-14, -1.5, 28, 3.5);
        ctx.fillStyle = pal.shipSuper;
        ctx.fillRect(6, -6, 6, 4.5);
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(-10, -4, 14, 2.5);
      }

      // Warm maritime mast & navigation lights at evening/night
      if (pal.isNightLights) {
        ctx.fillStyle = "rgba(254, 232, 168, 0.9)";
        ctx.beginPath();
        ctx.arc(s.kind === "recovery_ship" ? 8 : 4, s.kind === "recovery_ship" ? -12.5 : -6, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.sin(step * 4 + i) > 0 ? "#34D399" : "#F87171";
        ctx.beginPath();
        ctx.arc(s.kind === "recovery_ship" ? 12 : 8, -2, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawHelicopters(ctx, w, h, L, pal, dt, step) {
    const pads = [L.heliPad1, L.heliPad2];
    for (let i = 0; i < this.helicopters.length; i++) {
      const hel = this.helicopters[i];
      hel.t += dt;
      const pad = pads[hel.padIdx % pads.length];
      let targetRotor = 0.2;
      let targetHeading = hel.heading;

      if (hel.phase === "pad_idle") {
        hel.x = pad.x;
        hel.y = pad.y;
        hel.altitude = 0;
        hel.speed = 0;
        const spool = hel.t > hel.phaseDuration - 2.5 ? ((hel.t - (hel.phaseDuration - 2.5)) / 2.5) : 0;
        targetRotor = 0.20 + spool * 0.80;
        if (hel.t >= hel.phaseDuration) {
          hel.phase = "takeoff";
          hel.t = 0;
          hel.phaseDuration = this._rand(4.2, 5.6);
        }
      } else if (hel.phase === "takeoff") {
        targetRotor = 1.0;
        const p = Math.min(1, hel.t / hel.phaseDuration);
        const ease = p * p * (3 - 2 * p);
        hel.x = pad.x;
        hel.y = pad.y - ease * 28;
        hel.altitude = ease * 28;
        if (hel.t >= hel.phaseDuration) {
          hel.phase = "patrol";
          hel.t = 0;
          hel.dist = 0;
          hel.speed = 0;
        }
      } else if (hel.phase === "patrol") {
        targetRotor = 1.0;
        const path = this._getHeliPatrolPath(L, w, h, pad, hel.padIdx);
        const cruiseSpeed = 24;
        const rem = path.totalLen - hel.dist;
        // Smooth velocity ramp up from 0 at takeoff hover and smooth deceleration to 0 right over target pad!
        let desiredSpeed = cruiseSpeed;
        if (hel.dist < 60) desiredSpeed = Math.max(4, cruiseSpeed * (hel.dist / 60));
        if (rem < 75) desiredSpeed = Math.max(3, cruiseSpeed * (rem / 75));
        hel.speed += (desiredSpeed - hel.speed) * Math.min(1, dt * 3.0);
        hel.dist += hel.speed * dt;
        const sample = this._sampleArcPath(path, hel.dist);
        hel.x = sample.x;
        hel.y = sample.y;
        hel.altitude = 28 + Math.sin((hel.dist / path.totalLen) * Math.PI) * 16;
        targetHeading = sample.angle;
        if (hel.dist >= path.totalLen - 2) {
          hel.phase = "touchdown";
          hel.t = 0;
          hel.phaseDuration = this._rand(4.5, 5.8);
        }
      } else {
        // Gentle vertical touchdown onto the helipad
        const p = Math.min(1, hel.t / hel.phaseDuration);
        const ease = p * p * (3 - 2 * p);
        hel.x = pad.x;
        hel.y = (pad.y - 28) + ease * 28;
        hel.altitude = (1 - ease) * 28;
        targetRotor = 1.0 - Math.max(0, (p - 0.72) / 0.28) * 0.75;
        targetHeading = hel.padIdx === 0 ? Math.PI : 0;
        if (hel.t >= hel.phaseDuration) {
          hel.phase = "pad_idle";
          hel.t = 0;
          hel.phaseDuration = this._rand(7.0, 16.0);
        }
      }

      hel.heading = this._lerpAngle(hel.heading, targetHeading, Math.min(1, dt * 4.0));
      hel.rotorSpeed += (targetRotor - hel.rotorSpeed) * Math.min(1, dt * 3.5);
      hel.rotorPhase += dt * (4 + hel.rotorSpeed * 32);

      // 1. Cast ground/water shadow projected downward by altitude
      const shadowFade = Math.max(0.14, 1 - hel.altitude / 75);
      ctx.save();
      ctx.translate(hel.x + hel.altitude * 0.16, hel.y + hel.altitude + 2);
      ctx.fillStyle = pal.shadowColor;
      ctx.globalAlpha = 0.52 * shadowFade;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Helicopter Body & Spinning Rotor Disc
      const facingLeft = Math.cos(hel.heading) < 0;
      const nosePitch = hel.phase === "patrol" ? (facingLeft ? -0.10 : 0.10) : 0;

      ctx.save();
      ctx.translate(hel.x, hel.y);

      // Subtle downward patrol searchlight beam at evening/night when airborne
      if (pal.isNightLights && hel.altitude > 10) {
        ctx.save();
        const beamDir = facingLeft ? -1 : 1;
        const sg = ctx.createLinearGradient(0, 2, beamDir * 24, hel.altitude + 14);
        sg.addColorStop(0, "rgba(254, 249, 215, 0.34)");
        sg.addColorStop(1, "rgba(254, 249, 215, 0)");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.moveTo(beamDir * 4, 2);
        ctx.lineTo(beamDir * 36 - 10, hel.altitude + 14);
        ctx.lineTo(beamDir * 36 + 10, hel.altitude + 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.rotate(nosePitch);
      if (facingLeft) ctx.scale(-1, 1);

      // Landing skids
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-4, 4.2);
      ctx.lineTo(5.5, 4.2);
      ctx.moveTo(-2, 2.2);
      ctx.lineTo(-2.5, 4.2);
      ctx.moveTo(3, 2.2);
      ctx.lineTo(3.5, 4.2);
      ctx.stroke();

      // Slender tail boom & tail rotor fin
      ctx.fillStyle = pal.bodyShade;
      ctx.beginPath();
      ctx.moveTo(-4, -0.5);
      ctx.lineTo(-13, -1.6);
      ctx.lineTo(-13, 0.4);
      ctx.lineTo(-4, 1.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.liveryAccent;
      ctx.beginPath();
      ctx.moveTo(-11.5, -1.2);
      ctx.lineTo(-14.5, -4.5);
      ctx.lineTo(-13, -4.5);
      ctx.lineTo(-10.2, -1.2);
      ctx.closePath();
      ctx.fill();

      // Sculpted helicopter fuselage & tinted cockpit canopy
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.ellipse(1.5, 0, 7.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.windowGlassDark;
      ctx.beginPath();
      ctx.ellipse(5.4, -0.5, 2.8, 1.7, 0.2, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

      // Main rotor mast + translucent spinning rotor blur disc + sweeping blade glint!
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(1, -3);
      ctx.lineTo(1, -5.2);
      ctx.stroke();

      ctx.fillStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.16)" : "rgba(71, 85, 105, 0.16)";
      ctx.beginPath();
      ctx.ellipse(1, -5.2, 13.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();

      const bx = Math.cos(hel.rotorPhase) * 13.5;
      const by = Math.sin(hel.rotorPhase) * 2.4;
      ctx.strokeStyle = pal.isNightLights ? "rgba(248, 250, 252, 0.48)" : "rgba(51, 65, 85, 0.48)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(1 - bx, -5.2 - by);
      ctx.lineTo(1 + bx, -5.2 + by);
      ctx.stroke();

      // Anti-collision belly/tail beacon
      if (Math.sin(step * 10 + i * 2) > 0.35) {
        ctx.fillStyle = "#F87171";
        ctx.beginPath();
        ctx.arc(-13.5, -4.6, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _drawComplexLights(ctx, L, pal, step) {
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.4);
    const beaconA = pal.isNightLights ? (0.48 + 0.52 * pulse) : (0.16 + 0.22 * pulse);

    ctx.save();
    const beacons = [
      { x: L.towerLeftX, y: L.padY - L.towerH - 14 },
      { x: L.towerRightX, y: L.padY - L.towerH - 14 },
      { x: L.termX, y: L.termY - 98 * L.termScale },
      { x: L.atcX, y: L.atcY - 70 }
    ];
    beacons.forEach(b => {
      const r = pal.isNightLights ? 9 : 4.5;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, `rgba(248, 113, 113, ${beaconA.toFixed(3)})`);
      g.addColorStop(1, "rgba(248, 113, 113, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (pal.lightIntensity > 0.28) {
      const rabbit = Math.floor(step * 11) % 12;
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const pt = L.rwPt(t);
        const hw = 11 + t * 21;
        const isRabbit = i === rabbit;
        const rgb = i < 2 ? "52, 211, 153" : (isRabbit ? "255, 255, 255" : "254, 226, 155");
        const a = (isRabbit ? 0.88 : 0.52) * pal.lightIntensity;
        const rad = (1.5 + t * 1.5) * 2.6;
        [pt.y - hw, pt.y + hw].forEach(ly => {
          const lg = ctx.createRadialGradient(pt.x, ly, 0, pt.x, ly, rad);
          lg.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
          lg.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(pt.x, ly, rad, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.restore();
  },

  _crawlerPos(L, w, t) {
    const p0x = L.hangarDoorX;
    const p0y = L.hangarDoorY;
    const cx = w * 0.48;
    const cy = L.islandTopY + L.spanY * 0.08;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    return {
      x: inv * inv * p0x + 2 * inv * t * cx + t * t * p2x,
      y: inv * inv * p0y + 2 * inv * t * cy + t * t * p2y
    };
  },

  _crawlerTangent(L, w, t) {
    const p0x = L.hangarDoorX;
    const p0y = L.hangarDoorY;
    const cx = w * 0.48;
    const cy = L.islandTopY + L.spanY * 0.08;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    const dx = 2 * inv * (cx - p0x) + 2 * t * (p2x - cx);
    const dy = 2 * inv * (cy - p0y) + 2 * t * (p2y - cy);
    return Math.atan2(-dy, -dx);
  },

  _drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, travelDir, isMoving, isBoosterOnly = false) {
    ctx.save();
    const bodyLen = isBoosterOnly ? rocketH * 0.66 : rocketH;
    const bedStart = -bodyLen - 4;
    const bedEnd = 8;
    const bedW = bedEnd - bedStart;
    const bedMid = (bedStart + bedEnd) * 0.5;

    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(bedMid, 6.2, bedW * 0.56 + 11, 4.0, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.fillRect(bedStart, 0.5, bedW, 4.2);
    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(bedStart, 0.5, bedW, 1.2);
    ctx.fillStyle = pal.towerSteel;
    ctx.fillRect(bedStart + 8, -3.2, 3.6, 4.5);
    ctx.fillRect(bedEnd - 14, -3.2, 3.6, 4.5);

    ctx.fillStyle = "#1E293B";
    for (let wi = 0; wi < 7; wi++) {
      const wx = bedStart + 4 + (wi / 6) * (bedW - 8);
      ctx.beginPath();
      ctx.arc(wx, 5.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const tugX = travelDir < 0 ? (bedStart - 15) : (bedEnd + 15);
    const hitchFrom = travelDir < 0 ? bedStart : bedEnd;
    const hitchTo = travelDir < 0 ? tugX + 6.5 : tugX - 6.5;

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hitchFrom, 3.2);
    ctx.lineTo(hitchTo, 3.5);
    ctx.stroke();

    ctx.save();
    ctx.translate(tugX, 0);
    if (travelDir < 0) ctx.scale(-1, 1);

    if (isMoving) {
      const hA = pal.isNightLights ? 0.42 : 0.14;
      const hg = ctx.createLinearGradient(7, 1, 40, 1);
      hg.addColorStop(0, `rgba(255, 250, 224, ${hA})`);
      hg.addColorStop(1, "rgba(255, 250, 224, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(7, -1);
      ctx.lineTo(40, -7);
      ctx.lineTo(40, 7);
      ctx.lineTo(7, 3.5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = pal.liveryAccent;
    ctx.beginPath();
    ctx.roundRect(-7.5, -2.2, 15, 5.8, 1.8);
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.roundRect(-1.8, -5.6, 8.2, 3.8, 1.4);
    ctx.fill();
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(0.5, -4.8, 5.2, 2.4);
    ctx.fillStyle = "#0F172A";
    ctx.beginPath();
    ctx.arc(-4.2, 4.2, 2.0, 0, Math.PI * 2);
    ctx.arc(4.4, 4.2, 2.0, 0, Math.PI * 2);
    ctx.fill();

    if (Math.sin(step * 11) > 0) {
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.arc(2.2, -6.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  },

  _updateAndDrawRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.rocket;
    r.t += dt;

    const sizeMult = r.variant === "orbital_cargo" ? 0.92 : 1.0;
    const rocketH = Math.min(82, L.towerH * 0.45) * sizeMult;
    const rocketW = Math.max(6.8, rocketH * 0.142);
    const padBaseY = L.padY - 2;
    const catchY = L.padY - L.towerH * 0.54;

    let visible = true;
    let drawFlame = false;
    let flameScale = 0;
    let isTransporter = false;
    let isMovingTow = false;
    let towTravelDir = -1;
    let roadTilt = 0;
    let isBoosterOnly = false;
    let armY = padBaseY - rocketH * 0.72;
    let targetArmClose = 0;

    if (r.phase === "tow_out") {
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, ease);
      r.x = pos.x;
      r.y = pos.y;
      roadTilt = this._crawlerTangent(L, w, ease) * 0.42;
      r.angle = -Math.PI * 0.5;
      isTransporter = true;
      isMovingTow = true;
      towTravelDir = -1;
      if (r.t >= r.phaseDuration) {
        r.phase = "erect";
        r.t = 0;
        r.phaseDuration = this._rand(7.0, 9.5);
      }
    } else if (r.phase === "erect") {
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = -Math.PI * 0.5 * (1 - ease);
      isTransporter = p < 0.85;
      towTravelDir = -1;
      if (r.t >= r.phaseDuration) {
        r.phase = "arm_swing";
        r.t = 0;
        r.phaseDuration = this._rand(7.0, 11.0);
      }
    } else if (r.phase === "arm_swing") {
      const p = Math.min(1, r.t / r.phaseDuration);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = 0;
      targetArmClose = p < 0.75 ? 1.0 : 0.0;
      if (p > 0.15 && Math.random() < 0.36) {
        this.ventParticles.push({
          x: L.padX + (Math.random() - 0.5) * rocketW,
          y: padBaseY - rocketH * (0.45 + Math.random() * 0.25),
          vx: 0.32 + Math.random() * 0.5,
          vy: -(0.12 + Math.random() * 0.22),
          r: 2.5 + Math.random() * 3.2,
          life: 0,
          maxLife: 48
        });
      }
      if (r.t >= r.phaseDuration) {
        r.phase = "launch";
        r.t = 0;
        r.phaseDuration = this._rand(12.5, 14.5);
      }
    } else if (r.phase === "launch") {
      const p = Math.min(1, r.t / r.phaseDuration);
      const climb = Math.pow(p, 2.55);
      const liftY = climb * (padBaseY + 210);
      const turnX = Math.pow(Math.max(0, p - 0.14), 2.1) * (w * 0.22);
      r.x = L.padX + turnX;
      r.y = padBaseY - liftY;
      r.angle = Math.pow(Math.max(0, p - 0.14), 1.45) * 0.44;
      drawFlame = true;
      flameScale = p < 0.1 ? (0.45 + p * 5.5) : 1.05;

      if (p < 0.42) {
        const refA = (1 - p / 0.42) * 0.40;
        const rg = ctx.createRadialGradient(L.padX, L.padY + 18, 4, L.padX, L.padY + 24, 95);
        rg.addColorStop(0, `rgba(${pal.plumeMid}, ${refA.toFixed(3)})`);
        rg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(L.padX, L.padY + 24, 95, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const spawnCount = p < 0.28 ? 3 : 2;
      for (let k = 0; k < spawnCount; k++) {
        const tailX = r.x - Math.sin(r.angle) * 6;
        const tailY = r.y + Math.cos(r.angle) * 6;
        const nearPad = r.y > padBaseY - 72;
        this.plumeParticles.push({
          x: tailX + (Math.random() - 0.5) * (nearPad ? 16 : 4),
          y: nearPad ? Math.min(padBaseY + 4, tailY + Math.random() * 8) : tailY,
          vx: nearPad ? ((Math.random() - 0.5) * 2.4) : (-Math.sin(r.angle) * 0.4 + (Math.random() - 0.5) * 0.32),
          vy: nearPad ? -(0.22 + Math.random() * 0.48) : (0.55 + Math.random() * 0.42),
          r: nearPad ? (6 + Math.random() * 7) : (3.5 + Math.random() * 4),
          grow: nearPad ? 0.22 : 0.16,
          hot: p < 0.72 && Math.random() < 0.42,
          life: 0,
          maxLife: nearPad ? 92 : 145
        });
      }

      if (r.t >= r.phaseDuration) {
        r.phase = "coast_wait";
        r.t = 0;
        r.phaseDuration = this._rand(7.0, 15.0);
      }
    } else if (r.phase === "coast_wait") {
      visible = false;
      armY = catchY;
      if (r.t >= r.phaseDuration) {
        r.phase = "descent";
        r.t = 0;
        r.phaseDuration = this._rand(8.5, 10.8);
      }
    } else if (r.phase === "descent") {
      isBoosterOnly = true;
      const p = Math.min(1, r.t / r.phaseDuration);
      const easeOut = 1 - Math.pow(1 - p, 2.7);
      const startX = L.padX + w * 0.14;
      const startY = -65;
      r.x = startX + (L.padX - startX) * easeOut;
      r.y = startY + (catchY + rocketH * 0.68 - startY) * easeOut;
      r.angle = -(1 - easeOut) * 0.26;
      armY = catchY;

      if (p > 0.46) {
        drawFlame = true;
        const bp = (p - 0.46) / 0.54;
        flameScale = bp < 0.85 ? (0.85 - bp * 0.25) : ((1 - bp) * 4);
        if (Math.random() < 0.82) {
          this.plumeParticles.push({
            x: r.x + (Math.random() - 0.5) * 4,
            y: r.y + 4,
            vx: (Math.random() - 0.5) * 0.9,
            vy: 0.9 + Math.random() * 0.7,
            r: 3.5 + Math.random() * 3.5,
            grow: 0.14,
            hot: true,
            life: 0,
            maxLife: 68
          });
        }
      }
      targetArmClose = p > 0.78 ? ((p - 0.78) / 0.22) : 0;

      if (r.t >= r.phaseDuration) {
        r.phase = "catch";
        r.t = 0;
        r.phaseDuration = this._rand(4.5, 6.0);
      }
    } else if (r.phase === "catch") {
      isBoosterOnly = true;
      const p = Math.min(1, r.t / r.phaseDuration);
      const lowerP = p < 0.34 ? 0 : Math.min(1, (p - 0.34) / 0.66);
      const smooth = lowerP * lowerP * (3 - 2 * lowerP);
      const caughtY = catchY + rocketH * 0.68;
      r.x = L.padX;
      r.y = caughtY + (padBaseY - caughtY) * smooth;
      r.angle = 0;
      armY = r.y - rocketH * 0.68;
      targetArmClose = p < 0.92 ? 1.0 : 0.0;

      if (p < 0.35 && Math.random() < 0.45) {
        this.ventParticles.push({
          x: r.x + (Math.random() - 0.5) * 10,
          y: r.y - rocketH * 0.2,
          vx: (Math.random() - 0.5) * 1.0,
          vy: -(0.15 + Math.random() * 0.3),
          r: 4 + Math.random() * 3.5,
          life: 0,
          maxLife: 42
        });
      }
      if (r.t >= r.phaseDuration) {
        r.phase = "lower_horizontal";
        r.t = 0;
        r.phaseDuration = this._rand(5.5, 7.5);
      }
    } else if (r.phase === "lower_horizontal") {
      isBoosterOnly = true;
      isTransporter = true;
      towTravelDir = 1;
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = -Math.PI * 0.5 * ease;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_back";
        r.t = 0;
        r.phaseDuration = this._rand(24.0, 30.0);
      }
    } else if (r.phase === "tow_back") {
      isBoosterOnly = true;
      isTransporter = true;
      isMovingTow = true;
      towTravelDir = 1;
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, 1 - ease);
      r.x = pos.x;
      r.y = pos.y;
      roadTilt = this._crawlerTangent(L, w, 1 - ease) * 0.42;
      r.angle = -Math.PI * 0.5;
      if (r.t >= r.phaseDuration) {
        r.phase = "hangar_wait";
        r.t = 0;
        r.phaseDuration = this._rand(7.0, 16.0);
        r.variant = this._pick(["heavy_starship", "orbital_cargo"]);
      }
    } else {
      visible = false;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_out";
        r.t = 0;
        r.phaseDuration = this._rand(24.0, 30.0);
      }
    }

    r.armClose += (targetArmClose - r.armClose) * Math.min(1, dt * 5.2);

    if (visible && isTransporter) {
      ctx.save();
      ctx.translate(r.x, r.y + 1);
      ctx.rotate(roadTilt);
      this._drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, towTravelDir, isMovingTow, isBoosterOnly);
      ctx.restore();
    }

    if (visible) {
      const horizLift = isTransporter ? (Math.abs(Math.sin(r.angle)) * (rocketW * 0.55 + 1.5)) : 0;
      ctx.save();
      ctx.translate(r.x, r.y - horizLift);
      ctx.rotate(r.angle + roadTilt);

      if (drawFlame && flameScale > 0.05) {
        const flH = (28 + Math.sin(step * 42) * 5) * flameScale;
        const flW = rocketW * (0.92 + flameScale * 0.36);
        const bloomR = flH * (pal.isNightLights ? 2.5 : 1.5);
        const bloom = ctx.createRadialGradient(0, flH * 0.35, 2, 0, flH * 0.35, bloomR);
        bloom.addColorStop(0, `rgba(${pal.plumeMid}, ${(pal.isNightLights ? 0.55 : 0.30).toFixed(3)})`);
        bloom.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(0, flH * 0.35, bloomR, 0, Math.PI * 2);
        ctx.fill();

        const flGrad = ctx.createLinearGradient(0, 0, 0, flH);
        flGrad.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
        flGrad.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.88)`);
        flGrad.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = flGrad;
        ctx.beginPath();
        ctx.moveTo(-flW * 0.55, 0);
        ctx.quadraticCurveTo(0, flH * 1.18, flW * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      }

      const bodyH = isBoosterOnly ? rocketH * 0.66 : rocketH;
      const hullG = ctx.createLinearGradient(-rocketW * 0.5, 0, rocketW * 0.5, 0);
      hullG.addColorStop(0, pal.bodyLight);
      hullG.addColorStop(0.62, pal.bodyLight);
      hullG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = hullG;
      ctx.fillRect(-rocketW * 0.5, -bodyH, rocketW, bodyH);

      if (!isBoosterOnly) {
        ctx.fillStyle = hullG;
        ctx.beginPath();
        ctx.moveTo(-rocketW * 0.5, -bodyH);
        ctx.quadraticCurveTo(0, -bodyH - rocketW * 1.7, rocketW * 0.5, -bodyH);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(-rocketW * 0.82, -bodyH + 4, rocketW * 0.32, 6);
        ctx.fillRect(rocketW * 0.5, -bodyH + 4, rocketW * 0.32, 6);
      } else {
        ctx.fillStyle = pal.towerSteel;
        ctx.fillRect(-rocketW * 0.95, -bodyH + 3, rocketW * 1.9, 2.4);
      }

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-rocketW * 0.52, -bodyH * 0.56, rocketW * 1.04, 2.2);
      ctx.fillRect(-rocketW * 0.56, -4, rocketW * 1.12, 4);
      ctx.restore();
    }

    ctx.save();
    const reach = (L.towerRightX - L.towerLeftX) * 0.42;
    const extend = 0.22 + r.armClose * 0.78;
    ctx.strokeStyle = pal.isNightLights ? "#94A3B8" : pal.towerSteel;
    ctx.lineWidth = 2.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(L.towerLeftX + L.towerW * 0.45, armY);
    ctx.lineTo(L.towerLeftX + L.towerW * 0.45 + reach * extend, armY + (1 - r.armClose) * 5);
    ctx.moveTo(L.towerRightX - L.towerW * 0.45, armY);
    ctx.lineTo(L.towerRightX - L.towerW * 0.45 - reach * extend, armY + (1 - r.armClose) * 5);
    ctx.stroke();

    if (r.armClose > 0.72) {
      ctx.fillStyle = "rgba(52, 211, 153, 0.9)";
      ctx.beginPath();
      ctx.arc(L.towerLeftX + L.towerW * 0.45 + 2, armY, 2, 0, Math.PI * 2);
      ctx.arc(L.towerRightX - L.towerW * 0.45 - 2, armY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawSpaceplaneModel(ctx, variant, pal, step, afterburner = 0, altitude = 0) {
    // Cast ground shadow offset by altitude
    const shadowFade = Math.max(0.12, 1 - altitude / 90);
    ctx.save();
    ctx.translate(2.5 + altitude * 0.20, 3.5 + altitude * 0.62);
    ctx.scale(1.1, 0.8);
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.50 * shadowFade;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 19, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (afterburner > 0.05) {
      const fl = (18 + Math.sin(step * 45) * 4) * afterburner;
      const g = ctx.createLinearGradient(-17, 0, -17 - fl, 0);
      g.addColorStop(0, "rgba(255, 252, 240, 0.95)");
      g.addColorStop(0.42, "rgba(56, 189, 248, 0.78)");
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-16, -3.0);
      ctx.lineTo(-17 - fl, 0);
      ctx.lineTo(-16, 3.0);
      ctx.closePath();
      ctx.fill();
    }

    if (variant === "starliner") {
      const wingG = ctx.createLinearGradient(0, -18, 0, 18);
      wingG.addColorStop(0, pal.bodyLight);
      wingG.addColorStop(0.5, pal.bodyMid);
      wingG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-3, -17.5);
      ctx.lineTo(-10.5, -17.0);
      ctx.lineTo(-12.5, -3.5);
      ctx.lineTo(-12.5, 3.5);
      ctx.lineTo(-10.5, 17.0);
      ctx.lineTo(-3, 17.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-11, -18.2, 5.5, 1.5);
      ctx.fillRect(-11, 16.7, 5.5, 1.5);

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-14.5, -12, 8.5, 2.6);
      ctx.fillRect(-14.5, 9.4, 8.5, 2.6);

      const fGrad = ctx.createLinearGradient(0, -4.8, 0, 4.8);
      fGrad.addColorStop(0, pal.bodyLight);
      fGrad.addColorStop(0.65, pal.bodyLight);
      fGrad.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.quadraticCurveTo(15, -4.8, -17, -3.5);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-17, 3.5);
      ctx.quadraticCurveTo(15, 4.8, 24, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-13, 0.7, 30, 1.1);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(15, -1.8, 3.8, 2.0);
      for (let wi = 0; wi < 8; wi++) {
        ctx.fillRect(10.5 - wi * 3.0, -2.3, 1.5, 1.0);
        ctx.fillRect(11.5 - wi * 3.0, -0.6, 1.5, 1.0);
      }

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-10, -1.4);
      ctx.lineTo(-19, -9.8);
      ctx.lineTo(-21.5, -8.4);
      ctx.lineTo(-17.5, -0.7);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "airliner") {
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -15.5);
      ctx.lineTo(-10.5, -15.5);
      ctx.lineTo(-8, -3);
      ctx.lineTo(-8, 3);
      ctx.lineTo(-10.5, 15.5);
      ctx.lineTo(-5, 15.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-12, -16.4, 8.5, 2.3);
      ctx.fillRect(-12, 14.1, 8.5, 2.3);

      const fg = ctx.createLinearGradient(0, -4, 0, 4);
      fg.addColorStop(0, pal.bodyLight);
      fg.addColorStop(0.68, pal.bodyLight);
      fg.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(23, 0);
      ctx.quadraticCurveTo(12, -3.9, -15, -2.6);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-15, 2.6);
      ctx.quadraticCurveTo(12, 3.9, 23, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-13, 0.5, 29, 1.0);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(14, -1.5, 3.6, 1.6);
      for (let wi = 0; wi < 7; wi++) {
        ctx.fillRect(9.5 - wi * 3.0, -1.4, 1.6, 1.0);
      }

      ctx.fillStyle = pal.bodyShade;
      ctx.beginPath();
      ctx.moveTo(-9.5, -1.1);
      ctx.lineTo(-17.5, -8.0);
      ctx.lineTo(-19.5, -6.8);
      ctx.lineTo(-16, -0.5);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "clipper") {
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.quadraticCurveTo(9, -8.0, -6, -12.8);
      ctx.lineTo(-14.5, -11.4);
      ctx.lineTo(-12.5, -4.2);
      ctx.lineTo(-14.5, 0);
      ctx.lineTo(-12.5, 4.2);
      ctx.lineTo(-14.5, 11.4);
      ctx.lineTo(-6, 12.8);
      ctx.quadraticCurveTo(9, 8.0, 19, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.quadraticCurveTo(8, 6.8, -13.5, 11.0);
      ctx.lineTo(-12.5, 4.2);
      ctx.lineTo(-13.5, -4.2);
      ctx.closePath();
      ctx.globalAlpha = 0.40;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-15, -13.5, 7.5, 2.0);
      ctx.fillRect(-15, 11.5, 7.5, 2.0);

      ctx.fillStyle = pal.windowGlow;
      ctx.beginPath();
      ctx.ellipse(11, 0, 3.4, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(5, -5.4);
      ctx.lineTo(-9.5, -14.2);
      ctx.lineTo(-14, -13.2);
      ctx.lineTo(-14, 13.2);
      ctx.lineTo(-9.5, 14.2);
      ctx.lineTo(5, 5.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(4.2, -4.4);
      ctx.lineTo(-9, -12.6);
      ctx.lineTo(-12.8, -11.6);
      ctx.lineTo(-12.8, 11.6);
      ctx.lineTo(-9, 12.6);
      ctx.lineTo(4.2, 4.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.roundRect(-13.5, -4.0, 28, 8.0, 3.8);
      ctx.fill();
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-13.5, 1.0, 25, 2.6);

      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(9.0, -2.0, 2.6, 4.0);
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-6.5, -1.5);
      ctx.lineTo(-15.5, -8.6);
      ctx.lineTo(-17, -7.0);
      ctx.lineTo(-13.2, -0.7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.arc(14.6, 0, 2.5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
    }

    if (Math.sin(step * 12) > 0.25) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-10.5, -12.8, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-10.5, 12.8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _isRunwayBusy(excludingCraft) {
    const busyPhases = new Set(["runway_takeoff", "approach", "chute_rollout", "lineup_hold"]);
    return this.spaceplanes.some(other => other !== excludingCraft && busyPhases.has(other.phase));
  },

  _updateSingleSpaceplane(ctx, sp, L, pal, dt, step, w, h) {
    sp.t += dt;

    let visible = false;
    let x = sp.x || 0;
    let y = sp.y || 0;
    let scale = 0.64 * L.termScale;
    let targetHeading = sp.heading;
    let altitude = 0;
    let showChute = false;
    let chuteInflation = 0;
    let afterburner = 0;

    const V_TAXI = 8.5;       // Calm, realistic ground taxi speed (px/s)
    const V_TD = 54.0;        // Touchdown airspeed (px/s)
    const V_VR = 58.0;        // Liftoff rotation speed (px/s)

    const entryPt = L.rwPt(L.rwEntryT);
    const exitPt = L.rwPt(L.rwExitT);
    const rwAngle = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const dirX = Math.cos(rwAngle);
    const dirY = Math.sin(rwAngle);

    if (sp.phase === "hangar_emerge") {
      visible = true;
      const p0 = { x: L.hangarX + 24, y: L.hangarDoorY - 5 };
      const p1 = { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
      const total = Math.max(10, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      // Smoothly ramp from 0 up to V_TAXI (continuous into taxi_to_runway / apron_taxi_out!)
      const desired = Math.min(V_TAXI, Math.max(2.5, (sp.dist / 14 + 0.25) * V_TAXI));
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 3.0);
      sp.dist += sp.speed * dt;
      const f = Math.min(1, sp.dist / total);
      x = p0.x + (p1.x - p0.x) * f;
      y = p0.y + (p1.y - p0.y) * f;
      targetHeading = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      scale = 0.58 * L.termScale;
      if (sp.dist >= total) {
        sp.dist = 0;
        sp.t = 0;
        sp.speed = V_TAXI;
        sp.phase = sp.role === "apron" ? "apron_taxi_out" : "taxi_to_runway";
      }
    } else if (sp.phase === "apron_taxi_out") {
      visible = true;
      const path = this._getApronShuttleOutPath(L);
      const rem = path.totalLen - sp.dist;
      const desired = rem < 22 ? Math.max(2.0, V_TAXI * (rem / 22)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.58 + (sp.dist / path.totalLen) * 0.08) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp.phase = "gate_turnaround";
        sp.t = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(8.0, 16.0);
      }
    } else if (sp.phase === "gate_turnaround") {
      visible = true;
      x = L.termX - 72 * L.termScale;
      y = L.termY + 56 * L.termScale;
      targetHeading = -2.4;
      scale = 0.66 * L.termScale;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "apron_taxi_return";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
      }
    } else if (sp.phase === "apron_taxi_return") {
      visible = true;
      const path = this._getApronShuttleReturnPath(L);
      const desired = sp.dist < 20 ? Math.max(2.0, V_TAXI * (sp.dist / 20)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 3.5);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.66 - (sp.dist / path.totalLen) * 0.08) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(8.0, 18.0);
      }
    } else if (sp.phase === "taxi_to_runway") {
      // Dead-steady slow arc-length taxi along open South Apron corridor strictly clear of Star Terminal!
      visible = true;
      const path = this._getTaxiToRunwayPath(L);
      const rem = path.totalLen - sp.dist;
      const desired = rem < 22 ? Math.max(2.2, V_TAXI * (rem / 22)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.58 + (sp.dist / path.totalLen) * 0.10) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp.phase = "lineup_hold";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(3.0, 5.2);
      }
    } else if (sp.phase === "lineup_hold") {
      visible = true;
      const p = Math.min(1, sp.t / Math.max(1, sp.phaseDuration));
      const ease = p * p * (3 - 2 * p);
      x = (entryPt.x - dirX * 14) + dirX * 14 * ease;
      y = (entryPt.y - dirY * 14) + dirY * 14 * ease;
      targetHeading = rwAngle;
      scale = 0.68 * L.termScale;
      if (sp.t >= sp.phaseDuration && !this._isRunwayBusy(sp)) {
        sp.phase = "runway_takeoff";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp._airborne = false;
      }
    } else if (sp.phase === "runway_takeoff") {
      // C1 continuous speed from 0 -> V_VR along runway, then seamless liftoff at EXACT V_VR -> 82 px/s climb!
      visible = true;
      const liftPt = L.rwPt(0.70);
      const rollLen = Math.hypot(liftPt.x - entryPt.x, liftPt.y - entryPt.y);

      if (!sp._airborne) {
        // Smooth constant thrust acceleration along runway
        const accel = (V_VR * V_VR) / (2 * Math.max(60, rollLen));
        sp.speed = Math.min(V_VR, sp.speed + accel * dt);
        sp.dist += sp.speed * dt;
        const frac = Math.min(1, sp.dist / rollLen);
        x = entryPt.x + (liftPt.x - entryPt.x) * frac;
        y = entryPt.y + (liftPt.y - entryPt.y) * frac;
        afterburner = Math.min(1, 0.35 + frac * 0.75);
        const rotPitch = Math.max(0, (frac - 0.80) / 0.20);
        targetHeading = rwAngle - rotPitch * 0.12;
        altitude = rotPitch * rotPitch * 2.5;
        scale = (0.68 + frac * 0.12) * L.termScale;

        if (sp.dist >= rollLen) {
          sp._airborne = true;
          sp.dist = 0;
          sp.speed = V_VR;
        }
      } else {
        const climbPath = this._getTakeoffClimbPath(L, w, h, sp);
        sp.speed = Math.min(84, sp.speed + 5.5 * dt);
        sp.dist += sp.speed * dt;
        const cp = Math.min(1, sp.dist / climbPath.totalLen);
        const pt = this._sampleArcPath(climbPath, sp.dist);
        x = pt.x;
        y = pt.y;
        targetHeading = pt.angle;
        altitude = 2.5 + Math.pow(cp, 1.35) * 95;
        afterburner = cp < 0.78 ? 1.0 : Math.max(0, (1 - cp) * 4.5);
        scale = Math.max(0.32, (0.80 - cp * 0.48)) * L.termScale;

        if (Math.random() < 0.72) {
          this.plumeParticles.push({
            x: x - Math.cos(sp.heading) * 14 * scale,
            y: y - Math.sin(sp.heading) * 14 * scale,
            vx: -Math.cos(sp.heading) * 0.20,
            vy: 0.06,
            r: 1.8 + Math.random() * 1.8,
            grow: 0.08,
            hot: false,
            life: 0,
            maxLife: 115
          });
        }
        if (sp.dist >= climbPath.totalLen) {
          sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
          sp.phase = "sky_wait";
          sp.t = 0;
          sp.dist = 0;
          sp._airborne = false;
          sp.phaseDuration = this._rand(6.0, 14.0);
        }
      }
    } else if (sp.phase === "sky_wait") {
      if (sp.t >= sp.phaseDuration && !this._isRunwayBusy(sp)) {
        const appPath = this._getApproachPath(L);
        const p0 = this._sampleArcPath(appPath, 0);
        sp.x = p0.x;
        sp.y = p0.y;
        sp.heading = p0.angle;
        sp.dist = 0;
        sp.speed = 74;
        sp.phase = "approach";
        sp.t = 0;
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      // Arc-length glide slope easing smoothly from 74 px/s down to EXACTLY V_TD (54 px/s) at touchdown!
      visible = true;
      const appPath = this._getApproachPath(L);
      const frac = Math.min(1, sp.dist / appPath.totalLen);
      sp.speed = 74 - (74 - V_TD) * frac;
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(appPath, sp.dist);
      x = pt.x;
      y = pt.y;
      const flare = frac > 0.80 ? ((frac - 0.80) / 0.20) * 0.08 : 0;
      targetHeading = pt.angle - flare;
      altitude = Math.pow(1 - frac, 1.5) * 32;
      scale = (0.42 + frac * 0.24) * L.termScale;

      if (sp.dist >= appPath.totalLen) {
        const tdPt = L.rwPt(0.14);
        for (let i = 0; i < 5; i++) {
          this.ventParticles.push({
            x: tdPt.x + (Math.random() - 0.5) * 5,
            y: tdPt.y + 2,
            vx: (Math.random() - 0.5) * 0.9,
            vy: -(0.14 + Math.random() * 0.25),
            r: 2.0 + Math.random() * 2.0,
            life: 0,
            maxLife: 34
          });
        }
        sp.phase = "chute_rollout";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = V_TD; // Exact velocity handoff! Zero speed jump!
      }
    } else if (sp.phase === "chute_rollout") {
      // Exact continuous deceleration from V_TD (54 px/s) down to EXACTLY V_TAXI (8.5 px/s) at exitPt!
      visible = true;
      const tdPt = L.rwPt(0.14);
      const rollLen = Math.max(60, Math.hypot(exitPt.x - tdPt.x, exitPt.y - tdPt.y));
      const frac = Math.min(1, sp.dist / rollLen);
      // Smooth aerodynamic drag deceleration v(d) matching V_TD at frac=0 and V_TAXI at frac=1!
      sp.speed = V_TAXI + (V_TD - V_TAXI) * Math.pow(1 - frac, 1.15);
      sp.dist += sp.speed * dt;
      const rwF = Math.min(1, sp.dist / rollLen);
      x = tdPt.x + (exitPt.x - tdPt.x) * rwF;
      y = tdPt.y + (exitPt.y - tdPt.y) * rwF;
      scale = (0.66 + rwF * 0.14) * L.termScale;
      const noseSettle = Math.max(0, 1 - rwF / 0.16) * 0.08;
      targetHeading = rwAngle - noseSettle;
      altitude = 0;

      if (rwF < 0.80) {
        showChute = true;
        chuteInflation = rwF < 0.10 ? (rwF / 0.10) : (0.94 + Math.sin(step * 18) * 0.06);
      } else if (!sp.chuteDetached) {
        sp.chuteDetached = true;
        sp.detachedChuteX = x - Math.cos(sp.heading) * 24 * scale;
        sp.detachedChuteY = y - Math.sin(sp.heading) * 24 * scale;
        sp.detachedChuteAlpha = 0.85;
      }

      if (sp.dist >= rollLen) {
        sp.phase = "taxi_to_hangar";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = V_TAXI; // Exact velocity handoff! Zero speed jump!
      }
    } else if (sp.phase === "taxi_to_hangar") {
      // Dead-steady slow arc-length exit taxi cleanly around Star Terminal straight inside Arched Hangar!
      visible = true;
      const path = this._getTaxiToHangarPath(L);
      sp.speed += (V_TAXI - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.80 - (sp.dist / path.totalLen) * 0.22) * L.termScale;

      if (sp.dist >= path.totalLen) {
        sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(8.0, 18.0);
      }
    } else {
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "hangar_emerge";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
      }
    }

    sp.x = x;
    sp.y = y;
    sp.heading = this._lerpAngle(sp.heading, targetHeading, Math.min(1, dt * 5.8));
    sp.altitude = altitude;

    if (sp.chuteDetached && sp.detachedChuteAlpha > 0.01) {
      sp.detachedChuteAlpha = Math.max(0, sp.detachedChuteAlpha - dt * 0.5);
      ctx.save();
      ctx.globalAlpha = sp.detachedChuteAlpha;
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.ellipse(sp.detachedChuteX, sp.detachedChuteY + 3, 6.5, 2.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!visible) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sp.heading);
    ctx.scale(scale, scale);

    if (showChute && chuteInflation > 0.05) {
      const tetherLen = 16 + chuteInflation * 16;
      const chuteR = 7.8 * chuteInflation;
      const tailX = -15;
      const canopyX = tailX - tetherLen;

      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.60)" : "rgba(71, 85, 105, 0.58)";
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, -chuteR);
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, 0);
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, chuteR);
      ctx.stroke();

      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.moveTo(canopyX, -chuteR);
      ctx.quadraticCurveTo(canopyX - chuteR * 1.5, 0, canopyX, chuteR);
      ctx.quadraticCurveTo(canopyX - chuteR * 0.3, 0, canopyX, -chuteR);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.chuteStripe;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(canopyX - chuteR * 0.38, -chuteR * 0.56);
      ctx.lineTo(canopyX - chuteR * 0.38, chuteR * 0.56);
      ctx.stroke();
    }

    const beamA = pal.isNightLights ? 0.34 : 0.12;
    const beamG = ctx.createLinearGradient(17, 0, 62, 0);
    beamG.addColorStop(0, `rgba(255, 251, 235, ${beamA})`);
    beamG.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(17, -1.6);
    ctx.lineTo(62, -10);
    ctx.lineTo(62, 10);
    ctx.lineTo(17, 1.6);
    ctx.closePath();
    ctx.fill();

    this._drawSpaceplaneModel(ctx, sp.variant, pal, step, afterburner, altitude);
    ctx.restore();
  },

  _updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h) {
    for (let i = 0; i < this.spaceplanes.length; i++) {
      this._updateSingleSpaceplane(ctx, this.spaceplanes[i], L, pal, dt, step, w, h);
    }
    if (this.spaceplanes.length > 0) {
      this.spaceplane = this.spaceplanes[0];
    }
  },

  _updateAndDrawParticles(ctx, pal, dt) {
    const scaleDt = dt * 60;

    if (this.plumeParticles.length > 0) {
      const alive = [];
      ctx.save();
      for (let i = 0; i < this.plumeParticles.length; i++) {
        const p = this.plumeParticles[i];
        p.x += p.vx * scaleDt;
        p.y += p.vy * scaleDt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.r += p.grow * scaleDt;
        p.life += scaleDt;
        if (p.life >= p.maxLife) continue;
        alive.push(p);

        const t = p.life / p.maxLife;
        const a = (1 - t) * (1 - t) * pal.smokeAlpha;
        const rgb = (p.hot && t < 0.28) ? pal.plumeMid : pal.smokeRgb;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      this.plumeParticles = alive;
    }

    if (this.ventParticles.length > 0) {
      const aliveV = [];
      ctx.save();
      for (let i = 0; i < this.ventParticles.length; i++) {
        const v = this.ventParticles[i];
        v.x += v.vx * scaleDt;
        v.y += v.vy * scaleDt;
        v.r += 0.08 * scaleDt;
        v.life += scaleDt;
        if (v.life >= v.maxLife) continue;
        aliveV.push(v);

        const t = v.life / v.maxLife;
        const a = (1 - t) * 0.22;
        ctx.fillStyle = `rgba(241, 245, 249, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      this.ventParticles = aliveV;
    }
  },

  _updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now) {
    if (mode !== "morning") {
      this.fogState.alpha = Math.max(0, this.fogState.alpha - dt * 0.5);
      if (this.fogState.alpha <= 0.005) return;
    } else {
      if (now >= this.fogState.nextCheck) {
        const roll = Math.random() < 0.55;
        this.fogState.active = roll;
        this.fogState.targetAlpha = roll ? (0.34 + Math.random() * 0.24) : 0;
        this.fogState.nextCheck = now + 18000 + Math.random() * 14000;
      }
      this.fogState.alpha += (this.fogState.targetAlpha - this.fogState.alpha) * Math.min(1, dt * 0.35);
    }

    if (this.fogState.alpha <= 0.01) return;
    this.fogState.offset = (this.fogState.offset + dt * 15) % (w + 400);

    ctx.save();
    for (let layer = 0; layer < 2; layer++) {
      const baseY = L.islandTopY + (L.islandBotY - L.islandTopY) * (0.28 + layer * 0.42);
      const bandH = 74 + layer * 36;
      const g = ctx.createLinearGradient(0, baseY - bandH * 0.5, 0, baseY + bandH * 0.6);
      const peak = this.fogState.alpha * (layer === 0 ? 0.48 : 0.34);
      g.addColorStop(0, "rgba(255, 248, 242, 0)");
      g.addColorStop(0.5, `rgba(255, 247, 240, ${peak.toFixed(3)})`);
      g.addColorStop(1, "rgba(255, 248, 242, 0)");
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.moveTo(0, baseY + bandH);
      for (let x = 0; x <= w + 60; x += 60) {
        const wave = Math.sin((x + this.fogState.offset * (layer === 0 ? 1 : -0.7)) * 0.0045 + layer * 2) * 18;
        ctx.lineTo(x, baseY - bandH * 0.35 + wave);
      }
      ctx.lineTo(w, baseY + bandH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
};

window.WorldGateway = WorldGateway;
