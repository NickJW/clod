// Read the chapter aloud with the browser's built-in voice (free, private),
// highlighting each sentence as it's spoken. Hearing prose is the best way to
// catch clumsy rhythm and repetition.
import { useEffect, useRef, useState } from 'react';

export const readAloudSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function bestVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
  const prefer = ['Natural', 'Google UK English Female', 'Google US English', 'Samantha', 'Serena', 'Daniel', 'Microsoft Aria', 'Microsoft Libby', 'Microsoft Sonia'];
  for (const name of prefer) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.localService) ?? voices[0];
}

export function useReadAloud(onSentence: (start: number, end: number) => void) {
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1);
  const setRate = (r: number) => {
    rateRef.current = r;
    setRateState(r);
  };
  const cancelled = useRef(false);
  const cb = useRef(onSentence);
  cb.current = onSentence;

  useEffect(() => () => speechSynthesis?.cancel(), []);

  function play(text: string, from = 0) {
    if (!readAloudSupported) return;
    speechSynthesis.cancel();
    cancelled.current = false;
    const re = /[^.!?\n]+[.!?]*["”’)]*\s*|\n+/g;
    const parts: { s: number; e: number; t: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index + m[0].length <= from) continue;
      const t = m[0].replace(/\*/g, '').trim();
      if (t && /\w/.test(t)) parts.push({ s: m.index, e: m.index + m[0].trimEnd().length, t: /^\*$/.test(m[0].trim()) ? '' : t });
    }
    const voice = bestVoice();
    let i = 0;
    const next = () => {
      if (cancelled.current || i >= parts.length) return setState('idle');
      const part = parts[i++];
      const u = new SpeechSynthesisUtterance(part.t);
      if (voice) u.voice = voice;
      u.rate = rateRef.current;
      u.onstart = () => cb.current(part.s, part.e);
      u.onend = next;
      u.onerror = () => setState('idle');
      speechSynthesis.speak(u);
    };
    setState('playing');
    next();
  }

  return {
    state,
    rate,
    setRate,
    play,
    pause: () => (speechSynthesis.pause(), setState('paused')),
    resume: () => (speechSynthesis.resume(), setState('playing')),
    stop: () => {
      cancelled.current = true;
      speechSynthesis.cancel();
      setState('idle');
    },
  };
}
