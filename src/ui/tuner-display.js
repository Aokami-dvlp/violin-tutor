export function createTunerDisplay(elements) {
  const circumference = 2 * Math.PI * 24;
  elements.progressValue.style.strokeDasharray = `${circumference}`;
  elements.progressValue.style.strokeDashoffset = `${circumference}`;

  return {
    setStatus(message) {
      elements.statusLine.textContent = message;
    },
    setTrainerVisible(visible) {
      elements.trainerPanel.classList.toggle("hidden", !visible);
    },
    setTrainerTimingLabel(label) {
      if (!elements.trainerTimingLabel) return;
      elements.trainerTimingLabel.textContent = label;
    },
    setTarget({ label, progress }) {
      elements.targetNote.textContent = label;
      const offset = circumference * (1 - progress);
      elements.progressValue.style.strokeDashoffset = `${offset}`;
    },
    setScaleEdgeLabels({ leftLabel, rightLabel }) {
      elements.leftEdgeNote.textContent = leftLabel;
      elements.rightEdgeNote.textContent = rightLabel;
    },
    setTrainerQueue(items) {
      if (!elements.trainerQueue) return;
      elements.trainerQueue.innerHTML = items
        .map(
          (item) => `
            <li class="trainer-queue-item${item.isCurrent ? " is-current" : ""}">
              <span class="trainer-queue-dot"></span>
              <span class="trainer-queue-label">${item.label}</span>
            </li>
          `
        )
        .join("");
    },
    setIdle() {
      elements.appShell.classList.add("idle");
      elements.noteLabel.textContent = "--";
      elements.freqLabel.textContent = "-- Hz";
      elements.centsPointer.style.left = "50%";
      this.setScaleEdgeLabels({ leftLabel: "--", rightLabel: "--" });
      elements.confidenceRow.classList.add("hidden");
      this.setTarget({ label: elements.targetNote.textContent, progress: 0 });
    },
    renderDetection({ noteLabel, frequency, centsOffset, confidence, inTune }) {
      elements.appShell.classList.remove("idle");
      elements.noteLabel.textContent = noteLabel;
      elements.freqLabel.textContent = `${frequency.toFixed(1)} Hz`;
      elements.centsPointer.style.left = `${Math.max(0, Math.min(100, 50 + centsOffset))}%`;
      elements.confidenceRow.classList.remove("hidden");
      elements.confidenceFill.style.width = `${Math.min(100, Math.max(0, confidence * 100)).toFixed(1)}%`;
      elements.appShell.classList.toggle("in-tune-flash", inTune);
    },
  };
}
