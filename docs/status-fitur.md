# Status fitur — akhir Tahap 1 (27 Nov 2026)

Label: **Teruji** = dibangun dan lulus tes otomatis/manual yang dicatat · **Belum diverifikasi** = dibangun, belum diuji terhadap layanan sungguhan · **Menunggu kredensial** · **Direncanakan** · **Tidak dikerjakan**.

## Gerbang Fase 1: isolasi peran dan tenant — LULUS

`npm run test:db`: **38/38 lulus** di PostgreSQL 16 (27 Nov 2026). Tes pertama menemukan satu bug nyata (staf tidak bisa menulis konten publik karena izin fungsi `topics_text`); sudah diperbaiki dan diberi tes.

## Matriks

| Fitur | Status | Bukti |
| --- | --- | --- |
| Skema database Fase 1 (sekolah, profil, peran, tahun ajaran, kelas, guru kelas, pendaftaran, wali, persetujuan, audit, konten publik) | Teruji | Migration diterapkan bersih ke PostgreSQL 16 |
| Row-Level Security per peran (anon, siswa, guru, wali, admin sekolah, super admin) | Teruji | `tests/db/rls.test.ts` |
| Jejak audit hanya-tambah lewat `log_event()` | Teruji | `tests/db/rls.test.ts` |
| Pencatatan persetujuan oleh wali terverifikasi | Teruji (database) | `tests/db/rls.test.ts`; antarmukanya Fase 4 |
| Pencarian publik tanpa login (full-text Bahasa Indonesia + toleransi salah ketik) | Teruji | Tes RLS (versi database) + `tests/unit/search.test.ts` (versi demo lokal) |
| Saran ejaan ("Mungkin maksud Anda") dan alasan relevansi | Teruji | Tes unit + pemeriksaan visual |
| Halaman beranda, hasil cari, detail pengetahuan, cakupan, privasi, status, 404, galat | Teruji (manual) | Semua rute 200/404 sesuai; tangkapan layar desktop & HP, terang & gelap; tanpa luapan horizontal di 390px |
| Design system (token, font, logo) terpasang dari satu sumber | Teruji | `design/tokens.json` → `src/styles/tokens.css` |
| Tema terang/gelap mengikuti perangkat + tombol ganti | Teruji (manual) | Tangkapan layar |
| Navigasi keyboard: tautan "Lompat ke konten", fokus terlihat | Teruji (manual) | Tab pertama = "Lompat ke konten" |
| Header keamanan (nosniff, frame DENY, referrer, permissions, HSTS) | Teruji | `curl -I` |
| Tidak ada rahasia di bundle browser | Teruji | `npm run check:secrets` |
| Ketahanan bila Supabase tidak terjangkau (pencarian jatuh ke demo berlabel, /ruang dialihkan ke /masuk) | Teruji (manual) | Dijalankan dengan URL Supabase palsu |
| Login email + kata sandi, keluar, perlindungan /ruang | Belum diverifikasi | Kode lengkap; perlu proyek Supabase (Bagian B panduan setup) |
| Ruang per peran (/ruang) | Belum diverifikasi | Menampilkan peran dan rencana fitur, tanpa tombol palsu |
| Skrip akun demo | Belum diverifikasi | Perlu proyek Supabase + service role key |
| CI GitHub Actions (lint, tipe, tes unit, tes RLS, build, cek rahasia) | Teruji | Run pertama di GitHub lulus semua langkah (27 Nov 2026) |
| Claude API | Menunggu kredensial | Dipakai mulai Fase 3 |
| Pencarian semantik (embedding) | Direncanakan | Penyedia belum dipilih |
| Autocomplete, riwayat pencarian, command palette | Direncanakan | Fase 6 (riwayat hanya dengan kontrol privasi) |
| Pemulihan kata sandi lewat email | Direncanakan | Butuh layanan email |
| Audit aksesibilitas otomatis (axe), Core Web Vitals | Direncanakan | Sebelum Fase 8 |
| Content-Security-Policy ketat | Direncanakan | Fase 8 |
| Admin UI untuk membuat sekolah, kelas, dan akun | Direncanakan | Fase 2 |

## Risiko tersisa

- Paket gratis: tanpa backup dan non-komersial. Jangan memasukkan data siswa sungguhan.
- Login belum diuji terhadap Supabase sungguhan; uji manual begitu proyek Supabase dibuat.
- Belum ada penanggung jawab teknis untuk pembaruan keamanan dependensi.
