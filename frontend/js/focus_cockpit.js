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

  // Audio Context & Sound Engine
  audioCtx: null,
  soundSource: null,
  gainNode: null,
  currentSoundType: "none", // 'none', 'brown', 'pink', 'rain'
  volume: 0.35,

  init() {
    // Lazy audio initialization on first user interaction
  },

  async open(task = null) {
    const modal = document.getElementById("focusCockpitModal");
    if (!modal) return;

    if (task) {
      this.activeTask = task;
    } else {
      this.activeTask = this.resolveActiveTask();
    }

    this.renderTaskDetails();
    this.updateTimerDisplay();
    this.renderSoundControls();

    modal.style.display = "flex";
    document.body.classList.add("cockpit-active");

    App.renderIcons();
    App.haptic("medium");
  },

  close() {
    const modal = document.getElementById("focusCockpitModal");
    if (!modal) return;

    modal.style.display = "none";
    document.body.classList.remove("cockpit-active");

    this.pauseTimer();
    this.stopAmbientSound();
    document.title = "PETTR - Personal Errands, Task Tracker & Repository";
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
      const urg = (this.activeTask.urgency && this.activeTask.urgency.level) || "focus";
      urgEl.textContent = urg.toUpperCase();
      urgEl.className = `urgency-badge ${urg}`;
    }
  },

  setPreset(minutes) {
    this.pauseTimer();
    this.isStopwatch = false;
    this.durationSeconds = minutes * 60;
    this.remainingSeconds = this.durationSeconds;
    this.updateTimerDisplay();

    document.querySelectorAll(".cockpit-preset-chip").forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.min, 10) === minutes);
    });
  },

  setStopwatchMode() {
    this.pauseTimer();
    this.isStopwatch = true;
    this.elapsedSeconds = 0;
    this.updateTimerDisplay();

    document.querySelectorAll(".cockpit-preset-chip").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === "stopwatch");
    });
  },

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  },

  startTimer() {
    if (this.isRunning) return;
    this.isRunning = true;

    const playBtn = document.getElementById("cockpitPlayBtn");
    if (playBtn) {
      playBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px;"></i> Pause`;
      App.renderIcons();
    }

    // Auto-resume ambient sound if selected
    if (this.currentSoundType !== "none") {
      this.playAmbientSound(this.currentSoundType);
    }

    this.timerInterval = setInterval(() => {
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

    const playBtn = document.getElementById("cockpitPlayBtn");
    if (playBtn) {
      playBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px;"></i> Resume`;
      App.renderIcons();
    }
  },

  resetTimer() {
    this.pauseTimer();
    if (this.isStopwatch) {
      this.elapsedSeconds = 0;
    } else {
      this.remainingSeconds = this.durationSeconds;
    }
    this.updateTimerDisplay();
    App.haptic("light");
  },

  updateTimerDisplay() {
    const totalSec = this.isStopwatch ? this.elapsedSeconds : this.remainingSeconds;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    const digitsEl = document.getElementById("cockpitTimerDigits");
    if (digitsEl) digitsEl.textContent = timeStr;

    // Browser tab title indicator
    if (this.isRunning) {
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
  },

  onTimerComplete() {
    this.pauseTimer();
    this.playHarmonicChime();
    App.showToast("⚡ Focus Sprint Completed! Excellent execution.", 4000);
    App.haptic("medium");

    const pulseEl = document.getElementById("cockpitTimerContainer");
    if (pulseEl) {
      pulseEl.classList.add("timer-complete-pulse");
      setTimeout(() => pulseEl.classList.remove("timer-complete-pulse"), 2500);
    }
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
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(528, ctx.currentTime); // 528Hz Solfeggio Miracle Tone
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz Harmonic

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 2.2);
      osc2.stop(ctx.currentTime + 2.2);
    } catch (e) {
      console.warn("Audio chime failed:", e);
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
        // Soft rain/static with gentle bandpass modulation
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
      }

      this.soundSource = ctx.createBufferSource();
      this.soundSource.buffer = buffer;
      this.soundSource.loop = true;

      // Filter for rain smoothing if needed
      let nodeToConnect = this.soundSource;
      if (type === "rain") {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        filter.Q.setValueAtTime(0.8, ctx.currentTime);
        this.soundSource.connect(filter);
        nodeToConnect = filter;
      } else if (type === "brown") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        this.soundSource.connect(filter);
        nodeToConnect = filter;
      }

      this.gainNode = ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.6); // smooth fade-in

      nodeToConnect.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);
      this.soundSource.start(0);
    } catch (e) {
      console.warn("Ambient sound failed to start:", e);
    }
  },

  stopAmbientSound() {
    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.3); // smooth fade-out
      } catch (e) {}
    }
    if (this.soundSource) {
      setTimeout(() => {
        try {
          this.soundSource.stop();
          this.soundSource.disconnect();
          this.soundSource = null;
        } catch (e) {}
      }, 350);
    }
  },

  renderSoundControls() {
    const slider = document.getElementById("cockpitVolumeSlider");
    if (slider) slider.value = this.volume;
  },

  /* --- Fleeting Scratchpad & Task Completion --- */
  async saveScratchpadToNotes() {
    const text = document.getElementById("cockpitScratchpad").value.trim();
    if (!text) return;

    if (this.activeTask && this.activeTask.id) {
      try {
        await fetch(`/api/tasks/${this.activeTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: text })
        });
        App.showToast("Scratchpad notes appended to active task!");
        document.getElementById("cockpitScratchpad").value = "";
      } catch (e) {
        console.warn("Could not save scratchpad:", e);
      }
    } else {
      // Save as quick unorganized thought
      try {
        await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: text })
        });
        App.showToast("Captured to Unorganised Queue!");
        document.getElementById("cockpitScratchpad").value = "";
      } catch (e) {}
    }
  },

  async completeCurrentTask() {
    if (!this.activeTask || !this.activeTask.id) {
      this.close();
      return;
    }

    try {
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
        this.close();
      }
    } catch (e) {
      console.error("Could not complete task:", e);
    }
  }
};
