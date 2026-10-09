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
  userName: "Hong Rong",
  activeFilter: null,
  isUnorgCollapsed: false,
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
    if (this.isDaySealed(this.selectedDate)) return true;
    return false;
  },

  isDaySealed(dateStr) {
    if (!dateStr) return false;
    if (localStorage.getItem(`pettr_debrief_sealed_${dateStr}`) === "true") return true;
    if (this.briefingData && this.briefingData.is_sealed && this.selectedDate === dateStr) return true;
    return false;
  },

  navigateDay(direction) {
    const parts = this.selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2] + direction);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    this.selectedDate = `${yyyy}-${mm}-${dd}`;
    this.refresh();
  },

  jumpToToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    this.selectedDate = `${yyyy}-${mm}-${dd}`;
    this.refresh();
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
      if (labelEl) labelEl.textContent = `Today: ${dayName}`;
      if (this.isDaySealed(this.selectedDate)) {
        if (tagEl) {
          tagEl.innerHTML = `<i data-lucide="lock" style="width:11px;height:11px;display:inline-block;vertical-align:-1px;"></i> SEALED TODAY`;
          tagEl.className = "date-status-tag tag-past";
        }
        if (lockedBanner) {
          lockedBanner.style.display = "flex";
          if (lockedDateText) lockedDateText.textContent = `${dayName} (Evening Debrief Complete · Day Sealed)`;
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
      if (labelEl) labelEl.textContent = `Preview: ${dayName}`;
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
      if (labelEl) labelEl.textContent = `Archive: ${dayName}`;
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
    App.renderIcons();
  },

  heroTaglines: [
    "Autonomous local node · 100% private Tailscale mesh · Zero cloud leakage",
    "From stream of consciousness to structured execution",
    "High-focus daily command center for deep work & project tracking",
    "Self-hosted personal repository · Always online 24/7"
  ],
  taglineIndex: 0,
  _taglineTimer: null,

  async init() {
    DragDrop.initContainer(document.getElementById("focusTasksList"));
    DragDrop.initContainer(document.getElementById("trivialTasksList"));
    this.bindSummaryPills();
    this.initTaglineRotation();
    this.initUnorgPanelState();
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
      if (toggleBtn) toggleBtn.textContent = "◧ Expand Queue";
    } else {
      panel.classList.remove("collapsed");
      if (toggleBtn) toggleBtn.textContent = "◨ Hide to Side";
    }
  },

  async loadUserProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.user_name) this.userName = data.user_name;
      }
    } catch (e) {
      const saved = localStorage.getItem("pettr_user_name");
      if (saved) this.userName = saved;
    }
    this.renderGreeting();
  },

  typewriterGreetingTimer: null,
  typewriterCharIndex: 0,
  typewriterPhraseIndex: 0,
  isTypewriterDeleting: false,

  renderGreeting() {
    this.startTypewriterGreeting();
  },

  async startTypewriterGreeting() {
    if (this.typewriterGreetingTimer) {
      clearTimeout(this.typewriterGreetingTimer);
      this.typewriterGreetingTimer = null;
    }
    const greetingEl = document.getElementById("greetingText");
    const subtextEl = document.getElementById("greetingSubtext");
    const chipEl = document.getElementById("nameDisplayChip");
    if (!greetingEl) return;
    if (chipEl) chipEl.textContent = `👤 ${this.userName}`;

    const clientHour = new Date().getHours();
    const isMorning = clientHour >= 5 && clientHour < 12;
    const isAfternoon = clientHour >= 12 && clientHour < 18;
    const isEvening = clientHour >= 18 && clientHour < 23;
    const isNight = clientHour >= 23 || clientHour < 5;

    let phrases = [];
    let sub = "Ready to log and track your day.";

    try {
      const res = await fetch(`/api/daily-intel?date=${encodeURIComponent(this.selectedDate || "")}&hour=${clientHour}`);
      if (res.ok) {
        const intel = await res.json();
        if (intel.phrases && intel.phrases.length > 0) phrases = intel.phrases;
        if (intel.subtext) sub = intel.subtext;
      }
    } catch (e) {
      console.warn("Failed to fetch daily-intel:", e);
    }

    // Filter out phrases that contradict current diurnal time-of-day
    const morningKws = [
      'good morning', 'morning', 'first coffee', 'dawn', 'sunrise',
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

    phrases = phrases.filter(p => {
      const lower = p.toLowerCase();
      if (!isNight && nightKws.some(k => lower.includes(k))) return false;
      if (!isMorning && morningKws.some(k => lower.includes(k))) return false;
      if (!isAfternoon && afternoonKws.some(k => lower.includes(k))) return false;
      if (!isEvening && eveningKws.some(k => lower.includes(k))) return false;
      return true;
    });

    // If fewer than 3 phrases remain, supplement with rich diurnal phrases to guarantee variety
    if (phrases.length < 3) {
      let defaults = [];
      if (isMorning) {
        defaults = [
          `Good morning, ${this.userName}.`,
          `First coffee, then the deep work, ${this.userName}.`,
          `Ready to prioritise today's objectives?`,
          `Telemetry nominal. Let's conquer today.`,
          `Systems primed and synchronised, ${this.userName}.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Morning momentum begins now.";
      } else if (isAfternoon) {
        defaults = [
          `Working hard or hardly working, ${this.userName}?`,
          `Maintaining steady cruising momentum.`,
          `Midday check-in, ${this.userName}.`,
          `Executing afternoon sprints with focus.`,
          `Deep focus block in progress.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Deep work window active.";
      } else if (isEvening) {
        defaults = [
          `Good evening, ${this.userName}.`,
          `Reviewing completed objectives, ${this.userName}.`,
          `Tying off open loops and wrapping up.`,
          `Smooth landing for today's sprint, ${this.userName}.`,
          `Great execution today. Time to relax.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Review your progress and close out open loops.";
      } else {
        defaults = [
          `Burning the midnight oil, ${this.userName}?`,
          `Night owl hours active.`,
          `Quiet focus time, ${this.userName}.`,
          `Quiet hours telemetry online. Rest soon.`,
          `Deep work in the quiet hours.`
        ];
        if (!sub || sub === "Ready to log and track your day.") sub = "Quiet hours telemetry online. Rest soon.";
      }
      for (const d of defaults) {
        if (!phrases.includes(d)) phrases.push(d);
      }
    }

    // Guarantee top typewriter phrases NEVER duplicate the bottom subtext
    phrases = phrases.filter(p => p.trim().toLowerCase() !== sub.trim().toLowerCase());
    if (phrases.length === 0) {
      phrases = [`Hello, ${this.userName}.`];
    }

    if (subtextEl) {
      subtextEl.textContent = sub;
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

    const tick = () => {
      const currentPhrase = phrases[this.typewriterPhraseIndex];
      if (!currentPhrase) return;

      if (!this.isTypewriterDeleting) {
        this.typewriterCharIndex++;
        greetingEl.innerHTML = `${this.escapeHtml(currentPhrase.slice(0, this.typewriterCharIndex))}<span class="typewriter-cursor">|</span>`;
        if (this.typewriterCharIndex >= currentPhrase.length) {
          this.isTypewriterDeleting = true;
          this.typewriterGreetingTimer = setTimeout(tick, 4500);
          return;
        }
        this.typewriterGreetingTimer = setTimeout(tick, 45);
      } else {
        this.typewriterCharIndex--;
        greetingEl.innerHTML = `${this.escapeHtml(currentPhrase.slice(0, this.typewriterCharIndex))}<span class="typewriter-cursor">|</span>`;
        if (this.typewriterCharIndex <= 0) {
          this.isTypewriterDeleting = false;
          this.typewriterPhraseIndex = (this.typewriterPhraseIndex + 1) % phrases.length;
          this.typewriterGreetingTimer = setTimeout(tick, 600);
          return;
        }
        this.typewriterGreetingTimer = setTimeout(tick, 25);
      }
    };

    tick();
  },

  async refreshDailyIntel() {
    try {
      const clientHour = new Date().getHours();
      const res = await fetch(`/api/daily-intel?date=${encodeURIComponent(this.selectedDate || "")}&hour=${clientHour}&refresh=true`);
      if (res.ok) {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast("Regenerated daily intel", "success");
        }
        await this.startTypewriterGreeting();
      }
    } catch (e) {
      console.error("Failed to refresh daily intel:", e);
    }
  },

  async promptEditUserName() {
    const newName = prompt("Enter your preferred display name (e.g. Hong Rong, Me, Alex):", this.userName);
    if (!newName || !newName.trim()) return;

    this.userName = newName.trim();
    localStorage.setItem("pettr_user_name", this.userName);
    this.renderGreeting();

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: this.userName })
      });
      App.showToast(`Name updated to "${this.userName}"!`);
    } catch (e) {
      console.warn("Could not persist name to server:", e);
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
    if (category === "projects") {
      const col = document.getElementById("projectsCardSection");
      if (col) col.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (this.activeFilter === category) {
      this.clearFilter();
      return;
    }

    this.activeFilter = category;

    document.querySelectorAll(".stat-pill").forEach(p => {
      if (p.dataset.filter === category) p.classList.add("active");
      else p.classList.remove("active");
    });

    const bar = document.getElementById("filterActiveBar");
    const label = document.getElementById("filterActiveLabel");
    if (bar && label) {
      bar.style.display = "flex";
      const names = {
        focus: "Standalone Focus Tasks (Deep Work)",
        trivial: "Standalone Trivial Tasks (Errands)",
        events: "Today's Scheduled Events",
        reminders: "Today's Reminders"
      };
      label.textContent = `Filtering view: ${names[category] || category}`;
    }

    if (category === "focus") {
      const col = document.getElementById("focusTasksList");
      if (col) col.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (category === "trivial") {
      const col = document.getElementById("trivialTasksList");
      if (col) col.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (category === "events") {
      const col = document.getElementById("eventsList");
      if (col) col.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (category === "reminders") {
      const col = document.getElementById("remindersList");
      if (col) col.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    App.showToast(`Filtering by ${category}`);
  },

  clearFilter() {
    this.activeFilter = null;
    document.querySelectorAll(".stat-pill").forEach(p => p.classList.remove("active"));
    const bar = document.getElementById("filterActiveBar");
    if (bar) bar.style.display = "none";
    App.showToast("All panels visible");
  },

  async refresh() {
    this.updateDateNavigatorUI();
    await Promise.all([
      this.loadTasks(),
      this.loadEvents(),
      this.loadReminders(),
      this.checkUnorganized(),
      this.loadProductivityStats()
    ]);
    await this.loadBriefing();
    this.updateProgressRing();
    this.adjustPanelScaling();
    if (typeof EveningDebrief !== "undefined") EveningDebrief.updateDebriefButtonState();
    if (typeof SimplifiedMode !== "undefined" && SimplifiedMode.isOpen) {
      SimplifiedMode.refresh();
    }
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
    if (badgeTrivial) badgeTrivial.textContent = `${countTrivial} errand${countTrivial === 1 ? '' : 's'}`;
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
      if (subtextEl) subtextEl.textContent = `${completed} of ${total} completed (${remaining} remaining)`;
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
    const { weekly, monthly } = data;

    // 1. Weekly View
    const weekBadge = document.getElementById("weekProductivityBadge");
    if (weekBadge) {
      weekBadge.textContent = `${weekly.overall_rate_pct}% avg`;
      weekBadge.style.color = weekly.overall_rate_pct >= 70 ? "var(--normal-green)" : (weekly.overall_rate_pct > 0 ? "var(--urgent-orange)" : "var(--text-muted)");
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

        col.innerHTML = `
          <span style="font-size: 10px; font-weight: 700; color: ${d.is_today ? 'var(--text-main)' : 'var(--text-muted)'}; font-family: var(--font-mono);">${pctText}</span>
          <div class="prod-bar-track" title="${d.day_name} (${d.date}): ${d.completed}/${d.total} tasks completed">
            <div class="prod-bar-fill" style="height: ${fillHeight}%; background: ${fillColor}; opacity: ${d.completion_rate === null ? '0.25' : '1'};"></div>
          </div>
          <span class="prod-day-label ${d.is_today ? 'today-label' : ''}" style="${d.is_today ? 'font-weight: 800; color: var(--text-main); text-decoration: underline;' : ''}">${d.day_name}</span>
          <span style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-mono);">${d.completed}/${d.total}</span>
        `;
        grid.appendChild(col);
      });
    }

    const weekSummary = document.getElementById("weekProductivitySummary");
    if (weekSummary) {
      weekSummary.innerHTML = `<strong>${weekly.total_completed} of ${weekly.total_scheduled} tasks completed</strong> across this week (${weekly.start_date} to ${weekly.end_date}).`;
    }

    // 2. Monthly View
    const monthTitle = document.getElementById("monthProductivityTitle");
    if (monthTitle) monthTitle.textContent = `${monthly.month_name} Performance`;

    const monthBadge = document.getElementById("monthProductivityBadge");
    if (monthBadge) {
      monthBadge.textContent = `${monthly.completion_rate_pct}% completed`;
      monthBadge.style.color = monthly.completion_rate_pct >= 70 ? "var(--normal-green)" : (monthly.completion_rate_pct > 0 ? "var(--urgent-orange)" : "var(--text-muted)");
    }

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
        this.updateDateNavigatorUI();
      }
      const dateEl = document.getElementById("briefingDate");
      const showcaseDate = document.getElementById("briefingShowcaseDate");
      if (dateEl) dateEl.textContent = data.date;
      if (showcaseDate) showcaseDate.textContent = data.date;

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
      const [textRes] = await Promise.all([
        fetch(`/api/briefing/text?date=${this.selectedDate}`).catch(() => null),
        this.loadDailyOrder()
      ]);
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

    const focusTasks = data.focus_tasks || (this.tasks && this.tasks.focus) || [];
    if (focusTasks.length === 0) {
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No focus items pending today.</div>`;
    } else {
      focusTasks.forEach((t, i) => {
        const isDone = t.status === "completed";
        const cleanTitle = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
        const timeMil = t.due_date_military ? `@ ${t.due_date_military}` : '';
        const inSeq = (this.dailyOrder || []).some(d => d.id === t.id && (d.type === 'task' || !d.type));
        const isTimeSensitive = Boolean(t.is_time_sensitive);
        const badgeHtml = isTimeSensitive
          ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE</span>`
          : '';

        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="true" 
               ondragstart="Dashboard.onBriefingDragStart(event, ${t.id}, 'task', '${this.escapeHtml(cleanTitle)}', 'focus', '${timeMil}')">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="priority-num-badge" style="width:20px;height:20px;font-size:10px;">${String(i+1).padStart(2, '0')}</span>
              <span style="font-weight:600; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${inSeq ? `<span class="in-sequence-badge" style="font-size:10.5px; color:var(--text-muted); font-style:italic;">(in sequence)</span>` : ''}
              ${t.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(t.project_name)}</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${timeMil ? `<span style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">${timeMil}</span>` : ''}
              ${badgeHtml}
              <span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>
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
      html += `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No quick errands scheduled today.</div>`;
    } else {
      trivialTasks.forEach((t, i) => {
        const isDone = t.status === "completed";
        const cleanTitle = (t.title || "").replace(/^\s*\[.*?\]\s*/, '');
        const timeMil = t.due_date_military ? `@ ${t.due_date_military}` : '';
        const inSeq = (this.dailyOrder || []).some(d => d.id === t.id && (d.type === 'task' || !d.type));
        const isTimeSensitive = Boolean(t.is_time_sensitive);
        const badgeHtml = isTimeSensitive
          ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE</span>`
          : '';

        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="true"
               ondragstart="Dashboard.onBriefingDragStart(event, ${t.id}, 'task', '${this.escapeHtml(cleanTitle)}', 'trivial', '${timeMil}')">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="priority-num-badge" style="width:20px;height:20px;font-size:10px;">${String(i+1).padStart(2, '0')}</span>
              <span style="font-weight:500; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${inSeq ? `<span class="in-sequence-badge" style="font-size:10.5px; color:var(--text-muted); font-style:italic;">(in sequence)</span>` : ''}
              ${t.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(t.project_name)}</span>` : ''}
              ${t.recurrence ? `<span class="recurrence-badge" style="padding:1px 6px; font-size:10px;">↻ Recur</span>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${timeMil ? `<span style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">${timeMil}</span>` : ''}
              ${badgeHtml}
              <span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>
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
        const inSeq = (this.dailyOrder || []).some(d => d.id === e.id && d.type === 'event');
        html += `
          <div class="briefing-item-row ${inSeq ? 'in-sequence' : ''}" draggable="true"
               ondragstart="Dashboard.onBriefingDragStart(event, ${e.id}, 'event', '${this.escapeHtml(cleanTitle)}', 'event', '${timeMil}')">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; font-family:var(--font-mono); background:var(--bg-tertiary); padding:2px 6px; border-radius:4px; font-weight:700;">${timeMil}</span>
              <span style="font-weight:600; ${isDone ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${this.escapeHtml(cleanTitle)}</span>
              ${inSeq ? `<span class="in-sequence-badge" style="font-size:10.5px; color:var(--text-muted); font-style:italic;">(in sequence)</span>` : ''}
              ${e.project_name ? `<span class="project-tag" style="padding:1px 6px; font-size:10.5px;">${this.escapeHtml(e.project_name)}</span>` : ''}
            </div>
            <span style="font-size:11px; color:var(--text-dim);" title="Drag into Daily Order">⋮⋮</span>
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
    try {
      const res = await fetch(`/api/daily-order?date=${this.selectedDate}`);
      if (res.ok) {
        const data = await res.json();
        this.dailyOrder = data.order || [];
        localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify(this.dailyOrder));
      } else {
        const saved = localStorage.getItem("pettr_daily_order_" + this.selectedDate);
        this.dailyOrder = saved ? JSON.parse(saved) : [];
      }
    } catch (e) {
      const saved = localStorage.getItem("pettr_daily_order_" + this.selectedDate);
      this.dailyOrder = saved ? JSON.parse(saved) : [];
    }
    this.reconcileDailyOrderTitles();
    this.renderDailyOrder();
    this.initDailyOrderDropZone();
    if (this.briefingData) {
      this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
    }
  },

  reconcileDailyOrderTitles() {
    if (!this.dailyOrder || !this.dailyOrder.length) return;
    const allTasks = [
      ...((this.tasks && this.tasks.focus) || []),
      ...((this.tasks && this.tasks.trivial) || [])
    ];
    let modified = false;
    this.dailyOrder.forEach(item => {
      if (item.type === "task" || !item.type) {
        const found = allTasks.find(t => t.id === item.id);
        if (found && found.title) {
          const clean = found.title.replace(/^\s*\[.*?\]\s*/, '');
          if (item.title !== clean) {
            item.title = clean;
            modified = true;
          }
        }
      }
    });
    if (modified) {
      localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify(this.dailyOrder));
    }
  },

  async saveDailyOrder() {
    try {
      localStorage.setItem("pettr_daily_order_" + this.selectedDate, JSON.stringify(this.dailyOrder));
      await fetch("/api/daily-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: this.selectedDate,
          order: this.dailyOrder
        })
      });
    } catch (e) {
      console.warn("Error saving daily order:", e);
    }
    this.renderDailyOrder();
    if (this.briefingData) {
      this.renderVisualBriefing(this.briefingData, this.briefingMarkdown || "");
    }
  },

  renderDailyOrder() {
    const container = document.getElementById("dailyOrderSlotsList");
    const countBadge = document.getElementById("dailyOrderCountBadge");
    if (!container) return;

    const count = this.dailyOrder.length;
    if (countBadge) countBadge.textContent = `${count} in sequence`;

    if (count === 0) {
      container.innerHTML = `
        <div class="daily-order-empty-cue">
          <i data-lucide="list-ordered" style="width:28px;height:28px;color:var(--focus-indigo);opacity:0.6;margin-bottom:4px;"></i>
          <div style="font-weight:700; color:var(--text-main);">Tasking Priority is Empty</div>
          <div style="font-size:12px; max-width:240px; line-height:1.5;">
            Drag any focus task, errand, project, or event from the left into this space to lock in your exact execution order.
          </div>
        </div>
      `;
      App.renderIcons();
      return;
    }

    container.innerHTML = this.dailyOrder.map((item, idx) => {
      const rank = String(idx + 1).padStart(2, "0");
      let isDone = item.completed || false;
      // Reconcile with live tasks and events
      if ((item.type === "task" || !item.type) && this.tasks) {
        const projectTasks = (this.tasks.projects || []).flatMap(p => p.tasks || []);
        const allTasks = [...(this.tasks.focus || []), ...(this.tasks.trivial || []), ...projectTasks];
        const match = allTasks.find(t => String(t.id) === String(item.id));
        if (match) {
          isDone = match.status === "completed";
          item.completed = isDone;
        }
      } else if (item.type === "event" && this.briefingData && this.briefingData.events_today) {
        const match = this.briefingData.events_today.find(e => String(e.id) === String(item.id));
        if (match) {
          isDone = match.status === "completed";
          item.completed = isDone;
        }
      }
      return `
        <div class="daily-order-slot ${isDone ? 'completed' : ''}" draggable="true"
             data-index="${idx}"
             ondragstart="Dashboard.onDailyOrderDragStart(event, ${idx})"
             ondragend="Dashboard.onDailyOrderDragEnd(event)"
             ondragover="Dashboard.onDailyOrderDragOver(event, ${idx})"
             ondragleave="Dashboard.onDailyOrderDragLeave(event, ${idx})"
             ondrop="Dashboard.onDailyOrderDrop(event, ${idx})">
          <span class="slot-rank">#${rank}</span>
          <input type="checkbox" class="task-checkbox" ${isDone ? 'checked' : ''}
                 onchange="Dashboard.toggleDailyOrderItem(${idx}, this.checked)" title="Check off item">
          <span class="slot-title">${this.escapeHtml(item.title)}</span>
          ${item.time ? `<span style="font-size:11px; font-family:var(--font-mono); color:var(--text-muted);">${item.time}</span>` : ''}
          <span class="urgency-badge ${item.tier || 'normal'}" style="font-size:10px; padding:1px 6px;">${(item.tier || item.type).toUpperCase()}</span>
          <span style="cursor:grab; color:var(--text-dim); font-size:12px;" title="Drag to re-order">⋮⋮</span>
          <button class="action-icon-btn" onclick="Dashboard.removeDailyOrderItem(${idx})" title="Remove from daily sequence" style="padding:2px 5px; font-size:11px; color:var(--text-muted);"><i data-lucide="x" style="width:11px;height:11px;"></i></button>
        </div>
      `;
    }).join("");
    App.renderIcons();
  },

  initDailyOrderDropZone() {
    const listEl = document.getElementById("dailyOrderSlotsList");
    if (!listEl) return;

    listEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      listEl.style.background = "var(--bg-tertiary)";
    };

    listEl.ondragleave = () => {
      listEl.style.background = "";
    };

    listEl.ondrop = (e) => {
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

  toggleDailyOrderItem(idx, isCompleted) {
    if (this.dailyOrder[idx]) {
      this.dailyOrder[idx].completed = isCompleted;
      this.saveDailyOrder();
      // If task, also sync underlying task
      const item = this.dailyOrder[idx];
      if ((item.type === "task" || !item.type) && item.id) {
        this.toggleTaskStatus(item.id, isCompleted);
      } else if (item.type === "event" && item.id) {
        this.toggleEventStatus(item.id, isCompleted);
      }
    }
  },

  removeDailyOrderItem(idx) {
    this.dailyOrder.splice(idx, 1);
    this.saveDailyOrder();
  },

  clearDailyOrder() {
    if (!confirm("Clear your Daily Order execution list for today?")) return;
    this.dailyOrder = [];
    this.saveDailyOrder();
    App.showToast("Daily sequence reset.");
  },

  async copyBriefingMarkdown() {
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
        parts.push("\n## Errand Tasks");
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

      this.reconcileDailyOrderTitles();
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
      container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">No projects have tasks scheduled for this day.<br><span style="display:inline-block; margin-top:8px;">View all in <a href="javascript:void(0)" onclick="App.navigateToGlobalProjects()" style="color:var(--text-main); font-weight:700; text-decoration:underline;">Global Projects Pool</a> or create a <a href="javascript:void(0)" onclick="Dashboard.openManualCreateModal(\'project\')" style="color:var(--text-main); font-weight:700; text-decoration:underline;">+ New Project</a>.</span></div>';
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
            return `
              <div class="task-item ${isCompleted ? 'completed' : ''} ${isPast ? 'is-locked' : ''}" style="padding: 8px 10px; font-size: 13px;">
                <span class="priority-num-badge" title="Subtask priority #${idx + 1}">${rankStr}</span>
                <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} ${cbDisabled}
                       onchange="Dashboard.toggleTaskStatus(${t.id}, this.checked)" title="${cbTitle}">
                <div class="task-body" onclick="${isPast ? '' : `EntityModal.open('task', ${t.id})`}" title="${isPast ? 'Locked historical task' : 'Click to edit or re-sort'}">
                  <span class="task-title" style="font-size: 13px; ${isCompleted ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                    ${this.escapeHtml(t.title)}
                  </span>
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
            ${isPast ? '' : `<button class="action-icon-btn" onclick="Dashboard.promptAddTaskToProject('${this.escapeHtml(p.name)}')">+ Add Task</button>`}
            ${isPast ? '<span style="font-size:12px; color:var(--text-dim); font-weight:600;">🔒 Project Log Locked</span>' : `<button class="action-icon-btn" onclick="Dashboard.completeProject(${p.id}, '${this.escapeHtml(p.name)}')" style="color: var(--accent-green); font-weight: 600;" title="Wrap up and mark project complete">✓ Complete Project</button>`}
          </div>
          <button class="action-icon-btn" onclick="EntityModal.open('project', ${p.id})">Project Settings →</button>
        </div>
      `;

      container.appendChild(box);
    });
  },

  async promptAddTaskToProject(projectName) {
    const title = prompt(`Enter new task for project "${projectName}":`);
    if (!title || !title.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          project_name: projectName,
          tier: "focus"
        })
      });
      if (res.ok) {
        App.showToast(`Task added to ${projectName}!`);
        await this.refresh();
        if (typeof Exploded !== "undefined" && typeof Exploded.refresh === "function") {
          await Exploded.refresh();
        }
        if (typeof Timeline !== "undefined" && typeof Timeline.refresh === "function") {
          Timeline.refresh();
        }
        if (typeof Mindmap !== "undefined" && typeof Mindmap.refresh === "function") {
          Mindmap.refresh();
        }
      } else {
        App.showToast("Failed to create task", true);
      }
    } catch (e) {
      console.error(e);
      App.showToast("Network error creating task", true);
    }
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
      const badgeHtml = isCompleted
        ? ''
        : (isTimeSensitive
          ? `<span class="time-sensitive-badge">⚡ TIME SENSITIVE${dueText ? ` (${dueText})` : ''}</span>`
          : (urgencyLevel !== 'none' && urgencyLevel !== 'urgent' && urgencyLevel !== 'completed' ? `<span class="urgency-badge ${urgencyLevel}">${urgencyLabel}${dueText ? ` (${dueText})` : ''}</span>` : (dueText ? `<span class="due-pill" style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${dueText}</span>` : '')));

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
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCompleted ? "completed" : "pending" })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        App.showToast(err.detail || "Failed to update task status", true);
        this.renderDailyOrder();
        return;
      }
      App.showToast(isCompleted ? "Task completed! Marked with strikethrough." : "Task reopened.");
      if (this.dailyOrder && this.dailyOrder.length > 0) {
        let changed = false;
        this.dailyOrder.forEach(item => {
          if ((item.type === "task" || !item.type) && String(item.id) === String(taskId)) {
            item.completed = isCompleted;
            changed = true;
          }
        });
        if (changed) {
          this.renderDailyOrder();
          this.saveDailyOrder();
        }
      }
      await this.refresh();
      await this.loadBriefing();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
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
    try {
      const res = await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCompleted ? "completed" : "scheduled" })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        App.showToast(err.detail || "Failed to update appointment status", true);
        this.renderDailyOrder();
        return;
      }
      App.showToast(isCompleted ? "Appointment completed!" : "Appointment reopened.");
      if (this.dailyOrder && this.dailyOrder.length > 0) {
        let changed = false;
        this.dailyOrder.forEach(item => {
          if (item.type === "event" && String(item.id) === String(eventId)) {
            item.completed = isCompleted;
            changed = true;
          }
        });
        if (changed) {
          this.renderDailyOrder();
          this.saveDailyOrder();
        }
      }
      await this.refresh();
      await this.loadBriefing();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error("Error updating event status:", err);
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
              <span><strong>Queue is clear.</strong> All logged inputs are organized into projects, tasks, or events.</span>
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

  async openUnorganizedModal() {
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
              <button class="action-icon-btn" onclick="Dashboard.closeUnorganizedModal(); EntityModal.open('unorganized', ${item.id});" style="color: var(--focus-indigo); font-weight: 600;">✏️ Edit Details</button>
              <button class="action-icon-btn" onclick="Dashboard.deleteUnorg(${item.id})" style="color: var(--urgent-orange); font-weight: 600;" title="Delete this item">🗑️ Delete</button>
            </div>
          `;
          listContainer.appendChild(div);
        });
      }
      document.getElementById("unorganizedModal").style.display = "flex";
    } catch (err) {
      console.error(err);
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

  openManualCreateModal(defaultType = "focus") {
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
    
    this.populateManualProjectDropdown();

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

  setManualEventStartPreset(preset) {
    const startInput = document.getElementById("manualEventStart");
    const endInput = document.getElementById("manualEventEnd");
    if (!startInput) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    function formatDate(d, hours, minutes) {
      const target = new Date(d);
      target.setHours(hours, minutes, 0, 0);
      const yyyy = target.getFullYear();
      const mm = pad(target.getMonth() + 1);
      const dd = target.getDate();
      const hh = pad(target.getHours());
      const min = pad(target.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    let newStart = "";
    if (preset === "today_now") {
      newStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    } else if (preset === "today_12") {
      newStart = formatDate(now, 12, 0);
    } else if (preset === "today_14") {
      newStart = formatDate(now, 14, 0);
    } else if (preset === "today_16") {
      newStart = formatDate(now, 16, 0);
    } else if (preset === "today_18") {
      newStart = formatDate(now, 18, 0);
    } else if (preset === "tomorrow_09") {
      const tom = new Date(now);
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
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    function formatDate(d, hours, minutes) {
      const target = new Date(d);
      target.setHours(hours, minutes, 0, 0);
      const yyyy = target.getFullYear();
      const mm = pad(target.getMonth() + 1);
      const dd = target.getDate();
      const hh = pad(target.getHours());
      const min = pad(target.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    if (preset === "clear") {
      input.value = "";
    } else if (preset === "today_12") {
      input.value = formatDate(now, 12, 0);
    } else if (preset === "today_18") {
      input.value = formatDate(now, 18, 0);
    } else if (preset === "tonight_2359") {
      input.value = formatDate(now, 23, 59);
    } else if (preset === "tomorrow_09") {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      input.value = formatDate(tom, 9, 0);
    } else if (preset === "tomorrow_18") {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      input.value = formatDate(tom, 18, 0);
    } else if (preset === "in_2_days") {
      const future = new Date(now);
      future.setDate(future.getDate() + 2);
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
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            details: description,
            reminder_date: dueDate
          })
        });
        if (res.ok) {
          App.showToast(`🔔 Reminder "${title}" saved!`);
        } else {
          App.showToast("Error creating reminder", true);
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
          App.showToast(`✓ ${tier === "focus" ? "Focus task" : "Errand"} "${title}" added!`);
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

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.Dashboard = Dashboard;
