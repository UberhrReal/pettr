/**
 * PETTR Notes Module
 * Unified In-Place Rich-Text Scratchpad with Instant Formatting, Media Embeds, and Drag-and-Drop
 */
const Notes = {
  currentNoteId: null,
  saveTimeout: null,

  async init() {
    this.bindEvents();
    await this.loadNotes();
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
      btn.dataset.noteId = n.id;
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
    const editor = document.getElementById("noteContentArea");
    if (titleInput) titleInput.value = note.title;
    if (editor) {
      let content = note.content || "";
      // If legacy content has markdown and does not have HTML block tags, convert so it displays styled immediately
      if (content && !/<(p|div|h[1-6]|ul|ol|table|blockquote|pre)[^>]*>/i.test(content)) {
        content = this.simpleMarkdownToHtml(content);
      }
      editor.innerHTML = content;
    }
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Saved";

    // Highlight sidebar item
    const buttons = document.querySelectorAll("#notesListSidebar .tab-btn");
    buttons.forEach(btn => {
      if (btn.dataset.noteId == this.currentNoteId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  },

  createNewNote() {
    this.currentNoteId = null;
    const titleInput = document.getElementById("noteTitleInput");
    const editor = document.getElementById("noteContentArea");
    if (titleInput) titleInput.value = "Quick Scratchpad";
    if (editor) editor.innerHTML = "";
    const statusEl = document.getElementById("noteSaveStatus");
    if (statusEl) statusEl.textContent = "Unsaved draft";
    if (editor) editor.focus();
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
          content: content
        })
      });
      const data = await res.json();
      if (data.note) {
        this.currentNoteId = data.note.id;
        const statusEl = document.getElementById("noteSaveStatus");
        if (statusEl) statusEl.textContent = `Auto-saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const listRes = await fetch("/api/notes");
        if (listRes.ok) {
          const notes = await listRes.json();
          this.renderSidebar(notes);
        }
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
        let mediaHtml = "";
        if (data.media_type === "image") {
          mediaHtml = `<div class="notes-media-wrapper"><img src="${data.url}" alt="${data.filename}" class="notes-inline-image" /><div class="notes-image-caption">${data.filename}</div></div><p><br></p>`;
        } else if (data.media_type === "video") {
          mediaHtml = `<div class="notes-media-wrapper"><video src="${data.url}" controls class="notes-inline-image"></video><div class="notes-image-caption">${data.filename}</div></div><p><br></p>`;
        } else if (data.media_type === "audio") {
          mediaHtml = `<div class="notes-media-wrapper"><audio src="${data.url}" controls></audio><div class="notes-image-caption">${data.filename}</div></div><p><br></p>`;
        } else {
          mediaHtml = `<p><a href="${data.url}" target="_blank" rel="noopener noreferrer">📎 ${data.filename}</a></p><p><br></p>`;
        }
        this.insertHtmlAtCursor(mediaHtml);
        App.showToast(`Uploaded ${file.name}!`);
      } else {
        App.showToast("Media upload failed: " + (data.detail || "Server error"), true);
      }
    } catch (err) {
      console.error(err);
      App.showToast("Network error uploading media", true);
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
