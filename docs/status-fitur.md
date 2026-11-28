# Status fitur (diperbarui 27 Nov 2026, Fase 2a)

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

## Fase 2a · Perpustakaan — gerbang LULUS

Gerbang Master Prompt Fase 2 (perpustakaan): *satu buku nyata diproses dan dicari*. `tests/db/real-book.test.ts` dengan buku siswa *Dasar-Dasar Seni Rupa X Semester 2*: **6/6 lulus** (metadata, 3 bab pada hlm 1/53/109, pencarian "arsiran hatching" → hlm 17–18, "proyeksi ortogonal" → Bab 2, akses publik/privat). Tes ini butuh berkas buku dan hanya dijalankan lokal (`REAL_BOOK=…`), bukan di CI.

| Fitur | Status | Bukti |
| --- | --- | --- |
| Skema perpustakaan (buku, akses sekolah, halaman, bab, potongan) + RLS | Teruji | `tests/db/library.test.ts` 24/24 |
| Buku privat (non-Kementerian): isi hanya untuk siswa/guru/admin sekolah ber-akses, buku berstatus siap | Teruji | `library.test.ts` |
| Metadata & daftar bab publik; buku tertutup/draf tidak terlihat publik | Teruji | `library.test.ts` |
| Status "siap" wajib ditinjau manusia (constraint database) | Teruji | `library.test.ts` |
| Pemroses buku: halaman, nomor halaman cetak (arab/romawi, selisih bergeser), metadata & mapel, bab/unit (termasuk halaman pembuka unit), potongan | Teruji | `tests/unit/ingest.test.ts` 22/22 + 17 buku nyata (lihat `docs/perpustakaan.md`) |
| Pencarian isi buku (full-text Indonesia, cuplikan bertanda, halaman cetak) | Teruji | `library.test.ts` + uji buku nyata |
| Impor lewat skrip (`npm run import:books`) | Teruji | 17 buku (termasuk Prakarya Kerajinan X–XII) diimpor ke PostgreSQL lokal tanpa galat; pencarian anonim diuji |
| Ekstraksi PDF di browser (pdf.js) | Teruji (algoritma) | Dibandingkan dengan pdftotext pada 4 PDF: struktur bab sama di 3, satu bab ganda di 1 (tertangkap saat tinjauan) |
| Isi buku publik per buku (anon membaca & mencari; draf/buku privat tetap tertutup) | Teruji | `library.test.ts` (24 tes) |
| Pencarian isi menyertakan bab; pencarian judul bab | Teruji | `library.test.ts` + uji pada 14 buku (mis. "makrame" → Bab 4 SD V; "perspektif dua titik" → Bab Gambar Teknik) |
| Pengelompokan hasil Buku → Bab → halaman | Teruji | `tests/unit/group.test.ts` |
| Halaman Perpustakaan (cari semua buku), Jelajah bab, detail buku, pembaca per halaman + sumber/SIBI | Teruji (manual, produksi) | 28 Nov 2026 di rupa-edu.vercel.app: pengunjung tanpa login mencari "arsiran" → Bab 1 buku Dasar-Dasar Seni Rupa X Sem 2 |
| Kelola buku: daftar, tinjau bab/metadata/akses, terbitkan, unggah | Teruji (manual, produksi) | 28 Nov 2026: super admin mengunggah PDF (200 hlm, 97% nomor halaman), mengoreksi 1 bab palsu ("Menggambar Proyeksi", dari ekstraksi PDF), menerbitkan. Akses per sekolah belum dicoba (belum ada sekolah) |
| Hasil buku di pencarian umum (isi untuk yang berhak, kartu metadata untuk umum) | Belum diverifikasi | Butuh Supabase |
| OCR PDF pindaian | Direncanakan | Unggahan tanpa teks ditolak dengan pesan jelas |
| Gambar/halaman asli buku | Direncanakan | Menunggu keputusan penyimpanan & lisensi |
| Penyedia embedding & pencarian semantik | Direncanakan | Fase 3 |

**Catatan keamanan pengujian:** saya mencoba menjalankan layanan Supabase (auth + API) secara lokal untuk menguji antarmuka login, tetapi menjalankan program unduhan ditolak oleh pengaman lingkungan kerja. Antarmuka berlogin akan diuji begitu proyek Supabase Anda tersambung.

## Risiko tersisa

- Paket gratis: tanpa backup dan non-komersial. Jangan memasukkan data siswa sungguhan.
- Login belum diuji terhadap Supabase sungguhan; uji manual begitu proyek Supabase dibuat.
- Belum ada penanggung jawab teknis untuk pembaruan keamanan dependensi.
- Isi buku Kementerian dibuka untuk umum tanpa izin tertulis penerbitan ulang: disarankan meminta izin ke Pusat Perbukuan dan meninjaunya bersama konsultan hukum.
- Dua buku (SD IV, SMA XII) butuh koreksi struktur bab manual sebelum siap.
