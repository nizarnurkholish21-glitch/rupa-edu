import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotConfigured } from '@/components/NotConfigured';
import { ChapterHits } from '@/components/library/ChapterHits';
import { GroupedHits } from '@/components/library/GroupedHits';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { bookSubtitle, LEVELS, listBooks, searchBooks, searchChapters, STATUS_LABEL } from '@/lib/library/queries';
import { cleanQuery } from '@/lib/search';

export const metadata: Metadata = { title: 'Perpustakaan' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ jenjang?: string; q?: string }> };

export default async function PerpustakaanPage({ searchParams }: Props) {
  const sp = await searchParams;
  const jenjang = (LEVELS as readonly string[]).includes(sp.jenjang ?? '') ? sp.jenjang : undefined;
  const q = cleanQuery(sp.q);
  const configured = Boolean(supabaseConfig());
  const [user, books, chapterHits, hits] = configured
    ? await Promise.all([
      getCurrentUser(), listBooks({ level: jenjang }),
      q ? searchChapters(q) : Promise.resolve([]),
      q ? searchBooks(q, { level: jenjang, limit: 100 }) : Promise.resolve([]),
    ])
    : [null, [], [], []];
  const staff = isStaff(user);
  const levelQs = (l?: string) => { const p = new URLSearchParams(); if (l) p.set('jenjang', l); if (q) p.set('q', q); const s = p.toString(); return `/perpustakaan${s ? `?${s}` : ''}`; };

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <h1 className="t-heading-1">Perpustakaan</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: '64ch' }}>
              Buku pelajaran dan panduan guru Seni Rupa. Cari kata apa pun; hasilnya dikelompokkan per buku dan per bab, lengkap dengan halaman dan sumbernya.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" href="/perpustakaan/bab">Jelajah bab</Link>
            {staff ? <Link className="btn btn-primary" href="/admin/buku">Kelola buku</Link> : null}
          </div>
        </div>
        {!configured ? <NotConfigured what="Perpustakaan" /> : (
          <>
            <form action="/perpustakaan" method="get" role="search" className="search-form" style={{ marginTop: 24, maxWidth: 720 }}>
              <label htmlFor="cari-perpustakaan" className="sr-only">Cari di semua buku</label>
              <input id="cari-perpustakaan" name="q" type="search" defaultValue={q} placeholder="Cari di semua buku, mis. makrame, perspektif, warna komplementer" maxLength={200} />
              {jenjang ? <input type="hidden" name="jenjang" value={jenjang} /> : null}
              <button type="submit">Cari</button>
            </form>
            <nav aria-label="Saring jenjang" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <Link className="chip" href={levelQs()} aria-current={!jenjang ? 'page' : undefined}>Semua jenjang</Link>
              {LEVELS.map((l) => (
                <Link key={l} className="chip" href={levelQs(l)} aria-current={jenjang === l ? 'page' : undefined}>{l}</Link>
              ))}
            </nav>

            {q ? (
              <div style={{ marginTop: 32, display: 'grid', gap: 32, maxWidth: '80ch' }}>
                {chapterHits.length > 0 ? (
                  <section aria-labelledby="judul-bab-cocok">
                    <h2 id="judul-bab-cocok" className="t-heading-2">Bab yang membahas &ldquo;{q}&rdquo;</h2>
                    <div style={{ marginTop: 12 }}><ChapterHits chapters={chapterHits} /></div>
                  </section>
                ) : null}
                <section aria-labelledby="judul-isi-cocok">
                  <h2 id="judul-isi-cocok" className="t-heading-2">Di dalam isi buku</h2>
                  {hits.length === 0 ? (
                    <p className="muted" style={{ marginTop: 8 }}>Tidak ditemukan &ldquo;{q}&rdquo;{jenjang ? ` di jenjang ${jenjang}` : ''}. Coba kata yang lebih umum.</p>
                  ) : (
                    <>
                      <p className="t-body-sm muted" style={{ marginTop: 4, marginBottom: 16 }}>{hits.length} halaman cocok di {new Set(hits.map((h) => h.book_slug)).size} buku.</p>
                      <GroupedHits hits={hits} query={q} />
                    </>
                  )}
                </section>
              </div>
            ) : books.length === 0 ? (
              <div className="notice" style={{ marginTop: 24, maxWidth: '68ch' }}>
                <strong>Belum ada buku yang dapat ditampilkan.</strong>
                {staff ? 'Unggah buku di Kelola buku, lalu tandai siap setelah ditinjau.' : 'Buku akan muncul di sini setelah diterbitkan.'}
              </div>
            ) : (
              <ul className="grid-3" style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
                {books.map((b) => (
                  <li key={b.id} className="card">
                    <p className="t-body-sm muted">{bookSubtitle(b)}</p>
                    <h2 className="t-title" style={{ marginTop: 4 }}><Link href={`/perpustakaan/${b.slug}`}>{b.title}</Link></h2>
                    <p className="t-body-sm muted" style={{ marginTop: 8 }}>{b.authors.join(', ') || '—'} · {b.page_count} halaman</p>
                    {b.status !== 'siap' ? <p style={{ marginTop: 8 }}><span className="badge badge-off">{STATUS_LABEL[b.status]}</span></p> : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
