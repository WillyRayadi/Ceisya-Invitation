const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Cache in-memory: dipakai sebagai fallback saat filesystem read-only
// (mis. Vercel serverless), sehingga server tidak crash saat mencoba menulis.
const memoryCache = new Map();
let fsWritable = null; // null = belum dicek

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    // Filesystem read-only (mis. Vercel serverless) — abaikan, data dibaca dari file yang ter-bundle.
  }
}

function isPersistent() {
  // true jika filesystem benar-benar bisa ditulis (mode lokal / VPS).
  if (fsWritable !== null) return fsWritable;
  try {
    ensureDir();
    const probe = dataFile('.write-probe');
    fs.writeFileSync(probe, '1');
    fs.unlinkSync(probe);
    fsWritable = true;
  } catch (err) {
    fsWritable = false;
  }
  return fsWritable;
}

function read(name, fallback) {
  ensureDir();
  const file = dataFile(name);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      // Sinkronkan cache agar selalu konsisten dengan file.
      memoryCache.set(name, parsed);
      return parsed;
    }
  } catch (err) {
    console.error(`Gagal membaca ${file}:`, err.message);
  }
  if (memoryCache.has(name)) return memoryCache.get(name);
  return fallback;
}

function write(name, data) {
  // Selalu simpan di memori dulu — berfungsi juga saat filesystem read-only.
  memoryCache.set(name, data);
  ensureDir();
  const tmp = dataFile(name) + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, dataFile(name));
  } catch (err) {
    fsWritable = false;
    console.warn(`⚠️ Filesystem tidak bisa ditulis (${err.message}). Perubahan hanya tersimpan sementara di memori dan hilang saat server cold start.`);
  }
}

function readSettings() {
  return read('settings.json', defaultSettings());
}

function writeSettings(settings) {
  write('settings.json', settings);
}

function readRsvps() {
  return read('rsvps.json', []);
}

function writeRsvps(rsvps) {
  write('rsvps.json', rsvps);
}

function readWishes() {
  return read('wishes.json', []);
}

function writeWishes(wishes) {
  write('wishes.json', wishes);
}

function readBlastLogs() {
  return read('blast-logs.json', []);
}

function writeBlastLogs(logs) {
  write('blast-logs.json', logs);
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