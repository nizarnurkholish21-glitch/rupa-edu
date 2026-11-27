# RUPA EDU

**Belajar. Menemukan. Berkarya. Berbagi.**

RUPA EDU adalah ekosistem untuk menemukan, memahami, dan menciptakan pengetahuan: pencarian publik bersumber, ruang belajar siswa, ruang kerja guru, studio karya, dan (kelak) marketplace yang aman bagi kreator muda.

Repositori ini dibangun bertahap. Setiap fase baru dimulai setelah gerbang uji fase sebelumnya lulus.

| Fase | Isi | Status |
| --- | --- | --- |
| 0 · Discovery | Analisis, arsitektur, risiko, roadmap | Selesai |
| 1 · Fondasi | Design system, akun & peran, isolasi data sekolah (RLS), pencarian publik awal, halaman dasar | **Selesai dan teruji** (lihat [status fitur](docs/status-fitur.md)) |
| 2a · Perpustakaan | Unggah buku (.pdf/.txt), nomor halaman cetak, bab, tinjauan admin, akses per sekolah, pembaca & pencarian isi | **Selesai, teruji di database**; antarmuka login belum diuji ke Supabase sungguhan |
| 2b · LMS | Kelas, modul pekanan, tugas, nilai | Berikutnya |
| 3–8 | AI belajar, praktik & karya, operasi sekolah, Explore & Atlas, marketplace, produksi | Direncanakan |

## Untuk pemilik proyek (tanpa latar belakang programming)

Anda tidak perlu menjalankan apa pun di komputer sendiri. Ikuti **[Panduan setup gratis](docs/panduan-setup-gratis.md)** untuk:

1. Menampilkan situs secara online di Vercel (gratis). Tanpa database pun situs sudah bisa dibuka dan pencarian demo sudah berjalan.
2. Menghubungkan Supabase (gratis) agar login dan peran pengguna aktif.
3. Menjadikan akun Anda super admin, lalu mengunggah buku di **Kelola buku** (lihat [panduan perpustakaan](docs/perpustakaan.md)).

> **Batas paket gratis:** Vercel Hobby hanya untuk pemakaian pribadi/non-komersial; proyek Supabase gratis dijeda bila tidak aktif seminggu dan tidak memiliki backup. Cukup untuk pengembangan dan demo. **Jangan memasukkan data siswa sungguhan** sebelum paket, perjanjian dengan sekolah, dan persetujuan wali ditinjau.

## Struktur

```
src/app/              Halaman (Next.js App Router): beranda, /cari, /pengetahuan/[slug], /masuk, /ruang, /cakupan, /privasi, /status
src/components/       Komponen tampilan (header, kotak pencarian, tema)
src/lib/              Logika: konfigurasi integrasi, auth & peran, pencarian
src/styles/           tokens.css (dibuat dari design/tokens.json) + globals.css
src/content/          Konten demo (berlabel demo)
design/               Token & brand book dari design system RUPA EDU
supabase/migrations/  Skema database + Row-Level Security
supabase/seed.sql     Konten demo untuk database (dibuat otomatis)
scripts/              Skrip bantu: token CSS, seed SQL, akun demo, cek kebocoran rahasia
tests/unit/           Tes unit
tests/db/             Tes isolasi peran & sekolah di PostgreSQL sungguhan
docs/                 Panduan, arsitektur, status fitur, keputusan
```

## Untuk developer

```bash
npm ci
cp .env.example .env.local     # boleh dibiarkan kosong: situs berjalan dengan konten demo
npm run dev                    # http://localhost:3000
npm test                       # tes unit
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db   # tes RLS (butuh PostgreSQL 15+)
npm run build && npm run check:secrets
```

Setelah mengubah `design/tokens.json`, jalankan `node scripts/build-tokens.mjs`. Setelah mengubah `src/content/demo-items.json`, jalankan `npm run seed:sql`.

Dokumen lain: [arsitektur](docs/arsitektur.md) · [pengujian](docs/pengujian.md) · [keputusan](docs/keputusan.md) · [status fitur](docs/status-fitur.md).

## Prinsip yang tidak boleh dilanggar

- Pencarian dan konten publik bisa dipakai tanpa login.
- Hak akses ditegakkan di database (Row-Level Security), bukan hanya disembunyikan di menu.
- Tidak ada integrasi, data, atau hasil tes yang dipalsukan. Kunci yang belum ada = "belum dikonfigurasi".
- Data contoh selalu berlabel demo. Sumber dan lisensi selalu ditampilkan.
- AI adalah pendamping, bukan pengganti guru, dan tidak boleh mengarang sumber.

## Lisensi pihak ketiga

Font Plus Jakarta Sans (Tokotype) dan Fraunces (Undercase Type) berlisensi SIL Open Font License 1.1; salinan lisensi ada di `public/fonts/`.
