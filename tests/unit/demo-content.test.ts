import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import items from '../../src/content/demo-items.json';

describe('konten demo', () => {
  it('setiap item punya slug valid, ringkasan, jenis, dan topik', () => {
    const kinds = ['konsep', 'sejarah', 'tokoh', 'karya', 'teknik', 'panduan'];
    for (const i of items) {
      expect(i.slug).toMatch(/^[a-z0-9-]{2,120}$/);
      expect(i.summary.length).toBeGreaterThanOrEqual(10);
      expect(i.summary.length).toBeLessThanOrEqual(600);
      expect(kinds).toContain(i.kind);
      expect(i.topics.length).toBeGreaterThan(0);
    }
  });
  it('slug unik', () => {
    expect(new Set(items.map((i) => i.slug)).size).toBe(items.length);
  });
  it('seed.sql sinkron dengan demo-items.json dan menandai semua sebagai demo', () => {
    const sql = readFileSync('supabase/seed.sql', 'utf8');
    for (const i of items) expect(sql).toContain(`'${i.slug}'`);
    expect(sql).toContain('is_demo = true');
  });
});
