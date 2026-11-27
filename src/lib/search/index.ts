// Satu pintu pencarian publik. Memakai database Supabase bila terhubung,
// selain itu koleksi demo lokal. Hasil selalu menyebut asalnya.
import 'server-only';
import demoItems from '@/content/demo-items.json';
import { supabaseConfig } from '@/lib/config';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildIndex, searchLocal, normalize } from './local';
import type { KnowledgeItem, SearchResult } from './types';

const DEMO: KnowledgeItem[] = (demoItems as Omit<KnowledgeItem, 'source_name' | 'source_url' | 'license' | 'is_demo'>[]).map((i) => ({
  ...i,
  min_grade: i.min_grade ?? null,
  source_name: 'RUPA EDU (konten demo)',
  source_url: null,
  license: 'Konten demo RUPA EDU, belum ditinjau ahli',
  is_demo: true,
}));
const DEMO_INDEX = buildIndex(DEMO);

export const MAX_QUERY_LENGTH = 200;

export function cleanQuery(q: unknown): string {
  if (typeof q !== 'string') return '';
  return q.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

export async function searchPublic(rawQuery: string): Promise<SearchResult> {
  const query = cleanQuery(rawQuery);
  if (!normalize(query)) return { query, hits: [], backend: supabaseConfig() ? 'database' : 'demo-lokal' };

  if (supabaseConfig()) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc('search_public_items', { p_query: query, p_limit: 20 });
    if (!error && data) {
      const local = searchLocal(DEMO_INDEX, query); // hanya untuk saran ejaan
      return {
        query,
        backend: 'database',
        suggestion: data.length === 0 ? local.suggestion : undefined,
        hits: (data as Array<Omit<KnowledgeItem, 'body' | 'min_grade'>>).map((row) => ({
          item: { ...row, min_grade: null },
          matched: row.topics.filter((t) => normalize(query).split(' ').some((w) => normalize(t).includes(w))),
        })),
      };
    }
    // Jika database bermasalah, jangan diam-diam pura-pura: catat dan jatuh ke demo dengan label jelas.
    console.error('[search] RPC gagal, memakai koleksi demo lokal:', error?.message);
  }
  const { hits, suggestion } = searchLocal(DEMO_INDEX, query);
  return { query, hits, suggestion, backend: 'demo-lokal' };
}

export async function getPublicItem(slug: string): Promise<KnowledgeItem | null> {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  if (supabaseConfig()) {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from('public_items')
      .select('slug,title,summary,body,kind,topics,min_grade,source_name,source_url,license,is_demo')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (data) return data as KnowledgeItem;
  }
  return DEMO.find((i) => i.slug === slug) ?? null;
}

export function relatedItems(item: KnowledgeItem, limit = 3): KnowledgeItem[] {
  const topics = new Set(item.topics);
  return DEMO.filter((d) => d.slug !== item.slug)
    .map((d) => ({ d, n: d.topics.filter((t) => topics.has(t)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => x.d);
}

export const POPULAR_TOPICS = ['warna komplementer', 'perspektif', 'batik', 'tipografi', 'komposisi', 'unsur seni rupa'];
