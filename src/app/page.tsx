import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SearchForm } from '@/components/SearchForm';
import { POPULAR_TOPICS } from '@/lib/search';

export default function Beranda() {
  return (
    <>
      <Header showSearch={false} />
      <main id="konten">
        <section className="container" style={{ paddingTop: 64, paddingBottom: 48 }} aria-labelledby="judul-beranda">
          <div style={{ maxWidth: 760 }}>
            <h1 id="judul-beranda" className="t-display">Belajar. Menemukan. Berkarya.</h1>
            <p className="t-body muted" style={{ marginTop: 16, maxWidth: '60ch' }}>
              Tanyakan apa saja dengan bahasa sehari-hari. Setiap jawaban menyebut sumbernya, dan kamu tidak perlu login untuk mencari.
            </p>
            <div style={{ marginTop: 32 }}>
              <SearchForm hero />
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Topik yang sering dicari">
              {POPULAR_TOPICS.map((t) => (
                <Link key={t} href={`/cari?q=${encodeURIComponent(t)}`} className="chip">{t}</Link>
              ))}
            </div>
          </div>
        </section>

        <section className="container" aria-labelledby="judul-tiga-pintu" style={{ paddingBottom: 32 }}>
          <h2 id="judul-tiga-pintu" className="t-heading-2" style={{ marginBottom: 24 }}>Mulai dari mana?</h2>
          <div className="grid-3">
            <article className="card">
              <h3 className="t-title">Cari sesuatu</h3>
              <p className="t-body-sm muted" style={{ marginTop: 8 }}>Konsep, teknik, tokoh, dan sejarah, lengkap dengan sumber dan lisensinya.</p>
              <p style={{ marginTop: 16 }}><Link href="/cari?q=warna">Coba cari &ldquo;warna&rdquo;</Link></p>
            </article>
            <article className="card">
              <h3 className="t-title">Lanjutkan belajar</h3>
              <p className="t-body-sm muted" style={{ marginTop: 8 }}>Siswa dan guru masuk dengan akun dari sekolah untuk membuka kelas, materi, dan tugas.</p>
              <p style={{ marginTop: 16 }}><Link href="/masuk">Masuk ke ruang belajar</Link></p>
            </article>
            <article className="card">
              <h3 className="t-title">Mulai berkarya</h3>
              <p className="t-body-sm muted" style={{ marginTop: 8 }}>Studio, laboratorium seni, dan portofolio sedang dibangun (Fase 4).</p>
              <p style={{ marginTop: 16 }}><Link href="/cakupan#rencana">Lihat rencana</Link></p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
