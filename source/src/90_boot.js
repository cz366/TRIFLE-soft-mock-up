/* ---------- boot ---------- */
(function () {
  const S = M.S;
  UI.buildRail([
    { group: '' }, { key: 'setup', label: 'Setup' }, { key: 'readiness', label: 'Readiness' }, { key: 'run', label: 'Run' }, { key: 'fractions', label: 'Fraction review' }, { key: 'record', label: 'Record' },
    ...(window.STAGE2 ? [{ group: 'Analysis' }, { key: 'calibration', label: 'Calibration' }, { key: 'comparison', label: 'Run comparison' }] : []),
    { group: 'Engineer', eng: true }, { key: 'engineer', label: 'Diagnostics', eng: true }
  ]);
  Q.init();
  if (window.innerWidth < 1600) Q.collapse(true);
  setInterval(() => { if (!UI.isFF()) { M.tick(0.1 * S.speed); M.emit('tick'); } }, S.tickMs);
  requestAnimationFrame(UI.frame);
  UI.go('setup');
})();
