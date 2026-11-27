// Mengubah hasil pemrosesan menjadi baris database. Dipakai skrip impor dan unggah dari browser.
import type { IngestResult } from './ingest';

export interface BookRow {
  slug: string; title: string; book_type: string; level: string | null; grade: number | null; semester: number | null;
  subject: string; edition: string | null; year: number | null; authors: string[]; publisher: string | null; isbn: string[];
  copyright_holder: string | null; license_kind: 'hak_cipta_dilindungi' | 'lisensi_terbuka' | 'domain_publik' | 'izin_khusus';
  license_note: string; page_count: number; label_coverage: number; metadata_public: boolean; content_public: boolean; allow_ai_processing: boolean;
  status: 'perlu_tinjauan'; source_file_name: string | null; source_sha256: string | null; warnings: string[];
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'buku';
}

/** Buku terbitan Kementerian ditampilkan lengkap untuk umum dengan sumber dicantumkan (keputusan pemilik, 27 Nov 2026). */
export function isGovernmentBook(holder: string | null): boolean {
  return Boolean(holder && /^Kementerian\b/i.test(holder));
}

/** Hak cipta dilindungi adalah anggapan aman bila lisensi terbuka tidak tertulis jelas di buku. */
export function bookRow(r: IngestResult, opts: { slug?: string; fileName?: string; sha256?: string }): BookRow {
  const m = r.metadata;
  const gov = isGovernmentBook(m.copyrightHolder);
  const subject = /Dasar-Dasar Seni Rupa/.test(m.title ?? '') ? 'Dasar-Dasar Seni Rupa' : 'Seni Rupa';
  return {
    slug: opts.slug ?? slugify(m.title ?? opts.fileName ?? 'buku'),
    title: m.title ?? opts.fileName ?? 'Tanpa judul',
    book_type: m.bookType, level: m.level, grade: m.grade, semester: m.semester, subject,
    edition: m.edition, year: m.year, authors: m.authors, publisher: m.publisher, isbn: m.isbn,
    copyright_holder: m.copyrightHolder,
    license_kind: 'hak_cipta_dilindungi',
    license_note: gov
      ? `Hak cipta pada ${m.copyrightHolder}. Ditampilkan untuk pembelajaran dengan mencantumkan sumber; versi resmi tersedia di SIBI.`
      : m.copyrightHolder
        ? `Hak cipta pada ${m.copyrightHolder}. Dipakai untuk pembelajaran di sekolah yang diberi akses; isi tidak ditampilkan publik.`
        : 'Status lisensi belum diperiksa. Isi tidak ditampilkan publik.',
    page_count: r.pageCount, label_coverage: Number(r.labelCoverage.toFixed(3)),
    metadata_public: true, content_public: gov, allow_ai_processing: false, status: 'perlu_tinjauan',
    source_file_name: opts.fileName ?? null, source_sha256: opts.sha256 ?? null, warnings: r.warnings,
  };
}

export function pageRows(r: IngestResult) {
  return r.pages.map((content, page_index) => ({
    page_index, content, printed_label: r.labels[page_index]?.label ?? null,
    label_confidence: r.labels[page_index]?.confidence ?? 'tidak_diketahui',
  }));
}

export function chapterRows(r: IngestResult) {
  return r.chapters.map((c) => ({
    ordinal: c.ordinal, kind: c.kind, title: c.title.slice(0, 300), start_index: c.startIndex, end_index: c.endIndex,
    source: c.source, auto_verified: Boolean(c.verified), reviewed: false,
  }));
}

export function chunkRows(r: IngestResult) {
  return r.chunks.map((c) => ({ page_index: c.pageIndex, ord: c.ord, content: c.content.slice(0, 4000) }));
}
