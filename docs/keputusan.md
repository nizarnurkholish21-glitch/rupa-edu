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
9. **27 Nov 2026 · Buku privat secara bawaan; lisensi buku Kementerian dicatat "hak cipta dilindungi".** Alasan: halaman hak cipta buku menyatakan "Dilindungi Undang-Undang"; tidak ada lisensi terbuka tertulis. Konsekuensi: isi hanya untuk sekolah yang diberi akses; publik melihat metadata.
10. **27 Nov 2026 · Berkas PDF tidak disimpan; hanya teks per halaman.** Alasan: meminimalkan penyimpanan karya berhak cipta dan biaya penyimpanan di paket gratis. Konsekuensi: gambar dan tata letak asli tidak tampil.
11. **27 Nov 2026 · Struktur bab otomatis wajib ditinjau manusia.** Database menolak status "siap" tanpa `reviewed_at`.
12. **27 Nov 2026 · Unggah dibaca di browser (pdf.js), dikirim bertahap lewat sesi staf.** Alasan: tanpa service role key, tanpa batas waktu fungsi server di paket gratis.
13. **27 Nov 2026 · Isi buku Kementerian dibuka untuk umum (keputusan pemilik), dengan sumber dan tautan SIBI di setiap halaman.** Mengubah keputusan 9. Alasan pemilik: buku tersebut sudah bisa dibaca umum di SIBI. Risiko yang sudah disampaikan: tidak ada izin tertulis untuk penerbitan ulang di buku Kurikulum Merdeka. Mitigasi: atribusi, sakelar per buku, rekomendasi meminta izin tertulis ke Pusat Perbukuan.
14. **27 Nov 2026 · Pencarian per bab.** Hasil dikelompokkan Buku → Bab → halaman; judul bab ikut dicari; halaman jelajah bab per jenjang/kelas.
