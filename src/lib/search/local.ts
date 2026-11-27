// Pencarian lokal atas koleksi demo, dipakai saat Supabase belum dikonfigurasi.
// Mendukung: tanpa beda huruf besar/kecil, imbuhan umum Bahasa Indonesia, dan toleransi salah ketik.
import type { KnowledgeItem, SearchHit } from './types';

const STOPWORDS = new Set([
  'apa', 'itu', 'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'adalah', 'ini', 'cara',
  'bagaimana', 'mengapa', 'kenapa', 'atau', 'dalam', 'sebuah', 'para', 'oleh', 'juga', 'tentang',
]);

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Penghapus imbuhan sederhana (bukan stemmer lengkap): cukup untuk koleksi kecil. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 4) return w;
  for (const suf of ['nya', 'kan', 'lah', 'kah', 'an', 'i']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) { w = w.slice(0, -suf.length); break; }
  }
  const prefixes: [RegExp, string][] = [
    [/^meng(?=[aiueogh])/, ''], [/^meny/, 's'], [/^mem(?=[bpf])/, ''], [/^mem/, 'p'], [/^men(?=[cdjtz])/, ''], [/^men/, 't'], [/^me/, ''],
    [/^peng(?=[aiueogh])/, ''], [/^peny/, 's'], [/^pem(?=[bpf])/, ''], [/^pen(?=[cdjtz])/, ''], [/^pe/, ''],
    [/^ber/, ''], [/^ter/, ''], [/^di/, ''], [/^ke/, ''], [/^se/, ''],
  ];
  for (const [re, rep] of prefixes) {
    if (re.test(w)) {
      const cand = w.replace(re, rep);
      if (cand.length >= 4) { w = cand; }
      break;
    }
  }
  return w;
}

export function tokens(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Jarak Levenshtein dengan batas atas, untuk toleransi salah ketik. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

interface Indexed { item: KnowledgeItem; title: Set<string>; topics: Set<string>; text: Set<string>; vocab: Set<string>; surface: Map<string, string> }

export function buildIndex(items: KnowledgeItem[]): Indexed[] {
  return items.map((item) => {
    const title = new Set(tokens(item.title).map(stem));
    const topics = new Set(item.topics.flatMap((t) => tokens(t)).map(stem));
    const text = new Set(tokens(`${item.summary} ${item.body}`).map(stem));
    const surface = new Map<string, string>();
    for (const w of tokens(`${item.title} ${item.topics.join(' ')} ${item.summary} ${item.body}`)) {
      const st = stem(w);
      if (!surface.has(st)) surface.set(st, w);
    }
    return { item, title, topics, text, vocab: new Set([...title, ...topics, ...text]), surface };
  });
}

export function searchLocal(index: Indexed[], query: string, limit = 20): { hits: SearchHit[]; suggestion?: string } {
  const qTokens = tokens(query);
  if (qTokens.length === 0) return { hits: [] };
  const vocab = new Set(index.flatMap((d) => [...d.vocab]));
  const surface = new Map<string, string>();
  for (const d of index) for (const [k, v] of d.surface) if (!surface.has(k)) surface.set(k, v);

  // Perbaiki salah ketik: ganti token yang tidak dikenal dengan kata terdekat di kosakata.
  let corrected = false;
  const shown: string[] = [];
  const terms = qTokens.map((raw) => {
    const s = stem(raw);
    shown.push(raw);
    if (vocab.has(s)) return s;
    const max = s.length >= 7 ? 2 : 1;
    let best: string | null = null;
    let bestD = max + 1;
    for (const v of vocab) {
      const d = editDistance(s, v, max);
      if (d < bestD) { bestD = d; best = v; }
    }
    if (best) { corrected = true; shown[shown.length - 1] = surface.get(best) ?? best; return best; }
    return s;
  });

  const scored = index.map((d) => {
    let score = 0;
    const matched: string[] = [];
    let all = true;
    for (const t of terms) {
      const inTitle = d.title.has(t), inTopic = d.topics.has(t), inText = d.text.has(t);
      if (inTitle) score += 3;
      if (inTopic) score += 2;
      if (inText) score += 1;
      if (inTitle || inTopic || inText) matched.push(t); else all = false;
    }
    if (all && terms.length > 1) score += 2;
    return { d, score, matched, all };
  }).filter((s) => s.score > 0);
  // Seperti mesin pencari umum: bila ada dokumen yang memuat SEMUA kata, tampilkan itu saja.
  const anyAll = scored.some((s) => s.all);
  const ranked = (anyAll ? scored.filter((s) => s.all) : scored)
    .sort((a, b) => b.score - a.score || a.d.item.title.localeCompare(b.d.item.title, 'id'));

  const hits: SearchHit[] = ranked.slice(0, limit).map(({ d, matched }) => {
    const { body: _body, ...rest } = d.item;
    void _body;
    const topicHits = d.item.topics.filter((tp) => tokens(tp).map(stem).some((x) => matched.includes(x)));
    return { item: rest, matched: topicHits.length ? topicHits : matched.map((m) => surface.get(m) ?? m) };
  });
  const suggestion = corrected ? shown.join(' ') : undefined;
  return { hits, suggestion };
}
