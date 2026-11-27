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
