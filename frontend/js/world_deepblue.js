/**
 * PETTR World Renderer: Underwater — "Deep Blue" (v12.1 2.5D Research Complex & Ocean Megafauna Overhaul)
 * Grand multi-wing deep-sea research complex inspired by futuristic sub-aquatic architecture:
 * - Offscreen-cached multi-tier central command hub, tall comms spire, illuminated geodesic hydroponics biodome,
 *   ROV landing pad, massive seabed leg pylons, twin segmented pressurized docking arms, rocky seabed & foreground coral reefs.
 * - Large Transport Submarine (left pier) & massive Modular Cargo Freighter Submarine with containers (right pier)
 *   staggered through docking, resting, and departing cycles with bubble trails & spotlights.
 * - Distinct ocean megafauna with Beer-Lambert depth visibility falloff:
 *   True Whales, Great White Sharks, Hammerhead Sharks, Whale Sharks, Manta Rays, dense fish schools & pulsing jellyfish.
 * - 3 yellow maintenance ROVs patrolling the reef & station pylons with volumetric light cones cutting through the dark.
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
  sub: null,          // Primary transport submarine (kept as .sub for API/test compatibility!)
  cargoSub: null,     // Large modular cargo freighter submarine
  rovs: [],
  sonarRings: [],
  _lastW: 0,
  _lastH: 0,

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
        surfaceRipple: "rgba(255, 252, 235, 0.55)",
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
        trimGold: "#F59E0B",
        portholeGlow: "rgba(254, 240, 178, 0.88)",
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
        trimGold: "#F59E0B",
        portholeGlow: "rgba(253, 224, 138, 0.95)",
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
        trimGold: "#F59E0B",
        portholeGlow: "rgba(254, 234, 152, 0.96)",
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
    // Light / Afternoon — sunlit cerulean crystal ocean (directly echoing inspiration image!)
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
      trimGold: "#F59E0B",
      portholeGlow: "rgba(254, 240, 178, 0.86)",
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
    const seabedY = h * (isNarrow ? 0.84 : 0.80);
    // Grounded monumental central-right research complex nestled above volcanic canyon outcrops
    const hubX = w * (isNarrow ? 0.56 : 0.54);
    const hubY = h * (isNarrow ? 0.60 : 0.55);
    const s = isNarrow ? 0.62 : Math.min(1.12, Math.max(0.76, w / 1280));

    // Left-forward pressurized docking arm tip (for Transport Sub)
    const leftAngle = 2.86; // ~164 deg (down-left)
    const leftArmLen = 158 * s;
    const leftDockX = hubX + Math.cos(leftAngle) * leftArmLen;
    const leftDockY = hubY + 12 * s + Math.sin(leftAngle) * leftArmLen;

    // Right-forward heavy cargo pier tip (for Modular Cargo Sub)
    const rightAngle = 0.42; // ~24 deg (down-right)
    const rightArmLen = 172 * s;
    const rightDockX = hubX + Math.cos(rightAngle) * rightArmLen;
    const rightDockY = hubY + 26 * s + Math.sin(rightAngle) * rightArmLen;

    // Geodesic hydroponics biodome (rear-right wing)
    const domeX = hubX + 132 * s;
    const domeY = hubY - 22 * s;

    return {
      isNarrow, seabedY, hubX, hubY, s,
      leftAngle, leftArmLen, leftDockX, leftDockY,
      rightAngle, rightArmLen, rightDockX, rightDockY,
      domeX, domeY
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

    // 2. Underside of sunlit rippled ocean surface ceiling
    ctx.save();
    const surfG = ctx.createLinearGradient(0, 0, 0, 56);
    surfG.addColorStop(0, pal.surfaceRipple);
    surfG.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = surfG;
    ctx.fillRect(0, 0, w, 56);
    ctx.restore();

    // 3. Far hazy canyon ridges & distant seamounts (deep visibility falloff)
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

    // 4. Sun-dappled rocky seabed basin floor beneath the research station
    ctx.save();
    const floorG = ctx.createLinearGradient(0, L.seabedY - 60, 0, h);
    floorG.addColorStop(0, pal.seabedLight);
    floorG.addColorStop(0.55, pal.seabedDark);
    floorG.addColorStop(1, pal.reefNear);
    ctx.fillStyle = floorG;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, L.seabedY - 20);
    ctx.quadraticCurveTo(w * 0.28, L.seabedY - 58, w * 0.52, L.seabedY - 35);
    ctx.quadraticCurveTo(w * 0.78, L.seabedY - 12, w, L.seabedY - 45);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Scattered seabed volcanic boulders & pebble clusters
    ctx.fillStyle = pal.reefMid;
    for (let b = 0; b < 18; b++) {
      const bx = w * (0.14 + (b * 0.045) % 0.76);
      const by = L.seabedY - 10 + ((b * 37) % 105);
      const br = 8 + (b % 5) * 6;
      ctx.beginPath();
      ctx.ellipse(bx, by, br * 1.4, br * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Grand Multi-Wing 2.5D Futuristic Underwater Research Station Complex!
    this._drawResearchStation(ctx, L, pal);

    // 6. Dark Framing Foreground Coral Cliffs & Sea Fans (bottom-left & bottom-right corners)
    ctx.save();
    ctx.fillStyle = pal.reefNear;
    // Bottom-left volcanic coral ledge
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.62);
    ctx.quadraticCurveTo(w * 0.08, h * 0.66, w * 0.16, h * 0.78);
    ctx.quadraticCurveTo(w * 0.25, h * 0.87, w * 0.34, h);
    ctx.closePath();
    ctx.fill();
    // Bottom-right volcanic coral cliff
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
      // Tiny secondary fork
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(ang) * len * 0.55, y - Math.cos(ang) * len * 0.55);
      ctx.lineTo(bx + (idx % 2 === 0 ? -6 : 6), by - 4);
      ctx.stroke();
      ctx.lineWidth = 3;
    });
    ctx.restore();
  },

  _drawPylonLeg(ctx, x, topY, botY, s, pal) {
    ctx.save();
    const w = 13 * s;
    // Main vertical concrete/titanium column with 2.5D lighting
    const colG = ctx.createLinearGradient(x - w * 0.5, 0, x + w * 0.5, 0);
    colG.addColorStop(0, pal.hullLight);
    colG.addColorStop(0.5, pal.hullMid);
    colG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = colG;
    ctx.fillRect(x - w * 0.5, topY, w, botY - topY);

    // Structural horizontal collar rings along leg
    ctx.fillStyle = pal.hullDark;
    const rings = Math.max(3, Math.floor((botY - topY) / (26 * s)));
    for (let r = 1; r <= rings; r++) {
      const ry = topY + (r / (rings + 1)) * (botY - topY);
      ctx.fillRect(x - w * 0.72, ry, w * 1.44, 3 * s);
    }

    // Heavy splayed seabed anchor footing pad + rocky volcanic outcrop mound gripping the leg!
    ctx.fillStyle = pal.reefMid;
    ctx.beginPath();
    ctx.moveTo(x - w * 2.8, botY + 14 * s);
    ctx.quadraticCurveTo(x - w * 1.4, botY - 14 * s, x, botY - 10 * s);
    ctx.quadraticCurveTo(x + w * 1.5, botY - 12 * s, x + w * 2.8, botY + 14 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.moveTo(x - w * 1.6, botY + 6 * s);
    ctx.lineTo(x - w * 0.72, botY - 10 * s);
    ctx.lineTo(x + w * 0.72, botY - 10 * s);
    ctx.lineTo(x + w * 1.6, botY + 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  _drawPressurizedTunnel(ctx, x0, y0, x1, y1, thickness, s, pal) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);

    // Cylindrical 2.5D shaded tunnel hull
    const tg = ctx.createLinearGradient(0, -thickness * 0.5, 0, thickness * 0.5);
    tg.addColorStop(0, pal.hullLight);
    tg.addColorStop(0.55, pal.hullMid);
    tg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = tg;
    ctx.fillRect(0, -thickness * 0.5, len, thickness);

    // Segmented bulkhead expansion ribs + glowing viewport strips
    const segs = Math.max(4, Math.floor(len / (24 * s)));
    for (let i = 1; i < segs; i++) {
      const sx = (i / segs) * len;
      ctx.fillStyle = pal.hullDark;
      ctx.fillRect(sx - 1.5 * s, -thickness * 0.56, 3 * s, thickness * 1.12);
      // Glowing viewport window between bulkheads
      ctx.fillStyle = pal.portholeGlow;
      ctx.fillRect(sx - (len / segs) * 0.62, -thickness * 0.14, (len / segs) * 0.34, thickness * 0.24);
    }

    // Illuminated docking collar bulkhead ring at the far end
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(len - 8 * s, -thickness * 0.62, 9 * s, thickness * 1.24);
    ctx.fillStyle = pal.trimGold;
    ctx.fillRect(len - 3 * s, -thickness * 0.54, 2.5 * s, thickness * 1.08);
    ctx.restore();
  },

  _drawResearchStation(ctx, L, pal) {
    const s = L.s;
    const hx = L.hubX;
    const hy = L.hubY;
    const floorY = L.seabedY + 28 * s;

    // 1. Massive Seabed Support Pylons with diagonal truss bracing anchored onto rocky outcrops
    this._drawPylonLeg(ctx, hx - 106 * s, hy + 28 * s, floorY - 10 * s, s * 0.90, pal);
    this._drawPylonLeg(ctx, hx, hy + 42 * s, floorY + 10 * s, s * 1.15, pal);
    this._drawPylonLeg(ctx, hx + 132 * s, hy + 14 * s, floorY - 16 * s, s * 0.92, pal);
    this._drawPylonLeg(ctx, hx + 96 * s, hy + 68 * s, floorY + 22 * s, s * 0.96, pal);

    // Diagonal structural cross-struts tying the central engineering core to side pylons
    ctx.save();
    ctx.strokeStyle = pal.hullDark;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(hx - 104 * s, hy + 64 * s);
    ctx.lineTo(hx - 24 * s, hy + 36 * s);
    ctx.moveTo(hx + 24 * s, hy + 38 * s);
    ctx.lineTo(hx + 94 * s, hy + 82 * s);
    ctx.stroke();
    ctx.restore();

    // Suspended sub-deck engineering bay hanging cleanly beneath central hub
    this._drawHabitatBox(ctx, hx - 34 * s, hy + 36 * s, 68 * s, 26 * s, pal);

    // 2. Rear Habitat Wings & Upper Lab Modules
    // Rear-left habitat tower
    this._drawHabitatBox(ctx, hx - 102 * s, hy - 34 * s, 56 * s, 32 * s, pal);
    // Rear-centre engineering block
    this._drawHabitatBox(ctx, hx + 46 * s, hy - 56 * s, 54 * s, 30 * s, pal);

    // Connecting corridor to rear-right Geodesic Hydroponics Biodome
    this._drawPressurizedTunnel(ctx, hx + 28 * s, hy - 8 * s, L.domeX, L.domeY + 12 * s, 20 * s, s, pal);

    // 3. Iconic Rear-Right Geodesic Hydroponics Biodome!
    ctx.save();
    ctx.translate(L.domeX, L.domeY + 14 * s);
    // Circular base ring platform
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 46 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-44 * s, 4 * s, 88 * s, 16 * s);
    // Illuminated lower laboratory windows beneath dome
    ctx.fillStyle = pal.portholeGlow;
    for (let wIdx = -3; wIdx <= 3; wIdx++) {
      ctx.fillRect(wIdx * 11 * s - 3 * s, 9 * s, 6 * s, 4.5 * s);
    }

    // Glowing lush interior hydroponics flora glow inside glass dome
    const bioG = ctx.createRadialGradient(0, -12 * s, 4 * s, 0, -8 * s, 40 * s);
    bioG.addColorStop(0, pal.biodomeFlora);
    bioG.addColorStop(0.65, pal.portholeGlow);
    bioG.addColorStop(1, "rgba(186, 230, 253, 0.15)");
    ctx.fillStyle = bioG;
    ctx.beginPath();
    ctx.arc(0, 0, 38 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Crisp Geodesic Lattice Frame
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

    // 4. Twin Radiating Pressurized Submarine Docking Arms (Left Transport Pier & Right Cargo Pier!)
    this._drawPressurizedTunnel(ctx, hx - 22 * s, hy + 12 * s, L.leftDockX, L.leftDockY, 24 * s, s, pal);
    this._drawPressurizedTunnel(ctx, hx + 22 * s, hy + 24 * s, L.rightDockX, L.rightDockY, 27 * s, s, pal);

    // 5. Central Multi-Tier Octagonal Command Hub
    ctx.save();
    ctx.translate(hx, hy);
    // Lower engineering under-hull
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.roundRect(-58 * s, 4 * s, 116 * s, 36 * s, 10 * s);
    ctx.fill();

    // Main circular pressure ring deck
    const ringG = ctx.createLinearGradient(-64 * s, -18 * s, 64 * s, 18 * s);
    ringG.addColorStop(0, pal.hullLight);
    ringG.addColorStop(0.55, pal.hullMid);
    ringG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, 66 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Upper stepped command dome
    ctx.fillStyle = ringG;
    ctx.beginPath();
    ctx.arc(0, -4 * s, 46 * s, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Panoramic golden command bridge windows wrapping around hub!
    if (pal.isDark) {
      const bridgeHalo = ctx.createRadialGradient(0, -4 * s, 8 * s, 0, -4 * s, 68 * s);
      bridgeHalo.addColorStop(0, "rgba(253, 224, 138, 0.34)");
      bridgeHalo.addColorStop(1, "rgba(253, 224, 138, 0)");
      ctx.fillStyle = bridgeHalo;
      ctx.beginPath();
      ctx.arc(0, -4 * s, 68 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pal.portholeGlow;
    for (let wi = -4; wi <= 4; wi++) {
      ctx.fillRect(wi * 9.5 * s - 3.5 * s, -12 * s, 7 * s, 8 * s);
    }

    // Tall Multi-Stage Communications & Hydrophone Spire at Centre Crown
    ctx.fillStyle = pal.hullMid;
    ctx.fillRect(-10 * s, -62 * s, 20 * s, 24 * s);
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(-14 * s, -68 * s, 28 * s, 6 * s);
    ctx.strokeStyle = pal.hullLight;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, -68 * s);
    ctx.lineTo(0, -112 * s);
    ctx.moveTo(-12 * s, -84 * s);
    ctx.lineTo(12 * s, -84 * s);
    ctx.moveTo(-8 * s, -96 * s);
    ctx.lineTo(8 * s, -96 * s);
    ctx.stroke();

    // 6. Front-Right External ROV Helipad / Landing Deck with Yellow Circle
    ctx.translate(48 * s, 26 * s);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(-28 * s, 0, 56 * s, 14 * s);
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

  _drawHabitatBox(ctx, x, y, bw, bh, pal) {
    ctx.save();
    ctx.fillStyle = pal.hullLight;
    ctx.fillRect(x, y, bw * 0.65, bh);
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(x + bw * 0.65, y, bw * 0.35, bh);
    ctx.fillStyle = pal.hullMid;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bw * 0.25, y - 8);
    ctx.lineTo(x + bw, y - 8);
    ctx.lineTo(x + bw, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.portholeGlow;
    ctx.fillRect(x + 6, y + bh * 0.36, bw * 0.45, 4);
    ctx.restore();
  },

  ensureEntities(w, h) {
    const isNarrow = w < 720;
    const L = this.getLayout(w, h);

    // 1. True Whales gliding slowly through deep background water (strong depth fog!)
    if (this.whales.length === 0) {
      this.whales = [
        {
          x: w * 0.22,
          y: h * 0.20,
          vx: 0.22,
          len: isNarrow ? 74 : 112,
          depth: 0.26,
          phase: 0
        },
        {
          x: w * 0.86,
          y: h * 0.14,
          vx: -0.18,
          len: isNarrow ? 62 : 90,
          depth: 0.18,
          phase: 2.4
        }
      ];
    }

    // 2. Sharks: Great Whites, Hammerheads, and Whale Sharks across depth planes!
    if (this.sharks.length === 0) {
      this.sharks = [
        { species: "great_white", x: w * 0.32, y: h * 0.24, vx: 0.62, size: isNarrow ? 26 : 36, depth: 0.54, phase: 0.4 },
        { species: "great_white", x: w * 0.39, y: h * 0.22, vx: 0.56, size: isNarrow ? 22 : 30, depth: 0.42, phase: 1.9 },
        { species: "hammerhead", x: w * 0.72, y: h * 0.31, vx: -0.68, size: isNarrow ? 24 : 33, depth: 0.62, phase: 1.1 },
        { species: "whale_shark", x: w * 0.14, y: h * 0.15, vx: 0.34, size: isNarrow ? 44 : 62, depth: 0.48, phase: 2.8 }
      ];
    }

    // 3. Distant Manta Rays & Dense Schooling Fish
    if (this.farLife.length === 0) {
      for (let i = 0; i < (isNarrow ? 2 : 3); i++) {
        this.farLife.push({
          kind: "manta",
          depth: 0.36 + i * 0.14,
          x: w * (0.15 + i * 0.35),
          y: h * (0.18 + i * 0.08),
          vx: (i % 2 === 0 ? -1 : 1) * (0.44 + Math.random() * 0.22),
          span: 24 + i * 9,
          phase: Math.random() * Math.PI * 2
        });
      }
      // Dense schooling fish swarm sweeping upper-left and upper-right like the inspiration image
      const schoolCount = isNarrow ? 14 : 26;
      for (let i = 0; i < schoolCount; i++) {
        const rightGroup = i >= schoolCount * 0.55;
        this.farLife.push({
          kind: "fish",
          depth: 0.28 + (i % 4) * 0.09,
          x: (rightGroup ? w * 0.68 : w * 0.08) + (i % 8) * 18 + (Math.random() - 0.5) * 24,
          y: (rightGroup ? h * 0.14 : h * 0.27) + (Math.random() - 0.5) * 60,
          vx: (rightGroup ? -1 : 1) * (0.58 + Math.random() * 0.28),
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
          vx: dir * (0.85 + Math.random() * 0.5),
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

    // 4. Primary Large Transport Submarine (docks at left pressurized pier!)
    if (!this.sub) {
      this.sub = {
        phase: "approaching", // approaching -> docking -> docked -> departing -> patrol_wait
        t: 0,
        phaseDuration: 9.2,
        x: -110,
        y: L.leftDockY - 40
      };
    }

    // 5. Massive Modular Cargo Freighter Submarine (docks at right cargo pier — starts docked so station feels grand & alive immediately!)
    if (!this.cargoSub) {
      this.cargoSub = {
        phase: "docked",
        t: 0,
        phaseDuration: 11.0,
        x: L.rightDockX,
        y: L.rightDockY
      };
    }

    // 6. 3 Compact Yellow Maintenance ROVs inspecting reef, seabed pylons & biodome with bright light cones
    if (this.rovs.length === 0) {
      this.rovs = [
        {
          // Left foreground canyon/reef inspector ROV
          waypoints: [
            { x: 0.26, y: 0.72, beamAngle: 0.58 },
            { x: 0.34, y: 0.77, beamAngle: 0.42 },
            { x: 0.22, y: 0.68, beamAngle: 0.72 }
          ],
          wpIdx: 0, x: w * 0.28, y: h * 0.71, beamAngle: 0.58, pauseTimer: 2.6, phase: 0
        },
        {
          // Upper-right biodome inspector ROV
          waypoints: [
            { x: 0.84, y: 0.34, beamAngle: 2.38 },
            { x: 0.79, y: 0.30, beamAngle: 2.52 },
            { x: 0.88, y: 0.40, beamAngle: 2.25 }
          ],
          wpIdx: 0, x: w * 0.85, y: h * 0.34, beamAngle: 2.40, pauseTimer: 2.1, phase: 1.4
        },
        {
          // Lower-right cargo pier / seabed inspector ROV
          waypoints: [
            { x: 0.76, y: 0.84, beamAngle: 2.75 },
            { x: 0.68, y: 0.86, beamAngle: 2.55 },
            { x: 0.80, y: 0.79, beamAngle: 2.95 }
          ],
          wpIdx: 0, x: w * 0.76, y: h * 0.84, beamAngle: 2.75, pauseTimer: 2.9, phase: 2.7
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
      this.sub.phase = "departing";
      this.sub.t = 0;
      this.sub.phaseDuration = 10.0;
    } else if (this.cargoSub && this.cargoSub.phase === "docked" && this.cargoSub.t > 1.2) {
      this.cargoSub.phase = "departing";
      this.cargoSub.t = 0;
      this.cargoSub.phaseDuration = 11.5;
    }
  },

  draw(ctx, w, h, mode, dt, step) {
    this._lastW = w;
    this._lastH = h;
    this.ensureStaticCache(w, h, mode);
    this.ensureEntities(w, h);

    const pal = this.getPalette(mode);
    const L = this.getLayout(w, h);

    // 1. Blit offscreen cached water column, seabed, grand multi-wing station & coral reefs
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Animated Volumetric Sunlight God-Rays breaking from upper-left surface
    if (pal.rayAlpha > 0.05) {
      this._drawGodRays(ctx, w, h, pal, step, mode);
    }

    // 3. Far-Depth Megafauna: True Whales (heavily veiled by distance water haze)
    this._updateAndDrawWhales(ctx, w, h, pal, dt);

    // 4. Sharks (Great Whites, Hammerheads, Whale Sharks) & Far Manta Rays / Schools
    this._updateAndDrawSharks(ctx, w, h, pal, dt);
    this._updateAndDrawFarLife(ctx, w, h, pal, dt);

    // 5. Station Live Beacons (spire red strobe + glowing docking bay alignment rings)
    this._drawStationBeacons(ctx, L, pal, step);

    // 6. Large Transport Sub (left pier) & Modular Cargo Freighter Sub (right pier)
    this._updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step);
    this._updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step);

    // 7. 3 Maintenance ROVs shining crisp Volumetric Spotlight Cones
    this._updateAndDrawROVs(ctx, w, h, pal, dt, step);

    // 8. Foreground Reef Fish & Bioluminescent Jellyfish
    this._updateAndDrawNearLife(ctx, w, h, pal, dt);

    // 9. Rising Bubbles, Marine Snow & Reactive Sonar Rings
    this._updateAndDrawAmbientParticles(ctx, w, h, pal, dt);
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

    // Central spire crown red warning beacon (matching inspiration artwork!)
    const mastX = L.hubX;
    const mastY = L.hubY - 112 * s;
    const mg = ctx.createRadialGradient(mastX, mastY, 0, mastX, mastY, 14 * s);
    mg.addColorStop(0, `rgba(248, 113, 113, ${(0.45 + 0.55 * pulse).toFixed(3)})`);
    mg.addColorStop(1, "rgba(248, 113, 113, 0)");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mastX, mastY, 14 * s, 0, Math.PI * 2);
    ctx.fill();

    // Left & Right Docking Bay Alignment Beacons
    const bays = [
      { x: L.leftDockX, y: L.leftDockY, active: this.sub && this.sub.phase !== "patrol_wait" },
      { x: L.rightDockX, y: L.rightDockY, active: this.cargoSub && this.cargoSub.phase !== "patrol_wait" }
    ];
    bays.forEach(bay => {
      const rgb = bay.active ? "52, 211, 153" : "56, 189, 248";
      const a = bay.active ? (0.50 + 0.42 * pulse) : (0.25 + 0.22 * pulse);
      const dg = ctx.createRadialGradient(bay.x, bay.y, 0, bay.x, bay.y, 16 * s);
      dg.addColorStop(0, `rgba(${rgb}, ${a.toFixed(3)})`);
      dg.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(bay.x, bay.y, 16 * s, 0, Math.PI * 2);
      ctx.fill();
    });
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

      if (wh.vx > 0 && wh.x > w + wh.len * 1.4) wh.x = -wh.len * 1.4;
      if (wh.vx < 0 && wh.x < -wh.len * 1.4) wh.x = w + wh.len * 1.4;

      // Strong Beer-Lambert depth fog so giant whales look truly majestic and distant
      const alpha = (0.14 + wh.depth * 0.52) * (pal.isDark ? 0.68 : 0.78);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(wh.x, wh.y);
      if (wh.vx < 0) ctx.scale(-1, 1);

      const L = wh.len;
      const tailWag = Math.sin(wh.phase * 1.4) * (L * 0.065);

      // Graceful humpback/blue whale body contour
      ctx.beginPath();
      ctx.moveTo(L * 0.50, -L * 0.02); // rounded rostrum
      ctx.quadraticCurveTo(L * 0.25, -L * 0.14, -L * 0.05, -L * 0.11); // broad back
      ctx.quadraticCurveTo(-L * 0.28, -L * 0.08, -L * 0.48, tailWag - L * 0.02); // peduncle
      // Sweeping tail flukes
      ctx.lineTo(-L * 0.60, tailWag - L * 0.13);
      ctx.quadraticCurveTo(-L * 0.54, tailWag, -L * 0.60, tailWag + L * 0.12);
      ctx.lineTo(-L * 0.48, tailWag + L * 0.03);
      ctx.quadraticCurveTo(-L * 0.22, L * 0.07, L * 0.08, L * 0.10); // throat pleats
      ctx.quadraticCurveTo(L * 0.36, L * 0.11, L * 0.50, -L * 0.02);
      ctx.closePath();
      ctx.fill();

      // Long graceful humpback pectoral fin
      ctx.beginPath();
      ctx.moveTo(L * 0.16, L * 0.05);
      ctx.quadraticCurveTo(L * 0.02, L * 0.25, -L * 0.09, L * 0.22);
      ctx.quadraticCurveTo(L * 0.02, L * 0.12, L * 0.07, L * 0.04);
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
      sh.y += Math.sin(sh.phase * 0.45) * 0.16 * scaleDt;

      if (sh.vx > 0 && sh.x > w + sh.size * 2) sh.x = -sh.size * 2;
      if (sh.vx < 0 && sh.x < -sh.size * 2) sh.x = w + sh.size * 2;

      const alpha = (0.18 + sh.depth * 0.55) * (pal.isDark ? 0.72 : 0.86);
      ctx.fillStyle = `rgba(${pal.farCreatureRgb}, ${alpha.toFixed(3)})`;

      ctx.save();
      ctx.translate(sh.x, sh.y);
      if (sh.vx < 0) ctx.scale(-1, 1);

      const sz = sh.size;
      const sway = Math.sin(sh.phase * 1.9) * (sz * 0.09);

      if (sh.species === "whale_shark") {
        // Broad-snouted massive gentle Whale Shark with pale dappled spot rows
        ctx.beginPath();
        ctx.moveTo(sz * 0.52, -sz * 0.05);
        ctx.lineTo(sz * 0.50, sz * 0.08); // wide blunt filter-feeder mouth
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.15, -sz * 0.44, sway + sz * 0.03);
        // Tall asymmetrical whale shark caudal fin
        ctx.lineTo(-sz * 0.62, sway - sz * 0.22);
        ctx.lineTo(-sz * 0.52, sway);
        ctx.lineTo(-sz * 0.58, sway + sz * 0.14);
        ctx.lineTo(-sz * 0.44, sway - sz * 0.03);
        ctx.quadraticCurveTo(sz * 0.08, -sz * 0.16, sz * 0.52, -sz * 0.05);
        ctx.closePath();
        ctx.fill();
        // Rounded dorsal & wide pectoral fins
        ctx.beginPath();
        ctx.moveTo(-sz * 0.04, -sz * 0.12);
        ctx.lineTo(-sz * 0.14, -sz * 0.26);
        ctx.lineTo(-sz * 0.22, -sz * 0.10);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sz * 0.18, sz * 0.08);
        ctx.lineTo(sz * 0.02, sz * 0.28);
        ctx.lineTo(-sz * 0.08, sz * 0.08);
        ctx.closePath();
        ctx.fill();

        // Subtle pale whale-shark dorsal spot pattern
        ctx.fillStyle = `rgba(${pal.snowRgb}, ${(alpha * 0.45).toFixed(3)})`;
        for (let sp = 0; sp < 6; sp++) {
          ctx.beginPath();
          ctx.arc(sz * (0.24 - sp * 0.10), -sz * 0.04 + (sp % 2) * sz * 0.04, Math.max(0.8, sz * 0.018), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sh.species === "hammerhead") {
        // Sleek Hammerhead Shark with unmistakable wide cephalofoil head & tall scythe dorsal fin
        ctx.beginPath();
        ctx.moveTo(sz * 0.50, 0);
        ctx.quadraticCurveTo(sz * 0.16, -sz * 0.13, -sz * 0.46, sway - sz * 0.02);
        // Long sweeping upper caudal lobe
        ctx.lineTo(-sz * 0.68, sway - sz * 0.24);
        ctx.lineTo(-sz * 0.52, sway + sz * 0.01);
        ctx.lineTo(-sz * 0.57, sway + sz * 0.11);
        ctx.lineTo(-sz * 0.44, sway + sz * 0.03);
        ctx.quadraticCurveTo(sz * 0.16, sz * 0.11, sz * 0.50, 0);
        ctx.closePath();
        ctx.fill();
        // Distinct T-shaped hammerhead cephalofoil bar at nose!
        ctx.beginPath();
        ctx.roundRect(sz * 0.44, -sz * 0.14, sz * 0.10, sz * 0.28, sz * 0.04);
        ctx.fill();
        // Tall curved scythe dorsal fin
        ctx.beginPath();
        ctx.moveTo(sz * 0.10, -sz * 0.09);
        ctx.quadraticCurveTo(sz * 0.0, -sz * 0.34, -sz * 0.10, -sz * 0.30);
        ctx.quadraticCurveTo(-sz * 0.04, -sz * 0.16, -sz * 0.08, -sz * 0.08);
        ctx.closePath();
        ctx.fill();
        // Swept pectoral fin
        ctx.beginPath();
        ctx.moveTo(sz * 0.16, sz * 0.06);
        ctx.lineTo(sz * 0.0, sz * 0.22);
        ctx.lineTo(-sz * 0.06, sz * 0.06);
        ctx.closePath();
        ctx.fill();
      } else {
        // Great White Shark: muscular fusiform torpedo, pointed snout, tall triangular dorsal, crescent tail!
        ctx.beginPath();
        ctx.moveTo(sz * 0.54, -sz * 0.01); // pointed snout
        ctx.quadraticCurveTo(sz * 0.20, -sz * 0.16, -sz * 0.44, sway - sz * 0.03);
        // Iconic symmetrical crescent caudal tail
        ctx.lineTo(-sz * 0.62, sway - sz * 0.24);
        ctx.quadraticCurveTo(-sz * 0.50, sway, -sz * 0.60, sway + sz * 0.20);
        ctx.lineTo(-sz * 0.44, sway + sz * 0.04);
        ctx.quadraticCurveTo(sz * 0.18, sz * 0.16, sz * 0.54, -sz * 0.01);
        ctx.closePath();
        ctx.fill();
        // Iconic tall triangular dorsal fin
        ctx.beginPath();
        ctx.moveTo(sz * 0.12, -sz * 0.11);
        ctx.lineTo(-sz * 0.04, -sz * 0.33);
        ctx.lineTo(-sz * 0.12, -sz * 0.10);
        ctx.closePath();
        ctx.fill();
        // Pectoral fin
        ctx.beginPath();
        ctx.moveTo(sz * 0.20, sz * 0.08);
        ctx.lineTo(sz * 0.02, sz * 0.26);
        ctx.lineTo(-sz * 0.04, sz * 0.08);
        ctx.closePath();
        ctx.fill();
        // Subtle counter-shaded pale underbelly
        ctx.fillStyle = `rgba(${pal.snowRgb}, ${(alpha * 0.22).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(sz * 0.44, sz * 0.03);
        ctx.quadraticCurveTo(sz * 0.12, sz * 0.13, -sz * 0.28, sz * 0.04);
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

  // Left Pier: Large Sleek Heavy Research/Transport Submarine (directly inspired by left docked craft!)
  _updateAndDrawSubmersible(ctx, w, h, L, pal, dt, step) {
    const sub = this.sub;
    sub.t += dt;
    const s = L.s;

    const armAng = L.leftAngle; // pointing from hub down-left
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedX = L.leftDockX + dirX * (58 * s);
    const dockedY = L.leftDockY + dirY * (58 * s);
    const holdX = L.leftDockX + dirX * (135 * s);
    const holdY = L.leftDockY + dirY * (135 * s);
    const entryX = -140;
    const entryY = holdY + 35;

    let visible = true;
    let propActive = true;

    if (sub.phase === "approaching") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      sub.x = entryX + (holdX - entryX) * ease;
      sub.y = entryY + (holdY - entryY) * ease + Math.sin(p * Math.PI) * 12;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docking";
        sub.t = 0;
        sub.phaseDuration = 3.8;
      }
    } else if (sub.phase === "docking") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      sub.x = holdX + (dockedX - holdX) * ease;
      sub.y = holdY + (dockedY - holdY) * ease;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "docked";
        sub.t = 0;
        sub.phaseDuration = 10.5;
      }
    } else if (sub.phase === "docked") {
      sub.x = dockedX;
      sub.y = dockedY + Math.sin(step * 2.0) * 0.7;
      propActive = false;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "departing";
        sub.t = 0;
        sub.phaseDuration = 10.2;
      }
    } else if (sub.phase === "departing") {
      const p = Math.min(1, sub.t / sub.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      sub.x = dockedX + (entryX - dockedX) * ease;
      sub.y = dockedY + (entryY - 40 - dockedY) * ease;
      if (sub.t >= sub.phaseDuration) {
        sub.phase = "patrol_wait";
        sub.t = 0;
        sub.phaseDuration = 5.5;
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

    if (propActive && Math.random() < 0.35) {
      this.bubbles.push({
        x: sub.x + dirX * 52 * s,
        y: sub.y + dirY * 52 * s + (Math.random() - 0.5) * 6,
        r: 1.2 + Math.random() * 1.9,
        vy: -(0.35 + Math.random() * 0.45),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.36 + Math.random() * 0.25
      });
    }

    ctx.save();
    ctx.translate(sub.x, sub.y);
    // Align hull smoothly along the left docking arm axis (nose pointing down-left away from collar)
    ctx.rotate(armAng - Math.PI);
    ctx.scale(s, s);

    // Forward twin spotlight cone when approaching/departing
    if (sub.phase !== "docked") {
      ctx.save();
      if (pal.isDark) ctx.globalCompositeOperation = "screen";
      const coneLen = pal.isDark ? 125 : 75;
      const bg = ctx.createLinearGradient(-56, 0, -56 - coneLen, 0);
      bg.addColorStop(0, `rgba(${pal.beamRgb}, ${(pal.beamAlpha * 0.78).toFixed(3)})`);
      bg.addColorStop(1, `rgba(${pal.beamRgb}, 0)`);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-54, -4);
      ctx.lineTo(-56 - coneLen, -26);
      ctx.lineTo(-56 - coneLen, 26);
      ctx.lineTo(-54, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Main Large Transport Sub Hull (2.5D top highlight + shadowed lower belly)
    const hullG = ctx.createLinearGradient(0, -16, 0, 16);
    hullG.addColorStop(0, pal.hullLight);
    hullG.addColorStop(0.55, pal.hullMid);
    hullG.addColorStop(1, pal.hullDark);
    ctx.fillStyle = hullG;
    ctx.beginPath();
    ctx.moveTo(-58, 2); // sleek tapered bow
    ctx.quadraticCurveTo(-48, -14, -18, -15);
    ctx.lineTo(48, -14);
    ctx.lineTo(56, -9);
    ctx.lineTo(56, 11);
    ctx.lineTo(48, 15);
    ctx.lineTo(-26, 15);
    ctx.quadraticCurveTo(-50, 14, -58, 2);
    ctx.closePath();
    ctx.fill();

    // Raised forward bridge cockpit deck with glowing panoramic windows!
    ctx.fillStyle = pal.hullLight;
    ctx.beginPath();
    ctx.moveTo(-36, -13);
    ctx.lineTo(-24, -22);
    ctx.lineTo(8, -22);
    ctx.lineTo(14, -13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.portholeGlow;
    ctx.fillRect(-26, -20, 16, 4.5);

    // Aerospace/marine amber livery stripe + cabin porthole row
    ctx.fillStyle = pal.trimGold;
    ctx.fillRect(-44, 2, 86, 2.6);
    ctx.fillStyle = pal.portholeGlow;
    for (let wi = 0; wi < 5; wi++) {
      ctx.fillRect(-22 + wi * 13, -6, 6, 3.5);
    }

    // Nose sonar dome & ventral diving planes
    ctx.fillStyle = pal.hullDark;
    ctx.beginPath();
    ctx.arc(-55, 2, 6, Math.PI * 0.55, Math.PI * 1.45);
    ctx.fill();

    ctx.restore();
  },

  // Right Pier: Massive Modular Cargo Freighter Submarine with intermodal containers!
  _updateAndDrawCargoSub(ctx, w, h, L, pal, dt, step) {
    const cs = this.cargoSub;
    cs.t += dt;
    const s = L.s;

    const armAng = L.rightAngle; // pointing from hub down-right
    const dirX = Math.cos(armAng);
    const dirY = Math.sin(armAng);
    const dockedX = L.rightDockX + dirX * (68 * s);
    const dockedY = L.rightDockY + dirY * (68 * s);
    const holdX = L.rightDockX + dirX * (150 * s);
    const holdY = L.rightDockY + dirY * (150 * s);
    const exitX = w + 170;
    const exitY = holdY + 45;

    let visible = true;
    let thrusterGlow = 0;

    if (cs.phase === "docked") {
      cs.x = dockedX;
      cs.y = dockedY + Math.sin(step * 1.7 + 1) * 0.6;
      thrusterGlow = 0.25;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "departing";
        cs.t = 0;
        cs.phaseDuration = 12.0;
      }
    } else if (cs.phase === "departing") {
      const p = Math.min(1, cs.t / cs.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      cs.x = dockedX + (exitX - dockedX) * ease;
      cs.y = dockedY + (exitY - dockedY) * ease;
      thrusterGlow = 0.9;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "patrol_wait";
        cs.t = 0;
        cs.phaseDuration = 6.5;
      }
    } else if (cs.phase === "patrol_wait") {
      visible = false;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "approaching";
        cs.t = 0;
        cs.phaseDuration = 11.2;
      }
    } else if (cs.phase === "approaching") {
      const p = Math.min(1, cs.t / cs.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      cs.x = exitX + (holdX - exitX) * ease;
      cs.y = exitY + (holdY - exitY) * ease;
      thrusterGlow = 0.7;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "docking";
        cs.t = 0;
        cs.phaseDuration = 4.2;
      }
    } else {
      // Docking smoothly into right cargo collar
      const p = Math.min(1, cs.t / cs.phaseDuration);
      const ease = 1 - Math.pow(1 - p, 2.2);
      cs.x = holdX + (dockedX - holdX) * ease;
      cs.y = holdY + (dockedY - holdY) * ease;
      thrusterGlow = 0.45;
      if (cs.t >= cs.phaseDuration) {
        cs.phase = "docked";
        cs.t = 0;
        cs.phaseDuration = 12.5;
      }
    }

    if (!visible) return;

    if (thrusterGlow > 0.4 && Math.random() < 0.40) {
      this.bubbles.push({
        x: cs.x + dirX * 66 * s,
        y: cs.y + dirY * 66 * s + (Math.random() - 0.5) * 10,
        r: 1.4 + Math.random() * 2.2,
        vy: -(0.35 + Math.random() * 0.5),
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.35 + Math.random() * 0.25
      });
    }

    ctx.save();
    ctx.translate(cs.x, cs.y);
    ctx.rotate(armAng);
    ctx.scale(s, s);

    // Massive Industrial Cargo Freighter Hull (nose docking at -x, quad thruster bay at +x)
    const cg = ctx.createLinearGradient(0, -20, 0, 20);
    cg.addColorStop(0, pal.hullLight);
    cg.addColorStop(0.55, pal.hullMid);
    cg.addColorStop(1, pal.hullDark);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.roundRect(-64, -17, 130, 34, 6);
    ctx.fill();

    // Heavy armored ribbing bands
    ctx.fillStyle = pal.hullDark;
    [-40, -10, 22, 46].forEach(rx => {
      ctx.fillRect(rx, -18, 4.5, 36);
    });

    // Top-mounted Intermodal Sea-Freight Cargo Containers (iconic detail from inspiration image!)
    const containers = [
      { x: -34, w: 22, color: "#0284C7" },
      { x: -6, w: 24, color: "#0F766E" },
      { x: 24, w: 19, color: "#D97706" }
    ];
    containers.forEach(c => {
      ctx.fillStyle = c.color;
      ctx.globalAlpha = pal.isDark ? 0.72 : 0.88;
      ctx.fillRect(c.x, -26, c.w, 10);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.hullDark;
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x, -26, c.w, 10);
    });

    // Yellow hazard industrial trim around stern quad-thruster shroud
    ctx.fillStyle = pal.trimGold;
    ctx.fillRect(48, -17, 6, 34);

    // Stern quad thruster nozzles with soft cyan/amber propulsion glow
    ctx.fillStyle = pal.hullDark;
    ctx.fillRect(54, -15, 14, 30);
    if (thrusterGlow > 0.1) {
      const tg = ctx.createRadialGradient(70, 0, 2, 74, 0, 22);
      tg.addColorStop(0, `rgba(125, 211, 252, ${(thrusterGlow * 0.75).toFixed(3)})`);
      tg.addColorStop(1, "rgba(125, 211, 252, 0)");
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(72, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Illuminated side navigation & cargo bay portholes
    ctx.fillStyle = pal.portholeGlow;
    for (let pi = 0; pi < 6; pi++) {
      ctx.fillRect(-52 + pi * 15, -3, 5, 3.5);
    }

    ctx.restore();
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
        const speed = 24 * dt;
        rov.x += (dx / dist) * Math.min(dist, speed);
        rov.y += (dy / dist) * Math.min(dist, speed);
        const moveAng = Math.atan2(dy, dx);
        rov.beamAngle += (moveAng - rov.beamAngle) * Math.min(1, dt * 2.4);
      } else {
        inspecting = true;
        const sweepTarget = wp.beamAngle + Math.sin(rov.phase * 0.9) * 0.30;
        rov.beamAngle += (sweepTarget - rov.beamAngle) * Math.min(1, dt * 2.8);
        rov.pauseTimer -= dt;
        if (rov.pauseTimer <= 0) {
          rov.wpIdx = (rov.wpIdx + 1) % rov.waypoints.length;
          rov.pauseTimer = 3.4 + Math.random() * 2.8;
        }
      }

      const hoverY = rov.y + Math.sin(rov.phase * 1.4) * 2.5;
      ctx.save();
      ctx.translate(rov.x, hoverY);

      // Volumetric ROV spotlight cone shining into the dark water!
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

      // Detailed industrial yellow ROV body with buoyancy pack & thruster frame
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.roundRect(-8, -5, 16, 7.5, 3);
      ctx.fill();
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(-6, 2.5, 12, 3);
      ctx.fillStyle = "#FDE68A";
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
