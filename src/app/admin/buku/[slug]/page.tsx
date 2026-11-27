import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';
import { getBook, getChapters, getLabels, LICENSE_LABEL, STATUS_LABEL } from '@/lib/library/queries';
import { saveChapters, setBookAccess, setBookStatus, updateBookMeta } from '../actions';

export const metadata: Metadata = { title: 'Tinjau buku', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tersimpan?: string; galat?: string }> };

const SAVED: Record<string, string> = { metadata: 'Metadata tersimpan.', bab: 'Struktur bab tersimpan dan ditandai sudah ditinjau.', status: 'Status buku diperbarui.', akses: 'Akses sekolah diperbarui.' };
const SOURCE: Record<string, string> = { daftar_isi: 'daftar isi', judul_halaman: 'judul halaman', gabungan: 'daftar isi + judul', manual: 'manual' };
const fieldStyle = { display: 'grid', gap: 4 } as const;

export default async function TinjauBukuPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/masuk?lanjut=/admin/buku');
  if (!isStaff(user)) redirect('/perpustakaan');
  const { slug } = await params;
  const { tersimpan, galat } = await searchParams;
  const book = await getBook(slug);
  if (!book) notFound();
  const chapters = await getChapters(book.id);
  const labels = await getLabels(book.id, chapters.map((c) => c.start_index));
  const db = await createServerSupabase();
  const [{ data: schools }, { data: access }] = await Promise.all([
    db.from('schools').select('id,name').order('name'),
    db.from('book_access').select('school_id').eq('book_id', book.id),
  ]);
  const granted = new Set((access ?? []).map((a) => a.school_id as string));
  const rows = chapters.length;

  return (
    <>
      <Header />
      <main id="konten" className="container" style={{ paddingTop: 32 }}>
        <nav className="t-body-sm muted" aria-label="Jejak navigasi"><Link href="/admin/buku">Kelola buku</Link> / Tinjau</nav>
        <h1 className="t-heading-1" style={{ marginTop: 8 }}>{book.title}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Status: <strong>{STATUS_LABEL[book.status]}</strong> · {book.page_count} halaman · nomor halaman cetak terdeteksi di {Math.round(book.label_coverage * 100)}% halaman
          {' · '}<Link href={`/perpustakaan/${book.slug}`}>Lihat sebagai pembaca</Link>
        </p>
        {tersimpan && SAVED[tersimpan] ? <div className="notice" role="status" style={{ marginTop: 16 }}><strong>{SAVED[tersimpan]}</strong></div> : null}
        {galat === 'bab-kosong' ? <div className="notice notice-danger" role="alert" style={{ marginTop: 16 }}><strong>Belum bisa ditandai siap</strong>Isi minimal satu bab terlebih dahulu.</div> : null}
        {book.warnings.length ? (
          <div className="notice" style={{ marginTop: 16 }}>
            <strong>Catatan pemrosesan otomatis</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{book.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        ) : null}

        {/* 1. Struktur bab */}
        <section aria-labelledby="judul-bab" style={{ marginTop: 32 }}>
          <h2 id="judul-bab" className="t-heading-2">1. Periksa struktur bab</h2>
          <p className="t-body-sm muted" style={{ marginTop: 4, maxWidth: '72ch' }}>
            &ldquo;Halaman awal&rdquo; adalah nomor halaman berkas (bukan nomor cetak). Buka tautan &ldquo;lihat&rdquo; untuk memastikan halaman itu memang awal bab.
            Baris bertanda <strong>periksa</strong> judulnya tidak ditemukan otomatis di halaman awal. Isi baris kosong terakhir untuk menambah bab.
          </p>
          <form action={saveChapters} style={{ marginTop: 12, overflowX: 'auto' }}>
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="rows" value={rows} />
            <table className="t-body-sm" style={{ borderCollapse: 'collapse', minWidth: 760, width: '100%' }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line-strong)' }}>
                <th style={{ padding: 6 }}>Jenis</th><th style={{ padding: 6 }}>No.</th><th style={{ padding: 6 }}>Judul</th>
                <th style={{ padding: 6 }}>Halaman awal (berkas)</th><th style={{ padding: 6 }}>Hlm cetak</th><th style={{ padding: 6 }}>Asal</th><th style={{ padding: 6 }}>Hapus</th>
              </tr></thead>
              <tbody>
                {[...chapters, null].map((c, i) => (
                  <tr key={c?.id ?? 'baru'} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: 6 }}>
                      <label className="sr-only" htmlFor={`kind_${i}`}>Jenis</label>
                      <select id={`kind_${i}`} name={`kind_${i}`} defaultValue={c?.kind ?? 'bab'}>
                        <option value="bab">Bab</option><option value="unit">Unit</option><option value="bagian">Bagian</option>
                      </select>
                    </td>
                    <td style={{ padding: 6 }}><label className="sr-only" htmlFor={`ordinal_${i}`}>Nomor</label><input id={`ordinal_${i}`} name={`ordinal_${i}`} type="number" min={0} max={99} defaultValue={c?.ordinal ?? ''} style={{ width: 56 }} /></td>
                    <td style={{ padding: 6 }}><label className="sr-only" htmlFor={`title_${i}`}>Judul</label><input id={`title_${i}`} name={`title_${i}`} defaultValue={c?.title ?? ''} placeholder={c ? '' : 'Bab baru…'} style={{ width: '100%', minWidth: 240 }} /></td>
                    <td style={{ padding: 6 }}>
                      <label className="sr-only" htmlFor={`start_${i}`}>Halaman awal</label>
                      <input id={`start_${i}`} name={`start_${i}`} type="number" min={1} max={book.page_count} defaultValue={c ? c.start_index + 1 : ''} style={{ width: 80 }} />
                      {c ? <> <Link href={`/perpustakaan/${book.slug}/${c.start_index + 1}`} target="_blank">lihat</Link></> : null}
                    </td>
                    <td style={{ padding: 6 }}>{c ? labels.get(c.start_index) ?? '—' : ''}</td>
                    <td style={{ padding: 6 }}>
                      {c ? <>{SOURCE[c.source]}{c.reviewed ? ' · ditinjau' : c.auto_verified ? ' · cocok' : <strong> · periksa</strong>}</> : 'baru'}
                    </td>
                    <td style={{ padding: 6 }}>{c ? <><label className="sr-only" htmlFor={`hapus_${i}`}>Hapus</label><input id={`hapus_${i}`} name={`hapus_${i}`} type="checkbox" /></> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-primary" type="submit" style={{ marginTop: 12 }}>Simpan struktur bab</button>
          </form>
        </section>

        {/* 2. Metadata & lisensi */}
        <section aria-labelledby="judul-meta" style={{ marginTop: 40, maxWidth: '72ch' }}>
          <h2 id="judul-meta" className="t-heading-2">2. Periksa metadata dan lisensi</h2>
          <form action={updateBookMeta} className="stack" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={book.id} />
            <div className="field"><label htmlFor="title">Judul</label><input id="title" name="title" defaultValue={book.title} required /></div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <div style={fieldStyle} className="field"><label htmlFor="book_type">Jenis</label>
                <select id="book_type" name="book_type" defaultValue={book.book_type}><option value="buku_siswa">Buku siswa</option><option value="buku_guru">Panduan guru</option><option value="lainnya">Lainnya</option></select></div>
              <div style={fieldStyle} className="field"><label htmlFor="level">Jenjang</label>
                <select id="level" name="level" defaultValue={book.level ?? ''}><option value="">—</option>{['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK'].map((l) => <option key={l}>{l}</option>)}</select></div>
              <div className="field"><label htmlFor="grade">Kelas</label><input id="grade" name="grade" type="number" min={1} max={12} defaultValue={book.grade ?? ''} /></div>
              <div className="field"><label htmlFor="semester">Semester</label><input id="semester" name="semester" type="number" min={1} max={2} defaultValue={book.semester ?? ''} /></div>
              <div className="field"><label htmlFor="year">Tahun</label><input id="year" name="year" type="number" min={1900} max={2100} defaultValue={book.year ?? ''} /></div>
            </div>
            <div className="field"><label htmlFor="authors">Penulis (pisahkan dengan koma)</label><input id="authors" name="authors" defaultValue={book.authors.join(', ')} /></div>
            <div className="field"><label htmlFor="publisher">Penerbit</label><input id="publisher" name="publisher" defaultValue={book.publisher ?? book.copyright_holder ?? ''} /></div>
            <div className="field"><label htmlFor="isbn">ISBN (pisahkan dengan koma)</label><input id="isbn" name="isbn" defaultValue={book.isbn.join(', ')} /></div>
            <div style={fieldStyle} className="field"><label htmlFor="license_kind">Lisensi</label>
              <select id="license_kind" name="license_kind" defaultValue={book.license_kind}>{Object.entries(LICENSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="field"><label htmlFor="license_note">Catatan lisensi</label><input id="license_note" name="license_note" defaultValue={book.license_note} /></div>
            <div className="field"><label htmlFor="official_url">Tautan sumber resmi (https://…, opsional)</label><input id="official_url" name="official_url" type="url" defaultValue={book.official_url ?? ''} placeholder="Salin dari halaman buku di SIBI bila ada" /></div>
            <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="metadata_public" defaultChecked={book.metadata_public} /> Tampilkan keterangan buku (bukan isi) untuk umum</label>
            <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="allow_ai_processing" defaultChecked={book.allow_ai_processing} /> Izinkan diproses AI (Fase 3). Centang hanya bila lisensi mengizinkan.</label>
            <button className="btn btn-primary" type="submit">Simpan metadata</button>
          </form>
        </section>

        {/* 3. Akses sekolah */}
        <section aria-labelledby="judul-akses" style={{ marginTop: 40, maxWidth: '72ch' }}>
          <h2 id="judul-akses" className="t-heading-2">3. Sekolah yang boleh membaca isi</h2>
          {(schools ?? []).length === 0 ? <p className="muted" style={{ marginTop: 8 }}>Belum ada sekolah yang terlihat oleh akun Anda (hanya super admin yang melihat semua sekolah).</p> : (
            <form action={setBookAccess} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={book.id} /><input type="hidden" name="slug" value={book.slug} />
              <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 8 }}>
                <legend className="sr-only">Sekolah</legend>
                {(schools ?? []).map((s) => (
                  <label key={s.id as string} style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="school" value={s.id as string} defaultChecked={granted.has(s.id as string)} /> {s.name as string}</label>
                ))}
              </fieldset>
              <button className="btn btn-secondary" type="submit" style={{ marginTop: 12 }}>Simpan akses</button>
            </form>
          )}
        </section>

        {/* 4. Status */}
        <section aria-labelledby="judul-status" style={{ marginTop: 40, maxWidth: '72ch' }}>
          <h2 id="judul-status" className="t-heading-2">4. Terbitkan</h2>
          <p className="t-body-sm muted" style={{ marginTop: 4 }}>Setelah bab dan metadata benar, tandai siap. Isi buku lalu terlihat oleh siswa dan guru di sekolah yang dipilih di atas.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {book.status !== 'siap' ? (
              <form action={setBookStatus}><input type="hidden" name="id" value={book.id} /><input type="hidden" name="slug" value={book.slug} /><input type="hidden" name="status" value="siap" />
                <button className="btn btn-primary" type="submit">Tandai sudah ditinjau dan siap</button></form>
            ) : (
              <form action={setBookStatus}><input type="hidden" name="id" value={book.id} /><input type="hidden" name="slug" value={book.slug} /><input type="hidden" name="status" value="perlu_tinjauan" />
                <button className="btn btn-secondary" type="submit">Kembalikan ke perlu tinjauan</button></form>
            )}
            {book.status !== 'ditarik' ? (
              <form action={setBookStatus}><input type="hidden" name="id" value={book.id} /><input type="hidden" name="slug" value={book.slug} /><input type="hidden" name="status" value="ditarik" />
                <button className="btn btn-secondary" type="submit">Tarik buku</button></form>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
