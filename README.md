# Panel Admin — Rizqy Utama Electric

Panel administrasi untuk toko online **Rizqy Utama Electric**.Dibangun sebagai
aplikasi Next.js **terpisah** yang memakai **database MySQL yang sama** dengan
storefront, sehingga admin bisa mengelola katalog lewat web tanpa menyentuh SQL
dan tanpa risiko merusak toko yang sedang melayani pelanggan.

```
rizqyutamaelectric/              panel-rizqyutamaelectric/  ← repo ini
  storefront Next.js :3000          panel admin Next.js :3001
  (tidak diubah sama sekali)         (read + write)
            │                                  │
            └────────────► MySQL ◄──────────────┘
                  database: rizqyutamaelectric
              products · categories · users
```

- **Satu database, dua aplikasi** — tidak ada replikasi, tidak ada tabel baru,
  tidak ada migrasi.
- **Storefront tidak pernah disentuh** — panel hanya membaca dan menulis ke
  tabel yang sudah ada.
- **Perubahan langsung terlihat** — produk baru, harga baru, atau status
  aktif/nonaktif langsung tampil di toko tanpa deploy.

## Dokumentasi

| Dokumen | Isi |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Product Requirements: tujuan, ruang lingkup, persyaratan fungsional & non-fungsional, kriteria penerimaan |
| [docs/ERD.md](docs/ERD.md) | Entity Relationship Diagram, definisi kolom, DDL, aturan integritas |
| [docs/ADMIN.md](docs/ADMIN.md) | Panduan operasional: konfigurasi, akun admin, fitur, keamanan, pemecahan masalah |

## Fitur

- **Login/logout** dengan cookie session bertanda tangan HMAC-SHA256
  (`httpOnly`, `sameSite=lax`, `Secure` di produksi). Hanya user
  `is_admin = 1` yang bisa masuk, dan statusnya dicek ulang ke database pada
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
  termasuk batas kolom MySQL, jadi tidak ada error 500 dari form.

## Kebutuhan Sistem

- Node.js 20+ (dibangun & diuji pada v24)
- MySQL 8 yang sudah berisi database `rizqyutamaelectric`
- Database dan kredensial MySQL untuk storefront

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
| `MYSQL_HOST` | ya | default `127.0.0.1` |
| `MYSQL_PORT` | ya | default `3306` |
| `MYSQL_USER` | ya | user MySQL |
| `MYSQL_PASSWORD` | tidak | kosongkan bila tanpa password |
| `MYSQL_DATABASE` | ya | harus `rizqyutamaelectric` |
| `SESSION_SECRET` | **wajib** | Kunci HMAC penandatangan cookie. Generate: `openssl rand -base64 32`. **Jangan dipakai ulang antar instalasi.** |
| `ADMIN_PUBLIC_URL` | ya | Origin publik panel, mis. `https://admin.tokomu.com`. Dipakai menyusun URL gambar. |
| `NEXT_PUBLIC_STOREFRONT_URL` | ya | Origin toko, untuk tombol "Lihat Toko". |
| `NEXT_PUBLIC_STORE_NAME` | tidak | Nama toko yang ditampilkan. |
| `NEXT_PUBLIC_WA_NUMBER` | tidak | Nomor WhatsApp toko. |
| `ADMIN_SESSION_HOURS` | tidak | Masa berlaku sesi, default `8`. |
| `ADMIN_COOKIE_SECURE` | tidak | Override flag `Secure`; set `false` **hanya** untuk uji lokal via HTTP. |

> `ADMIN_PUBLIC_URL` harus sama dengan origin yang dipakai membuka panel,
> karena URL gambar disimpan apa adanya di kolom `products.image`.
>
> Cookie session memakai flag `Secure` otomatis saat `NODE_ENV=production`.
> Browser tidak mengirim cookie `Secure` lewat HTTP, jadi `npm start` di
> `http://localhost` perlu `ADMIN_COOKIE_SECURE=false` untuk pengujian lokal.

## Akun Admin

| Email | Password |
| --- | --- |
| `admin@rizqyutama.com` | `admin123` |

**Ganti password ini sebelum dipakai sungguhan.** Panel hanya menerima user
dengan `is_admin = 1`; menambah admin lain cukup dengan menyisipkan baris
`users` berisi hash bcrypt.

## Struktur Proyek

```
app/
  actions/            Server Action: auth, produk, kategori
  admin/login/        Halaman login
  admin/(panel)/      Layout + dashboard, produk, kategori
  uploads/[...path]/  Route handler penyaji file gambar
  robots.ts           Melarang perayapan seluruh panel
components/admin/     Sidebar, form produk/kategori, tombol, header
lib/
  auth.ts             verifySession() & assertAdmin()
  db.ts               Koneksi & helper query (prepared statement)
  session.ts          Pembuatan/pembacaan cookie session
  session-token.ts    Tanda tangan HMAC + validasi kedaluwarsa
  slug.ts, slugify.ts Slug unik & normalisasi
  upload.ts           Simpan, baca, hapus file gambar
  format.ts, types.ts Format Rupiah/tanggal & tipe data
proxy.ts              Saringan awal untuk /admin/*
uploads/              File gambar hasil unggahan (bukan public/)
docs/                 PRD, ERD, panduan admin
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
- Seluruh query memakai prepared statement (`mysql2`).
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
| mysql2 | ^3.24.4 |
| bcryptjs | ^3.0.2 |

Tanpa ORM — seluruh akses data memakai prepared statement `mysql2` di
`lib/db.ts`. Versi `0.1.0`, lisensi privat.
