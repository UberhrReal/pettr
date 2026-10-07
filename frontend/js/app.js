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
    this.bindKeyboardShortcuts();
    this.bindHeaderScroll();
    this.initMissionClock();
    this.renderIcons();
    if (typeof CommandPalette !== "undefined") CommandPalette.init();
    if (typeof FocusCockpit !== "undefined") FocusCockpit.init();
    if (typeof EveningDebrief !== "undefined") EveningDebrief.init();
    PinLock.init();
  },

  updateHeaderClockVisibility() {
    const headerClock = document.getElementById("headerClockPill");
    if (!headerClock) return;

    const missionClock = document.getElementById("missionClockWidget");
    const isDashboard = !this.currentTab || this.currentTab === "dashboard";

    if (isDashboard && missionClock && missionClock.offsetParent !== null) {
      const header = document.querySelector(".app-header");
      const headerBottom = header ? header.getBoundingClientRect().bottom : 80;
      const rect = missionClock.getBoundingClientRect();
      
      // If any portion of the main mission clock is visible below the sticky header, hide the mini clock
      if (rect.bottom > headerBottom + 10) {
        headerClock.classList.remove("visible");
      } else {
        // Mission clock has completely scrolled off / behind sticky header
        headerClock.classList.add("visible");
      }
    } else {
      // On non-dashboard tabs where the main mission clock is absent, display header clock
      headerClock.classList.add("visible");
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
      const elProgress = document.getElementById("missionClockProgressBar");
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

      if (elProgress) {
        const pct = (seconds / 60) * 100;
        elProgress.style.width = `${pct}%`;
      }

      if (elHeaderClock) {
        elHeaderClock.textContent = `${hStr}:${mStr}:${sStr}`;
      }

      if (seconds === 0 && typeof EveningDebrief !== "undefined") {
        EveningDebrief.updateDebriefButtonState();
      }
    };

    update();
    if (this._missionClockTimer) clearInterval(this._missionClockTimer);
    this._missionClockTimer = setInterval(update, 1000);
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

  renderIcons() {
    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  },

  getDiurnalTheme(hour) {
    if (hour >= 6 && hour < 12) {
      return { theme: "morning", label: "Morning Dawn" };
    } else if (hour >= 12 && hour < 18) {
      return { theme: "light", label: "Afternoon" };
    } else if (hour >= 18 && hour < 22) {
      return { theme: "evening", label: "Evening Dusk" };
    } else {
      return { theme: "dark", label: "Night" };
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
          WaveCanvas.draw();
        }
      } catch (e) {}
    }
  },

  initTheme() {
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

    if (notify) {
      this.haptic("light");
      this.showToast(`Theme updated: ${mode.toUpperCase()} mode active`);
    }

    this.renderIcons();
  },

  toggleThemeSlider() {
    const drawer = document.getElementById("themeSliderDrawer");
    if (!drawer) return;
    const isShown = drawer.style.display !== "none";
    drawer.style.display = isShown ? "none" : "block";
    if (!isShown) {
      const currentHour = new Date().getHours();
      const slider = document.getElementById("themeHourSlider");
      if (slider) {
        slider.value = currentHour;
        this.updateThemeSliderLabel(currentHour);
      }
    }
  },

  updateThemeSliderLabel(hour) {
    const labelEl = document.getElementById("themeSliderLabel");
    if (!labelEl) return;
    const { label } = this.getDiurnalTheme(parseInt(hour, 10));
    labelEl.textContent = `Solar Time: ${String(hour).padStart(2, "0")}:00 · ${label}`;
  },

  onThemeSliderInput(hour) {
    const h = parseInt(hour, 10);
    this.updateThemeSliderLabel(h);
    const { theme, label } = this.getDiurnalTheme(h);
    this.applyEffectiveTheme(theme);
    localStorage.setItem("pettr_theme_mode", "slider");
    localStorage.setItem("pettr_theme_slider_hour", String(h));

    // Deselect other preset buttons
    document.querySelectorAll(".theme-switcher-control .theme-btn").forEach(btn => {
      if (btn.id !== "themeBtnSliderToggle") btn.classList.remove("active");
    });
  },

  setThemeHourPreset(hour) {
    const slider = document.getElementById("themeHourSlider");
    if (slider) slider.value = hour;
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

  toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.", 4000);
      return;
    }

    const btn = document.getElementById("voiceInputBtn");
    const input = document.getElementById("quickInput");

    if (this.isRecordingVoice && this.voiceRecognition) {
      try {
        this.voiceRecognition.stop();
      } catch (e) {}
      this.isRecordingVoice = false;
      if (btn) btn.classList.remove("recording");
      this.haptic("light");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        this.isRecordingVoice = true;
        if (btn) btn.classList.add("recording");
        this.haptic("medium");
        this.showToast("🎙️ Listening... Speak your task or thought");
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join("");
        if (input) {
          input.value = transcript;
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        this.isRecordingVoice = false;
        if (btn) btn.classList.remove("recording");
        if (event.error !== "no-speech") {
          this.showToast(`Voice input: ${event.error}`, 3000);
        }
      };

      recognition.onend = () => {
        this.isRecordingVoice = false;
        if (btn) btn.classList.remove("recording");
        this.haptic("success");
        if (input && input.value.trim()) {
          input.focus();
        }
      };

      this.voiceRecognition = recognition;
      recognition.start();
    } catch (err) {
      console.error("SpeechRecognition startup error:", err);
      this.isRecordingVoice = false;
      if (btn) btn.classList.remove("recording");
      this.showToast("Could not access microphone.", 3000);
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

    document.querySelectorAll(".guide-nav-link").forEach(link => {
      link.classList.remove("active");
    });
    if (btnEl) {
      btnEl.classList.add("active");
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

  async pollNetworkStatus() {
    try {
      const res = await fetch("/api/network/status");
      if (!res.ok) throw new Error("Network status fetch failed");
      const data = await res.json();
      this.networkStatus = data;
      this.lastSyncTime = Date.now();

      const pill = document.getElementById("systemStatusPill");
      const text = document.getElementById("statusText");

      if (data.connected) {
        if (pill) {
          pill.className = "status-pill online";
          pill.title = `MagicDNS: ${data.dns_name || 'N/A'} (Host: ${data.hostname})`;
          pill.onclick = null;
        }
        if (text) text.textContent = `Tailscale: ${data.tailscale_ip || data.dns_name || 'Online'}`;
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
          pill.title = "Tailscale is inactive. Run 'tailscale up' on host PC.";
          pill.onclick = null;
        }
        const isContainer = data.is_container || (data.lan_ip && data.lan_ip.startsWith("172."));
        if (text) text.textContent = isContainer ? `Container: ${data.lan_ip}` : `Host LAN: ${data.lan_ip}`;
        const lanLabel = isContainer ? "internal container network" : "local host LAN";
        this.showNetworkSyncBanner("Tailscale Disconnected", `Operating on ${lanLabel} (${data.lan_ip}). Remote updates from other devices won't synchronize until Tailscale connects.`, false);
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

  async retryNetworkSync() {
    this.showToast("Checking server connection...");
    await this.pollNetworkStatus();
    await Dashboard.refresh();
    this.showToast("Dashboard synchronized!");
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
    this.updateHeaderClockVisibility();

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

    // Update tab pane visibility
    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.remove("active");
    });

    const targetPane = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (targetPane) {
      targetPane.classList.add("active");
    }

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

  bindKeyboardShortcuts() {
    const input = document.getElementById("quickInput");

    // Global hotkey '/' to focus quick input (switches to dashboard first if needed)
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input && document.activeElement.tagName !== "TEXTAREA" && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        if (this.currentTab !== "dashboard") {
          this.switchTab("dashboard");
        }
        setTimeout(() => {
          if (input) input.focus();
        }, 50);
      }
    });

    // Enter key inside quick input
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.submitLog();
        }
      });
    }

    // Explicit listeners for voice and direct entry buttons
    const voiceBtn = document.getElementById("voiceInputBtn");
    if (voiceBtn) {
      voiceBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleVoiceInput();
      });
    }
    const directBtn = document.querySelector(".direct-entry-btn");
    if (directBtn) {
      directBtn.addEventListener("click", (e) => {
        e.preventDefault();
        Dashboard.openManualCreateModal();
      });
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
          this.showToast("Placed into Unorganized Queue for review", 4000);
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

  showToast(message, duration = 3000) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<i data-lucide="info" style="width:14px;height:14px;color:var(--focus-indigo);flex-shrink:0;"></i> <span>${message}</span>`;
    container.appendChild(toast);
    this.renderIcons();

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 250);
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

  async triggerManualBackup() {
    const msgEl = document.getElementById("backupStatusMsg");
    if (msgEl) msgEl.textContent = "Generating backup archive...";
    try {
      const res = await fetch("/api/backup/now", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const cloudInfo = data.cloud_status ? ` · Cloud: ${data.cloud_status}` : "";
        if (msgEl) msgEl.textContent = `Backup saved: ${data.filename} (${Math.round(data.size_bytes / 1024)} KB)${cloudInfo}`;
        this.showToast(`Backup created!${cloudInfo ? ' Drive: ' + data.cloud_status : ''}`);

        // Direct browser download of archive
        const downloadLink = document.createElement("a");
        downloadLink.href = `/api/backup/download/${encodeURIComponent(data.filename)}`;
        downloadLink.download = data.filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      } else {
        if (msgEl) msgEl.textContent = "Backup failed: " + (data.detail || "Server error");
        this.showToast("Backup failed", true);
      }
    } catch (err) {
      if (msgEl) msgEl.textContent = "Error initiating backup.";
      this.showToast("Network error initiating backup", true);
    }
  },

  loadProfileSettings() {
    const input = document.getElementById("settingsProfileNameInput");
    if (input && typeof Dashboard !== "undefined") {
      input.value = Dashboard.userName || "Hong Rong";
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
          Dashboard.renderGreeting();
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
      toggleBtn.textContent = this.pinRevealed ? "🙈 Hide PIN" : "👁️ Show PIN";
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
        this.showToast(err.detail || "Failed to switch model (Host only)", true);
      }
    } catch (err) {
      console.error(err);
      this.showToast("Network error switching model", true);
    }
  },

  async testLlmPing() {
    const resultEl = document.getElementById("llmTestResult");
    if (resultEl) {
      resultEl.style.color = "var(--text-muted)";
      resultEl.textContent = "Sending test inference to local engine...";
    }
    try {
      const res = await fetch("/api/llm/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && resultEl) {
        const engine = data.engine === "ollama" ? "🤖 Ollama Local LLM" : "⚡ Deterministic Regex Engine (Offline Fallback)";
        resultEl.style.color = "var(--normal-green)";
        const sampleTitle = (data.sample_result && data.sample_result.title) ? data.sample_result.title : "OK";
        const sampleType = (data.sample_result && data.sample_result.entity_type) ? data.sample_result.entity_type : "task";
        resultEl.innerHTML = `<strong>${engine}</strong> · Latency: <strong>${data.latency_ms}ms</strong> · Result: "${sampleTitle}" (${sampleType})`;
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
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
