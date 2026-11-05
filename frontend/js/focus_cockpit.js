/**
 * PETTR Focus Cockpit & Offline Web Audio Ambient Sound Engine
 * Minimalist execution environment for deep work sprints.
 */
const FocusCockpit = {
  activeTask: null,
  timerInterval: null,
  durationSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  isStopwatch: false,
  elapsedSeconds: 0,
  hasStarted: false,
  isMinimized: false,
  sessionFocusSeconds: 0,
  thisWeekHours: 0,
  cachedPickerTasks: [],

  // Audio Context & Sound Engine
  audioCtx: null,
  soundSource: null,
  filterNode: null,
  filterNodeHp: null,
  gainNode: null,
  currentSoundType: "none", // 'none', 'brown', 'pink', 'rain'
  volume: 0.35,

  init() {
    // Dismiss task picker when clicking outside
    document.addEventListener("click", (e) => {
      const picker = document.getElementById("cockpitTaskPicker");
      const btn = document.getElementById("cockpitSwitchTaskBtn");
      const title = document.getElementById("cockpitTaskTitle");
      if (picker && picker.style.display !== "none") {
        if (!picker.contains(e.target) && (!btn || !btn.contains(e.target)) && (!title || !title.contains(e.target))) {
          this.toggleTaskPicker(false);
        }
      }
    });

    // Close task picker on Escape if open
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const picker = document.getElementById("cockpitTaskPicker");
        if (picker && picker.style.display !== "none") {
          e.stopPropagation();
          this.toggleTaskPicker(false);
        }
      }
    });
  },

  async open(task = null) {
    const modal = document.getElementById("focusCockpitModal");
    if (!modal) return;

    if (this.isMinimized) {
      this.isMinimized = false;
      modal.style.display = "flex";
      document.body.classList.add("cockpit-active");
      const floating = document.getElementById("cockpitFloatingPill");
      if (floating) floating.style.display = "none";
      this.updateTimerDisplay();
      this.updatePlayButton();
      App.renderIcons();
      App.haptic("light");
      return;
    }

    if (task) {
      this.activeTask = task;
    } else if (!this.activeTask) {
      this.activeTask = this.resolveActiveTask();
    }

    this.renderTaskDetails();
    this.syncDurationControls(Math.round(this.durationSeconds / 60));
    this.updateTimerDisplay();
    this.updatePlayButton();
    this.renderSoundControls();
    this.fetchWeeklyMetrics();

    modal.style.display = "flex";
    document.body.classList.add("cockpit-active");

    App.renderIcons();
    App.haptic("medium");
  },

  minimize() {
    const modal = document.getElementById("focusCockpitModal");
    if (modal) modal.style.display = "none";
    document.body.classList.remove("cockpit-active");
    this.isMinimized = true;

    // Do NOT pause the timer, and do NOT stop ambient sound!
    this.updateMiniDisplays();
    App.haptic("light");
  },

  close() {
    const picker = document.getElementById("cockpitTaskPicker");
    if (picker && picker.style.display !== "none") {
      this.toggleTaskPicker(false);
      return;
    }
    if (this.hasStarted || this.isRunning) {
      // Keep active sprint alive in the mini display when closing / pressing escape
      this.minimize();
      return;
    }
    this.stopSession();
  },

  stopSession() {
    this.logCurrentFocusSession(false);
    const modal = document.getElementById("focusCockpitModal");
    if (modal) modal.style.display = "none";
    document.body.classList.remove("cockpit-active");

    this.pauseTimer();
    this.stopAmbientSound();
    this.currentSoundType = "none";
    document.querySelectorAll(".ambient-sound-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sound === "none");
    });

    this.hasStarted = false;
    this.isMinimized = false;

    const floatingPill = document.getElementById("cockpitFloatingPill");
    if (floatingPill) floatingPill.style.display = "none";

    document.title = "PETTR - Personal Errands, Task Tracker & Repository";
    this.updatePlayButton();
    App.showToast("Focus sprint ended.");
    App.haptic("light");
  },

  resolveActiveTask() {
    // 1. First item in Daily Order
    if (typeof Dashboard !== "undefined" && Dashboard.dailyOrder && Dashboard.dailyOrder.length > 0) {
      const top = Dashboard.dailyOrder.find(item => !item.completed);
      if (top) return top;
    }

    // 2. First pending Focus Task
    if (typeof Dashboard !== "undefined" && Dashboard.tasks && Dashboard.tasks.focus) {
      const pending = Dashboard.tasks.focus.find(t => t.status !== "completed");
      if (pending) return pending;
    }

    // 3. Fallback generic focus session
    return {
      id: null,
      title: "Deep Work Focus Session",
      project_name: "High Priority",
      urgency: { level: "urgent" }
    };
  },

  launchTopTask() {
    const top = this.resolveActiveTask();
    this.open(top);
  },

  renderTaskDetails() {
    const titleEl = document.getElementById("cockpitTaskTitle");
    const projEl = document.getElementById("cockpitTaskProject");
    const urgEl = document.getElementById("cockpitTaskUrgency");

    if (!this.activeTask) return;

    if (titleEl) titleEl.textContent = this.activeTask.title || "Focused Sprint";
    if (projEl) {
      projEl.textContent = this.activeTask.project_name || "General Deep Work";
      projEl.style.display = "inline-block";
    }
    if (urgEl) {
      const urg = (this.activeTask.urgency && this.activeTask.urgency.level) || (this.activeTask.tier || "focus");
      urgEl.textContent = urg.toUpperCase();
      urgEl.className = `urgency-badge ${urg}`;
    }
  },

  getAvailableTasks() {
    const list = [];
    const seenIds = new Set();

    // 1. Items from Dashboard.dailyOrder (preserves priority sequence)
    if (typeof Dashboard !== "undefined" && Dashboard.dailyOrder && Dashboard.dailyOrder.length > 0) {
      Dashboard.dailyOrder.forEach((item, idx) => {
        if (!item.completed && item.id) {
          seenIds.add(item.id);
          list.push({
            id: item.id,
            title: item.title,
            project_name: item.project_name || "General",
            urgency: item.urgency || { level: "focus", label: "FOCUS" },
            tier: item.tier || "focus",
            priority_rank: idx + 1,
            is_priority: true
          });
        }
      });
    }

    // 2. Pending Focus tasks
    if (typeof Dashboard !== "undefined" && Dashboard.tasks && Dashboard.tasks.focus) {
      Dashboard.tasks.focus.forEach(t => {
        if (t.status !== "completed" && t.id && !seenIds.has(t.id)) {
          seenIds.add(t.id);
          list.push({
            id: t.id,
            title: t.title,
            project_name: t.project_name || "General",
            urgency: t.urgency || { level: "focus", label: "FOCUS" },
            tier: "focus",
            priority_rank: null,
            is_priority: false
          });
        }
      });
    }

    // 3. Pending Trivial tasks (in case user sprints on trivial task out of order)
    if (typeof Dashboard !== "undefined" && Dashboard.tasks && Dashboard.tasks.trivial) {
      Dashboard.tasks.trivial.forEach(t => {
        if (t.status !== "completed" && t.id && !seenIds.has(t.id)) {
          seenIds.add(t.id);
          list.push({
            id: t.id,
            title: t.title,
            project_name: t.project_name || "General",
            urgency: t.urgency || { level: "trivial", label: "TRIVIAL" },
            tier: "trivial",
            priority_rank: null,
            is_priority: false
          });
        }
      });
    }

    // 4. Project tasks
    if (typeof Dashboard !== "undefined" && Dashboard.tasks && Dashboard.tasks.projects) {
      Dashboard.tasks.projects.forEach(p => {
        (p.tasks || []).forEach(pt => {
          if (pt.status !== "completed" && pt.id && !seenIds.has(pt.id)) {
            seenIds.add(pt.id);
            list.push({
              id: pt.id,
              title: pt.title,
              project_name: p.name || pt.project_name || "General",
              urgency: pt.urgency || { level: "focus", label: "FOCUS" },
              tier: "project",
              priority_rank: null,
              is_priority: false
            });
          }
        });
      });
    }

    return list;
  },

  toggleTaskPicker(forceState) {
    const picker = document.getElementById("cockpitTaskPicker");
    const btn = document.getElementById("cockpitSwitchTaskBtn");
    if (!picker) return;

    const shouldShow = (typeof forceState === "boolean") ? forceState : (picker.style.display === "none" || !picker.style.display);
    if (shouldShow) {
      this.populateTaskPicker();
      picker.style.display = "flex";
      if (btn) btn.classList.add("active");
      const search = document.getElementById("cockpitTaskSearchInput");
      if (search) {
        search.value = "";
        setTimeout(() => search.focus(), 60);
      }
    } else {
      picker.style.display = "none";
      if (btn) btn.classList.remove("active");
    }
  },

  populateTaskPicker() {
    const tasks = this.getAvailableTasks();
    this.cachedPickerTasks = tasks;
    this.renderPickerList(tasks);
  },

  renderPickerList(tasks) {
    const listEl = document.getElementById("cockpitTaskPickerList");
    if (!listEl) return;

    listEl.innerHTML = "";

    // 1. General Deep Work option (untied to any task)
    const generalActive = (!this.activeTask || !this.activeTask.id);
    const genItem = document.createElement("div");
    genItem.className = `cockpit-picker-item ${generalActive ? 'active' : ''}`;
    genItem.onclick = () => this.switchActiveTask({
      id: null,
      title: "Deep Work Focus Session",
      project_name: "General Deep Work",
      urgency: { level: "focus", label: "FOCUS" },
      tier: "focus"
    });
    genItem.innerHTML = `
      <div class="picker-item-left">
        <span class="picker-rank-chip general">GEN</span>
        <div class="picker-item-info">
          <div class="picker-item-title">General Deep Work Sprint</div>
          <div class="picker-item-meta">Untied focus sprint (flexible)</div>
        </div>
      </div>
      ${generalActive ? '<span class="picker-active-check">✓ Active</span>' : ''}
    `;
    listEl.appendChild(genItem);

    if (!tasks || tasks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cockpit-picker-empty";
      empty.textContent = "No other pending tasks found for today.";
      listEl.appendChild(empty);
      return;
    }

    const divider = document.createElement("div");
    divider.className = "cockpit-picker-divider";
    divider.textContent = `Today's Pending Tasks (${tasks.length})`;
    listEl.appendChild(divider);

    tasks.forEach(t => {
      const isCurrent = (this.activeTask && this.activeTask.id === t.id);
      const item = document.createElement("div");
      item.className = `cockpit-picker-item ${isCurrent ? 'active' : ''}`;
      item.onclick = () => this.switchActiveTask(t);

      const rankBadge = t.priority_rank 
        ? `<span class="picker-rank-chip rank" title="Priority #${t.priority_rank}">#${t.priority_rank}</span>`
        : `<span class="picker-rank-chip other">${(t.tier || 'task').slice(0, 3).toUpperCase()}</span>`;

      const urgLevel = (t.urgency && t.urgency.level) || t.tier || "focus";

      item.innerHTML = `
        <div class="picker-item-left">
          ${rankBadge}
          <div class="picker-item-info">
            <div class="picker-item-title">${this.escapeHtml(t.title)}</div>
            <div class="picker-item-meta">
              <span class="picker-proj-tag">${this.escapeHtml(t.project_name || "General")}</span>
              <span class="picker-urgency-tag ${urgLevel}">${urgLevel.toUpperCase()}</span>
            </div>
          </div>
        </div>
        ${isCurrent ? '<span class="picker-active-check">✓ Active</span>' : ''}
      `;
      listEl.appendChild(item);
    });

    if (window.lucide) {
      try { lucide.createIcons(); } catch (_) {}
    }
  },

  filterTaskPicker(query) {
    if (!this.cachedPickerTasks) return;
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      this.renderPickerList(this.cachedPickerTasks);
      return;
    }
    const filtered = this.cachedPickerTasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.project_name && t.project_name.toLowerCase().includes(q))
    );
    this.renderPickerList(filtered);
  },

  async switchActiveTask(task) {
    if (!task) return;

    // Log accumulated sprint duration on previous task if >= 30 seconds
    if (this.sessionFocusSeconds >= 30) {
      await this.logCurrentFocusSession(false);
      this.sessionFocusSeconds = 0;
    }

    this.activeTask = task;
    this.renderTaskDetails();
    this.toggleTaskPicker(false);
    this.updateMiniDisplays();

    // Contextualize scratchpad if empty
    const scratchpad = document.getElementById("cockpitScratchpad");
    if (scratchpad && (!scratchpad.value || !scratchpad.value.trim())) {
      scratchpad.placeholder = `Jot quick thoughts for "${task.title || 'Focus Sprint'}"...`;
    }

    App.showToast(`🎯 Switched target: "${task.title || 'General Focus'}"`);
    App.haptic("light");
    if (window.lucide) {
      try { lucide.createIcons(); } catch (_) {}
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

  formatDurationLabel(minutes) {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins)) return "";
    if (mins < 60) {
      return `${mins} min${mins === 1 ? '' : 's'}`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (remMins === 0) {
      return `${hrs} hr${hrs === 1 ? '' : 's'}`;
    }
    return `${hrs} hr ${remMins}m`;
  },

  onDurationSliderChange(value) {
    const mins = parseInt(value, 10);
    if (isNaN(mins) || mins <= 0) return;
    this.setDuration(mins);
  },

  setDuration(minutes) {
    const mins = Math.max(5, Math.min(180, parseInt(minutes, 10) || 25));
    const oldDuration = this.durationSeconds;
    this.isStopwatch = false;
    this.durationSeconds = mins * 60;

    if (!this.hasStarted || this.remainingSeconds <= 0) {
      // If timer has not started or countdown has run down to 0, resetting duration resets countdown
      this.remainingSeconds = this.durationSeconds;
      this.hasStarted = false;
    } else if (this.isRunning) {
      const delta = this.durationSeconds - oldDuration;
      this.remainingSeconds = Math.max(1, this.remainingSeconds + delta);
    } else {
      const delta = this.durationSeconds - oldDuration;
      this.remainingSeconds = Math.max(1, Math.min(this.durationSeconds, this.remainingSeconds + delta));
    }

    this.syncDurationControls(mins);
    this.updateTimerDisplay();
    this.updatePlayButton();
  },

  addTime(minutes) {
    const addSecs = (parseInt(minutes, 10) || 5) * 60;
    this.isStopwatch = false;
    if (this.remainingSeconds <= 0 || !this.hasStarted) {
      this.durationSeconds = addSecs;
      this.remainingSeconds = addSecs;
      this.hasStarted = false;
    } else {
      this.durationSeconds = Math.min(180 * 60, this.durationSeconds + addSecs);
      this.remainingSeconds += addSecs;
    }
    this.syncDurationControls(Math.round(this.durationSeconds / 60));
    this.updateTimerDisplay();
    this.updatePlayButton();
    App.showToast(`+${minutes} mins added to focus sprint!`);
    App.haptic("light");
  },

  syncDurationControls(mins) {
    const slider = document.getElementById("cockpitDurationSlider");
    if (slider && parseInt(slider.value, 10) !== mins) {
      slider.value = mins;
    }

    const label = document.getElementById("cockpitDurationLabel");
    if (label) {
      label.textContent = this.isStopwatch ? "Stopwatch (Count Up)" : this.formatDurationLabel(mins);
    }

    document.querySelectorAll(".cockpit-preset-chip").forEach(btn => {
      if (this.isStopwatch) {
        btn.classList.toggle("active", btn.dataset.mode === "stopwatch");
      } else {
        btn.classList.toggle("active", parseInt(btn.dataset.min, 10) === mins);
      }
    });
  },

  setPreset(minutes) {
    this.pauseTimer();
    this.hasStarted = false;
    this.setDuration(minutes);
  },

  setStopwatchMode() {
    this.pauseTimer();
    this.hasStarted = false;
    this.isStopwatch = true;
    this.elapsedSeconds = 0;
    this.syncDurationControls(Math.round(this.durationSeconds / 60));
    this.updateTimerDisplay();
    this.updatePlayButton();
  },

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  },

  updatePlayButton() {
    const playBtn = document.getElementById("cockpitPlayBtn");
    if (!playBtn) return;
    if (this.isRunning) {
      playBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px;"></i> Pause`;
    } else if (this.hasStarted) {
      playBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;"></i> Resume`;
    } else {
      playBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;"></i> Start Sprint`;
    }
    App.renderIcons();
  },

  startTimer() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.hasStarted = true;

    this.updatePlayButton();

    // Auto-resume ambient sound if selected and not already playing
    if (this.currentSoundType !== "none" && !this.soundSource) {
      this.playAmbientSound(this.currentSoundType);
    }

    this.updateMiniDisplays();

    this.timerInterval = setInterval(() => {
      this.sessionFocusSeconds++; // Accumulate active focus seconds

      if (this.isStopwatch) {
        this.elapsedSeconds++;
        this.updateTimerDisplay();
      } else {
        if (this.remainingSeconds > 0) {
          this.remainingSeconds--;
          this.updateTimerDisplay();
        } else {
          this.onTimerComplete();
        }
      }
    }, 1000);

    App.haptic("light");
  },

  pauseTimer() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Note: Ambient sound is independent of timer and continues playing while paused

    this.updatePlayButton();
    this.updateMiniDisplays();
  },

  resetTimer() {
    this.pauseTimer();
    this.hasStarted = false;
    if (this.isStopwatch) {
      this.elapsedSeconds = 0;
    } else {
      this.remainingSeconds = this.durationSeconds;
    }
    this.updateTimerDisplay();
    this.updatePlayButton();
    this.updateMiniDisplays();
    App.haptic("light");
  },

  updateTimerDisplay() {
    const totalSec = this.isStopwatch ? this.elapsedSeconds : this.remainingSeconds;
    let timeStr;
    if (totalSec >= 3600) {
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      timeStr = `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else {
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    const digitsEl = document.getElementById("cockpitTimerDigits");
    if (digitsEl) digitsEl.textContent = timeStr;

    // Browser tab title indicator
    if (this.isRunning || this.hasStarted) {
      document.title = `[${timeStr}] ${this.activeTask ? this.activeTask.title : 'Focus'}`;
    }

    // Progress bar/ring
    const progressEl = document.getElementById("cockpitProgressFill");
    if (progressEl) {
      let pct = 0;
      if (!this.isStopwatch && this.durationSeconds > 0) {
        pct = ((this.durationSeconds - this.remainingSeconds) / this.durationSeconds) * 100;
      } else if (this.isStopwatch) {
        pct = (this.elapsedSeconds % 60) * (100 / 60);
      }
      progressEl.style.width = `${pct}%`;
    }

    this.updateMiniDisplays();
  },

  updateMiniDisplays() {
    const totalSec = this.isStopwatch ? this.elapsedSeconds : this.remainingSeconds;
    let timeStr;
    if (totalSec >= 3600) {
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      timeStr = `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    } else {
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    const floatingPill = document.getElementById("cockpitFloatingPill");
    const floatingDigits = document.getElementById("cockpitFloatingDigits");
    const floatingTitle = document.getElementById("cockpitFloatingTitle");

    if (floatingDigits) floatingDigits.textContent = timeStr;
    if (floatingTitle) {
      floatingTitle.textContent = (this.activeTask && this.activeTask.title) ? this.activeTask.title : "Focus";
    }

    if (this.hasStarted) {
      if (floatingPill) floatingPill.style.display = this.isMinimized ? "flex" : "none";
    } else {
      if (floatingPill) floatingPill.style.display = "none";
    }
  },

  onTimerComplete() {
    this.pauseTimer();
    this.playHarmonicChime();
    this.logCurrentFocusSession(false);
    App.showToast("⚡ Focus Sprint Completed! Set more time or mark completed.", 4500);
    App.haptic("medium");

    // Allow user to immediately set more time or restart
    this.hasStarted = false;

    const pulseEl = document.getElementById("cockpitTimerContainer");
    if (pulseEl) {
      pulseEl.classList.add("timer-complete-pulse");
      setTimeout(() => pulseEl.classList.remove("timer-complete-pulse"), 2500);
    }
    this.updatePlayButton();
    this.updateMiniDisplays();
  },

  /* --- Procedural Native Web Audio Ambient Sound Generator --- */
  initAudio() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  },

  playHarmonicChime() {
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.4, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Triumphant Fanfare Arpeggio into Grand Victory Major Chord
      const notes = [
        { freq: 523.25, time: 0.0,  duration: 0.16, type: "triangle", gain: 0.35 }, // C5
        { freq: 659.25, time: 0.15, duration: 0.16, type: "triangle", gain: 0.38 }, // E5
        { freq: 783.99, time: 0.30, duration: 0.20, type: "triangle", gain: 0.42 }, // G5
        // Triumphant Major Grand Chord
        { freq: 523.25,  time: 0.48, duration: 2.2, type: "triangle", gain: 0.28 }, // C5
        { freq: 659.25,  time: 0.48, duration: 2.2, type: "sine",     gain: 0.28 }, // E5
        { freq: 783.99,  time: 0.48, duration: 2.4, type: "sine",     gain: 0.30 }, // G5
        { freq: 1046.50, time: 0.48, duration: 2.6, type: "sine",     gain: 0.36 }, // C6
        { freq: 1318.51, time: 0.50, duration: 2.4, type: "sine",     gain: 0.18 }, // E6 Harmonic Shimmer
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

        const tStart = ctx.currentTime + n.time;
        const tEnd = tStart + n.duration;

        g.gain.setValueAtTime(0, tStart);
        g.gain.linearRampToValueAtTime(n.gain, tStart + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, tEnd);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(tStart);
        osc.stop(tEnd + 0.05);
      });
    } catch (e) {
      console.warn("Audio victory fanfare failed:", e);
    }
  },

  setSoundType(type) {
    this.currentSoundType = type;
    document.querySelectorAll(".ambient-sound-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sound === type);
    });

    if (type === "none") {
      this.stopAmbientSound();
    } else {
      // Immediate ambient sound playback - independent of timer state!
      this.playAmbientSound(type);
    }
  },

  setVolume(vol) {
    this.volume = parseFloat(vol);
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  },

  playAmbientSound(type) {
    this.stopAmbientSound();
    if (type === "none") return;

    try {
      this.initAudio();
      const ctx = this.audioCtx;
      const bufferSize = 5 * ctx.sampleRate; // 5-second seamless loop buffer
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      if (type === "brown") {
        // Brownian 1/f^2 integrated white noise
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        }
      } else if (type === "pink") {
        // Pink 1/f noise filter approximation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      } else if (type === "rain") {
        // Organic gentle rain: warm continuous precipitation bed + soft pitter-patter droplet impacts (strictly non-tonal)
        const sampleRate = ctx.sampleRate;

        // 1. Warm pink noise rain wash (Kellet 1/f filter approximation)
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;

          // Gentle breathing LFO simulating organic breeze / distant shower variation
          const t = i / sampleRate;
          const breeze = 0.88 + 0.12 * Math.sin(2 * Math.PI * 0.07 * t) * Math.cos(2 * Math.PI * 0.13 * t);
          data[i] = pink * 0.55 * breeze;
        }

        // 2. Realistic randomized droplet impacts (soft pitter-patter)
        // Zero tonal sine-waves (no bird-chirping artifacts) - pure low-pass filtered impulse micro-bursts
        const dropCount = Math.floor(sampleRate * 5 * 0.0040); // ~40 soft drops per second
        for (let d = 0; d < dropCount; d++) {
          const startIdx = Math.floor(Math.random() * (bufferSize - 1000));
          const dropLen = Math.floor(sampleRate * (0.004 + Math.random() * 0.012)); // 4ms to 16ms
          const dropAmp = 0.10 + Math.random() * 0.22;
          const decayRate = 4.0 + Math.random() * 3.0;
          const filterCoeff = 0.18 + Math.random() * 0.16; // Lowpass damping for dull "pat" on leaves / glass

          let filt = 0;
          for (let j = 0; j < dropLen && (startIdx + j) < bufferSize; j++) {
            const env = Math.exp(-decayRate * (j / dropLen));
            const wn = Math.random() * 2 - 1;
            filt = (1 - filterCoeff) * filt + filterCoeff * wn;
            data[startIdx + j] += filt * env * dropAmp;
          }
        }

        // 3. Smooth soft limiter / saturation to avoid clipping
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.tanh(data[i] * 1.3) * 0.65;
        }
      }

      this.soundSource = ctx.createBufferSource();
      this.soundSource.buffer = buffer;
      this.soundSource.loop = true;

      let nodeToConnect = this.soundSource;
      if (type === "rain") {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(2400, ctx.currentTime);
        lp.Q.setValueAtTime(0.5, ctx.currentTime);

        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(180, ctx.currentTime);
        hp.Q.setValueAtTime(0.7, ctx.currentTime);

        this.soundSource.connect(hp);
        hp.connect(lp);
        this.filterNode = lp;
        this.filterNodeHp = hp;
        nodeToConnect = lp;
      } else if (type === "brown") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        this.soundSource.connect(filter);
        this.filterNode = filter;
        nodeToConnect = filter;
      }

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.3); // smooth fade-in

      nodeToConnect.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);
      this.soundSource.start(0);
    } catch (e) {
      console.warn("Ambient sound failed to start:", e);
    }
  },

  stopAmbientSound() {
    const oldSource = this.soundSource;
    const oldFilter = this.filterNode;
    const oldFilterHp = this.filterNodeHp;
    const oldGain = this.gainNode;
    this.soundSource = null;
    this.filterNode = null;
    this.filterNodeHp = null;
    this.gainNode = null;

    if (oldGain && this.audioCtx) {
      try {
        oldGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        oldGain.gain.setValueAtTime(oldGain.gain.value, this.audioCtx.currentTime);
        oldGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.04);
      } catch (e) {}
    }

    if (oldSource) {
      setTimeout(() => {
        try { oldSource.stop(); } catch (e) {}
        try { oldSource.disconnect(); } catch (e) {}
        if (oldFilter) { try { oldFilter.disconnect(); } catch (e) {} }
        if (oldFilterHp) { try { oldFilterHp.disconnect(); } catch (e) {} }
        if (oldGain) { try { oldGain.disconnect(); } catch (e) {} }
      }, 50);
    }
  },

  renderSoundControls() {
    const slider = document.getElementById("cockpitVolumeSlider");
    if (slider) slider.value = this.volume;
  },

  /* --- Scratchpad & Task Completion --- */
  async saveScratchpadToNotes() {
    const text = document.getElementById("cockpitScratchpad")?.value.trim();
    if (!text) return;

    const taskTitle = (this.activeTask && this.activeTask.title) ? this.activeTask.title : "Deep Work Sprint";
    const noteTitle = `Focus Note: ${taskTitle}`;
    const noteContent = `**Tied Task:** ${taskTitle}\n\n${text}`;

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle,
          content: noteContent
        })
      });
      if (res.ok) {
        App.showToast(`Saved to Notes: "${noteTitle}"!`);
        const ta = document.getElementById("cockpitScratchpad");
        if (ta) ta.value = "";
        if (typeof Notes !== "undefined" && Notes.refresh) {
          Notes.refresh();
        }
      } else {
        App.showToast("Failed to save note", true);
      }
    } catch (e) {
      console.warn("Could not save scratchpad to notes:", e);
      App.showToast("Error saving note", true);
    }
  },

  async completeCurrentTask() {
    if (!this.activeTask || !this.activeTask.id) {
      this.close();
      return;
    }

    try {
      // Log accumulated focus sprint duration before closing
      await this.logCurrentFocusSession(true);

      // Automatically cut ambient sound when item is marked completed
      this.stopAmbientSound();
      this.currentSoundType = "none";
      document.querySelectorAll(".ambient-sound-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.sound === "none");
      });

      await fetch(`/api/tasks/${this.activeTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });

      this.playHarmonicChime();
      App.showToast(`✓ Completed: "${this.activeTask.title}"! Loading next target...`);
      App.haptic("medium");

      if (typeof Dashboard !== "undefined") {
        await Dashboard.refresh();
      }

      // Automatically advance to the next priority task
      const nextTask = this.resolveActiveTask();
      if (nextTask && nextTask.id !== this.activeTask.id) {
        this.activeTask = nextTask;
        this.renderTaskDetails();
        this.resetTimer();
      } else {
        App.showToast("All daily focus targets conquered! Well done.");
        this.stopSession();
      }
    } catch (e) {
      console.error("Could not complete task:", e);
    }
  },

  /* --- Focus Telemetry & Metric Logging --- */
  async fetchWeeklyMetrics() {
    try {
      const res = await fetch("/api/focus/metrics");
      if (res.ok) {
        const data = await res.json();
        this.thisWeekHours = data.this_week_hours || 0;
        this.updateHeaderBadge(data);
      }
    } catch (e) {
      console.warn("Could not fetch focus metrics:", e);
    }
  },

  updateHeaderBadge(data) {
    const badge = document.getElementById("cockpitWeeklyHoursBadge");
    if (badge) {
      const hrs = data.this_week_hours || 0;
      badge.textContent = `⚡ This Week: ${hrs}h`;
      badge.title = `Total focus time logged this week: ${hrs} hours (${data.this_week_sessions || 0} sessions). Click to view breakdown in History.`;
    }
  },

  async logCurrentFocusSession(completedTask = false) {
    if (this.sessionFocusSeconds < 30) {
      return; // Ignore quick accidental clicks under 30s
    }

    const duration = this.sessionFocusSeconds;
    this.sessionFocusSeconds = 0; // reset accumulator

    const payload = {
      task_id: this.activeTask?.id || null,
      task_title: this.activeTask?.title || "Deep Work Sprint",
      project_name: this.activeTask?.project_name || "General",
      duration_seconds: duration,
      target_seconds: this.durationSeconds || duration,
      completed_task: !!completedTask
    };

    try {
      const res = await fetch("/api/focus/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        this.fetchWeeklyMetrics();
        if (typeof History !== "undefined" && History.renderFocusTelemetry) {
          History.renderFocusTelemetry();
        }
        if (typeof Dashboard !== "undefined" && Dashboard.loadProductivityStats) {
          Dashboard.loadProductivityStats();
        }
      }
    } catch (e) {
      console.warn("Could not log focus session:", e);
    }
  }
};

window.FocusCockpit = FocusCockpit;
