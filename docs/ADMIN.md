# Panel Admin Rizqy Utama Electric

Panel administrasi terpisah untuk toko online Rizqy Utama Electric.
Panel ini adalah aplikasi Next.js **mandiri** yang memakai **database MySQL
yang sama** dengan storefront. Tidak ada tabel baru dan tidak ada migrasi —
panel hanya membaca dan menulis ke tabel yang sudah ada.

```
Document/rizqyutamaelectric/      -> storefront, port 3000  (tidak diubah)
Document/panel-rizqyutamaelectric/ -> panel admin, port 3001 (aplikasi ini)
                 \                             /
                  \_________ MySQL ___________/
                    db: rizqyutamaelectric
```

## Menjalankan

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev                  # http://localhost:3001
```

Untuk produksi:

```bash
npm run build
npm start                    # http://localhost:3001
```

Perintah pendukung:

```bash
npm run lint                 # ESLint
npx tsc --noEmit             # cek tipe TypeScript
```

## Konfigurasi (.env.local)

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `MYSQL_HOST` | ya | default `127.0.0.1` |
| `MYSQL_PORT` | ya | default `3306` |
| `MYSQL_USER` | ya | user MySQL |
| `MYSQL_PASSWORD` | tidak | kosongkan bila tanpa password |
| `MYSQL_DATABASE` | ya | harus `rizqyutamaelectric` |
| `SESSION_SECRET` | **wajib** | kunci HMAC penandatangan cookie. Generate dengan `openssl rand -base64 32`. **Jangan pernah dipakai ulang antar instalasi.** |
| `ADMIN_PUBLIC_URL` | ya | origin publik panel, mis. `https://admin.tokomu.com`. Dipakai untuk menyusun URL gambar. |
| `NEXT_PUBLIC_STOREFRONT_URL` | ya | origin toko, mis. `https://tokomu.com`, untuk tombol "Lihat di toko". |
| `ADMIN_SESSION_HOURS` | tidak | masa berlaku sesi, default `8`. |
| `ADMIN_COOKIE_SECURE` | tidak | lihat catatan HTTPS di bawah. |
| `NEXT_PUBLIC_WA_NUMBER` | tidak | ditampilkan di panel. |

### Catatan penting soal `ADMIN_PUBLIC_URL`

Nilai ini **wajib** diisi dengan origin yang benar karena URL gambar disimpan
apa adanya di kolom `products.image`. Kalau panel diakses lewat
`http://localhost:3001` sementara `ADMIN_PUBLIC_URL` berisi domain lain,
gambar akan gagal dimuat.

### Cookie `Secure` dan HTTPS

Session cookie selalu memakai flag `Secure` saat `NODE_ENV=production`.
Browser **tidak** mengirim cookie `Secure` lewat HTTP biasa, jadi `npm start`
di `http://localhost` membuat login selalu gagal.

- Produksi (HTTPS): tidak perlu	set apa pun.
- Lokal via `npm run dev`: `NODE_ENV=development`, cookie tidak `Secure`, aman.
- Lokal via `npm start` di HTTP: set `ADMIN_COOKIE_SECURE=false` **hanya untuk
  pengujian lokal**. Jangan set ini di server yang bisa diakses publik.

## Akun admin

Panel hanya menerima user dengan `users.is_admin = 1`. User non-admin tetap
tidak bisa login.

Akun awal:

| Email | Password |
| --- | --- |
| `admin@rizqyutama.com` | `admin123` |

**Ganti password ini sebelum dipakai sungguhan.** Untuk membuat admin lain,
tambah baris di tabel `users` dengan `is_admin = 1` dan isi `password` dengan
hash bcrypt (bukan teks biasa).

```sql
SELECT id, name, email, is_admin FROM users;
```

## Fitur

- **Login/logout** dengan sesi cookie bertanda tangan HMAC-SHA256
  (`httpOnly`, `sameSite=lax`, `Secure` di produksi).
- **Dashboard**: jumlah produk, produk aktif, jumlah kategori, produk stok
  habis, plus 8 produk terakhir yang diubah.
- **Produk**: cari (nama/SKU), filter kategori, tambah, ubah, aktif/nonaktif,
  hapus, unggah gambar.
- **Kategori**: tambah dan hapus. Kategori yang masih dipakai produk tidak
  bisa dihapus — pindahkan atau hapus produknya dulu (menghapus kategori yang
  masih terpakai akan Cascade dan ikut menghapus produknya).
- Semua perubahan langsung terlihat di storefront karena **satu database**.

### Slug dan SKU

- Slug dibuat otomatis dari nama bila kolom slug dikosongkan.
- Slug yang bentrok otomatis diberi akhiran angka (`kabel`, `kabel-2`, ...).
- SKU opsional tapi harus unik bila diisi.
- Mengubah nama tidak mengubah slug yang sudah ada, kecuali slug diisi manual.

### Gambar produk

Ada dua cara memasang gambar:

1. **Unggah file** (disarankan) — JPEG/PNG/WEBP/GIF, maksimal 2 MB.
2. **Tempel URL** — URL absolut `http(s)` atau path diawali `/`
   (mis. `/produk/gambar.jpg` untuk gambar yang sudah ada di server toko).

File yang diunggah disimpan di folder `uploads/` (bukan `public/`) dan
dilayani route handler `/uploads/[...path]`.

> **Mengapa bukan `public/`?** Next.js memotret isi folder `public/` saat
> build. File yang diunggah setelah build **tidak akan dilayani** oleh
> `next start` dan selalu muncul 404. Karena itu upload memakai folder
> terpisah plus route handler, sehingga langsung bisa diakses tanpa rebuild.

Nama file dibuat oleh server sendiri (`<timestamp>-<random>.<ext>`); nama
file dari browser tidak pernah dipakai. Hanya ekstensi gambar yang
diizinkan, dan path traversal dicegah.

Gambar dihapus dari disk hanya saat produk dihapus atau gambarnya diganti,
**dan** tidak ada produk lain yang memakai URL yang sama. URL eksternal
tidak pernah dihapus.

## Perilaku keamanan

- Seluruh halaman dan **setiap Server Action** memeriksa sesi admin.
  Halaman login dilindungi `proxy.ts`; pemeriksaan ulang `is_admin = 1` ke
  database dilakukan pada setiap permintaan sehingga pencabutan akses admin
  langsung berlaku tanpa menunggu cookie kedaluwarsa.
- Halaman panel diberi `robots: noindex`.
- Unggahan dibatasi jenis file, ukuran, dan nama file selalu dibuat server.
- Query memakai prepared statement (`mysql2`), bukan string SQL gabungan.

## Catatan teknis

- **Next.js 16** memakai `proxy.ts` (bukan `middleware.ts` yang sudah
  deprecated).
- `experimental.serverActions.bodySizeLimit` di-set `"3mb"` di
  `next.config.ts` supaya unggahan 2 MB tidak ditolak sebelum sampai ke action.
- Server Action yang memanggil `redirect()` harus memanggilnya **di luar**
  `try/catch` karena `redirect()` bekerja dengan melempar exception.
- Tidak ada ORM; seluruh akses data memakai `mysql2` di `lib/db.ts`.
- Halaman admin semuanya dinamis (`force-dynamic`) agar data tidak pernah
  basi.

## Pemecahan masalah

**Gambar produk 404 setelah diunggah**
Pastikan `ADMIN_PUBLIC_URL` sama dengan origin yang dipakai untuk membuka
panel, lalu coba buka URL gambar langsung di address bar.

**Login tidak berhasil setelah `npm start` di localhost**
Cookie `Secure` tidak terkirim lewat HTTP. Set `ADMIN_COOKIE_SECURE=false`
untuk pengujian lokal.

**Produk tidak muncul di toko**
Toko hanya menampilkan produk dengan `is_active = 1`. Cek statusnya di
`/admin/produk`.

**Halaman kosong / 500 setelah menambah environment variable**
Restart server. Nilai `NEXT_PUBLIC_*` di-inline saat build, jadi perlu
`npm run build` ulang.
