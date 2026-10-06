/**
 * PETTR Notes Module
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
    const contentArea = document.getElementById("noteContentArea");

    titleInput.addEventListener("input", () => this.scheduleAutoSave());
    contentArea.addEventListener("input", () => this.scheduleAutoSave());
  },

  scheduleAutoSave() {
    document.getElementById("noteSaveStatus").textContent = "Saving...";
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
    document.getElementById("noteTitleInput").value = note.title;
    document.getElementById("noteContentArea").value = note.content;
    document.getElementById("noteSaveStatus").textContent = "Saved";
    this.loadNotes(); // Update active highlights
  },

  createNewNote() {
    this.currentNoteId = null;
    document.getElementById("noteTitleInput").value = "Quick Scratchpad";
    document.getElementById("noteContentArea").value = "";
    document.getElementById("noteSaveStatus").textContent = "Unsaved draft";
    document.getElementById("noteContentArea").focus();
  },

  async saveCurrentNote() {
    const title = document.getElementById("noteTitleInput").value.trim() || "Untitled Note";
    const content = document.getElementById("noteContentArea").value;

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
        document.getElementById("noteSaveStatus").textContent = `Auto-saved at ${new Date().toLocaleTimeString()}`;
        // Refresh sidebar
        const listRes = await fetch("/api/notes");
        const notes = await listRes.json();
        this.renderSidebar(notes);
      }
    } catch (err) {
      document.getElementById("noteSaveStatus").textContent = "Error saving";
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
    const content = document.getElementById("noteContentArea").value.trim();
    if (!content) {
      App.showToast("Note is empty!");
      return;
    }
    // Take first line or prompt
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

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
