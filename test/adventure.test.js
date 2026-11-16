const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const PK = 'coldsmoke.adventure.v1', DK = 'coldsmoke.beta.entitlements.v1';
function harness(options = {}) {
  const data = { ...options.data }, calls = [], listeners = {};
  const c = vm.createContext({ console, URLSearchParams, self: { COLD_SMOKE: { betaPreview: options.beta !== false } },
    location: { search: '', pathname: '/' }, navigator: { language: 'en' },
    localStorage: { getItem: k => data[k] || null, setItem(k, v) { if (options.quota) throw Error('quota'); data[k] = v; }, removeItem: k => delete data[k] },
    addEventListener: (k, f) => { (listeners[k] ||= []).push(f); },
    Game: { s: { p: [0, 0, -14] }, mode: 'title', setView: () => {}, views: [] },
    Input: { reset() {} }, App: { paused: false, newMountain(seed, now, profile) { c.api.Course.profile = profile; c.api.Course.setSeed(seed); if (options.physics) c.Game.reset(); else c.Game.s.p = [c.api.Course.at(14, {}).cx, 0, -14]; } },
    UI: { state: 'run', open: false, nativeHidden: false }, Photo: { on: false },
    Sky: { clock: 620, times: { day: 620, golden: 969, sunset: 1110, dawn: 299 }, setClock(t) { this.clock = t; } },
    Weather: { level: 'light', auto: true, set(v) { this.level = v; this.auto = false; }, setAuto(v) { this.auto = v; } },
    Gates: { reset() {} } });
  const files = ['00_util.js', '00a_i18n.js', '00b_variants.js', '03_course.js', '03b_levels.js', ...(options.physics ? ['07_game.js'] : []), '07e_adventure.js'];
  vm.runInContext(files.map(f => read('src/' + f)).join('\n') + '\nglobalThis.api = { Adventure, AdventureLevels, Course, Variants, I18N, Game, Input };', c);
  c.Game = c.api.Game; c.Input = c.api.Input; c.Game.setView = () => {};
  const a = c.api.Adventure; a.init(); a.on(() => calls.push('change'));
  const begin = (id = 'pine-1') => { assert.equal(a.start(id), true); if (options.physics) c.Game.start(); else c.Game.mode = 'run'; a.activate(); return a.run; };
  const cross = (p, events = [], dt = 1) => { c.Game.s.p = [p.x, 0, -p.s - 0.1]; a.update(dt, events); };
  const complete = (id = 'pine-1') => { const r = begin(id); for (const p of r.checkpoints) cross(p, [{ type: 'takeoff' }, { type: 'land' }]); return r; };
  return { c, a, data, calls, begin, cross, complete, ...c.api };
}

test('five stable levels, distinct seeds/profiles, valid chapter metadata and bilingual copy', () => {
  const { AdventureLevels: d, I18N } = harness();
  assert.equal(d.levels.length, 5); assert.equal(new Set(d.levels.map(l => l.seed)).size, 5);
  assert.equal(new Set(d.levels.map(l => JSON.stringify(l.terrain))).size, 5);
  for (const l of d.levels) {
    assert.ok(l.finish > l.gates.at(-1)[0]); assert.ok(l.limit > l.par);
    for (const field of ['name', 'description', 'tip']) assert.notEqual(I18N.t(l[field]), l[field], field);
  }
  for (const l of d.chapters) for (const field of ['name', 'subtitle']) assert.notEqual(I18N.t(l[field]), l[field]);
});
test('terrain and checkpoint coordinates reproduce independently of developer terrain settings', () => {
  const h = harness();
  for (const l of h.AdventureLevels.levels) {
    h.Course.profile = l.terrain; h.Course.setSeed(l.seed);
    const samples = Array.from({ length: 61 }, (_, i) => { const s = i * 40, c = h.Course.at(s, {}); return [c.cx, c.hw, h.Course.height(c.cx, -s, 0.5)]; });
    h.Variants.val.terr = 'b'; h.Variants.val.tdiff = 'c'; h.Variants.val.slope = 'c'; h.Course.setSeed(l.seed);
    assert.deepEqual(Array.from({ length: 61 }, (_, i) => { const s = i * 40, c = h.Course.at(s, {}); return [c.cx, c.hw, h.Course.height(c.cx, -s, 0.5)]; }), samples);
    assert.ok(samples.flat().every(Number.isFinite));
    for (const [s, u, w] of l.gates) { const c = h.Course.at(s, {}); assert.ok(Math.abs(u * c.hw) < c.hw); assert.ok(w >= 18); }
  }
});
test('progression requires a clear, not full stars, and the beta sample also requires explicit demo unlock', () => {
  const h = harness(); assert.equal(h.a.access('pine-2'), 'progress'); assert.equal(h.a.tryUnlock(), false);
  for (const l of h.AdventureLevels.levels.slice(0, 4)) {
    const r = h.begin(l.id); r.elapsed = l.par + 1; r.crashes = l.maxCrashes + 1;
    for (const p of r.checkpoints) h.cross(p, [{ type: 'takeoff' }, { type: 'land' }]);
    assert.equal(r.result.stars, 1);
  }
  assert.equal(h.a.access('mist-1'), 'demo'); assert.equal(h.a.tryUnlock(), true); assert.equal(h.a.access('mist-1'), 'open');
  assert.equal(JSON.parse(h.data[DK]).mode, 'beta-preview'); assert.equal(h.a.access('mist-2'), 'unreleased');
});
test('line-segment crossing passes at speed, detects lateral misses, and only settles once', () => {
  const h = harness(), r = h.begin(), p = r.checkpoints[0];
  r.previous = [p.x - 80, p.s - 5]; h.c.Game.s.p = [p.x + 80, 0, -p.s - 5]; h.a.update(1, []);
  assert.equal(r.next, 1);
  const n = r.checkpoints[1]; h.c.Game.s.p = [n.x + n.half + 100, 0, -n.s - 1]; r.previous = [n.x + n.half + 100, n.s - 1]; h.a.update(1, []);
  assert.equal(r.status, 'failed'); assert.equal(r.result.reason, '错过旗门');
  const changes = h.calls.length; h.a.update(100, []); assert.equal(h.calls.length, changes); assert.equal(h.data[PK], undefined);
});
test('all checkpoints crossed by one segment are evaluated in order', () => {
  const h = harness(), r = h.begin();
  r.checkpoints = [{ s: 30, x: 0, half: 10 }, { s: 50, x: 0, half: 10 }, { s: 70, x: 0, half: 10 }];
  h.cross({ s: 90, x: 0 }); assert.equal(r.next, 3); assert.equal(r.status, 'completed');
});
test('only active gameplay counts time: pause, background, photo, loading and redraw do not', () => {
  const h = harness(), r = h.begin();
  for (const [o, k, v] of [[h.c.UI, 'open', true], [h.c.UI, 'nativeHidden', true], [h.c.App, 'paused', true], [h.c.App, 'swapping', {}], [h.c.Photo, 'on', true], [h.c.Game, 'mode', 'hold'], [h.c.UI, 'state', 'starting']]) {
    const old = o[k]; o[k] = v; h.a.update(10, []); o[k] = old;
  }
  h.a.update(0, []); assert.equal(r.elapsed, 0); h.a.update(0.5, []); assert.equal(r.elapsed, 0.5);
});
test('jump objective requires takeoff followed by landing, and missing it fails at finish', () => {
  const h = harness(); h.complete(); h.complete('pine-2');
  const r = h.begin('pine-3'); for (const p of r.checkpoints) h.cross(p, [{ type: 'land' }]);
  assert.equal(r.landings, 0); assert.equal(r.result.ok, false); assert.equal(r.result.reason, '尚未完成起跳落地');
  const retry = h.complete('pine-3'); assert.equal(retry.result.ok, true);
});
test('timeout fails without writing progress; retry has a fresh clock and checkpoints', () => {
  const h = harness(), r = h.begin(); h.a.update(r.level.limit + 1, []);
  assert.equal(r.result.reason, '超过时限'); const next = h.begin(); assert.equal(next.elapsed, 0); assert.equal(next.next, 0); assert.equal(h.data[PK], undefined);
});
test('save reload preserves bests, ignores malformed entries, and leaves existing settings untouched', () => {
  const h = harness({ data: { 'coldsmoke.lang': 'en', 'coldsmoke.skied': '{"261111":{"dist":100}}' } }); h.complete();
  const saved = h.data[PK], next = harness({ data: h.data }); assert.equal(next.a.access('pine-2'), 'open');
  assert.equal(next.data['coldsmoke.skied'], h.data['coldsmoke.skied']); assert.equal(next.data['coldsmoke.lang'], 'en');
  const r = next.begin(); r.elapsed = 90; r.crashes = 20; for (const p of r.checkpoints) next.cross(p);
  assert.deepEqual(JSON.parse(next.data[PK]).completed['pine-1'], JSON.parse(saved).completed['pine-1']);
  const bad = harness({ data: { [PK]: '{"version":1,"completed":{"pine-1":{"stars":9,"best":-1}}}' } }); assert.equal(bad.a.access('pine-2'), 'progress');
});
test('unknown future save versions are not overwritten; quota/corruption never crash gameplay', () => {
  const future = '{"version":20,"completed":{}}', h = harness({ data: { [PK]: future } }); h.complete(); assert.equal(h.data[PK], future); assert.equal(h.a.storageWarning, true);
  const quota = harness({ quota: true }); assert.equal(quota.complete().result.ok, true); assert.equal(quota.a.storageWarning, true);
  const broken = harness({ data: { [PK]: 'broken' } }); assert.equal(broken.a.storageWarning, true); assert.equal(broken.complete().result.ok, true);
});
test('preview entitlements are never honored or granted with beta mode disabled', () => {
  const h = harness(); for (const l of h.AdventureLevels.levels.slice(0, 4)) h.complete(l.id); h.a.tryUnlock();
  const production = harness({ beta: false, data: h.data }); assert.equal(production.a.demoUnlocked, false); assert.equal(production.a.access('mist-1'), 'demo'); assert.equal(production.a.tryUnlock(), false);
});
test('all new UI literal copy has English coverage; camera controls are hidden outside dev', () => {
  const { I18N } = harness(), source = read('src/19e_adventure_ui.js');
  for (const [, value] of source.matchAll(/'([^'\n]*[\u3400-\u9fff][^'\n]*)'/g)) assert.notEqual(I18N.t(value), value);
  assert.equal(I18N.t('继续滑'), 'Resume'); assert.equal(I18N.t('保存到相册'), 'Save to Photos');
  assert.match(read('template.html'), /#app:not\(\.dev\) \[data-sec="view"\]/); assert.match(read('src/19_ui.js'), /const views = \(\) => U.dev &&/);
  assert.ok(read('src/99_main.js').indexOf('Adventure.update(real, Game.events)') < read('src/99_main.js').indexOf('Game.events.length = 0'));
});
test('native English labels and iOS add-only permission descriptions are bundled as localized resources', () => {
  assert.match(read('android/app/src/main/res/values-en/strings.xml'), /Cold Smoke/);
  for (const key of ['package_name', 'custom_url_scheme']) assert.ok(read('android/app/src/main/res/values/strings.xml').includes('name="' + key + '" translatable="false"'));
  for (const lang of ['en', 'zh-Hans']) {
    const file = read('ios/App/App/' + lang + '.lproj/InfoPlist.strings');
    assert.match(file, /NSMotionUsageDescription/); assert.match(file, /NSPhotoLibraryAddUsageDescription/); assert.doesNotMatch(file, /NSPhotoLibraryUsageDescription/);
  }
  assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /InfoPlist.strings in Resources/);
});
test('all five levels can be cleared by the real ski physics without teleporting', { timeout: 240000 }, () => {
  const h = harness({ physics: true }), { Game, Input } = h.c;
  for (const l of h.AdventureLevels.levels) {
    if (l.chapter !== 'pine') h.a.tryUnlock();
    const r = h.begin(l.id), pc = {}, tn = {}, dt = 1 / 120;
    while (r.status === 'running' && r.elapsed <= l.limit + 1) {
      const S = Game.s, p = S.p, look = 10 + Math.max(S.speed, 4) * 0.9, c = h.Course.at(-p[2] + look, pc);
      let tx = c.cx;
      for (let k = 1; k <= 8; k++) { const qx = p[0] + (tx - p[0]) * k / 8, qz = p[2] - look * k / 8; h.Course.nearTree(qx, qz, tn); if (tn.ok && !tn.soft && tn.d < 3.4) tx += (qx >= tn.x ? 1 : -1) * (4.6 - tn.d) * (k < 3 ? 2.6 : 1.1); }
      Input.u = Math.max(-0.85, Math.min(0.85, (Math.atan2(tx - p[0], look) - Math.atan2(S.v[0], -S.v[2])) * 2.4));
      Input.jump = l.landings > 0 && r.elapsed % 6 < 0.7;
      Game.t += dt; Game.runT += dt; Game.step(dt, Input.u); h.a.update(dt, Game.events); Game.events.length = 0;
      assert.ok(S.p.every(Number.isFinite), l.id);
    }
    assert.equal(r.status, 'completed', l.id + ': ' + JSON.stringify({ result: r.result, position: Game.s.p, gates: r.next }));
  }
});
