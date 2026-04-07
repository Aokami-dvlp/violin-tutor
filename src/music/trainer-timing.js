/** Trainer hold duration: fixed 4/4 feel at 60 BPM (1 beat = 1 quarter note). */
export const TRAINER_BPM = 60;
export const TRAINER_TIME_SIGNATURE = "4/4";

const MS_PER_MINUTE = 60000;

export function quarterNoteMs(bpm = TRAINER_BPM) {
  return MS_PER_MINUTE / bpm;
}

/** @param {1 | 2 | 4} quarterBeats — note length as multiples of a quarter (1/4, 2/4, 4/4 of a bar in 4/4). */
export function holdMsForQuarterBeats(quarterBeats, bpm = TRAINER_BPM) {
  return quarterNoteMs(bpm) * quarterBeats;
}

export function normalizeTrainerHoldQuarterBeats(value) {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 4) return n;
  return 1;
}

export const TRAINER_HOLD_OPTIONS = [
  { beats: 1, label: "1/4 (1 tempo)" },
  { beats: 2, label: "2/4 (2 tempi)" },
  { beats: 4, label: "4/4 (4 tempi)" },
];
