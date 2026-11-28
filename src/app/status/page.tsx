import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { integrations } from '@/lib/config';

export const metadata: Metadata = { title: 'Status layanan', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function StatusPage() {
  const list = integrations();
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <h1 className="t-heading-1">Status layanan</h1>
        <p className="muted" style={{ marginTop: 8 }}>Hanya menampilkan apakah layanan terhubung. Kunci rahasia tidak pernah ditampilkan.</p>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 24, display: 'grid', gap: 12, maxWidth: '68ch' }}>
          {list.map((i) => (
            <li key={i.key} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <p className="t-title">{i.name}</p>
                <p className="t-body-sm muted">{i.purpose} · dipakai mulai {i.phase}</p>
              </div>
              {i.status === 'terhubung'
                ? <span className="badge badge-ok">Terhubung</span>
                : i.status === 'salah_konfigurasi'
                  ? <span className="badge badge-off" role="alert">Perlu diperbaiki: {i.note}</span>
                  : <span className="badge badge-off">Belum dikonfigurasi</span>}
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
