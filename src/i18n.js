// 刃影 国际化多语言支持模块 (i18n)
// 支持简体中文 (zh) 与英文 (en)，默认中文，支持设置与初次启动语言偏好引导
//
// 文件结构：
//   1. 当前语言        initLang / getLang / setLang（存在 localStorage 的 renying-lang）
//   2. 带数字的句子    PATTERNS_EN：按正则模板翻（整句查表查不到的那种）
//   3. 查表与翻页面    lookup → t → translateNode / applyTranslations；trWatch 盯住新加的节点补翻
//   4. 挂到全局        window.I18N、window.t
// 找 bug 提示：英文界面里还剩中文，先在控制台跑 I18N.t('那句中文')：返回原文说明词条表
//   （src/data/30-ui-copy-*.js）缺这一句，或者这句带数字，要在 PATTERNS_EN 加一条模板。

(function() {
  'use strict';

  // 中文 → 英文的词条表在 src/data/30-ui-copy-*.js（UI_COPY_EN）。它和游戏主体拼在一起，比这个文件晚加载，
  // 所以每次用到时再去取；还没加载好就当作空表（照样显示中文）。
  function dictEn() {
    return typeof UI_COPY_EN === 'object' && UI_COPY_EN ? UI_COPY_EN : {};
  }
  // 한글화: 한국어 사전 UI_COPY_KO (src/data/32-ko-*.js). 한국어 모드는 내부적으로 영어 모드('en')와 같은 화면 규칙을 쓰고
  // (레이아웃 코드가 getLang() === 'en' 을 보기 때문), 사전만 한국어 → 영어 → 중국어 원문 순으로 찾는다.
  let koMode = false;
  function dictKo() {
    return typeof UI_COPY_KO === 'object' && UI_COPY_KO ? UI_COPY_KO : {};
  }
  function patternsKo() {
    return PATTERNS_KO;
  }

  // ---------- 1. 当前语言 ----------
  // 当前语言：'zh' 或 'en'
  let currentLang = 'zh';

  function initLang() {
    try {
      const saved = localStorage.getItem('renying-lang');
      if (saved === 'ko') {
        currentLang = 'en'; koMode = true;
      } else if (saved === 'en' || saved === 'zh') {
        currentLang = saved;
      } else {
        // 尝试从 SETTINGS 中读取
        const s = JSON.parse(localStorage.getItem('renying-settings') || '{}');
        if (s.lang === 'ko') {
          currentLang = 'en'; koMode = true;
        } else if (s.lang === 'en' || s.lang === 'zh') {
          currentLang = s.lang;
        } else {
          currentLang = 'en'; koMode = true; // 한글화 기본값: 한국어
        }
      }
    } catch (e) {
      currentLang = 'en'; koMode = true;
    }
  }

  initLang();

  function getLang() {
    return currentLang;
  }
  function getLocale() {
    return koMode ? 'ko' : currentLang;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'zh' && lang !== 'ko') lang = 'ko';
    koMode = lang === 'ko';
    currentLang = koMode ? 'en' : lang;
    try {
      localStorage.setItem('renying-lang', lang);
      const s = JSON.parse(localStorage.getItem('renying-settings') || '{}');
      s.lang = lang;
      localStorage.setItem('renying-settings', JSON.stringify(s));
    } catch (e) {}

    if (typeof window !== 'undefined' && window.SETTINGS) {
      window.SETTINGS.lang = lang;
    }

    applyTranslations();

    // 触发页面内各类动态组件重新渲染
    try { if (typeof renderTopNav === 'function') renderTopNav(); } catch (e) {}
    try { if (typeof renderHome === 'function') renderHome(); } catch (e) {}
    try { if (typeof buildSettings === 'function') buildSettings(); } catch (e) {}
    try { if (typeof renderTasks === 'function') renderTasks(); } catch (e) {}
    try { if (typeof renderCodex === 'function') renderCodex(); } catch (e) {}
    try { if (typeof renderAccPage === 'function') renderAccPage(); } catch (e) {}
    try { if (typeof updateAIBrief === 'function') updateAIBrief(); } catch (e) {}
    try { if (typeof singleSec === 'function' && typeof currentSingleTab !== 'undefined') singleSec(currentSingleTab); } catch (e) {}
    try { if (typeof renderLobby === 'function') renderLobby(); } catch (e) {}
    try { if (typeof updateVerLine === 'function') updateVerLine(); } catch (e) {}
  }

  // ---------- 2. 带数字的句子：按模板翻 ----------
  // 数字是拼进去的句子（"剩余 25 天 6 小时"、"全服 12 人在线"），整句查表永远查不到，
  // 这里按模板换：$1 之类照常可用，也可以直接给一个替换函数。
  const EN_DUR = s => String(s).replace(/(\d+)\s*天/g, '$1d').replace(/(\d+)\s*小时/g, '$1h').replace(/(\d+)\s*分(?:钟)?/g, '$1m');
  const PATTERNS_EN = [
    [/^“蓄满(.+)，格挡在它面前像纸一样薄。”$/, (m, move) => lookup(move) ? `“Fully charge ${lookup(move)} to break a guard.”` : m],
    [/^“凌空使出(.+)，制空追击一气呵成。”$/, (m, move) => lookup(move) ? `“Use ${lookup(move)} to follow up in midair.”` : m],
    [/^“(.+)一出，(.+)让对手措手不及。”$/, (m, move, effect) => lookup(move) && lookup(effect) ? `“Catch your opponent off guard with ${lookup(move)}. Effect: ${lookup(effect)}.”` : m],
    [/^“(.+)顺势抽身，化险为夷。”$/, (m, move) => lookup(move) ? `“Use ${lookup(move)} to slip out of danger.”` : m],
    [/^“气满施展「(.+)」，(.+)定乾坤。”$/, (m, move, effect) => lookup(move) && lookup(effect) ? `“At full meter, use ${lookup(move)}. Effect: ${lookup(effect)}.”` : m],
    [/^总伤害\s*(\d+)\s*·\s*最长连击\s*(\d+)\s*·\s*破防\s*(\d+)\s*·\s*坠崖\s*(\d+)$/, (m0, damage, combo, breaks, falls) => `Damage ${damage} · Longest combo ${combo} · Guard breaks ${breaks} · Terrain falls ${falls}`],
    [/^今日\s*(\d+)\/(\d+)(?:\s*·\s*可领\s*(\d+)\s*墨锭)?$/, (m0, a, b, c) => `Today ${a}/${b}` + (c ? ` · ${c} Ink to claim` : '')],
    [/^(.+?)\s*位侠士在线$/, (m0, n) => `${n} ${n === '1' ? 'warrior' : 'warriors'} online`],
    [/^剩\s*(\d+)\s*天$/, (m0, d) => `${d}d left`],
    [/^全服\s*(.+?)\s*人在线$/, (m0, n) => `Global · ${n} online`],
    [/^(\d+)\s*人在线\s*·\s*(.+)$/, (m0, n, rest) => `${n} online · ${lookup(rest) || rest}`],
    [/^对局中\s*(\d+)\s*人(?:\s*·\s*匹配中\s*(\d+)\s*人)?$/, (m0, p, w) => `${p} in matches` + (w ? ` · ${w} queuing` : '')],
    [/^(.+?)\s*人在线$/, (m0, n) => `${n} online`],
    [/^(\d+\.\d+\s*[–-]\s*\d+\.\d+)\s*·\s*剩余\s*(.+)$/, (m0, span, left) => `${span} · ${EN_DUR(left)} left`],
    [/^剩余\s*(\d.*)$/, (m0, left) => `${EN_DUR(left)} left`],
    [/^第一赛季\s*(\d.*?)\s*后开启(（[^）]*）)?$/, (m0, left, tail) => `Season 1 starts in ${EN_DUR(left)}${tail ? ' (preseason rating resets)' : ''}`],
    [/^全皮肤限免\s*·\s*剩\s*(\d+)\s*天$/, (m0, d) => `All skins free · ${d}d left`],
    [/^赛季已结束$/, () => 'Season over'],
    [/^第([一二三四五六七八九十]+)赛季\s*·\s*(\d+\.\d+\s*[–-]\s*\d+\.\d+)(?:\s*·\s*(?:(已结束)|剩余\s*(.+)))?$/, (m0, n, span, over, left) => `Season ${'一二三四五六七八九十'.indexOf(n) + 1} · ${span}` + (over ? ' · Over' : left ? ` · ${EN_DUR(left)} left` : '')],
    [/^训练集：(.+?)\s*个样本$/, (m0, n) => `Training set: ${n} samples`],
    [/^(\d+)\s*个样本$/, (m0, n) => `${n} samples`],
    [/^(.+?)\s*个样本\s*·\s*(.+)$/, (m0, n, rest) => `${n} samples · ${rest}`],
    [/^库存中有 (\d+) 件普通饰品可升级。$/, (m0, n) => `${n} regular items in your inventory can be upgraded.`],
    [/^原价 ([\d,]+) 墨锭 · 省 ([\d,]+)（20% 折扣）$/, (m0, base, saved) => `Was ${base} Ink · save ${saved} (20% off)`],
    [/^库存中有 (\d+) 件普通饰品可升级。原价 ([\d,]+) 墨锭，20% 折扣省 ([\d,]+) 墨锭，实付 ([\d,]+) 墨锭。升级后所有饰品从 0 斩开始，编号和名字保留，不能退回普通版。$/, (m0, n, base, saved, price) => `${n} regular items can be upgraded. Original price: ${base} Ink. Save ${saved} Ink with the 20% discount; pay ${price} Ink. All items start at 0 kills. Their IDs and names stay the same, and the upgrade cannot be undone.`],
    [/^已升级 (\d+) 件斩数版，省下 ([\d,]+) 墨锭$/, (m0, n, saved) => `Upgraded ${n} items to Kill Counter editions and saved ${saved} Ink`],
    // 匹配：计时后面的范围、排位、邀请、版本不符
    [/^(\d+:\d{2}) · 全服随机$/, (m0, t) => `${t} · Anyone online`],
    [/^(\d+:\d{2}) · 匹配范围 (.+?)(?:–(.+?))? 段$/, (m0, t, a, b) => `${t} · Range ${lookup(a) || a}${b ? `–${lookup(b) || b}` : ''}`],
    [/^排位赛：(.+)$/, (m0, r) => `Competitive: ${lookup(r) || r}`],
    [/^定级赛 (\d+)\/(\d+) · ～(\d+) 分$/, (m0, a, b, c) => `Placement ${a}/${b} · ~${c} pts`],
    [/^([A-Z]\d*) · (.+?) · ([\d,]+) 分$/, (m0, l, n, p) => `${l} · ${lookup(n) || n} · ${p} pts`],
    [/^检测到邀请房间码 (\S+)，正在自动加入…$/, (m0, c) => `Invite room code ${c} found, joining…`],
    [/^中途离开排位赛，判负（(.+?) 分）$/, (m0, d) => `Left a ranked match early: counted as a loss (${d} pts)`],
    [/^你的版本与房主不同（房主是 (.+?)），刷新网页再试$/, (m0, v) => `Your version differs from the host's (${v}). Refresh the page and try again`],
    // 选人页（BP）：步骤、倒计时、侠客数值
    [/^第\s*(\d+)\s*\/\s*(\d+)\s*步$/, (m0, a, b) => `Step ${a} / ${b}`],
    [/^(\d+)\s*\/\s*(\d+)\s*步$/, (m0, a, b) => `${a} / ${b} steps`],
    [/^(\d+(?:\.\d+)?)\s*秒$/, (m0, n) => `${n}s`],
    // 好友房换规则的提示（src/game/24-account-02-lobby.js、src/game/06-input-net.js，规则名见 ROOM_RULE_NAMES）
    [/^已设定切磋规则：(.+)$/, (m0, r) => `Room rule set: ${lookup(r) || r}`],
    [/^擂主已设定切磋规则：(.+)$/, (m0, r) => `The host set the room rule: ${lookup(r) || r}`],
    // 木人桩的对手行为栏和左上角提示（src/game/21-buttons-02-training.js、16-draw-ui.js）
    [/^(.+)（只做一次）$/, (m0, a) => `${lookup(a) || a} (once)`],
    [/^按 (\S+) 换对手行为 \| F1 判定框 · Hz 慢放 · 单帧推进$/, (m0, k) => `${k}: dummy actions · F1 hitboxes · Hz slow motion · step frame`],
    [/^回放 · 第(\d+)回合( · 已暂停)? · F1 判定框$/, (m0, n, paused) => `Replay · Round ${n}${paused || ''} · F1 hitboxes`],
    [/^伤害交换占优：造成 (\d+)，承受 (\d+)。$/, (m0, dealt, taken) => `Favorable damage trade: dealt ${dealt}, took ${taken}.`],
    [/^最长连击：(\d+) 段。$/, (m0, n) => `Longest combo: ${n} hits.`],
    [/^成功破防：(\d+) 次。$/, (m0, n) => `Guard breaks: ${n}.`],
    [/^约 (\d+)% 的攻击输入发生在较远距离，可能有部分出手够不到对手。$/, (m0, n) => `About ${n}% of attack inputs were made from far away and may not have reached the opponent.`],
    [/^约 (\d+)% 的攻击输入发生时没有正对对手。$/, (m0, n) => `You were not facing the opponent for about ${n}% of attack inputs.`],
    [/^本局坠崖 (\d+) 次，边缘位置需要更早回到场地中央。$/, (m0, n) => `You fell off the stage ${n} times. Return toward center sooner near an edge.`],
    [/^(\S+) 打开 · Esc 关闭$/, (m0, k) => `${k} opens · Esc closes`],
    [/^（冷却\s*(\d+(?:\.\d+)?)\s*秒）$/, (m0, n) => ` (cooldown ${n}s)`],
    [/^(.+?)禁用一名侠客$/, (m0, w) => `${lookup(w) || w} · Ban a hero`],
    [/^(.+?)选择出战侠客$/, (m0, w) => `${lookup(w) || w} · Pick a hero`],
    [/^(.+?)钦点【(.+?)】出战$/, (m0, w, r) => `${lookup(w) || w} · Pick the ${lookup(r) || r}`],
    [/^禁 (.+)$/, (m0, n) => `Ban · ${lookup(n) || n}`],
    [/^没找到名字里同时有「(.+)」这几个字的人，按回车按全名加$/, (m0, q) => `No one's name contains “${q}”. Press Enter to add by full name`],
    // 英雄页皮肤按钮和皮肤牌：「名字 · 限免 / 武库 / 青锋行 / 武库」「品级 · 名字」
    [/^(.+?) · (限免|武库|青锋行 \/ 武库)$/, (m0, n, t) => `${lookup(n) || n} · ${{ 限免: 'Free trial', 武库: 'Armory', '青锋行 / 武库': 'Qingfeng Quest / Armory' }[t]}`],
    [/^(碧玉|赤霄|灵犀|精铁|★ 绝世|绝世|传说|精英) · (.+)$/, (m0, g, n) => `${lookup(g) || g} · ${lookup(n) || n}`],
    // 教学框左上角：「快速上手 2 / 5」「完整教学 7 / 11」（src/game/20-tutorial-rollback-touch.js）
    [/^(快速上手|完整教学) (\d+) \/ (\d+)$/, (m0, w, a, b) => `${w === '快速上手' ? 'Quick start' : 'Full tutorial'} ${a} / ${b}`],
    [/^难度 ([●○]+)$/, (m0, d) => `Difficulty ${d}`],
    [/^平衡 · 伤害与气血 ×([\d.]+)$/, (m0, n) => `Balance · Damage & HP ×${n}`],
    [/^(伤害|普攻|技能|技能与大招|大招|气血) ×([\d.]+)$/, (m0, label, n) => `${{ 伤害: 'Damage', 普攻: 'Normals', 技能: 'Skills', 技能与大招: 'Skills & Ultimate', 大招: 'Ultimate', 气血: 'HP' }[label]} ×${n}`],
    [/^(正常|原速) ([\d.]+)x$/, (m0, w, n) => `Normal ${n}x`],
    [/^慢放 ([\d.]+)x$/, (m0, n) => `Slow ${n}x`],
    // 结算页（src/game/08-fighter-match.js showEnd、src/game/19-progress-04-ranked.js reportProgress）
    [/^(你赢了|你输了)，比分 (\d+) : (\d+)$/, (m0, r, a, b) => `${r === '你赢了' ? 'You won' : 'You lost'} · Score ${a} : ${b}`],
    [/^比分 (\d+) : (\d+)$/, (m0, a, b) => `Score ${a} : ${b}`],
    [/^\+(\d+) 墨锭 · 联机(胜|负)（累计 (\d+) 胜）$/, (m0, g, r, n) => `+${g} Ink · Online ${r === '胜' ? 'win' : 'loss'} (${n} win${n === '1' ? '' : 's'} total)`],
    [/^2v2 天道演武决出胜负，比分 (\d+) : (\d+)$/, (m0, a, b) => `2v2 Exhibition decided · Score ${a} : ${b}`],
    [/^三阵连克，斩获 (\d+) 墨锭！（击破比分 (\d+) : (\d+)）$/, (m0, g, a, b) => `Three bouts won, +${g} Ink! (KOs ${a} : ${b})`],
    [/^胜败乃兵家常事，重整旗鼓再战（击破比分 (\d+) : (\d+)）$/, (m0, a, b) => `Win some, lose some. Regroup and try again (KOs ${a} : ${b})`],
    [/^同袍肉鸽 · 第 (\d+) 重魔劫 · 全员收益共享$/, (m0, n) => `Co-op Roguelike · Trial ${n} · Rewards shared by all`],
    [/^(?:🎉 )?讨伐大捷！全员共享斩获 \+(\d+) 墨锭（累计收获 (\d+) 墨锭 · 全队共鸣 (\d+) 卷秘卷）$/, (m0, g, t, n) => `Victory! Everyone gets +${g} Ink (${t} Ink this run · ${n} shared scroll${n === '1' ? '' : 's'})`],
    [/^惜败于六技融魂首领【(.+)】！全员仍获共享赏金 \+(\d+) 墨锭（本趟累计 (\d+) 墨锭）$/, (m0, h, g, t) => `Lost to the fused boss [${h.split('·').map(n => lookup(n) || n).join(' · ')}]. Everyone still gets +${g} Ink (${t} Ink this run)`],
    [/^(.+) 融魂首领$/, (m0, h) => `${h.split('·').map(n => lookup(n) || n).join(' · ')} · Fused Boss`],
    [/^止步于万仞剑阁第 (\d+) 层，共领悟 (\d+) 卷武林秘籍！$/, (m0, f, n) => `Stopped on floor ${f} of the Sword Pavilion with ${n} scroll${n === '1' ? '' : 's'} learned!`],
    [/^最高纪录：第 (\d+) 层$/, (m0, f) => `Best: floor ${f}`],
    [/^同袍肉鸽虽败犹荣 · 全员共享抚恤 \+(\d+) 墨锭$/, (m0, g) => `Co-op Roguelike: a loss with honor · Everyone gets +${g} Ink`],
    [/^(?:🎉 )?众志破魔大捷！全员共享丰厚悬赏 \+(\d+) 墨锭！$/, (m0, g) => `The demon falls! Everyone gets a +${g} Ink bounty!`],
    // 英雄页招式区（src/game/18-codex-content.js、src/game/22-saga.js 的 sagaCodexLine）
    [/^“([\s\S]+)”$/, (m0, x) => { const t = lookup(x); return t ? `“${t}”` : ''; }],
    [/^被动 · (.+)$/, (m0, n) => `Passive · ${lookup(n) || n}`],
    [/^左键\+右键 · (.+)$/, (m0, n) => `L+R Click · ${lookup(n) || n}`],
    [/^(\d+) 段 · 末段击飞(?: · 另有墨团 (\d+)×([\d.]+))?$/, (m0, n, k, d) => `${n} hits · Last hit launches${k ? ` · plus ${k}× ink blots of ${d}` : ''}`],
    [/^第 (\d+) 章 · (.+)$/, (m0, n, x) => `Chapter ${n} · ${lookup(x) || x}`],
    [/^（守关：(.+?) · 难度：(.+?)）$/, (m0, h, lv) => ` (Guardian: ${lookup(h) || h} · Difficulty: ${lookup(lv) || lv})`],
    [/^已破关 \(★(\d)\)$/, (m0, n) => `Cleared (★${n})`],
    [/^前往第 (\d+) 章试炼$/, (m0, n) => `Go to the Chapter ${n} trial`],
    // 天机乱斗的异变（src/game/22-modes-03-chaos.js）：「疾风·天罡」、「效果 · 星宿句」两半分别查表；要排在通用的「…」之前
    [/^「([^·」]+)·([^·」]+)」$/, (m0, a, b) => { const x = lookup(a), y = lookup(b); if (x && y) return `“${x} · ${y}”`; const t = lookup(`${a}·${b}`); return t ? `“${t}”` : ''; }],
    [/^(.+) · ((?:天罡北斗|地煞幽冥|青龙出海|白虎啸风|朱雀振羽|玄武镇岳|破晓晨光|孤月映水|狂雷贯顶|炽火焚天)，.+)$/, (m0, a, b) => { const x = lookup(a), y = lookup(b); return x && y ? `${x} · ${y}` : ''; }],
    [/^天机异变 · (.+)$/, (m0, n) => `Mutation · ${lookup(n) || n}`],
    [/^山河异境 · (.+)$/, (m0, n) => `Terrain Clash · ${lookup(n) || n}`],
    [/^坠崖 -(\d+)$/, (m0, n) => `Fell -${n}`],
    [/^天雷 -(\d+)$/, (m0, n) => `Lightning -${n}`],
    [/^「(.+)」$/, (m0, n) => { const t = lookup(n); return t ? `“${t}”` : ''; }],
    [/^侠客列传 · (.+?)传 · (.+)$/, (m0, h, t) => `Hero Tales · ${lookup(h) || h} · ${lookup(t) || t}`],
    [/^走到第 (\d+) \/ (\d+) 节$/, (m0, a, b) => `Reached part ${a} / ${b}`],
    [/^结局 ((?:「[^」]+」)+)$/, (m0, x) => `Endings: ${x.slice(1, -1).split('」「').map(n => lookup(n) || n).join(', ')}`],
    // 守关挑战（src/game/07-ai-story.js）：故事标题 · 关名、角色台词、结算页
    [/^📖 (.+)（([^（）]+)）$/, (m0, title, place) => `📖 ${lookup(title) || title} (${lookup(place) || place})`],
    [/^(.+) \((\d+)波妖\)$/, (m0, name, count) => `${lookup(name) || name} (${count} waves)`],
    [/^(.+) · 魔首决战$/, (m0, name) => `${lookup(name) || name} · Final Boss`],
    [/^(\S+?)传 · (.+?)(?: · (.+))?$/, (m0, h, t, st) => { const a = lookup(t); return a ? `Tale of ${lookup(h) || h} · ${a}${st ? ` · ${lookup(st) || st}` : ''}` : ''; }],
    [/^(\S{2,3})：「([\s\S]+)」$/, (m0, h, x) => { const t = lookup(x); return t ? `${lookup(h) || h}: “${t}”` : ''; }],
    [/^第 (\d+) 幕$/, (m0, n) => `Act ${n}`],
    [/^(\d+\.\d+) (破关|折戟)$/, (m0, id, r) => `${id} ${r === '破关' ? 'Cleared' : 'Failed'}`],
    [/^折在第 (\d+) \/ (\d+) 波，共击退 (\d+) 只妖物$/, (m0, a, b, n) => `Fell on wave ${a} / ${b} after driving off ${n} demons`],
    [/^同袍残存气血 (\d+)%，共斩灭 (\d+) 只妖物 ·$/, (m0, p, n) => `Team HP left ${p}%, ${n} demons slain ·`],
    [/^全员共享斩妖赏金 \+(\d+) 墨锭！$/, (m0, g) => `Everyone shares a +${g} Ink bounty!`],
    [/^(?:🎉 )?宿命通关奖励：已解锁【(.+?)】专属皮肤「(.+?)」！$/, (m0, h, k) => `Destiny reward: unlocked ${lookup(h) || h}'s exclusive skin “${lookup(k) || k}”!`],
    [/^比分 (\d+) : (\d+)，再磨一磨剑$/, (m0, a, b) => `Score ${a} : ${b}. Sharpen your sword and try again`],
    // 守关关卡里画在画布上的字（src/game/07-ai-story.js、22-modes-07-raid.js 的同袍斩妖）：大字、HUD、条幅
    [/^第 (\d+) \/ (\d+) 波妖潮$/, (m0, a, b) => `Wave ${a} / ${b}`],
    [/^尚余 (\d+) 妖$/, (m0, n) => `${n} left`],
    [/^(\d+) 只$/, (m0, n) => n],
    [/^(\d+) 卷$/, (m0, n) => n],
    [/^关卡 (\d+\.\d+) · (.+)$/, (m0, id, n) => `Stage ${id} · ${lookup(n) || n}`],
    [/^终幕魔首降临 · (.+)$/, (m0, n) => `The final boss arrives · ${lookup(n) || n}`],
    [/^决战【(.+)】$/, (m0, h) => `Final battle [${h.split('·').map(n => lookup(n) || n).join(' · ')}]`],
    [/^全员共享 \+(\d+) 墨锭$/, (m0, g) => `+${g} Ink for everyone`],
    [/^群妖肃清！全队共享顿悟「(.+)」$/, (m0, n) => `Demons cleared! The team shares the scroll “${lookup(n) || n}”`],
    // 问剑密卷（src/game/22-modes-02-tower.js）和天魔讨伐的选卷面板、层数大字、画布上的层数
    [/^(问剑|问剑密卷|万仞剑阁|天道爬塔) · 第 (\d+) 层$/, (m0, w, n) => `${{ 问剑: 'Sword Scrolls', 问剑密卷: 'Sword Scrolls', 万仞剑阁: 'Sword Pavilion', 天道爬塔: 'AI Climb' }[w]} · Floor ${n}`],
    [/^问剑密卷 · 继续第 (\d+) 层$/, (m0, n) => `Sword Scrolls · Resume floor ${n}`],
    [/^突破第 (\d+) 层 · 顿悟秘卷$/, (m0, n) => `Floor ${n} cleared · Learn a scroll`],
    [/^讨伐第 (\d+) 劫大捷 · 全员共享秘卷增益$/, (m0, n) => `Trial ${n} won · A shared scroll for everyone`],
    // 已领悟 / 已带 N 卷 · 雷 3/3：共鸣效果 · 墨 1/3（流派是印章式单字，照原样）
    [/^(\S) (\d+)\/(\d+)(?:：(.+))?$/, (m0, g, a, b, x) => `${g} ${a}/${b}${x ? `: ${lookup(x) || x}` : ''}`],
    [/^(已领悟|已带) (\d+) 卷(?: · (.+))?$/, (m0, w, n, x) => `${w === '已带' ? 'Taking' : 'Learned'} ${n} scroll${n === '1' ? '' : 's'}${x ? ' · ' + x.split(' · ').map(r => lookup(r) || r).join(' · ') : ''}`],
    // 打斗中飘的字（带数字的）
    [/^画符 · (\d+)\/(\d+)$/, (m0, a, b) => `Talisman · ${a}/${b}`],
    [/^符爆 ×(\d+)$/, (m0, n) => `Talisman Burst ×${n}`],
    [/^枪尖穿心 \((\d+)\/(\d+)\)$/, (m0, a, b) => `Spear to the Heart (${a}/${b})`],
    [/^剑坛赐福：(.+)$/, (m0, x) => `Arena blessing: ${lookup(x) || x}`],
    [/^(\d+) 连击$/, (m0, n) => `${n} Hits`],
    // 开放世界 / 全服肉鸽（src/game/22-world.js）：右上角 HUD、大字、提示
    [/^(\d+) 线 · (.+)$/, (m0, n, z) => `Line ${n} · ${lookup(z) || z}`],
    [/^(\d+) 人$/, (m0, n) => `${n} player${n === '1' ? '' : 's'}`],
    [/^(\d+) 只（你 (\d+)）$/, (m0, a, b) => `${a} (you ${b})`],
    [/^魔窟 · 余 (\d+) 秒$/, (m0, n) => `Demon Cave · ${n}s left`],
    [/^还差 (\d+) 只$/, (m0, n) => `${n} more to go`],
    [/^天道(?: Boss|车轮) · 余 (\d+) 秒$/, m0 => m0.replace(/^天道 Boss/, 'Tiandao Boss').replace(/^天道车轮/, 'Tiandao Relay').replace(/余 (\d+) 秒$/, '$1s left')],
    [/^(\d+) \/ (\d+) 只$/, (m0, a, b) => `${a} / ${b}`],
    [/^第 (\d+) 轮 · 第 (\d+)\/(\d+) 劫$/, (m0, a, b, c) => `Round ${a} · Trial ${b}/${c}`],
    [/^正在进入 (\d+) 线…$/, (m0, n) => `Entering line ${n}…`],
    [/^(\d+) 线已满，去 (\d+) 线…$/, (m0, a, b) => `Line ${a} is full, moving to line ${b}…`],
    [/^江湖共斗 · (\d+) 线$/, (m0, n) => `Open World · Line ${n}`],
    [/^已有 (\d+) 位侠客在这条线上$/, (m0, n) => `${n} hero${n === '1' ? '' : 'es'} on this line`],
    [/^最后一击：(.+)$/, (m0, x) => `Final blow: ${x}`],
    [/^妖王伏诛！输出榜 (.*)$/, (m0, x) => `Demon King slain! Damage board: ${x}`],
    [/^(\d+) 秒后在土地庙复活$/, (m0, n) => `Respawn at the shrine in ${n}s`],
    [/^第 (\d+) \/ (\d+) 劫 · 已有 (\d+) 卷秘卷$/, (m0, a, b, c) => `Trial ${a} / ${b} · ${c} scroll${c === '1' ? '' : 's'} so far`],
    [/^本劫斩妖完成，(\d+) 秒内投票$/, (m0, n) => `Trial kills done, vote within ${n}s`],
    // 全服肉鸽 · 江湖长卷（src/game/22-world.js 的 cq* 和 src/data/13-chron.js 每节的目标）
    [/^(.+) · 第 (\d+)\/(\d+) 节$/, (m0, c, a, b) => `${lookup(c) || c} · Part ${a}/${b}`],
    [/^江湖长卷推进 (\d+) 节$/, (m0, n) => `The Chronicle advances ${n} parts`],
    [/^长卷第 (\d+) 节完成$/, (m0, n) => `Chronicle part ${n} complete`],
    [/^下一节：(.+)$/, (m0, x) => `Next: ${lookup(x) || x}`],
    [/^全服斩妖 (\d+) 只$/, (m0, n) => `Slay ${n} demons server-wide`],
    [/^(竹林|古道|山寨|魔窟)斩妖 (\d+) 只$/, (m0, z, n) => `Slay ${n} demons in ${lookup(z) || z}`],
    [/^讨伐妖王 (\d+) 次$/, (m0, n) => `Slay the Demon King ${n} time${n === '1' ? '' : 's'}`],
    [/^斩完 (\d+) 劫$/, (m0, n) => `Clear ${n} trial${n === '1' ? '' : 's'}`],
    [/^关键战告捷 (\d+) 次$/, (m0, n) => `Win ${n} Key Fight${n === '1' ? '' : 's'}`],
    [/^江湖长卷：领到 (\d+) 节的奖励 · \+(\d+) 墨锭（下次打开武库到账）(?: · 秘卷(.+))?$/, (m0, n, ink, mj) => `World Chronicle: rewards for ${n} part${n === '1' ? '' : 's'} · +${ink} Ink (arrives next time you open the Armory)` + (mj ? ` · Scrolls ${mj.split('、').map(x => { const m = x.match(/^「(.+)」$/); return m ? `“${lookup(m[1]) || m[1]}”` : x; }).join(', ')}` : '')],
    [/^江湖长卷 · 全服第 (\d+) \/ (\d+) 节 · (.+?)(?: · 个人秘卷 (\d+) 卷)?$/, (m0, a, b, c, n) => `World Chronicle · Part ${a} / ${b} server-wide · ${lookup(c) || c}` + (n ? ` · ${n} personal scroll${n === '1' ? '' : 's'}` : '')],
    [/^江湖长卷 · 全卷完成 · 个人秘卷 (\d+) 卷$/, (m0, n) => `World Chronicle · Complete · ${n} personal scroll${n === '1' ? '' : 's'}`],
    [/^线上真人不足 (\d+) 位：各自迎战 (\d+) 位天道侠客$/, (m0, a, b) => `Fewer than ${a} players online: each of you faces ${b} Tiandao heroes`],
    [/^融魂魔首【(.*)】· 共享 (\d+) 卷秘卷$/, (m0, h, n) => `Fused Demon Lord [${h.split('·').map(x => lookup(x) || x).join(' · ')}] · ${n} shared scroll${n === '1' ? '' : 's'}`],
    [/^对阵【(.*)】· 带着 (\d+) 卷共享秘卷$/, (m0, h, n) => `Versus [${h.split('·').map(x => lookup(x) || x).join(' · ')}] · with ${n} shared scroll${n === '1' ? '' : 's'}`],
    [/^(\d+) 秒后重新入战，魔首的血不回$/, (m0, n) => `Back in the fight in ${n}s; the boss doesn't heal`],
    [/^天道 Boss 伏诛！(.*?)( · 够资格的话，星座皮肤会在下次打开武库时到账| · 登录云端账号才能领星座皮肤)$/, (m0, x, t) => `Tiandao Boss slain! ${x}${t.includes('登录') ? ' · Log in to a cloud account to earn Zodiac skins' : ' · If you qualify, the Zodiac skin arrives next time you open the Armory'}`],
    [/^天道车轮战收场 · 告捷：(.+)$/, (m0, x) => `Tiandao Relay over · Winners: ${x.split('、').join(', ')}`],
    // 木人桩的试剑数据卡（src/game/16-draw-ui.js drawTrainStats）
    [/^(\d+) 段 · (\d+) 伤$/, (m0, n, d) => `${n} hit${n === '1' ? '' : 's'} · ${d} dmg`],
    // 拿到秘卷时的大字（src/game/22-modes-02-tower.js、07-ai-story.js、22-world.js 的 say）
    [/^全队共享领悟「(.+)」$/, (m0, n) => `The team learns “${lookup(n) || n}”`],
    [/^领悟「(.+)」$/, (m0, n) => `Learned “${lookup(n) || n}”`],
    [/^全员共享「(.+)」$/, (m0, n) => `Everyone shares “${lookup(n) || n}”`],
    [/^全线共享「(.+)」$/, (m0, n) => `All lines share “${lookup(n) || n}”`],
    [/^第 (\d+) 波击退 · 全队共享「(.+)」$/, (m0, w, n) => `Wave ${w} repelled · The team shares “${lookup(n) || n}”`],
    // 选卷页的流派 · 品级标签：流派是印章式的单字，照原样
    [/^(\S) · (凡品|精品|绝品|险卷|天书)$/, (m0, g, r) => `${g} · ${lookup(r) || r}`],
    // 同袍肉鸽的画布 HUD（src/game/16-draw-ui.js drawHUDRaid）：要排在上面「全队共享秘卷：…」之前
    [/^全队共享秘卷：(\d+) 卷 · 破魔悬赏 \+(\d+) 墨锭$/, (m0, n, g) => `Shared scrolls: ${n} · Boss bounty +${g} Ink`],
    [/^全服共享秘卷：(\d+) 卷 · 魔首血量全线共享$/, (m0, n) => `Server-shared scrolls: ${n} · Boss HP shared across all lines`],
    [/^同袍肉鸽 · 第(\d+)劫$/, (m0, n) => `Co-op Roguelike · Trial ${n}`],
    [/^(.+) 融魂魔首$/, (m0, h) => `Fused Demon Lord of ${h.split('·').map(n => lookup(n) || n).join(' · ')}`],
    [/^全队共享秘卷：(.+)$/, (m0, x) => `Shared scrolls: ${x.split('、').map(n => { const m = n.match(/^「(.+)」$/); return m ? `“${lookup(m[1]) || m[1]}”` : n; }).join(', ')}`],
    // 天魔讨伐（src/game/22-tianmo.js）：页面、首页小卡片、出战提示和结算
    [/^第 (\d+) 代天魔$/, (m0, n) => `Demon · Gen ${n}`],
    [/^第 (\d+) 代天魔 · (.+)$/, (m0, n, h) => `Demon · Gen ${n} · ${lookup(h) || h}`],
    [/^剩 (\d+)% 血 · (\d+) 人参战(?: · (\d+) 人正在出战)?$/, (m0, p, n, f) => `${p}% HP left · ${n} fighters${f ? ` · ${f} fighting now` : ''}`],
    [/^(\d+) 人参战$/, (m0, n) => `${n} fighters`],
    [/^(\d+) 人正在出战$/, (m0, n) => `${n} fighting now`],
    [/^(\d.*?)后遁走$/, (m0, t) => `Escapes in ${EN_DUR(t).replace(/\s+/g, ' ')}`],
    [/^全服已斩杀 (\d+) 代（解锁 (\d+) 卷天书）$/, (m0, a, b) => `The server has slain ${a} generation${a === '1' ? '' : 's'} (${b} Heavenly Tome${b === '1' ? '' : 's'} unlocked)`],
    [/^出战 (\d+) 次$/, (m0, n) => `${n} run${n === '1' ? '' : 's'}`],
    [/^造成 ([\d,]+) 伤害$/, (m0, n) => `dealt ${n} damage`],
    [/^(\d+) 天前$/, (m0, n) => `${n} d ago`],
    [/^上一代（(.+?)）被 (.+) 斩杀$/, (m0, h, k) => `The last demon (${lookup(h) || h}) was slain by ${k}`],
    [/^上一代（(.+?)）没被打死，遁走了$/, (m0, h) => `The last demon (${lookup(h) || h}) escaped alive`],
    [/^你这一代造成 ([\d,]+) 伤害（出战 (\d+) 次）$/, (m0, d, n) => `You dealt ${d} damage to this generation (${n} run${n === '1' ? '' : 's'})`],
    [/^大家各自出战（不是同场联机），伤害都扣在这一只天魔身上。一次出战先抽三卷秘卷，再打 (\d+) 秒，天魔倒下会再站起来。天魔被斩杀或遁走后，按伤害发墨锭，伤害前三和斩杀者另得一个武器箱，下次打开武库自动领取。$/,
      (m0, n) => `Everyone fights on their own (not live together), and all damage lands on this one demon. Each run you draw three scrolls, then fight for ${n} seconds; the demon gets back up when it falls. When it is slain or escapes, Ink is paid out by damage, and the top three and the slayer each get a weapon case, collected the next time you open the Armory.`],
    [/^第 (\d+) \/ (\d+) 卷 · 天魔词缀：(.+)$/, (m0, a, b, x) => `Scroll ${a} / ${b} · Demon affixes: ${x === '无' ? 'none' : x.split('、').map(n => lookup(n) || n).join(', ')}`],
    [/^天魔讨伐 · 第 (\d+) 代$/, (m0, n) => `Demon Raid · Gen ${n}`],
    [/^这一战对天魔造成 ([\d,]+) 伤害，打倒它 (\d+) 次$/, (m0, d, n) => `You dealt ${d} damage to the demon and knocked it down ${n} time${n === '1' ? '' : 's'}`],
    [/^交不上：(.+)$/, (m0, x) => `Couldn't submit: ${lookup(x) || x}`],
    [/^计入全服 ([\d,]+) 伤害，最后一击斩杀了第 (\d+) 代天魔！奖励下次打开武库自动领取$/, (m0, d, n) => `${d} damage counted, and your last hit slew the Gen ${n} demon! Rewards are collected the next time you open the Armory`],
    [/^你出战时第 (\d+) 代天魔已被别人斩杀，这次伤害没有计入$/, (m0, n) => `The Gen ${n} demon was slain by someone else during your run, so this damage didn't count`],
    [/^已计入全服：([\d,]+) 伤害(（超过这次出战时长能打出的上限，按上限算）)?$/, (m0, d, cap) => `Counted for the server: ${d} damage${cap ? ' (above the most this run could deal, so capped)' : ''}`],
    // 排行榜说明
    [/^本赛季打满 (\d+) 场定级赛后上榜。段位从低到高：(.+)$/, (m0, n, ts) => `Finish ${n} placement matches this season to get on the board. Tiers, low to high: ${ts.split('、').map(t => { const m = t.match(/^(\S+) (.+)$/); return m ? `${m[1]} ${lookup(m[2]) || m[2]}` : t; }).join(', ')}`],
    [/^已注册玩家 (\d+) 位，按联机胜场排$/, (m0, n) => `${n} registered players, ranked by online wins`],
    [/^选择 (.+)$/, (m0, n) => `Pick ${lookup(n) || n}`],
    [/^禁用 (.+)$/, (m0, n) => `Ban ${lookup(n) || n}`],
    [/^\+(\d+) 墨锭$/, (m0, n) => `+${n} Ink`],
    [/^补领到 (\d+) 墨锭$/, (m0, n) => `Claimed ${n} Ink you had earned earlier`],
    [/^关卡星 \+(\d+) 墨锭$/, (m0, n) => `Stage stars +${n} Ink`],
    [/^侠客现在都能直接用，补偿改发 (\d+) 墨锭$/, (m0, n) => `Every hero is playable now, so the compensation is ${n} Ink`],
    [/^一键领取完成：\+(\d+) 墨锭$/, (m0, n) => `Claimed everything: +${n} Ink`],
    [/^皮肤 · (.+)$/, (m0, n) => `Skin · ${lookup(n) || n}`],
    [/^生命 (\d+)$/, (m0, n) => `HP ${n}`],
    [/^体量 ([\d.]+)$/, (m0, n) => `Build ${n}`],
    [/^移速 ([\d.]+)$/, (m0, n) => `Speed ${n}`],
    [/^耐力 (\d+) · 稳定 (\d+)% · 透伤 (\d+)% · 回涌 (\d+)\/秒$/, (m0, a, b, c, d) => `Guard ${a} · Stability ${b}% · Chip ${c}% · Regen ${d}/s`],
    [/^· 伤害 ([\d.]+)(?: \((\d+)段\))?$/, (m0, d, n) => `· Damage ${d}${n ? ` (${n} hits)` : ''}`],
    [/^([QRE]) · (.+?)(?: \[(.+)\])?$/, (m0, k, n, t) => `${k} · ${lookup(n) || n}${t ? ` [${lookup(t) || t}]` : ''}`],
    [/^(.+?) \[(.+)\]$/, (m0, n, t) => `${lookup(n) || n} [${lookup(t) || t}]`],
    [/^(2v2 .+?) · (凯旋大捷！|惜败，择日再战！) 比分 (\d+) : (\d+)$/, (m0, mode, r, a, b) => `${lookup(mode) || mode} · ${r === '凯旋大捷！' ? 'Victory!' : 'Close loss, fight again another day!'} Score ${a} : ${b}`],   // 2v2 结算
    // 账号、云存档、备份导入（src/game/24-account-01-profile.js、src/cloud.js）和云端接口回的提示
    [/^墨锭 (\d+)$/, (m0, n) => `Ink ${n}`],
    [/^(\d+) 分钟前$/, (m0, n) => `${n} min ago`],
    [/^(\d+) 小时前$/, (m0, n) => `${n} h ago`],
    [/^上次上传：(.+)$/, (m0, x) => `Last upload: ${lookup(x) || x}`],
    [/^(·\s*)?最近在用：(.+)$/, (m0, p, x) => `${p || ''}Last used: ${lookup(x) || x}`],
    [/^更新前登录的 (\d+) 处，分不出是哪台设备$/, (m0, n) => `${n} sign-in${n === '1' ? '' : 's'} from before the update (device unknown)`],
    [/^请求失败 \((\d+)\)$/, (m0, n) => `Request failed (${n})`],
    [/^上传失败，(\d+) 秒后自动重试$/, (m0, n) => `Upload failed, retrying in ${n}s`],
    [/^(.+)，重新登录后会自动补传存档$/, (m0, x) => `${lookup(x) || x}. Log in again and your save uploads automatically`],
    [/^(.+)，本机存档不受影响，可先导出备份$/, (m0, x) => `${lookup(x) || x}. Your local save is safe; you can export a backup first`],
    [/^服务器内部错误（编号 (\w+)）$/, (m0, id) => `Server error (ref ${id})`],
    [/^升级失败：(.+)$/, (m0, x) => `Upgrade failed: ${lookup(x) || x}`],
    [/^欢迎归来，(.+)！已载入存档$/, (m0, n) => `Welcome back, ${n}! Save loaded`],
    [/^注册成功！大侠 (.+)，已开启专属存档$/, (m0, n) => `Registered! Welcome, ${n}. Your save is ready`],
    [/^配置格式错误：(.+)$/, (m0, x) => `Invalid setting: ${x}`],
    [/^-- 选择导入包中的账号（共 (\d+) 位） --$/, (m0, n) => `-- Pick an account from the backup (${n} total) --`],
    [/^(.+) \((\d+)墨锭 · (\d+)英雄 · (\d+)皮肤 · (\d+)胜(\d+)负\)$/, (m0, n, ink, h, k, w, l) => `${n} (${ink} Ink · ${h} heroes · ${k} skins · ${w}W ${l}L)`],
    [/^已成功继承【(.+)】！已解锁 (\d+) 位英雄、(\d+) 款皮肤、(\d+) 墨锭！$/, (m0, n, h, k, ink) => `Inherited "${n}"! Unlocked ${h} heroes, ${k} skins and ${ink} Ink!`],
    [/^已成功导入【(.+)】$/, (m0, n) => `Imported "${n}"`],
    [/^已切换到导入的本机账号【(.+?)】：(\d+) 位英雄、(\d+) 墨锭。(?:(.+)。)?$/, (m0, n, h, ink, note) => `Switched to the imported local account "${n}": ${h} heroes, ${ink} Ink.` + (note ? ` ${lookup(note) || note}.` : '')],
    [/^已切换到导入的本机账号【(.+?)】(?:（(.+)）)?$/, (m0, n, note) => `Switched to the imported local account "${n}"` + (note ? ` (${lookup(note) || note})` : '')],
    [/^已载入全备份包（共 (\d+) 个账号）$/, (m0, n) => `Loaded the full backup (${n} accounts)`],
    [/^成功恢复 (\d+) 个账号，请在下拉框选择切换！$/, (m0, n) => `Restored ${n} accounts, pick one from the list to switch`],
    [/^成功恢复 (\d+) 个账号$/, (m0, n) => `Restored ${n} accounts`],
    [/^已读取 (.+)（(\d+) 个账号）$/, (m0, f, n) => `Read ${f} (${n} accounts)`],
    [/^成功载入 (\d+) 个账号数据$/, (m0, n) => `Loaded ${n} accounts`],
    [/^导入失败：(.+)$/, (m0, x) => `Import failed: ${lookup(x) || x}`],
    [/^文件解析失败：(.+)$/, (m0, x) => `Couldn't read the file: ${lookup(x) || x}`],
    // 侠客列传（src/game/04-modes/22-saga.js）：「第 1 节 · 竹林 · 断剑」「对手 铁山 · 击败对手」由拼接短语那一步逐段查
    [/^【这一战】(.+?)(?:，开局只剩 (\d+)% 生命)?$/, (m0, goal, hp) => `[This Fight] ${lookup(goal) || goal}${hp ? ` · Start at ${hp}% HP` : ''}`],
    [/^第 (\d+) 节走完(?:，获得 (\d+) 墨锭)?$/, (m0, chapter, ink) => `Chapter ${chapter} complete${ink ? ` · +${ink} Ink` : ''}`],
    [/^—— 结局 · 「([^」]+)」 ——(?:　获得 (\d+) 墨锭)?$/, (m0, title, ink) => `Ending · ${lookup(title) || title}${ink ? ` · +${ink} Ink` : ''}`],
    [/^结局：((?:「[^」]+」)+)$/, (m0, titles) => `Endings: ${[...titles.matchAll(/「([^」]+)」/g)].map(([, title]) => lookup(title) || title).join(', ')}`],
    [/^第 (\d+) 节$/, (m0, n) => `Chapter ${n}`],
    [/^对手 (.+)$/, (m0, h) => `Opponent: ${lookup(h) || h}`],
    [/^撑过 (\d+) 秒$/, (m0, n) => `Survive ${n}s`],
    [/^(\d+) 秒内击败对手$/, (m0, n) => `Win within ${n}s`],
    // 3v3 点将台阵线（src/game/05-ui/23-prematch-04-ban-pick-ui.js）
    [/^(.+)阵线$/, (m0, x) => x === '你' ? 'Your Lineup' : lookup(x) ? `${lookup(x)} Lineup` : m0],
    [/^(先锋|中坚|大将) (.+)$/, (m0, s, h) => `${lookup(s) || s} ${lookup(h) || h}`],
    // 图鉴招式卡的伤害（src/game/05-ui/18-codex-content.js）
    [/^(\d+) \((\d+)段\)$/, (m0, d, n) => `${d} (${n} hits)`],
    [/^(\d+)上限$/, (m0, n) => `${n} cap`],
    // 武库（src/armory.js、src/armory-core.js）
    [/^(.+)武器箱$/, (m0, c) => lookup(c) ? `${lookup(c)} Case` : m0],
    [/^(.+)典藏匣$/, (m0, c) => lookup(c) ? `${lookup(c)} Collector's Chest` : m0],
    [/^(精铁|碧玉|灵犀|赤霄|绝世|斩数版) ([\d.]+%)$/, (m0, t, p) => `${lookup(t)} ${p}`],
    [/^(精铁|碧玉|灵犀|赤霄) →(?: (精铁|碧玉|灵犀|赤霄|绝世))?$/, (m0, a, b) => `${lookup(a)} →${b ? ' ' + lookup(b) : ''}`],
    [/^集齐这个箱子的 (\d+) 款精铁：(\d+)\/(\d+)，送 1 个(.+)武器箱 \+ 1 张改名标签$/, (m0, n, a, b, c) => `Collect all ${n} Iron items from this case: ${a}/${b}. Reward: 1 ${lookup(c) || c} Case + 1 Rename Tag`],
    [/^库存里的(精铁|碧玉|灵犀|赤霄)饰品$/, (m0, t) => `Your ${lookup(t)} cosmetics`],
    [/^放进 (\d+) 件(精铁|碧玉|灵犀|赤霄)饰品，换 1 件(碧玉|灵犀|赤霄|绝世)。出什么取决于材料来自哪个武器箱；斩数版只能和斩数版一起换，换出来的也是斩数版。$/,
      (m0, n, a, b) => `Put in ${n} ${lookup(a)} cosmetics to get 1 ${lookup(b)}. What you get depends on which cases the materials came from; Kill Counter items only trade with Kill Counter items and give a Kill Counter item.`],
    [/^还有 (\d+) 台没开封$/, (m0, n) => `${n} unopened`],
    [/^货郎在商店按固定价格卖（一台 ([\d,]+) 墨锭），每周补给、星章兑换也有，新手礼也送一台。$/, (m0, n) => `Peddlers are sold in the shop at a fixed price (${n} Ink each). The weekly supply, the Star Exchange and the starter gift also give them.`],
    [/^每天限开 (\d+) 个$/, (m0, n) => `${n} per day`],
    [/^每周限开 (\d+) 个$/, (m0, n) => `${n} per week`],
    [/^赤霄和绝世加起来 ([\d.]+%)$/, (m0, p) => `Crimson + Peerless: ${p}`],
    [/^(十二星座，每位侠客都有星辉、星焰、星冕三款。每个号都送了 1 个星座武器箱，可以先免费开一次。)?只出这三档，这 (\d+) 款饰品别的武器箱都开不出来，开它也不占每天那 (\d+) 个普通武器箱。点一下饰品，就能先看看穿上的样子。$/,
      (m0, z, n, d) => `${z ? lookup(z) + ' ' : ''}Only these three tiers drop. These ${n} cosmetics come from no other case, and opening this one doesn't use up your ${d} daily standard cases. Click a cosmetic to preview it.`],
    [/^(\d+) 天没有成交$/, (m0, n) => `No sales in ${n} days`],
    [/^收录全部 (\d+) 款皮肤。点选查看效果、所属套装和获取方式。$/, (m0, n) => `All ${n} skins. Click one to see its effects, its set and how to get it.`],
    [/^(\d+) 款$/, (m0, n) => `${n} skins`],
    [/^(\d+) 款已拥有$/, (m0, n) => `${n} owned`],
    [/^第 (\d+) 季$/, (m0, n) => `Season ${n}`],
    [/^本季共得 (\d+)$/, (m0, n) => `${n} earned this season`],
    [/^这周再打 (\d+) 局解锁（(\d+)\/(\d+)）$/, (m0, n, a, b) => `Play ${n} more this week to unlock (${a}/${b})`],
    [/^(\d+) 墨锭$/, (m0, n) => `${n} Ink`],
    [/^(\d+) 星章兑换$/, (m0, n) => `Redeem for ${n} Star${n === '1' ? '' : 's'}`],
    [/^对局掉落：每局 (\d+)% 机会掉一件饰品或武器箱，每周最多 (\d+) 次（本周已掉 (\d+) 次）。$/, (m0, p, m, k) => `Match drops: each match has a ${p}% chance to drop a cosmetic or case, up to ${m} per week (${k} this week).`],
    // 江湖行动的任务（src/armory-core.js 的 C.MISSIONS，{n} 换成数字以后的样子）
    [/^进行 (\d+) 局对战$/, (m0, n) => `Play ${n} match${n === '1' ? '' : 'es'}`],
    [/^赢下 (\d+) 局$/, (m0, n) => `Win ${n} match${n === '1' ? '' : 'es'}`],
    [/^用(.+)赢下 (\d+) 局$/, (m0, h, n) => `Win ${n} match${n === '1' ? '' : 'es'} as ${lookup(h) || h}`],
    [/^在劲敌或更高难度下赢 (\d+) 局人机$/, (m0, n) => `Win ${n} match${n === '1' ? '' : 'es'} vs AI on ${lookup('劲敌')} or above`],
    [/^以 2 : 0 拿下 (\d+) 局$/, (m0, n) => `Win ${n} match${n === '1' ? '' : 'es'} 2 : 0`],
    [/^一局里打出 (\d+) 连击$/, (m0, n) => `Land a ${n}-hit combo in one match`],
    [/^施展 (\d+) 次终极奥义$/, (m0, n) => `Use ${n} ultimate${n === '1' ? '' : 's'}`],
    [/^联机对战 (\d+) 局$/, (m0, n) => `Play ${n} online match${n === '1' ? '' : 'es'}`],
    [/^打 (\d+) 局(问剑密卷|天机乱斗|2v2)$/, (m0, n, x) => `Play ${n} ${lookup(x) || x} match${n === '1' ? '' : 'es'}`],
    [/^赢下 (\d+) 局 3v3 车轮战$/, (m0, n) => `Win ${n} ${lookup('3v3 车轮战')} match${n === '1' ? '' : 'es'}`],
    [/^开启 (\d+) 个武器箱$/, (m0, n) => `Open ${n} case${n === '1' ? '' : 's'}`],
    [/^签 (\d+) 份熔铸契$/, (m0, n) => `Sign ${n} ${lookup('熔铸契')}${n === '1' ? '' : 's'}`],
    [/^在玩家市场(卖出|买入) (\d+) 件饰品$/, (m0, v, n) => `${v === '卖出' ? 'Sell' : 'Buy'} ${n} cosmetic${n === '1' ? '' : 's'} on the player market`],
    [/^默认：(.+)$/, (m0, k) => `Default: ${lookup(k) || k}`],
    [/^共 (\d+) 枚$/, (m0, n) => `${n} total`],
    [/^一键开启全部（(\d+)）$/, (m0, n) => `Open all (${n})`],
    [/^🏅 徽记：未装备$/, '🏅 Emblem: none']
  ];
  // ---------- 한국어 패턴 ----------
  const KO_DUR = s => String(s).replace(/(\d+)\s*天/g, '$1일 ').replace(/(\d+)\s*小时/g, '$1시간 ').replace(/(\d+)\s*分(?:钟)?/g, '$1분').replace(/\s+/g, ' ').trim();
  const PATTERNS_KO = [
    [/^第([一二三四五六七八九十\d]{1,3})局 · (?:开战！|전투！)$/, (m, n) => `${'一二三四五六七八九十'.indexOf(n) >= 0 ? '一二三四五六七八九十'.indexOf(n) + 1 : n}세트 · 전투 시작!`],
    [/^第([一二三四五六七八九十\d]{1,3})回合$/, (m, n) => `${'一二三四五六七八九十'.indexOf(n) >= 0 ? '一二三四五六七八九十'.indexOf(n) + 1 : n}라운드`],
    [/^《(?:天工传世|천공 가보) · 器灵纪》全 20 位.*$/, () => '《천공 가보 · 기령기》 20명 협객 컬렉션 기령입니다. 전 시리즈 처치 카운터판만 존재하며(일반판 없음) 아직 없는 스타일이 우선 나오고, 착용하면 실전 전용 공수 쌍경이 해금됩니다.'],
    [/^(十二.{0,3}，.*?)?只出这三档，这 (\d+) 款.*?那 (\d+) .*?。点一下.*$/, (m, pre, n, d) => (pre ? '황도 12궁: 협객마다 별빛·별불꽃·별의 관 세 가지가 있습니다. 계정마다 황도 상자 1개를 드리며 먼저 무료로 한 번 열 수 있습니다. ' : '') + `이 세 등급만 나오며, 이 ${n}종 장신구는 다른 상자에서는 나오지 않고 열어도 하루 일반 상자 ${d}개 한도에 포함되지 않습니다. 장신구를 누르면 착용한 모습을 먼저 볼 수 있습니다.`],
    // 무기고 등: 코드가 일부 용어를 먼저 번역해 중·한이 섞여 들어오는 문장 (섞인 형태와 원문 형태를 모두 받는다)
    [/^收录(?:全部|전체) (\d+) 款(?:皮肤|스킨)。点选查看效果、所属套装和获取方式。$/, (m, n) => `스킨 총 ${n}종. 눌러서 효과, 소속 세트, 획득 방법을 확인하세요.`],
    [/^(\d+) 款 · (\d+) 款(?:已拥有|보유)$/, (m, a, b) => `${a}종 · ${b}종 보유`],
    [/^每(?:累计斩获|통산 KO) (\d+) 次可得 1 枚(?:徽记碎片|휘장 조각)。点击右上角 FULL AUTO 可一键全阵容最优(?:装配|장착)。$/, (m, n) => `누적 처치 ${n}회마다 휘장 조각 1개를 받습니다. 우측 상단 완전 자동를 누르면 전 라인업을 최적으로 한 번에 장착합니다.`],
    [/^立即(?:领取|수령)：50,000 (?:墨锭|먹) \+ 全系列(?:武器箱|상자)各 10 个 \+ 50 (?:徽记碎片|휘장 조각) \+ (?:全部灵宠与招式流派|전체펫与기술 유파) \+ 任选 1 枚最高阶「(?:紫金徽记|자금 휘장记)」！$/, () => '지금 수령: 먹 50,000 + 전 시리즈 무기 상자 각 10개 + 휘장 조각 50개 + 모든 펫과 기술 유파 + 최고 등급 「자금 휘장」 1개 자유 선택!'],
    [/^(?:普通|일반)和(?:神兵|신병) (?:武器箱|상자)每天零点刷新，(?:星座|황도)与(?:天工传世|천공 가보)匣每周一刷新；(?:武器箱|상자)在商店按固定价格买，不限量$/, () => '일반·신병 상자는 매일 0시에 갱신되고, 황도·천공 가보 상자는 매주 월요일에 갱신됩니다. 상자는 상점에서 고정 가격으로 살 수 있으며 수량 제한이 없습니다.'],
    [/^《(?:天工传世 · 器灵纪|천공 가보 · 器灵纪)》全 20 位(?:侠客|협객)典藏器灵，全系仅存(?:斩数版|처치 카운터)（无(?:普通版|일반판)），优先开出(?:未拥有|미보유)款式；穿戴即(?:解锁|해금)实战专属攻守双境。$/, () => '《천공 가보 · 기령기》 20명 협객 컬렉션 기령입니다. 전 시리즈 처치 카운터판만 존재하며(일반판 없음) 아직 없는 스타일이 우선 나오고, 착용하면 실전 전용 공수 쌍경이 해금됩니다.'],
    [/^每(天|周)限开 (\d+) 个 · (?:绯红|진홍)和(?:绝世|독보적)加起来 (\d+)%$/, (m, d, n, p) => `${d === '天' ? '하루' : '주간'} 개봉 한도 ${n}개 · 진홍과 독보적 합산 ${p}%`],
    [/^(十二(?:星座|황도)，每位(?:侠客|협객)都有(?:星辉、星焰、星冕|별빛、별불꽃、별의 관)三款。每个号都送了 1 个(?:星座武器箱|황도 상자)，可以先免费开一次。)?只出这三档，这 (\d+) 款(?:饰品|장신구)别的(?:武器箱|상자)都开不出来，开它也不占每天那 (\d+) 个(?:普通武器箱|일반 상자)。点一下(?:饰品|장신구)，就能先(?:看看穿上的样子|미리보기:)。?$/, (m, pre, n, d) => (pre ? '황도 12궁: 협객마다 별빛·별불꽃·별의 관 세 가지가 있습니다. 계정마다 황도 상자 1개를 드리며 먼저 무료로 한 번 열 수 있습니다. ' : '') + `이 세 등급만 나오며, 이 ${n}종 장신구는 다른 상자에서는 나오지 않고 열어도 하루 일반 상자 ${d}개 한도에 포함되지 않습니다. 장신구를 누르면 착용한 모습을 먼저 볼 수 있습니다.`],
    [/^集齐这个箱子的 (\d+) 款(?:精铁|철)：(\d+)\/(\d+)，送 1 个(.+?)(?:武器箱|상자) \+ 1 张(?:改名标签|이름표 변경)$/, (m, n, a, b, c) => `이 상자의 정철 ${n}종을 모두 모으세요: ${a}/${b}. 보상: ${c} 무기 상자 1개 + 이름 변경권 1장`],
    [/^(?:货郎|행상)在商店按固定价格卖（一台 500 (?:墨锭|먹)），(?:每周补给|주간 보급)、(?:星章兑换所|별 교환소)也有，(?:新手礼|신규 선물)也送一台。$/, () => '행상은 상점에서 고정 가격(1대 먹 500)으로 팔며 주간 보급과 별 교환소에도 있고 신규 선물로도 1대 드립니다.'],
    [/^(?:一键开启全部|모두 열기)会一次性打开所有可用(?:货郎|행상)并直接将(?:奖励|보상)收入(?:库存|보관함)；(?:逐台开封|하나 열기)时 5 件都不要或 3 天内不处理会作废。$/, () => '‘모두 열기’는 사용 가능한 행상을 한꺼번에 열어 보상을 곧바로 보관함에 넣습니다. 하나씩 열 때 5개를 모두 받지 않거나 3일 안에 처리하지 않으면 무효가 됩니다.'],
    [/^(?:玩家市场|플레이어 장터)只卖(?:饰品|장신구)：每一件都是别的玩家挂的，标价全由卖家自己定，系统不定价、也不收购；成交扣 (\d+)% 手续费。(?:武器箱|상자)和(?:货郎|행상)在商店按固定价格买。$/, (m, p) => `플레이어 장터는 장신구만 팝니다. 모든 물건은 다른 플레이어가 등록한 것이며 가격은 판매자가 정하고 시스템은 가격을 정하거나 매입하지 않습니다. 거래 시 수수료 ${p}%가 차감됩니다. 상자와 행상은 상점에서 고정 가격으로 살 수 있습니다.`],
    [/^플레이어 장터는 클라우드 계정으로 로그인하고 서버에 연결해야 사용할 수 있습니다：.+$/, () => '플레이어 장터는 클라우드 계정으로 로그인하고 서버에 연결해야 사용할 수 있습니다. 로컬 저장으로는 상자 열기와 주조만 가능하며 다른 플레이어와 사고팔 수 없습니다.'],
    [/^放进 (\d+) 件(?:铁|철)(?:饰品|장신구)，换 1 件(?:翡翠|비취)。出什么取决于材料来自哪个(?:武器箱|상자)；(?:斩数版|처치 카운터)只能和(?:斩数版|처치 카운터)一起换，换出来的也是(?:斩数版|처치 카운터)。$/, (m, n) => `철 장신구 ${n}개를 넣으면 비취 1개로 바뀝니다. 무엇이 나올지는 재료가 어느 상자에서 왔는지에 따라 다르며, 처치 카운터판은 처치 카운터판끼리만 교환할 수 있고 결과물도 처치 카운터판입니다.`],
    [/^(?:库存|보관함)里的(?:铁|철)(?:饰品|장신구)$/, () => '보관함의 철 장신구'],
    [/^这周再打 (\d+) 局(?:解锁|해금)（(\d+)\/(\d+)）$/, (m, n, a, b) => `이번 주 ${n}판 더 플레이하면 해금(${a}/${b})`],
    [/^(?:对局掉落|대전 드롭)：每局 (\d+)% 机会掉一件(?:饰品|장신구)或(?:武器箱|상자)，每周最多 (\d+) 次（本周已掉 (\d+) 次）。$/, (m, p, mx, d) => `대전 드롭: 한 판마다 ${p}% 확률로 장신구나 상자 1개가 나오며 주간 최대 ${mx}회(이번 주 ${d}회 드롭)입니다.`],
    [/^“蓄满(.+)，格挡在它面前像纸一样薄。”$/, (m, move) => lookup(move) ? `“${lookup(move)}을(를) 끝까지 모으면 가드도 종이처럼 찢깁니다.”` : m],
    [/^“凌空使出(.+)，制空追击一气呵成。”$/, (m, move) => lookup(move) ? `“공중에서 ${lookup(move)}을(를) 써서 제공권 추격을 한 번에 이어 가세요.”` : m],
    [/^“(.+)一出，(.+)让对手措手不及。”$/, (m, move, effect) => lookup(move) && lookup(effect) ? `“${lookup(move)}을(를) 쓰면 상대가 허를 찔립니다. 효과: ${lookup(effect)}.”` : m],
    [/^“(.+)顺势抽身，化险为夷。”$/, (m, move) => lookup(move) ? `“${lookup(move)}(으)로 위기에서 몸을 빼내세요.”` : m],
    [/^“气满施展「(.+)」，(.+)定乾坤。”$/, (m, move, effect) => lookup(move) && lookup(effect) ? `“게이지가 가득 차면 ${lookup(move)}을(를) 쓰세요. 효과: ${lookup(effect)}.”` : m],
    [/^总伤害\s*(\d+)\s*·\s*最长连击\s*(\d+)\s*·\s*破防\s*(\d+)\s*·\s*坠崖\s*(\d+)$/, (m0, damage, combo, breaks, falls) => `총 피해 ${damage} · 최장 콤보 ${combo} · 가드 파괴 ${breaks} · 낙사 ${falls}`],
    [/^今日\s*(\d+)\/(\d+)(?:\s*·\s*可领\s*(\d+)\s*墨锭)?$/, (m0, a, b, c) => `오늘 ${a}/${b}` + (c ? ` · 먹 ${c} 수령 가능` : '')],
    [/^(.+?)\s*位侠士在线$/, (m0, n) => `협객 ${n}명 접속 중`],
    [/^剩\s*(\d+)\s*天$/, (m0, d) => `${d}일 남음`],
    [/^全服\s*(.+?)\s*人在线$/, (m0, n) => `전체 서버 · ${n}명 접속 중`],
    [/^(\d+)\s*人在线\s*·\s*(.+)$/, (m0, n, rest) => `${n}명 접속 중 · ${lookup(rest) || rest}`],
    [/^对局中\s*(\d+)\s*人(?:\s*·\s*匹配中\s*(\d+)\s*人)?$/, (m0, p, w) => `대전 중 ${p}명` + (w ? ` · 매칭 중 ${w}명` : '')],
    [/^(.+?)\s*人在线$/, (m0, n) => `${n}명 접속 중`],
    [/^(\d+\.\d+\s*[–-]\s*\d+\.\d+)\s*·\s*剩余\s*(.+)$/, (m0, span, left) => `${span} · ${KO_DUR(left)} 남음`],
    [/^剩余\s*(\d.*)$/, (m0, left) => `${KO_DUR(left)} 남음`],
    [/^在玩家市场(卖出|买入) (\d+) 件饰品$/, (m0, v, n) => `플레이어 시장에서 장식품 ${n}개 ${v === '卖出' ? '판매' : '구매'}`],
    [/^默认：(.+)$/, (m0, k) => `기본: ${lookup(k) || k}`],
    [/^共 (\d+) 枚$/, (m0, n) => `총 ${n}개`],
    [/^一键开启全部（(\d+)）$/, (m0, n) => `모두 열기 (${n})`],
    [/^🏅 徽记：未装备$/, '🏅 휘장: 없음'],
    [/^已升级 (\d+) 件斩数版，省下 ([\d,]+) 墨锭$/, (m0, n, saved) => `${n}개를 처치 카운터 에디션으로 업그레이드하고 먹 ${saved}을(를) 절약했습니다`],
    [/^(\d+:\d{2}) · 全服随机$/, (m0, t) => `${t} · 전체 서버 무작위`],
    [/^(\d+:\d{2}) · 匹配范围 (.+?)(?:–(.+?))? 段$/, (m0, t, a, b) => `${t} · 범위 ${lookup(a) || a}${b ? `–${lookup(b) || b}` : ''}`],
    [/^排位赛：(.+)$/, (m0, r) => `랭크전: ${lookup(r) || r}`],
    [/^定级赛 (\d+)\/(\d+) · ～(\d+) 分$/, (m0, a, b, c) => `배치전 ${a}/${b} · 약 ${c}점`],
    [/^([A-Z]\d*) · (.+?) · ([\d,]+) 分$/, (m0, l, n, p) => `${l} · ${lookup(n) || n} · ${p}점`],
    [/^检测到邀请房间码 (\S+)，正在自动加入…$/, (m0, c) => `초대 방 코드 ${c}을(를) 확인했습니다. 자동으로 입장하는 중…`],
    [/^中途离开排位赛，判负（(.+?) 分）$/, (m0, d) => `랭크전 도중 이탈: 패배 처리 (${d}점)`],
    [/^你的版本与房主不同（房主是 (.+?)），刷新网页再试$/, (m0, v) => `방장과 버전이 다릅니다 (방장: ${v}). 페이지를 새로고침하고 다시 시도하세요`],
    [/^第\s*(\d+)\s*\/\s*(\d+)\s*步$/, (m0, a, b) => `${a} / ${b} 단계`],
    [/^(\d+)\s*\/\s*(\d+)\s*步$/, (m0, a, b) => `${a} / ${b} 단계`],
    [/^(\d+(?:\.\d+)?)\s*秒$/, (m0, n) => `${n}초`],
    [/^已设定切磋规则：(.+)$/, (m0, r) => `대련 규칙을 정했습니다: ${lookup(r) || r}`],
    [/^擂主已设定切磋规则：(.+)$/, (m0, r) => `방장이 대련 규칙을 정했습니다: ${lookup(r) || r}`],
    [/^(.+)（只做一次）$/, (m0, a) => `${lookup(a) || a} (한 번만)`],
    [/^按 (\S+) 换对手行为 \| F1 判定框 · Hz 慢放 · 单帧推进$/, (m0, k) => `${k}: 상대 행동 변경 · F1 판정 상자 · Hz 슬로모션 · 한 프레임씩`],
    [/^回放 · 第(\d+)回合( · 已暂停)? · F1 判定框$/, (m0, n, paused) => `리플레이 · ${n}라운드${paused ? ' · 일시정지' : ''} · F1 판정 상자`],
    [/^伤害交换占优：造成 (\d+)，承受 (\d+)。$/, (m0, dealt, taken) => `피해 교환 우세: 준 피해 ${dealt}, 받은 피해 ${taken}.`],
    [/^最长连击：(\d+) 段。$/, (m0, n) => `최장 콤보: ${n}타.`],
    [/^成功破防：(\d+) 次。$/, (m0, n) => `가드 파괴 성공: ${n}회.`],
    [/^约 (\d+)% 的攻击输入发生在较远距离，可能有部分出手够不到对手。$/, (m0, n) => `공격 입력의 약 ${n}%가 먼 거리에서 나와 일부는 상대에게 닿지 않았을 수 있습니다.`],
    [/^约 (\d+)% 的攻击输入发生时没有正对对手。$/, (m0, n) => `공격 입력의 약 ${n}%는 상대를 마주 보지 않은 상태였습니다.`],
    [/^本局坠崖 (\d+) 次，边缘位置需要更早回到场地中央。$/, (m0, n) => `이번 판에 ${n}번 낙사했습니다. 가장자리에서는 더 일찍 중앙으로 돌아오세요.`],
    [/^(\S+) 打开 · Esc 关闭$/, (m0, k) => `${k} 열기 · Esc 닫기`],
    [/^（冷却\s*(\d+(?:\.\d+)?)\s*秒）$/, (m0, n) => ` (쿨타임 ${n}초)`],
    [/^(.+?)禁用一名侠客$/, (m0, w) => `${lookup(w) || w} · 협객 하나 금지`],
    [/^(.+?)选择出战侠客$/, (m0, w) => `${lookup(w) || w} · 협객 선택`],
    [/^(.+?)钦点【(.+?)】出战$/, (m0, w, r) => `${lookup(w) || w} · ${lookup(r) || r} 지명`],
    [/^禁 (.+)$/, (m0, n) => `금지 · ${lookup(n) || n}`],
    [/^没找到名字里同时有「(.+)」这几个字的人，按回车按全名加$/, (m0, q) => `이름에 “${q}”이(가) 들어간 사람이 없습니다. Enter를 누르면 전체 이름으로 추가합니다`],
    [/^(.+?) · (限免|武库|青锋行 \/ 武库)$/, (m0, n, t) => `${lookup(n) || n} · ${{ 限免: '무료 체험', 武库: '무기고', '青锋行 / 武库': '청봉행 / 무기고' }[t]}`],
    [/^(碧玉|赤霄|灵犀|精铁|★ 绝世|绝世|传说|精英) · (.+)$/, (m0, g, n) => `${lookup(g) || g} · ${lookup(n) || n}`],
    [/^(快速上手|完整教学) (\d+) \/ (\d+)$/, (m0, w, a, b) => `${w === '快速上手' ? '빠른 시작' : '전체 튜토리얼'} ${a} / ${b}`],
    [/^难度 ([●○]+)$/, (m0, d) => `난이도 ${d}`],
    [/^平衡 · 伤害与气血 ×([\d.]+)$/, (m0, n) => `밸런스 · 피해와 체력 ×${n}`],
    [/^(伤害|普攻|技能|技能与大招|大招|气血) ×([\d.]+)$/, (m0, label, n) => `${{ 伤害: '피해', 普攻: '일반 공격', 技能: '기술', 技能与大招: '기술과 필살기', 大招: '필살기', 气血: '체력' }[label]} ×${n}`],
    [/^(正常|原速) ([\d.]+)x$/, (m0, w, n) => `보통 ${n}x`],
    [/^慢放 ([\d.]+)x$/, (m0, n) => `슬로 ${n}x`],
    [/^(你赢了|你输了)，比分 (\d+) : (\d+)$/, (m0, r, a, b) => `${r === '你赢了' ? '승리' : '패배'} · 점수 ${a} : ${b}`],
    [/^比分 (\d+) : (\d+)$/, (m0, a, b) => `점수 ${a} : ${b}`],
    [/^\+(\d+) 墨锭 · 联机(胜|负)（累计 (\d+) 胜）$/, (m0, g, r, n) => `+${g} 먹 · 온라인 ${r === '胜' ? '승리' : '패배'} (누적 ${n}승)`],
    [/^2v2 天道演武决出胜负，比分 (\d+) : (\d+)$/, (m0, a, b) => `2v2 천도 연무 결판 · 점수 ${a} : ${b}`],
    [/^三阵连克，斩获 (\d+) 墨锭！（击破比分 (\d+) : (\d+)）$/, (m0, g, a, b) => `세 진 연승, +${g} 먹! (격파 점수 ${a} : ${b})`],
    [/^胜败乃兵家常事，重整旗鼓再战（击破比分 (\d+) : (\d+)）$/, (m0, a, b) => `승패는 병가지상사입니다. 다시 정비해 재도전하세요 (격파 점수 ${a} : ${b})`],
    [/^同袍肉鸽 · 第 (\d+) 重魔劫 · 全员收益共享$/, (m0, n) => `동료 로그라이크 · 마겁 ${n}단계 · 전원 수익 공유`],
    [/^(?:🎉 )?讨伐大捷！全员共享斩获 \+(\d+) 墨锭（累计收获 (\d+) 墨锭 · 全队共鸣 (\d+) 卷秘卷）$/, (m0, g, t, n) => `토벌 대승! 전원 +${g} 먹 공유 (이번 판 누적 먹 ${t} · 공유 비전 두루마리 ${n}개)`],
    [/^惜败于六技融魂首领【(.+)】！全员仍获共享赏金 \+(\d+) 墨锭（本趟累计 (\d+) 墨锭）$/, (m0, h, g, t) => `여섯 기술 융합 두목 [${h.split('·').map(n => lookup(n) || n).join(' · ')}]에게 아쉽게 패했습니다. 전원 공유 현상금 +${g} 먹은 받습니다 (이번 판 누적 먹 ${t})`],
    [/^(.+) 融魂首领$/, (m0, h) => `${h.split('·').map(n => lookup(n) || n).join(' · ')} · 융합 두목`],
    [/^止步于万仞剑阁第 (\d+) 层，共领悟 (\d+) 卷武林秘籍！$/, (m0, f, n) => `만인 검각 ${f}층에서 멈췄고 무림 비급 ${n}권을 깨달았습니다!`],
    [/^最高纪录：第 (\d+) 层$/, (m0, f) => `최고 기록: ${f}층`],
    [/^同袍肉鸽虽败犹荣 · 全员共享抚恤 \+(\d+) 墨锭$/, (m0, g) => `동료 로그라이크: 패했지만 영예롭습니다 · 전원 위로금 +${g} 먹`],
    [/^(?:🎉 )?众志破魔大捷！全员共享丰厚悬赏 \+(\d+) 墨锭！$/, (m0, g) => `뜻을 모아 마귀를 쳐부쉈습니다! 전원 푸짐한 현상금 +${g} 먹!`],
    [/^“([\s\S]+)”$/, (m0, x) => { const t = lookup(x); return t ? `“${t}”` : ''; }],
    [/^被动 · (.+)$/, (m0, n) => `패시브 · ${lookup(n) || n}`],
    [/^左键\+右键 · (.+)$/, (m0, n) => `좌+우클릭 · ${lookup(n) || n}`],
    [/^(\d+) 段 · 末段击飞(?: · 另有墨团 (\d+)×([\d.]+))?$/, (m0, n, k, d) => `${n}타 · 마지막 타 띄우기${k ? ` · 추가로 먹 덩이 ${k}×${d}` : ''}`],
    [/^第 (\d+) 章 · (.+)$/, (m0, n, x) => `${n}장 · ${lookup(x) || x}`],
    [/^（守关：(.+?) · 难度：(.+?)）$/, (m0, h, lv) => ` (수호자: ${lookup(h) || h} · 난이도: ${lookup(lv) || lv})`],
    [/^已破关 \(★(\d)\)$/, (m0, n) => `클리어 (★${n})`],
    [/^前往第 (\d+) 章试炼$/, (m0, n) => `${n}장 시련으로 이동`],
    [/^「([^·」]+)·([^·」]+)」$/, (m0, a, b) => { const x = lookup(a), y = lookup(b); if (x && y) return `“${x} · ${y}”`; const t = lookup(`${a}·${b}`); return t ? `“${t}”` : ''; }],
    [/^(.+) · ((?:天罡北斗|地煞幽冥|青龙出海|白虎啸风|朱雀振羽|玄武镇岳|破晓晨光|孤月映水|狂雷贯顶|炽火焚天)，.+)$/, (m0, a, b) => { const x = lookup(a), y = lookup(b); return x && y ? `${x} · ${y}` : ''; }],
    [/^天机异变 · (.+)$/, (m0, n) => `이변 · ${lookup(n) || n}`],
    [/^山河异境 · (.+)$/, (m0, n) => `산하 이경 · ${lookup(n) || n}`],
    [/^坠崖 -(\d+)$/, (m0, n) => `낙사 -${n}`],
    [/^天雷 -(\d+)$/, (m0, n) => `천뢰 -${n}`],
    [/^「(.+)」$/, (m0, n) => { const t = lookup(n); return t ? `“${t}”` : ''; }],
    [/^侠客列传 · (.+?)传 · (.+)$/, (m0, h, t) => `협객 열전 · ${lookup(h) || h} 전 · ${lookup(t) || t}`],
    [/^走到第 (\d+) \/ (\d+) 节$/, (m0, a, b) => `${a} / ${b}절까지 진행`],
    [/^结局 ((?:「[^」]+」)+)$/, (m0, x) => `엔딩: ${x.slice(1, -1).split('」「').map(n => lookup(n) || n).join(', ')}`],
    [/^📖 (.+)（([^（）]+)）$/, (m0, title, place) => `📖 ${lookup(title) || title} (${lookup(place) || place})`],
    [/^(.+) \((\d+)波妖\)$/, (m0, name, count) => `${lookup(name) || name} (${count}파)`],
    [/^(.+) · 魔首决战$/, (m0, name) => `${lookup(name) || name} · 마두 결전`],
    [/^(\S+?)传 · (.+?)(?: · (.+))?$/, (m0, h, t, st) => { const a = lookup(t); return a ? `${lookup(h) || h} 전 · ${a}${st ? ` · ${lookup(st) || st}` : ''}` : ''; }],
    [/^(\S{2,3})：「([\s\S]+)」$/, (m0, h, x) => { const t = lookup(x); return t ? `${lookup(h) || h}: “${t}”` : ''; }],
    [/^第 (\d+) 幕$/, (m0, n) => `제${n}막`],
    [/^(\d+\.\d+) (破关|折戟)$/, (m0, id, r) => `${id} ${r === '破关' ? '클리어' : '실패'}`],
    [/^折在第 (\d+) \/ (\d+) 波，共击退 (\d+) 只妖物$/, (m0, a, b, n) => `${a} / ${b}파에서 쓰러졌고 마물 ${n}마리를 물리쳤습니다`],
    [/^同袍残存气血 (\d+)%，共斩灭 (\d+) 只妖物 ·$/, (m0, p, n) => `동료 남은 체력 ${p}%, 마물 ${n}마리 처치 ·`],
    [/^全员共享斩妖赏金 \+(\d+) 墨锭！$/, (m0, g) => `전원 마귀 토벌 현상금 +${g} 먹 공유!`],
    [/^(?:🎉 )?宿命通关奖励：已解锁【(.+?)】专属皮肤「(.+?)」！$/, (m0, h, k) => `운명 클리어 보상: ${lookup(h) || h}의 전용 스킨 “${lookup(k) || k}” 해금!`],
    [/^比分 (\d+) : (\d+)，再磨一磨剑$/, (m0, a, b) => `점수 ${a} : ${b}. 검을 더 갈고 다시 도전하세요`],
    [/^第 (\d+) \/ (\d+) 波妖潮$/, (m0, a, b) => `${a} / ${b}파`],
    [/^尚余 (\d+) 妖$/, (m0, n) => `${n}마리 남음`],
    [/^(\d+) 只$/, (m0, n) => n],
    [/^(\d+) 卷$/, (m0, n) => n],
    [/^关卡 (\d+\.\d+) · (.+)$/, (m0, id, n) => `스테이지 ${id} · ${lookup(n) || n}`],
    [/^终幕魔首降临 · (.+)$/, (m0, n) => `마지막 막 마두 강림 · ${lookup(n) || n}`],
    [/^决战【(.+)】$/, (m0, h) => `결전 [${h.split('·').map(n => lookup(n) || n).join(' · ')}]`],
    [/^全员共享 \+(\d+) 墨锭$/, (m0, g) => `전원 +${g} 먹 공유`],
    [/^群妖肃清！全队共享顿悟「(.+)」$/, (m0, n) => `마물 소탕! 팀 전체가 “${lookup(n) || n}” 깨달음을 공유합니다`],
    [/^(问剑|问剑密卷|万仞剑阁|天道爬塔) · 第 (\d+) 层$/, (m0, w, n) => `${{ 问剑: '문검', 问剑密卷: '문검 비권', 万仞剑阁: '만인 검각', 天道爬塔: '천도 등탑' }[w]} · ${n}층`],
    [/^问剑密卷 · 继续第 (\d+) 层$/, (m0, n) => `문검 비권 · ${n}층 이어서`],
    [/^库存中有 (\d+) 件普通饰品可升级。原价 ([\d,]+) 墨锭，20% 折扣省 ([\d,]+) 墨锭，实付 ([\d,]+) 墨锭。升级后所有饰品从 0 斩开始，编号和名字保留，不能退回普通版。$/, (m0, n, base, saved, price) => `보유 중인 일반 장식품 ${n}개를 업그레이드할 수 있습니다. 원가 먹 ${base}, 20% 할인으로 먹 ${saved} 절약, 실제 결제 먹 ${price}. 업그레이드 후 모든 장식품은 처치 0에서 시작하며 번호와 이름은 그대로이고 일반 버전으로 되돌릴 수 없습니다.`],
    [/^突破第 (\d+) 层 · 顿悟秘卷$/, (m0, n) => `${n}층 돌파 · 비권 깨달음`],
    [/^讨伐第 (\d+) 劫大捷 · 全员共享秘卷增益$/, (m0, n) => `${n}겁 토벌 대승 · 전원 비권 효과 공유`],
    [/^(\S) (\d+)\/(\d+)(?:：(.+))?$/, (m0, g, a, b, x) => `${g} ${a}/${b}${x ? `: ${lookup(x) || x}` : ''}`],
    [/^(已领悟|已带) (\d+) 卷(?: · (.+))?$/, (m0, w, n, x) => `${w === '已带' ? '소지' : '깨달음'} ${n}권${x ? ' · ' + x.split(' · ').map(r => lookup(r) || r).join(' · ') : ''}`],
    [/^画符 · (\d+)\/(\d+)$/, (m0, a, b) => `부적 · ${a}/${b}`],
    [/^符爆 ×(\d+)$/, (m0, n) => `부적 폭발 ×${n}`],
    [/^枪尖穿心 \((\d+)\/(\d+)\)$/, (m0, a, b) => `심장 관통 (${a}/${b})`],
    [/^剑坛赐福：(.+)$/, (m0, x) => `검단의 축복: ${lookup(x) || x}`],
    [/^(\d+) 连击$/, (m0, n) => `${n} 콤보`],
    [/^(\d+) 线 · (.+)$/, (m0, n, z) => `${n}번 채널 · ${lookup(z) || z}`],
    [/^(\d+) 人$/, (m0, n) => `${n}명`],
    [/^(\d+) 只（你 (\d+)）$/, (m0, a, b) => `${a} (나 ${b})`],
    [/^魔窟 · 余 (\d+) 秒$/, (m0, n) => `마굴 · ${n}초 남음`],
    [/^还差 (\d+) 只$/, (m0, n) => `${n}마리 더`],
    [/^天道(?: Boss|车轮) · 余 (\d+) 秒$/, m0 => m0.replace(/^天道 Boss/, '천도 보스').replace(/^天道车轮/, '천도 릴레이').replace(/余 (\d+) 秒$/, '$1초 남음')],
    [/^(\d+) \/ (\d+) 只$/, (m0, a, b) => `${a} / ${b}`],
    [/^第 (\d+) 轮 · 第 (\d+)\/(\d+) 劫$/, (m0, a, b, c) => `${a}라운드 · ${b}/${c}겁`],
    [/^正在进入 (\d+) 线…$/, (m0, n) => `${n}번 채널에 입장하는 중…`],
    [/^(\d+) 线已满，去 (\d+) 线…$/, (m0, a, b) => `${a}번 채널이 가득 차 ${b}번 채널로 이동하는 중…`],
    [/^江湖共斗 · (\d+) 线$/, (m0, n) => `강호 공동 전투 · ${n}번 채널`],
    [/^已有 (\d+) 位侠客在这条线上$/, (m0, n) => `이 채널에 협객 ${n}명이 있습니다`],
    [/^最后一击：(.+)$/, (m0, x) => `마지막 일격: ${x}`],
    [/^妖王伏诛！输出榜 (.*)$/, (m0, x) => `요왕 토벌 완료! 피해 순위: ${x}`],
    [/^(\d+) 秒后在土地庙复活$/, (m0, n) => `${n}초 뒤 토지묘에서 부활`],
    [/^第 (\d+) \/ (\d+) 劫 · 已有 (\d+) 卷秘卷$/, (m0, a, b, c) => `${a} / ${b}겁 · 비권 ${c}권 보유`],
    [/^本劫斩妖完成，(\d+) 秒内投票$/, (m0, n) => `이번 겁 토벌 완료, ${n}초 안에 투표하세요`],
    [/^(.+) · 第 (\d+)\/(\d+) 节$/, (m0, c, a, b) => `${lookup(c) || c} · ${a}/${b}절`],
    [/^江湖长卷推进 (\d+) 节$/, (m0, n) => `강호 장권이 ${n}절 나아갔습니다`],
    [/^长卷第 (\d+) 节完成$/, (m0, n) => `장권 ${n}절 완료`],
    [/^下一节：(.+)$/, (m0, x) => `다음 절: ${lookup(x) || x}`],
    [/^全服斩妖 (\d+) 只$/, (m0, n) => `전체 서버에서 마물 ${n}마리 처치`],
    [/^(竹林|古道|山寨|魔窟)斩妖 (\d+) 只$/, (m0, z, n) => `${lookup(z) || z}에서 마물 ${n}마리 처치`],
    [/^讨伐妖王 (\d+) 次$/, (m0, n) => `요왕 ${n}회 토벌`],
    [/^斩完 (\d+) 劫$/, (m0, n) => `${n}겁 완료`],
    [/^关键战告捷 (\d+) 次$/, (m0, n) => `핵심 전투 ${n}회 승리`],
    [/^江湖长卷：领到 (\d+) 节的奖励 · \+(\d+) 墨锭（下次打开武库到账）(?: · 秘卷(.+))?$/, (m0, n, ink, mj) => `강호 장권: ${n}절 보상 · +${ink} 먹 (다음에 무기고를 열 때 들어옵니다)` + (mj ? ` · 비권 ${mj.split('、').map(x => { const m = x.match(/^「(.+)」$/); return m ? `“${lookup(m[1]) || m[1]}”` : x; }).join(', ')}` : '')],
    [/^江湖长卷 · 全服第 (\d+) \/ (\d+) 节 · (.+?)(?: · 个人秘卷 (\d+) 卷)?$/, (m0, a, b, c, n) => `강호 장권 · 전체 서버 ${a} / ${b}절 · ${lookup(c) || c}` + (n ? ` · 개인 비권 ${n}권` : '')],
    [/^江湖长卷 · 全卷完成 · 个人秘卷 (\d+) 卷$/, (m0, n) => `강호 장권 · 전권 완료 · 개인 비권 ${n}권`],
    [/^线上真人不足 (\d+) 位：各自迎战 (\d+) 位天道侠客$/, (m0, a, b) => `접속 중인 실제 플레이어가 ${a}명 미만: 각자 천도 협객 ${b}명과 맞섭니다`],
    [/^融魂魔首【(.*)】· 共享 (\d+) 卷秘卷$/, (m0, h, n) => `융합 마두 [${h.split('·').map(x => lookup(x) || x).join(' · ')}] · 공유 비권 ${n}권`],
    [/^对阵【(.*)】· 带着 (\d+) 卷共享秘卷$/, (m0, h, n) => `대결 [${h.split('·').map(x => lookup(x) || x).join(' · ')}] · 공유 비권 ${n}권 보유`],
    [/^(\d+) 秒后重新入战，魔首的血不回$/, (m0, n) => `${n}초 뒤 재참전, 마두의 체력은 회복되지 않습니다`],
    [/^天道 Boss 伏诛！(.*?)( · 够资格的话，星座皮肤会在下次打开武库时到账| · 登录云端账号才能领星座皮肤)$/, (m0, x, t) => `천도 보스 토벌 완료! ${x}${t.includes('登录') ? ' · 별자리 스킨은 클라우드 계정에 로그인해야 받을 수 있습니다' : ' · 자격이 되면 별자리 스킨이 다음에 무기고를 열 때 들어옵니다'}`],
    [/^天道车轮战收场 · 告捷：(.+)$/, (m0, x) => `천도 릴레이 종료 · 승자: ${x.split('、').join(', ')}`],
    [/^(\d+) 段 · (\d+) 伤$/, (m0, n, d) => `${n}타 · 피해 ${d}`],
    [/^全队共享领悟「(.+)」$/, (m0, n) => `팀 전체가 “${lookup(n) || n}”을(를) 깨달았습니다`],
    [/^领悟「(.+)」$/, (m0, n) => `“${lookup(n) || n}” 깨달음`],
    [/^全员共享「(.+)」$/, (m0, n) => `전원 “${lookup(n) || n}” 공유`],
    [/^全线共享「(.+)」$/, (m0, n) => `전 채널 “${lookup(n) || n}” 공유`],
    [/^第 (\d+) 波击退 · 全队共享「(.+)」$/, (m0, w, n) => `${w}파 격퇴 · 팀 전체가 “${lookup(n) || n}” 공유`],
    [/^(\S) · (凡品|精品|绝品|险卷|天书)$/, (m0, g, r) => `${g} · ${lookup(r) || r}`],
    [/^全队共享秘卷：(\d+) 卷 · 破魔悬赏 \+(\d+) 墨锭$/, (m0, n, g) => `공유 비권: ${n}권 · 마두 현상금 +${g} 먹`],
    [/^全服共享秘卷：(\d+) 卷 · 魔首血量全线共享$/, (m0, n) => `서버 공유 비권: ${n}권 · 마두 체력은 전 채널 공유`],
    [/^同袍肉鸽 · 第(\d+)劫$/, (m0, n) => `동료 로그라이크 · ${n}겁`],
    [/^(.+) 融魂魔首$/, (m0, h) => `${h.split('·').map(n => lookup(n) || n).join(' · ')} 융합 마두`],
    [/^全队共享秘卷：(.+)$/, (m0, x) => `공유 비권: ${x.split('、').map(n => { const m = n.match(/^「(.+)」$/); return m ? `“${lookup(m[1]) || m[1]}”` : n; }).join(', ')}`],
    [/^第 (\d+) 代天魔$/, (m0, n) => `천마 · ${n}대`],
    [/^第 (\d+) 代天魔 · (.+)$/, (m0, n, h) => `천마 · ${n}대 · ${lookup(h) || h}`],
    [/^剩 (\d+)% 血 · (\d+) 人参战(?: · (\d+) 人正在出战)?$/, (m0, p, n, f) => `체력 ${p}% 남음 · 참전 ${n}명${f ? ` · 현재 ${f}명 전투 중` : ''}`],
    [/^(\d+) 人参战$/, (m0, n) => `참전 ${n}명`],
    [/^(\d+) 人正在出战$/, (m0, n) => `현재 ${n}명 전투 중`],
    [/^(\d.*?)后遁走$/, (m0, t) => `${KO_DUR(t)} 뒤 도주`],
    [/^全服已斩杀 (\d+) 代（解锁 (\d+) 卷天书）$/, (m0, a, b) => `서버에서 ${a}대를 처치했습니다 (천서 ${b}권 해금)`],
    [/^出战 (\d+) 次$/, (m0, n) => `출전 ${n}회`],
    [/^造成 ([\d,]+) 伤害$/, (m0, n) => `피해 ${n}`],
    [/^(\d+) 天前$/, (m0, n) => `${n}일 전`],
    [/^上一代（(.+?)）被 (.+) 斩杀$/, (m0, h, k) => `지난 천마(${lookup(h) || h})는 ${k}에게 처치되었습니다`],
    [/^上一代（(.+?)）没被打死，遁走了$/, (m0, h) => `지난 천마(${lookup(h) || h})는 쓰러지지 않고 도주했습니다`],
    [/^你这一代造成 ([\d,]+) 伤害（出战 (\d+) 次）$/, (m0, d, n) => `이번 대에서 피해 ${d}를 줬습니다 (출전 ${n}회)`],
    [/^大家各自出战（不是同场联机），伤害都扣在这一只天魔身上。一次出战先抽三卷秘卷，再打 (\d+) 秒，天魔倒下会再站起来。天魔被斩杀或遁走后，按伤害发墨锭，伤害前三和斩杀者另得一个武器箱，下次打开武库自动领取。$/,
      (m0, n) => `모두 각자 출전하며(같은 판에서 함께 하는 온라인이 아님) 피해는 이 천마 한 마리에게 누적됩니다. 출전할 때마다 비권 세 권을 뽑고 ${n}초간 싸우며, 천마는 쓰러져도 다시 일어납니다. 천마가 처치되거나 도주하면 피해량에 따라 먹이 지급되고, 피해 상위 셋과 처치자는 무기 상자를 하나 더 받으며 다음에 무기고를 열 때 자동 수령됩니다.`],
    [/^第 (\d+) \/ (\d+) 卷 · 天魔词缀：(.+)$/, (m0, a, b, x) => `${a} / ${b}권 · 천마 속성: ${x === '无' ? '없음' : x.split('、').map(n => lookup(n) || n).join(', ')}`],
    [/^天魔讨伐 · 第 (\d+) 代$/, (m0, n) => `천마 토벌 · ${n}대`],
    [/^这一战对天魔造成 ([\d,]+) 伤害，打倒它 (\d+) 次$/, (m0, d, n) => `이번 전투에서 천마에게 피해 ${d}를 줬고 ${n}번 쓰러뜨렸습니다`],
    [/^交不上：(.+)$/, (m0, x) => `제출하지 못했습니다: ${lookup(x) || x}`],
    [/^计入全服 ([\d,]+) 伤害，最后一击斩杀了第 (\d+) 代天魔！奖励下次打开武库自动领取$/, (m0, d, n) => `전체 서버에 피해 ${d}가 반영되었고, 마지막 일격으로 ${n}대 천마를 처치했습니다! 보상은 다음에 무기고를 열 때 자동 수령됩니다`],
    [/^你出战时第 (\d+) 代天魔已被别人斩杀，这次伤害没有计入$/, (m0, n) => `출전 중에 ${n}대 천마가 다른 사람에게 처치되어 이번 피해는 반영되지 않았습니다`],
    [/^已计入全服：([\d,]+) 伤害(（超过这次出战时长能打出的上限，按上限算）)?$/, (m0, d, cap) => `서버에 반영됨: 피해 ${d}${cap ? ' (이번 출전 시간 내 최대치를 넘어 상한으로 계산)' : ''}`],
    [/^本赛季打满 (\d+) 场定级赛后上榜。段位从低到高：(.+)$/, (m0, n, ts) => `이번 시즌 배치전 ${n}판을 마치면 순위에 오릅니다. 단계(낮은 순): ${ts.split('、').map(t => { const m = t.match(/^(\S+) (.+)$/); return m ? `${m[1]} ${lookup(m[2]) || m[2]}` : t; }).join(', ')}`],
    [/^已注册玩家 (\d+) 位，按联机胜场排$/, (m0, n) => `등록 플레이어 ${n}명, 온라인 승수 순`],
    [/^选择 (.+)$/, (m0, n) => `${lookup(n) || n} 선택`],
    [/^禁用 (.+)$/, (m0, n) => `${lookup(n) || n} 금지`],
    [/^\+(\d+) 墨锭$/, (m0, n) => `+${n} 먹`],
    [/^补领到 (\d+) 墨锭$/, (m0, n) => `이전에 얻은 먹 ${n}을(를) 수령했습니다`],
    [/^关卡星 \+(\d+) 墨锭$/, (m0, n) => `스테이지 별 +${n} 먹`],
    [/^侠客现在都能直接用，补偿改发 (\d+) 墨锭$/, (m0, n) => `이제 모든 협객을 바로 쓸 수 있어 보상은 먹 ${n}(으)로 대체됩니다`],
    [/^一键领取完成：\+(\d+) 墨锭$/, (m0, n) => `모두 수령 완료: +${n} 먹`],
    [/^皮肤 · (.+)$/, (m0, n) => `스킨 · ${lookup(n) || n}`],
    [/^生命 (\d+)$/, (m0, n) => `체력 ${n}`],
    [/^体量 ([\d.]+)$/, (m0, n) => `체격 ${n}`],
    [/^移速 ([\d.]+)$/, (m0, n) => `이동 속도 ${n}`],
    [/^耐力 (\d+) · 稳定 (\d+)% · 透伤 (\d+)% · 回涌 (\d+)\/秒$/, (m0, a, b, c, d) => `가드 ${a} · 안정 ${b}% · 관통 피해 ${c}% · 회복 ${d}/초`],
    [/^· 伤害 ([\d.]+)(?: \((\d+)段\))?$/, (m0, d, n) => `· 피해 ${d}${n ? ` (${n}타)` : ''}`],
    [/^([QRE]) · (.+?)(?: \[(.+)\])?$/, (m0, k, n, t) => `${k} · ${lookup(n) || n}${t ? ` [${lookup(t) || t}]` : ''}`],
    [/^(.+?) \[(.+)\]$/, (m0, n, t) => `${lookup(n) || n} [${lookup(t) || t}]`],
    [/^(2v2 .+?) · (凯旋大捷！|惜败，择日再战！) 比分 (\d+) : (\d+)$/, (m0, mode, r, a, b) => `${lookup(mode) || mode} · ${r === '凯旋大捷！' ? '개선 대승!' : '아쉽게 패배, 훗날을 기약하세요!'} 점수 ${a} : ${b}`],
    [/^墨锭 (\d+)$/, (m0, n) => `먹 ${n}`],
    [/^(\d+) 分钟前$/, (m0, n) => `${n}분 전`],
    [/^(\d+) 小时前$/, (m0, n) => `${n}시간 전`],
    [/^上次上传：(.+)$/, (m0, x) => `마지막 업로드: ${lookup(x) || x}`],
    [/^(·\s*)?最近在用：(.+)$/, (m0, p, x) => `${p || ''}최근 사용: ${lookup(x) || x}`],
    [/^更新前登录的 (\d+) 处，分不出是哪台设备$/, (m0, n) => `업데이트 전 로그인 ${n}곳 (기기 확인 불가)`],
    [/^请求失败 \((\d+)\)$/, (m0, n) => `요청 실패 (${n})`],
    [/^上传失败，(\d+) 秒后自动重试$/, (m0, n) => `업로드 실패, ${n}초 뒤 자동으로 다시 시도합니다`],
    [/^(.+)，重新登录后会自动补传存档$/, (m0, x) => `${lookup(x) || x}. 다시 로그인하면 저장 데이터가 자동으로 업로드됩니다`],
    [/^(.+)，本机存档不受影响，可先导出备份$/, (m0, x) => `${lookup(x) || x}. 이 기기의 저장 데이터는 안전하며 먼저 백업을 내보낼 수 있습니다`],
    [/^服务器内部错误（编号 (\w+)）$/, (m0, id) => `서버 내부 오류 (번호 ${id})`],
    [/^升级失败：(.+)$/, (m0, x) => `업그레이드 실패: ${lookup(x) || x}`],
    [/^欢迎归来，(.+)！已载入存档$/, (m0, n) => `다시 오신 것을 환영합니다, ${n}님! 저장 데이터를 불러왔습니다`],
    [/^注册成功！大侠 (.+)，已开启专属存档$/, (m0, n) => `가입 완료! ${n} 대협, 전용 저장 데이터가 준비되었습니다`],
    [/^配置格式错误：(.+)$/, (m0, x) => `설정 형식 오류: ${x}`],
    [/^-- 选择导入包中的账号（共 (\d+) 位） --$/, (m0, n) => `-- 백업 파일에서 계정 선택 (총 ${n}개) --`],
    [/^(.+) \((\d+)墨锭 · (\d+)英雄 · (\d+)皮肤 · (\d+)胜(\d+)负\)$/, (m0, n, ink, h, k, w, l) => `${n} (먹 ${ink} · 협객 ${h} · 스킨 ${k} · ${w}승 ${l}패)`],
    [/^已成功继承【(.+)】！已解锁 (\d+) 位英雄、(\d+) 款皮肤、(\d+) 墨锭！$/, (m0, n, h, k, ink) => `"${n}" 계승 완료! 협객 ${h}명, 스킨 ${k}개, 먹 ${ink} 해금!`],
    [/^已成功导入【(.+)】$/, (m0, n) => `"${n}" 가져오기 완료`],
    [/^已切换到导入的本机账号【(.+?)】：(\d+) 位英雄、(\d+) 墨锭。(?:(.+)。)?$/, (m0, n, h, ink, note) => `가져온 로컬 계정 "${n}"(으)로 전환했습니다: 협객 ${h}명, 먹 ${ink}.` + (note ? ` ${lookup(note) || note}.` : '')],
    [/^已切换到导入的本机账号【(.+?)】(?:（(.+)）)?$/, (m0, n, note) => `가져온 로컬 계정 "${n}"(으)로 전환했습니다` + (note ? ` (${lookup(note) || note})` : '')],
    [/^已载入全备份包（共 (\d+) 个账号）$/, (m0, n) => `전체 백업을 불러왔습니다 (계정 ${n}개)`],
    [/^成功恢复 (\d+) 个账号，请在下拉框选择切换！$/, (m0, n) => `계정 ${n}개를 복원했습니다. 목록에서 선택해 전환하세요!`],
    [/^成功恢复 (\d+) 个账号$/, (m0, n) => `계정 ${n}개를 복원했습니다`],
    [/^已读取 (.+)（(\d+) 个账号）$/, (m0, f, n) => `${f} 읽음 (계정 ${n}개)`],
    [/^成功载入 (\d+) 个账号数据$/, (m0, n) => `계정 데이터 ${n}개를 불러왔습니다`],
    [/^导入失败：(.+)$/, (m0, x) => `가져오기 실패: ${lookup(x) || x}`],
    [/^文件解析失败：(.+)$/, (m0, x) => `파일을 읽지 못했습니다: ${lookup(x) || x}`],
    [/^【这一战】(.+?)(?:，开局只剩 (\d+)% 生命)?$/, (m0, goal, hp) => `[이번 전투] ${lookup(goal) || goal}${hp ? ` · 시작 체력 ${hp}%` : ''}`],
    [/^第 (\d+) 节走完(?:，获得 (\d+) 墨锭)?$/, (m0, chapter, ink) => `${chapter}절 완료${ink ? ` · +${ink} 먹` : ''}`],
    [/^—— 结局 · 「([^」]+)」 ——(?:　获得 (\d+) 墨锭)?$/, (m0, title, ink) => `엔딩 · ${lookup(title) || title}${ink ? ` · +${ink} 먹` : ''}`],
    [/^结局：((?:「[^」]+」)+)$/, (m0, titles) => `엔딩: ${[...titles.matchAll(/「([^」]+)」/g)].map(([, title]) => lookup(title) || title).join(', ')}`],
    [/^第 (\d+) 节$/, (m0, n) => `${n}절`],
    [/^对手 (.+)$/, (m0, h) => `상대: ${lookup(h) || h}`],
    [/^撑过 (\d+) 秒$/, (m0, n) => `${n}초 버티기`],
    [/^(\d+) 秒内击败对手$/, (m0, n) => `${n}초 안에 상대 격파`],
    [/^(.+)阵线$/, (m0, x) => x === '你' ? '내 진영' : lookup(x) ? `${lookup(x)} 진영` : m0],
    [/^(先锋|中坚|大将) (.+)$/, (m0, s, h) => `${lookup(s) || s} ${lookup(h) || h}`],
    [/^(\d+) \((\d+)段\)$/, (m0, d, n) => `${d} (${n}타)`],
    [/^(\d+)上限$/, (m0, n) => `상한 ${n}`],
    [/^(.+)武器箱$/, (m0, c) => lookup(c) ? `${lookup(c)} 무기 상자` : m0],
    [/^(.+)典藏匣$/, (m0, c) => lookup(c) ? `${lookup(c)} 소장함` : m0],
    [/^(精铁|碧玉|灵犀|赤霄|绝世|斩数版) ([\d.]+%)$/, (m0, t, p) => `${lookup(t)} ${p}`],
    [/^(精铁|碧玉|灵犀|赤霄) →(?: (精铁|碧玉|灵犀|赤霄|绝世))?$/, (m0, a, b) => `${lookup(a)} →${b ? ' ' + lookup(b) : ''}`],
    [/^集齐这个箱子的 (\d+) 款精铁：(\d+)\/(\d+)，送 1 个(.+)武器箱 \+ 1 张改名标签$/, (m0, n, a, b, c) => `이 상자의 정철 ${n}종을 모두 모으세요: ${a}/${b}. 보상: ${lookup(c) || c} 무기 상자 1개 + 이름 변경권 1장`],
    [/^库存里的(精铁|碧玉|灵犀|赤霄)饰品$/, (m0, t) => `보유 중인 ${lookup(t)} 장식품`],
    [/^放进 (\d+) 件(精铁|碧玉|灵犀|赤霄)饰品，换 1 件(碧玉|灵犀|赤霄|绝世)。出什么取决于材料来自哪个武器箱；斩数版只能和斩数版一起换，换出来的也是斩数版。$/,
      (m0, n, a, b) => `${lookup(a)} 장식품 ${n}개를 넣으면 ${lookup(b)} 1개를 얻습니다. 결과는 재료가 어느 무기 상자에서 나왔는지에 따라 달라지며, 처치 카운터 에디션은 처치 카운터 에디션끼리만 교환되고 결과도 처치 카운터 에디션입니다.`],
    [/^还有 (\d+) 台没开封$/, (m0, n) => `미개봉 ${n}개`],
    [/^货郎在商店按固定价格卖（一台 ([\d,]+) 墨锭），每周补给、星章兑换也有，新手礼也送一台。$/, (m0, n) => `보부상은 상점에서 고정 가격(개당 먹 ${n})에 판매합니다. 주간 보급, 별 교환, 신규 선물로도 얻을 수 있습니다.`],
    [/^每天限开 (\d+) 个$/, (m0, n) => `하루 ${n}개`],
    [/^每周限开 (\d+) 个$/, (m0, n) => `주 ${n}개`],
    [/^赤霄和绝世加起来 ([\d.]+%)$/, (m0, p) => `진홍 + 독보적: ${p}`],
    [/^(十二星座，每位侠客都有星辉、星焰、星冕三款。每个号都送了 1 个星座武器箱，可以先免费开一次。)?只出这三档，这 (\d+) 款饰品别的武器箱都开不出来，开它也不占每天那 (\d+) 个普通武器箱。点一下饰品，就能先看看穿上的样子。$/,
      (m0, z, n, d) => `${z ? lookup(z) + ' ' : ''}이 세 등급만 나옵니다. 이 장식품 ${n}종은 다른 무기 상자에서는 나오지 않으며, 이 상자를 열어도 하루 일반 무기 상자 ${d}개 한도에 포함되지 않습니다. 장식품을 누르면 입어 본 모습을 미리 볼 수 있습니다.`],
    [/^(\d+) 天没有成交$/, (m0, n) => `${n}일간 거래 없음`],
    [/^收录全部 (\d+) 款皮肤。点选查看效果、所属套装和获取方式。$/, (m0, n) => `스킨 총 ${n}종. 눌러서 효과, 소속 세트, 획득 방법을 확인하세요.`],
    [/^(\d+) 款$/, (m0, n) => `스킨 ${n}종`],
    [/^(\d+) 款已拥有$/, (m0, n) => `${n}종 보유`],
    [/^第 (\d+) 季$/, (m0, n) => `${n}시즌`],
    [/^本季共得 (\d+)$/, (m0, n) => `이번 시즌 ${n} 획득`],
    [/^这周再打 (\d+) 局解锁（(\d+)\/(\d+)）$/, (m0, n, a, b) => `이번 주 ${n}판 더 하면 해금 (${a}/${b})`],
    [/^(\d+) 墨锭$/, (m0, n) => `먹 ${n}`],
    [/^(\d+) 星章兑换$/, (m0, n) => `별 ${n}개로 교환`],
    [/^对局掉落：每局 (\d+)% 机会掉一件饰品或武器箱，每周最多 (\d+) 次（本周已掉 (\d+) 次）。$/, (m0, p, m, k) => `대전 드롭: 판마다 ${p}% 확률로 장식품이나 무기 상자가 나오며 주당 최대 ${m}회 (이번 주 ${k}회).`],
    [/^进行 (\d+) 局对战$/, (m0, n) => `대전 ${n}판 하기`],
    [/^赢下 (\d+) 局$/, (m0, n) => `${n}판 승리`],
    [/^用(.+)赢下 (\d+) 局$/, (m0, h, n) => `${lookup(h) || h}(으)로 ${n}판 승리`],
    [/^在劲敌或更高难度下赢 (\d+) 局人机$/, (m0, n) => `${lookup('劲敌')} 이상 난이도에서 AI전 ${n}판 승리`],
    [/^以 2 : 0 拿下 (\d+) 局$/, (m0, n) => `2 : 0으로 ${n}판 승리`],
    [/^一局里打出 (\d+) 连击$/, (m0, n) => `한 판에서 ${n}콤보 달성`],
    [/^施展 (\d+) 次终极奥义$/, (m0, n) => `필살기 ${n}회 사용`],
    [/^联机对战 (\d+) 局$/, (m0, n) => `온라인 대전 ${n}판`],
    [/^打 (\d+) 局(问剑密卷|天机乱斗|2v2)$/, (m0, n, x) => `${lookup(x) || x} ${n}판 하기`],
    [/^赢下 (\d+) 局 3v3 车轮战$/, (m0, n) => `${lookup('3v3 车轮战')} ${n}판 승리`],
    [/^开启 (\d+) 个武器箱$/, (m0, n) => `무기 상자 ${n}개 열기`],
    [/^签 (\d+) 份熔铸契$/, (m0, n) => `${lookup('熔铸契')} ${n}건 체결`]
  ];
  // ---------- 3. 查表与翻页面 ----------
  // 一处查表：先查固定词条，再试模板；返回空串表示“没有这句的译文”
  function lookup(text) {
    if (!text) return '';
    if (koMode) {
      const dk = dictKo();
      if (Object.prototype.hasOwnProperty.call(dk, text) && dk[text]) return dk[text];
      const pk = patternsKo();
      if (pk) {
        for (let i = 0; i < pk.length; i++) {
          if (!pk[i][0].test(text)) continue;
          const tr = text.replace(pk[i][0], pk[i][1]);
          if (tr !== text) return tr;
        }
      }
    }
    const dict = dictEn();
    if (Object.prototype.hasOwnProperty.call(dict, text) && dict[text]) return dict[text];
    for (let i = 0; i < PATTERNS_EN.length; i++) {
      const re = PATTERNS_EN[i][0];
      if (!re.test(text)) continue;
      const translated = text.replace(re, PATTERNS_EN[i][1]);
      if (translated !== text) return translated;
    }
    const j = joined(text);
    if (j) return j;
    return koMode ? koFragments(text) : '';
  }
  // 한국어 모드 보충: 통째로 못 찾은 문장은 사전의 가장 긴 조각부터 부분 치환 (한 조각이라도 바뀌면 사용)
  let koIdx = null, koIdxN = -1;
  const koFragCache = new Map();
  function koFragments(text) {
    if (!CJK.test(text)) return '';
    if (koFragCache.has(text)) return koFragCache.get(text);
    const r = koFragments0(text);
    if (koFragCache.size > 3000) koFragCache.clear();
    koFragCache.set(text, r);
    return r;
  }
  function koFragments0(text) {
    const nKeys = Object.keys(dictKo()).length;
    if (!koIdx || koIdxN !== nKeys) {
      koIdxN = nKeys; koFragCache.clear();
      koIdx = Object.keys(dictKo()).filter(k => k.length >= 2 && k.length <= 40 && CJK.test(k) && !/[\n]/.test(k)).sort((a, b) => b.length - a.length);
    }
    const dk = dictKo();
    let out = text, hit = false;
    for (let i = 0; i < koIdx.length; i++) {
      const k = koIdx[i];
      if (out.indexOf(k) >= 0) { out = out.split(k).join(dk[k]); hit = true; if (!CJK.test(out)) break; }
    }
    return hit ? out : '';
  }

  // 拼起来的短语：「月华 | 广寒」「绝世 · 霜华武器箱」「被动 · 机栝动能」这类由几段词条加分隔符拼成的句子，
  // 整句不在表里，但每一段都有译文。按分隔符切开逐段查，全部查得到（或本来就不是中文）才拼回去；
  // 有一段查不到就当没有译文，不拼出半中半英的句子。
  // 先按最外层的分隔符切：「月华 | 双子·星冕」先切「 | 」，后半段「双子·星冕」再整段查（查不到才接着切「·」）
  // 最后才按中文逗号切：无障碍标签「青锋，游龙剑客，本局地利」这种由几个词条拼成的短句
  const JOIN_SEPS = [' | ', ' · ', '·', '，'];
  const CJK = /[\u4e00-\u9fff]/;
  function joined(text) {
    const sep = JOIN_SEPS.find(s => text.includes(s));
    if (!sep) return '';
    const parts = text.split(sep);
    let hit = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p || !CJK.test(p)) continue;
      const out = lookup(p);
      if (!out) return '';
      parts[i] = parts[i].replace(p, out);
      hit = true;
    }
    return hit ? parts.join(sep === '·' ? ' · ' : sep === '，' ? ', ' : sep) : '';
  }

  // 翻译指定文本
  function t(text) {
    if (currentLang === 'zh' || !text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    const out = lookup(trimmed);
    return out ? text.replace(trimmed, out) : text;
  }

  // 翻译 title / placeholder / aria-label。原文记在 data-orig-*；页面代码之后改了这个属性
  // （比如大厅连上以后输入框提示从「正在连接大厅…」换成「在大厅说点什么」），新值既不是原文也不是我们写进去的译文，就当成新的原文
  const TR_ATTRS = ['title', 'placeholder', 'aria-label'];
  function translateAttrs(node) {
    for (const attr of TR_ATTRS) {
      const val = node.getAttribute(attr);
      if (!val) continue;
      const origKey = 'orig_' + attr.replace(/-/g, '_');
      const wrote = node.__trAttr && node.__trAttr[attr];
      if (node.dataset[origKey] === undefined || (val !== wrote && val !== node.dataset[origKey])) node.dataset[origKey] = val;
      const orig = node.dataset[origKey];
      const trimmed = orig.trim();
      const out = currentLang === 'en' && trimmed ? lookup(trimmed) : '';
      const next = out ? orig.replace(trimmed, out) : orig;
      (node.__trAttr || (node.__trAttr = {}))[attr] = next;
      if (val !== next) node.setAttribute(attr, next);
    }
  }

  // 递归或属性扫描翻译 DOM 节点
  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      // 文本节点没有 dataset 属性：原来这里读 node.datasetOrigText 会在第一个文本节点上抛 TypeError，
      // 整段翻译走不到底（切成英文等于没反应，还顺带把 chooseLang 后面的 backToMenu 也带崩）。
      // 原文记在节点自己的属性上，不写进 DOM。
      const orig = node.__origText !== undefined ? node.__origText : node.nodeValue;
      if (node.__origText === undefined) {
        node.__origText = orig;
      }
      const trimmed = orig.trim();
      const out = currentLang === 'en' && trimmed ? lookup(trimmed) : '';
      // 值没变就不写：一写就是一次 DOM 变更，能省则省（这些节点每帧都可能被重排）
      if (out) {
        const next = trimmed === orig ? out : orig.replace(trimmed, out);
        if (node.nodeValue !== next) node.nodeValue = next;
      } else if (node.nodeValue !== orig) {
        node.nodeValue = orig;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      translateAttrs(node);

      // 递归子节点（跳过脚本与画布内部）
      if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'CANVAS' && !node.classList.contains('no-i18n')) {
        for (let i = 0; i < node.childNodes.length; i++) {
          translateNode(node.childNodes[i]);
        }
      }
    }
  }

  function applyTranslations(root) {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = koMode ? 'ko' : currentLang === 'en' ? 'en' : 'zh-CN';
    document.body.classList.toggle('lang-en', currentLang === 'en');
    document.body.classList.toggle('lang-ko', koMode);
    if (koMode && (() => { try { return typeof EMO_ICON === 'object' && !EMO_ICON.__ko; } catch (e) { return false; } })()) {
      const m = {'战':'전','烈':'열','关':'관','练':'연','初':'초','疾':'질','绝':'절','谋':'모','存':'저','云':'클','卷':'권','取':'받','传':'전','匣':'함','礼':'선','墨':'먹','胜':'승','签':'서','警':'경','成':'완','否':'아','锁':'잠','贺':'축','破':'파','风':'풍','月':'월','守':'수','羽':'깃','霜':'서','震':'진','龙':'용','刃':'인','灵':'영','遁':'둔'};
      Object.keys(EMO_ICON).forEach(k => { if (m[EMO_ICON[k]]) EMO_ICON[k] = m[EMO_ICON[k]]; });
      Object.defineProperty(EMO_ICON, '__ko', { value: 1, enumerable: false });
    }
    const target = root || document.body;
    if (target) translateNode(target);
  }

  // 每个页面打开时都是现拼 innerHTML，切完语言之后再画出来的那批文本没人翻译（英文模式下
  // 打开单人模式、任务、图鉴……全是中文）。盯住 body 的新增节点补一遍（另外盯 title / placeholder / aria-label 三个属性），
  // 自己写 nodeValue 是 characterData，不会反过来再触发，也就不存在来回翻译的死循环。
  let trMO = null;
  function trWatch() {
    if (trMO || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
    trMO = new MutationObserver(recs => {
      if (currentLang !== 'en') return;
      for (const r of recs) {
        if (r.type === 'attributes') { if (r.target.nodeType === 1) translateAttrs(r.target); continue; }
        for (const n of r.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) translateNode(n);
      }
    });
    // 只盯 childList 和这三个属性：自己写 nodeValue 是 characterData，不会反过来触发；
    // 自己写属性会再来一条记录，但那时值已经是译文，translateAttrs 不会再写
    trMO.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: TR_ATTRS });
  }

  if (typeof document !== 'undefined') {
    if (document.body) trWatch();
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', trWatch, { once: true });
  }

  // ---------- 4. 挂到全局 ----------
  // 挂载全局
  if (typeof window !== 'undefined') {
    window.I18N = {
      getLang,
      getLocale,
      setLang,
      t,
      applyTranslations,
      get DICT_EN() { return dictEn(); },
      get PATTERNS_EN() { return PATTERNS_EN; }   // tools/checks/data-check.mjs 检查每一项的形状
    };
    window.t = t;
  }
})();
