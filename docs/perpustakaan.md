# Perpustakaan buku

## Kebijakan

- **Privat secara bawaan.** Isi buku (teks halaman, pencarian isi) hanya terlihat oleh siswa, guru, dan admin sekolah yang diberi akses, dan hanya setelah buku ditinjau ("siap"). Wali tidak membaca isi buku.
- **Metadata boleh publik.** Pengunjung umum melihat judul, penulis, jenjang, ISBN, lisensi, daftar bab, dan tautan ke sumber resmi (bila diisi).
- **Lisensi dicatat per buku.** Buku Kemendikbudristek/Kemendikdasmen mencantumkan *"Hak Cipta pada Kementerian… Dilindungi Undang-Undang"*; buku tersebut gratis dibaca dan diunduh lewat SIBI, tetapi tidak berlisensi terbuka. Karena itu lisensinya dicatat "Hak cipta dilindungi" dan isinya tidak ditampilkan untuk umum.
- **AI tidak memproses buku** sebelum staf mencentang "Izinkan diproses AI" (dipakai mulai Fase 3).
- **Berkas PDF asli tidak disimpan.** Yang disimpan hanya teks per halaman untuk dibaca dan dicari. Gambar, tabel, dan tata letak asli tidak ditampilkan; pembaca diarahkan ke buku aslinya untuk kutipan resmi.
- Bukan nasihat hukum. Tinjau kebijakan ini bersama konsultan sebelum peluncuran publik.

## Alur kerja staf

1. **Unggah** di `/admin/buku/unggah`: pilih berkas `.pdf` (disarankan) atau `.txt` hasil ekspor PDF. Berkas dibaca di browser; yang terkirim hanya teks.
2. Sistem membaca otomatis: metadata (judul, jenjang, kelas, penulis, ISBN, pemegang hak cipta), **nomor halaman cetak** dari header/footer berjalan, **struktur bab** dari daftar isi dan judul halaman, lalu memotong teks untuk pencarian.
3. **Tinjau** di `/admin/buku/<buku>`:
   - Bab bertanda **periksa**: judulnya tidak ditemukan di halaman awal yang diusulkan. Buka tautan "lihat", lalu koreksi nomor halaman awal atau judulnya.
   - Periksa metadata dan catatan lisensi; isi tautan sumber resmi bila ada.
   - Centang sekolah yang boleh membaca isi.
4. **Tandai siap.** Tanpa langkah ini, buku tidak terlihat oleh siswa (ditegakkan database).

Untuk developer: `npm run import:books -- <berkas…>` dengan `DATABASE_URL` mengimpor lewat koneksi database langsung; `npm run ingest:report -- <masukan> <keluaran>` membuat laporan mutu tanpa menyentuh database. Keluaran berisi teks buku: jangan di-commit.

## Mutu pemrosesan otomatis (14 buku Seni Rupa, 27 Nov 2026)

| Ukuran | Hasil |
| --- | --- |
| Buku diproses tanpa galat | 14/14 (3.218 halaman, 5.004 potongan pencarian) |
| Nomor halaman cetak terdeteksi | 52–98% per buku; sisanya disimpulkan dan ditandai "perkiraan" |
| Bab yang judulnya cocok dengan halaman awalnya | 62/69 (90%) |
| Buku dengan struktur bab lengkap tanpa koreksi | 12/14 |
| Perlu koreksi manual | Panduan Guru SD Kelas IV (sebagian judul bab), Panduan Guru SMA Kelas XII (daftar isi dua kolom, bab diisi manual) |
| Uji ujung ke ujung (buku siswa Dasar-Dasar Seni Rupa X Semester 2) | Metadata, 3 bab (hlm 1, 53, 109), dan pencarian "arsiran hatching" → hlm 17–18 benar; siswa sekolah lain tidak mendapat hasil |

Berkas `.txt` tidak memiliki penanda halaman resmi; pemisahnya disimpulkan dari baris kosong. Hasilnya cocok untuk buku-buku ini, tetapi bila memiliki PDF aslinya, unggah PDF agar nomor halaman lebih akurat.

## Belum tersedia

- OCR untuk PDF hasil pindai (tanpa lapisan teks) — unggahan seperti itu ditolak dengan pesan jelas.
- Menampilkan gambar/halaman asli (butuh penyimpanan berkas privat; menunggu keputusan lisensi).
- Pencarian semantik (makna) dan jawaban AI bersitasi dari buku — Fase 3.
- Bookmark dan catatan pribadi pembaca.
