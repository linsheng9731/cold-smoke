const Art = (() => {
  const files = {
    bg_zone_01_frost_valley: 'art/backgrounds/zones/bg_zone_01_frost_valley.webp',
    bg_zone_02_north_face: 'art/backgrounds/zones/bg_zone_02_north_face.webp',
    bg_zone_03_sky_peak: 'art/backgrounds/zones/bg_zone_03_sky_peak.webp',
    bg_track_pine_run: 'art/backgrounds/tracks/bg_track_pine_run.webp',
    bg_track_forest_canyon: 'art/backgrounds/tracks/bg_track_forest_canyon.webp',
    bg_track_pine_run_dusk: 'art/backgrounds/weather/bg_track_pine_run_dusk.webp',
    bg_track_glacier_run_dusk: 'art/backgrounds/weather/bg_track_glacier_run_dusk.webp',
    bg_track_forest_canyon_storm: 'art/backgrounds/weather/bg_track_forest_canyon_storm.webp',
    thumb_lv_01_01: 'art/thumbnails/thumb_lv_01_01.webp',
    thumb_lv_02_05: 'art/thumbnails/thumb_lv_02_05.webp',
    thumb_lv_01_02: 'art/thumbnails/thumb_lv_01_02.webp',
    thumb_lv_01_06: 'art/thumbnails/thumb_lv_01_06.webp',
    thumb_lv_02_08: 'art/thumbnails/thumb_lv_02_08.webp',
    thumb_lv_02_01: 'art/thumbnails/thumb_lv_02_01.webp',
    thumb_lv_02_02: 'art/thumbnails/thumb_lv_02_02.webp',
    thumb_lv_02_03: 'art/thumbnails/thumb_lv_02_03.webp',
    thumb_lv_03_01: 'art/thumbnails/thumb_lv_03_01.webp',
    thumb_lv_03_02: 'art/thumbnails/thumb_lv_03_02.webp',
    thumb_lv_03_03: 'art/thumbnails/thumb_lv_03_03.webp',
    thumb_lv_03_04: 'art/thumbnails/thumb_lv_03_04.webp',
    icon_star: 'art/icons/icon_star.svg',
    icon_lock: 'art/icons/icon_lock.svg',
    icon_timer: 'art/icons/icon_timer.svg',
    icon_gate: 'art/icons/icon_gate.svg',
    icon_trophy: 'art/icons/icon_trophy.svg',
    icon_snowflake: 'art/icons/icon_snowflake.svg',
    tex_frost: 'art/textures/tex_frost.webp'
  };
  const chapters = {
    pine: 'bg_zone_01_frost_valley',
    mist: 'bg_zone_02_north_face',
    ridge: 'bg_zone_03_sky_peak'
  };
  const levels = {
    'pine-1': { background: 'bg_track_pine_run', thumbnail: 'thumb_lv_01_01' },
    'pine-2': { background: 'bg_track_forest_canyon', thumbnail: 'thumb_lv_02_05' },
    'pine-3': { background: 'bg_track_pine_run_dusk', thumbnail: 'thumb_lv_01_02' },
    'pine-4': { background: 'bg_track_glacier_run_dusk', thumbnail: 'thumb_lv_01_06' },
    'mist-1': { background: 'bg_track_forest_canyon_storm', thumbnail: 'thumb_lv_02_08' }
  };
  const placeholders = {
    'mist-2': 'thumb_lv_02_01',
    'mist-3': 'thumb_lv_02_02',
    'mist-4': 'thumb_lv_02_03',
    'ridge-1': 'thumb_lv_03_01',
    'ridge-2': 'thumb_lv_03_02',
    'ridge-3': 'thumb_lv_03_03',
    'ridge-4': 'thumb_lv_03_04'
  };
  return {
    files, chapters, levels, placeholders,
    url: name => (self.COLD_SMOKE_ART && self.COLD_SMOKE_ART[name]) || files[name] || ''
  };
})();
