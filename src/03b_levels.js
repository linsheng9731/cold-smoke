// Stable IDs are save-file keys. Terrain profiles are independent of developer variants.
const AdventureLevels = (() => {
  const chapters = [
    { id: 'pine', name: '松林营地', subtitle: '从第一道雪迹，到独自下山', released: true },
    { id: 'mist', name: '雾谷峡道', subtitle: '循着路标，进入山谷', released: true },
    { id: 'ridge', name: '暮光高脊', subtitle: '更高的山，留待下一程', released: false }
  ];
  const profile = (types, slope, width, forest, length = 480) => ({ types: types.split(','), slope, width, forest, length });
  const levels = [
    { id: 'pine-1', chapter: 'pine', name: '初雪入门', description: '沿宽缓雪道前进，穿过全部橙色旗门。', tip: '左右拖动转弯；按住加速，连续转弯控制速度。', seed: 183701,
      terrain: profile('bowl,bowl,rollers', 0.86, 1.5, 0.4), finish: 1450, gates: [[260, 0, 26], [650, -0.12, 24], [1050, 0.12, 24]], par: 130, limit: 300, maxCrashes: 2, landings: 0, time: 'day', weather: 'clear' },
    { id: 'pine-2', chapter: 'pine', name: '松林穿行', description: '在林间交替转弯，找到每一道旗门。', tip: '提前看向下一道旗门；转弯能控制速度。', seed: 294813,
      terrain: profile('bowl,glade,glade,bowl', 0.95, 1.15, 0.85), finish: 1900, gates: [[300, -0.25, 19], [720, 0.25, 19], [1180, -0.25, 19], [1570, 0.2, 19]], par: 165, limit: 360, maxCrashes: 1, landings: 0, time: 'day', weather: 'light' },
    { id: 'pine-3', chapter: 'pine', name: '雪脊起跳', description: '穿过旗门，并完成至少一次起跳后的落地。', tip: '按住跳蓄力，松开起跳；落地后才计入目标。', seed: 315927,
      terrain: profile('rollers,kickers,kickers,bowl', 0.96, 1.3, 0.55), finish: 1950, gates: [[310, 0, 23], [830, 0, 23], [1390, 0, 23]], par: 155, limit: 330, maxCrashes: 1, landings: 1, time: 'golden', weather: 'clear' },
    { id: 'pine-4', chapter: 'pine', name: '营地试炼', description: '连接坡面与连弯，在时限内通过全部旗门。', tip: '这是营地的综合挑战，不必满星也能解锁下一章。', seed: 426039,
      terrain: profile('bowl,rollers,gully,steeps,bowl', 1, 1.2, 0.7), finish: 2350, gates: [[370, 0.15, 20], [900, -0.2, 20], [1450, 0.15, 20], [1940, -0.1, 20]], par: 175, limit: 300, maxCrashes: 0, landings: 0, time: 'sunset', weather: 'light' },
    { id: 'mist-1', chapter: 'mist', name: '雾中路标', description: '跟随谷地旗门，在低能见度中抵达终点。', tip: '留意任务栏的左右提示，穿过橙色旗门。', seed: 537141,
      terrain: profile('gully,gully,ridge,gully,bowl', 1.03, 1.15, 0.65), finish: 2300, gates: [[340, -0.12, 18], [820, 0.12, 18], [1370, -0.12, 18], [1850, 0.12, 18]], par: 175, limit: 330, maxCrashes: 1, landings: 0, time: 'dawn', weather: 'heavy' }
  ];
  return { chapters, levels, get: id => levels.find(l => l.id === id) };
})();
