// The little pill at the top while Talk is recording or writing down what was said.
import { useEffect, useState } from 'react';
import { stopVoice, useVoiceStatus } from '../editor/speech';

export function VoiceStatus() {
  const v = useVoiceStatus();
  const [, tick] = useState(0);
  useEffect(() => {
    if (v.state !== 'recording') return;
    const i = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [v.state]);
  if (v.state === 'idle') return null;
  const secs = Math.floor((Date.now() - v.since) / 1000);
  return (
    <div className={`voice-pill ${v.state}`} role="status" aria-live="polite">
      {v.state === 'recording' ? (
        <>
          <span className="voice-dot" /> Recording {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
          <button className="btn small" onClick={stopVoice}>
            Done
          </button>
        </>
      ) : (
        <>
          <span className="voice-spin" /> Writing down what you said…
        </>
      )}
    </div>
  );
}
