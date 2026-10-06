/**
 * PETTR Exploded View Module
 * Supports interactive 3D Constellation Cloud and structured Project Cards
 * with School / External pool filtering, collapsible descriptions, and direct task creation.
 */
const Exploded = {
  activeView: "mindmap", // "mindmap" or "cards"
  cardFilter: "split",   // "split", "all", "school", "external"
  cardSort: localStorage.getItem("pettr_exploded_card_sort") || "school_first", // "school_first", "external_first", "name"
  collapsedDescs: new Set(),
  lastData: null,

  async init() {
    this.bindControls();
    this.updateSortButtonsUI();
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
    const poolFilters = document.getElementById("explodedPoolFilters");
    const sortGroup = document.getElementById("explodedSortGroup");

    if (viewName === "mindmap") {
      if (mindmapContainer) mindmapContainer.style.display = "block";
      if (cardsWrapper) cardsWrapper.style.display = "none";
      if (cardsContainer) cardsContainer.style.display = "none";
      if (poolFilters) poolFilters.style.display = "none";
      if (sortGroup) sortGroup.style.display = "none";
      if (typeof Mindmap !== "undefined") {
        Mindmap.resize();
        Mindmap.draw();
      }
    } else {
      if (mindmapContainer) mindmapContainer.style.display = "none";
      if (cardsContainer) cardsContainer.style.display = "grid";
      if (cardsWrapper) cardsWrapper.style.display = "flex";
      if (poolFilters) poolFilters.style.display = "inline-flex";
      if (sortGroup) sortGroup.style.display = "inline-flex";
      this.updateSortButtonsUI();
      if (this.lastData) {
        this.render(this.lastData);
      }
      if (typeof App !== "undefined" && App.renderIcons) {
        App.renderIcons();
      } else if (typeof lucide !== "undefined" && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  },

  setPoolFilter(filterName, btnEl) {
    this.cardFilter = filterName;
    document.querySelectorAll(".exploded-pool-filter-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    if (this.lastData) {
      this.render(this.lastData);
    }
  },

  setCardFilter(filterName, btnEl) {
    this.setPoolFilter(filterName, btnEl);
  },

  setCardSort(sortType, btnEl) {
    this.cardSort = sortType;
    try {
      localStorage.setItem("pettr_exploded_card_sort", sortType);
    } catch (e) {}
    this.updateSortButtonsUI();
    if (this.lastData) {
      this.render(this.lastData);
    }
  },

  updateSortButtonsUI() {
    const btnSchool = document.getElementById("sortBtnSchool");
    const btnExt = document.getElementById("sortBtnExternal");
    const btnAlpha = document.getElementById("sortBtnAlpha");

    if (btnSchool) btnSchool.classList.toggle("active", this.cardSort === "school_first");
    if (btnExt) btnExt.classList.toggle("active", this.cardSort === "external_first");
    if (btnAlpha) btnAlpha.classList.toggle("active", this.cardSort === "name");
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
      const grid = document.getElementById("explodedGrid");
      if (grid && this.activeView === "mindmap") {
        grid.style.display = "none";
      }
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

    const allProjects = [...(data.projects || [])];

    // Helper sort function for a list of projects based on this.cardSort
    const sortProjectsList = (list) => {
      return [...list].sort((a, b) => {
        if (this.cardSort === "name") {
          return (a.name || "").localeCompare(b.name || "");
        }
        const aSchool = (a.category || "External").toLowerCase() === "school";
        const bSchool = (b.category || "External").toLowerCase() === "school";
        if (this.cardSort === "school_first") {
          if (aSchool !== bSchool) return aSchool ? -1 : 1;
        } else if (this.cardSort === "external_first") {
          if (aSchool !== bSchool) return aSchool ? 1 : -1;
        }
        return (a.name || "").localeCompare(b.name || "");
      });
    };

    const schoolProjects = sortProjectsList(allProjects.filter(p => (p.category || "External").toLowerCase() === "school"));
    const extProjects = sortProjectsList(allProjects.filter(p => (p.category || "External").toLowerCase() !== "school"));

    // Case 1: Side-by-side segregated pools
    if (this.cardFilter === "split") {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";

      const firstCol = this.cardSort === "external_first" ? {
        title: "🌐 External Projects Pool",
        colorVar: "var(--focus-indigo)",
        projects: extProjects,
        emptyMsg: "No external projects currently."
      } : {
        title: "🎓 School Projects Pool",
        colorVar: "var(--accent-cyan)",
        projects: schoolProjects,
        emptyMsg: "No school projects currently."
      };

      const secondCol = this.cardSort === "external_first" ? {
        title: "🎓 School Projects Pool",
        colorVar: "var(--accent-cyan)",
        projects: schoolProjects,
        emptyMsg: "No school projects currently."
      } : {
        title: "🌐 External Projects Pool",
        colorVar: "var(--focus-indigo)",
        projects: extProjects,
        emptyMsg: "No external projects currently."
      };

      [firstCol, secondCol].forEach(colData => {
        const col = document.createElement("div");
        col.style.display = "flex";
        col.style.flexDirection = "column";
        col.style.gap = "14px";
        col.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid var(--card-border);">
            <span style="font-weight: 800; font-size: 14px; color: ${colData.colorVar}; display: flex; align-items: center; gap: 6px;">
              ${colData.title}
            </span>
            <span class="panel-count-badge">${colData.projects.length}</span>
          </div>
        `;
        if (colData.projects.length === 0) {
          col.innerHTML += `<div style="font-size: 13px; color: var(--text-muted); padding: 16px 0; text-align: center;">${colData.emptyMsg}</div>`;
        } else {
          colData.projects.forEach(p => col.appendChild(this.buildProjectCard(p)));
        }
        grid.appendChild(col);
      });

    } else {
      // Standard Grid View (Filtered by all, school, or external)
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(320px, 1fr))";

      let filteredProjects = allProjects;
      if (this.cardFilter === "school") {
        filteredProjects = schoolProjects;
      } else if (this.cardFilter === "external") {
        filteredProjects = extProjects;
      } else {
        filteredProjects = sortProjectsList(allProjects);
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

    if (typeof App !== "undefined" && App.renderIcons) {
      App.renderIcons();
    } else if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  },

  buildProjectCard(p) {
    const total = p.tasks.length;
    const done = p.tasks.filter(t => t.status === "completed").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isCollapsed = this.collapsedDescs.has(p.id);
    const isSchool = (p.category || "External").toLowerCase() === "school";
    const categoryBadgeClass = isSchool ? "category-badge-school" : "category-badge-external";
    const categoryLabel = isSchool ? "🎓 School" : "🌐 External";
    const pColor = p.color || (isSchool ? "#ec4899" : "#3b82f6");

    const card = document.createElement("div");
    card.className = "project-card";
    card.style.borderTop = `3px solid ${pColor}`;
    card.innerHTML = `
      <div class="project-card-header" style="cursor: pointer;" onclick="EntityModal.open('project', ${p.id})" title="Click to edit project details">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="project-card-title">${this.escapeHtml(p.name)}</span>
            <span class="${categoryBadgeClass}">${categoryLabel}</span>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
