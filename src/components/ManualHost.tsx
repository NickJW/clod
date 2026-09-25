// The copy & paste window used when the author works with her ChatGPT subscription.
import { useEffect, useState } from 'react';
import { finishManual, onManualRequest, type ManualRequest } from '../ai/manual';
import { AIError } from '../ai/errors';
import { Modal } from './ui';
import { toast } from '../story/store';

export function ManualHost() {
  const [req, setReq] = useState<ManualRequest | null>(null);
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    onManualRequest((r) => {
      setReq(r);
      setAnswer('');
      setCopied(false);
    });
    return () => onManualRequest(null);
  }, []);
  if (!req) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(req.prompt);
      setCopied(true);
    } catch {
      toast('Couldn\'t copy automatically. Click in the box, press Ctrl+A, then Ctrl+C.', 'error');
    }
  };
  const cancel = () => {
    req.reject(new AIError('Cancelled.', 'cancelled'));
    finishManual(req);
  };
  const done = () => {
    req.resolve(answer.trim());
    finishManual(req);
  };

  return (
    <Modal onClose={cancel} wide>
      <h2>Ask ChatGPT or Claude</h2>
      <p className="muted">Three quick steps. Your story details are already included in the request.</p>
      <div className="stack">
        <div>
          <b>1.</b>{' '}
          <button className="btn primary" onClick={copy}>
            {copied ? '✓ Copied' : 'Copy the request'}
          </button>
          <details style={{ display: 'inline-block', marginLeft: 12 }}>
            <summary className="small muted" style={{ cursor: 'pointer' }}>See it</summary>
            <textarea className="input small" readOnly value={req.prompt} rows={6} style={{ marginTop: 6, width: '100%' }} />
          </details>
        </div>
        <div>
          <b>2.</b>{' '}
          <a className="btn" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
            Open ChatGPT
          </a>{' '}
          <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">
            Open Claude
          </a>{' '}
          <span className="small muted">Start a new chat, paste (Ctrl+V), and send. Wait for the full answer, then click the copy button under it.</span>
        </div>
        <div>
          <b>3.</b> Paste the answer here:
          <textarea className="input" rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Paste the answer (Ctrl+V)" style={{ marginTop: 6 }} />
        </div>
      </div>
      <div className="row end" style={{ marginTop: 16 }}>
        <button className="btn" onClick={cancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!answer.trim()} onClick={done}>
          Use this answer
        </button>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Privacy tip: check your chat app's privacy settings. In ChatGPT, turn off "Improve the model for everyone" (Settings → Data controls). In Claude, check the model-training setting under Settings → Privacy.
      </p>
    </Modal>
  );
}
