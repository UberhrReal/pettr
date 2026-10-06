/**
 * PETTR Exploded View Module
 * Supports both interactive Mindmap Tree visualization and structured Project Cards.
 */
const Exploded = {
  activeView: "mindmap", // "mindmap" or "cards"

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
    const cardsContainer = document.getElementById("explodedGrid");

    if (viewName === "mindmap") {
      mindmapContainer.style.display = "block";
      cardsContainer.style.display = "none";
      if (typeof Mindmap !== "undefined") {
        Mindmap.resize();
        Mindmap.draw();
      }
    } else {
      mindmapContainer.style.display = "none";
      cardsContainer.style.display = "grid";
    }
  },

  async refresh() {
    try {
      const res = await fetch("/api/exploded");
      if (!res.ok) return;
      const data = await res.json();
      this.render(data);
      if (typeof Mindmap !== "undefined") {
        await Mindmap.refresh();
      }
    } catch (err) {
      console.error("Error loading exploded view:", err);
    }
  },

  render(data) {
    const grid = document.getElementById("explodedGrid");
    grid.innerHTML = "";

    // 1. Projects Cards
    if (data.projects && data.projects.length > 0) {
      data.projects.forEach(p => {
        const total = p.tasks.length;
        const done = p.tasks.filter(t => t.status === "completed").length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        const card = document.createElement("div");
        card.className = "project-card";
        card.innerHTML = `
          <div class="project-card-header" style="cursor: pointer;" onclick="EntityModal.open('project', ${p.id})" title="Click to edit project details">
            <div>
              <span class="project-card-title">${this.escapeHtml(p.name)}</span>
              ${p.description ? `<div style="font-size: 12px; color: var(--text-muted);">${this.escapeHtml(p.description)}</div>` : ''}
            </div>
            <span style="font-size: 12px; font-weight: 700; color: var(--accent-cyan);">${pct}% Done</span>
          </div>

          <div style="background: var(--bg-tertiary); height: 6px; border-radius: 3px; margin-bottom: 14px; overflow: hidden;">
            <div style="background: var(--accent-cyan); width: ${pct}%; height: 100%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${p.tasks.length === 0 ? '<div style="font-size: 12px; color: var(--text-muted);">No tasks yet.</div>' : ''}
            ${p.tasks.map(t => `
              <div onclick="EntityModal.open('task', ${t.id})" title="Click to view details or re-sort" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 13px; background: var(--bg-primary); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 6px; transition: border-color 0.15s ease;">
                <span style="${t.status === 'completed' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                  ${t.tier === 'focus' ? '🎯' : '⚡'} ${this.escapeHtml(t.title)}
                </span>
                <span class="urgency-badge ${t.urgency ? t.urgency.level : 'none'}">${t.urgency ? t.urgency.label : ''}</span>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--card-border); padding-top: 10px;">
            <div style="display: flex; gap: 6px;">
              <button class="action-icon-btn" onclick="Dashboard.promptAddTaskToProject('${this.escapeHtml(p.name)}')">+ Add Task</button>
              <button class="action-icon-btn" onclick="Dashboard.completeProject(${p.id}, '${this.escapeHtml(p.name)}')" style="color: var(--accent-green); font-weight: 600;" title="Wrap up and mark project complete">✓ Complete Project</button>
            </div>
            <button class="action-icon-btn" onclick="EntityModal.open('project', ${p.id})">Settings →</button>
          </div>
        `;
        grid.appendChild(card);
      });
    }

    // 2. Standalone Tasks Card
    if (data.standalone_tasks && data.standalone_tasks.length > 0) {
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

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
