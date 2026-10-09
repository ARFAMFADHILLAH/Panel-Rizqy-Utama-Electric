# Panel Admin — Rizqy Utama Electric

Panel administrasi untuk toko online **Rizqy Utama Electric**.Dibangun sebagai
aplikasi Next.js **terpisah** yang memakai **database Supabase (Postgres) yang
sama** dengan storefront, sehingga admin bisa mengelola katalog lewat web tanpa
menyentuh SQL dan tanpa risiko merusak toko yang sedang melayani pelanggan.

```
rizqyutamaelectric/              panel-rizqyutamaelectric/  ← repo ini
  storefront Next.js :3000          panel admin Next.js :3001
  (tidak diubah sama sekali)         (read + write)
            │                                  │
            └────────────► Supabase ◄───────────┘
                 Postgres (satu connection string)
              products · categories · users
```

- **Satu database, dua aplikasi** — tidak ada replikasi, tidak ada tabel baru,
  tidak ada migrasi. Skema ada di `rizqyutamaelectric/supabase/schema.sql`.
- **Storefront tidak pernah disentuh** — panel hanya membaca dan menulis ke
  tabel yang sudah ada.
- **Perubahan langsung terlihat** — produk baru, harga baru, atau status
  aktif/nonaktif langsung tampil di toko tanpa deploy.
- **MySQL tersedia sebagai cadangan** — bila `SUPABASE_DB_URL` dikosongkan,
  panel otomatis memakai MySQL (`MYSQL_*`) dengan SQL dan tabel yang sama.

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Product Requirements: tujuan, ruang lingkup, persyaratan fungsional & non-fungsional, kriteria penerimaan |
| [docs/ERD.md](docs/ERD.md) | Entity Relationship Diagram, definisi kolom, DDL, aturan integritas |

## Fitur

- **Login/logout** dengan cookie session bertanda tangan HMAC-SHA256
  (`httpOnly`, `sameSite=lax`, `Secure` di produksi). Hanya user
  `is_admin = true` yang bisa masuk, dan statusnya dicek ulang ke database pada
  setiap permintaan.
- **Dashboard** — jumlah produk, produk aktif, jumlah kategori, produk stok
  habis, plus 8 produk terakhir yang diubah.
- **Produk** — pencarian (nama/SKU), filter kategori, tambah, ubah, toggle
  aktif/nonaktif, hapus, dan unggah gambar.
- **Kategori** — tambah dan hapus. Kategori yang masih dipakai produk
  menolak dihapus, supaya tidak terjadi penghapusan massal diam-diam.
- **Gambar** — unggah JPEG/PNG/WEBP/GIF (maks 2 MB) atau pasang URL eksternal.
  File lama otomatis dibersihkan dari disk saat tidak dipakai lagi.
- **Validasi** — pesan berbahasa Indonesia untuk setiap kesalahan input,
  termasuk batas kolom database, jadi tidak ada error 500 dari form.
- **Asisten AI** *(opsional)* — chat berbahasa Indonesia (Google Gemini) untuk
  membaca Google Sheet, mencari produk, menyusun laporan, dan mengusulkan
  tambah/ubah/impor produk. Semua perubahan wajib dikonfirmasi admin dulu.
  Setup: isi `AI_ALLOWED_EMAILS`, `GEMINI_API_KEY`, dan kredensial service
  account Google Sheets di `.env.local` (lihat tabel konfigurasi di bawah).

## Kebutuhan Sistem

- Node.js 20+ (dibangun & diuji pada v24)
- Koneksi **Supabase (Postgres)** — sama dengan storefront, ambil connection
  string-nya dari `.env.local` storefront (`SUPABASE_DB_URL`)
- *(opsional)* MySQL 8, hanya bila `SUPABASE_DB_URL` sengaja dikosongkan

Database harus **sudah bisa dihubungi** saat panel dijalankan; panel tidak
menyalakan database-nya sendiri. Skema database dibuat sekali dari
`rizqyutamaelectric/supabase/schema.sql` (Supabase Dashboard → SQL Editor).

## Menjalankan

```bash
npm install
cp .env.example .env.local     # isi nilainya (lihat tabel di bawah)
npm run dev                    # http://localhost:3001
```

Produksi:

```bash
npm run build
npm start                      # http://localhost:3001
```

### Perintah

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan di port 3001 |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build di port 3001 |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Cek tipe TypeScript |

## Konfigurasi

Salin `.env.example` menjadi `.env.local`, lalu isi:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SUPABASE_DB_URL` | **ya** | Connection string Postgres Supabase (mode Session/Pooler). Selama terisi, panel memakai Supabase — sama dengan storefront. |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | tidak | **Cadangan.** Dipakai hanya bila `SUPABASE_DB_URL` kosong. `MYSQL_DATABASE` harus `rizqyutamaelectric`. |
| `SESSION_SECRET` | **wajib** | Kunci HMAC penandatangan cookie. Generate: `openssl rand -base64 32`. **Jangan dipakai ulang antar instalasi.** |
| `ADMIN_PUBLIC_URL` | ya | Origin publik panel, mis. `https://admin.tokomu.com`. Dipakai menyusun URL gambar. |
| `NEXT_PUBLIC_STOREFRONT_URL` | ya | Origin toko, untuk tombol "Lihat Toko". |
| `NEXT_PUBLIC_STORE_NAME` | tidak | Nama toko yang ditampilkan. |
| `NEXT_PUBLIC_WA_NUMBER` | tidak | Nomor WhatsApp toko. |
| `ADMIN_SESSION_HOURS` | tidak | Masa berlaku sesi, default `8`. |
| `ADMIN_COOKIE_SECURE` | tidak | Override flag `Secure`; set `false` **hanya** untuk uji lokal via HTTP. |
| `AI_ALLOWED_EMAILS` | tidak | Email admin yang boleh memakai Asisten AI (pisah koma). Kosong = AI nonaktif. |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | tidak | API key Gemini (default model `gemini-2.5-flash`). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | tidak | Kredensial service account untuk membaca Google Sheets. |
| `GOOGLE_SHEETS_CONFIG` | tidak | Daftar spreadsheet, JSON `[{"name","id","range"}]`. Opsi `columns` (peta kolom), `defaultStock`, `seriesRows`, `namePrefix` (prefix nama, mis. merek); `range` bisa `"'NAMA TAB'!A:Z"` untuk tab tertentu. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `NOTIFY_TO` | tidak | Notifikasi email via Gmail SMTP + App Password. |
| `LOW_STOCK_THRESHOLD` | tidak | Ambang stok menipis, default `5`. |
| `CRON_SECRET` | tidak | Bearer token untuk `/api/cron/daily-report`. |

> `ADMIN_PUBLIC_URL` harus sama dengan origin yang dipakai membuka panel,
> karena URL gambar disimpan apa adanya di kolom `products.image`.
>
> Cookie session memakai flag `Secure` otomatis saat `NODE_ENV=production`.
> Browser tidak mengirim cookie `Secure` lewat HTTP, jadi `npm start` di
> `http://localhost` perlu `ADMIN_COOKIE_SECURE=false` untuk pengujian lokal.

## Akun Admin

Buat akun adminmu sendiri di tabel `users` (`is_admin = true`) dengan `password`
berisi **hash bcrypt** (bukan teks biasa). Tidak ada kredensial default di repo
ini.

```bash
# buat hash bcrypt untuk password pilihanmu
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'password-pilihanmu'
```

Panel hanya menerima user dengan `is_admin = true`; menambah admin lain cukup
dengan menyisipkan baris `users` berisi hash bcrypt.

## Struktur Proyek

```
app/
  actions/            Server Action: auth, produk, kategori, ai
  admin/login/        Halaman login
  admin/(panel)/      Layout + dashboard, produk, kategori, ai
  api/ai/chat/        Endpoint streaming chat Asisten AI
  api/cron/           Pemicu laporan harian
  uploads/[...path]/  Route handler penyaji file gambar
  robots.ts           Melarang perayapan seluruh panel
components/admin/     Sidebar, form produk/kategori, tombol, header
components/admin/ai/  Chat Asisten AI + kartu proposal konfirmasi
lib/
  ai/                 access, system-prompt, tools, proposal (Asisten AI)
  auth.ts             verifySession() & assertAdmin()
  db.ts               Koneksi database: Supabase (pg) utama, mysql2 cadangan
  product-service.ts  Validasi + create/update produk (dipakai form & AI)
  mailer.ts, notify.ts Notifikasi email + throttle
  sheets.ts           Pembaca Google Sheets (service account)
  session.ts          Pembuatan/pembacaan cookie session
  session-token.ts    Tanda tangan HMAC + validasi kedaluwarsa
  slug.ts, slugify.ts Slug unik & normalisasi
  upload.ts           Simpan, baca, hapus file gambar
  format.ts, types.ts Format Rupiah/tanggal & tipe data
proxy.ts              Saringan awal untuk /admin/*
uploads/              File gambar hasil unggahan (bukan public/)
docs/                 PRD, ERD
```

### Kenapa upload tidak memakai `public/`

Next.js memotret isi folder `public/` saat build. File yang diunggah **setelah**
build tidak akan dilayani oleh `next start` dan selalu 404. Karena itu upload
disimpan di `uploads/` dan dilayani route handler `/uploads/[...path]`, sehingga
gambar langsung bisa diakses tanpa rebuild.

## Keamanan

- Setiap halaman **dan setiap Server Action** memeriksa ulang session admin —
  action adalah entry point `POST` tersendiri, jadi tidak cukup hanya
  bergantung pada layout.
- `users.is_admin` dicek ke database pada setiap permintaan, sehingga pencabutan
  akses berlaku seketika tanpa menunggu cookie kedaluwarsa.
- Seluruh query memakai prepared statement — `pg` (Supabase) atau `mysql2`
  (cadangan), tidak pernah string SQL gabungan.
- Tanda tangan cookie diverifikasi dengan `timingSafeEqual`.
- Path traversal dicegah; nama file selalu dibuat server, bukan diambil dari
  browser.
- Halaman panel `noindex`, dan `/robots.txt` melarang perayapan.
- Query parameter `?next=` hanya diterima bila diawali `/admin`, mencegah
  open-redirect.

## Teknologi

| Komponen | Versi |
| --- | --- |
| Next.js | 16.3.6 (App Router, Turbopack) |
| React | 19.2.8 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| pg | ^8.23.1 |
| mysql2 | ^3.24.4 (cadangan) |
| bcryptjs | ^3.0.2 |
| ai / @ai-sdk/google | ^7 / ^4 (Asisten AI, opsional) |
| google-auth-library | ^11 (Google Sheets) |
| nodemailer | ^10 (notifikasi email) |
| zod | ^4 (skema tool AI) |

Tanpa ORM — seluruh akses data memakai prepared statement lewat `query()` di
`lib/db.ts`: driver `pg` bila `SUPABASE_DB_URL` terisi, `mysql2` bila tidak.
Versi `0.1.0`, lisensi privat.
