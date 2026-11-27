# Catatan keputusan

Format: tanggal · keputusan · alasan · konsekuensi.

1. **27 Nov 2026 · Bangun bertahap dengan gerbang uji.** Alasan: Master Prompt Bagian 21; mencegah fitur setengah jadi. Konsekuensi: fitur besar muncul per fase.
2. **27 Nov 2026 · Proyek pribadi pemilik, bukan proyek resmi sekolah.** Konsekuensi: hanya data demo sampai ada perjanjian dengan sekolah dan persetujuan wali (UU PDP).
3. **27 Nov 2026 · Hosting gratis: Vercel Hobby + Supabase Free.** Alasan: pilihan pemilik. Konsekuensi: non-komersial, tanpa backup otomatis, proyek bisa dijeda. Ditinjau ulang sebelum data nyata atau transaksi.
4. **27 Nov 2026 · Next.js 15 + TypeScript + Supabase (PostgreSQL, RLS), modular monolith.** Alasan: rekomendasi Master Prompt Bagian 17, satu bahasa, minim perawatan. Konsekuensi: terikat ekosistem Supabase, tetapi data tetap PostgreSQL standar.
5. **27 Nov 2026 · AI: Claude lewat adapter netral (mulai Fase 3).** Konsekuensi: penyedia embedding untuk pencarian semantik masih perlu dipilih.
6. **27 Nov 2026 · Identitas visual RUPA EDU.** Logo R dari tiga bentuk dasar; palet indigo tarum, kunyit, terakota, hijau daun; Fraunces + Plus Jakarta Sans. Sumber tunggal: `design/tokens.json`.
7. **27 Nov 2026 · Pencarian Fase 1 memakai full-text PostgreSQL berkonfigurasi `indonesian` + trigram untuk salah ketik.** Alasan: gratis, tanpa layanan tambahan. Konsekuensi: pencarian semantik (makna) menyusul setelah penyedia embedding dipilih.
8. **27 Nov 2026 · Pendaftaran publik dimatikan.** Akun siswa/guru dibuat sekolah. Pendaftaran pengguna umum dibuka kembali ketika alur persetujuan dan moderasi siap.
