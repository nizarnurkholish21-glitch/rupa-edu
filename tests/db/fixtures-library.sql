-- Buku uji (fiktif, teks pendek). Bukan isi buku sungguhan.
insert into public.books (id, slug, title, book_type, level, grade, status, reviewed_at, metadata_public, license_kind, page_count) values
  ('40000000-0000-0000-0000-00000000000a', 'buku-uji-siap', 'Buku Uji Seni Rupa Kelas VII', 'buku_siswa', 'SMP/MTs', 7, 'siap', now(), true, 'hak_cipta_dilindungi', 3),
  ('40000000-0000-0000-0000-00000000000b', 'buku-uji-draf', 'Buku Uji Draf', 'buku_guru', 'SMP/MTs', 7, 'perlu_tinjauan', null, true, 'hak_cipta_dilindungi', 1),
  ('40000000-0000-0000-0000-00000000000c', 'buku-uji-tertutup', 'Buku Uji Tertutup', 'buku_guru', 'SMA/MA', 11, 'siap', now(), false, 'izin_khusus', 1);

insert into public.book_access (book_id, school_id) values
  ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a'),
  ('40000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000a'),
  ('40000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-00000000000b');

insert into public.book_pages (book_id, page_index, printed_label, label_confidence, content) values
  ('40000000-0000-0000-0000-00000000000a', 0, 'i', 'terdeteksi', 'Sampul buku uji.'),
  ('40000000-0000-0000-0000-00000000000a', 1, '1', 'terdeteksi', 'Bab 1 Menggambar. Arsiran silang dibuat dengan garis yang saling menyilang untuk memberi kesan gelap.'),
  ('40000000-0000-0000-0000-00000000000a', 2, '2', 'disimpulkan', 'Perspektif dua titik hilang dipakai untuk menggambar bangunan dari sudutnya.'),
  ('40000000-0000-0000-0000-00000000000b', 0, '1', 'terdeteksi', 'Draf: teknik arsiran belum ditinjau.'),
  ('40000000-0000-0000-0000-00000000000c', 0, '1', 'terdeteksi', 'Rahasia: teknik arsiran khusus sekolah B.');

insert into public.book_chapters (book_id, ordinal, kind, title, start_index, end_index, source, auto_verified, reviewed) values
  ('40000000-0000-0000-0000-00000000000a', 1, 'bab', 'Menggambar', 1, 2, 'gabungan', true, true),
  ('40000000-0000-0000-0000-00000000000c', 1, 'bab', 'Bab Rahasia', 0, 0, 'manual', false, true);

insert into public.book_chunks (book_id, page_index, ord, content) values
  ('40000000-0000-0000-0000-00000000000a', 1, 0, 'Bab 1 Menggambar. Arsiran silang dibuat dengan garis yang saling menyilang untuk memberi kesan gelap.'),
  ('40000000-0000-0000-0000-00000000000a', 2, 1, 'Perspektif dua titik hilang dipakai untuk menggambar bangunan dari sudutnya.'),
  ('40000000-0000-0000-0000-00000000000b', 0, 0, 'Draf: teknik arsiran belum ditinjau.'),
  ('40000000-0000-0000-0000-00000000000c', 0, 0, 'Rahasia: teknik arsiran khusus sekolah B.');
