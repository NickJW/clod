// On iPad and iPhone, an app added to the Home Screen as a separate web app keeps its own
// storage, apart from Safari, so it can't see novels saved in Safari. New Home Screen icons
// now open in Safari itself (manifest "display": "browser"); this explains how to replace an old one.
import { useState } from 'react';
import { getPref, setPref } from '../storage/db';
import { useApp } from '../story/store';

const standalone =
  (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;

export function HomeScreenNote() {
  const [hidden, setHidden] = useState(() => getPref('homeScreenNoteHidden', false));
  const hasNovels = useApp((s) => s.projects.some((p) => !p.isDemo));
  if (!standalone || hidden) return null;
  return (
    <div className="demo-banner home-note" role="note">
      <span>
        <b>Don't see your novel?</b> This Home Screen icon keeps its own separate copy of Nightjar, so it can't see what you saved in Safari. To fix it: delete this icon,
        open Nightjar in Safari, then tap Share → <b>Add to Home Screen</b>. The new icon opens the same copy as Safari.
        {hasNovels && ' Writing done here stays here: first tap Settings → Save a backup file, then in Safari choose Restore from a backup file.'}
      </span>
      <span className="spacer" />
      <button
        className="btn small"
        onClick={() => {
          setPref('homeScreenNoteHidden', true);
          setHidden(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}
