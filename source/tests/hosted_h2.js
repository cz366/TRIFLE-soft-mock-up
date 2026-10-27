module.exports = async (page, shot) => {
  const W = +(process.env.W || 400), tag = 'w' + W;
  const ev = f => page.evaluate(f);
  const ov = async name => { const r = await ev(() => { const vw = innerWidth; const bad = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); if (!r.width || r.right <= vw + 1) return false; return !e.closest('.tbl-wrap,.pb,.h-conn,#status,canvas,.ch-plot,#rail,.subtabs'); }).slice(0, 4).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 30) + '#' + e.id + ' r=' + Math.round(e.getBoundingClientRect().right)); return { docW: document.documentElement.scrollWidth, vw, bad }; }); if (r.docW > r.vw || r.bad.length) console.log('OVERFLOW', name, JSON.stringify(r)); else console.log('ok', name); };
  const nav = async k => { await page.click('#mMenu'); await page.waitForTimeout(150); await page.click('#rail .nav[data-go=' + k + ']'); await page.waitForTimeout(700); };
  await page.waitForTimeout(800); await ov('setup');
  await page.evaluate(() => { document.querySelector('#sTrained').click(); document.querySelector('#sIp').click(); });
  await page.click('#mMenu'); await page.click('#speedSeg button[data-v="60"]'); await page.keyboard.press('Escape');
  await nav('readiness'); await page.waitForTimeout(29000); await ov('readiness');
  const pmt = await page.$('#pmtChk'); if (pmt) await pmt.click();
  await nav('run'); await page.click('#rStart'); await page.waitForTimeout(2500); await ov('run-mid');
  await page.click('#rView'); await page.waitForTimeout(300); await ov('view menu'); await shot(tag + '_view'); await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
  await page.click('#rNote'); await page.waitForTimeout(300); await ov('note popover'); await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
  await page.evaluate(() => document.querySelector('#demoFF').click()); await page.waitForTimeout(9000); await ov('run-end'); await shot(tag + '_run');
  await nav('fractions'); await ov('fractions');
  const decb = await page.$('.decb'); if (decb) { await decb.click(); await page.waitForTimeout(300); await ov('decision popover'); await shot(tag + '_dec'); await page.mouse.click(5, 300); }
  for (const k of ['comparison', 'record']) { await nav(k); if (k === 'comparison') await page.waitForTimeout(8000); await ov(k); }
  await page.click('#hMock'); await page.waitForTimeout(500); await ov('about');
  // Engineer view: processing, Calibration and the HDF5 estimate
  await page.click('#mMenu'); await page.click('#engSwitch'); await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
  await nav('run'); await page.click('#rTools .btn.sm >> text=Processing'); await page.waitForTimeout(300); await ov('processing popover'); await shot(tag + '_proc'); await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
  await nav('calibration'); await ov('calibration');
  await nav('record'); const hb = await page.$('#recExports button >> text=Raw waveforms'); if (hb) { await hb.click(); await page.waitForTimeout(300); await ov('hdf5 modal'); await shot(tag + '_hdf5'); await page.keyboard.press('Escape'); }
  await nav('engineer');
  const tabs = await ev(() => [...document.querySelectorAll('#engTabs button')].map(b => b.dataset.v));
  for (const t of tabs) { await page.click('#engTabs button[data-v=' + t + ']'); await page.waitForTimeout(500); await ov('eng ' + t); }
  await shot(tag + '_disc');
  await page.click('#mQ'); await page.waitForTimeout(300); await ov('questions'); await shot(tag + '_q');
  await page.click('#qCollapse').catch(() => {});
  await page.click('#mMenu'); await page.waitForTimeout(200); await ov('menu drawer'); await shot(tag + '_menu');
};
