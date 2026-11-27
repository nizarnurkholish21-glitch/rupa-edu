import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = { title: 'Cakupan & sumber' };

const PHASES = [
  ['Fase 1 · Fondasi', 'Akun, peran, isolasi data sekolah, pencarian awal, tampilan dasar.', 'Sedang berjalan'],
  ['Fase 2 · LMS dan perpustakaan', 'Kelas, modul pekanan, tugas, nilai; unggah buku PDF berizin, OCR, bab dan halaman.', 'Direncanakan'],
  ['Fase 3 · AI belajar', 'Tutor AI dan jawaban bersitasi dari buku, generator kuis, Lesson Studio.', 'Direncanakan'],
  ['Fase 4 · Praktik dan karya', 'Art Lab, game edukasi, portofolio, galeri dengan izin.', 'Direncanakan'],
  ['Fase 5 · Operasi sekolah', 'Absensi QR, pengingat, analitik nilai, portal wali.', 'Direncanakan'],
  ['Fase 6 · Explore dan Atlas', 'Sumber terbuka (perpustakaan, jurnal, museum), Knowledge Atlas, Time Machine, Future Horizons.', 'Direncanakan'],
  ['Fase 7 · Marketplace', 'Hanya setelah tinjauan hukum, pembayaran, dan perlindungan anak lulus.', 'Direncanakan'],
  ['Fase 8 · Produksi', 'Audit keamanan, aksesibilitas, performa, pemantauan.', 'Direncanakan'],
];

export default function CakupanPage() {
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <article className="prose stack">
          <h1 className="t-heading-1">Cakupan &amp; sumber</h1>
          <p>
            RUPA EDU bercita-cita menghubungkan pengetahuan dari banyak sumber yang sah. Saat ini cakupannya masih kecil, dan kami
            menyebutnya apa adanya.
          </p>
          <h2 className="t-heading-2">Yang bisa dicari hari ini</h2>
          <ul style={{ paddingLeft: 20 }}>
            <li>12 artikel <strong>demo</strong> tentang seni rupa dan desain, ditulis tim RUPA EDU sebagai contoh dan belum ditinjau ahli.</li>
            <li>Belum ada sumber eksternal: perpustakaan digital, jurnal, museum, dan hasil web umum belum dihubungkan.</li>
          </ul>
          <h2 className="t-heading-2">Prinsip sumber</h2>
          <ul style={{ paddingLeft: 20 }}>
            <li>Setiap hasil menyebut sumber dan lisensinya.</li>
            <li>Kami tidak melewati paywall, login, atau larangan robots.txt, dan tidak menyalin buku berhak cipta.</li>
            <li>Untuk sumber yang hanya mengizinkan metadata, kami hanya menampilkan metadata dan tautan resmi.</li>
            <li>Jawaban AI (mulai Fase 3) wajib mengutip sumber yang benar-benar diambil, dan mengatakan &ldquo;belum ditemukan&rdquo; bila buktinya kurang.</li>
          </ul>
          <h2 id="rencana" className="t-heading-2">Rencana pengembangan</h2>
        </article>
        <ol style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'grid', gap: 12, maxWidth: '72ch' }}>
          {PHASES.map(([name, desc, status]) => (
            <li key={name} className="card">
              <p className="t-title">{name}</p>
              <p className="t-body-sm" style={{ marginTop: 4 }}>{desc}</p>
              <p className="t-body-sm muted" style={{ marginTop: 4 }}>{status}</p>
            </li>
          ))}
        </ol>
      </main>
      <Footer />
    </>
  );
}
