/**
 * PETTR Automatic Festive Holiday Theme Engine (v13.0)
 * Mirrors the calendar holiday registry across Nature, Gateway, and Deep Blue worlds,
 * adding non-intrusive, battery-conscious, world-authentic seasonal decorations year-round.
 */
const HolidayThemes = {
  MAJOR_HOLIDAYS: {
    "1-1": { id: "new_year", family: "new_year", name: "New Year's Day", icon: "✨", accent: "250, 204, 21", secondary: "56, 189, 248" },
    "2-14": { id: "valentines", family: "valentines", name: "Valentine's Day", icon: "💖", accent: "244, 114, 182", secondary: "251, 113, 133" },
    "3-17": { id: "st_patricks", family: "st_patricks", name: "St. Patrick's Day", icon: "☘️", accent: "52, 211, 153", secondary: "250, 204, 21" },
    "4-22": { id: "earth_day", family: "earth_day", name: "Earth Day", icon: "🌍", accent: "52, 211, 153", secondary: "56, 189, 248" },
    "6-21": { id: "midsummer", family: "midsummer", name: "Summer Solstice", icon: "☀️", accent: "251, 191, 36", secondary: "251, 146, 60" },
    "8-9": { id: "sg_national_day", family: "national_day", name: "Singapore National Day", icon: "🇸🇬", accent: "239, 68, 68", secondary: "255, 255, 255" },
    "10-31": { id: "halloween", family: "halloween", name: "Halloween", icon: "🎃", accent: "249, 115, 22", secondary: "168, 85, 247" },
    "12-24": { id: "christmas_eve", family: "christmas", name: "Christmas Eve", icon: "🎄", accent: "239, 68, 68", secondary: "52, 211, 153" },
    "12-25": { id: "christmas", family: "christmas", name: "Christmas Day", icon: "🎄", accent: "239, 68, 68", secondary: "52, 211, 153" },
    "12-26": { id: "boxing_day", family: "christmas", name: "Boxing Day", icon: "🎁", accent: "239, 68, 68", secondary: "250, 204, 21" },
    "12-31": { id: "new_years_eve", family: "new_year", name: "New Year's Eve", icon: "🥂", accent: "250, 204, 21", secondary: "167, 139, 250" }
  },

  MOVABLE_HOLIDAYS: [
    // Lunar New Year
    [2025, 1, 28, 1, 30, { id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮", accent: "239, 68, 68", secondary: "250, 204, 21" }],
    [2026, 2, 16, 2, 18, { id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮", accent: "239, 68, 68", secondary: "250, 204, 21" }],
    [2027, 2, 5, 2, 7, { id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮", accent: "239, 68, 68", secondary: "250, 204, 21" }],
    [2028, 1, 26, 1, 28, { id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮", accent: "239, 68, 68", secondary: "250, 204, 21" }],
    [2029, 2, 13, 2, 15, { id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮", accent: "239, 68, 68", secondary: "250, 204, 21" }],
    // Easter Weekend
    [2025, 4, 18, 4, 21, { id: "easter", family: "easter", name: "Easter", icon: "🌸", accent: "249, 168, 212", secondary: "167, 243, 208" }],
    [2026, 4, 3, 4, 6, { id: "easter", family: "easter", name: "Easter", icon: "🌸", accent: "249, 168, 212", secondary: "167, 243, 208" }],
    [2027, 3, 26, 3, 29, { id: "easter", family: "easter", name: "Easter", icon: "🌸", accent: "249, 168, 212", secondary: "167, 243, 208" }],
    [2028, 4, 14, 4, 17, { id: "easter", family: "easter", name: "Easter", icon: "🌸", accent: "249, 168, 212", secondary: "167, 243, 208" }],
    [2029, 3, 30, 4, 2, { id: "easter", family: "easter", name: "Easter", icon: "🌸", accent: "249, 168, 212", secondary: "167, 243, 208" }],
    // Mid-Autumn Festival
    [2025, 10, 6, 10, 6, { id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕", accent: "253, 224, 71", secondary: "251, 146, 60" }],
    [2026, 9, 25, 9, 25, { id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕", accent: "253, 224, 71", secondary: "251, 146, 60" }],
    [2027, 9, 15, 9, 15, { id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕", accent: "253, 224, 71", secondary: "251, 146, 60" }],
    [2028, 10, 3, 10, 3, { id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕", accent: "253, 224, 71", secondary: "251, 146, 60" }],
    [2029, 9, 22, 9, 22, { id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕", accent: "253, 224, 71", secondary: "251, 146, 60" }],
    // Diwali
    [2025, 10, 20, 10, 20, { id: "diwali", family: "diwali", name: "Diwali", icon: "🪔", accent: "251, 191, 36", secondary: "236, 72, 153" }],
    [2026, 11, 8, 11, 8, { id: "diwali", family: "diwali", name: "Diwali", icon: "🪔", accent: "251, 191, 36", secondary: "236, 72, 153" }],
    [2027, 10, 29, 10, 29, { id: "diwali", family: "diwali", name: "Diwali", icon: "🪔", accent: "251, 191, 36", secondary: "236, 72, 153" }],
    [2028, 10, 17, 10, 17, { id: "diwali", family: "diwali", name: "Diwali", icon: "🪔", accent: "251, 191, 36", secondary: "236, 72, 153" }],
    [2029, 11, 5, 11, 5, { id: "diwali", family: "diwali", name: "Diwali", icon: "🪔", accent: "251, 191, 36", secondary: "236, 72, 153" }],
    // Thanksgiving
    [2025, 11, 27, 11, 27, { id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁", accent: "234, 88, 12", secondary: "250, 204, 21" }],
    [2026, 11, 26, 11, 26, { id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁", accent: "234, 88, 12", secondary: "250, 204, 21" }],
    [2027, 11, 25, 11, 25, { id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁", accent: "234, 88, 12", secondary: "250, 204, 21" }],
    [2028, 11, 23, 11, 23, { id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁", accent: "234, 88, 12", secondary: "250, 204, 21" }],
    [2029, 11, 22, 11, 22, { id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁", accent: "234, 88, 12", secondary: "250, 204, 21" }]
  ],

  _previewHolidayId: null,
  _serverHoliday: null,
  _particles: [],
  _particleSig: "",
  _fireworks: [],
  _fwTimer: 0,
  _bats: [],
  _sleigh: null,
  _sleighTimer: 6,

  _lookupById(hid) {
    if (!hid) return null;
    for (const k of Object.keys(this.MAJOR_HOLIDAYS)) {
      if (this.MAJOR_HOLIDAYS[k].id === hid) return { ...this.MAJOR_HOLIDAYS[k] };
    }
    for (let i = 0; i < this.MOVABLE_HOLIDAYS.length; i++) {
      const entry = this.MOVABLE_HOLIDAYS[i][5];
      if (entry.id === hid) return { ...entry };
    }
    return { id: hid, family: "generic", name: hid.replace(/_/g, " "), icon: "🎉", accent: "250, 204, 21", secondary: "56, 189, 248" };
  },

  setPreviewHoliday(idOrNull) {
    this._previewHolidayId = idOrNull ? String(idOrNull).trim() : null;
    this._particles = [];
    this._particleSig = "";
    this._fireworks = [];
    this._bats = [];
    this._sleigh = null;
    if (typeof WaveCanvas !== "undefined" && WaveCanvas.ctx) {
      try { WaveCanvas.draw(0.016); } catch (_) {}
    }
  },

  setServerHoliday(info) {
    if (!info || !info.id) {
      this._serverHoliday = null;
      return;
    }
    const base = this._lookupById(info.id) || {};
    this._serverHoliday = {
      ...base,
      id: info.id,
      name: info.name || base.name || "Holiday",
      icon: info.icon || base.icon || "🎉"
    };
  },

  getHolidayForDate(dateObj = null) {
    const dt = dateObj instanceof Date ? dateObj : new Date();
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const fixed = this.MAJOR_HOLIDAYS[`${m}-${d}`];
    if (fixed) return { ...fixed };

    const curVal = y * 10000 + m * 100 + d;
    for (let i = 0; i < this.MOVABLE_HOLIDAYS.length; i++) {
      const [hy, sm, sd, em, ed, info] = this.MOVABLE_HOLIDAYS[i];
      if (hy !== y) continue;
      const startVal = hy * 10000 + sm * 100 + sd;
      const endVal = hy * 10000 + em * 100 + ed;
      if (curVal >= startVal && curVal <= endVal) return { ...info };
    }
    return null;
  },

  getActiveHoliday() {
    if (this._previewHolidayId) return this._lookupById(this._previewHolidayId);
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("holiday");
      if (q) return this._lookupById(q.trim());
    } catch (_) {}
    const localHol = this.getHolidayForDate(new Date());
    if (localHol) return localHol;
    if (this._serverHoliday) return { ...this._serverHoliday };
    return null;
  },

  _ensureParticles(hol, w, h, dt) {
    const isNarrow = w < 720;
    const sig = `${hol.id}:${isNarrow ? "m" : "d"}`;
    const targetCount = isNarrow ? 16 : 32;
    if (this._particleSig !== sig || this._particles.length === 0) {
      this._particleSig = sig;
      this._particles = [];
      for (let i = 0; i < targetCount; i++) {
        this._particles.push(this._makeParticle(hol, w, h, true));
      }
    }
    const fam = hol.family;
    const rises = fam === "lantern" || fam === "diwali" || fam === "mid_autumn" || fam === "earth_day" || fam === "midsummer";
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.phase += dt * 1.6;
      if (rises) {
        p.y -= p.vy * dt;
        p.x += Math.sin(p.phase) * p.sway * dt + p.vx * dt;
        if (p.y < -30) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
      } else {
        p.y += p.vy * dt;
        p.x += Math.sin(p.phase) * p.sway * dt + p.vx * dt;
        if (p.y > h + 25) {
          p.y = -20;
          p.x = Math.random() * w;
        }
      }
      if (p.x < -30) p.x = w + 25;
      if (p.x > w + 30) p.x = -25;
    }
  },

  _makeParticle(hol, w, h, randomY) {
    const fam = hol.family;
    const isRise = fam === "lantern" || fam === "diwali" || fam === "mid_autumn" || fam === "earth_day" || fam === "midsummer";
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : (isRise ? h + 15 : -15),
      vx: (Math.random() - 0.5) * 14,
      vy: (fam === "christmas" ? 22 : (isRise ? 16 : 26)) + Math.random() * 18,
      sway: 10 + Math.random() * 16,
      size: 2.2 + Math.random() * 3.8,
      phase: Math.random() * Math.PI * 2,
      variant: Math.floor(Math.random() * 3),
      alpha: 0.45 + Math.random() * 0.45
    };
  },

  _updateFireworks(ctx, w, h, hol, dt, waterLineY = null) {
    const isNarrow = w < 720;
    this._fwTimer -= dt;
    if (this._fwTimer <= 0 && this._fireworks.length < (isNarrow ? 2 : 3)) {
      this._fwTimer = isNarrow ? 2.8 + Math.random() * 2.2 : 1.7 + Math.random() * 1.8;
      const fx = w * (0.14 + Math.random() * 0.72);
      const fy = h * (0.09 + Math.random() * 0.17);
      const isSg = hol.id === "sg_national_day";
      const palette = isSg
        ? ["239, 68, 68", "255, 255, 255"]
        : ["250, 204, 21", "56, 189, 248", "244, 114, 182", "167, 243, 208"];
      const rgb = palette[Math.floor(Math.random() * palette.length)];
      const sparks = [];
      const count = isNarrow ? 14 : 22;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
        const spd = 34 + Math.random() * 44;
        sparks.push({ ang, spd, size: 1.4 + Math.random() * 1.4 });
      }
      this._fireworks.push({ x: fx, y: fy, age: 0, maxAge: 1.55, rgb, sparks });
    }

    const alive = [];
    for (let i = 0; i < this._fireworks.length; i++) {
      const fw = this._fireworks[i];
      fw.age += dt;
      if (fw.age >= fw.maxAge) continue;
      alive.push(fw);
      const t = fw.age / fw.maxAge;
      const env = t < 0.18 ? (t / 0.18) : Math.pow(1 - (t - 0.18) / 0.82, 1.35);
      const radiusScale = 1 - Math.pow(1 - t, 2.2);

      // Soft bloom flash
      const coreR = 16 * (1 - t * 0.6);
      const cg = ctx.createRadialGradient(fw.x, fw.y, 0, fw.x, fw.y, coreR);
      cg.addColorStop(0, `rgba(255, 255, 255, ${(0.45 * env).toFixed(3)})`);
      cg.addColorStop(1, `rgba(${fw.rgb}, 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(fw.x, fw.y, coreR, 0, Math.PI * 2);
      ctx.fill();

      for (let s = 0; s < fw.sparks.length; s++) {
        const sp = fw.sparks[s];
        const sx = fw.x + Math.cos(sp.ang) * sp.spd * radiusScale;
        const sy = fw.y + Math.sin(sp.ang) * sp.spd * radiusScale + 18 * t * t;
        const px = fw.x + Math.cos(sp.ang) * sp.spd * Math.max(0, radiusScale - 0.12);
        const py = fw.y + Math.sin(sp.ang) * sp.spd * Math.max(0, radiusScale - 0.12) + 18 * Math.max(0, t - 0.08) * Math.max(0, t - 0.08);
        ctx.strokeStyle = `rgba(${fw.rgb}, ${(0.78 * env).toFixed(3)})`;
        ctx.lineWidth = sp.size * 0.85;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sp.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      if (waterLineY && waterLineY > fw.y) {
        ctx.fillStyle = `rgba(${fw.rgb}, ${(0.12 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(fw.x, waterLineY + 14, 24 * radiusScale + 8, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this._fireworks = alive;
  },

  _drawSnowflakesAndParticles(ctx, hol, isDarkMode) {
    const fam = hol.family;
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = p.alpha * (isDarkMode ? 0.88 : 0.72);
      if (fam === "christmas") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.68, 0, Math.PI * 2);
        ctx.fill();
      } else if (fam === "lantern" || fam === "mid_autumn" || fam === "diwali") {
        const wL = p.size * 1.45;
        const hL = p.size * 1.95;
        const lg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, hL * 1.3);
        lg.addColorStop(0, `rgba(${hol.secondary}, 0.92)`);
        lg.addColorStop(0.55, `rgba(${hol.accent}, 0.55)`);
        lg.addColorStop(1, `rgba(${hol.accent}, 0)`);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(0, 0, hL * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${hol.accent}, 0.92)`;
        ctx.beginPath();
        ctx.roundRect(-wL * 0.5, -hL * 0.5, wL, hL, wL * 0.35);
        ctx.fill();
        ctx.fillStyle = `rgba(${hol.secondary}, 0.85)`;
        ctx.fillRect(-wL * 0.35, hL * 0.42, wL * 0.7, 1.3);
      } else if (fam === "valentines") {
        const s = p.size * 0.85;
        ctx.fillStyle = p.variant === 0 ? "rgba(251, 113, 133, 0.72)" : "rgba(244, 114, 182, 0.66)";
        ctx.beginPath();
        ctx.moveTo(0, s * 0.5);
        ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.55, -s * 1.2, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.55, -s * 1.2, s * 1.1, -s * 0.35, 0, s * 0.5);
        ctx.fill();
      } else if (fam === "st_patricks") {
        const r = p.size * 0.55;
        ctx.fillStyle = "rgba(52, 211, 153, 0.75)";
        [[0, -r], [-r * 0.9, r * 0.4], [r * 0.9, r * 0.4]].forEach(([cx, cy]) => {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (fam === "thanksgiving" || fam === "easter" || fam === "earth_day" || fam === "midsummer") {
        ctx.rotate(p.phase);
        const col = fam === "thanksgiving"
          ? (p.variant === 0 ? "234, 88, 12" : "245, 158, 11")
          : (fam === "easter" ? (p.variant === 0 ? "249, 168, 212" : "167, 243, 208") : hol.accent);
        ctx.fillStyle = `rgba(${col}, 0.74)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.1, p.size * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _drawLightGarland(ctx, x0, y0, x1, y1, sag, count, step, colors) {
    ctx.save();
    ctx.strokeStyle = "rgba(30, 41, 59, 0.45)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, (y0 + y1) * 0.5 + sag, x1, y1);
    ctx.stroke();

    for (let i = 1; i < count; i++) {
      const f = i / count;
      const inv = 1 - f;
      const bx = inv * inv * x0 + 2 * inv * f * ((x0 + x1) * 0.5) + f * f * x1;
      const by = inv * inv * y0 + 2 * inv * f * ((y0 + y1) * 0.5 + sag) + f * f * y1;
      const col = colors[i % colors.length];
      const twinkle = 0.55 + 0.45 * Math.sin(step * 4.2 + i * 1.1);
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, 6.5);
      rg.addColorStop(0, `rgba(${col}, ${(0.88 * twinkle).toFixed(3)})`);
      rg.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * twinkle).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawMoonAndBats(ctx, w, h, hol, dt, step, moonX, moonY, moonR) {
    const isHalo = hol.family === "halloween";
    const mGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.15, moonX, moonY, moonR * 2.1);
    mGrad.addColorStop(0, isHalo ? "rgba(255, 237, 213, 0.92)" : "rgba(254, 249, 195, 0.94)");
    mGrad.addColorStop(0.46, isHalo ? "rgba(251, 146, 60, 0.85)" : "rgba(253, 224, 71, 0.82)");
    mGrad.addColorStop(0.55, isHalo ? "rgba(249, 115, 22, 0.34)" : "rgba(253, 224, 71, 0.28)");
    mGrad.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.1, 0, Math.PI * 2);
    ctx.fill();

    if (isHalo) {
      if (this._bats.length === 0) {
        const count = w < 720 ? 3 : 6;
        for (let i = 0; i < count; i++) {
          this._bats.push({
            x: moonX + (Math.random() - 0.5) * 260,
            y: moonY + (Math.random() - 0.5) * 80,
            vx: (i % 2 === 0 ? 1 : -1) * (28 + Math.random() * 24),
            phase: i * 1.4
          });
        }
      }
      ctx.strokeStyle = "rgba(15, 23, 42, 0.72)";
      ctx.lineWidth = 1.6;
      this._bats.forEach((b, idx) => {
        b.phase += dt * 9;
        b.x += b.vx * dt;
        b.y += Math.sin(b.phase * 0.4 + idx) * 14 * dt;
        if (b.vx > 0 && b.x > w + 40) b.x = -40;
        if (b.vx < 0 && b.x < -40) b.x = w + 40;
        const flap = Math.sin(b.phase) * 4.5;
        ctx.beginPath();
        ctx.moveTo(b.x - 8, b.y + flap);
        ctx.quadraticCurveTo(b.x - 3, b.y - 4, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 3, b.y - 4, b.x + 8, b.y + flap);
        ctx.stroke();
      });
    }
  },

  _drawSantaSleighSilhouette(ctx, w, h, dt, step) {
    if (!this._sleigh) {
      this._sleighTimer -= dt;
      if (this._sleighTimer <= 0) {
        this._sleigh = { x: -120, y: h * 0.14, speed: w < 720 ? 64 : 88 };
      }
      return;
    }
    const sl = this._sleigh;
    sl.x += sl.speed * dt;
    const sy = sl.y + Math.sin(step * 1.8) * 6;
    ctx.save();
    ctx.translate(sl.x, sy);
    ctx.globalAlpha = 0.55;
    // Tiny sleigh body & 2 prancing reindeer + faint Rudolph red nose
    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.beginPath();
    ctx.roundRect(-24, -4, 16, 7, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-26, 4);
    ctx.quadraticCurveTo(-15, 6, -6, 2);
    ctx.stroke();
    [6, 22].forEach((rx, rIdx) => {
      const bob = Math.sin(step * 6 + rIdx) * 1.6;
      ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
      ctx.beginPath();
      ctx.ellipse(rx, -1 + bob, 4.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (rIdx === 1) {
        ctx.fillStyle = "rgba(248, 113, 113, 0.95)";
        ctx.beginPath();
        ctx.arc(rx + 4.8, -2 + bob, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    if (sl.x > w + 140) {
      this._sleigh = null;
      this._sleighTimer = 26 + Math.random() * 18;
    }
  },

  drawNatureOverlay(ctx, w, h, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol) return;
    const isDark = mode === "dark" || mode === "evening";
    const fam = hol.family;
    ctx.save();

    if (fam === "christmas") {
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._drawLightGarland(ctx, w * 0.04, 10, w * 0.96, 10, 14, w < 720 ? 10 : 18, step, ["239, 68, 68", "52, 211, 153", "250, 204, 21"]);
      this._drawSantaSleighSilhouette(ctx, w, h, dt, step);
    } else if (fam === "new_year" || fam === "national_day") {
      this._updateFireworks(ctx, w, h, hol, dt, null);
    } else if (fam === "halloween" || fam === "mid_autumn") {
      this._drawMoonAndBats(ctx, w, h, hol, dt, step, w * 0.82, h * 0.16, w < 720 ? 22 : 34);
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else {
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    }
    ctx.restore();
  },

  drawGatewayOverlay(ctx, w, h, L, pal, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol || !L) return;
    const isDark = pal ? pal.isNightLights : (mode === "dark" || mode === "evening");
    const fam = hol.family;
    ctx.save();

    if (fam === "christmas") {
      const warmCols = ["239, 68, 68", "52, 211, 153", "250, 204, 21", "96, 165, 250"];
      this._drawLightGarland(ctx, L.towerLeftX, L.padY - L.towerH * 0.72, L.towerRightX, L.padY - L.towerH * 0.72, 10, 7, step, warmCols);
      this._drawLightGarland(ctx, L.hangarX - L.hangarW * 0.42, L.hangarY - 6, L.hangarX + L.hangarW * 0.42, L.hangarY - 6, -12, 9, step, warmCols);
      // Spire topper golden star
      const sy = L.termY - 114 * L.termScale;
      const sg = ctx.createRadialGradient(L.termX, sy, 0, L.termX, sy, 14);
      sg.addColorStop(0, "rgba(254, 240, 138, 0.95)");
      sg.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(L.termX, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._drawSantaSleighSilhouette(ctx, w, h, dt, step);
    } else if (fam === "new_year" || fam === "national_day") {
      this._updateFireworks(ctx, w, h, hol, dt, L.islandTopY);
    } else if (fam === "halloween" || fam === "mid_autumn") {
      this._drawMoonAndBats(ctx, w, h, hol, dt, step, w * 0.84, L.horizonY * 0.56, w < 720 ? 20 : 32);
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else {
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    }
    ctx.restore();
  },

  drawDeepBlueOverlay(ctx, w, h, L, pal, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol || !L) return;
    const isDark = pal ? pal.isDark : (mode === "dark" || mode === "evening");
    const fam = hol.family;
    const s = L.s || 1;
    ctx.save();

    if (fam === "christmas") {
      const cols = ["239, 68, 68", "52, 211, 153", "250, 204, 21"];
      this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 8, step, cols);
      this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 8, step, cols);
      // Glowing miniature festive pine inside hydroponic dome
      ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
      ctx.beginPath();
      ctx.moveTo(L.domeX, L.domeY - 14 * s);
      ctx.lineTo(L.domeX - 9 * s, L.domeY + 4 * s);
      ctx.lineTo(L.domeX + 9 * s, L.domeY + 4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
      ctx.beginPath();
      ctx.arc(L.domeX, L.domeY - 15 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (fam === "new_year" || fam === "national_day") {
      this._updateFireworks(ctx, w, h, hol, dt, null);
    } else if (fam === "halloween") {
      // Glowing jack-o'-lantern orbs outside main hub & sunken shipwreck!
      const spots = [{ x: L.hubX - 42 * s, y: L.hubY + 10 * s }, ...(L.wreck && !L.isNarrow ? [{ x: L.wreck.x - 16 * L.wreck.scale, y: L.wreck.y - 22 * L.wreck.scale }] : [])];
      spots.forEach((pt, idx) => {
        const pulse = 0.72 + 0.28 * Math.sin(step * 4 + idx);
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 12 * s);
        g.addColorStop(0, `rgba(251, 146, 60, ${(0.88 * pulse).toFixed(3)})`);
        g.addColorStop(1, "rgba(249, 115, 22, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 12 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#EA580C";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.0 * s, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    }
    ctx.restore();
  }
};

window.HolidayThemes = HolidayThemes;
