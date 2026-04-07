import { getAudioConstraints } from "./device-manager.js";
import workletUrl from "./pitch-worklet.js?worker&url";

export async function createPitchEngine({
  selectedDeviceId,
  selectedDeviceLabel,
  onPitch,
  onStatus,
  onError,
}) {
  if (!window.AudioWorkletNode || !window.AudioContext) {
    throw new Error("AudioWorklet non supportato dal browser (es. Safari vecchi).");
  }

  const stream = await navigator.mediaDevices.getUserMedia(getAudioConstraints(selectedDeviceId));
  const [track] = stream.getAudioTracks();
  const settings = track?.getSettings?.() || {};
  onStatus?.(
    `Input: ${selectedDeviceLabel || "unknown"} | SR: ${settings.sampleRate || "?"} | CH: ${
      settings.channelCount || "?"
    }`
  );
  const context = new AudioContext({ sampleRate: 44100 });
  await context.audioWorklet.addModule(workletUrl);

  const source = context.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(context, "pitch-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
  });
  const silenceGain = context.createGain();
  silenceGain.gain.value = 0;

  worklet.port.onmessage = (event) => {
    const data = event.data || {};
    if (data.type === "pitch") {
      onPitch({ frequency: data.frequency, confidence: data.confidence });
      return;
    }
    if (data.type === "error") {
      console.error(data.message);
      onError?.(data.message);
      return;
    }
    if (data.type === "status") {
      onStatus?.(data.message);
      return;
    }
  };

  source.connect(worklet);
  worklet.connect(silenceGain);
  silenceGain.connect(context.destination);

  return {
    destroy() {
      silenceGain.disconnect();
      worklet.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      context.close();
    },
  };
}
