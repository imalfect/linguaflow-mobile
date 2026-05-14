// Audio capture as 16kHz mono 16-bit PCM WAV.
// Uses ScriptProcessorNode (deprecated but universally supported in mobile webviews).
// Output WAV is sent directly to Azure pronunciation REST API — no server-side conversion.

const TARGET_RATE = 16000;

export interface Recorder {
  stop: () => Promise<ArrayBuffer>;
  cancel: () => void;
  getLevel: () => number;
}

interface AudioContextLike {
  createMediaStreamSource: (stream: MediaStream) => AudioNode;
  createScriptProcessor: (bufferSize: number, inputChannels: number, outputChannels: number) => ScriptProcessorNode;
  sampleRate: number;
  destination: AudioDestinationNode;
  close: () => Promise<void>;
  state: AudioContextState;
  resume: () => Promise<void>;
}

interface ScriptProcessorNode extends AudioNode {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null;
}

interface AudioProcessingEvent {
  inputBuffer: AudioBuffer;
}

export async function startRecorder(): Promise<Recorder> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Mikrofon nie jest dostępny w tym urządzeniu.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const AudioCtor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AudioCtor) throw new Error("AudioContext nie jest wspierany.");
  const ctx = new AudioCtor() as unknown as AudioContextLike;
  if (ctx.state === "suspended") await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);

  const chunks: Float32Array[] = [];
  let level = 0;

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    // Compute peak level for UI meter
    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const a = Math.abs(input[i]);
      if (a > peak) peak = a;
    }
    level = peak;
    // Copy buffer (the underlying array is reused by the browser)
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  let stopped = false;

  const cleanup = async () => {
    try { source.disconnect(); } catch { /* ignore */ }
    try { processor.disconnect(); } catch { /* ignore */ }
    processor.onaudioprocess = null;
    stream.getTracks().forEach((t) => t.stop());
    try { await ctx.close(); } catch { /* ignore */ }
  };

  return {
    stop: async () => {
      if (stopped) throw new Error("Recorder already stopped");
      stopped = true;
      const sourceRate = ctx.sampleRate;
      await cleanup();
      const pcm = mergeChunks(chunks);
      const resampled = resampleLinear(pcm, sourceRate, TARGET_RATE);
      return encodeWav(resampled, TARGET_RATE);
    },
    cancel: () => {
      stopped = true;
      cleanup();
    },
    getLevel: () => level,
  };
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return merged;
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const outLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const next = idx + 1 < input.length ? input[idx + 1] : input[idx];
    output[i] = input[idx] * (1 - frac) + next * frac;
  }
  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export async function ensureMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
