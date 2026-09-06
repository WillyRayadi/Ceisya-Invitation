(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let settings = null;
  let currentRsvpFilter = 'all';

  function msg(el, text, ok) {
    el.textContent = text;
    el.className = 'form-msg ' + (ok ? 'ok' : 'err');
  }

  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Permintaan gagal');
    return data;
  }

  // ---------- Auth ----------
  async function checkAuth() {
    try {
      const me = await api('/api/admin/me');
      if (me.admin) showDashboard();
      else showLogin();
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    $('#loginScreen').classList.remove('hidden');
    $('#dashboard').classList.add('hidden');
  }
  function showDashboard() {
    $('#loginScreen').classList.add('hidden');
    $('#dashboard').classList.remove('hidden');
    loadSummary();
    loadSettings();
    loadRsvps();
    loadWishes();
    loadGallery();
    initQr();
    checkServerVersion();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#loginMsg');
    const btn = $('#loginForm .btn');
    btn.disabled = true;
    try {
      await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: $('#loginUsername').value.trim(),
          password: $('#loginPassword').value 
        }),
      });
      m.textContent = '';
      showDashboard();
    } catch (err) {
      msg(m, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('#btnLogout').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // ---------- Navigasi tab ----------
  $('#sidebarNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
    $$('.tab-panel').forEach((p) => p.classList.remove('active'));
    $('#tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'summary') loadSummary();
  });

  // ---------- Ringkasan ----------
  async function loadSummary() {
    try {
      const s = await api('/api/summary');
      $('#stTotalRsvp').textContent = s.totalRsvp;
      $('#stHadir').textContent = s.hadir;
      $('#stTidak').textContent = s.tidakHadir;
      $('#stTotalTamu').textContent = s.totalTamu;
      $('#stPending').textContent = s.wishesPending;
    } catch (err) { /* diam */ }
  }

  // ---------- Pengaturan ----------
  async function loadSettings() {
    try {
      settings = await api('/api/settings');
      fillForm(settings);
      syncPhotoFields();
      syncMusicField();
      syncThemePicker();
      syncBankFromSettings();
      updateShareLink();
      // Isi default QR dengan URL undangan
      $('#qrText').value = location.origin + '/';
    } catch (err) {
      msg($('#settingsMsg'), 'Gagal memuat pengaturan: ' + err.message);
    }
  }

  // ---------- Upload foto mempelai ----------
  const PHOTO_FIELDS = [
    { input: '#coverBgInput', preview: '#coverBgPreview', ph: '#coverBgPh', hiddenName: 'cover.background' },
    { input: '#groomPhotoInput', preview: '#groomPhotoPreview', ph: '#groomPhotoPh', hiddenName: 'couple.groom.photo' },
    { input: '#bridePhotoInput', preview: '#bridePhotoPreview', ph: '#bridePhotoPh', hiddenName: 'couple.bride.photo' },
  ];

  $('#settingsForm').addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const input = $('#' + pick.dataset.pick);
      if (input) input.click();
      return;
    }
    const clear = e.target.closest('[data-clear-photo]');
    if (clear) {
      document.querySelector('[name="' + clear.dataset.clearPhoto + '"]').value = '';
      syncPhotoFields();
    }
  });

  function syncPhotoFields() {
    PHOTO_FIELDS.forEach((f) => {
      const url = document.querySelector('[name="' + f.hiddenName + '"]').value || '';
      const preview = $(f.preview);
      const ph = $(f.ph);
      const clearBtn = document.querySelector('[data-clear-photo="' + f.hiddenName + '"]');
      if (url) {
        preview.src = url;
        preview.classList.remove('hidden');
        ph.classList.add('hidden');
        clearBtn.classList.remove('hidden');
      } else {
        preview.classList.add('hidden');
        preview.removeAttribute('src');
        ph.classList.remove('hidden');
        clearBtn.classList.add('hidden');
      }
    });
  }

  PHOTO_FIELDS.forEach((f) => {
    $(f.input).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const m = $('#settingsMsg');
      m.textContent = 'Mengunggah foto...';
      m.className = 'form-msg';
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await api('/api/upload', { method: 'POST', body: fd });
        document.querySelector('[name="' + f.hiddenName + '"]').value = res.url;
        syncPhotoFields();
        msg(m, 'Foto berhasil diunggah. Klik "Simpan Pengaturan" untuk menyimpan ✅', true);
      } catch (err) {
        msg(m, err.message);
      } finally {
        e.target.value = '';
      }
    });
  });

  // ---------- Upload musik MP3 ----------
  $('#btnChooseMusic').addEventListener('click', () => $('#musicInput').click());

  $('#musicInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const m = $('#settingsMsg');
    m.textContent = 'Mengunggah musik...';
    m.className = 'form-msg';
    try {
      const fd = new FormData();
      fd.append('music', file);
      const res = await api('/api/upload/music', { method: 'POST', body: fd });
      document.querySelector('[name="music.url"]').value = res.url;
      syncMusicField();
      msg(m, 'Musik berhasil diunggah. Klik "Simpan Pengaturan" untuk menyimpan ✅', true);
    } catch (err) {
      msg(m, err.message);
    } finally {
      e.target.value = '';
    }
  });

  $('#btnRemoveMusic').addEventListener('click', () => {
    document.querySelector('[name="music.url"]').value = '';
    syncMusicField();
  });

  function syncMusicField() {
    const url = document.querySelector('[name="music.url"]').value || '';
    const audio = $('#musicPreview');
    const btn = $('#btnRemoveMusic');
    if (url) {
      audio.src = url;
      audio.classList.remove('hidden');
      btn.classList.remove('hidden');
    } else {
      audio.classList.add('hidden');
      audio.removeAttribute('src');
      btn.classList.add('hidden');
    }
  }

  // ---------- Deteksi versi server ----------
  // Server lama (belum di-restart) tidak punya endpoint ini / versi lama,
  // sehingga tema, upload musik, dan fitur baru tidak akan tersimpan.
  const SERVER_VERSION = 3;
  async function checkServerVersion() {
    try {
      const v = await api('/api/version');
      if (v.version !== SERVER_VERSION) $('#restartWarn').classList.remove('hidden');
      if (v.persistent === true) {
        $('#storageOk').classList.remove('hidden');
      } else {
        $('#storageWarn').classList.remove('hidden');
      }
    } catch (err) {
      $('#restartWarn').classList.remove('hidden');
    }
  }

  // ---------- Rekening bank / kirim hadiah ----------
  let bankAccounts = [];

  function parseBankAccounts() {
    const raw = document.querySelector('[name="bank.accounts"]').value || '[]';
    try {
      const arr = JSON.parse(raw);
      bankAccounts = Array.isArray(arr) ? arr : [];
    } catch (err) {
      bankAccounts = [];
    }
  }

  function syncBankInput() {
    document.querySelector('[name="bank.accounts"]').value = JSON.stringify(bankAccounts);
  }

  function syncBankFromSettings() {
    parseBankAccounts();
    renderBankList();
  }

  function renderBankList() {
    const wrap = $('#bankList');
    wrap.innerHTML = '';
    bankAccounts.forEach((acc, i) => {
      const row = document.createElement('div');
      row.className = 'bank-row';
      row.innerHTML = `
        <div class="bank-logo-upload">
          <img src="${escapeHtml(acc.logo || '')}" alt="Logo Bank" class="bank-logo-preview ${acc.logo ? '' : 'hidden'}" />
          <input type="file" accept=".png,.jpg,.jpeg,.svg" class="bank-logo-input hidden" data-bank-logo-index="${i}" />
          <button type="button" class="btn btn-small ${acc.logo ? 'btn-ghost' : ''} bank-upload-btn" data-bank-logo-index="${i}">📁 Logo</button>
          <button type="button" class="btn btn-small btn-danger bank-clear-logo hidden" data-bank-clear-logo="${i}">✕</button>
        </div>
        <input type="text" data-bank-field="bank" placeholder="Nama Bank (mis. BCA)" value="${escapeHtml(acc.bank || '')}" />
        <input type="text" data-bank-field="number" placeholder="Nomor Rekening" value="${escapeHtml(acc.number || '')}" />
        <input type="text" data-bank-field="holder" placeholder="Atas Nama" value="${escapeHtml(acc.holder || '')}" />
        <button type="button" class="btn btn-small btn-danger" data-del-bank="${i}">✕</button>
      `;
      wrap.appendChild(row);
    });
    syncBankInput();
  }

  $('#bankList').addEventListener('input', (e) => {
    const field = e.target.closest('[data-bank-field]');
    if (!field) return;
    const row = field.closest('.bank-row');
    const idx = Array.from(row.parentNode.children).indexOf(row);
    if (bankAccounts[idx]) bankAccounts[idx][field.dataset.bankField] = field.value;
    syncBankInput();
  });

  $('#bankList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del-bank]');
    if (btn) {
      bankAccounts.splice(Number(btn.dataset.delBank), 1);
      renderBankList();
      return;
    }
    
    const uploadBtn = e.target.closest('.bank-upload-btn');
    if (uploadBtn) {
      const index = Number(uploadBtn.dataset.bankLogoIndex);
      const row = getBankRow(index);
      if (row) {
        const input = row.querySelector(`input[data-bank-logo-index="${index}"]`);
        if (input) input.click();
      }
      return;
    }
    
    const clearBtn = e.target.closest('[data-bank-clear-logo]');
    if (clearBtn) {
      const index = Number(clearBtn.dataset.bankClearLogo);
      if (bankAccounts[index]) {
        bankAccounts[index].logo = '';
        renderBankList();
      }
      return;
    }
  });
  
  $('#bankList').addEventListener('change', (e) => {
    const fileInput = e.target.closest('.bank-logo-input');
    if (!fileInput) return;
    
    const file = e.target.files[0];
    if (!file) return;
    
    const index = Number(fileInput.dataset.bankLogoIndex);
    const msgEl = $('#settingsMsg');
    msgEl.textContent = 'Mengunggah logo bank...';
    msgEl.className = 'form-msg';
    
    const fd = new FormData();
    fd.append('image', file);
    
    api('/api/upload', { method: 'POST', body: fd })
      .then((res) => {
        if (bankAccounts[index]) {
          bankAccounts[index].logo = res.url;
          renderBankList();
          msg(msgEl, 'Logo bank berhasil diunggah ✅', true);
        }
      })
      .catch((err) => {
        msg(msgEl, err.message, false);
      })
      .finally(() => {
        e.target.value = '';
      });
  });
  
  function getBankRow(index) {
    const rows = $('#bankList').querySelectorAll('.bank-row');
    return rows[index];
  }

  $('#btnAddBank').addEventListener('click', () => {
    bankAccounts.push({ bank: '', number: '', holder: '' });
    renderBankList();
  });

  // ---------- Pilihan tema ----------
  const THEMES = [
    { id: 'midnight', name: 'Midnight Gold ⭐', desc: 'Paling premium — hitam elegan berpadu emas', swatch: 'linear-gradient(160deg, #161310 0%, #262019 45%, #0f0d0a 100%)', accent: '#c9a24b' },
    { id: 'rose', name: 'Rose Classic', desc: 'Klasik rose & gold yang lembut', swatch: 'linear-gradient(160deg, #f7efe9 0%, #fdfbf7 55%, #f3e3dd 100%)', accent: '#b76e79' },
    { id: 'emerald', name: 'Emerald Royale', desc: 'Hijau zamrud mewah berpadu emas', swatch: 'linear-gradient(160deg, #eef0e6 0%, #faf9f4 55%, #e2e8da 100%)', accent: '#1e6b52' },
    { id: 'sakura', name: 'Sakura Blush', desc: 'Nuansa pink lembut nan romantis', swatch: 'linear-gradient(160deg, #fbeef2 0%, #fdf7f9 55%, #f7dfe9 100%)', accent: '#d9789a' },
    { id: 'ocean', name: 'Ocean Serenity', desc: 'Biru laut segar yang menenangkan', swatch: 'linear-gradient(160deg, #e8f2f4 0%, #f6fafb 55%, #d9eaee 100%)', accent: '#2f8a9d' },
    { id: 'terra', name: 'Terra Boho', desc: 'Terracotta hangat bernuansa boho', swatch: 'linear-gradient(160deg, #f3e9dd 0%, #faf6f0 55%, #ecdcc8 100%)', accent: '#b96a3d' },
    { id: 'slate', name: 'Slate Elegance ✨', desc: 'Putih bersih + aksen biru baja elegan (ala Diana & Rio)', swatch: 'linear-gradient(160deg, #f7f7f6 0%, #fdfdfc 55%, #e8ecef 100%)', accent: '#6d869e' },
  ];

  function renderThemePicker() {
    const wrap = $('#themePicker');
    wrap.innerHTML = '';
    THEMES.forEach((t) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-card';
      card.dataset.theme = t.id;
      card.innerHTML = `
        <span class="theme-swatch" style="background:${t.swatch};box-shadow:inset 0 0 0 3px ${t.accent};"></span>
        <span class="theme-name">${t.name}</span>
        <span class="theme-desc">${t.desc}</span>
      `;
      wrap.appendChild(card);
    });
  }

  function syncThemePicker() {
    const val = document.querySelector('[name="theme"]').value || 'midnight';
    $$('.theme-card').forEach((c) => c.classList.toggle('active', c.dataset.theme === val));
  }

  $('#themePicker').addEventListener('click', (e) => {
    const card = e.target.closest('.theme-card');
    if (!card) return;
    document.querySelector('[name="theme"]').value = card.dataset.theme;
    syncThemePicker();
  });

  // ---------- Bagikan undangan ke tamu ----------
  function shareBaseUrl() {
    const v = (document.querySelector('[name="share.baseUrl"]').value || '').trim();
    return v || location.origin + '/';
  }

  function updateShareLink() {
    const base = shareBaseUrl();
    const name = ($('#shareGuestName').value || '').trim();
    let url = base;
    if (name) {
      const sep = base.includes('?') ? '&' : (base.endsWith('/') ? '?' : '/?');
      url = base + sep + 'to=' + encodeURIComponent(name);
    }
    $('#shareGenerated').value = url;
    const qr = $('#shareGenQr');
    qr.classList.toggle('hidden', !url);
    if (!url) return;
    fetch('/api/qrcode?text=' + encodeURIComponent(url) + '&size=180')
      .then((r) => r.json())
      .then((d) => { if (d.dataUrl) qr.src = d.dataUrl; })
      .catch(() => {});
  }

  let shareTimer;
  $('#shareGuestName').addEventListener('input', () => {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(updateShareLink, 400);
  });
  document.querySelector('[name="share.baseUrl"]').addEventListener('input', () => {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(updateShareLink, 400);
  });

  $('#btnCopyShare').addEventListener('click', async () => {
    const url = $('#shareGenerated').value;
    const m = $('#shareMsg');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      msg(m, 'Link personal berhasil disalin ✅', true);
    } catch (err) {
      msg(m, 'Gagal menyalin otomatis. Silakan salin manual dari kolom di atas.');
    }
  });  renderThemePicker();
  
  // ---------- Import Data Tamu dari Excel ----------
  let importedGuests = [];
  
  // Cek jika ada data tamu yang tersimpan di sessionStorage
  try {
    const saved = sessionStorage.getItem('importedGuests');
    if (saved) {
      importedGuests = JSON.parse(saved);
      if (importedGuests.length > 0) {
        $('#guestCount').textContent = importedGuests.length;
        renderGuestTable(importedGuests);
        $('#guestListSummary').classList.remove('hidden');
        $('#btnClearGuests').classList.remove('hidden');
      }
    }
  } catch (e) { /* ignore */ }
  
  $('#btnChooseGuestExcel').addEventListener('click', () => $('#guestExcelInput').click());
  
  $('#guestExcelInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msgEl = $('#guestExcelMsg');
    msgEl.textContent = 'Membaca file Excel...';
    msgEl.className = 'form-msg';
    
    const allowedTypes = ['.xlsx', '.xls'];
    const isExcel = allowedTypes.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isExcel) {
      msg(msgEl, 'File harus berupa Excel (.xlsx atau .xls)', false);
      e.target.value = '';
      return;
    }
    
    try {
      const fd = new FormData();
      fd.append('excel', file);
      const res = await api('/api/import-guests', { method: 'POST', body: fd });
      
      importedGuests = res.guests || [];
      
      if (importedGuests.length > 0) {
        // Tampilkan ringkasan data tamu
        $('#guestCount').textContent = importedGuests.length;
        renderGuestTable(importedGuests);
        $('#guestListSummary').classList.remove('hidden');
        $('#btnClearGuests').classList.remove('hidden');
        msg(msgEl, `Berhasil import ${importedGuests.length} tamu dari Excel ✅`, true);
      } else {
        msg(msgEl, 'Tidak ada data tamu yang valid di file Excel. Pastikan kolom: nama, noHp', false);
        $('#guestListSummary').classList.add('hidden');
      }
    } catch (err) {
      msg(msgEl, err.message || 'Gagal membaca file Excel', false);
      $('#guestListSummary').classList.add('hidden');
    } finally {
      e.target.value = '';
    }
  });
  
  function renderGuestTable(guests) {
    const table = $('#guestTableMini');
    table.innerHTML = '';
    guests.slice(0, 10).forEach((g, i) => {
      const row = document.createElement('div');
      row.className = 'guest-row-mini';
      row.innerHTML = `
        <span class="guest-no">${i + 1}</span>
        <span class="guest-name">${escapeHtml(g.nama || g.name || 'Tanpa Nama')}</span>
        <span class="guest-phone">${escapeHtml(g.noHp || g.phone || g.noHp || '-')}</span>
      `;
      table.appendChild(row);
    });
    if (guests.length > 10) {
      const more = document.createElement('div');
      more.className = 'guest-row-mini guest-more';
      more.textContent = `... dan ${guests.length - 10} tamu lainnya`;
      table.appendChild(more);
    }
  }
  
  $('#btnClearGuests').addEventListener('click', () => {
    importedGuests = [];
    $('#guestListSummary').classList.add('hidden');
    $('#guestExcelMsg').textContent = '';
    $('#guestExcelMsg').className = 'form-msg';
    $('#guestExcelInput').value = '';
  });
  
  // ---------- Blast Undangan ke Tamu ----------
  $('#btnBlastInvitations').addEventListener('click', async () => {
    if (importedGuests.length === 0) {
      msg($('#blastMsg'), 'Belum ada data tamu yang diimport. Upload file Excel terlebih dahulu.', false);
      return;
    }
    
    // Simpan ke sessionStorage sebelum blast (untuk menghadapi refresh)
    sessionStorage.setItem('importedGuests', JSON.stringify(importedGuests));
    
    const btn = $('#btnBlastInvitations');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Mengirim... 📤';
    
    try {
      const baseUrl = shareBaseUrl();
      const res = await api('/api/blast-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl,
          guests: importedGuests
        }),
      });
      
      msg($('#blastMsg'), res.message || `Berhasil blast ke ${res.sent} tamu! ${res.failed > 0 ? res.failed + ' gagal.' : 'Semua berhasil ✓'}`, true);
      
      // Reset data tamu setelah blast
      importedGuests = [];
      sessionStorage.removeItem('importedGuests');
      $('#guestListSummary').classList.add('hidden');
      $('#guestExcelMsg').textContent = '';
      $('#guestExcelMsg').className = 'form-msg';
      $('#guestExcelInput').value = '';
    } catch (err) {
      console.error('Blast error:', err);
      msg($('#blastMsg'), 'Gagal melakukan blast: ' + (err.message || 'Unknown error'), false);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
  
  // Debug: tampilkan data yang dikirim
  window.debugBlast = function() {
    console.log('Imported guests:', importedGuests);
    console.log('Base URL:', shareBaseUrl());
  };
  
  renderThemePicker();
  
  function fillForm(obj, prefix) {
    $$('#settingsForm [name]').forEach((el) => {
      const path = el.name.split('.');
      let cur = obj;
      for (const key of path) {
        if (cur == null) break;
        cur = cur[key];
      }
      if (cur == null) return;
      if (el.type === 'checkbox') el.checked = !!cur;
      else if (Array.isArray(cur) || (cur && typeof cur === 'object')) el.value = JSON.stringify(cur);
      else el.value = cur;
    });
  }

  function collectForm() {
    const out = {};
    $$('#settingsForm [name]').forEach((el) => {
      const path = el.name.split('.');
      let obj = out;
      for (let i = 0; i < path.length - 1; i++) {
        obj[path[i]] = obj[path[i]] || {};
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#settingsMsg');
    const btn = $('#settingsForm .btn-primary');
    btn.disabled = true;
    try {
      settings = await api('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectForm()),
      });
      msg(m, 'Pengaturan berhasil disimpan ✅', true);
    } catch (err) {
      msg(m, err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- RSVP ----------
  $('.toolbar').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentRsvpFilter = chip.dataset.filter;
    $$('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    loadRsvps();
  });

  async function loadRsvps() {
    try {
      const list = await api('/api/rsvps');
      const rows = list
        .filter((r) => currentRsvpFilter === 'all' || r.attendance === currentRsvpFilter)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      $('#rsvpEmpty').classList.toggle('hidden', rows.length > 0);
      const body = $('#rsvpBody');
      body.innerHTML = '';
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const status = r.attendance === 'hadir' ? 'Hadir' : 'Tidak Hadir';
        tr.innerHTML = `
          <td><strong>${escapeHtml(r.name)}</strong></td>
          <td><span class="badge ${r.attendance}">${status}</span></td>
          <td>${r.guests || 1}</td>
          <td>${escapeHtml(r.message || '-')}</td>
          <td>${new Date(r.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td><button class="btn btn-small btn-danger" data-del-rsvp="${r.id}">Hapus</button></td>
        `;
        body.appendChild(tr);
      });
    } catch (err) { /* diam */ }
  }

  $('#rsvpBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-rsvp]');
    if (!btn) return;
    if (!confirm('Hapus konfirmasi ini?')) return;
    try {
      await api('/api/rsvps/' + btn.dataset.delRsvp, { method: 'DELETE' });
      loadRsvps();
      loadSummary();
    } catch (err) { alert(err.message); }
  });

  // ---------- Ucapan ----------
  async function loadWishes() {
    try {
      const list = await api('/api/wishes');
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      $('#wishEmpty').classList.toggle('hidden', list.length > 0);
      const wrap = $('#wishAdminList');
      wrap.innerHTML = '';
      list.forEach((w) => {
        const card = document.createElement('div');
        card.className = 'wish-admin-card';
        card.innerHTML = `
          <div class="wish-admin-head">
            <span class="wish-admin-name">${escapeHtml(w.name)}</span>
            <span class="badge ${w.approved ? 'approved' : 'pending'}">${w.approved ? 'Tampil' : 'Menunggu'}</span>
          </div>
          <p class="wish-admin-text">${escapeHtml(w.message)}</p>
          <div class="wish-admin-actions">
            <button class="btn btn-small ${w.approved ? 'btn-ghost' : 'btn-primary'}" data-approve="${w.id}">${w.approved ? 'Sembunyikan' : 'Setujui'}</button>
            <button class="btn btn-small btn-danger" data-del-wish="${w.id}">Hapus</button>
          </div>
          <p class="wish-admin-date">${new Date(w.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        `;
        wrap.appendChild(card);
      });
    } catch (err) { /* diam */ }
  }

  $('#wishAdminList').addEventListener('click', async (e) => {
    const approve = e.target.closest('[data-approve]');
    const del = e.target.closest('[data-del-wish]');
    try {
      if (approve) {
        await api('/api/wishes/' + approve.dataset.approve + '/approve', { method: 'PUT' });
      } else if (del) {
        if (!confirm('Hapus ucapan ini?')) return;
        await api('/api/wishes/' + del.dataset.delWish, { method: 'DELETE' });
      } else {
        return;
      }
      loadWishes();
      loadSummary();
    } catch (err) { alert(err.message); }
  });

  // ---------- Galeri ----------
  async function loadGallery() {
    const grid = $('#galleryAdminGrid');
    grid.innerHTML = '';
    const items = (settings && settings.gallery) || [];
    $('#galleryEmpty').classList.toggle('hidden', items.length > 0);
    items.forEach((url) => {
      const item = document.createElement('div');
      item.className = 'gallery-admin-item';
      item.innerHTML = `<img src="${escapeHtml(url)}" alt="foto galeri" /><button class="remove" data-del-gallery="${escapeHtml(url)}">✕</button>`;
      grid.appendChild(item);
    });
  }

  $('#btnChooseGallery').addEventListener('click', () => $('#galleryInput').click());

  $('#galleryInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const m = $('#galleryMsg');
    m.textContent = 'Mengunggah...';
    m.className = 'form-msg';
    try {
      const newUrls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await api('/api/upload', { method: 'POST', body: fd });
        newUrls.push(res.url);
      }
      settings.gallery = [...(settings.gallery || []), ...newUrls];
      settings = await api('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: settings.gallery }),
      });
      msg(m, newUrls.length + ' foto berhasil diunggah ✅', true);
      loadGallery();
    } catch (err) {
      msg(m, err.message);
    } finally {
      e.target.value = '';
    }
  });

  $('#galleryAdminGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-gallery]');
    if (!btn) return;
    if (!confirm('Hapus foto ini dari galeri?')) return;
    const url = btn.dataset.delGallery;
    settings.gallery = (settings.gallery || []).filter((u) => u !== url);
    try {
      settings = await api('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: settings.gallery }),
      });
      loadGallery();
    } catch (err) { alert(err.message); }
  });

  // ---------- QR ----------
  async function initQr() {
    const text = $('#qrText').value.trim();
    if (!text) return;
    try {
      const data = await api('/api/qrcode?text=' + encodeURIComponent(text) + '&size=512');
      $('#qrPreview').src = data.dataUrl;
      $('#qrMsg').textContent = '';
    } catch (err) {
      msg($('#qrMsg'), err.message);
    }
  }

  let qrTimer;
  $('#qrText').addEventListener('input', () => {
    clearTimeout(qrTimer);
    qrTimer = setTimeout(initQr, 500);
  });

  $('#btnDownloadQr').addEventListener('click', () => {
    const img = $('#qrPreview');
    if (!img.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'undangan-qr.png';
    a.click();
  });

  // ---------- Util ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- Init ----------
  checkAuth();
})();