/* ---------------- 一局：三章路线图（肉鸽） ---------------- */
// 本文件：一局肉鸽：路线图的节点种类（NODE）、生成路线（genMap）和每个节点的来敌（genWaves）、Run（一局的进度）、随机事件 EVENTS。
// 每局三章，每章一张七层路线图：先在最下面一层挑一处出发，之后每次只能走到相连的上一层，最上面是本章首领。
// 战 遭遇 · 精 精锐 · 奇 奇遇 · 市 剑庐 · 憩 歇脚 · 宝 藏宝 · 首 首领。身死这一局就结束，剑魄和藏经阁的修为留着。
// 在路线图上会自动存档（打到一半关掉，下次从路线图接着走）。
const NODE = {
  fight: { g: '전', n: '조우', c: '#c9b48a', d: '적 한 무리를 쓰러뜨리고 동전을 줍는다' },
  elite: { g: '정', n: '정예', c: '#ef6a55', d: '힘든 싸움: 정예가 몰려 있고, 이기면 진품 기연을 반드시 얻음' },
  event: { g: '기', n: '기우', c: '#9fc7e8', d: '강호 길에서 만나는 사람과 일, 길흉을 알 수 없다' },
  shop: { g: '시장', n: '검려', c: '#dcae55', d: '검 단련, 체력 단련, 양기, 회춘단 구입' },
  rest: { g: '휴식', n: '쉬어 가기', c: '#62cdb9', d: '호흡으로 체력을 회복하거나 검을 갈기' },
  treasure: { g: '보', n: '보물 숨김', c: '#e8c46a', d: '낡은 상자, 세 가지 중 하나를 고르세요' },
  boss: { g: '수', n: '두목', c: '#ff3a22', d: '이번 장의 강적' },
};
const MAP_ROWS = 7, MAP_COLS = 4, BOSSES = ['boss1', 'boss3', 'boss2'];
/* 每章能出的敌人和“身价”（越凶越贵，一拨的总身价随层数涨） */
const POOL = [
  { bandit: 1, wolf: 1, archer: 1.5, spear: 1.5, brute: 4 },
  { wolf: 1, archer: 1.5, spear: 1.5, assassin: 2, wraith: 2, brute: 4 },
  { slave: 2.5, wraith: 2, spirit: .8, assassin: 2, brute: 4 },
];
/* 劫数：通关一次解锁下一劫，层层叠加 */
const ASC = [
  { n: '겁 없음', d: '평범한 강호' },
  { n: '1겁', d: '적 체력 +15%' },
  { n: '2겁', d: '정예가 더 자주 나오고, 정예 체력 추가 +20%' },
  { n: '3겁', d: '적 피해 +15%' },
  { n: '4겁', d: '쉬며 호흡을 고르면 체력 20%만 회복' },
  { n: '5겁', d: '두목 체력 +25%, 시작 시 회춘단 1알 감소' },
];
function ascApply(a) { Object.assign(G, { asc: a, ascHp: a >= 1 ? 1.15 : 1, ascElite: a >= 2 ? 1.2 : 1, ascDmg: a >= 3 ? 1.15 : 1, ascBoss: a >= 5 ? 1.25 : 1 }); }
const ascMax = () => Math.min(ASC.length - 1, Save.load().asc || 0);

function genMap() {
  const nodes = [], at = {}, R = MAP_ROWS - 1;
  const get = (r, c) => { const k = r + ',' + c; if (!at[k]) { at[k] = { id: nodes.length, r, c, t: null, next: [] }; nodes.push(at[k]); } return at[k]; };
  const edge = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); };
  const has = (r, c1, c2) => { const a = at[r + ',' + c1], b = at[(r + 1) + ',' + c2]; return !!(a && b && a.next.includes(b.id)); };
  const boss = { id: -1, r: R, c: (MAP_COLS - 1) / 2, t: 'boss', next: [] };
  for (const s of [0, MAP_COLS - 1, randi(0, MAP_COLS - 1), randi(0, MAP_COLS - 1)]) {
    let c = s, prev = get(0, c);
    for (let r = 1; r < R; r++) {
      let nc = clamp(c + randi(-1, 1), 0, MAP_COLS - 1);
      if (nc === c + 1 && has(r - 1, c + 1, c)) nc = c;   // 不和已有的路交叉
      if (nc === c - 1 && has(r - 1, c - 1, c)) nc = c;
      const n = get(r, nc); edge(prev, n); prev = n; c = nc;
    }
    prev.bossNext = true;
  }
  boss.id = nodes.length; nodes.push(boss);
  for (const n of nodes) if (n.bossNext) { n.next.push(boss.id); delete n.bossNext; }
  const parents = n => nodes.filter(p => p.next.includes(n.id));
  const W = r => [['fight', 44], ['event', 24], ['elite', r >= 2 ? 14 + (G.asc >= 2 ? 6 : 0) : 0], ['shop', r >= 2 ? 10 : 0], ['rest', r >= 2 && r <= R - 3 ? 8 : 0]];
  const roll = r => { const w = W(r), tot = w.reduce((s, x) => s + x[1], 0); let v = Math.random() * tot; for (const [t, k] of w) { v -= k; if (v <= 0) return t; } return 'fight'; };
  for (const n of nodes.slice().sort((a, b) => a.r - b.r)) {
    if (n.t) continue;
    if (n.r === 0) { n.t = 'fight'; continue; }
    if (n.r === R - 1) { n.t = 'rest'; continue; }
    if (n.r === 3 && Math.random() < .55) { n.t = 'treasure'; continue; }
    let t, k = 0; do { t = roll(n.r); } while (k++ < 10 && (t === 'elite' || t === 'shop' || t === 'rest') && parents(n).some(p => p.t === t));
    n.t = t;
  }
  // 每张图至少一处剑庐、一处精锐
  for (const need of ['shop', 'elite']) if (!nodes.some(n => n.t === need)) { const c = nodes.filter(n => n.r >= 2 && n.r <= R - 2 && (n.t === 'fight' || n.t === 'event')); if (c.length) pick(c).t = need; }
  // 画图用的坐标：最下面是第一层，首领在最上面
  for (const n of nodes) { n.x = n.t === 'boss' ? 200 : Math.round(62 + n.c * 92 + rand(-12, 12)); n.y = n.t === 'boss' ? 50 : Math.round(560 - n.r * 78 + rand(-8, 8)); }
  return { nodes };
}
/* 一拨敌人的配法：按本章敌人池和身价随机配，弓手一拨最多两个，力士前两层不出 */
function genWaves(ci, r, kind) {
  if (kind === 'boss') return [{ [BOSSES[ci]]: 1 }];
  const pool = POOL[ci], ks = Object.keys(pool), waves = [], n = kind === 'elite' ? 2 : r < 2 ? 2 : 3;
  for (let w = 0; w < n; w++) {
    let b = ([5, 7.5, 10][ci] + r * [.6, .8, 1.1][ci]) * (kind === 'elite' ? 1.25 : 1) * (.85 + .15 * w); const comp = {};
    for (let k = 0; b > 0 && k < 60; k++) {
      const t = pick(ks); if (t === 'archer' && (comp.archer || 0) >= 2) continue; if (t === 'brute' && (r < 2 || (comp.brute || 0) >= (ci >= 2 ? 2 : 1))) continue;
      comp[t] = (comp[t] || 0) + 1; b -= pool[t];
    }
    waves.push(comp);
  }
  return waves;
}
/* 这一处战斗折算成原来十关里的第几关（敌人的气血、伤害、精锐几率都按它涨） */
const nodeLv = (ci, n) => n.t === 'boss' ? [3, 6, 10][ci] : [1, 4, 7][ci] + Math.floor(n.r * [2, 2, 3][ci] / 5) + (n.t === 'elite' ? 1 : 0);

const Run = {
  ch: 0, map: null, at: -1, path: [], step: 0, node: null, ev: null,
  begin(asc) { this.ch = 0; this.at = -1; this.path = []; this.step = 0; this.node = null; this.seenEv = new Set(); G.mode = 'rl'; ascApply(asc); this.map = genMap(); },
  load(r) { G.mode = 'rl'; ascApply(r.asc || 0); Object.assign(this, { ch: r.ch, map: r.map, at: r.at, path: r.path || [], step: r.step || 0, node: null, seenEv: new Set(r.seen || []) }); G.soulRun = r.soulRun || 0; Pl.reviveUsed = !!r.revUsed; },
  save() {
    const d = Save.load();
    d.rl = { v: 1, ch: this.ch, asc: G.asc, map: this.map, at: this.at, path: this.path, step: this.step, snap: Save.snap(), hp: Math.max(1, Math.round(Pl.hp)), soulRun: G.soulRun || 0, revUsed: !!Pl.reviveUsed, seen: [...(this.seenEv || [])] };
    Save.write();
  },
  reach() { const ns = this.map.nodes; return this.at < 0 ? ns.filter(n => n.r === 0).map(n => n.id) : ns[this.at].next.slice(); },
  /* ---- 路线图 ---- */
  showMap() {
    hideAll(); clearField(); $('hud').hidden = true; $('touch').hidden = true; unlock(); G.state = 'rlmap'; this.node = null; this.save();
    const ch = CHAPTERS[this.ch], ns = this.map.nodes, ok = new Set(this.reach()), done = new Set(this.path);
    $('rmT').firstChild.textContent = ch.n; $('rmS').textContent = `${ch.idx} · ${ch.sub}${G.asc ? ' · ' + ASC[G.asc].n : ''}`;
    $('rmStat').innerHTML = `<span>체력 <b>${Math.ceil(Pl.hp)} / ${Pl.maxHp}</b></span><span>동전 <b>${Math.floor(Pl.gold)}</b></span><span>회춘단 <b>${Pl.pots}</b></span><span>경지 <b>${cnNum(Pl.lv)}</b></span><span>패검 <b>${swordTier().name}</b></span>`;
    const L = [];
    for (const a of ns) for (const id of a.next) { const b = ns[id], walked = done.has(a.id) && done.has(b.id) && this.path.indexOf(b.id) === this.path.indexOf(a.id) + 1, live = a.id === this.at && ok.has(b.id);
      L.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walk' : live ? 'live' : ''}"/>`); }
    for (const n of ns) {
      const N = NODE[n.t], big = n.t === 'boss', r = big ? 30 : 19, cls = ['nd', done.has(n.id) ? 'done' : '', ok.has(n.id) ? 'ok' : '', n.id === this.at ? 'cur' : ''].join(' ');
      L.push(`<g class="${cls}" data-n="${n.id}" transform="translate(${n.x} ${n.y})" style="--c:${N.c}"${ok.has(n.id) ? ' tabindex="0" role="button"' : ''} aria-label="${N.n}"><circle class="halo" r="${r + 7}"/><circle r="${r}"/><text y="${big ? 11 : 7}" font-size="${big ? 32 : 20}">${N.g}</text></g>`);
    }
    const svg = $('rmSvg'); svg.innerHTML = L.join('');
    for (const g of svg.querySelectorAll('.nd.ok')) { const go = () => this.go(+g.dataset.n); g.onclick = go; g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      g.onmouseenter = () => this.tip(ns[+g.dataset.n]); }
    this.tip(null); UI.perkList('rmPerks'); $('rlmap').hidden = false;
  },
  tip(n) { $('rmTip').textContent = n ? `${NODE[n.t].n}：${NODE[n.t].d}` : (this.at < 0 ? '맨 아래 층에서 출발할 곳을 고르세요' : '이어진 바로 위 층으로만 갈 수 있습니다 · 위로 갈수록 험해집니다'); },
  go(id) {
    if (G.state !== 'rlmap' || !this.reach().includes(id)) return;
    const n = this.map.nodes[id]; this.at = id; this.path.push(id); this.step++; this.node = n; $('rlmap').hidden = true; Snd.init(); Snd.ui();
    if (n.t === 'fight' || n.t === 'elite' || n.t === 'boss') this.fight(n);
    else if (n.t === 'shop') { G.shopFrom = 'rlmap'; G.state = 'shop'; UI.showShop(); }
    else if (n.t === 'rest') this.rest();
    else if (n.t === 'treasure') this.treasure();
    else this.event();
  },
  /* ---- 战斗：沿用原来一关几拨的打法 ---- */
  fight(n, waves) {
    const ci = this.ch, lv = nodeLv(ci, n);
    Object.assign(G, { stage: lv, sub: 0, subT: 0, clearT: 0, inter: 0, intro: false, bossDead: false, rlDoneT: 0, cleared: false, waves: waves || genWaves(ci, n.r, n.t), k0: G.kills, tokens: 0, queue: [] });
    G.stageName = n.t === 'boss' ? ET[BOSSES[ci]].name : NODE[n.t].n; G.maxTokens = Math.min(4, 2 + Math.floor(lv / 4)); G.cap = Math.min(13, 6 + Math.floor(lv / 2));
    G.eliteP = n.t === 'elite' ? (G.asc >= 2 ? .55 : .4) : lv >= 3 ? Math.min(.28, .07 + .02 * (lv - 3)) + (G.asc >= 2 ? .06 : 0) : 0;
    fillQueue(G.waves[0]); G.spawnT = 1.1;
    $('hud').hidden = false; $('touch').hidden = !Input.touch; G.state = 'playing'; canvas.focus();
    if (n.t === 'boss') UI.banner(ET[BOSSES[ci]].name, CHAPTERS[ci].n + ' · 두목', 'red'); else { UI.banner(n.t === 'elite' ? '정예 득세' : `제${cnNum(this.step)}단계`, G.stageName, n.t === 'elite' ? 'red' : ''); Snd.gong(); }
  },
  /* 一处打完：剑魄照旧，精锐给珍品机缘，首领破章 */
  won() {
    const n = this.node, ci = this.ch; if (!n) return;
    try { if (n.t === 'boss' && parent !== window) parent.postMessage({ qfx: 'wave', n: [3, 6, 10][ci] }, '*'); } catch (_) {}
    G.hazards.length = 0; Pl.mp = Pl.maxMp;
    const sg = addSoul((4 + 2 * Math.min(G.stage, 12)) * (n.t === 'boss' ? 3 : n.t === 'elite' ? 1.6 : 1) + (G.kills - (G.k0 ?? G.kills)) * .25); G.soulRun = (G.soulRun || 0) + sg; setTimeout(() => UI.toast(`검백 +${sg}`, 1.6), 900);
    if (n.t === 'boss') {
      const r = Save.load().rec; r.bestCh = Math.max(r.bestCh || 0, ci + 1); Save.write();
      if (ci >= CHAPTERS.length - 1) { Game.victory(); return; }
      G.clearT = 3.2; const ch = CHAPTERS[ci]; UI.banner(`${ch.n} · 돌파 완료`, ch.idx + ' · ' + ch.sub, 'gold'); Snd.level(); return;
    }
    if (this.bounty === 'sword' && Pl.swordLv < 9) { Pl.swordLv++; recalc(); setSwordTier(); setTimeout(() => UI.toast('외로운 혼이 남긴 부러진 검: 검 단련 1중', 2.2), 1400); }
    if (this.bounty === 'pelt') { Pl.gold += 45; setTimeout(() => UI.toast('늑대 가죽을 팔아 동전 45문 획득', 2.2), 1400); }
    this.bounty = null;
    if (n.t === 'fight' && Math.random() < .18 && Pl.pots < 5) { Pl.pots++; setTimeout(() => UI.toast('회춘단 한 알을 주웠다', 1.8), 1400); }
    UI.banner('적의 기세가 다했다', n.t === 'elite' ? '정예 처치' : '짐을 챙겨 다시 길을 떠난다', 'gold'); Snd.level(); G.rlDoneT = 1.8;
  },
  /* 打完停一会儿让灵气珠飞回来，再结算 */
  afterFight() {
    if (this.node && this.node.t === 'elite') { this.offer(rareCards(), '정예 처치', '진품 기연 하나를 고르세요'); return; }
    this.showMap();
  },
  nextChapter() { this.ch++; this.map = genMap(); this.at = -1; this.path = []; this.node = null; Game.enterChapter(this.ch); },
  /* ---- 三选一（精锐、藏宝、奇遇里的机缘） ---- */
  offer(cards, t, s, after) {
    if (!cards.length) { Pl.gold += 60; UI.toast('기연 소진 · 대신 동전 60 획득', 2); (after || (() => this.showMap()))(); return; }
    G.state = 'reward'; unlock(); this.after = after || (() => this.showMap()); this.cards = cards;
    $('hud').hidden = true; UI.showCards(cards, t, s, c => this.pickCard(c));
  },
  pickCard(c) { if (G.state !== 'reward' || !c) return; takeCard(c); $('levelup').hidden = true; const f = this.after; this.after = null; f(); },
  /* ---- 歇脚 ---- */
  rest() {
    const heal = G.asc >= 4 ? .2 : .35, opts = [
      { n: '호흡 조절', d: `체력 ${Math.round(heal * 100)}% 회복(${Math.round(Pl.maxHp * heal)} 포인트)`, f: () => { healPlayer(Pl.maxHp * heal, true); return '향 하나 탈 시간이 지나자 숨이 고르게 돌아왔다.'; } },
      { n: '검 갈기', d: Pl.swordLv >= 9 ? '검을 더 갈 수 없다' : `검 단련 1중, 동전 소모 없음(공격 +13%)`, ok: () => Pl.swordLv < 9, f: () => { Pl.swordLv++; recalc(); setSwordTier(); Snd.forge(); return `검끝이 한 층 더 빛난다: ${swordTier().name} · ${cnNum(Pl.swordLv)}중.`; } },
      { n: '연단', d: Pl.pots >= 5 ? '단약 주머니가 가득 찼다' : '회춘단 한 알 제련', ok: () => Pl.pots < 5, f: () => { Pl.pots++; return '약향이 방에 가득하고, 회춘단 한 알을 얻었다.'; } },
    ];
    this.panel('쉬어 가기', '산속 작은 집 · 한 가지만 할 수 있음', '화로에 찻주전자가 데워져 있다. 아직 이르니 쉬거나 검을 더 갈아 보자.', opts);
  },
  /* ---- 藏宝 ---- */
  treasure() {
    const g = randi(25, 55) + this.ch * 15; Pl.gold += g; Snd.forge();
    this.offer(rareCards(), '보물 숨김', `상자 바닥에 동전 ${g}문이 눌려 있다 · 그 밖에 세 가지, 하나를 고르세요`);
  },
  /* ---- 奇遇 ---- */
  event() {
    const seen = this.seenEv || (this.seenEv = new Set()), pool = EVENTS.filter(e => !seen.has(e.id) && (!e.ch || e.ch.includes(this.ch)));
    const e = pick(pool.length ? pool : EVENTS); seen.add(e.id);
    this.panel(e.t, '기우', e.d, e.opts.map(o => ({ ...o, d: typeof o.d === 'function' ? o.d() : o.d })));
  },
  panel(t, s, d, opts) {
    G.state = 'event'; unlock(); $('hud').hidden = true;
    $('evT').firstChild.textContent = t; $('evS').textContent = s; $('evD').textContent = d; $('evR').hidden = true; $('evGo').hidden = true;
    const host = $('evOpts'); host.innerHTML = ''; host.hidden = false;
    opts.forEach((o, i) => { const b = document.createElement('button'), can = !o.ok || o.ok(); b.type = 'button'; b.className = 'item'; b.disabled = !can;
      b.innerHTML = `<span class="in">${o.n}</span><span class="ip">${i + 1}</span><span class="id">${o.d}</span>`; b.onclick = () => this.choose(o); host.appendChild(b); });
    this.opts = opts; $('event').hidden = false;
  },
  choose(o) {
    if (G.state !== 'event' || $('evOpts').hidden || !o || (o.ok && !o.ok())) return;
    const res = o.f(); Snd.ui(); $('evOpts').hidden = true;
    if (res && res.fight) { $('event').hidden = true; this.fight({ ...this.node, t: 'fight' }, res.fight); return; }
    if (res && res.cards) { $('event').hidden = true; this.offer(res.cards, this.node ? $('evT').firstChild.textContent : '기연', res.sub || '하나를 고르세요'); return; }
    if (Pl.hp <= 0) Pl.hp = 1;
    $('evR').textContent = res || ''; $('evR').hidden = !res; $('evGo').hidden = false; $('evGo').focus();
  },
  closeEvent() { if (G.state !== 'event' || $('evGo').hidden) return; $('event').hidden = true; this.showMap(); },
};
/* 珍品三选一：机缘只出珍、绝两档；剑技能新学或升重；没有绝学时也可能出绝学 */
function rareCards() {
  const pool = PERKS.filter(p => p.r >= 2 && pk(p.id) < p.max && (!p.need || skLv(p.need))).map(p => ({ k: 'perk', p, w: p.r === 3 ? 18 : 30 }));
  const empty = Pl.slots.includes(null);
  for (const id in SK) { const l = skLv(id); if (l ? l < 3 : empty) pool.push({ k: 'skill', id, w: l ? 22 : 26 }); }
  if (!Pl.ult) for (const id in ULT) pool.push({ k: 'ult', id, w: 9 });
  const out = [];
  while (out.length < 3 && pool.length) { const c = wpick(pool); out.push(c); pool.splice(pool.indexOf(c), 1); if (c.k === 'ult') for (let i = pool.length - 1; i >= 0; i--) if (pool[i].k === 'ult') pool.splice(i, 1); }
  return out;
}
const hpCost = k => Math.max(1, Math.round(Pl.maxHp * k));
function hurtFlat(n) { Pl.hp = Math.max(1, Pl.hp - n); Pl.hurtV = 1; }
/* 奇遇：每局不重样。f() 返回结果文字；返回 { fight } 就地开打，返回 { cards } 给三选一 */
const EVENTS = [
  { id: 'swordsman', t: '몰락한 검객', d: '길가에 검객이 쓰러져 있다. 다리에 화살을 맞았고 손에는 반쪽짜리 검보를 쥐고 있다.', opts: [
    { n: '그에게 회춘단 한 알 주기', d: '회춘단 한 알을 내고 검보를 받는다(3택 1)', ok: () => Pl.pots > 0, f: () => { Pl.pots--; return { cards: rareCards(), sub: '검객의 반쪽 검보 · 하나를 고르세요' }; } },
    { n: '그의 짐 뒤지기', d: '동전 70문 획득, 하지만 그가 발버둥 치며 당신을 찔렀다', f: () => { Pl.gold += 70; hurtFlat(hpCost(.12)); return '돈을 받았다. 등 뒤의 그 일검이 오는 길 내내 아팠다.'; } },
    { n: '물러가기', d: '아무것도 하지 않음', f: () => '강호길 멀다, 각자 천명에 맡긴다.' }] },
  { id: 'temple', t: '산속 옛 절', d: '산 중턱에 오래된 절이 있다. 향로에 아직 온기가 있지만 스님은 보이지 않는다.', opts: [
    { n: '지난 향', d: '30문을 내고 체력 40% 회복', ok: () => Pl.gold >= 30, f: () => { Pl.gold -= 30; healPlayer(Pl.maxHp * .4, true); return '푸른 연기가 피어올라 마음이 가라앉고 상처도 가벼워졌다.'; } },
    { n: '부처 앞에서 참선', d: '검의 기연 획득(패리, 처형 강화)', f: () => { const p = PERKS.filter(x => x.s === 'yi' && pk(x.id) < x.max); if (!p.length) { Pl.gold += 40; return '마음이 맑아졌지만 얻은 것은 없다. 상 위에 향화전 40문이 놓여 있다.'; } const q = pick(p); takePerk(q); return `달이 중천에 오를 때까지 앉아 있다가 문득 깨달았다: 「${q.n}」.`; } },
    { n: '떠나기', d: '아무것도 하지 않음', f: () => '당신은 합장해 절하고 돌아서서 산을 내려간다.' }] },
  { id: 'dice', t: '들판 주막 도박장', d: '주기 아래 탁자에 주사위가 있고, 주인이 손짓한다. "손님, 한 판 걸어 보시겠소?"', opts: [
    { n: '40문 걸기', d: '반반: 이기면 100문, 지면 40문을 잃는다', ok: () => Pl.gold >= 40, f: () => { Pl.gold -= 40; if (Math.random() < .5) { Pl.gold += 100; return '세 개가 모두 육이다! 주인 얼굴이 새파래졌고, 당신은 100문을 챙겨 나선다.'; } return '주사위가 멈췄고 당신이 졌다. 주인은 입이 귀에 걸리도록 웃는다.'; } },
    { n: '상 뒤엎기', d: '주사위에 납이 들었다! 도박꾼 무리를 쫓아내라', fight: 1, f: () => ({ fight: [{ bandit: 4 + G.asc % 2 }, { bandit: 3, archer: 1 }] }) },
    { n: '떠나기', d: '아무것도 하지 않음', f: () => '도박 \'도\' 자 위에 칼이 얹혀 있으니 건드리지 않는 게 낫다.' }] },
  { id: 'smith', t: '주검 노인', d: '개울가 대장간에서 노인이 실눈으로 당신의 검을 본다. "바탕은 좋은데 날을 못 세웠구나."', opts: [
    { n: '날을 세워 달라고 부탁', d: () => `${60 + Pl.swordLv * 15}문을 내고 검 단련 1중`, ok: () => Pl.swordLv < 9 && Pl.gold >= 60 + Pl.swordLv * 15, f: () => { Pl.gold -= 60 + Pl.swordLv * 15; Pl.swordLv++; recalc(); setSwordTier(); Snd.forge(); return `불꽃이 튀며 ${swordTier().name}의 한광이 더 빛난다.`; } },
    { n: '피로 검을 담금질', d: () => `체력 ${hpCost(.2)} 잃고 검 단련 1중`, ok: () => Pl.swordLv < 9, f: () => { hurtFlat(hpCost(.2)); Pl.swordLv++; recalc(); setSwordTier(); Snd.forge(); return '검이 당신의 피를 마시고 웅웅 울린다.'; } },
    { n: '떠나기', d: '아무것도 하지 않음', f: () => '노인은 고개를 젓고는 다시 고개를 숙이고 쇠를 두드렸다.' }] },
  { id: 'spring', t: '한담', d: '맑은 차가운 못이 있다. 못가 바위에 \'세검\' 두 글자가 새겨져 있다.', opts: [
    { n: '못물 한 모금 마시기', d: '체력 30% 회복, 내공 가득 충전', f: () => { healPlayer(Pl.maxHp * .3, true); Pl.mp = Pl.maxMp; return '서늘한 기운이 단전까지 스미고 온몸이 가벼워졌다.'; } },
    { n: '못에 들어 검을 씻다', d: '검기 기연 획득', f: () => { const p = PERKS.filter(x => x.s === 'qi' && pk(x.id) < x.max && (!x.need || skLv(x.need))); if (!p.length) { healPlayer(Pl.maxHp * .3, true); return '검의 때가 다 벗겨졌다. 겸사겸사 세수도 하니 정신이 번쩍 든다.'; } const q = pick(p); takePerk(q); return `못물이 끓고 검기가 하늘을 찌른다: 「${q.n}」.`; } }] },
  { id: 'stele', t: '잔비', d: '풀숲에 반쪽짜리 비석이 있다. 비석에 검초가 새겨져 있으나 나머지 반은 풍화되었다.', opts: [
    { n: '검초 탁본', d: '새 검기술을 배우거나, 아는 검기술을 1중 올립니다', ok: () => Object.keys(SK).some(id => skLv(id) ? skLv(id) < 3 : Pl.slots.includes(null)), f: () => { const ids = Object.keys(SK).filter(id => skLv(id) ? skLv(id) < 3 : Pl.slots.includes(null)); const id = pick(ids), l = skLv(id); learnSkill(id); return l ? `「${SK[id].n}」이(가) 한 단계 오릅니다.` : `「${SK[id].n}」을(를) 익혔다.`; } },
    { n: '비석 앞에서 좌선', d: '체력 20% 회복', f: () => { healPlayer(Pl.maxHp * .2, true); return '바람이 풀을 스치자 온몸의 피로가 사라졌다.'; } }] },
  { id: 'black', t: '암시장', d: '복면인이 길을 막는다. "기연, 필요하냐? 체력만 받고 동전은 안 받는다."', opts: [
    { n: '체력을 기연으로 바꾼다', d: () => `체력 ${hpCost(.25)} 잃고 진품 기연 3택 1`, ok: () => Pl.hp > hpCost(.25) + 1, f: () => { hurtFlat(hpCost(.25)); return { cards: rareCards(), sub: '복면인이 세 두루마리를 펼친다 · 하나를 고르세요' }; } },
    { n: '회춘단 한 알 구입', d: '25문 지불(검려보다 저렴)', ok: () => Pl.gold >= 25 && Pl.pots < 5, f: () => { Pl.gold -= 25; Pl.pots++; return '알약에 아직 체온이 남아 있다.'; } },
    { n: '떠나기', d: '아무것도 하지 않음', f: () => '복면인이 차갑게 웃고는 숲으로 사라졌다.' }] },
  { id: 'child', t: '길 잃은 아이', d: '어린아이가 길가에 앉아 울고 있다. 부모가 산 아래 마을에 계신데 길을 잃었다고 한다.', opts: [
    { n: '마을까지 데려다주기', d: '마을 사람이 회춘단 한 알과 동전 30문으로 사례했다', f: () => { Pl.pots = Math.min(5, Pl.pots + 1); Pl.gold += 30; return '마을 어귀에 등불이 하나둘 켜지고, 아이의 어머니가 울며 고마워한다.'; } },
    { n: '방향을 가리키기', d: '동전 10문 획득', f: () => { Pl.gold += 10; return '아이가 동전 열 닢을 쥐여 주고 쏜살같이 달아났다.'; } }] },
  { id: 'wolves', t: '늑대 울음', d: '숲에 녹색 불빛이 점점이 보이고, 늑대 무리가 당신을 노린다.', ch: [0, 1], opts: [
    { n: '검을 뽑아 맞서다', d: '늑대 무리를 물리치면 늑대 가죽을 45문에 바꿀 수 있다', fight: 1, f: () => (Run.bounty = 'pelt', { fight: [{ wolf: 5 }, { wolf: 4, brute: G.asc >= 3 ? 1 : 0 }] }) },
    { n: '우회', d: () => `체력 ${hpCost(.1)} 잃고 싸우지 않음`, f: () => { hurtFlat(hpCost(.1)); return '가시덤불 속을 한밤 내내 헤쳐 나가서야 늑대 무리를 따돌렸다.'; } }] },
  { id: 'ghost', t: '검총의 외로운 혼', d: '외로운 혼 하나가 부러진 검 사이를 떠돈다. "저 검노들을 처리해 주게. 이 부러진 검은 자네 걸세."', ch: [2], opts: [
    { n: '수락', d: '한 판 싸워 이기면 검 단련 1중', fight: 1, f: () => { Run.bounty = 'sword'; return { fight: [{ slave: 3, spirit: 3 }, { slave: 2, wraith: 2 }] }; } },
    { n: '정중히 거절', d: '외로운 혼이 한숨 쉬며 흩어지고 50문을 남겼다', f: () => { Pl.gold += 50; return '부러진 검 사이에 바람 소리만 남았다.'; } }] },
];
