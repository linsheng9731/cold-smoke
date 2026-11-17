const EquipmentUI = (() => {
  const E = {}, T = s => I18N.t(s), groups = new Set();
  E.append = function (parent) {
    for (const g of groups) if (!g.isConnected) groups.delete(g);
    const group = document.createElement('div'); group.className = 'equipment';
    group.setAttribute('role', 'group');
    for (const id of ['ski', 'snowboard']) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.equipment = id;
      b.addEventListener('click', e => { e.stopPropagation(); Equipment.select(id); E.refresh(); });
      group.appendChild(b);
    }
    const note = document.createElement('small'); group.appendChild(note);
    for (const event of ['pointerdown', 'touchstart', 'click', 'keyup']) group.addEventListener(event, e => e.stopPropagation());
    group.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat && e.target.tagName === 'BUTTON') e.target.click(); }
      e.stopPropagation();
    });
    groups.add(group); parent.appendChild(group); E.refresh(); return group;
  };
  E.refresh = function () {
    const locked = Game.mode !== 'title' || UI.state !== 'title', board = Equipment.current() === 'snowboard';
    for (const group of groups) {
      const sig = locked + ':' + Equipment.selected + ':' + I18N.en();
      if (group.dataset.signature === sig) continue; group.dataset.signature = sig;
      group.setAttribute('aria-label', T('选择器材'));
      for (const b of group.querySelectorAll('button')) {
        b.textContent = T(Equipment.label(b.dataset.equipment)); b.disabled = locked;
        b.setAttribute('aria-pressed', String(b.dataset.equipment === Equipment.selected));
      }
      group.querySelector('small').textContent = T(locked ? '本局器材已锁定，返回标题后更换。' : board ? '左脚在前；左右换刃，前推并转向横滑刹车。' : '出发前选择；双板玩法保持不变。');
    }
  };
  E.init = function () {
    const go = document.getElementById('go'); go.parentNode.insertBefore(E.append(document.createElement('div')), go);
    I18N.on(E.refresh); Equipment.on(E.refresh); App.onTick.push(E.refresh, Equipment.tick);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Equipment.saveTime(); });
  };
  return E;
})();
