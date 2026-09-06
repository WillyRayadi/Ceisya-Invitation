const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ============================================================
// PENYIMPANAN PERMANEN — Redis (Upstash REST)
// ============================================================
// Di Vercel (serverless) filesystem TIDAK BISA dipakai menyimpan data:
// file yang ditulis akan hilang saat instance server dingin.
// Karena itu semua data (settings, RSVP, ucapan, sesi login admin)
// disimpan di Redis via REST API — bekerja di mana saja, tanpa koneksi
// TCP, cocok untuk serverless.
//
// Env yang didukung (otomatis terdeteksi):
//   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (dari Upstash langsung)
//   - KV_REST_API_URL + KV_REST_API_TOKEN                (dari Vercel Marketplace KV)
//   - KV_URL                                             (connection string)
//
// Jika tidak ada env Redis sama sekali (mis. jalankan `npm start` lokal),
// fallback ke file JSON di folder data/ agar bisa dijalankan tanpa setup.

const STORE_PREFIX = process.env.STORE_PREFIX || 'undangan:';

// ---------- Deteksi koneksi Redis ----------
function redisConfig() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    };
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return {
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    };
  }
  if (process.env.KV_URL) {
    // format: redis://default:<password>@<host>:<port> — ambil host & password
    try {
      const u = new URL(process.env.KV_URL);
      return { url: `https://${u.hostname}`, token: u.password };
    } catch (err) {
      return null;
    }
  }
  return null;
}

const REDIS_CONF = redisConfig();
let redis = null;

if (REDIS_CONF) {
  try {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url: REDIS_CONF.url, token: REDIS_CONF.token });
    console.log('🗄️  Penyimpanan: Redis (permanen) —', REDIS_CONF.url.replace(/https?:\/\//, ''));
  } catch (err) {
    console.warn('⚠️ Gagal init Redis, fallback ke file lokal:', err.message);
  }
}

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Filesystem read-only (Vercel serverless) — abaikan.
  }
}

function readFile(name) {
  const file = dataFile(name);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Gagal membaca ${file}:`, err.message);
    return undefined;
  }
}

function writeFile(name, data) {
  ensureDir();
  const tmp = dataFile(name) + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, dataFile(name));
  } catch (err) {
    // Filesystem read-only (Vercel) — perubahan hanya via Redis, abaikan.
  }
}

// ---------- CRUD generik ----------
async function read(name, fallback) {
  if (redis) {
    try {
      const val = await redis.get(STORE_PREFIX + name);
      if (val !== null && val !== undefined) return val;
    } catch (err) {
      console.warn(`⚠️ Gagal membaca Redis ${name}:`, err.message);
    }
    // Seed pertama kali: ambil dari file JSON yang ikut ter-deploy di repo,
    // lalu simpan ke Redis supaya nilainya permanen.
    const seeded = readFile(name);
    if (seeded !== undefined) {
      await redis.set(STORE_PREFIX + name, seeded).catch(() => {});
      return seeded;
    }
    return fallback;
  }
  const local = readFile(name);
  return local !== undefined ? local : fallback;
}

async function write(name, data) {
  if (redis) {
    try {
      await redis.set(STORE_PREFIX + name, data);
      return;
    } catch (err) {
      console.warn(`⚠️ Gagal menulis Redis ${name}:`, err.message);
      return;
    }
  }
  writeFile(name, data);
}

// ---------- Fungsi khusus per tipe data ----------
async function readSettings() {
  const s = await read('settings.json', defaultSettings());
  // Deep-merge dengan default agar field baru otomatis ada
  return deepMerge(defaultSettings(), s);
}

async function writeSettings(settings) {
  await write('settings.json', settings);
}

async function readRsvps() {
  return (await readList('rsvps.json', [])) || [];
}

async function writeRsvps(rsvps) {
  await write('rsvps.json', rsvps);
}

async function readWishes() {
  return (await readList('wishes.json', [])) || [];
}

async function writeWishes(wishes) {
  await write('wishes.json', wishes);
}

async function readBlastLogs() {
  return (await read('blast-logs.json', [])) || [];
}

async function writeBlastLogs(logs) {
  await write('blast-logs.json', logs);
}

// ============================================================
// SESI LOGIN ADMIN — juga disimpan di Redis (permanen).
// Sebelumnya sesi hanya di Map() di memori: setiap Vercel cold start
// semua admin ter-logout. Sekarang login bertahan lintas instance.
// ============================================================
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 jam
const SESSION_KEY = STORE_PREFIX + 'admin-sessions';

async function createSession(token, expiryMs) {
  const ttl = Math.max(60, Math.floor((expiryMs - Date.now()) / 1000));
  if (redis) {
    try {
      await redis.hset(SESSION_KEY, { [token]: String(expiryMs) });
      await redis.expire(SESSION_KEY, SESSION_TTL_SECONDS);
      return;
    } catch (err) {
      console.warn('⚠️ Gagal menyimpan sesi ke Redis:', err.message);
    }
  }
  // Fallback in-memory (dev lokal tanpa Redis)
  global.__adminSessions = global.__adminSessions || new Map();
  global.__adminSessions.set(token, expiryMs);
}

async function getSession(token) {
  if (redis) {
    try {
      const val = await redis.hget(SESSION_KEY, token);
      if (val) return parseInt(val, 10);
      return null;
    } catch (err) {
      console.warn('⚠️ Gagal membaca sesi dari Redis:', err.message);
    }
  }
  global.__adminSessions = global.__adminSessions || new Map();
  return global.__adminSessions.get(token) || null;
}

async function deleteSession(token) {
  if (redis) {
    try {
      await redis.hdel(SESSION_KEY, token);
      return;
    } catch (err) {
      console.warn('⚠️ Gagal menghapus sesi dari Redis:', err.message);
    }
  }
  global.__adminSessions = global.__adminSessions || new Map();
  global.__adminSessions.delete(token);
}

// ---------- Util ----------
function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override !== undefined ? override : base;
  }
  const out = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] !== undefined) {
      out[key] = deepMerge(base[key], override[key]);
    }
  }
  return out;
}

// ---------- Append atomik (race-safe) ----------
// Menambahkan satu item ke daftar tanpa read-modify-write penuh,
// sehingga tidak kehilangan data saat dua tamu mengirim bersamaan
// di instance serverless yang berbeda.
async function appendItem(name, item) {
  if (redis) {
    try {
      await redis.rpush(STORE_PREFIX + 'list:' + name, item);
      return;
    } catch (err) {
      console.warn(`⚠️ Gagal append Redis ${name}, fallback baca-tulis biasa:`, err.message);
    }
  }
  const list = (await read(name, [])) || [];
  list.push(item);
  await write(name, list);
}

// Versi baca yang menyatukan list append-only + data lama (array JSON).
async function readList(name, fallback) {
  if (redis) {
    let appended = [];
    try {
      appended = (await redis.lrange(STORE_PREFIX + 'list:' + name, 0, -1)) || [];
    } catch (err) {
      console.warn(`⚠️ Gagal membaca list Redis ${name}:`, err.message);
    }
    const legacy = await read(name, []);
    const merged = [...(legacy || []), ...appended];
    if (appended.length) {
      // Rapikan: gabungkan sekali ke array utama lalu kosongkan list sementara
      try {
        await redis.set(STORE_PREFIX + name, merged);
        await redis.del(STORE_PREFIX + 'list:' + name);
      } catch (err) { /* biarkan, masih bisa dibaca merged */ }
      return merged;
    }
    return merged;
  }
  const local = readFile(name);
  return local !== undefined ? local : fallback;
}

function isPersistent() {
  return !!redis;
}

// Cek koneksi Redis dengan menulis & membaca key sementara.
async function probe() {
  if (!redis) return false;
  try {
    const key = STORE_PREFIX + '.probe';
    await redis.set(key, '1');
    const val = await redis.get(key);
    await redis.del(key);
    return val === '1';
  } catch (err) {
    console.warn('⚠️ Probe Redis gagal:', err.message);
    return false;
  }
}

// ---------- Default settings ----------
function defaultSettings() {
  return {
    couple: {
      groom: {
        name: 'Raka Pratama',
        fullName: 'Raka Pratama, S.T.',
        parents: 'Putra pertama dari Bapak H. Ahmad Santoso & Ibu Hj. Siti Rahmawati',
        photo: '',
        instagram: 'rakapratama',
      },
      bride: {
        name: 'Nayla Putri',
        fullName: 'Nayla Putri, S.E.',
        parents: 'Putri kedua dari Bapak Ir. Budi Hartono & Ibu Dra. Dewi Lestari',
        photo: '',
        instagram: 'naylaputri',
      },
      quote: 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan untukmu pasangan hidup dari jenismu sendiri, supaya kamu mendapatkan ketenangan hati, dan dijadikan-Nya kasih sayang di antara kamu.',
      quoteSource: 'QS. Ar-Rum: 21',
    },
    cover: {
      title: 'The Wedding of',
      opening: 'Assalamualaikum Wr. Wb.',
      invitation: 'Tanpa mengurangi rasa hormat, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di acara pernikahan kami:',
      background: '',
      showDate: true,
    },
    events: {
      akad: {
        title: 'Akad Nikah',
        date: '2026-12-12',
        time: '08.00 - 10.00 WIB',
        location: 'Masjid Agung Al-Falah',
        address: 'Jl. Merdeka No. 1, Jakarta Pusat',
        mapsUrl: 'https://maps.google.com/?q=-6.200000,106.816666',
      },
      resepsi: {
        title: 'Resepsi',
        date: '2026-12-12',
        time: '11.00 - 14.00 WIB',
        location: 'Hotel Grand Ballroom',
        address: 'Jl. Sudirman Kav. 20, Jakarta Selatan',
        mapsUrl: 'https://maps.google.com/?q=-6.220000,106.810000',
      },
    },
    countdown: { active: true, title: 'Menuju Hari Bahagia' },
    music: {
      url: '',
      autoplay: true,
    },
    wishes: { autoApprove: false },
    gallery: [],
    theme: 'midnight',
    share: { baseUrl: '' },
    bank: {
      active: false,
      title: 'Kirim Hadiah / Kado Digital',
      note: 'Bagi yang tidak dapat hadir namun ingin mengirimkan hadiah, dapat melalui transfer ke rekening berikut:',
      accounts: [],
    },
    footer: {
      quote: 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.',
      thankYou: 'Atas kehadiran dan doa restunya, kami ucapkan terima kasih.',
      names: 'Raka & Nayla',
    },
  };
}

module.exports = {
  readSettings,
  writeSettings,
  readRsvps,
  writeRsvps,
  readWishes,
  writeWishes,
  readBlastLogs,
  writeBlastLogs,
  appendItem,
  readList,
  defaultSettings,
  isPersistent,
  probe,
  createSession,
  getSession,
  deleteSession,
};
