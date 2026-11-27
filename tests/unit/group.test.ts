import { describe, expect, it } from 'vitest';
import { chapterLabel, groupHits, type BookHit } from '../../src/lib/library/group';

const hit = (book: string, chapter: string | null, page: number): BookHit => ({
  book_id: book, book_slug: book, book_title: `Buku ${book}`, book_level: 'SD/MI', book_grade: 5,
  page_index: page, printed_label: String(page + 1), label_confidence: 'terdeteksi',
  chapter_id: chapter, chapter_kind: chapter ? 'bab' : null, chapter_ordinal: chapter ? Number(chapter) : null,
  chapter_title: chapter ? `Judul ${chapter}` : null, snippet: '…',
});

describe('pengelompokan hasil per buku dan bab', () => {
  it('menyusun Buku → Bab → halaman, mempertahankan urutan hasil terbaik', () => {
    const g = groupHits([hit('b', '4', 120), hit('a', '1', 10), hit('b', '4', 125), hit('b', '5', 140), hit('a', null, 2)]);
    expect(g.map((x) => x.bookSlug)).toEqual(['b', 'a']);
    expect(g[0]!.chapters.map((c) => [c.label, c.hits.length])).toEqual([['Bab 4 · Judul 4', 2], ['Bab 5 · Judul 5', 1]]);
    expect(g[1]!.chapters.map((c) => c.label)).toEqual(['Bab 1 · Judul 1', 'Bagian depan / lampiran']);
  });
  it('memberi label sesuai jenis', () => {
    expect(chapterLabel('unit', 2, 'Mendesain')).toBe('Unit 2 · Mendesain');
    expect(chapterLabel('bagian', 0, 'Panduan Umum')).toBe('Panduan Umum');
  });
});
