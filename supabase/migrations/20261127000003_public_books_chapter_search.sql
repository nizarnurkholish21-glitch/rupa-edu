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
