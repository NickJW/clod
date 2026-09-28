// Voice input using the browser's built-in speech recognition (Chrome, Edge, and
// Safari on iPad/iPhone/Mac). Where it isn't available, the Talk buttons explain plainly.
//
// Safari (especially on iPad) behaves differently from Chrome: it often never marks
// results as "final", and it stops listening after each pause. So we keep whatever
// was heard and save it when listening ends, and quietly start listening again
// until she presses the button to stop.
import { useEffect, useRef, useState } from 'react';

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const Ctor = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;

export const speechSupported = !!Ctor;

/** iPad (which reports itself as a Mac), iPhone, or Safari on a Mac. */
export const isApple =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|CriOS|FxiOS/.test(navigator.userAgent));

export const KEYBOARD_TIP = 'You can also tap into the text and press the microphone key on the on-screen keyboard to dictate.';

/** onFinal is called with each finished phrase. */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<Rec | null>(null);
  const want = useRef(false); // she wants to keep talking (until she presses stop)
  const pending = useRef(''); // heard but not yet marked final
  const starts = useRef(0);
  const restarted = useRef(false); // this session was started automatically after a pause
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(
    () => () => {
      want.current = false;
      rec.current?.stop();
    },
    [],
  );

  const commitPending = () => {
    const t = pending.current.trim();
    pending.current = '';
    setInterim('');
    if (t) cb.current(tidy(t));
  };

  function listen() {
    const r = new Ctor!();
    // Safari handles one phrase at a time far more reliably; we restart between phrases.
    r.continuous = !isApple;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      if (!want.current) return; // late results after she pressed stop were already saved
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          pending.current = '';
          cb.current(tidy(res[0].transcript));
        } else live += res[0].transcript;
      }
      pending.current = live;
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      // Safari may refuse to restart on its own between phrases: just stop quietly.
      if (restarted.current && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) {
        want.current = false;
        return;
      }
      want.current = false;
      if (e.error === 'not-allowed')
        setError(isApple ? 'The microphone is blocked for this page. In Settings → Safari → Microphone, choose Allow (or Ask), then try again. ' + KEYBOARD_TIP : 'Microphone permission was blocked. Allow the microphone for this page in your browser, then try again.');
      else if (e.error === 'service-not-allowed')
        setError('Voice typing needs Siri & Dictation switched on: Settings → Siri (or Apple Intelligence & Siri) → turn on "Talk to Siri" or Dictation, then try again. ' + KEYBOARD_TIP);
      else if (e.error === 'audio-capture') setError('No microphone was found. ' + KEYBOARD_TIP);
      else if (e.error === 'network') setError('Voice typing needs an internet connection. ' + KEYBOARD_TIP);
      else setError('Voice input stopped unexpectedly. Please try again. ' + (isApple ? KEYBOARD_TIP : ''));
    };
    r.onend = () => {
      commitPending();
      // Keep listening across pauses until she presses stop (but don't loop if it keeps failing at once).
      if (want.current && Date.now() - starts.current > 800) {
        try {
          starts.current = Date.now();
          restarted.current = true;
          listen();
          return;
        } catch {
          /* fall through */
        }
      }
      want.current = false;
      setListening(false);
    };
    rec.current = r;
    starts.current = Date.now();
    r.start();
  }

  function start() {
    if (!Ctor) {
      setError('Talking isn\'t supported in this browser. It works in Safari on iPad, Google Chrome and Microsoft Edge. ' + KEYBOARD_TIP);
      return;
    }
    setError('');
    want.current = true;
    restarted.current = false;
    pending.current = '';
    try {
      listen();
      setListening(true);
    } catch {
      want.current = false;
      setError('Voice input couldn\'t start. Please try again. ' + KEYBOARD_TIP);
    }
  }

  function stop() {
    want.current = false;
    // Save what was heard right away (Safari may not send a final result after stop).
    commitPending();
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }

  return { listening, interim, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

const COMMON = new Set('the a an and but or so then she he it they we you i\'m it\'s there this that her his their my our when while if as at in on of to with for from by after before just now still because'.split(' '));

/** Add a spoken phrase after existing text: a space if needed, a capital only at the start of a sentence. */
export function joinSpoken(before: string, phrase: string): string {
  if (!phrase) return before;
  const sentenceStart = !before.trim() || /[.!?…]["”’)]?\s*$|\n\s*$/.test(before);
  let p = phrase;
  if (sentenceStart) p = p.charAt(0).toUpperCase() + p.slice(1);
  else {
    const first = p.match(/^[A-Z][a-z']*/)?.[0];
    if (first && COMMON.has(first.toLowerCase())) p = first.toLowerCase() + p.slice(first.length);
  }
  const pad = before && !/\s$/.test(before) && !/^[.,!?;:…]/.test(p) ? ' ' : '';
  return before + pad + p;
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
  // Capitalise after full stops within the phrase; the start of the phrase is decided by joinSpoken.
  s = s.trim().replace(/([.!?]\s+|\n)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
  return s;
}
