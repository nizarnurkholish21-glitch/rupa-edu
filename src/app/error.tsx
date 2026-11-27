'use client';
import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="konten" className="container" style={{ paddingTop: 48 }}>
      <h1 className="t-heading-1">Terjadi kesalahan</h1>
      <p className="muted" style={{ marginTop: 8 }}>Maaf, halaman ini gagal dimuat. Data Anda tidak berubah.</p>
      <p style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={() => reset()}>Coba lagi</button>
        <Link className="btn btn-secondary" href="/">Ke beranda</Link>
      </p>
    </main>
  );
}
