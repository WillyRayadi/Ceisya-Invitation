(function () {
  'use strict';

  // ---------- Util ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  function formatDateFull(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return `${d.getDate()} • ${d.getMonth() + 1} • ${d.getFullYear()}`;
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  // ---------- State ----------
  let settings = null;
  let musicPlaying = false;

  const guestName = new URLSearchParams(location.search).get('to') || '';
  if (guestName) {
    document.title = `Undangan untuk ${guestName}`;
    const to = $('#coverTo');
    to.innerHTML = '';
    to.append('Kepada Yth. Bapak/Ibu/Saudara/i');
    const strong = document.createElement('strong');
    strong.textContent = guestName;
    to.appendChild(strong);
  }

  // ---------- Render ----------
  function bgStyle(url) {
    return url ? `url("${url}") center/cover no-repeat` : '';
  }

  function applySettings(s) {
    settings = s;

    // Tema
    const themeId = String(s.theme || 'midnight').replace(/[^a-z0-9-]/gi, '') || 'midnight';
    document.body.className = 'theme-' + themeId;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.content = getComputedStyle(document.body).getPropertyValue('--theme-color').trim() || '#b76e79';
    }

    // Cover
    if (s.cover.background) $('#coverBg').style.background = bgStyle(s.cover.background);
    $('#coverTitle').textContent = s.cover.title || 'The Wedding of';
    $('#groomName').textContent = s.couple.groom.name || '';
    $('#brideName').textContent = s.couple.bride.name || '';
    if (s.cover.showDate) {
      $('#coverDate').textContent = formatDateShort(s.events.akad.date) || '';
    } else {
      $('#coverDate').style.display = 'none';
    }

    // Hero
    $('#heroSub').textContent = s.cover.title || 'The Wedding of';
    $('#heroGroom').textContent = s.couple.groom.fullName || s.couple.groom.name;
    $('#heroBride').textContent = s.couple.bride.fullName || s.couple.bride.name;
    $('#heroDate').textContent = formatDateFull(s.events.akad.date) || '';
    $('#heroQuote').innerHTML = '';

    // Couple
    const gPhoto = $('#groomPhoto');
    const bPhoto = $('#bridePhoto');
    gPhoto.style.background = s.couple.groom.photo ? bgStyle(s.couple.groom.photo) : '';
    bPhoto.style.background = s.couple.bride.photo ? bgStyle(s.couple.bride.photo) : '';
    if (s.couple.groom.photo) gPhoto.querySelector('.photo-placeholder').style.display = 'none';
    if (s.couple.bride.photo) bPhoto.querySelector('.photo-placeholder').style.display = 'none';
    $('#groomFullName').textContent = s.couple.groom.fullName || s.couple.groom.name;
    $('#brideFullName').textContent = s.couple.bride.fullName || s.couple.bride.name;
    $('#groomParents').textContent = s.couple.groom.parents || '';
    $('#brideParents').textContent = s.couple.bride.parents || '';
    const gIg = $('#groomIg');
    const bIg = $('#brideIg');
    if (s.couple.groom.instagram) { gIg.textContent = '@' + s.couple.groom.instagram; gIg.href = 'https://instagram.com/' + s.couple.groom.instagram; }
    else gIg.style.display = 'none';
    if (s.couple.bride.instagram) { bIg.textContent = '@' + s.couple.bride.instagram; bIg.href = 'https://instagram.com/' + s.couple.bride.instagram; }
    else bIg.style.display = 'none';
    $('#coupleQuote').textContent = s.couple.quote || '';
    $('#coupleQuoteSource').textContent = s.couple.quoteSource || '';
    $('#invitationText').textContent = s.cover.invitation || '';

    // Events
    renderEvent('#eventAkad', s.events.akad);
    renderEvent('#eventResepsi', s.events.resepsi);

    // Countdown
    if (s.countdown.active && s.events.akad.date) {
      $('#countdownTitle').textContent = s.countdown.title || 'Menuju Hari Bahagia';
      startCountdown(s.events.akad.date + (s.events.akad.time ? 'T' + s.events.akad.time.replace('.', ':').split(' ')[0] : ''));
    } else {
      $('#countdown').closest('section').classList.add('hidden');
    }

    // Gallery
    if (s.gallery && s.gallery.length) {
      const wrap = $('#galleryScroll');
      wrap.innerHTML = '';
      s.gallery.forEach((url) => {
        const img = document.createElement('img');
        img.className = 'gallery-item';
        img.src = url;
        img.alt = 'Foto galeri';
        img.loading = 'lazy';
        wrap.appendChild(img);
      });
      $('#gallery').classList.remove('hidden');
    }

    // Music
    const music = s.music || {};
    if (music.url) {
      const audio = $('#bgMusic');
      audio.src = music.url;
      $('#musicBtn').classList.remove('hidden');
      if (music.autoplay) {
        // Mulai setelah cover dibuka (kebijakan autoplay browser)
        window._autoplayMusic = true;
      }
    }

    // Bank / Kirim hadiah
    const bank = s.bank || {};
    let accounts = [];
    try {
      accounts = typeof bank.accounts === 'string' ? JSON.parse(bank.accounts || '[]') : (bank.accounts || []);
    } catch (err) { accounts = []; }
    if (bank.active && accounts.length) {
      $('#giftTitle').textContent = bank.title || 'Kirim Hadiah / Kado Digital';
      $('#giftNote').textContent = bank.note || '';
      const wrap = $('#giftList');
      wrap.innerHTML = '';
      
      // Prioritaskan logo yang diupload dari admin, jika tidak ada barulah coba dari external
      
      accounts.forEach((acc) => {
        const card = document.createElement('div');
        card.className = 'gift-card';
        
        const bankLogo = document.createElement('img');
        bankLogo.className = 'gift-bank-logo';
        bankLogo.alt = acc.bank || 'Bank';
        
        // Cek logo yang diupload dari admin dashboard (prioritas utama)
        const bankNameClean = (acc.bank || 'Bank').trim();
        let logoUrl = acc.logo || null; // Logo yang diupload
        
        // Jika tidak ada logo upload, coba cari dari external URL
        if (!logoUrl) {
          // Map nama bank ke logo external sebagai fallback
          const bankFallbackLogos = {
            'bca': 'https://www.bca.co.id/sites/default/files/BCA%20Logo%201.jpg',
            'mandiri': 'https://www.bankmandiri.co.id/sites/default/files/Logo%20Mandiri%20Horizontal%201.png',
            'bni': 'https://www.bni.co.id/files/bni3.png',
            'bri': 'https://www.bri.co.id/sites/default/files/Logo_Bri.png',
            'cimb': 'https://logo.clearbit.com/cimb.com',
            'mayabank': 'https://logo.clearbit.com/mayabank.co.id',
            'danamon': 'https://logo.clearbit.com/danamon.co.id',
          };
          
          for (const [key, url] of Object.entries(bankFallbackLogos)) {
            if (bankNameClean.toLowerCase().includes(key)) {
              logoUrl = url;
              break;
            }
          }
          
          // Jika masih tidak ada, coba format umum
          if (!logoUrl && bankNameClean && bankNameClean !== 'Bank') {
            logoUrl = `https://logo.clearbit.com/${bankNameClean.toLowerCase().replace(/\s+/g, '')}.com`;
          }
        }
        
        if (logoUrl) {
          bankLogo.src = logoUrl;
          bankLogo.onerror = function() {
            // Jika gagal load logo (termasuk logo upload yang rusak), tampilkan emoji
            this.style.display = 'none';
            // Tambahkan emoji di depan nama bank
            if (bankNameClean.toLowerCase().includes('bca')) {
              bankName.textContent = '🏦 ' + bankNameClean;
            } else if (bankNameClean.toLowerCase().includes('mandiri')) {
              bankName.textContent = '🌳 ' + bankNameClean;
            } else if (bankNameClean.toLowerCase().includes('bni')) {
              bankName.textContent = '🏛️ ' + bankNameClean;
            } else if (bankNameClean.toLowerCase().includes('bri')) {
              bankName.textContent = '🏡 ' + bankNameClean;
            } else {
              bankName.textContent = '🏦 ' + bankNameClean;
            }
          };
          bankLogo.onload = function() {
            this.style.display = 'block';
          };
        } else {
          bankLogo.style.display = 'none';
        }
        
        const bankName = document.createElement('p');
        bankName.className = 'gift-bank';
        bankName.textContent = acc.bank || 'Bank';
        
        const numRow = document.createElement('div');
        numRow.className = 'gift-number-row';
        const numText = document.createElement('span');
        numText.className = 'gift-number';
        numText.textContent = acc.number || '-';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-copy';
        copyBtn.textContent = 'Salin';
        copyBtn.dataset.copy = acc.number || '';
        numRow.append(numText, copyBtn);
        
        const holder = document.createElement('p');
        holder.className = 'gift-holder';
        holder.textContent = 'a.n. ' + (acc.holder || '-');
        
        card.append(bankLogo, bankName, numRow, holder);
        wrap.appendChild(card);
      });
      $('#gift').classList.remove('hidden');
    }

    // Footer
    $('#footerQuote').textContent = s.footer.quote || '';
    $('#footerThanks').textContent = s.footer.thankYou || '';
    $('#footerNames').textContent = s.footer.names || '';
  }

  // ---------- Salin nomor rekening ----------
  $('#giftList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn || !btn.dataset.copy) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast('Nomor rekening disalin ✅');
    } catch (err) {
      toast('Gagal menyalin nomor rekening');
    }
  });

  function renderEvent(sel, ev) {
    const card = $(sel);
    card.querySelector('.event-title').textContent = ev.title || '';
    card.querySelector('.event-date').textContent = formatDateFull(ev.date) || '';
    card.querySelector('.event-time').textContent = ev.time || '';
    card.querySelector('.event-location').textContent = ev.location || '';
    card.querySelector('.event-address').textContent = ev.address || '';
    const maps = card.querySelector('.btn-maps');
    if (ev.mapsUrl) { maps.href = ev.mapsUrl; }
    else { maps.style.display = 'none'; }
  }

  // ---------- Countdown ----------
  function startCountdown(target) {
    const end = new Date(target);
    if (isNaN(end)) return;
    const tick = () => {
      const diff = end - new Date();
      if (diff <= 0) {
        $('#cdDays').textContent = '00'; $('#cdHours').textContent = '00';
        $('#cdMinutes').textContent = '00'; $('#cdSeconds').textContent = '00';
        return;
      }
      $('#cdDays').textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
      $('#cdHours').textContent = String(Math.floor(diff / 3600000) % 24).padStart(2, '0');
      $('#cdMinutes').textContent = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
      $('#cdSeconds').textContent = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Musik ----------
  function toggleMusic() {
    const audio = $('#bgMusic');
    if (!audio.src) return;
    if (musicPlaying) {
      audio.pause();
      $('#musicBtn').classList.remove('playing');
    } else {
      audio.play().catch(() => toast('Klik sekali lagi untuk memutar musik'));
      $('#musicBtn').classList.add('playing');
    }
    musicPlaying = !musicPlaying;
  }
  $('#musicBtn').addEventListener('click', toggleMusic);

  function startMusic() {
    if (!window._autoplayMusic) return;
    const audio = $('#bgMusic');
    if (!audio.src) return;
    audio.play().then(() => {
      musicPlaying = true;
      $('#musicBtn').classList.add('playing');
    }).catch(() => { /* browser menolak autoplay — biarkan pengguna menekan tombol */ });
  }

  // ---------- Cover ----------
  // Ketika klik "Buka Undangan" — tutup cover & tampilkan konten
  $('#btnOpen').addEventListener('click', () => {
    $('#cover').classList.add('closed');
    $('#content').classList.remove('hidden');
    $('#navDots').classList.remove('hidden');
    startMusic();
    observeSections();
  });

  // ---------- Nav dots ----------
  const sections = $$('.section');
  const navDots = $('#navDots');

  sections.forEach((sec, i) => {
    const dot = document.createElement('button');
    dot.title = sec.id;
    dot.addEventListener('click', () => sec.scrollIntoView({ behavior: 'smooth' }));
    navDots.appendChild(dot);
  });

  function observeSections() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const idx = sections.indexOf(e.target);
          $$('#navDots button').forEach((d, i) => d.classList.toggle('active', i === idx));
        }
      });
    }, { threshold: 0.15 });
    sections.forEach((s) => io.observe(s));
  }

  // ---------- RSVP ----------
  $('#rsvpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#rsvpMsg');
    const btn = $('#rsvpForm .btn');
    const name = $('#rsvpName').value.trim();
    const attendance = document.querySelector('input[name="attendance"]:checked').value;
    const guests = parseInt($('#rsvpGuests').value, 10) || 1;
    const message = $('#rsvpMessage').value.trim();

    if (!name) { msg.textContent = 'Nama wajib diisi'; msg.className = 'form-msg err'; return; }

    btn.disabled = true;
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, attendance, guests, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim');
      msg.textContent = 'Terima kasih! Konfirmasi kamu sudah kami terima. 🙏';
      msg.className = 'form-msg ok';
      $('#rsvpForm').reset();
      if (message) loadWishes();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg err';
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Ucapan ----------
  $('#wishForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#wishMsg');
    const btn = $('#wishForm .btn');
    const name = $('#wishName').value.trim();
    const message = $('#wishMessage').value.trim();
    if (!name || !message) { msg.textContent = 'Nama dan ucapan wajib diisi'; msg.className = 'form-msg err'; return; }

    btn.disabled = true;
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim');
      msg.textContent = data.approved ? 'Ucapan terkirim! Terima kasih 💐' : 'Ucapan terkirim dan menunggu persetujuan. Terima kasih 💐';
      msg.className = 'form-msg ok';
      $('#wishForm').reset();
      loadWishes();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'form-msg err';
    } finally {
      btn.disabled = false;
    }
  });

  function renderWishes(list) {
    const wrap = $('#wishList');
    wrap.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'wish-empty';
      p.textContent = 'Belum ada ucapan. Jadilah yang pertama! 💌';
      wrap.appendChild(p);
      return;
    }
    list.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'wish-card';
      const name = document.createElement('p');
      name.className = 'wish-name';
      name.textContent = w.name;
      const text = document.createElement('p');
      text.className = 'wish-text';
      text.textContent = w.message;
      const date = document.createElement('p');
      date.className = 'wish-date';
      date.textContent = new Date(w.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      card.append(name, text, date);
      wrap.appendChild(card);
    });
  }

  async function loadWishes() {
    try {
      const res = await fetch('/api/wishes');
      const list = await res.json();
      renderWishes(list);
    } catch (err) { /* diam saja */ }
  }

  // ---------- Bagikan & QR ----------
  async function loadQr() {
    try {
      const res = await fetch('/api/qrcode?text=' + encodeURIComponent(location.href) + '&size=256');
      const data = await res.json();
      $('#shareQr').src = data.dataUrl;
    } catch (err) { /* diam */ }
  }

  $('#btnShare').addEventListener('click', async () => {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Undangan Pernikahan', text: 'Buka undangan kami!', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link undangan disalin ✅');
    } catch (err) {
      if (err.name !== 'AbortError') toast('Gagal menyalin link');
    }
  });
  $('#shareUrl').textContent = location.href;

  // ---------- Init ----------
  async function init() {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      applySettings(s);
      loadWishes();
      loadQr();
    } catch (err) {
      toast('Gagal memuat data undangan');
    }
  }

  init();
})();