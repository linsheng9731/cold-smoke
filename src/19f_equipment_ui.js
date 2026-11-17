const EquipmentUI = (() => {
  const E = {}, T = s => I18N.t(s), groups = new Set();
  let preview = 'ski', root;
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
  const locked = () => Game.mode !== 'title' || UI.state !== 'title';
  E.append = function (parent) {
    for (const g of groups) if (!g.isConnected) groups.delete(g);
    const group = document.createElement('div'); group.className = 'equipment'; group.setAttribute('role', 'group');
    for (const id of ['ski', 'snowboard']) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.equipment = id; b.dataset.previewEquipment = id;
      b.addEventListener('click', e => { e.stopPropagation(); preview = id; E.render(); });
      group.appendChild(b);
    }
    const note = node('small', '', 'equipment-note'); group.appendChild(note);
    const confirm = node('button', '', 'equipment-confirm'); confirm.type = 'button'; confirm.dataset.confirmEquipment = 'true';
    confirm.addEventListener('click', e => {
      e.stopPropagation();
      if (!locked() && Equipment.select(preview)) E.render();
    });
    group.appendChild(confirm);
    group.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target.tagName === 'BUTTON') { e.preventDefault(); if (!e.repeat) e.target.click(); }
        e.stopPropagation();
      }
    });
    group.addEventListener('pointerdown', e => e.stopPropagation());
    group.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    group.addEventListener('click', e => e.stopPropagation());
    groups.add(group); parent.appendChild(group); E.refresh(); return group;
  };
  E.refresh = function () {
    const isLocked = locked();
    for (const g of groups) {
      const sig = isLocked + ':' + Equipment.selected + ':' + preview + ':' + I18N.en();
      if (g.dataset.signature === sig) continue;
      g.dataset.signature = sig; g.setAttribute('aria-label', T('选择器材'));
      const buttons = Array.from(g.querySelectorAll('button'));
      for (const b of buttons.filter(n => n.dataset.previewEquipment)) {
        const id = b.dataset.previewEquipment;
        b.textContent = T(Equipment.label(id)) + (id === Equipment.selected ? ' · ' + T('当前使用') : '');
        b.disabled = isLocked;
        b.setAttribute('aria-pressed', String(id === preview));
      }
      const board = preview === 'snowboard';
      g.querySelector('small').textContent = isLocked
        ? T('本局器材已锁定，返回标题后更换。')
        : board ? T('左脚在前；左右换刃，前推并转向横滑刹车。') : T('出发前选择；双板玩法保持不变。');
      const confirm = buttons.find(b => b.dataset.confirmEquipment);
      confirm.textContent = T('使用此器材');
      confirm.disabled = isLocked;
      confirm.setAttribute('aria-label', T('使用此器材') + ' · ' + T(Equipment.label(preview)));
    }
  };
  E.render = function (reset = false) {
    if (!root) return;
    if (reset) preview = Equipment.selected;
    root.textContent = '';
    const content = node('div', '', 'gear-layout');
    const sidebar = node('div', '', 'gear-list');
    const controls = E.append(sidebar);
    const previewPanel = node('div', '', 'gear-preview');
    previewPanel.setAttribute('aria-label', T('器材预览'));
    const art = node('div', '', 'gear-illustration ' + (preview === 'snowboard' ? 'snowboard' : 'ski'));
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = preview === 'snowboard'
      ? '<svg viewBox="0 0 360 180"><path d="M35 131 302 39q17-6 23 10l3 8q5 16-11 22L52 170q-14 5-20-10l-4-8q-6-15 7-21Z"/><path d="m91 113 22 42M227 67l22 42"/><path d="m100 119 20-7m-13 24 20-7m109-58 20-7m-13 24 20-7"/></svg>'
      : '<svg viewBox="0 0 360 180"><path d="M62 159 215 21q10-9 19 1l3 3q8 9-1 17L85 174q-9 8-18-1l-4-4q-8-8-1-10Z"/><path d="M118 170 269 32q10-9 19 1l3 3q8 9-1 17L141 185q-9 8-18-1l-4-4q-8-8-1-10Z"/><path d="m109 73-24-26m-4 29 28-25m129 48-23-26m-5 29 28-26"/><path d="m82 47-8-26m8 26 18-22m-48 22 30 0m164 26-8-26m8 26 18-22m-48 22 30 0"/></svg>';
    previewPanel.appendChild(art);
    const details = node('div', '', 'gear-details');
    details.append(node('p', T('器材预览'), 'gear-eyebrow'), node('h3', T(Equipment.label(preview)), 'gear-name'));
    details.append(node('p', preview === 'snowboard' ? T('左脚在前；左右换刃，前推并转向横滑刹车。') : T('左右拖动转弯；按住加速，连续转弯控制速度。'), 'gear-description'));
    details.append(node('p', T('本局记录') + ' · ' + T('星级和最佳用时按器材分别记录。'), 'gear-record-note'));
    if (locked()) details.append(node('p', T('本局器材已锁定，返回标题后更换。'), 'gear-lock'));
    content.append(sidebar, previewPanel, details); root.appendChild(content);
    controls.dataset.previewGear = preview;
    E.refresh();
  };
  E.init = function () {
    root = document.getElementById('gear-content');
    I18N.on(() => E.render(true)); Equipment.on(() => E.render(true)); App.onTick.push(E.refresh, Equipment.tick);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Equipment.saveTime(); });
    E.render(true);
  };
  return E;
})();

const RecordsUI = (() => {
  const R = {}, T = s => I18N.t(s);
  const time = seconds => Math.floor(Math.max(0, seconds) / 60) + ':' + Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  R.render = function () {
    const root = document.getElementById('records-content'); if (!root) return;
    root.textContent = '';
    root.appendChild(Object.assign(document.createElement('p'), { className: 'records-caption', textContent: T('星级和最佳用时按器材分别记录。') }));
    const table = document.createElement('table'); table.className = 'records-table';
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const label of ['关卡', '双板星级', '双板最佳用时', '单板星级', '单板最佳用时']) {
      const th = document.createElement('th'); th.textContent = T(label); header.appendChild(th);
    }
    head.appendChild(header); table.appendChild(head);
    const body = document.createElement('tbody');
    for (const level of AdventureLevels.levels) {
      const tr = document.createElement('tr'), name = document.createElement('th'); name.textContent = T(level.name); tr.appendChild(name);
      const records = ['ski', 'snowboard'].map(equipment => Adventure.record(level.id, equipment));
      const columns = [records[0], records[0], records[1], records[1]];
      for (const [i, record] of columns.entries()) {
        const td = document.createElement('td');
        td.textContent = record
          ? (i === 0 || i === 2 ? '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars) : time(record.best))
          : T('尚无记录');
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    table.appendChild(body); root.appendChild(table);
    const link = document.createElement('button'); link.type = 'button'; link.className = 'records-mountains'; link.textContent = T('滑过的山');
    link.addEventListener('click', e => { e.stopPropagation(); UI.menu('mt'); }); root.appendChild(link);
  };
  R.init = function () { I18N.on(R.render); R.render(); };
  return R;
})();
