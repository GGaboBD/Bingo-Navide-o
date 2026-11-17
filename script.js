(() => {
  const STORAGE_KEY = "bingo_navideno_75_v1";
  const TOTAL_NUMBERS = 75;

  const MODES = {
    B: { label: "Ronda B · Números 1 al 15", min: 1, max: 15 },
    I: { label: "Ronda I · Números 16 al 30", min: 16, max: 30 },
    N: { label: "Ronda N · Números 31 al 45", min: 31, max: 45 },
    G: { label: "Ronda G · Números 46 al 60", min: 46, max: 60 },
    O: { label: "Ronda O · Números 61 al 75", min: 61, max: 75 },
    BINGO: { label: "Ronda BINGO · Todos los números (1 al 75)", min: 1, max: 75 },
  };

  const LETTER_ORDER = ["B", "I", "N", "G", "O"];

  const letterTabs = document.getElementById("letterTabs");
  const numbersContainer = document.getElementById("numbersContainer");
  const numberForm = document.getElementById("numberForm");
  const numberInput = document.getElementById("numberInput");
  const inputFeedback = document.getElementById("inputFeedback");
  const giantComboEl = document.getElementById("giantCombo");
  const giantLetterEl = document.getElementById("giantLetter");
  const giantNumberEl = document.getElementById("giantNumber");
  const emptyStateEl = document.getElementById("emptyState");
  const calledCountEl = document.getElementById("calledCount");
  const modeBadgeEl = document.getElementById("modeBadge");
  const modeCountEl = document.getElementById("modeCount");
  const recentListEl = document.getElementById("recentList");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const tombolaBtn = document.getElementById("tombolaBtn");

  /** @type {Map<number, HTMLButtonElement>} */
  let buttonMap = new Map();
  let rollTimer = null;

  let state = {
    mode: "B",
    activeNumber: null,
    calledNumbers: [],
    history: [],
  };

  function getLetterForNumber(num) {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "";
  }

  function isMarked(num) {
    return state.activeNumber === num || state.calledNumbers.includes(num);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        MODES[parsed.mode] &&
        (parsed.activeNumber === null ||
          (Number.isInteger(parsed.activeNumber) &&
            parsed.activeNumber >= 1 &&
            parsed.activeNumber <= TOTAL_NUMBERS)) &&
        Array.isArray(parsed.calledNumbers) &&
        Array.isArray(parsed.history)
      ) {
        state = parsed;
      }
    } catch {
      // Iniciar limpio si hay error de lectura
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignorar errores de almacenamiento
    }
  }

  function createNumberButton(num) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "num-btn";
    btn.textContent = String(num);
    btn.dataset.number = String(num);
    btn.setAttribute("aria-label", `${getLetterForNumber(num)} ${num}`);
    btn.addEventListener("click", () => selectNumber(num));
    buttonMap.set(num, btn);
    return btn;
  }

  function buildBoardForMode() {
    buttonMap = new Map();
    numbersContainer.innerHTML = "";

    if (state.mode === "BINGO") {
      const rowsWrap = document.createElement("div");
      rowsWrap.className = "bingo-rows";

      for (const letter of LETTER_ORDER) {
        const { min, max } = MODES[letter];
        const row = document.createElement("div");
        row.className = "bingo-row";

        const label = document.createElement("span");
        label.className = "bingo-row-label";
        label.textContent = letter;
        row.appendChild(label);

        for (let i = min; i <= max; i++) {
          row.appendChild(createNumberButton(i));
        }
        rowsWrap.appendChild(row);
      }

      numbersContainer.appendChild(rowsWrap);
    } else {
      const { min, max } = MODES[state.mode];
      const grid = document.createElement("div");
      grid.className = "numbers-grid-single";

      for (let i = min; i <= max; i++) {
        grid.appendChild(createNumberButton(i));
      }

      numbersContainer.appendChild(grid);
    }
  }

  function cancelRoll() {
    if (rollTimer !== null) {
      clearInterval(rollTimer);
      rollTimer = null;
    }
  }

  function getAvailableNumbersForCurrentMode() {
    const { min, max } = MODES[state.mode];
    const available = [];
    for (let i = min; i <= max; i++) {
      if (!isMarked(i)) {
        available.push(i);
      }
    }
    return available;
  }

  function spinTombola() {
    if (rollTimer !== null) return;

    const available = getAvailableNumbersForCurrentMode();
    if (available.length === 0) {
      inputFeedback.textContent =
        state.mode === "BINGO"
          ? "Ya salieron todos los 75 números."
          : `Ya salieron todos los números de la letra ${state.mode}.`;
      return;
    }

    clearFeedback();
    clearMatchHighlight();

    const chosen = available[Math.floor(Math.random() * available.length)];
    if (available.length === 1) {
      selectNumber(chosen);
      return;
    }

    tombolaBtn.disabled = true;
    emptyStateEl.classList.add("hidden");
    giantComboEl.classList.remove("hidden");

    let ticks = 0;
    const totalTicks = 6;

    rollTimer = setInterval(() => {
      ticks++;
      if (ticks < totalTicks) {
        const previewNum = available[Math.floor(Math.random() * available.length)];
        giantLetterEl.textContent = getLetterForNumber(previewNum);
        giantNumberEl.textContent = String(previewNum);
      } else {
        cancelRoll();
        selectNumber(chosen);
      }
    }, 65);
  }

  function setMode(mode) {
    if (!MODES[mode] || state.mode === mode) return;
    cancelRoll();
    state.mode = mode;
    clearFeedback();
    clearMatchHighlight();
    numberInput.value = "";
    saveState();
    buildBoardForMode();
    render(false);
  }

  function selectNumber(num) {
    if (num < 1 || num > TOTAL_NUMBERS) return;

    // Bloquear si ya fue marcado anteriormente o está actualmente en pantalla
    if (isMarked(num)) {
      const letter = getLetterForNumber(num);
      inputFeedback.textContent = `El número ${letter}-${num} ya fue marcado y no se puede volver a seleccionar.`;
      return;
    }

    clearFeedback();
    clearMatchHighlight();

    // El número anterior pasa a estar en gris
    if (state.activeNumber !== null && !state.calledNumbers.includes(state.activeNumber)) {
      state.calledNumbers.push(state.activeNumber);
    }

    state.activeNumber = num;
    state.history.push(num);

    saveState();
    render(true);
  }

  function undoLast() {
    cancelRoll();
    if (state.history.length === 0) return;

    state.history.pop();
    const newActive = state.history.length > 0 ? state.history[state.history.length - 1] : null;

    const seen = new Set();
    for (let i = 0; i < state.history.length - 1; i++) {
      seen.add(state.history[i]);
    }
    if (newActive !== null) {
      seen.delete(newActive);
    }

    state.activeNumber = newActive;
    state.calledNumbers = Array.from(seen);

    clearFeedback();
    saveState();
    render(true);
  }

  function resetBoard() {
    cancelRoll();
    if (state.activeNumber === null && state.calledNumbers.length === 0) return;
    const confirmed = window.confirm("¿Seguro que deseas reiniciar todo el tablero de Bingo?");
    if (!confirmed) return;

    state.activeNumber = null;
    state.calledNumbers = [];
    state.history = [];
    clearFeedback();
    clearMatchHighlight();
    numberInput.value = "";
    saveState();
    render(false);
    numberInput.focus();
  }

  function render(animateGiant = false) {
    const calledSet = new Set(state.calledNumbers);
    const modeInfo = MODES[state.mode];

    // Actualizar pestañas de letras
    const tabBtns = letterTabs.querySelectorAll(".letter-tab");
    tabBtns.forEach((tab) => {
      tab.classList.toggle("is-selected", tab.dataset.mode === state.mode);
    });

    // Actualizar input según la modalidad activa
    numberInput.min = String(modeInfo.min);
    numberInput.max = String(modeInfo.max);
    numberInput.placeholder = `Escribe un número (${modeInfo.min} - ${modeInfo.max}) y pulsa Enter...`;

    // Actualizar botones visibles y contar marcados en la vista actual
    let modeMarkedCount = 0;
    const modeTotal = modeInfo.max - modeInfo.min + 1;

    for (const [num, btn] of buttonMap.entries()) {
      btn.classList.remove("is-active", "is-called");
      if (num === state.activeNumber) {
        btn.classList.add("is-active");
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
        modeMarkedCount++;
      } else if (calledSet.has(num)) {
        btn.classList.add("is-called");
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
        modeMarkedCount++;
      } else {
        btn.disabled = false;
        btn.setAttribute("aria-pressed", "false");
      }
    }

    modeBadgeEl.textContent = modeInfo.label;
    modeCountEl.textContent = `${modeMarkedCount} / ${modeTotal}`;

    // Contador global de los 75 números
    const totalOut = calledSet.size + (state.activeNumber !== null ? 1 : 0);
    calledCountEl.textContent = String(totalOut);

    // Número gigante en la mitad derecha
    if (state.activeNumber === null) {
      emptyStateEl.classList.remove("hidden");
      giantComboEl.classList.add("hidden");
      giantLetterEl.textContent = "";
      giantNumberEl.textContent = "";
    } else {
      const activeLetter = getLetterForNumber(state.activeNumber);
      emptyStateEl.classList.add("hidden");
      giantComboEl.classList.remove("hidden");
      giantLetterEl.textContent = activeLetter;
      giantNumberEl.textContent = String(state.activeNumber);

      if (animateGiant) {
        giantComboEl.classList.remove("pop-in");
        void giantComboEl.offsetWidth;
        giantComboEl.classList.add("pop-in");
      }
    }

    // Últimos 6 números anteriores
    const previousOnes = state.history.slice(0, -1).reverse().slice(0, 6);
    recentListEl.innerHTML = "";
    if (previousOnes.length === 0) {
      const span = document.createElement("span");
      span.className = "recent-empty";
      span.textContent = "Ninguno todavía";
      recentListEl.appendChild(span);
    } else {
      for (const n of previousOnes) {
        const chip = document.createElement("span");
        chip.className = "recent-chip";
        chip.textContent = `${getLetterForNumber(n)}-${n}`;
        recentListEl.appendChild(chip);
      }
    }

    undoBtn.disabled = state.history.length === 0;
    tombolaBtn.disabled = rollTimer !== null || getAvailableNumbersForCurrentMode().length === 0;
  }

  function clearFeedback() {
    inputFeedback.textContent = "";
  }

  function clearMatchHighlight() {
    for (const btn of buttonMap.values()) {
      btn.classList.remove("is-match");
    }
  }

  // Cambio de pestaña de letra
  letterTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".letter-tab");
    if (!tab) return;
    setMode(tab.dataset.mode);
  });

  // Resaltar botón disponible mientras se escribe
  numberInput.addEventListener("input", () => {
    clearFeedback();
    clearMatchHighlight();

    const val = numberInput.value.trim();
    if (!val) return;

    const num = Number(val);
    if (Number.isInteger(num) && num >= 1 && num <= TOTAL_NUMBERS) {
      const btn = buttonMap.get(num);
      if (btn && !btn.disabled) {
        btn.classList.add("is-match");
      }
    }
  });

  // Enviar número por buscador
  numberForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = numberInput.value.trim();
    const num = Number(raw);

    if (!raw || !Number.isInteger(num) || num < 1 || num > TOTAL_NUMBERS) {
      inputFeedback.textContent = "Ingresa un número válido del 1 al 75.";
      numberInput.focus();
      return;
    }

    const modeInfo = MODES[state.mode];
    if (state.mode !== "BINGO" && (num < modeInfo.min || num > modeInfo.max)) {
      const targetLetter = getLetterForNumber(num);
      inputFeedback.textContent = `El número ${num} pertenece a la letra ${targetLetter} (cambia a ${targetLetter} o BINGO).`;
      numberInput.focus();
      return;
    }

    if (isMarked(num)) {
      const letter = getLetterForNumber(num);
      inputFeedback.textContent = `El número ${letter}-${num} ya fue marcado anteriormente.`;
      numberInput.select();
      return;
    }

    selectNumber(num);
    numberInput.value = "";
    numberInput.focus();
  });

  tombolaBtn.addEventListener("click", spinTombola);
  undoBtn.addEventListener("click", undoLast);
  resetBtn.addEventListener("click", resetBoard);

  // Inicialización
  loadState();
  buildBoardForMode();
  render(false);
})();
