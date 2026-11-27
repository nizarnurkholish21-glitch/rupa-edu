// Akses data perpustakaan dari server. Semua query memakai sesi pengguna, jadi RLS menentukan apa yang terlihat.
import 'server-only';
import { supabaseConfig } from '@/lib/config';
import { createServerSupabase } from '@/lib/supabase/server';
import type { BookHit } from './group';
export { groupHits, chapterLabel, ROMAN, type BookHit, type HitGroup } from './group';

export const BOOK_TYPE_LABEL: Record<string, string> = { buku_siswa: 'Buku siswa', buku_guru: 'Panduan guru', lainnya: 'Buku' };
export const STATUS_LABEL: Record<string, string> = { diproses: 'Diproses', perlu_tinjauan: 'Perlu tinjauan', siap: 'Siap', ditarik: 'Ditarik' };
export const LICENSE_LABEL: Record<string, string> = {
  hak_cipta_dilindungi: 'Hak cipta dilindungi', lisensi_terbuka: 'Lisensi terbuka', domain_publik: 'Domain publik', izin_khusus: 'Izin khusus',
};
export const LEVELS = ['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK'] as const;

export interface BookSummary {
  id: string; slug: string; title: string; book_type: string; level: string | null; grade: number | null; semester: number | null;
  year: number | null; authors: string[]; status: string; page_count: number; license_kind: string;
}
export interface BookDetail extends BookSummary {
  edition: string | null; publisher: string | null; isbn: string[]; copyright_holder: string | null; license_note: string;
  official_url: string | null; label_coverage: number; metadata_public: boolean; allow_ai_processing: boolean; warnings: string[];
  source_file_name: string | null; reviewed_at: string | null; subject: string; content_public: boolean;
}

/** Portal resmi buku Kementerian (SIBI). Tautan per buku diisi staf di layar tinjauan bila tersedia. */
export const SIBI_URL = 'https://buku.kemendikdasmen.go.id';
export interface Chapter {
  id: string; ordinal: number; kind: string; title: string; start_index: number; end_index: number; source: string;
  auto_verified: boolean; reviewed: boolean; start_label?: string | null;
}
export interface PageRow { page_index: number; printed_label: string | null; label_confidence: string; content: string }

const SUMMARY_COLS = 'id,slug,title,book_type,level,grade,semester,year,authors,status,page_count,license_kind';

export async function listBooks(filter: { level?: string } = {}): Promise<BookSummary[]> {
  if (!supabaseConfig()) return [];
  const db = await createServerSupabase();
  let q = db.from('books').select(SUMMARY_COLS).order('level').order('grade').order('title');
  if (filter.level && (LEVELS as readonly string[]).includes(filter.level)) q = q.eq('level', filter.level);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as BookSummary[];
}

export async function getBook(slug: string): Promise<BookDetail | null> {
  if (!supabaseConfig() || !/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = await createServerSupabase();
  const { data } = await db.from('books').select('*').eq('slug', slug).maybeSingle();
  return (data as BookDetail | null) ?? null;
}

export async function getChapters(bookId: string): Promise<Chapter[]> {
  const db = await createServerSupabase();
  const { data } = await db.from('book_chapters').select('*').eq('book_id', bookId).order('start_index');
  return (data ?? []) as Chapter[];
}

/** Label halaman cetak untuk indeks tertentu (hanya bila pengguna boleh membaca isi). */
export async function getLabels(bookId: string, indexes: number[]): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  if (indexes.length === 0) return out;
  const db = await createServerSupabase();
  const { data } = await db.from('book_pages').select('page_index,printed_label').eq('book_id', bookId).in('page_index', indexes);
  for (const r of data ?? []) out.set(r.page_index as number, (r.printed_label as string | null) ?? null);
  return out;
}

export async function getPage(bookId: string, index: number): Promise<PageRow | null> {
  const db = await createServerSupabase();
  const { data } = await db.from('book_pages').select('page_index,printed_label,label_confidence,content').eq('book_id', bookId).eq('page_index', index).maybeSingle();
  return (data as PageRow | null) ?? null;
}

/** Cari indeks halaman dari label cetak ("17", "iv"). */
export async function findPageByLabel(bookId: string, label: string): Promise<number | null> {
  const db = await createServerSupabase();
  const { data } = await db.from('book_pages').select('page_index').eq('book_id', bookId).eq('printed_label', label).order('page_index').limit(1);
  return (data?.[0]?.page_index as number | undefined) ?? null;
}

/** Boleh membaca isi: buku publik, atau anggota sekolah ber-akses, atau staf. */
export async function canReadBook(bookId: string): Promise<boolean> {
  const db = await createServerSupabase();
  const [pub, school] = await Promise.all([
    db.rpc('book_is_public', { p_book: bookId }),
    db.rpc('can_read_book', { p_book: bookId }),
  ]);
  return pub.data === true || school.data === true;
}

/** Cari isi buku yang boleh dibaca (RLS: publik, sekolah ber-akses, staf). */
export async function searchBooks(query: string, opts: { bookId?: string; level?: string; limit?: number } = {}): Promise<BookHit[]> {
  if (!supabaseConfig() || !query.trim()) return [];
  const db = await createServerSupabase();
  const level = opts.level && (LEVELS as readonly string[]).includes(opts.level) ? opts.level : null;
  const { data, error } = await db.rpc('search_book_chunks', { p_query: query, p_book: opts.bookId ?? null, p_limit: opts.limit ?? 20, p_level: level });
  if (error) { console.error('[library] search gagal:', error.message); return []; }
  return (data ?? []) as BookHit[];
}

export interface ChapterHit {
  chapter_id: string; book_id: string; book_slug: string; book_title: string; book_level: string | null; book_grade: number | null;
  chapter_kind: string; chapter_ordinal: number; chapter_title: string; start_index: number;
}

/** Judul bab yang cocok dengan kueri, dari semua buku yang terlihat. */
export async function searchChapters(query: string, limit = 12): Promise<ChapterHit[]> {
  if (!supabaseConfig() || !query.trim()) return [];
  const db = await createServerSupabase();
  const { data, error } = await db.rpc('search_chapters', { p_query: query, p_limit: limit });
  if (error) { console.error('[library] search bab gagal:', error.message); return []; }
  return (data ?? []) as ChapterHit[];
}

export interface BrowseBook extends BookSummary { content_public: boolean; chapters: { id: string; kind: string; ordinal: number; title: string; start_index: number }[] }

/** Semua buku beserta babnya, untuk halaman jelajah per jenjang & kelas. */
export async function browseChapters(filter: { level?: string; grade?: number } = {}): Promise<BrowseBook[]> {
  if (!supabaseConfig()) return [];
  const db = await createServerSupabase();
  let q = db.from('books').select(`${SUMMARY_COLS},content_public,book_chapters(id,kind,ordinal,title,start_index)`)
    .eq('status', 'siap').order('level').order('grade').order('title');
  if (filter.level && (LEVELS as readonly string[]).includes(filter.level)) q = q.eq('level', filter.level);
  if (filter.grade && filter.grade >= 1 && filter.grade <= 12) q = q.eq('grade', filter.grade);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (BookSummary & { content_public: boolean; book_chapters: BrowseBook['chapters'] })[]).map((b) => {
    const { book_chapters, ...rest } = b;
    return { ...rest, chapters: [...book_chapters].sort((x, y) => x.start_index - y.start_index) };
  });
}


/** Buku yang judul/penulisnya cocok — untuk kartu metadata di pencarian publik. */
export async function searchBookMetadata(query: string, limit = 5): Promise<BookSummary[]> {
  if (!supabaseConfig() || !query.trim()) return [];
  const db = await createServerSupabase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 4);
  if (words.length === 0) return [];
  const ors = words.map((w) => `title.ilike.%${w.replace(/[%_,()]/g, '')}%`).join(',');
  const { data } = await db.from('books').select(SUMMARY_COLS).eq('status', 'siap').or(ors).limit(limit);
  return (data ?? []) as BookSummary[];
}

export function bookSubtitle(b: Pick<BookSummary, 'book_type' | 'level' | 'grade' | 'semester' | 'year'>): string {
  const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][n] ?? String(n);
  return [BOOK_TYPE_LABEL[b.book_type] ?? 'Buku', b.level && b.grade ? `${b.level} Kelas ${roman(b.grade)}` : b.level,
    b.semester ? `Semester ${b.semester}` : null, b.year ? String(b.year) : null].filter(Boolean).join(' · ');
}

/** Teks sitasi singkat, mis. "Dasar-Dasar Seni Rupa … (Kemendikbudristek, 2023), hlm. 17". */
export function citation(b: Pick<BookDetail, 'title' | 'authors' | 'publisher' | 'copyright_holder' | 'year'>, label: string | null, approx: boolean): string {
  const who = b.authors.length ? b.authors.join(', ') : b.publisher ?? b.copyright_holder ?? 'Tanpa penulis';
  const page = label ? `, hlm. ${label}${approx ? ' (perkiraan)' : ''}` : '';
  return `${who}. ${b.title}${b.year ? ` (${b.year})` : ''}${page}.`;
}
