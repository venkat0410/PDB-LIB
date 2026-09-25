  /* ============================================================
    PTH Pad Stack Engineering Workstation
    IPC-2221 & IPC-7251 compliant lead / drill / pad calculator
    Integrated into PCB CalcPro — fully offline, no external deps.
    ============================================================ */

  "use strict";

  (function initPthPadStackModule() {
    const STORAGE_KEY = "pcb-pthws-saved-specs";

    let activeUnit = "mm";
    let activeProfile = "square";
    let savedSpecsList = [];
    let pthwsInitialized = false;

    const layers = { pin: true, drill: true, annular: true, diag: true };

    const el = {
      inputDimA: () => document.getElementById("pthws-input-dim-a"),
      inputDimB: () => document.getElementById("pthws-input-dim-b"),
      labelDimA: () => document.getElementById("pthws-label-dim-a"),
      containerDimB: () => document.getElementById("pthws-container-dim-b"),
      selectIpc: () => document.getElementById("pthws-input-ipc"),
      inputAnnular: () => document.getElementById("pthws-input-annular"),
      inputWander: () => document.getElementById("pthws-input-wander"),
      inputPlating: () => document.getElementById("pthws-input-plating"),
      inputOverdrill: () => document.getElementById("pthws-input-overdrill"),
      svgOuterPad: () => document.getElementById("pthws-svg-outer-pad"),
      svgDrillHole: () => document.getElementById("pthws-svg-drill-hole"),
      svgPlatedWall: () => document.getElementById("pthws-svg-plated-wall"),
      svgMetalPin: () => document.getElementById("pthws-svg-metal-pin"),
      svgDiag1: () => document.getElementById("pthws-svg-diagonal-line-1"),
      svgDiag2: () => document.getElementById("pthws-svg-diagonal-line-2"),
    };

    function pthwsToast(message, type = "info") {
      if (typeof showToast === "function") {
        showToast(message, type === "success" ? "success" : type === "error" ? "error" : "info");
        return;
      }
      console.log(`[PTH WS] ${message}`);
    }

    function loadSavedSpecs() {
      try {
        savedSpecsList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      } catch {
        savedSpecsList = [];
      }
    }

    function persistSavedSpecs() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSpecsList));
    }

    function toggleCADLayer(layerId) {
      const checkbox = document.getElementById(`pthws-layer-${layerId}`);
      if (!checkbox) return;
      layers[layerId] = checkbox.checked;

      const pin = el.svgMetalPin();
      const drill = el.svgDrillHole();
      const wall = el.svgPlatedWall();
      const pad = el.svgOuterPad();
      const d1 = el.svgDiag1();
      const d2 = el.svgDiag2();

      if (layerId === "pin" && pin) pin.style.opacity = layers.pin ? "1" : "0";
      if (layerId === "drill") {
        if (drill) drill.style.opacity = layers.drill ? "1" : "0";
        if (wall) wall.style.opacity = layers.drill ? "1" : "0";
      }
      if (layerId === "annular" && pad) pad.style.opacity = layers.annular ? "1" : "0";
      if (layerId === "diag") {
        if (d1) d1.style.opacity = layers.diag ? "1" : "0";
        if (d2) d2.style.opacity = layers.diag ? "1" : "0";
      }
    }

    function updateUnitButtons() {
      document.querySelectorAll(".pthws-unit-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.unit === activeUnit);
      });
      document.querySelectorAll(".pthws-unit-lbl").forEach((lbl) => {
        lbl.textContent = activeUnit;
      });
    }

    function setGlobalUnit(unit) {
      activeUnit = unit;
      const inputDimA = el.inputDimA();
      const inputDimB = el.inputDimB();
      const inputAnnular = el.inputAnnular();
      const inputWander = el.inputWander();
      const inputPlating = el.inputPlating();
      const inputOverdrill = el.inputOverdrill();

      if (!inputDimA) return;

      if (unit === "mm") {
        inputDimA.min = "0.1";
        inputDimA.max = "4.0";
        inputDimA.step = "0.01";
        inputDimA.value = "0.64";
        inputDimB.min = "0.1";
        inputDimB.max = "4.0";
        inputDimB.step = "0.01";
        inputDimB.value = activeProfile === "square" ? "0.64" : "0.50";
        inputAnnular.value = "0.20";
        inputWander.value = "0.10";
        inputPlating.value = "0.025";
        inputOverdrill.value = "0.05";
      } else {
        inputDimA.min = "4.0";
        inputDimA.max = "160.0";
        inputDimA.step = "0.1";
        inputDimA.value = "25.2";
        inputDimB.min = "4.0";
        inputDimB.max = "160.0";
        inputDimB.step = "0.1";
        inputDimB.value = activeProfile === "square" ? "25.2" : "19.7";
        inputAnnular.value = "8.00";
        inputWander.value = "4.00";
        inputPlating.value = "1.00";
        inputOverdrill.value = "2.00";
      }

      updateUnitButtons();
      updateControlLabels();
      evaluatePadStack();
    }

    function updateControlLabels() {
      const labelDimA = el.labelDimA();
      if (!labelDimA) return;

      if (activeProfile === "square") {
        labelDimA.textContent = activeUnit === "mm" ? "Square Lead Side (a)" : "Square Lead Side (a - mil)";
      } else {
        labelDimA.textContent = activeUnit === "mm" ? "Lead Width (a)" : "Lead Width (a - mil)";
      }
    }

    function setPinProfile(profile) {
      activeProfile = profile;
      const btnSquare = document.querySelector('[data-pthws-profile="square"]');
      const btnRect = document.querySelector('[data-pthws-profile="rect"]');
      const containerDimB = el.containerDimB();

      if (btnSquare && btnRect) {
        btnSquare.classList.toggle("active", profile === "square");
        btnRect.classList.toggle("active", profile === "rect");
      }
      if (containerDimB) {
        containerDimB.style.display = profile === "square" ? "none" : "";
      }
      if (profile === "square") {
        const dimA = el.inputDimA();
        const dimB = el.inputDimB();
        if (dimA && dimB) dimB.value = dimA.value;
      }

      const formulaDiagEq = document.getElementById("pthws-formula-diag-eq");
      if (formulaDiagEq) {
        formulaDiagEq.textContent = profile === "square" ? "c = a × √2" : "c = √(a² + b²)";
      }

      updateControlLabels();
      evaluatePadStack();
    }

    function evaluatePadStack() {
      const inputDimA = el.inputDimA();
      if (!inputDimA) return;

      const dimA = parseFloat(inputDimA.value);
      const dimB = parseFloat(el.inputDimB().value);
      const ipcClass = el.selectIpc().value;
      const annularVal = parseFloat(el.inputAnnular().value) || 0;
      const wanderVal = parseFloat(el.inputWander().value) || 0;
      const platingVal = parseFloat(el.inputPlating().value) || 0;
      const overdrillVal = parseFloat(el.inputOverdrill().value) || 0;

      document.getElementById("pthws-val-dim-a").textContent = `${dimA} ${activeUnit}`;
      document.getElementById("pthws-val-dim-b").textContent = `${dimB} ${activeUnit}`;

      let diagonal = 0;
      if (activeProfile === "square") {
        diagonal = dimA * Math.sqrt(2);
      } else {
        diagonal = Math.sqrt((dimA * dimA) + (dimB * dimB));
      }

      let ipcClearance = 0;
      if (activeUnit === "mm") {
        ipcClearance = ipcClass === "A" ? 0.25 : (ipcClass === "B" ? 0.20 : 0.15);
      } else {
        ipcClearance = ipcClass === "A" ? 10.0 : (ipcClass === "B" ? 8.0 : 6.0);
      }

      const drillHole = diagonal + ipcClearance + (2 * platingVal) + overdrillVal;
      const padDiameter = drillHole + (2 * annularVal) + wanderVal;
      const prec = activeUnit === "mm" ? 3 : 1;

      document.getElementById("pthws-metric-diagonal").textContent = `${diagonal.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-metric-drill").textContent = `${drillHole.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-metric-pad").textContent = `${padDiameter.toFixed(prec)} ${activeUnit}`;

      document.getElementById("pthws-formula-diag-val").textContent = `c = ${diagonal.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-formula-drill-val").textContent =
        `d = ${diagonal.toFixed(prec)} + ${ipcClearance.toFixed(prec)} + 2(${platingVal.toFixed(prec)}) + ${overdrillVal.toFixed(prec)} = ${drillHole.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-formula-pad-val").textContent =
        `D = ${drillHole.toFixed(prec)} + 2(${annularVal.toFixed(prec)}) + ${wanderVal.toFixed(prec)} = ${padDiameter.toFixed(prec)} ${activeUnit}`;

      document.getElementById("pthws-print-prof").textContent = activeProfile.toUpperCase();
      document.getElementById("pthws-print-dim-a").textContent = `${dimA} ${activeUnit}`;
      document.getElementById("pthws-print-dim-b").textContent = activeProfile === "square" ? "N/A" : `${dimB} ${activeUnit}`;
      document.getElementById("pthws-print-ipc").textContent = `Level ${ipcClass}`;
      document.getElementById("pthws-print-plating").textContent = `${platingVal} ${activeUnit}`;
      document.getElementById("pthws-print-annular").textContent = `${annularVal} ${activeUnit}`;
      document.getElementById("pthws-print-wander").textContent = `${wanderVal} ${activeUnit}`;
      document.getElementById("pthws-print-overdrill").textContent = `${overdrillVal} ${activeUnit}`;
      document.getElementById("pthws-print-calc-diag").textContent = `${diagonal.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-print-calc-drill").textContent = `${drillHole.toFixed(prec)} ${activeUnit}`;
      document.getElementById("pthws-print-calc-pad").textContent = `${padDiameter.toFixed(prec)} ${activeUnit}`;

      renderCadPreview(dimA, dimB, drillHole, padDiameter, platingVal);
    }

    function renderCadPreview(dimA, dimB, drillHole, padDiameter, platingVal) {
      const svgOuterPad = el.svgOuterPad();
      const svgDrillHole = el.svgDrillHole();
      const svgPlatedWall = el.svgPlatedWall();
      const svgMetalPin = el.svgMetalPin();
      const svgDiag1 = el.svgDiag1();
      const svgDiag2 = el.svgDiag2();
      if (!svgOuterPad) return;

      let ratioScale = activeUnit === "mil" ? 25.4 : 1;
      const scaleFactor = 100 / (padDiameter / ratioScale);
      const padRadius = (padDiameter / 2 / ratioScale) * scaleFactor;
      const drillRadius = (drillHole / 2 / ratioScale) * scaleFactor;
      const platingRadius = ((drillHole - (2 * platingVal)) / 2 / ratioScale) * scaleFactor;
      const pinWSvg = (dimA / ratioScale) * scaleFactor;
      const pinHSvg = ((activeProfile === "square" ? dimA : dimB) / ratioScale) * scaleFactor;

      svgOuterPad.setAttribute("r", Math.max(10, Math.min(120, padRadius)));
      svgDrillHole.setAttribute("r", Math.max(5, Math.min(115, drillRadius)));
      svgPlatedWall.setAttribute("r", Math.max(4, Math.min(113, platingRadius)));
      svgPlatedWall.setAttribute("stroke-width", Math.max(1.5, (platingVal / ratioScale) * scaleFactor * 2));
      svgMetalPin.setAttribute("width", Math.max(2, pinWSvg));
      svgMetalPin.setAttribute("height", Math.max(2, pinHSvg));
      svgMetalPin.setAttribute("x", 125 - pinWSvg / 2);
      svgMetalPin.setAttribute("y", 125 - pinHSvg / 2);

      svgDiag1.setAttribute("x1", 125 - pinWSvg / 2);
      svgDiag1.setAttribute("y1", 125 - pinHSvg / 2);
      svgDiag1.setAttribute("x2", 125 + pinWSvg / 2);
      svgDiag1.setAttribute("y2", 125 + pinHSvg / 2);
      svgDiag2.setAttribute("x1", 125 + pinWSvg / 2);
      svgDiag2.setAttribute("y1", 125 - pinHSvg / 2);
      svgDiag2.setAttribute("x2", 125 - pinWSvg / 2);
      svgDiag2.setAttribute("y2", 125 + pinHSvg / 2);

      ["pin", "drill", "annular", "diag"].forEach(toggleCADLayer);
    }

    function saveFootprintRecord() {
      const dimA = parseFloat(el.inputDimA().value);
      const dimB = parseFloat(el.inputDimB().value);
      const ipcClass = el.selectIpc().value;

      const record = {
        id: `PTH-${Date.now().toString().slice(-4)}`,
        profile: activeProfile.toUpperCase(),
        size: activeProfile === "square" ? `${dimA} ${activeUnit}` : `${dimA}x${dimB} ${activeUnit}`,
        diagonal: document.getElementById("pthws-metric-diagonal").textContent,
        drill: document.getElementById("pthws-metric-drill").textContent,
        pad: document.getElementById("pthws-metric-pad").textContent,
        ipc: `Level ${ipcClass}`,
      };

      savedSpecsList.push(record);
      persistSavedSpecs();
      pthwsToast(`Footprint configuration [${record.id}] saved.`, "success");
      updateSavedSpecsTable();
    }

    function deleteRecord(id) {
      savedSpecsList = savedSpecsList.filter((rec) => rec.id !== id);
      persistSavedSpecs();
      updateSavedSpecsTable();
      pthwsToast("Footprint spec deleted.", "info");
    }

    function clearSavedSpecs() {
      savedSpecsList = [];
      persistSavedSpecs();
      updateSavedSpecsTable();
      pthwsToast("All saved specifications deleted.", "error");
    }

    function updateSavedSpecsTable() {
      const body = document.getElementById("pthws-saved-logs-body");
      if (!body) return;

      if (savedSpecsList.length === 0) {
        body.innerHTML =
          '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No saved specification files yet.</td></tr>';
        return;
      }

      body.innerHTML = savedSpecsList
        .map(
          (rec) => `
          <tr>
            <td>${rec.id}</td>
            <td>${rec.profile}</td>
            <td>${rec.size}</td>
            <td>${rec.diagonal}</td>
            <td>${rec.drill}</td>
            <td>${rec.pad}</td>
            <td>${rec.ipc}</td>
            <td><button type="button" class="btn btn-danger btn-icon btn-sm pthws-delete-btn" data-id="${rec.id}" title="Delete">✕</button></td>
          </tr>`
        )
        .join("");

      body.querySelectorAll(".pthws-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteRecord(btn.dataset.id));
      });
    }

    function printPthSpec() {
      document.body.classList.add("pthws-printing");
      const cleanup = () => {
        document.body.classList.remove("pthws-printing");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
    }

    function bindEvents() {
      if (pthwsInitialized) return;

      document.getElementById("pthws-unit-mm")?.addEventListener("click", () => setGlobalUnit("mm"));
      document.getElementById("pthws-unit-mil")?.addEventListener("click", () => setGlobalUnit("mil"));

      document.querySelectorAll("[data-pthws-profile]").forEach((btn) => {
        btn.addEventListener("click", () => setPinProfile(btn.dataset.pthwsProfile));
      });

      document.getElementById("pthws-input-dim-a")?.addEventListener("input", (e) => {
        if (activeProfile === "square") {
          const dimB = document.getElementById("pthws-input-dim-b");
          if (dimB) {
            dimB.value = e.target.value;
          }
        }
      });

      [
        "pthws-input-dim-a",
        "pthws-input-dim-b",
        "pthws-input-ipc",
        "pthws-input-annular",
        "pthws-input-wander",
        "pthws-input-plating",
        "pthws-input-overdrill",
      ].forEach((id) => {
        const node = document.getElementById(id);
        node?.addEventListener("input", evaluatePadStack);
        node?.addEventListener("change", evaluatePadStack);
      });

      ["pin", "drill", "annular", "diag"].forEach((layerId) => {
        document.getElementById(`pthws-layer-${layerId}`)?.addEventListener("change", () => toggleCADLayer(layerId));
      });

      document.getElementById("pthws-save-btn")?.addEventListener("click", saveFootprintRecord);
      document.getElementById("pthws-clear-specs-btn")?.addEventListener("click", clearSavedSpecs);
      document.getElementById("pthws-print-btn")?.addEventListener("click", printPthSpec);

      pthwsInitialized = true;
    }

    window.initPthPadStackWorkstation = function initPthPadStackWorkstation() {
      bindEvents();
      loadSavedSpecs();
      updateSavedSpecsTable();
      evaluatePadStack();
    };

    window.deletePthRecord = deleteRecord;

    if (document.getElementById("page-pthpadstack")) {
      bindEvents();
      loadSavedSpecs();
      updateSavedSpecsTable();
      evaluatePadStack();
    }
  })();
