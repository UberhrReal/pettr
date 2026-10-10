/**
 * Horace Chat: Collapsible Side Panel Controller for Local LLM
 * 
 * Horace is the home server host running PETTR. He provides persistent chat,
 * witty/sarcastic/cheerful banter, and smart task insights.
 */

const HoraceChat = {
  isOpen: false,
  messages: [],
  isSending: false,
  activeModel: "Local LLM",
  isOnline: false,

  init() {
    this.bindEvents();
    this.checkStatus();
    this.loadHistory();

    // Restore opened state from localStorage if user previously kept it open
    try {
      const savedState = localStorage.getItem("pettr_horace_open");
      if (savedState === "true" && window.innerWidth > 900) {
        this.open(false);
      }
    } catch (e) {}
  },

  bindEvents() {
    // Escape key closes panel
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
      // Shortcut: Alt+H or Cmd/Ctrl+Shift+H to toggle Horace
      if ((e.altKey && e.key.toLowerCase() === "h") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h")) {
        e.preventDefault();
        this.toggle();
      }
    });
  },

  async checkStatus() {
    try {
      const res = await fetch("/api/llm/status");
      if (res.ok) {
        const data = await res.json();
        this.isOnline = !!data.online;
        this.activeModel = data.active_model || "llama3.2:latest";
        this.updateStatusUI();
      }
    } catch (e) {
      this.isOnline = false;
      this.updateStatusUI();
    }
  },

  updateStatusUI() {
    const dot = document.getElementById("horaceStatusDot");
    const badge = document.getElementById("horaceModelBadge");
    const footerModel = document.getElementById("horaceFooterModel");
    const sub = document.getElementById("horaceStatusSubtitle");

    if (dot) {
      dot.className = `horace-status-dot ${this.isOnline ? "online" : "offline"}`;
      dot.title = this.isOnline ? `Horace online · ${this.activeModel}` : "Horace offline (Ollama unreachable on port 11434)";
    }
    if (badge) {
      badge.textContent = this.isOnline ? this.activeModel : "Offline Mode";
      badge.className = `horace-badge ${this.isOnline ? "online" : "offline"}`;
    }
    if (footerModel) {
      footerModel.textContent = this.isOnline ? `Local ${this.activeModel}` : "Bare-metal fallback";
    }
    if (sub) {
      sub.textContent = this.isOnline
        ? "Because everything needs an AI agent now"
        : "Ollama offline · Fallback mode";
    }
  },

  async loadHistory() {
    try {
      const res = await fetch("/api/llm/chat/history");
      if (res.ok) {
        const data = await res.json();
        this.messages = data.messages || [];
        this.renderMessages();
      }
    } catch (e) {
      console.warn("Failed to load Horace chat history:", e);
    }
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open(focusInput = true) {
    this.isOpen = true;
    const panel = document.getElementById("horacePanel");
    const backdrop = document.getElementById("horaceBackdrop");
    const btn = document.getElementById("horaceToggleBtn");

    if (panel) {
      panel.classList.add("open");
      panel.style.display = "flex";
    }
    if (backdrop) backdrop.classList.add("open");
    if (btn) btn.classList.add("active");

    try {
      localStorage.setItem("pettr_horace_open", "true");
    } catch (e) {}

    this.checkStatus();
    this.scrollToBottom();

    if (focusInput) {
      setTimeout(() => {
        const input = document.getElementById("horaceInput");
        if (input) input.focus();
      }, 150);
    }
  },

  close() {
    this.isOpen = false;
    const panel = document.getElementById("horacePanel");
    const backdrop = document.getElementById("horaceBackdrop");
    const btn = document.getElementById("horaceToggleBtn");

    if (panel) {
      panel.classList.remove("open");
      setTimeout(() => {
        if (!this.isOpen) panel.style.display = "none";
      }, 300);
    }
    if (backdrop) backdrop.classList.remove("open");
    if (btn) btn.classList.remove("active");

    try {
      localStorage.setItem("pettr_horace_open", "false");
    } catch (e) {}
  },

  formatTime(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return "";
    }
  },

  renderMessages() {
    const container = document.getElementById("horaceMessages");
    if (!container) return;

    if (!this.messages || this.messages.length === 0) {
      const userName = (typeof Dashboard !== "undefined" && Dashboard.userName) || localStorage.getItem("pettr_user_name") || "there";
      container.innerHTML = `
        <div class="horace-welcome-card">
          <div class="horace-welcome-avatar">
            <i data-lucide="bot"></i>
          </div>
          <div class="horace-welcome-title">Yo ${this.escapeHtml(userName)}! I'm Horace.</div>
          <p class="horace-welcome-text">
            I'm the home server machine keeping this entire PETTR rig running. 
            PETTR is my little brother, so I keep his SQLite database tidy and his queues moving. 
            Ask me anything about today's tasks, let me roast your backlog, or chat server telemetry.
          </p>
          <div class="horace-suggestion-chips">
            <button class="horace-chip" onclick="HoraceChat.sendPresetPrompt('How\\'s the server doing, Horace?')">
              🖥️ How's the server doing?
            </button>
            <button class="horace-chip" onclick="HoraceChat.sendPresetPrompt('What\\'s on my plate today, Horace?')">
              📋 What's on my plate today?
            </button>
            <button class="horace-chip" onclick="HoraceChat.sendPresetPrompt('Help me pick and conquer my #1 Focus task.')">
              🎯 Help me pick my Focus task
            </button>
            <button class="horace-chip" onclick="HoraceChat.sendPresetPrompt('Roast my task list and tell me what I\\'m putting off.')">
              🔥 Roast my task list
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = "";
    this.messages.forEach(msg => {
      const isUser = msg.role === "user";
      const timeStr = this.formatTime(msg.created_at);
      const formattedContent = isUser ? this.escapeHtml(msg.content) : this.renderMarkdown(msg.content);

      if (isUser) {
        html += `
          <div class="horace-msg-row user">
            <div class="horace-msg-bubble user">
              <div class="horace-msg-content">${formattedContent}</div>
              ${timeStr ? `<div class="horace-msg-time">${timeStr}</div>` : ""}
            </div>
          </div>
        `;
      } else {
        const isNew = msg._isNew ? " just-arrived" : "";
        html += `
          <div class="horace-msg-row assistant">
            <div class="horace-msg-avatar" title="Horace (${msg.model || 'Local'})">
              <i data-lucide="bot"></i>
            </div>
            <div class="horace-msg-bubble assistant${isNew}">
              <div class="horace-msg-sender">
                <span class="horace-msg-name">Horace</span>
                <span class="horace-msg-model-tag">${this.escapeHtml(msg.model || this.activeModel)}</span>
              </div>
              <div class="horace-msg-content markdown-body">${formattedContent}</div>
              ${timeStr ? `<div class="horace-msg-time">${timeStr}</div>` : ""}
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    this.scrollToBottom();
  },

  scrollToBottom() {
    const body = document.getElementById("horaceMessageBody");
    if (body) {
      setTimeout(() => {
        body.scrollTop = body.scrollHeight;
      }, 50);
    }
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  renderMarkdown(text) {
    if (!text) return "";
    let s = this.escapeHtml(text);

    // Multiline Code Blocks: ```lang ... ```
    s = s.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="horace-code-block"><div class="code-header"><span>${lang || 'code'}</span><button class="code-copy-btn" onclick="HoraceChat.copyCode(this)">Copy</button></div><code>${code.trim()}</code></pre>`;
    });

    // Inline Code: `code`
    s = s.replace(/`([^`]+)`/g, '<code class="horace-inline-code">$1</code>');

    // Bold: **text** or __text__
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers: ### Header
    s = s.replace(/^### (.*$)/gim, '<h4 class="horace-md-h4">$1</h4>');
    s = s.replace(/^## (.*$)/gim, '<h3 class="horace-md-h3">$1</h3>');

    // Unordered Lists: - item or * item
    s = s.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="horace-md-li">$1</li>');
    s = s.replace(/(<li class="horace-md-li">[\s\S]*?<\/li>)/g, '<ul class="horace-md-ul">$1</ul>');
    // Consolidate adjacent ul tags
    s = s.replace(/<\/ul>\s*<ul class="horace-md-ul">/g, '');

    // Numbered lists
    s = s.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="horace-md-li-num"><strong>$1.</strong> $2</li>');
    s = s.replace(/(<li class="horace-md-li-num">[\s\S]*?<\/li>)/g, '<ol class="horace-md-ol">$1</ol>');
    s = s.replace(/<\/ol>\s*<ol class="horace-md-ol">/g, '');

    // Convert double linebreaks to paragraphs, single linebreaks to <br>
    const paras = s.split(/\n{2,}/);
    if (paras.length > 1) {
      s = paras.map(p => {
        p = p.trim();
        if (!p) return "";
        if (p.startsWith("<pre") || p.startsWith("<ul") || p.startsWith("<ol") || p.startsWith("<h")) return p;
        return `<p class="horace-md-p">${p.replace(/\n/g, '<br>')}</p>`;
      }).filter(Boolean).join("");
    } else {
      s = s.replace(/\n/g, '<br>');
    }

    return s;
  },

  copyCode(btn) {
    const code = btn.closest(".horace-code-block").querySelector("code");
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(() => {
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  },

  sendPresetPrompt(promptText) {
    const input = document.getElementById("horaceInput");
    if (input) input.value = promptText;
    this.handleSubmit();
  },

  autoResizeInput(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 130);
    textarea.style.height = `${newHeight}px`;
  },

  handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSubmit(event);
    }
  },

  async handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (this.isSending) return;

    const input = document.getElementById("horaceInput");
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Reset input
    input.value = "";
    input.style.height = "auto";
    this.isSending = true;

    // Optimistically append user message to UI
    const nowIso = new Date().toISOString();
    this.messages.push({
      role: "user",
      content: message,
      created_at: nowIso
    });
    this.renderMessages();

    // Show typing indicator & trigger thinking animation
    const panel = document.getElementById("horacePanel");
    if (panel) panel.classList.add("thinking");

    const typing = document.getElementById("horaceTypingIndicator");
    if (typing) {
      typing.style.display = "flex";
      this.scrollToBottom();
    }

    const sendBtn = document.getElementById("horaceSendBtn");
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add("sending");
    }

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message })
      });

      if (res.ok) {
        const data = await res.json();
        this.messages.push({
          role: "assistant",
          content: data.reply,
          model: data.model || this.activeModel,
          created_at: data.created_at || new Date().toISOString(),
          _isNew: true
        });
        if (data.online !== undefined) {
          this.isOnline = data.online;
          this.updateStatusUI();
        }
      } else {
        const errText = await res.text();
        this.messages.push({
          role: "assistant",
          content: "Shit, something crashed on the backend route. Check server logs.",
          model: "system",
          created_at: new Date().toISOString(),
          _isNew: true
        });
      }
    } catch (err) {
      this.messages.push({
        role: "assistant",
        content: "Network hiccup or timeout reaching the server node. Tailscale might be re-authenticating.",
        model: "offline",
        created_at: new Date().toISOString(),
        _isNew: true
      });
      this.isOnline = false;
      this.updateStatusUI();
    } finally {
      this.isSending = false;
      if (panel) panel.classList.remove("thinking");
      if (typing) typing.style.display = "none";
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove("sending");
      }
      this.renderMessages();
      this.scrollToBottom();
    }
  },

  async clearChat() {
    if (!confirm("Wipe conversation history with Horace? He'll reset back to his initial state.")) {
      return;
    }
    try {
      const res = await fetch("/api/llm/chat/history", { method: "DELETE" });
      if (res.ok) {
        this.messages = [];
        this.renderMessages();
        if (typeof showToast === "function") {
          showToast("Horace chat history cleared.");
        }
      }
    } catch (e) {
      alert("Failed to clear chat history.");
    }
  }
};

window.HoraceChat = HoraceChat;
