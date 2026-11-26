/* ---------------- 章节，和每一处战斗里一拨接一拨的来敌 ---------------- */
// 本文件：章节表 CHAPTERS 和每处战斗里一拨接一拨的来敌（fillQueue / spawnFromQueue / updateStage）。
const CHAPTERS = [
  { id: 'gate', n: '산문', idx: '제1장', sub: '모산시검',
    story: '해 질 녘, 흑풍채가 청운검종을 야습했다. 사형제들은 모두 산을 내려가 돌아오지 않았고, 넓은 시검평에는 당신과 검 한 자루뿐이다.' },
  { id: 'bamboo', n: '죽림', idx: '제2장', sub: '월하추영',
    story: '채주의 목이 떨어지고 잔당은 뒷산 죽해로 숨었다. 달빛이 물 같고 대나무 그림자 깊은 곳에 얼굴을 숨긴 무리가 있다.' },
  { id: 'tomb', n: '검총', idx: '제3장', sub: '만검동비',
    story: '정상까지 쫓아가서야 화근이 검총에 묻혀 있음을 알았다. 삼백 년 잠든 검마가 깨어났고, 산의 부러진 검이 모두 낮게 울고 있다.' },
];
function fillQueue(comp) {
  const q = []; for (const k in comp) for (let i = 0; i < comp[k]; i++) q.push(k);
  for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  G.queue = q.concat(G.queue);
}
function spawnFromQueue() {
  const type = G.queue.pop(), boss = ET[type].boss, R = World.R; let x, z, tries = 0;
  do { const a = rand(TAU), r = boss ? 15 : rand(13, 24); x = Pl.pos.x + Math.cos(a) * r; z = Pl.pos.z + Math.sin(a) * r; } while (Math.hypot(x, z) > R - 3 && tries++ < 30);
  if (Math.hypot(x, z) > R - 3) { const a = rand(TAU); x = Math.cos(a) * 20; z = Math.sin(a) * 20; }
  const p = new V3(x, 0, z); collide(p, 1); spawnEnemy(type, p.x, p.z, { elite: Math.random() < (G.eliteP || 0) });
}
function updateStage(dt) {
  G.atkGap = (G.atkGap || 0) - dt * G.enemyTS;
  if (G.clearT > 0) { G.clearT -= dt; if (G.clearT <= 0) Game.chapterClear(); return; }
  if (Tut.on) { Tut.update(dt); return; }
  if (G.rlDoneT > 0) { G.rlDoneT -= dt; if (G.rlDoneT <= 0) Run.afterFight(); return; }
  if (!Run.node) return;
  const alive = G.enemies.filter(e => e.state !== 'dead').length;
  if (G.queue.length && alive < G.cap) { G.spawnT -= dt; if (G.spawnT <= 0) { spawnFromQueue(); G.spawnT = alive < 3 ? .25 : .7; } }
  // 前一拨快清完（只剩一两个）就压上下一拨
  if (!G.queue.length && G.sub < G.waves.length - 1 && alive <= (G.waves.length > 2 ? 2 : 1)) {
    G.subT += dt; if (G.subT > 1.4) { G.subT = 0; G.sub++; fillQueue(G.waves[G.sub]); G.spawnT = .6; UI.toast(G.sub === G.waves.length - 1 ? '적군 후위가 밀어붙인다' : '원군 도착 임박', 2.2); Snd.gong(); }
  }
  if (!G.queue.length && G.sub >= G.waves.length - 1 && G.enemies.length === 0 && G.stage > 0 && (Net.on ? coopAnyAlive() : Pl.state !== 'dead') && !G.cleared) { G.cleared = true; stageClear(); }
}
function stageClear() { Save.stageDone(G.stage); Run.won(); }
