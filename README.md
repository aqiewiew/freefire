# FF Money Tracker — Cloud Edition (Starter)

PWA statis untuk GitHub Pages + Supabase Auth/PostgreSQL/Storage. Tidak membutuhkan VPS, Laravel, atau server backend sendiri.

## Fitur pada starter ini
- Daftar akun dan login email/password Supabase.
- Data transaksi pemasukan/pengeluaran tersimpan di PostgreSQL.
- Catatan Tournament/FT: biaya pendaftaran dan hadiah yang benar-benar diterima.
- Catatan Laga: data pertandingan dan pengeluaran aktual, tanpa kalkulasi taruhan.
- Upload bukti transaksi ke bucket privat.
- Laporan ringkas bulanan dan ekspor JSON.
- PIN aplikasi 8 digit sebagai kunci tambahan.
- Layout responsif dan PWA.

## 1. Siapkan Supabase
1. Buat project baru di https://supabase.com.
2. Buka SQL Editor.
3. Jalankan seluruh isi `supabase/schema.sql`.
4. Buka Project Settings → API.
5. Salin Project URL dan anon/publishable key.
6. Isi keduanya di `assets/js/config.js`. Jangan pernah memakai `service_role` key di browser.

## 2. Jalankan lokal
Dari folder proyek:
```bash
python -m http.server 8000
```
Buka `http://localhost:8000`.

## 3. Hosting GitHub Pages
1. Buat repository GitHub baru.
2. Upload seluruh isi folder proyek ke root repository.
3. Buka Settings → Pages.
4. Pilih Deploy from a branch, branch `main`, folder `/ (root)`.
5. Tunggu URL Pages aktif.
6. Di Supabase → Authentication → URL Configuration, tambahkan URL GitHub Pages ke Site URL / Redirect URLs.

## 4. Instal di Android
Buka URL GitHub Pages melalui Chrome Android → menu ⋮ → Add to Home screen / Install app. HTTPS dari GitHub Pages mendukung PWA.

## Catatan penting
- Sinkronisasi cloud memerlukan koneksi internet.
- PWA menyimpan shell aplikasi untuk dibuka kembali, tetapi transaksi dan upload memerlukan koneksi.
- Bucket bukti bersifat privat. Starter ini menyimpan path file; tampilan pratinjau/tautan bertanda tangan dan kompresi gambar lanjutan perlu ditambahkan sebelum penggunaan rutin.
- PIN 8 digit adalah pengunci tambahan, bukan pengganti password akun. Hash PIN disimpan pada baris profil milik akun. Untuk perlindungan lebih kuat, jangan anggap PIN sebagai autentikasi utama.
- Buat backup berkala. Ekspor JSON saat ini berisi catatan transaksi dan metadata, bukan file foto.
- Ini starter implementasi, belum diaudit keamanan atau diuji untuk penggunaan produksi.
- Untuk menjaga konsistensi saldo, data turnamen dan transaksi yang dibuat bersamaan sebaiknya dipindahkan ke database function/transaction pada tahap penyempurnaan.
