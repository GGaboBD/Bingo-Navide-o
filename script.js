(() => {
  const STORAGE_KEY = "bingo_navideno_v2";
  const TOTAL_NUMBERS = 75;

  const RANGES = {
    B: { min: 1, max: 15 },
    I: { min: 16, max: 30 },
    N: { min: 31, max: 45 },
    G: { min: 46, max: 60 },
    O: { min: 61, max: 75 },
  };

  const LETTER_ORDER = ["B", "I", "N", "G", "O"];

  const PATTERNS = {
    X: {
      id: "X",
      name: "Letra X",
      hint: "Ambas diagonales completas",
      match: (r, c) => r === c || r + c === 4,
    },
    L: {
      id: "L",
      name: "Letra L",
      hint: "Columna B y fila inferior completas",
      match: (r, c) => c === 0 || r === 4,
    },
    H: {
      id: "H",
      name: "Letra H",
      hint: "Columnas B y O unidas por la fila central",
      match: (r, c) => c === 0 || c === 4 || r === 2,
    },
    Z: {
      id: "Z",
      name: "Letra Z",
      hint: "Fila superior, diagonal inversa y fila inferior",
      match: (r, c) => r === 0 || r === 4 || r + c === 4,
    },
    FRAME: {
      id: "FRAME",
      name: "Marco grande",
      hint: "Todo el borde exterior del cartón",
      match: (r, c) => r === 0 || r === 4 || c === 0 || c === 4,
    },
  };

  const PATTERN_KEYS = Object.keys(PATTERNS);

  const numbersContainer = document.getElementById("numbersContainer");
  const numberForm = document.getElementById("numberForm");
  const numberInput = document.getElementById("numberInput");
  const inputFeedback = document.getElementById("inputFeedback");
  const giantComboEl = document.getElementById("giantCombo");
  const giantLetterEl = document.getElementById("giantLetter");
  const giantNumberEl = document.getElementById("giantNumber");
  const emptyStateEl = document.getElementById("emptyState");
  const calledCountEl = document.getElementById("calledCount");
  const remainingCountEl = document.getElementById("remainingCount");
  const recentListEl = document.getElementById("recentList");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const tombolaBtn = document.getElementById("tombolaBtn");
  const drawPatternBtn = document.getElementById("drawPatternBtn");

  const patternCard = document.getElementById("patternCard");
  const patternNameEl = document.getElementById("patternName");
  const patternHintEl = document.getElementById("patternHint");
  const patternSelector = document.getElementById("patternSelector");
  const patternGrid = document.getElementById("patternGrid");

  /** @type {Map<number, HTMLButtonElement>} */
  const buttonMap = new Map();
  /** @type {{ el: HTMLDivElement, r: number, c: number }[]} */
  const patternCells = [];

  let rollTimer = null;
  let patternDrawTimer = null;

  let state = {
    activeNumber: null,
    calledNumbers: [],
    history: [],
    activePattern: "X",
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
        (parsed.activeNumber === null ||
          (Number.isInteger(parsed.activeNumber) &&
            parsed.activeNumber >= 1 &&
            parsed.activeNumber <= TOTAL_NUMBERS)) &&
        Array.isArray(parsed.calledNumbers) &&
        Array.isArray(parsed.history)
      ) {
        state.activeNumber = parsed.activeNumber;
        state.calledNumbers = parsed.calledNumbers;
        state.history = parsed.history;
        if (parsed.activePattern && PATTERNS[parsed.activePattern]) {
          state.activePattern = parsed.activePattern;
        }
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

  function buildUnifiedBoard() {
    buttonMap.clear();
    numbersContainer.innerHTML = "";

    const rowsWrap = document.createElement("div");
    rowsWrap.className = "bingo-rows";

    for (const letter of LETTER_ORDER) {
      const { min, max } = RANGES[letter];
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
  }

  function buildPatternGrid() {
    patternGrid.innerHTML = "";
    patternCells.length = 0;

    for (const letter of LETTER_ORDER) {
      const headerCell = document.createElement("div");
      headerCell.className = "card-col-header";
      headerCell.textContent = letter;
      patternGrid.appendChild(headerCell);
    }

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "pattern-cell";
        if (r === 2 && c === 2) {
          cell.classList.add("is-free");
          cell.textContent = "★";
          cell.setAttribute("title", "Espacio libre (comodín)");
        }
        patternGrid.appendChild(cell);
        patternCells.push({ el: cell, r, c });
      }
    }
  }

  function renderPatternPreview(patternId) {
    const pattern = PATTERNS[patternId] || PATTERNS.X;
    patternNameEl.textContent = pattern.name;
    patternHintEl.textContent = pattern.hint;

    for (const cell of patternCells) {
      cell.el.classList.toggle("is-lit", pattern.match(cell.r, cell.c));
    }

    const pills = patternSelector.querySelectorAll(".pattern-pill");
    pills.forEach((pill) => {
      pill.classList.toggle("is-selected", pill.dataset.pattern === pattern.id);
    });
  }

  function cancelRoll() {
    if (rollTimer !== null) {
      clearInterval(rollTimer);
      rollTimer = null;
    }
  }

  function cancelPatternDraw() {
    if (patternDrawTimer !== null) {
      clearInterval(patternDrawTimer);
      patternDrawTimer = null;
    }
    patternCard.classList.remove("is-drawing");
    drawPatternBtn.disabled = false;
  }

  function getAvailableNumbers() {
    const available = [];
    for (let i = 1; i <= TOTAL_NUMBERS; i++) {
      if (!isMarked(i)) {
        available.push(i);
      }
    }
    return available;
  }

  function spinTombola() {
    if (rollTimer !== null) return;

    const available = getAvailableNumbers();
    if (available.length === 0) {
      inputFeedback.textContent = "Ya salieron todos los 75 números.";
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

  function drawRandomPattern() {
    if (patternDrawTimer !== null) return;

    const chosenKey = PATTERN_KEYS[Math.floor(Math.random() * PATTERN_KEYS.length)];
    drawPatternBtn.disabled = true;
    patternCard.classList.add("is-drawing");

    let step = 0;
    const totalSteps = 10;
    let lastPreviewIdx = PATTERN_KEYS.indexOf(state.activePattern);

    patternDrawTimer = setInterval(() => {
      step++;
      if (step < totalSteps) {
        lastPreviewIdx = (lastPreviewIdx + 1) % PATTERN_KEYS.length;
        renderPatternPreview(PATTERN_KEYS[lastPreviewIdx]);
      } else {
        cancelPatternDraw();
        selectPattern(chosenKey);
      }
    }, 75);
  }

  function selectPattern(patternId) {
    if (!PATTERNS[patternId]) return;
    cancelPatternDraw();
    state.activePattern = patternId;
    saveState();
    renderPatternPreview(patternId);
  }

  function selectNumber(num) {
    if (num < 1 || num > TOTAL_NUMBERS) return;

    if (isMarked(num)) {
      const letter = getLetterForNumber(num);
      inputFeedback.textContent = `El número ${letter}-${num} ya fue marcado y no se puede volver a seleccionar.`;
      return;
    }

    clearFeedback();
    clearMatchHighlight();

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
    const confirmed = window.confirm("¿Seguro que deseas reiniciar los números cantados del tablero?");
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

    for (const [num, btn] of buttonMap.entries()) {
      btn.classList.remove("is-active", "is-called");
      if (num === state.activeNumber) {
        btn.classList.add("is-active");
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
      } else if (calledSet.has(num)) {
        btn.classList.add("is-called");
        btn.disabled = true;
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.disabled = false;
        btn.setAttribute("aria-pressed", "false");
      }
    }

    const totalOut = calledSet.size + (state.activeNumber !== null ? 1 : 0);
    const remaining = TOTAL_NUMBERS - totalOut;
    calledCountEl.textContent = String(totalOut);
    remainingCountEl.textContent = `${remaining} ${remaining === 1 ? "disponible" : "disponibles"}`;

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
        chip.textContent = `${getLetterForNumber(n)} - ${n}`;
        recentListEl.appendChild(chip);
      }
    }

    undoBtn.disabled = state.history.length === 0;
    tombolaBtn.disabled = rollTimer !== null || remaining === 0;

    renderPatternPreview(state.activePattern);
  }

  function clearFeedback() {
    inputFeedback.textContent = "";
  }

  function clearMatchHighlight() {
    for (const btn of buttonMap.values()) {
      btn.classList.remove("is-match");
    }
  }

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

  numberForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = numberInput.value.trim();
    const num = Number(raw);

    if (!raw || !Number.isInteger(num) || num < 1 || num > TOTAL_NUMBERS) {
      inputFeedback.textContent = "Ingresa un número válido del 1 al 75.";
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

  patternSelector.addEventListener("click", (e) => {
    const pill = e.target.closest(".pattern-pill");
    if (!pill) return;
    selectPattern(pill.dataset.pattern);
  });

  tombolaBtn.addEventListener("click", spinTombola);
  drawPatternBtn.addEventListener("click", drawRandomPattern);
  undoBtn.addEventListener("click", undoLast);
  resetBtn.addEventListener("click", resetBoard);

  // Inicialización
  loadState();
  buildUnifiedBoard();
  buildPatternGrid();
  render(false);
})();
