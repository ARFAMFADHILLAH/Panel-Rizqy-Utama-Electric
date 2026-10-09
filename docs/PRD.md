# PRD — Panel Admin Rizqy Utama Electric

| Aspek | Nilai |
| --- | --- |
| Produk | Panel Admin Rizqy Utama Electric |
| Versi | 1.0 |
| Status | Selesai diimplementasikan |
| Port | 3001 |
| Basis data | Supabase (Postgres) `rizqyutamaelectric` (dipakai bersama storefront); MySQL sebagai cadangan |

Dokumen ini menjelaskan **apa** yang harus ada di panel administrasi, **siapa**
yang memakainya, dan **kapan** dianggap selesai. Peta data ada di
[ERD.md](./ERD.md).

---

## 1. Latar Belakang

Toko online Rizqy Utama Electric berjalan sebagai aplikasi Next.js di port 3000.
Produk, kategori, harga, dan stoknya berada di database yang sama dengan
storefront (Supabase/Postgres). Pada saat itu
belum ada antarmuka untuk mengelola katalog: setiap perubahan harus dilakukan
melalui SQL secara manual, yang rawan salah dan tidak memiliki jejak audit.

Storefront adalah aplikasi yang **sudah dipakai pelanggan**, sehingga risikonya
terlalu tinggi untuk dimodifikasi. Solusinya adalah membuat panel administrasi
sebagai **aplikasi terpisah** yang berbagi database yang sama, sehingga:

- storefront tidak perlu diubah sama sekali (nol risiko regresi ke pelanggan),
- katalog bisa dikelola lewat antarmuka web biasa,
- panel bisa diamankan secara penuh karena tidak terekspos ke publik.

## 2. Tujuan

| # | Tujuan | Ukuran keberhasilan |
| --- | --- | --- |
| G1 | Admin dapat mengelola katalog tanpa menyentuh SQL | Semua operasi CRUD produk & kategori tersedia lewat UI |
| G2 | Perubahan panel langsung terlihat di storefront | Perubahan tampil di `:3000` tanpa rebuild atau deploy ulang |
| G3 | Storefront tidak terganggu | Tidak ada file storefront yang berubah |
| G4 | Panel aman dari akses tidak sah | Setiap halaman dan setiap mutasi menolak non-admin |
| G5 | Tidak ada tabel baru atau migrasi | Skema database tetap sama seperti sebelum panel dibuat |

## 3. Non-Tujuan (di luar lingkup)

Panel ini **secara sengaja tidak** mencakup:

- Manajemen pesanan, pembayaran, dan pengiriman (tokoclosing tidak menyimpan pesanan).
- Manajemen pelanggan dan user non-admin.
- Pengaturan toko, Appearance, atau konten marketing.
- Multi-admin dengan hak akses berbeda (saat ini semua admin memiliki hak penuh).
- Audit log perubahan dan undo.
- Multi-branch atau multi-currency.

## 4. Pengguna

| Peran | Kebutuhan | Akses |
| --- | --- | --- |
| Admin toko | Menambah/mengubah/hapus produk, atur harga & stok, kelola kategori, melihat ringkasan | Login ke `/admin` |
| Pelanggan | Membeli dan melihat katalog | Toko `:3000`, tanpa login |
| Pengunjung | — | Diarahkan ke halaman login bila membuka `/admin` |

Hanya user dengan `users.is_admin = 1` yang boleh masuk. User non-admin dianggap
tidak ada sama sekali (pesan error identik dengan email tidak terdaftar).

## 5. Lingkup Fungsional

### FR-1 Autentikasi

| ID | Persyaratan |
| --- | --- |
| FR-1.1 | Admin login dengan email + password; kredensial dibandingkan terhadap hash bcrypt di `users.password`. |
| FR-1.2 | Hanya `is_admin = 1` yang diterima. User non-admin ditolak. |
| FR-1.3 | Pesan error sengaja dibuat generik ("Email atau password salah") untuk email salah maupun password salah, agar tidak membocorkan email yang terdaftar. |
| FR-1.4 | Email yang tidak terdaftar tetap undergoes verifikasi bcrypt terhadap hash palsu agar waktu respons seragam (mitigasi enumerasi user). |
| FR-1.5 | Login berhasil membuat cookie session bertanda tangan HMAC-SHA256 dengan `httpOnly`, `sameSite=lax`, dan `Secure` di produksi. |
| FR-1.6 | Sesi kedaluwarsa otomatis (default 8 jam, dapat dikonfigurasi). |
| FR-1.7 | Status admin **dicek ulang ke database pada setiap permintaan**, sehingga mencabut `is_admin` langsung memutus akses tanpa menunggu cookie kedaluwarsa. |
| FR-1.8 | Ada halaman logout yang menghapus cookie session. |
| FR-1.9 | Pengunjung yang membuka `/admin/*` tanpa session diarahkan ke `/admin/login?next=<path>`, dan setelah login kembali ke halaman yang dituju. |
| FR-1.10 | Parameter `next` hanya diterima bila diawali `/admin`, sehingga payload open-redirect eksternal ditolak. |

### FR-2 Dashboard

| ID | Persyaratan |
| --- | --- |
| FR-2.1 | Menampilkan 4 kartu statistik: jumlah produk, produk aktif, jumlah kategori, produk stok habis. |
| FR-2.2 | Menampilkan 8 produk terakhir yang diubah (urut `updated_at` lalu `id`). |
| FR-2.3 | Dashboard menampilkan status **Nonaktif** untuk produk nonaktif. |
| FR-2.4 | Setiap kartu statistik tertaut ke daftar terkait. |
| FR-2.5 | Bila database kosong, dashboard tetap tampil dengan angka nol dan pesan ajakan menambah produk, bukan error. |
| FR-2.6 | Ada tombol cepat "+ Produk Baru" dan "Lihat Toko". |

### FR-3 Manajemen Produk

| ID | Persyaratan |
| --- | --- |
| FR-3.1 | Menampilkan seluruh produk dalam tabel (nama, kategori, harga, stok, status, gambar). |
| FR-3.2 | Pencarian `?q=` mencocokkan nama **atau** SKU. |
| FR-3.3 | Filter `?kategori=<slug>` membatasi daftar ke satu kategori. |
| FR-3.4 | Hasil pencarian kosong menampilkan "0 produk ditemukan", bukan halaman kosong. |
| FR-3.5 | Admin dapat menambah produk baru melalui `/admin/produk/baru`. |
| FR-3.6 | Admin dapat mengubah produk melalui `/admin/produk/[id]/edit`. |
| FR-3.7 | Produk dapat diaktifkan/nonaktifkan (toggle cepat dari daftar). |
| FR-3.8 | Admin dapat menghapus produk, dengan konfirmasi. |
| FR-3.9 | Form memuat: nama, slug, SKU, kategori, deskripsi, harga, stok, gambar, checkbox **Featured** dan **Aktif**. |
| FR-3.10 | ID produk yang tidak valid (non-numerik, negatif, nol, atau tidak ada) menghasilkan **404**, bukan error 500. |
| FR-3.11 | Perubahan status aktif/nonaktif langsung mengubah tampilan di storefront. |

**Aturan validasi produk** (mengikuti batas kolom database agar tidak jadi error 500):

| Field | Aturan |
| --- | --- |
| Nama | Wajib, ≤ 255 karakter |
| Kategori | Wajib, harus id yang benar-benar ada |
| Harga | Angka bulat ≥ 0, maks `2.147.483.647` (`integer` / `int`) |
| Stok | Angka bulat ≥ 0, maks `2.147.483.647` (`integer` / `int`) |
| SKU | Opsional, ≤ 255 karakter, unik bila diisi |
| Deskripsi | Opsional, maks 65.535 byte (`TEXT`) |
| Slug | Otomatis bila kosong; unik |

### FR-4 Slug dan SKU

| ID | Persyaratan |
| --- | --- |
| FR-4.1 | Slug dibuat otomatis dari nama bila kolom slug dikosongkan. |
| FR-4.2 | Slug dinormalisasi: huruf kecil, tanda baca dihapus, karakter non-ASCII di-transliterasi (mis. `Çâé` → `cae`), emoji dibuang. |
| FR-4.3 | Slug yang bentrok otomatis diberi akhiran angka: `kabel`, `kabel-2`, `kabel-3`, ... |
| FR-4.4 | SKU yang sudah dipakai produk lain ditolak dengan pesan jelas. |
| FR-4.5 | Mengubah nama **tidak** mengubah slug yang sudah ada, kecuali slug diisi manual. |

### FR-5 Gambar Produk

| ID | Persyaratan |
| --- | --- |
| FR-5.1 | Gambar dapat dipasang dengan **unggah file** (JPEG/PNG/WEBP/GIF, maks 2 MB) atau dengan **URL** absolut `http(s)` / path diawali `/`. |
| FR-5.2 | Nama file dibuat oleh server (`<timestamp>-<random>.<ext>`); nama file dari browser tidak pernah dipakai. |
| FR-5.3 | File non-gambar (txt, svg, pdf, php) ditolak berdasarkan MIME type. |
| FR-5.4 | File kosong (0 byte) diperlakukan sebagai "tidak memilih file", bukan error. |
| FR-5.5 | URL gambar > 255 karakter ditolak (batas kolom `varchar(255)`). |
| FR-5.6 | Admin dapat menghapus gambar produk tanpa menghapus produknya. |
| FR-5.7 | File lama di disk dihapus saat produk dihapus atau gambarnya diganti, **hanya** bila tidak ada produk lain yang memakai URL yang sama. |
| FR-5.8 | URL gambar eksternal tidak pernah dihapus dari disk. |
| FR-5.9 | Gambar dapat diakses lewat `/uploads/<nama-file>` tanpa rebuild. |

### FR-6 Manajemen Kategori

| ID | Persyaratan |
| --- | --- |
| FR-6.1 | Admin dapat menambah kategori (nama + slug opsional). |
| FR-6.2 | Slug kategori unik dengan suffix otomatis bila bentrok. |
| FR-6.3 | Admin dapat menghapus kategori. |
| FR-6.4 | Kategori yang masih dipakai produk **menolak dihapus**, baik di UI maupun di Server Action, untuk mencegah penghapusan massal diam-diam. |
| FR-6.5 | Nama kategori wajib diisi, ≤ 255 karakter. |

### FR-7 Integrasi Storefront

| ID | Persyaratan |
| --- | --- |
| FR-7.1 | Panel dan storefront membaca/menulis tabel yang sama, tanpa replikasi. |
| FR-7.2 | Produk baru, perubahan harga, dan status aktif langsung terlihat di storefront. |
| FR-7.3 | Toko hanya menampilkan produk `is_active = 1`; produk nonaktif menjadi 404 di halaman detailnya. |
| FR-7.4 | Panel tidak melakukan deploy, restart, atau rebuild pada storefront. |

### FR-8 Asisten AI Inventori (opsional)

| ID | Persyaratan |
| --- | --- |
| FR-8.1 | Menu "Asisten AI" hanya muncul dan dapat diakses oleh email yang terdaftar di `AI_ALLOWED_EMAILS`. Bila kosong, fitur nonaktif total (fail-closed). |
| FR-8.2 | Admin dapat memberi perintah bebas dalam bahasa Indonesia lewat chat; balasan di-stream. |
| FR-8.3 | Agent dapat membaca Google Sheets (service account) dengan header dibaca dinamis dari baris pertama; sheet dipilih lewat `GOOGLE_SHEETS_CONFIG` (mis. Alat Ukur, AC, extensible). |
| FR-8.4 | Agent dapat membaca produk, kategori, dan statistik dari database panel memakai query berparameter. |
| FR-8.5 | Agent dapat menyusun laporan (stok menipis, stok habis, ringkasan katalog) dari data nyata; dilarang mengarang angka. |
| FR-8.6 | Aksi tulis (tambah/ubah/impor) hanya menghasilkan **proposal**; tidak ada penulisan sebelum admin menekan tombol Konfirmasi. |
| FR-8.7 | Proposal ditampilkan sebagai kartu (field dan/atau daftar baris) di chat, dengan tombol Konfirmasi dan tautan ke halaman Produk. |
| FR-8.8 | Server Action konfirmasi memvalidasi ulang seluruh field memakai aturan yang sama dengan form Produk (pesan error identik), dan mengecek kategori + SKU kembali. |
| FR-8.9 | Impor dari sheet dibatasi 100 baris; baris tanpa nama/harga/stok atau SKU duplikat dilewati dan dilaporkan jumlahnya. |
| FR-8.10 | Endpoint `/api/ai/chat` memverifikasi cookie session + `users.is_admin` lalu mencocokkan email dengan allowlist; membalas JSON 401/403 (bukan redirect) dan menolak request dari luar origin panel. |
| FR-8.11 | Error sistem (API key bermasalah, sheet tidak terbaca) memicu notifikasi email dengan throttle; pesan ke chat memakai bahasa Indonesia, bukan stack trace. |
| FR-8.12 | Notifikasi email opsional (SMTP Gmail): produk diubah lewat AI, stok menipis, laporan harian terjadwal (`/api/cron/daily-report` + `CRON_SECRET`), dan error sistem. Kegagalannya tidak menggagalkan operasi inti; tanpa SMTP, fitur lain tetap jalan. |

## 6. Persyaratan Non-Fungsional

| ID | Kategori | Persyaratan |
| --- | --- | --- |
| NFR-1 | Keamanan | Setiap Server Action memeriksa ulang session admin — layout halaman tidak diandalkan sebagai penjaga karena action adalah entry point POST tersendiri. |
| NFR-2 | Keamanan | Seluruh query memakai prepared statement (`pg`/`mysql2`); tidak ada penggabungan string SQL dari input pengguna. |
| NFR-3 | Keamanan | Tanda tangan cookie diverifikasi dengan `timingSafeEqual`. |
| NFR-4 | Keamanan | Path traversal dicegah saat membaca/menghapus file upload; nama berawalan titik ditolak. |
| NFR-5 | Keamanan | Halaman panel diberi `robots: noindex`; `/robots.txt` melarang seluruh perayapan. |
| NFR-6 | Keamanan | File upload dilayani dengan `X-Content-Type-Options: nosniff` dan cache immutable. |
| NFR-7 | Performa | Semua halaman admin `force-dynamic` agar data katalog tidak pernah basi. |
| NFR-8 | Performa | Upload 2 MB tidak ditolak di layer server; `bodySizeLimit` Server Action disetel `"3mb"`. |
| NFR-9 | Usability | Pesan validasi berbahasa Indonesia dan spesifik menyebut batasannya. |
| NFR-10 | Kompatibilitas | Satu database, nol migrasi, nol tabel baru — tidak memutus storefront yang berjalan. |
| NFR-11 | Kualitas | `npm run lint` dan `npx tsc --noEmit` harus bersih. |
| NFR-12 | Bahasa | Antarmuka dan dokumentasi berbahasa Indonesia; angka & mata uang diformat `id-ID`. |

## 7. Alur Pengguna Utama

**Tambah produk**

```
Login → Dashboard → "+ Produk Baru" → isi form → simpan
     → produk tersimpan di DB → redirect ke /admin/produk → langsung tampil di toko :3000
```

**Ubah stok/harga**

```
Login → Produk → pilih produk → ubah field → simpan
     → revalidatePath → dashboard & daftar produk terbaru ikut ter-update
```

**Nonaktifkan produk sementara**

```
Login → Produk → klik toggle → is_active berbalik
     → produk hilang dari katalog & listing toko, tetap tersimpan di panel
```

**Tambah kategori**

```
Login → Kategori → isi nama → simpan
     → kategori baru langsung muncul di dropdown form produk & filter panel
```

**Pakai Asisten AI (ubah/impor produk)**

```
Login (email di AI_ALLOWED_EMAILS) → Asisten AI → tulis perintah
     → agent baca sheet/DB → tampil jawaban + kartu proposal
     → admin klik "Konfirmasi" → Server Action validasi ulang → tulis DB
     → revalidatePath → produk & notifikasi email terkirim
```

## 8. Arsitektur (ringkas)

```
rizqyutamaelectric/            panel-rizqyutamaelectric/
  Next.js :3000  (read-only        Next.js :3001  (read + write)
  dari sisi admin)                │
        │                         │
        └──────────── Supabase ───┘
                   db: rizqyutamaelectric
                products, categories, users
```

Prinsip yang dipegang:

- **Satu sumber kebenaran.** Tidak ada salinan data antar aplikasi.
- **Belum login, belum boleh.** `proxy.ts` menyaring lebih awal, tetapi
  keputusan final tetap diambil `verifySession()` dan `assertAdmin()`.
- **Validasi dekat dengan data.** Batas kolom diperiksa sebelum query, bukan
  setelahnya, agar pengguna mendapat pesan yang berguna alih-alih 500.

## 9. Kriteria Penerimaan (Acceptance Criteria)

Panel dianggap selesai bila semua butir berikut benar:

**Autentikasi**
- [x] Admin benar dapat login dan logout.
- [x] Password salah, email salah, dan user non-admin semuanya ditolak.
- [x] Cookie palsu, cookie kedaluwarsa, dan cookie tanpa tanda tangan ditolak.
- [x] Menonaktifkan `is_admin` langsung memutus akses.
- [x] 12 payload open-redirect pada `?next=` semuanya jatuh kembali ke `/admin`.

**Produk**
- [x] Tambah, ubah, toggle, dan hapus produk bekerja.
- [x] Slug otomatis & unik; SKU ganda ditolak.
- [x] Pencarian nama/SKU dan filter kategori bekerja.
- [x] 8 payload SQL injection tidak merusak data dan tidak membocorkan data.
- [x] ID edit tidak valid menghasilkan 404.
- [x] Nilai di luar batas kolom ditolak dengan pesan, bukan 500.

**Gambar**
- [x] Unggah, ganti, hapus, dan pasang URL eksternal bekerja.
- [x] File 2 MB diterima; > 2 MB ditolak.
- [x] MIME non-gambar ditolak; 0 byte diabaikan dengan baik.
- [x] Path traversal dan nama file berbahaya tidak membocorkan file proyek.
- [x] File lama terhapus dari disk, file yang masih dipakai tetap aman.

**Kategori**
- [x] Tambah dan hapus kategori bekerja; slug unik otomatis.
- [x] Kategori terpakai menolak dihapus di UI maupun action.

**Integrasi & kualitas**
- [x] Produk baru, perubahan harga, nonaktif/aktif terlihat di storefront.
- [x] `npm run build`, `npm run lint`, `npx tsc --noEmit` bersih.
- [x] `git status` storefront tetap bersih.

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Panel ditulis dengan database produksi | Kehilangan data | `proxy.ts` + `assertAdmin()` di setiap action; tidak ada action yang bisa dipanggil tanpa session |
| Tabrak slug/SKU | Error 500 saat disimpan | Slug unik otomatis, SKU dicek sebelum insert, batas kolom divalidasi |
| File upload menggantung di disk | Penyimpunan storage | File dihapus saat produk dihapus/gambar diganti, dan hanya bila tidak dipakai produk lain |
| Upload di `public/` selalu 404 di produksi | Gambar tidak tampil | Upload dipindah ke `uploads/` + route handler, bukan `public/` |
| Cookie `Secure` memblokir login lokal | Tidak bisa login via `npm start` | `ADMIN_COOKIE_SECURE=false` khusus pengujian lokal |
| Penghapusan kategori memicu cascade | Produk ikut terhapus massal | Hapus kategori yang masih dipakai ditolak di UI **dan** action |
| Input membentuk query berbahaya | Kebocoran / manipulasi data | Prepared statement + validasi tipe di layer aplikasi |
