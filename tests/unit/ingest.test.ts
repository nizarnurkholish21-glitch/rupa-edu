// Tes pemroses buku dengan teks sintetis (isi buku sungguhan berhak cipta tidak disimpan di repositori).
import { describe, expect, it } from 'vitest';
import {
  chunkPages, cleanText, detectChapters, detectPageLabels, extractMetadata, ingestText, splitPages, tocTopEntries, verifyChapters,
} from '../../src/lib/library/ingest';
import { bookRow, chapterRows, slugify } from '../../src/lib/library/rows';

/** Buku sintetis: 4 halaman depan (romawi), daftar isi, lalu 30 halaman isi bernomor dengan header berjalan. */
function syntheticBook(): string {
  const pages: string[] = [];
  pages.push('SMP/MTs Kelas VII\nSENI RUPA\nPanduan Guru\nEdisi Revisi\nKEMENTERIAN PENDIDIKAN\n2023');
  pages.push('Hak Cipta pada Kementerian Uji Republik Indonesia\nDilindungi Undang-Undang\nPenulis\nAni Pratiwi\nBudi Santoso\nPenelaah\nCitra\nPenerbit\nPusat Perbukuan Uji\nISBN 978-623-118-520-4 (PDF)');
  pages.push('iii\nKata Pengantar\nTeks pengantar.');
  pages.push('iv\nDaftar Isi\nKata Pengantar ........ iii\nPanduan Umum ........ 1\nA. Pendahuluan ........ 2\nMenggambar Alam ........ 11\nA. Pendahuluan ........ 12\nB. Kegiatan ........ 14\nMendesain Poster ........ 21\nA. Pendahuluan ........ 22\nGlosarium ........ 29');
  for (let n = 1; n <= 30; n++) {
    const chapter = n < 11 ? 'Panduan Umum' : n < 21 ? 'Bab 1 Menggambar Alam' : 'Bab 2 Mendesain Poster';
    const header = n % 2 === 0 ? `${n} Panduan Guru Seni Rupa untuk SMP/MTs Kelas VII` : `${chapter} ${n}`;
    const opener = n === 11 ? 'Bab 1\nMenggambar Alam\n' : n === 21 ? 'Bab 2\nMendesain Poster\n' : '';
    pages.push(`${header}\n${opener}Isi halaman ${n}. Arsiran silang dipakai untuk memberi kesan gelap pada gambar. ${'Kalimat pengisi. '.repeat(n === 15 ? 120 : 3)}`);
  }
  return pages.join('\f');
}

describe('pemecahan halaman dan pembersihan', () => {
  it('memakai form feed bila ada, selain itu baris kosong', () => {
    expect(splitPages('a\fb\fc')).toEqual(['a', 'b', 'c']);
    expect(splitPages('a\nx\n\nb\n\nc')).toEqual(['a\nx', 'b', 'c']);
  });
  it('memperbaiki tanda hubung lunak dan ligatur fi/fl yang hilang', () => {
    expect(cleanText('sehari­hari  Proil Pelajar dan Releksi')).toBe('sehari-hari Profil Pelajar dan Refleksi');
  });
});

describe('nomor halaman cetak', () => {
  const pages = splitPages(syntheticBook()).map(cleanText);
  const { labels, coverage } = detectPageLabels(pages);
  it('mengenali nomor dari header berjalan, termasuk halaman genap dan ganjil', () => {
    expect(labels[4]).toEqual({ label: '1', confidence: 'terdeteksi' });
    expect(labels[33]).toEqual({ label: '30', confidence: 'terdeteksi' });
    expect(coverage).toBeGreaterThan(0.8);
  });
  it('mengenali nomor romawi di bagian depan', () => {
    expect(labels[2]?.label).toBe('iii');
    expect(labels[3]?.label).toBe('iv');
  });
  it('menyimpulkan nomor halaman yang tidak tercetak dan menandainya', () => {
    const p = [...pages];
    p[10] = 'Halaman gambar penuh tanpa nomor.';
    const r = detectPageLabels(p);
    expect(r.labels[10]).toEqual({ label: '7', confidence: 'disimpulkan' });
  });
});

describe('metadata', () => {
  const m = extractMetadata(splitPages(syntheticBook()).map(cleanText));
  it('membaca jenjang, kelas, jenis buku, tahun, penulis, penerbit, ISBN, dan pemegang hak cipta', () => {
    expect(m).toMatchObject({
      level: 'SMP/MTs', grade: 7, bookType: 'buku_guru', year: 2023, edition: 'Edisi Revisi',
      authors: ['Ani Pratiwi', 'Budi Santoso'], publisher: 'Pusat Perbukuan Uji', isbn: ['978-623-118-520-4'],
      copyrightHolder: 'Kementerian Uji Republik Indonesia', title: 'Panduan Guru Seni Rupa untuk SMP/MTs Kelas VII',
    });
  });
  it('buku tanpa "Panduan Guru" di sampul dianggap buku siswa', () => {
    expect(extractMetadata(['SMA/MA Kelas XI\nSENI RUPA\n2024']).bookType).toBe('buku_siswa');
  });
});

describe('struktur bab', () => {
  const pages = splitPages(syntheticBook()).map(cleanText);
  const { labels } = detectPageLabels(pages);
  it('membaca entri utama daftar isi yang diikuti "A. …"', () => {
    expect(tocTopEntries(pages).map((e) => [e.title, e.printed, e.kind])).toEqual([
      ['Panduan Umum', 1, 'bagian'], ['Menggambar Alam', 11, 'bab'], ['Mendesain Poster', 21, 'bab'],
    ]);
  });
  it('memetakan bab ke halaman berkas dan menandai yang cocok dengan judul halaman', () => {
    const { chapters } = detectChapters(pages, labels);
    const verified = verifyChapters(pages, chapters);
    expect(verified.map((c) => [c.kind, c.ordinal, labels[c.startIndex]?.label, c.source, c.verified])).toEqual([
      ['bagian', 0, '1', 'daftar_isi', true],
      ['bab', 1, '11', 'gabungan', true],
      ['bab', 2, '21', 'gabungan', true],
    ]);
    expect(verified[1]!.endIndex).toBe(verified[2]!.startIndex - 1);
  });
  it('memberi peringatan bila tidak ada bab yang dikenali', () => {
    const r = detectChapters(['Halaman tanpa struktur.', 'Halaman lain.'], [{ label: null, confidence: 'tidak_diketahui' }, { label: null, confidence: 'tidak_diketahui' }]);
    expect(r.chapters).toEqual([]);
    expect(r.warnings.join(' ')).toMatch(/Tidak ada bab/);
  });
});

describe('potongan untuk pencarian', () => {
  const pages = splitPages(syntheticBook()).map(cleanText);
  const chunks = chunkPages(pages);
  it('tidak mengindeks halaman daftar isi', () => {
    expect(chunks.some((c) => c.pageIndex === 3)).toBe(false);
  });
  it('tidak pernah melintasi batas halaman dan tidak melebihi panjang maksimum', () => {
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(1201);
      expect(pages[c.pageIndex]!.replace(/\s+/g, ' ')).toContain(c.content.slice(0, 40));
    }
  });
  it('halaman panjang dipecah menjadi beberapa potongan berurutan', () => {
    const p15 = chunks.filter((c) => c.pageIndex === 18);
    expect(p15.length).toBeGreaterThan(1);
    expect(new Set(chunks.map((c) => c.ord)).size).toBe(chunks.length);
  });
});

describe('baris database', () => {
  const r = ingestText(syntheticBook());
  it('buku baru selalu privat dari sisi AI dan butuh tinjauan', () => {
    const b = bookRow(r, { fileName: 'uji.pdf', sha256: 'a'.repeat(64) });
    expect(b).toMatchObject({ status: 'perlu_tinjauan', license_kind: 'hak_cipta_dilindungi', allow_ai_processing: false, page_count: 34 });
    expect(b.license_note).toMatch(/tidak ditampilkan publik/);
  });
  it('bab hasil otomatis belum dianggap ditinjau', () => {
    expect(chapterRows(r).every((c) => c.reviewed === false)).toBe(true);
  });
  it('slug aman untuk URL', () => {
    expect(slugify('Panduan Guru Seni Rupa — SMP/MTs Kelas VII!')).toBe('panduan-guru-seni-rupa-smp-mts-kelas-vii');
  });
});
