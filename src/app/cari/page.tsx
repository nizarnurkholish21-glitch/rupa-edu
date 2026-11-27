import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/DemoBadge';
import { cleanQuery, POPULAR_TOPICS, searchPublic } from '@/lib/search';
import { KIND_LABEL } from '@/lib/search/types';
import { bookSubtitle, searchBookMetadata, searchBooks } from '@/lib/library/queries';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = cleanQuery((await searchParams).q);
  return { title: q ? `Hasil untuk “${q}”` : 'Cari', robots: { index: false } };
}

export default async function CariPage({ searchParams }: Props) {
  const q = cleanQuery((await searchParams).q);
  const result = q ? await searchPublic(q) : null;
  // Buku: hasil isi hanya untuk pengguna yang berhak (RLS); pengunjung melihat kartu keterangan buku saja.
  const [bookHits, bookCards] = q ? await Promise.all([searchBooks(q, undefined, 8), searchBookMetadata(q)]) : [[], []];

  return (
    <>
      <Header query={q} />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        {!result ? (
          <section className="stack prose">
            <h1 className="t-heading-1">Cari pengetahuan</h1>
            <p className="muted">Ketik topik di kotak pencarian, atau mulai dari salah satu topik ini:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_TOPICS.map((t) => <Link key={t} className="chip" href={`/cari?q=${encodeURIComponent(t)}`}>{t}</Link>)}
            </div>
          </section>
        ) : (
          <section aria-labelledby="judul-hasil">
            <h1 id="judul-hasil" className="t-heading-2">
              {result.hits.length > 0 ? `${result.hits.length} hasil untuk “${result.query}”` : `Belum ada hasil untuk “${result.query}”`}
            </h1>
            <p className="t-body-sm muted" style={{ marginTop: 8 }}>
              {result.backend === 'demo-lokal'
                ? 'Sumber: koleksi demo RUPA EDU (12 artikel contoh). Database dan sumber eksternal belum dihubungkan.'
                : 'Sumber: koleksi RUPA EDU. Sumber eksternal (perpustakaan, jurnal, museum) menyusul di Fase 6.'}{' '}
              <Link href="/cakupan">Tentang cakupan</Link>
            </p>

            {result.suggestion ? (
              <p style={{ marginTop: 16 }}>
                Mungkin maksud Anda: <Link href={`/cari?q=${encodeURIComponent(result.suggestion)}`}><strong>{result.suggestion}</strong></Link>
                {result.hits.length > 0 ? ' (hasil di bawah sudah memakai ejaan ini)' : ''}
              </p>
            ) : null}

            {bookHits.length > 0 ? (
              <section aria-labelledby="judul-hasil-buku" style={{ marginTop: 24, maxWidth: '72ch' }}>
                <h2 id="judul-hasil-buku" className="t-heading-2">Di buku sekolah Anda</h2>
                <ol className="results" style={{ marginTop: 12 }}>
                  {bookHits.map((h, i) => (
                    <li key={i} className="result">
                      <h3 className="t-title"><Link href={`/perpustakaan/${h.book_slug}/${h.page_index + 1}?q=${encodeURIComponent(result.query)}`}>{h.book_title}</Link></h3>
                      <p className="t-body-sm muted">{h.printed_label ? `Halaman ${h.printed_label}${h.label_confidence === 'disimpulkan' ? ' (perkiraan)' : ''}` : `Halaman berkas ${h.page_index + 1}`}</p>
                      <p style={{ marginTop: 4 }}>{h.snippet.split(/«|»/).map((part, j) => (j % 2 === 1 ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>))}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {bookHits.length === 0 && bookCards.length > 0 ? (
              <section aria-labelledby="judul-kartu-buku" style={{ marginTop: 24, maxWidth: '72ch' }}>
                <h2 id="judul-kartu-buku" className="t-heading-2">Buku terkait di perpustakaan</h2>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 12 }}>
                  {bookCards.map((b) => (
                    <li key={b.id} className="card">
                      <p className="t-body-sm muted">{bookSubtitle(b)}</p>
                      <h3 className="t-title"><Link href={`/perpustakaan/${b.slug}`}>{b.title}</Link></h3>
                      <p className="t-body-sm muted" style={{ marginTop: 4 }}>Isi buku hanya untuk siswa dan guru di sekolah yang diberi akses.</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.hits.length === 0 ? (
              <div className="notice" style={{ marginTop: 24, maxWidth: '68ch' }}>
                <strong>Belum ditemukan sumber yang cocok.</strong>
                Koleksi saat ini masih kecil dan berfokus pada seni rupa dan desain. Coba kata yang lebih umum, periksa ejaan, atau pilih topik berikut.
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {POPULAR_TOPICS.map((t) => <Link key={t} className="chip" href={`/cari?q=${encodeURIComponent(t)}`}>{t}</Link>)}
                </div>
              </div>
            ) : (
              <ol className="results" style={{ marginTop: 24, maxWidth: '72ch' }}>
                {result.hits.map(({ item, matched }) => (
                  <li key={item.slug} className="result">
                    <h2 className="t-title"><Link href={`/pengetahuan/${item.slug}`}>{item.title}</Link></h2>
                    <div className="meta">
                      <span className="badge badge-kind">{KIND_LABEL[item.kind]}</span>
                      {item.is_demo ? <DemoBadge /> : null}
                      <span className="t-body-sm muted">{item.source_name}</span>
                    </div>
                    <p style={{ marginTop: 8 }}>{item.summary}</p>
                    {matched.length > 0 ? (
                      <p className="t-body-sm muted" style={{ marginTop: 4 }}>Cocok dengan: {matched.slice(0, 4).join(', ')}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
