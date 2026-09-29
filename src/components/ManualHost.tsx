// The copy & paste window: how the author works with her ChatGPT or Claude
// subscription (desktop app or website). One click copies the request; when she
// comes back, the answer she copied is filled in automatically.
import { useEffect, useRef, useState } from 'react';
import { finishManual, onManualRequest, type ManualRequest } from '../ai/manual';
import { AIError } from '../ai/errors';
import { Modal } from './ui';
import { toast } from '../story/store';
import { getPref, setPref } from '../storage/db';

export type ChatApp = 'chatgpt' | 'claude';
export type ChatWhere = 'app' | 'web';
export const CHAT_APPS: Record<ChatApp, { name: string; url: string }> = {
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { name: 'Claude', url: 'https://claude.ai/new' },
};

let chatWindow: Window | null = null;

/** Website mode: open (or bring back) one chat window beside the studio. */
function openChat(app: ChatApp, reuse: boolean) {
  if (reuse && chatWindow && !chatWindow.closed) return chatWindow.focus();
  const w = Math.min(760, Math.round(screen.availWidth * 0.45));
  const h = Math.round(screen.availHeight * 0.9);
  chatWindow = window.open(CHAT_APPS[app].url, 'nightjar-chat', `popup=yes,width=${w},height=${h},left=${screen.availWidth - w},top=20`);
  if (!chatWindow) window.open(CHAT_APPS[app].url, '_blank');
  else chatWindow.focus();
}

export function ManualHost() {
  const [req, setReq] = useState<ManualRequest | null>(null);
  const [answer, setAnswer] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [auto, setAuto] = useState(false);
  const [app, setApp] = useState<ChatApp>(getPref<ChatApp>('chatApp', 'chatgpt'));
  const [where, setWhere] = useState<ChatWhere>(getPref<ChatWhere>('chatWhere', 'app'));
  const reqRef = useRef<ManualRequest | null>(null);

  useEffect(() => {
    onManualRequest((r) => {
      reqRef.current = r;
      setReq(r);
      setAnswer('');
      setStep(1);
      setAuto(false);
      setApp(getPref<ChatApp>('chatApp', 'chatgpt'));
      setWhere(getPref<ChatWhere>('chatWhere', 'app'));
    });
    return () => onManualRequest(null);
  }, []);

  // When she comes back from ChatGPT/Claude, pick up the answer she copied.
  useEffect(() => {
    if (!req || step !== 2) return;
    const grab = async () => {
      try {
        const clip = (await navigator.clipboard.readText()).trim();
        if (clip && clip !== reqRef.current?.prompt.trim()) {
          setAnswer((cur) => (cur.trim() ? cur : clip));
          setAuto(true);
        }
      } catch {
        /* not allowed: she can paste by hand */
      }
    };
    window.addEventListener('focus', grab);
    return () => window.removeEventListener('focus', grab);
  }, [req, step]);

  if (!req) return null;
  const name = CHAT_APPS[app].name;
  const same = req.followUp;

  const go = async () => {
    try {
      await navigator.clipboard.writeText(req.prompt);
    } catch {
      toast('Couldn\'t copy automatically. Open "See the request" below and copy it by hand.', 'error');
    }
    setPref('chatApp', app);
    setPref('chatWhere', where);
    if (where === 'web') openChat(app, same);
    setStep(2);
  };
  const cancel = () => {
    req.reject(new AIError('Cancelled.', 'cancelled'));
    finishManual(req);
  };
  const done = () => {
    req.resolve(answer.trim());
    finishManual(req);
  };

  const pasteStep = same ? `the same ${name} chat as before` : `a new ${name} chat`;
  const goLabel = where === 'web' ? `Copy & open ${name}` : `Copy the request`;

  return (
    <Modal onClose={cancel} wide>
      <h2>{same ? `Follow-up for ${name}` : `Ask ${name}`}</h2>
      {step === 1 ? (
        <>
          <p className="muted">
            {same ? 'Your follow-up is ready.' : 'Your request is ready, with your story details included.'}{' '}
            {where === 'app' ? `Copy it, then paste it into ${pasteStep} in your ${name} app.` : `One click copies it and opens ${name} beside this window.`}
          </p>
          <div className="row" style={{ margin: '16px 0' }}>
            <button className="btn primary big" onClick={go} autoFocus>
              {goLabel}
            </button>
          </div>
          <ol className="muted" style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            <li>
              {where === 'app' ? (
                <>
                  Switch to your <b>{name} app</b> (click it in your taskbar or dock).
                </>
              ) : (
                <>{name} opens in a window beside this one.</>
              )}{' '}
              {same ? <b>Stay in the same chat.</b> : <>Start a <b>new chat</b>.</>}
            </li>
            <li>Click in the message box, paste (Ctrl+V, or Cmd+V on a Mac), and send.</li>
            <li>When the answer has finished, click the <b>copy</b> button under it.</li>
            <li>Come back here. The answer fills in by itself.</li>
          </ol>
          <div className="row small" style={{ marginTop: 10, gap: 6 }}>
            <span className="muted">Using:</span>
            {(['chatgpt', 'claude'] as ChatApp[]).map((a) => (
              <button key={a} className={`chip${app === a ? ' on' : ''}`} style={{ minHeight: 30, padding: '2px 12px' }} onClick={() => setApp(a)}>
                {CHAT_APPS[a].name}
              </button>
            ))}
            <span className="muted" style={{ marginLeft: 8 }}>in the</span>
            {(['app', 'web'] as ChatWhere[]).map((w) => (
              <button key={w} className={`chip${where === w ? ' on' : ''}`} style={{ minHeight: 30, padding: '2px 12px' }} onClick={() => setWhere(w)}>
                {w === 'app' ? 'desktop app' : 'website'}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            In {name}: paste into {pasteStep}, send, then copy the answer and come back here.{' '}
            <button className="btn ghost small" onClick={go}>
              Copy again
            </button>
          </p>
          {auto && <div className="ok-box" style={{ marginBottom: 8 }}>✓ Got the answer you copied. Check it looks right, then click "Use this answer".</div>}
          <textarea className="input" rows={9} value={answer} onChange={(e) => (setAnswer(e.target.value), setAuto(false))} placeholder={`Paste ${name}'s answer here (Ctrl+V)`} />
          <div className="row end" style={{ marginTop: 14 }}>
            <button className="btn" onClick={cancel}>
              Cancel
            </button>
            <button className="btn primary big" disabled={!answer.trim()} onClick={done}>
              Use this answer
            </button>
          </div>
        </>
      )}
      <details style={{ marginTop: 10 }}>
        <summary className="tiny muted" style={{ cursor: 'pointer' }}>See the request</summary>
        <textarea className="input small" readOnly value={req.prompt} rows={6} style={{ marginTop: 6, width: '100%' }} onFocus={(e) => e.target.select()} />
      </details>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        The first time, your browser may ask to let this page see copied text. Choose <b>Allow</b>.
      </p>
    </Modal>
  );
}
