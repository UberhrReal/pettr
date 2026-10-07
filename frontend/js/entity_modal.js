/**
 * PETTR Universal Entity Detail & Re-sorting Modal
 * Allows inspecting, adding extra details to, and reclassifying any tracked item.
 * Supports Project color tags, School/External categories, and Unorganized Queue manual triage.
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
      App.renderIcons();
    } catch (err) {
      console.error("Error opening entity modal:", err);
    }
  },

  close() {
    const overlay = document.getElementById("entityModalOverlay");
    if (overlay) overlay.style.display = "none";
    this.currentEntity = null;
  },

  async render() {
    const e = this.currentEntity;
    const type = this.fromType;

    // Load active projects for dropdown
    const projRes = await fetch("/api/projects");
    const projects = projRes.ok ? await projRes.json() : [];

    // Title & description (supporting unorganized raw input)
    const titleVal = e.title || e.name || e.raw_input || "";
    const descVal = e.description || e.details || (type === "unorganized" && e.reasoning ? `[Unorganized Routing Note: ${e.reasoning}]` : "");
    document.getElementById("entityModalTitle").value = titleVal;
    document.getElementById("entityModalDesc").value = descVal;
    
    // Set type switcher buttons
    let activeType = type;
    let activeTier = e.tier || (type === "task" ? "focus" : null);

    if (type === "unorganized") {
      activeType = e.suggested_type || "task";
      activeTier = e.suggested_tier || "focus";
    }

    document.querySelectorAll(".type-pill-btn").forEach(btn => {
      const targetType = btn.dataset.type;
      const targetTier = btn.dataset.tier;
      if (targetType === activeType && (!targetTier || targetTier === activeTier)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Populate projects dropdown
    const projSelect = document.getElementById("entityModalProject");
    projSelect.innerHTML = '<option value="">-- No Project (Standalone) --</option>';
    const assignedProj = e.project_name || e.suggested_project || (type === "project" ? e.name : null);
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      opt.textContent = `${(p.category || 'External') === 'School' ? '🎓' : '🌐'} ${p.name}`;
      if (assignedProj === p.name) opt.selected = true;
      projSelect.appendChild(opt);
    });

    // Date / Time
    const rawDate = e.due_date || e.start_time || e.reminder_date || e.parsed_date || "";
    const dateInput = document.getElementById("entityModalDueDate");
    dateInput.value = this.formatForInput(rawDate);

    // Status
    const statusSelect = document.getElementById("entityModalStatus");
    if (activeType === "event") {
      statusSelect.innerHTML = `
        <option value="scheduled">Scheduled</option>
        <option value="completed">Completed</option>
      `;
      statusSelect.value = (e.status === "completed") ? "completed" : "scheduled";
    } else {
      statusSelect.innerHTML = `
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
      `;
      statusSelect.value = (e.status === "completed") ? "completed" : "pending";
    }

    // Recurrence
    const recurrenceSelect = document.getElementById("entityModalRecurrence");
    if (recurrenceSelect) {
      recurrenceSelect.value = e.recurrence || "";
    }

    // Time-sensitive toggle
    const tsCheckbox = document.getElementById("entityModalTimeSensitive");
    if (tsCheckbox) {
      tsCheckbox.checked = Boolean(e.is_time_sensitive || (e.urgency && e.urgency.level === "urgent"));
    }

    // Project Category & Color Tag Row
    const projectOptsRow = document.getElementById("entityModalProjectOptionsRow");
    if (projectOptsRow) {
      if (activeType === "project") {
        projectOptsRow.style.display = "block";
        const catSelect = document.getElementById("entityModalCategory");
        if (catSelect) catSelect.value = e.category || "External";

        const colorPicker = document.getElementById("entityModalColorPicker");
        if (colorPicker) colorPicker.value = e.color || "#3b82f6";

        // Render Quick Color Palette
        const paletteContainer = document.getElementById("entityModalColorPalette");
        if (paletteContainer) {
          const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#e11d48", "#84cc16"];
          paletteContainer.innerHTML = palette.map(hex => `
            <button type="button" style="width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--card-border); background: ${hex}; cursor: pointer; transition: transform 0.1s ease;" onclick="document.getElementById('entityModalColorPicker').value='${hex}'; App.haptic('light');"></button>
          `).join('');
        }
      } else {
        projectOptsRow.style.display = "none";
      }
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
    document.querySelectorAll("#entityModalOverlay .type-pill-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const targetType = btn.dataset.type;
    const projectOptsRow = document.getElementById("entityModalProjectOptionsRow");
    if (projectOptsRow) {
      projectOptsRow.style.display = targetType === "project" ? "block" : "none";
    }
    const statusSelect = document.getElementById("entityModalStatus");
    if (statusSelect) {
      const isCompleted = statusSelect.value === "completed";
      if (targetType === "event") {
        statusSelect.innerHTML = `
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        `;
        statusSelect.value = isCompleted ? "completed" : "scheduled";
      } else {
        statusSelect.innerHTML = `
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        `;
        statusSelect.value = isCompleted ? "completed" : "pending";
      }
    }
  },

  async returnToUnorganized() {
    if (!confirm("Return this item back to the Unorganized Queue for manual triage?")) return;
    try {
      const res = await fetch("/api/entities/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_type: this.fromType,
          from_id: this.fromId,
          to_type: "unorganized",
          title: document.getElementById("entityModalTitle").value.trim() || (this.currentEntity.title || "Untitled"),
          description: document.getElementById("entityModalDesc").value || "",
          due_date: document.getElementById("entityModalDueDate").value.trim() || null,
          project_name: document.getElementById("entityModalProject").value || null
        })
      });
      if (res.ok) {
        App.showToast("Item returned to Unorganized Queue!");
        this.close();
        if (typeof Dashboard !== "undefined") Dashboard.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
      } else {
        App.showToast("Failed to return item to unorganized queue", true);
      }
    } catch (e) {
      console.error(e);
      App.showToast("Network error returning item", true);
    }
  },

  async saveChanges() {
    const activeBtn = document.querySelector("#entityModalOverlay .type-pill-btn.active");
    const toType = activeBtn ? activeBtn.dataset.type : (this.fromType === "unorganized" ? "task" : this.fromType);
    const toTier = activeBtn ? activeBtn.dataset.tier || "focus" : "focus";

    const title = document.getElementById("entityModalTitle").value.trim();
    if (!title) {
      alert("Title cannot be empty.");
      return;
    }

    const description = document.getElementById("entityModalDesc").value;
    const projectName = document.getElementById("entityModalProject").value || null;
    const dueDateRaw = document.getElementById("entityModalDueDate").value.trim();
    let dueDate = dueDateRaw ? dueDateRaw.replace("T", " ") : null;
    if (dueDate && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(dueDate)) {
      dueDate += ":00";
    }

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (this.fromType === "unorganized") {
      if (!dueDate && toType === "task" && !projectName) {
        dueDate = `${todayStr} 23:59:00`;
      } else if (dueDate && dueDate.split(" ")[0] < todayStr) {
        dueDate = `${todayStr} 23:59:00`;
      }
    }

    const rawStatus = document.getElementById("entityModalStatus").value;
    let status = rawStatus;
    if (toType === "event") {
      status = (rawStatus === "completed") ? "completed" : "scheduled";
    } else if (toType === "task") {
      status = (rawStatus === "completed") ? "completed" : "pending";
    }
    const recurrenceEl = document.getElementById("entityModalRecurrence");
    const recurrence = recurrenceEl ? (recurrenceEl.value.trim() || null) : null;

    let color = null;
    let category = null;
    if (toType === "project") {
      const catSelect = document.getElementById("entityModalCategory");
      if (catSelect) category = catSelect.value || "External";
      const colorPicker = document.getElementById("entityModalColorPicker");
      if (colorPicker) color = colorPicker.value || null;
    }

    const tsCheckbox = document.getElementById("entityModalTimeSensitive");
    const isTimeSensitive = tsCheckbox ? tsCheckbox.checked : false;

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
          recurrence: recurrence,
          color: color,
          category: category,
          is_time_sensitive: isTimeSensitive
        })
      });

      const data = await res.json();
      if (res.ok) {
        App.showToast("Changes saved successfully!");
        this.close();
        if (this.fromType === "unorganized" && typeof Dashboard !== "undefined") {
          Dashboard.closeUnorganizedModal();
        }
        // Refresh active views
        if (typeof Dashboard !== "undefined") Dashboard.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
        if (typeof SimplifiedMode !== "undefined") SimplifiedMode.refresh();
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
      else if (this.fromType === "project") endpoint = `/api/projects/${this.fromId}`;
      else if (this.fromType === "unorganized") endpoint = `/api/unorganized/${this.fromId}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        App.showToast("Item deleted.");
        this.close();
        if (typeof Dashboard !== "undefined") {
          Dashboard.refresh();
          Dashboard.closeUnorganizedModal();
        }
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
        if (typeof SimplifiedMode !== "undefined") SimplifiedMode.render();
      } else {
        App.showToast("Failed to delete item.", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error deleting item.", true);
    }
  }
};
