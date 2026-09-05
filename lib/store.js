const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ---------- Backend penyimpanan ----------
// Mode 1 (produksi Vercel): Vercel KV — aktif otomatis jika env terisi.
// Mode 2 (lokal): file JSON di folder data/.
const HAS_KV =
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
  !!process.env.KV_URL;

let kv = null;
if (HAS_KV) {
  try {
    const { createClient } = require('@vercel/kv');
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      kv = createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    } else {
      kv = createClient({ connectionString: process.env.KV_URL });
    }
    console.log('🗄️ Penyimpanan memakai Vercel KV');
  } catch (err) {
    console.warn('⚠️ Gagal menginisialisasi Vercel KV, fallback ke file lokal:', err.message);
  }
}

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Filesystem read-only (mis. Vercel serverless) — abaikan.
  }
}

function isPersistent() {
  if (kv) return true;
  try {
    ensureDir();
    const probe = dataFile('.write-probe');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    return true;
  } catch (err) {
    return false;
  }
}

// Baca dari file JSON lokal (untuk seed KV pertama kali / mode file).
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

async function read(name, fallback) {
  if (kv) {
    try {
      const val = await kv.get(name);
      if (val !== null && val !== undefined) return val;
    } catch (err) {
      console.warn(`⚠️ Gagal membaca KV ${name}:`, err.message);
    }
    // Seed pertama kali dari file yang ter-bundle (data dari repo),
    // agar tampilan langsung sesuai setting yang sudah di-commit.
    const fromFile = readFile(name);
    if (fromFile !== undefined) {
      kv.set(name, fromFile).catch(() => {});
      return fromFile;
    }
    return fallback;
  }
  ensureDir();
  const fromFile = readFile(name);
  if (fromFile !== undefined) return fromFile;
  return fallback;
}

async function write(name, data) {
  if (kv) {
    try {
      await kv.set(name, data);
      return;
    } catch (err) {
      console.warn(`⚠️ Gagal menulis KV ${name}:`, err.message);
      return;
    }
  }
  ensureDir();
  const tmp = dataFile(name) + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, dataFile(name));
  } catch (err) {
    console.warn(`⚠️ Filesystem tidak bisa ditulis (${err.message}). Perubahan hanya tersimpan sementara dan hilang saat server restart.`);
  }
}

async function readSettings() {
  return read('settings.json', defaultSettings());
}

async function writeSettings(settings) {
  await write('settings.json', settings);
}

async function readRsvps() {
  return read('rsvps.json', []);
}

async function writeRsvps(rsvps) {
  await write('rsvps.json', rsvps);
}

async function readWishes() {
  return read('wishes.json', []);
}

async function writeWishes(wishes) {
  await write('wishes.json', wishes);
}

async function readBlastLogs() {
  return read('blast-logs.json', []);
}

async function writeBlastLogs(logs) {
  await write('blast-logs.json', logs);
}

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
  defaultSettings,
  isPersistent,
};