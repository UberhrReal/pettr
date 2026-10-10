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
    if (typeof HoraceChat !== "undefined") HoraceChat.init();
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
      return { theme: "morning", label: "Morning Dawn" };
    } else if (hour >= 12 && hour < 17) {
      return { theme: "light", label: "Afternoon" };
    } else if (hour >= 17 && hour < 21) {
      return { theme: "evening", label: "Golden Hour" };
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
      this.showToast("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.", 4000, true);
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

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const isSecure = window.isSecureContext || isLocalhost;

    // Check Secure Context requirement:
    // Web Speech API is strictly blocked by browsers on unencrypted HTTP connections (other than localhost)
    if (!isSecure) {
      this.haptic("warning");
      this.showToast("Voice input requires HTTPS or localhost. Tap to troubleshoot.", 5000, true);
      this.openVoiceTroubleshootModal("insecure");
      return;
    }

    const startRecognition = () => {
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

          if (event.error === "no-speech") {
            return;
          }

          this.haptic("warning");
          if (event.error === "not-allowed") {
            this.showToast("Microphone access blocked. Tap to view troubleshooting steps.", 5000, true);
            this.openVoiceTroubleshootModal("denied");
          } else if (event.error === "service-not-allowed") {
            this.showToast("Speech service is disabled by your browser or operating system.", 4500, true);
          } else if (event.error === "audio-capture") {
            this.showToast("No microphone detected on your device.", 4000, true);
          } else if (event.error === "network") {
            this.showToast("Network error: Voice dictation requires an internet connection.", 4500, true);
          } else if (event.error !== "aborted") {
            this.showToast(`Voice input: ${event.error}`, 3500, true);
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
        this.showToast("Could not start voice recognition.", 3500, true);
      }
    };

    // Pre-request getUserMedia if available to trigger native browser prompt if not yet granted
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop());
          startRecognition();
        })
        .catch(err => {
          console.warn("Microphone getUserMedia check:", err);
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            this.haptic("warning");
            this.showToast("Microphone permission denied. Tap to view fix instructions.", 5000, true);
            this.openVoiceTroubleshootModal("denied");
          } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            this.haptic("warning");
            this.showToast("No microphone was detected on this device.", 4000, true);
          } else {
            startRecognition();
          }
        });
    } else {
      startRecognition();
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
      stream.getTracks().forEach(t => t.stop());

      if (noticeEl) {
        noticeEl.innerHTML = `
          <div style="font-weight:700; color:var(--normal-green); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="check-circle-2" style="width:15px;height:15px;"></i> Microphone Access Verified Successfully!
          </div>
          <div style="color:var(--text-main); font-size:12px; line-height:1.5;">
            Your browser granted audio access to PETTR. You can now close this window and use the microphone button on the dashboard.
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

  formatEventPeriod(startTime, endTime, includeDate = false) {
    if (!startTime) return "Today";
    const startMil = this.formatMilitaryTime(startTime, includeDate);
    if (!endTime) return startMil;
    const endMil = this.formatMilitaryTime(endTime, false);
    return `${startMil} – ${endMil}`;
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
        // Refresh the header pill to keep state synchronized
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

  async loadStorageMetrics() {
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
      const counts = db.counts || {};

      const diskPct = disk.used_percent || 0;

      // Build model tags preview if models exist
      let modelTagsHtml = "";
      if (llm.models && llm.models.length > 0) {
        modelTagsHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">` +
          llm.models.map(m => `<span style="font-size: 10.5px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); border: 1px solid var(--card-border); color: var(--text-main);">${m.name} (${m.formatted || ''})</span>`).join("") +
          `</div>`;
      }

      container.innerHTML = `
        <!-- Host Disk & App Footprint Banner -->
        <div class="storage-overview-banner">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">PETTR Total Footprint (Everything Included)</span>
              <div style="font-size: 22px; font-weight: 800; font-family: var(--font-mono); color: var(--text-main); margin-top: 2px;">
                ${totalApp.formatted || '0 B'}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Includes SQLite DB, local LLM weights, Python runtime, backups &amp; media
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Server Drive Capacity</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 2px;">
                ${disk.used_formatted || '0 B'} used / ${disk.free_formatted || '0 B'} free (${diskPct}%)
              </div>
            </div>
          </div>
          <div class="storage-progress-bar-bg" title="Host Server Drive Usage: ${diskPct}%">
            <div class="storage-progress-bar-fill" style="width: ${Math.min(100, Math.max(2, diskPct))}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px;">
            <span>0 GB</span>
            <span>Total Host Storage: ${disk.total_formatted || '0 B'}</span>
          </div>
        </div>

        <!-- 6 Storage Breakdown Cards -->
        <div class="storage-grid-cards">
          <!-- 1. SQLite Database -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                🗄️ SQLite Database
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

          <!-- 2. Local LLM Models (Ollama) -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                🤖 Local LLM Models (Ollama)
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

          <!-- 3. Python Runtime Environment -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                ⚙️ Runtime Environment (venv)
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

          <!-- 4. Notes & Media Attachments -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                🖼️ Notes &amp; Media Attachments
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

          <!-- 5. Backup Archives -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                📦 Backup Archives
              </span>
              <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--recurrence-purple);">
                ${backups.formatted || '0 B'}
              </span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
              ${backups.count || 0} zip archive${backups.count === 1 ? '' : 's'} in <code>backups/</code><br>
              Full snapshots containing SQLite, Markdown, and JSON.
            </div>
          </div>

          <!-- 6. Application Codebase -->
          <div class="storage-stat-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                ⚡ Application Codebase
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
