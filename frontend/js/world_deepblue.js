/**
 * PETTR World Renderer: Underwater — "Deep Blue" (v12.2 Grounded Seabed Station, Surface Elevator & Fleet Overhaul)
 * Grand multi-wing benthic research station grounded solidly onto the volcanic ocean floor:
 * - No spindly stilts: heavy terraced seabed foundation caissons & armored engineering vaults rise directly
 *   from rocky seabed outcrops into the central command hub, geodesic hydroponics dome, left/right docking
 *   abutments, and a vertical Surface Supply Elevator shaft extending cleanly up to the ocean surface.
 * - Animated Surface Supply Elevator capsule traveling smoothly on randomized cycles between ocean surface
 *   and station transfer collar with alignment spotlight & airlock bubbles.
 * - 4 theme-cohesive submarine styles & sizes (Compact Science Bathyscaphe, Streamlined Crew Shuttle,
 *   Twin-Hull Research Catamaran, Massive Modular Heavy Freighter) approaching & departing across multi-directional
 *   3D corridors plus background depth-fogged transit traffic.
 * - Fixed rigid-torso megafauna silhouette math (Great Whites, Hammerheads, Whale Sharks, True Whales) where
 *   dorsal and pectoral fins remain permanently fused to the body at every swimming phase.
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
        surfaceRipple: "rgba(255, 252, 235, 0.56)",
        rayColor: "254, 249, 215",
        rayAlpha: 0.30,
        reefFar: "#3D8BA8",
        reefMid: "#246482",
        reefNear: "#133C54",
        seabedLight: "#4B97B3",
        seabedDark: "#1E5673",
        hullLight: "#E8F1F6",
        hullMid: "#89AABF",
        hullDark: "#325268",
        hullShadow: "rgba(15, 42, 62, 0.34)",
        subHullLight: "#DCEEEF",
        subHullMid: "#7AA8BD",
        subHullDark: "#2F5870",
        subAccent: "#3898A8",
        subContainers: ["#3B7E96", "#4B8B88", "#94A8B8"],
        rovBody: "#C99F52",
        elevatorGlow: "186, 240, 244",
        trimGold: "#D69E3E",
        portholeGlow: "rgba(254, 240, 178, 0.88)",
        windowRecess: "rgba(16, 44, 62, 0.72)",
        biodomeFlora: "rgba(52, 211, 153, 0.45)",
        farCreatureRgb: "24, 86, 114",
        nearCreatureRgb: "14, 56, 78",
        jellyRgb: "56, 189, 248",
        beamAlpha: 0.24,
        beamRgb: "254, 249, 195",
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
        surfaceRipple: "rgba(125, 211, 252, 0.24)",
        rayColor: "56, 189, 248",
        rayAlpha: 0.13,
        reefFar: "#0B263F",
        reefMid: "#071B2E",
        reefNear: "#030D18",
        seabedLight: "#0E2D49",
        seabedDark: "#051424",
        hullLight: "#7C9BB3",
        hullMid: "#395670",
        hullDark: "#152638",
        hullShadow: "rgba(3, 10, 20, 0.48)",
        subHullLight: "#6E91AD",
        subHullMid: "#33526E",
        subHullDark: "#14273C",
        subAccent: "#438A9E",
        subContainers: ["#254866", "#2B5661", "#6D7482"],
        rovBody: "#8F764A",
        elevatorGlow: "125, 211, 252",
        trimGold: "#C8903B",
        portholeGlow: "rgba(253, 224, 138, 0.95)",
        windowRecess: "rgba(6, 16, 30, 0.84)",
        biodomeFlora: "rgba(52, 211, 153, 0.38)",
        farCreatureRgb: "14, 46, 72",
        nearCreatureRgb: "24, 72, 104",
        jellyRgb: "45, 212, 191",
        beamAlpha: 0.48,
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
        surfaceRipple: "rgba(34, 211, 238, 0.14)",
        rayColor: "34, 211, 238",
        rayAlpha: 0.06,
        reefFar: "#06172A",
        reefMid: "#04101F",
        reefNear: "#020812",
        seabedLight: "#081C30",
        seabedDark: "#020A14",
        hullLight: "#4B6982",
        hullMid: "#22384D",
        hullDark: "#0C1826",
        hullShadow: "rgba(1, 5, 14, 0.60)",
        subHullLight: "#476985",
        subHullMid: "#1F374F",
        subHullDark: "#0B1726",
        subAccent: "#287C94",
        subContainers: ["#193852", "#1C454D", "#47596E"],
        rovBody: "#6E5E3D",
        elevatorGlow: "56, 189, 248",
        trimGold: "#A67C38",
        portholeGlow: "rgba(254, 234, 152, 0.96)",
        windowRecess: "rgba(3, 9, 20, 0.90)",
        biodomeFlora: "rgba(45, 212, 191, 0.34)",
        farCreatureRgb: "10, 32, 54",
        nearCreatureRgb: "18, 56, 84",
        jellyRgb: "34, 211, 238",
        beamAlpha: 0.60,
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
      surfaceRipple: "rgba(255, 255, 255, 0.62)",
      rayColor: "230, 249, 255",
      rayAlpha: 0.34,
      reefFar: "#4694B8",
      reefMid: "#2A6D91",
      reefNear: "#15425E",
      seabedLight: "#5AA5C7",
      seabedDark: "#246082",
      hullLight: "#F1F7FB",
      hullMid: "#94B3C9",
      hullDark: "#385870",
      hullShadow: "rgba(16, 48, 74, 0.30)",
      subHullLight: "#E8F4FA",
      subHullMid: "#82ACC6",
      subHullDark: "#325874",
      subAccent: "#2A84A8",
      subContainers: ["#2D7294", "#3B7E84", "#8FAAC2"],
      rovBody: "#C49844",
      elevatorGlow: "224, 247, 250",
      trimGold: "#D69E3E",
      portholeGlow: "rgba(254, 240, 178, 0.88)",
      windowRecess: "rgba(22, 54, 78, 0.72)",
      biodomeFlora: "rgba(52, 211, 153, 0.44)",
      farCreatureRgb: "28, 92, 124",
      nearCreatureRgb: "16, 62, 88",
      jellyRgb: "14, 165, 233",
      beamAlpha: 0.22,
      beamRgb: "240, 253, 250",
      snowRgb: "255, 255, 255",
      biolumAlpha: 0.12
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const seabedY = h * (isNarrow ? 0.80 : 0.75);
    const hubX = w * (isNarrow ? 0.56 : 0.54);
    const hubY = h * (isNarrow ? 0.62 : 0.59);
    const s = isNarrow ? 0.62 : Math.min(1.12, Math.max(0.78, w / 1280));

    // Left-forward pressurized docking arm tip
    const leftAngle = 2.86;
    const leftArmLen = 154 * s;
    const leftDockX = hubX + Math.cos(leftAngle) * leftArmLen;
    const leftDockY = hubY + 10 * s + Math.sin(leftAngle) * leftArmLen;

    // Right-forward heavy cargo pier tip
    const rightAngle = 0.40;
    const rightArmLen = 166 * s;
    const rightDockX = hubX + Math.cos(rightAngle) * rightArmLen;
    const rightDockY = hubY + 20 * s + Math.sin(rightAngle) * rightArmLen;

    // Geodesic hydroponics biodome (right terrace wing seated directly onto continuous seabed plinth)
    const domeX = hubX + 114 * s;
    const domeY = hubY - 12 * s;

    // Vertical Surface Supply Elevator Shaft & Transfer Collar (left-rear terrace wing)
    const elevX = hubX - 96 * s;
    const elevDockY = hubY - 36 * s;

    return {
      isNarrow, seabedY, hubX, hubY, s,
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
    waterGrad.addColorStop(0.45, pal.waterMid);
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

    // 3. Far hazy canyon ridges & distant seamounts
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 36) {
      const canyon = Math.pow(Math.abs((x / w) - 0.50) * 1.9, 1.5) * 95;
      const crag = Math.sin(x * 0.006 + 0.4) * 30 + Math.cos(x * 0.015) * 14;
      ctx.lineTo(x, L.seabedY - 40 - canyon - crag);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = pal.reefFar;
    ctx.globalAlpha = 0.48;
    ctx.fill();
    ctx.restore();

    // 4. Elevated Central Volcanic Ridge & Seabed Basin Supporting Station Plinth
    ctx.save();
    const floorG = ctx.createLinearGradient(0, L.seabedY - 76, 0, h);
    floorG.addColorStop(0, pal.seabedLight);
    floorG.addColorStop(0.55, pal.seabedDark);
    floorG.addColorStop(1, pal.reefNear);
    ctx.fillStyle = floorG;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, L.seabedY - 8);
    ctx.quadraticCurveTo(w * 0.25, L.seabedY - 38, w * 0.54, L.seabedY - 62);
    ctx.quadraticCurveTo(w * 0.80, L.seabedY - 36, w, L.seabedY - 32);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Terraced basalt ridges & boulders around complex perimeter
    ctx.fillStyle = pal.reefMid;
    for (let b = 0; b < 22; b++) {
      const bx = w * (0.12 + (b * 0.041) % 0.78);
      const by = L.seabedY - 18 + ((b * 37) % 105);
      const br = 9 + (b % 5) * 6;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.5, br * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Grand Grounded Multi-Wing 2.5D Underwater Research Complex + Vertical Surface Supply Elevator Shaft
    this._drawResearchStation(ctx, L, pal);

    // 6. Framing Foreground Coral Cliffs & Sea Fans
    ctx.save();
    ctx.fillStyle = pal.reefNear;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.62);
    ctx.quadraticCurveTo(w * 0.08, h * 0.66, w * 0.16, h * 0.78);
    ctx.quadraticCurveTo(w * 0.25, h * 0.87, w * 0.34, h);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h * 0.60);
    ctx.quadraticCurveTo(w * 0.91, h * 0.68, w * 0.84, h * 0.82);
    ctx.quadraticCurveTo(w * 0.76, h * 0.92, w * 0.66, h);
    ctx.closePath();
    ctx.fill();

    this._drawCoralCluster(ctx, w * 0.07, h * 0.68, 28, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.14, h * 0.79, 22, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.22, h * 0.88, 19, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.91, h * 0.69, 26, pal.reefNear);
    this._drawCoralCluster(ctx, w * 0.84, h * 0.84, 20, pal.reefNear);
    ctx.restore();
  },

  _drawCoralCluster(ctx, x, y, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    [-0.62, -0.24, 0.14, 0.54].forEach((ang, idx) => {
      const len = size * (0.7 + (idx % 2) * 0.34);
      const bx = x + Math.sin(ang) * len;
      const by = y - Math.cos(ang) * len;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(ang) * len * 0.45, y - len * 0.55, bx, by);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(ang) * len * 0.55, y - Math.cos(ang) * len * 0.55);
      ctx.lineTo(bx + (idx % 2 === 0 ? -6 : 6), by - 4);
      ctx.stroke();
      ctx.lineWidth = 3;
    });
    ctx.restore();
  },

  // Unified Multi-Tier Sloped Benthic Fortress Foundation Rising Solidly From Seabed Plateau
  _drawSeabedFoundation(ctx, cx, topY, botY, topW, botW, pal, s) {
    ctx.save();
    const h = Math.max(24, botY - topY);

    // 1. Cast bedrock shadow stretching down-right
    ctx.fillStyle = pal.hullShadow;
    ctx.beginPath();
    ctx.ellipse(cx + 14 * s, botY + 4 * s, botW * 0.58, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Main continuous armored bunker hull rising straight from seafloor plateau
    const midY = topY + h * 0.48;
    const midW = topW + (botW - topW) * 0.42;

    // Lower Tier Sloped Fortress Sub-Base
    const lowG = ctx.createLinearGradient(cx - botW * 0.5, 0, cx + botW * 0.5, 0);
    lowG.addColorStop(0, pal.hullLight);
    lowG.addColorStop(0.32, pal.hullMid);
    lowG.addColorStop(0.75, pal.hullMid);
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

    // Horizontal beveled terrace shoulder ledge & rim highlight
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(cx - midW * 0.53, midY - 2 * s, midW * 1.06, 5 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(cx - topW * 0.5, topY, topW * 0.72, 2 * s);
    ctx.globalAlpha = 1;

    // Sloped Structural Wing Buttresses along left, centre & right angles (integral hull plating!)
    ctx.fillStyle = pal.hullDark;
    ctx.globalAlpha = 0.45;
    [-0.28, -0.09, 0.12].forEach(f => {
      ctx.beginPath();
      ctx.moveTo(cx + topW * f - 2 * s, topY);
      ctx.lineTo(cx + topW * f + 2 * s, topY);
      ctx.lineTo(cx + botW * f + 3 * s, botY + 10 * s);
      ctx.lineTo(cx + botW * f - 3 * s, botY + 10 * s);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Sleek Thin Panoramic Recessed Engineering Window Bands with Vertical Mullions
    [0.24, 0.64].forEach((f, idx) => {
      const wy = topY + h * f;
      const bandW = topW * (idx === 0 ? 0.68 : 0.78);
      const bx = cx - bandW * 0.54;
      ctx.fillStyle = pal.windowRecess;
      ctx.fillRect(bx, wy - 1 * s, bandW * 0.85, 5.5 * s);
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(bx + 1.5 * s, wy, bandW * 0.85 - 3 * s, 3.2 * s);
      ctx.fillStyle = pal.hullDark;
      for (let m = 1; m <= 6; m++) {
        ctx.fillRect(bx + (bandW * 0.85 * m) / 7, wy - 0.5 * s, 1.5 * s, 4.5 * s);
      }
    });

    // Anchoring Volcanic Basalt Outcrops & Sediment Shelf Wrapping Cleanly Around Base
    ctx.fillStyle = pal.reefMid;
    ctx.beginPath();
    ctx.moveTo(cx - botW * 0.64, botY + 22 * s);
    ctx.quadraticCurveTo(cx - botW * 0.36, botY - 8 * s, cx - botW * 0.12, botY - 2 * s);
    ctx.quadraticCurveTo(cx + botW * 0.18, botY - 11 * s, cx + botW * 0.42, botY - 3 * s);
    ctx.quadraticCurveTo(cx + botW * 0.58, botY - 9 * s, cx + botW * 0.66, botY + 22 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Sleek Chamfered 2.5D Research Module (slender mullioned panoramic glass strips, chamfered roof, conduits)
  _drawArchitecturalModule(ctx, x, y, bw, bh, pal, s, opts = {}) {
    const frontW = bw * 0.66;
    const depthX = bw * 0.34;
    const bevel = Math.min(8 * s, bh * 0.24);

    ctx.save();
    ctx.fillStyle = pal.hullShadow;
    ctx.fillRect(x + 3 * s, y + bh - 2 * s, bw, 5 * s);

    const mg = ctx.createLinearGradient(x, y, x, y + bh);
    mg.addColorStop(0, pal.hullLight);
    mg.addColorStop(1, pal.hullMid);
    ctx.fillStyle = mg;
    ctx.fillRect(x, y, frontW, bh);

    // Shaded isometric right flank
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + bw, y + bevel * 0.65);
    ctx.lineTo(x + bw, y + bh + bevel * 0.35);
    ctx.lineTo(x + frontW, y + bh);
    ctx.closePath();
    ctx.fill();

    // Chamfered 2.5D roof terrace deck with bright crown edge
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depthX * 0.72, y - bevel);
    ctx.lineTo(x + bw, y - bevel + bevel * 0.65);
    ctx.lineTo(x + frontW, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 1.0 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + frontW, y);
    ctx.stroke();

    // Fine vertical structural pressure seam ribs
    ctx.fillStyle = pal.hullDark;
    ctx.globalAlpha = 0.55;
    [0.32, 0.68].forEach(f => {
      ctx.fillRect(x + frontW * f - 1 * s, y, 2 * s, bh);
    });
    ctx.globalAlpha = 1;

    // Sleek Narrow Panoramic Glass Gallery Bands with Dark Brow Shadow & Vertical Mullions
    const rows = opts.rows || 1;
    for (let r = 0; r < rows; r++) {
      const wy = y + bh * (rows === 1 ? 0.36 : (0.28 + r * 0.34));
      const wh = Math.max(2.6 * s, bh * 0.10);
      ctx.fillStyle = pal.windowRecess;
      ctx.fillRect(x + 4 * s, wy - 1.2 * s, frontW - 8 * s, wh + 2.2 * s);
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(x + 5 * s, wy, frontW - 10 * s, wh);
      ctx.fillStyle = pal.hullDark;
      for (let m = 1; m <= 3; m++) {
        ctx.fillRect(x + 5 * s + ((frontW - 10 * s) * m) / 4, wy - 0.5 * s, 1.2 * s, wh + 1 * s);
      }
      // Subtle recessed return glazing on right wall
      ctx.fillStyle = pal.windowRecess;
      ctx.fillRect(x + frontW + 3 * s, wy + 1 * s, Math.max(4 * s, depthX * 0.54), wh + 1 * s);
      ctx.fillStyle = pal.portholeGlow;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(x + frontW + 4 * s, wy + 1.5 * s, Math.max(3 * s, depthX * 0.45), wh * 0.8);
      ctx.globalAlpha = 1;
    }

    if (opts.hasTanks) {
      ctx.fillStyle = pal.hullLight;
      ctx.beginPath();
      ctx.roundRect(x + frontW * 0.22, y - bevel - 4.5 * s, frontW * 0.52, 5.5 * s, 2.5 * s);
      ctx.fill();
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(x + frontW * 0.34, y - bevel - 4.5 * s, 3 * s, 5.5 * s);
    }
    ctx.restore();
  },

  // Vertical Surface Supply Elevator Shaft rising cleanly from Station Airlock Collar to Ocean Surface!
  _drawSupplyElevatorShaft(ctx, L, pal) {
    const s = L.s;
    const ex = L.elevX;
    const dockY = L.elevDockY;
    ctx.save();

    // Twin high-tensile guide cables stretching vertically all the way to ocean surface (y = 0)
    const railHalf = 5.5 * s;
    const cableG = ctx.createLinearGradient(0, 0, 0, dockY);
    cableG.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    cableG.addColorStop(0.5, pal.hullLight);
    cableG.addColorStop(1, pal.hullDark);

    ctx.strokeStyle = cableG;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(ex - railHalf, 0);
    ctx.lineTo(ex - railHalf, dockY);
    ctx.moveTo(ex + railHalf, 0);
    ctx.lineTo(ex + railHalf, dockY);
    ctx.stroke();

    // Faint central power/telemetry umbilical core + horizontal spreader brackets
    ctx.strokeStyle = pal.hullMid;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = 0.9 * s;
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
    ctx.moveTo(ex - 16 * s, dockY + 8 * s);
    ctx.lineTo(ex - 11 * s, dockY - 8 * s);
    ctx.lineTo(ex + 11 * s, dockY - 8 * s);
    ctx.lineTo(ex + 16 * s, dockY + 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(ex - 12 * s, dockY - 8 * s, 24 * s, 3 * s);

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

    const segs = Math.max(4, Math.floor(len / (24 * s)));
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(sx - 1.5 * s, -thickness * 0.56, 3 * s, thickness * 1.12);
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(sx - (len / segs) * 0.62, -thickness * 0.14, (len / segs) * 0.34, thickness * 0.24);
    }

    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(len - 8 * s, -thickness * 0.62, 9 * s, thickness * 1.24);
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(len - 3 * s, -thickness * 0.54, 2.5 * s, thickness * 1.08);
    ctx.restore();
  },

  _drawResearchStation(ctx, L, pal) {
    const s = L.s;
    const hx = L.hubX;
    const hy = L.hubY;
    const seabedBaseY = L.seabedY + 20 * s;

    // 1. Vertical Surface Supply Elevator Guide Shaft (drawn cleanly behind left upper transfer bay!)
    this._drawSupplyElevatorShaft(ctx, L, pal);

    // 2. Monumental Unified Benthic Fortress Foundation Rising Solidly Out of Seabed Ridge
    this._drawSeabedFoundation(ctx, hx + 6 * s, hy + 16 * s, seabedBaseY, 316 * s, 412 * s, pal, s);

    // 3. Integrated Flanking Lower Wing Modules Seated Flush on Foundation Terrace
    this._drawArchitecturalModule(ctx, hx - 134 * s, hy + 18 * s, 72 * s, 38 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 72 * s, hy + 14 * s, 76 * s, 38 * s, pal, s, { rows: 2 });

    // 4. Upper Rear Modules & Surface Supply Elevator Airlock Tower seated flush into foundation terrace
    this._drawArchitecturalModule(ctx, L.elevX - 30 * s, L.elevDockY + 6 * s, 62 * s, 48 * s, pal, s, { rows: 2, hasTanks: true });
    this._drawArchitecturalModule(ctx, hx + 32 * s, hy - 54 * s, 64 * s, 46 * s, pal, s, { rows: 2, hasTanks: true });

    // Connecting corridor to Hydroponics Biodome Wing
    this._drawPressurizedTunnel(ctx, hx + 28 * s, hy - 6 * s, L.domeX, L.domeY + 12 * s, 20 * s, s, pal);

    // 5. Geodesic Hydroponics Biodome Seated Solidly on Right Foundation Terrace
    ctx.save();
    ctx.translate(L.domeX, L.domeY + 12 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.ellipse(0, 3 * s, 46 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-44 * s, 3 * s, 88 * s, 16 * s);
    ctx.fillStyle = pal.windowRecess;
    ctx.fillRect(-34 * s, 8 * s, 68 * s, 5 * s);
    ctx.fillStyle = pal.portholeGlow;
    ctx.fillRect(-32 * s, 9 * s, 64 * s, 3.2 * s);
    ctx.fillStyle = pal.hullDark;
    for (let wIdx = -2; wIdx <= 2; wIdx++) {
      ctx.fillRect(wIdx * 11 * s, 8 * s, 1.5 * s, 5 * s);
    }

    const bioG = ctx.createRadialGradient(0, -12 * s, 4 * s, 0, -8 * s, 40 * s);
    bioG.addColorStop(0, pal.biodomeFlora);
    bioG.addColorStop(0.65, pal.portholeGlow);
    bioG.addColorStop(1, "rgba(186, 230, 253, 0.15)");
    ctx.fillStyle = bioG;
    ctx.beginPath();
    ctx.arc(0, 0, 38 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.hullLight;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 38 * s, Math.PI, 0);
    ctx.moveTo(-38 * s, 0);
    ctx.lineTo(38 * s, 0);
    ctx.moveTo(-34 * s, -16 * s);
    ctx.lineTo(34 * s, -16 * s);
    ctx.moveTo(-24 * s, -29 * s);
    ctx.lineTo(24 * s, -29 * s);
    [-22, -10, 0, 10, 22].forEach(rx => {
      ctx.moveTo(rx * s, 0);
      ctx.quadraticCurveTo(rx * 0.65 * s, -22 * s, 0, -38 * s);
    });
    ctx.stroke();
    ctx.restore();

    // 6. Twin Radiating Pressurized Docking Piers
    this._drawPressurizedTunnel(ctx, hx - 22 * s, hy + 12 * s, L.leftDockX, L.leftDockY, 24 * s, s, pal);
    this._drawPressurizedTunnel(ctx, hx + 22 * s, hy + 22 * s, L.rightDockX, L.rightDockY, 27 * s, s, pal);

    // 7. Central Multi-Tier Octagonal Command Hub
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.roundRect(-62 * s, 4 * s, 124 * s, 34 * s, 10 * s);
    ctx.fill();

    const ringG = ctx.createLinearGradient(-66 * s, -18 * s, 66 * s, 18 * s);
    ringG.addColorStop(0, pal.hullLight);
    ringG.addColorStop(0.55, pal.hullMid);
    ringG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 68 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stepped observation dome collar
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.arc(0, -4 * s, 48 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Cupola ribs on main dome
    ctx.strokeStyle = pal.hullDark;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.2 * s;
    [-26, 0, 26].forEach(rx => {
      ctx.beginPath();
      ctx.moveTo(rx * s, -4 * s);
      ctx.quadraticCurveTo(rx * 0.55 * s, -28 * s, 0, -52 * s);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (pal.isDark) {
      const bridgeHalo = ctx.createRadialGradient(0, -4 * s, 8 * s, 0, -4 * s, 68 * s);
      bridgeHalo.addColorStop(0, "rgba(253, 224, 138, 0.32)");
      bridgeHalo.addColorStop(1, "rgba(253, 224, 138, 0)");
      ctx.fillStyle = bridgeHalo;
      ctx.beginPath();
      ctx.arc(0, -4 * s, 68 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    // Recessed panoramic command bridge windows
    ctx.fillStyle = pal.windowRecess;
    ctx.fillRect(-43 * s, -14 * s, 86 * s, 10 * s);
    ctx.fillStyle = pal.portholeGlow;
    for (let wi = -4; wi <= 4; wi++) {
      ctx.fillRect(wi * 9.5 * s - 3.5 * s, -13 * s, 7 * s, 8 * s);
    }

    // Multi-Stage Communications & Hydrophone Spire
    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(-10 * s, -64 * s, 20 * s, 24 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(-14 * s, -70 * s, 28 * s, 6 * s);
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, -70 * s);
    ctx.lineTo(0, -114 * s);
    ctx.moveTo(-12 * s, -86 * s);
    ctx.lineTo(12 * s, -86 * s);
    ctx.moveTo(-8 * s, -98 * s);
    ctx.lineTo(8 * s, -98 * s);
    ctx.stroke();

    // 8. Front-Right Grounded ROV Terrace Pad
    ctx.translate(48 * s, 28 * s);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-28 * s, 0, 56 * s, 16 * s);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(-30 * s, 0);
    ctx.lineTo(0, -13 * s);
    ctx.lineTo(30 * s, 0);
    ctx.lineTo(0, 13 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.trimGold;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15 * s, 6.5 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  ensureEntities(w, h) {
    const isNarrow = w < 720;
    const L = this.getLayout(w, h);

    // 1. True Whales gliding across deep background lanes
    if (this.whales.length === 0) {
      this.whales = [
        { x: w * 0.22, y: h * 0.20, vx: 0.21, len: isNarrow ? 74 : 114, depth: 0.26, phase: 0 },
        { x: w * 0.86, y: h * 0.14, vx: -0.17, len: isNarrow ? 62 : 92, depth: 0.18, phase: 2.4 }
      ];
    }

    // 2. Sharks: Great Whites, Hammerheads, Whale Sharks with unified rigid-torso silhouettes
    if (this.sharks.length === 0) {
      this.sharks = [
        { species: "great_white", x: w * 0.30, y: h * 0.25, vx: 0.58, size: isNarrow ? 27 : 38, depth: 0.56, phase: 0.4 },
        { species: "great_white", x: w * 0.39, y: h * 0.21, vx: 0.51, size: isNarrow ? 23 : 31, depth: 0.44, phase: 1.9 },
        { species: "hammerhead", x: w * 0.72, y: h * 0.31, vx: -0.65, size: isNarrow ? 25 : 35, depth: 0.64, phase: 1.1 },
        { species: "whale_shark", x: w * 0.14, y: h * 0.15, vx: 0.34, size: isNarrow ? 44 : 64, depth: 0.48, phase: 2.8 }
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
          vx: (i % 2 === 0 ? -1 : 1) * (0.42 + Math.random() * 0.22),
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
          vx: (rightGroup ? -1 : 1) * (0.55 + Math.random() * 0.28),
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
          y: h * (0.54 + Math.random() * 0.32),
          vx: dir * (0.80 + Math.random() * 0.52),
          size: 6 + Math.random() * 3.5,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.jellies.length === 0) {
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.jellies.push({
          x: w * (0.12 + i * 0.34),
          y: h * (0.30 + Math.random() * 0.36),
          vy: -(0.13 + Math.random() * 0.10),
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

    // 4. Vertical Surface Supply Elevator (starts descending partway down shaft so immediately active!)
    if (!this.elevator) {
      this.elevator = {
        phase: "descending",
        t: 5.5,
        phaseDuration: this._rand(13.0, 17.5),
        y: (L.elevDockY - 12) * 0.42
      };
    }

    // 5. Left-Pier Visiting Submarine (varied styles + randomized multi-directional corridors)
    if (!this.sub) {
      this.sub = {
        style: "crew_shuttle",
        phase: "approaching",
        t: 2.2,
        phaseDuration: this._rand(9.5, 13.0),
        corridor: this._pick(["upper_dive", "mid_cruise", "deep_rise"]),
        entryX: -140,
        entryY: h * 0.36,
        x: -140,
        y: L.leftDockY - 40,
        heading: 0.12
      };
      this._assignCorridorEndpoints(this.sub, "left", w, h, L);
    }

    // 6. Right-Pier Modular Cargo / Research Submarine (starts docked, varied corridors & styles)
    if (!this.cargoSub) {
      this.cargoSub = {
        style: "heavy_freighter",
        phase: "docked",
        t: 0,
        phaseDuration: this._rand(9.0, 15.0),
        corridor: this._pick(["upper_dive", "mid_cruise", "deep_rise"]),
        exitX: w + 170,
        exitY: L.rightDockY + 40,
        x: L.rightDockX,
        y: L.rightDockY,
        heading: L.rightAngle + Math.PI
      };
      this._assignCorridorEndpoints(this.cargoSub, "right", w, h, L);
    }

    // 7. Extra Multi-Directional Roaming Submarines (Science Bathyscaphe + Far Depth Transit Sub)
    if (this.roamingSubs.length === 0) {
      this.roamingSubs = [
        {
          id: "science_visitor",
          role: "visitor",
          style: "bathyscaphe",
          phase: "patrol_in",
          t: 2.0,
          phaseDuration: this._rand(11.0, 15.0),
          fromPt: { x: w + 110, y: h * 0.24 },
          hoverPt: { x: L.domeX + 86 * L.s, y: L.domeY - 18 * L.s },
          exitPt: { x: w * 0.12, y: -60 },
          x: w + 110,
          y: h * 0.24,
          heading: Math.PI
        },
        {
          id: "deep_transit",
          role: "transit",
          style: "research_catamaran",
          phase: "cruising",
          t: 4.0,
          phaseDuration: this._rand(18.0, 26.0),
          startPt: { x: -120, y: h * 0.32 },
          endPt: { x: w + 130, y: h * 0.24 },
          depth: 0.44,
          scale: 0.68,
          x: -120,
          y: h * 0.32,
          heading: 0
        }
      ];
    }

    // 8. 3 Maintenance ROVs with randomized non-periodic pause timers & inspections
    if (this.rovs.length === 0) {
      this.rovs = [
        {
          waypoints: [
            { x: 0.26, y: 0.72, beamAngle: 0.58 },
            { x: 0.35, y: 0.77, beamAngle: 0.38 },
            { x: 0.21, y: 0.67, beamAngle: 0.78 },
            { x: 0.30, y: 0.65, beamAngle: 0.25 }
          ],
          wpIdx: 0, x: w * 0.28, y: h * 0.71, beamAngle: 0.58, pauseTimer: this._rand(2.0, 4.5), phase: 0
        },
        {
          waypoints: [
            { x: 0.84, y: 0.35, beamAngle: 2.38 },
            { x: 0.78, y: 0.30, beamAngle: 2.55 },
            { x: 0.88, y: 0.42, beamAngle: 2.22 }
          ],
          wpIdx: 0, x: w * 0.85, y: h * 0.34, beamAngle: 2.40, pauseTimer: this._rand(2.0, 4.5), phase: 1.4
        },
        {
          waypoints: [
            { x: 0.76, y: 0.84, beamAngle: 2.75 },
            { x: 0.66, y: 0.86, beamAngle: 2.52 },
            { x: 0.80, y: 0.79, beamAngle: 2.95 }
          ],
          wpIdx: 0, x: w * 0.76, y: h * 0.84, beamAngle: 2.75, pauseTimer: this._rand(2.2, 5.0), phase: 2.7
        }
      ];
    }
  },

  _assignCorridorEndpoints(subObj, side, w, h, L) {
    const corr = this._pick(["upper_dive", "mid_cruise", "deep_rise", "cross_shallow"]);
    subObj.corridor = corr;
    if (side === "left") {
      if (corr === "upper_dive") {
        subObj.entryX = -130;
        subObj.entryY = h * this._rand(0.18, 0.34);
      } else if (corr === "deep_rise") {
        subObj.entryX = -120;
        subObj.entryY = h * this._rand(0.82, 0.96);
      } else if (corr === "cross_shallow") {
        subObj.entryX = w * this._rand(0.06, 0.24);
        subObj.entryY = -75;
      } else {
        subObj.entryX = -145;
        subObj.entryY = L.leftDockY + this._rand(-45, 55);
      }
    } else {
      if (corr === "upper_dive") {
        subObj.exitX = w + 150;
        subObj.exitY = h * this._rand(0.18, 0.36);
      } else if (corr === "deep_rise") {
        subObj.exitX = w + 145;
        subObj.exitY = h * this._rand(0.80, 0.94);
      } else if (corr === "cross_shallow") {
        subObj.exitX = w * this._rand(0.74, 0.92);
        subObj.exitY = -80;
      } else {
        subObj.exitX = w + 165;
        subObj.exitY = L.rightDockY + this._rand(-45, 55);
      }
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
      this.sub.phase = "departing";
      this.sub.t = 0;
      this.sub.phaseDuration = this._rand(10.0, 13.0);
    } else if (this.cargoSub && this.cargoSub.phase === "docked" && this.cargoSub.t > 1.2) {
      this.cargoSub.phase = "departing";
      this.cargoSub.t = 0;
      this.cargoSub.phaseDuration = this._rand(11.0, 14.5);
    } else if (this.elevator && (this.elevator.phase === "docked_station" || this.elevator.phase === "at_surface") && this.elevator.t > 1.0) {
      this.elevator.phase = this.elevator.phase === "at_surface" ? "descending" : "ascending";
      this.elevator.t = 0;
      this.elevator.phaseDuration = this._rand(12.0, 16.0);
    }
  },

  draw(ctx, w, h, mode, dt, step) {
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached water, grounded seabed station, and elevator guide shaft
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

    // 5. Left-Pier & Right-Pier Multi-Directional Docking Submarines
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
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.0);
    ctx.save();

    const mastX = L.hubX;
    const mastY = L.hubY - 114 * s;
    const mg = ctx.createRadialGradient(mastX, mastY, 0, mastX, mastY, 14 * s);
    mg.addColorStop(0, `rgba(248, 113, 113, ${(0.45 + 0.55 * pulse).toFixed(3)})`);
    mg.addColorStop(1, "rgba(248, 113, 113, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mastX, mastY, 14 * s, 0, Math.PI * 2);
    ctx.fill();

    const bays = [
      { x: L.leftDockX, y: L.leftDockY, active: this.sub && this.sub.phase !== "patrol_wait" },
      { x: L.rightDockX, y: L.rightDockY, active: this.cargoSub && this.cargoSub.phase !== "patrol_wait" },
      { x: L.elevX, y: L.elevDockY - 4 * s, active: this.elevator && this.elevator.phase === "docked_station" }
    ];
    bays.forEach(bay => {
      const rgb = bay.active ? "52, 211, 153" : "56, 189, 248";
      const a = bay.active ? (0.50 + 0.42 * pulse) : (0.25 + 0.22 * pulse);
      const dg = ctx.createRadialGradient(bay.x, bay.y, 0, bay.x, bay.y, 15 * s);
      dg.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
      dg.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(bay.x, bay.y, 15 * s, 0, Math.PI * 2);
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
        el.phaseDuration = this._rand(12.5, 17.5);
      }
    } else if (el.phase === "descending") {
      moving = true;
      const p = Math.min(1, el.t / el.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      el.y = topY + (botY - topY) * ease;
      if (el.t >= el.phaseDuration) {
        el.phase = "docked_station";
        el.t = 0;
        el.phaseDuration = this._rand(8.0, 15.0);
      }
    } else if (el.phase === "docked_station") {
      el.y = botY + Math.sin(step * 2.2) * 0.4;
      if (el.t >= el.phaseDuration) {
        el.phase = "ascending";
        el.t = 0;
        el.phaseDuration = this._rand(12.5, 17.5);
      }
    } else {
      moving = true;
      const p = Math.min(1, el.t / el.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      el.y = botY + (topY - botY) * ease;
      if (el.t >= el.phaseDuration) {
        el.phase = "at_surface";
        el.t = 0;
        el.phaseDuration = this._rand(6.5, 14.0);
      }
    }

    if (el.y < -14) return;

    if (moving && Math.random() < 0.28) {
      this.bubbles.push({
        x: L.elevX + (Math.random() - 0.5) * 14 * s,
        y: el.y - 10 * s,
        r: 1.0 + Math.random() * 1.5,
        vy: -(0.38 + Math.random() * 0.4),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.32 + Math.random() * 0.22
      });
    }

    ctx.save();
    ctx.translate(L.elevX, el.y);
    ctx.scale(s, s);

    // Alignment beacon cone pointing downward toward transfer collar on approach
    if (el.phase === "descending" && el.y > botY * 0.45) {
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const cg = ctx.createLinearGradient(0, 12, 0, 56);
      cg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${pal.isDark ? 0.34 : 0.16})`);
      cg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-6, 12);
      ctx.lineTo(-18, 56);
      ctx.lineTo(18, 56);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // Upper guide-cable trolley yoke
    ctx.fillStyle = pal.subHullDark;
    ctx.fillRect(-10, -16, 20, 4);

    // Pressurized 2.5D cylindrical supply capsule
    const eg = ctx.createLinearGradient(-12, 0, 12, 0);
    eg.addColorStop(0, pal.subHullLight);
    eg.addColorStop(0.55, pal.subHullMid);
    eg.addColorStop(1, pal.subHullDark);
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.roundRect(-12, -13, 24, 24, 6);
    ctx.fill();

    // Accent collar & glowing observation viewport
    ctx.fillStyle = pal.subAccent;
    ctx.fillRect(-12, -2, 24, 3);
    ctx.fillStyle = pal.portholeGlow;
    ctx.fillRect(-7, -9, 14, 4.5);

    // Lower airlock mating skirt
    ctx.fillStyle = pal.subHullDark;
    ctx.fillRect(-9, 10, 18, 4);

    // Top status strobe (emerald when locked/transferring, amber in transit)
    ctx.fillStyle = el.phase === "docked_station" ? "#34D399" : "#FBBF24";
    ctx.beginPath();
    ctx.arc(0, -17.5, 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _updateAndDrawWhales(ctx, w, h, pal, dt) {
    const scaleDt = dt * 60;
    ctx.save();
    for (let i = 0; i < this.whales.length; i++) {
      const wh = this.whales[i];
      wh.phase += 0.018 * scaleDt;
      wh.x += wh.vx * scaleDt;
      wh.y += Math.sin(wh.phase * 0.6) * 0.14 * scaleDt;

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

      // Steady anterior torso (x from +0.50L to -0.10L), undulation confined to tail peduncle!
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

      // Long humpback pectoral fin anchored deep inside rigid belly midline (zero detachment!)
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
      sh.phase += 0.045 * scaleDt;
      sh.x += sh.vx * scaleDt;
      sh.y += Math.sin(sh.phase * 0.45) * 0.15 * scaleDt;

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
        // Unified rigid-torso Whale Shark: dorsal fin fused directly into upper silhouette path; sway tail-only!
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
        // Dorsal fin integrated cleanly into rigid torso upper contour
        ctx.lineTo(-sz * 0.14, -sz * 0.25);
        ctx.lineTo(-sz * 0.04, -sz * 0.125);
        ctx.quadraticCurveTo(sz * 0.22, -sz * 0.14, sz * 0.52, -sz * 0.05);
        ctx.closePath();
        ctx.fill();

        // Wide pectoral fin rooted deeply inside rigid midline (y = +0.02*sz)
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
        // Unified rigid-torso Hammerhead Shark: scythe dorsal integrated cleanly into torso path; sway tail-only!
        ctx.beginPath();
        ctx.moveTo(sz * 0.50, 0);
        ctx.quadraticCurveTo(sz * 0.28, -sz * 0.085, sz * 0.10, -sz * 0.095);
        // Integrated tall curved scythe dorsal fin
        ctx.quadraticCurveTo(0, -sz * 0.34, -sz * 0.10, -sz * 0.30);
        ctx.quadraticCurveTo(-sz * 0.05, -sz * 0.16, -sz * 0.09, -sz * 0.085);
        // Posterior tapering into undulating peduncle & asymmetrical tail
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.06 + tailSway * 0.45, -sz * 0.46, tailSway - sz * 0.02);
        ctx.lineTo(-sz * 0.68, tailSway * 1.35 - sz * 0.24);
        ctx.lineTo(-sz * 0.52, tailSway * 1.15 + sz * 0.01);
        ctx.lineTo(-sz * 0.57, tailSway * 1.28 + sz * 0.11);
        ctx.lineTo(-sz * 0.44, tailSway + sz * 0.03);
        ctx.quadraticCurveTo(-sz * 0.28, sz * 0.05 + tailSway * 0.45, -sz * 0.10, sz * 0.08);
        ctx.quadraticCurveTo(sz * 0.20, sz * 0.10, sz * 0.50, 0);
        ctx.closePath();
        ctx.fill();

        // Distinct T-shaped hammerhead cephalofoil bar overlapping rigid snout
        ctx.beginPath();
        ctx.roundRect(sz * 0.42, -sz * 0.14, sz * 0.11, sz * 0.28, sz * 0.04);
        ctx.fill();

        // Pectoral fin rooted deep inside steady torso midline (y = +0.01*sz)
        ctx.beginPath();
        ctx.moveTo(sz * 0.16, sz * 0.01);
        ctx.lineTo(0, sz * 0.22);
        ctx.lineTo(-sz * 0.06, sz * 0.01);
        ctx.closePath();
        ctx.fill();
      } else {
        // Unified rigid-torso Great White Shark: triangular dorsal fused into main hull path, zero detachment possible!
        ctx.beginPath();
        ctx.moveTo(sz * 0.54, -sz * 0.01);
        ctx.quadraticCurveTo(sz * 0.32, -sz * 0.11, sz * 0.12, -sz * 0.115);
        // Integrated iconic triangular dorsal fin
        ctx.lineTo(-sz * 0.04, -sz * 0.33);
        ctx.lineTo(-sz * 0.12, -sz * 0.105);
        // Posterior back tapering smoothly to undulating tail peduncle
        ctx.quadraticCurveTo(-sz * 0.28, -sz * 0.07 + tailSway * 0.45, -sz * 0.44, tailSway - sz * 0.028);
        // Crescent caudal tail
        ctx.lineTo(-sz * 0.62, tailSway * 1.35 - sz * 0.24);
        ctx.quadraticCurveTo(-sz * 0.50, tailSway * 1.15, -sz * 0.60, tailSway * 1.30 + sz * 0.20);
        ctx.lineTo(-sz * 0.44, tailSway + sz * 0.036);
        ctx.quadraticCurveTo(-sz * 0.28, sz * 0.08 + tailSway * 0.45, -sz * 0.10, sz * 0.115);
        ctx.quadraticCurveTo(sz * 0.22, sz * 0.14, sz * 0.54, -sz * 0.01);
        ctx.closePath();
        ctx.fill();

        // Pectoral fin rooted deep inside steady torso midline (y = +0.02*sz)
        ctx.beginPath();
        ctx.moveTo(sz * 0.20, sz * 0.02);
        ctx.lineTo(sz * 0.02, sz * 0.26);
        ctx.lineTo(-sz * 0.04, sz * 0.02);
        ctx.closePath();
        ctx.fill();

        // Pale counter-shaded underbelly inside steady torso
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
    hullG.addColorStop(0.55, pal.subHullMid);
    hullG.addColorStop(1, pal.subHullDark);

    const beamOrigin = style === "heavy_freighter" ? 64 : (style === "bathyscaphe" ? 28 : 54);
    if (showBeam) {
      ctx.save();
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const coneLen = pal.isDark ? 120 : 72;
      const bg = ctx.createLinearGradient(beamOrigin, 0, beamOrigin + coneLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.76).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(beamOrigin - 2, -4);
      ctx.lineTo(beamOrigin + coneLen, -24);
      ctx.lineTo(beamOrigin + coneLen, 24);
      ctx.lineTo(beamOrigin - 2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (style === "bathyscaphe") {
      // Compact Science Bathyscaphe Sphere-Sub (manipulator skids + wide glass front dome)
      // Ventral landing skids & robotic sample arm
      ctx.strokeStyle = pal.subHullDark;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-16, 12);
      ctx.lineTo(18, 12);
      ctx.moveTo(-10, 8);
      ctx.lineTo(-12, 12);
      ctx.moveTo(8, 8);
      ctx.lineTo(11, 12);
      ctx.stroke();

      // Main compact bulbous pressure hull
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 26, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Conning hatch collar
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-10, -16, 14, 4);

      // Panoramic acrylic observation sphere dome at bow (+x)
      ctx.fillStyle = pal.portholeGlow;
      ctx.beginPath();
      ctx.arc(19, 0, 8.5, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
      ctx.strokeStyle = pal.subHullLight;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Shrouded stern thruster
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-31, -6, 6, 12);
    } else if (style === "research_catamaran") {
      // Twin-Hull Oceanographic Survey Catamaran Vessel
      // Lower ballast pontoon hull
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.roundRect(-48, 5, 92, 10, 5);
      ctx.fill();

      // Main streamlined upper laboratory hull
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(52, 1);
      ctx.quadraticCurveTo(42, -13, 12, -13);
      ctx.lineTo(-44, -12);
      ctx.lineTo(-48, 5);
      ctx.lineTo(44, 5);
      ctx.quadraticCurveTo(50, 4, 52, 1);
      ctx.closePath();
      ctx.fill();

      // Raised panoramic research bridge + dorsal hydrophone fin
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(30, -13);
      ctx.lineTo(18, -21);
      ctx.lineTo(-12, -21);
      ctx.lineTo(-18, -12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(4, -19, 17, 4.2);

      // Cohesive seafoam-slate stripe + lab viewports
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-36, -3, 76, 2.8);
      ctx.fillStyle = pal.portholeGlow;
      for (let wi = 0; wi < 4; wi++) {
        ctx.fillRect(-26 + wi * 14, -9, 6.5, 3.5);
      }

      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-54, -9, 8, 18);
    } else if (style === "heavy_freighter") {
      // Massive Elongated Segmented Deep-Cargo Freighter with Theme-Cohesive Intermodal Containers!
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.roundRect(-64, -17, 128, 34, 7);
      ctx.fill();

      // Beveled nose docking probe (+x)
      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.arc(62, 0, 10, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();

      // Armored hull ribs
      ctx.fillStyle = pal.subHullDark;
      [-42, -12, 18, 44].forEach(rx => {
        ctx.fillRect(rx, -18, 4.5, 36);
      });

      // Theme-cohesive cargo containers on dorsal spine
      const containers = [
        { x: -38, w: 22, color: pal.subContainers[0] },
        { x: -10, w: 24, color: pal.subContainers[1] },
        { x: 20, w: 20, color: pal.subContainers[2] }
      ];
      containers.forEach(c => {
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, -26, c.w, 10);
        ctx.strokeStyle = pal.subHullDark;
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x, -26, c.w, 10);
      });

      // Cohesive industrial stern collar + quad thruster shroud (-x)
      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-56, -17, 5, 34);
      ctx.fillStyle = pal.subHullDark;
      ctx.fillRect(-68, -15, 12, 30);

      // Porthole strip
      ctx.fillStyle = pal.portholeGlow;
      for (let pi = 0; pi < 6; pi++) {
        ctx.fillRect(-46 + pi * 15, -3, 5, 3.5);
      }

      if (thrusterGlow > 0.1) {
        const tg = ctx.createRadialGradient(-70, 0, 2, -74, 0, 22);
        tg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${(thrusterGlow * 0.72).toFixed(3)})`);
        tg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(-72, 0, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Sleek Streamlined Crew Transport Shuttle
      ctx.fillStyle = hullG;
      ctx.beginPath();
      ctx.moveTo(58, 2);
      ctx.quadraticCurveTo(46, -14, 16, -15);
      ctx.lineTo(-48, -14);
      ctx.lineTo(-56, -9);
      ctx.lineTo(-56, 11);
      ctx.lineTo(-48, 15);
      ctx.lineTo(24, 15);
      ctx.quadraticCurveTo(48, 14, 58, 2);
      ctx.closePath();
      ctx.fill();

      // Panoramic elevated forward bridge deck
      ctx.fillStyle = pal.subHullLight;
      ctx.beginPath();
      ctx.moveTo(36, -13);
      ctx.lineTo(24, -22);
      ctx.lineTo(-8, -22);
      ctx.lineTo(-14, -13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(10, -20, 16, 4.5);

      ctx.fillStyle = pal.subAccent;
      ctx.fillRect(-42, 2, 86, 2.6);
      ctx.fillStyle = pal.portholeGlow;
      for (let wi = 0; wi < 5; wi++) {
        ctx.fillRect(-30 + wi * 13, -6, 6, 3.5);
      }

      ctx.fillStyle = pal.subHullDark;
      ctx.beginPath();
      ctx.arc(54, 2, 6, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
    }

    // Subtle soft stern propulsion glow for non-freighter subs when underway
    if (style !== "heavy_freighter" && thrusterGlow > 0.35) {
      const sTail = style === "bathyscaphe" ? -33 : -56;
      const sg = ctx.createRadialGradient(sTail, 0, 1, sTail - 4, 0, 14);
      sg.addColorStop(0, `rgba(${pal.elevatorGlow}, ${(thrusterGlow * 0.48).toFixed(3)})`);
      sg.addColorStop(1, `rgba(${pal.elevatorGlow}, 0)`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sTail - 4, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Left Pier Submarine (varied sizes & styles, multi-directional approaches & departures)
  _updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step) {
    const sub = this.sub;
    sub.t += dt;
    const s = L.s;

    const armAng = L.leftAngle;
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedX = L.leftDockX + dirX * (58 * s);
    const dockedY = L.leftDockY + dirY * (58 * s);
    const holdX = L.leftDockX + dirX * (138 * s);
    const holdY = L.leftDockY + dirY * (138 * s);
    const dockHeading = armAng - Math.PI; // Nose points right-up into left pier collar!

    let visible = true;
    let propActive = true;
    let targetHeading = sub.heading;
    const scaleMult = sub.style === "bathyscaphe" ? 0.85 : (sub.style === "research_catamaran" ? 1.05 : 1.0);

    if (sub.phase === "approaching") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const res = this._cubicBez(
        { x: sub.entryX, y: sub.entryY },
        { x: (sub.entryX + holdX) * 0.45, y: sub.entryY },
        { x: holdX - Math.cos(dockHeading) * 65 * s, y: holdY - Math.sin(dockHeading) * 65 * s },
        { x: holdX, y: holdY },
        ease
      );
      sub.x = res.x;
      sub.y = res.y;
      targetHeading = res.angle;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docking";
        sub.t = 0;
        sub.phaseDuration = this._rand(3.8, 5.4);
      }
    } else if (sub.phase === "docking") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      sub.x = holdX + (dockedX - holdX) * ease;
      sub.y = holdY + (dockedY - holdY) * ease;
      targetHeading = dockHeading;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docked";
        sub.t = 0;
        sub.phaseDuration = this._rand(8.5, 16.5);
      }
    } else if (sub.phase === "docked") {
      sub.x = dockedX;
      sub.y = dockedY + Math.sin(step * 2.0) * 0.7;
      targetHeading = dockHeading;
      propActive = false;
      if (sub.t >= sub.phaseDuration) {
        this._assignCorridorEndpoints(sub, "left", w, h, L);
        sub.phase = "departing";
        sub.t = 0;
        sub.phaseDuration = this._rand(10.5, 14.5);
      }
    } else if (sub.phase === "departing") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      if (p < 0.28) {
        // Unlatch and back gracefully to turning area before arcing out!
        const bp = p / 0.28;
        const ease = bp * bp * (3 - 2 * bp);
        sub.x = dockedX + (holdX - dockedX) * ease;
        sub.y = dockedY + (holdY - dockedY) * ease;
        targetHeading = dockHeading;
      } else {
        const dp = (p - 0.28) / 0.72;
        const ease = dp * dp * (3 - 2 * dp);
        const res = this._cubicBez(
          { x: holdX, y: holdY },
          { x: holdX + dirX * 55, y: holdY + dirY * 65 },
          { x: (holdX + sub.entryX) * 0.5, y: sub.entryY },
          { x: sub.entryX, y: sub.entryY },
          ease
        );
        sub.x = res.x;
        sub.y = res.y;
        targetHeading = res.angle;
      }
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "patrol_wait";
        sub.t = 0;
        sub.phaseDuration = this._rand(5.5, 14.0);
        sub.style = this._pick(["crew_shuttle", "research_catamaran", "bathyscaphe"]);
      }
    } else {
      visible = false;
      if (sub.t >= sub.phaseDuration) {
        this._assignCorridorEndpoints(sub, "left", w, h, L);
        sub.heading = Math.atan2(holdY - sub.entryY, holdX - sub.entryX);
        sub.phase = "approaching";
        sub.t = 0;
        sub.phaseDuration = this._rand(9.5, 14.0);
      }
    }

    sub.heading = this._lerpAngle(sub.heading, targetHeading, Math.min(1, dt * 4.2));
    if (!visible) return;

    if (propActive && Math.random() < 0.35) {
      this.bubbles.push({
        x: sub.x - Math.cos(sub.heading) * 44 * s,
        y: sub.y - Math.sin(sub.heading) * 44 * s + (Math.random() - 0.5) * 6,
        r: 1.2 + Math.random() * 1.9,
        vy: -(0.35 + Math.random() * 0.45),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.36 + Math.random() * 0.25
      });
    }

    ctx.save();
    ctx.translate(sub.x, sub.y);
    ctx.rotate(sub.heading);
    if (Math.cos(sub.heading) < 0) ctx.scale(1, -1); // Keep dorsal tower always upright regardless of travel vector!
    ctx.scale(s * scaleMult, s * scaleMult);
    this._drawSubmarineModel(ctx, sub.style, pal, step, propActive ? 0.65 : 0.1, sub.phase !== "docked");
    ctx.restore();
  },

  // Right Pier Submarine (heavy freighter / survey sub, multi-directional approaches & departures)
  _updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step) {
    const cs = this.cargoSub;
    cs.t += dt;
    const s = L.s;

    const armAng = L.rightAngle;
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedX = L.rightDockX + dirX * (68 * s);
    const dockedY = L.rightDockY + dirY * (68 * s);
    const holdX = L.rightDockX + dirX * (150 * s);
    const holdY = L.rightDockY + dirY * (150 * s);
    const dockHeading = armAng + Math.PI; // Nose points up-left into right pier collar!

    let visible = true;
    let thrusterGlow = 0;
    let targetHeading = cs.heading;
    const scaleMult = cs.style === "heavy_freighter" ? 1.04 : 0.94;

    if (cs.phase === "docked") {
      cs.x = dockedX;
      cs.y = dockedY + Math.sin(step * 1.7 + 1) * 0.6;
      targetHeading = dockHeading;
      thrusterGlow = 0.22;
      if (cs.t >= cs.phaseDuration) {
        this._assignCorridorEndpoints(cs, "right", w, h, L);
        cs.phase = "departing";
        cs.t = 0;
        cs.phaseDuration = this._rand(11.5, 16.0);
      }
    } else if (cs.phase === "departing") {
      thrusterGlow = 0.85;
      const p = Math.min(1, cs.t / cs.phaseDuration);
      if (p < 0.26) {
        const bp = p / 0.26;
        const ease = bp * bp * (3 - 2 * bp);
        cs.x = dockedX + (holdX - dockedX) * ease;
        cs.y = dockedY + (holdY - dockedY) * ease;
        targetHeading = dockHeading;
      } else {
        const dp = (p - 0.26) / 0.74;
        const ease = dp * dp * (3 - 2 * dp);
        const res = this._cubicBez(
          { x: holdX, y: holdY },
          { x: holdX + dirX * 65, y: holdY + dirY * 65 },
          { x: (holdX + cs.exitX) * 0.5, y: cs.exitY },
          { x: cs.exitX, y: cs.exitY },
          ease
        );
        cs.x = res.x;
        cs.y = res.y;
        targetHeading = res.angle;
      }
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "patrol_wait";
        cs.t = 0;
        cs.phaseDuration = this._rand(6.0, 15.0);
        cs.style = this._pick(["heavy_freighter", "research_catamaran", "crew_shuttle"]);
      }
    } else if (cs.phase === "patrol_wait") {
      visible = false;
      if (cs.t >= cs.phaseDuration) {
        this._assignCorridorEndpoints(cs, "right", w, h, L);
        cs.heading = Math.atan2(holdY - cs.exitY, holdX - cs.exitX);
        cs.phase = "approaching";
        cs.t = 0;
        cs.phaseDuration = this._rand(10.5, 14.5);
      }
    } else if (cs.phase === "approaching") {
      const p = Math.min(1, cs.t / cs.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const res = this._cubicBez(
        { x: cs.exitX, y: cs.exitY },
        { x: (cs.exitX + holdX) * 0.5, y: cs.exitY },
        { x: holdX - Math.cos(dockHeading) * 65 * s, y: holdY - Math.sin(dockHeading) * 65 * s },
        { x: holdX, y: holdY },
        ease
      );
      cs.x = res.x;
      cs.y = res.y;
      targetHeading = res.angle;
      thrusterGlow = 0.72;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "docking";
        cs.t = 0;
        cs.phaseDuration = this._rand(4.0, 5.8);
      }
    } else {
      const p = Math.min(1, cs.t / cs.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      cs.x = holdX + (dockedX - holdX) * ease;
      cs.y = holdY + (dockedY - holdY) * ease;
      targetHeading = dockHeading;
      thrusterGlow = 0.45;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "docked";
        cs.t = 0;
        cs.phaseDuration = this._rand(9.0, 16.0);
      }
    }

    cs.heading = this._lerpAngle(cs.heading, targetHeading, Math.min(1, dt * 4.0));
    if (!visible) return;

    if (thrusterGlow > 0.4 && Math.random() < 0.36) {
      this.bubbles.push({
        x: cs.x - Math.cos(cs.heading) * 56 * s,
        y: cs.y - Math.sin(cs.heading) * 56 * s + (Math.random() - 0.5) * 10,
        r: 1.4 + Math.random() * 2.2,
        vy: -(0.35 + Math.random() * 0.5),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.25
      });
    }

    ctx.save();
    ctx.translate(cs.x, cs.y);
    ctx.rotate(cs.heading);
    if (Math.cos(cs.heading) < 0) ctx.scale(1, -1);
    ctx.scale(s * scaleMult, s * scaleMult);
    this._drawSubmarineModel(ctx, cs.style, pal, step, thrusterGlow, cs.phase !== "docked");
    ctx.restore();
  },

  // Additional Multi-Directional Science Bathyscaphe & Background Transit Submarines
  _updateAndDrawExtraSubs(ctx, w, h, L, pal, dt, step) {
    const s = L.s;
    for (let i = 0; i < this.roamingSubs.length; i++) {
      const rs = this.roamingSubs[i];
      rs.t += dt;

      if (rs.role === "visitor") {
        let vis = true;
        let targetHeading = rs.heading;
        if (rs.phase === "patrol_in") {
          const p = Math.min(1, rs.t / rs.phaseDuration);
          const ease = p * p * (3 - 2 * p);
          const res = this._cubicBez(
            rs.fromPt,
            { x: (rs.fromPt.x + rs.hoverPt.x) * 0.5, y: rs.fromPt.y + 30 },
            { x: rs.hoverPt.x + (rs.fromPt.x > rs.hoverPt.x ? 45 : -45), y: rs.hoverPt.y - 10 },
            rs.hoverPt,
            ease
          );
          rs.x = res.x;
          rs.y = res.y;
          targetHeading = res.angle;
          if (rs.t >= rs.phaseDuration) {
            rs.phase = "hover_scan";
            rs.t = 0;
            rs.phaseDuration = this._rand(5.5, 11.0);
          }
        } else if (rs.phase === "hover_scan") {
          rs.x = rs.hoverPt.x + Math.sin(step * 1.1) * 4 * s;
          rs.y = rs.hoverPt.y + Math.cos(step * 1.4) * 3 * s;
          targetHeading = Math.PI * 0.92;
          if (rs.t >= rs.phaseDuration) {
            const topExit = Math.random() < 0.5;
            rs.exitPt = topExit
              ? { x: w * this._rand(0.15, 0.85), y: -70 }
              : { x: (Math.random() < 0.5 ? -100 : w + 100), y: h * this._rand(0.18, 0.45) };
            rs.phase = "patrol_out";
            rs.t = 0;
            rs.phaseDuration = this._rand(10.0, 14.5);
          }
        } else if (rs.phase === "patrol_out") {
          const p = Math.min(1, rs.t / rs.phaseDuration);
          const ease = p * p * (3 - 2 * p);
          const res = this._cubicBez(
            rs.hoverPt,
            { x: rs.hoverPt.x + 25, y: rs.hoverPt.y - 40 },
            { x: (rs.hoverPt.x + rs.exitPt.x) * 0.5, y: rs.exitPt.y + 20 },
            rs.exitPt,
            ease
          );
          rs.x = res.x;
          rs.y = res.y;
          targetHeading = res.angle;
          if (rs.t >= rs.phaseDuration) {
            rs.phase = "away_wait";
            rs.t = 0;
            rs.phaseDuration = this._rand(7.0, 15.0);
          }
        } else {
          vis = false;
          if (rs.t >= rs.phaseDuration) {
            const fromLeft = Math.random() < 0.45;
            rs.fromPt = fromLeft
              ? { x: -95, y: h * this._rand(0.16, 0.38) }
              : { x: w + 95, y: h * this._rand(0.16, 0.42) };
            rs.hoverPt = {
              x: fromLeft ? L.hubX - 115 * s : L.domeX + 82 * s,
              y: L.hubY - this._rand(12, 34) * s
            };
            rs.style = this._pick(["bathyscaphe", "crew_shuttle"]);
            rs.heading = Math.atan2(rs.hoverPt.y - rs.fromPt.y, rs.hoverPt.x - rs.fromPt.x);
            rs.phase = "patrol_in";
            rs.t = 0;
            rs.phaseDuration = this._rand(11.0, 15.0);
          }
        }

        rs.heading = this._lerpAngle(rs.heading, targetHeading, Math.min(1, dt * 4.0));
        if (vis) {
          ctx.save();
          ctx.translate(rs.x, rs.y);
          ctx.rotate(rs.heading);
          if (Math.cos(rs.heading) < 0) ctx.scale(1, -1);
          const sc = rs.style === "bathyscaphe" ? 0.78 * s : 0.62 * s;
          ctx.scale(sc, sc);
          this._drawSubmarineModel(ctx, rs.style, pal, step, rs.phase === "hover_scan" ? 0.25 : 0.55, true);
          ctx.restore();
        }
      } else {
        // Background depth-fogged cruising sub (traverses across varied depth/directions)
        if (rs.phase === "cruising") {
          const p = Math.min(1, rs.t / rs.phaseDuration);
          rs.x = rs.startPt.x + (rs.endPt.x - rs.startPt.x) * p;
          rs.y = rs.startPt.y + (rs.endPt.y - rs.startPt.y) * p;
          rs.heading = Math.atan2(rs.endPt.y - rs.startPt.y, rs.endPt.x - rs.startPt.x);

          ctx.save();
          ctx.globalAlpha = pal.isDark ? 0.42 : 0.52;
          ctx.translate(rs.x, rs.y);
          ctx.rotate(rs.heading);
          if (Math.cos(rs.heading) < 0) ctx.scale(1, -1);
          ctx.scale(rs.scale * s, rs.scale * s);
          this._drawSubmarineModel(ctx, rs.style, pal, step, 0.35, false);
          ctx.restore();

          if (rs.t >= rs.phaseDuration) {
            rs.phase = "wait";
            rs.t = 0;
            rs.phaseDuration = this._rand(8.0, 19.0);
          }
        } else if (rs.t >= rs.phaseDuration) {
          const goRight = Math.random() < 0.5;
          rs.startPt = { x: goRight ? -130 : w + 130, y: h * this._rand(0.16, 0.42) };
          rs.endPt = { x: goRight ? w + 130 : -130, y: h * this._rand(0.14, 0.40) };
          rs.style = this._pick(["research_catamaran", "crew_shuttle", "heavy_freighter", "bathyscaphe"]);
          rs.scale = rs.style === "heavy_freighter" ? 0.46 : 0.54;
          rs.phase = "cruising";
          rs.t = 0;
          rs.phaseDuration = this._rand(18.0, 27.0);
        }
      }
    }
  },

  _updateAndDrawROVs(ctx, w, h, pal, dt, step) {
    for (let i = 0; i < this.rovs.length; i++) {
      const rov = this.rovs[i];
      rov.phase += dt * 2.0;
      const wp = rov.waypoints[rov.wpIdx];
      const tx = wp.x * w;
      const ty = wp.y * h;
      const dx = tx - rov.x;
      const dy = ty - rov.y;
      const dist = Math.hypot(dx, dy);

      let inspecting = false;
      if (dist > 6) {
        const speed = 22 * dt;
        rov.x += (dx / dist) * Math.min(dist, speed);
        rov.y += (dy / dist) * Math.min(dist, speed);
        const moveAng = Math.atan2(dy, dx);
        rov.beamAngle = this._lerpAngle(rov.beamAngle, moveAng, Math.min(1, dt * 2.4));
      } else {
        inspecting = true;
        const sweepTarget = wp.beamAngle + Math.sin(rov.phase * 0.9) * 0.30;
        rov.beamAngle = this._lerpAngle(rov.beamAngle, sweepTarget, Math.min(1, dt * 2.8));
        rov.pauseTimer -= dt;
        if (rov.pauseTimer <= 0) {
          const next = (rov.wpIdx + 1 + Math.floor(Math.random() * Math.max(1, rov.waypoints.length - 1))) % rov.waypoints.length;
          rov.wpIdx = next;
          rov.pauseTimer = this._rand(2.8, 6.2);
        }
      }

      const hoverY = rov.y + Math.sin(rov.phase * 1.4) * 2.5;
      ctx.save();
      ctx.translate(rov.x, hoverY);

      ctx.save();
      ctx.rotate(rov.beamAngle);
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const beamLen = pal.isDark ? 165 : 102;
      const beamSpread = pal.isDark ? 44 : 28;
      const bg = ctx.createLinearGradient(7, 0, beamLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 1.08).toFixed(3)})`);
      bg.addColorStop(0.52, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.38).toFixed(3)})`);
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

      // Theme-cohesive industrial ROV body
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
