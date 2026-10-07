/**
 * PETTR Scalable Timeline Controller (Day, Month, Year)
 * Defaults to Graphic "Line" view with expandable window cards and direct check-ins,
 * while preserving Detailed List view as an option.
 */
const Timeline = {
  currentScale: "day",
  viewMode: "unified", // "unified" (default: combined ruler spine + graphic cards above & below), or "list"
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1, // 1-12
  currentDay: new Date().getDate(),
  lastHapticSlot: -1,
  currentTimeInterval: null,

  async init() {
    this.bindControls();
    await this.refresh();
  },

  bindControls() {
    // Scale switcher (Day, Month, Year)
    document.querySelectorAll(".timeline-scale-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".timeline-scale-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentScale = btn.dataset.scale;
        this.refresh();
      });
    });

    // View mode switcher (Graphic Timeline vs Detailed List)
    document.querySelectorAll(".timeline-view-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".timeline-view-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.viewMode = btn.dataset.view;
        this.refresh();
      });
    });
  },

  async refresh() {
    try {
      let url = `/api/timeline?scale=${this.currentScale}&year=${this.currentYear}&month=${this.currentMonth}&day=${this.currentDay}`;
      if (this.currentScale === "day" && this.viewMode !== "list") {
        url += "&days_around=3";
      }
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      this.render(data);
    } catch (err) {
      console.error("Error loading timeline:", err);
    }
  },

  navigate(direction) {
    if (this.currentScale === "day") {
      const d = new Date(this.currentYear, this.currentMonth - 1, this.currentDay + direction);
      this.currentYear = d.getFullYear();
      this.currentMonth = d.getMonth() + 1;
      this.currentDay = d.getDate();
    } else if (this.currentScale === "month") {
      this.currentMonth += direction;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      } else if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
    } else if (this.currentScale === "year") {
      this.currentYear += direction;
    }
    this.refresh();
  },

  jumpToToday() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;
    this.currentDay = now.getDate();
    this.refresh();
  },

  render(data) {
    const container = document.getElementById("timelineContentContainer");
    const titleEl = document.getElementById("timelineDisplayTitle");
    container.innerHTML = "";
    if (this.currentTimeInterval) {
      clearInterval(this.currentTimeInterval);
      this.currentTimeInterval = null;
    }

    if (this.currentScale === "month") {
      if (titleEl) titleEl.textContent = `${data.month_name} ${data.year}`;
      this.renderMonthScale(container, data);
    } else if (this.currentScale === "year") {
      if (titleEl) titleEl.textContent = `Year ${data.year}`;
      this.renderYearScale(container, data);
    } else if (this.viewMode === "list") {
      if (titleEl) titleEl.textContent = data.display_date || "Today";
      this.renderDayScaleList(container, data);
    } else {
      // Graphic multi-day timeline
      if (data.days && data.days.length > 0) {
        this.renderInfiniteDays(container, data.days, data.target_date);
      } else {
        this.renderDayScaleUnified(container, data);
      }
    }
  },

  /* Unified Graphic Timeline (Merged Ruler Spine + Cards Above & Below) */
  renderDayScaleUnified(container, data) {
    if (this.currentTimeInterval) {
      clearInterval(this.currentTimeInterval);
      this.currentTimeInterval = null;
    }

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "unified-timeline-container";
    scrollContainer.id = "unifiedTimelineScrollContainer";

    const track = document.createElement("div");
    track.className = "unified-timeline-track";
    track.id = "unifiedTimelineTrack";

    const SLOT_WIDTH = 110;
    const TOTAL_HOURS = 24;
    const TOTAL_WIDTH = TOTAL_HOURS * SLOT_WIDTH;
    const SPINE_TOP = 250;
    const SPINE_HEIGHT = 40;
    const CARD_WIDTH = 220;
    const CARD_HEIGHT = 76;

    // 1. Central Ruler Axis Spine
    const spine = document.createElement("div");
    spine.className = "unified-timeline-axis";
    spine.style.top = `${SPINE_TOP}px`;
    spine.style.height = `${SPINE_HEIGHT}px`;
    spine.style.width = `${TOTAL_WIDTH}px`;

    for (let h = 0; h < TOTAL_HOURS; h++) {
      const slot = document.createElement("div");
      slot.className = "unified-hour-slot";
      slot.style.left = `${h * SLOT_WIDTH}px`;
      slot.style.width = `${SLOT_WIDTH}px`;
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      slot.innerHTML = `
        <span class="unified-hour-label">${hourStr}</span>
        <div class="unified-subtick quarter" title="${h}:15"></div>
        <div class="unified-subtick half" title="${h}:30"></div>
        <div class="unified-subtick three-quarter" title="${h}:45"></div>
      `;
      spine.appendChild(slot);
    }
    track.appendChild(spine);

    // 2. Real-time Live Glowing Vertical Time Beam (if today)
    const now = new Date();
    const isToday = (this.currentYear === now.getFullYear() &&
                     this.currentMonth === (now.getMonth() + 1) &&
                     this.currentDay === now.getDate());

    const isPast = (() => {
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selected = new Date(this.currentYear, this.currentMonth - 1, this.currentDay);
      return selected < todayDate;
    })();

    const isFuture = (() => {
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selected = new Date(this.currentYear, this.currentMonth - 1, this.currentDay);
      return selected > todayDate;
    })();

    if (isToday) {
      const timeLine = document.createElement("div");
      timeLine.className = "unified-time-line";
      timeLine.id = "unifiedTimeLine";

      const updatePosition = () => {
        const liveNow = new Date();
        const mins = liveNow.getHours() * 60 + liveNow.getMinutes();
        const leftPx = (mins / 60) * SLOT_WIDTH;
        timeLine.style.left = `${leftPx}px`;
        const badge = timeLine.querySelector(".unified-time-badge");
        if (badge) {
          const hh = String(liveNow.getHours()).padStart(2, "0");
          const mm = String(liveNow.getMinutes()).padStart(2, "0");
          badge.textContent = `⚡ ${hh}:${mm}`;
        }
      };

      const initialMins = now.getHours() * 60 + now.getMinutes();
      timeLine.style.left = `${(initialMins / 60) * SLOT_WIDTH}px`;
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      timeLine.innerHTML = `<span class="unified-time-badge" style="top: ${SPINE_TOP - 14}px;">⚡ ${hh}:${mm}</span>`;
      track.appendChild(timeLine);

      this.currentTimeInterval = setInterval(updatePosition, 30000);
    }

    // 3. Extract and Sort All Items
    const items = [];
    for (let h = 0; h < TOTAL_HOURS; h++) {
      const slot = data.hours[h];
      if (!slot) continue;

      (slot.events || []).forEach(e => {
        let mins = h * 60;
        if (e.start_time) {
          const m = String(e.start_time).match(/(\d{1,2}):(\d{2})/);
          if (m) mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        }
        items.push({ type: "event", data: e, minutes: mins, preferred: "above" });
      });

      (slot.tasks || []).forEach(t => {
        let mins = h * 60;
        const dStr = t.due_date_military || t.due_date;
        if (dStr) {
          const m = String(dStr).match(/(\d{1,2}):(\d{2})/);
          if (m) mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        }
        items.push({
          type: "task",
          data: t,
          minutes: mins,
          preferred: t.tier === "focus" ? "above" : "below"
        });
      });
    }

    items.sort((a, b) => a.minutes - b.minutes);

    // 4. Staggered Lane Allocation (Zero-Overlap Algorithm)
    // Lanes definitions:
    // A2: Above far:   top = 45px
    // A1: Above close: top = 145px
    // B1: Below close: top = 315px
    // B2: Below far:   top = 415px
    const laneConfigs = {
      A2: { top: 45, isAbove: true },
      A1: { top: 145, isAbove: true },
      B1: { top: 315, isAbove: false },
      B2: { top: 415, isAbove: false }
    };
    const occupiedX = { A1: -999, A2: -999, B1: -999, B2: -999 };

    items.forEach((item, idx) => {
      const rankStr = String(idx + 1).padStart(2, "0");
      const idealX = (item.minutes / 60) * SLOT_WIDTH;
      let cardLeft = Math.max(10, Math.min(TOTAL_WIDTH - CARD_WIDTH - 10, idealX - (CARD_WIDTH / 2)));

      // Pick lane
      const checkOrder = item.preferred === "above" 
        ? ["A1", "A2", "B1", "B2"] 
        : ["B1", "B2", "A1", "A2"];

      let chosenLane = checkOrder[0];
      for (const lane of checkOrder) {
        if (cardLeft >= occupiedX[lane] + 12) {
          chosenLane = lane;
          break;
        }
      }

      // If collision in all, pick lane with min occupiedX and push cardLeft
      if (cardLeft < occupiedX[chosenLane] + 12) {
        let bestLane = checkOrder[0];
        let minOcc = occupiedX[bestLane];
        for (const lane of checkOrder) {
          if (occupiedX[lane] < minOcc) {
            minOcc = occupiedX[lane];
            bestLane = lane;
          }
        }
        chosenLane = bestLane;
        cardLeft = Math.max(cardLeft, occupiedX[chosenLane] + 12);
      }

      occupiedX[chosenLane] = cardLeft + CARD_WIDTH;

      const conf = laneConfigs[chosenLane];
      const cardTop = conf.top;
      const isAbove = conf.isAbove;

      // Vertical connector stem line
      const stem = document.createElement("div");
      stem.className = `timeline-stem-line ${isAbove ? 'stem-above' : 'stem-below'} type-${item.type}`;
      stem.style.left = `${idealX}px`;
      if (isAbove) {
        stem.style.top = `${cardTop + CARD_HEIGHT}px`;
        stem.style.height = `${SPINE_TOP - (cardTop + CARD_HEIGHT) + 2}px`;
      } else {
        stem.style.top = `${SPINE_TOP + SPINE_HEIGHT - 2}px`;
        stem.style.height = `${cardTop - (SPINE_TOP + SPINE_HEIGHT) + 2}px`;
      }
      track.appendChild(stem);

      // Spine Anchor Node
      const node = document.createElement("div");
      node.className = `timeline-spine-node node-${item.type} ${item.type === 'task' ? item.data.tier : ''}`;
      node.style.left = `${idealX}px`;
      node.style.top = `${SPINE_TOP + (SPINE_HEIGHT / 2) - 6}px`;
      node.title = `${App.formatMilitaryTime(item.minutes)} · #${rankStr} ${item.data.title}`;
      track.appendChild(node);

      // Timeline Card
      const card = document.createElement("div");
      card.className = `unified-timeline-card ${isAbove ? 'card-above' : 'card-below'} type-${item.type} ${isPast ? 'is-locked' : ''}`;
      card.style.left = `${cardLeft}px`;
      card.style.top = `${cardTop}px`;
      card.style.width = `${CARD_WIDTH}px`;

      if (item.type === "event") {
        const e = item.data;
        const timePart = e.start_time ? App.formatMilitaryTime(e.start_time) : "All Day";
        card.innerHTML = `
          <div class="ut-card-header">
            <div style="display:flex; align-items:center; gap:5px;">
              <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
              <span class="ut-time-tag">📅 ${timePart}</span>
            </div>
            ${e.project_name ? `<span class="project-tag" style="font-size:9.5px; padding:1px 6px;">${this.escapeHtml(e.project_name)}</span>` : ''}
          </div>
          <div class="ut-card-title">${this.escapeHtml(e.title)}</div>
        `;
        card.addEventListener("click", () => {
          if (!isPast) EntityModal.open("event", e.id);
        });
      } else {
        const t = item.data;
        const isDone = t.status === "completed";
        if (isDone) card.classList.add("completed");

        const timePart = t.due_date_military ? App.formatMilitaryTime(t.due_date_military) : (t.due_date ? App.formatMilitaryTime(t.due_date) : "Today");
        const urgencyLevel = t.urgency ? t.urgency.level : "none";
        const urgencyLabel = t.urgency ? t.urgency.label : "";

        let cbDisabled = "";
        let cbTitle = "Check into task";
        if (isPast) {
          cbDisabled = "disabled";
          cbTitle = "Locked archive (past date)";
        } else if (isFuture) {
          cbDisabled = "disabled";
          cbTitle = "Cannot complete future tasks before date";
        }

        card.innerHTML = `
          <div class="ut-card-header">
            <div style="display:flex; align-items:center; gap:5px;">
              <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
              <span class="ut-time-tag">${t.tier === 'focus' ? '🎯' : '⚡'} ${timePart}</span>
            </div>
            ${urgencyLabel ? `<span class="urgency-badge ${urgencyLevel}" style="font-size:9px; padding:1px 5px;">${urgencyLabel}</span>` : ''}
          </div>
          <div class="ut-card-body">
            <input type="checkbox" class="task-checkbox" ${isDone ? "checked" : ""} ${cbDisabled}
                   onclick="event.stopPropagation()"
                   onchange="Timeline.checkIntoTask(${t.id}, this.checked)" title="${cbTitle}">
            <div class="ut-card-title" style="${isDone ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
              ${this.escapeHtml(t.title)}
            </div>
          </div>
          ${t.project_name ? `<div class="ut-card-footer"><span class="project-tag" style="font-size:9.5px; padding:1px 5px;">📁 ${this.escapeHtml(t.project_name)}</span></div>` : ''}
        `;

        card.addEventListener("click", (evt) => {
          if (evt.target.type !== "checkbox" && !isPast) {
            EntityModal.open("task", t.id);
          }
        });
      }

      track.appendChild(card);
    });

    scrollContainer.appendChild(track);
    container.appendChild(scrollContainer);

    // 5. Desktop Horizontal Drag-to-Scroll & Mousewheel interaction
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;

    scrollContainer.addEventListener("mousedown", (e) => {
      if (e.target.closest(".unified-timeline-card")) return;
      isDown = true;
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollStart = scrollContainer.scrollLeft;
      scrollContainer.classList.add("dragging");
    });

    window.addEventListener("mouseup", () => {
      isDown = false;
      scrollContainer.classList.remove("dragging");
    });

    scrollContainer.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollContainer.scrollLeft = scrollStart - walk;
    });

    // Translate vertical wheel scroll to horizontal scrolling (amplified sensitivity)
    scrollContainer.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollContainer.scrollLeft += e.deltaY * 2.5;
      }
    }, { passive: false });

    // Ratchet haptic vibration on scrolling across hour slots
    scrollContainer.addEventListener("scroll", () => {
      const currentSlot = Math.floor(scrollContainer.scrollLeft / SLOT_WIDTH);
      if (currentSlot !== this.lastHapticSlot) {
        this.lastHapticSlot = currentSlot;
        App.haptic("light");
      }
    }, { passive: true });

    // Auto-scroll: center on current time (if today) or 08:00
    setTimeout(() => {
      if (isToday) {
        const curMins = now.getHours() * 60 + now.getMinutes();
        const targetScroll = Math.max(0, (curMins / 60) * SLOT_WIDTH - scrollContainer.clientWidth / 2);
        scrollContainer.scrollLeft = targetScroll;
      } else {
        scrollContainer.scrollLeft = Math.max(0, 8 * SLOT_WIDTH - 60);
      }
    }, 50);
  },

  shiftDateStr(dateStr, offsetDays) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d + offsetDays);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  },

  /* Infinite Graphic Multi-Day Timeline with Glowing Boundaries & Milestone Badges */
  renderInfiniteDays(container, days, targetDateStr) {
    if (this.currentTimeInterval) {
      clearInterval(this.currentTimeInterval);
      this.currentTimeInterval = null;
    }

    // Always clear the container before rendering a fresh instance.
    // Without this, every call from the scroll edge handler appends a
    // second (or third…) scrollContainer on top of the existing one.
    container.innerHTML = "";

    this.loadedDays = [...days];
    this.targetDateStr = targetDateStr;

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "unified-timeline-container";
    scrollContainer.id = "unifiedTimelineScrollContainer";

    const track = document.createElement("div");
    track.className = "unified-timeline-track";
    track.id = "unifiedTimelineTrack";

    const SLOT_WIDTH = 110;
    const TOTAL_HOURS = 24;
    const DAY_WIDTH = TOTAL_HOURS * SLOT_WIDTH;
    const SPINE_TOP = 250;
    const SPINE_HEIGHT = 40;
    const CARD_WIDTH = 220;
    const CARD_HEIGHT = 76;

    const laneConfigs = {
      A2: { top: 45, isAbove: true },
      A1: { top: 145, isAbove: true },
      B1: { top: 315, isAbove: false },
      B2: { top: 415, isAbove: false }
    };

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    track.style.width = `${this.loadedDays.length * DAY_WIDTH}px`;

    this.loadedDays.forEach((dayData, dIdx) => {
      const dayStartX = dIdx * DAY_WIDTH;
      const dayDate = new Date(dayData.year, dayData.month - 1, dayData.day);
      const isToday = (dayData.date === todayStr);
      const isPast = (dayDate < todayDate);
      const isFuture = (dayDate > todayDate);

      // 1. Glowing Vertical Day Milestone Separator Line
      const sep = document.createElement("div");
      sep.className = "timeline-day-separator";
      sep.style.left = `${dayStartX}px`;
      track.appendChild(sep);

      // 2. Day Milestone Badge
      const badge = document.createElement("div");
      badge.className = "timeline-day-milestone-badge";
      badge.style.left = `${dayStartX + 120}px`;
      badge.textContent = `✦ ${dayData.display_date} ✦`;
      badge.title = "Click to jump view to this day";
      badge.addEventListener("click", () => {
        scrollContainer.scrollTo({ left: dayStartX + (9 * SLOT_WIDTH) - scrollContainer.clientWidth / 2, behavior: "smooth" });
      });
      track.appendChild(badge);

      // 3. Central Axis Spine for this day
      const spine = document.createElement("div");
      spine.className = "unified-timeline-axis";
      spine.style.top = `${SPINE_TOP}px`;
      spine.style.height = `${SPINE_HEIGHT}px`;
      spine.style.left = `${dayStartX}px`;
      spine.style.width = `${DAY_WIDTH}px`;

      for (let h = 0; h < TOTAL_HOURS; h++) {
        const slot = document.createElement("div");
        slot.className = "unified-hour-slot";
        slot.style.left = `${h * SLOT_WIDTH}px`;
        slot.style.width = `${SLOT_WIDTH}px`;
        const hourStr = `${String(h).padStart(2, '0')}:00`;
        slot.innerHTML = `
          <span class="unified-hour-label">${hourStr}</span>
          <div class="unified-subtick quarter"></div>
          <div class="unified-subtick half"></div>
          <div class="unified-subtick three-quarter"></div>
        `;
        spine.appendChild(slot);
      }
      track.appendChild(spine);

      // 4. Real-time Live Glowing Vertical Time Beam (if today)
      if (isToday) {
        const timeLine = document.createElement("div");
        timeLine.className = "unified-time-line";
        const initialMins = now.getHours() * 60 + now.getMinutes();
        timeLine.style.left = `${dayStartX + (initialMins / 60) * SLOT_WIDTH}px`;
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        timeLine.innerHTML = `<span class="unified-time-badge" style="top: ${SPINE_TOP - 14}px;">⚡ ${hh}:${mm}</span>`;
        track.appendChild(timeLine);

        const updateLive = () => {
          const liveNow = new Date();
          const mins = liveNow.getHours() * 60 + liveNow.getMinutes();
          timeLine.style.left = `${dayStartX + (mins / 60) * SLOT_WIDTH}px`;
          const b = timeLine.querySelector(".unified-time-badge");
          if (b) {
            b.textContent = `⚡ ${String(liveNow.getHours()).padStart(2, "0")}:${String(liveNow.getMinutes()).padStart(2, "0")}`;
          }
        };
        this.currentTimeInterval = setInterval(updateLive, 30000);
      }

      // 5. Day items (events & tasks)
      const items = [];
      for (let h = 0; h < TOTAL_HOURS; h++) {
        const slot = (dayData.hours || {})[h];
        if (!slot) continue;
        (slot.events || []).forEach(e => {
          let mins = h * 60;
          if (e.start_time) {
            const m = String(e.start_time).match(/(\d{1,2}):(\d{2})/);
            if (m) mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          }
          items.push({ type: "event", data: e, minutes: mins, preferred: "above" });
        });
        (slot.tasks || []).forEach(t => {
          let mins = h * 60;
          const dStr = t.due_date_military || t.due_date;
          if (dStr) {
            const m = String(dStr).match(/(\d{1,2}):(\d{2})/);
            if (m) mins = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          }
          items.push({
            type: "task",
            data: t,
            minutes: mins,
            preferred: t.tier === "focus" ? "above" : "below"
          });
        });
      }

      items.sort((a, b) => a.minutes - b.minutes);

      const occupiedX = { A1: -999, A2: -999, B1: -999, B2: -999 };
      items.forEach((item, idx) => {
        const rankStr = String(idx + 1).padStart(2, "0");
        const idealX = dayStartX + (item.minutes / 60) * SLOT_WIDTH;
        let cardLeft = Math.max(dayStartX + 10, Math.min(dayStartX + DAY_WIDTH - CARD_WIDTH - 10, idealX - (CARD_WIDTH / 2)));

        const checkOrder = item.preferred === "above" ? ["A1", "A2", "B1", "B2"] : ["B1", "B2", "A1", "A2"];
        let chosenLane = checkOrder[0];
        for (const lane of checkOrder) {
          if (cardLeft >= occupiedX[lane] + 12) {
            chosenLane = lane;
            break;
          }
        }
        if (cardLeft < occupiedX[chosenLane] + 12) {
          let bestLane = checkOrder[0];
          let minOcc = occupiedX[bestLane];
          for (const lane of checkOrder) {
            if (occupiedX[lane] < minOcc) {
              minOcc = occupiedX[lane];
              bestLane = lane;
            }
          }
          chosenLane = bestLane;
          cardLeft = Math.max(cardLeft, occupiedX[chosenLane] + 12);
        }
        occupiedX[chosenLane] = cardLeft + CARD_WIDTH;

        const conf = laneConfigs[chosenLane];
        const cardTop = conf.top;
        const isAbove = conf.isAbove;

        // Connector stem
        const stem = document.createElement("div");
        stem.className = `timeline-stem-line ${isAbove ? 'stem-above' : 'stem-below'} type-${item.type}`;
        stem.style.left = `${idealX}px`;
        if (isAbove) {
          stem.style.top = `${cardTop + CARD_HEIGHT}px`;
          stem.style.height = `${SPINE_TOP - (cardTop + CARD_HEIGHT) + 2}px`;
        } else {
          stem.style.top = `${SPINE_TOP + SPINE_HEIGHT - 2}px`;
          stem.style.height = `${cardTop - (SPINE_TOP + SPINE_HEIGHT) + 2}px`;
        }
        track.appendChild(stem);

        // Spine Anchor Node
        const node = document.createElement("div");
        node.className = `timeline-spine-node node-${item.type} ${item.type === 'task' ? item.data.tier : ''}`;
        node.style.left = `${idealX}px`;
        node.style.top = `${SPINE_TOP + (SPINE_HEIGHT / 2) - 6}px`;
        node.title = `${App.formatMilitaryTime(item.minutes)} · #${rankStr} ${item.data.title}`;
        track.appendChild(node);

        // Card
        const card = document.createElement("div");
        card.className = `unified-timeline-card ${isAbove ? 'card-above' : 'card-below'} type-${item.type} ${isPast ? 'is-locked' : ''}`;
        card.style.left = `${cardLeft}px`;
        card.style.top = `${cardTop}px`;
        card.style.width = `${CARD_WIDTH}px`;

        if (item.type === "event") {
          const e = item.data;
          const timePart = e.start_time ? App.formatMilitaryTime(e.start_time) : "All Day";
          card.innerHTML = `
            <div class="ut-card-header">
              <div style="display:flex; align-items:center; gap:5px;">
                <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
                <span class="ut-time-tag">📅 ${timePart}</span>
              </div>
              ${e.project_name ? `<span class="project-tag" style="font-size:9.5px; padding:1px 6px;">${this.escapeHtml(e.project_name)}</span>` : ''}
            </div>
            <div class="ut-card-title">${this.escapeHtml(e.title)}</div>
          `;
          card.addEventListener("click", () => {
            if (!isPast) EntityModal.open("event", e.id);
          });
        } else {
          const t = item.data;
          const isDone = t.status === "completed";
          if (isDone) card.classList.add("completed");
          const timePart = t.due_date_military ? App.formatMilitaryTime(t.due_date_military) : (t.due_date ? App.formatMilitaryTime(t.due_date) : "Today");
          const urgencyLevel = t.urgency ? t.urgency.level : "none";
          const urgencyLabel = t.urgency ? t.urgency.label : "";

          let cbDisabled = (isPast || isFuture) ? "disabled" : "";
          let cbTitle = isPast ? "Locked archive (past date)" : (isFuture ? "Future date (locked)" : "Check into task");

          card.innerHTML = `
            <div class="ut-card-header">
              <div style="display:flex; align-items:center; gap:5px;">
                <span class="priority-num-badge" title="Priority rank #${idx + 1}">${rankStr}</span>
                <span class="ut-time-tag">${t.tier === 'focus' ? '🎯' : '⚡'} ${timePart}</span>
              </div>
              ${urgencyLabel ? `<span class="urgency-badge ${urgencyLevel}" style="font-size:9px; padding:1px 5px;">${urgencyLabel}</span>` : ''}
            </div>
            <div class="ut-card-body">
              <input type="checkbox" class="task-checkbox" ${isDone ? "checked" : ""} ${cbDisabled}
                     onclick="event.stopPropagation()"
                     onchange="Timeline.checkIntoTask(${t.id}, this.checked)" title="${cbTitle}">
              <div class="ut-card-title" style="${isDone ? 'text-decoration: line-through; color: var(--text-dim);' : ''}">
                ${this.escapeHtml(t.title)}
              </div>
            </div>
            ${t.project_name ? `<div class="ut-card-footer"><span class="project-tag" style="font-size:9.5px; padding:1px 5px;">📁 ${this.escapeHtml(t.project_name)}</span></div>` : ''}
          `;
          card.addEventListener("click", (evt) => {
            if (evt.target.type !== "checkbox" && !isPast) {
              EntityModal.open("task", t.id);
            }
          });
        }
        track.appendChild(card);
      });
    });

    // Final boundary line at end of track
    const finalSep = document.createElement("div");
    finalSep.className = "timeline-day-separator";
    finalSep.style.left = `${this.loadedDays.length * DAY_WIDTH}px`;
    track.appendChild(finalSep);

    scrollContainer.appendChild(track);
    container.appendChild(scrollContainer);

    // Initial center positioning
    const targetIdx = this.loadedDays.findIndex(d => d.date === targetDateStr);
    const initialDayIdx = targetIdx >= 0 ? targetIdx : Math.floor(this.loadedDays.length / 2);
    const initialDay = this.loadedDays[initialDayIdx];
    const initialHour = (initialDay && initialDay.date === todayStr) ? now.getHours() : 9;
    const initialScroll = (initialDayIdx * DAY_WIDTH) + (initialHour * SLOT_WIDTH) - (scrollContainer.clientWidth / 2);
    setTimeout(() => {
      scrollContainer.scrollLeft = Math.max(0, initialScroll);
    }, 50);

    // Scroll listener for dynamic title
    let scrollRaf = null;
    scrollContainer.addEventListener("scroll", () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        const centerPx = scrollContainer.scrollLeft + (scrollContainer.clientWidth / 2);
        const currIdx = Math.max(0, Math.min(this.loadedDays.length - 1, Math.floor(centerPx / DAY_WIDTH)));
        const currDay = this.loadedDays[currIdx];
        if (currDay) {
          const titleEl = document.getElementById("timelineDisplayTitle");
          if (titleEl) titleEl.textContent = currDay.display_date;
        }
      });
    });

    // Horizontal drag-to-scroll
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    scrollContainer.addEventListener("mousedown", (e) => {
      if (e.target.closest(".unified-timeline-card") || e.target.closest(".timeline-day-milestone-badge")) return;
      isDown = true;
      scrollContainer.classList.add("dragging");
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollStart = scrollContainer.scrollLeft;
    });
    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        scrollContainer.classList.remove("dragging");
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollContainer.scrollLeft = scrollStart - walk;
    });

    // Mouse wheel horizontal scrolling (amplified sensitivity)
    scrollContainer.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        scrollContainer.scrollLeft += e.deltaY * 2.5;
      }
    }, { passive: false });
  },

  async checkIntoTask(taskId, isCompleted) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCompleted ? "completed" : "pending" })
      });
      App.showToast(isCompleted ? "Task completed!" : "Task marked active");
      await this.refresh();
      await Dashboard.refresh();
    } catch (err) {
      console.error(err);
    }
  },

  /* Detailed List Timeline View */
  renderDayScaleList(container, data) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "8px";

    for (let h = 0; h < 24; h++) {
      const slot = data.hours[h];
      const hasItems = slot.tasks.length > 0 || slot.events.length > 0;
      const hourStr = `${h.toString().padStart(2, '0')}:00`;

      if (!hasItems && (h < 7 || h > 23)) continue;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "14px";
      row.style.alignItems = "flex-start";
      row.style.padding = "10px 14px";
      row.style.background = hasItems ? "var(--bg-secondary)" : "var(--bg-card)";
      row.style.borderRadius = "8px";
      row.style.border = hasItems ? "1px solid var(--card-border)" : "1px dashed #e4e4e7";

      const timeLabel = `<span style="font-size: 13px; font-weight: 700; color: var(--text-main); font-family: var(--font-mono); width: 50px;">${hourStr}</span>`;
      
      let itemsHtml = '<span style="font-size: 12px; color: var(--text-dim);">Clear</span>';
      if (hasItems) {
        itemsHtml = `
          <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
            ${slot.events.map(e => `
              <div onclick="EntityModal.open('event', ${e.id})" style="cursor: pointer; background: var(--bg-primary); border-left: 3px solid var(--accent-cyan); border: 1px solid var(--card-border); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 13px;">📅 ${this.escapeHtml(e.title)}</span>
                ${e.project_name ? `<span class="project-tag">${e.project_name}</span>` : ''}
              </div>
            `).join('')}
            ${slot.tasks.map(t => `
              <div onclick="EntityModal.open('task', ${t.id})" style="cursor: pointer; background: var(--bg-primary); border: 1px solid var(--card-border); padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 13px; ${t.status === 'completed' ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                  ${t.tier === 'focus' ? '🎯' : '⚡'} ${this.escapeHtml(t.title)}
                </span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  ${t.project_name ? `<span class="project-tag">${t.project_name}</span>` : ''}
                  <span class="urgency-badge ${t.urgency ? t.urgency.level : 'none'}">${t.urgency ? t.urgency.label : ''}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      row.innerHTML = timeLabel + itemsHtml;
      wrapper.appendChild(row);
    }
    container.appendChild(wrapper);
  },

  renderMonthScale(container, data) {
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(7, 1fr)";
    grid.style.gap = "8px";

    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    dayNames.forEach(d => {
      const header = document.createElement("div");
      header.style.textAlign = "center";
      header.style.fontSize = "12px";
      header.style.fontWeight = "700";
      header.style.color = "var(--text-muted)";
      header.style.padding = "6px 0";
      header.textContent = d;
      grid.appendChild(header);
    });

    for (let i = 0; i < data.start_weekday; i++) {
      const blank = document.createElement("div");
      blank.style.opacity = "0.2";
      grid.appendChild(blank);
    }

    data.days.forEach(d => {
      const cell = document.createElement("div");
      const isToday = d.date === new Date().toISOString().split("T")[0];
      cell.style.background = isToday ? "var(--bg-tertiary)" : "var(--bg-card)";
      cell.style.border = isToday ? "2px solid var(--text-main)" : "1px solid var(--card-border)";
      cell.style.borderRadius = "8px";
      cell.style.padding = "8px";
      cell.style.minHeight = "80px";
      cell.style.cursor = "pointer";
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.justifyContent = "space-between";
      cell.style.transition = "border-color 0.15s ease, transform 0.1s ease";

      cell.onmouseover = () => cell.style.borderColor = "var(--text-main)";
      cell.onmouseout = () => {
        if (!isToday) cell.style.borderColor = "var(--card-border)";
      };

      cell.onclick = () => {
        this.currentScale = "day";
        this.currentDay = d.day;
        document.querySelectorAll(".timeline-scale-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('.timeline-scale-btn[data-scale="day"]').classList.add("active");
        this.refresh();
      };

      let badgeHtml = "";
      if (d.has_urgent) {
        badgeHtml = '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--urgent-orange); display: inline-block;"></span>';
      } else if (d.has_normal) {
        badgeHtml = '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--normal-green); display: inline-block;"></span>';
      }

      cell.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 13px;">${d.day}</span>
          ${badgeHtml}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
          ${d.task_count > 0 ? `<span>${d.task_count} tasks</span>` : ''}
          ${d.event_count > 0 ? `<div>${d.event_count} events</div>` : ''}
        </div>
      `;
      grid.appendChild(cell);
    });

    container.appendChild(grid);
  },

  renderYearScale(container, data) {
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(220px, 1fr))";
    grid.style.gap = "14px";

    data.months.forEach(m => {
      const card = document.createElement("div");
      card.className = "project-card";
      card.style.cursor = "pointer";
      card.style.padding = "16px";

      card.onclick = () => {
        this.currentScale = "month";
        this.currentMonth = m.month_num;
        document.querySelectorAll(".timeline-scale-btn").forEach(b => b.classList.remove("active"));
        document.querySelector('.timeline-scale-btn[data-scale="month"]').classList.add("active");
        this.refresh();
      };

      const densityColor = m.density === "high" ? "var(--urgent-orange)" : (m.density === "medium" ? "var(--text-main)" : "var(--text-muted)");

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-main);">${m.name}</h3>
          <span style="font-size: 10px; font-weight: 700; color: ${densityColor}; text-transform: uppercase;">${m.density} Load</span>
        </div>
        <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-muted);">
          <span>📌 ${m.task_count} Tasks</span>
          <span>📅 ${m.event_count} Events</span>
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: var(--text-main); font-weight: 600;">
          Inspect month →
        </div>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);
  },

  async seedSampleData() {
    try {
      const res = await fetch("/api/sample-data/seed", { method: "POST" });
      const data = await res.json();
      App.showToast(data.message || "Full-week demo data populated across all 7 days!");
      await this.refresh();
      await Dashboard.refresh();
      if (typeof Exploded !== "undefined") Exploded.refresh();
      if (typeof History !== "undefined") History.refresh();
      if (typeof Notes !== "undefined") Notes.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
      if (typeof EveningDebrief !== "undefined") EveningDebrief.updateDebriefButtonState();
    } catch (err) {
      console.error(err);
      App.showToast("Failed to populate demo data", "error");
    }
  },

  async clearSampleData() {
    if (!confirm("⚠️ CLEAR ALL DATA\n\nThis will permanently delete every task, project, event, reminder and note from the database — returning PETTR to a clean slate.\n\nProceed?")) return;
    try {
      const res = await fetch("/api/sample-data/clear", { method: "POST" });
      const data = await res.json();
      App.showToast(data.message || "Database cleared — clean slate.");
      await this.refresh();
      await Dashboard.refresh();
      if (typeof Mindmap !== "undefined") Mindmap.refresh();
    } catch (err) {
      console.error(err);
      App.showToast("Error clearing data. Check server logs.", "error");
    }
  },

  escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};

window.Timeline = Timeline;
