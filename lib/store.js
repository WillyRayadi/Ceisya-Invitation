const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read(name, fallback) {
  ensureDir();
  const file = dataFile(name);
  if (!fs.existsSync(file)) {
    write(name, fallback);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Gagal membaca ${file}:`, err.message);
    return fallback;
  }
}

function write(name, data) {
  ensureDir();
  const tmp = dataFile(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile(name));
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
};