import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotConfigured } from '@/components/NotConfigured';
import { supabaseConfig } from '@/lib/config';
import { BOOK_TYPE_LABEL, browseChapters, chapterLabel, LEVELS, ROMAN } from '@/lib/library/queries';

export const metadata: Metadata = { title: 'Jelajah bab' };
export const dynamic = 'force-dynamic';

const GRADES: Record<string, number[]> = { 'SD/MI': [1, 2, 3, 4, 5, 6], 'SMP/MTs': [7, 8, 9], 'SMA/MA': [10, 11, 12], 'SMK/MAK': [10, 11, 12] };
type Props = { searchParams: Promise<{ jenjang?: string; kelas?: string }> };

export default async function JelajahBabPage({ searchParams }: Props) {
  const sp = await searchParams;
  const jenjang = (LEVELS as readonly string[]).includes(sp.jenjang ?? '') ? sp.jenjang : undefined;
  const kelas = jenjang && GRADES[jenjang]!.includes(Number(sp.kelas)) ? Number(sp.kelas) : undefined;
  const books = supabaseConfig() ? await browseChapters({ level: jenjang, grade: kelas }) : [];
  // Kelompokkan: jenjang → kelas → buku.
  const tree = new Map<string, Map<number, typeof books>>();
  for (const b of books) {
    const l = b.level ?? 'Lainnya';
    if (!tree.has(l)) tree.set(l, new Map());
    const g = tree.get(l)!;
    const k = b.grade ?? 0;
    g.set(k, [...(g.get(k) ?? []), b]);
  }
  const totalChapters = books.reduce((n, b) => n + b.chapters.filter((c) => c.kind !== 'bagian').length, 0);

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav className="t-body-sm muted" aria-label="Jejak navigasi"><Link href="/perpustakaan">Perpustakaan</Link> / Jelajah bab</nav>
        <h1 className="t-heading-1" style={{ marginTop: 8 }}>Jelajah bab</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: '64ch' }}>Semua bab dari semua buku, disusun per jenjang dan kelas. Klik bab untuk langsung membuka halaman awalnya.</p>
        {!supabaseConfig() ? <NotConfigured what="Perpustakaan" /> : (
          <>
            <nav aria-label="Saring jenjang" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
              <Link className="chip" href="/perpustakaan/bab" aria-current={!jenjang ? 'page' : undefined}>Semua jenjang</Link>
              {LEVELS.map((l) => <Link key={l} className="chip" href={`/perpustakaan/bab?jenjang=${encodeURIComponent(l)}`} aria-current={jenjang === l && !kelas ? 'page' : undefined}>{l}</Link>)}
            </nav>
            {jenjang ? (
              <nav aria-label="Saring kelas" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {GRADES[jenjang]!.map((g) => <Link key={g} className="chip" href={`/perpustakaan/bab?jenjang=${encodeURIComponent(jenjang)}&kelas=${g}`} aria-current={kelas === g ? 'page' : undefined}>Kelas {ROMAN[g]}</Link>)}
              </nav>
            ) : null}
            <p className="t-body-sm muted" style={{ marginTop: 16 }}>{books.length} buku · {totalChapters} bab</p>
            {books.length === 0 ? <p className="muted" style={{ marginTop: 16 }}>Belum ada buku terbit untuk pilihan ini.</p> : null}
            <div style={{ display: 'grid', gap: 32, marginTop: 16 }}>
              {[...tree.entries()].map(([level, grades]) => (
                <section key={level} aria-labelledby={`jenjang-${level}`}>
                  <h2 id={`jenjang-${level}`} className="t-heading-2">{level}</h2>
                  {[...grades.entries()].map(([grade, list]) => (
                    <div key={grade} style={{ marginTop: 16 }}>
                      {grade ? <h3 className="t-title">Kelas {ROMAN[grade]}</h3> : null}
                      <div className="grid-3" style={{ marginTop: 8 }}>
                        {list.map((b) => (
                          <article key={b.id} className="card">
                            <p className="t-body-sm muted">{BOOK_TYPE_LABEL[b.book_type]}{b.semester ? ` · Semester ${b.semester}` : ''}</p>
                            <h4 className="t-body" style={{ fontWeight: 600, marginTop: 2 }}><Link href={`/perpustakaan/${b.slug}`}>{b.title}</Link></h4>
                            <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 4 }} className="t-body-sm">
                              {b.chapters.filter((c) => c.kind !== 'bagian').map((c) => (
                                <li key={c.id}><Link href={`/perpustakaan/${b.slug}/${c.start_index + 1}`}>{chapterLabel(c.kind, c.ordinal, c.title)}</Link></li>
                              ))}
                              {b.chapters.filter((c) => c.kind !== 'bagian').length === 0 ? <li className="muted">Struktur bab belum diisi.</li> : null}
                            </ol>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
