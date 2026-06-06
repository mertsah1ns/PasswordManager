/* ——— Yardımcılar (VaultUtils) ——— */
const U = window.VaultUtils || {};
const notify = (msg) => U.notify?.(msg);
const copyText = (text, clearAfterSeconds = 0) => {
  if (window.vault?.copyToClipboard) window.vault.copyToClipboard(text, clearAfterSeconds);
  else navigator.clipboard?.writeText(text);
  notify(clearAfterSeconds > 0 ? `Panoya kopyalandı (${clearAfterSeconds}s sonra temizlenecek)` : 'Panoya kopyalandı');
};
const strengthFromPw = (pw) => U.strengthFromPw?.(pw) ?? { score: 0, level: 'weak', pct: 0 };
const formatDate = (str) => U.formatDate?.(str) ?? '—';
const extractDomain = (url) => U.extractDomain?.(url) ?? '';
const getFaviconUrl = (url) => U.getFaviconUrl?.(url) ?? null;
const escapeHtml = (str) => U.escapeHtml?.(str) ?? String(str ?? '');
const addAuditLog = (action, details = '') => {
  if (state.unlocked && window.vault?.addLog) {
    window.vault.addLog(action, details).catch(() => {});
  }
};

/* ——— Uygulama durumu ——— */
let state = {
  entries: [],
  selectedId: null,
  route: 'home',
  isEditing: false,
  selectedCategory: '',
  cards: [],
  selectedCardId: null,
  isEditingCard: false,
  notes: [],
  selectedNoteId: null,
  isEditingNote: false,
  notesSearch: '',
  payments: [],
  selectedPaymentId: null,
  isEditingPayment: false,
  unlocked: false,
  autoLockMinutes: parseInt(localStorage.getItem('vault_autoLockMinutes') || '5', 10) || 5,
  inactivityTimer: null,
  sortBy: 'name',
  sortDir: 'asc',
  sort: localStorage.getItem('vault_sort') || 'name-asc',
  selectedTag: '',
  attachments: [],
  breachResults: null,
  breachScanned: false
};

/* ——— Kasa girişi ———
 * Tek API: showLockUI(mode) | hideLockUI()
 * mode: 'setup' | 'unlock'
 */
function showLockUI(mode) {
  const winChrome = document.getElementById('winChrome');
  const lockScreen = document.getElementById('lockScreen');
  const lockSetup = document.getElementById('lockSetup');
  const lockUnlock = document.getElementById('lockUnlock');
  const lock2fa = document.getElementById('lock2fa');

  winChrome?.classList.add('is-locked');
  lockScreen?.classList.remove('is-hidden');
  lockSetup?.classList.toggle('is-active', mode === 'setup');
  lockUnlock?.classList.toggle('is-active', mode === 'unlock');
  lock2fa?.classList.toggle('is-active', mode === '2fa');
}

function hideLockUI() {
  document.getElementById('winChrome')?.classList.remove('is-locked');
  document.getElementById('lockScreen')?.classList.add('is-hidden');
  document.getElementById('appLayout')?.classList.add('is-visible');
}

async function triggerBiometricUnlock() {
  try {
    const res = await window.auth.unlockBiometric();
    if (res?.ok) {
      if (res.requires2fa) {
        showLockUI('2fa');
        document.getElementById('lock2faCode')?.focus();
      } else {
        unlockVault();
      }
    } else if (res && !res.canceled) {
      notify('Biyometrik doğrulama hatası: ' + (res.error || 'Bilinmiyor'));
    }
  } catch (e) {
    console.error(e);
  }
}

async function checkAuthState() {
  const lockScreen = document.getElementById('lockScreen');
  if (!lockScreen) return;

  let hasMaster = false;
  try {
    hasMaster = await window.auth?.hasMasterPassword?.() ?? false;
  } catch (e) {
    console.error('checkAuthState:', e);
  }

  showLockUI(hasMaster ? 'unlock' : 'setup');

  if (hasMaster) {
    const bioEnabled = await window.auth?.getBioStatus?.() ?? false;
    const bioBtn = document.getElementById('lockBioBtn');
    if (bioEnabled) {
      if (bioBtn) bioBtn.style.display = 'block';
      setTimeout(() => {
        triggerBiometricUnlock();
      }, 300);
    } else {
      if (bioBtn) bioBtn.style.display = 'none';
    }
  }
}

function resetInactivityTimer() {
  if (!state.unlocked || state.autoLockMinutes <= 0) return;
  if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(() => {
    state.inactivityTimer = null;
    lockVault();
  }, state.autoLockMinutes * 60 * 1000);
}

function unlockVault() {
  state.unlocked = true;
  hideLockUI();
  clearLockForm();
  addAuditLog('Kasa açıldı', 'Uygulama başarıyla açıldı');
  loadEntries();
  setRoute('home');
  resetInactivityTimer();
  window.app?.checkPaymentReminders?.();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function lockVault() {
  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = null;
  }
  addAuditLog('Kasa kilitlendi', 'Oturum kapatıldı');
  window.auth?.lock?.();
  state.unlocked = false;
  state.selectedId = null;
  state.selectedCardId = null;
  state.selectedNoteId = null;
  state.selectedPaymentId = null;
  closeDrawer();
  closeCardDrawer();
  closePaymentDrawer();
  closeNoteDrawer();
  showLockUI('unlock');
  clearLockForm();
  document.getElementById('lockUnlockPw')?.focus();
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Re-evaluate Windows Hello status on locking to show/prompt
  checkAuthState();
}

function clearLockForm() {
  const setupPw = document.getElementById('lockSetupPw');
  const setupConfirm = document.getElementById('lockSetupConfirm');
  const unlockPw = document.getElementById('lockUnlockPw');
  const setupErr = document.getElementById('lockSetupError');
  const unlockErr = document.getElementById('lockUnlockError');
  const code2fa = document.getElementById('lock2faCode');
  const err2fa = document.getElementById('lock2faError');
  if (setupPw) setupPw.value = '';
  if (setupConfirm) setupConfirm.value = '';
  if (unlockPw) unlockPw.value = '';
  if (setupErr) setupErr.textContent = '';
  if (unlockErr) unlockErr.textContent = '';
  if (code2fa) code2fa.value = '';
  if (err2fa) err2fa.textContent = '';
}

/* ——— Veri yükle ——— */
async function loadEntries() {
  if (!state.unlocked) return;
  try {
    state.entries = (await window.vault?.getEntries()) || [];
  } catch (e) {
    console.error('loadEntries:', e);
    state.entries = [];
  }
  renderGrid(state.entries, '', state.selectedCategory);
  updateHomeStats();
  if (state.selectedId && !state.entries.find(e => e.id === state.selectedId)) {
    state.selectedId = null;
    closeDrawer();
  } else if (state.selectedId) {
    openDrawer();
  }
  showDetail();
}

function updateHomeStats() {
  const total = state.entries.length;
  const strong = state.entries.filter(e => (e.strength || '') === 'strong').length;
  const weak = state.entries.filter(e => (e.strength || '') === 'weak').length;
  document.getElementById('entryCount').textContent = total;
  document.getElementById('statStrong').textContent = strong;
  document.getElementById('statWeak').textContent = weak;
  const list = document.getElementById('sidebarList');
  const empty = document.getElementById('homeEmpty');
  if (total === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'block';
    empty.style.display = 'none';
  }
  updateSecurityAlerts();
}

function updateSecurityAlerts() {
  const el = document.getElementById('securityAlerts');
  if (!el) return;
  const weak = state.entries.filter(e => strengthFromPw(e.password).level === 'weak');
  const pwCount = {};
  state.entries.forEach(e => {
    const p = e.password || '';
    if (p) pwCount[p] = (pwCount[p] || 0) + 1;
  });
  const dupes = Object.entries(pwCount).filter(([, c]) => c > 1).length;
  const dupEntries = state.entries.filter(e => e.password && pwCount[e.password] > 1);
  const alerts = [];
  if (weak.length > 0) alerts.push(`⚠️ ${weak.length} zayıf parola`);
  if (dupes > 0) alerts.push(`⚠️ ${dupEntries.length} giriş tekrar eden parola kullanıyor`);
  if (alerts.length === 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = alerts.join(' • ') + ' — Güvenliği artırmak için güncelleyin.';
}

function renderGrid(entries, search = '', category = '') {
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = state.sort || 'name-asc';
  const list = document.getElementById('sidebarList');
  list.innerHTML = '';
  const q = search.toLowerCase().trim();
  let filtered = entries;
  if (q) {
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.username || '').toLowerCase().includes(q) ||
      (e.url || '').toLowerCase().includes(q)
    );
  }
  if (category) {
    if (category === '_fav') filtered = filtered.filter(e => e.favorite);
    else filtered = filtered.filter(e => (e.category || 'diğer') === category);
  }
  if (state.selectedTag) {
    filtered = filtered.filter(e => (e.tags || []).some(t => (t || '').toLowerCase() === state.selectedTag.toLowerCase()));
  }

  const [sortBy, sortDir] = (state.sort || 'name-asc').split('-');
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
    else if (sortBy === 'date') cmp = (a.updatedAt || '').localeCompare(b.updatedAt || '');
    else if (sortBy === 'category') cmp = (a.category || 'diğer').localeCompare(b.category || 'diğer');
    return sortDir === 'desc' ? -cmp : cmp;
  });
  filtered.forEach(entry => {
    const st = strengthFromPw(entry.password);
    const row = document.createElement('div');
    row.className = 'entry-row' + (entry.id === state.selectedId ? ' active' : '');
    row.dataset.id = entry.id;
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    const cat = entry.category || 'diğer';
    const sub = entry.username || extractDomain(entry.url) || '';
    const strengthLabels = { strong: 'Güçlü', medium: 'Orta', weak: 'Zayıf' };
    const strLabel = strengthLabels[st.level] || '—';
    const favStar = entry.favorite ? '<span class="entry-fav-star">★</span>' : '';
    const faviconUrl = getFaviconUrl(entry.url);
    const icoHtml = faviconUrl
      ? `<img src="${escapeHtml(faviconUrl)}" alt="" class="entry-row-favicon" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span class="entry-row-ico-fb" style="display:none">🔐</span>`
      : '🔐';
    row.innerHTML = `
      <div class="entry-row-ico">${icoHtml}</div>
      <div class="entry-row-info">
        <div class="entry-row-name">${favStar}${escapeHtml(entry.name)}</div>
        <div class="entry-row-meta">
          ${sub ? `<span class="entry-row-sub">${escapeHtml(sub)}</span>` : ''}
          <span class="entry-row-cat">${escapeHtml(cat)}</span>
        </div>
      </div>
      <div class="entry-row-strength" title="Şifre gücü: ${strLabel}">
        <span class="entry-row-str-badge ${st.level}">${strLabel}</span>
      </div>
      <div class="entry-row-chevron"><i data-lucide="chevron-right"></i></div>
    `;
    row.addEventListener('click', () => selectEntry(entry.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectEntry(entry.id); }
    });
    list.appendChild(row);
  });

  updateHomeStats();
  updateTagFilter();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateTagFilter() {
  const tagFilter = document.getElementById('tagFilter');
  const tagSelect = document.getElementById('tagSelect');
  if (!tagFilter || !tagSelect) return;
  const allTags = [...new Set(state.entries.flatMap(e => (e.tags || []).filter(Boolean)))].sort();
  if (allTags.length === 0) {
    tagFilter.style.display = 'none';
    return;
  }
  tagFilter.style.display = 'flex';
  const prevVal = tagSelect.value;
  tagSelect.innerHTML = '<option value="">Tüm etiketler</option>' + allTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (allTags.includes(prevVal)) tagSelect.value = prevVal;
  else tagSelect.value = state.selectedTag || '';
}

function renderCustomFieldsEdit(fields) {
  const container = document.getElementById('customFieldsEditList');
  if (!container) return;
  container.innerHTML = (fields || []).map((f, i) => `
    <div class="custom-field-edit-row" data-idx="${i}">
      <input type="text" class="custom-field-key" placeholder="Alan adı" value="${escapeHtml(f.key || '')}">
      <input type="${f.type === 'password' ? 'password' : 'text'}" class="custom-field-value" placeholder="Değer" value="${escapeHtml(f.value || '')}">
      <label class="custom-field-type"><input type="checkbox" ${f.type === 'password' ? 'checked' : ''}> Gizli</label>
      <button type="button" class="field-action custom-field-remove" title="Kaldır"><i data-lucide="x"></i></button>
    </div>
  `).join('');
  container.querySelectorAll('.custom-field-remove').forEach(btn => {
    btn.addEventListener('click', () => { btn.closest('.custom-field-edit-row')?.remove(); });
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function collectCustomFieldsFromEdit() {
  const container = document.getElementById('customFieldsEditList');
  if (!container) return [];
  return [...container.querySelectorAll('.custom-field-edit-row')].map(row => {
    const key = (row.querySelector('.custom-field-key')?.value || '').trim();
    const value = (row.querySelector('.custom-field-value')?.value || '').trim();
    const isPassword = row.querySelector('.custom-field-type input')?.checked;
    if (!key && !value) return null;
    return { key: key || 'Alan', value, type: isPassword ? 'password' : 'text' };
  }).filter(Boolean);
}

function openDrawer() {
  document.getElementById('detailDrawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('detailDrawer').classList.remove('open');
}

function selectEntry(id) {
  state.selectedId = id;
  state.isEditing = false;
  document.querySelectorAll('.entry-row').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
  openDrawer();
  showDetail();
}

/* ——— Detay göster ——— */
function showDetail() {
  const detailView = document.getElementById('detailView');
  const detailEdit = document.getElementById('detailEdit');
  if (!detailView || !detailEdit) return;

  if (state.isEditing) {
    detailView.style.display = 'none';
    detailEdit.style.display = 'flex';
    return;
  }

  detailEdit.style.display = 'none';
  const entry = state.selectedId ? state.entries.find(e => e.id === state.selectedId) : null;

  if (!entry) {
    detailView.style.display = 'none';
    closeDrawer();
    return;
  }

  detailView.style.display = 'flex';

  const st = strengthFromPw(entry.password);
  const detailIco = document.getElementById('detailIcon');
  const faviconUrl = getFaviconUrl(entry.url);
  if (faviconUrl) {
    detailIco.innerHTML = `<img src="${escapeHtml(faviconUrl)}" alt="" class="detail-favicon" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:none">🔐</span>`;
  } else {
    detailIco.textContent = '🔐';
  }
  document.getElementById('detailName').textContent = entry.name;
  document.getElementById('detailUrl').textContent = extractDomain(entry.url) || '—';
  document.getElementById('detailUrl').onclick = () => entry.url && copyText(entry.url);

  document.getElementById('inputUsername').value = entry.username || '';
  document.getElementById('inputUsername').dataset.copyTarget = '1';
  document.getElementById('inputPassword').value = entry.password || '';
  document.getElementById('inputPassword').type = 'password';
  document.getElementById('inputUrl').value = entry.url || '';
  document.getElementById('inputNotes').value = entry.notes || '';

  document.getElementById('pwToggle').textContent = '👁';
  document.getElementById('strengthFill').style.width = st.pct + '%';
  document.getElementById('statScore').innerHTML = st.score + '<span style="font-size:12px;color:#4a5168">/100</span>';
  document.getElementById('statBar').style.width = st.score + '%';
  document.getElementById('statBar').style.background = st.pct >= 70 ? 'linear-gradient(90deg,#30D5C8,#4dd9cf)' : st.pct >= 40 ? 'linear-gradient(90deg,#f0a500,#f0a500)' : 'linear-gradient(90deg,#e74c3c,#e74c3c)';
  document.getElementById('statLength').innerHTML = (entry.password || '').length + ' <span style="font-size:12px;color:#4a5168">char</span>';
  const strEl = document.getElementById('statStrength');
  strEl.textContent = '● ' + (st.level === 'strong' ? 'Güçlü' : st.level === 'medium' ? 'Orta' : 'Zayıf');
  strEl.style.color = st.level === 'strong' ? '#2ecc8a' : st.level === 'medium' ? '#f0a500' : '#e74c3c';
  
  const pwToCheck = entry.password || '';
  if (pwToCheck) {
    strEl.innerHTML += ' <span style="color:var(--k-text3);font-size:11px;margin-left:4px;">(Sızıntı: Taranıyor...)</span>';
    window.encryption?.checkPasswordBreach?.(pwToCheck).then((res) => {
      if (state.selectedId !== entry.id) return;
      if (res?.ok) {
        if (res.count > 0) {
          strEl.innerHTML = `● ${st.level === 'strong' ? 'Güçlü' : st.level === 'medium' ? 'Orta' : 'Zayıf'} <span style="color:var(--k-danger);font-weight:600;margin-left:4px;">⚠️ Sızdırılmış (${res.count} kez!)</span>`;
          strEl.style.color = 'var(--k-danger)';
        } else {
          strEl.innerHTML = `● ${st.level === 'strong' ? 'Güçlü' : st.level === 'medium' ? 'Orta' : 'Zayıf'} <span style="color:var(--k-success);font-weight:600;margin-left:4px;">✓ Sızıntı Yok</span>`;
        }
      } else {
        strEl.innerHTML = `● ${st.level === 'strong' ? 'Güçlü' : st.level === 'medium' ? 'Orta' : 'Zayıf'} <span style="color:var(--k-text3);font-size:11px;margin-left:4px;">(Sızıntı kontrolü yapılamadı)</span>`;
      }
    }).catch(() => {});
  }
  document.getElementById('statUpdated').textContent = formatDate(entry.updatedAt);

  const btnFav = document.getElementById('btnToggleFav');
  const btnFavIcon = document.getElementById('btnToggleFavIcon');
  if (btnFav && btnFavIcon) {
    btnFav.style.display = 'inline-flex';
    btnFav.classList.toggle('is-favorite', !!entry.favorite);
    btnFav.title = entry.favorite ? 'Favorilerden kaldır' : 'Favorilere ekle';
  }
  const tagList = document.getElementById('tagList');
  tagList.innerHTML = '';
  (entry.tags || []).forEach(t => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.textContent = t.trim();
    tagList.appendChild(pill);
  });

  const customFieldsBlock = document.getElementById('customFieldsBlock');
  const customFieldsList = document.getElementById('customFieldsList');
  if (customFieldsBlock && customFieldsList) {
    const fields = (entry.customFields || []).filter(f => f && (f.key || f.value));
    if (fields.length === 0) {
      customFieldsBlock.style.display = 'none';
    } else {
      customFieldsBlock.style.display = 'block';
      customFieldsList.innerHTML = fields.map(f => `
        <div class="field custom-field-row">
          <div class="field-label">${escapeHtml(f.key || 'Alan')}</div>
          <div class="field-box">
            <input type="${f.type === 'password' ? 'password' : 'text'}" readonly value="${escapeHtml(f.value || '')}">
            <span class="field-action" data-copy-custom title="Kopyala"><i data-lucide="copy" class="icon-sm"></i></span>
          </div>
        </div>
      `).join('');
      customFieldsList.querySelectorAll('.field-action[data-copy-custom]').forEach(el => {
        const input = el.closest('.field-box')?.querySelector('input');
        if (input) el.addEventListener('click', () => copyText(input.value));
      });
    }
  }

  const btnOpenUrl = document.getElementById('btnOpenUrl');
  if (btnOpenUrl) btnOpenUrl.style.display = entry.url?.trim() ? 'inline-flex' : 'none';

  document.getElementById('totpBlock').style.display = entry.totpSecret ? 'flex' : 'none';
  if (entry.totpSecret) startTotpDisplay(entry.id);
}

/* ——— TOTP (2FA) gerçek kod üretimi ——— */
let totpInterval;
async function startTotpDisplay(entryId) {
  if (totpInterval) clearInterval(totpInterval);
  const arc = document.getElementById('totpArc');
  const numEl = document.getElementById('totpNum');
  const secEl = document.getElementById('totpSec');
  const circumference = 69.1;
  async function tick() {
    const result = await window.vault?.getTotpCode?.(entryId);
    if (!result) return;
    const { code, remaining } = result;
    if (arc) arc.style.strokeDashoffset = circumference * (1 - remaining / 30);
    if (secEl) secEl.textContent = remaining + 's';
    if (numEl) numEl.textContent = code ? code.replace(/(\d{3})(\d{3})/, '$1 $2') : '—— ——';
  }
  await tick();
  totpInterval = setInterval(tick, 1000);
}

/* ——— Düzenle / Kaydet / Sil ——— */
function startEdit(newEntry = false) {
  state.isEditing = true;
  const entry = newEntry ? null : state.entries.find(e => e.id === state.selectedId);
  document.getElementById('editName').value = entry?.name || '';
  document.getElementById('editUrl').value = entry?.url || '';
  document.getElementById('editUsername').value = entry?.username || '';
  document.getElementById('editPassword').value = entry?.password || '';
  document.getElementById('editTotpSecret').value = entry?.totpSecret || '';
  document.getElementById('editNotes').value = entry?.notes || '';
  document.getElementById('editTags').value = (entry?.tags || []).join(', ');
  renderCustomFieldsEdit((entry?.customFields || []).filter(f => f && (f.key || f.value)) || []);
  const editCat = document.getElementById('editCategory');
  if (editCat) editCat.value = entry?.category || '';
  document.getElementById('detailEdit').dataset.entryId = entry?.id || '';
  openDrawer();
  showDetail();
}

async function saveEntry() {
  const editName = document.getElementById('editName');
  const editTags = document.getElementById('editTags');
  const detailEdit = document.getElementById('detailEdit');
  const editUrl = document.getElementById('editUrl');
  const editUsername = document.getElementById('editUsername');
  const editPassword = document.getElementById('editPassword');
  const editNotes = document.getElementById('editNotes');
  if (!editName || !detailEdit) return;
  const name = editName.value.trim();
  if (!name) { notify('Başlık gerekli'); return; }
  const tags = (editTags?.value || '').split(',').map(t => t.trim()).filter(Boolean);
  const pw = editPassword?.value || '';
  const editCategory = document.getElementById('editCategory');
  const category = (editCategory?.value || '').trim() || 'diğer';
  const totpSecret = (document.getElementById('editTotpSecret')?.value || '').trim().replace(/\s/g, '') || null;
  const customFields = collectCustomFieldsFromEdit();
  const entry = {
    id: detailEdit.dataset.entryId || null,
    name,
    url: (editUrl?.value || '').trim(),
    username: (editUsername?.value || '').trim(),
    password: pw,
    notes: (editNotes?.value || '').trim(),
    icon: '🔐',
    tags,
    category,
    totpSecret,
    customFields,
    strength: strengthFromPw(pw).level
  };
  if (!window.vault?.saveEntry) { notify('Kaydetme başarısız'); return; }
  try {
    const saved = await window.vault.saveEntry(entry);
    const isNew = !detailEdit.dataset.entryId;
    addAuditLog(isNew ? 'Parola eklendi' : 'Parola güncellendi', name);
  state.isEditing = false;
  await loadEntries();
  state.selectedId = saved.id;
  document.querySelectorAll('.entry-row').forEach(c => c.classList.toggle('active', c.dataset.id === saved.id));
  openDrawer();
  showDetail();
  notify('Kaydedildi');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('saveEntry:', e);
    notify('Kaydetme hatası');
  }
}

function cancelEdit() {
  state.isEditing = false;
  if (!state.selectedId) closeDrawer();
  showDetail();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function deleteEntry() {
  if (!state.selectedId) return;
  if (!confirm('Bu parolayı silmek istediğinize emin misiniz?')) return;
  const entry = state.entries.find(e => e.id === state.selectedId);
  await window.vault.deleteEntry(state.selectedId);
  addAuditLog('Parola silindi', entry?.name || state.selectedId);
  state.selectedId = null;
  closeDrawer();
  await loadEntries();
  notify('Silindi');
}

/* ——— Şifre üretici ——— */
const CHARS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

function generatePasswordForEdit() {
  const len = 16;
  const pool = CHARS.upper + CHARS.lower + CHARS.numbers + CHARS.symbols;
  let pw = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) pw += pool[arr[i] % pool.length];
  return pw;
}

function generatePassword() {
  const lenEl = document.getElementById('genLength');
  const len = Math.min(64, Math.max(8, parseInt(lenEl?.value) || 16));
  const upper = document.getElementById('genUpper')?.checked ?? true;
  const lower = document.getElementById('genLower')?.checked ?? true;
  const numbers = document.getElementById('genNumbers')?.checked ?? true;
  const symbols = document.getElementById('genSymbols')?.checked ?? true;
  let pool = '';
  if (upper) pool += CHARS.upper;
  if (lower) pool += CHARS.lower;
  if (numbers) pool += CHARS.numbers;
  if (symbols) pool += CHARS.symbols;
  if (!pool) pool = CHARS.lower + CHARS.numbers;
  let pw = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) pw += pool[arr[i] % pool.length];
  const out = document.getElementById('genOutput');
  if (out) { out.value = pw; out.type = 'password'; }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ——— Rota değişimi ——— */
function setRoute(route) {
  state.route = route;
  document.querySelectorAll('.nav-item').forEach(r => r.classList.toggle('active', r.dataset.route === route));

  const home = route === 'home';
  const showCards = route === 'cards';
  const showPayments = route === 'payments';
  const showNotes = route === 'notes';
  const showFiles = route === 'files';
  const showSettings = route === 'settings';
  const showReport = route === 'report';
  document.getElementById('sidebarHome').style.display = home ? 'flex' : 'none';
  document.getElementById('panelCards').style.display = showCards ? 'flex' : 'none';
  document.getElementById('panelPayments').style.display = showPayments ? 'flex' : 'none';
  document.getElementById('panelNotes').style.display = showNotes ? 'flex' : 'none';
  document.getElementById('panelFiles').style.display = showFiles ? 'flex' : 'none';
  document.getElementById('panelReport').style.display = showReport ? 'flex' : 'none';
  document.getElementById('panelSettings').style.display = showSettings ? 'flex' : 'none';
  document.querySelector('.main-content').style.display = 'none';
  document.getElementById('panelGenerator').style.display = 'none';
  if (!home) closeDrawer();
  if (!showCards) closeCardDrawer();
  if (!showPayments) closePaymentDrawer();
  if (!showNotes) closeNoteDrawer();
  if (showCards) loadCards();
  if (showPayments) loadPayments();
  if (showNotes) loadNotes();
  if (showFiles) loadFiles();
  if (showReport) loadReport();
  if (showPayments) window.app?.checkPaymentReminders?.();
  if (showSettings) {
    loadSettingsInfo();
    updateBioButtonState();
    update2FAButtonState();
  }
}

function loadReport() {
  const weak = state.entries.filter(e => strengthFromPw(e.password).level === 'weak');
  const pwCount = {};
  state.entries.forEach(e => { const p = e.password || ''; if (p) pwCount[p] = (pwCount[p] || 0) + 1; });
  const dupes = state.entries.filter(e => e.password && pwCount[e.password] > 1);
  const now = Date.now();
  const ms90 = 90 * 24 * 60 * 60 * 1000;
  const old = state.entries.filter(e => e.updatedAt && (now - new Date(e.updatedAt).getTime()) > ms90);
  const no2fa = state.entries.filter(e => e.password && strengthFromPw(e.password).level !== 'weak' && !e.totpSecret);
  const breached = state.breachResults || [];
  const total = state.entries.length;
  const strong = state.entries.filter(e => strengthFromPw(e.password).level === 'strong').length;

  const penaltyWeak = total ? (30 * weak.length / total) : 0;
  const penaltyDup = total ? (25 * dupes.length / total) : 0;
  const penaltyOld = total ? (10 * old.length / total) : 0;
  const penaltyBreach = total && state.breachScanned ? (15 * breached.length / total) : 0;
  const penalty2fa = total ? (10 * no2fa.length / total) : 0;
  let score = 100;
  if (total > 0) {
    score = Math.max(0, Math.round(100 - penaltyWeak - penaltyDup - penaltyOld - penaltyBreach - Math.min(penalty2fa, 10)));
  }
  
  const arc = document.getElementById('healthChartArc');
  const valEl = document.getElementById('healthChartValue');
  if (valEl) valEl.textContent = score + '%';
  if (arc) {
    const circumference = 314.16;
    arc.style.strokeDashoffset = circumference * (1 - score / 100);
    if (score >= 80) arc.setAttribute('stroke', '#30D5C8');
    else if (score >= 50) arc.setAttribute('stroke', '#ff9500');
    else arc.setAttribute('stroke', '#ff3b30');
  }

  document.getElementById('reportSummary').innerHTML = `
    <div class="report-summary-tiles">
      <div class="report-tile"><span class="report-tile-num">${total}</span><span class="report-tile-label">Toplam</span></div>
      <div class="report-tile report-tile-ok"><span class="report-tile-num">${strong}</span><span class="report-tile-label">Güçlü</span></div>
      <div class="report-tile report-tile-warn"><span class="report-tile-num">${weak.length}</span><span class="report-tile-label">Zayıf</span></div>
      <div class="report-tile report-tile-warn"><span class="report-tile-num">${dupes.length}</span><span class="report-tile-label">Tekrar Eden</span></div>
      <div class="report-tile report-tile-warn"><span class="report-tile-num">${old.length}</span><span class="report-tile-label">Eski (90+ Gün)</span></div>
      <div class="report-tile report-tile-danger"><span class="report-tile-num">${state.breachScanned ? breached.length : '—'}</span><span class="report-tile-label">Sızıntılı (HIBP)</span></div>
    </div>
  `;

  const breakdown = document.getElementById('reportScoreBreakdown');
  if (breakdown) {
    breakdown.innerHTML = `
      <h4>Skor Dağılımı (0–100)</h4>
      <ul class="score-breakdown-list">
        <li>Zayıf parolalar: −${Math.round(penaltyWeak)} puan</li>
        <li>Tekrar eden parolalar: −${Math.round(penaltyDup)} puan</li>
        <li>Eski parolalar (90+ gün): −${Math.round(penaltyOld)} puan</li>
        <li>Sızıntılı parolalar (HIBP): −${state.breachScanned ? Math.round(penaltyBreach) : 0} puan</li>
        <li>2FA eksik (güçlü kayıtlar): −${Math.round(Math.min(penalty2fa, 10))} puan (max 10)</li>
      </ul>
    `;
  }

  const breachList = document.getElementById('reportBreachList');
  if (breachList) {
    if (!state.breachScanned) {
      breachList.innerHTML = '<div class="report-empty">HIBP taraması yapmak için yukarıdaki butonu kullanın</div>';
    } else if (!breached.length) {
      breachList.innerHTML = '<div class="report-empty">Sızıntıya uğramış parola bulunamadı</div>';
    } else {
      breachList.innerHTML = breached.map(b => {
        const e = state.entries.find(x => x.id === b.id);
        return `<div class="report-item" data-id="${b.id}"><span class="report-item-name">${escapeHtml(b.name || e?.name || 'Kayıt')}</span><span class="report-item-meta">${b.count.toLocaleString('tr-TR')} kez sızıntıda</span></div>`;
      }).join('');
    }
  }

  const renderItem = (e, sub) => `<div class="report-item" data-id="${e.id}"><span class="report-item-name">${escapeHtml(e.name)}</span><span class="report-item-meta">${escapeHtml(sub || '')}</span></div>`;
  document.getElementById('reportWeakList').innerHTML = weak.length ? weak.map(e => renderItem(e, (e.username || extractDomain(e.url)) || '')).join('') : '<div class="report-empty">Zayıf parola yok</div>';
  document.getElementById('reportDuplicateList').innerHTML = dupes.length ? dupes.map(e => renderItem(e, 'Aynı parola kullanılıyor')).join('') : '<div class="report-empty">Tekrar eden parola yok</div>';
  document.getElementById('reportOldList').innerHTML = old.length ? old.map(e => renderItem(e, formatDate(e.updatedAt) + ' — güncellenmedi')).join('') : '<div class="report-empty">Eski parola yok</div>';

  document.querySelectorAll('#panelReport .report-item').forEach(el => {
    el.addEventListener('click', () => {
      setRoute('home');
      state.selectedId = el.dataset.id;
      renderGrid(state.entries, document.getElementById('searchInput')?.value || '', state.selectedCategory);
      selectEntry(el.dataset.id);
    });
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function scanBreaches() {
  const btn = document.getElementById('btnScanBreaches');
  const status = document.getElementById('reportScanStatus');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Taranıyor… (internet gerekir)';
  try {
    const r = await window.encryption?.scanEntriesBreaches?.();
    if (r?.ok) {
      state.breachResults = r.breaches || [];
      state.breachScanned = true;
      addAuditLog('HIBP taraması', `${state.breachResults.length} sızıntılı / ${r.scanned} taranan`);
      loadReport();
      notify(`Tarama tamam: ${state.breachResults.length} sızıntılı parola`);
      if (status) status.textContent = `${r.scanned} parola tarandı`;
    } else {
      notify(r?.error || 'Tarama başarısız');
      if (status) status.textContent = '';
    }
  } catch (e) {
    console.error('scanBreaches:', e);
    notify('Tarama hatası');
    if (status) status.textContent = '';
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runPbdkf2Benchmark() {
  const el = document.getElementById('benchmarkResults');
  if (el) el.innerHTML = '<span class="settings-muted">Test çalışıyor…</span>';
  try {
    const r = await window.encryption?.benchmarkPbdkf2?.();
    if (r?.ok && el) {
      el.innerHTML = `<table class="benchmark-table"><thead><tr><th>Tekrar</th><th>Süre (ms)</th></tr></thead><tbody>${r.results.map(row => `<tr><td>${row.iterations.toLocaleString('tr-TR')}</td><td>${row.ms}</td></tr>`).join('')}</tbody></table>`;
      addAuditLog('PBKDF2 benchmark', r.results.map(x => `${x.iterations}:${x.ms}ms`).join(', '));
    } else if (el) {
      el.innerHTML = '<span class="settings-muted">Test başarısız</span>';
    }
  } catch (e) {
    console.error('runPbdkf2Benchmark:', e);
    if (el) el.innerHTML = '<span class="settings-muted">Hata</span>';
  }
}

/* ——— Kartlar ——— */
function openCardDrawer() {
  document.getElementById('cardDrawer').classList.add('open');
}

function closeCardDrawer() {
  document.getElementById('cardDrawer').classList.remove('open');
}

async function loadCards() {
  try {
    state.cards = (await window.vault?.getCards()) || [];
  } catch (e) {
    console.error('loadCards:', e);
    state.cards = [];
  }
  renderCards();
  const list = document.getElementById('cardsList');
  const empty = document.getElementById('cardsEmpty');
  if (state.cards.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'block';
    empty.style.display = 'none';
  }
}

function cardBrandClass(brand) {
  const b = (brand || '').toLowerCase();
  if (b.includes('master')) return 'mastercard';
  if (b.includes('troy')) return 'troy';
  return '';
}

function renderCards() {
  const list = document.getElementById('cardsList');
  list.innerHTML = '';
  state.cards.forEach(card => {
    const row = document.createElement('div');
    row.className = 'card-row' + (card.id === state.selectedCardId ? ' active' : '');
    row.dataset.id = card.id;
    const cls = cardBrandClass(card.brand);
    row.innerHTML = `
      <div class="card-row-ico ${cls}">${card.icon || '💳'}</div>
      <div class="card-row-info">
        <div class="card-row-name">${escapeHtml(card.name || 'Kartsız')}</div>
        <div class="card-row-sub">${escapeHtml(card.brand || '')} •••• ${card.numberLast4 || '****'}</div>
      </div>
    `;
    row.addEventListener('click', () => selectCard(card.id));
    list.appendChild(row);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function selectCard(id) {
  state.selectedCardId = id;
  state.isEditingCard = false;
  document.querySelectorAll('.card-row').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  openCardDrawer();
  showCardDetail();
}

function showCardDetail() {
  const view = document.getElementById('cardDetailView');
  const edit = document.getElementById('cardDetailEdit');
  if (!view || !edit) return;

  if (state.isEditingCard) {
    view.style.display = 'none';
    edit.style.display = 'block';
    return;
  }

  edit.style.display = 'none';
  const card = state.selectedCardId ? state.cards.find(c => c.id === state.selectedCardId) : null;
  if (!card) {
    view.style.display = 'none';
    closeCardDrawer();
    return;
  }

  view.style.display = 'block';
  document.getElementById('cardBrand').textContent = card.brand || 'Kart';
  document.getElementById('cardNumber').textContent = '•••• •••• •••• ' + (card.numberLast4 || '****');
  document.getElementById('cardHolder').textContent = card.holder || '—';
  document.getElementById('cardExpiry').textContent = card.expiry || '—';
  const prev = document.getElementById('cardPreview');
  prev.className = 'card-preview ' + cardBrandClass(card.brand);
  const cvcRow = document.getElementById('cardCvcRow');
  if (cvcRow) cvcRow.style.display = card.cvc ? 'flex' : 'none';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function startCardEdit(newCard = false) {
  state.isEditingCard = true;
  const card = newCard ? null : state.cards.find(c => c.id === state.selectedCardId);
  document.getElementById('cardEditName').value = card?.name || '';
  document.getElementById('cardEditBrand').value = card?.brand || 'Visa';
  document.getElementById('cardEditNumber').value = card?.number ? card.number.replace(/\D/g, '') : '';
  document.getElementById('cardEditHolder').value = card?.holder || '';
  document.getElementById('cardEditExpiry').value = card?.expiry || '';
  document.getElementById('cardEditCvc').value = card?.cvc || '';
  document.getElementById('cardDetailEdit').dataset.cardId = card?.id || '';
  openCardDrawer();
  showCardDetail();
}

async function saveCard() {
  const name = document.getElementById('cardEditName')?.value?.trim();
  const detailEdit = document.getElementById('cardDetailEdit');
  if (!name) { notify('Kart adı gerekli'); return; }
  const num = document.getElementById('cardEditNumber')?.value?.replace(/\D/g, '') || '';
  const holder = document.getElementById('cardEditHolder')?.value?.trim() || '';
  const expiry = document.getElementById('cardEditExpiry')?.value?.trim() || '';
  const brand = document.getElementById('cardEditBrand')?.value || 'Visa';
  const cvc = document.getElementById('cardEditCvc')?.value?.trim() || '';
  const card = {
    id: detailEdit?.dataset?.cardId || null,
    name,
    brand,
    number: num,
    holder,
    expiry: expiry || '00/00',
    cvc: cvc || undefined
  };
  if (!window.vault?.saveCard) { notify('Kaydetme başarısız'); return; }
  try {
    const saved = await window.vault.saveCard(card);
    state.isEditingCard = false;
    await loadCards();
    state.selectedCardId = saved.id;
    document.querySelectorAll('.card-row').forEach(c => c.classList.toggle('active', c.dataset.id === saved.id));
    openCardDrawer();
    showCardDetail();
    notify('Kart kaydedildi');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('saveCard:', e);
    notify('Kaydetme hatası');
  }
}

function cancelCardEdit() {
  state.isEditingCard = false;
  if (!state.selectedCardId) closeCardDrawer();
  else showCardDetail();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function deleteCard() {
  if (!state.selectedCardId) return;
  if (!confirm('Bu kartı silmek istediğinize emin misiniz?')) return;
  await window.vault.deleteCard(state.selectedCardId);
  state.selectedCardId = null;
  closeCardDrawer();
  await loadCards();
  notify('Kart silindi');
}

/* ——— Ödemeler ——— */
function openPaymentDrawer() {
  document.getElementById('paymentDrawer').classList.add('open');
}

function closePaymentDrawer() {
  document.getElementById('paymentDrawer').classList.remove('open');
}

function formatAmount(amount, currency) {
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  const sym = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  return sym + s;
}

function getCardName(cardId) {
  const c = state.cards.find(x => x.id === cardId);
  return c ? `${c.name} •••• ${c.numberLast4 || '****'}` : '—';
}

async function loadPayments() {
  try {
    state.payments = (await window.vault?.getPayments()) || [];
    state.cards = (await window.vault?.getCards()) || [];
  } catch (e) {
    console.error('loadPayments:', e);
    state.payments = [];
    state.cards = [];
  }
  renderPayments();
  updatePaymentsSummary();
  const list = document.getElementById('paymentsList');
  const empty = document.getElementById('paymentsEmpty');
  const summary = document.getElementById('paymentsSummary');
  if (state.payments.length === 0) {
    list.style.display = 'none';
    summary.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'block';
    summary.style.display = 'flex';
    empty.style.display = 'none';
  }
}

function updatePaymentsSummary() {
  const el = document.getElementById('paymentsSummary');
  if (!el) return;
  const total = state.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const byCurrency = {};
  state.payments.forEach(p => {
    const cur = p.currency || 'TRY';
    byCurrency[cur] = (byCurrency[cur] || 0) + (parseFloat(p.amount) || 0);
  });
  const items = Object.entries(byCurrency).map(([cur, amt]) => ({
    label: cur === 'TRY' ? 'Aylık Toplam (TRY)' : `Aylık (${cur})`,
    value: formatAmount(amt, cur)
  }));
  el.innerHTML = items.map(i => `<div class="payments-summary-item"><span class="payments-summary-label">${i.label}</span><span class="payments-summary-value">${i.value}</span></div>`).join('');
}

function renderPayments() {
  const list = document.getElementById('paymentsList');
  list.innerHTML = '';
  state.payments.sort((a, b) => (a.dueDay || 0) - (b.dueDay || 0));
  state.payments.forEach(payment => {
    const row = document.createElement('div');
    row.className = 'payment-row' + (payment.id === state.selectedPaymentId ? ' active' : '');
    row.dataset.id = payment.id;
    const cardName = getCardName(payment.cardId);
    row.innerHTML = `
      <div class="payment-row-info">
        <div class="payment-row-name">${escapeHtml(payment.name || 'Ödemesiz')}</div>
        <div class="payment-row-meta">Vade: ${payment.dueDay || '—'}. gün · ${escapeHtml(cardName)}</div>
      </div>
      <div class="payment-row-amount">${formatAmount(payment.amount, payment.currency)}</div>
    `;
    row.addEventListener('click', () => selectPayment(payment.id));
    list.appendChild(row);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function selectPayment(id) {
  state.selectedPaymentId = id;
  state.isEditingPayment = false;
  document.querySelectorAll('.payment-row').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  openPaymentDrawer();
  showPaymentDetail();
}

function showPaymentDetail() {
  const view = document.getElementById('paymentDetailView');
  const edit = document.getElementById('paymentDetailEdit');
  if (!view || !edit) return;

  if (state.isEditingPayment) {
    view.style.display = 'none';
    edit.style.display = 'block';
    populatePaymentCardSelect();
    return;
  }

  edit.style.display = 'none';
  const payment = state.selectedPaymentId ? state.payments.find(p => p.id === state.selectedPaymentId) : null;
  if (!payment) {
    view.style.display = 'none';
    closePaymentDrawer();
    return;
  }

  view.style.display = 'block';
  document.getElementById('paymentViewName').textContent = payment.name || '—';
  document.getElementById('paymentViewAmount').textContent = formatAmount(payment.amount, payment.currency);
  document.getElementById('paymentViewDue').textContent = 'Vade: ' + (payment.dueDay || '—') + '. gün';
  document.getElementById('paymentViewCard').textContent = 'Kart: ' + getCardName(payment.cardId);
  const notesEl = document.getElementById('paymentViewNotes');
  notesEl.textContent = payment.notes || '';
  notesEl.style.display = payment.notes ? 'block' : 'none';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function populatePaymentCardSelect() {
  const sel = document.getElementById('paymentEditCard');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Kart seçin</option>' + state.cards.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name || 'Kart')} •••• ${c.numberLast4 || '****'}</option>`
  ).join('');
  sel.value = current || (state.payments.find(p => p.id === state.selectedPaymentId)?.cardId || '');
}

function startPaymentEdit(newPayment = false) {
  state.isEditingPayment = true;
  const payment = newPayment ? null : state.payments.find(p => p.id === state.selectedPaymentId);
  document.getElementById('paymentEditName').value = payment?.name || '';
  document.getElementById('paymentEditAmount').value = payment?.amount ?? '';
  document.getElementById('paymentEditCurrency').value = payment?.currency || 'TRY';
  document.getElementById('paymentEditDueDay').value = payment?.dueDay ?? '';
  document.getElementById('paymentEditNotes').value = payment?.notes || '';
  document.getElementById('paymentDetailEdit').dataset.paymentId = payment?.id || '';
  openPaymentDrawer();
  showPaymentDetail();
}

async function savePayment() {
  const name = document.getElementById('paymentEditName')?.value?.trim();
  const amount = parseFloat(document.getElementById('paymentEditAmount')?.value) || 0;
  const dueDay = Math.min(31, Math.max(1, parseInt(document.getElementById('paymentEditDueDay')?.value) || 15));
  const cardId = document.getElementById('paymentEditCard')?.value || '';
  const notes = document.getElementById('paymentEditNotes')?.value?.trim() || '';
  const currency = document.getElementById('paymentEditCurrency')?.value || 'TRY';
  const detailEdit = document.getElementById('paymentDetailEdit');
  if (!name) { notify('Ödeme adı gerekli'); return; }
  const payment = {
    id: detailEdit?.dataset?.paymentId || null,
    name,
    amount,
    currency,
    dueDay,
    cardId,
    notes,
    recurring: 'monthly'
  };
  if (!window.vault?.savePayment) { notify('Kaydetme başarısız'); return; }
  try {
    const saved = await window.vault.savePayment(payment);
    state.isEditingPayment = false;
    await loadPayments();
    state.selectedPaymentId = saved.id;
    document.querySelectorAll('.payment-row').forEach(c => c.classList.toggle('active', c.dataset.id === saved.id));
    openPaymentDrawer();
    showPaymentDetail();
    notify('Ödeme kaydedildi');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('savePayment:', e);
    notify('Kaydetme hatası');
  }
}

function cancelPaymentEdit() {
  state.isEditingPayment = false;
  if (!state.selectedPaymentId) closePaymentDrawer();
  else showPaymentDetail();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function deletePayment() {
  if (!state.selectedPaymentId) return;
  if (!confirm('Bu ödemeyi silmek istediğinize emin misiniz?')) return;
  await window.vault.deletePayment(state.selectedPaymentId);
  state.selectedPaymentId = null;
  closePaymentDrawer();
  await loadPayments();
  notify('Ödeme silindi');
}

/* ——— Gizli Notlar ——— */
function openNoteDrawer() {
  document.getElementById('noteDrawer').classList.add('open');
}

function closeNoteDrawer() {
  document.getElementById('noteDrawer').classList.remove('open');
}

async function loadNotes() {
  try {
    state.notes = (await window.vault?.getNotes()) || [];
  } catch (e) {
    console.error('loadNotes:', e);
    state.notes = [];
  }
  renderNotes(state.notesSearch);
  const list = document.getElementById('notesList');
  const empty = document.getElementById('notesEmpty');
  if (state.notes.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'flex';
  } else {
    list.style.display = 'block';
    empty.style.display = 'none';
  }
}

function renderNotes(search = '') {
  const list = document.getElementById('notesList');
  list.innerHTML = '';
  const q = search.toLowerCase().trim();
  const filtered = q ? state.notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.content || '').toLowerCase().includes(q)
  ) : state.notes;
  filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  filtered.forEach(note => {
    const row = document.createElement('div');
    row.className = 'note-row' + (note.id === state.selectedNoteId ? ' active' : '');
    row.dataset.id = note.id;
    const preview = (note.content || '').replace(/\n/g, ' ').slice(0, 80);
    row.innerHTML = `
      <div class="note-row-ico">${note.icon || '📝'}</div>
      <div class="note-row-info">
        <div class="note-row-title">${escapeHtml(note.title || 'Başlıksız')}</div>
        <div class="note-row-preview">${escapeHtml(preview || 'İçerik yok')}</div>
      </div>
      <div class="note-row-chevron"><i data-lucide="chevron-right"></i></div>
    `;
    row.addEventListener('click', () => selectNote(note.id));
    list.appendChild(row);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function selectNote(id) {
  state.selectedNoteId = id;
  state.isEditingNote = false;
  document.querySelectorAll('.note-row').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  openNoteDrawer();
  showNoteDetail();
}

function showNoteDetail() {
  const view = document.getElementById('noteDetailView');
  const edit = document.getElementById('noteDetailEdit');
  if (!view || !edit) return;

  if (state.isEditingNote) {
    view.style.display = 'none';
    edit.style.display = 'block';
    return;
  }

  edit.style.display = 'none';
  const note = state.selectedNoteId ? state.notes.find(n => n.id === state.selectedNoteId) : null;
  if (!note) {
    view.style.display = 'none';
    closeNoteDrawer();
    return;
  }

  view.style.display = 'block';
  document.getElementById('noteViewIcon').textContent = note.icon || '📝';
  document.getElementById('noteViewTitle').textContent = note.title || 'Başlıksız';
  document.getElementById('noteViewDate').textContent = formatDate(note.updatedAt);
  document.getElementById('noteViewContent').textContent = note.content || 'İçerik yok';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function startNoteEdit(newNote = false) {
  state.isEditingNote = true;
  const note = newNote ? null : state.notes.find(n => n.id === state.selectedNoteId);
  document.getElementById('noteEditTitle').value = note?.title || '';
  document.getElementById('noteEditContent').value = note?.content || '';
  document.getElementById('noteDetailEdit').dataset.noteId = note?.id || '';
  openNoteDrawer();
  showNoteDetail();
}

async function saveNote() {
  const title = document.getElementById('noteEditTitle')?.value?.trim();
  const content = document.getElementById('noteEditContent')?.value || '';
  const detailEdit = document.getElementById('noteDetailEdit');
  if (!title) { notify('Başlık gerekli'); return; }
  const note = {
    id: detailEdit?.dataset?.noteId || null,
    title,
    content,
    icon: '📝'
  };
  if (!window.vault?.saveNote) { notify('Kaydetme başarısız'); return; }
  try {
    const saved = await window.vault.saveNote(note);
    state.isEditingNote = false;
    await loadNotes();
    state.selectedNoteId = saved.id;
    document.querySelectorAll('.note-row').forEach(c => c.classList.toggle('active', c.dataset.id === saved.id));
    openNoteDrawer();
    showNoteDetail();
    notify('Not kaydedildi');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error('saveNote:', e);
    notify('Kaydetme hatası');
  }
}

function cancelNoteEdit() {
  state.isEditingNote = false;
  if (!state.selectedNoteId) closeNoteDrawer();
  else showNoteDetail();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function deleteNote() {
  if (!state.selectedNoteId) return;
  if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return;
  await window.vault.deleteNote(state.selectedNoteId);
  state.selectedNoteId = null;
  closeNoteDrawer();
  await loadNotes();
  notify('Not silindi');
}

/* ——— Ayarlar ——— */
async function loadSettingsInfo() {
  try {
    const [version, dataPath] = await Promise.all([
      window.app?.getVersion?.() || '2.4.0',
      window.app?.getDataPath?.() || '—'
    ]);
    const vEl = document.getElementById('appVersion');
    const pEl = document.getElementById('dataPath');
    const autoLockEl = document.getElementById('autoLockSelect');
    if (vEl) vEl.textContent = version;
    if (pEl) pEl.textContent = dataPath || '—';
    if (autoLockEl) autoLockEl.value = String(state.autoLockMinutes);
    const themeEl = document.getElementById('themeSelect');
    if (themeEl) themeEl.value = localStorage.getItem('vault_theme') || 'light';
    const extIdEl = document.getElementById('extensionIdInput');
    if (extIdEl) extIdEl.value = localStorage.getItem('vault_extensionId') || '';
    const extStatus = document.getElementById('extensionStatus');
    if (extStatus) extStatus.textContent = '';
    const encSettings = await window.encryption?.getSettings?.();
    if (encSettings) {
      const curEl = document.getElementById('encryptionCurrentValue');
      const selEl = document.getElementById('encryptionIterationsSelect');
      if (curEl) curEl.textContent = (encSettings.iterations || 0).toLocaleString('tr-TR') + ' tekrar';
      if (selEl) selEl.value = String(encSettings.iterations || 100000);
    }
    const encPwEl = document.getElementById('encryptionPasswordInput');
    if (encPwEl) encPwEl.value = '';
    if (extStatus && !extStatus.textContent) {
      const v = await window.app?.extensionVerifyInstall?.();
      if (v?.ok) { extStatus.textContent = '✓ Kurulum tamam'; extStatus.className = 'extension-status success'; }
      else { extStatus.textContent = 'Kurulumu Kontrol Et ile durumu kontrol edebilirsiniz.'; extStatus.className = 'extension-status'; }
    }
    loadAuditLogs();
  } catch (e) { console.error('loadSettingsInfo:', e); }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function updateBioButtonState() {
  if (!window.auth?.isBioAvailable) return;
  const isAvailable = await window.auth.isBioAvailable();
  const row = document.getElementById('settingsRowBio');
  if (isAvailable) {
    if (row) row.style.display = 'flex';
    const isEnabled = await window.auth.getBioStatus();
    const btn = document.getElementById('btnToggleBio');
    if (btn) {
      if (isEnabled) {
        btn.innerHTML = '<i data-lucide="x-circle"></i> Devre Dışı Bırak';
        btn.className = 'cmd-btn danger';
      } else {
        btn.innerHTML = '<i data-lucide="fingerprint"></i> Windows Hello Entegre Et';
        btn.className = 'cmd-btn primary';
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    if (row) row.style.display = 'none';
  }
}

async function update2FAButtonState() {
  if (!window.auth?.get2faStatus) return;
  const isEnabled = await window.auth.get2faStatus();
  const btn = document.getElementById('btnToggle2FA');
  if (btn) {
    if (isEnabled) {
      btn.innerHTML = '<i data-lucide="x-circle"></i> Devre Dışı Bırak';
      btn.className = 'cmd-btn danger';
    } else {
      btn.innerHTML = '<i data-lucide="shield-check"></i> 2FA Aktif Et';
      btn.className = 'cmd-btn primary';
    }
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleBioToggle() {
  const isEnabled = await window.auth.getBioStatus();
  if (isEnabled) {
    if (confirm('Windows Hello biyometrik girişini devre dışı bırakmak istediğinize emin misiniz?')) {
      await window.auth.disableBio();
      addAuditLog('Biyometrik giriş kapatıldı', 'Windows Hello devre dışı bırakıldı');
      notify('Biyometrik giriş devre dışı bırakıldı');
      updateBioButtonState();
    }
  } else {
    const pw = prompt('Windows Hello entegrasyonu için lütfen Master Şifrenizi girin:');
    if (pw === null) return;
    if (!pw) { alert('Şifre girmelisiniz'); return; }

    notify('Windows Hello doğrulaması bekleniyor...');
    const r = await window.auth.enableBio(pw);
    if (r?.ok) {
      addAuditLog('Biyometrik giriş açıldı', 'Windows Hello başarıyla entegre edildi');
      notify('Windows Hello başarıyla entegre edildi!');
      updateBioButtonState();
    } else if (r && !r.canceled) {
      alert('Hata: ' + (r.error || 'Şifre doğrulanamadı'));
    }
  }
}

let setup2faSecret = null;
let setup2faPassword = null;

async function handle2FAToggle() {
  const isEnabled = await window.auth.get2faStatus();
  if (isEnabled) {
    const pw = prompt('İki adımlı doğrulamayı kapatmak için Master Şifrenizi girin:');
    if (pw === null) return;
    if (!pw) { alert('Şifre girmelisiniz'); return; }

    const r = await window.auth.disable2fa(pw);
    if (r?.ok) {
      addAuditLog('2FA kapatıldı', 'İki adımlı doğrulama devre dışı bırakıldı');
      notify('2FA başarıyla devre dışı bırakıldı');
      update2FAButtonState();
    } else {
      alert('Hata: ' + (r.error || 'Şifre doğrulanamadı'));
    }
  } else {
    const pw = prompt('İki adımlı doğrulamayı kurmak için Master Şifrenizi girin:');
    if (pw === null) return;
    if (!pw) { alert('Şifre girmelisiniz'); return; }

    const r = await window.auth.setup2fa(pw);
    if (r?.ok) {
      setup2faSecret = r.secret;
      setup2faPassword = pw;

      const modal = document.getElementById('modal2faSetup');
      const textSecret = document.getElementById('text2faSecret');
      const inputCode = document.getElementById('input2faVerifyCode');
      const inputPassword = document.getElementById('input2faPassword');
      const errorEl = document.getElementById('error2faSetup');

      if (textSecret) textSecret.textContent = r.secret;
      if (inputCode) inputCode.value = '';
      if (inputPassword) {
        inputPassword.value = '';
        inputPassword.placeholder = 'Master şifreniz';
      }
      if (errorEl) errorEl.textContent = '';

      if (modal) modal.classList.add('is-active');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      alert('Hata: ' + (r.error || 'Şifre doğrulanamadı'));
    }
  }
}

function close2faSetupModal() {
  document.getElementById('modal2faSetup')?.classList.remove('is-active');
  setup2faSecret = null;
  setup2faPassword = null;
}

async function submit2faVerify() {
  const code = document.getElementById('input2faVerifyCode')?.value || '';
  const pw = document.getElementById('input2faPassword')?.value || '';
  const errorEl = document.getElementById('error2faSetup');

  if (errorEl) errorEl.textContent = '';
  if (!code || code.length < 6) {
    if (errorEl) errorEl.textContent = '6 haneli doğrulama kodunu girin';
    return;
  }
  if (!pw) {
    if (errorEl) errorEl.textContent = 'Master şifrenizi girin';
    return;
  }

  const r = await window.auth.enable2fa(pw, setup2faSecret, code);
  if (r?.ok) {
    close2faSetupModal();
    addAuditLog('2FA açıldı', 'İki adımlı doğrulama başarıyla aktifleştirildi');
    notify('İki adımlı doğrulama (2FA) başarıyla aktifleştirildi!');
    update2FAButtonState();
  } else {
    if (errorEl) errorEl.textContent = r?.error || 'Doğrulama kodu veya şifre hatalı';
  }
}

function showChangeMasterPwModal() {
  const modal = document.getElementById('changeMasterPwModal');
  if (!modal) return;
  modal.classList.add('open');
  document.getElementById('changePwCurrent').value = '';
  document.getElementById('changePwNew').value = '';
  document.getElementById('changePwConfirm').value = '';
  document.getElementById('changePwError').textContent = '';
  document.getElementById('changePwCurrent').focus();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeChangeMasterPwModal() {
  const modal = document.getElementById('changeMasterPwModal');
  if (modal) modal.classList.remove('open');
}

let pendingSavePassword = null;
function showSavePasswordModal(data) {
  if (!data || !data.password) return;
  pendingSavePassword = data;
  const modal = document.getElementById('savePasswordModal');
  const siteEl = document.getElementById('savePasswordSite');
  const userEl = document.getElementById('savePasswordUsername');
  const previewEl = document.getElementById('savePasswordPreview');
  const toggleBtn = document.getElementById('savePasswordToggle');
  const toggleIcon = toggleBtn?.querySelector('i');
  if (siteEl) siteEl.textContent = data.name || '—';
  if (userEl) userEl.textContent = data.username || '—';
  if (previewEl) previewEl.textContent = '••••••••';
  if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'eye');
  if (modal) modal.classList.add('open');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSavePasswordModal() {
  pendingSavePassword = null;
  const modal = document.getElementById('savePasswordModal');
  if (modal) modal.classList.remove('open');
}

async function confirmSavePassword() {
  if (!pendingSavePassword) return;
  const { url, username, password, name } = pendingSavePassword;
  const st = strengthFromPw(password);
  const pageDom = extractDomain(url);
  const existing = state.entries.find(e => extractDomain(e.url) === pageDom && (e.username || '') === username);
  const entry = {
    id: existing?.id || null,
    name: name || 'Site',
    url: url || '',
    username,
    password,
    notes: existing?.notes || 'Tarayıcı eklentisi ile kaydedildi',
    icon: '🔐',
    tags: existing?.tags || [],
    category: existing?.category || 'diğer',
    totpSecret: existing?.totpSecret || null,
    strength: st.level
  };
  try {
    await window.vault?.saveEntry?.(entry);
    notify(existing ? 'Parola güncellendi' : 'Parola kaydedildi');
    await loadEntries();
  } catch (e) {
    notify('Kaydetme hatası');
  }
  closeSavePasswordModal();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function submitChangeMasterPw() {
  const current = document.getElementById('changePwCurrent')?.value || '';
  const newPw = document.getElementById('changePwNew')?.value || '';
  const confirm = document.getElementById('changePwConfirm')?.value || '';
  const errEl = document.getElementById('changePwError');
  errEl.textContent = '';
  if (!current) { errEl.textContent = 'Mevcut şifreyi girin'; return; }
  if (newPw.length < 6) { errEl.textContent = 'Yeni şifre en az 6 karakter olmalı'; return; }
  if (newPw !== confirm) { errEl.textContent = 'Yeni şifreler eşleşmiyor'; return; }
  const r = await window.auth?.changeMasterPassword?.(current, newPw);
  if (r?.ok) {
    closeChangeMasterPwModal();
    addAuditLog('Master şifre değiştirildi', 'Başarılı');
    notify('Master şifre güncellendi');
  } else {
    errEl.textContent = r?.error || 'Hata oluştu';
  }
}

/* ——— Event bağlamaları ——— */
document.addEventListener('DOMContentLoaded', async () => {
  const savedTheme = localStorage.getItem('vault_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  /* Pencere kontrolleri — ÖNCE (kapat/büyüt/küçült her zaman çalışsın) */
  document.getElementById('winMinimize')?.addEventListener('click', () => window.windowControls?.minimize());
  document.getElementById('winMaximize')?.addEventListener('click', () => window.windowControls?.maximize());
  document.getElementById('winClose')?.addEventListener('click', () => window.windowControls?.close());

  window.app?.onLock?.(() => { if (state.unlocked) lockVault(); });
  window.app?.onExtensionOfferSave?.(showSavePasswordModal);

  /* Lock ekranı — event delegation (body'de dinle, tıklama kesin çalışsın) */
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('#lockSetupBtn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const pw = document.getElementById('lockSetupPw')?.value || '';
      const confirm = document.getElementById('lockSetupConfirm')?.value || '';
      const errEl = document.getElementById('lockSetupError');
      if (errEl) errEl.textContent = '';
      if (pw.length < 6) { if (errEl) errEl.textContent = 'En az 6 karakter gerekli'; return; }
      if (pw !== confirm) { if (errEl) errEl.textContent = 'Şifreler eşleşmiyor'; return; }
      if (!window.auth) { if (errEl) errEl.textContent = 'Sistem hazır değil'; return; }
      try {
        const r = await window.auth.setMasterPassword(pw);
        if (r?.ok) {
          document.getElementById('lockSetupPw').value = '';
          document.getElementById('lockSetupConfirm').value = '';
          unlockVault();
        } else { if (errEl) errEl.textContent = r?.error || 'Hata'; }
      } catch (err) {
        if (errEl) errEl.textContent = 'Bağlantı hatası';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }
    const unlockBtn = e.target.closest('#lockUnlockBtn');
    if (unlockBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pw = document.getElementById('lockUnlockPw')?.value || '';
      const errEl = document.getElementById('lockUnlockError');
      if (errEl) errEl.textContent = '';
      if (!pw) { if (errEl) errEl.textContent = 'Şifre girin'; return; }
      if (!window.auth) { if (errEl) errEl.textContent = 'Sistem hazır değil'; return; }
      try {
        const r = await window.auth.verifyPassword(pw);
        if (r?.ok) {
          if (r.requires2fa) {
            showLockUI('2fa');
            document.getElementById('lock2faCode')?.focus();
          } else {
            unlockVault();
          }
        }
        else { if (errEl) errEl.textContent = r?.error || 'Yanlış şifre'; }
      } catch (err) {
        if (errEl) errEl.textContent = 'Bağlantı hatası';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const lockBioBtn = e.target.closest('#lockBioBtn');
    if (lockBioBtn) {
      e.preventDefault();
      e.stopPropagation();
      triggerBiometricUnlock();
    }

    const lock2faBtn = e.target.closest('#lock2faBtn');
    if (lock2faBtn) {
      e.preventDefault();
      e.stopPropagation();
      const code = document.getElementById('lock2faCode')?.value || '';
      const errEl = document.getElementById('lock2faError');
      if (errEl) errEl.textContent = '';
      if (code.length < 6) { if (errEl) errEl.textContent = '6 haneli kodu girin'; return; }
      try {
        const r = await window.auth.verify2fa(code);
        if (r?.ok) unlockVault();
        else { if (errEl) errEl.textContent = r?.error || 'Hatalı kod'; }
      } catch (err) {
        if (errEl) errEl.textContent = 'Bağlantı hatası';
      }
    }
  });

  document.getElementById('lockUnlockPw')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('lockUnlockBtn')?.click();
  });
  document.getElementById('lock2faCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('lock2faBtn')?.click();
  });
  document.getElementById('lockSetupPw')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('lockSetupConfirm')?.focus();
  });
  document.getElementById('lockSetupConfirm')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('lockSetupBtn')?.click();
  });

  document.getElementById('btnLock')?.addEventListener('click', lockVault);

  document.getElementById('btnToggleBio')?.addEventListener('click', handleBioToggle);
  document.getElementById('btnToggle2FA')?.addEventListener('click', handle2FAToggle);
  document.getElementById('modal2faSetupClose')?.addEventListener('click', close2faSetupModal);
  document.getElementById('btn2faVerifyCancel')?.addEventListener('click', close2faSetupModal);
  document.getElementById('btn2faVerifySubmit')?.addEventListener('click', submit2faVerify);
  document.getElementById('input2faVerifyCode')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn2faVerifySubmit')?.click();
  });

  await checkAuthState();

  try { if (state.unlocked) await loadEntries(); } catch (e) { console.error('init:', e); }
  if (state.unlocked) setRoute('home');

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    renderGrid(state.entries, e.target.value, state.selectedCategory);
  });
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sort = e.target.value || 'name-asc';
    localStorage.setItem('vault_sort', state.sort);
    renderGrid(state.entries, document.getElementById('searchInput')?.value || '', state.selectedCategory);
  });

  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.selectedCategory = tab.dataset.cat || '';
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === state.selectedCategory));
      renderGrid(state.entries, document.getElementById('searchInput')?.value || '', state.selectedCategory);
    });
  });
  document.getElementById('tagSelect')?.addEventListener('change', (e) => {
    state.selectedTag = (e.target.value || '').trim();
    renderGrid(state.entries, document.getElementById('searchInput')?.value || '', state.selectedCategory);
  });

  document.getElementById('btnAdd')?.addEventListener('click', () => {
    state.selectedId = null;
    closeDrawer();
    startEdit(true);
  });
  document.getElementById('btnAddFromEmpty')?.addEventListener('click', () => {
    state.selectedId = null;
    closeDrawer();
    startEdit(true);
  });

  document.getElementById('detailDrawer')?.addEventListener('click', (e) => {
    if (e.target.closest('#drawerClose') || e.target.closest('.drawer-backdrop')) closeDrawer();
  });

  document.getElementById('btnEdit')?.addEventListener('click', () => state.selectedId && startEdit());

  document.getElementById('btnCopyPw')?.addEventListener('click', () => {
    const entry = state.entries.find(e => e.id === state.selectedId);
    if (entry?.password) {
      copyText(entry.password, 30);
      addAuditLog('Parola kopyalandı', entry.name || 'Kayıt');
    }
  });

  document.getElementById('btnToggleFav')?.addEventListener('click', async () => {
    const entry = state.entries.find(e => e.id === state.selectedId);
    if (!entry) return;
    const updated = { ...entry, favorite: !entry.favorite };
    await window.vault?.saveEntry?.(updated);
    await loadEntries();
    showDetail();
    notify(updated.favorite ? 'Favorilere eklendi' : 'Favorilerden kaldırıldı');
  });
  document.getElementById('btnOpenUrl')?.addEventListener('click', () => {
    const entry = state.entries.find(e => e.id === state.selectedId);
    let url = entry?.url?.trim();
    if (url && !url.startsWith('http')) url = 'https://' + url;
    if (url) window.app?.openExternal?.(url);
  });

  document.getElementById('btnDelete')?.addEventListener('click', deleteEntry);

  document.getElementById('btnSave')?.addEventListener('click', saveEntry);
  document.getElementById('btnCancelEdit')?.addEventListener('click', cancelEdit);

  document.getElementById('btnAddCustomField')?.addEventListener('click', () => {
    const container = document.getElementById('customFieldsEditList');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'custom-field-edit-row';
    row.innerHTML = `
      <input type="text" class="custom-field-key" placeholder="Alan adı">
      <input type="text" class="custom-field-value" placeholder="Değer">
      <label class="custom-field-type"><input type="checkbox"> Gizli</label>
      <button type="button" class="field-action custom-field-remove" title="Kaldır"><i data-lucide="x"></i></button>
    `;
    row.querySelector('.custom-field-remove')?.addEventListener('click', () => row.remove());
    container.appendChild(row);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });

  document.getElementById('editPwGen')?.addEventListener('click', () => {
    const pw = generatePasswordForEdit();
    const editPw = document.getElementById('editPassword');
    if (editPw) editPw.value = pw;
  });

  document.querySelectorAll('.nav-item').forEach(r => {
    if (r.dataset.route) r.addEventListener('click', () => {
      if (r.dataset.route === 'security') {
        window.app?.openPasswordCheck?.();
      } else {
        setRoute(r.dataset.route);
      }
    });
  });

  document.getElementById('pwToggle')?.addEventListener('click', () => {
    const input = document.getElementById('inputPassword');
    const btn = document.getElementById('pwToggle');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁';
    }
  });

  document.querySelectorAll('[data-copy]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.getAttribute('data-copy');
      if (action === 'totp') {
        copyText(document.getElementById('totpNum')?.textContent?.replace(/\s/g, '') || '', 30);
        return;
      }
      const field = action;
      let text = '';
      if (field === 'username') text = document.getElementById('inputUsername')?.value || '';
      if (field === 'password') text = document.getElementById('inputPassword')?.value || '';
      if (field === 'url') text = document.getElementById('inputUrl')?.value || '';
      const clearAfter = (field === 'password') ? 30 : 0;
      if (text) copyText(text, clearAfter);
    });
  });

  document.getElementById('genGenerate')?.addEventListener('click', generatePassword);
  document.getElementById('genCopy')?.addEventListener('click', () => {
    const v = document.getElementById('genOutput').value;
    if (v) copyText(v);
  });

  document.getElementById('btnAddCard')?.addEventListener('click', () => {
    state.selectedCardId = null;
    closeCardDrawer();
    startCardEdit(true);
  });
  document.getElementById('btnAddCardFromEmpty')?.addEventListener('click', () => {
    state.selectedCardId = null;
    closeCardDrawer();
    startCardEdit(true);
  });
  document.getElementById('cardDrawerClose')?.addEventListener('click', closeCardDrawer);
  document.getElementById('cardDrawerBackdrop')?.addEventListener('click', closeCardDrawer);
  document.getElementById('cardBtnEdit')?.addEventListener('click', () => state.selectedCardId && startCardEdit());
  document.getElementById('cardBtnCopyNum')?.addEventListener('click', () => {
    const card = state.cards.find(c => c.id === state.selectedCardId);
    if (card?.number) copyText(card.number.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim());
    else if (card?.numberLast4) copyText('**** **** **** ' + card.numberLast4);
  });
  document.getElementById('cardBtnCopyExp')?.addEventListener('click', () => {
    const card = state.cards.find(c => c.id === state.selectedCardId);
    if (card?.expiry) copyText(card.expiry);
  });
  document.getElementById('cardBtnCopyCvc')?.addEventListener('click', () => {
    const card = state.cards.find(c => c.id === state.selectedCardId);
    if (card?.cvc) copyText(card.cvc, 30);
  });
  document.getElementById('cardBtnDelete')?.addEventListener('click', deleteCard);
  document.getElementById('cardBtnSave')?.addEventListener('click', saveCard);
  document.getElementById('cardBtnCancel')?.addEventListener('click', cancelCardEdit);

  document.getElementById('btnAddPayment')?.addEventListener('click', () => {
    state.selectedPaymentId = null;
    closePaymentDrawer();
    startPaymentEdit(true);
  });
  document.getElementById('btnAddPaymentFromEmpty')?.addEventListener('click', () => {
    state.selectedPaymentId = null;
    closePaymentDrawer();
    startPaymentEdit(true);
  });
  document.getElementById('paymentDrawerClose')?.addEventListener('click', closePaymentDrawer);
  document.getElementById('paymentDrawerBackdrop')?.addEventListener('click', closePaymentDrawer);
  document.getElementById('paymentBtnEdit')?.addEventListener('click', () => state.selectedPaymentId && startPaymentEdit());
  document.getElementById('paymentBtnDelete')?.addEventListener('click', deletePayment);
  document.getElementById('paymentBtnSave')?.addEventListener('click', savePayment);
  document.getElementById('paymentBtnCancel')?.addEventListener('click', cancelPaymentEdit);

  document.getElementById('btnAddNote')?.addEventListener('click', () => {
    state.selectedNoteId = null;
    closeNoteDrawer();
    startNoteEdit(true);
  });
  document.getElementById('btnAddNoteFromEmpty')?.addEventListener('click', () => {
    state.selectedNoteId = null;
    closeNoteDrawer();
    startNoteEdit(true);
  });
  document.getElementById('noteDrawerClose')?.addEventListener('click', closeNoteDrawer);
  document.getElementById('noteDrawerBackdrop')?.addEventListener('click', closeNoteDrawer);
  document.getElementById('noteBtnEdit')?.addEventListener('click', () => state.selectedNoteId && startNoteEdit());
  document.getElementById('noteBtnCopy')?.addEventListener('click', () => {
    const note = state.notes.find(n => n.id === state.selectedNoteId);
    if (note?.content) copyText(note.content);
  });
  document.getElementById('noteBtnDelete')?.addEventListener('click', deleteNote);
  document.getElementById('noteBtnSave')?.addEventListener('click', saveNote);
  document.getElementById('noteBtnCancel')?.addEventListener('click', cancelNoteEdit);
  document.getElementById('btnChangeMasterPw')?.addEventListener('click', showChangeMasterPwModal);
  document.getElementById('themeSelect')?.addEventListener('change', (e) => {
    const theme = e.target.value || 'light';
    localStorage.setItem('vault_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  });
  document.getElementById('autoLockSelect')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 0;
    state.autoLockMinutes = val;
    localStorage.setItem('vault_autoLockMinutes', String(val));
    resetInactivityTimer();
  });
  document.getElementById('btnBackup')?.addEventListener('click', async () => {
    const r = await window.vault?.createBackup?.();
    if (r?.ok) {
      notify('Yedek oluşturuldu');
      addAuditLog('Yedek alındı', 'Şifreli kasa yedeği oluşturuldu');
    }
    else if (r?.canceled) return;
    else notify('Hata: ' + (r?.error || 'Bilinmeyen'));
  });
  document.getElementById('btnExportJson')?.addEventListener('click', async () => {
    const r = await window.vault?.exportToFile?.('json');
    if (r?.ok) {
      notify('JSON dışa aktarıldı');
      addAuditLog('Dışa aktarıldı', 'JSON formatı');
    }
    else if (!r && r !== false) notify('İptal edildi');
    else notify('Hata: ' + (r?.error || 'Bilinmeyen'));
  });
  document.getElementById('btnExportCsv')?.addEventListener('click', async () => {
    const r = await window.vault?.exportToFile?.('csv');
    if (r?.ok) {
      notify('CSV dışa aktarıldı');
      addAuditLog('Dışa aktarıldı', 'CSV formatı');
    }
    else if (!r && r !== false) notify('İptal edildi');
    else notify('Hata: ' + (r?.error || 'Bilinmeyen'));
  });
  document.getElementById('btnImport')?.addEventListener('click', async () => {
    const r = await window.vault?.importFromFile?.();
    if (r?.ok) {
      const msg = r.formatLabel
        ? `${r.formatLabel}: ${r.count} kayıt${r.skipped ? ` (${r.skipped} atlandı)` : ''}`
        : `${r.count} kayıt içe aktarıldı`;
      notify(msg);
      if (!r.formatLabel) addAuditLog('Veri içe aktarıldı', 'JSON veya CSV');
      await loadEntries();
      if (state.route === 'cards') await loadCards();
      if (state.route === 'notes') await loadNotes();
      if (state.route === 'payments') await loadPayments();
    } else if (!r || r?.canceled) return;
    else notify('Hata: ' + (r?.error || 'Bilinmeyen'));
  });
  document.getElementById('btnApplyEncryption')?.addEventListener('click', async () => {
    const pw = document.getElementById('encryptionPasswordInput')?.value || '';
    const iterations = document.getElementById('encryptionIterationsSelect')?.value || '100000';
    if (!pw) {
      notify('Master şifre girin');
      return;
    }
    const r = await window.encryption?.applySettings?.(pw, iterations);
    if (r?.ok) {
      document.getElementById('encryptionPasswordInput').value = '';
      notify('Şifreleme ayarları güncellendi');
      addAuditLog('Şifreleme ayarı değişti', `${iterations} tekrar sayısı uygulandı`);
      loadSettingsInfo();
    } else {
      notify(r?.error || 'Hata');
    }
  });
  document.getElementById('btnExtensionInstall')?.addEventListener('click', async () => {
    const input = document.getElementById('extensionIdInput');
    const status = document.getElementById('extensionStatus');
    const extId = (input?.value || '').trim();
    if (!extId) {
      status.textContent = 'Önce Extension ID girin';
      status.className = 'extension-status error';
      return;
    }
    status.textContent = 'Kuruluyor... (en fazla 15 sn)';
    status.className = 'extension-status';
    const r = await window.app?.extensionInstallHost?.(extId);
    if (r?.ok) {
      localStorage.setItem('vault_extensionId', extId);
      status.textContent = 'Kurulum tamamlandı. Chrome eklentisini yeniden yükleyin.';
      status.className = 'extension-status success';
      notify('Kurulum tamamlandı');
    } else {
      status.textContent = (r?.error || 'Kurulum başarısız') + ' — Kurulumu Kontrol Et ile kontrol edin.';
      status.className = 'extension-status error';
    }
  });
  document.getElementById('btnExtensionVerify')?.addEventListener('click', async () => {
    const status = document.getElementById('extensionStatus');
    status.textContent = 'Kontrol ediliyor...';
    status.className = 'extension-status';
    const r = await window.app?.extensionVerifyInstall?.();
    if (r?.ok) {
      status.textContent = '✓ ' + (r.message || 'Kurulum tamam.');
      status.className = 'extension-status success';
      notify('Kurulum doğrulandı');
    } else {
      status.textContent = '✗ ' + (r.message || r.checks?.join('; ') || 'Kurulum eksik');
      status.className = 'extension-status error';
    }
  });
  document.getElementById('extensionIdInput')?.addEventListener('input', (e) => {
    localStorage.setItem('vault_extensionId', (e.target?.value || '').trim());
  });
  document.getElementById('btnOpenExtensionFolder')?.addEventListener('click', () => {
    window.app?.extensionOpenFolder?.();
    notify('Eklenti klasörü açıldı');
  });
  document.getElementById('savePasswordModalClose')?.addEventListener('click', closeSavePasswordModal);
  document.getElementById('savePasswordCancel')?.addEventListener('click', closeSavePasswordModal);
  document.getElementById('savePasswordConfirm')?.addEventListener('click', confirmSavePassword);
  document.getElementById('savePasswordModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'savePasswordModal') closeSavePasswordModal();
  });
  document.getElementById('savePasswordToggle')?.addEventListener('click', () => {
    const previewEl = document.getElementById('savePasswordPreview');
    const toggleIcon = document.getElementById('savePasswordToggle')?.querySelector('i');
    if (!pendingSavePassword || !previewEl) return;
    if (previewEl.textContent === '••••••••') {
      previewEl.textContent = pendingSavePassword.password;
      if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'eye-off');
    } else {
      previewEl.textContent = '••••••••';
      if (toggleIcon) toggleIcon.setAttribute('data-lucide', 'eye');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
  document.getElementById('changePwModalClose')?.addEventListener('click', closeChangeMasterPwModal);
  document.getElementById('changePwCancel')?.addEventListener('click', closeChangeMasterPwModal);
  document.getElementById('changePwSubmit')?.addEventListener('click', submitChangeMasterPw);
  document.getElementById('changeMasterPwModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'changeMasterPwModal') closeChangeMasterPwModal();
  });
  document.getElementById('changePwConfirm')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitChangeMasterPw();
  });
  document.getElementById('notesSearchInput')?.addEventListener('input', (e) => {
    state.notesSearch = e.target.value;
    renderNotes(state.notesSearch);
  });

  const maxIcon = document.getElementById('winMaximizeIcon');
  window.windowControls?.onMaximized?.(() => {
    if (maxIcon) { maxIcon.setAttribute('data-lucide', 'minimize-2'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
  });
  window.windowControls?.onUnmaximized?.(() => {
    if (maxIcon) { maxIcon.setAttribute('data-lucide', 'square'); if (typeof lucide !== 'undefined') lucide.createIcons(); }
  });

  document.getElementById('btnUploadFile')?.addEventListener('click', uploadFile);
  document.getElementById('btnUploadFileFromEmpty')?.addEventListener('click', uploadFile);
  document.getElementById('filesDragZone')?.addEventListener('click', uploadFile);
  document.getElementById('btnClearAuditLogs')?.addEventListener('click', clearAuditLogs);
  document.getElementById('btnScanBreaches')?.addEventListener('click', scanBreaches);
  document.getElementById('btnBenchmarkPbdkf2')?.addEventListener('click', runPbdkf2Benchmark);

  ['mousemove', 'mousedown', 'keydown', 'scroll', 'click'].forEach(ev => {
    document.addEventListener(ev, () => resetInactivityTimer(), { passive: true });
  });
});

/* ——— Şifreli Dosya Kasası ve Güvenlik Günlüğü ——— */
async function loadFiles() {
  try {
    state.attachments = (await window.vault?.getAttachments()) || [];
  } catch (e) {
    console.error('loadFiles:', e);
    state.attachments = [];
  }
  renderFiles();
}

function renderFiles() {
  const list = document.getElementById('filesList');
  const empty = document.getElementById('filesEmpty');
  if (!list) return;
  list.innerHTML = '';
  
  if (state.attachments.length === 0) {
    list.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }
  
  list.style.display = 'block';
  if (empty) empty.style.display = 'none';
  
  state.attachments.forEach(file => {
    const row = document.createElement('div');
    row.className = 'file-row';
    const kb = (file.size / 1024).toFixed(1);
    const date = formatDate(file.createdAt);
    
    row.innerHTML = `
      <div class="file-row-ico">📄</div>
      <div class="file-row-info">
        <div class="file-row-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="file-row-meta">${kb} KB · ${date}</div>
      </div>
      <div class="file-row-actions">
        <button class="file-btn" data-action="download" data-id="${file.id}" title="Dosyayı indir"><i data-lucide="download"></i></button>
        <button class="file-btn danger" data-action="delete" data-id="${file.id}" title="Dosyayı sil"><i data-lucide="trash-2"></i></button>
      </div>
    `;
    
    row.querySelector('[data-action="download"]').addEventListener('click', () => downloadFile(file.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteFile(file.id));
    
    list.appendChild(row);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function uploadFile() {
  try {
    const res = await window.vault?.saveAttachment();
    if (res?.ok) {
      notify('Dosya şifrelendi ve kaydedildi');
      await loadFiles();
    } else if (res?.error) {
      notify('Hata: ' + res.error);
    }
  } catch (e) {
    console.error('uploadFile:', e);
    notify('Yükleme hatası');
  }
}

async function downloadFile(id) {
  try {
    const res = await window.vault?.downloadAttachment(id);
    if (res?.ok) {
      notify('Dosya başarıyla deşifre edildi ve kaydedildi');
    } else if (res?.error) {
      notify('Hata: ' + res.error);
    }
  } catch (e) {
    console.error('downloadFile:', e);
    notify('İndirme hatası');
  }
}

async function deleteFile(id) {
  if (!confirm('Bu dosyayı silmek istediğinize emin misiniz? Şifrelenmiş dosya diskten kalıcı olarak silinecektir.')) return;
  try {
    const res = await window.vault?.deleteAttachment(id);
    if (res?.ok) {
      notify('Dosya silindi');
      await loadFiles();
    } else {
      notify('Silme hatası');
    }
  } catch (e) {
    console.error('deleteFile:', e);
    notify('Silme hatası');
  }
}

async function loadAuditLogs() {
  const container = document.getElementById('auditLogList');
  if (!container) return;
  container.innerHTML = '';
  
  try {
    const logs = (await window.vault?.getLogs()) || [];
    if (logs.length === 0) {
      container.innerHTML = '<div class="report-empty" style="padding: 12px;">Henüz kayıt yok</div>';
      return;
    }
    
    const reversed = [...logs].reverse();
    container.innerHTML = reversed.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = formatDate(log.timestamp);
      return `
        <div class="audit-log-row">
          <div>
            <span class="audit-log-action">${escapeHtml(log.action)}</span>
            <span class="audit-log-details">${escapeHtml(log.details || '')}</span>
          </div>
          <span class="audit-log-time">${date} ${time}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('loadAuditLogs:', e);
    container.innerHTML = '<div class="report-empty" style="padding: 12px; color: var(--k-danger)">Loglar yüklenemedi</div>';
  }
}

async function clearAuditLogs() {
  if (!confirm('Tüm güvenlik günlüğü geçmişini temizlemek istediğinize emin misiniz?')) return;
  try {
    const res = await window.vault?.clearLogs();
    if (res) {
      notify('Günlük geçmişi temizlendi');
      await loadAuditLogs();
    } else {
      notify('Hata oluştu');
    }
  } catch (e) {
    console.error('clearAuditLogs:', e);
    notify('Hata oluştu');
  }
}
