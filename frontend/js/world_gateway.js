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
  heavyHeli: null,
  groundVehicles: [],
  spVariantIdx: 0,
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  meteors: [],
  nextMeteorTime: 0,
  satellites: [],
  jetFormations: [],
  portOps: null,
  _lastW: 0,
  _lastH: 0,
  _lastMode: "",
  _lastDishAim: -0.8,

  SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper", "starliner"],
  ALL_SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper", "starliner", "fighter", "bomber"],
  JET_STUNT_TYPES: ["bomb_burst", "delta_loop", "delta_roll", "upside_down", "echelon_roll"],
  MEGALINER_VARIANTS: ["double_deck", "blended_wing"],
  JET_LIVERIES: [
    {
      name: "blue_angels",
      body: "#12326B",
      shade: "#0A1D42",
      belly: "#0F2958",
      accent: "#FACC15",
      spine: "#FACC15",
      smokePalette: ["254, 249, 215"]
    },
    {
      name: "thunderbirds",
      body: "#F8FAFC",
      shade: "#CBD5E1",
      belly: "#E2E8F0",
      accent: "#DC2626",
      spine: "#1D4ED8",
      smokePalette: ["255, 255, 255"]
    },
    {
      name: "red_arrows",
      body: "#C81E2B",
      shade: "#7F1D1D",
      belly: "#F8FAFC",
      accent: "#F8FAFC",
      spine: "#1D4ED8",
      smokePalette: ["248, 113, 113", "255, 255, 255", "96, 165, 250", "255, 255, 255", "248, 113, 113"]
    },
    {
      name: "black_knights",
      body: "#1E293B",
      shade: "#0F172A",
      belly: "#0B1120",
      accent: "#EF4444",
      spine: "#E2E8F0",
      smokePalette: ["241, 245, 249"]
    },
    {
      name: "aggressor_flanker",
      body: "#38BDF8",
      shade: "#334155",
      belly: "#475569",
      accent: "#F97316",
      spine: "#1E293B",
      smokePalette: ["224, 242, 254"]
    },
    {
      name: "golden_eagles",
      body: "#1F2937",
      shade: "#111827",
      belly: "#F8FAFC",
      accent: "#F59E0B",
      spine: "#F59E0B",
      smokePalette: ["254, 243, 199"]
    }
  ],
  _lastJetStunt: "",
  _lastJetLivery: "",
  _lastMegaVariant: "",

  _pickMegaLinerVariant() {
    const pool = this.MEGALINER_VARIANTS.filter(v => v !== this._lastMegaVariant);
    const chosen = pool.length > 0 ? this._pick(pool) : this.MEGALINER_VARIANTS[0];
    this._lastMegaVariant = chosen;
    return chosen;
  },

  _rand(min, max) {
    return min + Math.random() * (max - min);
  },

  _pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  _clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  },

  // Unified perspective depth scale factor (smaller near north perimeter, larger toward south foreground)
  _depthScale(L, y) {
    const f = this._clamp((y - L.islandTopY) / Math.max(1, L.islandBotY - L.islandTopY), 0, 1.15);
    return 0.50 + f * 0.68;
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
    this.heavyHeli = null;
    this.groundVehicles = [];
    this.stars = [];
    this.clouds = [];
    this.cirrus = [];
    this.waterGlints = [];
    this.orbiters = [];
    this.meteors = [];
    this.nextMeteorTime = 0;
    this.satellites = [];
    this.jetFormations = [];
    this.portOps = null;
    this._lastJetLivery = "";
    this._lastMegaVariant = "";
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
        skyTop: "#020611",
        skyMid: "#071329",
        skyHorizon: "#13264A",
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

  getCelestialState(w, h, L, mode, diurnalHour = null) {
    const defaults = { morning: 7.5, light: 13.0, evening: 18.5, dark: 23.0 };
    let hour = (typeof diurnalHour === "number" && Number.isFinite(diurnalHour))
      ? diurnalHour
      : ((typeof WaveCanvas !== "undefined" && WaveCanvas.getDiurnalHour)
          ? WaveCanvas.getDiurnalHour(mode)
          : (defaults[mode] !== undefined ? defaults[mode] : 13.0));
    hour = ((hour % 24) + 24) % 24;

    // Solar arc: East (Right) at Dawn (~05:45) -> Overhead Center at Noon (13:00) -> West (Left) at Dusk (~20:15)
    const uSunRaw = (hour - 5.75) / 14.5;
    const sunVisible = uSunRaw >= -0.02 && uSunRaw <= 1.02;
    const uSun = Math.max(0, Math.min(1, uSunRaw));
    const sunXFrac = 0.91 - uSun * 0.82;
    const sunAlt = Math.sin(uSun * Math.PI);
    const sunFadeIn = Math.min(1, Math.max(0, (uSunRaw + 0.02) / 0.06));
    const sunFadeOut = Math.min(1, Math.max(0, (1.02 - uSunRaw) / 0.06));
    const sunAlpha = sunVisible ? Math.min(sunFadeIn, sunFadeOut) : 0;
    const sun = {
      kind: "sun",
      xFrac: sunXFrac,
      x: w * sunXFrac,
      y: L.horizonY - 4 - sunAlt * (L.horizonY * 0.72),
      alt: sunAlt,
      visible: sunVisible && sunAlpha > 0.01,
      alpha: sunAlpha
    };

    // Lunar arc: Rises East (Right) during Golden Hour (~17:30) -> Zenith near Midnight -> Sets West (Left) at Dawn (~06:15)
    const moonElapsed = ((hour - 17.5) % 24 + 24) % 24;
    const uMoonRaw = moonElapsed / 12.75;
    const moonVisibleRaw = uMoonRaw >= 0 && uMoonRaw <= 1.0;
    const uMoon = Math.max(0, Math.min(1, uMoonRaw));
    const moonXFrac = 0.89 - uMoon * 0.78;
    const moonAlt = Math.sin(uMoon * Math.PI);
    const moonFadeIn = Math.min(1, Math.max(0, uMoonRaw / 0.08));
    const moonFadeOut = Math.min(1, Math.max(0, (1.0 - uMoonRaw) / 0.12));
    const twilightMult = mode === "dark" ? 1.0 : (mode === "evening" || mode === "morning" ? 0.58 : 0);
    const moonAlpha = moonVisibleRaw ? Math.min(moonFadeIn, moonFadeOut) * twilightMult : 0;
    const moon = {
      kind: "moon",
      xFrac: moonXFrac,
      x: w * moonXFrac,
      y: L.horizonY - 4 - moonAlt * (L.horizonY * 0.70),
      alt: moonAlt,
      visible: moonVisibleRaw && moonAlpha > 0.04,
      alpha: moonAlpha
    };

    const primary = (mode === "dark" || !sun.visible)
      ? (moon.visible ? moon : { kind: "moon", xFrac: 0.50, x: w * 0.50, y: L.horizonY * 0.34, alt: 0.85, visible: true, alpha: 0.78 })
      : sun;

    // Shadow direction casts away from primary light (Dawn East sun -> negative/West shadows; Dusk West sun -> positive/East shadows)
    const rawDir = (0.5 - primary.xFrac) * 2.6 * (0.72 + (1 - primary.alt) * 0.78);
    const shadowDir = Math.max(-1.55, Math.min(1.55, rawDir));

    return { hour, sun, moon, primary, shadowDir };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.30 : 0.27);
    const islandTopY = h * (isNarrow ? 0.44 : 0.42);
    const islandBotY = h * (isNarrow ? 0.74 : 0.72);
    const spanY = islandBotY - islandTopY;

    // 1. Primary Heavy Orbital Launch Complex (North-West Peninsula)
    const padX = w * (isNarrow ? 0.16 : 0.202);
    const padY = islandTopY + spanY * (isNarrow ? 0.17 : 0.14);
    const towerH = isNarrow ? Math.min(138, Math.max(96, h * 0.16)) : Math.min(198, Math.max(102, h * 0.205));
    const towerW = Math.max(10, towerH * 0.082);
    const towerLeftX = padX - towerW * 1.95;
    const towerRightX = padX + towerW * 1.95;

    // Monumental Vertical Assembly Building (VAB) beside the north crawlerway
    const vabX = w * (isNarrow ? 0.34 : 0.278);
    const vabY = islandTopY + spanY * 0.155;
    const vabW = isNarrow ? 38 : Math.min(68, w * 0.048);
    const vabH = isNarrow ? 40 : Math.min(74, h * 0.082);

    // Horizontal Integration Facility (HIF) along far-northern crawlerway so rocket & tug spawn/despawn INSIDE!
    const hifX = w * (isNarrow ? 0.65 : 0.618);
    const hifY = islandTopY + spanY * 0.112;
    const hifW = isNarrow ? Math.min(72, w * 0.17) : Math.min(126, w * 0.096);
    const hifH = hifW * 0.22;
    const hifDoorX = hifX - hifW * 0.42;
    const hifDoorY = hifY + 2;

    // 2. Second Offshore Launch Platform (Falcon Heavy Center Pad + Dual Booster Recovery Pads)
    const offshorePadX = w * (isNarrow ? 0.80 : 0.752);
    const offshorePadY = horizonY + Math.max(24, (islandTopY - horizonY) * 0.48);
    const offshoreShoreX = w * (isNarrow ? 0.71 : 0.688);
    const offshoreShoreY = islandTopY + 5;
    const offshoreScale = isNarrow ? 0.42 : Math.min(0.68, Math.max(0.52, w / 1900));
    const offshoreLzLeftX = offshorePadX - 46 * offshoreScale;
    const offshoreLzRightX = offshorePadX + 46 * offshoreScale;

    // 3. Expanded Monumental Star Terminal + Connected Satellites + Relieved Congestion Apron
    const termX = w * (isNarrow ? 0.56 : 0.505);
    const termY = islandTopY + spanY * (isNarrow ? 0.29 : 0.245);
    const termScale = isNarrow
      ? Math.max(0.46, Math.min(0.58, w / 680))
      : Math.min(1.24, Math.max(1.00, w / 1080));

    const satWest = { x: termX - 186 * termScale, y: termY - 8 * termScale };
    const satEast = { x: termX + 196 * termScale, y: termY - 4 * termScale };
    const satNorth = { x: termX - 72 * termScale, y: termY - 26 * termScale };

    // 4. Wide Arched Spaceplane Assembly Hangar (Desktop) / Clean Off-Screen East Apron Portal (Mobile)
    const hangarX = isNarrow ? (w + 76) : (w * 0.805);
    const hangarY = islandTopY + spanY * (isNarrow ? 0.22 : 0.145);
    const hangarW = Math.min(186, w * (isNarrow ? 0.20 : 0.130));
    const hangarH = hangarW * 0.28;
    const hangarDoorX = isNarrow ? (w + 42) : (hangarX - hangarW * 0.22);
    const hangarDoorY = hangarY + hangarH * 0.44;

    // 5. East Peninsula ATC Tower & Ops Precinct + Heliport 1 + Relocated South Heliport 2
    const atcX = w * (isNarrow ? 0.945 : 0.942);
    const atcY = hangarY + (isNarrow ? 64 : 84);

    // 6. Dedicated Helipads (heliPad1 East near ATC/Hangar road; heliPad2 on clean South lawn east of Port Junction)
    const heliPad1 = { x: w * (isNarrow ? 0.895 : 0.898), y: hangarY + (isNarrow ? 16 : 22) };
    const heliPad2 = { x: w * 0.425, y: islandTopY + spanY * 0.80 };

    // 7. Extended Diagonal Main Runway Reaching Near Western Peninsula Edge (Seaport arranged strictly south-west!)
    const rwLeftX = w * (isNarrow ? 0.03 : 0.132);
    const rwLeftY = islandTopY + spanY * (isNarrow ? 0.54 : 0.49);
    const rwRightX = w * (isNarrow ? 1.03 : 0.968);
    const rwRightY = islandBotY - h * (isNarrow ? 0.012 : 0.004);
    const rwAng = Math.atan2(rwRightY - rwLeftY, rwRightX - rwLeftX);
    const rwLeftHalf = isNarrow ? 6.5 : 9.2;
    const rwRightHalf = isNarrow ? 16 : 25.5;

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

    // Exact Piecewise Southern Peninsula Shoreline (Seaport wharf shifted strictly South-West of Extended Runway!)
    const shorePts = isNarrow
      ? [
          { x: -12, y: islandBotY - 12 },
          { x: w * 0.50, y: islandBotY + 6 },
          { x: w + 16, y: islandBotY + 24 }
        ]
      : [
          { x: w * 0.072, y: islandTopY + 44 },
          { x: w * 0.118, y: islandTopY + spanY * 0.595 },
          { x: w * 0.285, y: islandBotY + 12 },
          { x: w * 0.58, y: islandBotY + 18 },
          { x: w * 0.70, y: islandBotY + 28 },
          { x: w + 20, y: islandBotY + 54 }
        ];
    const portWallA = isNarrow ? shorePts[0] : shorePts[1];
    const portWallB = isNarrow ? shorePts[1] : shorePts[2];
    const shoreYAtX = (x) => {
      if (x <= shorePts[0].x) return shorePts[0].y;
      for (let i = 0; i < shorePts.length - 1; i++) {
        const a = shorePts[i];
        const b = shorePts[i + 1];
        if (x <= b.x) {
          const f = (x - a.x) / Math.max(1, b.x - a.x);
          return a.y + (b.y - a.y) * f;
        }
      }
      return shorePts[shorePts.length - 1].y;
    };

    // Unified C1-Continuous Coastal Viaduct Bridge -> Seawall Abutment -> Peninsula Road Interchange
    const abutX = w * 0.642;
    const abutY = shoreYAtX(abutX);
    const bridgeStart = { x: w * 0.90, y: h + 14 };
    const bridgeCp = { x: w * 0.735, y: Math.max(abutY + 42, h * 0.885) };
    const bridgeEnd = { x: abutX, y: abutY };
    const bdx = abutX - bridgeCp.x;
    const bdy = abutY - bridgeCp.y;
    const bLen = Math.hypot(bdx, bdy) || 1;
    const bridgeUx = bdx / bLen;
    const bridgeUy = bdy / bLen;
    const interchangeSplit = {
      x: abutX + bridgeUx * 18,
      y: abutY + bridgeUy * 18
    };

    // Expanded Ground Station squarely between Hangar and Runway
    const radarX = w * (isNarrow ? 0.78 : 0.818);
    const maxRadarY = rwYAtX(radarX) - rwHalfAtX(radarX) - (isNarrow ? 28 : 48);
    const radarY = Math.min(hangarY + hangarH + (isNarrow ? 34 : 58), maxRadarY);
    const radomeX = radarX - (isNarrow ? 12 : 34);
    const radomeY = radarY + (isNarrow ? 18 : 28);
    const radarDishes = isNarrow
      ? [
          { x: radarX - 28, y: radarY - 10, r: 9.5 },
          { x: radarX, y: radarY - 7, r: 10.4 },
          { x: radarX + 28, y: radarY - 4, r: 9.5 }
        ]
      : [
          { x: radarX - 70, y: radarY - 18, r: 14.5 },
          { x: radarX - 35, y: radarY - 14, r: 15.5 },
          { x: radarX, y: radarY - 10, r: 16.5 },
          { x: radarX + 35, y: radarY - 6, r: 15.5 },
          { x: radarX + 70, y: radarY - 2, r: 14.5 }
        ];

    const rwExitT = 0.67;
    const rwEntryT = 0.20;

    // Runway Underpass & Highway Terminal Arrival Spine
    const underpassX = w * 0.62;
    const underpassY = rwYAtX(underpassX);
    const underpassHalf = rwHalfAtX(underpassX);
    const plazaX = termX + 6 * termScale;
    const plazaY = termY + 34 * termScale;

    // 8. Spacious South Apron Taxiway Corridors & Named Terminal Gate Stands (Relieves Taxi Congestion!)
    const apronEast = { x: termX + 204 * termScale, y: termY + 38 * termScale };
    const apronSE = { x: termX + 148 * termScale, y: termY + 60 * termScale };
    const apronSouth = { x: termX - 6 * termScale, y: termY + 62 * termScale };
    const apronSW = { x: termX - 152 * termScale, y: termY + 42 * termScale };

    const megaApproach = { x: satWest.x - 16 * termScale, y: satWest.y + 38 * termScale };
    const gates = [
      { id: "G_SW", x: termX - 130 * termScale, y: termY + 37 * termScale, heading: -0.30, approachPt: apronSW },
      { id: "G_SE", x: termX + 134 * termScale, y: termY + 37 * termScale, heading: 2.74, approachPt: apronSE },
      { id: "G_SC", x: termX + 10 * termScale, y: termY + 46 * termScale, heading: -1.48, approachPt: apronSouth },
      { id: "G_SAT_W", x: satWest.x + 4 * termScale, y: satWest.y + 26 * termScale, heading: -0.95, approachPt: { x: satWest.x + 4 * termScale, y: satWest.y + 46 * termScale } },
      { id: "G_SAT_E", x: satEast.x - 4 * termScale, y: satEast.y + 26 * termScale, heading: -2.18, approachPt: { x: satEast.x - 4 * termScale, y: satEast.y + 44 * termScale } }
    ];

    const megaGate = {
      id: "G_MEGA",
      x: satWest.x - 48 * termScale,
      y: satWest.y + 18 * termScale,
      heading: -0.25,
      approachPt: megaApproach
    };

    return {
      isNarrow, horizonY, islandTopY, islandBotY, spanY,
      shorePts, portWallA, portWallB, shoreYAtX, abutX, abutY, bridgeStart, bridgeCp, bridgeEnd, bridgeUx, bridgeUy, interchangeSplit,
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
      apronEast, apronSE, apronSouth, apronSW, gates, megaGate
    };
  },

  ensureStaticCache(w, h, mode, diurnalHour = null) {
    const L = this.getLayout(w, h);
    const cel = this.getCelestialState(w, h, L, mode, diurnalHour);
    const hSlot = Math.round(cel.hour * 4);
    const key = `${Math.round(w)}x${Math.round(h)}:${mode}:h${hSlot}`;
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
    pal.sunDir = cel.shadowDir;
    pal.celestial = cel;
    pal.diurnalHour = cel.hour;

    // 1. Wide Atmospheric Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, L.horizonY + 8);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(0.55, pal.skyMid);
    skyGrad.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, L.horizonY + 8);

    // 2. Dynamic East -> West Diurnal Sun / Moon Halo, Disk & Spaceport Night Cosmos
    if (cel.sun.visible) {
      const sHaloR = Math.min(w * 0.52, 500);
      const lowBoost = 0.65 + (1 - cel.sun.alt) * 0.45;
      const sunHalo = ctx.createRadialGradient(cel.sun.x, cel.sun.y, 4, cel.sun.x, cel.sun.y, sHaloR);
      sunHalo.addColorStop(0, pal.sunCore);
      sunHalo.addColorStop(0.18, `rgba(${pal.sunGlow}, ${(0.42 * cel.sun.alpha * lowBoost).toFixed(3)})`);
      sunHalo.addColorStop(0.55, `rgba(${pal.sunGlow}, ${(0.14 * cel.sun.alpha * lowBoost).toFixed(3)})`);
      sunHalo.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
      ctx.fillStyle = sunHalo;
      ctx.fillRect(0, 0, w, L.horizonY + 110);
    }

    if (mode === "dark") {
      // Soft cool atmospheric glow behind lunar zenith position
      const pHalo = ctx.createRadialGradient(cel.primary.x, cel.primary.y, 6, cel.primary.x, cel.primary.y, Math.min(w * 0.42, 420));
      pHalo.addColorStop(0, "rgba(186, 230, 253, 0.16)");
      pHalo.addColorStop(0.45, `rgba(${pal.sunGlow}, 0.08)`);
      pHalo.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
      ctx.fillStyle = pHalo;
      ctx.fillRect(0, 0, w, L.horizonY + 80);

      // Sweeping Milky Way Galactic Band, Emission Nebulae, Crescent Moon & Atmospheric Airglow
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, L.horizonY + 2);
      ctx.clip();

      // Diagonal Milky Way stardust band sweeping across the spaceport zenith
      const mwAngle = 0.24;
      const mwCx = w * 0.56;
      const mwCy = L.horizonY * 0.46;
      ctx.save();
      ctx.translate(mwCx, mwCy);
      ctx.rotate(mwAngle);

      const bandSpan = Math.max(w, 1200) * 1.4;
      const mwGlow = ctx.createLinearGradient(0, -110, 0, 110);
      mwGlow.addColorStop(0, "rgba(30, 58, 138, 0)");
      mwGlow.addColorStop(0.28, "rgba(56, 139, 224, 0.12)");
      mwGlow.addColorStop(0.50, "rgba(129, 140, 248, 0.18)");
      mwGlow.addColorStop(0.72, "rgba(56, 189, 248, 0.10)");
      mwGlow.addColorStop(1, "rgba(30, 58, 138, 0)");
      ctx.fillStyle = mwGlow;
      ctx.fillRect(-bandSpan * 0.5, -110, bandSpan, 220);

      // Rich nebula pockets (violet-magenta emission, cyan ionized veil & warm galactic core dust)
      const nebulae = [
        { x: -w * 0.26, y: -12, r: Math.min(180, w * 0.16), rgb: "56, 189, 248", a: 0.15 },
        { x: -w * 0.06, y: 10, r: Math.min(220, w * 0.19), rgb: "167, 139, 250", a: 0.16 },
        { x: w * 0.12, y: -4, r: Math.min(190, w * 0.16), rgb: "251, 191, 36", a: 0.11 },
        { x: w * 0.24, y: 14, r: Math.min(165, w * 0.14), rgb: "244, 114, 182", a: 0.10 },
        { x: w * 0.38, y: -8, r: Math.min(155, w * 0.14), rgb: "56, 189, 248", a: 0.13 }
      ];
      nebulae.forEach(nb => {
        const ng = ctx.createRadialGradient(nb.x, nb.y, 4, nb.x, nb.y, nb.r);
        ng.addColorStop(0, `rgba(${nb.rgb}, ${nb.a})`);
        ng.addColorStop(0.5, `rgba(${nb.rgb}, ${(nb.a * 0.42).toFixed(3)})`);
        ng.addColorStop(1, `rgba(${nb.rgb}, 0)`);
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.ellipse(nb.x, nb.y, nb.r * 1.45, nb.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Soft organic dark galactic dust clouds sculpting realistic Milky Way rift depth
      for (let d = 0; d < 5; d++) {
        const dx = -bandSpan * 0.34 + d * (bandSpan * 0.17);
        const dy = Math.sin(d * 1.4) * 8;
        const dr = Math.min(185, w * 0.15);
        const dg = ctx.createRadialGradient(dx, dy, 2, dx, dy, dr);
        dg.addColorStop(0, "rgba(2, 6, 18, 0.34)");
        dg.addColorStop(0.55, "rgba(2, 6, 18, 0.16)");
        dg.addColorStop(1, "rgba(2, 6, 18, 0)");
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.ellipse(dx, dy, dr * 1.65, dr * 0.34, 0.04 * (d % 2 === 0 ? 1 : -1), 0, Math.PI * 2);
        ctx.fill();
      }

      // Deterministic galactic micro-star dense cloud sprinkled along Milky Way core
      let seed = 1337;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 190; i++) {
        const sx = (nextRand() - 0.5) * bandSpan * 0.92;
        const gaussian = (nextRand() + nextRand() + nextRand() - 1.5) / 1.5;
        const sy = gaussian * 62;
        const sr = 0.35 + Math.pow(nextRand(), 2.2) * 0.95;
        const sa = 0.22 + nextRand() * 0.56;
        const tint = i % 5 === 0 ? "186, 230, 253" : (i % 7 === 0 ? "254, 240, 199" : "241, 245, 249");
        ctx.fillStyle = `rgba(${tint}, ${sa.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Delicate upper-atmosphere cyan-emerald airglow strip above sea horizon
      const ag = ctx.createLinearGradient(0, L.horizonY - 24, 0, L.horizonY + 2);
      ag.addColorStop(0, "rgba(34, 211, 238, 0)");
      ag.addColorStop(0.7, "rgba(45, 212, 191, 0.09)");
      ag.addColorStop(1, "rgba(56, 189, 248, 0.14)");
      ctx.fillStyle = ag;
      ctx.fillRect(0, L.horizonY - 24, w, 26);
      ctx.restore();
    }

    // Crisp Solar Disk following East -> Center -> West diurnal solar arc
    if (cel.sun.visible && mode !== "dark") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, L.horizonY + 2);
      ctx.clip();
      const sunR = mode === "light" ? 9.5 : 12.5;
      const diskCore = ctx.createRadialGradient(cel.sun.x, cel.sun.y, 1, cel.sun.x, cel.sun.y, sunR * 2.2);
      diskCore.addColorStop(0, "rgba(255, 255, 250, 0.98)");
      diskCore.addColorStop(0.45, pal.sunCore);
      diskCore.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
      ctx.globalAlpha = cel.sun.alpha;
      ctx.fillStyle = diskCore;
      ctx.beginPath();
      ctx.arc(cel.sun.x, cel.sun.y, sunR * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.sunCore;
      ctx.beginPath();
      ctx.arc(cel.sun.x, cel.sun.y, sunR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Luminous Crescent Moon rising in East as Dusk falls and crossing to West by Dawn
    if (cel.moon.visible) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, L.horizonY + 2);
      ctx.clip();
      const moonX = cel.moon.x;
      const moonY = cel.moon.y;
      const moonR = L.isNarrow ? 10 : 14;
      const mAlpha = cel.moon.alpha;

      const mHalo = ctx.createRadialGradient(moonX, moonY, moonR * 0.7, moonX, moonY, moonR * 5.2);
      mHalo.addColorStop(0, `rgba(224, 242, 254, ${(0.34 * mAlpha).toFixed(3)})`);
      mHalo.addColorStop(0.35, `rgba(125, 211, 252, ${(0.12 * mAlpha).toFixed(3)})`);
      mHalo.addColorStop(1, "rgba(125, 211, 252, 0)");
      ctx.fillStyle = mHalo;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR * 5.2, 0, Math.PI * 2);
      ctx.fill();

      // Subtle earthshine disk in night mode
      if (mode === "dark") {
        ctx.fillStyle = `rgba(12, 24, 52, ${(0.24 * mAlpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Clean isolated crescent cutout stamped without disturbing background sky/stars
      const mc = document.createElement("canvas");
      const mSize = Math.ceil(moonR * 3);
      mc.width = mSize;
      mc.height = mSize;
      const mctx = mc.getContext("2d");
      const mHalf = mSize * 0.5;
      const mg = mctx.createRadialGradient(mHalf + moonR * 0.2, mHalf - moonR * 0.2, 1, mHalf, mHalf, moonR);
      mg.addColorStop(0, "#FFFFFF");
      mg.addColorStop(0.72, "#E0F2FE");
      mg.addColorStop(1, "#BAE6FD");
      mctx.fillStyle = mg;
      mctx.beginPath();
      mctx.arc(mHalf, mHalf, moonR, 0, Math.PI * 2);
      mctx.fill();
      mctx.globalCompositeOperation = "destination-out";
      mctx.beginPath();
      mctx.arc(mHalf - moonR * 0.44, mHalf - moonR * 0.14, moonR * 0.88, 0, Math.PI * 2);
      mctx.fill();
      ctx.globalAlpha = Math.min(1, mAlpha * (mode === "dark" ? 1.0 : 0.72));
      ctx.drawImage(mc, moonX - mHalf, moonY - mHalf);
      ctx.restore();
    }

    // Distant horizon cloud bank silhouettes
    ctx.save();
    ctx.fillStyle = mode === "dark" ? "rgba(16, 28, 54, 0.36)" : "rgba(255, 234, 218, 0.26)";
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
    const sheenX = cel.primary.x;
    const sheenAlpha = (mode === "dark" ? 0.24 : (mode === "light" ? 0.34 : 0.50)) * Math.max(0.35, cel.primary.alpha);
    const sheenRgb = cel.primary.kind === "moon" ? "186, 230, 253" : pal.sunGlow;
    const refG = ctx.createLinearGradient(sheenX, L.horizonY, sheenX, L.islandTopY + 30);
    refG.addColorStop(0, `rgba(${sheenRgb}, ${sheenAlpha.toFixed(3)})`);
    refG.addColorStop(1, `rgba(${sheenRgb}, 0)`);
    ctx.fillStyle = refG;
    ctx.beginPath();
    ctx.moveTo(sheenX - 18, L.horizonY);
    ctx.lineTo(sheenX + 18, L.horizonY);
    ctx.lineTo(sheenX + 78, L.islandTopY + 30);
    ctx.lineTo(sheenX - 78, L.islandTopY + 30);
    ctx.closePath();
    ctx.fill();

    // Secondary twilight lunar bay shimmer when Moon rises opposite the setting Sun
    if (cel.primary.kind === "sun" && cel.moon.visible && Math.abs(cel.moon.x - sheenX) > 60) {
      const mSheenA = 0.16 * cel.moon.alpha;
      const mRefG = ctx.createLinearGradient(cel.moon.x, L.horizonY, cel.moon.x, L.islandTopY + 18);
      mRefG.addColorStop(0, `rgba(186, 230, 253, ${mSheenA.toFixed(3)})`);
      mRefG.addColorStop(1, "rgba(186, 230, 253, 0)");
      ctx.fillStyle = mRefG;
      ctx.beginPath();
      ctx.moveTo(cel.moon.x - 10, L.horizonY);
      ctx.lineTo(cel.moon.x + 10, L.horizonY);
      ctx.lineTo(cel.moon.x + 42, L.islandTopY + 18);
      ctx.lineTo(cel.moon.x - 42, L.islandTopY + 18);
      ctx.closePath();
      ctx.fill();
    }
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

    // 4. Compact Sleeker Spaceport Peninsula Headland + Clean Continuous Coastal Seawall (Generous Water Left & South!)
    ctx.save();
    ctx.beginPath();
    if (L.isNarrow) {
      ctx.moveTo(-12, L.islandTopY + 18);
      ctx.lineTo(w * 0.35, L.islandTopY + 4);
      ctx.lineTo(w + 16, L.islandTopY + 22);
    } else {
      ctx.moveTo(w * 0.072, L.islandTopY + 44);
      ctx.lineTo(w * 0.16, L.islandTopY + 4);
      ctx.lineTo(w * 0.72, L.islandTopY + 5);
      ctx.lineTo(w + 20, L.islandTopY + 36);
    }
    for (let si = L.shorePts.length - 1; si >= 0; si--) {
      ctx.lineTo(L.shorePts[si].x, L.shorePts[si].y);
    }
    ctx.closePath();
    const landG = ctx.createLinearGradient(0, L.islandTopY, 0, L.islandBotY + 54);
    landG.addColorStop(0, pal.landBase);
    landG.addColorStop(1, pal.landShade);
    ctx.fillStyle = landG;
    ctx.fill();

    // Subtle paved tarmac apron zones covering terminal, satellites & hangar stands (trimmed cleanly to compact peninsula)
    ctx.beginPath();
    if (L.isNarrow) {
      ctx.moveTo(w * 0.10, L.islandTopY + 18);
      ctx.lineTo(w * 0.96, L.islandTopY + 18);
      ctx.lineTo(w * 0.96, L.rwYAtX(w * 0.90) - L.rwHalfAtX(w * 0.90) - 6);
      ctx.lineTo(w * 0.10, L.rwYAtX(w * 0.12) - L.rwHalfAtX(w * 0.12) - 6);
    } else {
      ctx.moveTo(w * 0.24, L.islandTopY + 14);
      ctx.lineTo(w * 0.89, L.islandTopY + 16);
      ctx.lineTo(w * 0.92, L.termY + 68 * L.termScale);
      ctx.lineTo(w * 0.21, L.termY + 56 * L.termScale);
    }
    ctx.closePath();
    ctx.fillStyle = pal.apronFill;
    ctx.globalAlpha = 0.56;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Continuous stepped concrete harbor seawall bulkhead & subtle waterline foam around headland & coast
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    L.shorePts.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    for (let si = L.shorePts.length - 1; si >= 0; si--) {
      ctx.lineTo(L.shorePts[si].x - (si <= 1 && !L.isNarrow ? 4 : 0), L.shorePts[si].y + 5);
    }
    ctx.closePath();
    ctx.fill();

    // Subtle waterline foam shimmer along seawall foot & western port headland
    ctx.strokeStyle = pal.isNightLights ? "rgba(186, 230, 253, 0.24)" : "rgba(255, 255, 255, 0.52)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    L.shorePts.forEach((p, idx) => {
      const fx = p.x - (idx <= 1 && !L.isNarrow ? 1 : 0);
      const fy = p.y + 6;
      if (idx === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    });
    ctx.stroke();

    // Organic coastal foliage & embankment treeline tufts tucked neatly along sea quay (south of boulevard)
    const bushStops = L.isNarrow ? [0.24, 0.74] : [0.32, 0.44, 0.54, 0.76, 0.90];
    bushStops.forEach((f, idx) => {
      const bx = w * f;
      const by = L.shoreYAtX(bx) - 4;
      ctx.fillStyle = pal.foliage;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(bx + k * 7.5, by + (idx % 2), 5.2 - Math.abs(k) * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    if (!L.isNarrow) {
      // 5. Adjacent Maritime Seaport (Finger Piers, Gantry Cranes, Stacked Containers & Berthed Vessels!)
      this._drawAdjacentSeaport(ctx, w, h, L, pal);

      // 6. Unified Bridge Viaduct -> Seawall Abutment -> Purposeful Island Highway Network!
      this._drawIslandHighwayNetwork(ctx, w, h, L, pal);
    }

    // Rich multi-layered concrete/asphalt tarmac aprons, expansion seams & markings
    this._drawTarmacDetails(ctx, w, h, L, pal);

    // 7. Runway, Strict Non-Overlapping South Apron Taxiway, Gate Stands & Helipads
    this._drawRunwayNetwork(ctx, w, L, pal);

    // Horizon-to-Pad North Crawlerway (desktop only for clean mobile framing)
    if (!L.isNarrow) {
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
    }

    // 9. Perspective-Aligned North Campus Buildings, VAB & HIF (Desktop)
    const campusSlope = 0.02;
    const coastSlope = Math.min(0.14, (L.rwRightY - L.rwLeftY) / Math.max(1, L.rwRightX - L.rwLeftX) * 0.72);

    this._drawCryoTankFarm(ctx, L.padX + (L.isNarrow ? 30 : 54), L.padY + 2, pal);

    // 10. Main Pad Concrete Launch Mount, Deluge Water Manifolds & Twin Catch Towers
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

    // Physical water deluge perimeter manifolds & angled spray nozzles
    [-1, 1].forEach(side => {
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(L.padX + side * 27 - 3, L.padY - 9, 6, 8);
      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(L.padX + side * 27 - 3.5, L.padY - 10, 7, 2.2);
    });

    this._drawLatticeTower(ctx, L.towerLeftX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);
    this._drawLatticeTower(ctx, L.towerRightX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);

    if (!L.isNarrow) {
      // Horizontal Integration Facility Rear Wall / Open Bay on background canvas
      this._drawHIFBase(ctx, L, pal);

      // === FOREGROUND OCCLUSION ARCHITECTURE LAYER (rendered onto fgCtx over passing horizontal crawlerway traffic!) ===
      this._drawVAB(fgCtx, L, pal);
      this._draw25DBuilding(fgCtx, w * 0.362, L.islandTopY + L.spanY * 0.148, 50, 20, pal, { style: "ops", floors: 3, perspSlope: campusSlope });
      this._draw25DBuilding(fgCtx, w * 0.435, L.islandTopY + L.spanY * 0.138, 42, 14, pal, { style: "warehouse", floors: 2, perspSlope: campusSlope });
      this._draw25DBuilding(fgCtx, w * 0.504, L.islandTopY + L.spanY * 0.136, 42, 15, pal, { style: "terminal_annex", floors: 2, perspSlope: campusSlope });
      this._draw25DBuilding(fgCtx, w * 0.556, L.islandTopY + L.spanY * 0.128, 38, 16, pal, { style: "hangar_small", floors: 1, perspSlope: campusSlope });
      this._draw25DBuilding(fgCtx, w * 0.692, L.islandTopY + L.spanY * 0.118, 40, 14, pal, { style: "ops", floors: 2, perspSlope: 0.03 });
    }

    // Perspective-aligned south waterfront & airport operations buildings (spaced cleanly East of SW Seaport!)
    const southBuildings = [
      { xFrac: 0.368, w: 50, h: 12, dyBelowRw: 16, style: "ops", floors: 2 },
      { xFrac: 0.432, w: 58, h: 14, dyBelowRw: 17, style: "warehouse", floors: 1 },
      { xFrac: 0.494, w: 60, h: 15, dyBelowRw: 17, style: "terminal_annex", floors: 2 },
      { xFrac: 0.556, w: 50, h: 13, dyBelowRw: 16, style: "ops", floors: 2 },
      { xFrac: 0.675, w: 54, h: 12, dyBelowRw: 13, style: "hangar_small", floors: 1 },
      { xFrac: 0.755, w: 50, h: 12, dyBelowRw: 13, style: "parking_deck", floors: 2 },
      { xFrac: 0.840, w: 46, h: 11, dyBelowRw: 12, style: "ops", floors: 2 }
    ];
    southBuildings.forEach((b, idx) => {
      if (L.isNarrow && idx !== 2) return;
      const bx = w * b.xFrac;
      const bw = L.isNarrow ? b.w * 0.72 : b.w;
      const bh = L.isNarrow ? b.h * 0.82 : b.h;
      const rwBottom = L.rwYAtX(bx) + L.rwHalfAtX(bx);
      const by = rwBottom + b.dyBelowRw + bh;
      const shoreMaxY = L.shoreYAtX(bx) - 18;
      if (by <= shoreMaxY && by - bh > rwBottom + 7) {
        this._draw25DBuilding(fgCtx, bx, by, bw, bh, pal, { style: b.style, floors: b.floors, perspSlope: coastSlope });
      }
    });

    if (!L.isNarrow) {
      // East apron hangar ops, Heliport 1 & Heliport 2 support buildings + Expanded East ATC Tower Precinct Infrastructure!
      this._draw25DBuilding(fgCtx, L.hangarX - L.hangarW * 0.56, L.hangarY + L.hangarH * 0.24, 36, 14, pal, { style: "ops", floors: 2, perspSlope: 0.025 });
      this._draw25DBuilding(fgCtx, L.heliPad1.x + 26, L.heliPad1.y - 6, 36, 13, pal, { style: "hangar_small", floors: 1, perspSlope: 0.02 });
      this._draw25DBuilding(fgCtx, L.heliPad2.x - 48, L.heliPad2.y + 4, 34, 13, pal, { style: "hangar_small", floors: 1, perspSlope: 0.04 });
      this._draw25DBuilding(fgCtx, L.heliPad2.x + 24, L.heliPad2.y + 8, 28, 11, pal, { style: "ops", floors: 2, perspSlope: 0.05 });

      // East Tower ARFF Fire & Rescue Station, Flight Ops Crew Annex, Fuel Depot & Weather Radar Radome!
      this._draw25DBuilding(fgCtx, L.atcX - 58, L.atcY + 4, 42, 13, pal, { style: "fire_station", floors: 1, perspSlope: 0.03 });
      this._draw25DBuilding(fgCtx, L.atcX - 42, L.atcY + 34, 44, 15, pal, { style: "terminal_annex", floors: 2, perspSlope: 0.04 });
      this._draw25DBuilding(fgCtx, L.atcX - 18, L.atcY + 52, 34, 11, pal, { style: "parking_deck", floors: 2, perspSlope: 0.04 });
      this._drawCryoTankFarm(fgCtx, L.atcX + 6, L.atcY + 26, pal, { compact: true });
      this._draw25DBuilding(fgCtx, L.rwRightX - 46, L.rwRightY - 34, 24, 9, pal, { style: "warehouse", floors: 1, perspSlope: 0.04 });

      // Elevated ATC Meteorological Weather Radar Dome pedestal beside ATC Tower
      const wxX = L.atcX + 26;
      const wxY = L.atcY - 12;
      fgCtx.save();
      fgCtx.fillStyle = pal.shadowColor;
      fgCtx.beginPath();
      fgCtx.ellipse(wxX + 4 * pal.sunDir, wxY + 2, 10, 3.2, 0, 0, Math.PI * 2);
      fgCtx.fill();
      fgCtx.fillStyle = pal.archDark;
      fgCtx.fillRect(wxX - 3.5, wxY - 22, 7, 22);
      fgCtx.fillStyle = pal.archLight;
      fgCtx.beginPath();
      fgCtx.arc(wxX, wxY - 28, 7.5, 0, Math.PI * 2);
      fgCtx.fill();
      fgCtx.strokeStyle = pal.archMid;
      fgCtx.lineWidth = 0.8;
      fgCtx.beginPath();
      fgCtx.ellipse(wxX, wxY - 28, 7.5, 2.6, 0, 0, Math.PI * 2);
      fgCtx.stroke();
      fgCtx.restore();
    }

    // 11. Terminal Ground Shadows first, then Satellite Terminals (Desktop only) + Monumental Central Star Terminal!
    this._drawTerminalGroundShadows(fgCtx, L, pal);
    if (!L.isNarrow) {
      this._drawSatelliteTerminalsAndBridges(fgCtx, L, pal);
    }
    this._drawStarTerminal(fgCtx, L, pal);

    // 12 & 13. Desktop full complex vs airy mobile skyline (keep mobile ATC Control Tower only!)
    if (!L.isNarrow) {
      this._drawStaticParkedAircraft(fgCtx, L, pal);
      this._drawArchedHangarBase(fgCtx, L, pal);
      this._drawRadarCentre(fgCtx, L, pal);
    } else {
      this._drawControlTower(fgCtx, L, pal);
    }

    // 14. Foreground Lower-Left Coastal Hillside Silhouette
    this._drawForegroundBridgeAndCoast(fgCtx, w, h, L, pal);
  },

  _drawOffshoreLaunchPlatform(ctx, L, pal) {
    const px = L.offshorePadX;
    const py = L.offshorePadY;
    const sc = L.offshoreScale;

    ctx.save();
    // 1. Elevated Twin-Rail Heavy Causeway Viaduct connecting offshore platform to shore core hangar
    const brX0 = L.offshoreShoreX;
    const brY0 = L.offshoreShoreY;
    const brX1 = px - 18 * sc;
    const brY1 = py + 4 * sc;

    // Viaduct water piers & girder shadow
    for (let i = 1; i <= 5; i++) {
      const f = i / 6;
      const tx = brX0 + (brX1 - brX0) * f;
      const ty = brY0 + (brY1 - brY0) * f;
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(tx - 1.5, ty + 1, 3.0, 9 * sc);
    }
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = Math.max(4.0, 7.0 * sc);
    ctx.beginPath();
    ctx.moveTo(brX0, brY0 + 1);
    ctx.lineTo(brX1, brY1 + 1);
    ctx.stroke();

    // Concrete bridge roadbed + cross-tie rail sleepers
    ctx.strokeStyle = pal.archMid;
    ctx.lineWidth = Math.max(2.6, 4.8 * sc);
    ctx.beginPath();
    ctx.moveTo(brX0, brY0);
    ctx.lineTo(brX1, brY1);
    ctx.stroke();

    const brLen = Math.hypot(brX1 - brX0, brY1 - brY0);
    const brAng = Math.atan2(brY1 - brY0, brX1 - brX0);
    const nx = -Math.sin(brAng) * 1.4 * sc;
    const ny = Math.cos(brAng) * 1.4 * sc;
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = Math.max(0.8, 1.0 * sc);
    const tieCount = Math.max(8, Math.floor(brLen / (5.5 * sc)));
    for (let ti = 1; ti < tieCount; ti++) {
      const f = ti / tieCount;
      const tx = brX0 + (brX1 - brX0) * f;
      const ty = brY0 + (brY1 - brY0) * f;
      ctx.beginPath();
      ctx.moveTo(tx - nx * 1.5, ty - ny * 1.5);
      ctx.lineTo(tx + nx * 1.5, ty + ny * 1.5);
      ctx.stroke();
    }

    // Twin gleaming parallel steel rails along causeway deck
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = Math.max(0.65, 0.9 * sc);
    [-0.95, 0.95].forEach(rs => {
      ctx.beginPath();
      ctx.moveTo(brX0 + nx * rs, brY0 + ny * rs - 0.5);
      ctx.lineTo(brX1 + nx * rs, brY1 + ny * rs - 0.5);
      ctx.stroke();
    });

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
    const pA = L.portWallA || { x: w * 0.075, y: L.islandTopY + 58 };
    const pB = L.portWallB || { x: w * 0.215, y: L.islandBotY - 14 };
    const xA = pA.x, yA = pA.y;
    const xB = pB.x, yB = pB.y;
    const dxW = xB - xA;
    const dyW = yB - yA;
    const wallLen = Math.max(1, Math.hypot(dxW, dyW));
    const tx = dxW / wallLen; // Along quay wall SE
    const ty = dyW / wallLen;
    const inX = ty;           // Inland perpendicular (ENE)
    const inY = -tx;
    const outX = -ty;         // Waterside outboard (WSW)
    const outY = tx;
    const slope = dyW / Math.max(1, dxW);

    const wallPt = (f) => ({ x: xA + dxW * f, y: yA + dyW * f });
    const q0 = wallPt(0.06);
    const qMid = wallPt(0.45);
    const q1 = wallPt(0.96);

    // 1. Expanded Multi-Zone Concrete Deep-Water Container Terminal Wharf Apron (strictly south-west of runway!)
    ctx.fillStyle = pal.quayFill;
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x + tx * 8, q1.y + ty * 8);
    ctx.lineTo(q1.x + tx * 8 + inX * 56, q1.y + ty * 8 + inY * 56);
    ctx.lineTo(qMid.x + inX * 48, qMid.y + inY * 48);
    ctx.lineTo(q0.x + inX * 26, q0.y + inY * 26);
    ctx.closePath();
    ctx.fill();

    // Yard parking grid stripes & intermodal road spine connecting container apron cleanly to Coastal Boulevard!
    const roadExit = { x: xB + 14, y: yB - 10 };
    const roadGate = { x: q1.x + inX * 38, y: q1.y + inY * 38 };
    const roadMid = { x: qMid.x + inX * 32, y: qMid.y + inY * 32 };
    const roadNorth = { x: q0.x + inX * 18, y: q0.y + inY * 18 };

    ctx.lineCap = "round";
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = L.isNarrow ? 5 : 7.5;
    ctx.beginPath();
    ctx.moveTo(roadNorth.x, roadNorth.y);
    ctx.lineTo(roadMid.x, roadMid.y);
    ctx.quadraticCurveTo(roadGate.x, roadGate.y, roadExit.x, roadExit.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 250, 235, 0.34)";
    ctx.lineWidth = 0.85;
    ctx.setLineDash([4.5, 5.5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Wharf seawall concrete coping & dual steel STS crane rails along quay edge
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x + tx * 8, q1.y + ty * 8);
    ctx.stroke();

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 0.95;
    [5.5, 13.5].forEach(rOff => {
      ctx.beginPath();
      ctx.moveTo(q0.x + inX * rOff, q0.y + inY * rOff);
      ctx.lineTo(q1.x + tx * 5 + inX * rOff, q1.y + ty * 5 + inY * rOff);
      ctx.stroke();
    });

    // Twin protruding concrete mooring dolphins / service walkways out into channel water
    [0.28, 0.72].forEach(bf => {
      const bp = wallPt(bf);
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.moveTo(bp.x - tx * 5, bp.y - ty * 5 + 3);
      ctx.lineTo(bp.x + tx * 5, bp.y + ty * 5 + 3);
      ctx.lineTo(bp.x + tx * 4 + outX * 12, bp.y + ty * 4 + outY * 12 + 3);
      ctx.lineTo(bp.x - tx * 4 + outX * 12, bp.y - ty * 4 + outY * 12 + 3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archMid;
      ctx.beginPath();
      ctx.moveTo(bp.x - tx * 5, bp.y - ty * 5);
      ctx.lineTo(bp.x + tx * 5, bp.y + ty * 5);
      ctx.lineTo(bp.x + tx * 4 + outX * 11, bp.y + ty * 4 + outY * 11);
      ctx.lineTo(bp.x - tx * 4 + outX * 11, bp.y - ty * 4 + outY * 11);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0F172A";
      [-20, 0, 20].forEach(fo => {
        const fx = bp.x + tx * fo;
        const fy = bp.y + ty * fo;
        ctx.fillRect(fx - 1.5, fy - 1.5, 3, 3);
      });
    });

    // 2. Port Control Tower, Logistics Warehouses, Customs Gatehouse Canopy & Bunker Storage Tanks (clamped clear of Runway!)
    if (!L.isNarrow) {
      const roadExit = { x: xB + 14, y: yB - 10 };
      const wh1 = wallPt(0.76);
      this._draw25DBuilding(ctx, wh1.x + inX * 36, wh1.y + inY * 36, 32, 10, pal, { style: "warehouse", floors: 1, perspSlope: slope * 0.25 });
      const wh2 = wallPt(0.92);
      this._draw25DBuilding(ctx, wh2.x + inX * 38, wh2.y + inY * 38, 28, 9.5, pal, { style: "ops", floors: 2, perspSlope: slope * 0.22 });

      // Harbor Master / Port Control Watch Tower overlooking crane line
      const ptA = wallPt(0.58);
      const pmX = ptA.x + inX * 35;
      const pmY = ptA.y + inY * 35;
      this._draw25DBuilding(ctx, pmX, pmY, 15, 20, pal, { style: "terminal_annex", floors: 3, perspSlope: 0.04 });

      // Compact Marine Bunker / Fuel Storage Tanks near western port entrance road
      const tkA = wallPt(0.66);
      this._drawCryoTankFarm(ctx, tkA.x + inX * 37, tkA.y + inY * 37, pal, { compact: true });

      // Overhead Customs Inspection Gatehouse Canopy spanning Port Access Road
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(roadGate.x - 10, roadGate.y - 8, 2.2, 8);
      ctx.fillRect(roadGate.x + 8, roadGate.y - 7, 2.2, 8);
      ctx.fillStyle = pal.archLight;
      ctx.beginPath();
      ctx.roundRect(roadGate.x - 12, roadGate.y - 10, 23, 3.6, 1.2);
      ctx.fill();
      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(roadGate.x - 12, roadGate.y - 7.4, 23, 1.1);
      void roadExit;
    }

    // 3. Organized Multi-Tier 2.5D Intermodal Container Storage Yard Stacks + RTG Yard Gantry Crane!
    const containerPalette = [pal.chuteColor, pal.liveryAccent, pal.shipHull, pal.archDark, "#0EA5E9"];
    const stackSites = L.isNarrow
      ? [{ f: 0.34, off: 20, tiers: 2 }, { f: 0.64, off: 22, tiers: 2 }]
      : [
          { f: 0.16, off: 19, tiers: 2 },
          { f: 0.24, off: 21, tiers: 3 },
          { f: 0.36, off: 24, tiers: 2 },
          { f: 0.45, off: 25, tiers: 3 },
          { f: 0.56, off: 26, tiers: 2 },
          { f: 0.66, off: 26, tiers: 3 },
          { f: 0.78, off: 25, tiers: 2 }
        ];
    stackSites.forEach((st, idx) => {
      const bp = wallPt(st.f);
      const cx = bp.x + inX * st.off;
      const cy = bp.y + inY * st.off;
      for (let tier = 0; tier < st.tiers; tier++) {
        const tyPos = cy - tier * 3.8;
        const col = containerPalette[(idx + tier * 2) % containerPalette.length];
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, tyPos);
        ctx.lineTo(cx + 12, tyPos + 12 * slope * 0.42);
        ctx.lineTo(cx + 12, tyPos + 12 * slope * 0.42 - 3.6);
        ctx.lineTo(cx, tyPos - 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.archLight;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(cx + 1, tyPos - 4.0, 10, 0.9);
        ctx.globalAlpha = 1;
      }
    });

    // Inland Rubber-Tyred Gantry (RTG) Yard Crane straddling middle container block + parked chassis trucks!
    if (!L.isNarrow) {
      const rtgP = wallPt(0.51);
      const rx = rtgP.x + inX * 26;
      const ry = rtgP.y + inY * 26;
      ctx.strokeStyle = "#D97706";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(rx - 7, ry); ctx.lineTo(rx - 7, ry - 15);
      ctx.moveTo(rx + 9, ry + 3); ctx.lineTo(rx + 9, ry - 12);
      ctx.moveTo(rx - 8, ry - 15); ctx.lineTo(rx + 10, ry - 12);
      ctx.stroke();
      ctx.fillStyle = pal.chuteColor;
      ctx.fillRect(rx - 1, ry - 13, 5, 3);

      // Parked container drayage chassis trucks queued under STS apron lane
      [0.32, 0.74].forEach(tf => {
        const tp = wallPt(tf);
        const vx = tp.x + inX * 15;
        const vy = tp.y + inY * 15;
        ctx.fillStyle = pal.archLight;
        ctx.fillRect(vx - 3, vy - 2, 5.5, 2.2);
        ctx.fillStyle = pal.liveryAccent;
        ctx.fillRect(vx + 2.5, vy - 2.4, 2.4, 2.6);
      });
    }

    // 4. High-Mast Port Floodlights & Night Illumination Pools (illuminating Wharf Quay, Yard, Warehouses & Customs Canopy)
    [0.16, 0.44, 0.72, 0.90].forEach((pf, idx) => {
      const lp = wallPt(pf);
      const px = lp.x + inX * (idx >= 2 ? 32 : 24);
      const py = lp.y + inY * (idx >= 2 ? 32 : 24);
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 16);
      ctx.stroke();
      ctx.fillStyle = pal.isNightLights ? "rgba(254, 240, 182, 0.96)" : pal.archLight;
      ctx.fillRect(px - 2.4, py - 17, 4.8, 1.8);
      if (pal.isNightLights || pal.lightIntensity > 0.25) {
        const pAlpha = Math.max(0.24, pal.lightIntensity * 0.42);
        const lg = ctx.createRadialGradient(px, py - 2, 1, px, py - 2, 28);
        lg.addColorStop(0, `rgba(254, 234, 175, ${pAlpha.toFixed(3)})`);
        lg.addColorStop(0.55, `rgba(254, 224, 145, ${(pAlpha * 0.42).toFixed(3)})`);
        lg.addColorStop(1, "rgba(254, 224, 145, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(px, py, 28, 11, slope * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (pal.isNightLights || pal.lightIntensity > 0.25) {
      // Glowing Port Gatehouse security canopy bar & quay edge bollard lights at night
      const gateA = Math.min(0.88, 0.35 + pal.lightIntensity * 0.55);
      ctx.fillStyle = `rgba(254, 240, 170, ${gateA.toFixed(3)})`;
      ctx.fillRect(roadGate.x - 10, roadGate.y - 6.2, 19, 1.4);
      [0.10, 0.24, 0.40, 0.56, 0.72, 0.88].forEach(bf => {
        const qp = wallPt(bf);
        const bg = ctx.createRadialGradient(qp.x, qp.y, 0, qp.x, qp.y, 5.5);
        bg.addColorStop(0, `rgba(254, 226, 150, ${(0.72 * pal.lightIntensity).toFixed(3)})`);
        bg.addColorStop(1, "rgba(254, 226, 150, 0)");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(qp.x, qp.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
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
    const { abutX, abutY, bridgeStart, bridgeCp, bridgeEnd, bridgeUx, bridgeUy, interchangeSplit } = L;
    const southLipY = L.underpassY + L.underpassHalf + 18;
    const southMouthY = L.underpassY + L.underpassHalf + 2;
    const northCurbY = L.underpassY - L.underpassHalf - 2;
    const northLipY = L.underpassY - L.underpassHalf - 18;
    const roadW = L.isNarrow ? 7 : 9.5;
    const roadPerpX = -bridgeUy;
    const roadPerpY = bridgeUx;

    // 1. Open-Bay Concrete Bridge Piers, Box Girder Underside & Coastal Seawall Abutment (Single Unified Canvas Pass!)
    const pierStops = [0.16, 0.30, 0.44, 0.58, 0.72, 0.86];
    pierStops.forEach(t => {
      const inv = 1 - t;
      const px = inv * inv * bridgeStart.x + 2 * inv * t * bridgeCp.x + t * t * bridgeEnd.x;
      const py = inv * inv * bridgeStart.y + 2 * inv * t * bridgeCp.y + t * t * bridgeEnd.y;
      const pierH = 22 + (1 - t) * 30;
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(px - 2.6, py + 4, 5.2, pierH);
      ctx.fillStyle = pal.archMid;
      ctx.fillRect(px - 3.6, py + 4 + pierH - 4, 7.2, 4);
      ctx.fillStyle = pal.isNightLights ? "rgba(254, 215, 130, 0.14)" : "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(px - 1.5, py + 4 + pierH, 3, 22);
    });

    // Sculpted Concrete Coastal Seawall Abutment & Wing Walls anchored flush at shoreline
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(abutX - 18, abutY + 6);
    ctx.lineTo(abutX + 18, abutY + 10);
    ctx.lineTo(abutX + 14, abutY - 4);
    ctx.lineTo(abutX - 16, abutY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(abutX - 15, abutY - 5, 29, 4.5);

    // Bridge structural box-girder soffit terminating cleanly into coastal abutment
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = roadW + 4.0;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(bridgeStart.x, bridgeStart.y + 4);
    ctx.quadraticCurveTo(bridgeCp.x, bridgeCp.y + 5, bridgeEnd.x, bridgeEnd.y + 3.5);
    ctx.stroke();

    // 2. One Continuous Uniform-Width Waterfront Coastal Boulevard & Seamless Port Junction
    const pB = L.portWallB || { x: w * 0.215, y: L.islandBotY - 14 };
    const portEndX = pB.x + 14;
    const portEndY = pB.y - 10;
    const coastMidX = abutX;
    const coastMidY = abutY - 11;
    const eastEndX = w * 0.94;
    const eastEndY = L.shoreYAtX(eastEndX) - 10;

    ctx.lineCap = "round";
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(portEndX, portEndY);
    ctx.quadraticCurveTo(w * 0.42, L.shoreYAtX(w * 0.42) - 11, coastMidX, coastMidY);
    ctx.quadraticCurveTo(w * 0.78, L.shoreYAtX(w * 0.78) - 10, eastEndX, eastEndY);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 250, 235, 0.32)";
    ctx.lineWidth = 0.85;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flush paved interchange junction fillets merging bridge smoothly left/right into Coastal Boulevard & North Parkway
    ctx.fillStyle = pal.runwayFill;
    ctx.beginPath();
    ctx.moveTo(abutX - 24, coastMidY - 2);
    ctx.quadraticCurveTo(abutX - 6, abutY - 16, L.underpassX + 10, southLipY + 4);
    ctx.lineTo(L.underpassX - 6, southLipY + 4);
    ctx.quadraticCurveTo(abutX - 18, abutY - 8, abutX - 28, coastMidY + 4);
    ctx.quadraticCurveTo(abutX, abutY + 2, abutX + 26, coastMidY + 5);
    ctx.quadraticCurveTo(abutX + 12, coastMidY - 4, abutX - 4, abutY - 14);
    ctx.closePath();
    ctx.fill();

    // Main Continuous Viaduct Bridge -> Seawall Abutment -> Smooth Diagonal Terminal Parkway
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = roadW;
    ctx.beginPath();
    ctx.moveTo(bridgeStart.x, bridgeStart.y);
    ctx.quadraticCurveTo(bridgeCp.x, bridgeCp.y, bridgeEnd.x, bridgeEnd.y);
    ctx.bezierCurveTo(
      abutX - 18, abutY - 15,
      L.underpassX + 12, southLipY + 12,
      L.underpassX, southLipY
    );
    ctx.stroke();

    // Matching dashed lane centerline flowing seamlessly across bridge and island parkway
    ctx.strokeStyle = "rgba(255, 250, 235, 0.36)";
    ctx.lineWidth = 0.9;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crisp Painted White Gore Chevrons inside the Y-divergence (flush with pavement)
    ctx.strokeStyle = "rgba(255, 250, 235, 0.32)";
    ctx.lineWidth = 0.8;
    for (let g = 1; g <= 3; g++) {
      const gx = interchangeSplit.x - bridgeUx * 2 + bridgeUx * (g * 4.2);
      const gy = interchangeSplit.y - bridgeUy * 2 + bridgeUy * (g * 4.2);
      ctx.beginPath();
      ctx.moveTo(gx - 2.2 - g * 0.5, gy + 1.6);
      ctx.lineTo(gx - 0.4, gy - 0.7);
      ctx.lineTo(gx + 1.4, gy + 1.9);
      ctx.stroke();
    }

    // Bridge Outer & Inner Parapet Concrete Guardrails stopping flush at coastal abutment
    [-1, 1].forEach(side => {
      const off = side * (roadW * 0.5 + 0.8);
      ctx.strokeStyle = side < 0 ? pal.archLight : pal.archMid;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bridgeStart.x + roadPerpX * off, bridgeStart.y + roadPerpY * off);
      ctx.quadraticCurveTo(bridgeCp.x + roadPerpX * off, bridgeCp.y + roadPerpY * off, bridgeEnd.x + roadPerpX * off, bridgeEnd.y + roadPerpY * off);
      ctx.stroke();
    });

    if (pal.lightIntensity > 0.25) {
      pierStops.forEach(t => {
        const inv = 1 - t;
        const lx = inv * inv * bridgeStart.x + 2 * inv * t * bridgeCp.x + t * t * bridgeEnd.x;
        const ly = inv * inv * bridgeStart.y + 2 * inv * t * bridgeCp.y + t * t * bridgeEnd.y - 3;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 9);
        lg.addColorStop(0, `rgba(254, 224, 150, ${(0.82 * pal.lightIntensity).toFixed(3)})`);
        lg.addColorStop(1, "rgba(254, 224, 150, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // North emergence highway climbing cleanly out of north ramp into Star Terminal Plaza
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = roadW;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 4, northLipY);
    ctx.bezierCurveTo(
      L.underpassX - 16, northLipY - 22,
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

    // 3. Architectural Low-Profile Runway Underpass Ramps & Thin Flush Concrete Coping (Zero Solid Dark Patch!)
    const rwSlope = Math.sin(L.rwAng) / Math.max(0.2, Math.cos(L.rwAng));
    const sDy = rwSlope * 10;

    // South Approach Ramp: vertical gradient seamlessly darkening surface asphalt into low recessed shoulder slot
    const southRampGrad = ctx.createLinearGradient(0, southLipY, 0, southMouthY);
    southRampGrad.addColorStop(0, pal.runwayFill);
    southRampGrad.addColorStop(1, "rgba(18, 28, 42, 0.80)");
    ctx.fillStyle = southRampGrad;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 4.5, southLipY);
    ctx.lineTo(L.underpassX + 5.5, southLipY);
    ctx.lineTo(L.underpassX + 5.0, southMouthY + sDy * 0.35);
    ctx.lineTo(L.underpassX - 5.0, southMouthY - sDy * 0.45);
    ctx.closePath();
    ctx.fill();

    // Slender 2.2px concrete cheek retaining walls along south approach ramp
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 7.0, southLipY);
    ctx.lineTo(L.underpassX - 4.5, southLipY);
    ctx.lineTo(L.underpassX - 5.0, southMouthY - sDy * 0.45);
    ctx.lineTo(L.underpassX - 7.8, southMouthY - 1.5 - sDy * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.underpassX + 5.5, southLipY);
    ctx.lineTo(L.underpassX + 8.0, southLipY);
    ctx.lineTo(L.underpassX + 7.8, southMouthY - 1.0 + sDy * 0.45);
    ctx.lineTo(L.underpassX + 5.0, southMouthY + sDy * 0.35);
    ctx.closePath();
    ctx.fill();

    // Low-profile 3px runway-parallel bridge parapet & 3.5px recessed culvert slot tucked flush beneath shoulder
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 9.5, southMouthY - 3.5 - sDy * 0.8);
    ctx.lineTo(L.underpassX + 9.5, southMouthY - 3.5 + sDy * 0.8);
    ctx.lineTo(L.underpassX + 9.5, southMouthY - 0.5 + sDy * 0.8);
    ctx.lineTo(L.underpassX - 9.5, southMouthY - 0.5 - sDy * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(10, 15, 26, 0.88)";
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 5.0, southMouthY - 0.5 - sDy * 0.4);
    ctx.lineTo(L.underpassX + 5.0, southMouthY - 0.5 + sDy * 0.4);
    ctx.lineTo(L.underpassX + 4.8, southMouthY + 3.0 + sDy * 0.4);
    ctx.lineTo(L.underpassX - 4.8, southMouthY + 3.0 - sDy * 0.4);
    ctx.closePath();
    ctx.fill();

    // North Emergence Ramp: smooth gradient rising out from thin flush runway coping strip into parkway
    const northRampGrad = ctx.createLinearGradient(0, northCurbY, 0, northLipY);
    northRampGrad.addColorStop(0, "rgba(22, 34, 50, 0.72)");
    northRampGrad.addColorStop(1, pal.runwayFill);
    ctx.fillStyle = northRampGrad;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 8.5, northCurbY - sDy * 0.5);
    ctx.lineTo(L.underpassX + 1.0, northCurbY + sDy * 0.3);
    ctx.lineTo(L.underpassX + 1.0, northLipY);
    ctx.lineTo(L.underpassX - 8.5, northLipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 10.7, northCurbY - sDy * 0.65);
    ctx.lineTo(L.underpassX - 8.5, northCurbY - sDy * 0.5);
    ctx.lineTo(L.underpassX - 8.5, northLipY);
    ctx.lineTo(L.underpassX - 10.7, northLipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.underpassX + 1.0, northCurbY + sDy * 0.3);
    ctx.lineTo(L.underpassX + 3.2, northCurbY + sDy * 0.45);
    ctx.lineTo(L.underpassX + 3.2, northLipY);
    ctx.lineTo(L.underpassX + 1.0, northLipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(L.underpassX - 11.5, northCurbY - 2.2 - sDy * 0.8);
    ctx.lineTo(L.underpassX + 4.0, northCurbY - 2.2 + sDy * 0.6);
    ctx.lineTo(L.underpassX + 4.0, northCurbY + sDy * 0.6);
    ctx.lineTo(L.underpassX - 11.5, northCurbY - sDy * 0.8);
    ctx.closePath();
    ctx.fill();
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
    // Rear Low-Bay Integration Annex placed cleanly NORTH of VAB shoulder so its base is strictly HIGHER than VAB!
    this._draw25DBuilding(ctx, x + bw * 0.56, y - 10, bw * 0.58, bh * 0.34, pal, { style: "ops", floors: 2, perspSlope: 0.02 });

    // Unified heavy concrete foundation plinth & grounded contact shadow directly under VAB footprint
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 1);
    ctx.lineTo(x + frontW, y + 2);
    ctx.lineTo(x + bw + 3, y - 1);
    ctx.lineTo(x + bw + 3, y + 4);
    ctx.lineTo(x + frontW, y + 6);
    ctx.lineTo(x - 3, y + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    if (sd >= 0) {
      ctx.moveTo(x + frontW, y + 2);
      ctx.lineTo(x + frontW + Math.max(3, bh * 0.40 * sd) + depthX * 0.65, y + 6);
      ctx.lineTo(x + bw + Math.max(3, bh * 0.40 * sd), y + 3);
      ctx.lineTo(x - 2, y + 4);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + frontW, y + 2);
      ctx.lineTo(x + frontW, y + 6);
      ctx.lineTo(x + bh * 0.40 * sd - 2, y + 5);
      ctx.lineTo(x + depthX * 0.45 + bh * 0.40 * sd, y + 1);
    }
    ctx.closePath();
    ctx.fill();

    // Primary High-Bay Core Front Wall
    const eastLit = sd < -0.25;
    const fg = eastLit
      ? ctx.createLinearGradient(x + frontW, y - bh, x, y)
      : ctx.createLinearGradient(x, y - bh, x + frontW, y);
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

    // Side Cladding Flank (illuminated by eastern dawn light when sd < -0.25, else shaded)
    ctx.fillStyle = eastLit ? pal.archMid : pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y + 2 - bh);
    ctx.lineTo(x + bw, y - 1 - bh);
    ctx.lineTo(x + bw, y - 1);
    ctx.lineTo(x + frontW, y + 2);
    ctx.closePath();
    ctx.fill();

    // Rooftop Crane Penthouse & Sunlit Crown Trim
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + depthX * 0.85, y - bh - 4);
    ctx.lineTo(x + bw, y - 1 - bh);
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

    // 2. Lighter Concrete Gate Hardstands around Star Terminal, SatWest, SatEast & Hangar Ramp (Spacious Low-Congestion Apron!)
    ctx.globalAlpha = pal.isNightLights ? 0.24 : 0.34;
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(L.termX, L.termY + 34 * L.termScale, 208 * L.termScale, 44 * L.termScale, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!L.isNarrow) {
      ctx.beginPath();
      ctx.ellipse(L.satWest.x, L.satWest.y + 20 * L.termScale, 62 * L.termScale, 21 * L.termScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(L.satEast.x, L.satEast.y + 20 * L.termScale, 60 * L.termScale, 20 * L.termScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(L.hangarX - L.hangarW * 0.08, L.hangarY + L.hangarH * 0.85, L.hangarW * 0.72, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Centered assembly concrete hardstands beneath VAB & HIF (aligned squarely under VAB width!)
    ctx.beginPath();
    ctx.ellipse(L.vabX + L.vabW * 0.52, L.vabY + 2, L.vabW * 0.92, 13, 0, 0, Math.PI * 2);
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

    // 4. White Dashed Apron Service Roadway -> Hangar -> Heliport 1 -> ATC Control Tower + Ground Station Spur + Heliport 2 Connector!
    if (!L.isNarrow) {
      ctx.globalAlpha = 0.56;
      ctx.strokeStyle = pal.runwayFill;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(L.vabX + 18, L.vabY + 12);
      ctx.lineTo(w * 0.44, L.vabY + 8);
      ctx.lineTo(L.hifX + 20, L.hifY + 12);
      ctx.lineTo(L.hangarX - 24, L.hangarY + L.hangarH * 0.78);
      ctx.lineTo(L.heliPad1.x - 14, L.heliPad1.y + 8);
      ctx.lineTo(L.atcX - 10, L.atcY + 12);
      // Branch access roads connecting East ATC Precinct (Fire Station, Radar Radome, Flight Ops, Crew Lot & Heliports)!
      ctx.moveTo(L.atcX - 10, L.atcY + 12);
      ctx.lineTo(L.atcX - 58, L.atcY + 8);
      ctx.lineTo(L.atcX - 42, L.atcY + 34);
      ctx.lineTo(L.atcX - 18, L.atcY + 52);
      ctx.moveTo(L.atcX - 10, L.atcY + 12);
      ctx.lineTo(L.atcX + 26, L.atcY - 12);
      // Branch spur connecting East Hangar corridor cleanly into the relocated Ground Station Compound!
      ctx.moveTo(L.hangarX - 18, L.hangarY + L.hangarH * 0.76);
      ctx.lineTo(L.radarX - 42, L.radarY + 28);
      // Branch access road connecting South-West Heliport 2 to the Waterfront Port Boulevard & South Ops corridor!
      ctx.moveTo(L.heliPad2.x + 12, L.heliPad2.y + 4);
      ctx.quadraticCurveTo(w * 0.39, L.islandBotY - 10, w * 0.45, L.islandBotY + 2);
      ctx.moveTo(L.heliPad2.x, L.heliPad2.y + 4);
      ctx.lineTo(w * 0.30, L.islandBotY + 4);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // ATC Control Tower Paved Arrival Turnaround Pad + Heliport 1 & Heliport 2 Paved Ramp Pads
      ctx.fillStyle = pal.runwayFill;
      ctx.globalAlpha = 0.62;
      ctx.beginPath();
      ctx.ellipse(L.atcX - 6, L.atcY + 12, 16, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(L.heliPad1.x + 10, L.heliPad1.y + 2, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(L.heliPad2.x - 10, L.heliPad2.y + 4, 42, 15, 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dedicated Super-Heavy Mega-Liner Gate Stand (connected cohesively to West Apron & Launch Pad!)
    if (L.megaGate) {
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = pal.apronFill;
      ctx.beginPath();
      ctx.ellipse(L.megaGate.x, L.megaGate.y + 3, 44 * L.termScale, 15 * L.termScale, 0, 0, Math.PI * 2);
      ctx.fill();
      this._drawPerspectiveGateBay(ctx, L.megaGate.x, L.megaGate.y + 2, L.megaGate.heading, 24 * L.termScale, 15 * L.termScale, pal, true);

      // Cohesive Heavy-Haul Taxi Roadway flowing seamlessly from Mega-Liner Gate -> Western Apron -> Launch Pad!
      ctx.globalAlpha = 0.62;
      ctx.lineCap = "round";
      ctx.strokeStyle = pal.runwayFill;
      ctx.lineWidth = L.isNarrow ? 6.5 : 9.5;
      ctx.beginPath();
      ctx.moveTo(L.megaGate.x, L.megaGate.y);
      ctx.bezierCurveTo(
        L.megaGate.x - 42 * L.termScale, L.megaGate.y - 12 * L.termScale,
        L.padX - 16, L.padY + 30,
        L.padX, L.padY + 4
      );
      ctx.stroke();
      ctx.strokeStyle = "rgba(250, 204, 21, 0.56)";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Apron Ground Support Equipment Clusters & Foreshortened 2.5D Perspective Gate Stand Markings!
    ctx.globalAlpha = 0.88;
    L.gates.forEach((g, idx) => {
      if (L.isNarrow && idx >= 2) return;
      const ox = g.x + (idx % 2 === 0 ? -15 : 14);
      const oy = g.y - 5;
      this._drawPerspectiveGateBay(ctx, g.x, g.y + 1, g.heading, 13 * L.termScale, 9 * L.termScale, pal, false);
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
    // 1. Directional cast solar shadow aligned along ground plane (clean East/West branching)
    const eastLit = sd < -0.25;
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    if (sd >= 0) {
      ctx.moveTo(x + frontW, y + sy);
      ctx.lineTo(x + frontW + Math.max(2, bh * 0.44 * sd) + depthX * 0.55, y + sy + 4.0);
      ctx.lineTo(x + bw + Math.max(2, bh * 0.44 * sd), y + sy + depthY * 0.55 + 3.5);
      ctx.lineTo(x + frontW, y + sy + depthY * 0.45);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + depthX * 0.78, y - depthY * 0.45);
      ctx.lineTo(x + depthX * 0.78 + bh * 0.44 * sd, y + 3.5 - depthY * 0.25);
      ctx.lineTo(x + bh * 0.44 * sd, y + 4.0);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Perspective-aligned front facade (keeps vertical lines strictly plumb!)
    const frontG = eastLit
      ? ctx.createLinearGradient(x + frontW, y - bh, x, y + sy)
      : ctx.createLinearGradient(x, y - bh, x, y + sy);
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

    // 3. Isometric right flank wall (catches Eastern Dawn sun when sd < -0.25)
    ctx.fillStyle = eastLit ? pal.archMid : pal.archDark;
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

  // Project gate stand safety boundary, lead-in line & nosewheel stop bar strictly into 2.5D tarmac plane!
  _drawPerspectiveGateBay(ctx, x, y, heading, halfLen, halfW, pal, isMega = false) {
    const ch = Math.cos(heading);
    const sh = Math.sin(heading);
    const perspY = 0.44;
    const pt = (lx, ly) => ({
      x: x + (lx * ch - ly * sh),
      y: y + (lx * sh + ly * ch) * perspY
    });
    const corners = [
      pt(-halfLen, -halfW),
      pt(halfLen, -halfW),
      pt(halfLen, halfW),
      pt(-halfLen, halfW)
    ];

    ctx.save();
    ctx.strokeStyle = isMega ? "rgba(250, 204, 21, 0.62)" : "rgba(239, 68, 68, 0.44)";
    ctx.lineWidth = isMega ? 1.15 : 0.85;
    ctx.beginPath();
    corners.forEach((c, idx) => (idx === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.closePath();
    ctx.stroke();

    // Foreshortened yellow nosewheel lead-in centerline & perpendicular stop bar
    const cTail = pt(-halfLen * 0.92, 0);
    const cNose = pt(halfLen * 0.65, 0);
    const sL = pt(halfLen * 0.52, -halfW * 0.46);
    const sR = pt(halfLen * 0.52, halfW * 0.46);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.54)";
    ctx.lineWidth = isMega ? 1.2 : 0.95;
    ctx.beginPath();
    ctx.moveTo(cTail.x, cTail.y);
    ctx.lineTo(cNose.x, cNose.y);
    ctx.moveTo(sL.x, sL.y);
    ctx.lineTo(sR.x, sR.y);
    ctx.stroke();
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

    // Illuminated pad windsock mast beside apron boundary
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(18, -8);
    ctx.stroke();
    ctx.fillStyle = "#F97316";
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(24.5, -6.8);
    ctx.lineTo(24.5, -5.2);
    ctx.lineTo(18, -5.8);
    ctx.closePath();
    ctx.fill();
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

    // Open South Apron & Continuous Cohesive Gate Lead-In Taxiway Network (zero disconnected stubs!)
    const exitPt = L.rwPt(L.rwExitT);
    const entryPt = L.rwPt(L.rwEntryT);
    const megaApp = (L.megaGate && L.megaGate.approachPt) ? L.megaGate.approachPt : L.apronSW;
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 9.5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    // Arrival exit taxiway -> East apron -> Hangar
    ctx.moveTo(exitPt.x, exitPt.y - 12);
    ctx.bezierCurveTo(exitPt.x + 36, exitPt.y - 26, L.apronEast.x + 28, L.apronEast.y + 18, L.apronEast.x, L.apronEast.y);
    ctx.quadraticCurveTo(L.hangarDoorX + 12, L.hangarDoorY + 18, L.hangarDoorX, L.hangarDoorY);
    // Main South Apron taxiway -> West Satellite Approach -> Runway Entry
    ctx.moveTo(L.apronEast.x, L.apronEast.y);
    ctx.bezierCurveTo(L.apronSE.x, L.apronSE.y, L.apronSouth.x, L.apronSouth.y, L.apronSW.x, L.apronSW.y);
    ctx.quadraticCurveTo((L.apronSW.x + megaApp.x) * 0.5, L.apronSW.y - 4, megaApp.x, megaApp.y);
    ctx.quadraticCurveTo(entryPt.x + 22, entryPt.y - 12, entryPt.x, entryPt.y - 6);
    // Smooth Continuous Mega-Liner Gate Lead-In Connector joining the apron taxiway directly into megaGate!
    if (L.megaGate) {
      ctx.moveTo(megaApp.x, megaApp.y);
      ctx.quadraticCurveTo(L.megaGate.x + 18 * L.termScale, L.megaGate.y + 10 * L.termScale, L.megaGate.x, L.megaGate.y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.44)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Foreshortened gate lead-in markings rendered cleanly via _drawPerspectiveGateBay in _drawTarmacDetails!
    ctx.restore();

    if (!L.isNarrow) {
      this._drawHelipad(ctx, L.heliPad1, pal);
      this._drawHelipad(ctx, L.heliPad2, pal);
    }
  },

  // Connected West & East Satellite Terminals + Elevated Glazed APM Skybridges
  _drawSatelliteTerminalsAndBridges(ctx, L, pal) {
    const sc = L.termScale;
    const bridges = [
      {
        x0: L.termX - 152 * sc, y0: L.termY - 8 * sc,
        x1: L.satWest.x + 36 * sc, y1: L.satWest.y - 2 * sc,
        sat: L.satWest, kind: "west", sScale: sc * 1.05
      }
    ];
    if (!L.isNarrow) {
      bridges.push(
        {
          x0: L.termX - 44 * sc, y0: L.termY - 12 * sc,
          x1: L.satNorth.x + 12 * sc, y1: L.satNorth.y + 4 * sc,
          sat: L.satNorth, kind: "north", sScale: sc * 0.72
        },
        {
          x0: L.termX + 154 * sc, y0: L.termY - 6 * sc,
          x1: L.satEast.x - 36 * sc, y1: L.satEast.y - 2 * sc,
          sat: L.satEast, kind: "east", sScale: sc * 1.05
        }
      );
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

    // Dedicated elevated glazed jetway finger linking West Satellite directly onto the Mega-Liner stand
    if (L.megaGate && L.satWest) {
      ctx.save();
      const jx0 = L.satWest.x - 42 * sc;
      const jy0 = L.satWest.y + 3 * sc;
      const jx1 = L.megaGate.x + 6 * sc;
      const jy1 = L.megaGate.y - 4 * sc;
      const jAng = Math.atan2(jy1 - jy0, jx1 - jx0);
      const jLen = Math.hypot(jx1 - jx0, jy1 - jy0);
      ctx.translate(jx0, jy0);
      ctx.rotate(jAng);
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(0, -2.0 * sc, jLen, 4.0 * sc);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(2 * sc, -0.9 * sc, Math.max(2, jLen - 4 * sc), 1.8 * sc);
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(0, -2.6 * sc, jLen, 1.4 * sc);
      ctx.restore();
    }
  },

  _drawSatelliteTerminal(ctx, cx, cy, sc, pal) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);

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

  // Render ALL terminal ground shadows together BEFORE drawing Satellite Terminals & Star Terminal (zero roof overlap!)
  _drawTerminalGroundShadows(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.fillStyle = pal.shadowColor;
    // Satellite Terminal footprint shadows (Desktop only)
    if (!L.isNarrow) {
      [
        { pt: L.satWest, scale: 1.05 * s },
        { pt: L.satNorth, scale: 0.72 * s },
        { pt: L.satEast, scale: 1.05 * s }
      ].forEach(item => {
        ctx.beginPath();
        ctx.ellipse(item.pt.x + 8 * item.scale * pal.sunDir, item.pt.y + 8 * item.scale, 54 * item.scale, 12.5 * item.scale, 0.04, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Tight central Star Terminal hub & star-arm ground shadow (Desktop + Mobile, strictly zero roof overlap!)
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.ellipse(9 * pal.sunDir, 12, 92, 23, 0.03, 0, Math.PI * 2);
    ctx.fill();
    [
      { ax: -196, ay: 11, w: 12 },
      { ax: -124, ay: -15, w: 9 },
      { ax: 142, ay: -12, w: 9 },
      { ax: 196, ay: 19, w: 12 },
      { ax: 44, ay: 32, w: 10 }
    ].forEach(a => {
      ctx.beginPath();
      ctx.moveTo(6 * pal.sunDir, 10);
      ctx.lineTo(a.ax + 7 * pal.sunDir, a.ay + 8);
      ctx.lineTo(a.ax + 7 * pal.sunDir, a.ay + 15);
      ctx.lineTo(6 * pal.sunDir, 20);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
    ctx.restore();
  },

  _drawStarTerminal(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);

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
      const depth = this._depthScale(L, pk.y);
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(0.62 * sc * depth, 0.62 * sc * depth);
      this._drawSpaceplaneModel(ctx, pk.v, pal, 0, 0, 0, pk.ang);
      ctx.restore();
    });
  },

  // Horizontal Integration Facility (HIF Rocket Assembly Hangar) Base + Interior Bay & Gantry (rocket+tug emerge cleanly out of bay!)
  _drawHIFBase(ctx, L, pal) {
    const x = L.hifX - L.hifW * 0.5;
    const y = L.hifY - L.hifH * 0.55;
    const bw = L.hifW;
    const bh = L.hifH;
    ctx.save();
    // Heavy industrial hangar apron foundation & directional cast shadow
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(L.hifDoorX - 6, y + bh + 1, (x + bw) - L.hifDoorX + 10, 5);
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.hifX + 10 * pal.sunDir, L.hifY + 9, bw * 0.58, bh * 0.34, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Steel crawlerway guide rails extending cleanly straight into bay doorway
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 1.1;
    [-3, 3].forEach(ry => {
      ctx.beginPath();
      ctx.moveTo(L.hifDoorX - 18, L.hifDoorY + 4 + ry * 0.5);
      ctx.lineTo(L.hifDoorX + bw * 0.25, L.hifDoorY + 4 + ry * 0.5);
      ctx.stroke();
    });

    // Deep recessed dark interior assembly hangar chamber opening onto crawlerway
    ctx.fillStyle = "#080E1C";
    ctx.fillRect(L.hifDoorX - 2, y + 3, bw * 0.28, bh + 1);
    const bayG = ctx.createRadialGradient(L.hifDoorX + 8, L.hifDoorY, 2, L.hifDoorX + 12, L.hifDoorY, bh * 0.95);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.fillRect(L.hifDoorX - 2, y + 3, bw * 0.28, bh + 1);

    // Overhead bay worklights & yellow crane I-beam inside doorway
    ctx.fillStyle = "#F59E0B";
    ctx.fillRect(L.hifDoorX, y + 4.5, bw * 0.24, 2.2);
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(L.hifDoorX + 3, y + 7.5, bw * 0.18, 1.5);
    ctx.restore();
  },

  _drawHIFOcclusionRoof(ctx, L, pal) {
    if (L.isNarrow) return;
    const x = L.hifX - L.hifW * 0.5;
    const y = L.hifY - L.hifH * 0.55;
    const bw = L.hifW;
    const bh = L.hifH;
    ctx.save();
    // Main HIF metallic corrugated hangar walls right of open west portal
    const shellX = L.hifDoorX + 3;
    const shellW = (x + bw) - shellX;
    const fg = ctx.createLinearGradient(shellX, y, shellX, y + bh);
    fg.addColorStop(0, pal.archLight);
    fg.addColorStop(1, pal.archMid);
    ctx.fillStyle = fg;
    ctx.fillRect(shellX, y, shellW * 0.80, bh + 4);

    // Corrugated steel vertical panel bays + side crew doors & windows
    ctx.strokeStyle = pal.archDark;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 0.85;
    for (let k = 1; k < 6; k++) {
      const rx = shellX + (shellW * 0.80) * (k / 6);
      ctx.beginPath();
      ctx.moveTo(rx, y + 2);
      ctx.lineTo(rx, y + bh + 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(shellX + shellW * 0.14, y + bh * 0.44, shellW * 0.52, 2.4);

    // Shaded eastern 2.5D hangar gable flank
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(shellX + shellW * 0.80, y);
    ctx.lineTo(shellX + shellW, y + 4);
    ctx.lineTo(shellX + shellW, y + bh + 6);
    ctx.lineTo(shellX + shellW * 0.80, y + bh + 4);
    ctx.closePath();
    ctx.fill();

    // Pitched industrial steel roof + clerestory monitor ridge + rooftop vent housings
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(L.hifDoorX - 4, y);
    ctx.lineTo(L.hifDoorX + 8, y - 6.5);
    ctx.lineTo(shellX + shellW, y - 3);
    ctx.lineTo(shellX + shellW * 0.80, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.archLight;
    ctx.fillRect(L.hifDoorX + 14, y - 8, shellW * 0.55, 2.5);

    // Yellow-black hazard safety lintel framing the western rocket blast-door portal
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(L.hifDoorX - 4, y, 16, bh * 0.25);
    ctx.fillStyle = "#F59E0B";
    ctx.fillRect(L.hifDoorX - 4, y + bh * 0.20, 14, 2.0);
    ctx.fillRect(L.hifDoorX - 4, y, 2.2, bh + 4);
    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(L.hifDoorX - 4, y);
    ctx.lineTo(shellX + shellW * 0.80, y);
    ctx.stroke();
    ctx.restore();
  },

  _drawArchedHangarBase(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    // Solid dark tarmac apron foundation apron & crisp footing contact shadows grounding both arch walls
    ctx.fillStyle = pal.apronFill;
    ctx.beginPath();
    ctx.roundRect(x - 8, y + hh * 0.44, hw + 16, hh * 0.20, 5);
    ctx.fill();
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.hangarX + 10 * pal.sunDir, y + hh * 0.56, hw * 0.55, hh * 0.16, 0.03, 0, Math.PI * 2);
    ctx.fill();

    // Heavy concrete arch anchor sill strip directly under arch wall footings
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(x - 2, y + hh * 0.49, hw + 4, 4.2);

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.5);
    ctx.quadraticCurveTo(x + hw * 0.5, y - hh * 0.95, x + hw, y + hh * 0.5);
    ctx.lineTo(x + hw, y + hh * 0.55);
    ctx.lineTo(x, y + hh * 0.55);
    ctx.closePath();
    ctx.fill();

    // Warm interior hangar floor glow clipped strictly inside the archway footprint above ground threshold!
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y - hh * 0.4, hw - 4, hh * 0.92);
    ctx.clip();
    const bayG = ctx.createRadialGradient(L.hangarDoorX, L.hangarDoorY, 4, L.hangarDoorX, L.hangarDoorY, hw * 0.42);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.beginPath();
    ctx.ellipse(L.hangarDoorX, L.hangarDoorY + 2, hw * 0.40, hh * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  },

  _drawArchedHangarOcclusionRoof(ctx, L, pal, doorOpenFrac = 0) {
    if (L.isNarrow) return;
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

    // Automated Bi-Parting Capsule Recovery Roof Hatch Bay on Arched Hangar Crown!
    const hx = L.hangarX + hw * 0.04;
    const hy = y - hh * 0.40;
    const bayW = Math.min(34, hw * 0.22);
    const bayH = 8.5;
    // Fixed armored hatch coaming frame
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.ellipse(hx, hy, bayW * 0.62, bayH * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();

    // Recessed illuminated vertical recovery bay interior visible when sliding leaves part!
    if (doorOpenFrac > 0.02) {
      ctx.fillStyle = "#080D18";
      ctx.beginPath();
      ctx.ellipse(hx, hy, bayW * 0.50 * Math.min(1, doorOpenFrac * 1.15), bayH * 0.50, 0, 0, Math.PI * 2);
      ctx.fill();
      const hg = ctx.createRadialGradient(hx, hy, 1, hx, hy, bayW * 0.52);
      hg.addColorStop(0, `rgba(251, 191, 36, ${(0.56 * doorOpenFrac).toFixed(3)})`);
      hg.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(hx, hy, bayW * 0.55, bayH * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bi-parting motorized titanium sliding doors with hazard stripes
    const slideOff = doorOpenFrac * (bayW * 0.52);
    [-1, 1].forEach(side => {
      const lx = side < 0 ? (hx - bayW * 0.52 - slideOff) : (hx + slideOff);
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(lx, hy - bayH * 0.42, bayW * 0.52, bayH * 0.84);
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(side < 0 ? (lx + bayW * 0.52 - 1.8) : lx, hy - bayH * 0.42, 1.8, bayH * 0.84);
    });
    ctx.restore();
  },

  // Expanded Deep-Space Satellite Ground Station Compound (between Hangar & Runway!) + Dish Plinths + Tall Control Tower
  _drawRadarCentre(ctx, L, pal) {
    ctx.save();
    const rx = L.radarX;
    const ry = L.radarY;
    const cw = L.isNarrow ? 116 : 228;
    const ch = L.isNarrow ? 58 : 96;

    // 1. Foreshortened Trapezoidal Paved Compound & Perimeter Security Curbing (cleanly framed between Hangar & Runway)
    ctx.fillStyle = pal.apronFill;
    ctx.beginPath();
    ctx.moveTo(rx - cw * 0.48, ry - ch * 0.42);
    ctx.lineTo(rx + cw * 0.48, ry - ch * 0.34);
    ctx.lineTo(rx + cw * 0.54, ry + ch * 0.54);
    ctx.lineTo(rx - cw * 0.54, ry + ch * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Inner northern terraced array pad cleanly framing the larger parabolic dishes
    ctx.fillStyle = pal.quayFill;
    ctx.beginPath();
    ctx.ellipse(rx, ry - 15, L.isNarrow ? 48 : 98, L.isNarrow ? 12 : 19, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concrete Pedestal Plinth Foundations for the North Parabolic Dish Array (drawn BEHIND front radomes!)
    (L.radarDishes || []).forEach(d => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.roundRect(d.x - 5.5, d.y - 2, 11, 6, 1.5);
      ctx.fill();
    });

    // 3. Expanded Telemetry Operations Campus: West Multi-Floor Ops Hall, East Server Vault + Chiller Array & Tall Telemetry Mast
    this._draw25DBuilding(ctx, rx - (L.isNarrow ? 42 : 88), ry + (L.isNarrow ? 22 : 34), L.isNarrow ? 34 : 58, L.isNarrow ? 14 : 20, pal, { style: "ops", floors: 3, perspSlope: 0.04 });
    if (!L.isNarrow) {
      this._draw25DBuilding(ctx, rx + 26, ry + 36, 44, 14, pal, { style: "hangar_small", floors: 1, perspSlope: 0.04 });
      // Chiller/backup generator pads & parking stripes in southeast corner of Ground Station compound
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(rx + 74, ry + 26, 12, 6);
      ctx.fillRect(rx + 88, ry + 28, 12, 6);
      // Telemetry Comms Relay Tower beside Ops Hall
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(rx - 98, ry + 24);
      ctx.lineTo(rx - 98, ry - 14);
      ctx.moveTo(rx - 103, ry - 6);
      ctx.lineTo(rx - 93, ry - 6);
      ctx.stroke();
    }

    const domes = L.isNarrow
      ? [{ x: rx - 10, y: ry + 24, r: 8.5 }, { x: rx - 28, y: ry + 28, r: 6.2 }]
      : [
          { x: rx - 26, y: ry + 36, r: 12.6 },
          { x: rx - 50, y: ry + 39, r: 9.0 },
          { x: rx - 2, y: ry + 40, r: 7.4 }
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

    // Long directional solar cast shadow (casts West at Dawn when sunDir < 0, East at Dusk when sunDir > 0)
    const ctSd = pal.sunDir || 0;
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    if (ctSd >= 0) {
      ctx.moveTo(ax + 7 * hScale, ay);
      ctx.lineTo(ax + Math.max(8, 44 * ctSd) * hScale, ay + 7);
      ctx.lineTo(ax + Math.max(10, 46 * ctSd) * hScale, ay + 13);
      ctx.lineTo(ax - 5 * hScale, ay + 2);
    } else {
      ctx.moveTo(ax - 8 * hScale, ay);
      ctx.lineTo(ax + 5 * hScale, ay + 2);
      ctx.lineTo(ax + Math.min(-8, 44 * ctSd) * hScale, ay + 13);
      ctx.lineTo(ax + Math.min(-10, 46 * ctSd) * hScale, ay + 7);
    }
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
    if (L.isNarrow) return;
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
    if (L.isNarrow) return;
    ctx.save();
    // Compact sculpted coastal rocky headland tucked tightly into extreme bottom-left corner so wide channel water opens up!
    ctx.fillStyle = pal.foliage;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.85);
    ctx.quadraticCurveTo(w * 0.055, h * 0.88, w * 0.105, h * 0.93);
    ctx.quadraticCurveTo(w * 0.15, h * 0.96, w * 0.21, h);
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
      [exitPt, { x: exitPt.x + dirX * 48, y: exitPt.y + dirY * 48 }, { x: pEast.x + 42, y: pEast.y + 26 }, pEast]
    ];
    if (gate && gate.id === "G_MEGA") {
      segs.push([pEast, L.apronSE, L.apronSouth, L.apronSW]);
      segs.push([L.apronSW, { x: (L.apronSW.x + gate.approachPt.x) * 0.5, y: L.apronSW.y - 4 }, gate.approachPt, gate.approachPt]);
      segs.push([gate.approachPt, { x: gate.x + 18 * L.termScale, y: gate.y + 10 * L.termScale }, gate, gate]);
    } else {
      segs.push([pEast, L.apronSE, gate.approachPt, gate]);
    }
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
      const count = isNarrow ? 74 : 155;
      const tints = ["226, 232, 240", "186, 230, 253", "254, 243, 199", "221, 214, 254"];
      for (let i = 0; i < count; i++) {
        const bright = i < (isNarrow ? 6 : 14);
        this.stars.push({
          x: Math.random() * w,
          y: Math.random() * (L.horizonY * 0.94),
          r: bright ? (1.45 + Math.random() * 0.85) : (0.55 + Math.random() * 1.15),
          phase: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.035,
          tint: tints[i % tints.length],
          bright
        });
      }
    }

    if (this.satellites.length === 0) {
      for (let i = 0; i < (isNarrow ? 1 : 2); i++) {
        const goRight = i === 0;
        this.satellites.push({
          x: goRight ? w * (0.20 + i * 0.3) : w * 0.78,
          y: L.horizonY * (0.22 + i * 0.24),
          vx: (goRight ? 1 : -1) * (10 + i * 3.5),
          vy: (i === 0 ? -1.4 : 1.8),
          phase: i * 1.9
        });
      }
    }

    // Built-Out Southwest Seaport Live 5-Angle Container Ship & STS Gantry Crane Operations
    if (!this.portOps && !isNarrow) {
      const makeCargoSlots = (filledCount) => {
        const palette = [
          "#DC4A4A", "#2A7EB0", "#D97706", "#0D9488",
          "#64748B", "#C9755A", "#0284C7", "#475569"
        ];
        const slots = [];
        for (let bi = 0; bi < 8; bi++) {
          slots.push({
            active: bi < filledCount,
            color: palette[(bi * 3 + Math.floor(Math.random() * 5)) % palette.length]
          });
        }
        return slots;
      };
      this.portOps = {
        berths: [
          {
            idx: 0,
            wallFrac: 0.38,
            phase: "servicing",
            t: 2.0,
            phaseDuration: 28.0,
            opMode: "unload",
            cranePhase: 0.18,
            craneCyclesDone: 0,
            craneCyclesTarget: 4,
            craneActiveIdx: 7,
            carriedColor: "#DC4A4A",
            ship: {
              heading: 0.90,
              speed: 0,
              x: 0,
              y: 0,
              scale: 0.92,
              hullVariant: 0,
              cargoSlots: makeCargoSlots(8),
              fromWest: true
            }
          },
          {
            idx: 1,
            wallFrac: 0.80,
            phase: "approaching",
            t: 32.0,
            phaseDuration: 64.0,
            opMode: "load",
            cranePhase: 0.05,
            craneCyclesDone: 0,
            craneCyclesTarget: 4,
            craneActiveIdx: 4,
            carriedColor: "#2A7EB0",
            ship: {
              heading: -2.05,
              speed: 2.8,
              x: w * 0.34,
              y: h + 125,
              scale: 0.96,
              hullVariant: 1,
              cargoSlots: makeCargoSlots(4),
              fromWest: false
            }
          }
        ]
      };
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

    // Populated Maritime Fleet in Upper Archipelago Bay & Lower Channel (Off-screen wrap & calm sea speeds)
    if (this.ships.length === 0) {
      const upperSpan = Math.max(18, L.islandTopY - L.horizonY);
      const lowerClearY1 = Math.max(L.islandBotY + 56, h * 0.82);
      const lowerClearY2 = Math.max(L.islandBotY + 74, h * 0.89);
      const lowerClearY3 = Math.max(L.islandBotY + 90, h * 0.93);
      if (isNarrow) {
        this.ships = [
          { kind: "recovery_ship", zone: "lower", x: w * 0.34, y: lowerClearY2, vx: 1.5, vy: 0.35, minX: -95, maxX: w * 0.54, minY: h * 0.72, maxY: h + 95, channelLoop: true, scale: 0.88 },
          { kind: "container_ship", zone: "upper", x: w * 0.42, y: L.horizonY + upperSpan * 0.34, vx: 1.1, minX: -95, maxX: w + 95, scale: 0.38 }
        ];
      } else {
        this.ships = [
          { kind: "recovery_ship", zone: "lower", x: w * 0.24, y: lowerClearY1, vx: 1.6, vy: 0.45, minX: -105, maxX: w * 0.52, minY: h * 0.68, maxY: h + 95, channelLoop: true, scale: 0.94 },
          { kind: "ferry", zone: "lower", x: w * 0.36, y: lowerClearY2, vx: -1.7, vy: -0.48, minX: -105, maxX: w * 0.54, minY: h * 0.69, maxY: h + 95, channelLoop: true, scale: 0.82 },
          { kind: "container_ship", zone: "lower", x: w * 0.14, y: h * 0.80, vx: 1.25, vy: 0.42, minX: -115, maxX: w * 0.48, minY: h * 0.69, maxY: h + 95, channelLoop: true, scale: 0.80 },
          { kind: "container_ship", zone: "upper", x: w * 0.32, y: L.horizonY + upperSpan * 0.34, vx: 1.15, minX: -95, maxX: w + 95, scale: 0.40 },
          { kind: "container_ship", zone: "upper", x: w * 0.64, y: L.horizonY + upperSpan * 0.22, vx: -1.05, minX: -95, maxX: w + 95, scale: 0.34 },
          { kind: "cargo_far", zone: "upper", x: w * 0.48, y: L.horizonY + upperSpan * 0.44, vx: 1.10, minX: -95, maxX: w + 95, scale: 0.42 },
          { kind: "container_ship", zone: "upper", x: w * 0.84, y: L.horizonY + upperSpan * 0.28, vx: -1.10, minX: -95, maxX: w + 95, scale: 0.38 },
          { kind: "ferry", zone: "upper", x: w * 0.28, y: L.horizonY + upperSpan * 0.36, vx: 1.25, minX: -95, maxX: w + 95, scale: 0.44 },
          { kind: "cargo_far", zone: "upper", x: w * 0.11, y: L.horizonY + upperSpan * 0.30, vx: 1.05, minX: -95, maxX: w + 95, scale: 0.39 },
          { kind: "recovery_ship", zone: "lower", x: w * 0.31, y: lowerClearY3, vx: 1.45, vy: 0.36, minX: -105, maxX: w * 0.52, minY: h * 0.73, maxY: h + 95, channelLoop: true, scale: 0.76 }
        ];
      }
      this.boats = this.ships;
    }

    // Helicopters taking off, landing & patrolling around base (1 clean patrol on mobile)
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
        }
      ];
      if (!isNarrow) {
        this.helicopters.push({
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
        });
      }
    }

    // Tiny Ground Handling Vehicles traversing tarmac gates & coastal highway viaduct!
    if (this.groundVehicles.length === 0) {
      const gvCount = isNarrow ? 1 : 6;
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

    // Rare Heavy-Lift Recovery Helicopter Delivering Crew Capsule into Automated Arched Hangar Roof Bay
    if (!this.heavyHeli) {
      this.heavyHeli = {
        phase: "dormant_wait",
        t: 0,
        phaseDuration: this._rand(65.0, 110.0),
        x: w + 140,
        y: L.horizonY + 12,
        vx: 0,
        vy: 0,
        departTargetY: Math.max(40, L.hangarY - 98),
        rotorPhase: 0,
        capsuleDropFrac: 0,
        doorOpenFrac: 0,
        heading: Math.PI
      };
    }

    // Rare Colossal Multi-Deck Sci-Fi Mega-Liner (A380-like rare spawn & Blended-Wing Body variant: Runway Land -> Dedicated Mega Gate -> Erector & Booster Tanks -> Vertical Launch)
    if (!this.megaliner) {
      this.megaliner = {
        variant: this._pickMegaLinerVariant(),
        phase: "dormant_wait",
        t: 0,
        phaseDuration: this._rand(140.0, 230.0),
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
        detachedChuteHeading: L.rwAng,
        detachedChuteScale: 0.72,
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
        }
      ];
      if (!isNarrow) {
        this.spaceplanes.push(
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
        );
      }
      this.spaceplane = this.spaceplanes[0];
    }

    if (!this.fogState.nextCheck) {
      const roll = Math.random() < 0.58;
      this.fogState.active = roll;
      this.fogState.targetAlpha = roll ? (0.38 + Math.random() * 0.24) : 0;
      this.fogState.nextCheck = now + 18000;
    }
  },

  spawnFighterFormation(w, h, opts = {}) {
    if (!w || !h) return;
    if (this.jetFormations.length >= 2) {
      this.jetFormations.shift();
    }
    const isNarrow = w < 720;
    const pool = this.JET_STUNT_TYPES.filter(s => s !== this._lastJetStunt);
    const chosenStunt = (opts.stunt && this.JET_STUNT_TYPES.includes(opts.stunt))
      ? opts.stunt
      : (pool[Math.floor(Math.random() * pool.length)] || "delta_roll");
    this._lastJetStunt = chosenStunt;

    const livPool = this.JET_LIVERIES.filter(l => l.name !== this._lastJetLivery);
    const chosenLivery = (opts.livery && this.JET_LIVERIES.find(l => l.name === opts.livery))
      || livPool[Math.floor(Math.random() * livPool.length)]
      || this.JET_LIVERIES[0];
    this._lastJetLivery = chosenLivery.name;

    const dir = Math.random() < 0.72 ? 1 : -1;
    const duration = this._rand(7.6, 8.4);
    const spanX = w + 260;
    const speed = spanX / duration;
    const startX = dir > 0 ? -130 : (w + 130);
    const startY = chosenStunt === "delta_loop"
      ? Math.max(Math.min(115, h * 0.145) * 2 + 24, h * 0.34)
      : h * this._rand(0.12, 0.21);
    const vx = dir * speed;
    const vy = (chosenStunt === "delta_loop" || chosenStunt === "bomb_burst")
      ? 0
      : -speed * this._rand(0.035, 0.065);

    const offsets = isNarrow
      ? (chosenStunt === "echelon_roll"
          ? [{ ox: 0, oy: 0 }, { ox: -24, oy: 14 }, { ox: -48, oy: 28 }]
          : [{ ox: 0, oy: 0 }, { ox: -24, oy: -14 }, { ox: -24, oy: 14 }])
      : (chosenStunt === "echelon_roll"
          ? [
              { ox: 0, oy: 0 },
              { ox: -25, oy: 15 },
              { ox: -50, oy: 30 },
              { ox: -75, oy: 45 },
              { ox: -100, oy: 60 }
            ]
          : [
              { ox: 0, oy: 0 },
              { ox: -26, oy: -16 },
              { ox: -26, oy: 16 },
              { ox: -52, oy: -32 },
              { ox: -52, oy: 32 }
            ]);

    const burstVecs = [
      { ax: 0.16, ay: -0.96 },
      { ax: 0.42, ay: -0.78 },
      { ax: 0.40, ay: 0.78 },
      { ax: -0.18, ay: -0.88 },
      { ax: -0.16, ay: 0.90 }
    ];

    const smokeList = chosenLivery.smokePalette || ["255, 255, 255"];
    this.jetFormations.push({
      isMajor: Boolean(opts.isMajor),
      stunt: chosenStunt,
      livery: chosenLivery,
      elapsed: 0,
      duration,
      speed,
      dir,
      startX,
      startY,
      x: startX,
      y: startY,
      vx,
      vy,
      angle: Math.atan2(vy, vx),
      scale: isNarrow ? 0.96 : 1.24,
      emitAccum: 0,
      jets: offsets.map((o, idx) => ({
        ox: o.ox,
        oy: o.oy,
        oz: 0,
        prevX: null,
        prevY: null,
        smoothAngle: null,
        smokeRgb: smokeList[idx % smokeList.length],
        burst: burstVecs[idx] || { ax: 0, ay: -0.5 },
        trail: []
      }))
    });
  },

  _drawFighterJet(ctx, pal, sc, step, rollAngle = 0, livery = null, mode = "light") {
    const liv = livery || {
      body: pal.militaryBody,
      shade: pal.militaryShade,
      belly: pal.archDark,
      accent: pal.liveryAccent,
      spine: pal.bodyLight
    };
    const isNight = mode === "dark";
    const isEvening = mode === "evening";
    const isMorning = mode === "morning";
    ctx.save();
    ctx.scale(sc, sc);

    // Crisp luminous dual supersonic afterburner plume + diurnal incandescent exhaust glow halo
    const abPulse = 0.85 + 0.15 * Math.sin(step * 42);
    const plumeScale = isNight ? 1.24 : (isEvening ? 1.12 : 1.0);
    if (isNight || isEvening) {
      const abHalo = ctx.createRadialGradient(-12.5, 0, 1, -13.5, 0, isNight ? 12 : 9);
      abHalo.addColorStop(0, `rgba(${pal.plumeCore}, ${isNight ? 0.58 : 0.36})`);
      abHalo.addColorStop(0.5, `rgba(${pal.plumeMid}, ${isNight ? 0.34 : 0.20})`);
      abHalo.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
      ctx.fillStyle = abHalo;
      ctx.beginPath();
      ctx.arc(-13.5, 0, isNight ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();
    }
    const fg = ctx.createLinearGradient(-9.5, 0, -23 * abPulse * plumeScale, 0);
    fg.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
    fg.addColorStop(0.45, `rgba(${pal.plumeMid}, ${isNight ? 0.92 : 0.84})`);
    fg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-9.5, -1.7);
    ctx.lineTo(-23 * abPulse * plumeScale, 0);
    ctx.lineTo(-9.5, 1.7);
    ctx.closePath();
    ctx.fill();

    const cosR = Math.cos(rollAngle);
    const sinR = Math.sin(rollAngle);
    const isInverted = cosR < 0;
    const wingScale = (Math.abs(cosR) < 0.14 ? (cosR < 0 ? -0.14 : 0.14) : cosR);

    // Swept Delta Main Wings + LERX strakes foreshortened cleanly through 3D axial roll
    ctx.save();
    ctx.scale(1, wingScale);
    ctx.fillStyle = liv.shade;
    ctx.fillRect(-10.6, -1.8, 3.2, 3.6);

    const drawAirframeWingPath = () => {
      ctx.beginPath();
      ctx.moveTo(12.2, 0);
      ctx.lineTo(5.8, -1.5);
      ctx.lineTo(2.4, -2.3);
      ctx.lineTo(-7.2, -9.4);
      ctx.lineTo(-9.5, -8.8);
      ctx.lineTo(-8.8, -2.0);
      ctx.lineTo(-8.8, 2.0);
      ctx.lineTo(-9.5, 8.8);
      ctx.lineTo(-7.2, 9.4);
      ctx.lineTo(2.4, 2.3);
      ctx.lineTo(5.8, 1.5);
      ctx.closePath();
    };
    ctx.fillStyle = isInverted ? liv.belly : liv.body;
    drawAirframeWingPath();
    ctx.fill();

    // Swept wing leading-edge chevrons & high-contrast wingtip team trim
    ctx.fillStyle = liv.accent;
    ctx.beginPath();
    ctx.moveTo(1.8, -2.4);
    ctx.lineTo(-7.2, -9.4);
    ctx.lineTo(-8.2, -9.0);
    ctx.lineTo(0.4, -2.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.8, 2.4);
    ctx.lineTo(-7.2, 9.4);
    ctx.lineTo(-8.2, 9.0);
    ctx.lineTo(0.4, 2.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-8.8, -8.4, 3.2, 1.2);
    ctx.fillRect(-8.8, 7.2, 3.2, 1.2);

    // Signature team belly/dorsal center arrow flash visible both upright and inverted!
    ctx.fillStyle = isInverted ? liv.accent : liv.spine;
    ctx.beginPath();
    ctx.moveTo(8.5, 0);
    ctx.lineTo(-4.8, -1.2);
    ctx.lineTo(-7.0, 0);
    ctx.lineTo(-4.8, 1.2);
    ctx.closePath();
    ctx.fill();

    // Diurnal atmospheric shading wash across wings & fuselage planform
    if (isNight || isEvening || isMorning) {
      drawAirframeWingPath();
      ctx.fillStyle = isNight
        ? "rgba(5, 11, 26, 0.46)"
        : (isEvening ? "rgba(38, 18, 48, 0.24)" : "rgba(255, 224, 186, 0.14)");
      ctx.fill();
      // Sunlit / moonlit leading-edge rim highlight matching sky angle
      ctx.strokeStyle = isNight
        ? "rgba(186, 230, 253, 0.48)"
        : (isEvening ? "rgba(253, 186, 116, 0.56)" : "rgba(255, 244, 214, 0.58)");
      ctx.lineWidth = 0.72;
      ctx.beginPath();
      ctx.moveTo(12.2, 0);
      ctx.lineTo(2.4, -2.3);
      ctx.lineTo(-7.2, -9.4);
      ctx.stroke();
    }

    // Wingtip red/green navigation beacons in dusk & night skies
    if (isNight || isEvening) {
      ctx.fillStyle = "#EF4444";
      ctx.beginPath();
      ctx.arc(-8.4, -9.1, 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22C55E";
      ctx.beginPath();
      ctx.arc(-8.4, 9.1, 0.95, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Sculpted central fuselage spine + tinted bubble canopy (flips orientation smoothly across roll)
    ctx.fillStyle = isInverted ? liv.belly : liv.spine;
    ctx.globalAlpha = isNight ? 0.72 : 0.94;
    ctx.beginPath();
    ctx.moveTo(12.2, 0);
    ctx.lineTo(3.8, isInverted ? 1.6 : -1.5);
    ctx.lineTo(-8.2, isInverted ? 1.5 : -1.5);
    ctx.lineTo(-8.2, isInverted ? -0.3 : 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Nose radome tip accent
    ctx.fillStyle = liv.accent;
    ctx.beginPath();
    ctx.moveTo(12.2, 0);
    ctx.lineTo(9.0, -0.75);
    ctx.lineTo(9.0, 0.75);
    ctx.closePath();
    ctx.fill();

    // Teardrop canopy dome with bright specular reflection
    ctx.fillStyle = pal.windowGlassDark;
    ctx.beginPath();
    ctx.ellipse(3.6, isInverted ? 0.55 : -0.45, 3.0, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.windowGlow;
    ctx.beginPath();
    ctx.ellipse(4.1, isInverted ? 0.75 : -0.65, 1.5, 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin/Canted Vertical Tail Stabilizer with painted squadron flash
    const tailDir = isInverted ? 1 : -1;
    const tailHeight = Math.max(2.2, Math.abs(cosR) * 4.7 + Math.abs(sinR) * 1.4);
    ctx.fillStyle = liv.shade;
    ctx.beginPath();
    ctx.moveTo(-4.8, tailDir * 1.3);
    ctx.lineTo(-8.8, tailDir * (1.3 + tailHeight));
    ctx.lineTo(-9.8, tailDir * (1.1 + tailHeight));
    ctx.lineTo(-8.4, tailDir * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = liv.accent;
    ctx.fillRect(-8.9, tailDir > 0 ? (1.2 + tailHeight * 0.72) : -(1.2 + tailHeight * 0.96), 1.8, tailHeight * 0.24);

    if ((isNight || isEvening) && Math.sin(step * 9.5) > 0.76) {
      ctx.fillStyle = "#F87171";
      ctx.beginPath();
      ctx.arc(-8.8, tailDir * (1.3 + tailHeight), 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _updateAndDrawJetFormations(ctx, w, h, L, pal, mode, dt, step) {
    if (!this.jetFormations || this.jetFormations.length === 0) return;
    const smooth5 = t => {
      const c = this._clamp(t, 0, 1);
      return c * c * c * (c * (c * 6 - 15) + 10);
    };
    const isNight = mode === "dark";
    const isEvening = mode === "evening";
    const isMorning = mode === "morning";
    const blendSmoke = (baseRgbStr) => {
      const parts = baseRgbStr.split(",").map(v => parseInt(v.trim(), 10));
      if (parts.length !== 3 || parts.some(isNaN)) return baseRgbStr;
      let tr = 255, tg = 255, tb = 255, mix = 0;
      if (isMorning) { tr = 255; tg = 224; tb = 198; mix = 0.34; }
      else if (isEvening) { tr = 253; tg = 178; tb = 132; mix = 0.44; }
      else if (isNight) { tr = 172; tg = 208; tb = 242; mix = 0.42; }
      if (mix === 0) return baseRgbStr;
      const r = Math.round(parts[0] * (1 - mix) + tr * mix);
      const g = Math.round(parts[1] * (1 - mix) + tg * mix);
      const b = Math.round(parts[2] * (1 - mix) + tb * mix);
      return `${r}, ${g}, ${b}`;
    };
    const activeFormations = [];

    for (let f = 0; f < this.jetFormations.length; f++) {
      const fm = this.jetFormations[f];
      fm.elapsed = (fm.elapsed || 0) + dt;
      const p = fm.elapsed / Math.max(0.5, fm.duration || 8.0);

      // Update formation reference path per aerial stunt using true arc-length C2 continuous geometry
      if (fm.stunt === "delta_loop") {
        const loopCx = w * 0.50;
        const loopR = Math.min(115, h * 0.145);
        const loopCy = Math.max(loopR + 24, h * 0.19);
        const baseY = loopCy + loopR;
        const endX = fm.dir > 0 ? w + 130 : -130;
        const dIn = Math.abs(loopCx - fm.startX);
        const dLoop = Math.PI * 2 * loopR;
        const dOut = Math.abs(endX - loopCx);
        const dTotal = Math.max(1, dIn + dLoop + dOut);
        const p1 = dIn / dTotal;
        const p2 = (dIn + dLoop) / dTotal;
        const loopPos = (u) => {
          if (u < p1) {
            return { x: this._lerp(fm.startX, loopCx, u / p1), y: baseY };
          }
          if (u < p2) {
            const lf = (u - p1) / (p2 - p1);
            // Realistic pull-up speed easing: faster entering bottom, slightly slower cresting apex at pi
            const theta = lf * Math.PI * 2 + 0.14 * Math.sin(lf * Math.PI * 2);
            return {
              x: loopCx + fm.dir * Math.sin(theta) * loopR,
              y: loopCy + Math.cos(theta) * loopR
            };
          }
          const ep = (u - p2) / (1 - p2);
          return { x: fm.dir > 0 ? (loopCx + ep * dOut) : (loopCx - ep * dOut), y: baseY };
        };
        const cur = loopPos(Math.min(1.18, p));
        const du = 0.002;
        const prevP = loopPos(Math.max(0, Math.min(1.18, p) - du));
        const nextP = loopPos(Math.min(1.18, p) + du);
        fm.x = cur.x;
        fm.y = cur.y;
        fm.angle = Math.atan2(nextP.y - prevP.y, nextP.x - prevP.x);
      } else {
        fm.x += fm.vx * dt;
        fm.y += fm.vy * dt;
        fm.angle = Math.atan2(fm.vy, fm.vx);
      }

      const ca = Math.cos(fm.angle);
      const sa = Math.sin(fm.angle);
      const trailMargin = 160;
      const leaderOnCourse = fm.dir > 0 ? fm.x < w + trailMargin : fm.x > -trailMargin;
      let anyAlive = leaderOnCourse || p < 1.05;

      // Compute smooth 3D slot offsets & Euler attitudes for every aircraft in formation
      const renderList = [];
      for (let j = 0; j < fm.jets.length; j++) {
        const jet = fm.jets[j];
        let ox = jet.ox;
        let oy = jet.oy;
        let oz = 0;
        let rollAngle = 0;
        let jx, jy, jetAngle = fm.angle;

        if (fm.stunt === "bomb_burst") {
          const b = this._clamp((p - 0.34) / 0.66, 0, 1);
          const bEase = smooth5(b);
          const fanScale = w < 720 ? 150 : 245;
          ox += jet.burst.ax * fanScale * bEase;
          oy += jet.burst.ay * fanScale * bEase;
          rollAngle = bEase * Math.PI * 2 * (j % 2 === 0 ? 1 : -1);
          jx = fm.x + ca * ox - sa * oy;
          jy = fm.y + sa * ox + ca * oy;
          if (jet.prevX != null && p > 0.35) {
            const dxV = jx - jet.prevX;
            const dyV = jy - jet.prevY;
            if (Math.hypot(dxV, dyV) > 0.04) {
              const tgtAng = Math.atan2(dyV, dxV);
              jet.smoothAngle = jet.smoothAngle == null ? tgtAng : this._lerpAngle(jet.smoothAngle, tgtAng, Math.min(1, dt * 10));
              jetAngle = jet.smoothAngle;
            }
          } else {
            jet.smoothAngle = fm.angle;
          }
        } else if (fm.stunt === "delta_roll") {
          // Authentic 3D axial barrel roll rotating wingmen through depth (oy, oz) + smooth helical arc
          const rp = smooth5((p - 0.16) / 0.68);
          rollAngle = rp * Math.PI * 2;
          const cr = Math.cos(rollAngle);
          const sr = Math.sin(rollAngle);
          oy = jet.oy * cr;
          oz = jet.oy * sr;
          jx = fm.x + ca * ox - sa * oy;
          jy = fm.y + sa * ox + ca * oy + sr * 24;
        } else if (fm.stunt === "upside_down") {
          if (p < 0.14) {
            rollAngle = 0;
          } else if (p < 0.28) {
            rollAngle = smooth5((p - 0.14) / 0.14) * Math.PI;
          } else if (p < 0.72) {
            rollAngle = Math.PI;
          } else if (p < 0.86) {
            rollAngle = Math.PI + smooth5((p - 0.72) / 0.14) * Math.PI;
          } else {
            rollAngle = Math.PI * 2;
          }
          jx = fm.x + ca * ox - sa * oy;
          jy = fm.y + sa * ox + ca * oy;
        } else if (fm.stunt === "echelon_roll") {
          const startSlot = 0.12 + j * 0.08;
          const rp = smooth5((p - startSlot) / 0.34);
          rollAngle = rp * Math.PI * 2;
          jy = fm.y + sa * ox + ca * oy - Math.sin(rollAngle) * 8;
          jx = fm.x + ca * ox - sa * oy;
        } else {
          jx = fm.x + ca * ox - sa * oy;
          jy = fm.y + sa * ox + ca * oy;
        }

        jet.prevX = jx;
        jet.prevY = jy;
        const jCa = Math.cos(jetAngle);
        const jSa = Math.sin(jetAngle);
        const nx = jx - jCa * 11 * fm.scale;
        const ny = jy - jSa * 11 * fm.scale;

        // Dense frame-rate-independent smoke sampling with monotonic width/age so trails never jitter or kink
        if (nx > -150 && nx < w + 150 && ny > -110 && ny < h * 0.65) {
          const baseR0 = w < 720 ? 1.55 : 2.25;
          const maxAge = 5.0;
          if (jet.trail.length === 0) {
            jet.trail.push({ x: nx, y: ny, age: 0, maxAge, r0: baseR0 });
          } else {
            const last = jet.trail[jet.trail.length - 1];
            const dist = Math.hypot(nx - last.x, ny - last.y);
            if (dist >= 2.0) {
              const subSteps = Math.min(8, Math.max(1, Math.ceil(dist / 2.6)));
              for (let s = 1; s <= subSteps; s++) {
                const sf = s / subSteps;
                jet.trail.push({
                  x: last.x + (nx - last.x) * sf,
                  y: last.y + (ny - last.y) * sf,
                  age: dt * (1 - sf) * 0.5,
                  maxAge,
                  r0: baseR0
                });
              }
            }
          }
        }

        // Age smoke ribbon vertices gently upward with ambient atmospheric drift
        const alivePts = [];
        for (let tIdx = 0; tIdx < jet.trail.length; tIdx++) {
          const pt = jet.trail[tIdx];
          pt.age += dt;
          if (pt.age >= pt.maxAge) continue;
          pt.y -= 2.0 * dt;
          pt.x -= fm.dir * 1.4 * dt;
          alivePts.push(pt);
        }
        jet.trail = alivePts;
        if (alivePts.length > 0) anyAlive = true;

        renderList.push({ jet, jx, jy, oz, jetAngle, rollAngle });
      }

      // 1. Render Silky Seamless Exclusive-Handoff Quadratic-Spline Smoke Ribbons (zero junction ticks!)
      ctx.save();
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      for (let rIdx = 0; rIdx < renderList.length; rIdx++) {
        const { jet } = renderList[rIdx];
        const pts = jet.trail;
        if (pts.length < 4) continue;
        const tintedRgb = blendSmoke(jet.smokeRgb || pal.smokeRgb);
        const bands = 36;
        const nPts = pts.length;
        for (let bi = 0; bi < bands; bi++) {
          const i0 = Math.max(1, Math.floor((bi / bands) * (nPts - 2)));
          let i1 = Math.min(nPts - 1, Math.floor(((bi + 1) / bands) * (nPts - 2)));
          if (bi === bands - 1) i1 = nPts - 1;
          if (i1 <= i0) continue;

          const midPt = pts[(i0 + i1) >> 1];
          const frac = midPt.age / Math.max(0.1, midPt.maxAge);
          const env = Math.min(1, frac * 6.5) * Math.pow(1 - frac, 1.35);
          if (env <= 0.008) continue;

          const traceSplineBand = () => {
            const startMx = (pts[i0 - 1].x + pts[i0].x) * 0.5;
            const startMy = (pts[i0 - 1].y + pts[i0].y) * 0.5;
            ctx.beginPath();
            ctx.moveTo(startMx, startMy);
            for (let k = i0; k < i1; k++) {
              const endMx = (pts[k].x + pts[k + 1].x) * 0.5;
              const endMy = (pts[k].y + pts[k + 1].y) * 0.5;
              ctx.quadraticCurveTo(pts[k].x, pts[k].y, endMx, endMy);
            }
          };

          const baseAlpha = isNight ? 0.28 : (isEvening ? 0.34 : 0.38);
          ctx.strokeStyle = `rgba(${tintedRgb}, ${(env * baseAlpha).toFixed(3)})`;
          ctx.lineWidth = (midPt.r0 * 1.7 + frac * 11.0) * fm.scale;
          traceSplineBand();
          ctx.stroke();

          if (frac < 0.60) {
            const coreMul = isNight ? 0.48 : (isEvening ? 0.62 : 0.72);
            const aCore = (1 - frac / 0.60) * coreMul;
            ctx.strokeStyle = `rgba(${tintedRgb}, ${aCore.toFixed(3)})`;
            ctx.lineWidth = Math.max(1.3, midPt.r0 * 1.18 * fm.scale * (1 - frac * 0.42));
            traceSplineBand();
            ctx.stroke();
          }

          // Afterburner warm illumination on fresh exhaust smoke at dusk & night
          if ((isNight || isEvening) && frac < 0.14) {
            const abA = (1 - frac / 0.14) * (isNight ? 0.42 : 0.28);
            ctx.strokeStyle = `rgba(${pal.plumeMid}, ${abA.toFixed(3)})`;
            ctx.lineWidth = Math.max(1.1, midPt.r0 * 0.9 * fm.scale);
            traceSplineBand();
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // 2. Depth-sort jets by oz (for true 3D barrel roll occlusion) and draw
      renderList.sort((a, b) => a.oz - b.oz);
      for (let rIdx = 0; rIdx < renderList.length; rIdx++) {
        const item = renderList[rIdx];
        if (item.jx > -100 && item.jx < w + 100 && item.jy > -80 && item.jy < h) {
          const depthMul = this._clamp(1 + item.oz * 0.0042, 0.80, 1.20);
          ctx.save();
          ctx.translate(item.jx, item.jy);
          ctx.rotate(item.jetAngle);
          if (fm.dir < 0) ctx.scale(1, -1);
          this._drawFighterJet(ctx, pal, fm.scale * depthMul, step, item.rollAngle, fm.livery, mode);
          ctx.restore();
        }
      }

      if (anyAlive) {
        activeFormations.push(fm);
      }
    }
    this.jetFormations = activeFormations;
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
    if (kind === "complete" || kind === "queue_clear" || kind === "finalise") {
      this.spawnFighterFormation(w, h, { isMajor: kind === "queue_clear" || kind === "finalise" });
    }
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

  draw(ctx, w, h, mode, dt, step, diurnalHour = null) {
    // Invalidate dynamic entity sizing cleanly across responsive desktop <-> mobile resizes
    if (this._lastW && Math.abs(this._lastW - w) > 20) {
      this.groundVehicles = [];
      this.ships = [];
      this.spaceplanes = [];
      this.helicopters = [];
      this.portOps = null;
      this.stars = [];
      this.satellites = [];
    }
    this._lastW = w;
    this._lastH = h;
    this._lastMode = mode;

    const now = performance.now();
    this.ensureStaticCache(w, h, mode, diurnalHour);
    this.ensureEntities(w, h, now);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);
    const cel = this.getCelestialState(w, h, L, mode, diurnalHour);
    pal.sunDir = cel.shadowDir;
    pal.celestial = cel;
    pal.diurnalHour = cel.hour;

    // 1. Blit offscreen cached 2.5D coastal terrain, runway, crawlerway & pad infrastructure
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Subtle Animated Sky & Clipped Water Shimmer
    this._drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step, diurnalHour);

    // 3. Ships Gliding Across Upper Archipelago Bay & Lower Sea Channel + Live 5-Angle Container Seaport Ops
    this._updateAndDrawShips(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawPortOps(ctx, w, h, L, pal, dt, step);

    // 4. Offshore Falcon Heavy Launch, Dual Booster Pad Recovery & Crane Re-Mating
    this._updateAndDrawOffshoreRocket(ctx, L, pal, dt, step, w, h);

    // 5. Orbital Streaks & Task-Complete Supersonic Fighter Jet Formation Flyover
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
    this._updateAndDrawJetFormations(ctx, w, h, L, pal, mode, dt, step);

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

    // 11. Foreground Arched Hangar Roof Occlusion Layer w/ Automated Sliding Capsule Hatch Doors + Heavy Recovery Chopper
    const doorOpenFrac = this.heavyHeli ? (this.heavyHeli.doorOpenFrac || 0) : 0;
    this._drawArchedHangarOcclusionRoof(ctx, L, pal, doorOpenFrac);

    // 12. Patrol, Transport & Rare Heavy-Lift Capsule Recovery Helicopters Around Base
    this._updateAndDrawHelicopters(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawHeavyHeli(ctx, w, h, L, pal, dt, step);

    // 13. Exhaust Smoke, Deluge Steam & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 13b. Automatic Festive Holiday Additions (snow/garlands, fireworks, lanterns, moon & bats)
    if (typeof HolidayThemes !== "undefined" && HolidayThemes.drawGatewayOverlay) {
      HolidayThemes.drawGatewayOverlay(ctx, w, h, L, pal, mode, dt, step);
    }

    // 14. Dynamic Rolling Dawn Fog (morning mode)
    this._updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now);
  },

  _drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step, diurnalHour = null) {
    const scaleDt = dt * 60;

    if (mode === "dark" || mode === "evening") {
      const maxA = mode === "dark" ? 0.90 : 0.28;
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.phase += s.speed * scaleDt;
        const tw = 0.40 + 0.60 * (0.5 + 0.5 * Math.sin(s.phase));
        const a = maxA * tw;
        const col = s.tint || "226, 232, 240";
        ctx.fillStyle = `rgba(${col}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.bright && mode === "dark") {
          const spLen = s.r * (3.0 + tw * 2.2);
          ctx.strokeStyle = `rgba(${col}, ${(a * 0.48).toFixed(3)})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(s.x - spLen, s.y);
          ctx.lineTo(s.x + spLen, s.y);
          ctx.moveTo(s.x, s.y - spLen);
          ctx.lineTo(s.x, s.y + spLen);
          ctx.stroke();
        }
      }

      if (mode === "dark") {
        // Serene sunlit orbital satellites crossing the upper spaceport zenith
        for (let i = 0; i < this.satellites.length; i++) {
          const sat = this.satellites[i];
          sat.x += sat.vx * dt;
          sat.y += sat.vy * dt;
          if (sat.x > w + 40) sat.x = -40;
          if (sat.x < -40) sat.x = w + 40;
          if (sat.y < 14 || sat.y > L.horizonY * 0.85) sat.y = L.horizonY * (0.24 + i * 0.20);
          const glint = 0.55 + 0.45 * Math.sin(step * 3.2 + sat.phase);
          ctx.fillStyle = `rgba(224, 242, 254, ${glint.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sat.x, sat.y, 1.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(125, 211, 252, ${(glint * 0.42).toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sat.x - 3.6, sat.y - 0.8);
          ctx.lineTo(sat.x + 3.6, sat.y + 0.8);
          ctx.stroke();
        }

        // Occasional shooting stars streaking smoothly through upper sky
        this.nextMeteorTime -= dt;
        if (this.nextMeteorTime <= 0 && this.meteors.length < 2) {
          this.nextMeteorTime = this._rand(4.5, 9.5);
          const fromLeft = Math.random() < 0.55;
          this.meteors.push({
            x: fromLeft ? w * this._rand(0.18, 0.58) : w * this._rand(0.45, 0.85),
            y: L.horizonY * this._rand(0.08, 0.34),
            vx: (fromLeft ? 1 : -1) * this._rand(210, 310),
            vy: this._rand(55, 105),
            life: 0,
            maxLife: this._rand(0.75, 1.15)
          });
        }
        const aliveMeteors = [];
        ctx.lineCap = "round";
        for (let i = 0; i < this.meteors.length; i++) {
          const m = this.meteors[i];
          m.life += dt;
          if (m.life >= m.maxLife) continue;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          aliveMeteors.push(m);
          const env = Math.sin((m.life / m.maxLife) * Math.PI);
          const tailX = m.x - m.vx * 0.22;
          const tailY = m.y - m.vy * 0.22;
          const mg = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
          mg.addColorStop(0, "rgba(186, 230, 253, 0)");
          mg.addColorStop(0.7, `rgba(125, 211, 252, ${(0.55 * env).toFixed(3)})`);
          mg.addColorStop(1, `rgba(255, 255, 255, ${(0.95 * env).toFixed(3)})`);
          ctx.strokeStyle = mg;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
        this.meteors = aliveMeteors;
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

    const cel = pal.celestial || this.getCelestialState(w, h, L, mode, diurnalHour);
    const sheenX = cel.primary.x;
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
      const inSunCol = Math.max(0, 1 - Math.abs(gx - sheenX) / (w * 0.19));
      const inMoonCol = (cel.primary.kind === "sun" && cel.moon.visible)
        ? Math.max(0, 1 - Math.abs(gx - cel.moon.x) / (w * 0.14)) * 0.35 * cel.moon.alpha
        : 0;
      const pulse = 0.45 + 0.55 * Math.sin(g.phase);
      const a = (0.05 + Math.max(inSunCol, inMoonCol) * 0.24) * pulse * (mode === "dark" ? 0.65 : 1.0);
      ctx.strokeStyle = `rgba(${pal.waterShimmerRgb}, ${a.toFixed(3)})`;
      ctx.lineWidth = 0.9 + g.yFrac * 0.8;
      ctx.beginPath();
      ctx.moveTo(gx - g.len * 0.5, gy);
      ctx.lineTo(gx + g.len * 0.5, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Lower Channel Shimmer (clipped strictly below compact seawall & western headland)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, h * 0.44);
    for (let i = 0; i < L.shorePts.length; i++) {
      ctx.lineTo(L.shorePts[i].x, L.shorePts[i].y);
    }
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
      const gy = (h * 0.46) + g.yFrac * (h - (h * 0.46));
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
      if (s.vy) s.y += s.vy * dt;

      if (s.channelLoop) {
        // Lower-channel ships glide strictly off-screen West (-115) <-> off-screen South (y > h + 90)
        if (s.vx > 0 && (s.x > s.maxX || s.y > s.maxY)) {
          s.x = s.minX;
          s.y = Math.max(L.islandTopY + 52, Math.min(h * 0.80, s.minY || h * 0.72));
        } else if (s.vx < 0 && (s.x < s.minX || s.y < (s.minY || h * 0.68))) {
          s.x = Math.min(w * 0.48, w * 0.34 + ((i * 73) % 140));
          s.y = s.maxY || (h + 95);
        }
      } else if (s.westLoopOnly) {
        // Reverses smoothly only at off-screen west or loops back via far channel without visible pop
        if (s.x > s.maxX) s.vx = -Math.abs(s.vx);
        if (s.x < s.minX) s.vx = Math.abs(s.vx);
      } else {
        // Unobstructed upper-horizon ships wrap strictly off-screen one-way (minX = -95, maxX = w + 95)
        if (s.vx > 0 && s.x > s.maxX) s.x = s.minX;
        if (s.vx < 0 && s.x < s.minX) s.x = s.maxX;
      }

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

  // 6-Angle Oblique Container Ship Perspective System (adding "front_beam" for smooth wide turns!)
  _quantizeShipPerspective(heading) {
    let a = ((heading % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const absA = Math.abs(a);
    let perspective, yaw;
    if (absA < Math.PI / 10) {
      perspective = "side_profile";
      yaw = 0;
    } else if (absA > (9 * Math.PI) / 10) {
      perspective = "side_profile";
      yaw = Math.PI;
    } else if (Math.abs(a - Math.PI * 0.5) <= Math.PI / 9) {
      perspective = "front_headon";
      yaw = Math.PI * 0.5;
    } else if (Math.abs(a + Math.PI * 0.5) <= Math.PI / 9) {
      perspective = "rear_tailon";
      yaw = -Math.PI * 0.5;
    } else if (a > 0) {
      if (absA < Math.PI * 0.25 || absA > Math.PI * 0.75) {
        perspective = "front_beam";
        yaw = absA < Math.PI * 0.5 ? 0.46 : Math.PI - 0.46;
      } else {
        perspective = "front_quarter";
        yaw = absA < Math.PI * 0.5 ? 0.98 : Math.PI - 0.98;
      }
    } else {
      perspective = "rear_quarter";
      yaw = a > -Math.PI * 0.5 ? -0.78 : -Math.PI + 0.78;
    }
    return { perspective, yaw };
  },

  _drawContainerShip5Angle(ctx, ship, pal, step, scale) {
    const { perspective, yaw } = this._quantizeShipPerspective(ship.heading);
    const renderYaw = (perspective === "front_headon" || perspective === "rear_tailon")
      ? yaw
      : this._lerpAngle(yaw, ship.heading, 0.28);
    const cosY = Math.cos(renderYaw);
    const sinY = Math.sin(renderYaw);
    const sinE = 0.44;
    const cosE = 0.90;

    // 3D marine coordinate space (bx=+bow, by=+starboard, bz=+up) -> 2.5D camera
    const proj = (bx, by, bz) => {
      const wx = bx * cosY - by * sinY;
      const wy = bx * sinY + by * cosY;
      return { x: wx, y: wy * sinE - bz * cosE, wy };
    };
    const fillPoly = (pts3, fillCol, strokeCol = null, lw = 0.65) => {
      if (!pts3 || pts3.length < 3) return;
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      pts3.forEach((p, idx) => {
        const pr = proj(p[0], p[1], p[2]);
        if (idx === 0) ctx.moveTo(pr.x, pr.y);
        else ctx.lineTo(pr.x, pr.y);
      });
      ctx.closePath();
      ctx.fill();
      if (strokeCol) {
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    };
    const drawBox3D = (bx0, bx1, by0, by1, bz0, bz1, topCol, sideCol, endCol) => {
      const midX = (bx0 + bx1) * 0.5;
      const midY = (by0 + by1) * 0.5;
      const visY = cosY >= 0 ? by1 : by0;
      const visX = sinY >= 0 ? bx1 : bx0;
      const wyY = midX * sinY + visY * cosY;
      const wyX = visX * sinY + midY * cosY;

      const drawYFace = () => fillPoly([
        [bx0, visY, bz0], [bx1, visY, bz0], [bx1, visY, bz1], [bx0, visY, bz1]
      ], sideCol);
      const drawXFace = () => fillPoly([
        [visX, by0, bz0], [visX, by1, bz0], [visX, by1, bz1], [visX, by0, bz1]
      ], endCol);

      if (wyY < wyX) {
        drawYFace();
        drawXFace();
      } else {
        drawXFace();
        drawYFace();
      }
      fillPoly([[bx0, by0, bz1], [bx1, by0, bz1], [bx1, by1, bz1], [bx0, by1, bz1]], topCol);
    };

    ctx.save();
    ctx.translate(ship.x, ship.y);

    // Speed-scaled V-wake streaming behind ship stern
    if (ship.speed > 1.2) {
      const wakeLen = Math.min(48, 12 + ship.speed * 2.1) * scale;
      const sternP = proj(-25 * scale, 0, 0);
      const backP = proj((-25 - wakeLen) * scale, 0, 0);
      const wAng = Math.atan2(backP.y - sternP.y, backP.x - sternP.x);
      const wx = Math.cos(wAng);
      const wy = Math.sin(wAng);
      const px = -wy;
      const py = wx;
      const wg = ctx.createLinearGradient(sternP.x, sternP.y, backP.x, backP.y);
      wg.addColorStop(0, pal.isNightLights ? "rgba(186, 230, 253, 0.34)" : "rgba(255, 255, 255, 0.52)");
      wg.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.strokeStyle = wg;
      ctx.lineWidth = 1.3 * scale;
      ctx.beginPath();
      ctx.moveTo(sternP.x, sternP.y);
      ctx.lineTo(backP.x + px * 5.2 * scale, backP.y + py * 5.2 * scale);
      ctx.moveTo(sternP.x, sternP.y);
      ctx.lineTo(backP.x - px * 5.2 * scale, backP.y - py * 5.2 * scale);
      ctx.stroke();
    }

    ctx.scale(scale, scale);

    // Foreshortened water shadow ellipse projected cleanly with ship yaw
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    const shNose = proj(29, 0, -1.2);
    const shStern = proj(-25, 0, -1.2);
    const shPort = proj(0, -8.5, -1.2);
    const shStbd = proj(0, 8.5, -1.2);
    ctx.moveTo(shNose.x, shNose.y + 1.8);
    ctx.lineTo(shStbd.x, shStbd.y + 1.8);
    ctx.lineTo(shStern.x, shStern.y + 1.8);
    ctx.lineTo(shPort.x, shPort.y + 1.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 1. 3D Tapered Container Ship Hull (Boot-Top + Freeboard Wall + Tapered Bow Stem + Main Deck)
    const hb = 6.6;
    const sternX = -24;
    const shldX = 14;
    const bowX = 27.5;
    const nearSide = cosY >= 0 ? 1 : -1;
    const farSide = -nearSide;
    const hullShade = pal.isNightLights ? "#0A101E" : "#1E293B";
    const bootRed = pal.chuteColor;

    const hullPtsDepth = [];
    // Collect visible outer hull panels & sort back-to-front by center depth
    const addHullFace = (pts, col, zCenterBx, zCenterBy) => {
      hullPtsDepth.push({
        pts,
        col,
        wy: zCenterBx * sinY + zCenterBy * cosY
      });
    };

    [farSide, nearSide].forEach(side => {
      const yS = side * hb;
      const sideCol = side === nearSide ? pal.shipHull : hullShade;
      // Boot-top crimson stripe + main freeboard wall
      addHullFace([[sternX, yS, 0], [shldX, yS, 0], [shldX, yS, 1.3], [sternX, yS, 1.3]], bootRed, -5, yS);
      addHullFace([[sternX, yS, 1.3], [shldX, yS, 1.3], [shldX, yS, 4.4], [sternX, yS, 4.4]], sideCol, -5, yS);
      // Tapered prow cheek
      addHullFace([[shldX, yS, 0], [bowX, 0, 0.3], [bowX, 0, 1.5], [shldX, yS, 1.3]], bootRed, 21, yS * 0.5);
      addHullFace([[shldX, yS, 1.3], [bowX, 0, 1.5], [bowX, 0, 5.1], [shldX, yS, 4.4]], sideCol, 21, yS * 0.5);
    });
    // Flat transom stern face
    addHullFace([[sternX, -hb, 0], [sternX, hb, 0], [sternX, hb, 4.4], [sternX, -hb, 4.4]], hullShade, sternX, 0);

    hullPtsDepth.sort((a, b) => a.wy - b.wy);
    hullPtsDepth.forEach(item => fillPoly(item.pts, item.col));

    // Weather Deck Slab (bz = 4.4)
    fillPoly([
      [sternX, -hb, 4.4], [shldX, -hb, 4.4], [bowX, 0, 5.1], [shldX, hb, 4.4], [sternX, hb, 4.4]
    ], pal.archMid, pal.archDark, 0.6);

    // 2. Back-to-Front Depth-Sorted Superstructure & Dynamic Stacked Container Bays
    const items = [];
    // Aft multi-deck bridge housing + navigation wheelhouse + funnel
    items.push({
      wy: (-18.5 * sinY),
      draw: () => {
        drawBox3D(-22, -15.5, -5.4, 5.4, 4.4, 11.4, pal.archLight, pal.shipSuper, pal.archMid);
        // Dark bridge glass ribbon along upper bridge deck
        drawBox3D(-20.8, -14.8, -6.2, 6.2, 9.8, 11.6, pal.shipSuper, pal.windowGlassDark, pal.windowGlassDark);
        // Funnel stack & comms radar mast
        drawBox3D(-23.2, -20.8, -1.5, 1.5, 4.4, 12.6, "#0F172A", pal.liveryAccent, pal.shipHull);
        const mBot = proj(-18, 0, 11.6);
        const mTop = proj(-18, 0, 16.5);
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(mBot.x, mBot.y);
        ctx.lineTo(mTop.x, mTop.y);
        ctx.stroke();
        if (pal.isNightLights) {
          ctx.fillStyle = "rgba(254, 240, 168, 0.92)";
          ctx.beginPath();
          ctx.arc(mTop.x, mTop.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // 4 Forward Cargo Bays x 2 Vertical Tiers = 8 Dynamic 3D ISO Container Slots!
    const bayX = [-8.5, -2.0, 4.5, 11.0];
    const slots = ship.cargoSlots || [];
    for (let bi = 0; bi < 4; bi++) {
      const cx = bayX[bi];
      const slot0 = slots[bi * 2];
      const slot1 = slots[bi * 2 + 1];
      if (!slot0?.active && !slot1?.active) continue;
      items.push({
        wy: cx * sinY,
        draw: () => {
          if (slot0 && slot0.active) {
            drawBox3D(cx - 2.6, cx + 2.6, -5.0, 5.0, 4.5, 7.3, pal.archLight, slot0.color, pal.shipHull);
          }
          if (slot1 && slot1.active) {
            const zBase = (slot0 && slot0.active) ? 7.3 : 4.5;
            drawBox3D(cx - 2.6, cx + 2.6, -4.6, 4.6, zBase, zBase + 2.8, pal.archLight, slot1.color, pal.shipHull);
          }
        }
      });
    }

    items.sort((a, b) => a.wy - b.wy);
    items.forEach(it => it.draw());

    // Bow mast & night port/starboard navigation lights
    if (pal.isNightLights) {
      const pLight = proj(21, -4.2, 5.4);
      const sLight = proj(21, 4.2, 5.4);
      ctx.fillStyle = "#EF4444";
      ctx.beginPath();
      ctx.arc(pLight.x, pLight.y, 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#22C55E";
      ctx.beginPath();
      ctx.arc(sLight.x, sLight.y, 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawSTSGantryCrane(ctx, berth, geom, pal, step) {
    const { bp, tx, ty, inX, inY, shipPt } = berth._geom;
    const legsA = { x: bp.x + inX * 6 - tx * 7, y: bp.y + inY * 6 - ty * 7 };
    const legsB = { x: bp.x + inX * 6 + tx * 7, y: bp.y + inY * 6 + ty * 7 };
    const backA = { x: bp.x + inX * 16 - tx * 7, y: bp.y + inY * 16 - ty * 7 };
    const backB = { x: bp.x + inX * 16 + tx * 7, y: bp.y + inY * 16 + ty * 7 };
    const boomH = 29;
    const apexH = 38;

    const topA = { x: legsA.x, y: legsA.y - boomH };
    const topB = { x: legsB.x, y: legsB.y - boomH };
    const topBackA = { x: backA.x, y: backA.y - boomH };
    const topBackB = { x: backB.x, y: backB.y - boomH };

    // Boom extends from land stack yard (inward 22px) -> out past moored vessel (shipPt outboard)
    const yardAnchor = { x: bp.x + inX * 22, y: bp.y + inY * 22 - boomH };
    const waterTip = { x: shipPt.x + (shipPt.x - bp.x) * 0.48, y: shipPt.y + (shipPt.y - bp.y) * 0.48 - boomH };
    const apexPt = { x: (topA.x + topB.x) * 0.5 + inX * 4, y: (topA.y + topB.y) * 0.5 - (apexH - boomH) };

    ctx.save();
    // Soft crane shadow across quay apron
    ctx.strokeStyle = pal.shadowColor;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(backA.x + 3, backA.y + 3);
    ctx.lineTo(legsA.x + 3, legsA.y + 3);
    ctx.moveTo(backB.x + 3, backB.y + 3);
    ctx.lineTo(legsB.x + 3, legsB.y + 3);
    ctx.stroke();

    // Crane steel leg portal frames (rear pair first)
    ctx.strokeStyle = pal.liveryAccent;
    ctx.lineWidth = 2.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(backA.x, backA.y); ctx.lineTo(topBackA.x, topBackA.y);
    ctx.moveTo(backB.x, backB.y); ctx.lineTo(topBackB.x, topBackB.y);
    ctx.moveTo(topBackA.x, topBackA.y); ctx.lineTo(topBackB.x, topBackB.y);
    ctx.moveTo(topBackA.x, topBackA.y); ctx.lineTo(topA.x, topA.y);
    ctx.moveTo(topBackB.x, topBackB.y); ctx.lineTo(topB.x, topB.y);
    ctx.stroke();

    // Horizontal overhead girder boom & forestay suspension cables
    ctx.strokeStyle = pal.liveryAccent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(yardAnchor.x, yardAnchor.y);
    ctx.lineTo(waterTip.x, waterTip.y);
    ctx.stroke();

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo((topA.x + topB.x) * 0.5, (topA.y + topB.y) * 0.5);
    ctx.lineTo(apexPt.x, apexPt.y);
    ctx.lineTo(waterTip.x, waterTip.y);
    ctx.moveTo(apexPt.x, apexPt.y);
    ctx.lineTo(yardAnchor.x, yardAnchor.y);
    ctx.stroke();

    // Animated sliding trolley + twin hoist cables + yellow spreader bar + lifted 3D container!
    const tFrac = berth._trolleyFrac != null ? berth._trolleyFrac : 0.45;
    const hFrac = berth._hoistDrop != null ? berth._hoistDrop : 0.2;
    const trollX = this._lerp(yardAnchor.x, waterTip.x, tFrac);
    const trollY = this._lerp(yardAnchor.y, waterTip.y, tFrac);
    const cableLen = 6 + hFrac * 18;
    const spY = trollY + cableLen;

    // White/glass crane operator cabin beneath trolley
    ctx.fillStyle = pal.shipSuper;
    ctx.fillRect(trollX - 2.6, trollY - 1.5, 5.2, 3.0);

    // Twin taut hoist cables down to spreader bar
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(trollX - 2.2, trollY + 1.5); ctx.lineTo(trollX - 2.2, spY);
    ctx.moveTo(trollX + 2.2, trollY + 1.5); ctx.lineTo(trollX + 2.2, spY);
    ctx.stroke();

    // Yellow STS container spreader frame
    ctx.fillStyle = "#FACC15";
    ctx.fillRect(trollX - 4.5, spY - 0.8, 9.0, 1.8);

    // Hoisted intermodal shipping container during loaded transfer legs!
    if (berth._carryingBox) {
      ctx.fillStyle = berth.carriedColor || pal.chuteColor;
      ctx.fillRect(trollX - 4.4, spY + 1.0, 8.8, 3.8);
      ctx.fillStyle = pal.archLight;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(trollX - 4.4, spY + 1.0, 8.8, 0.9);
      ctx.globalAlpha = 1;
    }

    // Foreground quay-edge portal legs drawn cleanly in front of trolley
    ctx.strokeStyle = pal.liveryAccent;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(legsA.x, legsA.y); ctx.lineTo(topA.x, topA.y);
    ctx.moveTo(legsB.x, legsB.y); ctx.lineTo(topB.x, topB.y);
    ctx.moveTo(topA.x, topA.y); ctx.lineTo(topB.x, topB.y);
    ctx.stroke();

    // Top A-frame aviation obstruction light + enhanced night quay work spotlights
    const apexPulse = Math.sin(step * 4.2 + berth.idx * 2) > 0;
    ctx.fillStyle = apexPulse ? "#F59E0B" : pal.archLight;
    ctx.beginPath();
    ctx.arc(apexPt.x, apexPt.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (pal.isNightLights || pal.lightIntensity > 0.25) {
      const litI = Math.max(0.45, pal.lightIntensity);
      const axG = ctx.createRadialGradient(apexPt.x, apexPt.y, 0, apexPt.x, apexPt.y, 8);
      axG.addColorStop(0, `rgba(245, 158, 11, ${(0.62 * litI).toFixed(3)})`);
      axG.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = axG;
      ctx.beginPath();
      ctx.arc(apexPt.x, apexPt.y, 8, 0, Math.PI * 2);
      ctx.fill();

      const cone = ctx.createLinearGradient(trollX, trollY, trollX, trollY + 42);
      cone.addColorStop(0, `rgba(254, 240, 182, ${(0.34 * litI).toFixed(3)})`);
      cone.addColorStop(1, "rgba(254, 240, 182, 0)");
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(trollX - 2.5, trollY + 2);
      ctx.lineTo(trollX + 2.5, trollY + 2);
      ctx.lineTo(trollX + 16, trollY + 42);
      ctx.lineTo(trollX - 16, trollY + 42);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  _updateAndDrawPortOps(ctx, w, h, L, pal, dt, step) {
    if (!this.portOps || L.isNarrow) return;
    const xA = L.portWallA.x, yA = L.portWallA.y;
    const xB = L.portWallB.x, yB = L.portWallB.y;
    const dxW = xB - xA;
    const dyW = yB - yA;
    const wallLen = Math.max(1, Math.hypot(dxW, dyW));
    const tx = dxW / wallLen;
    const ty = dyW / wallLen;
    const inX = ty, inY = -tx;
    const outX = -ty, outY = tx;
    const dockHeading = Math.atan2(dyW, dxW); // ~ +0.88 rad along seawall ("front_quarter")

    const smooth5 = t => {
      const c = this._clamp(t, 0, 1);
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    const drawQueue = [];
    for (let i = 0; i < this.portOps.berths.length; i++) {
      const b = this.portOps.berths[i];
      const sh = b.ship;
      const bp = { x: xA + dxW * b.wallFrac, y: yA + dyW * b.wallFrac };
      const berthPt = { x: bp.x + outX * 22, y: bp.y + outY * 22 };
      const holdPt = { x: berthPt.x + outX * 38 - tx * 12, y: berthPt.y + outY * 38 - ty * 12 };
      // Strictly off-screen sea entry & exit coordinates (never appear/disappear on screen)
      const westOff = { x: -135, y: Math.min(h * 0.74, berthPt.y + 18) };
      const southOff = { x: Math.min(w * 0.42, Math.max(w * 0.28, berthPt.x + 115)), y: h + 125 };
      const bayEntry = sh.fromWest ? westOff : southOff;
      const bayExit = sh.fromWest ? southOff : westOff;

      b._geom = { bp, tx, ty, inX, inY, outX, outY, shipPt: berthPt };
      b.t += dt;

      // Update live ship arrival / berthing / crane-servicing / unberthing / 5-angle channel departure
      let shipVisible = true;
      let targetHeading = dockHeading;
      let thrusterIntensity = 0;
      b._trolleyFrac = 0.12;
      b._hoistDrop = 0.08;
      b._carryingBox = false;

      if (b.phase === "servicing") {
        sh.x = berthPt.x;
        sh.y = berthPt.y;
        sh.speed = 0;
        sh.heading = dockHeading;
        targetHeading = dockHeading;

        // Deliberate, realistic gantry crane transfer cycles between deck bay & quay stacks
        const cycRate = 0.14; // ~7.1s per full lift-move-place-return cycle
        const prevCyc = b.cranePhase || 0;
        b.cranePhase = (prevCyc + dt * cycRate);
        if (b.cranePhase >= 1.0) {
          b.cranePhase -= 1.0;
          b.craneCyclesDone = (b.craneCyclesDone || 0) + 1;
          if (b.craneCyclesDone >= b.craneCyclesTarget) {
            b.phase = "unberthing";
            b.t = 0;
            b.phaseDuration = 9.5;
          } else {
            const findNextSlot = (wantActive) => {
              for (let k = 7; k >= 0; k--) {
                if (sh.cargoSlots[k] && sh.cargoSlots[k].active === wantActive) return k;
              }
              return 0;
            };
            b.craneActiveIdx = findNextSlot(b.opMode === "unload");
            b._slotFlippedThisCycle = false;
          }
        }
        const cp = b.cranePhase;
        const isUnload = b.opMode === "unload";
        const srcFrac = isUnload ? 0.80 : 0.14;
        const dstFrac = isUnload ? 0.14 : 0.80;
        if (cp < 0.18) {
          b._trolleyFrac = srcFrac;
          b._hoistDrop = Math.sin((cp / 0.18) * (Math.PI * 0.5)) * 0.85;
          b._carryingBox = false;
        } else if (cp < 0.32) {
          if (!b._slotFlippedThisCycle && isUnload && sh.cargoSlots[b.craneActiveIdx]) {
            b.carriedColor = sh.cargoSlots[b.craneActiveIdx].color;
            sh.cargoSlots[b.craneActiveIdx].active = false;
            b._slotFlippedThisCycle = true;
          }
          b._trolleyFrac = srcFrac;
          b._hoistDrop = 0.85 * (1 - smooth5((cp - 0.18) / 0.14));
          b._carryingBox = true;
        } else if (cp < 0.60) {
          b._trolleyFrac = this._lerp(srcFrac, dstFrac, smooth5((cp - 0.32) / 0.28));
          b._hoistDrop = 0.10;
          b._carryingBox = true;
        } else if (cp < 0.76) {
          const lp = (cp - 0.60) / 0.16;
          if (lp > 0.65 && !b._slotFlippedThisCycle && !isUnload && sh.cargoSlots[b.craneActiveIdx]) {
            sh.cargoSlots[b.craneActiveIdx].active = true;
            sh.cargoSlots[b.craneActiveIdx].color = b.carriedColor;
            b._slotFlippedThisCycle = true;
          }
          b._trolleyFrac = dstFrac;
          b._hoistDrop = lp < 0.65 ? smooth5(lp / 0.65) * 0.85 : 0.85 * (1 - (lp - 0.65) / 0.35);
          b._carryingBox = lp < 0.65;
        } else {
          b._trolleyFrac = this._lerp(dstFrac, srcFrac, smooth5((cp - 0.76) / 0.24));
          b._hoistDrop = 0.12;
          b._carryingBox = false;
        }
      } else if (b.phase === "approaching") {
        // Very calm unhurried harbor approach from strictly off-screen channel
        const ctrl1 = sh.fromWest
          ? { x: Math.max(-40, holdPt.x - 140), y: bayEntry.y + 18 }
          : { x: bayEntry.x - 45, y: Math.min(h * 0.88, holdPt.y + 120) };
        const ctrl2 = { x: holdPt.x - tx * 48 + outX * 14, y: holdPt.y - ty * 48 + outY * 14 };
        const appPath = this._buildArcPath([[bayEntry, ctrl1, ctrl2, holdPt]], 38);
        const f = Math.min(1, b.t / Math.max(2, b.phaseDuration));
        const pEase = smooth5(f);
        const pt = this._sampleArcPath(appPath, appPath.totalLen * pEase);
        sh.x = pt.x;
        sh.y = pt.y;
        sh.speed = (1 - f * 0.78) * 3.4;
        targetHeading = pt.angle;
        sh.heading = this._lerpAngle(sh.heading, targetHeading, 1 - Math.exp(-3.2 * dt));
        if (f >= 1) {
          b.phase = "berthing";
          b.t = 0;
          b.phaseDuration = 15.0;
        }
      } else if (b.phase === "berthing") {
        const rawP = Math.min(1, b.t / Math.max(1, b.phaseDuration));
        const p = smooth5(rawP);
        sh.x = this._lerp(holdPt.x, berthPt.x, p);
        sh.y = this._lerp(holdPt.y, berthPt.y, p);
        sh.speed = 1.1 * (1 - p);
        sh.heading = this._lerpAngle(sh.heading, dockHeading, 1 - Math.exp(-2.4 * dt));
        thrusterIntensity = Math.sin(rawP * Math.PI);
        if (b.t >= b.phaseDuration) {
          b.phase = "servicing";
          b.t = 0;
          b.cranePhase = 0;
          b.craneCyclesDone = 0;
          b._slotFlippedThisCycle = false;
        }
      } else if (b.phase === "unberthing") {
        const rawP = Math.min(1, b.t / Math.max(1, b.phaseDuration));
        const p = smooth5(rawP);
        sh.x = this._lerp(berthPt.x, holdPt.x, p);
        sh.y = this._lerp(berthPt.y, holdPt.y, p);
        sh.speed = 1.1 * p;
        sh.heading = dockHeading;
        thrusterIntensity = Math.sin(rawP * Math.PI);
        if (b.t >= b.phaseDuration) {
          b.phase = "departing";
          b.t = 0;
          b.phaseDuration = this._rand(62.0, 76.0);
        }
      } else if (b.phase === "departing") {
        const ctrl1 = { x: holdPt.x + tx * 34 + outX * 14, y: holdPt.y + ty * 34 + outY * 14 };
        const ctrl2 = sh.fromWest
          ? { x: Math.min(w * 0.40, holdPt.x + 70), y: Math.min(h * 0.90, holdPt.y + 115) }
          : { x: Math.max(-40, holdPt.x - 125), y: bayExit.y + 14 };
        const depPath = this._buildArcPath([[holdPt, ctrl1, ctrl2, bayExit]], 38);
        const f = Math.min(1, b.t / Math.max(2, b.phaseDuration));
        const pEase = smooth5(f);
        const pt = this._sampleArcPath(depPath, depPath.totalLen * pEase);
        sh.x = pt.x;
        sh.y = pt.y;
        sh.speed = 1.0 + f * 3.2;
        targetHeading = pt.angle;
        sh.heading = this._lerpAngle(sh.heading, targetHeading, 1 - Math.exp(-3.0 * dt));
        if (f >= 1) {
          b.phase = "offscreen_wait";
          b.t = 0;
          b.phaseDuration = this._rand(5.0, 9.0);
        }
      } else {
        shipVisible = false;
        if (b.t >= b.phaseDuration) {
          b.phase = "approaching";
          b.t = 0;
          b.phaseDuration = this._rand(58.0, 72.0);
          sh.fromWest = !sh.fromWest;
          b.opMode = b.opMode === "unload" ? "load" : "unload";
          const startFilled = b.opMode === "unload" ? 8 : 3;
          const colors = ["#DC4A4A", "#2A7EB0", "#D97706", "#0D9488", "#64748B", "#C9755A"];
          sh.cargoSlots = sh.cargoSlots.map((_, idx) => ({
            active: idx < startFilled,
            color: colors[(idx + Math.floor(Math.random() * 5)) % colors.length]
          }));
          b.craneActiveIdx = b.opMode === "unload" ? 7 : 3;
          b._slotFlippedThisCycle = false;
          const nextEntry = sh.fromWest ? westOff : southOff;
          sh.x = nextEntry.x;
          sh.y = nextEntry.y;
          sh.heading = sh.fromWest ? 0.18 : -2.05;
          sh.speed = 2.8;
        }
      }

      if (shipVisible) {
        drawQueue.push({ y: sh.y, kind: "ship", berth: b, thrusterIntensity, outX, outY });
      }
      drawQueue.push({ y: bp.y + 4, kind: "crane", berth: b });
    }

    drawQueue.sort((a, b) => a.y - b.y);
    for (let i = 0; i < drawQueue.length; i++) {
      const item = drawQueue[i];
      if (item.kind === "ship") {
        if (item.thrusterIntensity > 0.04) {
          // Subtle lateral bow & stern thruster wash eddies during slow berthing/unberthing
          const sh = item.berth.ship;
          const thAlpha = (item.thrusterIntensity * 0.28).toFixed(3);
          ctx.save();
          ctx.fillStyle = `rgba(224, 242, 254, ${thAlpha})`;
          for (let ti = -1; ti <= 1; ti += 2) {
            const wx = sh.x + Math.cos(sh.heading) * (ti * 18) + item.outX * (10 + Math.sin(step * 4 + ti) * 2.5);
            const wy = sh.y + Math.sin(sh.heading) * (ti * 10) + item.outY * (10 + Math.sin(step * 4 + ti) * 2.5);
            ctx.beginPath();
            ctx.ellipse(wx, wy, 7 * item.thrusterIntensity + 2, 3.2 * item.thrusterIntensity + 1.2, dockHeading, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        this._drawContainerShip5Angle(ctx, item.berth.ship, pal, step, item.berth.ship.scale || 0.94);
      } else {
        this._drawSTSGantryCrane(ctx, item.berth, item.berth._geom, pal, step);
      }
    }
  },

  // Tiny to-scale Apron Ground Support & Highway Commuter Vehicles
  _updateAndDrawGroundVehicles(ctx, w, h, L, pal, dt, step) {
    const apronPath = this._buildArcPath([
      [L.hangarDoorX > 0 ? { x: L.hangarDoorX - 10, y: L.hangarDoorY + 12 } : L.apronEast,
        L.apronEast, L.apronSE, L.apronSouth],
      [L.apronSouth, L.apronSW, { x: L.satWest.x + 12 * L.termScale, y: L.satWest.y + 38 * L.termScale },
        { x: L.satWest.x - 8 * L.termScale, y: L.satWest.y + 24 * L.termScale }]
    ], 24);
    const { abutX, abutY, bridgeStart, bridgeCp, bridgeEnd } = L;
    const southLipY = L.underpassY + L.underpassHalf + 18;
    const northLipY = L.underpassY - L.underpassHalf - 18;
    const plazaPath = this._buildArcPath([
      [bridgeStart, { x: (bridgeStart.x + bridgeCp.x) * 0.5, y: (bridgeStart.y + bridgeCp.y) * 0.5 }, bridgeCp, bridgeEnd],
      [bridgeEnd, { x: abutX - 18, y: abutY - 15 }, { x: L.underpassX + 12, y: southLipY + 12 }, { x: L.underpassX - 4, y: northLipY }],
      [{ x: L.underpassX - 4, y: northLipY }, { x: L.underpassX - 16, y: northLipY - 22 }, { x: L.plazaX + 58 * L.termScale, y: L.plazaY + 24 * L.termScale }, { x: L.plazaX, y: L.plazaY }]
    ], 22);
    const portX_B = L.portWallB.x + 14;
    const portY_B = L.portWallB.y - 10;
    const portX_M = L.portWallA.x + (L.portWallB.x - L.portWallA.x) * 0.56 + 18;
    const portY_M = L.portWallA.y + (L.portWallB.y - L.portWallA.y) * 0.56 - 12;
    const portPath = this._buildArcPath([
      [
        { x: abutX, y: abutY - 11 },
        { x: w * 0.44, y: L.shoreYAtX(w * 0.44) - 11 },
        { x: w * 0.30, y: L.shoreYAtX(w * 0.30) - 11 },
        { x: portX_B, y: portY_B },
        { x: portX_M, y: portY_M }
      ]
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

    const bridgeDock = { x: L.offshoreShoreX + 2 * sc, y: L.offshoreShoreY - 1 };
    const railEnd = { x: centerX, y: deckY };
    const bridgeLen = Math.max(10, Math.hypot(railEnd.x - bridgeDock.x, railEnd.y - bridgeDock.y));
    const ux = (railEnd.x - bridgeDock.x) / bridgeLen;
    const uy = (railEnd.y - bridgeDock.y) / bridgeLen;
    const causewayAng = Math.atan2(uy, ux);
    // Single C1-continuous linear rail track starting concealed inside Shore Hangar (f=0) -> Pad Mount (f=1)!
    const railStart = { x: bridgeDock.x - ux * bodyH, y: bridgeDock.y - uy * bodyH };
    const causewayPos = (frac) => {
      const f = this._clamp(frac, 0, 1);
      return {
        x: this._lerp(railStart.x, railEnd.x, f),
        y: this._lerp(railStart.y, railEnd.y, f),
        tilt: causewayAng,
        flame: 0
      };
    };

    let strongbackRetract = 0.28;
    let delugeAlpha = 0;

    // 1. Tower arm staging offsets (boosters held at +/-13.5*sc waiting on tower arms)
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

      // Twin Symmetric Deck Re-Mating Cranes (West Crane for Port Booster, East Crane for Starboard Booster)
      const craneBoomY = deckY - bodyH * 0.92;
      const westCraneX = centerX - 27 * sc;
      const eastCraneX = centerX + 27 * sc;
      const westTipX = craneFrac > 0.01 ? this._lerp(lzLeftX, centerX - armRestDx, craneFrac) : westCraneX - 10 * sc;
      const eastTipX = craneFrac > 0.01 ? this._lerp(lzRightX, centerX + armRestDx, craneFrac) : eastCraneX + 10 * sc;
      const westTipY = craneBoomY - 8 * sc;
      const eastTipY = craneBoomY - 8 * sc;

      ctx.save();
      ctx.strokeStyle = pal.isNightLights ? "#94A3B8" : pal.archDark;
      ctx.lineWidth = Math.max(1.25, 1.8 * sc);
      ctx.beginPath();
      // West deck crane mast + lattice boom
      ctx.moveTo(westCraneX, deckY);
      ctx.lineTo(westCraneX, craneBoomY);
      ctx.lineTo(westTipX, westTipY);
      // East deck crane mast + lattice boom
      ctx.moveTo(eastCraneX, deckY);
      ctx.lineTo(eastCraneX, craneBoomY);
      ctx.lineTo(eastTipX, eastTipY);
      ctx.stroke();

      // Hydraulic luffing backstays for realism
      ctx.lineWidth = Math.max(0.75, 0.95 * sc);
      ctx.strokeStyle = pal.towerSteel;
      ctx.beginPath();
      ctx.moveTo(westCraneX, craneBoomY - 5 * sc);
      ctx.lineTo(westTipX, westTipY);
      ctx.moveTo(eastCraneX, craneBoomY - 5 * sc);
      ctx.lineTo(eastTipX, eastTipY);
      ctx.stroke();
      ctx.restore();

      // Offshore water deluge cooling jets & mist deck apron during ignition/launch
      if (delugeAlpha > 0.02) {
        ctx.save();
        [-1, 1].forEach(side => {
          ctx.strokeStyle = `rgba(224, 247, 255, ${(0.85 * delugeAlpha).toFixed(3)})`;
          ctx.lineWidth = 1.6 * sc;
          ctx.setLineDash([4 * sc, 2.5 * sc]);
          ctx.lineDashOffset = -step * 34 * sc;
          ctx.beginPath();
          ctx.moveTo(centerX + side * 16 * sc, deckY - 1 * sc);
          ctx.quadraticCurveTo(centerX + side * 7 * sc, deckY - 11 * sc, centerX + side * 2 * sc, deckY + 2 * sc);
          ctx.stroke();
          ctx.setLineDash([]);

          const g = ctx.createRadialGradient(centerX + side * 16 * sc, deckY + 2 * sc, 2, centerX + side * 18 * sc, deckY + 2 * sc, 30 * sc);
          g.addColorStop(0, `rgba(241, 245, 249, ${(0.62 * delugeAlpha).toFixed(3)})`);
          g.addColorStop(1, "rgba(226, 240, 255, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(centerX + side * 18 * sc, deckY + 2 * sc, 30 * sc, 8.5 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // Draw Center Core if present (with tilted heavy-rail flatbed carrier + locomotive bogies anchored strictly at base 0)
      if (corePos) {
        ctx.save();
        if (Math.abs(coreAngle) > 0.15 && corePos.x < bridgeDock.x + 2 * sc) {
          // Clip cleanly at Shore Hangar bay doorway so core glides progressively out without popping in!
          ctx.beginPath();
          ctx.rect(bridgeDock.x - 1, 0, w, L.offshoreShoreY + 55);
          ctx.clip();
        }
        ctx.translate(corePos.x, corePos.y);
        if (Math.abs(coreAngle) > 0.15) {
          ctx.save();
          ctx.rotate(corePos.tilt || 0);
          // Heavy steel rail flatbed frame & multi-axle bogie wheelsets sitting squarely atop viaduct rails [0..bodyH]
          ctx.fillStyle = pal.archDark;
          ctx.fillRect(-2 * sc, 0.5 * sc, bodyH + 6 * sc, 2.6 * sc);
          ctx.fillStyle = pal.towerSteel;
          [0.14 * bodyH, 0.38 * bodyH, 0.62 * bodyH, 0.86 * bodyH].forEach(wx => {
            ctx.beginPath();
            ctx.arc(wx, 3.3 * sc, 1.3 * sc, 0, Math.PI * 2);
            ctx.fill();
          });
          // Lead Industrial Rail Locomotive + glowing headlamp leading uphill ahead of nose toward platform
          ctx.fillStyle = pal.liveryAccent;
          ctx.fillRect(bodyH + 4 * sc, -2.2 * sc, 6.8 * sc, 4.4 * sc);
          ctx.fillStyle = pal.windowGlow;
          ctx.fillRect(bodyH + 8.4 * sc, -1.6 * sc, 1.6 * sc, 1.8 * sc);
          ctx.fillStyle = pal.isNightLights ? "rgba(254, 240, 138, 0.92)" : "rgba(255, 251, 235, 0.72)";
          ctx.beginPath();
          ctx.arc(bodyH + 11.0 * sc, -0.4 * sc, 1.3 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.rotate(coreAngle);
        this._drawFhStage(ctx, pal, bodyW, bodyH, sc, 0, corePos.flame || 0, step, true);
        ctx.restore();
      }
      return { westTipX, westTipY, eastTipX, eastTipY };
    };

    if (r.phase === "core_tow_in") {
      // C1-continuous continuation from 0.45 -> 1.00 along viaduct rails, then smooth base-pivoted erection!
      const p = Math.min(1, r.t / r.phaseDuration);
      let corePos, coreAngle;
      if (p < 0.64) {
        const tp = p / 0.64;
        const smoothEnd = tp < 0.82 ? tp : (0.82 + 0.18 * Math.sin(((tp - 0.82) / 0.18) * Math.PI * 0.5));
        const f = 0.45 + smoothEnd * 0.55;
        corePos = causewayPos(f);
        coreAngle = Math.PI * 0.5 + causewayAng;
      } else {
        const ep = (p - 0.64) / 0.36;
        const ease = ep * ep * (3 - 2 * ep);
        corePos = { x: centerX, y: deckY, tilt: causewayAng, flame: 0 };
        coreAngle = (Math.PI * 0.5 + causewayAng) * (1 - ease);
      }
      r.x = corePos.x;
      r.y = corePos.y;
      r.angle = coreAngle;
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
      // Strictly vertical straight ascent all the way off the top of the frame with zero pitch!
      const p = Math.min(1, r.t / r.phaseDuration);
      strongbackRetract = 1.0;
      delugeAlpha = p < 0.45 ? (1 - p / 0.45) : 0;
      const liftY = Math.pow(p, 2.2) * (deckY + 185);
      r.x = centerX;
      r.y = deckY - liftY;
      r.angle = 0;
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

    // phase === "crane_reattach": Dual symmetric cranes hoist BOTH landed side boosters back while rail car climbs viaduct!
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

    // New main center core emerges smoothly from Shore Hangar bay along viaduct rails (0.00 -> 0.45 matching core_tow_in handoff!)
    const towProg = this._clamp((p - 0.35) / 0.65, 0, 1) * 0.45;
    const towCore = p > 0.35 ? causewayPos(towProg) : null;
    const towAngle = Math.PI * 0.5 + causewayAng;
    r.x = towCore ? towCore.x : railStart.x;
    r.y = towCore ? towCore.y : railStart.y;
    r.angle = towAngle;

    const craneFrac = 0.01 + 0.99 * smoothSwing;
    const craneTips = drawTowerArmsAndCrane({ x: lX, y: lY }, { x: rX, y: rY }, towCore, towAngle, craneFrac, lowerToArm > 0.3);

    if (liftPhase > 0.04) {
      ctx.save();
      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.86)" : pal.towerSteel;
      ctx.lineWidth = Math.max(0.9, 1.2 * sc);
      ctx.beginPath();
      ctx.moveTo(craneTips.westTipX, craneTips.westTipY);
      ctx.lineTo(lX, lY - boosterH - 2 * sc);
      ctx.moveTo(craneTips.eastTipX, craneTips.eastTipY);
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
      r.phaseDuration = 10.5;
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

  // Rare Tandem-Rotor Heavy-Lift Recovery Helicopter Lowering Recovered Crew Capsule into Automated Arched Hangar Roof Hatch!
  _updateAndDrawHeavyHeli(ctx, w, h, L, pal, dt, step) {
    if (L.isNarrow) return;
    const hh = this.heavyHeli;
    if (!hh) return;
    hh.t += dt;
    hh.rotorPhase += dt * 34;

    const sc = L.isNarrow ? 0.85 : 1.15;
    const hatchX = L.hangarX + L.hangarW * 0.04;
    const hatchY = L.hangarY - L.hangarH * 0.40;
    const hoverY = hatchY - 46;
    const entryX = w + 120;
    const entryY = Math.max(46, hoverY - 58);

    let visible = false;
    let showCapsule = false;
    let cableLen = 17 * sc;
    let capsuleTrailX = 0;
    let doorOpenFrac = 0;
    let pitch = 0;
    const facingLeft = true;

    if (hh.phase === "dormant_wait") {
      hh.doorOpenFrac = 0;
      if (hh.t >= hh.phaseDuration) {
        hh.phase = "approach";
        hh.t = 0;
        hh.vx = 0;
        hh.phaseDuration = 10.5;
        hh.x = entryX;
        hh.y = entryY;
      }
      return;
    } else if (hh.phase === "approach") {
      visible = true;
      showCapsule = true;
      const p = Math.min(1, hh.t / hh.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      hh.x = this._lerp(entryX, hatchX, ease);
      hh.y = this._lerp(entryY, hoverY, ease) + Math.sin(step * 2.5) * 1.2;
      capsuleTrailX = 6.5 * (1 - ease);
      pitch = -0.10 * (1 - ease);
      if (p >= 1) {
        hh.phase = "door_open";
        hh.t = 0;
        hh.phaseDuration = 2.6;
      }
    } else if (hh.phase === "door_open") {
      visible = true;
      showCapsule = true;
      cableLen = 16 * sc;
      const p = Math.min(1, hh.t / hh.phaseDuration);
      doorOpenFrac = p * p * (3 - 2 * p);
      hh.x = hatchX + Math.sin(step * 1.8) * 0.8;
      hh.y = hoverY + Math.sin(step * 2.6) * 1.0;
      if (p >= 1) {
        hh.phase = "lower_capsule";
        hh.t = 0;
        hh.phaseDuration = 6.5;
      }
    } else if (hh.phase === "lower_capsule") {
      visible = true;
      showCapsule = true;
      doorOpenFrac = 1.0;
      const p = Math.min(1, hh.t / hh.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      hh.capsuleDropFrac = ease;
      cableLen = 16 * sc + ease * 42;
      hh.x = hatchX + Math.sin(step * 1.7) * 0.6;
      hh.y = hoverY + Math.sin(step * 2.4) * 0.8;
      if (p >= 1) {
        hh.phase = "winch_retract";
        hh.t = 0;
        hh.phaseDuration = 2.8;
      }
    } else if (hh.phase === "winch_retract") {
      visible = true;
      doorOpenFrac = 1.0;
      const p = Math.min(1, hh.t / hh.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      cableLen = (16 * sc + 42) - ease * 44;
      hh.x = hatchX + Math.sin(step * 1.8) * 0.7;
      hh.y = hoverY + Math.sin(step * 2.5) * 1.0;
      if (p >= 1) {
        hh.phase = "door_close";
        hh.t = 0;
        hh.phaseDuration = 2.4;
      }
    } else if (hh.phase === "door_close") {
      visible = true;
      const p = Math.min(1, hh.t / hh.phaseDuration);
      doorOpenFrac = 1.0 - (p * p * (3 - 2 * p));
      hh.x = hatchX;
      hh.y = hoverY + Math.sin(step * 2.4) * 1.0;
      if (p >= 1) {
        hh.phase = "depart";
        hh.t = 0;
        hh.vx = 0;
        hh.vy = 0;
        hh.departTargetY = Math.max(40, hoverY - 52);
        hh.phaseDuration = 24.0;
      }
    } else if (hh.phase === "depart") {
      visible = true;
      const cruiseSpd = L.isNarrow ? 48 : 58;
      hh.vx = this._lerp(hh.vx || 0, -cruiseSpd, Math.min(1, dt * 0.85));
      hh.x += hh.vx * dt;
      hh.y = this._lerp(hh.y, hh.departTargetY || Math.max(40, hoverY - 52), Math.min(1, dt * 0.35));
      pitch = -0.09 * Math.min(1, Math.abs(hh.vx) / cruiseSpd);
      if (hh.x < -140) {
        hh.phase = "dormant_wait";
        hh.t = 0;
        hh.vx = 0;
        hh.phaseDuration = this._rand(65.0, 110.0);
        hh.doorOpenFrac = 0;
        return;
      }
    }

    hh.doorOpenFrac = doorOpenFrac;
    if (!visible) return;

    // 1. Ground/Roof Shadow (underneath over bay/apron during final approach, hover, lower & departure)
    ctx.save();
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.ellipse(hh.x + 10 * pal.sunDir, hatchY + 2, 16 * sc, 5 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Winch Hoist Cable & Conical Heat-Shielded Crew Capsule
    // ONLY clip at the hangar hatch threshold while actively lowering or retracting inside the open roof bay!
    if (hh.phase === "lower_capsule" || hh.phase === "winch_retract" || showCapsule) {
      const shouldClipHatch = hh.phase === "lower_capsule" || hh.phase === "winch_retract";
      ctx.save();
      if (shouldClipHatch) {
        ctx.beginPath();
        ctx.rect(hatchX - 60, 0, 120, hatchY + 5);
        ctx.clip();
      }

      const hookX = hh.x + capsuleTrailX;
      ctx.strokeStyle = pal.towerSteel;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(hh.x, hh.y + 4 * sc);
      ctx.lineTo(hookX, hh.y + cableLen);
      ctx.stroke();

      if (showCapsule) {
        const capY = hh.y + cableLen + 4 * sc;
        const capS = sc * 0.95;
        ctx.save();
        ctx.translate(hookX, capY);
        ctx.rotate(capsuleTrailX * 0.025);
        ctx.scale(capS, capS);
        // Ablative charred heatshield saucer bottom
        ctx.fillStyle = pal.archDark;
        ctx.beginPath();
        ctx.ellipse(0, 4.5, 6.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // White conical crew pressure vessel + recovery orange parachutes strap ring + glowing cabin window
        ctx.fillStyle = pal.bodyLight;
        ctx.beginPath();
        ctx.moveTo(-5.8, 4.2);
        ctx.lineTo(-2.8, -4.5);
        ctx.lineTo(2.8, -4.5);
        ctx.lineTo(5.8, 4.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#F97316";
        ctx.fillRect(-3.2, -4.5, 6.4, 1.8);
        ctx.fillStyle = pal.windowGlow;
        ctx.beginPath();
        ctx.arc(0, 0.2, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // 3. Sikorsky S-64 Skycrane Heavy-Lift Helicopter Body (Open Skeletal Tail Boom & Exposed Twin Turbines)
    ctx.save();
    ctx.translate(hh.x, hh.y);
    ctx.rotate(pitch);
    if (!facingLeft) ctx.scale(-1, 1);
    ctx.scale(sc, sc);

    // Tall wide-straddle spider landing gear struts + winch hoist bracket right under open crane bay
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.lineTo(-11.5, 8.2);
    ctx.moveTo(4.5, -1);
    ctx.lineTo(6.8, 8.2);
    ctx.moveTo(15.5, -2.5);
    ctx.lineTo(17.5, 4.5);
    ctx.stroke();
    ctx.fillStyle = "#1E293B";
    [-11.5, 6.8, 17.5].forEach((wx, wIdx) => {
      ctx.beginPath();
      ctx.arc(wx, wIdx === 2 ? 4.8 : 8.5, wIdx === 2 ? 1.1 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Open skeletal truss tail boom + elevated spine rail (unmistakable Skycrane void above suspended payload!)
    ctx.strokeStyle = "#F97316";
    ctx.lineWidth = 1.45;
    ctx.beginPath();
    ctx.moveTo(-4, -3.8);
    ctx.lineTo(19.5, -3.2);
    ctx.moveTo(-4, -1.0);
    ctx.lineTo(19.5, -2.2);
    ctx.stroke();
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 0.95;
    for (let tx = -2; tx <= 17; tx += 3.8) {
      ctx.beginPath();
      ctx.moveTo(tx, -3.7);
      ctx.lineTo(tx + 2.0, -1.4);
      ctx.lineTo(tx + 3.8, -3.5);
      ctx.stroke();
    }

    // Twin exposed overhead turboshaft engine nacelles (iconic Skycrane dorsal twin pods)
    ctx.fillStyle = pal.bodyLight;
    ctx.beginPath();
    ctx.roundRect(-7.5, -6.8, 10.5, 3.3, 1.4);
    ctx.fill();
    ctx.fillStyle = "#F97316";
    ctx.fillRect(-7.0, -5.2, 9.5, 1.3);
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(-8.3, -6.5, 1.2, 2.6); // Dark front intake
    ctx.fillRect(2.8, -6.2, 2.2, 1.8);  // Exhaust cone

    // Iconic bulbous forward flight cabin + aft-facing crane operator greenhouse bubble
    ctx.fillStyle = "#F97316";
    ctx.beginPath();
    ctx.moveTo(-14.5, 1.2);
    ctx.quadraticCurveTo(-15.5, -4.6, -9.2, -5.2);
    ctx.lineTo(-4.0, -4.8);
    ctx.lineTo(-4.0, 2.2);
    ctx.lineTo(-12.2, 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.bodyLight;
    ctx.fillRect(-11.5, -4.8, 7.2, 2.0);
    // Forward pilot greenhouse & rear crane-operator window facing the suspended capsule
    ctx.fillStyle = pal.windowGlassDark;
    ctx.beginPath();
    ctx.ellipse(-12.2, -1.6, 2.3, 1.9, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-6.2, -1.8, 2.2, 2.6);

    // Tall cantilever vertical tail fin & spinning anti-torque tail rotor
    ctx.fillStyle = "#F97316";
    ctx.beginPath();
    ctx.moveTo(17.5, -3.0);
    ctx.lineTo(21.2, -8.5);
    ctx.lineTo(22.6, -8.3);
    ctx.lineTo(20.0, -2.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.isNightLights ? "rgba(248, 250, 252, 0.65)" : "rgba(51, 65, 85, 0.58)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(21.4, -7.2, 3.2, 0, Math.PI * 2);
    ctx.stroke();

    // Central rotor mast + massive single 6-blade main rotor disc & 3 crossing animated blade pairs
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(-3.4, -10.8, 3.2, 4.4);
    ctx.fillStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.17)" : "rgba(71, 85, 105, 0.17)";
    ctx.beginPath();
    ctx.ellipse(-1.8, -10.8, 20.5, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.isNightLights ? "rgba(248, 250, 252, 0.56)" : "rgba(51, 65, 85, 0.52)";
    ctx.lineWidth = 1.05;
    for (let b = 0; b < 3; b++) {
      const ang = hh.rotorPhase + b * (Math.PI / 3);
      const bx = Math.cos(ang) * 20.5;
      const by = Math.sin(ang) * 2.9;
      ctx.beginPath();
      ctx.moveTo(-1.8 - bx, -10.8 - by);
      ctx.lineTo(-1.8 + bx, -10.8 + by);
      ctx.stroke();
    }

    if (Math.sin(step * 11) > 0.25) {
      ctx.fillStyle = "#F87171";
      ctx.beginPath();
      ctx.arc(-1.8, -11.5, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawComplexLights(ctx, L, pal, step) {
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.4);
    const beaconA = pal.isNightLights ? (0.48 + 0.52 * pulse) : (0.16 + 0.22 * pulse);

    ctx.save();
    const atcTopOff = (L.isNarrow ? 0.72 : 1.05) * 103;
    const beacons = [
      { x: L.towerLeftX, y: L.padY - L.towerH - 14 },
      { x: L.towerRightX, y: L.padY - L.towerH - 14 },
      { x: L.atcX - 5 * (L.isNarrow ? 0.72 : 1.05), y: L.atcY - atcTopOff },
      ...(!L.isNarrow ? [{ x: L.vabX + L.vabW * 0.34, y: L.vabY - L.vabH - 14 }] : [])
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
      // Western Runway Approach Lighting System (ALS) strobing rabbit & threshold bar
      if (!L.isNarrow) {
        const alsSeq = Math.floor(step * 14) % 5;
        for (let ai = 1; ai <= 5; ai++) {
          const p = L.rwPt(-0.016 * ai);
          const flash = (5 - ai) === alsSeq;
          const alsA = (flash ? 0.92 : 0.36) * pal.lightIntensity;
          const r = flash ? 4.8 : 2.8;
          const ag = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          ag.addColorStop(0, `rgba(255, 255, 255, ${alsA.toFixed(3)})`);
          ag.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Harbor Entrance Navigation Beacons & Port Mooring Channel Glows at Night
        if (L.portWallA && L.portWallB) {
          const portNavs = [
            { x: L.portWallA.x - 4, y: L.portWallA.y + 4, rgb: "52, 211, 153" },
            { x: L.portWallB.x + 2, y: L.portWallB.y + 6, rgb: "248, 113, 113" }
          ];
          portNavs.forEach((pn, idx) => {
            const pWave = 0.55 + 0.45 * Math.sin(step * 3.6 + idx * Math.PI);
            const ng = ctx.createRadialGradient(pn.x, pn.y, 0, pn.x, pn.y, 11);
            ng.addColorStop(0, `rgba(${pn.rgb}, ${(pWave * 0.85 * pal.lightIntensity).toFixed(3)})`);
            ng.addColorStop(1, `rgba(${pn.rgb}, 0)`);
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(pn.x, pn.y, 11, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

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

    // High-pressure water deluge cooling arcs from perimeter manifolds into flame trench + foaming trench splash + wide billowing steam
    [-1, 1].forEach(side => {
      const nX = L.padX + side * 27;
      const nY = L.padY - 9;
      for (let j = 0; j < 3; j++) {
        const jSpread = j * 3.2;
        const arcPeak = 18 - j * 3.5 + Math.sin(step * 24 + j * 1.9 + side) * 2.2;
        // High-pressure continuous core stream
        ctx.strokeStyle = `rgba(186, 230, 253, ${((0.86 - j * 0.14) * intensity).toFixed(3)})`;
        ctx.lineWidth = 3.0 - j * 0.45;
        ctx.beginPath();
        ctx.moveTo(nX + side * jSpread, nY + j * 1.6);
        ctx.quadraticCurveTo(L.padX + side * (11 + j * 1.5), nY - arcPeak, L.padX + side * (2 + j * 1.6), L.padY + 2);
        ctx.stroke();

        // Fast-streaming pulsing water droplets along the arc
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${((0.92 - j * 0.12) * intensity).toFixed(3)})`;
        ctx.lineWidth = 2.0 - j * 0.25;
        ctx.setLineDash([7, 4]);
        ctx.lineDashOffset = -step * 58;
        ctx.beginPath();
        ctx.moveTo(nX + side * jSpread, nY + j * 1.6);
        ctx.quadraticCurveTo(L.padX + side * (11 + j * 1.5), nY - arcPeak, L.padX + side * (2 + j * 1.6), L.padY + 2);
        ctx.stroke();
        ctx.restore();
      }

      // Broad billowing lateral supersonic water-quench steam clouds
      const steamG = ctx.createRadialGradient(L.padX + side * 44, L.padY + 4, 6, L.padX + side * 52, L.padY + 4, 96);
      steamG.addColorStop(0, `rgba(248, 250, 252, ${(0.76 * intensity).toFixed(3)})`);
      steamG.addColorStop(0.45, `rgba(224, 242, 254, ${(0.44 * intensity).toFixed(3)})`);
      steamG.addColorStop(1, "rgba(241, 245, 249, 0)");
      ctx.fillStyle = steamG;
      ctx.beginPath();
      ctx.ellipse(L.padX + side * 52, L.padY + 4, 96, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Central foaming cyan-white trench splash bowl + spray droplets
    const trenchG = ctx.createRadialGradient(L.padX, L.padY + 2, 2, L.padX, L.padY + 2, 24);
    trenchG.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * intensity).toFixed(3)})`);
    trenchG.addColorStop(0.55, `rgba(186, 230, 253, ${(0.68 * intensity).toFixed(3)})`);
    trenchG.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = trenchG;
    ctx.beginPath();
    ctx.ellipse(L.padX, L.padY + 2, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let d = 0; d < 10; d++) {
      const da = step * 16 + d * 0.9;
      const sx = L.padX + Math.cos(da) * (6 + (d % 4) * 4.5);
      const sy = L.padY - Math.abs(Math.sin(da * 1.7)) * 12 - 1;
      ctx.fillStyle = `rgba(224, 247, 255, ${(0.82 * intensity).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
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
      // Launch strictly vertically straight off the top of the frame with zero pitching!
      const p = Math.min(1, r.t / r.phaseDuration);
      const towerClearLift = L.towerH * 1.18;
      const liftY = towerClearLift * 0.28 * p + Math.pow(p, 2.35) * (padBaseY + 240);
      r.x = L.padX;
      r.y = padBaseY - liftY;
      r.angle = 0;
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

  // 6-Angle Aerospace & Spaceplane Perspective Engine (with smooth "front_beam" intermediate angle!)
  _quantizeSpaceplanePerspective(heading) {
    let a = ((heading % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const absA = Math.abs(a);
    let perspective, yaw;
    if (absA < Math.PI / 10) {
      perspective = "side_profile";
      yaw = 0;
    } else if (absA > (9 * Math.PI) / 10) {
      perspective = "side_profile";
      yaw = Math.PI;
    } else if (Math.abs(a - Math.PI * 0.5) <= Math.PI / 9) {
      perspective = "front_headon";
      yaw = Math.PI * 0.5;
    } else if (Math.abs(a + Math.PI * 0.5) <= Math.PI / 9) {
      perspective = "rear_tailon";
      yaw = -Math.PI * 0.5;
    } else if (a > 0) {
      if (absA < Math.PI * 0.25 || absA > Math.PI * 0.75) {
        perspective = "front_beam";
        yaw = absA < Math.PI * 0.5 ? 0.46 : Math.PI - 0.46;
      } else {
        perspective = "front_quarter";
        yaw = absA < Math.PI * 0.5 ? 0.98 : Math.PI - 0.98;
      }
    } else {
      perspective = "rear_quarter";
      yaw = a > -Math.PI * 0.5 ? -0.78 : -Math.PI + 0.78;
    }
    return { perspective, yaw };
  },

  _drawSpaceplaneModel(ctx, variant, pal, step, afterburner = 0, altitude = 0, heading = 0, pitchRad = 0) {
    const { perspective, yaw } = this._quantizeSpaceplanePerspective(heading);
    const renderYaw = (perspective === "front_headon" || perspective === "rear_tailon")
      ? yaw
      : this._lerpAngle(yaw, heading, 0.28);
    const cosY = Math.cos(renderYaw);
    const sinY = Math.sin(renderYaw);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const sinE = 0.42;
    const cosE = 0.91;

    // 3D aircraft space (bx=+nose, by=+starboard, bz=+up) -> true 2.5D orthographic camera projection
    const proj = (bx, by, bz) => {
      const rx = bx * cosP - bz * sinP;
      const rz = bx * sinP + bz * cosP;
      const wx = rx * cosY - by * sinY;
      const wy = rx * sinY + by * cosY;
      return { x: wx, y: wy * sinE - rz * cosE, wy };
    };

    const fillPoly3D = (pts, fillStyle, strokeStyle = null, lineWidth = 0.7) => {
      if (!pts || pts.length < 3) return;
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const pr = proj(p[0], p[1], p[2]);
        if (idx === 0) ctx.moveTo(pr.x, pr.y);
        else ctx.lineTo(pr.x, pr.y);
      });
      ctx.closePath();
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    const spec = {
      fighter: {
        noseX: 21, tailX: -14.5, fW: 3.1, fH: 2.3, wingSpan: 14.5, vtailH: 6.2, twinTail: true,
        isMilitary: true, cabinWin: 0, nacY: 2.0,
        halfWing: [[7.5, 2.2, 0.2], [-4.5, 14.5, 0.0], [-11.5, 14.5, 0.0], [-9.5, 3.2, 0.2]],
        darkEdge: [[7.5, 2.2, 0.3], [-4.5, 14.5, 0.1], [-6.5, 14.5, 0.1], [4.5, 2.2, 0.3]]
      },
      bomber: {
        noseX: 19, tailX: -12, fW: 5.5, fH: 2.1, wingSpan: 22.0, vtailH: 0, twinTail: false,
        isMilitary: true, cabinWin: 0, nacY: 4.5,
        halfWing: [[16.5, 0.5, 0.4], [-7.0, 22.0, 0.0], [-14.8, 19.6, 0.0], [-9.5, 9.2, 0.1], [-14.5, 4.2, 0.1], [-11.2, 0.0, 0.3]],
        darkEdge: [[17.0, 0.5, 0.5], [-7.0, 22.0, 0.1], [-9.0, 21.4, 0.1], [13.5, 0.5, 0.5]]
      },
      starliner: {
        noseX: 30, tailX: -24.5, fW: 3.6, fH: 3.8, wingSpan: 17.5, vtailH: 11.4, twinTail: false,
        isMilitary: false, cabinWin: 10, nacY: 8.8,
        halfWing: [[10.5, 2.8, -0.3], [-2.0, 7.6, -0.4], [-12.5, 17.5, -0.4], [-20.0, 16.5, -0.4], [-21.5, 3.0, -0.3]],
        darkEdge: null
      },
      airliner: {
        noseX: 27, tailX: -23.0, fW: 3.4, fH: 3.6, wingSpan: 17.0, vtailH: 10.8, twinTail: false,
        isMilitary: false, cabinWin: 9, nacY: 7.4,
        halfWing: [[8.5, 2.8, -0.4], [-7.5, 17.0, 0.2], [-14.2, 17.0, 0.2], [-10.0, 3.0, -0.4]],
        darkEdge: null
      },
      clipper: {
        noseX: 22, tailX: -15.5, fW: 4.4, fH: 2.6, wingSpan: 13.0, vtailH: 7.2, twinTail: false,
        isMilitary: false, cabinWin: 5, nacY: 3.4,
        halfWing: [[11.0, 3.2, 0.0], [-6.8, 13.0, 0.0], [-14.8, 11.4, 0.0], [-13.2, 3.6, 0.0]],
        darkEdge: null
      },
      shuttle: {
        noseX: 16.5, tailX: -14.5, fW: 3.8, fH: 3.6, wingSpan: 14.5, vtailH: 11.8, twinTail: false,
        isMilitary: false, cabinWin: 0, nacY: 2.5,
        halfWing: [[5.5, 3.2, -0.4], [-1.0, 6.2, -0.4], [-9.8, 14.5, -0.4], [-14.2, 13.2, -0.4], [-14.2, 3.2, -0.4]],
        darkEdge: [[5.5, 3.2, -0.3], [-9.8, 14.5, -0.3], [-11.5, 14.0, -0.3], [3.5, 3.2, -0.3]]
      }
    }[variant] || {
      noseX: 16.5, tailX: -14.5, fW: 3.8, fH: 3.6, wingSpan: 14.5, vtailH: 11.8, twinTail: false,
      isMilitary: false, cabinWin: 0, nacY: 2.5,
      halfWing: [[5.5, 3.2, -0.4], [-9.8, 14.5, -0.4], [-14.2, 13.2, -0.4], [-14.2, 3.2, -0.4]],
      darkEdge: null
    };

    const topCol = spec.isMilitary ? pal.militaryBody : pal.bodyLight;
    const midCol = spec.isMilitary ? pal.militaryBody : pal.bodyMid;
    const shadeCol = spec.isMilitary ? pal.militaryShade : pal.bodyShade;
    const shadowFade = Math.max(0.12, 1 - altitude / 95);

    // 1. Foreshortened Ground Cast Shadow (symmetrical ellipse projected along dynamic solar/lunar direction)
    const sunOffX = pal.sunDir * (2.2 + altitude * 0.18);
    const sunOffY = 3.2 + altitude * 0.56;
    const noseS = proj(spec.noseX * 0.85, 0, -spec.fH * 0.5);
    const tailS = proj(spec.tailX * 0.9, 0, -spec.fH * 0.5);
    const lwS = proj(-4, -spec.wingSpan * 0.85, -spec.fH * 0.5);
    const rwS = proj(-4, spec.wingSpan * 0.85, -spec.fH * 0.5);
    ctx.save();
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.44 * shadowFade;
    ctx.beginPath();
    ctx.moveTo(noseS.x + sunOffX, noseS.y + sunOffY);
    ctx.lineTo(lwS.x + sunOffX, lwS.y + sunOffY);
    ctx.lineTo(tailS.x + sunOffX, tailS.y + sunOffY);
    ctx.lineTo(rwS.x + sunOffX, rwS.y + sunOffY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const nearSide = cosY >= 0 ? 1 : -1;
    const farSide = -nearSide;

    const drawWing = (side) => {
      const mPts = spec.halfWing.map(([bx, by, bz]) => [bx, by * side, bz]);
      const col = side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon" ? shadeCol : topCol;
      fillPoly3D(mPts, col, shadeCol, 0.55);
      if (spec.darkEdge) {
        const dPts = spec.darkEdge.map(([bx, by, bz]) => [bx, by * side, bz]);
        fillPoly3D(dPts, pal.archDark);
      }
      // Underwing cryo/turbojet nacelles for airliner & starliner
      if (variant === "starliner" || variant === "airliner") {
        const ny = spec.nacY * side;
        const pN = proj(-9.5, ny, -0.8);
        const pT = proj(-18.5, ny, -0.8);
        ctx.strokeStyle = pal.archDark;
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(pN.x, pN.y);
        ctx.lineTo(pT.x, pT.y);
        ctx.stroke();
        if (afterburner > 0.05) {
          const fl = (15 + Math.sin(step * 42) * 3) * afterburner;
          const pEx = proj(-18.5 - fl, ny, -0.8);
          const g = ctx.createLinearGradient(pT.x, pT.y, pEx.x, pEx.y);
          g.addColorStop(0, "rgba(255, 252, 240, 0.92)");
          g.addColorStop(0.5, "rgba(56, 189, 248, 0.72)");
          g.addColorStop(1, "rgba(249, 115, 22, 0)");
          ctx.strokeStyle = g;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(pT.x, pT.y);
          ctx.lineTo(pEx.x, pEx.y);
          ctx.stroke();
        }
      }
      // Wingtip navigation strobes (Port = Red, Starboard = Emerald Green)
      if (Math.sin(step * 12) > 0.25) {
        const tipPt = proj(-10.5, spec.wingSpan * 0.94 * side, 0.2);
        ctx.fillStyle = side < 0 ? "#ef4444" : "#34d399";
        ctx.beginPath();
        ctx.arc(tipPt.x, tipPt.y, 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawAfterburner = () => {
      if (afterburner <= 0.05) return;
      const fl = (19 + Math.sin(step * 45) * 4) * afterburner;
      const pT = proj(spec.tailX, 0, 0.3);
      const pEx = proj(spec.tailX - fl, 0, 0.3);
      const g = ctx.createLinearGradient(pT.x, pT.y, pEx.x, pEx.y);
      g.addColorStop(0, "rgba(255, 252, 240, 0.96)");
      g.addColorStop(0.45, "rgba(56, 189, 248, 0.78)");
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pT.x, pT.y);
      ctx.lineTo(pEx.x, pEx.y);
      ctx.stroke();
      ctx.lineCap = "butt";
    };

    const drawVerticalTail = () => {
      if (spec.vtailH <= 0) return;
      if (spec.twinTail) {
        [-3.0, 3.0].forEach(ty => {
          const cant = ty > 0 ? 1.4 : -1.4;
          fillPoly3D([
            [-6.5, ty, spec.fH * 0.35],
            [-12.8, ty + cant, spec.vtailH],
            [-14.8, ty + cant, spec.vtailH * 0.92],
            [-13.5, ty, spec.fH * 0.2]
          ], shadeCol, pal.archDark, 0.5);
        });
      } else {
        fillPoly3D([
          [spec.tailX + 10.5, 0, spec.fH * 0.58],
          [spec.tailX - 0.5, 0, spec.vtailH],
          [spec.tailX - 3.0, 0, spec.vtailH * 0.92],
          [spec.tailX + 1.5, 0, spec.fH * 0.2]
        ], spec.isMilitary ? shadeCol : topCol, shadeCol, 0.55);
      }
    };

    const drawFuselage = () => {
      const fNose = spec.noseX;
      const fMid = spec.noseX * 0.42;
      const fAft = spec.tailX + 4.5;
      const fTail = spec.tailX;
      const w = spec.fW;
      const h = spec.fH;

      // Strictly symmetric 3D port (-w) & starboard (+w) faceted hull (zero head-on/tail-on asymmetry!)
      const bellySides = perspective === "front_headon" || perspective === "rear_tailon" ? [-1, 1] : [nearSide, farSide];
      bellySides.forEach(side => {
        fillPoly3D([
          [fNose, 0, 0],
          [fMid, side * w * 0.90, 0],
          [fAft, side * w * 0.84, 0],
          [fTail, 0, -h * 0.15],
          [fAft, 0, -h * 0.62],
          [fMid, 0, -h * 0.65]
        ], side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon" ? midCol : shadeCol);
      });

      // Upper starboard & port crown facets
      [-1, 1].forEach(side => {
        const isLitSide = perspective === "front_headon" || perspective === "rear_tailon" ? (side < 0) : (side === nearSide);
        fillPoly3D([
          [fNose, 0, 0.1],
          [fMid, 0, h],
          [fAft, 0, h * 0.92],
          [fTail, 0, h * 0.36],
          [fAft, side * w * 0.84, 0],
          [fMid, side * w * 0.90, 0]
        ], isLitSide ? topCol : midCol);
      });

      // Livery accent & glowing passenger cabin windows along visible flank
      if (!spec.isMilitary && (perspective === "side_profile" || perspective === "front_beam" || perspective === "front_quarter" || perspective === "rear_quarter")) {
        const s0 = proj(fMid * 1.15, nearSide * w * 0.82, h * 0.08);
        const s1 = proj(fAft + 2, nearSide * w * 0.76, h * 0.05);
        ctx.strokeStyle = pal.liveryAccent;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();

        if (spec.cabinWin > 0) {
          ctx.fillStyle = pal.windowGlow;
          for (let wi = 0; wi < spec.cabinWin; wi++) {
            const wbx = fMid * 1.05 - wi * ((fMid - fAft - 3) / Math.max(1, spec.cabinWin - 1));
            const wp = proj(wbx, nearSide * w * 0.78, h * 0.32);
            ctx.fillRect(wp.x - 0.7, wp.y - 0.5, 1.4, 1.0);
          }
        }
      }

      // Flight deck cockpit windshield (visible head-on, quarter-front, and side profile!)
      if (perspective !== "rear_tailon") {
        fillPoly3D([
          [fNose * 0.78, 0, h * 0.52],
          [fNose * 0.62, -w * 0.44, h * 0.76],
          [fNose * 0.54, 0, h * 0.95],
          [fNose * 0.62, w * 0.44, h * 0.76]
        ], pal.windowGlow);
      }

      // Shuttle black thermal nosecone + tail RCS engine bells on rear_tailon
      if (variant === "shuttle") {
        fillPoly3D([
          [fNose, 0, 0.1],
          [fNose * 0.84, -w * 0.45, h * 0.35],
          [fNose * 0.84, w * 0.45, h * 0.35]
        ], pal.archDark);
      }
      if (perspective === "rear_tailon" || perspective === "rear_quarter") {
        [-1.3, 1.3].forEach(ey => {
          const ep = proj(fTail - 0.4, ey, 0.1);
          ctx.fillStyle = pal.archDark;
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 1.45, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };

    // Painter's depth order across all 5 canonical perspectives
    if (perspective === "front_headon") {
      drawAfterburner();
      drawVerticalTail();
      drawWing(-1);
      drawWing(1);
      drawFuselage();
    } else if (perspective === "rear_tailon") {
      drawFuselage();
      drawWing(-1);
      drawWing(1);
      drawAfterburner();
      drawVerticalTail();
    } else if (perspective === "front_quarter" || perspective === "front_beam") {
      drawAfterburner();
      drawWing(farSide);
      drawFuselage();
      drawVerticalTail();
      drawWing(nearSide);
    } else {
      // side_profile & rear_quarter
      drawWing(farSide);
      drawAfterburner();
      drawFuselage();
      drawVerticalTail();
      drawWing(nearSide);
    }
  },

  _isRunwayBusy(excludingCraft) {
    const busyPhases = new Set(["runway_takeoff", "approach", "chute_rollout", "lineup_hold"]);
    if (excludingCraft !== this.megaliner && this.megaliner && (this.megaliner.phase === "approach" || this.megaliner.phase === "rollout")) {
      return true;
    }
    return this.spaceplanes.some(other => other !== excludingCraft && busyPhases.has(other.phase));
  },

  // Colossal Multi-Deck & Blended-Wing Sci-Fi Mega-Liner Rendering (2.5D 6-Perspective Symmetrical Airplane Model + Vertical Booster Launch!)
  _drawMegaLinerModel(ctx, pal, step, afterburner = 0, altitude = 0, isVertical = false, externalBoosters = 0, heading = 0, pitchRad = 0, variant = "double_deck") {
    if (variant === "blended_wing") {
      if (!isVertical) {
        const { perspective, yaw } = this._quantizeSpaceplanePerspective(heading);
        const renderYaw = (perspective === "front_headon" || perspective === "rear_tailon")
          ? yaw
          : this._lerpAngle(yaw, heading, 0.28);
        const cosY = Math.cos(renderYaw);
        const sinY = Math.sin(renderYaw);
        const cosP = Math.cos(pitchRad);
        const sinP = Math.sin(pitchRad);
        const sinE = 0.42;
        const cosE = 0.91;

        const proj = (bx, by, bz) => {
          const rx = bx * cosP - bz * sinP;
          const rz = bx * sinP + bz * cosP;
          const wx = rx * cosY - by * sinY;
          const wy = rx * sinY + by * cosY;
          return { x: wx, y: wy * sinE - rz * cosE };
        };

        const fillPoly3D = (pts, fillStyle, strokeStyle = null, lineWidth = 0.65) => {
          ctx.fillStyle = fillStyle;
          ctx.beginPath();
          pts.forEach((p, idx) => {
            const pr = proj(p[0], p[1], p[2]);
            if (idx === 0) ctx.moveTo(pr.x, pr.y);
            else ctx.lineTo(pr.x, pr.y);
          });
          ctx.closePath();
          ctx.fill();
          if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
          }
        };

        // Symmetrical 4-corner foreshortened ground cast shadow for wide BWB silhouette
        const shadowFade = Math.max(0.10, 1 - altitude / 110);
        const sunOffX = pal.sunDir * (3.0 + altitude * 0.2);
        const sunOffY = 5.0 + altitude * 0.54;
        const noseS = proj(38, 0, -4);
        const tailS = proj(-31, 0, -4);
        const lwS = proj(-16, -34.5, -4);
        const rwS = proj(-16, 34.5, -4);
        ctx.save();
        ctx.fillStyle = pal.shadowColor;
        ctx.globalAlpha = 0.48 * shadowFade;
        ctx.beginPath();
        ctx.moveTo(noseS.x + sunOffX, noseS.y + sunOffY);
        ctx.lineTo(lwS.x + sunOffX, lwS.y + sunOffY);
        ctx.lineTo(tailS.x + sunOffX, tailS.y + sunOffY);
        ctx.lineTo(rwS.x + sunOffX, rwS.y + sunOffY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        const nearSide = cosY >= 0 ? 1 : -1;
        const farSide = -nearSide;

        const drawBwbOuterWing = (side) => {
          const isFar = side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon";
          // Swept outer wing panel smoothly continuing the blended centerbody chord
          fillPoly3D([
            [14.5, 14.0 * side, -0.1],
            [2.0, 23.0 * side, -0.2],
            [-13.0, 34.5 * side, -0.3],
            [-25.5, 32.8 * side, -0.3],
            [-27.0, 14.0 * side, -0.2]
          ], isFar ? pal.bodyShade : pal.bodyLight, pal.bodyShade, 0.65);

          // Dark carbon thermal leading-edge cuff
          fillPoly3D([
            [14.5, 14.0 * side, 0.0],
            [2.0, 23.0 * side, -0.1],
            [-13.0, 34.5 * side, -0.2],
            [-15.6, 34.0 * side, -0.2],
            [-0.2, 22.4 * side, -0.1],
            [11.8, 13.8 * side, 0.0]
          ], pal.archDark);

          // Subtle swept wing livery stripe
          const ls0 = proj(6.0, 16.5 * side, 0.05);
          const ls1 = proj(-20.0, 30.8 * side, -0.15);
          ctx.strokeStyle = pal.liveryAccent;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(ls0.x, ls0.y);
          ctx.lineTo(ls1.x, ls1.y);
          ctx.stroke();

          // Canted Outboard Wingtip Vertical Tail Stabilizer (tailless BWB twin fins)
          fillPoly3D([
            [-13.5, 33.8 * side, -0.2],
            [-23.5, 36.2 * side, 8.8],
            [-27.5, 35.8 * side, 8.0],
            [-25.5, 32.8 * side, -0.2]
          ], pal.bodyMid, pal.bodyShade, 0.55);

          const wt0 = proj(-22.5, 35.8 * side, 7.6);
          const wt1 = proj(-26.4, 35.5 * side, 6.9);
          ctx.strokeStyle = pal.liveryAccent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(wt0.x, wt0.y);
          ctx.lineTo(wt1.x, wt1.y);
          ctx.stroke();

          // Navigation wingtip strobes (Port = Red, Starboard = Green)
          if (Math.sin(step * 10) > 0.2) {
            const tip = proj(-24.8, 34.8 * side, -0.1);
            ctx.fillStyle = side < 0 ? "#F87171" : "#34D399";
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        };

        const drawBwbCenterbody = () => {
          const bellySides = perspective === "front_headon" || perspective === "rear_tailon" ? [-1, 1] : [nearSide, farSide];
          // 1. Wide sculpted lower belly lifting hull (strict bilateral symmetry)
          bellySides.forEach(side => {
            const col = side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon" ? pal.bodyMid : pal.bodyShade;
            fillPoly3D([
              [38.0, 0, 0.0],
              [24.0, side * 9.6, -0.1],
              [14.5, side * 14.2, -0.2],
              [-14.0, side * 14.6, -0.3],
              [-27.0, side * 14.0, -0.2],
              [-32.0, 0, -0.5],
              [-22.0, 0, -3.5],
              [14.0, 0, -4.0]
            ], col);
          });

          // 2. Sculpted upper BWB lifting centerbody crown (outer shoulder blend + inner dorsal cabin deck)
          [-1, 1].forEach(side => {
            const isLit = perspective === "front_headon" || perspective === "rear_tailon" ? (side < 0) : (side === nearSide);
            // Outer blended wing-root fairing
            fillPoly3D([
              [38.0, 0, 0.3],
              [26.0, side * 5.2, 3.2],
              [13.5, side * 7.6, 3.8],
              [-15.0, side * 7.4, 3.1],
              [-26.0, side * 5.6, 1.7],
              [-32.0, 0, 1.4],
              [-27.0, side * 14.0, -0.1],
              [-14.0, side * 14.6, -0.2],
              [14.5, side * 14.2, -0.1],
              [24.0, side * 9.6, 0.0]
            ], isLit ? pal.bodyMid : pal.bodyShade);

            // Upper blended passenger cabin dome
            fillPoly3D([
              [38.0, 0, 0.4],
              [20.0, 0, 6.3],
              [-4.0, 0, 5.9],
              [-22.0, 0, 4.3],
              [-32.0, 0, 1.5],
              [-26.0, side * 5.6, 1.7],
              [-15.0, side * 7.4, 3.1],
              [13.5, side * 7.6, 3.8],
              [26.0, side * 5.2, 3.2]
            ], isLit ? pal.bodyLight : pal.bodyMid);

            // Swept leading-edge dark thermal shield fairing on forward blended edge
            fillPoly3D([
              [38.0, 0, 0.2],
              [24.0, side * 9.6, 0.0],
              [14.5, side * 14.2, -0.1],
              [11.8, side * 13.8, 0.0],
              [21.6, side * 9.0, 0.3],
              [35.2, 0, 0.4]
            ], pal.archDark);

            // Livery trim hugging blended shoulder ridge
            if (isLit || perspective === "front_headon") {
              const s0 = proj(29.0, side * 4.4, 2.2);
              const s1 = proj(16.0, side * 10.6, 1.8);
              const s2 = proj(-20.0, side * 10.4, 1.5);
              ctx.strokeStyle = pal.liveryAccent;
              ctx.lineWidth = 1.3;
              ctx.beginPath();
              ctx.moveTo(s0.x, s0.y);
              ctx.lineTo(s1.x, s1.y);
              ctx.lineTo(s2.x, s2.y);
              ctx.stroke();
            }
          });

          // 3. Panoramic Forward-Leading-Edge Passenger Cabin Windows + Centered Flush Bridge Windshield
          const winSides = (perspective === "front_headon" || perspective === "rear_tailon") ? [-1, 1] : [nearSide];
          if (perspective !== "rear_tailon") {
            ctx.fillStyle = pal.windowGlow;
            winSides.forEach(side => {
              for (let wi = 0; wi < 8; wi++) {
                const f = wi / 7;
                const wbx = 29.5 - f * 15.5;
                const wby = side * (3.6 + f * 9.2);
                const wpTop = proj(wbx, wby, 2.9 - f * 1.1);
                const wpLow = proj(wbx + 0.5, side * (3.9 + f * 9.4), 1.6 - f * 0.7);
                ctx.fillRect(wpTop.x - 0.85, wpTop.y - 0.45, 1.7, 0.9);
                ctx.fillRect(wpLow.x - 0.75, wpLow.y - 0.4, 1.5, 0.8);
              }
            });

            // Flush BWB Command Flight Deck Glass
            fillPoly3D([
              [34.5, 0, 2.5],
              [29.5, -5.0, 4.1],
              [26.5, 0, 5.1],
              [29.5, 5.0, 4.1]
            ], pal.windowGlow);
          }
        };

        const drawBwbDorsalEngines = () => {
          // Triple Recessed Over-Wing Dorsal Propulsion Nacelles atop the aft centerbody deck
          const podYs = perspective === "front_headon" || perspective === "rear_tailon"
            ? [-7.8, 7.8, 0]
            : [farSide * 7.8, 0, nearSide * 7.8];
          podYs.forEach(ny => {
            // Structural intake pylon anchored into upper aft deck
            fillPoly3D([
              [-15.5, ny - 0.9, 3.3],
              [-26.5, ny - 0.9, 2.1],
              [-26.5, ny - 0.9, 5.0],
              [-15.5, ny - 0.9, 5.6]
            ], pal.archDark);
            fillPoly3D([
              [-15.5, ny + 0.9, 3.3],
              [-26.5, ny + 0.9, 2.1],
              [-26.5, ny + 0.9, 5.0],
              [-15.5, ny + 0.9, 5.6]
            ], pal.towerSteel);

            // Top & side nacelle cowling barrel
            fillPoly3D([
              [-13.5, ny - 2.1, 6.8],
              [-28.2, ny - 1.9, 6.2],
              [-28.2, ny + 1.9, 6.2],
              [-13.5, ny + 2.1, 6.8]
            ], pal.bodyLight, pal.towerSteel, 0.5);
            const nP0 = proj(-13.5, ny, 5.8);
            const nP1 = proj(-28.4, ny, 5.2);
            ctx.strokeStyle = pal.towerSteel;
            ctx.lineWidth = 3.8;
            ctx.beginPath();
            ctx.moveTo(nP0.x, nP0.y);
            ctx.lineTo(nP1.x, nP1.y);
            ctx.stroke();

            // Nozzle rim collar
            const nCol = proj(-28.6, ny, 5.2);
            ctx.fillStyle = pal.archDark;
            ctx.beginPath();
            ctx.arc(nCol.x, nCol.y, 1.8, 0, Math.PI * 2);
            ctx.fill();

            if (afterburner > 0.04) {
              const fl = (26 + Math.sin(step * 42 + ny) * 5) * afterburner;
              const pEx = proj(-28.6 - fl, ny, 5.2);
              const eg = ctx.createLinearGradient(nCol.x, nCol.y, pEx.x, pEx.y);
              eg.addColorStop(0, `rgba(${pal.plumeCore}, 0.96)`);
              eg.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.84)`);
              eg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
              ctx.strokeStyle = eg;
              ctx.lineWidth = 3.1;
              ctx.beginPath();
              ctx.moveTo(nCol.x, nCol.y);
              ctx.lineTo(pEx.x, pEx.y);
              ctx.stroke();
            }
          });
        };

        if (perspective === "front_headon") {
          drawBwbOuterWing(-1);
          drawBwbOuterWing(1);
          drawBwbCenterbody();
          drawBwbDorsalEngines();
        } else if (perspective === "rear_tailon") {
          drawBwbCenterbody();
          drawBwbOuterWing(-1);
          drawBwbOuterWing(1);
          drawBwbDorsalEngines();
        } else {
          drawBwbOuterWing(farSide);
          drawBwbCenterbody();
          drawBwbDorsalEngines();
          drawBwbOuterWing(nearSide);
        }
        return;
      }

      // === BLENDED-WING VERTICAL CRADLE & LAUNCH VIEW (Strict Mirror Symmetry + External Cryogenic Booster Tanks) ===
      if (externalBoosters > 0.02) {
        const dxSlide = (1 - Math.min(1, externalBoosters)) * 28;
        [-1, 1].forEach(side => {
          const py = side * (20.5 + dxSlide);
          if (afterburner > 0.04) {
            const bfl = (36 + Math.sin(step * 38 + side) * 5) * afterburner;
            const bg = ctx.createLinearGradient(-29, py, -29 - bfl, py);
            bg.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
            bg.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.88)`);
            bg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.moveTo(-29, py - 3.6);
            ctx.lineTo(-29 - bfl, py);
            ctx.lineTo(-29, py + 3.6);
            ctx.closePath();
            ctx.fill();
          }
          ctx.strokeStyle = pal.towerSteel;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-6, py);
          ctx.lineTo(-6, side * 12);
          ctx.moveTo(11, py);
          ctx.lineTo(11, side * 11);
          ctx.stroke();

          ctx.fillStyle = pal.liveryAccent;
          ctx.beginPath();
          ctx.roundRect(-27, py - 4.0, 50, 8.0, 2.2);
          ctx.fill();
          ctx.fillStyle = pal.bodyLight;
          ctx.fillRect(-16, py - 3.6, 28, 2.2);
          ctx.beginPath();
          ctx.moveTo(23, py - 3.8);
          ctx.lineTo(31, py);
          ctx.lineTo(23, py + 3.8);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = pal.archDark;
          ctx.fillRect(-30, py - 3.2, 3.5, 6.4);
        });
      }

      // Triple dorsal aft propulsion plumes
      if (afterburner > 0.04) {
        const fl = (34 + Math.sin(step * 42) * 6) * afterburner;
        [-7.8, 0, 7.8].forEach(py => {
          const g = ctx.createLinearGradient(-30, py, -30 - fl, py);
          g.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
          g.addColorStop(0.42, `rgba(${pal.plumeMid}, 0.86)`);
          g.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-29, py - 2.3);
          ctx.lineTo(-30 - fl, py);
          ctx.lineTo(-29, py + 2.3);
          ctx.closePath();
          ctx.fill();
        });
      }

      // Symmetrical Manta Blended-Wing Body + Swept Outer Wings Planform
      const bG = ctx.createLinearGradient(0, -35, 0, 35);
      bG.addColorStop(0, pal.bodyLight);
      bG.addColorStop(0.5, pal.bodyMid);
      bG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = bG;
      ctx.beginPath();
      ctx.moveTo(38, 0);
      ctx.quadraticCurveTo(26, -12.5, 14, -14.2);
      ctx.lineTo(-13, -34.5);
      ctx.lineTo(-25.5, -32.8);
      ctx.lineTo(-27.0, -14.2);
      ctx.lineTo(-32.0, 0);
      ctx.lineTo(-27.0, 14.2);
      ctx.lineTo(-25.5, 32.8);
      ctx.lineTo(-13, 34.5);
      ctx.lineTo(14, 14.2);
      ctx.quadraticCurveTo(26, 12.5, 38, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.bodyShade;
      ctx.lineWidth = 0.7;
      ctx.stroke();

      // Dark carbon leading edge chevrons
      ctx.strokeStyle = pal.archDark;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-13, -34.0);
      ctx.lineTo(14, -14.0);
      ctx.quadraticCurveTo(26, -12.2, 37.5, 0);
      ctx.quadraticCurveTo(26, 12.2, 14, 14.0);
      ctx.lineTo(-13, 34.0);
      ctx.stroke();

      // Symmetrical central lifting-body dorsal ridge & livery stripes
      ctx.fillStyle = pal.liveryAccent;
      ctx.beginPath();
      ctx.moveTo(27, -4.6);
      ctx.lineTo(15, -10.8);
      ctx.lineTo(-22, -10.8);
      ctx.lineTo(-22, -9.4);
      ctx.lineTo(14.5, -9.4);
      ctx.lineTo(26, -3.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(27, 4.6);
      ctx.lineTo(15, 10.8);
      ctx.lineTo(-22, 10.8);
      ctx.lineTo(-22, 9.4);
      ctx.lineTo(14.5, 9.4);
      ctx.lineTo(26, 3.5);
      ctx.closePath();
      ctx.fill();

      // Twin symmetrical outboard winglet stabilizer fins
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-26.5, -35.8, 12, 3.2);
      ctx.fillRect(-26.5, 32.6, 12, 3.2);

      // Triple dorsal aft engine nacelles mounted at py = [-7.8, 0, 7.8]
      [-7.8, 0, 7.8].forEach(py => {
        ctx.fillStyle = pal.towerSteel;
        ctx.beginPath();
        ctx.roundRect(-29, py - 2.3, 14.5, 4.6, 1.4);
        ctx.fill();
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(-30.2, py - 1.8, 2.2, 3.6);
      });

      // Panoramic curved leading-edge multi-deck cabin windows & centered bridge glass
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(30.5, -1.9, 4.6, 3.8);
      [-1, 1].forEach(side => {
        for (let wi = 0; wi < 7; wi++) {
          const f = wi / 6;
          const wx = 29.0 - f * 14.0;
          const wy = side * (4.0 + f * 7.8);
          ctx.fillRect(wx, wy - 0.55, 1.7, 1.1);
        }
      });

      if (Math.sin(step * 10) > 0.2) {
        ctx.fillStyle = "#F87171";
        ctx.beginPath();
        ctx.arc(-24.8, -34.2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#34D399";
        ctx.beginPath();
        ctx.arc(-24.8, 34.2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (!isVertical) {
      const { perspective, yaw } = this._quantizeSpaceplanePerspective(heading);
      const renderYaw = (perspective === "front_headon" || perspective === "rear_tailon")
        ? yaw
        : this._lerpAngle(yaw, heading, 0.28);
      const cosY = Math.cos(renderYaw);
      const sinY = Math.sin(renderYaw);
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const sinE = 0.42;
      const cosE = 0.91;

      const proj = (bx, by, bz) => {
        const rx = bx * cosP - bz * sinP;
        const rz = bx * sinP + bz * cosP;
        const wx = rx * cosY - by * sinY;
        const wy = rx * sinY + by * cosY;
        return { x: wx, y: wy * sinE - rz * cosE };
      };

      const fillPoly3D = (pts, fillStyle, strokeStyle = null, lineWidth = 0.65) => {
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        pts.forEach((p, idx) => {
          const pr = proj(p[0], p[1], p[2]);
          if (idx === 0) ctx.moveTo(pr.x, pr.y);
          else ctx.lineTo(pr.x, pr.y);
        });
        ctx.closePath();
        ctx.fill();
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      };

      // Symmetrical 4-corner foreshortened ground cast shadow
      const shadowFade = Math.max(0.10, 1 - altitude / 110);
      const sunOffX = pal.sunDir * (2.8 + altitude * 0.2);
      const sunOffY = 4.8 + altitude * 0.54;
      const noseS = proj(36, 0, -4);
      const tailS = proj(-30, 0, -4);
      const lwS = proj(-16, -27, -4);
      const rwS = proj(-16, 27, -4);
      ctx.save();
      ctx.fillStyle = pal.shadowColor;
      ctx.globalAlpha = 0.48 * shadowFade;
      ctx.beginPath();
      ctx.moveTo(noseS.x + sunOffX, noseS.y + sunOffY);
      ctx.lineTo(lwS.x + sunOffX, lwS.y + sunOffY);
      ctx.lineTo(tailS.x + sunOffX, tailS.y + sunOffY);
      ctx.lineTo(rwS.x + sunOffX, rwS.y + sunOffY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const nearSide = cosY >= 0 ? 1 : -1;
      const farSide = -nearSide;
      const halfWing = [[22, 4.2, -0.3], [7, 9.2, -0.4], [-13, 28.5, -0.4], [-27, 26.2, -0.4], [-30, 5.8, -0.3]];
      const darkLead = [[22, 4.2, -0.2], [7, 9.2, -0.3], [-13, 28.5, -0.3], [-16.5, 28.0, -0.3], [4.5, 8.2, -0.2], [19.5, 4.2, -0.2]];

      const drawHalfWing = (side) => {
        const wPts = halfWing.map(([bx, by, bz]) => [bx, by * side, bz]);
        const col = side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon" ? pal.bodyShade : pal.bodyLight;
        fillPoly3D(wPts, col, pal.bodyShade, 0.65);
        fillPoly3D(darkLead.map(([bx, by, bz]) => [bx, by * side, bz]), pal.archDark);

        // Upright Outboard Winglet Stabilizer Fin (symmetrical left & right)
        fillPoly3D([
          [-18, 27.2 * side, -0.3],
          [-26.5, 27.6 * side, 4.2],
          [-28.5, 27.4 * side, 3.8],
          [-26.5, 26.2 * side, -0.3]
        ], pal.bodyMid, pal.bodyShade, 0.5);

        // Twin Symmetric Heavy Engine Nacelles per wing (inboard & outboard)
        [6.8, 15.2].forEach(ny => {
          const exNose = ny > 10 ? -13 : -20;
          const exTail = ny > 10 ? -24.5 : -31.5;
          const nP0 = proj(exNose, ny * side, -1.2);
          const nP1 = proj(exTail, ny * side, -1.2);
          ctx.strokeStyle = pal.towerSteel;
          ctx.lineWidth = 4.2;
          ctx.beginPath();
          ctx.moveTo(nP0.x, nP0.y);
          ctx.lineTo(nP1.x, nP1.y);
          ctx.stroke();

          if (afterburner > 0.04) {
            const fl = (28 + Math.sin(step * 42 + ny) * 5) * afterburner;
            const pEx = proj(exTail - fl, ny * side, -1.2);
            const eg = ctx.createLinearGradient(nP1.x, nP1.y, pEx.x, pEx.y);
            eg.addColorStop(0, `rgba(${pal.plumeCore}, 0.96)`);
            eg.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.84)`);
            eg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
            ctx.strokeStyle = eg;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(nP1.x, nP1.y);
            ctx.lineTo(pEx.x, pEx.y);
            ctx.stroke();
          }
        });

        // Navigation wingtip strobes (Port = Red, Starboard = Green)
        if (Math.sin(step * 10) > 0.2) {
          const tip = proj(-26, 27.8 * side, -0.2);
          ctx.fillStyle = side < 0 ? "#F87171" : "#34D399";
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 1.45, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      const drawVerticalFin = () => {
        fillPoly3D([
          [-16, 0, 5.4],
          [-33.5, 0, 17.5],
          [-37.0, 0, 15.8],
          [-30.5, 0, 3.2]
        ], pal.bodyLight, pal.bodyShade, 0.7);
      };

      const drawDoubleBubbleFuselage = () => {
        const fN = 41, fM = 20, fA = -27, fT = -33;
        const w = 6.2, h = 7.4;

        // Strictly symmetric port & starboard lower/belly hull facets
        const bellySides = perspective === "front_headon" || perspective === "rear_tailon" ? [-1, 1] : [nearSide, farSide];
        bellySides.forEach(side => {
          fillPoly3D([
            [fN, 0, 0],
            [fM, side * w, 0],
            [fA, side * w * 0.78, 0],
            [fT, 0, -1.2],
            [fA, 0, -4.4],
            [fM, 0, -5.0]
          ], side === farSide && perspective !== "front_headon" && perspective !== "rear_tailon" ? pal.bodyMid : pal.bodyShade);
        });

        // Strictly symmetric port & starboard upper double-bubble crown facets
        [-1, 1].forEach(side => {
          const isLit = perspective === "front_headon" || perspective === "rear_tailon" ? (side < 0) : (side === nearSide);
          fillPoly3D([
            [fN, 0, 0.4],
            [fM, 0, h],
            [fA, 0, h * 0.78],
            [fT, 0, 2.8],
            [fA, side * w * 0.78, 0],
            [fM, side * w, 0]
          ], isLit ? pal.bodyLight : pal.bodyMid);
        });

        // Livery accents & 3 illuminated passenger decks on camera-facing flank
        if (perspective === "side_profile" || perspective === "front_beam" || perspective === "front_quarter" || perspective === "rear_quarter") {
          const ls0 = proj(fM * 1.1, nearSide * w * 0.94, 1.0);
          const ls1 = proj(fA + 3, nearSide * w * 0.76, 0.8);
          ctx.strokeStyle = pal.liveryAccent;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(ls0.x, ls0.y);
          ctx.lineTo(ls1.x, ls1.y);
          ctx.stroke();

          ctx.fillStyle = pal.windowGlow;
          for (let wi = 0; wi < 12; wi++) {
            const wbx = 22 - wi * 3.8;
            const fw = wi < 2 ? w * 0.88 : w * (0.94 - (wi / 12) * 0.16);
            [4.5, 2.8, 1.2].forEach(wz => {
              const wp = proj(wbx, nearSide * fw, wz);
              ctx.fillRect(wp.x - 0.8, wp.y - 0.45, 1.6, 0.9);
            });
          }
        }

        // Symmetrical Command Bridge Windshield
        if (perspective !== "rear_tailon") {
          fillPoly3D([
            [33.5, 0, 3.2],
            [27.5, -w * 0.56, 4.8],
            [24.5, 0, 6.2],
            [27.5, w * 0.56, 4.8]
          ], pal.windowGlow);
        }
      };

      if (perspective === "front_headon") {
        drawVerticalFin();
        drawHalfWing(-1);
        drawHalfWing(1);
        drawDoubleBubbleFuselage();
      } else if (perspective === "rear_tailon") {
        drawDoubleBubbleFuselage();
        drawHalfWing(-1);
        drawHalfWing(1);
        drawVerticalFin();
      } else if (perspective === "front_quarter" || perspective === "front_beam") {
        drawHalfWing(farSide);
        drawDoubleBubbleFuselage();
        drawVerticalFin();
        drawHalfWing(nearSide);
      } else {
        drawHalfWing(farSide);
        drawDoubleBubbleFuselage();
        drawVerticalFin();
        drawHalfWing(nearSide);
      }
      return;
    }

    // === VERTICAL CRADLE & LAUNCH VIEW (Strict Mirror Symmetry + External Cryogenic Booster Tanks) ===
    // External Twin Solid/Cryo Booster Tank assemblies when being mated / launched vertically!
    if (externalBoosters > 0.02) {
      const dxSlide = (1 - Math.min(1, externalBoosters)) * 26;
      [-1, 1].forEach(side => {
        const py = side * (16.5 + dxSlide);
        if (afterburner > 0.04) {
          const bfl = (36 + Math.sin(step * 38 + side) * 5) * afterburner;
          const bg = ctx.createLinearGradient(-29, py, -29 - bfl, py);
          bg.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
          bg.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.88)`);
          bg.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.moveTo(-29, py - 3.6);
          ctx.lineTo(-29 - bfl, py);
          ctx.lineTo(-29, py + 3.6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-6, py);
        ctx.lineTo(-6, side * 7);
        ctx.moveTo(14, py);
        ctx.lineTo(14, side * 6);
        ctx.stroke();

        ctx.fillStyle = pal.liveryAccent;
        ctx.beginPath();
        ctx.roundRect(-27, py - 4.0, 50, 8.0, 2.2);
        ctx.fill();
        ctx.fillStyle = pal.bodyLight;
        ctx.fillRect(-16, py - 3.6, 28, 2.2);
        ctx.beginPath();
        ctx.moveTo(23, py - 3.8);
        ctx.lineTo(31, py);
        ctx.lineTo(23, py + 3.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(-30, py - 3.2, 3.5, 6.4);
      });
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

    // Symmetrical mirrored cranked ogee delta wings
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
    ctx.lineTo(-14, 28);
    ctx.quadraticCurveTo(4, 8, 22, 0);
    ctx.closePath();
    ctx.fill();

    // Twin symmetrical outboard stabilizer fins + 4 engine nacelles
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(-26, -28.5, 11, 3.0);
    ctx.fillRect(-26, 25.5, 11, 3.0);

    [-14, -6, 6, 14].forEach(py => {
      const x0 = Math.abs(py) > 10 ? -24 : -31;
      ctx.fillStyle = pal.towerSteel;
      ctx.beginPath();
      ctx.roundRect(x0, py - 2.3, 12, 4.6, 1.4);
      ctx.fill();
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x0 - 1.2, py - 1.8, 2.2, 3.6);
    });

    // Symmetrical Double-Bubble Vertical Fuselage Column + Centered Dorsal Spine Fin
    const fGrad = ctx.createLinearGradient(0, -8.5, 0, 8.5);
    fGrad.addColorStop(0, pal.bodyLight);
    fGrad.addColorStop(0.5, pal.bodyMid);
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

    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(-25, -4.6, 50, 1.0);
    ctx.fillRect(-25, 3.6, 50, 1.0);

    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(29, -1.6, 5.0, 3.2);
    for (let wi = 0; wi < 10; wi++) {
      const wx = 22 - wi * 4.0;
      ctx.fillRect(wx, -2.8, 1.9, 1.0);
      ctx.fillRect(wx, 0.0, 1.9, 1.0);
      ctx.fillRect(wx, 2.6, 1.9, 1.0);
    }

    // Centered dorsal stabilizer ridge (strictly vertical symmetry!)
    ctx.fillStyle = pal.bodyLight;
    ctx.fillRect(-35, -1.4, 20, 2.8);

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

    const gate = L.megaGate || L.gates[2] || L.gates[0];
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
    let externalBoosters = 0;
    let erectorFrac = 0;

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
      scale = (0.44 + ease * 0.28) * L.termScale * this._depthScale(L, y);
      heading = L.rwAng + (1 - ease) * 0.06;
      afterburner = 0.22;
      if (p >= 1) {
        ml.phase = "rollout";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 108.0;
        ml.phaseDuration = 5.2;
      }
    } else if (ml.phase === "rollout") {
      visible = true;
      const rollLen = Math.hypot(rwExit.x - rwStart.x, rwExit.y - rwStart.y);
      const rwF = Math.min(1, ml.dist / Math.max(1, rollLen));
      const targetV = rwF > 0.72 ? 28.0 : (108.0 - 80.0 * (rwF / 0.72));
      ml.speed += (targetV - ml.speed) * Math.min(1, dt * 4.8);
      ml.dist += ml.speed * dt;
      x = rwStart.x + Math.cos(L.rwAng) * Math.min(ml.dist, rollLen);
      y = rwStart.y + Math.sin(L.rwAng) * Math.min(ml.dist, rollLen);
      heading = L.rwAng;
      scale = (0.72 + Math.min(1, rwF) * 0.14) * L.termScale * this._depthScale(L, y);
      if (rwF < 0.80) {
        showChutes = true;
        chuteInf = rwF < 0.10 ? (rwF / 0.10) : 1.0;
      } else if (!ml.chuteDetached) {
        ml.chuteDetached = true;
        ml.detachedChuteX = x - Math.cos(heading) * 58 * scale;
        ml.detachedChuteY = y - Math.sin(heading) * 58 * scale * 0.52;
        ml.detachedChuteHeading = heading;
        ml.detachedChuteScale = scale;
        ml.detachedChuteAlpha = 0.88;
      }
      if (ml.dist >= rollLen) {
        ml.phase = "taxi_to_gate";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 5.2;
      }
    } else if (ml.phase === "taxi_to_gate") {
      visible = true;
      const path = this._getExitToGatePath(L, gate);
      ml.speed = 5.2;
      ml.dist += ml.speed * dt;
      const pt = this._sampleArcPath(path, ml.dist);
      x = pt.x;
      y = pt.y;
      heading = pt.angle;
      scale = 0.72 * L.termScale * this._depthScale(L, y);
      if (ml.dist >= path.totalLen) {
        ml.phase = "boarding";
        ml.t = 0;
        ml.phaseDuration = 10.5;
      }
    } else if (ml.phase === "boarding") {
      visible = true;
      x = gate.x;
      y = gate.y + 4 * L.termScale;
      heading = gate.heading;
      scale = 0.70 * L.termScale * this._depthScale(L, y);
      if (ml.t >= ml.phaseDuration && !this._isMainPadBusy("megaliner")) {
        ml.phase = "taxi_to_pad";
        ml.t = 0;
        ml.dist = 0;
        ml.speed = 4.8;
      }
    } else if (ml.phase === "taxi_to_pad") {
      visible = true;
      // Follow cohesive Heavy Taxiway Roadway from Mega-Liner Gate -> Western Apron -> Launch Pad!
      const path = this._buildArcPath([
        [gate, { x: gate.x - 42 * L.termScale, y: gate.y - 12 * L.termScale }, { x: L.padX - 16, y: L.padY + 30 }, { x: L.padX, y: L.padY + 4 }]
      ], 44);
      ml.speed = 14.5;
      ml.dist += ml.speed * dt;
      const pt = this._sampleArcPath(path, ml.dist);
      x = pt.x;
      y = pt.y;
      heading = pt.angle;
      scale = 0.66 * L.termScale * this._depthScale(L, y);
      if (ml.dist >= path.totalLen) {
        ml.phase = "pad_prep";
        ml.t = 0;
        ml.phaseDuration = 9.2;
      }
    } else if (ml.phase === "pad_prep") {
      visible = true;
      const p = Math.min(1, ml.t / ml.phaseDuration);
      const erectP = this._clamp(p / 0.52, 0, 1);
      const easeErect = erectP * erectP * (3 - 2 * erectP);
      const mateP = this._clamp((p - 0.50) / 0.40, 0, 1);
      const easeMate = mateP * mateP * (3 - 2 * mateP);

      scale = 0.66 * L.termScale;
      x = L.padX;
      y = L.padY - 33 * scale * easeErect;
      heading = -0.25 * (1 - easeErect) + (-Math.PI * 0.5) * easeErect;
      isVertical = erectP > 0.35;
      erectorFrac = easeErect;
      externalBoosters = p >= 0.48 ? easeMate : 0;

      // Hydraulic Strongback Erector Truss swinging upright behind Mega-Liner spine!
      ctx.save();
      const pivotX = L.padX - 18 * scale;
      const pivotY = L.padY + 2;
      const strongAng = (-Math.PI * 0.5 + 0.08) * (1 - easeErect);
      ctx.translate(pivotX, pivotY);
      ctx.rotate(strongAng);
      ctx.fillStyle = pal.towerSteel;
      ctx.fillRect(-3 * scale, -68 * scale, 6 * scale, 68 * scale);
      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-5 * scale, -54 * scale, 10 * scale, 3 * scale);
      ctx.fillRect(-5 * scale, -26 * scale, 10 * scale, 3 * scale);
      ctx.restore();

      if (p > 0.52) {
        this._drawPadDelugeAndTowerLights(ctx, L, pal, (p - 0.52) / 0.48, step);
        if (Math.random() < 0.38) {
          this.ventParticles.push({
            x: L.padX + (Math.random() - 0.5) * 18, y: L.padY - 12,
            vx: (Math.random() - 0.5) * 0.9, vy: -0.25,
            r: 3.5, life: 0, maxLife: 45
          });
        }
      }
      if (ml.t >= ml.phaseDuration) {
        ml.phase = "vertical_launch";
        ml.t = 0;
        ml.phaseDuration = 12.0;
      }
    } else if (ml.phase === "vertical_launch") {
      visible = true;
      isVertical = true;
      externalBoosters = 1.0;
      const p = Math.min(1, ml.t / ml.phaseDuration);
      const towerClearLift = L.towerH * 1.18;
      // Launch strictly vertically straight off top of frame with attached External Booster Tanks!
      const liftY = towerClearLift * 0.25 * p + Math.pow(p, 2.35) * (L.padY + 245);
      scale = 0.66 * L.termScale;
      x = L.padX;
      y = L.padY - 33 * scale - liftY;
      heading = -Math.PI * 0.5;
      altitude = Math.min(120, liftY * 0.5);
      afterburner = p < 0.1 ? (0.55 + p * 4.5) : 1.38;

      const deluge = p < 0.46 ? Math.max(0.25, 1 - p / 0.46) : 0;
      this._drawPadDelugeAndTowerLights(ctx, L, pal, deluge, step);
      if (Math.random() < 0.85) {
        const nearPad = y > L.padY - 75;
        this.plumeParticles.push({
          x: x + (Math.random() - 0.5) * (nearPad ? 22 : 8),
          y: nearPad ? L.padY + 2 : y + 18,
          vx: nearPad ? (Math.random() - 0.5) * 2.8 : (Math.random() - 0.5) * 0.4,
          vy: nearPad ? -0.25 : 0.65,
          r: nearPad ? 7.8 : 4.4,
          grow: nearPad ? 0.24 : 0.16,
          hot: p < 0.72 && Math.random() < 0.45,
          life: 0,
          maxLife: nearPad ? 92 : 140
        });
      }
      if (ml.t >= ml.phaseDuration) {
        ml.phase = "dormant_wait";
        ml.t = 0;
        ml.phaseDuration = this._rand(140.0, 230.0);
        ml.variant = this._pickMegaLinerVariant();
        return;
      }
    }

    ml.x = x;
    ml.y = y;
    ml.heading = ml.phase === "pad_prep" || ml.phase === "vertical_launch" ? heading : this._lerpAngle(ml.heading, heading, Math.min(1, dt * 6));
    ml.altitude = altitude;

    if (ml.chuteDetached && ml.detachedChuteAlpha > 0.01) {
      ml.detachedChuteAlpha = Math.max(0, ml.detachedChuteAlpha - dt * 0.32);
      const dSc = ml.detachedChuteScale || 0.72;
      const dAng = ml.detachedChuteHeading != null ? ml.detachedChuteHeading : L.rwAng;
      ctx.save();
      ctx.translate(ml.detachedChuteX, ml.detachedChuteY + 3);
      ctx.rotate(dAng * 0.45);
      ctx.globalAlpha = ml.detachedChuteAlpha;
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(2, 4 * dSc, 24 * dSc, 8 * dSc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.ellipse(-6 * dSc, -3 * dSc, 15 * dSc, 6.2 * dSc, 0.15, 0, Math.PI * 2);
      ctx.ellipse(5 * dSc, 1 * dSc, 18 * dSc, 6.8 * dSc, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.chuteStripe;
      ctx.beginPath();
      ctx.ellipse(0, -1 * dSc, 8 * dSc, 3.4 * dSc, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (!visible) return;

    if (showChutes && chuteInf > 0.05) {
      // Large 2.5D Triple-Canopy Ring-Sail Heavy Drogue Parachute Array
      const cosH = Math.cos(ml.heading);
      const sinH = Math.sin(ml.heading);
      const tailAnchorX = x - cosH * 30 * scale;
      const tailAnchorY = y - sinH * 30 * scale * 0.50;
      const backX = -cosH;
      const backY = -sinH * 0.52;
      const perpX = -sinH;
      const perpY = cosH * 0.45;
      const riserX = tailAnchorX + backX * (16 + 10 * chuteInf) * scale;
      const riserY = tailAnchorY + backY * (16 + 10 * chuteInf) * scale - 2 * scale;
      const cableCol = pal.isNightLights ? "rgba(226, 232, 240, 0.68)" : "rgba(51, 65, 85, 0.66)";

      const canopies = [
        { dist: 50 + 44 * chuteInf, side: -16.5, lift: -5.0, rMul: 0.94 },
        { dist: 50 + 44 * chuteInf, side: 16.5, lift: -2.5, rMul: 0.94 },
        { dist: 62 + 52 * chuteInf, side: 0.0, lift: -16.0, rMul: 1.08 }
      ];

      ctx.save();
      // Main tow bridle from tail cone to splitter yoke
      ctx.strokeStyle = cableCol;
      ctx.lineWidth = Math.max(1.0, 1.5 * scale);
      ctx.beginPath();
      ctx.moveTo(tailAnchorX, tailAnchorY);
      ctx.lineTo(riserX, riserY);
      ctx.stroke();

      canopies.forEach((c, idx) => {
        const flutter = Math.sin(step * 22 + idx * 2.1) * 1.6 * scale * chuteInf;
        const cx = tailAnchorX + (backX * c.dist + perpX * c.side) * scale + flutter * 0.4;
        const cy = tailAnchorY + (backY * c.dist + perpY * c.side + c.lift) * scale + flutter;
        const rx = 22.0 * chuteInf * scale * c.rMul;
        const ry = 16.2 * chuteInf * scale * c.rMul;

        // Runway ground shadow below billowing canopy
        ctx.fillStyle = pal.shadowColor;
        ctx.globalAlpha = 0.28 * chuteInf;
        ctx.beginPath();
        ctx.ellipse(cx + 3 * scale, cy + (18 - c.lift * 0.55) * scale, rx * 0.92, ry * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 4 Suspension shroud lines fanning cleanly from splitter yoke to open canopy skirt
        const mouthX = cx - backX * rx * 0.16;
        const mouthY = cy - backY * rx * 0.16;
        ctx.strokeStyle = cableCol;
        ctx.lineWidth = Math.max(0.8, 1.15 * scale);
        ctx.beginPath();
        [-0.88, -0.32, 0.32, 0.88].forEach(sf => {
          ctx.moveTo(riserX, riserY);
          ctx.lineTo(mouthX + perpX * ry * sf * 0.45, mouthY + ry * sf);
        });
        ctx.stroke();

        // Dark recessed interior canopy cavity tucked flush at skirt rim facing tailcone
        const tilt = Math.atan2(backY, backX);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);

        ctx.fillStyle = pal.archDark;
        ctx.beginPath();
        ctx.ellipse(-rx * 0.12, 0, rx * 0.24, ry * 0.96, 0, 0, Math.PI * 2);
        ctx.fill();

        // Primary billowing high-vis aerospace drogue dome (seamless hem enclosing cavity rim)
        ctx.fillStyle = pal.chuteColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, -Math.PI * 0.52, Math.PI * 0.52);
        ctx.quadraticCurveTo(-rx * 0.18, 0, 0, -ry);
        ctx.closePath();
        ctx.fill();

        // Contrast white/ivory gore ring-sail panels for unmistakable aerospace parachute silhouette
        ctx.fillStyle = pal.chuteStripe;
        ctx.globalAlpha = 0.90;
        [-0.48, 0.12].forEach(band => {
          ctx.beginPath();
          ctx.moveTo(-rx * 0.12, ry * band);
          ctx.quadraticCurveTo(rx * 0.52, ry * (band + 0.14), rx * 0.86, ry * (band + 0.18));
          ctx.lineTo(rx * 0.86, ry * (band + 0.34));
          ctx.quadraticCurveTo(rx * 0.48, ry * (band + 0.30), -rx * 0.10, ry * (band + 0.22));
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      });
      ctx.restore();
    }

    const mlPitch = ml.phase === "approach" ? 0.08 : 0;
    ctx.save();
    ctx.translate(x, y);
    if (isVertical) ctx.rotate(ml.heading);
    ctx.scale(scale, scale);
    this._drawMegaLinerModel(ctx, pal, step, afterburner, altitude, isVertical, externalBoosters, ml.heading, mlPitch, ml.variant || "double_deck");
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

    const V_TAXI = 5.8;       // Unhurried realistic tarmac apron taxi speed (px/s)
    const V_RW_EXIT = 44.0;   // Rapid high-speed turnoff clearing active runway cleanly
    const V_TD = 142.0;       // Crisp fast flared touchdown speed (px/s)
    const V_VR = 148.0;       // Brisk realistic takeoff rotation speed (px/s)

    // Apron yield spacer: gently decelerates if another spaceplane taxis ahead on apron/gates
    const applyApronYield = (desiredSpd) => {
      const hx = Math.cos(sp.heading);
      const hy = Math.sin(sp.heading);
      const minSep = 36 * L.termScale;
      for (let i = 0; i < this.spaceplanes.length; i++) {
        const other = this.spaceplanes[i];
        if (!other || other === sp) continue;
        if (other.phase === "hangar_rest" || other.phase === "sky_wait" || other.phase === "approach" || other.phase === "climb_out") continue;
        const dx = (other.x || 0) - (sp.x || 0);
        const dy = (other.y || 0) - (sp.y || 0);
        const d = Math.hypot(dx, dy);
        if (d > 1 && d < minSep && (dx * hx + dy * hy) > 0) {
          return desiredSpd * 0.18;
        }
      }
      return desiredSpd;
    };

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
      const desired = applyApronYield(rem < 34 ? Math.max(2.0, V_TAXI * (rem / 34)) : V_TAXI);
      sp.speed += (desired - sp.speed) * (1 - Math.exp(-2.8 * dt));
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
        sp.phaseDuration = this._rand(8.0, 15.0);
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
      const desired = applyApronYield(sp.dist < 28 ? Math.max(2.0, V_TAXI * (sp.dist / 28)) : V_TAXI);
      sp.speed += (desired - sp.speed) * (1 - Math.exp(-2.6 * dt));
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
      const desired = applyApronYield(rem < 32 ? Math.max(2.0, V_TAXI * (rem / 32)) : V_TAXI);
      sp.speed += (desired - sp.speed) * (1 - Math.exp(-2.8 * dt));
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
        sp.phaseDuration = this._rand(1.8, 3.2);
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
      // Brisk progressive acceleration 0 -> V_VR (114 px/s) down runway, transitioning C1-smoothly into 148 px/s climb!
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
        sp.speed = Math.min(185, sp.speed + 20.0 * dt);
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
          sp.phaseDuration = this._rand(5.0, 12.0);
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
        sp.speed = 168;
        sp.phase = "approach";
        sp.t = 0;
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      // Shallow ~3° glide slope flaring smoothly onto the runway at V_TD (142 px/s)
      visible = true;
      const appPath = this._getApproachPath(L);
      const frac = Math.min(1, sp.dist / appPath.totalLen);
      sp.speed = 168 - (168 - V_TD) * frac;
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
      // Brisk aerodynamic drag deceleration from V_TD (142) to rapid turnoff speed V_RW_EXIT (44) clearing the runway promptly!
      visible = true;
      const tdPt = L.rwPt(0.14);
      const rollLen = Math.max(60, Math.hypot(exitPt.x - tdPt.x, exitPt.y - tdPt.y));
      const frac = Math.min(1, sp.dist / rollLen);
      sp.speed = V_RW_EXIT + (V_TD - V_RW_EXIT) * Math.pow(1 - frac, 0.85);
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
        sp.speed = V_RW_EXIT;
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
    sp.heading = this._lerpAngle(sp.heading, targetHeading, 1 - Math.exp(-5.8 * dt));
    sp.altitude = altitude;
    const depth = this._depthScale(L, y);
    const drawScale = scale * depth;

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

    // 1. Foreshortened ground-plane drogue chute & landing light beam matching 2.5D camera elevation (0.45)
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(drawScale, drawScale * 0.45);
    ctx.rotate(sp.heading);

    if (showChute && chuteInflation > 0.05) {
      const tetherLen = 16 + chuteInflation * 16;
      const chuteR = 8.2 * chuteInflation;
      const tailX = -15;
      const canopyX = tailX - tetherLen;

      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.60)" : "rgba(71, 85, 105, 0.58)";
      ctx.lineWidth = 1.05;
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
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(canopyX - chuteR * 0.38, -chuteR * 0.56);
      ctx.lineTo(canopyX - chuteR * 0.38, chuteR * 0.56);
      ctx.stroke();
    }

    const beamA = pal.isNightLights ? 0.34 : 0.11;
    const beamG = ctx.createLinearGradient(17, 0, 58, 0);
    beamG.addColorStop(0, `rgba(255, 251, 235, ${beamA})`);
    beamG.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(17, -2.0);
    ctx.lineTo(58, -11);
    ctx.lineTo(58, 11);
    ctx.lineTo(17, 2.0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Render Spaceplane across 5 True Symmetrical 2.5D Oblique Perspectives + subtle climb/flare pitch
    const climbPitch = sp.phase === "runway_takeoff" ? (sp._airborne ? 0.24 : Math.max(0, altitude * 0.08)) : (sp.phase === "approach" ? 0.10 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(drawScale, drawScale);
    this._drawSpaceplaneModel(ctx, sp.variant, pal, step, afterburner, altitude, sp.heading, climbPitch);
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
