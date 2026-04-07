export function createTrainerMode({ sequence, toleranceCents, holdMs }) {
  let currentIndex = 0;
  let holdStart = null;

  return {
    getCurrentTarget() {
      return sequence[currentIndex];
    },
    resetHold() {
      holdStart = null;
    },
    update({ isOnTargetNote, centsOffset }) {
      const inPitch = isOnTargetNote && Math.abs(centsOffset) <= toleranceCents;
      const now = performance.now();
      if (!inPitch) {
        holdStart = null;
        return { progress: 0, advanced: false };
      }

      if (holdStart === null) holdStart = now;
      const elapsed = now - holdStart;
      const progress = Math.max(0, Math.min(1, elapsed / holdMs));
      if (elapsed >= holdMs) {
        currentIndex = (currentIndex + 1) % sequence.length;
        holdStart = null;
        return { progress: 1, advanced: true };
      }
      return { progress, advanced: false };
    },
  };
}
