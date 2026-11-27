import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotConfigured } from '@/components/NotConfigured';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';
import { bookSubtitle, STATUS_LABEL } from '@/lib/library/queries';

export const metadata: Metadata = { title: 'Kelola buku', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminBukuPage() {
  if (!supabaseConfig()) return (<><Header /><main id="konten" className="container" style={{ paddingTop: 48 }}><h1 className="t-heading-1">Kelola buku</h1><NotConfigured what="Pengelolaan buku" /></main><Footer /></>);
  const user = await getCurrentUser();
  if (!user) redirect('/masuk?lanjut=/admin/buku');
  if (!isStaff(user)) redirect('/perpustakaan');
  const db = await createServerSupabase();
  const { data: books } = await db.from('books')
    .select('id,slug,title,book_type,level,grade,semester,year,status,page_count,label_coverage,warnings,book_chapters(count)')
    .order('status').order('level').order('grade');
  const { data: verified } = await db.from('book_chapters').select('book_id').eq('auto_verified', true);
  const verifiedCount = new Map<string, number>();
  for (const r of verified ?? []) verifiedCount.set(r.book_id as string, (verifiedCount.get(r.book_id as string) ?? 0) + 1);

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
          <div>
            <h1 className="t-heading-1">Kelola buku</h1>
            <p className="muted" style={{ marginTop: 8 }}>Buku baru berstatus &ldquo;Perlu tinjauan&rdquo; dan belum terlihat siswa sampai Anda memeriksa bab dan metadatanya.</p>
          </div>
          <Link className="btn btn-primary" href="/admin/buku/unggah">Unggah buku</Link>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 24 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }} className="t-body-sm">
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line-strong)' }}>
                <th style={{ padding: 8 }}>Buku</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8 }}>Halaman</th>
                <th style={{ padding: 8 }}>No. hlm cetak</th><th style={{ padding: 8 }}>Bab (cocok otomatis)</th><th style={{ padding: 8 }}>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(books ?? []).map((b) => {
                const chapters = (b.book_chapters as unknown as { count: number }[])[0]?.count ?? 0;
                return (
                  <tr key={b.id as string} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: 8 }}>
                      <Link href={`/admin/buku/${b.slug}`}><strong>{b.title as string}</strong></Link>
                      <div className="muted">{bookSubtitle(b as never)}</div>
                    </td>
                    <td style={{ padding: 8 }}><span className={b.status === 'siap' ? 'badge badge-ok' : 'badge badge-off'}>{STATUS_LABEL[b.status as string]}</span></td>
                    <td style={{ padding: 8 }}>{b.page_count as number}</td>
                    <td style={{ padding: 8 }}>{Math.round((b.label_coverage as number) * 100)}% terdeteksi</td>
                    <td style={{ padding: 8 }}>{chapters} ({verifiedCount.get(b.id as string) ?? 0} cocok)</td>
                    <td style={{ padding: 8 }}>{(b.warnings as string[]).length ? `${(b.warnings as string[]).length} peringatan` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(books ?? []).length === 0 ? <p className="muted" style={{ marginTop: 16 }}>Belum ada buku. Mulai dengan mengunggah buku.</p> : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
