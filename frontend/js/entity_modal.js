/**
 * PETTR Universal Entity Detail & Re-sorting Modal
 * Allows inspecting, adding extra details to, and reclassifying any tracked item.
 */
const EntityModal = {
  currentEntity: null,
  fromType: null,
  fromId: null,

  async open(entityType, entityId) {
    this.fromType = entityType;
    this.fromId = entityId;

    try {
      const res = await fetch(`/api/entities/${entityType}/${entityId}`);
      if (!res.ok) {
        App.showToast("Could not load item details.");
        return;
      }
      const data = await res.json();
      this.currentEntity = data.entity;
      await this.render();
      document.getElementById("entityModalOverlay").style.display = "flex";
    } catch (err) {
      console.error("Error opening entity modal:", err);
    }
  },

  close() {
    document.getElementById("entityModalOverlay").style.display = "none";
    this.currentEntity = null;
  },

  async render() {
    const e = this.currentEntity;
    const type = this.fromType;

    // Load active projects for dropdown
    const projRes = await fetch("/api/projects");
    const projects = await projRes.json();

    document.getElementById("entityModalTitle").value = e.title || e.name || "";
    document.getElementById("entityModalDesc").value = e.description || e.details || "";
    
    // Set type switcher buttons
    const activeTier = e.tier || (type === "task" ? "focus" : null);
    document.querySelectorAll(".type-pill-btn").forEach(btn => {
      const targetType = btn.dataset.type;
      const targetTier = btn.dataset.tier;
      if (targetType === type && (!targetTier || targetTier === activeTier)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Populate projects dropdown
    const projSelect = document.getElementById("entityModalProject");
    projSelect.innerHTML = '<option value="">-- No Project (Standalone) --</option>';
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.textContent = p.name;
      if (e.project_name === p.name || e.name === p.name) opt.selected = true;
      projSelect.appendChild(opt);
    });

    // Date / Time
    const rawDate = e.due_date || e.start_time || e.reminder_date || "";
    const dateInput = document.getElementById("entityModalDueDate");
    dateInput.value = this.formatForInput(rawDate);

    // Status
    const statusSelect = document.getElementById("entityModalStatus");
    statusSelect.value = e.status || "pending";

    // Recurrence
    const recurrenceSelect = document.getElementById("entityModalRecurrence");
    if (recurrenceSelect) {
      recurrenceSelect.value = e.recurrence || "";
    }
  },

  formatForInput(raw) {
    if (!raw) return "";
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      return str.slice(0, 16);
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
      return str.replace(" ", "T").slice(0, 16);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return "";
  },

  setPreset(preset) {
    const input = document.getElementById("entityModalDueDate");
    if (!input) return;
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

  selectType(btn) {
    document.querySelectorAll(".type-pill-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  },

  async saveChanges() {
    const activeBtn = document.querySelector(".type-pill-btn.active");
    const toType = activeBtn ? activeBtn.dataset.type : this.fromType;
    const toTier = activeBtn ? activeBtn.dataset.tier || "focus" : "focus";

    const title = document.getElementById("entityModalTitle").value.trim();
    if (!title) {
      alert("Title cannot be empty.");
      return;
    }

    const description = document.getElementById("entityModalDesc").value;
    const projectName = document.getElementById("entityModalProject").value || null;
    const dueDateRaw = document.getElementById("entityModalDueDate").value.trim();
    const dueDate = dueDateRaw ? dueDateRaw.replace("T", " ") : null;
    const status = document.getElementById("entityModalStatus").value;
    const recurrenceEl = document.getElementById("entityModalRecurrence");
    const recurrence = recurrenceEl ? (recurrenceEl.value.trim() || null) : null;

    try {
      const res = await fetch("/api/entities/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_type: this.fromType,
          from_id: this.fromId,
          to_type: toType,
          title: title,
          description: description,
          project_name: projectName,
          tier: toTier,
          due_date: dueDate,
          status: status,
          recurrence: recurrence
        })
      });

      const data = await res.json();
      if (res.ok) {
        App.showToast("Changes saved successfully!");
        this.close();
        // Refresh active tab views
        Dashboard.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
      } else {
        alert(data.detail || "Error updating item.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error updating item.");
    }
  },

  async deleteEntity() {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      let endpoint = `/api/tasks/${this.fromId}`;
      if (this.fromType === "event") endpoint = `/api/events/${this.fromId}`;
      else if (this.fromType === "reminder") endpoint = `/api/reminders/${this.fromId}`;

      await fetch(endpoint, { method: "DELETE" });
      App.showToast("Item deleted.");
      this.close();
      Dashboard.refresh();
      if (typeof Timeline !== "undefined") Timeline.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
      if (typeof Exploded !== "undefined") Exploded.refresh();
    } catch (err) {
      console.error(err);
    }
  }
};
