/* ═══════════════════════════════════════════════════════════
   SOCIALSENSE — Frontend App
   ═══════════════════════════════════════════════════════════ */

const API = 'http://localhost:5280';

// ── STATE ──────────────────────────────────────────────────
let state = {
  token: localStorage.getItem('ss_token') || null,
  user:  JSON.parse(localStorage.getItem('ss_user') || 'null'),
  mode:  'TrendBased',
  platforms: ['Facebook'],
  outputCount: 1,
  trendsPage: 1,
  historyPage: 1,
  usersPage: 1,
};

// ── API HELPER ─────────────────────────────────────────────
async function api(method, path, body = null, isForm = false) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : null),
  });

  if (res.status === 401) { logout(); return null; }
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── PAGE ROUTER ────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (!page) return;
  page.classList.add('active');

  // Light canvas pages
  const lightPages = ['login', 'register', 'persona', 'alignment'];
  document.body.className = lightPages.includes(name) ? 'light-canvas' : 'dark-canvas';

  // Nav style
  document.getElementById('topNav').style.background =
    lightPages.includes(name) ? 'var(--canvas-light)' : 'var(--canvas-dark)';
  document.getElementById('topNav').style.borderBottomColor =
    lightPages.includes(name) ? 'var(--hairline-light)' : 'var(--hairline-dark)';

  // Page-specific init
  if (name === 'trends')    loadTrends();
  if (name === 'history')   loadHistory();
  if (name === 'generate')  initGeneratePage();
  if (name === 'admin')     initAdmin();
  if (name === 'persona')   loadPersona();

  window.scrollTo(0, 0);
}

function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ── AUTH ───────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
  document.getElementById('loginError').classList.add('hidden');

  const res = await api('POST', '/auth/login', {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value,
  });

  btn.disabled = false; btn.textContent = 'Đăng nhập';

  if (!res || !res.ok) {
    const err = document.getElementById('loginError');
    err.textContent = res?.data?.message || 'Email hoặc mật khẩu không đúng';
    err.classList.remove('hidden');
    return;
  }

  state.token = res.data.accessToken;
  state.user  = { email: res.data.email, displayName: res.data.displayName, hasContext: res.data.hasContext };
  localStorage.setItem('ss_token', state.token);
  localStorage.setItem('ss_user', JSON.stringify(state.user));

  updateNavAuth();
  toast('Đăng nhập thành công!', 'success');
  showPage(res.data.hasContext ? 'generate' : 'persona');
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  btn.disabled = true; btn.textContent = 'Đang tạo tài khoản...';
  document.getElementById('registerError').classList.add('hidden');
  document.getElementById('registerSuccess').classList.add('hidden');

  const res = await api('POST', '/auth/register', {
    displayName: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
  });

  btn.disabled = false; btn.textContent = 'Tạo tài khoản';

  if (!res || !res.ok) {
    const err = document.getElementById('registerError');
    err.textContent = res?.data?.message || 'Đăng ký thất bại';
    err.classList.remove('hidden');
    return;
  }

  document.getElementById('registerSuccess').textContent = 'Tạo tài khoản thành công! Đang chuyển đến đăng nhập...';
  document.getElementById('registerSuccess').classList.remove('hidden');
  setTimeout(() => showPage('login'), 1500);
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
  updateNavAuth();
  showPage('home');
  toast('Đã đăng xuất');
}

function updateNavAuth() {
  const isAuth = !!state.token;
  document.getElementById('navGuest').classList.toggle('hidden', isAuth);
  document.getElementById('navUser').classList.toggle('hidden', !isAuth);
  if (isAuth && state.user) {
    document.getElementById('navUserName').textContent = state.user.displayName || state.user.email;
  }
  // Show admin link if admin (check after login)
  checkAdminAccess();
}

async function checkAdminAccess() {
  if (!state.token) return;
  const res = await api('GET', '/admin/dashboard');
  if (res && res.ok) {
    document.querySelectorAll('.admin-link').forEach(el => el.classList.remove('hidden'));
  }
}

async function refreshQuota() {
  if (!state.token || !state.user) return;
  // Get quota from admin users endpoint or persona
  const res = await api('GET', '/context/persona');
  if (res && res.ok) {
    // quota shown via admin endpoint
  }
}

// ── GENERATE CONTENT ───────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  document.getElementById('modeTrendBtn').classList.toggle('active', mode === 'TrendBased');
  document.getElementById('modePersonaBtn').classList.toggle('active', mode === 'PersonaDriven');
  document.getElementById('modeHint').textContent = mode === 'TrendBased'
    ? 'AI chọn trend phù hợp nhất với persona của bạn'
    : 'AI đọc sâu persona, tự suy luận ngành nghề và áp dụng công thức tâm lý';
}

function togglePlatform(el, platform) {
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    if (!state.platforms.includes(platform)) state.platforms.push(platform);
  } else {
    state.platforms = state.platforms.filter(p => p !== platform);
  }
}

function setCount(n, el) {
  state.outputCount = n;
  document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

async function initGeneratePage() {
  // Load persona preview
  if (!state.token) return;
  const res = await api('GET', '/context/persona');
  if (res && res.ok) renderPersonaPreview(res.data);

  // Instruction char count
  const instr = document.getElementById('genInstruction');
  if (instr) {
    instr.addEventListener('input', () => {
      document.getElementById('instrCount').textContent = instr.value.length;
    });
  }
}

function renderPersonaPreview(p) {
  const el = document.getElementById('personaPreview');
  if (!p) return;
  el.innerHTML = `
    <div class="persona-preview-item"><strong>Chức danh:</strong> ${p.jobTitle || '—'}</div>
    <div class="persona-preview-item"><strong>Tone:</strong> ${p.toneOfVoice || '—'}</div>
    <div class="persona-preview-item"><strong>Nền tảng:</strong> ${(p.platformPreferences || []).join(', ') || '—'}</div>
    <div class="persona-preview-item"><strong>Đối tượng:</strong> ${(p.targetAudience || []).slice(0,2).join(', ') || '—'}</div>
  `;
}

async function generateContent() {
  if (!state.token) { showPage('login'); return; }
  if (state.platforms.length === 0) { toast('Chọn ít nhất 1 nền tảng', 'error'); return; }

  const btn = document.getElementById('generateBtn');
  const loading = document.getElementById('generateLoading');
  const results = document.getElementById('generateResults');
  const empty = document.getElementById('generateEmpty');

  btn.disabled = true; btn.textContent = '⏳ Đang tạo...';
  loading.classList.remove('hidden');
  results.innerHTML = '';
  empty.classList.add('hidden');

  const instruction = document.getElementById('genInstruction').value.trim();
  const body = {
    userId: state.user?.email || '',  // will be overridden by JWT claim
    outputCount: state.outputCount,
    language: document.getElementById('genLanguage').value,
    targetPlatforms: state.platforms,
    generateImage: false,
    mode: state.mode,
    userInstruction: instruction || null,
  };

  // Get userId from a profile call first
  const profileRes = await api('GET', '/context/persona');
  if (profileRes && profileRes.ok) {
    // userId comes from JWT — just pass any non-empty string, server uses JWT claim
  }

  // We need actual userId — get from admin or store at login
  if (!state.userId) {
    // Try to get from admin users or use email as fallback
    body.userId = state.user?.email || 'unknown';
  } else {
    body.userId = state.userId;
  }

  const res = await api('POST', '/content/generate', body);

  btn.disabled = false; btn.textContent = '⚡ Tạo nội dung ngay';
  loading.classList.add('hidden');

  if (!res || !res.ok) {
    const msg = res?.data?.message || res?.data?.errors?.request?.[0] || 'Tạo nội dung thất bại';
    toast(msg, 'error');
    empty.classList.remove('hidden');
    return;
  }

  renderGenerateResults(res.data);
}

function renderGenerateResults(data) {
  const container = document.getElementById('generateResults');
  const items = data.items || [];

  if (items.length === 0) {
    document.getElementById('generateEmpty').classList.remove('hidden');
    return;
  }

  let html = '';
  if (data.smartMatchReason) {
    html += `<div class="result-smart-match"><strong>🎯 Smart Match:</strong> ${escHtml(data.smartMatchReason)}</div>`;
  }

  items.forEach((item, i) => {
    const platformIcon = { Facebook:'📘', Instagram:'📸', TikTok:'🎵', Zalo:'💬', LinkedIn:'💼', Twitter:'🐦' }[item.platform] || '📱';
    html += `
    <div class="result-card">
      <div class="result-card-header">
        <span class="result-platform">${platformIcon} ${escHtml(item.platform)}</span>
        <div class="result-actions">
          <button class="btn-secondary-dark btn-sm" onclick="copyContent(${i})">📋 Copy</button>
          <button class="btn-secondary-dark btn-sm" onclick="editContent(${i})">✏️ Sửa</button>
        </div>
      </div>
      <div class="result-card-body" id="resultBody${i}">
        <div class="result-hook">${escHtml(item.hook)}</div>
        <div class="result-body">${escHtml(item.body)}</div>
        <div class="result-cta">👉 ${escHtml(item.cta)}</div>
        <div class="result-hashtags">${(item.hashtags||[]).map(h=>`<span class="hashtag">#${escHtml(h)}</span>`).join('')}</div>
        <div class="result-meta">
          <span class="result-meta-item"><strong>⏰</strong> ${escHtml(item.bestTimeToPost||'')}</span>
        </div>
      </div>
    </div>`;
  });

  // Store for copy/edit
  window._lastResults = items;
  container.innerHTML = html;
}

function copyContent(i) {
  const item = window._lastResults?.[i];
  if (!item) return;
  const text = `${item.hook}\n\n${item.body}\n\n${item.cta}\n\n${(item.hashtags||[]).map(h=>'#'+h).join(' ')}`;
  navigator.clipboard.writeText(text).then(() => toast('Đã copy!', 'success'));
}

function editContent(i) {
  const item = window._lastResults?.[i];
  if (!item) return;
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">✏️ Chỉnh sửa nội dung</h3>
    <div class="form-group">
      <label class="form-label">Hook</label>
      <input type="text" class="text-input" id="editHook" value="${escAttr(item.hook)}" />
    </div>
    <div class="form-group">
      <label class="form-label">Nội dung</label>
      <textarea class="text-input textarea edit-textarea" id="editBody">${escHtml(item.body)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">CTA</label>
      <input type="text" class="text-input" id="editCta" value="${escAttr(item.cta)}" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary-dark" onclick="closeModal()">Huỷ</button>
      <button class="btn-primary" onclick="copyEdited()">📋 Copy bản đã sửa</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function copyEdited() {
  const hook = document.getElementById('editHook').value;
  const body = document.getElementById('editBody').value;
  const cta  = document.getElementById('editCta').value;
  navigator.clipboard.writeText(`${hook}\n\n${body}\n\n${cta}`).then(() => {
    toast('Đã copy bản đã sửa!', 'success');
    closeModal();
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ── TRENDS ─────────────────────────────────────────────────
let allTrends = [];

async function loadTrends() {
  const grid = document.getElementById('trendsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const sort = document.getElementById('trendSort')?.value || 'hot';
  const res = await api('GET', `/trends?page=${state.trendsPage}&pageSize=12&sortBy=${sort}`);

  if (!res || !res.ok) { grid.innerHTML = '<p class="muted">Không thể tải xu hướng</p>'; return; }

  allTrends = res.data.items || res.data.data || res.data || [];
  renderTrends(allTrends);
  renderPagination('trendsPagination', res.data.page || 1, res.data.totalPages || 1, (p) => {
    state.trendsPage = p; loadTrends();
  });
}

function filterTrends() {
  const q = document.getElementById('trendSearch').value.toLowerCase();
  const filtered = allTrends.filter(t => t.title?.toLowerCase().includes(q) || t.summary?.toLowerCase().includes(q));
  renderTrends(filtered);
}

function renderTrends(trends) {
  const grid = document.getElementById('trendsGrid');
  if (!trends.length) { grid.innerHTML = '<p class="muted">Không có xu hướng nào</p>'; return; }

  grid.innerHTML = trends.map(t => `
    <div class="trend-card" onclick="generateFromTrend('${t.id}')">
      <div class="trend-card-header">
        <span class="trend-hot">🔥 Hot ${t.hotLevel || 0}</span>
        <span class="muted" style="font-size:11px">${formatDate(t.createdAt)}</span>
      </div>
      <div class="trend-title">${escHtml(t.title)}</div>
      <div class="trend-summary">${escHtml(t.summary || '')}</div>
      <div class="trend-footer">
        <button class="btn-primary btn-sm" onclick="event.stopPropagation();generateFromTrend('${t.id}')">⚡ Tạo content</button>
      </div>
    </div>
  `).join('');
}

function generateFromTrend(trendId) {
  if (!state.token) { showPage('login'); return; }
  // Pre-fill trendId and switch to generate page
  window._pendingTrendId = trendId;
  showPage('generate');
  toast('Đã chọn trend — nhấn Tạo nội dung để tiếp tục', 'info');
}

// ── HISTORY ────────────────────────────────────────────────
async function loadHistory() {
  if (!state.token) return;
  const list = document.getElementById('historyList');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  // Need userId — get from stored state
  const userId = state.userId || state.user?.email || '';
  const res = await api('GET', `/content/history?userId=${encodeURIComponent(userId)}&page=${state.historyPage}&pageSize=10`);

  if (!res || !res.ok) { list.innerHTML = '<p class="muted">Không thể tải lịch sử</p>'; return; }

  const items = res.data.items || res.data.data || [];
  if (!items.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p class="empty-text">Chưa có lịch sử nội dung</p></div>'; return; }

  list.innerHTML = items.map(h => {
    let contentItems = [];
    try { contentItems = JSON.parse(h.contentJson || '[]'); } catch {}
    const first = contentItems[0] || {};
    return `
    <div class="history-card">
      <div class="history-card-header">
        <span class="history-platform">${escHtml(first.platform || 'General')}</span>
        <span class="history-date">${formatDate(h.createdAt)}</span>
      </div>
      <div class="history-card-body">
        <div class="history-hook">${escHtml(first.hook || '—')}</div>
        <div class="history-body">${escHtml(first.body || '')}</div>
        <div style="margin-top:var(--sp-sm);display:flex;gap:var(--sp-xs)">
          <button class="btn-secondary-dark btn-sm" onclick="copyHistoryItem('${h.id}', ${JSON.stringify(contentItems).replace(/"/g,'&quot;')})">📋 Copy</button>
          <button class="btn-secondary-dark btn-sm" onclick="editHistoryItem('${h.id}', '${escAttr(first.body||'')}')">✏️ Sửa</button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination('historyPagination', res.data.page || 1, res.data.totalPages || 1, (p) => {
    state.historyPage = p; loadHistory();
  });
}

function copyHistoryItem(id, items) {
  const first = items[0] || {};
  const text = `${first.hook||''}\n\n${first.body||''}\n\n${first.cta||''}\n\n${(first.hashtags||[]).map(h=>'#'+h).join(' ')}`;
  navigator.clipboard.writeText(text).then(() => toast('Đã copy!', 'success'));
}

function editHistoryItem(id, currentBody) {
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">✏️ Chỉnh sửa nội dung</h3>
    <div class="form-group">
      <label class="form-label">Nội dung</label>
      <textarea class="text-input textarea edit-textarea" id="histEditBody">${escHtml(currentBody)}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary-dark" onclick="closeModal()">Huỷ</button>
      <button class="btn-primary" onclick="saveHistoryEdit('${id}')">💾 Lưu</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function saveHistoryEdit(id) {
  const body = document.getElementById('histEditBody').value;
  const res = await api('PUT', `/content/history/${id}/edit`, { body });
  if (res && res.ok) {
    toast('Đã lưu!', 'success');
    closeModal();
    loadHistory();
  } else {
    toast('Lưu thất bại', 'error');
  }
}

// ── KNOWLEDGE BASE ─────────────────────────────────────────
function switchKnowledgeTab(tab, el) {
  document.querySelectorAll('.knowledge-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`kb-${tab}`).classList.remove('hidden');
  el.classList.add('active');
}

async function ingestManual() {
  const title   = document.getElementById('kbManualTitle').value.trim();
  const content = document.getElementById('kbManualContent').value.trim();
  if (!title || !content) { toast('Nhập đầy đủ tiêu đề và nội dung', 'error'); return; }

  const res = await api('POST', '/knowledge/manual', { title, rawContent: content });
  const el = document.getElementById('kbManualResult');
  if (res && res.ok) {
    el.innerHTML = `<div class="alert-success">✅ Đã lưu: <strong>${escHtml(res.data.title)}</strong></div>`;
    document.getElementById('kbManualTitle').value = '';
    document.getElementById('kbManualContent').value = '';
  } else {
    el.innerHTML = `<div class="alert-error">❌ ${escHtml(res?.data?.message || 'Lỗi khi lưu')}</div>`;
  }
}

async function ingestScrape() {
  const url = document.getElementById('kbScrapeUrl').value.trim();
  if (!url) { toast('Nhập URL', 'error'); return; }

  const el = document.getElementById('kbScrapeResult');
  el.innerHTML = '<div class="loading-state" style="padding:var(--sp-md)"><div class="spinner"></div><span class="loading-text">Đang crawl...</span></div>';

  const res = await api('POST', '/knowledge/scrape', { url });
  if (res && res.ok) {
    el.innerHTML = `<div class="alert-success">✅ Đã crawl: <strong>${escHtml(res.data.title)}</strong></div>`;
    document.getElementById('kbScrapeUrl').value = '';
  } else {
    el.innerHTML = `<div class="alert-error">❌ ${escHtml(res?.data?.message || 'Không thể crawl URL này')}</div>`;
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
  const el = document.getElementById('kbUploadResult');
  el.innerHTML = '<div class="loading-state" style="padding:var(--sp-md)"><div class="spinner"></div><span class="loading-text">Đang upload...</span></div>';

  const form = new FormData();
  form.append('file', file);

  const res = await api('POST', '/knowledge/upload-file', form, true);
  if (res && res.ok) {
    el.innerHTML = `<div class="alert-success">✅ Đã upload: <strong>${escHtml(res.data.fileName)}</strong></div>`;
  } else {
    el.innerHTML = `<div class="alert-error">❌ ${escHtml(res?.data?.message || 'Upload thất bại')}</div>`;
  }
}

// ── PERSONA ────────────────────────────────────────────────
async function loadPersona() {
  if (!state.token) return;
  const res = await api('GET', '/context/persona');
  if (!res || !res.ok) return;
  const p = res.data;
  if (!p) return;

  document.getElementById('pJobTitle').value  = p.jobTitle || '';
  document.getElementById('pTone').value       = p.toneOfVoice || '';
  document.getElementById('pLanguage').value   = p.language || 'vi';
  document.getElementById('pPlatforms').value  = (p.platformPreferences || []).join(', ');
  document.getElementById('pAudience').value   = (p.targetAudience || []).join('\n');
  document.getElementById('pFormats').value    = (p.contentFormats || []).join('\n');
  document.getElementById('pNegatives').value  = (p.negativeConstraints || []).join('\n');
}

async function savePersona() {
  if (!state.token) { showPage('login'); return; }

  const splitLines = v => v.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);

  const body = {
    jobTitle:             document.getElementById('pJobTitle').value.trim() || null,
    toneOfVoice:          document.getElementById('pTone').value.trim() || null,
    language:             document.getElementById('pLanguage').value,
    platformPreferences:  splitLines(document.getElementById('pPlatforms').value),
    targetAudience:       splitLines(document.getElementById('pAudience').value),
    contentFormats:       splitLines(document.getElementById('pFormats').value),
    negativeConstraints:  splitLines(document.getElementById('pNegatives').value),
  };

  const res = await api('PUT', '/context/persona', body);
  const el = document.getElementById('personaSaveResult');
  if (res && res.ok) {
    el.innerHTML = '<div class="alert-success">✅ Đã lưu persona thành công!</div>';
    toast('Persona đã được cập nhật', 'success');
    if (state.user) { state.user.hasContext = true; localStorage.setItem('ss_user', JSON.stringify(state.user)); }
  } else {
    el.innerHTML = `<div class="alert-error">❌ ${escHtml(res?.data?.message || 'Lưu thất bại')}</div>`;
  }
}

// ── BRAND ALIGNMENT ────────────────────────────────────────
async function checkAlignment() {
  if (!state.token) { showPage('login'); return; }
  const draft = document.getElementById('alignDraft').value.trim();
  if (draft.length < 10) { toast('Nội dung phải ít nhất 10 ký tự', 'error'); return; }

  const resultEl = document.getElementById('alignResult');
  resultEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p class="loading-text">AI đang phân tích...</p></div>';
  resultEl.classList.remove('hidden');

  const userId = state.userId || state.user?.email || '';
  const res = await api('POST', '/content/check-alignment', { userId, draftContent: draft });

  if (!res || !res.ok) {
    resultEl.innerHTML = `<div class="alert-error">❌ ${escHtml(res?.data?.message || 'Phân tích thất bại')}</div>`;
    return;
  }

  const d = res.data;
  const scoreClass = d.brandScore >= 75 ? 'score-good' : d.brandScore >= 50 ? 'score-mid' : 'score-bad';
  resultEl.innerHTML = `
    <div class="score-display">
      <div class="score-number ${scoreClass}">${d.brandScore}</div>
      <div class="score-label">Brand Alignment Score / 100</div>
    </div>
    <div class="align-section">
      <div class="align-section-title">📊 Phân tích</div>
      <div class="align-section-body">${escHtml(d.analysis)}</div>
    </div>
    <div class="align-section">
      <div class="align-section-title">💡 Gợi ý cải thiện</div>
      <div class="align-section-body">${escHtml(d.suggestions)}</div>
    </div>
    <div class="align-section">
      <div class="align-section-title">✨ Bản đã tối ưu</div>
      <div class="refined-content">${escHtml(d.refinedContent)}</div>
      <button class="btn-primary btn-sm mt-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(d.refinedContent)}).then(()=>toast('Đã copy!','success'))">📋 Copy bản tối ưu</button>
    </div>
  `;
}

// ── ADMIN ──────────────────────────────────────────────────
function switchAdminTab(tab, el) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`admin-${tab}`).classList.add('active');
  el.classList.add('active');
  if (tab === 'users')   loadAdminUsers();
  if (tab === 'apikeys') loadApiKeys();
}

async function initAdmin() {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('admin-dashboard').classList.add('active');
  await loadDashboard();
}

async function loadDashboard() {
  const res = await api('GET', '/admin/dashboard');
  if (!res || !res.ok) return;
  const d = res.data;

  document.getElementById('dashboardStats').innerHTML = `
    <div class="stat-box"><div class="stat-box-value">${d.totalUsers}</div><div class="stat-box-label">Tổng users</div><div class="stat-box-sub stat-up">▲ ${d.activeUsers} active</div></div>
    <div class="stat-box"><div class="stat-box-value">${d.totalContentGenerated}</div><div class="stat-box-label">Nội dung đã tạo</div></div>
    <div class="stat-box"><div class="stat-box-value">${d.totalKnowledgeItems}</div><div class="stat-box-label">Knowledge items</div></div>
    <div class="stat-box"><div class="stat-box-value">${d.totalTrends}</div><div class="stat-box-label">Xu hướng</div></div>
    <div class="stat-box"><div class="stat-box-value">${d.activeApiKeys}</div><div class="stat-box-label">API Keys active</div><div class="stat-box-sub ${d.coolingDownApiKeys > 0 ? 'stat-down' : 'stat-up'}">${d.coolingDownApiKeys} cooling</div></div>
  `;

  // Activity chart
  const days = d.last7DaysContent || [];
  const maxContent = Math.max(...days.map(x => x.contentGenerated), 1);
  const maxUsers   = Math.max(...days.map(x => x.newUsers), 1);
  document.getElementById('activityChart').innerHTML = days.map(day => `
    <div class="chart-bar-group">
      <div class="chart-bar content" style="height:${Math.round(day.contentGenerated/maxContent*80)}px" title="Content: ${day.contentGenerated}"></div>
      <div class="chart-bar users"   style="height:${Math.round(day.newUsers/maxUsers*40)}px"   title="Users: ${day.newUsers}"></div>
      <div class="chart-label">${day.date?.slice(5)}</div>
    </div>
  `).join('') + `<div style="font-size:11px;color:var(--muted);align-self:flex-end;padding-bottom:20px">
    <span style="color:var(--primary)">■</span> Content &nbsp;
    <span style="color:var(--accent-turquoise)">■</span> Users
  </div>`;
}

async function loadAdminUsers() {
  const search = document.getElementById('userSearch')?.value || '';
  const res = await api('GET', `/admin/users?page=${state.usersPage}&pageSize=15&search=${encodeURIComponent(search)}`);
  if (!res || !res.ok) return;

  const { data, total, totalPages } = res.data;
  document.getElementById('usersTable').innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Email</th><th>Tên</th><th>Trạng thái</th><th>Quota</th><th>Roles</th><th>Content</th><th>Hành động</th>
      </tr></thead>
      <tbody>${data.map(u => `
        <tr>
          <td>${escHtml(u.email)}</td>
          <td>${escHtml(u.displayName||'')}</td>
          <td><span class="badge ${u.isActive?'badge-active':'badge-inactive'}">${u.isActive?'Active':'Inactive'}</span></td>
          <td><span style="font-family:var(--font-plex)">${u.remainingQuota}/${u.dailyQuotaLimit}</span></td>
          <td>${(u.roles||[]).map(r=>`<span class="badge badge-admin">${r}</span>`).join(' ')}</td>
          <td><span style="font-family:var(--font-plex)">${u.totalContentGenerated}</span></td>
          <td>
            <button class="btn-secondary-dark btn-sm" onclick="resetUserQuota('${u.id}')">Reset quota</button>
            ${u.isActive
              ? `<button class="btn-secondary-dark btn-sm" onclick="deactivateUser('${u.id}')">Vô hiệu</button>`
              : `<button class="btn-secondary-dark btn-sm" onclick="restoreUser('${u.id}')">Kích hoạt</button>`}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  renderPagination('usersPagination', res.data.page, totalPages, (p) => { state.usersPage = p; loadAdminUsers(); });
}

function searchUsers() { state.usersPage = 1; loadAdminUsers(); }

async function resetUserQuota(id) {
  const res = await api('POST', `/admin/users/${id}/reset-quota`);
  if (res && res.ok) { toast('Đã reset quota', 'success'); loadAdminUsers(); }
}
async function deactivateUser(id) {
  if (!confirm('Vô hiệu hóa user này?')) return;
  const res = await api('DELETE', `/admin/users/${id}`);
  if (res && res.ok) { toast('Đã vô hiệu hóa', 'success'); loadAdminUsers(); }
}
async function restoreUser(id) {
  const res = await api('POST', `/admin/users/${id}/restore`);
  if (res && res.ok) { toast('Đã kích hoạt lại', 'success'); loadAdminUsers(); }
}

async function loadApiKeys() {
  const res = await api('GET', '/admin/api-keys');
  if (!res || !res.ok) return;
  const keys = res.data;

  document.getElementById('apiKeysTable').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Label</th><th>Provider</th><th>Key (suffix)</th><th>Trạng thái</th><th>Cooldown</th><th>Hành động</th></tr></thead>
      <tbody>${keys.map(k => `
        <tr>
          <td>${escHtml(k.label)}</td>
          <td><span class="badge badge-admin">${escHtml(k.provider||'')}</span></td>
          <td><span style="font-family:var(--font-plex);color:var(--muted)">...${escHtml(k.keySuffix)}</span></td>
          <td><span class="badge ${k.isActive?'badge-active':'badge-inactive'}">${k.isActive?'Active':'Inactive'}</span></td>
          <td>${k.isInCooldown ? `<span class="stat-down">⏳ ${formatDate(k.cooldownExpiresAt)}</span>` : '<span class="stat-up">✅ OK</span>'}</td>
          <td>
            <button class="btn-secondary-dark btn-sm" onclick="deleteApiKey('${k.id}')">🗑 Xóa</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

async function reloadKeyPool() {
  const res = await api('POST', '/admin/api-keys/reload');
  if (res && res.ok) { toast(`Pool reloaded — ${res.data.activeKeys} keys active`, 'success'); loadApiKeys(); }
}

async function deleteApiKey(id) {
  if (!confirm('Xóa API key này?')) return;
  const res = await api('DELETE', `/admin/api-keys/${id}`);
  if (res && res.ok) { toast('Đã xóa key', 'success'); loadApiKeys(); }
}

function showAddKeyModal() {
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">🔑 Thêm API Key</h3>
    <div class="form-group">
      <label class="form-label">Label</label>
      <input type="text" class="text-input" id="newKeyLabel" placeholder="VD: OpenRouter-Key2" />
    </div>
    <div class="form-group">
      <label class="form-label">Key Value</label>
      <input type="text" class="text-input" id="newKeyValue" placeholder="sk-or-v1-..." />
    </div>
    <div class="form-group">
      <label class="form-label">Notes (tuỳ chọn)</label>
      <input type="text" class="text-input" id="newKeyNotes" placeholder="openrouter / groq / openai" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary-dark" onclick="closeModal()">Huỷ</button>
      <button class="btn-primary" onclick="addApiKey()">💾 Thêm</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function addApiKey() {
  const label = document.getElementById('newKeyLabel').value.trim();
  const keyValue = document.getElementById('newKeyValue').value.trim();
  const notes = document.getElementById('newKeyNotes').value.trim();
  if (!label || !keyValue) { toast('Nhập đầy đủ label và key', 'error'); return; }

  const res = await api('POST', '/admin/api-keys', { label, keyValue, notes });
  if (res && res.ok) {
    toast('Đã thêm API key', 'success');
    closeModal();
    loadApiKeys();
  } else {
    toast(res?.data?.message || 'Thêm key thất bại', 'error');
  }
}

function showCreateUserModal() {
  document.getElementById('modalContent').innerHTML = `
    <h3 class="modal-title">👤 Tạo User mới</h3>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="text-input" id="newUserEmail" placeholder="user@example.com" />
    </div>
    <div class="form-group">
      <label class="form-label">Tên hiển thị</label>
      <input type="text" class="text-input" id="newUserName" placeholder="Nguyễn Văn A" />
    </div>
    <div class="form-group">
      <label class="form-label">Mật khẩu</label>
      <input type="password" class="text-input" id="newUserPass" placeholder="••••••••" />
    </div>
    <div class="form-group">
      <label class="form-label">Daily Quota</label>
      <input type="number" class="text-input" id="newUserQuota" value="10" min="1" max="1000" />
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:var(--sp-sm)">
      <input type="checkbox" id="newUserAdmin" />
      <label class="form-label" style="margin:0">Cấp quyền Admin</label>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary-dark" onclick="closeModal()">Huỷ</button>
      <button class="btn-primary" onclick="createAdminUser()">💾 Tạo</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

async function createAdminUser() {
  const body = {
    email: document.getElementById('newUserEmail').value.trim(),
    displayName: document.getElementById('newUserName').value.trim(),
    password: document.getElementById('newUserPass').value,
    dailyQuotaLimit: parseInt(document.getElementById('newUserQuota').value) || 10,
    isAdmin: document.getElementById('newUserAdmin').checked,
  };
  if (!body.email || !body.password) { toast('Nhập đầy đủ email và mật khẩu', 'error'); return; }

  const res = await api('POST', '/admin/users', body);
  if (res && res.ok) {
    toast('Đã tạo user', 'success');
    closeModal();
    loadAdminUsers();
  } else {
    toast(res?.data?.message || 'Tạo user thất bại', 'error');
  }
}

// ── PAGINATION ─────────────────────────────────────────────
function renderPagination(containerId, current, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if(el) el.innerHTML=''; return; }

  let html = '';
  if (current > 1) html += `<button class="page-btn" onclick="(${onPage})(${current-1})">‹</button>`;
  for (let i = Math.max(1, current-2); i <= Math.min(total, current+2); i++) {
    html += `<button class="page-btn ${i===current?'active':''}" onclick="(${onPage})(${i})">${i}</button>`;
  }
  if (current < total) html += `<button class="page-btn" onclick="(${onPage})(${current+1})">›</button>`;
  el.innerHTML = html;
}

// ── UTILS ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return iso; }
}

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  showPage('home');

  // Resolve userId after login by checking admin endpoint
  if (state.token) {
    api('GET', '/admin/users?pageSize=1').then(res => {
      if (res && res.ok) {
        document.querySelectorAll('.admin-link').forEach(el => el.classList.remove('hidden'));
      }
    });
    // Get actual userId from persona endpoint (JWT resolves it server-side)
    // For content/generate we pass userId from JWT — server uses claim
    // Store a placeholder that will be overridden by JWT
    state.userId = state.user?.email || '';
  }
});

// Handle nav link active state
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(l => l.style.color = '');
    link.style.color = 'var(--primary)';
    document.getElementById('navLinks').classList.remove('open');
  });
});
