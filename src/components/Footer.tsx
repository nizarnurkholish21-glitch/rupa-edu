import Link from 'next/link';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <nav aria-label="Tautan kaki">
          <Link href="/cakupan">Cakupan &amp; sumber</Link>
          <Link href="/privasi">Privasi</Link>
          <Link href="/status">Status layanan</Link>
        </nav>
        <p>RUPA EDU — Belajar. Menemukan. Berkarya. Berbagi.</p>
        <p>Versi pengembangan (Tahap 1). Konten berlabel <strong>Demo</strong> adalah contoh dan belum ditinjau ahli.</p>
      </div>
    </footer>
  );
}
