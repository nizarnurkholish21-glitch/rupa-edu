'use server';
// Aksi staf untuk perpustakaan. Semua berjalan dengan sesi pengguna; database (RLS) menolak bila bukan staf.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

async function staffDb() {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) throw new Error('Hanya staf platform yang boleh mengelola buku.');
  return { db: await createServerSupabase(), user };
}

const csv = (v: FormDataEntryValue | null) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const optInt = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v));

const MetaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(300),
  book_type: z.enum(['buku_siswa', 'buku_guru', 'lainnya']),
  level: z.enum(['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK']).nullable(),
  grade: z.number().int().min(1).max(12).nullable(),
  semester: z.union([z.literal(1), z.literal(2)]).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  authors: z.array(z.string().max(120)).max(12),
  publisher: z.string().max(200).nullable(),
  isbn: z.array(z.string().regex(/^[0-9-]{10,17}$/)).max(6),
  license_kind: z.enum(['hak_cipta_dilindungi', 'lisensi_terbuka', 'domain_publik', 'izin_khusus']),
  license_note: z.string().max(1000),
  official_url: z.string().url().startsWith('https://').nullable(),
  metadata_public: z.boolean(),
  allow_ai_processing: z.boolean(),
});

export async function updateBookMeta(formData: FormData) {
  const { db, user } = await staffDb();
  const parsed = MetaSchema.parse({
    id: formData.get('id'),
    title: formData.get('title'),
    book_type: formData.get('book_type'),
    level: formData.get('level') || null,
    grade: optInt(formData.get('grade')),
    semester: optInt(formData.get('semester')),
    year: optInt(formData.get('year')),
    authors: csv(formData.get('authors')),
    publisher: String(formData.get('publisher') ?? '').trim() || null,
    isbn: csv(formData.get('isbn')),
    license_kind: formData.get('license_kind'),
    license_note: String(formData.get('license_note') ?? ''),
    official_url: String(formData.get('official_url') ?? '').trim() || null,
    metadata_public: formData.get('metadata_public') === 'on',
    allow_ai_processing: formData.get('allow_ai_processing') === 'on',
  });
  const { id, ...rest } = parsed;
  const { data, error } = await db.from('books').update(rest).eq('id', id).select('slug').single();
  if (error) throw new Error(error.message);
  await db.rpc('log_event', { p_action: 'book.update_meta', p_school: null, p_target_table: 'books', p_target_id: id, p_meta: { by: user.id } });
  revalidatePath(`/admin/buku/${data.slug}`);
  redirect(`/admin/buku/${data.slug}?tersimpan=metadata`);
}

const ChapterSchema = z.object({
  kind: z.enum(['bab', 'unit', 'bagian']),
  ordinal: z.number().int().min(0).max(99),
  title: z.string().trim().min(1).max(300),
  start: z.number().int().min(1),
});

export async function saveChapters(formData: FormData) {
  const { db } = await staffDb();
  const bookId = z.string().uuid().parse(formData.get('book_id'));
  const { data: book, error: be } = await db.from('books').select('slug,page_count').eq('id', bookId).single();
  if (be || !book) throw new Error('Buku tidak ditemukan');
  const n = Number(formData.get('rows') ?? 0);
  const rows: z.infer<typeof ChapterSchema>[] = [];
  for (let i = 0; i < n + 1; i++) {
    if (formData.get(`hapus_${i}`) === 'on') continue;
    const title = String(formData.get(`title_${i}`) ?? '').trim();
    const start = optInt(formData.get(`start_${i}`));
    if (!title || start === null) continue; // baris kosong (mis. baris tambahan yang tidak diisi)
    rows.push(ChapterSchema.parse({ kind: formData.get(`kind_${i}`), ordinal: optInt(formData.get(`ordinal_${i}`)) ?? 0, title, start }));
  }
  rows.sort((a, b) => a.start - b.start);
  const chapters = rows.map((r, i) => {
    const startIndex = Math.min(r.start, book.page_count) - 1;
    const next = rows[i + 1] ? Math.min(rows[i + 1]!.start, book.page_count) - 1 : book.page_count;
    return { book_id: bookId, kind: r.kind, ordinal: r.ordinal, title: r.title, start_index: startIndex, end_index: Math.max(startIndex, next - 1), source: 'manual' as const, auto_verified: false, reviewed: true };
  });
  const { error: de } = await db.from('book_chapters').delete().eq('book_id', bookId);
  if (de) throw new Error(de.message);
  if (chapters.length) {
    const { error } = await db.from('book_chapters').insert(chapters);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/admin/buku/${book.slug}`);
  redirect(`/admin/buku/${book.slug}?tersimpan=bab`);
}

export async function setBookStatus(formData: FormData) {
  const { db, user } = await staffDb();
  const id = z.string().uuid().parse(formData.get('id'));
  const status = z.enum(['siap', 'perlu_tinjauan', 'ditarik']).parse(formData.get('status'));
  const patch = status === 'siap' ? { status, reviewed_at: new Date().toISOString(), reviewed_by: user.id } : { status };
  if (status === 'siap') {
    const { count } = await db.from('book_chapters').select('id', { count: 'exact', head: true }).eq('book_id', id);
    if (!count) redirect(`/admin/buku/${String(formData.get('slug'))}?galat=bab-kosong`);
  }
  const { data, error } = await db.from('books').update(patch).eq('id', id).select('slug').single();
  if (error) throw new Error(error.message);
  await db.rpc('log_event', { p_action: `book.status_${status}`, p_school: null, p_target_table: 'books', p_target_id: id, p_meta: {} });
  revalidatePath('/admin/buku');
  redirect(`/admin/buku/${data.slug}?tersimpan=status`);
}

export async function setBookAccess(formData: FormData) {
  const { db } = await staffDb();
  const id = z.string().uuid().parse(formData.get('id'));
  const slug = String(formData.get('slug'));
  const wanted = new Set(formData.getAll('school').map((v) => z.string().uuid().parse(v)));
  const { data: current } = await db.from('book_access').select('school_id').eq('book_id', id);
  const have = new Set((current ?? []).map((r) => r.school_id as string));
  const add = [...wanted].filter((s) => !have.has(s)).map((school_id) => ({ book_id: id, school_id }));
  const remove = [...have].filter((s) => !wanted.has(s));
  if (add.length) { const { error } = await db.from('book_access').insert(add); if (error) throw new Error(error.message); }
  if (remove.length) { const { error } = await db.from('book_access').delete().eq('book_id', id).in('school_id', remove); if (error) throw new Error(error.message); }
  revalidatePath(`/admin/buku/${slug}`);
  redirect(`/admin/buku/${slug}?tersimpan=akses`);
}

// ---------------------------------------------------------------- unggah bertahap dari browser

const NewBookSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,120}$/),
  title: z.string().min(2).max(300),
  book_type: z.enum(['buku_siswa', 'buku_guru', 'lainnya']),
  level: z.enum(['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK']).nullable(),
  grade: z.number().int().min(1).max(12).nullable(),
  semester: z.number().int().min(1).max(2).nullable(),
  subject: z.string().max(80),
  edition: z.string().max(80).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  authors: z.array(z.string().max(120)).max(12),
  publisher: z.string().max(200).nullable(),
  isbn: z.array(z.string().max(20)).max(6),
  copyright_holder: z.string().max(300).nullable(),
  license_kind: z.enum(['hak_cipta_dilindungi', 'lisensi_terbuka', 'domain_publik', 'izin_khusus']),
  license_note: z.string().max(1000),
  page_count: z.number().int().min(1).max(5000),
  label_coverage: z.number().min(0).max(1),
  source_file_name: z.string().max(255).nullable(),
  source_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  warnings: z.array(z.string().max(300)).max(30),
});

export async function createUploadedBook(input: unknown): Promise<{ id: string; slug: string } | { error: string }> {
  const { db, user } = await staffDb();
  const b = NewBookSchema.parse(input);
  if (b.source_sha256) {
    const { data: dup } = await db.from('books').select('slug').eq('source_sha256', b.source_sha256).maybeSingle();
    if (dup) return { error: `Berkas yang sama sudah pernah diunggah (${dup.slug}).` };
  }
  let slug = b.slug;
  const { data: taken } = await db.from('books').select('slug').like('slug', `${slug}%`);
  if (taken?.some((t) => t.slug === slug)) slug = `${slug}-${(taken.length + 1).toString()}`;
  const { data, error } = await db.from('books').insert({
    ...b, slug, status: 'diproses', metadata_public: true, allow_ai_processing: false, created_by: user.id,
  }).select('id,slug').single();
  if (error) return { error: error.message };
  return { id: data.id as string, slug: data.slug as string };
}

const PagesSchema = z.array(z.object({
  page_index: z.number().int().min(0), printed_label: z.string().max(12).nullable(),
  label_confidence: z.enum(['terdeteksi', 'disimpulkan', 'tidak_diketahui']), content: z.string().max(20000),
})).max(60);
const ChunksSchema = z.array(z.object({ page_index: z.number().int().min(0), ord: z.number().int().min(0), content: z.string().min(1).max(4000) })).max(200);
const ChaptersSchema = z.array(z.object({
  ordinal: z.number().int().min(0).max(99), kind: z.enum(['bab', 'unit', 'bagian']), title: z.string().min(1).max(300),
  start_index: z.number().int().min(0), end_index: z.number().int().min(0),
  source: z.enum(['daftar_isi', 'judul_halaman', 'gabungan', 'manual']), auto_verified: z.boolean(), reviewed: z.boolean(),
})).max(100);

export async function appendUploadPart(bookId: string, part: { pages?: unknown; chunks?: unknown; chapters?: unknown }): Promise<{ ok: true } | { error: string }> {
  const { db } = await staffDb();
  const id = z.string().uuid().parse(bookId);
  if (part.pages) {
    const { error } = await db.from('book_pages').insert(PagesSchema.parse(part.pages).map((p) => ({ ...p, book_id: id })));
    if (error) return { error: error.message };
  }
  if (part.chunks) {
    const { error } = await db.from('book_chunks').insert(ChunksSchema.parse(part.chunks).map((c) => ({ ...c, book_id: id })));
    if (error) return { error: error.message };
  }
  if (part.chapters) {
    const { error } = await db.from('book_chapters').insert(ChaptersSchema.parse(part.chapters).map((c) => ({ ...c, book_id: id })));
    if (error) return { error: error.message };
  }
  return { ok: true };
}

export async function finishUpload(bookId: string): Promise<{ ok: true } | { error: string }> {
  const { db } = await staffDb();
  const id = z.string().uuid().parse(bookId);
  const { error } = await db.from('books').update({ status: 'perlu_tinjauan' }).eq('id', id);
  if (error) return { error: error.message };
  await db.rpc('log_event', { p_action: 'book.upload', p_school: null, p_target_table: 'books', p_target_id: id, p_meta: {} });
  revalidatePath('/admin/buku');
  return { ok: true };
}

/** Bila unggahan gagal di tengah jalan, hapus buku setengah jadi agar tidak tertinggal sampah. */
export async function abortUpload(bookId: string): Promise<void> {
  const { db } = await staffDb();
  await db.from('books').delete().eq('id', z.string().uuid().parse(bookId)).eq('status', 'diproses');
}
