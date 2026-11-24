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
  cacheKey: "",
  farLife: [],
  nearLife: [],
  fishSchools: [],
  sharks: [],
  whales: [],
  jellies: [],
  anglerFish: [],
  leviathan: null,
  kelp: [],
  snow: [],
  bubbles: [],
  divers: [],
  sub: null,          // Primary left-pier visiting submarine
  cargoSub: null,     // Primary right-pier visiting freighter/vessel
  roamingSubs: [],    // Multi-directional roaming visitor + background transit traffic
  elevator: null,     // Vertical surface supply elevator state
  rovs: [],
  sonarRings: [],
  _lastW: 0,
  _lastH: 0,

  SUB_STYLES: [
    "bathyscaphe",
    "crew_shuttle",
    "research_catamaran",
    "heavy_freighter",
    "manta_glider",
    "industrial_tug",
    "deep_explorer"
  ],

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
      { x: w * 0.78, y: L.seabedY - 44 },
      { x: w, y: L.seabedY - 16 },
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
    this.leviathan = null;
    this.kelp = [];
    this.snow = [];
    this.bubbles = [];
    this.divers = [];
    this.sub = null;
    this.cargoSub = null;
    this.roamingSubs = [];
    this.elevator = null;
    this.rovs = [];
    this.sonarRings = [];
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
        surfaceRipple: "rgba(34, 211, 238, 0.14)",
        rayColor: "34, 211, 238",
        rayAlpha: 0.06,
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

  getLayout(w, h) {
    const isNarrow = w < 720;
    const seabedY = h * (isNarrow ? 0.79 : 0.76);
    const hubX = w * (isNarrow ? 0.52 : 0.50);
    const hubY = h * (isNarrow ? 0.62 : 0.585);
    const s = isNarrow ? 0.52 : Math.min(1.06, Math.max(0.76, w / 1320));

    // Pre-fab horizontal station campus coordinates
    const westWingX = hubX - 246 * s;
    const westWingY = hubY + 46 * s;
    const farWestX = hubX - 388 * s;  // Hydropower Tidal Turbine Farm!
    const farWestY = hubY + 70 * s;

    const eastWingX = hubX + 250 * s; // East Sensor Wing & Rotating Sonar Relay
    const eastWingY = hubY + 46 * s;
    const farEastX = hubX + 392 * s;
    const farEastY = hubY + 68 * s;

    // Diver Wet-Lock Airlock Aperture on West Fabrication Wing + Hub Lower Lock
    const airlockX = westWingX + 12 * s;
    const airlockY = westWingY + 12 * s;

    // Rotating Sonar Relay Dish Pedestal on East Sensor Wing
    const sonarX = eastWingX + 18 * s;
    const sonarY = eastWingY - 36 * s;

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

    // Gentle realistic docking pier angles matching buoyant submarine trim
    const leftAngle = 2.94;
    const leftArmLen = 114 * s;
    const leftDockX = hubX - 18 * s + Math.cos(leftAngle) * leftArmLen;
    const leftDockY = hubY + 24 * s + Math.sin(leftAngle) * leftArmLen;

    const rightAngle = 0.20;
    const rightArmLen = 118 * s;
    const rightDockX = hubX + 20 * s + Math.cos(rightAngle) * rightArmLen;
    const rightDockY = hubY + 28 * s + Math.sin(rightAngle) * rightArmLen;

    // Geodesic Hydroponic Crop Greenhouse Dome (right-center terrace)
    const domeX = hubX + 106 * s;
    const domeY = hubY - 14 * s;

    // Vertical Surface Supply Elevator Shaft & Transfer Collar (left-rear terrace wing)
    const elevX = hubX - 92 * s;
    const elevDockY = hubY - 38 * s;

    return {
      isNarrow, seabedY, hubX, hubY, s,
      westWingX, westWingY, farWestX, farWestY,
      eastWingX, eastWingY, farEastX, farEastY,
      airlockX, airlockY, sonarX, sonarY, hydroTurbines,
      leftAngle, leftArmLen, leftDockX, leftDockY,
      rightAngle, rightArmLen, rightDockX, rightDockY,
      domeX, domeY, elevX, elevDockY
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

    // 1. Vertical depth-graded ocean water column
    const waterGrad = ctx.createLinearGradient(0, 0, 0, h);
    waterGrad.addColorStop(0, pal.waterTop);
    waterGrad.addColorStop(0.46, pal.waterMid);
    waterGrad.addColorStop(1, pal.waterBottom);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Ocean surface ceiling band
    ctx.save();
    const surfG = ctx.createLinearGradient(0, 0, 0, 60);
    surfG.addColorStop(0, pal.surfaceRipple);
    surfG.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = surfG;
    ctx.fillRect(0, 0, w, 60);
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
    ctx.quadraticCurveTo(w * 0.78, L.seabedY - 44, w, L.seabedY - 16);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle sand ripple ridges across shallow canyon floor
    ctx.strokeStyle = pal.waterBounce;
    ctx.globalAlpha = pal.isDark && !pal.isGoldenCoastal ? 0.08 : 0.16;
    ctx.lineWidth = 1.2;
    for (let row = 0; row < 6; row++) {
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
    for (let b = 0; b < (L.isNarrow ? 18 : 34); b++) {
      const bx = w * (0.06 + (b * 0.028) % 0.88);
      const minY = this._seabedYAtX(bx, w, h, L) + 8;
      const by = minY + ((b * 37) % Math.max(20, (h - minY - 10)));
      const br = 6 + (b % 5) * 5.0;
      ctx.fillStyle = b % 2 === 0 ? pal.reefMid : pal.seabedDark;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.6, br * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Armored benthic power cable conduit running cleanly across seabed from Hydropower Farm into West Wing
    ctx.globalAlpha = 0.82;
    ctx.strokeStyle = pal.hullDark;
    ctx.lineWidth = 3.2 * L.s;
    ctx.beginPath();
    ctx.moveTo(L.hydroTurbines[0].x, L.hydroTurbines[0].y + 12 * L.s);
    ctx.quadraticCurveTo((L.hydroTurbines[0].x + L.westWingX) * 0.5, L.seabedY - 6, L.westWingX - 42 * L.s, L.westWingY + 26 * L.s);
    ctx.stroke();
    ctx.restore();

    // 5. Industrial Pre-Fab Modular Seabed Research Station + Hydropower Farm + Clear Tubes + Greenhouse
    this._drawResearchStation(ctx, L, pal);

    // 6. Lush Ground-Anchored Benthic Coral Reefs, Plate Corals, Sea Fans, Sponges & Hydrothermal Chimneys
    this._drawSeabedReefs(ctx, w, h, L, pal);
    const floorSpots = L.isNarrow ? [0.24, 0.76] : [0.20, 0.30, 0.71, 0.81];
    floorSpots.forEach((xf, idx) => {
      const fx = w * xf;
      const fy = Math.min(h - 14, this._seabedYAtX(fx, w, h, L) + 18 + (idx % 3) * 18);
      this._drawBenthicSpongeCluster(ctx, fx, fy, (10 + (idx % 3) * 3) * L.s, pal);
    });

    // Hydrothermal basalt vent mounds on canyon outskirts
    [w * 0.19, w * 0.81].forEach((vx, idx) => {
      if (L.isNarrow && idx === 1) return;
      const vy = this._seabedYAtX(vx, w, h, L) + 12;
      ctx.save();
      ctx.fillStyle = pal.reefNear;
      ctx.beginPath();
      ctx.moveTo(vx - 14 * L.s, vy + 8 * L.s);
      ctx.lineTo(vx - 5 * L.s, vy - 18 * L.s);
      ctx.lineTo(vx + 5 * L.s, vy - 18 * L.s);
      ctx.lineTo(vx + 16 * L.s, vy + 8 * L.s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 7. Framing Foreground Coral Cliffs & Strictly Ground-Anchored Reef Corals
    ctx.save();
    ctx.fillStyle = pal.reefNear;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.67);
    ctx.quadraticCurveTo(w * 0.06, h * 0.72, w * 0.14, h * 0.82);
    ctx.quadraticCurveTo(w * 0.22, h * 0.90, w * 0.30, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h * 0.66);
    ctx.quadraticCurveTo(w * 0.93, h * 0.73, w * 0.86, h * 0.84);
    ctx.quadraticCurveTo(w * 0.78, h * 0.92, w * 0.70, h);
    ctx.closePath();
    ctx.fill();

    // Plant every foreground coral root 7px deeper than _cliffYAtX so ZERO floating!
    [0.05, 0.11, 0.17, 0.23, 0.77, 0.83, 0.90, 0.95].forEach((cf, idx) => {
      const cx = w * cf;
      const cy = (this._cliffYAtX(cx, w, h) || h * 0.85) + 7;
      this._drawCoralCluster(ctx, cx, cy, 17 + (idx % 3) * 4, pal.reefNear);
    });
    ctx.restore();
  },

  // Rich Ground-Anchored Seabed Reef Terraces, Staghorn Branches, Plate Corals & Sea Fans
  _drawSeabedReefs(ctx, w, h, L, pal) {
    const s = L.s;
    const spots = L.isNarrow
      ? [0.09, 0.18, 0.27, 0.73, 0.83, 0.92]
      : [0.07, 0.14, 0.22, 0.29, 0.36, 0.66, 0.74, 0.82, 0.89, 0.95];

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

  // 2.5D Extruded Modular Hexagonal Hard-Sci-Fi + Biophilic Habitat Pod
  _drawHexModule(ctx, cx, cy, rx, ry, height, pal, s, opts = {}) {
    const verts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      verts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    const wallOrder = [
      { i0: 2, i1: 3, shade: pal.hullLight },
      { i0: 1, i1: 2, shade: pal.hullMid },
      { i0: 0, i1: 1, shade: pal.hullDark }
    ];

    ctx.save();
    // Seabed / plinth cast shadow
    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(cx + 6 * s, cy + height + ry * 0.3, rx * 1.12, ry * 1.05, 0, 0, Math.PI * 2);
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

  // Rotating Sonar & Acoustic Communications Dish Relay on East Sensor Wing
  _drawSonarRelay(ctx, L, pal) {
    const s = L.s;
    const sx = L.sonarX;
    const sy = L.sonarY;
    ctx.save();
    // Polygonal rotary base collar
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(sx - 6.5 * s, sy - 6 * s, 13 * s, 10 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(sx - 5 * s, sy - 9 * s, 10 * s, 3 * s);
    ctx.restore();
  },

  _updateAndDrawSonarArray(ctx, L, pal, step) {
    const s = L.s;
    const sx = L.sonarX;
    const sy = L.sonarY - 12 * s;
    const sweep = Math.sin(step * 0.9) * 0.85;

    ctx.save();
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

  _drawResearchStation(ctx, L, pal) {
    const s = L.s;
    const hx = L.hubX;
    const hy = L.hubY;
    const seabedBaseY = L.seabedY + 20 * s;

    // 0. Far-West Hydropower Tidal Turbine Farm & Far-East Depth-Hazed Outpost
    this._drawHydropowerFarm(ctx, L, pal);
    if (!L.isNarrow) {
      this._drawClearGlassTube(ctx, L.eastWingX + 52 * s, L.eastWingY + 4 * s, L.farEastX - 28 * s, L.farEastY + 2 * s, 11.5 * s, s, pal, { depthAlpha: 0.78 });
      this._drawSatelliteWing(ctx, L.farEastX, L.farEastY, seabedBaseY + 6 * s, pal, s, { kind: "pod", haze: 0.24 });
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

    // 8. Twin Foreground Radiating Pressurized Submarine Docking Piers
    this._drawPressurizedTunnel(ctx, hx - 20 * s, hy + 24 * s, L.leftDockX, L.leftDockY, 22 * s, s, pal);
    this._drawPressurizedTunnel(ctx, hx + 20 * s, hy + 28 * s, L.rightDockX, L.rightDockY, 25 * s, s, pal);

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

    // Front-Right Grounded Hexagonal ROV Launch Pad
    ctx.translate(46 * s, 44 * s);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-26 * s, 0, 52 * s, 14 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const vx = Math.cos(a) * 28 * s;
      const vy = Math.sin(a) * 12 * s;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.trimGold;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * s, 6 * s, 0, 0, Math.PI * 2);
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
      const floorXs = isNarrow ? [0.36, 0.64] : [0.21, 0.34, 0.66, 0.79];

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

    // 2. True Whales gliding across deep background lanes
    if (this.whales.length === 0) {
      this.whales = [
        { x: w * 0.22, y: h * 0.20, vx: 0.20, len: isNarrow ? 74 : 112, depth: 0.26, phase: 0 },
        { x: w * 0.86, y: h * 0.14, vx: -0.16, len: isNarrow ? 62 : 90, depth: 0.18, phase: 2.4 }
      ];
    }

    // 3. Sharks: Great Whites, Hammerheads, Whale Sharks
    if (this.sharks.length === 0) {
      this.sharks = [
        { species: "great_white", x: w * 0.30, y: h * 0.25, vx: 0.56, size: isNarrow ? 27 : 37, depth: 0.56, phase: 0.4 },
        { species: "great_white", x: w * 0.39, y: h * 0.21, vx: 0.49, size: isNarrow ? 23 : 30, depth: 0.44, phase: 1.9 },
        { species: "hammerhead", x: w * 0.72, y: h * 0.30, vx: -0.62, size: isNarrow ? 25 : 34, depth: 0.64, phase: 1.1 },
        { species: "whale_shark", x: w * 0.14, y: h * 0.15, vx: 0.32, size: isNarrow ? 44 : 62, depth: 0.48, phase: 2.8 }
      ];
    }

    // 4. Synchronized Undulating Coastal Fish Schools!
    if (this.fishSchools.length === 0) {
      const schoolSpecs = isNarrow
        ? [
            { x: w * 0.18, y: h * 0.28, vx: 0.52, depth: 0.44, count: 14, spread: 42 },
            { x: w * 0.78, y: h * 0.20, vx: -0.44, depth: 0.36, count: 14, spread: 38 }
          ]
        : [
            { x: w * 0.16, y: h * 0.29, vx: 0.56, depth: 0.46, count: 24, spread: 64 },
            { x: w * 0.72, y: h * 0.17, vx: -0.48, depth: 0.34, count: 26, spread: 72 },
            { x: w * 0.42, y: h * 0.12, vx: 0.36, depth: 0.24, count: 20, spread: 56 },
            { x: w * 0.85, y: h * 0.38, vx: -0.62, depth: 0.60, count: 18, spread: 52 }
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
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.farLife.push({
          kind: "manta",
          depth: 0.36 + i * 0.14,
          x: w * (0.15 + i * 0.35),
          y: h * (0.18 + i * 0.08),
          vx: (i % 2 === 0 ? -1 : 1) * (0.40 + Math.random() * 0.22),
          span: 24 + i * 9,
          phase: Math.random() * Math.PI * 2
        });
      }
      const schoolCount = isNarrow ? 10 : 18;
      for (let i = 0; i < schoolCount; i++) {
        const rightGroup = i >= schoolCount * 0.55;
        this.farLife.push({
          kind: "fish",
          depth: 0.28 + (i % 4) * 0.09,
          x: (rightGroup ? w * 0.68 : w * 0.08) + (i % 8) * 18 + (Math.random() - 0.5) * 24,
          y: (rightGroup ? h * 0.14 : h * 0.27) + (Math.random() - 0.5) * 60,
          vx: (rightGroup ? -1 : 1) * (0.52 + Math.random() * 0.26),
          size: 4.0 + Math.random() * 2.4,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.nearLife.length === 0) {
      for (let i = 0; i < (isNarrow ? 6 : 12); i++) {
        const dir = i < 6 ? 1 : -1;
        this.nearLife.push({
          depth: 0.72 + Math.random() * 0.28,
          x: Math.random() * w,
          y: h * (0.56 + Math.random() * 0.30),
          vx: dir * (0.76 + Math.random() * 0.48),
          size: 6 + Math.random() * 3.2,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.jellies.length === 0) {
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.jellies.push({
          x: w * (0.12 + i * 0.34),
          y: h * (0.30 + Math.random() * 0.36),
          vy: -(0.12 + Math.random() * 0.10),
          size: 8 + Math.random() * 4.5,
          phase: Math.random() * Math.PI * 2,
          depth: 0.55 + Math.random() * 0.35
        });
      }
    }

    if (this.snow.length === 0) {
      const count = isNarrow ? 22 : 44;
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

    // 5. To-Scale Human Maintenance Divers Entering & Exiting Station Airlocks!
    if (this.divers.length === 0) {
      const dTargets = [
        { tx: L.hubX - 148 * s, ty: L.hubY + 24 * s },
        { tx: L.hydroTurbines[0].x + 14 * s, ty: L.hydroTurbines[0].y + 4 * s },
        { tx: L.westWingX + 54 * s, ty: L.westWingY + 6 * s }
      ];
      const count = isNarrow ? 2 : 3;
      for (let i = 0; i < count; i++) {
        this.divers.push({
          id: `diver_${i + 1}`,
          phase: i === 0 ? "swim_to_site" : (i === 1 ? "weld_inspect" : "inside_airlock"),
          t: i === 0 ? 1.5 : 0,
          dist: i === 0 ? 28 : 0,
          phaseDuration: this._rand(5.0, 9.0),
          targetPt: dTargets[i],
          path: null,
          x: i === 1 ? dTargets[1].tx : L.airlockX,
          y: i === 1 ? dTargets[1].ty : L.airlockY,
          facingLeft: dTargets[i].tx < L.airlockX,
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

    // 7. Left-Pier Visiting Submarine (varied from all 7 cohesive designs)
    if (!this.sub) {
      const dirX = Math.cos(L.leftAngle);
      const dirY = Math.sin(L.leftAngle);
      const holdPt = { x: L.leftDockX + dirX * (130 * s), y: L.leftDockY + dirY * (130 * s) };
      this.sub = {
        style: "deep_explorer",
        phase: "approaching",
        t: 0,
        dist: 120,
        speed: 17.5,
        cruiseSpeed: 18.0,
        corridor: "mid_cruise",
        entryX: -150,
        entryY: h * 0.48,
        x: -10,
        y: h * 0.52,
        facingLeft: false,
        pitch: 0.04,
        heading: 0.04,
        path: null
      };
      this._assignCorridorEndpoints(this.sub, "left", w, h, L);
      this.sub.path = this._buildSubPath(
        { x: this.sub.entryX, y: this.sub.entryY },
        holdPt,
        { x: (this.sub.entryX + holdPt.x) * 0.45, y: this.sub.entryY },
        { x: holdPt.x - 85 * s, y: holdPt.y + 12 * s }
      );
      this.sub.dist = Math.min(this.sub.path.totalLen * 0.35, 160);
    }

    // 8. Right-Pier Modular Cargo / Tug Submarine
    if (!this.cargoSub) {
      const dirX = Math.cos(L.rightAngle);
      const dirY = Math.sin(L.rightAngle);
      this.cargoSub = {
        style: "heavy_freighter",
        phase: "docked",
        t: 0,
        dist: 0,
        speed: 0,
        cruiseSpeed: 14.0,
        phaseDuration: this._rand(10.0, 16.0),
        corridor: "mid_cruise",
        exitX: w + 170,
        exitY: L.rightDockY + 30,
        x: L.rightDockX + dirX * (66 * s),
        y: L.rightDockY + dirY * (66 * s),
        facingLeft: true,
        pitch: -0.20,
        heading: L.rightAngle + Math.PI,
        path: null
      };
      this._assignCorridorEndpoints(this.cargoSub, "right", w, h, L);
    }

    // 9. Extra Multi-Directional Roaming Submarines
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
          style: "manta_glider",
          phase: "patrol_in",
          t: 0,
          dist: visitorPath.totalLen * 0.32,
          speed: 15.0,
          cruiseSpeed: 15.5,
          phaseDuration: this._rand(6.0, 11.0),
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
          style: "industrial_tug",
          phase: "cruising",
          t: 4.5,
          dist: 240,
          speed: 13.5,
          cruiseSpeed: 13.5,
          phaseDuration: this._rand(22.0, 30.0),
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

    // 10. 3 Maintenance ROVs
    if (this.rovs.length === 0) {
      this.rovs = [
        {
          waypoints: [
            { x: 0.26, y: 0.72, beamAngle: 0.55 },
            { x: 0.35, y: 0.77, beamAngle: 0.35 },
            { x: 0.22, y: 0.65, beamAngle: 0.74 },
            { x: 0.31, y: 0.64, beamAngle: 0.24 }
          ],
          wpIdx: 0, x: w * 0.28, y: h * 0.71, beamAngle: 0.55, pauseTimer: this._rand(2.2, 4.8), phase: 0
        },
        {
          waypoints: [
            { x: 0.76, y: 0.42, beamAngle: 2.38 },
            { x: 0.69, y: 0.36, beamAngle: 2.52 },
            { x: 0.82, y: 0.47, beamAngle: 2.25 }
          ],
          wpIdx: 0, x: w * 0.77, y: h * 0.41, beamAngle: 2.40, pauseTimer: this._rand(2.2, 4.8), phase: 1.4
        },
        {
          waypoints: [
            { x: 0.74, y: 0.83, beamAngle: 2.72 },
            { x: 0.64, y: 0.85, beamAngle: 2.52 },
            { x: 0.79, y: 0.78, beamAngle: 2.90 }
          ],
          wpIdx: 0, x: w * 0.74, y: h * 0.83, beamAngle: 2.72, pauseTimer: this._rand(2.4, 5.2), phase: 2.7
        }
      ];
    }

    // 11. Deep-Sea Abyssal Angler Fish with Glowing Bioluminescent Esca Lures
    if (this.anglerFish.length === 0) {
      this.anglerFish = isNarrow
        ? [
            { x: w * 0.16, y: h * 0.58, vx: 0.26, size: 17, phase: 0.3, depth: 0.74 },
            { x: w * 0.84, y: h * 0.76, vx: -0.22, size: 15, phase: 2.1, depth: 0.80 }
          ]
        : [
            { x: w * 0.14, y: h * 0.57, vx: 0.28, size: 22, phase: 0.3, depth: 0.74 },
            { x: w * 0.86, y: h * 0.74, vx: -0.25, size: 20, phase: 2.0, depth: 0.82 },
            { x: w * 0.32, y: h * 0.82, vx: 0.20, size: 18, phase: 4.1, depth: 0.68 }
          ];
    }

    // 12. Infrequent Colossal Background Serpentine Leviathan
    if (!this.leviathan) {
      this.leviathan = {
        phase: "dormant_wait",
        t: 20.0,
        phaseDuration: 34.0,
        dir: 1,
        x: -360,
        y: h * 0.22,
        speed: 22.0,
        length: isNarrow ? 260 : 420,
        swimPhase: 0
      };
    }
  },

  pulseActivity({ kind = "complete", x = null, y = null } = {}) {
    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const rx = (typeof x === "number" && isFinite(x)) ? x : w * 0.5;
    const ry = (typeof y === "number" && isFinite(y)) ? y : h * 0.45;
    const isMajor = kind === "queue_clear" || kind === "finalise";

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

    if (this.sub && this.sub.phase === "docked" && this.sub.t > 1.2) {
      this.sub.phase = "undocking";
      this.sub.t = 0;
      this.sub.dist = 0;
      this.sub.speed = 0;
    } else if (this.cargoSub && this.cargoSub.phase === "docked" && this.cargoSub.t > 1.2) {
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

  draw(ctx, w, h, mode, dt, step) {
    // Reset terrain-dependent foliage & diver coordinates cleanly on desktop <-> mobile resize
    if (this._lastW && Math.abs(this._lastW - w) > 20) {
      this.kelp = [];
      this.divers = [];
    }
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached water, grounded pre-fab complex, hydropower farm & benthic terrain
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Animated Ocean Surface Shimmer, Slanted Sunbeams & Dynamic Seabed Caustics!
    this._drawSurfaceShimmer(ctx, w, pal, step);
    if (pal.rayAlpha > 0.05) {
      this._drawGodRays(ctx, w, h, pal, step, mode);
    }
    this._drawSeabedCaustics(ctx, w, h, L, pal, step, mode);

    // 3. Distant Abyssal Leviathan, Far-Depth Megafauna, Undulating Fish Schools & Background Transit Submarines
    this._updateAndDrawLeviathan(ctx, w, h, pal, dt, step);
    this._updateAndDrawWhales(ctx, w, h, pal, dt);
    this._updateAndDrawSharks(ctx, w, h, pal, dt);
    this._updateAndDrawFishSchools(ctx, w, h, pal, dt);
    this._updateAndDrawFarLife(ctx, w, h, pal, dt);
    this._updateAndDrawExtraSubs(ctx, w, h, L, pal, dt, step);

    // 4. Live Rotating Hydropower Turbines, Spinning Sonar Array, Beacons, Strobes & Supply Elevator
    this._updateAndDrawTurbines(ctx, L, pal, step);
    this._updateAndDrawSonarArray(ctx, L, pal, step);
    this._drawStationBeacons(ctx, L, pal, step);
    this._updateAndDrawSupplyElevator(ctx, L, pal, dt, step);

    // 5. To-Scale Human Maintenance Divers Cycling In/Out of Station Wet-Lock Airlock!
    this._updateAndDrawDivers(ctx, L, pal, dt, step);

    // 6. Left-Pier & Right-Pier Arc-Length Buoyant-Trim Docking Submarines
    this._updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step);

    // 7. 3 Maintenance ROVs with Volumetric Spotlights + Deep-Sea Angler Fish with Esca Lures
    this._updateAndDrawROVs(ctx, w, h, pal, dt, step);
    this._updateAndDrawAnglerFish(ctx, w, h, L, pal, dt, step);

    // 8. Ground-Anchored Swinging Kelp, Foreground Reef Fish & Bioluminescent Jellyfish
    this._drawAnchoredKelp(ctx, pal, step);
    this._updateAndDrawNearLife(ctx, w, h, pal, dt);

    // 9. Rising Bubbles, Hydrothermal Vent Plumes, Marine Snow & Reactive Sonar Rings
    this._updateAndDrawVentBubbles(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawAmbientParticles(ctx, w, h, pal, dt);
  },

  // Dynamic interconnected undulating water caustic ribbons dancing along sandy seabed & flat hex roofs
  _drawSeabedCaustics(ctx, w, h, L, pal, step, mode) {
    if (mode === "dark") return;
    const isGolden = mode === "evening";
    const baseAlpha = isGolden ? 0.16 : (mode === "morning" ? 0.19 : 0.14);
    const rgb = isGolden ? "255, 224, 158" : "205, 250, 255";
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";

    // Soft glowing wave-interference caustic patches & fluid organic light ribbons across seabed sand
    const rows = w < 720 ? 3 : 4;
    for (let r = 0; r < rows; r++) {
      const yBase = L.seabedY + 18 + r * 28;
      if (yBase > h - 10) break;

      ctx.strokeStyle = `rgba(${rgb}, ${(baseAlpha * 0.85).toFixed(3)})`;
      ctx.lineWidth = 1.6 - r * 0.18;
      ctx.beginPath();
      for (let x = w * 0.08; x <= w * 0.92; x += 24) {
        const wy = yBase + Math.sin(x * 0.020 + step * 1.1 + r * 1.8) * 6.5 + Math.cos(x * 0.042 - step * 0.85) * 3.5;
        if (x === w * 0.08) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();

      // Secondary counter-phase caustic ribbon forming organic cellular intersections (zero rigid circles)
      ctx.strokeStyle = `rgba(${rgb}, ${(baseAlpha * 0.60).toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let x = w * 0.10; x <= w * 0.90; x += 26) {
        const wy = yBase + Math.cos(x * 0.025 - step * 0.95 + r * 1.3) * 6.0 + Math.sin(x * 0.051 + step * 0.65) * 2.8;
        if (x === w * 0.10) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();

      // Soft sun-dapple pools at interference crests
      for (let c = 0; c < (w < 720 ? 3 : 5); c++) {
        const px = w * (0.16 + c * 0.17) + Math.sin(step * 0.6 + c * 2.1 + r) * 18;
        const py = yBase + Math.cos(step * 0.8 + c * 1.4) * 4;
        const cg = ctx.createRadialGradient(px, py, 0, px, py, 26);
        cg.addColorStop(0, `rgba(${rgb}, ${(baseAlpha * 0.52).toFixed(3)})`);
        cg.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(px, py, 26, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Subtly dappled caustic shimmer highlights onto flat station hex & wing roofs
    const roofTargets = [
      { x: L.hubX, y: L.hubY - 18 * L.s, rx: 46 * L.s },
      { x: L.hubX - 62 * L.s, y: L.hubY - 6 * L.s, rx: 28 * L.s },
      { x: L.hubX + 62 * L.s, y: L.hubY - 4 * L.s, rx: 28 * L.s },
      { x: L.westWingX, y: L.westWingY - 12 * L.s, rx: 32 * L.s },
      { x: L.eastWingX, y: L.eastWingY - 16 * L.s, rx: 32 * L.s }
    ];
    ctx.strokeStyle = `rgba(${rgb}, ${(baseAlpha * 0.82).toFixed(3)})`;
    ctx.lineWidth = 1.15;
    roofTargets.forEach((rt, idx) => {
      const dx = Math.sin(step * 0.9 + idx * 1.7) * 6;
      ctx.beginPath();
      ctx.moveTo(rt.x - rt.rx * 0.55 + dx, rt.y);
      ctx.quadraticCurveTo(rt.x + dx, rt.y - 3 * L.s, rt.x + rt.rx * 0.55 + dx, rt.y);
      ctx.stroke();
    });
    ctx.restore();
  },

  // Gentle hydrothermal vent bubble emission from canyon basalt chimneys
  _updateAndDrawVentBubbles(ctx, w, h, L, pal, dt, step) {
    if (Math.random() < 0.28) {
      const ventXs = L.isNarrow ? [w * 0.19] : [w * 0.19, w * 0.81];
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

  _drawSurfaceShimmer(ctx, w, pal, step) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 0.082 + Math.sin(step * 0.35 + i) * 0.015) % 1) * w;
      const sy = 5 + (i % 3) * 7 + Math.sin(step * 1.1 + i * 1.7) * 2.5;
      const len = 28 + (i % 4) * 16;
      const a = (0.14 + 0.14 * Math.sin(step * 1.3 + i)) * (pal.isDark && !pal.isGoldenCoastal ? 0.55 : 0.92);
      ctx.strokeStyle = pal.surfaceRipple;
      ctx.globalAlpha = Math.max(0.04, a);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx - len * 0.5, sy);
      ctx.lineTo(sx + len * 0.5, sy);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawGodRays(ctx, w, h, pal, step, mode) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const slant = mode === "evening" ? 0.46 : (mode === "morning" ? 0.36 : 0.28);
    const rayCount = w < 720 ? 5 : 7;
    for (let i = 0; i < rayCount; i++) {
      const baseX = (w * (0.04 + i * (0.58 / rayCount))) + Math.sin(step * 0.5 + i * 1.3) * 28;
      const topW = 24 + (i % 3) * 18;
      const botW = topW * 3.3;
      const rayH = h * (mode === "evening" ? 0.84 : (0.68 + (i % 2) * 0.18));
      const pulse = 0.65 + 0.35 * Math.sin(step * 0.85 + i * 2.0);

      const g = ctx.createLinearGradient(baseX, 0, baseX + rayH * slant, rayH);
      g.addColorStop(0, `rgba(${pal.rayColor}, ${(pal.rayAlpha * pulse).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(${pal.rayColor}, ${(pal.rayAlpha * 0.34 * pulse).toFixed(3)})`);
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
    // Crisp periodic double-flash strobe envelope for hard-sci-fi underwater navigation!
    const strobeAt = (offset) => {
      const c = ((step + offset) % 2.4);
      if (c < 0.09) return 1.0;
      if (c > 0.20 && c < 0.29) return 0.92;
      return 0.0;
    };
    ctx.save();

    const mastX = L.hubX;
    const mastY = L.hubY - 110 * s;
    const mastStrobe = strobeAt(0);
    const mg = ctx.createRadialGradient(mastX, mastY, 0, mastX, mastY, (13 + mastStrobe * 10) * s);
    mg.addColorStop(0, mastStrobe > 0.2 ? `rgba(255, 255, 255, 0.96)` : `rgba(248, 113, 113, ${(0.45 + 0.55 * pulse).toFixed(3)})`);
    mg.addColorStop(0.35, `rgba(248, 113, 113, ${(0.52 + mastStrobe * 0.42).toFixed(3)})`);
    mg.addColorStop(1, "rgba(248, 113, 113, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mastX, mastY, (13 + mastStrobe * 10) * s, 0, Math.PI * 2);
    ctx.fill();

    // Multi-point station navigation strobes on hex corners, wings, hydro farm, elevator tower & sonar!
    const strobePts = [
      { x: L.westWingX - 28 * s, y: L.westWingY - 40 * s, off: 0.4, rgb: "125, 240, 255" },
      { x: L.sonarX, y: L.sonarY - 18 * s, off: 0.9, rgb: "56, 189, 248" },
      { x: L.hubX - 62 * s, y: L.hubY - 22 * s, off: 1.3, rgb: "186, 236, 252" },
      { x: L.hubX + 62 * s, y: L.hubY - 20 * s, off: 1.8, rgb: "186, 236, 252" },
      { x: L.elevX, y: L.elevDockY - 38 * s, off: 0.6, rgb: "253, 224, 152" },
      { x: L.hydroTurbines[0].x, y: L.hydroTurbines[0].y - 38 * s, off: 2.1, rgb: "56, 189, 248" }
    ];
    strobePts.forEach(pt => {
      const fl = strobeAt(pt.off);
      const r = (7 + fl * 9) * s;
      const a = 0.24 + fl * 0.72;
      const wg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      wg.addColorStop(0, fl > 0.2 ? `rgba(255, 255, 255, ${a.toFixed(3)})` : `rgba(${pt.rgb}, ${(a * 0.7).toFixed(3)})`);
      wg.addColorStop(0.42, `rgba(${pt.rgb}, ${(a * 0.55).toFixed(3)})`);
      wg.addColorStop(1, `rgba(${pt.rgb}, 0)`);
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Crisp starburst cross-flare during strobe flash peak
      if (fl > 0.3) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.72 * fl).toFixed(3)})`;
        ctx.lineWidth = 1.0 * s;
        ctx.beginPath();
        ctx.moveTo(pt.x - 6 * s, pt.y);
        ctx.lineTo(pt.x + 6 * s, pt.y);
        ctx.moveTo(pt.x, pt.y - 6 * s);
        ctx.lineTo(pt.x, pt.y + 6 * s);
        ctx.stroke();
      }
    });

    const bays = [
      { x: L.leftDockX, y: L.leftDockY, active: this.sub && this.sub.phase !== "patrol_wait" },
      { x: L.rightDockX, y: L.rightDockY, active: this.cargoSub && this.cargoSub.phase !== "patrol_wait" },
      { x: L.elevX, y: L.elevDockY - 4 * s, active: this.elevator && this.elevator.phase === "docked_station" }
    ];
    bays.forEach(bay => {
      const rgb = bay.active ? "52, 211, 153" : "56, 189, 248";
      const a = bay.active ? (0.46 + 0.38 * pulse) : (0.24 + 0.20 * pulse);
      const dg = ctx.createRadialGradient(bay.x, bay.y, 0, bay.x, bay.y, 14 * s);
      dg.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
      dg.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(bay.x, bay.y, 14 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  // To-Scale Human Maintenance Divers Cycling Through Wet-Lock Airlock!
  _updateAndDrawDivers(ctx, L, pal, dt, step) {
    const s = L.s;
    const lockPt = { x: L.airlockX, y: L.airlockY };
    const exitPt = { x: L.airlockX + 6 * s, y: L.airlockY + 18 * s };

    for (let i = 0; i < this.divers.length; i++) {
      const d = this.divers[i];
      d.t += dt;
      d.kickPhase += dt * 7.5;
      let visible = false;
      let welding = false;

      if (d.phase === "inside_airlock") {
        d.x = lockPt.x;
        d.y = lockPt.y;
        if (d.t >= d.phaseDuration) {
          d.phase = "airlock_exit";
          d.t = 0;
          d.phaseDuration = 2.6;
          // Burst of decompression air bubbles from wet-lock chamber!
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
        }
      } else if (d.phase === "airlock_exit") {
        visible = true;
        const p = Math.min(1, d.t / d.phaseDuration);
        d.x = this._lerp(lockPt.x, exitPt.x, p);
        d.y = this._lerp(lockPt.y, exitPt.y, p);
        d.facingLeft = d.targetPt.x < d.x;
        if (d.t >= d.phaseDuration) {
          d.path = this._buildArcPath([{
            type: "cubic",
            p0: exitPt,
            p1: { x: exitPt.x, y: exitPt.y + 18 * s },
            p2: { x: d.targetPt.x + (d.facingLeft ? 18 : -18) * s, y: d.targetPt.y - 6 * s },
            p3: d.targetPt
          }], 18);
          d.phase = "swim_to_site";
          d.dist = 0;
          d.t = 0;
        }
      } else if (d.phase === "swim_to_site") {
        visible = true;
        if (!d.path) {
          d.path = this._buildArcPath([{
            type: "cubic",
            p0: exitPt,
            p1: { x: exitPt.x, y: exitPt.y + 18 * s },
            p2: { x: d.targetPt.x + 15 * s, y: d.targetPt.y - 6 * s },
            p3: d.targetPt
          }], 18);
        }
        d.dist += 11.0 * dt;
        const pt = this._sampleArcPath(d.path, d.dist);
        d.x = pt.x;
        d.y = pt.y + Math.sin(d.kickPhase * 0.5) * 1.2 * s;
        d.facingLeft = pt.dx < 0;
        if (d.dist >= d.path.totalLen) {
          d.phase = "weld_inspect";
          d.t = 0;
          d.phaseDuration = this._rand(7.0, 12.0);
        }
      } else if (d.phase === "weld_inspect") {
        visible = true;
        welding = true;
        d.x = d.targetPt.x + Math.sin(step * 1.2 + i) * 2.5 * s;
        d.y = d.targetPt.y + Math.cos(step * 1.5 + i) * 2.0 * s;
        d.facingLeft = d.targetPt.x > L.hubX;
        if (d.t >= d.phaseDuration) {
          d.path = this._buildArcPath([{
            type: "cubic",
            p0: { x: d.x, y: d.y },
            p1: { x: d.x, y: d.y + 14 * s },
            p2: { x: exitPt.x, y: exitPt.y + 16 * s },
            p3: exitPt
          }], 18);
          d.phase = "swim_back";
          d.dist = 0;
          d.t = 0;
        }
      } else if (d.phase === "swim_back") {
        visible = true;
        d.dist += 10.5 * dt;
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
          d.phaseDuration = this._rand(6.0, 14.0);
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

      // Draw Tiny Realistic To-Scale Human Diver (~10-12px total length!)
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.facingLeft) ctx.scale(-1, 1);
      ctx.scale(s * 0.92, s * 0.92);

      // Crisp Helmet Headlamp Volumetric Cone + Welding Torch Arc Sparks
      const beamAlpha = pal.isDark ? 0.44 : 0.24;
      const hb = ctx.createLinearGradient(5, -1, 28, 0);
      hb.addColorStop(0, `rgba(224, 247, 250, ${beamAlpha})`);
      hb.addColorStop(1, "rgba(224, 247, 250, 0)");
      ctx.fillStyle = hb;
      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.lineTo(28, -7);
      ctx.lineTo(28, 6);
      ctx.lineTo(5, 0);
      ctx.closePath();
      ctx.fill();

      // Wetsuit torso & scuba tank
      ctx.fillStyle = "#1E293B";
      ctx.beginPath();
      ctx.roundRect(-4, -1.6, 8, 3.2, 1.4);
      ctx.fill();
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(-2.5, -2.9, 4.5, 1.6);

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

      // Flickering underwater arc-welding / inspection torch flash & bright micro-sparks while on maintenance site!
      if (welding && Math.sin(step * 28 + i * 3) > -0.2) {
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

  // Synchronized Undulating Coastal Fish Schools
  _updateAndDrawFishSchools(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    ctx.save();
    for (let i = 0; i < this.fishSchools.length; i++) {
      const sc = this.fishSchools[i];
      sc.phase += 0.036 * scaleDt;
      sc.x += sc.vx * scaleDt;
      sc.y += Math.sin(sc.phase * 0.55) * 0.18 * scaleDt;

      if (sc.vx > 0 && sc.x > w + sc.spread) {
        sc.x = -sc.spread;
        sc.y = h * this._rand(0.12, 0.38);
      }
      if (sc.vx < 0 && sc.x < -sc.spread) {
        sc.x = w + sc.spread;
        sc.y = h * this._rand(0.12, 0.38);
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
    ctx.save();
    for (let i = 0; i < this.whales.length; i++) {
      const wh = this.whales[i];
      wh.phase += 0.017 * scaleDt;
      wh.x += wh.vx * scaleDt;
      wh.y += Math.sin(wh.phase * 0.6) * 0.13 * scaleDt;

      if (wh.vx > 0 && wh.x > w + wh.len * 1.4) {
        wh.x = -wh.len * 1.4;
        wh.y = h * this._rand(0.10, 0.28);
      }
      if (wh.vx < 0 && wh.x < -wh.len * 1.4) {
        wh.x = w + wh.len * 1.4;
        wh.y = h * this._rand(0.10, 0.28);
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
    ctx.save();
    for (let i = 0; i < this.sharks.length; i++) {
      const sh = this.sharks[i];
      sh.phase += 0.044 * scaleDt;
      sh.x += sh.vx * scaleDt;
      sh.y += Math.sin(sh.phase * 0.45) * 0.14 * scaleDt;

      if (sh.vx > 0 && sh.x > w + sh.size * 2) {
        sh.x = -sh.size * 2;
        sh.y = h * this._rand(0.14, 0.36);
      }
      if (sh.vx < 0 && sh.x < -sh.size * 2) {
        sh.x = w + sh.size * 2;
        sh.y = h * this._rand(0.14, 0.36);
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
    ctx.save();
    for (let i = 0; i < this.farLife.length; i++) {
      const f = this.farLife[i];
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

      if (f.kind === "manta") {
        const wingFlap = Math.sin(f.phase) * f.span * 0.24;
        const sp = f.span;
        ctx.beginPath();
        ctx.moveTo(sp * 0.55, 0);
        ctx.quadraticCurveTo(0, -sp * 0.55 + wingFlap, -sp * 0.25, -sp * 0.14);
        ctx.lineTo(-sp * 1.18, 0);
        ctx.lineTo(-sp * 0.25, sp * 0.14);
        ctx.quadraticCurveTo(0, sp * 0.55 - wingFlap, sp * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        const sz = f.size;
        const wag = Math.sin(f.phase * 2.2) * 1.3;
        ctx.beginPath();
        ctx.ellipse(0, 0, sz, sz * 0.40, 0, 0, Math.PI * 2);
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

  // 7 Cohesive Theme-Synchronized Submarine Classes (Bow = +x, Stern = -x, Top = -y)
  _drawSubmarineModel(ctx, style, pal, step, thrusterGlow = 0.3, showBeam = false) {
    const hullG = ctx.createLinearGradient(0, -18, 0, 18);
    hullG.addColorStop(0, pal.subHullLight);
    hullG.addColorStop(0.52, pal.subHullMid);
    hullG.addColorStop(1, pal.subHullDark);

    const beamOrigin = style === "heavy_freighter" ? 64 : (style === "deep_explorer" ? 60 : (style === "bathyscaphe" ? 28 : 48));
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

    if (style === "manta_glider") {
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
    const navY = style === "bathyscaphe" ? -16.5 : (style === "deep_explorer" ? -29 : (style === "heavy_freighter" ? -26.5 : -22.5));
    ctx.fillStyle = `rgba(56, 224, 180, ${(0.55 * navBlink).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(style === "heavy_freighter" ? 30 : 4, navY, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (style !== "heavy_freighter" && thrusterGlow > 0.25) {
      const sTail = style === "bathyscaphe" ? -33 : -56;
      const sg = ctx.createRadialGradient(sTail, 0, 1, sTail - 4, 0, 13);
      sg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${(thrusterGlow * 0.45).toFixed(3)})`);
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
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedPt = { x: L.leftDockX + dirX * (56 * s), y: L.leftDockY + dirY * (56 * s) };
    const holdPt = { x: L.leftDockX + dirX * (132 * s), y: L.leftDockY + dirY * (132 * s) };
    const dockPitch = this._clamp(armAng - Math.PI, -0.20, 0.20);

    let visible = true;
    let targetPitch = sub.pitch;
    let targetFacingLeft = sub.facingLeft;
    const scaleMult = sub.style === "bathyscaphe" ? 0.84 : (sub.style === "manta_glider" ? 0.90 : 0.96);

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
        sub.phaseDuration = this._rand(9.5, 17.0);
      }
    } else if (sub.phase === "docked") {
      sub.x = dockedPt.x;
      sub.y = dockedPt.y + Math.sin(step * 1.8) * 0.55;
      targetFacingLeft = false;
      targetPitch = dockPitch;
      sub.speed = 0;

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
        sub.phaseDuration = this._rand(6.5, 14.5);
        sub.style = this._pick(["crew_shuttle", "research_catamaran", "bathyscaphe", "manta_glider", "deep_explorer"]);
        sub.cruiseSpeed = sub.style === "bathyscaphe" ? 15.5 : 18.0;
      }
    } else {
      visible = false;
      if (sub.t >= sub.phaseDuration) {
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
      }
    }

    sub.facingLeft = targetFacingLeft;
    sub.pitch = this._lerp(sub.pitch, targetPitch, Math.min(1, dt * 2.8));
    if (!visible) return;

    const thrusterGlow = this._clamp(sub.speed / Math.max(1, sub.cruiseSpeed), 0, 1) * 0.72;
    if (sub.speed > 3.5 && Math.random() < Math.min(0.32, sub.speed * 0.016)) {
      const sternDir = sub.facingLeft ? 1 : -1;
      this.bubbles.push({
        x: sub.x + sternDir * 44 * s * scaleMult,
        y: sub.y - Math.sin(sub.pitch) * 32 * s + (Math.random() - 0.5) * 6,
        r: 1.0 + Math.random() * 1.6,
        vy: -(0.32 + Math.random() * 0.38),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.30 + Math.random() * 0.22
      });
    }

    this._renderBuoyantSub(ctx, sub, s, scaleMult, pal, step, thrusterGlow, sub.phase !== "docked");
  },

  _updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step) {
    const cs = this.cargoSub;
    cs.t += dt;
    const s = L.s;

    const armAng = L.rightAngle;
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedPt = { x: L.rightDockX + dirX * (66 * s), y: L.rightDockY + dirY * (66 * s) };
    const holdPt = { x: L.rightDockX + dirX * (146 * s), y: L.rightDockY + dirY * (146 * s) };
    const dockPitch = this._clamp(-armAng, -0.20, 0.20);

    let visible = true;
    let targetPitch = cs.pitch;
    let targetFacingLeft = cs.facingLeft;
    const scaleMult = cs.style === "heavy_freighter" ? 1.0 : (cs.style === "industrial_tug" ? 0.96 : 0.92);

    if (cs.phase === "docked") {
      cs.x = dockedPt.x;
      cs.y = dockedPt.y + Math.sin(step * 1.6 + 1) * 0.5;
      targetFacingLeft = true;
      targetPitch = dockPitch;
      cs.speed = 0;

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
        cs.phaseDuration = this._rand(7.0, 15.5);
        cs.style = this._pick(["heavy_freighter", "research_catamaran", "industrial_tug", "deep_explorer"]);
        cs.cruiseSpeed = cs.style === "heavy_freighter" ? 13.5 : 16.5;
      }
    } else if (cs.phase === "patrol_wait") {
      visible = false;
      if (cs.t >= cs.phaseDuration) {
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
        cs.phaseDuration = this._rand(10.0, 17.0);
      }
    }

    cs.facingLeft = targetFacingLeft;
    cs.pitch = this._lerp(cs.pitch, targetPitch, Math.min(1, dt * 2.4));
    if (!visible) return;

    const thrusterGlow = cs.phase === "docked" ? 0.12 : this._clamp(cs.speed / Math.max(1, cs.cruiseSpeed), 0.1, 1) * 0.80;
    if (cs.speed > 3.0 && Math.random() < Math.min(0.34, cs.speed * 0.018)) {
      const sternDir = cs.facingLeft ? 1 : -1;
      this.bubbles.push({
        x: cs.x + sternDir * 58 * s * scaleMult,
        y: cs.y - Math.sin(cs.pitch) * 34 * s + (Math.random() - 0.5) * 9,
        r: 1.2 + Math.random() * 1.9,
        vy: -(0.32 + Math.random() * 0.42),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.32 + Math.random() * 0.22
      });
    }

    this._renderBuoyantSub(ctx, cs, s, scaleMult, pal, step, thrusterGlow, cs.phase !== "docked");
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
            rs.phaseDuration = this._rand(7.5, 15.0);
          }
        } else {
          vis = false;
          if (rs.t >= rs.phaseDuration) {
            const fromLeft = Math.random() < 0.5;
            rs.fromPt = fromLeft
              ? { x: -105, y: h * this._rand(0.20, 0.42) }
              : { x: w + 105, y: h * this._rand(0.20, 0.42) };
            rs.hoverPt = {
              x: fromLeft ? L.westWingX + 18 * s : L.eastWingX - 18 * s,
              y: L.hubY - this._rand(38, 62) * s
            };
            rs.style = this._pick(["bathyscaphe", "crew_shuttle", "manta_glider", "industrial_tug"]);
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
            rs.phaseDuration = this._rand(8.5, 19.0);
          }
        } else if (rs.t >= rs.phaseDuration) {
          const goRight = Math.random() < 0.5;
          rs.startPt = { x: goRight ? -130 : w + 130, y: h * this._rand(0.18, 0.40) };
          rs.endPt = { x: goRight ? w + 130 : -130, y: h * this._rand(0.16, 0.38) };
          rs.style = this._pick(this.SUB_STYLES);
          rs.scale = rs.style === "heavy_freighter" ? 0.44 : 0.54;
          rs.cruiseSpeed = this._rand(12.0, 16.5);
          rs.dist = 0;
          rs.phase = "cruising";
          rs.t = 0;
        }
      }
    }
  },

  _updateAndDrawROVs(ctx, w, h, pal, dt, step) {
    for (let i = 0; i < this.rovs.length; i++) {
      const rov = this.rovs[i];
      rov.phase += dt * 1.9;
      const wp = rov.waypoints[rov.wpIdx];
      const tx = wp.x * w;
      const ty = wp.y * h;
      const dx = tx - rov.x;
      const dy = ty - rov.y;
      const dist = Math.hypot(dx, dy);

      let inspecting = false;
      if (dist > 6) {
        const speed = 19 * dt;
        rov.x += (dx / dist) * Math.min(dist, speed);
        rov.y += (dy / dist) * Math.min(dist, speed);
        const moveAng = Math.atan2(dy, dx);
        rov.beamAngle = this._lerpAngle(rov.beamAngle, moveAng, Math.min(1, dt * 2.2));
      } else {
        inspecting = true;
        const sweepTarget = wp.beamAngle + Math.sin(rov.phase * 0.85) * 0.28;
        rov.beamAngle = this._lerpAngle(rov.beamAngle, sweepTarget, Math.min(1, dt * 2.6));
        rov.pauseTimer -= dt;
        if (rov.pauseTimer <= 0) {
          const next = (rov.wpIdx + 1 + Math.floor(Math.random() * Math.max(1, rov.waypoints.length - 1))) % rov.waypoints.length;
          rov.wpIdx = next;
          rov.pauseTimer = this._rand(2.8, 6.4);
        }
      }

      const hoverY = rov.y + Math.sin(rov.phase * 1.3) * 2.2;
      ctx.save();
      ctx.translate(rov.x, hoverY);

      ctx.save();
      ctx.rotate(rov.beamAngle);
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const beamLen = pal.isDark ? 160 : 98;
      const beamSpread = pal.isDark ? 42 : 26;
      const bg = ctx.createLinearGradient(7, 0, beamLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 1.05).toFixed(3)})`);
      bg.addColorStop(0.52, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.36).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(beamLen, -beamSpread);
      ctx.lineTo(beamLen, beamSpread);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

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
        ctx.fillStyle = "#22D3EE";
        ctx.beginPath();
        ctx.arc(0, -6.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _updateAndDrawNearLife(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;

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

  // Abyssal Angler Fish Prowling Deeper Canyon Terraces with Bioluminescent Esca Lures
  _updateAndDrawAnglerFish(ctx, w, h, L, pal, dt, step) {
    for (let i = 0; i < this.anglerFish.length; i++) {
      const af = this.anglerFish[i];
      af.phase += dt * 3.0;
      af.x += af.vx * (dt * 60);
      af.y += Math.sin(af.phase * 0.55) * 0.14 * (dt * 60);
      const minY = L.seabedY - 40;
      const maxY = h - 26;
      if (af.y < minY) af.y = minY;
      if (af.y > maxY) af.y = maxY;
      if (af.x > w + 55) af.x = -55;
      if (af.x < -55) af.x = w + 55;

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

  // Infrequent Colossal Serpentine Sea Leviathan Swimming Deep in Distant Hazy Background
  _updateAndDrawLeviathan(ctx, w, h, pal, dt, step) {
    const lev = this.leviathan;
    if (!lev) return;
    lev.t += dt;

    if (lev.phase === "dormant_wait") {
      if (lev.t >= lev.phaseDuration) {
        lev.phase = "swimming";
        lev.t = 0;
        lev.dir = Math.random() < 0.5 ? 1 : -1;
        lev.length = w < 720 ? 260 : 420;
        lev.x = lev.dir > 0 ? (-lev.length * 0.35) : (w + lev.length * 0.35);
        lev.y = h * this._rand(0.16, 0.32);
        lev.speed = this._rand(19.0, 25.0);
        lev.phaseDuration = (w + lev.length * 2.1) / lev.speed;
      }
      return;
    }

    lev.swimPhase += dt * 1.45;
    lev.x += lev.dir * lev.speed * dt;
    const bodyLen = lev.length;
    const segs = 18;
    const alpha = pal.isDark ? 0.40 : 0.42;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (lev.dir < 0) {
      ctx.translate(lev.x, lev.y);
      ctx.scale(-1, 1);
      ctx.translate(-lev.x, -lev.y);
    }

    // Build articulated sinuous spine from giant tapered head to whip tail
    const topPts = [];
    const botPts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs; // 0 = head, 1 = tail tip
      const px = lev.x - f * bodyLen;
      const py = lev.y + Math.sin(lev.swimPhase - f * 4.8) * (13 + f * 20);
      // Giant armored head profile tapering cleanly down a serpentine spine
      let radius;
      if (f < 0.14) radius = 21 * (0.48 + (f / 0.14) * 0.52);
      else radius = 21 * Math.pow(1 - (f - 0.14) / 0.86, 0.80) * (1 + 0.16 * Math.sin(f * Math.PI * 3));
      topPts.push({ x: px, y: py - radius });
      botPts.push({ x: px, y: py + radius });
    }

    // Fill massive distant silhouette with strong depth contrast against background water
    ctx.fillStyle = pal.reefMid;
    ctx.beginPath();
    ctx.moveTo(topPts[0].x + 14, lev.y + Math.sin(lev.swimPhase) * 8);
    topPts.forEach(p => ctx.lineTo(p.x, p.y));
    for (let i = botPts.length - 1; i >= 0; i--) ctx.lineTo(botPts[i].x, botPts[i].y);
    ctx.closePath();
    ctx.fill();

    // Swept Abyssal Pectoral Fin & Tall Serrated Dorsal Ridge Plates
    ctx.beginPath();
    ctx.moveTo(topPts[2].x, topPts[2].y + 8);
    ctx.quadraticCurveTo(topPts[5].x - 18, botPts[4].y + 34, topPts[7].x - 24, botPts[5].y + 18);
    ctx.lineTo(topPts[5].x, botPts[3].y);
    ctx.closePath();
    ctx.fill();

    for (let i = 2; i < segs - 2; i += 2) {
      const p = topPts[i];
      const next = topPts[i + 1];
      const finH = (1 - i / segs) * 14 + 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 10, p.y - finH);
      ctx.lineTo(next.x, next.y);
      ctx.closePath();
      ctx.fill();
    }

    // Haunting subtle bioluminescent abyssal flank & orbital eye nodes
    ctx.fillStyle = `rgba(${pal.jellyRgb}, 0.55)`;
    ctx.beginPath();
    ctx.arc(topPts[1].x + 2, lev.y + Math.sin(lev.swimPhase - 0.25) * 12 - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 3; i < segs - 3; i += 2) {
      const f = i / segs;
      const py = lev.y + Math.sin(lev.swimPhase - f * 4.8) * (12 + f * 18);
      ctx.beginPath();
      ctx.arc(topPts[i].x, py, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if ((lev.dir > 0 && lev.x - bodyLen > w + 120) || (lev.dir < 0 && lev.x + bodyLen < -120)) {
      lev.phase = "dormant_wait";
      lev.t = 0;
      lev.phaseDuration = this._rand(42.0, 68.0);
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
