/**
 * PETTR World Renderer: Space — "Gateway"
 * Wide quasi-3D orbital launch complex with:
 * - Vehicle Assembly Building (VAB), cryo tank farm, sleek terminal & angled perspective runway
 * - Twin launch pads & Mechazilla-style catch tower with animated chopstick arms
 * - Regular heavy-lift rocket launches (diurnal-lit exhaust trails) & returning booster tower catches
 * - Regular spaceplane landings deploying a billowing drogue chute before taxiing to the terminal
 * - Diurnal lighting (terminal windows, pad floodlights, tower beacons & runway strobes at dusk/night)
 * - Probabilistic rolling dawn fog in morning mode
 * - Offscreen static layer caching for minimal battery & GPU overhead
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
  fogState: { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 },
  orbiters: [],
  _lastW: 0,
  _lastH: 0,
  _lastMode: "",

  reset() {
    this.cacheKey = "";
    this.plumeParticles = [];
    this.ventParticles = [];
    this.rocket = null;
    this.spaceplane = null;
    this.stars = [];
    this.clouds = [];
    this.orbiters = [];
    this.fogState = { active: false, alpha: 0, targetAlpha: 0, nextCheck: 0, offset: 0 };
  },

  getPalette(mode) {
    if (mode === "morning") {
      return {
        isNightLights: false,
        lightIntensity: 0.32,
        skyTop: "#E8EFF8",
        skyMid: "#FBE5D8",
        skyHorizon: "#FCD5B5",
        groundNear: "#D7CCC8",
        groundFar: "#E6D7CF",
        waterTint: "rgba(251, 191, 146, 0.28)",
        buildingFar: "#B8AAB0",
        buildingMid: "#8D828C",
        buildingNear: "#645D68",
        towerStroke: "#524C57",
        runwayFill: "#5C5863",
        runwayEdge: "rgba(255, 245, 235, 0.45)",
        windowGlow: "rgba(254, 240, 199, 0.45)",
        plumeCore: "255, 246, 224",
        plumeMid: "251, 176, 98",
        smokeRgb: "248, 224, 210",
        smokeAlpha: 0.42,
        chuteColor: "#E05A47",
        chuteStripe: "#FFF3E0",
        bodyLight: "#F8FAFC",
        bodyShade: "#94A3B8"
      };
    }
    if (mode === "evening") {
      return {
        isNightLights: true,
        lightIntensity: 0.88,
        skyTop: "#131728",
        skyMid: "#3B263B",
        skyHorizon: "#C96A3B",
        groundNear: "#1E1A22",
        groundFar: "#2B222A",
        waterTint: "rgba(245, 158, 11, 0.18)",
        buildingFar: "#2E2533",
        buildingMid: "#221D29",
        buildingNear: "#18151F",
        towerStroke: "#3B3345",
        runwayFill: "#1A1822",
        runwayEdge: "rgba(251, 191, 36, 0.45)",
        windowGlow: "rgba(254, 215, 130, 0.82)",
        plumeCore: "255, 248, 220",
        plumeMid: "249, 115, 22",
        smokeRgb: "235, 156, 112",
        smokeAlpha: 0.36,
        chuteColor: "#F97316",
        chuteStripe: "#FEF3C7",
        bodyLight: "#E2E8F0",
        bodyShade: "#475569"
      };
    }
    if (mode === "dark") {
      return {
        isNightLights: true,
        lightIntensity: 1.0,
        skyTop: "#05070E",
        skyMid: "#0B1121",
        skyHorizon: "#162038",
        groundNear: "#0B0E17",
        groundFar: "#111829",
        waterTint: "rgba(56, 189, 248, 0.10)",
        buildingFar: "#151D30",
        buildingMid: "#111726",
        buildingNear: "#0C101B",
        towerStroke: "#2A3652",
        runwayFill: "#0D121E",
        runwayEdge: "rgba(56, 189, 248, 0.45)",
        windowGlow: "rgba(186, 230, 253, 0.85)",
        plumeCore: "255, 252, 240",
        plumeMid: "251, 146, 60",
        smokeRgb: "148, 163, 184",
        smokeAlpha: 0.30,
        chuteColor: "#FB923C",
        chuteStripe: "#F8FAFC",
        bodyLight: "#CBD5E1",
        bodyShade: "#334155"
      };
    }
    // Afternoon / Light — crisp high-altitude daylight spaceport
    return {
      isNightLights: false,
      lightIntensity: 0.08,
      skyTop: "#DCEBFA",
      skyMid: "#EDF4FC",
      skyHorizon: "#F7FAFE",
      groundNear: "#D4DCE6",
      groundFar: "#E2E8F0",
      waterTint: "rgba(147, 197, 253, 0.25)",
      buildingFar: "#B6C4D6",
      buildingMid: "#8D9EB3",
      buildingNear: "#64748B",
      towerStroke: "#475569",
      runwayFill: "#64748B",
      runwayEdge: "rgba(255, 255, 255, 0.58)",
      windowGlow: "rgba(224, 242, 254, 0.55)",
      plumeCore: "255, 255, 255",
      plumeMid: "251, 191, 36",
      smokeRgb: "241, 245, 249",
      smokeAlpha: 0.52,
      chuteColor: "#EF4444",
      chuteStripe: "#FFFFFF",
      bodyLight: "#FFFFFF",
      bodyShade: "#94A3B8"
    };
  },

  getLayout(w, h) {
    const isNarrow = w < 720;
    const horizonY = h * (isNarrow ? 0.72 : 0.67);
    const groundH = h - horizonY;

    // Launch Pad & Mechazilla Catch Tower on right-midground
    const towerX = w * (isNarrow ? 0.80 : 0.82);
    const padY = horizonY + groundH * 0.22;
    const towerH = Math.min(230, Math.max(125, h * 0.26));
    const towerW = Math.max(18, towerH * 0.13);

    // Secondary distant Pad B
    const padBX = w * (isNarrow ? 0.92 : 0.91);
    const padBY = horizonY + groundH * 0.10;
    const towerBH = towerH * 0.68;

    // Vehicle Assembly Building (VAB) far mid-right
    const vabX = w * 0.64;
    const vabY = horizonY + groundH * 0.04;
    const vabW = Math.min(92, w * 0.085);
    const vabH = Math.min(115, h * 0.135);

    // Spaceport Terminal on left-midground
    const termX = w * (isNarrow ? 0.06 : 0.09);
    const termY = horizonY + groundH * 0.26;
    const termW = Math.min(220, w * (isNarrow ? 0.34 : 0.19));
    const termH = Math.min(52, h * 0.062);

    // Perspective Runway sweeping from far-mid-left to foreground-centre-right
    const rwFarX = w * 0.39;
    const rwFarY = horizonY + groundH * 0.06;
    const rwNearX = w * 0.56;
    const rwNearY = h + 14;
    const rwFarHalfW = Math.max(10, w * 0.011);
    const rwNearHalfW = Math.max(54, w * (isNarrow ? 0.14 : 0.085));

    // Taxiway junction from runway to terminal gate
    const taxiRunwayT = 0.58;
    const taxiStartX = rwFarX + (rwNearX - rwFarX) * taxiRunwayT;
    const taxiStartY = rwFarY + (rwNearY - rwFarY) * taxiRunwayT;
    const gateX = termX + termW * 0.72;
    const gateY = termY + termH * 0.95;

    return {
      isNarrow, horizonY, groundH,
      towerX, padY, towerH, towerW,
      padBX, padBY, towerBH,
      vabX, vabY, vabW, vabH,
      termX, termY, termW, termH,
      rwFarX, rwFarY, rwNearX, rwNearY, rwFarHalfW, rwNearHalfW,
      taxiStartX, taxiStartY, gateX, gateY
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

    // 1. Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, L.horizonY);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(0.58, pal.skyMid);
    skyGrad.addColorStop(1, pal.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, L.horizonY + 2);

    // 2. Subtle horizon atmospheric glow / coastal ocean strip
    if (mode === "morning" || mode === "evening") {
      const sunX = mode === "morning" ? w * 0.74 : w * 0.28;
      const sunY = L.horizonY - 22;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, Math.min(w * 0.42, 380));
      if (mode === "morning") {
        sunGlow.addColorStop(0, "rgba(254, 243, 199, 0.72)");
        sunGlow.addColorStop(0.35, "rgba(251, 146, 60, 0.25)");
        sunGlow.addColorStop(1, "rgba(251, 146, 60, 0)");
      } else {
        sunGlow.addColorStop(0, "rgba(254, 215, 170, 0.65)");
        sunGlow.addColorStop(0.35, "rgba(249, 115, 22, 0.26)");
        sunGlow.addColorStop(1, "rgba(249, 115, 22, 0)");
      }
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, w, L.horizonY + 30);
    }

    // 3. Distant coastal ridge silhouettes
    ctx.beginPath();
    ctx.moveTo(0, L.horizonY);
    for (let x = 0; x <= w + 40; x += 40) {
      const ridge = Math.sin(x * 0.0045 + 0.8) * 14 + Math.cos(x * 0.011) * 7;
      ctx.lineTo(x, L.horizonY - 8 - Math.max(0, ridge));
    }
    ctx.lineTo(w, L.horizonY + 2);
    ctx.closePath();
    ctx.fillStyle = pal.buildingFar;
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;

    // 4. Quasi-3D Spaceport Apron Ground Plane
    const groundGrad = ctx.createLinearGradient(0, L.horizonY, 0, h);
    groundGrad.addColorStop(0, pal.groundFar);
    groundGrad.addColorStop(1, pal.groundNear);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, L.horizonY, w, h - L.horizonY);

    // Subtle horizon water/coastal band right below horizon line
    ctx.fillStyle = pal.waterTint;
    ctx.fillRect(0, L.horizonY, w, Math.max(10, L.groundH * 0.09));

    // Subtle quasi-3D ground perspective grid lines converging to horizon
    ctx.save();
    ctx.strokeStyle = pal.isNightLights ? "rgba(148, 163, 184, 0.07)" : "rgba(51, 65, 85, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const t = Math.pow(i / 5, 1.75);
      const y = L.horizonY + t * L.groundH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const vpX = w * 0.44;
    for (let r = -6; r <= 6; r++) {
      ctx.beginPath();
      ctx.moveTo(vpX + r * (w * 0.055), L.horizonY);
      ctx.lineTo(vpX + r * (w * 0.23), h);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Perspective Runway & Taxiway Connector
    ctx.save();
    // Taxiway asphalt curve to terminal
    ctx.beginPath();
    ctx.moveTo(L.taxiStartX - 18, L.taxiStartY - 8);
    ctx.quadraticCurveTo(L.gateX + 55, L.taxiStartY - 6, L.gateX - 16, L.gateY - 5);
    ctx.lineTo(L.gateX - 16, L.gateY + 13);
    ctx.quadraticCurveTo(L.gateX + 55, L.taxiStartY + 14, L.taxiStartX - 24, L.taxiStartY + 14);
    ctx.closePath();
    ctx.fillStyle = pal.runwayFill;
    ctx.globalAlpha = 0.82;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Taxiway yellow/amber centreline
    ctx.beginPath();
    ctx.moveTo(L.taxiStartX - 10, L.taxiStartY + 2);
    ctx.quadraticCurveTo(L.gateX + 52, L.taxiStartY + 4, L.gateX, L.gateY + 4);
    ctx.strokeStyle = pal.isNightLights ? "rgba(251, 191, 36, 0.48)" : "rgba(245, 158, 11, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Main angled perspective runway trapezoid
    ctx.beginPath();
    ctx.moveTo(L.rwFarX - L.rwFarHalfW, L.rwFarY);
    ctx.lineTo(L.rwFarX + L.rwFarHalfW, L.rwFarY);
    ctx.lineTo(L.rwNearX + L.rwNearHalfW, L.rwNearY);
    ctx.lineTo(L.rwNearX - L.rwNearHalfW, L.rwNearY);
    ctx.closePath();
    ctx.fillStyle = pal.runwayFill;
    ctx.fill();

    // Crisp runway side stripes
    ctx.strokeStyle = pal.runwayEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(L.rwFarX - L.rwFarHalfW + 1.5, L.rwFarY);
    ctx.lineTo(L.rwNearX - L.rwNearHalfW + 5, L.rwNearY);
    ctx.moveTo(L.rwFarX + L.rwFarHalfW - 1.5, L.rwFarY);
    ctx.lineTo(L.rwNearX + L.rwNearHalfW - 5, L.rwNearY);
    ctx.stroke();

    // Perspective-foreshortened centreline dashes
    ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.42)" : "rgba(255, 255, 255, 0.72)";
    for (let s = 0; s < 10; s++) {
      const t0 = Math.pow(s / 10, 1.45);
      const t1 = Math.pow((s + 0.48) / 10, 1.45);
      const x0 = L.rwFarX + (L.rwNearX - L.rwFarX) * t0;
      const y0 = L.rwFarY + (L.rwNearY - L.rwFarY) * t0;
      const x1 = L.rwFarX + (L.rwNearX - L.rwFarX) * t1;
      const y1 = L.rwFarY + (L.rwNearY - L.rwFarY) * t1;
      ctx.lineWidth = 1 + t0 * 2.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();

    // 6. Far Background Infrastructure: VAB, Control Dome & Cryo Propellant Spheres
    // VAB (Vehicle Assembly Building) with quasi-3D side wall
    const vabTop = L.vabY - L.vabH;
    ctx.fillStyle = pal.buildingMid;
    ctx.fillRect(L.vabX, vabTop, L.vabW * 0.72, L.vabH);
    ctx.fillStyle = pal.buildingFar;
    ctx.beginPath();
    ctx.moveTo(L.vabX + L.vabW * 0.72, vabTop);
    ctx.lineTo(L.vabX + L.vabW, vabTop + 7);
    ctx.lineTo(L.vabX + L.vabW, L.vabY - 3);
    ctx.lineTo(L.vabX + L.vabW * 0.72, L.vabY);
    ctx.closePath();
    ctx.fill();
    // VAB vertical hangar door bay line
    ctx.fillStyle = pal.buildingNear;
    ctx.fillRect(L.vabX + L.vabW * 0.24, vabTop + L.vabH * 0.16, L.vabW * 0.22, L.vabH * 0.84);

    // Cryo Propellant Tank Farm (spheres between VAB and Launch Pad)
    const tankBaseX = L.vabX + L.vabW + 20;
    const tankBaseY = L.horizonY + L.groundH * 0.11;
    for (let k = 0; k < 3; k++) {
      const tx = tankBaseX + k * 19;
      const tr = 7.5 - k * 0.6;
      ctx.fillStyle = pal.bodyLight;
      ctx.globalAlpha = pal.isNightLights ? 0.34 : 0.78;
      ctx.beginPath();
      ctx.arc(tx, tankBaseY - tr - 3, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.towerStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - tr * 0.55, tankBaseY - 4);
      ctx.lineTo(tx - tr * 0.55, tankBaseY + 2);
      ctx.moveTo(tx + tr * 0.55, tankBaseY - 4);
      ctx.lineTo(tx + tr * 0.55, tankBaseY + 2);
      ctx.stroke();
    }

    // Distant Launch Control Dome left of runway
    const domeX = w * 0.28;
    const domeY = L.horizonY + L.groundH * 0.08;
    ctx.fillStyle = pal.buildingMid;
    ctx.beginPath();
    ctx.arc(domeX, domeY, 18, Math.PI, 0);
    ctx.lineTo(domeX + 26, domeY + 6);
    ctx.lineTo(domeX - 26, domeY + 6);
    ctx.closePath();
    ctx.fill();

    // 7. Midground Spaceport Terminal (Left) with quasi-3D canted roof & concourse windows
    ctx.save();
    ctx.fillStyle = pal.buildingNear;
    ctx.beginPath();
    ctx.moveTo(L.termX, L.termY + L.termH);
    ctx.lineTo(L.termX, L.termY + 8);
    ctx.lineTo(L.termX + L.termW * 0.12, L.termY);
    ctx.lineTo(L.termX + L.termW, L.termY + 5);
    ctx.lineTo(L.termX + L.termW * 0.94, L.termY + L.termH);
    ctx.closePath();
    ctx.fill();

    // Terminal roof overhang highlight
    ctx.strokeStyle = pal.isNightLights ? "rgba(148, 163, 184, 0.35)" : "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L.termX - 6, L.termY + 9);
    ctx.lineTo(L.termX + L.termW * 0.12, L.termY - 1);
    ctx.lineTo(L.termX + L.termW + 8, L.termY + 5);
    ctx.stroke();

    // Terminal ATC control tower spire
    const atcX = L.termX + L.termW * 0.22;
    const atcTopY = L.termY - 36;
    ctx.fillStyle = pal.buildingMid;
    ctx.fillRect(atcX - 4, atcTopY + 12, 8, 26);
    ctx.beginPath();
    ctx.moveTo(atcX - 11, atcTopY + 12);
    ctx.lineTo(atcX - 14, atcTopY + 2);
    ctx.lineTo(atcX + 14, atcTopY + 2);
    ctx.lineTo(atcX + 11, atcTopY + 12);
    ctx.closePath();
    ctx.fill();

    // Terminal concourse windows (glow warmly at night / reflect softly by day)
    const winCount = 8;
    const winStart = L.termX + 14;
    const winSpan = L.termW - 34;
    const winW = (winSpan / winCount) * 0.7;
    ctx.fillStyle = pal.windowGlow;
    for (let wi = 0; wi < winCount; wi++) {
      const wx = winStart + wi * (winSpan / winCount);
      ctx.fillRect(wx, L.termY + L.termH * 0.36, winW, L.termH * 0.30);
    }
    // ATC cab glowing glass
    ctx.fillRect(atcX - 10, atcTopY + 4, 20, 5);
    ctx.restore();

    // 8. Secondary Distant Launch Tower (Pad B)
    this._drawLatticeTower(ctx, L.padBX, L.padBY, L.towerW * 0.68, L.towerBH, pal.towerStroke, 0.62);

    // 9. Primary Mechazilla Launch & Catch Tower (Pad A)
    // Concrete orbital launch mount & flame trench base
    ctx.fillStyle = pal.buildingNear;
    ctx.beginPath();
    ctx.moveTo(L.towerX - 48, L.padY + 14);
    ctx.lineTo(L.towerX - 36, L.padY - 4);
    ctx.lineTo(L.towerX + 32, L.padY - 4);
    ctx.lineTo(L.towerX + 44, L.padY + 14);
    ctx.closePath();
    ctx.fill();

    // Flame trench arch cutout
    ctx.fillStyle = pal.isNightLights ? "#07090F" : "#334155";
    ctx.fillRect(L.towerX - 24, L.padY + 2, 22, 12);

    // Main steel lattice catch tower
    this._drawLatticeTower(ctx, L.towerX + 14, L.padY - 2, L.towerW, L.towerH, pal.towerStroke, 0.95);
  },

  _drawLatticeTower(ctx, cx, baseY, width, height, strokeColor, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    const left = cx - width * 0.5;
    const right = cx + width * 0.5;
    const top = baseY - height;

    // Vertical main columns
    ctx.beginPath();
    ctx.moveTo(left, baseY);
    ctx.lineTo(left + 1.5, top);
    ctx.moveTo(right, baseY);
    ctx.lineTo(right - 1.5, top);
    ctx.stroke();

    // Cross X-bracing bays
    const bays = Math.max(7, Math.floor(height / 18));
    ctx.lineWidth = 1.05;
    for (let b = 0; b < bays; b++) {
      const y0 = baseY - (b / bays) * height;
      const y1 = baseY - ((b + 1) / bays) * height;
      const lx0 = left + (b / bays) * 1.5;
      const rx0 = right - (b / bays) * 1.5;
      const lx1 = left + ((b + 1) / bays) * 1.5;
      const rx1 = right - ((b + 1) / bays) * 1.5;
      ctx.beginPath();
      ctx.moveTo(lx0, y0);
      ctx.lineTo(rx1, y1);
      ctx.moveTo(rx0, y0);
      ctx.lineTo(lx1, y1);
      ctx.moveTo(lx1, y1);
      ctx.lineTo(rx1, y1);
      ctx.stroke();
    }

    // Lightning arrestor mast at crown
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - 18);
    ctx.stroke();
    ctx.restore();
  },

  ensureEntities(w, h, now) {
    if (this.stars.length === 0) {
      const count = w < 720 ? 34 : 62;
      for (let i = 0; i < count; i++) {
        this.stars.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.62),
          r: 0.6 + Math.random() * 1.25,
          phase: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.03
        });
      }
    }
    if (this.clouds.length === 0) {
      for (let i = 0; i < 6; i++) {
        this.clouds.push({
          x: Math.random() * w,
          y: 35 + Math.random() * (h * 0.36),
          rx: 80 + Math.random() * 110,
          ry: 18 + Math.random() * 20,
          vx: 0.14 + Math.random() * 0.22
        });
      }
    }
    if (!this.rocket) {
      // Start on pad venting briefly so user witnesses a launch soon after selecting Gateway!
      this.rocket = {
        phase: "standby", // standby -> launch -> coast_wait -> descent -> catch -> settled
        t: 0,
        phaseDuration: 4.5,
        armClose: 0.0, // 0 = open, 1 = clamped catching booster
        x: 0,
        y: 0,
        angle: 0,
        throttle: 0
      };
    }
    if (!this.spaceplane) {
      this.spaceplane = {
        phase: "waiting", // waiting -> approach -> chute_rollout -> taxi -> docked
        t: 0,
        phaseDuration: 5.0,
        chuteOpen: 0,
        chuteDetached: false,
        detachedChuteX: 0,
        detachedChuteY: 0,
        detachedChuteAlpha: 0
      };
    }
    if (!this.fogState.nextCheck) {
      // 60% immediate chance of light dawn fog on entering morning mode, re-evaluated periodically
      const roll = Math.random() < 0.6;
      this.fogState.active = roll;
      this.fogState.targetAlpha = roll ? (0.42 + Math.random() * 0.24) : 0;
      this.fogState.nextCheck = now + 18000;
    }
  },

  pulseActivity({ kind = "complete", x, y } = {}) {
    // Trigger an immediate rocket launch if standing by, or a spaceplane approach if idle!
    if (this.rocket && (this.rocket.phase === "standby" || this.rocket.phase === "settled") && this.rocket.t > 1.2) {
      this.rocket.phase = "launch";
      this.rocket.t = 0;
      this.rocket.phaseDuration = 11.5;
    } else if (this.spaceplane && (this.spaceplane.phase === "waiting" || this.spaceplane.phase === "docked") && this.spaceplane.t > 1.2) {
      this.spaceplane.phase = "approach";
      this.spaceplane.t = 0;
      this.spaceplane.phaseDuration = 5.2;
      this.spaceplane.chuteOpen = 0;
      this.spaceplane.chuteDetached = false;
    }

    // Add a bright orbital satellite / upper-atmosphere meteor streak
    const w = this._lastW || window.innerWidth;
    const h = this._lastH || window.innerHeight;
    const isMajor = kind === "queue_clear" || kind === "finalise";
    const count = isMajor ? 2 : 1;
    for (let i = 0; i < count; i++) {
      this.orbiters.push({
        x: w * (0.1 + Math.random() * 0.4),
        y: 25 + Math.random() * (h * 0.22),
        vx: 4.5 + Math.random() * 3.5,
        vy: 0.7 + Math.random() * 0.9,
        life: 0,
        maxLife: 55 + Math.floor(Math.random() * 20)
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

    // 1. Blit cached quasi-3D static complex in one ultra-fast drawImage call
    ctx.drawImage(this.cacheCanvas, 0, 0, w, h);

    // 2. Dynamic Sky Layer: Stars (evening/dark) or Soft Drifting High Clouds (morning/light)
    if (mode === "dark" || mode === "evening") {
      const starMaxAlpha = mode === "dark" ? 0.65 : 0.28;
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.phase += s.speed * (dt * 60);
        const a = starMaxAlpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase)));
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
        const cloudRgb = mode === "morning" ? "255, 237, 224" : "255, 255, 255";
        g.addColorStop(0, `rgba(${cloudRgb}, 0.36)`);
        g.addColorStop(1, `rgba(${cloudRgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Orbital / Upper-Atmosphere Streaks
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
        const prog = o.life / o.maxLife;
        const a = Math.sin(prog * Math.PI) * (pal.isNightLights ? 0.85 : 0.45);
        const grad = ctx.createLinearGradient(o.x - o.vx * 12, o.y - o.vy * 12, o.x, o.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(o.x - o.vx * 12, o.y - o.vy * 12);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
      ctx.restore();
      this.orbiters = aliveOrb;
    }

    // 4. Diurnal Complex Lights (runway approach lights, terminal glow halos, tower red aviation beacons)
    this._drawComplexLights(ctx, L, pal, step);

    // 5. Update & Draw Heavy Rocket + Mechazilla Catch Tower Arms + Exhaust Plume
    this._updateAndDrawRocket(ctx, L, pal, dt, step, w, h);

    // 6. Update & Draw Spaceplane + Drogue Chute + Terminal Taxi
    this._updateAndDrawSpaceplane(ctx, L, pal, dt, step);

    // 7. Exhaust Smoke & Cryo Vent Particle System
    this._updateAndDrawParticles(ctx, pal, dt);

    // 8. Probabilistic Rolling Dawn Fog (morning mode only)
    this._updateAndDrawDawnFog(ctx, w, h, L, mode, dt, now);
  },

  _drawComplexLights(ctx, L, pal, step) {
    const pulse = 0.5 + 0.5 * Math.sin(step * 4.5);

    // Aviation red warning strobes on tower crowns & VAB (subtle by day, bright at dusk/night)
    const beaconAlpha = pal.isNightLights ? (0.45 + 0.55 * pulse) : (0.18 + 0.22 * pulse);
    const beacons = [
      { x: L.towerX + 14, y: L.padY - 2 - L.towerH - 18 },
      { x: L.padBX, y: L.padBY - L.towerBH - 14 },
      { x: L.vabX + L.vabW * 0.36, y: L.vabY - L.vabH - 2 }
    ];
    ctx.save();
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i];
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pal.isNightLights ? 12 : 5);
      g.addColorStop(0, `rgba(248, 113, 113, ${beaconAlpha.toFixed(3)})`);
      g.addColorStop(1, "rgba(248, 113, 113, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, pal.isNightLights ? 12 : 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pal.lightIntensity > 0.25) {
      // Terminal warm/cool ambient spill onto the tarmac
      const spill = ctx.createRadialGradient(
        L.termX + L.termW * 0.5, L.termY + L.termH, 8,
        L.termX + L.termW * 0.5, L.termY + L.termH + 14, L.termW * 0.72
      );
      const spillRgb = pal.isNightLights && this._lastMode === "evening" ? "251, 191, 36" : "125, 211, 252";
      spill.addColorStop(0, `rgba(${spillRgb}, ${(0.22 * pal.lightIntensity).toFixed(3)})`);
      spill.addColorStop(1, `rgba(${spillRgb}, 0)`);
      ctx.fillStyle = spill;
      ctx.beginPath();
      ctx.ellipse(L.termX + L.termW * 0.5, L.termY + L.termH + 8, L.termW * 0.75, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pad A floodlight beams illuminating the launch mount
      const padGlow = ctx.createRadialGradient(L.towerX - 8, L.padY - 12, 4, L.towerX - 8, L.padY - 12, 72);
      padGlow.addColorStop(0, `rgba(226, 232, 240, ${(0.24 * pal.lightIntensity).toFixed(3)})`);
      padGlow.addColorStop(1, "rgba(226, 232, 240, 0)");
      ctx.fillStyle = padGlow;
      ctx.beginPath();
      ctx.arc(L.towerX - 8, L.padY - 12, 72, 0, Math.PI * 2);
      ctx.fill();

      // Sequential perspective runway edge lights + pulsing approach rabbit strobes
      const rabbitIdx = Math.floor(step * 10) % 9;
      for (let i = 0; i < 9; i++) {
        const t = Math.pow(i / 8, 1.4);
        const cx = L.rwFarX + (L.rwNearX - L.rwFarX) * t;
        const cy = L.rwFarY + (L.rwNearY - L.rwFarY) * t;
        const hw = L.rwFarHalfW + (L.rwNearHalfW - L.rwFarHalfW) * t;
        const rSize = 1.4 + t * 2.2;
        const isRabbit = i === rabbitIdx;
        const lRgb = i < 2 ? "52, 211, 153" : (isRabbit ? "255, 255, 255" : "186, 230, 253");
        const lAlpha = (isRabbit ? 0.95 : 0.62) * pal.lightIntensity;

        [cx - hw, cx + hw].forEach(lx => {
          const lg = ctx.createRadialGradient(lx, cy, 0, lx, cy, rSize * 3.2);
          lg.addColorStop(0, `rgba(${lRgb}, ${lAlpha.toFixed(3)})`);
          lg.addColorStop(1, `rgba(${lRgb}, 0)`);
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(lx, cy, rSize * 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }
    ctx.restore();
  },

  _updateAndDrawRocket(ctx, L, pal, dt, step, w, h) {
    const r = this.rocket;
    r.t += dt;

    const padX = L.towerX - 10;
    const padBaseY = L.padY - 4;
    const rocketH = Math.min(68, L.towerH * 0.36);
    const rocketW = Math.max(6, rocketH * 0.14);
    const catchY = L.padY - L.towerH * 0.58;

    let visible = true;
    let drawFlame = false;
    let flameScale = 0;
    let armY = L.padY - L.towerH * 0.72;
    let targetArmClose = 0;

    if (r.phase === "standby") {
      r.x = padX;
      r.y = padBaseY;
      r.angle = 0;
      targetArmClose = 0.25;
      armY = padBaseY - rocketH * 0.78;
      // Gentle cryo vapour venting from rocket side
      if (Math.random() < 0.28) {
        this.ventParticles.push({
          x: padX - rocketW * 0.6,
          y: padBaseY - rocketH * 0.55,
          vx: -(0.35 + Math.random() * 0.45),
          vy: -(0.12 + Math.random() * 0.22),
          r: 2.5 + Math.random() * 3.5,
          life: 0,
          maxLife: 45 + Math.random() * 25
        });
      }
      if (r.t >= r.phaseDuration) {
        r.phase = "launch";
        r.t = 0;
        r.phaseDuration = 11.5;
      }
    } else if (r.phase === "launch") {
      const p = Math.min(1, r.t / r.phaseDuration);
      // Smooth exponential acceleration + graceful gravity turn arc toward upper right/left
      const climb = Math.pow(p, 2.55);
      const liftY = climb * (padBaseY + 180);
      const turnX = Math.pow(Math.max(0, p - 0.14), 2.1) * (w * 0.18);
      r.x = padX - turnX;
      r.y = padBaseY - liftY;
      r.angle = -Math.pow(Math.max(0, p - 0.14), 1.45) * 0.46;
      drawFlame = true;
      flameScale = p < 0.1 ? (0.4 + p * 6) : 1.0;
      targetArmClose = 0;

      // Spawn diurnal-tinted exhaust plume trail particles
      const spawnCount = p < 0.25 ? 3 : 2;
      for (let k = 0; k < spawnCount; k++) {
        const tailX = r.x - Math.sin(r.angle) * 6;
        const tailY = r.y + Math.cos(r.angle) * 6;
        const nearPad = r.y > padBaseY - 75;
        this.plumeParticles.push({
          x: tailX + (Math.random() - 0.5) * (nearPad ? 14 : 4),
          y: nearPad ? Math.min(padBaseY + 4, tailY + Math.random() * 8) : tailY,
          vx: nearPad ? ((Math.random() - 0.5) * 2.4) : (-Math.sin(r.angle) * 0.4 + (Math.random() - 0.5) * 0.35),
          vy: nearPad ? -(0.2 + Math.random() * 0.55) : (0.55 + Math.random() * 0.45),
          r: nearPad ? (6 + Math.random() * 7) : (3.5 + Math.random() * 4.5),
          grow: nearPad ? 0.22 : 0.16,
          hot: p < 0.75 && Math.random() < 0.4,
          life: 0,
          maxLife: nearPad ? 95 : 150
        });
      }

      if (r.t >= r.phaseDuration) {
        r.phase = "coast_wait";
        r.t = 0;
        r.phaseDuration = 7.5;
      }
    } else if (r.phase === "coast_wait") {
      visible = false;
      targetArmClose = 0;
      armY = catchY;
      if (r.t >= r.phaseDuration) {
        r.phase = "descent";
        r.t = 0;
        r.phaseDuration = 8.2;
      }
    } else if (r.phase === "descent") {
      // Returning Super-Heavy Booster descending tail-first to Mechazilla tower!
      const p = Math.min(1, r.t / r.phaseDuration);
      const easeOut = 1 - Math.pow(1 - p, 2.75);
      const startX = padX - w * 0.12;
      const startY = -65;
      r.x = startX + (padX - startX) * easeOut;
      r.y = startY + (catchY + rocketH * 0.76 - startY) * easeOut;
      r.angle = (1 - easeOut) * 0.28;
      armY = catchY;

      // Landing burn ignites in the final 45% of descent!
      if (p > 0.48) {
        drawFlame = true;
        const burnP = (p - 0.48) / 0.52;
        flameScale = burnP < 0.85 ? (0.85 - burnP * 0.25) : ((1 - burnP) * 4);
        if (Math.random() < 0.85) {
          this.plumeParticles.push({
            x: r.x + (Math.random() - 0.5) * 4,
            y: r.y + 4,
            vx: (Math.random() - 0.5) * 0.9,
            vy: 0.9 + Math.random() * 0.7,
            r: 3.5 + Math.random() * 3.5,
            grow: 0.14,
            hot: true,
            life: 0,
            maxLife: 70
          });
        }
      }
      // Chopstick arms begin closing as booster enters the catch envelope
      targetArmClose = p > 0.78 ? ((p - 0.78) / 0.22) : 0;

      if (r.t >= r.phaseDuration) {
        r.phase = "catch";
        r.t = 0;
        r.phaseDuration = 4.6;
      }
    } else if (r.phase === "catch") {
      // Caught firmly by the chopsticks, then smoothly lowered back down onto the orbital mount!
      const p = Math.min(1, r.t / r.phaseDuration);
      const lowerP = p < 0.35 ? 0 : Math.min(1, (p - 0.35) / 0.65);
      const smoothLower = lowerP * lowerP * (3 - 2 * lowerP);
      const caughtY = catchY + rocketH * 0.76;
      r.x = padX;
      r.y = caughtY + (padBaseY - caughtY) * smoothLower;
      r.angle = 0;
      armY = r.y - rocketH * 0.76;
      targetArmClose = 1.0;

      // Steam exhale right after catch
      if (p < 0.35 && Math.random() < 0.45) {
        this.ventParticles.push({
          x: r.x + (Math.random() - 0.5) * 10,
          y: r.y - rocketH * 0.2,
          vx: (Math.random() - 0.5) * 1.1,
          vy: -(0.15 + Math.random() * 0.3),
          r: 4 + Math.random() * 4,
          life: 0,
          maxLife: 45
        });
      }

      if (r.t >= r.phaseDuration) {
        r.phase = "settled";
        r.t = 0;
        r.phaseDuration = 8.0;
      }
    } else {
      // Settled on pad before next cycle
      r.x = padX;
      r.y = padBaseY;
      r.angle = 0;
      armY = padBaseY - rocketH * 0.78;
      targetArmClose = 0.25;
      if (r.t >= r.phaseDuration) {
        r.phase = "standby";
        r.t = 0;
        r.phaseDuration = 4.5;
      }
    }

    // Smooth chopstick arm interpolation
    r.armClose += (targetArmClose - r.armClose) * Math.min(1, dt * 6);

    // Draw Rocket / Booster body
    if (visible) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      // Radiant ignition / landing burn flame + nocturnal glow bloom
      if (drawFlame && flameScale > 0.05) {
        const flH = (26 + Math.sin(step * 42) * 5) * flameScale;
        const flW = rocketW * (0.9 + flameScale * 0.35);

        // Ambient light halo around flame
        const bloomR = flH * (pal.isNightLights ? 2.4 : 1.4);
        const bloom = ctx.createRadialGradient(0, flH * 0.35, 2, 0, flH * 0.35, bloomR);
        bloom.addColorStop(0, `rgba(${pal.plumeMid}, ${(pal.isNightLights ? 0.52 : 0.28).toFixed(3)})`);
        bloom.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(0, flH * 0.35, bloomR, 0, Math.PI * 2);
        ctx.fill();

        // Outer flame cone
        const flGrad = ctx.createLinearGradient(0, 0, 0, flH);
        flGrad.addColorStop(0, `rgba(${pal.plumeCore}, 0.98)`);
        flGrad.addColorStop(0.45, `rgba(${pal.plumeMid}, 0.88)`);
        flGrad.addColorStop(1, `rgba(${pal.plumeMid}, 0)`);
        ctx.fillStyle = flGrad;
        ctx.beginPath();
        ctx.moveTo(-flW * 0.55, 0);
        ctx.quadraticCurveTo(0, flH * 1.15, flW * 0.55, 0);
        ctx.closePath();
        ctx.fill();
      }

      // Stainless-steel / ceramic rocket fuselage (light side + shaded side for quasi-3D volume)
      const isBoosterOnly = (r.phase === "descent" || r.phase === "catch");
      const bodyH = isBoosterOnly ? rocketH * 0.68 : rocketH;
      ctx.fillStyle = pal.bodyLight;
      ctx.fillRect(-rocketW * 0.5, -bodyH, rocketW * 0.55, bodyH);
      ctx.fillStyle = pal.bodyShade;
      ctx.fillRect(rocketW * 0.05, -bodyH, rocketW * 0.45, bodyH);

      if (!isBoosterOnly) {
        // Upper nosecone ogive
        ctx.fillStyle = pal.bodyLight;
        ctx.beginPath();
        ctx.moveTo(-rocketW * 0.5, -bodyH);
        ctx.quadraticCurveTo(0, -bodyH - rocketW * 1.65, rocketW * 0.5, -bodyH);
        ctx.closePath();
        ctx.fill();
      } else {
        // Booster grid fins near top
        ctx.fillStyle = pal.towerStroke;
        ctx.fillRect(-rocketW * 0.95, -bodyH + 3, rocketW * 1.9, 2.2);
      }

      // Subtle hot-stage interstage ring
      ctx.fillStyle = pal.towerStroke;
      ctx.fillRect(-rocketW * 0.52, -bodyH * 0.56, rocketW * 1.04, 2);

      ctx.restore();
    }

    // Draw Mechazilla Catch Chopstick Arms on front of tower carriage
    ctx.save();
    const towerCenterX = L.towerX + 14;
    const armLen = 28;
    const spreadY = (1 - r.armClose) * 7 + 1.5;
    ctx.strokeStyle = pal.isNightLights ? "#64748B" : pal.towerStroke;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    // Upper/rear arm
    ctx.beginPath();
    ctx.moveTo(towerCenterX - L.towerW * 0.45, armY - 3);
    ctx.lineTo(towerCenterX - L.towerW * 0.45 - armLen, armY - spreadY);
    // Lower/front arm
    ctx.moveTo(towerCenterX - L.towerW * 0.45, armY + 3);
    ctx.lineTo(towerCenterX - L.towerW * 0.45 - armLen, armY + spreadY);
    ctx.stroke();

    // Catch carriage glow indicator when arms are clamped
    if (r.armClose > 0.7) {
      ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
      ctx.beginPath();
      ctx.arc(towerCenterX - L.towerW * 0.45 - 2, armY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _updateAndDrawSpaceplane(ctx, L, pal, dt, step) {
    const sp = this.spaceplane;
    sp.t += dt;

    let visible = false;
    let x = 0;
    let y = 0;
    let scale = 1;
    let heading = 0;
    let showChute = false;
    let chuteInflation = 0;

    if (sp.phase === "waiting") {
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "approach";
        sp.t = 0;
        sp.phaseDuration = 5.2;
        sp.chuteOpen = 0;
        sp.chuteDetached = false;
      }
    } else if (sp.phase === "approach") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const startX = L.rwFarX - 150;
      const startY = L.horizonY - 120;
      const tdT = 0.14; // touchdown near far threshold
      const tdX = L.rwFarX + (L.rwNearX - L.rwFarX) * tdT;
      const tdY = L.rwFarY + (L.rwNearY - L.rwFarY) * tdT;
      // Smooth glide slope flare
      x = startX + (tdX - startX) * p;
      y = startY + (tdY - startY) * (1 - Math.pow(1 - p, 1.55));
      scale = 0.42 + p * 0.34;
      heading = Math.atan2(tdY - startY, tdX - startX) * (1 - p * 0.45);

      if (sp.t >= sp.phaseDuration) {
        // Touchdown tire smoke puff!
        for (let i = 0; i < 6; i++) {
          this.ventParticles.push({
            x: tdX + (Math.random() - 0.5) * 6,
            y: tdY + 2,
            vx: (Math.random() - 0.5) * 1.0,
            vy: -(0.15 + Math.random() * 0.35),
            r: 2.5 + Math.random() * 3,
            life: 0,
            maxLife: 38
          });
        }
        sp.phase = "chute_rollout";
        sp.t = 0;
        sp.phaseDuration = 6.2;
      }
    } else if (sp.phase === "chute_rollout") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      // Decelerating rollout from touchdown (0.14) to taxiway turnoff (0.58)
      const decel = 1 - Math.pow(1 - p, 2.25);
      const rwT = 0.14 + (0.58 - 0.14) * decel;
      x = L.rwFarX + (L.rwNearX - L.rwFarX) * rwT;
      y = L.rwFarY + (L.rwNearY - L.rwFarY) * rwT;
      scale = 0.76 + (rwT - 0.14) * 0.72;
      heading = Math.atan2(L.rwNearY - L.rwFarY, L.rwNearX - L.rwFarX);

      // Drogue chute inflates rapidly after touchdown, billows, then detaches at p = 0.80
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
        sp.phase = "taxi";
        sp.t = 0;
        sp.phaseDuration = 6.5;
      }
    } else if (sp.phase === "taxi") {
      visible = true;
      const p = Math.min(1, sp.t / sp.phaseDuration);
      const smooth = p * p * (3 - 2 * p);
      // Quadratic bezier along taxiway to terminal gate
      const p0x = L.taxiStartX;
      const p0y = L.taxiStartY;
      const cx = L.gateX + 52;
      const cy = L.taxiStartY + 4;
      const p2x = L.gateX;
      const p2y = L.gateY + 3;
      const inv = 1 - smooth;
      x = inv * inv * p0x + 2 * inv * smooth * cx + smooth * smooth * p2x;
      y = inv * inv * p0y + 2 * inv * smooth * cy + smooth * smooth * p2y;
      const dx = 2 * inv * (cx - p0x) + 2 * smooth * (p2x - cx);
      const dy = 2 * inv * (cy - p0y) + 2 * smooth * (p2y - cy);
      heading = Math.atan2(dy, dx);
      scale = 1.05 - smooth * 0.18;

      if (sp.t >= sp.phaseDuration) {
        sp.phase = "docked";
        sp.t = 0;
        sp.phaseDuration = 9.0;
      }
    } else if (sp.phase === "docked") {
      visible = true;
      x = L.gateX;
      y = L.gateY + 3;
      heading = Math.PI;
      scale = 0.87;
      if (sp.t >= sp.phaseDuration) {
        sp.phase = "waiting";
        sp.t = 0;
        sp.phaseDuration = 5.5;
      }
    }

    // Fade out dropped drogue chute behind spaceplane
    if (sp.chuteDetached && sp.detachedChuteAlpha > 0.01) {
      sp.detachedChuteAlpha = Math.max(0, sp.detachedChuteAlpha - dt * 0.65);
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

    // Billowing conical drogue chute + taut shroud lines behind tail
    if (showChute && chuteInflation > 0.05) {
      const tetherLen = 14 + chuteInflation * 14;
      const chuteR = 6.5 * chuteInflation;
      const tailX = -11;
      const canopyX = tailX - tetherLen;

      // Shroud lines
      ctx.strokeStyle = pal.isNightLights ? "rgba(226, 232, 240, 0.55)" : "rgba(71, 85, 105, 0.55)";
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, -chuteR);
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, 0);
      ctx.moveTo(tailX, 0);
      ctx.lineTo(canopyX, chuteR);
      ctx.stroke();

      // Conical parachute canopy with high-vis aerospace striping
      ctx.fillStyle = pal.chuteColor;
      ctx.beginPath();
      ctx.moveTo(canopyX, -chuteR);
      ctx.quadraticCurveTo(canopyX - chuteR * 1.45, 0, canopyX, chuteR);
      ctx.quadraticCurveTo(canopyX - chuteR * 0.28, 0, canopyX, -chuteR);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = pal.chuteStripe;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(canopyX - chuteR * 0.35, -chuteR * 0.55);
      ctx.lineTo(canopyX - chuteR * 0.35, chuteR * 0.55);
      ctx.stroke();
    }

    // Forward landing headlight cone (visible on approach & taxi, especially bright at night)
    if (sp.phase !== "docked") {
      const beamAlpha = pal.isNightLights ? 0.36 : 0.14;
      const beamGrad = ctx.createLinearGradient(11, 0, 56, 0);
      beamGrad.addColorStop(0, `rgba(255, 251, 235, ${beamAlpha})`);
      beamGrad.addColorStop(1, "rgba(255, 251, 235, 0)");
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(11, -1.5);
      ctx.lineTo(56, -12);
      ctx.lineTo(56, 12);
      ctx.lineTo(11, 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // Crisp Delta-Wing Spaceplane silhouette
    ctx.fillStyle = pal.bodyLight;
    ctx.beginPath();
    ctx.moveTo(13, 0);      // nose
    ctx.lineTo(2, -3.5);
    ctx.lineTo(-9, -11);    // left delta wingtip
    ctx.lineTo(-11, -9);
    ctx.lineTo(-9, -2.5);
    ctx.lineTo(-11, 0);     // tail
    ctx.lineTo(-9, 2.5);
    ctx.lineTo(-11, 9);
    ctx.lineTo(-9, 11);     // right delta wingtip
    ctx.lineTo(2, 3.5);
    ctx.closePath();
    ctx.fill();

    // Thermal black leading edge + cockpit visor
    ctx.fillStyle = pal.bodyShade;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(6, -1.5);
    ctx.lineTo(6, 1.5);
    ctx.closePath();
    ctx.fill();

    // Blinking wingtip navigation strobes
    if (Math.sin(step * 12) > 0.25) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(-9.5, -10.2, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.beginPath();
      ctx.arc(-9.5, 10.2, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

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
        this.fogState.targetAlpha = roll ? (0.36 + Math.random() * 0.28) : 0;
        this.fogState.nextCheck = now + 18000 + Math.random() * 14000;
      }
      this.fogState.alpha += (this.fogState.targetAlpha - this.fogState.alpha) * Math.min(1, dt * 0.35);
    }

    if (this.fogState.alpha <= 0.01) return;
    this.fogState.offset = (this.fogState.offset + dt * 16) % (w + 400);

    ctx.save();
    // 2 layered drifting dawn mist ribbons hugging the runway and launchpad apron
    for (let layer = 0; layer < 2; layer++) {
      const baseY = L.horizonY + L.groundH * (0.14 + layer * 0.28);
      const bandH = 65 + layer * 35;
      const g = ctx.createLinearGradient(0, baseY - bandH * 0.5, 0, baseY + bandH * 0.6);
      const peak = this.fogState.alpha * (layer === 0 ? 0.55 : 0.42);
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
