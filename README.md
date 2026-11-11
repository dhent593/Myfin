# Dompetku - PWA Keuangan & Manajemen Aset Pribadi

Aplikasi web modern berbasis **Progressive Web App (PWA)** untuk pencatatan keuangan, multi-rekening/kantong dinamis, perencanaan anggaran (*budgeting*), pelacakan hutang-piutang terintegrasi, dan portofolio aset berharga.

Desain antarmuka mengadopsi estetika mewah *glassmorphism* mobile-first dengan tema Dark & Light mode dari file referensi `index-refference.html`.

---

## 🌟 Fitur Utama yang Telah Diimplementasikan

1. **Autentikasi & Akun**:
   - Registrasi & Login menggunakan **Username & Password** (pemetaan internal email `@dompetku.local` ke Supabase Auth).
   - Pembuatan akun baru otomatis menghasilkan 1 kantong default: **"Dompet Utama"**.
   - Manajemen sesi tersimpan otomatis di `localStorage`.
   - Update profil (Nama Lengkap) dan ganti password melalui modal profil.
   - Fitur **Demo Mode** untuk eksplorasi instan tanpa konfigurasi database.

2. **Manajemen Kantong (Multi-Rekening) & Kalkulasi Saldo Dinamis**:
   - Dukungan pembuatan banyak kantong dengan saldo awal, target saldo, ikon FontAwesome, dan pilihan warna aksen.
   - **Kalkulasi Saldo Real-Time di Klien**: Saldo aktual tidak disimpan mati, melainkan dihitung otomatis:
     $$\text{Saldo} = \text{Saldo Awal} + \text{Pemasukan} - \text{Pengeluaran} + \text{Transfer Masuk} - \text{Transfer Keluar}$$
   - **Drag & Drop Reorder**: Sentuh tahan (*long-press*) dan geser kartu kantong untuk mengatur urutan tampilan, tersimpan permanen ke database Supabase.

3. **Pencatatan Transaksi & Kategori Pintar**:
   - 3 Jenis Transaksi: **Pengeluaran**, **Pemasukan**, dan **Pindah Dana (Transfer)** antar-kantong.
   - **Kategori Pintar**: Jika pengguna mengetik nama kategori baru saat mencatat transaksi, sistem otomatis mendaftarkannya ke database.
   - **Filter & Pencarian**: Tab cepat (*Semua*, *Bulan Ini*, *Minggu Ini*), pencarian teks instan, dan pengelompokan tanggal (*Hari Ini*, *Kemarin*, dll.).

4. **Budgeting (Anggaran Bulanan)**:
   - Penetapan batas maksimal pengeluaran per kategori per bulan.
   - Indikator progres pemakaian: berubah menjadi **merah** jika pemakaian $\ge 90\%$, dan **oranye** jika $\ge 75\%$.
   - **Grafik Donut SVG**: Visualisasi porsi pengeluaran kategori yang digambar secara native via manipulasi SVG JavaScript.
   - **Detail Transaksi Expandable**: Kartu anggaran dapat diklik (*accordion*) untuk membuka rincian riwayat transaksi terkait.

5. **Hutang & Piutang Terintegrasi**:
   - Pencatatan pihak peminjam / yang dihutangi, nominal total, dan tanggal jatuh tempo.
   - **Cicilan Terintegrasi**: Pembayaran cicilan otomatis memperbarui status sisa hutang dan **langsung membuat entri transaksi baru** yang memotong/menambah saldo kantong terkait.
   - Filter pemisah status: **Aktif / Berjalan** vs **Sudah Lunas**.

6. **Aset Berharga**:
   - Klasifikasi: Emas, Investasi (Saham/Crypto/Reksa Dana), Properti, Barang Berharga, dan Tabungan & Simpanan.
   - **Sinkronisasi Saldo Kantong**: Kategori Tabungan & Simpanan dapat dihubungkan langsung ke salah satu kantong, sehingga nilainya selalu mencerminkan saldo aktual kantong tersebut.

7. **Pelaporan, Ekspor & Arsip**:
   - **Ekspor CSV**: Mengunduh riwayat transaksi ke format `.csv` langsung dari sisi browser menggunakan JavaScript Blob.
   - **Laporan Tahunan Fullscreen**: Ringkasan total pendapatan, pengeluaran, sisa tabungan bersih, persentase rasio tabungan (*Savings Rate*), serta grafik batang perbandingan bulanan.
   - **Arsip Transaksi**: Fitur pemindahan transaksi tahun-tahun sebelumnya ke tabel arsip untuk menjaga performa loading aplikasi tetap kilat, dengan dukungan *lazy-loading*.

8. **PWA & Responsivitas**:
   - `manifest.webmanifest` & Service Worker `sw.js` untuk kemampuan *offline shell* dan dapat diinstall (*Add to Home Screen*) di smartphone Android, iOS, maupun Desktop.
   - Tampilan frame *smartphone* elegan saat dibuka di desktop browser.

---

## 🚀 Panduan Setup & Menjalankan Lokal

### 1. Jalankan Development Server
Pastikan Node.js telah terpasang:
```bash
npm install
npm run dev
```
Buka browser pada URL yang ditampilkan (biasanya `http://localhost:5173`).

---

## 🗄️ Menghubungkan ke Database Supabase

1. Buat project baru di [Supabase](https://supabase.com/).
2. Buka menu **SQL Editor** pada dashboard Supabase project Anda.
3. Buka file [`supabase-schema.sql`](./supabase-schema.sql) pada repositori ini, salin seluruh kodenya, dan jalankan (*Run*) di SQL Editor Supabase.
4. Salin **Project URL** dan **Anon Public Key** dari menu *Project Settings > API*.
5. Sambungkan dengan salah satu dari dua cara berikut:
   * **Cara A (Langsung lewat UI)**: Di aplikasi Dompetku, buka menu **Settings > Koneksi Database Supabase**, masukkan URL & Key, lalu klik Simpan.
   * **Cara B (File .env)**: Buat file `.env` di root project:
     ```env
     VITE_SUPABASE_URL=https://xyzcompany.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

---

## ☁️ Panduan Hosting di Vercel

Aplikasi ini sudah dilengkapi dengan file [`vercel.json`](./vercel.json) yang otomatis menangani routing SPA (Single Page Application) dan header PWA Service Worker.

1. Unggah kode ke repositori GitHub / GitLab / Bitbucket Anda.
2. Buka [Vercel](https://vercel.com/) dan klik **Add New > Project**.
3. Pilih repository Anda.
4. Pada bagian **Build & Development Settings**, Vercel akan otomatis mendeteksi:
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
5. Pada bagian **Environment Variables**, tambahkan:
   * `VITE_SUPABASE_URL` = (URL Supabase Anda)
   * `VITE_SUPABASE_ANON_KEY` = (Anon Public Key Supabase Anda)
6. Klik **Deploy**! Aplikasi Dompetku Anda akan langsung aktif dengan HTTPS dan siap di-install sebagai PWA.

