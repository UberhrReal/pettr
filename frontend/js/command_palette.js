/**
 * PETTR Command Palette (Omni-Search & Action Dispatcher)
 * Accessible via Ctrl+K / Cmd+K or header trigger button.
 */
const CommandPalette = {
  isOpen: false,
  items: [],
  filteredItems: [],
  selectedIndex: 0,
  hasInitialized: false,

  _lastToggleTime: 0,

  init() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;
    this.bindKeyboardShortcuts();
  },

  bindKeyboardShortcuts() {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.isContentEditable
      );

      const key = e.key ? e.key.toLowerCase() : "";
      const code = e.code || "";
      const isK = key === "k" || code === "KeyK";
      const isP = key === "p" || code === "KeyP";
      const isBackslash = e.key === "\\" || code === "Backslash";

      // 1. Shift+K (when not typing in an input field - universally reliable across all browsers & OS)
      const isShiftK = !isInputFocused && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && isK;
      // 2. Alt+K (unconditionally permitted on all OS/browsers without browser hijack)
      const isAltK = e.altKey && !e.ctrlKey && !e.metaKey && isK;
      // 3. Ctrl+K or Cmd+K
      const isCtrlK = (e.ctrlKey || e.metaKey) && !e.altKey && isK;
      // 4. Ctrl+P or Cmd+P (VS Code / Sublime quick open)
      const isCtrlP = (e.ctrlKey || e.metaKey) && !e.altKey && isP;
      // 5. Backslash '\' when not typing in a text field
      const isSingleBackslash = !isInputFocused && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && isBackslash;

      if (isShiftK || isAltK || isCtrlK || isCtrlP || isSingleBackslash) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        this.toggle();
        return;
      }

      // Close on Escape
      if (this.isOpen && (e.key === "Escape" || code === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }

      // Navigate results when open
      if (this.isOpen) {
        if (e.key === "ArrowDown" || code === "ArrowDown") {
          e.preventDefault();
          this.moveSelection(1);
        } else if (e.key === "ArrowUp" || code === "ArrowUp") {
          e.preventDefault();
          this.moveSelection(-1);
        } else if (e.key === "Enter" || code === "Enter") {
          e.preventDefault();
          this.executeSelected();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    const modal = document.getElementById("commandPaletteModal");
    const input = document.getElementById("commandPaletteInput");
    if (!modal || !input) return;

    this.isOpen = true;
    modal.style.display = "flex";
    input.value = "";
    this.selectedIndex = 0;

    // 1. Build local items synchronously for instantaneous response
    this.buildLocalIndex();
    this.filter("");

    // 2. Enrich with notes asynchronously in background
    this.enrichWithNotes();

    setTimeout(() => {
      input.focus();
    }, 30);

    if (window.App && App.renderIcons) App.renderIcons();
  },

  close() {
    const modal = document.getElementById("commandPaletteModal");
    if (!modal) return;
    modal.style.display = "none";
    this.isOpen = false;
  },

  buildLocalIndex() {
    this.items = [];

    // 1. Navigation Targets
    const navItems = [
      { id: "nav-dash", title: "Dashboard & Snapshot", category: "NAV", icon: "layout-dashboard", action: () => App.switchTab("dashboard") },
      { id: "nav-timeline", title: "Interactive Timeline", category: "NAV", icon: "clock", action: () => App.switchTab("timeline") },
      { id: "nav-mindmap", title: "Mindmap Point Cloud", category: "NAV", icon: "network", action: () => App.switchTab("mindmap") },
      { id: "nav-exploded", title: "Exploded Hierarchy & Projects", category: "NAV", icon: "folder-tree", action: () => App.switchTab("exploded") },
      { id: "nav-notes", title: "Notes & Personal Repository", category: "NAV", icon: "file-text", action: () => App.switchTab("notes") },
      { id: "nav-settings", title: "System Settings & Host Config", category: "NAV", icon: "sliders", action: () => App.switchTab("settings") },
    ];
    this.items.push(...navItems);

    // 2. Tactical Actions
    const actionItems = [
      { id: "act-focus", title: "Launch Focus Cockpit (Deep Work Sprint)", category: "ACTION", icon: "zap", action: () => FocusCockpit.open() },
      { id: "act-debrief", title: "Open Evening Debrief", category: "ACTION", icon: "moon-star", action: () => EveningDebrief.open() },
      { id: "act-simplified", title: "Toggle Simplified Mode (Today Focus)", category: "ACTION", icon: "zap", action: () => SimplifiedMode.toggle() },
      { id: "act-create", title: "Direct Entry (+ Task, Event, Reminder, Project)", category: "ACTION", icon: "plus-circle", action: () => Dashboard.openManualCreateModal() },
      { id: "act-tz", title: "Configure Mission Clock Timezone (Travel Mode)", category: "ACTION", icon: "globe", action: () => App.promptSetTimezone() },
      { id: "act-unorg", title: "Triage Unorganised Queue", category: "ACTION", icon: "alert-triangle", action: () => Dashboard.openUnorganizedModal() },
      { id: "act-today", title: "Jump to Live Today", category: "ACTION", icon: "calendar", action: () => Dashboard.jumpToToday() },
      { id: "act-theme-auto", title: "Set Theme: Auto Solar Transition", category: "ACTION", icon: "sun-moon", action: () => App.setTheme("auto") },
      { id: "act-theme-light", title: "Set Theme: Light Editorial", category: "ACTION", icon: "sun", action: () => App.setTheme("light") },
      { id: "act-theme-dark", title: "Set Theme: Deep Midnight Aurora", category: "ACTION", icon: "moon", action: () => App.setTheme("dark") },
      { id: "act-horace", title: "Chat with Horace (Local LLM Drawer) [Alt+H]", category: "ACTION", icon: "bot", action: () => HoraceChat.open() },
      { id: "act-name", title: "Edit Preferred Display Name", category: "ACTION", icon: "user-pen", action: () => Dashboard.openEditNameModal() },
      { id: "act-lock", title: "Lock Session & Require PIN", category: "ACTION", icon: "lock", action: () => App.logout() },
    ];
    this.items.push(...actionItems);

    // 3. Live Tasks & Events from Dashboard
    if (typeof Dashboard !== "undefined" && Dashboard.tasks) {
      const focus = Dashboard.tasks.focus || [];
      const trivial = Dashboard.tasks.trivial || [];
      const appts = Dashboard.appointments || [];

      focus.forEach(t => {
        this.items.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: `Focus Task · ${t.project_name || 'Standalone'}${t.due_date_military ? ' @ ' + t.due_date_military : ''}`,
          category: "TASK",
          icon: "crosshair",
          action: () => EntityModal.open("task", t.id)
        });
      });

      trivial.forEach(t => {
        this.items.push({
          id: `task-${t.id}`,
          title: t.title,
          subtitle: `Trivial Errand · ${t.project_name || 'Standalone'}`,
          category: "TASK",
          icon: "check-square",
          action: () => EntityModal.open("task", t.id)
        });
      });

      appts.forEach(a => {
        this.items.push({
          id: `appt-${a.id}`,
          title: a.title,
          subtitle: `Event · ${a.start_time || 'Scheduled'}`,
          category: "EVENT",
          icon: "calendar",
          action: () => EntityModal.open("appointment", a.id)
        });
      });
    }
  },

  async enrichWithNotes() {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const notes = await res.json();
      
      // Remove any existing note items to avoid duplicates
      this.items = this.items.filter(i => i.category !== "NOTE");

      notes.forEach(n => {
        const cleanSnippet = (n.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        this.items.push({
          id: `note-${n.id}`,
          title: n.title || "Untitled Note",
          subtitle: cleanSnippet.substring(0, 60),
          category: "NOTE",
          icon: "file-text",
          action: () => {
            App.switchTab("notes");
            if (typeof Notes !== "undefined") Notes.selectNote(n);
          }
        });
      });

      // Re-filter if input currently has a value
      const input = document.getElementById("commandPaletteInput");
      if (this.isOpen && input && input.value) {
        this.filter(input.value);
      }
    } catch (e) {
      console.warn("Could not enrich notes for command palette:", e);
    }
  },

  onInput(query) {
    this.selectedIndex = 0;
    this.filter(query);
  },

  filter(query) {
    const q = (query || "").toLowerCase().trim();
    if (!q) {
      this.filteredItems = this.items.filter(item => item.category === "NAV" || item.category === "ACTION");
    } else {
      this.filteredItems = this.items.filter(item => {
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchSub = (item.subtitle || "").toLowerCase().includes(q);
        const matchCat = (item.category || "").toLowerCase().includes(q);
        return matchTitle || matchSub || matchCat;
      });
    }

    this.renderResults();
  },

  renderResults() {
    const container = document.getElementById("commandPaletteResults");
    if (!container) return;

    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div class="cmd-palette-empty">
          <i data-lucide="search-x" style="width:24px;height:24px;opacity:0.5;margin-bottom:6px;"></i>
          <div>No matching commands, tasks, or notes found.</div>
        </div>
      `;
      if (window.App && App.renderIcons) App.renderIcons();
      return;
    }

    container.innerHTML = this.filteredItems.map((item, idx) => {
      const isSelected = idx === this.selectedIndex;
      const subHtml = item.subtitle ? `<div class="cmd-item-sub">${this.escapeHtml(item.subtitle)}</div>` : "";
      return `
        <div class="cmd-item-row ${isSelected ? 'selected' : ''}" 
             data-index="${idx}"
             onclick="CommandPalette.selectIndex(${idx}); CommandPalette.executeSelected();"
             onmouseenter="CommandPalette.selectIndex(${idx})">
          <div class="cmd-item-left">
            <div class="cmd-item-icon-box">
              <i data-lucide="${item.icon}" style="width:14px;height:14px;"></i>
            </div>
            <div>
              <div class="cmd-item-title">${this.escapeHtml(item.title)}</div>
              ${subHtml}
            </div>
          </div>
          <div class="cmd-item-right">
            <span class="cmd-category-tag tag-${item.category.toLowerCase()}">${item.category}</span>
          </div>
        </div>
      `;
    }).join("");

    this.scrollSelectionIntoView();
    if (window.App && App.renderIcons) App.renderIcons();
  },

  selectIndex(idx) {
    this.selectedIndex = idx;
    const rows = document.querySelectorAll(".cmd-item-row");
    rows.forEach((r, i) => {
      if (i === idx) {
        r.classList.add("selected");
      } else {
        r.classList.remove("selected");
      }
    });
  },

  moveSelection(delta) {
    if (this.filteredItems.length === 0) return;
    const len = this.filteredItems.length;
    this.selectedIndex = (this.selectedIndex + delta + len) % len;
    this.selectIndex(this.selectedIndex);
    this.scrollSelectionIntoView();
  },

  scrollSelectionIntoView() {
    const container = document.getElementById("commandPaletteResults");
    const activeRow = container ? container.querySelector(`.cmd-item-row[data-index="${this.selectedIndex}"]`) : null;
    if (container && activeRow) {
      activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  },

  executeSelected() {
    if (this.filteredItems.length === 0) return;
    const item = this.filteredItems[this.selectedIndex];
    if (item && item.action) {
      this.close();
      item.action();
      if (window.App && App.haptic) App.haptic("light");
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

// Expose globally and self-init on script evaluation or DOMContentLoaded
window.CommandPalette = CommandPalette;
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => CommandPalette.init());
  } else {
    CommandPalette.init();
  }
}
