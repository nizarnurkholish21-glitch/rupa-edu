import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCurrentUser, isStaff } from '@/lib/auth';
import {
  bookSubtitle, canReadBook, getBook, getChapters, getLabels, LICENSE_LABEL, searchBooks, STATUS_LABEL,
} from '@/lib/library/queries';
import { cleanQuery } from '@/lib/search';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await getBook((await params).slug);
  return { title: b ? b.title : 'Buku tidak ditemukan' };
}

export default async function BukuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();
  const q = cleanQuery((await searchParams).q);
  const [user, chapters, readable] = await Promise.all([getCurrentUser(), getChapters(book.id), canReadBook(book.id)]);
  const labels = readable ? await getLabels(book.id, chapters.map((c) => c.start_index)) : new Map<number, string | null>();
  const hits = readable && q ? await searchBooks(q, book.id, 30) : [];

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav aria-label="Jejak navigasi" className="t-body-sm muted"><Link href="/perpustakaan">Perpustakaan</Link> / {book.level ?? 'Buku'}</nav>
        <div style={{ display: 'grid', gap: 32, gridTemplateColumns: 'minmax(0, 1fr)', marginTop: 16 }}>
          <section className="prose">
            <p className="t-body-sm muted">{bookSubtitle(book)}</p>
            <h1 className="t-heading-1" style={{ marginTop: 8 }}>{book.title}</h1>
            {book.status !== 'siap' ? (
              <div className="notice" style={{ marginTop: 16 }}>
                <strong>Status: {STATUS_LABEL[book.status]}</strong>
                Buku ini belum terlihat oleh siswa dan guru sampai struktur bab dan metadatanya ditinjau.
                {isStaff(user) ? <> <Link href={`/admin/buku/${book.slug}`}>Tinjau sekarang</Link></> : null}
              </div>
            ) : null}
            <dl className="t-body-sm" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 16px', marginTop: 16 }}>
              <dt className="muted">Penulis</dt><dd style={{ margin: 0 }}>{book.authors.join(', ') || '—'}</dd>
              <dt className="muted">Penerbit</dt><dd style={{ margin: 0 }}>{book.publisher ?? book.copyright_holder ?? '—'}</dd>
              {book.isbn.length ? <><dt className="muted">ISBN</dt><dd style={{ margin: 0 }}>{book.isbn.join(', ')}</dd></> : null}
              <dt className="muted">Lisensi</dt><dd style={{ margin: 0 }}>{LICENSE_LABEL[book.license_kind]}. {book.license_note}</dd>
              {book.official_url ? <><dt className="muted">Sumber resmi</dt><dd style={{ margin: 0 }}><a href={book.official_url} rel="noopener noreferrer">{book.official_url}</a></dd></> : null}
            </dl>
          </section>

          {readable ? (
            <section aria-labelledby="judul-cari-buku" style={{ maxWidth: '72ch' }}>
              <h2 id="judul-cari-buku" className="t-heading-2">Cari di buku ini</h2>
              <form action={`/perpustakaan/${book.slug}`} method="get" role="search" className="search-form" style={{ marginTop: 12 }}>
                <label htmlFor="cari-buku" className="sr-only">Cari di buku ini</label>
                <input id="cari-buku" name="q" type="search" defaultValue={q} placeholder="mis. arsiran, proyeksi, makrame" maxLength={200} />
                <button type="submit">Cari</button>
              </form>
              {q ? (
                hits.length === 0 ? (
                  <p className="muted" style={{ marginTop: 16 }}>Tidak ditemukan &ldquo;{q}&rdquo; di buku ini. Coba kata lain.</p>
                ) : (
                  <ol className="results" style={{ marginTop: 16 }}>
                    {hits.map((h, i) => (
                      <li key={i} className="result">
                        <h3 className="t-title"><Link href={`/perpustakaan/${book.slug}/${h.page_index + 1}?q=${encodeURIComponent(q)}`}>
                          {h.printed_label ? `Halaman ${h.printed_label}` : `Halaman berkas ${h.page_index + 1}`}
                          {h.label_confidence === 'disimpulkan' ? ' (perkiraan)' : ''}
                        </Link></h3>
                        <p style={{ marginTop: 4 }}>{h.snippet.split(/«|»/).map((part, j) => (j % 2 === 1 ? <mark key={j}>{part}</mark> : <span key={j}>{part}</span>))}</p>
                      </li>
                    ))}
                  </ol>
                )
              ) : null}
            </section>
          ) : (
            <div className="notice" style={{ maxWidth: '68ch' }}>
              <strong>Isi buku tidak ditampilkan untuk umum.</strong>
              {user ? 'Sekolah Anda belum diberi akses ke buku ini. Hubungi admin sekolah.' : <>Siswa dan guru dapat <Link href={`/masuk?lanjut=/perpustakaan/${book.slug}`}>masuk</Link> dengan akun sekolah untuk membacanya.</>}
              {book.official_url ? <> Versi resmi tersedia di <a href={book.official_url} rel="noopener noreferrer">sumber penerbit</a>.</> : null}
            </div>
          )}

          <section aria-labelledby="judul-daftar-bab" style={{ maxWidth: '72ch' }}>
            <h2 id="judul-daftar-bab" className="t-heading-2">Daftar isi</h2>
            {chapters.length === 0 ? <p className="muted" style={{ marginTop: 8 }}>Struktur bab belum tersedia.</p> : (
              <ol style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 8 }}>
                {chapters.map((c) => {
                  const label = labels.get(c.start_index);
                  const name = c.kind === 'bagian' ? c.title : `${c.kind === 'unit' ? 'Unit' : 'Bab'} ${c.ordinal} · ${c.title}`;
                  return (
                    <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                      {readable ? <Link href={`/perpustakaan/${book.slug}/${c.start_index + 1}`}>{name}</Link> : <span>{name}</span>}
                      {label ? <span className="muted t-body-sm">hlm. {label}</span> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
