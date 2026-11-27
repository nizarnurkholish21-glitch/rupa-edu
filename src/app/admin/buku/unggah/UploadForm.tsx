'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ingestText, type IngestResult } from '@/lib/library/ingest';
import { bookRow, chapterRows, chunkRows, pageRows, slugify } from '@/lib/library/rows';
import { pdfToText, sha256Hex } from '@/lib/library/pdf-browser';
import { abortUpload, appendUploadPart, createUploadedBook, finishUpload } from '../actions';

const MAX_BYTES = 80 * 1024 * 1024;
type Stage = 'pilih' | 'membaca' | 'pratinjau' | 'mengunggah' | 'galat';

export function UploadForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('pilih');
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sha, setSha] = useState('');
  const [result, setResult] = useState<IngestResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(pdf|txt)$/i.test(f.name)) { setStage('galat'); setMsg('Hanya berkas .pdf atau .txt.'); return; }
    if (f.size > MAX_BYTES) { setStage('galat'); setMsg('Berkas lebih dari 80 MB.'); return; }
    setFile(f); setStage('membaca'); setMsg('Membaca berkas…');
    try {
      const text = /\.pdf$/i.test(f.name) ? await pdfToText(f, (d, t) => setMsg(`Membaca halaman ${d} dari ${t}…`)) : await f.text();
      const r = ingestText(text);
      const empty = r.pages.filter((p) => p.trim().length < 20).length;
      if (empty > r.pageCount * 0.5) { setStage('galat'); setMsg('Sebagian besar halaman tidak berisi teks. Kemungkinan PDF hasil pindai; OCR belum tersedia.'); return; }
      setSha(await sha256Hex(f)); setResult(r); setStage('pratinjau'); setMsg('');
    } catch (e) {
      setStage('galat'); setMsg(`Berkas tidak dapat dibaca: ${(e as Error).message}`);
    }
  }

  async function upload() {
    if (!result || !file) return;
    setStage('mengunggah');
    const fileName = file.name.replace(/^[0-9a-f]{8}-/, '');
    const row = bookRow(result, { fileName, sha256: sha, slug: slugify(result.metadata.title ?? fileName) });
    const { status: _s, metadata_public: _m, allow_ai_processing: _a, ...input } = row;
    void _s; void _m; void _a;
    const created = await createUploadedBook(input);
    if ('error' in created) { setStage('galat'); setMsg(created.error); return; }
    try {
      const pages = pageRows(result);
      for (let i = 0; i < pages.length; i += 30) {
        setMsg(`Mengunggah halaman ${Math.min(i + 30, pages.length)} dari ${pages.length}…`);
        const r = await appendUploadPart(created.id, { pages: pages.slice(i, i + 30) });
        if ('error' in r) throw new Error(r.error);
      }
      const chunks = chunkRows(result);
      for (let i = 0; i < chunks.length; i += 150) {
        setMsg(`Membuat indeks pencarian ${Math.min(i + 150, chunks.length)} dari ${chunks.length}…`);
        const r = await appendUploadPart(created.id, { chunks: chunks.slice(i, i + 150) });
        if ('error' in r) throw new Error(r.error);
      }
      const ch = await appendUploadPart(created.id, { chapters: chapterRows(result) });
      if ('error' in ch) throw new Error(ch.error);
      const done = await finishUpload(created.id);
      if ('error' in done) throw new Error(done.error);
      router.push(`/admin/buku/${created.slug}`);
    } catch (e) {
      await abortUpload(created.id).catch(() => undefined);
      setStage('galat'); setMsg(`Unggahan gagal dan dibatalkan: ${(e as Error).message}`);
    }
  }

  const m = result?.metadata;
  return (
    <div className="stack" style={{ maxWidth: '72ch' }}>
      <div className="field">
        <label htmlFor="berkas">Berkas buku (.pdf atau .txt hasil ekspor PDF)</label>
        <input id="berkas" type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={stage === 'membaca' || stage === 'mengunggah'}
          onChange={(e) => onFile(e.target.files?.[0])} style={{ paddingTop: 10 }} />
      </div>
      {msg ? <p role="status" aria-live="polite" className={stage === 'galat' ? '' : 'muted'}>{stage === 'galat' ? <strong>{msg}</strong> : msg}</p> : null}

      {stage === 'pratinjau' && result && m ? (
        <>
          <section className="card">
            <h2 className="t-title">Hasil baca otomatis</h2>
            <dl className="t-body-sm" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', marginTop: 8 }}>
              <dt className="muted">Judul</dt><dd style={{ margin: 0 }}>{m.title ?? '— (isi manual nanti)'}</dd>
              <dt className="muted">Jenjang</dt><dd style={{ margin: 0 }}>{m.level ? `${m.level} kelas ${m.grade ?? '?'}` : '—'}{m.semester ? `, semester ${m.semester}` : ''}</dd>
              <dt className="muted">Penulis</dt><dd style={{ margin: 0 }}>{m.authors.join(', ') || '—'}</dd>
              <dt className="muted">Pemegang hak cipta</dt><dd style={{ margin: 0 }}>{m.copyrightHolder ?? '—'}</dd>
              <dt className="muted">Halaman</dt><dd style={{ margin: 0 }}>{result.pageCount} (nomor cetak terdeteksi di {Math.round(result.labelCoverage * 100)}%)</dd>
              <dt className="muted">Bab</dt><dd style={{ margin: 0 }}>{result.chapters.filter((c) => c.kind !== 'bagian').length} terdeteksi, {result.chapters.filter((c) => c.verified).length} cocok otomatis</dd>
            </dl>
            {result.warnings.length ? <ul className="t-body-sm" style={{ marginTop: 8, paddingLeft: 20 }}>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
          </section>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ marginTop: 4 }} />
            <span>Saya memastikan buku ini boleh diproses untuk pembelajaran di sekolah yang akan diberi akses, dan isinya tidak akan ditampilkan untuk umum.</span>
          </label>
          <button className="btn btn-primary" type="button" disabled={!confirmed} onClick={upload}>Unggah dan lanjut ke tinjauan</button>
        </>
      ) : null}
    </div>
  );
}
