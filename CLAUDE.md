# Catatan untuk agen yang bekerja di repo ini

- Bahasa antarmuka dan dokumentasi: Bahasa Indonesia. Sapaan "Anda" di ruang publik/guru/admin, "kamu" di ruang siswa.
- Pedoman produk: Master Prompt RUPA EDU (di Project "Rupa Edu") dan dokumen Tahap 0. Bangun per fase; jangan tandai fitur selesai tanpa tes. Perbarui `docs/status-fitur.md` di akhir setiap fase.
- Hak akses ditegakkan di database. Setiap tabel baru: aktifkan RLS, tulis policy, dan tambah kasus di `tests/db/rls.test.ts` untuk setiap peran.
- Aplikasi web hanya memakai anon key. Jangan pernah memakai service role key di `src/`.
- Nilai desain hanya dari `design/tokens.json` (jalankan `node scripts/build-tokens.mjs`). Jangan menulis warna hex di komponen.
- Konten contoh harus `is_demo = true` dan berlabel Demo. Jangan mengarang sumber, URL, atau lisensi.
- Integrasi tanpa kunci menampilkan "belum dikonfigurasi"; jangan membuat tombol yang tidak berfungsi.
- Sebelum selesai: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build && npm run check:secrets`.
