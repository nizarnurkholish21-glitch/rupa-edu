// Fungsi murni untuk menyusun hasil pencarian buku (dapat diuji tanpa server).

export interface BookHit {
  book_id: string; book_slug: string; book_title: string; book_level: string | null; book_grade: number | null;
  page_index: number; printed_label: string | null; label_confidence: string;
  chapter_id: string | null; chapter_kind: string | null; chapter_ordinal: number | null; chapter_title: string | null;
  snippet: string;
}

export interface HitGroup {
  bookSlug: string; bookTitle: string; level: string | null; grade: number | null;
  chapters: { key: string; label: string; hits: BookHit[] }[];
}

/** Mengelompokkan hasil: Buku → Bab → halaman. Urutan mengikuti hasil terbaik pertama tiap kelompok. */
export function groupHits(hits: BookHit[]): HitGroup[] {
  const books = new Map<string, HitGroup>();
  for (const h of hits) {
    let g = books.get(h.book_slug);
    if (!g) { g = { bookSlug: h.book_slug, bookTitle: h.book_title, level: h.book_level, grade: h.book_grade, chapters: [] }; books.set(h.book_slug, g); }
    const key = h.chapter_id ?? 'tanpa-bab';
    let c = g.chapters.find((x) => x.key === key);
    if (!c) { c = { key, label: chapterLabel(h.chapter_kind, h.chapter_ordinal, h.chapter_title), hits: [] }; g.chapters.push(c); }
    c.hits.push(h);
  }
  return [...books.values()];
}

export function chapterLabel(kind: string | null, ordinal: number | null, title: string | null): string {
  if (!title) return 'Bagian depan / lampiran';
  if (kind === 'bagian') return title;
  return `${kind === 'unit' ? 'Unit' : 'Bab'} ${ordinal ?? ''} · ${title}`;
}

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
