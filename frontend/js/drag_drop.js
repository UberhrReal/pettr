/**
 * PETTR Drag and Drop Priority Reordering
 */
const DragDrop = {
  draggedItem: null,

  initContainer(containerEl) {
    if (!containerEl) return;

    containerEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const afterElement = this.getDragAfterElement(containerEl, e.clientY);
      if (this.draggedItem) {
        if (afterElement == null) {
          containerEl.appendChild(this.draggedItem);
        } else {
          containerEl.insertBefore(this.draggedItem, afterElement);
        }
      }
    });

    containerEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.syncOrder(containerEl);
    });
  },

  makeDraggable(itemEl, containerEl) {
    itemEl.setAttribute("draggable", "true");

    itemEl.addEventListener("dragstart", (e) => {
      this.draggedItem = itemEl;
      itemEl.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", itemEl.dataset.taskId);
    });

    itemEl.addEventListener("dragend", () => {
      itemEl.classList.remove("dragging");
      this.draggedItem = null;
      this.syncOrder(containerEl);
    });
  },

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".task-item:not(.dragging)")];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  },

  async syncOrder(containerEl) {
    const items = [...containerEl.querySelectorAll(".task-item")];
    const taskIds = items.map(el => parseInt(el.dataset.taskId)).filter(id => !isNaN(id));

    // Live instant priority renumbering across all items in container
    items.forEach((item, idx) => {
      const badge = item.querySelector(".priority-num-badge");
      if (badge) {
        badge.textContent = String(idx + 1).padStart(2, '0');
        badge.title = `Priority Rank #${idx + 1}`;
      }
    });

    if (taskIds.length === 0) return;

    try {
      await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: taskIds })
      });
      App.showToast("Priorities updated & executive snapshot refreshed", 1500);

      // Refresh the Executive Snapshot markdown in real time to match new priority order
      if (typeof Dashboard !== "undefined" && Dashboard.loadBriefing) {
        await Dashboard.loadBriefing();
      }
    } catch (err) {
      console.error("Failed to sync order:", err);
    }
  }
};

window.DragDrop = DragDrop;
