-- Data uji (bukan data nyata). Dua sekolah fiktif untuk menguji isolasi.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a0', 'admin.a@demo.test',   '{"display_name":"Admin A"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'guru.a1@demo.test',   '{"display_name":"Guru A1"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'guru.a2@demo.test',   '{"display_name":"Guru A2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa.1@demo.test',   '{"display_name":"Siswa A-1"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'siswa.2@demo.test',   '{"display_name":"Siswa A-2"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'siswa.3@demo.test',   '{"display_name":"Siswa A-3"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'wali.1@demo.test',    '{"display_name":"Wali Siswa A-1"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'guru.b1@demo.test',   '{"display_name":"Guru B1"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'siswa.b1@demo.test',  '{"display_name":"Siswa B-1"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'super@demo.test',     '{"display_name":"Super Admin"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'umum@demo.test',      '{"display_name":"Pengguna Umum"}');

insert into public.schools (id, name, slug, is_demo) values
  ('10000000-0000-0000-0000-00000000000a', 'Sekolah Demo A', 'sekolah-demo-a', true),
  ('10000000-0000-0000-0000-00000000000b', 'Sekolah Demo B', 'sekolah-demo-b', true);

insert into public.memberships (user_id, school_id, role) values
  ('00000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'school_admin'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'teacher'),
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'teacher'),
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000a', 'student'),
  ('00000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-00000000000a', 'student'),
  ('00000000-0000-0000-0000-0000000000b3', '10000000-0000-0000-0000-00000000000a', 'student'),
  ('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-00000000000a', 'guardian'),
  ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b', 'teacher'),
  ('00000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-00000000000b', 'student'),
  ('00000000-0000-0000-0000-0000000000e1', null, 'super_admin');

insert into public.academic_years (id, school_id, label, starts_on, ends_on) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '2026/2027', '2026-07-13', '2027-06-25'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '2026/2027', '2026-07-13', '2027-06-25');

insert into public.classes (id, school_id, academic_year_id, name, grade, subject) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '7A', 7, 'Seni Rupa'),
  ('30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '8B', 8, 'Seni Rupa'),
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', '7C', 7, 'Seni Rupa');

insert into public.class_teachers (class_id, user_id) values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1'),
  ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2'),
  ('30000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');

insert into public.enrollments (class_id, student_id) values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1'),
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2'),
  ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3'),
  ('30000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2');

insert into public.guardian_links (guardian_id, student_id, school_id, verified_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000a', now());

insert into public.audit_logs (actor_id, school_id, action) values
  ('00000000-0000-0000-0000-0000000000a0', '10000000-0000-0000-0000-00000000000a', 'class.create'),
  ('00000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-00000000000b', 'class.create');

insert into public.public_items (slug, title, summary, kind, source_name, license, is_demo, published) values
  ('draf-belum-terbit', 'Draf rahasia belum terbit', 'Item ini belum diterbitkan dan tidak boleh terlihat publik.', 'konsep', 'uji', 'uji', true, false);
