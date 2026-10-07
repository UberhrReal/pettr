/**
 * PETTR Simplified Mode (Mobile Slide-Over)
 * Streamlined mobile view for Today's Agenda:
 * - Syncs 100% with the active Dashboard Operational Snapshot date
 * - See tasks, events, and reminders for the selected date
 * - Priority sequence order matching the Tasking Priority drop list
 * - Interactive check buttons for tasks, events, and reminders
 * - Touch-drag reordering synced to Dashboard dailyOrder
 */
const SimplifiedMode = {
  isOpen: false,
  items: [],
  clockTimer: null,
  draggedItemIndex: null,

  _lastToggleTime: 0,

  init() {
    const overlay = document.getElementById("simplifiedModeOverlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.close();
      });
    }
  },

  getLocalDateString(dateObj = new Date()) {
    if (typeof App !== "undefined" && App.getLocalDateString) {
      return App.getLocalDateString(dateObj);
    }
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  getTargetDate() {
    if (typeof Dashboard !== "undefined" && Dashboard.selectedDate) {
      return Dashboard.selectedDate;
    }
    if (typeof Dashboard !== "undefined" && Dashboard.getTodayString) {
      return Dashboard.getTodayString();
    }
    return this.getLocalDateString();
  },

  async toggle() {
    const now = Date.now();
    if (now - this._lastToggleTime < 300) return;
    this._lastToggleTime = now;

    const overlay = document.getElementById("simplifiedModeOverlay");
    if (!overlay) return;
    const isVisible = overlay.classList.contains("active") && overlay.style.display !== "none";
    if (isVisible) {
      this.close();
    } else {
      await this.open();
    }
  },

  async open() {
    const overlay = document.getElementById("simplifiedModeOverlay");
    if (!overlay) return;
    this.isOpen = true;
    overlay.style.display = "flex";
    void overlay.offsetWidth; // Force reflow so transition runs
    overlay.classList.add("active");

    this.startClock();
    await this.refresh();
    if (window.App && App.haptic) App.haptic("light");
  },

  close() {
    const overlay = document.getElementById("simplifiedModeOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    setTimeout(() => {
      if (!overlay.classList.contains("active")) {
        overlay.style.display = "none";
      }
      this.isOpen = false;
    }, 280);

    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  },

  startClock() {
    const clockEl = document.getElementById("simplifiedClock");
    const update = () => {
      if (!clockEl) return;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };
    update();
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = setInterval(update, 1000);
  },

  async refresh() {
    const listEl = document.getElementById("simplifiedModeList");
    const countEl = document.getElementById("simplifiedModeCount");
    const titleEl = document.querySelector(".simplified-mode-title");
    if (!listEl) return;

    const targetDate = this.getTargetDate();
    const todayLocal = this.getLocalDateString();

    // Update title to match Snapshot selected date
    if (titleEl) {
      if (targetDate === todayLocal) {
        titleEl.textContent = "Today's Agenda";
      } else {
        const parts = targetDate.split("-").map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayLabel = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        titleEl.textContent = `Agenda (${dayLabel})`;
      }
    }

    listEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 13px;">Loading schedule for ${targetDate}...</div>`;

    try {
      // Fetch snapshot data strictly for the active targetDate
      const [tasksRes, eventsRes, remRes, orderRes] = await Promise.all([
        fetch(`/api/tasks?date=${targetDate}`),
        fetch(`/api/events?date=${targetDate}`),
        fetch(`/api/reminders?date=${targetDate}`),
        fetch(`/api/daily-order?date=${targetDate}`)
      ]);

      const tasksData = tasksRes.ok ? await tasksRes.json() : { focus: [], trivial: [] };
      const appointments = eventsRes.ok ? await eventsRes.json() : [];
      const reminders = remRes.ok ? await remRes.json() : [];
      const orderData = orderRes.ok ? await orderRes.json() : { order: [] };
      const priorityOrder = orderData.order || (typeof Dashboard !== "undefined" && Dashboard.dailyOrder ? Dashboard.dailyOrder : []);

      const focusTasks = tasksData.focus || [];
      const trivialTasks = tasksData.trivial || [];

      // Unified items list
      const allItems = [];

      // 1. Focus Tasks
      focusTasks.forEach(t => {
        allItems.push({
          id: t.id,
          type: "task",
          tier: "focus",
          title: t.title,
          status: t.status || "pending",
          due_date: t.due_date,
          due_date_military: t.due_date_military,
          project_name: t.project_name,
          color: t.project_color || "#6366f1",
          is_time_sensitive: Boolean(t.is_time_sensitive),
          recurrence: t.recurrence
        });
      });

      // 2. Trivial Tasks
      trivialTasks.forEach(t => {
        allItems.push({
          id: t.id,
          type: "task",
          tier: "trivial",
          title: t.title,
          status: t.status || "pending",
          due_date: t.due_date,
          due_date_military: t.due_date_military,
          project_name: t.project_name,
          color: t.project_color || "#10b981",
          is_time_sensitive: Boolean(t.is_time_sensitive),
          recurrence: t.recurrence
        });
      });

      // 3. Events
      appointments.forEach(e => {
        allItems.push({
          id: e.id,
          type: "event",
          title: e.title,
          status: e.status || "scheduled",
          start_time: e.start_time,
          project_name: e.project_name,
          color: "#3b82f6"
        });
      });

      // 4. Reminders
      reminders.forEach(r => {
        allItems.push({
          id: r.id,
          type: "reminder",
          title: r.title,
          status: r.is_done ? "completed" : "pending",
          reminder_date: r.reminder_date,
          color: "#f59e0b"
        });
      });

      // Sort items: Items sequenced in Tasking Priority appear first in their exact execution order
      if (priorityOrder && priorityOrder.length > 0) {
        const orderMap = new Map();
        priorityOrder.forEach((item, idx) => {
          orderMap.set(`${item.type || 'task'}_${item.id}`, idx);
        });

        allItems.sort((a, b) => {
          const keyA = `${a.type}_${a.id}`;
          const keyB = `${b.type}_${b.id}`;
          const idxA = orderMap.has(keyA) ? orderMap.get(keyA) : 9999;
          const idxB = orderMap.has(keyB) ? orderMap.get(keyB) : 9999;
          if (idxA !== idxB) return idxA - idxB;
          return 0;
        });
      }

      this.items = allItems;

      if (countEl) {
        const pendingCount = this.items.filter(i => i.status !== 'completed' && i.status !== 'done').length;
        countEl.textContent = `${this.items.length} items (${pendingCount} pending) · ${targetDate}`;
      }

      this.render();
    } catch (err) {
      console.error("SimplifiedMode load error:", err);
      listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--urgent-orange);">Failed to load schedule for ${targetDate}.</div>`;
    }
  },

  render() {
    const listEl = document.getElementById("simplifiedModeList");
    if (!listEl) return;

    if (this.items.length === 0) {
      listEl.innerHTML = `
        <div class="simplified-empty-state">
          <i data-lucide="check-circle" style="width:36px;height:36px;color:var(--normal-green);margin-bottom:8px;"></i>
          <h3>All Caught Up For Today</h3>
          <p>No pending tasks, events, or reminders scheduled right now.</p>
        </div>
      `;
      App.renderIcons();
      return;
    }

    listEl.innerHTML = "";

    this.items.forEach((item, index) => {
      const card = document.createElement("div");
      const isDone = item.status === 'completed' || item.status === 'done';
      card.className = `simplified-card ${item.type} ${isDone ? 'completed' : ''}`;
      card.dataset.index = index;
      card.dataset.id = item.id;
      card.dataset.type = item.type;
      card.draggable = true;

      // Type Badge & Metadata
      let typeBadge = "";
      let timeMeta = "";

      if (item.type === "task") {
        const isFocus = item.tier === "focus";
        typeBadge = `<span class="simplified-badge ${isFocus ? 'badge-focus' : 'badge-trivial'}">${isFocus ? '🎯 Focus' : '⚡ Trivial'}</span>`;
        const timeDisplay = item.due_date_military || (item.due_date ? (item.due_date.includes(" ") ? item.due_date.split(" ")[1].slice(0, 5) : item.due_date.slice(11, 16)) : '');
        if (timeDisplay) {
          timeMeta = `<span class="simplified-meta-time font-mono">⏱ ${timeDisplay}</span>`;
        }
      } else if (item.type === "event") {
        typeBadge = `<span class="simplified-badge badge-event">📅 Event</span>`;
        if (item.start_time) {
          const time = item.start_time.includes(" ") ? item.start_time.split(" ")[1].slice(0, 5) : item.start_time.slice(11, 16);
          timeMeta = `<span class="simplified-meta-time font-mono">🕒 ${time || ''}</span>`;
        }
      } else if (item.type === "reminder") {
        typeBadge = `<span class="simplified-badge badge-reminder">🔔 Reminder</span>`;
        if (item.reminder_date) {
          timeMeta = `<span class="simplified-meta-time font-mono">⏰ ${item.reminder_date.slice(11, 16) || ''}</span>`;
        }
      }

      const projectTag = item.project_name ? `
        <span class="project-tag" style="--tag-color: ${item.color || '#3b82f6'}; font-size: 11px;">
          ${this.escapeHtml(item.project_name)}
        </span>
      ` : "";

      const timeSensitiveTag = item.is_time_sensitive ? `
        <span class="time-sensitive-badge" style="font-size: 10px; padding: 2px 7px;">⚡ TIME SENSITIVE</span>
      ` : "";

      let checkbox = "";
      if (item.type === "task") {
        checkbox = `
          <button type="button" class="simplified-check-btn ${isDone ? 'checked' : ''}" onclick="SimplifiedMode.toggleTask(${item.id}, '${item.status}')" title="Toggle task status">
            ${isDone ? '✓' : ''}
          </button>
        `;
      } else if (item.type === "event") {
        checkbox = `
          <button type="button" class="simplified-check-btn ${isDone ? 'checked' : ''}" onclick="SimplifiedMode.toggleEvent(${item.id}, '${item.status}')" title="Toggle event status">
            ${isDone ? '✓' : ''}
          </button>
        `;
      } else if (item.type === "reminder") {
        checkbox = `
          <button type="button" class="simplified-check-btn ${isDone ? 'checked' : ''}" onclick="SimplifiedMode.toggleReminder(${item.id})" title="Toggle reminder status">
            ${isDone ? '✓' : ''}
          </button>
        `;
      }

      card.innerHTML = `
        <div class="simplified-card-left">
          <div class="simplified-drag-handle" title="Drag to reorder priority sequence">≡</div>
          ${checkbox}
        </div>
        <div class="simplified-card-content" onclick="SimplifiedMode.inspectItem('${item.type}', ${item.id})">
          <div class="simplified-card-title ${isDone ? 'strikethrough' : ''}">
            ${this.escapeHtml(item.title)}
          </div>
          <div class="simplified-card-meta">
            ${typeBadge}
            ${projectTag}
            ${timeSensitiveTag}
            ${timeMeta}
          </div>
        </div>
      `;

      // Touch Drag & HTML5 Drag Events
      this.attachDragEvents(card, index);

      listEl.appendChild(card);
    });

    App.renderIcons();
  },

  attachDragEvents(card, index) {
    // HTML5 drag
    card.addEventListener("dragstart", (e) => {
      this.draggedItemIndex = index;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".simplified-card").forEach(c => c.classList.remove("drag-over"));
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const fromIndex = this.draggedItemIndex;
      const toIndex = index;
      if (fromIndex !== null && fromIndex !== toIndex) {
        this.reorderItems(fromIndex, toIndex);
      }
    });

    // Touch events for mobile dragging
    const handle = card.querySelector(".simplified-drag-handle");
    if (!handle) return;

    handle.addEventListener("touchstart", (e) => {
      this.draggedItemIndex = index;
      card.classList.add("dragging");
      if (typeof App !== "undefined" && App.haptic) App.haptic("light");
    }, { passive: true });

    handle.addEventListener("touchmove", (e) => {
      const touchY = e.touches[0].clientY;
      const elementBelow = document.elementFromPoint(e.touches[0].clientX, touchY);
      const targetCard = elementBelow ? elementBelow.closest(".simplified-card") : null;

      document.querySelectorAll(".simplified-card").forEach(c => c.classList.remove("drag-over"));
      if (targetCard && targetCard !== card) {
        targetCard.classList.add("drag-over");
        this.currentOverCard = targetCard;
      }
    }, { passive: true });

    handle.addEventListener("touchend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".simplified-card").forEach(c => c.classList.remove("drag-over"));
      if (this.currentOverCard) {
        const toIndex = parseInt(this.currentOverCard.dataset.index, 10);
        if (!isNaN(toIndex) && toIndex !== this.draggedItemIndex) {
          this.reorderItems(this.draggedItemIndex, toIndex);
        }
      }
      this.currentOverCard = null;
      this.draggedItemIndex = null;
    });
  },

  async reorderItems(fromIndex, toIndex) {
    const moved = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, moved);
    this.render();
    if (typeof App !== "undefined" && App.haptic) App.haptic("medium");

    const targetDate = this.getTargetDate();

    // Sync rearranged items into daily_orders priority sequence
    const newDailyOrder = this.items.map(item => ({
      id: item.id,
      type: item.type,
      title: item.title,
      tier: item.tier || item.type,
      time: item.due_date || item.start_time || ""
    }));

    if (typeof Dashboard !== "undefined") {
      Dashboard.dailyOrder = newDailyOrder;
      Dashboard.renderDailyOrder();
      Dashboard.saveDailyOrder();
    } else {
      try {
        await fetch("/api/daily-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: targetDate,
            order: newDailyOrder
          })
        });
      } catch (e) {
        console.warn("Failed to persist daily order from simplified mode:", e);
      }
    }
  },

  async toggleTask(taskId, currentStatus) {
    if (typeof Dashboard !== "undefined" && Dashboard.toggleTaskStatus) {
      await Dashboard.toggleTaskStatus(taskId, currentStatus);
      await this.refresh();
    } else {
      const newStatus = currentStatus === "completed" ? "pending" : "completed";
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      await this.refresh();
    }
  },

  async toggleEvent(eventId, currentStatus) {
    if (typeof Dashboard !== "undefined" && Dashboard.toggleEventStatus) {
      await Dashboard.toggleEventStatus(eventId, currentStatus);
      await this.refresh();
    } else {
      const newStatus = currentStatus === "completed" ? "scheduled" : "completed";
      await fetch(`/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      await this.refresh();
    }
  },

  async toggleReminder(reminderId) {
    if (typeof Dashboard !== "undefined" && Dashboard.toggleReminderStatus) {
      await Dashboard.toggleReminderStatus(reminderId);
      await this.refresh();
    } else {
      await fetch(`/api/reminders/${reminderId}/toggle`, { method: "POST" });
      await this.refresh();
    }
  },

  inspectItem(type, id) {
    if (typeof EntityModal !== "undefined" && EntityModal.open) {
      EntityModal.open(type, id);
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
  }
};

window.SimplifiedMode = SimplifiedMode;
document.addEventListener("DOMContentLoaded", () => {
  SimplifiedMode.init();
});
