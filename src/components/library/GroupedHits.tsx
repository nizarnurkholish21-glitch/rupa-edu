import Link from 'next/link';
import { groupHits, ROMAN, type BookHit } from '@/lib/library/queries';
import { Snippet } from './Snippet';

/** Hasil pencarian isi buku, dikelompokkan Buku → Bab → halaman. */
export function GroupedHits({ hits, query, showBook = true, maxPerChapter = 3 }: { hits: BookHit[]; query: string; showBook?: boolean; maxPerChapter?: number }) {
  const groups = groupHits(hits);
  const qs = `?q=${encodeURIComponent(query)}`;
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {groups.map((g) => (
        <section key={g.bookSlug} aria-label={g.bookTitle}>
          {showBook ? (
            <h3 className="t-title">
              <Link href={`/perpustakaan/${g.bookSlug}${qs}`}>{g.bookTitle}</Link>
              {g.level ? <span className="t-body-sm muted"> · {g.level}{g.grade ? ` Kelas ${ROMAN[g.grade]}` : ''}</span> : null}
            </h3>
          ) : null}
          <div style={{ display: 'grid', gap: 12, marginTop: showBook ? 8 : 0 }}>
            {g.chapters.map((c) => (
              <details key={c.key} open style={{ borderLeft: '2px solid var(--line)', paddingLeft: 12 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  {c.label} <span className="t-body-sm muted">({c.hits.length} halaman)</span>
                </summary>
                <ol style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 10 }}>
                  {c.hits.slice(0, maxPerChapter).map((h) => (
                    <li key={`${h.page_index}`}>
                      <Link href={`/perpustakaan/${h.book_slug}/${h.page_index + 1}${qs}`} className="t-body-sm" style={{ fontWeight: 600 }}>
                        {h.printed_label ? `Halaman ${h.printed_label}` : `Halaman berkas ${h.page_index + 1}`}
                        {h.label_confidence === 'disimpulkan' ? ' (perkiraan)' : ''}
                      </Link>
                      <p className="t-body-sm" style={{ marginTop: 2 }}><Snippet text={h.snippet} /></p>
                    </li>
                  ))}
                  {c.hits.length > maxPerChapter ? (
                    <li className="t-body-sm muted">+{c.hits.length - maxPerChapter} halaman lain di bab ini — <Link href={`/perpustakaan/${g.bookSlug}${qs}`}>lihat semua</Link></li>
                  ) : null}
                </ol>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
