import { SIBI_URL, type BookDetail } from '@/lib/library/queries';

/** Atribusi wajib: tampil di setiap halaman buku. */
export function SourceNote({ book }: { book: Pick<BookDetail, 'title' | 'authors' | 'copyright_holder' | 'publisher' | 'year' | 'official_url' | 'license_note'> }) {
  const gov = /^Kementerian/i.test(book.copyright_holder ?? '');
  return (
    <aside className="notice t-body-sm" aria-label="Sumber buku">
      <strong>Sumber</strong>
      {book.title}{book.authors.length ? `, oleh ${book.authors.join(', ')}` : ''}{book.year ? ` (${book.year})` : ''}.
      {book.copyright_holder ? <> Hak cipta pada {book.copyright_holder}.</> : null}{' '}
      {book.official_url
        ? <>Versi resmi: <a href={book.official_url} rel="noopener noreferrer">{book.official_url.replace(/^https:\/\//, '')}</a>.</>
        : gov ? <>Versi resmi (PDF lengkap dengan gambar) tersedia di <a href={SIBI_URL} rel="noopener noreferrer">SIBI — Sistem Informasi Perbukuan Indonesia</a>.</> : null}
      {' '}Teks di RUPA EDU adalah hasil ekstraksi untuk memudahkan pencarian; gunakan buku resmi untuk kutipan.
    </aside>
  );
}
