// Records the Nightjar video tour: drives the real app scene by scene, timed to the narration.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const DIR = process.env.TOUR;
const narration = JSON.parse(fs.readFileSync(`${DIR}/narration.json`, 'utf8'));
const durations = JSON.parse(fs.readFileSync(`${DIR}/durations.json`, 'utf8'));

// ---------- Canned AI answers (based on real Gemini output for the demo novel) ----------
const OWEN = `He sets the mug down on the oilcloth with a faint clink before he looks up. His knuckles are grey with salt and old engine oil.

"Well, love, I was down in the net-shed till about ten, sorting the gear before the blow came in. Went home after that. Quiet night. Too quiet, for November." He shakes his head, slow and easy. "I didn't hear about Tess until Miller rang round six in the morning."

He reaches out and puts a broad, warm hand on her shoulder, steadying her. "You shouldn't be sitting here turning things over in the dark, Nora. The girl knew that water. But a gale's a gale, and the rocks don't care who you are."`;
const BETA = `**What I felt**
A cold, quiet dread, and real sorrow. Nora watching her sister's call ring out on the kitchen counter made my stomach drop. That everyday kind of guilt felt painfully real.

**Where I was gripped**
The empty coat hook. Why would Tess put on their dead father's oilskin when her own parka was right there? And the receipt at two in the morning turned a sad story into a mystery I need to solve.

**Where my attention drifted or I got confused**
"Owen came by." For a moment I wondered if I'd missed an earlier mention of him.

**Who I suspect right now, and why**
Honestly? The mother. She's hiding something about that coat.

**Questions I'm carrying into the next chapter**
What did Tess find of her father's? Why was she paying for an empty berth?`;
const THINK = '```json\n' + JSON.stringify({
  questions: [],
  options: [
    { title: "Peter's original logbook", idea: 'Margaret burned pages from the logbook proving someone else was aboard the night Peter drowned. She tore them out years ago to protect Owen.', why: 'It ties the burning straight to the heart of the mystery.', changes: 'Margaret becomes complicit, not just grieving.', clues: 'A scrap of ruled logbook paper in the ash.', complications: 'Nora now has reason to distrust her mother.', weaknesses: 'It could point to Owen too early.' },
    { title: "Tess's childhood journals", idea: 'Tess wrote down things she overheard as a girl, the year her father died. Margaret burned them before Nora could read them.', why: 'It gives Tess a voice in the book, even after her death.', changes: 'The past becomes something Nora can partly recover.', clues: 'A surviving page in Tess\'s room.', complications: 'What else did Tess know?', weaknesses: 'Journals are a familiar device.' },
    { title: 'Insurance papers', idea: 'The policy on the Margaret Rose was changed a month before it sank.', why: 'Nora reads insurance claims for a living, so she\'d spot it.', changes: 'Adds a money motive alongside the emotional one.', clues: 'A letterhead fragment in the stove.', complications: 'Could make Margaret look like a killer.', weaknesses: 'Money motives can feel ordinary.' },
  ],
}) + '\n```';
const BACKWARDS = '```json\n' + JSON.stringify({
  summary: 'Your ending needs the reader to feel Owen\'s kindness early, then see it curdle. Most of the pieces are already in place.',
  items: [
    { kind: 'clue', title: 'The watch Owen shouldn\'t know about', detail: 'Owen mentions the Seiko at the wake. Later, the police list shows no watch.', chapter: 2, have: true },
    { kind: 'clue', title: 'Tide times at the breakwater', detail: 'At 11 p.m. the foot of the breakwater was mud. She couldn\'t have drowned there.', chapter: 3, have: true },
    { kind: 'scene', title: 'Elias admits he gave Tess the logbook', detail: 'Reveal why his van was at the Salt House, making him the last person to see her alive.', chapter: 8, have: false },
    { kind: 'secret', title: 'What the logbook says', detail: 'The reader learns Owen was at the helm when Peter drowned. That\'s his motive.', chapter: 11, have: false },
    { kind: 'scene', title: 'Owen\'s mask slips', detail: 'A small moment where his steadying hand grips too hard.', chapter: 14, have: false },
  ],
  questions: ['Does Margaret know the truth before Nora does?'],
}) + '\n```';
const PLAN = `**Scene 1: The breakwater at eleven** (Nora)
Nora walks out at the hour Tess supposedly fell. The tide is out: mud and rope where the water should be.

**Scene 2: Elias**
He finds her there. He won't say why he was at the wake. Wary, and something else.

**The question to carry forward:** if Tess didn't drown here, where did she die?`;

const ANALYSIS = '```json\n' + JSON.stringify({
  chapters: [1, 2, 3, 4, 5].map((n) => ({ chapter: n, keepReading: [8, 5, 8, 4, 9][n - 1], tension: [6, 5, 7, 5, 9][n - 1], endingHook: [8, 5, 8, 4, 9][n - 1], emotions: { dread: [6, 4, 7, 5, 9][n - 1], curiosity: [8, 6, 8, 5, 9][n - 1], grief: [8, 6, 3, 2, 4][n - 1], warmth: [2, 4, 3, 5, 1][n - 1], desire: [0, 2, 4, 6, 3][n - 1], relief: [0, 2, 1, 4, 0][n - 1], humour: [1, 3, 0, 2, 0][n - 1] }, raised: n === 4 ? [] : [['Why was Tess wearing the oilskin?', 'Why pay for an empty berth?'], ['How does Owen know about the watch?'], ['Where did Tess really die?'], [], ['Who moved the body?']][n - 1], answered: n === 3 ? ['Did Tess drown at the breakwater?'] : [], putDownRisk: n === 4 ? 'Nothing new is at stake for several pages' : n === 2 ? 'The wake lingers on pleasantries' : 'none' })),
  overall: 'A gripping opening and a strong turn at the breakwater. Chapter 4 is the one place readers might drift.',
  sags: ['Chapter 4: the lighthouse visit repeats what we already suspect'],
  strengths: ['The receipt at 2 a.m.', 'The tide times reveal'],
}) + '\n```';
const SOLVE = '```json\n' + JSON.stringify({ chapters: [1, 2, 3, 4, 5].map((n) => ({ chapter: n, guesses: [
  { reader: 'casual', suspect: n < 4 ? 'Margaret Vale' : 'Owen Pryce', confidence: [25, 30, 35, 45, 70][n - 1], why: 'She is hiding something.' },
  { reader: 'fan', suspect: n < 2 ? 'Julian Hart' : n < 5 ? 'Elias Crane' : 'Owen Pryce', confidence: [20, 35, 40, 50, 75][n - 1], why: 'He was at the house that night.' },
  { reader: 'expert', suspect: n < 3 ? 'Elias Crane' : 'Owen Pryce', confidence: [20, 30, 45, 55, 80][n - 1], why: 'The watch detail.' } ] })) }) + '\n```';

function answerFor(prompt) {
  if (prompt.includes('For EACH chapter, rate honestly')) return ANALYSIS;
  if (prompt.includes('Simulate three different attentive readers')) return SOLVE;
  if (prompt.includes('Role-play as')) return OWEN;
  if (prompt.includes('beta reader')) return BETA;
  if (prompt.includes('Work BACKWARDS')) return BACKWARDS;
  if (prompt.includes('chapter plan')) return PLAN;
  if (prompt.includes('PASSAGE TO REVISE')) {
    const m = prompt.match(/PASSAGE TO REVISE:\n"""([\s\S]*?)"""/);
    const orig = m ? m[1] : '';
    const revised = orig
      .replace('That was her first thought, and she was ashamed of it.', 'It was her first thought. She was ashamed of it.')
      .replace('bigger than her father, a man who could lift her onto his shoulders with one arm', 'bigger than her father, a man who could swing her onto his shoulders one-handed')
      .replace('Now his suit hung off him and he held his tea in both hands to keep it level.', 'Now the suit hung off him, and he held his tea in both hands to keep it level.');
    return `<revision>\n${revised}\n</revision>\n<notes>\n- Split the first thought into two sentences, so the shame lands on its own.\n- "Swing her onto his shoulders one-handed" is more specific and physical.\n- Kept your ending line: the tea held level says everything.\n</notes>`;
  }
  return THINK;
}

// ---------- On-screen caption, mouse pointer and click ripple ----------
const OVERLAY = () => {
  const style = document.createElement('style');
  style.textContent = `
  #tour-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;background:rgba(28,24,22,.9);color:#fff;font:600 23px/1.35 Inter,system-ui,sans-serif;padding:14px 26px;border-radius:14px;max-width:80vw;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);transition:opacity .4s}
  #tour-cap small{display:block;font:500 13px Inter,system-ui,sans-serif;opacity:.7;letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px}
  #tour-cur{position:fixed;z-index:100000;width:26px;height:26px;pointer-events:none;left:-40px;top:-40px;transition:left .02s,top .02s}
  .tour-ripple{position:fixed;z-index:99998;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #b08d57;pointer-events:none;animation:tr .6s ease-out forwards}
  @keyframes tr{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}`;
  const add = () => {
    document.head.appendChild(style);
    const cap = document.createElement('div');
    cap.id = 'tour-cap';
    cap.style.opacity = '0';
    document.body.appendChild(cap);
    const cur = document.createElement('div');
    cur.id = 'tour-cur';
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l16 9.5-7 1.5-3.5 7z" fill="#1c1a19" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    window.addEventListener('mousemove', (e) => {
      cur.style.left = e.clientX - 3 + 'px';
      cur.style.top = e.clientY - 2 + 'px';
    }, true);
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.className = 'tour-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
  window.__caption = (step, total, text) => {
    const cap = document.getElementById('tour-cap');
    if (!cap) return;
    cap.innerHTML = `<small>Step ${step} of ${total}</small>${text}`;
    cap.style.opacity = '1';
  };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' } });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
  recordVideo: { dir: `${DIR}/raw`, size: { width: 1280, height: 800 } },
});
await ctx.addInitScript(OVERLAY);
await ctx.addInitScript(() => {
  if (!localStorage.getItem('nightjar:pref:ai'))
    localStorage.setItem('nightjar:pref:ai', JSON.stringify({ providerId: 'gemini', creativity: 0.7, providers: { gemini: { apiKey: 'demo-key-for-tour', model: 'gemini-flash-latest', fastModel: 'gemini-flash-lite-latest' } } }));
  localStorage.setItem('nightjar:pref:panelOpen', 'true');
});
await ctx.route('https://generativelanguage.googleapis.com/**', async (route) => {
  const body = JSON.parse(route.request().postData() || '{}');
  const prompt = body.contents?.map((c) => c.parts.map((p) => p.text).join('')).join('\n') ?? '';
  const text = answerFor(prompt);
  await new Promise((r) => setTimeout(r, 1800)); // "thinking"
  const chunks = text.match(/[\s\S]{1,60}/g).map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join('');
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: chunks + `data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }], usageMetadata: { promptTokenCount: 4000, candidatesTokenCount: 300 } })}\n\n` });
});
// Fonts and everything else pass through.

const page = await ctx.newPage();
const t0 = Date.now();
const starts = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mx = 640, my = 400;

async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) return;
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  const steps = Math.max(12, Math.round(Math.hypot(x - mx, y - my) / 18));
  await page.mouse.move(x, y, { steps });
  mx = x; my = y;
  await sleep(250);
}
async function click(loc) {
  await moveTo(loc);
  await loc.click();
  await sleep(500);
}
async function type(loc, text) {
  await click(loc);
  await page.keyboard.type(text, { delay: 45 });
}
async function scroll(dy, steps = 8) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(60);
  }
  await sleep(400);
}
const nav = (label) => page.locator('.nav button.nav-item', { hasText: label }).first();
const waitAI = async () => {
  await page.waitForFunction(() => !document.querySelector('.thread .typing'), null, { timeout: 60000 }).catch(() => {});
  await sleep(600);
};

async function scene(id, fn) {
  const i = narration.findIndex((n) => n.id === id);
  const start = Date.now();
  starts[id] = (start - t0) / 1000;
  await page.evaluate(([s, t, c]) => window.__caption?.(s, t, c), [i + 1, narration.length, narration[i].caption]);
  await fn(start + durations[id] * 1000);
  const left = start + durations[id] * 1000 + 900 - Date.now();
  if (left > 0) await sleep(left);
  else console.log(`scene ${id} ran over by ${-left}ms`);
}

await page.goto('http://localhost:4173/');
await sleep(1500);

await scene('welcome', async (end) => {
  await moveTo(page.getByRole('button', { name: 'Continue' }));
  await sleep(Math.max(0, end - Date.now() - 4000));
  await click(page.getByRole('button', { name: 'Explore a demo novel first' }));
});
await scene('home', async () => {
  await sleep(2500);
  await moveTo(page.locator('.hero-book .v').nth(1));
  await sleep(3000);
  await moveTo(page.getByText('Today', { exact: true }));
  await sleep(4000);
  await moveTo(page.locator('.hero-book .btn.primary'));
  await sleep(5000);
  await moveTo(page.locator('.helper-card .btn').first());
});
await scene('guide', async () => {
  await click(nav('Guide'));
  await sleep(4000);
  await scroll(300);
  await sleep(3000);
  await click(page.locator('.tl-item .card').first().locator('.row').first());
  await sleep(2500);
  await click(page.getByRole('button', { name: /Take me there/ }).first());
  await sleep(4500);
  await moveTo(page.getByRole('button', { name: 'Next step →' }));
  await sleep(2500);
  await click(page.getByRole('button', { name: '← Back to guide' }));
});
await scene('craft', async () => {
  await scroll(2200, 14);
  await sleep(2500);
  await click(page.locator('.grid-3 .card', { hasText: 'Planting clues fairly' }));
  await sleep(9000);
  await moveTo(page.locator('.modal .btn.primary'));
  await sleep(3000);
  await page.keyboard.press('Escape');
});
await scene('bible', async () => {
  await click(nav('Story Bible'));
  await sleep(3000);
  await moveTo(page.locator('textarea.input.serif').first());
  await sleep(3500);
  await click(page.getByRole('button', { name: 'Tone & feel' }));
  await sleep(1500);
  const slider = page.locator('input[type=range]').first();
  await moveTo(slider);
  await slider.focus();
  for (let k = 0; k < 2; k++) { await page.keyboard.press('ArrowRight'); await sleep(400); }
  await sleep(4000);
  await click(page.getByRole('button', { name: 'Decisions & ideas' }));
  await sleep(2000);
  await scroll(350);
  await moveTo(page.locator('.status-select').first());
});
await scene('characters', async () => {
  await click(nav('Characters'));
  await sleep(3500);
  await click(page.locator('.char-card', { hasText: 'Owen Pryce' }));
  await sleep(4000);
  await click(page.getByRole('button', { name: 'Interview Owen' }));
  await type(page.locator('.ai-compose textarea'), 'Where were you the night Tess died?');
  await click(page.locator('.ai-compose .btn.primary'));
  await waitAI();
  await moveTo(page.locator('.thread .md').first());
});
await scene('mystery', async () => {
  await click(nav('Mystery'));
  await sleep(2500);
  await scroll(420);
  await moveTo(page.locator('.clue.red-herring').first());
  await sleep(3000);
  await scroll(-420);
  await click(page.getByRole('button', { name: 'Suspects' }));
  await click(page.getByRole('button', { name: '+ Owen Pryce' }));
  await click(page.getByRole('button', { name: '+ Julian Hart' }));
  await sleep(3500);
  await click(page.getByRole('button', { name: 'Connect the dots' }));
  await click(page.locator('.chip', { hasText: 'Owen Pryce' }).first());
  await click(page.locator('.chip', { hasText: 'The watch' }).first());
  await moveTo(page.getByRole('button', { name: /Connect these/ }));
});
await scene('timeline', async () => {
  await click(nav('Timeline'));
  await sleep(2500);
  await scroll(500, 10);
  await sleep(2500);
  await scroll(500, 10);
  await sleep(2000);
  await scroll(-1000, 10);
});
await scene('outline', async () => {
  await click(nav('Scenes & Outline'));
  await sleep(2000);
  await click(page.locator('.ch-item', { hasText: 'Low Water' }).first());
  await sleep(2000);
  await scroll(350);
  await sleep(6000);
  await click(page.getByRole('button', { name: 'Turn my answers into a plan' }));
  await waitAI();
  await moveTo(page.locator('.thread .md').first());
});
await scene('write', async () => {
  await click(nav('Write'));
  await sleep(2500);
  const ta = page.locator('textarea.manuscript');
  await moveTo(page.locator('.ch-item').nth(1));
  await sleep(2000);
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await moveTo(page.locator('.editor-foot'));
  await ta.focus();
  await page.keyboard.type('\n\nShe went out after him.', { delay: 70 });
  await sleep(2500);
  await moveTo(page.locator('.save-ok, .editor-foot span').last());
  await sleep(1500);
  await moveTo(page.getByRole('button', { name: /Talk/ }).first());
});
await scene('improve', async () => {
  const ta = page.locator('textarea.manuscript');
  await scroll(-3000, 6);
  const range = await ta.evaluate((el) => {
    const s = el.value.indexOf('Owen Pryce found her there.');
    const e = el.value.indexOf('\n', s);
    return [s, e];
  });
  await ta.evaluate((el, [s, e]) => { el.focus(); el.setSelectionRange(s, e); }, range);
  await page.evaluate(() => {
    const el = document.querySelector('textarea.manuscript');
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    window.scrollTo({ top: top + 300, behavior: 'instant' });
  });
  await ta.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: true, bubbles: true })));
  await sleep(2500);
  await click(page.locator('.selbar button', { hasText: 'Improve' }));
  await sleep(1500);
  await moveTo(page.locator('.ai-compose .chip', { hasText: 'Polish' }));
  await sleep(1500);
  await click(page.locator('.ai-compose .btn.primary'));
  await waitAI();
  await moveTo(page.locator('.thread .diff').first());
  await sleep(5000);
  await click(page.locator('.thread .btn.primary', { hasText: 'Accept' }).first());
});
await scene('tools', async () => {
  await click(page.getByRole('button', { name: 'More ▾' }));
  await moveTo(page.getByRole('menuitem', { name: /Check my prose/ }));
  await sleep(3500);
  await moveTo(page.getByRole('menuitem', { name: /Read it like a reader/ }));
  await sleep(1500);
  await click(page.getByRole('menuitem', { name: /Read it like a reader/ }));
  await waitAI();
  await moveTo(page.locator('.thread .md').first());
  await sleep(4000);
  await page.locator('.ai-body').evaluate((el) => el.scrollBy({ top: 250, behavior: 'smooth' }));
});
await scene('think', async () => {
  await click(page.locator('.ai-modes button', { hasText: 'Think' }));
  await type(page.locator('.ai-compose textarea'), 'What could Margaret have burned in the stove?');
  await click(page.locator('.ai-compose .btn.primary'));
  await waitAI();
  await page.locator('.ai-body').evaluate((el) => el.scrollTo({ top: 0 }));
  await moveTo(page.locator('.opt .ot').first());
  await sleep(4000);
  await click(page.locator('.opt .btn', { hasText: 'Save as possibility' }).first());
});
await scene('ending', async () => {
  await click(nav('Ending'));
  await sleep(2500);
  await moveTo(page.locator('textarea.input.serif').first());
  await sleep(3000);
  await click(page.getByRole('button', { name: 'Plan backwards from my ending' }).first());
  await waitAI();
  await page.locator('.ai-body').evaluate((el) => el.scrollTo({ top: 0 }));
  await sleep(1500);
  await click(page.locator('.thread').first().locator('.opt .btn.primary').first());
});
await scene('lab', async () => {
  await click(nav('Story Lab'));
  await sleep(1500);
  await click(page.getByRole('button', { name: /Run the page-turner analysis/ }));
  await page.waitForFunction(() => !document.body.innerText.includes('Reading your whole book'), null, { timeout: 60000 });
  await sleep(1200);
  await scroll(380);
  await moveTo(page.locator('svg').nth(4));
  await sleep(3500);
  await scroll(520);
  await sleep(2500);
});
await scene('solve', async () => {
  await scroll(-2000, 6);
  await click(page.getByRole('button', { name: 'Solvability test', exact: true }));
  await click(page.getByRole('button', { name: /Run the solvability test/ }));
  await page.waitForFunction(() => !document.body.innerText.includes('Reading your whole book'), null, { timeout: 60000 });
  await sleep(1200);
  await scroll(300);
  await sleep(3500);
  await scroll(-600, 4);
  await click(page.getByRole('button', { name: 'Stress tests', exact: true }));
  await sleep(1500);
  await moveTo(page.locator('.grid-3 .card', { hasText: 'counter-move' }));
});
await scene('polish', async () => {
  await click(nav('Polish'));
  await sleep(2000);
  await scroll(350);
  await sleep(2500);
  await scroll(-600, 4);
  await click(page.getByRole('button', { name: 'Style sheet', exact: true }));
  await sleep(1500);
  await click(page.getByRole('button', { name: 'Proofread and final checks', exact: true }));
});
await scene('publish', async () => {
  await click(nav('Publish'));
  await sleep(2000);
  await click(page.getByRole('button', { name: 'Pitch materials', exact: true }));
  await sleep(2500);
  await click(page.getByRole('button', { name: 'Agents', exact: true }));
  await sleep(2500);
  await click(page.getByRole('button', { name: 'Submission package', exact: true }));
  await moveTo(page.getByRole('button', { name: /Download submission package/ }));
});
await scene('series', async () => {
  await click(nav('Series'));
  await sleep(2500);
  await scroll(500);
  await moveTo(page.getByRole('button', { name: /Start Book 2/ }));
});
await scene('momentum', async () => {
  await click(nav('Home'));
  await sleep(1500);
  await scroll(620);
  await moveTo(page.getByText("Today's scene").first());
  await sleep(3000);
  await moveTo(page.getByText('Your pace').first());
});
await scene('settings', async () => {
  await click(nav('Settings & Backup'));
  await sleep(1500);
  await scroll(1500, 12);
  await moveTo(page.getByRole('button', { name: /Choose a folder|Change folder/ }).first());
  await sleep(4000);
  await moveTo(page.getByRole('button', { name: /Word document/ }));
});
await scene('close', async () => {
  await click(nav('Home'));
  await sleep(2000);
  await moveTo(page.locator('.helper-card .btn').first());
});

await sleep(1200);
fs.writeFileSync(`${DIR}/starts.json`, JSON.stringify(starts, null, 1));
const video = page.video();
await ctx.close();
fs.copyFileSync(await video.path(), `${DIR}/raw.webm`);
await browser.close();
console.log('recorded', JSON.stringify(starts));
