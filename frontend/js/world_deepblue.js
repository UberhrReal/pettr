/**
 * PETTR World Renderer: Underwater — "Deep Blue" (v12.6 Modular Hexagonal Biophilic Station, Reefs, Angler Fish, Leviathan & Caustics)
 * Panoramic multi-wing benthic research complex grounded solidly onto volcanic & reef-rich coastal seabed terraces:
 * - Interconnected modular hexagonal hard-sci-fi & biophilic minimalist primary pods (_drawHexModule) paired with
 *   boxy angular architectural wings featuring brushed titanium panelling and modern mullioned floor-to-ceiling glass
 *   windows (preserving the single faceted Hydroponic Greenhouse Dome as the station's sole glass dome).
 * - Sharp navigation double-strobe arrays across spire, wings, elevator tower, hydro gantry & moonpool piers.
 * - Undulating cellular caustic light webs dancing across sandy seabed terraces and flat habitat rooftops.
 * - Rich benthic coral reefs, branching staghorns, sea fans & sponges anchored firmly along seabed & framing cliffs.
 * - Deep-sea Angler Fish with pulsing glowing esca lures, abyssal Leviathan cruising infrequently in the far depths,
 *   to-scale human divers, 7 theme-cohesive submarines, sharks, whales, schools & ROV spotlights.
 */
const WorldDeepBlue = {
  cacheCanvas: null,
  stationCacheCanvas: null,
  cacheKey: "",
  farLife: [],
  nearLife: [],
  fishSchools: [],
  sharks: [],
  whales: [],
  jellies: [],
  anglerFish: [],
  seaTurtles: [],
  fgReefSharks: [],
  dolphins: [],
  leviathan: null,
  kelp: [],
  snow: [],
  bubbles: [],
  divers: [],
  sub: null,          // Primary left-pier visiting submarine
  cargoSub: null,     // Primary right-pier visiting freighter/vessel
  roamingSubs: [],    // Multi-directional roaming visitor + background transit traffic
  dolphinPodState: null,
  elevator: null,     // Vertical surface supply elevator state
  rovs: [],
  sonarRings: [],
  cleaningMantas: [],
  cleanerWrasse: [],
  cleanSparkles: [],
  _lastW: 0,
  _lastH: 0,
  _lastLevStunt: "",
  _queuedLeviathan: null,

  LEVIATHAN_STUNTS: ["roar", "body_roll", "hunt_shark", "two_playing"],

  DOCKING_SUB_STYLES: [
    "passenger_liner",
    "heavy_freighter",
    "experimental_research",
    "military_stealth",
    "los_angeles_ssn"
  ],

  SUB_STYLES: [
    "passenger_liner",
    "heavy_freighter",
    "experimental_research",
    "military_stealth",
    "los_angeles_ssn",
    "bathyscaphe",
    "crew_shuttle",
    "research_catamaran",
    "manta_glider",
    "industrial_tug",
    "deep_explorer"
  ],

  _getSubDockOffset(style) {
    if (style === "los_angeles_ssn") return 82;
    if (style === "passenger_liner") return 54;
    if (style === "heavy_freighter") return 66;
    if (style === "experimental_research") return 44;
    if (style === "military_stealth") return 56;
    return 52;
  },

  getScreenBudget(isNarrow) {
    return isNarrow
      ? {
          maxMegafauna: 2,
          maxPlayful: 1,
          maxFishSchools: 2,
          maxJellies: 2,
          maxAnglers: 1,
          maxSubs: 2,
          maxROVs: 1,
          maxDivers: 1
        }
      : {
          maxMegafauna: 3,
          maxPlayful: 2,
          maxFishSchools: 3,
          maxJellies: 3,
          maxAnglers: 2,
          maxSubs: 3,
          maxROVs: 2,
          maxDivers: 3
        };
  },

  _countActiveCategory(cat) {
    if (cat === "megafauna") {
      let n = 0;
      for (let i = 0; i < this.whales.length; i++) if (this.whales[i].active) n++;
      for (let i = 0; i < this.sharks.length; i++) if (this.sharks[i].active) n++;
      for (let i = 0; i < this.farLife.length; i++) if (this.farLife[i].kind === "manta" && this.farLife[i].active) n++;
      for (let i = 0; i < this.fgReefSharks.length; i++) if (this.fgReefSharks[i].active) n++;
      if (this.leviathan && this.leviathan.phase === "swimming") n += 1;
      return n;
    }
    if (cat === "playful") {
      let n = (this.dolphinPodState && this.dolphinPodState.active) ? 1 : 0;
      for (let i = 0; i < this.seaTurtles.length; i++) if (this.seaTurtles[i].active) n++;
      return n;
    }
    if (cat === "fishSchools") return this.fishSchools.filter(s => s.active).length;
    if (cat === "jellies") return this.jellies.filter(j => j.active).length;
    if (cat === "anglers") return this.anglerFish.filter(a => a.active).length;
    if (cat === "subs") {
      let n = 0;
      if (this.sub && this.sub.phase !== "patrol_wait") n++;
      if (this.cargoSub && this.cargoSub.phase !== "patrol_wait") n++;
      for (let i = 0; i < this.roamingSubs.length; i++) {
        const rs = this.roamingSubs[i];
        if (rs.role === "visitor" ? rs.phase !== "away_wait" : rs.phase !== "wait") n++;
      }
      return n;
    }
    if (cat === "rovs") return this.rovs.filter(r => r.phase !== "docked_wait").length;
    if (cat === "divers") return this.divers.filter(d => d.phase !== "inside_airlock").length;
    return 0;
  },

  _canActivate(cat, isNarrow) {
    const B = this.getScreenBudget(isNarrow);
    const map = {
      megafauna: B.maxMegafauna,
      playful: B.maxPlayful,
      fishSchools: B.maxFishSchools,
      jellies: B.maxJellies,
      anglers: B.maxAnglers,
      subs: B.maxSubs,
      rovs: B.maxROVs,
      divers: B.maxDivers
    };
    const cap = map[cat];
    return cap == null ? true : this._countActiveCategory(cat) < cap;
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

  // True arc-length polyline sampler for steady weighty submarine & diver motion
  _buildArcPath(segments, samplesPerSeg = 24) {
    const pts = [];
    let accDist = 0;
    let prev = null;

    const pushPt = (x, y) => {
      if (prev) {
        const segD = Math.hypot(x - prev.x, y - prev.y);
        if (segD < 0.001) return;
        accDist += segD;
      }
      const p = { x, y, dist: accDist };
      pts.push(p);
      prev = p;
    };

    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      const seg = segments[sIdx];
      const steps = seg.type === "line" ? Math.max(4, Math.floor(samplesPerSeg * 0.4)) : samplesPerSeg;
      for (let i = (sIdx === 0 ? 0 : 1); i <= steps; i++) {
        const t = i / steps;
        if (seg.type === "line") {
          pushPt(
            seg.p0.x + (seg.p1.x - seg.p0.x) * t,
            seg.p0.y + (seg.p1.y - seg.p0.y) * t
          );
        } else {
          const r = this._cubicBez(seg.p0, seg.p1, seg.p2, seg.p3, t);
          pushPt(r.x, r.y);
        }
      }
    }

    if (pts.length === 0) {
      return { pts: [{ x: 0, y: 0, dist: 0, dx: 1, dy: 0 }], totalLen: 0 };
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const mag = Math.hypot(dx, dy) || 1;
      pts[i].dx = dx / mag;
      pts[i].dy = dy / mag;
    }
    return { pts, totalLen: accDist };
  },

  _sampleArcPath(path, dist) {
    const pts = path.pts;
    if (!pts || pts.length === 0) return { x: 0, y: 0, dx: 1, dy: 0, angle: 0 };
    if (dist <= 0) {
      const p0 = pts[0];
      return { x: p0.x, y: p0.y, dx: p0.dx, dy: p0.dy, angle: Math.atan2(p0.dy, p0.dx) };
    }
    if (dist >= path.totalLen) {
      const pn = pts[pts.length - 1];
      return { x: pn.x, y: pn.y, dx: pn.dx, dy: pn.dy, angle: Math.atan2(pn.dy, pn.dx) };
    }
    let lo = 0;
    let hi = pts.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].dist <= dist) lo = mid;
      else hi = mid;
    }
    const a = pts[lo];
    const b = pts[hi];
    const span = Math.max(0.0001, b.dist - a.dist);
    const f = (dist - a.dist) / span;
    const x = a.x + (b.x - a.x) * f;
    const y = a.y + (b.y - a.y) * f;
    const dx = a.dx + (b.dx - a.dx) * f;
    const dy = a.dy + (b.dy - a.dy) * f;
    return { x, y, dx, dy, angle: Math.atan2(dy, dx) };
  },

  _computeBuoyantTransform(dx, dy, prevFacingLeft) {
    let facingLeft = prevFacingLeft;
    if (Math.abs(dx) > 0.08) {
      facingLeft = dx < 0;
    }
    const horiz = Math.max(Math.abs(dx), 0.35);
    const targetPitch = this._clamp(Math.atan2(dy, horiz), -0.20, 0.20);
    return { facingLeft, targetPitch };
  },

  // Exact terrain surface queries so EVERY kelp, sponge, coral & foundation anchors firmly ON the ground!
  _quadYAt(p0, p1, p2, x) {
    // Solve monotonic x(t) = (1-t)^2*x0 + 2(1-t)t*x1 + t^2*x2 by binary search for exact y!
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) * 0.5;
      const u = 1 - mid;
      const mx = u * u * p0.x + 2 * u * mid * p1.x + mid * mid * p2.x;
      if (mx < x) lo = mid;
      else hi = mid;
    }
    const t = (lo + hi) * 0.5;
    const u = 1 - t;
    return u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
  },

  _seabedYAtX(x, w, h, L) {
    const midX = w * 0.50;
    if (x <= midX) {
      return this._quadYAt(
        { x: 0, y: L.seabedY - 12 },
        { x: w * 0.22, y: L.seabedY - 44 },
        { x: midX, y: L.seabedY - 58 },
        this._clamp(x, 0, midX)
      );
    }
    return this._quadYAt(
      { x: midX, y: L.seabedY - 58 },
      { x: w * 0.78, y: L.seabedY - 64 },
      { x: w, y: L.seabedY - 40 },
      this._clamp(x, midX, w)
    );
  },

  _cliffYAtX(x, w, h) {
    // Left reef cliff spans [0 .. 0.30w]; Right reef cliff spans [0.70w .. w]
    if (x <= w * 0.30) {
      if (x <= w * 0.14) {
        return this._quadYAt(
          { x: 0, y: h * 0.67 },
          { x: w * 0.06, y: h * 0.72 },
          { x: w * 0.14, y: h * 0.82 },
          Math.max(0, x)
        );
      }
      return this._quadYAt(
        { x: w * 0.14, y: h * 0.82 },
        { x: w * 0.22, y: h * 0.90 },
        { x: w * 0.30, y: h },
        x
      );
    }
    if (x >= w * 0.70) {
      if (x <= w * 0.86) {
        return this._quadYAt(
          { x: w * 0.70, y: h },
          { x: w * 0.78, y: h * 0.92 },
          { x: w * 0.86, y: h * 0.84 },
          x
        );
      }
      return this._quadYAt(
        { x: w * 0.86, y: h * 0.84 },
        { x: w * 0.93, y: h * 0.73 },
        { x: w, y: h * 0.66 },
        Math.min(w, x)
      );
    }
    return null;
  },

  reset() {
    this.cacheKey = "";
    this.farLife = [];
    this.nearLife = [];
    this.fishSchools = [];
    this.sharks = [];
    this.whales = [];
    this.jellies = [];
    this.anglerFish = [];
    this.seaTurtles = [];
    this.fgReefSharks = [];
    this.dolphins = [];
    this.leviathan = null;
    this.kelp = [];
    this.snow = [];
    this.bubbles = [];
    this.divers = [];
    this.sub = null;
    this.cargoSub = null;
    this.roamingSubs = [];
    this.dolphinPodState = null;
    this.elevator = null;
    this.rovs = [];
    this.sonarRings = [];
    this.cleaningMantas = [];
    this.cleanerWrasse = [];
    this.cleanSparkles = [];
    this._queuedLeviathan = null;
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isDark: false,
        waterTop: "#B7E9F0",
        waterMid: "#62BDD4",
        waterBottom: "#256D8F",
        waterHazeRgb: "74, 166, 194",
        waterBounce: "rgba(218, 249, 255, 0.62)",
        surfaceRipple: "rgba(255, 252, 235, 0.56)",
        rayColor: "254, 249, 215",
        rayAlpha: 0.29,
        reefFar: "#3D8BA8",
        reefMid: "#246482",
        reefNear: "#133C54",
        seabedLight: "#4B97B3",
        seabedDark: "#1E5673",
        kelpColor: "#144A5E",
        kelpTip: "#216A7D",
        hullLight: "#DCECF3",
        hullMid: "#7EA3B9",
        hullDark: "#2D4F66",
        hullDeep: "#1B364A",
        hullShadow: "rgba(15, 42, 62, 0.34)",
        glassTint: "rgba(198, 240, 250, 0.24)",
        glassHighlight: "rgba(255, 255, 255, 0.62)",
        glassRim: "rgba(165, 235, 248, 0.42)",
        tubeFloor: "#3B6078",
        tubeWarmGlow: "rgba(186, 245, 236, 0.72)",
        subHullLight: "#D6ECEF",
        subHullMid: "#72A2B8",
        subHullDark: "#2A526B",
        subAccent: "#0D9488",
        subContainers: ["#3B7E96", "#4B8B88", "#8BA2B4"],
        rovBody: "#C59C50",
        elevatorGlow: "186, 240, 244",
        trimGold: "#0D9488",
        portholeGlow: "rgba(254, 242, 198, 0.82)",
        windowTop: "rgba(38, 66, 84, 0.72)",
        windowMid: "rgba(232, 248, 246, 0.82)",
        windowBot: "rgba(162, 214, 218, 0.78)",
        windowRecess: "rgba(16, 44, 62, 0.74)",
        floodlightRgb: "224, 248, 252",
        floodlightAlpha: 0.14,
        biodomeFlora: "rgba(34, 197, 94, 0.56)",
        cropRow: "#16A34A",
        farCreatureRgb: "24, 86, 114",
        nearCreatureRgb: "14, 56, 78",
        jellyRgb: "56, 189, 248",
        beamAlpha: 0.22,
        beamRgb: "254, 249, 205",
        snowRgb: "240, 253, 250",
        biolumAlpha: 0.16
      };
    }
    if (mode === "evening") {
      // Shallow Coastal Golden Hour — clear coastal turquoise-indigo water pierced by slanted golden sunset shafts!
      return {
        isDark: true,
        isGoldenCoastal: true,
        waterTop: "#3B88A8",
        waterMid: "#154969",
        waterBottom: "#09243B",
        waterHazeRgb: "24, 84, 114",
        waterBounce: "rgba(253, 224, 168, 0.50)",
        surfaceRipple: "rgba(255, 224, 165, 0.56)",
        rayColor: "255, 224, 158",
        rayAlpha: 0.30,
        reefFar: "#144260",
        reefMid: "#0D3048",
        reefNear: "#061B2B",
        seabedLight: "#256482",
        seabedDark: "#0E354E",
        kelpColor: "#082436",
        kelpTip: "#154B5E",
        hullLight: "#98B6CB",
        hullMid: "#476985",
        hullDark: "#1B334B",
        hullDeep: "#0E1E2E",
        hullShadow: "rgba(4, 14, 26, 0.46)",
        glassTint: "rgba(147, 224, 252, 0.20)",
        glassHighlight: "rgba(255, 238, 204, 0.50)",
        glassRim: "rgba(103, 212, 248, 0.36)",
        tubeFloor: "#24435E",
        tubeWarmGlow: "rgba(153, 246, 228, 0.84)",
        subHullLight: "#8CB0C9",
        subHullMid: "#416785",
        subHullDark: "#1A334A",
        subAccent: "#2DD4BF",
        subContainers: ["#255A7A", "#23696E", "#648399"],
        rovBody: "#A68C58",
        elevatorGlow: "125, 211, 252",
        trimGold: "#38BDF8",
        portholeGlow: "rgba(224, 247, 250, 0.90)",
        windowTop: "rgba(18, 44, 66, 0.82)",
        windowMid: "rgba(253, 232, 178, 0.90)",
        windowBot: "rgba(218, 176, 108, 0.82)",
        windowRecess: "rgba(8, 24, 42, 0.86)",
        floodlightRgb: "165, 243, 252",
        floodlightAlpha: 0.22,
        biodomeFlora: "rgba(52, 211, 153, 0.54)",
        cropRow: "#22C55E",
        farCreatureRgb: "16, 62, 88",
        nearCreatureRgb: "12, 46, 68",
        jellyRgb: "45, 212, 191",
        beamAlpha: 0.38,
        beamRgb: "254, 243, 199",
        snowRgb: "224, 247, 250",
        biolumAlpha: 0.44
      };
    }
    if (mode === "dark") {
      return {
        isDark: true,
        waterTop: "#041122",
        waterMid: "#030B18",
        waterBottom: "#01050D",
        waterHazeRgb: "3, 11, 24",
        waterBounce: "rgba(72, 168, 210, 0.30)",
        surfaceRipple: "rgba(186, 230, 253, 0.30)",
        rayColor: "172, 224, 255",
        rayAlpha: 0.16,
        reefFar: "#06172A",
        reefMid: "#04101F",
        reefNear: "#020812",
        seabedLight: "#081C30",
        seabedDark: "#020A14",
        kelpColor: "#020B16",
        kelpTip: "#071B2E",
        hullLight: "#496780",
        hullMid: "#21364B",
        hullDark: "#0C1826",
        hullDeep: "#060D16",
        hullShadow: "rgba(1, 5, 14, 0.60)",
        glassTint: "rgba(56, 189, 248, 0.13)",
        glassHighlight: "rgba(148, 224, 248, 0.38)",
        glassRim: "rgba(56, 189, 248, 0.28)",
        tubeFloor: "#122436",
        tubeWarmGlow: "rgba(165, 243, 252, 0.90)",
        subHullLight: "#466782",
        subHullMid: "#1E354C",
        subHullDark: "#0B1726",
        subAccent: "#22D3EE",
        subContainers: ["#193852", "#1C454D", "#44566A"],
        rovBody: "#6E5E3D",
        elevatorGlow: "56, 189, 248",
        trimGold: "#38BDF8",
        portholeGlow: "rgba(254, 230, 148, 0.94)",
        windowTop: "rgba(12, 22, 34, 0.88)",
        windowMid: "rgba(254, 232, 156, 0.95)",
        windowBot: "rgba(196, 144, 66, 0.88)",
        windowRecess: "rgba(3, 9, 20, 0.92)",
        floodlightRgb: "165, 238, 252",
        floodlightAlpha: 0.28,
        biodomeFlora: "rgba(45, 212, 191, 0.44)",
        cropRow: "#34D399",
        farCreatureRgb: "10, 32, 54",
        nearCreatureRgb: "18, 56, 84",
        jellyRgb: "34, 211, 238",
        beamAlpha: 0.56,
        beamRgb: "224, 247, 250",
        snowRgb: "165, 243, 252",
        biolumAlpha: 0.94
      };
    }
    // Light / Afternoon — sunlit cerulean crystal ocean
    return {
      isDark: false,
      waterTop: "#CBEBFB",
      waterMid: "#7DC7E8",
      waterBottom: "#2B77A3",
      waterHazeRgb: "94, 174, 212",
      waterBounce: "rgba(232, 250, 255, 0.68)",
      surfaceRipple: "rgba(255, 255, 255, 0.62)",
      rayColor: "230, 249, 255",
      rayAlpha: 0.33,
      reefFar: "#4694B8",
      reefMid: "#2A6D91",
      reefNear: "#15425E",
      seabedLight: "#5AA5C7",
      seabedDark: "#246082",
      kelpColor: "#0F384F",
      kelpTip: "#1B5674",
      hullLight: "#E8F3F9",
      hullMid: "#89ABC4",
      hullDark: "#32536C",
      hullDeep: "#1E3A50",
      hullShadow: "rgba(16, 48, 74, 0.30)",
      glassTint: "rgba(218, 246, 255, 0.26)",
      glassHighlight: "rgba(255, 255, 255, 0.68)",
      glassRim: "rgba(186, 236, 252, 0.46)",
      tubeFloor: "#3C637D",
      tubeWarmGlow: "rgba(186, 242, 250, 0.72)",
      subHullLight: "#E2F1F8",
      subHullMid: "#7BA6C2",
      subHullDark: "#2F5470",
      subAccent: "#0891B2",
      subContainers: ["#2D7294", "#3B7E84", "#86A2BA"],
      rovBody: "#C29642",
      elevatorGlow: "224, 247, 250",
      trimGold: "#0284C7",
      portholeGlow: "rgba(254, 236, 178, 0.82)",
      windowTop: "rgba(42, 74, 96, 0.70)",
      windowMid: "rgba(254, 238, 186, 0.80)",
      windowBot: "rgba(212, 174, 110, 0.76)",
      windowRecess: "rgba(22, 54, 78, 0.72)",
      floodlightRgb: "230, 250, 255",
      floodlightAlpha: 0.13,
      biodomeFlora: "rgba(34, 197, 94, 0.56)",
      cropRow: "#16A34A",
      farCreatureRgb: "28, 92, 124",
      nearCreatureRgb: "16, 62, 88",
      jellyRgb: "14, 165, 233",
      beamAlpha: 0.20,
      beamRgb: "240, 253, 250",
      snowRgb: "255, 255, 255",
      biolumAlpha: 0.12
    };
  },

  getCelestialLight(w, h, mode, diurnalHour = null) {
    const defaults = { morning: 7.5, light: 13.0, evening: 18.5, dark: 23.0 };
    let hour = (typeof diurnalHour === "number" && Number.isFinite(diurnalHour))
      ? diurnalHour
      : ((typeof WaveCanvas !== "undefined" && WaveCanvas.getDiurnalHour)
          ? WaveCanvas.getDiurnalHour(mode)
          : (defaults[mode] !== undefined ? defaults[mode] : 13.0));
    hour = ((hour % 24) + 24) % 24;

    // Solar refraction entry geometry (East=Right at Dawn -> Zenith at Noon -> West=Left at Dusk)
    const uSunRaw = (hour - 5.75) / 14.5;
    const sunVisibleRaw = uSunRaw >= -0.02 && uSunRaw <= 1.02;
    const uSun = Math.max(0, Math.min(1, uSunRaw));
    const sunXFrac = 0.91 - uSun * 0.82;
    const sunAlt = Math.sin(uSun * Math.PI);
    const sunFadeIn = Math.min(1, Math.max(0, (uSunRaw + 0.02) / 0.06));
    const sunFadeOut = Math.min(1, Math.max(0, (1.02 - uSunRaw) / 0.06));
    const sunAlpha = (sunVisibleRaw && mode !== "dark") ? Math.min(sunFadeIn, sunFadeOut) : 0;
    const sun = {
      kind: "sun",
      xFrac: sunXFrac,
      x: w * sunXFrac,
      alt: sunAlt,
      slant: (0.5 - sunXFrac) * 1.18,
      visible: sunVisibleRaw && sunAlpha > 0.01,
      alpha: sunAlpha
    };

    // Lunar surface entry geometry (Rises East at Golden Hour ~17:30 -> Zenith at Midnight -> Sets West at Dawn ~06:15)
    const moonElapsed = ((hour - 17.5) % 24 + 24) % 24;
    const uMoonRaw = moonElapsed / 12.75;
    const moonVisibleRaw = uMoonRaw >= 0 && uMoonRaw <= 1.0;
    const uMoon = Math.max(0, Math.min(1, uMoonRaw));
    const moonXFrac = 0.89 - uMoon * 0.78;
    const moonAlt = Math.sin(uMoon * Math.PI);
    const moonFadeIn = Math.min(1, Math.max(0, uMoonRaw / 0.08));
    const moonFadeOut = Math.min(1, Math.max(0, (1.0 - uMoonRaw) / 0.12));
    const nightWeight = mode === "dark" ? 1.0 : (mode === "evening" || mode === "morning" ? 0.45 : 0);
    const moonAlpha = moonVisibleRaw ? Math.min(moonFadeIn, moonFadeOut) * nightWeight : 0;
    const moon = {
      kind: "moon",
      xFrac: moonXFrac,
      x: w * moonXFrac,
      alt: moonAlt,
      slant: (0.5 - moonXFrac) * 1.05,
      visible: moonVisibleRaw && moonAlpha > 0.04,
      alpha: moonAlpha
    };

    const primary = (mode === "dark" || !sun.visible)
      ? (moon.visible ? moon : { kind: "moon", xFrac: 0.50, x: w * 0.50, alt: 0.85, slant: 0, visible: true, alpha: 0.85 })
      : sun;

    return { hour, sun, moon, primary };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const seabedY = h * (isNarrow ? 0.79 : 0.76);
    const hubX = w * 0.50;
    const hubY = h * (isNarrow ? 0.61 : 0.585);
    const s = isNarrow ? Math.max(0.60, w / 620) : Math.min(1.06, Math.max(0.76, w / 1320));

    // Pre-fab horizontal station campus coordinates (wide clear berths between central hub & side wings!)
    const westWingX = isNarrow ? (hubX - 235 * s) : (hubX - 286 * s);
    const westWingY = hubY + 46 * s;
    const farWestX = hubX - 418 * s;  // Hydropower Tidal Turbine Farm!
    const farWestY = hubY + 70 * s;

    const eastWingX = isNarrow ? (hubX + 235 * s) : (hubX + 272 * s); // East Sensor Wing & Anchored Sonar Relay
    const eastWingY = hubY + 46 * s;
    const farEastX = hubX + 382 * s;
    const farEastY = hubY + 76 * s;

    // Diver Wet-Lock Airlock Aperture on West Fabrication Wing + Hub Lower Lock
    const airlockX = westWingX + 12 * s;
    const airlockY = westWingY + 12 * s;

    // Anchored Rotating Sonar Relay Dish Pedestal directly on East Sensor Wing module deck roof
    const sonarX = eastWingX - 14 * s;
    const sonarY = eastWingY - 24 * s;

    // Hydropower Tidal Turbines (Far West on seabed currents)
    const hydroBaseX = isNarrow ? (hubX - 188 * s) : farWestX;
    const hydroBaseY = isNarrow ? (hubY + 86 * s) : (farWestY + 10 * s);
    const hydroTurbines = isNarrow
      ? [{ x: hydroBaseX - 18 * s, y: hydroBaseY }, { x: hydroBaseX + 16 * s, y: hydroBaseY + 3 * s }]
      : [
          { x: hydroBaseX - 32 * s, y: hydroBaseY + 2 * s },
          { x: hydroBaseX, y: hydroBaseY - 4 * s },
          { x: hydroBaseX + 32 * s, y: hydroBaseY + 2 * s }
        ];

    // Level horizontal submarine docking piers spanning clean open-water berths clear of wings
    const leftAngle = Math.PI;
    const leftArmLen = 88 * s;
    const leftDockX = hubX - 20 * s - leftArmLen;
    const leftDockY = hubY + 24 * s;

    const rightAngle = 0;
    const rightArmLen = 92 * s;
    const rightDockX = hubX + 20 * s + rightArmLen;
    const rightDockY = hubY + 24 * s;

    // Geodesic Hydroponic Crop Greenhouse Dome (right-center terrace)
    const domeX = hubX + 106 * s;
    const domeY = hubY - 14 * s;

    // Vertical Surface Supply Elevator Shaft & Transfer Collar (left-rear terrace wing)
    const elevX = hubX - 92 * s;
    const elevDockY = hubY - 38 * s;

    // Expanded Horizontal Station Outer Wings (Desktop panoramic campus expansion!)
    const geoWestX = isNarrow ? farWestX : (hubX - 548 * s);
    const geoWestY = hubY + 76 * s;
    const outerEastX = isNarrow ? farEastX : (hubX + 516 * s);
    const outerEastY = hubY + 84 * s;

    // Grounded Sunken Shipwreck partially buried on unobstructed open East sandy seabed!
    const wreck = {
      x: w * (isNarrow ? 0.83 : 0.772),
      y: isNarrow ? (seabedY + 12) : (seabedY + 24),
      scale: isNarrow ? 0.45 : Math.min(0.90, Math.max(0.72, w / 1460))
    };

    // Habitat-Surrounding Manta Ray Cleaning Station Reefs (encompassing seabed BEHIND and IN FRONT OF station)
    const csScale = isNarrow ? 0.62 : Math.min(1.04, Math.max(0.78, w / 1380));
    const backReefs = isNarrow
      ? [
          { x: w * 0.25, y: this._seabedYAtX(w * 0.25, w, h, { seabedY }) - 14, scale: csScale * 0.92 },
          { x: w * 0.75, y: this._seabedYAtX(w * 0.75, w, h, { seabedY }) - 14, scale: csScale * 0.92 }
        ]
      : [
          { x: w * 0.220, y: this._seabedYAtX(w * 0.220, w, h, { seabedY }) - 16, scale: csScale * 0.90 },
          { x: w * 0.365, y: this._seabedYAtX(w * 0.365, w, h, { seabedY }) - 20, scale: csScale * 0.96 },
          { x: w * 0.635, y: this._seabedYAtX(w * 0.635, w, h, { seabedY }) - 20, scale: csScale * 0.96 },
          { x: w * 0.725, y: this._seabedYAtX(w * 0.725, w, h, { seabedY }) - 16, scale: csScale * 0.88 }
        ];
    const frontReefs = isNarrow
      ? [
          { x: w * 0.29, y: Math.min(h - 48, seabedY + 66), scale: csScale * 0.96 },
          { x: w * 0.69, y: Math.min(h - 48, seabedY + 66), scale: csScale * 0.94 }
        ]
      : [
          { x: w * 0.275, y: Math.min(h - 52, seabedY + 48), scale: csScale * 0.94 },
          { x: w * 0.425, y: Math.min(h - 46, seabedY + 56), scale: csScale * 1.04 },
          { x: w * 0.565, y: Math.min(h - 48, seabedY + 52), scale: csScale * 0.96 },
          { x: w * 0.680, y: Math.min(h - 52, seabedY + 44), scale: csScale * 0.86 }
        ];
    const cleaningStation = {
      x: frontReefs[0].x,
      y: frontReefs[0].y,
      scale: csScale,
      backReefs,
      frontReefs
    };

    return {
      isNarrow, seabedY, hubX, hubY, s,
      westWingX, westWingY, farWestX, farWestY, geoWestX, geoWestY,
      eastWingX, eastWingY, farEastX, farEastY, outerEastX, outerEastY,
      airlockX, airlockY, sonarX, sonarY, hydroTurbines,
      leftAngle, leftArmLen, leftDockX, leftDockY,
      rightAngle, rightArmLen, rightDockX, rightDockY,
      domeX, domeY, elevX, elevDockY, wreck, cleaningStation
    };
  },

  ensureStaticCache(w, h, mode, diurnalHour = null) {
    const cel = this.getCelestialLight(w, h, mode, diurnalHour);
    const hSlot = Math.round(cel.hour * 4);
    const key = `${Math.round(w)}x${Math.round(h)}:${mode}:h${hSlot}`;
    if (this.cacheCanvas && this.stationCacheCanvas && this.cacheKey === key) return;

    const cw = Math.max(1, Math.round(w));
    const ch = Math.max(1, Math.round(h));
    if (!this.cacheCanvas) {
      this.cacheCanvas = document.createElement("canvas");
    }
    if (!this.stationCacheCanvas) {
      this.stationCacheCanvas = document.createElement("canvas");
    }
    this.cacheCanvas.width = cw;
    this.cacheCanvas.height = ch;
    this.stationCacheCanvas.width = cw;
    this.stationCacheCanvas.height = ch;
    this.cacheKey = key;

    const ctx = this.cacheCanvas.getContext("2d");
    const sCtx = this.stationCacheCanvas.getContext("2d");
    sCtx.clearRect(0, 0, cw, ch);
    const pal = this.getPalette(mode);
    pal.celestial = cel;
    pal.diurnalHour = cel.hour;
    const L = this.getLayout(w, h);

    // 1. Vertical depth-graded ocean water column
    const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
    waterGrad.addColorStop(0, pal.waterTop);
    waterGrad.addColorStop(0.46, pal.waterMid);
    waterGrad.addColorStop(1, pal.waterBottom);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Ocean surface ceiling band + Directional Snell's Window Above-Water Sun/Moon Bloom
    ctx.save();
    const surfG = ctx.createLinearGradient(0, 0, 0, 60);
    surfG.addColorStop(0, pal.surfaceRipple);
    surfG.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = surfG;
    ctx.fillRect(0, 0, w, 60);

    const bloomR = Math.max(w * 0.44, h * 0.68);
    const bloomRgb = mode === "dark" ? "165, 224, 255" : pal.rayColor;
    const bloomA = (mode === "dark" ? 0.22 : (mode === "light" ? 0.34 : 0.38)) * Math.max(0.35, cel.primary.alpha);
    const snellG = ctx.createRadialGradient(cel.primary.x, -10, 6, cel.primary.x, 12, bloomR);
    snellG.addColorStop(0, `rgba(${bloomRgb}, ${bloomA.toFixed(3)})`);
    snellG.addColorStop(0.45, `rgba(${bloomRgb}, ${(bloomA * 0.35).toFixed(3)})`);
    snellG.addColorStop(1, `rgba(${bloomRgb}, 0)`);
    ctx.fillStyle = snellG;
    ctx.fillRect(0, 0, w, h * 0.72);
    ctx.restore();

    // 3. Multi-Layered Far Hazy Canyon Ridges & Ultra-Distant Seamounts
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 44) {
      const deepPeak = Math.pow(Math.abs((x / w) - 0.54) * 1.9, 1.35) * 124;
      const crag2 = Math.cos(x * 0.0042 + 1.1) * 34 + Math.sin(x * 0.011) * 10;
      ctx.lineTo(x, L.seabedY - 88 - deepPeak - crag2);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = pal.reefFar;
    ctx.globalAlpha = 0.22;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 36) {
      const canyon = Math.pow(Math.abs((x / w) - 0.50) * 1.85, 1.45) * 98;
      const crag = Math.sin(x * 0.0055 + 0.4) * 28 + Math.cos(x * 0.014) * 12;
      ctx.lineTo(x, L.seabedY - 46 - canyon - crag);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = pal.reefFar;
    ctx.globalAlpha = 0.42;
    ctx.fill();
    ctx.restore();

    // 4. Rich Volcanic & Rippled Sandy Canyon Floor
    ctx.save();
    const floorG = ctx.createLinearGradient(0, L.seabedY - 76, 0, h);
    floorG.addColorStop(0, pal.seabedLight);
    floorG.addColorStop(0.55, pal.seabedDark);
    floorG.addColorStop(1, pal.reefNear);
    ctx.fillStyle = floorG;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, L.seabedY - 12);
    ctx.quadraticCurveTo(w * 0.22, L.seabedY - 44, w * 0.50, L.seabedY - 58);
    ctx.quadraticCurveTo(w * 0.78, L.seabedY - 64, w, L.seabedY - 40);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle sand ripple ridges across shallow canyon floor
    ctx.strokeStyle = pal.waterBounce;
    ctx.globalAlpha = pal.isDark && !pal.isGoldenCoastal ? 0.08 : 0.16;
    ctx.lineWidth = 1.2;
    for (let row = 0; row < (L.isNarrow ? 3 : 6); row++) {
      const sy = L.seabedY + 8 + row * 24;
      if (sy > h - 8) break;
      ctx.beginPath();
      for (let x = w * 0.10; x <= w * 0.90; x += 48) {
        const wy = sy + Math.sin(x * 0.016 + row * 1.3) * 4;
        if (x === w * 0.10) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Scattered basalt boulders, benthic pebbles & seabed cable conduits
    ctx.globalAlpha = 0.78;
    for (let b = 0; b < (L.isNarrow ? 10 : 34); b++) {
      const bx = w * (0.06 + (b * 0.028) % 0.88);
      const minY = this._seabedYAtX(bx, w, h, L) + 8;
      const by = minY + ((b * 37) % Math.max(20, (h - minY - 10)));
      const br = 6 + (b % 5) * 5.0;
      ctx.fillStyle = b % 2 === 0 ? pal.reefMid : pal.seabedDark;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.6, br * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Armored benthic power cable conduit running cleanly across seabed from Hydropower Farm into West Wing (desktop)
    if (!L.isNarrow) {
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = 3.2 * L.s;
      ctx.beginPath();
      ctx.moveTo(L.hydroTurbines[0].x, L.hydroTurbines[0].y + 12 * L.s);
      ctx.quadraticCurveTo((L.hydroTurbines[0].x + L.westWingX) * 0.5, L.seabedY - 6, L.westWingX - 42 * L.s, L.westWingY + 26 * L.s);
      ctx.stroke();
    }
    ctx.restore();

    // 4b. Background Cleaning Station Coral Bommies BEHIND Habitat Wings & Walkways (drawn on background cache)
    this._drawCleaningStationBackReefs(ctx, L, pal);

    // 5. Industrial Pre-Fab Modular Seabed Research Station + Hydropower Farm + Clear Tubes + Greenhouse (on stationCacheCanvas for true behind/front occlusion!)
    this._drawResearchStation(sCtx, L, pal);

    // 5b. Unobstructed Grounded Sunken Shipwreck Partially Covered in Continuous Seabed Sand (clear in front of wing terrain skirts)
    this._drawBackgroundShipwreck(sCtx, L, pal);

    // 6. Lush Ground-Anchored Benthic Coral Reefs, Habitat-Surrounding Foreground Cleaning Pinnacles, Sponges & Chimneys
    this._drawSeabedReefs(sCtx, w, h, L, pal);
    this._drawCleaningStationReef(sCtx, L, pal);
    const floorSpots = L.isNarrow ? [] : [0.18, 0.88];
    floorSpots.forEach((xf, idx) => {
      const fx = w * xf;
      const fy = Math.min(h - 14, this._seabedYAtX(fx, w, h, L) + 18 + (idx % 3) * 18);
      this._drawBenthicSpongeCluster(sCtx, fx, fy, (10 + (idx % 3) * 3) * L.s, pal);
    });

    // Hydrothermal basalt vent mounds on canyon outskirts (desktop, clear of shipwreck stern)
    if (!L.isNarrow) {
      [w * 0.19, w * 0.88].forEach((vx) => {
        const vy = this._seabedYAtX(vx, w, h, L) + 12;
        sCtx.save();
        sCtx.fillStyle = pal.reefNear;
        sCtx.beginPath();
        sCtx.moveTo(vx - 14 * L.s, vy + 8 * L.s);
        sCtx.lineTo(vx - 5 * L.s, vy - 18 * L.s);
        sCtx.lineTo(vx + 5 * L.s, vy - 18 * L.s);
        sCtx.lineTo(vx + 16 * L.s, vy + 8 * L.s);
        sCtx.closePath();
        sCtx.fill();
        sCtx.restore();
      });
    }

    // 7. Framing Foreground Coral Cliffs & Strictly Ground-Anchored Reef Corals
    sCtx.save();
    sCtx.fillStyle = pal.reefNear;
    sCtx.beginPath();
    sCtx.moveTo(0, h);
    sCtx.lineTo(0, h * 0.67);
    sCtx.quadraticCurveTo(w * 0.06, h * 0.72, w * 0.14, h * 0.82);
    sCtx.quadraticCurveTo(w * 0.22, h * 0.90, w * 0.30, h);
    sCtx.closePath();
    sCtx.fill();

    sCtx.beginPath();
    sCtx.moveTo(w, h);
    sCtx.lineTo(w, h * 0.66);
    sCtx.quadraticCurveTo(w * 0.93, h * 0.73, w * 0.86, h * 0.84);
    sCtx.quadraticCurveTo(w * 0.78, h * 0.92, w * 0.70, h);
    sCtx.closePath();
    sCtx.fill();

    // Plant every foreground coral root 7px deeper than _cliffYAtX so ZERO floating!
    const fgCorals = L.isNarrow ? [0.06, 0.18, 0.82, 0.94] : [0.05, 0.11, 0.17, 0.23, 0.77, 0.83, 0.90, 0.95];
    fgCorals.forEach((cf, idx) => {
      const cx = w * cf;
      const cy = (this._cliffYAtX(cx, w, h) || h * 0.85) + 7;
      this._drawCoralCluster(sCtx, cx, cy, 17 + (idx % 3) * 4, pal.reefNear);
    });
    sCtx.restore();
  },

  // Rich Ground-Anchored Seabed Reef Terraces, Staghorn Branches, Plate Corals & Sea Fans
  _drawSeabedReefs(ctx, w, h, L, pal) {
    const s = L.s;
    const spots = L.isNarrow
      ? [0.08, 0.16, 0.84, 0.92]
      : [0.07, 0.14, 0.20, 0.87, 0.95];

    ctx.save();
    spots.forEach((xf, idx) => {
      const rx = w * xf;
      const baseSeabed = this._seabedYAtX(rx, w, h, L);
      const cliffY = this._cliffYAtX(rx, w, h);
      // Plant firmly into actual surface elevation (clearing central foundation)
      const ry = cliffY
        ? (cliffY + 9)
        : Math.min(h - 12, baseSeabed + 14 + (idx % 3) * 16);
      const sc = s * (0.78 + (idx % 4) * 0.16);

      // Rocky carbonate reef shelf mound
      ctx.fillStyle = idx % 2 === 0 ? pal.reefMid : pal.seabedDark;
      ctx.beginPath();
      ctx.ellipse(rx, ry + 3 * sc, 24 * sc, 6.5 * sc, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tiered Table / Plate Corals
      if (idx % 2 === 0) {
        ctx.fillStyle = pal.reefNear;
        ctx.fillRect(rx - 3 * sc, ry - 8 * sc, 6 * sc, 10 * sc);
        ctx.fillStyle = pal.isDark ? "rgba(45, 212, 191, 0.34)" : "rgba(20, 184, 166, 0.42)";
        ctx.beginPath();
        ctx.ellipse(rx - 6 * sc, ry - 9 * sc, 15 * sc, 3.8 * sc, -0.06, 0, Math.PI * 2);
        ctx.ellipse(rx + 8 * sc, ry - 5 * sc, 11 * sc, 3.0 * sc, 0.08, 0, Math.PI * 2);
        ctx.fill();
      }

      // Delicate Branching Sea Fan & Staghorn Silhouette
      const fanHue = idx % 3 === 0 ? "rgba(56, 189, 248, 0.30)" : (idx % 3 === 1 ? "rgba(45, 212, 191, 0.28)" : pal.coralTint || "rgba(251, 146, 180, 0.26)");
      ctx.strokeStyle = pal.reefNear;
      ctx.lineWidth = Math.max(1.1, 2.0 * sc);
      ctx.lineCap = "round";
      [-1, 0, 1].forEach(br => {
        ctx.beginPath();
        ctx.moveTo(rx + br * 4 * sc, ry + 2 * sc);
        ctx.quadraticCurveTo(rx + br * 12 * sc, ry - 12 * sc, rx + br * 16 * sc, ry - 22 * sc);
        ctx.stroke();
      });

      ctx.fillStyle = fanHue;
      ctx.beginPath();
      ctx.ellipse(rx, ry - 15 * sc, 13 * sc, 9 * sc, 0, Math.PI, 0);
      ctx.fill();
    });
    ctx.restore();
  },

  // Shared Ground-Anchored Coral Bommie Pinnacle Renderer (supports front foreground & water-hazed background reefs)
  _drawSingleCleaningPinnacle(ctx, rx, ry, sc, pal, isBg = false, variantIdx = 0) {
    ctx.save();
    ctx.translate(rx, ry);
    if (variantIdx % 2 === 1) ctx.scale(-1, 1);

    // 1. Continuous Seabed Sand Apron & Basalt Carbonate Base (firmly grounded, zero floating!)
    const moundG = ctx.createRadialGradient(0, 6 * sc, 8 * sc, 0, 10 * sc, 62 * sc);
    moundG.addColorStop(0, isBg ? pal.reefFar : pal.reefMid);
    moundG.addColorStop(0.65, pal.seabedDark);
    moundG.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = moundG;
    ctx.beginPath();
    ctx.ellipse(0, 10 * sc, 62 * sc, 15 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sculpted Multi-Tiered Coral Bommie Pinnacle Silhouette with dark shelter crevices for cleaner wrasse
    ctx.fillStyle = isBg ? pal.reefMid : pal.reefNear;
    ctx.beginPath();
    ctx.moveTo(-44 * sc, 10 * sc);
    ctx.quadraticCurveTo(-38 * sc, -10 * sc, -24 * sc, -16 * sc);
    ctx.quadraticCurveTo(-18 * sc, -30 * sc, -4 * sc, -34 * sc);
    ctx.quadraticCurveTo(14 * sc, -32 * sc, 20 * sc, -18 * sc);
    ctx.quadraticCurveTo(36 * sc, -12 * sc, 44 * sc, 10 * sc);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isBg ? pal.reefFar : pal.reefMid;
    ctx.beginPath();
    ctx.ellipse(-18 * sc, 2 * sc, 16 * sc, 8 * sc, 0.1, 0, Math.PI * 2);
    ctx.ellipse(16 * sc, 3 * sc, 14 * sc, 7 * sc, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Dark recessed reef cleaning arches/crevices
    ctx.fillStyle = pal.hullDeep;
    ctx.beginPath();
    ctx.ellipse(-9 * sc, -3 * sc, 7.5 * sc, 4.5 * sc, 0, Math.PI, 0);
    ctx.ellipse(12 * sc, -1 * sc, 6.2 * sc, 3.8 * sc, 0, Math.PI, 0);
    ctx.fill();

    // 3. Layered Acropora Table Coral Ledges + Brain Corals + Vibrant Staghorn Branches
    const hFade = isBg ? 0.65 : 1.0;
    const tableTeal = pal.isDark ? `rgba(45, 212, 191, ${(0.42 * hFade).toFixed(2)})` : `rgba(20, 184, 166, ${(0.56 * hFade).toFixed(2)})`;
    const brainCoral = pal.isDark ? `rgba(244, 114, 182, ${(0.34 * hFade).toFixed(2)})` : `rgba(244, 114, 182, ${(0.48 * hFade).toFixed(2)})`;
    const amberPolyp = pal.isDark ? `rgba(56, 189, 248, ${(0.50 * hFade).toFixed(2)})` : `rgba(245, 158, 11, ${(0.54 * hFade).toFixed(2)})`;

    ctx.fillStyle = tableTeal;
    ctx.beginPath();
    ctx.ellipse(-20 * sc, -16 * sc, 16 * sc, 4.2 * sc, -0.10, 0, Math.PI * 2);
    ctx.ellipse(18 * sc, -15 * sc, 14 * sc, 3.6 * sc, 0.08, 0, Math.PI * 2);
    ctx.ellipse(0, -31 * sc, 15 * sc, 3.8 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = brainCoral;
    ctx.beginPath();
    ctx.arc(-11 * sc, -19 * sc, 7.5 * sc, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = pal.isDark ? `rgba(103, 232, 249, ${(0.46 * hFade).toFixed(2)})` : `rgba(251, 146, 180, ${(0.62 * hFade).toFixed(2)})`;
    ctx.lineWidth = Math.max(1.2, 2.2 * sc);
    ctx.lineCap = "round";
    [-12, -2, 8, 22].forEach((bx, idx) => {
      const hBr = (14 + (idx % 2) * 5) * sc;
      const baseY = idx === 3 ? -12 * sc : -26 * sc;
      ctx.beginPath();
      ctx.moveTo(bx * sc, baseY);
      ctx.quadraticCurveTo((bx - 3) * sc, baseY - hBr * 0.5, (bx - 5) * sc, baseY - hBr);
      ctx.moveTo(bx * sc, baseY - hBr * 0.45);
      ctx.quadraticCurveTo((bx + 4) * sc, baseY - hBr * 0.72, (bx + 6) * sc, baseY - hBr * 0.92);
      ctx.stroke();
    });

    ctx.fillStyle = amberPolyp;
    [-26, -15, -6, 3, 12, 24].forEach((px, idx) => {
      ctx.beginPath();
      ctx.arc(px * sc, (-15 - (idx % 3) * 6) * sc, (1.4 + (idx % 2) * 0.5) * sc, 0, Math.PI * 2);
      ctx.fill();
    });

    if (isBg) {
      ctx.fillStyle = `rgba(${pal.waterHazeRgb}, 0.24)`;
      ctx.beginPath();
      ctx.ellipse(0, -10 * sc, 54 * sc, 32 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawCleaningStationBackReefs(ctx, L, pal) {
    const cs = L.cleaningStation;
    if (!cs || !cs.backReefs) return;
    cs.backReefs.forEach((rf, idx) => {
      this._drawSingleCleaningPinnacle(ctx, rf.x, rf.y, rf.scale, pal, true, idx);
    });
  },

  // Habitat-Surrounding Foreground Manta Ray Cleaning Station Coral Pinnacles
  _drawCleaningStationReef(ctx, L, pal) {
    const cs = L.cleaningStation;
    if (!cs) return;
    const list = cs.frontReefs || [cs];
    list.forEach((rf, idx) => {
      this._drawSingleCleaningPinnacle(ctx, rf.x, rf.y, rf.scale, pal, false, idx);
    });
  },

  _drawBenthicSpongeCluster(ctx, x, y, sc, pal) {
    ctx.save();
    ctx.fillStyle = pal.reefMid;
    [-6, 0, 6].forEach((ox, idx) => {
      const th = sc * (0.7 + (idx % 2) * 0.4);
      ctx.beginPath();
      ctx.roundRect(x + ox * (sc * 0.10) - 2.2, y - th, 4.4, th + 3, 2);
      ctx.fill();
    });
    ctx.fillStyle = pal.reefNear;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, sc * 0.9, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawCoralCluster(ctx, x, y, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 2.8;
    [-0.62, -0.24, 0.14, 0.54].forEach((ang, idx) => {
      const len = size * (0.7 + (idx % 2) * 0.34);
      const bx = x + Math.sin(ang) * len;
      const by = y - Math.cos(ang) * len;
      ctx.beginPath();
      ctx.moveTo(x, y + 3); // Anchor base firmly inside rock
      ctx.quadraticCurveTo(x + Math.sin(ang) * len * 0.45, y - len * 0.55, bx, by);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(ang) * len * 0.55, y - Math.cos(ang) * len * 0.55);
      ctx.lineTo(bx + (idx % 2 === 0 ? -5.5 : 5.5), by - 3.5);
      ctx.stroke();
      ctx.lineWidth = 2.8;
    });
    ctx.restore();
  },

  _drawWindowBand(ctx, x, y, w, h, mullions, pal, s, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal.windowRecess;
    ctx.fillRect(x, y - 0.8 * s, w, h + 1.6 * s);

    const wg = ctx.createLinearGradient(0, y, 0, y + h);
    wg.addColorStop(0, pal.windowTop);
    wg.addColorStop(0.45, pal.windowMid);
    wg.addColorStop(1, pal.windowBot);
    ctx.fillStyle = wg;
    ctx.fillRect(x + 1.2 * s, y, Math.max(1, w - 2.4 * s), h);

    ctx.fillStyle = pal.glassHighlight;
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillRect(x + 1.2 * s, y, Math.max(1, w - 2.4 * s), Math.max(0.8, h * 0.24));
    ctx.globalAlpha = alpha;

    if (mullions > 0) {
      ctx.fillStyle = pal.hullDark;
      const step = (w - 2.4 * s) / (mullions + 1);
      for (let m = 1; m <= mullions; m++) {
        ctx.fillRect(x + 1.2 * s + step * m - 0.6 * s, y - 0.4 * s, 1.2 * s, h + 0.8 * s);
      }
    }
    ctx.restore();
  },

  _drawExteriorFloodlight(ctx, x, y, spreadW, dropH, pal) {
    ctx.save();
    if (pal.isDark) ctx.globalCompositeOperation = "screen";
    const rad = Math.max(spreadW * 0.72, dropH * 0.85);
    const fg = ctx.createRadialGradient(x, y + dropH * 0.25, 2, x, y + dropH * 0.55, rad);
    fg.addColorStop(0, `rgba(${pal.floodlightRgb}, ${(pal.floodlightAlpha * 0.58).toFixed(3)})`);
    fg.addColorStop(0.55, `rgba(${pal.floodlightRgb}, ${(pal.floodlightAlpha * 0.18).toFixed(3)})`);
    fg.addColorStop(1, `rgba(${pal.floodlightRgb}, 0)`);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(x, y + dropH * 0.52, spreadW * 0.72, dropH * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 2.5D Extruded Modular Hexagonal Hard-Sci-Fi + Biophilic Habitat Pod (Eye-level ~10 deg perspective!)
  _drawHexModule(ctx, cx, cy, rx, ry, height, pal, s, opts = {}) {
    const capRy = Math.min(ry, rx * 0.16);
    const verts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      verts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * capRy });
    }
    const wallOrder = [
      { i0: 2, i1: 3, shade: pal.hullLight },
      { i0: 1, i1: 2, shade: pal.hullMid },
      { i0: 0, i1: 1, shade: pal.hullDark }
    ];

    ctx.save();
    // Seabed / plinth cast shadow matched to eye-level camera compression
    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(cx + 6 * s, cy + height + capRy * 0.35, rx * 1.10, capRy * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Extruded vertical hexagonal facets with sharp architectural seam framing
    wallOrder.forEach(wSpec => {
      const p0 = verts[wSpec.i0];
      const p1 = verts[wSpec.i1];
      ctx.fillStyle = wSpec.shade;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x, p1.y + height);
      ctx.lineTo(p0.x, p0.y + height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.hullDeep;
      ctx.lineWidth = Math.max(0.8, 1.05 * s);
      ctx.stroke();

      // Modern floor-to-ceiling curtain-wall glass glazing + biophilic interior greenery
      if (height >= 16 * s) {
        const inset = 0.16;
        const g0x = this._lerp(p0.x, p1.x, inset);
        const g0y = this._lerp(p0.y, p1.y, inset);
        const g1x = this._lerp(p0.x, p1.x, 1 - inset);
        const g1y = this._lerp(p0.y, p1.y, 1 - inset);
        const winTop = height * 0.22;
        const winBot = height * 0.80;

        ctx.fillStyle = pal.isDark ? "rgba(18, 36, 56, 0.88)" : "rgba(24, 58, 78, 0.64)";
        ctx.beginPath();
        ctx.moveTo(g0x, g0y + winTop);
        ctx.lineTo(g1x, g1y + winTop);
        ctx.lineTo(g1x, g1y + winBot);
        ctx.lineTo(g0x, g0y + winBot);
        ctx.closePath();
        ctx.fill();

        // Warm minimalist interior glow + vertical biophilic plant strips visible through glass
        ctx.fillStyle = pal.windowMid;
        ctx.beginPath();
        ctx.moveTo(this._lerp(g0x, g1x, 0.1), this._lerp(g0y, g1y, 0.1) + winTop + 1.5 * s);
        ctx.lineTo(this._lerp(g0x, g1x, 0.9), this._lerp(g0y, g1y, 0.9) + winTop + 1.5 * s);
        ctx.lineTo(this._lerp(g0x, g1x, 0.9), this._lerp(g0y, g1y, 0.9) + winBot - 1.5 * s);
        ctx.lineTo(this._lerp(g0x, g1x, 0.1), this._lerp(g0y, g1y, 0.1) + winBot - 1.5 * s);
        ctx.closePath();
        ctx.fill();

        if (opts.biophilic !== false && wSpec.i0 !== 0) {
          ctx.fillStyle = pal.cropRow;
          const b0x = this._lerp(g0x, g1x, 0.18);
          const b0y = this._lerp(g0y, g1y, 0.18);
          const b1x = this._lerp(g0x, g1x, 0.42);
          const b1y = this._lerp(g0y, g1y, 0.42);
          ctx.beginPath();
          ctx.moveTo(b0x, b0y + winTop + 2 * s);
          ctx.lineTo(b1x, b1y + winTop + 2 * s);
          ctx.lineTo(b1x, b1y + winBot - 1 * s);
          ctx.lineTo(b0x, b0y + winBot - 1 * s);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // Hard-sci-fi hexagonal flat titanium roof cap + recessed biophilic trim ring
    const roofG = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    roofG.addColorStop(0, pal.hullLight);
    roofG.addColorStop(0.65, pal.hullMid);
    roofG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = roofG;
    ctx.beginPath();
    verts.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.waterBounce;
    ctx.lineWidth = Math.max(0.9, 1.3 * s);
    ctx.stroke();

    // Inner hexagonal parapet & living rooftop garden inset on main decks
    ctx.strokeStyle = opts.biophilic ? pal.cropRow : pal.subAccent;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = Math.max(0.8, 1.2 * s);
    ctx.beginPath();
    verts.forEach((v, i) => {
      const ix = cx + (v.x - cx) * 0.72;
      const iy = cy + (v.y - cy) * 0.72;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // Stepped Hexagonal Monolith Seabed Foundation (zero stilts — clean angular minimalist armor & Moonpool Arch)
  _drawSeabedFoundation(ctx, cx, topY, botY, topW, botW, pal, s, opts = {}) {
    ctx.save();
    const h = Math.max(22, botY - topY);
    const windowRows = opts.windowRows !== undefined ? opts.windowRows : 2;

    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, botY + 4 * s, botW * 0.56, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const midY = topY + h * 0.46;
    const midW = topW + (botW - topW) * 0.40;
    const ch = 14 * s; // Crisp angular hexagonal plinth taper

    const lowG = ctx.createLinearGradient(cx - botW * 0.5, 0, cx + botW * 0.5, 0);
    lowG.addColorStop(0, pal.hullLight);
    lowG.addColorStop(0.35, pal.hullMid);
    lowG.addColorStop(0.75, pal.hullMid);
    lowG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = lowG;
    ctx.beginPath();
    ctx.moveTo(cx - midW * 0.5 + ch, midY);
    ctx.lineTo(cx + midW * 0.5 - ch, midY);
    ctx.lineTo(cx + midW * 0.5, midY + h * 0.16);
    ctx.lineTo(cx + botW * 0.5, botY + 12 * s);
    ctx.lineTo(cx - botW * 0.5, botY + 12 * s);
    ctx.lineTo(cx - midW * 0.5, midY + h * 0.16);
    ctx.closePath();
    ctx.fill();

    // Crisp angular shadowed right flank
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(cx + midW * 0.26, midY);
    ctx.lineTo(cx + midW * 0.5 - ch, midY);
    ctx.lineTo(cx + midW * 0.5, midY + h * 0.16);
    ctx.lineTo(cx + botW * 0.5, botY + 12 * s);
    ctx.lineTo(cx + botW * 0.24, botY + 12 * s);
    ctx.closePath();
    ctx.fill();

    // Upper hexagonal minimalist apron deck
    ctx.fillStyle = lowG;
    ctx.beginPath();
    ctx.moveTo(cx - topW * 0.5 + ch, topY);
    ctx.lineTo(cx + topW * 0.5 - ch, topY);
    ctx.lineTo(cx + topW * 0.5, topY + h * 0.14);
    ctx.lineTo(cx + midW * 0.52, midY + 2 * s);
    ctx.lineTo(cx - midW * 0.52, midY + 2 * s);
    ctx.lineTo(cx - topW * 0.5, topY + h * 0.14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(cx - midW * 0.52, midY - 1.5 * s, midW * 1.04, 3.6 * s);
    ctx.fillStyle = pal.waterBounce;
    ctx.fillRect(cx - topW * 0.5 + ch, topY, topW - ch * 2, 1.8 * s);

    // Modular angular architectural armor panel seams
    ctx.strokeStyle = pal.hullDeep;
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = 0.85 * s;
    for (let f = -0.32; f <= 0.32; f += 0.16) {
      ctx.beginPath();
      ctx.moveTo(cx + topW * f, topY + 2 * s);
      ctx.lineTo(cx + botW * f, botY + 10 * s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Integral Armored Wing Buttress Ribs
    ctx.fillStyle = pal.hullDeep;
    ctx.globalAlpha = 0.40;
    [-0.28, -0.09, 0.12].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(cx + topW * f - 1.8 * s, topY);
      ctx.lineTo(cx + topW * f + 1.8 * s, topY);
      ctx.lineTo(cx + botW * f + 2.8 * s, botY + 10 * s);
      ctx.lineTo(cx + botW * f - 2.8 * s, botY + 10 * s);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const rowFracs = windowRows === 1 ? [0.34] : (windowRows === 2 ? [0.24, 0.62] : []);
    rowFracs.forEach((f, idx) => {
      const wy = topY + h * f;
      const bandW = topW * (idx === 0 ? 0.64 : 0.72) * 0.85;
      const bx = cx - topW * (idx === 0 ? 0.36 : 0.40);
      this._drawWindowBand(ctx, bx, wy, bandW, 3.6 * s, Math.max(3, Math.round(bandW / (22 * s))), pal, s);
    });

    if (!opts.noFloodlight) {
      // Illuminated Wet-Dock Moonpool Arch recessed along central plinth base
      const archX = cx + botW * 0.02;
      const archY = botY + 11 * s;
      const archW = 34 * s;
      const archH = 19 * s;
      ctx.fillStyle = pal.hullDeep;
      ctx.beginPath();
      ctx.moveTo(archX - archW * 0.5, archY);
      ctx.lineTo(archX - archW * 0.42, archY - archH);
      ctx.lineTo(archX + archW * 0.42, archY - archH);
      ctx.lineTo(archX + archW * 0.5, archY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(${pal.elevatorGlow}, ${pal.isDark ? 0.28 : 0.18})`;
      ctx.fillRect(archX - archW * 0.34, archY - archH * 0.82, archW * 0.68, archH * 0.78);
      ctx.strokeStyle = pal.trimGold;
      ctx.lineWidth = 1.2 * s;
      ctx.strokeRect(archX - archW * 0.38, archY - archH * 0.88, archW * 0.76, archH * 0.86);

      this._drawExteriorFloodlight(ctx, cx - botW * 0.24, midY + 2 * s, 44 * s, (botY - midY) + 14 * s, pal);
      this._drawExteriorFloodlight(ctx, cx + botW * 0.18, midY + 2 * s, 40 * s, (botY - midY) + 14 * s, pal);
    }

    ctx.fillStyle = pal.reefMid;
    ctx.beginPath();
    ctx.moveTo(cx - botW * 0.64, botY + 20 * s);
    ctx.quadraticCurveTo(cx - botW * 0.36, botY - 8 * s, cx - botW * 0.12, botY - 2 * s);
    ctx.quadraticCurveTo(cx + botW * 0.18, botY - 10 * s, cx + botW * 0.42, botY - 3 * s);
    ctx.quadraticCurveTo(cx + botW * 0.58, botY - 8 * s, cx + botW * 0.66, botY + 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Boxy Angular Hard-Sci-Fi Supplementary Building with Brushed Panelling & Modern Glass Curtain Windows
  _drawArchitecturalModule(ctx, x, y, bw, bh, pal, s, opts = {}) {
    const frontW = bw * 0.68;
    const depthX = bw * 0.32;
    const bevel = Math.min(7.5 * s, bh * 0.24);

    ctx.save();
    ctx.fillStyle = pal.hullShadow;
    ctx.fillRect(x + 3 * s, y + bh - 2 * s, bw, 5 * s);

    const mg = ctx.createLinearGradient(x, y, x, y + bh);
    mg.addColorStop(0, pal.hullLight);
    mg.addColorStop(0.65, pal.hullMid);
    mg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = mg;

    // Crisp boxy 90-degree front volume (modern minimalist slab)
    ctx.fillRect(x, y, frontW, bh);

    // Isometric shaded angular right elevation
    const sideG = ctx.createLinearGradient(x + frontW, y, x + bw, y + bh);
    sideG.addColorStop(0, pal.hullDark);
    sideG.addColorStop(1, pal.hullDeep);
    ctx.fillStyle = sideG;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + bw, y + bevel * 0.55);
    ctx.lineTo(x + bw, y + bh + bevel * 0.32);
    ctx.lineTo(x + frontW, y + bh);
    ctx.closePath();
    ctx.fill();

    // Flat angular cantilevered roof slab + crisp metallic drip edge
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(x - 1.5 * s, y);
    ctx.lineTo(x + depthX * 0.65, y - bevel);
    ctx.lineTo(x + bw + 1.5 * s, y - bevel + bevel * 0.55);
    ctx.lineTo(x + frontW + 1.5 * s, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.waterBounce;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(x - 1.5 * s, y);
    ctx.lineTo(x + frontW + 1.5 * s, y);
    ctx.stroke();

    // Boxy Angular Structural Panel Seams
    ctx.strokeStyle = pal.hullDeep;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 0.85 * s;
    [0.25, 0.50, 0.75].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(x + frontW * f, y + 1 * s);
      ctx.lineTo(x + frontW * f, y + bh - 1 * s);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y + bh * 0.50);
    ctx.lineTo(x + frontW - 1 * s, y + bh * 0.50);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Modern Large Floor-to-Ceiling Mullioned Glass Windows (+ interior biophilic accent)
    const rows = opts.rows || 1;
    for (let r = 0; r < rows; r++) {
      const wy = y + bh * (rows === 1 ? 0.24 : (0.18 + r * 0.38));
      const wh = Math.max(3.6 * s, bh * (rows === 1 ? 0.48 : 0.26));
      this._drawWindowBand(ctx, x + 5 * s, wy, frontW - 10 * s, wh, 4, pal, s);
      this._drawWindowBand(ctx, x + frontW + 3 * s, wy + 1.2 * s, Math.max(4 * s, depthX * 0.50), wh * 0.86, 1, pal, s, 0.72);
    }

    if (opts.hasTanks) {
      // Minimalist angular rooftop climate-handling unit (boxy, never curved!)
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(x + frontW * 0.20, y - bevel - 4.5 * s, frontW * 0.52, 4.8 * s);
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(x + frontW * 0.24, y - bevel - 3.6 * s, 3.0 * s, 2.8 * s);
    }
    ctx.restore();
  },

  // Hydropower Tidal Turbine Farm Anchored on Concrete Gravity Plinths Next to Base
  _drawHydropowerFarm(ctx, L, pal) {
    const s = L.s;
    const turbines = L.hydroTurbines;
    ctx.save();

    // Grounded concrete seabed gravity piers anchoring manifold sill down into terrace bedrock
    const leftX = turbines[0].x - 20 * s;
    const rightX = turbines[turbines.length - 1].x + 20 * s;
    const baseY = turbines[0].y + 12 * s;
    const pierBottom = Math.max(L.seabedY + 2 * s, baseY + 28 * s);
    [turbines[0].x, turbines[turbines.length - 1].x].forEach(px => {
      ctx.fillStyle = pal.hullDeep;
      ctx.beginPath();
      ctx.moveTo(px - 10 * s, baseY + 6 * s);
      ctx.lineTo(px + 10 * s, baseY + 6 * s);
      ctx.lineTo(px + 15 * s, pierBottom);
      ctx.lineTo(px - 15 * s, pierBottom);
      ctx.closePath();
      ctx.fill();
    });

    // Shared concrete tidal manifold sill connecting turbine footings
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(leftX, baseY, rightX - leftX, 8 * s);
    ctx.fillStyle = pal.waterBounce;
    ctx.fillRect(leftX, baseY, rightX - leftX, 1.4 * s);

    turbines.forEach(tb => {
      // Gravity pedestal pylon
      ctx.fillStyle = pal.hullMid;
      ctx.beginPath();
      ctx.moveTo(tb.x - 9 * s, baseY + 2 * s);
      ctx.lineTo(tb.x - 5 * s, tb.y);
      ctx.lineTo(tb.x + 5 * s, tb.y);
      ctx.lineTo(tb.x + 9 * s, baseY + 2 * s);
      ctx.closePath();
      ctx.fill();

      // Ducted cylindrical tidal turbine nacelle
      ctx.fillStyle = pal.hullDark;
      ctx.beginPath();
      ctx.ellipse(tb.x, tb.y - 2 * s, 14 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 2.0 * s;
      ctx.beginPath();
      ctx.arc(tb.x, tb.y - 2 * s, 12.5 * s, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();

      // Inner water aperture
      ctx.fillStyle = pal.waterBottom;
      ctx.beginPath();
      ctx.arc(tb.x, tb.y - 2 * s, 9.5 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  // Live animated spinning blades inside the Hydropower Tidal Turbine shrouds!
  _updateAndDrawTurbines(ctx, L, pal, step) {
    if (L.isNarrow) return;
    const s = L.s;
    const turbines = L.hydroTurbines;
    ctx.save();
    turbines.forEach((tb, idx) => {
      const cx = tb.x;
      const cy = tb.y - 2 * s;
      const r = 8.6 * s;
      const rot = step * (2.6 + idx * 0.15);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = pal.hullLight;
      for (let b = 0; b < 3; b++) {
        ctx.save();
        ctx.rotate((b * Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.moveTo(0, -1.2 * s);
        ctx.lineTo(r, -2.2 * s);
        ctx.lineTo(r * 0.85, 1.4 * s);
        ctx.lineTo(0, 1.0 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Hub spinner nose + cyan generator telemetry LED
      ctx.fillStyle = pal.subAccent;
      ctx.beginPath();
      ctx.arc(0, 0, 2.4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Crown generator status light
      ctx.fillStyle = "#22D3EE";
      ctx.beginPath();
      ctx.arc(cx, cy - 12.5 * s, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  // Rotating Sonar & Acoustic Communications Dish Relay Anchored Flush onto East Sensor Wing
  _drawSonarRelay(ctx, L, pal) {
    const s = L.s;
    const sx = L.sonarX;
    const sy = L.sonarY;
    const roofY = L.eastWingY - 15.5 * s;
    ctx.save();
    // Structural steel baseplate bolted directly onto East Sensor Wing roof deck
    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(sx - 10 * s, roofY - 2.5 * s, 20 * s, 4.0 * s);
    // Tapered braced support pedestal rising continuously from roof up into rotary housing
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(sx - 7 * s, roofY - 2 * s);
    ctx.lineTo(sx - 4.5 * s, sy - 6 * s);
    ctx.lineTo(sx + 4.5 * s, sy - 6 * s);
    ctx.lineTo(sx + 7 * s, roofY - 2 * s);
    ctx.closePath();
    ctx.fill();
    // Diagonal structural truss brace & polygonal rotary collar ring
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = Math.max(0.8, 1.1 * s);
    ctx.beginPath();
    ctx.moveTo(sx - 5.5 * s, roofY - 2.5 * s);
    ctx.lineTo(sx + 4 * s, sy - 6 * s);
    ctx.moveTo(sx + 5.5 * s, roofY - 2.5 * s);
    ctx.lineTo(sx - 4 * s, sy - 6 * s);
    ctx.stroke();
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(sx - 5.2 * s, sy - 8.5 * s, 10.4 * s, 3.0 * s);
    ctx.restore();
  },

  _updateAndDrawSonarArray(ctx, L, pal, step) {
    const s = L.s;
    const sx = L.sonarX;
    const sy = L.sonarY - 11.5 * s;
    const sweep = Math.sin(step * 0.9) * 0.85;

    ctx.save();
    // Solid gimbal yoke stem anchoring dish hub directly down into rotary collar (zero floating gap!)
    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(sx - 2.0 * s, sy - 1 * s, 4.0 * s, 6.0 * s);

    ctx.translate(sx, sy);
    ctx.scale(Math.cos(sweep) * 0.95 + 0.15, 1);

    // Parabolic hydrophone transceiver dish + phased array transducer bar
    ctx.fillStyle = pal.hullLight;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 6.5 * s, -0.2, Math.PI * 0.85, Math.PI * 2.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.subAccent;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 0);
    ctx.lineTo(10 * s, -2 * s);
    ctx.stroke();

    // Central emitter feed horn pulsing aqua
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.5);
    ctx.fillStyle = `rgba(34, 211, 238, ${(0.45 + 0.45 * pulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, -6 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // Crop Cultivation Greenhouse Dome with Faceted Polygonal Glass & Interior Green Hydroponic Rows!
  _drawGreenhouseDome(ctx, L, pal) {
    const s = L.s;
    ctx.save();
    ctx.translate(L.domeX, L.domeY + 12 * s);

    // Chamfered steel skirt base
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.ellipse(0, 3 * s, 46 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-44 * s, 3 * s, 88 * s, 16 * s);
    this._drawWindowBand(ctx, -34 * s, 8 * s, 68 * s, 4.4 * s, 5, pal, s);

    // Interior ambient warm/horticultural grow-light glow visible through glass
    const bioG = ctx.createRadialGradient(-4 * s, -12 * s, 4 * s, 0, -6 * s, 40 * s);
    bioG.addColorStop(0, pal.biodomeFlora);
    bioG.addColorStop(0.62, pal.isDark ? "rgba(253, 224, 146, 0.34)" : "rgba(218, 246, 255, 0.46)");
    bioG.addColorStop(1, "rgba(186, 230, 253, 0.14)");
    ctx.fillStyle = bioG;
    ctx.beginPath();
    ctx.arc(0, 0, 38 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Visible Tiered Interior Hydroponic Crop Cultivation Racks & Leafy Canopy Rows!
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 36 * s, Math.PI, 0);
    ctx.closePath();
    ctx.clip();

    // Upper & lower metallic hydroponic shelf trays
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-26 * s, -6 * s, 52 * s, 2.2 * s);
    ctx.fillRect(-20 * s, -16 * s, 40 * s, 2.0 * s);

    // Leafy green crop domes along both cultivation tiers
    ctx.fillStyle = pal.cropRow;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(k * 5.2 * s, -6.5 * s, 3.4 * s, Math.PI, 0);
      ctx.fill();
    }
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(k * 5.0 * s, -16.5 * s, 2.8 * s, Math.PI, 0);
      ctx.fill();
    }

    // Overhead horticultural grow-light fixture ribs inside dome
    ctx.strokeStyle = pal.isDark ? "rgba(134, 239, 172, 0.78)" : "rgba(34, 197, 94, 0.45)";
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(-18 * s, -22 * s);
    ctx.lineTo(18 * s, -22 * s);
    ctx.moveTo(-22 * s, -12 * s);
    ctx.lineTo(22 * s, -12 * s);
    ctx.stroke();
    ctx.restore();

    // Glass specular highlight arc
    ctx.strokeStyle = pal.glassHighlight;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2.0 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * s, Math.PI * 1.15, Math.PI * 1.48);
    ctx.stroke();

    // Polygonal geodesic dome truss struts
    ctx.strokeStyle = pal.hullLight;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 38 * s, Math.PI, 0);
    ctx.moveTo(-38 * s, 0);
    ctx.lineTo(38 * s, 0);
    ctx.moveTo(-34 * s, -16 * s);
    ctx.lineTo(34 * s, -16 * s);
    ctx.moveTo(-23 * s, -29 * s);
    ctx.lineTo(23 * s, -29 * s);
    [-21, -9, 0, 9, 21].forEach(rx => {
      ctx.moveTo(rx * s, 0);
      ctx.lineTo(rx * 0.55 * s, -29 * s);
      ctx.lineTo(0, -38 * s);
    });
    ctx.stroke();
    ctx.restore();
  },

  // Crystal-Clear Pressurized Acrylic Glass Walkway Tube connecting horizontal station modules
  _drawClearGlassTube(ctx, x0, y0, x1, y1, thickness, s, pal, opts = {}) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 4) return;
    const halfT = thickness * 0.5;
    const hazeAlpha = opts.depthAlpha !== undefined ? opts.depthAlpha : 1;

    ctx.save();
    ctx.globalAlpha = hazeAlpha;
    ctx.translate(x0, y0);
    ctx.rotate(ang);

    if (pal.isDark) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const haloG = ctx.createLinearGradient(0, -halfT * 1.8, 0, halfT * 1.8);
      haloG.addColorStop(0, "rgba(165, 243, 252, 0)");
      haloG.addColorStop(0.5, `rgba(165, 243, 252, ${(0.12 * hazeAlpha).toFixed(3)})`);
      haloG.addColorStop(1, "rgba(165, 243, 252, 0)");
      ctx.fillStyle = haloG;
      ctx.fillRect(4 * s, -halfT * 1.8, Math.max(0, len - 8 * s), thickness * 1.8);
      ctx.restore();
    }

    const glassG = ctx.createLinearGradient(0, -halfT, 0, halfT);
    glassG.addColorStop(0, pal.glassHighlight);
    glassG.addColorStop(0.18, pal.glassTint);
    glassG.addColorStop(0.62, "rgba(255, 255, 255, 0.05)");
    glassG.addColorStop(0.84, pal.glassTint);
    glassG.addColorStop(1, pal.glassRim);
    ctx.fillStyle = glassG;
    ctx.fillRect(0, -halfT, len, thickness);

    const floorTop = halfT * 0.34;
    const floorH = halfT - floorTop;
    ctx.fillStyle = pal.tubeFloor;
    ctx.globalAlpha = hazeAlpha * 0.88;
    ctx.fillRect(0, floorTop, len, floorH);

    ctx.fillStyle = pal.tubeWarmGlow;
    ctx.globalAlpha = hazeAlpha;
    ctx.fillRect(3 * s, floorTop - 1.3 * s, Math.max(0, len - 6 * s), 1.6 * s);

    ctx.strokeStyle = pal.waterBounce;
    ctx.globalAlpha = hazeAlpha * 0.34;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(4 * s, floorTop - 4.0 * s);
    ctx.lineTo(len - 4 * s, floorTop - 4.0 * s);
    ctx.stroke();

    // Vertical handrail stanchions & interior technician silhouettes along transparent gallery
    const stanchions = Math.max(4, Math.floor(len / (14 * s)));
    ctx.fillStyle = pal.hullDark;
    ctx.globalAlpha = hazeAlpha * 0.48;
    for (let k = 1; k < stanchions; k++) {
      ctx.fillRect((k / stanchions) * len, floorTop - 4.0 * s, 0.9 * s, 4.0 * s);
    }
    ctx.globalAlpha = hazeAlpha;

    const segs = Math.max(3, Math.floor(len / (22 * s)));
    ctx.globalAlpha = hazeAlpha;
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = 2.0 * s;
      ctx.beginPath();
      ctx.moveTo(sx, -halfT - 0.8 * s);
      ctx.quadraticCurveTo(sx + 2.6 * s, 0, sx, halfT + 0.8 * s);
      ctx.stroke();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(sx - 0.5 * s, -halfT - 0.8 * s);
      ctx.quadraticCurveTo(sx + 1.4 * s, -halfT * 0.35, sx + 1.1 * s, -halfT * 0.05);
      ctx.stroke();
    }

    ctx.strokeStyle = pal.glassRim;
    ctx.lineWidth = 1.0 * s;
    ctx.beginPath();
    ctx.moveTo(0, -halfT);
    ctx.lineTo(len, -halfT);
    ctx.moveTo(0, halfT);
    ctx.lineTo(len, halfT);
    ctx.stroke();

    ctx.strokeStyle = pal.glassHighlight;
    ctx.globalAlpha = hazeAlpha * 0.65;
    ctx.lineWidth = 1.15 * s;
    ctx.beginPath();
    ctx.moveTo(4 * s, -halfT * 0.62);
    ctx.lineTo(len - 4 * s, -halfT * 0.62);
    ctx.stroke();

    ctx.globalAlpha = hazeAlpha;
    [0, len - 6.5 * s].forEach(cx => {
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(cx, -halfT * 1.16, 6.5 * s, thickness * 1.16);
      ctx.fillStyle = pal.hullLight;
      ctx.fillRect(cx + 1.2 * s, -halfT * 1.16, 1.8 * s, thickness * 0.38);
    });

    ctx.restore();
  },

  _drawSupplyElevatorShaft(ctx, L, pal) {
    const s = L.s;
    const ex = L.elevX;
    const dockY = L.elevDockY;
    ctx.save();

    const railHalf = 5.2 * s;
    const cableG = ctx.createLinearGradient(0, 0, 0, dockY);
    cableG.addColorStop(0, "rgba(255, 255, 255, 0.32)");
    cableG.addColorStop(0.5, pal.hullLight);
    cableG.addColorStop(1, pal.hullDark);

    ctx.strokeStyle = cableG;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(ex - railHalf, 0);
    ctx.lineTo(ex - railHalf, dockY);
    ctx.moveTo(ex + railHalf, 0);
    ctx.lineTo(ex + railHalf, dockY);
    ctx.stroke();

    ctx.strokeStyle = pal.hullMid;
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 0.85 * s;
    const rungs = Math.max(6, Math.floor(dockY / (34 * s)));
    for (let r = 1; r < rungs; r++) {
      const ry = (r / rungs) * dockY;
      ctx.beginPath();
      ctx.moveTo(ex - railHalf, ry);
      ctx.lineTo(ex + railHalf, ry);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(ex - 15 * s, dockY + 8 * s);
    ctx.lineTo(ex - 10.5 * s, dockY - 7.5 * s);
    ctx.lineTo(ex + 10.5 * s, dockY - 7.5 * s);
    ctx.lineTo(ex + 15 * s, dockY + 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(ex - 11 * s, dockY - 7.5 * s, 22 * s, 2.8 * s);
    ctx.restore();
  },

  _drawPressurizedTunnel(ctx, x0, y0, x1, y1, thickness, s, pal) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);

    const tg = ctx.createLinearGradient(0, -thickness * 0.5, 0, thickness * 0.5);
    tg.addColorStop(0, pal.hullLight);
    tg.addColorStop(0.55, pal.hullMid);
    tg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = tg;
    ctx.fillRect(0, -thickness * 0.5, len, thickness);

    ctx.fillStyle = pal.waterBounce;
    ctx.fillRect(0, -thickness * 0.5, len, 1.3 * s);

    const segs = Math.max(4, Math.floor(len / (24 * s)));
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(sx - 1.4 * s, -thickness * 0.56, 2.8 * s, thickness * 1.12);
      this._drawWindowBand(ctx, sx - (len / segs) * 0.62, -thickness * 0.14, (len / segs) * 0.34, thickness * 0.24, 1, pal, s);
    }

    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(len - 8 * s, -thickness * 0.62, 9 * s, thickness * 1.24);
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(len - 3 * s, -thickness * 0.54, 2.5 * s, thickness * 1.08);
    ctx.restore();
  },

  _drawSatelliteWing(ctx, cx, cy, seabedY, pal, s, opts = {}) {
    const isObs = opts.kind === "observatory";
    const isPod = opts.kind === "pod";
    const sc = isPod ? s * 0.78 : s * 0.92;
    const baseTopW = isPod ? 82 * sc : 134 * sc;
    const baseBotW = isPod ? 136 * sc : 198 * sc;

    ctx.save();
    // Volcanic basalt mound cradling satellite base
    ctx.fillStyle = pal.seabedDark;
    ctx.beginPath();
    ctx.moveTo(cx - baseBotW * 0.85, seabedY + 24 * sc);
    ctx.quadraticCurveTo(cx - baseBotW * 0.50, cy + 28 * sc, cx, cy + 24 * sc);
    ctx.quadraticCurveTo(cx + baseBotW * 0.50, cy + 28 * sc, cx + baseBotW * 0.85, seabedY + 24 * sc);
    ctx.closePath();
    ctx.fill();

    this._drawSeabedFoundation(ctx, cx, cy + 12 * sc, Math.min(seabedY, cy + 72 * sc), baseTopW, baseBotW, pal, sc, {
      windowRows: 1,
      noFloodlight: true
    });

    if (isObs) {
      // West Angular Hard-Sci-Fi Wing & Illuminated Diver Wet-Lock Bay (boxy modern curtain glass, no extra domes!)
      this._drawArchitecturalModule(ctx, cx - 50 * sc, cy - 12 * sc, 64 * sc, 30 * sc, pal, sc, { rows: 1, hasTanks: true });
      this._drawArchitecturalModule(ctx, cx - 4 * sc, cy - 18 * sc, 44 * sc, 36 * sc, pal, sc, { rows: 2 });

      // Illuminated Moonpool Diver Airlock Chamber Hatch along lower-right shoulder of West Wing!
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(cx + 4 * sc, cy + 8 * sc, 24 * sc, 15 * sc);
      ctx.fillStyle = "rgba(56, 224, 232, 0.72)";
      ctx.fillRect(cx + 8 * sc, cy + 12 * sc, 16 * sc, 9 * sc);

      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      ctx.moveTo(cx - 28 * sc, cy - 16 * sc);
      ctx.lineTo(cx - 28 * sc, cy - 42 * sc);
      ctx.moveTo(cx - 34 * sc, cy - 30 * sc);
      ctx.lineTo(cx - 22 * sc, cy - 30 * sc);
      ctx.stroke();
    } else if (isPod) {
      // Far East Telemetry & Water Sampling Angular Minimalist Outpost Wing
      this._drawArchitecturalModule(ctx, cx - 30 * sc, cy - 14 * sc, 60 * sc, 28 * sc, pal, sc, { rows: 2, hasTanks: true });
    } else {
      // East Angular Sensor & Sonar Relay Wing
      this._drawArchitecturalModule(ctx, cx - 48 * sc, cy - 18 * sc, 68 * sc, 34 * sc, pal, sc, { rows: 2, hasTanks: true });
      this._drawArchitecturalModule(ctx, cx + 10 * sc, cy - 6 * sc, 48 * sc, 24 * sc, pal, sc, { rows: 1 });
    }

    if (opts.haze > 0) {
      ctx.fillStyle = `rgba(${pal.waterHazeRgb}, ${opts.haze.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16 * sc, baseBotW * 0.72, 74 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // Mid-Background Sunken Cargo/Expedition Shipwreck Partially Covered in Continuous Seabed Sand (Zero Isolated Plateau!)
  _drawBackgroundShipwreck(ctx, L, pal) {
    const wk = L.wreck;
    if (!wk || L.isNarrow) return;
    const wx = wk.x;
    const wy = wk.y;
    const sc = wk.scale;

    ctx.save();
    ctx.translate(wx, wy);
    ctx.scale(sc, sc);
    ctx.globalAlpha = pal.isDark ? 0.90 : 0.88;

    // 1. Resting hull & superstructure (tilted at natural seabed angle -0.12 rad)
    ctx.save();
    ctx.rotate(-0.12);

    // Subtle soft sand contact shadow beneath half-buried keel
    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(0, 12, 126, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tilted Cargo Derrick Masts + Hanging Rigging Cables
    ctx.strokeStyle = pal.reefMid;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-58, -14);
    ctx.lineTo(-66, -74);
    ctx.moveTo(-64, -58);
    ctx.lineTo(-34, -44); // Front loading boom
    ctx.moveTo(42, -16);
    ctx.lineTo(54, -68);
    ctx.stroke();

    ctx.strokeStyle = pal.reefMid;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-66, -72);
    ctx.quadraticCurveTo(-48, -50, -34, -44);
    ctx.moveTo(-65, -66);
    ctx.quadraticCurveTo(0, -32, 54, -66);
    ctx.stroke();

    // Main Sunken Steel Vessel Hull split dramatically at midships breach with weathered steel topsides & exposed frames!
    const steelTop = pal.isDark ? "#33627A" : "#4B809B";
    const steelMid = pal.isDark ? "#204458" : "#2F5E78";
    const steelRim = pal.isDark ? "#6A9DB6" : "#8CC0D6";
    const bridgeFill = pal.isDark ? "#3B6E88" : "#5B92AE";
    const hullGrad = ctx.createLinearGradient(-118, -28, 118, 16);
    hullGrad.addColorStop(0, steelTop);
    hullGrad.addColorStop(0.55, steelMid);
    hullGrad.addColorStop(1, pal.reefNear);
    ctx.fillStyle = hullGrad;
    // Bow + Midships Forward Half
    ctx.beginPath();
    ctx.moveTo(-124, -18); // Swept raked prow
    ctx.lineTo(-102, 12);
    ctx.lineTo(-8, 14);
    ctx.lineTo(4, -6);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-92, -20);
    ctx.closePath();
    ctx.fill();

    // Stern Half (slightly offset list at midships fracture!)
    ctx.beginPath();
    ctx.moveTo(12, -16);
    ctx.lineTo(8, 13);
    ctx.lineTo(106, 10);
    ctx.lineTo(118, -14);
    ctx.lineTo(36, -20);
    ctx.closePath();
    ctx.fill();

    // Oxidized rust patina freeboard accent & crisp upper sheerline gunwale highlight
    ctx.strokeStyle = "rgba(176, 104, 66, 0.36)";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-108, -10);
    ctx.lineTo(-12, -11);
    ctx.moveTo(16, -9);
    ctx.lineTo(110, -7);
    ctx.stroke();

    ctx.strokeStyle = steelRim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-123, -18);
    ctx.lineTo(-92, -20);
    ctx.lineTo(-14, -22);
    ctx.moveTo(14, -16);
    ctx.lineTo(36, -20);
    ctx.lineTo(117, -14);
    ctx.stroke();

    // Weathered Hull Portholes along Bow & Stern plates
    ctx.fillStyle = pal.hullShadow;
    [-90, -74, -58, -42, -26, 26, 44, 84, 98].forEach(px => {
      ctx.beginPath();
      ctx.arc(px, -8, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Exposed structural hull ribs & torn deck plates in the midships breach (x: -10..+16)
    ctx.strokeStyle = pal.hullShadow;
    ctx.lineWidth = 2.2;
    for (let r = -8; r <= 12; r += 5) {
      ctx.beginPath();
      ctx.moveTo(r, -20);
      ctx.lineTo(r + 1.5, 11);
      ctx.stroke();
    }

    // Hollowed Wheelhouse Bridge Superstructure + Leaning Smokestack Funnel + Hollow Windows
    ctx.fillStyle = bridgeFill;
    ctx.fillRect(34, -44, 42, 26);
    ctx.fillRect(40, -54, 24, 12);
    ctx.fillStyle = steelRim;
    ctx.fillRect(33, -45, 44, 2);
    ctx.fillRect(39, -55, 26, 2);
    ctx.fillStyle = steelMid;
    ctx.beginPath();
    ctx.moveTo(58, -42);
    ctx.lineTo(72, -62);
    ctx.lineTo(82, -59);
    ctx.lineTo(70, -40);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.hullShadow;
    for (let wn = 0; wn < 4; wn++) {
      ctx.fillRect(38 + wn * 9, -40, 6, 4.5);
      if (wn < 3) ctx.fillRect(43 + wn * 7, -51, 4.5, 3.8);
    }

    // Corals & encrustations colonizing upper hull deck plates
    [-86, -42, 24, 78].forEach((fx, idx) => {
      this._drawCoralCluster(ctx, fx, idx % 2 === 0 ? -18 : -14, 9 + (idx % 2) * 3, pal.reefNear);
    });
    ctx.restore();

    // 2. Continuous Seabed Sand Drifts Blending Gently Across Bottom Keel (~25-30% lower bury, Zero Plateau!)
    ctx.globalAlpha = 1;
    const sandGrad = ctx.createLinearGradient(0, 2, 0, 22);
    sandGrad.addColorStop(0, pal.seabedDark);
    sandGrad.addColorStop(0.55, pal.reefMid);
    sandGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sandGrad;
    ctx.beginPath();
    ctx.moveTo(-132, 20);
    ctx.quadraticCurveTo(-96, 3, -52, 8);
    ctx.quadraticCurveTo(-8, 13, 28, 3);
    ctx.quadraticCurveTo(72, 1, 108, 9);
    ctx.quadraticCurveTo(126, 14, 134, 21);
    ctx.lineTo(-132, 21);
    ctx.closePath();
    ctx.fill();

    // Subtle sand ripple contours & benthic pebbles along the keel seam
    ctx.strokeStyle = pal.waterBounce;
    ctx.globalAlpha = pal.isDark ? 0.08 : 0.14;
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(-108, 12);
    ctx.quadraticCurveTo(-48, 7, 4, 14);
    ctx.quadraticCurveTo(58, 6, 108, 13);
    ctx.stroke();

    ctx.globalAlpha = 0.65;
    [-88, -32, 32, 82].forEach((px, pidx) => {
      ctx.fillStyle = pidx % 2 === 0 ? pal.reefMid : pal.seabedDark;
      ctx.beginPath();
      ctx.ellipse(px, 12 + (pidx % 2) * 2.5, 6 + (pidx % 2) * 2.5, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Subtle water depth veil keeping sand-buried wreck integrated while retaining crisp details
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${pal.waterHazeRgb}, 0.10)`;
    ctx.beginPath();
    ctx.ellipse(0, -18, 134, 56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // Horizontal Armored Titanium Submarine Airlock Docking Sleeve: Back Interior Aperture & Far Guide Fins
  _drawSubDockingPort(ctx, x, y, dir, pal, s) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1); // dir = +1 opens East (+x), dir = -1 opens West (-x)

    // Far-side splayed mechanical guide fins welcoming approaching hull
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(0, -16 * s);
    ctx.lineTo(24 * s, -24 * s);
    ctx.lineTo(26 * s, -19 * s);
    ctx.lineTo(6 * s, -12 * s);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 16 * s);
    ctx.lineTo(24 * s, 24 * s);
    ctx.lineTo(26 * s, 19 * s);
    ctx.lineTo(6 * s, 12 * s);
    ctx.closePath();
    ctx.fill();

    // Outer titanium sleeve housing (back layer) & deep pressurized interior chamber bore
    const cg = ctx.createLinearGradient(0, -19 * s, 0, 19 * s);
    cg.addColorStop(0, pal.hullLight);
    cg.addColorStop(0.5, pal.hullMid);
    cg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.roundRect(-10 * s, -18 * s, 25 * s, 36 * s, 3 * s);
    ctx.fill();
    ctx.strokeStyle = pal.hullDeep;
    ctx.lineWidth = Math.max(0.9, 1.2 * s);
    ctx.stroke();

    // Dark recessed circular chamber throat opening at local x = +15*s where submarine nose inserts INSIDE!
    ctx.fillStyle = pal.hullDeep;
    ctx.beginPath();
    ctx.ellipse(15 * s, 0, 5.4 * s, 16.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Far-right edge of glowing docking ring (drawn behind entering submarine hull)
    ctx.strokeStyle = pal.subAccent;
    ctx.lineWidth = Math.max(1.2, 1.7 * s);
    ctx.beginPath();
    ctx.ellipse(15 * s, 0, 4.8 * s, 14.8 * s, 0, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();

    [-15 * s, 15 * s].forEach(cy => {
      ctx.fillStyle = pal.trimGold;
      ctx.fillRect(10 * s, cy - 1.6 * s, 6.5 * s, 3.2 * s);
    });
    ctx.restore();
  },

  // Foreground Collar Half & Locking Clamps rendered OVER Submarine Bow so Nose Seats Visibly INSIDE Ring!
  _drawSubDockingPortFrontLip(ctx, x, y, dir, pal, s, isDocked, step) {
    ctx.save();
    ctx.translate(x, y);
    if (dir < 0) ctx.scale(-1, 1);

    // Opaque Titanium Collar Barrel wrapping cleanly around & occluding inserted submarine bow (local x = -9..+15*s)
    const fg = ctx.createLinearGradient(0, -19 * s, 0, 19 * s);
    fg.addColorStop(0, pal.hullLight);
    fg.addColorStop(0.45, pal.hullMid);
    fg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-9 * s, -18 * s);
    ctx.lineTo(15 * s, -18 * s);
    ctx.ellipse(15 * s, 0, 5.4 * s, 18 * s, 0, -Math.PI * 0.5, Math.PI * 0.5, true);
    ctx.lineTo(-9 * s, 18 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.hullDeep;
    ctx.lineWidth = Math.max(0.9, 1.2 * s);
    ctx.stroke();

    // Soft volumetric top specular rim & rib bands on sleeve barrel
    ctx.strokeStyle = pal.waterBounce;
    ctx.lineWidth = Math.max(0.9, 1.1 * s);
    ctx.beginPath();
    ctx.moveTo(-7 * s, -17.2 * s);
    ctx.lineTo(14 * s, -17.2 * s);
    ctx.stroke();
    [-2 * s, 6 * s].forEach(rx => {
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(rx, -18 * s, 2.2 * s, 36 * s);
    });

    // Near-side concave titanium lip + glowing airtight pressurized seal hugging the submarine hull!
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = Math.max(1.8, 2.5 * s);
    ctx.beginPath();
    ctx.ellipse(15 * s, 0, 5.4 * s, 16.2 * s, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();

    const sealAlpha = isDocked ? (0.62 + 0.34 * Math.sin(step * 2.8)) : 0.42;
    ctx.strokeStyle = isDocked
      ? `rgba(103, 232, 249, ${sealAlpha.toFixed(3)})`
      : `rgba(56, 189, 248, ${sealAlpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(1.4, 2.0 * s);
    ctx.beginPath();
    ctx.ellipse(15 * s, 0, 4.7 * s, 14.8 * s, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();

    // Hydraulic latching dog-clamps biting cleanly onto the docked hull when locked!
    const clampIn = isDocked ? 3.2 * s : 0.4 * s;
    [-1, 1].forEach(side => {
      const fy = side * (16.5 * s - clampIn * 0.65);
      ctx.fillStyle = pal.hullMid;
      ctx.beginPath();
      ctx.moveTo(8 * s, side * 17.5 * s);
      ctx.lineTo(22 * s, fy);
      ctx.lineTo(23 * s, fy - side * 3.2 * s);
      ctx.lineTo(11 * s, side * 13 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isDocked ? "#34D399" : pal.trimGold;
      ctx.beginPath();
      ctx.arc(19.5 * s, fy - side * 1.4 * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  _drawResearchStation(ctx, L, pal) {
    const s = L.s;
    const hx = L.hubX;
    const hy = L.hubY;
    const seabedBaseY = L.seabedY + 20 * s;

    // 0. Far-West Geothermal & Hydro-Tidal Power Farm + Far-East Marine Bio & Outer-East Diving Bell Facilities!
    if (!L.isNarrow) {
      this._drawHydropowerFarm(ctx, L, pal);
      // Far-West Geothermal & Desalination Station connected cleanly to Hydro-Tidal Turbine Farm
      this._drawClearGlassTube(ctx, L.geoWestX + 34 * s, L.geoWestY + 2 * s, L.farWestX - 24 * s, L.farWestY + 8 * s, 11.5 * s, s, pal, { depthAlpha: 0.76 });
      this._drawSatelliteWing(ctx, L.geoWestX, L.geoWestY, seabedBaseY + 6 * s, pal, s, { kind: "pod", haze: 0.24 });
      ctx.save();
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(L.geoWestX - 18 * s, L.geoWestY - 46 * s, 7 * s, 32 * s);
      ctx.fillRect(L.geoWestX - 6 * s, L.geoWestY - 52 * s, 7 * s, 38 * s);
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(L.geoWestX - 18 * s, L.geoWestY - 42 * s, 7 * s, 3 * s);
      ctx.fillRect(L.geoWestX - 6 * s, L.geoWestY - 48 * s, 7 * s, 3 * s);
      ctx.restore();

      // Far-East Marine Bio Pod + Outer-East Hyperbaric Diving Bell & Deep-Telemetry Annex
      this._drawClearGlassTube(ctx, L.eastWingX + 52 * s, L.eastWingY + 4 * s, L.farEastX - 28 * s, L.farEastY + 2 * s, 11.5 * s, s, pal, { depthAlpha: 0.78 });
      this._drawSatelliteWing(ctx, L.farEastX, L.farEastY, seabedBaseY + 6 * s, pal, s, { kind: "pod", haze: 0.22 });
      this._drawClearGlassTube(ctx, L.farEastX + 32 * s, L.farEastY + 2 * s, L.outerEastX - 28 * s, L.outerEastY + 2 * s, 10.5 * s, s, pal, { depthAlpha: 0.72 });
      this._drawSatelliteWing(ctx, L.outerEastX, L.outerEastY, seabedBaseY + 8 * s, pal, s, { kind: "habitat", haze: 0.24 });

      // Subsea A-Frame Winch Gantry & Spherical Observation Bathysphere suspended cleanly over eastern seabed
      ctx.save();
      const bx = L.outerEastX + 36 * s;
      const topY = L.outerEastY - 40 * s;
      const bellY = L.outerEastY - 12 * s;
      const rBell = 7.6 * s;

      // Platform deck apron under A-frame base
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(L.outerEastX + 22 * s, L.outerEastY - 5 * s, 26 * s, 5 * s);

      // Braced steel A-frame legs & top winch sheave housing
      ctx.strokeStyle = pal.hullMid;
      ctx.lineWidth = 2.4 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - 11 * s, L.outerEastY - 4 * s);
      ctx.lineTo(bx, topY);
      ctx.lineTo(bx + 11 * s, L.outerEastY - 4 * s);
      ctx.stroke();

      ctx.fillStyle = pal.hullLight;
      ctx.fillRect(bx - 4.5 * s, topY - 2.5 * s, 9 * s, 4.5 * s);

      // Taut hoist cable down to metallic pressure bathysphere
      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(bx, topY + 2 * s);
      ctx.lineTo(bx, bellY - rBell);
      ctx.stroke();

      // Subtle downward observation spotlight cone on seabed at night
      if (pal.isDark) {
        const cone = ctx.createLinearGradient(bx, bellY + rBell, bx, L.seabedY + 22 * s);
        cone.addColorStop(0, "rgba(103, 232, 249, 0.30)");
        cone.addColorStop(1, "rgba(103, 232, 249, 0)");
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(bx - 3 * s, bellY + rBell);
        ctx.lineTo(bx + 3 * s, bellY + rBell);
        ctx.lineTo(bx + 20 * s, L.seabedY + 22 * s);
        ctx.lineTo(bx - 20 * s, L.seabedY + 22 * s);
        ctx.closePath();
        ctx.fill();
      }

      // 3D Spherical Pressure Hull + Equator Flange + Landing Skids
      const bellG = ctx.createRadialGradient(bx - rBell * 0.3, bellY - rBell * 0.3, 1, bx, bellY, rBell);
      bellG.addColorStop(0, pal.hullLight);
      bellG.addColorStop(0.62, pal.hullMid);
      bellG.addColorStop(1, pal.hullDark);
      ctx.fillStyle = bellG;
      ctx.beginPath();
      ctx.arc(bx, bellY, rBell, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(bx - rBell * 0.96, bellY);
      ctx.lineTo(bx + rBell * 0.96, bellY);
      ctx.moveTo(bx - rBell * 0.72, bellY + rBell + 1.5 * s);
      ctx.lineTo(bx + rBell * 0.72, bellY + rBell + 1.5 * s);
      ctx.stroke();

      // Illuminated sapphire/cyan observation viewport & specular glint
      ctx.fillStyle = pal.glowCyan || "#38BDF8";
      ctx.beginPath();
      ctx.arc(bx + 1.2 * s, bellY - 0.5 * s, rBell * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(bx + 2.1 * s, bellY - 1.4 * s, rBell * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 1. Clear Acrylic Glass Walkway Tubes Linking Horizontal Wings & Hexagonal Hubs Across Canyon Floor
    this._drawClearGlassTube(ctx, L.westWingX + 42 * s, L.westWingY + 4 * s, hx - 108 * s, hy + 28 * s, 15 * s, s, pal);
    this._drawClearGlassTube(ctx, hx + 106 * s, hy + 26 * s, L.eastWingX - 46 * s, L.eastWingY + 4 * s, 15 * s, s, pal);
    this._drawClearGlassTube(ctx, L.domeX + 30 * s, L.domeY + 14 * s, L.eastWingX - 36 * s, L.eastWingY - 6 * s, 11 * s, s, pal, { depthAlpha: 0.90 });

    // 2. Grounded Angular Supplementary Wings (West Airlock + East Sonar Relay)
    this._drawSatelliteWing(ctx, L.westWingX, L.westWingY, seabedBaseY + 2 * s, pal, s, { kind: "observatory", haze: 0.08 });
    this._drawSatelliteWing(ctx, L.eastWingX, L.eastWingY, seabedBaseY + 2 * s, pal, s, { kind: "habitat", haze: 0.08 });
    this._drawSonarRelay(ctx, L, pal);

    // 3. Vertical Surface Supply Elevator Guide Shaft
    this._drawSupplyElevatorShaft(ctx, L, pal);

    // 4. Central Stepped Hexagonal Seabed Foundation
    this._drawSeabedFoundation(ctx, hx + 4 * s, hy + 18 * s, seabedBaseY, 276 * s, 368 * s, pal, s);

    // 5. Boxy Angular Minimalist Supplementary Lab Wings Flanking Hub
    this._drawArchitecturalModule(ctx, hx - 126 * s, hy + 16 * s, 64 * s, 34 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 68 * s, hy + 14 * s, 68 * s, 34 * s, pal, s, { rows: 2 });

    // 6. Angular Supply Elevator Airlock Tower + East Ops Boxy Wing
    this._drawArchitecturalModule(ctx, L.elevX - 28 * s, L.elevDockY + 6 * s, 56 * s, 46 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 34 * s, hy - 48 * s, 54 * s, 38 * s, pal, s, { rows: 2, hasTanks: true });

    // Clear glass connecting gallery from Central Hub to Crop Cultivation Greenhouse Dome (only glass dome!)
    this._drawClearGlassTube(ctx, hx + 32 * s, hy - 4 * s, L.domeX - 24 * s, L.domeY + 10 * s, 14 * s, s, pal);

    // 7. Faceted Hydroponic Crop Cultivation Greenhouse Dome (preserved as station's lone glass dome)
    this._drawGreenhouseDome(ctx, L, pal);

    // 8. Twin Horizontal Pressurized Submarine Docking Piers + Armored Airlock Docking Collars
    this._drawPressurizedTunnel(ctx, hx - 20 * s, hy + 24 * s, L.leftDockX, L.leftDockY, 22 * s, s, pal);
    this._drawPressurizedTunnel(ctx, hx + 20 * s, hy + 24 * s, L.rightDockX, L.rightDockY, 25 * s, s, pal);
    this._drawSubDockingPort(ctx, L.leftDockX, L.leftDockY, -1, pal, s);
    this._drawSubDockingPort(ctx, L.rightDockX, L.rightDockY, 1, pal, s);

    // 9. Central Interconnected Modular Hexagonal Hard-Sci-Fi + Biophilic Minimalist Core Cluster!
    this._drawClearGlassTube(ctx, hx - 54 * s, hy - 4 * s, hx - 12 * s, hy - 14 * s, 11 * s, s, pal);
    this._drawClearGlassTube(ctx, hx + 12 * s, hy - 14 * s, hx + 56 * s, hy - 2 * s, 11 * s, s, pal);
    this._drawHexModule(ctx, hx - 62 * s, hy - 6 * s, 36 * s, 16 * s, 26 * s, pal, s, { biophilic: true });
    this._drawHexModule(ctx, hx + 62 * s, hy - 4 * s, 34 * s, 15 * s, 24 * s, pal, s, { biophilic: true });
    this._drawHexModule(ctx, hx, hy - 18 * s, 54 * s, 24 * s, 40 * s, pal, s, { biophilic: true });

    // Minimalist Angular Communications & Hydrophone Spire on Central Hex Roof
    ctx.save();
    ctx.translate(hx, hy - 18 * s);
    if (pal.isDark) {
      const bridgeHalo = ctx.createRadialGradient(0, 12 * s, 8 * s, 0, 12 * s, 68 * s);
      bridgeHalo.addColorStop(0, "rgba(186, 236, 252, 0.22)");
      bridgeHalo.addColorStop(1, "rgba(186, 236, 252, 0)");
      ctx.fillStyle = bridgeHalo;
      ctx.beginPath();
      ctx.arc(0, 12 * s, 68 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(-9 * s, -36 * s, 18 * s, 28 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(-13 * s, -41 * s, 26 * s, 5 * s);
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 2.0 * s;
    ctx.beginPath();
    ctx.moveTo(0, -41 * s);
    ctx.lineTo(0, -92 * s);
    ctx.moveTo(-11 * s, -62 * s);
    ctx.lineTo(11 * s, -62 * s);
    ctx.moveTo(-7.5 * s, -76 * s);
    ctx.lineTo(7.5 * s, -76 * s);
    ctx.stroke();

    // Front-Right Grounded Hexagonal ROV Launch Pad (eye-level foreshortened ellipse)
    ctx.translate(46 * s, 44 * s);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-26 * s, 0, 52 * s, 14 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const vx = Math.cos(a) * 28 * s;
      const vy = Math.sin(a) * 5.2 * s;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.trimGold;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * s, 3.0 * s, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(19 * s, 0);
    ctx.lineTo(19 * s, -15 * s);
    ctx.lineTo(11 * s, -21 * s);
    ctx.stroke();
    ctx.fillStyle = pal.subAccent;
    [-22, 22].forEach(lx => {
      ctx.beginPath();
      ctx.arc(lx * s, 0, 1.4 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  _assignCorridorEndpoints(subObj, side, w, h, L) {
    const corr = this._pick(["upper_glide", "mid_cruise", "deep_ascent"]);
    subObj.corridor = corr;
    if (side === "left") {
      if (corr === "upper_glide") {
        subObj.entryX = -150;
        subObj.entryY = h * this._rand(0.24, 0.38);
      } else if (corr === "deep_ascent") {
        subObj.entryX = -145;
        subObj.entryY = h * this._rand(0.74, 0.86);
      } else {
        subObj.entryX = -155;
        subObj.entryY = L.leftDockY + this._rand(-45, 50);
      }
    } else {
      if (corr === "upper_glide") {
        subObj.exitX = w + 165;
        subObj.exitY = h * this._rand(0.24, 0.38);
      } else if (corr === "deep_ascent") {
        subObj.exitX = w + 160;
        subObj.exitY = h * this._rand(0.74, 0.86);
      } else {
        subObj.exitX = w + 175;
        subObj.exitY = L.rightDockY + this._rand(-45, 50);
      }
    }
  },

  _buildSubPath(fromPt, toPt, cp1, cp2) {
    return this._buildArcPath([
      { type: "cubic", p0: fromPt, p1: cp1, p2: cp2, p3: toPt }
    ], 26);
  },

  ensureEntities(w, h) {
    const isNarrow = w < 720;
    const L = this.getLayout(w, h);
    const s = L.s;

    // 1. Ground-Anchored Swinging Kelp Fronds (roots strictly embedded 7-10px below _cliffYAtX / _seabedYAtX!)
    if (this.kelp.length === 0) {
      const leftXs = isNarrow ? [0.05, 0.14] : [0.04, 0.10, 0.17, 0.24];
      const rightXs = isNarrow ? [0.85, 0.94] : [0.76, 0.84, 0.91, 0.96];
      const floorXs = isNarrow ? [] : [0.21, 0.33, 0.66, 0.86];

      leftXs.forEach((xf, idx) => {
        const kx = w * xf;
        const ky = (this._cliffYAtX(kx, w, h) || h * 0.82) + 9;
        this.kelp.push({ x: kx, y: ky, h: (32 + (idx % 3) * 14) * (isNarrow ? 0.75 : 1), fronds: 3, phase: idx * 1.1, foreground: true });
      });
      rightXs.forEach((xf, idx) => {
        const kx = w * xf;
        const ky = (this._cliffYAtX(kx, w, h) || h * 0.82) + 9;
        this.kelp.push({ x: kx, y: ky, h: (34 + (idx % 2) * 16) * (isNarrow ? 0.75 : 1), fronds: 3, phase: idx * 1.4 + 0.6, foreground: true });
      });
      floorXs.forEach((xf, idx) => {
        const kx = w * xf;
        const ky = this._seabedYAtX(kx, w, h, L) + 18 + (idx % 2) * 14;
        this.kelp.push({ x: kx, y: Math.min(h - 4, ky), h: 24 + (idx % 3) * 9, fronds: 2, phase: idx * 0.9 + 2, foreground: false });
      });
    }

    // 2. True Whales gliding across deep background lanes (Director-gated)
    if (this.whales.length === 0) {
      this.whales = [
        { active: !isNarrow, waitTimer: isNarrow ? this._rand(18, 30) : 0, x: w * 0.22, y: h * 0.20, vx: 0.20, len: isNarrow ? 74 : 112, depth: 0.26, phase: 0 },
        { active: false, waitTimer: this._rand(16, 28), x: w + 130, y: h * 0.14, vx: -0.16, len: isNarrow ? 62 : 90, depth: 0.18, phase: 2.4 }
      ];
    }

    // 3. Sharks: Great Whites, Hammerheads, Whale Sharks (Director-gated)
    if (this.sharks.length === 0) {
      this.sharks = [
        { active: true, waitTimer: 0, species: "great_white", x: w * 0.30, y: h * 0.25, vx: 0.56, size: isNarrow ? 27 : 37, depth: 0.56, phase: 0.4 },
        { active: false, waitTimer: this._rand(9, 18), species: "great_white", x: -80, y: h * 0.21, vx: 0.49, size: isNarrow ? 23 : 30, depth: 0.44, phase: 1.9 },
        { active: false, waitTimer: this._rand(14, 24), species: "hammerhead", x: w + 80, y: h * 0.30, vx: -0.62, size: isNarrow ? 25 : 34, depth: 0.64, phase: 1.1 },
        { active: false, waitTimer: this._rand(20, 32), species: "whale_shark", x: -110, y: h * 0.15, vx: 0.32, size: isNarrow ? 44 : 62, depth: 0.48, phase: 2.8 }
      ];
    }

    // 4. Synchronized Undulating Coastal Fish Schools! (Director-gated)
    if (this.fishSchools.length === 0) {
      const schoolSpecs = isNarrow
        ? [
            { active: true, waitTimer: 0, x: w * 0.22, y: h * 0.24, vx: 0.52, depth: 0.44, count: 12, spread: 38 },
            { active: false, waitTimer: this._rand(14, 24), x: w + 80, y: h * 0.20, vx: -0.44, depth: 0.36, count: 12, spread: 36 }
          ]
        : [
            { active: true, waitTimer: 0, x: w * 0.16, y: h * 0.29, vx: 0.56, depth: 0.46, count: 22, spread: 62 },
            { active: false, waitTimer: this._rand(7, 15), x: w + 90, y: h * 0.17, vx: -0.48, depth: 0.34, count: 24, spread: 68 },
            { active: false, waitTimer: this._rand(14, 24), x: -80, y: h * 0.12, vx: 0.36, depth: 0.24, count: 18, spread: 54 },
            { active: false, waitTimer: this._rand(18, 28), x: w + 90, y: h * 0.38, vx: -0.62, depth: 0.60, count: 16, spread: 50 }
          ];
      this.fishSchools = schoolSpecs.map((sc, sIdx) => {
        const members = [];
        for (let m = 0; m < sc.count; m++) {
          members.push({
            ox: ((m * 0.6180339) % 1 - 0.5) * sc.spread,
            oy: (Math.sin(m * 1.9 + sIdx) * 0.45) * (sc.spread * 0.42),
            sz: (3.2 + (m % 3) * 0.9) * (0.65 + sc.depth * 0.55),
            pOff: m * 0.45
          });
        }
        return { ...sc, phase: sIdx * 1.3, members };
      });
    }

    if (this.farLife.length === 0) {
      const schoolCount = isNarrow ? 4 : 8;
      for (let i = 0; i < schoolCount; i++) {
        const rightGroup = i >= schoolCount * 0.55;
        this.farLife.push({
          kind: "fish",
          active: true,
          depth: 0.28 + (i % 4) * 0.09,
          x: (rightGroup ? w * 0.68 : w * 0.08) + (i % 6) * 18 + (Math.random() - 0.5) * 24,
          y: (rightGroup ? h * 0.14 : h * 0.27) + (Math.random() - 0.5) * 48,
          vx: (rightGroup ? -1 : 1) * (0.52 + Math.random() * 0.26),
          size: 4.0 + Math.random() * 2.2,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.nearLife.length === 0) {
      const nCount = isNarrow ? 4 : 10;
      for (let i = 0; i < nCount; i++) {
        const dir = i < nCount * 0.5 ? 1 : -1;
        this.nearLife.push({
          depth: 0.72 + Math.random() * 0.28,
          x: Math.random() * w,
          y: h * (0.56 + Math.random() * 0.30),
          vx: dir * (0.76 + Math.random() * 0.48),
          size: 6 + Math.random() * 3.0,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.jellies.length === 0) {
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.jellies.push({
          active: i === 0,
          waitTimer: i === 0 ? 0 : this._rand(6 + i * 5, 14 + i * 6),
          x: w * (0.14 + i * 0.34),
          y: i === 0 ? h * 0.42 : h + 40,
          vy: -(0.12 + Math.random() * 0.10),
          size: 8 + Math.random() * 4.5,
          phase: Math.random() * Math.PI * 2,
          depth: 0.55 + Math.random() * 0.35
        });
      }
    }

    if (this.snow.length === 0) {
      const count = isNarrow ? 14 : 44;
      for (let i = 0; i < count; i++) {
        this.snow.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.8 + Math.random() * 1.4,
          vy: -(0.07 + Math.random() * 0.14),
          drift: Math.random() * Math.PI * 2,
          alpha: 0.16 + Math.random() * 0.34
        });
      }
    }

    // 5. To-Scale Human Maintenance & Shipwreck Research Divers (multi-action wreck photography/sampling/survey!)
    if (this.divers.length === 0) {
      const wkX = L.wreck ? L.wreck.x : w * 0.82;
      const wkY = L.wreck ? L.wreck.y : h * 0.56;
      const wkS = L.wreck ? L.wreck.scale : s;
      const dTargets = [
        { tx: wkX - 18 * wkS, ty: wkY - 12 * wkS, altX: wkX + 36 * wkS, altY: wkY - 26 * wkS, isWreck: true },
        { tx: L.hubX - 148 * s, ty: L.hubY + 24 * s, altX: L.hubX - 124 * s, altY: L.hubY + 30 * s, isWreck: false },
        { tx: wkX + 28 * wkS, ty: wkY - 20 * wkS, altX: wkX - 42 * wkS, altY: wkY - 6 * wkS, isWreck: true },
        { tx: L.hydroTurbines[0].x + 14 * s, ty: L.hydroTurbines[0].y + 4 * s, altX: L.hydroTurbines[0].x + 28 * s, altY: L.hydroTurbines[0].y + 2 * s, isWreck: false }
      ];
      const count = isNarrow ? 2 : 4;
      const mobileTargets = [dTargets[1], dTargets[3]];
      for (let i = 0; i < count; i++) {
        const tgt = isNarrow ? mobileTargets[i] : dTargets[i];
        const isWreckDiv = tgt.isWreck;
        const startActive = i === 0;
        this.divers.push({
          id: `diver_${i + 1}`,
          role: isWreckDiv ? "wreck_research" : "station_maint",
          phase: startActive ? "swim_to_site" : "inside_airlock",
          action: isWreckDiv ? "photo" : "weld",
          visitsLeft: isWreckDiv ? 2 : 1,
          flashTimer: 1.4,
          t: 0,
          dist: startActive ? 95 : 0,
          phaseDuration: startActive ? 9.0 : this._rand(8.0 + i * 5, 16.0 + i * 6),
          targetPt: tgt,
          path: null,
          x: L.airlockX,
          y: L.airlockY,
          facingLeft: tgt.tx < L.airlockX,
          kickPhase: i * 1.7
        });
      }
    }

    // 6. Vertical Surface Supply Elevator
    if (!this.elevator) {
      this.elevator = {
        phase: "descending",
        t: 5.5,
        phaseDuration: this._rand(14.0, 18.5),
        y: (L.elevDockY - 12) * 0.42
      };
    }

    // 7. Left-Pier Visiting Submarine (cycles all 4 docking classes with longer 30-55s dock dwells)
    if (!this.sub) {
      const dirX = Math.cos(L.leftAngle);
      const dirY = Math.sin(L.leftAngle);
      const startStyle = "passenger_liner";
      const dockOff = this._getSubDockOffset(startStyle);
      const holdPt = { x: L.leftDockX + dirX * (130 * s), y: L.leftDockY + dirY * (130 * s) };
      this.sub = {
        style: startStyle,
        phase: isNarrow ? "docked" : "approaching",
        t: 0,
        dist: 120,
        speed: isNarrow ? 0 : 17.0,
        cruiseSpeed: 17.5,
        phaseDuration: this._rand(30.0, 55.0),
        corridor: "mid_cruise",
        entryX: -150,
        entryY: h * 0.48,
        x: isNarrow ? (L.leftDockX + dirX * (dockOff * s)) : -10,
        y: isNarrow ? L.leftDockY : (h * 0.52),
        facingLeft: false,
        pitch: isNarrow ? 0 : 0.04,
        heading: 0.04,
        path: null
      };
      this._assignCorridorEndpoints(this.sub, "left", w, h, L);
      if (!isNarrow) {
        this.sub.path = this._buildSubPath(
          { x: this.sub.entryX, y: this.sub.entryY },
          holdPt,
          { x: (this.sub.entryX + holdPt.x) * 0.45, y: this.sub.entryY },
          { x: holdPt.x - 85 * s, y: holdPt.y + 12 * s }
        );
        this.sub.dist = Math.min(this.sub.path.totalLen * 0.35, 160);
      }
    }

    // 8. Right-Pier Visiting Submarine (cargo freighter, experimental research, military stealth, passenger liner)
    if (!this.cargoSub) {
      const dirX = Math.cos(L.rightAngle);
      const startStyle = "heavy_freighter";
      const dockOff = this._getSubDockOffset(startStyle);
      this.cargoSub = {
        style: startStyle,
        phase: isNarrow ? "patrol_wait" : "docked",
        t: 0,
        dist: 0,
        speed: 0,
        cruiseSpeed: 14.0,
        phaseDuration: isNarrow ? this._rand(14.0, 24.0) : this._rand(30.0, 55.0),
        corridor: "mid_cruise",
        exitX: w + 170,
        exitY: L.rightDockY + 30,
        x: L.rightDockX + dirX * (dockOff * s),
        y: L.rightDockY,
        facingLeft: true,
        pitch: 0,
        heading: L.rightAngle + Math.PI,
        path: null
      };
      this._assignCorridorEndpoints(this.cargoSub, "right", w, h, L);
    }

    // 9. Extra Multi-Directional Roaming Submarines (Director-gated so maxSubs never exceeded)
    if (this.roamingSubs.length === 0) {
      const fromPt = { x: w + 115, y: h * 0.30 };
      const hoverPt = { x: L.eastWingX - 18 * s, y: L.eastWingY - 62 * s };
      const visitorPath = this._buildSubPath(
        fromPt,
        hoverPt,
        { x: (fromPt.x + hoverPt.x) * 0.55, y: fromPt.y + 12 },
        { x: hoverPt.x + 85 * s, y: hoverPt.y - 6 }
      );
      this.roamingSubs = [
        {
          id: "science_visitor",
          role: "visitor",
          style: "experimental_research",
          phase: "away_wait",
          t: 0,
          dist: 0,
          speed: 0,
          cruiseSpeed: 15.5,
          phaseDuration: this._rand(14.0, 24.0),
          fromPt,
          hoverPt,
          exitPt: { x: -120, y: h * 0.28 },
          path: visitorPath,
          x: fromPt.x,
          y: fromPt.y,
          facingLeft: true,
          pitch: 0.04,
          heading: Math.PI
        },
        {
          id: "deep_transit",
          role: "transit",
          style: "military_stealth",
          phase: "wait",
          t: 0,
          dist: 0,
          speed: 0,
          cruiseSpeed: 13.5,
          phaseDuration: this._rand(18.0, 30.0),
          startPt: { x: -130, y: h * 0.32 },
          endPt: { x: w + 135, y: h * 0.28 },
          depth: 0.44,
          scale: 0.62,
          x: -130,
          y: h * 0.32,
          facingLeft: false,
          pitch: -0.02,
          heading: 0
        }
      ];
    }

    // 10. Maintenance & Shipwreck Research ROVs (Round-trip Launch Pad <-> Wreck photo/sample/survey expeditions, Director-gated!)
    if (this.rovs.length === 0) {
      const wk = L.wreck || { x: w * 0.815, y: h * 0.56, scale: 0.86 };
      const homePt = { x: (L.hubX + 46 * s) / Math.max(1, w), y: (L.hubY + 22 * s) / Math.max(1, h) };
      const wkPts = [
        { x: (wk.x - 42 * wk.scale) / Math.max(1, w), y: (wk.y - 34 * wk.scale) / Math.max(1, h), beamAngle: 0.45 },
        { x: wk.x / Math.max(1, w), y: (wk.y - 44 * wk.scale) / Math.max(1, h), beamAngle: 0.95 },
        { x: (wk.x + 48 * wk.scale) / Math.max(1, w), y: (wk.y - 52 * wk.scale) / Math.max(1, h), beamAngle: 2.15 }
      ];
      this.rovs = [
        {
          id: "wreck_rov",
          scale: isNarrow ? 0.78 : 0.88,
          isWreckSurvey: true,
          phase: isNarrow ? "docked_wait" : "investigate",
          action: "survey",
          visitsLeft: 2,
          flashTimer: 1.5,
          homePt,
          waypoints: wkPts,
          wpIdx: 1,
          t: 0,
          waitDuration: this._rand(12.0, 20.0),
          x: wk.x - 10 * wk.scale,
          y: wk.y - 42 * wk.scale,
          beamAngle: 0.85,
          pauseTimer: this._rand(5.5, 8.5),
          phaseOsc: 1.4
        },
        {
          id: "station_west_rov",
          scale: 1.0,
          isWreckSurvey: false,
          phase: "patrol",
          homePt,
          waypoints: [
            { x: 0.26, y: 0.72, beamAngle: 0.55 },
            { x: 0.35, y: 0.77, beamAngle: 0.35 },
            { x: 0.22, y: 0.65, beamAngle: 0.74 },
            { x: 0.31, y: 0.64, beamAngle: 0.24 }
          ],
          wpIdx: 0,
          visitsLeft: 3,
          t: 0,
          waitDuration: this._rand(10.0, 18.0),
          x: isNarrow ? L.hubX + 46 * s : w * 0.28,
          y: isNarrow ? L.hubY + 22 * s : h * 0.71,
          beamAngle: 0.55,
          pauseTimer: this._rand(2.8, 5.4),
          phaseOsc: 0
        },
        {
          id: "reef_south_rov",
          scale: 0.96,
          isWreckSurvey: false,
          phase: "docked_wait",
          homePt,
          waypoints: [
            { x: 0.74, y: 0.83, beamAngle: 2.72 },
            { x: 0.64, y: 0.85, beamAngle: 2.52 },
            { x: 0.79, y: 0.78, beamAngle: 2.90 }
          ],
          wpIdx: 0,
          visitsLeft: 3,
          t: 0,
          waitDuration: this._rand(14.0, 24.0),
          x: L.hubX + 46 * s,
          y: L.hubY + 22 * s,
          beamAngle: 2.72,
          pauseTimer: this._rand(2.8, 5.4),
          phaseOsc: 2.7
        }
      ];
    }

    // 11. Deep-Sea Abyssal Angler Fish with Glowing Bioluminescent Esca Lures (Director-gated)
    if (this.anglerFish.length === 0) {
      this.anglerFish = [
        { active: true, waitTimer: 0, x: w * 0.14, y: h * 0.57, vx: 0.28, size: isNarrow ? 16 : 22, phase: 0.3, depth: 0.74 },
        { active: false, waitTimer: this._rand(14, 24), x: w + 60, y: h * 0.74, vx: -0.25, size: isNarrow ? 14 : 20, phase: 2.0, depth: 0.82 },
        { active: false, waitTimer: this._rand(20, 34), x: -60, y: h * 0.82, vx: 0.20, size: isNarrow ? 14 : 18, phase: 4.1, depth: 0.68 }
      ];
    }

    // 12. Task-Complete-Only Colossal Abyssal Sea Leviathan (idle until completion trigger)
    if (!this.leviathan) {
      this.leviathan = {
        phase: "dormant_wait",
        stunt: "roar",
        t: 0,
        phaseDuration: 0,
        dir: 1,
        x: -360,
        y: h * 0.22,
        baseY: h * 0.22,
        speed: 96.0,
        length: isNarrow ? 500 : 860,
        swimPhase: 0,
        jawOpen: 0,
        rollPhase: 0,
        roarRings: [],
        roarEmitted: 0,
        preyShark: null,
        partner: null
      };
    }

    // 13. Foreground Playful Reef Wildlife (Sea Turtles, Foreground Reef Sharks & Porpoising Dolphin Pod — Director-gated!)
    if (this.seaTurtles.length === 0) {
      const count = isNarrow ? 2 : 3;
      for (let i = 0; i < count; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        this.seaTurtles.push({
          active: i === 0,
          waitTimer: i === 0 ? 0 : this._rand(14 + i * 7, 26 + i * 8),
          x: i === 0 ? w * 0.18 : (dir > 0 ? -75 : w + 75),
          y: h * (0.36 + (i % 3) * 0.13),
          vx: dir * (22 + i * 3),
          vy: (i % 2 === 0 ? -1 : 1) * 3.8,
          size: isNarrow ? 18 : (21 + (i % 2) * 3.5),
          flapPhase: i * 1.6
        });
      }
    }
    if (this.fgReefSharks.length === 0) {
      const count = isNarrow ? 1 : 2;
      for (let i = 0; i < count; i++) {
        const dir = i === 0 ? -1 : 1;
        this.fgReefSharks.push({
          active: false,
          waitTimer: this._rand(12 + i * 10, 22 + i * 12),
          x: dir < 0 ? w + 95 : -95,
          y: h * (i === 0 ? 0.45 : 0.57),
          vx: dir * (36 + i * 8),
          size: isNarrow ? 28 : (36 + i * 5),
          tailPhase: i * 2.1
        });
      }
    }
    if (this.dolphins.length === 0) {
      const podDir = 1;
      const count = isNarrow ? 3 : 4;
      this.dolphinPodState = {
        active: false,
        waitTimer: this._rand(16.0, 28.0),
        dir: podDir
      };
      for (let i = 0; i < count; i++) {
        this.dolphins.push({
          x: -140 - i * (isNarrow ? 46 : 64),
          baseY: h * (0.32 + (i % 2) * 0.055),
          y: h * 0.34,
          vx: podDir * 54,
          vy: 0,
          size: isNarrow ? 25 : (35 - (i === 3 ? 7 : 0)),
          arcPhase: i * 0.72,
          dir: podDir
        });
      }
    }

    // 14. Habitat-Surrounding Manta Ray Cleaning Station Carousel (Wide Non-Clipping Superellipse Orbits Outside Station Base!)
    if (this.cleaningMantas.length === 0 && L.cleaningStation) {
      const cs = L.cleaningStation;
      const totalMantas = isNarrow ? 2 : 4;
      const frontY = Math.min(h - 38, L.seabedY + (isNarrow ? 64 : 62) * cs.scale);
      const backY = L.hubY - 46 * cs.scale;
      const orbitCenterY = (frontY + backY) * 0.5;
      const baseRx = isNarrow ? (w * 0.45) : Math.min(w * 0.475, 655 * s);
      const baseRy = Math.max(36, (frontY - backY) * 0.5);
      const orbitSpeed = isNarrow ? 0.14 : 0.135;

      for (let i = 0; i < totalMantas; i++) {
        // Locked evenly-spaced ring phasing on C1 superellipse so mantas orbit OUTSIDE wingtips & stay below plinth across full station width!
        const startAng = (i / totalMantas) * Math.PI * 2 + 0.35;
        const sinA = Math.sin(startAng);
        const cosA = Math.cos(startAng);
        const rNorm = Math.pow(Math.pow(Math.abs(cosA), 3.5) + Math.pow(Math.abs(sinA), 3.5), -1 / 3.5);
        const vx = -sinA * orbitSpeed;
        this.cleaningMantas.push({
          layer: sinA < 0 ? "back" : "front",
          orbitAngle: startAng,
          orbitSpeed,
          centerX: L.hubX,
          centerY: orbitCenterY,
          orbitRx: baseRx,
          orbitRy: baseRy,
          span: (isNarrow ? (33 - i * 2) : (45 - (i % 2) * 3)) * cs.scale,
          wingPhase: i * 1.65 + 0.4,
          state: "circling",
          x: L.hubX + cosA * rNorm * baseRx,
          y: orbitCenterY + sinA * rNorm * baseRy,
          facingLeft: vx < 0,
          turnProjX: Math.min(1, 0.30 + Math.abs(sinA) * 0.78),
          bank: 0,
          isFront: sinA >= 0
        });
      }
    }

    if (this.cleanerWrasse.length === 0 && L.cleaningStation) {
      const cs = L.cleaningStation;
      const bReefs = cs.backReefs || [];
      const fReefs = cs.frontReefs || [cs];
      const zones = ["gill", "belly", "left_wing", "right_wing", "cephalic"];

      // Escort & Back-Reef Cleaner Wrasse following circling mantas around rear seabed plateau
      const backWrCount = isNarrow ? 2 : 4;
      for (let i = 0; i < backWrCount; i++) {
        const rf = bReefs[i % Math.max(1, bReefs.length)] || cs;
        const homeX = rf.x + ((i % 2 === 0 ? -8 : 8) * rf.scale);
        const homeY = rf.y - (14 + (i % 2) * 5) * rf.scale;
        this.cleanerWrasse.push({
          id: i,
          layer: "back",
          isEscort: false,
          homeX,
          homeY,
          x: homeX,
          y: homeY - 8 * rf.scale,
          targetMantaIdx: 0,
          zone: zones[i % zones.length],
          state: "reef_dance",
          timer: 0.9 + i * 0.5,
          wigglePhase: i * 1.4,
          size: (3.4 + (i % 2) * 0.5) * rf.scale,
          facingLeft: i % 2 === 1,
          sparkleCd: 0.6 + i * 0.3
        });
      }

      // Foreground Reef Wrasse + 2 Pod Escort Wrasse circling the entire habitat continuously with mantas!
      const frontWrCount = isNarrow ? 4 : 8;
      for (let i = 0; i < frontWrCount; i++) {
        const isEscort = !isNarrow && i >= 6;
        const rf = fReefs[i % fReefs.length];
        const homeX = rf.x + (((i % 3) - 1) * 11 * rf.scale);
        const homeY = rf.y - (15 + (i % 3) * 5) * rf.scale;
        const leadM = this.cleaningMantas[1] || this.cleaningMantas[0];
        this.cleanerWrasse.push({
          id: backWrCount + i,
          layer: "front",
          isEscort,
          homeX,
          homeY,
          x: isEscort && leadM ? leadM.x : homeX,
          y: isEscort && leadM ? leadM.y : (homeY - 12 * rf.scale),
          targetMantaIdx: isEscort ? (i % Math.max(1, this.cleaningMantas.length)) : (1 % Math.max(1, this.cleaningMantas.length)),
          zone: zones[i % zones.length],
          state: isEscort ? "cleaning" : (i < 5 ? "cleaning" : "reef_dance"),
          timer: isEscort ? 99 : (1.5 + i * 0.65),
          wigglePhase: i * 1.3 + 0.5,
          size: (3.6 + (i % 3) * 0.55) * cs.scale,
          facingLeft: i % 2 === 1,
          sparkleCd: 0.4 + i * 0.28
        });
      }
    }
  },

  spawnLeviathan(w, h, opts = {}) {
    if (!w || !h) return;
    if (this.leviathan && this.leviathan.phase === "swimming" && !opts.stunt && !opts.force) {
      this._queuedLeviathan = { opts };
      return;
    }
    const isNarrow = w < 720;
    const pool = this.LEVIATHAN_STUNTS.filter(s => s !== this._lastLevStunt);
    const chosenStunt = (opts.stunt && this.LEVIATHAN_STUNTS.includes(opts.stunt))
      ? opts.stunt
      : (pool[Math.floor(Math.random() * pool.length)] || "roar");
    this._lastLevStunt = chosenStunt;

    const dir = Math.random() < 0.55 ? 1 : -1;
    const length = w < 720 ? 500 : 860;
    const speed = isNarrow ? 68 : 108;
    const startY = h * this._rand(0.18, 0.30);
    const startX = dir > 0 ? (-length * 0.28) : (w + length * 0.28);

    this.leviathan = {
      phase: "swimming",
      stunt: chosenStunt,
      t: 0,
      phaseDuration: (w + length * 1.8) / speed,
      dir,
      x: startX,
      y: startY,
      baseY: startY,
      speed,
      length,
      swimPhase: 0,
      jawOpen: 0,
      rollPhase: 0,
      roarRings: [],
      roarEmitted: 0,
      preyShark: chosenStunt === "hunt_shark"
        ? {
            x: dir > 0 ? w * 0.48 : w * 0.52,
            y: startY + 12,
            baseY: startY + 12,
            vx: dir * (isNarrow ? 12 : 16),
            size: isNarrow ? 32 : 44,
            phase: 0,
            pitch: 0,
            eaten: false,
            chompX: 0,
            chompY: 0,
            baitfish: Array.from({ length: 6 }, (_, bi) => ({
              dx: (bi - 2.5) * 14,
              dy: ((bi % 3) - 1) * 16,
              vx: 0,
              vy: 0,
              scattered: false,
              size: 4.5 + (bi % 2) * 1.5
            }))
          }
        : null,
      chompTimer: 0,
      victoryRollProgress: 0,
      partner: chosenStunt === "two_playing"
        ? {
            lagX: dir * (isNarrow ? 75 : 130),
            braidPhase: Math.PI,
            length: length * 0.86,
            swimPhase: 1.7
          }
        : null
    };
  },

  pulseActivity({ kind = "complete", x = null, y = null } = {}) {
    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const rx = (typeof x === "number" && isFinite(x)) ? x : w * 0.5;
    const ry = (typeof y === "number" && isFinite(y)) ? y : h * 0.45;
    const isMajor = kind === "queue_clear" || kind === "finalise";

    if (kind === "complete" || isMajor) {
      this.spawnLeviathan(w, h, { isMajor });
    }

    this.sonarRings.push({
      x: rx,
      y: ry,
      r: 12,
      maxR: isMajor ? Math.max(w, h) * 0.52 : Math.min(w, h) * 0.36,
      life: 0,
      maxLife: isMajor ? 72 : 54
    });
    if (this.sonarRings.length > 5) this.sonarRings.shift();

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

    // Preserve realistic longer docking dwells (only trigger early undock after 14s+)
    if (this.sub && this.sub.phase === "docked" && this.sub.t > 14.0) {
      this.sub.phase = "undocking";
      this.sub.t = 0;
      this.sub.dist = 0;
      this.sub.speed = 0;
    } else if (this.cargoSub && this.cargoSub.phase === "docked" && this.cargoSub.t > 14.0) {
      this.cargoSub.phase = "undocking";
      this.cargoSub.t = 0;
      this.cargoSub.dist = 0;
      this.cargoSub.speed = 0;
    } else if (this.elevator && (this.elevator.phase === "docked_station" || this.elevator.phase === "at_surface") && this.elevator.t > 1.0) {
      this.elevator.phase = this.elevator.phase === "at_surface" ? "descending" : "ascending";
      this.elevator.t = 0;
      this.elevator.phaseDuration = this._rand(13.0, 17.5);
    }
  },

  draw(ctx, w, h, mode, dt, step, diurnalHour = null) {
    // Reset viewport-dependent entities cleanly on desktop <-> mobile resize so Director enforces new budget immediately
    if (this._lastW && Math.abs(this._lastW - w) > 20) {
      this.kelp = [];
      this.divers = [];
      this.rovs = [];
      this.fishSchools = [];
      this.whales = [];
      this.sharks = [];
      this.farLife = [];
      this.nearLife = [];
      this.jellies = [];
      this.anglerFish = [];
      this.seaTurtles = [];
      this.fgReefSharks = [];
      this.dolphins = [];
      this.dolphinPodState = null;
      this.roamingSubs = [];
      this.sub = null;
      this.cargoSub = null;
      this.cleaningMantas = [];
      this.cleanerWrasse = [];
      this.cleanSparkles = [];
    }
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode, diurnalHour);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);
    const cel = this.getCelestialLight(w, h, mode, diurnalHour);
    pal.celestial = cel;
    pal.diurnalHour = cel.hour;

    // 1. Blit offscreen cached water ocean column, sandy valley floor & background cleaning reefs
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Animated Ocean Surface Shimmer & Diurnal Slanted Sun/Moon Beams
    this._drawSurfaceShimmer(ctx, w, pal, step, cel);
    if (pal.rayAlpha > 0.04) {
      this._drawGodRays(ctx, w, h, pal, step, mode, cel);
    }

    // 3. Abyssal Solid Leviathans, Far-Depth Megafauna, Fish Schools, Transit Subs & Rear Cleaning Station Mantas/Wrasse BEHIND Station
    this._updateAndDrawLeviathan(ctx, w, h, pal, dt, step);
    this._updateAndDrawWhales(ctx, w, h, pal, dt);
    this._updateAndDrawSharks(ctx, w, h, pal, dt);
    this._updateAndDrawFishSchools(ctx, w, h, pal, dt);
    this._updateAndDrawFarLife(ctx, w, h, pal, dt);
    this._updateAndDrawExtraSubs(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawCleaningStation(ctx, w, h, L, pal, dt, step, "back");

    // 3b. Blit Research Complex, Shipwreck, Surrounding Foreground Cleaning Reefs & Cliffs IN FRONT of Rear Mantas/Depth Life!
    ctx.drawImage(this.stationCacheCanvas, 0, 0, w, h);
    this._drawSeabedCaustics(ctx, w, h, L, pal, step, mode, cel);

    // 4. Live Rotating Hydropower Turbines, Spinning Sonar Array, Beacons, Strobes & Supply Elevator
    this._updateAndDrawTurbines(ctx, L, pal, step);
    this._updateAndDrawSonarArray(ctx, L, pal, step);
    this._drawStationBeacons(ctx, L, pal, step);
    this._updateAndDrawSupplyElevator(ctx, L, pal, dt, step);

    // 4b. Automatic Festive Holiday Additions (waterproof tube light strings, mini dome tree, lanterns, jack-o'-lanterns)
    if (typeof HolidayThemes !== "undefined" && HolidayThemes.drawDeepBlueOverlay) {
      HolidayThemes.drawDeepBlueOverlay(ctx, w, h, L, pal, mode, dt, step);
    }

    // 5. To-Scale Human Maintenance & Shipwreck Research Divers Cycling In/Out of Airlocks!
    this._updateAndDrawDivers(ctx, L, pal, dt, step);

    // 6. Left-Pier & Right-Pier Horizontal Flush-Docking Submarines
    this._updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step);

    // 6a. Foreground Manta Ray Cleaning Station Reef Whips, Circling Mantas & Electric-Blue Cleaner Wrasse Across Seabed
    this._updateAndDrawCleaningStation(ctx, w, h, L, pal, dt, step, "front");

    // 6b. Foreground Playful Marine Life IN FRONT OF Habitat & Submarines (Dolphins, Sea Turtles & Reef Sharks)
    this._updateAndDrawDolphins(ctx, w, h, pal, dt, step);
    this._updateAndDrawSeaTurtles(ctx, w, h, pal, dt, step);
    this._updateAndDrawFgReefSharks(ctx, w, h, pal, dt, step);

    // 7. Director-Gated Maintenance & Shipwreck Expedition ROVs + Deep-Sea Angler Fish
    this._updateAndDrawROVs(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawAnglerFish(ctx, w, h, L, pal, dt, step);

    // 8. Ground-Anchored Swinging Kelp, Foreground Reef Fish & Bioluminescent Jellyfish
    this._drawAnchoredKelp(ctx, pal, step);
    this._updateAndDrawNearLife(ctx, w, h, pal, dt);

    // 9. Rising Bubbles, Hydrothermal Vent Plumes, Marine Snow & Reactive Sonar Rings
    this._updateAndDrawVentBubbles(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawAmbientParticles(ctx, w, h, pal, dt);
  },

  // Dynamic 2.5D Projected Cellular Voronoi-Lattice Water Caustics tracked by above-water celestial light focus
  _drawSeabedCaustics(ctx, w, h, L, pal, step, mode, cel = null) {
    const cState = cel || pal.celestial || this.getCelestialLight(w, h, mode);
    const isNight = mode === "dark";
    const isGolden = mode === "evening";
    const baseAlpha = isNight ? 0.075 : (isGolden ? 0.20 : (mode === "morning" ? 0.22 : 0.17));
    const rgb = isNight ? "148, 224, 255" : (isGolden ? "255, 224, 158" : "205, 250, 255");
    const focusX = cState.primary.x + (L.seabedY * 0.62) * cState.primary.slant;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";

    // Projected jittered Voronoi-like organic cellular light lattice strictly over sandy valley floor (zero wireframe cliff grid!)
    const cols = w < 720 ? 10 : 15;
    const rows = 4;
    const yStart = L.seabedY + 24;
    const ySpan = Math.max(40, h - yStart - 10);
    const grid = [];

    for (let r = 0; r < rows; r++) {
      const rf = r / (rows - 1);
      const yRow = yStart + Math.pow(rf, 1.18) * ySpan;
      const persp = 0.52 + rf * 0.70;
      const rowPts = [];
      for (let c = 0; c <= cols; c++) {
        const cf = c / cols;
        const baseX = (0.14 + cf * 0.72) * w;
        const jx = Math.sin(step * 1.05 + c * 2.1 + r * 2.7) * 18 * persp + Math.cos(step * 0.72 - c * 1.3 + r * 3.1) * 10 * persp;
        const jy = Math.cos(step * 1.18 - r * 2.2 + c * 1.7) * 5.0 * persp + Math.sin(step * 0.85 + c * 2.9) * 2.8 * persp;
        const edgeFade = Math.sin(cf * Math.PI);
        const dirFocus = Math.max(0.28, 1.18 - (Math.abs(baseX - focusX) / (w * 0.42)) * 0.68);
        const sunFocus = edgeFade * dirFocus * (0.38 + 0.62 * (0.5 + 0.5 * Math.sin(cf * 6.5 - step * 0.45 + rf * 2.1)));
        rowPts.push({ x: baseX + jx, y: yRow + jy, focus: sunFocus });
      }
      grid.push(rowPts);
    }

    const drawCausticRib = (p0, p1, mxOff, myOff, width, alpha) => {
      if (alpha < 0.015) return;
      const mx = (p0.x + p1.x) * 0.5 + mxOff;
      const my = (p0.y + p1.y) * 0.5 + myOff;
      ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(mx, my, p1.x, p1.y);
      ctx.stroke();
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const p = grid[r][c];
        const aNode = baseAlpha * p.focus * (0.68 + (r / rows) * 0.44);
        const wEdge = 1.1 + (r / rows) * 0.9;
        if (c < cols) {
          const pr = grid[r][c + 1];
          const wBend = Math.sin(step * 1.35 + c * 1.9 + r) * 6.5;
          drawCausticRib(p, pr, Math.cos(step + c) * 4, wBend, wEdge, aNode * 0.96);
        }
        if (r < rows - 1) {
          const pd = grid[r + 1][c];
          const hBend = Math.cos(step * 1.15 - c + r * 1.7) * 11.0;
          drawCausticRib(p, pd, hBend, Math.sin(step + r) * 3, wEdge * 0.86, aNode * 0.84);
        }
        // Bright caustic vertex crest droplets where light waves converge
        if ((c + r) % 2 === 0 && p.focus > 0.48) {
          const nr = 12 + p.focus * 9;
          const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, nr);
          cg.addColorStop(0, `rgba(${rgb}, ${(aNode * 0.85).toFixed(3)})`);
          cg.addColorStop(1, `rgba(${rgb}, 0)`);
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, nr, nr * 0.30, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Dappled cellular caustic shimmer across eye-level flat hex & wing rooftops
    const roofTargets = [
      { x: L.hubX, y: L.hubY - 18 * L.s, rx: 46 * L.s },
      { x: L.hubX - 62 * L.s, y: L.hubY - 6 * L.s, rx: 28 * L.s },
      { x: L.hubX + 62 * L.s, y: L.hubY - 4 * L.s, rx: 28 * L.s },
      { x: L.westWingX, y: L.westWingY - 12 * L.s, rx: 32 * L.s },
      { x: L.eastWingX, y: L.eastWingY - 16 * L.s, rx: 32 * L.s }
    ];
    ctx.strokeStyle = `rgba(${rgb}, ${(baseAlpha * 0.86).toFixed(3)})`;
    ctx.lineWidth = 1.15;
    roofTargets.forEach((rt, idx) => {
      const dx = Math.sin(step * 0.95 + idx * 1.7) * 6;
      const dx2 = Math.cos(step * 1.2 + idx * 2.1) * 4;
      ctx.beginPath();
      ctx.moveTo(rt.x - rt.rx * 0.58 + dx, rt.y);
      ctx.quadraticCurveTo(rt.x + dx * 0.5, rt.y - 2.6 * L.s, rt.x + rt.rx * 0.58 + dx, rt.y);
      ctx.moveTo(rt.x - rt.rx * 0.32 - dx2, rt.y - 1.5 * L.s);
      ctx.quadraticCurveTo(rt.x, rt.y + 1.4 * L.s, rt.x + rt.rx * 0.38 - dx2, rt.y - 1.2 * L.s);
      ctx.stroke();
    });
    ctx.restore();
  },

  // Gentle hydrothermal vent bubble emission from canyon basalt chimneys
  _updateAndDrawVentBubbles(ctx, w, h, L, pal, dt, step) {
    const ventXs = L.isNarrow ? [] : [w * 0.19, w * 0.88];
    if (ventXs.length > 0 && Math.random() < 0.28) {
      const vx = ventXs[Math.floor(Math.random() * ventXs.length)];
      const vy = this._seabedYAtX(vx, w, h, L) - 8 * L.s;
      if (this.bubbles.length < 48) {
        this.bubbles.push({
          x: vx + (Math.random() - 0.5) * 6 * L.s,
          y: vy,
          r: 1.0 + Math.random() * 1.6,
          vy: -(0.55 + Math.random() * 0.45),
          wobble: step + Math.random() * 6,
          alpha: pal.isDark ? 0.42 : 0.34
        });
      }
    }
  },

  _drawSurfaceShimmer(ctx, w, pal, step, cel = null) {
    const cState = cel || pal.celestial || this.getCelestialLight(w, 900, "light");
    const primX = cState.primary.x;
    ctx.save();

    // Above-water Snell's window bright entry crown centered under the active Sun or Moon
    const snellW = w < 720 ? 140 : 240;
    const snellG = ctx.createRadialGradient(primX, 0, 4, primX, 6, snellW);
    const entryRgb = cState.primary.kind === "moon" ? "186, 230, 253" : pal.rayColor;
    const entryAlpha = (cState.primary.kind === "moon" ? 0.36 : 0.48) * Math.max(0.35, cState.primary.alpha);
    snellG.addColorStop(0, `rgba(255, 255, 255, ${(entryAlpha * 0.92).toFixed(3)})`);
    snellG.addColorStop(0.45, `rgba(${entryRgb}, ${(entryAlpha * 0.52).toFixed(3)})`);
    snellG.addColorStop(1, `rgba(${entryRgb}, 0)`);
    ctx.fillStyle = snellG;
    ctx.beginPath();
    ctx.ellipse(primX, 4, snellW, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle secondary eastern moonlight crown during late dusk twilight
    if (cState.primary.kind === "sun" && cState.moon && cState.moon.visible && Math.abs(cState.moon.x - primX) > 70) {
      const mSnellW = w < 720 ? 90 : 150;
      const mSnellG = ctx.createRadialGradient(cState.moon.x, 0, 2, cState.moon.x, 4, mSnellW);
      mSnellG.addColorStop(0, `rgba(186, 230, 253, ${(0.24 * cState.moon.alpha).toFixed(3)})`);
      mSnellG.addColorStop(1, "rgba(186, 230, 253, 0)");
      ctx.fillStyle = mSnellG;
      ctx.beginPath();
      ctx.ellipse(cState.moon.x, 4, mSnellW, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const sx = ((i * 0.072 + Math.sin(step * 0.35 + i) * 0.015) % 1) * w;
      const sy = 5 + (i % 3) * 7 + Math.sin(step * 1.1 + i * 1.7) * 2.5;
      const len = 28 + (i % 4) * 16;
      const nearLight = Math.max(0.18, 1 - Math.abs(sx - primX) / (w * 0.42));
      const a = (0.10 + nearLight * 0.28 + 0.08 * Math.sin(step * 1.3 + i)) * (pal.isDark && !pal.isGoldenCoastal ? 0.65 : 0.96);
      ctx.strokeStyle = pal.surfaceRipple;
      ctx.globalAlpha = Math.max(0.05, Math.min(0.95, a));
      ctx.lineWidth = 1.4 + nearLight * 0.9;
      ctx.beginPath();
      ctx.moveTo(sx - len * 0.5, sy);
      ctx.lineTo(sx + len * 0.5, sy);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawLightShaftBundle(ctx, w, h, originX, slant, rayColor, rayAlpha, rayCount, rayLenFactor, step, seedOffset = 0) {
    if (rayAlpha <= 0.008) return;
    const spread = Math.min(w * 0.58, 720);
    for (let i = 0; i < rayCount; i++) {
      const frac = rayCount > 1 ? (i / (rayCount - 1) - 0.5) : 0;
      const sway = Math.sin(step * 0.52 + i * 1.3 + seedOffset) * 24;
      const baseX = Math.max(18, Math.min(w - 18, originX + frac * spread + sway));
      const beamSlant = slant + frac * 0.14;
      const topW = 22 + ((i + seedOffset) % 3) * 16;
      const botW = topW * 3.4;
      const rayH = h * (rayLenFactor + (i % 2) * 0.14);
      const centerWeight = 1 - Math.abs(frac) * 0.52;
      const pulse = 0.68 + 0.32 * Math.sin(step * 0.85 + i * 2.0 + seedOffset);
      const a0 = rayAlpha * centerWeight * pulse;

      const g = ctx.createLinearGradient(baseX, 0, baseX + rayH * beamSlant, rayH);
      g.addColorStop(0, `rgba(${rayColor}, ${a0.toFixed(3)})`);
      g.addColorStop(0.62, `rgba(${rayColor}, ${(a0 * 0.34).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rayColor}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseX - topW * 0.5, 0);
      ctx.lineTo(baseX + topW * 0.5, 0);
      ctx.lineTo(baseX + rayH * beamSlant + botW * 0.5, rayH);
      ctx.lineTo(baseX + rayH * beamSlant - botW * 0.5, rayH);
      ctx.closePath();
      ctx.fill();
    }
  },

  _drawGodRays(ctx, w, h, pal, step, mode, cel = null) {
    const cState = cel || pal.celestial || this.getCelestialLight(w, h, mode);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const rayCount = w < 720 ? 5 : 7;

    if (mode === "dark") {
      const m = cState.moon.visible ? cState.moon : cState.primary;
      this._drawLightShaftBundle(
        ctx, w, h,
        m.x, m.slant,
        pal.rayColor, pal.rayAlpha * Math.max(0.42, m.alpha),
        Math.max(4, rayCount - 1), 0.72, step, 3
      );
    } else {
      const s = cState.sun.visible ? cState.sun : cState.primary;
      this._drawLightShaftBundle(
        ctx, w, h,
        s.x, s.slant,
        pal.rayColor, pal.rayAlpha * Math.max(0.38, s.alpha),
        rayCount, mode === "evening" ? 0.80 : 0.68, step, 0
      );
      // Emerging Eastern moonlight rays gently pierce opposite side during twilight
      if (cState.moon && cState.moon.visible && cState.moon.alpha > 0.12) {
        this._drawLightShaftBundle(
          ctx, w, h,
          cState.moon.x, cState.moon.slant,
          "172, 224, 255", 0.11 * cState.moon.alpha,
          3, 0.58, step, 7
        );
      }
    }
    ctx.restore();
  },

  // Ground-Anchored Swinging Kelp Blades (zero floating bases!)
  _drawAnchoredKelp(ctx, pal, step) {
    ctx.save();
    for (let i = 0; i < this.kelp.length; i++) {
      const k = this.kelp[i];
      ctx.globalAlpha = k.foreground ? 0.94 : 0.65;
      ctx.strokeStyle = k.foreground ? pal.kelpColor : pal.kelpTip;
      ctx.lineCap = "round";
      for (let f = 0; f < k.fronds; f++) {
        const bx = k.x + (f - (k.fronds - 1) * 0.5) * 4.5;
        const fh = k.h * (0.76 + (f % 2) * 0.28);
        const sway1 = Math.sin(step * 1.45 + k.phase + f * 0.8) * 6.5;
        const sway2 = Math.sin(step * 1.45 + k.phase + f * 0.8 - 1.1) * 11.5;
        ctx.lineWidth = k.foreground ? 2.6 : 1.9;
        ctx.beginPath();
        ctx.moveTo(bx, k.y + 4); // Firmly rooted inside seabed polygon!
        ctx.bezierCurveTo(bx + sway1, k.y - fh * 0.35, bx - sway1 * 0.5, k.y - fh * 0.72, bx + sway2, k.y - fh);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  _drawStationBeacons(ctx, L, pal, step) {
    const s = L.s;
    const pulse = 0.5 + 0.5 * Math.sin(step * 3.8);
    // Synchronized uniform single-flash navigation strobe array (single crisp flash per 3.4s cycle)
    const strobeAt = (offset) => {
      const c = ((step + offset) % 3.4);
      if (c < 0.11) return 1.0 - (c / 0.11) * 0.25;
      return 0.0;
    };
    const syncStrobe = strobeAt(0);
    const uniformRgb = "186, 242, 255";
    ctx.save();

    const mastX = L.hubX;
    const mastY = L.hubY - 110 * s;
    const strobePts = [
      { x: mastX, y: mastY, rBase: 11 },
      { x: L.westWingX - 28 * s, y: L.westWingY - 40 * s, rBase: 7.5 },
      { x: L.sonarX, y: L.sonarY - 18 * s, rBase: 7.5 },
      { x: L.hubX - 62 * s, y: L.hubY - 22 * s, rBase: 7.5 },
      { x: L.hubX + 62 * s, y: L.hubY - 20 * s, rBase: 7.5 },
      { x: L.elevX, y: L.elevDockY - 38 * s, rBase: 7.5 },
      ...(!L.isNarrow ? [
        { x: L.hydroTurbines[0].x, y: L.hydroTurbines[0].y - 38 * s, rBase: 7.5 },
        { x: L.geoWestX - 3 * s, y: L.geoWestY - 54 * s, rBase: 7.0 },
        { x: L.outerEastX + 34 * s, y: L.outerEastY - 38 * s, rBase: 7.0 }
      ] : [])
    ];
    strobePts.forEach(pt => {
      const fl = syncStrobe;
      const r = (pt.rBase + fl * 9.5) * s;
      const a = 0.24 + fl * 0.72;
      const wg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      wg.addColorStop(0, fl > 0.2 ? `rgba(255, 255, 255, ${a.toFixed(3)})` : `rgba(${uniformRgb}, ${(a * 0.72).toFixed(3)})`);
      wg.addColorStop(0.42, `rgba(${uniformRgb}, ${(a * 0.56).toFixed(3)})`);
      wg.addColorStop(1, `rgba(${uniformRgb}, 0)`);
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Synchronized crisp starburst flare on single-strobe peak
      if (fl > 0.3) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.76 * fl).toFixed(3)})`;
        ctx.lineWidth = 1.0 * s;
        ctx.beginPath();
        ctx.moveTo(pt.x - 6.5 * s, pt.y);
        ctx.lineTo(pt.x + 6.5 * s, pt.y);
        ctx.moveTo(pt.x, pt.y - 6.5 * s);
        ctx.lineTo(pt.x, pt.y + 6.5 * s);
        ctx.stroke();
      }
    });

    const bays = [
      { x: L.leftDockX, y: L.leftDockY, active: this.sub && this.sub.phase !== "patrol_wait" },
      { x: L.rightDockX, y: L.rightDockY, active: this.cargoSub && this.cargoSub.phase !== "patrol_wait" },
      { x: L.elevX, y: L.elevDockY - 4 * s, active: this.elevator && this.elevator.phase === "docked_station" }
    ];
    bays.forEach(bay => {
      const rgb = bay.active ? "186, 242, 255" : "125, 211, 252";
      const a = bay.active ? (0.44 + 0.34 * pulse) : (0.22 + 0.18 * pulse);
      const dg = ctx.createRadialGradient(bay.x, bay.y, 0, bay.x, bay.y, 13 * s);
      dg.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
      dg.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(bay.x, bay.y, 13 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  // To-Scale Human Maintenance & Shipwreck Research Divers (photo / sample / survey expeditions, Director-gated)
  _updateAndDrawDivers(ctx, L, pal, dt, step) {
    const s = L.s;
    const lockPt = { x: L.airlockX, y: L.airlockY };
    const exitPt = { x: L.airlockX + 6 * s, y: L.airlockY + 18 * s };

    for (let i = 0; i < this.divers.length; i++) {
      const d = this.divers[i];
      d.t += dt;
      d.kickPhase += dt * 7.5;
      let visible = false;
      let working = false;
      let flashPulse = 0;

      if (d.phase === "inside_airlock") {
        d.x = lockPt.x;
        d.y = lockPt.y;
        if (d.t >= d.phaseDuration) {
          if (this._canActivate("divers", L.isNarrow)) {
            d.phase = "airlock_exit";
            d.t = 0;
            d.phaseDuration = 2.6;
            if (d.role === "wreck_research") {
              d.action = this._pick(["photo", "sample", "survey"]);
              d.visitsLeft = 2;
              d.flashTimer = this._rand(0.8, 1.8);
            }
            for (let b = 0; b < 5; b++) {
              this.bubbles.push({
                x: lockPt.x + (Math.random() - 0.5) * 6 * s,
                y: lockPt.y + 4 * s,
                r: 1.0 + Math.random() * 1.4,
                vy: -(0.5 + Math.random() * 0.4),
                wobble: Math.random() * 6,
                alpha: 0.45
              });
            }
          } else {
            d.phaseDuration += this._rand(4.0, 8.0);
          }
        }
      } else if (d.phase === "airlock_exit") {
        visible = true;
        const p = Math.min(1, d.t / d.phaseDuration);
        d.x = this._lerp(lockPt.x, exitPt.x, p);
        d.y = this._lerp(lockPt.y, exitPt.y, p);
        d.facingLeft = d.targetPt.x < d.x;
        if (d.t >= d.phaseDuration) {
          d.path = null;
          d.phase = "swim_to_site";
          d.dist = 0;
          d.t = 0;
        }
      } else if (d.phase === "swim_to_site") {
        visible = true;
        if (!d.path) {
          const arcLift = d.role === "wreck_research" ? -56 * s : 18 * s;
          d.path = this._buildArcPath([{
            type: "cubic",
            p0: exitPt,
            p1: { x: this._lerp(exitPt.x, d.targetPt.x, 0.3), y: exitPt.y + arcLift },
            p2: { x: this._lerp(exitPt.x, d.targetPt.x, 0.75), y: d.targetPt.y - 26 * s },
            p3: d.targetPt
          }], d.role === "wreck_research" ? 32 : 18);
        }
        const swimSpd = d.role === "wreck_research" ? 24.0 : 11.0;
        d.dist += swimSpd * dt;
        const pt = this._sampleArcPath(d.path, d.dist);
        d.x = pt.x;
        d.y = pt.y + Math.sin(d.kickPhase * 0.5) * 1.2 * s;
        d.facingLeft = pt.dx < 0;
        if (d.dist >= d.path.totalLen) {
          d.phase = d.role === "wreck_research" ? "expedition_work" : "weld_inspect";
          d.t = 0;
          d.phaseDuration = this._rand(6.5, 10.5);
          if (d.role === "wreck_research") {
            d.action = this._pick(["photo", "sample", "survey"]);
          }
        }
      } else if (d.phase === "expedition_work" || d.phase === "weld_inspect") {
        visible = true;
        working = true;
        const activeTarget = (d.role === "wreck_research" && d.visitsLeft === 1 && d.targetPt.altX != null)
          ? { x: d.targetPt.altX, y: d.targetPt.altY }
          : { x: d.targetPt.tx, y: d.targetPt.ty };
        const driftX = d.action === "survey" ? Math.sin(step * 1.1 + i) * 10.0 * s : Math.sin(step * 1.2 + i) * 3.0 * s;
        const driftY = d.action === "sample" ? 2.5 * s + Math.cos(step * 1.6 + i) * 1.5 * s : Math.cos(step * 1.4 + i) * 2.4 * s;
        d.x = this._lerp(d.x, activeTarget.x + driftX, Math.min(1, dt * 1.6));
        d.y = this._lerp(d.y, activeTarget.y + driftY, Math.min(1, dt * 1.6));
        d.facingLeft = d.role === "wreck_research"
          ? d.x > (L.wreck ? L.wreck.x : activeTarget.x)
          : activeTarget.x > L.hubX;

        if (d.role === "wreck_research") {
          if (d.action === "photo") {
            d.flashTimer = (d.flashTimer || 1.2) - dt;
            if (d.flashTimer <= 0) {
              d.flashTimer = this._rand(2.0, 2.8);
              d.flashBurst = 0.20;
            }
            if (d.flashBurst > 0) {
              d.flashBurst = Math.max(0, d.flashBurst - dt);
              flashPulse = d.flashBurst / 0.20;
            }
          } else if (d.action === "sample" && Math.random() < 0.08) {
            this.bubbles.push({
              x: d.x + (d.facingLeft ? -4 : 4) * s,
              y: d.y + 4 * s,
              r: 1.4 + Math.random() * 1.6,
              vy: -(0.30 + Math.random() * 0.25),
              wobble: Math.random() * 6,
              alpha: 0.28
            });
          }
        }

        if (d.t >= d.phaseDuration) {
          if (d.role === "wreck_research" && (d.visitsLeft || 1) > 1) {
            d.visitsLeft -= 1;
            d.action = this._pick(["photo", "sample", "survey"]);
            d.t = 0;
            d.phaseDuration = this._rand(6.0, 9.5);
          } else {
            const retLift = d.role === "wreck_research" ? -54 * s : 16 * s;
            d.path = this._buildArcPath([{
              type: "cubic",
              p0: { x: d.x, y: d.y },
              p1: { x: this._lerp(d.x, exitPt.x, 0.35), y: d.y - 24 * s },
              p2: { x: this._lerp(d.x, exitPt.x, 0.72), y: exitPt.y + retLift },
              p3: exitPt
            }], d.role === "wreck_research" ? 32 : 18);
            d.phase = "swim_back";
            d.dist = 0;
            d.t = 0;
          }
        }
      } else if (d.phase === "swim_back") {
        visible = true;
        const retSpd = d.role === "wreck_research" ? 23.0 : 10.5;
        d.dist += retSpd * dt;
        const pt = this._sampleArcPath(d.path, d.dist);
        d.x = pt.x;
        d.y = pt.y + Math.sin(d.kickPhase * 0.5) * 1.2 * s;
        d.facingLeft = pt.dx < 0;
        if (d.dist >= d.path.totalLen) {
          d.phase = "airlock_enter";
          d.t = 0;
          d.phaseDuration = 2.6;
        }
      } else {
        visible = true;
        const p = Math.min(1, d.t / d.phaseDuration);
        d.x = this._lerp(exitPt.x, lockPt.x, p);
        d.y = this._lerp(exitPt.y, lockPt.y, p);
        if (d.t >= d.phaseDuration) {
          d.phase = "inside_airlock";
          d.t = 0;
          d.phaseDuration = this._rand(18.0, 32.0);
        }
      }

      if (!visible) continue;

      if (Math.random() < 0.14) {
        this.bubbles.push({
          x: d.x,
          y: d.y - 2 * s,
          r: 0.7 + Math.random() * 0.9,
          vy: -(0.45 + Math.random() * 0.35),
          wobble: Math.random() * 6,
          alpha: 0.36
        });
      }

      // Draw To-Scale High-Visibility Human Diver (slightly larger & amber-accented for wreck expedition clarity)
      const isResearchDiver = d.role === "wreck_research";
      const diverScale = s * (isResearchDiver ? 1.15 : 0.92);
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.facingLeft) ctx.scale(-1, 1);
      ctx.scale(diverScale, diverScale);

      // Crisp Helmet Headlamp Volumetric Cone (or Cyan Survey Fan!)
      const isSurvey = working && isResearchDiver && d.action === "survey";
      const beamAlpha = pal.isDark ? 0.54 : 0.32;
      const beamColor = isSurvey ? "56, 224, 232" : "224, 247, 250";
      const hb = ctx.createLinearGradient(5, -1, isSurvey ? 38 : 30, 0);
      hb.addColorStop(0, `rgba(${beamColor}, ${(beamAlpha * (isSurvey ? 1.35 : 1)).toFixed(3)})`);
      hb.addColorStop(1, `rgba(${beamColor}, 0)`);
      ctx.fillStyle = hb;
      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.lineTo(isSurvey ? 38 : 30, isSurvey ? -11 : -7);
      ctx.lineTo(isSurvey ? 38 : 30, isSurvey ? 10 : 6);
      ctx.lineTo(5, 0);
      ctx.closePath();
      ctx.fill();

      // Wetsuit torso, high-visibility shoulder harness & scuba tank
      ctx.fillStyle = isResearchDiver ? "#334155" : "#1E293B";
      ctx.beginPath();
      ctx.roundRect(-4, -1.7, 8.2, 3.4, 1.4);
      ctx.fill();
      if (isResearchDiver) {
        ctx.fillStyle = "#FB923C";
        ctx.fillRect(0.2, -1.7, 2.8, 3.4);
      }
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(-2.5, -3.1, 4.6, 1.7);

      // Scuba helmet with glowing aqua visor
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.arc(4.8, -0.5, 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#67E8F9";
      ctx.beginPath();
      ctx.arc(5.5, -0.5, 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Animated scissor diving fins
      const kick = Math.sin(d.kickPhase) * 2.2;
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-8.2, -1.2 + kick);
      ctx.moveTo(-4, 0.8);
      ctx.lineTo(-8.2, 1.6 - kick);
      ctx.stroke();

      // Expedition Action Visual Cues (Photography Strobe Flash / Sampling Tool & Silt / Exterior Survey Scanner)
      if (working && d.role === "wreck_research") {
        if (d.action === "photo") {
          ctx.fillStyle = "#334155";
          ctx.fillRect(5.2, -0.2, 2.4, 1.8);
          if (flashPulse > 0.05) {
            const fg = ctx.createRadialGradient(8.5, 0, 0, 8.5, 0, 22 * flashPulse);
            fg.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * flashPulse).toFixed(3)})`);
            fg.addColorStop(0.4, `rgba(165, 243, 252, ${(0.55 * flashPulse).toFixed(3)})`);
            fg.addColorStop(1, "rgba(165, 243, 252, 0)");
            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.arc(8.5, 0, 22 * flashPulse, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (d.action === "sample") {
          ctx.strokeStyle = pal.rovBody;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(4.0, 1.2);
          ctx.lineTo(7.5, 5.2);
          ctx.stroke();
          ctx.fillStyle = "rgba(148, 198, 214, 0.34)";
          ctx.beginPath();
          ctx.arc(8.2, 5.5 + Math.sin(step * 4) * 1.0, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (d.action === "survey") {
          ctx.strokeStyle = "rgba(103, 232, 249, 0.65)";
          ctx.lineWidth = 0.9;
          const scanY = Math.sin(step * 5 + i) * 6;
          ctx.beginPath();
          ctx.moveTo(6.5, -0.5);
          ctx.lineTo(26, scanY);
          ctx.stroke();
        }
      } else if (working && Math.sin(step * 28 + i * 3) > -0.2) {
        ctx.fillStyle = "rgba(103, 232, 249, 0.94)";
        ctx.beginPath();
        ctx.arc(7.5, -0.5, 2.4 + Math.random() * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(253, 224, 71, 0.90)";
        for (let sp = 0; sp < 3; sp++) {
          ctx.beginPath();
          ctx.arc(8 + Math.random() * 5, (Math.random() - 0.5) * 5, 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  },

  _updateAndDrawSupplyElevator(ctx, L, pal, dt, step) {
    const el = this.elevator;
    if (!el) return;
    el.t += dt;
    const s = L.s;
    const topY = -20;
    const botY = L.elevDockY - 12 * s;
    let moving = false;

    if (el.phase === "at_surface") {
      el.y = topY;
      if (el.t >= el.phaseDuration) {
        el.phase = "descending";
        el.t = 0;
        el.phaseDuration = this._rand(14.0, 18.5);
      }
    } else if (el.phase === "descending") {
      moving = true;
      const p = Math.min(1, el.t / el.phaseDuration);
      const ease = p < 0.15 ? (p * p) / 0.30 : (p > 0.85 ? 1 - ((1 - p) * (1 - p)) / 0.30 : (p - 0.075) / 0.85);
      el.y = topY + (botY - topY) * this._clamp(ease, 0, 1);
      if (el.t >= el.phaseDuration) {
        el.phase = "docked_station";
        el.t = 0;
        el.phaseDuration = this._rand(8.5, 15.0);
      }
    } else if (el.phase === "docked_station") {
      el.y = botY + Math.sin(step * 2.0) * 0.35;
      if (el.t >= el.phaseDuration) {
        el.phase = "ascending";
        el.t = 0;
        el.phaseDuration = this._rand(14.0, 18.5);
      }
    } else {
      moving = true;
      const p = Math.min(1, el.t / el.phaseDuration);
      const ease = p < 0.15 ? (p * p) / 0.30 : (p > 0.85 ? 1 - ((1 - p) * (1 - p)) / 0.30 : (p - 0.075) / 0.85);
      el.y = botY + (topY - botY) * this._clamp(ease, 0, 1);
      if (el.t >= el.phaseDuration) {
        el.phase = "at_surface";
        el.t = 0;
        el.phaseDuration = this._rand(7.0, 14.0);
      }
    }

    if (el.y < -14) return;

    if (moving && Math.random() < 0.24) {
      this.bubbles.push({
        x: L.elevX + (Math.random() - 0.5) * 12 * s,
        y: el.y - 10 * s,
        r: 1.0 + Math.random() * 1.4,
        vy: -(0.35 + Math.random() * 0.36),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.30 + Math.random() * 0.20
      });
    }

    ctx.save();
    ctx.translate(L.elevX, el.y);
    ctx.scale(s, s);

    if (el.phase === "descending" && el.y > botY * 0.45) {
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const cg = ctx.createLinearGradient(0, 12, 0, 54);
      cg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${pal.isDark ? 0.32 : 0.15})`);
      cg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-5.5, 12);
      ctx.lineTo(-17, 54);
      ctx.lineTo(17, 54);
      ctx.lineTo(5.5, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.fillStyle = pal.subHullDark;
    ctx.fillRect(-9.5, -15.5, 19, 3.8);

    const eg = ctx.createLinearGradient(-11.5, 0, 11.5, 0);
    eg.addColorStop(0, pal.subHullLight);
    eg.addColorStop(0.55, pal.subHullMid);
    eg.addColorStop(1, pal.subHullDark);
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.roundRect(-11.5, -12.5, 23, 23, 5.5);
    ctx.fill();

    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(-11.5, -2, 23, 2.8);
    this._drawWindowBand(ctx, -7, -9, 14, 4.2, 1, pal, 1);

    ctx.fillStyle = pal.subHullDark;
    ctx.fillRect(-8.5, 9.5, 17, 3.8);

    ctx.fillStyle = el.phase === "docked_station" ? "#34D399" : "#22D3EE";
    ctx.beginPath();
    ctx.arc(0, -17, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // Synchronized Undulating Coastal Fish Schools (Director-gated)
  _updateAndDrawFishSchools(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    const isNarrow = w < 720;
    ctx.save();
    for (let i = 0; i < this.fishSchools.length; i++) {
      const sc = this.fishSchools[i];
      if (!sc.active) {
        sc.waitTimer = (sc.waitTimer || 0) - dt;
        if (sc.waitTimer <= 0) {
          if (this._canActivate("fishSchools", isNarrow)) {
            sc.active = true;
            const goRight = Math.random() < 0.5;
            sc.vx = (goRight ? 1 : -1) * this._rand(0.38, 0.60);
            sc.x = goRight ? -sc.spread : (w + sc.spread);
            sc.y = h * this._rand(0.12, 0.36);
          } else {
            sc.waitTimer = this._rand(2.0, 5.0);
          }
        }
        continue;
      }

      sc.phase += 0.036 * scaleDt;
      sc.x += sc.vx * scaleDt;
      sc.y += Math.sin(sc.phase * 0.55) * 0.18 * scaleDt;

      if ((sc.vx > 0 && sc.x > w + sc.spread) || (sc.vx < 0 && sc.x < -sc.spread)) {
        sc.active = false;
        sc.waitTimer = this._rand(isNarrow ? 12 : 7, isNarrow ? 24 : 18);
        continue;
      }

      const alpha = (0.16 + sc.depth * 0.44) * (pal.isDark && !pal.isGoldenCoastal ? 0.65 : 0.85);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;
      const dir = sc.vx < 0 ? -1 : 1;

      for (let m = 0; m < sc.members.length; m++) {
        const mb = sc.members[m];
        const fx = sc.x + mb.ox + Math.cos(sc.phase + mb.pOff) * 3.5;
        const fy = sc.y + mb.oy + Math.sin(sc.phase * 1.3 + mb.pOff) * 4.5;
        const sz = mb.sz;
        const wag = Math.sin(sc.phase * 2.4 + mb.pOff) * 1.1;

        ctx.save();
        ctx.translate(fx, fy);
        if (dir < 0) ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.ellipse(0, 0, sz, sz * 0.36, 0, 0, Math.PI * 2);
        ctx.moveTo(-sz * 0.75, 0);
        ctx.lineTo(-sz * 1.45, -sz * 0.42 + wag);
        ctx.lineTo(-sz * 1.45, sz * 0.42 + wag);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  },

  _updateAndDrawWhales(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    const isNarrow = w < 720;
    ctx.save();
    for (let i = 0; i < this.whales.length; i++) {
      const wh = this.whales[i];
      if (!wh.active) {
        wh.waitTimer = (wh.waitTimer || 0) - dt;
        if (wh.waitTimer <= 0) {
          if (this._canActivate("megafauna", isNarrow)) {
            wh.active = true;
            const goRight = Math.random() < 0.5;
            wh.vx = (goRight ? 1 : -1) * this._rand(0.16, 0.22);
            wh.x = goRight ? -wh.len * 1.4 : (w + wh.len * 1.4);
            wh.y = h * this._rand(0.10, 0.28);
          } else {
            wh.waitTimer = this._rand(2.5, 5.5);
          }
        }
        continue;
      }

      wh.phase += 0.017 * scaleDt;
      wh.x += wh.vx * scaleDt;
      wh.y += Math.sin(wh.phase * 0.6) * 0.13 * scaleDt;

      if ((wh.vx > 0 && wh.x > w + wh.len * 1.4) || (wh.vx < 0 && wh.x < -wh.len * 1.4)) {
        wh.active = false;
        wh.waitTimer = this._rand(isNarrow ? 16 : 9, isNarrow ? 32 : 22);
        continue;
      }

      const alpha = (0.14 + wh.depth * 0.52) * (pal.isDark && !pal.isGoldenCoastal ? 0.68 : 0.78);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(wh.x, wh.y);
      if (wh.vx < 0) ctx.scale(-1, 1);

      const L = wh.len;
      const tailWag = Math.sin(wh.phase * 1.4) * (L * 0.06);

      ctx.beginPath();
      ctx.moveTo(L * 0.50, -L * 0.02);
      ctx.quadraticCurveTo(L * 0.20, -L * 0.13, -L * 0.10, -L * 0.10);
      ctx.quadraticCurveTo(-L * 0.30, -L * 0.07 + tailWag * 0.45, -L * 0.48, tailWag - L * 0.02);
      ctx.lineTo(-L * 0.60, tailWag * 1.25 - L * 0.13);
      ctx.quadraticCurveTo(-L * 0.54, tailWag * 1.15, -L * 0.60, tailWag * 1.25 + L * 0.12);
      ctx.lineTo(-L * 0.48, tailWag + L * 0.03);
      ctx.quadraticCurveTo(-L * 0.28, L * 0.06 + tailWag * 0.45, -L * 0.10, L * 0.09);
      ctx.quadraticCurveTo(L * 0.22, L * 0.12, L * 0.50, -L * 0.02);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(L * 0.16, L * 0.02);
      ctx.quadraticCurveTo(L * 0.02, L * 0.25, -L * 0.09, L * 0.22);
      ctx.quadraticCurveTo(L * 0.02, L * 0.10, L * 0.07, L * 0.01);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawSharks(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    const isNarrow = w < 720;
    ctx.save();
    for (let i = 0; i < this.sharks.length; i++) {
      const sh = this.sharks[i];
      if (!sh.active) {
        sh.waitTimer = (sh.waitTimer || 0) - dt;
        if (sh.waitTimer <= 0) {
          if (this._canActivate("megafauna", isNarrow)) {
            sh.active = true;
            const goRight = Math.random() < 0.5;
            const mag = sh.species === "whale_shark" ? 0.32 : this._rand(0.46, 0.62);
            sh.vx = (goRight ? 1 : -1) * mag;
            sh.x = goRight ? -sh.size * 2 : (w + sh.size * 2);
            sh.y = h * this._rand(0.14, 0.35);
          } else {
            sh.waitTimer = this._rand(2.0, 5.0);
          }
        }
        continue;
      }

      sh.phase += 0.044 * scaleDt;
      sh.x += sh.vx * scaleDt;
      sh.y += Math.sin(sh.phase * 0.45) * 0.14 * scaleDt;

      if ((sh.vx > 0 && sh.x > w + sh.size * 2) || (sh.vx < 0 && sh.x < -sh.size * 2)) {
        sh.active = false;
        sh.waitTimer = this._rand(isNarrow ? 14 : 8, isNarrow ? 28 : 20);
        continue;
      }

      const alpha = (0.18 + sh.depth * 0.55) * (pal.isDark && !pal.isGoldenCoastal ? 0.72 : 0.86);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(sh.x, sh.y);
      if (sh.vx < 0) ctx.scale(-1, 1);

      const sz = sh.size;
      const tailSway = Math.sin(sh.phase * 1.9) * (sz * 0.085);

      if (sh.species === "whale_shark") {
        ctx.beginPath();
        ctx.moveTo(sz * 0.52, -sz * 0.05);
        ctx.lineTo(sz * 0.50, sz * 0.08);
        ctx.quadraticCurveTo(sz * 0.20, sz * 0.14, -sz * 0.12, sz * 0.09);
        ctx.quadraticCurveTo(-sz * 0.28, sz * 0.06 + tailSway * 0.45, -sz * 0.44, tailSway + sz * 0.03);
        ctx.lineTo(-sz * 0.62, tailSway * 1.32 - sz * 0.22);
        ctx.lineTo(-sz * 0.52, tailSway * 1.12);
        ctx.lineTo(-sz * 0.58, tailSway * 1.28 + sz * 0.14);
        ctx.lineTo(-sz * 0.44, tailSway - sz * 0.03);
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.07 + tailSway * 0.45, -sz * 0.22, -sz * 0.095);
        ctx.lineTo(-sz * 0.14, -sz * 0.25);
        ctx.lineTo(-sz * 0.04, -sz * 0.125);
        ctx.quadraticCurveTo(sz * 0.22, -sz * 0.14, sz * 0.52, -sz * 0.05);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sz * 0.18, sz * 0.02);
        ctx.lineTo(sz * 0.02, sz * 0.28);
        ctx.lineTo(-sz * 0.08, sz * 0.02);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(${pal.snowRgb}, ${(alpha * 0.45).toFixed(3)})`;
        for (let sp = 0; sp < 6; sp++) {
          ctx.beginPath();
          ctx.arc(sz * (0.24 - sp * 0.09), -sz * 0.04 + (sp % 2) * sz * 0.04, Math.max(0.8, sz * 0.018), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sh.species === "hammerhead") {
        ctx.beginPath();
        ctx.moveTo(sz * 0.50, 0);
        ctx.quadraticCurveTo(sz * 0.28, -sz * 0.085, sz * 0.10, -sz * 0.095);
        ctx.quadraticCurveTo(0, -sz * 0.34, -sz * 0.10, -sz * 0.30);
        ctx.quadraticCurveTo(-sz * 0.05, -sz * 0.16, -sz * 0.09, -sz * 0.085);
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.06 + tailSway * 0.45, -sz * 0.46, tailSway - sz * 0.02);
        ctx.lineTo(-sz * 0.68, tailSway * 1.35 - sz * 0.24);
        ctx.lineTo(-sz * 0.52, tailSway * 1.15 + sz * 0.01);
        ctx.lineTo(-sz * 0.57, tailSway * 1.28 + sz * 0.11);
        ctx.lineTo(-sz * 0.44, tailSway + sz * 0.03);
        ctx.quadraticCurveTo(-sz * 0.28, sz * 0.05 + tailSway * 0.45, -sz * 0.10, sz * 0.08);
        ctx.quadraticCurveTo(sz * 0.20, sz * 0.10, sz * 0.50, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(sz * 0.42, -sz * 0.14, sz * 0.11, sz * 0.28, sz * 0.04);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sz * 0.16, sz * 0.01);
        ctx.lineTo(0, sz * 0.22);
        ctx.lineTo(-sz * 0.06, sz * 0.01);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(sz * 0.54, -sz * 0.01);
        ctx.quadraticCurveTo(sz * 0.32, -sz * 0.11, sz * 0.12, -sz * 0.115);
        ctx.lineTo(-sz * 0.04, -sz * 0.33);
        ctx.lineTo(-sz * 0.12, -sz * 0.105);
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.07 + tailSway * 0.45, -sz * 0.44, tailSway - sz * 0.028);
        ctx.lineTo(-sz * 0.62, tailSway * 1.35 - sz * 0.24);
        ctx.quadraticCurveTo(-sz * 0.50, tailSway * 1.15, -sz * 0.60, tailSway * 1.30 + sz * 0.20);
        ctx.lineTo(-sz * 0.44, tailSway + sz * 0.036);
        ctx.quadraticCurveTo(-sz * 0.28, sz * 0.08 + tailSway * 0.45, -sz * 0.10, sz * 0.115);
        ctx.quadraticCurveTo(sz * 0.22, sz * 0.14, sz * 0.54, -sz * 0.01);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(sz * 0.20, sz * 0.02);
        ctx.lineTo(sz * 0.02, sz * 0.26);
        ctx.lineTo(-sz * 0.04, sz * 0.02);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(${pal.snowRgb}, ${(alpha * 0.22).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(sz * 0.44, sz * 0.03);
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.12, -sz * 0.16, sz * 0.05);
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.07, sz * 0.44, sz * 0.03);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  _updateAndDrawFarLife(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    const isNarrow = w < 720;
    ctx.save();
    for (let i = 0; i < this.farLife.length; i++) {
      const f = this.farLife[i];
      if (f.kind === "manta") continue;

      f.phase += 0.042 * scaleDt;
      f.x += f.vx * scaleDt;
      f.y += Math.sin(f.phase * 0.7) * 0.16 * scaleDt;

      if (f.vx > 0 && f.x > w + 75) f.x = -75;
      if (f.vx < 0 && f.x < -75) f.x = w + 75;

      const visAlpha = (0.14 + f.depth * 0.45) * (pal.isDark && !pal.isGoldenCoastal ? 0.72 : 0.85);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${visAlpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.vx < 0) ctx.scale(-1, 1);

      const sz = f.size;
      const wag = Math.sin(f.phase * 2.2) * 1.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, sz, sz * 0.40, 0, 0, Math.PI * 2);
      ctx.moveTo(-sz * 0.8, 0);
      ctx.lineTo(-sz * 1.5, -sz * 0.45 + wag);
      ctx.lineTo(-sz * 1.5, sz * 0.45 + wag);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // 10 Cohesive Theme-Synchronized Submarine Classes (Passenger, Cargo, Experimental, Military & Patrol)
  _drawSubmarineModel(ctx, style, pal, step, thrusterGlow = 0.3, showBeam = false) {
    const hullG = ctx.createLinearGradient(0, -18, 0, 18);
    hullG.addColorStop(0, pal.subHullLight);
    hullG.addColorStop(0.52, pal.subHullMid);
    hullG.addColorStop(1, pal.subHullDark);

    const beamOrigin = style === "los_angeles_ssn" ? 86
      : (style === "heavy_freighter" ? 64
      : (style === "deep_explorer" ? 60
      : (style === "passenger_liner" ? 60
      : (style === "military_stealth" ? 62
      : (style === "experimental_research" ? 54
      : (style === "bathyscaphe" ? 28 : 48))))));
    if (showBeam) {
      ctx.save();
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const coneLen = pal.isDark ? 126 : 74;
      const bg = ctx.createLinearGradient(beamOrigin, 0, beamOrigin + coneLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.70).toFixed(3)})`);
      bg.addColorStop(0.5, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.24).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(beamOrigin - 2, -3.5);
      ctx.lineTo(beamOrigin + coneLen, -24);
      ctx.lineTo(beamOrigin + coneLen, 24);
      ctx.lineTo(beamOrigin - 2, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (style === "passenger_liner") {
      // Sleek Dual-Deck Oceanic Passenger Liner (ceramic-light hull, twin continuous cabin ribbons & glazed nose lounge)
      const passG = ctx.createLinearGradient(0, -16, 0, 16);
      passG.addColorStop(0, pal.hullLight);
      passG.addColorStop(0.55, pal.subHullLight);
      passG.addColorStop(1, pal.subHullMid);
      ctx.fillStyle = passG;
      ctx.beginPath();
      ctx.moveTo(60, 1);
      ctx.quadraticCurveTo(48, -14.5, 16, -15.0);
      ctx.lineTo(-48, -14.0);
      ctx.lineTo(-58, -7.5);
      ctx.lineTo(-58, 8.5);
      ctx.lineTo(-48, 13.8);
      ctx.lineTo(24, 14.2);
      ctx.quadraticCurveTo(48, 13.0, 60, 1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-46, -14.0);
      ctx.lineTo(16, -15.0);
      ctx.quadraticCurveTo(44, -14.0, 56, -2.5);
      ctx.stroke();

      // Sculpted glazed passenger bridge crest & dorsal promenade spine
      ctx.fillStyle = pal.subHullMid;
      ctx.beginPath();
      ctx.moveTo(34, -14.5);
      ctx.lineTo(20, -21.5);
      ctx.lineTo(-16, -21.5);
      ctx.lineTo(-22, -14.0);
      ctx.closePath();
      ctx.fill();
      this._drawWindowBand(ctx, -10, -19.5, 28, 3.6, 3, pal, 1);

      // Dual-deck panoramic illuminated passenger cabin window ribbons & signature cyan livery stripe
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-44, 0.2, 88, 2.4);
      this._drawWindowBand(ctx, -38, -10.5, 76, 3.6, 8, pal, 1);
      this._drawWindowBand(ctx, -36, -5.2, 72, 3.2, 7, pal, 1);

      // Forward panoramic observation dome + shrouded quiet twin stern thrusters
      ctx.fillStyle = pal.windowMid;
      ctx.beginPath();
      ctx.arc(54, 1, 6.2, -Math.PI * 0.44, Math.PI * 0.44);
      ctx.fill();
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-62, -9.5, 6, 19);
    } else if (style === "experimental_research") {
      // Avant-Garde Twin-Nacelle Abyssal Prototype (huge acrylic sphere bridge, glowing MHD coils & sampling arm)
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.roundRect(-42, -12, 76, 24, 9);
      ctx.fill();

      // Lateral Twin MHD Plasma Drive Nacelles flanking hull with glowing cyan coils
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.roundRect(-46, -16.5, 52, 6.5, 3);
      ctx.roundRect(-46, 10.0, 52, 6.5, 3);
      ctx.fill();
      ctx.fillStyle = "#22D3EE";
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(step * 4.5);
      [-34, -22, -10].forEach(cx => {
        ctx.fillRect(cx, -15.0, 4.5, 3.0);
        ctx.fillRect(cx, 11.8, 4.5, 3.0);
      });
      ctx.globalAlpha = 1;

      // Swept forward-canted experimental tail planes + sensor mast
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(-26, -12);
      ctx.lineTo(-42, -23.5);
      ctx.lineTo(-48, -22.0);
      ctx.lineTo(-38, -12);
      ctx.closePath();
      ctx.fill();

      // Giant Transparent Hemispherical Acrylic Cockpit Sphere showing warm interior deck console glow
      const expDomeG = ctx.createRadialGradient(39, -2, 2, 37, 0, 14);
      expDomeG.addColorStop(0, pal.glassHighlight);
      expDomeG.addColorStop(0.42, pal.windowMid);
      expDomeG.addColorStop(1, pal.windowRecess);
      ctx.fillStyle = expDomeG;
      ctx.beginPath();
      ctx.arc(36, 0, 12.6, -Math.PI * 0.52, Math.PI * 0.52);
      ctx.fill();
      ctx.strokeStyle = pal.subHullLight;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Forward acoustic sensor boom & ventral articulated manipulator arm
      ctx.strokeStyle = pal.rovBody;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(22, 11);
      ctx.lineTo(38, 17);
      ctx.lineTo(48, 14);
      ctx.stroke();
    } else if (style === "military_stealth") {
      // Angular Faceted Low-Observable Naval Defense Submarine (chined stealth hull, sloped sail, VLS hatches & pump-jet)
      const milG = ctx.createLinearGradient(0, -16, 0, 16);
      milG.addColorStop(0, pal.subHullDark);
      milG.addColorStop(0.55, pal.hullDeep);
      milG.addColorStop(1, "#0B1624");
      ctx.fillStyle = milG;
      ctx.beginPath();
      ctx.moveTo(62, 1.5);
      ctx.lineTo(36, -12.5);
      ctx.lineTo(-44, -12.5);
      ctx.lineTo(-60, -4.5);
      ctx.lineTo(-60, 6.5);
      ctx.lineTo(-44, 13.0);
      ctx.lineTo(42, 12.5);
      ctx.closePath();
      ctx.fill();

      // Sharp stealth chine bevel highlight & recessed VLS hatch panel seams
      ctx.strokeStyle = pal.subHullMid;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-54, -2);
      ctx.lineTo(54, -0.5);
      ctx.stroke();
      ctx.fillStyle = pal.hullDark;
      [-28, -14, 0, 14].forEach(hx => {
        ctx.fillRect(hx, -12.5, 9, 2.2);
      });

      // Tall Angular Forward-Raked Stealth Conning Sail + Retracted Periscope/ESM Masts + Armored Slit
      ctx.fillStyle = pal.hullDeep;
      ctx.beginPath();
      ctx.moveTo(22, -12.5);
      ctx.lineTo(14, -27.5);
      ctx.lineTo(-6, -27.5);
      ctx.lineTo(-14, -12.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.subHullMid;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(4, -27.5);
      ctx.lineTo(4, -35.5);
      ctx.moveTo(9, -27.5);
      ctx.lineTo(9, -32.5);
      ctx.stroke();

      // Narrow tactical bridge slit & shrouded X-fin pump-jet tail
      ctx.fillStyle = "rgba(248, 113, 113, 0.78)";
      ctx.fillRect(10, -22.5, 7, 1.8);
      ctx.fillStyle = "#0F172A";
      ctx.beginPath();
      ctx.moveTo(-48, -9);
      ctx.lineTo(-62, -16);
      ctx.lineTo(-64, 16);
      ctx.lineTo(-48, 9);
      ctx.closePath();
      ctx.fill();
    } else if (style === "los_angeles_ssn") {
      // Iconic Larger Los Angeles-Class (688) Fast-Attack Nuclear Submarine
      // Long cylindrical matte dark pressure hull + hemispherical sonar dome + tall forward fairwater sail w/ diving planes + cruciform stern & skewed propeller
      const laG = ctx.createLinearGradient(0, -16, 0, 16);
      laG.addColorStop(0, pal.isDark ? "#2D4258" : "#3E566E");
      laG.addColorStop(0.42, pal.isDark ? "#19293A" : "#223447");
      laG.addColorStop(0.84, pal.isDark ? "#0C1522" : "#111D2B");
      laG.addColorStop(1, "#070E18");

      // Long cigar hull body spanning [-86 .. +88]
      ctx.fillStyle = laG;
      ctx.beginPath();
      ctx.moveTo(88, 0);
      ctx.bezierCurveTo(88, -12.5, 74, -15.5, 52, -15.5);
      ctx.lineTo(-56, -15.0);
      ctx.lineTo(-85, -3.6);
      ctx.lineTo(-85, 3.6);
      ctx.lineTo(-56, 15.0);
      ctx.lineTo(52, 15.5);
      ctx.bezierCurveTo(74, 15.5, 88, 12.5, 88, 0);
      ctx.closePath();
      ctx.fill();

      // Matte black AN/BQQ-5 bow sonar dome cap
      ctx.fillStyle = "#080D16";
      ctx.beginPath();
      ctx.moveTo(88, 0);
      ctx.bezierCurveTo(88, -11.2, 76, -14.2, 66, -14.8);
      ctx.lineTo(66, 14.8);
      ctx.bezierCurveTo(76, 14.2, 88, 11.2, 88, 0);
      ctx.closePath();
      ctx.fill();

      // Soft ambient water-bounce highlight cresting along top deck
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(-54, -14.8);
      ctx.lineTo(52, -15.2);
      ctx.quadraticCurveTo(76, -14.8, 84, -4.5);
      ctx.stroke();

      // Subtle hull casing deck seam, vertical VLS tube hatches ahead of sail, & floodwater limber holes
      ctx.fillStyle = pal.hullDeep;
      ctx.fillRect(45, -15.4, 15, 2.2);
      ctx.strokeStyle = pal.isDark ? "rgba(148, 224, 248, 0.16)" : "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 0.8;
      [-42, -14, 12, 42].forEach(hx => {
        ctx.beginPath();
        ctx.moveTo(hx, -14.5);
        ctx.lineTo(hx, 14.5);
        ctx.stroke();
      });
      ctx.fillStyle = "#050A12";
      for (let lx = -48; lx <= 32; lx += 10) {
        ctx.fillRect(lx, 7.2, 4.2, 1.4);
      }

      // Tall Forward-Mounted Fairwater Conning Tower Sail (x = +12..+40, y = -15..-38)
      const sailG = ctx.createLinearGradient(0, -38, 0, -14);
      sailG.addColorStop(0, pal.isDark ? "#2B4056" : "#384E64");
      sailG.addColorStop(1, pal.isDark ? "#152333" : "#1D2D3E");
      ctx.fillStyle = sailG;
      ctx.beginPath();
      ctx.moveTo(40, -14.8);
      ctx.quadraticCurveTo(39, -32, 34.5, -38.0);
      ctx.lineTo(14.5, -38.0);
      ctx.lineTo(11.0, -14.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(39.5, -16);
      ctx.quadraticCurveTo(38.5, -32, 34.2, -37.8);
      ctx.lineTo(15.0, -37.8);
      ctx.stroke();

      // Iconic Mid-Sail Horizontal Fairwater Diving Planes!
      ctx.fillStyle = "#0B1523";
      ctx.beginPath();
      ctx.roundRect(19, -27.2, 16, 3.6, 1.4);
      ctx.fill();
      ctx.fillStyle = pal.subHullLight;
      ctx.fillRect(20, -27.0, 14, 1.0);

      // Subtle tactical red bridge cockpit slit & crisp painted naval sail marking
      ctx.fillStyle = "rgba(248, 113, 113, 0.72)";
      ctx.fillRect(30.5, -34.5, 5.2, 1.6);
      ctx.fillStyle = pal.isDark ? "rgba(186, 230, 253, 0.28)" : "rgba(241, 245, 249, 0.42)";
      ctx.fillRect(15.5, -20.0, 14.5, 1.4);
      ctx.fillStyle = pal.hullDeep;
      ctx.fillRect(13.5, -36.0, 3.2, 20.5);

      // Staggered Periscope, Photonics, Radar & Whip Communication Masts atop sail
      ctx.strokeStyle = pal.subHullLight;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(28, -38); ctx.lineTo(28, -48.5);
      ctx.moveTo(23.5, -38); ctx.lineTo(23.5, -45.5);
      ctx.moveTo(19.5, -38); ctx.lineTo(19.5, -43.5);
      ctx.stroke();
      ctx.fillStyle = pal.subHullLight;
      ctx.fillRect(27.2, -49.2, 3.2, 1.6);

      // Cruciform Stern Stabilizers (Upper & Lower Rudders + Towed-Array Pod + Stern Hydroplanes + Skewed Bronze Propeller)
      ctx.fillStyle = pal.isDark ? "#132234" : "#1A2A3B";
      // Upper vertical rudder + bullet towed-array sonar dispenser pod
      ctx.beginPath();
      ctx.moveTo(-62, -10.5);
      ctx.lineTo(-76, -24.0);
      ctx.lineTo(-83.5, -24.0);
      ctx.lineTo(-81.5, -4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#080D16";
      ctx.beginPath();
      ctx.roundRect(-84.5, -25.4, 9.5, 3.2, 1.5);
      ctx.fill();
      // Lower vertical rudder fin
      ctx.fillStyle = pal.isDark ? "#101D2C" : "#152333";
      ctx.beginPath();
      ctx.moveTo(-63, 10.5);
      ctx.lineTo(-75, 22.5);
      ctx.lineTo(-82.5, 22.5);
      ctx.lineTo(-81.5, 4.5);
      ctx.closePath();
      ctx.fill();
      // Horizontal stern hydroplane airfoil
      ctx.fillStyle = "#0B1523";
      ctx.beginPath();
      ctx.roundRect(-82.5, -2.2, 15.5, 4.4, 1.8);
      ctx.fill();

      // 7-Blade Skewed Naval Brass/Bronze Propeller + Cone Hub
      const propSpin = Math.sin(step * 18) * 3.8;
      ctx.fillStyle = "#8C6D46";
      ctx.beginPath();
      ctx.moveTo(-85, -2.6);
      ctx.lineTo(-89.5, 0);
      ctx.lineTo(-85, 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#A8885C";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-87.2, -7.2 + propSpin * 0.45);
      ctx.lineTo(-87.2, 7.2 - propSpin * 0.45);
      ctx.moveTo(-87.2, -3.8 - propSpin * 0.6);
      ctx.lineTo(-87.2, 3.8 + propSpin * 0.6);
      ctx.stroke();
    } else if (style === "manta_glider") {
      // Sleek Winged Hydrofoil Reconnaissance Submersible
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.quadraticCurveTo(22, -10, -28, -9);
      ctx.lineTo(-36, -3);
      ctx.lineTo(-36, 4);
      ctx.lineTo(-26, 9);
      ctx.quadraticCurveTo(22, 9, 42, 0);
      ctx.closePath();
      ctx.fill();

      // Swept lateral hydroplane wings
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.moveTo(8, 2);
      ctx.lineTo(-14, 14);
      ctx.lineTo(-22, 13);
      ctx.lineTo(-10, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-26, -8.5);
      ctx.quadraticCurveTo(18, -9.5, 36, -2);
      ctx.stroke();

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-18, -1.5, 42, 2.2);
      // Forward bubble cockpit canopy
      ctx.fillStyle = pal.glassHighlight;
      ctx.beginPath();
      ctx.arc(24, -3.5, 6.2, Math.PI * 0.9, Math.PI * 2.05);
      ctx.fill();
    } else if (style === "industrial_tug") {
      // Compact Boxy Heavy-Duty Utility / Salvage Sub with Front Articulated Claws
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-30, -13, 56, 26);
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.roundRect(-28, -14, 54, 24, 5);
      ctx.fill();

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-26, -16, 48, 3.2);
      ctx.fillStyle = pal.waterBounce;
      ctx.fillRect(-24, -14, 46, 1.2);

      // Large armored bow viewport
      this._drawWindowBand(ctx, 10, -9, 14, 8, 2, pal, 1);
      // Articulated manipulator claws extending from bow
      ctx.strokeStyle = pal.subHullLight;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(26, 4);
      ctx.lineTo(38, 8);
      ctx.lineTo(44, 5);
      ctx.moveTo(26, 7);
      ctx.lineTo(37, 12);
      ctx.lineTo(43, 12);
      ctx.stroke();

      // Ducted twin stern pump-jets
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-35, -10, 7, 20);
    } else if (style === "deep_explorer") {
      // Multi-Tier Abyssal Explorer Cruiser (forward bow observatory + tall hydrophone sail)
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(60, 1);
      ctx.quadraticCurveTo(48, -15, 16, -15.5);
      ctx.lineTo(-50, -14);
      ctx.lineTo(-58, -8);
      ctx.lineTo(-58, 10);
      ctx.lineTo(-50, 15.5);
      ctx.lineTo(28, 15.5);
      ctx.quadraticCurveTo(50, 14, 60, 1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-48, -14);
      ctx.lineTo(16, -15.5);
      ctx.quadraticCurveTo(44, -15, 56, -3);
      ctx.stroke();

      // Tall trapezoidal conning sail & hydrophone mast
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(22, -15.5);
      ctx.lineTo(12, -28);
      ctx.lineTo(-8, -28);
      ctx.lineTo(-14, -14.5);
      ctx.closePath();
      ctx.fill();
      this._drawWindowBand(ctx, -2, -25, 14, 4.0, 2, pal, 1);
      this._drawWindowBand(ctx, -36, -6, 68, 3.8, 5, pal, 1);

      // Bow panoramic dome
      ctx.fillStyle = pal.windowMid;
      ctx.beginPath();
      ctx.arc(54, 1, 7, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
    } else if (style === "bathyscaphe") {
      ctx.strokeStyle = pal.subHullDark;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(-16, 12);
      ctx.lineTo(18, 12);
      ctx.moveTo(-10, 8);
      ctx.lineTo(-12, 12);
      ctx.moveTo(8, 8);
      ctx.lineTo(11, 12);
      ctx.stroke();

      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 26, 12.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 25, 12, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-10, -15.5, 14, 3.8);

      const domeG = ctx.createRadialGradient(21, -2, 1, 19, 0, 9);
      domeG.addColorStop(0, pal.glassHighlight);
      domeG.addColorStop(0.45, pal.windowMid);
      domeG.addColorStop(1, pal.windowBot);
      ctx.fillStyle = domeG;
      ctx.beginPath();
      ctx.arc(19, 0, 8.2, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
      ctx.strokeStyle = pal.subHullLight;
      ctx.lineWidth = 1.3;
      ctx.stroke();

      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-31, -6, 6, 12);
      ctx.beginPath();
      ctx.moveTo(-22, -10);
      ctx.lineTo(-29, -15);
      ctx.lineTo(-29, -7);
      ctx.closePath();
      ctx.fill();
    } else if (style === "research_catamaran") {
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.roundRect(-48, 5, 92, 9.5, 4.8);
      ctx.fill();

      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(52, 1);
      ctx.quadraticCurveTo(42, -12.5, 12, -12.5);
      ctx.lineTo(-44, -11.5);
      ctx.lineTo(-48, 5);
      ctx.lineTo(44, 5);
      ctx.quadraticCurveTo(50, 4, 52, 1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-42, -11.5);
      ctx.lineTo(12, -12.5);
      ctx.quadraticCurveTo(38, -12, 48, -3);
      ctx.stroke();

      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(30, -12.5);
      ctx.lineTo(18, -20.5);
      ctx.lineTo(-12, -20.5);
      ctx.lineTo(-18, -11.5);
      ctx.closePath();
      ctx.fill();
      this._drawWindowBand(ctx, 4, -18.8, 17, 4.0, 2, pal, 1);

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-36, -3, 76, 2.5);
      this._drawWindowBand(ctx, -28, -9, 52, 3.4, 4, pal, 1);

      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-54, -9, 8, 18);
      ctx.fillRect(14, 1, 11, 2.6);
    } else if (style === "heavy_freighter") {
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.roundRect(-64, -16.5, 128, 33, 6.5);
      ctx.fill();

      ctx.fillStyle = pal.waterBounce;
      ctx.fillRect(-58, -16.5, 116, 1.4);

      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.arc(62, 0, 9.5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

      ctx.fillStyle = pal.subHullDark;
      [-42, -12, 18, 44].forEach(rx => {
        ctx.fillRect(rx, -17.5, 4.2, 35);
      });

      const containers = [
        { x: -38, w: 22, color: pal.subContainers[0] },
        { x: -10, w: 24, color: pal.subContainers[1] },
        { x: 20, w: 20, color: pal.subContainers[2] }
      ];
      containers.forEach(c => {
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, -25.5, c.w, 9.5);
        ctx.fillStyle = pal.waterBounce;
        ctx.fillRect(c.x, -25.5, c.w, 1.1);
        ctx.strokeStyle = pal.subHullDark;
        ctx.lineWidth = 0.9;
        ctx.strokeRect(c.x, -25.5, c.w, 9.5);
      });

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-56, -16.5, 4.8, 33);
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-68, -14.5, 12, 29);

      this._drawWindowBand(ctx, -46, -3.5, 86, 3.5, 6, pal, 1);

      if (thrusterGlow > 0.1) {
        const tg = ctx.createRadialGradient(-70, 0, 2, -74, 0, 20);
        tg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${(thrusterGlow * 0.65).toFixed(3)})`);
        tg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(-72, 0, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(58, 2);
      ctx.quadraticCurveTo(46, -13.5, 16, -14.5);
      ctx.lineTo(-48, -13.5);
      ctx.lineTo(-56, -8.5);
      ctx.lineTo(-56, 10.5);
      ctx.lineTo(-48, 14.5);
      ctx.lineTo(24, 14.5);
      ctx.quadraticCurveTo(48, 13.5, 58, 2);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-46, -13.5);
      ctx.lineTo(16, -14.5);
      ctx.quadraticCurveTo(42, -13.5, 53, -3);
      ctx.stroke();

      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(36, -13);
      ctx.lineTo(24, -21.5);
      ctx.lineTo(-8, -21.5);
      ctx.lineTo(-14, -13);
      ctx.closePath();
      ctx.fill();
      this._drawWindowBand(ctx, 10, -19.5, 16, 4.2, 2, pal, 1);

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-42, 2, 86, 2.4);
      this._drawWindowBand(ctx, -30, -6.2, 62, 3.5, 5, pal, 1);

      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(10, 4, 12, 2.6);
      ctx.beginPath();
      ctx.arc(54, 2, 5.6, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
    }

    const navBlink = 0.55 + 0.45 * Math.sin(step * 4.2);
    const navY = style === "los_angeles_ssn" ? -49.5
      : (style === "bathyscaphe" ? -16.5
      : (style === "deep_explorer" ? -29
      : (style === "military_stealth" ? -36
      : (style === "heavy_freighter" ? -26.5
      : (style === "experimental_research" ? -24.5 : -22.5)))));
    ctx.fillStyle = (style === "military_stealth" || style === "los_angeles_ssn")
      ? `rgba(248, 113, 113, ${(0.70 * navBlink).toFixed(3)})`
      : `rgba(56, 224, 180, ${(0.55 * navBlink).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(style === "los_angeles_ssn" ? 28 : (style === "heavy_freighter" ? 30 : (style === "military_stealth" ? 4 : (style === "experimental_research" ? -44 : 4))), navY, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (style !== "heavy_freighter" && thrusterGlow > 0.25) {
      const sTail = style === "los_angeles_ssn" ? -90
        : (style === "bathyscaphe" ? -33
        : (style === "experimental_research" ? -48
        : (style === "military_stealth" ? -64 : -58)));
      const wakeAlpha = style === "los_angeles_ssn" ? thrusterGlow * 0.22 : thrusterGlow * 0.45;
      const sg = ctx.createRadialGradient(sTail, 0, 1, sTail - 4, 0, 13);
      sg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${wakeAlpha.toFixed(3)})`);
      sg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sTail - 4, 0, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _renderBuoyantSub(ctx, sub, s, scaleMult, pal, step, thrusterGlow, showBeam, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sub.x, sub.y);
    if (sub.facingLeft) {
      ctx.scale(-1, 1);
    }
    ctx.rotate(sub.pitch);
    ctx.scale(s * scaleMult, s * scaleMult);
    this._drawSubmarineModel(ctx, sub.style, pal, step, thrusterGlow, showBeam);
    ctx.restore();
  },

  _updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step) {
    const sub = this.sub;
    sub.t += dt;
    const s = L.s;

    const armAng = L.leftAngle;
    const scaleMult = sub.style === "los_angeles_ssn" ? 1.12
      : (sub.style === "bathyscaphe" ? 0.84 : (sub.style === "manta_glider" ? 0.90 : 0.96));
    const dockOff = this._getSubDockOffset(sub.style) * s * scaleMult;
    const dockedPt = { x: L.leftDockX - dockOff, y: L.leftDockY };
    const holdPt = { x: L.leftDockX - Math.max(134 * s, dockOff + 48 * s), y: L.leftDockY };
    const dockPitch = 0;

    let visible = true;
    let targetPitch = sub.pitch;
    let targetFacingLeft = sub.facingLeft;

    if (sub.phase === "approaching") {
      if (!sub.path) {
        sub.path = this._buildSubPath(
          { x: sub.entryX, y: sub.entryY },
          holdPt,
          { x: (sub.entryX + holdPt.x) * 0.45, y: sub.entryY },
          { x: holdPt.x - 85 * s, y: holdPt.y + 12 * s }
        );
      }
      const rem = Math.max(0, sub.path.totalLen - sub.dist);
      const targetSpd = rem < 110 * s ? this._lerp(5.2, sub.cruiseSpeed, rem / (110 * s)) : sub.cruiseSpeed;
      sub.speed = this._lerp(sub.speed, targetSpd, Math.min(1, dt * 2.2));
      sub.dist += sub.speed * dt;

      const pt = this._sampleArcPath(sub.path, sub.dist);
      sub.x = pt.x;
      sub.y = pt.y;
      const bt = this._computeBuoyantTransform(pt.dx, pt.dy, sub.facingLeft);
      targetFacingLeft = bt.facingLeft;
      targetPitch = bt.targetPitch;
      sub.heading = pt.angle;

      if (sub.dist >= sub.path.totalLen) {
        sub.phase = "docking";
        sub.t = 0;
        sub.dist = 0;
        sub.path = this._buildArcPath([{ type: "line", p0: holdPt, p1: dockedPt }], 10);
      }
    } else if (sub.phase === "docking") {
      const rem = Math.max(0, sub.path.totalLen - sub.dist);
      const targetSpd = Math.max(2.6, Math.min(8.5, rem * 0.18));
      sub.speed = this._lerp(sub.speed, targetSpd, Math.min(1, dt * 2.5));
      sub.dist += sub.speed * dt;

      const pt = this._sampleArcPath(sub.path, sub.dist);
      sub.x = pt.x;
      sub.y = pt.y;
      targetFacingLeft = false;
      targetPitch = dockPitch;
      sub.heading = armAng - Math.PI;

      if (sub.dist >= sub.path.totalLen) {
        sub.phase = "docked";
        sub.t = 0;
        sub.speed = 0;
        sub.phaseDuration = this._rand(30.0, 55.0);
        for (let b = 0; b < 6; b++) {
          this.bubbles.push({
            x: L.leftDockX - 15 * s + (Math.random() - 0.5) * 6 * s,
            y: L.leftDockY + (Math.random() - 0.5) * 14 * s,
            r: 1.0 + Math.random() * 1.4,
            vy: -(0.45 + Math.random() * 0.35),
            wobble: Math.random() * 6,
            alpha: 0.42
          });
        }
      }
    } else if (sub.phase === "docked") {
      sub.x = dockedPt.x;
      sub.y = dockedPt.y + Math.sin(step * 1.8) * 0.55;
      targetFacingLeft = false;
      targetPitch = dockPitch;
      sub.speed = 0;
      if (Math.random() < 0.035) {
        this.bubbles.push({
          x: L.leftDockX - 8 * s + (Math.random() - 0.5) * 14 * s,
          y: L.leftDockY - 6 * s,
          r: 0.9 + Math.random() * 1.2,
          vy: -(0.35 + Math.random() * 0.25),
          wobble: Math.random() * 6,
          alpha: 0.30
        });
      }

      if (sub.t >= sub.phaseDuration) {
        this._assignCorridorEndpoints(sub, "left", w, h, L);
        sub.phase = "undocking";
        sub.t = 0;
        sub.dist = 0;
        sub.speed = 0;
        sub.path = this._buildArcPath([{ type: "line", p0: dockedPt, p1: holdPt }], 10);
      }
    } else if (sub.phase === "undocking") {
      const targetSpd = 7.5;
      sub.speed = this._lerp(sub.speed, targetSpd, Math.min(1, dt * 1.8));
      sub.dist += sub.speed * dt;

      const pt = this._sampleArcPath(sub.path, sub.dist);
      sub.x = pt.x;
      sub.y = pt.y;
      targetFacingLeft = false;
      targetPitch = dockPitch * (1 - Math.min(1, sub.dist / Math.max(1, sub.path.totalLen)));

      if (sub.dist >= sub.path.totalLen) {
        sub.phase = "departing";
        sub.t = 0;
        sub.dist = 0;
        sub.path = this._buildSubPath(
          holdPt,
          { x: sub.entryX, y: sub.entryY },
          { x: holdPt.x - 65 * s, y: holdPt.y + 18 * s },
          { x: (holdPt.x + sub.entryX) * 0.45, y: sub.entryY }
        );
      }
    } else if (sub.phase === "departing") {
      sub.speed = this._lerp(sub.speed, sub.cruiseSpeed, Math.min(1, dt * 1.6));
      sub.dist += sub.speed * dt;

      const pt = this._sampleArcPath(sub.path, sub.dist);
      sub.x = pt.x;
      sub.y = pt.y;
      const bt = this._computeBuoyantTransform(pt.dx, pt.dy, sub.facingLeft);
      targetFacingLeft = bt.facingLeft;
      targetPitch = bt.targetPitch;
      sub.heading = pt.angle;

      if (sub.dist >= sub.path.totalLen) {
        sub.phase = "patrol_wait";
        sub.t = 0;
        sub.speed = 0;
        sub.phaseDuration = this._rand(8.0, 18.0);
        const oppositeStyle = this.cargoSub ? this.cargoSub.style : "";
        const pool = this.DOCKING_SUB_STYLES.filter(st => st !== oppositeStyle);
        sub.style = this._pick(pool.length > 0 ? pool : this.DOCKING_SUB_STYLES);
        sub.cruiseSpeed = sub.style === "los_angeles_ssn" ? 13.0 : (sub.style === "heavy_freighter" ? 14.0 : 17.5);
      }
    } else {
      visible = false;
      if (sub.t >= sub.phaseDuration) {
        if (this._canActivate("subs", L.isNarrow)) {
          this._assignCorridorEndpoints(sub, "left", w, h, L);
          sub.path = this._buildSubPath(
            { x: sub.entryX, y: sub.entryY },
            holdPt,
            { x: (sub.entryX + holdPt.x) * 0.45, y: sub.entryY },
            { x: holdPt.x - 85 * s, y: holdPt.y + 12 * s }
          );
          sub.dist = 0;
          sub.speed = sub.cruiseSpeed;
          sub.facingLeft = false;
          sub.pitch = 0;
          sub.phase = "approaching";
          sub.t = 0;
        } else {
          sub.phaseDuration += this._rand(3.0, 7.0);
        }
      }
    }

    sub.facingLeft = targetFacingLeft;
    const subPitchSpeed = (sub.phase === "docked" || sub.phase === "docking") ? 6.0 : 2.8;
    sub.pitch = this._lerp(sub.pitch, targetPitch, Math.min(1, dt * subPitchSpeed));
    if (!visible) return;

    const thrusterGlow = this._clamp(sub.speed / Math.max(1, sub.cruiseSpeed), 0, 1) * 0.72;
    if (sub.speed > 3.5 && Math.random() < Math.min(0.32, sub.speed * 0.016)) {
      const sternDir = sub.facingLeft ? 1 : -1;
      const tailLen = sub.style === "los_angeles_ssn" ? 84 : 44;
      this.bubbles.push({
        x: sub.x + sternDir * tailLen * s * scaleMult,
        y: sub.y - Math.sin(sub.pitch) * 32 * s + (Math.random() - 0.5) * 6,
        r: 1.0 + Math.random() * 1.6,
        vy: -(0.32 + Math.random() * 0.38),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.30 + Math.random() * 0.22
      });
    }

    const inDockCollar = sub.phase === "docking" || sub.phase === "docked" || sub.phase === "undocking";
    if (inDockCollar) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, L.leftDockX + 6 * s, h);
      ctx.clip();
      this._renderBuoyantSub(ctx, sub, s, scaleMult, pal, step, thrusterGlow, sub.phase !== "docked");
      ctx.restore();
      this._drawSubDockingPortFrontLip(ctx, L.leftDockX, L.leftDockY, -1, pal, s, sub.phase === "docked", step);
    } else {
      this._renderBuoyantSub(ctx, sub, s, scaleMult, pal, step, thrusterGlow, true);
    }
  },

  _updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step) {
    const cs = this.cargoSub;
    cs.t += dt;
    const s = L.s;

    const scaleMult = cs.style === "los_angeles_ssn" ? 1.12
      : (cs.style === "heavy_freighter" ? 1.0 : (cs.style === "industrial_tug" ? 0.96 : 0.94));
    const dockOff = this._getSubDockOffset(cs.style) * s * scaleMult;
    const dockedPt = { x: L.rightDockX + dockOff, y: L.rightDockY };
    const holdPt = { x: L.rightDockX + Math.max(138 * s, dockOff + 48 * s), y: L.rightDockY };
    const dockPitch = 0;

    let visible = true;
    let targetPitch = cs.pitch;
    let targetFacingLeft = cs.facingLeft;

    if (cs.phase === "docked") {
      cs.x = dockedPt.x;
      cs.y = dockedPt.y + Math.sin(step * 1.6 + 1) * 0.5;
      targetFacingLeft = true;
      targetPitch = dockPitch;
      cs.speed = 0;
      if (Math.random() < 0.035) {
        this.bubbles.push({
          x: L.rightDockX + 8 * s + (Math.random() - 0.5) * 14 * s,
          y: L.rightDockY - 6 * s,
          r: 0.9 + Math.random() * 1.2,
          vy: -(0.35 + Math.random() * 0.25),
          wobble: Math.random() * 6,
          alpha: 0.30
        });
      }

      if (cs.t >= cs.phaseDuration) {
        this._assignCorridorEndpoints(cs, "right", w, h, L);
        cs.phase = "undocking";
        cs.t = 0;
        cs.dist = 0;
        cs.speed = 0;
        cs.path = this._buildArcPath([{ type: "line", p0: dockedPt, p1: holdPt }], 10);
      }
    } else if (cs.phase === "undocking") {
      const targetSpd = 6.2;
      cs.speed = this._lerp(cs.speed, targetSpd, Math.min(1, dt * 1.5));
      cs.dist += cs.speed * dt;

      const pt = this._sampleArcPath(cs.path, cs.dist);
      cs.x = pt.x;
      cs.y = pt.y;
      targetFacingLeft = true;
      targetPitch = dockPitch * (1 - Math.min(1, cs.dist / Math.max(1, cs.path.totalLen)));

      if (cs.dist >= cs.path.totalLen) {
        cs.phase = "departing";
        cs.t = 0;
        cs.dist = 0;
        cs.path = this._buildSubPath(
          holdPt,
          { x: cs.exitX, y: cs.exitY },
          { x: holdPt.x + 70 * s, y: holdPt.y + 18 * s },
          { x: (holdPt.x + cs.exitX) * 0.5, y: cs.exitY }
        );
      }
    } else if (cs.phase === "departing") {
      cs.speed = this._lerp(cs.speed, cs.cruiseSpeed, Math.min(1, dt * 1.3));
      cs.dist += cs.speed * dt;

      const pt = this._sampleArcPath(cs.path, cs.dist);
      cs.x = pt.x;
      cs.y = pt.y;
      const bt = this._computeBuoyantTransform(pt.dx, pt.dy, cs.facingLeft);
      targetFacingLeft = bt.facingLeft;
      targetPitch = bt.targetPitch;
      cs.heading = pt.angle;

      if (cs.dist >= cs.path.totalLen) {
        cs.phase = "patrol_wait";
        cs.t = 0;
        cs.speed = 0;
        cs.phaseDuration = this._rand(9.0, 19.0);
        const oppositeStyle = this.sub ? this.sub.style : "";
        const pool = this.DOCKING_SUB_STYLES.filter(st => st !== oppositeStyle);
        cs.style = this._pick(pool.length > 0 ? pool : this.DOCKING_SUB_STYLES);
        cs.cruiseSpeed = cs.style === "los_angeles_ssn" ? 12.8 : (cs.style === "heavy_freighter" ? 13.5 : 16.5);
      }
    } else if (cs.phase === "patrol_wait") {
      visible = false;
      if (cs.t >= cs.phaseDuration) {
        if (this._canActivate("subs", L.isNarrow)) {
          this._assignCorridorEndpoints(cs, "right", w, h, L);
          cs.path = this._buildSubPath(
            { x: cs.exitX, y: cs.exitY },
            holdPt,
            { x: (cs.exitX + holdPt.x) * 0.5, y: cs.exitY },
            { x: holdPt.x + 85 * s, y: holdPt.y + 14 * s }
          );
          cs.dist = 0;
          cs.speed = cs.cruiseSpeed;
          cs.facingLeft = true;
          cs.pitch = 0;
          cs.phase = "approaching";
          cs.t = 0;
        } else {
          cs.phaseDuration += this._rand(3.0, 7.0);
        }
      }
    } else if (cs.phase === "approaching") {
      const rem = Math.max(0, cs.path.totalLen - cs.dist);
      const targetSpd = rem < 115 * s ? this._lerp(4.6, cs.cruiseSpeed, rem / (115 * s)) : cs.cruiseSpeed;
      cs.speed = this._lerp(cs.speed, targetSpd, Math.min(1, dt * 1.8));
      cs.dist += cs.speed * dt;

      const pt = this._sampleArcPath(cs.path, cs.dist);
      cs.x = pt.x;
      cs.y = pt.y;
      const bt = this._computeBuoyantTransform(pt.dx, pt.dy, cs.facingLeft);
      targetFacingLeft = bt.facingLeft;
      targetPitch = bt.targetPitch;
      cs.heading = pt.angle;

      if (cs.dist >= cs.path.totalLen) {
        cs.phase = "docking";
        cs.t = 0;
        cs.dist = 0;
        cs.path = this._buildArcPath([{ type: "line", p0: holdPt, p1: dockedPt }], 10);
      }
    } else {
      const rem = Math.max(0, cs.path.totalLen - cs.dist);
      const targetSpd = Math.max(2.4, Math.min(7.5, rem * 0.16));
      cs.speed = this._lerp(cs.speed, targetSpd, Math.min(1, dt * 2.2));
      cs.dist += cs.speed * dt;

      const pt = this._sampleArcPath(cs.path, cs.dist);
      cs.x = pt.x;
      cs.y = pt.y;
      targetFacingLeft = true;
      targetPitch = dockPitch;

      if (cs.dist >= cs.path.totalLen) {
        cs.phase = "docked";
        cs.t = 0;
        cs.speed = 0;
        cs.phaseDuration = this._rand(30.0, 55.0);
        for (let b = 0; b < 6; b++) {
          this.bubbles.push({
            x: L.rightDockX + 15 * s + (Math.random() - 0.5) * 6 * s,
            y: L.rightDockY + (Math.random() - 0.5) * 14 * s,
            r: 1.0 + Math.random() * 1.4,
            vy: -(0.45 + Math.random() * 0.35),
            wobble: Math.random() * 6,
            alpha: 0.42
          });
        }
      }
    }

    cs.facingLeft = targetFacingLeft;
    const csPitchSpeed = (cs.phase === "docked" || cs.phase === "docking") ? 6.0 : 2.4;
    cs.pitch = this._lerp(cs.pitch, targetPitch, Math.min(1, dt * csPitchSpeed));
    if (!visible) return;

    const thrusterGlow = cs.phase === "docked" ? 0.12 : this._clamp(cs.speed / Math.max(1, cs.cruiseSpeed), 0.1, 1) * 0.80;
    if (cs.speed > 3.0 && Math.random() < Math.min(0.34, cs.speed * 0.018)) {
      const sternDir = cs.facingLeft ? 1 : -1;
      const tailLen = cs.style === "los_angeles_ssn" ? 84 : 58;
      this.bubbles.push({
        x: cs.x + sternDir * tailLen * s * scaleMult,
        y: cs.y - Math.sin(cs.pitch) * 34 * s + (Math.random() - 0.5) * 9,
        r: 1.2 + Math.random() * 1.9,
        vy: -(0.32 + Math.random() * 0.42),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.32 + Math.random() * 0.22
      });
    }

    const csInDockCollar = cs.phase === "docking" || cs.phase === "docked" || cs.phase === "undocking";
    if (csInDockCollar) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.rightDockX - 6 * s, 0, Math.max(10, w - (L.rightDockX - 6 * s)), h);
      ctx.clip();
      this._renderBuoyantSub(ctx, cs, s, scaleMult, pal, step, thrusterGlow, cs.phase !== "docked");
      ctx.restore();
      this._drawSubDockingPortFrontLip(ctx, L.rightDockX, L.rightDockY, 1, pal, s, cs.phase === "docked", step);
    } else {
      this._renderBuoyantSub(ctx, cs, s, scaleMult, pal, step, thrusterGlow, true);
    }
  },

  _updateAndDrawExtraSubs(ctx, w, h, L, pal, dt, step) {
    const s = L.s;
    for (let i = 0; i < this.roamingSubs.length; i++) {
      const rs = this.roamingSubs[i];
      rs.t += dt;

      if (rs.role === "visitor") {
        let vis = true;
        let targetPitch = rs.pitch;
        let targetFacingLeft = rs.facingLeft;

        if (rs.phase === "patrol_in") {
          const rem = Math.max(0, rs.path.totalLen - rs.dist);
          const targetSpd = rem < 90 * s ? this._lerp(3.5, rs.cruiseSpeed, rem / (90 * s)) : rs.cruiseSpeed;
          rs.speed = this._lerp(rs.speed, targetSpd, Math.min(1, dt * 2.2));
          rs.dist += rs.speed * dt;

          const pt = this._sampleArcPath(rs.path, rs.dist);
          rs.x = pt.x;
          rs.y = pt.y;
          const bt = this._computeBuoyantTransform(pt.dx, pt.dy, rs.facingLeft);
          targetFacingLeft = bt.facingLeft;
          targetPitch = bt.targetPitch;

          if (rs.dist >= rs.path.totalLen) {
            rs.phase = "hover_scan";
            rs.t = 0;
            rs.speed = 0;
            rs.phaseDuration = this._rand(6.0, 11.5);
          }
        } else if (rs.phase === "hover_scan") {
          rs.x = rs.hoverPt.x + Math.sin(step * 0.9) * 3.5 * s;
          rs.y = rs.hoverPt.y + Math.cos(step * 1.2) * 2.4 * s;
          targetPitch = Math.sin(step * 0.7) * 0.04;

          if (rs.t >= rs.phaseDuration) {
            const goLeft = Math.random() < 0.5;
            rs.exitPt = {
              x: goLeft ? -115 : w + 115,
              y: h * this._rand(0.20, 0.44)
            };
            rs.path = this._buildSubPath(
              rs.hoverPt,
              rs.exitPt,
              { x: rs.hoverPt.x + (goLeft ? -70 : 70) * s, y: rs.hoverPt.y - 16 * s },
              { x: (rs.hoverPt.x + rs.exitPt.x) * 0.5, y: rs.exitPt.y }
            );
            rs.dist = 0;
            rs.speed = 3.0;
            rs.phase = "patrol_out";
            rs.t = 0;
          }
        } else if (rs.phase === "patrol_out") {
          rs.speed = this._lerp(rs.speed, rs.cruiseSpeed, Math.min(1, dt * 1.6));
          rs.dist += rs.speed * dt;

          const pt = this._sampleArcPath(rs.path, rs.dist);
          rs.x = pt.x;
          rs.y = pt.y;
          const bt = this._computeBuoyantTransform(pt.dx, pt.dy, rs.facingLeft);
          targetFacingLeft = bt.facingLeft;
          targetPitch = bt.targetPitch;

          if (rs.dist >= rs.path.totalLen) {
            rs.phase = "away_wait";
            rs.t = 0;
            rs.speed = 0;
            rs.phaseDuration = this._rand(12.0, 24.0);
          }
        } else {
          vis = false;
          if (rs.t >= rs.phaseDuration) {
            if (this._canActivate("subs", L.isNarrow)) {
              const fromLeft = Math.random() < 0.5;
              rs.fromPt = fromLeft
                ? { x: -105, y: h * this._rand(0.20, 0.42) }
                : { x: w + 105, y: h * this._rand(0.20, 0.42) };
              rs.hoverPt = {
                x: fromLeft ? L.westWingX + 18 * s : L.eastWingX - 18 * s,
                y: L.hubY - this._rand(38, 62) * s
              };
              rs.style = this._pick(["bathyscaphe", "crew_shuttle", "manta_glider", "industrial_tug", "experimental_research"]);
              rs.cruiseSpeed = rs.style === "bathyscaphe" ? 15.0 : 17.0;
              rs.path = this._buildSubPath(
                rs.fromPt,
                rs.hoverPt,
                { x: (rs.fromPt.x + rs.hoverPt.x) * 0.5, y: rs.fromPt.y + 10 },
                { x: rs.hoverPt.x + (fromLeft ? -75 : 75) * s, y: rs.hoverPt.y - 6 }
              );
              rs.dist = 0;
              rs.speed = rs.cruiseSpeed;
              rs.facingLeft = !fromLeft;
              rs.pitch = 0;
              rs.phase = "patrol_in";
              rs.t = 0;
            } else {
              rs.phaseDuration += this._rand(4.0, 8.0);
            }
          }
        }

        rs.facingLeft = targetFacingLeft;
        rs.pitch = this._lerp(rs.pitch, targetPitch, Math.min(1, dt * 2.5));
        if (vis) {
          const sc = rs.style === "bathyscaphe" ? 0.76 : 0.62;
          const tg = rs.phase === "hover_scan" ? 0.20 : 0.52;
          this._renderBuoyantSub(ctx, rs, s, sc, pal, step, tg, true, 0.94);
        }
      } else {
        if (rs.phase === "cruising") {
          const dx = rs.endPt.x - rs.startPt.x;
          const dy = rs.endPt.y - rs.startPt.y;
          const totalDist = Math.hypot(dx, dy) || 1;
          rs.dist += rs.cruiseSpeed * dt;
          const p = Math.min(1, rs.dist / totalDist);
          rs.x = rs.startPt.x + dx * p;
          rs.y = rs.startPt.y + dy * p;
          const bt = this._computeBuoyantTransform(dx, dy, rs.facingLeft);
          rs.facingLeft = bt.facingLeft;
          rs.pitch = bt.targetPitch;

          this._renderBuoyantSub(ctx, rs, s, rs.scale, pal, step, 0.30, false, pal.isDark && !pal.isGoldenCoastal ? 0.40 : 0.52);

          if (p >= 1) {
            rs.phase = "wait";
            rs.t = 0;
            rs.phaseDuration = this._rand(14.0, 26.0);
          }
        } else if (rs.t >= rs.phaseDuration) {
          if (this._canActivate("subs", L.isNarrow)) {
            const goRight = Math.random() < 0.5;
            rs.startPt = { x: goRight ? -130 : w + 130, y: h * this._rand(0.18, 0.40) };
            rs.endPt = { x: goRight ? w + 130 : -130, y: h * this._rand(0.16, 0.38) };
            rs.style = this._pick(this.SUB_STYLES);
            rs.scale = rs.style === "los_angeles_ssn" ? 0.62 : (rs.style === "heavy_freighter" ? 0.44 : 0.54);
            rs.cruiseSpeed = this._rand(12.0, 16.5);
            rs.dist = 0;
            rs.phase = "cruising";
            rs.t = 0;
          } else {
            rs.phaseDuration += this._rand(4.0, 9.0);
          }
        }
      }
    }
  },

  _updateAndDrawROVs(ctx, w, h, L, pal, dt, step) {
    const homeX = L.hubX + 46 * L.s;
    const homeY = L.hubY + 22 * L.s;
    const isNarrow = L.isNarrow;

    for (let i = 0; i < this.rovs.length; i++) {
      const rov = this.rovs[i];
      rov.phaseOsc = (rov.phaseOsc || 0) + dt * 1.9;
      rov.t = (rov.t || 0) + dt;

      if (rov.phase === "docked_wait") {
        rov.x = homeX;
        rov.y = homeY;
        if (rov.t >= (rov.waitDuration || 12.0)) {
          if (this._canActivate("rovs", isNarrow)) {
            rov.phase = rov.isWreckSurvey ? "transit_out" : "patrol";
            rov.t = 0;
            rov.wpIdx = 0;
            rov.visitsLeft = rov.isWreckSurvey ? 2 : 3;
            rov.action = rov.isWreckSurvey ? this._pick(["photo", "sample", "survey"]) : "survey";
            rov.flashTimer = this._rand(0.8, 1.8);
            rov.pauseTimer = this._rand(5.5, 8.5);
          } else {
            rov.waitDuration = (rov.waitDuration || 12.0) + this._rand(4.0, 8.0);
          }
        }
        continue;
      }

      const returningHome = rov.phase === "transit_back";
      const wp = rov.waypoints[rov.wpIdx % rov.waypoints.length];
      const tx = returningHome ? homeX : (wp.x * w);
      const ty = returningHome ? homeY : (wp.y * h);
      const dx = tx - rov.x;
      const dy = ty - rov.y;
      const dist = Math.hypot(dx, dy);

      let inspecting = false;
      let flashPulse = 0;
      if (dist > 6) {
        const speed = (rov.isWreckSurvey ? 23 : 19) * dt;
        rov.x += (dx / dist) * Math.min(dist, speed);
        rov.y += (dy / dist) * Math.min(dist, speed);
        const moveAng = Math.atan2(dy, dx);
        rov.beamAngle = this._lerpAngle(rov.beamAngle, moveAng, Math.min(1, dt * 2.2));
      } else if (returningHome) {
        rov.phase = "docked_wait";
        rov.t = 0;
        rov.waitDuration = this._rand(14.0, 26.0);
        continue;
      } else {
        if (rov.phase === "transit_out") rov.phase = "investigate";
        inspecting = true;
        const sweepTarget = wp.beamAngle + Math.sin(rov.phaseOsc * 0.85) * 0.30;
        rov.beamAngle = this._lerpAngle(rov.beamAngle, sweepTarget, Math.min(1, dt * 2.6));
        rov.pauseTimer -= dt;

        if (rov.isWreckSurvey) {
          if (rov.action === "photo") {
            rov.flashTimer = (rov.flashTimer || 1.2) - dt;
            if (rov.flashTimer <= 0) {
              rov.flashTimer = this._rand(2.0, 2.6);
              rov.flashBurst = 0.22;
            }
            if (rov.flashBurst > 0) {
              rov.flashBurst = Math.max(0, rov.flashBurst - dt);
              flashPulse = rov.flashBurst / 0.22;
            }
          } else if (rov.action === "sample" && Math.random() < 0.08) {
            this.bubbles.push({
              x: rov.x + Math.cos(rov.beamAngle) * 5,
              y: rov.y + 8,
              r: 1.4 + Math.random() * 1.8,
              vy: -(0.35 + Math.random() * 0.25),
              wobble: Math.random() * 6,
              alpha: 0.30
            });
          }
        }

        if (rov.pauseTimer <= 0) {
          rov.visitsLeft = (rov.visitsLeft || 1) - 1;
          if (rov.visitsLeft > 0) {
            rov.wpIdx = (rov.wpIdx + 1) % rov.waypoints.length;
            if (rov.isWreckSurvey) {
              const actions = ["photo", "sample", "survey"].filter(a => a !== rov.action);
              rov.action = this._pick(actions);
            }
            rov.pauseTimer = this._rand(5.5, 8.5);
          } else {
            rov.phase = "transit_back";
            rov.t = 0;
          }
        }
      }

      const surveyHoverX = (inspecting && rov.isWreckSurvey && rov.action === "survey")
        ? Math.sin(rov.phaseOsc * 0.6) * 7.0
        : 0;
      const hoverY = rov.y + Math.sin(rov.phaseOsc * 1.3) * 2.2;
      const rovScale = rov.scale || 1.0;
      ctx.save();
      ctx.translate(rov.x + surveyHoverX, hoverY);
      ctx.scale(rovScale, rovScale);

      ctx.save();
      ctx.rotate(rov.beamAngle);
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const isLaserSurvey = inspecting && rov.isWreckSurvey && rov.action === "survey";
      const beamLen = pal.isDark ? (isLaserSurvey ? 180 : 160) : (isLaserSurvey ? 115 : 98);
      const beamSpread = pal.isDark ? 42 : 26;
      const beamColor = isLaserSurvey ? "56, 224, 232" : pal.beamRgb;
      const bg = ctx.createLinearGradient(7, 0, beamLen, 0);
      bg.addColorStop(0, `rgba(${beamColor}, ${(pal.beamAlpha * (isLaserSurvey ? 1.25 : 1.05)).toFixed(3)})`);
      bg.addColorStop(0.52, `rgba(${beamColor}, ${(pal.beamAlpha * 0.36).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${beamColor}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(beamLen, -beamSpread);
      ctx.lineTo(beamLen, beamSpread);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();

      // Fine exterior laser scanlines during shipwreck survey
      if (isLaserSurvey) {
        ctx.strokeStyle = "rgba(103, 232, 249, 0.55)";
        ctx.lineWidth = 0.85;
        for (let sl = -2; sl <= 2; sl++) {
          ctx.beginPath();
          ctx.moveTo(8, sl * 1.1);
          ctx.lineTo(beamLen * 0.88, sl * (beamSpread * 0.34) + Math.sin(step * 4 + sl) * 3);
          ctx.stroke();
        }
      }

      // Camera Strobe Flash Burst & Expanding Ring during shipwreck photography
      if (inspecting && rov.isWreckSurvey && rov.action === "photo" && flashPulse > 0.04) {
        const fg = ctx.createRadialGradient(14, 0, 1, 18, 0, 52 * flashPulse);
        fg.addColorStop(0, `rgba(255, 255, 255, ${(0.95 * flashPulse).toFixed(3)})`);
        fg.addColorStop(0.35, `rgba(165, 243, 252, ${(0.55 * flashPulse).toFixed(3)})`);
        fg.addColorStop(1, "rgba(165, 243, 252, 0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(18, 0, 52 * flashPulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Articulated Manipulator Sampling Claw + Specimen Sediment Silt Plume during shipwreck sampling
      if (inspecting && rov.isWreckSurvey && rov.action === "sample") {
        const reach = 7 + Math.sin(step * 2.5) * 2.5;
        ctx.strokeStyle = pal.hullLight;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(2, 5);
        ctx.lineTo(6, 5 + reach);
        ctx.lineTo(10, 4 + reach);
        ctx.moveTo(6, 5 + reach);
        ctx.lineTo(8, 7 + reach);
        ctx.stroke();

        ctx.fillStyle = "rgba(148, 198, 214, 0.32)";
        ctx.beginPath();
        ctx.ellipse(9, 7 + reach, 7.5, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = pal.rovBody;
      ctx.beginPath();
      ctx.roundRect(-8, -5, 16, 7.5, 3);
      ctx.fill();
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-6, 2.5, 12, 3);
      ctx.fillStyle = pal.portholeGlow;
      ctx.beginPath();
      ctx.arc(Math.cos(rov.beamAngle) * 6, Math.sin(rov.beamAngle) * 3, 1.8, 0, Math.PI * 2);
      ctx.fill();

      if (inspecting && Math.sin(step * 9 + i) > 0.3) {
        ctx.fillStyle = rov.action === "sample" ? "#FBBF24" : "#22D3EE";
        ctx.beginPath();
        ctx.arc(0, -6.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _updateAndDrawNearLife(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    const isNarrow = w < 720;

    ctx.save();
    for (let i = 0; i < this.nearLife.length; i++) {
      const f = this.nearLife[i];
      f.phase += 0.08 * scaleDt;
      f.x += f.vx * scaleDt;
      f.y += Math.sin(f.phase * 0.5) * 0.24 * scaleDt;
      if (f.vx > 0 && f.x > w + 30) f.x = -30;
      if (f.vx < 0 && f.x < -30) f.x = w + 30;

      const alpha = (0.35 + f.depth * 0.45) * (pal.isDark && !pal.isGoldenCoastal ? 0.65 : 0.85);
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

    ctx.save();
    for (let i = 0; i < this.jellies.length; i++) {
      const j = this.jellies[i];
      if (!j.active) {
        j.waitTimer = (j.waitTimer || 0) - dt;
        if (j.waitTimer <= 0) {
          if (this._canActivate("jellies", isNarrow)) {
            j.active = true;
            j.y = h + 35;
            j.x = w * (0.12 + Math.random() * 0.76);
          } else {
            j.waitTimer = this._rand(2.0, 5.0);
          }
        }
        continue;
      }

      j.phase += 0.045 * scaleDt;
      const thrust = Math.max(0, Math.sin(j.phase));
      j.y += (j.vy - thrust * 0.16) * scaleDt;
      j.x += Math.sin(j.phase * 0.35 + i) * 0.22 * scaleDt;
      if (j.y < -45) {
        j.active = false;
        j.waitTimer = this._rand(isNarrow ? 12 : 7, isNarrow ? 24 : 18);
        continue;
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

      ctx.fillStyle = `rgba(${pal.jellyRgb}, ${jAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, bellW, bellH, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

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

  // Abyssal Angler Fish Prowling Deeper Canyon Terraces with Bioluminescent Esca Lures (Director-gated)
  _updateAndDrawAnglerFish(ctx, w, h, L, pal, dt, step) {
    const isNarrow = w < 720;
    for (let i = 0; i < this.anglerFish.length; i++) {
      const af = this.anglerFish[i];
      if (!af.active) {
        af.waitTimer = (af.waitTimer || 0) - dt;
        if (af.waitTimer <= 0) {
          if (this._canActivate("anglers", isNarrow)) {
            af.active = true;
            const goRight = Math.random() < 0.5;
            af.vx = (goRight ? 1 : -1) * this._rand(0.20, 0.28);
            af.x = goRight ? -55 : (w + 55);
            af.y = h * this._rand(0.56, 0.84);
          } else {
            af.waitTimer = this._rand(3.0, 6.0);
          }
        }
        continue;
      }

      af.phase += dt * 3.0;
      af.x += af.vx * (dt * 60);
      af.y += Math.sin(af.phase * 0.55) * 0.14 * (dt * 60);
      const minY = L.seabedY - 40;
      const maxY = h - 26;
      if (af.y < minY) af.y = minY;
      if (af.y > maxY) af.y = maxY;
      if ((af.vx > 0 && af.x > w + 55) || (af.vx < 0 && af.x < -55)) {
        af.active = false;
        af.waitTimer = this._rand(isNarrow ? 16 : 10, isNarrow ? 30 : 22);
        continue;
      }

      const facingLeft = af.vx < 0;
      const s = af.size;
      const lurePulse = 0.65 + 0.35 * Math.sin(step * 4.2 + i * 2.1);

      ctx.save();
      ctx.translate(af.x, af.y);
      ctx.globalAlpha = pal.isDark ? 0.92 : 0.80;
      if (facingLeft) ctx.scale(-1, 1);

      // Pulsing bioluminescent esca halo casting light in front of jaws
      const lureX = s * 0.98 + Math.sin(af.phase * 0.8) * s * 0.06;
      const lureY = -s * 0.24 + Math.cos(af.phase * 0.9) * s * 0.05;
      const lg = ctx.createRadialGradient(lureX, lureY, 0, lureX, lureY, s * 1.15);
      lg.addColorStop(0, `rgba(165, 243, 252, ${(0.78 * lurePulse).toFixed(3)})`);
      lg.addColorStop(0.35, `rgba(56, 224, 232, ${(0.36 * lurePulse).toFixed(3)})`);
      lg.addColorStop(1, "rgba(56, 224, 232, 0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lureX, lureY, s * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // Bulbous abyssal body & caudal tail peduncle
      const tailWag = Math.sin(af.phase * 1.6) * s * 0.14;
      ctx.fillStyle = pal.hullDeep;
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.12);
      ctx.lineTo(-s * 0.95, -s * 0.32 + tailWag);
      ctx.lineTo(-s * 0.82, tailWag * 0.5);
      ctx.lineTo(-s * 0.95, s * 0.30 + tailWag);
      ctx.lineTo(-s * 0.45, s * 0.16);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.58, s * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dorsal spiky crest + translucent pectoral fin
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 0.40);
      ctx.lineTo(-s * 0.34, -s * 0.62);
      ctx.lineTo(-s * 0.42, -s * 0.32);
      ctx.closePath();
      ctx.fill();

      // Fierce protruding lower jaw + sharp fang silhouette
      ctx.beginPath();
      ctx.moveTo(s * 0.15, s * 0.22);
      ctx.quadraticCurveTo(s * 0.66, s * 0.28, s * 0.64, -s * 0.04);
      ctx.lineTo(s * 0.42, s * 0.08);
      ctx.lineTo(s * 0.14, s * 0.05);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(226, 244, 255, 0.72)";
      for (let ti = 0; ti < 3; ti++) {
        const tx = s * (0.28 + ti * 0.12);
        ctx.beginPath();
        ctx.moveTo(tx, s * 0.08);
        ctx.lineTo(tx + s * 0.03, -s * 0.06);
        ctx.lineTo(tx + s * 0.07, s * 0.07);
        ctx.closePath();
        ctx.fill();
      }

      // Small milky abyssal eye
      ctx.fillStyle = "rgba(186, 236, 252, 0.58)";
      ctx.beginPath();
      ctx.arc(s * 0.28, -s * 0.14, s * 0.07, 0, Math.PI * 2);
      ctx.fill();

      // Arched Illicium Spine & Glowing Esca Bulb
      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = Math.max(1.0, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(s * 0.24, -s * 0.34);
      ctx.quadraticCurveTo(s * 0.66, -s * 0.78, lureX, lureY);
      ctx.stroke();

      ctx.fillStyle = `rgba(224, 254, 255, ${(0.88 + 0.12 * lurePulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(lureX, lureY, s * 0.10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  // Task-Complete-Only Colossal Serpentine Sea Leviathan with True 3D Cylindrical Roll & Zero-Clip Stunts (100% Solid Opaque Depth Styling)
  _drawLeviathanBody(ctx, cfg, pal, step) {
    const bodyLen = cfg.bodyLen;
    const segs = 26;
    const maxRad = bodyLen > 600 ? 34 : 23;
    const jawOpen = cfg.jawOpen || 0;
    const baseRoll = cfg.rollAngle || 0;
    const rollWave = Boolean(cfg.rollWave);
    const dScale = cfg.depthScale || 1.0;
    const pitch = cfg.pitch || 0;
    const depthFog = cfg.depthFog || 0;
    const biolumBoost = cfg.biolumBoost || 0;

    const blendHex = (c1, c2, amt) => {
      if (!amt || amt <= 0.005 || typeof c1 !== "string" || typeof c2 !== "string" || !c1.startsWith("#") || !c2.startsWith("#")) return c1;
      const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const a = p(c1), b = p(c2);
      if (a.some(isNaN) || b.some(isNaN)) return c1;
      const mix = (x, y) => Math.round(x + (y - x) * amt).toString(16).padStart(2, "0");
      return `#${mix(a[0], b[0])}${mix(a[1], b[1])}${mix(a[2], b[2])}`;
    };

    const ventralCol = blendHex(cfg.isPartner ? pal.subHullMid : pal.seabedLight, pal.waterMid, depthFog);
    const dorsalCol = blendHex(cfg.isPartner ? pal.reefFar : pal.reefMid, pal.waterMid, depthFog);
    const finCol = blendHex(cfg.isPartner ? pal.reefMid : pal.reefNear, pal.waterMid, depthFog);
    // Smooth continuous rim interpolation instead of hard depthFog threshold step
    const rimCol = blendHex(pal.waterBounce, pal.waterMid, Math.min(1, depthFog * 2.6));

    const wrap2Pi = a => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const nearBandEdge = a => {
      const w = wrap2Pi(a);
      if (Math.sin(w) >= 0) return -Math.cos(w);
      return Math.cos(w) >= 0 ? -1 : 1;
    };

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(cfg.x, cfg.y);
    if (cfg.dir < 0) ctx.scale(-1, 1);
    if (dScale !== 1.0) ctx.scale(dScale, dScale);
    if (pitch) ctx.rotate(pitch);
    ctx.translate(-cfg.x, -cfg.y);

    const topPts = [];
    const midPts = [];
    const botPts = [];
    const dorsalTopPts = [];
    const dorsalBotPts = [];
    const spinePts = [];
    const segCos = [];
    const segSin = [];
    const segRolls = [];
    const segRads = [];

    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const segRoll = rollWave ? (baseRoll - f * 1.15) : baseRoll;
      const cr = Math.cos(segRoll);
      const sr = Math.sin(segRoll);
      segCos.push(cr);
      segSin.push(sr);
      segRolls.push(segRoll);
      const px = cfg.x - f * bodyLen;
      const py = cfg.y + Math.sin(cfg.swimPhase - f * 5.4) * (16 + f * 30);
      let radius;
      if (f < 0.12) radius = maxRad * (0.52 + (f / 0.12) * 0.48);
      else radius = maxRad * Math.pow(1 - (f - 0.12) / 0.88, 0.78) * (1 + 0.15 * Math.sin(f * Math.PI * 3.5));

      // True 3D opaque cylinder preserves full body cross-sectional thickness at EVERY roll angle (no 90° pinch!)
      const volR = radius * (1 + 0.08 * Math.abs(sr));
      segRads.push(volR);
      topPts.push({ x: px, y: py - volR });
      midPts.push({ x: px, y: py });
      botPts.push({ x: px, y: py + volR });

      // Projected cylindrical seam angles for dark dorsal carapace band [-1.68 .. +1.68] rad
      const yE0 = nearBandEdge(segRoll - 1.68);
      const yE1 = nearBandEdge(segRoll + 1.68);
      dorsalTopPts.push({ x: px, y: py + volR * Math.min(yE0, yE1) });
      dorsalBotPts.push({ x: px, y: py + volR * Math.max(yE0, yE1) });
      spinePts.push({ x: px, y: py - volR * 0.94 * cr });
    }

    // Helper mapping rigid-rotated pectoral / pelvic fins cleanly through 3D barrel roll (rotY, rotZ)
    const rot3DYZ = (oldY, oldZ, roll) => ({
      y: oldY * Math.cos(roll) + oldZ * Math.sin(roll),
      z: -oldY * Math.sin(roll) + oldZ * Math.cos(roll)
    });

    const drawPectoralFinSide = (sideSign, wantFront) => {
      const rRoll = segRolls[5];
      const basePos = rot3DYZ(segRads[3] * 0.20, sideSign * segRads[3] * 0.65, rRoll);
      const midPos = rot3DYZ(segRads[5] * 1.15, sideSign * segRads[5] * 1.85, rRoll);
      const tipPos = rot3DYZ(segRads[6] * 0.92, sideSign * segRads[6] * 1.45, rRoll);
      const isNear = midPos.z >= 0;
      if (isNear !== wantFront) return;

      const rootX = midPts[3].x;
      const rootY = midPts[3].y + basePos.y;
      const tipX = midPts[9].x - 36;
      const tipY = midPts[6].y + tipPos.y;
      const ctrlX = midPts[6].x - 24;
      const ctrlY = midPts[5].y + midPos.y;

      const zShade = this._clamp(0.5 - midPos.z / Math.max(8, segRads[5] * 2.4), 0, 1);
      ctx.fillStyle = blendHex(finCol, dorsalCol, zShade * 0.50);
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.lineTo(midPts[7].x, midPts[5].y + basePos.y * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = 1.05;
      ctx.stroke();
    };

    const drawPelvicFinSide = (sideSign, wantFront) => {
      const rRoll = segRolls[14];
      const midPos = rot3DYZ(segRads[14] * 1.05, sideSign * segRads[14] * 1.15, rRoll);
      const isNear = midPos.z >= 0;
      if (isNear !== wantFront) return;

      const zShade = this._clamp(0.5 - midPos.z / Math.max(8, segRads[14] * 2.0), 0, 1);
      ctx.fillStyle = blendHex(finCol, dorsalCol, zShade * 0.50);
      ctx.beginPath();
      ctx.moveTo(midPts[13].x, midPts[13].y);
      ctx.quadraticCurveTo(midPts[15].x - 10, midPts[14].y + midPos.y * 1.15, midPts[17].x - 14, midPts[15].y + midPos.y * 0.55);
      ctx.lineTo(midPts[15].x, midPts[14].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = 0.95;
      ctx.stroke();
    };

    // LAYER 1: Far-side appendages BEHIND cylindrical body (smooth Z-shaded fins & soft spine fade)
    drawPectoralFinSide(-1, false);
    drawPectoralFinSide(1, false);
    drawPelvicFinSide(-1, false);
    drawPelvicFinSide(1, false);

    ctx.fillStyle = blendHex(dorsalCol, pal.waterMid, 0.25);
    for (let i = 2; i < segs - 2; i++) {
      if (segSin[i] >= 0.0) continue;
      const spA = this._clamp((-segSin[i]) / 0.35, 0, 1);
      const spY = spinePts[i].y;
      const finH = ((1 - i / segs) * (maxRad * 0.85) + 4) * segCos[i];
      ctx.save();
      ctx.globalAlpha = spA;
      ctx.beginPath();
      ctx.moveTo(spinePts[i].x, spY);
      ctx.lineTo(spinePts[i].x - 14, spY - finH);
      ctx.lineTo(spinePts[i + 1].x, spinePts[i + 1].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Tall Forked Lunate Tail Fluke rotating gently with aft roll phase
    const tailTip = midPts[segs];
    const flukeTwist = 0.25 + 0.75 * Math.abs(segCos[segs]);
    ctx.fillStyle = dorsalCol;
    ctx.beginPath();
    ctx.moveTo(tailTip.x + 12, tailTip.y);
    ctx.quadraticCurveTo(tailTip.x - 18, tailTip.y - 44 * flukeTwist, tailTip.x - 42, tailTip.y - 52 * flukeTwist);
    ctx.quadraticCurveTo(tailTip.x - 14, tailTip.y - 12 * flukeTwist, tailTip.x - 8, tailTip.y);
    ctx.quadraticCurveTo(tailTip.x - 14, tailTip.y + 12 * flukeTwist, tailTip.x - 40, tailTip.y + 48 * flukeTwist);
    ctx.quadraticCurveTo(tailTip.x - 16, tailTip.y + 38 * flukeTwist, tailTip.x + 12, tailTip.y);
    ctx.closePath();
    ctx.fill();

    // LAYER 2: Full-Volume Opaque Cylindrical Torso Silhouette (100% opaque with rotating dorsal armor & ventral ribs!)
    const traceBodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(topPts[0].x + 26, midPts[0].y - 3 * segCos[0]);
      topPts.forEach(p => ctx.lineTo(p.x, p.y));
      for (let i = botPts.length - 1; i >= 0; i--) ctx.lineTo(botPts[i].x, botPts[i].y);
      ctx.closePath();
    };

    ctx.fillStyle = ventralCol;
    traceBodyPath();
    ctx.fill();

    ctx.save();
    traceBodyPath();
    ctx.clip();

    // Segmented ventral belly ribs visible whenever pale ventral underbelly rotates toward viewer
    ctx.strokeStyle = dorsalCol;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.4;
    for (let i = 1; i < segs - 3; i += 2) {
      const bellyCenterY = midPts[i].y + segRads[i] * segCos[i];
      ctx.beginPath();
      ctx.moveTo(midPts[i].x + 5, midPts[i].y - segRads[i] * 0.45);
      ctx.quadraticCurveTo(midPts[i].x - 3, bellyCenterY * 0.5 + midPts[i].y * 0.5, midPts[i].x - 8, midPts[i].y + segRads[i] * 0.85);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Rotating Dark Dorsal Carapace Coverage rotating cleanly across cylinder as rollAngle turns 0..2pi
    ctx.fillStyle = dorsalCol;
    ctx.beginPath();
    ctx.moveTo(dorsalTopPts[0].x + 30, dorsalTopPts[0].y);
    for (let i = 0; i <= segs; i++) ctx.lineTo(dorsalTopPts[i].x, dorsalTopPts[i].y);
    for (let i = segs; i >= 0; i--) ctx.lineTo(dorsalBotPts[i].x, dorsalBotPts[i].y);
    ctx.closePath();
    ctx.fill();

    // Cylindrical 3D surface shading overlay (subtle sunlit dorsal/top & deep abyssal bottom contour)
    const cylG = ctx.createLinearGradient(0, cfg.y - maxRad * 1.1, 0, cfg.y + maxRad * 1.1);
    cylG.addColorStop(0, "rgba(186, 230, 253, 0.14)");
    cylG.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    cylG.addColorStop(1, "rgba(2, 10, 24, 0.34)");
    ctx.fillStyle = cylG;
    ctx.fillRect(cfg.x - bodyLen - 20, cfg.y - maxRad * 2.5, bodyLen + 65, maxRad * 5);
    ctx.restore();

    // Crisp pelagic silhouette rim highlight along upper contour
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(topPts[0].x + 26, midPts[0].y - 3 * segCos[0]);
    topPts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // LAYER 3: Near-side appendages IN FRONT of cylindrical torso (smoothly fading spines, glowing nodes, eyes & near fins)
    ctx.fillStyle = dorsalCol;
    for (let i = 2; i < segs - 2; i++) {
      if (segSin[i] < -0.35) continue;
      const spA = this._clamp((segSin[i] + 0.35) / 0.35, 0, 1);
      const p = spinePts[i];
      const next = spinePts[i + 1];
      const outwardY = -((1 - i / segs) * (maxRad * 0.85) + 4) * segCos[i];
      ctx.save();
      ctx.globalAlpha = spA;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 14, p.y + outwardY);
      ctx.lineTo(next.x, next.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.restore();
    }

    // Bioluminescent lateral-line nodes wrapping smoothly across the near cylinder hemisphere!
    for (let i = 2; i < segs - 1; i++) {
      const latAlpha = wrap2Pi(segRolls[i] + Math.PI * 0.5);
      const latZ = Math.sin(latAlpha);
      if (latZ < -0.15) continue;
      const latY = midPts[i].y - segRads[i] * 0.65 * Math.cos(latAlpha);
      const wavePulse = 0.35 + 0.65 * Math.max(0, Math.sin(step * (4.2 + biolumBoost * 6) - i * 0.48));
      const nodeCol = biolumBoost > 0.35 ? "56, 232, 249" : pal.jellyRgb;
      const nodeAlpha = Math.min(1, wavePulse * (0.88 + biolumBoost * 0.25) * Math.min(1, latZ + 0.35));
      ctx.fillStyle = `rgba(${nodeCol}, ${nodeAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(midPts[i].x, latY, (1 - i / segs) * (2.4 + biolumBoost * 1.4) + 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing maw/throat cavity + upper/lower teeth & hinged mandible rotating with head roll
    const headCos = segCos[0];
    const headSin = segSin[0];
    const jawDrop = jawOpen * 26;
    if (jawOpen > 0.04) {
      const glowCol = biolumBoost > 0.3 ? "103, 232, 249" : pal.jellyRgb;
      const glowG = ctx.createRadialGradient(topPts[0].x + 12, midPts[0].y + jawDrop * 0.35, 1, topPts[0].x + 12, midPts[0].y + jawDrop * 0.35, 22 + biolumBoost * 12);
      glowG.addColorStop(0, `rgba(${glowCol}, ${(Math.min(1, (0.88 + biolumBoost * 0.2) * jawOpen)).toFixed(3)})`);
      glowG.addColorStop(1, `rgba(${glowCol}, 0)`);
      ctx.fillStyle = glowG;
      ctx.beginPath();
      ctx.arc(topPts[0].x + 12, midPts[0].y + jawDrop * 0.35, 22 + biolumBoost * 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = dorsalCol;
    ctx.beginPath();
    ctx.moveTo(topPts[0].x + 20, midPts[0].y + 4 + jawDrop);
    ctx.lineTo(botPts[1].x + 4, botPts[1].y + 4 + jawDrop * 0.72);
    ctx.lineTo(botPts[2].x, botPts[2].y);
    ctx.lineTo(midPts[1].x, midPts[1].y);
    ctx.closePath();
    ctx.fill();

    if (jawOpen > 0.12) {
      ctx.fillStyle = "#E2E8F0";
      for (let tIdx = 0; tIdx < 4; tIdx++) {
        const tx = topPts[0].x + 16 - tIdx * 5;
        ctx.beginPath();
        ctx.moveTo(tx - 1.5, midPts[0].y - 1);
        ctx.lineTo(tx, midPts[0].y + 5.5);
        ctx.lineTo(tx + 1.5, midPts[0].y - 1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx - 1.4, midPts[0].y + 4 + jawDrop * 0.9);
        ctx.lineTo(tx, midPts[0].y - 1.5 + jawDrop * 0.9);
        ctx.lineTo(tx + 1.4, midPts[0].y + 4 + jawDrop * 0.9);
        ctx.fill();
      }
    }

    // Smoothly projecting multi-ocular glowing eye cluster on near head face
    if (headSin >= -0.65) {
      const eyeVis = this._clamp((headSin + 0.65) / 0.35, 0, 1);
      [
        { dx: 8, dy: -6, r: 2.8 + biolumBoost * 0.9 },
        { dx: 1, dy: -8, r: 2.1 + biolumBoost * 0.7 },
        { dx: -5, dy: -6, r: 1.6 + biolumBoost * 0.5 }
      ].forEach((ey, ei) => {
        ctx.fillStyle = `rgba(${biolumBoost > 0.35 ? "103, 232, 249" : pal.jellyRgb}, ${((0.92 - ei * 0.14) * eyeVis).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(topPts[0].x + ey.dx, midPts[0].y + ey.dy * headCos, ey.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Near Giant Pectoral & Pelvic Wings in Front of Torso
    drawPectoralFinSide(-1, true);
    drawPectoralFinSide(1, true);
    drawPelvicFinSide(-1, true);
    drawPelvicFinSide(1, true);
    ctx.restore();
  },

  _updateAndDrawLeviathan(ctx, w, h, pal, dt, step) {
    const lev = this.leviathan;
    if (!lev || lev.phase === "dormant_wait") {
      return;
    }
    lev.t += dt;
    const progress = this._clamp(lev.t / Math.max(1, lev.phaseDuration || 10), 0, 1.5);
    const bodyLen = lev.length;
    const smooth5 = (t) => {
      const c = this._clamp(t, 0, 1);
      return c * c * c * (c * (c * 6 - 15) + 10);
    };

    let speedMult = 1.0;
    let rollAngle = 0;
    let rollWave = false;
    let jawOpen = 0;
    let rollYOff = 0;
    let pursuitPitch = 0;
    let biolumBoost = 0;
    let swimPhaseRate = lev.stunt === "body_roll" ? 1.85 : 1.55;

    if (lev.stunt === "roar") {
      const centerProx = 1 - Math.min(1, Math.abs(lev.x - w * 0.5) / Math.max(120, w * 0.24));
      speedMult = 1 - centerProx * 0.72;
      jawOpen = centerProx * 0.72;
      if (centerProx > 0.35 && lev.roarEmitted < 4 && Math.floor(centerProx * 6) > lev.roarEmitted) {
        lev.roarEmitted++;
        lev.roarRings.push({ x: lev.x + lev.dir * 26, y: lev.y + 4, r: 8, maxR: bodyLen * 0.30, life: 0, maxLife: 1.4 });
        for (let b = 0; b < 6; b++) {
          this.bubbles.push({
            x: lev.x + lev.dir * 24 + (Math.random() - 0.5) * 16,
            y: lev.y + (Math.random() - 0.5) * 12,
            r: 1.5 + Math.random() * 2.2,
            vy: -(0.7 + Math.random() * 0.8),
            wobble: Math.random() * 6,
            alpha: 0.52
          });
        }
      }
    } else if (lev.stunt === "body_roll") {
      rollWave = true;
      const rollProg = smooth5((progress - 0.14) / 0.64);
      rollAngle = rollProg * Math.PI * 2;
      rollYOff = Math.sin(rollAngle) * 28;
      speedMult = 1.08;
      if (rollProg > 0.05 && rollProg < 0.95 && Math.random() < 0.45) {
        this.bubbles.push({
          x: lev.x - lev.dir * bodyLen * 0.18 + (Math.random() - 0.5) * 20,
          y: lev.y + Math.sin(rollAngle) * 32,
          r: 1.4 + Math.random() * 2.0,
          vy: -(0.6 + Math.random() * 0.8),
          wobble: Math.random() * 6,
          alpha: 0.48
        });
      }
    } else if (lev.stunt === "hunt_shark") {
      const prey = lev.preyShark;
      if (prey && !prey.eaten) {
        const distX = (prey.x - lev.x) * lev.dir;
        const huntIntensity = distX > -20 ? smooth5(this._clamp(1 - Math.max(0, distX) / 380, 0, 1)) : 0;
        speedMult = 1.08 + huntIntensity * 1.32; // Explosive up to 2.4x surge lunge!
        swimPhaseRate = 1.65 + huntIntensity * 2.35;
        biolumBoost = huntIntensity * 0.92;
        jawOpen = 0.22 + huntIntensity * 0.74;

        // Vertical ambush tracking toward zig-zagging prey shark
        const dyPrey = prey.y - lev.baseY;
        lev.baseY += this._clamp(dyPrey, -52 * dt, 52 * dt);
        pursuitPitch = this._clamp(dyPrey * 0.0045, -0.26, 0.26) * Math.max(0.25, huntIntensity);

        // Prey shark cruises calmly until ambush range, then panics with erratic zig-zag evasion
        const isNarrowHunt = w < 720;
        prey.phase += dt * (8 + huntIntensity * 10);
        const evadeAmp = (8 + huntIntensity * 20) * (isNarrowHunt ? 0.72 : 1);
        const nextPreyY = (prey.baseY || lev.baseY) + Math.sin(prey.phase * 0.72) * evadeAmp;
        prey.pitch = this._clamp((nextPreyY - prey.y) * 0.04, -0.35, 0.35);
        prey.y = nextPreyY;
        prey.vx = lev.dir * ((isNarrowHunt ? 10 : 16) + huntIntensity * (isNarrowHunt ? 26 : 44));
        prey.x += prey.vx * dt;

        // Panic bubble trail behind fleeing shark & predator surge
        if (Math.random() < 0.35 + huntIntensity * 0.45) {
          this.bubbles.push({
            x: prey.x - lev.dir * prey.size * 0.4,
            y: prey.y + (Math.random() - 0.5) * 10,
            r: 1.2 + Math.random() * 1.6,
            vy: -(0.8 + Math.random() * 0.7),
            wobble: Math.random() * 6,
            alpha: 0.48
          });
        }

        // Draw fleeing shark + scattering baitfish school ahead
        if (prey.baitfish) {
          ctx.save();
          ctx.fillStyle = pal.waterBounce;
          prey.baitfish.forEach((bf, bi) => {
            if (!bf.scattered && huntIntensity > 0.35) {
              bf.scattered = true;
              bf.vx = (Math.random() - 0.3) * lev.dir * 95;
              bf.vy = (bf.dy >= 0 ? 1 : -1) * (45 + Math.random() * 55);
            }
            if (bf.scattered) {
              bf.dx += bf.vx * dt;
              bf.dy += bf.vy * dt;
            }
            const fx = prey.x + lev.dir * 26 + bf.dx;
            const fy = prey.y + bf.dy + Math.sin(step * 12 + bi) * 2.5;
            ctx.beginPath();
            ctx.ellipse(fx, fy, bf.size, bf.size * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        }

        if (Math.hypot(prey.x - lev.x, (prey.y - lev.y) * 0.55) < 42 || (lev.dir > 0 ? lev.x >= prey.x : lev.x <= prey.x)) {
          // Dramatic Chomp Snap + Multi-Ring Hydro Shockwaves + Bubble Burst + Victory Roll!
          prey.eaten = true;
          prey.chompX = prey.x;
          prey.chompY = prey.y;
          lev.chompTimer = 1.75;
          jawOpen = 0.05;
          [75, 115, 155].forEach((mR, ri) => {
            lev.roarRings.push({
              x: prey.x + lev.dir * 12,
              y: prey.y,
              r: 6 + ri * 6,
              maxR: mR,
              life: -ri * 0.10,
              maxLife: 1.15
            });
          });
          for (let b = 0; b < 28; b++) {
            const ang = (b / 28) * Math.PI * 2;
            this.bubbles.push({
              x: prey.x + Math.cos(ang) * 14,
              y: prey.y + Math.sin(ang) * 12,
              r: 1.6 + Math.random() * 2.8,
              vy: -(0.9 + Math.random() * 1.4),
              wobble: Math.random() * 6,
              alpha: 0.68
            });
          }
        } else {
          // Draw solid panicked shark with zig-zag pitch ahead of lunging Leviathan
          ctx.save();
          ctx.globalAlpha = 0.94;
          ctx.fillStyle = pal.reefNear;
          ctx.translate(prey.x, prey.y);
          if (prey.vx < 0) ctx.scale(-1, 1);
          ctx.rotate(prey.pitch || 0);
          const sz = prey.size;
          const tail = Math.sin(prey.phase) * sz * 0.16;
          ctx.beginPath();
          ctx.moveTo(sz * 0.52, 0);
          ctx.quadraticCurveTo(sz * 0.15, -sz * 0.11, -sz * 0.05, -sz * 0.10);
          ctx.lineTo(-sz * 0.12, -sz * 0.28);
          ctx.lineTo(-sz * 0.20, -sz * 0.08);
          ctx.lineTo(-sz * 0.48, tail - sz * 0.03);
          ctx.lineTo(-sz * 0.65, tail * 1.3 - sz * 0.20);
          ctx.lineTo(-sz * 0.52, tail);
          ctx.lineTo(-sz * 0.60, tail * 1.2 + sz * 0.15);
          ctx.lineTo(-sz * 0.48, tail + sz * 0.03);
          ctx.quadraticCurveTo(sz * 0.10, sz * 0.11, sz * 0.52, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (prey && prey.eaten && lev.chompTimer > 0) {
        lev.chompTimer = Math.max(0, lev.chompTimer - dt);
        const postP = 1 - lev.chompTimer / 1.75;
        rollWave = true;
        rollAngle = smooth5(postP) * Math.PI * 2;
        rollYOff = Math.sin(rollAngle) * 16;
        jawOpen = Math.max(0, (1 - postP * 2.5) * 0.22);
        speedMult = 1.45 - postP * 0.35;
        biolumBoost = (1 - postP) * 0.85;
        if (postP < 0.35 && prey.chompX) {
          const flA = Math.sin((postP / 0.35) * Math.PI) * 0.45;
          const flG = ctx.createRadialGradient(prey.chompX, prey.chompY, 2, prey.chompX, prey.chompY, 54);
          flG.addColorStop(0, `rgba(186, 230, 253, ${flA.toFixed(3)})`);
          flG.addColorStop(1, "rgba(186, 230, 253, 0)");
          ctx.fillStyle = flG;
          ctx.beginPath();
          ctx.arc(prey.chompX, prey.chompY, 54, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    lev.swimPhase += dt * swimPhaseRate;
    lev.x += lev.dir * lev.speed * speedMult * dt;
    lev.y = lev.baseY + rollYOff;
    lev.jawOpen = jawOpen;
    lev.rollAngle = rollAngle;

    if (lev.stunt === "two_playing" && lev.partner) {
      // Wide Zero-Clip 3D Double-Helix Circling Orbit: C-infinity sinusoidal depth shading (no lighting kinks!)
      const helix = lev.t * 1.15;
      const ampY = w < 720 ? 46 : 74;
      const yMain = lev.baseY + Math.sin(helix) * ampY;
      const yPartner = lev.baseY - Math.sin(helix) * ampY;
      const zMain = Math.cos(helix);
      const zPartner = -zMain;
      const zNormMain = (1 - zMain) * 0.5;
      const zNormPart = (1 - zPartner) * 0.5;
      const xMain = lev.x + Math.sin(helix) * 22 * lev.dir;
      const xPartner = lev.x - lev.partner.lagX * 0.52 - Math.sin(helix) * 22 * lev.dir;
      lev.partner.swimPhase += dt * 1.65;
      lev.y = yMain;

      const mainCfg = {
        x: xMain, y: yMain, dir: lev.dir, bodyLen,
        swimPhase: lev.swimPhase, jawOpen: 0,
        rollAngle: Math.sin(helix) * 0.50, rollWave: false,
        pitch: Math.cos(helix) * 0.20,
        depthScale: 1 + zMain * 0.13,
        depthFog: Math.pow(zNormMain, 1.35) * 0.34
      };
      const partCfg = {
        x: xPartner, y: yPartner, dir: lev.dir, bodyLen: lev.partner.length,
        swimPhase: lev.partner.swimPhase, jawOpen: 0,
        rollAngle: -Math.sin(helix) * 0.50, rollWave: false,
        pitch: -Math.cos(helix) * 0.20,
        depthScale: 1 + zPartner * 0.13,
        depthFog: Math.pow(zNormPart, 1.35) * 0.34,
        isPartner: true
      };
      if (zMain >= zPartner) {
        this._drawLeviathanBody(ctx, partCfg, pal, step);
        this._drawLeviathanBody(ctx, mainCfg, pal, step);
      } else {
        this._drawLeviathanBody(ctx, mainCfg, pal, step);
        this._drawLeviathanBody(ctx, partCfg, pal, step);
      }
      if (Math.random() < 0.28) {
        this.bubbles.push({
          x: xMain - lev.dir * 38,
          y: yMain + (Math.random() - 0.5) * 14,
          r: 1.2 + Math.random() * 1.6,
          vy: -(0.5 + Math.random() * 0.6),
          wobble: Math.random() * 6,
          alpha: 0.42
        });
      }
    } else {
      this._drawLeviathanBody(ctx, { x: lev.x, y: lev.y, dir: lev.dir, bodyLen, swimPhase: lev.swimPhase, jawOpen, rollAngle, rollWave, pitch: pursuitPitch, biolumBoost }, pal, step);
    }

    // Expanding Sonic Roar / Lunge Shockwave Rings
    if (lev.roarRings && lev.roarRings.length > 0) {
      const aliveRings = [];
      ctx.save();
      for (let i = 0; i < lev.roarRings.length; i++) {
        const rr = lev.roarRings[i];
        rr.life += dt;
        if (rr.life < 0) {
          aliveRings.push(rr);
          continue;
        }
        if (rr.life >= rr.maxLife) continue;
        aliveRings.push(rr);
        const tf = rr.life / rr.maxLife;
        const rad = rr.r + (rr.maxR - rr.r) * (1 - Math.pow(1 - tf, 2));
        const a = (1 - tf) * 0.56;
        ctx.strokeStyle = `rgba(${pal.jellyRgb}, ${a.toFixed(3)})`;
        ctx.lineWidth = Math.max(0.8, 3.0 * (1 - tf));
        ctx.beginPath();
        ctx.arc(rr.x, rr.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      lev.roarRings = aliveRings;
    }

    const fullyGone = lev.dir > 0 ? (lev.x - bodyLen * 1.25 > w + 140) : (lev.x + bodyLen * 1.25 < -140);
    if (fullyGone) {
      if (this._queuedLeviathan) {
        const nextOpts = this._queuedLeviathan.opts || {};
        this._queuedLeviathan = null;
        this.spawnLeviathan(w, h, { ...nextOpts, force: true });
      } else {
        lev.phase = "dormant_wait";
        lev.t = 0;
        lev.roarRings = [];
      }
    }
  },

  // Foreground Playful Wildlife: Gliding Sea Turtles (rendered in front of station & docked submarines, Director-gated)
  _updateAndDrawSeaTurtles(ctx, w, h, pal, dt, step) {
    const isNarrow = w < 720;
    for (let i = 0; i < this.seaTurtles.length; i++) {
      const t = this.seaTurtles[i];
      if (!t.active) {
        t.waitTimer = (t.waitTimer || 0) - dt;
        if (t.waitTimer <= 0) {
          if (this._canActivate("playful", isNarrow)) {
            t.active = true;
            const goRight = Math.random() < 0.5;
            t.vx = (goRight ? 1 : -1) * this._rand(20, 27);
            t.x = goRight ? -75 : (w + 75);
            t.y = h * this._rand(0.32, 0.72);
          } else {
            t.waitTimer = this._rand(3.0, 6.0);
          }
        }
        continue;
      }

      t.flapPhase += dt * 3.1;
      t.x += t.vx * dt;
      t.y += Math.sin(t.flapPhase * 0.45) * 6.0 * dt + t.vy * dt * 0.18;
      if ((t.vx > 0 && t.x > w + 80) || (t.vx < 0 && t.x < -80)) {
        t.active = false;
        t.waitTimer = this._rand(isNarrow ? 16 : 10, isNarrow ? 30 : 22);
        continue;
      }

      const sz = t.size;
      const flap = Math.sin(t.flapPhase);
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.vx < 0) ctx.scale(-1, 1);

      // Articulated Hind Flipper & Far Pectoral Flipper
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.58, sz * 0.14);
      ctx.quadraticCurveTo(-sz * 0.92, sz * 0.36, -sz * 0.74, sz * 0.44);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sz * 0.16, -sz * 0.18);
      ctx.quadraticCurveTo(-sz * 0.06, -sz * (0.58 - flap * 0.25), -sz * 0.34, -sz * (0.48 - flap * 0.20));
      ctx.lineTo(0, -sz * 0.08);
      ctx.closePath();
      ctx.fill();

      // Domed Olive-Slate Sea Turtle Carapace Shell & Scute Plating
      ctx.fillStyle = pal.hullMid;
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.62, sz * 0.34, -0.05, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(sz * 0.58, sz * 0.14, 0, sz * 0.18);
      ctx.quadraticCurveTo(-sz * 0.58, sz * 0.14, -sz * 0.62, 0);
      ctx.fill();

      ctx.fillStyle = pal.cropRow;
      ctx.globalAlpha = 0.65;
      [-sz * 0.26, 0, sz * 0.26].forEach(cx => {
        ctx.beginPath();
        ctx.ellipse(cx, -sz * 0.12, sz * 0.11, sz * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Neck & Rounded Head + Eye
      ctx.fillStyle = pal.subHullMid;
      ctx.beginPath();
      ctx.ellipse(sz * 0.68, -sz * 0.05, sz * 0.20, sz * 0.13, 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.windowMid;
      ctx.beginPath();
      ctx.arc(sz * 0.74, -sz * 0.08, 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Foreground Swimming Wing Flipper sweeping downward on power stroke
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.moveTo(sz * 0.28, sz * 0.08);
      ctx.quadraticCurveTo(sz * 0.14, sz * (0.52 + flap * 0.34), -sz * 0.22, sz * (0.58 + flap * 0.28));
      ctx.quadraticCurveTo(sz * 0.02, sz * 0.26, sz * 0.08, sz * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // Foreground Sleek Reef Sharks with Single-Mesh Connected Dorsal, Pectoral & Caudal Fins (Director-gated)
  _updateAndDrawFgReefSharks(ctx, w, h, pal, dt, step) {
    const isNarrow = w < 720;
    for (let i = 0; i < this.fgReefSharks.length; i++) {
      const sh = this.fgReefSharks[i];
      if (!sh.active) {
        sh.waitTimer = (sh.waitTimer || 0) - dt;
        if (sh.waitTimer <= 0) {
          if (this._canActivate("megafauna", isNarrow)) {
            sh.active = true;
            const goRight = Math.random() < 0.5;
            sh.vx = (goRight ? 1 : -1) * this._rand(34, 44);
            sh.x = goRight ? -90 : (w + 90);
            sh.y = h * this._rand(0.38, 0.68);
          } else {
            sh.waitTimer = this._rand(3.0, 6.0);
          }
        }
        continue;
      }

      sh.tailPhase += dt * 4.4;
      sh.x += sh.vx * dt;
      sh.y += Math.sin(sh.tailPhase * 0.35 + i) * 5.0 * dt;
      if ((sh.vx > 0 && sh.x > w + 90) || (sh.vx < 0 && sh.x < -90)) {
        sh.active = false;
        sh.waitTimer = this._rand(isNarrow ? 16 : 10, isNarrow ? 30 : 22);
        continue;
      }

      const sz = sh.size;
      const sway = Math.sin(sh.tailPhase) * (sz * 0.11);
      ctx.save();
      ctx.translate(sh.x, sh.y);
      if (sh.vx < 0) ctx.scale(-1, 1);

      // Single continuous connected shark hull + dorsal + caudal fluke path
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.moveTo(sz, 0);
      ctx.quadraticCurveTo(sz * 0.45, -sz * 0.24, sz * 0.12, -sz * 0.23);
      ctx.lineTo(-sz * 0.08, -sz * 0.56); // Attached tall swept dorsal fin
      ctx.lineTo(-sz * 0.16, -sz * 0.18);
      ctx.quadraticCurveTo(-sz * 0.56, -sz * 0.12 + sway * 0.5, -sz * 0.84, -sz * 0.05 + sway);
      ctx.lineTo(-sz * 1.18, -sz * 0.42 + sway * 1.2); // Attached upper caudal blade
      ctx.lineTo(-sz * 0.96, sway);
      ctx.lineTo(-sz * 1.08, sz * 0.28 + sway * 1.1);  // Lower caudal blade
      ctx.lineTo(-sz * 0.84, sz * 0.06 + sway);
      ctx.quadraticCurveTo(-sz * 0.35, sz * 0.18, sz * 0.12, sz * 0.22);
      ctx.quadraticCurveTo(sz * 0.58, sz * 0.22, sz, 0);
      ctx.closePath();
      ctx.fill();

      // Lighter ventral belly counter-shading & attached pectoral fin
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(sz * 0.78, sz * 0.05);
      ctx.quadraticCurveTo(sz * 0.20, sz * 0.24, -sz * 0.62, sz * 0.09 + sway * 0.4);
      ctx.quadraticCurveTo(sz * 0.20, sz * 0.10, sz * 0.78, sz * 0.05);
      ctx.fill();

      ctx.fillStyle = pal.hullDark;
      ctx.beginPath();
      ctx.moveTo(sz * 0.28, sz * 0.12);
      ctx.lineTo(-sz * 0.02, sz * 0.46);
      ctx.lineTo(sz * 0.04, sz * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },

  // Playful Foreground Porpoising Dolphin Pod Swimming in Coordinated Shallow Sine-Wave Arcs (Director-gated)
  _updateAndDrawDolphins(ctx, w, h, pal, dt, step) {
    const isNarrow = w < 720;
    const pod = this.dolphinPodState;
    if (!pod) return;

    if (!pod.active) {
      pod.waitTimer = (pod.waitTimer || 0) - dt;
      if (pod.waitTimer <= 0) {
        if (this._canActivate("playful", isNarrow)) {
          pod.active = true;
          const goRight = Math.random() < 0.5;
          pod.dir = goRight ? 1 : -1;
          const baseH = h * this._rand(0.28, 0.42);
          const gap = isNarrow ? 46 : 64;
          for (let i = 0; i < this.dolphins.length; i++) {
            const dl = this.dolphins[i];
            dl.dir = pod.dir;
            dl.vx = pod.dir * 54;
            dl.x = pod.dir > 0 ? (-110 - i * gap) : (w + 110 + i * gap);
            dl.baseY = baseH + (i % 2) * (h * 0.045);
          }
        } else {
          pod.waitTimer = this._rand(3.0, 6.0);
        }
      }
      return;
    }

    let anyInCourse = false;
    for (let i = 0; i < this.dolphins.length; i++) {
      const d = this.dolphins[i];
      d.arcPhase += dt * 2.7;
      d.x += d.vx * dt;
      const leapOff = Math.sin(d.arcPhase) * 18;
      d.y = d.baseY + leapOff;
      const pitch = Math.cos(d.arcPhase) * 0.26;
      if ((d.dir > 0 && d.x <= w + 150) || (d.dir < 0 && d.x >= -150)) {
        anyInCourse = true;
      }

      const sz = d.size;
      const tailKick = Math.sin(d.arcPhase * 2.2) * (sz * 0.10);
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.dir < 0) ctx.scale(-1, 1);
      ctx.rotate(pitch);

      // Sleek curved dolphin silhouette + iconic falcate dorsal fin + bottle-nose rostrum
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.moveTo(sz * 1.05, sz * 0.04); // rostrum beak tip
      ctx.quadraticCurveTo(sz * 0.74, -sz * 0.02, sz * 0.56, -sz * 0.18); // melon forehead
      ctx.quadraticCurveTo(sz * 0.24, -sz * 0.24, 0, -sz * 0.22);
      ctx.quadraticCurveTo(-sz * 0.12, -sz * 0.48, -sz * 0.22, -sz * 0.44); // curved dorsal fin
      ctx.quadraticCurveTo(-sz * 0.14, -sz * 0.24, -sz * 0.18, -sz * 0.19);
      ctx.quadraticCurveTo(-sz * 0.58, -sz * 0.12, -sz * 0.92, tailKick);
      ctx.lineTo(-sz * 1.12, -sz * 0.16 + tailKick); // horizontal tail fluke
      ctx.lineTo(-sz * 0.96, tailKick);
      ctx.lineTo(-sz * 1.10, sz * 0.18 + tailKick);
      ctx.lineTo(-sz * 0.92, tailKick);
      ctx.quadraticCurveTo(-sz * 0.38, sz * 0.14, sz * 0.28, sz * 0.20);
      ctx.quadraticCurveTo(sz * 0.74, sz * 0.18, sz * 1.05, sz * 0.04);
      ctx.closePath();
      ctx.fill();

      // Lighter pale silver dolphin belly + flipper
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(sz * 0.80, sz * 0.07);
      ctx.quadraticCurveTo(sz * 0.24, sz * 0.22, -sz * 0.52, sz * 0.08);
      ctx.quadraticCurveTo(sz * 0.18, sz * 0.07, sz * 0.80, sz * 0.07);
      ctx.fill();

      ctx.fillStyle = pal.hullDark;
      ctx.beginPath();
      ctx.moveTo(sz * 0.30, sz * 0.10);
      ctx.quadraticCurveTo(sz * 0.14, sz * 0.34, sz * 0.02, sz * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (!anyInCourse) {
      pod.active = false;
      pod.waitTimer = this._rand(isNarrow ? 18 : 12, isNarrow ? 34 : 26);
    }
  },

  // Graceful Side-On / 3/4 Oblique Oceanic Manta Ray matching Canvas Horizon Camera Plane!
  _drawCleaningManta(ctx, m, pal, step, depthScale, alpha) {
    const sp = m.span * depthScale;
    const flapSin = Math.sin(m.wingPhase);
    const farSin = Math.sin(m.wingPhase - 0.72);
    const wingDownY = sp * (0.20 + flapSin * 0.24);
    const farWingUpY = -sp * (0.14 - farSin * 0.16);
    const tailWag = Math.sin(m.wingPhase * 0.8 + 1.1) * sp * 0.11;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(m.x, m.y);
    ctx.scale((m.facingLeft ? -1 : 1) * (m.turnProjX != null ? m.turnProjX : 1), 1);
    ctx.rotate(m.bank || 0);

    // 1. Far Pectoral Wing sweeping obliquely above/behind dorsal ridge (foreshortened depth tint)
    ctx.fillStyle = pal.isDark ? "#08182C" : "#0D2B42";
    ctx.beginPath();
    ctx.moveTo(sp * 0.26, -sp * 0.04);
    ctx.quadraticCurveTo(sp * 0.06, -sp * 0.24 + farWingUpY, -sp * 0.18, -sp * (0.12 - farSin * 0.08));
    ctx.quadraticCurveTo(0, -sp * 0.06, -sp * 0.30, -sp * 0.02);
    ctx.closePath();
    ctx.fill();

    // 2. Long slender flexible whip tail streaming cleanly aft
    ctx.strokeStyle = pal.isDark ? "#123252" : "#163F5E";
    ctx.lineWidth = Math.max(1.2, sp * 0.042);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-sp * 0.36, 0);
    ctx.quadraticCurveTo(-sp * 0.78, tailWag * 0.65, -sp * 1.18, tailWag);
    ctx.stroke();

    // 3. Arched Sculpted Side-On Dark Dorsal Mantle Body & Pale Ventral Gill Belly
    const capeG = ctx.createLinearGradient(0, -sp * 0.20, 0, sp * 0.22);
    capeG.addColorStop(0, pal.isDark ? "#1C4973" : "#245F87");
    capeG.addColorStop(0.55, pal.isDark ? "#102B48" : "#16405E");
    capeG.addColorStop(1, pal.isDark ? "#08192E" : "#0D2B42");
    ctx.fillStyle = capeG;
    ctx.beginPath();
    // Sculpted cephalic horn & brow ridge arcing gracefully across arched back to tail root
    ctx.moveTo(sp * 0.56, -sp * 0.01);
    ctx.quadraticCurveTo(sp * 0.44, -sp * 0.14, sp * 0.16, -sp * 0.13);
    ctx.quadraticCurveTo(-sp * 0.14, -sp * 0.11, -sp * 0.42, 0);
    ctx.quadraticCurveTo(-sp * 0.14, sp * 0.11, sp * 0.24, sp * 0.12);
    ctx.quadraticCurveTo(sp * 0.48, sp * 0.10, sp * 0.56, -sp * 0.01);
    ctx.closePath();
    ctx.fill();

    // Prominent forward-curling cephalic feeding horns (lower jaw profile & subtle snout cleft)
    ctx.fillStyle = pal.isDark ? "#0D243E" : "#12354E";
    ctx.beginPath();
    ctx.moveTo(sp * 0.46, sp * 0.03);
    ctx.quadraticCurveTo(sp * 0.64, sp * 0.09, sp * 0.58, sp * 0.14);
    ctx.quadraticCurveTo(sp * 0.48, sp * 0.12, sp * 0.38, sp * 0.07);
    ctx.closePath();
    ctx.fill();

    // Creamy-white convex ventral throat & belly curve with 5 curved gill slits!
    ctx.fillStyle = pal.isDark ? "rgba(196, 234, 255, 0.80)" : "rgba(241, 248, 255, 0.92)";
    ctx.beginPath();
    ctx.moveTo(sp * 0.48, sp * 0.03);
    ctx.quadraticCurveTo(sp * 0.22, sp * 0.20, -sp * 0.16, sp * 0.13);
    ctx.lineTo(-sp * 0.38, sp * 0.02);
    ctx.quadraticCurveTo(0, sp * 0.04, sp * 0.48, sp * 0.03);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.isDark ? "rgba(15, 36, 58, 0.52)" : "rgba(21, 61, 90, 0.46)";
    ctx.lineWidth = Math.max(0.8, sp * 0.022);
    for (let g = 0; g < 5; g++) {
      const gx = sp * (0.20 - g * 0.055);
      const gy = sp * 0.085;
      ctx.beginPath();
      ctx.moveTo(gx, gy - sp * 0.022);
      ctx.quadraticCurveTo(gx - sp * 0.015, gy, gx - sp * 0.008, gy + sp * 0.028);
      ctx.stroke();
    }

    // Subtle lateral dorsal shoulder pale chevron patch + watchful eye
    ctx.fillStyle = pal.isDark ? "rgba(186, 230, 253, 0.34)" : "rgba(232, 247, 255, 0.54)";
    ctx.beginPath();
    ctx.moveTo(sp * 0.32, -sp * 0.05);
    ctx.quadraticCurveTo(sp * 0.16, -sp * 0.11, 0, -sp * 0.08);
    ctx.quadraticCurveTo(sp * 0.14, -sp * 0.04, sp * 0.26, -sp * 0.02);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#08111E";
    ctx.beginPath();
    ctx.arc(sp * 0.42, -sp * 0.02, Math.max(1.1, sp * 0.032), 0, Math.PI * 2);
    ctx.fill();

    // 4. Foreground Sweeping Near Pectoral Wing (dark dorsal mantle on downstroke, gleaming pale underside on upstroke!)
    const wingUpstroke = flapSin < -0.15;
    const tipY = wingUpstroke ? (-sp * (0.04 + Math.abs(flapSin) * 0.26)) : (sp * 0.14 + wingDownY * 0.72);
    ctx.fillStyle = wingUpstroke
      ? (pal.isDark ? "rgba(186, 230, 253, 0.78)" : "rgba(232, 245, 255, 0.90)")
      : capeG;
    ctx.beginPath();
    ctx.moveTo(sp * 0.28, sp * 0.01);
    ctx.quadraticCurveTo(sp * 0.14, tipY * 0.92, -sp * 0.08, tipY);
    ctx.quadraticCurveTo(-sp * 0.12, sp * 0.05, -sp * 0.24, sp * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.isDark ? "rgba(125, 211, 252, 0.24)" : "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = 0.85;
    ctx.stroke();

    ctx.restore();
  },

  // Vibrant Bluestreak Cleaner Wrasse (Labroides dimidiatus) servicing mantas at the cleaning reef
  _drawCleanerWrasse(ctx, wr, pal, step) {
    const s = wr.size;
    const tailWag = Math.sin(wr.wigglePhase * 4.5) * s * 0.24;
    ctx.save();
    ctx.translate(wr.x, wr.y);
    if (wr.facingLeft) ctx.scale(-1, 1);
    ctx.rotate(wr.pitch || 0);

    // Pale silver-white streamlined slender torso
    ctx.fillStyle = pal.isDark ? "#CBD5E1" : "#F1F5F9";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.90, s * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iridescent Electric-Blue Dorsal Flank & Fan Tail (bold bright cleaner signature!)
    ctx.fillStyle = pal.isDark ? "#22D3EE" : "#00B4D8";
    ctx.beginPath();
    ctx.moveTo(s * 0.78, -s * 0.02);
    ctx.quadraticCurveTo(0, -s * 0.36, -s * 0.85, -s * 0.12 + tailWag * 0.4);
    ctx.lineTo(-s * 1.28, -s * 0.30 + tailWag);
    ctx.lineTo(-s * 1.28, s * 0.30 + tailWag);
    ctx.lineTo(-s * 0.85, s * 0.08 + tailWag * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.02, s * 0.78, -s * 0.02);
    ctx.closePath();
    ctx.fill();

    // Signature crisp jet-black longitudinal cleaner stripe tapering cleanly into tail
    ctx.fillStyle = "#090D16";
    ctx.beginPath();
    ctx.moveTo(s * 0.86, 0);
    ctx.lineTo(-s * 0.85, -s * 0.09 + tailWag * 0.4);
    ctx.lineTo(-s * 1.18, -s * 0.12 + tailWag);
    ctx.lineTo(-s * 1.18, s * 0.12 + tailWag);
    ctx.lineTo(-s * 0.85, s * 0.09 + tailWag * 0.4);
    ctx.closePath();
    ctx.fill();

    // Tiny bright cyan eye highlight
    ctx.fillStyle = "#7DD3FC";
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.05, Math.max(0.65, s * 0.085), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  // Live Updating & Multi-Layer (Behind-Station + Foreground) Rendering of Habitat-Surrounding Cleaning Station Mantas & Cleaner Wrasse
  _updateAndDrawCleaningStation(ctx, w, h, L, pal, dt, step, layer = "all") {
    const cs = L.cleaningStation;
    if (!cs) return;
    const mantas = this.cleaningMantas;
    const wrasses = this.cleanerWrasse;
    const sc = cs.scale;
    const shouldStep = layer === "back" || layer === "all";

    // 1. Update evenly-spaced plateau-circling mantas seamlessly transitioning back <-> front around ENTIRE station!
    if (shouldStep) {
      const bReefs = cs.backReefs || [];
      const fReefs = cs.frontReefs || [];
      const allReefs = bReefs.concat(fReefs);

      // Spacing-preserving shared reef pass: compute closest reef distance across ring first
      let minRingReefDist = Infinity;
      for (let i = 0; i < mantas.length; i++) {
        const m = mantas[i];
        const sinA = Math.sin(m.orbitAngle);
        const reefsHere = sinA < 0 ? bReefs : fReefs;
        let minD = Infinity;
        for (let r = 0; r < reefsHere.length; r++) {
          minD = Math.min(minD, Math.abs(reefsHere[r].x - m.x));
        }
        m._reefDist = minD;
        if (minD < minRingReefDist) minRingReefDist = minD;
      }
      const sharedSlowFactor = minRingReefDist < 34 * sc ? 0.62 : 1.0;

      for (let i = 0; i < mantas.length; i++) {
        const m = mantas[i];
        const overReef = (m._reefDist != null ? m._reefDist : Infinity) < 34 * sc;
        m.state = overReef ? "hover_clean" : "circling";
        m.wingPhase += dt * (overReef ? 2.1 : 3.0);
        m.orbitAngle += m.orbitSpeed * sharedSlowFactor * dt;

        const cosA = Math.cos(m.orbitAngle);
        const sinA = Math.sin(m.orbitAngle);
        const rNorm = Math.pow(Math.pow(Math.abs(cosA), 3.5) + Math.pow(Math.abs(sinA), 3.5), -1 / 3.5);
        const vx = -sinA * m.orbitSpeed;
        const cxBase = m.centerX != null ? m.centerX : L.hubX;
        const cyBase = m.centerY != null ? m.centerY : (L.seabedY - 26 * sc);
        m.x = cxBase + cosA * rNorm * m.orbitRx;
        m.y = cyBase + sinA * rNorm * m.orbitRy + Math.sin(m.wingPhase * 0.5) * 3.0 * sc;
        m.facingLeft = vx < 0;
        // Foreshorten smoothly at East & West orbit apexes so back<->front turnaround never snaps
        m.turnProjX = Math.max(0.28, Math.min(1.0, 0.28 + Math.abs(sinA) * 0.85));
        m.bank = cosA * (m.orbitSpeed > 0 ? -0.08 : 0.08) + Math.cos(m.wingPhase) * 0.025;
        m.layer = sinA < 0 ? "back" : "front";
        m.isFront = sinA >= 0;
      }
      void allReefs;
    }

    const drawLayerMantas = (wantLayer) => {
      for (let i = 0; i < mantas.length; i++) {
        const m = mantas[i];
        const mLayer = m.layer || "front";
        if (mLayer !== wantLayer) continue;
        // C1-continuous depth scaling & alpha across sinA = 0 (zero pop between back & front!)
        const depthT = (Math.sin(m.orbitAngle) + 1) * 0.5;
        const dScale = 0.74 + depthT * 0.34;
        const baseAlpha = pal.isDark ? 0.72 : 0.74;
        const mAlpha = baseAlpha + depthT * (0.98 - baseAlpha);
        this._drawCleaningManta(ctx, m, pal, step, dScale, mAlpha);
      }
    };

    const drawLayerReefWhips = (reefs, isBg) => {
      if (!reefs) return;
      reefs.forEach((rf, rIdx) => {
        const rSc = rf.scale || sc;
        ctx.save();
        ctx.translate(rf.x, rf.y);
        ctx.strokeStyle = pal.isDark
          ? `rgba(45, 212, 191, ${isBg ? "0.34" : "0.56"})`
          : `rgba(251, 146, 180, ${isBg ? "0.42" : "0.72"})`;
        ctx.lineWidth = Math.max(1.2, 2.0 * rSc);
        ctx.lineCap = "round";
        [-16, -5, 6, 17].forEach((wx, idx) => {
          const sway = Math.sin(step * 1.9 + idx * 1.3 + rIdx) * 4.5 * rSc;
          const wh = (14 + (idx % 2) * 5) * rSc;
          const baseY = -22 * rSc;
          ctx.beginPath();
          ctx.moveTo(wx * rSc, baseY + 4 * rSc);
          ctx.quadraticCurveTo((wx + 1) * rSc + sway * 0.5, baseY - wh * 0.5, wx * rSc + sway, baseY - wh);
          ctx.stroke();
        });
        if (pal.isDark) {
          const pGlow = (0.35 + 0.25 * Math.sin(step * 2.4 + rIdx)) * (isBg ? 0.65 : 1);
          ctx.fillStyle = `rgba(56, 224, 232, ${pGlow.toFixed(3)})`;
          [-14, 0, 14].forEach((px, idx) => {
            ctx.beginPath();
            ctx.arc(px * rSc, (-28 - (idx % 2) * 4) * rSc, 1.5 * rSc, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        ctx.restore();
      });
    };

    // 2. Step all Cleaner Wrasse & Clean Sparkles once per frame
    const getZoneOffset = (wr, m) => {
      const mLayer = m.layer || "front";
      const sp = m.span * (mLayer === "back" ? 0.80 : (m.isFront ? 1.04 : 0.88));
      const dir = m.facingLeft ? -1 : 1;
      const jitX = Math.cos(wr.id * 2.1) * sp * 0.09;
      const jitY = Math.sin(wr.id * 2.1) * sp * 0.08;
      if (wr.zone === "gill") return { x: sp * 0.10 * dir + jitX, y: sp * 0.15 + jitY };
      if (wr.zone === "cephalic") return { x: sp * 0.48 * dir + jitX * 0.5, y: -sp * 0.06 + jitY };
      if (wr.zone === "left_wing") return { x: -sp * 0.04 * dir + jitX, y: -sp * 0.42 + jitY };
      if (wr.zone === "right_wing") return { x: -sp * 0.02 * dir + jitX, y: sp * 0.42 + jitY };
      return { x: -sp * 0.18 * dir + jitX, y: sp * 0.12 + jitY };
    };

    if (shouldStep) {
      for (let i = 0; i < wrasses.length; i++) {
        const wr = wrasses[i];
        wr.wigglePhase += dt * (wr.state === "cleaning" ? 4.4 : 3.2);
        wr.timer -= dt;

        // Escort wrasse always accompany their manta continuously around BOTH back & front of the station plateau!
        if (wr.isEscort && mantas.length > 0) {
          const escM = mantas[wr.targetMantaIdx % mantas.length];
          wr.layer = escM.layer || "front";
          const off = getZoneOffset(wr, escM);
          const aimX = escM.x + off.x + Math.sin(step * 6.5 + wr.id * 1.9) * 3.5 * sc;
          const aimY = escM.y + off.y + Math.cos(step * 5.2 + wr.id) * 3.0 * sc;
          const dx = aimX - wr.x;
          const dy = aimY - wr.y;
          const dist = Math.hypot(dx, dy) || 1;
          const stepDist = Math.min(dist, 92 * sc * dt);
          wr.x += (dx / dist) * stepDist;
          wr.y += (dy / dist) * stepDist;
          wr.facingLeft = Math.abs(dx) > 1.2 ? (dx < 0) : escM.facingLeft;
          wr.pitch = this._clamp(dy / Math.max(12, Math.abs(dx)), -0.35, 0.35);
          wr.sparkleCd -= dt;
          if (wr.sparkleCd <= 0 && this.cleanSparkles.length < 22) {
            wr.sparkleCd = this._rand(0.65, 1.3);
            this.cleanSparkles.push({
              layer: wr.layer,
              x: wr.x,
              y: wr.y,
              r: (1.2 + Math.random() * 1.1) * sc,
              vy: -(4.0 + Math.random() * 4.0) * sc,
              life: 0,
              maxLife: 1.0
            });
          }
          continue;
        }

        // Reef-stationed wrasse lock dynamically onto the closest manta passing through their reef layer!
        let bestIdx = wr.targetMantaIdx;
        let bestDist = Infinity;
        for (let mi = 0; mi < mantas.length; mi++) {
          const cand = mantas[mi];
          if ((cand.layer || "front") !== (wr.layer || "front")) continue;
          const d = Math.hypot(cand.x - wr.homeX, cand.y - wr.homeY);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = mi;
          }
        }
        const tgtManta = bestDist < 260 * sc ? mantas[bestIdx] : null;
        wr.targetMantaIdx = bestIdx;

        let aimX = wr.homeX + Math.sin(step * 1.6 + wr.id) * 14 * sc;
        let aimY = wr.homeY - 10 * sc + Math.cos(step * 1.9 + wr.id) * 6 * sc;
        let spd = 28 * sc;

        if (wr.state === "reef_dance") {
          if (wr.timer <= 0 && tgtManta) {
            wr.state = "dart_to_manta";
            wr.timer = this._rand(2.0, 3.2);
          }
        } else if (wr.state === "dart_to_manta" && tgtManta) {
          const off = getZoneOffset(wr, tgtManta);
          aimX = tgtManta.x + off.x;
          aimY = tgtManta.y + off.y;
          spd = 74 * sc;
          if (Math.hypot(aimX - wr.x, aimY - wr.y) < 12 * sc || wr.timer <= 0) {
            wr.state = "cleaning";
            wr.timer = this._rand(2.6, 4.4);
          }
        } else if (wr.state === "cleaning" && tgtManta) {
          const off = getZoneOffset(wr, tgtManta);
          const peck = Math.sin(step * 8.0 + wr.id * 1.9) * 3.5 * sc;
          aimX = tgtManta.x + off.x + peck;
          aimY = tgtManta.y + off.y + Math.cos(step * 6.5 + wr.id) * 3.0 * sc;
          spd = 68 * sc;
          wr.sparkleCd -= dt;
          if (wr.sparkleCd <= 0 && this.cleanSparkles.length < 22) {
            wr.sparkleCd = this._rand(0.55, 1.15);
            this.cleanSparkles.push({
              layer: wr.layer || "front",
              x: wr.x,
              y: wr.y,
              r: (1.2 + Math.random() * 1.1) * sc,
              vy: -(4.0 + Math.random() * 4.0) * sc,
              life: 0,
              maxLife: 1.1
            });
          }
          if (wr.timer <= 0) {
            wr.state = "return_reef";
            wr.timer = this._rand(1.8, 3.0);
          }
        } else {
          aimX = wr.homeX;
          aimY = wr.homeY;
          spd = 56 * sc;
          if (Math.hypot(aimX - wr.x, aimY - wr.y) < 10 * sc || wr.timer <= 0) {
            wr.state = "reef_dance";
            wr.timer = this._rand(1.2, 2.8);
          }
        }

        const dx = aimX - wr.x;
        const dy = aimY - wr.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepDist = Math.min(dist, spd * dt);
        wr.x += (dx / dist) * stepDist;
        wr.y += (dy / dist) * stepDist;
        if (Math.abs(dx) > 0.6) {
          wr.facingLeft = dx < 0;
        }
        wr.pitch = this._clamp(dy / Math.max(12, Math.abs(dx)), -0.35, 0.35);
      }

      if (this.cleanSparkles.length > 0) {
        const aliveS = [];
        for (let i = 0; i < this.cleanSparkles.length; i++) {
          const sp = this.cleanSparkles[i];
          sp.life += dt;
          sp.y += sp.vy * dt;
          if (sp.life < sp.maxLife) aliveS.push(sp);
        }
        this.cleanSparkles = aliveS;
      }
    }

    // 3. Render requested layer ("back", "front", or "all")
    if (layer === "back" || layer === "all") {
      drawLayerMantas("back");
      drawLayerReefWhips(cs.backReefs, true);
      for (let i = 0; i < wrasses.length; i++) {
        if ((wrasses[i].layer || "front") === "back") {
          this._drawCleanerWrasse(ctx, wrasses[i], pal, step);
        }
      }
    }
    if (layer === "front" || layer === "all") {
      drawLayerReefWhips(cs.frontReefs || [cs], false);
      drawLayerMantas("front");
      for (let i = 0; i < wrasses.length; i++) {
        if ((wrasses[i].layer || "front") === "front") {
          this._drawCleanerWrasse(ctx, wrasses[i], pal, step);
        }
      }
    }

    if (this.cleanSparkles.length > 0) {
      ctx.save();
      for (let i = 0; i < this.cleanSparkles.length; i++) {
        const sp = this.cleanSparkles[i];
        const spLayer = sp.layer || "front";
        if (layer !== "all" && spLayer !== layer) continue;
        const a = (1 - sp.life / sp.maxLife) * (pal.isDark ? 0.78 : 0.68);
        ctx.fillStyle = `rgba(125, 211, 252, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _updateAndDrawAmbientParticles(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;

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

    if (this.sonarRings.length > 0) {
      const aliveR = [];
      ctx.save();
      for (let i = 0; i < this.sonarRings.length; i++) {
        const sr = this.sonarRings[i];
        sr.life += scaleDt;
        if (sr.life >= sr.maxLife) continue;
        aliveR.push(sr);
        const p = sr.life / sr.maxLife;
        const radius = sr.r + (sr.maxR - sr.r) * p;
        const a = (1 - p) * (pal.isDark ? 0.46 : 0.30);
        ctx.strokeStyle = `rgba(${pal.jellyRgb}, ${a.toFixed(3)})`;
        ctx.lineWidth = 1.6 * (1 - p * 0.6);
        ctx.beginPath();
        ctx.arc(sr.x, sr.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      this.sonarRings = aliveR;
    }
  }
};

window.WorldDeepBlue = WorldDeepBlue;
