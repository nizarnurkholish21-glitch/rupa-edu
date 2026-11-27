import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DemoBadge } from '@/components/DemoBadge';
import { getPublicItem, relatedItems } from '@/lib/search';
import { KIND_LABEL } from '@/lib/search/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await getPublicItem((await params).slug);
  return item ? { title: item.title, description: item.summary } : { title: 'Tidak ditemukan' };
}

export default async function PengetahuanPage({ params }: Props) {
  const item = await getPublicItem((await params).slug);
  if (!item) notFound();
  const related = relatedItems(item);

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav aria-label="Jejak navigasi" className="t-body-sm muted"><Link href="/">Beranda</Link> / <Link href={`/cari?q=${encodeURIComponent(item.topics[0] ?? item.title)}`}>{item.topics[0] ?? 'Cari'}</Link></nav>
        <article className="prose" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-kind">{KIND_LABEL[item.kind]}</span>
            {item.is_demo ? <DemoBadge /> : null}
            {item.min_grade ? <span className="badge badge-kind">Mulai kelas {item.min_grade}</span> : null}
          </div>
          <h1 className="t-heading-1" style={{ marginTop: 16 }}>{item.title}</h1>
          <p className="t-title" style={{ marginTop: 16, fontWeight: 400 }}>{item.summary}</p>
          {item.body ? <p style={{ marginTop: 16 }}>{item.body}</p> : null}

          {item.is_demo ? (
            <div className="notice" style={{ marginTop: 24 }}>
              <strong>Ini konten demo.</strong>
              Ditulis tim RUPA EDU sebagai contoh dan belum ditinjau guru atau ahli. Jangan dikutip sebagai sumber.
            </div>
          ) : null}

          <section aria-labelledby="judul-sumber" style={{ marginTop: 24 }}>
            <h2 id="judul-sumber" className="t-title">Sumber dan lisensi</h2>
            <dl className="t-body-sm" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', marginTop: 8 }}>
              <dt className="muted">Sumber</dt>
              <dd style={{ margin: 0 }}>{item.source_url ? <a href={item.source_url} rel="noopener noreferrer">{item.source_name}</a> : item.source_name}</dd>
              <dt className="muted">Lisensi</dt>
              <dd style={{ margin: 0 }}>{item.license}</dd>
              <dt className="muted">Topik</dt>
              <dd style={{ margin: 0 }}>{item.topics.join(', ')}</dd>
            </dl>
          </section>

          {related.length > 0 ? (
            <section aria-labelledby="judul-terkait" style={{ marginTop: 32 }}>
              <h2 id="judul-terkait" className="t-title">Jelajahi juga</h2>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                {related.map((r) => <li key={r.slug}><Link href={`/pengetahuan/${r.slug}`}>{r.title}</Link></li>)}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
      <Footer />
    </>
  );
}
