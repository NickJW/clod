// A/B/C test: does "Books and authors you love" change the prose, while keeping her voice?
import { createRequire } from 'module';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const KEY = process.env.KEY;
const NOTES = 'Nora goes back to the Salt House kitchen after dark. Her mother is still up, sitting at the table in the dark. Nora asks her about the letters she burned in the stove on Monday morning. Margaret deflects, then says one true thing about Tess. Nora notices the stove door is still warm.';
const CONDITIONS = {
  A: { influences: '' },
  B: { influences: "Daphne du Maurier's Rebecca: the house and the past pressing on the present, a narrator who doubts herself. Agatha Christie: clues hidden in plain sight, a solution that's obvious afterwards. Ann Cleeves: a small place where everyone knows everyone, weather as mood. I love slow, quiet dread and dry humour." },
  C: { influences: "Gillian Flynn's Gone Girl: an acid, darkly funny, confessional voice; sharp short sentences; characters who say the ugly thing out loud; dialogue like a knife fight. Lee Child's Jack Reacher books: terse, propulsive, blunt physical detail, no wasted words, momentum above everything." },
  D: { strong: true, influences: "Gillian Flynn's Gone Girl: an acid, darkly funny, confessional voice; sharp short sentences; characters who say the ugly thing out loud; dialogue like a knife fight. Lee Child's Jack Reacher books: terse, propulsive, blunt physical detail, no wasted words, momentum above everything." },
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' } });
const out = {};
for (const [name, cond] of Object.entries(CONDITIONS)) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, ignoreHTTPSErrors: true });
  await ctx.addInitScript((k) => {
    localStorage.setItem('nightjar:pref:ai', JSON.stringify({ providerId: 'gemini', creativity: 0.7, providers: { gemini: { apiKey: k, model: 'gemini-3.5-flash', fastModel: 'gemini-flash-lite-latest' } } }));
    localStorage.setItem('nightjar:pref:panelOpen', 'true');
    localStorage.setItem('nightjar:pref:pip:hello', JSON.stringify(new Date().toDateString()));
  }, KEY);
  const page = await ctx.newPage();
  const models = [];
  page.on('response', (r) => { const u = r.url(); if (u.includes(':streamGenerateContent')) models.push(`${u.split('/models/')[1].split(':')[0]}:${r.status()}`); });
  const idle = () => page.waitForFunction(() => !document.querySelector('.thread .typing'), null, { timeout: 300000 });
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Explore a demo novel first' }).click();
  await page.waitForTimeout(800);
  await page.locator('.nav button.nav-item', { hasText: 'Story Bible' }).click();
  await page.locator('button.tab', { hasText: 'Tone & feel' }).click();
  const inf = page.locator('label.field', { hasText: 'Your influences' }).locator('textarea');
  await inf.fill(cond.influences);
  if (cond.strong) await page.locator('button.chip', { hasText: 'Strong' }).click();
  await page.locator('label.field', { hasText: 'Your style guide' }).locator('textarea').fill('');
  let guide = '';
  if (cond.influences) {
    await page.getByRole('button', { name: 'Turn my influences into a style guide' }).click();
    await page.waitForTimeout(1500); await idle(); await page.waitForTimeout(400);
    guide = (await page.locator('.thread .md').first().innerText()).trim();
    await page.getByRole('button', { name: 'Use as my style guide' }).click();
    await page.waitForTimeout(500);
  }
  await page.locator('.nav button.nav-item', { hasText: 'Write' }).click();
  await page.locator('.ch-item', { hasText: 'Low Water' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.ai-modes button', { hasText: /^Write$/ }).click();
  await page.locator('.ai-compose textarea').fill(NOTES);
  await page.locator('.ai-compose .btn.primary').click();
  await page.waitForTimeout(1500); await idle(); await page.waitForTimeout(400);
  const prose = (await page.locator('.thread .prose-out').first().innerText().catch(() => '')).trim();
  out[name] = { guide, prose, models, influences: cond.influences, strong: !!cond.strong };
  console.log(name, 'models', models.join(' '), '| words', prose.split(/\s+/).length);
  await ctx.close();
}
fs.writeFileSync('' + (process.env.OUT || 'influence_out.json') + '', JSON.stringify(out, null, 1));
await b.close();
