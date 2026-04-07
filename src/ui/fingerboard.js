const STRINGS = [
  { index: 0, open: 55, label: "G3" },
  { index: 1, open: 62, label: "D4" },
  { index: 2, open: 69, label: "A4" },
  { index: 3, open: 76, label: "E5" },
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_IT = {
  C: "Do",
  "C#": "Do#",
  D: "Re",
  "D#": "Re#",
  E: "Mi",
  F: "Fa",
  "F#": "Fa#",
  G: "Sol",
  "G#": "Sol#",
  A: "La",
  "A#": "La#",
  B: "Si",
};
const SEMITONES_PER_STRING = 8;
const BASE_HEIGHT = 30;

const FINGERING_MAP = {
  "0-55": 0,
  "0-56": 1,
  "0-57": 1,
  "0-58": 2,
  "0-59": 2,
  "0-60": 3,
  "0-61": 3,
  "0-62": 4,
  "1-62": 0,
  "1-63": 1,
  "1-64": 1,
  "1-65": 2,
  "1-66": 2,
  "1-67": 3,
  "1-68": 3,
  "1-69": 4,
  "2-69": 0,
  "2-70": 1,
  "2-71": 1,
  "2-72": 2,
  "2-73": 2,
  "2-74": 3,
  "2-75": 3,
  "2-76": 4,
  "3-76": 0,
  "3-77": 1,
  "3-78": 1,
  "3-79": 2,
  "3-80": 2,
  "3-81": 3,
  "3-82": 3,
  "3-83": 4,
};

const TARGET_STRING_HINTS = {
  62: 0,
  69: 1,
  76: 2,
};

let mode = "free";
let notation = "international";
let fingeringVisible = false;
let root = null;
let body = null;
let toggle = null;

const fretsByMidi = new Map();
const allFrets = [];
let currentDetected = null;
let currentTarget = null;

function midiToLabel(midi) {
  const intlName = NOTE_NAMES[((midi % 12) + 12) % 12];
  const name = notation === "italian" ? NOTE_NAMES_IT[intlName] ?? intlName : intlName;
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function refreshFretLabels() {
  for (const fret of allFrets) {
    const midi = Number(fret.dataset.midi);
    const labelEl = fret.querySelector(".fret-label");
    if (labelEl) labelEl.textContent = midiToLabel(midi);
  }
}

function pickTrainerString(targetMidi) {
  if (TARGET_STRING_HINTS[targetMidi] !== undefined) return TARGET_STRING_HINTS[targetMidi];
  let best = null;
  for (const s of STRINGS) {
    const diff = targetMidi - s.open;
    if (diff >= 0 && diff < SEMITONES_PER_STRING) {
      best = s.index;
      break;
    }
  }
  return best;
}

function clearHighlights() {
  for (const fret of allFrets) {
    fret.classList.remove("is-target", "is-detected", "detected-green", "detected-yellow", "detected-red");
  }
}

function applyHighlights() {
  clearHighlights();
  if (currentTarget) {
    const targetFrets = fretsByMidi.get(currentTarget.midiNumber) || [];
    const targetString = mode === "trainer" ? pickTrainerString(currentTarget.midiNumber) : null;
    for (const fret of targetFrets) {
      if (targetString !== null && Number(fret.dataset.string) !== targetString) continue;
      fret.classList.add("is-target");
    }
  }

  if (!currentDetected) return;
  const detectedFrets = fretsByMidi.get(currentDetected.midiNumber) || [];
  if (!detectedFrets.length) return;

  let toneClass = "detected-red";
  const cents = Math.abs(currentDetected.centsOffset ?? 0);
  if (cents <= 15) toneClass = "detected-green";
  else if (cents <= 30) toneClass = "detected-yellow";

  const trainerString = mode === "trainer" && currentTarget ? pickTrainerString(currentTarget.midiNumber) : null;
  for (const fret of detectedFrets) {
    if (trainerString !== null && Number(fret.dataset.string) !== trainerString) continue;
    fret.classList.add("is-detected", toneClass);
  }
}

export function initFingerboard(containerEl) {
  root = containerEl;
  root.className = "fingerboard-sidebar is-open";
  root.innerHTML = `
    <button class="fingerboard-toggle" id="fingerboardToggle" aria-label="Mostra/Nascondi fingerboard">
      <span class="toggle-icon">›</span>
    </button>
    <div class="fingerboard-inner">
      <div class="fingerboard-title">Fingerboard</div>
      <div class="fingerboard-grid" id="fingerboardGrid"></div>
      <div class="fingerboard-legend hidden" id="fingerboardLegend">
        <span>• = vuoto</span><span>1 indice</span><span>2 medio</span><span>3 anulare</span><span>4 mignolo</span>
      </div>
    </div>
  `;

  toggle = root.querySelector("#fingerboardToggle");
  body = root.querySelector("#fingerboardGrid");

  toggle.addEventListener("click", () => {
    root.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(root.classList.contains("is-open")));
  });

  for (const s of STRINGS) {
    const col = document.createElement("div");
    col.className = "string-col";
    for (let i = 0; i < SEMITONES_PER_STRING; i += 1) {
      const midi = s.open + i;
      const fret = document.createElement("div");
      fret.className = "fret";
      if (i === 0) fret.classList.add("is-open-string");
      fret.dataset.midi = String(midi);
      fret.dataset.string = String(s.index);
      fret.dataset.finger = String(FINGERING_MAP[`${s.index}-${midi}`] ?? 0);
      fret.style.height = `${Math.max(14, BASE_HEIGHT * Math.pow(0.97, i))}px`;
      const label = document.createElement("span");
      label.className = "fret-label";
      label.textContent = midiToLabel(midi);
      fret.append(label);
      const badge = document.createElement("span");
      badge.className = "finger-badge";
      const finger = Number(fret.dataset.finger);
      badge.textContent = finger === 0 ? "•" : String(finger);
      fret.append(badge);
      col.append(fret);
      allFrets.push(fret);
      if (!fretsByMidi.has(midi)) fretsByMidi.set(midi, []);
      fretsByMidi.get(midi).push(fret);
    }
    body.append(col);
  }
}

export function updateFingerboard({ detectedNote, targetNote }) {
  currentDetected = detectedNote;
  currentTarget = targetNote;
  applyHighlights();
}

export function setFingerboardMode(nextMode) {
  mode = nextMode;
  applyHighlights();
}

export function setFingeringVisible(visible) {
  fingeringVisible = visible;
  if (!root) return;
  root.classList.toggle("show-fingering", fingeringVisible);
  root.querySelector("#fingerboardLegend")?.classList.toggle("hidden", !fingeringVisible);
}

export function setFingerboardNotation(nextNotation) {
  notation = nextNotation === "italian" ? "italian" : "international";
  refreshFretLabels();
}
