import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabaseConfig } from '@/lib/config';
import { getCurrentUser, primaryRole, ROLE_LABEL, type AppRole } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ruang saya', robots: { index: false } };

// Apa yang tersedia per peran. Status jujur: "Direncanakan" berarti belum dibangun.
const ROLE_PLAN: Record<AppRole, { greeting: string; items: { label: string; phase: string }[] }> = {
  student: { greeting: 'Ini ruang belajarmu.', items: [
    { label: 'Buku pelajaran sekolahmu: baca dan cari isinya', phase: 'Tersedia di menu Perpustakaan' },
    { label: 'Pelajaran dan materi pekan ini', phase: 'Fase 2' },
    { label: 'Tugas mendatang dan feedback', phase: 'Fase 2' },
    { label: 'Tutor AI bersumber dari buku', phase: 'Fase 3' },
    { label: 'Art Lab dan portofolio Jejak Karya', phase: 'Fase 4' },
  ] },
  teacher: { greeting: 'Ruang kerja guru.', items: [
    { label: 'Kelas yang diampu, modul pekanan, tugas', phase: 'Fase 2' },
    { label: 'Perpustakaan buku sekolah: baca per halaman dan cari isi', phase: 'Tersedia di menu Perpustakaan' },
    { label: 'Lesson Studio dan generator kuis (draf AI, disetujui guru)', phase: 'Fase 3' },
    { label: 'Absensi QR dan reminder', phase: 'Fase 5' },
  ] },
  guardian: { greeting: 'Pantau perkembangan anak Anda.', items: [
    { label: 'Progres dan tugas anak', phase: 'Fase 2' },
    { label: 'Persetujuan publikasi karya', phase: 'Fase 4' },
    { label: 'Rekap kehadiran', phase: 'Fase 5' },
  ] },
  school_admin: { greeting: 'Kelola sekolah Anda.', items: [
    { label: 'Tahun ajaran, kelas, impor siswa dan guru', phase: 'Fase 2' },
    { label: 'Buku sekolah dan hak akses', phase: 'Tersedia (perpustakaan)' },
    { label: 'Jejak audit sekolah', phase: 'Fase 2' },
  ] },
  moderator: { greeting: 'Ruang moderasi.', items: [
    { label: 'Antrean laporan konten', phase: 'Fase 4' },
  ] },
  super_admin: { greeting: 'Pengaturan platform.', items: [
    { label: 'Status integrasi', phase: 'Tersedia di halaman Status layanan' },
    { label: 'Unggah dan tinjau buku', phase: 'Tersedia di Kelola buku' },
    { label: 'Registry sumber pengetahuan', phase: 'Fase 6' },
  ] },
};

export default async function RuangPage() {
  if (!supabaseConfig()) {
    return (
      <>
        <Header />
        <main id="konten" className="container" style={{ paddingTop: 48 }}>
          <h1 className="t-heading-1">Ruang saya</h1>
          <div className="notice" style={{ marginTop: 24, maxWidth: '68ch' }}>
            <strong>Layanan akun belum dikonfigurasi</strong>
            Ruang pribadi aktif setelah Supabase dihubungkan.
          </div>
        </main>
        <Footer />
      </>
    );
  }
  const user = await getCurrentUser();
  if (!user) return null; // middleware sudah mengalihkan ke /masuk
  const role = primaryRole(user);
  const plan = role ? ROLE_PLAN[role] : null;

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <h1 className="t-heading-1">Halo, {user.displayName}</h1>
            <p className="muted" style={{ marginTop: 8 }}>{plan ? plan.greeting : 'Akun Anda belum terhubung ke sekolah mana pun.'}</p>
          </div>
          <form action="/keluar" method="post"><button className="btn btn-secondary" type="submit">Keluar</button></form>
        </div>

        <section aria-labelledby="judul-peran" style={{ marginTop: 32 }}>
          <h2 id="judul-peran" className="t-heading-2">Peran Anda</h2>
          {user.memberships.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>Pengguna umum. Anda tetap bisa memakai pencarian dan konten publik.</p>
          ) : (
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {user.memberships.map((m, i) => (
                <li key={i}>{ROLE_LABEL[m.role]}{m.school_name ? ` · ${m.school_name}` : ''}</li>
              ))}
            </ul>
          )}
        </section>

        {plan ? (
          <section aria-labelledby="judul-rencana" style={{ marginTop: 32 }}>
            <h2 id="judul-rencana" className="t-heading-2">Yang akan tersedia di sini</h2>
            <p className="t-body-sm muted" style={{ marginTop: 4 }}>Fitur bertanda &ldquo;Tersedia&rdquo; sudah bisa dipakai lewat menu; sisanya muncul begitu fasenya lulus uji.</p>
            <ul className="grid-3" style={{ listStyle: 'none', padding: 0, marginTop: 16 }}>
              {plan.items.map((it) => (
                <li key={it.label} className="card">
                  <p className="t-title">{it.label}</p>
                  <p className="t-body-sm muted" style={{ marginTop: 4 }}>Direncanakan · {it.phase}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p style={{ marginTop: 32 }}><Link href="/">Kembali ke pencarian</Link></p>
      </main>
      <Footer />
    </>
  );
}
