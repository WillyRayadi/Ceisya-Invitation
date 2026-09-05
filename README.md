# 💍 Undangan Digital

Website undangan pernikahan digital lengkap dengan **dashboard admin** — terinspirasi Our Wedding Link.

## Fitur

### Halaman Undangan (`/`)
- Cover undangan dengan tombol **Buka Undangan** + animasi
- Personalisasi tamu lewat link `/?to=Nama+Tamu`
- Hitung mundur menuju hari H
- Profil mempelai pria & wanita (foto, nama, orang tua, Instagram)
- Rangkaian acara: Akad Nikah & Resepsi (tanggal, waktu, lokasi, link Google Maps)
- Galeri foto (geser horizontal)
- Form **Konfirmasi Kehadiran (RSVP)** — hadir / tidak hadir + jumlah tamu
- Buku tamu **Ucapan & Doa** (dengan persetujuan admin)
- Pemutar musik latar (tombol mengambang)
- QR code undangan + tombol bagikan / salin link
- Desain responsif, cocok dibuka di HP

### Dashboard Admin (`/admin`)
- Login password (default: `admin123`, ganti lewat env `ADMIN_PASSWORD`)
- Ringkasan statistik (total konfirmasi, hadir, tidak hadir, jumlah tamu, ucapan pending)
- Edit semua konten undangan (cover, mempelai, acara, musik, kutipan, footer)
- **7 pilihan tema premium** — default: **Midnight Gold** (hitam elegan + emas, paling mewah). Lainnya: Rose Classic, Emerald Royale, Sakura Blush, Ocean Serenity, Terra Boho, **Slate Elegance** (putih bersih + aksen biru baja elegan)
- **Upload foto mempelai pria & wanita** dan **gambar latar cover** langsung dari perangkat (bukan URL)
- **Upload musik latar MP3** langsung dari perangkat (bukan URL — URL musik sering gagal diputar)
- **Generator link undangan personal** untuk tamu: tambah nama tamu di akhir URL (`?to=Nama+Tamu`) + QR code + tombol salin
- **Info bank / rekening untuk kirim hadiah**: tampilkan beberapa rekening (nama bank, nomor, atas nama) dengan tombol salin nomor — untuk tamu yang tidak bisa hadir
- Lihat & hapus daftar RSVP, filter hadir / tidak hadir
- Setujui / sembunyikan / hapus ucapan tamu
- Upload & kelola foto galeri (tersimpan di folder `uploads/`)
- Generator & unduh QR code untuk dibagikan / dicetak

## Cara Menjalankan

```bash
npm install
npm start
# atau
node server.js
```

Buka:
- Undangan: http://localhost:3000
- Admin: http://localhost:3000/admin (password `admin123`)

Ubah port & password:

```bash
PORT=8080 ADMIN_PASSWORD=passwordku npm start
```

## Struktur File

```
server.js            # API & server Express
lib/store.js         # Penyimpanan data (file JSON di folder data/)
public/
  index.html         # Halaman undangan
  admin.html         # Dashboard admin
  css/style.css      # Gaya halaman undangan
  css/admin.css      # Gaya dashboard admin
  js/main.js         # Logika halaman undangan
  js/admin.js        # Logika dashboard admin
data/                # Data otomatis dibuat saat pertama dijalankan
  settings.json      # Konten undangan
  rsvps.json         # Konfirmasi kehadiran
  wishes.json        # Ucapan tamu
uploads/             # Foto galeri & foto mempelai
```

## Kustomisasi

1. Masuk dashboard admin → **Pengaturan**:
   - Unggah **foto mempelai** dan **musik latar MP3** langsung dari perangkat.
   - Pilih **tema undangan** yang diinginkan.
   - Isi **URL Undangan (basis)** bila undangan di-hosting di domain sendiri (kosongkan untuk memakai alamat otomatis).
2. Untuk membagikan undangan ke tamu: masukkan **Nama Tamu** di Pengaturan → *Bagikan Undangan ke Tamu*, lalu salin link personal (berisi `?to=Nama+Tamu`) atau scan QR-nya. Saat dibuka, undangan otomatis menyapa nama tamu tersebut.
3. Aktifkan **Bank / Rekening** di Pengaturan, tambahkan satu atau lebih rekening untuk kirim hadiah, lalu simpan.
4. Kelola foto galeri lewat tab **Galeri**, dan cetak QR lewat tab **QR Undangan**.

> Musik: unggah file **MP3** dari perangkat Anda (maks 20 MB). Musik dari URL eksternal tidak didukung karena sering gagal diputar di browser.

> **Penting:** setelah memperbarui kode, **restart server** (`npm start` ulang). File `server.js` tidak di-reload otomatis — jika server masih versi lama, fitur baru (tema, upload musik, dll.) tidak akan tersimpan dan dashboard akan menampilkan banner peringatan.