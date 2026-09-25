// Voice input using the browser's built-in speech recognition (works in Chrome
// and Edge). Where it isn't available, the Talk buttons explain that plainly.
import { useEffect, useRef, useState } from 'react';

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const Ctor = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;

export const speechSupported = !!Ctor;

/** onFinal is called with each finished phrase. */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<Rec | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => () => rec.current?.stop(), []);

  function start() {
    if (!Ctor) {
      setError('Talking isn\'t supported in this browser. It works in Google Chrome and Microsoft Edge.');
      return;
    }
    setError('');
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(tidy(res[0].transcript));
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone permission was blocked. Allow the microphone in your browser to use Talk.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Voice input stopped unexpectedly. Please try again.');
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
  }

  return { listening, interim, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** Handle spoken punctuation commands and capitalisation. */
function tidy(t: string): string {
  let s = ' ' + t.trim() + ' ';
  const map: [RegExp, string][] = [
    [/ (full stop|period)\b/gi, '.'],
    [/ comma\b/gi, ','],
    [/ question mark\b/gi, '?'],
    [/ exclamation (mark|point)\b/gi, '!'],
    [/ new paragraph\b/gi, '\n\n'],
    [/ new line\b/gi, '\n'],
    [/ open quote\b/gi, ' “'],
    [/ close quote\b/gi, '”'],
  ];
  for (const [re, r] of map) s = s.replace(re, r);
  s = s.trim().replace(/(^|[.!?]\s+|\n)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
  return s;
}
