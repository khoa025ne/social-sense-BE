/* ═══════════════════════════════════════════════════════════
   SocialSense Frontend — app.js
   API Base: https://localhost:7149
═══════════════════════════════════════════════════════════ */

const API = 'https://localhost:7149';

// ── State ──────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('ss_token') || null,
  userId: localStorage.getItem('ss_userId') || null,
  displayName: localStorage.getItem('ss_name') || null,
  hasContext: localStorage.getItem('ss_hasContext') === 'true',
  outputCount: 1,
  currentPage: 'login',
  trendsData: [],
  historyPage: 1,
  historyTotal: 0,
  activeTagFilter: null,
};

// ── API Helper ─────────────────────────────────────────────
async function api(method, path, body = null, isForm = false) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(API + path, opts);
  if (res.status === 204) return null;

  let data;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const msg = data?.message || data?.code || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ── Page Router ────────────────────────────────────────────
function showPage(name) {
  // Guard: nếu chưa login
  if (!state.token && !['login'].includes(name)) {
    showPage('login'); return;
  }
  // Guard: nếu chưa có context
  if (state.token && !state.hasContext && name !== 'onboarding') {
    showPage('onboarding'); return;
  }

  // Ẩn tất cả pages
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none'; p.classList.remove('active');
  });

  const target = document.getElementById(`page-${name}`);
  if (target) { target.style.display = 'block'; target.classList.add('active'); }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === name);
  });

  state.currentPage = name;

  // Lazy load data
  if (name === 'dashboard') loadDashboard();
  if (name === 'trends') loadTrends();
  if (name === 'history') loadHistory(1);
  if (name === 'generate') loadTrendsForSelect();
}

// ── Auth ───────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Đang đăng nhập...';

  try {
    const data = await api('POST', '/auth/login', {
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value,
    });
    saveAuth(data);
    updateNavAuth();
    showPage(data.hasContext ? 'dashboard' : 'onboarding');
    showToast('Đăng nhập thành công!', 'success');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Đang tạo tài khoản...';

  try {
    await api('POST', '/auth/register', {
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPassword').value,
      displayName: document.getElementById('regName').value.trim() || undefined,
    });
    showToast('Tạo tài khoản thành công! Đang đăng nhập...', 'success');
    // Auto login
    const data = await api('POST', '/auth/login', {
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPassword').value,
    });
    saveAuth(data);
    updateNavAuth();
    showPage('onboarding');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo tài khoản';
  }
}

function saveAuth(data) {
  state.token = data.accessToken;
  state.userId = null; // will be decoded from JWT
  state.displayName = data.displayName;
  state.hasContext = data.hasContext;
  localStorage.setItem('ss_token', data.accessToken);
  localStorage.setItem('ss_name', data.displayName || '');
  localStorage.setItem('ss_hasContext', data.hasContext ? 'true' : 'false');
  // Decode userId from JWT
  try {
    const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
    state.userId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
      || payload.sub || payload.nameid || payload.userId;
    localStorage.setItem('ss_userId', state.userId);
  } catch {}
}

function logout() {
  state.token = null; state.userId = null;
  state.displayName = null; state.hasContext = false;
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_userId');
  localStorage.removeItem('ss_name');
  localStorage.removeItem('ss_hasContext');
  updateNavAuth();
  showPage('login');
  showToast('Đã đăng xuất');
}

function updateNavAuth() {
  const loggedIn = !!state.token;
  document.getElementById('btnLogin').style.display = loggedIn ? 'none' : 'inline-flex';
  document.getElementById('btnLogout').style.display = loggedIn ? 'inline-flex' : 'none';
  document.getElementById('quotaBadge').style.display = loggedIn ? 'flex' : 'none';
  if (loggedIn && state.displayName) {
    document.getElementById('heroName').textContent = state.displayName;
  }
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── Onboarding ─────────────────────────────────────────────
async function handleOnboarding(e) {
  e.preventDefault();
  const btn = document.getElementById('onboardBtn');
  const errEl = document.getElementById('onboardError');
  errEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>AI đang phân tích...';

  const answers = [
    document.getElementById('q1').value.trim(),
    document.getElementById('q2').value.trim(),
    document.getElementById('q3').value.trim(),
    document.getElementById('q4').value.trim(),
    document.getElementById('q5').value.trim(),
  ].filter(Boolean);

  const lang = document.querySelector('input[name="lang"]:checked')?.value || 'vi';

  try {
    await api('POST', '/context/onboarding', {
      userId: state.userId,
      answers,
      language: lang,
    });
    state.hasContext = true;
    localStorage.setItem('ss_hasContext', 'true');
    showToast('Brand Persona đã được tạo!', 'success');
    showPage('dashboard');
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Phân tích & Tạo Brand Persona ✦';
  }
}

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  // Load persona
  try {
    const persona = await api('GET', `/context/persona?userId=${state.userId}`);
    renderPersona(persona);
  } catch {}

  // Load history count
  try {
    const hist = await api('GET', `/content/history?userId=${state.userId}&page=1&pageSize=1`);
    document.getElementById('statContent').textContent = hist?.total ?? '—';
  } catch {}

  // Load trends count
  try {
    const trends = await api('GET', '/trends?page=1&pageSize=1');
    document.getElementById('statTrends').textContent = trends?.total ?? '—';
  } catch {}

  // Load quota from user info (decoded from JWT or stored)
  updateQuotaDisplay();
}

function renderPersona(p) {
  if (!p) { document.getElementById('personaCard').innerHTML = '<div class="persona-loading">Chưa có persona. <a href="#" class="btn-text-link" onclick="showPage(\'onboarding\')">Thiết lập ngay →</a></div>'; return; }
  const tags = (arr) => (arr || []).map(t => `<span class="persona-tag">${t}</span>`).join('');
  document.getElementById('personaCard').innerHTML = `
    <div class="persona-grid">
      <div class="persona-field"><span class="persona-key">Lĩnh vực</span><span class="persona-val">${p.jobTitle || '—'}</span></div>
      <div class="persona-field"><span class="persona-key">Tone of Voice</span><span class="persona-val">${p.toneOfVoice || '—'}</span></div>
      <div class="persona-field"><span class="persona-key">Ngôn ngữ</span><span class="persona-val">${p.language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'}</span></div>
      <div class="persona-field"><span class="persona-key">Nền tảng</span><div class="persona-tags">${tags(p.platformPreferences) || '<span class="persona-val muted-text">Chưa thiết lập</span>'}</div></div>
      <div class="persona-field"><span class="persona-key">Đối tượng</span><div class="persona-tags">${tags(p.targetAudience) || '<span class="persona-val muted-text">Chưa thiết lập</span>'}</div></div>
      <div class="persona-field"><span class="persona-key">Hạn chế</span><div class="persona-tags">${tags(p.negativeConstraints) || '<span class="persona-val muted-text">Không có</span>'}</div></div>
    </div>`;
}

function updateQuotaDisplay() {
  const badge = document.getElementById('quotaBadge');
  const text = document.getElementById('quotaText');
  if (badge && text) {
    badge.style.display = 'flex';
    text.textContent = 'quota';
  }
}

// ── Trends ─────────────────────────────────────────────────
async function loadTrends() {
  document.getElementById('trendsGrid').innerHTML = '<div class="loading-state"><span class="spinner"></span>Đang tải xu hướng...</div>';
  try {
    const [trendsRes, tagsRes] = await Promise.all([
      api('GET', '/trends?page=1&pageSize=50'),
      api('GET', '/trends/tags'),
    ]);
    state.trendsData = trendsRes?.items || trendsRes?.data || [];
    renderTagFilters(tagsRes || []);
    renderTrends(state.trendsData);
  } catch (err) {
    document.getElementById('trendsGrid').innerHTML = `<div class="loading-state">Lỗi tải xu hướng: ${err.message}</div>`;
  }
}

function renderTagFilters(tags) {
  const el = document.getElementById('tagFilters');
  el.innerHTML = `<button class="tag-filter-btn active" onclick="filterByTag(null, this)">Tất cả</button>` +
    tags.slice(0, 10).map(t => `<button class="tag-filter-btn" onclick="filterByTag('${t.name || t}', this)">${t.name || t}</button>`).join('');
}

function filterByTag(tag, btn) {
  state.activeTagFilter = tag;
  document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterTrends();
}

function filterTrends() {
  const q = document.getElementById('trendSearch').value.toLowerCase();
  const filtered = state.trendsData.filter(t => {
    const matchQ = !q || t.title?.toLowerCase().includes(q) || t.summary?.toLowerCase().includes(q);
    const matchTag = !state.activeTagFilter || (t.tags || []).some(tag => (tag.name || tag) === state.activeTagFilter);
    return matchQ && matchTag;
  });
  renderTrends(filtered);
}

function renderTrends(trends) {
  const el = document.getElementById('trendsGrid');
  if (!trends.length) { el.innerHTML = '<div class="loading-state">Không tìm thấy xu hướng nào</div>'; return; }
  el.innerHTML = trends.map(t => {
    const hotClass = `hot-${t.hotLevel || 3}`;
    const hotLabel = ['', '🌱', '📊', '🔥', '⚡', '💥'][t.hotLevel || 3];
    const sentClass = `sentiment-${t.sentiment || 'neutral'}`;
    const sentLabel = { positive: 'Tích cực', negative: 'Tiêu cực', neutral: 'Trung lập' }[t.sentiment] || 'Trung lập';
    const tags = (t.tags || []).slice(0, 3).map(tag => `<span class="trend-tag">${tag.name || tag}</span>`).join('');
    return `
    <div class="trend-card" onclick="useTrend('${t.id}', '${escHtml(t.title)}')">
      <div class="trend-card-top">
        <span class="trend-title">${escHtml(t.title)}</span>
        <span class="hot-badge ${hotClass}">${hotLabel} ${t.hotLevel || 3}</span>
      </div>
      <p class="trend-summary">${escHtml(t.summary || '')}</p>
      <div class="trend-footer">
        <div class="trend-tags">${tags}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="sentiment-badge ${sentClass}">${sentLabel}</span>
          <button class="trend-use-btn" onclick="event.stopPropagation();useTrend('${t.id}','${escHtml(t.title)}')">Dùng →</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function useTrend(id, title) {
  showPage('generate');
  setTimeout(() => {
    const sel = document.getElementById('trendSelect');
    if (sel) {
      // Thêm option nếu chưa có
      let opt = sel.querySelector(`option[value="${id}"]`);
      if (!opt) { opt = new Option(title, id); sel.add(opt); }
      sel.value = id;
    }
    showToast(`Đã chọn: ${title}`, 'success');
  }, 200);
}

async function loadTrendsForSelect() {
  try {
    const res = await api('GET', '/trends?page=1&pageSize=20');
    const trends = res?.items || res?.data || [];
    const sel = document.getElementById('trendSelect');
    // Giữ option đầu tiên (AI tự chọn)
    while (sel.options.length > 1) sel.remove(1);
    trends.forEach(t => sel.add(new Option(`🔥 ${t.title}`, t.id)));
  } catch {}
}

// ── Generate Content ───────────────────────────────────────
async function handleGenerate() {
  const btn = document.getElementById('generateBtn');
  const btnText = document.getElementById('generateBtnText');
  const resultsEl = document.getElementById('genResults');

  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span>AI đang tạo nội dung...';
  resultsEl.innerHTML = '<div class="results-empty"><span class="spinner" style="font-size:32px"></span><p>AI đang phân tích xu hướng và tạo nội dung...</p></div>';

  const trendId = document.getElementById('trendSelect').value || null;
  const lang = document.querySelector('input[name="genLang"]:checked')?.value || 'vi';
  const platforms = [...document.querySelectorAll('.chip.active')].map(c => c.dataset.platform);

  try {
    const data = await api('POST', '/content/generate', {
      userId: state.userId,
      trendId: trendId || undefined,
      outputCount: state.outputCount,
      language: lang,
      targetPlatforms: platforms.length ? platforms : undefined,
      generateImage: false,
    });

    if (!data || !data.items?.length) {
      resultsEl.innerHTML = '<div class="results-empty"><span class="empty-icon">⚠️</span><p>Không có kết quả. Thử lại sau.</p></div>';
      return;
    }

    let html = '';
    // Smart match banner
    if (data.smartMatchReason) {
      html += `<div class="smart-match-banner">
        <strong>✦ AI đã chọn:</strong> ${escHtml(data.selectedTrendTitle || '')}
        <br/><span style="color:var(--muted);font-size:12px;margin-top:4px;display:block">${escHtml(data.smartMatchReason)}</span>
      </div>`;
    }
    // Content cards
    data.items.forEach((item, i) => {
      html += renderContentCard(item, i);
    });
    resultsEl.innerHTML = html;
    showToast('Tạo nội dung thành công!', 'success');
    // Update quota
    loadDashboard();
  } catch (err) {
    resultsEl.innerHTML = `<div class="results-empty"><span class="empty-icon">⚠️</span><p>Lỗi: ${escHtml(err.message)}</p></div>`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = '✦ Tạo nội dung';
  }
}

function renderContentCard(item, idx) {
  const hashtags = (item.hashtags || []).map(h => `<span class="hashtag">#${h}</span>`).join('');
  const id = `card-${idx}-${Date.now()}`;
  return `
  <div class="result-card" id="${id}">
    <div class="result-card-header">
      <span class="result-platform-badge">📱 ${escHtml(item.platform || 'General')}</span>
      <div class="result-actions">
        <button class="result-action-btn" onclick="copyContent('${id}')">📋 Copy</button>
        <button class="result-action-btn" onclick="copyFullPost('${id}')">📄 Copy bài đầy đủ</button>
      </div>
    </div>
    <div class="result-body">
      <div>
        <div class="result-section-label">Hook</div>
        <div class="result-hook" data-hook="${idx}">${escHtml(item.hook || '')}</div>
      </div>
      <div>
        <div class="result-section-label">Nội dung</div>
        <div class="result-content" data-body="${idx}">${escHtml(item.body || '')}</div>
      </div>
      <div>
        <div class="result-section-label">Call to Action</div>
        <div class="result-cta">${escHtml(item.cta || '')}</div>
      </div>
      ${hashtags ? `<div><div class="result-section-label">Hashtags</div><div class="result-hashtags">${hashtags}</div></div>` : ''}
      <div class="result-meta">
        <div class="result-meta-item">⏰ <span>${escHtml(item.bestTimeToPost || '')}</span></div>
      </div>
    </div>
  </div>`;
}

function copyContent(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const hook = card.querySelector('[data-hook]')?.textContent || '';
  const body = card.querySelector('[data-body]')?.textContent || '';
  navigator.clipboard.writeText(`${hook}\n\n${body}`).then(() => showToast('Đã copy!', 'success'));
}

function copyFullPost(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const hook = card.querySelector('[data-hook]')?.textContent || '';
  const body = card.querySelector('[data-body]')?.textContent || '';
  const cta = card.querySelector('.result-cta')?.textContent || '';
  const tags = [...card.querySelectorAll('.hashtag')].map(h => h.textContent).join(' ');
  navigator.clipboard.writeText(`${hook}\n\n${body}\n\n${cta}\n\n${tags}`).then(() => showToast('Đã copy bài đầy đủ!', 'success'));
}

function changeCount(delta) {
  state.outputCount = Math.max(1, Math.min(3, state.outputCount + delta));
  document.getElementById('outputCount').textContent = state.outputCount;
}

function togglePlatform(btn) {
  btn.classList.toggle('active');
}

// ── Knowledge ──────────────────────────────────────────────
function switchKnowledgeTab(tab, btn) {
  document.querySelectorAll('.knowledge-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`kPanel-${tab}`).style.display = 'block';
  document.querySelectorAll('.knowledge-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function handleKnowledgeManual() {
  const title = document.getElementById('kManualTitle').value.trim();
  const content = document.getElementById('kManualContent').value.trim();
  const errEl = document.getElementById('kManualError');
  errEl.textContent = '';
  if (!title || !content) { errEl.textContent = 'Vui lòng nhập tiêu đề và nội dung.'; return; }
  try {
    await api('POST', '/knowledge/manual', { title, rawContent: content });
    showKnowledgeSuccess('Đã thêm vào Knowledge Base thành công!');
    document.getElementById('kManualTitle').value = '';
    document.getElementById('kManualContent').value = '';
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function handleKnowledgeScrape() {
  const url = document.getElementById('kScrapeUrl').value.trim();
  const errEl = document.getElementById('kScrapeError');
  errEl.textContent = '';
  if (!url) { errEl.textContent = 'Vui lòng nhập URL.'; return; }
  try {
    showToast('Đang crawl URL...');
    await api('POST', '/knowledge/scrape', { targetUrl: url });
    showKnowledgeSuccess('Đã crawl và thêm vào Knowledge Base!');
    document.getElementById('kScrapeUrl').value = '';
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) uploadFile(file);
}

function handleFileDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
}

async function uploadFile(file) {
  const errEl = document.getElementById('kFileError');
  errEl.textContent = '';
  const formData = new FormData();
  formData.append('file', file);
  try {
    showToast('Đang upload file...');
    await api('POST', '/knowledge/upload-file', formData, true);
    showKnowledgeSuccess(`File "${file.name}" đã được xử lý thành công!`);
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function showKnowledgeSuccess(msg) {
  const el = document.getElementById('kSuccess');
  el.textContent = '✅ ' + msg;
  el.style.display = 'block';
  showToast(msg, 'success');
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── History ────────────────────────────────────────────────
async function loadHistory(page) {
  state.historyPage = page;
  const el = document.getElementById('historyList');
  el.innerHTML = '<div class="loading-state"><span class="spinner"></span>Đang tải lịch sử...</div>';
  try {
    const data = await api('GET', `/content/history?userId=${state.userId}&page=${page}&pageSize=10`);
    const items = data?.items || data?.data || [];
    state.historyTotal = data?.total || 0;

    if (!items.length) {
      el.innerHTML = '<div class="loading-state">Chưa có nội dung nào. <a href="#" class="btn-text-link" onclick="showPage(\'generate\')">Tạo ngay →</a></div>';
      return;
    }

    el.innerHTML = items.map(h => renderHistoryCard(h)).join('');
    renderHistoryPagination(data?.total || 0, page);
  } catch (err) {
    el.innerHTML = `<div class="loading-state">Lỗi: ${escHtml(err.message)}</div>`;
  }
}

function renderHistoryCard(h) {
  let parsedItems = [];
  try { parsedItems = JSON.parse(h.generatedContent || h.userEditedContent || '[]'); } catch {}
  if (!Array.isArray(parsedItems)) parsedItems = [];

  const date = new Date(h.createdAt).toLocaleString('vi-VN');
  const editedBadge = h.isEdited ? '<span class="history-edited-badge">✏️ Đã chỉnh sửa</span>' : '';
  const itemsHtml = parsedItems.map((item, i) => `
    <div class="history-item">
      <div class="history-item-platform">📱 ${escHtml(item.platform || 'General')}</div>
      <div class="history-item-hook">${escHtml(item.hook || '')}</div>
      <div class="history-item-body">${escHtml((item.body || '').substring(0, 200))}${(item.body || '').length > 200 ? '...' : ''}</div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <button class="result-action-btn" onclick="copyHistoryItem('${h.id}', ${i})">📋 Copy</button>
        <button class="result-action-btn" onclick="editHistoryItem('${h.id}', ${i}, this)">✏️ Sửa</button>
      </div>
    </div>`).join('');

  return `
  <div class="history-card">
    <div class="history-card-header" onclick="toggleHistoryCard(this)">
      <div class="history-meta">
        <span class="history-date">🕐 ${date}</span>
        ${editedBadge}
      </div>
      <span style="color:var(--muted);font-size:18px">›</span>
    </div>
    <div class="history-body" data-id="${h.id}" data-content='${escAttr(h.generatedContent)}'>
      <div class="history-items">${itemsHtml || '<p class="muted-text">Không có dữ liệu</p>'}</div>
    </div>
  </div>`;
}

function toggleHistoryCard(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('open');
  header.querySelector('span:last-child').textContent = body.classList.contains('open') ? '⌄' : '›';
}

function copyHistoryItem(histId, itemIdx) {
  const body = document.querySelector(`.history-body[data-id="${histId}"]`);
  if (!body) return;
  try {
    const items = JSON.parse(body.dataset.content || '[]');
    const item = items[itemIdx];
    if (item) {
      navigator.clipboard.writeText(`${item.hook}\n\n${item.body}\n\n${item.cta}`).then(() => showToast('Đã copy!', 'success'));
    }
  } catch {}
}

function editHistoryItem(histId, itemIdx, btn) {
  const body = document.querySelector(`.history-body[data-id="${histId}"]`);
  if (!body) return;
  const item = body.querySelectorAll('.history-item')[itemIdx];
  if (!item) return;

  const existing = item.querySelector('.edit-area');
  if (existing) { existing.remove(); return; }

  const currentText = item.querySelector('.history-item-body')?.textContent || '';
  const area = document.createElement('textarea');
  area.className = 'edit-area';
  area.rows = 5;
  area.value = currentText;
  item.appendChild(area);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.style.marginTop = '8px';
  saveBtn.textContent = 'Lưu chỉnh sửa';
  saveBtn.onclick = async () => {
    try {
      await api('PUT', `/content/history/${histId}/edit`, { body: area.value });
      item.querySelector('.history-item-body').textContent = area.value;
      area.remove(); saveBtn.remove();
      showToast('Đã lưu chỉnh sửa!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  };
  item.appendChild(saveBtn);
}

function renderHistoryPagination(total, current) {
  const totalPages = Math.ceil(total / 10);
  if (totalPages <= 1) { document.getElementById('historyPagination').innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadHistory(${i})">${i}</button>`;
  }
  document.getElementById('historyPagination').innerHTML = html;
}

// ── Brand Alignment ────────────────────────────────────────
async function handleAlignment() {
  const draft = document.getElementById('draftContent').value.trim();
  const errEl = document.getElementById('alignmentError');
  const btn = document.getElementById('alignmentBtn');
  const btnText = document.getElementById('alignmentBtnText');
  const resultEl = document.getElementById('alignmentResult');
  errEl.textContent = '';

  if (!draft || draft.length < 10) { errEl.textContent = 'Nội dung nháp phải có ít nhất 10 ký tự.'; return; }

  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span>AI đang phân tích...';
  resultEl.innerHTML = '<div class="results-empty"><span class="spinner"></span><p>Đang phân tích brand alignment...</p></div>';

  try {
    const data = await api('POST', '/content/check-alignment', {
      userId: state.userId,
      draftContent: draft,
    });

    const score = data.brandScore || 0;
    const scoreColor = score >= 75 ? 'var(--trading-up)' : score >= 50 ? 'var(--primary)' : 'var(--trading-down)';
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score / 100) * circumference;

    resultEl.innerHTML = `
      <div class="score-card">
        <div class="score-ring">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle class="score-ring-bg" cx="50" cy="50" r="40"/>
            <circle class="score-ring-fill" cx="50" cy="50" r="40"
              stroke="${scoreColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="score-number" style="color:${scoreColor}">${score}</div>
        </div>
        <div class="score-label">Brand Alignment Score</div>
      </div>
      <div class="analysis-card">
        <div class="analysis-section">
          <div class="analysis-title">📊 Phân tích</div>
          <div class="analysis-text">${escHtml(data.analysis || '')}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-title">💡 Đề xuất cải thiện</div>
          <div class="analysis-text">${escHtml(data.suggestions || '')}</div>
        </div>
        <div class="analysis-section">
          <div class="analysis-title">✦ Bài viết đã được cải thiện</div>
          <div class="refined-content">${escHtml(data.refinedContent || '')}</div>
          <button class="result-action-btn" style="margin-top:8px" onclick="navigator.clipboard.writeText(${JSON.stringify(data.refinedContent || '')}).then(()=>showToast('Đã copy!','success'))">📋 Copy bài viết</button>
        </div>
      </div>`;
    showToast('Phân tích hoàn tất!', 'success');
  } catch (err) {
    resultEl.innerHTML = `<div class="results-empty"><span class="empty-icon">⚠️</span><p>Lỗi: ${escHtml(err.message)}</p></div>`;
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btnText.textContent = '✅ Phân tích Brand Alignment';
  }
}

// ── Modal ──────────────────────────────────────────────────
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// ── Helpers ────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────
(function init() {
  updateNavAuth();
  if (state.token) {
    if (!state.hasContext) {
      showPage('onboarding');
    } else {
      showPage('dashboard');
    }
  } else {
    showPage('login');
  }
})();
