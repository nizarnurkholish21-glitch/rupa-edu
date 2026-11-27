import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotConfigured } from '@/components/NotConfigured';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { bookSubtitle, LEVELS, listBooks, STATUS_LABEL } from '@/lib/library/queries';

export const metadata: Metadata = { title: 'Perpustakaan' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ jenjang?: string }> };

export default async function PerpustakaanPage({ searchParams }: Props) {
  const { jenjang } = await searchParams;
  const configured = Boolean(supabaseConfig());
  const [user, books] = configured ? await Promise.all([getCurrentUser(), listBooks({ level: jenjang })]) : [null, []];
  const staff = isStaff(user);
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <h1 className="t-heading-1">Perpustakaan</h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: '64ch' }}>
              Buku pelajaran dan panduan guru. Isi buku hanya dapat dibaca oleh siswa dan guru di sekolah yang diberi akses;
              pengunjung umum melihat keterangan buku dan tautan ke sumber resminya.
            </p>
          </div>
          {staff ? <Link className="btn btn-primary" href="/admin/buku">Kelola buku</Link> : null}
        </div>
        {!configured ? <NotConfigured what="Perpustakaan" /> : (
          <>
            <nav aria-label="Saring jenjang" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
              <Link className="chip" href="/perpustakaan" aria-current={!jenjang ? 'page' : undefined}>Semua</Link>
              {LEVELS.map((l) => (
                <Link key={l} className="chip" href={`/perpustakaan?jenjang=${encodeURIComponent(l)}`} aria-current={jenjang === l ? 'page' : undefined}>{l}</Link>
              ))}
            </nav>
            {books.length === 0 ? (
              <div className="notice" style={{ marginTop: 24, maxWidth: '68ch' }}>
                <strong>Belum ada buku yang dapat ditampilkan.</strong>
                {user ? 'Bila sekolah Anda sudah memiliki buku, minta admin sekolah memberi akses.' : 'Masuk dengan akun sekolah untuk melihat buku sekolah Anda.'}
              </div>
            ) : (
              <ul className="grid-3" style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
                {books.map((b) => (
                  <li key={b.id} className="card">
                    <p className="t-body-sm muted">{bookSubtitle(b)}</p>
                    <h2 className="t-title" style={{ marginTop: 4 }}><Link href={`/perpustakaan/${b.slug}`}>{b.title}</Link></h2>
                    <p className="t-body-sm muted" style={{ marginTop: 8 }}>{b.authors.join(', ') || '—'} · {b.page_count} halaman</p>
                    {b.status !== 'siap' ? <p style={{ marginTop: 8 }}><span className="badge badge-off">{STATUS_LABEL[b.status]}</span></p> : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
