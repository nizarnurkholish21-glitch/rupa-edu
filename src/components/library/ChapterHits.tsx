import Link from 'next/link';
import { chapterLabel, ROMAN, type ChapterHit } from '@/lib/library/queries';

/** Bab yang judulnya cocok dengan kueri. */
export function ChapterHits({ chapters }: { chapters: ChapterHit[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
      {chapters.map((c) => (
        <li key={c.chapter_id} className="card" style={{ padding: 12 }}>
          <Link href={`/perpustakaan/${c.book_slug}/${c.start_index + 1}`} style={{ fontWeight: 600 }}>{chapterLabel(c.chapter_kind, c.chapter_ordinal, c.chapter_title)}</Link>
          <p className="t-body-sm muted" style={{ marginTop: 2 }}>
            {c.book_title}{c.book_level ? ` · ${c.book_level}${c.book_grade ? ` Kelas ${ROMAN[c.book_grade]}` : ''}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
