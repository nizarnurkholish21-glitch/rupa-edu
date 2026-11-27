export type ContentKind = 'konsep' | 'sejarah' | 'tokoh' | 'karya' | 'teknik' | 'panduan';

export const KIND_LABEL: Record<ContentKind, string> = {
  konsep: 'Konsep',
  sejarah: 'Sejarah',
  tokoh: 'Tokoh',
  karya: 'Karya',
  teknik: 'Teknik',
  panduan: 'Panduan',
};

export interface KnowledgeItem {
  slug: string;
  title: string;
  summary: string;
  body: string;
  kind: ContentKind;
  topics: string[];
  min_grade: number | null;
  source_name: string;
  source_url: string | null;
  license: string;
  is_demo: boolean;
}

export interface SearchHit {
  item: Omit<KnowledgeItem, 'body'>;
  /** Kata atau topik yang cocok, ditampilkan sebagai "alasan relevansi". */
  matched: string[];
  /** Ejaan yang diduga dimaksud, jika kueri mengandung salah ketik. */
  correctedFrom?: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  /** Dari mana hasil berasal: database Supabase atau koleksi demo lokal. */
  backend: 'database' | 'demo-lokal';
  suggestion?: string;
}
