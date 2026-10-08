# Panel Admin Rizqy Utama Electric

Panel administrasi terpisah untuk toko online Rizqy Utama Electric.
Panel ini adalah aplikasi Next.js **mandiri** yang memakai **database Supabase
(Postgres) yang sama** dengan storefront. Tidak ada tabel baru dan tidak ada
migrasi — panel hanya membaca dan menulis ke tabel yang sudah ada. MySQL
tersedia sebagai cadangan bila `SUPABASE_DB_URL` dikosongkan.

```
~/Documents/rizqyutamaelectric/      -> storefront, port 3000  (tidak diubah)
~/Documents/panel-rizqyutamaelectric/ -> panel admin, port 3001 (aplikasi ini)
                 \                             /
                  \_________ Supabase _________/
                   Postgres (SUPABASE_DB_URL)
```

## Menjalankan

```bash
npm install
cp .env.example .env.local   # lalu isi SUPABASE_DB_URL dkk.
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

> `npm run dev` tidak otomatis menyalakan database apa pun. Kalau Supabase
> tidak bisa dihubungi, panel menampilkan "Database tidak tersedia" —
> diagnosanya ada di [Pemecahan masalah](#pemecahan-masalah).

## Menyiapkan database

Skema yang dipakai panel **sudah ada di Supabase** (dibuat oleh storefront):
`users`, `categories`, `products` dengan kolom boolean `is_admin`,
`featured`, `is_active` serta `created_at`/`updated_at timestamptz`.

**1. Ambil connection string**

Supabase Dashboard → **Settings → Database → Connection string → URI**
(mode **Session** / pooler), atau salin `SUPABASE_DB_URL` dari
`rizqyutamaelectric/.env.local`. Tempel ke `.env.local` panel:

```bash
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<password>@<host>:5432/postgres
```

Panel memakai SSL `rejectUnauthorized: false` karena pooler Supabase memakai
sertifikat yang tidak tercentang CA lokal.

**2. Pastikan skema & data ada** — kalau tabel belum pernah dibuat, jalankan
sekali `rizqyutamaelectric/supabase/schema.sql` di Supabase **SQL Editor**.
Skrip itu membuat tabel, indeks, data contoh, serta akun admin.

**3. Pastikan ada akun admin** — `password` diisi **hash bcrypt**, bukan teks
biasa. Hash bisa dibuat tanpa database:

```bash
node -e "console.log(require('bcryptjs').hashSync('admin123', 12))"
```

```sql
insert into users (name, email, password, is_admin)
values ('Admin Toko', 'admin@rizqyutama.com', '<hash bcrypt>', true);
```


## Konfigurasi (.env.local)

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `SUPABASE_DB_URL` | **ya** | Connection string Postgres Supabase (mode Session/pooler). Selama variabel ini terisi, panel memakai Postgres — sama dengan storefront. |
| `MYSQL_HOST` | tidak | **Cadangan.** default `127.0.0.1`; hanya dipakai bila `SUPABASE_DB_URL` kosong. |
| `MYSQL_PORT` | tidak | default `3306`. |
| `MYSQL_USER` | tidak | user MySQL. |
| `MYSQL_PASSWORD` | tidak | kosongkan bila tanpa password. |
| `MYSQL_DATABASE` | tidak | harus `rizqyutamaelectric`. |
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

Panel hanya menerima user dengan `users.is_admin = true` (MySQL: `1`). User
non-admin tetap tidak bisa login.

Akun awal:

| Email | Password |
| --- | --- |
| `admin@rizqyutama.com` | `admin123` |

**Ganti password ini sebelum dipakai sungguhan.** Untuk membuat admin lain,
tambah baris di tabel `users` dengan `is_admin = true` dan isi `password`
dengan hash bcrypt (bukan teks biasa).

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
  Halaman login dilindungi `proxy.ts`; pemeriksaan ulang `is_admin` ke
  database dilakukan pada setiap permintaan sehingga pencabutan akses admin
  langsung berlaku tanpa menunggu cookie kedaluwarsa.
- Halaman panel diberi `robots: noindex`.
- Unggahan dibatasi jenis file, ukuran, dan nama file selalu dibuat server.
- Query memakai prepared statement (`pg` untuk Supabase, `mysql2` untuk
  cadangan MySQL), bukan string SQL gabungan.

## Catatan teknis

- **Next.js 16** memakai `proxy.ts` (bukan `middleware.ts` yang sudah
  deprecated).
- `experimental.serverActions.bodySizeLimit` di-set `"3mb"` di
  `next.config.ts` supaya unggahan 2 MB tidak ditolak sebelum sampai ke action.
- Server Action yang memanggil `redirect()` harus memanggilnya **di luar**
  `try/catch` karena `redirect()` bekerja dengan melempar exception.
- Tidak ada ORM; seluruh akses data lewat `query()` di `lib/db.ts` — driver
  `pg` bila `SUPABASE_DB_URL` terisi, `mysql2` bila tidak. Placeholder `?`
  ditulis sekali lalu dikonversi otomatis ke `$1, $2, ...` untuk Postgres;
  nilai `boolean` dikonversi ke `1/0` saat memakai MySQL.
- Halaman admin semuanya dinamis (`force-dynamic`) agar data tidak pernah
  basi.

## Fallback: MySQL (opsional)

Supabase adalah database utama. MySQL **hanya** dipakai bila `SUPABASE_DB_URL`
di `.env.local` dikosongkan — begitu nilainya kosong, `lib/db.ts` otomatis
beralih ke driver `mysql2` dengan SQL (`?`) dan tabel yang sama.

Kalau MySQL dipakai, panel tidak menjalankan database-nya sendiri; ia hanya
**menyambung**. Kalau port 3306 belum ada yang listening, panel tidak bisa masuk.

Kalau MySQL sudah terinstall sebagai service di mesin ini, jalankan seperti
biasa (`sudo systemctl start mysql`). Untuk development lokal tanpa root,
MySQL 8.4 portable sudah disiapkan di luar repo pada
`~/mysql-portable/`:

```bash
~/mysql-portable/bin/start.sh    # nyalakan, tunggu sampai siap
~/mysql-portable/bin/stop.sh     # matikan
```

Cek portnya:

```bash
node -e "require('net').connect(3306,'127.0.0.1',function(){console.log('OK');process.exit(0)}).on('error',function(e){console.log(e.code);process.exit(1)})"
```

Kalau gagal start, baca log: `tail -40 ~/mysql-portable/logs/mysqld.log`.

| Isi folder | Keterangan |
| --- | --- |
| `dist/` | MySQL 8.4.10 (glibc generic, build minimal) |
| `data/` | datadir — **isi data asli ada di sini, jangan dihapus** |
| `my.cnf` | konfigurasi: `datadir`, `port 3306`, `bind-address 127.0.0.1`, `mysqlx=0` |
| `lib/` | `libaio.so.1` & `libnuma.so.1`, diambil manual karena tidak ada di sistem |
| `logs/`, `run/` | log error, socket, pid |

> **Port 3306 hanya menerima koneksi dari `127.0.0.1`.** Komponen ini untuk
> development di satu mesin. Untuk dipakai bersama mesin lain atau di server
> publik, pindahkan MySQL ke instalasi sungguhan (service/`systemd` atau
> container) dan set kredensial lewat `.env.local`.

Panel dan storefront bisa memakai MySQL yang **sama** — cukup dinyalakan
sekali untuk keduanya.

## Pemecahan masalah

**`Database tidak tersedia. Pastikan server Supabase (atau MySQL) sedang bisa
dihubungi.`**

Koneksi ke database gagal (timeout, koneksi putus, port tertutup). Untuk
Supabase:

- Pastikan `SUPABASE_DB_URL` terisi dan sama persis dengan milik storefront.
- Cek koneksi internet — pooler Supabase ada di cloud, bukan `localhost`.
- Koneksi timeout dibatasi 15 detik; pool `pg` menyambung kembali otomatis,
  jadi **tidak perlu** restart `npm run dev` setelah jaringan pulih.
- Halaman login menampilkan pesan ini tanpa stack trace. Halaman lain
  (dashboard, produk, kategori) masih akan 500 selama database mati.

**`password authentication failed for user "postgres"`**

Password di `SUPABASE_DB_URL` salah atau connection string sudah basi. Salin
ulang dari Supabase Dashboard → Settings → Database → Connection string (URI),
atau dari `rizqyutamaelectric/.env.local`.

**`error: connect ECONNREFUSED 127.0.0.1 (3306)`** *(hanya saat memakai MySQL
fallback)*

Artinya tidak ada proses yang listening di port 3306 — MySQL belum jalan.
Kredensial dan nama database belum diperiksa, jadi pesan ini **bukan** masalah
password. Diagnosis:

```bash
node -e "const n=require('net');const s=n.connect(3306,'127.0.0.1',()=>{console.log('port 3306 terbuka');s.end()});s.on('error',e=>console.log('port tertutup:',e.code))"
```

- Port tertutup → jalankan `~/mysql-portable/bin/start.sh` (atau nyalakan
  service MySQL sistem), lalu coba login lagi. Pool `mysql2` otomatis
  menyambung kembali begitu server hidup, jadi **tidak perlu** restart
  `npm run dev`.
- Port terbuka tapi tetap `ECONNREFUSED` → `MYSQL_HOST`/`MYSQL_PORT` di
  `.env.local` menunjuk ke host lain; samakan dengan lokasi MySQL sebenarnya.
- Pesan versi database memakai `root` **tanpa password**; kalau server Anda
  memakai password, isi `MYSQL_PASSWORD` di `.env.local`.

**`Access denied for user 'root'@'localhost'`**
Password di `.env.local` tidak cocok dengan password root MySQL. Password
`root` bawaan hasil `--initialize-insecure` memang kosong.

**`Unknown database 'rizqyutamaelectric'`**
Database MySQL belum dibuat — ini hanya mungkin terjadi saat memakai fallback.
Ikuti [Menyiapkan database](#menyiapkan-database) untuk jalur Supabase, atau
buat database MySQL mengikuti DDL di [ERD.md](./ERD.md).

**Gambar produk 404 setelah diunggah**
Pastikan `ADMIN_PUBLIC_URL` sama dengan origin yang dipakai untuk membuka
panel, lalu coba buka URL gambar langsung di address bar.

**Login tidak berhasil setelah `npm start` di localhost**
Cookie `Secure` tidak terkirim lewat HTTP. Set `ADMIN_COOKIE_SECURE=false`
untuk pengujian lokal.

**Produk tidak muncul di toko**
Toko hanya menampilkan produk dengan `is_active = true`. Cek statusnya di
`/admin/produk`.

**Halaman kosong / 500 setelah menambah environment variable**
Restart server. Nilai `NEXT_PUBLIC_*` di-inline saat build, jadi perlu
`npm run build` ulang.
