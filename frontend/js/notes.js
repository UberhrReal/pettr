/**
 * PETTR Notes Module
 * Scratchpad with rich styling tools, media uploads, drag-drop/paste images, and live markdown preview
 */
const Notes = {
  currentNoteId: null,
  saveTimeout: null,
  viewMode: "write", // "write" or "preview"

  async init() {
    this.bindEvents();
    await this.loadNotes();
  },

  bindEvents() {
    const titleInput = document.getElementById("noteTitleInput");
    const contentArea = document.getElementById("noteContentArea");

    if (titleInput) {
      titleInput.addEventListener("input", () => this.scheduleAutoSave());
    }

    if (contentArea) {
      contentArea.addEventListener("input", () => {
        this.scheduleAutoSave();
        if (this.viewMode === "preview") {
          this.renderPreview();
        }
      });

      // Handle image/media paste directly from clipboard
      contentArea.addEventListener("paste", (e) => {
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
      contentArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        contentArea.classList.add("drag-over");
      });
      contentArea.addEventListener("dragleave", () => {
        contentArea.classList.remove("drag-over");
      });
      contentArea.addEventListener("drop", (e) => {
        e.preventDefault();
        contentArea.classList.remove("drag-over");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          for (let i = 0; i < e.dataTransfer.files.length; i++) {
            this.uploadMedia(e.dataTransfer.files[i]);
          }
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

  async loadNotes() {
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) return;
      const notes = await res.json();
      this.renderSidebar(notes);

      if (notes.length > 0 && !this.currentNoteId) {
        this.selectNote(notes[0]);
      } else if (notes.length === 0) {
        this.createNewNote();
      }
    } catch (err) {
      console.error("Error loading notes:", err);
    }
  },

  renderSidebar(notes) {
    const sidebar = document.getElementById("notesListSidebar");
    if (!sidebar) return;
    sidebar.innerHTML = "";

    notes.forEach(n => {
      const btn = document.createElement("button");
      btn.className = `tab-btn ${n.id === this.currentNoteId ? 'active' : ''}`;
      btn.style.width = "100%";
      btn.style.justifyContent = "flex-start";
      btn.style.textAlign = "left";
      btn.innerHTML = `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📄 ${this.escapeHtml(n.title)}</span>`;
      btn.onclick = () => this.selectNote(n);
      sidebar.appendChild(btn);
    });
  },

  selectNote(note) {
    this.currentNoteId = note.id;
    const titleInput = document.getElementById("noteTitleInput");
    const contentArea = document.getElementById("noteContentArea");
    if (titleInput) titleInput.value = note.title;
    if (contentArea) contentArea.value = note.content;
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Saved";
    if (this.viewMode === "preview") {
      this.renderPreview();
    }
    this.loadNotes(); // Update active highlights
  },

  createNewNote() {
    this.currentNoteId = null;
    const titleInput = document.getElementById("noteTitleInput");
    const contentArea = document.getElementById("noteContentArea");
    if (titleInput) titleInput.value = "Quick Scratchpad";
    if (contentArea) contentArea.value = "";
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Unsaved draft";
    this.switchView("write");
    if (contentArea) contentArea.focus();
  },

  async saveCurrentNote() {
    const title = (document.getElementById("noteTitleInput")?.value || "").trim() || "Untitled Note";
    const content = document.getElementById("noteContentArea")?.value || "";

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: this.currentNoteId,
          title: title,
          content: content
        })
      });
      const data = await res.json();
      if (data.note) {
        this.currentNoteId = data.note.id;
        const statusEl = document.getElementById("noteSaveStatus");
        if (statusEl) statusEl.textContent = `Auto-saved at ${new Date().toLocaleTimeString()}`;
        // Refresh sidebar
        const listRes = await fetch("/api/notes");
        const notes = await listRes.json();
        this.renderSidebar(notes);
      }
    } catch (err) {
      const statusEl = document.getElementById("noteSaveStatus");
      if (statusEl) statusEl.textContent = "Error saving";
    }
  },

  async deleteCurrentNote() {
    if (!this.currentNoteId) return;
    if (!confirm("Delete this note?")) return;
    try {
      await fetch(`/api/notes/${this.currentNoteId}`, { method: "DELETE" });
      this.currentNoteId = null;
      await this.loadNotes();
      App.showToast("Note deleted");
    } catch (err) {
      console.error(err);
    }
  },

  async parseCurrentNote() {
    const content = (document.getElementById("noteContentArea")?.value || "").trim();
    if (!content) {
      App.showToast("Note is empty!");
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
    await Dashboard.refresh();
  },

  switchView(mode) {
    this.viewMode = mode;
    const writeBtn = document.getElementById("noteWriteTabBtn");
    const prevBtn = document.getElementById("notePreviewTabBtn");
    const editPane = document.getElementById("notesEditPane");
    const prevPane = document.getElementById("notesPreviewPane");
    const toolbar = document.getElementById("notesToolbar");

    if (mode === "preview") {
      if (writeBtn) writeBtn.classList.remove("active");
      if (prevBtn) prevBtn.classList.add("active");
      if (editPane) editPane.style.display = "none";
      if (prevPane) prevPane.style.display = "block";
      if (toolbar) toolbar.style.opacity = "0.5";
      this.renderPreview();
    } else {
      if (writeBtn) writeBtn.classList.add("active");
      if (prevBtn) prevBtn.classList.remove("active");
      if (editPane) editPane.style.display = "block";
      if (prevPane) prevPane.style.display = "none";
      if (toolbar) toolbar.style.opacity = "1";
    }
  },

  renderPreview() {
    const prevPane = document.getElementById("notesPreviewPane");
    const content = document.getElementById("noteContentArea")?.value || "";
    if (!prevPane) return;

    if (typeof marked !== "undefined" && marked.parse) {
      prevPane.innerHTML = marked.parse(content);
    } else {
      prevPane.innerHTML = this.simpleMarkdownToHtml(content);
    }
  },

  simpleMarkdownToHtml(text) {
    if (!text) return '<p style="color:var(--text-muted);font-style:italic;">Empty note</p>';
    let html = this.escapeHtml(text);

    // Code blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
      return `<pre class="notes-preview-code"><code>${p1}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="notes-inline-code">$1</code>');

    // Images ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="notes-preview-img-wrap"><img src="$2" alt="$1" class="notes-preview-img" /><span class="notes-img-caption">$1</span></div>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="notes-preview-link">$1</a>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="notes-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="notes-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="notes-h1">$1</h1>');

    // Bold, italic, strikethrough
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Checkboxes
    html = html.replace(/^- \[x\] (.*$)/gim, '<div class="notes-checkbox checked"><input type="checkbox" checked disabled> <s>$1</s></div>');
    html = html.replace(/^- \[ \] (.*$)/gim, '<div class="notes-checkbox"><input type="checkbox" disabled> $1</div>');

    // Bullet lists
    html = html.replace(/^- (.*$)/gim, '<li class="notes-li">$1</li>');
    html = html.replace(/(<li class="notes-li">.*<\/li>)/gims, '<ul class="notes-ul">$1</ul>');

    // Blockquote
    html = html.replace(/^> (.*$)/gim, '<blockquote class="notes-quote">$1</blockquote>');

    // Table parsing (simple pipe tables)
    html = html.replace(/(\|.+?\|\r?\n\|[-:\s|]+?\|\r?\n(?:\|.+?\|\r?\n?)+)/g, (tableMatch) => {
      const rows = tableMatch.trim().split("\n").map(r => r.trim());
      if (rows.length < 2) return tableMatch;
      const headers = rows[0].split("|").filter((c, i, a) => i > 0 && i < a.length - 1).map(c => `<th>${c.trim()}</th>`).join("");
      const bodyRows = rows.slice(2).map(row => {
        const cols = row.split("|").filter((c, i, a) => i > 0 && i < a.length - 1).map(c => `<td>${c.trim()}</td>`).join("");
        return `<tr>${cols}</tr>`;
      }).join("");
      return `<table class="notes-preview-table"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    });

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  },

  format(action) {
    const area = document.getElementById("noteContentArea");
    if (!area) return;
    area.focus();

    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = area.value.substring(start, end);

    let before = "";
    let after = "";
    let placeholder = "";

    switch(action) {
      case "bold":
        before = "**"; after = "**"; placeholder = "bold text";
        break;
      case "italic":
        before = "*"; after = "*"; placeholder = "italic text";
        break;
      case "strike":
        before = "~~"; after = "~~"; placeholder = "strikethrough";
        break;
      case "h1":
        before = "# "; placeholder = "Heading 1";
        break;
      case "h2":
        before = "## "; placeholder = "Heading 2";
        break;
      case "h3":
        before = "### "; placeholder = "Heading 3";
        break;
      case "ul":
        before = "- "; placeholder = "List item";
        break;
      case "task":
        before = "- [ ] "; placeholder = "Task item";
        break;
      case "code":
        before = "`"; after = "`"; placeholder = "code";
        break;
      case "codeblock":
        before = "```\n"; after = "\n```"; placeholder = "// Code snippet";
        break;
      case "quote":
        before = "> "; placeholder = "Quote";
        break;
      case "table":
        before = "| Column 1 | Column 2 |\n|---|---|\n| Item 1 | Item 2 |\n";
        break;
    }

    const insertText = selected ? `${before}${selected}${after}` : `${before}${placeholder}${after}`;
    this.insertTextAtCursor(insertText);
  },

  insertTextAtCursor(text) {
    const area = document.getElementById("noteContentArea");
    if (!area) return;
    area.focus();
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const val = area.value;
    area.value = val.substring(0, start) + text + val.substring(end);
    area.selectionStart = area.selectionEnd = start + text.length;
    this.scheduleAutoSave();
    if (this.viewMode === "preview") this.renderPreview();
  },

  async handleFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    await this.uploadMedia(file);
    event.target.value = "";
  },

  async uploadMedia(file) {
    App.showToast(`Uploading ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/notes/upload-media", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.url) {
        const isImage = file.type.startsWith("image/");
        const tag = isImage ? `\n![${file.name}](${data.url})\n` : `\n[${file.name}](${data.url})\n`;
        this.insertTextAtCursor(tag);
        App.showToast(`Uploaded ${file.name}!`);
      } else {
        App.showToast("Media upload failed: " + (data.detail || "Server error"), true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error uploading media", true);
    }
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
