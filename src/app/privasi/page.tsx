import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = { title: 'Privasi' };

export default function PrivasiPage() {
  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 48 }}>
        <article className="prose stack">
          <h1 className="t-heading-1">Privasi</h1>
          <div className="notice">
            <strong>Draf, belum ditinjau ahli hukum</strong>
            RUPA EDU masih dalam pengembangan dan belum memproses data siswa sungguhan. Pemberitahuan ini akan ditinjau sesuai
            UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi sebelum peluncuran.
          </div>
          <h2 className="t-heading-2">Tanpa login</h2>
          <p>
            Anda bisa mencari dan membaca konten publik tanpa akun. Kami tidak menyimpan riwayat pencarian dan tidak memakai
            pelacak iklan. Penyedia hosting dapat mencatat alamat halaman yang diminta, termasuk kata pencarian, dalam log teknis
            sementara untuk keamanan dan perbaikan galat.
          </p>
          <h2 className="t-heading-2">Dengan akun</h2>
          <ul style={{ paddingLeft: 20 }}>
            <li>Yang disimpan: email, nama tampilan, dan peran Anda di sekolah.</li>
            <li>Cookie dipakai hanya untuk menjaga sesi login Anda.</li>
            <li>Siswa hanya melihat data miliknya; guru hanya kelas yang diampu; wali hanya anaknya. Aturan ini ditegakkan di database.</li>
            <li>Tindakan penting (perubahan nilai, absensi, publikasi karya) dicatat dalam jejak audit.</li>
          </ul>
          <h2 className="t-heading-2">Yang tidak kami kumpulkan</h2>
          <p>Lokasi presisi, data biometrik, atau riwayat penjelajahan di luar RUPA EDU.</p>
          <h2 className="t-heading-2">Hak Anda</h2>
          <p>Anda dapat meminta salinan, koreksi, atau penghapusan data. Alur permintaan mandiri sedang dibangun; sementara itu hubungi admin sekolah Anda.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
