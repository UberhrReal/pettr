/**
 * PETTR World Renderer: Space — "Gateway" (v12.6 Vertical Tower Clearance, Pad Deluge, 7-Phase Falcon Heavy, Mega-Liner & Muted Ships)
 * Elevated coastal island spaceport inspired by wide-angle aerospace vistas:
 * - Substantially enlarged central Star-Shaped Spire Terminal linked by elevated glazed skybridges to West, East &
 *   North Satellite Terminals, multiple gate stands with random live gate-parking + static aircraft population.
 * - Perspective-aligned 2.5D campus & waterfront buildings rendered into foreground occlusion cache so horizontal
 *   rocket tow trailers glide realistically BEHIND VAB and North Campus structures.
 * - Launch towers illuminate floodlights and fire high-pressure water deluge + lateral steam during ignition and
 *   landing; rockets climb strictly vertically to clear tower heights before pitching downrange.
 * - Offshore Launch Platform with center core mount, twin smaller side-booster landing pads, deck re-mating crane,
 *   and causeway core hangar running the full Falcon Heavy core-tow -> booster-attach -> launch -> dual-booster-landing
 *   -> crane-reattach loop.
 * - Rare colossal multi-deck sci-fi Mega-Liner landing on runway, boarding at Star Terminal, taxiing to main pad,
 *   and executing a vertical launch.
 * - Dynamic rolling coastal fog banks at dawn and muted atmospheric distant container ships in the archipelago bay.
 */
const WorldGateway = {
  cacheCanvas: null,
  fgCacheCanvas: null,
  cacheKey: "",
  stars: [],
  clouds: [],
  cirrus: [],
  waterGlints: [],
  plumeParticles: [],
  ventParticles: [],
  rocket: null,
  offshoreRocket: null,
  megaliner: null,
  spaceplane: null,
  spaceplanes: [],
  ships: [],
  boats: [],
  helicopters: [],
  groundVehicles: [],
  spVariantIdx: 0,
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  _lastW: 0,
  _lastH: 0,
  _lastMode: "",
  _lastDishAim: -0.8,

  SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper", "starliner"],
  ALL_SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper", "starliner", "fighter", "bomber"],

  _rand(min, max) {
    return min + Math.random() * (max - min);
  },

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  _clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  },

  _lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
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
    this.offshoreRocket = null;
    this.megaliner = null;
    this.spaceplane = null;
    this.spaceplanes = [];
    this.ships = [];
    this.boats = [];
    this.helicopters = [];
    this.groundVehicles = [];
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
        sunDir: 1.25,
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
        quayFill: "#8D8188",
        foliage: "#3A4656",
        foliageLight: "#505F72",
        runwayFill: "#545463",
        runwayLight: "rgba(255, 245, 228, 0.56)",
        archLight: "#F2E9E4",
        archMid: "#BCB0B8",
        archDark: "#6A6576",
        roofHighlight: "rgba(255, 250, 245, 0.58)",
        shadowColor: "rgba(34, 28, 48, 0.22)",
        towerSteel: "#585465",
        windowGlow: "rgba(254, 226, 178, 0.54)",
        windowGlassDark: "rgba(44, 44, 64, 0.54)",
        hangarInterior: "rgba(251, 196, 128, 0.40)",
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
        militaryBody: "#565B6E",
        militaryShade: "#35394A",
        shipHull: "#434C63",
        shipSuper: "#E8E0DD"
      };
    }
    if (mode === "evening") {
      return {
        isNightLights: true,
        lightIntensity: 0.86,
        sunDir: 1.45,
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
        quayFill: "#3E394E",
        foliage: "#1D2434",
        foliageLight: "#2C364D",
        runwayFill: "#2C2B3A",
        runwayLight: "rgba(253, 218, 142, 0.62)",
        archLight: "#CFC5CC",
        archMid: "#847C90",
        archDark: "#3F3B4F",
        roofHighlight: "rgba(255, 234, 210, 0.36)",
        shadowColor: "rgba(12, 10, 26, 0.34)",
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
        militaryBody: "#45495C",
        militaryShade: "#262838",
        shipHull: "#252B3F",
        shipSuper: "#C2B8C2"
      };
    }
    if (mode === "dark") {
      return {
        isNightLights: true,
        lightIntensity: 1.0,
        sunDir: 1.10,
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
        quayFill: "#101829",
        foliage: "#080E18",
        foliageLight: "#121C2E",
        runwayFill: "#101726",
        runwayLight: "rgba(125, 211, 252, 0.72)",
        archLight: "#6E8098",
        archMid: "#394860",
        archDark: "#151F33",
        roofHighlight: "rgba(186, 230, 253, 0.22)",
        shadowColor: "rgba(2, 6, 16, 0.46)",
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
        militaryBody: "#2A364B",
        militaryShade: "#141C2B",
        shipHull: "#0D1526",
        shipSuper: "#5E718A"
      };
    }
    // Afternoon / Light — crisp coastal daylight aerospace port
    return {
      isNightLights: false,
      lightIntensity: 0.14,
      sunDir: 0.92,
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
      quayFill: "#A3B1C2",
      foliage: "#556E78",
      foliageLight: "#69848F",
      runwayFill: "#5E6E84",
      runwayLight: "rgba(255, 255, 255, 0.70)",
      archLight: "#F8FAFC",
      archMid: "#C6D1DE",
      archDark: "#64748B",
      roofHighlight: "rgba(255, 255, 255, 0.78)",
      shadowColor: "rgba(30, 41, 59, 0.21)",
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
      militaryBody: "#5F6E82",
      militaryShade: "#3B4759",
      shipHull: "#3E526B",
      shipSuper: "#F1F5F9"
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.34 : 0.27);
    const islandTopY = h * (isNarrow ? 0.44 : 0.39);
    const islandBotY = h * (isNarrow ? 0.78 : 0.78);
    const spanY = islandBotY - islandTopY;

    // 1. Primary Heavy Orbital Launch Complex (North-West Peninsula)
    const padX = w * (isNarrow ? 0.17 : 0.185);
    const padY = islandTopY + spanY * 0.13;
    const towerH = Math.min(206, Math.max(106, h * 0.22));
    const towerW = Math.max(11, towerH * 0.082);
    const towerLeftX = padX - towerW * 1.95;
    const towerRightX = padX + towerW * 1.95;

    // Monumental Vertical Assembly Building (VAB) beside the north crawlerway
    const vabX = w * (isNarrow ? 0.275 : 0.276);
    const vabY = islandTopY + spanY * 0.148;
    const vabW = isNarrow ? 44 : Math.min(78, w * 0.055);
    const vabH = isNarrow ? 46 : Math.min(82, h * 0.092);

    // Horizontal Integration Facility (HIF) along far-northern crawlerway so rocket & tug spawn/despawn INSIDE!
    const hifX = w * (isNarrow ? 0.61 : 0.618);
    const hifY = islandTopY + spanY * 0.105;
    const hifW = isNarrow ? Math.min(82, w * 0.21) : Math.min(134, w * 0.102);
    const hifH = hifW * 0.22;
    const hifDoorX = hifX - hifW * 0.42;
    const hifDoorY = hifY + 2;

    // 2. Second Offshore Launch Platform (Falcon Heavy Center Pad + Dual Booster Recovery Pads)
    const offshorePadX = w * (isNarrow ? 0.78 : 0.752);
    const offshorePadY = horizonY + Math.max(24, (islandTopY - horizonY) * 0.48);
    const offshoreShoreX = w * (isNarrow ? 0.695 : 0.688);
    const offshoreShoreY = islandTopY + 3;
    const offshoreScale = isNarrow ? 0.46 : Math.min(0.68, Math.max(0.52, w / 1900));
    const offshoreLzLeftX = offshorePadX - 46 * offshoreScale;
    const offshoreLzRightX = offshorePadX + 46 * offshoreScale;

    // 3. Expanded Monumental Star Terminal + Connected West, East & North Concourse Terminals (Zero Overlap!)
    const termX = w * 0.468;
    const termY = islandTopY + spanY * 0.324;
    const termScale = isNarrow ? Math.max(0.58, w / 580) : Math.min(1.48, Math.max(1.08, w / 940));

    const satWest = { x: termX - 208 * termScale, y: termY - 10 * termScale };
    const satEast = { x: termX + 196 * termScale, y: termY - 4 * termScale };
    const satNorth = { x: termX - 72 * termScale, y: termY - 27 * termScale };

    // 4. Wide Arched Spaceplane Assembly Hangar (East-North — spaced clear of satEast)
    const hangarX = w * (isNarrow ? 0.775 : 0.795);
    const hangarY = islandTopY + spanY * 0.145;
    const hangarW = Math.min(204, w * (isNarrow ? 0.23 : 0.142));
    const hangarH = hangarW * 0.29;
    const hangarDoorX = hangarX - hangarW * 0.22;
    const hangarDoorY = hangarY + hangarH * 0.44;

    // 5. Expanded Deep-Space Ground Station & Synchronized Parabolic Dish Row + Prominent Control Tower (East Bluff)
    const radarX = w * (isNarrow ? 0.805 : 0.896);
    const radarY = hangarY + (isNarrow ? 50 : 54);
    const radomeX = radarX - (isNarrow ? 12 : 34);
    const radomeY = radarY + (isNarrow ? 16 : 24);
    const radarDishes = isNarrow
      ? [
          { x: radarX - 24, y: radarY - 5, r: 7.4 },
          { x: radarX, y: radarY - 1, r: 7.8 },
          { x: radarX + 24, y: radarY + 3, r: 7.4 }
        ]
      : [
          { x: radarX - 58, y: radarY - 10, r: 10.0 },
          { x: radarX - 29, y: radarY - 5, r: 10.6 },
          { x: radarX, y: radarY, r: 11.2 },
          { x: radarX + 29, y: radarY + 5, r: 10.6 },
          { x: radarX + 58, y: radarY + 10, r: 10.0 }
        ];
    const atcX = w * (isNarrow ? 0.938 : 0.960);
    const atcY = radarY + (isNarrow ? 34 : 46);

    // 6. Dedicated Helipads on Open Aprons
    const heliPad1 = { x: w * 0.855, y: hangarY + hangarH * 0.98 + 18 };
    const heliPad2 = { x: w * 0.26, y: islandTopY + spanY * 0.74 };

    // 7. Sweeping Diagonal Main Runway across Peninsula (with exact geometric query helpers!)
    const rwLeftX = w * 0.025;
    const rwLeftY = islandTopY + spanY * 0.34;
    const rwRightX = w * 0.975;
    const rwRightY = islandBotY + h * 0.04;
    const rwAng = Math.atan2(rwRightY - rwLeftY, rwRightX - rwLeftX);
    const rwLeftHalf = isNarrow ? 7 : 10.5;
    const rwRightHalf = isNarrow ? 20 : 30;

    const rwPt = (t) => ({
      x: rwLeftX + (rwRightX - rwLeftX) * t,
      y: rwLeftY + (rwRightY - rwLeftY) * t
    });
    const rwYAtX = (x) => {
      const t = (x - rwLeftX) / Math.max(1, rwRightX - rwLeftX);
      return rwLeftY + (rwRightY - rwLeftY) * t;
    };
    const rwHalfAtX = (x) => {
      const t = this._clamp((x - rwLeftX) / Math.max(1, rwRightX - rwLeftX), 0, 1);
      return rwLeftHalf + (rwRightHalf - rwLeftHalf) * t;
    };

    const rwExitT = 0.67;
    const rwEntryT = 0.20;

    // Runway Underpass & Highway Terminal Arrival Spine
    const underpassX = w * 0.61;
    const underpassY = rwYAtX(underpassX);
    const underpassHalf = rwHalfAtX(underpassX);
    const plazaX = termX + 6 * termScale;
    const plazaY = termY + 34 * termScale;

    // 8. South Apron Taxiway Corridors & Named Terminal Gate Stands (strictly clear of terminal roofs & runway!)
    const apronEast = { x: termX + 206 * termScale, y: termY + 36 * termScale };
    const apronSE = { x: termX + 144 * termScale, y: termY + 56 * termScale };
    const apronSouth = { x: termX - 10 * termScale, y: termY + 56 * termScale };
    const apronSW = { x: termX - 150 * termScale, y: termY + 40 * termScale };

    const gates = [
      { id: "G_SW", x: termX - 120 * termScale, y: termY + 33 * termScale, heading: -0.30, approachPt: apronSW },
      { id: "G_SE", x: termX + 126 * termScale, y: termY + 34 * termScale, heading: 2.74, approachPt: apronSE },
      { id: "G_SC", x: termX + 14 * termScale, y: termY + 42 * termScale, heading: -1.48, approachPt: apronSouth },
      { id: "G_SAT_W", x: satWest.x + 4 * termScale, y: satWest.y + 28 * termScale, heading: -0.95, approachPt: { x: satWest.x - 16 * termScale, y: satWest.y + 48 * termScale } }
    ];

    return {
      isNarrow, horizonY, islandTopY, islandBotY, spanY,
      padX, padY, towerH, towerW, towerLeftX, towerRightX,
      vabX, vabY, vabW, vabH,
      hifX, hifY, hifW, hifH, hifDoorX, hifDoorY,
      offshorePadX, offshorePadY, offshoreShoreX, offshoreShoreY, offshoreScale,
      offshoreLzLeftX, offshoreLzRightX,
      termX, termY, termScale, satWest, satEast, satNorth,
      hangarX, hangarY, hangarW, hangarH, hangarDoorX, hangarDoorY,
      radarX, radarY, radomeX, radomeY, radarDishes, atcX, atcY,
      heliPad1, heliPad2,
      rwLeftX, rwLeftY, rwRightX, rwRightY, rwAng, rwLeftHalf, rwRightHalf,
      rwPt, rwYAtX, rwHalfAtX, rwExitT, rwEntryT,
      underpassX, underpassY, underpassHalf, plazaX, plazaY,
      apronEast, apronSE, apronSouth, apronSW, gates
    };
  },

  ensureStaticCache(w, h, mode) {
    const key = `${Math.round(w)}x${Math.round(h)}:${mode}`;
    if (this.cacheCanvas && this.fgCacheCanvas && this.cacheKey === key) return;

    if (!this.cacheCanvas) {
      this.cacheCanvas = document.createElement("canvas");
    }
    if (!this.fgCacheCanvas) {
      this.fgCacheCanvas = document.createElement("canvas");
    }
    this.cacheCanvas.width = Math.max(1, Math.round(w));
    this.cacheCanvas.height = Math.max(1, Math.round(h));
    this.fgCacheCanvas.width = this.cacheCanvas.width;
    this.fgCacheCanvas.height = this.cacheCanvas.height;
    this.cacheKey = key;

    const ctx = this.cacheCanvas.getContext("2d");
    const fgCtx = this.fgCacheCanvas.getContext("2d");
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

    // Connected Floating Offshore Launch Platform & Umbilical Trestle Bridge in Upper Bay!
    this._drawOffshoreLaunchPlatform(ctx, L, pal);

    // Soft atmospheric horizon mist blending distant bay into sky
    const mistG = ctx.createLinearGradient(0, L.horizonY - 12, 0, L.horizonY + 34);
    mistG.addColorStop(0, `rgba(${pal.hazeRgb}, 0)`);
    mistG.addColorStop(0.45, `rgba(${pal.hazeRgb}, ${mode === "dark" ? 0.22 : 0.34})`);
    mistG.addColorStop(1, `rgba(${pal.hazeRgb}, 0)`);
    ctx.fillStyle = mistG;
    ctx.fillRect(0, L.horizonY - 12, w, 46);

    // 4. Sweeping Spaceport Peninsula Island Landmass + Clean Stepped Coastal Seawall (Zero Awkward Trapezoid!)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 14);
    ctx.lineTo(w * 0.24, L.islandTopY - 6);
    ctx.lineTo(w * 0.72, L.islandTopY + 2);
    ctx.lineTo(w + 20, L.islandTopY + 42);
    ctx.lineTo(w + 20, h + 10);
    ctx.lineTo(w * 0.60, L.islandBotY + 36);
    ctx.lineTo(w * 0.12, L.islandBotY - 38);
    ctx.lineTo(-20, L.islandTopY + 72);
    ctx.closePath();
    const landG = ctx.createLinearGradient(0, L.islandTopY, 0, L.islandBotY + 36);
    landG.addColorStop(0, pal.landBase);
    landG.addColorStop(1, pal.landShade);
    ctx.fillStyle = landG;
    ctx.fill();

    // Subtle paved tarmac apron zones covering terminal, satellites & hangar stands
    ctx.beginPath();
    ctx.moveTo(w * 0.24, L.islandTopY + 12);
    ctx.lineTo(w * 0.87, L.islandTopY + 18);
    ctx.lineTo(w * 0.90, L.termY + 82);
    ctx.lineTo(w * 0.20, L.termY + 66);
    ctx.closePath();
    ctx.fillStyle = pal.apronFill;
    ctx.globalAlpha = 0.56;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Stepped concrete harbor seawall bulkhead & subtle shoreline foam along peninsula coast
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 72);
    ctx.lineTo(w * 0.12, L.islandBotY - 38);
    ctx.lineTo(w * 0.60, L.islandBotY + 36);
    ctx.lineTo(w * 0.66, h + 10);
    ctx.lineTo(w * 0.648, h + 10);
    ctx.lineTo(w * 0.594, L.islandBotY + 41);
    ctx.lineTo(w * 0.115, L.islandBotY - 33);
    ctx.lineTo(-20, L.islandTopY + 77);
    ctx.closePath();
    ctx.fill();

    // Subtle waterline foam shimmer along the seawall foot
    ctx.strokeStyle = pal.isNightLights ? "rgba(186, 230, 253, 0.24)" : "rgba(255, 255, 255, 0.52)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 78);
    ctx.lineTo(w * 0.115, L.islandBotY - 32);
    ctx.lineTo(w * 0.594, L.islandBotY + 42);
    ctx.lineTo(w * 0.648, h + 10);
    ctx.stroke();

    // Organic coastal foliage & embankment treeline tufts tucked neatly along the sea quay (kept south of boulevard)
    const bushStops = [0.22, 0.34, 0.45, 0.55];
    bushStops.forEach((f, idx) => {
      const bx = w * f;
      const by = (L.islandBotY - 38) + (((f - 0.12) / 0.48) * 74) - 5;
      ctx.fillStyle = pal.foliage;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(bx + k * 8.5, by + (idx % 2), 6.0 - Math.abs(k) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // 5. Adjacent Maritime Seaport (Finger Piers, Gantry Cranes, Stacked Containers & Berthed Vessels!)
    this._drawAdjacentSeaport(ctx, w, h, L, pal);

    // 6. Purposeful Highway Network (Coastal Causeway -> Waterfront Boulevard + Runway Underpass -> Terminal Plaza)
    this._drawIslandHighwayNetwork(ctx, w, h, L, pal);

    // Rich multi-layered concrete/asphalt tarmac aprons, expansion seams & markings
    this._drawTarmacDetails(ctx, w, h, L, pal);

    // 7. Runway, Strict Non-Overlapping South Apron Taxiway, Gate Stands & Helipads
    this._drawRunwayNetwork(ctx, w, L, pal);

    // 8. Far-Northern Crawlerway Road running directly from inside Horizontal Integration Facility to Launch Pad
    ctx.save();
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 11;
    ctx.globalAlpha = 0.68;
    ctx.beginPath();
    ctx.moveTo(L.hifX + 20, L.hifY + 8);
    ctx.quadraticCurveTo(w * 0.41, L.islandTopY + L.spanY * 0.065, L.padX, L.padY + 4);
    ctx.stroke();
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 9. Perspective-Aligned North Campus Buildings, VAB & HIF (drawn onto fgCtx so horizontal tow trailer glides BEHIND them!)
    const campusSlope = 0.02;
    const coastSlope = Math.min(0.14, (L.rwRightY - L.rwLeftY) / Math.max(1, L.rwRightX - L.rwLeftX) * 0.72);

    this._drawCryoTankFarm(ctx, L.padX + (L.isNarrow ? 34 : 54), L.padY + 2, pal);

    // 10. Main Pad Concrete Launch Mount & Twin Catch Towers (background steel lattice)
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.padX - 48, L.padY + 12);
    ctx.lineTo(L.padX - 34, L.padY - 4);
    ctx.lineTo(L.padX + 36, L.padY - 4);
    ctx.lineTo(L.padX + 50, L.padY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(L.padX - 30, L.padY - 4, 60, 2.5);
    ctx.fillStyle = pal.shadowColor;
    ctx.fillRect(L.padX - 18, L.padY + 2, 36, 6);

    this._drawLatticeTower(ctx, L.towerLeftX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);
    this._drawLatticeTower(ctx, L.towerRightX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);

    // Horizontal Integration Facility Rear Wall / Open Bay on background canvas
    this._drawHIFBase(ctx, L, pal);

    // === FOREGROUND OCCLUSION ARCHITECTURE LAYER (rendered onto fgCtx over passing horizontal crawlerway traffic!) ===
    this._drawVAB(fgCtx, L, pal);
    this._draw25DBuilding(fgCtx, w * 0.362, L.islandTopY + L.spanY * 0.148, L.isNarrow ? 28 : 50, 20, pal, { style: "ops", floors: 3, perspSlope: campusSlope });
    this._draw25DBuilding(fgCtx, w * 0.435, L.islandTopY + L.spanY * 0.138, L.isNarrow ? 24 : 42, 14, pal, { style: "warehouse", floors: 2, perspSlope: campusSlope });
    this._draw25DBuilding(fgCtx, w * 0.504, L.islandTopY + L.spanY * 0.136, L.isNarrow ? 24 : 42, 15, pal, { style: "terminal_annex", floors: 2, perspSlope: campusSlope });
    this._draw25DBuilding(fgCtx, w * 0.556, L.islandTopY + L.spanY * 0.128, L.isNarrow ? 24 : 38, 16, pal, { style: "hangar_small", floors: 1, perspSlope: campusSlope });
    if (!L.isNarrow) {
      this._draw25DBuilding(fgCtx, w * 0.692, L.islandTopY + L.spanY * 0.118, 40, 14, pal, { style: "ops", floors: 2, perspSlope: 0.03 });
    }

    // Perspective-aligned south waterfront & airport operations buildings (clamped strictly below runway!)
    const southBuildings = [
      { xFrac: 0.195, w: 46, h: 13, dyBelowRw: 22, style: "fire_station", floors: 1 },
      { xFrac: 0.275, w: 54, h: 15, dyBelowRw: 25, style: "ops", floors: 2 },
      { xFrac: 0.355, w: 60, h: 16, dyBelowRw: 26, style: "warehouse", floors: 1 },
      { xFrac: 0.435, w: 64, h: 18, dyBelowRw: 26, style: "terminal_annex", floors: 3 },
      { xFrac: 0.515, w: 54, h: 15, dyBelowRw: 25, style: "ops", floors: 2 },
      { xFrac: 0.580, w: 46, h: 13, dyBelowRw: 22, style: "warehouse", floors: 1 },
      { xFrac: 0.675, w: 66, h: 18, dyBelowRw: 28, style: "hangar_small", floors: 1 },
      { xFrac: 0.755, w: 56, h: 16, dyBelowRw: 30, style: "parking_deck", floors: 2 },
      { xFrac: 0.840, w: 50, h: 14, dyBelowRw: 32, style: "ops", floors: 2 }
    ];
    southBuildings.forEach((b, idx) => {
      if (L.isNarrow && idx % 2 === 1) return;
      const bx = w * b.xFrac;
      const bw = L.isNarrow ? b.w * 0.72 : b.w;
      const bh = L.isNarrow ? b.h * 0.85 : b.h;
      const rwBottom = L.rwYAtX(bx) + L.rwHalfAtX(bx);
      const by = rwBottom + b.dyBelowRw + bh;
      const shoreMaxY = b.xFrac < 0.60
        ? ((L.islandBotY - 38) + ((Math.max(0.12, b.xFrac) - 0.12) / 0.48) * 72) - 4
        : h - 18;
      if (by <= shoreMaxY && by - bh > rwBottom + 10) {
        this._draw25DBuilding(fgCtx, bx, by, bw, bh, pal, { style: b.style, floors: b.floors, perspSlope: coastSlope });
      }
    });

    // East apron ops & fuel complex strictly separated between Hangar and Radar Compound
    const eastCampusY = Math.min(L.hangarY + L.hangarH * 0.92, L.rwYAtX(L.hangarX + L.hangarW * 0.62) - L.rwHalfAtX(L.hangarX + L.hangarW * 0.62) - 28);
    this._draw25DBuilding(fgCtx, L.hangarX - L.hangarW * 0.56, L.hangarY + L.hangarH * 0.24, L.isNarrow ? 24 : 36, 14, pal, { style: "ops", floors: 2, perspSlope: 0.025 });
    if (!L.isNarrow) {
      this._draw25DBuilding(fgCtx, L.hangarX - 24, eastCampusY + 34, 38, 14, pal, { style: "hangar_small", floors: 1, perspSlope: 0.03 });
      this._drawCryoTankFarm(fgCtx, L.atcX - 42, L.atcY + 42, pal, { compact: true });
    }

    // 11. Connected West, North & East Satellite Terminals + Skybridges + Monumental Central Star Terminal
    this._drawSatelliteTerminalsAndBridges(fgCtx, L, pal);
    this._drawStarTerminal(fgCtx, L, pal);

    // 12. Static Aircraft Fleet Populating Terminal Gates & Remote Tarmac Stands
    this._drawStaticParkedAircraft(fgCtx, L, pal);

    // 13. Curved Arched Assembly Hangar Base + Radar Ground Station Centre + ATC Tower
    this._drawArchedHangarBase(fgCtx, L, pal);
    this._drawRadarCentre(fgCtx, L, pal);

    // 14. Foreground Lower-Right Curving Highway Causeway Bridge & Lower-Left Coastal Hillside
    this._drawForegroundBridgeAndCoast(fgCtx, w, h, L, pal);
  },

  _drawOffshoreLaunchPlatform(ctx, L, pal) {
    const px = L.offshorePadX;
    const py = L.offshorePadY;
    const sc = L.offshoreScale;

    ctx.save();
    // 1. Slender umbilical causeway trestle connecting offshore pad to north coast of peninsula
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = Math.max(2.2, 3.8 * sc);
    ctx.beginPath();
    ctx.moveTo(L.offshoreShoreX, L.offshoreShoreY);
    ctx.lineTo(px - 18 * sc, py + 4 * sc);
    ctx.stroke();
    ctx.strokeStyle = pal.archMid;
    ctx.lineWidth = Math.max(1.1, 2.0 * sc);
    ctx.beginPath();
    ctx.moveTo(L.offshoreShoreX - 1, L.offshoreShoreY - 1);
    ctx.lineTo(px - 19 * sc, py + 3 * sc);
    ctx.stroke();

    // Trestle piers into bay water
    for (let i = 1; i <= 4; i++) {
      const f = i / 5;
      const tx = L.offshoreShoreX + (px - 18 * sc - L.offshoreShoreX) * f;
      const ty = L.offshoreShoreY + (py + 4 * sc - L.offshoreShoreY) * f;
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(tx - 1.2, ty, 2.4, 7 * sc);
    }

    // 2. Water reflection & caisson shadow beneath expanded Falcon Heavy floating barge
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(px, py + 11 * sc, 82 * sc, 10 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin semi-submersible buoyancy pontoons & support caissons
    ctx.fillStyle = pal.shipHull;
    ctx.fillRect(px - 70 * sc, py + 3 * sc, 140 * sc, 5 * sc);
    [-56, -28, 0, 28, 56].forEach(ox => {
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(px + ox * sc - 3 * sc, py - 2 * sc, 6 * sc, 7 * sc);
    });

    // 3. Expanded Perspective Floating Deck (Center Orbital Mount + Two Side Booster Landing Pads!)
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(px - 78 * sc, py);
    ctx.lineTo(px - 62 * sc, py - 10 * sc);
    ctx.lineTo(px + 62 * sc, py - 10 * sc);
    ctx.lineTo(px + 78 * sc, py);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(px - 74 * sc, py - 1 * sc);
    ctx.lineTo(px - 60 * sc, py - 9 * sc);
    ctx.lineTo(px + 60 * sc, py - 9 * sc);
    ctx.lineTo(px + 74 * sc, py - 1 * sc);
    ctx.closePath();
    ctx.fill();

    // Main Central Pad Plinth + Twin Flanking Smaller Booster Recovery Pads (LZ-1 / LZ-2)
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.ellipse(px, py - 4.5 * sc, 18 * sc, 4.2 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    [L.offshoreLzLeftX, L.offshoreLzRightX].forEach(lzx => {
      ctx.fillStyle = pal.landShade;
      ctx.beginPath();
      ctx.ellipse(lzx, py - 4.0 * sc, 13 * sc, 3.4 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.isNightLights ? "rgba(253, 224, 152, 0.56)" : "rgba(255, 255, 255, 0.68)";
      ctx.lineWidth = Math.max(0.7, 1.15 * sc);
      ctx.beginPath();
      ctx.ellipse(lzx, py - 4.0 * sc, 9.5 * sc, 2.4 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Shore Core Integration Hangar at causeway head (where new center cores emerge via trailer!)
    const shX = L.offshoreShoreX - 6 * sc;
    const shY = L.offshoreShoreY - 2;
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(shX - 18 * sc, shY - 12 * sc, 30 * sc, 12 * sc);
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(shX - 18 * sc, shY - 13.5 * sc, 30 * sc, 3 * sc);
    ctx.fillStyle = "#09101E";
    ctx.fillRect(shX + 1 * sc, shY - 9 * sc, 9 * sc, 9 * sc);

    // Compact deck equipment shelter & main integration tower mast on center mount
    ctx.fillStyle = pal.archLight;
    ctx.fillRect(px - 22 * sc, py - 13 * sc, 9 * sc, 6 * sc);
    ctx.fillStyle = pal.towerSteel;
    ctx.fillRect(px - 15 * sc, py - 52 * sc, 4.2 * sc, 46 * sc);
    ctx.restore();
  },

  _drawAdjacentSeaport(ctx, w, h, L, pal) {
    ctx.save();
    // Follow the true southwest peninsula coastline segment (from (0, islandTopY+72) -> (0.12w, islandBotY-38))
    const shoreY = (px) => {
      const xA = 0, yA = L.islandTopY + 72;
      const xB = w * 0.12, yB = L.islandBotY - 38;
      const t = (px - xA) / Math.max(1, xB - xA);
      return yA + t * (yB - yA);
    };
    const dockX0 = w * 0.032;
    const dockY0 = shoreY(dockX0);
    const dockX1 = w * 0.115;
    const dockY1 = shoreY(dockX1);

    // Concrete port wharf apron flush inside the southwest seawall
    const slope = (dockY1 - dockY0) / Math.max(1, dockX1 - dockX0);
    ctx.fillStyle = pal.quayFill;
    ctx.beginPath();
    ctx.moveTo(dockX0 - 6, dockY0);
    ctx.lineTo(dockX1 + 10, dockY1);
    ctx.lineTo(dockX1 + 18, dockY1 - 22);
    ctx.lineTo(dockX0 + 4, dockY0 - 22);
    ctx.closePath();
    ctx.fill();

    // Wharf edge curb highlight
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(dockX0 - 6, dockY0);
    ctx.lineTo(dockX1 + 10, dockY1);
    ctx.stroke();

    // Two finger jetties projecting CLEARLY OUT INTO THE BLUE WATER beyond the seawall
    [0.25, 0.76].forEach((f, idx) => {
      const jx = dockX0 + (dockX1 - dockX0) * f;
      const jy = dockY0 + (dockY1 - dockY0) * f;
      const jetDx = -24;
      const jetDy = 24;

      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.moveTo(jx, jy + 3);
      ctx.lineTo(jx + 11, jy + 6);
      ctx.lineTo(jx + jetDx + 9, jy + jetDy + 6);
      ctx.lineTo(jx + jetDx - 2, jy + jetDy + 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archMid;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(jx + 10, jy + 3);
      ctx.lineTo(jx + jetDx + 8, jy + jetDy);
      ctx.lineTo(jx + jetDx - 2, jy + jetDy - 3);
      ctx.closePath();
      ctx.fill();

      // Statically berthed cargo vessel floating cleanly in open water alongside the outer pier!
      ctx.save();
      ctx.translate(jx + jetDx - 12, jy + jetDy + 10);
      ctx.rotate(slope * 0.42);
      this._drawDockedCargoVessel(ctx, idx, pal, L.isNarrow ? 0.72 : 0.92);
      ctx.restore();
    });

    // Stacked container blocks neatly tucked inside the wharf apron
    const containerPalette = [pal.archDark, pal.shipHull, pal.liveryAccent];
    for (let c = 0; c < (L.isNarrow ? 3 : 5); c++) {
      const frac = 0.14 + c * (L.isNarrow ? 0.28 : 0.18);
      const cx = dockX0 + (dockX1 - dockX0) * frac;
      const cy = shoreY(cx) - 8;
      ctx.fillStyle = containerPalette[c % containerPalette.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 10, cy + 10 * slope);
      ctx.lineTo(cx + 10, cy + 10 * slope - 4.2);
      ctx.lineTo(cx, cy - 4.2);
      ctx.closePath();
      ctx.fill();
    }

    // Port container gantry cranes on the wharf edge reaching outward over berthed ships in water
    const craneFracs = L.isNarrow ? [0.46] : [0.22, 0.72];
    craneFracs.forEach(cf => {
      const kx = dockX0 + (dockX1 - dockX0) * cf + 3;
      const ky = shoreY(kx) - 4;
      ctx.strokeStyle = pal.liveryAccent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(kx - 4, ky);
      ctx.lineTo(kx - 2, ky - 18);
      ctx.moveTo(kx + 4, ky + 2);
      ctx.lineTo(kx + 3, ky - 18);
      ctx.moveTo(kx + 8, ky - 15);
      ctx.lineTo(kx - 18, ky - 23);
      ctx.moveTo(kx - 2, ky - 18);
      ctx.lineTo(kx - 16, ky - 22);
      ctx.stroke();
    });
    ctx.restore();
  },

  _drawDockedCargoVessel(ctx, idx, pal, sc) {
    ctx.save();
    ctx.scale(sc, sc);
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(0, 5, 22, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.shipHull;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(17, -1);
    ctx.lineTo(22, -3.5);
    ctx.lineTo(19, 3.5);
    ctx.lineTo(-19, 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.shipSuper;
    ctx.fillRect(8, -7, 8, 6);
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(12, -6, 3.5, 2.2);

    ctx.fillStyle = idx % 2 === 0 ? pal.liveryAccent : pal.archMid;
    ctx.fillRect(-14, -4.5, 19, 3.5);
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(-10, -7, 11, 2.5);
    ctx.restore();
  },

  _drawIslandHighwayNetwork(ctx, w, h, L, pal) {
    ctx.save();
    // 1. Coastal Interchange arriving from foreground bridge onto island south bank (x = 0.65w, y = L.islandBotY + 14)
    const entryX = w * 0.65;
    const entryY = L.islandBotY + 14;
    const portEndX = w * 0.118;
    const portEndY = L.islandBotY - 46;

    // Waterfront Port Boulevard leading cleanly from bridge westwards into Adjacent Seaport Wharf!
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = L.isNarrow ? 6.5 : 8.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);
    ctx.quadraticCurveTo(w * 0.44, L.islandBotY + 4, portEndX, portEndY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 250, 235, 0.36)";
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Airport Parkway rising from interchange into Runway Underpass Tunnel Portal -> Star Terminal Arrival Plaza!
    const southPortalY = L.underpassY + L.underpassHalf + 7;
    const northPortalY = L.underpassY - L.underpassHalf - 6;

    // South approach segment into runway underpass
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = L.isNarrow ? 7 : 9;
    ctx.beginPath();
    ctx.moveTo(entryX, entryY);
    ctx.quadraticCurveTo(L.underpassX + 12, southPortalY + 26, L.underpassX, southPortalY);
    ctx.stroke();

    // North emergence segment curving purposefully straight into Star Terminal Arrival Forecourt Loop!
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 4, northPortalY);
    ctx.bezierCurveTo(
      L.underpassX - 18, northPortalY - 28,
      L.plazaX + 58 * L.termScale, L.plazaY + 24 * L.termScale,
      L.plazaX, L.plazaY
    );
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 250, 235, 0.36)";
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Terminal Ground Arrival Forecourt Loop
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.ellipse(L.plazaX, L.plazaY - 2, 26 * L.termScale, 7.5 * L.termScale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Concrete Tunnel Portals on both sides of the runway underpass
    [
      { x: L.underpassX, y: southPortalY },
      { x: L.underpassX - 4, y: northPortalY }
    ].forEach((pt, idx) => {
      ctx.fillStyle = pal.archMid;
      ctx.fillRect(pt.x - 10, pt.y - 4, 20, 7);
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(pt.x - 6, pt.y - (idx === 0 ? 3 : 1), 12, 4.5);
    });
    ctx.restore();
  },

  _drawCryoTankFarm(ctx, startX, baseY, pal, opts = {}) {
    ctx.save();
    const compact = Boolean(opts.compact);
    const count = compact ? 3 : 4;
    const stepX = compact ? 11 : 13;
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = compact ? 1.5 : 2.0;
    ctx.beginPath();
    ctx.moveTo(startX - 20, baseY - 3.5);
    ctx.lineTo(startX + count * stepX + 14, baseY - 3.5);
    ctx.stroke();

    // Twin vertical LOX / RP-1 process columns beside horizontal manifold
    if (!compact) {
      [-14, -7].forEach((ox, idx) => {
        const cx = startX + ox;
        const ch = idx === 0 ? 18 : 14;
        ctx.fillStyle = pal.shadowColor;
        ctx.fillRect(cx + 2, baseY - 1, 7, 3);
        const cg = ctx.createLinearGradient(cx - 3, baseY - ch, cx + 3, baseY);
        cg.addColorStop(0, pal.archLight);
        cg.addColorStop(1, pal.archMid);
        ctx.fillStyle = cg;
        ctx.fillRect(cx - 2.6, baseY - ch, 5.2, ch);
        ctx.beginPath();
        ctx.arc(cx, baseY - ch, 2.6, Math.PI, 0);
        ctx.fill();
      });
    }

    for (let i = 0; i < count; i++) {
      const tx = startX + i * stepX;
      const ty = baseY - (i % 2) * 2.0;
      const r = compact ? 4.4 : 5.4;
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(tx + 4.5 * pal.sunDir, ty + 2.5, r * 1.15, r * 0.38, 0.15, 0, Math.PI * 2);
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

  // Towering Stepped Vehicle Assembly Building (VAB) + High-Bay Integration Annex
  _drawVAB(ctx, L, pal) {
    const x = L.vabX;
    const y = L.vabY;
    const bw = L.vabW;
    const bh = L.vabH;
    const frontW = bw * 0.68;
    const depthX = bw * 0.32;
    const sd = pal.sunDir || 1.1;

    ctx.save();
    // Cast shadow across northern apron
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + frontW + bh * 0.42 * sd + depthX * 0.65, y + 6);
    ctx.lineTo(x + bw + bh * 0.42 * sd, y + 2);
    ctx.lineTo(x + frontW, y - 4);
    ctx.closePath();
    ctx.fill();

    // Lower East Integration Low-Bay Annex
    this._draw25DBuilding(ctx, x + bw * 0.78, y + 5, bw * 0.56, bh * 0.38, pal, { style: "ops", floors: 2, perspSlope: 0.03 });

    // Primary High-Bay Core Front Wall
    const fg = ctx.createLinearGradient(x, y - bh, x + frontW, y);
    fg.addColorStop(0, pal.archLight);
    fg.addColorStop(1, pal.archMid);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y + 2 - bh);
    ctx.lineTo(x + frontW, y + 2);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();

    // Shaded Side Cladding Flank
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y + 2 - bh);
    ctx.lineTo(x + bw, y - 3 - bh);
    ctx.lineTo(x + bw, y - 3);
    ctx.lineTo(x + frontW, y + 2);
    ctx.closePath();
    ctx.fill();

    // Rooftop Crane Penthouse & Sunlit Crown Trim
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + depthX * 0.85, y - bh - 5);
    ctx.lineTo(x + bw, y - 3 - bh);
    ctx.lineTo(x + frontW, y + 2 - bh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y + 2 - bh);
    ctx.stroke();

    // Giant Segmented High-Bay Vertical Integration Door
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(x + frontW * 0.25, y - bh * 0.84, frontW * 0.44, bh * 0.84 + 1);
    ctx.strokeStyle = pal.archMid;
    ctx.lineWidth = 0.7;
    for (let s = 1; s <= 4; s++) {
      const sy = y - bh * (0.17 * s);
      ctx.beginPath();
      ctx.moveTo(x + frontW * 0.25, sy);
      ctx.lineTo(x + frontW * 0.69, sy);
      ctx.stroke();
    }

    // Exterior steel vertical structural ribs & roof accent stripe
    ctx.strokeStyle = pal.archDark;
    ctx.globalAlpha = 0.28;
    [0.14, 0.84].forEach(rf => {
      ctx.beginPath();
      ctx.moveTo(x + frontW * rf, y - bh);
      ctx.lineTo(x + frontW * rf, y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(x + 2, y - bh * 0.94, frontW * 0.16, bh * 0.16);

    // Rooftop comms masts + crane housings
    ctx.fillStyle = pal.archLight;
    ctx.fillRect(x + frontW * 0.28, y - bh - 5, frontW * 0.44, 5);
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + frontW * 0.50, y - bh - 5);
    ctx.lineTo(x + frontW * 0.50, y - bh - 14);
    ctx.stroke();
    ctx.restore();
  },

  // Rich Multi-Zone Tarmac Apron, Expansion Joints, Service Roads & Stand Markings
  _drawTarmacDetails(ctx, w, h, L, pal) {
    ctx.save();

    // 1. Primary Terminal & Apron Paved Concrete Envelope
    ctx.beginPath();
    ctx.moveTo(w * 0.18, L.islandTopY + 18);
    ctx.lineTo(w * 0.89, L.islandTopY + 14);
    ctx.lineTo(w * 0.94, L.rwYAtX(w * 0.90) - L.rwHalfAtX(w * 0.90) - 8);
    ctx.lineTo(w * 0.14, L.rwYAtX(w * 0.16) - L.rwHalfAtX(w * 0.16) - 6);
    ctx.closePath();
    ctx.fillStyle = pal.apronFill;
    ctx.globalAlpha = 0.62;
    ctx.fill();

    // 2. Lighter Concrete Gate Hardstands around Star Terminal, SatWest, SatEast & Hangar Ramp
    ctx.globalAlpha = pal.isNightLights ? 0.24 : 0.34;
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(L.termX, L.termY + 28 * L.termScale, 178 * L.termScale, 36 * L.termScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(L.satWest.x, L.satWest.y + 18 * L.termScale, 58 * L.termScale, 19 * L.termScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(L.hangarX - L.hangarW * 0.08, L.hangarY + L.hangarH * 0.85, L.hangarW * 0.72, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft elliptical assembly concrete hardstands beneath VAB & HIF (zero floating box outline!)
    ctx.beginPath();
    ctx.ellipse(L.vabX, L.vabY + 4, L.vabW * 0.88, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(L.hifX, L.hifY + 7, L.hifW * 0.66, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Perspective Concrete Slab Expansion Grid Lines (subtle non-noisy architectural grain!)
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 0.75;
    ctx.globalAlpha = pal.isNightLights ? 0.16 : 0.18;
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const gx0 = w * (0.20 + f * 0.66);
      const gy0 = L.islandTopY + 20;
      const gx1 = gx0 + (f - 0.5) * 44;
      const gy1 = L.rwYAtX(gx0) - L.rwHalfAtX(gx0) - 10;
      if (gy1 > gy0 + 20) {
        ctx.beginPath();
        ctx.moveTo(gx0, gy0);
        ctx.lineTo(gx1, gy1);
        ctx.stroke();
      }
    }
    for (let r = 1; r <= 6; r++) {
      const sy = L.islandTopY + 24 + r * ((L.spanY * 0.45) / 6);
      ctx.beginPath();
      ctx.moveTo(w * 0.19, sy);
      ctx.quadraticCurveTo(w * 0.54, sy + 8, w * 0.89, sy + 16);
      ctx.stroke();
    }

    // 4. White Dashed Apron Service Vehicle Roadway Perimeter
    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = L.isNarrow ? 3.5 : 4.5;
    ctx.beginPath();
    ctx.moveTo(L.vabX + 18, L.vabY + 12);
    ctx.lineTo(w * 0.44, L.vabY + 8);
    ctx.lineTo(L.hifX + 20, L.hifY + 12);
    ctx.lineTo(L.hangarX - 24, L.hangarY + L.hangarH * 0.78);
    ctx.lineTo(L.radarX - 42, L.radarY + 24);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Apron Ground Support Equipment Clusters (fuel tankers, stairs & baggage carts at gates)
    ctx.globalAlpha = 0.88;
    L.gates.forEach((g, idx) => {
      if (L.isNarrow && idx >= 2) return;
      const ox = g.x + (idx % 2 === 0 ? -15 : 14);
      const oy = g.y - 5;
      // Red/white jet-blast hazard boundary box
      ctx.strokeStyle = "rgba(239, 68, 68, 0.42)";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(g.x - 10, g.y - 6, 20, 14);
      // Tiny parked ground cart + loader beside gate
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(ox - 3, oy - 1.5, 5.5, 2.6);
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(ox + 4, oy - 1.0, 3.2, 2.0);
    });

    // 6. Apron High-Mast Floodlight Poles + Night Pool Glows
    const poles = L.isNarrow
      ? [L.satWest, L.apronSE, { x: L.hangarX - 40, y: L.hangarY + L.hangarH }]
      : [
          { x: L.satWest.x - 16, y: L.satWest.y + 18 },
          { x: L.termX - 75 * L.termScale, y: L.termY + 38 * L.termScale },
          { x: L.termX + 78 * L.termScale, y: L.termY + 40 * L.termScale },
          { x: L.satEast.x + 22, y: L.satEast.y + 16 },
          { x: L.radarX - 58, y: L.radarY + 20 }
        ];
    poles.forEach(p => {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 12);
      ctx.stroke();
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(p.x - 2, p.y - 13, 4, 1.5);
      if (pal.isNightLights) {
        const lg = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 26);
        lg.addColorStop(0, "rgba(254, 240, 199, 0.24)");
        lg.addColorStop(1, "rgba(254, 240, 199, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 26, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  },

  // True 2-point perspective 2.5D building aligning cleanly with ground perspective slope!
  _draw25DBuilding(ctx, x, y, bw, bh, pal, opts = {}) {
    const style = opts.style || "warehouse";
    const floors = opts.floors || 1;
    const persp = opts.perspSlope || 0;
    const frontW = bw * 0.68;
    const depthX = bw * 0.32;
    const depthY = Math.max(2.5, Math.min(6.5, bh * 0.24));
    const sy = frontW * persp;
    const sd = pal.sunDir || 1.1;

    ctx.save();
    // 1. Directional cast solar shadow aligned along ground plane
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y + sy);
    ctx.lineTo(x + frontW + bh * 0.44 * sd + depthX * 0.55, y + sy + 4.0);
    ctx.lineTo(x + bw + bh * 0.44 * sd, y + sy + depthY * 0.55 + 3.5);
    ctx.lineTo(x + frontW, y + sy + depthY * 0.45);
    ctx.closePath();
    ctx.fill();

    // 2. Perspective-aligned front facade (keeps vertical lines strictly plumb!)
    const frontG = ctx.createLinearGradient(x, y - bh, x, y + sy);
    frontG.addColorStop(0, pal.archLight);
    frontG.addColorStop(1, pal.archMid);
    ctx.fillStyle = frontG;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y + sy - bh);
    ctx.lineTo(x + frontW, y + sy);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();

    // 3. Shaded isometric right flank wall
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y + sy - bh);
    ctx.lineTo(x + bw, y + sy - bh - depthY * 0.45 + 1.5);
    ctx.lineTo(x + bw, y + sy - depthY * 0.2 + 2.5);
    ctx.lineTo(x + frontW, y + sy);
    ctx.closePath();
    ctx.fill();

    // 4. Perspective rooftop deck + sunlit cornice highlight
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + depthX * 0.78, y - bh - depthY * 0.72);
    ctx.lineTo(x + bw, y + sy - bh - depthY * 0.45 + 1.5);
    ctx.lineTo(x + frontW, y + sy - bh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y + sy - bh);
    ctx.stroke();

    // 5. Restrained architectural superstructures
    if (style === "vab") {
      ctx.fillStyle = pal.windowGlassDark;
      ctx.beginPath();
      ctx.moveTo(x + frontW * 0.28, y + sy * 0.28 - bh * 0.82);
      ctx.lineTo(x + frontW * 0.70, y + sy * 0.70 - bh * 0.82);
      ctx.lineTo(x + frontW * 0.70, y + sy * 0.70);
      ctx.lineTo(x + frontW * 0.28, y + sy * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(x + frontW * 0.20, y + sy * 0.3 - bh - 3.5, frontW * 0.48, 3.5);
    } else if (style === "hangar_small") {
      ctx.fillStyle = pal.windowGlassDark;
      ctx.beginPath();
      ctx.moveTo(x + frontW * 0.14, y + sy * 0.14 - bh * 0.62);
      ctx.lineTo(x + frontW * 0.86, y + sy * 0.86 - bh * 0.62);
      ctx.lineTo(x + frontW * 0.86, y + sy * 0.86);
      ctx.lineTo(x + frontW * 0.14, y + sy * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.hangarInterior;
      ctx.beginPath();
      ctx.moveTo(x + frontW * 0.22, y + sy * 0.22 - bh * 0.36);
      ctx.lineTo(x + frontW * 0.78, y + sy * 0.78 - bh * 0.36);
      ctx.lineTo(x + frontW * 0.78, y + sy * 0.78 - bh * 0.06);
      ctx.lineTo(x + frontW * 0.22, y + sy * 0.22 - bh * 0.06);
      ctx.closePath();
      ctx.fill();
    } else if (style === "fire_station") {
      ctx.fillStyle = pal.chuteColor;
      ctx.fillRect(x + 2, y - bh + 1, frontW - 4, 2.4);
      for (let b = 0; b < 3; b++) {
        ctx.fillStyle = pal.windowGlassDark;
        ctx.fillRect(x + 4 + b * (frontW * 0.28), y + b * 0.6 - bh * 0.48, frontW * 0.20, bh * 0.48);
      }
    } else if (style === "parking_deck") {
      ctx.strokeStyle = pal.archDark;
      ctx.lineWidth = 0.8;
      for (let s = 1; s <= 4; s++) {
        const px = x + (frontW * s) / 5;
        ctx.beginPath();
        ctx.moveTo(px, y + (s / 5) * sy - bh);
        ctx.lineTo(px, y + (s / 5) * sy);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x + frontW * 0.36, y + sy * 0.4 - bh - 2.6, Math.max(4, frontW * 0.22), 2.2);
    }

    // 6. Slender perspective-aligned glazing ribbons
    if (style !== "hangar_small") {
      for (let fl = 0; fl < floors; fl++) {
        const yOff = -bh * (0.34 + fl * 0.28);
        const winH = Math.max(1.3, bh * 0.08);
        const fx0 = 3;
        const fx1 = frontW - 3;
        if (fx1 - fx0 > 4) {
          const y0 = y + (fx0 / frontW) * sy + yOff;
          const y1 = y + (fx1 / frontW) * sy + yOff;
          ctx.fillStyle = pal.windowGlassDark;
          ctx.beginPath();
          ctx.moveTo(x + fx0, y0 - 0.5);
          ctx.lineTo(x + fx1, y1 - 0.5);
          ctx.lineTo(x + fx1, y1 + winH + 0.5);
          ctx.lineTo(x + fx0, y0 + winH + 0.5);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = pal.windowGlow;
          ctx.beginPath();
          ctx.moveTo(x + fx0 + 0.6, y0);
          ctx.lineTo(x + fx1 - 0.6, y1);
          ctx.lineTo(x + fx1 - 0.6, y1 + winH);
          ctx.lineTo(x + fx0 + 0.6, y0 + winH);
          ctx.closePath();
          ctx.fill();
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
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - L.rwLeftHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY - L.rwRightHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY + L.rwRightHalf);
    ctx.lineTo(L.rwLeftX, L.rwLeftY + L.rwLeftHalf);
    ctx.closePath();
    ctx.fillStyle = pal.runwayFill;
    ctx.fill();

    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - L.rwLeftHalf + 2);
    ctx.lineTo(L.rwRightX, L.rwRightY - L.rwRightHalf + 4);
    ctx.moveTo(L.rwLeftX, L.rwLeftY + L.rwLeftHalf - 2);
    ctx.lineTo(L.rwRightX, L.rwRightY + L.rwRightHalf - 4);
    ctx.stroke();

    // Piano-key runway threshold stripes & blast-pad yellow chevrons
    const rwAng = L.rwAng;
    [0.015, 0.96].forEach((bPos, idx) => {
      const p = L.rwPt(bPos);
      const hw = L.rwLeftHalf + bPos * (L.rwRightHalf - L.rwLeftHalf);
      const dir = idx === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rwAng);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.42)";
      ctx.lineWidth = 1.1;
      for (let c = -1; c <= 1; c += 2) {
        ctx.beginPath();
        ctx.moveTo(dir * -6, 0);
        ctx.lineTo(dir * 2, c * hw * 0.65);
        ctx.stroke();
      }
      ctx.restore();
    });

    [0.04, 0.91].forEach((tPos) => {
      const p = L.rwPt(tPos);
      const hw = L.rwLeftHalf + tPos * (L.rwRightHalf - L.rwLeftHalf);
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

    // Open South Apron & Gate Lead-In Taxiway Network (strictly south/east around terminals!)
    const exitPt = L.rwPt(L.rwExitT);
    const entryPt = L.rwPt(L.rwEntryT);
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 9.5;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    // Arrival exit taxiway -> East apron -> Hangar
    ctx.moveTo(exitPt.x, exitPt.y - 12);
    ctx.bezierCurveTo(exitPt.x + 36, exitPt.y - 26, L.apronEast.x + 28, L.apronEast.y + 18, L.apronEast.x, L.apronEast.y);
    ctx.quadraticCurveTo(L.hangarDoorX + 12, L.hangarDoorY + 18, L.hangarDoorX, L.hangarDoorY);
    // Main South Apron taxiway -> West Satellite & Runway Entry
    ctx.moveTo(L.apronEast.x, L.apronEast.y);
    ctx.bezierCurveTo(L.apronSE.x, L.apronSE.y, L.apronSouth.x, L.apronSouth.y, L.apronSW.x, L.apronSW.y);
    ctx.quadraticCurveTo(entryPt.x + 26, entryPt.y - 14, entryPt.x, entryPt.y - 6);
    // West Satellite lead-off stub
    ctx.moveTo(L.apronSW.x, L.apronSW.y);
    ctx.lineTo(L.satWest.x + 8 * L.termScale, L.satWest.y + 44 * L.termScale);
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.44)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Painted gate lead-in parking bays at terminal stands
    L.gates.forEach(g => {
      if (L.isNarrow && g.id === "G_SC") return;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.36)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 12);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();

    this._drawHelipad(ctx, L.heliPad1, pal);
    this._drawHelipad(ctx, L.heliPad2, pal);
  },

  // Connected West & East Satellite Terminals + Elevated Glazed APM Skybridges
  _drawSatelliteTerminalsAndBridges(ctx, L, pal) {
    const sc = L.termScale;
    const bridges = [
      {
        x0: L.termX - 152 * sc, y0: L.termY - 8 * sc,
        x1: L.satWest.x + 36 * sc, y1: L.satWest.y - 2 * sc,
        sat: L.satWest, kind: "west", sScale: sc * 1.05
      },
      {
        x0: L.termX - 44 * sc, y0: L.termY - 12 * sc,
        x1: L.satNorth.x + 12 * sc, y1: L.satNorth.y + 4 * sc,
        sat: L.satNorth, kind: "north", sScale: sc * 0.72
      }
    ];
    if (!L.isNarrow) {
      bridges.push({
        x0: L.termX + 154 * sc, y0: L.termY - 6 * sc,
        x1: L.satEast.x - 36 * sc, y1: L.satEast.y - 2 * sc,
        sat: L.satEast, kind: "east", sScale: sc * 1.05
      });
    }

    bridges.forEach(br => {
      // Elevated skybridge APM transit corridor
      ctx.save();
      const ang = Math.atan2(br.y1 - br.y0, br.x1 - br.x0);
      const len = Math.hypot(br.x1 - br.x0, br.y1 - br.y0);
      for (let i = 1; i <= 2; i++) {
        const px = br.x0 + (br.x1 - br.x0) * (i / 3);
        const py = br.y0 + (br.y1 - br.y0) * (i / 3);
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(px - 1.5, py + 2, 3, 9 * sc);
      }
      ctx.translate(br.x0, br.y0);
      ctx.rotate(ang);
      ctx.fillStyle = pal.shadowColor;
      ctx.fillRect(0, 7 * sc, len, 4 * sc);
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(0, -3.5 * sc, len, 7.0 * sc);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(4 * sc, -1.4 * sc, Math.max(2, len - 8 * sc), 2.8 * sc);
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(0, -4.4 * sc, len, 2.4 * sc);
      ctx.restore();

      this._drawSatelliteTerminal(ctx, br.sat.x, br.sat.y, br.sScale, pal);
    });
  },

  _drawSatelliteTerminal(ctx, cx, cy, sc, pal) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);

    // Directional solar cast shadow
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(9 * pal.sunDir, 9, 58, 15, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Twin concourse jet-bridge loading piers protruding south/sides
    [-32, 32].forEach(jx => {
      ctx.strokeStyle = pal.archMid;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(jx, 5);
      ctx.lineTo(jx + (jx > 0 ? 9 : -9), 15);
      ctx.stroke();
    });

    // Multi-level winged concourse lower facade + twin glazing bands
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.roundRect(-54, -4, 108, 15, 5);
    ctx.fill();
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(-48, -1, 96, 3.2);
    ctx.fillRect(-46, 4.2, 92, 3.2);

    // Sculpted dual-tier wing canopy roof
    const rg = ctx.createLinearGradient(-54, -12, 54, 4);
    rg.addColorStop(0, pal.archLight);
    rg.addColorStop(0.6, pal.archMid);
    rg.addColorStop(1, pal.archDark);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(0, -3.5, 56, 12.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Central raised oval skylight cupola & aero comms spire
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(0, -9, 26, 7.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-4.5, -10);
    ctx.lineTo(4.5, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  _drawStarTerminal(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);

    // Large soft cast ground shadow beneath monumental terminal footprint
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(13 * pal.sunDir, 15, 206, 42, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Subtle restrained concourse glazing wash
    const underGlow = ctx.createRadialGradient(0, 6, 8, 0, 6, 168);
    underGlow.addColorStop(0, pal.isNightLights ? "rgba(253, 224, 152, 0.26)" : "rgba(255, 250, 236, 0.16)");
    underGlow.addColorStop(0.55, pal.isNightLights ? "rgba(251, 191, 36, 0.09)" : "rgba(255, 255, 255, 0.05)");
    underGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.ellipse(0, 8, 174, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    const arms = [
      { ax: -206, ay: 6, w: 15 },
      { ax: -136, ay: -23, w: 12 },
      { ax: 154, ay: -19, w: 12 },
      { ax: 208, ay: 16, w: 15 },
      { ax: 48, ay: 30, w: 13 }
    ];

    arms.forEach(a => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 13, a.ax, a.ay + 8.0);
      ctx.lineTo(a.ax, a.ay + 1.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 3, 0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.windowGlow;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.15, a.ay * 0.15 + 7.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.48 + 7.5, a.ax * 0.92, a.ay * 0.92 + 5.2);
      ctx.stroke();

      // Twin Jet-Bridge loading fingers per concourse arm
      [0.44, 0.72].forEach(jf => {
        ctx.strokeStyle = pal.archMid;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(a.ax * jf, a.ay * jf + 5);
        ctx.lineTo(a.ax * jf + (a.ax > 0 ? 10 : -10), a.ay * jf + 13);
        ctx.stroke();
      });
    });

    // Monumental 3-tier sculpted central rotunda canopy with perimeter glazing ribbon
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.ellipse(3, 6, 82, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.windowGlow;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(2, 6, 78, 22, 0, 0.12, Math.PI - 0.12);
    ctx.stroke();
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.ellipse(1, 2, 74, 21.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(0, -2.5, 65, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sculpted South Ground-Arrival Check-In Atrium Canopy
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(0, 19, 34, 7.5, 0, 0, Math.PI * 2);
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
      ctx.lineWidth = 0.95;
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
    ctx.moveTo(0, -114);
    ctx.quadraticCurveTo(8, -38, 28, -1);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(0, -114);
    ctx.quadraticCurveTo(-6, -38, -25, -1);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.windowGlow;
    ctx.beginPath();
    ctx.ellipse(0, -16, 6.0, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawStarTerminalSpireOcclusion(ctx, L, pal) {
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(L.termScale, L.termScale);
    this._drawStarTerminalSpireGeometry(ctx, pal);
    ctx.restore();
  },

  _drawStaticParkedAircraft(ctx, L, pal) {
    const sc = L.termScale;
    const parked = [
      { x: L.termX - 66 * sc, y: L.termY + 26 * sc, ang: -0.45, s: 0.40 * sc, v: "airliner" },
      { x: L.termX + 82 * sc, y: L.termY + 27 * sc, ang: 2.68, s: 0.44 * sc, v: "starliner" },
      { x: L.satWest.x - 16 * sc, y: L.satWest.y + 18 * sc, ang: 0.65, s: 0.34 * sc, v: "fighter" },
      { x: L.hangarX + L.hangarW * 0.12, y: L.hangarY + L.hangarH * 1.08, ang: 2.35, s: 0.42 * sc, v: "bomber" }
    ];
    if (!L.isNarrow) {
      parked.push(
        { x: L.satEast.x - 24 * sc, y: L.satEast.y + 34 * sc, ang: 2.25, s: 0.38 * sc, v: "clipper" },
        { x: L.termX + 196 * sc, y: L.termY + 8 * sc, ang: -2.95, s: 0.36 * sc, v: "shuttle" }
      );
    }
    parked.forEach(pk => {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(pk.ang);
      ctx.scale(pk.s, pk.s);
      this._drawSpaceplaneModel(ctx, pk.v, pal, 0, 0, 1.0);
      ctx.restore();
    });
  },

  // Horizontal Integration Facility (HIF) Base + Foreground Occlusion Shell (rocket+tug spawn inside!)
  _drawHIFBase(ctx, L, pal) {
    const x = L.hifX - L.hifW * 0.5;
    const y = L.hifY - L.hifH * 0.55;
    const bw = L.hifW;
    const bh = L.hifH;
    ctx.save();
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.hifX + 10 * pal.sunDir, L.hifY + 8, bw * 0.56, bh * 0.35, 0.04, 0, Math.PI * 2);
    ctx.fill();
    // Deep dark western assembly bay portal opening onto crawlerway
    ctx.fillStyle = "#0B1120";
    ctx.beginPath();
    ctx.roundRect(L.hifDoorX, y + 3, bw * 0.25, bh - 2, 2);
    ctx.fill();
    const bayG = ctx.createRadialGradient(L.hifDoorX + 4, L.hifDoorY, 2, L.hifDoorX + 8, L.hifDoorY, bh * 1.1);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.fillRect(L.hifDoorX - 6, y, bw * 0.40, bh + 4);
    ctx.restore();
  },

  _drawHIFOcclusionRoof(ctx, L, pal) {
    const x = L.hifX - L.hifW * 0.5;
    const y = L.hifY - L.hifH * 0.55;
    const bw = L.hifW;
    const bh = L.hifH;
    ctx.save();
    // Main HIF metallic hall cladding starting cleanly to the right of the open bay aperture (doorX+2..right edge)
    const shellX = L.hifDoorX + 2;
    const shellW = (x + bw) - shellX;
    const fg = ctx.createLinearGradient(shellX, y, shellX, y + bh);
    fg.addColorStop(0, pal.archLight);
    fg.addColorStop(1, pal.archMid);
    ctx.fillStyle = fg;
    ctx.fillRect(shellX, y, shellW * 0.78, bh + 4);

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(shellX + shellW * 0.78, y);
    ctx.lineTo(shellX + shellW, y + 4);
    ctx.lineTo(shellX + shellW, y + bh + 6);
    ctx.lineTo(shellX + shellW * 0.78, y + bh + 4);
    ctx.closePath();
    ctx.fill();

    // Beveled industrial roof + structural crane ribs
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(L.hifDoorX - 4, y);
    ctx.lineTo(L.hifDoorX + 8, y - 5);
    ctx.lineTo(shellX + shellW, y - 2);
    ctx.lineTo(shellX + shellW * 0.78, y);
    ctx.closePath();
    ctx.fill();

    // Header lintel right over open bay entrance so emerging crawler appears cleanly inside doorway
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(L.hifDoorX - 4, y, 16, bh * 0.28);
    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(L.hifDoorX - 4, y);
    ctx.lineTo(shellX + shellW * 0.78, y);
    ctx.stroke();
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
    ctx.ellipse(L.hangarX + 12 * pal.sunDir, y + hh * 0.56, hw * 0.54, hh * 0.24, 0.04, 0, Math.PI * 2);
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

  // Large Deep-Space Satellite Ground Station Compound + Synchronized Dish Plinths + Tall Control Tower
  _drawRadarCentre(ctx, L, pal) {
    ctx.save();
    const rx = L.radarX;
    const ry = L.radarY;

    // 1. Expansive Terraced Paved Ground Station Compound & Perimeter Curbing
    ctx.fillStyle = pal.apronFill;
    ctx.beginPath();
    ctx.ellipse(rx - (L.isNarrow ? 4 : 12), ry + (L.isNarrow ? 10 : 12), L.isNarrow ? 54 : 98, L.isNarrow ? 25 : 42, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Inner graveled array pad backing the synchronized dish row
    ctx.fillStyle = pal.quayFill;
    ctx.beginPath();
    ctx.ellipse(rx, ry + 2, L.isNarrow ? 44 : 84, L.isNarrow ? 14 : 20, 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 2. Large Multi-Wing Telemetry & Uplink Operations Centre Building
    this._draw25DBuilding(ctx, rx - (L.isNarrow ? 42 : 76), ry + (L.isNarrow ? 24 : 34), L.isNarrow ? 34 : 58, L.isNarrow ? 15 : 22, pal, { style: "ops", floors: 3, perspSlope: 0.04 });

    // 3. Graduated Geodesic Radomes on Lower-West Pad
    const domes = L.isNarrow
      ? [{ x: rx - 10, y: ry + 20, r: 9.0 }, { x: rx - 28, y: ry + 24, r: 6.5 }]
      : [
          { x: rx - 24, y: ry + 25, r: 13.0 },
          { x: rx - 48, y: ry + 28, r: 9.2 },
          { x: rx - 4, y: ry + 30, r: 7.4 }
        ];

    domes.forEach(d => {
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(d.x + 5 * pal.sunDir, d.y + 3, d.r * 1.1, d.r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(d.x - d.r * 0.44, d.y - d.r * 0.85, d.r * 0.88, d.r * 1.15);

      const radG = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 1.75, 1, d.x, d.y - d.r * 1.55, d.r);
      radG.addColorStop(0, pal.archLight);
      radG.addColorStop(0.65, pal.archMid);
      radG.addColorStop(1, pal.archDark);
      ctx.fillStyle = radG;
      ctx.beginPath();
      ctx.arc(d.x, d.y - d.r * 1.55, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Concrete Pedestal Plinth Foundations for the Parabolic Dish Array
    (L.radarDishes || []).forEach(d => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.roundRect(d.x - 4.5, d.y - 2, 9, 5, 1.5);
      ctx.fill();
    });
    ctx.restore();

    // 5. Tall Sculpted Double-Deck Air Traffic Control Tower
    this._drawControlTower(ctx, L, pal);
  },

  _drawControlTower(ctx, L, pal) {
    ctx.save();
    const ax = L.atcX;
    const ay = L.atcY;
    const hScale = L.isNarrow ? 0.72 : 1.05;
    const shaftH = 74 * hScale;

    // Ground operations terminal annex beneath control tower
    this._draw25DBuilding(ctx, ax - 18 * hScale, ay + 6, 36 * hScale, 13 * hScale, pal, { style: "ops", floors: 2, perspSlope: 0.04 });

    // Long directional solar cast shadow
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(ax + 7 * hScale, ay);
    ctx.lineTo(ax + 44 * pal.sunDir * hScale, ay + 7);
    ctx.lineTo(ax + 46 * pal.sunDir * hScale, ay + 13);
    ctx.lineTo(ax - 5 * hScale, ay + 2);
    ctx.closePath();
    ctx.fill();

    // Tapered Fluted Dual-Tone Tower Shaft
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 8 * hScale, ay);
    ctx.lineTo(ax - 4.2 * hScale, ay - shaftH);
    ctx.lineTo(ax + 0.6 * hScale, ay - shaftH);
    ctx.lineTo(ax + 1.2 * hScale, ay);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(ax + 1.2 * hScale, ay);
    ctx.lineTo(ax + 0.6 * hScale, ay - shaftH);
    ctx.lineTo(ax + 5.5 * hScale, ay - shaftH);
    ctx.lineTo(ax + 8 * hScale, ay);
    ctx.closePath();
    ctx.fill();

    // Lower Equipment Ring Collar + Cantilevered Double-Deck Glass Cab
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 11 * hScale, ay - shaftH + 6 * hScale, 22 * hScale, 4.2 * hScale);

    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 15 * hScale, ay - shaftH - 12 * hScale);
    ctx.lineTo(ax + 15 * hScale, ay - shaftH - 12 * hScale);
    ctx.lineTo(ax + 10.5 * hScale, ay - shaftH + 3 * hScale);
    ctx.lineTo(ax - 10.5 * hScale, ay - shaftH + 3 * hScale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(ax - 12 * hScale, ay - shaftH - 9.5 * hScale, 24 * hScale, 7.2 * hScale);
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(ax - 10.5 * hScale, ay - shaftH - 8.2 * hScale, 21 * hScale, 5.2 * hScale);

    // Rooftop ASDE-X Surveillance Dome & Twin Comms Antennae
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 15.5 * hScale, ay - shaftH - 15 * hScale, 31 * hScale, 2.8 * hScale);
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.arc(ax, ay - shaftH - 17.5 * hScale, 4.2 * hScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ax - 5 * hScale, ay - shaftH - 15 * hScale);
    ctx.lineTo(ax - 5 * hScale, ay - shaftH - 29 * hScale);
    ctx.moveTo(ax + 5 * hScale, ay - shaftH - 15 * hScale);
    ctx.lineTo(ax + 5 * hScale, ay - shaftH - 25 * hScale);
    ctx.stroke();
    ctx.restore();
  },

  // Synchronized Row of Parabolic Deep-Space Dishes Swinging Periodically Together
  _drawAnimatedRadarDishes(ctx, L, pal, step) {
    const dishes = L.radarDishes || [];
    if (dishes.length === 0) return;

    // Periodic dwell-and-slew sweep (1 period per ~7.2 step units):
    // Track slow East pass -> smooth slew West -> Track slow West pass -> smooth return slew East
    const cycle = (step * 0.14) % 1;
    const smooth = (t) => t * t * (3 - 2 * t);
    let sharedAim;
    if (cycle < 0.34) {
      sharedAim = -1.14 + (cycle / 0.34) * 0.12;
    } else if (cycle < 0.50) {
      sharedAim = -1.02 + smooth((cycle - 0.34) / 0.16) * 0.56;
    } else if (cycle < 0.84) {
      sharedAim = -0.46 + ((cycle - 0.50) / 0.34) * 0.10;
    } else {
      sharedAim = -0.36 - smooth((cycle - 0.84) / 0.16) * 0.78;
    }
    this._lastDishAim = sharedAim;
    const isTracking = cycle < 0.34 || (cycle >= 0.50 && cycle < 0.84);

    ctx.save();
    dishes.forEach(d => {
      // Ground cast shadow
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(d.x + 4.5 * pal.sunDir, d.y + 2.2, d.r * 0.95, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // A-frame steel gimbal pedestal
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(d.x - 3.2, d.y + 1);
      ctx.lineTo(d.x, d.y - d.r * 1.15);
      ctx.lineTo(d.x + 3.2, d.y + 1);
      ctx.stroke();

      // Synchronized gimbal bowl & sub-reflector tripod feed horn
      ctx.save();
      ctx.translate(d.x, d.y - d.r * 1.24);
      ctx.rotate(sharedAim);

      // Backing counterweight yoke
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-1.5, -2.5, 4.2, 5.0);

      // Parabolic reflector dish bowl
      const dg = ctx.createLinearGradient(0, -d.r, 0, d.r);
      dg.addColorStop(0, pal.archLight);
      dg.addColorStop(1, pal.archMid);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, Math.PI * 0.56, Math.PI * 1.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.archDark;
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Feed horn quadripod + uplink status LED
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, -d.r * 0.65);
      ctx.lineTo(-d.r * 0.82, 0);
      ctx.moveTo(0, d.r * 0.65);
      ctx.lineTo(-d.r * 0.82, 0);
      ctx.stroke();

      ctx.fillStyle = isTracking && pal.isNightLights ? pal.liveryAccent : pal.archLight;
      ctx.beginPath();
      ctx.arc(-d.r * 0.84, 0, 1.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  },

  _drawForegroundBridgeAndCoast(ctx, w, h, L, pal) {
    ctx.save();
    const p0x = w * 0.65;
    const p0y = L.islandBotY + 14;
    const cpx = w * 0.61;
    const cpy = h * 0.90;
    const p2x = w * 0.93;
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

    // Lush sculpted foreground coastal headland in extreme bottom-left corner
    ctx.fillStyle = pal.foliage;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.74);
    ctx.quadraticCurveTo(w * 0.08, h * 0.79, w * 0.16, h * 0.87);
    ctx.quadraticCurveTo(w * 0.28, h * 0.92, w * 0.40, h);
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
  _getTaxiToRunwayPath(L, fromPt = null) {
    const entryPt = L.rwPt(L.rwEntryT);
    const rwAng = L.rwAng;
    const pStart = fromPt || { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
    const pEast = L.apronEast;
    const pSW = L.apronSW;
    const pHold = { x: entryPt.x - Math.cos(rwAng) * 14, y: entryPt.y - Math.sin(rwAng) * 14 };
    const segs = [];
    if (!fromPt) {
      segs.push([pStart, { x: L.hangarDoorX - 8, y: L.hangarDoorY + 26 }, { x: pEast.x + 12, y: pEast.y - 16 }, pEast]);
      segs.push([pEast, L.apronSE, L.apronSouth, pSW]);
    } else {
      segs.push([pStart, { x: pStart.x, y: L.apronSouth.y + 8 }, { x: pSW.x + 28, y: pSW.y + 6 }, pSW]);
    }
    segs.push([pSW, { x: (pSW.x + pHold.x) * 0.5, y: pSW.y + 8 }, { x: pHold.x + 18, y: pHold.y - 16 }, pHold]);
    return this._buildArcPath(segs, 36);
  },

  _getExitToGatePath(L, gate) {
    const exitPt = L.rwPt(L.rwExitT);
    const dirX = Math.cos(L.rwAng);
    const dirY = Math.sin(L.rwAng);
    const pEast = L.apronEast;
    const segs = [
      [exitPt, { x: exitPt.x + dirX * 48, y: exitPt.y + dirY * 48 }, { x: pEast.x + 42, y: pEast.y + 26 }, pEast],
      [pEast, L.apronSE, gate.approachPt, gate]
    ];
    return this._buildArcPath(segs, 36);
  },

  _getGateToHangarPath(L, gate) {
    const pEast = L.apronEast;
    const pInside = { x: L.hangarX + 26, y: L.hangarDoorY - 5 };
    return this._buildArcPath([
      [gate, gate.approachPt, L.apronSE, pEast],
      [pEast, { x: pEast.x + 10, y: pEast.y - 22 }, { x: L.hangarDoorX - 12, y: L.hangarDoorY + 14 }, pInside]
    ], 36);
  },

  _getTaxiToHangarPath(L) {
    const exitPt = L.rwPt(L.rwExitT);
    const dirX = Math.cos(L.rwAng);
    const dirY = Math.sin(L.rwAng);
    const pEast = L.apronEast;
    const pInside = { x: L.hangarX + 26, y: L.hangarDoorY - 5 };
    return this._buildArcPath([
      [exitPt, { x: exitPt.x + dirX * 48, y: exitPt.y + dirY * 48 }, { x: pEast.x + 42, y: pEast.y + 26 }, pEast],
      [pEast, { x: pEast.x + 10, y: pEast.y - 22 }, { x: L.hangarDoorX - 12, y: L.hangarDoorY + 14 }, pInside]
    ], 38);
  },

  _getApronShuttleOutPath(L, gate) {
    const pStart = { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
    const pEast = L.apronEast;
    const tgtGate = gate || L.gates[0];
    return this._buildArcPath([
      [pStart, { x: L.hangarDoorX - 8, y: L.hangarDoorY + 26 }, { x: pEast.x + 12, y: pEast.y - 16 }, pEast],
      [pEast, L.apronSE, tgtGate.approachPt, tgtGate]
    ], 36);
  },

  _getApronShuttleReturnPath(L, gate) {
    const srcGate = gate || L.gates[0];
    return this._getGateToHangarPath(L, srcGate);
  },

  // Fast, super-smooth C1-tangent climb directly out of runway liftoff!
  _getTakeoffClimbPath(L, w, h, sp) {
    const liftPt = L.rwPt(0.72);
    const dirX = Math.cos(L.rwAng);
    const dirY = Math.sin(L.rwAng);
    const endY = h * (0.06 + (sp.id === "sp_flight_2" ? 0.04 : 0));
    return this._buildArcPath([
      [
        liftPt,
        // Strictly collinear ahead along runway vector for seamless zero-kink rotation!
        { x: liftPt.x + dirX * 155, y: liftPt.y + dirY * 155 },
        { x: w * 0.88, y: liftPt.y * 0.50 },
        { x: w + 120, y: endY }
      ]
    ], 58);
  },

  // Shallow ~3.2° approach slope with gentle flare right before touchdown!
  _getApproachPath(L) {
    const tdPt = L.rwPt(0.14);
    const glideSlopeAng = L.rwAng - 0.048; // ~2.75 deg shallower than flat runway perspective = gentle descent above runway
    const dx = tdPt.x - (-110);
    const startPt = { x: -110, y: Math.max(24, tdPt.y - Math.tan(glideSlopeAng) * dx - 28) };
    const dirX = Math.cos(L.rwAng);
    const dirY = Math.sin(L.rwAng);
    return this._buildArcPath([
      [
        startPt,
        { x: startPt.x + dx * 0.35, y: startPt.y + (tdPt.y - startPt.y) * 0.38 },
        { x: tdPt.x - dirX * 120, y: tdPt.y - dirY * 120 - 4 },
        tdPt
      ]
    ], 56);
  },

  _getHeliPatrolPath(L, w, h, pad, variant) {
    const hover = { x: pad.x, y: pad.y - 28 };
    if (variant === 0) {
      const p1 = { x: w * 0.54, y: L.islandTopY - 22 };
      const p2 = { x: L.padX - 42, y: L.padY - 56 };
      const p3 = { x: w * 0.28, y: L.islandBotY + 36 };
      const p4 = { x: w * 0.62, y: L.islandBotY + 14 };
      return this._buildArcPath([
        [hover, { x: w * 0.78, y: L.islandTopY - 38 }, { x: w * 0.64, y: L.islandTopY - 26 }, p1],
        [p1, { x: w * 0.36, y: L.islandTopY - 18 }, { x: L.padX + 20, y: L.padY - 72 }, p2],
        [p2, { x: L.padX - 85, y: L.padY + 25 }, { x: w * 0.14, y: L.islandBotY + 12 }, p3],
        [p3, { x: w * 0.40, y: L.islandBotY + 56 }, { x: w * 0.52, y: L.islandBotY + 36 }, p4],
        [p4, { x: w * 0.78, y: L.islandBotY - 20 }, { x: hover.x + 18, y: hover.y + 42 }, hover]
      ], 28);
    }
    const p1 = { x: w * 0.48, y: L.islandBotY + 34 };
    const p2 = { x: w * 0.78, y: L.termY + 46 };
    const p3 = { x: w * 0.52, y: L.islandTopY + 10 };
    return this._buildArcPath([
      [hover, { x: w * 0.34, y: L.islandBotY + 16 }, { x: w * 0.40, y: L.islandBotY + 40 }, p1],
      [p1, { x: w * 0.62, y: L.islandBotY + 26 }, { x: w * 0.78, y: L.islandBotY - 30 }, p2],
      [p2, { x: w * 0.78, y: L.islandTopY + 6 }, { x: w * 0.64, y: L.islandTopY - 4 }, p3],
      [p3, { x: w * 0.36, y: L.islandTopY + 26 }, { x: hover.x - 16, y: hover.y - 38 }, hover]
    ], 28);
  },

  ensureEntities(w, h, now) {
    const L = this.getLayout(w, h);
    const isNarrow = L.isNarrow;

    if (this.stars.length === 0) {
      const count = isNarrow ? 34 : 66;
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
      for (let i = 0; i < (isNarrow ? 4 : 6); i++) {
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
      for (let i = 0; i < (isNarrow ? 4 : 7); i++) {
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
      const count = isNarrow ? 24 : 44;
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

    // Populated Maritime Fleet in Upper Archipelago Bay & Lower Channel (including Background Container Ships!)
    if (this.ships.length === 0) {
      const upperSpan = Math.max(18, L.islandTopY - L.horizonY);
      this.ships = [
        { kind: "recovery_ship", zone: "lower", x: w * 0.30, y: h * 0.83, vx: 4.0, minX: w * 0.14, maxX: w * 0.56, scale: 1.0 },
        { kind: "ferry", zone: "lower", x: w * 0.48, y: h * 0.90, vx: -5.2, minX: w * 0.20, maxX: w * 0.60, scale: 0.86 },
        { kind: "container_ship", zone: "lower", x: w * 0.18, y: h * 0.87, vx: 3.1, minX: w * 0.06, maxX: w * 0.52, scale: 0.84 },
        { kind: "container_ship", zone: "upper", x: w * 0.35, y: L.horizonY + upperSpan * 0.44, vx: 2.0, minX: w * 0.04, maxX: w * 0.64, scale: 0.42 },
        { kind: "container_ship", zone: "upper", x: w * 0.58, y: L.horizonY + upperSpan * 0.26, vx: -1.7, minX: w * 0.14, maxX: w * 0.94, scale: 0.36 },
        { kind: "cargo_far", zone: "upper", x: w * 0.47, y: L.horizonY + upperSpan * 0.64, vx: 1.8, minX: w * 0.08, maxX: w * 0.64, scale: 0.44 }
      ];
      if (!isNarrow) {
        this.ships.push(
          { kind: "container_ship", zone: "upper", x: w * 0.90, y: L.horizonY + upperSpan * 0.62, vx: -1.8, minX: w * 0.81, maxX: w * 0.96, scale: 0.44 },
          { kind: "ferry", zone: "upper", x: w * 0.22, y: L.horizonY + upperSpan * 0.74, vx: 2.8, minX: w * 0.06, maxX: w * 0.62, scale: 0.52 },
          { kind: "cargo_far", zone: "upper", x: w * 0.11, y: L.horizonY + upperSpan * 0.34, vx: 1.7, minX: w * 0.03, maxX: w * 0.48, scale: 0.44 },
          { kind: "recovery_ship", zone: "lower", x: w * 0.42, y: h * 0.95, vx: 3.4, minX: w * 0.26, maxX: w * 0.64, scale: 0.78 }
        );
      }
      this.boats = this.ships;
    }

    // Helicopters taking off, landing & patrolling around base
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
          speed: 24,
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

    // Tiny Ground Handling Vehicles traversing tarmac gates & coastal highway viaduct!
    if (this.groundVehicles.length === 0) {
      const gvCount = isNarrow ? 3 : 6;
      const specs = [
        { route: "apron", kind: "fuel_truck", spd: 11.5, d: 0.15 },
        { route: "apron", kind: "baggage_tug", spd: 13.0, d: 0.55 },
        { route: "highway_plaza", kind: "crew_van", spd: 18.0, d: 0.22 },
        { route: "apron", kind: "follow_me", spd: 14.5, d: 0.80 },
        { route: "highway_port", kind: "cargo_lorry", spd: 16.0, d: 0.35 },
        { route: "highway_plaza", kind: "shuttle_bus", spd: 17.5, d: 0.72 }
      ];
      for (let i = 0; i < gvCount; i++) {
        this.groundVehicles.push({
          ...specs[i],
          dir: i % 2 === 0 ? 1 : -1,
          x: L.termX,
          y: L.termY + 38,
          heading: 0
        });
      }
    }

    if (!this.rocket) {
      this.rocket = {
        phase: "tow_out",
        t: 11.0,
        phaseDuration: this._rand(26.0, 32.0),
        armClose: 0.0,
        variant: this._pick(["heavy_starship", "orbital_cargo"]),
        x: 0,
        y: 0,
        angle: -Math.PI * 0.5
      };
    }

    // Offshore Falcon Heavy 7-Phase Integration, Launch, Twin Booster Landing & Crane Re-Mating System
    if (!this.offshoreRocket) {
      this.offshoreRocket = {
        phase: "booster_attach",
        t: 0.8,
        phaseDuration: 7.0,
        legDeploy: 0,
        leftLegDeploy: 0,
        rightLegDeploy: 0,
        x: L.offshorePadX,
        y: L.offshorePadY - 4.5 * L.offshoreScale,
        angle: 0
      };
    }

    // Rare Colossal Multi-Deck Sci-Fi Mega-Liner (Runway Land -> Terminal Board -> Pad Vertical Launch)
    if (!this.megaliner) {
      this.megaliner = {
        phase: "dormant_wait",
        t: 18.0,
        phaseDuration: 34.0,
        dist: 0,
        speed: 0,
        x: -80,
        y: L.horizonY - 14,
        heading: L.rwAng,
        altitude: 0,
        pitchLift: 0,
        chuteDetached: false,
        detachedChuteX: 0,
        detachedChuteY: 0,
        detachedChuteAlpha: 0
      };
    }

    if (this.spaceplanes.length === 0) {
      const depPath = this._getTaxiToRunwayPath(L);
      const aprPath = this._getApronShuttleOutPath(L, L.gates[0]);
      const sp0Start = this._sampleArcPath(depPath, depPath.totalLen * 0.42);
      const sp2Start = this._sampleArcPath(aprPath, aprPath.totalLen * 0.35);

      this.spaceplanes = [
        {
          id: "sp_flight_1",
          role: "runway",
          variant: "starliner",
          gateIdx: 0,
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
          variant: "fighter",
          gateIdx: 1,
          phase: "approach",
          t: 0,
          phaseDuration: 8.0,
          dist: 60,
          speed: 68,
          x: -50,
          y: L.horizonY - 12,
          heading: L.rwAng,
          altitude: 18,
          chuteDetached: false,
          detachedChuteX: 0,
          detachedChuteY: 0,
          detachedChuteAlpha: 0
        },
        {
          id: "sp_apron_3",
          role: "apron",
          variant: "bomber",
          gateIdx: 2,
          phase: "apron_taxi_out",
          t: 0,
          phaseDuration: 45.0,
          dist: aprPath.totalLen * 0.35,
          speed: 8.5,
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
      this.rocket.phaseDuration = this._rand(13.0, 15.5);
    } else if (this.offshoreRocket && (this.offshoreRocket.phase === "booster_attach" || this.offshoreRocket.phase === "pad_idle") && this.offshoreRocket.t > 1.5) {
      this.offshoreRocket.phase = "strongback_retract";
      this.offshoreRocket.t = 0;
      this.offshoreRocket.phaseDuration = 3.8;
    } else if (this.spaceplanes.length > 0) {
      const idle = this.spaceplanes.find(sp => sp.role === "runway" && (sp.phase === "hangar_rest" || sp.phase === "sky_wait") && sp.t > 0.8);
      if (idle) {
        idle.phase = idle.phase === "hangar_rest" ? "hangar_emerge" : "approach";
        idle.t = 0;
        idle.dist = 0;
        idle.speed = idle.phase === "approach" ? 76 : 0;
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
    // Invalidate dynamic entity sizing cleanly across responsive desktop <-> mobile resizes
    if (this._lastW && Math.abs(this._lastW - w) > 20) {
      this.groundVehicles = [];
    }
    this._lastW = w;
    this._lastH = h;
    this._lastMode = mode;

    const now = performance.now();
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h, now);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached 2.5D coastal terrain, runway, crawlerway & pad infrastructure
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Subtle Animated Sky & Clipped Water Shimmer
    this._drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step);

    // 3. Ships Gliding Across Upper Archipelago Bay & Lower Sea Channel
    this._updateAndDrawShips(ctx, w, h, L, pal, dt, step);

    // 4. Offshore Falcon Heavy Launch, Dual Booster Pad Recovery & Crane Re-Mating
    this._updateAndDrawOffshoreRocket(ctx, L, pal, dt, step, w, h);

    // 5. Orbital Streaks
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

    // Depth-sorted heavy orbital rocket: during horizontal tow along crawlerway, glide BEHIND VAB & North buildings!
    const rPhase = this.rocket ? this.rocket.phase : "tow_out";
    const isHorizTow = rPhase === "tow_out" || rPhase === "tow_back";
    if (isHorizTow) {
      this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);
    }

    // 6. Blit Foreground 2.5D Architectural Occlusion Layer (VAB, North Campus, Star Terminals, Hangar Base, Radar, Bridge)
    ctx.drawImage(this.fgCacheCanvas, 0, 0, w, h);

    // 7. HIF Shell, Dynamic Beacons, Runway Lights & Synchronized Parabolic Dishes
    this._drawHIFOcclusionRoof(ctx, L, pal);
    this._drawComplexLights(ctx, L, pal, step);
    this._drawAnimatedRadarDishes(ctx, L, pal, step);

    // 8. Heavy Orbital Rocket on launch pad / vertical ascent / landing + Star Terminal Spire Occlusion
    if (!isHorizTow) {
      this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);
    }
    this._drawStarTerminalSpireOcclusion(ctx, L, pal);

    // 9. Tiny Apron & Highway Ground Handling Vehicles (clipped safely during underpass transit!)
    this._updateAndDrawGroundVehicles(ctx, w, h, L, pal, dt, step);

    // 10. Concurrent Arc-Length Kinematic Spaceplane Fleet + Colossal Multi-Deck Mega-Liner
    this._updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h);
    this._updateAndDrawMegaLiner(ctx, L, pal, dt, step, w, h);

    // 11. Foreground Arched Hangar Roof Occlusion Layer (planes taxi inside seamlessly!)
    this._drawArchedHangarOcclusionRoof(ctx, L, pal);

    // 12. Patrol & Transport Helicopters Taking Off, Landing & Patrolling Around Base
    this._updateAndDrawHelicopters(ctx, w, h, L, pal, dt, step);

    // 13. Exhaust Smoke, Deluge Steam & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 14. Dynamic Rolling Dawn Fog (morning mode)
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
    ctx.lineTo(w * 0.59, L.islandBotY + 42);
    ctx.lineTo(w * 0.66, h + 10);
    ctx.lineTo(-20, h + 10);
    ctx.closePath();
    ctx.clip();
    ctx.lineCap = "round";
    for (let i = 0; i < this.waterGlints.length; i++) {
      const g = this.waterGlints[i];
      if (g.zone !== "lower") continue;
      g.xFrac = (g.xFrac + g.vx * dt) % 1;
      g.phase += dt * 1.25;
      const gx = g.xFrac * (w * 0.66);
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
      const isUpperContainer = s.zone === "upper" && (s.kind === "container_ship" || s.kind === "cargo_far");
      const hazeAlpha = isUpperContainer ? 0.42 : (s.zone === "upper" ? 0.50 : 0.96);

      ctx.save();
      ctx.globalAlpha = hazeAlpha;
      ctx.translate(s.x, s.y);

      const wakeLen = s.kind === "container_ship" ? 48 * sc : (s.kind === "recovery_ship" ? 44 * sc : 24 * sc);
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

      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(0, 4.5, s.kind === "container_ship" ? 26 : (s.kind === "recovery_ship" ? 19 : 14), 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (s.kind === "recovery_ship") {
        ctx.fillStyle = pal.shipHull;
        ctx.beginPath();
        ctx.moveTo(-18, -1);
        ctx.lineTo(15, -1.5);
        ctx.lineTo(20, -3.5);
        ctx.lineTo(17, 3);
        ctx.lineTo(-17, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(-16, -2.5, 20, 1.8);
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
      } else if (s.kind === "container_ship") {
        // Distant upper bay container vessels use muted atmospheric colors to blend naturally with horizon
        const isDistant = s.zone === "upper";
        ctx.fillStyle = isDistant ? pal.archDark : pal.shipHull;
        ctx.beginPath();
        ctx.moveTo(-26, -1.2);
        ctx.lineTo(22, -1.5);
        ctx.lineTo(28, -4.2);
        ctx.lineTo(24, 3.2);
        ctx.lineTo(-24, 3.2);
        ctx.closePath();
        ctx.fill();

        if (!isDistant) {
          ctx.save();
          ctx.fillStyle = pal.chuteColor;
          ctx.globalAlpha *= 0.72;
          ctx.fillRect(-24, 1.8, 48, 1.3);
          ctx.restore();
        }

        // Stacked ISO cargo container bays in harmonious muted tones for distant vessels
        const bayColors = isDistant
          ? [pal.archMid, pal.archLight, pal.islandFar, pal.archDark]
          : [pal.liveryAccent, pal.chuteColor, pal.archMid, pal.archLight];
        [-21, -11, -1, 9].forEach((bx, bIdx) => {
          ctx.fillStyle = bayColors[bIdx % bayColors.length];
          ctx.fillRect(bx, -5.2, 8.2, 3.8);
          ctx.fillStyle = bayColors[(bIdx + 2) % bayColors.length];
          ctx.fillRect(bx + 0.6, -8.2, 7.0, 2.8);
        });

        // Bridge superstructure & funnel stack
        ctx.fillStyle = isDistant ? pal.archLight : pal.shipSuper;
        ctx.fillRect(-19, -12.0, 6.5, 7.0);
        ctx.fillStyle = pal.windowGlassDark;
        ctx.fillRect(-17.8, -11.0, 4.2, 2.2);
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(-21, -10.5, 2.0, 5.5);
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-15.5, -12.0);
        ctx.lineTo(-15.5, -16.5);
        ctx.stroke();
      } else {
        ctx.fillStyle = pal.shipHull;
        ctx.fillRect(-14, -1.5, 28, 3.5);
        ctx.fillStyle = pal.shipSuper;
        ctx.fillRect(6, -6, 6, 4.5);
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(-10, -4, 14, 2.5);
      }

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

  // Tiny to-scale Apron Ground Support & Highway Commuter Vehicles
  _updateAndDrawGroundVehicles(ctx, w, h, L, pal, dt, step) {
    const apronPath = this._buildArcPath([
      [L.hangarDoorX > 0 ? { x: L.hangarDoorX - 10, y: L.hangarDoorY + 12 } : L.apronEast,
        L.apronEast, L.apronSE, L.apronSouth],
      [L.apronSouth, L.apronSW, { x: L.satWest.x + 12 * L.termScale, y: L.satWest.y + 38 * L.termScale },
        { x: L.satWest.x - 8 * L.termScale, y: L.satWest.y + 24 * L.termScale }]
    ], 24);
    const plazaPath = this._buildArcPath([
      [{ x: w * 0.92, y: h + 6 }, { x: w * 0.61, y: h * 0.90 }, { x: w * 0.64, y: L.islandBotY + 16 }, { x: w * 0.65, y: L.islandBotY + 14 }],
      [{ x: w * 0.65, y: L.islandBotY + 14 }, { x: L.underpassX + 12, y: L.underpassY + L.underpassHalf + 26 }, { x: L.underpassX, y: L.underpassY + L.underpassHalf + 7 }, { x: L.underpassX - 4, y: L.underpassY - L.underpassHalf - 6 }],
      [{ x: L.underpassX - 4, y: L.underpassY - L.underpassHalf - 6 }, { x: L.underpassX - 18, y: L.underpassY - L.underpassHalf - 32 }, { x: L.plazaX + 58 * L.termScale, y: L.plazaY + 24 * L.termScale }, { x: L.plazaX, y: L.plazaY }]
    ], 22);
    const portPath = this._buildArcPath([
      [{ x: w * 0.65, y: L.islandBotY + 14 }, { x: w * 0.44, y: L.islandBotY + 4 }, { x: w * 0.28, y: L.islandBotY - 8 }, { x: w * 0.17, y: L.islandBotY - 20 }]
    ], 18);

    ctx.save();
    for (let i = 0; i < this.groundVehicles.length; i++) {
      const gv = this.groundVehicles[i];
      const path = gv.route === "apron" ? apronPath : (gv.route === "highway_port" ? portPath : plazaPath);
      gv.d += (gv.spd / path.totalLen) * gv.dir * dt;
      if (gv.d >= 0.98) { gv.d = 0.98; gv.dir = -1; }
      if (gv.d <= 0.02) { gv.d = 0.02; gv.dir = 1; }

      const pt = this._sampleArcPath(path, gv.d * path.totalLen);
      gv.x = pt.x;
      gv.y = pt.y;
      const moveAng = gv.dir < 0 ? pt.angle + Math.PI : pt.angle;
      gv.heading = this._lerpAngle(gv.heading, moveAng, Math.min(1, dt * 6));

      // Obscure cleanly while driving through the concrete Runway Underpass!
      const rwBand = Math.abs(gv.y - L.rwYAtX(gv.x));
      if (gv.route === "highway_plaza" && rwBand < L.rwHalfAtX(gv.x) + 4) {
        continue;
      }

      ctx.save();
      ctx.translate(gv.x, gv.y);
      ctx.rotate(gv.heading);

      // Tiny cast shadow
      ctx.fillStyle = pal.shadowColor;
      ctx.fillRect(-3.0, -1.0, 6.0, 3.2);

      // Body (realistically tiny: 4.5-6px long!)
      ctx.fillStyle = gv.kind === "fuel_truck" ? pal.archLight : (gv.kind === "follow_me" ? "#F59E0B" : pal.bodyLight);
      ctx.fillRect(-2.6, -1.4, 5.2, 2.8);
      if (gv.kind === "fuel_truck") {
        ctx.fillStyle = pal.liveryAccent;
        ctx.fillRect(-2.2, -1.1, 3.0, 2.2);
      }

      // Micro amber ramp strobe on airport service vehicles
      if (gv.route === "apron" && Math.sin(step * 14 + i) > 0.2) {
        ctx.fillStyle = "#F59E0B";
        ctx.fillRect(-0.5, -0.6, 1.1, 1.1);
      }
      // Subtle micro headlights in dusk/night
      if (pal.isNightLights) {
        const hg = ctx.createLinearGradient(2.6, 0, 12, 0);
        hg.addColorStop(0, "rgba(255, 250, 224, 0.34)");
        hg.addColorStop(1, "rgba(255, 250, 224, 0)");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(2.6, -0.8);
        ctx.lineTo(12, -3.2);
        ctx.lineTo(12, 3.2);
        ctx.lineTo(2.6, 0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  // Draw an individual Falcon Heavy stage (center core with fairing or grid-finned returning side booster)
  _drawFhStage(ctx, pal, bodyW, bodyH, sc, legDeploy, flameScale, step, hasFairing) {
    if (flameScale > 0.04) {
      const flH = (16 + Math.sin(step * 42) * 3) * flameScale;
      const flW = bodyW * 1.15;
      const bloom = ctx.createRadialGradient(0, flH * 0.4, 1, 0, flH * 0.4, flH * 2.1);
      bloom.addColorStop(0, `rgba(${pal.plumeMid}, ${(pal.isNightLights ? 0.52 : 0.28).toFixed(3)})`);
      bloom.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(0, flH * 0.4, flH * 2.1, 0, Math.PI * 2);
      ctx.fill();

      const flG = ctx.createLinearGradient(0, 0, 0, flH);
      flG.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
      flG.addColorStop(0.5, `rgba(${pal.plumeMid}, 0.86)`);
      flG.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
      ctx.fillStyle = flG;
      ctx.beginPath();
      ctx.moveTo(-flW * 0.55, 0);
      ctx.quadraticCurveTo(0, flH * 1.15, flW * 0.55, 0);
      ctx.closePath();
      ctx.fill();
    }

    const coreG = ctx.createLinearGradient(-bodyW * 0.5, 0, bodyW * 0.5, 0);
    coreG.addColorStop(0, pal.bodyLight);
    coreG.addColorStop(0.65, pal.bodyLight);
    coreG.addColorStop(1, pal.bodyShade);
    ctx.fillStyle = coreG;
    ctx.fillRect(-bodyW * 0.5, -bodyH, bodyW, bodyH);

    // Interstage band & dark engine skirt
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(-bodyW * 0.52, -bodyH * 0.68, bodyW * 1.04, 1.8 * sc);
    ctx.fillRect(-bodyW * 0.54, -2.5 * sc, bodyW * 1.08, 2.5 * sc);

    if (hasFairing) {
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.68, -bodyH);
      ctx.quadraticCurveTo(0, -bodyH - bodyW * 1.7, bodyW * 0.68, -bodyH);
      ctx.closePath();
      ctx.fill();
    } else {
      // Aerodynamic nose cone + folded titanium grid fins on side boosters
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.5, -bodyH);
      ctx.quadraticCurveTo(0, -bodyH - bodyW * 1.05, bodyW * 0.5, -bodyH);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(-bodyW * 0.95, -bodyH * 0.92, bodyW * 1.9, 1.7);
    }

    if (legDeploy > 0.04) {
      const legAng = legDeploy * 0.88;
      const legLen = bodyW * 1.95;
      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = Math.max(1.0, 1.55 * sc);
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(side * bodyW * 0.45, -3 * sc);
        ctx.lineTo(side * (bodyW * 0.45 + Math.sin(legAng) * legLen), 1.6 * sc - Math.cos(legAng) * legLen * 0.1);
        ctx.stroke();
      });
    }
  },

  // Offshore Floating Pad Rocket (7-Phase Falcon Heavy Loop: Core Tow -> Booster Attach -> Launch -> Dual Booster Recovery -> Crane Reattach)
  _updateAndDrawOffshoreRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.offshoreRocket;
    if (!r) return;
    r.t += dt;

    const sc = L.offshoreScale;
    const centerX = L.offshorePadX;
    const deckY = L.offshorePadY - 4.5 * sc;
    const lzLeftX = L.offshoreLzLeftX;
    const lzRightX = L.offshoreLzRightX;
    const lzY = L.offshorePadY - 4.0 * sc;
    const bodyH = 44 * sc;
    const boosterH = bodyH * 0.68;
    const bodyW = 5.0 * sc;

    const shorePt = { x: L.offshoreShoreX + 2 * sc, y: L.offshoreShoreY - 1 };
    const trestleEnd = { x: centerX - 18 * sc, y: L.offshorePadY + 4 * sc };
    const causewayPos = (frac) => {
      if (frac < 0.78) {
        const u = Math.max(0, frac) / 0.78;
        return { x: this._lerp(shorePt.x, trestleEnd.x, u), y: this._lerp(shorePt.y, trestleEnd.y, u), flame: 0 };
      }
      const v = Math.min(1, (frac - 0.78) / 0.22);
      return { x: this._lerp(trestleEnd.x, centerX, v), y: this._lerp(trestleEnd.y, deckY, v), flame: 0 };
    };

    let strongbackRetract = 0.28;
    let delugeAlpha = 0;

    // 1. Tower arm staging offsets (boosters held at +/-13*sc waiting on tower arms)
    const armRestDx = 13.5 * sc;
    const attachedDx = bodyW * 0.98;
    const drawTowerArmsAndCrane = (leftPos, rightPos, corePos, coreAngle, craneFrac, showBoostersOnArms) => {
      // Strongback tower spine
      ctx.save();
      ctx.translate(centerX - 15 * sc, deckY);
      ctx.rotate(-strongbackRetract * 0.24);
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(-1.5, -bodyH * 0.90, 3, bodyH * 0.90);
      ctx.restore();

      // Offshore integration tower horizontal transfer arms holding side boosters
      if (showBoostersOnArms !== false) {
        const armY = deckY - boosterH * 0.65;
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = Math.max(1.0, 1.4 * sc);
        ctx.beginPath();
        ctx.moveTo(centerX - 13 * sc, armY);
        ctx.lineTo(leftPos.x, leftPos.y - boosterH * 0.65);
        ctx.moveTo(centerX - 13 * sc, armY + 2 * sc);
        ctx.lineTo(rightPos.x, rightPos.y - boosterH * 0.65);
        ctx.stroke();
      }

      // Deck Re-Mating Crane on starboard deck
      const craneX = centerX + 22 * sc;
      const craneBoomY = deckY - bodyH * 0.88;
      ctx.save();
      ctx.strokeStyle = pal.isNightLights ? "#94A3B8" : pal.archDark;
      ctx.lineWidth = Math.max(1.2, 1.8 * sc);
      ctx.beginPath();
      ctx.moveTo(craneX, deckY);
      ctx.lineTo(craneX, craneBoomY);
      ctx.lineTo(craneX + (craneFrac > 0.01 ? -14 * sc * (1 - craneFrac * 0.5) : 14 * sc), craneBoomY - 8 * sc);
      ctx.stroke();
      ctx.restore();

      // Offshore water deluge cooling mist on pad deck during ignition/launch
      if (delugeAlpha > 0.02) {
        ctx.save();
        [-1, 1].forEach(side => {
          const g = ctx.createRadialGradient(centerX + side * 14 * sc, deckY + 2 * sc, 2, centerX + side * 16 * sc, deckY + 2 * sc, 26 * sc);
          g.addColorStop(0, `rgba(226, 240, 255, ${(0.52 * delugeAlpha).toFixed(3)})`);
          g.addColorStop(1, "rgba(226, 240, 255, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(centerX + side * 15 * sc, deckY + 2 * sc, 26 * sc, 7 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // Draw Center Core if present (with optional horizontal causeway trailer)
      if (corePos) {
        ctx.save();
        ctx.translate(corePos.x, corePos.y);
        if (Math.abs(coreAngle) > 0.15) {
          // Draw tiny offshore causeway flatbed beneath horizontal core
          ctx.fillStyle = pal.archDark;
          ctx.fillRect(-bodyH * 0.45, 1, bodyH * 0.9, 2.4 * sc);
          ctx.fillStyle = pal.liveryAccent;
          ctx.fillRect(bodyH * 0.42, -1.5 * sc, 5.5 * sc, 3.2 * sc);
        }
        ctx.rotate(coreAngle);
        this._drawFhStage(ctx, pal, bodyW, bodyH, sc, 0, corePos.flame || 0, step, true);
        ctx.restore();
      }
    };

    if (r.phase === "core_tow_in") {
      // Side boosters wait in tower arms while new center core rolls down causeway trailer & erects vertically!
      const p = Math.min(1, r.t / r.phaseDuration);
      let corePos, coreAngle;
      if (p < 0.72) {
        const tp = p / 0.72;
        const ease = tp * tp * (3 - 2 * tp);
        // Second half finishes tow directly along trestle road -> main mount
        const f = 0.35 + ease * 0.65;
        corePos = causewayPos(f);
        coreAngle = -Math.PI * 0.5;
      } else {
        const ep = (p - 0.72) / 0.28;
        const ease = ep * ep * (3 - 2 * ep);
        corePos = { x: centerX, y: deckY, flame: 0 };
        coreAngle = -Math.PI * 0.5 * (1 - ease);
      }
      const leftPos = { x: centerX - armRestDx, y: deckY };
      const rightPos = { x: centerX + armRestDx, y: deckY };
      drawTowerArmsAndCrane(leftPos, rightPos, corePos, coreAngle, 0, true);
      [-1, 1].forEach((side, idx) => {
        const bx = idx === 0 ? leftPos.x : rightPos.x;
        ctx.save();
        ctx.translate(bx, deckY);
        this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, 0, 0, step, false);
        ctx.restore();
      });
      if (r.t >= r.phaseDuration) {
        r.phase = "booster_attach";
        r.t = 0;
        r.phaseDuration = this._rand(5.5, 7.5);
      }
      return;
    }

    if (r.phase === "booster_attach") {
      // Tower arms slide both side boosters inward onto center core!
      const p = Math.min(1, r.t / r.phaseDuration);
      const mate = p < 0.75 ? (p / 0.75) * (p / 0.75) * (3 - 2 * (p / 0.75)) : 1;
      const dx = this._lerp(armRestDx, attachedDx, mate);
      const leftPos = { x: centerX - dx, y: deckY };
      const rightPos = { x: centerX + dx, y: deckY };
      drawTowerArmsAndCrane(leftPos, rightPos, { x: centerX, y: deckY, flame: 0 }, 0, 0, p < 0.90);
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(centerX + side * dx, deckY);
        this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, 0, 0, step, false);
        ctx.restore();
      });
      if (r.t >= r.phaseDuration) {
        r.phase = "strongback_retract";
        r.t = 0;
        r.phaseDuration = 4.0;
      }
      return;
    }

    if (r.phase === "strongback_retract") {
      const p = Math.min(1, r.t / r.phaseDuration);
      strongbackRetract = 0.28 + p * 0.72;
      delugeAlpha = Math.max(0, (p - 0.55) / 0.45);
      const leftPos = { x: centerX - attachedDx, y: deckY };
      const rightPos = { x: centerX + attachedDx, y: deckY };
      if (Math.random() < 0.30) {
        this.ventParticles.push({
          x: centerX + (Math.random() - 0.5) * 4, y: deckY - bodyH * 0.55,
          vx: 0.25, vy: -0.1, r: 1.8 * sc + 1, life: 0, maxLife: 34
        });
      }
      drawTowerArmsAndCrane(leftPos, rightPos, { x: centerX, y: deckY, flame: 0 }, 0, 0, false);
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(centerX + side * attachedDx, deckY);
        this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, 0, 0, step, false);
        ctx.restore();
      });
      if (r.t >= r.phaseDuration) {
        r.phase = "launch";
        r.t = 0;
        r.phaseDuration = this._rand(9.5, 11.5);
      }
      return;
    }

    if (r.phase === "launch") {
      // Straight vertical ascent clear of tower mast before smooth gravity turn exiting top frame!
      const p = Math.min(1, r.t / r.phaseDuration);
      strongbackRetract = 1.0;
      delugeAlpha = p < 0.45 ? (1 - p / 0.45) : 0;
      const clearFrac = 0.34;
      const clearH = 68 * sc;
      let liftY, rx, ang;
      if (p < clearFrac) {
        const vp = p / clearFrac;
        liftY = clearH * Math.pow(vp, 2.1);
        rx = centerX;
        ang = 0;
      } else {
        const tp = (p - clearFrac) / (1 - clearFrac);
        liftY = clearH + Math.pow(tp, 1.55) * (deckY + 185 - clearH);
        rx = centerX + Math.pow(tp, 1.9) * (w * 0.14);
        ang = Math.pow(tp, 1.25) * 0.34;
      }
      r.x = rx;
      r.y = deckY - liftY;
      r.angle = ang;
      const flameScale = p < 0.12 ? (0.45 + p * 4.5) : 1.05;

      if (p < 0.45) {
        const refA = (1 - p / 0.45) * 0.38;
        const rg = ctx.createRadialGradient(centerX, deckY + 10 * sc, 2, centerX, deckY + 12 * sc, 58 * sc);
        rg.addColorStop(0, `rgba(${pal.plumeMid}, ${refA.toFixed(3)})`);
        rg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(centerX, deckY + 12 * sc, 58 * sc, 12 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Math.random() < 0.78) {
        const nearPad = r.y > deckY - 36;
        this.plumeParticles.push({
          x: r.x + (Math.random() - 0.5) * (nearPad ? 12 : 3),
          y: nearPad ? Math.min(deckY + 2, r.y + 3) : r.y + 3,
          vx: nearPad ? (Math.random() - 0.5) * 1.6 : -Math.sin(r.angle) * 0.3,
          vy: nearPad ? -0.15 : 0.45,
          r: nearPad ? 4.8 : 2.8,
          grow: nearPad ? 0.16 : 0.10,
          hot: p < 0.65 && Math.random() < 0.45,
          life: 0,
          maxLife: nearPad ? 72 : 112
        });
      }

      drawTowerArmsAndCrane({ x: centerX, y: deckY }, { x: centerX, y: deckY }, null, 0, 0, false);
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);
      this._drawFhStage(ctx, pal, bodyW, bodyH, sc, 0, flameScale, step, true);
      [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(side * attachedDx, 0);
        this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, 0, flameScale * 0.88, step, false);
        ctx.restore();
      });
      ctx.restore();

      if (r.t >= r.phaseDuration) {
        r.phase = "orbit_wait";
        r.t = 0;
        r.phaseDuration = this._rand(5.0, 9.0);
      }
      return;
    }

    if (r.phase === "orbit_wait") {
      drawTowerArmsAndCrane({ x: centerX, y: deckY }, { x: centerX, y: deckY }, null, 0, 0, false);
      if (r.t >= r.phaseDuration) {
        r.phase = "reentry_burn";
        r.t = 0;
        r.phaseDuration = this._rand(3.8, 5.0);
      }
      return;
    }

    if (r.phase === "reentry_burn" || r.phase === "landing_burn") {
      // Twin Side Boosters return from space, deploy landing struts and land on their twin smaller flanking pads!
      const isFinal = r.phase === "landing_burn";
      const p = Math.min(1, r.t / r.phaseDuration);
      const frac = isFinal ? (0.45 + 0.55 * p) : (0.45 * p);
      const easeOut = 1 - Math.pow(1 - frac, 2.25);
      const legs = isFinal ? this._clamp((p - 0.30) / 0.45, 0, 1) : 0;
      r.leftLegDeploy = legs;
      r.rightLegDeploy = legs;
      r.legDeploy = legs;
      const flame = isFinal ? (p < 0.90 ? (0.80 - p * 0.32) : ((1 - p) * 4.8)) : (p < 0.72 ? 0.55 : 0);

      drawTowerArmsAndCrane({ x: centerX, y: deckY }, { x: centerX, y: deckY }, null, 0, 0, false);

      [
        { lx: lzLeftX, startOff: w * 0.05 },
        { lx: lzRightX, startOff: w * 0.08 }
      ].forEach((b, bi) => {
        const bx = this._lerp(b.lx + b.startOff, b.lx, easeOut);
        const by = this._lerp(-52, lzY, easeOut);
        const bang = -(1 - easeOut) * (bi === 0 ? 0.14 : 0.19);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(bang);
        this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, legs, flame, step, false);
        ctx.restore();

        if (isFinal && Math.random() < 0.55) {
          this.plumeParticles.push({
            x: bx + (Math.random() - 0.5) * 3,
            y: Math.min(lzY, by + 3),
            vx: p > 0.78 ? (Math.random() - 0.5) * 1.4 : (Math.random() - 0.5) * 0.4,
            vy: p > 0.78 ? -0.15 : 0.55,
            r: 2.2 + Math.random() * 2.0,
            grow: 0.10,
            hot: p < 0.85,
            life: 0,
            maxLife: 42
          });
        }
      });

      if (r.t >= r.phaseDuration) {
        if (!isFinal) {
          r.phase = "landing_burn";
          r.t = 0;
          r.phaseDuration = this._rand(4.5, 5.8);
        } else {
          r.phase = "crane_reattach";
          r.t = 0;
          r.phaseDuration = this._rand(7.5, 9.5);
          for (let k = 0; k < 8; k++) {
            const tx = k % 2 === 0 ? lzLeftX : lzRightX;
            this.ventParticles.push({
              x: tx + (Math.random() - 0.5) * 10, y: lzY - 1,
              vx: (Math.random() - 0.5) * 1.0, vy: -0.20 - Math.random() * 0.25,
              r: 2.6, life: 0, maxLife: 42
            });
          }
        }
      }
      return;
    }

    // phase === "crane_reattach": Crane lifts both landed side boosters back to tower arms while trailer hauls new center core!
    const p = Math.min(1, r.t / r.phaseDuration);
    const liftPhase = this._clamp(p / 0.28, 0, 1);
    const swingPhase = this._clamp((p - 0.22) / 0.62, 0, 1);
    const lowerToArm = this._clamp((p - 0.80) / 0.20, 0, 1);
    const smoothSwing = swingPhase * swingPhase * (3 - 2 * swingPhase);
    const liftY = (liftPhase * (1 - lowerToArm * 0.42)) * 24 * sc;
    const legRetract = Math.max(0, 1 - this._clamp(p / 0.45, 0, 1));
    r.leftLegDeploy = legRetract;
    r.rightLegDeploy = legRetract;
    r.legDeploy = legRetract;

    const lX = this._lerp(lzLeftX, centerX - armRestDx, smoothSwing);
    const rX = this._lerp(lzRightX, centerX + armRestDx, smoothSwing);
    const lY = lzY - liftY;
    const rY = lzY - liftY;

    // New main center core rolling cleanly along trestle causeway bridge behind/during crane reattach
    const towProg = this._clamp((p - 0.35) / 0.65, 0, 1) * 0.35;
    const towCore = p > 0.35 ? causewayPos(towProg) : null;

    const craneFrac = 0.2 + 0.8 * smoothSwing;
    drawTowerArmsAndCrane({ x: lX, y: lY }, { x: rX, y: rY }, towCore, -Math.PI * 0.5, craneFrac, lowerToArm > 0.3);

    if (liftPhase > 0.05) {
      const craneBoomTipX = (centerX + 22 * sc) - 14 * sc * (1 - craneFrac * 0.5);
      const craneBoomTipY = deckY - bodyH * 0.88 - 8 * sc;
      const towerJibX = lX;
      const towerJibY = deckY - bodyH * 0.90;
      ctx.save();
      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.82)" : pal.towerSteel;
      ctx.lineWidth = Math.max(0.85, 1.15 * sc);
      ctx.beginPath();
      ctx.moveTo(towerJibX, towerJibY);
      ctx.lineTo(lX, lY - boosterH - 2 * sc);
      ctx.moveTo(craneBoomTipX, craneBoomTipY);
      ctx.lineTo(rX, rY - boosterH - 2 * sc);
      ctx.stroke();
      ctx.restore();
    }

    [
      { x: lX, y: lY },
      { x: rX, y: rY }
    ].forEach(bp => {
      ctx.save();
      ctx.translate(bp.x, bp.y);
      this._drawFhStage(ctx, pal, bodyW * 0.85, boosterH, sc, legRetract, 0, step, false);
      ctx.restore();
    });

    if (r.t >= r.phaseDuration) {
      r.phase = "core_tow_in";
      r.t = 0;
      r.phaseDuration = this._rand(5.2, 6.8);
    }
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

      const shadowFade = Math.max(0.14, 1 - hel.altitude / 75);
      ctx.save();
      ctx.translate(hel.x + hel.altitude * 0.16 * pal.sunDir, hel.y + hel.altitude + 2);
      ctx.fillStyle = pal.shadowColor;
      ctx.globalAlpha = 0.52 * shadowFade;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.5, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const facingLeft = Math.cos(hel.heading) < 0;
      const nosePitch = hel.phase === "patrol" ? (facingLeft ? -0.10 : 0.10) : 0;

      ctx.save();
      ctx.translate(hel.x, hel.y);

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

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.ellipse(1.5, 0, 7.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.windowGlassDark;
      ctx.beginPath();
      ctx.ellipse(5.4, -0.5, 2.8, 1.7, 0.2, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

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
    const atcTopOff = (L.isNarrow ? 0.72 : 1.05) * 103;
    const beacons = [
      { x: L.towerLeftX, y: L.padY - L.towerH - 14 },
      { x: L.towerRightX, y: L.padY - L.towerH - 14 },
      { x: L.vabX + L.vabW * 0.34, y: L.vabY - L.vabH - 14 },
      { x: L.termX, y: L.termY - 114 * L.termScale },
      { x: L.atcX - 5 * (L.isNarrow ? 0.72 : 1.05), y: L.atcY - atcTopOff }
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
        const hw = L.rwLeftHalf + t * (L.rwRightHalf - L.rwLeftHalf);
        const isRabbit = i === rabbit;
        const rgb = i < 2 ? "52, 211, 153" : (isRabbit ? "255, 255, 255" : "254, 226, 155");
        const a = (isRabbit ? 0.88 : 0.52) * pal.lightIntensity;
        const rad = (1.5 + t * 1.5) * 2.5;
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

  // Northern crawlerway leading strictly INSIDE Horizontal Integration Facility (p0) -> Launch Pad (p2)
  _crawlerPos(L, w, t) {
    const p0x = L.hifX + L.hifW * 0.42; // Hidden deep inside HIF bay!
    const p0y = L.hifY + 8;
    const cx = w * 0.40;
    const cy = L.islandTopY + L.spanY * 0.065;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    return {
      x: inv * inv * p0x + 2 * inv * t * cx + t * t * p2x,
      y: inv * inv * p0y + 2 * inv * t * cy + t * t * p2y
    };
  },

  _crawlerTangent(L, w, t) {
    const p0x = L.hifX + L.hifW * 0.42;
    const p0y = L.hifY + 8;
    const cx = w * 0.40;
    const cy = L.islandTopY + L.spanY * 0.065;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    const dx = 2 * inv * (cx - p0x) + 2 * t * (p2x - cx);
    const dy = 2 * inv * (cy - p0y) + 2 * t * (p2y - cy);
    return Math.atan2(-dy, -dx);
  },

  // Proportionally tiny heavy-haul tow tractor pulling multi-axle SPMT rocket flatbed (realistically smaller than rocket!)
  _drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, travelDir, isMoving, isBoosterOnly = false) {
    ctx.save();
    const bodyLen = isBoosterOnly ? rocketH * 0.66 : rocketH;
    const bedStart = -bodyLen - 3;
    const bedEnd = 6;
    const bedW = bedEnd - bedStart;
    const bedMid = (bedStart + bedEnd) * 0.5;

    // Ground cast shadow under flatbed & tiny tow tractor
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(bedMid, 5.2, bedW * 0.54 + 8, 3.0, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.fillRect(bedStart, 0.5, bedW, 3.2);
    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(bedStart, 0.5, bedW, 1.0);
    ctx.fillStyle = pal.towerSteel;
    ctx.fillRect(bedStart + 7, -2.5, 2.8, 3.5);
    ctx.fillRect(bedEnd - 12, -2.5, 2.8, 3.5);

    ctx.fillStyle = "#1E293B";
    for (let wi = 0; wi < 8; wi++) {
      const wx = bedStart + 3 + (wi / 7) * (bedW - 6);
      ctx.beginPath();
      ctx.arc(wx, 4.4, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Realistically SMALL tow truck (~9px long × 4.4px tall — tiny next to an 86px orbital rocket!)
    const tugX = travelDir < 0 ? (bedStart - 9.5) : (bedEnd + 9.5);
    const hitchFrom = travelDir < 0 ? bedStart : bedEnd;
    const hitchTo = travelDir < 0 ? tugX + 4.2 : tugX - 4.2;

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hitchFrom, 2.4);
    ctx.lineTo(hitchTo, 2.6);
    ctx.stroke();

    ctx.save();
    ctx.translate(tugX, 0.8);
    if (travelDir < 0) ctx.scale(-1, 1);

    if (isMoving) {
      const hA = pal.isNightLights ? 0.38 : 0.12;
      const hg = ctx.createLinearGradient(4.5, 0.5, 26, 0.5);
      hg.addColorStop(0, `rgba(255, 250, 224, ${hA})`);
      hg.addColorStop(1, "rgba(255, 250, 224, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(4.5, -0.5);
      ctx.lineTo(26, -4.5);
      ctx.lineTo(26, 4.5);
      ctx.lineTo(4.5, 2.0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = pal.liveryAccent;
    ctx.beginPath();
    ctx.roundRect(-4.5, -1.6, 9.0, 3.4, 1.1);
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.roundRect(-0.8, -3.5, 4.6, 2.2, 0.9);
    ctx.fill();
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(0.6, -3.0, 2.8, 1.3);
    ctx.fillStyle = "#0F172A";
    ctx.beginPath();
    ctx.arc(-2.5, 2.2, 1.25, 0, Math.PI * 2);
    ctx.arc(2.6, 2.2, 1.25, 0, Math.PI * 2);
    ctx.fill();

    if (Math.sin(step * 11) > 0) {
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.arc(1.2, -4.1, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  },

  _isMainPadBusy(exclude) {
    if (exclude !== "rocket" && this.rocket && this.rocket.phase !== "hangar_wait" && this.rocket.phase !== "coast_wait") {
      return true;
    }
    if (exclude !== "megaliner" && this.megaliner && (this.megaliner.phase === "taxi_to_pad" || this.megaliner.phase === "pad_prep" || this.megaliner.phase === "vertical_launch")) {
      return true;
    }
    return false;
  },

  // Launch tower floodlights & pressurized twin water deluge system during ignition/landing
  _drawPadDelugeAndTowerLights(ctx, L, pal, intensity, step) {
    if (intensity <= 0.02) return;
    const padBaseY = L.padY - 2;
    const txL = L.towerLeftX;
    const txR = L.towerRightX;
    const towerTopY = L.padY - L.towerH * 0.92;

    ctx.save();
    // Tower directional floodlight beams illuminating rocket/liner column
    [txL, txR].forEach((tx, idx) => {
      const side = idx === 0 ? 1 : -1;
      for (let tier = 0; tier < 3; tier++) {
        const ly = padBaseY - L.towerH * (0.28 + tier * 0.28);
        const beamG = ctx.createLinearGradient(tx, ly, L.padX, ly + 22);
        const a = (pal.isNightLights ? 0.44 : 0.24) * intensity;
        beamG.addColorStop(0, `rgba(224, 242, 254, ${a.toFixed(3)})`);
        beamG.addColorStop(1, "rgba(224, 242, 254, 0)");
        ctx.fillStyle = beamG;
        ctx.beginPath();
        ctx.moveTo(tx + side * 3, ly - 2);
        ctx.lineTo(L.padX + side * 12, ly - 18);
        ctx.lineTo(L.padX + side * 12, ly + 26);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255, 251, 235, ${(0.92 * intensity).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(tx + side * 2, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crown beacon wash along upper tower bays
      const crownG = ctx.createRadialGradient(tx, towerTopY, 2, tx, towerTopY, 28);
      crownG.addColorStop(0, `rgba(186, 230, 253, ${(0.48 * intensity).toFixed(3)})`);
      crownG.addColorStop(1, "rgba(186, 230, 253, 0)");
      ctx.fillStyle = crownG;
      ctx.beginPath();
      ctx.arc(tx, towerTopY, 28, 0, Math.PI * 2);
      ctx.fill();
    });

    // High-pressure water deluge spray arcs + broad billowing lateral deluge steam apron
    [-1, 1].forEach(side => {
      const nX = L.padX + side * 22;
      const nY = L.padY - 2;
      ctx.strokeStyle = `rgba(224, 247, 255, ${(0.82 * intensity).toFixed(3)})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(nX, nY);
      ctx.quadraticCurveTo(L.padX + side * 9, nY - 15 - Math.sin(step * 18) * 2.0, L.padX + side * 3, L.padY + 3);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.56 * intensity).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(nX + side * 4, nY + 1);
      ctx.quadraticCurveTo(L.padX + side * 13, nY - 9 + Math.cos(step * 22) * 1.6, L.padX + side * 5, L.padY + 5);
      ctx.stroke();

      const steamG = ctx.createRadialGradient(L.padX + side * 34, L.padY + 4, 4, L.padX + side * 40, L.padY + 4, 66);
      steamG.addColorStop(0, `rgba(248, 250, 252, ${(0.64 * intensity).toFixed(3)})`);
      steamG.addColorStop(0.50, `rgba(224, 242, 254, ${(0.34 * intensity).toFixed(3)})`);
      steamG.addColorStop(1, "rgba(241, 245, 249, 0)");
      ctx.fillStyle = steamG;
      ctx.beginPath();
      ctx.ellipse(L.padX + side * 40, L.padY + 4, 66, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  _updateAndDrawRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.rocket;
    r.t += dt;

    const sizeMult = r.variant === "orbital_cargo" ? 0.92 : 1.0;
    const rocketH = Math.min(88, L.towerH * 0.46) * sizeMult;
    const rocketW = Math.max(7.2, rocketH * 0.145);
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
    let delugeIntensity = 0;

    if (r.phase === "tow_out") {
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, ease);
      r.x = pos.x;
      r.y = pos.y;
      roadTilt = this._crawlerTangent(L, w, ease) * 0.35;
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
      delugeIntensity = p > 0.78 ? (p - 0.78) / 0.22 : 0;
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
        r.phaseDuration = this._rand(13.0, 15.5);
      }
    } else if (r.phase === "launch") {
      // Launch straight vertically until completely clearing launch tower height before pitching downrange!
      const p = Math.min(1, r.t / r.phaseDuration);
      const clearFrac = 0.42;
      const towerClearLift = L.towerH * 1.18;
      let liftY, turnX, pitchAng;
      if (p < clearFrac) {
        const vp = p / clearFrac;
        liftY = towerClearLift * Math.pow(vp, 2.2);
        turnX = 0;
        pitchAng = 0;
      } else {
        const tp = (p - clearFrac) / (1 - clearFrac);
        liftY = towerClearLift + Math.pow(tp, 1.5) * (padBaseY + 230 - towerClearLift);
        turnX = Math.pow(tp, 1.9) * (w * 0.23);
        pitchAng = Math.pow(tp, 1.25) * 0.46;
      }
      r.x = L.padX + turnX;
      r.y = padBaseY - liftY;
      r.angle = pitchAng;
      drawFlame = true;
      flameScale = p < 0.1 ? (0.45 + p * 5.5) : 1.05;
      delugeIntensity = p < 0.48 ? Math.max(0.25, 1 - p / 0.48) : 0;

      if (p < 0.48) {
        const refA = (1 - p / 0.48) * 0.42;
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
          vx: nearPad ? ((Math.random() - 0.5) * 2.6) : (-Math.sin(r.angle) * 0.4 + (Math.random() - 0.5) * 0.32),
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
      delugeIntensity = p > 0.62 ? (p - 0.62) / 0.38 : 0;

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
      delugeIntensity = p < 0.45 ? (1 - p / 0.45) : 0;

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
        r.phaseDuration = this._rand(26.0, 32.0);
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
      roadTilt = this._crawlerTangent(L, w, 1 - ease) * 0.35;
      r.angle = -Math.PI * 0.5;
      if (r.t >= r.phaseDuration) {
        r.phase = "hangar_wait";
        r.t = 0;
        r.phaseDuration = this._rand(7.0, 16.0);
        r.variant = this._pick(["heavy_starship", "orbital_cargo"]);
      }
    } else {
      visible = false;
      if (r.t >= r.phaseDuration && !this._isMainPadBusy("rocket")) {
        r.phase = "tow_out";
        r.t = 0;
        r.phaseDuration = this._rand(26.0, 32.0);
      }
    }

    r.armClose += (targetArmClose - r.armClose) * Math.min(1, dt * 5.2);
    this._drawPadDelugeAndTowerLights(ctx, L, pal, delugeIntensity, step);

    // Clip crawlerway cleanly to open sky/tarmac west of HIF doorway so rocket & tow truck emerge from inside bay!
    ctx.save();
    if (isTransporter) {
      ctx.beginPath();
      ctx.rect(0, 0, L.hifDoorX + 12, h);
      ctx.clip();
    }

    if (visible && isTransporter) {
      ctx.save();
      ctx.translate(r.x, r.y + 1);
      ctx.rotate(roadTilt);
      this._drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, towTravelDir, isMovingTow, isBoosterOnly);
      ctx.restore();
    }

    if (visible) {
      const horizLift = isTransporter ? (Math.abs(Math.sin(r.angle)) * (rocketW * 0.52 + 1.5)) : 0;
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
    ctx.restore();

    // Catch tower loading arms
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

  // 6 Realistic Aerospace & Military Spaceplane Designs
  _drawSpaceplaneModel(ctx, variant, pal, step, afterburner = 0, altitude = 0) {
    const shadowFade = Math.max(0.12, 1 - altitude / 95);
    ctx.save();
    ctx.translate(2.2 + altitude * 0.18 * pal.sunDir, 3.0 + altitude * 0.58);
    ctx.scale(1.1, 0.8);
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.50 * shadowFade;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 19, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (afterburner > 0.05) {
      const fl = (20 + Math.sin(step * 45) * 4) * afterburner;
      const tailX = (variant === "starliner" || variant === "airliner") ? -23 : -16;
      const g = ctx.createLinearGradient(tailX, 0, tailX - fl, 0);
      g.addColorStop(0, "rgba(255, 252, 240, 0.95)");
      g.addColorStop(0.42, "rgba(56, 189, 248, 0.78)");
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(tailX + 1, -2.6);
      ctx.lineTo(tailX - fl, 0);
      ctx.lineTo(tailX + 1, 2.6);
      ctx.closePath();
      ctx.fill();
    }

    if (variant === "fighter") {
      // Stealth Orbital Interceptor: sharp chined forebody, swept diamond wings, twin outward canted tails!
      ctx.fillStyle = pal.militaryShade;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.lineTo(7, -3.2);
      ctx.lineTo(-4, -13.5);
      ctx.lineTo(-12, -13.5);
      ctx.lineTo(-10, -4.5);
      ctx.lineTo(-16, -5.5);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-16, 5.5);
      ctx.lineTo(-10, 4.5);
      ctx.lineTo(-12, 13.5);
      ctx.lineTo(-4, 13.5);
      ctx.lineTo(7, 3.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.militaryBody;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.lineTo(6, -2.6);
      ctx.lineTo(-5, -12);
      ctx.lineTo(-10.5, -12);
      ctx.lineTo(-9, -3.5);
      ctx.lineTo(-14, -4);
      ctx.lineTo(-14, 0);
      ctx.lineTo(21, 0);
      ctx.closePath();
      ctx.fill();

      // Bubble stealth canopy
      ctx.fillStyle = pal.windowGlow;
      ctx.beginPath();
      ctx.ellipse(9.5, 0, 4.5, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Twin canted vertical stabilizers
      ctx.fillStyle = pal.militaryShade;
      ctx.fillRect(-13.5, -5.2, 5.5, 1.8);
      ctx.fillRect(-13.5, 3.4, 5.5, 1.8);
    } else if (variant === "bomber") {
      // Flying-Wing Strategic Space Bomber: wide serrated stealth span & buried quad exhausts
      ctx.fillStyle = pal.militaryShade;
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(-7, -21);
      ctx.lineTo(-15, -19.5);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-15, -4);
      ctx.lineTo(-11, 0);
      ctx.lineTo(-15, 4);
      ctx.lineTo(-10, 9);
      ctx.lineTo(-15, 19.5);
      ctx.lineTo(-7, 21);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.militaryBody;
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(-6, -19);
      ctx.lineTo(-13, -18);
      ctx.lineTo(-9, -8);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(8.5, -2.2, 4.2, 1.4);
      ctx.fillRect(8.5, 0.8, 4.2, 1.4);
    } else if (variant === "starliner") {
      // Extended Trans-Atmospheric Passenger Liner (Concorde/Skylon silhouette: long fuselage + ogee delta wing!)
      const wingG = ctx.createLinearGradient(0, -17, 0, 17);
      wingG.addColorStop(0, pal.bodyLight);
      wingG.addColorStop(0.5, pal.bodyMid);
      wingG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.quadraticCurveTo(0, -5, -11, -16.5);
      ctx.lineTo(-19.5, -16.0);
      ctx.lineTo(-21, -3.5);
      ctx.lineTo(-21, 3.5);
      ctx.lineTo(-19.5, 16.0);
      ctx.quadraticCurveTo(0, 5, 9, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-19, -11, 9, 2.5);
      ctx.fillRect(-19, 8.5, 9, 2.5);

      const fGrad = ctx.createLinearGradient(0, -4.4, 0, 4.4);
      fGrad.addColorStop(0, pal.bodyLight);
      fGrad.addColorStop(0.66, pal.bodyLight);
      fGrad.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(29, 0);
      ctx.quadraticCurveTo(18, -4.4, -22, -3.2);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-22, 3.2);
      ctx.quadraticCurveTo(18, 4.4, 29, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-18, 0.7, 38, 1.0);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(20, -1.6, 3.8, 1.8);
      for (let wi = 0; wi < 10; wi++) {
        ctx.fillRect(15.5 - wi * 3.1, -2.0, 1.5, 0.9);
        ctx.fillRect(16.0 - wi * 3.1, -0.5, 1.5, 0.9);
      }

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-14, -1.4);
      ctx.lineTo(-24, -10.0);
      ctx.lineTo(-26.5, -8.5);
      ctx.lineTo(-22, -0.7);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "airliner") {
      // Extended Commercial Orbital Cruiser
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-7, -16.5);
      ctx.lineTo(-14, -16.5);
      ctx.lineTo(-10, -3);
      ctx.lineTo(-10, 3);
      ctx.lineTo(-14, 16.5);
      ctx.lineTo(-7, 16.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-15, -17.4, 8.5, 2.2);
      ctx.fillRect(-15, 15.2, 8.5, 2.2);

      const fg = ctx.createLinearGradient(0, -3.8, 0, 3.8);
      fg.addColorStop(0, pal.bodyLight);
      fg.addColorStop(0.68, pal.bodyLight);
      fg.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(27, 0);
      ctx.quadraticCurveTo(15, -3.8, -20, -2.6);
      ctx.lineTo(-23, 0);
      ctx.lineTo(-20, 2.6);
      ctx.quadraticCurveTo(15, 3.8, 27, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-17, 0.5, 35, 1.0);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(18, -1.5, 3.6, 1.6);
      for (let wi = 0; wi < 9; wi++) {
        ctx.fillRect(13.5 - wi * 3.0, -1.3, 1.5, 0.9);
      }

      ctx.fillStyle = pal.bodyShade;
      ctx.beginPath();
      ctx.moveTo(-13, -1.1);
      ctx.lineTo(-21, -8.5);
      ctx.lineTo(-23.5, -7.2);
      ctx.lineTo(-19.5, -0.5);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "clipper") {
      // Sleek Blended-Body Waverider Clipper
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.quadraticCurveTo(9, -7.6, -7, -12.5);
      ctx.lineTo(-15.5, -11.2);
      ctx.lineTo(-13.5, -4.0);
      ctx.lineTo(-15.5, 0);
      ctx.lineTo(-13.5, 4.0);
      ctx.lineTo(-15.5, 11.2);
      ctx.lineTo(-7, 12.5);
      ctx.quadraticCurveTo(9, 7.6, 21, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(21, 0);
      ctx.quadraticCurveTo(8, 6.5, -14.5, 10.6);
      ctx.lineTo(-13.5, 4.0);
      ctx.lineTo(-14.5, -4.0);
      ctx.closePath();
      ctx.globalAlpha = 0.40;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = pal.windowGlow;
      ctx.beginPath();
      ctx.ellipse(12, 0, 3.4, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Winged Orbital Shuttle
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(5, -5.2);
      ctx.lineTo(-9.5, -14.0);
      ctx.lineTo(-14, -13.0);
      ctx.lineTo(-14, 13.0);
      ctx.lineTo(-9.5, 14.0);
      ctx.lineTo(5, 5.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(4.2, -4.4);
      ctx.lineTo(-9, -12.4);
      ctx.lineTo(-12.8, -11.4);
      ctx.lineTo(-12.8, 11.4);
      ctx.lineTo(-9, 12.4);
      ctx.lineTo(4.2, 4.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.roundRect(-13.5, -3.8, 28, 7.6, 3.6);
      ctx.fill();
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(9.0, -1.9, 2.6, 3.8);
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
      ctx.arc(14.6, 0, 2.4, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
    }

    if (Math.sin(step * 12) > 0.25) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-11.5, -12.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-11.5, 12.8, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _isRunwayBusy(excludingCraft) {
    const busyPhases = new Set(["runway_takeoff", "approach", "chute_rollout", "lineup_hold"]);
    if (excludingCraft !== this.megaliner && this.megaliner && (this.megaliner.phase === "approach" || this.megaliner.phase === "rollout")) {
      return true;
    }
    return this.spaceplanes.some(other => other !== excludingCraft && busyPhases.has(other.phase));
  },

  // Colossal Multi-Deck Sci-Fi Mega-Liner Rendering
  _drawMegaLinerModel(ctx, pal, step, afterburner = 0, altitude = 0, isVertical = false) {
    const shadowFade = Math.max(0.10, 1 - altitude / 110);
    if (!isVertical) {
      ctx.save();
      ctx.translate(3 + altitude * 0.2 * pal.sunDir, 5 + altitude * 0.55);
      ctx.scale(1.15, 0.78);
      ctx.fillStyle = pal.shadowColor;
      ctx.globalAlpha = 0.52 * shadowFade;
      ctx.beginPath();
      ctx.ellipse(-3, 0, 36, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4 heavy hybrid propulsion plumes
    if (afterburner > 0.04) {
      const fl = (32 + Math.sin(step * 42) * 6) * afterburner;
      [-14, -6, 6, 14].forEach(py => {
        const tailX = Math.abs(py) > 10 ? -24 : -31;
        const g = ctx.createLinearGradient(tailX, py, tailX - fl, py);
        g.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
        g.addColorStop(0.42, `rgba(${pal.plumeMid}, 0.86)`);
        g.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(tailX + 1, py - 2.2);
        ctx.lineTo(tailX - fl, py);
        ctx.lineTo(tailX + 1, py + 2.2);
        ctx.closePath();
        ctx.fill();
      });
    }

    // Massive cranked ogee delta lifting wing
    const wG = ctx.createLinearGradient(0, -29, 0, 29);
    wG.addColorStop(0, pal.bodyLight);
    wG.addColorStop(0.5, pal.bodyMid);
    wG.addColorStop(1, pal.bodyShade);
    ctx.fillStyle = wG;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.quadraticCurveTo(4, -8, -14, -28);
    ctx.lineTo(-27, -26);
    ctx.lineTo(-30, -8);
    ctx.lineTo(-30, 8);
    ctx.lineTo(-27, 26);
    ctx.quadraticCurveTo(4, 8, 22, 0);
    ctx.closePath();
    ctx.fill();

    // Wing leading heat-shield trim & twin canted outboard stabilizer fins
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(-26, -28.5, 11, 3.0);
    ctx.fillRect(-26, 25.5, 11, 3.0);

    // 4 heavy engine pods (2 inboard trunk + 2 underwing nacelles)
    [-14, -6, 6, 14].forEach(py => {
      const x0 = Math.abs(py) > 10 ? -24 : -31;
      ctx.fillStyle = pal.towerSteel;
      ctx.beginPath();
      ctx.roundRect(x0, py - 2.3, 12, 4.6, 1.4);
      ctx.fill();
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x0 - 1.2, py - 1.8, 2.2, 3.6);
    });

    // Colossal Deep Double-Bubble Multi-Deck Fuselage
    const fGrad = ctx.createLinearGradient(0, -8.5, 0, 8.5);
    fGrad.addColorStop(0, pal.bodyLight);
    fGrad.addColorStop(0.65, pal.bodyLight);
    fGrad.addColorStop(1, pal.bodyShade);
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.moveTo(41, 0);
    ctx.quadraticCurveTo(26, -8.5, -28, -5.8);
    ctx.lineTo(-33, 0);
    ctx.lineTo(-28, 5.8);
    ctx.quadraticCurveTo(26, 8.5, 41, 0);
    ctx.closePath();
    ctx.fill();

    // Metallic hull panel & livery stripes
    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(-26, 1.6, 56, 1.4);
    ctx.fillRect(-24, -4.6, 48, 0.9);

    // Command bridge & 3 Distinct Illuminated Passenger Window Decks
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(29, -2.5, 5.2, 2.2);
    for (let wi = 0; wi < 12; wi++) {
      const wx = 23 - wi * 3.8;
      ctx.fillRect(wx, -3.5, 1.9, 1.0); // Upper Lounge Deck
      ctx.fillRect(wx + 0.3, -1.6, 1.9, 1.0); // Main Passenger Deck
      ctx.fillRect(wx + 0.6, 0.3, 1.9, 1.0); // Lower Mezzanine Deck
    }

    // Tall swept dorsal tail fin
    ctx.fillStyle = pal.bodyLight;
    ctx.beginPath();
    ctx.moveTo(-18, -2.0);
    ctx.lineTo(-34, -16.5);
    ctx.lineTo(-37.5, -14.2);
    ctx.lineTo(-31, -1.0);
    ctx.closePath();
    ctx.fill();

    if (Math.sin(step * 10) > 0.2) {
      ctx.fillStyle = "#F87171";
      ctx.beginPath();
      ctx.arc(-26, -27.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.arc(-26, 27.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Rare Colossal Mega-Liner Loop: Runway Approach -> Terminal Boarding -> Taxi to Tower -> Vertical Launch
  _updateAndDrawMegaLiner(ctx, L, pal, dt, step, w, h) {
    const ml = this.megaliner;
    if (!ml) return;
    ml.t += dt;

    const gate = L.gates[2] || L.gates[0];
    const rwStart = L.rwPt(0.06);
    const rwExit = L.rwPt(L.rwExitT);
    const baseScale = 0.72 * L.termScale;
    let visible = false;
    let x = ml.x;
    let y = ml.y;
    let scale = baseScale;
    let heading = ml.heading;
    let altitude = 0;
    let showChutes = false;
    let chuteInf = 0;
    let afterburner = 0;
    let isVertical = false;

    if (ml.phase === "dormant_wait") {
      if (ml.t >= ml.phaseDuration && !this._isRunwayBusy(ml)) {
        ml.phase = "approach";
        ml.t = 0;
        ml.dist = 0;
        ml.phaseDuration = 8.4;
        ml.chuteDetached = false;
        ml.detachedChuteAlpha = 0;
      }
      return;
    } else if (ml.phase === "approach") {
      visible = true;
      const p = Math.min(1, ml.t / ml.phaseDuration);
      const startX = -75;
      const startY = rwStart.y - 44;
      const ease = 1 - Math.pow(1 - p, 1.5);
      x = this._lerp(startX, rwStart.x, p);
      y = this._lerp(startY, rwStart.y, ease);
      altitude = (1 - ease) * 38;
      scale = (0.44 + ease * 0.28) * L.termScale;
      heading = L.rwAng + (1 - ease) * 0.06;
      afterburner = 0.22;
      if (p >= 1) {
        ml.phase = "rollout";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 50.0;
        ml.phaseDuration = 10.0;
      }
    } else if (ml.phase === "rollout") {
      visible = true;
      const rollLen = Math.hypot(rwExit.x - rwStart.x, rwExit.y - rwStart.y);
      const rwF = Math.min(1, ml.dist / Math.max(1, rollLen));
      const targetV = rwF > 0.72 ? 8.0 : (50.0 - 42.0 * (rwF / 0.72));
      ml.speed += (targetV - ml.speed) * Math.min(1, dt * 3.8);
      ml.dist += ml.speed * dt;
      x = rwStart.x + Math.cos(L.rwAng) * Math.min(ml.dist, rollLen);
      y = rwStart.y + Math.sin(L.rwAng) * Math.min(ml.dist, rollLen);
      heading = L.rwAng;
      scale = (0.72 + Math.min(1, rwF) * 0.14) * L.termScale;
      if (rwF < 0.78) {
        showChutes = true;
        chuteInf = rwF < 0.12 ? (rwF / 0.12) : 0.95;
      } else if (!ml.chuteDetached) {
        ml.chuteDetached = true;
        ml.detachedChuteX = x - Math.cos(heading) * 32 * scale;
        ml.detachedChuteY = y - Math.sin(heading) * 32 * scale;
        ml.detachedChuteAlpha = 0.82;
      }
      if (ml.dist >= rollLen) {
        ml.phase = "taxi_to_gate";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 7.2;
      }
    } else if (ml.phase === "taxi_to_gate") {
      visible = true;
      const path = this._getExitToGatePath(L, gate);
      ml.speed = 7.2;
      ml.dist += ml.speed * dt;
      const pt = this._sampleArcPath(path, ml.dist);
      x = pt.x;
      y = pt.y;
      heading = pt.angle;
      scale = (0.86 - (ml.dist / path.totalLen) * 0.08) * L.termScale;
      if (ml.dist >= path.totalLen) {
        ml.phase = "boarding";
        ml.t = 0;
        ml.phaseDuration = 9.5;
      }
    } else if (ml.phase === "boarding") {
      visible = true;
      x = gate.x;
      y = gate.y + 15 * L.termScale;
      heading = gate.heading;
      scale = 0.78 * L.termScale;
      if (ml.t >= ml.phaseDuration && !this._isMainPadBusy("megaliner")) {
        ml.phase = "taxi_to_pad";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 7.0;
      }
    } else if (ml.phase === "taxi_to_pad") {
      visible = true;
      const path = this._buildArcPath([
        [gate, gate.approachPt, L.apronSouth, L.apronSW],
        [L.apronSW, { x: L.satWest.x - 105 * L.termScale, y: L.satWest.y + 12 * L.termScale }, { x: L.padX - 18, y: L.padY + 24 }, { x: L.padX, y: L.padY }]
      ], 34);
      ml.speed = 7.0;
      ml.dist += ml.speed * dt;
      const pt = this._sampleArcPath(path, ml.dist);
      x = pt.x;
      y = pt.y;
      heading = pt.angle;
      scale = (0.78 - (ml.dist / path.totalLen) * 0.12) * L.termScale;
      if (ml.dist >= path.totalLen) {
        ml.phase = "pad_prep";
        ml.t = 0;
        ml.phaseDuration = 6.2;
      }
    } else if (ml.phase === "pad_prep") {
      visible = true;
      const p = Math.min(1, ml.t / ml.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      scale = 0.66 * L.termScale;
      x = L.padX;
      y = L.padY - 33 * scale * ease;
      heading = this._lerpAngle(heading, -Math.PI * 0.5, ease);
      isVertical = true;
      if (p > 0.45) {
        this._drawPadDelugeAndTowerLights(ctx, L, pal, (p - 0.45) / 0.55, step);
        if (Math.random() < 0.35) {
          this.ventParticles.push({
            x: L.padX + (Math.random() - 0.5) * 16, y: L.padY - 8,
            vx: (Math.random() - 0.5) * 0.8, vy: -0.25,
            r: 3.5, life: 0, maxLife: 45
          });
        }
      }
      if (ml.t >= ml.phaseDuration) {
        ml.phase = "vertical_launch";
        ml.t = 0;
        ml.phaseDuration = 11.5;
      }
    } else if (ml.phase === "vertical_launch") {
      visible = true;
      isVertical = true;
      const p = Math.min(1, ml.t / ml.phaseDuration);
      const clearFrac = 0.42;
      const towerClearLift = L.towerH * 1.18;
      let liftY, turnX, tilt;
      if (p < clearFrac) {
        const vp = p / clearFrac;
        liftY = towerClearLift * Math.pow(vp, 2.2);
        turnX = 0;
        tilt = 0;
      } else {
        const tp = (p - clearFrac) / (1 - clearFrac);
        liftY = towerClearLift + Math.pow(tp, 1.55) * (L.padY + 240 - towerClearLift);
        turnX = Math.pow(tp, 1.9) * (w * 0.18);
        tilt = Math.pow(tp, 1.25) * 0.38;
      }
      scale = 0.66 * L.termScale;
      x = L.padX + turnX;
      y = L.padY - 33 * scale - liftY;
      heading = -Math.PI * 0.5 + tilt;
      altitude = Math.min(120, liftY * 0.5);
      afterburner = p < 0.1 ? (0.55 + p * 4.5) : 1.35;

      const deluge = p < 0.46 ? Math.max(0.25, 1 - p / 0.46) : 0;
      this._drawPadDelugeAndTowerLights(ctx, L, pal, deluge, step);
      if (Math.random() < 0.85) {
        const nearPad = y > L.padY - 75;
        this.plumeParticles.push({
          x: x + (Math.random() - 0.5) * (nearPad ? 18 : 6),
          y: nearPad ? L.padY + 2 : y + 18,
          vx: nearPad ? (Math.random() - 0.5) * 2.8 : (Math.random() - 0.5) * 0.4,
          vy: nearPad ? -0.25 : 0.65,
          r: nearPad ? 7.5 : 4.2,
          grow: nearPad ? 0.24 : 0.16,
          hot: p < 0.72 && Math.random() < 0.45,
          life: 0,
          maxLife: nearPad ? 92 : 140
        });
      }
      if (ml.t >= ml.phaseDuration) {
        ml.phase = "dormant_wait";
        ml.t = 0;
        ml.phaseDuration = this._rand(38.0, 54.0);
        return;
      }
    }

    ml.x = x;
    ml.y = y;
    ml.heading = this._lerpAngle(ml.heading, heading, Math.min(1, dt * 6));
    ml.altitude = altitude;

    if (ml.chuteDetached && ml.detachedChuteAlpha > 0.01) {
      ml.detachedChuteAlpha = Math.max(0, ml.detachedChuteAlpha - dt * 0.45);
      ctx.save();
      ctx.globalAlpha = ml.detachedChuteAlpha;
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.ellipse(ml.detachedChuteX, ml.detachedChuteY + 3, 7, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (!visible) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ml.heading);
    ctx.scale(scale, scale);

    if (showChutes && chuteInf > 0.05) {
      const canopyX = -32 - 22 * chuteInf;
      [-7.5, 7.5].forEach(cy => {
        ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.58)" : "rgba(71, 85, 105, 0.56)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(canopyX, cy - 6);
        ctx.moveTo(-30, 0);
        ctx.lineTo(canopyX, cy + 6);
        ctx.stroke();
        ctx.fillStyle = pal.chuteColor;
        ctx.beginPath();
        ctx.ellipse(canopyX - 3, cy, 7.5 * chuteInf, 5.8 * chuteInf, 0, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();
      });
    }

    this._drawMegaLinerModel(ctx, pal, step, afterburner, altitude, isVertical);
    ctx.restore();
  },

  _pickFreeGateIdx(excludingCraft) {
    const taken = new Set(
      this.spaceplanes
        .filter(other => other !== excludingCraft && (other.phase === "taxi_to_gate" || other.phase === "gate_turnaround" || other.phase === "apron_taxi_out"))
        .map(other => other.gateIdx)
    );
    const maxG = this._lastW && this._lastW < 720 ? 2 : 4;
    const avail = [];
    for (let i = 0; i < maxG; i++) {
      if (!taken.has(i)) avail.push(i);
    }
    return avail.length > 0 ? this._pick(avail) : Math.floor(Math.random() * maxG);
  },

  _updateSingleSpaceplane(ctx, sp, L, pal, dt, step, w, h) {
    sp.t += dt;

    let visible = false;
    let x = sp.x || 0;
    let y = sp.y || 0;
    let scale = 0.48 * L.termScale;
    let targetHeading = sp.heading;
    let altitude = 0;
    let showChute = false;
    let chuteInflation = 0;
    let afterburner = 0;

    const V_TAXI = 8.5;       // Steady realistic tarmac taxi speed (px/s)
    const V_TD = 56.0;        // Shallow flared touchdown speed (px/s)
    const V_VR = 96.0;        // Brisk realistic takeoff rotation speed (px/s)

    const entryPt = L.rwPt(L.rwEntryT);
    const exitPt = L.rwPt(L.rwExitT);
    const dirX = Math.cos(L.rwAng);
    const dirY = Math.sin(L.rwAng);
    const gate = L.gates[(sp.gateIdx || 0) % L.gates.length];

    if (sp.phase === "hangar_emerge") {
      visible = true;
      const p0 = { x: L.hangarX + 24, y: L.hangarDoorY - 5 };
      const p1 = { x: L.hangarDoorX - 18, y: L.hangarDoorY + 4 };
      const total = Math.max(10, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const desired = Math.min(V_TAXI, Math.max(2.5, (sp.dist / 14 + 0.25) * V_TAXI));
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 3.0);
      sp.dist += sp.speed * dt;
      const f = Math.min(1, sp.dist / total);
      x = p0.x + (p1.x - p0.x) * f;
      y = p0.y + (p1.y - p0.y) * f;
      targetHeading = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      scale = 0.44 * L.termScale;
      if (sp.dist >= total) {
        sp.dist = 0;
        sp.t = 0;
        sp.speed = V_TAXI;
        sp.gateIdx = this._pickFreeGateIdx(sp);
        sp.phase = (sp.role === "apron" || Math.random() < 0.45) ? "apron_taxi_out" : "taxi_to_runway";
      }
    } else if (sp.phase === "apron_taxi_out" || sp.phase === "taxi_to_gate") {
      visible = true;
      const path = sp.phase === "taxi_to_gate"
        ? this._getExitToGatePath(L, gate)
        : this._getApronShuttleOutPath(L, gate);
      const rem = path.totalLen - sp.dist;
      const desired = rem < 24 ? Math.max(2.0, V_TAXI * (rem / 24)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.45 + (sp.dist / path.totalLen) * 0.04) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp.phase = "gate_turnaround";
        sp.t = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(9.0, 17.0);
      }
    } else if (sp.phase === "gate_turnaround") {
      visible = true;
      x = gate.x;
      y = gate.y;
      targetHeading = gate.heading;
      scale = 0.48 * L.termScale;
      if (sp.t >= sp.phaseDuration) {
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        // Randomly depart for the runway OR return back to the Arched Hangar to despawn inside!
        sp.phase = (sp.role === "runway" && Math.random() < 0.55) ? "taxi_to_runway" : "apron_taxi_return";
        sp._fromGate = true;
      }
    } else if (sp.phase === "apron_taxi_return") {
      visible = true;
      const path = this._getApronShuttleReturnPath(L, gate);
      const desired = sp.dist < 20 ? Math.max(2.0, V_TAXI * (sp.dist / 20)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 3.5);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.49 - (sp.dist / path.totalLen) * 0.06) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp.variant = this._pick(this.ALL_SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp._fromGate = false;
        sp.phaseDuration = this._rand(7.0, 16.0);
      }
    } else if (sp.phase === "taxi_to_runway") {
      visible = true;
      const path = this._getTaxiToRunwayPath(L, sp._fromGate ? gate : null);
      const rem = path.totalLen - sp.dist;
      const desired = rem < 22 ? Math.max(2.2, V_TAXI * (rem / 22)) : V_TAXI;
      sp.speed += (desired - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.46 + (sp.dist / path.totalLen) * 0.05) * L.termScale;
      if (sp.dist >= path.totalLen) {
        sp._fromGate = false;
        sp.phase = "lineup_hold";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(2.8, 4.8);
      }
    } else if (sp.phase === "lineup_hold") {
      visible = true;
      const p = Math.min(1, sp.t / Math.max(1, sp.phaseDuration));
      const ease = p * p * (3 - 2 * p);
      x = (entryPt.x - dirX * 14) + dirX * 14 * ease;
      y = (entryPt.y - dirY * 14) + dirY * 14 * ease;
      targetHeading = L.rwAng;
      scale = 0.50 * L.termScale;
      if (sp.t >= sp.phaseDuration && !this._isRunwayBusy(sp)) {
        sp.phase = "runway_takeoff";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp._airborne = false;
      }
    } else if (sp.phase === "runway_takeoff") {
      // Brisk progressive acceleration 0 -> V_VR (96 px/s) down runway, transitioning C1-smoothly into 128 px/s climb!
      visible = true;
      const liftPt = L.rwPt(0.72);
      const rollLen = Math.hypot(liftPt.x - entryPt.x, liftPt.y - entryPt.y);

      if (!sp._airborne) {
        const accel = (V_VR * V_VR) / (2 * Math.max(60, rollLen));
        sp.speed = Math.min(V_VR, sp.speed + accel * dt);
        sp.dist += sp.speed * dt;
        const frac = Math.min(1, sp.dist / rollLen);
        x = entryPt.x + (liftPt.x - entryPt.x) * frac;
        y = entryPt.y + (liftPt.y - entryPt.y) * frac;
        afterburner = Math.min(1, 0.35 + frac * 0.75);
        const rotPitch = Math.max(0, (frac - 0.80) / 0.20);
        targetHeading = L.rwAng - rotPitch * 0.08;
        altitude = rotPitch * rotPitch * 2.2;
        scale = (0.50 + frac * 0.10) * L.termScale;

        if (sp.dist >= rollLen) {
          sp._airborne = true;
          sp.dist = 0;
          sp.speed = V_VR;
        }
      } else {
        const climbPath = this._getTakeoffClimbPath(L, w, h, sp);
        sp.speed = Math.min(128, sp.speed + 12.0 * dt);
        sp.dist += sp.speed * dt;
        const cp = Math.min(1, sp.dist / climbPath.totalLen);
        const pt = this._sampleArcPath(climbPath, sp.dist);
        x = pt.x;
        y = pt.y;
        targetHeading = pt.angle;
        altitude = 2.2 + Math.pow(cp, 1.35) * 95;
        afterburner = cp < 0.78 ? 1.0 : Math.max(0, (1 - cp) * 4.5);
        scale = Math.max(0.24, (0.60 - cp * 0.36)) * L.termScale;

        if (Math.random() < 0.75) {
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
          sp.variant = this._pick(this.ALL_SPACEPLANE_VARIANTS);
          sp.phase = "sky_wait";
          sp.t = 0;
          sp.dist = 0;
          sp._airborne = false;
          sp.phaseDuration = this._rand(5.0, 13.0);
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
        sp.speed = 76;
        sp.phase = "approach";
        sp.t = 0;
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      // Shallow ~3° glide slope flaring smoothly onto the runway at V_TD (56 px/s)
      visible = true;
      const appPath = this._getApproachPath(L);
      const frac = Math.min(1, sp.dist / appPath.totalLen);
      sp.speed = 76 - (76 - V_TD) * frac;
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(appPath, sp.dist);
      x = pt.x;
      y = pt.y;
      const flare = frac > 0.78 ? ((frac - 0.78) / 0.22) * 0.055 : 0;
      targetHeading = pt.angle - flare;
      altitude = Math.pow(1 - frac, 1.55) * 24;
      scale = (0.34 + frac * 0.16) * L.termScale;

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
        sp.speed = V_TD;
      }
    } else if (sp.phase === "chute_rollout") {
      // Smooth aerodynamic drag deceleration from V_TD down to V_TAXI before rolling cleanly onto exit taxiway!
      visible = true;
      const tdPt = L.rwPt(0.14);
      const rollLen = Math.max(60, Math.hypot(exitPt.x - tdPt.x, exitPt.y - tdPt.y));
      const frac = Math.min(1, sp.dist / rollLen);
      sp.speed = V_TAXI + (V_TD - V_TAXI) * Math.pow(1 - frac, 1.25);
      sp.dist += sp.speed * dt;
      const rwF = Math.min(1, sp.dist / rollLen);
      x = tdPt.x + (exitPt.x - tdPt.x) * rwF;
      y = tdPt.y + (exitPt.y - tdPt.y) * rwF;
      scale = (0.50 + rwF * 0.08) * L.termScale;
      const noseSettle = Math.max(0, 1 - rwF / 0.16) * 0.055;
      targetHeading = L.rwAng - noseSettle;
      altitude = 0;

      if (rwF < 0.78) {
        showChute = true;
        chuteInflation = rwF < 0.10 ? (rwF / 0.10) : (0.94 + Math.sin(step * 18) * 0.06);
      } else if (!sp.chuteDetached) {
        sp.chuteDetached = true;
        sp.detachedChuteX = x - Math.cos(sp.heading) * 22 * scale;
        sp.detachedChuteY = y - Math.sin(sp.heading) * 22 * scale;
        sp.detachedChuteAlpha = 0.85;
      }

      if (sp.dist >= rollLen) {
        sp.t = 0;
        sp.dist = 0;
        sp.speed = V_TAXI;
        // Randomly taxi to a terminal gate stand (~72%) OR directly to the Arched Hangar to despawn inside!
        if (Math.random() < 0.72) {
          sp.gateIdx = this._pickFreeGateIdx(sp);
          sp.phase = "taxi_to_gate";
        } else {
          sp.phase = "taxi_to_hangar";
        }
      }
    } else if (sp.phase === "taxi_to_hangar") {
      visible = true;
      const path = this._getTaxiToHangarPath(L);
      sp.speed += (V_TAXI - sp.speed) * Math.min(1, dt * 4.0);
      sp.dist += sp.speed * dt;
      const pt = this._sampleArcPath(path, sp.dist);
      x = pt.x;
      y = pt.y;
      targetHeading = pt.angle;
      scale = (0.58 - (sp.dist / path.totalLen) * 0.14) * L.termScale;

      if (sp.dist >= path.totalLen) {
        sp.variant = this._pick(this.ALL_SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.dist = 0;
        sp.speed = 0;
        sp.phaseDuration = this._rand(7.0, 17.0);
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
      ctx.ellipse(sp.detachedChuteX, sp.detachedChuteY + 3, 5.5, 2.4, 0.2, 0, Math.PI * 2);
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
      const chuteR = 7.4 * chuteInflation;
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

    const beamA = pal.isNightLights ? 0.32 : 0.10;
    const beamG = ctx.createLinearGradient(17, 0, 58, 0);
    beamG.addColorStop(0, `rgba(255, 251, 235, ${beamA})`);
    beamG.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(17, -1.6);
    ctx.lineTo(58, -9);
    ctx.lineTo(58, 9);
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
      this.fogState.alpha = Math.max(0, this.fogState.alpha - dt * 0.55);
      if (this.fogState.alpha <= 0.005) return;
    } else {
      if (now >= this.fogState.nextCheck || !this.fogState.active) {
        const roll = Math.random() < 0.85;
        this.fogState.active = roll;
        this.fogState.targetAlpha = roll ? (0.42 + Math.random() * 0.24) : 0.16;
        this.fogState.nextCheck = now + 16000 + Math.random() * 14000;
      }
      this.fogState.alpha += (this.fogState.targetAlpha - this.fogState.alpha) * Math.min(1, dt * 0.42);
    }

    if (this.fogState.alpha <= 0.01) return;
    this.fogState.offset = (this.fogState.offset + dt * 18) % (w + 480);

    ctx.save();
    for (let layer = 0; layer < 3; layer++) {
      const baseY = L.islandTopY + (L.islandBotY - L.islandTopY) * (0.16 + layer * 0.32);
      const bandH = 82 + layer * 38;
      const g = ctx.createLinearGradient(0, baseY - bandH * 0.55, 0, baseY + bandH * 0.65);
      const peak = this.fogState.alpha * (layer === 0 ? 0.50 : (layer === 1 ? 0.40 : 0.30));
      g.addColorStop(0, "rgba(255, 248, 242, 0)");
      g.addColorStop(0.45, `rgba(255, 247, 240, ${peak.toFixed(3)})`);
      g.addColorStop(1, "rgba(255, 248, 242, 0)");
      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.moveTo(0, baseY + bandH);
      for (let x = 0; x <= w + 50; x += 50) {
        const dir = layer % 2 === 0 ? 1 : -0.75;
        const wave = Math.sin((x + this.fogState.offset * dir) * (0.004 + layer * 0.0012) + layer * 2.1) * (18 + layer * 4);
        ctx.lineTo(x, baseY - bandH * 0.36 + wave);
      }
      ctx.lineTo(w, baseY + bandH);
      ctx.closePath();
      ctx.fill();
    }

    // Soft sculpted coastal dawn mist wisps drifting across launch pad, runway & bay shore
    for (let wi = 0; wi < 6; wi++) {
      const fx = ((w * (0.14 + wi * 0.16) + this.fogState.offset * (wi % 2 === 0 ? 0.55 : -0.40)) % (w + 260)) - 130;
      const fy = L.islandTopY + (L.islandBotY - L.islandTopY) * (0.12 + (wi % 3) * 0.28);
      const rx = 120 + (wi % 3) * 55;
      const ry = 26 + (wi % 2) * 14;
      const wg = ctx.createRadialGradient(fx, fy, rx * 0.12, fx, fy, rx);
      const wa = this.fogState.alpha * (0.34 - (wi % 2) * 0.08);
      wg.addColorStop(0, `rgba(255, 245, 238, ${wa.toFixed(3)})`);
      wg.addColorStop(0.55, `rgba(255, 248, 242, ${(wa * 0.48).toFixed(3)})`);
      wg.addColorStop(1, "rgba(255, 248, 242, 0)");
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
};

window.WorldGateway = WorldGateway;
