const Equipment = (() => {
  const key = 'coldsmoke.equipment.v1', listeners = [];
  const E = { selected: 'ski', storageWarning: false };
  let writable = true;
  try {
    const raw = localStorage.getItem(key), value = raw && JSON.parse(raw);
    if (value && value.version !== 1) writable = false;
    if (value && value.version === 1 && ['ski', 'snowboard'].includes(value.selected)) E.selected = value.selected;
  } catch (_) {}
  E.current = () => typeof Game !== 'undefined' ? Game.equipment || E.selected : E.selected;
  E.label = id => id === 'snowboard' ? '单板' : '双板';
  E.key = (base, id = E.current()) => id === 'snowboard' ? base + '.snowboard.v1' : base;
  E.on = fn => listeners.push(fn);
  E.select = function (id) {
    if (!['ski', 'snowboard'].includes(id) || typeof Game !== 'undefined' && Game.mode !== 'title' || typeof UI !== 'undefined' && UI.state !== 'title') return false;
    if (id === E.selected) return true;
    E.selected = id;
    try { if (writable) localStorage.setItem(key, JSON.stringify({ version: 1, selected: id })); } catch (_) { E.storageWarning = true; }
    for (const fn of listeners) fn(id);
    return true;
  };
  const timeKey = 'coldsmoke.playtime.snowboard.v1'; let seconds = 0, saved = 0, timeWritable = true;
  try { const t = JSON.parse(localStorage.getItem(timeKey) || 'null'); if (t && t.version !== 1) timeWritable = false; else if (t && Number.isFinite(t.seconds) && t.seconds >= 0) seconds = t.seconds; } catch (_) {}
  E.saveTime = function () {
    if (!timeWritable || seconds === saved) return;
    try { localStorage.setItem(timeKey, JSON.stringify({ version: 1, seconds })); saved = seconds; } catch (_) {}
  };
  E.tick = function (dt) {
    if (E.current() !== 'snowboard' || Game.mode !== 'run' || !(dt > 0) || App.paused || App.swapping || UI.state !== 'run' || UI.open || UI.nativeHidden || typeof Photo !== 'undefined' && Photo.on) return;
    seconds += Math.min(dt, 0.25); if (seconds - saved >= 30) E.saveTime();
  };
  return E;
})();
