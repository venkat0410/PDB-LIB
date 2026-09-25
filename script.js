/* ============================================================
   PCB Manufacturing Calculator Dashboard — script.js
   All calculation logic, navigation, theme management,
   localStorage history, CSV/PDF export.
   ============================================================ */

"use strict";

// ============================================================
// 1. NAVIGATION & THEME
// ============================================================

/** Currently active page id */
let currentPage = "dashboard";

/** Page titles */
const PAGE_TITLES = {
  dashboard: "Dashboard",
  stencil: "Stencil Aperture Calculator",
  throughhole: "Through-Hole Pad & Drill Calculator",
  pthpadstack: "PTH Pad Stack Engineering Workstation",
  converter: "Engineering Unit Converter",
  wiring: "Wiring Option",
  history: "Calculation History",
};

/**
 * Switch the visible module page.
 * @param {string} pageId  e.g. "stencil"
 */
function navigateTo(pageId) {
  currentPage = pageId;

  // Toggle page visibility
  document.querySelectorAll(".module-page").forEach((el) => {
    el.classList.toggle("active", el.id === `page-${pageId}`);
  });

  // Update nav
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === pageId);
  });

  // Update page title
  document.getElementById("pageTitle").textContent = PAGE_TITLES[pageId] || "Dashboard";

  // Close mobile sidebar
  closeSidebar();

  // Re-draw canvas if switching to stencil page
  if (pageId === "stencil") drawAperture();

  // Refresh dashboard stats when going home
  if (pageId === "dashboard") refreshDashboard();

  // Refresh history page
  if (pageId === "history") renderHistoryList();

  // Refresh PTH pad stack workstation view
  if (pageId === "pthpadstack" && typeof initPthPadStackWorkstation === "function") {
    initPthPadStackWorkstation();
  }
}

// Nav click handlers
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(el.dataset.page);
  });
});

// Quick-action cards on dashboard
document.querySelectorAll(".quick-action").forEach((el) => {
  el.addEventListener("click", () => navigateTo(el.dataset.goto));
});

// ----- Sidebar mobile toggle -----
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");

document.getElementById("menuToggle").addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
});

overlay.addEventListener("click", closeSidebar);

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// ----- Theme toggle -----
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");

// Load saved theme
const savedTheme = localStorage.getItem("pcb-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
updateThemeUI(savedTheme);

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("pcb-theme", next);
  updateThemeUI(next);
});

function updateThemeUI(theme) {
  themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
  themeLabel.textContent = theme === "dark" ? "Dark" : "Light";
}


// ============================================================
// 2. TOAST NOTIFICATIONS
// ============================================================

/**
 * Show a toast notification.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${typeIcon(type)}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function typeIcon(t) {
  return t === "success" ? "✅" : t === "error" ? "❌" : "ℹ️";
}


// ============================================================
// 3. LOCAL STORAGE HISTORY
// ============================================================

const HISTORY_KEY = "pcb-calc-history";

/**
 * Retrieve all history entries from localStorage.
 * @returns {Array<Object>}
 */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Save a new history entry.
 * @param {Object} entry - { type, data, timestamp }
 */
function saveHistory(entry) {
  const history = getHistory();
  entry.timestamp = new Date().toISOString();
  entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  history.unshift(entry); // newest first
  // Keep max 500 records
  if (history.length > 500) history.length = 500;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/** Clear all history. */
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryList();
  refreshDashboard();
  showToast("History cleared", "info");
}


// ============================================================
// 4. MODULE 1: STENCIL APERTURE CALCULATOR
// ============================================================

let selectedShape = "rectangle";
let activeStencilUnit = "mm";

// ----- Unit toggle -----
document.querySelectorAll(".stencil-unit-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".stencil-unit-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const newUnit = btn.dataset.unit;
    if (newUnit !== activeStencilUnit) {
      activeStencilUnit = newUnit;
      updateStencilUnit();
    }
  });
});

function updateStencilUnit() {
  const isMm = activeStencilUnit === "mm";
  const factor = isMm ? MIL_TO_MM : MM_TO_MIL;
  
  // Update labels
  document.querySelectorAll(".stencil-unit-lbl").forEach((el) => {
    el.textContent = activeStencilUnit;
  });
  
  // Convert inputs
  ["rectLength", "rectWidth", "circleDiameter", "cornerRadius", "stencilThickness"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value) {
      el.value = (parseFloat(el.value) * factor).toFixed(3).replace(/\.?0+$/, '');
    }
  });
  
  // Convert Polygon rows
  document.querySelectorAll("#coordBody tr").forEach((row) => {
    row.querySelectorAll("input").forEach((inp) => {
      if (inp.value) {
        inp.value = (parseFloat(inp.value) * factor).toFixed(3).replace(/\.?0+$/, '');
      }
    });
  });
  
  drawAperture();
  if (document.getElementById("resAreaOpening").textContent !== "—") {
    calculateStencil();
  }
}

// ----- Shape selector buttons -----
document.querySelectorAll("#shapeSelector .shape-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#shapeSelector .shape-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedShape = btn.dataset.shape;
    updateShapeInputs();
    drawAperture();
  });
});

/**
 * Show/hide the relevant dimension input fields based on selected shape.
 */
function updateShapeInputs() {
  const stdDims = document.getElementById("stdDimensions");
  const polyDims = document.getElementById("polyDimensions");
  const rectDims = document.getElementById("rectDims");
  const circleDims = document.getElementById("circleDims");
  const cornerDims = document.getElementById("cornerDims");

  if (selectedShape === "polygon") {
    stdDims.classList.add("hide");
    polyDims.classList.add("show");
    // Ensure at least 3 points
    if (getPolyPoints().length < 3) {
      resetPolyPoints();
    }
  } else {
    stdDims.classList.remove("hide");
    polyDims.classList.remove("show");
    rectDims.style.display = selectedShape === "circle" ? "none" : "";
    circleDims.style.display = selectedShape === "circle" ? "" : "none";
    cornerDims.style.display = selectedShape === "rounded-rect" ? "" : "none";
  }
}

// ----- Polygon coordinate table management -----
function getPolyPoints() {
  const rows = document.querySelectorAll("#coordBody tr");
  const pts = [];
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);
    if (!isNaN(x) && !isNaN(y)) pts.push({ x, y });
  });
  return pts;
}

function addPolyRow(x = "", y = "") {
  const tbody = document.getElementById("coordBody");
  const idx = tbody.rows.length + 1;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td style="color:var(--text-muted);font-size:0.8rem;">${idx}</td>
    <td><input type="number" step="0.01" value="${x}" placeholder="X" /></td>
    <td><input type="number" step="0.01" value="${y}" placeholder="Y" /></td>
    <td><button class="remove-btn" title="Remove point">✕</button></td>
  `;
  // Bind remove
  tr.querySelector(".remove-btn").addEventListener("click", () => {
    tr.remove();
    renumberPolyRows();
    drawAperture();
  });
  // Re-draw on input change
  tr.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => drawAperture());
  });
  tbody.appendChild(tr);
}

function renumberPolyRows() {
  document.querySelectorAll("#coordBody tr").forEach((tr, i) => {
    tr.cells[0].textContent = i + 1;
  });
}

function resetPolyPoints() {
  document.getElementById("coordBody").innerHTML = "";
  // Add 3 default empty rows
  addPolyRow(0, 0);
  addPolyRow(1, 0);
  addPolyRow(0.5, 1);
}

document.getElementById("addPointBtn").addEventListener("click", () => {
  addPolyRow();
  drawAperture();
});

// Initialize polygon rows
resetPolyPoints();

// ----- Canvas drawing -----

/**
 * Draw the aperture shape on the HTML5 Canvas.
 */
function drawAperture() {
  const canvas = document.getElementById("apertureCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background grid
  drawGrid(ctx, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const scale = 80; // pixels per mm (display scale)

  // Colors
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const fillColor = isDark ? "rgba(34,211,238,0.18)" : "rgba(8,145,178,0.15)";
  const strokeColor = isDark ? "#22d3ee" : "#0891b2";
  const dimColor = isDark ? "#94a3b8" : "#64748b";

  ctx.lineWidth = 2;
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;

  switch (selectedShape) {
    case "rectangle": {
      const l = parseFloat(document.getElementById("rectLength").value) || 0;
      const w = parseFloat(document.getElementById("rectWidth").value) || 0;
      if (l > 0 && w > 0) {
        const rw = l * scale;
        const rh = w * scale;
        ctx.beginPath();
        ctx.rect(cx - rw / 2, cy - rh / 2, rw, rh);
        ctx.fill();
        ctx.stroke();
        // Dimension labels
        drawDimLabel(ctx, `${l} ${activeStencilUnit}`, cx, cy + rh / 2 + 18, dimColor);
        drawDimLabelVertical(ctx, `${w} ${activeStencilUnit}`, cx - rw / 2 - 18, cy, dimColor);
      }
      break;
    }
    case "circle": {
      const d = parseFloat(document.getElementById("circleDiameter").value) || 0;
      if (d > 0) {
        const r = (d / 2) * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Diameter line
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        ctx.moveTo(cx - r, cy);
        ctx.lineTo(cx + r, cy);
        ctx.strokeStyle = dimColor;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = strokeColor;
        drawDimLabel(ctx, `⌀${d} ${activeStencilUnit}`, cx, cy - r - 12, dimColor);
      }
      break;
    }
    case "rounded-rect": {
      const l = parseFloat(document.getElementById("rectLength").value) || 0;
      const w = parseFloat(document.getElementById("rectWidth").value) || 0;
      const cr = parseFloat(document.getElementById("cornerRadius").value) || 0;
      if (l > 0 && w > 0) {
        const rw = l * scale;
        const rh = w * scale;
        const rr = Math.min(cr * scale, rw / 2, rh / 2);
        const x0 = cx - rw / 2;
        const y0 = cy - rh / 2;
        ctx.beginPath();
        ctx.moveTo(x0 + rr, y0);
        ctx.lineTo(x0 + rw - rr, y0);
        ctx.arcTo(x0 + rw, y0, x0 + rw, y0 + rr, rr);
        ctx.lineTo(x0 + rw, y0 + rh - rr);
        ctx.arcTo(x0 + rw, y0 + rh, x0 + rw - rr, y0 + rh, rr);
        ctx.lineTo(x0 + rr, y0 + rh);
        ctx.arcTo(x0, y0 + rh, x0, y0 + rh - rr, rr);
        ctx.lineTo(x0, y0 + rr);
        ctx.arcTo(x0, y0, x0 + rr, y0, rr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        drawDimLabel(ctx, `${l} ${activeStencilUnit}`, cx, cy + rh / 2 + 18, dimColor);
        drawDimLabelVertical(ctx, `${w} ${activeStencilUnit}`, cx - rw / 2 - 18, cy, dimColor);
      }
      break;
    }
    case "polygon": {
      const pts = getPolyPoints();
      if (pts.length >= 3) {
        // Find bounding box to center
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const bw = maxX - minX;
        const bh = maxY - minY;
        // Fit scale
        const fitScale = Math.min((W - 60) / (bw || 1), (H - 60) / (bh || 1), 120);
        const offX = cx - ((minX + maxX) / 2) * fitScale;
        const offY = cy - ((minY + maxY) / 2) * fitScale;

        ctx.beginPath();
        pts.forEach((p, i) => {
          const px = p.x * fitScale + offX;
          const py = p.y * fitScale + offY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw vertex dots and labels
        pts.forEach((p, i) => {
          const px = p.x * fitScale + offX;
          const py = p.y * fitScale + offY;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = strokeColor;
          ctx.fill();
          ctx.fillStyle = fillColor;
          // Label
          ctx.fillStyle = dimColor;
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillText(`P${i + 1}`, px + 6, py - 6);
          ctx.fillStyle = fillColor;
        });
      }
      break;
    }
  }
}

function drawGrid(ctx, W, H) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  ctx.strokeStyle = isDark ? "rgba(148,163,184,0.06)" : "rgba(15,23,42,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawDimLabel(ctx, text, x, y, color) {
  ctx.font = "12px 'JetBrains Mono', monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function drawDimLabelVertical(ctx, text, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "12px 'JetBrains Mono', monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Real-time preview on input changes
["rectLength", "rectWidth", "circleDiameter", "cornerRadius", "stencilThickness"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", () => drawAperture());
});

// ----- Stencil Calculations -----

/**
 * Calculate area, perimeter, and area ratio for the selected aperture shape.
 *
 * FORMULAS:
 *  Rectangle:
 *    Area = Length × Width
 *    Perimeter = 2 × (Length + Width)
 *
 *  Circle:
 *    Area = π × (Diameter/2)²
 *    Perimeter = π × Diameter
 *
 *  Rounded Rectangle:
 *    Area = L×W − (4 − π) × r²
 *    Perimeter = 2×(L + W) − 8r + 2πr
 *    (where r = corner radius)
 *
 *  Irregular Polygon (Shoelace Formula):
 *    Area = 0.5 × |Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|
 *    Perimeter = Σ √((xᵢ₊₁−xᵢ)² + (yᵢ₊₁−yᵢ)²)
 *
 *  Area Ratio = Area Opening / (Perimeter × Stencil Thickness)
 *    Pass if ≥ 0.66
 *    Warning if ≥ 0.60
 *    Fail if < 0.60
 */
function calculateStencil() {
  const thickness = parseFloat(document.getElementById("stencilThickness").value);
  if (!thickness || thickness <= 0) {
    showToast("Please enter a valid stencil thickness.", "error");
    return;
  }

  let area = 0, perimeter = 0;
  let steps = [];
  let shapeLabel = "";

  switch (selectedShape) {
    case "rectangle": {
      const L = parseFloat(document.getElementById("rectLength").value);
      const W = parseFloat(document.getElementById("rectWidth").value);
      if (!L || !W || L <= 0 || W <= 0) {
        showToast("Please enter valid length and width.", "error");
        return;
      }
      shapeLabel = "Rectangle";
      area = L * W;
      perimeter = 2 * (L + W);
      steps = [
        `<span class="step-label">Shape:</span> Rectangle`,
        `<span class="step-label">Dimensions:</span> L = ${L} ${activeStencilUnit}, W = ${W} ${activeStencilUnit}`,
        `<span class="step-formula">Area = L × W</span>`,
        `<span class="step-result">Area = ${L} × ${W} = ${area.toFixed(4)} sq ${activeStencilUnit}</span>`,
        `<span class="step-formula">Perimeter = 2 × (L + W)</span>`,
        `<span class="step-result">Perimeter = 2 × (${L} + ${W}) = ${perimeter.toFixed(4)} ${activeStencilUnit}</span>`,
      ];
      break;
    }
    case "circle": {
      const D = parseFloat(document.getElementById("circleDiameter").value);
      if (!D || D <= 0) {
        showToast("Please enter a valid diameter.", "error");
        return;
      }
      shapeLabel = "Circle";
      const r = D / 2;
      area = Math.PI * r * r;
      perimeter = Math.PI * D;
      steps = [
        `<span class="step-label">Shape:</span> Circle`,
        `<span class="step-label">Diameter:</span> ${D} ${activeStencilUnit} (Radius = ${r} ${activeStencilUnit})`,
        `<span class="step-formula">Area = π × r²</span>`,
        `<span class="step-result">Area = π × ${r}² = ${area.toFixed(4)} sq ${activeStencilUnit}</span>`,
        `<span class="step-formula">Perimeter = π × D</span>`,
        `<span class="step-result">Perimeter = π × ${D} = ${perimeter.toFixed(4)} ${activeStencilUnit}</span>`,
      ];
      break;
    }
    case "rounded-rect": {
      const L = parseFloat(document.getElementById("rectLength").value);
      const W = parseFloat(document.getElementById("rectWidth").value);
      const cr = parseFloat(document.getElementById("cornerRadius").value) || 0;
      if (!L || !W || L <= 0 || W <= 0) {
        showToast("Please enter valid length and width.", "error");
        return;
      }
      // Clamp corner radius to half the smaller dimension
      const rMax = Math.min(L / 2, W / 2);
      const r = Math.min(cr, rMax);
      shapeLabel = "Rounded Rectangle";

      // Area = L*W minus the 4 square corners plus the 4 quarter-circle corners
      // Area = L*W − 4r² + πr²  =  L*W − (4−π)r²
      area = L * W - (4 - Math.PI) * r * r;

      // Perimeter = 2(L + W) − 8r + 2πr
      perimeter = 2 * (L + W) - 8 * r + 2 * Math.PI * r;

      steps = [
        `<span class="step-label">Shape:</span> Rounded Rectangle`,
        `<span class="step-label">Dimensions:</span> L = ${L} ${activeStencilUnit}, W = ${W} ${activeStencilUnit}, r = ${r.toFixed(3)} ${activeStencilUnit}`,
        `<span class="step-formula">Area = L×W − (4−π)×r²</span>`,
        `<span class="step-result">Area = ${L}×${W} − (4−π)×${r.toFixed(3)}² = ${area.toFixed(4)} sq ${activeStencilUnit}</span>`,
        `<span class="step-formula">Perimeter = 2×(L+W) − 8r + 2πr</span>`,
        `<span class="step-result">Perimeter = ${perimeter.toFixed(4)} ${activeStencilUnit}</span>`,
      ];
      break;
    }
    case "polygon": {
      const pts = getPolyPoints();
      if (pts.length < 3) {
        showToast("A polygon needs at least 3 vertices.", "error");
        return;
      }
      shapeLabel = `Irregular Polygon (${pts.length} vertices)`;

      // ----- Shoelace formula for area -----
      // Area = 0.5 × |Σ(xᵢ × yᵢ₊₁ − xᵢ₊₁ × yᵢ)|
      let shoelaceSum = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        shoelaceSum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      area = Math.abs(shoelaceSum) / 2;

      // ----- Perimeter -----
      // Perimeter = Σ √((xᵢ₊₁−xᵢ)² + (yᵢ₊₁−yᵢ)²)
      perimeter = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        perimeter += Math.sqrt(dx * dx + dy * dy);
      }

      steps = [
        `<span class="step-label">Shape:</span> Irregular Polygon (${n} vertices)`,
        `<span class="step-label">Vertices:</span> ${pts.map((p, i) => `P${i + 1}(${p.x}, ${p.y})`).join(", ")}`,
        `<span class="step-formula">Shoelace Formula:  Area = 0.5 × |Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)|</span>`,
        `<span class="step-result">Shoelace sum = ${shoelaceSum.toFixed(6)}</span>`,
        `<span class="step-result">Area = 0.5 × |${shoelaceSum.toFixed(6)}| = ${area.toFixed(4)} sq ${activeStencilUnit}</span>`,
        `<span class="step-formula">Perimeter = Σ edge lengths</span>`,
        `<span class="step-result">Perimeter = ${perimeter.toFixed(4)} ${activeStencilUnit}</span>`,
      ];
      break;
    }
  }

  // ----- Area Wall & Area Ratio -----
  // Area Wall = Perimeter × Stencil Thickness
  const areaWall = perimeter * thickness;

  // Area Ratio = Area Opening / Area Wall
  //            = Area Opening / (Perimeter × Thickness)
  const areaRatio = area / areaWall;

  // Pass/Fail criteria (IPC-7525 guideline):
  //   ≥ 0.66 → PASS
  //   0.60 – 0.65 → WARNING (marginal)
  //   < 0.60 → FAIL
  let status, statusClass;
  if (areaRatio >= 0.66) {
    status = "✅ PASS";
    statusClass = "badge-pass";
  } else if (areaRatio >= 0.60) {
    status = "⚠️ WARNING";
    statusClass = "badge-warn";
  } else {
    status = "❌ FAIL";
    statusClass = "badge-fail";
  }

  steps.push(
    "",
    `<span class="step-label">Stencil Thickness:</span> ${thickness} ${activeStencilUnit}`,
    `<span class="step-formula">Area Wall = Perimeter × Thickness</span>`,
    `<span class="step-result">Area Wall = ${perimeter.toFixed(4)} × ${thickness} = ${areaWall.toFixed(4)} sq ${activeStencilUnit}</span>`,
    `<span class="step-formula">Area Ratio = Area Opening / (Perimeter × Thickness)</span>`,
    `<span class="step-result">Area Ratio = ${area.toFixed(4)} / ${areaWall.toFixed(4)} = ${areaRatio.toFixed(4)}</span>`,
    "",
    `<span class="step-label">Status:</span> <span class="badge ${statusClass}">${status}</span>`,
    `<span style="color:var(--text-muted);">  IPC-7525 guideline: ≥ 0.66 PASS | 0.60–0.65 WARNING | < 0.60 FAIL</span>`
  );

  // Update result cards
  document.getElementById("resAreaOpening").textContent = area.toFixed(4);
  document.getElementById("resPerimeter").textContent = perimeter.toFixed(4);
  document.getElementById("resAreaWall").textContent = areaWall.toFixed(4);
  document.getElementById("resAreaRatio").textContent = areaRatio.toFixed(4);
  document.getElementById("resPassFail").innerHTML = `<span class="badge ${statusClass}">${status}</span>`;

  // Update steps
  document.getElementById("stencilCalcSteps").innerHTML = steps.join("<br/>");

  // Save to history
  saveHistory({
    type: "Stencil Aperture",
    data: {
      shape: shapeLabel,
      areaOpening: area.toFixed(4),
      perimeter: perimeter.toFixed(4),
      areaWall: areaWall.toFixed(4),
      areaRatio: areaRatio.toFixed(4),
      thickness: thickness,
      status: status.replace(/[✅⚠️❌] /g, ""),
    },
  });

  showToast("Stencil aperture calculated!", "success");
}

document.getElementById("calcStencilBtn").addEventListener("click", calculateStencil);

// Copy stencil results
document.getElementById("copyStencilResults").addEventListener("click", () => {
  const ao = document.getElementById("resAreaOpening").textContent;
  const peri = document.getElementById("resPerimeter").textContent;
  const aw = document.getElementById("resAreaWall").textContent;
  const ar = document.getElementById("resAreaRatio").textContent;
  const text = `Area Opening: ${ao} sq ${activeStencilUnit}\nPerimeter: ${peri} ${activeStencilUnit}\nArea Wall: ${aw} sq ${activeStencilUnit}\nArea Ratio: ${ar}`;
  navigator.clipboard.writeText(text).then(() => showToast("Results copied!", "success"));
});

// Reset stencil
document.getElementById("resetStencilBtn").addEventListener("click", () => {
  ["rectLength", "rectWidth", "circleDiameter", "cornerRadius", "stencilThickness"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  resetPolyPoints();
  document.getElementById("resAreaOpening").textContent = "—";
  document.getElementById("resPerimeter").textContent = "—";
  document.getElementById("resAreaWall").textContent = "—";
  document.getElementById("resAreaRatio").textContent = "—";
  document.getElementById("resPassFail").innerHTML = "";
  document.getElementById("stencilCalcSteps").innerHTML =
    '<span style="color:var(--text-muted);">Enter parameters and click Calculate to see detailed steps…</span>';
  drawAperture();
  showToast("Stencil calculator reset.", "info");
});


// ============================================================
// 5. MODULE 2: THROUGH-HOLE PAD & DRILL CALCULATOR
// ============================================================

/**
 * FORMULAS (Revised Company Standard):
 *
 *   Finished Hole Size = Pin Diameter + 8 mil   (company standard)
 *
 *   Drill Size = Finished Hole + (2 × Plating Allowance)
 *     - Plating Allowance is optional; defaults to 0 mil.
 *     - When plating allowance is 0, Drill Size = Finished Hole Size.
 *     - Typical plating allowance values: 0.5–1.5 mil per side.
 *
 *   Hole-to-Pin Clearance = Finished Hole Size − Pin Diameter
 *     - This is always 8 mil by the company standard,
 *       but is calculated explicitly for verification.
 *
 * All calculations are internally done in mil and then converted
 * to the user-selected display unit.
 *
 * Conversion factors:
 *   1 mm   = 39.3701 mil
 *   1 mil  = 0.0254 mm
 */

const MM_TO_MIL = 39.3700787402;
const MIL_TO_MM = 0.0254;

let componentIdCounter = 0;

function addComponentEntry() {
  componentIdCounter++;
  const container = document.getElementById("componentEntries");
  const entry = document.createElement("div");
  entry.className = "component-entry";
  entry.id = `comp-${componentIdCounter}`;
  entry.innerHTML = `
    <div class="form-group">
      <label>Reference</label>
      <input type="text" class="form-control" placeholder="e.g. R1, C2" data-field="ref" />
    </div>
    <div class="form-group">
      <label>Pin Diameter</label>
      <input type="number" class="form-control" placeholder="e.g. 0.6" step="0.01" min="0" data-field="pin" />
    </div>
    <div class="form-group" style="visibility:hidden;">
      <label>&nbsp;</label>
      <span></span>
    </div>
    <button class="btn btn-danger btn-icon" onclick="this.closest('.component-entry').remove()" title="Remove">✕</button>
  `;
  container.appendChild(entry);
}

// Add initial entry
addComponentEntry();

document.getElementById("addComponentBtn").addEventListener("click", addComponentEntry);

document.getElementById("calcTHBtn").addEventListener("click", calculateThroughHole);

function calculateThroughHole() {
  const unit = document.getElementById("thUnit").value; // "mm" or "mil"
  const entries = document.querySelectorAll("#componentEntries .component-entry");

  // Read optional plating allowance (in mil). Default to 0 if empty.
  const platingRaw = parseFloat(document.getElementById("thPlating").value);
  const platingMil = (!isNaN(platingRaw) && platingRaw >= 0) ? platingRaw : 0;

  if (entries.length === 0) {
    showToast("Add at least one component.", "error");
    return;
  }

  const results = [];
  const stepsLines = [];

  // Show plating context once at top
  stepsLines.push(
    `<span class="step-label">Plating Allowance:</span> ${platingMil.toFixed(2)} mil per side` +
    (platingMil === 0 ? ' <span style="color:var(--text-muted);">(not specified — Drill = Finished Hole)</span>' : ''),
    ""
  );

  entries.forEach((entry, idx) => {
    const ref = entry.querySelector('[data-field="ref"]').value || `Comp${idx + 1}`;
    const pinRaw = parseFloat(entry.querySelector('[data-field="pin"]').value);
    if (isNaN(pinRaw) || pinRaw <= 0) return;

    // Convert pin diameter to mil for calculations
    const pinMil = unit === "mm" ? pinRaw * MM_TO_MIL : pinRaw;

    // Company Standard:  Finished Hole = Pin Diameter + 8 mil
    const finishedHoleMil = pinMil + 8;

    // Drill Size = Finished Hole + 2 × Plating Allowance
    // (plating is deposited on both walls, so total reduction = 2 × allowance)
    const drillMil = finishedHoleMil + 2 * platingMil;
    const roundedDrillMil = Math.ceil(drillMil);
    const recommendedFinishedDrillMil = roundedDrillMil % 2 === 0 ? roundedDrillMil : roundedDrillMil + 1;
    const recommendedPadMil = recommendedFinishedDrillMil + 20;

    // Hole-to-Pin Clearance = Finished Hole − Pin Diameter
    const clearanceMil = finishedHoleMil - pinMil; // always 8 mil by definition

    // Build result object with both display units.
    const toMilDisplay = (valMil) => valMil.toFixed(2);
    const toMmDisplay = (valMil) => (valMil * MIL_TO_MM).toFixed(4);
    const toDualDisplay = (valMil) => `${toMmDisplay(valMil)} mm / ${toMilDisplay(valMil)} mil`;

    const row = {
      ref,
      pin: toDualDisplay(pinMil),
      finishedHole: toDualDisplay(finishedHoleMil),
      drill: toDualDisplay(drillMil),
      recommendedFinishedDrill: toDualDisplay(recommendedFinishedDrillMil),
      recommendedPad: toDualDisplay(recommendedPadMil),
      clearance: toDualDisplay(clearanceMil),
      unit: "mm / mil",
    };
    results.push(row);

    stepsLines.push(
      `<span class="step-label">─── ${ref} ───</span>`,
      `<span class="step-label">Lead Diameter:</span> ${toDualDisplay(pinMil)}`,
      `<span class="step-formula">Finished Hole = Pin Dia + 8 mil (company std)</span>`,
      `<span class="step-result">Finished Hole = ${pinMil.toFixed(2)} + 8 = ${finishedHoleMil.toFixed(2)} mil → ${toDualDisplay(finishedHoleMil)}</span>`,
      `<span class="step-formula">Drill Size = Finished Hole + 2 × Plating Allowance</span>`,
      `<span class="step-result">Drill = ${finishedHoleMil.toFixed(2)} + 2 × ${platingMil.toFixed(2)} = ${drillMil.toFixed(2)} mil → ${toDualDisplay(drillMil)}</span>`,
      `<span class="step-formula">Recommended Finished Drill Size = Calculated Drill Size rounded up to the next even mil size</span>`,
      `<span class="step-result">Recommended Finished Drill = ${drillMil.toFixed(2)} mil → ${recommendedFinishedDrillMil.toFixed(2)} mil → ${toDualDisplay(recommendedFinishedDrillMil)}</span>`,
      `<span class="step-formula">Recommended Pad Size = Recommended Finished Drill Size + 20 mil</span>`,
      `<span class="step-result">Recommended Pad = ${recommendedFinishedDrillMil.toFixed(2)} + 20 = ${recommendedPadMil.toFixed(2)} mil → ${toDualDisplay(recommendedPadMil)}</span>`,
      `<span class="step-formula">Hole-to-Pin Clearance = Finished Hole − Pin Dia</span>`,
      `<span class="step-result">Clearance = ${finishedHoleMil.toFixed(2)} − ${pinMil.toFixed(2)} = ${clearanceMil.toFixed(2)} mil → ${toDualDisplay(clearanceMil)}</span>`,
      ""
    );
  });

  if (results.length === 0) {
    showToast("Please enter valid pin diameters.", "error");
    return;
  }

  // Render table
  const tbody = document.getElementById("thResultBody");
  tbody.innerHTML = results
    .map(
      (r) => `
    <tr>
      <td>${r.ref}</td>
      <td>${r.pin}</td>
      <td>${r.drill}</td>
      <td>${r.recommendedFinishedDrill}</td>
      <td>${r.recommendedPad}</td>
      <td>${r.clearance}</td>
      <td>${r.unit}</td>
    </tr>`
    )
    .join("");

  // Render steps
  document.getElementById("thCalcSteps").innerHTML = stepsLines.join("<br/>");

  // Save to history
  saveHistory({
    type: "Through-Hole",
    data: results,
  });

  showToast(`Calculated ${results.length} component(s)!`, "success");
}

// Copy through-hole results
document.getElementById("copyTHResults").addEventListener("click", () => {
  const rows = document.querySelectorAll("#thResultBody tr");
  let text = "Ref\tLead Diameter\tCalculated Drill Size\tRecommended Finished Drill Size\tRecommended Pad Size\tHole-to-Pin Clearance\tUnit\n";
  rows.forEach((tr) => {
    const cells = Array.from(tr.cells).map((c) => c.textContent.trim());
    text += cells.join("\t") + "\n";
  });
  navigator.clipboard.writeText(text).then(() => showToast("Table copied!", "success"));
});


// ============================================================
// 6. MODULE 3: PTH PAD STACK WORKSTATION — see pth_pad_stack_workstation.js
// ============================================================


// ============================================================
// 7. MODULE 4: ENGINEERING UNIT CONVERTER
// ============================================================

/**
 * CONVERSION FACTORS:
 *   1 inch = 25.4 mm
 *   1 inch = 1000 mil
 *   1 mm   = 39.3700787402 mil
 *   1 mil  = 0.0254 mm
 */

// mm ↔ mil
const mmMilMm = document.getElementById("conv_mm_mil_mm");
const mmMilMil = document.getElementById("conv_mm_mil_mil");
const mmMilResult = document.getElementById("conv_mm_mil_result");
const mmMilUnit = document.getElementById("conv_mm_mil_unit");

mmMilMm.addEventListener("input", () => {
  const v = parseFloat(mmMilMm.value);
  if (!isNaN(v)) {
    const mil = v * MM_TO_MIL;
    mmMilMil.value = "";
    mmMilResult.textContent = mil.toFixed(4);
    mmMilUnit.textContent = `${v} mm = ${mil.toFixed(4)} mil`;
    saveConversion("mm → mil", v, mil);
  } else {
    mmMilResult.textContent = "—";
    mmMilUnit.textContent = "";
  }
});

mmMilMil.addEventListener("input", () => {
  const v = parseFloat(mmMilMil.value);
  if (!isNaN(v)) {
    const mm = v * MIL_TO_MM;
    mmMilMm.value = "";
    mmMilResult.textContent = mm.toFixed(4);
    mmMilUnit.textContent = `${v} mil = ${mm.toFixed(4)} mm`;
    saveConversion("mil → mm", v, mm);
  } else {
    mmMilResult.textContent = "—";
    mmMilUnit.textContent = "";
  }
});

// mm ↔ inch
const mmInchMm = document.getElementById("conv_mm_inch_mm");
const mmInchInch = document.getElementById("conv_mm_inch_inch");
const mmInchResult = document.getElementById("conv_mm_inch_result");
const mmInchUnit = document.getElementById("conv_mm_inch_unit");

mmInchMm.addEventListener("input", () => {
  const v = parseFloat(mmInchMm.value);
  if (!isNaN(v)) {
    const inch = v / 25.4;
    mmInchInch.value = "";
    mmInchResult.textContent = inch.toFixed(6);
    mmInchUnit.textContent = `${v} mm = ${inch.toFixed(6)} inch`;
    saveConversion("mm → inch", v, inch);
  } else {
    mmInchResult.textContent = "—";
    mmInchUnit.textContent = "";
  }
});

mmInchInch.addEventListener("input", () => {
  const v = parseFloat(mmInchInch.value);
  if (!isNaN(v)) {
    const mm = v * 25.4;
    mmInchMm.value = "";
    mmInchResult.textContent = mm.toFixed(4);
    mmInchUnit.textContent = `${v} inch = ${mm.toFixed(4)} mm`;
    saveConversion("inch → mm", v, mm);
  } else {
    mmInchResult.textContent = "—";
    mmInchUnit.textContent = "";
  }
});

// mil ↔ inch
const milInchMil = document.getElementById("conv_mil_inch_mil");
const milInchInch = document.getElementById("conv_mil_inch_inch");
const milInchResult = document.getElementById("conv_mil_inch_result");
const milInchUnit = document.getElementById("conv_mil_inch_unit");

milInchMil.addEventListener("input", () => {
  const v = parseFloat(milInchMil.value);
  if (!isNaN(v)) {
    const inch = v / 1000;
    milInchInch.value = "";
    milInchResult.textContent = inch.toFixed(6);
    milInchUnit.textContent = `${v} mil = ${inch.toFixed(6)} inch`;
    saveConversion("mil → inch", v, inch);
  } else {
    milInchResult.textContent = "—";
    milInchUnit.textContent = "";
  }
});

milInchInch.addEventListener("input", () => {
  const v = parseFloat(milInchInch.value);
  if (!isNaN(v)) {
    const mil = v * 1000;
    milInchMil.value = "";
    milInchResult.textContent = mil.toFixed(2);
    milInchUnit.textContent = `${v} inch = ${mil.toFixed(2)} mil`;
    saveConversion("inch → mil", v, mil);
  } else {
    milInchResult.textContent = "—";
    milInchUnit.textContent = "";
  }
});

/** Debounced save for conversions so we don't flood history */
let convSaveTimer = null;
function saveConversion(label, from, to) {
  clearTimeout(convSaveTimer);
  convSaveTimer = setTimeout(() => {
    saveHistory({
      type: "Unit Conversion",
      data: { conversion: label, from, to },
    });
  }, 1500);
}


// ============================================================
// 8. MODULE 5: WIRING OPTION
// ============================================================

const AWG_WIRE_DATABASE = [
  { awg: 32, strandAwg: "7/40", strandDia: "7/0.08 mm", conductorDiaMm: 0.24, insulationDiaMm: 1.11, currentA: 0.7, partNo: "200C-740" },
  { awg: 30, strandAwg: "7/38", strandDia: "7/0.10 mm", conductorDiaMm: 0.30, insulationDiaMm: 1.16, currentA: 1.0, partNo: "200C-738" },
  { awg: 28, strandAwg: "1/28", strandDia: "1/0.32 mm", conductorDiaMm: 0.32, insulationDiaMm: 1.19, currentA: 2.1, partNo: "200C-28" },
  { awg: 28, strandAwg: "7/36", strandDia: "7/0.13 mm", conductorDiaMm: 0.38, insulationDiaMm: 1.24, currentA: 2.1, partNo: "200C-736", preferred: true },
  { awg: 26, strandAwg: "1/26", strandDia: "1/0.40 mm", conductorDiaMm: 0.40, insulationDiaMm: 1.27, currentA: 3.0, partNo: "200C-26" },
  { awg: 26, strandAwg: "7/34", strandDia: "7/0.16 mm", conductorDiaMm: 0.48, insulationDiaMm: 1.34, currentA: 3.0, partNo: "200C-734" },
  { awg: 26, strandAwg: "19/38", strandDia: "19/0.10 mm", conductorDiaMm: 0.51, insulationDiaMm: 1.34, currentA: 3.0, partNo: "200C-1938", preferred: true },
  { awg: 24, strandAwg: "1/24", strandDia: "1/0.51 mm", conductorDiaMm: 0.51, insulationDiaMm: 1.37, currentA: 4.0, partNo: "200C-124" },
  { awg: 24, strandAwg: "7/32", strandDia: "7/0.20 mm", conductorDiaMm: 0.60, insulationDiaMm: 1.47, currentA: 4.0, partNo: "200C-732" },
  { awg: 22, strandAwg: "19/36", strandDia: "19/0.13 mm", conductorDiaMm: 0.65, insulationDiaMm: 1.57, currentA: 7.0, partNo: "200C-1936", preferred: true },
  { awg: 22, strandAwg: "1/22", strandDia: "1/0.64 mm", conductorDiaMm: 0.64, insulationDiaMm: 1.52, currentA: 7.3, partNo: "200C-122" },
  { awg: 22, strandAwg: "7/30", strandDia: "7/0.25 mm", conductorDiaMm: 0.75, insulationDiaMm: 1.62, currentA: 7.3, partNo: "200C-730" },
  { awg: 22, strandAwg: "19/34", strandDia: "19/0.16 mm", conductorDiaMm: 0.80, insulationDiaMm: 1.62, currentA: 7.3, partNo: "200C-1934", preferred: true },
  { awg: 20, strandAwg: "1/20", strandDia: "1/0.81 mm", conductorDiaMm: 0.81, insulationDiaMm: 1.67, currentA: 11.0, partNo: "200C-120" },
  { awg: 20, strandAwg: "7/28", strandDia: "7/0.32 mm", conductorDiaMm: 0.96, insulationDiaMm: 1.82, currentA: 11.0, partNo: "200C-728" },
  { awg: 20, strandAwg: "19/32", strandDia: "19/0.20 mm", conductorDiaMm: 1.00, insulationDiaMm: 1.82, currentA: 11.0, partNo: "200C-1932", preferred: true },
  { awg: 18, strandAwg: "1/18", strandDia: "1/1.02 mm", conductorDiaMm: 1.02, insulationDiaMm: 1.93, currentA: 11.0, partNo: "200C-118" },
  { awg: 18, strandAwg: "7/26", strandDia: "7/0.40 mm", conductorDiaMm: 1.22, insulationDiaMm: 2.13, currentA: 16.0, partNo: "200C-726" },
  { awg: 18, strandAwg: "19/30", strandDia: "19/0.25 mm", conductorDiaMm: 1.25, insulationDiaMm: 2.13, currentA: 16.0, partNo: "200C-1930", preferred: true },
  { awg: 16, strandAwg: "19/29", strandDia: "19/0.29 mm", conductorDiaMm: 1.45, insulationDiaMm: 2.41, currentA: 22.0, partNo: "200C-1929", preferred: true },
  { awg: 16, strandAwg: "19/28", strandDia: "19/0.32 mm", conductorDiaMm: 1.50, insulationDiaMm: 2.54, currentA: 26.0, partNo: "200C-1928" },
  { awg: 14, strandAwg: "19/27", strandDia: "19/0.36 mm", conductorDiaMm: 1.80, insulationDiaMm: 2.89, currentA: 22.0, partNo: "200C-1927", preferred: true },
  { awg: 13, strandAwg: "19/26", strandDia: "19/0.40 mm", conductorDiaMm: 2.00, insulationDiaMm: 3.02, currentA: 35.0, partNo: "200C-1926" },
  { awg: 12, strandAwg: "19/25", strandDia: "19/0.45 mm", conductorDiaMm: 2.25, insulationDiaMm: 3.37, currentA: 41.0, partNo: "200C-1925" },
  { awg: 12, strandAwg: "37/28", strandDia: "37/0.32 mm", conductorDiaMm: 2.24, insulationDiaMm: 3.23, currentA: 41.0, partNo: "200C-3728" },
  { awg: 11, strandAwg: "19/24", strandDia: "19/0.50 mm", conductorDiaMm: 2.50, insulationDiaMm: 3.58, currentA: 45.0, partNo: "200C-1924" },
  { awg: 10, strandAwg: "19/22", strandDia: "19/0.65 mm", conductorDiaMm: 3.25, insulationDiaMm: 4.34, currentA: 55.0, partNo: "200C-1922" },
  { awg: 10, strandAwg: "37/26", strandDia: "37/0.40 mm", conductorDiaMm: 2.80, insulationDiaMm: 3.88, currentA: 50.0, partNo: "200C-3726" },
  { awg: 8, strandAwg: "133/29", strandDia: "133/0.29 mm", conductorDiaMm: 4.29, insulationDiaMm: 5.56, currentA: 75.0, partNo: "200C-13329" },
  { awg: 6, strandAwg: "133/27", strandDia: "133/0.36 mm", conductorDiaMm: 5.41, insulationDiaMm: 6.93, currentA: 100.0, partNo: "200C-13327" },
];

let wiringPinCounter = 0;
let currentWiringResults = [];

function roundUpEvenMil(valueMil) {
  const rounded = Math.ceil(valueMil);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function addWiringPinEntry(pin = {}) {
  wiringPinCounter++;
  const container = document.getElementById("wiringPinEntries");
  const entry = document.createElement("div");
  entry.className = "component-entry wiring-entry";
  entry.id = `wire-pin-${wiringPinCounter}`;
  entry.innerHTML = `
    <div class="form-group">
      <label>Pin Number</label>
      <input type="text" class="form-control" placeholder="e.g. 1" data-field="pinNo" value="${pin.pinNo || ""}" />
    </div>
    <div class="form-group">
      <label>Pin Name</label>
      <input type="text" class="form-control" placeholder="e.g. +IN" data-field="pinName" value="${pin.pinName || ""}" />
    </div>
    <div class="form-group">
      <label>Current Rating (A)</label>
      <input type="number" class="form-control" placeholder="e.g. 8" step="0.1" min="0" data-field="currentA" value="${pin.currentA || ""}" />
    </div>
    <div class="form-group">
      <label>Pin Diameter (mm)</label>
      <input type="number" class="form-control" placeholder="Optional" step="0.01" min="0" data-field="pinDiaMm" value="${pin.pinDiaMm || ""}" />
    </div>
    <button class="btn btn-danger btn-icon" title="Remove">x</button>
  `;
  entry.querySelector("button").addEventListener("click", () => entry.remove());
  container.appendChild(entry);
}

function selectWireForCurrent(currentA) {
  const suitable = AWG_WIRE_DATABASE
    .filter((wire) => wire.currentA >= currentA)
    .sort((a, b) =>
      (a.preferred === b.preferred ? 0 : a.preferred ? -1 : 1) ||
      a.currentA - b.currentA ||
      a.conductorDiaMm - b.conductorDiaMm
    );

  if (suitable.length > 0) return { wire: suitable[0], status: "OK" };

  return {
    wire: AWG_WIRE_DATABASE[AWG_WIRE_DATABASE.length - 1],
    status: "Input current exceeds listed Flutef table range",
  };
}

function calculateWiringOptions() {
  const entries = document.querySelectorAll(".wiring-entry");
  const rows = [];
  const steps = [];

  entries.forEach((entry, index) => {
    const pinNo = entry.querySelector('[data-field="pinNo"]').value.trim() || `${index + 1}`;
    const pinName = entry.querySelector('[data-field="pinName"]').value.trim() || `Pin ${index + 1}`;
    const currentA = parseFloat(entry.querySelector('[data-field="currentA"]').value);
    const pinDiaRaw = parseFloat(entry.querySelector('[data-field="pinDiaMm"]').value);
    const pinDiaMm = !isNaN(pinDiaRaw) && pinDiaRaw > 0 ? pinDiaRaw : 0;

    if (isNaN(currentA) || currentA <= 0) return;

    const selection = selectWireForCurrent(currentA);
    const wire = selection.wire;
    const conductorCriteriaMm = Math.max(wire.conductorDiaMm * 3, pinDiaMm);
    const insulationCriteriaMm = Math.max(wire.insulationDiaMm * 2, pinDiaMm);
    const totalDiameterMm = Math.max(conductorCriteriaMm, insulationCriteriaMm);
    const requiredDrillRawMil = (totalDiameterMm + 0.2) * MM_TO_MIL;
    const requiredDrillMil = roundUpEvenMil(requiredDrillRawMil);
    const solderPadMil = requiredDrillMil + 20;
    const governing = insulationCriteriaMm >= conductorCriteriaMm ? "B" : "A";

    rows.push({
      pinNo,
      pinName,
      inputCurrentA: currentA.toFixed(2),
      pinDia: pinDiaMm ? `${pinDiaMm.toFixed(2)} mm` : "Not specified",
      awg: wire.awg,
      strands: `${wire.strandDia} (${wire.strandAwg})`,
      conductorDia: `${wire.conductorDiaMm.toFixed(2)} mm`,
      insulationDia: `${wire.insulationDiaMm.toFixed(2)} mm`,
      wireCurrentA: `${wire.currentA.toFixed(1)} A`,
      partNo: wire.partNo,
      criteriaA: `${conductorCriteriaMm.toFixed(2)} mm`,
      criteriaB: `${insulationCriteriaMm.toFixed(2)} mm`,
      totalDiameter: `${totalDiameterMm.toFixed(2)} mm (${governing})`,
      requiredDrill: `${requiredDrillMil.toFixed(0)} mil`,
      solderPad: `${solderPadMil.toFixed(0)} mil`,
      status: selection.status,
    });

    steps.push(
      `<span class="step-label">${pinNo} - ${pinName}</span>`,
      `Current ${currentA.toFixed(2)} A selects AWG ${wire.awg}, ${wire.strandDia}, part ${wire.partNo}, rated ${wire.currentA.toFixed(1)} A.`,
      `A = max(3 x conductor dia, pin dia) = max(${(wire.conductorDiaMm * 3).toFixed(2)}, ${pinDiaMm.toFixed(2)}) = ${conductorCriteriaMm.toFixed(2)} mm.`,
      `B = max(2 x insulation dia, pin dia) = max(${(wire.insulationDiaMm * 2).toFixed(2)}, ${pinDiaMm.toFixed(2)}) = ${insulationCriteriaMm.toFixed(2)} mm.`,
      `Total Diameter = larger of A and B = ${totalDiameterMm.toFixed(2)} mm (${governing}).`,
      `Required PCB Drill = (${totalDiameterMm.toFixed(2)} + 0.20) x 39.3701 = ${requiredDrillRawMil.toFixed(2)} mil, rounded to ${requiredDrillMil.toFixed(0)} mil.`,
      `Recommended Solder Pad = ${requiredDrillMil.toFixed(0)} + 20 = ${solderPadMil.toFixed(0)} mil.`,
      selection.status === "OK" ? "" : `<span style="color:var(--accent-rose);">${selection.status}</span>`,
      ""
    );
  });

  if (rows.length === 0) {
    showToast("Please enter at least one valid wiring current rating.", "error");
    return;
  }

  currentWiringResults = rows;
  document.getElementById("wiringResultBody").innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.pinNo}</td>
          <td>${row.pinName}</td>
          <td>${row.inputCurrentA}</td>
          <td>${row.pinDia}</td>
          <td>${row.awg}</td>
          <td>${row.strands}</td>
          <td>${row.conductorDia}</td>
          <td>${row.insulationDia}</td>
          <td>${row.wireCurrentA}</td>
          <td>${row.partNo}</td>
          <td>${row.criteriaA}</td>
          <td>${row.criteriaB}</td>
          <td>${row.totalDiameter}</td>
          <td>${row.requiredDrill}</td>
          <td>${row.solderPad}</td>
        </tr>`
    )
    .join("");

  document.getElementById("wiringCalcSteps").innerHTML = steps.join("<br/>");
  showToast(`Generated ${rows.length} wiring recommendation(s).`, "success");
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadWiringReport() {
  if (currentWiringResults.length === 0) {
    showToast("Calculate wiring options before downloading.", "error");
    return;
  }

  const headers = [
    "Pin No.",
    "Pin Name",
    "Current (A)",
    "Pin Diameter",
    "Recommended AWG",
    "Number of Strands / Strand Diameter",
    "Conductor Diameter",
    "Diameter over Insulation",
    "Wire Current Rating",
    "Wire Part Number",
    "Criteria A",
    "Criteria B",
    "Total Diameter",
    "Required PCB Drill Size",
    "Recommended Solder Pad Size",
    "Status",
  ];

  const csvRows = currentWiringResults.map((row) => [
    row.pinNo,
    row.pinName,
    row.inputCurrentA,
    row.pinDia,
    row.awg,
    row.strands,
    row.conductorDia,
    row.insulationDia,
    row.wireCurrentA,
    row.partNo,
    row.criteriaA,
    row.criteriaB,
    row.totalDiameter,
    row.requiredDrill,
    row.solderPad,
    row.status,
  ]);

  const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(csv, "wiring_option_report.csv", "text/csv");
  showToast("Wiring report downloaded.", "success");
}

document.getElementById("addWiringPinBtn").addEventListener("click", () => addWiringPinEntry());
document.getElementById("calcWiringBtn").addEventListener("click", calculateWiringOptions);
document.getElementById("downloadWiringReportBtn").addEventListener("click", downloadWiringReport);

addWiringPinEntry();


// ============================================================
// 8. HISTORY RENDERING & SEARCH
// ============================================================

function renderHistoryList(filter = "") {
  const container = document.getElementById("historyList");
  let history = getHistory();
  if (filter) {
    const lf = filter.toLowerCase();
    history = history.filter((h) => {
      const dataStr = JSON.stringify(h.data).toLowerCase();
      return h.type.toLowerCase().includes(lf) || dataStr.includes(lf);
    });
  }

  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No matching records found.</p></div>`;
    return;
  }

  container.innerHTML = history
    .map((h) => {
      const time = new Date(h.timestamp).toLocaleString();
      let dataHtml = "";
      if (h.type === "Stencil Aperture") {
        const d = h.data;
        dataHtml = `Shape: ${d.shape} | Area: ${d.areaOpening} mm² | Ratio: ${d.areaRatio} | ${d.status}`;
      } else if (h.type === "Through-Hole") {
        if (Array.isArray(h.data)) {
          dataHtml = h.data.map((r) => `${r.ref}: Hole=${r.finishedHole} Drill=${r.drill}`).join(" | ");
        } else {
          dataHtml = JSON.stringify(h.data);
        }
      } else if (h.type === "Unit Conversion") {
        const d = h.data;
        dataHtml = `${d.conversion}: ${d.from} → ${d.to}`;
      }
      return `<div class="history-entry">
        <div class="history-meta">
          <span class="history-type">${h.type}</span>
          <span class="history-time">${time}</span>
        </div>
        <div class="history-data">${dataHtml}</div>
      </div>`;
    })
    .join("");
}

document.getElementById("historySearch").addEventListener("input", (e) => {
  renderHistoryList(e.target.value);
});

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all history?")) {
    clearHistory();
  }
});


// ============================================================
// 8. EXPORT: CSV
// ============================================================

document.getElementById("exportCSVBtn").addEventListener("click", () => {
  const history = getHistory();
  if (history.length === 0) {
    showToast("No data to export.", "error");
    return;
  }

  let csv = "Timestamp,Type,Details\n";
  history.forEach((h) => {
    const time = new Date(h.timestamp).toLocaleString();
    const details = JSON.stringify(h.data).replace(/"/g, '""');
    csv += `"${time}","${h.type}","${details}"\n`;
  });

  downloadFile(csv, "pcb_calc_history.csv", "text/csv");
  showToast("CSV exported!", "success");
});


// ============================================================
// 9. EXPORT: PDF (Pure JavaScript)
// ============================================================

/**
 * Generate a simple PDF from history data.
 * This uses raw PDF content generation — no external library needed.
 * The approach builds a minimal PDF 1.4 file with text streams.
 */
document.getElementById("exportPDFBtn").addEventListener("click", () => {
  const history = getHistory();
  if (history.length === 0) {
    showToast("No data to export.", "error");
    return;
  }

  // Build text lines for the PDF
  const lines = [
    "PCB Manufacturing Calculator — History Report",
    `Generated: ${new Date().toLocaleString()}`,
    `Total Records: ${history.length}`,
    "",
    "=".repeat(60),
  ];

  history.forEach((h, i) => {
    const time = new Date(h.timestamp).toLocaleString();
    lines.push("");
    lines.push(`#${i + 1}  [${h.type}]  ${time}`);

    if (h.type === "Stencil Aperture") {
      const d = h.data;
      lines.push(`  Shape: ${d.shape}`);
      lines.push(`  Area Opening: ${d.areaOpening} mm2`);
      lines.push(`  Perimeter: ${d.perimeter} mm`);
      lines.push(`  Area Wall: ${d.areaWall} mm2`);
      lines.push(`  Area Ratio: ${d.areaRatio}`);
      lines.push(`  Status: ${d.status}`);
    } else if (h.type === "Through-Hole" && Array.isArray(h.data)) {
      h.data.forEach((r) => {
        lines.push(`  ${r.ref}: Pin=${r.pin} Hole=${r.finishedHole} Drill=${r.drill} Clearance=${r.clearance}`);
      });
    } else if (h.type === "Unit Conversion") {
      const d = h.data;
      lines.push(`  ${d.conversion}: ${d.from} -> ${d.to}`);
    }
    lines.push("-".repeat(60));
  });

  // Create PDF using a printable window (reliable cross-browser approach)
  const printWin = window.open("", "_blank", "width=800,height=600");
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PCB Calculator — History Report</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; padding: 40px; line-height: 1.6; color: #1a1a1a; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .meta { font-size: 10px; color: #666; margin-bottom: 20px; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>PCB Manufacturing Calculator — History Report</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()} | ${history.length} records</div>
      <pre>${lines.join("\n").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();

  showToast("PDF export window opened!", "success");
});


// ============================================================
// 10. DASHBOARD: Stats & Recent Activity
// ============================================================

function refreshDashboard() {
  const history = getHistory();

  const stencilCount = history.filter((h) => h.type === "Stencil Aperture").length;
  const thCount = history.filter((h) => h.type === "Through-Hole").length;
  const convCount = history.filter((h) => h.type === "Unit Conversion").length;

  document.getElementById("dashStencilCount").textContent = stencilCount;
  document.getElementById("dashTHCount").textContent = thCount;
  document.getElementById("dashConvCount").textContent = convCount;
  document.getElementById("dashTotalCount").textContent = history.length;

  // Recent 5
  const recent = history.slice(0, 5);
  const container = document.getElementById("dashRecentHistory");
  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No calculations yet. Start by using one of the calculators!</p></div>`;
    return;
  }

  container.innerHTML = recent
    .map((h) => {
      const time = new Date(h.timestamp).toLocaleString();
      let summary = "";
      if (h.type === "Stencil Aperture") summary = `${h.data.shape} — Ratio: ${h.data.areaRatio}`;
      else if (h.type === "Through-Hole" && Array.isArray(h.data)) summary = `${h.data.length} component(s)`;
      else if (h.type === "Unit Conversion") summary = h.data.conversion;
      return `<div class="history-entry">
        <div class="history-meta">
          <span class="history-type">${h.type}</span>
          <span class="history-time">${time}</span>
        </div>
        <div class="history-data">${summary}</div>
      </div>`;
    })
    .join("");
}


// ============================================================
// 11. UTILITY: File download helper
// ============================================================

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ============================================================
// 12. INITIALIZATION
// ============================================================

// Draw initial canvas
drawAperture();

// Refresh dashboard on load
refreshDashboard();

// Render history list
renderHistoryList();

// Listen for theme changes to redraw canvas
const observer = new MutationObserver(() => drawAperture());
observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
