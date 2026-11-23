/**
 * PETTR World Renderer: Space — "Gateway" (v12.2 Architectural Depth, Stochastic Fleet & Realism Overhaul)
 * Wide 2.5D island spaceport complex with:
 * - Multi-plane shaded 2.5D buildings (VAB, Cryo Tank Farm, Star Terminal + jetways, Secondary Hangar,
 *   Flight Ops, Ribbed Arched Assembly Hangar, Geodesic Radome, Double-Deck ATC Tower & Waterfront Logistics),
 *   detailed apron markings, painted gate stands, and cast ground shadows.
 * - Subtle animated coastal bay wave shimmer (clipped to water zones) & slow drifting high cirrus/clouds.
 * - Realistic slow rocket transport riding on a multi-axle flatbed hauled by a visible heavy tow tug tractor
 *   with headlights & amber beacon, plus randomized launch/catch/erect pacing.
 * - Multi-craft concurrent passenger spaceplane fleet (enlarged Dual-Deck Starliner, Space Airliner,
 *   Blended-Wing Clipper, Heavy Passenger Shuttle) with slow realistic tarmac taxiing, coordinated
 *   runway hold-short, silky flared approaches/takeoffs, drogue chutes, and clean hangar occlusion.
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
  spaceplane: null,   // Points to this.spaceplanes[0] for backwards compatibility
  spaceplanes: [],
  spVariantIdx: 0,
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  boats: [],
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

  reset() {
    this.cacheKey = "";
    this.plumeParticles = [];
    this.ventParticles = [];
    this.rocket = null;
    this.spaceplane = null;
    this.spaceplanes = [];
    this.stars = [];
    this.clouds = [];
    this.cirrus = [];
    this.waterGlints = [];
    this.orbiters = [];
    this.boats = [];
    this.fogState = { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 };
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isNightLights: false,
        lightIntensity: 0.44,
        skyTop: "#7F99C4",
        skyMid: "#E6A9A4",
        skyHorizon: "#FDD3A3",
        sunCore: "rgba(255, 250, 230, 0.95)",
        sunGlow: "253, 186, 116",
        waterFar: "#C4B4C6",
        waterMid: "#8D97B4",
        waterNear: "#4E5F82",
        waterShimmerRgb: "255, 232, 200",
        islandFar: "#9E95AB",
        landBase: "#B6A5A4",
        landShade: "#8F8289",
        apronFill: "#9E9296",
        foliage: "#3E4A59",
        runwayFill: "#5C5B68",
        runwayLight: "rgba(255, 244, 224, 0.65)",
        archLight: "#F8EEE8",
        archMid: "#C4B7BE",
        archDark: "#6E6878",
        roofHighlight: "rgba(255, 250, 245, 0.72)",
        shadowColor: "rgba(32, 26, 48, 0.24)",
        towerSteel: "#5A5666",
        windowGlow: "rgba(254, 226, 170, 0.80)",
        windowGlassDark: "rgba(42, 40, 62, 0.72)",
        hangarInterior: "rgba(251, 191, 120, 0.48)",
        plumeCore: "255, 250, 232",
        plumeMid: "251, 165, 92",
        smokeRgb: "248, 226, 214",
        smokeAlpha: 0.45,
        chuteColor: "#E05A47",
        chuteStripe: "#FFF5E6",
        bodyLight: "#FFF9F5",
        bodyMid: "#DDD4D8",
        bodyShade: "#9A919C",
        liveryAccent: "#E07A5F"
      };
    }
    if (mode === "evening") {
      return {
        isNightLights: true,
        lightIntensity: 0.90,
        skyTop: "#2F3D6B",
        skyMid: "#9B6A82",
        skyHorizon: "#F7A668",
        sunCore: "rgba(255, 245, 214, 0.96)",
        sunGlow: "249, 140, 74",
        waterFar: "#8C6F84",
        waterMid: "#474E72",
        waterNear: "#222B45",
        waterShimmerRgb: "255, 206, 150",
        islandFar: "#584C68",
        landBase: "#5A5369",
        landShade: "#3B374B",
        apronFill: "#4A445A",
        foliage: "#1F2636",
        runwayFill: "#2C2B3A",
        runwayLight: "rgba(253, 215, 130, 0.72)",
        archLight: "#D8CDD2",
        archMid: "#8A8296",
        archDark: "#3F3B4F",
        roofHighlight: "rgba(255, 234, 210, 0.48)",
        shadowColor: "rgba(12, 10, 26, 0.36)",
        towerSteel: "#474158",
        windowGlow: "rgba(254, 215, 125, 0.94)",
        windowGlassDark: "rgba(26, 22, 42, 0.80)",
        hangarInterior: "rgba(251, 191, 88, 0.65)",
        plumeCore: "255, 248, 224",
        plumeMid: "249, 115, 22",
        smokeRgb: "238, 172, 132",
        smokeAlpha: 0.40,
        chuteColor: "#F97316",
        chuteStripe: "#FEF3C7",
        bodyLight: "#F1EAE6",
        bodyMid: "#B6AEBC",
        bodyShade: "#635E73",
        liveryAccent: "#F59E0B"
      };
    }
    if (mode === "dark") {
      return {
        isNightLights: true,
        lightIntensity: 1.0,
        skyTop: "#050914",
        skyMid: "#0C152B",
        skyHorizon: "#1A2948",
        sunCore: "rgba(186, 230, 253, 0.38)",
        sunGlow: "56, 189, 248",
        waterFar: "#121E36",
        waterMid: "#0B1426",
        waterNear: "#060B17",
        waterShimmerRgb: "125, 211, 252",
        islandFar: "#141F36",
        landBase: "#162033",
        landShade: "#0E1524",
        apronFill: "#131C2E",
        foliage: "#090F1A",
        runwayFill: "#101726",
        runwayLight: "rgba(125, 211, 252, 0.78)",
        archLight: "#76879E",
        archMid: "#3B4A62",
        archDark: "#151F33",
        roofHighlight: "rgba(186, 230, 253, 0.28)",
        shadowColor: "rgba(2, 6, 16, 0.48)",
        towerSteel: "#384766",
        windowGlow: "rgba(254, 225, 148, 0.94)",
        windowGlassDark: "rgba(8, 14, 28, 0.85)",
        hangarInterior: "rgba(186, 230, 253, 0.48)",
        plumeCore: "255, 252, 242",
        plumeMid: "251, 146, 60",
        smokeRgb: "148, 163, 184",
        smokeAlpha: 0.32,
        chuteColor: "#FB923C",
        chuteStripe: "#F8FAFC",
        bodyLight: "#D6E0EC",
        bodyMid: "#8797AC",
        bodyShade: "#334155",
        liveryAccent: "#38BDF8"
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
      waterFar: "#B8D4EE",
      waterMid: "#8DB6DC",
      waterNear: "#6491BD",
      waterShimmerRgb: "255, 255, 255",
      islandFar: "#9CB2CA",
      landBase: "#C9D3DE",
      landShade: "#A1B0C2",
      apronFill: "#B7C4D4",
      foliage: "#5B747E",
      runwayFill: "#64748B",
      runwayLight: "rgba(255, 255, 255, 0.78)",
      archLight: "#FFFFFF",
      archMid: "#CBD5E1",
      archDark: "#64748B",
      roofHighlight: "rgba(255, 255, 255, 0.85)",
      shadowColor: "rgba(30, 41, 59, 0.22)",
      towerSteel: "#475569",
      windowGlow: "rgba(224, 242, 254, 0.72)",
      windowGlassDark: "rgba(51, 65, 85, 0.65)",
      hangarInterior: "rgba(203, 213, 225, 0.45)",
      plumeCore: "255, 255, 255",
      plumeMid: "251, 191, 36",
      smokeRgb: "241, 245, 249",
      smokeAlpha: 0.50,
      chuteColor: "#EF4444",
      chuteStripe: "#FFFFFF",
      bodyLight: "#FFFFFF",
      bodyMid: "#D8E2EE",
      bodyShade: "#8A9BB0",
      liveryAccent: "#0284C7"
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.34 : 0.28);
    const islandTopY = h * (isNarrow ? 0.46 : 0.41);
    const islandBotY = h * (isNarrow ? 0.78 : 0.76);

    // Twin Launch & Catch Towers on Left-Midground Peninsula
    const padX = w * (isNarrow ? 0.19 : 0.21);
    const padY = islandTopY + (islandBotY - islandTopY) * 0.14;
    const towerH = Math.min(188, Math.max(104, h * 0.21));
    const towerW = Math.max(12, towerH * 0.088);
    const towerLeftX = padX - towerW * 1.9;
    const towerRightX = padX + towerW * 1.9;

    // Iconic Star-Shaped Spire Central Terminal (centre of island)
    const termX = w * 0.50;
    const termY = islandTopY + (islandBotY - islandTopY) * 0.32;
    const termScale = isNarrow ? 0.66 : Math.min(1.14, Math.max(0.78, w / 1280));

    // Sleek Arched Assembly Hangar (right-midground — natural occlusion bay!)
    const hangarX = w * (isNarrow ? 0.78 : 0.76);
    const hangarY = islandTopY + (islandBotY - islandTopY) * 0.17;
    const hangarW = Math.min(176, w * (isNarrow ? 0.25 : 0.14));
    const hangarH = hangarW * 0.32;
    const hangarDoorX = hangarX - hangarW * 0.20;
    const hangarDoorY = hangarY + hangarH * 0.44;

    // Radome & Tall Glass ATC Control Tower (far right)
    const radomeX = w * 0.865;
    const radomeY = hangarY + 4;
    const atcX = w * 0.912;
    const atcY = hangarY + 12;

    // Sweeping Diagonal Main Runway across lower-middle of island
    const rwLeftX = w * 0.04;
    const rwLeftY = islandTopY + (islandBotY - islandTopY) * 0.28;
    const rwRightX = w * 0.96;
    const rwRightY = islandBotY + h * 0.04;

    const rwPt = (t) => ({
      x: rwLeftX + (rwRightX - rwLeftX) * t,
      y: rwLeftY + (rwRightY - rwLeftY) * t
    });

    const rwExitT = 0.64;
    const rwEntryT = 0.24;

    return {
      isNarrow, horizonY, islandTopY, islandBotY,
      padX, padY, towerH, towerW, towerLeftX, towerRightX,
      termX, termY, termScale,
      hangarX, hangarY, hangarW, hangarH, hangarDoorX, hangarDoorY,
      radomeX, radomeY, atcX, atcY,
      rwLeftX, rwLeftY, rwRightX, rwRightY, rwPt, rwExitT, rwEntryT
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
    const sunHalo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, Math.min(w * 0.45, 420));
    sunHalo.addColorStop(0, pal.sunCore);
    sunHalo.addColorStop(0.18, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.22 : 0.45})`);
    sunHalo.addColorStop(0.55, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.08 : 0.14})`);
    sunHalo.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
    ctx.fillStyle = sunHalo;
    ctx.fillRect(0, 0, w, L.horizonY + 120);

    if (mode !== "dark") {
      ctx.fillStyle = pal.sunCore;
      ctx.beginPath();
      ctx.arc(sunX, sunY, mode === "light" ? 10 : 13, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant horizon cloud bank silhouettes
    ctx.save();
    ctx.fillStyle = mode === "dark" ? "rgba(30, 41, 68, 0.35)" : "rgba(255, 232, 214, 0.26)";
    ctx.beginPath();
    ctx.moveTo(0, L.horizonY);
    for (let x = 0; x <= w + 40; x += 32) {
      const puff = Math.max(0, Math.sin(x * 0.008 + 1.2) * 16 + Math.cos(x * 0.019) * 10);
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
    refG.addColorStop(0, `rgba(${pal.sunGlow}, ${mode === "dark" ? 0.20 : 0.55})`);
    refG.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
    ctx.fillStyle = refG;
    ctx.beginPath();
    ctx.moveTo(sunX - 18, L.horizonY);
    ctx.lineTo(sunX + 18, L.horizonY);
    ctx.lineTo(sunX + 74, L.islandTopY + 30);
    ctx.lineTo(sunX - 74, L.islandTopY + 30);
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

    // Concrete Apron District extending across central terminal & hangar campus
    ctx.beginPath();
    ctx.moveTo(w * 0.27, L.islandTopY + 12);
    ctx.lineTo(w * 0.84, L.islandTopY + 18);
    ctx.lineTo(w * 0.88, L.termY + 62);
    ctx.lineTo(w * 0.25, L.termY + 48);
    ctx.closePath();
    ctx.fillStyle = pal.apronFill;
    ctx.globalAlpha = 0.62;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Subtle concrete expansion joint lines across apron
    ctx.strokeStyle = pal.shadowColor;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.22;
    for (let gx = 0.30; gx <= 0.82; gx += 0.04) {
      ctx.beginPath();
      ctx.moveTo(w * gx, L.islandTopY + 16);
      ctx.lineTo(w * (gx + 0.02), L.termY + 52);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Crisp coastal seawall edge & dark greenery embankment
    ctx.strokeStyle = pal.isNightLights ? "rgba(148, 163, 184, 0.22)" : "rgba(255, 255, 255, 0.44)";
    ctx.lineWidth = 2;
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

    // 5. Enriched Runway Network, Taxiways & Painted Gate Stand Markings
    this._drawRunwayNetwork(ctx, w, L, pal);

    // 6. Back-Campus Launch Integration VAB, Cryo Tank Farm, Ops Buildings & Secondary Hangar
    this._drawCryoTankFarm(ctx, L.padX + (L.isNarrow ? 48 : 68), L.padY + 2, pal);
    this._draw25DBuilding(ctx, w * 0.32, L.islandTopY + (L.islandBotY - L.islandTopY) * 0.12, L.isNarrow ? 34 : 52, L.isNarrow ? 26 : 36, pal, { style: "vab", floors: 3 });
    this._draw25DBuilding(ctx, w * 0.38, L.islandTopY + (L.islandBotY - L.islandTopY) * 0.15, L.isNarrow ? 28 : 42, 16, pal, { style: "ops", floors: 2 });
    this._draw25DBuilding(ctx, w * 0.59, L.islandTopY + (L.islandBotY - L.islandTopY) * 0.11, L.isNarrow ? 38 : 56, 20, pal, { style: "hangar_small", floors: 1 });
    this._draw25DBuilding(ctx, w * 0.66, L.islandTopY + (L.islandBotY - L.islandTopY) * 0.15, L.isNarrow ? 26 : 36, 15, pal, { style: "terminal_annex", floors: 2 });

    // Richer 2.5D Waterfront Logistics & Support Campus along lower embankment & east edge
    const waterfrontBldgs = [
      { t: 0.16, w: 38, h: 15, dy: -46, style: "warehouse", floors: 1 },
      { t: 0.22, w: 50, h: 21, dy: -37, style: "ops", floors: 2 },
      { t: 0.29, w: 42, h: 16, dy: -27, style: "warehouse", floors: 2 },
      { t: 0.36, w: 44, h: 19, dy: -17, style: "terminal_annex", floors: 2 },
      { t: 0.43, w: 48, h: 17, dy: -7, style: "warehouse", floors: 2 },
      { t: 0.51, w: 54, h: 22, dy: 5, style: "ops", floors: 2 },
      { t: 0.59, w: 40, h: 15, dy: 15, style: "terminal_annex", floors: 2 },
      { t: 0.74, w: 68, h: 24, dy: 28, style: "hangar_small", floors: 2 },
      { t: 0.84, w: 48, h: 19, dy: 34, style: "ops", floors: 2 }
    ];
    waterfrontBldgs.forEach(b => {
      if (L.isNarrow && b.w > 48) b.w *= 0.8;
      const bx = w * b.t;
      const by = L.islandBotY + b.dy;
      this._draw25DBuilding(ctx, bx, by, b.w, b.h, pal, { style: b.style, floors: b.floors });
    });

    // 7. Heavy Crawlerway Apron Road connecting Arched Hangar -> Launch Pad (northern orbital perimeter)
    ctx.save();
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 11;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(L.hangarDoorX, L.hangarDoorY);
    ctx.quadraticCurveTo(w * 0.48, L.padY - 12, L.padX, L.padY + 4);
    ctx.stroke();
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 8. Twin Launch & Catch Towers + Concrete Launch Mount + Blast Deflector
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.padX - 46, L.padY + 13);
    ctx.lineTo(L.padX - 32, L.padY - 4);
    ctx.lineTo(L.padX + 34, L.padY - 4);
    ctx.lineTo(L.padX + 48, L.padY + 13);
    ctx.closePath();
    ctx.fill();

    // Launch mount deck highlight edge & flame trench glow shadow
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(L.padX - 28, L.padY - 4, 56, 3);
    ctx.fillStyle = pal.shadowColor;
    ctx.fillRect(L.padX - 18, L.padY + 2, 36, 7);

    this._drawLatticeTower(ctx, L.towerLeftX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);
    this._drawLatticeTower(ctx, L.towerRightX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);

    // 9. Iconic Multi-Arm Star-Shaped Spire Terminal
    this._drawStarTerminal(ctx, L, pal);

    // Parked Static Passenger Spaceplanes at Terminal Jetways & Maintenance Hangar
    const sc = L.termScale;
    const parked = [
      { x: L.termX - 104 * sc, y: L.termY + 34 * sc, ang: -0.22, sc: 0.68 * sc, v: "starliner" },
      { x: L.termX + 126 * sc, y: L.termY + 34 * sc, ang: 2.86, sc: 0.66 * sc, v: "airliner" },
      { x: L.termX + 54 * sc, y: L.termY + 56 * sc, ang: -2.4, sc: 0.60 * sc, v: "clipper" },
      { x: w * 0.60, y: L.islandTopY + (L.islandBotY - L.islandTopY) * 0.16, ang: 1.75, sc: 0.56 * sc, v: "shuttle" }
    ];
    parked.forEach(pk => {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(pk.ang);
      ctx.scale(pk.sc, pk.sc);
      this._drawSpaceplaneModel(ctx, pk.v, pal, 0, 0, 2.5);
      ctx.restore();
    });

    // 10. Curved Arched Assembly Hangar Base + Side Annex (roof occlusion drawn live after moving craft!)
    this._drawArchedHangarBase(ctx, L, pal);
    this._draw25DBuilding(ctx, L.hangarX + L.hangarW * 0.54, L.hangarY + L.hangarH * 0.54, 24, 15, pal, { style: "ops", floors: 2 });

    // 11. Geodesic Radome, Telemetry Dishes & Tall Double-Deck ATC Tower
    this._drawRadomeAndATC(ctx, L, pal);

    // 12. Foreground Lower-Right Curving Highway Causeway Bridge & Lower-Left Hillside
    this._drawForegroundBridgeAndCoast(ctx, w, h, L, pal);
  },

  _drawCryoTankFarm(ctx, startX, baseY, pal) {
    ctx.save();
    // Manifold trestle pipeline leading left toward pad
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(startX - 30, baseY - 4);
    ctx.lineTo(startX + 44, baseY - 4);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const tx = startX + i * 16;
      const ty = baseY - (i % 2) * 3;
      const r = 6.2;
      // Cast shadow right
      ctx.fillStyle = pal.shadowColor;
      ctx.beginPath();
      ctx.ellipse(tx + 5, ty + 3, r * 1.15, r * 0.42, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Support legs
      ctx.strokeStyle = pal.archDark;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty - 2);
      ctx.lineTo(tx - 5, ty + 3);
      ctx.moveTo(tx + 4, ty - 2);
      ctx.lineTo(tx + 5, ty + 3);
      ctx.stroke();
      // Shaded 3D sphere
      const tg = ctx.createRadialGradient(tx - 2.2, ty - 8, 1, tx, ty - 6, r);
      tg.addColorStop(0, pal.archLight);
      tg.addColorStop(0.55, pal.archMid);
      tg.addColorStop(1, pal.archDark);
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.arc(tx, ty - 6, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _draw25DBuilding(ctx, x, y, bw, bh, pal, opts = {}) {
    const style = opts.style || "warehouse";
    const floors = opts.floors || 1;
    const frontW = bw * 0.66;
    const depthX = bw * 0.34;
    const depthY = Math.max(3, Math.min(7, bh * 0.24));

    ctx.save();
    // 1. Cast ground shadow stretching right/down from sun on the left
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y);
    ctx.lineTo(x + frontW + bh * 0.55 + depthX * 0.6, y + 4);
    ctx.lineTo(x + bw + bh * 0.55, y + depthY + 3);
    ctx.lineTo(x + frontW, y + depthY * 0.5);
    ctx.closePath();
    ctx.fill();

    // 2. Front architectural facade with vertical daylight gradient
    const frontG = ctx.createLinearGradient(x, y - bh, x, y);
    frontG.addColorStop(0, pal.archLight);
    frontG.addColorStop(1, pal.archMid);
    ctx.fillStyle = frontG;
    ctx.fillRect(x, y - bh, frontW, bh);

    // 3. Receding darker isometric right wall
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + frontW, y - bh);
    ctx.lineTo(x + bw, y - bh + depthY);
    ctx.lineTo(x + bw, y + depthY * 0.85);
    ctx.lineTo(x + frontW, y);
    ctx.closePath();
    ctx.fill();

    // 4. Beveled rooftop slab + sunlit left-front parapet edge
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + depthX * 0.72, y - bh - depthY * 0.65);
    ctx.lineTo(x + bw, y - bh + depthY * 0.35);
    ctx.lineTo(x + frontW, y - bh);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + frontW, y - bh);
    ctx.stroke();

    // 5. Roof superstructures & stepped architectural wings
    if (style === "vab") {
      // High-bay integration door slot, crane penthouse & vertical structural ribs
      ctx.fillStyle = pal.windowGlassDark;
      ctx.fillRect(x + frontW * 0.30, y - bh * 0.84, frontW * 0.40, bh * 0.84);
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(x + frontW * 0.18, y - bh - 4.5, frontW * 0.52, 4.5);
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x + frontW * 0.70, y - bh - 3.5, depthX * 0.45, 4);
      [0.14, 0.86].forEach(rf => {
        ctx.fillStyle = pal.archDark;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(x + frontW * rf, y - bh, 1.5, bh);
        ctx.globalAlpha = 1;
      });
    } else if (style === "hangar_small") {
      // Vaulted arched roof ridge + dark open bay + interior warm/cool spill
      ctx.fillStyle = pal.archLight;
      ctx.beginPath();
      ctx.moveTo(x, y - bh);
      ctx.quadraticCurveTo(x + frontW * 0.5, y - bh - 7, x + frontW, y - bh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.windowGlassDark;
      ctx.fillRect(x + frontW * 0.14, y - bh * 0.68, frontW * 0.72, bh * 0.68);
      ctx.fillStyle = pal.hangarInterior;
      ctx.fillRect(x + frontW * 0.22, y - bh * 0.44, frontW * 0.56, bh * 0.34);
    } else {
      // Mechanical rooftop penthouse & cantilevered entrance canopy / stepped side wing
      if (style === "ops" || style === "terminal_annex") {
        // Attached stepped lower concourse wing extending left
        const wx = x - frontW * 0.26;
        const wh = bh * 0.56;
        ctx.fillStyle = pal.archMid;
        ctx.fillRect(wx, y - wh, frontW * 0.26, wh);
        ctx.fillStyle = pal.roofHighlight;
        ctx.fillRect(wx, y - wh, frontW * 0.26, 1.2);
      }
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(x + frontW * 0.32, y - bh - 3.8, Math.max(5, frontW * 0.28), 3.0);
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(x + frontW * 0.32, y - bh - 4.4, Math.max(4, frontW * 0.18), 1.5);
      // Slim rooftop telemetry whip antenna on ops towers
      if (style === "ops") {
        ctx.strokeStyle = pal.towerSteel;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x + frontW * 0.72, y - bh);
        ctx.lineTo(x + frontW * 0.72, y - bh - 7);
        ctx.stroke();
      }
    }

    // 6. Sleek Slender Recessed Glazing Ribbons with Vertical Mullions (less boxy yellow block look!)
    if (style !== "hangar_small") {
      for (let fl = 0; fl < floors; fl++) {
        const winY = y - bh * (0.34 + fl * 0.30);
        const winH = Math.max(1.6, bh * 0.095);
        const winX = x + 3;
        const winW = frontW - 6;
        if (winW > 4) {
          ctx.fillStyle = pal.windowGlassDark;
          ctx.fillRect(winX, winY - 0.8, winW, winH + 1.5);
          ctx.fillStyle = pal.windowGlow;
          ctx.fillRect(winX + 0.6, winY, winW - 1.2, winH);
          // Fine vertical architectural mullions
          ctx.fillStyle = pal.archDark;
          for (let m = 1; m <= 3; m++) {
            ctx.fillRect(winX + (winW * m) / 4, winY - 0.4, 0.9, winH + 0.8);
          }
          if (style === "ops" || style === "terminal_annex") {
            ctx.fillStyle = pal.windowGlassDark;
            ctx.fillRect(x + frontW + 2, winY + 1.0, Math.max(3, depthX * 0.52), winH + 0.8);
            ctx.fillStyle = pal.windowGlow;
            ctx.fillRect(x + frontW + 2.5, winY + 1.3, Math.max(2, depthX * 0.44), winH * 0.75);
          }
        }
      }
    }
    ctx.restore();
  },

  _drawRunwayNetwork(ctx, w, L, pal) {
    ctx.save();
    const lHalf = 12;
    const rHalf = 34;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - lHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY - rHalf);
    ctx.lineTo(L.rwRightX, L.rwRightY + rHalf);
    ctx.lineTo(L.rwLeftX, L.rwLeftY + lHalf);
    ctx.closePath();
    ctx.fillStyle = pal.runwayFill;
    ctx.fill();

    // Outer runway edge lines
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - lHalf + 2);
    ctx.lineTo(L.rwRightX, L.rwRightY - rHalf + 4);
    ctx.moveTo(L.rwLeftX, L.rwLeftY + lHalf - 2);
    ctx.lineTo(L.rwRightX, L.rwRightY + rHalf - 4);
    ctx.stroke();

    // Piano-key runway threshold stripes at left arrival threshold (t~0.04) & blast chevron zone
    const rwAng = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    [0.04, 0.91].forEach((tPos) => {
      const p = L.rwPt(tPos);
      const hw = 10 + tPos * 18;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rwAng);
      ctx.fillStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.42)" : "rgba(255, 255, 255, 0.72)";
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        ctx.fillRect(-5, k * (hw * 0.28) - 1, 10, 1.8);
      }
      ctx.restore();
    });

    // Touchdown aiming blocks near t=0.14
    const td = L.rwPt(0.15);
    ctx.save();
    ctx.translate(td.x, td.y);
    ctx.rotate(rwAng);
    ctx.fillStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.36)" : "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(-7, -7, 14, 2.2);
    ctx.fillRect(-7, 4.8, 14, 2.2);
    ctx.restore();

    // Dashed foreshortened runway centreline
    ctx.strokeStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.45)" : "rgba(255, 255, 255, 0.80)";
    for (let i = 1; i < 15; i++) {
      const t0 = i / 16;
      const t1 = (i + 0.52) / 16;
      const p0 = L.rwPt(t0);
      const p1 = L.rwPt(t1);
      ctx.lineWidth = 1 + t0 * 1.8;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Taxiway Network + Painted Gate Lead-In Lines around Star Terminal & Hangars
    const exitPt = L.rwPt(L.rwExitT);
    const entryPt = L.rwPt(L.rwEntryT);
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 12;
    ctx.globalAlpha = 0.80;
    ctx.beginPath();
    // Arrival exit taxiway curving past Star Terminal into Arched Hangar
    ctx.moveTo(exitPt.x, exitPt.y - 14);
    ctx.quadraticCurveTo(L.termX + 85, L.termY + 42, L.hangarDoorX, L.hangarDoorY);
    // Departure taxiway curving from Hangar past Star Terminal to Left Runway Entry
    ctx.moveTo(L.hangarDoorX, L.hangarDoorY);
    ctx.quadraticCurveTo(L.termX + 10, L.termY + 34, entryPt.x, entryPt.y - 8);
    // Outer apron loop past secondary maintenance hangar
    ctx.moveTo(L.hangarDoorX - 18, L.hangarDoorY + 4);
    ctx.quadraticCurveTo(w * 0.61, L.islandTopY + (L.islandBotY - L.islandTopY) * 0.18, L.termX - 64 * L.termScale, L.termY + 26 * L.termScale);
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.56)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Painted yellow gate stop bars at terminal stands
    ctx.globalAlpha = 0.65;
    const stands = [
      { x: L.termX - 104 * L.termScale, y: L.termY + 34 * L.termScale },
      { x: L.termX + 126 * L.termScale, y: L.termY + 34 * L.termScale },
      { x: L.termX + 54 * L.termScale, y: L.termY + 56 * L.termScale },
      { x: L.termX - 24 * L.termScale, y: L.termY + 42 * L.termScale }
    ];
    ctx.strokeStyle = "rgba(251, 191, 36, 0.72)";
    ctx.lineWidth = 1.2;
    stands.forEach(st => {
      ctx.beginPath();
      ctx.moveTo(st.x - 10, st.y);
      ctx.lineTo(st.x + 10, st.y);
      ctx.moveTo(st.x, st.y - 8);
      ctx.lineTo(st.x, st.y + 8);
      ctx.stroke();
    });
    ctx.restore();
  },

  _drawStarTerminal(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);

    // Cast ground shadow across concourse footprint
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(12, 12, 168, 34, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Warm/cool ambient glow pool beneath concourse glass wings
    const underGlow = ctx.createRadialGradient(0, 6, 8, 0, 6, 155);
    underGlow.addColorStop(0, pal.windowGlow);
    underGlow.addColorStop(0.55, pal.isNightLights ? "rgba(251, 191, 36, 0.16)" : "rgba(255, 255, 255, 0.12)");
    underGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.ellipse(0, 8, 160, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    const arms = [
      { ax: -178, ay: 6, w: 13 },
      { ax: -116, ay: -20, w: 10 },
      { ax: 136, ay: -16, w: 10 },
      { ax: 182, ay: 16, w: 13 },
      { ax: 48, ay: 36, w: 12 }
    ];

    // Shadowed recessed concourse walls & mullions under wings
    arms.forEach(a => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 11, a.ax, a.ay + 7);
      ctx.lineTo(a.ax, a.ay + 1.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 3, 0, 0);
      ctx.closePath();
      ctx.fill();

      // Lit concourse curtain-wall glazing ribbon
      ctx.strokeStyle = pal.windowGlow;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.15, a.ay * 0.15 + 6.5);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.48 + 6.5, a.ax * 0.92, a.ay * 0.92 + 4.5);
      ctx.stroke();

      // Extending passenger jetway bridge stub
      ctx.strokeStyle = pal.archMid;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.62, a.ay * 0.62 + 5);
      ctx.lineTo(a.ax * 0.62 + (a.ax > 0 ? 10 : -10), a.ay * 0.62 + 13);
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

    // Sweeping aerodynamic roof wings with structural spine highlight
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
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.43 - 1, a.ax * 0.95, a.ay * 0.95);
      ctx.stroke();
    });

    // Central soaring fluted architectural spire
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
    ctx.ellipse(0, -14, 5.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  _drawArchedHangarBase(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    // Ground contact shadow right-down
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.hangarX + 12, y + hh * 0.56, hw * 0.54, hh * 0.25, 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Far curved vaulted back wall & interior maintenance gantry
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.5);
    ctx.quadraticCurveTo(x + hw * 0.5, y - hh * 0.95, x + hw, y + hh * 0.5);
    ctx.lineTo(x + hw, y + hh * 0.55);
    ctx.lineTo(x, y + hh * 0.55);
    ctx.closePath();
    ctx.fill();

    // Overhead yellow/steel hangar crane bridge beam visible inside mouth
    ctx.fillStyle = pal.liveryAccent;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(x + hw * 0.12, y + hh * 0.08, hw * 0.42, 3);
    ctx.globalAlpha = 1;

    // Glowing interior work bay spill
    const bayG = ctx.createRadialGradient(L.hangarDoorX, L.hangarDoorY, 4, L.hangarDoorX, L.hangarDoorY, hw * 0.48);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.beginPath();
    ctx.ellipse(L.hangarDoorX, L.hangarDoorY + 4, hw * 0.45, hh * 0.36, 0, 0, Math.PI * 2);
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

    // Crisp sunlit outer arch edge bevel + structural ribs
    ctx.strokeStyle = pal.roofHighlight;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.14);
    ctx.quadraticCurveTo(x + hw * 0.48, y - hh * 1.05, x + hw * 0.72, y - hh * 0.18);
    ctx.stroke();

    ctx.strokeStyle = pal.isNightLights ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.48)";
    ctx.lineWidth = 1;
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
    ctx.ellipse(dx + 4, dy + 2, 7, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx, dy - 10);
    ctx.stroke();
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.arc(dx - 1, dy - 12, 6, 0.4, Math.PI + 0.4);
    ctx.closePath();
    ctx.fill();

    // Geodesic Spherical Radome on beveled concrete collar
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(L.radomeX + 6, L.radomeY + 4, 11, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(L.radomeX - 5, L.radomeY - 12, 10, 16);
    const radG = ctx.createRadialGradient(L.radomeX - 3, L.radomeY - 22, 1, L.radomeX, L.radomeY - 20, 12);
    radG.addColorStop(0, pal.archLight);
    radG.addColorStop(1, pal.archDark);
    ctx.fillStyle = radG;
    ctx.beginPath();
    ctx.arc(L.radomeX, L.radomeY - 20, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.shadowColor;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(L.radomeX, L.radomeY - 20, 10.2, 4, 0.25, 0, Math.PI * 2);
    ctx.ellipse(L.radomeX, L.radomeY - 20, 4.5, 10.2, -0.2, 0, Math.PI * 2);
    ctx.stroke();

    // Tall Multi-Plane Beveled Double-Deck ATC Control Tower
    const ax = L.atcX;
    const ay = L.atcY + 8;
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.moveTo(ax + 6, ay);
    ctx.lineTo(ax + 34, ay + 6);
    ctx.lineTo(ax + 36, ay + 12);
    ctx.lineTo(ax - 4, ay + 2);
    ctx.closePath();
    ctx.fill();

    // Sunlit left & shaded right tower core facets
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 7, ay);
    ctx.lineTo(ax - 4, ay - 56);
    ctx.lineTo(ax + 0.5, ay - 56);
    ctx.lineTo(ax + 1, ay);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(ax + 1, ay);
    ctx.lineTo(ax + 0.5, ay - 56);
    ctx.lineTo(ax + 5, ay - 56);
    ctx.lineTo(ax + 7, ay);
    ctx.closePath();
    ctx.fill();

    // Structural observation deck collar & lower radar deck
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 9, ay - 51, 18, 4);

    // Double-deck cantilevered cab
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 12, ay - 64);
    ctx.lineTo(ax + 12, ay - 64);
    ctx.lineTo(ax + 9, ay - 51);
    ctx.lineTo(ax - 9, ay - 51);
    ctx.closePath();
    ctx.fill();

    // Mullioned wrap-around tinted/glowing control cab glass
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(ax - 9.5, ay - 62, 19, 6);
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(ax - 8.5, ay - 61, 17, 4.5);

    // Roof cap & radar antenna mast
    ctx.fillStyle = pal.archMid;
    ctx.fillRect(ax - 13, ay - 66, 26, 2.5);
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 66);
    ctx.lineTo(ax, ay - 80);
    ctx.moveTo(ax - 5, ay - 73);
    ctx.lineTo(ax + 5, ay - 73);
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
        lg.addColorStop(0, `rgba(254, 224, 150, ${(0.85 * pal.lightIntensity).toFixed(3)})`);
        lg.addColorStop(1, "rgba(254, 224, 150, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
    ctx.lineWidth = 1.55;
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
    ctx.lineWidth = 0.95;
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

    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - 14);
    ctx.stroke();
    ctx.restore();
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
          rx: 75 + Math.random() * 115,
          ry: 13 + Math.random() * 14,
          vx: 0.08 + Math.random() * 0.14
        });
      }
    }

    if (this.cirrus.length === 0) {
      for (let i = 0; i < 7; i++) {
        this.cirrus.push({
          x: Math.random() * w,
          y: 16 + Math.random() * (L.horizonY * 0.72),
          len: 90 + Math.random() * 160,
          curve: (Math.random() - 0.5) * 26,
          vx: 0.05 + Math.random() * 0.08,
          alpha: 0.14 + Math.random() * 0.16
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
          len: 10 + Math.random() * 26,
          vx: (isUpper ? 0.008 : 0.012) * (0.6 + Math.random() * 0.8),
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    if (this.boats.length === 0) {
      this.boats = [
        { x: w * 0.17, y: h * 0.79, vx: 0.11, size: 1.0 },
        { x: w * 0.44, y: h * 0.88, vx: -0.09, size: 1.25 },
        { x: w * 0.56, y: h * 0.83, vx: 0.08, size: 0.85 }
      ];
    }

    if (!this.rocket) {
      // Realistic slow rocket cycle starting partway through tow_out so flatbed & tug are immediately visible!
      this.rocket = {
        phase: "tow_out",
        t: 5.5,
        phaseDuration: this._rand(17.5, 22.5),
        armClose: 0.0,
        variant: this._pick(["heavy_starship", "orbital_cargo"]),
        x: 0,
        y: 0,
        angle: -Math.PI * 0.5
      };
    }

    if (this.spaceplanes.length === 0) {
      this.spaceplanes = [
        {
          id: "sp_flight_1",
          role: "runway",
          variant: "starliner",
          phase: "taxi_to_runway",
          t: 4.5,
          phaseDuration: this._rand(16.0, 21.0),
          heading: Math.PI - 0.25,
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
          t: 1.4,
          phaseDuration: this._rand(9.0, 11.5),
          heading: rwAngle * 0.85,
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
          t: 3.0,
          phaseDuration: this._rand(16.5, 22.0),
          heading: Math.PI - 0.1,
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
      this.fogState.targetAlpha = roll ? (0.40 + Math.random() * 0.24) : 0;
      this.fogState.nextCheck = now + 18000;
    }
  },

  pulseActivity({ kind = "complete" } = {}) {
    if (this.rocket && (this.rocket.phase === "arm_swing" || this.rocket.phase === "erect") && this.rocket.t > 1.2) {
      this.rocket.phase = "launch";
      this.rocket.t = 0;
      this.rocket.phaseDuration = this._rand(11.5, 13.5);
    } else if (this.spaceplanes.length > 0) {
      const idle = this.spaceplanes.find(sp => sp.role === "runway" && (sp.phase === "hangar_rest" || sp.phase === "sky_wait") && sp.t > 0.8);
      if (idle) {
        idle.phase = idle.phase === "hangar_rest" ? "hangar_emerge" : "approach";
        idle.t = 0;
        idle.phaseDuration = idle.phase === "hangar_emerge" ? this._rand(7.0, 9.5) : this._rand(8.5, 10.5);
      }
    }

    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const count = (kind === "queue_clear" || kind === "finalise") ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.orbiters.push({
        x: w * (0.12 + Math.random() * 0.35),
        y: 18 + Math.random() * (h * 0.18),
        vx: 4.2 + Math.random() * 3.0,
        vy: 0.4 + Math.random() * 0.7,
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

    // 1. Blit offscreen cached 2.5D spaceport complex
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Subtle Animated Sky (cirrus, clouds, stars) & Clipped Coastal Water Shimmer
    this._drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step);

    // 3. Channel Vessels Gliding Across Lower Bay Water
    this._updateAndDrawBoats(ctx, w, h, pal, dt);

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
        const a = Math.sin((o.life / o.maxLife) * Math.PI) * (pal.isNightLights ? 0.85 : 0.42);
        const grad = ctx.createLinearGradient(o.x - o.vx * 12, o.y - o.vy * 12, o.x, o.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
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

    // 6. Rocket Full Lifecycle (Tug + Flatbed tow_out -> erect -> arm_swing -> launch -> catch -> tow_back)
    this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);

    // 7. Concurrent Multi-Variant Passenger Spaceplane Fleet (slow tarmac taxiing + silky takeoffs/landings)
    this._updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h);

    // 8. Foreground Hangar Arch Occlusion Layer
    this._drawArchedHangarOcclusionRoof(ctx, L, pal);

    // 9. Exhaust Smoke & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 10. Probabilistic Rolling Dawn Fog (morning mode)
    this._updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now);
  },

  _drawAnimatedSkyAndWater(ctx, w, h, L, pal, mode, dt, step) {
    const scaleDt = dt * 60;

    // A. Sky: subtle stars at night/evening, slow drifting wispy cirrus + soft clouds across all modes
    if (mode === "dark" || mode === "evening") {
      const maxA = mode === "dark" ? 0.65 : 0.26;
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

    // Slow high-altitude cirrus wisps
    ctx.save();
    const cirrusRgb = mode === "morning" ? "255, 224, 200" : (mode === "evening" ? "253, 186, 140" : (mode === "dark" ? "148, 178, 214" : "255, 255, 255"));
    const cirrusScale = mode === "dark" ? 0.40 : (mode === "evening" ? 0.55 : 0.90);
    for (let i = 0; i < this.cirrus.length; i++) {
      const c = this.cirrus[i];
      c.x += c.vx * scaleDt;
      if (c.x - 40 > w) c.x = -c.len - 40;
      ctx.strokeStyle = `rgba(${cirrusRgb}, ${(c.alpha * cirrusScale).toFixed(3)})`;
      ctx.lineWidth = 2.0;
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
        const maxC = mode === "evening" ? 0.16 : 0.28;
        g.addColorStop(0, `rgba(${rgb}, ${maxC})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // B. Subtle Animated Water Shimmer Glints — clipped strictly to Upper Bay & Lower Channel water!
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
      const a = (0.06 + inSunCol * 0.24) * pulse * (mode === "dark" ? 0.65 : 1.0);
      ctx.strokeStyle = `rgba(${pal.waterShimmerRgb}, ${a.toFixed(3)})`;
      ctx.lineWidth = 1.0 + g.yFrac * 0.9;
      ctx.beginPath();
      ctx.moveTo(gx - g.len * 0.5, gy);
      ctx.lineTo(gx + g.len * 0.5, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Lower Channel Shimmer (clipped cleanly below waterfront seawall!)
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
      const a = 0.13 * pulse * (mode === "dark" ? 0.58 : 0.92);
      ctx.strokeStyle = `rgba(${pal.waterShimmerRgb}, ${a.toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(gx - g.len * 0.65, gy);
      ctx.lineTo(gx + g.len * 0.65, gy);
      ctx.stroke();
    }
    ctx.restore();
  },

  _updateAndDrawBoats(ctx, w, h, pal, dt) {
    ctx.save();
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      b.x += b.vx * (dt * 60);
      if (b.x > w * 0.59) b.vx = -Math.abs(b.vx);
      if (b.x < w * 0.08) b.vx = Math.abs(b.vx);
      const dir = b.vx > 0 ? 1 : -1;
      const bs = b.size || 1;
      ctx.strokeStyle = pal.isNightLights ? "rgba(186, 230, 253, 0.18)" : "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - dir * 18 * bs, b.y - 3.2 * bs);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - dir * 18 * bs, b.y + 3.2 * bs);
      ctx.stroke();
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(b.x - 2.5 * bs, b.y - 1.2 * bs, 5 * bs, 2.4 * bs);
    }
    ctx.restore();
  },

  _drawComplexLights(ctx, L, pal, step) {
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.4);
    const beaconA = pal.isNightLights ? (0.48 + 0.52 * pulse) : (0.16 + 0.22 * pulse);

    ctx.save();
    const beacons = [
      { x: L.towerLeftX, y: L.padY - L.towerH - 14 },
      { x: L.towerRightX, y: L.padY - L.towerH - 14 },
      { x: L.termX, y: L.termY - 98 * L.termScale },
      { x: L.atcX, y: L.atcY - 72 }
    ];
    beacons.forEach(b => {
      const r = pal.isNightLights ? 10 : 5;
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
        const hw = 12 + t * 22;
        const isRabbit = i === rabbit;
        const rgb = i < 2 ? "52, 211, 153" : (isRabbit ? "255, 255, 255" : "254, 226, 155");
        const a = (isRabbit ? 0.92 : 0.58) * pal.lightIntensity;
        const rad = (1.6 + t * 1.6) * 2.8;
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
    const cy = L.padY - 12;
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
    const cy = L.padY - 12;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    const dx = 2 * inv * (cx - p0x) + 2 * t * (p2x - cx);
    const dy = 2 * inv * (cy - p0y) + 2 * t * (p2y - cy);
    return Math.atan2(-dy, -dx);
  },

  _drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, travelDir, isMoving, isBoosterOnly = false) {
    ctx.save();
    // With r.angle = -PI/2, horizontal rocket extends leftward from x = 0 to x = -bodyLen
    const bodyLen = isBoosterOnly ? rocketH * 0.66 : rocketH;
    const bedStart = -bodyLen - 4;
    const bedEnd = 8;
    const bedW = bedEnd - bedStart;
    const bedMid = (bedStart + bedEnd) * 0.5;

    // 1. Cast ground shadow underneath flatbed & tug
    ctx.fillStyle = pal.shadowColor;
    ctx.beginPath();
    ctx.ellipse(bedMid, 6.5, bedW * 0.58 + 12, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Multi-Axle Heavy Flatbed Transporter Chassis + Hydraulic Cradles
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(bedStart, 0.5, bedW, 4.5);
    ctx.fillStyle = pal.liveryAccent;
    ctx.fillRect(bedStart, 0.5, bedW, 1.3);
    // Hydraulic strongback cradles gripping rocket underside
    ctx.fillStyle = pal.towerSteel;
    ctx.fillRect(bedStart + 8, -3.5, 4.0, 5.0);
    ctx.fillRect(bedEnd - 14, -3.5, 4.0, 5.0);

    // 7 dual-wheel heavy transporter bogies along flatbed
    ctx.fillStyle = "#1E293B";
    for (let wi = 0; wi < 7; wi++) {
      const wx = bedStart + 4 + (wi / 6) * (bedW - 8);
      ctx.beginPath();
      ctx.arc(wx, 5.8, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Towbar Hitch & Dedicated Heavy Aerospace Tow Tug Tractor (positioned ahead in travelDir!)
    const tugX = travelDir < 0 ? (bedStart - 16) : (bedEnd + 16);
    const hitchFrom = travelDir < 0 ? bedStart : bedEnd;
    const hitchTo = travelDir < 0 ? tugX + 7 : tugX - 7;

    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(hitchFrom, 3.4);
    ctx.lineTo(hitchTo, 3.8);
    ctx.stroke();

    // Heavy Low-Profile Pushback / Tow Tug Tractor
    ctx.save();
    ctx.translate(tugX, 0);
    if (travelDir < 0) ctx.scale(-1, 1);

    // Tug headlight beam casting forward along crawlerway when moving
    if (isMoving) {
      const hA = pal.isNightLights ? 0.46 : 0.16;
      const hg = ctx.createLinearGradient(8, 1, 44, 1);
      hg.addColorStop(0, `rgba(255, 250, 224, ${hA})`);
      hg.addColorStop(1, "rgba(255, 250, 224, 0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(8, -1);
      ctx.lineTo(44, -8);
      ctx.lineTo(44, 8);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Tug chassis & cab
    ctx.fillStyle = pal.liveryAccent;
    ctx.beginPath();
    ctx.roundRect(-8, -2.5, 16, 6.2, 2);
    ctx.fill();
    // Dark tinted tug cab windows
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.roundRect(-2, -6.2, 9, 4.2, 1.5);
    ctx.fill();
    ctx.fillStyle = pal.windowGlassDark;
    ctx.fillRect(0.5, -5.4, 5.8, 2.8);
    // Heavy tyres
    ctx.fillStyle = "#0F172A";
    ctx.beginPath();
    ctx.arc(-4.5, 4.6, 2.3, 0, Math.PI * 2);
    ctx.arc(4.8, 4.6, 2.3, 0, Math.PI * 2);
    ctx.fill();

    // Flashing amber escort beacon on tug cab roof
    if (Math.sin(step * 11) > 0) {
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.arc(2.5, -7.2, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  },

  _updateAndDrawRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.rocket;
    r.t += dt;

    const sizeMult = r.variant === "orbital_cargo" ? 0.92 : 1.0;
    const rocketH = Math.min(76, L.towerH * 0.44) * sizeMult;
    const rocketW = Math.max(6.5, rocketH * 0.145);
    const padBaseY = L.padY - 2;
    const catchY = L.padY - L.towerH * 0.54;

    let visible = true;
    let drawFlame = false;
    let flameScale = 0;
    let isTransporter = false;
    let isMovingTow = false;
    let towTravelDir = -1; // -1 toward pad, +1 toward hangar
    let roadTilt = 0;
    let isBoosterOnly = false;
    let armY = padBaseY - rocketH * 0.72;
    let targetArmClose = 0;

    if (r.phase === "tow_out") {
      // Towed slowly horizontally on flatbed pulled by heavy tug from Hangar -> Launch Pad
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, ease);
      r.x = pos.x;
      r.y = pos.y;
      roadTilt = this._crawlerTangent(L, w, ease) * 0.45;
      r.angle = -Math.PI * 0.5;
      isTransporter = true;
      isMovingTow = true;
      towTravelDir = -1;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "erect";
        r.t = 0;
        r.phaseDuration = this._rand(6.5, 8.8);
      }
    } else if (r.phase === "erect") {
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = -Math.PI * 0.5 * (1 - ease);
      isTransporter = p < 0.85;
      towTravelDir = -1;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "arm_swing";
        r.t = 0;
        r.phaseDuration = this._rand(6.5, 10.5);
      }
    } else if (r.phase === "arm_swing") {
      const p = Math.min(1, r.t / r.phaseDuration);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = 0;
      targetArmClose = p < 0.75 ? 1.0 : 0.0;
      if (p > 0.15 && Math.random() < 0.38) {
        this.ventParticles.push({
          x: L.padX + (Math.random() - 0.5) * rocketW,
          y: padBaseY - rocketH * (0.45 + Math.random() * 0.25),
          vx: 0.35 + Math.random() * 0.55,
          vy: -(0.12 + Math.random() * 0.24),
          r: 2.5 + Math.random() * 3.5,
          life: 0,
          maxLife: 48
        });
      }
      if (r.t >= r.phaseDuration) {
        r.phase = "launch";
        r.t = 0;
        r.phaseDuration = this._rand(11.5, 13.8);
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
      targetArmClose = 0;

      if (p < 0.42) {
        const refA = (1 - p / 0.42) * 0.42;
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
          vx: nearPad ? ((Math.random() - 0.5) * 2.5) : (-Math.sin(r.angle) * 0.4 + (Math.random() - 0.5) * 0.35),
          vy: nearPad ? -(0.22 + Math.random() * 0.5) : (0.55 + Math.random() * 0.45),
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
        r.phaseDuration = this._rand(6.5, 14.5);
      }
    } else if (r.phase === "coast_wait") {
      visible = false;
      targetArmClose = 0;
      armY = catchY;
      if (r.t >= r.phaseDuration) {
        r.phase = "descent";
        r.t = 0;
        r.phaseDuration = this._rand(8.0, 10.2);
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
        r.phaseDuration = this._rand(4.2, 5.8);
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
        r.phaseDuration = this._rand(5.2, 7.0);
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
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_back";
        r.t = 0;
        r.phaseDuration = this._rand(17.0, 22.0);
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
      roadTilt = this._crawlerTangent(L, w, 1 - ease) * 0.45;
      r.angle = -Math.PI * 0.5;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "hangar_wait";
        r.t = 0;
        r.phaseDuration = this._rand(5.5, 13.5);
        r.variant = this._pick(["heavy_starship", "orbital_cargo"]);
      }
    } else {
      visible = false;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_out";
        r.t = 0;
        r.phaseDuration = this._rand(17.5, 22.5);
      }
    }

    r.armClose += (targetArmClose - r.armClose) * Math.min(1, dt * 5.2);

    // Draw Heavy Tow Tug + Multi-Axle Flatbed Transporter beneath rocket!
    if (visible && isTransporter) {
      ctx.save();
      ctx.translate(r.x, r.y + 1);
      ctx.rotate(roadTilt);
      this._drawRocketTugAndFlatbed(ctx, pal, step, rocketH, rocketW, towTravelDir, isMovingTow, isBoosterOnly);
      ctx.restore();
    }

    // Draw Rocket / Booster Stack (with crisp 2.5D cylindrical shading)
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

    // Twin Tower Loading / Catch Chopstick Arms
    ctx.save();
    const reach = (L.towerRightX - L.towerLeftX) * 0.42;
    const extend = 0.22 + r.armClose * 0.78;
    ctx.strokeStyle = pal.isNightLights ? "#94A3B8" : pal.towerSteel;
    ctx.lineWidth = 2.1;
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
    // 1. Cast ground shadow shifted downward by aircraft altitude (enhances 3D liftoff & landing feel!)
    const shadowFade = Math.max(0.15, 1 - altitude / 90);
    ctx.save();
    ctx.translate(3 + altitude * 0.22, 4 + altitude * 0.65);
    ctx.scale(1.15, 0.85);
    ctx.fillStyle = pal.shadowColor;
    ctx.globalAlpha = 0.55 * shadowFade;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 21, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Thruster / Afterburner Plume during takeoff climb
    if (afterburner > 0.05) {
      const fl = (20 + Math.sin(step * 45) * 4.5) * afterburner;
      const g = ctx.createLinearGradient(-18, 0, -18 - fl, 0);
      g.addColorStop(0, "rgba(255, 252, 240, 0.96)");
      g.addColorStop(0.42, "rgba(56, 189, 248, 0.82)");
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-17, -3.5);
      ctx.lineTo(-18 - fl, 0);
      ctx.lineTo(-17, 3.5);
      ctx.closePath();
      ctx.fill();
    }

    if (variant === "starliner") {
      // Variant 4: Flagship Wide-Body Dual-Deck Passenger Starliner (~50px long, twin passenger window decks!)
      const wingG = ctx.createLinearGradient(0, -19, 0, 19);
      wingG.addColorStop(0, pal.bodyLight);
      wingG.addColorStop(0.5, pal.bodyMid);
      wingG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = wingG;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-3, -18.5);
      ctx.lineTo(-11, -18.0);
      ctx.lineTo(-13, -4);
      ctx.lineTo(-13, 4);
      ctx.lineTo(-11, 18.0);
      ctx.lineTo(-3, 18.5);
      ctx.closePath();
      ctx.fill();

      // Forward canards & winglets
      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-11.5, -19.2, 6, 1.8);
      ctx.fillRect(-11.5, 17.4, 6, 1.8);

      // Under-wing twin SABRE engine nacelles
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-15, -13, 9, 3.0);
      ctx.fillRect(-15, 10, 9, 3.0);

      // Wide-body passenger fuselage
      const fGrad = ctx.createLinearGradient(0, -5, 0, 5);
      fGrad.addColorStop(0, pal.bodyLight);
      fGrad.addColorStop(0.65, pal.bodyLight);
      fGrad.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.quadraticCurveTo(16, -5.2, -18, -3.8);
      ctx.lineTo(-21, 0);
      ctx.lineTo(-18, 3.8);
      ctx.quadraticCurveTo(16, 5.2, 25, 0);
      ctx.closePath();
      ctx.fill();

      // Airline cheatline stripe + DUAL passenger cabin window rows!
      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-14, 0.8, 32, 1.3);
      ctx.fillStyle = pal.windowGlow;
      // Cockpit panoramic windshield
      ctx.fillRect(16, -2.0, 4.2, 2.2);
      // Upper passenger deck window dots
      for (let wi = 0; wi < 8; wi++) {
        ctx.fillRect(11 - wi * 3.1, -2.6, 1.7, 1.1);
      }
      // Lower passenger deck window dots
      for (let wi = 0; wi < 9; wi++) {
        ctx.fillRect(12 - wi * 3.1, -0.7, 1.7, 1.1);
      }

      // Tall swept vertical tail fin with livery flash
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-10, -1.5);
      ctx.lineTo(-20, -10.5);
      ctx.lineTo(-22.5, -9.0);
      ctx.lineTo(-18, -0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.liveryAccent;
      ctx.beginPath();
      ctx.moveTo(-16, -6.5);
      ctx.lineTo(-20, -10.5);
      ctx.lineTo(-22, -9.2);
      ctx.lineTo(-18, -5.8);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "airliner") {
      // Variant 2: Large Hypersonic Passenger Space Airliner (~46px long)
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -16.5);
      ctx.lineTo(-11, -16.5);
      ctx.lineTo(-8, -3);
      ctx.lineTo(-8, 3);
      ctx.lineTo(-11, 16.5);
      ctx.lineTo(-5, 16.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-12.5, -17.5, 9, 2.6);
      ctx.fillRect(-12.5, 14.9, 9, 2.6);

      const fg = ctx.createLinearGradient(0, -4.2, 0, 4.2);
      fg.addColorStop(0, pal.bodyLight);
      fg.addColorStop(0.68, pal.bodyLight);
      fg.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.quadraticCurveTo(13, -4.2, -16, -2.8);
      ctx.lineTo(-19, 0);
      ctx.lineTo(-16, 2.8);
      ctx.quadraticCurveTo(13, 4.2, 24, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.liveryAccent;
      ctx.fillRect(-14, 0.5, 31, 1.1);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(14.5, -1.6, 4.0, 1.8);
      for (let wi = 0; wi < 8; wi++) {
        ctx.fillRect(10 - wi * 3.0, -1.5, 1.8, 1.2);
      }

      // Tall swept tail fin
      ctx.fillStyle = pal.bodyShade;
      ctx.beginPath();
      ctx.moveTo(-10, -1.2);
      ctx.lineTo(-18, -8.5);
      ctx.lineTo(-20.5, -7.2);
      ctx.lineTo(-16.5, -0.5);
      ctx.closePath();
      ctx.fill();
    } else if (variant === "clipper") {
      // Variant 3: Large Blended-Wing Passenger Orbital Cruiser (~40px long)
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.quadraticCurveTo(10, -8.5, -6, -13.5);
      ctx.lineTo(-15, -12.0);
      ctx.lineTo(-13, -4.5);
      ctx.lineTo(-15, 0);
      ctx.lineTo(-13, 4.5);
      ctx.lineTo(-15, 12.0);
      ctx.lineTo(-6, 13.5);
      ctx.quadraticCurveTo(10, 8.5, 20, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.quadraticCurveTo(8, 7.2, -14, 11.8);
      ctx.lineTo(-13, 4.5);
      ctx.lineTo(-14, -4.5);
      ctx.closePath();
      ctx.globalAlpha = 0.42;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-16, -14.2, 8, 2.2);
      ctx.fillRect(-16, 12.0, 8, 2.2);

      // Wrap-around bridge dome + passenger observation window row
      ctx.fillStyle = pal.windowGlow;
      ctx.beginPath();
      ctx.ellipse(11.5, 0, 3.8, 2.0, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let wi = 0; wi < 5; wi++) {
        ctx.fillRect(5 - wi * 3.0, -2.5, 1.8, 1.1);
        ctx.fillRect(5 - wi * 3.0, 1.4, 1.8, 1.1);
      }
    } else {
      // Variant 1: Heavy Passenger Orbital Shuttle (~40px long)
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(5, -5.8);
      ctx.lineTo(-10, -15.0);
      ctx.lineTo(-14.5, -14.0);
      ctx.lineTo(-14.5, 14.0);
      ctx.lineTo(-10, 15.0);
      ctx.lineTo(5, 5.8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(4.5, -4.6);
      ctx.lineTo(-9.5, -13.4);
      ctx.lineTo(-13.5, -12.4);
      ctx.lineTo(-13.5, 12.4);
      ctx.lineTo(-9.5, 13.4);
      ctx.lineTo(4.5, 4.6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.roundRect(-14.5, -4.4, 30, 8.8, 4.2);
      ctx.fill();
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-14.5, 1.2, 27, 2.8);

      // Illuminated passenger cabin portholes & cargo bay seam
      ctx.strokeStyle = pal.bodyShade;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-8.5, -2.5, 15, 5.0);
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(9.5, -2.2, 2.8, 4.4);
      for (let wi = 0; wi < 5; wi++) {
        ctx.fillRect(5.5 - wi * 2.8, -2.1, 1.5, 1.0);
      }

      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-7, -1.6);
      ctx.lineTo(-16.5, -9.2);
      ctx.lineTo(-18, -7.4);
      ctx.lineTo(-14, -0.8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.arc(15.5, 0, 2.8, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
    }

    // Blinking wingtip navigation strobes
    if (Math.sin(step * 12) > 0.25) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-11, -13.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-11, 13.5, 1.4, 0, Math.PI * 2);
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
    let x = 0;
    let y = 0;
    let scale = 1;
    let targetHeading = sp.heading;
    let altitude = 0;
    let showChute = false;
    let chuteInflation = 0;
    let afterburner = 0;

    const entryPt = L.rwPt(L.rwEntryT);
    const exitPt = L.rwPt(L.rwExitT);
    const rwAngle = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);
    const dirX = Math.cos(rwAngle);
    const dirY = Math.sin(rwAngle);

    if (sp.phase === "hangar_emerge") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      x = L.hangarX + 20 + (L.hangarDoorX - 22 - (L.hangarX + 20)) * ease;
      y = L.hangarDoorY - 5 + 10 * ease;
      targetHeading = Math.PI - 0.16;
      scale = 0.88;
      if (sp.t >= sp.phaseDuration) {
        if (sp.role === "apron") {
          sp.phase = "apron_taxi_out";
          sp.t = 0;
          sp.phaseDuration = this._rand(16.0, 22.0);
        } else {
          sp.phase = "taxi_to_runway";
          sp.t = 0;
          sp.phaseDuration = this._rand(16.5, 22.5);
        }
      }
    } else if (sp.phase === "apron_taxi_out") {
      // Dedicated tarmac shuttle cruising past Star Terminal arms to western apron stand
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0 = { x: L.hangarDoorX - 22, y: L.hangarDoorY + 5 };
      const p1 = { x: L.termX + 60 * L.termScale, y: L.termY + 40 * L.termScale };
      const p2 = { x: L.termX - 20 * L.termScale, y: L.termY + 44 * L.termScale };
      const p3 = { x: L.termX - 66 * L.termScale, y: L.termY + 28 * L.termScale };
      const res = this._cubicBez(p0, p1, p2, p3, s);
      x = res.x;
      y = res.y;
      targetHeading = res.angle;
      scale = 0.88 + Math.sin(s * Math.PI) * 0.08;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "gate_turnaround";
        sp.t = 0;
        sp.phaseDuration = this._rand(6.0, 14.0);
      }
    } else if (sp.phase === "gate_turnaround") {
      visible = true;
      x = L.termX - 66 * L.termScale;
      y = L.termY + 28 * L.termScale;
      targetHeading = -2.4;
      scale = 0.88;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "apron_taxi_return";
        sp.t = 0;
        sp.phaseDuration = this._rand(17.0, 23.0);
      }
    } else if (sp.phase === "apron_taxi_return") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0 = { x: L.termX - 66 * L.termScale, y: L.termY + 28 * L.termScale };
      const p1 = { x: L.termX - 10 * L.termScale, y: L.termY + 56 * L.termScale };
      const p2 = { x: L.termX + 86 * L.termScale, y: L.termY + 48 * L.termScale };
      const p3 = { x: L.hangarX + 24, y: L.hangarDoorY - 5 };
      const res = this._cubicBez(p0, p1, p2, p3, s);
      x = res.x;
      y = res.y;
      targetHeading = res.angle;
      scale = 0.88;
      if (sp.t >= sp.phaseDuration) {
        sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.phaseDuration = this._rand(6.0, 15.0);
      }
    } else if (sp.phase === "taxi_to_runway") {
      // Realistic slow taxiing from Hangar past Star Terminal to runway holding point
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0 = { x: L.hangarDoorX - 22, y: L.hangarDoorY + 5 };
      const p1 = { x: L.termX + 35, y: L.termY + 38 };
      const p2 = { x: L.termX - 55, y: L.termY + 34 };
      const p3 = { x: entryPt.x - dirX * 14, y: entryPt.y - dirY * 14 };
      const res = this._cubicBez(p0, p1, p2, p3, s);
      x = res.x;
      y = res.y;
      targetHeading = res.angle;
      scale = 0.88 + s * 0.14;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "lineup_hold";
        sp.t = 0;
        sp.phaseDuration = this._rand(2.4, 4.2);
      }
    } else if (sp.phase === "lineup_hold") {
      // Smoothly turns onto runway centreline & holds short if another plane is on the runway!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      x = (entryPt.x - dirX * 14) + dirX * 14 * ease;
      y = (entryPt.y - dirY * 14) + dirY * 14 * ease;
      targetHeading = rwAngle;
      scale = 1.02;
      if (sp.t >= sp.phaseDuration && !this._isRunwayBusy(sp)) {
        sp.phase = "runway_takeoff";
        sp.t = 0;
        sp.phaseDuration = this._rand(10.8, 13.5);
      }
    } else if (sp.phase === "runway_takeoff") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      afterburner = p < 0.86 ? (0.45 + p * 0.65) : Math.max(0, (1 - p) * 7);
      const liftT = 0.70;
      const liftPt = L.rwPt(liftT);

      if (p < 0.46) {
        // Ground acceleration roll down diagonal runway
        const gp = p / 0.46;
        const accel = Math.pow(gp, 2.25);
        const rwT = L.rwEntryT + (liftT - L.rwEntryT) * accel;
        const pt = L.rwPt(rwT);
        x = pt.x;
        y = pt.y;
        // Gentle nose-up rotation right before liftoff!
        const rotPitch = Math.max(0, (gp - 0.72) / 0.28);
        targetHeading = rwAngle - rotPitch * 0.14;
        altitude = Math.pow(rotPitch, 2) * 3.5;
        scale = 1.02 + accel * 0.14;
      } else {
        // C1-smooth cubic Bezier climb tangent to liftoff velocity vector!
        const cp = (p - 0.46) / 0.54;
        const endY = h * (0.05 + (sp.id === "sp_flight_2" ? 0.04 : 0));
        const res = this._cubicBez(
          liftPt,
          { x: liftPt.x + dirX * 115, y: liftPt.y + dirY * 115 - 24 },
          { x: w * 0.84, y: liftPt.y * 0.55 },
          { x: w + 100, y: endY },
          cp
        );
        x = res.x;
        y = res.y;
        targetHeading = res.angle;
        altitude = 3.5 + Math.pow(cp, 1.35) * 95;
        scale = Math.max(0.46, 1.16 - cp * 0.68);

        if (Math.random() < 0.76) {
          this.plumeParticles.push({
            x: x - Math.cos(sp.heading) * 18 * scale,
            y: y - Math.sin(sp.heading) * 18 * scale,
            vx: -Math.cos(sp.heading) * 0.22,
            vy: 0.07,
            r: 2.2 + Math.random() * 2.2,
            grow: 0.09,
            hot: false,
            life: 0,
            maxLife: 115
          });
        }
      }
      if (sp.t >= sp.phaseDuration) {
        sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
        sp.phase = "sky_wait";
        sp.t = 0;
        sp.phaseDuration = this._rand(4.5, 11.5);
      }
    } else if (sp.phase === "sky_wait") {
      if (sp.t >= sp.phaseDuration && !this._isRunwayBusy(sp)) {
        const tdPt = L.rwPt(0.14);
        const startPt = { x: -95, y: L.horizonY - 58 };
        sp.heading = Math.atan2(tdPt.y - startPt.y, tdPt.x - startPt.x);
        sp.phase = "approach";
        sp.t = 0;
        sp.phaseDuration = this._rand(8.5, 11.5);
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      // Smooth C1 Bezier glide slope ending tangent to runway with gentle landing flare!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const startPt = { x: -95, y: L.horizonY - 58 };
      const tdPt = L.rwPt(0.14);
      const res = this._cubicBez(
        startPt,
        { x: tdPt.x * 0.25, y: startPt.y + (tdPt.y - startPt.y) * 0.55 },
        { x: tdPt.x - dirX * 95, y: tdPt.y - dirY * 95 - 12 },
        tdPt,
        p
      );
      x = res.x;
      y = res.y;
      const flare = p > 0.78 ? ((p - 0.78) / 0.22) * 0.09 : 0;
      targetHeading = res.angle - flare;
      altitude = Math.pow(1 - p, 1.55) * 34;
      scale = 0.58 + p * 0.42;

      if (sp.t >= sp.phaseDuration) {
        for (let i = 0; i < 6; i++) {
          this.ventParticles.push({
            x: tdPt.x + (Math.random() - 0.5) * 6,
            y: tdPt.y + 2,
            vx: (Math.random() - 0.5) * 1.0,
            vy: -(0.15 + Math.random() * 0.3),
            r: 2.5 + Math.random() * 2.5,
            life: 0,
            maxLife: 38
          });
        }
        sp.phase = "chute_rollout";
        sp.t = 0;
        sp.phaseDuration = this._rand(8.5, 11.2);
      }
    } else if (sp.phase === "chute_rollout") {
      // Realistic nose-down settle + billowing drogue chute drag deceleration curve
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const decel = 1 - Math.pow(1 - p, 2.55);
      const rwT = 0.14 + (L.rwExitT - 0.14) * decel;
      const pt = L.rwPt(rwT);
      x = pt.x;
      y = pt.y;
      scale = 1.0 + (rwT - 0.14) * 0.26;
      const noseSettle = Math.max(0, 1 - p / 0.14) * 0.08;
      targetHeading = rwAngle - noseSettle;
      altitude = 0;

      if (p < 0.78) {
        showChute = true;
        chuteInflation = p < 0.12 ? (p / 0.12) : (0.94 + Math.sin(step * 18) * 0.06);
      } else if (!sp.chuteDetached) {
        sp.chuteDetached = true;
        sp.detachedChuteX = x - Math.cos(sp.heading) * 30 * scale;
        sp.detachedChuteY = y - Math.sin(sp.heading) * 30 * scale;
        sp.detachedChuteAlpha = 0.85;
      }

      if (sp.t >= sp.phaseDuration) {
        sp.phase = "taxi_to_hangar";
        sp.t = 0;
        sp.phaseDuration = this._rand(17.5, 23.5);
      }
    } else if (sp.phase === "taxi_to_hangar") {
      // C1-continuous exit curve turning smoothly off runway past Star Terminal right inside Hangar!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0 = { x: exitPt.x, y: exitPt.y };
      const p1 = { x: exitPt.x + dirX * 52, y: exitPt.y + dirY * 52 };
      const p2 = { x: L.termX + 105, y: L.termY + 46 };
      const p3 = { x: L.hangarX + 24, y: L.hangarDoorY - 5 };
      const res = this._cubicBez(p0, p1, p2, p3, s);
      x = res.x;
      y = res.y;
      targetHeading = res.angle;
      scale = 1.12 - s * 0.24;

      if (sp.t >= sp.phaseDuration) {
        sp.variant = this._pick(this.SPACEPLANE_VARIANTS);
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.phaseDuration = this._rand(6.0, 15.0);
      }
    } else {
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "hangar_emerge";
        sp.t = 0;
        sp.phaseDuration = this._rand(7.0, 10.0);
      }
    }

    // Smooth angular damping (eliminates instantaneous snapping during turns!)
    sp.heading = this._lerpAngle(sp.heading, targetHeading, Math.min(1, dt * 6.5));
    sp.altitude = altitude;

    if (sp.chuteDetached && sp.detachedChuteAlpha > 0.01) {
      sp.detachedChuteAlpha = Math.max(0, sp.detachedChuteAlpha - dt * 0.6);
      ctx.save();
      ctx.globalAlpha = sp.detachedChuteAlpha;
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.ellipse(sp.detachedChuteX, sp.detachedChuteY + 3, 8, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!visible) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sp.heading);
    ctx.scale(scale, scale);

    if (showChute && chuteInflation > 0.05) {
      const tetherLen = 17 + chuteInflation * 17;
      const chuteR = 8.4 * chuteInflation;
      const tailX = -15;
      const canopyX = tailX - tetherLen;

      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.62)" : "rgba(71, 85, 105, 0.60)";
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
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(canopyX - chuteR * 0.38, -chuteR * 0.56);
      ctx.lineTo(canopyX - chuteR * 0.38, chuteR * 0.56);
      ctx.stroke();
    }

    // Forward landing/taxi headlight cone
    const beamA = pal.isNightLights ? 0.38 : 0.14;
    const beamG = ctx.createLinearGradient(18, 0, 68, 0);
    beamG.addColorStop(0, `rgba(255, 251, 235, ${beamA})`);
    beamG.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(18, -1.8);
    ctx.lineTo(68, -12);
    ctx.lineTo(68, 12);
    ctx.lineTo(18, 1.8);
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
        const a = (1 - t) * 0.24;
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
        this.fogState.targetAlpha = roll ? (0.36 + Math.random() * 0.26) : 0;
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
      const peak = this.fogState.alpha * (layer === 0 ? 0.52 : 0.38);
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
