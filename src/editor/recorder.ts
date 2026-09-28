// Voice typing that works everywhere, including iPad and iPhone: record the microphone,
// then have Gemini write down what was said. (Safari's built-in speech recognition
// depends on Siri settings and often returns nothing, which is why this exists.)
import { getAISettings } from '../ai/provider';
import { BUILT_IN_GEMINI_KEY } from '../config';

export const recorderSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export interface Recording {
  stop(): Promise<Blob>;
  cancel(): void;
}

/** Start recording. Must be called straight from a tap/click (Safari requires it). */
export async function startRecording(): Promise<Recording> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC(); // created inside the tap so Safari lets it run
  void ctx.resume();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    void ctx.close();
    throw e;
  }
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(proc);
  proc.connect(ctx.destination);
  const finish = () => {
    try {
      source.disconnect();
      proc.disconnect();
    } catch {
      /* already disconnected */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return {
    async stop() {
      const rate = ctx.sampleRate;
      finish();
      return toWav(chunks, rate, 16000);
    },
    cancel: finish,
  };
}

/** Mono 16-bit WAV at the target rate (small, and every model accepts it). */
function toWav(chunks: Float32Array[], from: number, to: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) all.set(c, o), (o += c.length);
  const ratio = from / to;
  const n = Math.floor(total / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, to, true);
  v.setUint32(28, to * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // average the samples that fall into this output sample
    const a = Math.floor(i * ratio), b = Math.min(total, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += all[j];
    const x = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

const PROMPT = `This is a novelist dictating. Write down exactly what she says, word for word, with natural punctuation and capitals.
Spoken commands: "new paragraph" means start a new paragraph (a blank line); "new line" means a line break; "full stop" or "period" means "."; "comma" means ","; "question mark" means "?"; "exclamation mark" means "!"; "open quote" and "close quote" mean quotation marks.
Don't add, fix, summarise or comment. If nothing was said, reply with nothing at all. Reply with only the text.`;

/** Turn a recording into text with Gemini (her key if she uses Gemini, otherwise the built-in one). */
export async function transcribe(audio: Blob, signal?: AbortSignal): Promise<string> {
  const s = getAISettings();
  const key = (s.providerId === 'gemini' && s.apiKey) || BUILT_IN_GEMINI_KEY;
  if (!key) throw new Error('no-key');
  const data = await blobToBase64(audio);
  const body = JSON.stringify({
    contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0 },
  });
  let last: unknown;
  for (const model of ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body,
        });
        if (res.status === 503 || res.status === 500) {
          last = new Error('busy');
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (!res.ok) {
          last = new Error(res.status === 429 ? 'quota' : `http-${res.status}`);
          break;
        }
        const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        last = e;
      }
    }
  }
  throw last instanceof Error ? last : new Error('failed');
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}
