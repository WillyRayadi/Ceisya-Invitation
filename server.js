const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const store = require('./lib/store');

// Untuk parsing Excel
let XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.warn('xlsx not installed, Excel import will not work'); }

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ---------- Konfigurasi dasar ----------
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Halaman dashboard admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const UPLOAD_DIR = path.join(__dirname, 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.warn('⚠️ Tidak dapat membuat folder uploads:', err.message);
}
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Upload gambar ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Terima berdasarkan MIME ataupun ekstensi (beberapa HP mengirim MIME generic)
    const ok = /^image\//.test(file.mimetype) || /\.(jpg|jpeg|png|gif|webp|jfif|bmp)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan'));
  },
});

// ---------- Upload musik (MP3) ----------
const uploadMusic = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
      cb(null, 'music-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^audio\//.test(file.mimetype) || /\.(mp3|m4a|aac|ogg|wav|flac|opus)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error('Hanya file audio (MP3) yang diperbolehkan'));
  },
});

// ---------- Sesi admin sederhana ----------
const sessions = new Map(); // token -> expiry timestamp

function isAdmin(req) {
  const token = req.cookies && req.cookies.admin_token;
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// Cookie parser manual (tanpa dependency tambahan)
app.use((req, res, next) => {
  const header = req.headers.cookie;
  req.cookies = {};
  if (header) {
    header.split(';').forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        req.cookies[key] = decodeURIComponent(part.slice(idx + 1).trim());
      }
    });
  }
  next();
});

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Tidak diizinkan. Silakan login dahulu.' });
  next();
}

// ---------- API: Settings ----------
app.get('/api/settings', (req, res) => {
  res.json(store.readSettings());
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const current = store.readSettings();
  const next = { ...current, ...req.body };
  // Hanya simpan field yang dikenal agar struktur tidak rusak
  const clean = {
    couple: { ...current.couple, ...(next.couple || {}) },
    cover: { ...current.cover, ...(next.cover || {}) },
    events: { ...current.events, ...(next.events || {}) },
    countdown: { ...current.countdown, ...(next.countdown || {}) },
    music: { ...current.music, ...(next.music || {}) },
    wishes: { ...current.wishes, ...(next.wishes || {}) },
    gallery: Array.isArray(next.gallery) ? next.gallery : current.gallery,
    footer: { ...current.footer, ...(next.footer || {}) },
    theme: typeof next.theme === 'string' ? next.theme : (current.theme || 'rose'),
    share: { ...current.share, ...(next.share || {}) },
    bank: { ...current.bank, ...(next.bank || {}) },
  };
  store.writeSettings(clean);
  res.json(clean);
});

// ---------- API: RSVP ----------
app.get('/api/rsvps', requireAdmin, (req, res) => {
  res.json(store.readRsvps());
});

app.post('/api/rsvp', (req, res) => {
  const { name, attendance, guests, message } = req.body || {};
  const guestCount = Math.max(1, parseInt(guests, 10) || 1);
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nama wajib diisi' });
  }
  if (!['hadir', 'tidak-hadir'].includes(attendance)) {
    return res.status(400).json({ error: 'Status kehadiran tidak valid' });
  }
  const rsvps = store.readRsvps();
  const entry = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 100),
    attendance,
    guests: guestCount,
    message: (message || '').trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  rsvps.push(entry);
  store.writeRsvps(rsvps);
  res.status(201).json(entry);
});

app.delete('/api/rsvps/:id', requireAdmin, (req, res) => {
  const rsvps = store.readRsvps().filter((r) => r.id !== req.params.id);
  store.writeRsvps(rsvps);
  res.json({ ok: true });
});

// ---------- API: Ucapan / Buku Tamu ----------
app.get('/api/wishes', (req, res) => {
  const all = store.readWishes();
  if (isAdmin(req)) return res.json(all);
  const settings = store.readSettings();
  const approved = settings.wishes.autoApprove ? all : all.filter((w) => w.approved);
  res.json(approved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/wishes', (req, res) => {
  const { name, message } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nama wajib diisi' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Ucapan wajib diisi' });
  }
  const settings = store.readSettings();
  const wishes = store.readWishes();
  const entry = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 100),
    message: message.trim().slice(0, 1000),
    approved: !!settings.wishes.autoApprove,
    createdAt: new Date().toISOString(),
  };
  wishes.push(entry);
  store.writeWishes(wishes);
  res.status(201).json(entry);
});

app.put('/api/wishes/:id/approve', requireAdmin, (req, res) => {
  const wishes = store.readWishes();
  const wish = wishes.find((w) => w.id === req.params.id);
  if (!wish) return res.status(404).json({ error: 'Ucapan tidak ditemukan' });
  wish.approved = !wish.approved;
  store.writeWishes(wishes);
  res.json(wish);
});

app.delete('/api/wishes/:id', requireAdmin, (req, res) => {
  const wishes = store.readWishes().filter((w) => w.id !== req.params.id);
  store.writeWishes(wishes);
  res.json({ ok: true });
});

// ---------- API: Upload & Galeri ----------
function handleUpload(mw) {
  return (req, res) => {
    mw(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
      res.status(201).json({ url: '/uploads/' + req.file.filename });
    });
  };
}

app.post('/api/upload', requireAdmin, handleUpload(upload.single('image')));

app.post('/api/upload/music', requireAdmin, handleUpload(uploadMusic.single('music')));

app.delete('/api/uploads/:filename', requireAdmin, (req, res) => {
  const file = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// ---------- API: QR Code ----------
app.get('/api/qrcode', async (req, res) => {
  const text = req.query.text || '';
  if (!text) return res.status(400).json({ error: 'Parameter text wajib diisi' });
  try {
    const dataUrl = await QRCode.toDataURL(String(text).slice(0, 500), {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: Number(req.query.size) || 512,
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.json({ dataUrl });
  } catch (err) {
    res.status(400).json({ error: 'Gagal membuat QR: ' + err.message });
  }
});

// ---------- API: Versi server ----------
// Dipakai admin untuk mendeteksi apakah server perlu di-restart agar fitur baru aktif,
// dan apakah penyimpanan bersifat permanen (di Vercel serverless filesystem read-only).
app.get('/api/version', (req, res) => {
  res.json({ version: 2, persistent: store.isPersistent() });
});

// ---------- API: Admin auth ----------
// Konfigurasi admin user (bisa diubah via env ADMIN_USERNAME dan ADMIN_PASSWORD)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 24 * 60 * 60 * 1000); // 24 jam
  res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.cookies && req.cookies.admin_token;
  if (token) sessions.delete(token);
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ admin: isAdmin(req) });
});

// ---------- Ringkasan untuk dashboard ----------
app.get('/api/summary', requireAdmin, (req, res) => {
  const rsvps = store.readRsvps();
  const wishes = store.readWishes();
  res.json({
    totalRsvp: rsvps.length,
    hadir: rsvps.filter((r) => r.attendance === 'hadir').length,
    tidakHadir: rsvps.filter((r) => r.attendance === 'tidak-hadir').length,
    totalTamu: rsvps.filter((r) => r.attendance === 'hadir').reduce((s, r) => s + (r.guests || 1), 0),
    wishesPending: wishes.filter((w) => !w.approved).length,
    totalWishes: wishes.length,
  });
});

// ---------- Import Data Tamu dari Excel ----------
const uploadExcel = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.xlsx';
      cb(null, 'guests-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.post('/api/import-guests', requireAdmin, (req, res) => {
  uploadExcel.single('excel')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    
    if (!XLSX) {
      return res.status(500).json({ error: 'Modul xlsx tidak tersedia. Install dengan: npm install xlsx' });
    }
    
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      
      // Hapus file setelah dibaca
      fs.unlinkSync(req.file.path);
      
      // Parse data tamu
      const guests = [];
      for (const row of data) {
        // Cari kolom nama (case insensitive)
        const nama = row.nama || row.Nama || row.name || row.Name || row.fullname || row.FullName || row.full_name || '';
        // Cari kolom nomor HP (case insensitive)
        const noHp = row.noHp || row.no_hp || row.noHp || row.NoHp || row.phone || row.Phone || row.nomor || row.Nomor || row.hp || row.HP || '';
        
        if (nama && noHp) {
          guests.push({
            nama: String(nama).trim().slice(0, 100),
            noHp: String(noHp).trim().replace(/\s+/g, '')
          });
        }
      }
      
      res.json({ guests, count: guests.length });
    } catch (err) {
      // Hapus file jika gagal
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Gagal membaca file Excel: ' + err.message });
    }
  });
});

// ---------- Blast Undangan ke Tamu ----------
app.post('/api/blast-invitations', requireAdmin, (req, res) => {
  const { baseUrl, guests } = req.body || {};
  
  if (!baseUrl || !guests || !Array.isArray(guests)) {
    return res.status(400).json({ error: 'baseUrl dan guests wajib diisi' });
  }
  
  const cleanBaseUrl = baseUrl.replace(/\/+$/, ''); // Hilangkan trailing slash
  
  let sent = 0;
  let failed = 0;
  const results = [];
  
  for (const guest of guests) {
    if (guest.nama && guest.noHp) {
      const url = cleanBaseUrl + (cleanBaseUrl.includes('?') ? '&' : '?') + 'to=' + encodeURIComponent(guest.nama);
      
      // Simpan log blast
      const blastLog = store.readBlastLogs();
      blastLog.push({
        id: crypto.randomUUID(),
        nama: guest.nama,
        noHp: guest.noHp,
        url: url,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });
      store.writeBlastLogs(blastLog);
      
      sent++;
      results.push({ nama: guest.nama, noHp: guest.noHp, url, status: 'sent' });
    } else {
      failed++;
    }
  }
  
  // Kembalikan response yang lengkap
  res.json({ 
    sent, 
    failed, 
    total: guests.length,
    results: results,
    message: `Berhasil mengirim undangan ke ${sent} tamu. ${failed > 0 ? failed + ' tamu gagal (data tidak lengkap).' : 'Semua berhasil!'}` 
  });
});

// ---------- Log Blast ----------
app.get('/api/blast-logs', requireAdmin, (req, res) => {
  const logs = store.readBlastLogs();
  res.json(logs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)));
});

app.delete('/api/blast-logs', requireAdmin, (req, res) => {
  store.writeBlastLogs([]);
  res.json({ ok: true });
});

// ---------- Start ----------
// Jalankan server langsung ketika file dijalankan sebagai script utama (node server.js / npm start).
// Saat di-require oleh Vercel (@vercel/node), platform yang menjalankan server dan app diekspor di bawah.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Undangan digital berjalan di http://localhost:${PORT}`);
    console.log(`📋 Admin dashboard: http://localhost:${PORT}/admin  (password default: admin123)`);
    console.log('   Ganti password dengan env ADMIN_PASSWORD.');
  });
}

module.exports = app;