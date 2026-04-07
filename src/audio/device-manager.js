const DEVICE_HINTS = ["audient", "id4"];

function preferAudient(a, b) {
  const la = (a.label || "").toLowerCase();
  const lb = (b.label || "").toLowerCase();
  const aLoopback = la.includes("loopback");
  const bLoopback = lb.includes("loopback");
  if (aLoopback && !bLoopback) return 1;
  if (!aLoopback && bLoopback) return -1;
  const aHint = DEVICE_HINTS.some((hint) => la.includes(hint));
  const bHint = DEVICE_HINTS.some((hint) => lb.includes(hint));
  if (aHint && !bHint) return -1;
  if (!aHint && bHint) return 1;
  return la.localeCompare(lb);
}

export async function setupDeviceManager({ deviceSelect }) {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error("Browser non supporta enumerateDevices.");
  }

  // Ask permission once so labels are populated.
  const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  tempStream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((device) => device.kind === "audioinput").sort(preferAudient);

  if (!audioInputs.length) {
    throw new Error("Nessun dispositivo audioinput trovato.");
  }

  deviceSelect.innerHTML = "";
  for (const device of audioInputs) {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Input ${device.deviceId.slice(0, 8)}`;
    deviceSelect.append(option);
  }

  const preferred = audioInputs.find((d) =>
    DEVICE_HINTS.some((hint) => (d.label || "").toLowerCase().includes(hint))
  );
  if (preferred) {
    deviceSelect.value = preferred.deviceId;
  }

  return {
    getSelectedDeviceId() {
      return deviceSelect.value;
    },
    getSelectedDeviceLabel() {
      const selected = audioInputs.find((d) => d.deviceId === deviceSelect.value);
      return selected?.label || "unknown";
    },
  };
}

export function getAudioConstraints(selectedDeviceId) {
  return {
    audio: {
      deviceId: { exact: selectedDeviceId },
      sampleRate: 44100,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}
