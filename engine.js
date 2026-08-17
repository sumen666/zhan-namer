/* ============================================================
 *  新生儿取名工作台 - 核心引擎 engine.js
 *  包含: 八字排盘 / 五行分析 / 三才五格 / 名字评分 / 生成推荐
 * ============================================================ */

const Engine = (function() {

  /* ============ 八字排盘 ============ */

  /* 获取节气日期 (返回 {month, day}) */
  function getTermDate(termKey, year) {
    const base = SOLAR_TERMS[termKey];
    if (!base) return null;
    // 精确微调: 不同年份节气日期可能差1天, 这里用近似值
    // 小寒: 1月5-7日, 立春: 2月3-5日
    const adjustments = {
      2024: { xiaoHan:[1,6], liChun:[2,4], jingZhe:[3,5], qingMing:[4,4], liXia:[5,5], mangZhong:[6,5], xiaoShu:[7,6], liQiu:[8,7], baiLu:[9,7], hanLu:[10,8], liDong:[11,7], daXue:[12,6] },
      2025: { xiaoHan:[1,5], liChun:[2,3], jingZhe:[3,5], qingMing:[4,4], liXia:[5,5], mangZhong:[6,5], xiaoShu:[7,7], liQiu:[8,7], baiLu:[9,7], hanLu:[10,8], liDong:[11,7], daXue:[12,7] },
      2026: { xiaoHan:[1,5], liChun:[2,4], jingZhe:[3,5], qingMing:[4,5], liXia:[5,5], mangZhong:[6,5], xiaoShu:[7,7], liQiu:[8,7], baiLu:[9,7], hanLu:[10,8], liDong:[11,7], daXue:[12,7] },
    };
    if (adjustments[year] && adjustments[year][termKey]) {
      return { month: adjustments[year][termKey][0], day: adjustments[year][termKey][1] };
    }
    return { month: base[0], day: base[1] };
  }

  /* 判断某日期处于哪个节气月 (返回月支) */
  function getMonthBranch(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();

    // 构建12个节气节点的时间点, 找到date之前最近的一个
    const nodes = [];
    for (const termKey of TERM_ORDER) {
      const td = getTermDate(termKey, year);
      if (td) {
        const nodeDate = new Date(year, td.month - 1, td.day);
        nodes.push({ key: termKey, date: nodeDate });
      }
    }
    // 也检查上一年的小寒和大雪 (1月日期可能在上一年的节气月)
    const prevYearNodes = [];
    for (const termKey of ['daXue','xiaoHan','liChun']) {
      const td = getTermDate(termKey, year - 1);
      if (td) {
        const nodeDate = new Date(year - 1, td.month - 1, td.day);
        prevYearNodes.push({ key: termKey, date: nodeDate });
      }
    }
    // 立春可能在今年1月或2月
    const liChunThisYear = getTermDate('liChun', year);
    if (liChunThisYear) {
      // 如果立春在2月, 而当前是1月, 则年份仍属于去年
    }

    const allNodes = [...prevYearNodes, ...nodes].sort((a,b) => a.date - b.date);

    // 找到 <= date 的最后一个节点
    let result = allNodes[0];
    for (const node of allNodes) {
      if (node.date <= date) {
        result = node;
      }
    }

    return TERM_TO_BRANCH[result.key];
  }

  /* 年柱: 以立春为分界 */
  function getYearPillar(date) {
    const year = date.getFullYear();
    const liChunDate = getTermDate('liChun', year);
    const liChun = new Date(year, liChunDate.month - 1, liChunDate.day);

    let actualYear = year;
    if (date < liChun) actualYear = year - 1;

    // 1984年甲子年为基准
    const stemIdx = ((actualYear - 1984) % 10 + 10) % 10;
    const branchIdx = ((actualYear - 1984) % 12 + 12) % 12;
    return { stem: stemIdx, branch: branchIdx, stemName: STEMS[stemIdx], branchName: BRANCHES[branchIdx] };
  }

  /* 月柱: 节气定月支, 五虎遁定月干 */
  function getMonthPillar(date, yearStemName) {
    const branchName = getMonthBranch(date);
    const branchIdx = BRANCHES.indexOf(branchName);

    // 五虎遁: 寅月(立春后第一个月)的月干
    const startStem = MONTH_STEM_START[yearStemName];
    // 寅月 = 索引2, 月干从寅月开始递增
    const monthsFromYin = (branchIdx - 2 + 12) % 12;
    const stemIdx = (startStem + monthsFromYin) % 10;

    return { stem: stemIdx, branch: branchIdx, stemName: STEMS[stemIdx], branchName: branchName };
  }

  /* 日柱: 以1900-01-31甲戌日为基准 */
  function getDayPillar(date) {
    const ref = Date.UTC(1900, 0, 31); // 1900年1月31日 = 甲戌日
    const diff = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - ref) / 86400000);
    const stemIdx = ((diff % 10) + 10) % 10;  // 甲=0
    const branchIdx = ((diff + 10) % 12 + 12) % 12; // 戌=10
    return { stem: stemIdx, branch: branchIdx, stemName: STEMS[stemIdx], branchName: BRANCHES[branchIdx] };
  }

  /* 时柱: 五鼠遁定时干 */
  function getHourPillar(hour, minute, dayStemName) {
    // 23-1子时, 1-3丑时 ...
    let branchIdx;
    if (hour === 23 || hour === 0) branchIdx = 0;       // 子
    else if (hour <= 2) branchIdx = 1;                  // 丑
    else branchIdx = Math.floor((hour + 1) / 2) % 12;

    // 五鼠遁: 子时的时干
    const startStem = HOUR_STEM_START[dayStemName];
    const hoursFromZi = branchIdx;
    const stemIdx = (startStem + hoursFromZi) % 10;

    return { stem: stemIdx, branch: branchIdx, stemName: STEMS[stemIdx], branchName: BRANCHES[branchIdx] };
  }

  /* 完整排八字 */
  function getBazi(date, hour, minute) {
    minute = minute || 0;
    const yearP = getYearPillar(date);
    const monthP = getMonthPillar(date, yearP.stemName);
    const dayP = getDayPillar(date);
    const hourP = getHourPillar(hour, minute, dayP.stemName);

    // 真太阳时校正 (简化: 标准时已足够)
    const zodiacIdx = ((yearP.branch - 0 + 12) % 12); // 修正: 生肖按年支
    // 年支对应生肖: 子=鼠(0), 丑=牛(1)...
    const zodiac = ZODIAC[zodiacIdx];

    return {
      year: yearP,
      month: monthP,
      day: dayP,
      hour: hourP,
      zodiac: zodiac,
      pillars: [
        { name:'年柱', ...yearP },
        { name:'月柱', ...monthP },
        { name:'日柱', ...dayP },
        { name:'时柱', ...hourP }
      ]
    };
  }

  /* ============ 五行分析 ============ */

  function analyzeWuxing(bazi) {
    const counts = { '金':0, '木':0, '水':0, '火':0, '土':0 };
    const details = [];

    // 天干五行
    for (const p of bazi.pillars) {
      const stemWx = STEM_WUXING[p.stem];
      counts[stemWx] += 1;
      details.push({ source: `${p.stemName}（${p.name}天干）`, wuxing: stemWx, weight: 1, type:'天干' });
    }

    // 地支本气五行
    for (const p of bazi.pillars) {
      const branchWx = BRANCH_WUXING[p.branch];
      counts[branchWx] += 1;
      details.push({ source: `${p.branchName}（${p.name}地支本气）`, wuxing: branchWx, weight: 1, type:'地支本气' });
    }

    // 地支藏干五行 (权重较小)
    for (const p of bazi.pillars) {
      const hidden = BRANCH_HIDDEN[p.branchName] || [];
      for (let i = 0; i < hidden.length; i++) {
        const hiddenStem = STEMS[hidden[i]];
        const hiddenWx = STEM_WUXING[hidden[i]];
        const weight = i === 0 ? 0.5 : (i === 1 ? 0.3 : 0.2);
        counts[hiddenWx] += weight;
        details.push({ source: `${p.branchName}藏干${hiddenStem}`, wuxing: hiddenWx, weight: weight, type:'藏干' });
      }
    }

    // 日主 (日干)
    const dayMaster = STEM_WUXING[bazi.day.stem];
    const dayMasterName = STEMS[bazi.day.stem];

    // 判断五行强弱
    const total = Object.values(counts).reduce((a,b) => a + b, 0);
    const strength = {};
    for (const wx of WUXING_LIST) {
      strength[wx] = { count: counts[wx], ratio: total > 0 ? counts[wx] / total : 0 };
    }

    // 喜用神判断 (简化版)
    const favorable = getFavorableGods(dayMaster, counts, strength);

    return { counts, details, dayMaster, dayMasterName, strength, favorable };
  }

  /* 喜用神判断 */
  function getFavorableGods(dayMaster, counts, strength) {
    const favorable = { xi: [], yong: [], ji: [] };

    // 日主五行力量
    const dmStrength = counts[dayMaster];
    const total = Object.values(counts).reduce((a,b) => a + b, 0);
    const dmRatio = total > 0 ? dmStrength / total : 0;

    // 同类五行 (生我/同我)
    const sameType = [dayMaster, getProducer(dayMaster)];
    const oppositeType = WUXING_LIST.filter(wx => !sameType.includes(wx));

    // 判断身强身弱
    const samePower = sameType.reduce((sum, wx) => sum + counts[wx], 0);
    const oppPower = oppositeType.reduce((sum, wx) => sum + counts[wx], 0);
    const isStrong = samePower >= oppPower;

    if (isStrong) {
      // 身强: 喜克泄耗 — 用官杀(克我)、食伤(我生)、财星(我克)
      favorable.xi = [getController(dayMaster), getChild(dayMaster),getControllee(dayMaster)];
      favorable.yong = [getController(dayMaster)];
      favorable.ji = [getProducer(dayMaster), dayMaster]; // 忌印(生我)和比劫(同我)
    } else {
      // 身弱: 喜生扶 — 用印星(生我)、比劫(同我)
      favorable.xi = [getProducer(dayMaster), dayMaster];
      favorable.yong = [getProducer(dayMaster)];
      favorable.ji = [getController(dayMaster), getChild(dayMaster), getControllee(dayMaster)];
    }

    // 去重
    favorable.xi = [...new Set(favorable.xi)];
    favorable.yong = [...new Set(favorable.yong)];
    favorable.ji = [...new Set(favorable.ji)];

    return favorable;
  }

  /* 五行关系辅助 */
  function getProducer(wx) { // 生我者
    for (const [k,v] of Object.entries(WUXING_SHENG)) if (v === wx) return k;
    return null;
  }
  function getChild(wx)     { return WUXING_SHENG[wx] || null; } // 我生者
  function getController(wx){ return WUXING_KE[wx] || null; }   // 我克者
  function getControllee(wx){ // 克我者
    for (const [k,v] of Object.entries(WUXING_KE)) if (v === wx) return k;
    return null;
  }

  /* ============ 三才五格 ============ */

  /* 获取汉字的康熙笔画 */
  function getKangxiStrokes(char) {
    const entry = NAME_CHARS.find(c => c.ch === char);
    if (entry) return entry.ks;
    // 未收录的汉字, 用简体笔画近似 (可能会偏差)
    return char.length > 0 ? getSimpleStrokes(char) : 0;
  }

  /* 简体笔画估算 (未收录汉字的备选) */
  function getSimpleStrokes(char) {
    const entry = NAME_CHARS.find(c => c.ch === char);
    if (entry) return entry.ss;
    // 无法确定, 返回一个合理默认值
    return Math.max(2, char.charCodeAt(0) % 20 + 2);
  }

  /* 获取汉字五行 */
  function getCharWuxing(char) {
    const entry = NAME_CHARS.find(c => c.ch === char);
    return entry ? entry.wx : '土';
  }

  /* 计算三才五格 */
  function calcSanCaiWuGe(surname, nameChars) {
    // surname: 姓氏字符串 (可能复姓)
    // nameChars: 名字字符数组 (1-2个字)

    const surnameStrokes = [];
    for (const ch of surname) {
      surnameStrokes.push(getKangxiStrokes(ch));
    }
    const nameStrokes = nameChars.map(ch => getKangxiStrokes(ch));

    const surnameSum = surnameStrokes.reduce((a,b) => a+b, 0);
    const nameSum = nameStrokes.reduce((a,b) => a+b, 0);

    // 天格 = 姓氏笔画 + 1 (单姓) / 复姓笔画之和 (复姓)
    const tianGe = surname.length === 1 ? surnameStrokes[0] + 1 : surnameSum;

    // 人格 = 姓氏末字笔画 + 名字首字笔画
    const renGe = surnameStrokes[surnameStrokes.length - 1] + (nameStrokes.length > 0 ? nameStrokes[0] : 0);

    // 地格 = 名字笔画之和 + 1 (单名) / 名字两字笔画之和 (双名)
    const diGe = nameStrokes.length === 1 ? nameStrokes[0] + 1 : nameSum;

    // 总格 = 姓氏 + 名字所有笔画之和
    const zongGe = surnameSum + nameSum;

    // 外格 = 总格 - 人格 + 1
    const waiGe = zongGe - renGe + 1;

    // 数理吉凶 (取81数理)
    const tianLuck = FORTUNE_81[((tianGe - 1) % 80) + 1] || { luck:'—', desc:'' };
    const renLuck = FORTUNE_81[((renGe - 1) % 80) + 1] || { luck:'—', desc:'' };
    const diLuck = FORTUNE_81[((diGe - 1) % 80) + 1] || { luck:'—', desc:'' };
    const waiLuck = FORTUNE_81[((waiGe - 1) % 80) + 1] || { luck:'—', desc:'' };
    const zongLuck = FORTUNE_81[((zongGe - 1) % 80) + 1] || { luck:'—', desc:'' };

    // 三才五行: 天格/人格/地格的五行 (笔画尾数对应: 1-2木 3-4火 5-6土 7-8金 9-0水)
    const tianWx = strokesToWuxing(tianGe);
    const renWx = strokesToWuxing(renGe);
    const diWx = strokesToWuxing(diGe);
    const sanCaiKey = tianWx + renWx + diWx;
    const sanCai = SANCAI_FORTUNE[sanCaiKey] || { luck:'—', desc:'组合未见记载' };

    return {
      tianGe, renGe, diGe, waiGe, zongGe,
      tianLuck, renLuck, diLuck, waiLuck, zongLuck,
      tianWx, renWx, diWx,
      sanCai, sanCaiKey,
      surnameStrokes, nameStrokes
    };
  }

  /* 笔画数 → 五行 (1-2木, 3-4火, 5-6土, 7-8金, 9-0水) */
  function strokesToWuxing(n) {
    const last = n % 10;
    if (last === 1 || last === 2) return '木';
    if (last === 3 || last === 4) return '火';
    if (last === 5 || last === 6) return '土';
    if (last === 7 || last === 8) return '金';
    return '水'; // 9, 0
  }

  /* ============ 生肖喜忌检查 ============ */

  function getCharRadicals(char) {
    // 简化版: 根据汉字偏旁部首匹配
    // 实际应用中应有完整的偏旁部首映射
    const radicalMap = {
      '氵': '水', '冫': '水', '水': '水',
      '日': '日', '曰': '日',
      '月': '月',
      '木': '木', '艹': '艹', '竹': '竹',
      '土': '土', '田': '田', '山': '山',
      '金': '金', '钅': '金',
      '火': '火', '灬': '火',
      '宀': '宀', '穴': '穴',
      '口': '口',
      '禾': '禾', '米': '米', '麦': '麦', '豆': '豆',
      '王': '王', '玉': '玉',
      '心': '心', '忄': '心',
      '犬': '犬', '犭': '犬',
      '鸟': '鸟', '隹': '鸟',
      '虫': '虫',
      '雨': '雨', '云': '云', '星': '星',
      '辰': '辰', '子': '子', '丑': '丑', '酉': '酉',
      '门': '门', '彳': '彳', '走': '走', '人': '人', '亻': '人',
      '彡': '彡', '巾': '巾', '衣': '衣', '采': '采',
      '力': '力', '刀': '刀', '刂': '刀', '弓': '弓', '车': '车',
    };

    const radicals = [];
    // 检查汉字是否包含某个偏旁
    for (const [rad, wx] of Object.entries(radicalMap)) {
      if (char.includes(rad)) {
        radicals.push(rad);
      }
    }
    return radicals;
  }

  function checkZodiacCompat(char, zodiac) {
    const prefs = ZODIAC_PREFS[zodiac];
    if (!prefs) return { score: 50, like: [], avoid: [] };

    const radicals = getCharRadicals(char);
    const matchedLike = [];
    const matchedAvoid = [];

    for (const rad of radicals) {
      if (prefs.like.includes(rad)) matchedLike.push(rad);
      if (prefs.avoid.includes(rad)) matchedAvoid.push(rad);
    }

    let score = 60;
    if (matchedLike.length > 0) score += 20 * matchedLike.length;
    if (matchedAvoid.length > 0) score -= 30 * matchedAvoid.length;

    return {
      score: Math.max(0, Math.min(100, score)),
      like: matchedLike,
      avoid: matchedAvoid
    };
  }

  /* ============ 名字综合评分 ============ */

  function scoreName(surname, nameChars, bazi, wuxingAnalysis) {
    // 三才五格
    const scwg = calcSanCaiWuGe(surname, nameChars);

    // 八字契合度: 名字用字的五行是否补益喜用神
    let baziScore = 0;
    const charWuxingList = [];
    for (const ch of nameChars) {
      const wx = getCharWuxing(ch);
      charWuxingList.push(wx);
      if (wuxingAnalysis.favorable.xi.includes(wx)) baziScore += 20;
      else if (wuxingAnalysis.favorable.yong.includes(wx)) baziScore += 25;
      else if (wuxingAnalysis.favorable.ji.includes(wx)) baziScore -= 10;
      else baziScore += 5;
    }
    baziScore = Math.max(20, Math.min(100, baziScore + 40));

    // 生肖契合度
    let zodiacScore = 0;
    const zodiacDetails = [];
    for (const ch of nameChars) {
      const zc = checkZodiacCompat(ch, bazi.zodiac);
      zodiacScore += zc.score;
      zodiacDetails.push(zc);
    }
    zodiacScore = Math.round(zodiacScore / nameChars.length);

    // 数理吉凶评分
    const luckToScore = { '大吉': 95, '吉': 80, '吉带凶': 65, '凶带吉': 55, '凶': 30 };
    const geScore = (
      (luckToScore[scwg.tianLuck.luck] || 50) * 0.15 +
      (luckToScore[scwg.renLuck.luck] || 50) * 0.35 +
      (luckToScore[scwg.diLuck.luck] || 50) * 0.20 +
      (luckToScore[scwg.waiLuck.luck] || 50) * 0.10 +
      (luckToScore[scwg.zongLuck.luck] || 50) * 0.20
    );

    // 三才吉凶
    const sancaiScore = luckToScore[scwg.sanCai.luck] || 50;

    // 综合评分 (加权)
    const total = Math.round(
      baziScore * 0.25 +
      geScore * 0.30 +
      sancaiScore * 0.15 +
      zodiacScore * 0.15 +
      80 * 0.15  // 寓意基础分
    );

    return {
      total: Math.max(40, Math.min(100, total)),
      baziScore,
      zodiacScore,
      geScore: Math.round(geScore),
      sancaiScore,
      sanCaiWuGe: scwg,
      charWuxingList,
      zodiacDetails,
      luckSummary: {
        tianGe: scwg.tianLuck,
        renGe: scwg.renLuck,
        diGe: scwg.diLuck,
        waiGe: scwg.waiLuck,
        zongGe: scwg.zongLuck,
        sanCai: scwg.sanCai
      }
    };
  }

  /* ============ 名字生成 ============ */

  /* 模式1: 八字补益模式 */
  function generateByBazi(surname, bazi, wuxingAnalysis, gender, count) {
    count = count || 20;
    const xiWx = wuxingAnalysis.favorable.xi;
    const yongWx = wuxingAnalysis.favorable.yong;
    const targetWx = [...new Set([...xiWx, ...yongWx])];

    // 筛选喜用神五行的字
    let pool = NAME_CHARS.filter(c => targetWx.includes(c.wx));

    // 性别过滤
    const femaleChars = ['婷','妍','媛','婉','淑','萱','薇','蓓','蕊','玲','珊','珍','娜','妮','娇','娴','嫣','嫦','娟','妤','绣','莹','芳','芝','芹','萍','琴','琼','瑗','瑛'];
    const maleChars = ['刚','勇','猛','豪','鹏','鸿','瀚','浩','博','杰','伟','超','强','武','虎','彪','峰','军','凯','磊','震','霆','锋','剑','锐','钧','铁','鑫'];
    if (gender === '男') {
      pool = pool.filter(c => !femaleChars.includes(c.ch));
    } else if (gender === '女') {
      pool = pool.filter(c => !maleChars.includes(c.ch));
    }

    // 生肖喜忌过滤
    pool = pool.filter(c => {
      const zc = checkZodiacCompat(c.ch, bazi.zodiac);
      return zc.avoid.length === 0;
    });

    // 生成双字名和单字名
    const results = [];
    const used = new Set();

    // 双字名
    for (let i = 0; i < pool.length && results.length < count; i++) {
      for (let j = i + 1; j < pool.length && results.length < count; j++) {
        const name = [pool[i].ch, pool[j].ch];
        const nameKey = name.join('');
        if (used.has(nameKey)) continue;
        used.add(nameKey);

        const score = scoreName(surname, name, bazi, wuxingAnalysis);
        if (score.total >= 60) {
          results.push({
            surname,
            name: name.join(''),
            fullName: surname + name.join(''),
            chars: [pool[i], pool[j]],
            source: '八字补益',
            score
          });
        }
      }
    }

    // 单字名
    for (const ch of pool) {
      if (results.length >= count) break;
      const name = [ch.ch];
      const score = scoreName(surname, name, bazi, wuxingAnalysis);
      if (score.total >= 55) {
        results.push({
          surname,
          name: ch.ch,
          fullName: surname + ch.ch,
          chars: [ch],
          source: '八字补益',
          score
        });
      }
    }

    // 按总分排序
    results.sort((a,b) => b.score.total - a.score.total);
    return results.slice(0, count);
  }

  /* 模式2: 诗经楚辞模式 */
  function generateByPoetry(surname, bazi, wuxingAnalysis, gender, count) {
    count = count || 20;
    const results = [];
    const used = new Set();

    for (const poem of POETRY) {
      // 从诗句中提取可用字
      const chars = poem.kw || [];
      // 筛选在汉字库中的字
      const validChars = chars.filter(ch => NAME_CHARS.find(c => c.ch === ch));

      // 双字组合
      for (let i = 0; i < validChars.length; i++) {
        for (let j = i + 1; j < validChars.length; j++) {
          const name = [validChars[i], validChars[j]];
          const nameKey = name.join('');
          if (used.has(nameKey)) continue;

          // 生肖忌用过滤
          const zc1 = checkZodiacCompat(validChars[i], bazi.zodiac);
          const zc2 = checkZodiacCompat(validChars[j], bazi.zodiac);
          if (zc1.avoid.length > 0 || zc2.avoid.length > 0) continue;

          used.add(nameKey);
          const charData = name.map(ch => NAME_CHARS.find(c => c.ch === ch));
          const score = scoreName(surname, name, bazi, wuxingAnalysis);

          if (score.total >= 55) {
            results.push({
              surname,
              name: name.join(''),
              fullName: surname + name.join(''),
              chars: charData,
              source: poem.src,
              poemText: poem.text,
              poemAuthor: poem.author,
              score
            });
          }
          if (results.length >= count) break;
        }
        if (results.length >= count) break;
      }
      if (results.length >= count) break;
    }

    results.sort((a,b) => b.score.total - a.score.total);
    return results;
  }

  /* 模式3: 成语典故模式 */
  function generateByClassics(surname, bazi, wuxingAnalysis, gender, count) {
    count = count || 20;
    const idiomChars = NAME_CHARS.filter(c => c.src && c.src.length > 0);
    const results = [];
    const used = new Set();

    for (let i = 0; i < idiomChars.length; i++) {
      for (let j = i + 1; j < idiomChars.length; j++) {
        const name = [idiomChars[i].ch, idiomChars[j].ch];
        const nameKey = name.join('');
        if (used.has(nameKey)) continue;

        const zc1 = checkZodiacCompat(idiomChars[i].ch, bazi.zodiac);
        const zc2 = checkZodiacCompat(idiomChars[j].ch, bazi.zodiac);
        if (zc1.avoid.length > 0 || zc2.avoid.length > 0) continue;

        used.add(nameKey);
        const score = scoreName(surname, name, bazi, wuxingAnalysis);
        if (score.total >= 55) {
          results.push({
            surname,
            name: name.join(''),
            fullName: surname + name.join(''),
            chars: [idiomChars[i], idiomChars[j]],
            source: [idiomChars[i].src, idiomChars[j].src].filter(s => s).join('；'),
            score
          });
        }
        if (results.length >= count) break;
      }
      if (results.length >= count) break;
    }

    results.sort((a,b) => b.score.total - a.score.total);
    return results;
  }

  /* 模式4: 自定义模式 */
  function generateByCustom(surname, bazi, wuxingAnalysis, gender, keyword, count) {
    count = count || 20;
    let pool = NAME_CHARS;

    // 按关键词筛选寓意
    if (keyword && keyword.trim()) {
      pool = pool.filter(c => c.mean.includes(keyword.trim()) || c.ch === keyword.trim());
    }

    // 生肖忌用过滤
    pool = pool.filter(c => {
      const zc = checkZodiacCompat(c.ch, bazi.zodiac);
      return zc.avoid.length === 0;
    });

    const results = [];
    const used = new Set();

    for (let i = 0; i < pool.length && results.length < count; i++) {
      for (let j = i + 1; j < pool.length && results.length < count; j++) {
        const name = [pool[i].ch, pool[j].ch];
        const nameKey = name.join('');
        if (used.has(nameKey)) continue;
        used.add(nameKey);
        const score = scoreName(surname, name, bazi, wuxingAnalysis);
        if (score.total >= 50) {
          results.push({
            surname,
            name: name.join(''),
            fullName: surname + name.join(''),
            chars: [pool[i], pool[j]],
            source: '自定义',
            score
          });
        }
      }
    }

    results.sort((a,b) => b.score.total - a.score.total);
    return results;
  }

  /* 统一入口 */
  function generateNames(surname, bazi, wuxingAnalysis, gender, mode, options) {
    options = options || {};
    let results = [];

    switch (mode) {
      case 'bazi':
        results = generateByBazi(surname, bazi, wuxingAnalysis, gender, options.count);
        break;
      case 'poetry':
        results = generateByPoetry(surname, bazi, wuxingAnalysis, gender, options.count);
        break;
      case 'classics':
        results = generateByClassics(surname, bazi, wuxingAnalysis, gender, options.count);
        break;
      case 'custom':
        results = generateByCustom(surname, bazi, wuxingAnalysis, gender, options.keyword, options.count);
        break;
      default:
        results = generateByBazi(surname, bazi, wuxingAnalysis, gender, options.count);
    }

    return results;
  }

  /* ============ 汉字查询 ============ */
  function queryChar(char) {
    const entry = NAME_CHARS.find(c => c.ch === char);
    if (!entry) return null;
    return {
      ...entry,
      scwg: strokesToWuxing(entry.ks),
      zodiacCompat: ZODIAC.map(z => ({
        zodiac: z,
        compat: checkZodiacCompat(char, z)
      }))
    };
  }

  /* ============ 农历转换 (简化版) ============ */
  /* 公历转农历 (1900-2049) */
  function solarToLunar(year, month, day) {
    // 简化的农历数据表
    // 每年: [闰月, 正月初一公历月日, 12/13个月大小]
    // 1=大月30天, 0=小月29天
    const lunarInfo = [
      0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2, //1900-1909
      0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977, //1910-1919
      0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970, //1920-1929
      0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950, //1930-1939
      0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557, //1940-1949
      0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0, //1950-1959
      0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0, //1960-1969
      0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6, //1970-1979
      0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570, //1980-1989
      0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0, //1990-1999
      0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5, //2000-2009
      0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930, //2010-2019
      0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530, //2020-2029
      0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45, //2030-2039
      0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0, //2040-2049
    ];

    function lunarYearDays(y) {
      let sum = 348;
      for (let i = 0x8000; i > 0x8; i >>= 1) {
        sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
      }
      return sum + leapDays(y);
    }
    function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
    function leapDays(y) {
      if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
      return 0;
    }
    function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

    const baseDate = Date.UTC(1900, 0, 31); // 1900年1月31日 = 农历正月初一
    let offset = Math.floor((Date.UTC(year, month - 1, day) - baseDate) / 86400000);

    let lunarYear = 1900;
    let lunarMonth, lunarDay, isLeap = false;
    let temp = 0;

    for (lunarYear = 1900; lunarYear < 2050 && offset > 0; lunarYear++) {
      temp = lunarYearDays(lunarYear);
      offset -= temp;
    }
    if (offset < 0) { offset += temp; lunarYear--; }

    const leap = leapMonth(lunarYear);
    isLeap = false;
    for (lunarMonth = 1; lunarMonth < 13 && offset > 0; lunarMonth++) {
      if (leap > 0 && lunarMonth === (leap + 1) && !isLeap) {
        --lunarMonth;
        isLeap = true;
        temp = leapDays(lunarYear);
      } else {
        temp = monthDays(lunarYear, lunarMonth);
      }
      if (isLeap && lunarMonth === (leap + 1)) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && lunarMonth === leap + 1) {
      if (isLeap) { isLeap = false; } else { isLeap = true; --lunarMonth; }
    }
    if (offset < 0) { offset += temp; --lunarMonth; }
    lunarDay = offset + 1;

    const lunarMonths = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
    const lunarDays = [
      '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
      '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
      '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
    ];

    // 天干地支纪年
    const stemIdx = ((lunarYear - 1984) % 10 + 10) % 10;
    const branchIdx = ((lunarYear - 1984) % 12 + 12) % 12;
    const ganzhi = STEMS[stemIdx] + BRANCHES[branchIdx];

    return {
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      isLeap: isLeap,
      monthName: (isLeap ? '闰' : '') + lunarMonths[lunarMonth - 1] + '月',
      dayName: lunarDays[lunarDay - 1],
      ganzhi: ganzhi,
      display: `${lunarYear}年${(isLeap ? '闰' : '')}${lunarMonths[lunarMonth - 1]}月${lunarDays[lunarDay - 1]}`
    };
  }

  /* 公开接口 */
  return {
    getBazi,
    analyzeWuxing,
    getFavorableGods,
    calcSanCaiWuGe,
    scoreName,
    generateNames,
    queryChar,
    solarToLunar,
    getKangxiStrokes,
    getCharWuxing,
    checkZodiacCompat,
    strokesToWuxing,
    getProducer, getChild, getController, getControllee
  };
})();
