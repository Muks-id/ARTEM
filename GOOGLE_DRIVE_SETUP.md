# Google Drive setup untuk penyimpanan file

Unggahan baru foto dan PDF profil, foto profil, serta foto lampiran chat disimpan di Google Drive akun pribadi yang memberikan OAuth. Supabase tetap menyimpan metadata dan hak akses. File yang sudah ada di Supabase tidak dipindahkan.

## 1. Aktifkan Google Drive API

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan buat atau pilih project.
2. Buka **APIs & Services → Library**, cari **Google Drive API**, lalu aktifkan.
3. Buka **Google Auth Platform** dan lengkapi nama aplikasi serta email dukungan.
4. Pilih tipe pengguna **External**.
5. Jika status publishing aplikasi **Testing**, buka **Audience → Test users → Add users** dan tambahkan alamat Gmail yang akan dipakai untuk mengotorisasi Drive. Menyetel aplikasi ke External saja belum memberi akses kepada semua akun; akun yang login di OAuth Playground harus terdaftar sebagai test user pada project OAuth yang sama.
6. Simpan perubahan. Dalam mode Testing, refresh token dapat kedaluwarsa setelah 7 hari; untuk pemakaian berkelanjutan, publikasikan consent screen dan selesaikan verifikasi yang diminta Google.

## 2. Buat OAuth client

1. Buka **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Pilih **Web application**.
3. Tambahkan `https://developers.google.com/oauthplayground` sebagai **Authorized redirect URI**.
4. Simpan **Client ID** dan **Client secret**. Jangan membagikan atau memasukkannya ke kode frontend.

## 3. Buat refresh token

1. Buka [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Buka pengaturan (ikon roda gigi), centang **Use your own OAuth credentials**, lalu masukkan Client ID dan Client secret dari langkah sebelumnya.
3. Di daftar scope, masukkan `https://www.googleapis.com/auth/drive.file`, lalu pilih **Authorize APIs**.
4. Masuk dengan akun Google Drive yang akan dipakai dan izinkan akses.
5. Pilih **Exchange authorization code for tokens**. Salin **Refresh token** yang diberikan.

Scope `drive.file` membatasi akses aplikasi ke file yang dibuatnya melalui integrasi ini, bukan seluruh isi Drive.

### Jika muncul `403 access_denied`

- Pastikan Gmail yang dipilih di layar izin OAuth sama persis dengan salah satu alamat di **Audience → Test users**.
- Pastikan test user ditambahkan pada Google Cloud project yang memiliki OAuth Client ID yang dimasukkan ke OAuth Playground. Memilih project lain di Cloud Console atau memakai client ID dari project lain tidak akan berpengaruh.
- Setelah menambahkan test user, tunggu beberapa menit, muat ulang OAuth Playground, lalu ulangi **Authorize APIs**. Jika browser memiliki beberapa akun Google yang login, pilih akun tester yang benar atau coba jendela privat.
- Pastikan **Publishing status** masih **Testing** dan **User type** adalah **External**. Mode Testing tetap mengharuskan akun terdaftar sebagai tester.
- Error `org_internal` berbeda: itu menunjukkan user type atau kebijakan organisasi masih membatasi aplikasi; gunakan project OAuth milik akun pribadi dan pastikan user type External.

## 4. Atur environment server

Isi variabel berikut di `.env.local` untuk lokal dan di pengaturan environment hosting (misalnya Vercel) untuk deployment:

```env
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_REFRESH_TOKEN=...
```

Restart aplikasi setelah mengubah environment. Jangan memakai prefix `NEXT_PUBLIC_` untuk kredensial ini. Bila refresh token dicabut, kedaluwarsa, atau kredensial diganti, buat dan pasang refresh token baru.

Tambahkan juga `CRON_SECRET` sebagai secret acak yang kuat di environment hosting. Vercel mengirimkannya ke cron job sebagai header `Authorization: Bearer ...`; nilainya harus sama dengan secret aplikasi. Secara lokal, buat nilai acak yang terpisah dan gunakan saat memanggil endpoint cron secara manual. Jangan commit atau membagikan secret tersebut.

Batas payload request Vercel Functions adalah 4,5 MB dan tidak dapat dinaikkan lewat konfigurasi Next.js. Karena itu, batas unggahan file profil dan foto chat disetel ke 4 MB agar request beserta overhead-nya tetap berada di bawah batas hosting. Batas Server Actions Next.js disetel ke 4,5 MB juga.

## Perilaku penyimpanan

- Unggahan foto dan PDF profil yang baru memakai Google Drive.
- Foto profil baru dan foto lampiran chat baru juga memakai Google Drive.
- File Drive tetap privat; aplikasi memeriksa sesi dan hak akses sebelum mengambil file dari Drive.
- File profil lama di Supabase tetap bisa dibuka dan dihapus seperti sebelumnya. Tidak ada migrasi otomatis.
- Foto profil lama dan lampiran chat lama di Supabase tetap dilayani dan dibersihkan menggunakan alur yang sudah ada.
- Foto chat tetap kedaluwarsa setelah 3 hari jika belum diunduh; foto yang sudah diunduh dipertahankan.
