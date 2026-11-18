const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function ui() {
  const calls = [];
  const context = vm.createContext({
    self: {}, window: {}, document: {}, performance: { now: () => 0 },
    App: {}, Input: { reset: () => calls.push('reset') },
    Sound: { unlocked: true, ctx: {
      suspend: async () => calls.push('suspend'), resume: async () => calls.push('resume')
    } },
    Photo: { on: false, exit: () => calls.push('exit-photo') }
  });
  vm.runInContext(read('src/19_ui.js') + '\nglobalThis.UI = UI;', context);
  return { context, UI: context.UI, calls };
}

test('native backgrounding freezes rendering, clears input and suspends audio', () => {
  const { context, UI, calls } = ui();
  UI.pause = () => calls.push('pause');
  UI.nativeActive(false);
  assert.equal(context.App.paused, true);
  assert.equal(UI.nativeHidden, true);
  assert.deepEqual(calls, ['reset', 'pause', 'suspend']);
});

test('foregrounding restores rendering without resuming the paused run', () => {
  const { context, UI, calls } = ui();
  UI.open = true;
  UI.nativeActive(true);
  assert.equal(context.App.paused, false);
  assert.equal(UI.open, true);
  assert.deepEqual(calls, ['resume']);
});

test('foregrounding never revives a lost graphics device', () => {
  const { context, UI, calls } = ui();
  context.App.paused = true; UI.gone = true;
  UI.nativeActive(true);
  assert.equal(context.App.paused, true);
  assert.deepEqual(calls, []);
});

test('Android back exits photo mode before touching the menu', () => {
  const { context, UI, calls } = ui();
  context.Photo.on = true;
  assert.equal(UI.nativeBack(), true);
  assert.deepEqual(calls, ['exit-photo']);
});

test('Android back closes an open menu', () => {
  const { UI, calls } = ui();
  UI.open = true; UI.menu = value => calls.push(value);
  assert.equal(UI.nativeBack(), true);
  assert.deepEqual(calls, [false]);
});

test('Android back pauses a run, or allows minimizing from the title', () => {
  const { UI } = ui();
  UI.pause = () => true;
  assert.equal(UI.nativeBack(), true);
  UI.pause = () => false;
  assert.equal(UI.nativeBack(), false);
});

test('input reset releases every held control and recenters tilt', () => {
  const c = vm.createContext({ self: {}, Variants: { def() {} } });
  vm.runInContext(read('src/07_game.js').split('const Game =')[0] + '\nglobalThis.Input = Input;', c);
  const i = c.Input;
  i.keys.Space = true; i.drag = { id: 1 }; i.btn.jump = i.btn.tuck = i.jump = i.tuck = true;
  for (const key of ['u', 'fa', 'faV', 'faT', 'kb', 'kbV', 'kHeld', 'kWas']) i[key] = 1;
  i.reset();
  assert.equal(Object.keys(i.keys).length, 0);
  assert.equal(i.drag, null);
  assert.equal(i.btn.jump || i.btn.tuck || i.jump || i.tuck, false);
  for (const key of ['u', 'fa', 'faV', 'faT', 'kb', 'kbV', 'kHeld', 'kWas']) assert.equal(i[key], 0, key);
  assert.equal(i.zeroPending, true);
});

function bridge(native = true, platform = 'android') {
  const listeners = {}, calls = [];
  const c = vm.createContext({
    self: {}, window: {}, document: { getElementById: () => ({ classList: { add() {} } }) },
    Capacitor: { isNativePlatform: () => native, getPlatform: () => platform },
    App: { addListener: async (event, cb) => { listeners[event] = cb; },
      getState: async () => ({ isActive: true }), minimizeApp: async () => calls.push('minimize') },
    Directory: { Cache: 'CACHE' },
    Filesystem: { readdir: async () => ({ files: [] }), writeFile: async options => { calls.push(['write', options]); return { uri: 'file:///cache/picture.png' }; },
      deleteFile: async options => calls.push(['delete', options]) },
    Share: { share: async options => calls.push(['share', options]) },
    FileReader: class { readAsDataURL() { this.result = 'data:image/png;base64,cGljdHVyZQ=='; this.onload(); } }
  });
  vm.runInContext(read('mobile/native.js').replace(/^import .*;\n/gm, ''), c);
  return { c, api: c.window.ColdSmokeMobile, listeners, calls };
}

test('native bridge registers lifecycle and back handlers only once', async () => {
  const { api, listeners, calls } = bridge();
  const active = [];
  const hooks = { onActive: v => active.push(v), onBack: () => false };
  await api.init(hooks); await api.init(hooks);
  assert.deepEqual(active, [true]);
  listeners.appStateChange({ isActive: false });
  assert.deepEqual(active, [true, false]);
  await listeners.backButton();
  assert.deepEqual(calls, ['minimize']);
});

test('handled Android back does not minimize', async () => {
  const { api, listeners, calls } = bridge();
  await api.init({ onActive() {}, onBack: () => true });
  await listeners.backButton();
  assert.deepEqual(calls, []);
});

test('iOS does not register Android back handling', async () => {
  const { api, listeners } = bridge(true, 'ios');
  await api.init({ onActive() {}, onBack() {} });
  assert.equal(listeners.backButton, undefined);
});

test('browser preview never invokes native APIs', async () => {
  const { api, listeners } = bridge(false);
  await api.init({ onActive() { throw new Error('native call in browser'); } });
  assert.deepEqual(Object.keys(listeners), []);
});

test('photo sharing uses a sanitized unique cache file and keeps it readable by Android receivers', async () => {
  const { api, calls } = bridge();
  await api.sharePhoto({}, '../picture.png');
  assert.equal(calls[0][0], 'write');
  assert.match(calls[0][1].path, /^photos\/\d+-\.\._picture.png$/);
  assert.equal(calls[0][1].data, 'cGljdHVyZQ==');
  assert.equal(calls[1][0], 'share');
  assert.equal(calls[1][1].files[0], 'file:///cache/picture.png');
  assert.equal(calls.length, 2);
});

test('cancelled or failed sharing still cleans the temporary file', async () => {
  const { c, api, calls } = bridge();
  c.Share.share = async () => { throw new Error('cancelled'); };
  await assert.rejects(api.sharePhoto({}, 'picture.png'), /cancelled/);
  assert.equal(calls.at(-1)[0], 'delete');
});

test('native startup cleans only expired photos from its own cache directory', async () => {
  const { c, api, calls } = bridge();
  c.Filesystem.readdir = async () => ({ files: [
    { name: 'old.png', type: 'file', mtime: Date.now() - 86400001 },
    { name: 'recent.png', type: 'file', mtime: Date.now() },
    { name: 'folder', type: 'directory', mtime: 0 }
  ] });
  await api.init({ onActive() {}, onBack() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'delete');
  assert.equal(calls[0][1].path, 'photos/old.png');
});

test('a failed photo write does not permanently lock sharing', async () => {
  const { c, api } = bridge();
  c.Filesystem.writeFile = async () => { throw new Error('disk full'); };
  await assert.rejects(api.sharePhoto({}, 'picture.png'), /disk full/);
  await assert.rejects(api.sharePhoto({}, 'picture.png'), /disk full/);
});

test('offline build contains a full document, local fonts, CSP and no remote font loader', () => {
  execFileSync(process.execPath, ['tools/build-mobile.js'], { cwd: root });
  const html = read('dist-mobile/index.html'), game = read('dist-mobile/game.js');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /fonts\/fonts.css/);
  assert.doesNotMatch(game, /fonts\.googleapis\.com|director mode renders/i);
  assert.ok(fs.existsSync(path.join(root, 'dist-mobile/art/backgrounds/zones/bg_zone_01_frost_valley.webp')));
  assert.match(game, /art\/backgrounds\/zones\/bg_zone_01_frost_valley\.webp/);
  assert.doesNotMatch(game, /data:image\/webp;base64/);
  const xhsBuild = read('tools/build-xhs.js');
  assert.match(xhsBuild, /path\.join\(root, 'art'\)/);
  assert.match(xhsBuild, /filter:\s*src\s*=>\s*fs\.statSync\(src\)\.isDirectory\(\)/);
  assert.match(xhsBuild, /webp\|png\|svg/);
  assert.doesNotMatch(html, /<script>/);
  new vm.Script(game);
  new vm.Script(read('dist-mobile/native.js'));
  for (const font of ['Jost', 'CormorantGaramond', 'NotoSerifSC']) {
    assert.ok(fs.statSync(path.join(root, 'dist-mobile/fonts', font + '.woff2')).size > 0);
    assert.ok(read('dist-mobile/licenses/' + font + '-OFL.txt').includes('SIL OPEN FONT LICENSE'));
  }
  assert.match(html, /url\(fonts\/BarlowCondensed-BlackItalic\.woff2\)/);
  assert.ok(fs.statSync(path.join(root, 'dist-mobile/fonts/BarlowCondensed-BlackItalic.woff2')).size > 0);
  assert.match(read('dist-mobile/licenses/Barlow-OFL.txt'), /SIL OPEN FONT LICENSE/);
});

test('existing dependency-free web build remains separate from the native bridge', () => {
  execFileSync(process.execPath, ['build.js'], { cwd: root });
  const html = read('dist/index.html');
  assert.match(html, /fonts\.googleapis\.com/);
  const match = html.match(/self\.COLD_SMOKE_ART = (\{.*?\});/s);
  assert.ok(match);
  const inlineArt = JSON.parse(match[1]);
  assert.ok(Object.keys(inlineArt).length > 20);
  for (const value of Object.values(inlineArt)) assert.match(value, /^data:image\/(?:webp|svg\+xml);base64,/);
  assert.match(inlineArt.bg_zone_01_frost_valley, /^data:image\/webp;base64,/);
  assert.doesNotMatch(html, /\/home\/ubuntu\//);
  assert.doesNotMatch(html, /src="native\.js"/);
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  new vm.Script(script);
});

test('native configuration serves bundled files without a remote server', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.webDir, 'dist-mobile');
  assert.equal(config.server, undefined);
  assert.equal(config.android.allowMixedContent, false);
  assert.equal(config.loggingBehavior, 'debug');
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /sensorLandscape/);
  assert.doesNotMatch(read('ios/App/App/Info.plist'), /UIInterfaceOrientationPortrait/);
  assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /PrivacyInfo.xcprivacy in Resources/);
});

test('release packaging fails before Gradle when signing credentials are absent', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('COLD_SMOKE_')));
  const result = spawnSync(process.execPath, ['tools/android-build.js', 'bundleRelease'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing release signing variable: COLD_SMOKE_KEYSTORE/);
});

test('iOS hides the Home indicator through the supported SystemBars configuration', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.plugins.SystemBars.hidden, true);
  assert.doesNotMatch(read('ios/App/App/SceneDelegate.swift'), /override var prefersHomeIndicatorAutoHidden/);
});

test('Android build helper rejects unexpected Gradle tasks', () => {
  const result = spawnSync(process.execPath, ['tools/android-build.js', 'unknown'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown Android build task/);
});

test('iOS photo saving declares add-only library access without library read access', () => {
  const plist = read('ios/App/App/Info.plist');
  assert.match(plist, /<key>NSPhotoLibraryAddUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
  assert.doesNotMatch(plist, /<key>NSPhotoLibraryUsageDescription<\/key>/);
});
