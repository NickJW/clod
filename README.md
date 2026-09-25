# Nightjar: a novel studio for dark fiction

A calm, private writing studio for a first-time novelist writing a dark mystery / psychological thriller. **She is the author. The AI is her editor.** It helps her think, plan, check her mystery and polish her prose, but it never writes the book for her and never changes anything without her say-so.

## For the writer: how it works

1. **Open it.** The first time, a few friendly, skippable questions set up your novel. Or you can explore the demo novel, *The Salt House*.
2. **Home** shows your book, where you left off, and a big **Continue writing** button.
3. **Write** is a quiet manuscript page. It saves automatically, a moment after you stop typing ("✓ Saved just now" at the bottom).
4. **Your editor** (the panel on the right) is organised by what you want: *Think, Develop, Scene, Write, Improve, Tension, Mystery, Ask*. Select some text and a small toolbar offers *Improve, Make darker, More suspense, Subtler, Editor's review*.
5. Every suggestion comes with buttons: **Use this · Save as possibility · Not for me · Ask me more**. Every edit shows exactly what changed, and you **Accept** or **Keep mine**. Earlier versions are always in **History**.
6. **Talk**: click the microphone anywhere and speak instead of typing (Chrome and Edge).
7. **I'm stuck** and **What should I work on?** are on the Home page whenever you need them.

### Using the AI editor with your ChatGPT or Claude subscription
There's nothing to set up. Tell Nightjar once (during setup, or in Settings) whether you use **ChatGPT or Claude**, and whether it's the **desktop app or the website**. When you ask your editor for help:
1. Click **Copy the request**. It already includes the relevant parts of your story.
2. Switch to ChatGPT or Claude, paste it into a new chat, and send. (Follow-up questions go in the same chat.)
3. Copy the answer and come back. Nightjar fills it in by itself, and you click **Use this answer**.

Everything else (Accept / Keep mine, Use this / Maybe / Not for me) works exactly the same. The whole app also works without any AI at all.

*Advanced (optional):* Settings → "Advanced: connect directly with an API key" connects Claude or OpenAI directly, with no copy and paste, paid per use.

### Keeping your work safe
- Everything is saved in this browser on this computer. There's no account, no server and no tracking.
- Automatic safety copies are kept while you work (Settings → *Automatic safety copies*).
- **Save a backup file** regularly (Home reminds you weekly). A backup restores your whole novel on any computer.
- Export at any time: **Word (.docx, standard manuscript format), PDF, Markdown, plain text**, plus the story bible and notes.

## Running it

It's a static web app, so any static host works.

- **Easiest: GitHub Pages.** In the repository's *Settings → Pages*, set *Source* to **GitHub Actions**. Every push to `main` then publishes the app (see `.github/workflows/deploy.yml`). Open the page in Chrome or Edge and use *Install app* (the icon in the address bar) so it opens like a normal desktop program.
- **Locally:** `npm install`, then `npm run dev` (development) or `npm run build && npm run preview`.

> Your novel is stored per browser *and* per web address. If you move the app to a new address, export a backup first and restore it there.

## For developers

**Stack:** Vite + React 19 + TypeScript. There's no backend and no state library, and runtime dependencies are minimal (`docx` and `mammoth`, both lazy-loaded for Word import/export). It was chosen for fast startup, simple hosting, and code that's easy to pick up.

```
src/
  types/        Data model (Project, Chapter, Character, Clue, Secret, TimelineEvent…) + the canon status
  storage/      IndexedDB persistence, emergency localStorage copy, automatic snapshots, prefs
  story/        App store (autosave, undoable deletes), factories/normalisation, demo novel, reference data
  ai/
    provider.ts   Model-agnostic AIProvider interface, settings, usage counter
    anthropic.ts  Claude provider: streaming, retries, friendly errors, prompt caching
    prompts.ts    Shared craft rules (anti-generic-prose) + specialised editor roles
    context.ts    Relevance-based context selection (never sends the whole manuscript)
    actions.ts    Every AI feature: role, scope, output shape, human label
    session.ts    Editor panel state, runner, tolerant parsing
  editor/       Editor bridge, word-level diff, local prose checker, speech input
  services/     Import/export (DOCX manuscript format, PDF via print, Markdown, TXT, backups)
  components/   UI kit + the editor panel
  pages/        Home, Write, Story Bible, Characters, Mystery, Timeline, Scenes & Outline, Ending, Research, Settings, Onboarding
```

### Key design decisions
- **Canon system.** Every story item has a status: *Decided (canon) · Maybe (possibility) · Working on it (draft) · Set aside (discarded)*. The context builder labels everything, so the model knows fact from idea, and "set aside" ideas are listed so they're never suggested again. AI suggestions are only saved when the author clicks a button.
- **Cost control.** `ai/context.ts` picks what's relevant: characters mentioned in the passage or present in the chapter's scenes, their relationships and secrets, clues up to this chapter, timeline events involving them, and summaries of recent chapters. Past chapters are represented by short summaries, which the author can generate with the cheaper model. The story context is sent as a cacheable system block. The panel shows *Small / Medium / Larger request* before sending.
- **Prose quality.** `ai/prompts.ts` holds explicit craft principles (specificity, restraint, subtext, rhythm) and a long list of generic-AI tells to avoid. Style requests are translated into characteristics, never "write like [author]". There's also a free local checker (`editor/proseCheck.ts`) that flags stock phrases, dash overuse, filter words, even rhythm and repeated openings. It's framed as hints, not a score or an "AI detector".
- **Never lose writing.** The manuscript is saved independently of AI calls (debounced autosave, retry on failure, emergency copy, snapshots, per-chapter version history before every AI change). AI errors are shown in plain English with *Try again*.
- **Swappable models.** Add a provider by implementing `AIProvider` in `ai/` and registering it in `PROVIDERS`.

### Status

Working now:
- Phase 1: shell, dashboard, onboarding, chapters, autosave, editor panel, Claude integration, story bible, characters, AI editing
- Phase 2: mystery board (truth, clues, red herrings, secrets, who-knows-what grid, reader-knowledge timeline, free local warnings), timeline with contradiction flags, scene database, chapter outlining by plain questions, relationships, canon system, AI continuity checks
- Phase 3: professional editor review, revision modes, twist workshop, pacing/structure analysis, romance tracker, relevance-based context, version compare/restore, ending workspace
- Phase 4: voice input, research area (known / needs checking / invented), notes, DOCX/TXT/MD import, full export and backup

Added in the second round:
- **Guide**: a step-by-step writing journey (11 steps) with auto-detected progress, a "next step" card on Home, and a guide bar on each page with *Back to guide / Next step*
- **AI choice**: Claude (recommended), ChatGPT via an OpenAI API key (models listed live from her account), or **copy & paste** with a ChatGPT/Claude subscription (no key; chat subscriptions can't be connected to other apps directly)
- Better AI output: drafts match a sample of her own prose; every AI draft gets a free quality check with "Ask for a cleaner version"; chapter summaries refresh automatically with the cheap model
- "Update my story bible from this chapter": one-click adding of new facts, clues, events and characters
- Italics (`*like this*`, Ctrl+I) in the editor, reader, PDF and Word export/import; scene breaks
- Whole-book search, today's word count, a getting-started checklist, in-app dialogs instead of browser pop-ups, a tidier toolbar
- Automatic hourly backups to a folder she picks once (Chrome/Edge), and offline support

Planned / not yet built:
- Bold/underline and other rich formatting
- A native desktop installer (the browser's *Install app* works today)
- Embedding-based retrieval for very long manuscripts (structured selection plus summaries is used instead)
- Optional encrypted cloud sync. Deliberately left out for privacy; backups cover this for now.
