/**
 * PETTR Exploded View Module
 * Supports interactive 3D Constellation Cloud and structured Project Cards
 * with School / External pool filtering, collapsible descriptions, and direct task creation.
 */
const Exploded = {
  activeView: "mindmap", // "mindmap" or "cards"
  cardFilter: "all",     // "all", "school", "external", "split"
  collapsedDescs: new Set(),
  lastData: null,

  async init() {
    this.bindControls();
    if (typeof Mindmap !== "undefined") {
      await Mindmap.init();
    }
    await this.refresh();
  },

  bindControls() {
    document.querySelectorAll(".exploded-view-toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".exploded-view-toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.switchView(btn.dataset.view);
      });
    });
  },

  switchView(viewName) {
    this.activeView = viewName;
    const mindmapContainer = document.getElementById("mindmapViewContainer");
    const cardsWrapper = document.getElementById("explodedCardsWrapper");
    const cardsContainer = document.getElementById("explodedGrid");

    if (viewName === "mindmap") {
      if (mindmapContainer) mindmapContainer.style.display = "block";
      if (cardsWrapper) cardsWrapper.style.display = "none";
      if (cardsContainer) cardsContainer.style.display = "none";
      if (typeof Mindmap !== "undefined") {
        Mindmap.resize();
        Mindmap.draw();
      }
    } else {
      if (mindmapContainer) mindmapContainer.style.display = "none";
      if (cardsWrapper) cardsWrapper.style.display = "flex";
      if (cardsContainer) cardsContainer.style.display = "grid";
      if (this.lastData) {
        this.render(this.lastData);
      }
    }
  },

  setCardFilter(filterName, btnEl) {
    this.cardFilter = filterName;
    document.querySelectorAll(".project-filter-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    if (this.lastData) {
      this.render(this.lastData);
    }
  },

  toggleDesc(projectId) {
    if (this.collapsedDescs.has(projectId)) {
      this.collapsedDescs.delete(projectId);
    } else {
      this.collapsedDescs.add(projectId);
    }
    const el = document.getElementById(`p-desc-${projectId}`);
    const btn = document.getElementById(`p-desc-btn-${projectId}`);
    if (el) {
      el.style.display = this.collapsedDescs.has(projectId) ? "none" : "block";
    }
    if (btn) {
      btn.textContent = this.collapsedDescs.has(projectId) ? "▸ Show description" : "▾ Collapse description";
    }
  },

  async refresh() {
    try {
      const res = await fetch("/api/exploded");
      if (!res.ok) return;
      const data = await res.json();
      this.lastData = data;
      this.updateProjectPoolCounter(data);
      this.render(data);
      if (typeof Mindmap !== "undefined") {
        await Mindmap.refresh();
      }
    } catch (err) {
      console.error("Error loading exploded view:", err);
    }
  },

  updateProjectPoolCounter(data) {
    const projects = data.projects || [];
    const total = projects.length;
    const schoolCount = projects.filter(p => (p.category || "External").toLowerCase() === "school").length;
    const extCount = projects.filter(p => (p.category || "External").toLowerCase() !== "school").length;

    const badge = document.getElementById("explodedProjectCountBadge");
    if (badge) {
      badge.textContent = `${total} Projects (${schoolCount} School · ${extCount} External)`;
    }

    const note = document.getElementById("explodedCardCountNote");
    if (note) {
      note.textContent = `${total} active pool projects · ${schoolCount} school · ${extCount} external`;
    }
  },

  async deleteProject(projectId, projectName) {
    if (!confirm(`Are you sure you want to delete project "${projectName}"?\n\nAttached tasks will be kept as standalone backlog items.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        App.showToast(`Project "${projectName}" deleted.`);
        await this.refresh();
        Dashboard.refresh();
      } else {
        App.showToast("Failed to delete project.", true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error deleting project.", true);
    }
  },

  render(data) {
    const grid = document.getElementById("explodedGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const allProjects = data.projects || [];
    const schoolProjects = allProjects.filter(p => (p.category || "External").toLowerCase() === "school");
    const extProjects = allProjects.filter(p => (p.category || "External").toLowerCase() !== "school");

    // Case 1: Side-by-side segregated pools
    if (this.cardFilter === "split") {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";

      // Pool 1: School Projects
      const schoolCol = document.createElement("div");
      schoolCol.style.display = "flex";
      schoolCol.style.flexDirection = "column";
      schoolCol.style.gap = "14px";
      schoolCol.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--card-border);">
          <span style="font-weight: 800; font-size: 14px; color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
            🎓 School Projects Pool
          </span>
          <span class="panel-count-badge">${schoolProjects.length}</span>
        </div>
      `;
      if (schoolProjects.length === 0) {
        schoolCol.innerHTML += '<div style="font-size: 13px; color: var(--text-muted); padding: 16px 0; text-align: center;">No school projects currently.</div>';
      } else {
        schoolProjects.forEach(p => schoolCol.appendChild(this.buildProjectCard(p)));
      }
      grid.appendChild(schoolCol);

      // Pool 2: External Projects
      const extCol = document.createElement("div");
      extCol.style.display = "flex";
      extCol.style.flexDirection = "column";
      extCol.style.gap = "14px";
      extCol.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--card-border);">
          <span style="font-weight: 800; font-size: 14px; color: var(--focus-indigo); display: flex; align-items: center; gap: 6px;">
            🌐 External Projects Pool
          </span>
          <span class="panel-count-badge">${extProjects.length}</span>
        </div>
      `;
      if (extProjects.length === 0) {
        extCol.innerHTML += '<div style="font-size: 13px; color: var(--text-muted); padding: 16px 0; text-align: center;">No external projects currently.</div>';
      } else {
        extProjects.forEach(p => extCol.appendChild(this.buildProjectCard(p)));
      }
      grid.appendChild(extCol);

    } else {
      // Standard Grid View (Filtered by all, school, or external)
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";

      let filteredProjects = allProjects;
      if (this.cardFilter === "school") {
        filteredProjects = schoolProjects;
      } else if (this.cardFilter === "external") {
        filteredProjects = extProjects;
      }

      if (filteredProjects.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 36px 0; font-size: 13px;">No projects found matching this filter.</div>';
      } else {
        filteredProjects.forEach(p => {
          grid.appendChild(this.buildProjectCard(p));
        });
      }
    }

    // Standalone Tasks Backlog Card (always show if available and on 'all' filter)
    if (this.cardFilter === "all" && data.standalone_tasks && data.standalone_tasks.length > 0) {
      const card = document.createElement("div");
      card.className = "project-card";
      card.innerHTML = `
        <div class="project-card-header">
          <span class="project-card-title" style="color: #cbd5e1;">📋 Standalone Backlog</span>
          <span style="font-size: 12px; color: var(--text-muted);">${data.standalone_tasks.length} items</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${data.standalone_tasks.map(t => `
            <div onclick="EntityModal.open('task', ${t.id})" title="Click to view details or re-sort" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 13px; background: var(--bg-primary); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 6px;">
              <span style="${t.status === 'completed' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                ${t.tier === 'focus' ? '🎯' : '⚡'} ${this.escapeHtml(t.title)}
              </span>
              <span class="urgency-badge ${t.urgency ? t.urgency.level : 'none'}">${t.urgency ? t.urgency.label : ''}</span>
            </div>
          `).join('')}
        </div>
      `;
      grid.appendChild(card);
    }
  },

  buildProjectCard(p) {
    const total = p.tasks.length;
    const done = p.tasks.filter(t => t.status === "completed").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isCollapsed = this.collapsedDescs.has(p.id);
    const isSchool = (p.category || "External").toLowerCase() === "school";
    const categoryBadge = isSchool ? "🎓 School" : "🌐 External";
    const pColor = p.color || (isSchool ? "#ec4899" : "#3b82f6");

    const card = document.createElement("div");
    card.className = "project-card";
    card.style.borderTop = `3px solid ${pColor}`;
    card.innerHTML = `
      <div class="project-card-header" style="cursor: pointer;" onclick="EntityModal.open('project', ${p.id})" title="Click to edit project details">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="project-card-title">${this.escapeHtml(p.name)}</span>
            <span class="project-tag" style="background: ${pColor}22; color: ${pColor}; border-color: ${pColor}55;">${categoryBadge}</span>
          </div>
          ${p.description ? `
            <div style="margin-top: 4px;">
              <div id="p-desc-${p.id}" style="font-size: 12px; color: var(--text-muted); line-height: 1.4; ${isCollapsed ? 'display: none;' : ''}">${this.escapeHtml(p.description)}</div>
              <button id="p-desc-btn-${p.id}" class="action-icon-btn" onclick="event.stopPropagation(); Exploded.toggleDesc(${p.id})" style="font-size: 10px; padding: 2px 6px; margin-top: 4px; border: none; background: transparent; color: var(--accent-cyan);">
                ${isCollapsed ? '▸ Show description' : '▾ Collapse description'}
              </button>
            </div>
          ` : ''}
        </div>
        <span style="font-size: 12px; font-weight: 700; color: var(--accent-cyan); white-space: nowrap;">${pct}% Done</span>
      </div>

      <div style="background: var(--bg-tertiary); height: 6px; border-radius: 3px; margin: 10px 0 14px 0; overflow: hidden;">
        <div style="background: ${pColor}; width: ${pct}%; height: 100%; transition: width 0.3s ease;"></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${p.tasks.length === 0 ? '<div style="font-size: 12px; color: var(--text-muted); font-style: italic;">No tasks in this project yet.</div>' : ''}
        ${p.tasks.map(t => `
          <div onclick="EntityModal.open('task', ${t.id})" title="Click to view details or re-sort" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 13px; background: var(--bg-primary); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 6px; transition: border-color 0.15s ease;">
            <span style="${t.status === 'completed' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
              ${t.tier === 'focus' ? '🎯' : '⚡'} ${this.escapeHtml(t.title)}
            </span>
            <span class="urgency-badge ${t.urgency ? t.urgency.level : 'none'}">${t.urgency ? t.urgency.label : (t.due_date ? '' : 'No due date')}</span>
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--card-border); padding-top: 10px;">
        <div style="display: flex; gap: 6px;">
          <button class="action-icon-btn" onclick="Dashboard.promptAddTaskToProject('${this.escapeHtml(p.name)}')">+ Add Task</button>
          <button class="action-icon-btn" onclick="Dashboard.completeProject(${p.id}, '${this.escapeHtml(p.name)}')" style="color: var(--accent-green); font-weight: 600;" title="Wrap up and mark project complete">✓ Complete</button>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="action-icon-btn" onclick="EntityModal.open('project', ${p.id})" title="Edit project">Settings →</button>
          <button class="action-icon-btn" onclick="Exploded.deleteProject(${p.id}, '${this.escapeHtml(p.name)}')" style="color: var(--urgent-orange);" title="Delete Project">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </div>
      </div>
    `;
    return card;
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
