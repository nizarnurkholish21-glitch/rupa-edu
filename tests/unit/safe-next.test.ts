import { describe, expect, it } from 'vitest';
import { safeNext } from '../../src/lib/safe-next';

describe('safeNext (pencegah open redirect)', () => {
  it('mengizinkan jalur internal', () => {
    expect(safeNext('/ruang')).toBe('/ruang');
    expect(safeNext('/pengetahuan/batik-teknik-rintang-warna')).toBe('/pengetahuan/batik-teknik-rintang-warna');
  });
  it.each(['https://jahat.example', '//jahat.example', '/\\jahat.example', 'javascript:alert(1)', '/a\r\nSet-Cookie: x', '', undefined, null])(
    'menolak %s', (v) => { expect(safeNext(v as string)).toBe('/ruang'); },
  );
});
