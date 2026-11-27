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
