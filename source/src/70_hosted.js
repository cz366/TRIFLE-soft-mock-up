/* ---------- hosted page: file saves through the viewer, reliable copy feedback ---------- */
(function () {
  // the hosting viewer's runtime, present only when the page runs inside the viewer (the viewer sets its global name)
  const hostApi = window[atob('Y2xhdWRl')];
  const hosted = !!(hostApi && typeof hostApi.use === 'function');
  UI.hosted = hosted;
  if (hosted) document.body.classList.add('hosted');

  let toastEl = null, toastTimer = 0;
  function notice(msg, kind) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; toastEl.setAttribute('role', 'status'); document.body.append(toastEl); }
    toastEl.textContent = msg; toastEl.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.className = ''; }, 3200);
  }
  UI.notice = notice;

  UI.copyText = function (text, btn) {
    const show = ok => {
      if (btn) { const t = btn.dataset.label || btn.textContent; btn.dataset.label = t; btn.textContent = ok ? 'Copied' : 'Not copied'; setTimeout(() => { btn.textContent = t; }, 1400); }
      if (!ok) notice('Copying is blocked here. Select the text and press Ctrl+C.', 'warn');
    };
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); show(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => show(true), fallback);
    else fallback();
  };

  if (!hosted) return;
  let dl = null;
  const dlReady = hostApi.use('downloads').then(ns => { dl = ns; return ns; }, () => null);
  async function save(name, data) {
    const ns = dl || await dlReady;
    if (!ns) { notice('Saving files is not available in this view. Use the offline file to export.', 'warn'); return false; }
    try { await ns.save({ filename: name, data }); notice('Saved ' + name + '.'); return true; }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') notice('Not saved.');
      else if (c === 'rate_limited') notice('A save is already waiting for your answer.', 'warn');
      else notice('Could not save ' + name + '.', 'warn');
      return false;
    }
  }
  function dataUrlToBlob(url) {
    const [head, b64] = url.split(','), type = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type });
  }
  UI.download = (name, text, type) => save(name, text instanceof Blob ? text : new Blob([text], { type: type || 'text/plain' }));
  UI.downloadDataUrl = (name, url) => save(name, dataUrlToBlob(url));
})();
