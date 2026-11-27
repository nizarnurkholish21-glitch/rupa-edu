import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Masuk', robots: { index: false } };

type Props = { searchParams: Promise<{ lanjut?: string }> };

export default async function MasukPage({ searchParams }: Props) {
  if (await getCurrentUser()) redirect('/ruang');
  const configured = Boolean(supabaseConfig());
  const { lanjut } = await searchParams;
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48, maxWidth: 480 }}>
        <h1 className="t-heading-1">Masuk</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 24 }}>
          Siswa dan guru memakai akun yang dibuat oleh sekolah. Untuk mencari pengetahuan, Anda tidak perlu masuk.
        </p>
        {!configured ? (
          <div className="notice" role="status" style={{ marginBottom: 24 }}>
            <strong>Layanan akun belum dikonfigurasi</strong>
            Login akan aktif setelah Supabase dihubungkan (lihat panduan di README repositori).
          </div>
        ) : null}
        <LoginForm next={lanjut} disabled={!configured} />
        <p className="t-body-sm muted" style={{ marginTop: 24 }}>
          Lupa kata sandi? Hubungi admin sekolah Anda. Pemulihan mandiri lewat email menyusul setelah layanan email dihubungkan.
        </p>
      </main>
      <Footer />
    </>
  );
}
