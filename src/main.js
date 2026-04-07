import "./styles/main.css";
import { setupDeviceManager } from "./audio/device-manager.js";
import { createPitchEngine } from "./audio/pitch-engine.js";
import {
  createPitchSmoother,
  formatNoteName,
  getMidiFromNoteName,
  hzToNote,
  isValidDetection,
  noteLabelFromMidi,
} from "./music/note-utils.js";
import {
  holdMsForQuarterBeats,
  normalizeTrainerHoldQuarterBeats,
  TRAINER_BPM,
  TRAINER_HOLD_OPTIONS,
  TRAINER_TIME_SIGNATURE,
} from "./music/trainer-timing.js";
import { createTrainerMode } from "./ui/trainer-mode.js";
import {
  initFingerboard,
  setFingerboardMode,
  setFingeringVisible,
  setFingerboardNotation,
  updateFingerboard,
} from "./ui/fingerboard.js";
import { createTunerDisplay } from "./ui/tuner-display.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="app-shell idle" id="appShell">
    <header class="app-header">
      <div class="brand">Violin Pitch Tutor</div>
      <div class="controls">
        <label class="control">
          <span>Input</span>
          <select id="deviceSelect"></select>
        </label>
        <button id="connectButton">Connect</button>
        <button id="settingsButton" class="secondary">Impostazioni</button>
      </div>
    </header>
    <div id="settingsModal" class="modal hidden">
      <div id="settingsBackdrop" class="modal-backdrop"></div>
      <section class="modal-panel">
        <header class="modal-head">
          <h2>Impostazioni</h2>
          <button id="closeSettingsButton" class="secondary">Chiudi</button>
        </header>
        <div class="modal-body">
          <label class="mode-toggle">
            <span>Free</span>
            <input id="modeToggle" class="switch-input" type="checkbox" />
            <span>Trainer</span>
          </label>
          <label class="mode-toggle">
            <span>INT</span>
            <input id="notationToggle" class="switch-input" type="checkbox" />
            <span>ITA</span>
          </label>
          <label class="control compact">
            <span>A4</span>
            <input id="a4Input" type="number" min="430" max="450" step="0.5" value="440" />
          </label>
          <label class="control compact">
            <span>Calib ¢</span>
            <input id="calibrationInput" type="number" min="-20" max="20" step="0.1" value="0" />
          </label>
          <label class="control">
            <span>Scala trainer</span>
            <select id="trainerScaleSelect">
              <option value="g">Sol maggiore</option>
              <option value="d">Re maggiore</option>
              <option value="a">La maggiore</option>
            </select>
          </label>
          <label class="mode-toggle">
            <span>Asc</span>
            <input id="trainerDirectionToggle" class="switch-input" type="checkbox" />
            <span>Andata+Ritorno</span>
          </label>
          <label class="control">
            <span>Tenuta (4/4, ${TRAINER_BPM} BPM)</span>
            <select id="trainerHoldSelect">
              <option value="1">1/4 (1 tempo)</option>
              <option value="2">2/4 (2 tempi)</option>
              <option value="4">4/4 (4 tempi)</option>
            </select>
          </label>
        </div>
      </section>
    </div>
    <section class="trainer-panel hidden" id="trainerPanel">
      <div class="trainer-target-wrap">
        <div class="target-label">Target</div>
        <div class="target-note" id="targetNote">E4</div>
      </div>
      <div class="progress-ring-wrap">
        <svg class="progress-ring" width="60" height="60" viewBox="0 0 60 60">
          <circle class="progress-track" cx="30" cy="30" r="24"></circle>
          <circle class="progress-value" id="progressValue" cx="30" cy="30" r="24"></circle>
        </svg>
      </div>
      <div class="trainer-timing-label" id="trainerTimingLabel"></div>
      <ul class="trainer-queue" id="trainerQueue"></ul>
    </section>
    <section class="main-display" id="mainDisplay">
      <div class="note-label" id="noteLabel">--</div>
      <div class="freq-label" id="freqLabel">-- Hz</div>
      <div class="cents-wrap">
        <div class="cents-scale">
          <div class="center-line"></div>
          <div class="zone zone-safe"></div>
          <div class="zone zone-mid left"></div>
          <div class="zone zone-mid right"></div>
          <div class="zone zone-danger left"></div>
          <div class="zone zone-danger right"></div>
          <div class="pointer" id="centsPointer"></div>
        </div>
        <div class="cents-note-edges">
          <span id="leftEdgeNote">--</span>
          <span id="rightEdgeNote">--</span>
        </div>
        <div class="cents-values"><span>-50</span><span>0</span><span>+50</span></div>
      </div>
      <div class="confidence-row" id="confidenceRow">
        <div class="confidence-fill" id="confidenceFill"></div>
      </div>
    </section>
    <footer class="status" id="statusLine">Seleziona il dispositivo e premi Connect.</footer>
  </main>
`;

const ui = createTunerDisplay({
  appShell: document.querySelector("#appShell"),
  noteLabel: document.querySelector("#noteLabel"),
  freqLabel: document.querySelector("#freqLabel"),
  centsPointer: document.querySelector("#centsPointer"),
  confidenceRow: document.querySelector("#confidenceRow"),
  confidenceFill: document.querySelector("#confidenceFill"),
  leftEdgeNote: document.querySelector("#leftEdgeNote"),
  rightEdgeNote: document.querySelector("#rightEdgeNote"),
  trainerPanel: document.querySelector("#trainerPanel"),
  targetNote: document.querySelector("#targetNote"),
  progressValue: document.querySelector("#progressValue"),
  trainerTimingLabel: document.querySelector("#trainerTimingLabel"),
  trainerQueue: document.querySelector("#trainerQueue"),
  statusLine: document.querySelector("#statusLine"),
});

const TRAINER_SCALES = {
  g: ["G3", "A3", "B3", "C4", "D4", "E4", "F#4", "G4"],
  d: ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"],
  a: ["A4", "B4", "C#5", "D5", "E5", "F#5", "G#5", "A5"],
};

const smoother = createPitchSmoother({
  medianWindow: 5,
  centsAlpha: 0.3,
});

const modeToggle = document.querySelector("#modeToggle");
const notationToggle = document.querySelector("#notationToggle");
const a4Input = document.querySelector("#a4Input");
const calibrationInput = document.querySelector("#calibrationInput");
const trainerScaleSelect = document.querySelector("#trainerScaleSelect");
const connectButton = document.querySelector("#connectButton");
const settingsButton = document.querySelector("#settingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsModal = document.querySelector("#settingsModal");
const settingsBackdrop = document.querySelector("#settingsBackdrop");
const trainerDirectionToggle = document.querySelector("#trainerDirectionToggle");
const trainerHoldSelect = document.querySelector("#trainerHoldSelect");

let mode = "free";
let notation = localStorage.getItem("violinTutor.notation") ?? "italian";
let referenceHz = Number(localStorage.getItem("violinTutor.a4") ?? 440);
let calibrationCents = Number(localStorage.getItem("violinTutor.calibrationCents") ?? 0);
let trainerScale = localStorage.getItem("violinTutor.trainerScale") ?? "g";
let trainerDirection = localStorage.getItem("violinTutor.trainerDirection") ?? "asc";
let trainerHoldQuarterBeats = normalizeTrainerHoldQuarterBeats(
  localStorage.getItem("violinTutor.trainerHoldQuarterBeats")
);
let engine = null;

function buildTrainerSequence(scaleKey, direction) {
  const asc = (TRAINER_SCALES[scaleKey] || TRAINER_SCALES.g).map(getMidiFromNoteName);
  if (direction === "updown") {
    return [...asc, ...asc.slice(0, -1).reverse()];
  }
  return asc;
}

function recreateTrainer() {
  trainer = createTrainerMode({
    sequence: buildTrainerSequence(trainerScale, trainerDirection),
    toleranceCents: 15,
    holdMs: holdMsForQuarterBeats(trainerHoldQuarterBeats),
  });
}

let trainer;
recreateTrainer();

notationToggle.checked = notation === "italian";
a4Input.value = String(referenceHz);
calibrationInput.value = String(calibrationCents);
modeToggle.checked = mode === "trainer";
trainerScaleSelect.value = trainerScale;
trainerDirectionToggle.checked = trainerDirection === "updown";
trainerHoldSelect.value = String(trainerHoldQuarterBeats);
syncTrainerTimingLabel();

function openSettings() {
  settingsModal.classList.remove("hidden");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
}

settingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);

const fingerboardContainer = document.querySelector("#fingerboard-sidebar");
initFingerboard(fingerboardContainer);
setFingerboardMode(mode);
setFingerboardNotation(notation);
setFingeringVisible(mode === "trainer");

function midiToUiLabel(midiNumber) {
  const note = noteLabelFromMidi(midiNumber);
  return `${formatNoteName(note.name, notation)}${note.octave}`;
}

function rebuildTrainer(scaleKey) {
  trainerScale = scaleKey;
  localStorage.setItem("violinTutor.trainerScale", trainerScale);
  recreateTrainer();
}

function syncTrainerTimingLabel() {
  const opt = TRAINER_HOLD_OPTIONS.find((o) => o.beats === trainerHoldQuarterBeats);
  ui.setTrainerTimingLabel(`${opt?.label ?? "1/4 (1 tempo)"} · ${TRAINER_BPM} BPM (${TRAINER_TIME_SIGNATURE})`);
}

function syncTrainerTargetUi() {
  const targetMidi = trainer.getCurrentTarget();
  const trainerState = trainer.getState();
  const trainerQueue = trainerState.sequence.map((midi, index) => ({
    label: midiToUiLabel(midi),
    isCurrent: index === trainerState.currentIndex,
  }));
  ui.setTarget({
    label: midiToUiLabel(targetMidi),
    progress: 0,
  });
  ui.setTrainerQueue(trainerQueue);
  ui.setScaleEdgeLabels({
    leftLabel: midiToUiLabel(targetMidi - 1),
    rightLabel: midiToUiLabel(targetMidi + 1),
  });
}

modeToggle.addEventListener("change", () => {
  mode = modeToggle.checked ? "trainer" : "free";
  ui.setTrainerVisible(mode === "trainer");
  setFingerboardMode(mode);
  setFingeringVisible(mode === "trainer");
  if (mode === "trainer") {
    syncTrainerTargetUi();
    const targetMidi = trainer.getCurrentTarget();
    const target = noteLabelFromMidi(targetMidi);
    updateFingerboard({
      detectedNote: null,
      targetNote: { ...target, midiNumber: targetMidi },
    });
  } else {
    updateFingerboard({ detectedNote: null, targetNote: null });
  }
  ui.setStatus(mode === "trainer" ? "Modalita trainer attiva." : "Modalita free tuner attiva.");
});

notationToggle.addEventListener("change", () => {
  notation = notationToggle.checked ? "italian" : "international";
  localStorage.setItem("violinTutor.notation", notation);
  setFingerboardNotation(notation);
  if (mode === "trainer") {
    syncTrainerTargetUi();
    const targetMidi = trainer.getCurrentTarget();
    const target = noteLabelFromMidi(targetMidi);
    updateFingerboard({
      detectedNote: null,
      targetNote: { ...target, midiNumber: targetMidi },
    });
  }
  ui.setStatus(
    notation === "italian" ? "Notazione italiana attiva (Do Re Mi)." : "Notazione internazionale attiva."
  );
});

a4Input.addEventListener("change", () => {
  const value = Number(a4Input.value);
  if (!Number.isFinite(value)) return;
  referenceHz = Math.max(430, Math.min(450, value));
  a4Input.value = String(referenceHz);
  localStorage.setItem("violinTutor.a4", String(referenceHz));
  ui.setStatus(`Calibrazione A4 impostata a ${referenceHz} Hz.`);
});

calibrationInput.addEventListener("change", () => {
  const value = Number(calibrationInput.value);
  if (!Number.isFinite(value)) return;
  calibrationCents = Math.max(-20, Math.min(20, value));
  calibrationInput.value = String(calibrationCents);
  localStorage.setItem("violinTutor.calibrationCents", String(calibrationCents));
  ui.setStatus(`Offset calibrazione impostato a ${calibrationCents.toFixed(1)} cents.`);
});

trainerScaleSelect.addEventListener("change", () => {
  rebuildTrainer(trainerScaleSelect.value);
  if (mode === "trainer") {
    syncTrainerTargetUi();
    const targetMidi = trainer.getCurrentTarget();
    const target = noteLabelFromMidi(targetMidi);
    updateFingerboard({
      detectedNote: null,
      targetNote: { ...target, midiNumber: targetMidi },
    });
  }
  ui.setStatus(`Scala trainer impostata su ${trainerScaleSelect.options[trainerScaleSelect.selectedIndex].text}.`);
});

trainerDirectionToggle.addEventListener("change", () => {
  trainerDirection = trainerDirectionToggle.checked ? "updown" : "asc";
  localStorage.setItem("violinTutor.trainerDirection", trainerDirection);
  rebuildTrainer(trainerScaleSelect.value);
  if (mode === "trainer") {
    syncTrainerTargetUi();
    const targetMidi = trainer.getCurrentTarget();
    const target = noteLabelFromMidi(targetMidi);
    updateFingerboard({
      detectedNote: null,
      targetNote: { ...target, midiNumber: targetMidi },
    });
  }
  ui.setStatus(
    trainerDirection === "updown"
      ? "Trainer in modalita andata+ritorno."
      : "Trainer in modalita ascendente."
  );
});

trainerHoldSelect.addEventListener("change", () => {
  trainerHoldQuarterBeats = normalizeTrainerHoldQuarterBeats(trainerHoldSelect.value);
  localStorage.setItem("violinTutor.trainerHoldQuarterBeats", String(trainerHoldQuarterBeats));
  recreateTrainer();
  syncTrainerTimingLabel();
  if (mode === "trainer") {
    syncTrainerTargetUi();
    const targetMidi = trainer.getCurrentTarget();
    const target = noteLabelFromMidi(targetMidi);
    updateFingerboard({
      detectedNote: null,
      targetNote: { ...target, midiNumber: targetMidi },
    });
  }
  const opt = TRAINER_HOLD_OPTIONS.find((o) => o.beats === trainerHoldQuarterBeats);
  ui.setStatus(
    `Tenuta ${opt?.label ?? ""} · ${TRAINER_BPM} BPM (${TRAINER_TIME_SIGNATURE}).`
  );
});

const devices = await setupDeviceManager({
  deviceSelect: document.querySelector("#deviceSelect"),
});

if (mode === "trainer") {
  syncTrainerTargetUi();
  const targetMidi = trainer.getCurrentTarget();
  const target = noteLabelFromMidi(targetMidi);
  updateFingerboard({
    detectedNote: null,
    targetNote: { ...target, midiNumber: targetMidi },
  });
} else {
  updateFingerboard({ detectedNote: null, targetNote: null });
}

connectButton.addEventListener("click", async () => {
  try {
    const selectedDeviceId = devices.getSelectedDeviceId();
    const selectedDeviceLabel = devices.getSelectedDeviceLabel();
    connectButton.disabled = true;
    if (engine) {
      engine.destroy();
    }
    engine = await createPitchEngine({
      selectedDeviceId,
      selectedDeviceLabel,
      onStatus: (message) => ui.setStatus(message),
      onError: (message) => ui.setStatus(message),
      onPitch: ({ frequency, confidence }) => {
        const valid = isValidDetection({ frequency, confidence });
        if (!valid) {
          trainer.resetHold();
          ui.setIdle();
          if (mode === "trainer") {
            const targetMidi = trainer.getCurrentTarget();
            const target = noteLabelFromMidi(targetMidi);
            updateFingerboard({
              detectedNote: null,
              targetNote: { ...target, midiNumber: targetMidi },
            });
          } else {
            updateFingerboard({ detectedNote: null, targetNote: null });
          }
          return;
        }

        const note = hzToNote(frequency, { referenceHz, calibrationCents });
        if (!note) {
          trainer.resetHold();
          ui.setIdle();
          return;
        }

        const smoothed = smoother.push(note.midiNumber, note.centsOffset);
        const stableLabel = noteLabelFromMidi(smoothed.midiNumber);
        const current = {
          ...note,
          name: stableLabel.name,
          octave: stableLabel.octave,
          midiNumber: smoothed.midiNumber,
          centsOffset: smoothed.centsOffset,
        };
        const currentLabel = `${formatNoteName(current.name, notation)}${current.octave}`;

        if (mode === "trainer") {
          const expectedMidi = trainer.getCurrentTarget();
          const expectedTarget = noteLabelFromMidi(expectedMidi);
          ui.setScaleEdgeLabels({
            leftLabel: midiToUiLabel(expectedMidi - 1),
            rightLabel: midiToUiLabel(expectedMidi + 1),
          });
          const againstTarget = current.midiNumber === expectedMidi;
          const targetCents = againstTarget ? current.centsOffset : current.midiNumber < expectedMidi ? -50 : 50;
          const result = trainer.update({
            isOnTargetNote: againstTarget,
            centsOffset: targetCents,
          });
          const targetMidi = trainer.getCurrentTarget();
          const targetLabel = noteLabelFromMidi(targetMidi);
          const targetLabelText = `${formatNoteName(targetLabel.name, notation)}${targetLabel.octave}`;
          const trainerState = trainer.getState();
          ui.setTrainerQueue(
            trainerState.sequence.map((midi, index) => ({
              label: midiToUiLabel(midi),
              isCurrent: index === trainerState.currentIndex,
            }))
          );
          ui.setTarget({
            label: targetLabelText,
            progress: result.advanced ? 0 : result.progress,
          });
          ui.renderDetection({
            noteLabel: currentLabel,
            frequency,
            centsOffset: targetCents,
            confidence,
            inTune: Math.abs(targetCents) <= 10 && againstTarget,
          });
          updateFingerboard({
            detectedNote: current,
            targetNote: { ...targetLabel, midiNumber: targetMidi },
          });
        } else {
          ui.setScaleEdgeLabels({
            leftLabel: midiToUiLabel(current.midiNumber - 1),
            rightLabel: midiToUiLabel(current.midiNumber + 1),
          });
          ui.renderDetection({
            noteLabel: currentLabel,
            frequency,
            centsOffset: current.centsOffset,
            confidence,
            inTune: Math.abs(current.centsOffset) <= 10,
          });
          updateFingerboard({
            detectedNote: current,
            targetNote: null,
          });
        }
      },
    });

    ui.setStatus("Audio collegato. Inizia a suonare.");
  } catch (error) {
    ui.setStatus(error.message ?? "Errore durante init audio.");
  } finally {
    connectButton.disabled = false;
  }
});
