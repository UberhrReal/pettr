/**
 * PETTR Notes Module
 * Unified In-Place Rich-Text Scratchpad with Instant Formatting, Media Embeds, and Drag-and-Drop
 */
const Notes = {
  currentNoteId: null,
  currentProjectName: null,
  currentFolderName: null,
  currentEventId: null,
  currentEventTitle: null,
  allNotes: [],
  customFolders: [],
  allProjects: [],
  expandedFolders: new Set(["general"]),
  multiSelectMode: false,
  selectedNoteIds: new Set(),
  saveTimeout: null,
  viewMode: "notes", // "notes" | "media"
  mediaItems: [],
  activeMediaFilter: "all",
  mediaSearchQuery: "",
  activeLightboxItem: null,

  async init() {
    this.bindEvents();
    await this.loadNotes();
    await this.loadMediaList();
  },

  bindEvents() {
    const titleInput = document.getElementById("noteTitleInput");
    const editor = document.getElementById("noteContentArea");

    if (titleInput) {
      titleInput.addEventListener("input", () => this.scheduleAutoSave());
    }

    if (editor) {
      editor.addEventListener("input", () => this.scheduleAutoSave());

      // Interactive checklist checkboxes
      editor.addEventListener("change", (e) => {
        if (e.target && e.target.type === "checkbox") {
          this.toggleChecklistRow(e.target);
        }
      });

      // Handle image/media paste directly from clipboard
      editor.addEventListener("paste", (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].kind === "file") {
              const file = items[i].getAsFile();
              if (file) {
                e.preventDefault();
                this.uploadMedia(file);
                return;
              }
            }
          }
        }
      });

      // Handle drag & drop files
      editor.addEventListener("dragover", (e) => {
        e.preventDefault();
        editor.classList.add("drag-over");
      });
      editor.addEventListener("dragleave", () => {
        editor.classList.remove("drag-over");
      });
      editor.addEventListener("drop", (e) => {
        e.preventDefault();
        editor.classList.remove("drag-over");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            this.uploadMedia(e.dataTransfer.files[i]);
          }
        }
      });

      // In-editor hotkeys (Ctrl+B, Ctrl+I, Tab)
      editor.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          this.format("bold");
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
          e.preventDefault();
          this.format("italic");
        } else if (e.key === "Tab") {
          e.preventDefault();
          document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
        }
      });

      // Keep track of active selection & update toolbar state
      ['keyup', 'mouseup', 'touchend'].forEach(evt => {
        editor.addEventListener(evt, () => {
          this.saveSelection();
          this.updateToolbarState();
        });
      });

      document.addEventListener("selectionchange", () => {
        if (document.activeElement === editor || editor.contains(window.getSelection()?.anchorNode)) {
          this.saveSelection();
          this.updateToolbarState();
        }
      });
    }
  },

  scheduleAutoSave() {
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Saving...";
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveCurrentNote(), 600);
  },

  async loadNotes(preferredNoteId = null) {
    try {
      const [notesRes, foldersRes, projectsRes] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/note-folders").catch(() => null),
        fetch("/api/projects").catch(() => null)
      ]);
      if (!notesRes.ok) return [];
      const notes = await notesRes.json();
      this.allNotes = Array.isArray(notes) ? notes : [];

      if (foldersRes && foldersRes.ok) {
        const fList = await foldersRes.json();
        this.customFolders = Array.isArray(fList) ? fList.map(f => f.name).filter(Boolean) : [];
      }
      if (projectsRes && projectsRes.ok) {
        const pList = await projectsRes.json();
        this.allProjects = Array.isArray(pList) ? pList : [];
      }

      // Prune stale IDs from multi-select set
      const validIds = new Set(this.allNotes.map(n => String(n.id)));
      Array.from(this.selectedNoteIds).forEach(id => {
        if (!validIds.has(String(id))) this.selectedNoteIds.delete(id);
      });

      this.renderSidebar(this.allNotes);
      this.updateBulkBarUI();

      const targetId = preferredNoteId !== null ? preferredNoteId : this.currentNoteId;
      if (targetId) {
        const match = this.allNotes.find(n => String(n.id) === String(targetId));
        if (match) {
          this.selectNote(match);
          return this.allNotes;
        }
      }

      if (this.allNotes.length > 0 && !this.currentNoteId && !this.currentProjectName && !this.currentFolderName && !this.currentEventId) {
        this.selectNote(this.allNotes[0]);
      } else if (this.allNotes.length === 0 && !this.currentProjectName && !this.currentFolderName && !this.currentEventId) {
        this.createNewNote();
      } else {
        this.renderFolderContextBar();
      }
      return this.allNotes;
    } catch (err) {
      console.error("Error loading notes:", err);
      return [];
    }
  },

  normalizeFolderKey(value) {
    return String(value || "").trim().toLowerCase();
  },

  getEventFolderKey(noteOrEvent) {
    const eid = noteOrEvent.event_id || noteOrEvent.eventId;
    if (eid) return `event:id:${eid}`;
    const title = (noteOrEvent.event_title || noteOrEvent.eventTitle || "").trim().toLowerCase();
    return title ? `event:title:${title}` : "";
  },

  getProjectAccent(projectName, rawColor) {
    if (typeof Dashboard !== "undefined" && Dashboard.getProjectColor) {
      return Dashboard.getProjectColor(projectName, rawColor);
    }
    if (rawColor && typeof App !== "undefined" && App.getAccessibleAccentColor) {
      return App.getAccessibleAccentColor(rawColor);
    }
    return rawColor || "var(--focus-indigo)";
  },

  getAvailableProjectNames() {
    const names = new Set();
    (this.allProjects || []).forEach(p => { if (p && p.name) names.add(String(p.name).trim()); });
    if (typeof Dashboard !== "undefined" && Dashboard.tasks && Array.isArray(Dashboard.tasks.projects)) {
      Dashboard.tasks.projects.forEach(p => { if (p && p.name) names.add(String(p.name).trim()); });
    }
    (this.allNotes || []).forEach(n => { if (n.project_name) names.add(String(n.project_name).trim()); });
    if (this.currentProjectName) names.add(String(this.currentProjectName).trim());
    return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b));
  },

  getAvailableCustomFolders() {
    const names = new Set();
    (this.customFolders || []).forEach(f => { if (f) names.add(String(f).trim()); });
    (this.allNotes || []).forEach(n => { if (n.folder_name && !n.project_name) names.add(String(n.folder_name).trim()); });
    if (this.currentFolderName) names.add(String(this.currentFolderName).trim());
    return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b));
  },

  buildFolderDestinationOptionsHtml(selectedToken = "general", prefixLabel = "") {
    const customNames = this.getAvailableCustomFolders();
    const projectNames = this.getAvailableProjectNames();
    const genLabel = prefixLabel ? `${prefixLabel}General` : "General";
    let html = `<option value="general" ${selectedToken === "general" ? "selected" : ""}>${this.escapeHtml(genLabel)}</option>`;
    if (customNames.length > 0) {
      html += `<optgroup label="Custom Folders">`;
      customNames.forEach(fname => {
        const val = `folder:${fname}`;
        html += `<option value="${this.escapeHtml(val)}" ${selectedToken === val ? "selected" : ""}>📁 ${this.escapeHtml(fname)}</option>`;
      });
      html += `</optgroup>`;
    }
    if (projectNames.length > 0) {
      html += `<optgroup label="Projects">`;
      projectNames.forEach(pname => {
        const val = `project:${pname}`;
        html += `<option value="${this.escapeHtml(val)}" ${selectedToken === val ? "selected" : ""}>📌 ${this.escapeHtml(pname)}</option>`;
      });
      html += `</optgroup>`;
    }
    return html;
  },

  parseFolderDestinationToken(token) {
    const val = String(token || "general");
    if (val.startsWith("project:")) {
      return { project_name: val.slice("project:".length).trim() || null, folder_name: null };
    }
    if (val.startsWith("folder:")) {
      return { project_name: null, folder_name: val.slice("folder:".length).trim() || null };
    }
    return { project_name: null, folder_name: null };
  },

  buildFolderTreeData(notes) {
    const projectMap = new Map();
    const customFolderMap = new Map();
    const standaloneEventMap = new Map();
    const generalNotes = [];

    const ensureProject = (projName, projColor) => {
      const key = `project:${this.normalizeFolderKey(projName)}`;
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          key,
          projectName: String(projName).trim(),
          projectColor: this.getProjectAccent(projName, projColor),
          directNotes: [],
          eventsMap: new Map()
        });
      } else if (projColor) {
        projectMap.get(key).projectColor = this.getProjectAccent(projName, projColor);
      }
      return projectMap.get(key);
    };

    const ensureCustomFolder = (folderName) => {
      const clean = String(folderName || "").trim();
      const key = `folder:${this.normalizeFolderKey(clean)}`;
      if (!customFolderMap.has(key)) {
        customFolderMap.set(key, {
          key,
          folderName: clean,
          notes: []
        });
      }
      return customFolderMap.get(key);
    };

    // Custom folders created explicitly via '+ Folder' appear immediately
    (this.customFolders || []).forEach(fname => {
      if (fname && String(fname).trim()) ensureCustomFolder(fname);
    });

    // Project folders ONLY appear once the first note belonging to that project exists
    (notes || []).forEach(n => {
      const pName = (n.project_name || "").trim();
      const fName = (n.folder_name || "").trim();
      const evTitle = (n.event_title || "").trim();
      const evId = n.event_id || null;
      const hasEvent = Boolean(evId || evTitle);

      if (pName) {
        const projGroup = ensureProject(pName, n.project_color);
        if (hasEvent) {
          const evSubKey = `${projGroup.key}::${this.getEventFolderKey(n)}`;
          if (!projGroup.eventsMap.has(evSubKey)) {
            projGroup.eventsMap.set(evSubKey, {
              key: evSubKey,
              eventId: evId,
              eventTitle: evTitle || `Event #${evId}`,
              projectName: projGroup.projectName,
              notes: []
            });
          }
          projGroup.eventsMap.get(evSubKey).notes.push(n);
        } else {
          projGroup.directNotes.push(n);
        }
      } else if (hasEvent) {
        const evKey = this.getEventFolderKey(n);
        if (!standaloneEventMap.has(evKey)) {
          standaloneEventMap.set(evKey, {
            key: evKey,
            eventId: evId,
            eventTitle: evTitle || `Event #${evId}`,
            projectName: null,
            notes: []
          });
        }
        standaloneEventMap.get(evKey).notes.push(n);
      } else if (fName) {
        ensureCustomFolder(fName).notes.push(n);
      } else {
        generalNotes.push(n);
      }
    });

    const projects = Array.from(projectMap.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
    projects.forEach(p => {
      p.events = Array.from(p.eventsMap.values()).sort((a, b) => a.eventTitle.localeCompare(b.eventTitle));
      p.totalNotes = p.directNotes.length + p.events.reduce((acc, ev) => acc + ev.notes.length, 0);
    });
    const customFolders = Array.from(customFolderMap.values()).sort((a, b) => a.folderName.localeCompare(b.folderName));
    const standaloneEvents = Array.from(standaloneEventMap.values()).sort((a, b) => a.eventTitle.localeCompare(b.eventTitle));

    return { projects, customFolders, standaloneEvents, generalNotes };
  },

  toggleFolder(folderKey) {
    if (!folderKey) return;
    if (this.expandedFolders.has(folderKey)) {
      this.expandedFolders.delete(folderKey);
    } else {
      this.expandedFolders.add(folderKey);
    }
    this.renderSidebar(this.allNotes);
  },

  toggleAllFolders() {
    const tree = this.buildFolderTreeData(this.allNotes);
    const allKeys = ["general"];
    tree.customFolders.forEach(f => allKeys.push(f.key));
    tree.projects.forEach(p => {
      allKeys.push(p.key);
      p.events.forEach(ev => allKeys.push(ev.key));
    });
    tree.standaloneEvents.forEach(ev => allKeys.push(ev.key));

    const anyOpen = allKeys.some(k => this.expandedFolders.has(k));
    if (anyOpen && this.expandedFolders.size > 1) {
      this.expandedFolders.clear();
    } else {
      allKeys.forEach(k => this.expandedFolders.add(k));
    }
    this.renderSidebar(this.allNotes);
  },

  async promptCreateFolder() {
    const raw = await App.promptAction({
      title: "New Folder",
      placeholder: "Folder name",
      confirmLabel: "Create"
    });
    if (!raw || !raw.trim()) return;
    const cleanName = raw.trim();
    try {
      const res = await fetch("/api/note-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName })
      });
      if (!res.ok) throw new Error("Failed creating folder");
      const data = await res.json();
      const createdName = (data.folder && data.folder.name) || cleanName;
      if (!this.customFolders.includes(createdName)) {
        this.customFolders.push(createdName);
      }
      this.expandedFolders.add(`folder:${this.normalizeFolderKey(createdName)}`);
      this.renderSidebar(this.allNotes);
      this.renderFolderContextBar();
      this.updateBulkBarUI();
      if (typeof App !== "undefined") App.showToast(`Created "${createdName}"`);
    } catch (err) {
      console.error(err);
      if (typeof App !== "undefined") App.showToast("Could not create folder", true);
    }
  },

  async deleteCustomFolder(folderName) {
    if (!folderName) return;
    const ok = await App.confirmAction({
      title: `Delete "${folderName}"?`,
      sub: "Notes move to General.",
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      await fetch(`/api/note-folders/${encodeURIComponent(folderName)}`, { method: "DELETE" });
      if (this.currentFolderName && this.normalizeFolderKey(this.currentFolderName) === this.normalizeFolderKey(folderName)) {
        this.currentFolderName = null;
      }
      await this.loadNotes(this.currentNoteId);
      if (typeof App !== "undefined") App.showToast(`Deleted folder "${folderName}"`);
    } catch (err) {
      console.error(err);
    }
  },

  toggleMultiSelect(forceState = null) {
    this.multiSelectMode = forceState === null ? !this.multiSelectMode : Boolean(forceState);
    if (!this.multiSelectMode) {
      this.selectedNoteIds.clear();
    }
    this.renderSidebar(this.allNotes);
    this.updateBulkBarUI();
  },

  toggleNoteSelection(noteId) {
    const key = String(noteId);
    if (this.selectedNoteIds.has(key)) {
      this.selectedNoteIds.delete(key);
    } else {
      this.selectedNoteIds.add(key);
    }
    this.renderSidebar(this.allNotes);
    this.updateBulkBarUI();
  },

  selectAllVisibleNotes() {
    this.multiSelectMode = true;
    (this.allNotes || []).forEach(n => this.selectedNoteIds.add(String(n.id)));
    this.renderSidebar(this.allNotes);
    this.updateBulkBarUI();
  },

  updateBulkBarUI() {
    const bar = document.getElementById("notesBulkActionBar");
    const btn = document.getElementById("notesSelectModeBtn");
    const countEl = document.getElementById("notesBulkSelectedCount");
    const targetSel = document.getElementById("notesBulkMoveTarget");
    if (btn) btn.classList.toggle("active", this.multiSelectMode);
    if (bar) bar.style.display = this.multiSelectMode ? "flex" : "none";
    if (countEl) countEl.textContent = `${this.selectedNoteIds.size} selected`;
    if (targetSel) {
      const prev = targetSel.value || "general";
      targetSel.innerHTML = this.buildFolderDestinationOptionsHtml(prev, "Move to: ");
    }
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  async bulkMoveSelectedNotes() {
    const ids = Array.from(this.selectedNoteIds).map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) {
      if (typeof App !== "undefined") App.showToast("Select at least one note first.", true);
      return;
    }
    const targetSel = document.getElementById("notesBulkMoveTarget");
    const token = targetSel ? targetSel.value : "general";
    const dest = this.parseFolderDestinationToken(token);
    try {
      const res = await fetch("/api/notes/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_ids: ids,
          project_name: dest.project_name,
          folder_name: dest.folder_name,
          event_id: null,
          event_title: null
        })
      });
      if (!res.ok) throw new Error("Bulk move failed");
      if (dest.project_name) {
        this.expandedFolders.add(`project:${this.normalizeFolderKey(dest.project_name)}`);
      } else if (dest.folder_name) {
        this.expandedFolders.add(`folder:${this.normalizeFolderKey(dest.folder_name)}`);
      } else {
        this.expandedFolders.add("general");
      }
      this.multiSelectMode = false;
      this.selectedNoteIds.clear();
      await this.loadNotes(this.currentNoteId);
      const destLabel = dest.project_name || dest.folder_name || "General";
      if (typeof App !== "undefined") App.showToast(`Moved ${ids.length} note${ids.length === 1 ? "" : "s"} to ${destLabel}`);
    } catch (err) {
      console.error(err);
      if (typeof App !== "undefined") App.showToast("Could not move selected notes.", true);
    }
  },

  async bulkDeleteSelectedNotes() {
    const ids = Array.from(this.selectedNoteIds).map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) {
      if (typeof App !== "undefined") App.showToast("Select at least one note first.", true);
      return;
    }
    const ok = await App.confirmAction({
      title: `Delete ${ids.length} note${ids.length === 1 ? "" : "s"}?`,
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/notes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_ids: ids })
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      if (this.currentNoteId && ids.includes(Number(this.currentNoteId))) {
        this.currentNoteId = null;
        this.currentProjectName = null;
        this.currentFolderName = null;
        this.currentEventId = null;
        this.currentEventTitle = null;
      }
      this.multiSelectMode = false;
      this.selectedNoteIds.clear();
      await this.loadNotes();
      if (typeof App !== "undefined") App.showToast(`Deleted ${ids.length} note${ids.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      if (typeof App !== "undefined") App.showToast("Could not delete selected notes.", true);
    }
  },

  buildNoteSidebarRow(n, isNested = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = String(n.id) === String(this.currentNoteId);
    const isSelected = this.selectedNoteIds.has(String(n.id));
    btn.className = `tab-btn notes-tree-note-btn ${isNested ? 'is-nested' : ''} ${isActive ? 'active' : ''} ${isSelected ? 'is-multi-selected' : ''}`;
    btn.dataset.noteId = n.id;
    btn.innerHTML = `
      ${this.multiSelectMode ? `<input type="checkbox" class="notes-tree-select-cb" ${isSelected ? "checked" : ""} aria-label="Select note" onclick="event.stopPropagation(); Notes.toggleNoteSelection(${n.id})">` : ''}
      <i data-lucide="file-text" class="notes-tree-note-icon"></i>
      <span class="notes-tree-note-title">${this.escapeHtml(n.title || "Untitled Note")}</span>
    `;
    btn.onclick = (e) => {
      if (this.multiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
        if (!this.multiSelectMode) this.multiSelectMode = true;
        this.toggleNoteSelection(n.id);
        return;
      }
      this.selectNote(n);
    };
    return btn;
  },

  buildEventFolderElement(evGroup, isSubfolder = false) {
    const isExpanded = this.expandedFolders.has(evGroup.key);
    const wrap = document.createElement("div");
    wrap.className = `notes-folder-node ${isSubfolder ? 'notes-subfolder-node' : 'notes-standalone-event-node'}`;
    wrap.dataset.folderKey = evGroup.key;

    const header = document.createElement("div");
    header.className = `notes-folder-header ${isExpanded ? 'is-open' : ''}`;
    header.innerHTML = `
      <button type="button" class="notes-folder-toggle-btn" aria-expanded="${isExpanded ? 'true' : 'false'}">
        <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="notes-folder-chevron"></i>
        <i data-lucide="${isExpanded ? 'folder-open' : 'calendar-check'}" class="notes-folder-icon is-event"></i>
        <span class="notes-folder-name">${this.escapeHtml(evGroup.eventTitle)}</span>
        <span class="notes-folder-count">${evGroup.notes.length}</span>
      </button>
      <button type="button" class="notes-folder-add-btn" title="New note in ${this.escapeHtml(evGroup.eventTitle)}" aria-label="New note in event folder">
        <i data-lucide="plus" style="width:12px;height:12px;"></i>
      </button>
    `;
    header.querySelector(".notes-folder-toggle-btn").onclick = () => this.toggleFolder(evGroup.key);
    header.querySelector(".notes-folder-add-btn").onclick = (e) => {
      e.stopPropagation();
      this.createNewNoteInContext({
        projectName: evGroup.projectName || null,
        eventId: evGroup.eventId || null,
        eventTitle: evGroup.eventTitle || null,
        defaultTitle: `${evGroup.eventTitle} — Notes`
      });
    };
    wrap.appendChild(header);

    if (isExpanded) {
      const body = document.createElement("div");
      body.className = "notes-folder-children";
      evGroup.notes.forEach(n => body.appendChild(this.buildNoteSidebarRow(n, true)));
      wrap.appendChild(body);
    }
    return wrap;
  },

  renderSidebar(notes) {
    const sidebar = document.getElementById("notesListSidebar");
    const countBadge = document.getElementById("notesCountBadge");
    if (countBadge) countBadge.textContent = notes ? notes.length : 0;
    if (!sidebar) return;
    sidebar.innerHTML = "";

    const tree = this.buildFolderTreeData(notes || []);

    // 1. Project Folders (broad folders containing direct notes & collapsible Event subfolders)
    if (tree.projects.length > 0) {
      const sectionLabel = document.createElement("div");
      sectionLabel.className = "notes-tree-section-label";
      sectionLabel.textContent = "Projects";
      sidebar.appendChild(sectionLabel);

      tree.projects.forEach(pGroup => {
        const isExpanded = this.expandedFolders.has(pGroup.key);
        const wrap = document.createElement("div");
        wrap.className = "notes-folder-node notes-project-folder-node";
        wrap.dataset.folderKey = pGroup.key;

        const header = document.createElement("div");
        header.className = `notes-folder-header ${isExpanded ? 'is-open' : ''}`;
        header.innerHTML = `
          <button type="button" class="notes-folder-toggle-btn" aria-expanded="${isExpanded ? 'true' : 'false'}">
            <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="notes-folder-chevron"></i>
            <span class="notes-folder-color-dot" style="background:${this.escapeHtml(pGroup.projectColor)};"></span>
            <span class="notes-folder-name">${this.escapeHtml(pGroup.projectName)}</span>
            <span class="notes-folder-count">${pGroup.totalNotes}</span>
          </button>
          <button type="button" class="notes-folder-add-btn" title="New note in ${this.escapeHtml(pGroup.projectName)}" aria-label="New note in project">
            <i data-lucide="plus" style="width:12px;height:12px;"></i>
          </button>
        `;
        header.querySelector(".notes-folder-toggle-btn").onclick = () => this.toggleFolder(pGroup.key);
        header.querySelector(".notes-folder-add-btn").onclick = (e) => {
          e.stopPropagation();
          this.createNewNoteInContext({
            projectName: pGroup.projectName,
            defaultTitle: `${pGroup.projectName} — Notes`
          });
        };
        wrap.appendChild(header);

        if (isExpanded) {
          const body = document.createElement("div");
          body.className = "notes-folder-children";
          if (pGroup.totalNotes === 0) {
            const emptyHint = document.createElement("div");
            emptyHint.className = "notes-folder-empty-hint";
            emptyHint.textContent = "No notes in this project yet — click + to start one.";
            body.appendChild(emptyHint);
          } else {
            pGroup.directNotes.forEach(n => body.appendChild(this.buildNoteSidebarRow(n, false)));
            pGroup.events.forEach(evGroup => body.appendChild(this.buildEventFolderElement(evGroup, true)));
          }
          wrap.appendChild(body);
        }

        sidebar.appendChild(wrap);
      });
    }

    // 2. Standalone Events (not linked to any project)
    if (tree.standaloneEvents.length > 0) {
      const sectionLabel = document.createElement("div");
      sectionLabel.className = "notes-tree-section-label";
      sectionLabel.textContent = "Events";
      sidebar.appendChild(sectionLabel);

      tree.standaloneEvents.forEach(evGroup => {
        sidebar.appendChild(this.buildEventFolderElement(evGroup, false));
      });
    }

    // 3. Custom User Folders
    if (tree.customFolders.length > 0) {
      const cfLabel = document.createElement("div");
      cfLabel.className = "notes-tree-section-label";
      cfLabel.textContent = "Custom Folders";
      sidebar.appendChild(cfLabel);

      tree.customFolders.forEach(fGroup => {
        const isExpanded = this.expandedFolders.has(fGroup.key);
        const wrap = document.createElement("div");
        wrap.className = "notes-folder-node notes-custom-folder-node";
        wrap.dataset.folderKey = fGroup.key;

        const header = document.createElement("div");
        header.className = `notes-folder-header ${isExpanded ? 'is-open' : ''}`;
        header.innerHTML = `
          <button type="button" class="notes-folder-toggle-btn" aria-expanded="${isExpanded ? 'true' : 'false'}">
            <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="notes-folder-chevron"></i>
            <i data-lucide="${isExpanded ? 'folder-open' : 'folder'}" class="notes-folder-icon"></i>
            <span class="notes-folder-name">${this.escapeHtml(fGroup.folderName)}</span>
            <span class="notes-folder-count">${fGroup.notes.length}</span>
          </button>
          <button type="button" class="notes-folder-add-btn" title="New note in ${this.escapeHtml(fGroup.folderName)}" aria-label="New note in folder">
            <i data-lucide="plus" style="width:12px;height:12px;"></i>
          </button>
          <button type="button" class="notes-folder-add-btn notes-folder-del-btn" title="Delete folder" aria-label="Delete custom folder">
            <i data-lucide="trash-2" style="width:11px;height:11px;"></i>
          </button>
        `;
        header.querySelector(".notes-folder-toggle-btn").onclick = () => this.toggleFolder(fGroup.key);
        header.querySelector(".notes-folder-add-btn:not(.notes-folder-del-btn)").onclick = (e) => {
          e.stopPropagation();
          this.createNewNoteInContext({
            folderName: fGroup.folderName,
            defaultTitle: "Untitled Note"
          });
        };
        header.querySelector(".notes-folder-del-btn").onclick = (e) => {
          e.stopPropagation();
          this.deleteCustomFolder(fGroup.folderName);
        };
        wrap.appendChild(header);

        if (isExpanded) {
          const body = document.createElement("div");
          body.className = "notes-folder-children";
          if (fGroup.notes.length === 0) {
            const emptyHint = document.createElement("div");
            emptyHint.className = "notes-folder-empty-hint";
            emptyHint.textContent = "Empty folder — click + to add a note.";
            body.appendChild(emptyHint);
          } else {
            fGroup.notes.forEach(n => body.appendChild(this.buildNoteSidebarRow(n, false)));
          }
          wrap.appendChild(body);
        }
        sidebar.appendChild(wrap);
      });
    }

    // 4. General / Unfiled Notes
    const genOpen = this.expandedFolders.has("general");
    const genWrap = document.createElement("div");
    genWrap.className = "notes-folder-node notes-general-folder-node";
    genWrap.dataset.folderKey = "general";

    const genHeader = document.createElement("div");
    genHeader.className = `notes-folder-header ${genOpen ? 'is-open' : ''}`;
    genHeader.innerHTML = `
      <button type="button" class="notes-folder-toggle-btn" aria-expanded="${genOpen ? 'true' : 'false'}">
        <i data-lucide="${genOpen ? 'chevron-down' : 'chevron-right'}" class="notes-folder-chevron"></i>
        <i data-lucide="notebook" class="notes-folder-icon"></i>
        <span class="notes-folder-name">General</span>
        <span class="notes-folder-count">${tree.generalNotes.length}</span>
      </button>
      <button type="button" class="notes-folder-add-btn" title="New note in General" aria-label="New general note">
        <i data-lucide="plus" style="width:12px;height:12px;"></i>
      </button>
    `;
    genHeader.querySelector(".notes-folder-toggle-btn").onclick = () => this.toggleFolder("general");
    genHeader.querySelector(".notes-folder-add-btn").onclick = (e) => {
      e.stopPropagation();
      this.createNewNote();
    };
    genWrap.appendChild(genHeader);

    if (genOpen) {
      const genBody = document.createElement("div");
      genBody.className = "notes-folder-children";
      if (tree.generalNotes.length === 0) {
        const emptyHint = document.createElement("div");
        emptyHint.className = "notes-folder-empty-hint";
        emptyHint.textContent = "No unfiled notes yet.";
        genBody.appendChild(emptyHint);
      } else {
        tree.generalNotes.forEach(n => genBody.appendChild(this.buildNoteSidebarRow(n, false)));
      }
      genWrap.appendChild(genBody);
    }
    sidebar.appendChild(genWrap);

    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  renderFolderContextBar() {
    const bar = document.getElementById("noteFolderContextBar");
    if (!bar) return;

    const hasLink = Boolean(this.currentProjectName || this.currentFolderName || this.currentEventId || this.currentEventTitle);
    bar.style.display = "flex";

    const crumbs = [];
    if (this.currentProjectName) {
      const pColor = this.getProjectAccent(this.currentProjectName, null);
      crumbs.push(`<span class="notes-context-chip is-project"><span class="notes-folder-color-dot" style="background:${this.escapeHtml(pColor)};"></span> ${this.escapeHtml(this.currentProjectName)}</span>`);
    } else if (this.currentFolderName) {
      crumbs.push(`<span class="notes-context-chip is-folder"><i data-lucide="folder" style="width:11px;height:11px;"></i> ${this.escapeHtml(this.currentFolderName)}</span>`);
    }
    if (this.currentEventId || this.currentEventTitle) {
      crumbs.push(`<span class="notes-context-chip is-event"><i data-lucide="calendar-check" style="width:11px;height:11px;"></i> ${this.escapeHtml(this.currentEventTitle || `Event #${this.currentEventId}`)}</span>`);
    }
    if (!hasLink) {
      crumbs.push(`<span class="notes-context-chip is-general"><i data-lucide="notebook" style="width:11px;height:11px;"></i> General</span>`);
    }

    const activeToken = this.currentProjectName
      ? `project:${this.currentProjectName}`
      : (this.currentFolderName ? `folder:${this.currentFolderName}` : "general");

    bar.innerHTML = `
      <div class="notes-context-crumbs">${crumbs.join('<span class="notes-context-sep">&rsaquo;</span>')}</div>
      <div class="notes-context-actions">
        <select class="notes-folder-assign-select" aria-label="Move note to folder or project" onchange="Notes.assignCurrentNoteDestination(this.value)">
          ${this.buildFolderDestinationOptionsHtml(activeToken, "Move to folder: ")}
        </select>
        ${hasLink ? `<button type="button" class="action-icon-btn notes-context-unlink-btn" onclick="Notes.unlinkCurrentNoteFolder()" title="Move back to General"><i data-lucide="folder-minus" style="width:11px;height:11px;"></i> Unfile</button>` : ''}
      </div>
    `;
    if (typeof App !== "undefined" && App.renderIcons) App.renderIcons();
  },

  async assignCurrentNoteDestination(token) {
    const dest = this.parseFolderDestinationToken(token);
    this.currentProjectName = dest.project_name;
    this.currentFolderName = dest.folder_name;
    if (dest.project_name) {
      this.expandedFolders.add(`project:${this.normalizeFolderKey(dest.project_name)}`);
    } else if (dest.folder_name) {
      this.expandedFolders.add(`folder:${this.normalizeFolderKey(dest.folder_name)}`);
    } else {
      this.expandedFolders.add("general");
    }
    this.renderFolderContextBar();
    await this.saveCurrentNote();
  },

  async assignCurrentNoteProject(projectName) {
    const clean = (projectName || "").trim();
    await this.assignCurrentNoteDestination(clean ? `project:${clean}` : "general");
  },

  async unlinkCurrentNoteFolder() {
    this.currentProjectName = null;
    this.currentFolderName = null;
    this.currentEventId = null;
    this.currentEventTitle = null;
    this.expandedFolders.add("general");
    this.renderFolderContextBar();
    await this.saveCurrentNote();
  },

  selectNote(note) {
    this.currentNoteId = note.id;
    this.currentProjectName = (note.project_name || "").trim() || null;
    this.currentFolderName = (!this.currentProjectName && note.folder_name) ? String(note.folder_name).trim() || null : null;
    this.currentEventId = note.event_id || null;
    this.currentEventTitle = (note.event_title || "").trim() || null;

    if (this.currentProjectName) {
      this.expandedFolders.add(`project:${this.normalizeFolderKey(this.currentProjectName)}`);
      if (this.currentEventId || this.currentEventTitle) {
        this.expandedFolders.add(`project:${this.normalizeFolderKey(this.currentProjectName)}::${this.getEventFolderKey(note)}`);
      }
    } else if (this.currentEventId || this.currentEventTitle) {
      this.expandedFolders.add(this.getEventFolderKey(note));
    } else if (this.currentFolderName) {
      this.expandedFolders.add(`folder:${this.normalizeFolderKey(this.currentFolderName)}`);
    } else {
      this.expandedFolders.add("general");
    }

    const titleInput = document.getElementById("noteTitleInput");
    const editor = document.getElementById("noteContentArea");
    const activeNoteTitle = document.getElementById("notesMediaActiveNoteTitle");
    if (titleInput) titleInput.value = note.title || "";
    if (activeNoteTitle) activeNoteTitle.textContent = note.title || "Untitled";
    if (editor) {
      let content = note.content || "";
      if (content && !/<(p|div|h[1-6]|ul|ol|table|blockquote|pre)[^>]*>/i.test(content)) {
        content = this.simpleMarkdownToHtml(content);
      }
      editor.innerHTML = content;
    }
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Saved";

    this.renderSidebar(this.allNotes);
    this.renderFolderContextBar();
  },

  createNewNoteInContext({ projectName = null, folderName = null, eventId = null, eventTitle = null, defaultTitle = "Untitled Note" } = {}) {
    this.currentNoteId = null;
    this.currentProjectName = (projectName || "").trim() || null;
    this.currentFolderName = (!this.currentProjectName && folderName) ? String(folderName).trim() || null : null;
    this.currentEventId = eventId || null;
    this.currentEventTitle = (eventTitle || "").trim() || null;

    if (this.currentProjectName) {
      const pKey = `project:${this.normalizeFolderKey(this.currentProjectName)}`;
      this.expandedFolders.add(pKey);
      if (this.currentEventId || this.currentEventTitle) {
        this.expandedFolders.add(`${pKey}::${this.getEventFolderKey({ event_id: this.currentEventId, event_title: this.currentEventTitle })}`);
      }
    } else if (this.currentEventId || this.currentEventTitle) {
      this.expandedFolders.add(this.getEventFolderKey({ event_id: this.currentEventId, event_title: this.currentEventTitle }));
    } else if (this.currentFolderName) {
      this.expandedFolders.add(`folder:${this.normalizeFolderKey(this.currentFolderName)}`);
    } else {
      this.expandedFolders.add("general");
    }

    const titleInput = document.getElementById("noteTitleInput");
    const editor = document.getElementById("noteContentArea");
    if (titleInput) titleInput.value = defaultTitle;
    if (editor) editor.innerHTML = "";
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Unsaved draft";

    this.renderSidebar(this.allNotes);
    this.renderFolderContextBar();
    if (editor) editor.focus();
  },

  createNewNote() {
    this.createNewNoteInContext({ projectName: null, folderName: null, eventId: null, eventTitle: null, defaultTitle: "Untitled Note" });
  },

  async openEventNote(eventId, eventTitle, projectName = "") {
    let resolvedProj = (projectName || "").trim();
    if (!resolvedProj && typeof Dashboard !== "undefined") {
      const evList = [...(Dashboard.events || []), ...((Dashboard.briefingData && Dashboard.briefingData.events_today) || [])];
      const match = evList.find(e => String(e.id) === String(eventId));
      if (match && match.project_name) resolvedProj = String(match.project_name).trim();
    }

    const cleanTitle = (eventTitle || "Event").trim() || "Event";
    const noteTitle = `${cleanTitle} — Notes`;
    if (this.viewMode !== "notes") this.switchView("notes");

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle,
          content: "",
          event_id: eventId || null,
          event_title: cleanTitle,
          project_name: resolvedProj || null,
          update_links: true
        })
      });
      if (!res.ok) throw new Error("Failed creating event note");
      const data = await res.json();
      const created = data.note;

      if (created) {
        if (created.project_name) {
          const pKey = `project:${this.normalizeFolderKey(created.project_name)}`;
          this.expandedFolders.add(pKey);
          this.expandedFolders.add(`${pKey}::${this.getEventFolderKey(created)}`);
        } else {
          this.expandedFolders.add(this.getEventFolderKey(created));
        }
        await this.loadNotes(created.id);
      }
      if (typeof App !== "undefined") {
        App.switchTab("notes");
        App.showToast(`Created note for "${cleanTitle}"`);
      }
      setTimeout(() => {
        const editor = document.getElementById("noteContentArea");
        if (editor) editor.focus();
      }, 120);
    } catch (err) {
      console.error("Failed opening event note:", err);
      if (typeof App !== "undefined") App.showToast("Could not create event note.", true);
    }
  },

  async openProjectFolder(projectName) {
    const cleanName = (projectName || "").trim();
    if (!cleanName) return;

    const projKey = `project:${this.normalizeFolderKey(cleanName)}`;
    this.expandedFolders.add(projKey);

    if (this.viewMode !== "notes") this.switchView("notes");
    if (typeof App !== "undefined") App.switchTab("notes");

    await this.loadNotes();

    const tree = this.buildFolderTreeData(this.allNotes);
    const group = tree.projects.find(p => p.key === projKey);
    if (group) {
      group.events.forEach(ev => this.expandedFolders.add(ev.key));
      this.renderSidebar(this.allNotes);

      const firstNote = group.directNotes[0] || (group.events[0] && group.events[0].notes[0]);
      if (firstNote) {
        this.selectNote(firstNote);
      } else {
        this.createNewNoteInContext({
          projectName: cleanName,
          defaultTitle: `${cleanName} — Notes`
        });
      }
    } else {
      // No notes exist for this project yet — prepare a pre-linked draft so saving creates its folder
      this.createNewNoteInContext({
        projectName: cleanName,
        defaultTitle: `${cleanName} — Notes`
      });
    }

    setTimeout(() => {
      const folderEl = document.querySelector(`[data-folder-key="${CSS.escape(projKey)}"]`);
      if (folderEl && folderEl.scrollIntoView) {
        folderEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  },

  async saveCurrentNote() {
    const title = (document.getElementById("noteTitleInput")?.value || "").trim() || "Untitled Note";
    const editor = document.getElementById("noteContentArea");
    const content = editor ? editor.innerHTML : "";

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.currentNoteId,
          title: title,
          content: content,
          project_name: this.currentProjectName,
          folder_name: this.currentFolderName,
          event_id: this.currentEventId,
          event_title: this.currentEventTitle,
          update_links: true
        })
      });
      const data = await res.json();
      if (data.note) {
        this.currentNoteId = data.note.id;
        this.currentProjectName = data.note.project_name || null;
        this.currentFolderName = data.note.folder_name || null;
        this.currentEventId = data.note.event_id || null;
        this.currentEventTitle = data.note.event_title || null;
        const statusEl = document.getElementById("noteSaveStatus");
        if (statusEl) statusEl.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        await this.loadNotes(this.currentNoteId);
      }
    } catch (err) {
      const statusEl = document.getElementById("noteSaveStatus");
      if (statusEl) statusEl.textContent = "Error saving";
    }
  },

  async deleteCurrentNote() {
    if (!this.currentNoteId) return;
    const ok = await App.confirmAction({
      title: "Delete note?",
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      await fetch(`/api/notes/${this.currentNoteId}`, { method: "DELETE" });
      this.currentNoteId = null;
      this.currentProjectName = null;
      this.currentFolderName = null;
      this.currentEventId = null;
      this.currentEventTitle = null;
      await this.loadNotes();
      this.renderFolderContextBar();
      App.showToast("Note deleted");
    } catch (err) {
      console.error(err);
    }
  },

  async parseCurrentNote() {
    const editor = document.getElementById("noteContentArea");
    const content = (editor ? (editor.innerText || editor.textContent) : "").trim();
    if (!content) {
      App.showToast("Note is empty!", true);
      return;
    }
    const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    App.showToast(`Parsing ${lines.length} items to PETTR...`);
    for (const line of lines) {
      await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: line })
      });
    }
    App.showToast("Notes parsed into tasks!");
    if (typeof Dashboard !== "undefined") await Dashboard.refresh();
  },

  savedRange: null,

  saveSelection() {
    const editor = document.getElementById("noteContentArea");
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        this.savedRange = range.cloneRange();
      }
    }
  },

  restoreSelection() {
    const editor = document.getElementById("noteContentArea");
    if (!editor || !this.savedRange) return;
    const sel = window.getSelection();
    if (sel) {
      if (sel.rangeCount > 0) {
        const currentRange = sel.getRangeAt(0);
        if (editor.contains(currentRange.commonAncestorContainer)) {
          // Caret / selection is already active inside the editor.
          // Do not clear/re-add ranges, which wipes pending formatting command styles.
          return;
        }
      }
      sel.removeAllRanges();
      sel.addRange(this.savedRange);
    }
  },

  updateToolbarState() {
    try {
      const isBold = document.queryCommandState("bold");
      const isItalic = document.queryCommandState("italic");
      const isStrike = document.queryCommandState("strikeThrough");
      const isUl = document.queryCommandState("insertUnorderedList");
      const block = (document.queryCommandValue("formatBlock") || "").toLowerCase();

      document.getElementById("noteBtnBold")?.classList.toggle("active", Boolean(isBold));
      document.getElementById("noteBtnItalic")?.classList.toggle("active", Boolean(isItalic));
      document.getElementById("noteBtnStrike")?.classList.toggle("active", Boolean(isStrike));
      document.getElementById("noteBtnUl")?.classList.toggle("active", Boolean(isUl));
      document.getElementById("noteBtnH1")?.classList.toggle("active", block === "h1");
      document.getElementById("noteBtnH2")?.classList.toggle("active", block === "h2");
      document.getElementById("noteBtnH3")?.classList.toggle("active", block === "h3");
      document.getElementById("noteBtnQuote")?.classList.toggle("active", block === "blockquote");
    } catch (e) {}
  },

  format(action) {
    const editor = document.getElementById("noteContentArea");
    if (!editor) return;

    // Restore saved selection on mobile touch if lost
    if (this.savedRange) {
      this.restoreSelection();
    }

    // Preserve scroll position on mobile touch screens
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (editor.focus && document.activeElement !== editor) {
      try {
        editor.focus({ preventScroll: true });
      } catch (e) {
        editor.focus();
      }
    }

    const btnMap = {
      bold: "noteBtnBold",
      italic: "noteBtnItalic",
      strike: "noteBtnStrike",
      h1: "noteBtnH1",
      h2: "noteBtnH2",
      h3: "noteBtnH3",
      ul: "noteBtnUl",
      quote: "noteBtnQuote"
    };
    const btnId = btnMap[action];
    const wasActive = btnId ? Boolean(document.getElementById(btnId)?.classList.contains("active")) : false;

    switch (action) {
      case "bold": {
        const currentState = Boolean(document.queryCommandState("bold"));
        if (wasActive) {
          if (currentState) document.execCommand("bold", false, null);
        } else {
          if (!currentState) document.execCommand("bold", false, null);
        }
        break;
      }
      case "italic": {
        const currentState = Boolean(document.queryCommandState("italic"));
        if (wasActive) {
          if (currentState) document.execCommand("italic", false, null);
        } else {
          if (!currentState) document.execCommand("italic", false, null);
        }
        break;
      }
      case "strike": {
        const currentState = Boolean(document.queryCommandState("strikeThrough"));
        if (wasActive) {
          if (currentState) document.execCommand("strikeThrough", false, null);
        } else {
          if (!currentState) document.execCommand("strikeThrough", false, null);
        }
        break;
      }
      case "h1":
      case "h2":
      case "h3": {
        const tag = action.toUpperCase();
        if (wasActive) {
          document.execCommand("formatBlock", false, "<p>");
        } else {
          document.execCommand("formatBlock", false, `<${tag}>`);
        }
        break;
      }
      case "ul": {
        const currentState = Boolean(document.queryCommandState("insertUnorderedList"));
        if (wasActive) {
          if (currentState) document.execCommand("insertUnorderedList", false, null);
        } else {
          if (!currentState) document.execCommand("insertUnorderedList", false, null);
        }
        break;
      }
      case "quote": {
        if (wasActive) {
          document.execCommand("formatBlock", false, "<p>");
        } else {
          document.execCommand("formatBlock", false, "<blockquote>");
        }
        break;
      }
      case "code": {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);
          const codeEl = document.createElement("code");
          codeEl.textContent = selection.toString();
          range.deleteContents();
          range.insertNode(codeEl);
          range.setStartAfter(codeEl);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          this.insertHtmlAtCursor("<code>code</code>&nbsp;");
        }
        break;
      }
      case "codeblock": {
        this.insertHtmlAtCursor('<pre><code>// Enter code here</code></pre><p><br></p>');
        break;
      }
      case "task": {
        const checklistHtml = '<div class="notes-checklist-row"><input type="checkbox" onchange="Notes.toggleChecklistRow(this)"> <span>Task item...</span></div><p><br></p>';
        this.insertHtmlAtCursor(checklistHtml);
        break;
      }
      case "table": {
        const tableHtml = `
          <table class="notes-table">
            <thead>
              <tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr>
            </thead>
            <tbody>
              <tr><td>Row 1, Col 1</td><td>Row 1, Col 2</td><td>Row 1, Col 3</td></tr>
              <tr><td>Row 2, Col 1</td><td>Row 2, Col 2</td><td>Row 2, Col 3</td></tr>
            </tbody>
          </table>
          <p><br></p>
        `;
        this.insertHtmlAtCursor(tableHtml);
        break;
      }
    }

    if (wasActive && btnId) {
      document.getElementById(btnId)?.classList.remove("active");
    }

    this.saveSelection();
    this.updateToolbarState();
    this.scheduleAutoSave();

    // Prevent viewport jumping on mobile
    if (window.scrollTo) {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    }
  },

  toggleChecklistRow(checkbox) {
    const row = checkbox.closest(".notes-checklist-row");
    if (!row) return;
    if (checkbox.checked) {
      row.classList.add("checked");
      checkbox.setAttribute("checked", "checked");
      const rect = checkbox.getBoundingClientRect ? checkbox.getBoundingClientRect() : null;
      const cx = rect ? rect.left + rect.width * 0.5 : window.innerWidth * 0.5;
      const cy = rect ? rect.top + rect.height * 0.5 : window.innerHeight * 0.35;
      if (typeof TactileFX !== "undefined") {
        TactileFX.onItemToggle({ completed: true, x: cx, y: cy });
      } else if (typeof WaveCanvas !== "undefined" && WaveCanvas.pulseActivity) {
        WaveCanvas.pulseActivity({ kind: "complete", x: cx, y: cy });
      }
    } else {
      row.classList.remove("checked");
      checkbox.removeAttribute("checked");
    }
    this.scheduleAutoSave();
  },

  insertHtmlAtCursor(html) {
    const editor = document.getElementById("noteContentArea");
    if (!editor) return;

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (editor.focus) {
      try {
        editor.focus({ preventScroll: true });
      } catch (e) {
        editor.focus();
      }
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = tempDiv.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      editor.innerHTML += html;
    }
    this.scheduleAutoSave();

    if (window.scrollTo) {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
    }
  },

  async handleFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    await this.uploadMedia(file);
    event.target.value = "";
  },

  async uploadMedia(file, isFolderUpload = false) {
    if (typeof App !== "undefined" && App.showToast) {
      App.showToast(`Uploading ${file.name}...`);
    }
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/notes/upload-media", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.url) {
        if (!isFolderUpload) {
          let mediaHtml = "";
          if (data.media_type === "image") {
            mediaHtml = `<div class="notes-media-wrapper"><img src="${data.url}" alt="${this.escapeHtml(data.filename)}" class="notes-inline-image" /><div class="notes-image-caption">${this.escapeHtml(data.filename)}</div></div><p><br></p>`;
          } else if (data.media_type === "video") {
            mediaHtml = `<div class="notes-media-wrapper"><video src="${data.url}" controls class="notes-inline-image"></video><div class="notes-image-caption">${this.escapeHtml(data.filename)}</div></div><p><br></p>`;
          } else if (data.media_type === "audio") {
            mediaHtml = `<div class="notes-media-wrapper"><audio src="${data.url}" controls></audio><div class="notes-image-caption">${this.escapeHtml(data.filename)}</div></div><p><br></p>`;
          } else {
            mediaHtml = `<p><a href="${data.url}" target="_blank" rel="noopener noreferrer">📎 ${this.escapeHtml(data.filename)}</a></p><p><br></p>`;
          }
          this.insertHtmlAtCursor(mediaHtml);
          this.scheduleAutoSave();
        }
        if (typeof App !== "undefined" && App.showToast) {
          App.showToast(`Uploaded ${file.name}!`, "success");
        }
        await this.loadMediaList();
      } else {
        if (typeof App !== "undefined" && App.showToast) {
          App.showToast("Media upload failed: " + (data.detail || "Server error"), true);
        }
      }
    } catch (err) {
      console.error(err);
      if (typeof App !== "undefined" && App.showToast) {
        App.showToast("Network error uploading media", true);
      }
    }
  },

  switchView(mode) {
    this.viewMode = mode;
    const notesBtn = document.getElementById("notesNavNotesBtn");
    const mediaBtn = document.getElementById("notesNavMediaBtn");
    const notesListView = document.getElementById("notesListViewSection");
    const mediaFiltersView = document.getElementById("notesMediaFiltersSection");
    const editorCard = document.getElementById("notesEditorCard");
    const mediaFolderCard = document.getElementById("notesMediaFolderCard");
    const activeNoteTitle = document.getElementById("notesMediaActiveNoteTitle");

    if (notesBtn) notesBtn.classList.toggle("active", mode === "notes");
    if (mediaBtn) mediaBtn.classList.toggle("active", mode === "media");

    if (notesListView) notesListView.style.display = mode === "notes" ? "block" : "none";
    if (mediaFiltersView) mediaFiltersView.style.display = mode === "media" ? "block" : "none";

    if (editorCard) editorCard.style.display = mode === "notes" ? "flex" : "none";
    if (mediaFolderCard) mediaFolderCard.style.display = mode === "media" ? "flex" : "none";

    if (mode === "media") {
      const titleInput = document.getElementById("noteTitleInput");
      if (activeNoteTitle) activeNoteTitle.textContent = (titleInput && titleInput.value.trim()) || "Untitled Note";
      this.loadMediaList();
    }
    if (window.lucide) window.lucide.createIcons();
  },

  async loadMediaList() {
    try {
      const res = await fetch("/api/notes/media");
      if (!res.ok) return;
      const data = await res.json();
      this.mediaItems = data.media || [];

      // Update badges & stats
      const countBadge = document.getElementById("notesMediaCountBadge");
      const folderBadge = document.getElementById("notesMediaFolderBadge");
      const totalSize = document.getElementById("notesMediaTotalSize");
      if (countBadge) countBadge.textContent = this.mediaItems.length;
      if (folderBadge) folderBadge.textContent = `${this.mediaItems.length} item${this.mediaItems.length === 1 ? '' : 's'}`;
      if (totalSize) totalSize.textContent = data.total_formatted || "0 B";

      // Update filter counts
      const allCount = document.getElementById("mediaFilterAllCount");
      const imgCount = document.getElementById("mediaFilterImageCount");
      const vidCount = document.getElementById("mediaFilterVideoCount");
      const audCount = document.getElementById("mediaFilterAudioCount");
      const fileCount = document.getElementById("mediaFilterFileCount");

      if (allCount) allCount.textContent = this.mediaItems.length;
      if (imgCount) imgCount.textContent = this.mediaItems.filter(m => m.media_type === "image").length;
      if (vidCount) vidCount.textContent = this.mediaItems.filter(m => m.media_type === "video").length;
      if (audCount) audCount.textContent = this.mediaItems.filter(m => m.media_type === "audio").length;
      if (fileCount) fileCount.textContent = this.mediaItems.filter(m => !["image", "video", "audio"].includes(m.media_type)).length;

      this.renderMediaGrid();
    } catch (err) {
      console.error("Failed to load scratchpad media:", err);
    }
  },

  async refreshMediaList() {
    await this.loadMediaList();
    if (typeof App !== "undefined" && App.showToast) {
      App.showToast("Refreshed media folder", "success");
    }
  },

  filterMedia(type) {
    this.activeMediaFilter = type;
    document.querySelectorAll(".media-filter-chip").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.filter === type);
    });
    this.renderMediaGrid();
  },

  searchMedia(query) {
    this.mediaSearchQuery = (query || "").trim().toLowerCase();
    this.renderMediaGrid();
  },

  renderMediaGrid() {
    const grid = document.getElementById("notesMediaGrid");
    const empty = document.getElementById("notesMediaEmptyState");
    if (!grid) return;

    let filtered = this.mediaItems;
    if (this.activeMediaFilter !== "all") {
      if (this.activeMediaFilter === "file") {
        filtered = filtered.filter(m => !["image", "video", "audio"].includes(m.media_type));
      } else {
        filtered = filtered.filter(m => m.media_type === this.activeMediaFilter);
      }
    }

    if (this.mediaSearchQuery) {
      filtered = filtered.filter(m =>
        (m.display_name || m.filename).toLowerCase().includes(this.mediaSearchQuery)
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = "";
      if (empty) empty.style.display = "flex";
      return;
    }

    if (empty) empty.style.display = "none";

    grid.innerHTML = filtered.map(item => {
      const isImg = item.media_type === "image";
      const isVid = item.media_type === "video";
      const isAud = item.media_type === "audio";

      const fnArg = App.escapeJsAttr(item.filename);
      let previewHtml = "";
      if (isImg) {
        previewHtml = `
          <div class="media-card-preview image-preview" onclick="Notes.openMediaLightbox(${fnArg})">
            <img src="${item.url}" alt="${this.escapeHtml(item.display_name)}" loading="lazy" />
            <div class="media-card-zoom-hint"><i data-lucide="zoom-in" style="width:16px;height:16px;"></i></div>
          </div>`;
      } else if (isVid) {
        previewHtml = `
          <div class="media-card-preview video-preview" onclick="Notes.openMediaLightbox(${fnArg})">
            <i data-lucide="video" style="width:36px;height:36px;color:var(--focus-indigo);"></i>
            <span class="media-type-tag">VIDEO</span>
            <div class="media-card-zoom-hint"><i data-lucide="play" style="width:16px;height:16px;"></i></div>
          </div>`;
      } else if (isAud) {
        previewHtml = `
          <div class="media-card-preview audio-preview" onclick="Notes.openMediaLightbox(${fnArg})">
            <i data-lucide="volume-2" style="width:36px;height:36px;color:var(--recurrence-purple);"></i>
            <span class="media-type-tag">AUDIO</span>
            <div class="media-card-zoom-hint"><i data-lucide="play" style="width:16px;height:16px;"></i></div>
          </div>`;
      } else {
        previewHtml = `
          <div class="media-card-preview doc-preview" onclick="Notes.openMediaLightbox(${fnArg})">
            <i data-lucide="file-text" style="width:36px;height:36px;color:var(--text-muted);"></i>
            <span class="media-type-tag">${(item.media_type || "FILE").toUpperCase()}</span>
            <div class="media-card-zoom-hint"><i data-lucide="external-link" style="width:16px;height:16px;"></i></div>
          </div>`;
      }

      return `
        <div class="notes-media-card" data-filename="${this.escapeHtml(item.filename)}">
          ${previewHtml}
          <div class="media-card-meta">
            <div class="media-card-title" title="${this.escapeHtml(item.display_name)}">
              ${this.escapeHtml(item.display_name)}
            </div>
            <div class="media-card-details">
              <span>${item.size_formatted}</span>
              <span>•</span>
              <span>${item.created_at ? item.created_at.slice(0, 10) : ''}</span>
            </div>
          </div>
          <div class="media-card-actions">
            <button type="button" class="media-card-action-btn select-btn" onclick="Notes.selectMediaForNote(${fnArg})" title="Insert this media into your current note">
              <i data-lucide="plus" style="width:12px;height:12px;"></i> Insert
            </button>
            <button type="button" class="media-card-action-btn view-btn" onclick="Notes.openMediaLightbox(${fnArg})" title="View / Preview">
              <i data-lucide="eye" style="width:12px;height:12px;"></i> View
            </button>
            <button type="button" class="media-card-action-btn delete-btn" onclick="Notes.confirmDeleteMedia(${fnArg})" title="Delete permanently">
              <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  },

  selectMediaForNote(filename) {
    const item = this.mediaItems.find(m => m.filename === filename);
    if (!item) return;

    let mediaHtml = "";
    if (item.media_type === "image") {
      mediaHtml = `<div class="notes-media-wrapper"><img src="${item.url}" alt="${this.escapeHtml(item.display_name)}" class="notes-inline-image" /><div class="notes-image-caption">${this.escapeHtml(item.display_name)}</div></div><p><br></p>`;
    } else if (item.media_type === "video") {
      mediaHtml = `<div class="notes-media-wrapper"><video src="${item.url}" controls class="notes-inline-image"></video><div class="notes-image-caption">${this.escapeHtml(item.display_name)}</div></div><p><br></p>`;
    } else if (item.media_type === "audio") {
      mediaHtml = `<div class="notes-media-wrapper"><audio src="${item.url}" controls></audio><div class="notes-image-caption">${this.escapeHtml(item.display_name)}</div></div><p><br></p>`;
    } else {
      mediaHtml = `<p><a href="${item.url}" target="_blank" rel="noopener noreferrer">📎 ${this.escapeHtml(item.display_name)}</a></p><p><br></p>`;
    }

    this.switchView("notes");
    const editor = document.getElementById("noteContentArea");
    if (editor) {
      editor.focus();
      this.insertHtmlAtCursor(mediaHtml);
      this.scheduleAutoSave();
    }

    if (typeof App !== "undefined" && App.showToast) {
      App.showToast(`Selected & inserted ${item.display_name} into note`, "success");
    }
  },

  openMediaLightbox(filename) {
    const item = this.mediaItems.find(m => m.filename === filename);
    if (!item) return;

    this.activeLightboxItem = item;
    const modal = document.getElementById("notesMediaLightboxModal");
    const title = document.getElementById("notesLightboxTitle");
    const pill = document.getElementById("notesLightboxTypePill");
    const content = document.getElementById("notesLightboxContent");
    const meta = document.getElementById("notesLightboxMeta");
    const actions = document.getElementById("notesLightboxActions");

    if (!modal) return;

    if (title) title.textContent = item.display_name;
    if (pill) pill.textContent = (item.media_type || "FILE").toUpperCase();

    if (content) {
      if (item.media_type === "image") {
        content.innerHTML = `<img src="${item.url}" alt="${this.escapeHtml(item.display_name)}" class="lightbox-preview-image" />`;
      } else if (item.media_type === "video") {
        content.innerHTML = `<video src="${item.url}" controls autoplay class="lightbox-preview-video"></video>`;
      } else if (item.media_type === "audio") {
        content.innerHTML = `<div class="lightbox-audio-player"><i data-lucide="volume-2" style="width:48px;height:48px;color:var(--recurrence-purple);margin-bottom:12px;"></i><audio src="${item.url}" controls autoplay></audio></div>`;
      } else {
        content.innerHTML = `
          <div class="lightbox-doc-view">
            <i data-lucide="file-text" style="width:54px;height:54px;color:var(--text-muted);margin-bottom:12px;"></i>
            <div style="font-weight:700;font-size:16px;">${this.escapeHtml(item.display_name)}</div>
            <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${item.size_formatted}</div>
            <a href="${item.url}" download="${this.escapeHtml(item.display_name)}" class="action-icon-btn" style="margin-top:16px;background:var(--focus-indigo);color:#fff;padding:8px 16px;font-weight:600;border:none;">
              <i data-lucide="download" style="width:14px;height:14px;display:inline-block;vertical-align:-1px;"></i> Download File
            </a>
          </div>`;
      }
    }

    if (meta) {
      meta.innerHTML = `
        <span>Size: <strong>${item.size_formatted}</strong></span> • 
        <span>Uploaded: <strong>${item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : ''}</strong></span>
      `;
    }

    if (actions) {
      const fnArg = App.escapeJsAttr(item.filename);
      actions.innerHTML = `
        <button type="button" class="action-icon-btn" onclick="Notes.selectMediaForNote(${fnArg}); Notes.closeMediaLightbox();" style="background:var(--focus-indigo);color:#fff;font-weight:600;border:none;">
          <i data-lucide="plus" style="width:13px;height:13px;display:inline-block;vertical-align:-1px;"></i> Insert into Note
        </button>
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="action-icon-btn" style="color:var(--text-main);">
          <i data-lucide="external-link" style="width:13px;height:13px;display:inline-block;vertical-align:-1px;"></i> Open URL
        </a>
        <button type="button" class="action-icon-btn" onclick="Notes.confirmDeleteMedia(${fnArg})" style="color:var(--urgent-orange);">
          <i data-lucide="trash-2" style="width:13px;height:13px;display:inline-block;vertical-align:-1px;"></i> Delete
        </button>
      `;
    }

    modal.style.display = "flex";
    if (window.lucide) window.lucide.createIcons();
  },

  closeMediaLightbox(e) {
    if (e && e.target && e.target.id !== "notesMediaLightboxModal") return;
    const modal = document.getElementById("notesMediaLightboxModal");
    if (modal) {
      const media = modal.querySelectorAll("video, audio");
      media.forEach(m => { m.pause(); m.src = ""; });
      modal.style.display = "none";
    }
    this.activeLightboxItem = null;
  },

  async confirmDeleteMedia(filename) {
    const item = this.mediaItems.find(m => m.filename === filename);
    const displayName = item ? item.display_name : filename;
    const ok = await App.confirmAction({
      title: `Delete "${displayName}"?`,
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/notes/media/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        this.mediaItems = this.mediaItems.filter(m => m.filename !== filename);
        this.closeMediaLightbox();
        await this.loadMediaList();
        if (typeof App !== "undefined" && App.showToast) {
          App.showToast(`Deleted ${displayName}`, "success");
        }
      } else {
        const err = await res.json();
        if (typeof App !== "undefined" && App.showToast) {
          App.showToast(err.detail || "Failed to delete media", true);
        }
      }
    } catch (err) {
      console.error("Delete media error:", err);
      if (typeof App !== "undefined" && App.showToast) {
        App.showToast("Network error deleting media", true);
      }
    }
  },

  async handleFolderUploadInput(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await this.uploadMedia(files[i], true);
    }
    event.target.value = "";
    await this.loadMediaList();
  },

  handleMediaDropzoneOver(e) {
    e.preventDefault();
    const dz = document.getElementById("notesMediaDropzone");
    if (dz) dz.classList.add("drag-over");
  },

  handleMediaDropzoneLeave(e) {
    const dz = document.getElementById("notesMediaDropzone");
    if (dz) dz.classList.remove("drag-over");
  },

  async handleMediaDropzoneDrop(e) {
    e.preventDefault();
    const dz = document.getElementById("notesMediaDropzone");
    if (dz) dz.classList.remove("drag-over");

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        await this.uploadMedia(e.dataTransfer.files[i], true);
      }
      await this.loadMediaList();
    }
  },

  simpleMarkdownToHtml(text) {
    if (!text) return '<p><br></p>';
    let html = this.escapeHtml(text);

    // Code blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre><code>${p1}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="notes-media-wrapper"><img src="$2" alt="$1" class="notes-inline-image" /><div class="notes-image-caption">$1</div></div>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold, italic, strikethrough
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Checkboxes
    html = html.replace(/^- \[x\] (.*$)/gim, '<div class="notes-checklist-row checked"><input type="checkbox" checked onchange="Notes.toggleChecklistRow(this)"> <span>$1</span></div>');
    html = html.replace(/^- \[ \] (.*$)/gim, '<div class="notes-checklist-row"><input type="checkbox" onchange="Notes.toggleChecklistRow(this)"> <span>$1</span></div>');

    // Bullet lists
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

    // Blockquote
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Wrap paragraphs if needed
    html = html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    if (!html.startsWith('<')) {
      html = `<p>${html}</p>`;
    }

    return html;
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.Notes = Notes;
