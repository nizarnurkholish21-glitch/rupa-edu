# Perpustakaan buku

## Kebijakan

- **Buku Kementerian: isi lengkap untuk umum** (keputusan pemilik, 27 Nov 2026). Buku yang pemegang hak ciptanya Kementerian otomatis diusulkan *isi publik*: siapa pun dapat membaca dan mencari isinya tanpa login, setelah buku ditinjau ("siap"). Setiap halaman menampilkan **sumber** (judul, penulis, tahun, pemegang hak cipta) dan tautan ke versi resmi di SIBI.
- **Buku lain: privat secara bawaan.** Isi hanya untuk siswa, guru, dan admin sekolah yang diberi akses. Wali hanya membaca buku publik.
- **Sakelar per buku.** Staf dapat mengubah "Isi buku dapat dibaca umum" di layar tinjauan kapan saja (mis. bila Kementerian meminta).
- **Catatan hukum.** Buku Kurikulum Merdeka mencantumkan *"Hak Cipta pada Kementerian… Dilindungi Undang-Undang"* tanpa izin tertulis untuk diterbitkan ulang (berbeda dengan buku BSE 2008–2009 yang mencantumkan izin menggandakan). Rekomendasi: kirim permohonan izin tertulis ke Pusat Perbukuan (buku@kemdikbud.go.id, alamat yang tercantum di buku) dan simpan balasannya.
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

## Pencarian per bab

- **Perpustakaan → kotak cari**: mencari di semua buku sekaligus. Hasil dibagi dua: *Bab yang membahas …* (judul bab yang cocok) dan *Di dalam isi buku* (dikelompokkan Buku → Bab → halaman, dengan cuplikan bertanda). Bisa disaring per jenjang.
- **Jelajah bab** (`/perpustakaan/bab`): semua bab dari semua buku, per jenjang dan kelas; klik bab untuk langsung ke halaman awalnya.
- **Halaman buku → Cari di buku ini**: hasil dikelompokkan per bab.
- **Pencarian umum** (`/cari`): ikut menampilkan bab yang cocok dan isi buku per bab.

## Belum tersedia

- OCR untuk PDF hasil pindai (tanpa lapisan teks) — unggahan seperti itu ditolak dengan pesan jelas.
- Menampilkan gambar/halaman asli (butuh penyimpanan berkas privat; menunggu keputusan lisensi).
- Pencarian semantik (makna) dan jawaban AI bersitasi dari buku — Fase 3.
- Bookmark dan catatan pribadi pembaca.
