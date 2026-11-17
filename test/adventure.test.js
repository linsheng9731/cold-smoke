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
  const files = ['00_util.js', '00a_i18n.js', '00b_variants.js', '00c_equipment.js', '03_course.js', '03b_levels.js', ...(options.physics ? ['07_game.js'] : []), '07e_adventure.js'];
  vm.runInContext(files.map(f => read('src/' + f)).join('\n') + '\nglobalThis.api = { Adventure, AdventureLevels, Course, Variants, I18N, Game, Input, Equipment };', c);
  c.Game = c.api.Game; c.Input = c.api.Input; c.Game.setView = () => {};
  if (options.equipment) { c.UI.state = 'title'; c.api.Equipment.select(options.equipment); c.UI.state = 'run'; }
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
test('adventure initializes and rerenders on a legacy WebView without replaceChildren', () => {
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.classList = { toggle() {} }; }
    set textContent(value) { this.text = value; this.children = []; }
    append(...nodes) { this.children.push(...nodes); }
    addEventListener() {}
  }
  const { c } = harness(), elements = {};
  c.document = { getElementById: id => elements[id] || (elements[id] = new Element()), createElement: () => new Element() };
  c.App.onTick = [];
  vm.runInContext(read('src/19e_adventure_ui.js') + '\nglobalThis.adventureUI = AdventureUI;', c);
  c.adventureUI.init();
  const root = elements['adv-content'], count = root.children.length;
  assert.ok(count > 0); assert.equal(root.children.filter(n => n.className === 'adv-chapter').length, 3);
  assert.equal(root.children.flatMap(n => n.children).filter(n => n.dataset.level).length, 5);
  c.adventureUI.render(); assert.equal(root.children.length, count);
});
test('scripted camera views remain available while normal camera shortcuts are disabled', () => {
  const { c } = harness({ physics: true }), events = {};
  c.DEV = false; c.addEventListener = (type, fn) => { (events[type] ||= []).push(fn); };
  vm.runInContext(read('src/07b_views.js'), c);
  const key = (code, shiftKey = false) => events.keydown.forEach(fn => fn({ code, shiftKey }));
  for (const code of ['KeyV', 'Digit2', 'Numpad3']) { key(code); key(code, true); assert.equal(c.Game.view, 'chase'); }
  for (const id of ['fp', 'front', 'low', 'chase']) { assert.equal(c.Game.setView(id, true), id); assert.equal(c.Game.view, id); }
  c.DEV = true; key('KeyV'); assert.equal(c.Game.view, 'fp');
  assert.match(read('src/19_ui.js'), /U\.setView = function[^\n]+!U.dev/);
  assert.match(read('src/19_ui.js'), /U\.nextView = function[^\n]+!U.dev/);
});
test('mobile adventure HUD reserves space beneath speed and omits conflicting free-ski hints', () => {
  const template = read('template.html');
  assert.match(template, /#app\.adventure:not\(\.desk\) #adv-hud \{ top: calc\(var\(--gt\) \+ var\(--spd\) \* \.9 \+ 46px\)/);
  assert.match(template, /#app\.adventure #hint \{ display: none/);
  assert.match(template, /#app\.short #adv-hud \{ padding: 8px 12px; font-size: 11px/);
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
for (const equipment of ['ski', 'snowboard']) test('all five levels can be cleared by the real ' + equipment + ' physics without teleporting', { timeout: 240000 }, () => {
  const h = harness({ physics: true, equipment }), { Game, Input } = h.c;
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

test('equipment preference defaults safely, persists valid choices and protects future saves', () => {
  for (const value of [null, 'broken', '{"version":1,"selected":"sled"}', '{"version":8,"selected":"snowboard"}']) {
    const h = harness({ data: value ? { 'coldsmoke.equipment.v1': value } : {} });
    assert.equal(h.Equipment.selected, 'ski');
  }
  const h = harness(); h.c.UI.state = 'title';
  assert.equal(h.Equipment.select('snowboard'), true); assert.equal(harness({ data: h.data }).Equipment.selected, 'snowboard');
  h.c.Game.mode = 'run'; assert.equal(h.Equipment.select('ski'), false);
  assert.equal(h.Equipment.selected, 'snowboard');
  const future = '{"version":8,"selected":"ski"}', next = harness({ data: { 'coldsmoke.equipment.v1': future } });
  next.c.UI.state = 'title'; assert.equal(next.Equipment.select('snowboard'), true); assert.equal(next.data['coldsmoke.equipment.v1'], future);
  const quota = harness({ quota: true }); quota.c.UI.state = 'title'; assert.doesNotThrow(() => quota.Equipment.select('snowboard'));
  assert.equal(quota.Equipment.selected, 'snowboard');
});
test('equipment records preserve legacy skis, share unlocks and keep snowboard bests separate on reload', () => {
  const ski = harness(); ski.complete();
  const saved = ski.data[PK], boardKey = 'coldsmoke.adventure.snowboard.v1';
  const board = harness({ equipment: 'snowboard', data: ski.data });
  assert.equal(board.a.access('pine-2'), 'open'); assert.equal(board.a.record('pine-1'), undefined);
  board.complete(); assert.equal(board.data[PK], saved); assert.ok(JSON.parse(board.data[boardKey]).completed['pine-1']);
  assert.ok(board.a.record('pine-1', 'ski')); assert.ok(board.a.record('pine-1', 'snowboard'));
  board.complete('pine-2'); const reload = harness({ data: board.data });
  assert.equal(reload.a.access('pine-3'), 'open'); assert.equal(reload.a.record('pine-2', 'ski'), undefined);
  assert.ok(reload.a.record('pine-2', 'snowboard'));
  assert.equal(reload.Equipment.key('coldsmoke.daily', 'ski'), 'coldsmoke.daily');
  assert.equal(reload.Equipment.key('coldsmoke.skied', 'snowboard'), 'coldsmoke.skied.snowboard.v1');
  for (const id of ['pine-3', 'pine-4']) board.complete(id);
  assert.equal(board.a.tryUnlock(), true); assert.equal(harness({ data: board.data }).a.access('mist-1'), 'open');
});
test('future snowboard progress is not overwritten and corrupted snowboard saves do not erase ski progress', () => {
  const key = 'coldsmoke.adventure.snowboard.v1', future = '{"version":9,"completed":{}}';
  const h = harness({ equipment: 'snowboard', data: { [key]: future } }); h.complete(); assert.equal(h.data[key], future);
  const ski = harness(); ski.complete();
  const broken = harness({ data: { ...ski.data, [key]: 'bad' } }); assert.equal(broken.a.access('pine-2'), 'open');
});
test('snowboard has no pole events, strokes or hidden low-speed propulsion; skis retain their push-off', () => {
  const h = harness({ physics: true, equipment: 'snowboard' }), { Game, Input } = h;
  h.Course.height = () => 0; h.Course.normal = () => [0, 1, 0];
  h.Course.at = (_, o) => Object.assign(o || {}, { cx: 0, hw: 100, powder: 0, mog: 0, ridge: 0, rtail: 0 });
  h.Course.nearTree = (_, __, o) => { o.ok = false; }; h.Course.rockHit = () => false;
  Game.reset(); Game.events.length = 0; Game.start(); Input.tuck = true;
  for (let i = 0; i < 600; i++) Game.step(1 / 120, 0);
  assert.equal(Game.s.dpGo, 0); assert.equal(Game.s.dp, 0); assert.equal(Game.s.autoP, false);
  assert.ok(Math.hypot(Game.s.v[0], Game.s.v[2]) < 1e-9);
  assert.ok(!Game.events.some(e => ['pole', 'push'].includes(e.type)));
  const ski = harness({ physics: true }); ski.Game.reset(); ski.Game.start();
  assert.equal(ski.Game.s.dpGo, 3); assert.ok(ski.Game.events.some(e => e.type === 'push'));
});
test('regular snowboard stance fixes both feet to one board and keeps the head looking downhill', () => {
  const h = harness({ physics: true }); vm.runInContext(read('src/08_skier.js') + '\nglobalThis.rig = Skier;', h.c);
  for (const edge of [-0.6, 0, 0.6]) {
    const s = h.c.rig.solve({ equipment: 'snowboard', edge, crouch: 0.5, dp: 0.5, lead: 1, liftL: 1, liftR: 2, grabL: 1 });
    const a = s.J.footL, b = s.J.footR;
    assert.ok(Math.abs(a[0] - b[0]) < 1e-8); assert.ok(Math.abs(a[1] - b[1]) < 1e-8);
    assert.ok(Math.abs(b[2] - a[2] - 0.56) < 1e-8); assert.ok(a[2] < 0);
    assert.equal(s.J.plantedL + s.J.plantedR, 0); assert.equal(s.dp, null);
    assert.ok(s.hb.Z[2] > 0.9); assert.ok(s.F.filter(Boolean).every(m => m.every(Number.isFinite)));
  }
});
test('snowboard playtime is local and freezes for pause, background and photo mode', () => {
  const h = harness({ equipment: 'snowboard' }), E = h.Equipment; h.Game.mode = 'run';
  E.tick(0.2); h.c.App.paused = true; E.tick(0.2); h.c.App.paused = false;
  h.c.Photo.on = true; E.tick(0.2); h.c.Photo.on = false; h.c.UI.nativeHidden = true; E.tick(0.2);
  E.saveTime(); assert.equal(JSON.parse(h.data['coldsmoke.playtime.snowboard.v1']).seconds, 0.2);
  assert.equal(h.data['coldsmoke.playtime'], undefined);
});
test('snowboard never queues scores or minutes onto unsupported external ski leaderboards', async () => {
  const h = harness(), submissions = [];
  const section = { addEventListener() {}, classList: { contains: () => false } }, nav = {};
  h.c.document = { hidden: false, addEventListener() {}, getElementById: id => id === 'menu' ? { querySelector: sel => sel.includes('nav') ? nav : section } : null };
  h.c.window = { xhs: { miniTool: { submitScore: async s => submissions.push(s), getRankList: async () => ({}), getMyRank: async () => null } } };
  h.c.App.onTick = []; h.c.UI.sp = { run: { v: 30, air: 50 } };
  vm.runInContext(read('src/19b_rank.js'), h.c);
  const rank = h.c.self.Rank; rank.init(); h.Game.mode = 'run'; h.Game.equipment = 'snowboard';
  h.c.App.onTick.forEach(fn => fn(0.2)); await rank.flush(); assert.equal(submissions.length, 0);
  h.Game.equipment = 'ski'; h.c.App.onTick.forEach(fn => fn(0.2)); await rank.flush();
  assert.ok(submissions.some(s => s.board === 1)); assert.ok(submissions.some(s => s.board === 2));
});
test('all equipment UI and control hints have English translations', () => {
  const { I18N } = harness();
  for (const file of ['src/19f_equipment_ui.js', 'src/00c_equipment.js']) {
    for (const [, value] of read(file).matchAll(/'([^'\n]*[\u3400-\u9fff][^'\n]*)'/g)) assert.notEqual(I18N.t(value), value);
  }
  assert.match(read('src/19f_equipment_ui.js'), /e\.stopPropagation\(\)/);
  assert.match(read('src/19f_equipment_ui.js'), /e\.code === 'Space' \|\| e\.code === 'Enter'/);
});

test('equipment buttons keep their base and selected styles above the adventure menu reset', () => {
  const html = read('template.html');
  assert.match(html, /#menu \.equipment button\s*\{[^}]*border: 1px solid var\(--hair\)/);
  assert.match(html, /#menu \.equipment button\[aria-pressed="true"\]\s*\{[^}]*border-color: var\(--sun\); color: var\(--sun\)/);
});

test('equipment selector consumes pointer and keyboard activation without starting a run', () => {
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.handlers = {}; this.attrs = {}; this.isConnected = true; }
    appendChild(n) { this.children.push(n); n.parentNode = this; return n; }
    setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
    querySelectorAll(tag) { return this.children.filter(n => n.tagName.toLowerCase() === tag); }
    querySelector(tag) { return this.querySelectorAll(tag)[0]; }
    click() { if (!this.disabled) this.handlers.click({ stopPropagation() {} }); }
  }
  const h = harness(); h.c.UI.state = 'title';
  h.c.document = { createElement: tag => new Element(tag) };
  vm.runInContext(read('src/19f_equipment_ui.js') + '\nglobalThis.equipmentUI = EquipmentUI;', h.c);
  const group = h.c.equipmentUI.append(new Element()), [ski, board] = group.querySelectorAll('button');
  let stopped = 0, prevented = 0;
  group.handlers.pointerdown({ stopPropagation() { stopped++; } }); board.click();
  group.handlers.keydown({ code: 'Space', repeat: false, target: ski, stopPropagation() { stopped++; }, preventDefault() { prevented++; } });
  assert.equal(h.Game.mode, 'title'); assert.equal(h.Equipment.selected, 'ski'); assert.equal(stopped, 2); assert.equal(prevented, 1);
  h.Game.mode = 'run'; h.c.UI.state = 'run'; h.c.equipmentUI.refresh();
  assert.equal(board.disabled, true); assert.equal(ski.disabled, true);
});
