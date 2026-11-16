const AdventureUI = (() => {
  const V = {}, T = s => I18N.t(s), $ = id => document.getElementById(id);
  let offer = false, root, hud, hudTitle, hudGoal, hudGuide, hudClock, acc = 0;
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const time = seconds => Math.floor(Math.max(0, seconds) / 60) + ':' + Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  const button = (text, fn, primary) => {
    const b = node('button', T(text), primary ? 'adv-button primary' : 'adv-button'); b.type = 'button';
    b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b;
  };
  function route(id) {
    if (Adventure.access(id) === 'open') { offer = false; UI.beginAdventure(id); }
    else if (Adventure.access(id) === 'demo') {
      offer = true; V.render();
      const o = $('adv-offer'); if (o) { o.scrollIntoView({ block: 'nearest' }); const b = o.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
    }
  }
  V.init = function () {
    root = $('adv-content'); hud = $('adv-hud'); hudTitle = $('adv-title'); hudGoal = $('adv-goal'); hudGuide = $('adv-guide'); hudClock = $('adv-clock');
    Adventure.init(); Adventure.on(() => { V.render(); V.frame(1); }); I18N.on(() => { V.render(); V.frame(1); });
    App.onTick.push(V.frame); V.render();
  };
  V.render = function () {
    if (!root) return; root.replaceChildren();
    const r = Adventure.run, result = r && r.result;
    $('app').classList.toggle('adventure', !!r); $('m-go').hidden = !!result;
    if (result) {
      const card = node('div', '', 'adv-result'), title = node('h2', T(result.ok ? '关卡完成' : '再试一次'));
      card.append(title, node('p', T(r.level.name) + ' · ' + T(result.reason)));
      card.append(node('p', (result.ok ? '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars) + ' · ' : '') + T('用时') + ' ' + time(result.time) + ' · ' + T('碰撞') + ' ' + result.crashes));
      const row = node('div', '', 'adv-actions');
      row.append(button('重试', () => route(r.level.id), !result.ok));
      const next = AdventureLevels.levels[AdventureLevels.levels.indexOf(r.level) + 1];
      if (result.ok && next) row.append(button('下一关', () => route(next.id), true));
      if (result.ok && !next) card.append(node('p', T('体验内容已全部完成')));
      row.append(button('自由滑', () => UI.freeSki())); card.append(row); root.append(card);
    }
    root.append(node('p', T('通关即可前进，满星不是解锁条件。'), 'adv-note'));
    for (const [ci, chapter] of AdventureLevels.chapters.entries()) {
      const section = node('div', '', 'adv-chapter'); section.append(node('h3', '0' + (ci + 1) + ' / ' + T(chapter.name)), node('p', T(chapter.subtitle), 'adv-note'));
      const levels = AdventureLevels.levels.filter(l => l.chapter === chapter.id);
      for (const [li, l] of levels.entries()) {
        const access = Adventure.access(l.id), done = Adventure.progress[l.id];
        const b = node('button', '', 'adv-level'); b.type = 'button'; b.dataset.level = l.id;
        const title = node('b', (ci + 1) + '-' + (li + 1) + '  ' + T(l.name));
        b.append(title, node('span', T(l.description)), node('small', T(l.tip)));
        b.append(node('small', T('可选挑战') + ' · ' + T('目标用时') + ' ' + time(l.par) + ' · ' + T('碰撞不超过') + ' ' + l.maxCrashes));
        const status = access === 'progress' ? '先完成上一关' : access === 'demo' ? (Adventure.isBeta() ? '体验解锁（不扣费）' : '开发中') : '开始挑战';
        b.append(node('em', done ? '★'.repeat(done.stars) + '☆'.repeat(3 - done.stars) + ' · ' + T('最佳') + ' ' + time(done.best) : T(status)));
        b.disabled = access === 'progress' || access === 'unreleased' || (access === 'demo' && !Adventure.isBeta());
        b.addEventListener('click', e => { e.stopPropagation(); route(l.id); }); section.append(b);
      }
      if (chapter.id !== 'pine') section.append(node('p', T('开发中') + ' · ' + T('后续更新补齐12关'), 'adv-note'));
      if (chapter.id === 'pine') section.append(node('p', T('第一章免费，可随时重玩。'), 'adv-note'));
      root.append(section);
      if (chapter.id === 'mist' && Adventure.isBeta()) {
        const box = node('div', '', 'adv-offer'); box.id = 'adv-offer';
        box.append(node('h3', T('内测演示，不会扣费')), node('p', T('解锁第二章样例关，体验后续冒险。')), node('p', T('仅解锁本次已完成的1个样例关；其余7关仍在开发。'), 'adv-note'));
        if (Adventure.demoUnlocked) box.append(node('p', T('已体验解锁 · 不扣费')));
        else if (!Adventure.progress['pine-4']) box.append(node('p', T('先完成第一章，再体验解锁。'), 'adv-note'));
        else if (offer) {
          const row = node('div', '', 'adv-actions');
          row.append(button('体验解锁（不扣费）', () => { Adventure.tryUnlock(); offer = false; V.render(); }, true), button('暂不解锁', () => { offer = false; V.render(); })); box.append(row);
        } else box.append(button('体验解锁（不扣费）', () => { offer = true; V.render(); }));
        root.append(box);
      }
    }
    root.append(node('p', T('进度仅保存在本机，卸载可能丢失。'), 'adv-note'));
    if (Adventure.storageWarning) root.append(node('p', T('无法保存进度，本次仍可游玩。'), 'adv-warning'));
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
