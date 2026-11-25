/**
 * PETTR Main Application Controller
 */

// Global fetch interceptor ensuring all client API calls attach detected or travel timezone
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    options = options || {};
    const headers = new Headers(options.headers || {});
    let clientTz = "";
    try {
      clientTz = localStorage.getItem("pettr_custom_timezone") || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {}
    if (clientTz && !headers.has("X-Client-Timezone")) {
      headers.set("X-Client-Timezone", clientTz);
    }
    options.headers = headers;
    return originalFetch(url, options);
  };
})();

const App = {
  currentTab: "dashboard",
  networkStatus: null,
  lastSyncTime: Date.now(),

  init() {
    this.initTheme();
    this.bindNavigation();
    this.initTabIndicator();
    this.bindKeyboardShortcuts();
    this.bindHeaderScroll();
    this.initMissionClock();
    this.renderIcons();
    if (typeof CommandPalette !== "undefined") CommandPalette.init();
    if (typeof FocusCockpit !== "undefined") FocusCockpit.init();
    if (typeof EveningDebrief !== "undefined") EveningDebrief.init();
    if (typeof HoraceChat !== "undefined") HoraceChat.init();
    PinLock.init();
    this.loadProfileSettings();
  },

  updateHeaderClockVisibility() {
    const headerClock = document.getElementById("headerClockPill");
    if (!headerClock) return;

    const isDashboard = !this.currentTab || this.currentTab === "dashboard";

    if (!isDashboard) {
      // On non-dashboard tabs where the main mission clock is absent, display header clock
      headerClock.classList.add("visible");
      return;
    }

    // On dashboard tab:
    const missionClock = document.getElementById("missionClockWidget");
    if (!missionClock) {
      headerClock.classList.remove("visible");
      return;
    }

    const header = document.querySelector(".app-header");
    const headerBottom = header ? header.getBoundingClientRect().bottom : 80;
    const rect = missionClock.getBoundingClientRect();

    // Check if mission clock is rendered and visible in viewport
    const isClockInDOM = missionClock.offsetParent !== null;

    if (isClockInDOM) {
      // If any portion of the main mission clock is visible below sticky header, hide mini clock
      if (rect.bottom > headerBottom + 10) {
        headerClock.classList.remove("visible");
      } else {
        // Mission clock has completely scrolled off / behind sticky header
        headerClock.classList.add("visible");
      }
    } else {
      // Fallback while dashboard tab is mounting / reflowing:
      // if scrolled near top, mission clock is physically present at the top, so hide mini clock
      if (window.scrollY < 80) {
        headerClock.classList.remove("visible");
      } else {
        headerClock.classList.add("visible");
      }
    }
  },

  bindHeaderScroll() {
    let isCompact = false;
    let ticking = false;

    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const header = document.querySelector(".app-header");

          if (header) {
            // Hysteresis buffer prevents jitter: > 80px compacts, < 25px expands
            if (!isCompact && scrollY > 80) {
              isCompact = true;
              header.classList.add("header-compact");
            } else if (isCompact && scrollY < 25) {
              isCompact = false;
              header.classList.remove("header-compact");
            }
          }
          this.updateHeaderClockVisibility();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    setTimeout(() => this.updateHeaderClockVisibility(), 150);
  },

  _missionClockTimer: null,

  initMissionClock() {
    const update = () => {
      const now = new Date();
      const customTz = localStorage.getItem("pettr_custom_timezone");

      let hours24, minutes, seconds, ampm, hStr, mStr, sStr;
      let dayName, dayNum, monthName, yearNum, tzDisplay;

      if (customTz) {
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: customTz,
            hour12: false,
            year: "numeric",
            month: "short",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          });
          const parts = formatter.formatToParts(now);
          const partMap = {};
          parts.forEach(p => { partMap[p.type] = p.value; });

          hours24 = parseInt(partMap.hour, 10);
          if (hours24 === 24) hours24 = 0;
          minutes = parseInt(partMap.minute, 10) || 0;
          seconds = parseInt(partMap.second, 10) || 0;
          ampm = hours24 >= 12 ? "PM" : "AM";
          hStr = String(hours24).padStart(2, "0");
          mStr = String(minutes).padStart(2, "0");
          sStr = String(seconds).padStart(2, "0");

          dayName = (partMap.weekday || "").toUpperCase();
          dayNum = partMap.day;
          monthName = (partMap.month || "").toUpperCase();
          yearNum = partMap.year;

          const shortCity = customTz.split("/").pop().replace(/_/g, " ");
          tzDisplay = `${shortCity} [Travel]`;
        } catch (e) {
          console.warn("Invalid stored timezone:", customTz, e);
          localStorage.removeItem("pettr_custom_timezone");
        }
      }

      if (hours24 === undefined) {
        hours24 = now.getHours();
        minutes = now.getMinutes();
        seconds = now.getSeconds();

        ampm = hours24 >= 12 ? "PM" : "AM";
        hStr = String(hours24).padStart(2, "0");
        mStr = String(minutes).padStart(2, "0");
        sStr = String(seconds).padStart(2, "0");

        const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        dayName = days[now.getDay()];
        dayNum = now.getDate();
        monthName = months[now.getMonth()];
        yearNum = now.getFullYear();

        const offsetMin = -now.getTimezoneOffset();
        const offsetHours = Math.floor(Math.abs(offsetMin) / 60);
        const sign = offsetMin >= 0 ? "+" : "-";
        let tzName = "LOCAL";
        try {
          tzName = (Intl.DateTimeFormat().resolvedOptions().timeZone || "LOCAL").split("/").pop().replace(/_/g, " ");
        } catch (e) {}
        tzDisplay = `UTC${sign}${offsetHours} · ${tzName}`;
      }

      const elH = document.getElementById("missionClockHours");
      const elM = document.getElementById("missionClockMinutes");
      const elS = document.getElementById("missionClockSeconds");
      const elAmPm = document.getElementById("missionClockMeridiem");
      const elDate = document.getElementById("missionClockDateStr");
      const elTzText = document.getElementById("missionClockTzText");
      const elHeaderClock = document.getElementById("headerClockDigits");

      if (elH) elH.textContent = hStr;
      if (elM) elM.textContent = mStr;
      if (elS) elS.textContent = sStr;
      if (elAmPm) elAmPm.textContent = ampm;

      if (elDate) {
        elDate.textContent = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;
      }

      if (elTzText && elTzText.textContent !== tzDisplay) {
        elTzText.textContent = tzDisplay;
      }

      if (elHeaderClock) {
        elHeaderClock.textContent = `${hStr}:${mStr}:${sStr}`;
      }

      if (seconds === 0 && typeof EveningDebrief !== "undefined") {
        EveningDebrief.updateDebriefButtonState();
      }

      if (seconds === 0 && typeof Dashboard !== "undefined" && Dashboard.checkDiurnalTransition) {
        Dashboard.checkDiurnalTransition();
      }

      // Midnight day rollover: reload daily intel and typewriter greeting
      if (hours24 === 0 && minutes === 0 && seconds === 3) {
        if (typeof Dashboard !== "undefined" && Dashboard.startTypewriterGreeting) {
          Dashboard.startTypewriterGreeting();
        }
      }
    };

    update();
    if (this._missionClockTimer) clearInterval(this._missionClockTimer);
    this._missionClockTimer = setInterval(update, 1000);
  },

  promptSetTimezone() {
    this.openTimezoneModal();
  },

  promptSetTimezone() {
    this.openTimezoneModal();
  },

  openTimezoneModal() {
    const modal = document.getElementById("timezoneModal");
    if (modal) {
      modal.style.display = "flex";
      const input = document.getElementById("customTimezoneInput");
      const current = localStorage.getItem("pettr_custom_timezone") || "";
      if (input) input.value = current;
      this.renderIcons();
    }
  },

  closeTimezoneModal() {
    const modal = document.getElementById("timezoneModal");
    if (modal) modal.style.display = "none";
  },

  setTimezone(tz) {
    if (!tz) return;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      localStorage.setItem("pettr_custom_timezone", tz);
      this.closeTimezoneModal();
      this.showToast(`Mission Clock set to: ${tz}`);
      this.initMissionClock();
      this.renderIcons();
    } catch (e) {
      alert(`Invalid timezone: "${tz}". Please provide a valid IANA timezone format (e.g. Europe/Paris, Asia/Tokyo).`);
    }
  },

  applyCustomTimezoneInput() {
    const input = document.getElementById("customTimezoneInput");
    if (!input || !input.value.trim()) return;
    this.setTimezone(input.value.trim());
  },

  resetTimezoneToLocal() {
    localStorage.removeItem("pettr_custom_timezone");
    this.closeTimezoneModal();
    this.showToast("Mission Clock reset to system local timezone");
    this.initMissionClock();
    this.renderIcons();
  },

  getLocalDateString(dateObj = new Date()) {
    const customTz = localStorage.getItem("pettr_custom_timezone");
    if (customTz) {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: customTz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).formatToParts(dateObj);
        const y = parts.find(p => p.type === "year")?.value;
        const m = parts.find(p => p.type === "month")?.value;
        const d = parts.find(p => p.type === "day")?.value;
        if (y && m && d) return `${y}-${m}-${d}`;
      } catch (e) {}
    }
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  renderIcons() {
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  },

  getDiurnalTheme(hour) {
    if (hour >= 6 && hour < 12) {
      return { theme: "morning", label: "Dawn" };
    } else if (hour >= 12 && hour < 17) {
      return { theme: "light", label: "Afternoon" };
    } else if (hour >= 17 && hour < 21) {
      return { theme: "evening", label: "Golden Hour" };
    } else {
      return { theme: "dark", label: "Night" };
    }
  },

  getAccessibleAccentColor(rawColor, fallback = "#3b82f6") {
    const hexStr = String(rawColor || fallback || "#3b82f6").trim();
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hexStr);
    if (!m) return fallback;
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    let r = parseInt(h.slice(0, 2), 16);
    let g = parseInt(h.slice(2, 4), 16);
    let b = parseInt(h.slice(4, 6), 16);

    const theme = document.documentElement.getAttribute("data-theme") || "light";
    const isDark = theme === "dark" || theme === "evening";
    const toLin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);

    if (!isDark && lum > 0.36) {
      // Darken very light/white/pastel markers toward deep slate so they stay sharp on light & dawn cards
      const t = Math.min(0.78, 0.38 + (lum - 0.36) * 0.65);
      r = Math.round(r * (1 - t) + 15 * t);
      g = Math.round(g * (1 - t) + 23 * t);
      b = Math.round(b * (1 - t) + 42 * t);
    } else if (isDark && lum < 0.28) {
      // Lift black, charcoal, and deep dark hues so they remain bright and crisp on dark & evening cards
      const t = Math.min(0.84, 0.56 + (0.28 - lum) * 1.05);
      const liftR = theme === "evening" ? 254 : 236;
      const liftG = theme === "evening" ? 243 : 242;
      const liftB = theme === "evening" ? 199 : 250;
      r = Math.round(r * (1 - t) + liftR * t);
      g = Math.round(g * (1 - t) + liftG * t);
      b = Math.round(b * (1 - t) + liftB * t);
    }
    return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
  },

  refreshAccessibleProjectTags() {
    document.querySelectorAll(".project-tag[data-raw-tag-color]").forEach(el => {
      const raw = el.getAttribute("data-raw-tag-color");
      if (raw) {
        el.style.setProperty("--tag-color", this.getAccessibleAccentColor(raw));
      }
    });
  },

  escapeJsAttr(value) {
    return JSON.stringify(String(value ?? ""))
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  },

  getWorld() {
    const attr = document.documentElement.getAttribute("data-world");
    if (attr === "nature" || attr === "gateway" || attr === "deep-blue") return attr;
    try {
      const saved = localStorage.getItem("pettr_theme_world");
      if (saved === "nature" || saved === "gateway" || saved === "deep-blue") return saved;
    } catch (_) {}
    return "nature";
  },

  applyEffectiveWorld(world) {
    const valid = (world === "gateway" || world === "deep-blue") ? world : "nature";
    document.documentElement.setAttribute("data-world", valid);
    if (document.body) {
      document.body.setAttribute("data-world", valid);
    }
    this.syncWorldSelectorUI(valid);

    if (typeof WaveCanvas !== "undefined") {
      try {
        if (!WaveCanvas.ctx) {
          WaveCanvas.init();
        } else {
          WaveCanvas.draw(0.016);
        }
      } catch (e) {}
    }

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        this.updateTabIndicator(true);
        this.refreshAccessibleProjectTags();
      });
    } else {
      this.refreshAccessibleProjectTags();
    }
  },

  WORLD_BACKDROP_DEFAULTS: {
    nature: { blur: 0, dim: 0 },
    gateway: { blur: 30, dim: 30 },
    "deep-blue": { blur: 30, dim: 10 }
  },

  getWorldBackdropDefaults(world = null) {
    const target = world || this.getWorld();
    const valid = (target === "gateway" || target === "deep-blue") ? target : "nature";
    return { ...this.WORLD_BACKDROP_DEFAULTS[valid] };
  },

  setWorld(world, notify = true) {
    const valid = (world === "gateway" || world === "deep-blue") ? world : "nature";
    try {
      localStorage.setItem("pettr_theme_world", valid);
      localStorage.removeItem(`pettr_world_blur_v13_${valid}`);
      localStorage.removeItem(`pettr_world_dim_v13_${valid}`);
    } catch (_) {}
    this.applyEffectiveWorld(valid);
    const defs = this.getWorldBackdropDefaults(valid);
    this.setBackdropBlur(defs.blur, false);
    this.setBackdropDim(defs.dim, false);

    if (notify) {
      const labels = {
        nature: "Nature",
        gateway: "Gateway (Spaceport)",
        "deep-blue": "Deep Blue (Underwater)"
      };
      this.haptic("light");
      this.showToast(`Theme: ${labels[valid] || valid}`, 1800);
    }
    this.renderIcons();
  },

  syncWorldSelectorUI(activeWorld = null) {
    const current = activeWorld || this.getWorld();
    document.querySelectorAll(".world-selector-card[data-world-option]").forEach(btn => {
      const isMatch = btn.dataset.worldOption === current;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });
    document.querySelectorAll(".scenic-world-dot[data-scenic-world]").forEach(btn => {
      const isMatch = btn.dataset.scenicWorld === current;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });
  },

  isScenicMode: false,

  enterScenicMode({ fromCockpit = false } = {}) {
    this.isScenicMode = true;
    this.closeThemeSlider();
    this.closeScenicTimePopover();
    if (typeof HoraceChat !== "undefined" && HoraceChat.isOpen) {
      HoraceChat.close();
    }
    document.body.classList.add("scenic-hidden-mode");
    const restoreBar = document.getElementById("scenicRestoreBar");
    if (restoreBar) restoreBar.style.display = "flex";
    this.syncWorldSelectorUI();
    this.syncScenicTimeUI();

    if (typeof FocusCockpit !== "undefined") {
      if (!fromCockpit) {
        if (!FocusCockpit.activeTask) {
          FocusCockpit.activeTask = FocusCockpit.resolveActiveTask();
        }
        FocusCockpit.updateMiniDisplays();
      }
    }
    this.renderIcons();
    if (!fromCockpit) this.haptic("light");
  },

  exitScenicMode() {
    this.isScenicMode = false;
    this.closeScenicTimePopover();
    document.body.classList.remove("scenic-hidden-mode");
    const restoreBar = document.getElementById("scenicRestoreBar");
    if (restoreBar) restoreBar.style.display = "none";

    if (typeof FocusCockpit !== "undefined") {
      const modal = document.getElementById("focusCockpitModal");
      if (modal && modal.style.display !== "none") {
        modal.style.display = "none";
        document.body.classList.remove("cockpit-active");
        if (FocusCockpit.hasStarted || FocusCockpit.isRunning) {
          FocusCockpit.isMinimized = true;
        }
      }
      FocusCockpit.updateMiniDisplays();
    }
    this.haptic("light");
  },

  toggleScenicMode() {
    if (this.isScenicMode) {
      this.exitScenicMode();
    } else {
      this.enterScenicMode();
    }
  },

  applyEffectiveTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) {
      document.body.setAttribute("data-theme", theme);
    }

    if (typeof WaveCanvas !== "undefined") {
      try {
        if (!WaveCanvas.ctx) {
          WaveCanvas.init();
        } else {
          WaveCanvas.draw(0.016);
        }
      } catch (e) {}
    }

    this.syncScenicTimeUI(theme);

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => {
        this.updateTabIndicator(true);
        this.refreshAccessibleProjectTags();
      });
    } else {
      this.refreshAccessibleProjectTags();
    }
  },

  backdropBlur: 0,
  backdropDim: 0,
  backdropFrost: 0,

  initBackdropFrost(world = null) {
    const activeWorld = world || this.getWorld();
    const defs = this.getWorldBackdropDefaults(activeWorld);
    let savedBlur = defs.blur;
    let savedDim = defs.dim;
    try {
      const rawBlur = localStorage.getItem(`pettr_world_blur_v13_${activeWorld}`);
      if (rawBlur !== null && rawBlur !== "") {
        const parsedBlur = parseInt(rawBlur, 10);
        if (!isNaN(parsedBlur)) savedBlur = parsedBlur;
      }
      const rawDim = localStorage.getItem(`pettr_world_dim_v13_${activeWorld}`);
      if (rawDim !== null && rawDim !== "") {
        const parsedDim = parseInt(rawDim, 10);
        if (!isNaN(parsedDim)) savedDim = parsedDim;
      }
    } catch (_) {}
    this.setBackdropBlur(savedBlur, false);
    this.setBackdropDim(savedDim, false);
  },

  setBackdropBlur(val, persist = true) {
    const defs = this.getWorldBackdropDefaults();
    const raw = (val === undefined || val === null || val === "") ? defs.blur : Number(val);
    const pct = Math.max(0, Math.min(100, Math.round(isNaN(raw) ? defs.blur : raw)));
    this.backdropBlur = pct;
    this.backdropFrost = pct;
    if (persist) {
      const activeWorld = this.getWorld();
      try {
        localStorage.setItem(`pettr_world_blur_v13_${activeWorld}`, String(pct));
        localStorage.setItem("pettr_backdrop_blur", String(pct));
        localStorage.setItem("pettr_backdrop_frost", String(pct));
      } catch (_) {}
    }

    const blurPx = ((pct / 100) * 18).toFixed(1);
    document.documentElement.style.setProperty("--backdrop-frost-blur", `${blurPx}px`);
    const frostEl = document.getElementById("universalBackdropFrost");
    if (frostEl) {
      frostEl.style.setProperty("--backdrop-frost-blur", `${blurPx}px`);
    }

    ["themeBackdropSlider", "scenicBackdropSlider"].forEach(id => {
      const sl = document.getElementById(id);
      if (sl && sl.value !== String(pct)) sl.value = String(pct);
    });
    ["themeBackdropValue", "scenicBackdropValue"].forEach(id => {
      const lbl = document.getElementById(id);
      if (lbl) lbl.textContent = `${pct}%`;
    });
  },

  setBackdropDim(val, persist = true) {
    const defs = this.getWorldBackdropDefaults();
    const raw = (val === undefined || val === null || val === "") ? defs.dim : Number(val);
    const pct = Math.max(0, Math.min(100, Math.round(isNaN(raw) ? defs.dim : raw)));
    this.backdropDim = pct;
    if (persist) {
      const activeWorld = this.getWorld();
      try {
        localStorage.setItem(`pettr_world_dim_v13_${activeWorld}`, String(pct));
        localStorage.setItem("pettr_backdrop_dim", String(pct));
      } catch (_) {}
    }

    const dimAlpha = (Math.pow(pct / 100, 1.15) * 0.72).toFixed(3);
    document.documentElement.style.setProperty("--backdrop-frost-dim", dimAlpha);
    const frostEl = document.getElementById("universalBackdropFrost");
    if (frostEl) {
      frostEl.style.setProperty("--backdrop-frost-dim", dimAlpha);
    }

    ["themeBackdropDimSlider", "scenicBackdropDimSlider"].forEach(id => {
      const sl = document.getElementById(id);
      if (sl && sl.value !== String(pct)) sl.value = String(pct);
    });
    ["themeBackdropDimValue", "scenicBackdropDimValue"].forEach(id => {
      const lbl = document.getElementById(id);
      if (lbl) lbl.textContent = `${pct}%`;
    });
  },

  setBackdropFrost(val, persist = true) {
    return this.setBackdropBlur(val, persist);
  },

  initTheme() {
    const savedWorld = localStorage.getItem("pettr_theme_world") || "nature";
    this.applyEffectiveWorld(savedWorld);
    this.initBackdropFrost();

    const savedMode = localStorage.getItem("pettr_theme_mode") || "auto";
    if (savedMode === "slider") {
      const savedHour = parseInt(localStorage.getItem("pettr_theme_slider_hour") || new Date().getHours(), 10);
      const { theme } = this.getDiurnalTheme(savedHour);
      this.applyEffectiveTheme(theme);
    } else {
      this.setTheme(savedMode, false);
    }

    // Solar transition check every 1 minute for automatic gradual sunset/sunrise transitions
    setInterval(() => {
      if ((localStorage.getItem("pettr_theme_mode") || "auto") === "auto") {
        const currentHour = new Date().getHours();
        const { theme } = this.getDiurnalTheme(currentHour);
        this.applyEffectiveTheme(theme);
      }
    }, 60000);
  },

  setTheme(mode, notify = true) {
    localStorage.setItem("pettr_theme_mode", mode);

    // Update switcher buttons UI
    document.querySelectorAll(".theme-switcher-control .theme-btn").forEach(btn => {
      const modeKey = mode.charAt(0).toUpperCase() + mode.slice(1);
      if (btn.id === `themeBtn${modeKey}` || btn.dataset.themeSet === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    let effectiveTheme = mode;
    if (mode === "auto") {
      const currentHour = new Date().getHours();
      effectiveTheme = this.getDiurnalTheme(currentHour).theme;
    }

    this.applyEffectiveTheme(effectiveTheme);

    // If slider drawer was open, sync slider value to current effective hour
    const slider = document.getElementById("themeHourSlider");
    if (slider) {
      const curH = new Date().getHours();
      slider.value = curH;
      this.updateThemeSliderLabel(curH);
    }

    this.syncScenicTimeUI(effectiveTheme);

    if (notify) {
      this.haptic("light");
      this.showToast(`Theme updated: ${mode.toUpperCase()} mode active`);
    }

    this.renderIcons();
  },

  closeScenicTimePopover() {
    const pop = document.getElementById("scenicTimePopover");
    if (pop && pop.style.display !== "none") {
      pop.style.display = "none";
    }
    const btn = document.getElementById("scenicTimeToggleBtn");
    if (btn) btn.setAttribute("aria-expanded", "false");
  },

  toggleScenicTimePopover() {
    const pop = document.getElementById("scenicTimePopover");
    if (!pop) return;
    const isShown = pop.style.display !== "none";
    pop.style.display = isShown ? "none" : "block";
    const btn = document.getElementById("scenicTimeToggleBtn");
    if (btn) btn.setAttribute("aria-expanded", isShown ? "false" : "true");
    if (!isShown) {
      this.syncScenicTimeUI();
      if (pop.querySelector("[data-lucide]")) {
        this.renderIcons();
      }
    }
  },

  syncScenicTimeUI(forcedTheme = null) {
    let savedMode = "auto";
    let savedSliderHour = NaN;
    try {
      savedMode = localStorage.getItem("pettr_theme_mode") || "auto";
      savedSliderHour = parseInt(localStorage.getItem("pettr_theme_slider_hour") || "", 10);
    } catch (_) {}

    const effectiveTheme = forcedTheme || document.documentElement.getAttribute("data-theme") || "light";
    const presetHours = { morning: 8, light: 13, evening: 18, dark: 23 };
    let activeHour = new Date().getHours();
    if (savedMode === "slider" && !isNaN(savedSliderHour)) {
      activeHour = Math.max(0, Math.min(23, savedSliderHour));
    } else if (savedMode !== "auto" && presetHours[effectiveTheme] !== undefined) {
      activeHour = presetHours[effectiveTheme];
    }

    const slider = document.getElementById("scenicHourSlider");
    if (slider) slider.value = activeHour;

    const shortLabels = {
      morning: "Dawn",
      light: "Noon",
      evening: "Golden",
      dark: "Night"
    };
    const btnLabel = document.getElementById("scenicTimeBtnLabel");
    if (btnLabel) {
      btnLabel.textContent = savedMode === "auto" ? "Auto" : (shortLabels[effectiveTheme] || "Solar");
    }

    const popLabel = document.getElementById("scenicTimePopoverLabel");
    if (popLabel) {
      const { label } = this.getDiurnalTheme(activeHour);
      popLabel.textContent = `${String(activeHour).padStart(2, "0")}:00 · ${label}`;
    }

    const autoBtn = document.getElementById("scenicThemeAutoBtn");
    if (autoBtn) {
      const isAuto = savedMode === "auto";
      autoBtn.classList.toggle("active", isAuto);
      autoBtn.setAttribute("aria-pressed", isAuto ? "true" : "false");
    }

    document.querySelectorAll(".scenic-diurnal-chip[data-scenic-diurnal]").forEach(btn => {
      const isMatch = btn.dataset.scenicDiurnal === effectiveTheme;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });

    const scenicBlurSlider = document.getElementById("scenicBackdropSlider");
    if (scenicBlurSlider) scenicBlurSlider.value = String(this.backdropBlur ?? 20);
    const scenicBlurVal = document.getElementById("scenicBackdropValue");
    if (scenicBlurVal) scenicBlurVal.textContent = `${this.backdropBlur ?? 20}%`;
    const scenicDimSlider = document.getElementById("scenicBackdropDimSlider");
    if (scenicDimSlider) scenicDimSlider.value = String(this.backdropDim ?? 0);
    const scenicDimVal = document.getElementById("scenicBackdropDimValue");
    if (scenicDimVal) scenicDimVal.textContent = `${this.backdropDim ?? 0}%`;
  },

  closeThemeSlider() {
    const drawer = document.getElementById("themeSliderDrawer");
    if (drawer && drawer.style.display !== "none") {
      drawer.style.display = "none";
    }
  },

  toggleThemeSlider() {
    const drawer = document.getElementById("themeSliderDrawer");
    if (!drawer) return;
    const isShown = drawer.style.display !== "none";
    drawer.style.display = isShown ? "none" : "block";
    if (!isShown) {
      this.syncWorldSelectorUI();
      this.setBackdropBlur(this.backdropBlur, false);
      this.setBackdropDim(this.backdropDim, false);
      const savedMode = localStorage.getItem("pettr_theme_mode") || "auto";
      const currentHour = savedMode === "slider"
        ? parseInt(localStorage.getItem("pettr_theme_slider_hour") || new Date().getHours(), 10)
        : new Date().getHours();
      const slider = document.getElementById("themeHourSlider");
      if (slider) {
        slider.value = currentHour;
        this.updateThemeSliderLabel(currentHour);
      }
      if (drawer.querySelector("[data-lucide]")) {
        this.renderIcons();
      }
    }
  },

  updateThemeSliderLabel(hour) {
    const labelEl = document.getElementById("themeSliderLabel");
    if (!labelEl) return;
    const { label } = this.getDiurnalTheme(parseInt(hour, 10));
    labelEl.textContent = `${String(hour).padStart(2, "0")}:00 · ${label}`;
  },

  onThemeSliderInput(hour) {
    const h = parseInt(hour, 10);
    this.updateThemeSliderLabel(h);
    const { theme } = this.getDiurnalTheme(h);
    localStorage.setItem("pettr_theme_mode", "slider");
    localStorage.setItem("pettr_theme_slider_hour", String(h));
    this.applyEffectiveTheme(theme);

    // Deselect other preset buttons
    document.querySelectorAll(".theme-switcher-control .theme-btn").forEach(btn => {
      if (btn.id !== "themeBtnSliderToggle") btn.classList.remove("active");
    });
  },

  setThemeHourPreset(hour) {
    const slider = document.getElementById("themeHourSlider");
    if (slider) slider.value = hour;
    const scenicSlider = document.getElementById("scenicHourSlider");
    if (scenicSlider) scenicSlider.value = hour;
    this.onThemeSliderInput(hour);
  },

  haptic(type = "light") {
    if (!navigator.vibrate) return;
    try {
      if (type === "light") navigator.vibrate(12);
      else if (type === "medium") navigator.vibrate(25);
      else if (type === "success") navigator.vibrate([15, 30, 20]);
      else if (type === "warning") navigator.vibrate([40, 40, 40]);
    } catch (e) {}
  },

  voiceRecognition: null,
  isRecordingVoice: false,
  _voiceSession: null,

  stopVoiceInput(manual = true) {
    if (this._voiceSession) {
      this._voiceSession.manualStop = manual;
    }
    if (this.voiceRecognition) {
      try {
        this.voiceRecognition.stop();
      } catch (_) {
        try { this.voiceRecognition.abort(); } catch (__) {}
      }
    }
    this.isRecordingVoice = false;
    const btn = document.getElementById("voiceInputBtn");
    if (btn) btn.classList.remove("recording");
    const input = document.getElementById("quickInput");
    if (input && this._voiceSession && this._voiceSession.origPlaceholder !== undefined) {
      input.placeholder = this._voiceSession.origPlaceholder;
    }
  },

  toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.", 4000, true);
      return;
    }

    const btn = document.getElementById("voiceInputBtn");
    const input = document.getElementById("quickInput");

    if (this.isRecordingVoice && this.voiceRecognition) {
      this.stopVoiceInput(true);
      this.haptic("light");
      return;
    }

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const isSecure = window.isSecureContext || isLocalhost;

    // Check Secure Context requirement:
    // Web Speech API is blocked by browsers on unencrypted HTTP connections (other than localhost)
    if (!isSecure) {
      this.haptic("warning");
      this.showToast("Voice input requires HTTPS or localhost. Opening troubleshooting.", 5000, true);
      this.openVoiceTroubleshootModal("insecure");
      return;
    }

    // Ensure no stale recognition instance is holding the OS microphone handle
    if (this.voiceRecognition) {
      try { this.voiceRecognition.abort(); } catch (_) {}
      this.voiceRecognition = null;
    }

    const existingPrefix = input && input.value.trim() ? `${input.value.trim()} ` : "";
    const origPlaceholder = input ? input.placeholder : "";
    const session = {
      gotResult: false,
      manualStop: false,
      errorCode: null,
      origPlaceholder
    };
    this._voiceSession = session;

    // Start SpeechRecognition synchronously inside the click gesture without
    // pre-opening/closing getUserMedia (which races the audio hardware lock and
    // breaks synchronous user activation in Chromium/Edge/Safari).
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = navigator.language || "en-US";

      recognition.onstart = () => {
        if (this._voiceSession !== session) return;
        this.isRecordingVoice = true;
        if (btn) btn.classList.add("recording");
        if (input) input.placeholder = "Listening... speak clearly, tap mic again when done";
        this.haptic("medium");
        this.showToast("🎙️ Listening... Speak now (tap mic again to stop)", 3200);
      };

      recognition.onresult = (event) => {
        if (this._voiceSession !== session) return;
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < event.results.length; i++) {
          const chunk = event.results[i][0] ? event.results[i][0].transcript : "";
          if (event.results[i].isFinal) {
            finalText += chunk;
          } else {
            interimText += chunk;
          }
        }
        const combined = `${existingPrefix}${finalText}${interimText}`.trimStart();
        if (combined.length > 0) {
          session.gotResult = true;
        }
        if (input) {
          input.value = combined;
        }
      };

      recognition.onerror = (event) => {
        if (this._voiceSession !== session) return;
        const errCode = event.error || "unknown";
        session.errorCode = errCode;
        console.warn("Speech recognition error:", errCode);

        this.isRecordingVoice = false;
        if (btn) btn.classList.remove("recording");
        if (input && session.origPlaceholder !== undefined) {
          input.placeholder = session.origPlaceholder;
        }

        if (session.manualStop || errCode === "aborted") {
          return;
        }

        this.haptic("warning");
        if (errCode === "not-allowed" || errCode === "permission-denied") {
          this.showToast("Microphone access blocked. Check site & OS permissions.", 5000, true);
          this.openVoiceTroubleshootModal("denied");
        } else if (errCode === "no-speech") {
          this.showToast("No speech heard — verify your active input mic in system Sound settings.", 4500, true);
        } else if (errCode === "audio-capture") {
          this.showToast("Microphone unavailable or busy in another app.", 4500, true);
          this.openVoiceTroubleshootModal("audio-capture");
        } else if (errCode === "network") {
          this.showToast("Speech service network error: browser speech backend could not be reached.", 5000, true);
          this.openVoiceTroubleshootModal("network");
        } else if (errCode === "service-not-allowed") {
          this.showToast("Browser disabled speech recognition service.", 5000, true);
          this.openVoiceTroubleshootModal("service");
        } else {
          this.showToast(`Voice input error: ${errCode}`, 3500, true);
        }
      };

      recognition.onend = () => {
        if (this._voiceSession !== session) return;
        this.isRecordingVoice = false;
        if (btn) btn.classList.remove("recording");
        if (input && session.origPlaceholder !== undefined) {
          input.placeholder = session.origPlaceholder;
        }
        if (session.gotResult) {
          this.haptic("success");
          if (input && input.value.trim()) input.focus();
        } else if (!session.manualStop && !session.errorCode) {
          this.haptic("warning");
          this.showToast("Voice dictation ended with no speech registered — tap mic to retry or check system mic.", 4500, true);
        }
      };

      this.voiceRecognition = recognition;
      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition startup error:", err);
      this.isRecordingVoice = false;
      if (btn) btn.classList.remove("recording");
      if (input && origPlaceholder !== undefined) input.placeholder = origPlaceholder;
      this.showToast("Could not start voice recognition.", 3500, true);
    }
  },

  openVoiceTroubleshootModal(reason = "denied") {
    const modal = document.getElementById("voiceTroubleshootModal");
    if (!modal) return;

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const isSecure = window.isSecureContext || isLocalhost;
    const currentOrigin = window.location.origin;
    const proto = window.location.protocol.replace(":", "").toUpperCase();

    const protoEl = document.getElementById("voiceEnvProto");
    const secureEl = document.getElementById("voiceEnvSecure");
    const originEl = document.getElementById("voiceEnvOrigin");
    const noticeEl = document.getElementById("voiceDiagNotice");
    const instructionsEl = document.getElementById("voiceFixInstructions");

    if (protoEl) protoEl.textContent = proto;
    if (secureEl) {
      secureEl.textContent = isSecure ? "Secure (Allowed)" : "Insecure HTTP (Blocked)";
      secureEl.style.color = isSecure ? "var(--normal-green)" : "var(--urgent-orange)";
    }
    if (originEl) originEl.textContent = currentOrigin;

    if (!isSecure || reason === "insecure") {
      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--urgent-orange); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="shield-alert" style="width:15px;height:15px;"></i> Browser Restriction: Insecure HTTP Origin
          </div>
          <div style="color:var(--text-muted); line-height:1.5;">
            Modern browsers (Chrome, Edge, Safari) strictly disable microphone access and Web Speech API on unencrypted network connections (like LAN IPs or remote servers) to safeguard audio privacy.
          </div>
        `;
      }

      if (instructionsEl) {
        instructionsEl.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">
            <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:6px;">
              ⚡ Quick Fix: Enable Chrome / Edge LAN Flag (Mobile & Desktop)
            </div>
            <ol style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text-muted); line-height:1.65;">
              <li>Open a new tab and paste this into the address bar:
                <br><code style="font-family:var(--font-mono); color:var(--accent-cyan); background:var(--bg-secondary); padding:2px 5px; border-radius:3px;">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
              </li>
              <li>Toggle the flag to <strong>Enabled</strong>.</li>
              <li>Paste your PETTR URL into the text box below the flag:
                <div style="display:flex; gap:6px; margin:6px 0;">
                  <input type="text" readonly value="${currentOrigin}" style="flex:1; font-family:var(--font-mono); font-size:11.5px; padding:4px 8px; background:var(--bg-secondary); border:1px solid var(--card-border); border-radius:4px; color:var(--text-main);">
                  <button type="button" class="action-icon-btn" onclick="navigator.clipboard.writeText('${currentOrigin}'); App.showToast('Copied address!')" style="font-size:11.5px; padding:4px 10px; font-weight:600;">Copy</button>
                </div>
              </li>
              <li>Tap <strong>Relaunch</strong> at the bottom of Chrome. Voice input and microphone will immediately work!</li>
            </ol>
          </div>
          <div style="background:var(--bg-card); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:10px 14px;">
            <div style="font-weight:700; font-size:12.5px; color:var(--text-main); margin-bottom:4px;">
              🔒 Permanent Solutions:
            </div>
            <ul style="margin:0; padding-left:18px; font-size:12px; color:var(--text-muted); line-height:1.6;">
              <li>On the host server PC, access PETTR via <code style="font-family:var(--font-mono); color:var(--focus-indigo);">http://localhost:8000</code>. Localhost is always treated as secure.</li>
              <li>If using Tailscale, run <code style="font-family:var(--font-mono); color:var(--focus-indigo);">tailscale serve 8000</code> to generate an automatic HTTPS certificate.</li>
            </ul>
          </div>
        `;
      }
    } else if (reason === "network" || reason === "service" || reason === "audio-capture") {
      const diagTitle = reason === "network"
        ? "Speech Service Unreachable (Network / Browser Engine)"
        : (reason === "service"
          ? "Browser Speech Service Disabled"
          : "Microphone Audio Capture Unavailable");
      const diagDesc = reason === "network"
        ? "Your microphone permission is enabled, but the browser's built-in Speech Recognition backend could not reach its transcription service (common in Brave, offline LANs, or firewall-filtered browsers)."
        : (reason === "service"
          ? "The browser blocked the Web Speech API service even though microphone permission is granted (check privacy shields or Chrome/Edge speech settings)."
          : "No active audio signal reached the browser. Another app may hold exclusive access, or the OS default input device is muted.");
      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--urgent-orange); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="alert-circle" style="width:15px;height:15px;"></i> ${diagTitle}
          </div>
          <div style="color:var(--text-muted); line-height:1.5;">${diagDesc}</div>
        `;
      }
      if (instructionsEl) {
        instructionsEl.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">
            <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:6px;">
              🛠️ Checklist When Permissions Are Already Enabled:
            </div>
            <ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text-muted); line-height:1.65;">
              <li>Use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on desktop/mobile — privacy browsers like Brave/Firefox block Chromium Web Speech servers even with mic permission enabled.</li>
              <li>Verify your OS <strong>Default Input Device</strong> in Sound Settings (click <em>Test Microphone Access</em> below to see which hardware mic responds and verify live signal).</li>
              <li>Ensure your browser can reach its speech endpoint (or disable strict shields / VPN split-tunneling on this origin).</li>
            </ul>
          </div>
        `;
      }
    } else {
      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--urgent-orange); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="lock" style="width:15px;height:15px;"></i> Microphone Permission Blocked in Browser
          </div>
          <div style="color:var(--text-muted); line-height:1.5;">
            Your browser denied microphone access for this site. You can unblock it in site permissions in just a few seconds.
          </div>
        `;
      }

      if (instructionsEl) {
        instructionsEl.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--card-border); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:12px;">
            <div style="font-weight:700; font-size:13px; color:var(--text-main); margin-bottom:6px;">
              🔓 How to Unblock Microphone in Your Browser:
            </div>
            <ol style="margin:0; padding-left:18px; font-size:12.5px; color:var(--text-muted); line-height:1.65;">
              <li>Look at the top address bar next to the website address and click/tap the <strong>lock icon (🔒)</strong> or <strong>tune/settings icon (🎛️)</strong>.</li>
              <li>Select <strong>Site Settings</strong> or find <strong>Microphone</strong>.</li>
              <li>Change the dropdown or toggle from <strong>Block</strong> to <strong>Allow</strong>.</li>
              <li>Refresh the page and tap the microphone button again.</li>
            </ol>
          </div>
          <div style="font-size:12px; color:var(--text-dim); line-height:1.5;">
            💡 <em>Note: If you are on Windows, macOS, or iOS, ensure your operating system has enabled microphone permissions for your browser app in system settings.</em>
          </div>
        `;
      }
    }

    modal.style.display = "flex";
    this.renderIcons();
  },

  closeVoiceTroubleshootModal() {
    const modal = document.getElementById("voiceTroubleshootModal");
    if (modal) modal.style.display = "none";
  },

  async testMicrophoneDiagnostics() {
    const btn = document.getElementById("voiceTestMicBtn");
    const noticeEl = document.getElementById("voiceDiagNotice");
    if (btn) btn.disabled = true;

    try {
      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; color:var(--focus-indigo); font-weight:600;">
            <i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> Probing microphone hardware and browser permissions...
          </div>
        `;
        this.renderIcons();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices.getUserMedia is unavailable (Insecure Context or unsupported browser).");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      const deviceLabel = (track && track.label) ? track.label : "Default system microphone";

      let peakLevel = null;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          let maxVal = 0;
          await new Promise(resolve => {
            const sampleEnd = Date.now() + 550;
            const step = () => {
              analyser.getByteTimeDomainData(buf);
              for (let i = 0; i < buf.length; i++) {
                const deviation = Math.abs(buf[i] - 128);
                if (deviation > maxVal) maxVal = deviation;
              }
              if (Date.now() < sampleEnd) requestAnimationFrame(step);
              else resolve();
            };
            step();
          });
          peakLevel = maxVal;
          try { source.disconnect(); } catch (_) {}
          try { await ctx.close(); } catch (_) {}
        }
      } catch (_) {}

      stream.getTracks().forEach(t => t.stop());

      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--normal-green); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="check-circle-2" style="width:15px;height:15px;"></i> Microphone Access Verified
          </div>
          <div style="color:var(--text-main); font-size:12px; line-height:1.5;">
            Active input: <strong>${deviceLabel.replace(/</g, "&lt;")}</strong>
            ${peakLevel !== null ? `<br>Live signal check: ${peakLevel > 1 ? `<span style="color:var(--normal-green);font-weight:600;">Audio detected (peak ${peakLevel}/128)</span>` : `<span style="color:var(--urgent-orange);font-weight:600;">Near-silent (${peakLevel}/128) — verify input is not muted</span>`}` : ''}
          </div>
        `;
        this.renderIcons();
      }
      this.showToast("Microphone access verified!", 3500);
    } catch (e) {
      console.warn("Diagnostics failed:", e);
      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--urgent-orange); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="alert-triangle" style="width:15px;height:15px;"></i> Test Failed: ${e.name || 'Error'}
          </div>
          <div style="color:var(--text-muted); font-size:12px; line-height:1.5;">
            ${e.message || 'Microphone could not be accessed. Follow the instructions below.'}
          </div>
        `;
        this.renderIcons();
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  activeGuideTrack: "user",
  lastGuideSectionByTrack: { user: "quickstart", dev: "styleguide" },

  switchGuideTrack(track, btnEl) {
    const cleanTrack = track === "dev" ? "dev" : "user";
    this.activeGuideTrack = cleanTrack;

    document.querySelectorAll(".guide-track-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.guideTrack === cleanTrack);
    });
    if (btnEl) btnEl.classList.add("active");

    const titleEl = document.getElementById("guideHeaderTitle");
    const subEl = document.getElementById("guideHeaderSubtitle");
    if (cleanTrack === "dev") {
      if (titleEl) titleEl.textContent = "For Development";
      if (subEl) subEl.textContent = "Style guide, typography, Docker deployment, hardware tuning & SQLite backup internals.";
    } else {
      if (titleEl) titleEl.textContent = "User Guide";
      if (subEl) subEl.textContent = "Workflows, focus systems, notes organisation, and daily rituals.";
    }

    const navLinks = Array.from(document.querySelectorAll("#guideSidebarNav .guide-nav-link"));
    navLinks.forEach(link => {
      const matches = (link.dataset.guideTrack || "user") === cleanTrack;
      link.style.display = matches ? "" : "none";
    });

    const preferredKey = (this.lastGuideSectionByTrack && this.lastGuideSectionByTrack[cleanTrack])
      || (cleanTrack === "dev" ? "styleguide" : "quickstart");
    const targetBtn = navLinks.find(l => (l.dataset.guideTrack || "user") === cleanTrack && l.dataset.guideSection === preferredKey)
      || navLinks.find(l => (l.dataset.guideTrack || "user") === cleanTrack);

    if (targetBtn) {
      this.switchGuideSection(targetBtn.dataset.guideSection || preferredKey, targetBtn);
    } else {
      this.renderIcons();
    }
  },

  switchGuideSection(sectionKey, btnEl) {
    document.querySelectorAll(".guide-section-card").forEach(card => {
      card.style.display = "none";
    });
    const target = document.getElementById(`guideSection_${sectionKey}`);
    if (target) {
      target.style.display = "block";
    }

    if (this.lastGuideSectionByTrack && this.activeGuideTrack) {
      this.lastGuideSectionByTrack[this.activeGuideTrack] = sectionKey;
    }

    document.querySelectorAll(".guide-nav-link").forEach(link => {
      link.classList.remove("active");
    });
    if (btnEl) {
      btnEl.classList.add("active");
      try {
        btnEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } catch (_) {}
    }

    if (window.innerWidth <= 900) {
      const guideContainer = document.querySelector(".guide-container");
      if (guideContainer) {
        const navOffset = 110;
        const targetPos = guideContainer.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: Math.max(0, targetPos - navOffset),
          behavior: "smooth"
        });
      }
    }

    this.haptic("light");
    this.renderIcons();
  },

  formatMilitaryTime(dateStr, includeDate = false) {
    if (!dateStr) return "";
    const str = String(dateStr).trim();
    if (!str) return "";

    // 1. Check YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS
    const clean = str.replace("T", " ").split(".")[0];
    const matchFull = clean.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (matchFull) {
      const datePart = matchFull[1];
      const hh = matchFull[2].padStart(2, "0");
      const mm = matchFull[3];
      return includeDate ? `${datePart} ${hh}:${mm}` : `${hh}:${mm}`;
    }

    // 2. Check 4-digit military "2359"
    const match4 = clean.match(/^(\d{2})(\d{2})$/);
    if (match4) {
      const hh = parseInt(match4[1], 10);
      const mm = parseInt(match4[2], 10);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        return `${match4[1]}:${match4[2]}`;
      }
    }

    // 3. Check HH:MM(:SS)?
    const matchTime = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (matchTime) {
      const hh = matchTime[1].padStart(2, "0");
      const mm = matchTime[2];
      return `${hh}:${mm}`;
    }

    // 4. Try parsing with Date object
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      if (includeDate) {
        const yyyy = d.getFullYear();
        const mon = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mon}-${day} ${hh}:${mm}`;
      }
      return `${hh}:${mm}`;
    }

    return str;
  },

  formatEventPeriod(startTime, endTime, includeDate = false) {
    if (!startTime) return "Today";
    const startMil = this.formatMilitaryTime(startTime, includeDate);
    if (!endTime) return startMil;
    const endMil = this.formatMilitaryTime(endTime, false);
    return `${startMil} – ${endMil}`;
  },

  async pollNetworkStatus() {
    try {
      const clientHost = window.location.hostname || "";
      const isClientTailscale = (
        (clientHost.startsWith("100.") && !clientHost.startsWith("100.0.") && !clientHost.startsWith("100.1.") && !clientHost.startsWith("100.2.")) ||
        clientHost.endsWith(".ts.net")
      );
      const res = await fetch(`/api/network/status?client_host=${encodeURIComponent(clientHost)}`);
      if (!res.ok) throw new Error("Network status fetch failed");
      const data = await res.json();
      this.networkStatus = data;
      this.lastSyncTime = Date.now();

      const pill = document.getElementById("systemStatusPill");
      const text = document.getElementById("statusText");

      if (data.connected || isClientTailscale) {
        if (pill) {
          pill.className = "status-pill online";
          pill.title = `MagicDNS: ${data.dns_name || clientHost} (Host: ${data.hostname || 'pettr'})`;
          pill.onclick = null;
        }
        const displayIp = data.tailscale_ip || (isClientTailscale ? clientHost : (data.dns_name || 'Online'));
        if (text) text.textContent = `Tailscale: ${displayIp}`;
        this.hideNetworkSyncBanner();
      } else if (data.state === "NeedsLogin") {
        if (pill) {
          pill.className = "status-pill warning";
          pill.title = "Click to open Tailscale login page";
          pill.onclick = () => {
            if (data.auth_url) window.open(data.auth_url, "_blank");
            else alert("Tailscale login required on host PC. Run 'tailscale up'");
          };
        }
        if (text) text.textContent = "Tailscale: Needs Login ↗";
        this.showNetworkSyncBanner("Tailscale Needs Login", "Authentication required on the host PC to maintain 24/7 private sync.", false);
      } else {
        if (pill) {
          pill.className = "status-pill offline";
          pill.title = "Local network mode. Tailscale inactive on container interface.";
          pill.onclick = null;
        }
        const isContainer = data.is_container || (data.lan_ip && data.lan_ip.startsWith("172."));
        if (text) text.textContent = isContainer ? `Container: ${data.lan_ip}` : `Host LAN: ${data.lan_ip}`;
        const lanLabel = isContainer ? "internal container network" : "local host LAN";
        // Suppress false-alarm banner in Docker container since host forwards traffic seamlessly
        if (!isContainer && !data.connected) {
          this.showNetworkSyncBanner("Tailscale Disconnected", `Operating on ${lanLabel} (${data.lan_ip}). Remote updates from other devices won't synchronise until Tailscale connects.`, false);
        } else {
          this.hideNetworkSyncBanner();
        }
      }
    } catch (err) {
      console.warn("Network check error:", err);
      const pill = document.getElementById("systemStatusPill");
      const text = document.getElementById("statusText");
      if (pill) pill.className = "status-pill offline";
      if (text) text.textContent = "Server Offline";
      this.showNetworkSyncBanner("Server Unreachable", "Cannot connect to PETTR backend. Dashboard state may not reflect recent updates.", true);
    }
  },

  showNetworkSyncBanner(title, message, isCritical = false) {
    if (!isCritical && sessionStorage.getItem("pettr_dismiss_network_banner") === "1") {
      return;
    }
    const banner = document.getElementById("networkSyncBanner");
    const titleEl = document.getElementById("networkSyncTitle");
    const subEl = document.getElementById("networkSyncSub");
    const lastSeenEl = document.getElementById("networkSyncLastSeen");
    if (!banner) return;

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = message;
    if (lastSeenEl) {
      const minutesAgo = Math.max(0, Math.round((Date.now() - this.lastSyncTime) / 60000));
      lastSeenEl.textContent = minutesAgo === 0 ? "Last sync: Just now" : `Last sync: ${minutesAgo}m ago`;
    }

    if (isCritical) {
      banner.classList.add("offline-critical");
    } else {
      banner.classList.remove("offline-critical");
    }
    banner.style.display = "flex";
  },

  hideNetworkSyncBanner() {
    const banner = document.getElementById("networkSyncBanner");
    if (banner) banner.style.display = "none";
  },

  dismissNetworkSyncBanner() {
    this.hideNetworkSyncBanner();
    sessionStorage.setItem("pettr_dismiss_network_banner", "1");
  },

  async retryNetworkSync() {
    this.showToast("Checking server connection...");
    await this.pollNetworkStatus();
    await Dashboard.refresh();
    this.showToast("Dashboard synchronised!");
  },

  onAuthenticated(authInfo) {
    this.isHostClient = authInfo ? authInfo.is_host : false;
    this.pollNetworkStatus();
    setInterval(() => this.pollNetworkStatus(), 15000);

    // Initialize all submodules
    Dashboard.init();
    if (typeof Timeline !== "undefined") Timeline.init();
    Exploded.init();
    Notes.init();
    History.init();
    if (typeof CommandPalette !== "undefined") CommandPalette.init();
    if (typeof FocusCockpit !== "undefined") FocusCockpit.init();
    if (typeof EveningDebrief !== "undefined") EveningDebrief.init();
    this.renderIcons();
    requestAnimationFrame(() => this.updateTabIndicator(true));
    setTimeout(() => this.updateTabIndicator(true), 120);
  },

  initTabIndicator() {
    const nav = document.getElementById("mainNavTabs") || document.querySelector(".nav-tabs");
    if (!nav) return;
    nav.classList.add("nav-tabs--animated");

    window.addEventListener("resize", () => this.updateTabIndicator(true));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => this.updateTabIndicator(true)).catch(() => {});
    }
    requestAnimationFrame(() => this.updateTabIndicator(true));
  },

  updateTabIndicator(instant = false) {
    const nav = document.getElementById("mainNavTabs") || document.querySelector(".nav-tabs");
    const indicator = document.getElementById("navTabIndicator");
    if (!nav || !indicator) return;
    const activeBtn = nav.querySelector(".tab-btn.active");
    if (!activeBtn || activeBtn.offsetWidth === 0) return;

    if (instant) {
      indicator.style.transition = "none";
    } else {
      indicator.style.transition = "";
    }

    indicator.style.width = `${activeBtn.offsetWidth}px`;
    indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
    indicator.style.opacity = "1";

    if (instant) {
      // Force reflow so subsequent switches animate smoothly
      void indicator.offsetWidth;
      indicator.style.transition = "";
    }
  },

  bindNavigation() {
    const tabButtons = document.querySelectorAll(".nav-tabs .tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab button active states
    document.querySelectorAll(".nav-tabs .tab-btn").forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
        try {
          btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } catch (_) {}
      } else {
        btn.classList.remove("active");
      }
    });

    // Slide the active tab pill smoothly to the selected button
    this.updateTabIndicator(false);
    requestAnimationFrame(() => this.updateTabIndicator(false));
    setTimeout(() => this.updateTabIndicator(false), 180);

    // Update tab pane visibility
    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.remove("active");
    });

    const targetPane = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (targetPane) {
      targetPane.classList.add("active");
    }

    // Update header clock visibility now that the target pane is mounted and active
    this.updateHeaderClockVisibility();
    requestAnimationFrame(() => this.updateHeaderClockVisibility());
    setTimeout(() => this.updateHeaderClockVisibility(), 50);
    setTimeout(() => this.updateHeaderClockVisibility(), 150);

    // Refresh tab content
    if (tabName === "dashboard") {
      Dashboard.refresh();
      if (typeof Timeline !== "undefined") Timeline.refresh();
    }
    else if (tabName === "timeline" && typeof Timeline !== "undefined") Timeline.refresh();
    else if (tabName === "exploded") {
      Exploded.refresh();
      if (typeof Mindmap !== "undefined") {
        setTimeout(() => {
          Mindmap.resize();
          Mindmap.draw();
        }, 50);
      }
    }
    else if (tabName === "history") History.refresh();
    else if (tabName === "settings") {
      this.loadProfileSettings();
      this.loadPinInfo();
      this.loadLlmStatus();
      this.loadStorageMetrics();
    }
    this.renderIcons();
  },

  navigateToGlobalProjects() {
    this.switchTab("exploded");
    if (typeof Exploded !== "undefined") {
      Exploded.switchView("cards");
      document.querySelectorAll(".exploded-view-toggle-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === "cards");
      });
    }
  },

  handleGlobalEscape(e) {
    if (e.key !== "Escape" || e.defaultPrevented) return;

    const pinLock = document.getElementById("pinLockOverlay");
    if (pinLock && pinLock.style.display !== "none") return;

    const dismiss = () => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      return true;
    };

    const lightbox = document.getElementById("notesMediaLightboxModal");
    if (lightbox && lightbox.style.display !== "none" && typeof Notes !== "undefined") {
      Notes.closeMediaLightbox();
      return dismiss();
    }

    const entityModal = document.getElementById("entityModalOverlay");
    if (entityModal && entityModal.style.display !== "none" && typeof EntityModal !== "undefined") {
      EntityModal.close();
      return dismiss();
    }

    const manualCreateModal = document.getElementById("manualCreateModalOverlay");
    if (manualCreateModal && manualCreateModal.style.display !== "none" && typeof Dashboard !== "undefined") {
      Dashboard.closeManualCreateModal();
      return dismiss();
    }

    const unorgModal = document.getElementById("unorganizedModal");
    if (unorgModal && unorgModal.style.display !== "none" && typeof Dashboard !== "undefined") {
      Dashboard.closeUnorganizedModal();
      return dismiss();
    }

    const sessionsModal = document.getElementById("focusSessionsModal");
    if (sessionsModal && sessionsModal.style.display !== "none" && typeof History !== "undefined") {
      History.toggleFocusSessionsModal();
      return dismiss();
    }

    const unqueuedModal = document.getElementById("snapshotUnqueuedModal");
    if (unqueuedModal && unqueuedModal.style.display !== "none" && typeof Dashboard !== "undefined") {
      Dashboard.closeSnapshotUnqueuedModal();
      return dismiss();
    }

    const debriefModal = document.getElementById("eveningDebriefModal");
    if (debriefModal && debriefModal.style.display !== "none" && typeof EveningDebrief !== "undefined") {
      EveningDebrief.close();
      return dismiss();
    }

    const timezoneModal = document.getElementById("timezoneModal");
    if (timezoneModal && timezoneModal.style.display !== "none") {
      this.closeTimezoneModal();
      return dismiss();
    }

    const voiceModal = document.getElementById("voiceTroubleshootModal");
    if (voiceModal && voiceModal.style.display !== "none") {
      this.closeVoiceTroubleshootModal();
      return dismiss();
    }

    const cockpitPicker = document.getElementById("cockpitTaskPicker");
    if (cockpitPicker && cockpitPicker.style.display !== "none" && typeof FocusCockpit !== "undefined") {
      FocusCockpit.toggleTaskPicker(false);
      return dismiss();
    }

    const cockpitModal = document.getElementById("focusCockpitModal");
    if (cockpitModal && cockpitModal.style.display !== "none" && typeof FocusCockpit !== "undefined") {
      FocusCockpit.close();
      return dismiss();
    }

    const themeDrawer = document.getElementById("themeSliderDrawer");
    if (themeDrawer && themeDrawer.style.display !== "none") {
      this.closeThemeSlider();
      return dismiss();
    }

    const scenicTimePopover = document.getElementById("scenicTimePopover");
    if (scenicTimePopover && scenicTimePopover.style.display !== "none") {
      this.closeScenicTimePopover();
      return dismiss();
    }

    const horacePanel = document.getElementById("horacePanel");
    if (
      typeof HoraceChat !== "undefined" &&
      (HoraceChat.isOpen || (horacePanel && horacePanel.style.display !== "none"))
    ) {
      HoraceChat.close();
      return dismiss();
    }

    if (this.isScenicMode) {
      this.exitScenicMode();
      return dismiss();
    }

    if (typeof Dashboard !== "undefined" && Dashboard.activeFilter) {
      Dashboard.clearFilter();
      return dismiss();
    }
  },

  bindKeyboardShortcuts() {
    const input = document.getElementById("quickInput");

    // Global Escape key dismisses topmost open dropdown / popup / modal panel
    document.addEventListener("keydown", (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        this.toggleScenicMode();
        return;
      }
      this.handleGlobalEscape(e);
    });

    // Click outside dismisses the diurnal theme slider drawer and scenic time-of-day popover
    document.addEventListener("click", (e) => {
      if (!e.target || !e.target.isConnected) return;
      const drawer = document.getElementById("themeSliderDrawer");
      if (drawer && drawer.style.display !== "none" && !e.target.closest(".theme-switcher-wrapper")) {
        this.closeThemeSlider();
      }
      const scenicPop = document.getElementById("scenicTimePopover");
      if (scenicPop && scenicPop.style.display !== "none" && !e.target.closest(".scenic-time-wrap")) {
        this.closeScenicTimePopover();
      }
    });

    // Global hotkey '/' to focus quick input (switches to dashboard first if needed)
    window.addEventListener("keydown", (e) => {
      if (e.key !== "/") return;

      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl === input ||
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable ||
        (typeof activeEl.closest === "function" && (
          activeEl.closest('[contenteditable="true"]') ||
          activeEl.closest('.notes-editor-surface') ||
          activeEl.closest('#notesEditPane') ||
          activeEl.closest('.cockpit-scratchpad-input') ||
          activeEl.closest('.modal-card') ||
          activeEl.closest('.horace-panel')
        ))
      );

      // Do not hijack '/' while typing, or while user is working inside the Notes tab
      if (isTyping || this.currentTab === "notes") {
        return;
      }

      e.preventDefault();
      if (this.currentTab !== "dashboard") {
        this.switchTab("dashboard");
      }
      setTimeout(() => {
        if (input) input.focus();
      }, 50);
    });

    // Enter key inside quick input
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.submitLog();
        }
      });

      // Dynamic rotating placeholder showcasing realistic examples across study, engineering, fitness, and life
      const naturalPlaceholders = [
        "Log anything naturally... e.g. 'Finish literature review draft for capstone. Tonight 2359'",
        "Log anything naturally... e.g. 'Gym session & stretch tomorrow 1700'",
        "Log anything naturally... e.g. 'Review propulsion telemetry test tomorrow 1400 top priority'",
        "Log anything naturally... e.g. 'Faculty sync on CAD project Friday 1500'",
        "Log anything naturally... e.g. 'Pick up coffee beans & groceries this evening'",
        "Log anything naturally... e.g. 'Derive equations for problem set 3 tonight 2359'",
        "Log anything naturally... e.g. 'Dentist appointment next Tuesday 1030'"
      ];
      let pIdx = Math.floor(Math.random() * naturalPlaceholders.length);
      input.placeholder = naturalPlaceholders[pIdx];

      setInterval(() => {
        if (document.activeElement !== input && !input.value) {
          pIdx = (pIdx + 1) % naturalPlaceholders.length;
          input.placeholder = naturalPlaceholders[pIdx];
        }
      }, 12000);
    }
  },

  createParticleBurst(targetEl) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const numParticles = 8;
    for (let i = 0; i < numParticles; i++) {
      const p = document.createElement("div");
      p.className = "log-particle";
      const angle = (i / numParticles) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const distance = 26 + Math.random() * 24;
      const dx = `${Math.cos(angle) * distance}px`;
      const dy = `${Math.sin(angle) * distance}px`;
      p.style.setProperty("--dx", dx);
      p.style.setProperty("--dy", dy);
      p.style.left = `${centerX}px`;
      p.style.top = `${centerY}px`;
      p.style.position = "fixed";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  },

  async submitLog() {
    if (this.isRecordingVoice) {
      this.stopVoiceInput(true);
    }
    const input = document.getElementById("quickInput");
    const submitBtn = document.getElementById("quickSubmitBtn");
    const text = input.value.trim();
    if (!text) return;

    this.createParticleBurst(submitBtn);

    input.disabled = true;
    if (submitBtn) submitBtn.innerHTML = '<span>Processing...</span>';

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();

      if (res.ok) {
        input.value = "";
        
        if (submitBtn) {
          submitBtn.classList.add("btn-success");
          submitBtn.innerHTML = '<span>Logged!</span>';
          this.createParticleBurst(submitBtn);
        }

        if (data.status === "unorganized") {
          this.showToast("Placed into Unorganised Queue for review", 4000);
        } else {
          const type = data.entity_type;
          const proj = data.entity && data.entity.project_name ? ` [${data.entity.project_name}]` : "";
          const dueMil = data.entity && data.entity.due_date ? ` (${this.formatMilitaryTime(data.entity.due_date)})` : "";
          this.showToast(`Logged as ${type}${proj}${dueMil}!`, 3500);
        }

        // Refresh views
        await Dashboard.refresh();
        if (this.currentTab === "exploded") await Exploded.refresh();
        if (this.currentTab === "history") await History.refresh();
        if (this.currentTab === "timeline" && typeof Timeline !== "undefined") await Timeline.refresh();
      } else {
        this.showToast(data.detail || "Error processing entry", 3000);
      }
    } catch (err) {
      this.showToast("Network error connecting to PETTR.", 3000);
    } finally {
      input.disabled = false;
      setTimeout(() => {
        if (submitBtn) {
          submitBtn.classList.remove("btn-success");
          submitBtn.innerHTML = '<span id="quickSubmitBtnText">Log</span> <kbd class="log-key-hint">↵</kbd>';
        }
      }, 850);
      input.focus();
    }
  },

  showToast(message, arg2, arg3) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    let isError = false;
    let duration = 3500;

    if (typeof arg2 === "boolean") {
      isError = arg2;
      if (typeof arg3 === "number") duration = arg3;
    } else if (typeof arg2 === "string") {
      isError = (arg2 === "error" || arg2 === "err");
      if (typeof arg3 === "number") duration = arg3;
    } else if (typeof arg2 === "number") {
      duration = arg2;
      if (typeof arg3 === "boolean") isError = arg3;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
    const iconName = isError ? "alert-circle" : "check-circle-2";
    const iconColor = isError ? "var(--urgent-orange)" : "var(--normal-green)";

    const cleanMsg = typeof message === "string" ? message : String(message);
    toast.innerHTML = `<i data-lucide="${iconName}" style="width:15px;height:15px;color:${iconColor};flex-shrink:0;"></i> <span>${cleanMsg}</span>`;
    container.appendChild(toast);
    this.renderIcons();

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%) scale(0.95)";
      toast.style.transition = "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
      setTimeout(() => toast.remove(), 260);
    }, duration);
  },

  async logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      PinLock.showOverlay();
    } catch (err) {
      location.reload();
    }
  },

  async changePin() {
    const input = document.getElementById("newPinInput");
    const msgEl = document.getElementById("pinChangeResult");
    const pin = input.value.trim();

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      msgEl.style.color = "#ef4444";
      msgEl.textContent = "PIN must be exactly 4 numeric digits.";
      return;
    }

    try {
      const res = await fetch("/api/auth/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_pin: pin })
      });
      const data = await res.json();
      if (res.ok) {
        msgEl.style.color = "#22c55e";
        msgEl.textContent = "PIN successfully changed!";
        input.value = "";
      } else {
        msgEl.style.color = "#ef4444";
        msgEl.textContent = data.detail || "Failed to update PIN.";
      }
    } catch (err) {
      msgEl.style.color = "#ef4444";
      msgEl.textContent = "Network error.";
    }
  },

  lastBackupFilename: null,

  async triggerManualBackup() {
    const msgEl = document.getElementById("backupStatusMsg");
    if (msgEl) msgEl.textContent = "Generating backup archive...";
    try {
      const res = await fetch("/api/backup/now", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        this.lastBackupFilename = data.filename;
        const kbSize = Math.round((data.size_bytes || 0) / 1024);
        if (data.gdrive && data.gdrive.synced) {
          const remoteTarget = data.gdrive.remote || "Google Drive";
          if (msgEl) msgEl.textContent = `☁️ Synced to Google Drive (${remoteTarget}) · ${data.filename} (${kbSize} KB)`;
          this.showToast(`☁️ Backup synced to Google Drive (${remoteTarget})!`);
        } else if (data.gdrive && data.gdrive.reason) {
          if (msgEl) msgEl.textContent = `💾 Staged on server: ${data.filename} (${kbSize} KB) · Drive sync pending: ${data.gdrive.reason}`;
          this.showToast(`Backup saved to server (Drive unlinked: ${data.gdrive.reason})`);
        } else {
          if (msgEl) msgEl.textContent = `💾 Backup archive created on server: ${data.filename} (${kbSize} KB)`;
          this.showToast(`Backup created: ${data.filename}`);
        }

        const downloadBtn = document.getElementById("downloadBackupArchiveBtn");
        if (downloadBtn) {
          downloadBtn.style.display = "inline-flex";
        }
      } else {
        if (msgEl) msgEl.textContent = "Backup failed: " + (data.detail || "Server error");
        this.showToast("Backup failed", true);
      }
    } catch (err) {
      if (msgEl) msgEl.textContent = "Error initiating backup.";
      this.showToast("Network error initiating backup", true);
    }
  },

  downloadLatestBackup() {
    const filename = this.lastBackupFilename || "pettr_backup_latest.tar.gz";
    const downloadLink = document.createElement("a");
    downloadLink.href = `/api/backup/download/${encodeURIComponent(filename)}`;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    this.showToast("Downloading backup archive to device...");
  },

  loadProfileSettings() {
    const input = document.getElementById("settingsProfileNameInput");
    if (input && typeof Dashboard !== "undefined") {
      input.value = Dashboard.userName || "User";
    }
  },

  async saveProfileFromSettings() {
    const input = document.getElementById("settingsProfileNameInput");
    const resultEl = document.getElementById("profileNameSaveResult");
    const name = input ? input.value.trim() : "";

    if (!name) {
      if (resultEl) {
        resultEl.style.color = "var(--urgent-orange)";
        resultEl.textContent = "Display name cannot be empty.";
      }
      return;
    }

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: name })
      });
      const data = await res.json();
      if (res.ok) {
        if (typeof Dashboard !== "undefined") {
          Dashboard.userName = name;
          localStorage.setItem("pettr_user_name", name);
          if (Dashboard.refreshDailyIntel) {
            Dashboard.refreshDailyIntel();
          } else {
            Dashboard.renderGreeting();
          }
        }
        if (resultEl) {
          resultEl.style.color = "var(--normal-green)";
          resultEl.textContent = `Display name updated to "${name}"!`;
        }
        this.showToast("Profile name saved!");
      } else {
        if (resultEl) {
          resultEl.style.color = "var(--urgent-orange)";
          resultEl.textContent = data.detail || "Failed to update profile.";
        }
      }
    } catch (err) {
      if (resultEl) {
        resultEl.style.color = "var(--urgent-orange)";
        resultEl.textContent = "Network error updating profile.";
      }
    }
  },

  pinRevealed: false,
  cachedPin: "••••",

  async loadPinInfo() {
    const pinDisplay = document.getElementById("currentPinDisplay");
    if (!pinDisplay) return;
    try {
      const res = await fetch("/api/settings/pin-info");
      if (res.ok) {
        const data = await res.json();
        this.cachedPin = data.current_pin || "1234";
        pinDisplay.textContent = this.pinRevealed ? this.cachedPin : "••••";
      } else {
        pinDisplay.textContent = "•••• (Host only)";
      }
    } catch (err) {
      pinDisplay.textContent = "••••";
    }
  },

  togglePinVisibility() {
    this.pinRevealed = !this.pinRevealed;
    const pinDisplay = document.getElementById("currentPinDisplay");
    const toggleBtn = document.getElementById("togglePinVisBtn");
    if (pinDisplay) {
      pinDisplay.textContent = this.pinRevealed ? this.cachedPin : "••••";
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = this.pinRevealed
        ? `<i data-lucide="eye-off" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;"></i> Hide PIN`
        : `<i data-lucide="eye" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;"></i> Show PIN`;
      this.renderIcons();
    }
  },

  async loadLlmStatus() {
    const pill = document.getElementById("llmStatusPill");
    const text = document.getElementById("llmStatusText");
    const activeDisplay = document.getElementById("llmActiveModelDisplay");
    const select = document.getElementById("llmModelSelect");
    if (!pill) return;

    try {
      const res = await fetch("/api/llm/status");
      if (!res.ok) throw new Error("Status check failed");
      const data = await res.json();

      if (data.online) {
        pill.className = "network-badge online";
        if (text) text.textContent = "Ollama Active (Local)";
      } else {
        pill.className = "network-badge offline";
        if (text) text.textContent = "Ollama Offline (Deterministic Fallback)";
      }

      if (activeDisplay) activeDisplay.textContent = data.active_model || "llama3.2:3b";

      if (select && data.available_models) {
        select.innerHTML = "";
        const allModels = data.available_models.length > 0 ? [...data.available_models] : [data.active_model || "llama3.2:3b"];
        if (!allModels.includes(data.active_model)) {
          allModels.unshift(data.active_model);
        }
        allModels.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          if (m === data.active_model) opt.selected = true;
          select.appendChild(opt);
        });
      }
    } catch (err) {
      if (pill) pill.className = "network-badge offline";
      if (text) text.textContent = "Engine Offline (Rule-based)";
    }
  },

  async selectLlmModel(modelName) {
    try {
      const res = await fetch("/api/llm/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName })
      });
      if (res.ok) {
        this.showToast(`Active LLM model switched to ${modelName}!`);
        await this.loadLlmStatus();
      } else {
        const err = await res.json();
        this.showToast(err.detail || "Failed to switch model", true);
      }
    } catch (err) {
      console.error(err);
      this.showToast("Network error switching model", true);
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  async testLlmPing() {
    const resultEl = document.getElementById("llmTestResult");
    if (resultEl) {
      resultEl.style.color = "var(--text-muted)";
      resultEl.innerHTML = `<span>⏳ Testing latency & connectivity...</span>`;
    }
    try {
      const res = await fetch("/api/llm/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && resultEl) {
        const isOnline = Boolean(data.is_model_online || (typeof data.engine === "string" && data.engine.toLowerCase().startsWith("ollama")));
        const sampleTitle = (data.sample_result && data.sample_result.title) ? data.sample_result.title : "OK";
        const sampleType = (data.sample_result && data.sample_result.entity_type) ? data.sample_result.entity_type : "task";
        const cleanTitle = this.escapeHtml(sampleTitle);

        if (isOnline) {
          resultEl.style.color = "var(--normal-green)";
          const rawEngine = typeof data.engine === "string" ? data.engine : "ollama";
          const modelTag = rawEngine.replace(/^ollama\s*/i, "").replace(/[\(\)]/g, "").trim() || "Active";
          resultEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 6px 0;">
              <div><strong>🤖 Ollama Local LLM (${this.escapeHtml(modelTag)}) Online</strong> · Latency: <strong>${data.latency_ms}ms</strong></div>
              <div style="font-size: 11px; opacity: 0.85;">Neural classifier response: "${cleanTitle}" (${sampleType})</div>
            </div>`;
        } else {
          resultEl.style.color = "inherit";
          const diags = data.diagnostics || (data.sample_result && data.sample_result.diagnostics) || {};
          const attempts = Array.isArray(diags.attempts) ? diags.attempts : [];
          const modelReq = diags.model_requested || "llama3.2:3b";
          const attemptsJoined = attempts.join("<br>• ");

          let hintMsg = "💡 <em>Running in Docker? Ensure Ollama is listening on <code>0.0.0.0</code> (not 127.0.0.1) on the host server and rebuild PETTR with <code>git pull && docker compose up -d --build</code>. If local, start via <code>ollama serve</code>.</em>";
          if (attemptsJoined.includes("404") || attemptsJoined.includes("not found")) {
            hintMsg = `💡 <em>Ollama is reachable, but model <code>${this.escapeHtml(modelReq)}</code> has not been pulled! Run <code>ollama pull ${this.escapeHtml(modelReq)}</code> on your server.</em>`;
          } else if (attemptsJoined.includes("ReadTimeout") || attemptsJoined.includes("timeout")) {
            hintMsg = `💡 <em>Ollama is connected and running on your host, but timed out generating (ReadTimeout). The model is likely cold-loading into RAM or running CPU inference. Test again or warm it up with <code>ollama run llama3.2 "hi"</code>.</em>`;
          }

          resultEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; background: var(--urgent-orange-bg); padding: 10px 12px; border-radius: var(--radius-xs); border: 1px solid rgba(255, 69, 0, 0.25); margin-top: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span style="font-weight: 700; color: var(--urgent-orange);">⚠️ Local LLM is Offline</span>
                <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">Fallback Latency: <strong>${data.latency_ms}ms</strong></span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.45;">
                Ollama could not be reached for inference. Operating in zero-downtime offline mode using <strong>Deterministic Regex Engine</strong>. Test sample parsed: <em>"${cleanTitle}" (${sampleType})</em>.
              </div>
              ${attempts.length > 0 ? `<div style="font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); background: var(--bg-tertiary); padding: 6px 8px; border-radius: 4px; overflow-x: auto; line-height: 1.4;"><strong>Probe attempts:</strong><br>• ${attemptsJoined}</div>` : ''}
              <div style="font-size: 11px; color: var(--text-dim);">
                ${hintMsg}
              </div>
            </div>`;
        }
        // Refresh the header pill to keep state synchronised
        this.loadLlmStatus();
      } else if (resultEl) {
        resultEl.style.color = "var(--urgent-orange)";
        resultEl.textContent = "Test failed: " + (data.detail || "Could not reach engine");
      }
    } catch (err) {
      if (resultEl) {
        resultEl.style.color = "var(--urgent-orange)";
        resultEl.textContent = "Network error testing LLM latency.";
      }
    }
  },

  async loadStorageMetrics(showToast = false) {
    const container = document.getElementById("storageMetricsContainer");
    if (!container) return;

    try {
      const res = await fetch("/api/system/storage");
      if (!res.ok) {
        container.innerHTML = `<div style="color: var(--urgent-orange); font-size: 13px; padding: 10px 0;">Failed to load storage metrics.</div>`;
        return;
      }
      const data = await res.json();
      const db = data.database || {};
      const media = data.media || {};
      const backups = data.backups || {};
      const appCode = data.app_code || {};
      const runtimeEnv = data.runtime_env || {};
      const llm = data.llm || {};
      const totalApp = data.total_app_storage || {};
      const disk = data.disk || {};
      const ram = data.ram || {};
      const counts = db.counts || {};

      const procRam = ram.pettr_process || {};
      const llmRam = ram.llm_process || {};
      const hostRam = ram.host_ram || {};
      const combinedRam = ram.combined_pettr_ram || {};

      const diskPct = disk.used_percent || 0;
      const ramPct = hostRam.used_percent || 0;

      // Build model tags preview if models exist
      let modelTagsHtml = "";
      if (llm.models && llm.models.length > 0) {
        modelTagsHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">` +
          llm.models.map(m => `<span style="font-size: 10.5px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); border: 1px solid var(--card-border); color: var(--text-main);">${m.name} (${m.formatted || ''})</span>`).join("") +
          `</div>`;
      }

      // Build active in-RAM models preview
      let hotModelBadgesHtml = "";
      if (llmRam.loaded_models && llmRam.loaded_models.length > 0) {
        hotModelBadgesHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">` +
          llmRam.loaded_models.map(m => `<span style="font-size: 10.5px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); border: 1px solid var(--card-border); color: var(--normal-green);">${m.name} (${m.formatted}${m.size_vram_bytes ? ` · ${m.size_vram_formatted} VRAM` : ''})</span>`).join("") +
          `</div>`;
      }

      container.innerHTML = `
        <!-- Host Disk & RAM Footprint Overview Banner -->
        <div class="storage-overview-banner">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">PETTR Combined Footprint</span>
              <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 2px; flex-wrap: wrap;">
                <div>
                  <span style="font-size: 20px; font-weight: 800; font-family: var(--font-mono); color: var(--text-main);">${totalApp.formatted || '0 B'}</span>
                  <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">Storage (Disk)</span>
                </div>
                <div style="color: var(--text-muted); font-size: 14px;">•</div>
                <div>
                  <span style="font-size: 20px; font-weight: 800; font-family: var(--font-mono); color: var(--normal-green);">${combinedRam.formatted || '0 B'}</span>
                  <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">Live RAM Footprint</span>
                </div>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
                Storage includes SQLite, model weights, venv &amp; backups · RAM includes PETTR process (${procRam.rss_formatted || '0 B'}) &amp; active LLM weights (${llmRam.formatted || '0 B'})
              </div>
            </div>
          </div>

          <!-- Dual Hardware Capacity Meters: Drive Storage & Host RAM -->
          <div class="storage-meters-row">
            <!-- Meter 1: Server Drive Storage -->
            <div class="storage-meter-item">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                <span style="font-weight: 700; color: var(--text-main);"><i data-lucide="hard-drive" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;color:var(--accent-cyan);"></i> Server Drive Storage</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-main);">${disk.used_formatted || '0 B'} / ${disk.total_formatted || '0 B'} (${diskPct}%)</span>
              </div>
              <div class="storage-progress-bar-bg" title="Drive Storage Usage: ${diskPct}%">
                <div class="storage-progress-bar-fill" style="width: ${Math.min(100, Math.max(2, diskPct))}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">
                <span>${disk.free_formatted || '0 B'} free space</span>
                <span>${disk.total_formatted || '0 B'} capacity</span>
              </div>
            </div>

            <!-- Meter 2: Server System RAM -->
            <div class="storage-meter-item">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
                <span style="font-weight: 700; color: var(--text-main);"><i data-lucide="cpu" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;color:var(--normal-green);"></i> Server System RAM</span>
                <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-main);">${hostRam.used_formatted || '0 B'} / ${hostRam.total_formatted || '0 B'} (${ramPct}%)</span>
              </div>
              <div class="storage-progress-bar-bg" title="Host Server RAM Usage: ${ramPct}%">
                <div class="storage-progress-bar-fill ram-fill" style="width: ${Math.min(100, Math.max(2, ramPct))}%;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">
                <span>${hostRam.free_formatted || '0 B'} available memory</span>
                <span>${hostRam.total_formatted || '0 B'} physical RAM</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 8 Storage & Memory Breakdown Cards with Clean Lucide Iconography -->
        <div class="storage-grid-cards">
          <!-- 1. PETTR Process RAM -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="cpu" style="width:13px;height:13px;color:var(--focus-indigo);"></i> PETTR Process RAM
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--focus-indigo);">
                ${procRam.rss_formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              PID: <code>${procRam.pid || 'Active'}</code> · Python ASGI Server<br>
              Physical resident memory (RSS): <strong>${procRam.rss_formatted || '0 B'}</strong><br>
              Ultra-lean footprint; zero heavy Java/Node background daemons.
            </div>
          </div>

          <!-- 2. Local LLM Active in RAM -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="zap" style="width:13px;height:13px;color:var(--normal-green);"></i> Active LLM (In-Memory)
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: ${llmRam.loaded_count > 0 ? 'var(--normal-green)' : 'var(--text-muted)'};">
                ${llmRam.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              Status: <span style="font-weight: 600; color: ${llmRam.loaded_count > 0 ? 'var(--normal-green)' : 'var(--text-muted)'};">${llmRam.status || 'Standby'}</span><br>
              ${llmRam.loaded_count > 0 ? 'Active in memory for instant, zero-latency inference.' : 'Weights are idle on disk and load into memory on demand.'}
              ${hotModelBadgesHtml}
            </div>
          </div>

          <!-- 3. SQLite Database -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="database" style="width:13px;height:13px;color:var(--focus-indigo);"></i> SQLite Database
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--focus-indigo);">
                ${db.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${counts.tasks_total || 0} tasks (${counts.tasks_completed_30d || 0} completed, ${counts.tasks_pending || 0} pending)<br>
              ${counts.projects_total || 0} projects · ${counts.events || 0} events · ${counts.reminders || 0} reminders<br>
              <strong style="color: var(--normal-green);">${counts.day_seals_metrics || 0} daily metric seals</strong>${counts.day_seals_manual ? ` (${counts.day_seals_manual} sealed via debrief)` : ''} (preserved forever)
            </div>
          </div>

          <!-- 4. Local LLM Models (Ollama on Disk) -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="bot" style="width:13px;height:13px;color:var(--urgent-orange);"></i> Local LLM Weights (Disk)
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--urgent-orange);">
                ${llm.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${llm.model_count || 0} model${llm.model_count === 1 ? '' : 's'} detected · Active: <code>${llm.active_model || 'llama3.2:3b'}</code><br>
              ${llm.online ? '<span style="color: var(--normal-green); font-weight: 600;">● Ollama Online</span>' : '<span style="color: var(--text-muted);">○ Ollama Standby / Disk Cache</span>'}
              ${modelTagsHtml}
            </div>
          </div>

          <!-- 5. Python Runtime Environment -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="settings" style="width:13px;height:13px;color:var(--accent-cyan);"></i> Runtime Environment (venv)
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--accent-cyan);">
                ${runtimeEnv.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              Python ${runtimeEnv.python_version || ''} isolated virtualenv.<br>
              ${runtimeEnv.file_count || 0} dependencies &amp; package files installed.
            </div>
          </div>

          <!-- 6. Notes & Media Attachments -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="image" style="width:13px;height:13px;color:var(--accent-cyan);"></i> Notes &amp; Media Attachments
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--accent-cyan);">
                ${media.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${media.count || 0} uploaded image${media.count === 1 ? '' : 's'} &amp; files in <code>data/media</code><br>
              Linked directly inside your rich notes &amp; mindmap items.
            </div>
          </div>

          <!-- 7. Backup Archives -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="archive" style="width:13px;height:13px;color:var(--recurrence-purple);"></i> Local Backup Archives
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--recurrence-purple);">
                ${backups.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${backups.count || 0} local snapshot archive${backups.count === 1 ? '' : 's'} on disk in <code>backups/</code>.<br>
              Full snapshots containing SQLite, Markdown digest, and JSON data.
            </div>
          </div>

          <!-- 8. Application Codebase -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="code" style="width:13px;height:13px;color:var(--text-main);"></i> Application Codebase
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--text-main);">
                ${appCode.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${appCode.count || 0} frontend and backend source files.<br>
              Zero external heavy build steps; lightweight vanilla assets.
            </div>
          </div>
        </div>

        <!-- Retention Policy & Live Clock -->
        <div style="background: var(--bg-secondary); border: 1px solid var(--card-border); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--text-muted);">
          <div>
            <strong style="color: var(--text-main);">Retention Policy:</strong> Completed tasks retained for <strong>30 days</strong>. Projects, notes, and daily metric seals are stored <strong>indefinitely</strong> (automatically tracked daily).
          </div>
          <div style="font-family: var(--font-mono); font-size: 11px;">
            Updated: ${data.timestamp || 'Just now'}
          </div>
        </div>
      `;
      if (window.lucide) {
        try { lucide.createIcons(); } catch (_) {}
      }
      if (showToast && typeof this.showToast === "function") {
        this.showToast("Storage and resource metrics refreshed", "success");
      }
    } catch (err) {
      console.error("Error loading storage metrics:", err);
      container.innerHTML = `<div style="color: var(--urgent-orange); font-size: 13px; padding: 10px 0;">Error fetching storage metrics.</div>`;
    }
  }
};

window.App = App;
window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
