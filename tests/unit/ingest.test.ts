// Tes pemroses buku dengan teks sintetis (isi buku sungguhan berhak cipta tidak disimpan di repositori).
import { describe, expect, it } from 'vitest';
import {
  chunkPages, cleanText, detectChapters, detectPageLabels, extractMetadata, ingestText, looksGarbled, openerPages, splitPages, tocTopEntries, verifyChapters,
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
  it('buku Kementerian: isi publik dengan sumber, tetapi tetap butuh tinjauan dan tanpa AI', () => {
    const b = bookRow(r, { fileName: 'uji.pdf', sha256: 'a'.repeat(64) });
    expect(b).toMatchObject({ status: 'perlu_tinjauan', license_kind: 'hak_cipta_dilindungi', allow_ai_processing: false, content_public: true, page_count: 34 });
    expect(b.license_note).toMatch(/mencantumkan sumber/);
  });
  it('buku penerbit lain tetap privat secara bawaan', () => {
    const other = { ...r, metadata: { ...r.metadata, copyrightHolder: 'Penerbit Swasta' } };
    const b = bookRow(other, {});
    expect(b.content_public).toBe(false);
    expect(b.license_note).toMatch(/tidak ditampilkan publik/);
  });
  it('bab hasil otomatis belum dianggap ditinjau', () => {
    expect(chapterRows(r).every((c) => c.reviewed === false)).toBe(true);
  });
  it('slug aman untuk URL', () => {
    expect(slugify('Panduan Guru Seni Rupa — SMP/MTs Kelas VII!')).toBe('panduan-guru-seni-rupa-smp-mts-kelas-vii');
  });
});

/**
 * Buku sintetis bergaya Prakarya: nomor cetak menempel di header berjalan, ada satu halaman sisipan tanpa nomor
 * (selisih nomor bergeser di tengah buku), dan halaman pembuka unit memuat blok Penulis/ISBN tanpa daftar isi bertitik.
 */
function prakaryaBook(): string {
  const pages: string[] = [];
  pages.push('SMA/MA KELAS XI\nBuku Panduan Guru\nKEMENTERIAN PENDIDIKAN\n2022');
  pages.push('Hak Cipta pada Kementerian Uji Republik Indonesia\nBuku Panduan Guru Prakarya dan Kewirausahaan: Kerajinan\nuntuk SMA/MA Kelas XI\nPenulis\nDewi Uji');
  const opener = (n: number, title: string[], q: string) => [...title, `“${q}?” ${n}`, 'UNIT', 'KEMENTERIAN PENDIDIKAN, KEBUDAYAAN', 'REPUBLIK INDONESIA, 2022',
    'Buku Panduan Guru Prakarya dan Kewirausahaan: Kerajinan', 'Untuk SMA/MA Kelas XI', 'Penulis : Dewi Uji, dkk.', 'ISBN : 978-602-000-000-0 (jil.2)'].join('\n');
  let printed = 1;
  for (let i = 0; i < 40; i++) {
    if (i === 20) { pages.push('Halaman foto sisipan tanpa nomor.'); continue; }
    const body = printed === 5 ? opener(1, ['Analisa Ragam', 'Kerajinan Nusantara'], 'Mengapa kerajinan berbeda')
      : printed === 25 ? opener(2, ['Pengolahan dan', 'Perancangan Produk'], 'Bagaimana memilih alat')
      : `${printed % 2 ? `Panduan Umum ${printed}` : `${printed} Buku Panduan Guru Prakarya Kerajinan untuk SMA/MA Kelas XI`}\nIsi halaman ${printed} tentang anyaman dan kerajinan lokal.`;
    pages.push(body);
    printed++;
  }
  return pages.join('\f');
}

describe('buku bergaya Prakarya (halaman pembuka unit, nomor bergeser)', () => {
  const r = ingestText(prakaryaBook());
  it('judul buku dibaca untuk mapel selain Seni Rupa', () => {
    expect(r.metadata.title).toBe('Panduan Guru Prakarya dan Kewirausahaan: Kerajinan untuk SMA/MA Kelas XI');
    expect(bookRow(r, {}).subject).toBe('Prakarya dan Kewirausahaan: Kerajinan');
  });
  it('nomor halaman tetap benar setelah halaman sisipan; halaman sisipan tidak diberi nomor palsu', () => {
    const idx = (label: string) => r.labels.findIndex((l) => l.label === label);
    expect(r.pages[idx('10')]).toContain('Isi halaman 10');
    expect(r.pages[idx('30')]).toContain('Isi halaman 30');
    expect(r.labels[22]).toEqual({ label: null, confidence: 'tidak_diketahui' });
    expect(new Set(r.labels.filter((l) => l.label).map((l) => l.label)).size).toBe(r.labels.filter((l) => l.label).length);
  });
  it('unit dikenali dari halaman pembuka, dengan judul tanpa pertanyaan pemantik', () => {
    const units = r.chapters.filter((c) => c.kind !== 'bagian');
    expect(units.map((c) => [c.ordinal, c.title, r.labels[c.startIndex]?.label])).toEqual([
      [1, 'Analisa Ragam Kerajinan Nusantara', '5'],
      [2, 'Pengolahan dan Perancangan Produk', '25'],
    ]);
    expect(units.every((c) => c.verified)).toBe(true);
  });
  it('halaman pembuka tanpa nomor eksplisit diberi nomor berurutan', () => {
    const pages = ['x', 'UNIT\nJudul Satu\nPenulis : A\nISBN : 1', 'isi', 'Unit 2\nJudul Dua\nPenulis : A\nISBN : 1'];
    expect(openerPages(pages, 0).map((o) => [o.n, o.title])).toEqual([[1, 'Judul Satu'], [2, 'Judul Dua']]);
  });
  it('mengenali judul dari teks berlapis ganda', () => {
    expect(looksGarbled('Membuat K Membuat Konstruksi onstruksi Sederhana')).toBe(true);
    expect(looksGarbled('Simulasi Pasar, Magang dan Lokakarya')).toBe(false);
  });
});
