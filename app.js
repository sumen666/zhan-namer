/* ============================================================
 *  新生儿取名工作台 - 应用逻辑 app.js
 * ============================================================ */

const App = (function() {

  /* ===== 状态 ===== */
  let state = {
    currentPage: 'home',
    gender: '男',
    bazi: null,
    wuxingAnalysis: null,
    surname: '詹',
    nameMode: 'bazi',
    nameResults: [],
    favorites: [],
    compareList: [],
    currentBaziDate: null,
    currentBaziTime: null,
  };

  /* ===== 初始化 ===== */
  function init() {
    loadFavorites();
    setDefaultDate();
    renderDailyName();
    renderFavorites();
    updateShichen();
  }

  function setDefaultDate() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    document.getElementById('inputDate').value = `${y}-${m}-${d}`;
    document.getElementById('inputTime').value = '12:00';
  }

  /* ===== 页面导航 ===== */
  function go(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    const tabs = document.querySelectorAll('.tab-item');
    const idx = ['home','name','favorites','knowledge','profile'].indexOf(page);
    if (idx >= 0 && tabs[idx]) tabs[idx].classList.add('active');
    state.currentPage = page;
    window.scrollTo(0, 0);

    if (page === 'favorites') renderFavorites();
    if (page === 'home') renderDailyName();
  }

  /* ===== 每日荐名 ===== */
  function renderDailyName() {
    const stored = sessionStorage.getItem('dailyName');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        showDailyName(data);
        return;
      } catch(e) {}
    }
    refreshDaily();
  }

  function refreshDaily() {
    const pool = NAME_CHARS.filter(c => c.ch !== '詹' && !['忠','孝','廉'].includes(c.ch));
    const c1 = pool[Math.floor(Math.random() * pool.length)];
    let c2 = pool[Math.floor(Math.random() * pool.length)];
    while (c2.ch === c1.ch) c2 = pool[Math.floor(Math.random() * pool.length)];

    const data = {
      surname: '詹',
      chars: c1.ch + c2.ch,
      pinyin: c1.py + ' ' + c2.py,
      mean1: c1.mean,
      mean2: c2.mean,
      wx1: c1.wx,
      wx2: c2.wx
    };
    sessionStorage.setItem('dailyName', JSON.stringify(data));
    showDailyName(data);
  }

  function showDailyName(data) {
    const fullChars = (data.surname || '詹') + data.chars;
    document.getElementById('dailyChars').innerHTML =
      '<span style="color:var(--coral)">' + (data.surname || '詹') + '</span>' + data.chars;
    document.getElementById('dailyPinyin').textContent = data.pinyin;
    document.getElementById('dailyMean').innerHTML =
      data.mean1 + '<br>' + data.mean2 +
      '<br><span class="text-gold">五行：' + data.wx1 + ' / ' + data.wx2 + '</span>';
  }

  /* ===== 时辰提示 ===== */
  function updateShichen() {
    const timeVal = document.getElementById('inputTime').value;
    if (!timeVal) return;
    const hour = parseInt(timeVal.split(':')[0]);
    let shichen;
    if (hour === 23 || hour === 0) shichen = SHICHEN[0];
    else shichen = SHICHEN[Math.floor((hour + 1) / 2) % 12];

    document.getElementById('shichenHint').textContent = '对应：' + shichen.name + '（' + shichen.time + '）';
  }

  /* ===== 性别选择 ===== */
  function selectGender(el, gender) {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    state.gender = gender;
  }

  /* ===== Step 1 → Step 2 ===== */
  function proceedToStep2() {
    const surname = document.getElementById('inputSurname').value.trim();
    const dateStr = document.getElementById('inputDate').value;
    const timeStr = document.getElementById('inputTime').value;

    if (!surname) { alert('请输入姓氏'); return; }
    if (!dateStr) { alert('请选择出生日期'); return; }
    if (!timeStr) { alert('请选择出生时间'); return; }

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute);

    state.surname = surname;
    state.currentBaziDate = date;
    state.currentBaziTime = hour;

    try {
      state.bazi = Engine.getBazi(date, hour, minute);
      state.wuxingAnalysis = Engine.analyzeWuxing(state.bazi);
    } catch(e) {
      alert('八字排盘出错: ' + e.message);
      return;
    }

    renderBazi();
    renderWuxing();
    renderFavorable();
    renderZodiacPrefs();

    document.getElementById('name-step1').classList.add('hidden');
    document.getElementById('name-step2').classList.remove('hidden');
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step1').classList.add('done');
    document.getElementById('step2').classList.add('active');
  }

  function backToStep1() {
    document.getElementById('name-step2').classList.add('hidden');
    document.getElementById('name-step1').classList.remove('hidden');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step1').classList.add('active');
    document.getElementById('step1').classList.remove('done');
  }

  /* ===== 八字渲染 ===== */
  function renderBazi() {
    const b = state.bazi;
    const container = document.getElementById('baziPillars');
    container.innerHTML = b.pillars.map(p => {
      const stemWx = STEM_WUXING[p.stem];
      const branchWx = BRANCH_WUXING[p.branch];
      return `<div class="pillar">
        <div class="pillar-label">${p.name}</div>
        <div class="pillar-ganzhi">${p.stemName}${p.branchName}</div>
        <div class="pillar-wx">${stemWx}/${branchWx}</div>
      </div>`;
    }).join('');

    const date = state.currentBaziDate;
    document.getElementById('baziDate').textContent =
      `公历：${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 ${state.currentBaziTime}时`;

    const lunar = Engine.solarToLunar(date.getFullYear(), date.getMonth()+1, date.getDate());
    document.getElementById('baziLunar').textContent = `农历：${lunar.display} ${lunar.ganzhi}年`;

    document.getElementById('baziZodiac').textContent = `生肖：${b.zodiac}　日主：${state.wuxingAnalysis.dayMasterName}（${state.wuxingAnalysis.dayMaster}）`;
  }

  /* ===== 五行渲染 ===== */
  function renderWuxing() {
    const wa = state.wuxingAnalysis;
    const counts = wa.counts;
    const max = Math.max(...Object.values(counts), 1);

    // 雷达图 (SVG)
    const svg = document.getElementById('wuxingRadar');
    const cx = 140, cy = 130, R = 90;
    const labels = ['金','木','水','火','土'];
    const colors = ['#C9A86B','#789262','#5B8DBE','#C8553D','#A88B5A'];
    const points = [];
    const valPoints = [];

    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
      const val = counts[labels[i]] / max;
      const r = R * Math.max(val, 0.08);
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      valPoints.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }

    let gridPoints = [];
    for (let g = 0.25; g <= 1; g += 0.25) {
      let gp = [];
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
        gp.push(`${cx + R * g * Math.cos(angle)},${cy + R * g * Math.sin(angle)}`);
      }
      gridPoints.push(gp);
    }

    let svgHtml = '';
    // 网格
    gridPoints.forEach(gp => {
      svgHtml += `<polygon points="${gp.join(' ')}" fill="none" stroke="#EEE" stroke-width="1"/>`;
    });
    // 轴线
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
      svgHtml += `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(angle)}" y2="${cy + R * Math.sin(angle)}" stroke="#F0F0F0" stroke-width="1"/>`;
    }
    // 数据区域
    svgHtml += `<polygon points="${points.join(' ')}" fill="rgba(201,103,79,.15)" stroke="var(--coral)" stroke-width="2"/>`;
    // 数据点
    valPoints.forEach(p => {
      svgHtml += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--coral)"/>`;
    });
    // 标签
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
      const lx = cx + (R + 18) * Math.cos(angle);
      const ly = cy + (R + 18) * Math.sin(angle);
      svgHtml += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="600" fill="${colors[i]}">${labels[i]}</text>`;
      svgHtml += `<text x="${lx}" y="${ly+14}" text-anchor="middle" font-size="10" fill="#999">${counts[labels[i]].toFixed(1)}</text>`;
    }

    svg.innerHTML = svgHtml;

    // 条形图
    const barsContainer = document.getElementById('wuxingBars');
    barsContainer.innerHTML = labels.map((wx, i) => {
      const pct = (counts[wx] / max * 100).toFixed(0);
      return `<div class="wuxing-bar-row">
        <div class="wuxing-bar-label" style="color:${colors[i]}">${wx}</div>
        <div class="wuxing-bar-track">
          <div class="wuxing-bar-fill" style="width:${pct}%;background:${colors[i]}"></div>
        </div>
        <div class="wuxing-bar-val">${counts[wx].toFixed(1)}</div>
      </div>`;
    }).join('');
  }

  /* ===== 喜用神渲染 ===== */
  function renderFavorable() {
    const wa = state.wuxingAnalysis;
    document.getElementById('dayMasterText').textContent =
      `日主为「${wa.dayMasterName}」，五行属「${wa.dayMaster}」。`;

    const tags = document.getElementById('favorableTags');
    let html = '';
    wa.favorable.xi.forEach(wx => {
      html += `<span class="wx-tag xi">喜神：${wx}</span>`;
    });
    wa.favorable.yong.forEach(wx => {
      html += `<span class="wx-tag yong">用神：${wx}</span>`;
    });
    wa.favorable.ji.forEach(wx => {
      html += `<span class="wx-tag ji">忌神：${wx}</span>`;
    });
    tags.innerHTML = html;

    const samePower = [wa.dayMaster, Engine.getProducer(wa.dayMaster)].reduce((s,wx) => s + wa.counts[wx], 0);
    const oppPower = WUXING_LIST.filter(wx => ![wa.dayMaster, Engine.getProducer(wa.dayMaster)].includes(wx)).reduce((s,wx) => s + wa.counts[wx], 0);
    const isStrong = samePower >= oppPower;
    document.getElementById('favorableDesc').textContent =
      `命主${isStrong ? '偏强' : '偏弱'}，${isStrong ? '宜以克泄耗为主' : '宜以生扶为主'}，推荐五行属性为：${[...new Set([...wa.favorable.xi, ...wa.favorable.yong])].join('、')}`;
  }

  /* ===== 生肖喜忌渲染 ===== */
  function renderZodiacPrefs() {
    const zodiac = state.bazi.zodiac;
    const prefs = ZODIAC_PREFS[zodiac];
    const container = document.getElementById('zodiacPrefs');

    let html = `<div class="text-sm text-muted mb-8">生肖属「${zodiac}」，取名宜忌如下：</div>`;
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
    prefs.like.forEach(r => {
      html += `<span style="padding:2px 8px;border-radius:8px;font-size:11px;background:rgba(120,146,98,.15);color:#5a7a4a;">喜：${r}</span>`;
    });
    html += '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
    prefs.avoid.forEach(r => {
      html += `<span style="padding:2px 8px;border-radius:8px;font-size:11px;background:rgba(200,85,61,.12);color:var(--coral);">忌：${r}</span>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  /* ===== Step 2 → Step 3 ===== */
  function proceedToStep3() {
    document.getElementById('name-step2').classList.add('hidden');
    document.getElementById('name-step3').classList.remove('hidden');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step2').classList.add('done');
    document.getElementById('step3').classList.add('active');

    generateAndRender();
  }

  function backToStep2() {
    document.getElementById('name-step3').classList.add('hidden');
    document.getElementById('name-step2').classList.remove('hidden');
    document.getElementById('step3').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    document.getElementById('step2').classList.remove('done');
  }

  /* ===== 模式选择 ===== */
  function selectMode(el, mode) {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    state.nameMode = mode;

    const customInput = document.getElementById('customInput');
    if (mode === 'custom') {
      customInput.classList.remove('hidden');
    } else {
      customInput.classList.add('hidden');
      generateAndRender();
    }
  }

  /* ===== 生成名字 ===== */
  function generateAndRender() {
    const container = document.getElementById('nameResults');
    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div>正在生成好名字...</div>`;

    setTimeout(() => {
      let keyword = '';
      if (state.nameMode === 'custom') {
        keyword = document.getElementById('customKeyword').value.trim();
      }

      try {
        state.nameResults = Engine.generateNames(
          state.surname,
          state.bazi,
          state.wuxingAnalysis,
          state.gender,
          state.nameMode,
          { count: 20, keyword: keyword }
        );
      } catch(e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">生成失败：${e.message}</div></div>`;
        return;
      }

      if (state.nameResults.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">未找到符合条件的名字<br>试试其他模式或调整条件</div></div>`;
        return;
      }

      renderNameCards();
    }, 300);
  }

  function regenerate() {
    generateAndRender();
  }

  function renderNameCards() {
    const container = document.getElementById('nameResults');
    const favNames = new Set(state.favorites.map(f => f.fullName));
    const compareNames = new Set(state.compareList.map(c => c.fullName));

    container.innerHTML = state.nameResults.map((item, idx) => {
      const isFav = favNames.has(item.fullName);
      const inCompare = compareNames.has(item.fullName);
      const score = item.score;
      const scoreColor = score.total >= 80 ? 'var(--coral)' : score.total >= 65 ? 'var(--gold)' : 'var(--ink-light)';

      let tagsHtml = '';
      item.chars.forEach(c => {
        tagsHtml += `<span class="name-tag">${c.ch}·${c.wx}</span>`;
      });

      const luckSummary = score.luckSummary;
      const sancaiLuck = luckSummary.sanCai.luck;

      let sourceHtml = '';
      if (item.source && item.source !== '八字补益' && item.source !== '自定义') {
        sourceHtml = `<div class="name-source">出处：${item.source}</div>`;
      }
      if (item.poemText) {
        sourceHtml += `<div class="name-source">「${item.poemText}」</div>`;
      }

      return `<div class="name-card">
        <div class="name-header">
          <div>
            <div class="name-chars"><span class="surname-char">${item.surname}</span>${item.name}</div>
            <div class="name-py">${item.chars.map(c => c.py).join(' ')}</div>
          </div>
          <div class="name-score-badge">
            <div class="name-score-val" style="color:${scoreColor}">${score.total}</div>
            <div class="name-score-label">综合评分</div>
          </div>
        </div>
        <div class="name-mean">${item.chars.map(c => '「' + c.ch + '」' + c.mean).join('；')}</div>
        ${sourceHtml}
        <div class="name-tags">${tagsHtml}</div>
        <div class="text-sm text-muted">
          三才：${sancaiLuck}　|　八字：${score.baziScore}　|　生肖：${score.zodiacScore}
        </div>
        <div class="name-actions">
          <div class="name-action-btn ${isFav ? 'fav-active' : ''}" onclick="App.toggleFav(${idx})">
            ${isFav ? '★ 已收藏' : '☆ 收藏'}
          </div>
          <div class="name-action-btn" onclick="App.showDetail(${idx})">详情</div>
          <div class="name-action-btn" onclick="App.shareName(${idx})">分享</div>
          <div class="name-action-btn ${inCompare ? 'fav-active' : ''}" onclick="App.toggleCompare(${idx})">
            ${inCompare ? '✓ 对比' : '对比'}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  /* ===== 名字详情 ===== */
  function showDetail(idx) {
    const item = state.nameResults[idx];
    if (!item) return;
    const s = item.score;
    const scwg = s.sanCaiWuGe;

    const luckClass = (luck) => {
      if (luck.includes('大吉')) return '大吉';
      if (luck.includes('凶')) return '凶';
      return '吉';
    };

    let html = `
      <div class="modal-handle"></div>
      <div class="text-center mb-16">
        <div style="font-size:36px;font-weight:800;font-family:'STKaiti','KaiTi',serif;letter-spacing:6px;">
          <span class="text-coral">${item.surname}</span>${item.name}
        </div>
        <div class="text-sm text-muted mt-8">${item.chars.map(c => c.py).join(' ')}</div>
        <div style="font-size:36px;font-weight:800;color:var(--coral);margin-top:8px;">${s.total}<span style="font-size:14px;font-weight:400;">分</span></div>
      </div>
    `;

    // 评分明细
    html += `<div class="card"><div class="card-title">评分明细</div>`;
    html += `<div class="score-detail-row"><div class="score-detail-label">八字契合度</div><div class="score-detail-val">${s.baziScore}</div></div>`;
    html += `<div class="score-detail-row"><div class="score-detail-label">数理吉凶</div><div class="score-detail-val">${s.geScore}</div></div>`;
    html += `<div class="score-detail-row"><div class="score-detail-label">三才吉凶</div><div class="score-detail-val">${s.sancaiScore}</div></div>`;
    html += `<div class="score-detail-row"><div class="score-detail-label">生肖契合度</div><div class="score-detail-val">${s.zodiacScore}</div></div>`;
    html += `</div>`;

    // 三才五格
    html += `<div class="card"><div class="card-title">三才五格（康熙笔画）</div>`;
    html += `<div class="text-sm text-muted mb-8">`;
    html += `姓氏「${item.surname}」康熙笔画：${scwg.surnameStrokes.join('+')}=${scwg.surnameStrokes.reduce((a,b)=>a+b,0)}　`;
    html += `名字康熙笔画：${scwg.nameStrokes.join('+')}=${scwg.nameStrokes.reduce((a,b)=>a+b,0)}`;
    html += `</div>`;
    html += `<div class="wuge-grid">`;
    html += wugeItem('天格', scwg.tianGe, scwg.tianLuck.luck, scwg.tianWx);
    html += wugeItem('人格', scwg.renGe, scwg.renLuck.luck, scwg.renWx);
    html += wugeItem('地格', scwg.diGe, scwg.diLuck.luck, scwg.diWx);
    html += wugeItem('外格', scwg.waiGe, scwg.waiLuck.luck, '');
    html += wugeItem('总格', scwg.zongGe, scwg.zongLuck.luck, '');
    html += `</div>`;
    html += `<div class="mt-16 text-sm">
      <div class="mb-8"><strong>三才：</strong>${scwg.sanCaiKey} — ${scwg.sanCai.luck}</div>
      <div class="text-muted">${scwg.sanCai.desc}</div>
    </div>`;
    html += `</div>`;

    // 用字详解
    html += `<div class="card"><div class="card-title">用字详解</div>`;
    item.chars.forEach(c => {
      html += `<div style="padding:10px 0;border-bottom:1px solid #F5F5F5;">
        <div style="font-size:24px;font-weight:700;color:var(--coral);font-family:'STKaiti','KaiTi',serif;">${c.ch}</div>
        <div class="text-sm text-muted">拼音：${c.py}　康熙笔画：${c.ks}　五行：${c.wx}</div>
        <div class="text-sm mt-8">${c.mean}</div>
        ${c.src ? `<div class="text-sm text-gold mt-8">出处：${c.src}</div>` : ''}
      </div>`;
    });
    html += `</div>`;

    // 出处
    if (item.source || item.poemText) {
      html += `<div class="card"><div class="card-title">名字出处</div>`;
      if (item.source) html += `<div class="text-sm text-muted mb-8">${item.source}</div>`;
      if (item.poemText) html += `<div class="text-sm" style="font-style:italic;">「${item.poemText}」</div>`;
      if (item.poemAuthor) html += `<div class="text-sm text-gold mt-8">— ${item.poemAuthor}</div>`;
      html += `</div>`;
    }

    // 免责声明
    html += `<div class="disclaimer">命理分析仅供参考娱乐，不构成任何决策依据</div>`;

    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function wugeItem(name, val, luck, wx) {
    const lk = luck || '—';
    const cls = luckClass(lk);
    return `<div class="wuge-item">
      <div class="wuge-name">${name}${wx ? '('+wx+')' : ''}</div>
      <div class="wuge-val">${val}</div>
      <div class="wuge-luck ${cls}">${lk}</div>
    </div>`;
  }

  function luckClass(luck) {
    if (!luck) return '';
    if (luck.includes('大吉')) return '大吉';
    if (luck.includes('凶')) return '凶';
    return '吉';
  }

  function closeModal(e) {
    if (e.target === document.getElementById('modalOverlay')) {
      document.getElementById('modalOverlay').classList.remove('show');
    }
  }

  /* ===== 收藏管理 ===== */
  function loadFavorites() {
    try {
      state.favorites = JSON.parse(localStorage.getItem('nameFavorites') || '[]');
    } catch(e) {
      state.favorites = [];
    }
  }

  function saveFavorites() {
    localStorage.setItem('nameFavorites', JSON.stringify(state.favorites));
  }

  function toggleFav(idx) {
    const item = state.nameResults[idx];
    if (!item) return;
    const existing = state.favorites.findIndex(f => f.fullName === item.fullName);
    if (existing >= 0) {
      state.favorites.splice(existing, 1);
    } else {
      state.favorites.push({
        surname: item.surname,
        name: item.name,
        fullName: item.fullName,
        chars: item.chars,
        source: item.source,
        score: item.score.total,
        baziScore: item.score.baziScore,
        zodiacScore: item.score.zodiacScore
      });
    }
    saveFavorites();
    renderNameCards();
  }

  function renderFavorites() {
    const container = document.getElementById('favList');
    const empty = document.getElementById('favEmpty');
    const countLabel = document.getElementById('favCount');

    countLabel.textContent = `收藏 ${state.favorites.length} 个名字`;

    if (state.favorites.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = state.favorites.map((item, idx) => {
      return `<div class="name-card">
        <div class="name-header">
          <div>
            <div class="name-chars"><span class="surname-char">${item.surname}</span>${item.name}</div>
            <div class="name-py">${item.chars.map(c => c.py).join(' ')}</div>
          </div>
          <div class="name-score-badge">
            <div class="name-score-val">${item.score}</div>
            <div class="name-score-label">综合评分</div>
          </div>
        </div>
        <div class="name-mean">${item.chars.map(c => '「' + c.ch + '」' + c.mean).join('；')}</div>
        ${item.source && item.source !== '八字补益' ? `<div class="name-source">出处：${item.source}</div>` : ''}
        <div class="text-sm text-muted">
          八字：${item.baziScore}　|　生肖：${item.zodiacScore}
        </div>
        <div class="name-actions">
          <div class="name-action-btn fav-active" onclick="App.removeFav(${idx})">★ 取消收藏</div>
        </div>
      </div>`;
    }).join('');
  }

  function removeFav(idx) {
    state.favorites.splice(idx, 1);
    saveFavorites();
    renderFavorites();
  }

  function clearFavorites() {
    if (state.favorites.length === 0) { alert('收藏夹已为空'); return; }
    if (!confirm('确定清空所有收藏吗？此操作不可撤销。')) return;
    state.favorites = [];
    saveFavorites();
    renderFavorites();
  }

  /* ===== 汉字查询 ===== */
  function queryChar() {
    const ch = document.getElementById('charQuery').value.trim();
    const container = document.getElementById('charResult');
    if (!ch) { container.innerHTML = ''; return; }

    const result = Engine.queryChar(ch);
    if (!result) {
      container.innerHTML = `<div class="text-center text-muted mt-16">未收录「${ch}」字，请尝试其他常用取名用字</div>`;
      return;
    }

    let html = `<div class="char-result">
      <div class="char-display">${result.ch}</div>
      <div class="text-sm text-muted">拼音：${result.py}　简体笔画：${result.ss}　康熙笔画：${result.ks}</div>
      <div class="text-sm text-coral mt-8">五行属性：${result.wx}（三才数理：${result.scwg}）</div>
      <div class="text-sm mt-8" style="line-height:1.8;">${result.mean}</div>
      ${result.src ? `<div class="text-sm text-gold mt-8">出处：${result.src}</div>` : ''}
    </div>`;

    // 生肖兼容性
    html += `<div class="mt-16"><div class="text-sm text-muted mb-8">十二生肖兼容性：</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
    result.zodiacCompat.forEach(zc => {
      const color = zc.compat.score >= 80 ? '#5a7a4a' : zc.compat.score >= 50 ? '#999' : 'var(--coral)';
      const bg = zc.compat.score >= 80 ? 'rgba(120,146,98,.12)' : zc.compat.score >= 50 ? '#F5F5F5' : 'rgba(200,85,61,.10)';
      html += `<span style="padding:3px 8px;border-radius:8px;font-size:11px;background:${bg};color:${color};">${zc.zodiac}:${zc.compat.score}</span>`;
    });
    html += `</div></div>`;

    container.innerHTML = html;
  }

  /* ===== 知识文章 ===== */
  function showArticle(topic) {
    const articles = {
      bazi: {
        title: '生辰八字入门',
        content: `
          <h3>什么是八字？</h3>
          <p>八字，又称四柱八字，是根据人出生的年、月、日、时，各用一组天干地支来表示，共四组（四柱），每组两个字，合共八个字，故称"八字"。</p>
          <h3>四柱构成</h3>
          <p><strong>年柱：</strong>以立春为年份分界（非农历正月初一），由出生年份的天干地支组成。</p>
          <p><strong>月柱：</strong>以节气为月份分界，正月寅月从立春开始。月干按"五虎遁"口诀推算。</p>
          <p><strong>日柱：</strong>按万年历查表，每日一组干支，六十甲子循环。</p>
          <p><strong>时柱：</strong>按出生时辰确定地支，时干按"五鼠遁"口诀推算。</p>
          <h3>时辰对照</h3>
          <p>子时(23-1)、丑时(1-3)、寅时(3-5)、卯时(5-7)、辰时(7-9)、巳时(9-11)、午时(11-13)、未时(13-15)、申时(15-17)、酉时(17-19)、戌时(19-21)、亥时(21-23)。</p>
          <h3>日主</h3>
          <p>日柱的天干称为"日主"或"命主"，代表命主本人。分析五行强弱即以日主为核心。</p>
        `
      },
      wuxing: {
        title: '五行相生相克',
        content: `
          <h3>五行</h3>
          <p>五行指金、木、水、火、土五种基本元素。古人认为万物皆由五行构成，五行之间存在相生相克的关系。</p>
          <h3>五行相生</h3>
          <p>木生火、火生土、土生金、金生水、水生木。相生表示互相滋生、助长。</p>
          <h3>五行相克</h3>
          <p>木克土、土克水、水克火、火克金、金克木。相克表示互相制约、克制。</p>
          <h3>天干五行</h3>
          <p>甲乙木、丙丁火、戊己土、庚辛金、壬癸水。</p>
          <h3>地支五行</h3>
          <p>寅卯木、巳午火、申酉金、亥子水、辰戌丑未土。</p>
          <h3>喜用神</h3>
          <p>八字分析中，根据日主五行的强弱，确定对命主有利的五行（喜神、用神）和不利的五行（忌神）。取名时选用喜用神五行的字，可起到补益命局的作用。</p>
          <p><strong>身强：</strong>宜用克我、我生、我克的五行（官杀、食伤、财星）。</p>
          <p><strong>身弱：</strong>宜用生我、同我的五行（印星、比劫）。</p>
        `
      },
      sanCai: {
        title: '三才五格原理',
        content: `
          <h3>五格</h3>
          <p>五格指天格、人格、地格、外格、总格，是根据姓名的康熙笔画数计算得出的五个数理。</p>
          <p><strong>天格：</strong>姓氏笔画+1（单姓）或复姓笔画之和。代表祖上、长辈。</p>
          <p><strong>人格：</strong>姓氏末字笔画+名字首字笔画。姓名的核心，代表自身。</p>
          <p><strong>地格：</strong>名字笔画之和+1（单名）或名字笔画之和（双名）。代表下属、晚辈。</p>
          <p><strong>外格：</strong>总格-人格+1。代表外部人际关系。</p>
          <p><strong>总格：</strong>姓名所有字笔画之和。代表整体运势。</p>
          <h3>三才</h3>
          <p>三才指天格、人格、地格的五行属性组合。笔画数尾数对应五行：1-2木、3-4火、5-6土、7-8金、9-0水。三才组合的吉凶影响整体命格。</p>
          <h3>八十一数理</h3>
          <p>1-81每个数都有对应的吉凶判断。五格各格的数理吉凶直接影响名字的评分。</p>
          <p><strong>注意：</strong>笔画数必须按康熙字典计算，不能用简体笔画。例如"泽"简体8画，康熙17画；"华"简体6画，康熙14画。</p>
        `
      },
      zodiac: {
        title: '生肖取名讲究',
        content: `
          <h3>生肖与取名</h3>
          <p>十二生肖各有喜用和忌用的字根（偏旁部首）。取名时选用喜用字根、避开忌用字根，可增加名字的吉祥寓意。</p>
          <h3>举例</h3>
          <p><strong>鼠：</strong>喜"米""禾""宀"（有家有粮），忌"日""猫"（天敌、日光下不安）。</p>
          <p><strong>牛：</strong>喜"艹""田""水"（有草有田），忌"羊""马"（三刑）。</p>
          <p><strong>虎：</strong>喜"山""木""林"（山林为王），忌"猴""蛇"（相冲）。</p>
          <p><strong>龙：</strong>喜"水""日""月""王"（龙游水、伴日月），忌"虫""犬"（相冲）。</p>
          <h3>注意事项</h3>
          <p>生肖喜忌是取名参考之一，需结合八字五行、三才五格综合判断，不可偏废。</p>
        `
      },
      strokes: {
        title: '康熙笔画的重要性',
        content: `
          <h3>为什么用康熙笔画？</h3>
          <p>三才五格的数理计算，传统上以《康熙字典》的笔画为准。这是因为：</p>
          <p>1. 康熙字典收录的是繁体字（正体字），笔画数固定规范。</p>
          <p>2. 传统命理学形成于清代，以康熙字典为标准。</p>
          <p>3. 简体字推行后，许多字笔画数变化很大，若用简体笔画计算，结果与传统命理不符。</p>
          <h3>常见差异</h3>
          <p>"泽"：简体8画 → 康熙17画（澤）</p>
          <p>"华"：简体6画 → 康熙14画（華）</p>
          <p>"国"：简体8画 → 康熙11画（國）</p>
          <p>"学"：简体8画 → 康熙16画（學）</p>
          <p>"庆"：简体6画 → 康熙15画（慶）</p>
          <h3>特别注意</h3>
          <p>有些字简繁体笔画相同（如"明"8画），有些则差异很大。取名时务必用康熙笔画，否则三才五格的计算结果将完全不同。</p>
        `
      }
    };

    const article = articles[topic];
    if (!article) return;

    const style = `<style>
      .article h3 { color: var(--coral); font-size: 16px; margin: 16px 0 8px; }
      .article p { font-size: 14px; color: var(--ink-light); line-height: 2; margin-bottom: 8px; }
      .article strong { color: var(--ink); }
    </style>`;

    document.getElementById('modalContent').innerHTML = `
      <div class="modal-handle"></div>
      <div style="font-size:20px;font-weight:700;color:var(--coral);margin-bottom:16px;">${article.title}</div>
      <div class="article">${article.content}</div>
      <div class="disclaimer">以上内容仅供参考</div>
    `;
    document.getElementById('modalOverlay').classList.add('show');
  }

  function showKnowledge(tab) {
    go('knowledge');
    if (tab === 'dict') {
      setTimeout(() => document.getElementById('charQuery').focus(), 300);
    }
  }

  function startNameFlow() {
    // 在取名页直接进入step1，但需要确保页面已显示
  }

  /* ===== 缓存管理 ===== */
  function clearCache() {
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    if (window.navigator && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      });
    }
    localStorage.clear();
    sessionStorage.clear();
    alert('缓存已清除，请重新打开页面');
    location.reload();
  }

  /* ===== 分享名字 ===== */
  function shareName(idx) {
    const item = state.nameResults[idx];
    if (!item) return;
    const s = item.score;
    const scwg = s.sanCaiWuGe;

    const text = `${item.fullName}\n` +
      `综合评分：${s.total}分\n` +
      `八字契合：${s.baziScore} | 生肖契合：${s.zodiacScore}\n` +
      `三才：${scwg.sanCaiKey}（${scwg.sanCai.luck}）\n` +
      `总格：${scwg.zongGe}（${scwg.zongLuck.luck}）\n` +
      `用字：${item.chars.map(c => c.ch+'('+c.wx+')').join(' ')}\n` +
      `${item.source ? '出处：'+item.source : ''}`;

    if (navigator.share) {
      navigator.share({ title: item.fullName + ' - 取名分析', text: text })
        .catch(() => copyToClipboard(text, '名字详情已复制'));
    } else {
      copyToClipboard(text, '名字详情已复制');
    }
  }

  function copyToClipboard(text, msg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (msg) alert(msg);
      }).catch(() => fallbackCopy(text, msg));
    } else {
      fallbackCopy(text, msg);
    }
  }

  function fallbackCopy(text, msg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (msg) alert(msg); } catch(e) {}
    document.body.removeChild(ta);
  }

  /* ===== 名字对比 ===== */
  function toggleCompare(idx) {
    const item = state.nameResults[idx];
    if (!item) return;
    const existing = state.compareList.findIndex(c => c.fullName === item.fullName);
    if (existing >= 0) {
      state.compareList.splice(existing, 1);
    } else {
      if (state.compareList.length >= 4) {
        alert('最多对比4个名字，请先取消已有的对比');
        return;
      }
      state.compareList.push({
        surname: item.surname,
        name: item.name,
        fullName: item.fullName,
        chars: item.chars,
        score: item.score
      });
    }
    renderNameCards();
    updateCompareBar();
  }

  function updateCompareBar() {
    let bar = document.getElementById('compareBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'compareBar';
      bar.className = 'compare-bar';
      document.getElementById('name-step3').appendChild(bar);
    }

    if (state.compareList.length < 2) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = `
      <span style="font-size:13px;">已选 ${state.compareList.length} 个</span>
      <button class="btn btn-primary" style="padding:8px 20px;font-size:13px;max-width:none;" onclick="App.showCompare()">开始对比</button>
      <button class="btn btn-ghost" style="padding:8px 16px;font-size:13px;max-width:none;" onclick="App.clearCompare()">清空</button>
    `;
  }

  function clearCompare() {
    state.compareList = [];
    renderNameCards();
    updateCompareBar();
  }

  function showCompare() {
    if (state.compareList.length < 2) return;

    const items = state.compareList;
    let html = '<div class="modal-handle"></div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--coral);margin-bottom:16px;">名字对比</div>';

    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table class="compare-table"><thead><tr><th>名字</th>';
    items.forEach(it => {
      html += `<th><span style="font-size:18px;font-weight:700;font-family:'STKaiti','KaiTi',serif;">${it.fullName}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    const rows = [
      { label: '综合评分', get: it => it.score.total },
      { label: '八字契合', get: it => it.score.baziScore },
      { label: '数理吉凶', get: it => it.score.geScore },
      { label: '三才吉凶', get: it => it.score.sancaiScore },
      { label: '生肖契合', get: it => it.score.zodiacScore },
      { label: '天格', get: it => it.score.sanCaiWuGe.tianGe + '(' + it.score.sanCaiWuGe.tianLuck.luck + ')' },
      { label: '人格', get: it => it.score.sanCaiWuGe.renGe + '(' + it.score.sanCaiWuGe.renLuck.luck + ')' },
      { label: '地格', get: it => it.score.sanCaiWuGe.diGe + '(' + it.score.sanCaiWuGe.diLuck.luck + ')' },
      { label: '总格', get: it => it.score.sanCaiWuGe.zongGe + '(' + it.score.sanCaiWuGe.zongLuck.luck + ')' },
      { label: '三才五行', get: it => it.score.sanCaiWuGe.sanCaiKey + '(' + it.score.sanCaiWuGe.sanCai.luck + ')' },
      { label: '用字五行', get: it => it.score.charWuxingList.join('/') },
      { label: '寓意', get: it => it.chars.map(c => c.mean.split(',')[0]).join('；') },
    ];

    rows.forEach(row => {
      html += `<tr><td style="font-weight:600;color:var(--coral);text-align:right;">${row.label}</td>`;
      const vals = items.map(it => row.get(it));
      const maxVal = Math.max(...vals.filter(v => typeof v === 'number'));
      items.forEach((it, i) => {
        const val = vals[i];
        const isMax = typeof val === 'number' && val === maxVal && maxVal > 0;
        html += `<td style="${isMax ? 'color:var(--coral);font-weight:700;' : ''}">${val}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<div class="disclaimer">命理分析仅供参考娱乐</div>';

    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
  }

  /* ===== 导出收藏 ===== */
  function exportFavorites() {
    if (state.favorites.length === 0) { alert('收藏夹为空'); return; }
    const lines = state.favorites.map(f =>
      `${f.fullName}（${f.score}分）` +
      `${f.chars.map(c => c.ch+'('+c.wx+')').join(' ')}` +
      `${f.source ? ' ['+f.source+']' : ''}`
    );
    const text = '取名工作台 - 收藏列表\n\n' + lines.join('\n');
    copyToClipboard(text, '收藏列表已复制到剪贴板');
  }

  /* ===== 公开接口 ===== */
  return {
    init, go, refreshDaily, updateShichen, selectGender,
    proceedToStep2, backToStep1, proceedToStep3, backToStep2,
    selectMode, regenerate, showDetail, closeModal,
    toggleFav, removeFav, clearFavorites, renderFavorites,
    queryChar, showArticle, showKnowledge, startNameFlow, clearCache,
    shareName, toggleCompare, clearCompare, showCompare, exportFavorites
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
