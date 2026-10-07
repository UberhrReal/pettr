/**
 * PETTR PIN Lock Handler
 */
const PinLock = {
  currentPin: "",
  lockoutInterval: null,

  init() {
    // Keyboard support
    window.addEventListener("keydown", (e) => {
      const overlay = document.getElementById("pinLockOverlay");
      if (overlay.style.display === "none") return;

      if (e.key >= "0" && e.key <= "9") {
        this.enterDigit(e.key);
      } else if (e.key === "Backspace") {
        this.backspace();
      } else if (e.key === "Escape") {
        this.clearAll();
      }
    });

    this.checkStatus();
  },

  async checkStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      if (data.authenticated) {
        this.hideOverlay();
        App.onAuthenticated(data);
      } else {
        this.showOverlay();
        if (data.locked && data.lockout_seconds > 0) {
          this.triggerLockout(data.lockout_seconds);
        }
      }
    } catch (err) {
      this.showOverlay();
    }
  },

  enterDigit(digit) {
    if (this.currentPin.length >= 4) return;
    this.currentPin += digit;
    App.haptic("light");
    this.updateDots();
    this.clearError();

    if (this.currentPin.length === 4) {
      setTimeout(() => this.submitPin(), 100);
    }
  },

  backspace() {
    if (this.currentPin.length > 0) {
      this.currentPin = this.currentPin.slice(0, -1);
      App.haptic("light");
      this.updateDots();
      this.clearError();
    }
  },

  clearAll() {
    this.currentPin = "";
    App.haptic("light");
    this.updateDots();
    this.clearError();
  },

  updateDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`dot${i}`);
      if (i < this.currentPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  },

  showError(msg) {
    const el = document.getElementById("pinErrorMsg");
    if (el) el.textContent = msg;
    // Shake animation
    const card = document.querySelector(".pin-card");
    if (card) {
      card.style.transform = "translateX(-8px)";
      setTimeout(() => card.style.transform = "translateX(8px)", 80);
      setTimeout(() => card.style.transform = "translateX(-4px)", 160);
      setTimeout(() => card.style.transform = "translateX(0)", 240);
    }
  },

  clearError() {
    const el = document.getElementById("pinErrorMsg");
    if (el) el.textContent = "";
  },

  triggerLockout(seconds) {
    const banner = document.getElementById("pinLockoutBanner");
    const timer = document.getElementById("lockoutTimer");
    banner.style.display = "block";
    let rem = seconds;
    timer.textContent = rem;

    if (this.lockoutInterval) clearInterval(this.lockoutInterval);
    this.lockoutInterval = setInterval(() => {
      rem--;
      if (rem <= 0) {
        clearInterval(this.lockoutInterval);
        banner.style.display = "none";
        this.clearError();
      } else {
        timer.textContent = rem;
      }
    }, 1000);
  },

  async submitPin() {
    const pin = this.currentPin;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (res.ok) {
        App.haptic("success");
        this.hideOverlay();
        this.clearAll();
        App.onAuthenticated(data);
      } else if (res.status === 429) {
        App.haptic("warning");
        this.clearAll();
        this.showError(data.detail || "Rate limited.");
        // Extract seconds if present
        const match = data.detail.match(/(\d+)\s+seconds/);
        const sec = match ? parseInt(match[1]) : 60;
        this.triggerLockout(sec);
      } else {
        App.haptic("warning");
        this.clearAll();
        this.showError(data.detail || "Incorrect PIN. Try again.");
      }
    } catch (err) {
      this.clearAll();
      this.showError("Network error connecting to PETTR host.");
    }
  },

  showOverlay() {
    document.getElementById("pinLockOverlay").style.display = "flex";
  },

  hideOverlay() {
    document.getElementById("pinLockOverlay").style.display = "none";
  }
};

window.PinLock = PinLock;
