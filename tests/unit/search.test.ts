import { describe, expect, it } from 'vitest';
import items from '../../src/content/demo-items.json';
import { buildIndex, editDistance, normalize, searchLocal, stem } from '../../src/lib/search/local';
import type { KnowledgeItem } from '../../src/lib/search/types';

const DEMO = (items as Omit<KnowledgeItem, 'source_name' | 'source_url' | 'license' | 'is_demo'>[]).map((i) => ({
  ...i, min_grade: i.min_grade ?? null, source_name: 'demo', source_url: null, license: 'demo', is_demo: true,
}));
const index = buildIndex(DEMO);
const slugs = (q: string) => searchLocal(index, q).hits.map((h) => h.item.slug);

describe('normalisasi dan imbuhan', () => {
  it('menyamakan huruf besar, tanda baca, dan diakritik', () => {
    expect(normalize('  Warna   KOMPLEMENTER!? ')).toBe('warna komplementer');
    expect(normalize('Café')).toBe('cafe');
  });
  it('menghapus imbuhan umum Bahasa Indonesia', () => {
    expect(stem('menggambar')).toBe('gambar');
    expect(stem('pewarnaan')).toBe('warna');
    expect(stem('berulang')).toBe('ulang');
  });
  it('menghitung jarak salah ketik dengan batas', () => {
    expect(editDistance('komplementr', 'komplementer')).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 2)).toBe(3);
  });
});

describe('pencarian demo lokal', () => {
  it('menemukan judul yang tepat di urutan pertama', () => {
    expect(slugs('warna komplementer')[0]).toBe('warna-komplementer');
  });
  it('mentoleransi salah ketik dan memberi saran ejaan yang terbaca', () => {
    const r = searchLocal(index, 'warna komplementr');
    expect(r.hits[0]?.item.slug).toBe('warna-komplementer');
    expect(r.suggestion).toBe('warna komplementer');
  });
  it('mencocokkan kata berimbuhan dengan kata dasar', () => {
    expect(slugs('menggambar bangunan')).toContain('perspektif-dua-titik');
  });
  it('mengabaikan kata tanya umum', () => {
    expect(slugs('apa itu batik')[0]).toBe('batik-teknik-rintang-warna');
  });
  it('mengembalikan kosong untuk kueri kosong atau tanpa kecocokan', () => {
    expect(slugs('   ')).toEqual([]);
    expect(slugs('fotosintesis klorofil')).toEqual([]);
  });
  it('tidak pernah mengembalikan isi lengkap (body) di hasil', () => {
    const hit = searchLocal(index, 'batik').hits[0];
    expect(hit && 'body' in hit.item).toBe(false);
  });
  it('menyertakan alasan relevansi', () => {
    const hit = searchLocal(index, 'tipografi').hits[0];
    expect(hit?.matched).toContain('tipografi');
  });
});

describe('pencarian beberapa kata', () => {
  it('bila ada artikel yang memuat semua kata, hanya artikel itu yang ditampilkan', () => {
    expect(slugs('warna komplementr')).toEqual(['warna-komplementer']);
  });
  it('bila tidak ada yang memuat semua kata, tetap menampilkan yang cocok sebagian', () => {
    expect(slugs('batik fotosintesis')).toContain('batik-teknik-rintang-warna');
  });
});
