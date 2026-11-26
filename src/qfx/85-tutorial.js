/* ---------------- 试剑：第一次开局时在山门前走一遍，走完再看路线图 ---------------- */
// 本文件：试剑：第一次开局时在山门前一步一步教（TUT 是步骤表），走完才看路线图。
const K = (pc, tc) => Input.touch ? tc : pc;
/* 每一步：id、提示 t、开始时 init、做到了 done；fail 返回 null（没失败）或 { retryTo: 退回哪一步的 id, hint?: 提示 } */
const TUT = [
  { id: 'move', t: () => K('<kbd>W A S D</kbd> 이동, <kbd>마우스</kbd>로 시점 회전', '왼쪽 아래 스틱으로 이동, 화면을 밀어 시점 회전'), init() { Tut.p0 = Pl.pos.clone(); }, done: () => Pl.pos.distanceTo(Tut.p0) > 7 },
  { id: 'combo', t: () => K('<kbd>좌클릭</kbd> 또는 <kbd>J</kbd>로 나무 인형 연속 베기', '「참」을 연타해 나무 인형 베기') + ` · ${Math.min(5, Tut.hits)}/5`, init() { Tut.hits = 0; Tut.foe = tutFoe('dummy'); }, done: () => Tut.hits >= 5 },
  { id: 'dodge', t: () => K('<kbd>스페이스</kbd>로 회피, 회피 중에는 공격을 받지 않음', '「회피」를 눌러 회피, 회피 중에는 공격을 받지 않음'), init() { Tut.dodged = false; }, done: () => Tut.dodged },
  { id: 'parry', t: () => K('연습 상대가 공격하기 전 칼에 한광이 번쩍이면 <kbd>F</kbd>로 패리', '연습 상대 칼에 한광이 번쩍일 때 「막기」를 눌러 패리'), init() { tutDrop(); Tut.foe = tutFoe('spar'); Tut.p0n = Pl.parries; }, done: () => Pl.parries > Tut.p0n,
    fail: () => Pl.parries <= Tut.p0n && Tut.foe && Tut.foe.state === 'dead' ? { retryTo: 'parry', hint: '먼저 상대가 움직이길 기다렸다가, 한광이 번쩍일 때 막기' } : null },
  { id: 'exec', t: () => K('튕겨낸 뒤 연습 상대의 빈틈이 드러납니다. 다가가 <kbd>F</kbd>로 처형', '튕겨낸 뒤 연습 상대의 빈틈이 드러납니다. 다가가 「결」을 눌러 처형'), init() { }, done: () => !Tut.foe || Tut.foe.state === 'dead', fail: () => Tut.foe && Tut.foe.state !== 'dead' && Tut.foe.stun <= 0 && Tut.foe.state !== 'stagger' ? { retryTo: 'parry' } : null },
  { id: 'charge', t: () => K('<kbd>K</kbd> 또는 우클릭을 길게 눌러 가득 채운 뒤 놓으면 「파산」 발동', '「회전」을 길게 눌러 가득 채운 뒤 놓으면 「파산」 발동'), init() { tutDrop(); Tut.foe = tutFoe('dummy'); }, done: () => Pl.state === 'attack' && Pl.atkDef === PISHAN },
];
const Tut = { on: false, i: 0, t: 0 };
function tutFoe(kind) {
  const a = Pl.yaw, p = new V3(Pl.pos.x + Math.sin(a) * 4, 0, Pl.pos.z + Math.cos(a) * 4); collide(p, .5);
  const e = spawnEnemy('bandit', p.x, p.z); e.tut = kind; e.name = kind === 'dummy' ? '나무 인형' : '연습 상대'; e.xpK = 0;
  if (kind === 'dummy') { e.maxHp = e.hp = 99999; } else { e.dmgK = 0; e.windK = 1.7; e.maxHp = e.hp = 400; } Pl.lock = e; return e;
}
function tutDrop() { for (const e of G.enemies) if (e.tut && e.state !== 'dead') { e.state = 'dead'; e.deadT = .9; FX.smoke(e.pos, 10, 1, .08); } }
Tut.begin = function () { this.on = true; this.i = -1; this.next(); $('tut').hidden = false; };
Tut.next = function () {
  this.i++; this.t = 0; if (this.i > 0) { Snd.pick(); FX.ring(Pl.pos, .4, 2.5, 0x62cdb9, .35); }
  if (this.i >= TUT.length) { this.end(true); return; } TUT[this.i].init();
};
Tut.end = function (done, quiet) {
  this.on = false; tutDrop(); $('tut').hidden = true; Save.load().tut = 1; Save.write(); Pl.lock = null; Pl.hp = Pl.maxHp; Pl.mp = Pl.maxMp;
  if (quiet) return;
  if (done) { UI.banner('시검 완료', '흑풍채 사람들이 도착했다', 'gold'); Snd.level(); }
  setTimeout(() => { if (G.state === 'playing' && !Run.node) Run.showMap(); }, done ? 1600 : 300);
};
Tut.update = function (dt) {
  const s = TUT[this.i]; if (!s) return; this.t += dt; const f = s.fail ? s.fail() : null;
  if (f) { const to = TUT.findIndex(x => x.id === f.retryTo); if (f.hint) UI.toast(f.hint, 2.4); this.i = (to >= 0 ? to : this.i) - 1; this.next(); return; }
  if (this.t > .4 && s.done()) { this.next(); return; }
  const h = s.t(); if (this.html !== h) { this.html = h; $('tutT').innerHTML = h; } UI.set('tutN', `시검 ${cnNum(this.i + 1)} / ${cnNum(TUT.length)}`);
};
