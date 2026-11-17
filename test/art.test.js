const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function artModule() {
  const context = vm.createContext({ self: {} });
  vm.runInContext(read('src/03c_art.js') + '\nglobalThis.art = Art;', context);
  return { art: context.art, self: context.self };
}

test('stable art map covers released levels, chapters, placeholders, and existing assets', () => {
  const { art } = artModule();
  assert.deepEqual(JSON.parse(JSON.stringify(art.chapters)), {
    pine: 'bg_zone_01_frost_valley',
    mist: 'bg_zone_02_north_face',
    ridge: 'bg_zone_03_sky_peak'
  });
  assert.deepEqual(Object.keys(art.levels), ['pine-1', 'pine-2', 'pine-3', 'pine-4', 'mist-1']);
  assert.deepEqual(JSON.parse(JSON.stringify(art.levels)), {
    'pine-1': { background: 'bg_track_pine_run', thumbnail: 'thumb_lv_01_01' },
    'pine-2': { background: 'bg_track_forest_canyon', thumbnail: 'thumb_lv_02_05' },
    'pine-3': { background: 'bg_track_pine_run_dusk', thumbnail: 'thumb_lv_01_02' },
    'pine-4': { background: 'bg_track_glacier_run_dusk', thumbnail: 'thumb_lv_01_06' },
    'mist-1': { background: 'bg_track_forest_canyon_storm', thumbnail: 'thumb_lv_02_08' }
  });
  assert.deepEqual(Object.keys(art.placeholders), ['mist-2', 'mist-3', 'mist-4', 'ridge-1', 'ridge-2', 'ridge-3', 'ridge-4']);
  assert.deepEqual(JSON.parse(JSON.stringify(art.placeholders)), {
    'mist-2': 'thumb_lv_02_01', 'mist-3': 'thumb_lv_02_02', 'mist-4': 'thumb_lv_02_03',
    'ridge-1': 'thumb_lv_03_01', 'ridge-2': 'thumb_lv_03_02', 'ridge-3': 'thumb_lv_03_03', 'ridge-4': 'thumb_lv_03_04'
  });
  for (const [id, mapping] of Object.entries(art.levels)) {
    assert.ok(art.files[mapping.background], id + ' background');
    assert.ok(art.files[mapping.thumbnail], id + ' thumbnail');
  }
  for (const [id, thumbnail] of Object.entries(art.placeholders)) assert.ok(art.files[thumbnail], id + ' placeholder');
  for (const file of Object.values(art.files)) assert.ok(fs.existsSync(path.join(root, file)), file);
  const bytes = Object.values(art.files).reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0);
  assert.ok(bytes < 2.5 * 1024 * 1024, 'art files total ' + bytes + ' bytes');
  for (const name of ['icon_star', 'icon_lock', 'icon_timer', 'icon_gate', 'icon_trophy', 'icon_snowflake']) {
    assert.doesNotMatch(read(art.files[name]), /<svg\b[^>]*\bcolor\s*=/i, name + ' root color');
  }
});

test('art URLs resolve to packaged relative paths or browser-inlined asset URLs', () => {
  const { art, self } = artModule();
  assert.equal(art.url('bg_zone_01_frost_valley'), art.files.bg_zone_01_frost_valley);
  self.COLD_SMOKE_ART = { bg_zone_01_frost_valley: 'data:image/webp;base64,AA==' };
  assert.equal(art.url('bg_zone_01_frost_valley'), 'data:image/webp;base64,AA==');
  assert.equal(art.url('missing'), '');
  assert.doesNotMatch(read('src/03c_art.js'), /\/home\//);
});
