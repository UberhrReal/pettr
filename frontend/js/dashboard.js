/**
 * PETTR Dashboard Module
 * Full-width executive briefing, separate Projects & Tasks panels,
 * permanent collapsible Unorganised Queue, dynamic hero taglines,
 * accurate completion progress ring, and interactive category filters.
 */
const Dashboard = {
  tasks: { focus: [], trivial: [], standalone_focus: [], standalone_trivial: [], projects: [] },
  events: [],
  reminders: [],
  userName: "User",
  activeFilter: null,
  isUnorgCollapsed: false,
  isSnapshotLocked: false,
  snapshotBriefing: null,
  snapshotLockDate: null,
  isSnapshotRemarkLoading: false,
  dailyOrder: [],
  dailyOrderDate: (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })(),
  selectedDate: (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })(),

  getTodayString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  isToday() {
    const todayStr = this.getTodayString();
    return this.selectedDate === todayStr;
  },

  isFutureDay() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return this.selectedDate > todayStr;
  },

  isPastDay() {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (this.selectedDate < todayStr) return true;
    if (this.selectedDate === todayStr && this.isDaySealed(this.selectedDate)) return true;
    return false;
  },

  isDaySealed(dateStr) {
    if (!dateStr) return false;
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dateStr > todayStr) return false;
    if (localStorage.getItem(`pettr_debrief_sealed_${dateStr}`) === "true") return true;
    if (this.briefingData && this.briefingData.is_sealed && (this.briefingData.date_iso ? this.briefingData.date_iso === dateStr : this.selectedDate === dateStr)) return true;
    return false;
  },

  switchSelectedDate(newDate) {
    if (!newDate) return;
    this.selectedDate = newDate;
    this.dailyOrderDate = newDate;
    this.briefingData = null;
    this.snapshotBriefing = null;
    this.snapshotLockDate = newDate;
    try {
      this.isSnapshotLocked = localStorage.getItem("pettr_snapshot_lock_" + newDate) === "true";
    } catch (_) {
      this.isSnapshotLocked = false;
    }
    // Swap dailyOrder array immediately to this specific date's cache to avoid stale cross-contamination
    try {
      const saved = localStorage.getItem("pettr_daily_order_" + newDate);
      this.dailyOrder = saved ? JSON.parse(saved) : [];
    } catch (_) {
      this.dailyOrder = [];
    }
    this.applySnapshotLockUI();
    this.renderDailyOrder();
    this.refresh();
  },

  navigateDay(direction) {
    const parts = this.selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + direction);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    this.switchSelectedDate(`${yyyy}-${mm}-${dd}`);
  },

  jumpToToday() {
    this.switchSelectedDate(this.getTodayString());
  },

  updateDateNavigatorUI() {
    const labelEl = document.getElementById("dashboardSelectedDateLabel");
    const tagEl = document.getElementById("dashboardDateStatusTag");
    const jumpBtn = document.getElementById("dashboardJumpTodayBtn");
    const lockedBanner = document.getElementById("dashboardLockedArchiveBanner");
    const futureBanner = document.getElementById("dashboardFuturePreviewBanner");
    const lockedDateText = document.getElementById("lockedArchiveDateText");
    const futureDateText = document.getElementById("futurePreviewDateText");

    const parts = this.selectedDate.split("-").map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayName = dateObj.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

    if (this.isToday()) {
      if (labelEl) labelEl.textContent = dayName;
      if (this.isDaySealed(this.selectedDate)) {
        if (tagEl) {
          tagEl.innerHTML = `<i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> SEALED TODAY`;
          tagEl.className = "date-status-tag tag-past";
        }
        if (lockedBanner) {
          lockedBanner.style.display = "flex";
          if (lockedDateText) lockedDateText.textContent = `${dayName} (Debrief complete · Day sealed)`;
        }
      } else {
        if (tagEl) {
          tagEl.textContent = "LIVE TODAY";
          tagEl.className = "date-status-tag tag-today";
        }
        if (lockedBanner) lockedBanner.style.display = "none";
      }
      if (jumpBtn) jumpBtn.style.display = "none";
      if (futureBanner) futureBanner.style.display = "none";
    } else if (this.isFutureDay()) {
      if (labelEl) labelEl.textContent = dayName;
      if (tagEl) {
        tagEl.textContent = "FUTURE PREVIEW";
        tagEl.className = "date-status-tag tag-future";
      }
      if (jumpBtn) jumpBtn.style.display = "inline-flex";
      if (lockedBanner) lockedBanner.style.display = "none";
      if (futureBanner) {
        futureBanner.style.display = "flex";
        if (futureDateText) futureDateText.textContent = dayName;
      }
    } else {
      if (labelEl) labelEl.textContent = dayName;
      if (tagEl) {
        tagEl.textContent = "LOCKED ARCHIVE";
        tagEl.className = "date-status-tag tag-past";
      }
      if (jumpBtn) jumpBtn.style.display = "inline-flex";
      if (futureBanner) futureBanner.style.display = "none";
      if (lockedBanner) {
        lockedBanner.style.display = "flex";
        if (lockedDateText) lockedDateText.textContent = dayName;
      }
    }
    const isPast = this.isPastDay();
    this.updateManualCreationButtonsState(isPast);
    App.renderIcons();
  },

  updateManualCreationButtonsState(isPast) {
    const btnConfigs = [
      { id: "directEntryBtn", defaultTitle: "Directly add a task, event, reminder, or project without natural language parsing" },
      { id: "manualAddEventBtn", defaultTitle: "Directly add scheduled event" },
      { id: "manualAddProjectBtn", defaultTitle: "Create new project" },
      { id: "manualAddFocusBtn", defaultTitle: "Directly add deep work focus task" },
      { id: "manualAddTrivialBtn", defaultTitle: "Directly add quick trivial task" },
      { id: "manualAddReminderBtn", defaultTitle: "Directly add reminder" }
    ];

    btnConfigs.forEach(cfg => {
      const el = document.getElementById(cfg.id);
      if (!el) return;
      if (isPast) {
        el.disabled = true;
        el.classList.add("is-locked");
        el.setAttribute("aria-disabled", "true");
        el.title = "🔒 Locked: Past day archives cannot be edited. Return to Today to add new items.";
      } else {
        el.disabled = false;
        el.classList.remove("is-locked");
        el.removeAttribute("aria-disabled");
        el.title = cfg.defaultTitle;
      }
    });

    document.querySelectorAll(".manual-create-btn").forEach(el => {
      if (isPast) {
        el.disabled = true;
        el.classList.add("is-locked");
        el.setAttribute("aria-disabled", "true");
        el.title = "🔒 Locked: Past day archives cannot be edited. Return to Today to add new items.";
      } else {
        el.disabled = false;
        el.classList.remove("is-locked");
        el.removeAttribute("aria-disabled");
      }
    });
  },

  heroTaglines: [
    "Stop reorganising the dashboard and go finish the damn task",
    "Wow all this theming is really distracting, huh",
    "Thank you Horace, for adding $3 to my electricity bill",
    "Always remember that you- uh, uhm. I forgor.",
    `"Wah wah I have 17 open projects" bitch I'm a glorified to-do list idgaf`,
    "Accessible worldwide - if things ever get that bad"
  ],
  taglineIndex: 0,
  _taglineTimer: null,

  async init() {
    this.dailyOrderDate = this.selectedDate;
    this.snapshotLockDate = this.selectedDate;
    try {
      this.isSnapshotLocked = localStorage.getItem("pettr_snapshot_lock_" + this.selectedDate) === "true";
    } catch (_) {
      this.isSnapshotLocked = false;
    }
    try {
      const saved = localStorage.getItem("pettr_daily_order_" + this.selectedDate);
      if (saved) this.dailyOrder = JSON.parse(saved);
    } catch (_) {}
    DragDrop.initContainer(document.getElementById("focusTasksList"));
    DragDrop.initContainer(document.getElementById("trivialTasksList"));
    this.bindSummaryPills();
    this.initTaglineRotation();
    this.initUnorgPanelState();
    this.applySnapshotLockUI();
    this.startDiurnalWatcher();
    await this.loadUserProfile();
    await this.refresh();
  },

  initTaglineRotation() {
    const el = document.getElementById("heroDynamicTagline");
    if (!el) return;
    if (this._taglineTimer) {
      clearInterval(this._taglineTimer);
      this._taglineTimer = null;
    }
    this._taglineTimer = setInterval(() => {
      this.taglineIndex = (this.taglineIndex + 1) % this.heroTaglines.length;
      el.style.opacity = "0";
      setTimeout(() => {
        el.textContent = this.heroTaglines[this.taglineIndex];
        el.style.opacity = "1";
      }, 300);
    }, 5000);
  },

  initUnorgPanelState() {
    const saved = localStorage.getItem("pettr_unorg_collapsed");
    this.isUnorgCollapsed = saved === "true";
    this.applyUnorgCollapsedUI();
  },

  toggleUnorgCollapse() {
    this.isUnorgCollapsed = !this.isUnorgCollapsed;
    localStorage.setItem("pettr_unorg_collapsed", this.isUnorgCollapsed ? "true" : "false");
    this.applyUnorgCollapsedUI();
  },

  applyUnorgCollapsedUI() {
    const panel = document.getElementById("unorgPermanentPanel");
    const toggleBtn = document.getElementById("unorgCollapseBtn");
    if (!panel) return;

    if (this.isUnorgCollapsed) {
      panel.classList.add("collapsed");
      if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="panel-right-open" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i>Expand`;
    } else {
      panel.classList.remove("collapsed");
      if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="panel-right-close" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i>Hide`;
    }
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  async loadUserProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.user_name) {
          this.userName = data.user_name;
          localStorage.setItem("pettr_user_name", this.userName);
        }
      }
    } catch (e) {
      const saved = localStorage.getItem("pettr_user_name");
      if (saved) this.userName = saved;
    }
    const settingsInput = document.getElementById("settingsProfileNameInput");
    if (settingsInput) settingsInput.value = this.userName;
    this.renderGreeting();
  },

  typewriterGreetingTimer: null,
  typewriterCharIndex: 0,
  typewriterPhraseIndex: 0,
  isTypewriterDeleting: false,
  activeDiurnalPeriod: null,
  _diurnalWatcherTimer: null,
  _diurnalVisibilityBound: false,

  getDiurnalPeriod(hour = null) {
    const h = hour !== null ? hour : new Date().getHours();
    if (h >= 0 && h < 6) return "wee_hours";
    if (h >= 6 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "afternoon";
    if (h >= 18 && h < 23) return "evening";
    return "night";
  },

  checkDiurnalTransition() {
    const currentPeriod = this.getDiurnalPeriod();
    if (this.activeDiurnalPeriod && currentPeriod !== this.activeDiurnalPeriod) {
      console.log(`[PETTR] Diurnal transition detected: ${this.activeDiurnalPeriod} -> ${currentPeriod}. Auto-updating greeting lines.`);
      this.activeDiurnalPeriod = currentPeriod;
      this.startTypewriterGreeting();
    }
  },

  startDiurnalWatcher() {
    if (this._diurnalWatcherTimer) {
      clearInterval(this._diurnalWatcherTimer);
      this._diurnalWatcherTimer = null;
    }
    // Background polling every 30s to detect diurnal shift
    this._diurnalWatcherTimer = setInterval(() => {
      this.checkDiurnalTransition();
    }, 30000);

    // Also check on tab focus or visibility change (e.g. computer woke up from sleep or user switched back to tab)
    if (typeof document !== "undefined" && !this._diurnalVisibilityBound) {
      this._diurnalVisibilityBound = true;
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          this.checkDiurnalTransition();
        }
      });
      window.addEventListener("focus", () => {
        this.checkDiurnalTransition();
      });
    }
  },

  renderGreeting() {
    this.startTypewriterGreeting();
  },

  async startTypewriterGreeting(intelOverride = null) {
    if (this.typewriterGreetingTimer) {
      clearTimeout(this.typewriterGreetingTimer);
      this.typewriterGreetingTimer = null;
    }
    const greetingEl = document.getElementById("greetingText");
    const subtextEl = document.getElementById("greetingSubtext");
    if (!greetingEl) return;

    const clientHour = new Date().getHours();
    this.activeDiurnalPeriod = this.getDiurnalPeriod(clientHour);
    const isWeeHours = clientHour >= 0 && clientHour < 6;
    const isMorning = clientHour >= 6 && clientHour < 12;
    const isAfternoon = clientHour >= 12 && clientHour < 18;
    const isEvening = clientHour >= 18 && clientHour < 23;
    const isNight = clientHour >= 23;

    let phrases = [];
    let sub = "Ready to log and track your day.";
    let holidayInfo = null;

    if (intelOverride && intelOverride.phrases && intelOverride.phrases.length > 0) {
      phrases = [...intelOverride.phrases];
      if (intelOverride.subtext) sub = intelOverride.subtext;
      if (intelOverride.holiday) holidayInfo = intelOverride.holiday;
    } else {
      try {
        const res = await fetch(`/api/daily-intel?date=${encodeURIComponent(this.selectedDate || "")}&hour=${clientHour}`);
        if (res.ok) {
          const intel = await res.json();
          if (intel.phrases && intel.phrases.length > 0) phrases = intel.phrases;
          if (intel.subtext) sub = intel.subtext;
          if (intel.holiday) holidayInfo = intel.holiday;
        }
      } catch (e) {
        console.warn("Failed to fetch daily-intel:", e);
      }
    }

    this.renderHolidayDecorations(holidayInfo);

    // Filter out phrases that contradict current diurnal time-of-day
    const morningKws = [
      'good morning', 'morning', 'first coffee', 'morning coffee', 'dawn', 'sunrise',
      'kick off', 'kickstart', 'start strong', 'start today', 'start the day',
      'starting today', 'early start', 'early hours', 'rise and shine', 'wake up', 'am sprint'
    ];
    const afternoonKws = [
      'good afternoon', 'afternoon', 'midday', 'midday boost', 'midday check-in',
      'lunch', 'post-lunch', 'halfway through', 'afternoon sprint', 'working hard or hardly working'
    ];
    const eveningKws = [
      'good evening', 'evening', 'wrap it up', 'wrap up', 'wrapping up',
      'wind down', 'winding down', 'call it a day', 'landing', 'rest soon',
      'relax', 'sign off', 'signing off', 'close out the day', 'close out today',
      'end of day', 'eod', 'bedtime', 'evening debrief', 'time to unwind', 'smooth landing'
    ];
    const nightKws = [
      'midnight', 'night owl', 'quiet hours', 'late night', 'burn the midnight oil',
      'burning the midnight oil', 'sleep soon', 'recharge batteries', 'recharge soon'
    ];
    const weeHoursKws = [
      'wee hours', 'small hours', 'dead of night', 'witching hour', 'stillness of the night'
    ];

    phrases = phrases.filter(p => {
      const lower = p.toLowerCase();
      if (!isWeeHours && weeHoursKws.some(k => lower.includes(k))) return false;
      if (!isNight && !isWeeHours && nightKws.some(k => lower.includes(k))) return false;
      if (!isMorning && morningKws.some(k => lower.includes(k))) return false;
      if (!isAfternoon && afternoonKws.some(k => lower.includes(k))) return false;
      if (!isEvening && eveningKws.some(k => lower.includes(k))) return false;
      return true;
    });

    // If fewer than 3 phrases remain, supplement with rich diurnal phrases to guarantee variety
    if (phrases.length < 3) {
      let defaults = [];
      if (isWeeHours) {
        defaults = [
          `Stillness of the wee hours across the workspace, ${this.userName}.`,
          `Zero distractions in the quiet hours while the world sleeps.`,
          `The quiet hours offer a rare window for undisturbed focus.`,
          `Deep nocturnal velocity and deliberate thinking tonight, ${this.userName}.`,
          `Breakthroughs often happen during undisturbed quiet hours.`,
          `A quiet focus window for thoughtful creative work and reflection.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Wee hours hyperfocus active. Undisturbed quiet.";
      } else if (isMorning) {
        defaults = [
          `Good morning, ${this.userName}. The desk is clear and ready for the day.`,
          `First coffee poured and ready for high-leverage focus work.`,
          `Clear head and an organised queue to kick off the day, ${this.userName}.`,
          `Steady momentum starts with tackling the single biggest priority.`,
          `Prioritise the essential objectives before attending to small errands.`,
          `Morning diagnostics green with deep focus locked in today.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Morning momentum begins now.";
      } else if (isAfternoon) {
        defaults = [
          `Cruising altitude reached with steady cadence through the afternoon, ${this.userName}.`,
          `Midday checkpoint: stay locked in flow and maintain deliberate rhythm.`,
          `Steady execution across your core coursework and projects, ${this.userName}.`,
          `Remember to reset posture, hydrate, and maintain your thinking rhythm.`,
          `Quality craft takes patience, precision, and uninterrupted focus.`,
          `Protect your cognitive bandwidth and see this work block through.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Deep work window active.";
      } else if (isEvening) {
        defaults = [
          `Good evening, ${this.userName}. Time to tie off your remaining open loops.`,
          `Smooth landing underway: review and seal your completed work today.`,
          `Key objectives checked off with steady persistence today, ${this.userName}.`,
          `Great execution across the queue today: prepare to wind down.`,
          `Evening debrief window open to capture key takeaways and reflections.`,
          `Another productive day ready to be reviewed and sealed tonight.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Review your progress and close out open loops.";
      } else {
        defaults = [
          `Burning the midnight oil to close out the final details, ${this.userName}?`,
          `Late-night checklist complete: record your progress and rest soon.`,
          `Quiet hours active: wrap up your thoughts and recharge tonight, ${this.userName}.`,
          `Set aside tomorrow's priorities cleanly and rest up tonight.`,
          `Rest is a vital part of personal craft and well-being.`,
          `Sign off with satisfaction and let your mind recharge fully.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Quiet hours active. Rest soon.";
      }
      for (const d of defaults) {
        if (!phrases.includes(d)) phrases.push(d);
      }
    }

    // Repair partial name truncations if user has a multi-word display name (e.g. "Hong Rong" -> "Rong")
    if (this.userName && this.userName.includes(" ")) {
      const parts = this.userName.split(/\s+/).filter(p => p.length >= 2);
      phrases = phrases.map(p => {
        let fixed = p;
        for (const part of parts) {
          if (fixed.includes(part) && !fixed.includes(this.userName)) {
            fixed = fixed.replace(new RegExp(`\\b${part}\\b`, 'g'), this.userName);
          }
        }
        return fixed;
      });
    }

    // Minimum word count filter (at least 6 words excluding user name) and sanitize length
    const cleanUserName = (this.userName || "").toLowerCase();
    phrases = phrases.map(p => String(p || "").trim()).filter(p => {
      if (!p) return false;
      const stripped = p.toLowerCase().replaceAll(cleanUserName, "").trim();
      const words = stripped.split(/\s+/).filter(Boolean);
      return words.length >= 6;
    });

    // Guarantee top typewriter phrases NEVER duplicate the bottom subtext
    phrases = phrases.filter(p => p.trim().toLowerCase() !== sub.trim().toLowerCase());
    if (phrases.length === 0) {
      phrases = [`Good day, ${this.userName}. The workspace is primed for deliberate focus and execution.`];
    }

    if (subtextEl) {
      const cleanSub = String(sub).replace(/^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2}\s*·\s*/, '');
      subtextEl.textContent = cleanSub;
      subtextEl.style.cursor = "pointer";
      subtextEl.title = "Click to refresh daily intel";
      if (!subtextEl.dataset.hasIntelListener) {
        subtextEl.dataset.hasIntelListener = "true";
        subtextEl.addEventListener("click", () => Dashboard.refreshDailyIntel());
      }
    }

    this.typewriterPhraseIndex = this.typewriterPhraseIndex % phrases.length;
    this.typewriterCharIndex = 0;
    this.isTypewriterDeleting = false;

    const scrollGreetingToEnd = () => {
      if (!greetingEl) return;
      greetingEl.style.transform = '';
      const maxScroll = greetingEl.scrollWidth - greetingEl.clientWidth;
      if (maxScroll > 0) {
        greetingEl.scrollLeft = maxScroll;
      } else {
        greetingEl.scrollLeft = 0;
      }
    };

    const tick = () => {
      const currentPhrase = phrases[this.typewriterPhraseIndex];
      if (!currentPhrase) return;

      if (!this.isTypewriterDeleting) {
        this.typewriterCharIndex++;
        greetingEl.innerHTML = `${this.escapeHtml(currentPhrase.slice(0, this.typewriterCharIndex))}<span class="typewriter-cursor">|</span>`;
        scrollGreetingToEnd();
        if (this.typewriterCharIndex >= currentPhrase.length) {
          this.isTypewriterDeleting = true;
          this.typewriterGreetingTimer = setTimeout(tick, 4800);
          return;
        }
        this.typewriterGreetingTimer = setTimeout(tick, 38);
      } else {
        this.typewriterCharIndex--;
        greetingEl.innerHTML = `${this.escapeHtml(currentPhrase.slice(0, this.typewriterCharIndex))}<span class="typewriter-cursor">|</span>`;
        scrollGreetingToEnd();
        if (this.typewriterCharIndex <= 0) {
          this.isTypewriterDeleting = false;
          greetingEl.scrollLeft = 0;
          this.typewriterPhraseIndex = (this.typewriterPhraseIndex + 1) % phrases.length;
          this.typewriterGreetingTimer = setTimeout(tick, 600);
          return;
        }
        this.typewriterGreetingTimer = setTimeout(tick, 18);
      }
    };

    tick();
  },

  async refreshDailyIntel() {
    const subtextEl = document.getElementById("greetingSubtext");
    const refreshBtn = document.getElementById("refreshDailyIntelBtn");
    try {
      if (subtextEl) subtextEl.style.opacity = "0.5";
      if (refreshBtn) refreshBtn.classList.add("spinning");
      const clientHour = new Date().getHours();
      const res = await fetch(`/api/daily-intel?date=${encodeURIComponent(this.selectedDate || "")}&hour=${clientHour}&refresh=true`);
      if (res.ok) {
        const intel = await res.json();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Regenerated daily intel with fresh fun fact", "success");
        }
        await this.startTypewriterGreeting(intel);
      }
    } catch (e) {
      console.error("Failed to refresh daily intel:", e);
    } finally {
      if (subtextEl) subtextEl.style.opacity = "";
      if (refreshBtn) refreshBtn.classList.remove("spinning");
    }
  },

  initTypewriter(phrases, subtext) {
    return this.startTypewriterGreeting({ phrases, subtext });
  },

  renderHolidayDecorations(holiday) {
    const badgeEl = document.getElementById("dashboardHolidayBadge");
    const ornamentsEl = document.getElementById("greetingOrnamentsContainer");

    if (!holiday || !holiday.name) {
      if (badgeEl) badgeEl.style.display = "none";
      if (ornamentsEl) ornamentsEl.innerHTML = "";
      return;
    }

    if (badgeEl) {
      badgeEl.innerHTML = `<span>${this.escapeHtml(holiday.icon || "🎉")}</span> <span>${this.escapeHtml(holiday.name)}</span>`;
      badgeEl.style.display = "inline-flex";
      badgeEl.title = `${holiday.name} Celebrations Active`;
    }

    if (ornamentsEl) {
      const icons = holiday.decorations || [holiday.icon || "✨", "🎉", "🌟", "🎈"];
      ornamentsEl.innerHTML = icons.map(icon => `<span class="holiday-ornament">${this.escapeHtml(icon)}</span>`).join("");
    }
  },

  async applyNewUserName(newName) {
    this.userName = (newName || "").trim();
    localStorage.setItem("pettr_user_name", this.userName);

    const settingsInput = document.getElementById("settingsProfileNameInput");
    if (settingsInput) settingsInput.value = this.userName;

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: this.userName })
      });
      if (res.ok) {
        if (typeof App !== "undefined" && App.showToast) {
          App.showToast(`Display name updated to "${this.userName}"!`);
        }
        await this.refreshDailyIntel();
      } else {
        this.renderGreeting();
      }
    } catch (e) {
      console.warn("Could not persist name to server:", e);
      this.renderGreeting();
    }
  },

  bindSummaryPills() {
    document.querySelectorAll(".stat-pill[data-filter]").forEach(pill => {
      pill.addEventListener("click", () => {
        const filterType = pill.dataset.filter;
        this.filterCategory(filterType);
      });
    });
  },

  filterCategory(category) {
    if (category === "unorganized") {
      this.openUnorganizedModal();
      return;
    }

    if (this.activeFilter === category) {
      this.clearFilter();
      return;
    }

    this.activeFilter = category;
    this.applyPanelFilter();

    const targetMap = {
      focus: "focusCardSection",
      trivial: "trivialCardSection",
      events: "eventsCardSection",
      projects: "projectsCardSection",
      reminders: "remindersCardSection"
    };
    const panelEl = document.getElementById(targetMap[category] || "");
    if (panelEl) {
      panelEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    App.showToast(`Filtering by ${category}`);
  },

  applyPanelFilter() {
    const category = this.activeFilter;
    const bar = document.getElementById("filterActiveBar");
    const label = document.getElementById("filterActiveLabel");
    const overviewRow = document.querySelector(".dashboard-overview-row");
    const dynamicPanels = document.getElementById("dashboardDynamicPanels");
    const showcase = document.getElementById("briefingShowcaseWindow");
    const unorgPanel = document.getElementById("unorgPermanentPanel");

    const panelMap = {
      events: document.getElementById("eventsCardSection"),
      projects: document.getElementById("projectsCardSection"),
      focus: document.getElementById("focusCardSection"),
      trivial: document.getElementById("trivialCardSection"),
      reminders: document.getElementById("remindersCardSection")
    };

    document.querySelectorAll(".stat-pill").forEach(p => {
      p.classList.toggle("active", Boolean(category && p.dataset.filter === category));
    });

    if (!category || !panelMap[category]) {
      if (bar) bar.style.display = "none";
      if (showcase) showcase.classList.remove("filter-panel-hidden");
      if (unorgPanel) unorgPanel.classList.remove("filter-panel-hidden");
      if (overviewRow) overviewRow.classList.remove("filter-single-panel");
      if (dynamicPanels) dynamicPanels.classList.remove("filter-panel-hidden");
      Object.values(panelMap).forEach(el => {
        if (el) el.classList.remove("filter-panel-hidden", "filter-focused-panel");
      });
      return;
    }

    const names = {
      focus: "Focus Tasks (Deep Work)",
      trivial: "Trivial Tasks",
      events: "Scheduled Events",
      projects: "Projects Today",
      reminders: "Reminders"
    };
    if (bar && label) {
      bar.style.display = "flex";
      label.textContent = `Filtering view: ${names[category] || category}`;
    }

    if (showcase) showcase.classList.add("filter-panel-hidden");
    if (unorgPanel) unorgPanel.classList.add("filter-panel-hidden");

    Object.entries(panelMap).forEach(([key, el]) => {
      if (!el) return;
      const isMatch = (key === category);
      el.classList.toggle("filter-panel-hidden", !isMatch);
      el.classList.toggle("filter-focused-panel", isMatch && el.classList.contains("dynamic-panel"));
    });

    if (overviewRow) {
      overviewRow.classList.toggle("filter-single-panel", category !== "events");
    }
    if (dynamicPanels) {
      dynamicPanels.classList.toggle("filter-panel-hidden", category === "events");
    }
  },

  clearFilter() {
    this.activeFilter = null;
    this.applyPanelFilter();
    App.showToast("All panels visible");
  },

  async refresh() {
    this.updateDateNavigatorUI();
    const refreshDate = this.selectedDate;
    await Promise.all([
      this.loadTasks(),
      this.loadEvents(),
      this.loadReminders(),
      this.loadDailyOrder(),
      this.checkUnorganized(),
      this.loadProductivityStats(),
      this.loadSnapshotBriefing()
    ]);
    if (this.selectedDate === refreshDate) {
      this.reconcileDailyOrderTitles();
      this.renderDailyOrder();
    }
    await this.loadBriefing();
    this.updateProgressRing();
    this.adjustPanelScaling();
    this.applyPanelFilter();
    this.applySnapshotLockUI();
    if (typeof EveningDebrief !== "undefined") EveningDebrief.updateDebriefButtonState();
    App.renderIcons();
  },

  adjustPanelScaling() {
    const standaloneFocus = this.tasks.standalone_focus || (this.tasks.focus || []).filter(t => !t.project_id);
    const standaloneTrivial = this.tasks.standalone_trivial || (this.tasks.trivial || []).filter(t => !t.project_id);
    const projects = this.tasks.projects || [];
    const reminders = this.reminders || [];

    const countFocus = standaloneFocus.length;
    const countTrivial = standaloneTrivial.length;
    const countProjects = projects.length;
    const countReminders = reminders.length;

    // Update badge counters
    const badgeProjects = document.getElementById("badgeCountProjects");
    const badgeFocus = document.getElementById("badgeCountFocus");
    const badgeTrivial = document.getElementById("badgeCountTrivial");
    const badgeReminders = document.getElementById("badgeCountReminders");

    if (badgeProjects) badgeProjects.textContent = `${countProjects} project${countProjects === 1 ? '' : 's'}`;
    if (badgeFocus) badgeFocus.textContent = `${countFocus} task${countFocus === 1 ? '' : 's'}`;
    if (badgeTrivial) badgeTrivial.textContent = `${countTrivial} trivial`;
    if (badgeReminders) badgeReminders.textContent = `${countReminders} note${countReminders === 1 ? '' : 's'}`;

    // Panels elements
    const panelProjects = document.getElementById("projectsCardSection");
    const panelFocus = document.getElementById("focusCardSection");
    const panelTrivial = document.getElementById("trivialCardSection");
    const panelReminders = document.getElementById("remindersCardSection");

    const listFocus = document.getElementById("focusTasksList");
    const listTrivial = document.getElementById("trivialTasksList");
    const listReminders = document.getElementById("remindersList");

    // Dynamic sizing logic:
    // Scale Trivial Tasks panel:
    if (panelTrivial) {
      if (countTrivial >= 5) {
        panelTrivial.style.setProperty("--panel-flex", "2 1 calc(60% - 16px)");
        if (listTrivial) listTrivial.style.setProperty("--grid-cols", "repeat(auto-fill, minmax(280px, 1fr))");
      } else {
        panelTrivial.style.setProperty("--panel-flex", "1 1 calc(45% - 16px)");
        if (listTrivial) listTrivial.style.setProperty("--grid-cols", "1fr");
      }
    }

    // Scale Focus Tasks panel:
    if (panelFocus) {
      if (countFocus >= 5) {
        panelFocus.style.setProperty("--panel-flex", "2 1 calc(60% - 16px)");
        if (listFocus) listFocus.style.setProperty("--grid-cols", "repeat(auto-fill, minmax(280px, 1fr))");
      } else {
        panelFocus.style.setProperty("--panel-flex", "1 1 calc(35% - 16px)");
        if (listFocus) listFocus.style.setProperty("--grid-cols", "1fr");
      }
    }

    // Scale Projects panel:
    if (panelProjects) {
      if (countProjects >= 2 || (projects.some(p => (p.tasks || []).length >= 4))) {
        panelProjects.style.setProperty("--panel-flex", "2 1 calc(65% - 16px)");
      } else {
        panelProjects.style.setProperty("--panel-flex", "1 1 calc(45% - 16px)");
      }
    }

    // Scale Reminders panel:
    if (panelReminders) {
      if (countReminders >= 5) {
        panelReminders.style.setProperty("--panel-flex", "2 1 calc(50% - 16px)");
        if (listReminders) listReminders.style.setProperty("--grid-cols", "repeat(auto-fill, minmax(260px, 1fr))");
      } else {
        panelReminders.style.setProperty("--panel-flex", "1 1 calc(35% - 16px)");
        if (listReminders) listReminders.style.setProperty("--grid-cols", "1fr");
      }
    }
  },

  updateProgressRing() {
    // Total includes all standalone tasks + all project child tasks + scheduled events
    let total = 0;
    let completed = 0;

    const countList = (list) => {
      if (!list) return;
      list.forEach(t => {
        total++;
        if (t.status === "completed") completed++;
      });
    };

    countList(this.tasks.focus);
    countList(this.tasks.trivial);

    // Count project tasks if any were not in focus/trivial
    (this.tasks.projects || []).forEach(p => {
      (p.tasks || []).forEach(pt => {
        const inFocus = (this.tasks.focus || []).some(t => t.id === pt.id);
        const inTrivial = (this.tasks.trivial || []).some(t => t.id === pt.id);
        if (!inFocus && !inTrivial) {
          total++;
          if (pt.status === "completed") completed++;
        }
      });
    });

    // Count today's events ("they count!")
    (this.events || []).forEach(e => {
      total++;
      if (e.status === "completed") completed++;
    });

    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const remaining = Math.max(0, total - completed);

    const textEl = document.getElementById("progressRingText");
    const subtextEl = document.getElementById("progressRingSubtext");
    const circleEl = document.getElementById("progressRingCircle");

    if (this.isFutureDay()) {
      if (textEl) textEl.textContent = "—%";
      if (subtextEl) subtextEl.innerHTML = `<span style="color:var(--accent-cyan); font-weight:600;">Scheduled Preview</span> · Tracking inactive until date arrives (${total} scheduled)`;
      if (circleEl) {
        const c = 138.23;
        circleEl.style.strokeDasharray = "4 4";
        circleEl.style.strokeDashoffset = "0";
        circleEl.style.stroke = "var(--text-dim)";
        circleEl.style.opacity = "0.35";
      }
    } else if (this.isPastDay()) {
      if (textEl) textEl.textContent = `${pct}%`;
      if (subtextEl) subtextEl.innerHTML = `<span style="color:var(--urgent-orange); font-weight:600;">🔒 Historical Record (Locked)</span> · ${completed} of ${total} items completed on ${this.selectedDate}`;
      if (circleEl) {
        const c = 138.23;
        circleEl.style.strokeDasharray = `${c}`;
        circleEl.style.strokeDashoffset = `${c - (pct / 100) * c}`;
        circleEl.style.stroke = "";
        circleEl.style.opacity = "0.85";
      }
    } else {
      if (textEl) textEl.textContent = `${pct}%`;
      const focusExtra = this.todayFocusHours ? ` · ${this.todayFocusHours}h focus` : '';
      if (subtextEl) subtextEl.textContent = `${completed} of ${total} completed (${remaining} remaining)${focusExtra}`;
      if (circleEl) {
        const c = 138.23;
        circleEl.style.strokeDasharray = `${c}`;
        circleEl.style.strokeDashoffset = `${c - (pct / 100) * c}`;
        circleEl.style.stroke = "";
        circleEl.style.opacity = "1";
      }
    }
  },

  switchOverviewMode(mode) {
    this.overviewMode = mode;
    const btnToday = document.getElementById("ovBtnToday");
    const btnWeek = document.getElementById("ovBtnWeek");
    const btnMonth = document.getElementById("ovBtnMonth");

    if (btnToday) btnToday.classList.toggle("active", mode === "today");
    if (btnWeek) btnWeek.classList.toggle("active", mode === "week");
    if (btnMonth) btnMonth.classList.toggle("active", mode === "month");

    const cToday = document.getElementById("overviewTodayContainer");
    const cWeek = document.getElementById("overviewWeekContainer");
    const cMonth = document.getElementById("overviewMonthContainer");

    if (cToday) cToday.style.display = mode === "today" ? "block" : "none";
    if (cWeek) cWeek.style.display = mode === "week" ? "block" : "none";
    if (cMonth) cMonth.style.display = mode === "month" ? "block" : "none";

    if (mode === "week" || mode === "month") {
      this.loadProductivityStats();
    }
  },

  async loadProductivityStats() {
    try {
      const res = await fetch("/api/productivity");
      if (!res.ok) return;
      const data = await res.json();
      this.renderProductivityStats(data);
    } catch (err) {
      console.error("Error loading productivity stats:", err);
    }
  },

  renderProductivityStats(data) {
    if (!data) return;
    const { weekly, monthly, today } = data;

    // Today Focus Hours integration
    const todayFocusHours = (today && today.focus_hours) !== undefined ? today.focus_hours : 0;
    this.todayFocusHours = todayFocusHours;
    const statFocusEl = document.getElementById("statTodayFocusHours");
    if (statFocusEl) {
      statFocusEl.textContent = `${todayFocusHours}h`;
    }
    this.updateProgressRing();

    // 1. Weekly View
    const weekBadge = document.getElementById("weekProductivityBadge");
    if (weekBadge) {
      weekBadge.textContent = `${weekly.overall_rate_pct}% avg`;
      weekBadge.style.color = weekly.overall_rate_pct >= 70 ? "var(--normal-green)" : (weekly.overall_rate_pct > 0 ? "var(--urgent-orange)" : "var(--text-muted)");
    }

    const weekFocusBadge = document.getElementById("weekFocusHoursBadge");
    if (weekFocusBadge) {
      const wkHours = weekly.total_focus_hours || 0;
      weekFocusBadge.innerHTML = `<i data-lucide="timer" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> ${wkHours}h`;
      weekFocusBadge.title = `Total focus time this week: ${wkHours}h across ${weekly.total_focus_sessions || 0} sprints (click to view History telemetry)`;
    }

    const grid = document.getElementById("productivityWeekGrid");
    if (grid && weekly.days) {
      grid.innerHTML = "";
      weekly.days.forEach(d => {
        const col = document.createElement("div");
        col.className = "prod-day-col";

        const pctText = d.completion_rate !== null ? `${d.completion_rate}%` : "-";
        const fillHeight = d.completion_rate !== null ? Math.max(d.completion_rate, 4) : 0;
        
        let fillColor = "var(--text-muted)";
        if (d.completion_rate !== null) {
          if (d.completion_rate >= 80) fillColor = "var(--normal-green)";
          else if (d.completion_rate >= 50) fillColor = "var(--text-main)";
          else if (d.completion_rate > 0) fillColor = "var(--urgent-orange)";
        }

        const focusText = (d.focus_hours > 0) ? `${d.focus_hours}h` : '0h';

        col.innerHTML = `
          <span style="font-size: 10px; font-weight: 700; color: ${d.is_today ? 'var(--text-main)' : 'var(--text-muted)'}; font-family: var(--font-mono);">${pctText}</span>
          <div class="prod-bar-track" title="${d.day_name} (${d.date}): ${d.completed}/${d.total} tasks completed • ${d.focus_hours || 0}h focus logged">
            <div class="prod-bar-fill" style="height: ${fillHeight}%; background: ${fillColor}; opacity: ${d.completion_rate === null ? '0.25' : '1'};"></div>
          </div>
          <span class="prod-day-label ${d.is_today ? 'today-label' : ''}" style="${d.is_today ? 'font-weight: 800; color: var(--text-main); text-decoration: underline;' : ''}">${d.day_name}</span>
          <span style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-mono);">${d.completed}/${d.total}</span>
          <span class="prod-focus-tag" style="font-size: 9px; font-weight: 700; color: ${d.focus_hours > 0 ? 'var(--focus-indigo)' : 'var(--text-dim)'}; font-family: var(--font-mono);" title="${d.focus_hours || 0}h focus logged">${focusText}</span>
        `;
        grid.appendChild(col);
      });
    }

    const weekSummary = document.getElementById("weekProductivitySummary");
    if (weekSummary) {
      const wkHours = weekly.total_focus_hours || 0;
      const wkSprints = weekly.total_focus_sessions || 0;
      weekSummary.innerHTML = `<strong>${weekly.total_completed} of ${weekly.total_scheduled} tasks completed</strong> (${weekly.overall_rate_pct}% avg) &bull; <strong style="color:var(--focus-indigo);">${wkHours} hrs</strong> logged across ${wkSprints} focus sprints this week.`;
    }

    // 2. Monthly View
    const monthTitle = document.getElementById("monthProductivityTitle");
    if (monthTitle) monthTitle.textContent = `${monthly.month_name} Performance`;

    const monthBadge = document.getElementById("monthProductivityBadge");
    if (monthBadge) {
      monthBadge.textContent = `${monthly.completion_rate_pct}% completed`;
      monthBadge.style.color = monthly.completion_rate_pct >= 70 ? "var(--normal-green)" : (monthly.completion_rate_pct > 0 ? "var(--urgent-orange)" : "var(--text-muted)");
    }

    const monthFocusBadge = document.getElementById("monthFocusHoursBadge");
    if (monthFocusBadge) {
      const mHours = monthly.focus_hours || 0;
      monthFocusBadge.innerHTML = `<i data-lucide="timer" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> ${mHours}h`;
    }
    App.renderIcons();

    const monthFill = document.getElementById("monthProgressFill");
    if (monthFill) {
      monthFill.style.width = `${monthly.completion_rate_pct}%`;
      monthFill.style.background = monthly.completion_rate_pct >= 70 ? "var(--normal-green)" : "var(--text-main)";
    }

    const monthDetails = document.getElementById("monthProductivityDetails");
    if (monthDetails) {
      monthDetails.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <span>Completed Tasks:</span>
          <strong style="color:var(--text-main); font-family:var(--font-mono);">${monthly.completed_tasks} / ${monthly.total_tasks}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <span>Focus Time Logged:</span>
          <strong style="color:var(--focus-indigo); font-family:var(--font-mono);">${monthly.focus_hours || 0} hrs (${monthly.focus_sessions || 0} sprints)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <span>Active Ongoing Projects:</span>
          <strong style="color:var(--text-main); font-family:var(--font-mono);">${monthly.active_projects}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Remaining Pending Tasks:</span>
          <strong style="color:var(--text-main); font-family:var(--font-mono);">${monthly.pending_tasks}</strong>
        </div>
      `;
    }
  },

  async loadBriefing() {
    try {
      const res = await fetch(`/api/briefing?date=${this.selectedDate}`);
      if (!res.ok) return;
      const data = await res.json();
      this.briefingData = data;
      if (data.is_sealed) {
        localStorage.setItem(`pettr_debrief_sealed_${this.selectedDate}`, "true");
      } else {
        localStorage.removeItem(`pettr_debrief_sealed_${this.selectedDate}`);
      }
      this.updateDateNavigatorUI();
      this.updateManualCreationButtonsState(this.isPastDay());
      const dateEl = document.getElementById("briefingDate");
      if (dateEl) dateEl.textContent = data.date;

      document.getElementById("statFocus").textContent = data.focus_count;
      document.getElementById("statTrivial").textContent = data.trivial_count;
      document.getElementById("statEvents").textContent = data.events_count;
      document.getElementById("statProjects").textContent = data.active_projects_count;
      document.getElementById("statReminders").textContent = data.reminders_count;

      const tomorrowEl = document.getElementById("tomorrowBlurb");
      if (tomorrowEl) {
        if (data.tomorrow_outlook && data.tomorrow_outlook.witty_quip) {
          const o = data.tomorrow_outlook;
          const compSign = o.comparison === "heavier" ? "📈 Heavier" : (o.comparison === "lighter" ? "📉 Lighter" : "⚖️ Balanced");
          tomorrowEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:700; color:var(--text-main);">Tomorrow: ${compSign} Load (${o.total_items} item${o.total_items === 1 ? '' : 's'})</span>
              <span style="font-size:11px; color:var(--text-muted);">${o.focus_count} focus · ${o.trivial_count} trivial · ${o.reminders_count} reminders</span>
            </div>
            <div style="font-style:italic; color:var(--text-muted); font-size:11.5px; border-left: 2px solid var(--card-border); padding-left: 8px; margin-top: 4px;">
              "${o.witty_quip}"
            </div>
          `;
        } else {
          tomorrowEl.textContent = data.tomorrow_blurb || "Tomorrow: Clear slate ahead.";
        }
      }

      // Full-width morning briefing visual formatting and raw markdown
      this.briefingData = data;
      const textRes = await fetch(`/api/briefing/text?date=${this.selectedDate}`).catch(() => null);
      if (textRes && textRes.ok) {
        const textData = await textRes.json();
        this.briefingMarkdown = textData.markdown || "";
        const richEl = document.getElementById("briefingRichContent");
        if (richEl) richEl.textContent = this.briefingMarkdown;
        this.renderVisualBriefing(data, this.briefingMarkdown);
      } else {
        this.renderVisualBriefing(data, "");
      }
    } catch (err) {
      console.error("Error loading briefing:", err);
    }
  },

  formatSnapshotTimeMarker(task, selectedDate) {
    const isDone = task.status === "completed";
    const targetDate = selectedDate || this.selectedDate || new Date().toISOString().split("T")[0];
    const taskDateStr = task.due_date ? String(task.due_date).split("T")[0].split(" ")[0] : "";
    const milTime = task.due_date_military || (task.due_date ? App.formatMilitaryTime(task.due_date) : "");
    const isOverdue = Boolean(!isDone && (task.is_overdue || task.is_rolled_over || (task.urgency && task.urgency.label === "Overdue") || (taskDateStr && taskDateStr < targetDate)));

    if (!isOverdue) {
      return {
        isOverdue: false,
        timeBadge: milTime ? `@ ${milTime}` : "",
        displayText: milTime ? `@ ${milTime}` : ""
      };
    }

    let relativeDay = "";
    if (taskDateStr && targetDate) {
      try {
        const [tY, tM, tD] = taskDateStr.split("-").map(Number);
        const [sY, sM, sD] = targetDate.split("-").map(Number);
        const dTask = new Date(tY, tM - 1, tD);
        const dSel = new Date(sY, sM - 1, sD);
        const diffDays = Math.round((dSel - dTask) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          relativeDay = "Yesterday";
        } else if (diffDays > 1) {
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          relativeDay = `${monthNames[tM - 1]} ${String(tD).padStart(2, "0")}`;
        }
      } catch (e) {
        relativeDay = taskDateStr;
      }
    }

    let overdueTimeText = "";
    if (relativeDay && milTime) {
      overdueTimeText = `${relativeDay} @ ${milTime}`;
    } else if (relativeDay) {
      overdueTimeText = `Due ${relativeDay}`;
    } else if (milTime) {
      overdueTimeText = `Earlier @ ${milTime}`;
    } else {
      overdueTimeText = "Overdue";
    }

    return {
      isOverdue: true,
      timeBadge: overdueTimeText,
      displayText: overdueTimeText
    };
  },

  renderVisualBriefing(briefingData, rawMarkdown) {
    const container = document.getElementById("briefingVisualContainer");
    if (!container) return;

    const data = briefingData || this.briefingData || {};
    const outlook = data.tomorrow_outlook || {};
    const witty = outlook.witty_quip || "Focus deeply, execute swiftly, and reflect calmly.";

    // Parse focus, trivial, appointments, reminders into structured snapshot
    let html = `
      <div class="briefing-section-block">
        <div class="briefing-section-header">
          <span style="display:flex; align-items:center; gap:6px;">
            <i data-lucide="crosshair" style="width:14px;height:14px;color:var(--focus-indigo);"></i>
            Focus Tasks
          </span>
        </div>
        <div class="briefing-items-pills">
    `;

    const isLockedDay = this.isPastDay() || this.isDaySealed(this.selectedDate);

    const focusTasks = data.focus_tasks || (this.tasks && this.tasks.focus) || [];
    if (focusTasks.length === 0) {
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No focus items pending today.</div>`;
    } else {
      focusTasks.forEach((t, i) => {
        const isDone = t.status === "completed";
        const cleanTitle = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
        const timeMarker = this.formatSnapshotTimeMarker(t, this.selectedDate);
        const timeMil = timeMarker.timeBadge;
        const seqIdx = (this.dailyOrder || []).findIndex(d => String(d.id) === String(t.id) && (d.type === 'task' || !d.type));
        const inSeq = seqIdx !== -1;
        const isTimeSensitive = Boolean(t.is_time_sensitive);
        const badgeHtml = isDone
          ? ''
          : (timeMarker.isOverdue
            ? `<span class="urgency-badge overdue" style="font-size:9.5px; padding:1px 6px;">OVERDUE</span>`
            : (isTimeSensitive
              ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE</span>`
              : ''));

        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="${isLockedDay ? 'false' : 'true'}" 
               ondragstart="${isLockedDay ? 'return false;' : `Dashboard.onBriefingDragStart(event, ${t.id}, 'task', '${this.escapeHtml(cleanTitle)}', 'focus', '${this.escapeHtml(timeMil)}')`}">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="priority-num-badge" style="width:20px;height:20px;font-size:10px;">${String(i+1).padStart(2, '0')}</span>
              <span style="font-weight:600; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${t.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(t.project_name)}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
              ${inSeq ? `<span class="in-sequence-badge" title="Slot #${seqIdx + 1} in Tasking Priority"><span class="in-seq-rank">#${String(seqIdx + 1).padStart(2, '0')}</span><span>In sequence</span></span>` : ''}
              ${timeMarker.displayText ? `<span style="font-size:11px; font-family:var(--font-mono); color:${timeMarker.isOverdue ? 'var(--urgent-orange)' : 'var(--text-muted)'}; font-weight:${timeMarker.isOverdue ? '600' : '400'};">${this.escapeHtml(timeMarker.displayText)}</span>` : ''}
              ${badgeHtml}
              ${!isLockedDay ? `<button type="button" class="snapshot-quick-queue-btn ${inSeq ? 'queued' : ''}" onclick="event.stopPropagation(); Dashboard.toggleQueueFromSnapshot('task', ${t.id})" title="${inSeq ? 'Remove from Tasking Priority' : 'Add to Tasking Priority'}">${inSeq ? '<i data-lucide="check" style="width:11px;height:11px;"></i> Queued' : '<i data-lucide="plus" style="width:11px;height:11px;"></i> Queue'}</button>` : ''}
              ${isLockedDay ? '<span style="font-size:11px; color:var(--text-dim);" title="Past records are locked"><i data-lucide="lock" style="width:11px;height:11px;"></i></span>' : '<span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>'}
            </div>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // 2. Trivial Tasks
    html += `
      <div class="briefing-section-block">
        <div class="briefing-section-header">
          <span style="display:flex; align-items:center; gap:6px;">
            <i data-lucide="check-square" style="width:14px;height:14px;color:var(--normal-green);"></i>
            Trivial Tasks
          </span>
        </div>
        <div class="briefing-items-pills">
    `;
    const trivialTasks = data.trivial_tasks || (this.tasks && this.tasks.trivial) || [];
    if (trivialTasks.length === 0) {
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No trivial tasks scheduled today.</div>`;
    } else {
      trivialTasks.forEach((t, i) => {
        const isDone = t.status === "completed";
        const cleanTitle = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
        const timeMarker = this.formatSnapshotTimeMarker(t, this.selectedDate);
        const timeMil = timeMarker.timeBadge;
        const seqIdx = (this.dailyOrder || []).findIndex(d => String(d.id) === String(t.id) && (d.type === 'task' || !d.type));
        const inSeq = seqIdx !== -1;
        const isTimeSensitive = Boolean(t.is_time_sensitive);
        const badgeHtml = isDone
          ? ''
          : (timeMarker.isOverdue
            ? `<span class="urgency-badge overdue" style="font-size:9.5px; padding:1px 6px;">OVERDUE</span>`
            : (isTimeSensitive
              ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE</span>`
              : ''));

        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="${isLockedDay ? 'false' : 'true'}"
               ondragstart="${isLockedDay ? 'return false;' : `Dashboard.onBriefingDragStart(event, ${t.id}, 'task', '${this.escapeHtml(cleanTitle)}', 'trivial', '${this.escapeHtml(timeMil)}')`}">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="priority-num-badge" style="width:20px;height:20px;font-size:10px;">${String(i+1).padStart(2, '0')}</span>
              <span style="font-weight:500; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${t.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(t.project_name)}</span>` : ''}
              ${t.recurrence ? `<span class="recurrence-badge" style="padding:1px 6px; font-size:10px;">↻ Recur</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
              ${inSeq ? `<span class="in-sequence-badge" title="Slot #${seqIdx + 1} in Tasking Priority"><span class="in-seq-rank">#${String(seqIdx + 1).padStart(2, '0')}</span><span>In sequence</span></span>` : ''}
              ${timeMarker.displayText ? `<span style="font-size:11px; font-family:var(--font-mono); color:${timeMarker.isOverdue ? 'var(--urgent-orange)' : 'var(--text-muted)'}; font-weight:${timeMarker.isOverdue ? '600' : '400'};">${this.escapeHtml(timeMarker.displayText)}</span>` : ''}
              ${badgeHtml}
              ${!isLockedDay ? `<button type="button" class="snapshot-quick-queue-btn ${inSeq ? 'queued' : ''}" onclick="event.stopPropagation(); Dashboard.toggleQueueFromSnapshot('task', ${t.id})" title="${inSeq ? 'Remove from Tasking Priority' : 'Add to Tasking Priority'}">${inSeq ? '<i data-lucide="check" style="width:11px;height:11px;"></i> Queued' : '<i data-lucide="plus" style="width:11px;height:11px;"></i> Queue'}</button>` : ''}
              ${isLockedDay ? '<span style="font-size:11px; color:var(--text-dim);" title="Past records are locked"><i data-lucide="lock" style="width:11px;height:11px;"></i></span>' : '<span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>'}
            </div>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // 3. Scheduled Events
    const events = this.events || [];
    html += `
      <div class="briefing-section-block">
        <div class="briefing-section-header">
          <span style="display:flex; align-items:center; gap:6px;">
            <i data-lucide="calendar" style="width:14px;height:14px;color:var(--accent-blue);"></i>
            Scheduled Events
          </span>
        </div>
        <div class="briefing-items-pills">
    `;
    if (events.length === 0) {
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No events scheduled today.</div>`;
    } else {
      events.forEach((e, i) => {
        const isDone = e.status === "completed";
        const cleanTitle = (e.title || "").replace(/^\s*\[.*?\]\s*/, '');
        const timeMil = e.start_time ? (App.formatEventPeriod ? App.formatEventPeriod(e.start_time, e.end_time) : App.formatMilitaryTime(e.start_time)) : 'Today';
        const seqIdx = (this.dailyOrder || []).findIndex(d => String(d.id) === String(e.id) && d.type === 'event');
        const inSeq = seqIdx !== -1;
        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="${isLockedDay ? 'false' : 'true'}"
               ondragstart="${isLockedDay ? 'return false;' : `Dashboard.onBriefingDragStart(event, ${e.id}, 'event', '${this.escapeHtml(cleanTitle)}', 'event', '${timeMil}')`}">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:11px; font-family:var(--font-mono); background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-weight:700;">${timeMil}</span>
              <span style="font-weight:600; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${e.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(e.project_name)}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
              ${inSeq ? `<span class="in-sequence-badge" title="Slot #${seqIdx + 1} in Tasking Priority"><span class="in-seq-rank">#${String(seqIdx + 1).padStart(2, '0')}</span><span>In sequence</span></span>` : ''}
              ${!isLockedDay ? `<button type="button" class="snapshot-quick-queue-btn ${inSeq ? 'queued' : ''}" onclick="event.stopPropagation(); Dashboard.toggleQueueFromSnapshot('event', ${e.id})" title="${inSeq ? 'Remove from Tasking Priority' : 'Add to Tasking Priority'}">${inSeq ? '<i data-lucide="check" style="width:11px;height:11px;"></i> Queued' : '<i data-lucide="plus" style="width:11px;height:11px;"></i> Queue'}</button>` : ''}
              ${isLockedDay ? '<span style="font-size:11px; color:var(--text-dim);" title="Past records are locked"><i data-lucide="lock" style="width:11px;height:11px;"></i></span>' : '<span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>'}
            </div>
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // 4. Reminders (listed in plain text, unmovable)
    const reminders = this.reminders || [];
    html += `
      <div class="briefing-section-block">
        <div class="briefing-section-header">
          <span style="display:flex; align-items:center; gap:6px;">
            <i data-lucide="bell" style="width:14px;height:14px;color:var(--accent-cyan);"></i>
            Reminders
          </span>
        </div>
        <div class="briefing-reminders-plain-list">
    `;
    if (reminders.length === 0) {
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No reminders recorded for today.</div>`;
    } else {
      reminders.forEach((r) => {
        const isDone = Boolean(r.is_dismissed);
        const timeMil = r.remind_at ? App.formatMilitaryTime(r.remind_at) : '';
        html += `
          <div class="briefing-plain-reminder-row">
            <span class="plain-bullet">•</span>
            <span class="plain-reminder-title ${isDone ? 'completed' : ''}">${this.escapeHtml(r.title)}</span>
            ${r.details ? `<span class="plain-reminder-details">— ${this.escapeHtml(r.details)}</span>` : ''}
            ${timeMil ? `<span class="plain-reminder-time">${timeMil}</span>` : ''}
          </div>
        `;
      });
    }
    html += `</div></div>`;

    // 5. Different variations of "briefing end"
    const briefingEndNotice = this.getBriefingEndNotice(this.selectedDate);
    html += `
      <div class="briefing-end-terminal-bar">
        <div class="briefing-end-terminal-line"></div>
        <div class="briefing-end-terminal-content">
          <span class="briefing-end-prefix">//</span>
          <span class="briefing-end-text">${this.escapeHtml(briefingEndNotice)}</span>
          <span class="briefing-end-suffix">//</span>
        </div>
        <div class="briefing-end-terminal-line"></div>
      </div>
    `;

    container.innerHTML = html;
    App.renderIcons();
  },

  getBriefingEndNotice(dateStr) {
    const variations = [
      "BRIEFING END",
      "END OF BRIEFING",
      "BRIEFING CONCLUDED — EXECUTE TARGETS",
      "BRIEFING DISMISSED — FOCUS DIRECTIVE ACTIVE",
      "OPERATIONAL BRIEFING COMPLETE",
      "END OF BRIEFING — STAND BY FOR DIRECTIVES",
      "TRANSMISSION CONCLUDED — BRIEFING END",
      "SYSTEM PARAMETERS LOCKED — BRIEFING CONCLUDED",
      "MORNING BRIEFING CONCLUDED",
      "DIRECTIVE ISSUED — BRIEFING END"
    ];
    let hash = 0;
    const str = dateStr || new Date().toISOString().split("T")[0];
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % variations.length;
    return variations[idx];
  },

  onBriefingDragStart(event, entityId, entityType, title, tier, timeBadge) {
    const payload = JSON.stringify({ id: entityId, type: entityType, title: title, tier: tier, time: timeBadge });
    event.dataTransfer.setData("application/json", payload);
    event.dataTransfer.effectAllowed = "copyMove";
  },

  /* --- Ultimate Daily Order Queue Management --- */
  draggedSlotIdx: null,

  async loadDailyOrder() {
    const targetDate = this.selectedDate;
    try {
      const res = await fetch(`/api/daily-order?date=${targetDate}`);
      if (res.ok) {
        const data = await res.json();
        if (this.selectedDate === targetDate) {
          this.dailyOrder = data.order || [];
          this.dailyOrderDate = targetDate;
          localStorage.setItem("pettr_daily_order_" + targetDate, JSON.stringify(this.dailyOrder));
        }
      } else {
        if (this.selectedDate === targetDate) {
          const saved = localStorage.getItem("pettr_daily_order_" + targetDate);
          this.dailyOrder = saved ? JSON.parse(saved) : [];
          this.dailyOrderDate = targetDate;
        }
      }
    } catch (e) {
      if (this.selectedDate === targetDate) {
        const saved = localStorage.getItem("pettr_daily_order_" + targetDate);
        this.dailyOrder = saved ? JSON.parse(saved) : [];
        this.dailyOrderDate = targetDate;
      }
    }
    if (this.selectedDate === targetDate) {
      this.renderDailyOrder();
      this.initDailyOrderDropZone();
      if (this.briefingData) {
        this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
      }
    }
  },

  syncLocalEntityStatus(entityType, entityId, isCompleted) {
    const newStatus = isCompleted ? "completed" : (entityType === "event" ? "scheduled" : "pending");
    const idStr = String(entityId);

    if (entityType === "event") {
      (this.events || []).forEach(ev => {
        if (String(ev.id) === idStr) ev.status = newStatus;
      });
      if (this.briefingData && Array.isArray(this.briefingData.events_today)) {
        this.briefingData.events_today.forEach(ev => {
          if (String(ev.id) === idStr) ev.status = newStatus;
        });
      }
    } else {
      const applyTask = (t) => {
        if (t && String(t.id) === idStr) {
          t.status = newStatus;
          t.completed = Boolean(isCompleted);
        }
      };
      if (this.tasks) {
        (this.tasks.focus || []).forEach(applyTask);
        (this.tasks.trivial || []).forEach(applyTask);
        (this.tasks.standalone_focus || []).forEach(applyTask);
        (this.tasks.standalone_trivial || []).forEach(applyTask);
        (this.tasks.projects || []).forEach(p => (p.tasks || []).forEach(applyTask));
      }
      if (this.briefingData) {
        (this.briefingData.focus_tasks || []).forEach(applyTask);
        (this.briefingData.trivial_tasks || []).forEach(applyTask);
        (this.briefingData.projects || []).forEach(p => (p.tasks || []).forEach(applyTask));
      }
    }

    if (Array.isArray(this.dailyOrder)) {
      this.dailyOrder.forEach(item => {
        const matchesType = entityType === "event"
          ? item.type === "event"
          : (item.type === "task" || !item.type);
        if (matchesType && String(item.id) === idStr) {
          item.completed = Boolean(isCompleted);
        }
      });
    }
  },

  reconcileDailyOrderTitles() {
    if (!this.dailyOrder || !this.dailyOrder.length) return;
    if (this.dailyOrderDate && this.dailyOrderDate !== this.selectedDate) return;
    const tasksLoaded = Boolean(this.tasks && (Array.isArray(this.tasks.focus) || Array.isArray(this.tasks.trivial)));
    const eventsLoaded = Array.isArray(this.events);
    if (!tasksLoaded || !eventsLoaded) return;

    const allTasks = [
      ...((this.tasks && this.tasks.focus) || []),
      ...((this.tasks && this.tasks.trivial) || [])
    ];
    (this.tasks && this.tasks.projects || []).forEach(p => {
      (p.tasks || []).forEach(pt => {
        if (!allTasks.some(t => String(t.id) === String(pt.id))) allTasks.push(pt);
      });
    });

    let modified = false;
    const initialLen = this.dailyOrder.length;
    this.dailyOrder = this.dailyOrder.filter(item => {
      if (item.type === "task" || !item.type) {
        const found = allTasks.find(t => String(t.id) === String(item.id));
        if (!found) {
          modified = true;
          return false;
        }
        if (found.title) {
          const clean = found.title.replace(/^\s*\[.*?\]\s*/, '');
          if (item.title !== clean) {
            item.title = clean;
            modified = true;
          }
        }
        const isComp = (found.status === "completed" || Boolean(found.completed));
        if (Boolean(item.completed) !== isComp) {
          item.completed = isComp;
          modified = true;
        }
        if (found.is_overdue && !item.is_overdue) {
          item.is_overdue = true;
          item.is_rolled_over = true;
          modified = true;
        }
        return true;
      }
      if (item.type === "event") {
        const found = (this.events || []).find(e => String(e.id) === String(item.id));
        if (!found) {
          modified = true;
          return false;
        }
        if (found.title && item.title !== found.title) {
          item.title = found.title;
          modified = true;
        }
        const isComp = (found.status === "completed");
        if (Boolean(item.completed) !== isComp) {
          item.completed = isComp;
          modified = true;
        }
        return true;
      }
      return true;
    });

    if (modified) {
      localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify(this.dailyOrder));
      this.renderDailyOrder();
      if (this.dailyOrder.length !== initialLen) {
        this.saveDailyOrder();
      }
    }
  },

  async saveDailyOrder() {
    const targetDate = this.selectedDate;
    const orderToSave = [...(this.dailyOrder || [])];
    try {
      localStorage.setItem("pettr_daily_order_" + targetDate, JSON.stringify(orderToSave));
      await fetch("/api/daily-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          order: orderToSave
        })
      });
    } catch (e) {
      console.warn("Error saving daily order:", e);
    }
    if (this.selectedDate === targetDate) {
      this.renderDailyOrder();
      if (this.briefingData) {
        this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
      }
    }
  },

  renderDailyOrder() {
    const container = document.getElementById("dailyOrderSlotsList");
    const countBadge = document.getElementById("dailyOrderCountBadge");
    if (!container) return;

    const count = this.dailyOrder.length;
    if (countBadge) countBadge.textContent = `${count} queued`;

    if (count === 0) {
      container.innerHTML = `
        <div class="daily-order-empty-cue">
          <i data-lucide="list-ordered" style="width:28px;height:28px;color:var(--focus-indigo);opacity:0.6;margin-bottom:4px;"></i>
          <div style="font-weight:700; color:var(--text-main);">Tasking Priority is Empty</div>
          <div style="font-size:12px; max-width:240px; line-height:1.5;">
            Drag any focus task, trivial task, project, or event from the left into this space to lock in your exact execution order.
          </div>
        </div>
      `;
      App.renderIcons();
      return;
    }

    container.innerHTML = this.dailyOrder.map((item, idx) => {
      const rank = String(idx + 1).padStart(2, "0");
      let isDone = item.completed || false;
      let isOverdue = Boolean(item.is_overdue || item.is_rolled_over);
      let matchedTask = null;
      // Reconcile with live tasks and events
      if ((item.type === "task" || !item.type) && this.tasks) {
        const projectTasks = (this.tasks.projects || []).flatMap(p => p.tasks || []);
        const allTasks = [...(this.tasks.focus || []), ...(this.tasks.trivial || []), ...projectTasks];
        const match = allTasks.find(t => String(t.id) === String(item.id));
        if (match) {
          matchedTask = match;
          isDone = match.status === "completed";
          item.completed = isDone;
          item.title = match.title || item.title;
          if (match.tier) item.tier = match.tier;
          if (match.is_overdue || match.is_rolled_over || (match.urgency && match.urgency.label === "Overdue")) {
            isOverdue = true;
            item.is_overdue = true;
          }
        }
      } else if (item.type === "event") {
        const evList = (this.events && this.events.length) ? this.events : ((this.briefingData && this.briefingData.events_today) || []);
        const match = evList.find(e => String(e.id) === String(item.id));
        if (match) {
          isDone = match.status === "completed";
          item.completed = isDone;
          item.title = match.title || item.title;
          const timePart = match.start_time ? (App.formatEventPeriod ? App.formatEventPeriod(match.start_time, match.end_time) : App.formatMilitaryTime(match.start_time)) : "";
          if (timePart) {
            item.time = timePart;
          }
        }
      }

      let displayTime = item.time || "";
      if (matchedTask) {
        const tm = this.formatSnapshotTimeMarker(matchedTask, this.selectedDate);
        if (isOverdue && !isDone && tm.isOverdue && tm.displayText) {
          displayTime = tm.displayText;
          item.time = tm.timeBadge || tm.displayText;
        } else if (tm.displayText) {
          displayTime = tm.displayText;
          item.time = tm.timeBadge || tm.displayText;
        } else {
          displayTime = "";
          item.time = "";
        }
      }

      const isLockedDay = this.isPastDay() || this.isDaySealed(this.selectedDate);
      const isFirst = idx === 0;
      const isLast = idx === this.dailyOrder.length - 1;

      return `
        <div class="daily-order-slot ${isDone ? 'completed' : ''}" draggable="${isLockedDay ? 'false' : 'true'}"
             data-index="${idx}"
             ondragstart="${isLockedDay ? 'return false;' : `Dashboard.onDailyOrderDragStart(event, ${idx})`}"
             ondragend="${isLockedDay ? 'return false;' : 'Dashboard.onDailyOrderDragEnd(event)'}"
             ondragover="${isLockedDay ? 'return false;' : `Dashboard.onDailyOrderDragOver(event, ${idx})`}"
             ondragleave="${isLockedDay ? 'return false;' : `Dashboard.onDailyOrderDragLeave(event, ${idx})`}"
             ondrop="${isLockedDay ? 'return false;' : `Dashboard.onDailyOrderDrop(event, ${idx})`}">
          <span class="slot-rank">#${rank}</span>
          <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''} ${isLockedDay ? 'disabled' : ''}
                 onclick="event.stopPropagation()" onchange="Dashboard.toggleDailyOrderItem(${idx}, this.checked)" title="${isLockedDay ? 'Past day items are locked' : 'Check off item'}">
          <span class="slot-title">${this.escapeHtml(item.title)}</span>
          ${isOverdue && !isDone ? `<span class="urgency-badge overdue" style="font-size:9.5px; padding:1px 6px;">OVERDUE</span>` : ''}
          ${displayTime ? `<span style="font-size:11px; font-family:var(--font-mono); color:${isOverdue && !isDone ? 'var(--urgent-orange)' : 'var(--text-muted)'}; font-weight:${isOverdue && !isDone ? '600' : '400'};">${this.escapeHtml(displayTime)}</span>` : ''}
          <span class="urgency-badge ${item.tier || 'normal'}" style="font-size:10px; padding:1px 6px;">${(item.tier || item.type).toUpperCase()}</span>
          ${isLockedDay ? '<span style="font-size:11px; color:var(--text-dim);" title="Past records are locked"><i data-lucide="lock" style="width:11px;height:11px;"></i></span>' : `
            <div class="daily-order-slot-actions">
              <button type="button" class="action-icon-btn daily-order-move-btn" ${isFirst ? 'disabled' : ''} onclick="event.stopPropagation(); Dashboard.moveDailyOrderItem(${idx}, -1)" title="Move up in queue"><i data-lucide="chevron-up" style="width:12px;height:12px;"></i></button>
              <button type="button" class="action-icon-btn daily-order-move-btn" ${isLast ? 'disabled' : ''} onclick="event.stopPropagation(); Dashboard.moveDailyOrderItem(${idx}, 1)" title="Move down in queue"><i data-lucide="chevron-down" style="width:12px;height:12px;"></i></button>
              <button type="button" class="action-icon-btn daily-order-edit-btn" onclick="event.stopPropagation(); Dashboard.editDailyOrderItem(${idx})" title="Edit item details"><i data-lucide="edit-3" style="width:11px;height:11px;"></i></button>
              <button type="button" class="action-icon-btn" onclick="event.stopPropagation(); Dashboard.removeDailyOrderItem(${idx})" title="Remove from daily sequence" style="padding:3px 6px; font-size:11px; color:var(--text-muted);"><i data-lucide="x" style="width:11px;height:11px;"></i></button>
            </div>
          `}
        </div>
      `;
    }).join("");
    App.renderIcons();
  },

  initDailyOrderDropZone() {
    const listEl = document.getElementById("dailyOrderSlotsList");
    if (!listEl) return;

    listEl.ondragover = (e) => {
      if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      listEl.style.background = "var(--bg-tertiary)";
    };

    listEl.ondragleave = () => {
      listEl.style.background = "";
    };

    listEl.ondrop = (e) => {
      if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
        e.preventDefault();
        App.showToast("Previous day priority tasking queues are locked.", true);
        return;
      }
      e.preventDefault();
      listEl.style.background = "";

      // If an internal item was dropped on the container empty space
      if (this.draggedSlotIdx !== null && this.draggedSlotIdx !== undefined) {
        const [moved] = this.dailyOrder.splice(this.draggedSlotIdx, 1);
        this.dailyOrder.push(moved);
        this.draggedSlotIdx = null;
        this.saveDailyOrder();
        return;
      }

      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const item = JSON.parse(raw);
        if (!this.dailyOrder.some(d => d.id === item.id && d.type === item.type)) {
          this.dailyOrder.push({ ...item, completed: false });
          this.saveDailyOrder();
          App.showToast(`Added to Daily Order: ${item.title}`);
        } else {
          App.showToast("Item is already in your daily sequence.");
        }
      } catch (err) {
        console.warn("Drop parse error:", err);
      }
    };
  },

  onDailyOrderDragStart(e, idx) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      e.preventDefault();
      return;
    }
    this.draggedSlotIdx = idx;
    e.dataTransfer.setData("text/plain", "daily-order:" + idx);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (e.target && e.target.classList) e.target.classList.add("dragging");
    }, 0);
  },

  onDailyOrderDragEnd(e) {
    this.draggedSlotIdx = null;
    document.querySelectorAll(".daily-order-slot").forEach(s => {
      s.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
    });
  },

  onDailyOrderDragOver(e, targetIdx) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const slot = e.currentTarget;
    if (slot) {
      const rect = slot.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        slot.classList.add("drag-over-top");
        slot.classList.remove("drag-over-bottom");
      } else {
        slot.classList.add("drag-over-bottom");
        slot.classList.remove("drag-over-top");
      }
    }
  },

  onDailyOrderDragLeave(e, targetIdx) {
    e.stopPropagation();
    const slot = e.currentTarget;
    if (slot) {
      slot.classList.remove("drag-over-top", "drag-over-bottom");
    }
  },

  onDailyOrderDrop(e, targetIdx) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      e.preventDefault();
      e.stopPropagation();
      App.showToast("Previous day priority tasking queues are locked.", true);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const slot = e.currentTarget;
    const isBelow = slot && slot.classList.contains("drag-over-bottom");
    if (slot) slot.classList.remove("drag-over-top", "drag-over-bottom");

    // Case 1: Internal reordering
    let sourceIdx = this.draggedSlotIdx;
    const textData = e.dataTransfer.getData("text/plain") || "";
    if ((sourceIdx === null || sourceIdx === undefined) && textData.startsWith("daily-order:")) {
      sourceIdx = parseInt(textData.replace("daily-order:", ""), 10);
    }

    if (sourceIdx !== null && sourceIdx !== undefined && !isNaN(sourceIdx)) {
      if (sourceIdx === targetIdx) {
        this.draggedSlotIdx = null;
        return;
      }
      const [moved] = this.dailyOrder.splice(sourceIdx, 1);
      let finalIdx = targetIdx;
      if (sourceIdx < targetIdx && !isBelow) finalIdx = targetIdx - 1;
      else if (sourceIdx > targetIdx && isBelow) finalIdx = targetIdx + 1;
      finalIdx = Math.max(0, Math.min(this.dailyOrder.length, finalIdx));

      this.dailyOrder.splice(finalIdx, 0, moved);
      this.draggedSlotIdx = null;
      this.saveDailyOrder();
      return;
    }

    // Case 2: External drop from briefing item
    const raw = e.dataTransfer.getData("application/json");
    if (raw) {
      try {
        const item = JSON.parse(raw);
        if (!this.dailyOrder.some(d => d.id === item.id && d.type === item.type)) {
          const insertIdx = isBelow ? targetIdx + 1 : targetIdx;
          this.dailyOrder.splice(insertIdx, 0, { ...item, completed: false });
          this.saveDailyOrder();
          App.showToast(`Added to Daily Order: ${item.title}`);
        } else {
          App.showToast("Item is already in your daily sequence.");
        }
      } catch (err) {
        console.warn("Drop parse error:", err);
      }
    }
  },

  async toggleDailyOrderItem(idx, isCompleted) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      App.showToast("Cannot modify locked historical records.", true);
      this.renderDailyOrder();
      return;
    }
    const item = this.dailyOrder && this.dailyOrder[idx];
    if (!item) return;

    const entityType = item.type === "event" ? "event" : "task";
    this.syncLocalEntityStatus(entityType, item.id, isCompleted);
    try {
      localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify(this.dailyOrder));
    } catch (_) {}
    this.renderDailyOrder();
    if (this.briefingData) {
      this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
    }

    if (entityType === "task" && item.id) {
      await this.toggleTaskStatus(item.id, isCompleted);
    } else if (entityType === "event" && item.id) {
      await this.toggleEventStatus(item.id, isCompleted);
    } else {
      await this.saveDailyOrder();
    }
  },

  removeDailyOrderItem(idx) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    this.dailyOrder.splice(idx, 1);
    this.saveDailyOrder();
  },

  moveDailyOrderItem(idx, delta) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    if (!Array.isArray(this.dailyOrder)) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= this.dailyOrder.length) return;
    const [moved] = this.dailyOrder.splice(idx, 1);
    this.dailyOrder.splice(targetIdx, 0, moved);
    this.saveDailyOrder();
    if (typeof App !== "undefined" && App.haptic) App.haptic("light");
  },

  editDailyOrderItem(idx) {
    const item = this.dailyOrder && this.dailyOrder[idx];
    if (!item || !item.id || typeof EntityModal === "undefined") return;
    const entityType = item.type === "event" ? "event" : "task";
    EntityModal.open(entityType, item.id);
  },

  async toggleQueueFromSnapshot(entityType, entityId) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    if (!Array.isArray(this.dailyOrder)) this.dailyOrder = [];
    const existingIdx = this.dailyOrder.findIndex(
      d => String(d.id) === String(entityId) && (entityType === "event" ? d.type === "event" : (d.type === "task" || !d.type))
    );
    if (existingIdx !== -1) {
      this.dailyOrder.splice(existingIdx, 1);
      await this.saveDailyOrder();
      App.showToast("Removed from Tasking Priority.");
      return;
    }

    let entry = null;
    if (entityType === "event") {
      const ev = (this.events || []).find(e => String(e.id) === String(entityId));
      if (!ev) return;
      const cleanTitle = (ev.title || "").replace(/^\s*\[.*?\]\s*/, '');
      const timePart = ev.start_time ? (App.formatEventPeriod ? App.formatEventPeriod(ev.start_time, ev.end_time) : App.formatMilitaryTime(ev.start_time)) : "";
      entry = { id: ev.id, type: "event", title: cleanTitle, tier: "event", time: timePart, completed: ev.status === "completed" };
    } else {
      const projTasks = (this.tasks && this.tasks.projects || []).flatMap(p => p.tasks || []);
      const allTasks = [...((this.tasks && this.tasks.focus) || []), ...((this.tasks && this.tasks.trivial) || []), ...projTasks];
      const t = allTasks.find(x => String(x.id) === String(entityId));
      if (!t) return;
      const cleanTitle = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
      const tm = this.formatSnapshotTimeMarker(t, this.selectedDate);
      entry = {
        id: t.id,
        type: "task",
        title: cleanTitle,
        tier: t.tier || "focus",
        time: tm.timeBadge || "",
        completed: t.status === "completed",
        is_overdue: Boolean(tm.isOverdue)
      };
    }

    this.dailyOrder.push(entry);
    await this.saveDailyOrder();
    if (typeof App !== "undefined" && App.haptic) App.haptic("light");
    App.showToast(`Queued in Tasking Priority: ${entry.title}`);
  },

  async clearDailyOrder() {
    if (!confirm("Clear your Daily Order execution list for today?")) return;
    this.dailyOrder = [];
    localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify([]));
    this.renderDailyOrder();
    await this.saveDailyOrder();
    App.showToast("Daily sequence reset.");
  },

  /* --- v10.0 Lock-In Natural Language Snapshot Briefing --- */
  async loadSnapshotBriefing() {
    const targetDate = this.selectedDate;
    const clientHour = new Date().getHours();
    try {
      const res = await fetch(`/api/snapshot/briefing?date=${targetDate}&hour=${clientHour}`);
      if (!res.ok) return;
      const data = await res.json();
      if (this.selectedDate !== targetDate) return;

      this.isSnapshotLocked = Boolean(data.is_locked);
      this.snapshotBriefing = data.briefing || null;
      this.snapshotLockDate = targetDate;
      try {
        localStorage.setItem("pettr_snapshot_lock_" + targetDate, this.isSnapshotLocked ? "true" : "false");
      } catch (_) {}
      this.applySnapshotLockUI();
    } catch (err) {
      console.warn("Could not load snapshot briefing state:", err);
    }
  },

  async lockInSnapshot() {
    const targetDate = this.selectedDate;
    const clientHour = new Date().getHours();
    this.isSnapshotLocked = true;
    this.isSnapshotRemarkLoading = true;
    this.snapshotLockDate = targetDate;
    try {
      localStorage.setItem("pettr_snapshot_lock_" + targetDate, "true");
    } catch (_) {}

    // Transition immediately to keep UI responsive while saving & generating witty outlook
    this.applySnapshotLockUI();
    if (typeof App !== "undefined" && App.haptic) App.haptic("medium");

    try {
      await this.saveDailyOrder();
      const res = await fetch("/api/snapshot/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          locked: true,
          hour: clientHour,
          refresh_remark: true
        })
      });
      if (res.ok && this.selectedDate === targetDate) {
        const data = await res.json();
        this.isSnapshotLocked = Boolean(data.is_locked);
        this.snapshotBriefing = data.briefing || this.snapshotBriefing;
      }
    } catch (err) {
      console.warn("Snapshot lock-in request error:", err);
    } finally {
      if (this.selectedDate === targetDate) {
        this.isSnapshotRemarkLoading = false;
        this.applySnapshotLockUI();
        App.showToast("Snapshot locked in! Focused briefing active.", 2500);
      }
    }
  },

  async unlockSnapshot() {
    const targetDate = this.selectedDate;
    this.isSnapshotLocked = false;
    this.isSnapshotRemarkLoading = false;
    this.snapshotLockDate = targetDate;
    try {
      localStorage.setItem("pettr_snapshot_lock_" + targetDate, "false");
    } catch (_) {}
    this.applySnapshotLockUI();
    if (typeof App !== "undefined" && App.haptic) App.haptic("light");

    try {
      await fetch("/api/snapshot/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          locked: false,
          hour: new Date().getHours()
        })
      });
      App.showToast("Snapshot unlocked for editing.");
    } catch (err) {
      console.warn("Snapshot unlock error:", err);
    }
  },

  async toggleLockIn() {
    if (this.isSnapshotLocked) {
      await this.unlockSnapshot();
    } else {
      await this.lockInSnapshot();
    }
  },

  async refreshSnapshotRemark() {
    if (!this.isSnapshotLocked || this.isSnapshotRemarkLoading) return;
    const targetDate = this.selectedDate;
    this.isSnapshotRemarkLoading = true;
    this.renderLockedSnapshotView();
    try {
      const res = await fetch("/api/snapshot/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          locked: true,
          hour: new Date().getHours(),
          refresh_remark: true
        })
      });
      if (res.ok && this.selectedDate === targetDate) {
        const data = await res.json();
        this.snapshotBriefing = data.briefing || this.snapshotBriefing;
      }
    } catch (err) {
      console.warn("Failed refreshing outlook remark:", err);
    } finally {
      if (this.selectedDate === targetDate) {
        this.isSnapshotRemarkLoading = false;
        this.renderLockedSnapshotView();
      }
    }
  },

  applySnapshotLockUI() {
    const showcase = document.getElementById("briefingShowcaseWindow");
    const lockedPill = document.getElementById("snapshotLockedPill");
    const lockBtn = document.getElementById("snapshotLockInBtn");
    const unlockBtn = document.getElementById("snapshotUnlockBtn");
    const focusBtn = document.getElementById("snapshotFocusBtn");
    const dualLayout = document.getElementById("briefingDualLayout");
    const lockedView = document.getElementById("snapshotLockedBriefingView");

    const locked = Boolean(this.isSnapshotLocked);
    if (showcase) showcase.classList.toggle("is-locked-in", locked);
    if (lockedPill) lockedPill.style.display = locked ? "inline-flex" : "none";
    if (lockBtn) lockBtn.style.display = locked ? "none" : "inline-flex";
    if (unlockBtn) unlockBtn.style.display = locked ? "inline-flex" : "none";
    if (focusBtn) focusBtn.style.display = locked ? "inline-flex" : "none";
    if (dualLayout) dualLayout.style.display = locked ? "none" : "";
    if (lockedView) {
      lockedView.style.display = locked ? "flex" : "none";
      if (locked) {
        this.renderLockedSnapshotView();
      }
    }
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  async toggleSnapshotItemStatus(entityType, entityId, isCompleted) {
    if (this.isPastDay() || this.isDaySealed(this.selectedDate)) {
      App.showToast("Cannot modify locked historical records.", true);
      this.renderLockedSnapshotView();
      return;
    }
    this.syncLocalEntityStatus(entityType, entityId, isCompleted);
    if (this.snapshotBriefing) {
      const updateBucket = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(x => {
          if (String(x.id) === String(entityId) && (!x.type || x.type === entityType)) {
            x.completed = Boolean(isCompleted);
          }
        });
      };
      updateBucket(this.snapshotBriefing.priority_queue);
      if (entityType === "event") {
        updateBucket(this.snapshotBriefing.events);
      } else {
        updateBucket(this.snapshotBriefing.focus_items);
        updateBucket(this.snapshotBriefing.trivial_items);
      }
    }
    this.renderLockedSnapshotView();
    if (entityType === "event") {
      await this.toggleEventStatus(entityId, isCompleted);
    } else {
      await this.toggleTaskStatus(entityId, isCompleted);
    }
  },

  launchLockedFocusTask(taskId) {
    if (typeof FocusCockpit === "undefined") return;
    const projTasks = (this.tasks && this.tasks.projects || []).flatMap(p => p.tasks || []);
    const allTasks = [...((this.tasks && this.tasks.focus) || []), ...((this.tasks && this.tasks.trivial) || []), ...projTasks];
    let found = allTasks.find(t => String(t.id) === String(taskId));
    if (!found && this.snapshotBriefing && Array.isArray(this.snapshotBriefing.priority_queue)) {
      const q = this.snapshotBriefing.priority_queue.find(it => String(it.id) === String(taskId));
      if (q) found = { id: q.id, title: q.title, tier: q.tier || "focus" };
    }
    FocusCockpit.open(found || null);
  },

  buildLocalSnapshotFallback() {
    const focusAll = (this.tasks && this.tasks.focus) || [];
    const trivialAll = (this.tasks && this.tasks.trivial) || [];
    const projectsAll = (this.tasks && this.tasks.projects) || [];
    const eventsAll = this.events || [];
    const remindersAll = this.reminders || [];
    const queue = this.dailyOrder || [];

    const mapTask = (t) => {
      const clean = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
      const tm = this.formatSnapshotTimeMarker(t, this.selectedDate);
      return {
        id: t.id,
        title: clean,
        tier: t.tier || "focus",
        completed: t.status === "completed",
        is_overdue: Boolean(tm.isOverdue),
        is_time_sensitive: Boolean(t.is_time_sensitive),
        project_name: t.project_name || null,
        time_label: tm.displayText || ""
      };
    };

    const focus_items = focusAll.map(mapTask);
    const trivial_items = trivialAll.map(mapTask);
    const events = eventsAll.map(ev => ({
      id: ev.id,
      title: (ev.title || "").replace(/^\s*\[.*?\]\s*/, ''),
      completed: ev.status === "completed",
      time_label: ev.start_time ? (App.formatEventPeriod ? App.formatEventPeriod(ev.start_time, ev.end_time) : App.formatMilitaryTime(ev.start_time)) : "Today",
      project_name: ev.project_name || null
    }));
    const projects = projectsAll.map(p => {
      const pts = p.tasks || [];
      const done = pts.filter(x => x.status === "completed").length;
      return { id: p.id, name: p.name, total_count: pts.length, completed_count: done, pending_count: pts.length - done };
    });
    const reminders = remindersAll.map(r => ({
      id: r.id,
      title: r.title,
      details: r.details || "",
      dismissed: Boolean(r.is_dismissed)
    }));

    const focusPending = focus_items.filter(x => !x.completed);
    const trivialPending = trivial_items.filter(x => !x.completed);
    const eventsPending = events.filter(x => !x.completed);
    const remindersActive = reminders.filter(x => !x.dismissed);

    const parts = [];
    if (focusPending.length) parts.push(`${focusPending.length} focus task${focusPending.length === 1 ? '' : 's'}`);
    if (trivialPending.length) parts.push(`${trivialPending.length} trivial task${trivialPending.length === 1 ? '' : 's'}`);
    if (eventsPending.length) parts.push(`${eventsPending.length} scheduled event${eventsPending.length === 1 ? '' : 's'}`);
    if (projects.length) parts.push(`${projects.length} active project${projects.length === 1 ? '' : 's'}`);
    if (remindersActive.length) parts.push(`${remindersActive.length} reminder${remindersActive.length === 1 ? '' : 's'}`);

    const summary_narrative = parts.length
      ? `You have ${parts.join(", ")} lined up.`
      : "Your slate is clear right now with no pending items left.";

    return {
      date_iso: this.selectedDate,
      summary_narrative,
      remark: { text: "Locking in your plan cleanly — let momentum lead.", source: "curated" },
      counts: {
        focus_pending: focusPending.length,
        focus_total: focus_items.length,
        focus_overdue: focusPending.filter(x => x.is_overdue).length,
        trivial_pending: trivialPending.length,
        events_pending: eventsPending.length,
        projects_total: projects.length,
        reminders_active: remindersActive.length,
        queued_total: queue.length,
        queued_pending: queue.filter(x => !x.completed).length,
        overdue_total: focusPending.filter(x => x.is_overdue).length + trivialPending.filter(x => x.is_overdue).length
      },
      priority_queue: queue.map(q => ({
        id: q.id,
        type: q.type || "task",
        title: (q.title || "").replace(/^\s*\[.*?\]\s*/, ''),
        tier: q.tier || "focus",
        time: q.time || "",
        completed: Boolean(q.completed),
        is_overdue: Boolean(q.is_overdue || q.is_rolled_over)
      })),
      focus_items,
      trivial_items,
      events,
      projects,
      reminders
    };
  },

  tokenizeParticleText(text, extraClass = "", delayStep = 0) {
    const str = String(text || "");
    if (!str) return "";
    // Split into word + trailing whitespace tokens so line wrapping stays natural while words coalesce like particles
    const tokens = str.match(/\S+\s*/g) || [str];
    let out = "";
    tokens.forEach((tok, i) => {
      const hash = ((i * 37) + tok.length * 13) % 100;
      const px = ((hash % 17) - 8) * 1.4; // -11.2px to +11.2px horizontal particle scatter
      const py = 8 + ((hash % 9) * 1.3);   // 8px to 19px vertical drift
      const pd = Math.min(480, (delayStep + i) * 18);
      out += `<span class="snapshot-particle-word ${extraClass}" style="--px:${px.toFixed(1)}px;--py:${py.toFixed(1)}px;--pd:${pd}ms">${this.escapeHtml(tok)}</span>`;
    });
    return out;
  },

  buildHighlightedNarrativeHtml(b) {
    let raw = (b && b.summary_narrative) ? String(b.summary_narrative) : "";
    if (!raw) return "";

    // Deduplicate date display: strip "(Weekday, DD Mon)" when already on Today/Tomorrow/Yesterday
    raw = raw
      .replace(/^((?:Today|Tomorrow|Yesterday))\s*\([^)]+\)/, "$1")
      .replace(/\btrivial errand(s?)\b/gi, "trivial task$1");

    const tokenRegex = new RegExp(
      [
        // 1: Opening day/date phrase
        "(^(?:Today|Tomorrow|Yesterday|For\\s+[A-Za-z]+,\\s+\\d+\\s+[A-Za-z]+\\s+\\d{4}))",
        // 2: Quoted item title (with optional #NN rank prefix)
        "((?:#\\d+\\s+)?\"[^\"]+\")",
        // 3: Overdue / Time Sensitive urgent markers
        "(\\(\\d+\\s+overdue\\)|\\b\\d+\\s+items?\\s+(?:carry|carries)\\s+an?\\s+urgent\\s+Time\\s+Sensitive\\s+flag\\b|\\bTime\\s+Sensitive\\b)",
        // 4: Key numerical category counts & completion statements
        "(\\b\\d+\\s+(?:focus\\s+tasks?|trivial\\s+tasks?|trivial\\s+errands?|scheduled\\s+events?|active\\s+projects?|reminders?|pending\\s+items?|scheduled\\s+items?|items?\\s+in\\s+your\\s+Tasking\\s+Priority\\s+sequence)\\b|\\bcompleted\\s+cleanly\\b|\\bcurrently\\s+open\\b)",
        // 5: Parenthesized 24h event times
        "(\\(\\d{2}:\\d{2}(?:\\s*[-\\u2013\\u2014]\\s*\\d{2}:\\d{2})?\\))"
      ].join("|"),
      "g"
    );

    let out = "";
    let lastIdx = 0;
    let wordOffset = 0;
    let match;
    while ((match = tokenRegex.exec(raw)) !== null) {
      if (match.index > lastIdx) {
        const plain = raw.slice(lastIdx, match.index);
        out += this.tokenizeParticleText(plain, "", wordOffset);
        wordOffset += (plain.match(/\S+/g) || []).length;
      }
      const matched = match[0];
      const countWords = (matched.match(/\S+/g) || []).length;
      if (match[1]) {
        out += `<span class="snapshot-hl-day">${this.tokenizeParticleText(matched, "", wordOffset)}</span>`;
      } else if (match[2]) {
        out += `<strong class="snapshot-hl-title">${this.tokenizeParticleText(matched, "", wordOffset)}</strong>`;
      } else if (match[3]) {
        out += `<span class="snapshot-hl-alert">${this.tokenizeParticleText(matched, "", wordOffset)}</span>`;
      } else if (match[4]) {
        out += `<span class="snapshot-hl-count">${this.tokenizeParticleText(matched, "", wordOffset)}</span>`;
      } else if (match[5]) {
        out += `<span class="snapshot-hl-time font-mono">${this.tokenizeParticleText(matched, "", wordOffset)}</span>`;
      } else {
        out += this.tokenizeParticleText(matched, "", wordOffset);
      }
      wordOffset += countWords;
      lastIdx = tokenRegex.lastIndex;
    }
    if (lastIdx < raw.length) {
      out += this.tokenizeParticleText(raw.slice(lastIdx), "", wordOffset);
    }
    return out;
  },

  initSnapshotScrollParticles(container) {
    if (!container) return;
    if (this._snapshotParticleObserver) {
      this._snapshotParticleObserver.disconnect();
      this._snapshotParticleObserver = null;
    }

    const targets = Array.from(container.querySelectorAll(".snapshot-coalesce"));
    if (targets.length === 0) return;

    const revealEl = (el) => {
      if (!el.classList.contains("is-coalesced")) {
        el.classList.add("is-coalesced");
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach(revealEl);
      return;
    }

    this._snapshotParticleObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            revealEl(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -16px 0px" }
    );

    targets.forEach((el, idx) => {
      el.style.setProperty("--row-delay", `${Math.min(idx * 45, 360)}ms`);
      this._snapshotParticleObserver.observe(el);
    });

    // Guarantee elements already inside viewport coalesce immediately on first frame
    requestAnimationFrame(() => {
      const vh = window.innerHeight || document.documentElement.clientHeight || 900;
      targets.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < vh * 0.96 && rect.bottom > 0) {
          revealEl(el);
          if (this._snapshotParticleObserver) this._snapshotParticleObserver.unobserve(el);
        }
      });
    });
  },

  openSnapshotUnqueuedModal() {
    const modal = document.getElementById("snapshotUnqueuedModal");
    if (!modal) return;
    const state = this._snapshotUnqueuedState || { tasks: [], events: [], isLockedDay: false };
    const tasks = state.tasks || [];
    const events = state.events || [];
    const isLockedDay = Boolean(state.isLockedDay);

    const titleEl = document.getElementById("snapshotUnqueuedModalTitle");
    const subEl = document.getElementById("snapshotUnqueuedModalSub");
    const listEl = document.getElementById("snapshotUnqueuedModalList");

    if (titleEl) {
      titleEl.textContent = `Today's Unqueued Tasks (${tasks.length})`;
    }
    if (subEl) {
      if (tasks.length === 0 && events.length === 0) {
        subEl.textContent = "Every active item for today is already scheduled inside Priority Tasking.";
      } else if (tasks.length === 0) {
        subEl.textContent = `All tasks are in sequence (${events.length} scheduled event${events.length === 1 ? "" : "s"} remain outside the queue).`;
      } else {
        subEl.textContent = "These active items from today have not been added into Priority Tasking yet. Launch Focus, check them off, or slot them directly into the queue.";
      }
    }

    if (listEl) {
      const combined = [
        ...tasks.map(t => ({ ...t, itemType: "task" })),
        ...events.map(e => ({ ...e, tier: "event", itemType: "event" }))
      ];
      if (combined.length === 0) {
        listEl.innerHTML = `<div class="snapshot-unqueued-empty">Clean coverage — nothing left unqueued for today.</div>`;
      } else {
        listEl.innerHTML = combined.map(it => {
          const tierLabel = it.itemType === "event" ? "Event" : (it.tier === "trivial" ? "Trivial" : "Focus");
          const isOverdue = Boolean(it.is_overdue && !it.completed);
          return `
            <div class="snapshot-unqueued-row">
              <div class="snapshot-unqueued-row-left">
                <input type="checkbox" class="snapshot-unified-checkbox" ${it.completed ? 'checked' : ''} ${isLockedDay ? 'disabled' : ''}
                       onchange="Dashboard.toggleSnapshotItemStatus('${it.itemType}', ${it.id}, this.checked); Dashboard.openSnapshotUnqueuedModal();">
                <div class="snapshot-unqueued-row-info">
                  <div class="snapshot-unqueued-row-title">${this.escapeHtml(it.title)}</div>
                  <div class="snapshot-unqueued-row-meta">
                    <span class="snapshot-tier-tag is-${tierLabel.toLowerCase()}">${tierLabel}</span>
                    ${isOverdue ? `<span class="snapshot-meta-alert">Overdue</span>` : ""}
                    ${(it.time || it.time_label) ? `<span class="font-mono">${this.escapeHtml(it.time || it.time_label)}</span>` : ""}
                    ${it.project_name ? `<span>${this.escapeHtml(it.project_name)}</span>` : ""}
                  </div>
                </div>
              </div>
              ${!isLockedDay ? `
                <div class="snapshot-unqueued-row-actions">
                  ${it.itemType === "task" ? `
                    <button type="button" class="action-icon-btn snapshot-unified-focus-btn" onclick="Dashboard.closeSnapshotUnqueuedModal(); Dashboard.launchLockedFocusTask(${it.id})" title="Start Focus Sprint">
                      <i data-lucide="play" style="width:12px;height:12px;"></i> Focus
                    </button>
                  ` : ""}
                  <button type="button" class="snapshot-quick-queue-btn" onclick="Dashboard.queueUnqueuedFromModal('${it.itemType}', ${it.id})" title="Add to Priority Sequence">
                    <i data-lucide="plus" style="width:12px;height:12px;"></i> Sequence
                  </button>
                </div>
              ` : ""}
            </div>
          `;
        }).join("");
      }
    }

    modal.style.display = "flex";
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  closeSnapshotUnqueuedModal() {
    const modal = document.getElementById("snapshotUnqueuedModal");
    if (modal) modal.style.display = "none";
  },

  async queueUnqueuedFromModal(entityType, entityId) {
    await this.toggleQueueFromSnapshot(entityType, entityId);
    // Rebuild local fallback or refresh locked briefing immediately so modal + queue reflect change
    if (this.isSnapshotLocked) {
      await this.fetchSnapshotBriefing(this.selectedDate);
      this.openSnapshotUnqueuedModal();
    }
  },

  renderLockedSnapshotView() {
    const container = document.getElementById("snapshotLockedBriefingView");
    if (!container) return;

    const b = this.snapshotBriefing || this.buildLocalSnapshotFallback();
    const counts = b.counts || {};
    const remarkObj = b.remark || {};
    const remarkText = this.isSnapshotRemarkLoading
      ? "Horace is sizing up your schedule..."
      : (remarkObj.text || "One deliberate step at a time.");
    const isLockedDay = this.isPastDay() || this.isDaySealed(this.selectedDate);

    const tallyItems = [
      { label: "Focus", value: counts.focus_pending || 0, tone: "accent" },
      { label: "Trivial", value: counts.trivial_pending || 0, tone: "neutral" },
      { label: "Events", value: counts.events_pending || 0, tone: "neutral" }
    ];
    if ((counts.overdue_total || 0) > 0) {
      tallyItems.push({ label: "Overdue", value: counts.overdue_total, tone: "alert" });
    } else if ((counts.queued_pending || 0) > 0) {
      tallyItems.push({ label: "Queued", value: counts.queued_pending, tone: "accent" });
    } else if ((counts.projects_total || 0) > 0) {
      tallyItems.push({ label: "Projects", value: counts.projects_total, tone: "neutral" });
    } else {
      tallyItems.push({ label: "Done", value: counts.total_completed || 0, tone: "done" });
    }

    const renderQueueRow = (it, idx) => {
      const isDone = Boolean(it.completed);
      const itype = it.type || "task";
      const isOverdue = Boolean(it.is_overdue && !isDone);
      const rankHtml = `<span class="snapshot-unified-rank">${String(idx + 1).padStart(2, "0")}</span>`;

      const metaBits = [];
      if (isOverdue) metaBits.push(`<span class="snapshot-meta-alert">Overdue</span>`);
      if (it.time || it.time_label) metaBits.push(`<span class="font-mono">${this.escapeHtml(it.time || it.time_label)}</span>`);
      if (it.project_name) metaBits.push(`<span>${this.escapeHtml(it.project_name)}</span>`);
      if (it.tier) {
        const tierLabel = it.tier === "focus" ? "Focus" : (it.tier === "trivial" ? "Trivial" : "Event");
        metaBits.push(`<span class="snapshot-tier-tag is-${tierLabel.toLowerCase()}">${tierLabel}</span>`);
      }

      return `
        <div class="snapshot-unified-row snapshot-coalesce ${isDone ? 'completed' : ''}">
          <div class="snapshot-unified-row-main">
            ${rankHtml}
            <input type="checkbox" class="snapshot-unified-checkbox" ${isDone ? 'checked' : ''} ${isLockedDay ? 'disabled' : ''}
                   onclick="event.stopPropagation()" onchange="Dashboard.toggleSnapshotItemStatus('${itype}', ${it.id}, this.checked)"
                   title="${isLockedDay ? 'Past day items are locked' : 'Check off item'}">
            <div class="snapshot-unified-row-copy">
              <div class="snapshot-unified-item-title">${this.tokenizeParticleText(it.title || "")}</div>
              ${metaBits.length > 0 ? `<div class="snapshot-unified-item-meta">${metaBits.join('<span class="snapshot-meta-dot">·</span>')}</div>` : ''}
            </div>
          </div>
          ${(!isDone && itype === "task" && !isLockedDay) ? `
            <button type="button" class="action-icon-btn snapshot-unified-focus-btn" onclick="Dashboard.launchLockedFocusTask(${it.id})" title="Start Focus Sprint">
              <i data-lucide="play" style="width:13px;height:13px;"></i> <span>Focus</span>
            </button>
          ` : ''}
        </div>
      `;
    };

    const queue = b.priority_queue || [];
    const focusList = b.focus_items || [];
    const eventsList = b.events || [];
    const trivialList = b.trivial_items || [];

    // Compute today's active tasks & events not yet added to Priority Sequence
    const queuedTaskIds = new Set(queue.filter(q => !q.type || q.type === "task").map(q => String(q.id)));
    const queuedEventIds = new Set(queue.filter(q => q.type === "event").map(q => String(q.id)));
    const unqueuedTasks = [...focusList, ...trivialList].filter(t => !t.completed && !queuedTaskIds.has(String(t.id)));
    const unqueuedEvents = eventsList.filter(e => !e.completed && !queuedEventIds.has(String(e.id)));
    const totalPendingToday = (counts.total_pending !== undefined)
      ? counts.total_pending
      : ([...focusList, ...trivialList, ...eventsList].filter(x => !x.completed).length);
    this._snapshotUnqueuedState = {
      tasks: unqueuedTasks,
      events: unqueuedEvents,
      isLockedDay
    };

    const totalItems = counts.total_items !== undefined
      ? counts.total_items
      : (focusList.length + trivialList.length + eventsList.length);
    const completedItems = counts.total_completed !== undefined
      ? counts.total_completed
      : (focusList.filter(x => x.completed).length + trivialList.filter(x => x.completed).length + eventsList.filter(x => x.completed).length);
    const endNotice = this.getBriefingEndNotice(this.selectedDate);
    const eyebrowText = isLockedDay
      ? "Archived Briefing"
      : (this.isFutureDay() ? "Preview Briefing" : "Executive Briefing");
    const debBtn = document.getElementById("eveningDebriefDashBtn");
    const showDebriefTail = debBtn && debBtn.style.display !== "none";

    const unqueuedLabel = unqueuedTasks.length > 0
      ? `${unqueuedTasks.length} of today's task${unqueuedTasks.length === 1 ? " hasn't" : "s haven't"} been added to the sequence yet`
      : (totalPendingToday === 0
        ? "All of today's tasks are ticked off"
        : "Every pending task for today is lined up in your sequence");

    container.innerHTML = `
      <div class="snapshot-unified-doc">
        <header class="snapshot-unified-hero-spread">
          <div class="snapshot-unified-hero-copy snapshot-coalesce">
            <div class="snapshot-unified-eyebrow">${this.escapeHtml(eyebrowText)}</div>
            <p class="snapshot-unified-prose" id="snapshotNarrativeProse">${this.buildHighlightedNarrativeHtml(b)} <span class="snapshot-lead-remark-inline ${this.isSnapshotRemarkLoading ? 'is-loading' : ''}" id="snapshotInlineRemark" title="${remarkObj.source === 'llm' ? 'Horace · Local LLM' : 'Horace'}">${this.tokenizeParticleText(remarkText, "is-remark", 8)}</span><button type="button" class="snapshot-inline-refresh-btn" onclick="Dashboard.refreshSnapshotRemark()" title="Refresh Horace's remark" ${this.isSnapshotRemarkLoading ? 'disabled' : ''}><i data-lucide="refresh-cw" style="width:13px;height:13px;"></i></button></p>
          </div>
          <div class="snapshot-unified-tally snapshot-coalesce" aria-label="Briefing summary counters">
            ${tallyItems.map(t => `
              <div class="snapshot-tally-cell is-${t.tone}">
                <span class="snapshot-tally-num">${t.value}</span>
                <span class="snapshot-tally-label">${this.escapeHtml(t.label)}</span>
              </div>
            `).join("")}
          </div>
        </header>

        <div class="snapshot-unified-streams">
          <section class="snapshot-unified-section snapshot-stream-wide">
            <div class="snapshot-unified-section-header snapshot-coalesce">
              <span>Priority Execution Sequence</span>
              <span class="snapshot-unified-section-count">${counts.queued_pending || 0} of ${queue.length} remaining</span>
            </div>
            ${queue.length > 0 ? `
              <div class="snapshot-unified-list ${queue.length >= 3 ? 'snapshot-unified-list--grid' : ''}">
                ${queue.map((it, idx) => renderQueueRow(it, idx)).join("")}
              </div>
            ` : `
              <div class="snapshot-queue-empty-note snapshot-coalesce">
                No tasks have been pinned into Priority Execution Sequence yet. Open remaining items below or unlock to curate your order.
              </div>
            `}
          </section>
        </div>

        <!-- Bottom Unqueued Modal Strip -->
        <div class="snapshot-unqueued-bottom-modal snapshot-coalesce" role="button" tabindex="0" onclick="Dashboard.openSnapshotUnqueuedModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Dashboard.openSnapshotUnqueuedModal();}" title="Click to view remaining tasks not yet in sequence">
          <div class="snapshot-unqueued-bottom-left">
            <span class="snapshot-unqueued-count-badge font-mono">${unqueuedTasks.length}</span>
            <div class="snapshot-unqueued-copy">
              <div class="snapshot-unqueued-title">${this.escapeHtml(unqueuedLabel)}</div>
              ${unqueuedEvents.length > 0 ? `<div class="snapshot-unqueued-sub">+ ${unqueuedEvents.length} scheduled event${unqueuedEvents.length === 1 ? "" : "s"} outside sequence</div>` : ""}
            </div>
          </div>
          <span class="snapshot-unqueued-cta">
            <span>View list</span>
            <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
          </span>
        </div>

        <footer class="snapshot-unified-tail snapshot-coalesce">
          <div class="snapshot-tail-left">
            <div class="snapshot-tail-specs">
              <span class="snapshot-tail-spec">LOCKED IN</span>
              <span class="snapshot-tail-spec font-mono">${completedItems}/${totalItems} DONE</span>
            </div>
            <div class="snapshot-tail-caption">// ${this.escapeHtml(endNotice)} //</div>
          </div>
          <div class="snapshot-tail-actions">
            ${!isLockedDay ? `
              <button type="button" class="snapshot-tail-icon-btn" onclick="FocusCockpit.launchTopTask()" title="Launch Focus Cockpit">
                <i data-lucide="zap" style="width:15px;height:15px;"></i>
              </button>
            ` : ""}
            ${showDebriefTail ? `
              <button type="button" class="snapshot-tail-icon-btn" onclick="EveningDebrief.open()" title="Evening Debrief">
                <i data-lucide="moon-star" style="width:15px;height:15px;"></i>
              </button>
            ` : ""}
            <button type="button" class="snapshot-tail-icon-btn" onclick="Dashboard.copyBriefingMarkdown()" title="Copy Snapshot brief">
              <i data-lucide="copy" style="width:15px;height:15px;"></i>
            </button>
            ${!isLockedDay ? `
              <button type="button" class="snapshot-tail-icon-btn" onclick="Dashboard.unlockSnapshot()" title="Unlock to edit">
                <i data-lucide="unlock" style="width:15px;height:15px;"></i>
              </button>
            ` : ""}
          </div>
        </footer>
      </div>
    `;
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
    this.initSnapshotScrollParticles(container);
  },

  async copyBriefingMarkdown() {
    if (this.isSnapshotLocked && this.snapshotBriefing && this.snapshotBriefing.copy_text) {
      let ok = false;
      const lockedText = this.snapshotBriefing.copy_text;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(lockedText);
          ok = true;
        } catch (e) {}
      }
      if (!ok) {
        try {
          const ta = document.createElement("textarea");
          ta.value = lockedText;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          ok = document.execCommand("copy");
          ta.remove();
        } catch (e) {}
      }
      App.showToast(ok ? "Locked-In Snapshot copied to clipboard!" : "Failed to copy brief to clipboard.", !ok);
      return;
    }

    let text = (this.briefingMarkdown && this.briefingMarkdown !== "Loading executive brief...") ? this.briefingMarkdown : "";
    if (!text) {
      const el = document.getElementById("briefingRichContent");
      if (el && el.textContent && el.textContent !== "Loading executive brief...") {
        text = el.textContent;
      }
    }
    if (!text) {
      try {
        const res = await fetch(`/api/briefing/text?date=${this.selectedDate}`);
        if (res.ok) {
          const d = await res.json();
          text = d.markdown || "";
          this.briefingMarkdown = text;
        }
      } catch (e) {}
    }
    if (!text && this.briefingData) {
      const parts = [`# PETTR Operational Snapshot — ${this.selectedDate}`];
      if (this.briefingData.focus_tasks && this.briefingData.focus_tasks.length > 0) {
        parts.push("\n## Focus Tasks");
        this.briefingData.focus_tasks.forEach(t => parts.push(`- [ ] ${t.title}${t.due_time ? ' (' + t.due_time + ')' : ''}`));
      }
      if (this.briefingData.trivial_tasks && this.briefingData.trivial_tasks.length > 0) {
        parts.push("\n## Trivial Tasks");
        this.briefingData.trivial_tasks.forEach(t => parts.push(`- [ ] ${t.title}`));
      }
      if (this.briefingData.appointments && this.briefingData.appointments.length > 0) {
        parts.push("\n## Events");
        this.briefingData.appointments.forEach(e => parts.push(`- ${e.title}${e.due_time ? ' (' + e.due_time + ')' : ''}`));
      }
      if (this.briefingData.reminders && this.briefingData.reminders.length > 0) {
        parts.push("\n## Reminders");
        this.briefingData.reminders.forEach(r => parts.push(`- ${r.title}`));
      }
      text = parts.join("\n");
    }

    if (!text) {
      App.showToast("No briefing content available to copy.", true);
      return;
    }
    let success = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (e) {}
    }
    if (!success) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand("copy");
        ta.remove();
      } catch (e) {}
    }
    if (success) {
      App.showToast("Morning Brief copied to clipboard!", 2500);
    } else {
      App.showToast("Failed to copy brief to clipboard.", true);
    }
  },

  async loadTasks() {
    try {
      const res = await fetch(`/api/tasks?date=${this.selectedDate}`);
      if (!res.ok) return;
      this.tasks = await res.json();
      if (this.briefingData) {
        this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
      }

      // 1. Render Projects Panel (e.g. "Complete trade analysis for 3U CubeSat")
      this.renderProjectsPanel(this.tasks.projects || []);

      // 2. Render Standalone Tasks Panel (e.g. "Calculus Quiz 3")
      // Use standalone lists if available, or filter by project_id === null
      const standaloneFocus = this.tasks.standalone_focus || (this.tasks.focus || []).filter(t => !t.project_id);
      const standaloneTrivial = this.tasks.standalone_trivial || (this.tasks.trivial || []).filter(t => !t.project_id);

      this.renderTaskList("focusTasksList", standaloneFocus);
      this.renderTaskList("trivialTasksList", standaloneTrivial);
    } catch (err) {
      console.error("Error loading tasks:", err);
    }
  },

  renderProjectsPanel(projects) {
    const container = document.getElementById("projectsList");
    if (!container) return;
    container.innerHTML = "";

    if (!projects || projects.length === 0) {
      if (this.isPastDay()) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">No projects had tasks recorded for this archived day.<br><span style="display:inline-block; margin-top:8px;">View all in <a href="javascript:void(0)" onclick="App.navigateToGlobalProjects()" style="color:var(--text-main); font-weight:700; text-decoration:underline;">Global Projects Pool</a>.</span></div>';
      } else {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">No projects have tasks scheduled for this day.<br><span style="display:inline-block; margin-top:8px;">View all in <a href="javascript:void(0)" onclick="App.navigateToGlobalProjects()" style="color:var(--text-main); font-weight:700; text-decoration:underline;">Global Projects Pool</a> or create a <a href="javascript:void(0)" onclick="Dashboard.openManualCreateModal(\'project\')" style="color:var(--text-main); font-weight:700; text-decoration:underline;">+ New Project</a>.</span></div>';
      }
      return;
    }

    const isPast = this.isPastDay();
    const isFuture = this.isFutureDay();

    projects.forEach(p => {
      const tasks = p.tasks || [];
      const total = tasks.length;
      const done = tasks.filter(t => t.status === "completed").length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      const box = document.createElement("div");
      box.className = "dashboard-project-box";

      box.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 15px; color: var(--text-main); cursor: pointer;" onclick="EntityModal.open('project', ${p.id})" title="Click to edit project details">
              <i data-lucide="folder" style="width:14px;height:14px;display:inline-block;vertical-align:-1px;margin-right:4px;"></i>${this.escapeHtml(p.name)}
            </div>
            ${p.description ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${this.escapeHtml(p.description)}</div>` : ''}
          </div>
          <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">${done}/${total} done (${pct}%)</span>
        </div>

        <div class="project-progress-bar">
          <div class="project-progress-fill" style="width: ${pct}%;"></div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
          ${tasks.length === 0 ? '<div style="font-size: 12px; color: var(--text-dim); font-style: italic;">No tasks under this project yet.</div>' : ''}
          ${tasks.map((t, idx) => {
            const isCompleted = t.status === "completed";
            const rankStr = String(idx + 1).padStart(2, "0");
            let cbDisabled = "";
            let cbTitle = "Check off task";
            if (isPast) {
              cbDisabled = "disabled";
              cbTitle = "Past day items are locked to preserve productivity score integrity";
            } else if (isFuture) {
              cbDisabled = "disabled";
              cbTitle = "Cannot complete future tasks before the date arrives";
            }
            const isSubOverdue = Boolean(!isCompleted && (t.is_overdue || t.is_rolled_over || (t.urgency && t.urgency.label === "Overdue")));
            return `
              <div class="task-item ${isCompleted ? 'completed' : ''} ${isPast ? 'is-locked' : ''}" style="padding: 8px 10px; font-size: 13px;">
                <span class="priority-num-badge" title="Subtask priority #${idx + 1}">${rankStr}</span>
                <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} ${cbDisabled}
                       onchange="Dashboard.toggleTaskStatus(${t.id}, this.checked)" title="${cbTitle}">
                <div class="task-body" onclick="${isPast ? '' : `EntityModal.open('task', ${t.id})`}" title="${isPast ? 'Locked historical task' : 'Click to edit or re-sort'}">
                  <span class="task-title" style="font-size: 13px; ${isCompleted ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                    ${this.escapeHtml(t.title)}
                  </span>
                  ${isSubOverdue ? `<span class="urgency-badge overdue" style="font-size:9px; padding:1px 5px; margin-left:6px;">OVERDUE</span>` : ''}
                </div>
                ${isPast ? '<span style="font-size:11px; color:var(--text-dim);"><i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i></span>' : `<button class="action-icon-btn" onclick="event.stopPropagation(); EntityModal.open('task', ${t.id})" title="Edit / Re-sort" style="padding: 3px 8px;"><i data-lucide="edit-3" style="width:11px;height:11px;"></i></button>`}
              </div>
            `;
          }).join('')}
          ${(p.later_tasks && p.later_tasks.length > 0) ? `
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--card-border);">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">
                Later / Upcoming Tasks (${p.later_tasks.length})
              </div>
              ${p.later_tasks.map(lt => `
                <div class="task-item" style="padding: 6px 10px; font-size: 12.5px; opacity: 0.5; background: transparent; border: 1px dashed var(--card-border);">
                  <span style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">Later</span>
                  <div class="task-body">
                    <span class="task-title" style="color: var(--text-muted);">${this.escapeHtml(lt.title)}</span>
                    ${lt.due_date ? `<span style="font-size: 11px; color: var(--text-dim); margin-left: 6px;">(Due: ${lt.due_date.split(' ')[0]})</span>` : ''}
                  </div>
                  <span style="font-size: 10.5px; padding: 2px 6px; border-radius: 4px; background: var(--bg-tertiary); color: var(--text-dim);">Upcoming</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 6px;">
            ${isPast ? '' : `<button class="action-icon-btn" onclick="Dashboard.openManualCreateModal('focus', '${this.escapeHtml(p.name)}')">+ Add Task</button>`}
            ${isPast ? '<span style="font-size:12px; color:var(--text-dim); font-weight:600;">🔒 Project Log Locked</span>' : `<button class="action-icon-btn" onclick="Dashboard.completeProject(${p.id}, '${this.escapeHtml(p.name)}')" style="color: var(--accent-green); font-weight: 600;" title="Wrap up and mark project complete">✓ Complete Project</button>`}
          </div>
          <button class="action-icon-btn" onclick="EntityModal.open('project', ${p.id})">Project Settings →</button>
        </div>
      `;

      container.appendChild(box);
    });
  },

  promptAddTaskToProject(projectName) {
    this.openManualCreateModal("focus", projectName);
  },

  renderTaskList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    if (!list || list.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; padding: 16px 0; text-align: center;">No active tasks in this list.</div>';
      return;
    }

    const isPast = this.isPastDay();
    const isFuture = this.isFutureDay();

    list.forEach((task, idx) => {
      const isCompleted = task.status === "completed";
      const cleanTitle = (task.title || "").replace(/^\s*\[.*?\]\s*/, '');
      const el = document.createElement("div");
      el.className = `task-item ${isCompleted ? "completed" : ""} ${isPast ? "is-locked" : ""}`;
      el.dataset.taskId = task.id;

      const rankStr = String(idx + 1).padStart(2, "0");
      const urgencyLevel = task.urgency ? task.urgency.level : "none";
      const urgencyLabel = task.urgency ? task.urgency.label : "No Date";
      const dueText = task.due_date ? App.formatMilitaryTime(task.due_date) : (task.due_date_raw ? App.formatMilitaryTime(task.due_date_raw) : "");

      const isTimeSensitive = Boolean(task.is_time_sensitive);
      const isOverdue = Boolean(!isCompleted && (task.is_overdue || task.is_rolled_over || (task.urgency && task.urgency.label === "Overdue")));
      const badgeHtml = isCompleted
        ? ''
        : (isOverdue
          ? `<span class="urgency-badge overdue">OVERDUE${dueText ? ` (${dueText})` : ''}</span>`
          : (isTimeSensitive
            ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE${dueText ? ` (${dueText})` : ''}</span>`
            : (urgencyLevel !== 'none' && urgencyLevel !== 'urgent' && urgencyLevel !== 'completed' ? `<span class="urgency-badge ${urgencyLevel}">${urgencyLabel}${dueText ? ` (${dueText})` : ''}</span>` : (dueText ? `<span class="due-pill" style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${dueText}</span>` : ''))));

      let recurrenceHtml = "";
      if (task.recurrence) {
        recurrenceHtml = `<span class="recurrence-badge">↻ ${task.recurrence.replace("FREQ=WEEKLY;BYDAY=", "Weekly: ")}</span>`;
      }

      let projectHtml = "";
      if (task.project_name) {
        projectHtml = `<span class="project-tag">${this.escapeHtml(task.project_name)}</span>`;
      }

      let remindersHtml = "";
      if (task.reminders && task.reminders.length > 0) {
        remindersHtml = `<div style="margin-top: 6px; padding-left: 8px; border-left: 2px solid var(--card-border); font-size: 11px; color: var(--text-muted);">
          ${task.reminders.map(r => `<div>• ${r.title} ${r.details ? `(${r.details})` : ''}</div>`).join('')}
        </div>`;
      }

      let checkboxAttr = isCompleted ? "checked" : "";
      let checkboxDisabled = "";
      let checkboxTitle = "Check off task";
      if (isPast) {
        checkboxDisabled = "disabled";
        checkboxTitle = "Past day items are locked to preserve productivity score integrity";
      } else if (isFuture) {
        checkboxDisabled = "disabled";
        checkboxTitle = "Cannot complete future tasks before the date arrives";
      }

      const dragHandle = isPast 
        ? '<span class="drag-handle disabled" title="Past records are locked"><i data-lucide="lock" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;"></i></span>' 
        : '<span class="drag-handle" title="Hold & drag to reorder">≡</span>';

      const actionsHtml = isPast ? `
        <div class="task-actions">
          <span style="font-size:11px; color:var(--text-dim);" title="Archived item locked"><i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> Locked</span>
        </div>
      ` : `
        <div class="task-actions">
          <button class="action-icon-btn ${isTimeSensitive ? 'active-ts' : ''}" onclick="event.stopPropagation(); Dashboard.toggleTaskTimeSensitive(${task.id})" title="${isTimeSensitive ? 'Remove TIME SENSITIVE flag' : 'Mark as TIME SENSITIVE'}"><i data-lucide="clock" style="width:11px;height:11px;${isTimeSensitive ? 'color:var(--urgent-orange);' : ''}"></i></button>
          <button class="action-icon-btn" onclick="event.stopPropagation(); EntityModal.open('task', ${task.id})" title="Edit / Re-sort"><i data-lucide="edit-3" style="width:11px;height:11px;"></i></button>
          <button class="action-icon-btn" onclick="event.stopPropagation(); Dashboard.deleteTask(${task.id})" title="Delete task"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
        </div>
      `;

      el.innerHTML = `
        ${dragHandle}
        <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
        <input type="checkbox" class="task-checkbox" ${checkboxAttr} ${checkboxDisabled}
               onchange="Dashboard.toggleTaskStatus(${task.id}, this.checked)" title="${checkboxTitle}">
        <div class="task-body" onclick="${isPast ? '' : `EntityModal.open('task', ${task.id})`}" title="${isPast ? 'Locked historical record' : 'Click to view details, edit, or re-sort'}">
          <div class="task-title" style="${isCompleted ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
            ${this.escapeHtml(cleanTitle)}
          </div>
          <div class="task-meta">
            ${projectHtml}
            ${badgeHtml}
            ${recurrenceHtml}
          </div>
          ${remindersHtml}
        </div>
        ${actionsHtml}
      `;

      if (!isPast) {
        DragDrop.makeDraggable(el, container);
      }
      container.appendChild(el);
    });
  },

  async toggleTaskStatus(taskId, isCompleted) {
    if (this.isPastDay()) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    if (this.isFutureDay()) {
      App.showToast("Cannot complete future tasks before their date arrives.", true);
      return;
    }
    this.syncLocalEntityStatus("task", taskId, isCompleted);
    this.renderDailyOrder();
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCompleted ? "completed" : "pending" })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        App.showToast(err.detail || "Failed to update task status", true);
        await this.refresh();
        return;
      }
      App.showToast(isCompleted ? "Task completed! Marked with strikethrough." : "Task reopened.");
      this.syncLocalEntityStatus("task", taskId, isCompleted);
      if (this.dailyOrder && this.dailyOrder.some(item => (item.type === "task" || !item.type) && String(item.id) === String(taskId))) {
        this.renderDailyOrder();
        await this.saveDailyOrder();
      }
      await this.refresh();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
      await this.refresh();
    }
  },

  async toggleTaskTimeSensitive(taskId) {
    if (this.isPastDay()) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${taskId}/toggle-time-sensitive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        const isTs = data.task && data.task.is_time_sensitive;
        App.showToast(isTs ? "Marked as TIME SENSITIVE" : "TIME SENSITIVE flag removed");
        await this.refresh();
        await this.loadBriefing();
        if (typeof Timeline !== "undefined") Timeline.refresh();
      } else {
        App.showToast("Failed to toggle time sensitive flag", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error updating task", true);
    }
  },

  async deleteTask(taskId) {
    if (this.isPastDay()) {
      App.showToast("Past day records are locked and cannot be deleted.", true);
      return;
    }
    if (!confirm("Delete this task?")) return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      App.showToast("Task deleted");
      await this.refresh();
      await this.loadBriefing();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
    }
  },

  async loadEvents() {
    try {
      const res = await fetch(`/api/events?date=${this.selectedDate}`);
      if (!res.ok) return;
      this.events = await res.json();
      const container = document.getElementById("eventsList");
      if (!container) return;
      container.innerHTML = "";
      if (this.events.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">No appointments for this day.</div>';
        return;
      }
      const isPast = this.isPastDay();
      const isFuture = this.isFutureDay();
      this.events.forEach((e, idx) => {
        const rankStr = String(idx + 1).padStart(2, "0");
        const timePart = e.start_time ? (App.formatEventPeriod ? App.formatEventPeriod(e.start_time, e.end_time) : App.formatMilitaryTime(e.start_time)) : "Today";
        const isCompleted = e.status === "completed";
        const div = document.createElement("div");
        div.className = `task-item ${isCompleted ? "completed" : ""} ${isPast ? "is-locked" : ""}`;

        let cbDisabled = "";
        let cbTitle = "Check off appointment";
        if (isPast) {
          cbDisabled = "disabled";
          cbTitle = "Archived appointment (locked)";
        } else if (isFuture) {
          cbDisabled = "disabled";
          cbTitle = "Cannot complete future appointments before date arrives";
        }

        div.innerHTML = `
          <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
          <input type="checkbox" class="task-checkbox" ${isCompleted ? "checked" : ""} ${cbDisabled}
                 onchange="event.stopPropagation(); Dashboard.toggleEventStatus(${e.id}, this.checked)" title="${cbTitle}">
          <div style="background: var(--bg-tertiary); color: var(--text-main); border: 1px solid var(--card-border); padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; font-family: var(--font-mono);">
            ${timePart || 'Today'}
          </div>
          <div class="task-body" onclick="${isPast ? '' : `EntityModal.open('event', ${e.id})`}">
            <div class="task-title" style="${isCompleted ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">${this.escapeHtml(e.title)}</div>
            ${e.project_name ? `<span class="project-tag">${e.project_name}</span>` : ''}
          </div>
          ${isPast ? '<span style="font-size:11px; color:var(--text-dim);"><i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> Locked</span>' : ''}
        `;
        container.appendChild(div);
      });
    } catch (err) {
      console.error(err);
    }
  },

  async toggleEventStatus(eventId, isCompleted) {
    if (this.isPastDay()) {
      App.showToast("Cannot modify locked historical records.", true);
      return;
    }
    if (this.isFutureDay()) {
      App.showToast("Cannot complete future appointments before their date arrives.", true);
      return;
    }
    this.syncLocalEntityStatus("event", eventId, isCompleted);
    this.renderDailyOrder();
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCompleted ? "completed" : "scheduled" })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        App.showToast(err.detail || "Failed to update appointment status", true);
        await this.refresh();
        return;
      }
      App.showToast(isCompleted ? "Appointment completed!" : "Appointment reopened.");
      this.syncLocalEntityStatus("event", eventId, isCompleted);
      if (this.dailyOrder && this.dailyOrder.some(item => item.type === "event" && String(item.id) === String(eventId))) {
        this.renderDailyOrder();
        await this.saveDailyOrder();
      }
      await this.refresh();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error("Error updating event status:", err);
      await this.refresh();
    }
  },

  async loadReminders() {
    try {
      const res = await fetch(`/api/reminders?date=${this.selectedDate}`);
      if (!res.ok) return;
      this.reminders = await res.json();
      const container = document.getElementById("remindersList");
      if (!container) return;
      container.innerHTML = "";
      if (this.reminders.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">No reminders for this day.</div>';
        return;
      }
      const isPast = this.isPastDay();
      const isFuture = this.isFutureDay();
      this.reminders.forEach((r, idx) => {
        const rankStr = String(idx + 1).padStart(2, "0");
        const div = document.createElement("div");
        div.className = `task-item ${r.is_dismissed ? "completed" : ""} ${isPast ? "is-locked" : ""}`;
        let cbDisabled = "";
        let cbTitle = "Dismiss reminder";
        if (isPast) {
          cbDisabled = "disabled";
          cbTitle = "Archived reminder (locked)";
        } else if (isFuture) {
          cbDisabled = "disabled";
          cbTitle = "Future reminder";
        }
        div.innerHTML = `
          <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
          <input type="checkbox" class="task-checkbox" ${r.is_dismissed ? "checked" : ""} ${cbDisabled}
                 onchange="event.stopPropagation(); Dashboard.toggleReminder(${r.id})" title="${cbTitle}">
          <div class="task-body" onclick="${isPast ? '' : `EntityModal.open('reminder', ${r.id})`}" title="${isPast ? 'Locked historical reminder' : 'Click to inspect or re-sort reminder'}">
            <div class="task-title" style="${r.is_dismissed ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">${this.escapeHtml(r.title)}</div>
            ${r.details ? `<div style="font-size: 12px; color: var(--text-muted);">${r.details}</div>` : ''}
          </div>
          ${isPast ? '<span style="font-size:11px; color:var(--text-dim);"><i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> Locked</span>' : ''}
        `;
        container.appendChild(div);
      });
    } catch (err) {
      console.error(err);
    }
  },

  async toggleReminder(reminderId) {
    try {
      await fetch(`/api/reminders/${reminderId}/toggle`, { method: "PATCH" });
      await this.refresh();
    } catch (err) {
      console.error(err);
    }
  },

  async checkUnorganized() {
    try {
      const res = await fetch("/api/unorganized");
      if (!res.ok) return;
      const items = await res.json();
      
      const permanentList = document.getElementById("unorgPermanentList");
      const unorgBadgeCount = document.getElementById("unorgPermanentCount");
      const statPill = document.getElementById("statPillUnorg");
      const pillCount = document.getElementById("statUnorg");

      if (unorgBadgeCount) unorgBadgeCount.textContent = items.length;
      if (pillCount) pillCount.textContent = items.length;

      if (items.length > 0) {
        if (statPill) statPill.style.display = "inline-flex";
      } else {
        if (statPill) statPill.style.display = "none";
      }

      if (permanentList) {
        permanentList.innerHTML = "";
        if (items.length === 0) {
          permanentList.innerHTML = `
            <div style="padding: 12px 16px; background: var(--normal-green-bg); border: 1px solid #bbf7d0; border-radius: 8px; font-size: 13px; color: var(--normal-green); display: flex; align-items: center; gap: 8px;">
              <span>✓</span>
              <span><strong>Queue is clear.</strong> All logged inputs are organised into projects, tasks, or events.</span>
            </div>
          `;
        } else {
          items.forEach(item => {
            const div = document.createElement("div");
            div.style.background = "var(--bg-secondary)";
            div.style.padding = "12px 14px";
            div.style.borderRadius = "8px";
            div.style.border = "1px solid var(--card-border)";
            div.style.marginBottom = "8px";
            div.style.cursor = "pointer";
            div.title = "Click/tap to inspect and edit in modal";
            div.onclick = (e) => {
              if (e.target.closest("button")) return;
              EntityModal.open("unorganized", item.id);
            };

            div.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 4px; font-size: 13.5px; display: flex; justify-content: space-between; align-items: flex-start;">
                <span>"${this.escapeHtml(item.raw_input)}"</span>
                <span style="font-size: 10px; color: var(--text-muted); font-weight: 400;">Tap to edit ↗</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">
                Routing note: ${item.reasoning || 'Uncertain routing'}
              </div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'task', 'focus', '${this.escapeHtml(item.raw_input)}')">🎯 Focus</button>
                <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'task', 'trivial', '${this.escapeHtml(item.raw_input)}')">⚡ Trivial</button>
                <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'event', null, '${this.escapeHtml(item.raw_input)}')">📅 Event</button>
                <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'reminder', null, '${this.escapeHtml(item.raw_input)}')">🔔 Reminder</button>
                <button class="action-icon-btn" onclick="EntityModal.open('unorganized', ${item.id})" style="color: var(--focus-indigo); font-weight: 600;">✏️ Edit</button>
                <button class="action-icon-btn" onclick="Dashboard.deleteUnorg(${item.id})" style="color: var(--urgent-orange); font-weight: 600;" title="Delete this item">🗑️ Delete</button>
              </div>
            `;
            permanentList.appendChild(div);
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  async openUnorganizedModal(focusDirectInput = false) {
    try {
      const res = await fetch("/api/unorganized");
      const items = await res.json();
      const listContainer = document.getElementById("unorganizedModalList");
      if (!listContainer) return;
      listContainer.innerHTML = "";

      if (items.length === 0) {
        listContainer.innerHTML = "<p style='color: var(--text-muted); text-align: center; padding: 20px 0;'>All caught up! The unorganised queue is clear.</p>";
      } else {
        items.forEach(item => {
          const div = document.createElement("div");
          div.style.background = "var(--bg-secondary)";
          div.style.padding = "14px";
          div.style.borderRadius = "8px";
          div.style.border = "1px solid var(--card-border)";
          div.style.cursor = "pointer";
          div.title = "Click/tap to inspect and edit in modal";
          div.onclick = (e) => {
            if (e.target.closest("button")) return;
            const um = document.getElementById("unorganizedModal");
            if (um) um.dataset.wasOpen = "true";
            Dashboard.closeUnorganizedModal();
            EntityModal.open("unorganized", item.id);
          };

          div.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 6px; font-size: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
              <span>"${this.escapeHtml(item.raw_input)}"</span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: 400;">Tap to edit ↗</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Routing note: ${item.reasoning || 'Uncertain routing'}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'task', 'focus', '${this.escapeHtml(item.raw_input)}')">🎯 Focus Task</button>
              <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'task', 'trivial', '${this.escapeHtml(item.raw_input)}')">⚡ Trivial Errands</button>
              <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'event', null, '${this.escapeHtml(item.raw_input)}')">📅 Event</button>
              <button class="action-icon-btn" onclick="Dashboard.resolveUnorg(${item.id}, 'reminder', null, '${this.escapeHtml(item.raw_input)}')">🔔 Reminder</button>
              <button class="action-icon-btn" onclick="const um = document.getElementById('unorganizedModal'); if (um) um.dataset.wasOpen = 'true'; Dashboard.closeUnorganizedModal(); EntityModal.open('unorganized', ${item.id});" style="color: var(--focus-indigo); font-weight: 600;">✏️ Edit Details</button>
              <button class="action-icon-btn" onclick="Dashboard.deleteUnorg(${item.id})" style="color: var(--urgent-orange); font-weight: 600;" title="Delete this item">🗑️ Delete</button>
            </div>
          `;
          listContainer.appendChild(div);
        });
      }
      document.getElementById("unorganizedModal").style.display = "flex";
      if (focusDirectInput) {
        setTimeout(() => {
          const directInput = document.getElementById("manualUnorgInput");
          if (directInput) directInput.focus();
        }, 50);
      }
    } catch (err) {
      console.error(err);
    }
  },

  async addDirectUnorg() {
    const input = document.getElementById("manualUnorgInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      App.showToast("Please enter text for the unorganised item", true);
      return;
    }
    try {
      const res = await fetch("/api/unorganised", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: text })
      });
      if (res.ok) {
        input.value = "";
        App.showToast("Added to Unorganised Queue!");
        await this.checkUnorganized();
        await this.openUnorganizedModal();
      } else {
        const data = await res.json();
        App.showToast(data.detail || "Failed to add unorganised item", true);
      }
    } catch (e) {
      console.error(e);
      App.showToast("Network error adding unorganised item", true);
    }
  },

  closeUnorganizedModal() {
    document.getElementById("unorganizedModal").style.display = "none";
  },

  async deleteUnorg(id) {
    if (!confirm("Are you sure you want to delete this unorganised item?")) return;
    try {
      const res = await fetch(`/api/unorganized/${id}`, { method: "DELETE" });
      if (res.ok) {
        App.showToast("Item deleted from queue.");
        this.closeUnorganizedModal();
        await this.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
      } else {
        App.showToast("Failed to delete item.", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error deleting item.", true);
    }
  },

  async resolveUnorg(id, entityType, tier, title) {
    try {
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      // Never route triage into locked historical past days
      const targetDate = this.isPastDay() ? todayStr : (this.selectedDate || todayStr);
      const targetDueDate = `${targetDate} 23:59:00`;

      await fetch(`/api/unorganized/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          tier: tier,
          title: title,
          due_date: targetDueDate
        })
      });
      App.showToast("Item sorted successfully!");
      this.closeUnorganizedModal();
      await this.refresh();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
    }
  },

  async completeProject(projectId, projectName) {
    if (!confirm(`Are you sure you want to mark project "${projectName}" as completed? This will wrap up all subtasks and move it to the History archive.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/complete`, {
        method: "POST"
      });
      if (res.ok) {
        App.showToast(`🏆 Project "${projectName}" completed and archived!`);
        await this.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
      } else {
        App.showToast("Failed to complete project", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error completing project", true);
    }
  },

  currentManualType: "focus",

  async openManualCreateModal(defaultType = "focus", prefillProject = null) {
    if (this.isPastDay()) {
      App.showToast("Cannot add new items to a past or sealed day. Return to Today or select a future day.", true);
      return;
    }
    this.selectManualType(defaultType);
    const titleInput = document.getElementById("manualInputTitle");
    const descInput = document.getElementById("manualInputDesc");
    const dateInput = document.getElementById("manualInputDate");
    const evStart = document.getElementById("manualEventStart");
    const evEnd = document.getElementById("manualEventEnd");
    if (titleInput) titleInput.value = "";
    if (descInput) descInput.value = "";
    if (dateInput) dateInput.value = "";
    if (evStart) evStart.value = "";
    if (evEnd) evEnd.value = "";
    
    await this.populateManualProjectDropdown();

    if (prefillProject) {
      const projSelect = document.getElementById("manualInputProject");
      if (projSelect) {
        let found = false;
        for (let opt of projSelect.options) {
          if (opt.value === prefillProject) {
            found = true;
            break;
          }
        }
        if (!found) {
          const opt = document.createElement("option");
          opt.value = prefillProject;
          opt.textContent = prefillProject;
          projSelect.appendChild(opt);
        }
        projSelect.value = prefillProject;
      }
    }

    const overlay = document.getElementById("manualCreateModalOverlay");
    if (overlay) overlay.style.display = "flex";
    if (titleInput) titleInput.focus();
  },

  closeManualCreateModal() {
    const overlay = document.getElementById("manualCreateModalOverlay");
    if (overlay) overlay.style.display = "none";
  },

  async populateManualProjectDropdown() {
    const projSelect = document.getElementById("manualInputProject");
    if (!projSelect) return;
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const projects = await res.json();
        projSelect.innerHTML = '<option value="">-- No Project (Standalone) --</option>';
        projects.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.name;
          opt.textContent = p.name;
          projSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error("Error populating projects", err);
    }
  },

  selectManualType(type) {
    this.currentManualType = type;
    const btns = document.querySelectorAll("#manualCreateTypeSwitcher button");
    btns.forEach(b => {
      if (b.getAttribute("data-type") === type) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    const projectRow = document.getElementById("manualProjectRow");
    const dateRow = document.getElementById("manualDateRow");
    const eventPeriodRow = document.getElementById("manualEventPeriodRow");
    const colorRow = document.getElementById("manualProjectColorRow");
    const categoryRow = document.getElementById("manualProjectCategoryRow");
    const titleLabel = document.getElementById("manualInputTitleLabel");
    const dateLabel = document.getElementById("manualInputDateLabel");

    if (type === "project") {
      if (projectRow) projectRow.style.display = "none";
      if (dateRow) dateRow.style.display = "none";
      if (eventPeriodRow) eventPeriodRow.style.display = "none";
      if (categoryRow) categoryRow.style.display = "block";
      if (colorRow) colorRow.style.display = "block";
      if (titleLabel) titleLabel.textContent = "Project Name *";

      const paletteContainer = document.getElementById("manualColorPalette");
      if (paletteContainer && paletteContainer.children.length === 0) {
        const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#e11d48", "#84cc16"];
        paletteContainer.innerHTML = palette.map(hex => `
          <button type="button" style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--card-border); background: ${hex}; cursor: pointer;" onclick="document.getElementById('manualInputColor').value='${hex}'; App.haptic('light');"></button>
        `).join('');
      }
    } else if (type === "event") {
      if (projectRow) projectRow.style.display = "block";
      if (dateRow) dateRow.style.display = "none";
      if (eventPeriodRow) eventPeriodRow.style.display = "block";
      if (categoryRow) categoryRow.style.display = "none";
      if (colorRow) colorRow.style.display = "none";
      if (titleLabel) titleLabel.textContent = "Event Title *";
      const dateInput = document.getElementById("manualInputDate");
      const evStart = document.getElementById("manualEventStart");
      const evEnd = document.getElementById("manualEventEnd");
      if (dateInput && dateInput.value && evStart && !evStart.value) {
        evStart.value = dateInput.value;
        if (evEnd && !evEnd.value) {
          evEnd.value = this.addMinutesToDateStr(dateInput.value, 60);
        }
      }
    } else if (type === "reminder") {
      if (projectRow) projectRow.style.display = "none";
      if (dateRow) dateRow.style.display = "block";
      if (eventPeriodRow) eventPeriodRow.style.display = "none";
      if (categoryRow) categoryRow.style.display = "none";
      if (colorRow) colorRow.style.display = "none";
      if (titleLabel) titleLabel.textContent = "Reminder Note *";
      if (dateLabel) dateLabel.textContent = "Reminder Date (YYYY-MM-DD or HH:MM)";
    } else if (type === "unorganized" || type === "unorganised") {
      if (projectRow) projectRow.style.display = "none";
      if (dateRow) dateRow.style.display = "none";
      if (eventPeriodRow) eventPeriodRow.style.display = "none";
      if (categoryRow) categoryRow.style.display = "none";
      if (colorRow) colorRow.style.display = "none";
      if (titleLabel) titleLabel.textContent = "Unorganised Item / Note *";
    } else {
      // focus or trivial task
      if (projectRow) projectRow.style.display = "block";
      if (dateRow) dateRow.style.display = "block";
      if (eventPeriodRow) eventPeriodRow.style.display = "none";
      if (categoryRow) categoryRow.style.display = "none";
      if (colorRow) colorRow.style.display = "none";
      if (titleLabel) titleLabel.textContent = "Task Title *";
      if (dateLabel) dateLabel.textContent = "Due Date / Time (24hr Military)";
    }
  },

  addMinutesToDateStr(isoOrLocalStr, minutes) {
    if (!isoOrLocalStr) return "";
    let s = String(isoOrLocalStr).trim().replace(" ", "T");
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    d.setMinutes(d.getMinutes() + minutes);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  setManualDuration(minutes) {
    const startInput = document.getElementById("manualEventStart");
    const endInput = document.getElementById("manualEventEnd");
    if (!startInput || !endInput) return;
    let startVal = startInput.value;
    if (!startVal) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      startVal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      startInput.value = startVal;
    }
    endInput.value = this.addMinutesToDateStr(startVal, minutes);
    App.haptic("light");
  },

  clearManualEventEnd() {
    const endInput = document.getElementById("manualEventEnd");
    if (endInput) endInput.value = "";
    App.haptic("light");
  },

  getBaseDate() {
    if (this.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(this.selectedDate)) {
      const [y, m, d] = this.selectedDate.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  },

  setManualEventStartPreset(preset) {
    const startInput = document.getElementById("manualEventStart");
    const endInput = document.getElementById("manualEventEnd");
    if (!startInput) return;
    const base = this.getBaseDate();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    function formatDate(d, hours, minutes) {
      const target = new Date(d);
      target.setHours(hours, minutes, 0, 0);
      const yyyy = target.getFullYear();
      const mm = pad(target.getMonth() + 1);
      const dd = pad(target.getDate());
      const hh = pad(target.getHours());
      const min = pad(target.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    let newStart = "";
    if (preset === "today_now") {
      const isRealToday = base.getFullYear() === now.getFullYear() &&
                          base.getMonth() === now.getMonth() &&
                          base.getDate() === now.getDate();
      if (isRealToday) {
        newStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      } else {
        const target = new Date(base);
        target.setHours(now.getHours(), now.getMinutes(), 0, 0);
        newStart = formatDate(target, target.getHours(), target.getMinutes());
      }
    } else if (preset === "today_12") {
      newStart = formatDate(base, 12, 0);
    } else if (preset === "today_14") {
      newStart = formatDate(base, 14, 0);
    } else if (preset === "today_16") {
      newStart = formatDate(base, 16, 0);
    } else if (preset === "today_18") {
      newStart = formatDate(base, 18, 0);
    } else if (preset === "tomorrow_09") {
      const tom = new Date(base);
      tom.setDate(tom.getDate() + 1);
      newStart = formatDate(tom, 9, 0);
    }

    if (newStart) {
      startInput.value = newStart;
      if (endInput && (!endInput.value || endInput.value <= newStart)) {
        endInput.value = this.addMinutesToDateStr(newStart, 60);
      }
    }
    App.haptic("light");
  },

  setManualDatePreset(preset) {
    const input = document.getElementById("manualInputDate");
    if (!input) return;
    const base = this.getBaseDate();
    const pad = (n) => String(n).padStart(2, "0");

    function formatDate(d, hours, minutes) {
      const target = new Date(d);
      target.setHours(hours, minutes, 0, 0);
      const yyyy = target.getFullYear();
      const mm = pad(target.getMonth() + 1);
      const dd = pad(target.getDate());
      const hh = pad(target.getHours());
      const min = pad(target.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    if (preset === "clear") {
      input.value = "";
    } else if (preset === "today_12") {
      input.value = formatDate(base, 12, 0);
    } else if (preset === "today_18") {
      input.value = formatDate(base, 18, 0);
    } else if (preset === "tonight_2359") {
      input.value = formatDate(base, 23, 59);
    } else if (preset === "tomorrow_09") {
      const tom = new Date(base);
      tom.setDate(tom.getDate() + 1);
      input.value = formatDate(tom, 9, 0);
    } else if (preset === "tomorrow_18") {
      const tom = new Date(base);
      tom.setDate(tom.getDate() + 1);
      input.value = formatDate(tom, 18, 0);
    } else if (preset === "in_2_days") {
      const future = new Date(base);
      future.setDate(future.getDate() + 2);
      input.value = formatDate(future, 18, 0);
    } else if (preset === "in_3_days") {
      const future = new Date(base);
      future.setDate(future.getDate() + 3);
      input.value = formatDate(future, 18, 0);
    }
    App.haptic("light");
  },

  async submitManualCreate() {
    const titleInput = document.getElementById("manualInputTitle");
    const descInput = document.getElementById("manualInputDesc");
    const projectInput = document.getElementById("manualInputProject");
    const dateInput = document.getElementById("manualInputDate");
    const colorInput = document.getElementById("manualInputColor");
    const categoryInput = document.getElementById("manualInputCategory");

    const title = titleInput ? titleInput.value.trim() : "";
    if (!title) {
      App.showToast("Title is required", true);
      return;
    }
    if (this.isPastDay()) {
      App.showToast("Cannot add items to locked past days. Return to Today or select a future day to plan ahead.", true);
      return;
    }

    const description = descInput ? descInput.value.trim() : "";
    const projectName = (projectInput && projectInput.value) ? projectInput.value : null;
    const rawDate = (dateInput && dateInput.value) ? dateInput.value.trim() : null;
    let dueDate = rawDate ? rawDate.replace("T", " ") : null;
    if (!dueDate && !this.isToday() && this.isFutureDay()) {
      dueDate = `${this.selectedDate} 12:00`;
    }
    const color = (colorInput && colorInput.value) ? colorInput.value : "#3b82f6";
    const category = (categoryInput && categoryInput.value) ? categoryInput.value : "External";

    try {
      if (this.currentManualType === "project") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: title, description, color, category })
        });
        if (res.ok) {
          App.showToast(`📁 Project "${title}" (${category}) created!`);
          this.closeManualCreateModal();
          await this.refresh();
          if (typeof Exploded !== "undefined") Exploded.refresh();
          if (typeof Mindmap !== "undefined") Mindmap.refresh();
          return;
        } else {
          const err = await res.json();
          App.showToast(err.detail || "Error creating project", true);
          return;
        }
      } else if (this.currentManualType === "event") {
        const evStartInput = document.getElementById("manualEventStart");
        const evEndInput = document.getElementById("manualEventEnd");
        const rawStart = evStartInput ? evStartInput.value.trim() : "";
        const rawEnd = evEndInput ? evEndInput.value.trim() : "";
        let eventStart = rawStart ? rawStart.replace("T", " ") : dueDate;
        let eventEnd = rawEnd ? rawEnd.replace("T", " ") : null;

        if (!eventStart) {
          App.showToast("Start time is required for events", true);
          return;
        }
        if (eventStart && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(eventStart)) {
          eventStart += ":00";
        }
        if (eventEnd && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(eventEnd)) {
          eventEnd += ":00";
        }

        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            start_time: eventStart,
            end_time: eventEnd,
            description,
            project_name: projectName
          })
        });
        if (res.ok) {
          App.showToast(`📅 Event "${title}" scheduled!`);
        } else {
          App.showToast("Error creating event", true);
          return;
        }
      } else if (this.currentManualType === "reminder") {
        let remDate = dueDate ? dueDate.split(" ")[0].split("T")[0] : (this.selectedDate || null);
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            details: description,
            reminder_date: remDate
          })
        });
        if (res.ok) {
          App.showToast(`🔔 Reminder "${title}" saved!`);
        } else {
          App.showToast("Error creating reminder", true);
          return;
        }
      } else if (this.currentManualType === "unorganized" || this.currentManualType === "unorganised") {
        const res = await fetch("/api/unorganised", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            project_name: projectName,
            due_date: dueDate
          })
        });
        if (res.ok) {
          App.showToast(`⚠️ Item added to Unorganised Queue!`);
          await this.checkUnorganized();
        } else {
          App.showToast("Error adding to unorganised queue", true);
          return;
        }
      } else {
        // focus or trivial task
        const tier = this.currentManualType === "trivial" ? "trivial" : "focus";
        const tsInput = document.getElementById("manualInputTimeSensitive");
        const isTimeSensitive = tsInput ? tsInput.checked : false;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            project_name: projectName,
            tier,
            due_date: dueDate,
            is_time_sensitive: isTimeSensitive
          })
        });
        if (res.ok) {
          App.showToast(`✓ ${tier === "focus" ? "Focus task" : "Trivial task"} "${title}" added!`);
        } else {
          App.showToast("Error creating task", true);
          return;
        }
      }

      this.closeManualCreateModal();
      await this.refresh();
      await this.loadBriefing();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Exploded !== "undefined") Exploded.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
      App.showToast("Network error submitting item", true);
    }
  },

  scrollToYourStats() {
    setTimeout(() => {
      const panel = document.getElementById("focusTelemetryPanel");
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        panel.classList.add("highlight-pulse");
        setTimeout(() => panel.classList.remove("highlight-pulse"), 2200);
      }
    }, 120);
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.Dashboard = Dashboard;
