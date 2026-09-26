// Pip: a little helper bird in the corner. Ask it how anything in Nightjar works;
// it answers in plain words and can take you to the right page and point at the button.
import { useEffect, useRef, useState } from 'react';
import { getAISettings, getProvider } from '../ai/provider';
import { getPref, setPref } from '../storage/db';
import { go, useApp, type Page } from '../story/store';
import { useSpeech } from '../editor/speech';
import { PAGES, localAnswer, manualText } from '../help/manual';
import { Icon } from './ui';

interface Msg {
  from: 'me' | 'pip';
  text: string;
  go?: Page;
  show?: string;
}

const PAGE_NAMES: Record<Page, string> = {
  home: 'Home', guide: 'Guide', write: 'Write', story: 'Story Bible', characters: 'Characters', mystery: 'Mystery', timeline: 'Timeline',
  scenes: 'Scenes & Outline', ending: 'Ending', research: 'Research & Notes', lab: 'Story Lab', polish: 'Polish', publish: 'Publish', series: 'Series', settings: 'Settings',
};

const STARTERS = ['What should I do next?', 'How does the AI editor work?', 'How do I back up my book?', 'How do I make the text bigger?'];

/** The bird. Pure SVG + CSS animation (bobbing, blinking, beak moves while talking). */
export function Bird({ talking = false, size = 60 }: { talking?: boolean; size?: number }) {
  return (
    <svg className={`pip${talking ? ' talking' : ''}`} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g className="pip-body">
        <ellipse cx="32" cy="58" rx="14" ry="2.5" className="pip-shadow" />
        <path className="pip-tail" d="M44 40 L58 46 L55 50 L42 45 Z" />
        <ellipse cx="31" cy="36" rx="19" ry="17" className="pip-back" />
        <ellipse cx="29" cy="40" rx="12" ry="11" className="pip-belly" />
        <path className="pip-tuft" d="M30 20 Q29 13 33 11 Q32 15 35 18 Q36 13 40 13 Q37 17 36 21 Z" />
        <path className="pip-wing" d="M37 31 Q50 29 51 41 Q49 48 40 47 Q35 42 37 31 Z" />
        <path className="pip-feather" d="M41 37 Q45 38 47 42 M40 41 Q43 42 45 45" />
        <g className="pip-eye">
          <circle cx="24" cy="30" r="6.2" className="pip-eye-white" />
          <circle cx="25.2" cy="30.6" r="3.4" className="pip-pupil" />
          <circle cx="26.6" cy="29" r="1.4" fill="#fff" />
          <circle cx="23.9" cy="32" r="0.6" fill="#fff" opacity="0.8" />
        </g>
        <path className="pip-brow" d="M18 22 Q24 19 29 22" />
        <g className="pip-beak">
          <path className="pip-beak-top" d="M12 33 L19 30.5 L19 35 Z" />
          <path className="pip-beak-bottom" d="M13 34.5 L19 35 L19 37 Z" />
        </g>
        <circle cx="21" cy="38" r="2.6" className="pip-cheek" />
        <path className="pip-feet" d="M27 52 L26 56 M32 52 L33 56" />
      </g>
    </svg>
  );
}

function point(label: string) {
  const want = label.toLowerCase().trim();
  const els = Array.from(document.querySelectorAll<HTMLElement>('button, h2, h3, .lab, label, a, .tab'));
  const el =
    els.find((e) => e.offsetParent && (e.textContent ?? '').trim().toLowerCase() === want) ??
    els.find((e) => e.offsetParent && (e.textContent ?? '').trim().toLowerCase().startsWith(want)) ??
    els.find((e) => e.offsetParent && (e.textContent ?? '').toLowerCase().includes(want));
  if (!el) return;
  if (el.classList.contains('tab')) el.click();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('pip-glow');
  setTimeout(() => el.classList.remove('pip-glow'), 4200);
}

function takeThere(m: Msg) {
  if (m.go) go(m.go);
  if (m.show) setTimeout(() => point(m.show!), m.go ? 450 : 50);
}

async function ask(question: string, history: Msg[], page: Page): Promise<Msg> {
  const s = getAISettings();
  const canAI = !!s.apiKey && s.providerId !== 'manual';
  if (canAI) {
    const system = `You are Pip, a cheerful little bird who lives in the corner of Nightjar, a novel-writing app. You help a first-time novelist in her sixties who isn't technical. Answer questions about how the app works (and small general writing questions) in warm, plain words: short sentences, no jargon, under 110 words. Use numbered steps when there are several. Only describe buttons and pages that exist in the manual below; if you're not sure, say where to look instead of guessing. She is on the "${page}" page now.

If going somewhere would help, end your answer with a line "GO: <page id>" (one of: ${Object.keys(PAGES).join(', ')}), and if a specific button, tab or heading should be pointed at, a line "SHOW: <its exact label>". Otherwise leave those lines out.

THE MANUAL:
${manualText()}`;
    const messages = [
      ...history.slice(-6).map((m) => ({ role: m.from === 'me' ? ('user' as const) : ('assistant' as const), content: m.text })),
      { role: 'user' as const, content: question },
    ];
    try {
      const res = await getProvider(s.providerId).complete({ system, context: '', messages, maxTokens: 700, creativity: 0.4, fast: true }, s);
      let text = res.text.trim();
      const g = text.match(/^\s*GO:\s*([a-z]+)\s*$/im)?.[1] as Page | undefined;
      const sh = text.match(/^\s*SHOW:\s*"?(.+?)"?\s*$/im)?.[1];
      text = text.replace(/^\s*(GO|SHOW):.*$/gim, '').trim();
      return { from: 'pip', text, go: g && g in PAGES ? g : undefined, show: sh };
    } catch {
      /* fall through to the offline answer */
    }
  }
  const t = localAnswer(question);
  if (t) return { from: 'pip', text: t.a, go: t.go, show: t.show };
  return {
    from: 'pip',
    text: canAI
      ? 'I couldn\'t reach the internet just now. The Guide shows every step in order, and each page has a short explanation at the top.'
      : 'I\'m not sure about that one. Try the Guide: it shows every step in order. (When your AI editor is connected, I can answer almost any question.)',
    go: 'guide',
  };
}

export function Helper() {
  const page = useApp((s) => s.page);
  const focus = useApp((s) => s.focusMode);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [hello, setHello] = useState(false);
  const [hop, setHop] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const speech = useSpeech((t) => setQ((x) => (x ? x.replace(/\s*$/, ' ') : '') + t));

  // A friendly hello once a day, after a moment.
  useEffect(() => {
    const today = new Date().toDateString();
    if (getPref('pip:hello', '') === today) return;
    const t = setTimeout(() => setHello(true), 4000);
    const t2 = setTimeout(() => setHello(false), 16000);
    setPref('pip:hello', today);
    return () => (clearTimeout(t), clearTimeout(t2));
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  if (focus) return null;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    speech.stop();
    setQ('');
    const mine: Msg = { from: 'me', text: question };
    setMsgs((m) => [...m, mine]);
    setBusy(true);
    const answer = await ask(question, msgs, page);
    setBusy(false);
    setMsgs((m) => [...m, answer]);
    setHop(true);
    setTimeout(() => setHop(false), 700);
    if (answer.go || answer.show) takeThere(answer);
  };

  return (
    <div className={`helper${open ? ' open' : ''}`}>
      {open && (
        <div className="helper-panel" role="dialog" aria-label="Ask Pip for help">
          <div className="helper-head">
            <Bird talking={busy} size={40} />
            <div>
              <b>Pip</b>
              <div className="tiny muted">Ask me how anything works</div>
            </div>
            <span className="spacer" />
            <button className="btn ghost small" onClick={() => setOpen(false)} title="Close" aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="helper-msgs" ref={list}>
            <div className="helper-msg pip">Hello! I'm Pip. Ask me anything about Nightjar, like how to do something or where to find it, and I'll show you.</div>
            {msgs.map((m, i) => (
              <div key={i} className={`helper-msg ${m.from}`}>
                {m.text.split('\n').map((line, j) => (
                  <div key={j}>{line || ' '}</div>
                ))}
                {m.from === 'pip' && (m.go || m.show) && (
                  <button className="btn small" style={{ marginTop: 8 }} onClick={() => takeThere(m)}>
                    Show me{m.go && m.go !== page ? ` (${PAGE_NAMES[m.go]})` : ''}
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="helper-msg pip typing-dots" aria-label="Pip is thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            {msgs.length === 0 && (
              <div className="helper-starters">
                {STARTERS.map((s) => (
                  <button key={s} className="chip" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="helper-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(q);
            }}
          >
            <input className="input" value={speech.listening && speech.interim ? `${q} ${speech.interim}` : q} onChange={(e) => setQ(e.target.value)} placeholder="Type or talk your question…" aria-label="Your question" autoFocus />
            <button type="button" className={`btn small${speech.listening ? ' primary' : ''}`} onClick={speech.toggle} title="Talk" aria-label="Talk">
              <Icon name="mic" size={16} />
            </button>
            <button className="btn small primary" disabled={!q.trim() || busy}>
              Ask
            </button>
          </form>
        </div>
      )}
      {!open && hello && (
        <button className="helper-hello" onClick={() => (setHello(false), setOpen(true))}>
          Hi! Need a hand? Ask me anything.
        </button>
      )}
      <button className={`helper-fab${hop ? ' hop' : ''}`} onClick={() => (setOpen(!open), setHello(false))} aria-label={open ? 'Close Pip' : 'Ask Pip for help'} title="Ask Pip for help">
        <Bird talking={busy} />
      </button>
    </div>
  );
}
