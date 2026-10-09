/**
 * PETTR Archive & History Module
 * Displays completed projects, finished tasks, inactive reminders, and raw ingestion audit logs
 */
const History = {
  auditLogVisible: false,

  async init() {
    await this.refresh();
  },

  async refresh() {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) return;
      const data = await res.json();
      
      const archive = Array.isArray(data)
        ? { completed_projects: [], completed_tasks: [], inactive_reminders: [], audit_log: data }
        : data;

      this.renderProjects(archive.completed_projects || []);
      this.renderTasks(archive.completed_tasks || []);
      this.renderReminders(archive.inactive_reminders || []);
      this.renderAuditLog(archive.audit_log || []);
    } catch (err) {
      console.error("Error loading history archive:", err);
    }
  },

  renderProjects(projects) {
    const container = document.getElementById("historyProjectsList");
    const countBadge = document.getElementById("historyCountProjects");
    if (countBadge) countBadge.textContent = `${projects.length} completed`;
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px dashed var(--card-border);">
          No completed projects yet. When you wrap up a project, it will be safely archived here.
        </div>
      `;
      return;
    }

    container.innerHTML = projects.map(proj => `
      <div class="history-item-card" style="background: var(--bg-secondary); border: 1px solid var(--card-border); border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
            <span class="project-tag" style="background: ${proj.color || '#3b82f6'}22; color: ${proj.color || '#3b82f6'}; border-color: ${proj.color || '#3b82f6'}55; font-size: 13px; font-weight: 700;">
              📁 ${this.escapeHtml(proj.name)}
            </span>
            <span style="font-size: 12px; color: var(--text-muted);">
              Completed: ${proj.completed_at_military || 'Archived'}
            </span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            ${proj.completed_tasks_count || 0} / ${proj.total_tasks_count || 0} tasks completed
            ${proj.description ? ` · <span style="color: var(--text-dim);">${this.escapeHtml(proj.description)}</span>` : ''}
          </div>
        </div>
        <button class="action-icon-btn" onclick="History.reopenProject(${proj.id}, '${this.escapeHtml(proj.name)}')" title="Restore project back to active tracking" style="font-size: 12px; font-weight: 600;">
          ↩ Reopen Project
        </button>
      </div>
    `).join("");
  },

  toggleAllDays(expand) {
    const panels = document.querySelectorAll("#historyTasksList details.history-day-subpanel");
    panels.forEach(p => { p.open = expand; });
    App.haptic('light');
  },

  formatDayLabel(dateStr) {
    if (!dateStr || dateStr === "Earlier") return "Earlier Completed Tasks";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yestStr = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;

        const dayName = d.toLocaleDateString("en-GB", { weekday: "long" });
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString("en-GB", { month: "short" });
        const year = d.getFullYear();

        if (dateStr === todayStr) {
          return `Today · ${dayNum} ${monthName} ${year} (${dayName})`;
        } else if (dateStr === yestStr) {
          return `Yesterday · ${dayNum} ${monthName} ${year} (${dayName})`;
        } else {
          return `${dayNum} ${monthName} ${year} (${dayName})`;
        }
      }
    } catch (_) {}
    return dateStr;
  },

  renderTasks(tasks) {
    const container = document.getElementById("historyTasksList");
    const countBadge = document.getElementById("historyCountTasks");
    if (countBadge) countBadge.textContent = `${tasks.length} completed (30-day window)`;
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px dashed var(--card-border);">
          No finished tasks in the 30-day archive window. Tasks completed within the last 30 days appear here organised by day of completion.
        </div>
      `;
      return;
    }

    // 1. Group tasks by completion day
    const dayGroups = new Map();
    tasks.forEach(task => {
      let dayKey = "Earlier";
      const rawComp = task.completed_at || task.due_date;
      if (rawComp) {
        const match = String(rawComp).match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
          dayKey = match[1];
        }
      }
      if (!dayGroups.has(dayKey)) {
        dayGroups.set(dayKey, []);
      }
      dayGroups.get(dayKey).push(task);
    });

    // 2. Sort day keys descending (newest day first)
    const sortedDayKeys = Array.from(dayGroups.keys()).sort((a, b) => {
      if (a === "Earlier") return 1;
      if (b === "Earlier") return -1;
      return b.localeCompare(a);
    });

    // 3. Render collapsible sub-panel for each day
    container.innerHTML = sortedDayKeys.map((dayKey, index) => {
      const dayTasks = dayGroups.get(dayKey) || [];
      const dayLabel = this.formatDayLabel(dayKey);
      // Default first 2 most recent days to open, older days collapsed
      const isOpen = index < 2 ? "open" : "";

      const tasksCardsHtml = dayTasks.map(task => `
        <div class="task-card completed-task-card" style="opacity: 0.9; border-color: var(--card-border); background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                <span class="tier-badge ${task.tier}">${task.tier === 'focus' ? '🎯 Focus' : '⚡ Trivial'}</span>
                ${task.project_name ? `<span class="project-tag" style="background: ${task.project_color || '#3b82f6'}22; color: ${task.project_color || '#3b82f6'}; border-color: ${task.project_color || '#3b82f6'}55;">📁 ${this.escapeHtml(task.project_name)}</span>` : ''}
                <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">Done: ${task.completed_at_military || 'Earlier'}</span>
              </div>
              <div class="completed-strike-title" style="text-decoration: line-through; color: var(--text-muted); font-size: 13.5px; font-weight: 600;">
                ${this.escapeHtml(task.title)}
              </div>
              ${task.description ? `<div style="font-size: 11.5px; color: var(--text-dim); margin-top: 4px;">${this.escapeHtml(task.description)}</div>` : ''}
            </div>
            <button class="action-icon-btn" onclick="History.reopenTask(${task.id}, '${this.escapeHtml(task.title)}')" title="Restore task to pending" style="font-size: 11px; font-weight: 600; white-space: nowrap;">
              ↩ Restore
            </button>
          </div>
        </div>
      `).join("");

      return `
        <details class="history-day-subpanel" ${isOpen} style="background: var(--bg-secondary); border: 1px solid var(--card-border); border-radius: var(--radius-sm); overflow: hidden; transition: all 0.2s ease;">
          <summary style="padding: 10px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none; background: var(--bg-tertiary); border-bottom: 1px solid var(--card-border);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="history-chevron-indicator" style="font-size: 11px; color: var(--text-muted); transition: transform 0.2s ease; display: inline-block;">▶</span>
              <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${this.escapeHtml(dayLabel)}</span>
            </div>
            <span class="panel-count-badge" style="font-size: 11px; font-weight: 600;">${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}</span>
          </summary>
          <div style="padding: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
            ${tasksCardsHtml}
          </div>
        </details>
      `;
    }).join("");

    if (window.lucide) {
      try { lucide.createIcons(); } catch (_) {}
    }
  },

  renderReminders(reminders) {
    const container = document.getElementById("historyRemindersList");
    const countBadge = document.getElementById("historyCountReminders");
    if (countBadge) countBadge.textContent = `${reminders.length} archived`;
    if (!container) return;

    if (reminders.length === 0) {
      container.innerHTML = `
        <div style="padding: 14px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px dashed var(--card-border);">
          No dismissed or inactive reminders in archive.
        </div>
      `;
      return;
    }

    container.innerHTML = reminders.map(rem => `
      <div class="reminder-card" style="opacity: 0.85; border-color: var(--card-border); display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
            <span style="font-size: 13px;">🔔</span>
            <span style="text-decoration: line-through; color: var(--text-muted); font-size: 13px; font-weight: 500;">
              ${this.escapeHtml(rem.title)}
            </span>
            ${rem.task_title ? `<span style="font-size: 11px; color: var(--text-dim);">[Attached: ${this.escapeHtml(rem.task_title)}]</span>` : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-dim);">
            Logged: ${rem.created_at_military || 'Earlier'} ${rem.details ? `· ${this.escapeHtml(rem.details)}` : ''}
          </div>
        </div>
        <button class="action-icon-btn" onclick="History.restoreReminder(${rem.id}, '${this.escapeHtml(rem.title)}')" title="Restore reminder back to active tracking" style="font-size: 11px; font-weight: 600; white-space: nowrap;">
          ↩ Restore
        </button>
      </div>
    `).join("");
  },

  renderAuditLog(items) {
    const container = document.getElementById("historyTableContainer");
    const countBadge = document.getElementById("historyCountAudit");
    if (countBadge) countBadge.textContent = `${items.length} entries`;
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); padding: 16px 0;">No ingestion audit history yet.</div>';
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 2px solid var(--card-border); color: var(--text-muted);">
            <th style="padding: 10px 8px;">Time</th>
            <th style="padding: 10px 8px;">Raw Input</th>
            <th style="padding: 10px 8px;">Extracted Date / Rule</th>
            <th style="padding: 10px 8px;">Classification & Reasoning</th>
            <th style="padding: 10px 8px;">Result Entity</th>
            <th style="padding: 10px 8px;">Status</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach(item => {
      const timeStr = item.created_at ? item.created_at.split(".")[0] : "";
      const classification = item.llm_classification || {};
      const statusColor = item.status === "success" ? "#22c55e" : (item.status === "unorganized" ? "#f97316" : "#ef4444");

      html += `
        <tr style="border-bottom: 1px solid var(--card-border);">
          <td style="padding: 10px 8px; color: var(--text-muted); white-space: nowrap;">${timeStr}</td>
          <td style="padding: 10px 8px; font-weight: 600; max-width: 250px;">"${this.escapeHtml(item.raw_input)}"</td>
          <td style="padding: 10px 8px; color: #38bdf8;">${item.extracted_date ? `📅 ${item.extracted_date}` : '<span style="color:var(--text-muted)">None</span>'}</td>
          <td style="padding: 10px 8px; max-width: 300px;">
            <div><strong>${classification.entity_type || item.target_entity_type}</strong> ${classification.task_tier ? `(${classification.task_tier})` : ''}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${classification.reasoning || ''}</div>
          </td>
          <td style="padding: 10px 8px;">
            <span class="project-tag">${item.target_entity_type} #${item.target_entity_id || ''}</span>
          </td>
          <td style="padding: 10px 8px;">
            <span style="color: ${statusColor}; font-weight: 700; text-transform: uppercase; font-size: 11px;">
              ${item.status}
            </span>
          </td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;
  },

  toggleAuditLog() {
    this.auditLogVisible = !this.auditLogVisible;
    const container = document.getElementById("historyTableContainer");
    const toggleBtn = document.getElementById("auditLogToggleBtn");
    if (container) {
      container.style.display = this.auditLogVisible ? "block" : "none";
    }
    if (toggleBtn) {
      toggleBtn.textContent = this.auditLogVisible ? "▴ Hide Log" : "▾ Toggle Log";
    }
  },

  async reopenProject(id, name) {
    try {
      const res = await fetch(`/api/projects/${id}/reopen`, { method: "POST" });
      if (res.ok) {
        App.showToast(`📁 Project "${name}" restored to active projects!`);
        await this.refresh();
        if (typeof Dashboard !== "undefined") Dashboard.refresh();
        if (typeof Exploded !== "undefined") Exploded.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
      } else {
        App.showToast("Failed to reopen project", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error reopening project", true);
    }
  },

  async reopenTask(id, title) {
    try {
      const res = await fetch(`/api/tasks/${id}/reopen`, { method: "POST" });
      if (res.ok) {
        App.showToast(`✓ Task "${title}" restored to pending!`);
        await this.refresh();
        if (typeof Dashboard !== "undefined") Dashboard.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
        if (typeof Mindmap !== "undefined") Mindmap.refresh();
      } else {
        App.showToast("Failed to restore task", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error restoring task", true);
    }
  },

  async restoreReminder(id, title) {
    try {
      const res = await fetch(`/api/reminders/${id}/toggle`, { method: "PATCH" });
      if (res.ok) {
        App.showToast(`🔔 Reminder "${title}" restored to active!`);
        await this.refresh();
        if (typeof Dashboard !== "undefined") Dashboard.refresh();
        if (typeof Timeline !== "undefined") Timeline.refresh();
      } else {
        App.showToast("Failed to restore reminder", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error restoring reminder", true);
    }
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.History = History;
