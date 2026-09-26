// Google Drive: settings card, "reconnect" banner, and "open from Drive" on a new computer.
import { useState } from 'react';
import { connectDrive, disconnectDrive, driveAvailable, listDriveNovels, openFromDrive, syncNow, useDrive } from '../services/drive';
import { useApp } from '../story/store';
import { timeAgo } from '../story/reference';
import { Icon, Modal, confirmDialog } from './ui';

function statusLine(status: string, last: number, message: string): string {
  if (status === 'syncing') return 'Saving to Google Drive…';
  if (status === 'synced') return `Saved to Google Drive ${last ? timeAgo(last) : 'just now'}.`;
  if (status === 'needs-connect') return 'Paused until you reconnect (Google asks every so often, for safety).';
  if (status === 'connecting') return 'Waiting for Google…';
  if (status === 'error') return message;
  return '';
}

export function DriveSettings() {
  const enabled = useDrive((s) => s.enabled);
  const status = useDrive((s) => s.status);
  const email = useDrive((s) => s.email);
  const last = useDrive((s) => s.lastSyncAt);
  const message = useDrive((s) => s.message);
  const isDemo = useApp((s) => s.project?.isDemo);
  if (!driveAvailable()) return null;
  return (
    <div className="card">
      <h2>Google Drive: online backup and other computers</h2>
      <p className="muted small">
        Keep your novel in your own Google Drive. It saves there automatically as you write, so it's safe if this computer breaks, and any computer you sign in on opens your latest pages. Nightjar can only see the files it creates, never the rest of your Drive.
      </p>
      {enabled ? (
        <>
          <div className="row">
            <span className={`pill ${status === 'error' || status === 'needs-connect' ? 'warn' : 'canon'}`}>
              <Icon name="check" size={14} /> Connected{email ? ` as ${email}` : ''}
            </span>
            {status === 'needs-connect' ? (
              <button className="btn primary" onClick={() => void connectDrive()}>
                Reconnect
              </button>
            ) : (
              <button className="btn" onClick={() => void syncNow()} disabled={status === 'syncing'}>
                Save to Drive now
              </button>
            )}
            <span className="spacer" />
            <button
              className="btn ghost small"
              onClick={async () => {
                if (await confirmDialog('Stop saving to Google Drive?', 'Your novel stays on this computer, and the copy already in your Drive stays there too.', 'Stop saving to Drive'))
                  disconnectDrive();
              }}
            >
              Stop using Google Drive
            </button>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {isDemo ? 'The example book isn\'t saved to Drive, only your own novels.' : statusLine(status, last, message)}
          </p>
          <p className="small muted" style={{ marginBottom: 0 }}>
            On another computer: open Nightjar, choose <b>Continue from Google Drive</b>, and sign in with the same Google account.
          </p>
        </>
      ) : (
        <>
          <button className="btn primary" onClick={() => void connectDrive()} disabled={status === 'connecting'}>
            <Icon name="upload" size={16} /> Save my novel to Google Drive
          </button>
          {message && <p className="small muted">{message}</p>}
        </>
      )}
    </div>
  );
}

/** A calm prompt at the top when Drive needs a click to carry on. */
export function DriveBanner() {
  const enabled = useDrive((s) => s.enabled);
  const status = useDrive((s) => s.status);
  const project = useApp((s) => s.project);
  if (!driveAvailable() || !enabled || !project || project.isDemo || status !== 'needs-connect') return null;
  return (
    <div className="demo-banner">
      <Icon name="upload" size={16} />
      <span>Connect to Google Drive so this novel stays in step with your other computers and backed up online.</span>
      <span className="spacer" />
      <button className="btn small primary" onClick={() => void connectDrive()}>
        Connect
      </button>
    </div>
  );
}

/** Welcome screen: open a novel that's in Google Drive (for a new or second computer). */
export function DriveOpenButton({ className = 'btn big' }: { className?: string }) {
  const [list, setList] = useState<Awaited<ReturnType<typeof listDriveNovels>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!driveAvailable()) return null;
  return (
    <>
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          setErr('');
          setBusy(true);
          try {
            if (await connectDrive()) setList(await listDriveNovels());
          } catch {
            setErr('Couldn\'t reach Google Drive. Please try again.');
          }
          setBusy(false);
        }}
      >
        <Icon name="upload" size={16} /> {busy ? 'Connecting…' : 'Continue from Google Drive'}
      </button>
      {err && <p className="small muted">{err}</p>}
      {list && (
        <Modal onClose={() => setList(null)}>
          <h2>Your novels in Google Drive</h2>
          {list.length === 0 ? (
            <p className="muted">
              No novels in this Google Drive yet. On the computer where you've been writing, open Settings and choose <b>Save my novel to Google Drive</b>. Then come back here.
            </p>
          ) : (
            <div className="stack" style={{ margin: '14px 0' }}>
              {list.map((n) => (
                <div
                  key={n.id}
                  className="card click row"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await openFromDrive(n.id);
                      setList(null);
                    } catch {
                      setErr('Couldn\'t open that novel. Please try again.');
                    }
                    setBusy(false);
                  }}
                >
                  <Icon name="book" size={24} />
                  <div>
                    <div className="serif" style={{ fontSize: '1.3rem' }}>{n.title}</div>
                    <div className="small muted">Last saved {timeAgo(n.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <span className="spacer" />
            <button className="btn" onClick={() => setList(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
