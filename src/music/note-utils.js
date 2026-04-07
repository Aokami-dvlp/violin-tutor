const DEFAULT_A4 = 440;
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
const VIOLIN_MIN_HZ = 175;
const VIOLIN_MAX_HZ = 3136;
const CONFIDENCE_THRESHOLD = 0.85;

export function hzToNote(frequency, options = {}) {
  const referenceHz = options.referenceHz ?? DEFAULT_A4;
  const calibrationCents = options.calibrationCents ?? 0;
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const calibratedFrequency = frequency * Math.pow(2, -calibrationCents / 1200);
  const midiFloat = 69 + 12 * Math.log2(calibratedFrequency / referenceHz);
  const midiRounded = Math.round(midiFloat);
  const centsOffset = (midiFloat - midiRounded) * 100;
  const targetHz = referenceHz * Math.pow(2, (midiRounded - 69) / 12);
  const index = ((midiRounded % 12) + 12) % 12;
  const name = NOTE_NAMES[index];
  const octave = Math.floor(midiRounded / 12) - 1;

  return {
    name,
    octave,
    midiNumber: midiRounded,
    centsOffset,
    targetHz,
  };
}

export function noteLabelFromMidi(midiNumber) {
  const index = ((midiNumber % 12) + 12) % 12;
  return {
    name: NOTE_NAMES[index],
    octave: Math.floor(midiNumber / 12) - 1,
  };
}

export function formatNoteName(name, notation = "international") {
  if (notation === "italian") {
    return NOTE_NAMES_IT[name] ?? name;
  }
  return name;
}

export function getMidiFromNoteName(note) {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note);
  if (!match) throw new Error(`Formato nota non valido: ${note}`);
  const noteIndex = NOTE_NAMES.indexOf(match[1]);
  const octave = Number(match[2]);
  return noteIndex + (octave + 1) * 12;
}

export function isValidDetection({ frequency, confidence }) {
  if (!Number.isFinite(frequency) || !Number.isFinite(confidence)) return false;
  const threshold = frequency < 260 ? 0.72 : CONFIDENCE_THRESHOLD;
  if (confidence < threshold) return false;
  return frequency >= VIOLIN_MIN_HZ && frequency <= VIOLIN_MAX_HZ;
}

export function createPitchSmoother({ medianWindow = 5, centsAlpha = 0.3 } = {}) {
  const midiHistory = [];
  let centsEma = 0;
  let hasEma = false;

  return {
    push(midiNumber, centsOffset) {
      midiHistory.push(midiNumber);
      if (midiHistory.length > medianWindow) midiHistory.shift();
      const sorted = [...midiHistory].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianMidi = sorted[mid];

      if (!hasEma) {
        centsEma = centsOffset;
        hasEma = true;
      } else {
        centsEma = centsAlpha * centsOffset + (1 - centsAlpha) * centsEma;
      }

      return {
        midiNumber: medianMidi,
        centsOffset: Math.max(-50, Math.min(50, centsEma)),
      };
    },
  };
}
