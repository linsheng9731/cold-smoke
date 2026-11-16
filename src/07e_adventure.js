const Adventure = (() => {
  const PROGRESS = 'coldsmoke.adventure.v1', DEMO = 'coldsmoke.beta.entitlements.v1';
  const A = { run: null, progress: {}, demoUnlocked: false, storageWarning: false, compatible: true, listeners: [] };
  let initialized = false, environment = null;
  const beta = () => !!(self.COLD_SMOKE && self.COLD_SMOKE.betaPreview);
  const notify = () => { for (const f of A.listeners) f(); };
  const validTime = n => Number.isFinite(n) && n > 0;
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { A.storageWarning = true; return false; }
  }
  A.init = function () {
    if (initialized) return; initialized = true;
    try {
      const raw = localStorage.getItem(PROGRESS), p = raw ? JSON.parse(raw) : null;
      if (p && p.version !== 1) { A.compatible = false; A.storageWarning = true; }
      else if (p && p.completed && typeof p.completed === 'object') {
        for (const l of AdventureLevels.levels) {
          const r = p.completed[l.id];
          if (r && Number.isInteger(r.stars) && r.stars >= 1 && r.stars <= 3 && validTime(r.best)) A.progress[l.id] = { stars: r.stars, best: r.best };
        }
      }
      if (beta()) {
        const d = JSON.parse(localStorage.getItem(DEMO) || 'null');
        A.demoUnlocked = !!(d && d.version === 1 && d.mode === 'beta-preview' && d.unlocked === true);
      }
    } catch (e) { A.storageWarning = true; }
  };
  A.isBeta = beta;
  A.on = f => A.listeners.push(f);
  A.access = function (id) {
    A.init(); const l = AdventureLevels.get(id); if (!l) return 'unreleased';
    const index = AdventureLevels.levels.indexOf(l), prev = AdventureLevels.levels[index - 1];
    if (prev && !A.progress[prev.id]) return 'progress';
    if (l.chapter !== 'pine' && !(beta() && A.demoUnlocked)) return 'demo';
    return 'open';
  };
  A.tryUnlock = function () {
    A.init(); if (!beta() || !A.progress['pine-4']) return false;
    A.demoUnlocked = true;
    const saved = write(DEMO, { version: 1, mode: 'beta-preview', unlocked: true }); notify(); return saved;
  };
  A.stop = function () {
    A.run = null;
    if (environment) {
      Sky.setClock(environment.clock); Weather.set(environment.weather, true); Weather.setAuto(environment.auto); environment = null;
    }
    notify();
  };
  A.start = function (id) {
    if (A.access(id) !== 'open') return false;
    const level = AdventureLevels.get(id);
    if (!environment) environment = { clock: Sky.clock, weather: Weather.level, auto: Weather.auto };
    Game.mode = 'title';
    A.run = { level, status: 'ready', elapsed: 0, next: 0, landings: 0, crashes: 0, tookOff: false, previous: null, result: null };
    Sky.setClock(Sky.times[level.time]); Weather.set(level.weather, true);
    App.newMountain(level.seed, true, level.terrain);
    A.run.checkpoints = level.gates.map(([s, offset, half]) => ({ s, x: Course.at(s, {}).cx + offset * Course.at(s, {}).hw, half }));
    A.run.checkpoints.push({ s: level.finish, x: Course.at(level.finish, {}).cx, half: 28 });
    if (typeof Gates !== 'undefined') { Gates.markers = A.markers; Gates.reset(); }
    Input.reset(); Game.setView('chase', true); notify(); return true;
  };
  A.activate = function () {
    if (!A.run || A.run.status !== 'ready') return;
    A.run.status = 'running'; A.run.previous = [Game.s.p[0], -Game.s.p[2]]; notify();
  };
  A.leave = function () {
    A.stop(); if (typeof Gates !== 'undefined') { Gates.markers = null; Gates.reset(); }
    Game.mode = 'title'; App.newMountain(Course.mountains[0].seed, true);
  };
  A.markers = function (s0, s1, fn) {
    const r = A.run; if (!r || !r.checkpoints) return;
    for (const p of r.checkpoints) {
      if (p.s < s0 || p.s > s1) continue;
      fn(p.x - p.half, -p.s); fn(p.x + p.half, -p.s);
      fn(p.x - p.half, -p.s + 12); fn(p.x + p.half, -p.s + 12);
    }
  };
  function finish(ok, reason) {
    const r = A.run; if (!r || r.status !== 'running') return;
    r.status = ok ? 'completed' : 'failed';
    const stars = ok ? 1 + +(r.elapsed <= r.level.par) + +(r.crashes <= r.level.maxCrashes) : 0;
    r.result = { ok, reason, stars, time: r.elapsed, crashes: r.crashes };
    if (ok) {
      const old = A.progress[r.level.id];
      A.progress[r.level.id] = { stars: Math.max(stars, old ? old.stars : 0), best: Math.min(r.elapsed, old ? old.best : Infinity) };
      if (A.compatible) write(PROGRESS, { version: 1, completed: A.progress });
    }
    Game.mode = 'hold'; Input.reset(); notify();
  }
  A.update = function (dt, events) {
    const r = A.run;
    if (!r || r.status !== 'running' || !(dt > 0) || Game.mode !== 'run' || App.paused || App.swapping || UI.state !== 'run' || UI.open || UI.nativeHidden || (typeof Photo !== 'undefined' && Photo.on)) return;
    r.elapsed += dt;
    for (const ev of events) {
      if (ev.type === 'crash') { r.crashes++; r.tookOff = false; }
      else if (ev.type === 'takeoff') r.tookOff = true;
      else if (ev.type === 'land' && r.tookOff) { r.landings++; r.tookOff = false; }
    }
    const previous = r.previous, s = -Game.s.p[2], x = Game.s.p[0]; r.previous = [x, s];
    if (previous && s > previous[1]) {
      while (r.next < r.checkpoints.length) {
        const p = r.checkpoints[r.next]; if (s < p.s || previous[1] > p.s) break;
        const at = (p.s - previous[1]) / (s - previous[1]), crossX = previous[0] + (x - previous[0]) * at;
        if (Math.abs(crossX - p.x) > p.half) { finish(false, '错过旗门'); return; }
        r.next++;
      }
    }
    if (r.elapsed > r.level.limit) finish(false, '超过时限');
    else if (r.next === r.checkpoints.length) finish(r.landings >= r.level.landings, r.landings >= r.level.landings ? '目标完成' : '尚未完成起跳落地');
  };
  return A;
})();
