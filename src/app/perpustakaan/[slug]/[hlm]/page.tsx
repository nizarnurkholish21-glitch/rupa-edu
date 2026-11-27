import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCurrentUser } from '@/lib/auth';
import { canReadBook, citation, getBook, getChapters, getPage } from '@/lib/library/queries';
import { cleanQuery } from '@/lib/search';

type Props = { params: Promise<{ slug: string; hlm: string }>; searchParams: Promise<{ q?: string }> };

export const metadata: Metadata = { robots: { index: false } };

function highlight(text: string, q: string) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 3).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export default async function HalamanPage({ params, searchParams }: Props) {
  const { slug, hlm } = await params;
  const index = Number(hlm) - 1;
  if (!Number.isInteger(index) || index < 0) notFound();
  const book = await getBook(slug);
  if (!book) notFound();
  if (!(await canReadBook(book.id))) {
    const user = await getCurrentUser();
    if (!user) redirect(`/masuk?lanjut=${encodeURIComponent(`/perpustakaan/${slug}/${hlm}`)}`);
    redirect(`/perpustakaan/${slug}`);
  }
  const [page, chapters] = await Promise.all([getPage(book.id, index), getChapters(book.id)]);
  if (!page) notFound();
  const q = cleanQuery((await searchParams).q);
  const chapter = [...chapters].reverse().find((c) => c.start_index <= index);
  const approx = page.label_confidence !== 'terdeteksi';
  const cite = citation(book, page.printed_label, approx);
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const paragraphs = page.content.split(/\n{2,}/);

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav aria-label="Jejak navigasi" className="t-body-sm muted">
          <Link href="/perpustakaan">Perpustakaan</Link> / <Link href={`/perpustakaan/${slug}${qs}`}>{book.title}</Link>
          {chapter ? <> / {chapter.kind === 'bagian' ? chapter.title : `Bab ${chapter.ordinal}`}</> : null}
        </nav>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, marginTop: 16, maxWidth: '72ch' }}>
          <h1 className="t-heading-2">
            {page.printed_label ? `Halaman ${page.printed_label}` : `Halaman berkas ${index + 1}`}
            {page.printed_label && approx ? <span className="t-body-sm muted"> (nomor perkiraan)</span> : null}
          </h1>
          <span className="t-body-sm muted">Berkas {index + 1} dari {book.page_count}</span>
        </div>

        <article className="card prose" style={{ marginTop: 16, whiteSpace: 'pre-line', maxWidth: '72ch' }}>
          {paragraphs.map((p, i) => <p key={i} style={{ marginTop: i ? 12 : 0 }}>{q ? highlight(p, q) : p}</p>)}
        </article>
        <p className="t-body-sm muted" style={{ marginTop: 8, maxWidth: '72ch' }}>
          Teks hasil ekstraksi otomatis; gambar, tabel, dan tata letak asli tidak ditampilkan. Periksa buku aslinya untuk kutipan resmi.
        </p>

        <section aria-labelledby="judul-sitasi" style={{ marginTop: 16, maxWidth: '72ch' }}>
          <h2 id="judul-sitasi" className="t-body-sm" style={{ fontWeight: 600 }}>Kutip halaman ini</h2>
          <p className="t-body-sm" style={{ marginTop: 4 }}>{cite}</p>
        </section>

        <nav aria-label="Pindah halaman" style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {index > 0 ? <Link className="btn btn-secondary" href={`/perpustakaan/${slug}/${index}${qs}`} rel="prev">← Sebelumnya</Link> : null}
          {index + 1 < book.page_count ? <Link className="btn btn-secondary" href={`/perpustakaan/${slug}/${index + 2}${qs}`} rel="next">Berikutnya →</Link> : null}
        </nav>
      </main>
      <Footer />
    </>
  );
}
