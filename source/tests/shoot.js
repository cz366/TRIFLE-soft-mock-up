// Usage: node shoot.js <html> <script-of-steps.json-ish via env>
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/node22/lib/node_modules/playwright'); } })();
(async () => {
  const file = process.argv[2], W = +(process.env.W || 1440), H = +(process.env.H || 900);
  const browser = await chromium.launch({ args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errs.push('NETWORK REQUEST: ' + r.url()); });
  await page.goto('file://' + file);
  const steps = require(process.env.STEPS);
  try { await steps(page, (n) => page.screenshot({ path: 'shots/' + n + '.png' })); }
  catch (e) { console.log('STEP FAILED: ' + e.message.split('\n')[0]); await page.screenshot({ path: 'shots/zz_fail.png' }); }
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await browser.close();
})();
