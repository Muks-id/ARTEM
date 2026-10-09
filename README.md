# Artem Geng

Portal komunitas full-stack untuk mengelola pekerjaan pribadi dan berkomunikasi secara realtime. Dibangun dengan Next.js 15 App Router, React, TypeScript, Tailwind CSS v4, Clerk, Supabase PostgreSQL, dan Supabase Realtime.

## Fitur

- Autentikasi Clerk dengan rute `/tasks`, `/chat`, `/profile`, dan `/admin` yang dilindungi.
- Sinkronisasi nama, email, dan foto profil dari Clerk ke tabel Supabase `profiles`.
- Task proyek dengan status, tanggal selesai, catatan revisi, dan tanggal revisi.
- Panel admin untuk melihat seluruh task; hanya admin yang dapat menghapus task.
- Chat realtime komunitas, profil pengirim, dan auto-scroll.
- Edit username/bio dan ringkasan statistik task.
- Tema dark blue yang responsif.

## Mulai

1. Install dependency: `npm install`.
2. Salin `.env.example` ke `.env.local`, lalu isi kredensial Clerk dan Supabase.
3. Hubungkan Clerk ke Supabase melalui integrasi third-party auth.
4. Jalankan migrasi `002_artem_geng_portal.sql` dan `003_project_tasks_admin.sql` melalui SQL Editor Supabase atau `supabase db push`.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

Lihat [SUPABASE_CLERK_SETUP.md](./SUPABASE_CLERK_SETUP.md) untuk detail konfigurasi, struktur folder, RLS, dan Realtime. Atur `ADMIN_USER_IDS` dengan ID pengguna Clerk admin, dipisahkan koma. `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai pada server untuk panel admin dan tidak boleh diekspos ke browser.

Unggahan baru foto profil, foto chat, serta foto dan PDF file pribadi disimpan secara privat di Google Drive. Ikuti [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) untuk membuat kredensial OAuth dan mengisi environment server, termasuk `CRON_SECRET` untuk pembersihan lampiran chat terjadwal. File yang telah diunggah sebelumnya tetap dilayani dari Supabase Storage.

## Struktur utama

```text
src/
├── app/
│   ├── (portal)/layout.tsx
│   ├── (portal)/tasks/page.tsx
│   ├── (portal)/chat/page.tsx
│   ├── (portal)/profile/page.tsx
│   ├── actions.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── chat-room.tsx
│   ├── portal-shell.tsx
│   ├── profile-editor.tsx
│   └── task-manager.tsx
├── lib/
│   ├── portal-types.ts
│   ├── supabase.ts
│   └── supabase-browser.ts
└── middleware.ts

supabase/migrations/002_artem_geng_portal.sql
```

## Verifikasi

```sh
npm run lint
npm run build
```

Build aplikasi memerlukan `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; runtime juga memerlukan kredensial Clerk dan Supabase yang valid.
