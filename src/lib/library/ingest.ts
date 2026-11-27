// Pemroses buku: teks per halaman → nomor halaman cetak, metadata, bab, potongan (chunk) untuk pencarian.
// Murni TypeScript tanpa dependensi Node/browser, sehingga bisa dipakai di skrip maupun di browser admin.
// Semua hasil otomatis bersifat USULAN: bab dan metadata wajib ditinjau manusia sebelum buku berstatus "siap".

export type LabelConfidence = 'terdeteksi' | 'disimpulkan' | 'tidak_diketahui';

export interface PageLabel {
  /** Label halaman cetak: "17", "iv", atau null bila tidak diketahui. */
  label: string | null;
  confidence: LabelConfidence;
}

export interface ChapterProposal {
  ordinal: number;
  kind: 'bab' | 'unit' | 'bagian';
  numberLabel: string | null;
  title: string;
  /** Indeks halaman (0-based) di berkas. */
  startIndex: number;
  endIndex: number;
  source: 'daftar_isi' | 'judul_halaman' | 'gabungan';
  /** true bila kata-kata judul ditemukan di halaman awal (±2 halaman). Bab yang false wajib dicek manusia. */
  verified?: boolean;
}

export interface BookMetadataProposal {
  title: string | null;
  bookType: 'buku_siswa' | 'buku_guru' | 'lainnya';
  level: 'SD/MI' | 'SMP/MTs' | 'SMA/MA' | 'SMK/MAK' | null;
  grade: number | null;
  semester: number | null;
  edition: string | null;
  year: number | null;
  authors: string[];
  publisher: string | null;
  copyrightHolder: string | null;
  isbn: string[];
}

export interface Chunk { pageIndex: number; ord: number; content: string }

export interface IngestResult {
  pageCount: number;
  pages: string[];
  labels: PageLabel[];
  labelCoverage: number;
  metadata: BookMetadataProposal;
  chapters: ChapterProposal[];
  chunks: Chunk[];
  warnings: string[];
}

// ------------------------------------------------------------------ halaman

/** Memecah teks menjadi halaman. PDF (pdftotext/pdf.js) memakai form feed; ekspor .txt dari PDF memakai satu baris kosong. */
export function splitPages(text: string): string[] {
  const t = text.replace(/\r\n?/g, '\n');
  if (t.includes('\f')) return t.split('\f').map((p) => p.replace(/^\n+|\s+$/g, '')).filter((p, i, a) => p.length > 0 || i < a.length - 1);
  return t.split(/\n[ \t]*\n/).map((p) => p.trim());
}

const LIGATURE_FIXES: [RegExp, string][] = [
  [/\bProil\b/g, 'Profil'], [/\bproil\b/g, 'profil'],
  [/\bReleksi\b/g, 'Refleksi'], [/\breleksi\b/g, 'refleksi'], [/\bmerelek/g, 'merefleks'],
  [/identiikasi/g, 'identifikasi'], [/klasiikasi/g, 'klasifikasi'], [/modiikasi/g, 'modifikasi'],
  [/spesiik/g, 'spesifik'], [/signiikan/g, 'signifikan'], [/sertiikat/g, 'sertifikat'],
  [/\bdeinisi/g, 'definisi'], [/\bgrais\b/g, 'grafis'], [/\bGrais\b/g, 'Grafis'], [/\bkonlik/g, 'konflik'],
];

/** Membersihkan artefak ekstraksi yang umum: tanda hubung lunak, spasi ganda, ligatur fi/fl yang hilang. */
export function cleanText(s: string): string {
  let t = s.replace(/­/g, '-').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  for (const [re, rep] of LIGATURE_FIXES) t = t.replace(re, rep);
  return t.trim();
}

// ------------------------------------------------------------------ nomor halaman cetak

const ROMAN = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
function romanValue(r: string): number {
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
  let total = 0;
  for (let i = 0; i < r.length; i++) {
    const a = v[r[i]!]!, b = v[r[i + 1] ?? ''] ?? 0;
    total += a < b ? -a : a;
  }
  return total;
}
function toRoman(n: number): string {
  const map: [number, string][] = [[100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

interface Candidate { kind: 'arabic' | 'roman'; value: number }

/** Mencari angka halaman di baris tepi halaman (header/footer berjalan). */
function pageNumberCandidates(page: string): Candidate[] {
  const lines = page.split('\n').map((l) => l.trim()).filter(Boolean);
  const edge = [...lines.slice(0, 3), ...lines.slice(-3)];
  const out: Candidate[] = [];
  for (const l of edge) {
    if (/^\d{1,3}$/.test(l)) out.push({ kind: 'arabic', value: Number(l) });
    else if (ROMAN.test(l.toLowerCase()) && l.length <= 6) out.push({ kind: 'roman', value: romanValue(l.toLowerCase()) });
    else {
      // "4 Panduan Guru Seni Rupa …" atau "Bab 1 Menggambar Bentuk 5": header berjalan dengan nomor di tepi.
      const head = /^(\d{1,3})\s+(?=\S)(?!(?:cm|mm|m|kg|g|jam|menit|tahun|hari|orang|kali|buah|lembar)\b)\D.{4,}$/.exec(l);
      const tail = /^\D.{4,}?\s(\d{1,3})$/.exec(l);
      if (head && /seni|panduan|guru|dasar|buku|kelas/i.test(l)) out.push({ kind: 'arabic', value: Number(head[1]) });
      else if (tail && l.length < 120 && !/\.{3,}/.test(l)) out.push({ kind: 'arabic', value: Number(tail[1]) });
    }
  }
  return out;
}

/** Menentukan label halaman cetak dengan mencari "offset" (nomor cetak − indeks) yang paling konsisten. */
export function detectPageLabels(pages: string[]): { labels: PageLabel[]; coverage: number } {
  const n = pages.length;
  const cands = pages.map(pageNumberCandidates);
  // Offset angka arab: hitung suara.
  const votes = new Map<number, number>();
  cands.forEach((cs, i) => cs.filter((c) => c.kind === 'arabic').forEach((c) => {
    const off = c.value - (i + 1);
    votes.set(off, (votes.get(off) ?? 0) + 1);
  }));
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const bestOffset = ranked[0]?.[0] ?? null;

  const labels: PageLabel[] = Array.from({ length: n }, () => ({ label: null, confidence: 'tidak_diketahui' as LabelConfidence }));
  if (bestOffset !== null) {
    const firstArabic = 1 - bestOffset; // indeks 1-based dari halaman cetak "1"
    for (let i = 0; i < n; i++) {
      const printed = i + 1 + bestOffset;
      if (printed < 1) continue;
      const hit = cands[i]!.some((c) => c.kind === 'arabic' && c.value === printed);
      labels[i] = { label: String(printed), confidence: hit ? 'terdeteksi' : 'disimpulkan' };
    }
    // Halaman romawi (bagian depan) sebelum halaman cetak 1.
    const romanVotes = new Map<number, number>();
    cands.forEach((cs, i) => cs.filter((c) => c.kind === 'roman').forEach((c) => {
      if (i + 1 < firstArabic) romanVotes.set(c.value - (i + 1), (romanVotes.get(c.value - (i + 1)) ?? 0) + 1);
    }));
    const romanOff = [...romanVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (romanOff !== undefined) {
      for (let i = 0; i < Math.min(n, firstArabic - 1); i++) {
        const v = i + 1 + romanOff;
        if (v < 1) continue;
        const hit = cands[i]!.some((c) => c.kind === 'roman' && c.value === v);
        labels[i] = { label: toRoman(v), confidence: hit ? 'terdeteksi' : 'disimpulkan' };
      }
    }
  }
  const detected = labels.filter((l) => l.confidence === 'terdeteksi').length;
  return { labels, coverage: n ? detected / n : 0 };
}

// ------------------------------------------------------------------ metadata

const LEVEL_RE = /\b(SD\/MI|SMP\/MTs|SMA\/MA|SMK\/MAK)\b\s*(?:KELAS|Kelas|kelas)\s*([IVX]+|\d{1,2})\b/i;

export function extractMetadata(pages: string[]): BookMetadataProposal {
  const front = pages.slice(0, 6).join('\n');
  const lines = front.split('\n').map((l) => l.trim()).filter(Boolean);
  const meta: BookMetadataProposal = {
    title: null, bookType: 'lainnya', level: null, grade: null, semester: null, edition: null,
    year: null, authors: [], publisher: null, copyrightHolder: null, isbn: [],
  };
  const lv = LEVEL_RE.exec(front);
  if (lv) {
    const raw = lv[1]!.toUpperCase();
    meta.level = raw === 'SD/MI' ? 'SD/MI' : raw === 'SMP/MTS' ? 'SMP/MTs' : raw === 'SMA/MA' ? 'SMA/MA' : 'SMK/MAK';
    const g = lv[2]!;
    meta.grade = /^\d+$/.test(g) ? Number(g) : romanValue(g.toLowerCase());
  }
  const cover = pages.slice(0, 1).join('\n');
  if (/panduan guru|buku guru/i.test(cover)) meta.bookType = 'buku_guru';
  else if (meta.level) meta.bookType = 'buku_siswa';
  const sem = /Semester\s+(\d)/i.exec(cover);
  if (sem) meta.semester = Number(sem[1]);
  if (/Edisi Revisi/i.test(front)) meta.edition = 'Edisi Revisi';
  const years = [...front.matchAll(/\b(20[12]\d)\b/g)].map((m) => Number(m[1]));
  if (years.length) meta.year = Math.max(...years.filter((y) => y <= 2100));
  meta.isbn = [...new Set([...front.matchAll(/\b(97[89][-\s]?(?:\d[-\s]?){9}\d)\b/g)].map((m) => m[1]!.replace(/\s/g, '')))];
  const hc = /Hak Cipta pada (.+?)(?:\n|$)/.exec(front);
  if (hc) meta.copyrightHolder = hc[1]!.trim();
  const pub = lines.findIndex((l) => /^Penerbit$/i.test(l));
  if (pub >= 0 && lines[pub + 1]) meta.publisher = lines[pub + 1]!;
  const pen = lines.findIndex((l) => /^Penulis$/i.test(l));
  if (pen >= 0) {
    for (const l of lines.slice(pen + 1, pen + 6)) {
      if (/^(Penelaah|Penyelia|Ilustrator|Editor|Desainer|Kontributor|Penerbit)/i.test(l)) break;
      if (l.length <= 60) meta.authors.push(l);
    }
  }
  const isSmk = meta.level === 'SMK/MAK';
  const subject = /DASAR-DASAR\s*SENI RUPA|Dasar-Dasar Seni Rupa/i.test(front) ? 'Dasar-Dasar Seni Rupa' : /SENI RUPA|Seni Rupa/.test(front) ? 'Seni Rupa' : null;
  if (subject) {
    const parts = [meta.bookType === 'buku_guru' ? 'Panduan Guru' : null, subject,
      meta.level && meta.grade ? `untuk ${meta.level} Kelas ${toRoman(meta.grade).toUpperCase()}` : null,
      meta.semester ? `Semester ${meta.semester}` : null].filter(Boolean);
    meta.title = parts.join(' ');
  }
  void isSmk;
  return meta;
}

// ------------------------------------------------------------------ bab

const ROMAN_UP: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
const numOf = (s: string) => (/^\d+$/.test(s) ? Number(s) : ROMAN_UP[s.toUpperCase()] ?? null);
const BAD_TITLE = /KEMENTERIAN|REPUBLIK INDONESIA|^LKPD|^\d{4}$|^Nama\s*:/i;
const HEADING = /^(Bab|BAB|Unit|UNIT)\s+([IVX]+|\d{1,2})(?=$|[\s:.\-–])\s*[:.\-–]?\s*(.*)$/;

function frontMatterEnd(pages: string[]): number {
  let fm = 0;
  pages.slice(0, 60).forEach((p, i) => { if ((p.match(/\.{5,}/g) ?? []).length >= 3) fm = i; });
  return fm;
}

function tidyTitle(s: string): string {
  return s.replace(/\.{3,}.*$/, '').replace(/\s+\d{1,3}$/, '').replace(/^[-–:.\s]+/, '').replace(/\s+/g, ' ').trim();
}

/** Judul bab dari daftar isi: "Bab I Menggambar ........ 25" → {n:1, title, printed:25}. */
function tocChapters(pages: string[], fm: number): { n: number; kind: 'bab' | 'unit'; title: string; printed: number | null; suspect: boolean }[] {
  const out: { n: number; kind: 'bab' | 'unit'; title: string; printed: number | null; suspect: boolean }[] = [];
  let maxSoFar = 0;
  for (const p of pages.slice(0, fm + 1)) {
    for (const raw of p.split('\n')) {
      const l = raw.trim();
      const trailing = /\.{3,}\s*(\d{1,3})\s*$/.exec(l);
      const before = maxSoFar;
      if (trailing) maxSoFar = Math.max(maxSoFar, Number(trailing[1]));
      const m = HEADING.exec(l);
      if (!m) continue;
      const n = numOf(m[2]!);
      if (!n || out.some((o) => o.n === n)) continue;
      const pg = /(\d{1,3})\s*$/.exec(l);
      const title = tidyTitle(m[3] ?? '');
      const printed = pg ? Number(pg[1]) : null;
      out.push({ n, kind: /unit/i.test(m[1]!) ? 'unit' : 'bab', title, printed, suspect: printed !== null && printed < before });
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

const NON_CHAPTER = /^(Kata Pengantar|Prakata|Daftar|Petunjuk|Glosarium|Indeks|Profil|Biodata|Lampiran|Gambar|Tabel|Riwayat)/i;

/** Membaca daftar isi: entri utama yang langsung diikuti "A. …" dianggap bab. "Panduan Umum/Khusus" dianggap bagian. */
export function tocTopEntries(pages: string[]): { title: string; printed: number; kind: 'bab' | 'unit' | 'bagian' }[] {
  const start = pages.slice(0, 20).findIndex((p) => /^\s*Daftar Isi/im.test(p.split('\n').slice(0, 4).join('\n')));
  if (start < 0) return [];
  const lines: string[] = [];
  for (let i = start; i < Math.min(pages.length, start + 4); i++) {
    if (i > start && /^\s*Daftar (Gambar|Tabel)/im.test(pages[i]!.split('\n').slice(0, 3).join('\n'))) break;
    for (const raw of pages[i]!.split('\n')) {
      const l = raw.replace(/\.{3,}/g, ' ').replace(/\s+/g, ' ').trim()
        .replace(/^(?:[IVX]+)\s+(?=[A-Z]\.\s)/, ''); // "I A. Pendahuluan" → "A. Pendahuluan"
      if (l) lines.push(l);
    }
  }
  const out: { title: string; printed: number; kind: 'bab' | 'unit' | 'bagian' }[] = [];
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]!;
    if (/^(Bab|BAB|Unit|UNIT)$/.test(l) && lines[i + 1]) l = `${l} ${lines[i + 1]}`; // "Bab" di baris sendiri
    const m = /^(.*\S)\s+(\d{1,3})$/.exec(l);
    if (!m || /^([A-Z]|\d{1,2}|[a-z])\.\s/.test(l) || NON_CHAPTER.test(l)) continue;
    const next = lines.slice(i + 1, i + 4).find((x) => /^([A-Z]|\d{1,2})\.\s/.test(x));
    if (!next || !/^A\.\s/.test(next)) continue;
    let title = m[1]!.replace(/^(Bab|BAB|Unit|UNIT)\s+([IVX]+|\d{1,2})?\s*[:.\-–|]?\s*/, '').trim();
    const kind: 'bab' | 'unit' | 'bagian' = /^Panduan (Umum|Khusus)$/i.test(title) ? 'bagian' : /^unit/i.test(m[1]!) ? 'unit' : 'bab';
    if (title.length < 3) continue;
    title = title.replace(/\s+/g, ' ');
    out.push({ title, printed: Number(m[2]), kind });
  }
  // Nomor halaman bab harus naik.
  return out.filter((e, i, a) => i === 0 || e.printed > a[i - 1]!.printed);
}

export function detectChapters(pages: string[], labels: PageLabel[]): { chapters: ChapterProposal[]; warnings: string[] } {
  const warnings: string[] = [];
  const fm = frontMatterEnd(pages);
  const toc = tocChapters(pages, fm);
  const labelIndex = new Map<string, number>();
  labels.forEach((l, i) => { if (l.label && !labelIndex.has(l.label)) labelIndex.set(l.label, i); });

  // Kandidat dari judul di awal halaman (setelah bagian depan).
  const cands = new Map<number, { index: number; title: string; kind: 'bab' | 'unit'; running: boolean }[]>();
  pages.forEach((p, i) => {
    if (i <= fm) return;
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let k = 0; k < Math.min(3, lines.length); k++) {
      const m = HEADING.exec(lines[k]!);
      if (!m) continue;
      const n = numOf(m[2]!);
      if (!n) break;
      let title = tidyTitle(m[3] ?? '');
      if (!title || BAD_TITLE.test(title)) title = tidyTitle(lines.slice(k + 1, k + 4).filter((x) => x.length < 80 && !/^\d+$/.test(x) && !BAD_TITLE.test(x)).slice(0, 2).join(' '));
      const list = cands.get(n) ?? [];
      list.push({ index: i, title, kind: /unit/i.test(m[1]!) ? 'unit' : 'bab', running: /\s\d{1,3}$/.test(lines[k]!) });
      cands.set(n, list);
      break;
    }
  });

  // Jalur 1: daftar isi dengan pola "entri utama → A. …".
  const top = tocTopEntries(pages);
  const offset = (() => {
    const votes = new Map<number, number>();
    labels.forEach((l, i) => { if (l.label && /^\d+$/.test(l.label)) { const o = Number(l.label) - i; votes.set(o, (votes.get(o) ?? 0) + 1); } });
    return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();
  const words = (x: string) => new Set(x.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const overlap = (a: string, b: string) => { const A = words(a), B = words(b); let n = 0; A.forEach((w) => { if (B.has(w)) n++; }); return A.size && B.size ? n / Math.min(A.size, B.size) : 0; };

  // Jalur 2: judul di halaman pembuka bab, harus berurutan.
  const headPath = new Map<number, { index: number; title: string; kind: 'bab' | 'unit'; running?: boolean }>();
  let prev = fm;
  for (const n of [...cands.keys()].sort((a, b) => a - b)) {
    const c = (cands.get(n) ?? []).find((x) => x.index > prev + 3);
    if (c) { headPath.set(n, c); prev = c.index; }
  }
  // Jalur 1 dinomori ulang berurutan.
  const tocPath = new Map<number, { index: number; title: string; kind: 'bab' | 'unit'; running?: boolean }>();
  const parts: ChapterProposal[] = [];
  if (offset !== null) {
    let ord = 0;
    for (const t of top) {
      const idx = labelIndex.get(String(t.printed)) ?? t.printed - offset;
      if (idx < 0 || idx >= pages.length) continue;
      if (t.kind === 'bagian') { parts.push({ ordinal: 0, kind: 'bagian', numberLabel: null, title: t.title, startIndex: idx, endIndex: idx, source: 'daftar_isi' }); continue; }
      tocPath.set(++ord, { index: idx, title: t.title, kind: t.kind === 'unit' ? 'unit' : 'bab' });
    }
  }
  if (tocPath.size >= 2 || headPath.size >= 2) {
    const res: ChapterProposal[] = [];
    const ords = [...new Set([...tocPath.keys(), ...headPath.keys()])].sort((a, b) => a - b);
    for (const n of ords) {
      const t = tocPath.get(n), h = headPath.get(n);
      let pick: { index: number; title: string; kind: 'bab' | 'unit'; running?: boolean }; let source: ChapterProposal['source'];
      if (t && h && Math.abs(t.index - h.index) <= 2) { pick = t; source = 'gabungan'; }
      else if (t && h) { const useHead = !h.running && overlap(t.title, h.title) >= 0.5; pick = useHead ? { ...h, title: t.title } : t; source = useHead ? 'gabungan' : 'daftar_isi'; }
      else if (t) { pick = t; source = 'daftar_isi'; }
      else { pick = h!; source = 'judul_halaman'; }
      res.push({ ordinal: n, kind: pick.kind, numberLabel: String(n), title: BAD_TITLE.test(pick.title) || /^Panduan Guru/i.test(pick.title) ? `Bab ${n}` : pick.title, startIndex: pick.index, endIndex: pick.index, source });
    }
    // Buang bab yang halaman awalnya tidak naik.
    const mono = res.filter((c, i, a) => i === 0 || c.startIndex > a.slice(0, i).reduce((m, x) => Math.max(m, x.startIndex), -1));
    const all = [...parts.filter((p) => !mono.length || p.startIndex < mono[0]!.startIndex), ...mono].sort((a, b) => a.startIndex - b.startIndex);
    all.forEach((c, i) => { c.endIndex = (all[i + 1]?.startIndex ?? pages.length) - 1; });
    const w: string[] = [];
    const chs = all.filter((c) => c.kind !== 'bagian');
    chs.forEach((c, i) => { if (i > 0 && c.ordinal !== chs[i - 1]!.ordinal + 1) w.push(`Nomor bab melompat dari ${chs[i - 1]!.ordinal} ke ${c.ordinal}.`); });
    if (chs[0] && chs[0].ordinal !== 1) w.push('Bab 1 tidak terdeteksi.');
    if (chs.some((c) => c.source !== 'gabungan')) w.push('Sebagian bab hanya dari satu sumber (daftar isi atau judul halaman); cek halaman awalnya.');
    if (chs.some((c) => /^Bab \d+$/.test(c.title))) w.push('Sebagian judul bab tidak terbaca; isi manual.');
    return { chapters: all, warnings: w };
  }

  const numbers = [...new Set([...toc.map((t) => t.n), ...cands.keys()])].sort((a, b) => a - b);
  const picked: ChapterProposal[] = [];
  let last = fm;
  for (const n of numbers) {
    const t = toc.find((x) => x.n === n);
    let index: number | null = null;
    let source: ChapterProposal['source'] = 'judul_halaman';
    const fromToc = t?.printed != null ? labelIndex.get(String(t.printed)) : undefined;
    const fromHead = (cands.get(n) ?? []).find((c) => c.index > last + 3);
    const headAgrees = fromHead && t && fromToc !== undefined && Math.abs(fromHead.index - fromToc) > 2 && overlap(t.title, fromHead.title) >= 0.5 && (!fromHead.running || t.suspect);
    if (headAgrees) {
      index = fromHead!.index; source = 'gabungan';
    } else if (fromToc !== undefined && fromToc > last) {
      index = fromToc; source = fromHead && Math.abs(fromHead.index - fromToc) <= 2 ? 'gabungan' : 'daftar_isi';
    } else if (fromHead) {
      index = fromHead.index;
    }
    if (index === null) continue;
    const title = (t?.title && t.title.length > 2 ? t.title : fromHead?.title) || `${t?.kind === 'unit' || fromHead?.kind === 'unit' ? 'Unit' : 'Bab'} ${n}`;
    picked.push({ ordinal: n, kind: t?.kind ?? fromHead?.kind ?? 'bab', numberLabel: String(n), title, startIndex: index, endIndex: index, source });
    last = index;
  }

  // Urutan nomor harus naik; lompatan berarti ada bab yang terlewat.
  for (let i = 1; i < picked.length; i++) {
    if (picked[i]!.ordinal !== picked[i - 1]!.ordinal + 1) warnings.push(`Nomor bab melompat dari ${picked[i - 1]!.ordinal} ke ${picked[i]!.ordinal}; periksa daftar isi.`);
  }
  if (picked.length === 0) warnings.push('Tidak ada bab yang terdeteksi; struktur perlu diisi manual.');
  if (picked.length > 0 && picked[0]!.ordinal !== 1) warnings.push('Bab 1 tidak terdeteksi.');
  picked.forEach((c, i) => { c.endIndex = (picked[i + 1]?.startIndex ?? pages.length) - 1; });
  if (picked.some((c) => c.source === 'judul_halaman')) warnings.push('Sebagian bab hanya dikenali dari judul halaman, belum dicocokkan dengan daftar isi.');
  return { chapters: picked, warnings };
}

// ------------------------------------------------------------------ potongan untuk pencarian

/** Memotong teks per halaman menjadi bagian ±maxLen karakter di batas paragraf/kalimat. Tidak melintasi halaman agar sitasi tepat. */
export function chunkPages(pages: string[], maxLen = 1200): Chunk[] {
  const out: Chunk[] = [];
  let ord = 0;
  pages.forEach((page, pageIndex) => {
    // Halaman daftar isi/gambar/tabel (banyak titik penuntun) bukan isi pelajaran: tidak diindeks.
    if ((page.match(/\.{5,}/g) ?? []).length >= 3) return;
    const text = page.replace(/\n(?!\n)/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length < 40) return;
    let rest = text;
    while (rest.length > 0) {
      if (rest.length <= maxLen) { out.push({ pageIndex, ord: ord++, content: rest }); break; }
      let cut = rest.lastIndexOf('. ', maxLen);
      if (cut < maxLen * 0.5) cut = rest.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      out.push({ pageIndex, ord: ord++, content: rest.slice(0, cut + 1).trim() });
      rest = rest.slice(cut + 1).trim();
    }
  });
  return out;
}

// ------------------------------------------------------------------ semuanya

/** Menandai bab yang judulnya benar-benar muncul di halaman awalnya. */
export function verifyChapters(pages: string[], chapters: ChapterProposal[]): ChapterProposal[] {
  return chapters.map((c) => {
    const words = (c.title.toLowerCase().match(/[a-z]{5,}/g) ?? []).slice(0, 3);
    const win = pages.slice(c.startIndex, c.startIndex + 3).join(' ').toLowerCase();
    return { ...c, verified: words.length > 0 && words.every((w) => win.includes(w)) };
  });
}

export function ingestText(raw: string): IngestResult {
  const pages = splitPages(raw).map(cleanText);
  const { labels, coverage } = detectPageLabels(pages);
  const metadata = extractMetadata(pages);
  const detected = detectChapters(pages, labels);
  const chapters = verifyChapters(pages, detected.chapters);
  const warnings = [...detected.warnings];
  if (coverage < 0.5) warnings.push(`Nomor halaman cetak hanya terdeteksi di ${Math.round(coverage * 100)}% halaman; tampilkan nomor halaman sebagai perkiraan.`);
  if (!metadata.title) warnings.push('Judul tidak terdeteksi; isi manual.');
  if (metadata.authors.length === 0) warnings.push('Penulis tidak terdeteksi; isi manual.');
  return { pageCount: pages.length, pages, labels, labelCoverage: coverage, metadata, chapters, chunks: chunkPages(pages), warnings };
}
