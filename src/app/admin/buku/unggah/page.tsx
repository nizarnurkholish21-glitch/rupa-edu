import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NotConfigured } from '@/components/NotConfigured';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { UploadForm } from './UploadForm';

export const metadata: Metadata = { title: 'Unggah buku', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function UnggahPage() {
  const configured = Boolean(supabaseConfig());
  const user = configured ? await getCurrentUser() : null;
  if (configured && !user) redirect('/masuk?lanjut=/admin/buku/unggah');
  if (configured && !isStaff(user)) redirect('/perpustakaan');
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav className="t-body-sm muted" aria-label="Jejak navigasi"><Link href="/admin/buku">Kelola buku</Link> / Unggah</nav>
        <h1 className="t-heading-1" style={{ marginTop: 8 }}>Unggah buku</h1>
        <p className="muted" style={{ marginTop: 8, maxWidth: '68ch' }}>
          Berkas dibaca di browser Anda; yang dikirim ke server hanya teks per halaman. Berkas PDF aslinya tidak disimpan.
          Setelah unggah, periksa struktur bab dan metadata sebelum buku terlihat oleh siswa.
        </p>
        {configured ? <div style={{ marginTop: 24 }}><UploadForm /></div> : <NotConfigured what="Unggah buku" />}
      </main>
      <Footer />
    </>
  );
}
