/**
 * PETTR World Renderer: Space — "Gateway" (v12.1 2.5D Island Spaceport Overhaul)
 * Elevated coastal peninsula spaceport inspired by futuristic orbital architecture:
 * - Offscreen-cached 2.5D island landmass, shimmering bay water with reflections, distant islands,
 *   curving foreground highway causeway bridge, iconic Star-Shaped Spire Terminal, twin launch towers,
 *   sleek arched Assembly Hangar, radome, ATC control tower, and sweeping diagonal runway + taxiways.
 * - Full drawn-out rocket lifecycle: Towed out of hangar -> Erected at twin towers -> Loading arm swings in ->
 *   Cryo venting -> Arm retracts & Launch -> Returning booster landing burn -> Tower catch -> Lowered -> Towed back into hangar.
 * - 3 distinct multi-part spaceplane variants (Shuttle Orbiter, Hypersonic Space Airliner, Lifting-Body Clipper)
 *   that BOTH launch and land on the runway (deploying billowing drogue chutes on landing) and taxi smoothly
 *   behind/inside the arched hangar bay without ever popping or despawning.
 * - Full diurnal lighting shifts + probabilistic rolling dawn fog in morning mode.
 */
const WorldGateway = {
  cacheCanvas: null,
  cacheKey: "",
  stars: [],
  clouds: [],
  plumeParticles: [],
  ventParticles: [],
  rocket: null,
  spaceplane: null,
  spVariantIdx: 0,
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  boats: [],
  _lastW: 0,
  _lastH: 0,
  _lastMode: "",

  SPACEPLANE_VARIANTS: ["shuttle", "airliner", "clipper"],

  reset() {
    this.cacheKey = "";
    this.plumeParticles = [];
    this.ventParticles = [];
    this.rocket = null;
    this.spaceplane = null;
    this.stars = [];
    this.clouds = [];
    this.orbiters = [];
    this.boats = [];
    this.fogState = { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 };
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isNightLights: false,
        lightIntensity: 0.42,
        skyTop: "#7F99C4",
        skyMid: "#E6A9A4",
        skyHorizon: "#FDD3A3",
        sunCore: "rgba(255, 250, 230, 0.95)",
        sunGlow: "253, 186, 116",
        waterFar: "#C4B4C6",
        waterMid: "#8D97B4",
        waterNear: "#4E5F82",
        islandFar: "#9E95AB",
        landBase: "#B6A5A4",
        landShade: "#8F8289",
        foliage: "#3E4A59",
        runwayFill: "#5C5B68",
        runwayLight: "rgba(255, 244, 224, 0.65)",
        archLight: "#F8EEE8",
        archMid: "#C4B7BE",
        archDark: "#6E6878",
        towerSteel: "#5A5666",
        windowGlow: "rgba(254, 226, 170, 0.72)",
        hangarInterior: "rgba(251, 191, 120, 0.45)",
        plumeCore: "255, 250, 232",
        plumeMid: "251, 165, 92",
        smokeRgb: "248, 226, 214",
        smokeAlpha: 0.45,
        chuteColor: "#E05A47",
        chuteStripe: "#FFF5E6",
        bodyLight: "#FFF9F5",
        bodyShade: "#9A919C"
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
        islandFar: "#584C68",
        landBase: "#5A5369",
        landShade: "#3B374B",
        foliage: "#1F2636",
        runwayFill: "#2C2B3A",
        runwayLight: "rgba(253, 215, 130, 0.72)",
        archLight: "#D8CDD2",
        archMid: "#8A8296",
        archDark: "#3F3B4F",
        towerSteel: "#474158",
        windowGlow: "rgba(254, 215, 125, 0.92)",
        hangarInterior: "rgba(251, 191, 88, 0.62)",
        plumeCore: "255, 248, 224",
        plumeMid: "249, 115, 22",
        smokeRgb: "238, 172, 132",
        smokeAlpha: 0.40,
        chuteColor: "#F97316",
        chuteStripe: "#FEF3C7",
        bodyLight: "#F1EAE6",
        bodyShade: "#635E73"
      };
    }
    if (mode === "dark") {
      return {
        isNightLights: true,
        lightIntensity: 1.0,
        skyTop: "#050914",
        skyMid: "#0C152B",
        skyHorizon: "#1A2948",
        sunCore: "rgba(186, 230, 253, 0.35)",
        sunGlow: "56, 189, 248",
        waterFar: "#121E36",
        waterMid: "#0B1426",
        waterNear: "#060B17",
        islandFar: "#141F36",
        landBase: "#162033",
        landShade: "#0E1524",
        foliage: "#090F1A",
        runwayFill: "#101726",
        runwayLight: "rgba(125, 211, 252, 0.78)",
        archLight: "#64748B",
        archMid: "#334155",
        archDark: "#151F33",
        towerSteel: "#384766",
        windowGlow: "rgba(254, 225, 148, 0.92)",
        hangarInterior: "rgba(186, 230, 253, 0.48)",
        plumeCore: "255, 252, 242",
        plumeMid: "251, 146, 60",
        smokeRgb: "148, 163, 184",
        smokeAlpha: 0.32,
        chuteColor: "#FB923C",
        chuteStripe: "#F8FAFC",
        bodyLight: "#CBD5E1",
        bodyShade: "#334155"
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
      islandFar: "#9CB2CA",
      landBase: "#C9D3DE",
      landShade: "#A1B0C2",
      foliage: "#5B747E",
      runwayFill: "#64748B",
      runwayLight: "rgba(255, 255, 255, 0.75)",
      archLight: "#FFFFFF",
      archMid: "#CBD5E1",
      archDark: "#64748B",
      towerSteel: "#475569",
      windowGlow: "rgba(224, 242, 254, 0.65)",
      hangarInterior: "rgba(203, 213, 225, 0.45)",
      plumeCore: "255, 255, 255",
      plumeMid: "251, 191, 36",
      smokeRgb: "241, 245, 249",
      smokeAlpha: 0.50,
      chuteColor: "#EF4444",
      chuteStripe: "#FFFFFF",
      bodyLight: "#FFFFFF",
      bodyShade: "#8A9BB0"
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.34 : 0.28);
    const islandTopY = h * (isNarrow ? 0.46 : 0.41);
    const islandBotY = h * (isNarrow ? 0.78 : 0.76);

    // Twin Launch & Catch Towers on Left-Midground Peninsula (matching inspiration image!)
    const padX = w * (isNarrow ? 0.19 : 0.21);
    const padY = islandTopY + (islandBotY - islandTopY) * 0.14;
    const towerH = Math.min(188, Math.max(104, h * 0.21));
    const towerW = Math.max(12, towerH * 0.088);
    const towerLeftX = padX - towerW * 1.9;
    const towerRightX = padX + towerW * 1.9;

    // Iconic Star-Shaped Spire Central Terminal (centre of island)
    const termX = w * 0.50;
    const termY = islandTopY + (islandBotY - islandTopY) * 0.32;
    const termScale = isNarrow ? 0.65 : Math.min(1.12, Math.max(0.75, w / 1280));

    // Sleek Arched Assembly Hangar (right-midground — natural occlusion bay for rockets & spaceplanes!)
    const hangarX = w * (isNarrow ? 0.78 : 0.76);
    const hangarY = islandTopY + (islandBotY - islandTopY) * 0.17;
    const hangarW = Math.min(168, w * (isNarrow ? 0.24 : 0.13));
    const hangarH = hangarW * 0.31;
    const hangarDoorX = hangarX - hangarW * 0.20;
    const hangarDoorY = hangarY + hangarH * 0.44;

    // Radome & Tall Glass ATC Control Tower (far right)
    const radomeX = w * 0.86;
    const radomeY = hangarY + 4;
    const atcX = w * 0.905;
    const atcY = hangarY + 12;

    // Sweeping Diagonal Main Runway across lower-middle of island
    const rwLeftX = w * 0.04;
    const rwLeftY = islandTopY + (islandBotY - islandTopY) * 0.28;
    const rwRightX = w * 0.96;
    const rwRightY = islandBotY + h * 0.04;

    // Runway helper interpolation (t = 0 far-left, t = 1 near-right)
    const rwPt = (t) => ({
      x: rwLeftX + (rwRightX - rwLeftX) * t,
      y: rwLeftY + (rwRightY - rwLeftY) * t
    });

    // Taxiway junction connecting runway -> Star Terminal -> Arched Hangar
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

    // 2. Low Sun / Moon Disk & Horizon Glow (left-of-centre matching inspiration image!)
    const sunX = w * 0.11;
    const sunY = L.horizonY - 8;
    if (mode !== "dark") {
      const sunHalo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, Math.min(w * 0.45, 420));
      sunHalo.addColorStop(0, pal.sunCore);
      sunHalo.addColorStop(0.18, `rgba(${pal.sunGlow}, 0.45)`);
      sunHalo.addColorStop(0.55, `rgba(${pal.sunGlow}, 0.14)`);
      sunHalo.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
      ctx.fillStyle = sunHalo;
      ctx.fillRect(0, 0, w, L.horizonY + 120);

      // Crisp solar disk right above horizon
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

    // 3. Upper Coastal Bay & Shimmering Distant Islands
    const bayGrad = ctx.createLinearGradient(0, L.horizonY, 0, h);
    bayGrad.addColorStop(0, pal.waterFar);
    bayGrad.addColorStop(0.42, pal.waterMid);
    bayGrad.addColorStop(1, pal.waterNear);
    ctx.fillStyle = bayGrad;
    ctx.fillRect(0, L.horizonY, w, h - L.horizonY);

    // Sun shimmer column reflecting on the upper bay
    if (mode !== "dark") {
      ctx.save();
      const refG = ctx.createLinearGradient(sunX, L.horizonY, sunX, L.islandTopY + 30);
      refG.addColorStop(0, `rgba(${pal.sunGlow}, 0.55)`);
      refG.addColorStop(1, `rgba(${pal.sunGlow}, 0)`);
      ctx.fillStyle = refG;
      ctx.beginPath();
      ctx.moveTo(sunX - 18, L.horizonY);
      ctx.lineTo(sunX + 18, L.horizonY);
      ctx.lineTo(sunX + 68, L.islandTopY + 30);
      ctx.lineTo(sunX - 68, L.islandTopY + 30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Distant Archipelago Islands dotting the bay
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

    // Crisp coastal seawall edge & reflection along lower-left waterfront
    ctx.strokeStyle = pal.isNightLights ? "rgba(148, 163, 184, 0.22)" : "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, L.islandTopY + 75);
    ctx.lineTo(w * 0.12, L.islandBotY - 38);
    ctx.lineTo(w * 0.62, L.islandBotY + 32);
    ctx.stroke();

    // Dark greenery strip framing the waterfront embankment
    ctx.fillStyle = pal.foliage;
    ctx.beginPath();
    ctx.moveTo(w * 0.10, L.islandBotY - 40);
    ctx.lineTo(w * 0.63, L.islandBotY + 30);
    ctx.lineTo(w * 0.61, L.islandBotY + 42);
    ctx.lineTo(w * 0.08, L.islandBotY - 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Sweeping Diagonal Main Runway, Parallel Taxiway & Apron Connectors
    this._drawRunwayNetwork(ctx, L, pal);

    // 6. Waterfront Support Buildings & Hangars along lower embankment (2.5D shaded boxes)
    const waterfrontBldgs = [
      { t: 0.22, w: 38, h: 16 },
      { t: 0.30, w: 32, h: 13 },
      { t: 0.39, w: 28, h: 12 },
      { t: 0.48, w: 34, h: 14 },
      { t: 0.78, w: 54, h: 18 }
    ];
    waterfrontBldgs.forEach(b => {
      const bx = w * b.t;
      const by = L.islandBotY - 36 + (b.t - 0.14) * 120;
      this._draw25DBuilding(ctx, bx, by, b.w, b.h, pal);
    });

    // 7. Heavy Crawlerway Apron Road connecting Arched Hangar -> Twin Launch Towers
    ctx.save();
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(L.hangarDoorX, L.hangarDoorY);
    ctx.quadraticCurveTo(w * 0.48, L.padY + 6, L.padX, L.padY + 4);
    ctx.stroke();
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 8. Twin Launch & Catch Towers + Concrete Launch Mount (Left-Midground)
    // Concrete orbital launch deck
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(L.padX - 42, L.padY + 12);
    ctx.lineTo(L.padX - 30, L.padY - 3);
    ctx.lineTo(L.padX + 32, L.padY - 3);
    ctx.lineTo(L.padX + 44, L.padY + 12);
    ctx.closePath();
    ctx.fill();

    // Subtle tower reflection in the upper bay behind pad
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pal.towerSteel;
    ctx.fillRect(L.towerLeftX - 4, L.padY - 22, 8, 22);
    ctx.fillRect(L.towerRightX - 4, L.padY - 22, 8, 22);
    ctx.restore();

    this._drawLatticeTower(ctx, L.towerLeftX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);
    this._drawLatticeTower(ctx, L.towerRightX, L.padY, L.towerW, L.towerH, pal.towerSteel, 0.94);

    // 9. Iconic Multi-Arm Star-Shaped Spire Terminal (Centre of Island!)
    this._drawStarTerminal(ctx, L, pal);

    // Parked static spaceplanes docked at Star Terminal gates & outside Hangar apron for bustling scale!
    const parked = [
      { x: L.termX - 68 * L.termScale, y: L.termY + 26 * L.termScale, ang: -0.25, sc: 0.72 * L.termScale, v: "airliner" },
      { x: L.termX + 108 * L.termScale, y: L.termY + 22 * L.termScale, ang: 2.88, sc: 0.68 * L.termScale, v: "clipper" },
      { x: L.hangarDoorX + 6, y: L.hangarDoorY + 2, ang: 3.0, sc: 0.62 * L.termScale, v: "shuttle" }
    ];
    parked.forEach(pk => {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.rotate(pk.ang);
      ctx.scale(pk.sc, pk.sc);
      this._drawSpaceplaneModel(ctx, pk.v, pal, 0, 0);
      ctx.restore();
    });

    // 10. Curved Arched Assembly Hangar (Back wall & illuminated interior bay; foreground lip is redrawn AFTER craft!)
    this._drawArchedHangarBase(ctx, L, pal);

    // 11. Radome & Tall Futuristic ATC Control Tower (Far Right)
    this._drawRadomeAndATC(ctx, L, pal);

    // 12. Foreground Lower-Right Curving Elevated Highway Causeway Bridge + Lower-Left Coastal Hillside
    this._drawForegroundBridgeAndCoast(ctx, w, h, L, pal);
  },

  _draw25DBuilding(ctx, x, y, bw, bh, pal) {
    ctx.save();
    // Sunlit front face
    ctx.fillStyle = pal.archLight;
    ctx.fillRect(x, y - bh, bw * 0.68, bh);
    // Shaded isometric side wall
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x + bw * 0.68, y - bh);
    ctx.lineTo(x + bw, y - bh + 4);
    ctx.lineTo(x + bw, y + 3);
    ctx.lineTo(x + bw * 0.68, y);
    ctx.closePath();
    ctx.fill();
    // Rooftop cap
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(x, y - bh);
    ctx.lineTo(x + bw * 0.32, y - bh - 3);
    ctx.lineTo(x + bw, y - bh + 4);
    ctx.lineTo(x + bw * 0.68, y - bh);
    ctx.closePath();
    ctx.fill();
    // Subtle lit window strip
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(x + 4, y - bh * 0.55, bw * 0.54, Math.max(2, bh * 0.18));
    ctx.restore();
  },

  _drawRunwayNetwork(ctx, L, pal) {
    ctx.save();
    // Main Diagonal Sweeping Runway Polygon (perspective widened toward right-near!)
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

    // Crisp outer runway edge lines
    ctx.strokeStyle = pal.runwayLight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(L.rwLeftX, L.rwLeftY - lHalf + 2);
    ctx.lineTo(L.rwRightX, L.rwRightY - rHalf + 4);
    ctx.moveTo(L.rwLeftX, L.rwLeftY + lHalf - 2);
    ctx.lineTo(L.rwRightX, L.rwRightY + rHalf - 4);
    ctx.stroke();

    // Dashed foreshortened runway centreline
    ctx.strokeStyle = pal.isNightLights ? "rgba(241, 245, 249, 0.45)" : "rgba(255, 255, 255, 0.80)";
    for (let i = 0; i < 16; i++) {
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

    // Parallel upper taxiway & curved hangar apron connectors
    const exitPt = L.rwPt(L.rwExitT);
    const entryPt = L.rwPt(L.rwEntryT);
    ctx.strokeStyle = pal.runwayFill;
    ctx.lineWidth = 11;
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    // Exit taxiway curving up to Star Terminal & Arched Hangar
    ctx.moveTo(exitPt.x, exitPt.y - 14);
    ctx.quadraticCurveTo(L.termX + 85, L.termY + 42, L.hangarDoorX, L.hangarDoorY);
    // Departure taxiway curving from Hangar past Star Terminal to Left Runway Entry
    ctx.moveTo(L.hangarDoorX, L.hangarDoorY);
    ctx.quadraticCurveTo(L.termX + 10, L.termY + 34, entryPt.x, entryPt.y - 8);
    ctx.stroke();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.52)";
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  _drawStarTerminal(ctx, L, pal) {
    const s = L.termScale;
    ctx.save();
    ctx.translate(L.termX, L.termY);
    ctx.scale(s, s);

    // Warm/cool ambient glow pool beneath concourse glass wings
    const underGlow = ctx.createRadialGradient(0, 6, 8, 0, 6, 155);
    underGlow.addColorStop(0, pal.windowGlow);
    underGlow.addColorStop(0.55, pal.isNightLights ? "rgba(251, 191, 36, 0.16)" : "rgba(255, 255, 255, 0.12)");
    underGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = underGlow;
    ctx.beginPath();
    ctx.ellipse(0, 8, 160, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5 Sweeping Organic Multi-Arm Concourse Wings (2.5D perspective foreshortening!)
    const arms = [
      { ax: -175, ay: 6, w: 12 },   // Far-left long pier
      { ax: -115, ay: -20, w: 9 },  // Rear-left pier
      { ax: 135, ay: -16, w: 9 },   // Rear-right pier
      { ax: 180, ay: 16, w: 12 },   // Far-right long pier
      { ax: 48, ay: 34, w: 11 }     // Front-right arrival concourse
    ];

    // Shadowed glass under-walls first (gives strong 2.5D thickness!)
    arms.forEach(a => {
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 10, a.ax, a.ay + 6);
      ctx.lineTo(a.ax, a.ay + 2);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.45 + 3, 0, 0);
      ctx.closePath();
      ctx.fill();

      // Glowing recessed glass concourse ribbon along each wing
      ctx.strokeStyle = pal.windowGlow;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(a.ax * 0.15, a.ay * 0.15 + 6);
      ctx.quadraticCurveTo(a.ax * 0.55, a.ay * 0.48 + 6, a.ax * 0.92, a.ay * 0.92 + 4);
      ctx.stroke();
    });

    // Sculpted white/titanium curved star roof canopy on top
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.ellipse(0, -1, 56, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    arms.forEach(a => {
      ctx.fillStyle = pal.archLight;
      ctx.beginPath();
      ctx.moveTo(0, -a.w * 0.65);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.42 - a.w * 0.42, a.ax, a.ay);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.48 + a.w * 0.35, 0, a.w * 0.65);
      ctx.closePath();
      ctx.fill();

      // Subtle shaded roof spine crease
      ctx.strokeStyle = pal.archMid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(a.ax * 0.52, a.ay * 0.44, a.ax * 0.96, a.ay * 0.96);
      ctx.stroke();
    });

    // Central soaring graceful architectural spire (iconic centrepiece!)
    // Shaded right face
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(0, -96);
    ctx.quadraticCurveTo(6, -34, 22, -2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    // Sunlit left face
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(0, -96);
    ctx.quadraticCurveTo(-5, -34, -20, -2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    // Glass atrium cutout at base of spire
    ctx.fillStyle = pal.windowGlow;
    ctx.beginPath();
    ctx.ellipse(0, -14, 5, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  _drawArchedHangarBase(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    // Far curved vaulted back wall + warm/cool illuminated interior bay
    ctx.fillStyle = pal.archDark;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.5);
    ctx.quadraticCurveTo(x + hw * 0.5, y - hh * 0.95, x + hw, y + hh * 0.5);
    ctx.lineTo(x + hw, y + hh * 0.55);
    ctx.lineTo(x, y + hh * 0.55);
    ctx.closePath();
    ctx.fill();

    // Glowing hangar bay floor spill
    const bayG = ctx.createRadialGradient(L.hangarDoorX, L.hangarDoorY, 4, L.hangarDoorX, L.hangarDoorY, hw * 0.46);
    bayG.addColorStop(0, pal.hangarInterior);
    bayG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bayG;
    ctx.beginPath();
    ctx.ellipse(L.hangarDoorX, L.hangarDoorY + 4, hw * 0.45, hh * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // Foreground hangar arch shell drawn AFTER moving craft so vehicles smoothly hide inside/behind it!
  _drawArchedHangarOcclusionRoof(ctx, L, pal) {
    const x = L.hangarX - L.hangarW * 0.5;
    const y = L.hangarY;
    const hw = L.hangarW;
    const hh = L.hangarH;

    ctx.save();
    // Main vaulted metallic hangar shell with arched cutaway door on left-front
    const roofG = ctx.createLinearGradient(x, y - hh * 0.6, x + hw, y + hh * 0.5);
    roofG.addColorStop(0, pal.archLight);
    roofG.addColorStop(0.55, pal.archMid);
    roofG.addColorStop(1, pal.archDark);

    ctx.fillStyle = roofG;
    ctx.beginPath();
    ctx.moveTo(x, y + hh * 0.52);
    ctx.lineTo(x, y + hh * 0.14);
    ctx.quadraticCurveTo(x + hw * 0.48, y - hh * 1.05, x + hw, y + hh * 0.08);
    ctx.lineTo(x + hw, y + hh * 0.54);
    // Cut back up around the open hangar bay entrance on left-front
    ctx.lineTo(x + hw * 0.54, y + hh * 0.54);
    ctx.lineTo(x + hw * 0.52, y + hh * 0.04);
    ctx.quadraticCurveTo(x + hw * 0.30, y - hh * 0.16, x + hw * 0.08, y + hh * 0.08);
    ctx.lineTo(x + hw * 0.06, y + hh * 0.52);
    ctx.closePath();
    ctx.fill();

    // Subtle hangar ribbing lines
    ctx.strokeStyle = pal.isNightLights ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      const rx = x + hw * (0.55 + r * 0.11);
      ctx.beginPath();
      ctx.moveTo(rx, y - hh * 0.15 + r * 4);
      ctx.lineTo(rx + 6, y + hh * 0.52);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawRadomeAndATC(ctx, L, pal) {
    ctx.save();
    // Spherical white weather/tracking Radome on pedestal
    ctx.fillStyle = pal.archDark;
    ctx.fillRect(L.radomeX - 4, L.radomeY - 12, 8, 16);
    const radG = ctx.createRadialGradient(L.radomeX - 3, L.radomeY - 22, 1, L.radomeX, L.radomeY - 20, 12);
    radG.addColorStop(0, pal.archLight);
    radG.addColorStop(1, pal.archDark);
    ctx.fillStyle = radG;
    ctx.beginPath();
    ctx.arc(L.radomeX, L.radomeY - 20, 10, 0, Math.PI * 2);
    ctx.fill();

    // Tall Sculpted ATC Control Tower
    const ax = L.atcX;
    const ay = L.atcY + 8;
    ctx.fillStyle = pal.archMid;
    ctx.beginPath();
    ctx.moveTo(ax - 6, ay);
    ctx.lineTo(ax - 3.5, ay - 52);
    ctx.lineTo(ax + 3.5, ay - 52);
    ctx.lineTo(ax + 6, ay);
    ctx.closePath();
    ctx.fill();
    // Observation cab
    ctx.fillStyle = pal.archLight;
    ctx.beginPath();
    ctx.moveTo(ax - 11, ay - 62);
    ctx.lineTo(ax + 11, ay - 62);
    ctx.lineTo(ax + 8, ay - 50);
    ctx.lineTo(ax - 8, ay - 50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.windowGlow;
    ctx.fillRect(ax - 8, ay - 59, 16, 4.5);
    // Antenna mast
    ctx.strokeStyle = pal.towerSteel;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 62);
    ctx.lineTo(ax, ay - 76);
    ctx.stroke();
    ctx.restore();
  },

  _drawForegroundBridgeAndCoast(ctx, w, h, L, pal) {
    ctx.save();
    // 1. Curving Elevated Highway Causeway Bridge arching across lower-right water!
    const p0x = w * 0.65;
    const p0y = L.islandBotY + 12;
    const cpx = w * 0.60;
    const cpy = h * 0.90;
    const p2x = w * 0.92;
    const p2y = h + 8;

    // Support piers dipping into water + vertical water reflections
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

    // Bridge deck underside shadow
    ctx.strokeStyle = pal.archDark;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(p0x, p0y + 4);
    ctx.quadraticCurveTo(cpx, cpy + 5, p2x, p2y + 5);
    ctx.stroke();

    // Bridge roadway surface
    ctx.strokeStyle = pal.archMid;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(p0x, p0y);
    ctx.quadraticCurveTo(cpx, cpy, p2x, p2y);
    ctx.stroke();

    // Sunlit outer bridge parapet rail
    ctx.strokeStyle = pal.archLight;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(p0x - 4, p0y - 2);
    ctx.quadraticCurveTo(cpx - 5, cpy - 2, p2x - 5, p2y - 2);
    ctx.stroke();

    // Warm bridge streetlights along the curve (bright at dusk/night)
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

    // 2. Dark Lush Foreground Coastal Hillside Silhouette (bottom-left framing corner)
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

    // Crown lightning spire
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - 14);
    ctx.stroke();
    ctx.restore();
  },

  ensureEntities(w, h, now) {
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
          y: 22 + Math.random() * (h * 0.20),
          rx: 75 + Math.random() * 110,
          ry: 14 + Math.random() * 14,
          vx: 0.12 + Math.random() * 0.18
        });
      }
    }
    if (this.boats.length === 0) {
      this.boats = [
        { x: w * 0.18, y: h * 0.80, vx: 0.16 },
        { x: w * 0.52, y: h * 0.89, vx: -0.14 }
      ];
    }
    if (!this.rocket) {
      // Drawn-out authentic lifecycle:
      // tow_out -> erect -> arm_swing -> launch -> coast_wait -> descent -> catch -> lower_horizontal -> tow_back
      this.rocket = {
        phase: "erect",
        t: 0,
        phaseDuration: 5.5,
        armClose: 0.0,
        tiltAngle: Math.PI * 0.5, // Math.PI/2 = horizontal on transporter, 0 = vertical
        x: 0,
        y: 0,
        angle: 0
      };
    }
    if (!this.spaceplane) {
      // Alternates seamlessly between runway launches and runway landings, always occluded cleanly inside hangar!
      // Phases: hangar_emerge -> taxi_to_runway -> runway_takeoff -> sky_wait -> approach -> chute_rollout -> taxi_to_hangar -> hangar_rest
      this.spaceplane = {
        variant: this.SPACEPLANE_VARIANTS[0],
        phase: "hangar_emerge",
        t: 0,
        phaseDuration: 3.4,
        chuteDetached: false,
        detachedChuteX: 0,
        detachedChuteY: 0,
        detachedChuteAlpha: 0
      };
    }
    if (!this.fogState.nextCheck) {
      const roll = Math.random() < 0.58;
      this.fogState.active = roll;
      this.fogState.targetAlpha = roll ? (0.40 + Math.random() * 0.24) : 0;
      this.fogState.nextCheck = now + 18000;
    }
  },

  pulseActivity({ kind = "complete" } = {}) {
    // Advance rocket immediately toward launch if standing/arming, or dispatch a spaceplane takeoff/approach
    if (this.rocket && (this.rocket.phase === "arm_swing" || this.rocket.phase === "erect") && this.rocket.t > 1.0) {
      this.rocket.phase = "launch";
      this.rocket.t = 0;
      this.rocket.phaseDuration = 12.0;
    } else if (this.spaceplane && (this.spaceplane.phase === "hangar_rest" || this.spaceplane.phase === "sky_wait") && this.spaceplane.t > 0.8) {
      this.spaceplane.phase = this.spaceplane.phase === "hangar_rest" ? "hangar_emerge" : "approach";
      this.spaceplane.t = 0;
      this.spaceplane.phaseDuration = this.spaceplane.phase === "hangar_emerge" ? 3.2 : 5.4;
    }

    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const count = (kind === "queue_clear" || kind === "finalise") ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.orbiters.push({
        x: w * (0.12 + Math.random() * 0.35),
        y: 18 + Math.random() * (h * 0.18),
        vx: 4.5 + Math.random() * 3.0,
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

    // 1. Blit offscreen cached 2.5D coastal spaceport complex
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Dynamic Sky Layer (twinkling stars at dusk/night, drifting high clouds by day)
    if (mode === "dark" || mode === "evening") {
      const maxA = mode === "dark" ? 0.65 : 0.26;
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.phase += s.speed * (dt * 60);
        const a = maxA * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase)));
        ctx.fillStyle = `rgba(226, 232, 240, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      ctx.save();
      for (let i = 0; i < this.clouds.length; i++) {
        const c = this.clouds[i];
        c.x += c.vx * (dt * 60);
        if (c.x - c.rx > w + 40) c.x = -c.rx - 40;
        const g = ctx.createRadialGradient(c.x, c.y, c.ry * 0.2, c.x, c.y, c.rx);
        const rgb = mode === "morning" ? "255, 235, 218" : "255, 255, 255";
        g.addColorStop(0, `rgba(${rgb}, 0.30)`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Subtle Channel Vessels Gliding Across Lower Bay Water
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

    // 5. Dynamic Complex Lights (tower aviation beacons, runway approach strobes, pad floodlights)
    this._drawComplexLights(ctx, L, pal, step);

    // 6. Rocket Full Lifecycle (tow_out -> erect -> arm_swing -> launch -> descent -> catch -> lower -> tow_back)
    this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);

    // 7. Multi-Variant Spaceplanes (hangar_emerge -> taxi -> runway_takeoff -> approach -> drogue chute -> taxi_to_hangar)
    this._updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h);

    // 8. Foreground Hangar Arch Occlusion Layer (craft glide naturally BEHIND & INSIDE the arched hangar!)
    this._drawArchedHangarOcclusionRoof(ctx, L, pal);

    // 9. Exhaust Smoke & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 10. Probabilistic Rolling Dawn Fog (morning mode)
    this._updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now);
  },

  _updateAndDrawBoats(ctx, w, h, pal, dt) {
    ctx.save();
    for (let i = 0; i < this.boats.length; i++) {
      const b = this.boats[i];
      b.x += b.vx * (dt * 60);
      if (b.x > w * 0.62) b.vx = -Math.abs(b.vx);
      if (b.x < w * 0.08) b.vx = Math.abs(b.vx);
      // Tiny wake V behind vessel
      ctx.strokeStyle = pal.isNightLights ? "rgba(186, 230, 253, 0.16)" : "rgba(255, 255, 255, 0.26)";
      ctx.lineWidth = 0.8;
      const dir = b.vx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - dir * 16, b.y - 3);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - dir * 16, b.y + 3);
      ctx.stroke();
      ctx.fillStyle = pal.archLight;
      ctx.fillRect(b.x - 2, b.y - 1, 4, 2);
    }
    ctx.restore();
  },

  _drawComplexLights(ctx, L, pal, step) {
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.4);
    const beaconA = pal.isNightLights ? (0.48 + 0.52 * pulse) : (0.16 + 0.22 * pulse);

    ctx.save();
    // Aviation red obstruction beacons on Twin Towers, Star Terminal Spire & ATC Tower
    const beacons = [
      { x: L.towerLeftX, y: L.padY - L.towerH - 14 },
      { x: L.towerRightX, y: L.padY - L.towerH - 14 },
      { x: L.termX, y: L.termY - 96 * L.termScale },
      { x: L.atcX, y: L.atcY - 68 }
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
      // Sequential runway edge & approach lights
      const rabbit = Math.floor(step * 11) % 12;
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const pt = L.rwPt(t);
        const hw = 11 + t * 21;
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
    // Quadratic Bezier crawlerway from Arched Hangar bay (t=0) -> Launch Pad (t=1)
    const p0x = L.hangarDoorX;
    const p0y = L.hangarDoorY;
    const cx = w * 0.48;
    const cy = L.padY + 6;
    const p2x = L.padX;
    const p2y = L.padY;
    const inv = 1 - t;
    return {
      x: inv * inv * p0x + 2 * inv * t * cx + t * t * p2x,
      y: inv * inv * p0y + 2 * inv * t * cy + t * t * p2y
    };
  },

  _updateAndDrawRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.rocket;
    r.t += dt;

    const rocketH = Math.min(76, L.towerH * 0.44);
    const rocketW = Math.max(6.5, rocketH * 0.145);
    const padBaseY = L.padY - 2;
    const catchY = L.padY - L.towerH * 0.54;

    let visible = true;
    let drawFlame = false;
    let flameScale = 0;
    let isTransporter = false;
    let isBoosterOnly = false;
    let armY = padBaseY - rocketH * 0.72;
    let targetArmClose = 0;

    if (r.phase === "tow_out") {
      // Towed horizontally from inside Arched Hangar -> Launch Pad
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, ease);
      r.x = pos.x;
      r.y = pos.y;
      r.angle = -Math.PI * 0.5;
      isTransporter = true;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "erect";
        r.t = 0;
        r.phaseDuration = 5.2;
      }
    } else if (r.phase === "erect") {
      // Smoothly erected from horizontal (-PI/2) -> vertical (0) between the twin towers!
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = -Math.PI * 0.5 * (1 - ease);
      isTransporter = p < 0.85;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "arm_swing";
        r.t = 0;
        r.phaseDuration = 6.2;
      }
    } else if (r.phase === "arm_swing") {
      // Loading/umbilical arms swing inward to fuel & load, cryo vapour vents, then arms retract right before launch!
      const p = Math.min(1, r.t / r.phaseDuration);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = 0;
      targetArmClose = p < 0.75 ? 1.0 : 0.0;
      // Cryo LOX/CH4 venting plumes during fuelling
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
        r.phaseDuration = 12.0;
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

      // Glowing launch flame reflection shimmer across the coastal water
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
        r.phaseDuration = 6.5;
      }
    } else if (r.phase === "coast_wait") {
      visible = false;
      targetArmClose = 0;
      armY = catchY;
      if (r.t >= r.phaseDuration) {
        r.phase = "descent";
        r.t = 0;
        r.phaseDuration = 8.4;
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
        r.phaseDuration = 4.6;
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
        r.phaseDuration = 4.6;
      }
    } else if (r.phase === "lower_horizontal") {
      // Reverse of erect: tilts smoothly back horizontal onto the crawler transporter!
      isBoosterOnly = true;
      isTransporter = true;
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      r.x = L.padX;
      r.y = padBaseY;
      r.angle = -Math.PI * 0.5 * ease;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_back";
        r.t = 0;
        r.phaseDuration = 7.2;
      }
    } else {
      // Towed slowly back along crawlerway straight INSIDE the Arched Hangar bay (zero despawn!)
      isBoosterOnly = true;
      isTransporter = true;
      const p = Math.min(1, r.t / r.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      const pos = this._crawlerPos(L, w, 1 - ease);
      r.x = pos.x;
      r.y = pos.y;
      r.angle = -Math.PI * 0.5;
      targetArmClose = 0;
      if (r.t >= r.phaseDuration) {
        r.phase = "tow_out";
        r.t = 0;
        r.phaseDuration = 7.4;
      }
    }

    r.armClose += (targetArmClose - r.armClose) * Math.min(1, dt * 5.2);

    // Draw Crawler Transporter Chassis underneath rocket during tow/erect
    if (visible && isTransporter) {
      ctx.save();
      ctx.translate(r.x, r.y + 2);
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-14, -2, 28, 5);
      // Blinking amber escort beacon on crawler
      if (Math.sin(step * 10) > 0) {
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(13, -3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Rocket / Booster Stack (with crisp 2.5D cylindrical shading!)
    if (visible) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

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
      // Cylindrical 2.5D shaded hull gradient (sunlit left, metallic right)
      const hullG = ctx.createLinearGradient(-rocketW * 0.5, 0, rocketW * 0.5, 0);
      hullG.addColorStop(0, pal.bodyLight);
      hullG.addColorStop(0.62, pal.bodyLight);
      hullG.addColorStop(1, pal.bodyShade);
      ctx.fillStyle = hullG;
      ctx.fillRect(-rocketW * 0.5, -bodyH, rocketW, bodyH);

      if (!isBoosterOnly) {
        // Upper spacecraft ogive nosecone + black TPS thermal tile flank
        ctx.fillStyle = hullG;
        ctx.beginPath();
        ctx.moveTo(-rocketW * 0.5, -bodyH);
        ctx.quadraticCurveTo(0, -bodyH - rocketW * 1.7, rocketW * 0.5, -bodyH);
        ctx.closePath();
        ctx.fill();
        // Forward aero flaps
        ctx.fillStyle = pal.archDark;
        ctx.fillRect(-rocketW * 0.82, -bodyH + 4, rocketW * 0.32, 6);
        ctx.fillRect(rocketW * 0.5, -bodyH + 4, rocketW * 0.32, 6);
      } else {
        // Booster grid fins
        ctx.fillStyle = pal.towerSteel;
        ctx.fillRect(-rocketW * 0.95, -bodyH + 3, rocketW * 1.9, 2.4);
      }

      // Interstage ring & engine skirt
      ctx.fillStyle = pal.archDark;
      ctx.fillRect(-rocketW * 0.52, -bodyH * 0.56, rocketW * 1.04, 2.2);
      ctx.fillRect(-rocketW * 0.56, -4, rocketW * 1.12, 4);
      ctx.restore();
    }

    // Draw Twin Tower Loading / Catch Chopstick Arms swinging inward from both towers!
    ctx.save();
    const reach = (L.towerRightX - L.towerLeftX) * 0.42;
    const extend = 0.22 + r.armClose * 0.78;
    ctx.strokeStyle = pal.isNightLights ? "#94A3B8" : pal.towerSteel;
    ctx.lineWidth = 2.1;
    ctx.lineCap = "round";
    // Left tower arm reaching right
    ctx.beginPath();
    ctx.moveTo(L.towerLeftX + L.towerW * 0.45, armY);
    ctx.lineTo(L.towerLeftX + L.towerW * 0.45 + reach * extend, armY + (1 - r.armClose) * 5);
    // Right tower arm reaching left
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

  _drawSpaceplaneModel(ctx, variant, pal, step, afterburner = 0) {
    // Glowing afterburner / rocket thruster plume during runway takeoff!
    if (afterburner > 0.05) {
      const fl = (16 + Math.sin(step * 45) * 4) * afterburner;
      const g = ctx.createLinearGradient(-13, 0, -13 - fl, 0);
      g.addColorStop(0, "rgba(255, 252, 240, 0.95)");
      g.addColorStop(0.45, "rgba(56, 189, 248, 0.78)");
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-12, -2.6);
      ctx.lineTo(-13 - fl, 0);
      ctx.lineTo(-12, 2.6);
      ctx.closePath();
      ctx.fill();
    }

    if (variant === "airliner") {
      // Variant 2: Sleek Hypersonic Space Airliner (elongated needle fuselage, swept gull wings, twin nacelles, cabin windows)
      // Swept main wings
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-4, -12.5);
      ctx.lineTo(-8.5, -12.5);
      ctx.lineTo(-6.5, -2.5);
      ctx.lineTo(-6.5, 2.5);
      ctx.lineTo(-8.5, 12.5);
      ctx.lineTo(-4, 12.5);
      ctx.closePath();
      ctx.fill();

      // Twin wingtip SABRE engine nacelles
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-9.5, -13.5, 7, 2.1);
      ctx.fillRect(-9.5, 11.4, 7, 2.1);

      // Elongated slender fuselage (2.5D top highlight + shadowed lower flank)
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.quadraticCurveTo(10, -3.2, -13, -2.2);
      ctx.lineTo(-15, 0);
      ctx.lineTo(-13, 2.2);
      ctx.quadraticCurveTo(10, 3.2, 19, 0);
      ctx.closePath();
      ctx.fill();

      // Shaded lower belly & tail stabiliser
      ctx.fillStyle = pal.bodyShade;
      ctx.beginPath();
      ctx.moveTo(18, 0.4);
      ctx.quadraticCurveTo(8, 3.0, -13, 2.2);
      ctx.lineTo(-13, 0.4);
      ctx.closePath();
      ctx.fill();

      // Glowing passenger cabin window strip + cockpit visor
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(10, -1.1, 3.2, 1.4);
      ctx.fillRect(-2, -0.9, 9, 1.1);
    } else if (variant === "clipper") {
      // Variant 3: Blended Lifting-Body Orbital Clipper (sculpted wide hull + twin canted wingtip fins)
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.quadraticCurveTo(8, -6.5, -5, -10.5);
      ctx.lineTo(-12, -9.5);
      ctx.lineTo(-10, -3.5);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-10, 3.5);
      ctx.lineTo(-12, 9.5);
      ctx.lineTo(-5, 10.5);
      ctx.quadraticCurveTo(8, 6.5, 15, 0);
      ctx.closePath();
      ctx.fill();

      // Thermal underside & rear engine bay shroud
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.quadraticCurveTo(6, 5.5, -11, 9.2);
      ctx.lineTo(-10, 3.5);
      ctx.lineTo(-11, -3.5);
      ctx.closePath();
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Twin canted wingtip vertical stabilisers
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-12.5, -11.2, 6, 1.8);
      ctx.fillRect(-12.5, 9.4, 6, 1.8);

      // Sleek wrap-around cockpit canopy
      ctx.fillStyle = pal.windowGlow;
      ctx.beginPath();
      ctx.ellipse(8.5, 0, 3.2, 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Variant 1: Classic Space-Shuttle Orbiter (double-delta wings, black TPS edges, dorsal payload seam, tall tail fin!)
      // Black thermal-tile wing leading edges
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(4, -4.4);
      ctx.lineTo(-8, -11.8);
      ctx.lineTo(-11.5, -11.0);
      ctx.lineTo(-11.5, 11.0);
      ctx.lineTo(-8, 11.8);
      ctx.lineTo(4, 4.4);
      ctx.closePath();
      ctx.fill();

      // White ceramic double-delta upper wings
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(11.5, 0);
      ctx.lineTo(3.5, -3.5);
      ctx.lineTo(-7.5, -10.4);
      ctx.lineTo(-10.5, -9.6);
      ctx.lineTo(-10.5, 9.6);
      ctx.lineTo(-7.5, 10.4);
      ctx.lineTo(3.5, 3.5);
      ctx.closePath();
      ctx.fill();

      // Thick rounded orbiter fuselage + twin OMS rear pods
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.roundRect(-11.5, -3.4, 24, 6.8, 3.4);
      ctx.fill();
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(-11.5, 0.8, 22, 2.4);

      // Dorsal payload bay doors seam
      ctx.strokeStyle = pal.bodyShade;
      ctx.lineWidth = 0.7;
      ctx.strokeRect(-6.5, -2.0, 12.5, 4.0);

      // Prominent vertical tail fin (2.5D offset slightly upward)
      ctx.fillStyle = pal.bodyLight;
      ctx.beginPath();
      ctx.moveTo(-6, -1.2);
      ctx.lineTo(-13.5, -7.2);
      ctx.lineTo(-14.5, -5.8);
      ctx.lineTo(-11.5, -0.6);
      ctx.closePath();
      ctx.fill();

      // Black nosecone cap + cockpit windscreen windows
      ctx.fillStyle = pal.archDark;
      ctx.beginPath();
      ctx.arc(12.2, 0, 2.2, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
      ctx.fillStyle = pal.windowGlow;
      ctx.fillRect(7.4, -1.7, 2.2, 3.4);
    }

    // Blinking wingtip navigation strobes
    if (Math.sin(step * 12) > 0.25) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-8.5, -10.8, 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-8.5, 10.8, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _updateAndDrawSpaceplane(ctx, L, pal, dt, step, w, h) {
    const sp = this.spaceplane;
    sp.t += dt;

    let visible = false;
    let x = 0;
    let y = 0;
    let scale = 1;
    let heading = 0;
    let showChute = false;
    let chuteInflation = 0;
    let afterburner = 0;

    const entryPt = L.rwPt(L.rwEntryT);
    const exitPt = L.rwPt(L.rwExitT);
    const rwAngle = Math.atan2(L.rwRightY - L.rwLeftY, L.rwRightX - L.rwLeftX);

    if (sp.phase === "hangar_emerge") {
      // Emerges smoothly from INSIDE the arched Hangar bay (clipped naturally behind hangar roof!)
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const ease = p * p * (3 - 2 * p);
      x = L.hangarX + 20 + (L.hangarDoorX - 18 - (L.hangarX + 20)) * ease;
      y = L.hangarDoorY - 4 + 8 * ease;
      heading = Math.PI - 0.14;
      scale = 0.84;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "taxi_to_runway";
        sp.t = 0;
        sp.phaseDuration = 6.2;
      }
    } else if (sp.phase === "taxi_to_runway") {
      // Taxis smoothly past the Star Terminal onto the main diagonal runway entry!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0x = L.hangarDoorX - 18;
      const p0y = L.hangarDoorY + 4;
      const cx = L.termX + 10;
      const cy = L.termY + 34;
      const p2x = entryPt.x;
      const p2y = entryPt.y;
      const inv = 1 - s;
      x = inv * inv * p0x + 2 * inv * s * cx + s * s * p2x;
      y = inv * inv * p0y + 2 * inv * s * cy + s * s * p2y;
      const dx = 2 * inv * (cx - p0x) + 2 * s * (p2x - cx);
      const dy = 2 * inv * (cy - p0y) + 2 * s * (p2y - cy);
      heading = Math.atan2(dy, dx);
      scale = 0.84 + s * 0.16;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "runway_takeoff";
        sp.t = 0;
        sp.phaseDuration = 7.4;
      }
    } else if (sp.phase === "runway_takeoff") {
      // Accelerates down the diagonal runway, rotates nose-up, and climbs steeply into the upper-right sky!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      afterburner = p < 0.88 ? 1.0 : ((1 - p) * 8);
      if (p < 0.48) {
        // Ground roll accelerating along runway
        const gp = p / 0.48;
        const accel = gp * gp;
        const rwT = L.rwEntryT + (0.76 - L.rwEntryT) * accel;
        const pt = L.rwPt(rwT);
        x = pt.x;
        y = pt.y;
        heading = rwAngle - Math.max(0, gp - 0.78) * 1.1;
        scale = 1.0 + accel * 0.14;
      } else {
        // Steep orbital climb into upper-right sky leaving twin shimmering contrails!
        const cp = (p - 0.48) / 0.52;
        const liftPt = L.rwPt(0.76);
        const endX = w + 70;
        const endY = h * 0.08;
        x = liftPt.x + (endX - liftPt.x) * cp;
        y = liftPt.y + (endY - liftPt.y) * Math.pow(cp, 1.32);
        heading = Math.atan2((endY - liftPt.y) * 1.32 * Math.pow(Math.max(0.05, cp), 0.32), endX - liftPt.x);
        scale = Math.max(0.45, 1.14 - cp * 0.65);

        if (Math.random() < 0.78) {
          this.plumeParticles.push({
            x: x - Math.cos(heading) * 14 * scale,
            y: y - Math.sin(heading) * 14 * scale,
            vx: -Math.cos(heading) * 0.25,
            vy: 0.08,
            r: 2.2 + Math.random() * 2.2,
            grow: 0.09,
            hot: false,
            life: 0,
            maxLife: 115
          });
        }
      }
      if (sp.t >= sp.phaseDuration) {
        // Advance to next distinct spaceplane variant for the upcoming landing!
        this.spVariantIdx = (this.spVariantIdx + 1) % this.SPACEPLANE_VARIANTS.length;
        sp.variant = this.SPACEPLANE_VARIANTS[this.spVariantIdx];
        sp.phase = "sky_wait";
        sp.t = 0;
        sp.phaseDuration = 4.2;
      }
    } else if (sp.phase === "sky_wait") {
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "approach";
        sp.t = 0;
        sp.phaseDuration = 5.2;
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      // Arriving spaceplane descending smoothly onto left runway threshold!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const startX = -70;
      const startY = L.horizonY - 55;
      const tdPt = L.rwPt(0.14);
      x = startX + (tdPt.x - startX) * p;
      y = startY + (tdPt.y - startY) * (1 - Math.pow(1 - p, 1.45));
      scale = 0.56 + p * 0.38;
      heading = Math.atan2(tdPt.y - startY, tdPt.x - startX) * (1 - p * 0.25);

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
        sp.phaseDuration = 6.2;
      }
    } else if (sp.phase === "chute_rollout") {
      // Touchdown rollout with billowing conical drogue chute!
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const decel = 1 - Math.pow(1 - p, 2.25);
      const rwT = 0.14 + (L.rwExitT - 0.14) * decel;
      const pt = L.rwPt(rwT);
      x = pt.x;
      y = pt.y;
      scale = 0.94 + (rwT - 0.14) * 0.28;
      heading = rwAngle;

      if (p < 0.80) {
        showChute = true;
        chuteInflation = p < 0.14 ? (p / 0.14) : (0.94 + Math.sin(step * 18) * 0.06);
      } else if (!sp.chuteDetached) {
        sp.chuteDetached = true;
        sp.detachedChuteX = x - Math.cos(heading) * 26 * scale;
        sp.detachedChuteY = y - Math.sin(heading) * 26 * scale;
        sp.detachedChuteAlpha = 0.85;
      }

      if (sp.t >= sp.phaseDuration) {
        sp.phase = "taxi_to_hangar";
        sp.t = 0;
        sp.phaseDuration = 7.4;
      }
    } else if (sp.phase === "taxi_to_hangar") {
      // Slowly taxis off runway, past the Star Terminal, and right INSIDE the Arched Hangar bay (occluded cleanly!)
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const s = p * p * (3 - 2 * p);
      const p0x = exitPt.x;
      const p0y = exitPt.y;
      const cx = L.termX + 85;
      const cy = L.termY + 42;
      const p2x = L.hangarX + 22; // deep inside hangar bay behind roof occlusion!
      const p2y = L.hangarDoorY - 5;
      const inv = 1 - s;
      x = inv * inv * p0x + 2 * inv * s * cx + s * s * p2x;
      y = inv * inv * p0y + 2 * inv * s * cy + s * s * p2y;
      const dx = 2 * inv * (cx - p0x) + 2 * s * (p2x - cx);
      const dy = 2 * inv * (cy - p0y) + 2 * s * (p2y - cy);
      heading = Math.atan2(dy, dx);
      scale = 1.08 - s * 0.26;

      if (sp.t >= sp.phaseDuration) {
        this.spVariantIdx = (this.spVariantIdx + 1) % this.SPACEPLANE_VARIANTS.length;
        sp.variant = this.SPACEPLANE_VARIANTS[this.spVariantIdx];
        sp.phase = "hangar_rest";
        sp.t = 0;
        sp.phaseDuration = 4.5;
      }
    } else {
      // Resting hidden inside hangar bay before next variant emerges
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "hangar_emerge";
        sp.t = 0;
        sp.phaseDuration = 3.4;
      }
    }

    // Fading detached drogue chute on runway
    if (sp.chuteDetached && sp.detachedChuteAlpha > 0.01) {
      sp.detachedChuteAlpha = Math.max(0, sp.detachedChuteAlpha - dt * 0.6);
      ctx.save();
      ctx.globalAlpha = sp.detachedChuteAlpha;
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.ellipse(sp.detachedChuteX, sp.detachedChuteY + 3, 7, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!visible) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(scale, scale);

    // Billowing multi-panel drogue chute + shroud lines
    if (showChute && chuteInflation > 0.05) {
      const tetherLen = 15 + chuteInflation * 15;
      const chuteR = 7.2 * chuteInflation;
      const tailX = -12;
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

    // Forward landing/taxi headlight beam
    const beamA = pal.isNightLights ? 0.38 : 0.14;
    const beamG = ctx.createLinearGradient(14, 0, 58, 0);
    beamG.addColorStop(0, `rgba(255, 251, 235, ${beamA})`);
    beamG.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = beamG;
    ctx.beginPath();
    ctx.moveTo(14, -1.5);
    ctx.lineTo(58, -11);
    ctx.lineTo(58, 11);
    ctx.lineTo(14, 1.5);
    ctx.closePath();
    ctx.fill();

    // Render selected detailed multi-part Spaceplane variant!
    this._drawSpaceplaneModel(ctx, sp.variant, pal, step, afterburner);

    ctx.restore();
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
