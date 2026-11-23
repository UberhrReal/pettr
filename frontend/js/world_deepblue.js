/**
 * PETTR World Renderer: Underwater — "Deep Blue" (v12.3 Horizontal Clear-Tube Complex & Realistic Subsea Physics)
 * Panoramic multi-wing benthic research station grounded solidly onto volcanic seabed terraces:
 * - No spindly stilts: heavy terraced seabed foundations rise directly from volcanic basalt outcrops across
 *   a central command complex, horizontal West Observatory & East Habitat wings, and depth-hazed outer sensor pods.
 * - Crystal-clear acrylic glass walkway tubes (_drawClearGlassTube) connect horizontal modules over the canyon floor,
 *   showing translucent glass reflections, interior walkway decks, warm recessed lighting, and titanium pressure rings.
 * - Atmospheric subsea lighting: top-down cyan water bounce rims, multi-stop warm interior glazing, downward
 *   exterior hull floodlights onto basalt rock, and Beer-Lambert depth haze separation.
 * - Realistic arc-length submarine kinematics (_buildArcPath / _sampleArcPath) with weighty constant-speed cruising,
 *   gentle docking deceleration, and clamped buoyant trim (±11.5° max pitch) so vessels glide level instead of nose-diving.
 * - Animated vertical Surface Supply Elevator + rigid-torso megafauna (Great Whites, Hammerheads, Whale Sharks, True Whales).
 */
const WorldDeepBlue = {
  cacheCanvas: null,
  cacheKey: "",
  farLife: [],
  nearLife: [],
  sharks: [],
  whales: [],
  jellies: [],
  snow: [],
  bubbles: [],
  sub: null,          // Primary left-pier visiting submarine
  cargoSub: null,     // Primary right-pier visiting freighter/vessel
  roamingSubs: [],    // Additional multi-directional research visitor + deep background transit traffic
  elevator: null,     // Vertical surface supply elevator state
  rovs: [],
  sonarRings: [],
  _lastW: 0,
  _lastH: 0,

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

  // True arc-length polyline sampler for smooth, constant-speed weighty submarine motion
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

  // Compute realistic submarine buoyant pitch trim (±0.20 rad ≈ ±11.5° max) and facing side
  _computeBuoyantTransform(dx, dy, prevFacingLeft) {
    let facingLeft = prevFacingLeft;
    if (Math.abs(dx) > 0.08) {
      facingLeft = dx < 0;
    }
    const horiz = Math.max(Math.abs(dx), 0.35);
    const targetPitch = this._clamp(Math.atan2(dy, horiz), -0.20, 0.20);
    return { facingLeft, targetPitch };
  },

  reset() {
    this.cacheKey = "";
    this.farLife = [];
    this.nearLife = [];
    this.sharks = [];
    this.whales = [];
    this.jellies = [];
    this.snow = [];
    this.bubbles = [];
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
        hullLight: "#DCECF3",
        hullMid: "#7EA3B9",
        hullDark: "#2D4F66",
        hullDeep: "#1B364A",
        hullShadow: "rgba(15, 42, 62, 0.34)",
        glassTint: "rgba(198, 240, 250, 0.24)",
        glassHighlight: "rgba(255, 255, 255, 0.62)",
        glassRim: "rgba(165, 235, 248, 0.42)",
        tubeFloor: "#3B6078",
        tubeWarmGlow: "rgba(254, 236, 175, 0.68)",
        subHullLight: "#D6ECEF",
        subHullMid: "#72A2B8",
        subHullDark: "#2A526B",
        subAccent: "#3694A6",
        subContainers: ["#3B7E96", "#4B8B88", "#8BA2B4"],
        rovBody: "#C59C50",
        elevatorGlow: "186, 240, 244",
        trimGold: "#CFA046",
        portholeGlow: "rgba(254, 236, 176, 0.84)",
        windowTop: "rgba(38, 66, 84, 0.72)",
        windowMid: "rgba(254, 238, 182, 0.82)",
        windowBot: "rgba(214, 174, 108, 0.78)",
        windowRecess: "rgba(16, 44, 62, 0.74)",
        floodlightRgb: "224, 248, 252",
        floodlightAlpha: 0.14,
        biodomeFlora: "rgba(52, 200, 148, 0.42)",
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
      return {
        isDark: true,
        waterTop: "#0F3454",
        waterMid: "#09213A",
        waterBottom: "#04101F",
        waterHazeRgb: "9, 33, 58",
        waterBounce: "rgba(125, 204, 242, 0.40)",
        surfaceRipple: "rgba(125, 211, 252, 0.24)",
        rayColor: "56, 189, 248",
        rayAlpha: 0.13,
        reefFar: "#0B263F",
        reefMid: "#071B2E",
        reefNear: "#030D18",
        seabedLight: "#0E2D49",
        seabedDark: "#051424",
        hullLight: "#7695AE",
        hullMid: "#36526B",
        hullDark: "#142537",
        hullDeep: "#0B1624",
        hullShadow: "rgba(3, 10, 20, 0.48)",
        glassTint: "rgba(125, 211, 252, 0.16)",
        glassHighlight: "rgba(186, 230, 253, 0.46)",
        glassRim: "rgba(96, 194, 240, 0.34)",
        tubeFloor: "#1E364D",
        tubeWarmGlow: "rgba(253, 224, 142, 0.88)",
        subHullLight: "#6A8DA9",
        subHullMid: "#304F6B",
        subHullDark: "#132539",
        subAccent: "#3E8499",
        subContainers: ["#254866", "#2B5661", "#656F7E"],
        rovBody: "#8F764A",
        elevatorGlow: "125, 211, 252",
        trimGold: "#C48E3D",
        portholeGlow: "rgba(253, 224, 142, 0.92)",
        windowTop: "rgba(22, 34, 48, 0.82)",
        windowMid: "rgba(253, 224, 146, 0.92)",
        windowBot: "rgba(204, 152, 74, 0.86)",
        windowRecess: "rgba(6, 16, 30, 0.86)",
        floodlightRgb: "186, 232, 250",
        floodlightAlpha: 0.24,
        biodomeFlora: "rgba(52, 211, 153, 0.36)",
        farCreatureRgb: "14, 46, 72",
        nearCreatureRgb: "24, 72, 104",
        jellyRgb: "45, 212, 191",
        beamAlpha: 0.46,
        beamRgb: "254, 243, 199",
        snowRgb: "186, 230, 253",
        biolumAlpha: 0.68
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
        hullLight: "#496780",
        hullMid: "#21364B",
        hullDark: "#0C1826",
        hullDeep: "#060D16",
        hullShadow: "rgba(1, 5, 14, 0.60)",
        glassTint: "rgba(56, 189, 248, 0.13)",
        glassHighlight: "rgba(148, 224, 248, 0.38)",
        glassRim: "rgba(56, 189, 248, 0.28)",
        tubeFloor: "#122436",
        tubeWarmGlow: "rgba(254, 230, 148, 0.94)",
        subHullLight: "#466782",
        subHullMid: "#1E354C",
        subHullDark: "#0B1726",
        subAccent: "#287A92",
        subContainers: ["#193852", "#1C454D", "#44566A"],
        rovBody: "#6E5E3D",
        elevatorGlow: "56, 189, 248",
        trimGold: "#A67C38",
        portholeGlow: "rgba(254, 230, 148, 0.94)",
        windowTop: "rgba(12, 22, 34, 0.88)",
        windowMid: "rgba(254, 232, 156, 0.95)",
        windowBot: "rgba(196, 144, 66, 0.88)",
        windowRecess: "rgba(3, 9, 20, 0.92)",
        floodlightRgb: "165, 238, 252",
        floodlightAlpha: 0.28,
        biodomeFlora: "rgba(45, 212, 191, 0.34)",
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
      hullLight: "#E8F3F9",
      hullMid: "#89ABC4",
      hullDark: "#32536C",
      hullDeep: "#1E3A50",
      hullShadow: "rgba(16, 48, 74, 0.30)",
      glassTint: "rgba(218, 246, 255, 0.26)",
      glassHighlight: "rgba(255, 255, 255, 0.68)",
      glassRim: "rgba(186, 236, 252, 0.46)",
      tubeFloor: "#3C637D",
      tubeWarmGlow: "rgba(254, 236, 176, 0.64)",
      subHullLight: "#E2F1F8",
      subHullMid: "#7BA6C2",
      subHullDark: "#2F5470",
      subAccent: "#2A84A8",
      subContainers: ["#2D7294", "#3B7E84", "#86A2BA"],
      rovBody: "#C29642",
      elevatorGlow: "224, 247, 250",
      trimGold: "#D09B3E",
      portholeGlow: "rgba(254, 236, 178, 0.82)",
      windowTop: "rgba(42, 74, 96, 0.70)",
      windowMid: "rgba(254, 238, 186, 0.80)",
      windowBot: "rgba(212, 174, 110, 0.76)",
      windowRecess: "rgba(22, 54, 78, 0.72)",
      floodlightRgb: "230, 250, 255",
      floodlightAlpha: 0.13,
      biodomeFlora: "rgba(52, 206, 152, 0.42)",
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
    const seabedY = h * (isNarrow ? 0.80 : 0.76);
    const hubX = w * (isNarrow ? 0.52 : 0.50);
    const hubY = h * (isNarrow ? 0.62 : 0.585);
    const s = isNarrow ? 0.56 : Math.min(1.06, Math.max(0.76, w / 1320));

    // Horizontal satellite complexes terraced naturally onto lower seabed rock shelves & linked by clear acrylic glass tubes
    const westWingX = hubX - 262 * s;
    const westWingY = hubY + 52 * s;
    const farWestX = hubX - 394 * s;
    const farWestY = hubY + 72 * s;

    const eastWingX = hubX + 266 * s;
    const eastWingY = hubY + 50 * s;
    const farEastX = hubX + 396 * s;
    const farEastY = hubY + 70 * s;

    // Gentle realistic docking pier angles matching buoyant submarine trim (±11-12°)
    const leftAngle = 2.94; // ~168.5° -> docked sub nose points at -0.20 rad (-11.5°)
    const leftArmLen = 148 * s;
    const leftDockX = hubX - 18 * s + Math.cos(leftAngle) * leftArmLen;
    const leftDockY = hubY + 24 * s + Math.sin(leftAngle) * leftArmLen;

    const rightAngle = 0.20; // ~11.5° -> docked cargo sub nose points at -0.20 rad left-upward
    const rightArmLen = 160 * s;
    const rightDockX = hubX + 20 * s + Math.cos(rightAngle) * rightArmLen;
    const rightDockY = hubY + 28 * s + Math.sin(rightAngle) * rightArmLen;

    // Geodesic hydroponics biodome (right-rear terrace seated directly onto seabed foundation)
    const domeX = hubX + 104 * s;
    const domeY = hubY - 14 * s;

    // Vertical Surface Supply Elevator Shaft & Transfer Collar (left-rear terrace wing)
    const elevX = hubX - 92 * s;
    const elevDockY = hubY - 38 * s;

    return {
      isNarrow, seabedY, hubX, hubY, s,
      westWingX, westWingY, farWestX, farWestY,
      eastWingX, eastWingY, farEastX, farEastY,
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
    const surfG = ctx.createLinearGradient(0, 0, 0, 56);
    surfG.addColorStop(0, pal.surfaceRipple);
    surfG.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = surfG;
    ctx.fillRect(0, 0, w, 56);
    ctx.restore();

    // 3. Far hazy canyon ridges & distant seamounts (two soft atmospheric layers)
    ctx.save();
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

    // 4. Elevated Panoramic Volcanic Seabed Plateau Supporting Central & Horizontal Wings
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

    // Subtle seabed sediment ridges & basalt boulders across canyon basin
    ctx.fillStyle = pal.reefMid;
    ctx.globalAlpha = 0.72;
    for (let b = 0; b < 26; b++) {
      const bx = w * (0.08 + (b * 0.036) % 0.84);
      const by = L.seabedY - 16 + ((b * 37) % 108);
      const br = 8 + (b % 5) * 5.5;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.65, br * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Grand Grounded Panoramic Horizontal 2.5D Underwater Research Complex + Clear Glass Tubes
    this._drawResearchStation(ctx, L, pal);

    // 6. Framing Foreground Coral Cliffs & Sea Fans
    ctx.save();
    ctx.fillStyle = pal.reefNear;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.66);
    ctx.quadraticCurveTo(w * 0.06, h * 0.72, w * 0.14, h * 0.82);
    ctx.quadraticCurveTo(w * 0.22, h * 0.90, w * 0.30, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h * 0.65);
    ctx.quadraticCurveTo(w * 0.93, h * 0.73, w * 0.86, h * 0.84);
    ctx.quadraticCurveTo(w * 0.78, h * 0.92, w * 0.70, h);
    ctx.closePath();
    ctx.fill();

    this._drawCoralCluster(ctx, w * 0.06, h * 0.72, 24, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.13, h * 0.83, 20, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.21, h * 0.91, 16, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.93, h * 0.72, 23, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.86, h * 0.85, 19, pal.reefNear);
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
      ctx.moveTo(x, y);
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

  // Helper: realistic recessed panoramic window band with warm vertical interior gradient & glass mullions
  _drawWindowBand(ctx, x, y, w, h, mullions, pal, s, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Deep recessed brow frame
    ctx.fillStyle = pal.windowRecess;
    ctx.fillRect(x, y - 0.8 * s, w, h + 1.6 * s);

    // Multi-stop warm interior gradient (darker ceiling -> warm lit room -> warm floor bounce)
    const wg = ctx.createLinearGradient(0, y, 0, y + h);
    wg.addColorStop(0, pal.windowTop);
    wg.addColorStop(0.45, pal.windowMid);
    wg.addColorStop(1, pal.windowBot);
    ctx.fillStyle = wg;
    ctx.fillRect(x + 1.2 * s, y, Math.max(1, w - 2.4 * s), h);

    // Subtle exterior water-glass specular sheen along top edge
    ctx.fillStyle = pal.glassHighlight;
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillRect(x + 1.2 * s, y, Math.max(1, w - 2.4 * s), Math.max(0.8, h * 0.24));
    ctx.globalAlpha = alpha;

    // Fine structural vertical mullions
    if (mullions > 0) {
      ctx.fillStyle = pal.hullDark;
      const step = (w - 2.4 * s) / (mullions + 1);
      for (let m = 1; m <= mullions; m++) {
        ctx.fillRect(x + 1.2 * s + step * m - 0.6 * s, y - 0.4 * s, 1.2 * s, h + 0.8 * s);
      }
    }
    ctx.restore();
  },

  // Helper: subtle diffuse underwater exterior architectural wash onto basalt rocks (no hard geometric triangles)
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

  // Unified Multi-Tier Sloped Benthic Fortress Foundation Rising Solidly From Seabed Plateau
  _drawSeabedFoundation(ctx, cx, topY, botY, topW, botW, pal, s, opts = {}) {
    ctx.save();
    const h = Math.max(22, botY - topY);
    const windowRows = opts.windowRows !== undefined ? opts.windowRows : 2;

    // 1. Cast bedrock shadow stretching down-right
    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, botY + 4 * s, botW * 0.56, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main continuous armored bunker hull rising straight from seafloor plateau
    const midY = topY + h * 0.48;
    const midW = topW + (botW - topW) * 0.42;

    const lowG = ctx.createLinearGradient(cx - botW * 0.5, 0, cx + botW * 0.5, 0);
    lowG.addColorStop(0, pal.hullLight);
    lowG.addColorStop(0.30, pal.hullMid);
    lowG.addColorStop(0.72, pal.hullMid);
    lowG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = lowG;
    ctx.beginPath();
    ctx.moveTo(cx - midW * 0.5, midY);
    ctx.lineTo(cx + midW * 0.5, midY);
    ctx.lineTo(cx + botW * 0.5, botY + 12 * s);
    ctx.lineTo(cx - botW * 0.5, botY + 12 * s);
    ctx.closePath();
    ctx.fill();

    // 2.5D Faceted Right-Flank Shadow Return Plane on Lower Bunker
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(cx + midW * 0.24, midY);
    ctx.lineTo(cx + midW * 0.5, midY);
    ctx.lineTo(cx + botW * 0.5, botY + 12 * s);
    ctx.lineTo(cx + botW * 0.24, botY + 12 * s);
    ctx.closePath();
    ctx.fill();

    // Upper Recessed Habitat Terrace Ring Platform
    ctx.fillStyle = lowG;
    ctx.beginPath();
    ctx.moveTo(cx - topW * 0.5, topY);
    ctx.lineTo(cx + topW * 0.5, topY);
    ctx.lineTo(cx + midW * 0.52, midY + 2 * s);
    ctx.lineTo(cx - midW * 0.52, midY + 2 * s);
    ctx.closePath();
    ctx.fill();

    // Horizontal beveled terrace shoulder ledge & ambient ocean water-bounce crown rim
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(cx - midW * 0.53, midY - 1.8 * s, midW * 1.06, 4.2 * s);
    ctx.fillStyle = pal.waterBounce;
    ctx.fillRect(cx - topW * 0.5, topY, topW * 0.74, 1.8 * s);

    // Integral sloped armored buttress ribs
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

    // Sleek recessed engineering window bands with warm multi-stop gradients
    const rowFracs = windowRows === 1 ? [0.34] : (windowRows === 2 ? [0.24, 0.62] : []);
    rowFracs.forEach((f, idx) => {
      const wy = topY + h * f;
      const bandW = topW * (idx === 0 ? 0.64 : 0.72) * 0.85;
      const bx = cx - topW * (idx === 0 ? 0.36 : 0.40);
      this._drawWindowBand(ctx, bx, wy, bandW, 3.6 * s, Math.max(3, Math.round(bandW / (22 * s))), pal, s);
    });

    // Subtle downward hull floodlights onto surrounding basalt shelf
    if (!opts.noFloodlight) {
      this._drawExteriorFloodlight(ctx, cx - botW * 0.24, midY + 2 * s, 44 * s, (botY - midY) + 14 * s, pal);
      this._drawExteriorFloodlight(ctx, cx + botW * 0.18, midY + 2 * s, 40 * s, (botY - midY) + 14 * s, pal);
    }

    // Anchoring Volcanic Basalt Outcrops & Sediment Shelf Wrapping Cleanly Around Base
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

  // Sleek Chamfered 2.5D Research Module (cyan water-bounce crown, recessed mullioned panoramic glass)
  _drawArchitecturalModule(ctx, x, y, bw, bh, pal, s, opts = {}) {
    const frontW = bw * 0.66;
    const depthX = bw * 0.34;
    const bevel = Math.min(7.5 * s, bh * 0.24);

    ctx.save();
    ctx.fillStyle = pal.hullShadow;
    ctx.fillRect(x + 3 * s, y + bh - 2 * s, bw, 5 * s);

    const mg = ctx.createLinearGradient(x, y, x, y + bh);
    mg.addColorStop(0, pal.hullLight);
    mg.addColorStop(0.65, pal.hullMid);
    mg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = mg;
    ctx.fillRect(x, y, frontW, bh);

    // Shaded isometric right flank
    const sideG = ctx.createLinearGradient(x + frontW, y, x + bw, y + bh);
    sideG.addColorStop(0, pal.hullDark);
    sideG.addColorStop(1, pal.hullDeep);
    ctx.fillStyle = sideG;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + bw, y + bevel * 0.65);
    ctx.lineTo(x + bw, y + bh + bevel * 0.35);
    ctx.lineTo(x + frontW, y + bh);
    ctx.closePath();
    ctx.fill();

    // Chamfered 2.5D roof terrace deck with ambient cyan water-bounce edge
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depthX * 0.72, y - bevel);
    ctx.lineTo(x + bw, y - bevel + bevel * 0.65);
    ctx.lineTo(x + frontW, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.waterBounce;
    ctx.lineWidth = 1.15 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + frontW, y);
    ctx.stroke();

    // Fine vertical structural pressure seam ribs
    ctx.fillStyle = pal.hullDeep;
    ctx.globalAlpha = 0.45;
    [0.32, 0.68].forEach(f => {
      ctx.fillRect(x + frontW * f - 0.8 * s, y, 1.6 * s, bh);
    });
    ctx.globalAlpha = 1;

    // Sleek Narrow Panoramic Glass Gallery Bands with Warm Interior Gradient & Vertical Mullions
    const rows = opts.rows || 1;
    for (let r = 0; r < rows; r++) {
      const wy = y + bh * (rows === 1 ? 0.38 : (0.28 + r * 0.35));
      const wh = Math.max(2.6 * s, bh * 0.11);
      this._drawWindowBand(ctx, x + 4.5 * s, wy, frontW - 9 * s, wh, 3, pal, s);

      // Subtle recessed return glazing on shaded right flank
      this._drawWindowBand(ctx, x + frontW + 3 * s, wy + 1.2 * s, Math.max(4 * s, depthX * 0.50), wh * 0.88, 1, pal, s, 0.68);
    }

    if (opts.hasTanks) {
      ctx.fillStyle = pal.hullLight;
      ctx.beginPath();
      ctx.roundRect(x + frontW * 0.22, y - bevel - 4.2 * s, frontW * 0.50, 5.0 * s, 2.4 * s);
      ctx.fill();
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(x + frontW * 0.34, y - bevel - 4.2 * s, 2.8 * s, 5.0 * s);
    }
    ctx.restore();
  },

  // Crystal-Clear Pressurized Acrylic Glass Walkway Tube connecting horizontal station modules!
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

    // 1. Subtle ambient underwater warm glow radiating from illuminated acrylic gallery in evening/dark
    if (pal.isDark) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const haloG = ctx.createLinearGradient(0, -halfT * 1.9, 0, halfT * 1.9);
      haloG.addColorStop(0, "rgba(253, 224, 146, 0)");
      haloG.addColorStop(0.5, `rgba(253, 224, 146, ${(0.16 * hazeAlpha).toFixed(3)})`);
      haloG.addColorStop(1, "rgba(253, 224, 146, 0)");
      ctx.fillStyle = haloG;
      ctx.fillRect(4 * s, -halfT * 1.9, Math.max(0, len - 8 * s), thickness * 1.9);
      ctx.restore();
    }

    // 2. Translucent curved glass cylinder envelope (ocean background remains clearly visible through the glass!)
    const glassG = ctx.createLinearGradient(0, -halfT, 0, halfT);
    glassG.addColorStop(0, pal.glassHighlight);
    glassG.addColorStop(0.18, pal.glassTint);
    glassG.addColorStop(0.62, "rgba(255, 255, 255, 0.05)");
    glassG.addColorStop(0.84, pal.glassTint);
    glassG.addColorStop(1, pal.glassRim);
    ctx.fillStyle = glassG;
    ctx.fillRect(0, -halfT, len, thickness);

    // 3. Visible interior walkway floor deck along bottom 26% of glass tube + warm handrail illumination
    const floorTop = halfT * 0.34;
    const floorH = halfT - floorTop;
    ctx.fillStyle = pal.tubeFloor;
    ctx.globalAlpha = hazeAlpha * 0.88;
    ctx.fillRect(0, floorTop, len, floorH);

    // Warm interior walkway LED strip & soft light wash up the curved glass wall
    const warmWash = ctx.createLinearGradient(0, -halfT * 0.3, 0, floorTop);
    warmWash.addColorStop(0, "rgba(254, 236, 176, 0)");
    warmWash.addColorStop(1, pal.isDark ? "rgba(254, 230, 148, 0.34)" : "rgba(254, 238, 186, 0.22)");
    ctx.fillStyle = warmWash;
    ctx.globalAlpha = hazeAlpha;
    ctx.fillRect(4 * s, -halfT * 0.3, Math.max(0, len - 8 * s), floorTop + halfT * 0.3);

    // Crisp continuous warm illuminated interior walkway handrail/deck strip
    ctx.fillStyle = pal.tubeWarmGlow;
    ctx.fillRect(3 * s, floorTop - 1.3 * s, Math.max(0, len - 6 * s), 1.7 * s);

    // Subtle interior bulkhead handrails visible behind glass
    ctx.strokeStyle = pal.waterBounce;
    ctx.globalAlpha = hazeAlpha * 0.34;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(4 * s, floorTop - 4.0 * s);
    ctx.lineTo(len - 4 * s, floorTop - 4.0 * s);
    ctx.stroke();

    // 4. Curved titanium structural pressure ribs spaced cleanly along acrylic span
    const segs = Math.max(3, Math.floor(len / (22 * s)));
    ctx.globalAlpha = hazeAlpha;
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      // Shaded titanium hoop
      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = 2.0 * s;
      ctx.beginPath();
      ctx.moveTo(sx, -halfT - 0.8 * s);
      ctx.quadraticCurveTo(sx + 2.6 * s, 0, sx, halfT + 0.8 * s);
      ctx.stroke();

      // Top cyan water-bounce highlight on structural ring
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(sx - 0.5 * s, -halfT - 0.8 * s);
      ctx.quadraticCurveTo(sx + 1.4 * s, -halfT * 0.35, sx + 1.1 * s, -halfT * 0.05);
      ctx.stroke();
    }

    // 5. Top & bottom curved acrylic glass edge refraction lines + crisp specular reflection streak
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

    // 6. Armored bulkhead airlock mating collars at both ends of the glass tube
    ctx.globalAlpha = hazeAlpha;
    [0, len - 6.5 * s].forEach(cx => {
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(cx, -halfT * 1.16, 6.5 * s, thickness * 1.16);
      ctx.fillStyle = pal.hullLight;
      ctx.fillRect(cx + 1.2 * s, -halfT * 1.16, 1.8 * s, thickness * 0.38);
    });

    ctx.restore();
  },

  // Vertical Surface Supply Elevator Shaft rising cleanly from Station Airlock Collar to Ocean Surface!
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

    // Horizontal tension spreader brackets
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

    // Reinforced Conical Elevator Airlock Receiver Funnel at Station Collar
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

    // Subtle cyan top water-bounce specular line along pier crown
    ctx.fillStyle = pal.waterBounce;
    ctx.fillRect(0, -thickness * 0.5, len, 1.3 * s);

    const segs = Math.max(4, Math.floor(len / (24 * s)));
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(sx - 1.4 * s, -thickness * 0.56, 2.8 * s, thickness * 1.12);
      this._drawWindowBand(
        ctx,
        sx - (len / segs) * 0.62,
        -thickness * 0.14,
        (len / segs) * 0.34,
        thickness * 0.24,
        1,
        pal,
        s
      );
    }

    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(len - 8 * s, -thickness * 0.62, 9 * s, thickness * 1.24);
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(len - 3 * s, -thickness * 0.54, 2.5 * s, thickness * 1.08);
    ctx.restore();
  },

  // Horizontal Satellite Observatory / Habitat Wing terraced organically onto a wide volcanic seabed mound
  _drawSatelliteWing(ctx, cx, cy, seabedY, pal, s, opts = {}) {
    const isObs = opts.kind === "observatory";
    const isPod = opts.kind === "pod";
    const sc = isPod ? s * 0.78 : s * 0.92;
    const baseTopW = isPod ? 82 * sc : 132 * sc;
    const baseBotW = isPod ? 136 * sc : 196 * sc;

    ctx.save();
    // 0. Raised volcanic basalt terrace shelf cradling the satellite wing (eliminates tall skinny column look!)
    ctx.fillStyle = pal.seabedDark;
    ctx.beginPath();
    ctx.moveTo(cx - baseBotW * 0.85, seabedY + 24 * sc);
    ctx.quadraticCurveTo(cx - baseBotW * 0.50, cy + 28 * sc, cx, cy + 24 * sc);
    ctx.quadraticCurveTo(cx + baseBotW * 0.50, cy + 28 * sc, cx + baseBotW * 0.85, seabedY + 24 * sc);
    ctx.closePath();
    ctx.fill();

    // 1. Low wide sloped armored benthic foundation rising cleanly from basalt terrace (NO stilts!)
    this._drawSeabedFoundation(ctx, cx, cy + 12 * sc, Math.min(seabedY, cy + 72 * sc), baseTopW, baseBotW, pal, sc, {
      windowRows: 1,
      noFloodlight: true
    });

    if (isObs) {
      // West Wing: Curved Marine Biology Observatory with Panoramic Acrylic Dome & Lab Annex
      this._drawArchitecturalModule(ctx, cx - 50 * sc, cy - 12 * sc, 64 * sc, 30 * sc, pal, sc, { rows: 1, hasTanks: true });

      // Translucent curved glass observation dome seated solidly on wing terrace
      ctx.save();
      ctx.translate(cx + 12 * sc, cy + 8 * sc);
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(-30 * sc, 0, 60 * sc, 12 * sc);
      this._drawWindowBand(ctx, -24 * sc, 3 * sc, 48 * sc, 4.2 * sc, 3, pal, sc);

      const obsG = ctx.createRadialGradient(-4 * sc, -10 * sc, 3 * sc, 0, -4 * sc, 30 * sc);
      obsG.addColorStop(0, pal.isDark ? "rgba(254, 232, 160, 0.45)" : "rgba(224, 248, 255, 0.58)");
      obsG.addColorStop(0.65, pal.glassTint);
      obsG.addColorStop(1, pal.glassRim);
      ctx.fillStyle = obsG;
      ctx.beginPath();
      ctx.arc(0, 0, 27 * sc, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.hullLight;
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.15 * sc;
      ctx.beginPath();
      ctx.arc(0, 0, 27 * sc, Math.PI, 0);
      [-12, 0, 12].forEach(rx => {
        ctx.moveTo(rx * sc, 0);
        ctx.quadraticCurveTo(rx * 0.6 * sc, -15 * sc, 0, -27 * sc);
      });
      ctx.stroke();

      // Hydrophone mast
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      ctx.moveTo(-40 * sc, -20 * sc);
      ctx.lineTo(-40 * sc, -48 * sc);
      ctx.moveTo(-46 * sc, -36 * sc);
      ctx.lineTo(-34 * sc, -36 * sc);
      ctx.stroke();
      ctx.restore();
    } else if (isPod) {
      // Distant Abyssal Sensor / Sonar Outpost Pod
      this._drawArchitecturalModule(ctx, cx - 28 * sc, cy - 8 * sc, 56 * sc, 24 * sc, pal, sc, { rows: 1 });
      ctx.save();
      ctx.translate(cx, cy - 8 * sc);
      const podG = ctx.createRadialGradient(-3 * sc, -6 * sc, 2 * sc, 0, 0, 18 * sc);
      podG.addColorStop(0, pal.glassHighlight);
      podG.addColorStop(0.6, pal.glassTint);
      podG.addColorStop(1, pal.glassRim);
      ctx.fillStyle = podG;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * sc, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 1.0 * sc;
      ctx.stroke();
      ctx.restore();
    } else {
      // East Wing: Horizontal Benthic Habitat & Deep Sampling Annex
      this._drawArchitecturalModule(ctx, cx - 48 * sc, cy - 18 * sc, 68 * sc, 34 * sc, pal, sc, { rows: 2, hasTanks: true });
      this._drawArchitecturalModule(ctx, cx + 10 * sc, cy - 6 * sc, 46 * sc, 24 * sc, pal, sc, { rows: 1 });
      // Roof sensor array & telemetry beacon
      ctx.strokeStyle = pal.hullLight;
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      ctx.moveTo(cx + 26 * sc, cy - 10 * sc);
      ctx.lineTo(cx + 26 * sc, cy - 42 * sc);
      ctx.moveTo(cx + 20 * sc, cy - 30 * sc);
      ctx.lineTo(cx + 32 * sc, cy - 30 * sc);
      ctx.stroke();
    }

    // Optional Beer-Lambert water haze overlay for distant outer wings
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

    // 0. Distant Depth-Hazed Horizontal Outer Outposts & Connecting Clear Glass Tubes (desktop)
    if (!L.isNarrow) {
      this._drawClearGlassTube(ctx, L.farWestX + 26 * s, L.farWestY + 2 * s, L.westWingX - 52 * s, L.westWingY + 4 * s, 11.5 * s, s, pal, { depthAlpha: 0.78 });
      this._drawSatelliteWing(ctx, L.farWestX, L.farWestY, seabedBaseY + 6 * s, pal, s, { kind: "pod", haze: 0.24 });

      this._drawClearGlassTube(ctx, L.eastWingX + 52 * s, L.eastWingY + 4 * s, L.farEastX - 26 * s, L.farEastY + 2 * s, 11.5 * s, s, pal, { depthAlpha: 0.78 });
      this._drawSatelliteWing(ctx, L.farEastX, L.farEastY, seabedBaseY + 6 * s, pal, s, { kind: "pod", haze: 0.24 });
    }

    // 1. Horizontal Clear Acrylic Glass Walkway Tubes Linking West Observatory & East Habitat to Main Complex!
    this._drawClearGlassTube(ctx, L.westWingX + 44 * s, L.westWingY + 4 * s, hx - 118 * s, hy + 36 * s, 15 * s, s, pal);
    this._drawClearGlassTube(ctx, hx + 116 * s, hy + 32 * s, L.eastWingX - 46 * s, L.eastWingY + 4 * s, 15 * s, s, pal);
    // Secondary upper clear glass observatory gallery tube from biodome terrace sloping down to East Wing
    this._drawClearGlassTube(ctx, L.domeX + 30 * s, L.domeY + 14 * s, L.eastWingX - 36 * s, L.eastWingY - 6 * s, 11 * s, s, pal, { depthAlpha: 0.90 });

    // 2. Grounded Horizontal West Observatory Wing & East Habitat Annex
    this._drawSatelliteWing(ctx, L.westWingX, L.westWingY, seabedBaseY + 2 * s, pal, s, { kind: "observatory", haze: 0.08 });
    this._drawSatelliteWing(ctx, L.eastWingX, L.eastWingY, seabedBaseY + 2 * s, pal, s, { kind: "habitat", haze: 0.08 });

    // 3. Vertical Surface Supply Elevator Guide Shaft (behind left upper transfer bay)
    this._drawSupplyElevatorShaft(ctx, L, pal);

    // 4. Monumental Unified Benthic Fortress Foundation Rising Solidly Out of Central Seabed Ridge
    this._drawSeabedFoundation(ctx, hx + 4 * s, hy + 16 * s, seabedBaseY, 276 * s, 368 * s, pal, s);

    // 5. Integrated Flanking Lower Wing Modules Seated Flush on Central Foundation Terrace
    this._drawArchitecturalModule(ctx, hx - 124 * s, hy + 16 * s, 68 * s, 36 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 66 * s, hy + 14 * s, 72 * s, 36 * s, pal, s, { rows: 2 });

    // 6. Upper Rear Modules & Surface Supply Elevator Airlock Tower seated flush into foundation terrace
    this._drawArchitecturalModule(ctx, L.elevX - 28 * s, L.elevDockY + 6 * s, 58 * s, 46 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 28 * s, hy - 52 * s, 60 * s, 44 * s, pal, s, { rows: 2, hasTanks: true });

    // Clear glass connecting gallery from Command Hub to Hydroponics Biodome Wing
    this._drawClearGlassTube(ctx, hx + 32 * s, hy - 4 * s, L.domeX - 24 * s, L.domeY + 10 * s, 14 * s, s, pal);

    // 7. Geodesic Hydroponics Biodome Seated Solidly on Right Foundation Terrace
    ctx.save();
    ctx.translate(L.domeX, L.domeY + 12 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.ellipse(0, 3 * s, 44 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-42 * s, 3 * s, 84 * s, 15 * s);
    this._drawWindowBand(ctx, -32 * s, 8 * s, 64 * s, 4.4 * s, 5, pal, s);

    const bioG = ctx.createRadialGradient(-4 * s, -12 * s, 4 * s, 0, -6 * s, 38 * s);
    bioG.addColorStop(0, pal.biodomeFlora);
    bioG.addColorStop(0.62, pal.isDark ? "rgba(253, 224, 146, 0.45)" : "rgba(218, 246, 255, 0.48)");
    bioG.addColorStop(1, "rgba(186, 230, 253, 0.14)");
    ctx.fillStyle = bioG;
    ctx.beginPath();
    ctx.arc(0, 0, 36 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Subtle glass specular arc on biodome
    ctx.strokeStyle = pal.glassHighlight;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.0 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 32 * s, Math.PI * 1.15, Math.PI * 1.48);
    ctx.stroke();

    ctx.strokeStyle = pal.hullLight;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 36 * s, Math.PI, 0);
    ctx.moveTo(-36 * s, 0);
    ctx.lineTo(36 * s, 0);
    ctx.moveTo(-32 * s, -15 * s);
    ctx.lineTo(32 * s, -15 * s);
    ctx.moveTo(-22 * s, -27 * s);
    ctx.lineTo(22 * s, -27 * s);
    [-20, -9, 0, 9, 20].forEach(rx => {
      ctx.moveTo(rx * s, 0);
      ctx.quadraticCurveTo(rx * 0.65 * s, -21 * s, 0, -36 * s);
    });
    ctx.stroke();
    ctx.restore();

    // 8. Twin Foreground Radiating Pressurized Submarine Docking Piers
    this._drawPressurizedTunnel(ctx, hx - 20 * s, hy + 24 * s, L.leftDockX, L.leftDockY, 22 * s, s, pal);
    this._drawPressurizedTunnel(ctx, hx + 20 * s, hy + 28 * s, L.rightDockX, L.rightDockY, 25 * s, s, pal);

    // 9. Central Multi-Tier Octagonal Command Hub
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.roundRect(-60 * s, 4 * s, 120 * s, 32 * s, 10 * s);
    ctx.fill();

    const ringG = ctx.createLinearGradient(-64 * s, -18 * s, 64 * s, 18 * s);
    ringG.addColorStop(0, pal.hullLight);
    ringG.addColorStop(0.55, pal.hullMid);
    ringG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 66 * s, 25 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ambient ocean bounce rim along command ring
    ctx.strokeStyle = pal.waterBounce;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 66 * s, 25 * s, 0, Math.PI * 1.05, Math.PI * 1.92);
    ctx.stroke();

    // Stepped observation dome collar
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.arc(0, -4 * s, 46 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Cupola ribs on main dome
    ctx.strokeStyle = pal.hullDeep;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.15 * s;
    [-25, 0, 25].forEach(rx => {
      ctx.beginPath();
      ctx.moveTo(rx * s, -4 * s);
      ctx.quadraticCurveTo(rx * 0.55 * s, -27 * s, 0, -50 * s);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (pal.isDark) {
      const bridgeHalo = ctx.createRadialGradient(0, -4 * s, 8 * s, 0, -4 * s, 64 * s);
      bridgeHalo.addColorStop(0, "rgba(253, 224, 142, 0.28)");
      bridgeHalo.addColorStop(1, "rgba(253, 224, 142, 0)");
      ctx.fillStyle = bridgeHalo;
      ctx.beginPath();
      ctx.arc(0, -4 * s, 64 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Recessed panoramic command bridge windows with warm gradient & mullions
    this._drawWindowBand(ctx, -41 * s, -13 * s, 82 * s, 9.2 * s, 8, pal, s);

    // Multi-Stage Communications & Hydrophone Spire
    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(-9.5 * s, -62 * s, 19 * s, 23 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(-13 * s, -68 * s, 26 * s, 5.5 * s);
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 2.0 * s;
    ctx.beginPath();
    ctx.moveTo(0, -68 * s);
    ctx.lineTo(0, -110 * s);
    ctx.moveTo(-11 * s, -84 * s);
    ctx.lineTo(11 * s, -84 * s);
    ctx.moveTo(-7.5 * s, -96 * s);
    ctx.lineTo(7.5 * s, -96 * s);
    ctx.stroke();

    // 10. Front-Right Grounded ROV Terrace Pad
    ctx.translate(46 * s, 26 * s);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-26 * s, 0, 52 * s, 14 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(-28 * s, 0);
    ctx.lineTo(0, -12 * s);
    ctx.lineTo(28 * s, 0);
    ctx.lineTo(0, 12 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.trimGold;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // Gentle horizontal/diagonal submarine approach corridors (no artificial vertical top-edge plunges!)
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

    // 1. True Whales gliding across deep background lanes
    if (this.whales.length === 0) {
      this.whales = [
        { x: w * 0.22, y: h * 0.20, vx: 0.20, len: isNarrow ? 74 : 112, depth: 0.26, phase: 0 },
        { x: w * 0.86, y: h * 0.14, vx: -0.16, len: isNarrow ? 62 : 90, depth: 0.18, phase: 2.4 }
      ];
    }

    // 2. Sharks: Great Whites, Hammerheads, Whale Sharks with unified rigid-torso silhouettes
    if (this.sharks.length === 0) {
      this.sharks = [
        { species: "great_white", x: w * 0.30, y: h * 0.25, vx: 0.56, size: isNarrow ? 27 : 37, depth: 0.56, phase: 0.4 },
        { species: "great_white", x: w * 0.39, y: h * 0.21, vx: 0.49, size: isNarrow ? 23 : 30, depth: 0.44, phase: 1.9 },
        { species: "hammerhead", x: w * 0.72, y: h * 0.30, vx: -0.62, size: isNarrow ? 25 : 34, depth: 0.64, phase: 1.1 },
        { species: "whale_shark", x: w * 0.14, y: h * 0.15, vx: 0.32, size: isNarrow ? 44 : 62, depth: 0.48, phase: 2.8 }
      ];
    }

    // 3. Manta Rays & Dense Fish Schools
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
      const schoolCount = isNarrow ? 14 : 26;
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
      const count = isNarrow ? 24 : 44;
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

    // 4. Vertical Surface Supply Elevator (starts descending partway down shaft)
    if (!this.elevator) {
      this.elevator = {
        phase: "descending",
        t: 5.5,
        phaseDuration: this._rand(14.0, 18.5),
        y: (L.elevDockY - 12) * 0.42
      };
    }

    // 5. Left-Pier Visiting Submarine (arc-length velocity-continuous cruising & level buoyant trim)
    if (!this.sub) {
      const dirX = Math.cos(L.leftAngle);
      const dirY = Math.sin(L.leftAngle);
      const holdPt = { x: L.leftDockX + dirX * (130 * s), y: L.leftDockY + dirY * (130 * s) };
      this.sub = {
        style: "crew_shuttle",
        phase: "approaching",
        t: 0,
        dist: 120,
        speed: 17.5,
        cruiseSpeed: 18.0,
        phaseDuration: this._rand(10.0, 15.0),
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

    // 6. Right-Pier Modular Cargo / Research Submarine (starts docked, level buoyant trim)
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

    // 7. Extra Multi-Directional Roaming Submarines (Science Bathyscaphe + Far Depth Transit Sub)
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
          style: "bathyscaphe",
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
          style: "research_catamaran",
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

    // 8. 3 Maintenance ROVs inspecting the seabed reef & clear glass tubes
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
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached water, grounded horizontal clear-tube station, and elevator guide shaft
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Subtle Animated Ocean Surface Ripples & Volumetric God-Rays
    this._drawSurfaceShimmer(ctx, w, pal, step);
    if (pal.rayAlpha > 0.05) {
      this._drawGodRays(ctx, w, h, pal, step, mode);
    }

    // 3. Far-Depth Megafauna & Background Transit Submarines
    this._updateAndDrawWhales(ctx, w, h, pal, dt);
    this._updateAndDrawSharks(ctx, w, h, pal, dt);
    this._updateAndDrawFarLife(ctx, w, h, pal, dt);
    this._updateAndDrawExtraSubs(ctx, w, h, L, pal, dt, step);

    // 4. Animated Surface Supply Elevator Capsule & Station Beacons
    this._drawStationBeacons(ctx, L, pal, step);
    this._updateAndDrawSupplyElevator(ctx, L, pal, dt, step);

    // 5. Left-Pier & Right-Pier Arc-Length Buoyant-Trim Docking Submarines
    this._updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step);

    // 6. 3 Maintenance ROVs with Volumetric Spotlights
    this._updateAndDrawROVs(ctx, w, h, pal, dt, step);

    // 7. Foreground Reef Fish & Bioluminescent Jellyfish
    this._updateAndDrawNearLife(ctx, w, h, pal, dt);

    // 8. Rising Bubbles, Marine Snow & Reactive Sonar Rings
    this._updateAndDrawAmbientParticles(ctx, w, h, pal, dt);
  },

  _drawSurfaceShimmer(ctx, w, pal, step) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 0.082 + Math.sin(step * 0.35 + i) * 0.015) % 1) * w;
      const sy = 5 + (i % 3) * 7 + Math.sin(step * 1.1 + i * 1.7) * 2.5;
      const len = 28 + (i % 4) * 16;
      const a = (0.14 + 0.14 * Math.sin(step * 1.3 + i)) * (pal.isDark ? 0.55 : 0.90);
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
    const slant = mode === "morning" ? 0.36 : 0.28;
    const rayCount = w < 720 ? 5 : 7;
    for (let i = 0; i < rayCount; i++) {
      const baseX = (w * (0.04 + i * (0.58 / rayCount))) + Math.sin(step * 0.5 + i * 1.3) * 28;
      const topW = 24 + (i % 3) * 18;
      const botW = topW * 3.2;
      const rayH = h * (0.68 + (i % 2) * 0.18);
      const pulse = 0.65 + 0.35 * Math.sin(step * 0.85 + i * 2.0);

      const g = ctx.createLinearGradient(baseX, 0, baseX + rayH * slant, rayH);
      g.addColorStop(0, `rgba(${pal.rayColor}, ${(pal.rayAlpha * pulse).toFixed(3)})`);
      g.addColorStop(0.62, `rgba(${pal.rayColor}, ${(pal.rayAlpha * 0.32 * pulse).toFixed(3)})`);
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
    const s = L.s;
    const pulse = 0.5 + 0.5 * Math.sin(step * 3.8);
    ctx.save();

    const mastX = L.hubX;
    const mastY = L.hubY - 110 * s;
    const mg = ctx.createRadialGradient(mastX, mastY, 0, mastX, mastY, 13 * s);
    mg.addColorStop(0, `rgba(248, 113, 113, ${(0.45 + 0.55 * pulse).toFixed(3)})`);
    mg.addColorStop(1, "rgba(248, 113, 113, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mastX, mastY, 13 * s, 0, Math.PI * 2);
    ctx.fill();

    // Subtle navigation marker strobes on West & East horizontal wings
    const wingPulse = 0.5 + 0.5 * Math.sin(step * 3.1 + 1.4);
    [
      { x: L.westWingX - 28 * s, y: L.westWingY - 35 * s },
      { x: L.eastWingX + 23 * s, y: L.eastWingY - 37 * s }
    ].forEach(pt => {
      const wg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 8 * s);
      wg.addColorStop(0, `rgba(56, 189, 248, ${(0.35 + 0.45 * wingPulse).toFixed(3)})`);
      wg.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8 * s, 0, Math.PI * 2);
      ctx.fill();
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
      // Smooth steady hoist velocity with soft start/stop ramps (no mid-travel surge)
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

    ctx.fillStyle = el.phase === "docked_station" ? "#34D399" : "#FBBF24";
    ctx.beginPath();
    ctx.arc(0, -17, 1.9, 0, Math.PI * 2);
    ctx.fill();
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

      const alpha = (0.14 + wh.depth * 0.52) * (pal.isDark ? 0.68 : 0.78);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(wh.x, wh.y);
      if (wh.vx < 0) ctx.scale(-1, 1);

      const L = wh.len;
      const tailWag = Math.sin(wh.phase * 1.4) * (L * 0.06);

      // Steady anterior torso, undulation confined to tail peduncle
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

      // Long humpback pectoral fin anchored deep inside rigid belly midline
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

      const alpha = (0.18 + sh.depth * 0.55) * (pal.isDark ? 0.72 : 0.86);
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

      const visAlpha = (0.14 + f.depth * 0.45) * (pal.isDark ? 0.72 : 0.85);
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

  // Unified 4-Style Theme-Cohesive Submarine Renderer (Bow = +x, Stern = -x, Top = -y)
  _drawSubmarineModel(ctx, style, pal, step, thrusterGlow = 0.3, showBeam = false) {
    const hullG = ctx.createLinearGradient(0, -18, 0, 18);
    hullG.addColorStop(0, pal.subHullLight);
    hullG.addColorStop(0.52, pal.subHullMid);
    hullG.addColorStop(1, pal.subHullDark);

    const beamOrigin = style === "heavy_freighter" ? 64 : (style === "bathyscaphe" ? 28 : 54);
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

    if (style === "bathyscaphe") {
      // Compact Science Bathyscaphe Sphere-Sub (manipulator skids + wide glass front dome)
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

      // Top cyan ambient ocean bounce highlight
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 25, 12, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-10, -15.5, 14, 3.8);

      // Panoramic acrylic observation sphere dome at bow (+x)
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

      // Shrouded stern thruster + vertical stabilizer fin
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-31, -6, 6, 12);
      ctx.beginPath();
      ctx.moveTo(-22, -10);
      ctx.lineTo(-29, -15);
      ctx.lineTo(-29, -7);
      ctx.closePath();
      ctx.fill();
    } else if (style === "research_catamaran") {
      // Twin-Hull Oceanographic Survey Catamaran Vessel
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

      // Ambient ocean top bounce highlight
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-42, -11.5);
      ctx.lineTo(12, -12.5);
      ctx.quadraticCurveTo(38, -12, 48, -3);
      ctx.stroke();

      // Raised panoramic research bridge + dorsal hydrophone fin
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

      // Dive hydroplane fin & shrouded twin stern thruster
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-54, -9, 8, 18);
      ctx.fillRect(14, 1, 11, 2.6);
    } else if (style === "heavy_freighter") {
      // Massive Elongated Segmented Deep-Cargo Freighter with Theme-Cohesive Intermodal Containers
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.roundRect(-64, -16.5, 128, 33, 6.5);
      ctx.fill();

      // Ambient top water-bounce specular ridge
      ctx.fillStyle = pal.waterBounce;
      ctx.fillRect(-58, -16.5, 116, 1.4);

      // Beveled nose docking probe (+x)
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.arc(62, 0, 9.5, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

      // Armored hull structural ribs
      ctx.fillStyle = pal.subHullDark;
      [-42, -12, 18, 44].forEach(rx => {
        ctx.fillRect(rx, -17.5, 4.2, 35);
      });

      // Theme-cohesive cargo containers on dorsal spine
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

      // Cohesive industrial stern collar + quad thruster shroud (-x)
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-56, -16.5, 4.8, 33);
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-68, -14.5, 12, 29);

      // Recessed warm porthole gallery strip
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
      // Sleek Streamlined Crew Transport Shuttle
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

      // Ambient ocean crown bounce rim
      ctx.strokeStyle = pal.waterBounce;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-46, -13.5);
      ctx.lineTo(16, -14.5);
      ctx.quadraticCurveTo(42, -13.5, 53, -3);
      ctx.stroke();

      // Panoramic elevated forward bridge deck
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

      // Dive plane & nose docking collar
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(10, 4, 12, 2.6);
      ctx.beginPath();
      ctx.arc(54, 2, 5.6, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
    }

    // Crisp tiny submarine navigation marker strobe on conning fin
    const navBlink = 0.55 + 0.45 * Math.sin(step * 4.2);
    const navY = style === "bathyscaphe" ? -16.5 : (style === "heavy_freighter" ? -26.5 : -22.5);
    ctx.fillStyle = `rgba(56, 224, 180, ${(0.55 * navBlink).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(style === "heavy_freighter" ? 30 : 4, navY, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Soft stern thruster glow when underway
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

  // Helper to draw a submarine with realistic buoyant trim (upright dorsal tower, ±11.5° pitch)
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

  // Left Pier Submarine (arc-length constant-weight velocity + realistic level buoyant trim)
  _updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step) {
    const sub = this.sub;
    sub.t += dt;
    const s = L.s;

    const armAng = L.leftAngle;
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedPt = { x: L.leftDockX + dirX * (56 * s), y: L.leftDockY + dirY * (56 * s) };
    const holdPt = { x: L.leftDockX + dirX * (132 * s), y: L.leftDockY + dirY * (132 * s) };
    const dockPitch = this._clamp(armAng - Math.PI, -0.20, 0.20); // ~ -0.20 rad (-11.5°)

    let visible = true;
    let targetPitch = sub.pitch;
    let targetFacingLeft = sub.facingLeft;
    const scaleMult = sub.style === "bathyscaphe" ? 0.84 : (sub.style === "research_catamaran" ? 1.02 : 0.96);

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
      // Back slowly straight away from collar maintaining trim before swinging smoothly out
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
        sub.style = this._pick(["crew_shuttle", "research_catamaran", "bathyscaphe"]);
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

  // Right Pier Submarine (heavy freighter / survey sub, weighty arc-length gliding & level trim)
  _updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step) {
    const cs = this.cargoSub;
    cs.t += dt;
    const s = L.s;

    const armAng = L.rightAngle;
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedPt = { x: L.rightDockX + dirX * (66 * s), y: L.rightDockY + dirY * (66 * s) };
    const holdPt = { x: L.rightDockX + dirX * (146 * s), y: L.rightDockY + dirY * (146 * s) };
    const dockPitch = this._clamp(-armAng, -0.20, 0.20); // facingLeft = true, nose tilts gently up into right pier

    let visible = true;
    let targetPitch = cs.pitch;
    let targetFacingLeft = cs.facingLeft;
    const scaleMult = cs.style === "heavy_freighter" ? 1.0 : 0.92;

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
        cs.style = this._pick(["heavy_freighter", "research_catamaran", "crew_shuttle"]);
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
      // docking
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

  // Additional Multi-Directional Science Bathyscaphe & Background Transit Submarines (Arc-Length + Level Trim)
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
            rs.style = this._pick(["bathyscaphe", "crew_shuttle"]);
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
          const sc = rs.style === "bathyscaphe" ? 0.76 : 0.58;
          const tg = rs.phase === "hover_scan" ? 0.20 : 0.52;
          this._renderBuoyantSub(ctx, rs, s, sc, pal, step, tg, true, 0.94);
        }
      } else {
        // Background depth-fogged cruising sub (steady linear velocity across distant ocean lanes)
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

          this._renderBuoyantSub(ctx, rs, s, rs.scale, pal, step, 0.30, false, pal.isDark ? 0.40 : 0.50);

          if (p >= 1) {
            rs.phase = "wait";
            rs.t = 0;
            rs.phaseDuration = this._rand(8.5, 19.0);
          }
        } else if (rs.t >= rs.phaseDuration) {
          const goRight = Math.random() < 0.5;
          rs.startPt = { x: goRight ? -130 : w + 130, y: h * this._rand(0.18, 0.40) };
          rs.endPt = { x: goRight ? w + 130 : -130, y: h * this._rand(0.16, 0.38) };
          rs.style = this._pick(["research_catamaran", "crew_shuttle", "heavy_freighter", "bathyscaphe"]);
          rs.scale = rs.style === "heavy_freighter" ? 0.44 : 0.52;
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
