const AdventureUI = (() => {
  const V = {}, T = s => I18N.t(s), $ = id => document.getElementById(id);
  let offer = false, root, hud, hudTitle, hudGoal, hudGuide, hudClock, acc = 0, chapterId = 'pine', selectedId = null;
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const time = seconds => Math.floor(Math.max(0, seconds) / 60) + ':' + Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  const access = id => Adventure.access(id);
  const select = id => { if (!AdventureLevels.get(id)) return; selectedId = id; chapterId = AdventureLevels.get(id).chapter; V.render(true); };
  const button = (text, fn, primary) => {
    const b = node('button', T(text), primary ? 'adv-button primary' : 'adv-button'); b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b;
  };
  function defaults() {
    const run = Adventure.run;
    if (run) { selectedId = run.level.id; chapterId = run.level.chapter; return; }
    const open = AdventureLevels.levels.filter(l => access(l.id) === 'open');
    const next = open.find(l => !Adventure.cleared(l.id));
    selectedId = (next || open.at(-1) || AdventureLevels.levels[0]).id;
    chapterId = AdventureLevels.get(selectedId).chapter;
  }
  function cardImage(name, cls, lazy = true) {
    const img = node('img', '', cls); img.alt = ''; img.decoding = 'async';
    img.loading = lazy ? 'lazy' : 'eager';
    const src = Art.url(name);
    if (src) img.src = src; else img.classList.add('missing-art');
    img.addEventListener('error', () => { img.removeAttribute('src'); img.classList.add('missing-art'); });
    return img;
  }
  function begin(id) { if (access(id) === 'open') { offer = false; UI.beginAdventure(id); } }
  function nextLevel(id) {
    const state = access(id);
    if (state === 'open') begin(id);
    else { offer = state === 'demo'; select(id); }
  }
  V.init = function () {
    root = $('adv-content'); hud = $('adv-hud'); hudTitle = $('adv-title'); hudGoal = $('adv-goal'); hudGuide = $('adv-guide'); hudClock = $('adv-clock');
    Adventure.init(); defaults(); Adventure.on(() => { V.render(); V.frame(1); }); I18N.on(() => { V.render(); V.frame(1); });
    App.onTick.push(V.frame); V.render();
  };
  V.render = function (scrollSelected = false) {
    if (!root) return;
    if (!selectedId || (!AdventureLevels.get(selectedId) && !Art.placeholders[selectedId])) defaults();
    root.textContent = '';
    const r = Adventure.run, result = r && r.result;
    $('app').classList.toggle('adventure', !!r); $('m-go').hidden = !!result;
    if (result) {
      const card = node('div', '', 'adv-result'), title = node('h2', T(result.ok ? '关卡完成' : '再试一次'));
      if (result.ok) { const trophy = cardImage('icon_trophy', 'adv-icon', false); trophy.alt = ''; card.appendChild(trophy); }
      card.append(title, node('p', T(r.level.name) + ' · ' + T(Equipment.label(r.equipment)) + ' · ' + T(result.reason)));
      card.append(node('p', (result.ok ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) + ' · ' : '') + T('用时') + ' ' + time(result.time) + ' · ' + T('碰撞') + ' ' + result.crashes));
      const row = node('div', '', 'adv-actions');
      row.append(button('重试', () => begin(r.level.id), !result.ok));
      const next = AdventureLevels.levels[AdventureLevels.levels.indexOf(r.level) + 1];
      if (result.ok && next) row.append(button('下一关', () => nextLevel(next.id), true));
      if (result.ok && !next) card.append(node('p', T('体验内容已全部完成')));
      row.append(button('自由滑', () => UI.freeSki())); card.append(row); root.append(card);
    }
    const tabs = node('div', '', 'adv-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const c of AdventureLevels.chapters) {
      const b = node('button', T(c.name), chapterId === c.id ? 'adv-tab on' : 'adv-tab'); b.type = 'button';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(chapterId === c.id)); b.dataset.chapter = c.id;
      b.addEventListener('click', e => {
        e.stopPropagation(); chapterId = c.id;
        const available = AdventureLevels.levels.find(l => l.chapter === c.id);
        selectedId = available ? (AdventureLevels.get(selectedId)?.chapter === c.id ? selectedId : available.id) : c.id + '-1';
        V.render();
      });
      tabs.appendChild(b);
    }
    root.append(tabs);
    const chapter = AdventureLevels.chapters.find(c => c.id === chapterId) || AdventureLevels.chapters[0];
    const level = AdventureLevels.get(selectedId);
    const map = level ? Art.levels[level.id] : null, background = Art.url(map ? map.background : Art.chapters[chapterId]);
    root.style.setProperty('--adv-art', background ? 'url("' + background + '")' : 'none');
    const hero = node('div', '', 'adv-hero');
    const detail = node('div', '', 'adv-detail');
    let start;
    if (level) {
      const current = Equipment.current(), record = Adventure.record(level.id, current), state = access(level.id);
      const title = node('h2', T(level.name), 'adv-level-title');
      detail.append(title, node('p', T(level.description), 'adv-description'));
      const equipment = node('div', '', 'adv-equipment');
      const star = cardImage('icon_star', 'adv-icon', false), timer = cardImage('icon_timer', 'adv-icon', false);
      star.alt = ''; timer.alt = '';
      equipment.append(node('b', T(Equipment.label(current))), star, node('span', record ? '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : '☆☆☆'),
        timer, node('small', record ? T('最佳') + ' ' + time(record.best) : T('尚无记录')));
      detail.appendChild(equipment);
      const conditions = node('div', '', 'adv-conditions');
      const timeName = { day: '白天', golden: '傍晚', sunset: '日落', dusk: '黄昏', night: '夜晚', dawn: '黎明' }[level.time] || '白天';
      const snow = cardImage('icon_snowflake', 'adv-icon', false); snow.alt = '';
      conditions.append(node('span', T('环境')), node('b', T(timeName)), snow, node('b', T(level.weather === 'clear' ? '晴' : level.weather === 'light' ? '小雪' : '大雪')));
      detail.append(conditions, node('p', T(level.tip), 'adv-tip'));
      const objective = node('p', '', 'adv-challenge');
      const gate = cardImage('icon_gate', 'adv-icon', false); gate.alt = '';
      objective.append(gate, node('span', T('可选挑战') + ' · ' + T('目标用时') + ' ' + time(level.par) + ' · ' + T('碰撞不超过') + ' ' + level.maxCrashes + (level.landings ? ' · ' + T('起跳落地') + ' ' + level.landings : '')));
      detail.appendChild(objective);
      if (state === 'progress') detail.appendChild(node('p', T('先完成上一关'), 'adv-lock-reason'));
      else if (state === 'demo') detail.appendChild(node('p', T(Adventure.isBeta() ? '体验解锁（不扣费）' : '开发中'), 'adv-lock-reason'));
      else if (state === 'unreleased') detail.appendChild(node('p', T('开发中'), 'adv-lock-reason'));
      start = button(state === 'open' ? '开始挑战' : state === 'demo' ? '体验解锁（不扣费）' : state === 'unreleased' ? '开发中' : '先完成上一关',
        () => { if (state === 'open') begin(level.id); }, true);
      start.classList.add('adv-start'); start.disabled = state !== 'open';
    } else {
      detail.append(node('h2', T(chapter.name), 'adv-level-title'), node('p', T(chapter.subtitle), 'adv-description'),
        node('p', T('开发中') + ' · ' + T('开发中关卡'), 'adv-lock-reason'));
    }
    hero.appendChild(detail); root.appendChild(hero);
    if (chapterId === 'mist' && Adventure.isBeta()) {
      const box = node('div', '', 'adv-offer');
      box.append(node('h3', T('内测演示，不会扣费')), node('p', T('解锁第二章样例关，体验后续冒险。')),
        node('p', T('仅解锁本次已完成的1个样例关；其余7关仍在开发。'), 'adv-note'));
      if (Adventure.demoUnlocked) box.appendChild(node('p', T('已体验解锁 · 不扣费')));
      else if (!Adventure.cleared('pine-4')) box.appendChild(node('p', T('先完成第一章，再体验解锁。'), 'adv-note'));
      else if (offer) {
        const row = node('div', '', 'adv-actions');
        row.append(button('体验解锁（不扣费）', () => { Adventure.tryUnlock(); offer = false; V.render(); }, true), button('暂不解锁', () => { offer = false; V.render(); }));
        box.appendChild(row);
      } else box.appendChild(button('体验解锁（不扣费）', () => { offer = true; V.render(); }));
      root.appendChild(box);
    }
    const row = node('div', '', 'adv-level-row');
    row.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    let touchX = null, suppressUntil = 0;
    row.addEventListener('touchstart', e => { touchX = e.touches[0]?.clientX ?? null; }, { passive: true });
    row.addEventListener('touchend', e => {
      if (touchX != null && e.changedTouches[0] && Math.abs(e.changedTouches[0].clientX - touchX) > 10) suppressUntil = Date.now() + 350;
      touchX = null;
    }, { passive: true });
    for (let i = 1; i <= 4; i++) {
      const id = chapter.id + '-' + i, playable = AdventureLevels.get(id), placeholder = Art.placeholders[id], art = playable ? Art.levels[id] : null;
      const c = node('button', '', playable ? 'adv-card' : 'adv-card placeholder'); c.type = 'button'; c.dataset.level = id; c.disabled = !playable;
      if (playable) {
        if (art) c.appendChild(cardImage(art.thumbnail, 'adv-thumb'));
        else c.appendChild(node('div', '', 'adv-thumb missing-art'));
        const state = access(id), rec = Adventure.record(id, Equipment.current());
        c.append(node('span', String(i).padStart(2, '0'), 'adv-card-number'), node('b', T(playable.name), 'adv-card-name'));
        if (rec) c.appendChild(node('span', '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars), 'adv-card-stars'));
        if (state !== 'open') {
          const lock = cardImage('icon_lock', 'adv-lock-icon'); lock.alt = T('锁定'); c.append(lock);
          c.appendChild(node('small', T(state === 'progress' ? '先完成上一关' : '体验解锁（不扣费）'), 'adv-card-lock'));
        }
        if (id === selectedId) c.classList.add('selected');
        c.addEventListener('click', e => {
          e.stopPropagation(); if (Date.now() < suppressUntil) return;
          select(id);
          requestAnimationFrame(() => root.querySelector('.adv-card.selected')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
        });
      } else {
        if (placeholder) c.appendChild(cardImage(placeholder, 'adv-thumb', true));
        c.append(node('span', String(i).padStart(2, '0'), 'adv-card-number'), node('b', T('开发中'), 'adv-card-name'));
        c.appendChild(node('small', T('开发中'), 'adv-card-lock'));
      }
      row.appendChild(c);
    }
    root.appendChild(row);
    const footer = node('div', '', 'adv-footer');
    footer.append(node('p', T('通关即可前进，满星不是解锁条件。') + ' ' + T('解锁共用，星级和最佳用时按器材分别记录。'), 'adv-note'),
      node('p', T('进度仅保存在本机，卸载可能丢失。'), 'adv-note'));
    if (start) footer.appendChild(start);
    root.appendChild(footer);
    if (Adventure.storageWarning) root.append(node('p', T('无法保存进度，本次仍可游玩。'), 'adv-warning'));
    if (scrollSelected) requestAnimationFrame(() => root.querySelector('.adv-card.selected')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
  };
  V.frame = function (dt) {
    if (!hud) return;
    const r = Adventure.run; hud.hidden = !r;
    if (!r) return;
    if (r.result && UI.state === 'run' && !UI.open) UI.menu('adventure');
    acc += dt; if (acc < 0.12) return; acc = 0;
    hudTitle.textContent = T(r.level.name);
    hudGoal.textContent = T('旗门') + ' ' + r.next + '/' + (r.checkpoints ? r.checkpoints.length : r.level.gates.length + 1) + (r.level.landings ? ' · ' + T('起跳落地') + ' ' + r.landings + '/' + r.level.landings : '');
    const p = r.checkpoints && r.checkpoints[r.next];
    if (p) {
      const dx = p.x - Game.s.p[0], d = Math.max(0, p.s + Game.s.p[2]);
      hudGuide.textContent = (dx < -p.half * 0.6 ? '← ' : dx > p.half * 0.6 ? '→ ' : '↓ ') + (r.next === r.checkpoints.length - 1 ? T('终点') + ' · ' : '') + Math.ceil(d) + ' m';
    } else hudGuide.textContent = T(r.result ? r.result.reason : '全程通过橙色旗门，最后一道为终点。');
    hudClock.textContent = T('剩余') + ' ' + time(r.level.limit - r.elapsed);
  };
  return V;
})();
