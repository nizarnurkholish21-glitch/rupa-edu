# Pengujian

| Perintah | Menguji | Butuh |
| --- | --- | --- |
| `npm test` | Pencarian lokal (normalisasi, imbuhan, salah ketik, presisi multi-kata), pencegah open redirect, validitas konten demo | Node 20+ |
| `npm run test:db` | **Gerbang Fase 1**: isolasi peran dan sekolah lewat Row-Level Security pada PostgreSQL sungguhan | PostgreSQL 15+ dan `TEST_DATABASE_URL` |
| `npm run typecheck` / `npm run lint` | Tipe dan aturan kode | — |
| `npm run build` lalu `npm run check:secrets` | Build produksi dan memastikan tidak ada kunci rahasia di bundle browser | — |

## Cara kerja tes database

`tests/db/harness.ts` membuat database baru, memasang `tests/db/supabase-stub.sql` (peran `anon`/`authenticated`, schema `auth`, fungsi `auth.uid()` seperti di Supabase), semua file migration, lalu `supabase/seed.sql`. Setiap kasus uji berjalan sebagai peran `anon` atau `authenticated` dengan klaim JWT pengguna tertentu, di dalam transaksi yang di-rollback. Dengan begitu, yang diuji adalah aturan database yang sama dengan yang berjalan di Supabase.

`TEST_DATABASE_URL` harus menunjuk ke server PostgreSQL **khusus tes** dengan pengguna yang boleh membuat database. Jangan pernah mengarahkannya ke proyek Supabase sungguhan.

## Belum diuji otomatis (jujur)

- Alur login end-to-end terhadap Supabase sungguhan (butuh proyek Supabase; diuji manual setelah Bagian B panduan setup).
- Tes end-to-end di browser untuk seluruh halaman dijalankan secara manual (tangkapan layar, terang/gelap, desktop/HP) dan belum masuk CI.
- Audit aksesibilitas otomatis (axe) dan pengukuran Core Web Vitals: dijadwalkan sebelum Fase 8.
