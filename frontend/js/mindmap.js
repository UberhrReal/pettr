/**
 * PETTR Interactive 3D Constellation Cloud (Exploded View)
 * Renders an interactive 3D universe visualizing all branches of the system:
 * - 📁 Projects & Project Subtasks
 * - 🎯 Focus Tasks (Deep Work)
 * - ⚡ Trivial Tasks (Quick Errands)
 * - 📅 Scheduled Events
 * - 🔔 Reminders & Memos
 * - ⚠️ Unsorted / Unorganised Queue
 * Features 3D orbit rotation, auto-rotation, perspective projection, depth-of-field,
 * rich hover tooltips, and click-to-edit.
 */
const Mindmap = {
  canvas: null,
  ctx: null,
  tooltip: null,
  nodes: [],
  links: [],
  dustParticles: [],

  // 3D Viewport State
  rotX: 0.22,
  rotY: 0.45,
  zoom: 1.0,
  panX: 0,
  panY: 0,

  // Orbiting & Dragging
  isOrbiting: true,
  orbitSpeed: 0.0025,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  lastMouseX: 0,
  lastMouseY: 0,
  hoveredNode: null,
  activeFilter: "all",
  animFrameId: null,

  async init() {
    this.canvas = document.getElementById("mindmapCanvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.tooltip = document.getElementById("mindmapTooltip");

    this.initStardust();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindEvents();
    await this.refresh();
    this.startAnimationLoop();
  },

  initStardust() {
    this.dustParticles = [];
    const R = 250; // Major radius of torus
    const r = 85;  // Minor tube radius of torus
    const numPoints = 420;

    // 1. Parametric Torus surface & volumetric stardust cloud
    for (let i = 0; i < numPoints; i++) {
      const phi = (i * 2.3999632) % (Math.PI * 2);  // Toroidal angle
      const theta = (i * 3.883222) % (Math.PI * 2); // Poloidal angle
      // Volumetric dispersion across tube
      const rJitter = r * (0.72 + Math.random() * 0.48);

      const x = (R + rJitter * Math.cos(theta)) * Math.cos(phi);
      const y = rJitter * Math.sin(theta);
      const z = (R + rJitter * Math.cos(theta)) * Math.sin(phi);

      this.dustParticles.push({
        x, y, z,
        radius: Math.random() * 1.3 + 0.6,
        alpha: Math.random() * 0.35 + 0.12,
        isTorusMesh: true
      });
    }

    // 2. Subtle ambient cosmic stardust
    for (let i = 0; i < 70; i++) {
      this.dustParticles.push({
        x: (Math.random() - 0.5) * 850,
        y: (Math.random() - 0.5) * 600,
        z: (Math.random() - 0.5) * 850,
        radius: Math.random() * 1.0 + 0.3,
        alpha: Math.random() * 0.20 + 0.06,
        isTorusMesh: false
      });
    }
  },

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = parent.clientWidth || 800;
    const displayHeight = Math.max(580, window.innerHeight - 300);

    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  bindEvents() {
    const c = this.canvas;
    if (!c) return;

    c.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.hideTooltip();
    });

    window.addEventListener("mousemove", (e) => {
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.rotY += dx * 0.008;
        this.rotX += dy * 0.008;
        this.rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotX));
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        return;
      }

      // Hit-test nodes on hover
      const node = this.findNodeAt(mouseX, mouseY);
      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        c.style.cursor = node ? "pointer" : "default";

        if (node) {
          this.showTooltip(node, mouseX, mouseY);
        } else {
          this.hideTooltip();
        }
      } else if (node && this.tooltip && this.tooltip.style.display === "block") {
        this.positionTooltip(mouseX, mouseY);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        const rect = c.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const clicked = this.findNodeAt(mouseX, mouseY);
        if (clicked) {
          if (clicked.type === "unorganized") {
            Dashboard.openUnorganizedModal();
          } else {
            EntityModal.open(clicked.type, clicked.id);
          }
        }
      }
    });

    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoom = Math.min(Math.max(this.zoom * zoomFactor, 0.45), 2.8);
      this.hideTooltip();
    }, { passive: false });

    c.addEventListener("mouseleave", () => {
      this.isDragging = false;
      this.hoveredNode = null;
      this.hideTooltip();
    });

    // Touch Controls (Mobile Ergonomics & Orbit Gestures)
    c.style.touchAction = "none";
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchMoved = false;
    let lastPinchDist = null;

    c.addEventListener("touchstart", (e) => {
      this.hideTooltip();
      if (e.touches.length === 1) {
        this.isDragging = true;
        touchMoved = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastTouchX = touchStartX;
        lastTouchY = touchStartY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    c.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        const dx = curX - lastTouchX;
        const dy = curY - lastTouchY;
        if (Math.hypot(curX - touchStartX, curY - touchStartY) > 8) {
          touchMoved = true;
        }
        this.rotY += dx * 0.01;
        this.rotX += dy * 0.01;
        this.rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotX));
        lastTouchX = curX;
        lastTouchY = curY;
      } else if (e.touches.length === 2 && lastPinchDist !== null) {
        touchMoved = true;
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / (lastPinchDist || currentDist);
        this.zoom = Math.min(Math.max(this.zoom * factor, 0.45), 2.8);
        lastPinchDist = currentDist;
      }
    }, { passive: false });

    c.addEventListener("touchend", (e) => {
      this.isDragging = false;
      lastPinchDist = null;
      if (!touchMoved) {
        // Clean tap detected -> hit test node
        const rect = c.getBoundingClientRect();
        const tapX = lastTouchX - rect.left;
        const tapY = lastTouchY - rect.top;
        const clicked = this.findNodeAt(tapX, tapY);
        if (clicked) {
          if (clicked.type === "unorganized") {
            Dashboard.openUnorganizedModal();
          } else {
            EntityModal.open(clicked.type, clicked.id);
          }
        }
      }
    });

    c.addEventListener("touchcancel", () => {
      this.isDragging = false;
      lastPinchDist = null;
    });
  },

  toggleRotation() {
    this.isOrbiting = !this.isOrbiting;
    const btn = document.getElementById("mindmapOrbitBtn");
    if (btn) {
      btn.textContent = this.isOrbiting ? "⏸ Pause Orbit" : "▶ Resume Orbit";
    }
  },

  setFilter(filterName, btnEl) {
    this.activeFilter = filterName;
    document.querySelectorAll(".cluster-filter-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
  },

  resetView() {
    this.rotX = 0.22;
    this.rotY = 0.45;
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  },

  project3D(x, y, z, centerX, centerY) {
    // 1. Yaw rotation (rotY)
    const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // 2. Pitch rotation (rotX)
    const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // 3. Perspective Projection
    const f = 700; // Focal length
    const scale = f / (f + z2);

    return {
      screenX: centerX + this.panX + x1 * scale * this.zoom,
      screenY: centerY + this.panY + y1 * scale * this.zoom,
      scale: scale,
      depth: z2,
      alpha: Math.min(Math.max(0.22 + (z2 + 450) / 900, 0.15), 1.0)
    };
  },

  findNodeAt(screenX, screenY) {
    if (!this.canvas) return null;
    const centerX = (this.canvas.width / (window.devicePixelRatio || 1)) / 2;
    const centerY = (this.canvas.height / (window.devicePixelRatio || 1)) / 2;

    const visibleNodes = this.nodes
      .filter(n => this.isNodeVisible(n))
      .map(n => {
        const p = this.project3D(n.x, n.y, n.z, centerX, centerY);
        return { node: n, p, dist: Math.hypot(p.screenX - screenX, p.screenY - screenY) };
      })
      .filter(item => item.dist <= Math.max(12, item.node.radius * item.p.scale * this.zoom + 8))
      .sort((a, b) => b.p.depth - a.p.depth);

    return visibleNodes.length > 0 ? visibleNodes[0].node : null;
  },

  isNodeVisible(node) {
    if (this.activeFilter === "all") return true;
    if (this.activeFilter === "school") {
      return node.category === "School" || node.projectCategory === "School";
    }
    if (this.activeFilter === "external") {
      return node.category === "External" || node.projectCategory === "External";
    }
    if (this.activeFilter === "projects") {
      return node.cluster === "projects";
    }
    if (this.activeFilter === "tasks") {
      return node.cluster === "focus" || node.cluster === "trivial";
    }
    if (this.activeFilter === "events") {
      return node.cluster === "events";
    }
    if (this.activeFilter === "reminders") {
      return node.cluster === "reminders";
    }
    return true;
  },

  startAnimationLoop() {
    const loop = () => {
      if (this.isOrbiting && !this.isDragging) {
        this.rotY += this.orbitSpeed;
      }
      this.draw();
      this.animFrameId = requestAnimationFrame(loop);
    };
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(loop);
  },

  async refresh() {
    try {
      const [explodedRes, unorgRes] = await Promise.all([
        fetch("/api/exploded"),
        fetch("/api/unorganized")
      ]);
      const data = explodedRes.ok ? await explodedRes.json() : {};
      const unorgData = unorgRes.ok ? await unorgRes.json() : [];
      this.build3DConstellation(data, unorgData);
    } catch (err) {
      console.error("Error building 3D constellation:", err);
    }
  },

  hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(99, 102, 241, ${alpha})`;
    if (hex.startsWith("rgba")) return hex.replace(/[\d.]+\)$/, `${alpha})`);
    if (hex.startsWith("rgb")) return hex.replace("rgb", "rgba").replace(")", `, ${alpha})`);
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  build3DConstellation(data, unorganizedItems) {
    this.nodes = [];
    this.links = [];

    const R = 250; // Torus major radius
    const r = 85;  // Torus minor tube radius

    // Helper: calculate 3D coordinates on the parametric Torus
    const getTorusCoords = (phi, theta, rOffset = 0) => {
      const rEff = r + rOffset;
      const x = (R + rEff * Math.cos(theta)) * Math.cos(phi);
      const y = rEff * Math.sin(theta);
      const z = (R + rEff * Math.cos(theta)) * Math.sin(phi);
      return { x, y, z };
    };

    // 1. Projects and Project Subtasks: Segregated into School and External sectors
    const projects = data.projects || [];
    const schoolProjects = projects.filter(p => (p.category || "External").toLowerCase() === "school");
    const externalProjects = projects.filter(p => (p.category || "External").toLowerCase() !== "school");

    const positionProjectCluster = (projList, startPhi, phiSpan, baseTheta, isSchool) => {
      const count = projList.length;
      projList.forEach((p, pIdx) => {
        const pPhi = startPhi + (pIdx / Math.max(count, 1)) * phiSpan;
        const pTheta = baseTheta;
        const pCoords = getTorusCoords(pPhi, pTheta, 0);

        const tasksCount = (p.tasks || []).length;
        const pColor = p.color || (isSchool ? "#ec4899" : "#3b82f6");
        const pNode = {
          id: p.id,
          type: "project",
          cluster: "projects",
          category: isSchool ? "School" : "External",
          title: p.name,
          description: p.description || "",
          projectName: p.name,
          tasksCount: tasksCount,
          x: pCoords.x,
          y: pCoords.y,
          z: pCoords.z,
          radius: 9.0,
          color: pColor,
          glowColor: this.hexToRgba(pColor, 0.55)
        };
        this.nodes.push(pNode);

        // Child subtasks orbiting along the torus tube around the project
        const tasks = p.tasks || [];
        tasks.forEach((t, tIdx) => {
          const tTheta = pTheta + ((tIdx + 1) * 1.35) % (Math.PI * 2);
          const tPhi = pPhi + Math.sin(tIdx * 1.4) * 0.08;
          const tOffset = Math.cos(tIdx * 1.8) * 16;
          const tCoords = getTorusCoords(tPhi, tTheta, tOffset);

          const isCompleted = t.status === "completed";
          const isUrgent = !isCompleted && Boolean(t.urgency && (t.urgency.level === "urgent" || t.urgency.level === "high" || t.urgency.level === "overdue"));
          const tColor = isCompleted ? "#a1a1aa" : (isUrgent ? "#FF4500" : (t.tier === "focus" ? "#6366f1" : "#10b981"));

          const tNode = {
            id: t.id,
            type: "task",
            cluster: "projects",
            category: isSchool ? "School" : "External",
            projectCategory: isSchool ? "School" : "External",
            title: t.title,
            description: t.description || "",
            dueDate: t.due_date_military || t.due_date || "",
            status: t.status || "pending",
            projectName: p.name,
            tier: t.tier,
            isUrgent: isUrgent,
            x: tCoords.x,
            y: tCoords.y,
            z: tCoords.z,
            radius: isUrgent ? 7.0 : 5.5,
            color: tColor,
            glowColor: this.hexToRgba(tColor, isUrgent ? 0.75 : 0.45)
          };
          this.nodes.push(tNode);
          this.links.push({
            from: pNode,
            to: tNode,
            color: this.hexToRgba(pColor, 0.3),
            cluster: "projects"
          });
        });
      });
    };

    // Position School projects in sector 1 (upper hemisphere)
    positionProjectCluster(schoolProjects, 0.12, 0.55, 0.65, true);
    // Position External projects in sector 2 (lower/equatorial hemisphere)
    positionProjectCluster(externalProjects, 0.78, 0.65, -0.65, false);

    // 2. Standalone Focus Tasks: Sector phi in [1.60, 2.75]
    const standaloneTasks = data.standalone_tasks || [];
    const focusTasks = standaloneTasks.filter(t => t.tier === "focus");
    focusTasks.forEach((t, idx) => {
      const fPhi = 1.65 + (idx / Math.max(focusTasks.length, 1)) * 1.05;
      const fTheta = (idx * 2.39996) % (Math.PI * 2);
      const fOffset = Math.sin(idx * 2.8) * 18;
      const fCoords = getTorusCoords(fPhi, fTheta, fOffset);

      const isCompleted = t.status === "completed";
      const isUrgent = !isCompleted && Boolean(t.urgency && (t.urgency.level === "urgent" || t.urgency.level === "high" || t.urgency.level === "overdue"));
      const fColor = isCompleted ? "#a1a1aa" : (isUrgent ? "#FF4500" : "#6366f1");

      const node = {
        id: t.id,
        type: "task",
        cluster: "focus",
        title: t.title,
        description: t.description || "",
        dueDate: t.due_date_military || t.due_date || "",
        status: t.status || "pending",
        tier: "focus",
        isUrgent: isUrgent,
        x: fCoords.x,
        y: fCoords.y,
        z: fCoords.z,
        radius: isUrgent ? 7.5 : 6.0,
        color: fColor,
        glowColor: this.hexToRgba(fColor, isUrgent ? 0.8 : 0.5)
      };
      this.nodes.push(node);
    });

    // 3. Standalone Trivial Tasks: Sector phi in [2.90, 3.95]
    const trivialTasks = standaloneTasks.filter(t => t.tier === "trivial");
    trivialTasks.forEach((t, idx) => {
      const trPhi = 2.95 + (idx / Math.max(trivialTasks.length, 1)) * 0.98;
      const trTheta = (idx * 2.39996) % (Math.PI * 2);
      const trOffset = Math.cos(idx * 3.1) * 18;
      const trCoords = getTorusCoords(trPhi, trTheta, trOffset);

      const isCompleted = t.status === "completed";
      const isUrgent = !isCompleted && Boolean(t.urgency && (t.urgency.level === "urgent" || t.urgency.level === "high" || t.urgency.level === "overdue"));
      const trColor = isCompleted ? "#d4d4d8" : (isUrgent ? "#FF4500" : "#10b981");

      const node = {
        id: t.id,
        type: "task",
        cluster: "trivial",
        title: t.title,
        description: t.description || "",
        dueDate: t.due_date_military || t.due_date || "",
        status: t.status || "pending",
        tier: "trivial",
        isUrgent: isUrgent,
        x: trCoords.x,
        y: trCoords.y,
        z: trCoords.z,
        radius: isUrgent ? 7.0 : 5.0,
        color: trColor,
        glowColor: this.hexToRgba(trColor, isUrgent ? 0.75 : 0.45)
      };
      this.nodes.push(node);
    });

    // 4. Scheduled Events: Sector phi in [4.10, 5.15]
    const events = data.events || [];
    events.forEach((e, idx) => {
      const ePhi = 4.15 + (idx / Math.max(events.length, 1)) * 0.98;
      const eTheta = (idx * 2.39996) % (Math.PI * 2);
      const eOffset = Math.sin(idx * 2.5) * 16;
      const eCoords = getTorusCoords(ePhi, eTheta, eOffset);

      const eColor = "#0284c7";
      const node = {
        id: e.id,
        type: "event",
        cluster: "events",
        title: e.title,
        description: e.description || "",
        dueDate: e.start_time ? App.formatMilitaryTime(e.start_time, true) : "",
        projectName: e.project_name,
        x: eCoords.x,
        y: eCoords.y,
        z: eCoords.z,
        radius: 5.5,
        color: eColor,
        glowColor: this.hexToRgba(eColor, 0.5)
      };
      this.nodes.push(node);
    });

    // 5. Reminders: Sector phi in [5.25, 5.80]
    const reminders = data.reminders || [];
    reminders.forEach((r, idx) => {
      const rPhi = 5.28 + (idx / Math.max(reminders.length, 1)) * 0.50;
      const rTheta = (idx * 2.39996) % (Math.PI * 2);
      const rOffset = Math.cos(idx * 2.7) * 16;
      const rCoords = getTorusCoords(rPhi, rTheta, rOffset);

      const remColor = "#ec4899";
      const node = {
        id: r.id,
        type: "reminder",
        cluster: "reminders",
        title: r.title,
        description: r.details || "",
        x: rCoords.x,
        y: rCoords.y,
        z: rCoords.z,
        radius: 5.0,
        color: remColor,
        glowColor: this.hexToRgba(remColor, 0.45)
      };
      this.nodes.push(node);
    });

    // 6. Unorganized Queue: Sector phi in [5.88, 6.22]
    if (unorganizedItems && unorganizedItems.length > 0) {
      unorganizedItems.forEach((u, idx) => {
        const uPhi = 5.88 + (idx / Math.max(unorganizedItems.length, 1)) * 0.34;
        const uTheta = (idx * 2.39996) % (Math.PI * 2);
        const uOffset = Math.sin(idx * 2.2) * 16;
        const uCoords = getTorusCoords(uPhi, uTheta, uOffset);

        const unorgColor = "#ea580c";
        const node = {
          id: u.id,
          type: "unorganized",
          cluster: "unorganized",
          title: u.raw_input,
          description: u.reasoning || "Pending manual triage",
          x: uCoords.x,
          y: uCoords.y,
          z: uCoords.z,
          radius: 5.5,
          color: unorgColor,
          glowColor: this.hexToRgba(unorgColor, 0.5)
        };
        this.nodes.push(node);
      });
    }
  },

  draw() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw 3D Torus Stardust Cloud
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    this.dustParticles.forEach(d => {
      const p = this.project3D(d.x, d.y, d.z, centerX, centerY);
      const finalAlpha = d.alpha * p.alpha;
      if (finalAlpha <= 0.01) return;

      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, Math.max(0.6, d.radius * p.scale), 0, Math.PI * 2);
      if (isDark) {
        ctx.fillStyle = `rgba(226, 232, 240, ${finalAlpha})`;
      } else {
        ctx.fillStyle = `rgba(71, 85, 105, ${finalAlpha * 0.85})`;
      }
      ctx.fill();
    });

    // 2. Project all nodes and sort by depth (farthest first)
    const projectedNodes = this.nodes
      .filter(n => this.isNodeVisible(n))
      .map(n => ({
        node: n,
        p: this.project3D(n.x, n.y, n.z, centerX, centerY)
      }))
      .sort((a, b) => a.p.depth - b.p.depth);

    const projectedMap = new Map();
    projectedNodes.forEach(item => projectedMap.set(item.node, item.p));

    // 3. Draw Constellation Links (delicate and soft)
    this.links.forEach(link => {
      if (!this.isNodeVisible(link.from) || !this.isNodeVisible(link.to)) return;
      const p1 = projectedMap.get(link.from);
      const p2 = projectedMap.get(link.to);
      if (!p1 || !p2) return;

      const avgAlpha = ((p1.alpha + p2.alpha) / 2) * 0.7;
      ctx.beginPath();
      ctx.moveTo(p1.screenX, p1.screenY);
      ctx.lineTo(p2.screenX, p2.screenY);
      ctx.strokeStyle = link.color;
      ctx.globalAlpha = avgAlpha;
      ctx.lineWidth = Math.max(0.8, 1.2 * ((p1.scale + p2.scale) / 2) * this.zoom);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });

    // 4. Draw Radiant Glowing Dots
    projectedNodes.forEach(({ node, p }) => {
      const isHovered = this.hoveredNode === node;
      const baseR = (node.radius || 6) * p.scale * this.zoom;
      const r = Math.max(2.5, baseR);

      ctx.save();
      ctx.globalAlpha = p.alpha;

      // Radiant pulsing shockwave for urgent nodes
      if (node.isUrgent) {
        const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
        const pulseR = r * (1.8 + pulse * 1.4);

        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 69, 0, ${(0.45 * (1 - pulse)).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, r * (1.2 + pulse * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 69, 0, ${(0.15 * (1 - pulse)).toFixed(3)})`;
        ctx.fill();
      }

      // Outer soft radiant glow aura / halo
      const haloR = isHovered ? r * 3.6 : (node.isUrgent ? r * 3.0 : r * 2.4);
      const haloGrad = ctx.createRadialGradient(p.screenX, p.screenY, 0, p.screenX, p.screenY, haloR);
      const haloAlpha = isHovered ? "0.65" : (node.isUrgent ? "0.58" : "0.40");

      haloGrad.addColorStop(0, this.hexToRgba(node.color, haloAlpha));
      haloGrad.addColorStop(0.45, this.hexToRgba(node.color, (parseFloat(haloAlpha) * 0.35).toFixed(2)));
      haloGrad.addColorStop(1, this.hexToRgba(node.color, "0"));

      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, haloR, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();

      // Inner bright energetic core dot
      const coreGrad = ctx.createRadialGradient(
        p.screenX, p.screenY, 0,
        p.screenX, p.screenY, r
      );
      // Pure white energetic light at core center
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      // Vibrant color transition
      coreGrad.addColorStop(0.4, node.color);
      coreGrad.addColorStop(1, node.color);

      ctx.beginPath();
      ctx.arc(p.screenX, p.screenY, r, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Delicate crisp radiant border on hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, r + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Clean label
      const fontSize = Math.max(9, Math.round(10 * p.scale * this.zoom));
      ctx.font = `600 ${fontSize}px var(--font-sans, 'Geist', 'Inter', sans-serif)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (isHovered || (p.scale * this.zoom > 0.85 && (node.type === "project" || node.isUrgent))) {
        const maxLen = isHovered ? 32 : 18;
        let titleText = node.title || "";
        if (titleText.length > maxLen) titleText = titleText.substring(0, maxLen) + "…";
        ctx.fillStyle = isDark ? "#f4f4f5" : "#18181b";
        ctx.fillText(titleText, p.screenX, p.screenY + r + fontSize + 2);
      }

      ctx.restore();
    });
  },

  showTooltip(node, mouseX, mouseY) {
    if (!this.tooltip) return;

    const titleEl = document.getElementById("mindmapTooltipTitle");
    const metaEl = document.getElementById("mindmapTooltipMeta");
    const descEl = document.getElementById("mindmapTooltipDesc");

    if (titleEl) titleEl.textContent = node.title;

    if (metaEl) {
      let typeLabel = "Item";
      if (node.type === "project") typeLabel = "📁 Project";
      else if (node.type === "task") typeLabel = node.tier === "focus" ? "🎯 Focus Task" : "⚡ Trivial Errand";
      else if (node.type === "event") typeLabel = "📅 Event";
      else if (node.type === "reminder") typeLabel = "🔔 Reminder";
      else if (node.type === "unorganized") typeLabel = "⚠️ Unsorted";

      const projLabel = node.projectName ? `[${node.projectName}]` : "";
      const statusLabel = node.status === "completed" ? "✓ Completed" : "○ Active";
      const dueLabel = node.dueDate ? `Due: ${App.formatMilitaryTime(node.dueDate, true)}` : "";

      metaEl.innerHTML = `
        <span>${typeLabel}</span>
        ${projLabel ? `<span>${projLabel}</span>` : ''}
        ${node.status ? `<span>${statusLabel}</span>` : ''}
        ${dueLabel ? `<span>${dueLabel}</span>` : ''}
      `;
    }

    if (descEl) {
      if (node.description && node.description.trim()) {
        descEl.style.display = "block";
        descEl.textContent = node.description;
      } else {
        descEl.style.display = "none";
      }
    }

    this.positionTooltip(mouseX, mouseY);
    this.tooltip.style.display = "block";
  },

  positionTooltip(mouseX, mouseY) {
    if (!this.tooltip || !this.canvas) return;
    const parent = this.canvas.parentElement;
    let left = mouseX + 16;
    let top = mouseY + 16;

    if (left + 300 > parent.clientWidth) {
      left = mouseX - 310;
    }
    if (top + 160 > parent.clientHeight) {
      top = mouseY - 140;
    }

    this.tooltip.style.left = `${Math.max(10, left)}px`;
    this.tooltip.style.top = `${Math.max(10, top)}px`;
  },

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = "none";
    }
  }
};

window.Mindmap = Mindmap;
