-- RUPA EDU — penyiapan database lengkap (dibuat otomatis oleh scripts/build-setup-sql.mjs; jangan diedit langsung).
-- Jalankan SEKALI di proyek Supabase yang masih kosong: SQL Editor → New query → tempel semua isi berkas ini → Run.
-- Isi: 20261127000001_foundation.sql, 20261127000002_library.sql, 20261127000003_public_books_chapter_search.sql, seed.sql

-- ===== 20261127000001_foundation.sql =====
-- RUPA EDU — Tahap 1: fondasi identitas, peran, sekolah (tenant), kelas, audit, konten publik.
-- Prinsip: setiap tabel memakai Row-Level Security; hak akses ditegakkan di database,
-- bukan hanya disembunyikan di menu. Penulisan data sensitif lewat server (service role)
-- atau fungsi yang diaudit.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- tipe
create type public.app_role as enum (
  'student',       -- siswa
  'teacher',       -- guru
  'guardian',      -- orang tua / wali
  'school_admin',  -- admin sekolah
  'moderator',     -- moderator platform
  'super_admin'    -- super admin platform
);

create type public.content_kind as enum ('konsep', 'sejarah', 'tokoh', 'karya', 'teknik', 'panduan');

-- ---------------------------------------------------------------- tabel inti
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 160),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Satu baris per (pengguna, sekolah, peran). Peran platform (moderator, super_admin)
-- tidak terikat sekolah: school_id null.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  school_id   uuid references public.schools (id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  constraint platform_roles_have_no_school check (
    (role in ('moderator', 'super_admin') and school_id is null)
    or (role not in ('moderator', 'super_admin') and school_id is not null)
  )
);
create unique index memberships_unique on public.memberships (user_id, coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid), role);
create index memberships_school_idx on public.memberships (school_id, role);

create table public.academic_years (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  label       text not null check (label ~ '^[0-9]{4}/[0-9]{4}$'),
  starts_on   date not null,
  ends_on     date not null check (ends_on > starts_on),
  unique (school_id, label)
);

create table public.classes (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  academic_year_id  uuid not null references public.academic_years (id) on delete restrict,
  name              text not null check (char_length(name) between 1 and 80),
  grade             smallint not null check (grade between 1 and 12),
  subject           text not null check (char_length(subject) between 2 and 80),
  created_at        timestamptz not null default now()
);
create index classes_school_idx on public.classes (school_id);

create table public.class_teachers (
  class_id  uuid not null references public.classes (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (class_id, user_id)
);
create index class_teachers_user_idx on public.class_teachers (user_id);

create table public.enrollments (
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index enrollments_student_idx on public.enrollments (student_id);

create table public.guardian_links (
  guardian_id  uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  school_id    uuid not null references public.schools (id) on delete cascade,
  verified_at  timestamptz,
  primary key (guardian_id, student_id),
  check (guardian_id <> student_id)
);
create index guardian_links_student_idx on public.guardian_links (student_id);

-- Catatan persetujuan (mis. publikasi karya, pemrosesan AI). Tidak pernah dihapus;
-- pencabutan dicatat sebagai baris baru dengan granted = false.
create table public.consent_records (
  id               uuid primary key default gen_random_uuid(),
  subject_user_id  uuid not null references public.profiles (id) on delete cascade,
  granted_by       uuid not null references public.profiles (id) on delete restrict,
  school_id        uuid references public.schools (id) on delete set null,
  purpose          text not null check (purpose in ('publikasi_karya', 'pemrosesan_ai', 'notifikasi_email', 'notifikasi_whatsapp')),
  granted          boolean not null,
  note             text check (char_length(note) <= 500),
  created_at       timestamptz not null default now()
);
create index consent_subject_idx on public.consent_records (subject_user_id, purpose, created_at desc);

-- Jejak audit: hanya bisa ditambah lewat fungsi log_event(); tidak bisa diubah/dihapus klien.
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  school_id    uuid references public.schools (id) on delete set null,
  action       text not null check (action ~ '^[a-z_.]{3,64}$'),
  target_table text,
  target_id    text,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_school_idx on public.audit_logs (school_id, created_at desc);

-- array_to_string bawaan tidak immutable; pembungkus ini aman untuk kolom generated.
create or replace function public.topics_text(text[]) returns text
language sql immutable parallel safe set search_path = '' as $$ select array_to_string($1, ' ') $$;

-- Konten pengetahuan publik yang dapat dicari tanpa login.
create table public.public_items (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  title         text not null check (char_length(title) between 2 and 200),
  summary       text not null check (char_length(summary) between 10 and 600),
  body          text not null default '',
  kind          public.content_kind not null,
  topics        text[] not null default '{}',
  min_grade     smallint check (min_grade between 1 and 12),
  source_name   text not null,
  source_url    text check (source_url is null or source_url ~ '^https://'),
  license       text not null,
  is_demo       boolean not null default false,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  search        tsvector generated always as (
    setweight(to_tsvector('indonesian', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('indonesian', coalesce(public.topics_text(topics), '')), 'B') ||
    setweight(to_tsvector('indonesian', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('indonesian', coalesce(body, '')), 'C')
  ) stored
);
create index public_items_search_idx on public.public_items using gin (search);
create index public_items_title_trgm on public.public_items using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- fungsi bantu (dipakai policy)
-- security definer + search_path kosong: dievaluasi tanpa memicu RLS rekursif.
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.role = 'super_admin');
$$;

create or replace function public.has_school_role(p_school uuid, p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.school_id = p_school and m.role = any (p_roles));
$$;

create or replace function public.is_school_member(p_school uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.school_id = p_school);
$$;

create or replace function public.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_teachers ct
                 where ct.class_id = p_class and ct.user_id = auth.uid());
$$;

create or replace function public.enrolled_in(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments e
                 where e.class_id = p_class and e.student_id = auth.uid());
$$;

create or replace function public.is_guardian_of(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guardian_links g
                 where g.student_id = p_student and g.guardian_id = auth.uid());
$$;

-- Guru boleh melihat profil siswa di kelas yang ia ampu.
create or replace function public.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments e
                 join public.class_teachers ct on ct.class_id = e.class_id
                 where e.student_id = p_student and ct.user_id = auth.uid());
$$;

-- Siswa boleh melihat profil guru di kelasnya (bukan profil sesama siswa).
create or replace function public.is_teacher_of_me(p_teacher uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_teachers ct
                 join public.enrollments e on e.class_id = ct.class_id
                 where ct.user_id = p_teacher and e.student_id = auth.uid());
$$;

-- Admin sekolah melihat profil anggota sekolahnya.
create or replace function public.admin_of_user(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships target
                 join public.memberships me on me.school_id = target.school_id
                 where target.user_id = p_user and me.user_id = auth.uid() and me.role = 'school_admin');
$$;

create or replace function public.class_school(p_class uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.school_id from public.classes c where c.id = p_class;
$$;

-- Satu-satunya jalan menambah jejak audit dari klien.
create or replace function public.log_event(p_action text, p_school uuid, p_target_table text, p_target_id text, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'log_event: harus login';
  end if;
  if p_school is not null and not public.is_school_member(p_school) and not public.is_super_admin() then
    raise exception 'log_event: bukan anggota sekolah ini';
  end if;
  insert into public.audit_logs (actor_id, school_id, action, target_table, target_id, meta)
  values (auth.uid(), p_school, p_action, p_target_table, p_target_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- Pencarian publik: full-text Bahasa Indonesia + toleransi salah ketik (trigram).
create or replace function public.search_public_items(p_query text, p_limit int default 20)
returns table (id uuid, slug text, title text, summary text, kind public.content_kind, topics text[],
               source_name text, source_url text, license text, is_demo boolean, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('indonesian', p_query) as tsq, lower(p_query) as raw)
  select i.id, i.slug, i.title, i.summary, i.kind, i.topics, i.source_name, i.source_url, i.license, i.is_demo,
         (ts_rank(i.search, q.tsq) + 0.5 * extensions.similarity(lower(i.title), q.raw))::real as rank
  from public.public_items i, q
  where i.published
    and (i.search @@ q.tsq or extensions.similarity(lower(i.title), q.raw) > 0.25)
  order by rank desc, i.title
  limit least(greatest(p_limit, 1), 50);
$$;

-- updated_at otomatis
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger public_items_touch before update on public.public_items for each row execute function public.touch_updated_at();

-- Profil dibuat otomatis saat akun auth dibuat.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS
alter table public.schools          enable row level security;
alter table public.profiles         enable row level security;
alter table public.memberships      enable row level security;
alter table public.academic_years   enable row level security;
alter table public.classes          enable row level security;
alter table public.class_teachers   enable row level security;
alter table public.enrollments      enable row level security;
alter table public.guardian_links   enable row level security;
alter table public.consent_records  enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.public_items     enable row level security;

-- schools
create policy schools_select on public.schools for select to authenticated
  using (public.is_school_member(id) or public.is_super_admin());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.teaches_student(id)
    or public.is_teacher_of_me(id)
    or public.is_guardian_of(id)
    or public.admin_of_user(id)
    or public.is_super_admin()
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: lihat milik sendiri; admin sekolah melihat sekolahnya; super admin semua.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid()
         or (school_id is not null and public.has_school_role(school_id, array['school_admin']::public.app_role[]))
         or public.is_super_admin());

-- academic_years
create policy academic_years_select on public.academic_years for select to authenticated
  using (public.is_school_member(school_id) or public.is_super_admin());
create policy academic_years_admin_write on public.academic_years for all to authenticated
  using (public.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (public.has_school_role(school_id, array['school_admin']::public.app_role[]));

-- classes
create policy classes_select on public.classes for select to authenticated
  using (public.teaches_class(id)
         or public.enrolled_in(id)
         or public.has_school_role(school_id, array['school_admin']::public.app_role[])
         or exists (select 1 from public.enrollments e where e.class_id = classes.id and public.is_guardian_of(e.student_id))
         or public.is_super_admin());
create policy classes_admin_write on public.classes for all to authenticated
  using (public.has_school_role(school_id, array['school_admin']::public.app_role[]))
  with check (public.has_school_role(school_id, array['school_admin']::public.app_role[]));

-- class_teachers
create policy class_teachers_select on public.class_teachers for select to authenticated
  using (user_id = auth.uid()
         or public.enrolled_in(class_id)
         or public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[])
         or public.is_super_admin());
create policy class_teachers_admin_write on public.class_teachers for all to authenticated
  using (public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[]))
  with check (public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[]));

-- enrollments: siswa hanya baris miliknya (tidak melihat daftar teman sekelas).
create policy enrollments_select on public.enrollments for select to authenticated
  using (student_id = auth.uid()
         or public.teaches_class(class_id)
         or public.is_guardian_of(student_id)
         or public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[])
         or public.is_super_admin());
create policy enrollments_admin_write on public.enrollments for all to authenticated
  using (public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[]))
  with check (public.has_school_role(public.class_school(class_id), array['school_admin']::public.app_role[]));

-- guardian_links
create policy guardian_links_select on public.guardian_links for select to authenticated
  using (guardian_id = auth.uid()
         or public.has_school_role(school_id, array['school_admin']::public.app_role[])
         or public.is_super_admin());

-- consent_records: hanya subjek, pemberi, admin sekolahnya, super admin. Tambah: pemberi = diri sendiri
-- dan (subjek = diri sendiri atau wali terverifikasi dari subjek).
create policy consent_select on public.consent_records for select to authenticated
  using (subject_user_id = auth.uid() or granted_by = auth.uid()
         or (school_id is not null and public.has_school_role(school_id, array['school_admin']::public.app_role[]))
         or public.is_super_admin());
create policy consent_insert on public.consent_records for insert to authenticated
  with check (granted_by = auth.uid()
              and (subject_user_id = auth.uid()
                   or exists (select 1 from public.guardian_links g
                              where g.guardian_id = auth.uid() and g.student_id = subject_user_id
                                and g.verified_at is not null)));

-- audit_logs: baca saja (tambah lewat log_event()).
create policy audit_select on public.audit_logs for select to authenticated
  using ((school_id is not null and public.has_school_role(school_id, array['school_admin']::public.app_role[]))
         or public.is_super_admin());

-- public_items: siapa pun boleh membaca yang sudah terbit; menulis hanya super admin / moderator.
create policy public_items_read on public.public_items for select to anon, authenticated
  using (published or public.is_super_admin());
create policy public_items_staff_write on public.public_items for all to authenticated
  using (public.is_super_admin() or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'moderator'))
  with check (public.is_super_admin() or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'moderator'));

-- ---------------------------------------------------------------- hak (grant) eksplisit
revoke all on all tables in schema public from anon, authenticated;
grant select on public.public_items to anon;
grant select on public.schools, public.profiles, public.memberships, public.academic_years, public.classes,
               public.class_teachers, public.enrollments, public.guardian_links, public.consent_records,
               public.audit_logs, public.public_items to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, update, delete on public.academic_years, public.classes, public.class_teachers, public.enrollments to authenticated;
grant insert on public.consent_records to authenticated;
grant insert, update, delete on public.public_items to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.search_public_items(text, int) to anon, authenticated;
-- dipakai kolom generated public_items.search saat staf menulis konten
grant execute on function public.topics_text(text[]) to authenticated;
grant execute on function public.log_event(text, uuid, text, text, jsonb) to authenticated;
grant execute on function public.is_super_admin(), public.has_school_role(uuid, public.app_role[]), public.is_school_member(uuid),
  public.teaches_class(uuid), public.enrolled_in(uuid), public.is_guardian_of(uuid), public.teaches_student(uuid),
  public.is_teacher_of_me(uuid), public.admin_of_user(uuid), public.class_school(uuid) to authenticated;
-- anon perlu is_super_admin() karena dipakai di policy public_items_read
grant execute on function public.is_super_admin() to anon;

-- ===== 20261127000002_library.sql =====
-- RUPA EDU — Fase 2a: Perpustakaan buku.
-- Prinsip (Master Prompt Bagian 5 & Lampiran A):
--   * Buku PRIVAT secara bawaan. Isi (halaman, potongan) hanya untuk anggota sekolah yang diberi akses.
--   * Metadata (judul, penulis, jenjang, ISBN, lisensi, tautan resmi) boleh tampil publik bila metadata_public.
--   * Struktur bab hasil otomatis wajib ditinjau manusia sebelum buku berstatus "siap".
--   * Izin per buku dipisah: baca, pemrosesan AI, publikasi.

create type public.book_type as enum ('buku_siswa', 'buku_guru', 'lainnya');
create type public.book_status as enum ('diproses', 'perlu_tinjauan', 'siap', 'ditarik');
create type public.license_kind as enum ('hak_cipta_dilindungi', 'lisensi_terbuka', 'domain_publik', 'izin_khusus');
create type public.label_confidence as enum ('terdeteksi', 'disimpulkan', 'tidak_diketahui');
create type public.chapter_kind as enum ('bab', 'unit', 'bagian');
create type public.chapter_source as enum ('daftar_isi', 'judul_halaman', 'gabungan', 'manual');

create table public.books (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9-]{2,120}$'),
  title                text not null check (char_length(title) between 2 and 300),
  book_type            public.book_type not null default 'lainnya',
  level                text check (level in ('SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK')),
  grade                smallint check (grade between 1 and 12),
  semester             smallint check (semester in (1, 2)),
  subject              text not null default 'Seni Rupa',
  edition              text,
  year                 smallint check (year between 1900 and 2100),
  authors              text[] not null default '{}',
  publisher            text,
  isbn                 text[] not null default '{}',
  copyright_holder     text,
  license_kind         public.license_kind not null default 'hak_cipta_dilindungi',
  license_note         text not null default '',
  official_url         text check (official_url is null or official_url ~ '^https://'),
  page_count           int not null default 0 check (page_count >= 0),
  label_coverage       real not null default 0 check (label_coverage between 0 and 1),
  -- Izin terpisah (Master Prompt Bagian 5).
  metadata_public      boolean not null default true,
  allow_ai_processing  boolean not null default false,
  status               public.book_status not null default 'diproses',
  source_file_name     text,
  source_sha256        text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  version              int not null default 1,
  warnings             text[] not null default '{}',
  reviewed_by          uuid references public.profiles (id) on delete set null,
  reviewed_at          timestamptz,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ready_requires_review check (status <> 'siap' or reviewed_at is not null)
);
create index books_level_idx on public.books (level, grade);
create trigger books_touch before update on public.books for each row execute function public.touch_updated_at();

-- Sekolah mana yang boleh membaca isi buku.
create table public.book_access (
  book_id     uuid not null references public.books (id) on delete cascade,
  school_id   uuid not null references public.schools (id) on delete cascade,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (book_id, school_id)
);
create index book_access_school_idx on public.book_access (school_id);

create table public.book_pages (
  book_id           uuid not null references public.books (id) on delete cascade,
  page_index        int not null check (page_index >= 0),
  printed_label     text,
  label_confidence  public.label_confidence not null default 'tidak_diketahui',
  content           text not null default '',
  primary key (book_id, page_index)
);

create table public.book_chapters (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books (id) on delete cascade,
  ordinal       smallint not null check (ordinal between 0 and 99),
  kind          public.chapter_kind not null default 'bab',
  title         text not null check (char_length(title) between 1 and 300),
  start_index   int not null check (start_index >= 0),
  end_index     int not null check (end_index >= start_index),
  source        public.chapter_source not null,
  auto_verified boolean not null default false,
  reviewed      boolean not null default false
);
create index book_chapters_book_idx on public.book_chapters (book_id, start_index);

create table public.book_chunks (
  id          bigint generated always as identity primary key,
  book_id     uuid not null references public.books (id) on delete cascade,
  page_index  int not null,
  ord         int not null,
  content     text not null check (char_length(content) between 1 and 4000),
  search      tsvector generated always as (to_tsvector('indonesian', content)) stored,
  unique (book_id, ord),
  foreign key (book_id, page_index) references public.book_pages (book_id, page_index) on delete cascade
);
create index book_chunks_search_idx on public.book_chunks using gin (search);

-- ---------------------------------------------------------------- fungsi bantu
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.role in ('super_admin', 'moderator'));
$$;

-- Pengguna boleh membaca isi buku bila ia siswa/guru/admin di sekolah yang diberi akses, dan buku berstatus siap.
create or replace function public.can_read_book(p_book uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_staff() or exists (
    select 1 from public.book_access a
    join public.memberships m on m.school_id = a.school_id
    join public.books b on b.id = a.book_id
    where a.book_id = p_book and m.user_id = auth.uid()
      and m.role in ('student', 'teacher', 'school_admin')
      and b.status = 'siap'
  );
$$;

-- Pencarian di dalam buku yang boleh dibaca. RLS pada book_chunks tetap berlaku (security invoker).
create or replace function public.search_book_chunks(p_query text, p_book uuid default null, p_limit int default 20)
returns table (book_id uuid, book_slug text, book_title text, page_index int, printed_label text,
               label_confidence public.label_confidence, snippet text, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('indonesian', p_query) as tsq)
  select c.book_id, b.slug, b.title, c.page_index, p.printed_label, p.label_confidence,
         ts_headline('indonesian', c.content, q.tsq,
                     'MaxFragments=2, MinWords=8, MaxWords=30, StartSel=«, StopSel=», FragmentDelimiter= … ') as snippet,
         ts_rank(c.search, q.tsq)::real as rank
  from public.book_chunks c
  join public.books b on b.id = c.book_id
  join public.book_pages p on p.book_id = c.book_id and p.page_index = c.page_index
  , q
  where c.search @@ q.tsq and (p_book is null or c.book_id = p_book)
  order by rank desc, c.book_id, c.page_index
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------- RLS
alter table public.books          enable row level security;
alter table public.book_access    enable row level security;
alter table public.book_pages     enable row level security;
alter table public.book_chapters  enable row level security;
alter table public.book_chunks    enable row level security;

-- Metadata: publik bila metadata_public dan buku tidak ditarik; selain itu hanya yang berhak membaca atau staf.
create policy books_public_meta on public.books for select to anon, authenticated
  using ((metadata_public and status = 'siap') or public.can_read_book(id) or public.is_staff());
create policy books_staff_write on public.books for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Akses: staf mengelola semua; admin sekolah boleh menambah/mencabut untuk sekolahnya sendiri, hanya buku siap.
create policy book_access_select on public.book_access for select to authenticated
  using (public.is_staff() or public.has_school_role(school_id, array['school_admin']::public.app_role[]));
create policy book_access_staff on public.book_access for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy book_access_admin_insert on public.book_access for insert to authenticated
  with check (public.has_school_role(school_id, array['school_admin']::public.app_role[])
              and exists (select 1 from public.books b where b.id = book_id and b.status = 'siap'));
create policy book_access_admin_delete on public.book_access for delete to authenticated
  using (public.has_school_role(school_id, array['school_admin']::public.app_role[]));

-- Daftar bab (struktur) ikut aturan metadata publik; isi halaman dan potongan hanya untuk yang berhak membaca.
create policy book_chapters_select on public.book_chapters for select to anon, authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.metadata_public and b.status = 'siap')
         or public.can_read_book(book_id) or public.is_staff());
create policy book_chapters_staff on public.book_chapters for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy book_pages_select on public.book_pages for select to authenticated
  using (public.can_read_book(book_id));
create policy book_pages_staff on public.book_pages for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy book_chunks_select on public.book_chunks for select to authenticated
  using (public.can_read_book(book_id));
create policy book_chunks_staff on public.book_chunks for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------- hak (grant)
grant select on public.books, public.book_chapters to anon;
grant select on public.books, public.book_access, public.book_pages, public.book_chapters, public.book_chunks to authenticated;
grant insert, update, delete on public.books, public.book_access, public.book_pages, public.book_chapters, public.book_chunks to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function public.is_staff(), public.can_read_book(uuid) to anon, authenticated;
grant execute on function public.search_book_chunks(text, uuid, int) to authenticated;

-- ===== 20261127000003_public_books_chapter_search.sql =====
-- RUPA EDU — Isi buku dapat dibuka untuk umum per buku, dan pencarian per bab.
-- Keputusan pemilik (27 Nov 2026): buku Kementerian ditampilkan lengkap untuk umum dengan sumber dicantumkan.
-- Sakelar per buku (content_public) tetap ada agar buku lain yang lisensinya berbeda bisa tetap privat.

alter table public.books add column content_public boolean not null default false;
comment on column public.books.content_public is
  'Isi (halaman, potongan) dapat dibaca tanpa login. Hanya berlaku bila status = siap. Wajib menampilkan sumber/atribusi.';

-- Buku publik: siap + content_public.
create or replace function public.book_is_public(p_book uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.books b where b.id = p_book and b.content_public and b.status = 'siap');
$$;

-- Halaman dan potongan: tambah akses untuk buku publik (anon & login).
drop policy book_pages_select on public.book_pages;
create policy book_pages_select on public.book_pages for select to anon, authenticated
  using (public.book_is_public(book_id) or public.can_read_book(book_id));
drop policy book_chunks_select on public.book_chunks;
create policy book_chunks_select on public.book_chunks for select to anon, authenticated
  using (public.book_is_public(book_id) or public.can_read_book(book_id));

-- Pencarian isi kini menyertakan bab tempat halaman berada.
drop function public.search_book_chunks(text, uuid, int);
create or replace function public.search_book_chunks(p_query text, p_book uuid default null, p_limit int default 20, p_level text default null)
returns table (book_id uuid, book_slug text, book_title text, book_level text, book_grade smallint,
               page_index int, printed_label text, label_confidence public.label_confidence,
               chapter_id uuid, chapter_kind public.chapter_kind, chapter_ordinal smallint, chapter_title text,
               snippet text, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('indonesian', p_query) as tsq)
  select c.book_id, b.slug, b.title, b.level, b.grade, c.page_index, p.printed_label, p.label_confidence,
         ch.id, ch.kind, ch.ordinal, ch.title,
         ts_headline('indonesian', c.content, q.tsq,
                     'MaxFragments=2, MinWords=8, MaxWords=30, StartSel=«, StopSel=», FragmentDelimiter= … ') as snippet,
         ts_rank(c.search, q.tsq)::real as rank
  from public.book_chunks c
  join public.books b on b.id = c.book_id
  join public.book_pages p on p.book_id = c.book_id and p.page_index = c.page_index
  left join lateral (
    select x.id, x.kind, x.ordinal, x.title from public.book_chapters x
    where x.book_id = c.book_id and c.page_index between x.start_index and x.end_index
    order by x.start_index desc limit 1
  ) ch on true
  , q
  where c.search @@ q.tsq
    and (p_book is null or c.book_id = p_book)
    and (p_level is null or b.level = p_level)
  order by rank desc, c.book_id, c.page_index
  limit least(greatest(p_limit, 1), 100);
$$;

-- Judul bab ikut dicari: "makrame" → bab tentang makrame di semua buku yang terlihat.
create or replace function public.search_chapters(p_query text, p_limit int default 20)
returns table (chapter_id uuid, book_id uuid, book_slug text, book_title text, book_level text, book_grade smallint,
               chapter_kind public.chapter_kind, chapter_ordinal smallint, chapter_title text, start_index int, rank real)
language sql stable security invoker set search_path = '' as $$
  with q as (select websearch_to_tsquery('indonesian', p_query) as tsq, lower(p_query) as raw)
  select ch.id, b.id, b.slug, b.title, b.level, b.grade, ch.kind, ch.ordinal, ch.title, ch.start_index,
         (ts_rank(to_tsvector('indonesian', ch.title), q.tsq) + extensions.similarity(lower(ch.title), q.raw))::real as rank
  from public.book_chapters ch
  join public.books b on b.id = ch.book_id
  , q
  where to_tsvector('indonesian', ch.title) @@ q.tsq or extensions.similarity(lower(ch.title), q.raw) > 0.3
  order by rank desc, b.level, b.grade
  limit least(greatest(p_limit, 1), 50);
$$;

grant select on public.book_pages, public.book_chunks to anon;
grant execute on function public.book_is_public(uuid) to anon, authenticated;
grant execute on function public.search_book_chunks(text, uuid, int, text) to anon, authenticated;
grant execute on function public.search_chapters(text, int) to anon, authenticated;

-- ===== seed.sql (12 artikel demo) =====
-- DIBUAT OTOMATIS oleh scripts/build-seed-sql.mjs dari src/content/demo-items.json. Jangan diedit manual.
-- Konten DEMO: ditulis tim RUPA EDU sebagai contoh, belum ditinjau guru/ahli. is_demo = true.
insert into public.public_items (slug, title, summary, body, kind, topics, min_grade, source_name, source_url, license, is_demo, published)
values
  ('unsur-seni-rupa', 'Unsur-unsur seni rupa', 'Karya seni rupa dibangun dari unsur dasar: titik, garis, bidang, bentuk, warna, tekstur, dan ruang. Memahami unsur ini membantu kita membaca dan membuat karya.', 'Titik adalah unsur paling sederhana. Garis terbentuk dari titik yang bergerak dan dapat lurus, lengkung, atau patah-patah. Bidang adalah area datar yang dibatasi garis, misalnya persegi atau lingkaran. Bentuk (volume) memiliki panjang, lebar, dan tinggi. Warna memberi suasana, tekstur menunjukkan kesan permukaan (halus, kasar), dan ruang memberi kesan jarak serta kedalaman.', 'konsep'::public.content_kind, array['unsur seni rupa', 'titik', 'garis', 'bidang', 'bentuk', 'tekstur', 'ruang']::text[], 1, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('lingkaran-warna', 'Lingkaran warna: primer, sekunder, tersier', 'Lingkaran warna menyusun warna secara melingkar agar hubungan antarwarna mudah dilihat. Dalam model pigmen tradisional, warna primer adalah merah, kuning, dan biru.', 'Warna sekunder dibuat dengan mencampur dua warna primer: merah dan kuning menjadi jingga, kuning dan biru menjadi hijau, biru dan merah menjadi ungu. Warna tersier dibuat dengan mencampur satu warna primer dengan warna sekunder di sebelahnya, misalnya kuning-hijau. Model ini dipakai dalam pembelajaran seni lukis; layar komputer memakai model cahaya merah, hijau, biru (RGB).', 'konsep'::public.content_kind, array['warna', 'teori warna', 'warna primer', 'warna sekunder', 'roda warna']::text[], 3, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('warna-komplementer', 'Warna komplementer', 'Warna komplementer adalah pasangan warna yang letaknya berseberangan pada lingkaran warna, seperti merah dan hijau atau biru dan jingga. Jika berdampingan, keduanya terlihat kontras dan saling menonjolkan.', 'Pasangan komplementer sering dipakai untuk menarik perhatian, misalnya pada poster. Jika dua warna komplementer dicampur sebagai cat, hasilnya cenderung menjadi warna yang lebih kusam atau kecokelatan. Karena kontrasnya kuat, gunakan salah satu sebagai warna utama dan yang lain sebagai aksen.', 'konsep'::public.content_kind, array['warna', 'teori warna', 'kontras', 'harmoni warna']::text[], 4, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('warna-analog', 'Warna analog', 'Warna analog adalah tiga sampai lima warna yang bersebelahan pada lingkaran warna, misalnya kuning, kuning-jingga, dan jingga. Kombinasinya terasa selaras dan tenang.', 'Skema analog cocok untuk suasana yang harmonis, seperti pemandangan senja. Agar tidak monoton, pilih satu warna dominan dan variasikan gelap-terangnya.', 'konsep'::public.content_kind, array['warna', 'teori warna', 'harmoni warna']::text[], 4, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('perspektif-satu-titik', 'Perspektif satu titik hilang', 'Perspektif satu titik hilang menggambarkan ruang seolah semua garis yang menjauh bertemu di satu titik pada garis cakrawala. Cocok untuk menggambar jalan lurus, lorong, atau rel kereta.', 'Langkah dasarnya: buat garis cakrawala setinggi mata, tentukan satu titik hilang di garis itu, lalu tarik garis-garis bantu dari sudut benda menuju titik hilang. Garis vertikal tetap tegak, dan garis horizontal yang menghadap kita tetap sejajar dengan cakrawala.', 'teknik'::public.content_kind, array['perspektif', 'menggambar', 'ruang', 'titik hilang']::text[], 7, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('perspektif-dua-titik', 'Perspektif dua titik hilang', 'Perspektif dua titik hilang dipakai ketika sebuah benda dilihat dari sudutnya, sehingga dua sisi benda menjauh ke dua titik hilang berbeda pada garis cakrawala.', 'Tentukan garis cakrawala dan dua titik hilang di kiri dan kanan. Gambar sudut terdekat benda sebagai garis vertikal, lalu tarik garis dari ujung atas dan bawahnya ke masing-masing titik hilang. Teknik ini umum dipakai untuk menggambar bangunan dan benda berbentuk kotak.', 'teknik'::public.content_kind, array['perspektif', 'menggambar', 'ruang', 'titik hilang', 'arsitektur']::text[], 8, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('gelap-terang', 'Gelap terang (arsiran)', 'Gelap terang memberi kesan volume pada gambar. Bagian yang terkena cahaya dibuat terang, bagian yang membelakangi cahaya dibuat gelap, dan ada bayangan jatuh di permukaan sekitar.', 'Teknik arsiran antara lain arsir sejajar, arsir silang, titik-titik (pointilis), dan gosok (blending). Mulailah dengan menentukan arah sumber cahaya, lalu bagi benda menjadi area terang, peralihan, gelap, dan bayangan jatuh.', 'teknik'::public.content_kind, array['menggambar', 'arsir', 'cahaya', 'bayangan', 'volume']::text[], 5, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('keseimbangan-komposisi', 'Keseimbangan dalam komposisi', 'Keseimbangan adalah kesan stabil dalam susunan karya. Keseimbangan simetris membagi karya menjadi dua sisi yang sama, sedangkan asimetris menyeimbangkan unsur yang berbeda ukuran atau warna.', 'Selain simetris dan asimetris, ada keseimbangan radial, yaitu unsur yang menyebar dari satu pusat seperti kelopak bunga. Keseimbangan termasuk prinsip seni rupa bersama kesatuan, irama, penekanan, dan proporsi.', 'konsep'::public.content_kind, array['komposisi', 'prinsip seni rupa', 'keseimbangan', 'simetri']::text[], 6, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('serif-dan-sans-serif', 'Huruf serif dan sans-serif', 'Huruf serif memiliki kait kecil di ujung garisnya, sedangkan sans-serif tidak. Pemilihan jenis huruf memengaruhi kesan dan keterbacaan sebuah desain.', 'Huruf serif sering memberi kesan klasik dan resmi, sedangkan sans-serif terasa modern dan bersih. Dalam satu desain, biasanya cukup memakai dua keluarga huruf: satu untuk judul dan satu untuk isi teks.', 'konsep'::public.content_kind, array['tipografi', 'desain grafis', 'huruf']::text[], 7, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('kontras-desain-grafis', 'Kontras dalam desain grafis', 'Kontras adalah perbedaan yang jelas antara unsur, misalnya ukuran, warna, atau ketebalan huruf. Kontras membantu mata pembaca menemukan bagian terpenting lebih dulu.', 'Pada poster, judul biasanya dibuat paling besar dan paling kontras. Kontras warna antara teks dan latar juga penting agar tulisan mudah dibaca, termasuk oleh orang dengan penglihatan rendah.', 'konsep'::public.content_kind, array['desain grafis', 'kontras', 'poster', 'hierarki visual']::text[], 7, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('batik-teknik-rintang-warna', 'Batik: teknik rintang warna dengan malam', 'Batik dibuat dengan menutup bagian kain memakai malam (lilin) agar tidak terkena pewarna. Batik Indonesia diakui UNESCO sebagai Warisan Budaya Takbenda pada 2 Oktober 2009.', 'Pada batik tulis, malam dioleskan dengan canting; pada batik cap, malam dicetak dengan cap tembaga. Setelah pewarnaan, malam dilorod (dihilangkan) dengan air panas. Proses menutup dan mewarnai dapat diulang untuk menghasilkan beberapa warna. Tanggal 2 Oktober diperingati sebagai Hari Batik Nasional.', 'teknik'::public.content_kind, array['batik', 'kriya', 'budaya Nusantara', 'tekstil', 'motif']::text[], 4, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true),
  ('pola-dan-ragam-hias', 'Pola dan ragam hias', 'Pola adalah susunan motif yang diulang secara teratur. Ragam hias Nusantara memakai motif geometris, tumbuhan, dan hewan dengan makna dan asal yang berbeda di tiap daerah.', 'Cara menyusun pola antara lain berulang (repetisi), berselang-seling, dan simetris. Saat mempelajari motif daerah, catat asal daerah dan sumbernya agar makna budaya tidak salah dipahami.', 'konsep'::public.content_kind, array['pola', 'ragam hias', 'motif', 'budaya Nusantara']::text[], 3, 'RUPA EDU (konten demo)', null, 'Konten demo RUPA EDU, belum ditinjau ahli', true, true)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, body = excluded.body, kind = excluded.kind,
  topics = excluded.topics, min_grade = excluded.min_grade, is_demo = true, published = true;
