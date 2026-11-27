import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <h1 className="t-heading-1">Halaman tidak ditemukan</h1>
        <p className="muted" style={{ marginTop: 8 }}>Tautannya mungkin salah atau halamannya sudah dipindahkan. Coba cari topiknya.</p>
        <p style={{ marginTop: 24 }}><Link className="btn btn-primary" href="/">Ke beranda</Link></p>
      </main>
      <Footer />
    </>
  );
}
