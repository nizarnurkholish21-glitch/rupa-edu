'use client';
// Ekstraksi teks PDF di browser dengan pdf.js. Hasil per halaman dipisah form feed (\f), sama seperti pdftotext.
// PDF hasil pindai (tanpa lapisan teks) menghasilkan halaman kosong; OCR belum tersedia (direncanakan).

interface TextItem { str: string; transform: number[]; hasEOL?: boolean }

export async function pdfToText(file: File, onProgress?: (done: number, total: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Kelompokkan potongan teks per baris berdasarkan posisi vertikal.
    const lines: { y: number; parts: { x: number; s: string }[] }[] = [];
    for (const raw of content.items as TextItem[]) {
      if (!('str' in raw) || !raw.str.trim()) continue;
      const x = raw.transform[4] ?? 0, y = raw.transform[5] ?? 0;
      const line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (line) line.parts.push({ x, s: raw.str }); else lines.push({ y, parts: [{ x, s: raw.str }] });
    }
    lines.sort((a, b) => b.y - a.y);
    pages.push(lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()).join('\n'));
    page.cleanup();
    onProgress?.(n, doc.numPages);
  }
  await doc.destroy();
  return pages.join('\f');
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
