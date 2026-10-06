/**
 * PETTR Simplified Mode (Mobile Slide-Over)
 * Streamlined mobile view for Today's Agenda:
 * - See tasks, events, projects, and reminders for today
 * - Drag-and-drop / Touch-drag reordering synced to Priority Tasking list
 */
const SimplifiedMode = {
  isOpen: false,
  items: [],
  clockTimer: null,
  draggedItemIndex: null,

  init() {
    // Listen for resize; if width > 768, close if open
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && this.isOpen) {
        this.close();
      }
    });
  },

  async toggle() {
    if (this.isOpen) {
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
    // Trigger transition next frame
    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });

    this.startClock();
    await this.refresh();
    App.haptic("light");
  },

  close() {
    const overlay = document.getElementById("simplifiedModeOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    setTimeout(() => {
      overlay.style.display = "none";
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
    if (!listEl) return;

    listEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 13px;">Loading today's schedule...</div>`;

    try {
      const todayStr = (typeof Dashboard !== "undefined" && Dashboard.getTodayString) 
        ? Dashboard.getTodayString() 
        : new Date().toISOString().slice(0, 10);

      // Fetch today's snapshot
      const [dayRes, projRes] = await Promise.all([
        fetch(`/api/day/${todayStr}`),
        fetch("/api/projects")
      ]);

      const dayData = dayRes.ok ? await dayRes.json() : { tasks: { focus: [], trivial: [] }, appointments: [], reminders: [] };
      const projects = projRes.ok ? await projRes.json() : [];

      const focusTasks = (dayData.tasks && dayData.tasks.focus) || [];
      const trivialTasks = (dayData.tasks && dayData.tasks.trivial) || [];
      const appointments = dayData.appointments || [];
      const reminders = dayData.reminders || [];

      // Unified items list
      this.items = [];

      // 1. Focus Tasks
      focusTasks.forEach(t => {
        this.items.push({
          id: t.id,
          type: "task",
          tier: "focus",
          title: t.title,
          status: t.status || "pending",
          due_date: t.due_date,
          project_name: t.project_name,
          color: t.project_color || "#6366f1",
          order: t.order_index ?? 9999
        });
      });

      // 2. Trivial Tasks
      trivialTasks.forEach(t => {
        this.items.push({
          id: t.id,
          type: "task",
          tier: "trivial",
          title: t.title,
          status: t.status || "pending",
          due_date: t.due_date,
          project_name: t.project_name,
          color: t.project_color || "#10b981",
          order: t.order_index ?? 9999
        });
      });

      // 3. Events
      appointments.forEach(e => {
        this.items.push({
          id: e.id,
          type: "event",
          title: e.title,
          status: "scheduled",
          start_time: e.start_time,
          project_name: e.project_name,
          color: "#3b82f6"
        });
      });

      // 4. Reminders
      reminders.forEach(r => {
        this.items.push({
          id: r.id,
          type: "reminder",
          title: r.title,
          status: r.is_active ? "active" : "done",
          reminder_date: r.reminder_date,
          color: "#f59e0b"
        });
      });

      // 5. Active Projects with today activity or general focus
      projects.filter(p => p.status === "active").forEach(p => {
        this.items.push({
          id: p.id,
          type: "project",
          title: p.name,
          status: "active",
          category: p.category || "External",
          color: p.color || "#8b5cf6"
        });
      });

      if (countEl) {
        countEl.textContent = `${this.items.length} items scheduled`;
      }

      this.render();
    } catch (err) {
      console.error("SimplifiedMode load error:", err);
      listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--urgent-orange);">Failed to load schedule.</div>`;
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
      card.className = `simplified-card ${item.type} ${item.status === 'completed' ? 'completed' : ''}`;
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
        if (item.due_date) {
          const time = item.due_date.includes(" ") ? item.due_date.split(" ")[1].slice(0, 5) : item.due_date.slice(11, 16);
          timeMeta = `<span class="simplified-meta-time font-mono">⏱ ${time || ''}</span>`;
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
      } else if (item.type === "project") {
        typeBadge = `<span class="simplified-badge badge-project">${item.category === 'School' ? '🎓 School' : '🌐 Project'}</span>`;
      }

      const projectTag = item.project_name ? `
        <span class="project-tag" style="--tag-color: ${item.color || '#3b82f6'}; font-size: 11px;">
          ${this.escapeHtml(item.project_name)}
        </span>
      ` : "";

      const checkbox = item.type === "task" ? `
        <button type="button" class="simplified-check-btn ${item.status === 'completed' ? 'checked' : ''}" onclick="SimplifiedMode.toggleTask(${item.id}, '${item.status}')" title="Toggle status">
          ${item.status === 'completed' ? '✓' : ''}
        </button>
      ` : `<span class="simplified-type-icon" style="color: ${item.color};">•</span>`;

      card.innerHTML = `
        <div class="simplified-card-left">
          <div class="simplified-drag-handle" title="Drag to reorder">≡</div>
          ${checkbox}
        </div>
        <div class="simplified-card-content" onclick="SimplifiedMode.inspectItem('${item.type}', ${item.id})">
          <div class="simplified-card-title ${item.status === 'completed' ? 'strikethrough' : ''}">
            ${this.escapeHtml(item.title)}
          </div>
          <div class="simplified-card-meta">
            ${typeBadge}
            ${projectTag}
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

    let touchStartY = 0;
    let currentOverCard = null;

    handle.addEventListener("touchstart", (e) => {
      touchStartY = e.touches[0].clientY;
      this.draggedItemIndex = index;
      card.classList.add("dragging");
      App.haptic("light");
    }, { passive: true });

    handle.addEventListener("touchmove", (e) => {
      const touchY = e.touches[0].clientY;
      const elementBelow = document.elementFromPoint(e.touches[0].clientX, touchY);
      const targetCard = elementBelow ? elementBelow.closest(".simplified-card") : null;

      document.querySelectorAll(".simplified-card").forEach(c => c.classList.remove("drag-over"));
      if (targetCard && targetCard !== card) {
        targetCard.classList.add("drag-over");
        currentOverCard = targetCard;
      }
    }, { passive: true });

    handle.addEventListener("touchend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".simplified-card").forEach(c => c.classList.remove("drag-over"));
      if (currentOverCard) {
        const toIndex = parseInt(currentOverCard.dataset.index, 10);
        if (!isNaN(toIndex) && toIndex !== this.draggedItemIndex) {
          this.reorderItems(this.draggedItemIndex, toIndex);
        }
      }
      currentOverCard = null;
      this.draggedItemIndex = null;
    });
  },

  async reorderItems(fromIndex, toIndex) {
    const moved = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, moved);
    this.render();
    App.haptic("medium");

    // Extract task IDs in current order
    const taskIds = this.items.filter(item => item.type === "task").map(t => t.id);
    if (taskIds.length === 0) return;

    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: taskIds })
      });

      if (res.ok) {
        // Refresh dashboard background lists silently
        if (typeof Dashboard !== "undefined" && Dashboard.refresh) {
          Dashboard.refresh();
        }
      } else {
        console.warn("Tasks reorder sync failed");
      }
    } catch (err) {
      console.error("Reorder network error:", err);
    }
  },

  async toggleTask(taskId, currentStatus) {
    if (typeof Dashboard !== "undefined" && Dashboard.toggleTaskStatus) {
      await Dashboard.toggleTaskStatus(taskId, currentStatus);
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
