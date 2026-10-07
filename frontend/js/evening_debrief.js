/**
 * PETTR Evening Debrief
 * Accessible when the user completes work for the day (highlighted after 1800hrs).
 * Provides rapid leftover task triaging, daily scorecards, and retrospective capture.
 */
const EveningDebrief = {
  isOpen: false,
  pendingTasks: [],
  completedTasks: [],
  baselineTotal: 0,
  baselineCompleted: 0,
  baselineRate: 100,

  init() {
    this.updateDebriefButtonState();
    // Re-check periodically
    setInterval(() => this.updateDebriefButtonState(), 60000);
  },

  isAccessible() {
    // Accessible after 1800hrs or if user manually launches
    const hour = new Date().getHours();
    return hour >= 18;
  },

  updateDebriefButtonState() {
    const isPast18 = this.isAccessible();
    const headerBtn = document.getElementById("eveningDebriefHeaderBtn");
    const dashBtn = document.getElementById("eveningDebriefDashBtn");

    if (headerBtn) {
      headerBtn.style.display = isPast18 ? "inline-flex" : "none";
    }
    if (dashBtn) {
      dashBtn.style.display = isPast18 ? "inline-flex" : "none";
    }
  },

  async open() {
    const modal = document.getElementById("eveningDebriefModal");
    if (!modal) return;

    this.isOpen = true;
    await this.collectDailyMetrics();
    this.renderModal();

    modal.style.display = "flex";
    App.renderIcons();
    App.haptic("medium");
  },

  close() {
    const modal = document.getElementById("eveningDebriefModal");
    if (!modal) return;
    modal.style.display = "none";
    this.isOpen = false;
  },

  async collectDailyMetrics() {
    this.pendingTasks = [];
    this.completedTasks = [];

    if (typeof Dashboard !== "undefined" && Dashboard.tasks) {
      const allFocus = Dashboard.tasks.focus || [];
      const allTrivial = Dashboard.tasks.trivial || [];
      const allTasks = [...allFocus, ...allTrivial];

      allTasks.forEach(t => {
        if (t.status === "completed") {
          this.completedTasks.push(t);
        } else {
          this.pendingTasks.push(t);
        }
      });
    }

    // Freeze baseline what was set out to do today BEFORE any rollover occurs
    this.baselineTotal = this.pendingTasks.length + this.completedTasks.length;
    this.baselineCompleted = this.completedTasks.length;
    this.baselineRate = this.baselineTotal > 0 ? Math.round((this.baselineCompleted / this.baselineTotal) * 100) : 100;
  },

  renderModal() {
    // Always report true baseline rate for today
    const total = this.baselineTotal;
    const completedCount = this.baselineCompleted;
    const rate = this.baselineRate;

    // 1. Metric numbers
    const rateEl = document.getElementById("debriefScoreRate");
    const countEl = document.getElementById("debriefScoreCount");
    const dateEl = document.getElementById("debriefDateStr");

    if (rateEl) rateEl.textContent = `${rate}%`;
    if (countEl) countEl.textContent = `${completedCount} of ${total} closed`;
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    }

    // 2. Render pending tasks triage list
    const listContainer = document.getElementById("debriefPendingList");
    const emptyState = document.getElementById("debriefZeroLoopsNotice");
    const bulkBtn = document.getElementById("debriefBulkRollBtn");

    if (listContainer) {
      if (this.pendingTasks.length === 0) {
        listContainer.style.display = "none";
        if (emptyState) emptyState.style.display = "block";
        if (bulkBtn) bulkBtn.style.display = "none";
      } else {
        listContainer.style.display = "flex";
        if (emptyState) emptyState.style.display = "none";
        if (bulkBtn) bulkBtn.style.display = "inline-flex";

        listContainer.innerHTML = this.pendingTasks.map(t => {
          const isFocus = t.tier === "focus" || (Dashboard.tasks.focus || []).some(f => f.id === t.id);
          const icon = isFocus ? "crosshair" : "check-square";
          return `
            <div class="debrief-triage-row" id="debriefTaskRow_${t.id}">
              <div class="debrief-task-meta">
                <i data-lucide="${icon}" style="width:14px;height:14px;color:${isFocus ? 'var(--focus-indigo)' : 'var(--text-muted)'};"></i>
                <div style="flex:1;">
                  <div class="debrief-task-title">${this.escapeHtml(t.title)}</div>
                  ${t.project_name ? `<span class="project-tag" style="font-size:10px;">${this.escapeHtml(t.project_name)}</span>` : ''}
                </div>
              </div>
              <div class="debrief-triage-actions">
                <button type="button" class="debrief-action-btn roll-tomorrow" onclick="EveningDebrief.rollTaskToTomorrow(${t.id})" title="Move task due date to tomorrow">
                  <i data-lucide="arrow-right" style="width:11px;height:11px;"></i> Tomorrow
                </button>
                <button type="button" class="debrief-action-btn park-unorg" onclick="EveningDebrief.parkTaskToUnorganized(${t.id})" title="Send to Unorganised Queue">
                  <i data-lucide="alert-triangle" style="width:11px;height:11px;"></i> Park
                </button>
                <button type="button" class="debrief-action-btn mark-done" onclick="EveningDebrief.markTaskDone(${t.id})" title="Mark task completed">
                  <i data-lucide="check" style="width:11px;height:11px;"></i> Done
                </button>
              </div>
            </div>
          `;
        }).join("");
      }
    }

    // 3. Restore existing retrospective if previously entered today
    const dateKey = new Date().toISOString().split("T")[0];
    const savedRetro = localStorage.getItem(`pettr_debrief_retro_${dateKey}`) || "";
    const retroInput = document.getElementById("debriefRetroInput");
    if (retroInput) retroInput.value = savedRetro;

    App.renderIcons();
  },

  async rollTaskToTomorrow(taskId) {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const yyyy = tom.getFullYear();
    const mm = String(tom.getMonth() + 1).padStart(2, "0");
    const dd = String(tom.getDate()).padStart(2, "0");
    const tomorrowStr = `${yyyy}-${mm}-${dd} 09:00:00`;

    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: tomorrowStr })
      });

      this.removeTaskFromPending(taskId);
      App.showToast("Task rolled over to tomorrow morning (09:00).");
      App.haptic("light");
    } catch (e) {
      console.error("Could not roll task:", e);
    }
  },

  async rollAllRemainingToTomorrow() {
    if (this.pendingTasks.length === 0) return;
    const taskIds = this.pendingTasks.map(t => t.id);

    for (const id of taskIds) {
      await this.rollTaskToTomorrow(id);
    }

    App.showToast(`Rolled ${taskIds.length} tasks to tomorrow.`);
  },

  async parkTaskToUnorganized(taskId) {
    try {
      await fetch("/api/entities/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "task",
          entity_id: taskId,
          target_type: "unorganized"
        })
      });

      this.removeTaskFromPending(taskId);
      App.showToast("Task parked in Unorganised Queue.");
      App.haptic("light");
    } catch (e) {
      console.error("Could not park task:", e);
    }
  },

  async markTaskDone(taskId) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });

      const task = this.pendingTasks.find(t => t.id === taskId);
      if (task) {
        task.status = "completed";
        this.completedTasks.push(task);
      }
      this.removeTaskFromPending(taskId);
      App.showToast("Task marked completed!");
      App.haptic("light");
    } catch (e) {
      console.error("Could not complete task:", e);
    }
  },

  removeTaskFromPending(taskId) {
    this.pendingTasks = this.pendingTasks.filter(t => t.id !== taskId);
    const row = document.getElementById(`debriefTaskRow_${taskId}`);
    if (row) {
      row.style.opacity = "0";
      row.style.transform = "translateX(20px)";
      setTimeout(() => {
        row.remove();
        this.renderModal();
      }, 250);
    } else {
      this.renderModal();
    }
  },

  applyQuickRetroTag(tagText) {
    const input = document.getElementById("debriefRetroInput");
    if (!input) return;
    if (input.value) {
      input.value += ` · ${tagText}`;
    } else {
      input.value = tagText;
    }
    input.focus();
  },

  async sealDayAndWrapUp() {
    const retroInput = document.getElementById("debriefRetroInput");
    const retroText = retroInput ? retroInput.value.trim() : "";
    const dateKey = (typeof Dashboard !== "undefined" && Dashboard.selectedDate) ? Dashboard.selectedDate : new Date().toISOString().split("T")[0];

    // 1. Post seal to server so day is sealed in database & metrics finalized
    try {
      await fetch("/api/debrief/seal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
          completion_rate: this.baselineRate,
          total_tasks: this.baselineTotal,
          completed_tasks: this.baselineCompleted,
          retro_notes: retroText
        })
      });
    } catch (e) {
      console.warn("Could not post day seal to server:", e);
    }

    if (retroText) {
      localStorage.setItem(`pettr_debrief_retro_${dateKey}`, retroText);

      // Append to today's note if available
      try {
        await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: `Evening Debrief Retrospective: ${retroText} #retro` })
        });
      } catch (e) {}
    }

    localStorage.setItem(`pettr_debrief_sealed_${dateKey}`, "true");

    this.close();
    App.showToast("🌙 Daily Record Sealed! Rest well and reset for tomorrow.", 5000);
    App.haptic("medium");

    // Suggest switching to calm Dark Mode if in Auto or Light
    const currentTheme = localStorage.getItem("pettr_theme_mode") || "auto";
    if (currentTheme !== "dark") {
      App.setTheme("dark");
    }

    if (typeof Dashboard !== "undefined") {
      await Dashboard.refresh();
      await Dashboard.loadProductivityStats();
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
};

window.EveningDebrief = EveningDebrief;
